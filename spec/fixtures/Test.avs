# This file is a simple test file of various language features.

/*
 * Comment folding test.
 */

[*
 Comment folding test.
*]

[* Like nested
 [* Comments
  [* That can be nested multiple times *]
  Still a comment!
 *]
  Still a comment!
*]

global not_a_comment = TRUE

function foo(clip c, string s, int i, float f, bool b, val v) {
    return NOP()
}

FuNcTiOn foo(clip "c", string "s", int "i", float "f", bool "b", val "v") {
    return BlankClip()
}

try {
    SomethingHorrible()
} catch(err_msg) {
    # Whatever cleanup
}

an_int = 1
a_float = 1.234
color = $FFAA00
color2= $ffaa00
color3=$01ccAA
a_string = "hello"
another_string = """this string
can span
multiple lines."""
other="$aaBBcc"

Eval("""
# A bunch of code.
# Conceptually this could be highlighted.
global whatever = 1
""")

BlankClip().Subtitle("Hello!")

# Check things with single suffixes
AudioDub()
AudioDubEx()
AudioLength()
AudioLengthF()

__END__

And everything below this should be ignored
