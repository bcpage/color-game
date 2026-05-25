# Room 00140 — Visible Spectrum

## What it is
Four-part exploration of visible light and color perception. Part I: the spectrum gradient (380–700nm) with wavelength slider. Part II: the line of purples — the gap where magenta lives (no wavelength). Part III: six non-spectral color cards (magenta, brown, pink, white, black, grey). Part IV: RGB mixer with spectral/non-spectral classification.

## Navigation
- data-nav: matrix
- Connections: 00139 ← → 00141

## Notes
- Fully client-side — no server, no persistence
- Wavelength→RGB using Bruton's algorithm with gamma 0.8 and edge rolloff
- Spectrum canvas: 560×60, tick marks at 50nm intervals
- Gap canvas: red→magenta→violet gradient strip, labeled
- Non-spectral detection: rough heuristic — R+B significant, G suppressed = non-spectral
- The magenta card correctly notes: no wavelength produces magenta; it's a visual cortex gap-fill
- Room note: "Your brain invented them. You can see them. They are real. They just don't exist in the spectrum. This is considered normal."
