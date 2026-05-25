# Room 00116 — Facility Calendar

## What it is
A date override console. Shows the current month as a navigable calendar grid. User can select any date, which is stored in localStorage as the "facility date." Live system time, day-of-year, and Unix epoch displayed below.

## Mechanic
Prev/next month buttons navigate the calendar. Click any day to select it as the facility date. Selected date persists across page loads via localStorage. No server state.

## Navigation
- data-nav: matrix
- Connections: 00115 ← → 00117

## Notes
- Pure client-side; no server changes
- "Feeds lock conditions" deferred — infrastructure is here, other rooms can check localStorage key null-facility-date
