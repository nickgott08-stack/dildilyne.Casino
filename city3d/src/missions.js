// Garages, Flaschenpost job and the bank robbery
import * as THREE from 'three';
import { world, groundAt, NB, RW, roadC, collideCircle, addBox } from './world.js';
import { Vehicle, MODELS } from './vehicles.js';
import { Ped } from './ai.js';
import { setMask } from './human.js';
import { installHeist, installFinale, installCutter } from './heist.js';
import { POI, ROADS } from './geo.js';
import { neonSign, canvasTex, clamp, rand, pick, store, ecoPay, fmtD, P10, season } from './util.js';

const $ = (id) => document.getElementById(id);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// ab Saisonstart: Bankraub / Docks-Coup frühestens alle 30 Minuten, höchstens 10× pro Tag
// davor wie früher: Bank 1× pro Tag, Docks alle 15 Minuten
const robCd = (k) => (season.on ? 30 : k === 'docks' ? 15 : 0) * 60000;
const robMax = (k) => (season.on ? 10 : k === 'bank' ? 1 : Infinity);
function robState(k) { let s = null; try { s = JSON.parse(store.get('dc3d_rob_' + k) || 'null'); } catch (e) {} if (!s || s.d !== today()) s = { d: today(), n: 0, t: (s && s.t) || 0 }; return s; }
function robCheck(k) {
  const s = robState(k);
  if (s.n >= robMax(k)) return robMax(k) === 1 ? 'Heute schon ausgeraubt – morgen wieder' : `Heute schon ${robMax(k)}× – morgen wieder`;
  const left = s.t + robCd(k) - Date.now();
  if (left > 0) return `Wieder möglich in ${Math.ceil(left / 60000)} Min.`;
  return null;
}
function robDone(k) { const s = robState(k); s.n++; s.t = Date.now(); store.set('dc3d_rob_' + k, JSON.stringify(s)); }
const fmt = (n) => Math.round(n).toLocaleString('de-DE');
const loadTune = () => { try { return JSON.parse(store.get('dc3d_tune') || '{}'); } catch (e) { return {}; } };
const saveTune = (t) => store.set('dc3d_tune', JSON.stringify(t));
const COLORS = ['#d40000', '#ff6a00', '#ffd23b', '#2e9e44', '#14b8a6', '#2471a3', '#1f3a8a', '#7d3c98', '#ff3df0', '#ecf0f1', '#8e9397', '#111111'];
const NEONS = ['#ff3df0', '#39c6ff', '#3dff6a', '#ffd23b', '#ff2a2a', '#ffffff'];

// ---------------- mission marker (beam + ring) ----------------
class Marker {
  constructor(scene, color) {
    const tex = canvasTex(16, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, false);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 120, 16, 1, true), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    this.beam.position.y = 60;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.25;
    this.group = new THREE.Group();
    this.group.add(this.beam, this.ring);
    this.group.visible = false;
    scene.add(this.group);
    this.pos = null;
    this.color = color;
  }
  set(x, z, label) {
    this.pos = { x, z, label };
    this.group.position.set(x, groundAt(x, z), z);
    this.group.visible = true;
  }
  clear() { this.pos = null; this.group.visible = false; this.arrow(null); }
  // big glowing sign above the marker that tells where to go next ('left' | 'right' | 'straight' | 'back'),
  // facing a driver who arrives from direction (dx, dz)
  arrow(kind, dx = 0, dz = 1) {
    if (!kind) { if (this.sign) this.sign.visible = false; return; }
    if (!this.sign) {
      this.signTex = {};
      for (const k of ['left', 'right', 'straight', 'back']) {
        this.signTex[k] = canvasTex(256, 128, (ctx, w, h) => {
          ctx.fillStyle = 'rgba(20,14,4,0.82)';
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(6, 6, w - 12, h - 12, 22); else ctx.rect(6, 6, w - 12, h - 12); ctx.fill();
          ctx.lineWidth = 6; ctx.strokeStyle = '#ffd23b'; ctx.stroke();
          ctx.fillStyle = '#ffd23b';
          ctx.save(); ctx.translate(w / 2, h / 2);
          ctx.rotate({ right: 0, left: Math.PI, straight: -Math.PI / 2, back: Math.PI / 2 }[k]);
          ctx.beginPath(); ctx.moveTo(-70, -16); ctx.lineTo(10, -16); ctx.lineTo(10, -42); ctx.lineTo(66, 0); ctx.lineTo(10, 42); ctx.lineTo(10, 16); ctx.lineTo(-70, 16); ctx.closePath(); ctx.fill();
          ctx.restore();
        }, false);
      }
      this.sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: this.signTex.right, transparent: true, side: THREE.DoubleSide, fog: false, toneMapped: false, depthWrite: false }));
      this.sign.position.y = 7.5;
      this.group.add(this.sign);
    }
    this.sign.material.map = this.signTex[kind];
    this.sign.material.needsUpdate = true;
    this.sign.rotation.y = Math.atan2(-dx, -dz); // the sign's front faces the arriving driver
    this.sign.visible = true;
  }
  update(t) {
    if (!this.pos) return;
    const s = 1 + Math.sin(t * 5) * 0.1;
    this.ring.scale.set(s, s, s);
    if (this.sign && this.sign.visible) this.sign.position.y = 7.5 + Math.sin(t * 3) * 0.25;
  }
}

// ---------------- garages ----------------
const GARAGE_CARS = [
  { type: 'skoda', color: '#2e7d32', icon: '🚗', info: 'Starter-Auto', price: 0 },
  { type: 'van', color: '#f5f5f5', icon: '🚐', info: 'Für den Docks-Coup', price: P10(3000) },
  { type: 'rs6', color: '#8e9397', icon: '🚙', info: 'Schneller Kombi', price: P10(12000) },
  { type: 'ferrari', color: '#d40000', icon: '🏎️', info: 'Supersportwagen', price: P10(30000) },
];
const loadOwned = () => { try { return { skoda: 1, ...JSON.parse(store.get('dc3d_owned') || '{}') }; } catch (e) { return { skoda: 1 }; } };

export class Missions {
  constructor(G, scene, api) {
    this.G = G;
    this.scene = scene;
    this.api = api; // { toast, banner, addMoney, putPlayerInVehicle, crime, setStars, playerPos }
    this.marker = new Marker(scene, '#ffd23b');
    this.job = null;
    this.bank = { state: 'idle', guards: [] };
    G.missionTarget = null;
    this.buildGarages();
    this.buildStarts();
    this.buildPhones();
    this.buildHeist();
    this.bindUI();
  }

  // visible start points for jobs and the bank
  buildStarts() {
    this.starts = [];
    const add = (key, p, color, icon, label) => {
      if (!p) return;
      const y = groundAt(p.x, p.z);
      const grp = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.3, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.26;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.2, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      col.position.y = 1.6;
      const tex = canvasTex(256, 256, (ctx) => {
        ctx.clearRect(0, 0, 256, 256);
        ctx.fillStyle = 'rgba(10,8,18,0.75)';
        ctx.beginPath(); ctx.arc(128, 128, 118, 0, 7); ctx.fill();
        ctx.lineWidth = 10; ctx.strokeStyle = color; ctx.stroke();
        ctx.font = '130px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(icon, 128, 138);
      }, false);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, toneMapped: false }));
      spr.scale.set(1.6, 1.6, 1);
      spr.position.y = 3.6;
      grp.add(ring, col, spr);
      grp.position.set(p.x, y, p.z);
      this.scene.add(grp);
      this.starts.push({ key, grp, spr, x: p.x, z: p.z, label });
    };
    add('depot', world.depot, '#3dff6a', '🍾', 'Flaschenpost');
    add('pizza', world.pizza, '#ff5a1f', '🍕', 'Pizza Capri');
    if (world.bank) add('bank', world.bank.entrance, '#ffd700', '🏦', 'Bank');
    if (world.docksCargo) add('docks', world.docksCargo, '#39c6ff', '📦', 'Docks-Coup');
  }

  // ---------- garages ----------
  buildGarages() {
    const scene = this.scene;
    const pMat = new THREE.MeshBasicMaterial({ color: '#3d8bff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false });
    const signMap = neonSign('🅿 GARAGE', '#7fb8ff', { size: 120, bg: '#0d1b33' });
    for (const g of world.garages) {
      const y = groundAt(g.x, g.z);
      g.y = y;
      const pad = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 4, 1), pMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = Math.PI / 4;
      pad.position.set(g.x, y + 0.26, g.z);
      scene.add(pad);
      g.pad = pad;
      // sign post
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), new THREE.MeshStandardMaterial({ color: '#333' }));
      const back = -1;
      const bx = g.x + Math.sin(g.ry) * back * 2.6, bz = g.z + Math.cos(g.ry) * back * 2.6;
      post.position.set(bx, y + 1.6, bz);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), new THREE.MeshBasicMaterial({ map: signMap, toneMapped: false, side: THREE.DoubleSide }));
      sign.position.set(bx, y + 3.3, bz);
      sign.rotation.y = g.ry;
      scene.add(post, sign);
      world.signMats.push(sign.material);
      if (g.building) {
        // small garage shed behind the pad
        const sx = g.x + Math.sin(g.ry) * back * 6, sz = g.z + Math.cos(g.ry) * back * 6;
        const shed = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.6, 5), new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.9 }));
        body.position.y = 1.8;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 5.6), new THREE.MeshStandardMaterial({ color: '#4a5058' }));
        roof.position.y = 3.75;
        const door = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.8, 0.1), new THREE.MeshStandardMaterial({ color: '#2f5f9e', metalness: 0.4, roughness: 0.5 }));
        door.position.set(0, 1.45, 2.53);
        shed.add(body, roof, door);
        for (let r = 0; r < 6; r++) { const l = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: '#244a7c' })); l.position.set(0, 0.3 + r * 0.45, 2.6); shed.add(l); }
        shed.position.set(sx, y, sz);
        shed.rotation.y = g.ry;
        shed.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(shed);
        const hw = Math.abs(Math.cos(g.ry)) > 0.5 ? 3.3 : 2.6, hd = Math.abs(Math.cos(g.ry)) > 0.5 ? 2.6 : 3.3;
        addBox(sx - hw, sx + hw, sz - hd, sz + hd, y + 3.9, { y0: y - 1 });
      }
      world.landmarks.push({ name: g.name, x: g.x, z: g.z, icon: '🅿️', color: '#3d8bff' });
    }
  }
  nearGarage() {
    const pp = this.G.player.pos;
    for (const g of world.garages) if (Math.hypot(pp.x - g.x, pp.z - g.z) < 2.8 && Math.abs(pp.y - g.y) < 2) return g;
    return null;
  }
  openGarage(g) {
    this.G.paused = true;
    this.garage = g;
    const list = $('garageList');
    list.innerHTML = '';
    const own = loadOwned();
    for (const c of GARAGE_CARS) {
      const M = MODELS[c.type];
      const b = document.createElement('button');
      const has = !!own[c.type];
      b.className = 'gcar' + (has ? '' : ' locked');
      const kmh = Math.round(c.type === 'ferrari' ? 200 : c.type === 'rs6' ? 120 : c.type === 'van' ? 80 : 50);
      b.innerHTML = `<span class="gi">${c.icon}</span><span class="gn">${M.name}</span><span class="gs">${c.info} · ${kmh} km/h</span>` +
        (has ? '<span class="gp own">✓ Ausparken</span>' : `<span class="gp">🔒 Kaufen · ${fmt(c.price)} D$</span>`);
      b.addEventListener('click', () => (has ? this.takeCar(c) : this.buyCar(c)));
      list.appendChild(b);
    }
    $('garageTitle').textContent = g.name;
    $('garage').classList.add('show');
  }
  buyCar(c) {
    const G = this.G;
    if (G.money < c.price) { this.api.toast(`💸 Zu wenig Geld – ${MODELS[c.type].name} kostet ${fmt(c.price)} D$`); return; }
    this.api.addMoney(-c.price);
    const own = loadOwned();
    own[c.type] = 1;
    store.set('dc3d_owned', JSON.stringify(own));
    G.audio.pickup();
    this.api.banner('🔑 GEKAUFT!', `${MODELS[c.type].name} gehört jetzt dir`);
    this.takeCar(c);
  }
  closeGarage() {
    $('garage').classList.remove('show');
    this.G.paused = false;
    this.garage = null;
  }
  takeCar(c) {
    const g = this.garage;
    this.closeGarage();
    if (!g) return;
    const G = this.G;
    // previous garage car goes away (if nobody is in it)
    if (G.myCar && !G.myCar.removed && G.myCar !== G.player.inVehicle) G.myCar.remove();
    G.vehicles = G.vehicles.filter((v) => !v.removed);
    // clear the spawn spot
    for (const v of G.vehicles) if (!v.removed && Math.hypot(v.pos.x - g.spawn.x, v.pos.z - g.spawn.z) < 6 && v.driver !== 'player') {
      if (!v.driver || v.parked) v.remove();
      else { v.pos.x += 8; }
    }
    G.vehicles = G.vehicles.filter((v) => !v.removed);
    const tune = loadTune()[c.type] || null;
    const v = new Vehicle(this.scene, c.type, g.spawn.x, g.spawn.z, g.spawn.h, c.color, tune);
    v.mine = true;
    G.vehicles.push(v);
    G.myCar = v;
    this.api.putPlayerInVehicle(v);
    this.api.toast(`🅿️ ${v.M.name} ausgeparkt`);
  }

  // ---------- context actions (EIN button on foot) ----------
  contextHint() {
    const G = this.G;
    if (G.player.dead) return null;
    const v = G.player.inVehicle;
    const pp = v ? v.pos : G.player.pos;
    const free = !this.job && this.bank.state === 'idle';
    const R = v ? 7 : 4;
    if (v && Math.abs(v.vF) > 4) return null;
    const d = world.depot;
    if (d && free && Math.hypot(pp.x - d.x, pp.z - d.z) < R) return { text: '🍾 Flaschenpost-Tour starten', run: () => this.startBottles() };
    const pz = world.pizza;
    if (pz && free && Math.hypot(pp.x - pz.x, pp.z - pz.z) < R) return { text: '🍕 Pizza Capri – ausliefern', run: () => this.startPizza() };
    const cu = world.customs;
    if (v && cu && Math.hypot(pp.x - cu.x, pp.z - cu.z) < 9) {
      if (v.mine && !v.M.bike) return { text: '🎨 Dildi Customs', run: () => this.openCustoms() };
      return { text: '🎨 Nur mit deinem Garagen-Auto', run: () => this.api.toast('🎨 Dildi Customs tunt nur Autos aus deiner Garage') };
    }
    const ch = this.coupHint(pp, v);
    if (ch) return ch;
    const cb = world.coupBoard;
    if (!v && cb && Math.hypot(pp.x - cb.x, pp.z - (cb.z - 1.2)) < 3) return free ? { text: '👑 Radj-Coup – Planungsbrett', run: () => this.openBoard() } : { text: '👑 Erst den Auftrag beenden', run: () => this.api.toast('Erst den laufenden Auftrag beenden') };
    const dc = world.docksCargo;
    if (v && dc && free && Math.hypot(pp.x - dc.x, pp.z - dc.z) < 8) {
      if (v.type !== 'van' || !v.mine) return { text: '📦 Nur mit deinem eigenen VW Transporter', run: () => this.api.toast('📦 Der Docks-Coup geht nur mit deinem eigenen VW Transporter (Garage)') };
      const rc = robCheck('docks');
      if (rc) return { text: `📦 ${rc}`, run: () => this.api.toast(`📦 Keine Fracht da – ${rc}`) };
      if (G.wanted.stars > 0) return { text: '📦 Erst die Polizei abhängen', run: () => this.api.toast('🚨 Erst die Polizei abhängen!') };
      return { text: '📦 Fracht laden', run: () => this.startDocks(v) };
    }
    if (v && this.job && this.job.kind === 'radj' && this.job.stage === 'pick' && Math.hypot(pp.x - this.job.target.x, pp.z - this.job.target.z) < 9) return { text: '📦 Ware einladen', run: () => this.radjLoad() };
    if (v) return null;
    const ph = this.phone && this.phone.accepted && this.phone.ringing;
    if (ph && Math.hypot(pp.x - ph.x, pp.z - ph.z) < 3.2) return { text: '📞 Abheben', run: () => this.answerPhone() };
    const g = this.nearGarage();
    if (g) return { text: '🅿️ Garage – Fahrzeug ausparken', run: () => this.openGarage(g) };
    const B = world.bank;
    if (B) {
      const st = this.bank.state;
      if (st === 'idle' && Math.hypot(pp.x - B.entrance.x, pp.z - B.entrance.z) < 4) {
        const ok = this.bankAvailable();
        return ok === true ? { text: '🏦 Bank überfallen', run: () => this.startBank() } : { text: ok, run: () => this.api.toast(ok) };
      }
      if (st === 'vault' && Math.hypot(pp.x - B.vault.x, pp.z - B.vault.z) < 3.5) return { text: '🔐 Tresor knacken', run: () => this.openDial() };
    }
    return null;
  }

  // ---------- Flaschenpost ----------
  stopPoint(from, dmin, dmax) {
    // a spot on a sidewalk next to the road, in front of a shop
    for (let k = 0; k < 60; k++) {
      const b = pick(world.blocks);
      if (b.type === 'park') continue;
      const side = Math.floor(rand(0, 4));
      const t = rand(10, 46);
      let x, z, nx = 0, nz = 0;
      if (side === 0) { x = b.x0 + t; z = b.z0 + 1.2; nz = -1; }
      else if (side === 1) { x = b.x0 + t; z = b.z1 - 1.2; nz = 1; }
      else if (side === 2) { x = b.x0 + 1.2; z = b.z0 + t; nx = -1; }
      else { x = b.x1 - 1.2; z = b.z0 + t; nx = 1; }
      const d = Math.hypot(x - from.x, z - from.z);
      if (d < dmin || d > dmax) continue;
      // marker sits on the road lane in front of the sidewalk
      return { x: x + nx * 4, z: z + nz * 4 };
    }
    return { x: from.x + 100, z: from.z };
  }
  startBottles() {
    const G = this.G, d = world.depot;
    const v = new Vehicle(this.scene, 'van', d.spawn.x, d.spawn.z, d.spawn.h, '#f5f5f5');
    // Flaschenpost livery: white van, purple band + lettering
    const tex = neonSign('FLASCHENPOST', '#ffffff', { size: 120, bg: '#6a1fb5', border: false });
    const band = new THREE.MeshStandardMaterial({ color: '#6a1fb5', roughness: 0.5 });
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(v.M.len - 0.5, 0.32), band);
      b.position.set(s * (v.M.wid / 2 + 0.035), 1.12, 0);
      b.rotation.y = s * Math.PI / 2;
      v.tilt.add(b);
    }
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
      p.position.set(s * (v.M.wid / 2 + 0.04), 1.75, -0.4);
      p.rotation.y = s * Math.PI / 2;
      v.tilt.add(p);
    }
    G.vehicles.push(v);
    this.api.putPlayerInVehicle(v);
    const KIOSK = ['Kiosk am Eck', 'Späti 24/7', 'Bar Sigma', 'Trinkhalle Dildi', 'Club Bubensahne', 'Kneipe Hafenblick', 'Getränke-Markt Nord', 'Bistro Rot-Schwarz', 'Shisha-Lounge', 'Imbiss Mettbrötchen'];
    const stops = [];
    let f = { x: d.x, z: d.z };
    for (let i = 0; i < 5; i++) {
      const p = this.stopPoint(f, 140, 420);
      stops.push({ ...p, name: KIOSK[Math.floor(rand(0, KIOSK.length))] });
      f = p;
    }
    this.job = { kind: 'bottles', veh: v, stops, k: 0, bottles: 60, broken: 0, earn: 0, lastV: new THREE.Vector2(), breakT: 0, unload: 0, awayT: 0 };
    this.nextStop();
    this.api.banner('🍾 FLASCHENPOST', '5 Kunden · 60 Flaschen · fahr vorsichtig!');
  }
  nextStop() {
    const j = this.job;
    const s = j.stops[j.k];
    const from = j.k ? j.stops[j.k - 1] : world.depot;
    j.tl = Math.round(22 + (Math.hypot(s.x - from.x, s.z - from.z) * 1.4) / 11);
    j.t = j.tl;
    this.marker.set(s.x, s.z, s.name);
    this.G.missionTarget = { x: s.x, z: s.z, color: '#ffd23b' };
  }
  updateBottles(dt) {
    const G = this.G, j = this.job, v = j.veh;
    if (v.dead || v.removed) return this.endJob('🍾 Lieferwagen zerstört – Tour abgebrochen');
    if (G.player.inVehicle !== v) {
      j.awayT += dt;
      if (j.awayT > 25) return this.endJob('🍾 Lieferwagen verlassen – Tour abgebrochen');
    } else j.awayT = 0;
    j.t -= dt;
    // breakage from crashes and hard braking
    j.breakT -= dt;
    const dv = Math.hypot(v.vel.x - j.lastV.x, v.vel.y - j.lastV.y) / Math.max(dt, 1e-3);
    const decel = -(v.accelF || 0);
    j.lastV.set(v.vel.x, v.vel.y);
    let lost = 0;
    if (dv > 30) lost = Math.min(10, Math.round(dv / 14));
    else if (decel > 13 && Math.abs(v.vF) > 6 && j.breakT < 0) { lost = 1; j.breakT = 0.7; }
    if (lost > 0 && j.bottles > 0) {
      lost = Math.min(lost, j.bottles);
      j.bottles -= lost;
      j.broken += lost;
      this.api.toast(`💥 ${lost} Flasche${lost > 1 ? 'n' : ''} kaputt!`);
      G.audio.burst(0.5, 3500, 0.25, 'highpass');
    }
    const s = j.stops[j.k];
    const d = Math.hypot(v.pos.x - s.x, v.pos.z - s.z);
    if (d < 7 && Math.abs(v.vF) < 2 && G.player.inVehicle === v) {
      j.unload += dt;
      if (j.unload > 1.2) {
        j.unload = 0;
        const want = j.k === 4 ? j.bottles : Math.min(12, j.bottles);
        const late = j.t < 0;
        let pay = want * 50;
        if (late) pay *= 0.5;
        else pay += Math.min(400, j.t * 8);
        pay = ecoPay(pay);
        j.bottles -= want;
        j.earn += pay;
        this.api.addMoney(Math.round(pay));
        this.api.toast(`🍾 ${s.name}: ${want} Flaschen · +${fmt(pay)} D$${late ? ' (zu spät)' : ''}`);
        G.audio.pickup();
        j.k++;
        if (j.k >= 5 || j.bottles <= 0) {
          let bonus = 0;
          if (j.k >= 5 && j.broken <= 6) bonus = ecoPay(1500);
          if (bonus) this.api.addMoney(bonus);
          this.endJob(null);
          this.api.banner('🍾 TOUR GESCHAFFT', `Verdient: ${fmt(j.earn + bonus)} D$${bonus ? ' (inkl. ${fmtD(bonus)} D$ Bonus für saubere Fahrt)' : ''}`);
          return;
        }
        this.nextStop();
      }
    } else j.unload = 0;
    const tm = Math.max(0, Math.ceil(j.t));
    this.setJobHUD('🍾 FLASCHENPOST', `Stopp ${j.k + 1}/5 · ${s.name}`, `${j.t < 0 ? '⏱ zu spät' : `⏱ ${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`} · 🍾 ${j.bottles}/60${j.unload > 0 ? ' · Ausladen…' : d < 25 ? ' · anhalten zum Ausladen' : ''}`, j.t < 10);
  }
  // ---------- Dildi Customs ----------
  openCustoms() {
    const G = this.G, v = G.player.inVehicle;
    if (!v) return;
    G.paused = true;
    this.cust = v;
    this.renderCustoms();
    $('customs').classList.add('show');
  }
  renderCustoms() {
    const v = this.cust, G = this.G;
    const all = loadTune();
    const t = all[v.type] || {};
    const el = $('custBody');
    const btn = (label, price, owned, act, extra = '') => `<button class="cb${owned ? ' own' : ''}" data-act="${act}" ${extra}>${label}<small>${owned ? '✓ eingebaut' : fmt(price) + ' D$'}</small></button>`;
    let h = `<div class="cmoney">D$ ${fmt(G.money)} · ${v.M.name}</div>`;
    h += `<div class="crow"><b>Lack</b> <span class="cpr">${fmtD(P10(50))} D$</span><div class="sw">${COLORS.map((c) => `<button class="swb${(t.col || v.color) === c ? ' sel' : ''}" style="background:${c}" data-act="col:${c}"></button>`).join('')}</div></div>`;
    h += `<div class="crow"><b>Neon-Unterboden</b> <span class="cpr">${fmtD(P10(300))} D$</span><div class="sw">${NEONS.map((c) => `<button class="swb neon${t.neon === c ? ' sel' : ''}" style="background:${c};box-shadow:0 0 10px ${c}" data-act="neon:${c}"></button>`).join('')}<button class="swb${!t.neon ? ' sel' : ''}" data-act="neon:" style="background:#222">✕</button></div></div>`;
    h += `<div class="crow"><b>Fahrwerk</b><div class="cbs">${btn('⬇ Tieferlegen', 2000, t.low, 'low')}</div></div>`;
    h += `<div class="crow"><b>Heckspoiler</b> <small>mehr Tempo & Grip</small><div class="cbs">${[1, 2, 3].map((k) => btn(`Stufe ${k} (+${k * 7}%)`, [0, 5000, 10000, 20000][k], (t.spoiler || 0) >= k, 'spoiler:' + k)).join('')}</div></div>`;
    h += `<div class="crow"><b>Panzerung</b> <small>+40 % Leben pro Stufe</small><div class="cbs">${[1, 2, 3].map((k) => btn(`Stufe ${k}`, [0, 10000, 25000, 50000][k], (t.armor || 0) >= k, 'armor:' + k)).join('')}</div></div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => this.buyTune(b.dataset.act)));
  }
  buyTune(act) {
    const v = this.cust, G = this.G;
    const all = loadTune();
    const t = { ...(all[v.type] || {}) };
    const [k, val] = act.split(':');
    let price = 0;
    if (k === 'col') { if (t.col === val) return; price = P10(50); t.col = val; }
    else if (k === 'neon') { if ((t.neon || '') === val) return; price = val ? P10(300) : 0; t.neon = val || null; }
    else if (k === 'low') { if (t.low) return; price = P10(200); t.low = true; }
    else if (k === 'spoiler') { const n = +val; if ((t.spoiler || 0) >= n) return; price = P10([0, 500, 1000, 2000][n]); t.spoiler = n; }
    else if (k === 'armor') { const n = +val; if ((t.armor || 0) >= n) return; price = P10([0, 1000, 2500, 5000][n]); t.armor = n; }
    if (price > G.money) { this.api.toast(`💸 Zu wenig Geld (${fmt(price)} D$)`); return; }
    if (price) this.api.addMoney(-price);
    all[v.type] = t;
    saveTune(all);
    // rebuild the car with the new parts
    const nv = new Vehicle(this.scene, v.type, v.pos.x, v.pos.z, v.h, v.color, t);
    nv.mine = true;
    v.driver = null;
    G.vehicles.push(nv);
    this.api.putPlayerInVehicle(nv);
    v.remove();
    G.vehicles = G.vehicles.filter((x) => !x.removed);
    G.myCar = nv;
    this.cust = nv;
    G.audio.tone(0.2, 600, 1200, 0.15, 'triangle');
    this.renderCustoms();
  }
  closeCustoms() {
    $('customs').classList.remove('show');
    this.G.paused = false;
    this.cust = null;
  }

  // ---------- phone booths ----------
  buildPhones() {
    const spots = [];
    for (const b of world.blocks) {
      if (['park', 'bank', 'customs', 'police'].includes(b.type)) continue;
      if ((b.bi + b.bj) % 3 !== 0) continue;
      spots.push({ x: b.x0 + 2.2, z: b.z0 + 9, ry: Math.PI / 2 });
    }
    // outside the city: next to the place, but never on a road
    const nearRoad = (x, z, rad) => ROADS.some((r) => r.kind !== 'deck' && r.samples && r.samples.some((q) => Math.hypot(q.x - x, q.z - z) < r.w / 2 + rad));
    const freeSpot = (x, z) => {
      for (const [ox, oz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [10, 8], [-10, 8], [10, -8], [-10, -8], [14, 0], [-14, 0]]) if (!nearRoad(x + ox, z + oz, 2.5)) return { x: x + ox, z: z + oz, ry: 0 };
      return null;
    };
    for (const p of [[POI.village.x + 14, POI.village.z + 16], [POI.tanke.x - 12, POI.tanke.z + 14], [POI.camp.x + 12, POI.camp.z - 14], world.radjWarehouse ? [world.radjWarehouse.x + 40, world.radjWarehouse.z + 6] : null]) {
      if (!p) continue;
      const f = freeSpot(p[0], p[1]);
      if (f) spots.push(f);
    }
    const glass = new THREE.MeshStandardMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.35, roughness: 0.1 });
    const frame = new THREE.MeshStandardMaterial({ color: '#f2c318', roughness: 0.5 });
    this.booths = spots.map((p) => {
      const y = groundAt(p.x, p.z);
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 1.2), glass);
      box.position.y = 1.15;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 1.35), frame);
      top.position.y = 2.45;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: '#552', toneMapped: false }));
      lamp.position.y = 2.72;
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: '#222' }));
      phone.position.set(0, 1.4, -0.45);
      for (const [a, b2] of [[-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), frame); f.position.set(a, 1.15, b2); g.add(f); }
      g.add(box, top, lamp, phone);
      g.position.set(p.x, y, p.z);
      g.rotation.y = p.ry || 0;
      this.scene.add(g);
      addBox(p.x - 0.65, p.x + 0.65, p.z - 0.65, p.z + 0.65, y + 2.6, { y0: y - 1 });
      return { x: p.x + Math.sin(p.ry || 0) * 1.1, z: p.z + Math.cos(p.ry || 0) * 1.1, g, lamp };
    });
    // a call every ~4 minutes (first one after 1.5 minutes)
    this.phone = { ringing: null, next: 90, ringT: 0 };
    this.phoneMarker = new Marker(this.scene, '#ffd23b');
    this.phoneMarker.beam.scale.set(1.6, 1, 1.6);
  }
  updatePhones(dt) {
    const G = this.G, ph = this.phone;
    if (!ph) return;
    const pp = this.api.playerPos();
    if (ph.ringing) {
      // another job started in the meantime: the call is gone
      if (this.busy()) return this.dropCall(240);
      if (!ph.accepted) {
        ph.askT -= dt;
        ph.beepT = (ph.beepT || 0) - dt;
        if (ph.beepT < 0 && G.time % 2 < 1.1) { ph.beepT = 0.12; G.audio.tone(0.07, 1300, 1300, 0.08, 'square'); }
        $('callT').textContent = `${Math.max(0, Math.ceil(ph.askT))} s`;
        if (ph.askT < 0) { this.api.toast('📞 Anruf verpasst'); this.dropCall(240); }
        return;
      }
      ph.ringT -= dt;
      const on = Math.sin(G.time * 18) > 0 && G.time % 2 < 1.1;
      ph.ringing.lamp.material.color.set(on ? '#ffe040' : '#553');
      // ring sound gets louder when you are close
      ph.beepT = (ph.beepT || 0) - dt;
      const d = Math.hypot(pp.x - ph.ringing.x, pp.z - ph.ringing.z);
      if (ph.beepT < 0 && G.time % 2 < 1.1) { ph.beepT = 0.12; const vol = Math.max(0, 1 - d / 70) * 0.12; if (vol > 0.005) G.audio.tone(vol, 1300, 1300, 0.08, 'square'); }
      this.phoneMarker.update(G.time);
      this.phoneMarker.beam.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(G.time * 4));
      const tm = Math.max(0, Math.ceil(ph.ringT));
      this.setJobHUD('📞 ' + this.offerText(ph.offer)[0], 'Fahr zur klingelnden Telefonzelle', `📍 ${Math.round(d)} m · ⏱ ${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`, tm < 20);
      if (ph.ringT < 0) { this.api.toast('📞 Zu spät – der Anrufer hat aufgelegt'); this.dropCall(240); }
      return;
    }
    if (this.busy()) return;
    ph.next -= dt;
    if (ph.next > 0) return;
    const cand = this.booths.filter((b) => { const d = Math.hypot(b.x - pp.x, b.z - pp.z); return d > 40 && d < 420; });
    if (!cand.length) { ph.next = 20; return; }
    ph.ringing = pick(cand);
    ph.offer = pick(['race', 'hit', 'radj', 'radj']);
    ph.accepted = false;
    ph.askT = 20;
    const T = this.offerText(ph.offer);
    $('callJob').textContent = T[0];
    $('callPay').textContent = T[2];
    $('callBox').classList.add('show');
    G.audio.tone(0.18, 900, 1300, 0.15, 'triangle');
  }
  offerText(k) {
    return {
      race: ['🏁 Zeitrennen', '„Du hältst dich für schnell? 8 Checkpoints quer durch die Stadt – schaff sie in der Zeit und das Geld gehört dir.“', `bis ${fmtD(ecoPay(4000))} D$`],
      hit: ['🎯 Attentat', '„Ein Typ in Gold schuldet meinem Boss Geld. Er läuft mit zwei Bodyguards durch die Stadt. Erledige ihn.“', `${fmtD(ecoPay(3500))} D$`],
      radj: ['📦 Radjs Lieferung', '„Radj hier. In der Wüste wartet eine Lieferung für mich – keine Fragen. Hol sie ab und bring sie in meine Lagerhalle an den Docks. Und lass dir keine Bullen anhängen.“', `${fmtD(ecoPay(4000))}–${fmtD(ecoPay(6500))} D$`],
    }[k];
  }
  // answer on the popup: accept → route to the booth
  takeCall(yes) {
    const ph = this.phone, G = this.G;
    $('callBox').classList.remove('show');
    if (!ph.ringing) return;
    if (!yes) { this.api.toast('📞 Abgelehnt'); this.dropCall(240); return; }
    ph.accepted = true;
    ph.ringT = 180;
    const b = ph.ringing;
    G.phoneRing = { x: b.x, z: b.z };
    G.missionTarget = { x: b.x, z: b.z, color: '#ffd23b', phone: true };
    this.phoneMarker.set(b.x, b.z);
    this.api.toast('📞 Angenommen – die Route zur Telefonzelle ist markiert');
  }
  dropCall(next) {
    const ph = this.phone, G = this.G;
    $('callBox').classList.remove('show');
    if (ph.ringing) ph.ringing.lamp.material.color.set('#552');
    if (ph.accepted && !this.job) this.setJobHUD(null);
    ph.ringing = null;
    ph.accepted = false;
    ph.next = next;
    G.phoneRing = null;
    if (G.missionTarget && G.missionTarget.phone) G.missionTarget = null;
    this.phoneMarker.clear();
  }
  answerPhone() {
    const ph = this.phone;
    if (!ph.ringing || !ph.accepted) return;
    const k = ph.offer;
    this.dropCall(240);
    const TXT = this.offerText(k);
    this.offer = k;
    $('phoneT').textContent = TXT[0];
    $('phoneS').textContent = TXT[1];
    $('phoneR').textContent = 'Belohnung: ' + TXT[2];
    this.G.paused = true;
    $('phone').classList.add('show');
  }
  acceptOffer(yes) {
    $('phone').classList.remove('show');
    this.G.paused = false;
    if (!yes) { this.api.toast('📞 Aufgelegt'); return; }
    this.G.missionTarget = null;
    if (this.offer === 'race') this.startRace();
    else if (this.offer === 'hit') this.startHit();
    else this.startRadj();
  }
  // --- race ---
  startRace() {
    const pp = this.api.playerPos();
    const ci = Math.round((pp.x + 204) / 68), cj = Math.round((pp.z + 204) / 68);
    let i = Math.max(0, Math.min(NB, ci)), j = Math.max(0, Math.min(NB, cj)), last = -1;
    const pts = [];
    for (let k = 0; k < 9; k++) {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map((d, n) => [d, n]).filter(([d, n]) => i + d[0] >= 0 && i + d[0] <= NB && j + d[1] >= 0 && j + d[1] <= NB && n !== (last ^ 1));
      const [[dx, dz], n] = pick(opts);
      const steps = 1 + Math.floor(rand(0, 2));
      for (let q = 0; q < steps && i + dx >= 0 && i + dx <= NB && j + dz >= 0 && j + dz <= NB; q++) { i += dx; j += dz; }
      last = n;
      pts.push({ x: roadC(i), z: roadC(j) });
    }
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
    this.job = { kind: 'race', pts, k: 0, started: false, tl: Math.round(14 + len / 12), t: 0 };
    this.raceMark();
    this.api.banner('🏁 ZEITRENNEN', 'Fahr zum ersten Checkpoint – dann läuft die Uhr');
  }
  raceMark() {
    const j = this.job, p = j.pts[j.k];
    this.marker.set(p.x, p.z);
    this.G.missionTarget = { x: p.x, z: p.z, color: '#ffd23b' };
    // arrow sign: where to drive after this checkpoint
    const nx = j.pts[j.k + 1];
    if (!nx) { this.marker.arrow(null); return; }
    const from = j.k > 0 ? j.pts[j.k - 1] : this.api.playerPos();
    let ix = p.x - from.x, iz = p.z - from.z, ox = nx.x - p.x, oz = nx.z - p.z;
    const il = Math.hypot(ix, iz) || 1, ol = Math.hypot(ox, oz) || 1;
    ix /= il; iz /= il; ox /= ol; oz /= ol;
    const dot = ix * ox + iz * oz, cross = ix * oz - iz * ox; // world: +x is to the left when facing +z
    const kind = dot < -0.6 ? 'back' : cross > 0.35 ? 'right' : cross < -0.35 ? 'left' : 'straight';
    this.marker.arrow(kind, ix, iz);
  }
  updateRace(dt) {
    const j = this.job, G = this.G;
    const pp = this.api.playerPos();
    const p = j.pts[j.k];
    if (j.started) {
      j.t -= dt;
      if (j.t <= 0) return this.endJob('🏁 Zeit abgelaufen – Rennen verloren');
    }
    if (Math.hypot(pp.x - p.x, pp.z - p.z) < 10) {
      if (!j.started) {
        if (!G.player.inVehicle) { this.setJobHUD('🏁 ZEITRENNEN', 'Du brauchst ein Fahrzeug!', 'Schnapp dir ein Auto und fahr zum Start', true); return; }
        j.started = true;
        j.t = j.tl;
        this.api.banner('🏁 LOS!', `${j.pts.length - 1} Checkpoints · ${j.tl} s`);
      } else G.audio.tone(0.2, 900, 1400, 0.1, 'triangle');
      j.k++;
      if (j.k >= j.pts.length) {
        const pay = ecoPay(Math.min(4000, 1200 + j.t * 70));
        this.api.addMoney(pay);
        this.endJob(null);
        this.api.banner('🏁 GESCHAFFT!', `${Math.round(j.t)} s übrig · +${fmt(pay)} D$`);
        return;
      }
      this.raceMark();
    }
    const tm = Math.max(0, Math.ceil(j.t));
    this.setJobHUD('🏁 ZEITRENNEN', j.started ? `Checkpoint ${j.k}/${j.pts.length - 1}` : 'Fahr zum Start', j.started ? `⏱ ${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}` : `Zeitlimit: ${j.tl} s`, j.started && j.t < 10);
  }
  // --- hit ---
  startHit() {
    const pp = this.api.playerPos();
    const p = this.stopPoint(pp, 140, 380);
    const vip = new Ped(this.scene, { skin: '#e0ac85', hair: '#111', shirt: '#d4af37', pants: '#111', shoes: '#111', hairStyle: 0 }, p.x, p.z);
    vip.hp = 60;
    vip.walk = 0.9;
    vip.isTarget = true;
    vip.keep = true;
    this.G.peds.push(vip);
    const look = { skin: '#c68a62', hair: '#111', shirt: '#111', pants: '#111', shoes: '#111', hairStyle: 0, cop: true };
    const guards = [];
    for (const s2 of [-1, 1]) {
      const gd = new Ped(this.scene, look, p.x + s2 * 1.6, p.z + 1, 'guard');
      gd.post = null;
      gd.follow = vip;
      gd.calm = true;
      gd.keep = true;
      this.G.peds.push(gd);
      guards.push(gd);
    }
    this.job = { kind: 'hit', vip, guards };
    this.api.banner('🎯 ATTENTAT', 'Finde den Mann in Gold und erledige ihn');
  }
  updateHit(dt) {
    const j = this.job;
    const v = j.vip;
    // bodyguards follow the target and only fight when shots fall
    for (const gd of j.guards) {
      if (gd.dead) continue;
      if (gd.calm) gd.post = { x: v.pos.x + (gd.id % 2 ? 1.6 : -1.6), z: v.pos.z - 1 };
      if (gd.calm && (gd.hp < 70 || v.hp < 60 || v.fleeT > 0)) gd.calm = false;
    }
    if (v.removed) return this.endJob('🎯 Ziel entkommen');
    this.marker.set(v.pos.x, v.pos.z);
    this.G.missionTarget = { x: v.pos.x, z: v.pos.z, color: '#ff4040' };
    const pp = this.api.playerPos();
    if (v.dead) {
      this.api.addMoney(ecoPay(3500));
      this.api.setStars(Math.max(2, this.G.wanted.stars), 'Mord an einem VIP gemeldet');
      this.endJob(null);
      this.api.banner('🎯 ZIEL AUSGESCHALTET', `+${fmtD(ecoPay(3500))} D$ · Häng die Polizei ab`);
      for (const gd of j.guards) gd.follow = null;
      return;
    }
    this.setJobHUD('🎯 ATTENTAT', 'Mann in Gold mit 2 Bodyguards', `📍 ${Math.round(Math.hypot(pp.x - v.pos.x, pp.z - v.pos.z))} m`, false);
  }
  // --- Radj delivery ---
  startRadj() {
    const opts = [['village', 'Wüstendorf'], ['camp', 'Wüstencamp'], ['hofNW', 'Einsamer Hof (Ost)'], ['hofNO', 'Einsamer Hof (West)'], ['hofS', 'Südhof'], ['hofHuegel', 'Hügelhof'], ['villa', 'Wüstenvilla']];
    const [key, nm] = pick(opts);
    // meet on the access road in front of the place, never inside a house
    let p = { x: POI[key].x, z: POI[key].z, name: nm }, bd = 1e9;
    for (const r of ROADS) {
      if (r.kind === 'deck' || !r.samples) continue;
      for (const q of r.samples) {
        const d = Math.hypot(q.x - POI[key].x, q.z - POI[key].z);
        if (d > POI[key].r * 0.6 && d < bd) { bd = d; p = { x: q.x, z: q.z, name: nm }; }
      }
    }
    this.job = { kind: 'radj', stage: 'pick', target: { x: p.x, z: p.z }, name: p.name, load: 0, clean: true };
    this.marker.set(p.x, p.z);
    this.G.missionTarget = { x: p.x, z: p.z, color: '#ffd23b' };
    this.api.banner('📦 RADJS LIEFERUNG', `Hol die Ware ab: ${p.name}`);
  }
  radjLoad() {
    const j = this.job;
    if (j.stage !== 'pick' || j.loading) return;
    j.loading = 3;
  }
  updateRadj(dt) {
    const j = this.job, G = this.G;
    const pp = this.api.playerPos();
    const v = G.player.inVehicle;
    if (j.stage === 'pick') {
      if (j.loading) {
        if (!v || Math.hypot(pp.x - j.target.x, pp.z - j.target.z) > 10) { j.loading = 0; }
        else {
          j.loading -= dt;
          if (j.loading <= 0) {
            j.loading = 0;
            j.stage = 'deliver';
            j.veh = v;
            const w = world.radjWarehouse;
            j.target = { x: w.x, z: w.z };
            this.marker.set(w.x, w.z);
            G.missionTarget = { x: w.x, z: w.z, color: '#ff2a2a' };
            if (Math.random() < 0.4) { j.clean = false; this.api.setStars(2, 'Jemand hat die Polizei gerufen!'); }
            this.api.toast('📦 Ware geladen – ab zu Radjs Lagerhalle (Docks)');
          }
        }
      }
      this.setJobHUD('📦 RADJS LIEFERUNG', `Abholen: ${j.name}`, j.loading ? `Einladen… ${Math.ceil(j.loading)} s` : `📍 ${Math.round(Math.hypot(pp.x - j.target.x, pp.z - j.target.z))} m · mit Fahrzeug halten, dann START`, false);
      return;
    }
    if (j.veh && (j.veh.dead || j.veh.removed)) return this.endJob('📦 Ware zerstört – Lieferung gescheitert');
    const d = Math.hypot(pp.x - j.target.x, pp.z - j.target.z);
    if (d < 12) {
      if (G.wanted.stars > 0) { this.setJobHUD('📦 RADJS LIEFERUNG', 'Radj nimmt nichts mit Bullen im Nacken!', 'Häng erst die Polizei ab', true); return; }
      if (v !== j.veh) { this.setJobHUD('📦 RADJS LIEFERUNG', 'Die Ware ist im Fahrzeug', 'Bring das Fahrzeug mit der Ware hierher', true); return; }
      const pay = ecoPay(rand(4000, 5500) + (j.clean ? 1000 : 0));
      this.api.addMoney(pay);
      this.endJob(null);
      this.api.banner('📦 GELIEFERT', `+${fmt(pay)} D$${j.clean ? ' (inkl. ${fmtD(ecoPay(1000))} D$ Sauber-Bonus)' : ''}`);
      return;
    }
    this.setJobHUD('📦 RADJS LIEFERUNG', 'Bring die Ware zu Radjs Lagerhalle', `📍 ${Math.round(d)} m${G.wanted.stars ? ' · ⭐ erst abhängen' : ''}`, false);
  }

  // ---------- Docks-Coup (like in the 2D Dildi City) ----------
  startDocks(v) {
    this.job = { kind: 'docks', stage: 'load', veh: v, t: 3 };
    this.api.toast('📦 Fracht wird geladen – stehen bleiben!');
  }
  updateDocks(dt) {
    const j = this.job, G = this.G, dc = world.docksCargo;
    const v = G.player.inVehicle;
    if (j.veh.dead || j.veh.removed) return this.endJob('📦 Transporter zerstört – Fracht weg');
    if (j.stage === 'load') {
      if (v !== j.veh || Math.hypot(v.pos.x - dc.x, v.pos.z - dc.z) > 9 || Math.abs(v.vF) > 1.5) {
        this.setJobHUD('📦 DOCKS-COUP', 'Laden unterbrochen', 'Mit dem Transporter auf dem Ladeplatz stehen bleiben', true);
        if (v !== j.veh || Math.hypot(v.pos.x - dc.x, v.pos.z - dc.z) > 14) return this.endJob('📦 Laden abgebrochen');
        return;
      }
      j.t -= dt;
      this.setJobHUD('📦 DOCKS-COUP', 'Fracht wird geladen…', `${Math.max(0, j.t).toFixed(1)} s`, false);
      if (j.t <= 0) {
        j.stage = 'run';
        robDone('docks');
        this.api.setStars(4, 'Diebstahl an den Docks gemeldet!');
        G.wanted.lock = 4; // like in 2D: the stars stay until the cargo is at the hideout
        const h = world.hideout;
        this.marker.set(h.x, h.z);
        G.missionTarget = { x: h.x, z: h.z, color: '#ff9a3c' };
        this.api.banner('📦 FRACHT GELADEN', '4 Sterne – ab zum Versteck!');
      }
      return;
    }
    const h = world.hideout;
    const pp = this.api.playerPos();
    const d = Math.hypot(pp.x - h.x, pp.z - h.z);
    if (d < 12) {
      if (v !== j.veh) { this.setJobHUD('📦 DOCKS-COUP', 'Die Fracht ist im Transporter!', 'Hol den Transporter hierher', true); return; }
      this.api.addMoney(ecoPay(20000));
      G.wanted.lock = 0;
      this.api.setStars(0);
      this.endJob(null);
      this.api.banner('📦 FRACHT VERKAUFT', `+${fmtD(ecoPay(20000))} D$`);
      return;
    }
    this.setJobHUD('📦 DOCKS-COUP', 'Bring die Fracht zum Versteck', `📍 ${Math.round(d)} m${v !== j.veh ? ' · 🚐 Transporter zurückholen!' : ''}`, false);
  }

  // ---------- Pizza Capri ----------
  startPizza() {
    const G = this.G, P = world.pizza;
    const v = new Vehicle(this.scene, 'roller', P.spawn.x, P.spawn.z, P.spawn.h, '#c0392b');
    G.vehicles.push(v);
    this.api.putPlayerInVehicle(v);
    this.job = { kind: 'pizza', veh: v, pizzas: 3, heat: 100, streak: 0, earn: 0, stage: 'deliver', awayT: 0, done: 0 };
    this.nextPizza({ x: P.x, z: P.z });
    this.api.banner('🍕 PIZZA CAPRI', 'Liefer sie heiß aus – heiß = mehr Trinkgeld!');
  }
  nextPizza(from) {
    const j = this.job;
    const NAMES = ['Familie Müller', 'WG Chaos', 'Oma Hilde', 'Büro Sigma AG', 'Herr Krause', 'Die Zwillinge', 'Studenten-WG', 'Frau Yilmaz', 'Dr. Schulz', 'Familie Becker'];
    if (j.pizzas <= 0) {
      j.stage = 'refill';
      const P = world.pizza;
      j.target = { x: P.x, z: P.z, name: 'Pizza Capri (Nachschub)' };
    } else {
      j.stage = 'deliver';
      const p = this.stopPoint(from, 120, 380);
      j.target = { ...p, name: pick(NAMES) };
      j.heat = 100;
    }
    this.marker.set(j.target.x, j.target.z);
    this.G.missionTarget = { x: j.target.x, z: j.target.z, color: j.stage === 'refill' ? '#ff5a1f' : '#ffd23b' };
  }
  updatePizza(dt) {
    const G = this.G, j = this.job, v = j.veh;
    if (v.dead || v.removed) return this.endJob('🍕 Roller kaputt – Schicht beendet');
    if (G.player.inVehicle !== v) {
      j.awayT += dt;
      if (j.awayT > 25) return this.endJob('🍕 Roller verlassen – Schicht beendet');
    } else j.awayT = 0;
    if (j.stage === 'deliver') j.heat = Math.max(0, j.heat - dt * 1.4);
    const t = j.target;
    const d = Math.hypot(v.pos.x - t.x, v.pos.z - t.z);
    if (d < 7 && Math.abs(v.vF) < 3 && G.player.inVehicle === v) {
      if (j.stage === 'deliver') {
        const hot = j.heat;
        j.streak = hot > 40 ? j.streak + 1 : 0;
        const pay = ecoPay(120 + hot * 5 + Math.min(600, j.streak * 60));
        j.earn += pay;
        j.done++;
        j.pizzas--;
        this.api.addMoney(pay);
        this.api.toast(`🍕 ${t.name}: +${fmt(pay)} D$${hot > 70 ? ' 🔥 heiß!' : hot < 25 ? ' (kalt…)' : ''}${j.streak > 1 ? ` · Serie ×${j.streak}` : ''}`);
        G.audio.pickup();
        this.nextPizza(t);
      } else {
        j.pizzas = 3;
        this.api.toast('🍕 3 frische Pizzen geladen');
        this.nextPizza(t);
      }
    }
    const heatBar = '🔥'.repeat(Math.ceil(j.heat / 20)) || '🧊';
    this.setJobHUD('🍕 PIZZA CAPRI', j.stage === 'refill' ? 'Zurück zur Pizzeria – Nachschub holen' : `Liefern an ${t.name} · ${Math.round(d)} m`, j.stage === 'refill' ? `Verdient: ${fmt(j.earn)} D$ · ${j.done} geliefert` : `${heatBar} · Pizzen: ${j.pizzas} · Serie ${j.streak} · ${fmt(j.earn)} D$`, j.stage === 'deliver' && j.heat < 25);
  }
  endJob(msg) {
    if (msg) this.api.toast(msg);
    if (this.job && this.job.kind === 'hit') for (const gd of this.job.guards) { gd.follow = null; if (!gd.dead) gd.calm = false; }
    if (this.job && this.job.kind === 'docks') this.G.wanted.lock = 0;
    this.job = null;
    this.marker.clear();
    this.G.missionTarget = null;
    this.setJobHUD(null);
  }
  abort() {
    if (this.job && this.job.kind === 'coup') return this.failCoup('Mission abgebrochen');
    if (this.job) this.endJob('Auftrag abgebrochen');
    if (this.bank.state !== 'idle') this.failBank('Überfall abgebrochen');
  }

  // ---------- bank robbery ----------
  bankAvailable() {
    { const r = robCheck('bank'); if (r) return '🏦 ' + r; }
    const retry = +store.get('dc3d_bankRetry') || 0;
    if (Date.now() < retry) return `🏦 Zu viel Polizei – in ${Math.ceil((retry - Date.now()) / 60000)} Min. wieder`;
    if (this.job) return '🏦 Erst den Auftrag beenden';
    // like in 2D: only with your own RS6 parked in front of the bank (getaway car)
    const c = this.G.myCar, B = world.bank;
    if (!c || c.removed || c.dead || c.type !== 'rs6' || Math.hypot(c.pos.x - B.outside.x, c.pos.z - B.outside.z) > 40) return '🏦 Nur mit deinem eigenen RS6 als Fluchtwagen vor der Bank';
    return true;
  }
  startBank() {
    const G = this.G, B = world.bank;
    this.bank = { state: 'fight', guards: [], code: [0, 0, 0].map(() => Math.floor(rand(5, 95))), step: 0, loot: 0 };
    const look = { skin: '#e0ac85', hair: '#222', shirt: '#22262e', pants: '#15171c', shoes: '#111', hairStyle: 0, cap: '#111', cop: true };
    for (const [x, z] of B.guards) {
      const gd = new Ped(this.scene, look, x, z, 'guard');
      gd.post = { x, z };
      gd.shootT = rand(1.2, 2.2);
      G.peds.push(gd);
      this.bank.guards.push(gd);
    }
    setMask(G.player.h, true);
    this.scareAll(80);
    this.api.banner('🏦 ÜBERFALL!', 'Sturmhaube auf – schalte die 6 Wachen aus');
    G.audio.star();
  }
  // everybody near the masked robber runs away
  scareAll(r) {
    const G = this.G, pp = this.api.playerPos();
    for (const p of G.peds) if (p.role === 'civ' && !p.isTarget && !p.dead && Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z) < r) p.scare(pp.x, pp.z, 10);
  }
  updateBank(dt) {
    const G = this.G, B = world.bank, st = this.bank;
    st.scareT = (st.scareT || 0) - dt;
    if (st.scareT < 0) { st.scareT = 1; this.scareAll(70); }
    if (st.state === 'fight') {
      const alive = st.guards.filter((g) => !g.dead && !g.removed).length;
      this.setJobHUD('🏦 BANKÜBERFALL', 'Schalte die Wachen aus', `🔫 Wachen übrig: ${alive}/6`, false);
      if (alive === 0) {
        st.state = 'vault';
        this.marker.set(B.vault.x, B.vault.z);
        G.missionTarget = { x: B.vault.x, z: B.vault.z, color: '#ffd23b' };
        this.api.banner('🔐 TRESOR', 'Alle Wachen erledigt – knack den Tresor!');
      }
    } else if (st.state === 'vault') {
      this.setJobHUD('🏦 BANKÜBERFALL', 'Knack den Tresor', 'Geh zur Tresortür (EIN)', false);
    } else if (st.state === 'opening') {
      st.openT += dt;
      const t = clamp(st.openT / 1.8, 0, 1);
      B.door.rotation.y = -t * 1.9;
      if (t >= 1) {
        st.state = 'loot';
        B.doorCol.off = true;
        this.api.setStars(3, 'Stiller Alarm ausgelöst!');
        this.marker.clear();
        G.missionTarget = null;
      }
    } else if (st.state === 'loot') {
      const pp = G.player.pos;
      for (const l of B.loot) {
        if (l.taken) continue;
        if (Math.hypot(pp.x - l.x, pp.z - l.z) < 2.3) {
          l.taken = true;
          l.g.visible = false;
          st.loot++;
          G.audio.pickup();
          this.api.toast(`💰 Beute ${st.loot}/3`);
        }
      }
      this.setJobHUD('🏦 BANKÜBERFALL', 'Schnapp dir die Beute', `💰 ${st.loot}/3 Geldstapel`, false);
      if (st.loot >= 3) {
        st.state = 'escape';
        const h = world.hideout;
        this.marker.set(h.x, h.z);
        G.missionTarget = { x: h.x, z: h.z, color: '#39ff88' };
        this.api.banner('🚨 ABHAUEN!', `Bring die Beute (${fmtD(ecoPay(25000))} D$) ins Versteck`);
      }
    } else if (st.state === 'escape') {
      const pp = this.api.playerPos();
      const h = world.hideout;
      const d = Math.hypot(pp.x - h.x, pp.z - h.z);
      this.setJobHUD('🏦 BANKÜBERFALL', 'Bring die Beute ins Versteck', `💰 ${fmtD(ecoPay(25000))} D$ · 📍 ${Math.round(d)} m`, false);
      if (d < 9) {
        robDone('bank');
        this.api.addMoney(ecoPay(25000));
        this.api.setStars(0);
        this.api.banner('💰 ÜBERFALL GESCHAFFT', `+${fmtD(ecoPay(25000))} D$ · ${season.on ? 'Nächster Überfall in 30 Min.' : 'Die Bank öffnet morgen wieder'}`);
        this.resetBank();
      }
    }
  }
  failBank(msg) {
    store.set('dc3d_bankRetry', String(Date.now() + 10 * 60000));
    this.api.toast(`🏦 ${msg} – Beute weg. Nächster Versuch in 10 Min.`);
    this.resetBank();
  }
  resetBank() {
    const B = world.bank;
    for (const g of this.bank.guards || []) if (!g.removed) g.remove();
    this.bank = { state: 'idle', guards: [] };
    setMask(this.G.player.h, false);
    B.door.rotation.y = 0;
    B.doorCol.off = false;
    for (const l of B.loot) { l.taken = false; l.g.visible = true; }
    this.marker.clear();
    this.G.missionTarget = null;
    this.setJobHUD(null);
    this.closeDial(true);
  }
  // vault dial minigame
  openDial() {
    const st = this.bank;
    this.G.paused = true;
    st.dialVal = 0;
    st.lockT = 0;
    this.dialAngle = 0;
    $('dial').classList.add('show');
    this.drawDial();
  }
  closeDial(silent) {
    $('dial').classList.remove('show');
    if (!silent) this.G.paused = false;
  }
  dialTurn(deltaDeg) {
    const st = this.bank;
    if (st.state !== 'vault') return;
    this.dialAngle += deltaDeg;
    const v = ((Math.round(-this.dialAngle / 3.6) % 100) + 100) % 100;
    if (v !== st.dialVal) {
      st.dialVal = v;
      const target = st.code[st.step];
      const dist = Math.min(Math.abs(v - target), 100 - Math.abs(v - target));
      // tick sound, louder/higher when close
      this.G.audio.tone(dist <= 1 ? 0.25 : 0.08, dist <= 1 ? 1900 : 700 + (15 - Math.min(15, dist)) * 50, 600, 0.03, 'square');
      if (dist <= 1 && navigator.vibrate) try { navigator.vibrate(25); } catch (e) {}
    }
    this.drawDial();
  }
  dialLock() {
    const st = this.bank;
    if (st.state !== 'vault' || performance.now() < (st.lockT || 0)) return;
    const target = st.code[st.step];
    const dist = Math.min(Math.abs(st.dialVal - target), 100 - Math.abs(st.dialVal - target));
    if (dist <= 1) {
      st.step++;
      this.G.audio.tone(0.3, 1200, 2400, 0.15, 'triangle');
      if (st.step >= 3) {
        this.closeDial();
        st.state = 'opening';
        st.openT = 0;
        this.api.banner('🔓 TRESOR OFFEN', 'Schnapp dir die Beute – der Alarm läuft!');
        return;
      }
    } else {
      st.lockT = performance.now() + 2000;
      this.G.audio.tone(0.3, 220, 110, 0.4, 'sawtooth');
      $('dialMsg').textContent = '❌ Falsch! 2 Sekunden gesperrt…';
      setTimeout(() => this.drawDial(), 2050);
    }
    this.drawDial();
  }
  drawDial() {
    const st = this.bank;
    if (!st.code) return;
    const target = st.code[st.step] ?? 0;
    const dist = Math.min(Math.abs((st.dialVal || 0) - target), 100 - Math.abs((st.dialVal || 0) - target));
    const close = clamp(1 - dist / 25, 0, 1);
    $('dialFace').style.transform = `rotate(${this.dialAngle || 0}deg)`;
    $('dialNum').textContent = String(st.dialVal || 0).padStart(2, '0');
    $('dialFeel').style.width = close * 100 + '%';
    $('dialFeel').style.background = dist <= 1 ? '#3dff6a' : close > 0.7 ? '#ffd23b' : '#ff6a3d';
    $('dialSteps').innerHTML = [0, 1, 2].map((i) => `<span class="${i < st.step ? 'ok' : i === st.step ? 'cur' : ''}">${i < st.step ? String(st.code[i]).padStart(2, '0') : '??'}</span>`).join('');
    if (performance.now() >= (st.lockT || 0)) $('dialMsg').textContent = dist <= 1 ? '✅ Klick! Jetzt EINRASTEN' : 'Dreh langsam – hör auf das Klicken und schau auf den Balken';
  }

  // ---------- HUD ----------
  setJobHUD(title, line, sub, urgent) {
    const el = $('job');
    if (!title) { el.classList.remove('show'); this._hud = null; return; }
    const key = title + line + sub + urgent;
    if (this._hud === key) return;
    this._hud = key;
    el.classList.add('show');
    el.classList.toggle('urgent', !!urgent);
    $('jobTitle').textContent = title;
    $('jobLine').textContent = line;
    $('jobSub').textContent = sub;
  }
  bindUI() {
    $('garageClose').addEventListener('click', () => this.closeGarage());
    $('custClose').addEventListener('click', () => this.closeCustoms());
    $('coupClose').addEventListener('click', () => this.closeBoard());
    $('coupGo').addEventListener('click', () => this.startCoup());
    $('hackExit').addEventListener('click', () => this.closeHack());
    $('cutExit').addEventListener('click', () => this.closeCutter(false));
    $('winOk').addEventListener('click', () => { $('win').classList.remove('show'); this.G.paused = false; });
    $('phoneYes').addEventListener('click', () => this.acceptOffer(true));
    $('phoneNo').addEventListener('click', () => this.acceptOffer(false));
    $('callYes').addEventListener('click', () => this.takeCall(true));
    $('callNo').addEventListener('click', () => this.takeCall(false));
    // dial: drag to rotate, buttons for fine control
    const face = $('dialWrap');
    let lastX = null;
    const down = (x) => { lastX = x; };
    const move = (x) => { if (lastX === null) return; const d = x - lastX; lastX = x; this.dialTurn(d * 0.55); };
    const up = () => { lastX = null; };
    face.addEventListener('pointerdown', (e) => { e.preventDefault(); face.setPointerCapture && face.setPointerCapture(e.pointerId); down(e.clientX); });
    face.addEventListener('pointermove', (e) => move(e.clientX));
    face.addEventListener('pointerup', up);
    face.addEventListener('pointercancel', up);
    $('dialL').addEventListener('click', () => this.dialTurn(3.6));
    $('dialR').addEventListener('click', () => this.dialTurn(-3.6));
    $('dialLock').addEventListener('click', () => this.dialLock());
    $('dialExit').addEventListener('click', () => this.closeDial());
    window.addEventListener('keydown', (e) => {
      if (!$('dial').classList.contains('show')) return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') this.dialTurn(3.6);
      if (k === 'd' || k === 'arrowright') this.dialTurn(-3.6);
      if (k === ' ' || k === 'enter') { e.preventDefault(); this.dialLock(); }
      if (k === 'escape') this.closeDial();
    });
  }

  update(dt) {
    const G = this.G;
    if (this.job) {
      const k = this.job.kind;
      if (k === 'pizza') this.updatePizza(dt);
      else if (k === 'bottles') this.updateBottles(dt);
      else if (k === 'race') this.updateRace(dt);
      else if (k === 'hit') this.updateHit(dt);
      else if (k === 'radj') this.updateRadj(dt);
      else if (k === 'docks') this.updateDocks(dt);
      else if (k === 'coup') this.updateCoup(dt);
    }
    this.updatePhones(dt);
    // the Radj-Insel is only drawn when you are on its way (saves a lot of GPU time in the city)
    if (this.isl) {
      const pp = this.api.playerPos(), f = this.G.flight;
      const vis = pp.z < -620 || !!(f && f.pos.z < -380); // must be a real true/false (three.js only hides on === false)
      if (this.isl.root.visible !== vis) this.isl.root.visible = vis;
    }
    const busy = this.busy();
    for (const st of this.starts) {
      st.grp.visible = !busy || (st.key === 'bank' && this.bank.state === 'idle' && !this.job);
      st.spr.position.y = 3.6 + Math.sin(G.time * 2.5 + st.x) * 0.15;
    }
    if (this.bank.state !== 'idle') this.updateBank(dt);
    this.marker.update(G.time);
  }
  onPlayerDeath() {
    if (this.job && this.job.kind === 'coup') return this.failCoup('Du bist gestorben');
    if (this.job) this.endJob('🍾 Tour abgebrochen');
    if (this.bank.state !== 'idle') this.failBank('Überfall gescheitert');
  }
  busy() { return !!this.job || this.bank.state !== 'idle'; }
}
installHeist(Missions);
installFinale(Missions);
installCutter(Missions);
