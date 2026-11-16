// Radj-Insel: airstrip, serpentine road through a dense forest, walled estate with mansion,
// secret cellar with the golden Bubensahne, helipad. Built once at start (visible from the plane).
import * as THREE from 'three';
import { RADJ, RADJ_CELLAR, RADJ_STRIP, RADJ_ESTATE, radjGround, radjE } from './geo.js';
import { addBox, addCirc, addFloor, world } from './world.js';
import { cbox, ccyl, merge, neonSign, srand, srange, canvasTex, colorize } from './util.js';
import { makeHuman } from './human.js';
import { anwesen, mediterranMats, poolOutline } from './anwesen.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const H = (x, z) => radjGround(x, z);

export const ISL = {
  strip: RADJ_STRIP,
  road: [[80, -1079], [100, -1096], [96, -1112], [40, -1124], [-6, -1140], [30, -1166], [96, -1186], [92, -1214], [44, -1232], [40, -1258], [30, -1290], [40, -1312], [40, -1336]], // ends at the foot of the ramp up to the main gate
  estate: RADJ_ESTATE,
  gate: { x: 40, z: -1340 },
  westGate: { x: 0, z: -1370 },
  mansion: { x0: 43, x1: 54, z0: -1367.5, z1: -1359.5 },
  lift: { x: 49, z: -1362, y: 0 }, // set exactly from the villa model (office on the upper floor) in buildRadjIsland
  helipad: { x: -186, z: -1332 },
  helRoad: [[0, -1370], [-40, -1366], [-80, -1348], [-120, -1326], [-160, -1334], [-186, -1332]],
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
        pos.push(x, radjGround(x, z, true), z);
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
    // the estate lies in a pit: the island surface is cut open over it (fragments inside the walls are discarded)
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), PE = ISL.estate;
    gm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('void main() {', `void main() {\n if (vWP.x > ${PE.x0.toFixed(1)} && vWP.x < ${PE.x1.toFixed(1)} && vWP.z > ${PE.z0.toFixed(1)} && vWP.z < ${PE.z1.toFixed(1)}) discard;`);
    };
    const m = new THREE.Mesh(g, gm);
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
      const man = makeHuman({ round: true, skin: '#c68a62', hair: '#111', shirt: '#2f3b2a', pants: '#1f2a1c', shoes: '#111', hairStyle: 0, cap: '#1f2a1c', vest: '#2b3128', glove: '#151515' });
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
        if (x > 34 && x < 46 && z > E.z1 - 1 && z < E.z1 + 15) return; // ramp in front of the gate
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
      if (x > 31 && x < 49 && z > E.z1 - 2 && z < E.z1 + 17) continue; // ramp in front of the gate
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
    // foliage without shadows: ~120k triangles less in the shadow pass (the estate is detailed enough already)
    inst(pineG, foliage, pines, true, false);
    inst(leafG, foliage, leafy, true, false, 1.3);
    inst(bushG, foliage, bushes, true, false);
  }
  // ---- the estate: Nick's "anwesen" module (src/anwesen.js – 72 × 60 m, mediterranean, three levels of 2.64 m) ----
  // The module has its gate at −z and the west gate at −x; on the island the gate has to face north (+z), so the whole
  // thing is mirrored in z. All parts are baked into one mesh per material (few draw calls). Collision comes from the
  // module's own data: platforms/walls (userData.rec), the parts' userData.colliders and every "treppe" (stairs → ramp).
  {
    // y = pool level (1st level), 2.64 m below the island: the gate level is level with the forest road
    const E = ISL.estate, LH = 2.64, y = radjGround((E.x0 + E.x1) / 2, (E.z0 + E.z1) / 2, true) - LH;
    E.y = y;
    const CX = (E.x0 + E.x1) / 2, CZ = (E.z0 + E.z1) / 2;
    const A = anwesen();
    A.scale.z = -1; A.position.set(CX, y, CZ); A.updateMatrixWorld(true);
    const REC = A.userData.rec, V = A.userData.villa;
    // module coordinates → world
    const mbox = (x0, x1, z0, z1, y0, y1, extra) => addBox(CX + x0, CX + x1, CZ - z0, CZ - z1, y + y1, { y0: y + y0 - 0.3, ...extra });
    const mfloor = (x0, x1, z0, z1, ya, yb = ya, axis = 'x') => (axis === 'z' ? addFloor(CX + x0, CX + x1, CZ - z1, CZ - z0, y + yb, y + ya, 'z') : addFloor(CX + x0, CX + x1, CZ - z1, CZ - z0, y + ya, y + yb, 'x'));
    // a box given in the local coordinates of a part → world AABB
    const _a = new THREE.Vector3(), _b = new THREE.Vector3();
    const lbox = (o, x0, x1, z0, z1) => { _a.set(x0, 0, z0); _b.set(x1, 0, z1); o.localToWorld(_a); o.localToWorld(_b); return [Math.min(_a.x, _b.x), Math.max(_a.x, _b.x), Math.min(_a.z, _b.z), Math.max(_a.z, _b.z), _a.y]; };
    const pbox = (o, x0, x1, z0, z1, y0, y1, extra) => { const [a, b, c, d, by] = lbox(o, x0, x1, z0, z1); return addBox(a, b, c, d, by + y1, { y0: by + y0 - 0.3, ...extra }); };
    const pfloor = (o, x0, x1, z0, z1, ya, yb = ya, axisLocal = 'x') => {
      const [a, b, c, d, by] = lbox(o, x0, x1, z0, z1);
      if (ya === yb) return addFloor(a, b, c, d, by + ya);
      // which world axis does the local axis map to, and does the low end sit at the min coordinate?
      _a.set(axisLocal === 'x' ? x0 : 0, 0, axisLocal === 'z' ? z0 : 0); _b.set(axisLocal === 'x' ? x1 : 0, 0, axisLocal === 'z' ? z1 : 0); o.localToWorld(_a); o.localToWorld(_b);
      const ax = Math.abs(_b.x - _a.x) > Math.abs(_b.z - _a.z) ? 'x' : 'z', lowFirst = ax === 'x' ? _a.x < _b.x : _a.z < _b.z;
      return addFloor(a, b, c, d, by + (lowFirst ? ya : yb), by + (lowFirst ? yb : ya), ax);
    };
    // ---------- platforms, walls, ramp, round things ----------
    for (const [x0, x1, z0, z1, y0, y1] of REC.plats) { mbox(x0, x1, z0, z1, y0 - 0.7, y1); mfloor(x0, x1, z0, z1, y1); }
    for (const [x0, z0, x1, z1, yb, h, t] of REC.walls) { const hx = x0 === x1 ? t / 2 : 0, hz = z0 === z1 ? t / 2 : 0; mbox(Math.min(x0, x1) - hx, Math.max(x0, x1) + hx, Math.min(z0, z1) - hz, Math.max(z0, z1) + hz, yb, yb + h + 0.1); }
    for (const [x, yy, z, r, h] of REC.round) addCirc(CX + x, CZ - z, r, y + yy + h, y + yy - 0.5);
    // pool: a ring of posts along its rim (follows the curved shape – you can walk round it closely)
    { const P0 = poolOutline(0, 9); for (let k = 0; k < P0.length; k++) { const a = P0[k], b = P0[(k + 1) % P0.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.9)); for (let t = 0; t < n; t++) addCirc(CX - 8 + a[0] + (b[0] - a[0]) * t / n, CZ - 19 - (a[1] + (b[1] - a[1]) * t / n), 0.45, y + 1.6, y - 0.5); } }
    // ---------- parts: colliders + stairs ----------
    const HEIGHT = { gelaender: 1.1, hecke: 1.0, torbogen: 5, torbogenZwischen: 5, bogengang: 4.7, hausblock: 9, seehaus: 5.7, pavillon: 6 };
    const gateCols = [];
    A.traverse((o) => {
      if (o.name === 'treppe' && o.userData.stairs) {
        const st = o.userData.stairs;
        pfloor(o, -st.w / 2, st.w / 2, -st.length, 0, st.height, 0, 'z');    // local: foot at z = 0, top at z = −length
      }
      if (!o.userData.colliders || o === V) return;
      const h = o.name === 'treppe' ? o.userData.stairs.height + 1.0 : HEIGHT[o.name] || 4;
      for (const c of o.userData.colliders) {
        if (c.gate) { gateCols.push(pbox(o, c.x - c.w / 2, c.x + c.w / 2, c.z - 0.3, c.z + 0.3, -0.5, 4)); continue; }
        if (c.gapAt !== undefined) {       // wall with a doorway (stairs of the Seehaus)
          pbox(o, 4.5, c.gapAt - c.gap / 2, c.z - c.d / 2, c.z + c.d / 2, 0, h);   // (the court-side wall starts behind the short wing)
          pbox(o, c.gapAt + c.gap / 2, c.x + c.w / 2, c.z - c.d / 2, c.z + c.d / 2, 0, h);
          continue;
        }
        pbox(o, c.x - c.w / 2, c.x + c.w / 2, c.z - c.d / 2, c.z + c.d / 2, 0, h);
      }
      if (o.name === 'seehaus') {          // raised hall: podium of 0.99 m under both wings (len 46, depth 4.5, wing 7.45)
        const pod = o.userData.podium;
        for (const [x0, x1, z0, z1] of [[0, 46, -4.5, 0], [0, 4.5, -7.45, -4.5]]) { pbox(o, x0, x1, z0, z1, -0.5, pod); pfloor(o, x0, x1, z0, z1, pod); }
        pbox(o, 45.4, 46, -4.5, 0, 0, 5.7); pbox(o, 0, 4.5, -7.45, -6.85, 0, 5.7);   // closed ends
        pbox(o, 4.2, 4.5, -7.45, -4.5, 0, 5.7);                                       // short wing, court side (arches with balustrades)
      }
    });
    // ---------- villa: ground floor solid, stairs along the north wall → balcony → office with the lift ----------
    {
      const U = V.userData, F = U.floorY, S = U.stairs, Bc = U.balcony, O = U.office, top = 9;
      pbox(V, -5.5, 5.5, -4, 4, -0.5, F);                                   // main block, ground floor
      pbox(V, Bc.x0, Bc.x1, Bc.z0, Bc.z1, -0.5, F);                         // annex under the balcony
      pfloor(V, Bc.x0, Bc.x1, Bc.z0, Bc.z1, F);
      pfloor(V, O.x0, O.x1, -4, O.z1, F);                                   // office floor (incl. the door sill)
      pfloor(V, S.x0, S.x1, S.z - S.w / 2, S.z + S.w / 2, 0, F, 'x');       // stairs
      pbox(V, S.x0, S.x1, S.z - S.w / 2 - 0.2, S.z - S.w / 2, 0, F + 1.1);  // stair railing (outer side)
      pbox(V, Bc.x0, Bc.x1, Bc.z0 - 0.15, Bc.z0 + 0.1, F, F + 1.1); pbox(V, Bc.x1 - 0.1, Bc.x1 + 0.15, Bc.z0, Bc.z1, F, F + 1.1);   // balcony railing
      // upper floor: everything outside the office is solid, door from the balcony
      pbox(V, -5.5, O.x0, -4, 4, F, top); pbox(V, O.x0, 5.5, O.z1, 4, F, top); pbox(V, O.x1, 5.5, -4, O.z1, F, top);
      pbox(V, O.x0, U.door.x - 0.6, -4, O.z0, F, top); pbox(V, U.door.x + 0.6, 5.5, -4, O.z0, F, top);
      const p = new THREE.Vector3(U.lift.x, F, U.lift.z); V.localToWorld(p);
      ISL.lift.x = p.x; ISL.lift.z = p.z; ISL.lift.y = p.y;
      p.set(U.lift.x + 1.6, F, U.lift.z); V.localToWorld(p);
      ISL.liftOut = { x: p.x, z: p.z, y: p.y };
    }
    // ---------- one mesh per material (baked + mirrored), the two gate grilles stay separate so they can open ----------
    {
      const M = mediterranMats(), cast = new Set([M.stucco, M.roof]); // (stone = balustrades: 77k triangles, no shadows)
      const byMat = new Map(), grilles = [];
      A.traverse((o) => {
        if (!o.isMesh) return;
        let gq = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const a of Object.keys(gq.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') gq.deleteAttribute(a);
        if (!gq.attributes.uv) gq.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gq.attributes.position.count * 2), 2));
        if (!gq.attributes.normal) gq.computeVertexNormals();
        gq.applyMatrix4(o.matrixWorld);
        for (const at of Object.values(gq.attributes)) { const n = at.itemSize, ar = at.array; for (let v = 0; v < at.count; v += 3) for (let k = 0; k < n; k++) { const t = ar[(v + 1) * n + k]; ar[(v + 1) * n + k] = ar[(v + 2) * n + k]; ar[(v + 2) * n + k] = t; } }   // mirrored → flip the winding
        if (o.name === 'torbogen_iron') { const m = new THREE.Mesh(gq, o.material); scene.add(m); grilles.push(m); return; }
        if (!byMat.has(o.material)) byMat.set(o.material, []);
        byMat.get(o.material).push(gq);
      });
      for (const [mat, list] of byMat) {
        const m = new THREE.Mesh(mergeGeometries(list, false), mat);
        m.castShadow = cast.has(mat); m.receiveShadow = true;
        if (mat === M.water) m.renderOrder = 2;
        scene.add(m);
      }
      out.gateMesh = grilles[0]; out.westGateMesh = grilles[1];
      out.gateCol = gateCols[0]; out.westGateCol = gateCols[1];
    }
    // foundation: the terrain mesh is coarse and falls away toward the beach – a stone plinth closes the gap under the estate
    plain.push(cbox(E.x1 - E.x0 + 1.2, 9, E.z1 - E.z0 + 1.2, CX, y - 4.52, CZ, '#b3a07c'));
    out.towers = [];
    out.estateY = y;
    out.levels = { L1: y, L2: y + LH, L3: y + 2 * LH };
    const W = ([x, z]) => [CX + x, CZ - z];
    out.garageCars = [];                          // no cars inside the estate (Nick)
    out.bike = { x: ISL.gate.x - 9, z: ISL.gate.z + 9 };   // green motorbike outside, next to the main gate
    // fixed patrol routes (step 4, checked: every leg stays on its level and clear of walls with r 0.36)
    // module coordinates; a point is [x, z] or [x, z, lookX, lookZ, wait] (look = where he looks while standing there);
    // 2 points = there and back, more = a loop (ping-pong paths repeat the points), 1 point = fixed post.
    // lv = level of the first point (1 pool, 2 gate/courts, 3 villa podium + north-east terrace, 4.3 villa balcony)
    const R = (lv, ...pts) => {
      const r = pts.map(([x, z, lx, lz, wait]) => {
        const p = [CX + x, CZ - z];
        p.look = lx === undefined ? undefined : Math.atan2(lx - x, -(lz - z));
        p.wait = wait;
        return p;
      });
      r.y = y + (lv - 1) * LH;
      return r;
    };
    out.sentryPosts = [
      R(2, [9, -28.2, 9, -20], [17, -28.2, 17, -20]),                    // gate court: under the east arcade (nobody right behind the gate)
      R(2, [-23, -18.5], [-14, -18.5], [-14, -25.5], [-23, -25.5]),      // garden, between the rows of pots
      R(2, [-16, -11.1], [-5, -11.1], [-5, 6], [-16, 6]),                // middle court, round the courtyard
      R(2, [-11, -6], [5.5, -6]),                                        // middle court ↔ up the stairs onto the villa podium
      R(3, [4, -12.5], [4, -0.6], [19, -0.6], [4, -0.6]),                // villa podium, west + south side
      R(4.3, [16, -12.3, 10, -30, 0]),                                   // lookout on the villa balcony, watching the gate court
      R(3, [22.5, -27], [22.5, -16]),                                    // north-east terrace
      R(2, [23, -6.5], [33, -6.5]),                                      // east court
      R(2, [14, 14.3], [24, 14.3], [24, 24.2], [14, 24.2]),              // round the fountain in the U court
      R(2, [23.5, 27.2, 23.5, 20], [32.5, 27.2, 30, 20]),                // under the roof of the U hall (south wing)
      R(2, [28, 11.3, 19, 19, 0]),                                       // post under the roof of the U hall (north wing)
      R(1, [-3, 14.5], [-20, 14.5], [-20, 24.5], [-20, 14.5]),           // pool terrace
      R(1, [-31.2, 10.5], [-31.2, 21]),                                  // under the Seehaus colonnade
      R(1, [-30, -14], [-30, 6]),                                        // west strip (garage / west gate)
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
