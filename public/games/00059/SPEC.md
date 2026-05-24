# [00059] — Paradox: Bootstrap

**Status:** Built
**Last updated:** 2026-05-23

## What it is
A causal loop diagram. A thing was sent back in time; it enabled its own creation;
it was created; it exists; it was sent back. Four nodes in a circular SVG diagram.
Click any node to highlight it and its outgoing arrow in red. Explanatory account
below covers bootstrap paradoxes with two classic examples (book, Beethoven).

## How it works
Static HTML + inline SVG. Four `<g class="node">` elements around a circle,
connected by four `<path class="arrow">` arcs. Click handler adds/removes `.active`
class; CSS transitions handle color changes. No server calls.

## Data files
None.

## Navigation
Matrix nav. Connects: 00058 (left), 00060 (right).

## Locked content
None.

## Notes for future development
Could animate the loop continuously (pulse traveling around the circle). Currently
static until clicked. The diagram positions are hardcoded in SVG viewBox coordinates.
