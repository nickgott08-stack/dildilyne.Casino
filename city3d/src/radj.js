// Radj-Insel: airstrip, serpentine road through a dense forest, walled estate with mansion,
// secret cellar with the golden Bubensahne, helipad. Built once at start (visible from the plane).
import * as THREE from 'three';
import { RADJ, RADJ_CELLAR, RADJ_STRIP, RADJ_ESTATE, radjGround, radjE } from './geo.js';
import { addBox, addCirc, world } from './world.js';
import { cbox, ccyl, merge, neonSign, srand, srange, canvasTex, colorize } from './util.js';

const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const H = (x, z) => radjGround(x, z);

export const ISL = {
  strip: RADJ_STRIP,
  road: [[80, -1079], [100, -1096], [96, -1112], [40, -1124], [-6, -1140], [30, -1166], [96, -1186], [92, -1214], [44, -1232], [40, -1258]],
  estate: RADJ_ESTATE,
  gate: { x: 40, z: -1270 },
  westGate: { x: -40, z: -1335 },
  mansion: { x0: 10, x1: 74, z0: -1366, z1: -1322 },
  lift: { x: 42, z: -1320 },
  helipad: { x: -186, z: -1332 },
  helRoad: [[-40, -1335], [-80, -1340], [-120, -1326], [-160, -1334], [-186, -1332]],
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
  // ---- forest: layered pines, leafy trees and bushes (instanced, flat-shaded like the city trees) ----
  {
    const pines = [], leafy = [], bushes = [];
    const E = ISL.estate;
    for (let k = 0; k < 2600; k++) {
      const x = srange(-230, 230), z = srange(-1430, -1030);
      const e = radjE(x, z);
      if (e > 0.78) continue;
      if (x > ISL.strip.x0 - 10 && x < ISL.strip.x1 + 14 && z > ISL.strip.z0 - 12 && z < ISL.strip.z1 + 22) continue;
      if (x > E.x0 - 6 && x < E.x1 + 6 && z > E.z0 - 6 && z < E.z1 + 9) continue;
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
  // ---- the estate ----
  {
    const E = ISL.estate, y = H((E.x0 + E.x1) / 2, (E.z0 + E.z1) / 2);
    E.y = y;
    const wallC = '#efe6d6', wh = 4.2;
    const wall = (x0, x1, z0, z1) => { plain.push(cbox(x1 - x0, wh, z1 - z0, (x0 + x1) / 2, y + wh / 2 - 0.5, (z0 + z1) / 2, wallC)); plain.push(cbox(x1 - x0 + 0.3, 0.25, z1 - z0 + 0.3, (x0 + x1) / 2, y + wh - 0.4, (z0 + z1) / 2, '#cfc3ab')); addBox(x0, x1, z0, z1, y + wh, { y0: y - 2 }); };
    const g = ISL.gate, wg = ISL.westGate;
    wall(E.x0, g.x - 6, E.z1 - 0.4, E.z1 + 0.4); wall(g.x + 6, E.x1, E.z1 - 0.4, E.z1 + 0.4);
    wall(E.x0, E.x1, E.z0 - 0.4, E.z0 + 0.4);
    wall(E.x1 - 0.4, E.x1 + 0.4, E.z0, E.z1);
    wall(E.x0 - 0.4, E.x0 + 0.4, E.z0, wg.z - 6); wall(E.x0 - 0.4, E.x0 + 0.4, wg.z + 6, E.z1);
    for (const [x, z] of [[E.x0, E.z0], [E.x1, E.z0], [E.x0, E.z1], [E.x1, E.z1], [g.x - 6.4, E.z1], [g.x + 6.4, E.z1]]) {
      plain.push(cbox(1.6, wh + 1.2, 1.6, x, y + (wh + 1.2) / 2 - 0.5, z, '#d8cfbd'), cbox(1.9, 0.3, 1.9, x, y + wh + 0.85, z, '#c9a227'));
    }
    // wall lamps + cameras
    for (let x = E.x0 + 8; x < E.x1 - 4; x += 16) for (const zz of [E.z1 + 0.5, E.z0 - 0.5]) {
      if (Math.abs(x - g.x) < 8) continue;
      glow.push(cbox(0.3, 0.4, 0.2, x, y + 3.0, zz, '#ffd890'));
    }
    for (const [x, z, r] of [[g.x - 7, E.z1 + 0.6, 0], [g.x + 7, E.z1 + 0.6, 0], [E.x0 - 0.6, wg.z + 7, Math.PI / 2], [E.x1 + 0.6, -1340, -Math.PI / 2]]) {
      plain.push(cbox(0.25, 0.25, 0.55, x, y + 4.1, z + (r === 0 ? 0.25 : 0), '#e8e8e8', r), cbox(0.18, 0.18, 0.06, x, y + 4.1, z + (r === 0 ? 0.53 : 0), '#111', r));
      glow.push(cbox(0.05, 0.05, 0.05, x + 0.08, y + 4.2, z + (r === 0 ? 0.56 : 0), '#ff2020'));
    }
    // gates
    const gateM = new THREE.Mesh(new THREE.BoxGeometry(12, 3.6, 0.25), new THREE.MeshStandardMaterial({ color: '#2b2b2b', metalness: 0.7, roughness: 0.4 }));
    gateM.position.set(g.x, y + 1.8, E.z1);
    scene.add(gateM);
    out.gateMesh = gateM;
    out.gateCol = addBox(g.x - 6, g.x + 6, E.z1 - 0.3, E.z1 + 0.3, y + 3.8, { y0: y - 2 });
    for (let k = -5; k <= 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.9, roughness: 0.3 })); b.position.set(k * 1.05, 2.0, 0); gateM.add(b); }
    const wgM = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 12), gateM.material);
    wgM.position.set(wg.x, y + 1.7, wg.z);
    scene.add(wgM);
    out.westGateMesh = wgM;
    out.westGateCol = addBox(wg.x - 0.3, wg.x + 0.3, wg.z - 6, wg.z + 6, y + 3.6, { y0: y - 2 });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshBasicMaterial({ map: neonSign('ANWESEN RADJ', '#ffd700', { size: 100, bg: '#1a1408' }), toneMapped: false }));
    sg.position.set(g.x, y + 5.2, E.z1 + 0.5);
    scene.add(sg);
    world.signMats.push(sg.material);
    plain.push(cbox(2.6, 2.8, 2.6, g.x + 10, y + 1.4, E.z1 + 3, '#d8cfbd'), cbox(3.0, 0.3, 3.0, g.x + 10, y + 2.95, E.z1 + 3, '#3a3a3a'));
    glow.push(cbox(1.6, 0.8, 0.05, g.x + 10, y + 1.8, E.z1 + 4.32, '#bfe6ff'));
    addBox(g.x + 8.7, g.x + 11.3, E.z1 + 1.7, E.z1 + 4.3, y + 2.8, { y0: y - 2 });
    // lawn + gravel
    plain.push(cbox(E.x1 - E.x0 - 2, 0.04, E.z1 - E.z0 - 2, (E.x0 + E.x1) / 2, y + 0.03, (E.z0 + E.z1) / 2, '#3f7a34'));
    const M = ISL.mansion;
    plain.push(cbox(8, 0.06, E.z1 - M.z1, g.x, y + 0.06, (E.z1 + M.z1) / 2, '#cbbd9c'));
    plain.push(cbox(E.x1 - E.x0 - 4, 0.06, 6, (E.x0 + E.x1) / 2, y + 0.06, wg.z, '#cbbd9c'));
    plain.push(cbox(M.x1 - M.x0 + 34, 0.06, 5, (M.x0 + M.x1) / 2, y + 0.06, M.z0 - 6, '#cbbd9c'));
    // fountain with a golden figure
    plain.push(ccyl(5.2, 5.5, 0.9, 24, g.x, y + 0.45, -1300, '#d6d0c4'), ccyl(4.7, 4.7, 0.1, 24, g.x, y + 0.86, -1300, '#2f8fbf'));
    plain.push(ccyl(1.4, 1.8, 1.2, 12, g.x, y + 1.3, -1300, '#d6d0c4'), ccyl(0.35, 0.45, 1.6, 10, g.x, y + 2.7, -1300, '#c9a227'));
    plain.push(ccyl(0.45, 0.5, 0.8, 10, g.x, y + 3.9, -1300, '#c9a227'), ccyl(0.18, 0.22, 0.5, 8, g.x, y + 4.55, -1300, '#c9a227'));
    addCirc(g.x, -1300, 5.5, y + 1);
    // statues on pedestals along the drive
    for (const [x, z] of [[30, -1290], [50, -1290], [30, -1312], [50, -1312]]) {
      plain.push(cbox(1.4, 1.2, 1.4, x, y + 0.6, z, '#e8e0cf'), cbox(0.6, 1.8, 0.5, x, y + 2.1, z, '#f5f2ea'), ccyl(0.3, 0.3, 0.5, 8, x, y + 3.25, z, '#f5f2ea'));
      addBox(x - 0.7, x + 0.7, z - 0.7, z + 0.7, y + 3.5, { y0: y - 1 });
    }
    // garden lamps
    for (const [x, z] of [[35, -1280], [45, -1280], [35, -1318], [45, -1318], [-20, -1335], [100, -1335], [10, -1372], [70, -1372]]) {
      plain.push(cbox(0.12, 2.2, 0.12, x, y + 1.1, z, '#2b2b2b'));
      glow.push(cbox(0.36, 0.36, 0.36, x, y + 2.3, z, '#ffe2b0'));
    }
    // hedges for cover (kept clear of the patrol routes)
    const hedge = (x, z, w, d) => { plain.push(cbox(w, 1.5, d, x, y + 0.75, z, '#24502a')); addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + 1.5, { y0: y - 1 }); };
    for (const [x, z, w, d] of [[-22, -1316, 6, 1.4], [104, -1316, 6, 1.4], [8, -1384, 10, 1.4], [76, -1384, 10, 1.4], [-24, -1356, 1.4, 8], [106, -1356, 1.4, 8], [16, -1300, 1.4, 6], [64, -1300, 1.4, 6], [40, -1388, 8, 1.4]]) hedge(x, z, w, d);
    // pool with loungers and palms (east front lawn)
    {
      const px0 = 82, px1 = 108, pz0 = -1302, pz1 = -1288;
      plain.push(cbox(px1 - px0 + 2, 0.25, pz1 - pz0 + 2, (px0 + px1) / 2, y + 0.12, (pz0 + pz1) / 2, '#f0ece2'));
      const pool = new THREE.Mesh(new THREE.BoxGeometry(px1 - px0, 0.1, pz1 - pz0), new THREE.MeshStandardMaterial({ color: '#2fb6d8', roughness: 0.05, metalness: 0.2, emissive: '#06303c' }));
      pool.position.set((px0 + px1) / 2, y + 0.27, (pz0 + pz1) / 2);
      scene.add(pool);
      addBox(px0, px1, pz0, pz1, y + 0.4, { y0: y - 1 });
      for (let k = 0; k < 4; k++) { const x = px0 + 3 + k * 6.5; plain.push(cbox(0.9, 0.3, 2.1, x, y + 0.45, pz1 + 2.6, '#ffffff'), cbox(0.9, 0.5, 0.5, x, y + 0.7, pz1 + 1.7, '#ffffff', 0, -0.6)); }
      plain.push(ccyl(1.2, 0.05, 0.6, 10, px0 + 6, y + 2.4, pz1 + 2.6, '#ff3df0'), cbox(0.06, 2.2, 0.06, px0 + 6, y + 1.1, pz1 + 2.6, '#ddd'));
      for (const [x, z] of [[px0 - 2, pz0 - 2], [px1 + 2, pz0 - 2], [px0 - 2, pz1 + 4], [px1 + 2, pz1 + 4]]) {
        plain.push(ccyl(0.22, 0.32, 6, 6, x, y + 3, z, '#8a6a45'));
        for (let a = 0; a < 6; a++) plain.push(cbox(0.5, 0.08, 3.2, x + Math.sin(a) * 1.4, y + 6.0, z + Math.cos(a) * 1.4, '#2e8b3a', a, -0.35));
        addCirc(x, z, 0.35, y + 6, y - 1);
      }
    }
    // garage with luxury cars (west front)
    {
      const gx0 = -36, gx1 = -14, gz0 = -1302, gz1 = -1284;
      plain.push(cbox(gx1 - gx0, 4.6, 0.4, (gx0 + gx1) / 2, y + 2.3, gz0, '#efe6d6'), cbox(gx1 - gx0, 4.6, 0.4, (gx0 + gx1) / 2, y + 2.3, gz1, '#efe6d6'));
      plain.push(cbox(0.4, 4.6, gz1 - gz0, gx0, y + 2.3, (gz0 + gz1) / 2, '#efe6d6'));
      plain.push(cbox(gx1 - gx0 + 1, 0.4, gz1 - gz0 + 1, (gx0 + gx1) / 2, y + 4.8, (gz0 + gz1) / 2, '#3a3a3a'));
      plain.push(cbox(gx1 - gx0, 0.05, gz1 - gz0, (gx0 + gx1) / 2, y + 0.07, (gz0 + gz1) / 2, '#5a5d62'));
      addBox(gx0, gx1, gz0 - 0.2, gz0 + 0.2, y + 4.6, { y0: y - 1 }); addBox(gx0, gx1, gz1 - 0.2, gz1 + 0.2, y + 4.6, { y0: y - 1 }); addBox(gx0 - 0.2, gx0 + 0.2, gz0, gz1, y + 4.6, { y0: y - 1 });
      glow.push(cbox(gx1 - gx0 - 2, 0.08, 0.3, (gx0 + gx1) / 2, y + 4.55, (gz0 + gz1) / 2, '#ffffff'));
      out.garageCars = [{ type: 'ferrari', x: -25, z: -1288.5, h: Math.PI / 2, color: '#111111' }, { type: 'rs6', x: -25, z: -1297, h: Math.PI / 2, color: '#d4af37' }];
    }
    // watchtowers in the north-east and south-west corners with searchlights
    out.towers = [];
    for (const [tx, tz] of [[E.x1 - 4, E.z1 - 4], [E.x0 + 4, E.z0 + 4]]) {
      for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) plain.push(cbox(0.25, 8, 0.25, tx + a, y + 4, tz + b, '#4a4d52'));
      plain.push(cbox(3.6, 0.3, 3.6, tx, y + 8, tz, '#4a4d52'), cbox(3.6, 1.1, 0.12, tx, y + 8.7, tz - 1.75, '#4a4d52'), cbox(3.6, 1.1, 0.12, tx, y + 8.7, tz + 1.75, '#4a4d52'));
      plain.push(cbox(3.8, 0.25, 3.8, tx, y + 10.6, tz, '#2b2b2b'));
      for (const [a, b] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) plain.push(cbox(0.12, 2.3, 0.12, tx + a, y + 9.4, tz + b, '#2b2b2b'));
      addBox(tx - 1.6, tx + 1.6, tz - 1.6, tz + 1.6, y + 10.8, { y0: y - 1 });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 22, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      beam.geometry.translate(0, -11, 0);
      const piv = new THREE.Group();
      piv.position.set(tx, y + 9.6, tz);
      piv.add(beam);
      beam.rotation.x = -1.0;
      scene.add(piv);
      out.towers.push(piv);
    }
    // the mansion: cream stucco on a stone plinth, terracotta hip roofs, a central gable,
    // white window frames with dark glass that lights up at night, two wings with balconies
    const mh = 13;
    const wingH = 9;
    const WALL = '#f3ead8', TRIM = '#e4d6b8', STONE = '#c9b993', ROOF = '#a4502f', FRAME = '#fbfaf6', GOLD = '#c9a227';
    const wins = [];
    const winMat = new THREE.MeshStandardMaterial({ color: '#2a3946', roughness: 0.12, metalness: 0.6, emissive: '#ffbe6a', emissiveIntensity: 0 });
    world.windowMats.push(winMat);
    // window on a wall facing +z (dir 1) or -z (dir -1) or ±x (axis 'x')
    const win = (x, yc, z, w, h, dir, axis = 'z') => {
      const o = 0.06 * dir;
      if (axis === 'z') {
        plain.push(cbox(w + 0.5, h + 0.5, 0.14, x, yc, z + o, FRAME), cbox(w + 0.9, 0.22, 0.4, x, yc - h / 2 - 0.3, z + o * 3, TRIM), cbox(w + 0.8, 0.3, 0.25, x, yc + h / 2 + 0.45, z + o * 2, TRIM));
        wins.push(cbox(w, h, 0.08, x, yc, z + o * 2.2, '#ffffff'));
        plain.push(cbox(0.1, h, 0.1, x, yc, z + o * 3, FRAME), cbox(w, 0.1, 0.1, x, yc + h * 0.15, z + o * 3, FRAME));
      } else {
        plain.push(cbox(0.14, h + 0.5, w + 0.5, x + o, yc, z, FRAME), cbox(0.4, 0.22, w + 0.9, x + o * 3, yc - h / 2 - 0.3, z, TRIM));
        wins.push(cbox(0.08, h, w, x + o * 2.2, yc, z, '#ffffff'));
        plain.push(cbox(0.1, h, 0.1, x + o * 3, yc, z, FRAME));
      }
    };
    const cx = (M.x0 + M.x1) / 2, cz = (M.z0 + M.z1) / 2;
    // main house body, plinth, floor cornice, eaves cornice
    plain.push(cbox(M.x1 - M.x0, mh, M.z1 - M.z0, cx, y + mh / 2, cz, WALL));
    plain.push(cbox(M.x1 - M.x0 + 0.5, 1.1, M.z1 - M.z0 + 0.5, cx, y + 0.55, cz, STONE));
    plain.push(cbox(M.x1 - M.x0 + 0.6, 0.35, M.z1 - M.z0 + 0.6, cx, y + 6.6, cz, TRIM));
    plain.push(cbox(M.x1 - M.x0 + 1.0, 0.6, M.z1 - M.z0 + 1.0, cx, y + mh - 0.1, cz, TRIM));
    plain.push(hipRoof(M.x0, M.x1, M.z0, M.z1, y + mh + 0.2, 7, ROOF, 1.2));
    // corner quoins
    for (const [qx, qz] of [[M.x0, M.z0], [M.x1, M.z0], [M.x0, M.z1], [M.x1, M.z1]]) for (let k = 0; k < 6; k++) plain.push(cbox(1.1 + (k % 2) * 0.5, 0.9, 1.1 + ((k + 1) % 2) * 0.5, qx, y + 1.6 + k * 1.9, qz, TRIM));
    // central gable on the front with a gold oculus
    plain.push(gable(cx - 13, cx + 13, M.z1 - 3, M.z1 + 0.7, y + mh + 0.2, 5.2, WALL, ROOF));
    plain.push(cbox(26.6, 0.4, 0.5, cx, y + mh + 0.35, M.z1 + 0.6, TRIM));
    plain.push(ccyl(1.0, 1.0, 0.2, 16, cx, y + mh + 2.3, M.z1 + 0.75, GOLD, Math.PI / 2));
    glow.push(ccyl(0.7, 0.7, 0.1, 16, cx, y + mh + 2.3, M.z1 + 0.86, '#ffd890', Math.PI / 2));
    // wings
    for (const [wx0, wx1] of [[M.x0 - 14, M.x0], [M.x1, M.x1 + 14]]) {
      const wz0 = M.z0 + 6, wz1 = M.z1 - 8, wcx = (wx0 + wx1) / 2, wcz = (wz0 + wz1) / 2;
      plain.push(cbox(wx1 - wx0, wingH, wz1 - wz0, wcx, y + wingH / 2, wcz, WALL));
      plain.push(cbox(wx1 - wx0 + 0.5, 1.0, wz1 - wz0 + 0.5, wcx, y + 0.5, wcz, STONE));
      plain.push(cbox(wx1 - wx0 + 0.9, 0.5, wz1 - wz0 + 0.9, wcx, y + wingH - 0.1, wcz, TRIM));
      plain.push(hipRoof(wx0, wx1, wz0, wz1, y + wingH + 0.15, 4.2, ROOF, 1.0));
      addBox(wx0, wx1, wz0, wz1, y + wingH + 1, { y0: y - 1 });
      // balcony on the wing front (stone slab, white balustrade)
      plain.push(cbox(wx1 - wx0 - 2, 0.3, 2, wcx, y + 4.6, wz1 + 1, TRIM));
      for (let x = wx0 + 1.5; x <= wx1 - 1.5; x += 0.55) plain.push(ccyl(0.07, 0.11, 0.85, 6, x, y + 5.2, wz1 + 1.85, FRAME));
      plain.push(cbox(wx1 - wx0 - 2, 0.14, 0.22, wcx, y + 5.68, wz1 + 1.85, FRAME));
      for (let x = wx0 + 2.5; x < wx1 - 1; x += 3.5) for (const fy of [2.4, 6.6]) win(x, y + fy, wz1, 1.5, 2.1, 1);
      for (let x = wx0 + 2.5; x < wx1 - 1; x += 3.5) for (const fy of [2.4, 6.6]) win(x, y + fy, wz0, 1.5, 2.1, -1);
      const sx = wx0 < M.x0 ? wx0 : wx1, sd = wx0 < M.x0 ? -1 : 1;
      for (let z = wz0 + 3; z < wz1 - 1; z += 4) for (const fy of [2.4, 6.6]) win(sx, y + fy, z, 1.5, 2.1, sd, 'x');
    }
    // front: colonnade, windows between the columns
    for (let k = 0; k < 7; k++) {
      const x = M.x0 + 4 + k * ((M.x1 - M.x0 - 8) / 6);
      if (Math.abs(x - ISL.lift.x) < 2.5) continue; // keep the lift door free
      plain.push(ccyl(0.55, 0.65, 9, 14, x, y + 4.5, M.z1 + 2.4, '#ffffff'), cbox(1.5, 0.45, 1.5, x, y + 9.2, M.z1 + 2.4, GOLD), cbox(1.5, 0.4, 1.5, x, y + 0.2, M.z1 + 2.4, TRIM));
      addCirc(x, M.z1 + 2.4, 0.7, y + 9);
      for (const fy of [3, 8, 11.3]) {
        if (fy === 3 && Math.abs(x - ISL.lift.x) < 3) continue;
        win(x, y + fy, M.z1, 1.8, fy > 10 ? 1.3 : 2.2, 1);
      }
    }
    // back + side windows
    for (const fy of [3, 8, 11.3]) for (let x = M.x0 + 4; x < M.x1 - 2; x += 6) win(x, y + fy, M.z0, 1.6, fy > 10 ? 1.2 : 2.0, -1);
    for (const [sx, sd] of [[M.x0, -1], [M.x1, 1]]) for (let z = M.z0 + 4; z < M.z1 - 2; z += 6) for (const fy of [8, 11.3]) win(sx, y + fy, z, 1.6, fy > 10 ? 1.2 : 2.0, sd, 'x');
    // balcony over the colonnade with a white balustrade
    plain.push(cbox(M.x1 - M.x0 + 2, 0.6, 5, cx, y + 9.4, M.z1 + 2.4, TRIM));
    for (let x = M.x0; x <= M.x1; x += 0.55) plain.push(ccyl(0.07, 0.11, 0.85, 6, x, y + 10.15, M.z1 + 4.8, FRAME));
    plain.push(cbox(M.x1 - M.x0 + 2, 0.14, 0.24, cx, y + 10.65, M.z1 + 4.8, FRAME));
    // chimneys through the roof + red beacon on the ridge
    for (const cx2 of [M.x0 + 9, M.x1 - 9]) plain.push(cbox(1.7, 6.5, 1.7, cx2, y + mh + 3.6, M.z0 + 8, '#b9a98e'), cbox(2.1, 0.35, 2.1, cx2, y + mh + 6.9, M.z0 + 8, '#6b5d4a'));
    glow.push(cbox(0.4, 0.4, 0.4, cx, y + mh + 7.6, cz, '#ff2020'));
    const winMesh = new THREE.Mesh(merge(wins), winMat);
    scene.add(winMesh);
    // grand stairs (low steps, walkable)
    for (let k = 0; k < 3; k++) plain.push(cbox(26 - k * 3, 0.2 * (k + 1), 2.2, (M.x0 + M.x1) / 2, y + 0.1 * (k + 1), M.z1 + 5.6 - k * 1.1, '#e8e0cf'));
    plain.push(cbox(M.x1 - M.x0 + 2, 0.3, 6, (M.x0 + M.x1) / 2, y + 0.15, M.z1 + 2.6, '#d8cfbb'));
    addBox(M.x0, M.x1, M.z0, M.z1, y + mh + 4);
    // lift door (golden) on the front
    const L = ISL.lift;
    plain.push(cbox(3.2, 3.6, 0.2, L.x, y + 1.8, M.z1 + 0.12, '#c9a227'));
    plain.push(cbox(0.08, 3.6, 0.22, L.x, y + 1.8, M.z1 + 0.14, '#3a2a00'));
    const ls = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), new THREE.MeshBasicMaterial({ map: neonSign('▼ AUFZUG', '#ffd700', { size: 90 }), toneMapped: false }));
    ls.position.set(L.x, y + 4.2, M.z1 + 0.25);
    scene.add(ls);
    world.signMats.push(ls.material);
    // gazebo in the back garden
    {
      const gx = 40, gz = -1378;
      plain.push(ccyl(3.6, 3.6, 0.3, 8, gx, y + 0.15, gz, '#e8e0cf'));
      for (let a = 0; a < 8; a++) { const x = gx + Math.cos(a * Math.PI / 4) * 3.2, z = gz + Math.sin(a * Math.PI / 4) * 3.2; plain.push(ccyl(0.15, 0.15, 3, 6, x, y + 1.8, z, '#ffffff')); addCirc(x, z, 0.2, y + 3, y - 1); }
      plain.push(ccyl(0.3, 4.2, 1.6, 8, gx, y + 4.1, gz, '#b03a2e'));
    }
    out.estateY = y;
    out.sentryPosts = [
      [[-30, -1305], [-30, -1330]], [[112, -1310], [112, -1345]], [[18, -1290], [28, -1290]], [[52, -1290], [62, -1290]],
      [[-30, -1345], [-30, -1392]], [[112, -1355], [112, -1392]], [[-10, -1394], [30, -1394]], [[54, -1394], [96, -1394]],
      [[-12, -1318], [-12, -1362]], [[96, -1318], [96, -1362]], [[20, -1372], [30, -1372]], [[-20, -1340], [-20, -1340]],
      [[100, -1325], [100, -1325]], [[30, -1278], [50, -1278]], [[70, -1316], [70, -1316]], [[10, -1316], [10, -1316]],
      [[-34, -1372], [-14, -1372]], [[78, -1282], [104, -1282]],
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
