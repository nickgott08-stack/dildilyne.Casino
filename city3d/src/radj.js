// Radj-Insel: airstrip, serpentine road through a dense forest, walled estate with mansion,
// secret cellar with the golden Bubensahne, helipad. Built once at start (visible from the plane).
import * as THREE from 'three';
import { RADJ, RADJ_CELLAR, RADJ_STRIP, RADJ_ESTATE, radjGround, radjE } from './geo.js';
import { addBox, addCirc, addFloor, world } from './world.js';
import { cbox, ccyl, merge, neonSign, srand, srange, canvasTex, colorize } from './util.js';
import { makeHuman } from './human.js';

const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const H = (x, z) => radjGround(x, z);

export const ISL = {
  strip: RADJ_STRIP,
  road: [[80, -1079], [100, -1096], [96, -1112], [40, -1124], [-6, -1140], [30, -1166], [96, -1186], [92, -1206], [86, -1222], [74, -1234]], // ends at the foot of the ramp up to the main gate
  estate: RADJ_ESTATE,
  gate: { x: 40, z: -1240 },
  westGate: { x: -60, z: -1335 },
  mansion: { x0: 37, x1: 60, z0: -1320, z1: -1296 },
  lift: { x: 34.5, z: -1307 }, // lift door on the west face of the villa (podium, level 3)
  helipad: { x: -186, z: -1332 },
  helRoad: [[-60, -1335], [-80, -1340], [-120, -1326], [-160, -1334], [-186, -1332]],
  cellarLift: { x: 316, z: -1212 },
  glass: { x: 316, z: -1240 },
};

function ribbon(pts, w, col, lift = 0.07) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.4);
  const n = Math.ceil(curve.getLength() / 2);
  const S = curve.getSpacedPoints(n);
  const pos = [], idx = [];
  S.forEach((p, i) => {
    const q = S[Math.min(S.length - 1, i + 1)], o = S[Math.max(0, i - 1)];
    const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    for (const s of [-1, 1]) { const x = p.x + nx * s * w / 2, z = p.z + nz * s * w / 2; pos.push(x, H(x, z) + lift, z); }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  return { mesh: m, samples: S };
}
const nearPts = (S, x, z, r) => S.some((p) => Math.hypot(p.x - x, p.z - z) < r);

// gravel road: textured strip with soft grass verges and darker wheel ruts, following the ground
let _gravel = null;
function gravelTex() {
  if (_gravel) return _gravel;
  _gravel = canvasTex(128, 512, (ctx, w, h) => {
    // across (u): grass verge -> gravel -> rut -> gravel -> rut -> gravel -> verge
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#3f6b2e'); g.addColorStop(0.08, '#5d6b3c'); g.addColorStop(0.15, '#9d8e6e');
    g.addColorStop(0.27, '#a89a7b'); g.addColorStop(0.33, '#83765c'); g.addColorStop(0.4, '#a89a7b');
    g.addColorStop(0.6, '#ab9d7e'); g.addColorStop(0.67, '#83765c'); g.addColorStop(0.73, '#a89a7b');
    g.addColorStop(0.85, '#9d8e6e'); g.addColorStop(0.92, '#5d6b3c'); g.addColorStop(1, '#3f6b2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // pebbles + grain
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * w, y = Math.random() * h, edge = Math.min(x, w - x) / w;
      if (edge < 0.1 && Math.random() < 0.7) continue;
      const l = 45 + Math.random() * 40;
      ctx.fillStyle = `hsla(${32 + Math.random() * 14},${10 + Math.random() * 14}%,${l}%,${0.35 + Math.random() * 0.4})`;
      const r = Math.random() < 0.08 ? 1.6 + Math.random() * 1.4 : 0.6 + Math.random() * 0.9;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    // grass tufts growing into the edges
    for (let i = 0; i < 900; i++) {
      const side = Math.random() < 0.5, x = side ? Math.random() * w * 0.2 : w - Math.random() * w * 0.2, y = Math.random() * h;
      ctx.strokeStyle = `hsla(${88 + Math.random() * 20},40%,${22 + Math.random() * 14}%,0.8)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 4); ctx.stroke();
    }
  });
  _gravel.wrapS = THREE.ClampToEdgeWrapping;
  return _gravel;
}
function gravelRoad(pts, w) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.4);
  const n = Math.ceil(curve.getLength() / 2);
  const S = curve.getSpacedPoints(n);
  const W = w + 3; // incl. verges
  const cols = [-0.5, -0.25, 0, 0.25, 0.5];
  const pos = [], uv = [], idx = [];
  let dist = 0;
  S.forEach((p, i) => {
    const q = S[Math.min(S.length - 1, i + 1)], o = S[Math.max(0, i - 1)];
    const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    if (i) dist += Math.hypot(p.x - S[i - 1].x, p.z - S[i - 1].z);
    for (const c of cols) {
      const x = p.x + nx * c * W, z = p.z + nz * c * W;
      pos.push(x, H(x, z) + 0.07 - Math.abs(c) * 0.06, z);
      uv.push(c + 0.5, dist / 9);
    }
    if (i) {
      const a = (i - 1) * cols.length, b = i * cols.length;
      for (let k = 0; k < cols.length - 1; k++) idx.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: gravelTex(), roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  return { mesh: m, samples: S };
}

// triangles with outward-facing normals (for roofs / gables), vertex-coloured, mergeable with cbox()
function solid(tris, center) {
  const pos = [], c = new THREE.Vector3(...center), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  const cols = [];
  for (const [p0, p1, p2, col] of tris) {
    a.set(...p0); b.set(...p1); d.set(...p2);
    n.subVectors(b, a).cross(m.subVectors(d, a));
    m.copy(a).add(b).add(d).multiplyScalar(1 / 3).sub(c);
    const flip = n.dot(m) < 0;
    for (const p of flip ? [p0, p2, p1] : [p0, p1, p2]) pos.push(...p);
    const k = new THREE.Color(col);
    for (let i = 0; i < 3; i++) cols.push(k.r, k.g, k.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
// hip roof over a rectangle (with overhang); ridge runs along the longer side
function hipRoof(x0, x1, z0, z1, y, h, col, ov = 0.9) {
  x0 -= ov; x1 += ov; z0 -= ov; z1 += ov;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, t = y + h;
  const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], D = [x0, y, z1];
  let R1, R2;
  if (w >= d) { R1 = [x0 + d / 2, t, cz]; R2 = [x1 - d / 2, t, cz]; } else { R1 = [cx, t, z0 + w / 2]; R2 = [cx, t, z1 - w / 2]; }
  const ctr = [cx, y + h * 0.3, cz];
  const tris = w >= d
    ? [[A, B, R2, col], [A, R2, R1, col], [D, C, R2, col], [D, R2, R1, col], [A, D, R1, col], [B, C, R2, col]]
    : [[A, D, R2, col], [A, R2, R1, col], [B, C, R2, col], [B, R2, R1, col], [A, B, R1, col], [D, C, R2, col]];
  return solid(tris, ctr);
}
// triangular gable (pediment) facing +z: front/back triangles in wallCol, sloped top in roofCol
function gable(x0, x1, z0, z1, y, h, wallCol, roofCol) {
  const cx = (x0 + x1) / 2, t = y + h;
  const fL = [x0, y, z1], fR = [x1, y, z1], fT = [cx, t, z1], bL = [x0, y, z0], bR = [x1, y, z0], bT = [cx, t, z0];
  return solid([[fL, fR, fT, wallCol], [bL, bR, bT, wallCol], [fL, fT, bT, roofCol], [fL, bT, bL, roofCol], [fR, fT, bT, roofCol], [fR, bT, bR, roofCol]], [cx, y + h * 0.3, (z0 + z1) / 2]);
}

export function buildRadjIsland(sceneRoot) {
  const scene = new THREE.Group();
  sceneRoot.add(scene);
  const plain = [];
  const out = { sentryPosts: [] };
  // ---- island ground (radial grid following radjGround) ----
  {
    const R = 64, A = 96, pos = [], col = [], idx = [];
    const sand = new THREE.Color('#d9c48e'), grass = new THREE.Color('#3f6b2e'), c = new THREE.Color();
    for (let r = 0; r <= R; r++)
      for (let a = 0; a < A; a++) {
        const t = r / R * 1.13, an = (a / A) * Math.PI * 2;
        const x = RADJ.x + Math.cos(an) * RADJ.rx * t, z = RADJ.z + Math.sin(an) * RADJ.rz * t;
        pos.push(x, H(x, z), z);
        const e = radjE(x, z);
        c.copy(grass).lerp(sand, Math.min(1, Math.max(0, (e - 0.62) / 0.2)));
        col.push(c.r, c.g, c.b);
        if (r < R) { const i0 = r * A + a, i1 = r * A + ((a + 1) % A); idx.push(i0, i1, i0 + A, i1, i1 + A, i0 + A); }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    m.receiveShadow = true;
    scene.add(m);
  }
  // ---- private airstrip ----
  {
    const S = ISL.strip, y = H((S.x0 + S.x1) / 2, (S.z0 + S.z1) / 2);
    S.y = y;
    plain.push(cbox(S.x1 - S.x0, 0.1, S.z1 - S.z0, (S.x0 + S.x1) / 2, y + 0.06, (S.z0 + S.z1) / 2, '#3a3c40'));
    for (let x = S.x0 + 10; x < S.x1 - 10; x += 16) plain.push(cbox(8, 0.02, 0.45, x, y + 0.13, (S.z0 + S.z1) / 2, '#f2f2f2'));
    plain.push(cbox(10, 4, 8, S.x0 + 16, y + 2, S.z1 + 10, '#6a6f75'));
    addBox(S.x0 + 11, S.x0 + 21, S.z1 + 6, S.z1 + 14, y + 4);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(14, 2), new THREE.MeshBasicMaterial({ map: neonSign('RADJ AIRSTRIP', '#ff2a2a', { size: 100 }), toneMapped: false }));
    sg.position.set(S.x0 + 16, y + 5.4, S.z1 + 5.9);
    sg.rotation.y = Math.PI;
    scene.add(sg);
    world.signMats.push(sg.material);
  }
  // ---- the forest road: gravel, kerb stones, lanterns, signposts, a creek with a wooden bridge ----
  const glow = [];
  const road = gravelRoad(ISL.road, 8);
  scene.add(road.mesh);
  const hel = gravelRoad(ISL.helRoad, 7);
  scene.add(hel.mesh);
  out.roadSamples = road.samples;
  {
    const S = road.samples;
    const side = (i, off) => {
      const p = S[i], q = S[Math.min(S.length - 1, i + 1)], o = S[Math.max(0, i - 1)];
      const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
      return { x: p.x - dz / L * off, z: p.z + dx / L * off, h: Math.atan2(dx, dz) };
    };
    // natural field stones scattered along the verges (no more white kerbs)
    const stoneCols = ['#8c877c', '#9a948a', '#7a766d', '#a39d90'];
    for (const SS of [S, hel.samples]) {
      for (let i = 0; i < SS.length; i++) for (const sgn of [-1, 1]) {
        if (srand() < 0.45) continue;
        const p = SS[i], q = SS[Math.min(SS.length - 1, i + 1)], o = SS[Math.max(0, i - 1)];
        const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1, off = sgn * srange(5.1, 6.3);
        const x = p.x - dz / L * off + srange(-0.6, 0.6), z = p.z + dx / L * off + srange(-0.6, 0.6), r = srange(0.18, 0.5);
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.scale(srange(0.9, 1.5), srange(0.45, 0.75), srange(0.9, 1.3));
        g.rotateY(srange(0, 6.28));
        g.translate(x, H(x, z) + r * 0.15, z);
        plain.push(colorize(g, stoneCols[(srand() * 4) | 0]));
      }
    }
    // lanterns every ~20 m, alternating sides
    for (let i = 4, k = 0; i < S.length - 2; i += 10, k++) {
      const sd = side(i, k % 2 ? 5.4 : -5.4), y = H(sd.x, sd.z);
      plain.push(cbox(0.16, 3.4, 0.16, sd.x, y + 1.7, sd.z, '#2b2b2b'), cbox(0.5, 0.12, 0.5, sd.x, y + 3.45, sd.z, '#2b2b2b'));
      glow.push(cbox(0.34, 0.42, 0.34, sd.x, y + 3.18, sd.z, '#ffd890'));
      addCirc(sd.x, sd.z, 0.2, y + 3.5, y - 1);
    }
    // signposts
    const sign = (i, off, txt) => {
      const sd = side(i, off), y = H(sd.x, sd.z);
      plain.push(cbox(0.14, 2.6, 0.14, sd.x, y + 1.3, sd.z, '#5a4026'));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), new THREE.MeshBasicMaterial({ map: neonSign(txt, '#ffd890', { size: 70, bg: '#3a2a16', border: false }), side: THREE.DoubleSide }));
      m.position.set(sd.x, y + 2.3, sd.z);
      m.rotation.y = sd.h + Math.PI / 2;
      scene.add(m);
    };
    sign(3, -5.6, 'ANWESEN RADJ →');
    sign(Math.floor(S.length * 0.55), 5.6, 'PRIVATWEG – BETRETEN VERBOTEN');
    // creek crossing at ~35 % with a wooden bridge
    const ci = Math.floor(S.length * 0.35), cp = S[ci], cs = side(ci, 1);
    const ang = cs.h + Math.PI / 2, ux = Math.sin(ang), uz = Math.cos(ang);
    const creek = ribbon([-60, -30, -10, 10, 30, 60].map((t) => [cp.x + ux * t + Math.sin(t * 0.08) * 4, cp.z + uz * t + Math.cos(t * 0.06) * 4]), 5, '#2f7fa8', 0.04);
    creek.mesh.material = new THREE.MeshStandardMaterial({ color: '#2f7fa8', roughness: 0.08, metalness: 0.4, side: THREE.DoubleSide });
    scene.add(creek.mesh);
    out.creek = creek.samples;
    const by = H(cp.x, cp.z) + 0.38;
    // bridge built along the real road direction d and its perpendicular n
    const qa = S[Math.min(S.length - 1, ci + 2)], qb = S[Math.max(0, ci - 2)];
    let dX = qa.x - qb.x, dZ = qa.z - qb.z; const dL = Math.hypot(dX, dZ) || 1; dX /= dL; dZ /= dL;
    const nX = -dZ, nZ = dX, ryD = Math.atan2(dX, dZ), ryN = Math.atan2(nX, nZ);
    for (let t = -4.5; t <= 4.5; t += 0.75) {
      const x = cp.x + dX * t, z = cp.z + dZ * t;
      plain.push(cbox(0.62, 0.12, 8.6, x, by - Math.max(0, Math.abs(t) - 3) * 0.12, z, Math.round(t / 0.75) % 2 ? '#7a5634' : '#6b4a2c', ryN));
    }
    for (const off of [-4.3, 4.3]) {
      for (let t = -4.5; t <= 4.5; t += 1.5) plain.push(cbox(0.14, 1.0, 0.14, cp.x + dX * t + nX * off, by + 0.5, cp.z + dZ * t + nZ * off, '#5a4026'));
      plain.push(cbox(0.12, 0.1, 9.4, cp.x + nX * off, by + 1.0, cp.z + nZ * off, '#6b4a2c', ryD));
    }
    // a clearing with a bench at ~60 %
    const li = Math.floor(S.length * 0.62), lc = side(li, -10);
    out.clearing = { x: lc.x, z: lc.z, r: 8 };
    const ly = H(lc.x, lc.z);
    plain.push(cbox(2.4, 0.12, 0.6, lc.x, ly + 0.6, lc.z, '#7a5634', lc.h), cbox(2.4, 0.5, 0.1, lc.x + Math.cos(lc.h) * 0.3, ly + 0.9, lc.z - Math.sin(lc.h) * 0.3, '#7a5634', lc.h));
    plain.push(ccyl(0.9, 1.0, 0.3, 10, lc.x + 3, ly + 0.15, lc.z + 2, '#6b6b6b'), ccyl(0.5, 0.6, 0.25, 8, lc.x + 3, ly + 0.35, lc.z + 2, '#3a2a1a'));
  }
  // ---- four watchtowers along the forest road (finale): a searchlight spot sweeps across the road, see heist.js ----
  out.roadTowers = [];
  {
    const S = road.samples;
    [0.18, 0.47, 0.75, 0.88].forEach((f, k) => {
      const i = Math.floor(S.length * f), p = S[i], q = S[i + 1], dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
      const sg = k % 2 ? -1 : 1, nx = (-dz / L) * sg, nz = (dx / L) * sg;
      const tx = p.x + nx * 7.6, tz = p.z + nz * 7.6, y = H(tx, tz);
      for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) plain.push(cbox(0.3, 8, 0.3, tx + a, y + 4, tz + b, '#5a4026'));
      plain.push(cbox(3.6, 0.3, 3.6, tx, y + 8, tz, '#6b4a2c'));
      for (const [a, b, w, d] of [[0, -1.75, 3.6, 0.12], [0, 1.75, 3.6, 0.12], [-1.75, 0, 0.12, 3.6], [1.75, 0, 0.12, 3.6]]) plain.push(cbox(w, 1.0, d, tx + a, y + 8.65, tz + b, '#5a4026'));
      plain.push(cbox(4.2, 0.25, 4.2, tx, y + 10.7, tz, '#7a2f22'));
      for (const [a, b] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) plain.push(cbox(0.14, 2.4, 0.14, tx + a, y + 9.45, tz + b, '#3a2a1a'));
      plain.push(cbox(0.5, 0.4, 0.5, tx, y + 10.3, tz, '#222'));
      addBox(tx - 1.7, tx + 1.7, tz - 1.7, tz + 1.7, y + 10.8, { y0: y - 1 });
      // the guard up there cannot be shot (just a figure, no Ped)
      const man = makeHuman({ skin: '#c68a62', hair: '#111', shirt: '#2f3b2a', pants: '#1f2a1c', shoes: '#111', hairStyle: 0, cap: '#1f2a1c' });
      man.root.position.set(tx, y + 8.15, tz); man.root.rotation.y = Math.atan2(-nx, -nz);
      scene.add(man.root);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(4.6, 22, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.geometry.translate(0, -11, 0);
      const piv = new THREE.Group();
      piv.position.set(tx, y + 10.1, tz);
      piv.add(beam);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(5.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
      spot.renderOrder = 3;
      scene.add(piv, spot);
      out.roadTowers.push({ x: tx, z: tz, y: y + 10.1, px: p.x, pz: p.z, nx, nz, piv, beam, spot, r: 5.2, seen: 0, k });
    });
  }
  // ---- forest: layered pines, leafy trees and bushes (instanced, flat-shaded like the city trees) ----
  {
    const pines = [], leafy = [], bushes = [];
    const E = ISL.estate;
    // tree wall: two tight rows of big pines (overlapping collision) on both sides of the forest road and around the
    // airstrip clearing, so you have to take the road – on foot and by car
    {
      const ST = ISL.strip, sx0 = ST.x0 - 10, sx1 = ST.x1 + 14, sz0 = ST.z0 - 12, sz1 = ST.z1 + 22;
      const wall = (x, z) => {
        if (radjE(x, z) > 1.0) return;
        if (x > E.x0 - 3 && x < E.x1 + 3 && z > E.z0 - 3 && z < E.z1 + 3) return;
        if (x > 20 && x < 75 && z > E.z1 - 1 && z < E.z1 + 13) return; // ramp + landing in front of the gate
        if (Math.hypot(x - out.clearing.x, z - out.clearing.z) < out.clearing.r + 0.5) return;
        if (out.roadTowers.some((t) => Math.hypot(t.x - x, t.z - z) < 3.6)) return;
        const y = H(x, z);
        addCirc(x, z, 1.4, y + 6, y - 1);
        if (out.creek && nearPts(out.creek, x, z, 3)) return; // no tree in the water, but still no way through
        pines.push([x, y, z, srange(1.05, 1.5)]);
      };
      const S = road.samples;
      for (let i = 0; i < S.length - 1; i++) {
        const p = S[i], q = S[i + 1], dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
        for (const sgn of [-1, 1]) for (const row of [0, 1]) {
          const off = sgn * (8.6 + row * 2.4 + srange(-0.3, 0.3)), t = row * 0.5;
          const x = p.x + dx * t - (dz / L) * off, z = p.z + dz * t + (dx / L) * off;
          if (x > sx0 && x < sx1 && z > sz0 && z < sz1) continue;       // the strip clearing stays open
          if (nearPts(S, x, z, 7.4)) continue;                           // inside of hairpins: not on the road itself
          wall(x, z);
        }
      }
      // ring around the little clearing next to the road and around the airstrip clearing (open only where the road leaves)
      for (let a = 0; a < 6.28; a += 0.2) { const x = out.clearing.x + Math.cos(a) * (out.clearing.r + 2), z = out.clearing.z + Math.sin(a) * (out.clearing.r + 2); if (!nearPts(S, x, z, 8.4)) wall(x, z); }
      const edge = [];
      for (let x = sx0; x <= sx1; x += 2.3) edge.push([x, sz0], [x, sz1]);
      for (let z = sz0; z <= sz1; z += 2.3) edge.push([sx0, z], [sx1, z]);
      for (const [x, z] of edge) if (!nearPts(S, x, z, 8.4)) wall(x + srange(-0.3, 0.3), z + srange(-0.3, 0.3));
    }
    for (let k = 0; k < 2600; k++) {
      const x = srange(-230, 230), z = srange(-1430, -1030);
      const e = radjE(x, z);
      if (e > 0.78) continue;
      if (x > ISL.strip.x0 - 10 && x < ISL.strip.x1 + 14 && z > ISL.strip.z0 - 12 && z < ISL.strip.z1 + 22) continue;
      if (x > E.x0 - 6 && x < E.x1 + 6 && z > E.z0 - 6 && z < E.z1 + 9) continue;
      if (x > 18 && x < 78 && z > E.z1 - 2 && z < E.z1 + 16) continue; // ramp + landing in front of the gate
      if (nearPts(road.samples, x, z, 7.5) || nearPts(hel.samples, x, z, 7)) continue;
      if (out.creek && nearPts(out.creek, x, z, 4)) continue;
      if (Math.hypot(x - out.clearing.x, z - out.clearing.z) < out.clearing.r) continue;
      if (Math.hypot(x - ISL.helipad.x, z - ISL.helipad.z) < 20) continue;
      const dense = nearPts(road.samples, x, z, 26);
      if (!dense && srand() < 0.55) continue;
      const y = H(x, z), s = srange(0.8, 1.4);
      // near the beach and in clearings more leafy trees, deeper in the forest mostly pines
      (srand() < (e > 0.5 ? 0.3 : 0.14) ? leafy : pines).push([x, y, z, s]);
      addCirc(x, z, 0.9 * s, y + 6, y - 1);
      if (srand() < 0.35) { const a = srange(0, 6.28), r = srange(2, 3.5); const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r; if (!nearPts(road.samples, bx, bz, 5.5)) bushes.push([bx, H(bx, bz), bz, srange(0.6, 1.2)]); }
    }
    // bushes along the road verges
    for (let i = 2; i < road.samples.length - 2; i += 2) for (const sgn of [-1, 1]) {
      if (srand() < 0.5) continue;
      const p = road.samples[i], q = road.samples[i + 1], dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, off = sgn * srange(6.8, 8.5);
      const x = p.x - dz / L * off, z = p.z + dx / L * off;
      if (x > E.x0 - 4 && x < E.x1 + 4 && z > E.z0 - 4 && z < E.z1 + 6) continue;
      bushes.push([x, H(x, z), z, srange(0.6, 1.1)]);
    }
    const shade = (g, bottom, top, y0, y1) => {
      const P = g.attributes.position, c = new Float32Array(P.count * 3), A = new THREE.Color(bottom), B = new THREE.Color(top), t = new THREE.Color();
      for (let i = 0; i < P.count; i++) { t.copy(A).lerp(B, Math.min(1, Math.max(0, (P.getY(i) - y0) / (y1 - y0)))); c.set([t.r, t.g, t.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      if (g.attributes.uv) g.deleteAttribute('uv');
      return g;
    };
    // pine = three stacked cones, each darker at its rim
    const tier = (r, h, y) => shade(new THREE.ConeGeometry(r, h, 8).translate(0, y, 0), '#163a1f', '#3c7a3a', y - h / 2, y + h / 2);
    const pineG = merge([tier(2.5, 3.6, 3.4), tier(1.95, 3.2, 5.2), tier(1.3, 2.8, 7.0)]);
    const leafG = merge([
      shade(new THREE.IcosahedronGeometry(2.1, 1).translate(0, 4.6, 0), '#21401b', '#456f2f', 2.5, 6.7),
      shade(new THREE.IcosahedronGeometry(1.5, 1).translate(1.3, 4.0, 0.6), '#21401b', '#456f2f', 2.5, 5.5),
      shade(new THREE.IcosahedronGeometry(1.4, 1).translate(-1.1, 4.3, -0.8), '#21401b', '#456f2f', 2.9, 5.7),
    ]);
    const trunkG = new THREE.CylinderGeometry(0.2, 0.34, 3.4, 6).translate(0, 1.7, 0);
    const bushG = shade(new THREE.IcosahedronGeometry(0.9, 1).scale(1.2, 0.75, 1.1).translate(0, 0.45, 0), '#23471f', '#4f8a35', 0, 1.2);
    const foliage = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    const bark = new THREE.MeshStandardMaterial({ color: '#4d3522', roughness: 1 });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tc = new THREE.Color();
    const inst = (geo, mat, list, tint, shadow, boost = 1.6) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z, s], i) => {
        q.setFromAxisAngle(up, srange(0, 6.28));
        sc.set(s * srange(0.9, 1.1), s * srange(0.9, 1.25), s * srange(0.9, 1.1));
        m4.compose(ps.set(x, y - 0.1, z), q, sc);
        m.setMatrixAt(i, m4);
        if (tint) { tc.setHSL(srange(0.24, 0.34), srange(0.25, 0.5), srange(0.42, 0.62)); m.setColorAt(i, tc.multiplyScalar(boost)); }
      });
      m.castShadow = shadow; m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    inst(trunkG, bark, pines.concat(leafy), false, true);
    inst(pineG, foliage, pines, true, true);
    inst(leafG, foliage, leafy, true, true, 1.3);
    inst(bushG, foliage, bushes, true, false);
  }
  // ---- the estate: SHELL ("Rohbau") after Nick's sketch (mirrored, west gate on the left), 15.11. ----
  // Three levels: L1 = terrain (pool terrace, west strip with garage + west gate), L2 = +3.4 m (main gate, gate court,
  // garden, middle court, east courts, U-hall court), L3 = +6.8 m (villa podium, north-east terrace).
  // Everything is grey on purpose – layout first, looks later (step 3). Green boxes of the sketch = open halls (posts + roof).
  {
    const E = ISL.estate, y = H((E.x0 + E.x1) / 2, (E.z0 + E.z1) / 2);
    E.y = y;
    const L1 = y, L2 = y + 3.4, L3 = y + 6.8;
    const g = ISL.gate, wg = ISL.westGate;
    const C1 = '#7f8f78', C2 = '#a3a39c', C3 = '#c4bfb2', WALLC = '#d7d2c6', RAILC = '#8d8f93', ROOFC = '#5b5f66', POSTC = '#b9b6ad', SOLID = '#8a8479';
    // solid raised platform with a walkable top
    const plat = (x0, x1, z0, z1, top, col) => { plain.push(cbox(x1 - x0, top - L1 + 0.5, z1 - z0, (x0 + x1) / 2, (top + L1 - 0.5) / 2, (z0 + z1) / 2, col)); addBox(x0, x1, z0, z1, top, { y0: L1 - 1 }); addFloor(x0, x1, z0, z1, top); };
    // wall / railing standing on `base`
    const wallOn = (x0, x1, z0, z1, base, h = 3.2, col = WALLC) => { plain.push(cbox(Math.abs(x1 - x0) || 0.5, h + 0.5, Math.abs(z1 - z0) || 0.5, (x0 + x1) / 2, base + h / 2 - 0.25, (z0 + z1) / 2, col)); addBox(Math.min(x0, x1) - (x0 === x1 ? 0.25 : 0), Math.max(x0, x1) + (x0 === x1 ? 0.25 : 0), Math.min(z0, z1) - (z0 === z1 ? 0.25 : 0), Math.max(z0, z1) + (z0 === z1 ? 0.25 : 0), base + h, { y0: base - 0.5 }); };
    // wall along a line with openings: line 'x' = runs along x at fixed z (c), 'z' = runs along z at fixed x (c)
    const line = (dir, c, a, b, base, h, gaps = [], arch = false) => {
      let from = a;
      for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0]).concat([[b, b]])) {
        if (g0 > from) { if (dir === 'x') wallOn(from, g0, c, c, base, h, h < 1.5 ? RAILC : WALLC); else wallOn(c, c, from, g0, base, h, h < 1.5 ? RAILC : WALLC); }
        if (arch && g1 > g0) { const m = (g0 + g1) / 2, w = g1 - g0 + 1.2; plain.push(dir === 'x' ? cbox(w, 1.0, 0.9, m, base + h + 0.2, c, '#e8c66a') : cbox(0.9, 1.0, w, c, base + h + 0.2, m, '#e8c66a')); }
        from = g1;
      }
    };
    const rail = (dir, c, a, b, base, gaps) => line(dir, c, a, b, base, 1.1, gaps);
    // stairs: ramp for the feet + visible steps + side walls. yA at the low coordinate end, yB at the high end.
    const stairs = (x0, x1, z0, z1, yA, yB, axis) => {
      addFloor(x0, x1, z0, z1, yA, yB, axis);
      const n = 12, lo = Math.min(yA, yB), hi = Math.max(yA, yB);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, top = yA + (yB - yA) * ((k + 1) / n > 1 ? 1 : (yB > yA ? (k + 1) / n : k / n));
        if (axis === 'x') plain.push(cbox((x1 - x0) / n, top - lo + 0.4, z1 - z0, x0 + (x1 - x0) * t, (top + lo - 0.4) / 2, (z0 + z1) / 2, '#e0dccf'));
        else plain.push(cbox(x1 - x0, top - lo + 0.4, (z1 - z0) / n, (x0 + x1) / 2, (top + lo - 0.4) / 2, z0 + (z1 - z0) * t, '#e0dccf'));
      }
      if (axis === 'x') { wallOn(x0, x1, z0, z0, lo, hi - lo + 1.1, RAILC); wallOn(x0, x1, z1, z1, lo, hi - lo + 1.1, RAILC); }
      else { wallOn(x0, x0, z0, z1, lo, hi - lo + 1.1, RAILC); wallOn(x1, x1, z0, z1, lo, hi - lo + 1.1, RAILC); }
    };
    // open hall: posts + roof (you can walk through and hide behind the posts)
    const hall = (x0, x1, z0, z1, base, h = 3.6) => {
      const xs = x1 - x0 > 14 ? [x0, (x0 + x1) / 2, x1] : [x0, x1], zs = z1 - z0 > 14 ? [z0, (z0 + z1) / 2, z1] : [z0, z1];
      for (const x of xs) for (const z of zs) { if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue; plain.push(cbox(0.7, h, 0.7, x, base + h / 2, z, POSTC)); addBox(x - 0.35, x + 0.35, z - 0.35, z + 0.35, base + h, { y0: base - 0.5 }); }
      plain.push(cbox(x1 - x0 + 1.6, 0.45, z1 - z0 + 1.6, (x0 + x1) / 2, base + h + 0.22, (z0 + z1) / 2, ROOFC));
    };
    // solid building (cannot be entered)
    const block = (x0, x1, z0, z1, base, h) => { plain.push(cbox(x1 - x0, h, z1 - z0, (x0 + x1) / 2, base + h / 2, (z0 + z1) / 2, SOLID), cbox(x1 - x0 + 1, 0.4, z1 - z0 + 1, (x0 + x1) / 2, base + h + 0.2, (z0 + z1) / 2, ROOFC)); addBox(x0, x1, z0, z1, base + h, { y0: base - 0.5 }); };

    // ---------- ground + platforms ----------
    plain.push(cbox(E.x1 - E.x0 - 1, 0.06, E.z1 - E.z0 - 1, (E.x0 + E.x1) / 2, L1 + 0.03, (E.z0 + E.z1) / 2, C1)); // L1 floor
    plat(-36, 66, -1329, E.z1, L2, C2);          // gate court, garden, middle court
    plat(46, E.x1, E.z0, -1297, L2, C2);         // east corridor, east courts, U-hall court, south-east court
    plat(30, 64, -1324, -1290, L3, C3);          // villa podium
    plat(66, E.x1, -1297, E.z1, L3, C3);         // north-east terrace
    plat(-60, -46, E.z0, -1384, L2, C2);         // look-out in the south-west corner
    plat(22, 50, E.z1, E.z1 + 10, L2, C2);       // landing in front of the main gate (outside)
    // ---------- 8 stairs + the ramp from the forest road ----------
    stairs(50, 72, E.z1 + 2, E.z1 + 10, L2, L1, 'x');   // ramp: forest road → landing
    stairs(58, 66, -1272, -1267, L2, L3, 'x');           // 1 gate court → north-east terrace
    stairs(41, 46, -1290, -1282, L3, L2, 'z');           // 2 gate court → villa podium
    stairs(22, 30, -1310, -1305, L2, L3, 'x');           // 3 middle court → villa podium (at the lift)
    stairs(-44, -36, -1285, -1280, L1, L2, 'x');         // 4 west strip → garden
    stairs(38, 46, -1336, -1331, L1, L2, 'x');           // 5 pool terrace → U-hall court (north arm)
    stairs(38, 46, -1367, -1362, L1, L2, 'x');           // 6 pool terrace → U-hall court (south arm)
    stairs(95, 100, -1305, -1297, L2, L3, 'z');          // 7 east courts → north-east terrace
    stairs(-46, -38, -1396, -1391, L2, L1, 'x');         // 8 pool terrace → look-out
    // ---------- railings at the drops ----------
    rail('z', -36, -1329, E.z1, L2, [[-1285, -1280]]);
    rail('x', -1329, -36, 46, L2, []);
    rail('z', 46, E.z0, -1329, L2, [[-1367, -1362], [-1336, -1331]]);
    rail('x', -1290, 30, 64, L3, [[41, 46]]); rail('z', 30, -1324, -1290, L3, [[-1310, -1305]]); rail('x', -1324, 30, 64, L3, []); rail('z', 64, -1324, -1290, L3, []);
    rail('z', 66, -1297, E.z1, L3, [[-1272, -1267]]); rail('x', -1297, 66, E.x1, L3, [[95, 100]]);
    rail('z', -46, E.z0, -1384, L2, [[-1396, -1391]]); rail('x', -1384, -60, -46, L2, []);
    rail('x', E.z1 + 10, 22, 50, L2, []); rail('z', 22, E.z1, E.z1 + 10, L2, []); rail('z', 50, E.z1, E.z1 + 2, L2, []);
    // ---------- outer wall ----------
    line('x', E.z1, E.x0, -36, L1, 4.2); line('x', E.z1, -36, 66, L2, 3.2, [[g.x - 6, g.x + 6]]); line('x', E.z1, 66, E.x1, L3, 3.2);
    line('z', E.x1, -1297, E.z1, L3, 3.2); line('z', E.x1, E.z0, -1297, L2, 3.2);
    line('x', E.z0, E.x0, 46, L1, 1.2); line('x', E.z0, 46, E.x1, L2, 1.2);              // cliff side: low, view of the sea
    line('z', E.x0, E.z0, E.z1, L1, 4.2, [[wg.z - 6, wg.z + 6]]);
    // gates
    const gateM = new THREE.Mesh(new THREE.BoxGeometry(12, 3.6, 0.25), new THREE.MeshStandardMaterial({ color: '#2b2b2b', metalness: 0.7, roughness: 0.4 }));
    gateM.position.set(g.x, L2 + 1.8, E.z1);
    scene.add(gateM);
    out.gateMesh = gateM;
    out.gateCol = addBox(g.x - 6, g.x + 6, E.z1 - 0.3, E.z1 + 0.3, L2 + 3.8, { y0: L2 - 0.5 });
    const wgM = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 12), gateM.material);
    wgM.position.set(wg.x, y + 1.7, wg.z);
    scene.add(wgM);
    out.westGateMesh = wgM;
    out.westGateCol = addBox(wg.x - 0.3, wg.x + 0.3, wg.z - 6, wg.z + 6, y + 3.6, { y0: y - 2 });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshBasicMaterial({ map: neonSign('ANWESEN RADJ', '#ffd700', { size: 100, bg: '#1a1408' }), toneMapped: false }));
    sg.position.set(g.x, L2 + 5.2, E.z1 + 0.5);
    scene.add(sg);
    world.signMats.push(sg.material);
    // ---------- gate court (L2) ----------
    hall(30, 56, -1257, -1243, L2, 4.2);                 // gate house (roofed passage behind the gate)
    block(13, 25, -1282, -1244, L2, 5.5);                // building between gate court and garden
    wallOn(13, 25, -1242, -1242, L2);
    // ---------- garden (L2, north-west) ----------
    for (const [x, z, w, d] of [[-22, -1262, 10, 1.4], [-4, -1276, 1.4, 10], [-26, -1290, 8, 1.4], [2, -1254, 8, 1.4]]) { plain.push(cbox(w, 1.5, d, x, L2 + 0.75, z, '#3d6b3a')); addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, L2 + 1.5, { y0: L2 - 0.5 }); }
    line('x', -1300, -36, 25, L2, 3.2, [[-12, -8]], true);       // wall garden | middle court, archway 5
    // ---------- middle court (L2, west of the villa) ----------
    hall(3, 16, -1329, -1308, L2); hall(-25, -12, -1312, -1302, L2); hall(-35, -27, -1326, -1302, L2);
    // ---------- villa on its podium (L3) ----------
    block(37, 60, -1320, -1296, L3, 8); block(50, 58, -1296, -1292, L3, 4);
    const L = ISL.lift;
    plain.push(cbox(0.2, 3.6, 3.2, 36.9, L3 + 1.8, L.z, '#c9a227'));
    const ls = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), new THREE.MeshBasicMaterial({ map: neonSign('▼ AUFZUG', '#ffd700', { size: 90 }), toneMapped: false }));
    ls.position.set(36.75, L3 + 4.2, L.z); ls.rotation.y = -Math.PI / 2;
    scene.add(ls);
    world.signMats.push(ls.material);
    // ---------- north-east terrace (L3) ----------
    hall(68, 100, -1256, -1244, L3); block(80, 90, -1284, -1272, L3, 4.5); block(70, 78, -1296, -1286, L3, 4.5);
    // ---------- east corridor + east courts (L2) ----------
    line('x', -1305, 78, E.x1, L2, 3.2, [[95, 100]], true);      // archway 1 (at the foot of stairs 7)
    line('z', 78, -1345, -1305, L2, 3.2, [[-1323, -1319]], true); // archway 2 corridor ↔ east court
    line('x', -1345, 78, E.x1, L2, 3.2, [[82, 86]], true);       // archway 3 east court ↔ south-east court
    line('z', 78, E.z0, -1345, L2, 3.2);
    hall(104, 118, -1318, -1307, L2); hall(92, 104, -1336, -1322, L2); hall(80, 90, -1326, -1311, L2);
    // ---------- U-shaped hall above the pool (L2) ----------
    hall(60, 77, -1369, -1329, L2); hall(47, 60, -1336, -1330, L2); hall(47, 60, -1368, -1362, L2);
    plain.push(cbox(0.9, 1.0, 7, 46, L2 + 3.4, -1333.5, '#e8c66a'));                      // archway 4 over stairs 5
    plain.push(cbox(0.7, 3.2, 0.7, 46, L2 + 1.6, -1337, WALLC), cbox(0.7, 3.2, 0.7, 46, L2 + 1.6, -1330, WALLC));
    plain.push(cbox(0.9, 1.0, 7, 46, L2 + 3.4, -1364.5, '#e8c66a'));                      // archway 6 over stairs 6
    plain.push(cbox(0.7, 3.2, 0.7, 46, L2 + 1.6, -1368, WALLC), cbox(0.7, 3.2, 0.7, 46, L2 + 1.6, -1361, WALLC));
    // ---------- pool terrace (L1) ----------
    {
      const px0 = -14, px1 = 10, pz0 = -1376, pz1 = -1356;
      plain.push(cbox(px1 - px0 + 2, 0.25, pz1 - pz0 + 2, (px0 + px1) / 2, L1 + 0.12, (pz0 + pz1) / 2, '#e6e2d8'));
      const pool = new THREE.Mesh(new THREE.BoxGeometry(px1 - px0, 0.1, pz1 - pz0), new THREE.MeshStandardMaterial({ color: '#2fb6d8', roughness: 0.05, metalness: 0.2, emissive: '#06303c' }));
      pool.position.set((px0 + px1) / 2, L1 + 0.27, (pz0 + pz1) / 2);
      scene.add(pool);
      addBox(px0, px1, pz0, pz1, L1 + 0.4, { y0: L1 - 1 });
    }
    hall(17, 25, -1341, -1333, L1);
    // ---------- west strip (L1): garage hall, hall in the north ----------
    hall(-58, -46, -1380, -1346, L1, 4); hall(-58, -44, -1275, -1250, L1, 4);
    plain.push(cbox(12, 0.05, 34, -52, L1 + 0.07, -1363, '#5a5d62'));
    out.garageCars = [{ type: 'ferrari', x: -52, z: -1356, h: 0, color: '#111111' }, { type: 'rs6', x: -52, z: -1368, h: 0, color: '#d4af37' }];
    out.towers = [];
    out.estateY = y;
    out.levels = { L1, L2, L3 };
    // fixed patrol routes, each on one level (see the sketch: 9 guards + guards under the roofs)
    const loop = (x0, x1, z0, z1, start = 0) => { const P = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]; return P.slice(start).concat(P.slice(0, start)); };
    out.sentryPosts = [
      [[30, -1276], [54, -1276]],                                      // gate court (not right behind the gate)
      loop(-30, 6, -1294, -1248),                                      // garden
      [[70, -1264], [116, -1264]], [[96, -1270], [96, -1292]],         // north-east terrace
      [[71, -1302], [71, -1326]],                                      // east corridor
      [[108, -1322], [108, -1342]], [[85, -1309], [85, -1342]],        // east court
      [[84, -1356], [114, -1356]],                                     // south-east court
      [[50, -1352], [72, -1352]],                                      // under the U-hall
      [[-22, -1323], [20, -1323]],                                     // middle court
      [[33.5, -1294], [33.5, -1320]], [[40, -1322], [60, -1322]],      // villa podium (lift side, south side)
      loop(-30, 30, -1392, -1346),                                     // round the pool
      [[-52, -1290], [-52, -1328]], [[-42, -1348], [-42, -1380]],      // west strip, garage
    ];
  }
  // ---- helipad + helicopter ----
  {
    const p = ISL.helipad, y = H(p.x, p.z);
    p.y = y;
    plain.push(ccyl(9, 9, 0.3, 28, p.x, y + 0.15, p.z, '#3a3c40'));
    const hm = neonSign('H', '#ffffff', { size: 200, bg: '#3a3c40', border: false });
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: hm, transparent: true }));
    hp.rotation.x = -Math.PI / 2;
    hp.position.set(p.x, y + 0.32, p.z);
    scene.add(hp);
    const heli = new THREE.Group();
    const hb = [];
    hb.push(cbox(2.4, 2.2, 4.6, 0, 1.6, 0, '#1b1b1f'));
    hb.push(cbox(2.2, 1.5, 1.8, 0, 1.9, 2.4, '#1a2633'));
    hb.push(cbox(0.6, 0.6, 5.5, 0, 2.2, -4.6, '#1b1b1f'));
    hb.push(cbox(0.15, 1.6, 1.0, 0, 2.8, -7.1, '#ffd700'));
    for (const sx of [-1, 1]) hb.push(cbox(0.15, 0.15, 4.8, sx * 1.3, 0.15, 0.2, '#555'));
    hb.push(cbox(2.42, 0.25, 4.62, 0, 1.4, 0, '#ffd700'));
    heli.add(new THREE.Mesh(merge(hb), vmat));
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: '#111' }));
    rotor.position.y = 3.05;
    heli.add(rotor);
    heli.position.set(p.x, y + 0.3, p.z);
    heli.rotation.y = Math.PI / 2;
    heli.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(heli);
    out.heli = heli; out.rotor = rotor;
    addBox(p.x - 2.4, p.x + 2.4, p.z - 1.4, p.z + 1.4, y + 2.8, { y0: y - 1 });
  }
  // ---- the secret cellar (reached only by the lift) ----
  {
    const C = RADJ_CELLAR, y = C.y, h = 6;
    const cx = (C.x0 + C.x1) / 2;
    plain.push(cbox(C.x1 - C.x0, 0.2, C.z1 - C.z0, cx, y - 0.1, (C.z0 + C.z1) / 2, '#1c1c22'));
    plain.push(cbox(C.x1 - C.x0, 0.3, C.z1 - C.z0, cx, y + h, (C.z0 + C.z1) / 2, '#111116'));
    const wall = (x0, x1, z0, z1) => { plain.push(cbox(x1 - x0, h, z1 - z0, (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2, '#2a2a33')); addBox(x0, x1, z0, z1, y + h, { y0: y - 1 }); };
    wall(C.x0, C.x1, C.z0, C.z0 + 0.6); wall(C.x0, C.x1, C.z1 - 0.6, C.z1);
    wall(C.x0, C.x0 + 0.6, C.z0, C.z1); wall(C.x1 - 0.6, C.x1, C.z0, C.z1);
    // red carpet, gold pillars
    plain.push(cbox(4, 0.02, C.z1 - C.z0 - 4, cx, y + 0.02, (C.z0 + C.z1) / 2, '#7a0c12'));
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const z = C.z1 - 6 - k * 9; plain.push(ccyl(0.5, 0.5, h, 10, cx + sx * 8, y + h / 2, z, '#c9a227')); addCirc(cx + sx * 8, z, 0.5, y + h, y - 1); }
    // lift cabin at the north end
    plain.push(cbox(4, h, 0.2, ISL.cellarLift.x, y + h / 2, C.z1 - 0.7, '#c9a227'));
    // glass case on a pedestal
    const G = ISL.glass;
    plain.push(cbox(2.4, 1.1, 2.4, G.x, y + 0.55, G.z, '#111'));
    addBox(G.x - 1.2, G.x + 1.2, G.z - 1.2, G.z + 1.2, y + 1.1, { y0: y - 1 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 2), new THREE.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.3 }));
    glass.position.set(G.x, y + 2.0, G.z);
    scene.add(glass);
    out.glass = glass;
    const prize = new THREE.Group();
    const goldM = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 1, roughness: 0.2, emissive: '#5a4100' });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 16), goldM);
    bottle.position.y = 0.45;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.4, 12), goldM);
    neck.position.y = 1.1;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), goldM);
    cap.position.y = 1.35;
    prize.add(bottle, neck, cap);
    prize.position.set(G.x, y + 1.15, G.z);
    scene.add(prize);
    out.prize = prize;
    for (let k = 0; k < 3; k++) { const lm = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.6), new THREE.MeshBasicMaterial({ color: '#fff3d0', toneMapped: false })); lm.position.set(cx, y + h - 0.1, C.z1 - 8 - k * 13); scene.add(lm); }
  }
  const gm = new THREE.Mesh(merge(glow), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  scene.add(gm);
  world.signMats.push(gm.material);
  const mesh = new THREE.Mesh(merge(plain), vmat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  world.landmarks.push({ name: 'Radj-Insel', x: RADJ.x, z: RADJ.z, icon: '🏝️', color: '#ffd700', hideMini: true });
  out.root = scene;
  return out;
}
