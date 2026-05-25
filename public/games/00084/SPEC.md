# Room 00084 — The Intercom

## What it is
A one-way PA system. Type a message and broadcast it to every currently connected unit in the facility. You will not know if anyone received it.

## Mechanic
WebSocket connection with a retro intercom panel aesthetic. Grille animation plays on both send and receive. Incoming broadcasts appear as a full-width banner overlay for 6 seconds then fade. The sender gets no acknowledgment — only the indicator LED pulses briefly.

## Navigation
- data-nav: matrix
- Connections: 00083 ← → 00085

## Server
WebSocket handler: game === 'intercom', type === 'send'
Broadcasts: { game: 'intercom', type: 'broadcast', text }
No persistence — messages exist only for currently connected clients.

## Notes
- Enter key sends (Shift+Enter for newline not needed — no newlines in broadcast)
- 200 character limit
- No message history — if nobody is connected, the message is lost
