# Room 00139 — Logo Turtle

## What it is
A Logo programming environment. Type Logo commands; watch a turtle draw on a canvas. Supports procedures (TO/END), REPEAT loops, IF conditionals, pen control, and color/size settings. Eight built-in examples from square to recursive tree.

## Navigation
- data-nav: matrix
- Connections: 00138 ← → 00140

## Notes
- Fully client-side — no server, no persistence
- Parser: FD, BK, RT, LT, PU, PD, HOME, CS, SETCOLOR r g b, SETPENSIZE n, REPEAT n [cmds], IF cond [cmds], TO name :args … END, STOP
- Arithmetic in args: +, -, *, / (simple infix: left-to-right, no precedence)
- Procedures support recursion (tree, fern, spiral examples)
- Step limit: 50,000 (prevents infinite loops from hanging browser)
- Ctrl+Enter runs the program
- Turtle rendered as orange triangle pointing in heading direction
- Canvas 420×380, turtle starts at center heading up (−90°)
- Background grid: subtle dots every 40px
- Note: "The counselor has been here since 1966. The turtle has been here since 1967. They do not know about each other."
