import * as THREE from 'three';
import { world, BOUND, NB, roadC, RW, H } from './world.js';
import { DOCKS, AIRPORT } from './outskirts.js';
import { LAKE, RUNWAY, ISLAND, COAST_Z, WORLD, WALL_OUT, ROADS, DESERTS, terrainH, slopeAt, RADJ, radjE, KREISEL } from './geo.js';
import { ISL } from './radj.js';
import { clamp, angleWrap, canvasTex } from './util.js';

// map orientation: north (+z, desert) is up. Because the world is "right = -x", +x is drawn to the left.
// the map reaches south far enough to include Radj's island
const XMAX = WORLD.x1, XMIN = WORLD.x0, ZMAX = WORLD.z1, ZMIN = Math.min(WORLD.z0, RADJ.z - RADJ.rz * 1.15 - 30);
const S = 1.15; // map pixels per meter
const W = Math.ceil((XMAX - XMIN) * S), Hh = Math.ceil((ZMAX - ZMIN) * S);
export const toMap = (x, z) => [(XMAX - x) * S, (ZMAX - z) * S];
export const fromMap = (px, py) => [XMAX - px / S, ZMAX - py / S];

let mapCanvas;
export function buildMapCanvas() {
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = W;
  mapCanvas.height = Hh;
  const ctx = mapCanvas.getContext('2d');
  const rect = (x0, x1, z0, z1, col) => {
    const [ax, ay] = toMap(x1, z1);
    const [bx, by] = toMap(x0, z0);
    ctx.fillStyle = col;
    ctx.fillRect(ax, ay, bx - ax, by - ay);
  };
  // water
  ctx.fillStyle = '#2a6585';
  ctx.fillRect(0, 0, W, Hh);
  // terrain (sampled), shaded by height + slope
  {
    const step = 4;
    for (let z = COAST_Z; z < ZMAX; z += step)
      for (let x = XMIN; x < XMAX; x += step) {
        if (Math.abs(x) < WALL_OUT && Math.abs(z) < WALL_OUT) continue;
        const h = terrainH(x + 2, z + 2);
        const sl = slopeAt(x + 2, z + 2);
        let r, g, b;
        if (z > -WALL_OUT) { r = 220; g = 192; b = 134; }
        else { r = 122; g = 160; b = 82; }
        const k = Math.min(1, Math.max(0, (h - 16) / 40));
        r = r + (150 - r) * k; g = g + (118 - g) * k; b = b + (84 - b) * k;
        const shade = 1 - Math.min(0.35, h / 260);
        ctx.fillStyle = `rgb(${(r * shade) | 0},${(g * shade) | 0},${(b * shade) | 0})`;
        const [px, py] = toMap(x + step, z + step);
        ctx.fillRect(px, py, step * S + 0.6, step * S + 0.6);
      }
  }
  rect(-WALL_OUT, WALL_OUT, -WALL_OUT, WALL_OUT, '#8f8c85');
  rect(-BOUND, BOUND, -BOUND, BOUND, '#cfcabe');
  rect(DOCKS.x0, DOCKS.x1, DOCKS.z0, DOCKS.z1, '#9a988f');
  rect(AIRPORT.x0, AIRPORT.x1, AIRPORT.z0, AIRPORT.z1, '#86ab62');
  rect(-10, 10, ISLAND.z0, ISLAND.z1, '#9a988f');
  rect(30, 220, -690, -662, '#55585e');
  rect(RUNWAY.x0, RUNWAY.x1, RUNWAY.z0, RUNWAY.z1, '#7a766d');
  // lake
  {
    const [lx, ly] = toMap(LAKE.x, LAKE.z);
    ctx.fillStyle = '#3d8fb5';
    ctx.beginPath();
    ctx.arc(lx, ly, LAKE.r * S, 0, Math.PI * 2);
    ctx.fill();
  }
  rect(-8, 8, -472, -418, '#565a60');
  // city blocks + roads
  ctx.fillStyle = '#4a4e55';
  for (let i = 0; i <= NB; i++) {
    const c = roadC(i);
    rect(c - RW, c + RW, -H - RW, H + RW, '#4a4e55');
    rect(-H - RW, H + RW, c - RW, c + RW, '#4a4e55');
  }
  for (const b of world.blocks) rect(b.x0, b.x1, b.z0, b.z1, b.type === 'park' ? '#5c9e4a' : '#b3aea4');
  for (const st of world.sideStreets) rect(st.x0, st.x1, st.z0, st.z1, '#4a4e55');
  for (const e of world.exits) {
    const o0 = e.dir > 0 ? H : -WALL_OUT, o1 = e.dir > 0 ? WALL_OUT : -H;
    if (e.axis === 'z') rect(e.c - RW, e.c + RW, o0, o1, '#4a4e55'); else rect(o0, o1, e.c - RW, e.c + RW, '#4a4e55');
  }
  // outskirts roads (ribbons)
  ctx.strokeStyle = '#4a4e55';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const r of ROADS) {
    const sm = r.samples;
    ctx.strokeStyle = r.kind === 'dirt' ? '#9a8058' : r.kind === 'deck' ? '#3a3e45' : '#4a4e55';
    ctx.lineWidth = (r.w || 10) * S;
    ctx.beginPath();
    sm.forEach((p, i) => {
      const [x, y] = toMap(p.x, p.z);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  // roundabout centre island
  {
    const [kx, ky] = toMap(KREISEL.x, KREISEL.z);
    ctx.fillStyle = '#5c9e4a';
    ctx.beginPath();
    ctx.arc(kx, ky, (KREISEL.r - KREISEL.w / 2 - 0.4) * S, 0, Math.PI * 2);
    ctx.fill();
  }
  // buildings
  ctx.fillStyle = '#86837d';
  for (const c of world.colliders) {
    if (c.t !== 'b' || c.inv || c.h <= 3 || c.x1 - c.x0 < 2 || c.z1 - c.z0 < 2) continue;
    rect(c.x0, c.x1, c.z0, c.z1, c.h > 40 ? '#77746f' : '#8f8c85');
  }
  drawRadjIsland(ctx, rect);
  // area labels
  ctx.font = `900 ${Math.round(22 * S)}px Arial Black, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  const label = (t, x, z) => { const [px, py] = toMap(x, z); ctx.fillText(t, px, py); };
  for (const D of DESERTS) label(D.name.toUpperCase(), D.x, D.z - 200);
  label('DOCKS', -120, -480);
  label('FLUGHAFEN', 120, -480);
  label('RADJ-INSEL', RADJ.x, RADJ.z - RADJ.rz - 22);
  return mapCanvas;
}

// Radj's island (far south, reached by plane): beach, forest, airstrip, roads, estate
function drawRadjIsland(ctx, rect) {
  const step = 3;
  const sand = [217, 196, 142], grass = [74, 120, 58], forest = [46, 88, 42];
  for (let z = RADJ.z - RADJ.rz * 1.15; z < RADJ.z + RADJ.rz * 1.15; z += step)
    for (let x = RADJ.x - RADJ.rx * 1.15; x < RADJ.x + RADJ.rx * 1.15; x += step) {
      const e = radjE(x + step / 2, z + step / 2);
      if (e > 1.0) continue;
      const tb = Math.min(1, Math.max(0, (e - 0.62) / 0.2)); // beach blend like the 3D ground
      // dense forest pattern (cheap hash noise) away from the beach
      const n = Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.09 - x * 0.03);
      const base = e < 0.7 && n > -0.2 ? forest : grass;
      const c = base.map((v, i) => Math.round(v + (sand[i] - v) * tb));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      const [px, py] = toMap(x + step, z + step);
      ctx.fillRect(px, py, step * S + 0.6, step * S + 0.6);
    }
  // roads (same curve as the 3D gravel ribbon)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [pts, w] of [[ISL.road, 8], [ISL.helRoad, 7]]) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.4);
    ctx.strokeStyle = '#b8a77f';
    ctx.lineWidth = w * S;
    ctx.beginPath();
    curve.getSpacedPoints(80).forEach((p, i) => { const [x, y] = toMap(p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }
  const St = ISL.strip, E = ISL.estate, M = ISL.mansion, g = ISL.gate, wg = ISL.westGate;
  rect(St.x0, St.x1, St.z0, St.z1, '#3a3c40');
  // estate: wall, lawn, drive, mansion + wings, pool, garage, helipad
  rect(E.x0 - 1, E.x1 + 1, E.z0 - 1, E.z1 + 1, '#e8dfcc');
  rect(E.x0 + 1, E.x1 - 1, E.z0 + 1, E.z1 - 1, '#5fa34c');
  rect(g.x - 4, g.x + 4, M.z1, E.z1, '#d3c6a4');
  rect(E.x0 + 2, E.x1 - 2, wg.z - 3, wg.z + 3, '#d3c6a4');
  rect(M.x0 - 14, M.x1 + 14, M.z0 + 6, M.z1 - 8, '#a65a3c');
  rect(M.x0, M.x1, M.z0, M.z1, '#b5623f');
  rect(82, 108, -1302, -1288, '#2fb6d8');
  rect(-36, -14, -1302, -1284, '#5a5d62');
  const [hx, hy] = toMap(ISL.helipad.x, ISL.helipad.z);
  ctx.fillStyle = '#3a3c40';
  ctx.beginPath();
  ctx.arc(hx, hy, 9 * S, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- waypoint (marker + light beam) ----------
export class Waypoint {
  constructor(scene) {
    const tex = canvasTex(16, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,61,240,0)');
      g.addColorStop(0.6, 'rgba(255,61,240,0.5)');
      g.addColorStop(1, 'rgba(255,200,250,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, false);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 160, 16, 1, true), mat);
    this.beam.position.y = 80;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 32), new THREE.MeshBasicMaterial({ color: '#ff3df0', transparent: true, opacity: 0.8, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    this.ring = ring;
    this.group = new THREE.Group();
    this.group.add(this.beam, ring);
    this.group.visible = false;
    scene.add(this.group);
    this.pos = null;
  }
  set(x, z) {
    this.pos = { x, z };
    this.group.position.set(x, 0, z);
    this.group.visible = true;
  }
  clear() {
    this.pos = null;
    this.group.visible = false;
  }
  update(t) {
    if (!this.pos) return;
    const s = 1 + Math.sin(t * 4) * 0.12;
    this.ring.scale.set(s, s, s);
    this.beam.rotation.y = t;
  }
}

// ---------- minimap ----------
export function drawMinimap(mctx, S2, G, cam, pp, heading, zoomM) {
  // zoomM = meters visible across the minimap diameter
  const sc = S2 / zoomM / S; // screen px per map px
  const [px, py] = toMap(pp.x, pp.z);
  const fx = -Math.sin(cam.yaw), fy = -Math.cos(cam.yaw); // camera forward in map space
  const rot = -Math.PI / 2 - Math.atan2(fy, fx);
  mctx.save();
  mctx.clearRect(0, 0, S2, S2);
  mctx.beginPath();
  mctx.arc(S2 / 2, S2 / 2, S2 / 2 - 2, 0, Math.PI * 2);
  mctx.clip();
  mctx.fillStyle = '#2f6a8a';
  mctx.fillRect(0, 0, S2, S2);
  mctx.translate(S2 / 2, S2 / 2);
  mctx.rotate(rot);
  mctx.scale(sc, sc);
  mctx.drawImage(mapCanvas, -px, -py);
  // icons (counter-rotated)
  const icon = (x, z, txt, size) => {
    const [ix, iy] = toMap(x, z);
    mctx.save();
    mctx.translate(ix - px, iy - py);
    mctx.rotate(-rot);
    mctx.font = `${size / sc}px sans-serif`;
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.fillText(txt, 0, 0);
    mctx.restore();
  };
  const dot = (x, z, r, col) => {
    const [ix, iy] = toMap(x, z);
    mctx.fillStyle = col;
    mctx.beginPath();
    mctx.arc(ix - px, iy - py, r / sc, 0, 7);
    mctx.fill();
  };
  // GPS lines (mission yellow, own marker pink)
  for (const [pts, col] of [[G.routeWp, '#ff3df0'], [G.routeMt, (G.missionTarget && G.missionTarget.color) || '#ffd23b']]) {
    if (!pts || pts.length < 2) continue;
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    for (const [w, c] of [[S2 * 0.055, 'rgba(0,0,0,0.55)'], [S2 * 0.032, col]]) {
      mctx.strokeStyle = c;
      mctx.lineWidth = w / sc;
      mctx.beginPath();
      pts.forEach((p, i) => { const [ix, iy] = toMap(p.x, p.z); if (i) mctx.lineTo(ix - px, iy - py); else mctx.moveTo(ix - px, iy - py); });
      mctx.stroke();
    }
  }
  for (const l of world.landmarks) if (!l.hideMini) icon(l.x, l.z, l.icon, S2 * 0.085);
  for (const p of G.pickups) if (p.mesh.visible) dot(p.x, p.z, S2 * 0.016, { health: '#ff4040', armor: '#4a8bff', ammo: '#ffd23b', ak: '#ffffff', money: '#3bff6a' }[p.type]);
  const t = G.time;
  for (const v of G.vehicles) if (v.type === 'police' && !v.dead) dot(v.pos.x, v.pos.z, S2 * 0.022, Math.sin(t * 10) > 0 ? '#ff2a2a' : '#2a6bff');
  for (const p of G.peds) if (p.role === 'cop' && !p.dead) dot(p.pos.x, p.pos.z, S2 * 0.014, '#2a6bff');
  // Radj-Coup: flashlight cones of the guards (yellow, red after the alarm)
  const job = G.missions && G.missions.job;
  if (job && job.sentries) {
    const alarm = !!job.alarm, R = G.player.inVehicle ? 24 : 14;
    for (const s of job.sentries) {
      if (!s.cone || s.dead || s.removed) continue;
      const seen = Math.min(1, s.seen || 0);
      mctx.fillStyle = alarm ? 'rgba(255,48,48,0.55)' : `rgba(255,236,120,${(0.6 + seen * 0.4).toFixed(2)})`;
      mctx.strokeStyle = alarm ? 'rgba(120,0,0,0.8)' : 'rgba(90,70,0,0.7)';
      mctx.lineWidth = 1.2 / sc;
      mctx.beginPath();
      const [ax, ay] = toMap(s.pos.x, s.pos.z);
      mctx.moveTo(ax - px, ay - py);
      for (let k = 0; k <= 8; k++) {
        const a = s.yaw - 0.5 + k / 8;
        const [qx, qy] = toMap(s.pos.x + Math.sin(a) * R, s.pos.z + Math.cos(a) * R);
        mctx.lineTo(qx - px, qy - py);
      }
      mctx.closePath();
      mctx.fill();
      mctx.stroke();
      dot(s.pos.x, s.pos.z, S2 * 0.016, alarm ? '#ff3030' : '#ffffff');
    }
  }
  // andere Online-Spieler
  if (G.friends) for (const f of G.friends) { dot(f.x, f.z, S2 * 0.034, '#fff'); dot(f.x, f.z, S2 * 0.025, f.c); }
  mctx.restore();
  // waypoint + mission target (clamped to the edge)
  for (const [wp, col] of [[G.waypoint && G.waypoint.pos, '#ff3df0'], [G.missionTarget, G.missionTarget && G.missionTarget.color]]) {
    if (!wp) continue;
    const [wx, wy] = toMap(wp.x, wp.z);
    let dx = (wx - px) * sc, dy = (wy - py) * sc;
    const c = Math.cos(rot), s = Math.sin(rot);
    let rx = dx * c - dy * s, ry = dx * s + dy * c;
    const R = S2 / 2 - S2 * 0.06;
    const d = Math.hypot(rx, ry);
    const out = d > R;
    if (out) { rx = (rx / d) * R; ry = (ry / d) * R; }
    mctx.save();
    mctx.translate(S2 / 2 + rx, S2 / 2 + ry);
    mctx.fillStyle = col;
    mctx.strokeStyle = '#fff';
    mctx.lineWidth = S2 * 0.012;
    mctx.beginPath();
    mctx.arc(0, 0, S2 * (out ? 0.035 : 0.045), 0, 7);
    mctx.fill();
    mctx.stroke();
    mctx.restore();
  }
  // own car + ringing phone: emoji badges, clamped to the edge like the waypoint
  const badges = [];
  const okCar = (c) => c && !c.removed && !c.dead && c !== G.player.inVehicle;
  if (okCar(G.myCar)) badges.push([G.myCar.pos, '🚗', '#3d8bff', 1]);
  if (okCar(G.lastCar) && G.lastCar !== G.myCar) badges.push([G.lastCar.pos, '🚙', '#9aa0a6', 0.85]);
  if (G.phoneRing) badges.push([G.phoneRing, '☎️', '#ffd23b', 0.75 + 0.25 * Math.abs(Math.sin(t * 6))]);
  for (const [wp, txt, col, k] of badges) {
    const [wx, wy] = toMap(wp.x, wp.z);
    const dx = (wx - px) * sc, dy = (wy - py) * sc;
    const c = Math.cos(rot), s = Math.sin(rot);
    let rx = dx * c - dy * s, ry = dx * s + dy * c;
    const R = S2 / 2 - S2 * 0.1;
    const d = Math.hypot(rx, ry);
    if (d > R) { rx = (rx / d) * R; ry = (ry / d) * R; }
    const r = S2 * 0.085 * k;
    mctx.save();
    mctx.translate(S2 / 2 + rx, S2 / 2 + ry);
    mctx.fillStyle = 'rgba(0,0,0,0.65)';
    mctx.strokeStyle = col;
    mctx.lineWidth = S2 * 0.012;
    mctx.beginPath(); mctx.arc(0, 0, r, 0, 7); mctx.fill(); mctx.stroke();
    mctx.font = `${r * 1.25}px sans-serif`;
    mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    mctx.fillText(txt, 0, r * 0.08);
    mctx.restore();
  }
  // wanted ring
  if (G.wanted.stars > 0) {
    mctx.strokeStyle = Math.sin(t * 8) > 0 ? 'rgba(255,40,40,0.9)' : 'rgba(40,110,255,0.9)';
    mctx.lineWidth = S2 * 0.025;
    mctx.beginPath();
    mctx.arc(S2 / 2, S2 / 2, S2 / 2 - 3, 0, Math.PI * 2);
    mctx.stroke();
  }
  // player arrow
  const rel = angleWrap(heading - cam.yaw);
  mctx.save();
  mctx.translate(S2 / 2, S2 / 2);
  mctx.rotate(-rel);
  mctx.fillStyle = '#ffffff';
  mctx.strokeStyle = '#000';
  mctx.lineWidth = S2 * 0.012;
  const u = S2 / 18;
  mctx.beginPath();
  mctx.moveTo(0, -u);
  mctx.lineTo(u * 0.7, u * 0.8);
  mctx.lineTo(0, u * 0.4);
  mctx.lineTo(-u * 0.7, u * 0.8);
  mctx.closePath();
  mctx.fill();
  mctx.stroke();
  mctx.restore();
  // north marker on the rim
  {
    const a = rot - Math.PI / 2; // map-up rotated
    const R = S2 / 2 - S2 * 0.07;
    mctx.save();
    mctx.translate(S2 / 2 + Math.cos(a) * R, S2 / 2 + Math.sin(a) * R);
    mctx.fillStyle = '#111';
    mctx.beginPath();
    mctx.arc(0, 0, S2 * 0.045, 0, 7);
    mctx.fill();
    mctx.fillStyle = '#fff';
    mctx.font = `900 ${Math.round(S2 * 0.06)}px Arial`;
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.fillText('N', 0, 1);
    mctx.restore();
  }
}

// ---------- big map overlay ----------
export class BigMap {
  constructor(G, onClose) {
    this.G = G;
    this.el = document.getElementById('bigmap');
    this.cv = document.getElementById('bigCanvas');
    this.ctx = this.cv.getContext('2d');
    this.zoom = 1;
    this.cx = 0;
    this.cz = 0;
    this.onClose = onClose;
    this.pointers = new Map();
    const cv = this.cv;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now() });
      if (this.pointers.size === 2) this.pinch = this.pinchDist();
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const [x, y] = pos(e);
      if (this.pointers.size === 1) {
        const k = this.pxPerM();
        this.cx += (x - p.x) / k; // dragging right moves view toward -x... map +x is left
        this.cz += (y - p.y) / k;
      }
      p.x = x;
      p.y = y;
      if (this.pointers.size === 2) {
        const d = this.pinchDist();
        if (this.pinch) this.setZoom(this.zoom * (d / this.pinch));
        this.pinch = d;
      }
      this.draw();
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
      if (moved < 8 && performance.now() - p.t < 450 && this.pointers.size === 0) this.tap(p.x, p.y);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY > 0 ? 0.85 : 1.18)); this.draw(); }, { passive: false });
    document.getElementById('mapClose').addEventListener('click', () => this.close());
    document.getElementById('mapClear').addEventListener('click', () => { G.waypoint.clear(); G.routeWp = null; this.draw(); });
    document.getElementById('mapZoomIn').addEventListener('click', () => { this.setZoom(this.zoom * 1.4); this.draw(); });
    document.getElementById('mapZoomOut').addEventListener('click', () => { this.setZoom(this.zoom / 1.4); this.draw(); });
    document.getElementById('mapMe').addEventListener('click', () => { const pp = G.focusPos(); this.cx = pp.x; this.cz = pp.z; this.draw(); });
    window.addEventListener('resize', () => { if (this.isOpen) this.resize(); });
  }
  pinchDist() {
    const a = [...this.pointers.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  }
  baseScale() {
    // fit the whole map at zoom 1
    return Math.min(this.cw / ((XMAX - XMIN) * 0.92), this.ch / ((ZMAX - ZMIN) * 0.92));
  }
  pxPerM() { return this.baseScale() * this.zoom; }
  setZoom(z) { this.zoom = clamp(z, 1, 9); }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = this.cv.clientWidth;
    this.ch = this.cv.clientHeight;
    this.cv.width = this.cw * dpr;
    this.cv.height = this.ch * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }
  open() {
    this.isOpen = true;
    this.el.classList.add('show');
    const pp = this.G.focusPos();
    this.cx = pp.x;
    this.cz = pp.z;
    this.zoom = 3.2;
    this.resize();
  }
  close() {
    this.isOpen = false;
    this.el.classList.remove('show');
    this.onClose && this.onClose();
  }
  worldToScreen(x, z) {
    const k = this.pxPerM();
    return [this.cw / 2 - (x - this.cx) * k, this.ch / 2 - (z - this.cz) * k];
  }
  tap(sx, sy) {
    const k = this.pxPerM();
    const x = this.cx - (sx - this.cw / 2) / k;
    const z = this.cz - (sy - this.ch / 2) / k;
    const wp = this.G.waypoint;
    if (wp.pos) {
      const [wx, wy] = this.worldToScreen(wp.pos.x, wp.pos.z);
      if (Math.hypot(wx - sx, wy - sy) < 22) { wp.clear(); this.G.routeWp = null; this.draw(); return; }
    }
    if (x < XMIN || x > XMAX || z < ZMIN || z > ZMAX) return;
    wp.set(x, z);
    if (this.G.findRoute) { const pp = this.G.focusPos(); this.G.routeWp = this.G.findRoute(pp.x, pp.z, x, z); }
    this.G.audio && this.G.audio.tone(0.18, 880, 1320, 0.12, 'triangle');
    this.draw();
  }
  draw() {
    if (!this.isOpen) return;
    const ctx = this.ctx, k = this.pxPerM();
    // keep center inside the map
    this.cx = clamp(this.cx, XMIN, XMAX);
    this.cz = clamp(this.cz, ZMIN, ZMAX);
    ctx.fillStyle = '#245570';
    ctx.fillRect(0, 0, this.cw, this.ch);
    const [ox, oy] = this.worldToScreen(XMAX, ZMAX);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mapCanvas, ox, oy, W * (k / S), Hh * (k / S));
    // landmarks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // GPS lines
    for (const [pts, col] of [[this.G.routeWp, '#ff3df0'], [this.G.routeMt, (this.G.missionTarget && this.G.missionTarget.color) || '#ffd23b']]) {
      if (!pts || pts.length < 2) continue;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [w, c] of [[8, 'rgba(0,0,0,0.6)'], [4.5, col]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach((p, i) => { const [x, y] = this.worldToScreen(p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      }
    }
    // icons first, then names that don't collide with each other
    const placed = [];
    const vis = [];
    for (const l of world.landmarks) {
      const [x, y] = this.worldToScreen(l.x, l.z);
      if (x < -40 || y < -40 || x > this.cw + 40 || y > this.ch + 40) continue;
      ctx.font = '20px sans-serif';
      ctx.fillText(l.icon, x, y);
      vis.push([l, x, y]);
      placed.push([x - 11, y - 11, x + 11, y + 11]);
    }
    ctx.font = '700 12px -apple-system, Arial, sans-serif';
    for (const [l, x, y] of vis) {
      const w = ctx.measureText(l.name).width;
      let ok = false, ly = 0;
      for (const dy of [18, -18, 30]) {
        const r = [x - w / 2 - 2, y + dy - 8, x + w / 2 + 2, y + dy + 8];
        if (!placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1] && !(q[0] === x - 11 && q[1] === y - 11))) { ok = true; ly = dy; placed.push(r); break; }
      }
      if (!ok) continue;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(l.name, x, y + ly);
      ctx.fillStyle = '#fff';
      ctx.fillText(l.name, x, y + ly);
    }
    // police
    for (const v of this.G.vehicles) if (v.type === 'police' && !v.dead) {
      const [x, y] = this.worldToScreen(v.pos.x, v.pos.z);
      ctx.fillStyle = '#2a6bff';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
    }
    const G2 = this.G;
    const bdg = [];
    const okC = (c) => c && !c.removed && !c.dead && c !== G2.player.inVehicle;
    if (okC(G2.myCar)) bdg.push([G2.myCar.pos, '🚗', '#3d8bff', 'Dein Auto']);
    if (okC(G2.lastCar) && G2.lastCar !== G2.myCar) bdg.push([G2.lastCar.pos, '🚙', '#9aa0a6', 'Zuletzt gefahren']);
    if (G2.phoneRing) bdg.push([G2.phoneRing, '☎️', '#ffd23b', 'Telefon klingelt']);
    for (const [p2, txt, col, lab] of bdg) {
      const [x, y] = this.worldToScreen(p2.x, p2.z);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = '19px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 1);
      ctx.font = '900 12px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(lab, x, y + 27); ctx.fillText(lab, x, y + 27);
    }
    // mission target
    const mt = this.G.missionTarget;
    if (mt) {
      const [x, y] = this.worldToScreen(mt.x, mt.z);
      ctx.fillStyle = mt.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.stroke();
    }
    // waypoint
    const wp = this.G.waypoint.pos;
    if (wp) {
      const [x, y] = this.worldToScreen(wp.x, wp.z);
      ctx.fillStyle = '#ff3df0';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y - 22, 12, Math.PI * 0.8, Math.PI * 2.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y - 22, 4.5, 0, 7); ctx.fill();
      const pp = this.G.focusPos();
      const d = Math.hypot(wp.x - pp.x, wp.z - pp.z);
      document.getElementById('mapInfo').textContent = `Markierung: ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'} entfernt · antippen zum Entfernen`;
    } else document.getElementById('mapInfo').textContent = 'Tippe auf die Karte, um eine Markierung zu setzen';
    // player
    const pp = this.G.focusPos();
    const [x, y] = this.worldToScreen(pp.x, pp.z);
    const h = this.G.player.inVehicle ? this.G.player.inVehicle.h : this.G.player.yaw;
    ctx.save();
    ctx.translate(x, y);
    // heading (sin h, cos h) in world -> screen (-sin, -cos)
    ctx.rotate(Math.atan2(-Math.cos(h), -Math.sin(h)) + Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
