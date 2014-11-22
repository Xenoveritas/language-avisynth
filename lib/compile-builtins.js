/**
 * This is used to build the patterns used to format AviSynth builtins.
 */

var CSON = require('season');
var util = require('util');

function Builtins() {
  this.types = {};
}

function Node(name) {
  this.name = name;
  this.children = null;
  this.firstChild = null;
  this.count = 0;
  this.terminal = false;
}

Node.prototype = {
  /**
   * All children (object)
   */
  children: null,
  /**
   * A bit of a hack, this is the first child added. For nodes with only one
   * child, this is the only child. This is needed for collapse when traversing
   * chunks with only single children.
   */
  firstChild: null,
  getChild: function(char) {
    if (this.children == null) {
      // Always have to create it.
      var child = new Node(char);
      this.children = { };
      this.children[char] = child;
      this.firstChild = child;
      this.count = 1;
      return child;
    } else {
      if (char in this.children) {
        return this.children[char];
      } else {
        var child = new Node(char);
        this.children[char] = child;
        this.count++;
        return child;
      }
    }
  },
  /**
   * Collapse all children with single children into a single node.
   * So if there's a branch that goes -A-> O -B-> O -C-> O this will collapse it
   * into a single branch -ABC-> O.
   * Note: Terminal nodes can never be collapsed, they can only be traversed
   * through.
   */
  collapse: function() {
    var childrenToRemove = [];
    var childrenToAdd = [];
    for (var c in this.children) {
      var child = this.children[c];
      if (child.count == 1 && !child.terminal) {
        // This can be collapsed
        var path = [ c ];
        while (child.count == 1 && !child.terminal) {
          child = child.firstChild;
          path.push(child.name);
        }
        // child is now the new child so give it its new name
        child.name = path.join('');
        // We can't mutate (or at least really, really shouldn't - we actually
        // *can* but it can potentially weird out the iterating order) the
        // children list in the middle of iterating, so just mark these
        childrenToRemove.push(c);
        childrenToAdd.push(child);
      }
    }
    for (var i = 0; i < childrenToRemove.length; i++) {
      delete this.children[childrenToRemove[i]];
    }
    for (var i = 0; i < childrenToAdd.length; i++) {
      this.children[childrenToAdd[i].name] = childrenToAdd[i];
    }
    // Now that we've collapsed ourself, let our children collapse themselves.
    for (var c in this.children) {
      this.children[c].collapse();
    }
  },
  sortedChildList: function() {
    var list = [];
    for (var c in this.children) {
      list.push(c);
    }
    list.sort();
    return list;
  },
  toRegExp: function() {
    // Special case for the root node.
    if (this.count == 0)
      return '';
    var re = [];
    var list = this.sortedChildList();
    for (var i = 0; i < list.length; i++) {
      re.push(this.children[list[i]]._toRegExp());
    }
    return '(?i:' + re.join('|') + ')';
  },
  _toRegExp: function() {
    // FIXME: We should also locate common suffixes in the tree.
    // The real-world example is AVISource and AVIFileSource which it would be
    // nice to translate into /avi(?:file)?source/
    if (this.count == 0) {
      // Only one way to get here, so just return this exactly
      return this.name;
    }
    // Otherwise, recurse through our children
    var re = [];
    var list = this.sortedChildList();
    for (var i = 0; i < list.length; i++) {
      re.push(this.children[list[i]]._toRegExp());
    }
    re = this.name + '(?:' + re.join('|') + ')';
    if (this.terminal)
      re += '?';
    return re;
  },
  toString: function() {
    if (this.children == null)
      return 'true';
    var s = [ ];
    for (var c in this.children) {
      s.push('"' + c + '": '+ this.children[c].toString());
    }
    return '{' + s.join(', ') + '}';
  }
}

function buildRegExp(fields) {
  // AviSynth is case-insensitive, so we always translate down to lower-case
  // regardless of input. We build a tree of single-character prefixes, and
  // then merge at the end.
  var tree = new Node('');
  fields.forEach(function(field) {
    field = field.toLowerCase();
    var current = tree;
    for (var i = 0; i < field.length; i++) {
      current = current.getChild(field.charAt(i));
    }
    current.terminal = true;
  });
  tree.collapse();
  return "\\b" + tree.toRegExp('i') + "\\b";
}

Builtins.prototype = {
  suffix: ".avs",
  processFile: function(filename) {
    var data = CSON.readFileSync(filename);
    this._recurseTypes("", data);
  },
  createPatterns: function() {
    var types = this.types, suffix = this.suffix, keys = [];
    for (var k in this.types) {
      keys.push(k);
    }
    keys.sort();
    var result = [];
    keys.forEach(function(path) {
      result.push({
        "name": path + suffix,
        "match": buildRegExp(types[path])
      });
    });
    return result;
  },
  _recurseTypes: function(path, types) {
    for (var k in types) {
      var o = types[k], p = path.length == 0 ? k : path + "." + k;
      if (util.isArray(o)) {
        if (p in this.types) {
          // Already have stuff here, push new stuff onto it
          var existing = this.types[p];
          this.types[p] = existing.concat.apply(existing, o);
        } else {
          this.types[p] = o;
        }
      } else if (typeof o == 'object') {
        this._recurseTypes(p, types[k]);
      } else {
        console.log("Warning: Ignoring " + (typeof o) + " at " + p);
      }
    }
  },
  dumpPatterns: function(dest) {
    if (!dest)
      dest = process.stdout;
    var cson = CSON.stringify(this.createPatterns(), null, 2);
    dest.write(cson);
    dest.write("\n");
  },
  injectInto: function(filename) {
    var data = CSON.readFileSync(filename);
    if (!("patterns" in data)) {
      data["patterns"] = [];
    }
    var patterns = data["patterns"];
    patterns.push.apply(patterns, this.createPatterns());
  }
}

var processor = new Builtins();

var files = [];

for (var i = 2; i < process.argv.length; i++) {
  // TODO: Parse arguments?
  files.push(process.argv[i]);
}

if (files.length == 0) {
  files = ['builtins.cson'];
}
// Not yet
//var injectInto = 'grammars/avisynth.cson';
//if (files.length > 1) {
//  injectInto = files.pop();
//}
files.forEach(function(f) { processor.processFile(f); });

processor.dumpPatterns();
//processor.injectInto(injectInto);

//console.log(CSON.stringify(processor.createPatterns(), null, 2));
