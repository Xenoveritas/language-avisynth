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
fUnCtIoN   baz   (   clip   a  ,  string   "s"    ){
    # Just a bunch of extra whitespace
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

# ImageSource pattern highlighting
ImageSource("test%04d.png")
# Check with whitespace and an illegal pattern
ImageSource ( "test%.png" )

Eval("""
# A bunch of code.
# Conceptually this could be highlighted.
global whatever = 1
""")

Eval("# Eval should be highlighted here, too")

BlankClip().Subtitle("Hello!")
BlankClip ( ) . Subtitle ( "Hello", color="", font="Helvetica"  ,   font_size  = 12.5 )
BlankClip(length=4)
BlankClip(length=(5*20), color=$00FF00, something_else=NOP())

# Check things with single suffixes
AudioDub()
AudioDubEx()
AudioLength()
AudioLengthF()

__END__

And everything below this should be ignored
