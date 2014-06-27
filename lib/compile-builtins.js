/**
 * This is used to build the patterns used to format AviSynth builtins.
 */

var CSON = require('season');
var util = require('util');

function Builtins() {
  this.types = {};
}

function buildRegExp(fields) {
  // AviSynth is case-insensitive, so we always translate down to lower-case
  // regardless of input. We build a tree of single-character prefixes, and
  // then merge at the end.
  var prefixes = {};
  fields.forEach(function(field) {
    field = field.toLowerCase();
    var current = prefixes;
    for (var i = 0; i < field.length; i++) {
      var c = field.charAt(i);
      if (!(c in current)) {
        current[c] = {};
      }
      current = current[c];
    }
  });
  function recurse(current, regexp) {
    // First, translate this into an array of keys
    var keys = [];
    for (var c in current) {
      keys.push(c);
    }
    if (keys.length == 0) {
      // Do nothing.
      return;
    }
    // If the regexp is empty, we always want to do default processing
    if (regexp.length > 0 && keys.length == 1) {
      // Just append directly...
      regexp.push(keys[0]);
      // ...and continue.
      recurse(current[keys[0]], regexp);
      return;
    }
    // Otherwise, we have multiples. Sort the keys.
    keys = keys.sort();
    regexp.push(regexp.length == 0 ? '(?i:' : '(?:');
    keys.forEach(function(c, idx) {
      if (idx > 0) {
        regexp.push('|');
      }
      regexp.push(c);
      recurse(current[c], regexp);
    });
    regexp.push(')');
    return regexp;
  }
  var regexp = [];
  recurse(prefixes, regexp);
  return "\\b" + regexp.join('') + "\\b";
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
  injectInto: function(filename) {
    var data = CSON.readFileSync(filename);
    if (!("patterns" in data)) {
      data["patterns"] = [];
    }
    var patterns = data["patterns"];
    patterns.push.apply(patterns, this.createPatterns());
    console.log(CSON.stringify(data, null, 2));
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
var injectInto = 'grammars/avisynth.cson';
if (files.length > 1) {
  injectInto = files.pop();
}
files.forEach(function(f) { processor.processFile(f); });

processor.injectInto(injectInto);

//console.log(CSON.stringify(processor.createPatterns(), null, 2));
