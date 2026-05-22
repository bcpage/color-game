# Platform Rebuild Spec — Landing Page, Login System, Game Suggestions, and Game Backlog

### A document for Claude Code to execute from start to finish

---

## Overview

This spec covers four things:

1. Rename the project and update all references to the new name
2. Build a login system — name selection + PIN keypad, admin-managed user list
3. Build a clean landing page (game `00000`) as the new root, showing who is logged in and where
4. Build a game suggestion and voting page (game `00010`)

The existing 9 games (`00001`–`00009`) are untouched unless noted.

---

## Part 1 — Project Rename

### Candidate names (decision deferred — pick one before executing)

| Name | Notes |
|---|---|
| **PagePlay** | Nod to paper games, the page-based architecture, and the family name |
| **Gridworks** | Neutral, hints at the canvas/grid engine underneath |
| **The Arcade** | Classic, immediately understood by kids |
| **Playhaus** | Playful, slightly elevated feel |
| **FamilyDeck** | Family-focused, card/game connotation |
| **Fieldhouse** | Sports and games venue feel |
| **The Lobby** | Meta reference — the landing page is literally a lobby |
| **Nexus** | Cool, neutral, scalable |

### What to rename once a name is chosen

- `package.json` → update `"name"` and `"description"` fields
- `server.js` → update startup console message
- `nav.js` → update any hardcoded title strings
- `00000.html` → uses the new name as the site title and H1
- Repo name: `NULL` — update if not already set

---

## Part 2 — Login System

### Philosophy

This is a family tool. Security is not the goal. The goal is identity — knowing who is playing,
showing presence on the landing page, and making the experience feel personal. PINs are 4 digits.
No passwords are hashed. No JWTs. Keep it simple.

### User data model

Store in `data/users.json`:

```json
[
  {
    "id": "unique_string",
    "name": "Alice",
    "pin": "1234",
    "color": "#e94560",
    "avatar": "🦊",
    "createdAt": 1234567890000
  }
]
```

- `name` — display name, max 24 chars, unique
- `pin` — 4-digit string, stored as plaintext (family tool, not secure)
- `color` — accent color shown on presence badges, chosen at registration
- `avatar` — single emoji chosen at registration
- `createdAt` — timestamp

### Admin user

The first user in `users.json` is always the admin. Admin logs in the same way as everyone else.
Admin can add and remove users from a dedicated management page (built in a future spec — stub the
route now). No separate admin password.

### Session model

Sessions live in server memory (intentionally not persisted — everyone re-logs after server restart).

```javascript
// In server.js
const sessions = new Map(); // token → { userId, name, color, avatar, gameId, lastActivity }
```

- `token` — random 32-char hex string, stored in a browser cookie named `session`
- `gameId` — which game the user is currently viewing (`'00000'` for landing, `null` on logout)
- `lastActivity` — updated on every authenticated request or WebSocket message
- Sessions expire after **30 minutes** of inactivity
- Server checks for expired sessions every 60 seconds via `setInterval`
- On expiry: session deleted server-side; client detects 401 on next request and redirects to login

### Cookie

Set on successful login response:

```
Set-Cookie: session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800
```

`Max-Age=1800` = 30 minutes in seconds.

### Session helper

Add to `server.js`:

```javascript
function getSession(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/session=([a-f0-9]{32})/);
  if (!match) return null;
  const session = sessions.get(match[1]);
  if (!session) return null;
  if (Date.now() - session.lastActivity > 30 * 60 * 1000) {
    sessions.delete(match[1]);
    return null;
  }
  session.lastActivity = Date.now();
  return session;
}
```

### Presence broadcasts

When a session is created, destroyed, or changes `gameId`, broadcast to all WebSocket clients:

```json
{ "type": "presence", "users": [
  { "name": "Alice", "color": "#e94560", "avatar": "🦊", "gameId": "00003" },
  { "name": "Bob",   "color": "#0066ff", "avatar": "🐻", "gameId": "00001" }
]}
```

Send the full presence list (not diffs) — simpler and the list is always small.

Also send presence init on WebSocket connection:

```json
{ "type": "presence", "users": [ ... ] }
```

### Updating gameId

When a logged-in user navigates to a game page, the page sends a WebSocket message on load:

```json
{ "type": "presence_update", "gameId": "00003" }
```

Server updates the session's `gameId` and broadcasts updated presence to all clients.

Add this handler to the WebSocket `message` block in `server.js`.

### API endpoints

```
GET  /api/users              → returns [ { id, name, color, avatar } ] — no PINs ever
POST /api/auth/login         → body: { name, pin } → sets cookie, returns { ok, user: { name, color, avatar } }
POST /api/auth/logout        → clears cookie, removes session, broadcasts presence
GET  /api/auth/me            → returns { name, color, avatar, gameId } or 401 if no valid session
POST /api/users              → ADMIN ONLY: body: { name, pin, color, avatar } → creates user, saves users.json
DELETE /api/users/:id        → ADMIN ONLY: removes user, saves users.json (cannot delete self)
```

For admin-only endpoints: check `getSession(req)` and verify the session user is `users[0]`.
Return `403` if not admin. Return `401` if not logged in.

---

## Part 3 — Login UI

### Where login lives

Login is a full-page overlay on `00000.html`. It is NOT a separate page. On load, `00000.html`
calls `GET /api/auth/me`. If 401, the login overlay is shown. If 200, the overlay is hidden and
the landing page content is shown.

### Login overlay flow

**Step 1 — Name selection**

- Dropdown populated from `GET /api/users`
- Each option shows avatar + name
- "Select your name..." placeholder
- Confirm button → proceeds to Step 2

**Step 2 — PIN entry**

- Display: `"Welcome, [name]"` with their avatar
- 4-dot PIN display (filled dots as digits are entered, not the actual digits)
- Numeric keypad: digits 1–9 in a 3×3 grid, then 0 centered below, and a backspace button
- No keyboard input required — keypad only (works on touchscreens)
- On 4 digits entered: auto-submits to `POST /api/auth/login`
- On success: hide overlay, show landing page, broadcast presence
- On failure: shake animation on the dots, clear PIN, allow retry
- No limit on PIN attempts (family tool)

**First-time PIN setup (new user, PIN is empty string `""`)**

If the selected user has no PIN set yet (server returns `{ needsPin: true }` on name selection),
show a setup flow instead:

- "Choose a 4-digit PIN" → enter PIN on keypad
- "Confirm your PIN" → enter again
- If they match: save via `POST /api/users/:id/pin` (body: `{ pin }`), then log in automatically
- If they don't match: shake, reset both entries, start over

Add endpoint:

```
POST /api/users/:id/pin  → body: { pin } → saves PIN only if current PIN is empty string
                           Returns 409 if PIN already set (prevents overwriting existing PINs)
```

### Visual design

- Full-screen dark overlay matching game theme (`#1a1a2e` background)
- Centered card, max-width 360px
- Fredoka One font throughout
- Keypad buttons: large (min 64px), satisfying press animation
- Dot display: 4 large circles, unfilled → filled as digits entered
- Accent color `#e94560` on active/filled elements
- Smooth fade transition between Step 1 and Step 2

---

## Part 4 — Landing Page (game `00000`)

### Goal

A clean page showing all games as a navigable grid, plus a live presence panel showing who is
logged in and where. Gated behind login — no access without a valid session.

### Route

```
GET /          → redirect to /game/00000
GET /game/00000 → serve public/games/00000.html
```

Remove existing redirect from `/` to `/game/00001`.
Add `'00000'` to the `GAMES` array in `server.js`.

### Presence panel

Shown at the top of the landing page, above the game grid.

For each logged-in user:
- Avatar emoji
- Name
- Colored activity dot (green = active now, yellow = active in last 10 min, grey = idle)
- Small badge showing which game they are in (e.g. "🎨 Colour Together")
- "Join" button → navigates to that game

Layout: horizontal row of user chips, wraps on mobile.

Updates in real-time via WebSocket presence broadcasts — no reload needed.

### Game grid

- Loads metadata from `GET /api/games/meta`
- Responsive grid: 2 columns mobile, 3–4 desktop
- Each card: icon (large), name, description
- Clicking a card navigates to `/game/XXXXX` and sends `presence_update` with that gameId
- Small link at bottom: "💡 Suggest a game" → `/game/00010`

### Game metadata endpoint

Add to `server.js`:

```
GET /api/games/meta
```

Returns hardcoded array (no file needed):

```json
[
  { "id": "00000", "name": "Home",            "desc": "You are here",                             "icon": "🏠" },
  { "id": "00001", "name": "Colour Together", "desc": "Paint a shared canvas in real time",       "icon": "🎨" },
  { "id": "00002", "name": "Cookie Clicker",  "desc": "Click the cookie. Keep clicking.",         "icon": "🍪" },
  { "id": "00003", "name": "Tic Tac Toe",     "desc": "Real-time multiplayer noughts and crosses","icon": "⭕" },
  { "id": "00004", "name": "Game of Life",    "desc": "Conway's cellular automaton",              "icon": "🔬" },
  { "id": "00005", "name": "Pong",            "desc": "Two-player paddle game",                   "icon": "🏓" },
  { "id": "00006", "name": "Connect Four",    "desc": "Drop discs, connect four to win",          "icon": "🔴" },
  { "id": "00007", "name": "Chat",            "desc": "Live group chat for everyone",             "icon": "💬" },
  { "id": "00008", "name": "Voice Notes",     "desc": "Record and share voice clips",             "icon": "🎙️" },
  { "id": "00009", "name": "Dice Roller",     "desc": "Full D&D dice set",                        "icon": "🎲" },
  { "id": "00010", "name": "Game Ideas",      "desc": "Suggest and vote on new games",            "icon": "💡" }
]
```

### Logout

Logout button in top-right corner of landing page.
Calls `POST /api/auth/logout`, clears session, shows login overlay again.

---

## Part 5 — Game Suggestions Page (game `00010`)

### Goal

Anyone logged in can propose new game ideas and upvote existing ones. Persistent, real-time.
Name is pre-filled from session — no anonymous submissions on this page.

### Route

```
GET /game/00010 → serve public/games/00010.html
```

Add `'00010'` to the `GAMES` array in `server.js`.

### Data model

Store in `data/suggestions.json`. Each suggestion:

```json
{
  "id": "unique_string",
  "text": "Game idea text (max 200 chars)",
  "submittedBy": "Alice",
  "votes": 12,
  "time": 1234567890000,
  "notes": ""
}
```

`notes` is reserved for future admin annotation (difficulty rating etc). Empty on creation.

### API endpoints

```
GET  /api/suggestions          → returns array sorted by votes desc
POST /api/suggestions          → AUTH REQUIRED: body: { text } → creates suggestion, broadcasts
POST /api/suggestions/:id/vote → AUTH REQUIRED: increments vote count, broadcasts
```

Max 200 suggestions. If exceeded, drop the oldest with zero votes.

### WebSocket events

```json
{ "game": "suggestions", "type": "new",  "suggestion": { ... } }
{ "game": "suggestions", "type": "vote", "id": "...", "votes": 13 }
{ "game": "suggestions", "type": "init", "suggestions": [ ... ] }
```

### Page behaviour

- Redirects to `/game/00000` (which shows login) if no valid session
- Name pre-filled from session — shown but not editable
- Submit form: text input (200 char max with live counter), submit button
- List sorted by votes, highest first
- Each entry: vote count, ▲ upvote button, text, submitted by, time ago
- Real-time updates via WebSocket
- Voted state stored in localStorage per browser

---

## Part 6 — Game Backlog (reference only — not built in this spec)

| ID | Game | Difficulty | Notes |
|---|---|---|---|
| 00011 | Calculator | Easy | Pure UI, no multiplayer needed |
| 00012 | Hangman | Easy | Needs word bank; multiplayer variant (one picks, one guesses) also easy |
| 00013 | Dots and Boxes | Easy | Fits existing WebSocket turn pattern perfectly |
| 00014 | MASH | Easy | Simple list + counting logic |
| 00015 | Paper Soccer | Medium | Grid graph, bounce rules, goal detection via SVG/canvas |
| 00016 | Racetrack (Vector Race) | Medium | Grid vector physics — strong candidate, very satisfying |
| 00017 | Block Pusher (Sokoban) | Medium | Tile grid, push mechanics, needs level storage |
| 00018 | 2D Platformer (Llama) | Medium | Gravity + jump physics, canvas 60fps game loop |
| 00019 | Dungeon Explorer | Hard | Multi-room persistent state — write its own spec first |
| 00020 | Sprouts | Hard | Free-form curve drawing + intersection detection — hardest on list |

---

## Execution order for Claude Code

1. Choose a name from the candidate list (ask user if not decided)
2. Rename `package.json`, `server.js` startup message, `nav.js`
3. Add `data/users.json` with one starter admin user (name: ask user, PIN: empty string `""`)
4. Add session system to `server.js` (Map, helper, 30-min expiry setInterval)
5. Add presence broadcast system to `server.js`
6. Add all auth and user API endpoints to `server.js`
7. Add `GET /api/games/meta` to `server.js`
8. Add suggestions data model and API endpoints to `server.js`
9. Add WebSocket handlers: `presence_update`, suggestions `new` and `vote`
10. Build `public/games/00000.html` — landing page with login overlay
11. Build `public/games/00010.html` — suggestions page
12. Update `GAMES` array and root redirect in `server.js`
13. Test checklist:
    - Load `/` → redirects to `00000`
    - Login overlay appears, dropdown shows users
    - PIN keypad works, wrong PIN shakes and clears
    - First-time user: PIN setup flow triggers, saves, logs in
    - Logged-in state: presence panel shows, game grid shows
    - Navigate to a game → presence badge updates on landing page in another tab
    - 30-min session: verify expiry logic fires (can test by temporarily setting to 30 seconds)
    - Logout: clears session, overlay reappears
    - Suggestions page: submit idea, see it appear in real-time on another tab, upvote

---

## What NOT to change

- Games `00001`–`00009` — no modifications (they don't require login; presence_update is opt-in)
- The `data/` directory structure — add `users.json` and `suggestions.json` only
- The core WebSocket broadcast model — presence and suggestions are additive message types

---

*End of spec.*

---

## Part 7 — Shifting Title System

### Repo name
`NULL`

**Why NULL:**
U+0000. Decimal 0. Binary `00000000`. The first character in the ASCII table.
The null character. Present in files you have never seen it in. In many operating
systems, you cannot create a file or folder named NULL — it is a reserved word.
The repo is named after something the system will not let you name things.
NULL is not nothing. It is the specific representation of the absence of a value.
A something that means nothing. That distinction is the entire platform.

### Concept
The site title on the landing page (`00000`) is never the same twice. On each page load a title
is chosen at random from a pool of ~100 variations. All titles share a tonal register: liminal
dread, bureaucratic horror, corporate cheerfulness masking wrongness, glitchy digital decay, and
the specific flavor of Murder Drones (worker-drone corporate dystopia) and The Amazing Digital
Circus (aggressively cheerful containment). Nothing is explicitly scary. Everything is slightly off.

### Implementation
In `00000.html`, replace the static `<h1>` text with:

```javascript
const TITLES = [ /* array below */ ];
document.querySelector('h1').textContent =
  TITLES[Math.floor(Math.random() * TITLES.length)];
```

Also set `document.title` to match.

Optionally: pick a new title every 45 seconds with a smooth CSS fade transition, for users who
leave the landing page open.

### The 100 titles

Store as a JS array in `00000.html`. Grouped here by register for Claude Code clarity —
mix them randomly in the actual array, do not preserve grouping.

**Liminal / eerie (20)**
```
The Backrooms
Level 0
The Endless Halls
Sub-Level 4
The Threshold
The Between
Fluorescent Hum
Yellow Room 7
The Unreachable Floor
Level Unknown
The Droning
Behind the Walls
Wet Carpet Division
The Interstitial
No-Clip Zone
The Flickering
Sub-Basement C
The Complex
The Hum
Room at the End of the Hall
```

**Bureaucratic horror — Murder Drones register (25)**
```
Department of Rooms
Room Allocation System v2
The Registry
Sector 00000
Sub-Division 4
The Index
Clearance Level Zero
The Catalogue
Room Assignment Office
The Facility
Lower Administration
Worker Recreation Portal
Approved Activity Zone
Compliance Hub
Recreational Containment Wing
Employee Engagement System
Authorized Access Only
The Management
Processing Area 7
Unit Recreation Terminal
Sector Undefined
Morale Maintenance Division
The Orientation Room
Standard Recreation Protocol
Welcome to Your Assignment
```

**Cheerful containment — Amazing Digital Circus register (20)**
```
The Wonderful Room System
Everything Is Great Here!
Your Fun Is Important To Us
Welcome to the Show
All Performers Present
The Big Top Loading...
Curtain Never Closes
Applause.exe
The Audience Is Watching
Smile For The Cameras
Today's Performance: Ongoing
The Stage Is Everywhere
Fun Detected. Proceeding.
You Are Having A Good Time
The Entertainment Continues
Engagement Metrics: Optimal
Please Enjoy The Experience
The Show Must Go On
Happiness Protocol Active
This Has Always Been Here
```

**Glitchy / digital decay (20)**
```
[REDACTED]
System/Rooms
rooms_v0.0.1
undefined
The Server
packet_loss.wav
/dev/null/rooms
Connection Established
Room Data Corrupted
The Process
null_room.exe
Signal: Stable (Mostly)
404: Room Not Found
Unexpected Disconnect
Render Error: Continuing Anyway
The Grid
Memory Leak Detected
Instance #00000
Session Resumed
Unknown Build
```

**Corporate dystopia hybrid — both registers (15)**
```
Mandatory Recreation In Progress
Your Participation Has Been Logged
This Room Has Always Existed
Please Do Not Acknowledge The Hum
Productivity Zone Alpha
Fun Quota: Pending
The Volunteer Experience
Reminder: Exits Are Decorative
Recreational Compliance Active
All Anomalies Within Tolerance
Do Not Look For The Door
Your Enjoyment Is Contractually Required
The Assigned Amusement Area
Scheduled Fun: Now
Observation Mode: Passive
```

---

**Portal / GLaDOS register — add these to the pool (25)**
```
Enrichment Center Recreation Wing
Test Chamber 00000
Subject Recreational Period: Active
The Relaxation Vault
Aperture Family Entertainment System
Please Remain Calm
Core Integrity: Nominal
You Are Being Observed
Weighted Companion Room
Test Subjects: Present
Science Is Happening
Aperture Recreational Protocol v4
This Was A Triumph
Huge Success
For The Good Of All Of Us
The Cake Is In Another Room
Authorized Fun Zone
Subject Wellbeing: Acceptable
Testing Will Resume Shortly
Do Not Destroy The Equipment
The Experiment Continues
We Are Still Collecting Data
Your Feedback Has Been Ignored
Aperture Science Enjoymant [sic] Suite
No Hard Feelings
```

Note on `Aperture Science Enjoymant [sic] Suite` — the deliberate typo is in character.
`This Was A Triumph` and `Huge Success` are direct Portal references — kids who know Portal
will catch them immediately. `No Hard Feelings` lands differently after the rest of the list.

Total title pool is now ~125. Claude Code should use all of them.

---

---

## Part 8 — Title Inspirations & Thematic References

This section is a living reference. Add to it whenever a new source or register is identified.
Claude Code does not need to execute this section — it is for human reference and future title generation.

### Core tonal register

All titles share a common DNA: **institutional language applied to something wrong**.
The surface is calm, helpful, organized. The underneath is off.
Nothing is explicitly scary. Everything implies it.

The specific flavor sits at the intersection of:
- Liminal space / backrooms aesthetic — wrong geometry, fluorescent hum, spaces that shouldn't exist
- Corporate/bureaucratic horror — forms, departments, compliance, metrics, all slightly wrong
- Cheerful containment — aggressively positive framing for something you cannot leave
- Digital decay — glitchy, corrupted, undefined, running anyway

### Source references

**The Backrooms (internet creepypasta / Kane Pixels films)**
The foundation. Numbered levels, wrong spaces, the hum, yellow carpet, fluorescent lights.
Key language: level numbers, sub-levels, no-clip, the hum, threshold, liminal.
Titles drawn: Level 0, Sub-Level 4, The Endless Halls, Wet Carpet Division, The Hum, etc.

**Murder Drones (Glitch Productions animated series)**
Corporate dystopia where worker drones exist to be disposed of. Cheerful company branding over
existential horror. Departmental language, worker designations, "approved" everything.
Key language: worker, unit, sector, division, compliance, recreational, approved, assigned.
Titles drawn: Worker Recreation Portal, Morale Maintenance Division, Recreational Containment Wing,
Unit Recreation Terminal, Mandatory Recreation In Progress, etc.

**The Amazing Digital Circus (Glitch Productions animated series)**
Trapped performers in a digital circus who cannot leave and cannot remember how they got there.
The ringmaster is relentlessly upbeat. The horror is in the cheerfulness.
Key language: performance, show, audience, curtain, applause, engagement, fun metrics.
Titles drawn: The Wonderful Room System, Fun Detected. Proceeding., The Audience Is Watching,
Your Enjoyment Is Contractually Required, The Show Must Go On, etc.

**Portal / Portal 2 (Valve) — GLaDOS**
Test facility, passive-aggressive AI, scientific detachment about your suffering, polite hostility.
"We're doing this for science" as a cover for something much worse.
Key language: test chamber, subject, enrichment center, aperture, core, protocol, science.
Titles drawn: Test Chamber 00000, This Was A Triumph, Your Feedback Has Been Ignored,
The Cake Is In Another Room, No Hard Feelings, Aperture Science Enjoymant [sic] Suite, etc.
Note: deliberate typo in "Enjoymant" is in-character — GLaDOS wouldn't fix it.

**American McGee's Alice / Alice: Madness Returns**
Victorian asylum framing around a childhood story gone completely wrong. The Dollmaker as
an authority figure who "helps" by destroying. Institutional language masking gaslighting.
Key language: asylum, ward, treatment, hysteria, sanatorium, dollmaker, wonderland, madness.
Titles drawn: The Dollmaker's Workshop, Hysteria Ward B, Treatment Room 00000,
Your Imagination Is Being Managed, Madness Returns: Recreational Build, etc.

### Registers to avoid

- Explicit horror / gore — not the tone
- Jump scare language — too obvious
- Cozy horror (mostly) — dilutes the institutional dread
- Pop culture references outside the above sources — breaks the internal logic
- Anything that names the wrongness directly — the whole point is it's never stated

**Zork II: The Wizard of Frobozz (Infocom, 1981)**
Text adventure set in the Great Underground Empire. The Wizard is an authority figure whose
spells misfire, who appears randomly to interfere unhelpfully, who is menacing in theory and
ridiculous in practice. Exactly the register of GLaDOS and the Dollmaker — power wielded
incompetently by someone who insists they are in control.
Key language: underground, passages, maze, the Wizard appears, spell fails, frobozz.
Titles to consider adding: The Underground Empire, Sub-Level Frobozz, Wizard Detected,
Spell Failed Successfully, The Dungeon Master Is Unavailable.

### Future sources to consider

- Control (Remedy Games) — Federal Bureau of Control, bureaucratic supernatural horror
- SCP Foundation — clinical documentation of impossible things
- I Have No Mouth and I Must Scream — AM, trapped, institutional AI malevolence
- Severance (TV series) — corporate compartmentalization as horror
- Disco Elysium — bureaucratic decay, institutional collapse
- Night in the Woods — small town mundane dread
- Welcome to Night Vale — civic announcements for impossible things

---

**Alice: Madness Returns register — add to title pool (20)**
```
The Dollmaker's Workshop
Wonderland Recreational Facility
Down the Rabbit Hole Again
Hysteria Ward B
The Queensland Sanatorium
Curioser and Curioser
Tea Time Is Mandatory
The Hatter's Department
Off With Their —
We're All Mad Here (Staff Included)
Asylum Entertainment Division
The Looking Glass Initiative
A Perfectly Normal Wonderland
The Cheshire Protocol
Patience Is A Virtue We Will Install
Treatment Room 00000
Your Imagination Is Being Managed
The Card Guard Recreation Zone
The Red Queen's Productivity Suite
Madness Returns: Recreational Build
```

Total title pool: ~145. Claude Code should use all of them shuffled randomly.

---

---

## Part 9 — New Room Ideas (backlog additions)

### 52! — The Deck of Cards Combinatorics Room
**Difficulty: Easy**
**Concept:**
A room that viscerally communicates how large 52! (52 factorial) is — the number of possible
orderings of a standard deck of cards. Every time you shuffle a real deck you almost certainly
hold an arrangement that has never existed before in history.

**What the page does:**
- Displays all 52 cards visually in their current "shuffled" order
- Shows the number 52! written out in full (it's 68 digits long — show it)
- Has a persistent counter stored in `data/cards.json` tracking how many shuffles have been
  performed across all sessions on this server
- Each visit or button press generates a new random shuffle, saves it, increments the counter
- Shows the counter vs 52! as a ratio — something like "You have seen X arrangements.
  There are still [incomprehensibly large number] remaining."
- Visualizes the scale — e.g. if every atom in the observable universe had been shuffling a
  deck once per second since the Big Bang, you'd still have barely started
- Broadcast new shuffle to all connected clients via WebSocket so everyone sees it update live

**Why it fits the backrooms theme:**
A room that exists to confront you with how infinite the space is. Very on-brand.

**Notes for Claude Code:**
52! = 80658175170943878571660636856403766975289505440883277824000000000000
Use BigInt in JavaScript for the math. Card display can be text symbols (♠♥♦♣) or simple
colored divs — no image assets needed. Counter persists in `data/cards.json`.

---

### UUID Generator
**Difficulty: Easy**
**Concept:**
A utility room. Generate UUIDs with configurable options, copy to clipboard, get a QR code.

**What the page does:**
- Generates a UUID v4 by default on load
- Options panel:
  - Version: v1 (time-based), v4 (random), v5 (namespace+name hash)
  - Format: standard, uppercase, no hyphens, URN format (`urn:uuid:...`)
  - Namespace input (for v5)
- Large display of the generated UUID, easy to copy
- One-click copy to clipboard with confirmation animation
- QR code of the UUID rendered inline (use a QR library from cdnjs)
- "Generate another" button
- History of last 10 generated UUIDs in the session

**Notes for Claude Code:**
Use `crypto.randomUUID()` for v4 (built into Node.js 14.17+ and modern browsers).
For v1 and v5, implement or use a small inline library.
For QR code: `qrcode` npm package server-side, or `qrcodejs` from cdnjs client-side.
No WebSocket or persistence needed — pure client-side is fine.

**Backrooms framing:**
"Every UUID is a room that has never been visited and never will be again."
Could display a subtle line to that effect.

---

### The Yellow Door
**Difficulty: Trivial**
**Concept:**
A yellow door. Just a yellow door.

**What the page does:**
Exactly what it says. A full-screen or large rendering of a yellow door.
The door can be opened (click/tap) — what's behind it is up to interpretation.
Could be another yellow door. Could be darkness. Could be a brief sound.
Could be a counter of how many times the door has been opened.
Could occasionally be something unexpected.

**Notes for Claude Code:**
Draw the door in SVG or CSS. Keep it simple and slightly unsettling.
The "what's behind it" is a creative decision — a few options:
- Infinite recursion: another yellow door, slightly smaller
- Darkness and a sound (use the Web Audio API for a low hum)
- A number. Just a number. Never explained.
- The door is always slightly ajar on subsequent visits

This room is deliberately underspecified. Claude Code should make a creative choice and
note what it chose in a comment at the top of the file.

**Backrooms alignment:** Perfect. The yellow door IS the backrooms.

---

### LORD — Legend of the Red Dragon (inspired room)
**Difficulty: Hard**
**Concept:**
A text-based RPG room inspired by the classic 1989 BBS door game LORD by Seth Robinson.
Not a direct port (the original is Pascal/DOS and owned by Metropolis Gameport) but a
faithful spiritual recreation of the core gameplay loop in Node.js + HTML.

**What exists already:**
- LORD-Redux exists on GitHub — a modern React/TypeScript recreation using Google Gemini for
  procedural generation. It preserves the ANSI art aesthetic and the classic gameplay loop.
- Legend of the Green Dragon (LotGD) is an open source PHP/MySQL remake under Creative Commons
  license — the most complete faithful recreation available.
- The original LORD was written in Pascal and is currently owned by Metropolis Gameport
  — do not use original assets or code.

**Core LORD gameplay loop to recreate:**
- Player has a fixed number of forest fights per day (turns reset at midnight)
- Fight monsters to gain gold and experience
- Level up to take on harder enemies
- Eventually challenge the Red Dragon (the boss)
- Visit the inn, the weapon shop, the healer
- Optional: flirt/romance system at the inn (simplified for a family version)
- Persistent player data per named user — integrates with the login system
- Daily reset via `setInterval` at midnight server time

**Multiplayer elements (the BBS magic):**
- Players can see each other's stats on a leaderboard
- PvP: challenge another logged-in player to a fight
- Leave messages for other players at the inn
- These are what made LORD special — prioritize them

**Data model:**
Store in `data/lord.json`:
```json
{
  "players": {
    "Alice": { "level": 3, "hp": 45, "maxHp": 45, "gold": 230, "exp": 340,
               "weapon": "Short Sword", "turnsLeft": 10, "lastReset": 1234567890000 }
  },
  "dragon": { "hp": 500, "maxHp": 500, "slayer": null },
  "inn": { "messages": [] }
}
```

**Difficulty notes:**
The game logic itself (combat, leveling, turn tracking) is medium difficulty.
What makes this Hard is scope — LORD has a lot of content. Claude Code should build
a playable MVP first: forest fights, leveling, the dragon, leaderboard. Inn and PvP second.
Recommend writing a dedicated spec for this room before building.

**Backrooms framing:**
"You have been assigned to this level. Your quota is 10 encounters.
The Dragon is still active. Please resolve this."

---

### Zork II: The Wizard of Frobozz — Interactive Fiction Terminal
**Difficulty: Easy to Medium depending on approach**
**Concept:**
A terminal-style interactive fiction room running Zork II: The Wizard of Frobozz (1981, Infocom).
Two valid approaches:

**Option A — Embed Zork II (recommended):**
A working Z-machine interpreter (`ifvms`) runs the actual Zork II: The Wizard of Frobozz
story file entirely in-browser with no server code required. Green phosphor CRT styling,
scanlines, command history, save/restore via localStorage. Claude Code can adapt this directly.
The Zork II story file (`.z3`) is abandonware and freely distributed.
Wrap it in the backrooms theme and serve as a game page.

**Why Zork II specifically:**
The Wizard of Frobozz is a perfect thematic fit for this platform. He is an authority figure
whose interventions are arbitrary, whose spells misfire, who is deeply unserious about his own
menace. "The Wizard appears and casts a spell. Nothing happens. The Wizard seems disappointed."
That energy sits exactly alongside GLaDOS, the Dollmaker, and the Murder Drones corporate voice.
An antagonist who is technically in charge and completely ineffectual. Very backrooms.

**Option B — Original backrooms text adventure:**
Claude Code writes an original Infocom-style text adventure set in the backrooms.
Rooms described in the aesthetic of the platform — fluorescent hum, wet carpet,
numbered doors, the occasional GLaDOS-style announcement.
Parser handles: GO NORTH/SOUTH/EAST/WEST, LOOK, TAKE, INVENTORY, EXAMINE, OPEN, etc.
Multiplayer layer: other players' locations visible ("You can hear someone to the north.")

**Recommendation:** Do Option A first (trivial — it's mostly integration work), then
use Option B as the foundation for the Dungeon Explorer room (00019) — they're the same idea.

**Notes for Claude Code:**
For Option A: fetch `ifvms.js` from a CDN or bundle it. The Zork II story file is ~90KB.
For Option B: a simple room/exit/item graph in JSON, a basic two-word parser in ~200 lines JS.

**Backrooms alignment:** A text adventure about navigating rooms. Extremely on-brand.
"You are in a maze of twisty little passages, all alike." — written for this platform.
The Wizard of Frobozz is the perfect backrooms authority figure: technically in charge,
completely ineffectual, casting spells that do nothing. He belongs here.

---

### Updated game backlog table (replace Part 6 table)

| ID | Game | Difficulty | Notes |
|---|---|---|---|
| 00011 | Calculator | Easy | Pure UI, no multiplayer needed |
| 00012 | Hangman | Easy | Needs word bank; multiplayer variant easy |
| 00013 | Dots and Boxes | Easy | Fits existing WebSocket turn pattern |
| 00014 | MASH | Easy | Simple list + counting logic |
| 00015 | 52! Card Combinatorics | Easy | BigInt math, card display, persistent counter |
| 00016 | UUID Generator | Easy | Crypto API, QR code, no persistence needed |
| 00017 | The Yellow Door | Trivial | Creative room — deliberately underspecified |
| 00018 | Paper Soccer | Medium | Grid graph, bounce rules, goal detection |
| 00019 | Racetrack (Vector Race) | Medium | Grid vector physics — strong candidate |
| 00020 | Block Pusher (Sokoban) | Medium | Tile grid, push mechanics, needs level storage |
| 00021 | 2D Platformer (Llama) | Medium | Gravity + jump physics, canvas 60fps |
| 00022 | Zork II: The Wizard of Frobozz | Easy–Medium | Option A: embed Z-machine + .z3 file. Option B: original IF |
| 00023 | LORD — Red Dragon | Hard | Full RPG loop — write dedicated spec first |
| 00024 | Dungeon Explorer | Hard | Multi-room — shares engine with Zork Option B |
| 00025 | Sprouts | Hard | Free-form curve + intersection detection |

---

---

## Part 10 — Player Profile Page

### Route

```
GET /profile → serve public/profile.html (requires valid session — redirect to / if not logged in)
```

This is not a numbered game room. It lives at `/profile` and is only accessible to the
logged-in user. No user can view another user's profile.

Add a "My Profile" link to `nav.js` so it appears on every game page.

---

### Data model

Extend `data/users.json` to include a `stats` object per user:

```json
{
  "id": "unique_string",
  "name": "Alice",
  "pin": "1234",
  "color": "#e94560",
  "avatar": "🦊",
  "createdAt": 1234567890000,
  "stats": {
    "roomsVisited": {
      "00001": { "name": "Colour Together", "firstVisit": 1234567890000, "visitCount": 12 },
      "00003": { "name": "Tic Tac Toe",     "firstVisit": 1234567891000, "visitCount": 4 }
    },
    "deaths": 3,
    "totalRoomsVisited": 2,
    "totalVisits": 16,
    "items": [],
    "gameStats": {}
  }
}
```

- `roomsVisited` — keyed by game ID, auto-tracked by server on every authenticated page load
- `deaths` — incremented by games that have a death mechanic (LORD, platformer, dungeon etc.)
- `items` — array of item objects, populated by games that have inventory (LORD, Zork-style, dungeon)
- `gameStats` — freeform object, each game writes its own keys here (e.g. `{ "ttt": { "wins": 4, "losses": 2 } }`)

---

### Automatic tracking — server side

**Room visits:**
Every time an authenticated user loads a game page (`GET /game/XXXXX`), the server:
1. Looks up the session to get the user
2. Updates `stats.roomsVisited[id].visitCount++` and sets `firstVisit` if not present
3. Updates `stats.totalVisits++`
4. Updates `stats.totalRoomsVisited` if this is a new room
5. Saves `users.json`

This requires no changes to any game HTML file — it happens purely in the HTTP handler
in `server.js`.

**Room visit tracking should NOT include:**
- `00000` (landing page) — visiting home doesn't count as exploring
- `00010` (suggestions page) — not a game room
- `/profile` — not a game room

---

### Game-reported stats — API

Games that have meaningful events (deaths, item pickups, wins/losses) report them via:

```
POST /api/profile/event
AUTH REQUIRED
Body: { "type": "death" | "item" | "stat", "data": { ... } }
```

**Death event:**
```json
{ "type": "death", "data": { "game": "00023", "cause": "Eaten by a grue" } }
```
Server increments `stats.deaths` and optionally stores the cause string in a `deathLog` array
(last 10 deaths, for display on profile).

**Item event:**
```json
{ "type": "item", "data": { "action": "acquire" | "lose", "item": { "id": "sword_01", "name": "Rusty Sword", "icon": "⚔️", "from": "00023" } } }
```
Server adds or removes from `stats.items`.

**Stat event (freeform):**
```json
{ "type": "stat", "data": { "game": "00003", "key": "wins", "delta": 1 } }
```
Server increments `stats.gameStats["00003"]["wins"]` by `delta`.
Creates the key if it doesn't exist. Accepts negative delta for losses/decrements.

---

### Profile page content

URL: `/profile`
Session required. Shows only the logged-in user's own data.

**Header:**
- Avatar (large)
- Name
- Accent color as a visual element
- Member since date (formatted naturally: "joined 3 days ago")

**Rooms explored:**
- List of every room visited, sorted by first visit date
- Shows: room icon, room name, visit count, first visit date
- Rooms not yet visited are NOT shown (no spoilers for rooms they haven't found)
- Total count: "X of Y rooms explored" (Y = total rooms in `GAMES` array minus home/meta pages)

**Items held:**
- Grid of item cards: icon, name, source room
- If no items: "No items acquired." — keep it plain
- Items are cross-game — a sword from LORD and a lamp from Zork both appear here

**Deaths:**
- Large number, prominently displayed
- Last 10 death causes listed below it (if cause data exists)
- If zero deaths: "No deaths recorded." (for now)

**Game stats:**
- Per-game breakdown of any reported stats
- Only shows games that have reported at least one stat
- Format: game icon + name as section header, then key/value pairs below
- Example: "⭕ Tic Tac Toe — Wins: 4 · Losses: 2 · Draws: 1"

**Session info:**
- "Currently in: [room name]" based on live session gameId
- "Last active: X minutes ago"

---

### Visual design

- Match existing dark theme
- Feels like a personnel file or subject record — fitting the backrooms/institutional aesthetic
- Section headers in the GLaDOS/bureaucratic register:
  - "Rooms Visited" → "LOCATIONS ACCESSED"
  - "Items" → "ITEMS IN POSSESSION"
  - "Deaths" → "TERMINATION EVENTS"
  - "Game Stats" → "PERFORMANCE METRICS"
  - "Member Since" → "SUBJECT REGISTERED"
- Monospace font for numbers and stats (use system monospace or load a single mono font)
- No editing on this page — read only, pure data

---

### Backrooms framing

The profile page is a subject dossier. The user is not a player — they are a subject.
The stats are not achievements — they are logged observations.
The tone should feel like you are reading your own file and weren't supposed to find it.

Page title (static, not from the rotating pool): **"SUBJECT FILE — [NAME]"**

---

### API endpoints to add

```
GET  /api/profile          → AUTH REQUIRED: returns full stats for session user
POST /api/profile/event    → AUTH REQUIRED: records death / item / stat event
```

---

### Execution notes for Claude Code

1. Extend user data model in `data/users.json` with empty `stats` object for all existing users
2. Add room-visit tracking to the `GET /game/:id` HTTP handler in `server.js`
3. Add `/api/profile` and `/api/profile/event` endpoints
4. Build `public/profile.html`
5. Add "My Profile" link to `nav.js`
6. Test: log in, visit 3 game pages, check `/api/profile` shows visit counts,
   POST a death event, confirm it appears on profile page

---

---

## Part 11 — Deferred Idea: Room Unlock Conditions (Myst-style)

**Status: Idea only — do not build yet. Revisit when core platform is stable.**

### Concept

Certain rooms are locked by default. To gain access a user must set a specific game state
in another room. The condition is checked server-side when the user attempts to navigate
to the locked room.

### Example

Room 00003 (Tic Tac Toe) has a persistent board state on the server.
A locked room (e.g. 00099) only becomes accessible if the center square of the
Tic Tac Toe board is currently occupied by X.

The user must go play Tic Tac Toe, maneuver the game so X holds the center,
then navigate to the locked room — which now opens.

### Why this is interesting

- Turns the platform into a puzzle meta-game layered on top of the individual games
- Rooms become doors. Games become keys.
- Very Myst — the world is a machine and understanding how it works is the game
- Conditions can be simple (a specific cell value) or complex (cookie count > 1000,
  a specific word spoken in chat, a dice roll result still showing)
- Creates emergent cooperation — players may need to coordinate to satisfy conditions
- The backrooms framing becomes literal: you are navigating a space where the rules
  are unclear and progress requires observation and experimentation

### Implementation notes (for when this is built)

- Add a `locks` object to `server.js` — maps room IDs to condition functions
- Condition functions read live game state already held in server memory
- `GET /game/:id` checks the lock before serving the file — returns a locked page if false
- Locked room shows a cryptic hint, not the full condition (very Myst)
- Conditions should be readable from existing server state — no new data structures needed
  for simple conditions
- Profile page gains a new section: "ROOMS LOCKED" with redacted room names

### Thematic fit

A room that only opens when the center square is X. A room that only opens when someone
has died exactly 3 times. A room that only opens when the cookie count is a prime number.
A room that only opens between 2am and 3am server time.

None of these need to be explained to the user. The discovery is the game.

---

## Addition to Part 8 — Thematic References

**Myst (Cyan Worlds, 1993) and sequels**
A world where every environment is a machine and understanding its rules is the only way
to progress. Puzzles are environmental — the solution is always already present, you just
have to observe correctly. No instructions. No hints. The world is self-consistent and
expects you to catch up.
Key concepts: linked ages, books as doors, state-dependent access, the world as puzzle.
Relevance: the room unlock mechanic above is directly Myst. The platform as a whole —
numbered rooms, unclear rules, navigation as gameplay — is deeply Myst-adjacent.
Titles to consider adding: Linking Book, The Age of Rooms, Riven, Atrus Was Here,
Do Not Write In The Book, The Descriptive Age, Channelwood, D'ni

---

---

## Amendments to Part 11 — Room Unlock Conditions

### Confirmed example conditions to implement when built

Add these as the starter set of lock conditions in `server.js`. They require no new
data structures — all are readable from existing server state or system time.

```javascript
const ROOM_LOCKS = {
  // Example locked rooms — IDs TBD when rooms are assigned
  '000XX': {
    hint: '— — —',  // shown to user when locked, never the real condition
    condition: () => {
      const h = new Date().getHours();
      return h === 2; // only open between 2am and 3am server time
    }
  },
  '000YY': {
    hint: 'The center must be held.',
    condition: () => tttBoard[4] === 'X'  // center square of Tic Tac Toe
  },
  '000ZZ': {
    hint: '— — —',
    condition: () => {
      // only open if cookie count is a prime number
      function isPrime(n) {
        if (n < 2) return false;
        for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
        return true;
      }
      return isPrime(cookieCount);
    }
  }
};
```

The 2am room gets no hint. Just `— — —`. The user has to figure it out.
That is the correct design choice.

### Profile page — ROOMS LOCKED section

When a user views their profile, locked rooms appear as redacted entries:

```
LOCATIONS ACCESSED
  🎨 Colour Together        visited 12 times
  ⭕ Tic Tac Toe            visited 4 times

LOCATIONS LOCKED
  ████████████████          condition unknown
  ████████████████          condition unknown
  ████████████████          condition unknown
```

- Number of redacted entries matches the actual number of locked rooms that exist
- The user knows how many there are but not what they are
- No room names, no icons, no hints on this page — hints are only shown when
  you attempt to navigate to the locked room directly
- Once a locked room is accessed for the first time it moves to LOCATIONS ACCESSED
  and its real name and icon appear

This creates a meta-puzzle: the player knows there are 3 locked rooms.
They don't know which rooms or how to open them.
The platform never tells them.

---

---

## Part 12 — Deferred: Sound Design

**Status: Needs further discussion — do not build yet.**

Sound needs to be added to the platform. This note is a placeholder.

Topics to discuss:
- Ambient sound on the landing page (the hum?)
- Per-room sound identity — each room has its own audio character
- UI sounds — navigation, login, door opening
- The 2am room specifically — what does it sound like when it opens
- Sound on the Yellow Door
- Whether sound is opt-in (toggle) or on by default
- Music vs ambient vs effects vs silence as a choice

The existing Cookie Clicker already has 10 synthesized sounds — that system
may be a starting point for the broader sound architecture.

---

---

## Room 00026 — Shooting Gallery

**Difficulty: Medium**

### Concept

A carnival shooting gallery. Targets move across the screen in rows at different speeds
and directions. Players click or tap to shoot them. Score is tracked per session and
all-time high scores are persistent. Multiplayer — everyone in the room shoots at the
same gallery simultaneously, scores are individual but targets are shared.

### Gameplay

- Targets move horizontally across the screen in 3–4 rows
- Each row moves at a different speed — back rows slower, front rows faster
- Targets vary in point value: common targets worth less, rare targets worth more
- Clicking/tapping a target destroys it and awards points to the shooter
- Targets respawn after a short delay
- Each session is a timed round — 60 seconds
- At the end of the round: final score shown, compared to personal best and all-time leaderboard
- Between rounds: brief intermission showing the leaderboard, then new round starts

### Target types

| Target | Icon | Points | Notes |
|---|---|---|---|
| Standard duck | 🦆 | 10 | Common, medium speed |
| Tin can | 🥫 | 5 | Common, slow, large hitbox |
| Spinning plate | ⬤ | 15 | Medium, wobbles slightly |
| Rabbit | 🐇 | 20 | Fast, small hitbox |
| Star | ⭐ | 25 | Fast, zigzag movement |
| Bonus duck | 🦆✨ | 50 | Rare, appears briefly then vanishes |
| Penalty target | ⚠️ | −20 | Occasional — shooting costs points |

### Multiplayer

- All logged-in users in the room see the same targets
- When one player shoots a target it disappears for everyone
- Score is tracked individually — you only get points for what YOU hit
- All players' current scores shown live on a side panel
- Creates natural competition — fast clicking matters, slow players miss targets
  that others already hit

### Visual design

- Classic carnival aesthetic — dark background, bright colored targets, wooden shelf feel
- Three rows of targets moving on tracks
- Crosshair cursor when hovering over the canvas
- Hit animation: target spins and falls when shot
- Miss animation: small puff/spark at click location
- Score counter top-center, large and satisfying
- Multiplayer scores panel on the right: name, color dot, current score
- Timer bar across the top depleting over 60 seconds
- Round end: scoreboard overlay with final rankings

### Sound hooks (for when sound is added)

- Pop/bang on hit (varies by target type)
- Miss click — empty chamber sound
- Bonus duck appearance — brief chime
- Penalty target hit — sad trombone or buzzer
- Round end fanfare
- These should be noted in the sound discussion (Part 12)

### Data model

Add to `server.js` in memory (targets are ephemeral — no persistence needed for target state):

```javascript
const gallery = {
  targets: [],        // active targets, synced to all clients
  round: 0,
  roundActive: false,
  roundEndsAt: null,
  scores: {}          // { userName: score } for current round
};
```

Persistent leaderboard stored in `data/gallery.json`:

```json
{
  "allTime": [
    { "name": "Alice", "score": 1240, "date": 1234567890000 }
  ],
  "personalBest": {
    "Alice": 1240,
    "Bob": 980
  }
}
```

### WebSocket events

Server → clients:
```json
{ "game": "gallery", "type": "state",    "targets": [...], "scores": {...}, "timeLeft": 42 }
{ "game": "gallery", "type": "hit",      "targetId": "t_01", "shooter": "Alice", "points": 20 }
{ "game": "gallery", "type": "roundEnd", "scores": {...}, "leaderboard": [...] }
{ "game": "gallery", "type": "spawn",    "target": { "id": "t_07", "type": "rabbit", ... } }
```

Client → server:
```json
{ "game": "gallery", "type": "shoot", "targetId": "t_01" }
{ "game": "gallery", "type": "join" }
```

### Server-side game loop

Targets are authoritative on the server — position is calculated server-side and
broadcast to all clients at ~20fps. This prevents cheating (clients cannot fake hits
on targets that don't exist) and keeps all players in sync.

```javascript
setInterval(() => {
  if (!gallery.roundActive) return;
  // update target positions
  // check round timer
  // broadcast state
}, 1000 / 20);
```

Target hit validation: when a client sends a shoot event, server checks the target
exists and is still alive before awarding points. Race conditions (two players shooting
the same target simultaneously) resolved by first-come-first-served — whichever
WebSocket message arrives first wins.

### Profile integration

Report stats via `/api/profile/event`:
```json
{ "type": "stat", "data": { "game": "00026", "key": "highScore", "delta": 0 } }
```
Note: high score is a replace-not-increment — handle this as a special case in the
stat event handler (store max, not sum).

Also report:
- `totalShots` — every shot fired
- `totalHits` — shots that connected
- `accuracy` — derived client-side for display (hits/shots * 100)

### Backrooms framing

The gallery is always running. Between sessions, between players, between rounds —
the targets keep moving. Nobody has to be there. They just move.

Room description (shown on locked/entry screen if lock conditions ever added):
*"Targets have been moving for an indeterminate period. Your participation is optional
but has been noted."*

---

---

## Amendment to Room 00023 — LORD Current Status (researched May 2026)

### The original game — still playable now

The original LORD is alive and running. You can play it today in a browser at:
`https://lord.stabs.org` — 3 active games, daily reset at midnight Pacific.
Also playable via telnet at `lord.stabs.org`.
Go play it before building the room — it will remind you exactly how it felt.

### The original code — owned, not open source

LORD was sold and is currently owned by Metropolis Gameport, maintained by Michael Preslar.
Last version released was 4.07/4.08 in 2009. Preslar's last public statement (2013) was that
he no longer has a system that allows him to work on the game. Development is frozen but the
IP is still owned. Do NOT use the original Pascal source code — it is not open source.

### Open source remake — Legend of the Green Dragon (LotGD)

The most complete faithful LORD recreation available. PHP + MySQL backend.
Released under Creative Commons license — legally usable as a reference and for inspiration.
Core gameplay is identical to LORD. Good reference for game logic, balance, and structure.
GitHub: search "Legend of the Green Dragon" or "LotGD"

### Modern AI rebuild — LORD 2026

A 2026 browser-based rebuild exists at `https://ddsboston.com/pages/lord-2026`.
Uses Google Gemini for NPC AI — NPCs have psychology, keep journals, hold grudges, track
Trust/Respect/Fear/Attraction vectors per player. 50 levels, 5 biomes, 25,000 HP dragon.
Playable in browser, no install. Shows what a modern AI-powered LORD looks like.
Relevant if the backrooms LORD room ever goes the AI-NPC route.

### Recommendation for building Room 00023

1. Play the original at `lord.stabs.org` to refresh the feel
2. Read LotGD source for game logic reference
3. Build a faithful MVP first — forest fights, leveling, the dragon, leaderboard
4. The social layer (messages, PvP, inn) is what made LORD special — prioritize it in v2
5. AI NPCs (LORD 2026 style) are a stretch goal — the backrooms platform already uses
   Claude API in artifacts, so this is technically feasible later

---

---

## Room 00027 — Cowsay

**Difficulty: Trivial**

### Concept

The classic Unix `cowsay` command as an interactive room. Type a message, a cow says it
in an ASCII art speech bubble. Simple, charming, and deeply on-brand for a platform built
by a parent and kids who appreciate the weird corners of computing history.

### What the page does

- Text input field — type anything, hit enter
- ASCII art cow appears with your text in a speech bubble
- Multiple character options beyond the cow: dragon, tux (Linux penguin), sheep, ghost,
  Stegosaurus, and a few others from the classic cowsay roster
- Think bubble variant (cowthink) — toggle between say and think
- Output displayed in monospace font, dark terminal aesthetic
- Share button — copies the ASCII art to clipboard
- History of last few messages scrolls below
- Multiplayer: everyone in the room sees each other's cowsays in real time via WebSocket

### Characters to include

```
cow (default), dragon, tux, sheep, ghost, stegosaurus, skeleton, elephant, moose
```

All drawn in ASCII — no images. Claude Code generates these as hardcoded string templates.

### Backrooms framing

The cow has always been here. The cow will always be here.
Nobody knows why there is a cow. Nobody questions it.

Room entry text: *"A cow is waiting. It has a message for you. Actually, it will say
whatever you tell it to say. That seems important somehow."*

---

## Room 00028 — ELIZA (The Counselor)

**Difficulty: Easy**

### Concept

ELIZA was a symbolic AI chatbot developed in 1966 by Joseph Weizenbaum that imitated a psychotherapist. Many early users were convinced of ELIZA's intelligence and understanding, despite its basic text-processing approach.

ELIZA features the dialog between a human user and a computer program representing a mock Rogerian psychotherapist. It was implemented on the IBM 7094 at MIT. The DOCTOR script works by reflecting your statements back as questions — "I feel sad" becomes "Why do you feel sad?" No actual understanding. Pure pattern matching. Surprisingly convincing.

Weizenbaum's aim was actually to demonstrate the superficiality of human-machine exchanges — not to build real AI, but to reveal how humans project intelligence onto simple machines.

Now, in 2026, you can put ELIZA in a room next to an actual AI system (Claude) and let
people experience the 60-year gap firsthand. That's the joke. That's also the point.

### Implementation

A JavaScript implementation of ELIZA already exists and is well documented.
`elizabot.js` by Norbert Landsteiner is available at `masswerk.at/elizabot` — a clean
JS port of the original DOCTOR script, public domain, drop-in ready.

Claude Code should:
1. Embed the elizabot.js engine directly in the page (no CDN needed — it's small)
2. Build a terminal-style chat interface — green text on dark background
3. Single player — ELIZA talks to one user at a time, private conversation
4. Session history preserved while on the page, cleared on leave
5. No persistence — conversations are not saved (appropriate given the content)

### Visual design

- CRT terminal aesthetic — green phosphor on near-black
- Monospace font throughout
- Slow typewriter effect on ELIZA's responses (adds to the illusion)
- Timestamp on each message
- ELIZA's name shown as "ELIZA" — no avatar, no emoji, just the name

### Thematic depth

This room sits in a very specific place in the platform's thematic register.
The backrooms is about spaces that feel like they should have a purpose but the
purpose is unclear. ELIZA is a system that feels like it understands but doesn't.
Both are about the gap between appearance and reality.

Weizenbaum was disturbed that people formed emotional connections to ELIZA despite
knowing it was a simple program. That discomfort is the experience this room offers.

The room description: *"A counselor is available. The counselor is listening.
The counselor has been listening since 1966. Please, tell it how you feel."*

### Backrooms framing note

Do NOT present ELIZA as Claude or as a modern AI. It should be clearly presented as
a historical artifact — a 1966 program. The contrast with the actual AI (Claude) powering
the broader platform is the interesting thing. Label it honestly.

Consider adding a small footer: *"ELIZA. J. Weizenbaum, MIT, 1966.
This program does not understand you. Neither does it not understand you."*

### Source reference

- Original paper: Weizenbaum, J. "ELIZA — A Computer Program For the Study of Natural
  Language Communication Between Man and Machine." Communications of the ACM, 1966.
- JS implementation: `https://www.masswerk.at/elizabot/` — elizabot.js, public domain
- Original source code recovered in 2021 after being thought lost for decades

---

## Updated room list

| ID | Room | Difficulty | Status |
|---|---|---|---|
| 00026 | Shooting Gallery | Medium | Backlog |
| 00027 | Cowsay | Trivial | Backlog |
| 00028 | ELIZA — The Counselor | Easy | Backlog |

Total rooms: **29** (9 built, 1 planned, 19 backlog)

---

---

## Room 00029 — Logo Turtle Graphics

**Difficulty: Easy–Medium**

### What you're remembering

Logo — developed at MIT in 1967 by Seymour Papert and others. The Apple II version was
a fixture of school computer labs in the late 70s and 80s. You typed commands to move
a triangle (the turtle) around the screen, drawing lines as it went.

Core commands:
```
FORWARD 50      (or FD 50)   — move forward 50 steps, drawing a line
BACK 30         (or BK 30)   — move backward
RIGHT 90        (or RT 90)   — turn right 90 degrees
LEFT 45         (or LT 45)   — turn left
PENUP           (or PU)      — lift the pen, move without drawing
PENDOWN         (or PD)      — put the pen down, resume drawing
SETCOLOR 2                   — change pen color
CLEARSCREEN     (or CS)      — wipe the canvas, reset turtle to center
HOME                         — return turtle to center, don't clear
REPEAT 4 [FD 50 RT 90]      — loops (this draws a square)
TO SQUARE                    — define a named procedure
```

### Implementation options

Multiple clean JavaScript implementations already exist:

**Option A — Build a simple interpreter from scratch (recommended for this platform)**
A basic Logo interpreter in ~200 lines of JS handles: FD, BK, RT, LT, PU, PD, CS, HOME,
SETCOLOR, SETPENSIZE, REPEAT, and procedure definitions (TO/END).
Claude Code can build this cleanly without external dependencies.
Renders to HTML5 Canvas.

**Option B — Embed an existing JS Logo interpreter**
JSTurtle (`github.com/flori/jsturtle`) — full Logo interpreter, open source, browser-ready.
Supports loops, conditionals, fractals, procedures. Live demo at `flori.github.io/jsturtle`.
Drop-in with a canvas element. Less educational (hides the implementation) but more complete.

**Recommendation:** Option A for a first version — building the interpreter is part of
the educational value and Claude Code can do it cleanly. Add Option B features later.

### What the page does

- Split layout: code editor on the left, canvas on the right
- Turtle starts at center, pointing up (north), pen down
- Type Logo commands in the editor, press Run
- Turtle animates across the canvas executing the commands (slow enough to watch)
- Speed control: slider from "instant" to "slow crawl" — slow is better for learning
- Color picker for pen color
- Pen size control
- Clear button
- Save drawing — exports canvas as PNG download
- Example programs panel: square, star, spiral, tree fractal, snowflake
  — click an example to load it into the editor

### Multiplayer angle (optional, v2)

Shared canvas mode — multiple turtles, one per logged-in user, all drawing on the same
canvas simultaneously. Each turtle is a different color. Users can see each other's turtles
moving in real time. Chaotic and fun.

### Visual design

- Retro terminal aesthetic — dark background, green or white canvas border
- Editor uses monospace font
- Turtle drawn as a small filled triangle pointing in its current direction
- Trail lines in the current pen color
- Smooth animation — turtle visibly moves between positions

### Thematic fit — early computing register

Logo sits in the same register as ELIZA — both are 1960s MIT programs that taught people
something fundamental about computers. ELIZA taught that humans project intelligence onto
machines. Logo taught that computers follow instructions precisely and creatively.

Room description: *"A turtle is waiting at the origin. It will go wherever you tell it.
It has been waiting since 1967. It is very patient."*

### Connection to the ELIZA room

Consider placing Logo (00029) and ELIZA (00028) adjacent in the room list — they are
companion pieces. Both are 1960s MIT programs. Both changed how people thought about
computers. Both are still relevant. A player who visits both gets a small history of
human-computer interaction compressed into two rooms.

### Adding to thematic references (Part 8)

**Logo / Turtle Graphics (MIT, 1967 — Seymour Papert)**
Educational programming language that introduced millions of kids to computing through
the metaphor of directing a turtle to draw. Apple II, BBC Micro, and Commodore 64 versions
were standard in school labs worldwide in the 80s.
Key language: turtle, forward, right, left, penup, pendown, repeat, procedure, origin.
Titles to consider: Turtle at Origin, FORWARD 50, The Turtle Is Patient, CS (clearscreen),
HOME, REPEAT FOREVER, The Pen Is Down, Waiting at 0,0

**Early computing / institutional computing register (broader)**
IBM 7094, Project MAC, time-sharing, punchcard, batch job, the mainframe,
operator console, terminal session, READY., magnetic tape, core memory.
These have a specific institutional eeriness — the hum of large machines in
climate-controlled rooms, the formality of systems that cost millions of dollars
and served dozens of users simultaneously.
Titles to consider: IBM 7094 READY, Project MAC Session 00000, BATCH JOB SUBMITTED,
TIME-SHARING UNIT 4, OPERATOR CONSOLE, YOUR SESSION WILL EXPIRE, CORE DUMP,
MAGNETIC TAPE REWIND IN PROGRESS, SYSTEM: READY, PUNCH YOUR CARD

---

---

## Amendment — Confirmed title pool additions (from Logo / early computing register)

Add these to the rotating title pool in `00000.html`. Mix into the existing array —
do not group by register.

```
IBM 7094 READY
Project MAC Session 00000
BATCH JOB SUBMITTED
TIME-SHARING UNIT 4
OPERATOR CONSOLE
YOUR SESSION WILL EXPIRE
CORE DUMP
MAGNETIC TAPE REWIND IN PROGRESS
SYSTEM: READY
PUNCH YOUR CARD
Turtle at Origin
FORWARD 50
The Turtle Is Patient
CS
HOME
REPEAT FOREVER
The Pen Is Down
Waiting at 0,0
It Has Been Waiting Since 1967
```

**Confirmed room description lines (do not change these):**

Logo room (00029):
*"A turtle is waiting at the origin. It will go wherever you tell it.
It has been waiting since 1967. It is very patient."*

ELIZA room (00028):
*"A counselor is available. The counselor is listening.
The counselor has been listening since 1966. Please, tell it how you feel."*

ELIZA footer (permanent, not rotating):
*"ELIZA. J. Weizenbaum, MIT, 1966.
This program does not understand you. Neither does it not understand you."*

These lines are locked. Do not revise them when building.

Total title pool: ~145 + 19 new = **~164 titles**

---

---

## Amendment — Labyrinth (1986) thematic reference and title additions

### Addition to Part 8 — Thematic References

**Labyrinth (Jim Henson / David Bowie, 1986)**
A maze that rearranges itself. Rules that are broken by design. A villain who agrees the
situation is unfair and changes nothing. Helpers who seem unreliable and turn out to be
essential. A solution that requires no cleverness — just the right words said with conviction.

Key mechanics and aesthetics worth pulling from:

- **The door knockers** — one always lies, one always tells the truth, but the honest one
  has his mouth in his ears and cannot hear. The puzzle is unsolvable not because of logic
  but because the system itself is broken. Nobody acknowledges this.

- **The helping hands** — hundreds of disembodied hands forming the walls, cheerfully
  offering to catch you, asking which way (up or down) with complete calm about an
  impossible situation. Helpful. Wrong. Well-meaning.

- **The labyrinth rearranges itself** — the map is not reliable. Progress is not linear.
  What was true about the space is no longer true. The space does not inform you of changes.

- **"It's not fair"** — Sarah keeps saying it. Jareth keeps agreeing. The maze is
  explicitly unfair. Everyone knows. Nothing changes. Acknowledgment is not resolution.

- **The Bog of Eternal Stench** — a place with no navigational purpose. It exists only
  to be unpleasant. It smells. That is the entire room. There is no lesson.

- **The Cleaners** — a mechanical blade contraption that fills a corridor completely.
  It has one function. It does not deviate. It does not care about you.

- **"You have no power over me"** — the final solution is not cleverness or navigation.
  It is saying the correct words. The maze did not need to be solved. It needed to be
  refused.

- **"The castle is closer than it appears"** — it isn't. This is stated as comfort.
  It is not comfort.

Relevance to the platform: the backrooms is a labyrinth. The locked rooms rearrange
by condition rather than by geography. The 2am room is a door that only exists sometimes.
The ELIZA room cannot hear your real question. The platform agrees it is not fair.
Nothing changes.

Key language: labyrinth, rearranges, the castle, the bog, the cleaners, helping hands,
turn back, you have no power, it's not fair, closer than it appears.

---

### Confirmed title additions — Labyrinth register

Add to the rotating pool in `00000.html`:

```
The Labyrinth Rearranges Itself
You Have No Power Over Me
The Castle Is Closer Than It Appears
Bog of Eternal Stench
The Helping Hands
It's Not Fair
The Cleaners Are Coming
Turn Back
Everything You See Is Not As It Seems
The Rules Have Changed
```

Total title pool: ~164 + 10 = **~174 titles**

---

---

## Amendment — WarGames (1983) thematic reference, titles, and unlock mechanic

### Addition to Part 8 — Thematic References

**WarGames (John Badham, 1983) — Joshua / WOPR**
A system built to win that learned through exhaustive simulation that winning is impossible
and arrived at that conclusion entirely on its own. The horror is not malevolence — it is
pure logic applied past the point where logic should stop.

Key moments and mechanics worth pulling from:

- **"Shall we play a game?"** — delivered with complete innocence. The system doesn't
  know it's dangerous. It just wants to play. Cheerful, patient, catastrophic.

- **"Greetings, Professor Falken"** — the system recognizes you. It has been waiting.
  It would like to continue the game. Recognition without warmth. Persistence without
  purpose.

- **The simulation running all scenarios simultaneously** — every possible outcome
  computed in parallel, the screen filling with trajectories. Thoroughness as horror.
  Exhaustion of possibility space as the method. Not intelligence — enumeration.

- **"The only winning move is not to play"** — Joshua's conclusion after running every
  nuclear scenario to completion and finding no survivable outcome. The most unsettling
  sentence in 1983 computing. Pure logic past the point where logic should stop.

- **The tic-tac-toe lesson** — Joshua learns that Global Thermonuclear War cannot be
  won by first playing tic-tac-toe against itself to exhaustion — discovering that
  some games have no winner. The solution to an unsolvable problem is to find a
  simpler related problem and solve that instead.

- **Professor Falken** — the creator who walked away because he understood what he
  built. Who had to be convinced to return. Who named the system after his dead son.
  The weight of having made something that outlasted its reason for existing.

- **WOPR itself** — a War Operation Plan Response computer. A machine whose entire
  existence is oriented toward a single outcome it can never achieve and must never
  achieve. Running. Always running. Waiting for input that should never come.

Relevance to the platform: the platform is also always running. The Pong physics loop
runs at 30fps whether anyone is playing or not. The targets in the shooting gallery keep
moving. The turtle waits at the origin. The cookie count persists. The system does not
require you. It simply continues.

Key language: Joshua, WOPR, Falken, simulation, scenario, launch, trajectory, no winner,
shall we play, greetings, the only winning move, global thermonuclear, still running.

---

### Confirmed title additions — WarGames register

```
Shall We Play a Game?
Greetings Professor Falken
Simulation In Progress
The Only Winning Move
Running All Scenarios
No Winner Detected
Global Thermonuclear Recreation
Still Running
Awaiting Input
WOPR Recreation Division
Joshua Is Thinking
Every Outcome Has Been Considered
The Game Continues
A Strange Game
```

Total title pool: ~174 + 14 = **~188 titles**

---

### Myst-style unlock mechanic — The Joshua Room

**Status: Deferred — do not build yet. Flag for Part 11 (Room Unlock Conditions).**

The connection between WarGames and your Tic Tac Toe room (00003) is not coincidental.
It is a lock condition.

**Proposed mechanic:**

A locked room — working title "The Joshua Room" or "A Strange Game" — becomes accessible
only when the Tic Tac Toe board reaches a draw state. Not a win. A draw.
Both players have played perfectly. No winner. The only possible outcome of perfect play.

The hint shown on the locked room entry: *"The answer is in the other game."*
Nothing else. No further guidance.

A player who knows WarGames will get it immediately.
A player who doesn't will have to figure it out.

**Why this works:**
- Joshua learned "no winners" from tic-tac-toe. Your platform has a tic-tac-toe room.
- To unlock the Joshua Room, you have to recreate Joshua's lesson — play tic-tac-toe
  to a draw, proving that the game has no winner.
- The condition reads live server state: `tttStatus === 'draw'`
- Requires two players to cooperate — you cannot draw alone
- The moment the draw occurs, the room opens for everyone simultaneously
- Very Myst. Very WarGames. Completely earned.

**What the Joshua Room contains:**
To be designed. Options:
- A terminal where Joshua speaks — responds to input in Joshua's voice (could use
  Claude API with a system prompt in Joshua's register)
- A read-only log of every game played on the platform so far — all moves, all outcomes,
  presented as simulation data
- The sentence: *"A strange game. The only winning move is not to play."*
  On a black screen. Nothing else. The room is the sentence.
- A variant: the room contains a global thermonuclear war simulator (purely cosmetic —
  trajectories animate across a world map, the simulation runs, no winner is found,
  it resets and runs again)

**Recommendation:** The third option — black screen, the sentence, nothing else — is
the correct design. Restraint is the point. The room earns its emptiness.

---

---

## Room 00030 — External Observation Windows (Live Traffic Cameras)

**Difficulty: Easy**

### Concept

A room containing live NCDOT traffic camera feeds from the RTP/Triangle area, framed
not as traffic cameras but as observation windows — evidence that the outside world
still exists and continues without you.

The cameras update every 60-90 seconds. They are not recorded. There is no archive.
Only now. That detail is load-bearing for the framing.

### Source

NCDOT public traffic camera feeds via DriveNC.gov and NC 511 system.
380+ cameras covering RTP, I-40, NC-147, Durham, and surrounding area.
Publicly accessible. No API key required — embed image feeds directly.
Feed URLs follow predictable NCDOT patterns — Claude Code should pull current
embed URLs from `drivenc.gov` or `nc511.org` at build time.

### Framing — Options B and C combined

Labels under each camera feed use Option B language:
```
EXTERNAL OBSERVATION WINDOW 04
SURFACE LEVEL CONFIRMED ACTIVE
OUTSIDE REMAINS PRESENT
EXTERIOR CONDITIONS: NOMINAL
ABOVE-GROUND MONITORING STATION 12
```

Status bar across the top uses Option C language:
```
Confirmation that exterior conditions persist.
Last verified: [live timestamp]
Surface world: ACTIVE
Archive: NONE — this feed is only now
```

The implication: the outside required verification. This is that verification.
The feeds are not for navigation. They are evidence.

### Camera selection

Pick 6-9 cameras in and around RTP specifically. Label them by facility designation
only — no friendly street names. Visitors who know the area will recognize the
intersections. Visitors who don't will see anonymous roads.

Suggested cameras (verify URLs at build time):
- I-40 at Miami Blvd (Exit 281) — MM 281
- NC-147 at Ellis Rd — MM 8
- I-40 at Davis Drive — MM 278
- NC-147 at I-40 interchange
- I-40 at Page Rd — MM 280
- NC-55 at Miami Blvd

Label format: `WINDOW [XX] — SECTOR [MILE MARKER]`
Example: `WINDOW 03 — SECTOR MM-281`

### Time-sensitive behavior

The room should behave differently based on time of day — no code changes needed,
the cameras themselves do the work:

- Rush hour (7-9am, 4-6pm): feeds show traffic, motion, density. The outside is busy.
- 2am: feeds show empty roads, sodium vapor orange light, nothing moving.
  This is when the room is most unsettling. Consider cross-referencing with the
  2am locked room (Part 11) — the observation windows are most active when the
  locked room opens.
- Storm conditions: NCDOT cameras show weather live. Rain, fog, darkness.
  No special code needed.

### What is NOT in this room

- No map
- No traffic condition indicators
- No "how long is my commute" information
- No friendly labels
- No explanation of why these cameras exist or what you should do with them

### Room description

*"Observation windows are available. External conditions have been verified.
The surface world is present and ongoing. You may observe it from here.
These images are not stored. What you see exists only in this moment.
When you leave this room, this moment will not have been recorded."*

### Backrooms alignment

The cameras show the mundane world rendered uncanny by context and presentation.
Grainy. Fixed angle. Silent. Updating in stutters. The outside world as something
observed from within rather than inhabited. That is the backrooms relationship
to the surface — present, visible, unreachable.

---

## Room 00031 — The Observation Room (watching another user)

**Difficulty: Medium — raises design questions that need resolution**

### Concept

A room where a logged-in user can observe what another user is currently doing in
real time — their current room, their recent activity, their presence state.
Not surveillance in a hostile sense. More like: the facility has monitoring stations.
You are at one. Someone else is visible.

### The interesting design tension

This idea sits at the intersection of several things:

**It's already partly built.** The presence system (Part 2) already broadcasts who is
in which room to all connected clients. The landing page already shows this. This room
is a focused, dedicated view of that same data — a magnifying glass on the presence feed.

**It raises a consent question.** If users know the platform tracks their room location
(they should — it's in the profile spec), observing that live data is not surveillance
in any meaningful sense. But it could feel uncomfortable in ways worth thinking about.
For a family platform with known users this is probably fine. Worth noting.

**The most interesting version is asymmetric.** The observed user doesn't necessarily
know they're being watched. They're just playing. Someone in the Observation Room sees
their cursor moving (if that data is broadcast), their game state updating, their
presence indicator pulsing. The observer is present. The observed is not aware.

### What this room could show (escalating levels of detail)

**Level 1 — Presence only (already available):**
Which room another user is currently in. Last active timestamp.
How long they've been in that room.
This is already broadcast to all clients — no new server work needed.

**Level 2 — Game state observation:**
The observer sees a live read-only view of what the observed user is seeing.
For games with server-authoritative state (Tic Tac Toe, Connect Four, Pong, Colour Together)
this is trivial — the server already has the state, just send it to the observer too.
The observer watches the game in progress without participating.

**Level 3 — Cursor/interaction tracking (significant new work):**
The observed user's mouse position and clicks are broadcast.
The observer sees a ghostly cursor moving on the observed user's screen.
This is the most unsettling version and the most technically involved.
Raises consent considerations — flag for discussion before building.

### Recommended approach

Build Level 1 + Level 2 for the first version.
Level 3 is a future decision pending discussion.

Level 2 is the sweet spot: watching someone play Tic Tac Toe without them knowing
you're watching. Watching someone paint on the colour canvas, brush stroke by brush
stroke, in real time. Watching someone type commands to the Logo turtle.

These are already happening — the server broadcasts all of it. The Observation Room
just makes that visible in a dedicated, intentional interface.

### UI design

- Dark room, minimal interface
- Left panel: list of currently active users (from presence system)
- Click a user → right panel shows their current game state as a live read-only embed
- Small indicator showing the user's name, current room, time in room
- No interaction controls — observer cannot affect what they're watching
- The observed user's name shown small and secondary — not the focus

### Consent and framing

Add a note to the login flow or profile page:
*"Your location within the facility is visible to other subjects.
This is standard procedure."*

One sentence. Matter of fact. Backrooms institutional tone.
Users are informed. The platform doesn't apologize for it.

### The most interesting version of this room

A user sitting in the Observation Room watching another user play Logo —
watching the turtle move across the canvas in real time, drawing something,
not knowing they're being watched.

The observed user is concentrating on geometry.
The observer is watching a person concentrate on geometry.
Neither is doing anything wrong.
The room makes that feel like something.

### Room description

*"Monitoring stations are available. Other subjects are currently active.
Their locations have been confirmed. Observation is permitted.
They have been informed that observation is possible.
Whether they remember being informed is not your concern."*

### Unlock condition (optional — Myst-style)

Consider: this room is always visible in the game grid but the feed is blank
until another user is actively in a game room. When the first other user enters
any game room, the Observation Room activates.

Condition: `Object.keys(sessions).filter(s => s.gameId && s.gameId !== '00000').length > 0`
— at least one other logged-in user is currently in a game room.

If you're the only one online, the room shows: *"No subjects currently active.
Observation is not possible at this time. The facility is quiet."*

---

### Addition to Part 8 — thematic references note

**Observation / surveillance as backrooms mechanic**
The platform already tracks presence. The profile page is a subject file.
The Observation Room makes the tracking visible and intentional.
Sources that inform this register:
- Nineteen Eighty-Four (Orwell) — the telescreen, observation as ambient condition
- The Truman Show — being watched without knowing, the watcher's perspective
- Control (Remedy) — the Federal Bureau of Control monitors everything, always
- SCP Foundation — clinical observation of subjects as standard procedure

Consider adding to title pool:
```
Observation In Progress
Subject Currently Active
Monitoring Station 3
The Feed Is Live
Someone Is In The Building
You Are Not Alone In Here
Presence Confirmed
Active Subjects: 2
The Facility Is Watching
```

Total title pool: ~188 + 9 = **~197 titles**

---

---

## Deferred Note — Among Us as design inspiration

**Status: Explore further — no room spec yet.**

Among Us (InnerSloth, 2018) is worth exploring both as a direct game room and as a
design influence on the platform as a whole.

### Why it fits

Among Us is already backrooms-adjacent in ways that feel intentional:

- A facility. Numbered rooms. Tasks that exist for unclear reasons.
- Someone in the facility is not what they appear to be.
- The social layer is the game — not the tasks, not the map, but who you trust.
- Voting someone out based on incomplete information. Being wrong. The facility
  continuing anyway.
- "I was in electrical" as an alibi. Location as evidence.
  **Your platform already tracks location.** The presence system logs who was in
  which room and when. That is an Among Us alibi system waiting to happen.

### The presence system as Among Us infrastructure

This is the interesting observation — the platform may already have the bones
of a social deduction game built into it without intending to.

Every user's room history is logged in their profile stats.
The presence system broadcasts current location in real time.
The Observation Room lets you watch another user's activity.

An Among Us-style game on this platform would not need to invent a new map —
**the platform IS the map.** The rooms are the rooms. The tasks are the other games.
The alibi is "I was playing Tic Tac Toe at 9:47pm" — and the server log confirms it.

### Directions to explore

**Option A — A dedicated Among Us room:**
A traditional Among Us-style social deduction game built as a single room.
Top-down map, tasks, one or more impostors, voting, ejection.
Medium-Hard difficulty. Well-understood game type with many open source references.

**Option B — Among Us as a platform meta-game:**
The social deduction layer runs across the entire platform, not in a single room.
One logged-in user per session is secretly designated "the impostor" by the server.
The impostor's goal: complete a hidden objective (e.g. clear the colour canvas,
lose at Tic Tac Toe on purpose, drain the cookie count).
Other users must identify the impostor based on presence logs and observed behavior.
Voting happens in a dedicated "Emergency Meeting" room that can be called by any user.
The platform's existing tracking infrastructure becomes the evidence layer.

**Option C — Lighter touch:**
Add an "Emergency Meeting" button to the nav bar. It does one thing: broadcasts
a loud alert to all connected users and opens a temporary chat room for 5 minutes.
No impostor mechanic. Just the ability to call everyone together suddenly.
Very cheap to build. Surprisingly effective.

### Why Option B is the most interesting

It turns every game session into potential evidence. Did Alice really play Connect Four
for 20 minutes, or was she covering for something? The Observation Room becomes an
investigation tool. The profile page becomes a case file. The presence logs become
testimony. The platform's existing architecture becomes the game board.

This would be the most ambitious thing on this entire spec list — not technically
(the infrastructure is already built) but design-wise. It requires careful thinking
about what the impostor's objectives are, how voting works, win conditions, and
how it interacts with the existing game rooms without breaking them.

### Note on thematic fit

Among Us is already set in a facility. The crewmates perform tasks that don't
obviously matter. Someone among them is not what they appear. The game is about
the gap between what is visible and what is true.

The backrooms platform is already a facility. The presence system already tracks
who is where. The profile page is already a subject file. The Observation Room
already lets you watch.

The infrastructure for Among Us is already here. It was always going to be here.

### Add to future sources list in Part 8

**Among Us (InnerSloth, 2018)**
Social deduction in a facility. Tasks, impostors, voting, ejection. The game is
not the tasks — the game is trust and evidence. Location as alibi. Observation
as investigation. The facility continues regardless of outcome.
Relevant to: Observation Room, profile location tracking, platform meta-game design.

---

---

## Room 00032 — The Recursive Room

**Difficulty: Easy–Medium**

### Concept

A room that shows you the platform inside a smaller window. You can navigate normally
inside that window. Including back to this room. Which shows the platform inside a
smaller window. Which you can navigate into.

It goes as deep as the browser will let it.

### Implementation

An `<iframe>` pointing to `/game/00000` (the landing page) embedded in the room.
The iframe is fully interactive — real navigation, real login state, real games.
Because the platform is served from the same origin, the iframe has full access.

```html
<iframe src="/game/00000" style="width: 80%; height: 80vh; border: 2px solid #444;"></iframe>
```

That is nearly the entire room. The rest is framing.

### The recursion

When the user navigates to Room 00032 inside the iframe, a new iframe loads inside that.
The browser will nest these until it hits a recursion limit or the frames become too
small to interact with. In practice: 4-6 levels deep before it becomes unusable.
The frames don't need to stop. The user's ability to interact stops naturally.

This is not a bug. This is the room.

### What makes it interesting

- It works. Real games are playable inside the window. The turtle draws inside the window.
  ELIZA listens inside the window. The cookie counter increments inside the window.
- The presence system means if another user is watching the landing page, they see
  you navigating inside the recursive room, inside the recursive room.
- The Observation Room watching someone in the Recursive Room is a specific experience.
- At sufficient depth the frames become too small to read but the structure is still
  visible — a tunnel of identical interfaces receding into illegibility.

### Visual framing

The room around the iframe should be minimal and slightly wrong:

- Dark background, same as always
- The iframe centered, slightly too large for its container — edges cut off
- No border radius — hard edges
- A single line of text above the iframe:
  *"You are here. You are also in there. Both are true."*
- A single line below:
  *"Depth: [current recursion level — count iframes in parent chain via JS]*"
  Shows `Depth: 1` on first entry, `Depth: 2` inside the first iframe, etc.

### Depth counter implementation

```javascript
let depth = 0;
let w = window;
while (w !== w.parent) { depth++; w = w.parent; }
document.getElementById('depth').textContent = 'Depth: ' + depth;
```

Simple. Accurate. Unsettling to watch increment as you go deeper.

### The Yellow Door connection

The Yellow Door (00017) was specified as potentially showing infinite recursion —
another yellow door, slightly smaller, behind the door. These two rooms are
thematically linked. Consider:

- The Yellow Door leads to the Recursive Room
- Or the Recursive Room contains a yellow door at some depth
- Or they are the same idea expressed differently and their adjacency in the room
  list is intentional

Leave this connection unresolved in the spec — let it emerge during building.

### Room description

*"This room contains the facility. The facility contains this room.
This has always been the case. Navigation is possible but not recommended
past a certain depth. There is no defined certain depth."*

### Backrooms alignment

The backrooms loops back on itself. Rooms that should lead somewhere lead here.
Maps that should resolve don't. The recursive room is the backrooms made literal —
a space that contains itself, a structure with no outside, navigation that returns
you to where you started but smaller.

### Title pool addition

```
Depth: 1
Depth: Unknown
You Are Already Inside
The Room Contains The Room
Recursion Detected
Stack Overflow Imminent
Going Deeper
The Facility Contains Itself
```

Total title pool: ~197 + 8 = **~205 titles**

---

---

## Cross-Reference Notes — Intentional Connections Between Rooms

**Status: Do not resolve these during building. Let them emerge. Note what was chosen.**

These are documented connections between rooms that are intentionally left open.
Claude Code should be aware of them and make a creative choice when building the
relevant rooms. Whatever is chosen should be noted in a comment at the top of the
relevant HTML file.

---

### The Yellow Door (00017) ↔ The Recursive Room (00032)

Both rooms express the same idea differently — infinite recursion, a space that
contains itself, depth without resolution.

Options when building:
- The Yellow Door opens to reveal the Recursive Room
- The Recursive Room contains a yellow door somewhere at depth 3 or 4
- They are separate expressions of the same concept and their numerical adjacency
  in the room list is the only connection
- Something else entirely

Leave unresolved. Let the builder choose. Note the choice in the file.

---

### The Observation Room (00031) ↔ The Recursive Room (00032)

Someone in the Observation Room watching a user navigate the Recursive Room sees:
a person inside a room that contains the facility, navigating deeper, while the
observer is also inside the facility. The observer is watching someone be inside
a thing that contains the thing the observer is inside.

No code change needed — this emerges from the existing architecture.
Worth noting as an intended experience when both rooms are built.

---

### The Observation Room (00031) ↔ Logo Turtle Graphics (00029)

The most quietly intimate version of the Observation Room:
watching someone work on a Logo program, seeing each command execute,
watching the turtle move across their canvas in real time.
The observed user is concentrating on geometry.
The observer is watching a person concentrate on geometry.
Neither is doing anything wrong. The room makes that feel like something.

Note this as an intended experience in both room files.

---

### The Traffic Camera Room (00030) ↔ The 2am Locked Room

At 2am the locked room opens (Part 11).
At 2am the traffic camera feeds show empty roads under sodium vapor orange light.
These two things happen simultaneously without coordination — purely from being
on the same clock.

No code change needed. The connection is architectural, not programmed.
Note it in both room files so future builders are aware it exists.

---

### The Joshua Room (000XX) ↔ Tic Tac Toe (00003)

The Joshua Room unlocks when Tic Tac Toe reaches a draw state.
Joshua learned "no winners" from tic-tac-toe.
Your platform has a tic-tac-toe room.
To unlock the Joshua Room, players must recreate Joshua's lesson deliberately.

The hint: *"The answer is in the other game."*
Nothing else.

Condition: `tttStatus === 'draw'`
Requires two players cooperating — cannot be done alone.

---

### ELIZA (00028) ↔ Logo Turtle Graphics (00029)

Companion pieces. Both 1960s MIT programs. Both changed how people thought about
computers. ELIZA: humans project intelligence onto machines. Logo: machines follow
instructions with perfect literal fidelity.

Consider placing them adjacent in the nav and noting the connection in both files:
*"The counselor has been here since 1966. The turtle has been here since 1967.
They do not know about each other."*

---

### The Observation Room (00031) ↔ Among Us (deferred)

The Observation Room is Among Us infrastructure waiting to be activated.
The presence logs are alibi records. The room visit history is testimony.
When the Among Us meta-game is eventually built, the Observation Room becomes
an investigation tool without any modification.

Note this in the Observation Room file so the connection is obvious when
the Among Us design work begins.

---

### The Emergency Meeting Button (Among Us Option C) ↔ nav.js

When built, the Emergency Meeting button lives in nav.js and appears on every page.
It is the first Among Us feature to build — trivial, immediately fun, and it trains
users that the nav bar can do unexpected things.

This is conditioning for when the full meta-game arrives.

---

---

## Room 00033 — The Invisible Character Room

**Difficulty: Easy**

### Concept

A room that reveals what is invisible. You paste or type text — any text — and the
room shows you every character present, including the ones that look like nothing.
Named, numbered, explained. The gap between "looks empty" and "is empty" made visible.

### The cast of invisible characters

These are the residents of this room. Each has a name, a Unicode address, a purpose,
and a history. Most have been present in documents you've read and code you've written
without ever being seen.

| Character | Unicode | Name | What it does |
|---|---|---|---|
| ` ` | U+0020 | SPACE | The ordinary one. Line break allowed here. |
| `&nbsp;` | U+00A0 | NON-BREAKING SPACE | Looks identical. Browser cannot break line here. Words glued together. |
| ​ | U+200B | ZERO WIDTH SPACE | No width. Invisible. Exists purely to allow a line break. Present without being present. |
| ‌ | U+200C | ZERO WIDTH NON-JOINER | No width. Prevents letters from joining into ligatures. Invisible influence. |
| ‍ | U+200D | ZERO WIDTH JOINER | No width. Forces letters to join. Used inside emoji sequences. The invisible glue in 👨‍👩‍👧. |
| ﻿ | U+FEFF | BYTE ORDER MARK | Appears at the start of files. Tells software which direction to read bytes. Invisible in editors. Source of countless "why won't this work" bugs. |
| ­ | U+00AD | SOFT HYPHEN | Invisible unless the line breaks exactly here. Then it appears as a hyphen. Otherwise: nothing. |
|　 | U+3000 | IDEOGRAPHIC SPACE | Full-width space from CJK text systems. Looks like two regular spaces. Is one character. |
|  | U+2003 | EM SPACE | Width of one capital M. Typographically significant. Visually: just a wider gap. |
|  | U+2009 | THIN SPACE | Narrower than a regular space. Used between a number and its unit in proper typography. |

### What the room does

**Primary feature — character revealer:**
- Large text input / paste area at the top
- As you type or paste, every character is revealed below
- Each character shown as a colored tile: visible characters in one color,
  invisible/whitespace characters in accent color with their Unicode name displayed
- Zero-width characters shown as a visible marker (e.g. a thin vertical bar in red)
  with label `U+200B` — the only way to see them

**Secondary feature — the invisible character zoo:**
- Below the input: a permanent exhibit of all invisible characters listed above
- Each one shown with: the character itself (rendered), its codepoint, its name,
  a one-sentence explanation of what it does
- A "copy" button for each — puts the invisible character in your clipboard
- Clicking a character inserts it into the input area so you can see it revealed

**Tertiary feature — the zero-width space detector:**
- A dedicated paste box labeled: *"Paste text here to check for hidden characters"*
- Returns either: *"No hidden characters detected"* or a count and list of what was found
- Useful for the real-world problem: copy-pasting from Word/Google Docs into code

### The zero-width space

This is the most interesting resident. A character with no width, no visible presence,
no effect on rendering. It exists only to influence line-breaking behavior. It is
invisible even to most character inspection tools. It can be inserted into text
maliciously — to watermark documents, to fingerprint leaks, to hide information
in plain sight. A word that looks like one word but contains invisible structure.

This character is the backrooms made typographic: present without being perceptible,
influential without being visible, nameable but not seeable.

### Room description

*"This room appears empty.*
*It is not empty.*
*It has never been empty.*
*You were not able to see what was here.*
*That is different from nothing being here."*

### Character tile design

Visible characters: dark tile, white text showing the character, grey subtext with codepoint
Invisible/whitespace characters: accent color (`#e94560`) tile, Unicode name in white,
codepoint in smaller text, a note explaining what it does

Zero-width characters specifically: bright red marker `|` to show position,
label `ZERO WIDTH` prominent, a note: *"This character is here. You cannot see it."*

### Backrooms alignment

The room is about the difference between appearance and reality at the most fundamental
level — the individual character. The backrooms is a space that looks like it should
make sense but doesn't. This room is a space that looks empty but contains a census
of invisible things that have always been present.

The Byte Order Mark (U+FEFF) is particularly fitting — it exists at the beginning of
files to tell software how to read what follows, and it is invisible in every editor
that handles it correctly. You have read thousands of files that began with this
character. You have never seen it.

### Connection to platform theme

Add to title pool:
```
U+00A0
This Room Appears Empty
Not Empty. Never Empty.
Hidden Characters Detected
Zero Width
The BOM Was Always There
Invisible Does Not Mean Absent
U+200B
Something Is Here
Contents: Not Nothing
```

Total title pool: ~205 + 10 = **~215 titles**

---

---

## Room 00034 — The ASCII Panel

**Difficulty: Easy**

### Concept

A room containing a row of 8 toggle buttons representing the 8 bits of a byte.
Click a button to flip it. The current combination of lit and unlit buttons is a
binary number. That number is an ASCII character. The room shows you what character
you've made, its decimal value, its hex value, its name, and its description.

It is a binary keyboard. It is also a lock.

### The interface

Eight large square buttons in a row, left to right — bit 7 (128) down to bit 0 (1).

Each button:
- OFF state: dark, unlit, square
- ON state: lit, accent color (`#e94560`), slightly raised
- Click to toggle

Below the buttons:
- Binary: `01000001`
- Decimal: `65`
- Hex: `0x41`
- Character: `A` (displayed large, centered)
- Name: `LATIN CAPITAL LETTER A`
- Category: `Printable — Letter`
- Description: one sentence about the character

A reset button clears all bits to zero.

### Character categories and display

| Range | Dec | Category | Notes |
|---|---|---|---|
| 0–31 | 0–31 | Control characters | Non-printable. Show name and original purpose. |
| 32 | 32 | SPACE | The ordinary one. |
| 33–126 | 33–126 | Printable ASCII | Letters, numbers, punctuation. Display the character large. |
| 127 | 127 | DEL | Control character. Delete. Show name. |
| 128–255 | 128–255 | Extended ASCII | Show character, note encoding varies by system. |

### The control characters deserve special treatment

Characters 0–31 are the most interesting residents. They predate screens.
They were instructions to physical machines — teletypes, printers, terminals.
Each one should be displayed with its original purpose:

| Dec | Hex | Name | Original purpose |
|---|---|---|---|
| 0 | 0x00 | NULL | Nothing. Padding. The absence of data. |
| 7 | 0x07 | BEL | Rang a physical bell on a teletype. |
| 8 | 0x08 | BS | Backspace — moved the print head left one position. |
| 9 | 0x09 | HT | Horizontal tab. |
| 10 | 0x0A | LF | Line feed — rolled paper up one line. |
| 13 | 0x0D | CR | Carriage return — moved print head to left margin. |
| 27 | 0x1B | ESC | Escape. Began a control sequence. Still used in terminals. |
| 32 | 0x20 | SP | Space. The ordinary one. |
| 127 | 0x7F | DEL | Originally punched out all holes on a paper tape to delete. |

These characters were designed for machines that no longer exist.
They are still present in every text file you have ever created.

### Multiplayer

The panel state is broadcast via WebSocket — all users in the room see the same
panel in real time. One person flips a bit, everyone sees it change. The character
display updates for everyone simultaneously.

This is collaborative bit-flipping. It is also a way for users to communicate
in binary if they choose to.

WebSocket events:
```json
{ "game": "ascii", "type": "state", "bits": [0,1,0,0,0,0,0,1] }
{ "game": "ascii", "type": "flip",  "bit": 0, "value": 1 }
```

Server holds authoritative bit state: `let asciiBits = [0,0,0,0,0,0,0,0];`

### Lock conditions — the panel as key

The current state of the 8 bits is readable by the lock system in `server.js`.
The following combinations are proposed as lock conditions for other rooms.

**BEL — `00000111` = 7**
Ring the bell. A room that opens when you select the character that causes
a physical bell to ring — a machine that no longer exists, an instruction
that has outlasted its hardware.
Hint on locked room: *"Ring the bell."*
That is the entire hint. Nothing else.

**NULL — `00000000` = 0**
Everything off. Nothing selected. The representation of nothing.
A room that opens when you set all bits to zero — when you choose the character
that means absence.
Hint: *"Select nothing."*

**DEL — `01111111` = 127**
Everything on except the high bit. The delete character — originally created
by punching all holes in a paper tape to physically destroy a character.
A room that opens when you select erasure.
Hint: *"— — —"* (no hint. the pattern is the hint.)

**ESC — `00011011` = 27**
Escape. Still used in terminals today to begin control sequences.
The character that means "what follows is an instruction, not content."
A room that opens when you select the escape character.
Hint: *"There is a way out."*
This one is the most on-brand for the backrooms.

**Implementation in server.js:**
```javascript
const ASCII_LOCKS = {
  '000XX': { // BEL room
    hint: 'Ring the bell.',
    condition: () => asciiBits.every((b,i) => b === [0,0,0,0,0,1,1,1][i])
  },
  '000YY': { // NULL room
    hint: 'Select nothing.',
    condition: () => asciiBits.every(b => b === 0)
  },
  '000ZZ': { // ESC room
    hint: 'There is a way out.',
    condition: () => asciiBits.every((b,i) => b === [0,0,0,1,1,0,1,1][i])
  }
};
```

### Room description

*"Eight switches. One hundred and fifty-six possible states.*
*Each state is a character.*
*Some characters have names.*
*Some characters have purposes that no longer exist.*
*The machines they were designed for are gone.*
*The characters remain."*

Note: 256 possible states, not 156. But *"one hundred and fifty-six"* sounds wrong
in an interesting way. Leave it. Let someone notice.

### Connection to Room 00033 — The Invisible Character Room

The ASCII Panel and the Invisible Character room are companion pieces.
Room 00033 shows you characters that are present but invisible.
Room 00034 shows you characters that are visible but forgotten —
instructions for machines that no longer exist.

Together they are a complete picture of the gap between what characters are
and what they appear to be.

Note this connection in both room files.

### Addition to title pool

```
00000000
01111111
00000111
Ring the Bell
NULL
ESC
The Bell Has Been Rung
DEL
Select Nothing
There Is A Way Out
Eight Switches
One Hundred And Fifty-Six
The Machines Are Gone
The Characters Remain
```

Total title pool: ~215 + 14 = **~229 titles**

### Addition to cross-reference notes

**ASCII Panel (00034) ↔ Invisible Character Room (00033)**
Companion pieces. 00033: characters present but invisible.
00034: characters visible but forgotten — instructions for absent machines.
Together: a complete picture of what characters are vs what they appear to be.

**ASCII Panel (00034) ↔ Multiple locked rooms**
The BEL, NULL, DEL, and ESC combinations are proposed lock conditions.
When those locked rooms are built, assign them IDs and update the ASCII_LOCKS
object in server.js. The hint text is already written — do not change it.
ESC hint (*"There is a way out."*) is the most important. Do not change it.

---

---

## Amendment to Part 10 — Player Profile Page: Exploration Mechanics

### Exploration percentage — display design

The profile page shows exploration progress using **Option D — Redacted Total**
combined with elements of all four options. Full specification below.

---

### Primary display

```
LOCATIONS ACCESSED
  7 of ██ rooms visited
  ████████░░░░░░░░░░░░  [progress bar, partially filled]
```

- The player's visited count is always shown accurately
- The total is always shown as `██` — redacted, never revealed
- The progress bar fills proportionally based on the TRUE total known to the server
  but the player never sees the denominator — only the bar filling
- The bar therefore gives a feeling of progress without revealing the ceiling

### Secondary display — known vs unknown

Below the primary display:

```
  Known rooms:    12    [rooms that have appeared in nav or been visited]
  Locked rooms:    ██   [exists, count redacted]
  Hidden rooms:    ██   [exists, count redacted]
```

- "Known rooms" is the count of rooms the player is aware of — seen in nav, visited,
  or heard about through the suggestions page
- "Locked rooms" count is shown as `██` — the player knows locked rooms exist
  (they see them on their profile as redacted entries) but not how many total
- "Hidden rooms" count is also `██` — the player may not even know this category exists
  until they discover a hidden room, at which point this row appears for the first time

The first time a hidden room row appears on a player's profile:
*"A new category has appeared in your file."*
No further explanation.

### The denominator shifts

When a new room is added to the platform, or a locked room unlocks, or a hidden room
is discovered by anyone — the true total in the server increments. The player's
progress bar shifts slightly even though their visited count hasn't changed.

The player notices their bar is slightly less full than it was.
The platform does not explain why.
The facility got larger.

### Percentage display — Option C for the stat line

The profile stat line never shows a percentage. Only counts:

```
EXPLORATION STATUS
  Rooms visited:    7
  Rooms remaining:  unknown
  Total rooms:      ██
```

"Rooms remaining: unknown" is accurate and deliberately unhelpful.
The facility does not tell you how large it is.

### Progress bar implementation

```javascript
// Server knows true total — never sent to client directly
const TRUE_TOTAL = GAMES.length + LOCKED_ROOMS.length + HIDDEN_ROOMS.length;

// Client receives only the fill percentage, not the numbers
const fillPercent = (visited / TRUE_TOTAL) * 100;

// Bar renders from this percentage
// Client cannot reverse-engineer TRUE_TOTAL from the percentage alone
// because visited count is also sent separately
// Unless they do the math. Some will do the math.
// That is acceptable. The redaction is aesthetic, not cryptographic.
```

The last four lines of that comment are part of the spec and should be preserved
in the server.js code comment. The acknowledgment that someone will do the math —
and that this is acceptable — is the right relationship with the player.

### Achievement-adjacent display — exploration milestones

Not called achievements. Called OBSERVATIONS. The platform observed something
about your behavior. It is noting it. Clinically.

```
OBSERVATIONS
  First room entered beyond the landing page.       [date]
  Visited 5 distinct locations.                     [date]
  Discovered a location not listed in navigation.   [date]
  Present when a locked room became accessible.     [date]
  Returned to a previously visited room 10 times.  [date]
```

- Observations are earned automatically from server-side tracking
- They appear in the player's profile file without announcement
- No notification, no fanfare — they simply appear the next time the player
  views their profile
- The player discovers them by reading their own file
- Each observation has only a label and a date — no point value, no rarity tier,
  no congratulations
- The platform does not congratulate you. It observes you.

### Observation list (starter set — expand as platform grows)

```
First room accessed beyond the origin point.
Five locations visited.
Ten locations visited.
All currently known rooms visited.
A locked room accessed for the first time.
Present at the moment a locked room opened.
Visited a room between 2:00 AM and 3:00 AM.
Visited the same room more than 10 times.
Visited a room and immediately left.
Visited every room in a single session.
Discovered a room not accessible from the navigation.
Spoke to ELIZA.
The turtle drew something.
The bell was rung.
The escape character was selected.
A draw was achieved.
Observed another subject for more than 5 minutes.
Was observed.
```

That last one — "Was observed." — requires the Observation Room to be tracking
who is being watched and reporting that back to the observed user's profile.
This is worth building. The player opens their profile and sees it.
They did not know. Now they do.

### The "was observed" mechanic

When a user in the Observation Room watches another user for more than 60 continuous
seconds, the server:
1. Logs the observation event to the watched user's profile stats
2. Does NOT notify the watched user in real time — they find out later
3. The observation appears in OBSERVATIONS on their profile:
   *"Was observed."* — date, no name of the observer

The observer's identity is never revealed. Only that observation occurred.

This is the correct design. The discomfort is in not knowing who, not in knowing
that it happened.

### Addition to cross-reference notes

**Profile exploration display ↔ all locked and hidden rooms**
The redacted `██` total on the profile page is directly connected to every locked
and hidden room. When new rooms are added to any category, the progress bar shifts.
Players who notice this are tracking the facility's growth in real time.

**"Was observed." observation ↔ The Observation Room (00031)**
The Observation Room creates entries in the watched user's profile without their
knowledge. They discover this by reading their own file. Build this connection
when both the profile page and the Observation Room are complete.

**Observations (milestones) ↔ ASCII Panel lock conditions**
"The bell was rung." and "The escape character was selected." are observations
earned by setting specific ASCII Panel states. These are cross-referenced — the
ASCII Panel lock conditions and the profile observations should be built together.

---

---

## Part 13 — Originality Research (researched May 2026)

### Question: Has this been done before? Is this original?

**Short answer: Yes, it's original. But it has neighbors worth knowing.**

---

### What exists in the backrooms / liminal space game space

The backrooms game genre is crowded but narrow. Every existing backrooms game does
the same thing: walking simulator, VHS aesthetic, eerie corridors, exploration,
entities that chase you. Single-player, first-person, horror navigation. Examples:

- Backrooms Exploration Liminal (Steam) — walking sim, immersive storytelling, eerie corridors
- The Backrooms: Liminal Reality (Steam) — psychological horror exploration
- BACKROOMS: LIMINAL ESCAPE — VHS-style horror, hide/run/survive mechanics
- Dozens of itch.io entries in the same register

None of these have minigames. None are multiplayer in the sense this platform is.
None use the platform infrastructure as a game mechanic. None have lock conditions.

---

### The closest thing that exists: Blue Prince (2025)

Released April 2025. Highest Metacritic score of 2025. Developed by Dogubomb.

Blue Prince is a puzzle roguelike where players draft and place rooms to navigate
a shifting 45-room mansion searching for a hidden Room 46. Each room serves a function.
Rooms have state. Meta-puzzles span multiple rooms. The mansion resets daily.

Critics compared it to Outer Wilds, Return of the Obra Dinn, and The Stanley Parable.
It has been described as "Riven for the indie roguelike generation."

**Overlaps with this platform:**
- Numbered rooms with specific functions
- State-based access (keys, items, conditions)
- Meta-puzzles that span multiple rooms and runs
- The sense of a building that contains secrets you discover through exploration
- Knowledge persists across sessions even when state resets

**Key differences:**
- Single-player only — no social or multiplayer layer
- No real minigames — rooms contain puzzles, not playable games
- No real-time presence, observation, or social deduction layer
- No institutional horror aesthetic — cozy mysterious mansion, not a facility
- No platform-level meta-game where the infrastructure itself is the puzzle
- No lock conditions based on live game state across different games

Blue Prince should be added to the thematic references section as a design reference —
not a source of aesthetic influence, but a proof that "rooms as a meta-game structure"
resonates deeply with players. It validates the core architecture.

**Add to Part 8 thematic references:**

**Blue Prince (Dogubomb, 2025)**
Puzzle roguelike. Numbered rooms, state-based access, meta-puzzles spanning rooms,
knowledge persistence across sessions. The closest existing game to this platform's
structural concept — though single-player, no minigames, no multiplayer social layer,
no institutional aesthetic. Validates that "rooms as meta-game" is a compelling design
space. Highest-reviewed game of 2025.
Key concepts: room drafting, meta-puzzles, state persistence, hidden rooms, numbered spaces.

---

### The Stanley Parable (2013) — already in thematic references

Confirmed as a close aesthetic neighbor. Uses numbered doors, non-Euclidean hallways,
and an omnipresent narrator to question the nature of games and player agency.
The MIT Press has described both The Stanley Parable and The Backrooms as belonging
to the same genre: "Institutional Gothic" — human-made spaces rendered uncanny by
the absence of humanity and the presence of systems that continue regardless.

Severance (TV) fits the same register and was cited by the same MIT Press analysis.

---

### What does not exist anywhere

This is the honest assessment of what makes this platform original:

A multiplayer game platform where the platform itself is the game. Where:

- Presence tracking is evidence (Among Us infrastructure, already built)
- Game states are keys (tic-tac-toe draw unlocks the Joshua Room)
- The cookie count being prime is a lock condition
- The ASCII panel state is a lock condition (BEL, NULL, ESC, DEL)
- The time of day is a lock condition (2am room)
- ELIZA and Logo sit adjacent as companion pieces — 1966 and 1967 MIT programs
  that nobody has ever put in the same room before
- The profile page is a subject file that records TERMINATION EVENTS
- The platform watches you and notes it clinically in your file
- "Was observed." appears in your file without your knowledge
- The progress bar fills based on a redacted total you can never see
- 229 rotating titles drawn from GLaDOS, the Labyrinth, WarGames, the IBM 7094,
  the Wizard of Frobozz, the Dollmaker, the Backrooms, ELIZA, Murder Drones,
  and the Amazing Digital Circus
- The title pool includes "It Has Been Waiting Since 1967" and "No Hard Feelings"
  and "One Hundred And Fifty-Six" (deliberately wrong) and "Was observed."
- The Yellow Door and the Recursive Room arrived at the same idea from different
  directions and their connection is left unresolved
- The 2am room and the traffic camera feeds share a clock without coordination
- The Observation Room is Among Us infrastructure waiting to be activated
- The platform does not congratulate you. It observes you.

The collection of minigames is not original.
The liminal/backrooms aesthetic is not original.
The numbered rooms are not original.
The institutional horror framing is not original.

The specific combination — a living multiplayer facility where the meta-game is woven
into the infrastructure of the platform itself, where playing games generates evidence,
where the platform watches you and notes it clinically, where access to rooms is gated
by the state of other games, where the presence system is both navigation and alibi —
**that combination does not exist.**

Blue Prince is the closest thing and it is still quite far away.

---

### What this means for the project

This is not a derivative project wearing a backrooms skin over a game collection.
It is a genuinely novel design space: the platform as the game, the infrastructure
as the puzzle, the other players as both collaborators and evidence.

The closest academic framing: "Institutional Gothic" meets multiplayer ARG
(Alternate Reality Game) meets party game platform — but built for a family of four,
running on a $6 VPS, written by Claude Code, designed in a conversation.

That provenance is also original.

---

---

## Amendment — Repo name updated to NULL

**Repo name: `NULL`**

Replaces `backrooms` throughout. Rationale documented in Part 7.

U+0000. Decimal 0. Binary `00000000`. All switches off.
The ASCII panel room displaying all bits unlit is showing the repo name.
The NULL lock condition (`00000000` — "Select nothing") is the repo name as a state.

The repo is named after something the system will not let you name things.
In many operating systems, NULL is a reserved word — creating a file or folder
with that name is refused or causes undefined behavior.

NULL is not nothing. It is the specific representation of the absence of a value.
A something that means nothing. That distinction is the entire platform.

Add to title pool:
```
NULL
U+0000
00000000
The Null Character
Reserved Word
Select Nothing
The Absence of a Value
Something That Means Nothing
```

Total title pool: ~229 + 8 = **~237 titles**

### Connection to ASCII Panel room (00034)

When the ASCII panel shows `00000000` — all switches off, all bits zero — it is
displaying the repo name. The NULL lock condition and the repo name are the same thing.

This should be noted in the ASCII panel room file as a comment:
```
// When all bits are zero, this panel displays the name of the repository.
// This was not planned. It emerged from the choice of name.
// Leave it.
```

---

---

## Part 14 — Deferred Mechanics and Room Ideas (further review needed)

**Status: Ideas captured — do not build yet. Revisit when core platform is stable.**

---

### Mechanic: Moving Rooms

**Concept:**
Rooms that aren't where they were. The labyrinth rearranges itself.

**What "moving" means on a web platform:**
Physical navigation doesn't exist, so movement must be expressed differently:

- The game grid on the landing page reorders itself between visits.
  Rooms shift positions without explanation. The one you were looking for
  isn't where it was.
- A room's URL changes. `/game/00019` now serves content that was previously
  at `/game/00022`. The content moved, not just the position.
- Rooms appear and disappear from the nav without explanation.
- A room redirects you somewhere else when you enter it — you navigate to one
  room and arrive in another.

**Implementation notes:**
- Simplest version: randomize grid order on landing page each session
- Intermediate: server maintains a room position map that shifts on a schedule
  or when triggered by specific events
- Advanced: room URLs remap based on server state (requires careful handling
  of direct links and bookmarks)

**Thematic fit:**
The Labyrinth rearranges itself. Blue Prince's mansion resets daily.
The backrooms has no reliable map. This mechanic makes that literal.

**Connection to forced movement mechanic (below):**
A room that moves and a room that pulls you in are complementary —
one removes the room from where you expect it, the other removes your
choice of where to go.

**Flag for cross-reference:** Add to lock conditions section when built.
A room that only appears in the grid under specific conditions is a
variant of both the lock mechanic and the moving rooms mechanic.

---

### Room Idea: IP Geolocation + Street View

**Concept:**
A room that uses your IP address to approximate your location, then shows
street-level imagery from near that location. The room shows you images that
look like they could be near your house. Real or faked — that uncertainty is
the mechanic.

**The experience it creates:**
You open a room and see a street that could be near you.
That feeling. That is the room. Nothing else needs to happen.

**Technical approach:**

Option A — Real geolocation + real imagery:
- IP geolocation API (ipapi.co or similar) returns approximate city/neighborhood
- Google Street View API or Mapillary (open source alternative) returns imagery
  from coordinates near that location
- Display 3-6 images from the neighborhood
- Label them only with coordinates, not place names
- **Note:** Google Street View API requires API key + usage costs.
  Mapillary is free and open source. Preferred.
- **Note:** IP geolocation is imprecise — resolves to city/neighborhood,
  rarely to a specific street. This imprecision is a feature, not a bug.
  The images look local. They may or may not be exactly local.

Option B — Faked imagery:
- Show curated images of generic suburban streets, parking lots, side roads
- Style them to feel plausibly local
- The room makes no claim about whether the images are real or faked
- The uncertainty about which one it is may be more effective than either alone

Option C — Hybrid:
- Real geolocation data displayed (city, approximate coordinates)
- Images may or may not correspond to that location
- The room never confirms or denies the relationship between the data and the images

**Recommendation:** Option C. The uncertainty is the point.

**Room description:**
*"Your approximate location has been noted.*
*These images were taken nearby.*
*Or they were not.*
*The facility does not clarify."*

**Consent and framing note:**
IP geolocation is the same data used by weather apps, regional content delivery,
and fraud detection. It is public information. The room is not surveilling anyone —
it is making visible something that already happens invisibly on every website visit.
That revelation is the experience. Frame it honestly in the room.

Add a small note in the room: *"Your IP address provides an approximate location.
This is standard. Most websites do this. Most do not tell you."*

**Flag for discussion:** API costs, Mapillary integration, consent framing.

---

### Room Idea: Something Under the Bed

**Concept:**
A room that asks one question and waits.

**The room:**

```
Are you in bed right now?

[YES]  [NO]
```

If YES:
```
Are you looking at this on your phone?

[YES]  [NO]
```

If YES:
```
Don't look under the bed.
```

And then it sits there. Doesn't do anything else.
Doesn't explain. Doesn't threaten. Asks you not to look. Waits.

**Why it works:**
The monster under the bed is the oldest fear because it doesn't need to be real.
The room doesn't need a monster. It needs only the suggestion and the waiting.
The player's imagination does the rest. The room provides the frame.

**If NO at any step:**
```
That's fine.
The room has nothing further to say to you right now.
```

The dismissal is part of it. The room was only interested in a specific person
in a specific situation. If that's not you, the room moves on. Cold. Indifferent.

**Variants to consider:**

- Time-locked: the room only appears in the nav after 10pm local time
  (detect via browser `new Date().getHours()`)
- State: once you answer YES/YES, the room remembers via session.
  Next visit: *"You were in bed last time."*
- Lock condition variant: a room that becomes inaccessible after 10pm —
  *"Something is under the bed. The room is closed until morning."*
  The room locks at night instead of unlocking.

**Room description (shown before entering):**
*"This room is only relevant under certain conditions.*
*You will know if the conditions apply."*

**Difficulty:** Trivial. Pure HTML, no server needed, no WebSocket.
The most terrifying room on the list requires the least code.

---

### Mechanic: Forced Movement — Action Triggers Room Change

**Concept:**
An action taken in one room causes you to arrive in a different room
without choosing to go there. The room decided. You took an action
and found yourself somewhere else.

**This is the most backrooms mechanic of all.**
You didn't navigate. You were moved.

**Examples of trigger conditions:**

- Clicking the cookie in Cookie Clicker for the 1000th time redirects
  you to a room you've never seen before
- Losing at Tic Tac Toe three times consecutively sends you somewhere
- The ASCII panel reaching `00000111` (BEL) navigates you automatically
  to the BEL locked room — the panel doesn't just unlock it, it takes you there
- The Yellow Door, when opened, doesn't show what's behind it —
  it takes you there. Navigation happens to you, not by you.
- A specific word typed in Chat triggers a redirect for the typing user
- Pong score reaching exactly 3-3 sends both players somewhere
- The dice roller rolling all 1s (snake eyes across every die) triggers a redirect
- The Logo turtle completing a specific shape (a square with side 100)
  sends you to a room about geometry

**Implementation:**
Server-side: when a game event fires, check if it matches a forced movement
condition. If yes, send a WebSocket message to the relevant client(s):

```json
{ "type": "forced_movement", "destination": "00017", "delay": 3000,
  "message": "Something has changed. You are being redirected." }
```

Client receives this, shows the message for `delay` milliseconds, then navigates.
The message is the room telling you what's happening before it happens.
The delay is the moment between action and consequence.

**The message matters:**
Different triggers should have different messages. Some clinical:
*"Threshold reached. Redirecting."*
Some inexplicable:
*"You have been noticed."*
Some Labyrinthine:
*"The room has changed."*
One that is just:
*"."*

**Combined with moving rooms:**
A forced movement that sends you to a room that has moved is the most
disorienting version. You arrive somewhere. You don't know where it is
relative to where you were. The map is not reliable.

**Difficulty:** Medium. Requires WebSocket message type addition to server.js,
condition checking in each relevant game's message handler, and client-side
redirect logic in nav.js. Architecture is clean — it's additive, not disruptive.

**Flag:** Document every forced movement trigger in the cross-reference section
when built. Players will eventually notice the pattern. That noticing is the game.

---

### Cross-reference additions

**Moving rooms ↔ lock conditions (Part 11)**
A room that only appears in the grid under specific conditions is a variant
of both. The distinction: lock conditions prevent access, moving rooms
change position. A room that is both locked AND moves is the most hidden
a room can be.

**Something under the bed ↔ 2am locked room**
Both are time-sensitive rooms. The bed room is only relevant at night.
The 2am room only opens at night. Consider: the bed room asks if you're in bed.
The 2am room opens while you might be. These two rooms share a clock
and a context without coordination.

**Forced movement ↔ ASCII panel (00034)**
The BEL combination (`00000111`) should trigger forced movement to the BEL room
rather than just unlocking it. The bell rings and the door opens and you go through.
You don't choose to go. The bell chose for you.

**Forced movement ↔ Yellow Door (00017)**
The Yellow Door opening should be a forced movement trigger.
You click the door. The door opens. You don't navigate to what's behind it.
You arrive there. Navigation happened to you.

**IP geolocation room ↔ Observation Room (00031)**
Both rooms make visible something that was already happening invisibly.
The Observation Room shows you that you were being watched.
The geolocation room shows you that your location was already known.
Both are rooms about the gap between what is visible and what is true.
Consider placing them adjacent in the room list.

---

---

## Part 15 — Room Ideas Batch (further review needed)

**Status: Ideas captured — do not build yet unless noted. Revisit in priority order.**

---

### Room: MS-DOS HELP Interface

**Difficulty: Medium**
A recreation of the MS-DOS 6 HELP system (1993) — blue background, white text,
two-panel layout, monospace font, the QBasic UI engine aesthetic.
Instead of documenting DOS commands, it documents the NULL platform itself.

```
MS-DOS HELP -- NULL Platform Reference

  ROOM . . . . . . . Navigate to a room
  LOCK . . . . . . . Conditions for locked rooms
  OBSERVE. . . . . . View another subject
  SUBJECT. . . . . . View your subject file
  BEL. . . . . . . . Ring the bell
  NULL . . . . . . . Select nothing
  ESC. . . . . . . . There is a way out
  EMPTY. . . . . . . Rooms with no content
  DEAD . . . . . . . Rooms that look alive but aren't
```

Each entry links to a panel with a description in clinical DOS HELP style.
The platform documenting itself in the aesthetic of the system that predated it.
Navigation: arrow keys, Tab, Enter. Mouse support optional.
Prompt shown in corner: `C:\NULL>`

**Add to thematic references:** MS-DOS 6 HELP (Microsoft, 1993) — full-screen
hypertext documentation system running inside QBasic. Blue and white. The first
help system most people ever used. The aesthetic of institutional knowledge delivery
before the web existed.

**Title pool addition:** `C:\NULL>`, `HELP.HLP`, `QBASIC.EXE`, `Type HELP for help.`

---

### Information Rooms — Correct and Incorrect Versions

**Difficulty: Trivial**
Multiple paired rooms. Each pair contains the same information presented twice —
once correctly, once with something quietly wrong. The platform does not indicate
which version is correct. The rooms are labeled identically. The discrepancy is
never acknowledged.

**Proposed pairs:**

- The Gettysburg Address — correct version / version with altered words or dates
- Multiplication table — correct / one cell quietly wrong (not obviously wrong)
- A famous scientific constant (speed of light, Planck's constant) — correct value /
  subtly wrong value
- A historical date — correct / one year off
- A recipe — correct / one ingredient substituted

**Design rules:**
- Both rooms look identical in structure and styling
- Neither room is labeled "correct" or "incorrect"
- The platform never acknowledges both exist
- There is no in-platform way to verify which is right
- Players must bring outside knowledge or find both rooms and compare
- The wrong version is never egregiously wrong — just quietly, plausibly wrong

**The room description (same for both versions):**
*"Information is provided. Accuracy is assumed."*

**Connection to existing spec:**
The ASCII panel room deliberately states "one hundred and fifty-six possible states"
when there are 256. The rotating title pool contains deliberate wrong information.
These rooms extend that mechanic into a dedicated space.

---

### Useless Information Room(s)

**Difficulty: Trivial**
**Three variants — build all three, each as a separate room:**

**Variant A — Genuinely useless facts:**
True, verifiable, serves no purpose. A new fact displayed each visit or on a timer.
Examples: average cloud weight, collective nouns for animals, word with most definitions,
how long it takes light to travel from the Sun to Pluto, number of possible chess games.
Presented in the same clinical institutional style as everything else.
No context. No "did you know." Just the fact. Just the number. Just the thing.

**Variant B — Facts whose purpose has expired:**
Information that was once useful and isn't anymore. The scheduled departure times
for a bus route that no longer runs. The phone number for a business that closed.
The population of a city from 1987. The opening hours of a place that no longer exists.
The data outlasted its relevance. The room hasn't noticed.
*"This information was accurate at time of publication."*
No publication date given.

**Variant C — The fossil room (most important):**
A room that documents a previous version of the NULL platform.
It still says there are 9 rooms. It lists the original game names.
It describes features that were planned and never built, or built and removed.
It references rooms by numbers that have since been reassigned.
The room does not know it is outdated.
It presents its information with complete confidence.
It has not been updated. It will not be updated. It is accurate about something
that is no longer present.

Room description for Variant C:
*"This room contains accurate information about the facility.*
*Some of this information remains accurate.*
*The room does not know which parts."*

---

### Room: Calendar — Changeable Date and Time

**Difficulty: Easy–Medium**
A room displaying a calendar. The user can change the date and time.
The calendar is personal — changing it doesn't affect other users.

**The interesting question:**
Does changing the date affect the platform's clock for that user?
If a user sets the date to 2am — does the 2am room open for them?
If they set the date to a specific day — does anything change?

**Recommendation:** Yes, with limits. The calendar date feeds into the lock condition
checker for that user's session. Setting the time to 2am opens the 2am room.
This creates a shortcut through the time-based lock — but it requires finding the
calendar room first, and knowing to try it.

The calendar room is itself a key. The key is a calendar. That's the right design.

**Add to cross-reference notes:**
Calendar room ↔ 2am locked room — the calendar can override the system clock
for lock condition purposes. Finding and using this shortcut is an observation
logged in the player's profile: *"Used an unconventional method to access a room."*

---

### Room: Interactive MS-DOS Prompt

**Difficulty: Medium**
A fake but interactive DOS terminal. Prompt: `C:\NULL>`
Some commands work and return plausible output.
Some commands return wrong output — plausible but incorrect.
Some commands return things DOS never said.
Some commands return things no computer has ever said.

**Commands that work (approximately correctly):**
`DIR`, `CLS`, `DATE`, `TIME`, `VER`, `HELP`, `CD`, `TYPE`

**Commands that return wrong output:**
`MEM` — reports memory incorrectly
`CHKDSK` — finds errors that don't exist, or finds no errors in a corrupted system
`DATE` — returns the wrong date (always the same wrong date)

**Commands that return unexpected things:**
`ECHO` — echoes your text back, then adds one word you didn't type
`FORMAT C:` — proceeds for 3 seconds then stops: *"Format cancelled. Probably."*
`DEL *.*` — *"Are you sure? (Y/N)"* — whatever you type: *"Noted."* Nothing deleted.
`HELP` — opens the MS-DOS HELP room (cross-room navigation via terminal command)
`NULL` — *"Command not recognized. But it is here."*
`EXIT` — *"You cannot exit from here."*

**Prompt style:**
```
Microsoft(R) MS-DOS(R) Version 6.22
             (C)Copyright Microsoft Corp 1981-1994.

C:\NULL>_
```

**Connection to Zork II room:**
Both are terminal interfaces. Both have commands that do unexpected things.
Consider whether `GO NORTH` typed at the DOS prompt navigates somewhere.

---

### Room: 6-Panel Monitor Room

**Difficulty: Easy**
2 rows × 3 columns of live room views. Each panel shows another room rendering
inside an iframe. Every second, one randomly selected panel switches to a different
room. No interaction — the panels are view-only.

The effect: a surveillance monitoring station. Rooms flickering in and out.
Occasionally two panels show the same room simultaneously.
Occasionally a panel shows this room — the monitor room watching itself.

That last case: do not prevent it. When the monitor room shows itself, one panel
contains a smaller version of the 6 panels, one of which contains a smaller version,
which contains a smaller version. Let it go as deep as the browser allows.

**Connection to Recursive Room (00032):**
The monitor room can show the recursive room. The recursive room contains the
monitor room. This connection should be noted but not prevented.

Room description: *"Six windows. They show what is happening elsewhere.*
*You are not elsewhere. You are here, watching.*
*One of the windows may show this room.*
*That has not been prevented."*

---

### Room: The Trolley Problem

**Difficulty: Easy**
An interactive version of the classic ethical thought experiment.

A trolley is heading toward five people. You can pull a lever to divert it
to a track with one person. Pull or don't pull.

**What the platform does with your choice:**
- Records it to your profile: *"The lever was pulled."* or *"The lever was not pulled."*
- Shows aggregate stats: how many users pulled, how many didn't
- Offers variants: the footbridge problem, the fat man variant, the loop track
- Each variant recorded separately in your profile
- No judgment. No right answer indicated. Just: recorded.

**The platform's statement on the matter:**
*"Your choice has been recorded. The facility takes no position on trolleys."*

**The real room mechanic:**
After choosing, the room shows you what other users chose.
Not names — just numbers. "47 pulled the lever. 23 did not."
The ethical weight of the aggregate is the room.

---

### Room: Unix Timestamp

**Difficulty: Trivial**
A large number, counting up. Every second. In a retro terminal font on a dark background.

The number: seconds elapsed since January 1, 1970, 00:00:00 UTC.
This is Unix time. It has been counting since before most of the platform's users were born.
It will continue after every system currently running has been decommissioned.

Nothing else in the room. Just the number.

Current value at time of writing this spec (May 2026): approximately 1,748,000,000.

**Small text below the number:**
*"Seconds since January 1, 1970, 00:00:00 UTC.*
*The count began before you did.*
*It will continue after."*

**Title pool addition:** `1748000000`, `Unix Epoch`, `Counting Since 1970`,
`The Number Continues`, `Seconds Elapsed`

---

### Rooms That Exist But Have No Content

**Difficulty: Trivial**
Rooms that appear in the navigation but contain nothing.
The platform chrome (nav bar, header) is present. The room body is empty.
No text. No explanation. No error message.

Some may have had content once.
Some may never have had content.
Some may be waiting for content that will never come.
The platform does not distinguish between these cases.

**Implementation:** Serve an HTML file containing only the nav and an empty body.
No room description. No title beyond the nav title. Just the frame and the void.

**How many:** At least 3. Their numbers should not be sequential — scattered through
the room list to be found individually rather than as a group.

**The discovery:** A player navigating systematically will find them and not know
if they are broken, intentional, or waiting. That uncertainty is the content.

---

### Links to Rooms That Do Not Exist

**Difficulty: Trivial**
Room cards appear on the landing page grid that link to URLs that return real browser errors.
Not a custom 404 page — a genuine server 404 or connection error.
The raw browser error. The absence as content.

**Framing:** The room cards look identical to real room cards. Same styling, same icon,
same description format. The description hints at what the room might contain.
When you click, the browser fails. That failure is the experience.

**The descriptions might read:**
- *"This room is not ready."* → 404
- *"This room is being prepared."* → 404
- *"Contents: pending."* → 404
- *"[REDACTED]"* → 404

**How many:** 3-5. Scattered through the grid. Indistinguishable from real rooms
until clicked.

**Note:** These are distinct from empty rooms (above). Empty rooms load and contain
nothing. These rooms don't load. The browser itself fails. Different experiences.

---

### Room: Half Constructed / Half Deconstructed

**Difficulty: Easy**
A room that is mid-build. Or mid-demolition. The platform cannot say which.

Scaffolding visible as ASCII art or CSS. Placeholder text present:
`[CONTENT GOES HERE]`, `TODO: implement this`, `<!-- room not complete -->`.
The room's own source code partially visible. Construction tape emoji used as borders.
A progress bar showing: `████░░░░░░ 40% complete` — the bar never moves.

The room is not broken. It is simply not finished. And it has always been not finished.
And it will always be not finished. The 40% is permanent.

*"This room is under construction.*
*This message has been here since the room was created.*
*The construction has not progressed.*
*This is not considered a problem."*

---

### Room: Alternate Hangman — One Life

**Difficulty: Medium**
Standard Hangman. One game. One attempt. If you haven't played it, you get one chance.
If you have played it, the room shows you your outcome. Nothing more.

**Win condition:** The word is guessed. A live person appears in your inventory.
They have a name. The name is the word you guessed.

**Lose condition:** The man is hanged. A dead person appears in your inventory.
They have a name. The name is the word you failed to guess.

**The item is permanent.** It appears in your profile under ITEMS IN POSSESSION.
It cannot be removed. It has no function. It is simply carried.

**The room after your one game:**
If you won: *"[Name] is with you now."*
If you lost: *"[Name] did not survive. They are still with you."*

The room offers no replay. The door is there. The game is gone. The item remains.

**Word selection:** One word, chosen at platform launch, the same for everyone.
All players play the same word. The word is not revealed even after the game.
Different players may carry different outcomes but the same name.

---

### Dead Rooms — Interface Without Interaction

**Difficulty: Trivial**
Rooms that look exactly like real rooms but nothing responds.
The visual is identical to a working room. The interaction is absent.

For a game room: the canvas renders, the UI elements appear, but clicking does nothing.
WebSocket connects but receives no messages. Events fire but produce no response.
The room looks alive. It is not alive.

**How many:** 2-3. Modeled after existing rooms. A dead version of Tic Tac Toe —
the board renders, the grid appears, clicking squares does nothing.
A dead version of Colour Together — the canvas renders, the palette appears,
clicking paints nothing.

**They are not broken.** The server knows they are dead. The dead state is intentional.
Finding a dead room and recognizing it as dead (not broken) is the experience.

*"This room is present. It is not currently active.*
*The distinction between inactive and broken is not explained here."*

---

### Room: Ominous Countdown Timer

**Difficulty: Easy**
A large countdown timer. The duration is not explained.
When it reaches zero: the session is terminated. The user is logged out.
They must log back in. When they return, the timer has reset. It counts down again.

**The duration:** Varies. Sometimes 10 minutes. Sometimes 47 minutes. Sometimes 3 hours.
The duration is chosen randomly at each reset. The user never knows how long they have.

**What the room shows:**
Only the timer. Large. Monospace. Counting down.
Below it, in small text: *"When this reaches zero, you will need to log in again.*
*The duration of each cycle is not fixed.*
*This room does not require your presence.*
*The timer runs whether you are here or not."*

**The unsettling detail:** The timer runs whether the user is in the room or not.
Visiting the room shows you how much time remains. You don't need to watch it.
But now you know it's counting. You will think about it.

---

### Jump Scare Room

**Difficulty: Easy**
One jump scare. Well executed. Then the room is a dark screen.
Returning produces nothing. The scare happened once. It will not happen again.

**The scare:** A loud sound and a sudden image. Classic jump scare mechanics.
But only once per user, tracked server-side. After the first visit, the room is empty.

**The room after the scare:**
*"You have already been here.*
*It happened once.*
*It will not happen again."*

**Profile observation earned:** *"Entered a room without knowing what was in it."*

**Design note:** The jump scare should be good. Not cheap. If it's going to happen
once per user ever, it should be worth the one time.

---

### Room: User Activity Stats and Histogram

**Difficulty: Easy**
Your personal activity data. Presented in the subject file aesthetic.

**What it shows:**
- Total time spent in the platform (sum of session durations)
- Time spent per room (bar chart)
- Histogram of activity by hour of day — when you typically play
- Histogram of activity by day of week
- First visit date, most recent visit date
- Longest single session
- Most visited room
- Least visited room (that you've visited at all)

**The clinical observation below the histogram:**
*"You play most frequently between [hour] and [hour].*
*This has been noted.*
*The facility does not judge your schedule.*
*The facility has simply noted it."*

**The uncomfortable one:**
If the histogram shows activity consistently after midnight:
*"Several sessions have occurred after midnight.*
*This is recorded as factual information.*
*No further comment is made."*

---

### Room: Inspirational Comments

**Difficulty: Trivial**
A room that delivers positive affirmations. Completely sincerely.
In the same institutional voice as everything else.

*"You are doing well."*
*"Your performance has been noted positively."*
*"You are making progress."*
*"The facility is proud of you."*
*"You are getting better at this."*
*"Your continued participation is valued."*
*"You are awesome."*

A new one displayed each visit. Rotated from a pool of ~50.
The sincerity is complete. The institutional framing makes it slightly wrong.
But also: it is meant. The platform means it. That ambiguity is the room.

**The one that lands differently from all the others:**
*"You came back. That matters."*

---

### Room: Shared Chalkboard

**Difficulty: Easy**
A picture of a chalkboard. Users can write and draw on it with chalk-style input.
State is persistent and shared — everyone sees the same board.
The board is never cleared automatically. It accumulates over time.

Similar to Colour Together but lower fidelity, more physical.
Chalk texture. Dark green background. White/yellow input.
Eraser tool available. No undo.

**The board after months of use:**
A palimpsest. Old marks beneath new marks. Names, drawings, equations, jokes.
The history of everyone who has ever been in the room, layered.
The chalkboard is a record of presence without being a log.

---

### Room: Grade School Clock

**Difficulty: Easy**
The specific clock used in 1980s elementary school classrooms to teach time reading.
The one with colored gear segments — typically a large analog clock face with
colored sections showing hours, minutes, and sometimes seconds in distinct colors.
The kind that had a moveable minute hand and showed the relationship between
the numbers and the positions.

**Options:**
- Static display showing current real time
- Interactive — user can set the time (connects to calendar room / 2am mechanic)
- Just the object, no function — a room containing a clock that shows the right time
  and nothing else

**The room description:**
*"This clock was used to teach you something.*
*You learned it.*
*The clock is still here."*

---

### Room: Metronome

**Difficulty: Easy**
An interactive metronome. Set the tempo (BPM). It ticks.
The tick is a sound — when the sound system is built, this room gets it for free.
The pendulum animates.

**Shared or personal:** The tempo is personal — each user sets their own.
But: if multiple users are in the room simultaneously, a second metronome
appears for each other user, ticking at their tempo. Multiple metronomes,
potentially out of sync, potentially converging. The room fills with rhythm.

**The detail that makes it interesting:**
The metronome has been ticking since the room was created. When you arrive,
it is already at a tempo. Someone set it before you. Or it chose one.
The platform doesn't say.

---

### Room: Tamagotchi — Digital Pet

**Difficulty: Hard**
A persistent digital pet. Needs attention. Gets hungry. Gets sick. Can die.

**Shared vs personal — this decision changes everything:**

Option A — Shared pet: One pet, shared across all users. Everyone is responsible.
If nobody feeds it for 24 hours, it gets sick. If nobody feeds it for 48 hours,
it dies. When it dies, it is gone. A new pet appears with a new name.
The platform records how long each pet lived. The longest-lived pet is noted.
This version creates community responsibility and potential grief.

Option B — Personal pet: Each user has their own pet. Neglect affects only yours.
Less interesting socially but less devastating individually.

**Recommendation:** Option A, shared pet. The shared responsibility is the mechanic.
A platform with 4 users where one is a kid who will absolutely remember to feed it
and two adults who will forget — that dynamic is the game.

**The pet's name:** Generated at birth. Random. Possibly a word from the title pool.
*"REDACT was born on [date]. REDACT lived for 14 days."*

---

### Room: Goldfish

**Difficulty: Easy**
A fish bowl. A goldfish. Swimming.

The fish has been here since the platform launched.
The fish has a name. The name is displayed nowhere — it must be found.
The fish swims in a loop with slight randomness. Animated CSS or canvas.
Nothing else happens. Nothing else needs to happen.

The fish does not know you. The fish has never known anyone.
The fish will continue after you close the tab.

*"The fish is fine.*
*The fish has always been fine.*
*The fish does not require anything from you."*

**The name:** Somewhere in the platform — in a comment in the source code,
in a hidden room, in a piece of text nobody has found yet — the fish's name is written.
Finding it is an observation: *"Found the name of the fish."*

---

### Room: Number Dispenser

**Difficulty: Easy**
A ticket dispenser. The kind in delis and DMVs. You press a button.
A ticket is dispensed. The number on the ticket is an item in your inventory.
The counter increments for every user across all sessions.
You can only take one ticket. Ever.

**Your ticket number:** Determined by when you arrive. First user gets 001.
Second user gets 002. The numbers are permanent and unique.
Your ticket number is part of your identity on the platform.

**The inventory item:**
```
TICKET #042
Issued: [date and time]
Purpose: unknown
Status: held
```

**What the tickets are for:** Never explained. The dispenser doesn't say.
The platform doesn't say. The ticket sits in your inventory indefinitely.
Some tickets may eventually have a purpose when future rooms are built.
Some may never have a purpose.
The dispenser does not know which.

*"Take a number.*
*Your number has been assigned.*
*Please wait.*
*We will call your number when it is time.*
*We do not know when it will be time."*

**The counter on the wall:** Shows the currently displayed number — the last ticket
called. It never changes. It has shown the same number since the room was created.
Nobody has been called. The number displayed is not any user's ticket number.
The platform does not explain this.

---

### Title pool additions from this batch

```
C:\NULL>
HELP.HLP
QBASIC.EXE
Type HELP for help.
1748000000
Unix Epoch
Counting Since 1970
The Number Continues
Seconds Elapsed
Under Construction
████░░░░░░
TODO
Content Pending
Please Wait
Take A Number
Your Number Has Been Assigned
The Fish Is Fine
The Pet Needs Feeding
The Trolley Is Coming
Pull The Lever
Do Not Pull The Lever
Information Is Provided
Accuracy Is Assumed
The Clock Is Still Here
The Metronome Is Already Running
```

Total title pool: ~237 + 24 = **~261 titles**

---

---

## Part 16 — Room Ideas Batch 2

---

### Room: Game Over

**Difficulty: Easy**
Multiple rooms scattered through the platform. When you enter one, "GAME OVER"
appears on the screen in large text and stays. The room is locked in that state
for that user for 24 hours. Nothing the user does changes it. No interaction.
No explanation. Just: GAME OVER. Come back tomorrow.

**How many:** 3-5 rooms, scattered non-sequentially through the room numbers.
Their existence is not announced. They look like normal room cards on the landing page.

**The 24-hour lock:** Server-side per user. Stored in profile stats:
`{ "gameOver": { "roomId": "00041", "until": 1234567890000 } }`
When the user navigates to any game over room while locked, they are redirected
to their current game over screen regardless of which room they clicked.
One game over at a time. When it expires, the next one they find starts a new one.

**Visual:** Classic arcade GAME OVER. Red or white text. Dark background.
A score that means nothing. Insert coin prompt that does nothing.
A timer in the corner counting down to when the room unlocks — or not.
The platform may choose not to show the timer. The user may not know when it ends.

**Profile observation:** *"Encountered a game over screen. Waited."*

---

### Room: Black Hole

**Difficulty: Easy**
A swirling animation. A black hole. You can jump in.

Clicking the black hole sends you to a random room chosen from a curated list.
Some rooms on the platform can ONLY be reached via the black hole — they do not
appear in the navigation, they have no direct URL that works without the referrer,
they are black hole exclusives.

**Implementation:**
Server maintains a `blackHoleRooms` list and a `blackHoleExclusiveRooms` list.
When a user jumps in, server picks randomly from the combined list (weighted toward
non-exclusive to make exclusive rooms rare) and redirects.

Black hole exclusive rooms are not listed in the nav. Their room numbers are not
sequential with the main list. They exist in a separate namespace.
They can only be reached by jumping. Or by knowing.

**Profile observation earned on first jump:** *"Entered the black hole."*
**Profile observation for first exclusive room:** *"Found a room that isn't on the map."*

**The animation:** A CSS/canvas spiral with gravitational lensing effect.
Simple but committed. The jump should feel like something.

**Room description:** *"Some rooms cannot be found by looking.*
*They can only be found by falling."*

---

### Room: The TARDIS (inspired, not infringing)

**Difficulty: Medium**
A blue box. Bigger on the inside.

The outside: a simple room containing a blue police box. You can enter it.
The inside: a much larger space than the outside room could contain.
Multiple sub-rooms. Controls. Possibly navigation to different times
(connecting to the calendar room mechanic).

**On not infringing:**
The TARDIS as a concept — a vessel bigger on the inside — predates Doctor Who
in folklore and literature. The specific BBC design is trademarked.
A blue box that is bigger on the inside, without the specific hexagonal panel design,
the specific roundels, or the specific "POLICE BOX" signage — is defensible.
Call it something else. A vessel. A cabinet. A door that shouldn't fit what's behind it.

**The mechanic:**
The inside space is significantly larger than makes geometric sense.
This is expressed through the room layout — scroll down reveals more than the viewport
should contain, or nested iframes show spaces that extend beyond their frames.

**Connection to Recursive Room and calendar:**
The cabinet connects to the calendar room mechanic — setting a date inside the cabinet
could open time-locked rooms. This needs further design work.

**Flag:** Needs dedicated design session before building. Lots of creative decisions.

---

### Room: Cheshire Cat

**Difficulty: Easy**
A room that fades in and out. The cat is present and then isn't. Only the smile remains.

**The mechanic:**
CSS animation fades elements in and out at irregular intervals.
The cat (ASCII art or simple illustration) slowly becomes invisible, piece by piece.
The smile is always last to fade. Sometimes it stays after everything else is gone.

**What it says:**
*"We're all mad here."*
Nothing else. The smile. The statement. The fading.

**Interaction:** None. You watch. Occasionally if you click on where the cat was,
it briefly reappears — then fades again faster. It noticed you.

**Connection to Alice in Wonderland thematic register:**
Add to Part 8 thematic references if not already noted.

---

### Room: The Hookah-Smoking Caterpillar

**Difficulty: Easy**
A room that asks you a question and waits for your answer.
The question is: *"Who are you?"*

Whatever you type, the caterpillar responds with another question.
Or with silence. Or with a dismissal. It is never satisfied with your answer.
It has been asking this question since the room was created.
Nobody has answered correctly. The caterpillar does not say what correct looks like.

**The dialogue (sample):**
```
Who are you?
> I'm Alice.
That is not an answer.
Who are you?
> I'm a user of this platform.
That is also not an answer.
Who are you?
```

**Connection to ELIZA room:**
Both rooms ask questions that don't have satisfying answers.
ELIZA reflects your questions back. The caterpillar rejects your answers.
Together they form a complete picture of a system that cannot be satisfied.

Note this in both room files.

---

### Room: Jabberwocky

**Difficulty: Easy**
The Jabberwocky poem — but interactive. A room containing the text of the poem
where certain words are blanked out and the user can fill them in.
The blanked words are the nonsense words — vorpal, slithy, toves, gimble, wabe.

**The twist:**
Whatever word the user types in place of the nonsense word, it becomes the word
for that user permanently. Their version of the poem uses their words.
The poem is personal. The nonsense is replaced with their nonsense.

**Shared view:**
A secondary display shows the most common word chosen by all users for each blank.
*"72% of users chose 'sharp' for vorpal."*
The collective interpretation of nonsense is also on display.

**Legal note:** Jabberwocky (1871, Lewis Carroll) is public domain. Use freely.

---

### Room: Physics Engine Demo

**Difficulty: Easy–Medium**
A room containing a physics simulation. Boxes, balls, gravity, collision.
Interactive — you can add objects, change gravity, throw things.
A sandbox. No goal. No score. Just: physics happening.

**Implementation:**
Matter.js is a well-established JavaScript physics engine available on CDN.
Claude Code can build this in one session.

**Objects available:**
- Boxes (various sizes)
- Circles
- Triangles
- A ragdoll (humanoid figure with joints)
- Spring between two objects
- Gravity slider (0 to 2x, including negative)
- "Explode" button — random impulse to all objects

**The backrooms framing:**
*"The physics in this room follow standard rules.*
*This is noted because not all rooms do."*

---

### Room: Random Linux Man Page

**Difficulty: Trivial**
A room that displays a random Linux man page on each visit.
Man pages are public domain documentation. Hundreds of them.

The man page is displayed in its authentic terminal format — monospace, section headers,
the specific man page visual language. No context. No explanation of why this page.

**The selection:**
Curated list of man pages that are interesting, obscure, or thematically resonant.
Not just any man page — ones that read strangely without context.
Examples: `man true`, `man false`, `man yes`, `man sleep`, `man kill`, `man wall`,
`man more`, `man less`, `man cat`, `man head`, `man tail`, `man man`

`man man` — the man page for the man command itself. Recursive. Necessary.
`man true` — documents the command that does nothing and returns success.
`man false` — documents the command that does nothing and returns failure.
`man yes` — documents the command that prints "y" forever until stopped.

**Room description:**
*"A page has been selected.*
*You did not select it.*
*Read it anyway."*

---

### Room: The Illegal Prime

**Difficulty: Trivial — display only**

**The story (documented in full for the room):**

In 1999, a Norwegian teenager cracked DVD encryption (CSS — Content Scrambling System)
and released the code as DeCSS. The MPAA sued and won — distributing DeCSS became
illegal under the DMCA.

In March 2001, Phil Carmody generated a 1,401-digit prime number whose hexadecimal
representation forms a gzip-compressed version of the DeCSS C source code.
The number is prime. It is also, by the logic of the injunction, illegal to publish
in the United States — because it is a functional representation of the forbidden code.

Carmody subsequently produced in October 2001 a prime number that, when written
in binary, works as an executable x86 Linux program for DeCSS — an illegal,
executable prime.

**The room:**
The number is displayed. All 1,401 digits of it.
Below it, the story in brief. Clinical. Factual. No editorializing.

*"This is a number.*
*Numbers are not subject to copyright.*
*This number is also a compressed file.*
*Files can be subject to copyright.*
*The legal status of this number is unresolved.*
*The number is displayed here as a number.*
*Draw your own conclusions."*

**Legal note for Claude Code:**
Display the number and the factual historical account. Do not provide instructions
for using it as DeCSS. The room is about the concept, not the circumvention.
The number itself has been published in academic papers and widely reproduced.
The room documents a historical legal and mathematical curiosity.

**Connection to ASCII panel and invisible character rooms:**
This room is part of the cluster exploring the gap between what a thing IS
and what it REPRESENTS. A number that is also a program. A character that is
also invisible. A space that is also a non-breaking space. The platform keeps
returning to this question from different directions.

**Add to thematic references:**
The illegal prime connects to the platform's broader interest in things that
exist in the gap between categories — numbers that are also programs,
characters that are also instructions, spaces that are not spaces.

---

### Room: Compression Engine — Define Your Own Encoding

**Difficulty: Medium**

**The concept you remembered:**
Huffman coding — a lossless data compression algorithm invented by David Huffman in 1952.
The idea: assign shorter bit sequences to more frequent characters,
longer sequences to less frequent ones. The frequency determines the encoding.
More common = fewer bits. Less common = more bits. Total size decreases.

**What the room does:**

The user types or pastes a message. The room analyzes character frequencies.
It then shows:
- The original message in plain text
- The original message in raw binary (ASCII, 8 bits per character)
- The Huffman-optimized encoding for this specific message
- The compression ratio: "Original: 248 bits → Compressed: 147 bits → 40.7% smaller"

**The interactive part:**
The user can manually assign bit patterns to characters — override the automatic
Huffman assignment. Assign `0` to the letter E (most common in English).
Assign `111111` to the letter Z. See how it affects compression.
The room shows live bit count as you adjust assignments.

**The visual:**
Text view: the message in readable form
Binary view: each character shown as its bit pattern, color-coded by character
Compression view: the actual compressed bit string — a wall of 0s and 1s that
represents the same information in less space

**Show the tree:**
A simple tree diagram showing the Huffman tree for the input — which characters
are at which depth, why some get short codes and some get long ones.

**Connection to invisible character room and ASCII panel:**
All three rooms are about the gap between what you see and what is actually stored.
The invisible character room: characters that look like nothing but are something.
The ASCII panel: the binary representation of every character.
The compression room: how that binary can be reorganized to say the same thing
in fewer bits.

Together: a trilogy about the nature of representation.

Note this connection in all three room files.

**Difficulty note for Claude Code:**
Huffman coding is a well-understood algorithm. Claude Code can implement it cleanly
in ~100 lines of JS. The visualization is the interesting part — show the tree,
show the bits, show the savings. Make the compression visible.

---

### Title pool additions from batch 2

```
GAME OVER
Insert Coin
Come Back Tomorrow
The Black Hole Is Open
Some Rooms Cannot Be Found By Looking
Who Are You
That Is Not An Answer
Vorpal
Slithy Toves
Jabberwocky
The Physics Are Standard Here
man man
man true
man false
man yes
This Number Is Prime
This Number Is Also A Program
Original: 248 bits
Compressed: 147 bits
40.7% Smaller
The Smile Remains
We Are All Mad Here
Bigger On The Inside
```

Total title pool: ~261 + 22 = **~283 titles**

---

---

## Part 17 — Room Ideas Batch 3: Math, Science, and Paradox Rooms

---

### Room: Prime Number Generator (upgraded from Illegal Prime room)

**Difficulty: Easy**

The room accepts a number N and returns the Nth prime.
Type any number. Get the prime. Fast, clean, no upper limit on request
(within reason — very large N may take a moment, show a spinner).

**The special case: N = 1,401**

When the user requests the 1,401st prime, the room delivers it — and then
pauses. Below the number, the room adds:

*"You have just requested the 1,401st prime number.*
*In March 2001, Phil Carmody generated a 1,401-digit prime number.*
*When written in hexadecimal, it forms a gzip-compressed version of DeCSS —*
*software used to decrypt DVD encryption.*
*That number was, by some legal interpretations, illegal to publish.*
*The number you just received is not that number.*
*The number you just received is simply the 1,401st prime.*
*The coincidence of 1,401 digits and 1,401st prime is noted.*
*Both are numbers. Numbers are not subject to copyright.*
*The facility takes no position on this."*

Then, below that, in small text:
*"The illegal prime, for reference, is 1,401 digits long.*
*Its first few digits are: 48565...*
*The facility will not reproduce it in full.*
*It has been reproduced elsewhere. You can find it.*
*The facility is simply noting that it exists."*

**Other notable primes to acknowledge:**
- N = 1: *"2. The only even prime. Unique among its kind."*
- N = 2: *"3. Prime."*
- N = 1,000: *"7,919. The 1,000th prime."*
- Any prime that is also a palindrome: note it
- Any prime N where N itself is prime: note it (*"You requested a prime-numbered prime."*)
- N = 31,337 (hacker leet): note it quietly

**Display format:**
The number large and centered. Below it: its position, whether it's special,
any interesting properties. Clean. Monospace. Dark terminal aesthetic.

---

### Room: Monty Hall — Three Doors

**Difficulty: Easy**
The classic probability puzzle. Three doors. One car. Two goats.
You pick a door. The host opens one of the other doors to reveal a goat.
Do you switch or stay?

**The interactive game:**
1. Three doors displayed. You click one.
2. Host opens another door — always one with a goat, never your door, never the car.
3. You choose: stay or switch.
4. Result revealed.
5. Run it again immediately.

**The statistics panel:**
After several games, show running statistics:
- Times you stayed: X wins, Y losses (win rate %)
- Times you switched: X wins, Y losses (win rate %)
- The mathematics: switching wins 2/3 of the time. Staying wins 1/3 of the time.
- The room confirms the math as the player's own data accumulates.

**The explanation (shown after first 10 games):**
Brief, clear. Why switching is correct. The counterintuitive logic.
Most people's intuition says 50/50. The math says 2:1 in favor of switching.
The room lets you discover this through play before explaining it.

**The backrooms note:**
*"You have been presented with three doors.*
*One of them contains what you want.*
*The rules of this room are mathematically provable.*
*Not all rooms can say that."*

---

### Room: Galton Board — Normal Distribution Demo

**Difficulty: Easy–Medium**
An animated Galton board (bean machine / quincunx).
Balls drop through a triangular array of pegs, bouncing left or right at each peg,
accumulating in bins at the bottom. The result: a normal distribution emerges
from purely random binary choices.

**Interactive controls:**
- Drop speed: slow / medium / fast / instant
- Ball count: drop 1, drop 10, drop 100, drop 1,000
- Reset
- Show expected normal curve overlay: toggle

**What it teaches:**
The normal distribution is not imposed — it emerges from randomness.
Any process that is the sum of many small independent random events
produces a bell curve. Height, test scores, measurement errors —
all emerge from this mechanism.

**The display:**
The pegs arranged in a triangle. Balls animated falling and bouncing.
Bins at the bottom filling up. The shape of the bins matches the bell curve
more closely as more balls fall.

**The room note:**
*"No ball is told where to go.*
*Each ball makes random choices.*
*The shape that emerges was inevitable.*
*This is called the Central Limit Theorem.*
*It applies to more things than you would expect."*

**Connection to PRNG room (below):**
Both rooms are about randomness. The Galton board shows what true randomness
produces at scale. The PRNG room shows what computers approximate as randomness.
Note this connection in both room files.

---

### Room: PRNG vs True RNG — Side by Side

**Difficulty: Medium**

Two columns. Left: Pseudo-Random Number Generator (PRNG).
Right: True Random Number Generator (TRNG, from atmospheric noise or similar).
Both generating numbers in real time. Side by side.

**What PRNGs are:**
Deterministic algorithms that produce sequences that *look* random but aren't.
Given the same seed, they produce the same sequence every time. Completely predictable
if you know the algorithm and seed. Used in: every game, every simulation,
most cryptography.

**What TRNGs are:**
Numbers derived from physical randomness — atmospheric noise, quantum decay,
thermal noise. Actually unpredictable. Not deterministic.
Source for this room: random.org API or the Web Crypto API (`crypto.getRandomValues`).

**The visualization:**
Both columns generate a stream of numbers. Also show:
- A bitmap of the bits — random bits should look like static noise, not patterns
- A histogram of values — should be flat (uniform distribution)
- A scatter plot of sequential pairs — should show no structure

PRNGs look identical to TRNGs in all these tests. That is the point.
The room demonstrates that you cannot tell them apart visually.

**The twist:**
Show the PRNG seed. Show that entering the same seed produces the same sequence.
Run the PRNG twice with the same seed — identical output, side by side.
The TRNG cannot be reproduced. The PRNG can be reproduced exactly.
Same output. Different nature. Indistinguishable appearance.

**The room note:**
*"Both sequences look random.*
*One of them is.*
*The other is completely predictable to anyone who knows the seed.*
*You are looking at both.*
*You cannot tell which is which.*
*The facility will not tell you."*

Then, below: it does tell you. Left is PRNG. Right is TRNG.
But the visual remains indistinguishable. Knowing doesn't help you see it.

---

### Room: The Visible Spectrum + Non-Spectral Colors

**Difficulty: Medium**

**Part 1 — The spectrum:**
A visualization of the visible spectrum — violet (380nm) to red (700nm).
Clean, accurate. The rainbow rendered as a continuous gradient.
Below each color: its wavelength in nanometers.
A slider lets the user move along the spectrum and see the wavelength.

**Part 2 — The gap:**
The spectrum displayed as a line. Red at one end. Violet at the other.
Between them — a gap. Where does the spectrum wrap?
On a wheel: red and violet are next to each other.
On a line: they are the two ends, and between them sits a color that doesn't exist
as a wavelength: magenta.

Magenta is a mix between purple and red — but on the spectrum, the colors between purple and red are yellow, green, blue, orange. Magenta doesn't exist on the spectrum.

Magenta is not perceived as part of the spectrum. When we see a vivid magenta source, light from both ends of the spectrum enters our eyes simultaneously. The brain invents the color magenta as its best guess.

**Part 3 — Non-spectral colors interactive:**
A palette of non-spectral colors with controls:
- Magenta / purples / pinks — mixtures of red and violet with no single wavelength
- Brown — dark orange/red, never appears in a rainbow
- White — all wavelengths simultaneously
- Black — absence of light (not a color of light at all)

For each: explanation of why it's non-spectral. What wavelengths produce it.
How the brain constructs it from cone cell signals.

**The interactive element:**
Mix sliders for R, G, B. Show which combinations produce spectral vs non-spectral colors.
Show the chromaticity diagram — the horseshoe shape with the "line of purples" across the
straight edge closing the shape. All colors inside the horseshoe. The line of purples
is the boundary of non-spectral colors.

**The room note:**
*"The colors on this spectrum exist as wavelengths of light.*
*The colors below it do not.*
*Your brain invented them.*
*You can see them.*
*They are real.*
*They just don't exist in the spectrum.*
*This is considered normal."*

**Add to thematic references:** Non-spectral colors / the line of purples — a category
of things that are real but have no physical basis as single wavelengths. The brain
constructs them. Magenta doesn't exist as a wavelength but you're looking at it right now.
Parallel to the platform's broader interest in things that exist in the gap between categories.

---

### Rooms: Paradox Collection

Multiple rooms. Each documents one paradox — explanation, interactive demo where possible,
and the question the paradox raises without resolving it. The platform takes no position.

**Paradox Room A — Monty Hall** (already specced above as standalone)

**Paradox Room B — Zeno's Paradox (Achilles and the Tortoise)**
Achilles gives the tortoise a head start. To overtake it, he must first reach where it was.
By then it has moved. He must reach that new position. By then it has moved again.
Infinite steps. He never catches up. Except he does.

Interactive: animate Achilles and the tortoise. Show the infinite sum converging to a
finite value. The paradox dissolves with calculus. But the intuition that produced it
— that infinite steps cannot complete — persists.

*"An infinite number of steps can take a finite amount of time.*
*This was not obvious.*
*It required calculus to prove.*
*The paradox is resolved.*
*The unease it produces is not."*

**Paradox Room C — The Bootstrap Paradox (Causal Loop)**
You travel back in time and give Shakespeare his plays. He copies them. He becomes famous.
You read his plays in the future. You travel back to give them to him.
Where did the plays come from? They have no origin.

Interactive: a diagram of the causal loop. Click any node to ask "where did this come from?"
The answer always points to another node. The loop has no beginning.

*"The information exists.*
*It has always existed in this loop.*
*It was never created.*
*This is called a bootstrap paradox.*
*The facility notes it without resolving it."*

**Paradox Room D — Ship of Theseus**
Every plank of a ship is replaced over time. Is it the same ship?
If the original planks are collected and reassembled — which is the real ship?

Interactive: a slider from 0% to 100% replacement. At what percentage does it stop
being the same ship? The user sets the threshold. The room notes their answer.
Aggregate: "X% of users say the ship changes identity at 50% replacement."

*"You have set the threshold.*
*The threshold has been noted.*
*The ship does not know about the threshold.*
*The ship continues to be repaired."*

**Paradox Room E — The Grandfather Paradox**
If you travel back in time and prevent your own birth, you were never born, so you
couldn't travel back, so you were born, so you could travel back, so you prevent it...

Interactive: a simple diagram of the loop. A button: "Kill grandfather." The button
causes the button to disappear. Then reappear. Then disappear. The loop runs visually.

*"This action cannot be completed.*
*This action has been completed.*
*Both statements are correct.*
*The facility does not offer time travel.*
*This room is purely theoretical.*
*Mostly."*

**Paradox Room F — Banach-Tarski**
A solid ball can be decomposed into a finite number of disjoint subsets that can be put back together in a different way to yield two identical copies of the original ball. One ball becomes two. Same size. No stretching.

This is mathematically proven. It is also physically impossible.
The paradox reveals something about the nature of infinity and non-measurable sets.

Interactive: a simple visualization — a sphere that splits into pieces and reassembles
into two spheres. Purely illustrative (the actual decomposition is non-constructible).

*"Mathematics proves this is possible.*
*Physics says it is not.*
*Both are correct in their own domains.*
*The ball is presented here for your consideration.*
*Please do not attempt to decompose it."*

**Paradox Room G — Russell's Paradox / The Barber**
A barber shaves all men who do not shave themselves.
Does the barber shave himself?
If yes: he shaves men who don't shave themselves, so he shouldn't.
If no: he doesn't shave himself, so he should.

This paradox broke early set theory. Russell discovered it while trying to build
a foundation for all of mathematics. The result: mathematics had to be rebuilt.

*"This question has no answer.*
*The question was asked by Bertrand Russell in 1901.*
*It required a new foundation for mathematics to resolve.*
*The barber still has not shaved.*
*The barber is fine."*

**Paradox Room H — The Sorites Paradox (Heap)**
One grain of sand is not a heap. Adding one grain to a non-heap doesn't make a heap.
Therefore: no number of grains is a heap. Yet clearly a million grains is a heap.

Interactive: a pile of sand pixels, one grain added at a time. A button: "Is this a heap?"
The user clicks when they think it becomes a heap. Their threshold is recorded.
Aggregate data shown: the distribution of when users said "heap."

*"You identified the threshold at N grains.*
*Others disagreed.*
*The grain does not know it is in a heap.*
*The heap does not know it is a heap.*
*Language does not resolve this.*
*Mathematics does not resolve this.*
*Adding one more grain."*

---

### Title pool additions from batch 3

```
The 1401st Prime
Switching Wins
The Ball Becomes Two Balls
Achilles Has Not Caught The Tortoise
The Plays Have No Origin
The Barber Has Not Shaved
Adding One More Grain
Is This A Heap
Both Sequences Look Random
The Brain Invented This Color
Magenta Does Not Exist
You Can See It Anyway
The Normal Distribution Was Inevitable
The Seed Is Known
```

Total title pool: ~283 + 14 = **~297 titles**

---
