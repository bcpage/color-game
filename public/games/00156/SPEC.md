# Room 00156 — Vending Machine

## What it is
A broken vending machine. 12 slots across 3 rows, all named with facility-aesthetic products (LIMINAL COLA, VOID BAR, RECURSIVE CANDY, etc.). 3 slots are marked sold-out. Insert coins (random 25¢/50¢/$1 per click). Select a product. Hit VEND. Machine takes the money, dispenses nothing. Cancel → coin return jammed → money gone. Attempt count tracked.

## Navigation
- data-nav: matrix
- Connections: 00155 ← → 00157

## Notes
- Fully client-side — no server, no persistence beyond localStorage
- localStorage 'vend_coins_lost': running total of money deposited (never gets it back)
- localStorage 'vend_attempts': total vend attempts this device
- Coin slot: random 25¢, 50¢, or $1.00 per click; credit accumulates
- Vend: checks credit ≥ price, deducts credit, then after 1.8s "Error: Item unavailable. Funds retained."
- Cancel with credit: shows "coin return jammed" then confiscates funds after 2s
- Products: A1–C4 grid codes; 3 items sold-out; names from facility word pool (LIMINAL, VOID, RECURSIVE, DATUM, SIGNAL, etc.)
- Machine layout: product grid (left) + control panel (right) side-by-side
- Note: "The machine accepts all coins. It dispenses nothing. The money is gone."
