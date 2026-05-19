const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { networkInterfaces } = require('os');

const PORT = 3000;

// ─── Game registry ────────────────────────────────────────────────────────────
const GAMES = ['00001', '00002'];

// ─── Cookie persistence ───────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const COOKIE_FILE = path.join(DATA_DIR, 'cookie.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let cookieCount = 0;
try { cookieCount = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')).count || 0; } catch (e) {}
function saveCookie() { fs.writeFileSync(COOKIE_FILE, JSON.stringify({ count: cookieCount })); }

// ─── Colour game state ────────────────────────────────────────────────────────
const COLS = 30, ROWS = 20, TOTAL_CELLS = COLS * ROWS;
let grid = new Array(TOTAL_CELLS).fill('#ffffff');

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function sendJSON(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function mimeFor(filePath) {
  const ext = path.extname(filePath);
  return { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' }[ext] || 'text/plain';
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  const method = req.method;

  // Root → redirect to first game
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(302, { Location: '/game/00001' });
    res.end();
    return;
  }

  // Game pages: /game/00001
  const gameMatch = pathname.match(/^\/game\/(\d+)$/);
  if (gameMatch && method === 'GET') {
    const id = gameMatch[1].padStart(5, '0');
    if (!GAMES.includes(id)) { res.writeHead(404); res.end('Game not found'); return; }
    serveFile(res, path.join(__dirname, 'public', 'games', id + '.html'), 'text/html');
    return;
  }

  // Shared static files: /shared/nav.js etc.
  if (pathname.startsWith('/shared/') && method === 'GET') {
    serveFile(res, path.join(__dirname, 'public', pathname), mimeFor(pathname));
    return;
  }

  // API: list of games
  if (pathname === '/api/games' && method === 'GET') {
    sendJSON(res, GAMES);
    return;
  }

  // API: get cookie count
  if (pathname === '/api/cookie' && method === 'GET') {
    sendJSON(res, { count: cookieCount });
    return;
  }

  // API: click cookie
  if (pathname === '/api/cookie/click' && method === 'POST') {
    cookieCount++;
    saveCookie();
    sendJSON(res, { count: cookieCount });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ─── WebSocket (colour game) ──────────────────────────────────────────────────
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  console.log(`Player connected. Total: ${wss.clients.size}`);
  ws.send(JSON.stringify({ type: 'init', grid }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'paint') {
        const { index, color } = data;
        if (typeof index !== 'number' || index < 0 || index >= TOTAL_CELLS) return;
        if (typeof color !== 'string' || !color.match(/^#[0-9a-fA-F]{6}$/)) return;
        grid[index] = color;
        broadcast({ type: 'paint', index, color });
      }
      if (data.type === 'clear') {
        grid = new Array(TOTAL_CELLS).fill('#ffffff');
        broadcast({ type: 'init', grid });
      }
    } catch (e) {}
  });

  ws.on('close', () => console.log(`Player disconnected. Total: ${wss.clients.size}`));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

// ─── Start ────────────────────────────────────────────────────────────────────
function getLocalIP() {
  const SKIP = /virtualbox|vmware|vethernet|loopback|hyper-v/i;
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (SKIP.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.')) return net.address;
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('========================================');
  console.log('  Game server is running!');
  console.log('========================================');
  console.log('');
  console.log('  On THIS computer open:');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log('  On OTHER devices on your WiFi open:');
  console.log(`  http://${ip}:${PORT}`);
  console.log('');
  console.log('  Keep this window open while playing.');
  console.log('  Close this window to stop the server.');
  console.log('========================================');
  console.log('');
});
