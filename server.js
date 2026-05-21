const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { networkInterfaces } = require('os');

const PORT = 3000;

// ─── Game registry ────────────────────────────────────────────────────────────
const GAMES = ['00001', '00002', '00003', '00004', '00005', '00006', '00007', '00008', '00009', '00010', '00011', '00012', '00013', '00014', '00015', '00016', '00017'];

// ─── Cookie persistence ───────────────────────────────────────────────────────
const COOKIE_DATA_DIR = path.join(__dirname, 'public', 'games', '00002', 'data');
const COOKIE_FILE = path.join(COOKIE_DATA_DIR, 'cookie.json');
if (!fs.existsSync(COOKIE_DATA_DIR)) fs.mkdirSync(COOKIE_DATA_DIR, { recursive: true });

// ─── Recordings persistence ───────────────────────────────────────────────────
const REC_DATA_DIR = path.join(__dirname, 'public', 'games', '00008', 'data');
const REC_DIR  = path.join(REC_DATA_DIR, 'recordings');
const REC_META = path.join(REC_DATA_DIR, 'recordings.json');
if (!fs.existsSync(REC_DIR)) fs.mkdirSync(REC_DIR, { recursive: true });
let recordings = [];
try { recordings = JSON.parse(fs.readFileSync(REC_META, 'utf8')); } catch (e) {}
function saveRecMeta() { fs.writeFileSync(REC_META, JSON.stringify(recordings)); }
const REC_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per clip
const REC_MAX_CLIPS = 50;

let cookieCount = 0;
try { cookieCount = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')).count || 0; } catch (e) {}
function saveCookie() { fs.writeFileSync(COOKIE_FILE, JSON.stringify({ count: cookieCount })); }

// ─── Snake leaderboard ───────────────────────────────────────────────────────
const SNAKE_DATA_DIR = path.join(__dirname, 'public', 'games', '00015', 'data');
const SNAKE_FILE = path.join(SNAKE_DATA_DIR, 'scores.json');
if (!fs.existsSync(SNAKE_DATA_DIR)) fs.mkdirSync(SNAKE_DATA_DIR, { recursive: true });
let snakeScores = [];
try { snakeScores = JSON.parse(fs.readFileSync(SNAKE_FILE, 'utf8')); } catch (e) {}
function saveSnake() { fs.writeFileSync(SNAKE_FILE, JSON.stringify(snakeScores)); }

// ─── 52! card shuffle counter ────────────────────────────────────────────────
const CARD_DATA_DIR = path.join(__dirname, 'public', 'games', '00014', 'data');
const CARD_FILE = path.join(CARD_DATA_DIR, 'cards.json');
if (!fs.existsSync(CARD_DATA_DIR)) fs.mkdirSync(CARD_DATA_DIR, { recursive: true });
let cardData = { count: 0, lastShuffle: null };
try { cardData = JSON.parse(fs.readFileSync(CARD_FILE, 'utf8')); } catch (e) {}
function saveCards() { fs.writeFileSync(CARD_FILE, JSON.stringify(cardData)); }
function freshShuffle() {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ─── Ticket dispenser ────────────────────────────────────────────────────────
const TICKET_DATA_DIR = path.join(__dirname, 'public', 'games', '00011', 'data');
const TICKET_FILE = path.join(TICKET_DATA_DIR, 'tickets.json');
if (!fs.existsSync(TICKET_DATA_DIR)) fs.mkdirSync(TICKET_DATA_DIR, { recursive: true });
let ticketData = { next: 1, issued: {} };
try { ticketData = JSON.parse(fs.readFileSync(TICKET_FILE, 'utf8')); } catch (e) {}
function saveTickets() { fs.writeFileSync(TICKET_FILE, JSON.stringify(ticketData)); }

function getDeviceId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)device=([a-f0-9-]{36})/);
  return match ? match[1] : null;
}

// ─── Tic Tac Toe state ───────────────────────────────────────────────────────
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
let tttBoard = Array(9).fill(null);
let tttTurn = 'X';
let tttStatus = 'playing';
let tttWinner = null;
let tttWinLine = null;
let tttResetTimer = null;

function tttCheck(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line };
  }
  if (board.every(c => c !== null)) return { draw: true };
  return null;
}

function tttStateMsg() {
  return { game: 'ttt', type: 'state', board: tttBoard, turn: tttTurn, status: tttStatus, winner: tttWinner, winLine: tttWinLine };
}

function tttReset() {
  tttBoard = Array(9).fill(null);
  tttTurn = 'X';
  tttStatus = 'playing';
  tttWinner = null;
  tttWinLine = null;
  broadcast(tttStateMsg());
}

// ─── Pong ─────────────────────────────────────────────────────────────────────
const PW = 800, PH = 500;
const PAD_H = 80, PAD_X = 18, PAD_SPD = 7;
const BALL_R = 8, BALL_SPD0 = 5, BALL_MAX = 13, PONG_WIN = 7;

function freshPong() {
  return { ball: { x:PW/2, y:PH/2, vx:0, vy:0 }, pad: [PH/2, PH/2], dir: [0,0], score: [0,0], status: 'idle', winner: null };
}
let pong = freshPong();

function pongStateMsg() {
  return { game:'pong', type:'state', ball:pong.ball, pad:pong.pad, score:pong.score, status:pong.status, winner:pong.winner };
}
function broadcastPong() { broadcast(pongStateMsg()); }

function pongServe() {
  const a = (Math.random()*50 - 25) * Math.PI/180;
  const s = Math.random() < 0.5 ? 1 : -1;
  pong.ball = { x:PW/2, y:PH/2, vx: s*BALL_SPD0*Math.cos(a), vy: BALL_SPD0*Math.sin(a) };
  pong.status = 'playing';
  broadcastPong();
}

setInterval(() => {
  if (pong.status !== 'playing') return;
  pong.pad[0] = Math.max(PAD_H/2, Math.min(PH-PAD_H/2, pong.pad[0] + pong.dir[0]*PAD_SPD));
  pong.pad[1] = Math.max(PAD_H/2, Math.min(PH-PAD_H/2, pong.pad[1] + pong.dir[1]*PAD_SPD));
  pong.ball.x += pong.ball.vx;
  pong.ball.y += pong.ball.vy;
  if (pong.ball.y - BALL_R < 0)  { pong.ball.y = BALL_R;      pong.ball.vy =  Math.abs(pong.ball.vy); }
  if (pong.ball.y + BALL_R > PH) { pong.ball.y = PH - BALL_R; pong.ball.vy = -Math.abs(pong.ball.vy); }
  function padBounce(pi, facingLeft) {
    const px = facingLeft ? PAD_X : PW - PAD_X;
    const hit = facingLeft ? (pong.ball.vx < 0 && pong.ball.x - BALL_R <= px)
                           : (pong.ball.vx > 0 && pong.ball.x + BALL_R >= px);
    if (!hit) return;
    if (Math.abs(pong.ball.y - pong.pad[pi]) >= PAD_H/2 + BALL_R) return;
    const rel = (pong.ball.y - pong.pad[pi]) / (PAD_H/2);
    const ang = Math.max(-65, Math.min(65, rel*65)) * Math.PI/180;
    const spd = Math.min(Math.hypot(pong.ball.vx, pong.ball.vy) * 1.06, BALL_MAX);
    pong.ball.vx = (facingLeft ? 1 : -1) * Math.cos(ang) * spd;
    pong.ball.vy = Math.sin(ang) * spd;
    pong.ball.x  = facingLeft ? px + BALL_R : px - BALL_R;
  }
  padBounce(0, true); padBounce(1, false);
  let scorer = -1;
  if (pong.ball.x < -30)    scorer = 1;
  if (pong.ball.x > PW+30)  scorer = 0;
  if (scorer >= 0) {
    pong.score[scorer]++;
    pong.status = 'scored';
    broadcastPong();
    if (pong.score[scorer] >= PONG_WIN) {
      pong.winner = scorer; pong.status = 'won'; broadcastPong();
      setTimeout(() => { pong = freshPong(); broadcastPong(); }, 3000);
    } else {
      setTimeout(pongServe, 1500);
    }
  } else {
    broadcastPong();
  }
}, 1000/30);

// ─── Connect Four ─────────────────────────────────────────────────────────────
const C4C = 7, C4R = 6;
function freshC4() {
  return { board: Array(C4C*C4R).fill(null), turn:'R', status:'playing', winner:null, winCells:null };
}
let c4 = freshC4();

function c4Check(b) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (let r=0; r<C4R; r++) for (let c=0; c<C4C; c++) {
    const v = b[r*C4C+c]; if (!v) continue;
    for (const [dc,dr] of dirs) {
      const cells = [[c,r]];
      for (let i=1; i<4; i++) {
        const nc=c+dc*i, nr=r+dr*i;
        if (nc<0||nc>=C4C||nr<0||nr>=C4R||b[nr*C4C+nc]!==v) break;
        cells.push([nc,nr]);
      }
      if (cells.length===4) return { winner:v, cells };
    }
  }
  return b.every(x=>x!==null) ? { draw:true } : null;
}
function c4StateMsg() { return { game:'c4', type:'state', ...c4 }; }

// ─── Chat ─────────────────────────────────────────────────────────────────────
const CHAT_MAX = 100;
let chatHistory = [];

function chatMsg(name, text) {
  return { game:'chat', type:'msg', name, text, time: Date.now() };
}

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

  // Root → welcome screen
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(302, { Location: '/game/00000' });
    res.end();
    return;
  }

  // Welcome screen (not part of the game nav loop)
  if (pathname === '/game/00000' && method === 'GET') {
    serveFile(res, path.join(__dirname, 'public', 'games', '00000', 'index.html'), 'text/html');
    return;
  }

  // Game pages: /game/00001
  const gameMatch = pathname.match(/^\/game\/(\d+)$/);
  if (gameMatch && method === 'GET') {
    const id = gameMatch[1].padStart(5, '0');
    if (!GAMES.includes(id)) { res.writeHead(404); res.end('Game not found'); return; }
    serveFile(res, path.join(__dirname, 'public', 'games', id, 'index.html'), 'text/html');
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

  // API: list recordings
  if (pathname === '/api/recordings' && method === 'GET') {
    sendJSON(res, recordings);
    return;
  }

  // API: upload recording
  if (pathname === '/api/recordings' && method === 'POST') {
    const qs = req.url.includes('?') ? req.url.split('?')[1] : '';
    const params = Object.fromEntries(new URLSearchParams(qs));
    const name = String(params.name || 'Anonymous').slice(0, 24).trim() || 'Anonymous';
    const dur  = parseFloat(params.dur) || 0;
    const ct   = (req.headers['content-type'] || 'audio/webm').split(';')[0].trim();
    const ext  = ct === 'audio/mp4' ? 'mp4' : ct === 'audio/ogg' ? 'ogg' : 'webm';
    const id   = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const filename = id + '.' + ext;
    const filepath = path.join(REC_DIR, filename);

    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size <= REC_MAX_BYTES) chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > REC_MAX_BYTES) { res.writeHead(413); res.end('Too large'); return; }
      fs.writeFileSync(filepath, Buffer.concat(chunks));
      const meta = { id, filename, name, time: Date.now(), dur: Math.round(dur * 10) / 10 };
      recordings.unshift(meta);
      if (recordings.length > REC_MAX_CLIPS) {
        const old = recordings.pop();
        try { fs.unlinkSync(path.join(REC_DIR, old.filename)); } catch (_) {}
      }
      saveRecMeta();
      broadcast({ game:'rec', type:'new', recording: meta });
      sendJSON(res, meta);
    });
    req.on('error', () => {});
    return;
  }

  // API: serve a recording file
  const recServe = pathname.match(/^\/api\/recordings\/([a-zA-Z0-9_]+\.(webm|mp4|ogg))$/);
  if (recServe && method === 'GET') {
    const filepath = path.join(REC_DIR, recServe[1]);
    if (!fs.existsSync(filepath)) { res.writeHead(404); res.end('Not found'); return; }
    const ct = recServe[2] === 'mp4' ? 'audio/mp4' : recServe[2] === 'ogg' ? 'audio/ogg' : 'audio/webm';
    res.writeHead(200, { 'Content-Type': ct });
    fs.createReadStream(filepath).pipe(res);
    return;
  }

  // API: delete a recording
  const recDel = pathname.match(/^\/api\/recordings\/([a-zA-Z0-9_]+\.(webm|mp4|ogg))$/);
  if (recDel && method === 'DELETE') {
    const filename = recDel[1];
    const idx = recordings.findIndex(r => r.filename === filename);
    if (idx === -1) { res.writeHead(404); res.end(); return; }
    recordings.splice(idx, 1);
    saveRecMeta();
    try { fs.unlinkSync(path.join(REC_DIR, filename)); } catch (_) {}
    broadcast({ game:'rec', type:'deleted', filename });
    sendJSON(res, { ok: true });
    return;
  }

  // API: snake scores
  if (pathname === '/api/snake/scores' && method === 'GET') {
    sendJSON(res, snakeScores.slice(0, 10));
    return;
  }
  if (pathname === '/api/snake/score' && method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { name, score } = JSON.parse(body);
        const n = String(name || 'Anonymous').slice(0, 16).trim() || 'Anonymous';
        const s = Math.max(0, Math.min(99999, parseInt(score) || 0));
        snakeScores.push({ name: n, score: s, ts: Date.now() });
        snakeScores.sort((a, b) => b.score - a.score);
        if (snakeScores.length > 100) snakeScores.length = 100;
        saveSnake();
        broadcast({ game: 'snake', type: 'scores', scores: snakeScores.slice(0, 10) });
        sendJSON(res, { ok: true, rank: snakeScores.findIndex(e => e.score === s && e.name === n) + 1 });
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  // API: card shuffle state
  if (pathname === '/api/cards/state' && method === 'GET') {
    sendJSON(res, { count: cardData.count, lastShuffle: cardData.lastShuffle });
    return;
  }

  // API: new shuffle
  if (pathname === '/api/cards/shuffle' && method === 'POST') {
    cardData.lastShuffle = freshShuffle();
    cardData.count++;
    saveCards();
    const payload = { game: 'cards', type: 'shuffle', count: cardData.count, lastShuffle: cardData.lastShuffle };
    broadcast(payload);
    sendJSON(res, payload);
    return;
  }

  // API: get my ticket
  if (pathname === '/api/ticket' && method === 'GET') {
    const device = getDeviceId(req);
    const number = device ? (ticketData.issued[device] || null) : null;
    sendJSON(res, { number });
    return;
  }

  // API: take a ticket (once per device, ever)
  if (pathname === '/api/ticket/take' && method === 'POST') {
    const device = getDeviceId(req);
    if (!device) { res.writeHead(400); res.end('No device id'); return; }
    if (ticketData.issued[device]) {
      sendJSON(res, { number: ticketData.issued[device] });
      return;
    }
    const number = ticketData.next++;
    ticketData.issued[device] = number;
    saveTickets();
    sendJSON(res, { number });
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
  ws.send(JSON.stringify(tttStateMsg()));
  ws.send(JSON.stringify(pongStateMsg()));
  ws.send(JSON.stringify(c4StateMsg()));
  ws.send(JSON.stringify({ game:'chat', type:'history', messages: chatHistory }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // ── Colour game ──
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

      // ── Tic Tac Toe ──
      if (data.game === 'ttt' && data.type === 'move') {
        if (tttStatus !== 'playing') return;
        const cell = data.cell;
        if (typeof cell !== 'number' || cell < 0 || cell > 8) return;
        if (data.player !== 'X' && data.player !== 'O') return;
        if (data.player !== tttTurn) return;
        if (tttBoard[cell] !== null) return;

        tttBoard[cell] = tttTurn;
        const result = tttCheck(tttBoard);

        if (result) {
          if (result.draw) {
            tttStatus = 'draw';
          } else {
            tttStatus = 'won';
            tttWinner = result.winner;
            tttWinLine = result.line;
          }
          broadcast(tttStateMsg());
          tttResetTimer = setTimeout(tttReset, 3000);
        } else {
          tttTurn = tttTurn === 'X' ? 'O' : 'X';
          broadcast(tttStateMsg());
        }
      }

      // ── Pong ──
      if (data.game === 'pong') {
        if (data.type === 'start' && pong.status === 'idle') pongServe();
        if (data.type === 'input') {
          const pi = data.player;
          if (pi === 0 || pi === 1) {
            if (data.dir !== undefined) pong.dir[pi] = Math.sign(data.dir);
            if (data.y  !== undefined) pong.pad[pi] = Math.max(PAD_H/2, Math.min(PH-PAD_H/2, data.y));
          }
        }
      }

      // ── Chat ──
      if (data.game === 'chat' && data.type === 'msg') {
        const name = String(data.name || 'Anonymous').slice(0, 24).trim() || 'Anonymous';
        const text = String(data.text || '').slice(0, 500).trim();
        if (!text) return;
        const msg = chatMsg(name, text);
        chatHistory.push(msg);
        if (chatHistory.length > CHAT_MAX) chatHistory.shift();
        broadcast(msg);
      }

      // ── Cowsay ──
      if (data.game === 'cowsay' && data.type === 'say') {
        const text = String(data.text || '').slice(0, 200).trim();
        const char = ['cow','tux','sheep','ghost','dragon','elephant','moose'].includes(data.char) ? data.char : 'cow';
        const mode = data.mode === 'think' ? 'think' : 'say';
        if (text) broadcast({ game: 'cowsay', type: 'say', text, char, mode, ts: Date.now() });
      }

      // ── Connect Four ──
      if (data.game === 'c4' && data.type === 'drop') {
        if (c4.status !== 'playing') return;
        const col = data.col;
        if (typeof col !== 'number' || col < 0 || col >= C4C) return;
        if (data.player !== c4.turn) return;
        let row = -1;
        for (let r = C4R-1; r >= 0; r--) { if (!c4.board[r*C4C+col]) { row = r; break; } }
        if (row < 0) return;
        c4.board[row*C4C+col] = c4.turn;
        const res = c4Check(c4.board);
        if (res) {
          if (res.draw) { c4.status='draw'; }
          else { c4.status='won'; c4.winner=res.winner; c4.winCells=res.cells; }
          broadcast(c4StateMsg());
          setTimeout(() => { c4=freshC4(); broadcast(c4StateMsg()); }, 3000);
        } else {
          c4.turn = c4.turn==='R' ? 'Y' : 'R';
          broadcast(c4StateMsg());
        }
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
