## 0.6.1
* Add missing builtins for AviSynth version 2.6.

## 0.6.0
* Update builtins for AviSynth version 2.6.

## 0.5.1
* Move the settings to its new home.
* Fix `eval`s with whitespace in them not being highlighted (like `eval ( """`...`""" )`)
* `ImageSource` no longer highlights itself as a string, just the first argument

## 0.5.0
* Eval blocks and variable assignments are now highlighted.

## 0.4.1
* Remember that the changelog exists.

## 0.4.0
* Fix built-in generation so that things that have a single suffix don't get masked by the suffix. (e.g, `AudioDub` versus `AudioDubEx`)

## 0.3.0
* Add global, try, and catch.
* Highlight function parameter types and names in function definition bodies.
* Fix numeric highlighting for hex and floating point values.

## 0.2.2
* Make return case-insensitive because AviSynth is still case-insensitive

## 0.2.1
* Highlight "return" keyword

## 0.2.0
* Add snippets
* Mark off probably accidentally commented out continuations

## 0.1.0 - First Release
* Basic syntax highlighting support
