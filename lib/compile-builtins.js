/**
 * This is used to build the patterns used to format AviSynth builtins.
 */

var CSON = require('season');
var util = require('util');

function Builtins() {
  this.types = {};
  this.collapse = {};
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
  collapse: null,
  includes: null,
  excludes: null,
  addCollapsedKey: function(key) {
    if (arguments.length == 0) {
      // Do nothing
      return;
    }
    if (arguments.length > 1) {
      key = arguments;
    }
    if (util.isArray(key)) {
      // Add everything
      key.forEach(function(c) {
        this.collapse[c] = true;
      });
    } else {
      this.collapse[key] = true;
    }
  },
  processFile: function(filename) {
    var data = CSON.readFileSync(filename);
    // Pull out the meta key - it contains metadata for us and should otherwise
    // be ignored.
    var meta = data['meta'];
    delete data['meta'];
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
  /**
   * Determine if a given path is being included or excluded.
   */
  filterPath: function(path) {
    if (this.includes) {
      if (!this.includes.test(path)) {
        return false;
      }
    }
    if (this.excludes) {
      if (this.excludes.test(path)) {
        return false;
      }
    }
    return true;
  },
  _recurseTypes: function(path, types) {
    for (var k in types) {
      var o = types[k], p;
      if (path.length == 0) {
        // Must use the current path name
        p = k;
      } else if (path in this.collapse) {
        // If we've been told to collapse all subpaths at this path, just don't
        // append the new key.
        p = path;
      } else {
        // Otherwise, append it.
        p = path + "." + k;
      }
      if (!this.filterPath(p)) {
        // If the path is excluded, just ignore it
        continue;
      }
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
  writePatterns: function(dest) {
    if (!dest)
      dest = process.stdout;
    var cson = CSON.stringify(this.createPatterns());
    dest.write(cson);
    dest.write("\n");
  },
  writeAVS: function(dest, options) {
    if (!dest)
      dest = process.stdout;
    if (options['prologue']) {
      var prologue = options['prologue'];
      prologue.replace(/\r?\n/g, "\r\n");
      dest.write(prologue);
      dest.write("\r\n");
    }
    for (var category in this.types) {
      dest.write("# " + category + "\r\n\r\n");
      var suffix = "";
      if (category.startsWith("function.") || category == 'function')
        suffix = "()";
      this.types[category].forEach(function(type) {
        dest.write(type);
        dest.write(suffix);
        dest.write("\r\n");
      });
      dest.write("\r\n");
    }
  },
  writeGrammarCSON: function(dest, options) {
    if (!dest)
      dest = process.stdout;
    var data = {
      "scopeName": "source.builtins.avs",
      "fileTypes": [ ],
      "name": "AviSynth Builtins",
      "patterns": this.createPatterns()
    };
    dest.write("# This is an auto-generated file.\n");
    dest.write(CSON.stringify(data));
  }
}

module.exports = Builtins;

if (module.parent == null) {
  var fs = require('fs');
  var processor = new Builtins();

  // Parse the command line options:
  var args = require('minimist')(process.argv.slice(2), {
    'string': [ 'dest', 'test-avs', 'excludes', 'includes', 'collapse' ],
    'boolean': [ 'dump-patterns' ]
  });

  if (args._.length == 0) {
    console.log("No files given: nothing to do!");
    process.exit(1);
    return;
  }

  if (args.collapse) {
    processor.addCollapsedKey(args.collapse);
  }
  if (args.excludes) {
    processor.excludes = new RegExp(args.excludes);
  }
  if (args.includes) {
    processor.includes = new RegExp(args.includes);
  }

  args._.forEach(function(f) { processor.processFile(f); });

  if (args['dump-patterns'])
    processor.writePatterns();

  if (args['dest']) {
    var stream = fs.createWriteStream(args['dest']);
    processor.writeGrammarCSON(stream);
    stream.end();
  }

  if (args['test-avs']) {
    var stream = fs.createWriteStream(args['test-avs']);
    processor.writeAVS(stream, {
      'prologue': "# This file is generated from the compile-builtins.js script.\n# It contains a list of all symbols and may be used to test the generated patterns work.\n"
    });
    stream.end();
  }
}
