# Room 00076 — The Switchboard

## What it is
A panel of 77 toggle switches — one per room. Most do nothing. Some have subtle effects.

## How it works
- Grid of CSS pill-shaped toggles (animated knob)
- State persists in localStorage key: `null_switchboard_76`
- 7 special switches trigger effects when toggled ON:
  - Index 6 (00007): background pulses dark red
  - Index 17 (00018): status bar shows "signal detected"
  - Index 25 (00026): background pulses dark blue
  - Index 42 (00043): status bar shows "acknowledged"
  - Index 51 (00052): applies/removes a 4% CSS invert filter on the body
  - Index 63 (00064): status bar shows "..."
  - Index 74 (00075): status bar shows "you already know"

## Navigation
- data-nav: matrix
- Connects to: 00075 (left), 00077 (right)

## Notes
- The references in the special switches map to rooms with significance (00052 = Illegal Prime, 00075 = Black Hole)
- Most switches are deliberately inert — players must discover which ones do anything
