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
import { onPoker, leave as pokerLeave, pokerStatus } from './poker.js';

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
    const rooms = {}, crews = {};
    for (const [k, r] of ROOMS) { rooms[k] = r.players.size; if (r.crews.size) crews[k] = r.crews.size; }
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ ok: true, max: MAX_PLAYERS, rooms, crews, poker: pokerStatus() }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Nicht gefunden');
});

// ---------- Räume ----------
/** @type {Map<string, {players: Map<string, any>, crews: Map<string, any>}>} */
const ROOMS = new Map();
let nextId = 1;

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v, lim = 1e5) => (typeof v === 'number' && isFinite(v) ? Math.max(-lim, Math.min(lim, Math.round(v * 100) / 100)) : 0);
const COLOR = /^#[0-9a-fA-F]{3,8}$/;
const VEH = new Set(['skoda', 'rs6', 'van', 'bike', 'ferrari', 'roller', 'police', 'jeep', 'taxi', 'plane', 'bus', 'truck']);
const CREW_MAX = 4; // Koop-Coup: bis zu 4 Spieler pro Crew

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
  if (!r) { r = { players: new Map(), crews: new Map() }; ROOMS.set(code, r); }
  return r;
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj, except) {
  const s = JSON.stringify(obj);
  for (const pl of room.players.values()) if (pl.ws !== except && pl.ws.readyState === 1) pl.ws.send(s);
}

// ---------- Crews (Koop-Coup) ----------
// Eine Crew: Anführer + bis zu 3 Helfer. Alle melden „bereit“, der Anführer startet das Finale.
// Danach leitet der Server Ereignisse (Alarm, Karten, Tor, Beute, Sieg …) an die anderen der Crew weiter.
let nextCrew = 1;
function crewList(room) {
  return [...room.crews.values()].map((c) => ({
    id: c.id, leader: c.leader, started: c.started,
    members: [...c.members].map((id) => { const p = room.players.get(id); return p ? { id, name: p.name, ready: c.ready.has(id) } : null; }).filter(Boolean),
  }));
}
function sendCrews(room) { broadcast(room, { t: 'crews', list: crewList(room) }); }
function crewcast(room, c, obj, except) {
  const s = JSON.stringify(obj);
  for (const id of c.members) { const p = room.players.get(id); if (p && p.ws !== except && p.ws.readyState === 1) p.ws.send(s); }
}
function leaveCrew(me, quiet) {
  const c = me.crew;
  if (!c) return;
  const room = me.room;
  me.crew = null;
  c.members.delete(me.id); c.ready.delete(me.id);
  if (c.leader === me.id || !c.members.size) {
    // Anführer weg -> Crew aufgelöst
    for (const id of c.members) { const p = room.players.get(id); if (p) { p.crew = null; send(p.ws, { t: 'crewx', why: quiet ? '' : 'Der Anführer hat die Crew aufgelöst' }); } }
    room.crews.delete(c.id);
  } else if (c.started) crewcast(room, c, { t: 'cev', id: me.id, name: me.name, e: { k: 'left' } });
  sendCrews(room);
}
function onCrew(me, m) {
  const room = me.room, c = me.crew;
  if (m.a === 'create') {
    leaveCrew(me, true);
    const nc = { id: 'c' + nextCrew++, leader: me.id, members: new Set([me.id]), ready: new Set(), started: false };
    room.crews.set(nc.id, nc); me.crew = nc;
    sendCrews(room);
  } else if (m.a === 'join') {
    const t = room.crews.get(clean(m.id, 12));
    if (!t || t.started) return send(me.ws, { t: 'crewerr', m: 'Diese Crew gibt es nicht mehr' });
    if (t.members.size >= CREW_MAX) return send(me.ws, { t: 'crewerr', m: `Die Crew ist voll (${CREW_MAX}/${CREW_MAX})` });
    if (c !== t) leaveCrew(me, true);
    t.members.add(me.id); me.crew = t;
    sendCrews(room);
  } else if (m.a === 'leave' || m.a === 'done') {
    leaveCrew(me, m.a === 'done');
  } else if (m.a === 'ready' && c && !c.started) {
    if (m.v) c.ready.add(me.id); else c.ready.delete(me.id);
    sendCrews(room);
  } else if (m.a === 'start' && c && c.leader === me.id && !c.started) {
    if (c.members.size < 2) return send(me.ws, { t: 'crewerr', m: 'Mindestens 2 Spieler in der Crew' });
    if ([...c.members].some((id) => !c.ready.has(id))) return send(me.ws, { t: 'crewerr', m: 'Noch nicht alle sind bereit' });
    c.started = true;
    const members = [...c.members].map((id) => ({ id, name: (room.players.get(id) || {}).name || '?' }));
    crewcast(room, c, { t: 'crewgo', id: c.id, leader: c.leader, seed: Math.floor(Math.random() * 1e9), members });
    sendCrews(room);
  }
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
    if (m.t === 'pk') { onPoker(ws, m); return; } // Online-Poker (eigene Verbindung aus dem Casino, ohne Raum)

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
      send(ws, { t: 'crews', list: crewList(room) });
      console.log(`+ ${me.name} (${me.id}) in "${code}" – ${room.players.size}/${MAX_PLAYERS}`);
      return;
    }
    if (!me) return;
    if (m.t === 'st') { me.st = cleanState(m); return; }
    if (m.t === 'crew') { onCrew(me, m); return; }
    if (m.t === 'cev') {
      // Ereignis im Koop-Finale an die anderen der Crew
      const c = me.crew;
      if (!c || !c.started || !m.e || typeof m.e !== 'object') return;
      const e = JSON.stringify(m.e);
      if (e.length > 400) return;
      crewcast(me.room, c, { t: 'cev', id: me.id, name: me.name, e: JSON.parse(e) }, ws);
      return;
    }
    if (m.t === 'chat') {
      const txt = clean(m.m, 120);
      if (txt) broadcast(me.room, { t: 'chat', id: me.id, name: me.name, m: txt });
      return;
    }
  });

  ws.on('close', () => {
    pokerLeave(ws, true);
    if (!me) return;
    leaveCrew(me);
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
