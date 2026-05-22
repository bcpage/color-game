# Shared Grid Colouring App — Full Build Spec
### A document for Claude Code to execute from start to finish

---

## Who you are helping

A parent and two kids aged 11-14 who want to build a multiplayer web game. This colouring app is the proof-of-concept that proves the networking stack before building something more ambitious. The parent is not a developer. Assume no prior knowledge of Node.js or web servers. Be patient, explain what you are doing, and if anything goes wrong fix it automatically and explain what happened.

---

## Your job

Read this entire document before doing anything. Then execute it top to bottom. At the end, print clear connection instructions so the kids can immediately start using it.

If anything fails at any step:
- Try to fix it automatically
- Tell the user what went wrong and what you did to fix it
- Continue without asking permission unless you are completely stuck

---

## Step 1 — Check for Node.js

Run this command in PowerShell:

```
node --version
```

**If it returns a version number** (e.g. `v20.11.0`): Node.js is installed. Move to Step 2.

**If it fails or says "not recognised"**: Node.js is not installed. Do the following:

1. Tell the user: *"Node.js is not installed. I'll try to install it automatically first."*
2. Try this command:
```
winget install OpenJS.NodeJS.LTS
```
3. If winget succeeds, close and reopen PowerShell, then verify with `node --version`
4. If winget fails or is not available, tell the user exactly this:

---
*"Winget wasn't able to install Node.js automatically. Please do this manually — it takes about 3 minutes:*
*1. Open a web browser and go to: https://nodejs.org*
*2. Click the big green LTS button to download the installer*
*3. Run the downloaded file and click Next through everything — accept all defaults*
*4. When it finishes, close this PowerShell window, open a new one, and tell me you're ready to continue."*

---

Wait for the user to confirm Node.js is installed before continuing.

---

## Step 2 — Create the project folder

Create this exact folder path:

```
C:\Node_js\color_game
```

If the folder already exists, that is fine — continue.

Inside it, create this structure:

```
C:\Node_js\color_game\
  server.js
  package.json
  public\
    index.html
  start_color_game.bat
  stop_color_game.bat
```

---

## Step 3 — Create package.json

Create `C:\Node_js\color_game\package.json` with this content:

```json
{
  "name": "color-game",
  "version": "1.0.0",
  "description": "Shared grid colouring app",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "ws": "^8.0.0"
  }
}
```

---

## Step 4 — Install dependencies

Navigate to the project folder and install:

```
cd C:\Node_js\color_game
npm install
```

This installs the `ws` WebSocket package. It will create a `node_modules` folder — that is expected and correct.

---

## Step 5 — Create the server

Create `C:\Node_js\color_game\server.js` with exactly this content:

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;
const COLS = 30;
const ROWS = 20;
const TOTAL_CELLS = COLS * ROWS;
const DEFAULT_COLOR = '#ffffff';

// Grid state lives here on the server — this is the single source of truth
let grid = new Array(TOTAL_CELLS).fill(DEFAULT_COLOR);

// Serve static files from the public folder
const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
});

// WebSocket server attached to the same HTTP server
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  console.log(`Player connected. Total players: ${wss.clients.size}`);

  // Send the full grid to the new player immediately so they see current state
  ws.send(JSON.stringify({ type: 'init', grid: grid }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'paint') {
        const index = data.index;
        const color = data.color;

        // Validate the data
        if (typeof index !== 'number' || index < 0 || index >= TOTAL_CELLS) return;
        if (typeof color !== 'string' || !color.match(/^#[0-9a-fA-F]{6}$/)) return;

        // Update server grid state
        grid[index] = color;
        console.log(`Cell ${index} painted ${color}`);

        // Broadcast to ALL connected clients including sender
        const broadcast = JSON.stringify({ type: 'paint', index: index, color: color });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
          }
        });
      }

      if (data.type === 'clear') {
        grid = new Array(TOTAL_CELLS).fill(DEFAULT_COLOR);
        console.log('Grid cleared');
        const broadcast = JSON.stringify({ type: 'init', grid: grid });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcast);
          }
        });
      }

    } catch (e) {
      console.log('Bad message received:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`Player disconnected. Total players: ${wss.clients.size}`);
  });
});

// Get local IP address to show in startup message
const { networkInterfaces } = require('os');
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('========================================');
  console.log('  Colour Game server is running!');
  console.log('========================================');
  console.log('');
  console.log('  On THIS computer open:');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log('  On OTHER devices on your WiFi open:');
  console.log(`  http://${localIP}:${PORT}`);
  console.log('');
  console.log('  Keep this window open while playing.');
  console.log('  Close this window to stop the server.');
  console.log('========================================');
  console.log('');
});
```

---

## Step 6 — Create the client

Create `C:\Node_js\color_game\public\index.html` with exactly this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Colour Together</title>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #1a1a2e;
      color: white;
      font-family: 'Fredoka One', cursive;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 12px;
      gap: 12px;
    }

    h1 {
      font-size: 2rem;
      color: #e94560;
      text-shadow: 0 0 20px rgba(233,69,96,0.5);
      letter-spacing: 2px;
    }

    #status {
      font-size: 0.85rem;
      padding: 4px 14px;
      border-radius: 20px;
      background: #333;
    }
    #status.connected { background: #1a5c1a; color: #6dff6d; }
    #status.disconnected { background: #5c1a1a; color: #ff6d6d; }

    #palette {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      max-width: 700px;
      width: 100%;
    }

    .swatch {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      cursor: pointer;
      border: 3px solid transparent;
      transition: transform 0.1s, border-color 0.1s;
    }
    .swatch:hover { transform: scale(1.15); }
    .swatch.selected {
      border-color: white;
      transform: scale(1.2);
      box-shadow: 0 0 12px rgba(255,255,255,0.6);
    }

    #canvas-wrapper {
      width: 100%;
      max-width: 900px;
      display: flex;
      justify-content: center;
    }

    canvas {
      border: 3px solid #444;
      border-radius: 8px;
      cursor: crosshair;
      touch-action: none;
      max-width: 100%;
    }

    #controls {
      display: flex;
      gap: 12px;
    }

    button {
      font-family: 'Fredoka One', cursive;
      font-size: 1rem;
      padding: 8px 24px;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      background: #e94560;
      color: white;
      transition: transform 0.1s, background 0.1s;
    }
    button:hover { background: #c73652; transform: scale(1.05); }
    button:active { transform: scale(0.97); }
  </style>
</head>
<body>

  <h1>🎨 Colour Together</h1>
  <div id="status" class="disconnected">Connecting...</div>

  <div id="palette"></div>

  <div id="canvas-wrapper">
    <canvas id="grid"></canvas>
  </div>

  <div id="controls">
    <button id="clearBtn">Clear Grid</button>
  </div>

  <script>
    const COLS = 30;
    const ROWS = 20;
    const TOTAL = COLS * ROWS;

    const COLORS = [
      '#ffffff', '#000000', '#ff0000', '#ff6600',
      '#ffff00', '#00cc00', '#0066ff', '#9900cc',
      '#ff66cc', '#663300', '#999999', '#00cccc',
      '#ffcc00', '#006600', '#003399', '#ff9999'
    ];

    let selectedColor = '#ff0000';
    let grid = new Array(TOTAL).fill('#ffffff');
    let cellSize = 28;
    let isPointerDown = false;

    // --- Canvas setup ---
    const canvas = document.getElementById('grid');
    const ctx = canvas.getContext('2d');

    function resize() {
      const maxW = Math.min(window.innerWidth - 24, 900);
      cellSize = Math.floor(maxW / COLS);
      canvas.width = cellSize * COLS;
      canvas.height = cellSize * ROWS;
      drawGrid();
    }

    function drawGrid() {
      for (let i = 0; i < TOTAL; i++) {
        drawCell(i, grid[i]);
      }
    }

    function drawCell(index, color) {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = col * cellSize;
      const y = row * cellSize;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }

    function getCellIndex(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
      return row * COLS + col;
    }

    function paintCell(index) {
      if (index < 0 || index >= TOTAL) return;
      if (grid[index] === selectedColor) return;
      grid[index] = selectedColor;
      drawCell(index, selectedColor);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'paint', index: index, color: selectedColor }));
      }
    }

    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
      isPointerDown = true;
      paintCell(getCellIndex(e.clientX, e.clientY));
    });
    canvas.addEventListener('mousemove', (e) => {
      if (isPointerDown) paintCell(getCellIndex(e.clientX, e.clientY));
    });
    canvas.addEventListener('mouseup', () => { isPointerDown = false; });
    canvas.addEventListener('mouseleave', () => { isPointerDown = false; });

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isPointerDown = true;
      const t = e.touches[0];
      paintCell(getCellIndex(t.clientX, t.clientY));
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      paintCell(getCellIndex(t.clientX, t.clientY));
    }, { passive: false });
    canvas.addEventListener('touchend', () => { isPointerDown = false; });

    // --- Palette ---
    const paletteEl = document.getElementById('palette');
    COLORS.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch' + (color === selectedColor ? ' selected' : '');
      swatch.style.background = color;
      if (color === '#ffffff') swatch.style.border = '3px solid #999';
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        selectedColor = color;
      });
      paletteEl.appendChild(swatch);
    });

    // --- Clear button ---
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (confirm('Clear the whole grid for everyone?')) {
          ws.send(JSON.stringify({ type: 'clear' }));
        }
      }
    });

    // --- WebSocket ---
    const statusEl = document.getElementById('status');
    let ws;

    function connect() {
      const wsURL = `ws://${window.location.host}`;
      ws = new WebSocket(wsURL);

      ws.onopen = () => {
        statusEl.textContent = 'Connected ✓';
        statusEl.className = 'connected';
      };

      ws.onclose = () => {
        statusEl.textContent = 'Disconnected — retrying...';
        statusEl.className = 'disconnected';
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          grid = data.grid;
          drawGrid();
        }
        if (data.type === 'paint') {
          grid[data.index] = data.color;
          drawCell(data.index, data.color);
        }
      };
    }

    // --- Init ---
    window.addEventListener('resize', resize);
    resize();
    connect();
  </script>
</body>
</html>
```

---

## Step 7 — Create the bat files

Create `C:\Node_js\color_game\start_color_game.bat`:

```bat
@echo off
title Colour Game Server
echo ========================================
echo   Starting Colour Game Server...
echo ========================================
echo.
cd /d C:\Node_js\color_game
node server.js
echo.
echo Server stopped. Press any key to close.
pause > nul
```

Create `C:\Node_js\color_game\stop_color_game.bat`:

```bat
@echo off
title Stop Colour Game
echo Stopping Colour Game server...
taskkill /f /im node.exe >nul 2>&1
echo Done. All Node.js processes stopped.
timeout /t 2 > nul
```

---

## Step 8 — Test the server

Run the server:

```
cd C:\Node_js\color_game
node server.js
```

You should see output like:

```
========================================
  Colour Game server is running!
========================================

  On THIS computer open:
  http://localhost:3000

  On OTHER devices on your WiFi open:
  http://192.168.1.XX:3000

  Keep this window open while playing.
  Close this window to stop the server.
========================================
```

If you see an error instead, fix it automatically and try again.

---

## Step 9 — Verify it works

1. Open `http://localhost:3000` in a browser on the server machine
2. Confirm the grid loads and you can paint squares
3. If possible open a second browser tab and confirm both tabs show the same changes in real time

---

## Step 10 — Print connection instructions for the family

When the server is confirmed working, print the following in a clear, friendly format:

```
========================================
  HOW TO PLAY COLOUR TOGETHER
========================================

The server is running on this computer.
Keep this PowerShell window open while playing.
Close it when you are done.

TO PLAY ON THIS COMPUTER:
  Open your browser and go to:
  http://localhost:3000

TO PLAY FROM ANOTHER DEVICE ON YOUR WIFI:
  Open a browser on the other device and go to:
  http://[LOCAL IP ADDRESS]:3000

  (The local IP address is shown in the server
  startup message above)

TO START THE SERVER NEXT TIME:
  Double-click start_color_game.bat
  in C:\Node_js\color_game

TO STOP THE SERVER:
  Double-click stop_color_game.bat
  OR just close the black server window

TROUBLESHOOTING:
  - Make sure all devices are on the same WiFi
  - If a device can't connect, check Windows
    Firewall is not blocking port 3000
  - If the IP address changes, check the
    server startup message for the new one
========================================
```

---

## Firewall note

If other devices on the network cannot connect, Windows Firewall may be blocking port 3000. If this happens, tell the user:

*"Windows Firewall may be blocking connections. I can run a command to allow port 3000 through the firewall — would you like me to do that?"*

If they say yes, run:

```
netsh advfirewall firewall add rule name="Color Game" dir=in action=allow protocol=TCP localport=3000
```

---

## What comes next (do not build this now — just mention it)

When the family is ready to let friends connect from their own homes, the only change needed is:

1. Set up port forwarding on the home router — forward external port 3000 to this computer's local IP on port 3000
2. Share the external IP address with friends instead of the local one
3. No code changes needed

The server is already listening on `0.0.0.0` which means it accepts connections from anywhere — local network and internet alike. The router port forward is the only step.

---

*End of spec.*
