const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { networkInterfaces } = require('os');

const PORT = 3000;

// ─── Game registry ────────────────────────────────────────────────────────────
const GAMES = ['00001', '00002', '00003', '00004', '00005', '00006', '00007', '00008', '00009', '00010', '00011', '00012', '00013', '00014', '00015', '00016', '00017', '00018', '00019', '00020', '00021', '00022', '00023', '00024', '00025', '00026', '00027', '00028', '00029', '00030', '00031', '00032', '00033', '00034', '00035', '00036', '00037', '00038', '00039', '00040', '00041', '00042', '00043', '00044', '00045', '00046', '00047', '00048', '00049', '00050', '00051', '00052', '00053', '00054', '00055', '00056', '00057', '00058', '00059', '00060', '00061', '00062', '00063', '00064', '00065', '00066', '00067', '00068', '00069', '00070', '00071', '00072', '00073', '00074', '00075', '00076', '00077', '00078', '00079', '00080', '00081', '00082', '00083', '00084', '00085',
  '00086', '00087', '00088', '00089', '00090', '00091', '00092', '00093',
  '00094', '00095', '00096', '00097', '00098', '00099', '00100', '00101',
  '00102', '00103', '00104', '00105', '00106', '00107', '00108', '00109',
  '00110', '00111', '00112', '00113', '00114', '00115', '00116', '00117',
  '00118', '00119', '00120', '00121', '00122', '00123', '00124', '00125'];

// ─── Matrix navigation ────────────────────────────────────────────────────────
const MATRIX_FILE = path.join(__dirname, 'data', 'matrix.json');
let matrix = {};
try { matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf8')); } catch (e) {}
function saveMatrix() { fs.writeFileSync(MATRIX_FILE, JSON.stringify(matrix, null, 2)); }
function getDestination(fromRoom, dir) {
  for (const key of Object.keys(matrix)) {
    const [from, to] = key.split('|');
    if (from === fromRoom && matrix[key] === dir) return to;
  }
  return null;
}
function getRoomConnections(roomId) {
  const exits = {}, entrances = {};
  for (const [key, dir] of Object.entries(matrix)) {
    const [from, to] = key.split('|');
    if (from === roomId) exits[dir] = to;
    if (to === roomId) entrances[dir] = from;
  }
  return { exits, entrances };
}

// ─── User store ───────────────────────────────────────────────────────────────
const USER_DATA_DIR = path.join(__dirname, 'data');
const USER_FILE = path.join(USER_DATA_DIR, 'users.json');
if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
let users = {};
try { users = JSON.parse(fs.readFileSync(USER_FILE, 'utf8')); } catch (e) {}
function saveUsers() { fs.writeFileSync(USER_FILE, JSON.stringify(users)); }
function getOrCreateUser(deviceId) {
  if (!users[deviceId]) {
    users[deviceId] = { firstSeen: Date.now(), cookieClicks: 0, name: null };
    saveUsers();
  }
  return users[deviceId];
}

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

// ─── Joshua Room (00099) ─────────────────────────────────────────────────────
const JOSHUA_DATA_DIR = path.join(__dirname, 'public', 'games', '00099', 'data');
const JOSHUA_FILE = path.join(JOSHUA_DATA_DIR, 'joshua.json');
if (!fs.existsSync(JOSHUA_DATA_DIR)) fs.mkdirSync(JOSHUA_DATA_DIR, { recursive: true });
let joshuaUnlocked = false;
try { joshuaUnlocked = JSON.parse(fs.readFileSync(JOSHUA_FILE, 'utf8')).unlocked || false; } catch (e) {}
function saveJoshua() { fs.writeFileSync(JOSHUA_FILE, JSON.stringify({ unlocked: joshuaUnlocked })); }

// ─── Bulletin Board (00086) ──────────────────────────────────────────────────
const BULLETIN_DATA_DIR = path.join(__dirname, 'public', 'games', '00086', 'data');
const BULLETIN_FILE = path.join(BULLETIN_DATA_DIR, 'bulletin.json');
if (!fs.existsSync(BULLETIN_DATA_DIR)) fs.mkdirSync(BULLETIN_DATA_DIR, { recursive: true });
let bulletinPins = [];
try { bulletinPins = JSON.parse(fs.readFileSync(BULLETIN_FILE, 'utf8')); } catch (e) {}
function saveBulletin() { fs.writeFileSync(BULLETIN_FILE, JSON.stringify(bulletinPins)); }

// ─── Jabberwocky (00087) ─────────────────────────────────────────────────────
const JABBER_DATA_DIR = path.join(__dirname, 'public', 'games', '00087', 'data');
const JABBER_FILE = path.join(JABBER_DATA_DIR, 'jabber.json');
if (!fs.existsSync(JABBER_DATA_DIR)) fs.mkdirSync(JABBER_DATA_DIR, { recursive: true });
let jabberData = {}; // { id: [word, word, ...] }
try { jabberData = JSON.parse(fs.readFileSync(JABBER_FILE, 'utf8')); } catch (e) {}
function saveJabber() { fs.writeFileSync(JABBER_FILE, JSON.stringify(jabberData)); }

// ─── Monty Hall (00080) ───────────────────────────────────────────────────────
const MONTY_DATA_DIR = path.join(__dirname, 'public', 'games', '00080', 'data');
const MONTY_FILE = path.join(MONTY_DATA_DIR, 'monty.json');
if (!fs.existsSync(MONTY_DATA_DIR)) fs.mkdirSync(MONTY_DATA_DIR, { recursive: true });
let montyData = { stayed_win: 0, stayed_loss: 0, switched_win: 0, switched_loss: 0 };
try { montyData = JSON.parse(fs.readFileSync(MONTY_FILE, 'utf8')); } catch (e) {}
function saveMonty() { fs.writeFileSync(MONTY_FILE, JSON.stringify(montyData)); }

// ─── Registry (00083) ────────────────────────────────────────────────────────
const REGISTRY_DATA_DIR = path.join(__dirname, 'public', 'games', '00083', 'data');
const REGISTRY_FILE = path.join(REGISTRY_DATA_DIR, 'registry.json');
if (!fs.existsSync(REGISTRY_DATA_DIR)) fs.mkdirSync(REGISTRY_DATA_DIR, { recursive: true });
let registryEntries = [];
try { registryEntries = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')); } catch (e) {}
function saveRegistry() { fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registryEntries)); }

// ─── Game Over Rooms (00104–00106) ───────────────────────────────────────────
const GAMEOVER_FILE = path.join(__dirname, 'data', 'gameover.json');
let gameoverLocks = {}; // { "deviceId:roomId": unlockTimestamp }
try { gameoverLocks = JSON.parse(fs.readFileSync(GAMEOVER_FILE, 'utf8')); } catch (e) {}
function saveGameover() { fs.writeFileSync(GAMEOVER_FILE, JSON.stringify(gameoverLocks)); }

// ─── Alternate Hangman (00124) — one game ever ───────────────────────────────
const HANGMAN_DATA_DIR = path.join(__dirname, 'public', 'games', '00124', 'data');
const HANGMAN_FILE = path.join(HANGMAN_DATA_DIR, 'hangman.json');
if (!fs.existsSync(HANGMAN_DATA_DIR)) fs.mkdirSync(HANGMAN_DATA_DIR, { recursive: true });
const HANGMAN_WORDS = ['LABYRINTH','THRESHOLD','ENIGMATIC','SOLIPSISM','EPHEMERAL',
  'CLANDESTINE','ANOMALOUS','PERPETUAL','RECURSIVE','OBLIVION','PARADOX','FRACTURE',
  'TERMINUS','CATALYST','RESIDUAL','ABERRANT','PHANTOM','CORRIDOR'];
let hangmanGame = null;
try { hangmanGame = JSON.parse(fs.readFileSync(HANGMAN_FILE, 'utf8')); } catch(e) {}
if (!hangmanGame) {
  const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
  hangmanGame = { word, guessed: [], wrong: 0, status: 'playing', startedAt: Date.now() };
  fs.writeFileSync(HANGMAN_FILE, JSON.stringify(hangmanGame));
}
function saveHangman() { fs.writeFileSync(HANGMAN_FILE, JSON.stringify(hangmanGame)); }
function buildHangmanResponse() {
  const { word, guessed, wrong, status } = hangmanGame;
  const masked = word.split('').map(c => guessed.includes(c) ? c : '_').join('');
  return { masked, guessed, wrong, status, length: word.length,
    word: status !== 'playing' ? word : undefined };
}

function getDeviceId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)device=([a-f0-9-]{36})/);
  return match ? match[1] : null;
}

function getIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function getLanguage(req) {
  const lang = req.headers['accept-language'] || '';
  return lang.split(',')[0].split(';')[0].trim() || 'unknown';
}

function parseUA(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
  let browser = 'Unknown', os = 'Unknown', device = 'Desktop';
  if (/Edg\//.test(ua))           browser = 'Edge '    + (ua.match(/Edg\/([\d]+)/)     || ['','?'])[1];
  else if (/OPR\//.test(ua))      browser = 'Opera '   + (ua.match(/OPR\/([\d]+)/)     || ['','?'])[1];
  else if (/Chrome\/([\d]+)/.test(ua)) browser = 'Chrome '  + ua.match(/Chrome\/([\d]+)/)[1];
  else if (/Firefox\/([\d]+)/.test(ua)) browser = 'Firefox ' + ua.match(/Firefox\/([\d]+)/)[1];
  else if (/Version\/([\d]+).*Safari/.test(ua)) browser = 'Safari ' + ua.match(/Version\/([\d]+)/)[1];
  if (/Windows NT 10|Windows NT 11/.test(ua))   os = 'Windows 10/11';
  else if (/Windows/.test(ua))    os = 'Windows';
  else if (/iPhone/.test(ua))     os = 'iOS ' + ((ua.match(/iPhone OS ([\d_]+)/) || ['','?'])[1]).replace(/_/g,'.');
  else if (/iPad/.test(ua))       os = 'iPadOS';
  else if (/Android ([\d.]+)/.test(ua)) os = 'Android ' + ua.match(/Android ([\d.]+)/)[1];
  else if (/Mac OS X ([\d_]+)/.test(ua)) os = 'macOS ' + ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g,'.');
  else if (/Linux/.test(ua))      os = 'Linux';
  if (/Mobile|iPhone|Android.*Mobile/.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/.test(ua)) device = 'Tablet';
  return { browser, os, device };
}

function updateUserFromRequest(deviceId, req, roomId) {
  const user = users[deviceId];
  if (!user) return;
  const { browser, os, device } = parseUA(req.headers['user-agent'] || '');
  user.ip       = getIP(req);
  user.language = getLanguage(req);
  user.browser  = browser;
  user.os       = os;
  user.device   = device;
  user.lastSeen = Date.now();
  user.visits   = (user.visits || 0) + 1;
  if (roomId) {
    if (!user.rooms) user.rooms = [];
    if (!user.rooms.includes(roomId)) user.rooms.push(roomId);
  }
  saveUsers();
}

// ─── Typewriter (00022) ───────────────────────────────────────────────────────
let typeText = '';
let typeLastKey = 0;
let typeWiltTimer = null;
function typeScheduleClear() {
  clearTimeout(typeWiltTimer);
  typeWiltTimer = setTimeout(() => {
    typeText = '';
    broadcast({ game: 'type', type: 'clear' });
  }, 90000);
}

// ─── Plant (00026) ────────────────────────────────────────────────────────────
const PLANT_DATA_DIR = path.join(__dirname, 'public', 'games', '00026', 'data');
const PLANT_FILE = path.join(PLANT_DATA_DIR, 'plant.json');
if (!fs.existsSync(PLANT_DATA_DIR)) fs.mkdirSync(PLANT_DATA_DIR, { recursive: true });
let plantData = { growth: 10, lastWatered: Date.now(), wilted: false, waterings: 0 };
try { plantData = JSON.parse(fs.readFileSync(PLANT_FILE, 'utf8')); } catch (e) {}
function savePlant() { fs.writeFileSync(PLANT_FILE, JSON.stringify(plantData)); }
setInterval(() => {
  const age = Date.now() - plantData.lastWatered;
  if (!plantData.wilted && age > 3600000) {
    plantData.wilted = true;
    plantData.growth = Math.max(0, plantData.growth - 5);
    savePlant();
    broadcast({ game: 'plant', type: 'state', ...plantData });
  }
}, 60000);

// ─── Shooting Gallery (00030) ─────────────────────────────────────────────────
let galleryTargets = [];
let galleryScores = new Map();
let galleryClientIds = new WeakMap();
let galleryNextId = 1;
let galleryNextTarget = 1;
let galleryRoundEnd = 0;
let galleryPhase = 'between';

function galleryStateMsg() {
  return { game: 'gallery', type: 'state', targets: galleryTargets, phase: galleryPhase, roundEnd: galleryRoundEnd };
}
function galleryScoreMsg() {
  return { game: 'gallery', type: 'scores', scores: [...galleryScores.entries()].map(([id, s]) => s) };
}
function gallerySpawnTarget() {
  const t = {
    id: galleryNextTarget++,
    x: 5 + Math.random() * 90,
    y: 10 + Math.random() * 70,
    size: 4 + Math.random() * 6,
    points: 1,
    alive: true,
  };
  galleryTargets.push(t);
  broadcast({ game: 'gallery', type: 'spawn', target: t });
}
function galleryStartRound() {
  galleryPhase = 'active';
  galleryRoundEnd = Date.now() + 60000;
  galleryTargets = [];
  galleryScores.forEach(s => { s.roundScore = 0; });
  for (let i = 0; i < 6; i++) gallerySpawnTarget();
  broadcast(galleryStateMsg());
  setTimeout(() => {
    galleryPhase = 'between';
    broadcast({ game: 'gallery', type: 'roundEnd', scores: [...galleryScores.values()] });
    setTimeout(galleryStartRound, 8000);
  }, 60000);
}
setInterval(() => {
  if (galleryPhase === 'active' && galleryTargets.filter(t => t.alive).length < 4) {
    gallerySpawnTarget();
  }
}, 2000);

// ─── The Form (00032) ────────────────────────────────────────────────────────
const FORM_DATA_DIR = path.join(__dirname, 'public', 'games', '00032', 'data');
const FORM_FILE = path.join(FORM_DATA_DIR, 'submissions.json');
if (!fs.existsSync(FORM_DATA_DIR)) fs.mkdirSync(FORM_DATA_DIR, { recursive: true });
let formSubmissions = [];
try { formSubmissions = JSON.parse(fs.readFileSync(FORM_FILE, 'utf8')); } catch (e) {}
function saveForm() { fs.writeFileSync(FORM_FILE, JSON.stringify(formSubmissions)); }

// ─── Trolley Problem (00035) ──────────────────────────────────────────────────
const TROLLEY_DATA_DIR = path.join(__dirname, 'public', 'games', '00035', 'data');
const TROLLEY_FILE = path.join(TROLLEY_DATA_DIR, 'pulls.json');
if (!fs.existsSync(TROLLEY_DATA_DIR)) fs.mkdirSync(TROLLEY_DATA_DIR, { recursive: true });
let trolleyData = { pull: 0, leave: 0 };
try { trolleyData = JSON.parse(fs.readFileSync(TROLLEY_FILE, 'utf8')); } catch (e) {}
function saveTrolley() { fs.writeFileSync(TROLLEY_FILE, JSON.stringify(trolleyData)); }

// ─── Metronome (00037) ────────────────────────────────────────────────────────
let metronomes = new Map(); // clientId → { bpm, label }
let metronomeClientIds = new WeakMap();
let metronomeNextId = 1;
function metronomeList() {
  return [...metronomes.values()];
}

// ─── Shared Chalkboard (00038) ────────────────────────────────────────────────
const CHALK_DATA_DIR = path.join(__dirname, 'public', 'games', '00038', 'data');
const CHALK_FILE = path.join(CHALK_DATA_DIR, 'strokes.json');
if (!fs.existsSync(CHALK_DATA_DIR)) fs.mkdirSync(CHALK_DATA_DIR, { recursive: true });
let chalkStrokes = [];
try { chalkStrokes = JSON.parse(fs.readFileSync(CHALK_FILE, 'utf8')); } catch (e) {}
function saveChalk() { fs.writeFileSync(CHALK_FILE, JSON.stringify(chalkStrokes)); }

// ─── Dots & Boxes (00036) ─────────────────────────────────────────────────────
const DB_COLS = 5, DB_ROWS = 5;
const DB_H_LINES = (DB_COLS) * (DB_ROWS + 1);
const DB_V_LINES = (DB_COLS + 1) * DB_ROWS;
function freshDotsGame() {
  return {
    hLines: new Array(DB_H_LINES).fill(0),
    vLines: new Array(DB_V_LINES).fill(0),
    boxes: new Array(DB_COLS * DB_ROWS).fill(0),
    scores: [0, 0],
    turn: 1,
    status: 'playing',
    winner: 0,
  };
}
let dotsGame = freshDotsGame();
function dotsStateMsg() { return { game: 'dots', type: 'state', ...dotsGame }; }
function dotsCheckBoxes(prev) {
  let captured = 0;
  for (let r = 0; r < DB_ROWS; r++) {
    for (let c = 0; c < DB_COLS; c++) {
      const idx = r * DB_COLS + c;
      if (dotsGame.boxes[idx]) continue;
      const top = r * DB_COLS + c;
      const bot = (r + 1) * DB_COLS + c;
      const left = r * (DB_COLS + 1) + c;
      const right = r * (DB_COLS + 1) + c + 1;
      if (dotsGame.hLines[top] && dotsGame.hLines[bot] && dotsGame.vLines[left] && dotsGame.vLines[right]) {
        dotsGame.boxes[idx] = prev;
        dotsGame.scores[prev - 1]++;
        captured++;
      }
    }
  }
  return captured;
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

// ─── ASCII Panel state ────────────────────────────────────────────────────────
let asciiBits = [0,0,0,0,0,0,0,0]; // bits[0]=bit7 (MSB) … bits[7]=bit0 (LSB)

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

  // Assign device cookie server-side on every request
  let deviceId = getDeviceId(req);
  const extraHeaders = {};
  if (!deviceId) {
    deviceId = require('crypto').randomUUID();
    extraHeaders['Set-Cookie'] = `device=${deviceId}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  getOrCreateUser(deviceId);

  // Helper that includes cookie header when needed
  function sendJSONWithHeaders(data, status = 200) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    res.writeHead(status, headers);
    res.end(JSON.stringify(data));
  }
  function serveFileWithHeaders(filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': contentType, ...extraHeaders });
      res.end(data);
    });
  }

  // Root → welcome screen
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(302, { Location: '/game/00000' });
    res.end();
    return;
  }

  // Matrix editor
  if (pathname === '/matrix' && method === 'GET') {
    updateUserFromRequest(deviceId, req, null);
    serveFileWithHeaders(path.join(__dirname, 'public', 'matrix', 'index.html'), 'text/html');
    return;
  }

  // Admin dashboard
  if (pathname === '/admin' && method === 'GET') {
    updateUserFromRequest(deviceId, req, null);
    serveFileWithHeaders(path.join(__dirname, 'public', 'admin', 'index.html'), 'text/html');
    return;
  }

  // Welcome screen (not part of the game nav loop)
  if (pathname === '/game/00000' && method === 'GET') {
    updateUserFromRequest(deviceId, req, '00000');
    serveFileWithHeaders(path.join(__dirname, 'public', 'games', '00000', 'index.html'), 'text/html');
    return;
  }

  // Game pages: /game/00001
  const gameMatch = pathname.match(/^\/game\/(\d+)$/);
  if (gameMatch && method === 'GET') {
    const id = gameMatch[1].padStart(5, '0');
    if (!GAMES.includes(id)) { res.writeHead(404); res.end('Game not found'); return; }
    // Gate: new users must go through welcome → cookie before anything else
    const user = users[deviceId];
    if (id !== '00002' && (!user || user.cookieClicks === 0)) {
      res.writeHead(302, { Location: '/game/00000', ...extraHeaders });
      res.end();
      return;
    }
    updateUserFromRequest(deviceId, req, id);
    serveFileWithHeaders(path.join(__dirname, 'public', 'games', id, 'index.html'), 'text/html');
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
    const user = users[deviceId];
    if (user) { user.cookieClicks++; saveUsers(); }
    sendJSON(res, { count: cookieCount, myClicks: user ? user.cookieClicks : 1 });
    return;
  }

  // API: current user record
  if (pathname === '/api/user/me' && method === 'GET') {
    sendJSON(res, users[deviceId] || { firstSeen: null, cookieClicks: 0, name: null });
    return;
  }

  // API: set designation
  if (pathname === '/api/user/name' && method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        const trimmed = String(name || '').trim().slice(0, 24);
        if (!trimmed) { res.writeHead(400); res.end(JSON.stringify({ error: 'DESIGNATION CANNOT BE EMPTY.' })); return; }
        const u = users[deviceId];
        if (u && u.name && u.name !== trimmed) {
          if (!u.aliases) u.aliases = [];
          if (!u.aliases.includes(u.name)) u.aliases.push(u.name);
        }
        users[deviceId].name = trimmed;
        saveUsers();
        sendJSON(res, { ok: true, name: trimmed });
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  // API: all users (admin)
  if (pathname === '/api/users' && method === 'GET') {
    const list = Object.entries(users).map(([id, u]) => ({ id, ...u }));
    sendJSON(res, list);
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

  // API: matrix — get full matrix
  if (pathname === '/api/matrix' && method === 'GET') {
    sendJSON(res, matrix);
    return;
  }

  // API: matrix — resolve a player move
  if (pathname === '/api/move' && method === 'GET') {
    const qs = new URLSearchParams(req.url.split('?')[1] || '');
    const from = String(qs.get('from') || '').padStart(5, '0');
    const dir  = String(qs.get('dir') || '');
    sendJSON(res, { destination: getDestination(from, dir) });
    return;
  }

  // API: matrix — add/update a connection
  if (pathname === '/api/matrix/connect' && method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { from, to, direction } = JSON.parse(body);
        const DIRS = ['up', 'down', 'left', 'right'];
        if (!from || !to || !DIRS.includes(direction)) { res.writeHead(400); res.end('Invalid'); return; }
        // Remove any existing connection from 'from' in this direction
        for (const key of Object.keys(matrix)) {
          const [f] = key.split('|');
          if (f === from && matrix[key] === direction) delete matrix[key];
        }
        matrix[`${from}|${to}`] = direction;
        saveMatrix();
        sendJSON(res, { ok: true });
      } catch (e) { res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  // API: matrix — remove a connection
  if (pathname === '/api/matrix/connect' && method === 'DELETE') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { from, to } = JSON.parse(body);
        delete matrix[`${from}|${to}`];
        saveMatrix();
        sendJSON(res, { ok: true });
      } catch (e) { res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  // API: delete a single user
  const userDeleteMatch = pathname.match(/^\/api\/users\/([a-f0-9-]{36})$/);
  if (userDeleteMatch && method === 'DELETE') {
    const id = userDeleteMatch[1];
    if (users[id]) { delete users[id]; saveUsers(); }
    sendJSON(res, { ok: true });
    return;
  }

  // API: Joshua Room
  if (pathname === '/api/joshua' && method === 'GET') {
    sendJSON(res, { unlocked: joshuaUnlocked }); return;
  }

  // API: Activity histogram
  if (pathname === '/api/activity' && method === 'GET') {
    const hist = new Array(24).fill(0);
    Object.values(users).forEach(u => {
      if (u.lastSeen) {
        const h = new Date(u.lastSeen).getHours();
        hist[h]++;
      }
    });
    sendJSON(res, { histogram: hist }); return;
  }

  // API: Alternate Hangman — one game ever
  if (pathname === '/api/hangman' && method === 'GET') {
    const { word, guessed, wrong, status } = hangmanGame;
    const masked = word.split('').map(c => guessed.includes(c) ? c : '_').join('');
    sendJSON(res, { masked, guessed, wrong, status, length: word.length,
      word: status !== 'playing' ? word : undefined }); return;
  }
  if (pathname === '/api/hangman/guess' && method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        if (hangmanGame.status !== 'playing') { sendJSON(res, hangmanGame); return; }
        const { letter } = JSON.parse(body);
        const l = String(letter || '').toUpperCase().trim();
        if (!l.match(/^[A-Z]$/)) { res.writeHead(400); res.end(); return; }
        if (hangmanGame.guessed.includes(l)) { sendJSON(res, buildHangmanResponse()); return; }
        hangmanGame.guessed.push(l);
        if (!hangmanGame.word.includes(l)) hangmanGame.wrong++;
        const allRevealed = hangmanGame.word.split('').every(c => hangmanGame.guessed.includes(c));
        if (allRevealed) hangmanGame.status = 'won';
        else if (hangmanGame.wrong >= 6) hangmanGame.status = 'lost';
        saveHangman();
        sendJSON(res, buildHangmanResponse());
      } catch(e) { res.writeHead(400); res.end(); }
    }); return;
  }

  // API: Source code (room 00125)
  if (pathname === '/api/source' && method === 'GET') {
    const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    sendJSON(res, { source: src }); return;
  }

  // API: Game Over lockout (rooms 00104–00106)
  const goMatch = pathname.match(/^\/api\/gameover\/(00104|00105|00106)$/);
  if (goMatch) {
    const roomId = goMatch[1];
    const deviceId = getDeviceId(req) || getIP(req);
    const key = `${deviceId}:${roomId}`;
    if (method === 'GET') {
      const until = gameoverLocks[key] || 0;
      sendJSON(res, { locked: until > Date.now(), until }); return;
    }
    if (method === 'POST') {
      const existing = gameoverLocks[key] || 0;
      if (existing > Date.now()) { sendJSON(res, { locked: true, until: existing }); return; }
      const hours = Math.floor(Math.random() * 23) + 1;
      const until = Date.now() + hours * 3600 * 1000;
      gameoverLocks[key] = until;
      saveGameover();
      sendJSON(res, { locked: true, until }); return;
    }
  }

  // API: Bulletin Board
  if (pathname === '/api/bulletin' && method === 'GET') {
    sendJSON(res, bulletinPins); return;
  }
  if (pathname === '/api/bulletin' && method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { text, author } = JSON.parse(body);
        const t = String(text || '').slice(0, 280).trim();
        if (!t) { res.writeHead(400); res.end(); return; }
        bulletinPins.push({ text: t, author: String(author || '').slice(0, 30).trim(), ts: Date.now() });
        if (bulletinPins.length > 200) bulletinPins = bulletinPins.slice(-200);
        saveBulletin();
        sendJSON(res, bulletinPins);
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  // API: Jabberwocky
  if (pathname === '/api/jabberwocky' && method === 'GET') {
    sendJSON(res, jabberData); return;
  }
  if (pathname === '/api/jabberwocky' && method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { words } = JSON.parse(body);
        if (typeof words !== 'object') { res.writeHead(400); res.end(); return; }
        Object.entries(words).forEach(([id, val]) => {
          const v = String(val || '').slice(0, 30).trim();
          if (!v) return;
          if (!jabberData[id]) jabberData[id] = [];
          jabberData[id].push(v);
          if (jabberData[id].length > 500) jabberData[id] = jabberData[id].slice(-500);
        });
        saveJabber();
        sendJSON(res, jabberData);
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  // API: Monty Hall stats
  if (pathname === '/api/monty' && method === 'GET') {
    sendJSON(res, montyData); return;
  }
  if (pathname === '/api/monty' && method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { action, won } = JSON.parse(body);
        if (action === 'stay')   { won ? montyData.stayed_win++   : montyData.stayed_loss++;   }
        if (action === 'switch') { won ? montyData.switched_win++ : montyData.switched_loss++; }
        saveMonty();
        sendJSON(res, montyData);
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  // API: Registry ledger
  if (pathname === '/api/registry' && method === 'GET') {
    sendJSON(res, registryEntries.slice(-50)); return;
  }
  if (pathname === '/api/registry' && method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { designation, sector, purpose, clearance } = JSON.parse(body);
        const entry = {
          id: registryEntries.length + 1,
          designation: String(designation || 'UNKNOWN').slice(0, 40),
          sector: String(sector || '—').slice(0, 40),
          purpose: String(purpose || '—').slice(0, 80),
          clearance: String(clearance || 'NONE').slice(0, 20),
          ts: Date.now()
        };
        registryEntries.push(entry);
        if (registryEntries.length > 200) registryEntries = registryEntries.slice(-200);
        saveRegistry();
        sendJSON(res, entry);
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  // API: clear all users
  if (pathname === '/api/users' && method === 'DELETE') {
    users = {};
    saveUsers();
    sendJSON(res, { ok: true });
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
  ws.send(JSON.stringify({ game: 'ascii', type: 'state', bits: asciiBits }));
  ws.send(JSON.stringify({ game: 'type', type: 'page', text: typeText }));
  ws.send(JSON.stringify({ game: 'plant', type: 'state', ...plantData }));
  ws.send(JSON.stringify({ game: 'form', type: 'history', submissions: formSubmissions.slice(-50) }));
  ws.send(JSON.stringify({ game: 'trolley', type: 'state', ...trolleyData }));
  ws.send(JSON.stringify({ game: 'metro', type: 'list', metronomes: metronomeList() }));
  ws.send(JSON.stringify({ game: 'chalk', type: 'init', strokes: chalkStrokes }));
  ws.send(JSON.stringify(dotsStateMsg()));
  const metroId = metronomeNextId++;
  metronomeClientIds.set(ws, metroId);

  // Assign gallery client ID
  const clientId = galleryNextId++;
  const clientName = `Player ${clientId}`;
  galleryClientIds.set(ws, clientId);
  galleryScores.set(clientId, { id: clientId, name: clientName, score: 0, roundScore: 0 });
  ws.send(JSON.stringify(galleryStateMsg()));
  ws.send(JSON.stringify(galleryScoreMsg()));
  if (galleryPhase === 'between' && galleryRoundEnd === 0) setTimeout(galleryStartRound, 3000);

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
            if (!joshuaUnlocked) { joshuaUnlocked = true; saveJoshua(); }
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

      // ── ASCII Panel ──
      if (data.game === 'ascii' && data.type === 'flip') {
        const bit = data.bit;
        if (typeof bit !== 'number' || bit < 0 || bit > 7) return;
        asciiBits[bit] ^= 1;
        broadcast({ game: 'ascii', type: 'state', bits: asciiBits });
      }

      // ── The Form ──
      if (data.game === 'form' && data.type === 'submit') {
        const fields = {};
        const allowed = ['name','purpose','date','reference','signature'];
        for (const k of allowed) fields[k] = String(data.fields?.[k] || '').slice(0, 100).trim();
        if (Object.values(fields).some(v => v)) {
          const entry = { ...fields, ts: Date.now() };
          formSubmissions.push(entry);
          if (formSubmissions.length > 200) formSubmissions.shift();
          saveForm();
          broadcast({ game: 'form', type: 'new', entry });
        }
      }

      // ── Trolley Problem ──
      if (data.game === 'trolley' && (data.type === 'pull' || data.type === 'leave')) {
        trolleyData[data.type]++;
        saveTrolley();
        broadcast({ game: 'trolley', type: 'state', ...trolleyData });
      }

      // ── Metronome ──
      if (data.game === 'metro' && data.type === 'set') {
        const mid = metronomeClientIds.get(ws);
        const bpm = Math.max(20, Math.min(300, parseInt(data.bpm) || 120));
        const label = String(data.label || '').slice(0, 20).trim() || 'anon';
        metronomes.set(mid, { id: mid, bpm, label });
        broadcast({ game: 'metro', type: 'list', metronomes: metronomeList() });
      }
      if (data.game === 'metro' && data.type === 'stop') {
        const mid = metronomeClientIds.get(ws);
        metronomes.delete(mid);
        broadcast({ game: 'metro', type: 'list', metronomes: metronomeList() });
      }

      // ── Shared Chalkboard ──
      if (data.game === 'chalk' && data.type === 'stroke') {
        const stroke = { pts: (data.pts||[]).slice(0, 500), color: String(data.color||'#ffffff').slice(0,7), width: Math.max(1,Math.min(20,data.width||3)) };
        if (stroke.pts.length > 1) {
          chalkStrokes.push(stroke);
          if (chalkStrokes.length > 1000) chalkStrokes.shift();
          saveChalk();
          broadcast({ game: 'chalk', type: 'stroke', stroke });
        }
      }
      if (data.game === 'chalk' && data.type === 'clear') {
        chalkStrokes = [];
        saveChalk();
        broadcast({ game: 'chalk', type: 'clear' });
      }

      // ── Dots & Boxes ──
      if (data.game === 'dots' && data.type === 'line') {
        if (dotsGame.status !== 'playing') { dotsGame = freshDotsGame(); broadcast(dotsStateMsg()); return; }
        const { axis, idx } = data;
        const arr = axis === 'h' ? dotsGame.hLines : dotsGame.vLines;
        if (typeof idx !== 'number' || idx < 0 || idx >= arr.length || arr[idx]) return;
        arr[idx] = dotsGame.turn;
        const captured = dotsCheckBoxes(dotsGame.turn);
        if (!captured) dotsGame.turn = dotsGame.turn === 1 ? 2 : 1;
        const totalBoxes = DB_COLS * DB_ROWS;
        if (dotsGame.boxes.every(b => b)) {
          dotsGame.status = 'done';
          dotsGame.winner = dotsGame.scores[0] > dotsGame.scores[1] ? 1 : dotsGame.scores[1] > dotsGame.scores[0] ? 2 : 0;
          broadcast(dotsStateMsg());
          setTimeout(() => { dotsGame = freshDotsGame(); broadcast(dotsStateMsg()); }, 5000);
        } else {
          broadcast(dotsStateMsg());
        }
      }

      // ── Typewriter ──
      if (data.game === 'type' && data.type === 'key') {
        const char = String(data.char || '');
        if (char.length === 1 || char === '\n') {
          if (typeText.length < 2000) typeText += char;
          broadcast({ game: 'type', type: 'key', char });
          typeScheduleClear();
        }
      }
      if (data.game === 'type' && data.type === 'backspace') {
        typeText = typeText.slice(0, -1);
        broadcast({ game: 'type', type: 'backspace' });
        if (typeText.length > 0) typeScheduleClear();
      }

      // ── Plant ──
      if (data.game === 'plant' && data.type === 'water') {
        plantData.lastWatered = Date.now();
        plantData.waterings = (plantData.waterings || 0) + 1;
        if (plantData.wilted) {
          plantData.wilted = false;
          plantData.growth = Math.min(100, plantData.growth + 5);
        } else {
          plantData.growth = Math.min(100, plantData.growth + 2);
        }
        savePlant();
        broadcast({ game: 'plant', type: 'state', ...plantData });
      }

      // ── Shooting Gallery ──
      if (data.game === 'gallery' && data.type === 'shoot') {
        if (galleryPhase !== 'active') return;
        const tid = data.id;
        const target = galleryTargets.find(t => t.id === tid && t.alive);
        if (!target) return;
        target.alive = false;
        const cid = galleryClientIds.get(ws);
        const score = galleryScores.get(cid);
        if (score) { score.score += target.points; score.roundScore += target.points; }
        broadcast({ game: 'gallery', type: 'hit', id: tid, clientId: cid });
        broadcast(galleryScoreMsg());
      }

      // ── Cowsay ──
      if (data.game === 'cowsay' && data.type === 'say') {
        const text = String(data.text || '').slice(0, 200).trim();
        const char = ['cow','tux','sheep','ghost','dragon','elephant','moose'].includes(data.char) ? data.char : 'cow';
        const mode = data.mode === 'think' ? 'think' : 'say';
        if (text) broadcast({ game: 'cowsay', type: 'say', text, char, mode, ts: Date.now() });
      }

      // ── Intercom ──
      if (data.game === 'intercom' && data.type === 'send') {
        const text = String(data.text || '').slice(0, 200).trim();
        if (text) broadcast({ game: 'intercom', type: 'broadcast', text });
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

  ws.on('close', () => {
    const cid = galleryClientIds.get(ws);
    if (cid) galleryScores.delete(cid);
    const mid = metronomeClientIds.get(ws);
    if (mid) { metronomes.delete(mid); broadcast({ game: 'metro', type: 'list', metronomes: metronomeList() }); }
    console.log(`Player disconnected. Total: ${wss.clients.size}`);
  });
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
