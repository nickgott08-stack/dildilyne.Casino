// Dildi City 3D – Mehrspieler-Server
// - liefert das Spiel aus (GET /  ->  city3d/dist/dildi_city_3d.html)
// - WebSocket unter /ws: Räume mit bis zu 10 Spielern, Positionen werden 10x pro Sekunde verteilt
//
// Start:  node server/server.js        (Port aus $PORT, sonst 8080)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 8080;
const MAX_PLAYERS = 10;
const TICK_MS = 100; // 10 Snapshots pro Sekunde
const here = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.join(here, '..', 'city3d', 'dist', 'dildi_city_3d.html');

// ---------- HTTP: Spiel + Status ----------
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '/index.html') {
    fs.readFile(GAME, (err, buf) => {
      if (err) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Spiel nicht gebaut: cd city3d && node build.mjs'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(buf);
    });
    return;
  }
  if (url === '/status') {
    const rooms = {};
    for (const [k, r] of ROOMS) rooms[k] = r.players.size;
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ ok: true, max: MAX_PLAYERS, rooms }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Nicht gefunden');
});

// ---------- Räume ----------
/** @type {Map<string, {players: Map<string, any>}>} */
const ROOMS = new Map();
let nextId = 1;

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v, lim = 1e5) => (typeof v === 'number' && isFinite(v) ? Math.max(-lim, Math.min(lim, Math.round(v * 100) / 100)) : 0);
const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const VEH = new Set(['skoda', 'rs6', 'van', 'bike', 'ferrari', 'roller', 'police', 'jeep', 'taxi', 'plane']);

function cleanLook(l) {
  if (!l || typeof l !== 'object') return null;
  const o = {};
  for (const k of ['skin', 'hair', 'shirt', 'pants', 'shoes', 'hoodie', 'cap']) if (typeof l[k] === 'string' && COLOR.test(l[k])) o[k] = l[k];
  o.hairStyle = Math.max(0, Math.min(3, l.hairStyle | 0));
  return o;
}

// Zustand eines Spielers: p=[x,y,z,yaw], sp=Tempo, f=Flags, v=Fahrzeug {ty,c,h,pi,ro}
function cleanState(m) {
  const p = Array.isArray(m.p) ? m.p.slice(0, 4).map((v) => num(v)) : [0, 0, 0, 0];
  const st = { p, sp: num(m.sp, 500), f: m.f | 0 };
  if (m.v && typeof m.v === 'object' && VEH.has(m.v.ty)) {
    st.v = { ty: m.v.ty, c: COLOR.test(m.v.c) ? m.v.c : '#888888', h: num(m.v.h), pi: num(m.v.pi, 10), ro: num(m.v.ro, 10) };
  }
  return st;
}

function roomOf(code) {
  let r = ROOMS.get(code);
  if (!r) { r = { players: new Map() }; ROOMS.set(code, r); }
  return r;
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj, except) {
  const s = JSON.stringify(obj);
  for (const pl of room.players.values()) if (pl.ws !== except && pl.ws.readyState === 1) pl.ws.send(s);
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

wss.on('connection', (ws) => {
  let me = null; // {id, name, look, room, roomCode, st}
  let budget = 40, budgetT = Date.now(); // Bremse gegen Nachrichten-Flut: 40 pro Sekunde
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });

  ws.on('message', (data) => {
    const now = Date.now();
    if (now - budgetT > 1000) { budget = 40; budgetT = now; }
    if (--budget < 0) return;
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'join' && !me) {
      const code = clean(m.room, 12).toLowerCase() || 'dildi';
      const room = roomOf(code);
      if (room.players.size >= MAX_PLAYERS) { send(ws, { t: 'full', max: MAX_PLAYERS }); ws.close(); return; }
      me = { id: String(nextId++), name: clean(m.name, 16) || 'Gast', look: cleanLook(m.look), room, roomCode: code, st: null, ws };
      room.players.set(me.id, me);
      send(ws, {
        t: 'welcome', id: me.id, room: code, max: MAX_PLAYERS,
        players: [...room.players.values()].filter((p) => p !== me).map((p) => ({ id: p.id, name: p.name, look: p.look })),
      });
      broadcast(room, { t: 'join', id: me.id, name: me.name, look: me.look }, ws);
      console.log(`+ ${me.name} (${me.id}) in "${code}" – ${room.players.size}/${MAX_PLAYERS}`);
      return;
    }
    if (!me) return;
    if (m.t === 'st') { me.st = cleanState(m); return; }
    if (m.t === 'chat') {
      const txt = clean(m.m, 120);
      if (txt) broadcast(me.room, { t: 'chat', id: me.id, name: me.name, m: txt });
      return;
    }
  });

  ws.on('close', () => {
    if (!me) return;
    const room = me.room;
    room.players.delete(me.id);
    broadcast(room, { t: 'leave', id: me.id, name: me.name });
    console.log(`- ${me.name} (${me.id}) aus "${me.roomCode}" – ${room.players.size}/${MAX_PLAYERS}`);
    if (!room.players.size) ROOMS.delete(me.roomCode);
  });
});

// Snapshots verteilen
setInterval(() => {
  for (const room of ROOMS.values()) {
    const s = {};
    for (const p of room.players.values()) if (p.st) s[p.id] = p.st;
    const msg = JSON.stringify({ t: 'snap', s });
    for (const p of room.players.values()) if (p.ws.readyState === 1) p.ws.send(msg);
  }
}, TICK_MS);

// tote Verbindungen aufräumen
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`Dildi City Server läuft auf Port ${PORT} (max. ${MAX_PLAYERS} Spieler pro Raum)`));
