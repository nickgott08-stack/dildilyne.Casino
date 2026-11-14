// Online-Modus: bis zu 10 Spieler gleichzeitig in Dildi City.
// Jeder Spieler schickt 10x pro Sekunde seine Position (zu Fuß, im Auto oder im Flugzeug) an den Server,
// der Server verteilt die Positionen aller Spieler im Raum. Andere Spieler werden ~150 ms "in der
// Vergangenheit" gezeigt und zwischen zwei Paketen weich interpoliert, damit nichts ruckelt.
import * as THREE from 'three';
import { makeHuman, animateHuman, nickLook } from './human.js';
import { Vehicle } from './vehicles.js';
import { Plane } from './plane.js';
import { angleWrap, store } from './util.js';

// Nach dem Hochladen auf Render hier die Adresse eintragen (oder im Online-Menü unter "Server").
export const DEFAULT_SERVER = 'wss://dildilyne-casino-1.onrender.com/ws';
const SEND_HZ = 10;
const DELAY = 0.15; // s Interpolations-Puffer
const TAG_DIST = 220; // m: Namen nur bis zu dieser Entfernung
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
    // im Casino: Name aus dem Casino-Konto übernehmen
    const cfg = typeof window !== 'undefined' && window.GCFG;
    this.name = store.get('dc3d_mpname') || (cfg && typeof cfg.name === 'string' ? cfg.name.slice(0, 16) : '');
    this.room = store.get('dc3d_mproom') || 'dildi';
    this.hoodie = store.get('dc3d_mphood') || HOODIES[(Math.random() * HOODIES.length) | 0];
    G.friends = [];
    this._v = new THREE.Vector3();
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
    const n = this.remotes.size + (this.state === 'on' ? 1 : 0);
    let h = '';
    if (this.state === 'on') {
      h += `<div class="sub">Raum <b>${esc(this.room)}</b> · ${n}/10 Spieler</div>`;
      h += `<div class="mpRow"><span class="mpDot" style="background:${this.hoodie}"></span>${esc(this.name)} (du)</div>`;
      for (const r of this.remotes.values()) {
        const d = r.cur ? Math.round(Math.hypot(r.cur.x - this.player.pos.x, r.cur.z - this.player.pos.z)) : null;
        h += `<div class="mpRow"><span class="mpDot" style="background:${esc((r.look && r.look.hoodie) || '#888')}"></span>${esc(r.name)}<small>${d != null ? d + ' m' : ''}${r.veh ? ' · ' + (r.veh.isPlane ? '✈️' : '🚗') : ''}</small></div>`;
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
    } else if (m.t === 'chat') {
      this.chatLog.push({ n: m.name, m: m.m });
      if (this.chatLog.length > 30) this.chatLog.shift();
      if (m.id !== this.id) this.toast(`💬 ${m.name}: ${m.m}`);
      this.refresh();
      const lg = $('mpLog'); lg.scrollTop = lg.scrollHeight;
    }
  }
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
    this.remotes.set(p.id, { id: p.id, name: p.name, look, h, tag, buf: [], cur: null, veh: null, vehKey: '', spin: 0 });
  }
  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.h.root);
    if (r.veh) r.veh.remove();
    r.tag.remove();
    this.remotes.delete(id);
  }
  clearRemotes() { for (const id of [...this.remotes.keys()]) this.removeRemote(id); this.G.friends = []; }

  // Fahrzeug des anderen Spielers passend halten (ein eigenes Modell, nicht in der Physik)
  syncVehicle(r, v, x, z) {
    const key = v ? v.ty + v.c : '';
    if (key !== r.vehKey) {
      if (r.veh) { r.veh.remove(); r.veh = null; }
      if (v) {
        r.veh = v.ty === 'plane' ? new Plane(this.scene, x, z, v.h) : new Vehicle(this.scene, v.ty, x, z, v.h, v.c);
        r.veh.isPlane = v.ty === 'plane';
        r.veh.remote = true;
      }
      r.vehKey = key;
    }
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
    for (const r of this.remotes.values()) {
      const smp = this.sample(r, t);
      if (!smp) continue;
      const { a, b, k } = smp;
      const x = a.p[0] + (b.p[0] - a.p[0]) * k, y = a.p[1] + (b.p[1] - a.p[1]) * k, z = a.p[2] + (b.p[2] - a.p[2]) * k;
      const yaw = lerpA(a.p[3], b.p[3], k);
      const sp = a.sp + (b.sp - a.sp) * k;
      const v = b.v || null;
      r.cur = { x, y, z };
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
      } else {
        r.h.root.visible = true;
        r.h.root.position.set(x, y, z);
        r.h.root.rotation.y = yaw;
        animateHuman(r.h, dt, { speed: Math.abs(sp), grounded: !!(b.f & 2), dead: !!(b.f & 1) });
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

  myState() {
    const P = this.player, G = this.G;
    const f = G.flight, v = P.inVehicle;
    const r2 = (n) => Math.round(n * 100) / 100;
    let pos = P.pos, veh = null, sp = P.speed || 0;
    if (f) { pos = f.pos; sp = f.speed; veh = { ty: 'plane', c: '#2471a3', h: r2(f.h), pi: r2(f.pitch), ro: r2(f.roll) }; }
    else if (v) { pos = v.pos; sp = v.vF; veh = { ty: v.type, c: v.color, h: r2(v.h), pi: r2(v.pitch || 0), ro: r2(v.roll || 0) }; }
    return { t: 'st', p: [r2(pos.x), r2(pos.y), r2(pos.z), r2(P.yaw)], sp: r2(sp), f: (P.dead ? 1 : 0) | (P.grounded ? 2 : 0), v: veh };
  }
}
