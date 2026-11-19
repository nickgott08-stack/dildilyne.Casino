// Online-Modus: bis zu 10 Spieler gleichzeitig in Dildi City.
// Jeder Spieler schickt 10x pro Sekunde seine Position (zu Fuß, im Auto oder im Flugzeug) an den Server,
// der Server verteilt die Positionen aller Spieler im Raum. Andere Spieler werden ~150 ms "in der
// Vergangenheit" gezeigt und zwischen zwei Paketen weich interpoliert, damit nichts ruckelt.
import * as THREE from 'three';
import { makeHuman, animateHuman, nickLook } from './human.js';
import { Vehicle, MODELS } from './vehicles.js';
import { Plane } from './plane.js';
import { angleWrap, store } from './util.js';

// Nach dem Hochladen auf Render hier die Adresse eintragen (oder im Online-Menü unter "Server").
export const DEFAULT_SERVER = 'wss://dildilyne-casino-1.onrender.com/ws';
const SEND_HZ = 10;
const DELAY = 0.15; // s Interpolations-Puffer
const TAG_DIST = 220; // m: Namen nur bis zu dieser Entfernung
const PVP_DMG = 0.5; // shots on other players do half damage (otherwise the AK kills in under half a second)
const RIDE_DIST = 4; // m: how close you must be to a player's car to ride along
// seats incl. the driver (Nick's spec: bike/scooter 2, bus 8, everything else 4)
const seatsOf = (ty) => (ty === 'bike' || ty === 'roller' ? 2 : ty === 'bus' ? 8 : 4);
const HOODIES = ['#ff3df0', '#3d8bff', '#3bff6a', '#ffd23b', '#ff5a3d', '#9b5bff', '#2ee6d6', '#ffffff', '#ff8ac6', '#222222'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lerpA = (a, b, t) => a + angleWrap(b - a) * t;

function serverUrl() {
  try {
    const q = new URLSearchParams(location.search).get('server');
    if (q) store.set('dc3d_mpurl', q);
  } catch (e) {}
  const s = store.get('dc3d_mpurl');
  if (s) return s;
  // vom eigenen Server ausgeliefert (z. B. dildi-city.onrender.com oder localhost) -> gleicher Server
  if (/^https?:$/.test(location.protocol) && !/github\.io$/.test(location.hostname)) {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
  return DEFAULT_SERVER;
}

export class Online {
  constructor({ scene, camera, player, G, toast, pause }) {
    this.scene = scene; this.camera = camera; this.player = player; this.G = G; this.toast = toast; this.pause = pause;
    this.ws = null; this.id = null; this.state = 'off'; // off | connecting | on
    this.remotes = new Map();
    this.sendT = 0;
    this.wantOnline = false; this.retryT = 0; this.retries = 0;
    this.crews = []; // Koop-Coup-Crews im Raum (vom Server)
    this.hooks = {}; // crews / crewgo / cev / crewx / crewerr – von coop.js gesetzt
    // im Casino: Name aus dem Casino-Konto übernehmen
    const cfg = typeof window !== 'undefined' && window.GCFG;
    this.name = store.get('dc3d_mpname') || (cfg && typeof cfg.name === 'string' ? cfg.name.slice(0, 16) : '');
    this.room = store.get('dc3d_mproom') || 'dildi';
    this.hoodie = store.get('dc3d_mphood') || HOODIES[(Math.random() * HOODIES.length) | 0];
    G.friends = [];
    this._v = new THREE.Vector3();
    // Online-Kollision (Nick): personal switch, only between two players who both have it ON
    this.pvp = store.get('dc3d_pvp') === '1';
    this.pass = new Map(); // id -> seat: who rides along in my car
    this.ride = null; // {id, seat}: I ride along in this player's car
    this.pendSeat = null; this.pendOwn = null;
    this.lastHitBy = null; // {id, t}: for the kill message
    this.tgt = { peds: [], vehs: [] };
    this.buildUI();
  }

  // ---------- UI ----------
  buildUI() {
    this.tags = document.createElement('div');
    this.tags.id = 'mpTags';
    $('hud').appendChild(this.tags);
    this.badge = $('mpBadge');
    this.badge.addEventListener('click', () => { this.pause(true); this.open(); });
    $('onlineBtn').addEventListener('click', () => this.open());
    $('mpClose').addEventListener('click', () => $('online').classList.remove('show'));
    $('mpGo').addEventListener('click', () => (this.state === 'off' ? this.connectFromUI() : this.disconnect(true)));
    $('mpSend').addEventListener('click', () => this.sendChat());
    $('mpServerSave').addEventListener('click', () => {
      const v = $('mpServer').value.trim();
      store.set('dc3d_mpurl', v);
      this.toast(v ? 'Server gespeichert' : 'Standard-Server wird benutzt');
      this.refresh();
    });
    // Tippen in den Feldern soll das Spiel nicht steuern (M = Ton, P = Pause, ...)
    for (const id of ['mpName', 'mpRoom', 'mpChat', 'mpServer']) {
      const el = $(id);
      el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && id === 'mpChat') this.sendChat(); });
      el.addEventListener('keyup', (e) => e.stopPropagation());
    }
    const hw = $('mpHood');
    hw.innerHTML = HOODIES.map((c) => `<button class="mpHc" data-c="${c}" style="background:${c}"></button>`).join('');
    hw.addEventListener('click', (e) => {
      const c = e.target.dataset && e.target.dataset.c;
      if (!c) return;
      this.hoodie = c; store.set('dc3d_mphood', c); this.refresh();
      if (this.state !== 'off') this.toast('Farbe gilt ab dem nächsten Beitreten');
    });
    $('mpPvp').addEventListener('click', () => {
      this.pvp = !this.pvp; store.set('dc3d_pvp', this.pvp ? '1' : '0');
      if (!this.pvp && this.ride && !this.crewMate(this.ride.id)) this.unride();
      this.toast(this.pvp ? '⚔️ Kollision AN – Rammen, Schießen und Mitfahren mit allen, die auch AN haben' : '🕊️ Kollision AUS – du bist für andere Spieler unverwundbar');
      this.refresh();
    });
    this.chatLog = [];
    this.refresh();
  }
  open() {
    $('mpName').value = this.name;
    $('mpRoom').value = this.room;
    $('mpServer').value = store.get('dc3d_mpurl') || '';
    $('mpServer').placeholder = DEFAULT_SERVER;
    this.refresh();
    $('online').classList.add('show');
  }
  refresh() {
    const on = this.state !== 'off';
    $('mpGo').textContent = this.state === 'on' ? '✖ Verlassen' : this.state === 'connecting' ? '… verbinde (abbrechen)' : '▶ Beitreten';
    $('mpGo').style.background = on ? '#8a2333' : '#2e9e44';
    $('mpName').disabled = $('mpRoom').disabled = on;
    for (const b of document.querySelectorAll('.mpHc')) b.classList.toggle('sel', b.dataset.c === this.hoodie);
    $('mpPvp').textContent = this.pvp ? '⚔️ AN' : '🕊️ AUS';
    $('mpPvp').style.background = this.pvp ? '#a3242f' : '';
    const n = this.remotes.size + (this.state === 'on' ? 1 : 0);
    let h = '';
    if (this.state === 'on') {
      h += `<div class="sub">Raum <b>${esc(this.room)}</b> · ${n}/10 Spieler</div>`;
      h += `<div class="mpRow"><span class="mpDot" style="background:${this.hoodie}"></span>${esc(this.name)} (du)${this.pvp ? ' ⚔️' : ''}</div>`;
      for (const r of this.remotes.values()) {
        const d = r.cur ? Math.round(Math.hypot(r.cur.x - this.player.pos.x, r.cur.z - this.player.pos.z)) : null;
        h += `<div class="mpRow"><span class="mpDot" style="background:${esc((r.look && r.look.hoodie) || '#888')}"></span>${esc(r.name)}${r.pvp ? ' ⚔️' : ''}<small>${d != null ? d + ' m' : ''}${r.veh ? ' · ' + (r.veh.isPlane ? '✈️' : '🚗') : ''}</small></div>`;
      }
    } else if (this.state === 'connecting') h = '<div class="sub">Verbinde mit dem Server… (der kostenlose Server braucht beim ersten Mal bis zu 1 Minute zum Aufwachen)</div>';
    else h = '<div class="sub">Alle mit dem gleichen Raum-Namen landen zusammen in einer Stadt (max. 10).</div>';
    $('mpList').innerHTML = h;
    $('mpChatRow').style.display = this.state === 'on' ? 'flex' : 'none';
    $('mpLog').innerHTML = this.chatLog.map((c) => `<div><b>${esc(c.n)}:</b> ${esc(c.m)}</div>`).join('');
    this.badge.style.display = on ? 'block' : 'none';
    this.badge.textContent = this.state === 'on' ? `🌐 ${n}/10` : '🌐 …';
  }

  // ---------- Verbindung ----------
  connectFromUI() {
    const name = $('mpName').value.trim().slice(0, 16);
    if (!name) { this.toast('Gib erst einen Namen ein'); $('mpName').focus(); return; }
    this.name = name; store.set('dc3d_mpname', name);
    this.room = ($('mpRoom').value.trim() || 'dildi').slice(0, 12).toLowerCase(); store.set('dc3d_mproom', this.room);
    this.wantOnline = true; this.retries = 0;
    this.connect();
  }
  connect() {
    if (this.ws) return;
    let ws;
    try { ws = new WebSocket(serverUrl()); } catch (e) { this.toast('Server-Adresse ungültig'); this.wantOnline = false; return; }
    this.ws = ws; this.state = 'connecting'; this.refresh();
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'join', name: this.name, room: this.room, look: { ...nickLook, hoodie: this.hoodie } }));
    };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMsg(m); };
    ws.onclose = () => {
      const was = this.state;
      this.ws = null; this.id = null; this.state = 'off';
      this.clearRemotes();
      this.crews = []; this.hooks.crews && this.hooks.crews(); this.hooks.offline && this.hooks.offline();
      if (this.wantOnline) {
        this.retries++;
        if (this.retries > 6) { this.wantOnline = false; this.toast('Server nicht erreichbar 😕'); }
        else { this.retryT = Math.min(10, 1.5 * this.retries); if (was === 'on') this.toast('Verbindung weg – verbinde neu…'); }
      }
      this.refresh();
    };
    ws.onerror = () => {};
  }
  disconnect(byUser) {
    this.wantOnline = false;
    if (this.ws) { try { this.ws.close(); } catch (e) {} }
    this.ws = null; this.state = 'off'; this.id = null;
    this.clearRemotes();
    this.crews = []; this.hooks.crews && this.hooks.crews(); this.hooks.offline && this.hooks.offline();
    if (byUser) this.toast('Offline');
    this.refresh();
  }
  onMsg(m) {
    if (m.t === 'welcome') {
      this.id = m.id; this.state = 'on'; this.retries = 0;
      for (const p of m.players) this.addRemote(p);
      this.toast(`🌐 Online im Raum „${m.room}“ – ${m.players.length + 1}/10`);
      this.refresh();
    } else if (m.t === 'full') {
      this.wantOnline = false;
      this.toast(`Raum ist voll (${m.max}/${m.max})`);
    } else if (m.t === 'join') {
      this.addRemote(m); this.toast(`👋 ${m.name} ist da`); this.refresh();
    } else if (m.t === 'leave') {
      this.removeRemote(m.id); this.toast(`${m.name} ist weg`); this.refresh();
    } else if (m.t === 'snap') {
      const now = performance.now() / 1000;
      for (const id in m.s) {
        if (id === this.id) continue;
        const r = this.remotes.get(id);
        if (!r) continue;
        r.buf.push({ t: now, s: m.s[id] });
        if (r.buf.length > 12) r.buf.shift();
      }
    } else if (m.t === 'crews') {
      this.crews = m.list || [];
      this.hooks.crews && this.hooks.crews();
    } else if (m.t === 'crewgo' || m.t === 'cev' || m.t === 'crewx' || m.t === 'crewerr') {
      if (m.t === 'crewerr') this.toast('👥 ' + m.m);
      this.hooks[m.t] && this.hooks[m.t](m);
    } else if (m.t === 'kill') {
      const who = m.by === this.id ? 'Du hast' : `${m.byName} hat`;
      this.toast(`💀 ${who} ${m.id === this.id ? 'dich' : m.name} erledigt`);
    } else if (m.from && this.remotes.has(m.from)) {
      this.onDirect(m, this.remotes.get(m.from));
    } else if (m.t === 'chat') {
      this.chatLog.push({ n: m.name, m: m.m });
      if (this.chatLog.length > 30) this.chatLog.shift();
      if (m.id !== this.id) this.toast(`💬 ${m.name}: ${m.m}`);
      this.refresh();
      const lg = $('mpLog'); lg.scrollTop = lg.scrollHeight;
    }
  }
  // ---------- Online-Kollision ----------
  crewMate(id) { const c = this.myCrew(); return !!(c && c.members.some((q) => q.id === id)); }
  both(r) { return this.pvp && !!r.pvp; }
  canRide(r) { return this.both(r) || this.crewMate(r.id); } // crew mates may always ride along (Radj island: jeep)
  onDirect(m, r) {
    const P = this.player, G = this.G, now = G.time;
    if (m.t === 'ram') {
      if (!this.both(r) || P.dead || this.ride) return;
      if (now - (r.ramT || -9) < 0.8) return; // already handled the same crash here
      r.ramT = now;
      const imp = m.imp || 0, d = m.dir || { x: 0, z: 0 };
      this.lastHitBy = { id: r.id, t: now };
      const v = P.inVehicle;
      if (v && !G.flight) {
        const ma = (MODELS[r.v && r.v.ty] || { mass: 1 }).mass, mb = v.M.mass;
        v.vel.x += d.x * imp * 1.3 * ma / (ma + mb); v.vel.y += d.z * imp * 1.3 * ma / (ma + mb);
        v.onImpact(imp, G);
      } else if (!G.flight) this.knock(imp, d.x, d.z);
    } else if (m.t === 'hit') {
      if (!this.both(r) || P.dead || !r.cur) return;
      // rough plausibility check: range and fire rate
      if (Math.hypot(r.cur.x - P.pos.x, r.cur.z - P.pos.z) > 190) return;
      r.hitN = now - (r.hitT0 || -9) > 1 ? 1 : (r.hitN || 0) + 1;
      if (r.hitN === 1) r.hitT0 = now;
      if (r.hitN > 12) return;
      const dmg = Math.min(90, m.dmg || 0);
      this.lastHitBy = { id: r.id, t: now };
      const v = P.inVehicle;
      if (m.veh) { if (v && !G.flight) v.damage(dmg, G); }
      else if (G.damagePlayer) G.damagePlayer(dmg, r.cur);
    } else if (m.t === 'seat') {
      const v = P.inVehicle;
      if (!v || G.flight || !this.canRide(r) || v.dead) return this.send({ t: 'seatno', to: r.id });
      if (this.pass.has(r.id)) return this.send({ t: 'seatok', to: r.id, seat: this.pass.get(r.id) });
      const used = new Set(this.pass.values());
      let seat = 0;
      for (let k = 1; k < seatsOf(v.type); k++) if (!used.has(k)) { seat = k; break; }
      if (!seat) return this.send({ t: 'seatno', to: r.id });
      this.pass.set(r.id, seat); r.seatT = now;
      this.send({ t: 'seatok', to: r.id, seat });
      this.toast(`🚗 ${r.name} fährt bei dir mit`);
    } else if (m.t === 'seatok') {
      if (this.pendSeat !== r.id || P.inVehicle || G.flight || P.dead) return;
      this.pendSeat = null;
      this.ride = { id: r.id, seat: m.seat || 1 };
      G.ride = true;
      P.h.root.visible = false;
      this.toast(`🚗 Du fährst bei ${r.name} mit – zielen und schießen geht · EIN = aussteigen`);
    } else if (m.t === 'seatno') {
      if (this.pendSeat === r.id) { this.pendSeat = null; this.toast('Kein Platz frei'); }
    } else if (m.t === 'unseat') {
      if (this.pass.delete(r.id)) this.toast(`${r.name} ist ausgestiegen`);
    } else if (m.t === 'own') {
      // somebody takes over the car I left standing
      const c = G.lastCar;
      if (!this.both(r) || !c || c.removed || c.dead || c.driver || P.inVehicle === c) return this.send({ t: 'ownno', to: r.id });
      const car = { ty: c.type, c: c.color, sg: (c.tune && c.tune.stage) || 1, dm: this.dmOf(c) };
      c.remove();
      G.lastCar = null;
      if (G.myCar === c) G.myCar = null;
      this.send({ t: 'ownok', to: r.id, car });
      this.toast(`🔑 ${r.name} hat dein abgestelltes Auto übernommen`);
    } else if (m.t === 'ownok') {
      if (this.pendOwn !== r.id || !r.pkVeh || P.inVehicle || P.dead || G.flight) return;
      this.pendOwn = null;
      const k = m.car || {}, pv = r.pkVeh;
      const nv = new Vehicle(this.scene, k.ty || pv.type, pv.pos.x, pv.pos.z, pv.h, k.c || pv.color, { stage: k.sg || 1 });
      nv.pos.y = pv.pos.y;
      nv.health = Math.max(5, nv.maxHealth * (1 - (k.dm || 0))); nv.showDamage();
      G.vehicles.push(nv);
      r.pkVeh.remove(); r.pkVeh = null; r.pkKey = '';
      if (G.putPlayerIn) G.putPlayerIn(nv);
      this.toast(`🔑 Auto von ${r.name} übernommen`);
    } else if (m.t === 'ownno') {
      if (this.pendOwn === r.id) { this.pendOwn = null; this.toast('Das Auto ist nicht mehr frei'); }
    }
  }
  dmOf(v) { return Math.round(Math.max(0, Math.min(1, 1 - v.health / v.maxHealth)) * 100) / 100; }
  knock(imp, dx, dz) {
    const P = this.player;
    if (P.knockT > 0) return;
    if (this.G.damagePlayer) this.G.damagePlayer(imp * 1.6, null);
    P.vy = 3 + imp * 0.15; P.vx = dx * imp * 0.8; P.vz = dz * imp * 0.8; P.knockT = 1.2;
    this.G.audio.thud(1);
  }
  // EIN pressed on foot: ride along in a player's car, or take over a car somebody left standing
  tryRide() {
    if (this.state !== 'on' || this.player.inVehicle) return false;
    const P = this.player;
    let best = null, bd = RIDE_DIST, kind = '';
    for (const r of this.remotes.values()) {
      if (r.veh && !r.veh.isPlane && !r.rd && this.canRide(r)) {
        const d = Math.hypot(r.veh.pos.x - P.pos.x, r.veh.pos.z - P.pos.z) - r.veh.M.wid * 0.3;
        if (d < bd) { bd = d; best = r; kind = 'seat'; }
      }
      if (r.pkVeh && this.both(r)) {
        const d = Math.hypot(r.pkVeh.pos.x - P.pos.x, r.pkVeh.pos.z - P.pos.z) - r.pkVeh.M.wid * 0.3;
        if (d < bd) { bd = d; best = r; kind = 'own'; }
      }
    }
    if (!best) return false;
    // a free NPC car right next to me still wins
    for (const v of this.G.vehicles) {
      if (v.dead || v.removed || v.burn > 0) continue;
      if (Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z) - v.M.wid * 0.3 < bd) return false;
    }
    if (kind === 'seat') { this.pendSeat = best.id; this.send({ t: 'seat', to: best.id }); this.toast(`🚗 Frage ${best.name}…`); }
    else { this.pendOwn = best.id; this.send({ t: 'own', to: best.id }); }
    return true;
  }
  seatPos(veh, n) {
    const M = veh.M, f = veh.fwd, rx = -f.z, rz = f.x;
    let side = 0.45, fw = 0.15;
    if (M.bike) { side = 0; fw = -0.75; }
    else if (veh.type === 'bus') { const row = Math.floor((n - 1) / 2); side = n % 2 ? 0.55 : -0.55; fw = M.len * 0.3 - row * 1.6 - (n === 1 ? 0 : 0.8); }
    else if (n >= 2) { side = n === 2 ? -0.45 : 0.45; fw = -0.85; }
    return { x: veh.pos.x + f.x * fw + rx * side, y: veh.pos.y + (M.bike ? 0.5 : 0.35), z: veh.pos.z + f.z * fw + rz * side, h: veh.h };
  }
  // called by main.js every frame while riding (instead of walking)
  rideStep() {
    const r = this.ride && this.remotes.get(this.ride.id);
    if (!r || !r.veh || r.veh.isPlane || this.state !== 'on' || (!this.canRide(r))) { this.unride(); return null; }
    const p = this.seatPos(r.veh, this.ride.seat);
    this.player.pos.set(p.x, p.y, p.z);
    return p;
  }
  unride(quiet) {
    const P = this.player, r = this.ride && this.remotes.get(this.ride.id);
    if (!this.ride) return;
    if (r) this.send({ t: 'unseat', to: r.id });
    if (r && r.veh) {
      const v = r.veh, f = v.fwd, side = this.ride.seat === 2 ? 1 : -1; // get out on your own side
      const ex = v.pos.x - f.z * side * (v.M.wid / 2 + 0.8), ez = v.pos.z + f.x * side * (v.M.wid / 2 + 0.8);
      P.pos.set(ex, this.G.groundAt ? this.G.groundAt(ex, ez, v.pos.y + 1) : v.pos.y, ez);
    }
    P.vy = 0; P.vx = P.vz = 0;
    this.ride = null; this.G.ride = false;
    P.h.root.visible = true;
    if (!quiet) this.toast('Ausgestiegen');
  }
  // the dead player tells everybody who it was
  onDeath() {
    if (this.ride) this.unride(true);
    const h = this.lastHitBy;
    if (h && this.G.time - h.t < 6 && this.remotes.has(h.id)) this.send({ t: 'dead', by: h.id });
    this.lastHitBy = null;
  }
  // my shot hit another player (main.js does the ray, the other one takes the damage)
  hitRemote(r, dmg, weapon, veh) {
    this.send({ t: 'hit', to: r.id, dmg: Math.round(dmg * PVP_DMG * 10) / 10, weapon, veh: veh ? 1 : 0 });
  }
  // shootable players for main.js castShot/findTarget (both switches ON)
  pvpTargets() { return this.state === 'on' && this.pvp ? this.tgt : null; }

  // ---------- Koop-Coup ----------
  send(obj) { if (this.state === 'on' && this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(obj)); return true; } return false; }
  crew(a, extra) { return this.send({ t: 'crew', a, ...(extra || {}) }); }
  crewEv(e) { return this.send({ t: 'cev', e }); }
  myCrew() { return this.crews.find((c) => c.members.some((q) => q.id === this.id)) || null; }

  sendChat() {
    const el = $('mpChat');
    const t = el.value.trim();
    if (!t || this.state !== 'on') return;
    this.ws.send(JSON.stringify({ t: 'chat', m: t.slice(0, 120) }));
    el.value = '';
  }

  // ---------- andere Spieler ----------
  addRemote(p) {
    if (this.remotes.has(p.id) || p.id === this.id) return;
    const look = { ...nickLook, ...(p.look || {}) };
    const h = makeHuman(look);
    h.root.visible = false;
    this.scene.add(h.root);
    const tag = document.createElement('div');
    tag.className = 'mpTag';
    tag.innerHTML = `<span style="background:${esc(look.hoodie || '#888')}"></span>${esc(p.name)}`;
    this.tags.appendChild(tag);
    this.remotes.set(p.id, { id: p.id, name: p.name, look, h, tag, buf: [], cur: null, veh: null, vehKey: '', spin: 0, pvp: false, pkVeh: null, pkKey: '', vx: 0, vz: 0, tp: { pos: new THREE.Vector3(), dead: false, role: 'rem', remote: null } });
    this.remotes.get(p.id).tp.remote = this.remotes.get(p.id);
  }
  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.h.root);
    if (r.veh) r.veh.remove();
    if (r.pkVeh) r.pkVeh.remove();
    r.tag.remove();
    this.remotes.delete(id);
    this.pass.delete(id);
    if (this.ride && this.ride.id === id) this.unride();
  }
  clearRemotes() { for (const id of [...this.remotes.keys()]) this.removeRemote(id); this.G.friends = []; }

  // Fahrzeug des anderen Spielers passend halten (ein eigenes Modell, nicht in der Physik)
  syncVehicle(r, v, x, z) {
    const key = v ? v.ty + v.c + (v.sg || 1) : '';
    if (key !== r.vehKey) {
      if (r.veh) {
        // the car burnt out: show the explosion here too
        if (!v && r.vdm > 0.97 && this.G.fx) { this.G.fx.explosion(r.veh.pos.x, r.veh.pos.y + 1, r.veh.pos.z); this.G.audio.explode(Math.max(0.25, this.G.audio.dist(r.veh.pos))); }
        r.veh.remove(); r.veh = null;
      }
      if (v) {
        r.veh = v.ty === 'plane' ? new Plane(this.scene, x, z, v.h) : new Vehicle(this.scene, v.ty, x, z, v.h, v.c, v.sg > 1 ? { stage: v.sg } : null);
        r.veh.isPlane = v.ty === 'plane';
        r.veh.remote = true; r.veh.remoteOf = r;
      }
      r.vehKey = key; r.vdm = 0;
    }
    // dents of the other player's car (dildi_cars.js setDamage)
    if (r.veh && v && !r.veh.isPlane && r.veh.setDamage && Math.abs((v.dm || 0) - (r.vdm || 0)) > 0.01) { r.vdm = v.dm || 0; r.veh.setDamage(r.vdm); }
    return r.veh;
  }

  // Zustand zur Zeit t aus dem Puffer (lineare Interpolation)
  sample(r, t) {
    const b = r.buf;
    if (!b.length) return null;
    if (t <= b[0].t) return { a: b[0].s, b: b[0].s, k: 0 };
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i].t <= t) {
        const A = b[i], B = b[i + 1];
        if (!B) return { a: A.s, b: A.s, k: 0 };
        return { a: A.s, b: B.s, k: (t - A.t) / Math.max(1e-3, B.t - A.t) };
      }
    }
    return null;
  }

  // ---------- jeden Frame ----------
  update(dt) {
    if (this.wantOnline && !this.ws) {
      this.retryT -= dt;
      if (this.retryT <= 0) this.connect();
    }
    if (this.state !== 'on') return;
    // eigenen Zustand senden
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / SEND_HZ;
      this.ws.send(JSON.stringify(this.myState()));
    }
    // andere Spieler zeigen
    const t = performance.now() / 1000 - DELAY;
    const W = window.innerWidth, Hh = window.innerHeight;
    const friends = [];
    this.tgt.peds.length = 0; this.tgt.vehs.length = 0;
    // riders who left my car (or I left it)
    if (!this.player.inVehicle) this.pass.clear();
    for (const [id, s] of this.pass) { const r = this.remotes.get(id); if (!r || (this.G.time - (r.seatT || 0) > 2 && r.rd !== this.id)) this.pass.delete(id); }
    for (const r of this.remotes.values()) {
      const smp = this.sample(r, t);
      if (!smp) continue;
      const { a, b, k } = smp;
      const x = a.p[0] + (b.p[0] - a.p[0]) * k, y = a.p[1] + (b.p[1] - a.p[1]) * k, z = a.p[2] + (b.p[2] - a.p[2]) * k;
      const yaw = lerpA(a.p[3], b.p[3], k);
      const sp = a.sp + (b.sp - a.sp) * k;
      const v = b.v || null;
      if (r.cur && dt > 0) { r.vx += ((x - r.cur.x) / dt - r.vx) * Math.min(1, dt * 8); r.vz += ((z - r.cur.z) / dt - r.vz) * Math.min(1, dt * 8); }
      r.cur = { x, y, z };
      const pv = !!b.pv;
      if (pv !== r.pvp || (b.rd || null) !== (r.rd || null)) {
        r.pvp = pv; r.rd = b.rd || null;
        r.tag.innerHTML = `<span style="background:${esc(r.look.hoodie || '#888')}"></span>${esc(r.name)}${pv ? ' ⚔️' : ''}${r.rd ? ' 🚗' : ''}`;
      }
      this.syncParked(r, b.pk);
      friends.push({ x, z, c: r.look.hoodie || '#3bff6a' });
      const veh = this.syncVehicle(r, v, x, z);
      if (veh && v) {
        const av = a.v && a.v.ty === v.ty ? a.v : v;
        veh.pos.set(x, y, z);
        veh.h = lerpA(av.h, v.h, k);
        veh.pitch = av.pi + (v.pi - av.pi) * k;
        veh.roll = av.ro + (v.ro - av.ro) * k;
        if (veh.isPlane) veh.sync();
        else {
          r.spin += sp * dt / 0.35;
          veh.wheelSpin = r.spin;
          veh.gPitch = veh.gRoll = 0;
          veh.sync(this.G);
        }
        r.h.root.visible = false;
        if (!veh.isPlane && this.both(r)) { this.ramCheck(r, veh); if (!veh.isPlane) this.tgt.vehs.push(veh); }
      } else if (b.rd) {
        r.h.root.visible = false; // rides along in somebody's car
      } else {
        if (!!r.h.round !== !!this.G.roundFigs) { // finale: rounder figures
          this.scene.remove(r.h.root);
          r.h = makeHuman({ ...r.look, round: !!this.G.roundFigs });
          this.scene.add(r.h.root);
        }
        r.h.root.visible = true;
        r.h.root.position.set(x, y, z);
        r.h.root.rotation.y = yaw;
        animateHuman(r.h, dt, { speed: Math.abs(sp), grounded: !!(b.f & 2), dead: !!(b.f & 1) });
        if (this.both(r) && !(b.f & 1)) { r.tp.pos.set(x, y, z); r.tp.dead = false; this.tgt.peds.push(r.tp); } else r.tp.dead = true;
      }
      // Namensschild
      this._v.set(x, y + (veh ? (veh.isPlane ? 4.2 : 2.4) : 2.25), z).project(this.camera);
      const dist = Math.hypot(x - this.camera.position.x, z - this.camera.position.z);
      const vis = this._v.z < 1 && dist < TAG_DIST && Math.abs(this._v.x) < 1.1 && Math.abs(this._v.y) < 1.1;
      r.tag.style.display = vis ? 'block' : 'none';
      if (vis) {
        const sx = (this._v.x * 0.5 + 0.5) * W, sy = (-this._v.y * 0.5 + 0.5) * Hh;
        r.tag.style.transform = `translate(${sx.toFixed(0)}px,${sy.toFixed(0)}px) translate(-50%,-100%) scale(${Math.max(0.6, 1 - dist / 400).toFixed(2)})`;
      }
    }
    this.G.friends = friends;
    // Liste im Menü ab und zu auffrischen (Entfernungen)
    this.listT = (this.listT || 0) - dt;
    if (this.listT <= 0) { this.listT = 1; if ($('online').classList.contains('show')) this.refresh(); }
  }

  // parked car of the other player (the one he left standing) – can be taken over with EIN
  syncParked(r, pk) {
    const ok = pk && this.both(r);
    const key = ok ? pk.ty + pk.c + pk.sg : '';
    if (key !== r.pkKey) {
      if (r.pkVeh) { r.pkVeh.remove(); r.pkVeh = null; }
      if (ok) { r.pkVeh = new Vehicle(this.scene, pk.ty, pk.x, pk.z, pk.h, pk.c, pk.sg > 1 ? { stage: pk.sg } : null); r.pkVeh.remote = true; }
      r.pkKey = key;
    }
    if (r.pkVeh) {
      r.pkVeh.pos.set(pk.x, pk.y, pk.z); r.pkVeh.h = pk.h; r.pkVeh.gPitch = r.pkVeh.gRoll = 0; r.pkVeh.sync(this.G);
      if (r.pkVeh.setDamage && Math.abs(pk.dm - (r.pkDm || 0)) > 0.01) { r.pkDm = pk.dm; r.pkVeh.setDamage(pk.dm); }
    }
  }
  // my car against the other player's car, or the other car against me on foot (only both ON)
  ramCheck(r, rv) {
    const P = this.player, G = this.G, me = P.inVehicle;
    if (G.flight || P.dead || this.ride) return;
    if (Math.abs(rv.pos.y - P.pos.y) > 2.2) return;
    const dx0 = rv.pos.x - P.pos.x, dz0 = rv.pos.z - P.pos.z;
    if (dx0 * dx0 + dz0 * dz0 > 64) return;
    const cb = rv.circles();
    if (me) {
      let best = null;
      for (const p of me.circles()) for (const q of cb) {
        const dx = q.x - p.x, dz = q.z - p.z, rr = p.r + q.r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), pen = rr - d; if (!best || pen > best.pen) best = { nx: dx / d, nz: dz / d, pen }; }
      }
      if (!best) return;
      // the other car does not move here: push only myself out
      me.pos.x -= best.nx * best.pen; me.pos.z -= best.nz * best.pen;
      const rvn = (r.vx - me.vel.x) * best.nx + (r.vz - me.vel.y) * best.nz;
      if (rvn >= 0) return;
      const ma = me.M.mass, mb = rv.M.mass, j = (-1.3 * rvn) / (1 / ma + 1 / mb);
      me.vel.x -= (j / ma) * best.nx; me.vel.y -= (j / ma) * best.nz;
      const imp = -rvn;
      if (imp > 5 && G.time - (r.ramT || -9) > 0.8) {
        r.ramT = G.time;
        this.lastHitBy = { id: r.id, t: G.time };
        me.onImpact(imp, G);
        this.send({ t: 'ram', to: r.id, imp: Math.round(imp * 10) / 10, dir: { x: Math.round(best.nx * 100) / 100, z: Math.round(best.nz * 100) / 100 } });
      }
    } else {
      for (const c of cb) {
        const ddx = P.pos.x - c.x, ddz = P.pos.z - c.z, rr = c.r + 0.34, d2 = ddx * ddx + ddz * ddz;
        if (d2 < rr * rr && P.pos.y < rv.pos.y + 1.4) {
          const d = Math.sqrt(d2) + 1e-4;
          P.pos.x = c.x + (ddx / d) * rr; P.pos.z = c.z + (ddz / d) * rr;
          const spd = Math.hypot(r.vx, r.vz);
          if (spd > 5 && P.knockT <= 0 && G.time - (r.ramT || -9) > 0.8) {
            r.ramT = G.time; this.lastHitBy = { id: r.id, t: G.time };
            const k = 1 / (spd || 1);
            this.knock(spd, r.vx * k, r.vz * k);
          }
          break;
        }
      }
    }
  }

  myState() {
    const P = this.player, G = this.G;
    const f = G.flight, v = P.inVehicle;
    const r2 = (n) => Math.round(n * 100) / 100;
    let pos = P.pos, veh = null, sp = P.speed || 0;
    if (f) { pos = f.pos; sp = f.speed; veh = { ty: 'plane', c: '#2471a3', h: r2(f.h), pi: r2(f.pitch), ro: r2(f.roll) }; }
    else if (v) { pos = v.pos; sp = v.vF; veh = { ty: v.type, c: v.color, h: r2(v.h), pi: r2(v.pitch || 0), ro: r2(v.roll || 0), sg: (v.tune && v.tune.stage) || 1, dm: this.dmOf(v) }; }
    const st = { t: 'st', p: [r2(pos.x), r2(pos.y), r2(pos.z), r2(P.yaw)], sp: r2(sp), f: (P.dead ? 1 : 0) | (P.grounded ? 2 : 0), v: veh };
    if (this.pvp) st.pv = 1;
    if (this.ride) { st.rd = this.ride.id; st.sp = 0; }
    // the car I left standing (others with ⚔️ can take it over)
    const c = G.lastCar;
    if (this.pvp && c && !c.removed && !c.dead && !c.driver && c !== v && c.burn <= 0 && Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < 250) {
      st.pk = { ty: c.type, c: c.color, x: r2(c.pos.x), y: r2(c.pos.y), z: r2(c.pos.z), h: r2(c.h), sg: (c.tune && c.tune.stage) || 1, dm: this.dmOf(c) };
    }
    return st;
  }
}
