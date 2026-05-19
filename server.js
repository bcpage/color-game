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
  const SKIP = /virtualbox|vmware|vethernet|loopback|hyper-v/i;
  for (const name of Object.keys(nets)) {
    if (SKIP.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.')) {
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
