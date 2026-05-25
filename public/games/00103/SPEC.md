# Room 00103 — Localization Terminal

## What it is
A geographic index scan of the current connection node. User must authorize the scan first. Results show IP address, ISP/org, country, region, city, timezone, currency, languages, and approximate coordinates with a compass display.

## Mechanic
Click "AUTHORIZE SCAN" to fetch from ipapi.co/json/ (client-side, no server involvement). Results displayed as a terminal readout. Compass needle angles toward the user's longitude. Accuracy note shown prominently.

## Navigation
- data-nav: matrix
- Connections: 00102 ← → 00104

## Notes
- Calls ipapi.co directly from the browser (CORS-safe)
- No server changes; purely client-side
- Consent framing emphasizes "the point is that it is possible"
- Falls back to error message if API is unavailable
