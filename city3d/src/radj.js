// Radj-Insel: airstrip, serpentine road through a dense forest, walled estate with mansion,
// secret cellar with the golden Bubensahne, helipad. Built once at start (visible from the plane).
import * as THREE from 'three';
import { RADJ, RADJ_CELLAR, RADJ_STRIP, RADJ_ESTATE, radjGround, radjE } from './geo.js';
import { addBox, addCirc, world } from './world.js';
import { cbox, ccyl, merge, neonSign, srand, srange } from './util.js';

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
  const road = ribbon(ISL.road, 8, '#a39579');
  scene.add(road.mesh);
  const hel = ribbon(ISL.helRoad, 7, '#a39579');
  scene.add(hel.mesh);
  out.roadSamples = road.samples;
  {
    const S = road.samples;
    const side = (i, off) => {
      const p = S[i], q = S[Math.min(S.length - 1, i + 1)], o = S[Math.max(0, i - 1)];
      const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
      return { x: p.x - dz / L * off, z: p.z + dx / L * off, h: Math.atan2(dx, dz) };
    };
    // wheel tracks (darker) + kerb stones on both sides
    for (const off of [-1.7, 1.7]) {
      const tr = ribbon(S.filter((_, i) => i % 2 === 0).map((p, i, a) => { const k = i * 2; const sd = side(Math.min(k, S.length - 1), off); return [sd.x, sd.z]; }), 0.9, '#8a7d63', 0.085);
      scene.add(tr.mesh);
    }
    for (let i = 0; i < S.length; i += 1) for (const off of [-4.2, 4.2]) {
      const sd = side(i, off);
      plain.push(cbox(0.35, 0.22, 1.5, sd.x, H(sd.x, sd.z) + 0.1, sd.z, i % 2 ? '#b9b3a6' : '#cfc9bb', sd.h));
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
  {
    const trunks = [], crowns = [];
    const E = ISL.estate;
    for (let k = 0; k < 2600; k++) {
      const x = srange(-230, 230), z = srange(-1430, -1030);
      const e = radjE(x, z);
      if (e > 0.78) continue;
      if (x > ISL.strip.x0 - 10 && x < ISL.strip.x1 + 14 && z > ISL.strip.z0 - 12 && z < ISL.strip.z1 + 22) continue;
      if (x > E.x0 - 6 && x < E.x1 + 6 && z > E.z0 - 6 && z < E.z1 + 9) continue;
      if (nearPts(road.samples, x, z, 7) || nearPts(hel.samples, x, z, 6.5)) continue;
      if (out.creek && nearPts(out.creek, x, z, 4)) continue;
      if (Math.hypot(x - out.clearing.x, z - out.clearing.z) < out.clearing.r) continue;
      if (Math.hypot(x - ISL.helipad.x, z - ISL.helipad.z) < 20) continue;
      const dense = nearPts(road.samples, x, z, 26);
      if (!dense && srand() < 0.55) continue;
      const y = H(x, z), s = srange(0.8, 1.35);
      trunks.push(ccyl(0.25 * s, 0.35 * s, 3 * s, 6, x, y + 1.5 * s, z, '#4a3523'));
      const c = new THREE.ConeGeometry(2.2 * s, 6 * s, 7);
      c.translate(x, y + 5.5 * s, z);
      const col = new THREE.Color(srand() < 0.5 ? '#1f4d26' : '#2a5e2c');
      const n = c.attributes.position.count, ca = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
      c.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      c.deleteAttribute('uv');
      crowns.push(c);
      addCirc(x, z, 0.9 * s, y + 6, y - 1);
    }
    const tm = new THREE.Mesh(merge(trunks), vmat);
    const cm = new THREE.Mesh(merge(crowns), vmat);
    tm.castShadow = cm.castShadow = true;
    scene.add(tm, cm);
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
    // the mansion: main house + two wings, balconies, lit windows, chimneys, roof terrace, grand stairs
    const mh = 13;
    const wingH = 9;
    plain.push(cbox(M.x1 - M.x0, mh, M.z1 - M.z0, (M.x0 + M.x1) / 2, y + mh / 2, (M.z0 + M.z1) / 2, '#fbf6ec'));
    plain.push(cbox(M.x1 - M.x0 + 1.2, 0.8, M.z1 - M.z0 + 1.2, (M.x0 + M.x1) / 2, y + mh + 0.4, (M.z0 + M.z1) / 2, '#3a3a3a'));
    plain.push(cbox(M.x1 - M.x0 + 0.6, 0.35, M.z1 - M.z0 + 0.6, (M.x0 + M.x1) / 2, y + 6.6, (M.z0 + M.z1) / 2, '#e2d8c4'));
    for (const [wx0, wx1] of [[M.x0 - 14, M.x0], [M.x1, M.x1 + 14]]) {
      const wz0 = M.z0 + 6, wz1 = M.z1 - 8;
      plain.push(cbox(wx1 - wx0, wingH, wz1 - wz0, (wx0 + wx1) / 2, y + wingH / 2, (wz0 + wz1) / 2, '#f6efe2'));
      plain.push(cbox(wx1 - wx0 + 0.8, 0.6, wz1 - wz0 + 0.8, (wx0 + wx1) / 2, y + wingH + 0.3, (wz0 + wz1) / 2, '#3a3a3a'));
      addBox(wx0, wx1, wz0, wz1, y + wingH + 1, { y0: y - 1 });
      // balcony on the wing front
      plain.push(cbox(wx1 - wx0 - 2, 0.25, 2, (wx0 + wx1) / 2, y + 4.6, wz1 + 1, '#e8e0cf'));
      for (let x = wx0 + 1.5; x <= wx1 - 1.5; x += 0.6) plain.push(cbox(0.08, 0.9, 0.08, x, y + 5.2, wz1 + 1.9, '#ffffff'));
      plain.push(cbox(wx1 - wx0 - 2, 0.1, 0.12, (wx0 + wx1) / 2, y + 5.65, wz1 + 1.9, '#ffffff'));
      for (let x = wx0 + 2.5; x < wx1 - 1; x += 3.5) for (const fy of [2.4, 6.6]) { glow.push(cbox(1.6, 2.0, 0.08, x, y + fy, wz1 + 0.05, '#ffcf7a')); plain.push(cbox(2.0, 2.4, 0.06, x, y + fy, wz1 + 0.02, '#c9a227')); }
    }
    for (let k = 0; k < 7; k++) {
      const x = M.x0 + 4 + k * ((M.x1 - M.x0 - 8) / 6);
      if (Math.abs(x - ISL.lift.x) < 2.5) continue; // keep the lift door free
      plain.push(ccyl(0.6, 0.7, 9, 12, x, y + 4.5, M.z1 + 2.4, '#ffffff'), cbox(1.6, 0.4, 1.6, x, y + 9.2, M.z1 + 2.4, '#c9a227'));
      addCirc(x, M.z1 + 2.4, 0.7, y + 9);
      for (const fy of [3, 8, 11.3]) {
        if (fy === 3 && Math.abs(x - ISL.lift.x) < 3) continue;
        glow.push(cbox(1.8, fy > 10 ? 1.3 : 2.2, 0.08, x, y + fy, M.z1 + 0.05, '#ffcf7a'));
        plain.push(cbox(2.2, fy > 10 ? 1.6 : 2.6, 0.06, x, y + fy, M.z1 + 0.02, '#c9a227'));
      }
    }
    for (const fy of [3, 8, 11.3]) for (let x = M.x0 + 4; x < M.x1 - 2; x += 6) glow.push(cbox(1.6, fy > 10 ? 1.2 : 2.0, 0.08, x, y + fy, M.z0 - 0.05, '#ffcf7a'));
    plain.push(cbox(M.x1 - M.x0 + 2, 0.6, 5, (M.x0 + M.x1) / 2, y + 9.4, M.z1 + 2.4, '#e8e0cf'));
    for (let x = M.x0; x <= M.x1; x += 0.6) plain.push(cbox(0.08, 0.9, 0.08, x, y + 10.15, M.z1 + 4.8, '#ffffff'));
    plain.push(cbox(M.x1 - M.x0 + 2, 0.1, 0.12, (M.x0 + M.x1) / 2, y + 10.6, M.z1 + 4.8, '#ffffff'));
    // roof terrace with railings, chimneys, a tiny helicopter-style beacon
    plain.push(cbox(20, 4, M.z1 - M.z0 - 10, (M.x0 + M.x1) / 2, y + mh + 2.4, (M.z0 + M.z1) / 2, '#fbf6ec'));
    for (const cx2 of [M.x0 + 5, M.x1 - 5]) plain.push(cbox(1.6, 3.4, 1.6, cx2, y + mh + 2.1, M.z0 + 6, '#b9a98e'), cbox(2.0, 0.3, 2.0, cx2, y + mh + 3.9, M.z0 + 6, '#3a3a3a'));
    for (let x = M.x0 + 1; x <= M.x1 - 1; x += 0.8) for (const zz of [M.z0 + 1, M.z1 - 1]) plain.push(cbox(0.08, 0.9, 0.08, x, y + mh + 1.25, zz, '#ffffff'));
    glow.push(cbox(0.4, 0.4, 0.4, (M.x0 + M.x1) / 2, y + mh + 4.8, (M.z0 + M.z1) / 2, '#ff2020'));
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
