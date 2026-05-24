# [00061] — Paradox: Banach-Tarski

**Status:** Built
**Last updated:** 2026-05-23

## What it is
The Banach-Tarski paradox: one sphere, decomposed into 5 non-measurable pieces,
reassembled into two identical spheres. Displays the theorem statement, a three-step
diagram (1 sphere → 5 labeled pieces → 2 spheres), and an explanatory account covering
the Axiom of Choice, non-measurable sets, and why the theorem is true but not physical.

## How it works
Static HTML. Diagram uses inline SVG for the spheres (circle + ellipse for 3D effect)
and simple CSS flex for the labeled piece boxes. No interaction. No server calls.

## Data files
None.

## Navigation
Matrix nav. Connects: 00060 (left), 00062 (right).

## Locked content
None.

## Notes for future development
Could animate the decomposition — sphere fading into 5 pieces, then recomposing into 2.
Currently static diagram. The "pieces" are labeled A–E as abstract boxes; a more
accurate depiction of non-measurable sets is not visually possible.
