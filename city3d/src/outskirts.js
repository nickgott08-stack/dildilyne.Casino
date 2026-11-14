import * as THREE from 'three';
import './dildi_cars.js';
const DC = globalThis.DildiCars;
import { cbox, ccyl, merge, canvasTex, neonSign, srand, srange, spick, colorize, place, lerp, clamp, tiledMeshes } from './util.js';
import { world, roadC, RW, BOUND, H } from './world.js';
import { ROADS, POI, RUNWAY, LAKE, ISLAND, COAST_Z, BRIDGE_S, WALL_OUT, WORLD, DESERTS, terrainH, rawH, deckAt, inIsland, onBridgeS, slopeAt  , radjGround } from './geo.js';

export { LAKE, ISLAND };
export const DOCKS = { x0: ISLAND.x0, x1: -10, z0: ISLAND.z0, z1: ISLAND.z1, name: 'Docks' };
export const AIRPORT = { x0: 10, x1: ISLAND.x1, z0: ISLAND.z0, z1: ISLAND.z1, name: 'Flughafen' };

function noiseTex(base, v, size = 256) {
  return canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * v;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  });
}

// ribbon draped over the (flattened) terrain: left, centre and right vertex per sample
function drapedRibbon(S, width, lift = 0.1) {
  const pos = [], uv = [], idx = [], nor = [];
  let s = 0;
  for (let i = 0; i < S.length; i++) {
    const p = S[i];
    if (i) s += Math.hypot(p.x - S[i - 1].x, p.z - S[i - 1].z);
    const rx = -Math.cos(p.h), rz = Math.sin(p.h);
    for (const k of [1, 0, -1]) {
      const x = p.x + rx * k * width / 2, z = p.z + rz * k * width / 2;
      pos.push(x, terrainH(x, z) + lift, z);
      nor.push(0, 1, 0);
      uv.push(s / 10, (1 - k) / 2);
    }
    if (i < S.length - 1) {
      const a = i * 3, b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// ribbon (top surface) for a sampled road
function ribbonGeo(S, width, lift = 0.06) {
  const pos = [], uv = [], idx = [], nor = [];
  let s = 0;
  for (let i = 0; i < S.length; i++) {
    const p = S[i];
    if (i) s += Math.hypot(p.x - S[i - 1].x, p.z - S[i - 1].z);
    const rx = -Math.cos(p.h), rz = Math.sin(p.h);
    pos.push(p.x + rx * width / 2, p.y + lift, p.z + rz * width / 2, p.x - rx * width / 2, p.y + lift, p.z - rz * width / 2);
    nor.push(0, 1, 0, 0, 1, 0);
    uv.push(s / 10, 0, s / 10, 1);
    if (i < S.length - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// vertical strip along one side of a road (barriers, deck skirts)
function sideStrip(S, off, y0, y1, color) {
  const pos = [], idx = [];
  for (let i = 0; i < S.length; i++) {
    const p = S[i];
    const rx = -Math.cos(p.h), rz = Math.sin(p.h);
    const x = p.x + rx * off, z = p.z + rz * off;
    pos.push(x, p.y + y0, z, x, p.y + y1, z);
    if (i < S.length - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  colorize(g, color);
  return g;
}

export function buildOutskirts(scene, K) {
  const { plain, metal, mark, addBox, addCirc, treePos, lampPos, railSeg } = K;
  const dsh = K.dash;
  world.outRoads = ROADS.filter((r) => r.samples);
  world.roadSamples = [];
  world.roadCells = new Set();
  for (const r of ROADS) for (const s of r.samples) {
    world.roadSamples.push(s);
    const rad = r.w / 2 + 1;
    for (let cx = Math.floor((s.x - rad) / 4); cx <= Math.floor((s.x + rad) / 4); cx++)
      for (let cz = Math.floor((s.z - rad) / 4); cz <= Math.floor((s.z + rad) / 4); cz++) world.roadCells.add(cx * 100000 + cz);
  }
  const signs = (text, color, x, y, z, ry, w = 12, h = 2.4, opts = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neonSign(text, color, { size: opts.size || 130, w: 1024, h: 220, bg: opts.bg, border: opts.border }), toneMapped: false }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    plain.push(cbox(w, h, 0.12, x - Math.sin(ry) * 0.08, y, z - Math.cos(ry) * 0.08, '#1a1a1e', ry));
    world.signMats.push(m.material);
  };
  const T = (x, z) => terrainH(x, z);

  // ================= TERRAIN MESH =================
  {
    const step = 5;
    const x0 = WORLD.x0, x1 = WORLD.x1, z0 = COAST_Z, z1 = WORLD.z1;
    const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
    const pos = new Float32Array(nx * nz * 3);
    const col = new Float32Array(nx * nz * 3);
    const c = new THREE.Color();
    const sand = new THREE.Color('#d9bc80'), sand2 = new THREE.Color('#c9a466'), rock = new THREE.Color('#9c7a55'), rock2 = new THREE.Color('#7f6448'),
      grass = new THREE.Color('#6f9a48'), grass2 = new THREE.Color('#58803a'), snow = new THREE.Color('#d8d2c8');
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * step, z = z0 + j * step;
        const inside = Math.abs(x) < WALL_OUT - 1 && Math.abs(z) < WALL_OUT - 1;
        let y = inside ? -0.4 : T(x, z);
        const k = (j * nx + i) * 3;
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
        const sl = inside ? 0 : slopeAt(x, z);
        const n = 0.5 + 0.5 * Math.sin(x * 0.11 + z * 0.07) * Math.cos(x * 0.05 - z * 0.13);
        if (z >= -WALL_OUT) {
          c.copy(sand).lerp(sand2, n * 0.6);
          if (sl > 0.42 || y > 26) c.lerp(rock, clamp((sl - 0.42) * 3 + (y - 26) / 14, 0, 1));
          if (y > 60) c.lerp(rock2, 0.5);
          if (y > 85) c.lerp(snow, clamp((y - 85) / 20, 0, 0.8));
        } else {
          c.copy(grass).lerp(grass2, n);
          if (sl > 0.45 || y > 18) c.lerp(rock, clamp((sl - 0.45) * 3 + (y - 18) / 18, 0, 1));
        }
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    // analytic-ish normals from the height grid (no seams between chunks)
    const nor = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const hL = pos[(j * nx + Math.max(0, i - 1)) * 3 + 1], hR = pos[(j * nx + Math.min(nx - 1, i + 1)) * 3 + 1];
        const hD = pos[(Math.max(0, j - 1) * nx + i) * 3 + 1], hU = pos[(Math.min(nz - 1, j + 1) * nx + i) * 3 + 1];
        const v = new THREE.Vector3(hL - hR, 2 * step, hD - hU).normalize();
        const k = (j * nx + i) * 3;
        nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z;
      }
    // split into chunks so the camera only draws what it sees
    const CS = 24;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    world.terrainChunks = [];
    for (let cj = 0; cj < nz - 1; cj += CS)
      for (let ci = 0; ci < nx - 1; ci += CS) {
        const w = Math.min(CS, nx - 1 - ci), h = Math.min(CS, nz - 1 - cj);
        const P2 = [], N2 = [], C2 = [], I2 = [];
        for (let j = 0; j <= h; j++)
          for (let i = 0; i <= w; i++) {
            const k = ((cj + j) * nx + ci + i) * 3;
            P2.push(pos[k], pos[k + 1], pos[k + 2]);
            N2.push(nor[k], nor[k + 1], nor[k + 2]);
            C2.push(col[k], col[k + 1], col[k + 2]);
          }
        for (let j = 0; j < h; j++)
          for (let i = 0; i < w; i++) {
            const xa = x0 + (ci + i) * step, za = z0 + (cj + j) * step;
            if (Math.abs(xa) < WALL_OUT - 8 && Math.abs(xa + step) < WALL_OUT - 8 && Math.abs(za) < WALL_OUT - 8 && Math.abs(za + step) < WALL_OUT - 8) continue;
            const a2 = j * (w + 1) + i, b2 = a2 + 1, c2 = a2 + w + 1, d2 = c2 + 1;
            I2.push(a2, c2, b2, b2, c2, d2);
          }
        if (!I2.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N2, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3));
        g.setIndex(I2);
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = true;
        scene.add(m);
        world.terrainChunks.push(m);
      }
    const m = world.terrainChunks[0];
    world.terrainMesh = m;
  }

  // ================= ROADS =================
  const dirtTex = noiseTex('#a88d62', 30, 128);
  const asphaltGeos = [], dirtGeos = [], deckBody = [];
  const deckRoads = ROADS.filter((r) => r.kind === 'deck');
  const coveredByOtherDeck = (x, z, y, own) => {
    for (const r of deckRoads) {
      if (r === own) continue;
      for (const s of r.samples) if (Math.abs(s.y - y) < 1.5 && Math.hypot(s.x - x, s.z - z) < r.w / 2 + 1.5) return true;
    }
    return false;
  };
  const nearGroundRoad = (x, z, rad) => {
    for (const r of ROADS) {
      if (r.kind === 'deck') continue;
      for (const s of r.samples) if (Math.hypot(s.x - x, s.z - z) < r.w / 2 + rad) return true;
    }
    return false;
  };
  for (const r of ROADS) {
    const S = r.samples;
    const flatGround = S[0].z < -WALL_OUT; // Kreuz + island are flat, no draping needed
    if (r.kind === 'dirt') { dirtGeos.push(drapedRibbon(S, r.w, 0.12)); continue; }
    asphaltGeos.push(r.kind === 'deck' ? ribbonGeo(S.map((p) => ({ ...p, y: Math.max(p.y, 0.05) })), r.w, 0.06) : flatGround ? ribbonGeo(S, r.w, 0.06) : drapedRibbon(S, r.w, 0.1));
    // centre dashes
    // each dash spans exactly from one road sample to the next, with the right height at both ends,
    // so it lies on the road on slopes, ramps and curves (instead of a flat plank floating in the air)
    const dy = (p) => (r.kind === 'deck' || flatGround ? p.y : terrainH(p.x, p.z)) + (r.kind === 'deck' ? 0.07 : 0.14);
    for (let i = 2; i < S.length - 3; i += 2) {
      const a = S[i], b = S[i + 1], hw = 0.11;
      const pos = [];
      for (const p of [a, b]) {
        const rx = -Math.cos(p.h) * hw, rz = Math.sin(p.h) * hw, y = dy(p);
        pos.push(p.x + rx, y, p.z + rz, p.x - rx, y, p.z - rz);
      }
      const d = new THREE.BufferGeometry();
      d.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      d.setIndex([0, 2, 1, 1, 2, 3]);
      d.computeVertexNormals();
      if (d.attributes.normal.getY(0) < 0) d.setIndex([0, 1, 2, 1, 3, 2]), d.computeVertexNormals();
      colorize(d, r.w >= 12 ? '#f2c94c' : '#e8e8e2');
      mark.push(d);
    }
    if (r.lamps) for (let i = 6; i < S.length; i += 9) {
      const p = S[i];
      lampPos.push([p.x - Math.cos(p.h) * (r.w / 2 + 0.8), p.z + Math.sin(p.h) * (r.w / 2 + 0.8), p.h - Math.PI / 2, r.kind === 'deck' ? p.y : T(p.x - Math.cos(p.h) * (r.w / 2 + 0.8), p.z + Math.sin(p.h) * (r.w / 2 + 0.8))]);
    }
    if (r.kind === 'deck') {
      // concrete body under the deck + jersey barriers + pillars
      deckBody.push(sideStrip(S, r.w / 2 + 0.4, -1.1, 0.03, '#8d8f93'), sideStrip(S, -r.w / 2 - 0.4, -1.1, 0.03, '#8d8f93'));
      const under = ribbonGeo(S.map((p) => ({ ...p, y: p.y - 1.1 })), r.w + 0.8, 0);
      const ix = under.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      colorize(under, '#6f7175');
      under.deleteAttribute('uv');
      deckBody.push(under);
      for (const side of [-1, 1]) {
        // barriers only where the deck is raised and no other deck joins
        let run = [];
        const flush = () => { if (run.length > 1) deckBody.push(sideStrip(run, side * (r.w / 2 + 0.25), 0, 0.95, '#c9c6bd'), sideStrip(run, side * (r.w / 2 + 0.05), 0, 0.95, '#b5b2a9')); run = []; };
        for (let i = 0; i < S.length; i++) {
          const p = S[i];
          const ex = p.x - Math.cos(p.h) * side * (r.w / 2 + 0.2), ez = p.z + Math.sin(p.h) * side * (r.w / 2 + 0.2);
          const ok = p.y > 1.0 && !coveredByOtherDeck(ex, ez, p.y, r);
          if (ok) {
            run.push(p);
            if (i % 1 === 0) addCirc(ex, ez, 0.5, p.y + 1.3, p.y - 0.6);
          } else flush();
        }
        flush();
      }
      for (let i = 4; i < S.length; i += 5) {
        const p = S[i];
        if (p.y < 3 || nearGroundRoad(p.x, p.z, 3)) continue;
        const ph = p.y - 1.1;
        plain.push(cbox(1.6, ph, 2.4, p.x, ph / 2, p.z, '#9a9ca0', p.h));
        addCirc(p.x, p.z, 1.3, ph - 0.2);
      }
    }
  }
  // roads etc. in map tiles so far / hidden parts are skipped (see distance culling in main.js)
  world.cullList = world.cullList || [];
  const rcv = (m) => { m.receiveShadow = true; };
  world.cullList.push(...tiledMeshes(scene, asphaltGeos, world.asphaltMat, 250, true, rcv));
  world.cullList.push(...tiledMeshes(scene, dirtGeos, new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 }), 250, true, rcv));
  world.cullList.push(...tiledMeshes(scene, deckBody, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 250, false, (m) => { m.castShadow = true; m.receiveShadow = true; }));
  // sign on the flyover
  signs('DILDI-KREUZ', '#ffffff', 0, 15, -324, Math.PI, 16, 2.4, { bg: '#1f5fa8', size: 120 });
  for (const sx of [-8.5, 8.5]) metal.push(cbox(0.35, 6.5, 0.35, sx, 12.2, -324, '#555'));
  metal.push(cbox(18, 0.4, 0.4, 0, 15.6, -324, '#555'));
  signs('↓ HAFEN · DOCKS · FLUGHAFEN', '#ffffff', 0, 5, -275, Math.PI, 14, 1.8, { bg: '#1f7a3a', size: 90 });
  for (const sx of [-7.5, 7.5]) metal.push(cbox(0.3, 6, 0.3, sx, 3, -275, '#555'));

  // ================= SOUTH: coast, bridge, island =================
  {
    // quay wall along the coast with a gap for the bridge
    plain.push(cbox(WORLD.x1 - WORLD.x0, 6, 2, 0, -3, COAST_Z - 1, '#7d7a72'));
    for (const [a, b] of [[WORLD.x0, BRIDGE_S.x0], [BRIDGE_S.x1, WORLD.x1]]) {
      railSeg(a, COAST_Z + 0.4, b, COAST_Z + 0.4);
      addBox(a, b, COAST_Z, COAST_Z + 0.8, 1.3);
    }
    // bridge
    const bz0 = BRIDGE_S.z0, bz1 = BRIDGE_S.z1;
    plain.push(cbox(BRIDGE_S.x1 - BRIDGE_S.x0 + 1, 1.4, bz1 - bz0, 0, -0.7, (bz0 + bz1) / 2, '#5d6066'));
    for (let k = 1; k < 4; k++) plain.push(cbox(4, 10, 4, 0, -5.5, bz0 + (k * (bz1 - bz0)) / 4, '#6a6d72'));
    for (const sx of [-1, 1]) {
      railSeg(sx * (RW + 1.4), bz0, sx * (RW + 1.4), bz1);
      addBox(sx * (RW + 1.4) - 0.4, sx * (RW + 1.4) + 0.4, bz0, bz1, 1.3);
      // pylons + cables
      metal.push(cbox(1.2, 28, 1.2, sx * (RW + 2.6), 13, (bz0 + bz1) / 2, '#c8cdd3'));
      addBox(sx * (RW + 2.6) - 0.6, sx * (RW + 2.6) + 0.6, (bz0 + bz1) / 2 - 0.6, (bz0 + bz1) / 2 + 0.6, 28);
      for (let k = 1; k <= 5; k++) for (const sd of [-1, 1]) {
        const dz = (k * (bz1 - bz0) * 0.45) / 5;
        const ang = Math.atan2(sd * dz, 26 - k * 4);
        metal.push(cbox(0.06, Math.hypot(dz, 26 - k * 4), 0.06, sx * (RW + 2.6), 13 - k * 2 + 0.5, (bz0 + bz1) / 2 + sd * dz / 2, '#aab2bb', 0, -ang, 0));
      }
    }
    metal.push(cbox(RW * 2 + 6.4, 1, 1.2, 0, 26.5, (bz0 + bz1) / 2, '#c8cdd3'));
    // island ground
    const A = ISLAND;
    plain.push(cbox(A.x1 - A.x0, 6, A.z1 - A.z0, (A.x0 + A.x1) / 2, -3.02, (A.z0 + A.z1) / 2, '#6c6a66'));
    const conc = noiseTex('#7d7b76', 22);
    const gD = new THREE.PlaneGeometry(DOCKS.x1 - DOCKS.x0, A.z1 - A.z0);
    gD.rotateX(-Math.PI / 2);
    gD.translate((DOCKS.x0 + DOCKS.x1) / 2, 0.005, (A.z0 + A.z1) / 2);
    K.worldUV(gD, 8);
    const mD = new THREE.Mesh(gD, new THREE.MeshStandardMaterial({ map: conc, roughness: 0.95 }));
    mD.receiveShadow = true;
    scene.add(mD);
    const gA = new THREE.PlaneGeometry(AIRPORT.x1 - AIRPORT.x0 + 20, A.z1 - A.z0);
    gA.rotateX(-Math.PI / 2);
    gA.translate((AIRPORT.x0 - 20 + AIRPORT.x1) / 2, 0.004, (A.z0 + A.z1) / 2);
    K.worldUV(gA, 8);
    const mA = new THREE.Mesh(gA, new THREE.MeshStandardMaterial({ map: noiseTex('#6f9a48', 26), roughness: 1 }));
    mA.receiveShadow = true;
    scene.add(mA);
    // island edge: low curb + colliders, gap for the bridge
    const edge = (ax, az, bx, bz) => {
      const alongX = az === bz;
      const len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
      plain.push(cbox(alongX ? len : 0.8, 0.7, alongX ? 0.8 : len, (ax + bx) / 2, 0.35, (az + bz) / 2, '#8d8a83'));
      if (alongX) addBox(Math.min(ax, bx), Math.max(ax, bx), az - 0.5, az + 0.5, 1.3);
      else addBox(ax - 0.5, ax + 0.5, Math.min(az, bz), Math.max(az, bz), 1.3);
    };
    edge(A.x0, A.z1 - 0.4, BRIDGE_S.x0, A.z1 - 0.4);
    edge(BRIDGE_S.x1, A.z1 - 0.4, A.x1, A.z1 - 0.4);
    edge(A.x0, A.z0 + 0.4, A.x1, A.z0 + 0.4);
    edge(A.x0 + 0.4, A.z0, A.x0 + 0.4, A.z1);
    edge(A.x1 - 0.4, A.z0, A.x1 - 0.4, A.z1);

    // ----- DOCKS (west half) -----
    const cc = ['#c0392b', '#2471a3', '#1e8449', '#d68910', '#7d3c98', '#5d6d7e', '#e67e22'];
    const wx0 = -222, wx1 = -160, wz0 = -692, wz1 = -652; // Radj warehouse
    plain.push(cbox(wx1 - wx0, 14, wz1 - wz0, (wx0 + wx1) / 2, 7, (wz0 + wz1) / 2, '#8a3b2b'));
    addBox(wx0, wx1, wz0, wz1, 14);
    for (let k = 0; k < 4; k++) plain.push(cbox(wx1 - wx0 + 0.5, 1.2, 8, (wx0 + wx1) / 2, 14.5, wz0 + 5 + k * 10, '#5a5c60'));
    for (const x of [wx0 + 12, wx0 + 31, wx0 + 50]) plain.push(cbox(9, 6, 0.3, x, 3, wz1 + 0.1, '#2a2e33'));
    for (let k = 0; k < 7; k++) plain.push(cbox(4, 2, 0.2, wx0 + 5 + k * 8.6, 9.5, wz1 + 0.1, '#9fb6c8'));
    signs('RADJ LOGISTIK', '#ff2a2a', (wx0 + wx1) / 2, 12.2, wz1 + 0.3, 0, 24, 3.2);
    // (gate booth removed: it stood on the Dockring)
    world.landmarks.push({ name: 'Lagerhalle (Radj)', x: (wx0 + wx1) / 2, z: (wz0 + wz1) / 2, icon: '🏭', color: '#ff2a2a' });
    world.radjWarehouse = { x: (wx0 + wx1) / 2, z: wz1 + 8 };
    world.parkSpots.push({ x: wx1 + 6, z: wz1 + 22, h: Math.PI / 2, model: 'van' });
    const stack = (x, z, rows, cols) => {
      for (let r = 0; r < rows; r++)
        for (let c2 = 0; c2 < cols; c2++) {
          const h = 1 + Math.floor(srand() * 3);
          const cx = x + c2 * 2.7, cz = z + r * 6.5;
          for (let k = 0; k < h; k++) plain.push(DC ? DC.dildiCityDocks.container(THREE, cx, 1.3 + k * 2.6, cz, spick(cc)) : cbox(2.45, 2.6, 6.1, cx, 1.3 + k * 2.6, cz, spick(cc)));
          addBox(cx - 1.25, cx + 1.25, cz - 3.1, cz + 3.1, h * 2.6);
        }
    };
    stack(-140, -690, 2, 6);
    stack(-60, -690, 2, 3);
    stack(-200, -520, 2, 5);
    stack(-120, -625, 2, 3);
    for (let k = 0; k < 3; k++) {
      const x = -200 + k * 70, z = -694;
      plain.push(DC.dildiCityDocks.crane(THREE, x, z));
      addBox(x - 1.6, x + 1.6, z - 1.6, z + 1.6, 36);
      world.roofLights.push(new THREE.Vector3(x, 34.5, z));
    }
    {
      const sx = -110, sz = -722;
      plain.push(DC.dildiCityDocks.ship(THREE, sx, sz));
      world.roofLights.push(new THREE.Vector3(sx + 42, 23, sz));
    }
    {
      const x0 = -120, z0 = -505;
      plain.push(cbox(40, 9, 26, x0, 4.5, z0, '#8a9199'));
      addBox(x0 - 20, x0 + 20, z0 - 13, z0 + 13, 9);
      plain.push(cbox(40.4, 0.8, 26.4, x0, 9.3, z0, '#50565c'));
    }
    signs('DILDI DOCKS', '#ffd700', -24, 7, -505, Math.PI / 2, 14, 2.2);
    metal.push(cbox(0.3, 7, 0.3, -24, 3.5, -498, '#444'));
    metal.push(cbox(0.3, 7, 0.3, -24, 3.5, -512, '#444'));
    world.landmarks.push({ name: 'Docks', x: -110, z: -620, icon: '⚓', color: '#ffd700' });
    // cargo pick-up for the Docks-Coup (only with your own VW Transporter)
    world.docksCargo = { x: -95, z: -680 };
    for (const [a, b] of [[-5.5, -5], [-5.5, -2.6], [5.5, -5], [5.5, -2.6]]) { plain.push(cbox(1.2, 1.1, 1.2, -95 + a, 0.55, -680 + b, '#a0773f')); addBox(-95 + a - 0.6, -95 + a + 0.6, -680 + b - 0.6, -680 + b + 0.6, 1.1); }
    mark.push(cbox(7, 0.02, 0.25, -95, 0.07, -684, '#ffd23b'), cbox(7, 0.02, 0.25, -95, 0.07, -676, '#ffd23b'));
    world.pickups.push({ type: 'armor', x: -40, z: -640 }, { type: 'health', x: -170, z: -600 });
    world.garages.push({ name: 'Garage Docks', x: -30, z: -488, ry: Math.PI / 2, spawn: { x: -18, z: -488, h: Math.PI / 2 }, building: true });

    // ----- AIRPORT (east half) -----
    const rw = { x0: 30, x1: 220, z0: -690, z1: -662 };
    const rwGeo = new THREE.PlaneGeometry(rw.x1 - rw.x0, rw.z1 - rw.z0);
    rwGeo.rotateX(-Math.PI / 2);
    rwGeo.translate((rw.x0 + rw.x1) / 2, 0.03, (rw.z0 + rw.z1) / 2);
    K.worldUV(rwGeo, 10);
    const rwm = new THREE.Mesh(rwGeo, world.asphaltMat);
    rwm.receiveShadow = true;
    scene.add(rwm);
    const rzc = (rw.z0 + rw.z1) / 2;
    for (let x = rw.x0 + 10; x < rw.x1 - 10; x += 16) mark.push(dsh(x, rzc, 8, 0.45, 0.05));
    for (let k = 0; k < 6; k++) { mark.push(dsh(rw.x0 + 8, rw.z0 + 3 + k * 4.4, 10, 1.3, 0.05)); mark.push(dsh(rw.x1 - 8, rw.z0 + 3 + k * 4.4, 10, 1.3, 0.05)); }
    plain.push(cbox(170, 0.05, 70, 125, 0.03, -615, '#8e8f8a'));
    const tx0 = 60, tx1 = 140, tz0 = -540, tz1 = -515;
    plain.push(cbox(tx1 - tx0, 10, tz1 - tz0, (tx0 + tx1) / 2, 5, (tz0 + tz1) / 2, '#e9ecef'));
    addBox(tx0, tx1, tz0, tz1, 10);
    plain.push(cbox(tx1 - tx0 - 4, 5, 0.4, (tx0 + tx1) / 2, 4.5, tz0 - 0.1, '#5a7fa0'));
    plain.push(DC.dildiCityAirport.terminal(THREE, tx0, tx1, tz0, tz1, 10));
    signs("BILAL'S FLUGSCHULE", '#39c6ff', (tx0 + tx1) / 2, 8.6, tz0 - 0.3, Math.PI, 28, 3);
    signs('DILDI AIRPORT', '#ffffff', (tx0 + tx1) / 2, 8.6, tz1 + 0.3, 0, 24, 2.8, { bg: '#1a3a6a' });
    world.landmarks.push({ name: "Bilal's Flugschule", x: (tx0 + tx1) / 2, z: (tz0 + tz1) / 2, icon: '✈️', color: '#39c6ff' });
    world.landmarks.push({ name: 'Flughafen', x: 125, z: rzc, icon: '🛫', color: '#ffffff' });
    plain.push(DC.dildiCityAirport.tower(THREE, 190, -600));
    addCirc(190, -600, 3.4, 31);
    world.roofLights.push(new THREE.Vector3(190, 32, -600));
    for (let k = 0; k < 2; k++) {
      const hx = 70 + k * 40, hz = -625;
      plain.push(cbox(32, 11, 22, hx, 5.5, hz, k === 1 ? '#39c6ff' : '#aab3bb'));
      addBox(hx - 16, hx + 16, hz - 11, hz + 11, 11);
      plain.push(cbox(32.6, 2, 22.6, hx, 11.6, hz, '#50565c'));
      plain.push(cbox(24, 8.5, 0.4, hx, 4.3, hz - 11.1, '#2a2e33'));
      plain.push(DC.dildiCityAirport.hangar(THREE, hx, hz, k + 1));
    }
    const plane = (x, z, ry, color) => {
      const pg = [];
      pg.push(ccyl(0.9, 1.2, 9, 10, 0, 1.6, 0, color, Math.PI / 2));
      pg.push(cbox(11, 0.25, 1.8, 0, 1.3, 0.5, color));
      pg.push(cbox(3.5, 0.2, 1.2, 0, 2.6, -4.2, color));
      pg.push(cbox(0.2, 2.2, 1.6, 0, 2.6, -4.2, color));
      pg.push(cbox(1.1, 0.9, 1.6, 0, 2.4, 1.2, '#1b2733'));
      pg.push(cbox(0.15, 2.4, 0.3, 0, 1.6, 4.6, '#222'));
      for (const [a, b] of [[-1.5, 0.5], [1.5, 0.5], [0, 3.6]]) { pg.push(ccyl(0.3, 0.3, 0.25, 8, a, 0.3, b, '#111', 0, 0, Math.PI / 2)); pg.push(cbox(0.12, 0.7, 0.12, a, 0.7, b, '#777')); }
      plain.push(DC.dildiCityAirport.parkedPlane(THREE, x, z, ry, color));
      addBox(x - 5.5, x + 5.5, z - 4.5, z + 4.5, 2.5);
    };
    plane(150, -600, 0.4, '#ffffff');
    plane(178, -632, -0.2, '#ffd23b');
    plane(120, -595, Math.PI, '#ff8a00');
    const rl = [];
    for (let x = rw.x0; x <= rw.x1; x += 12) { rl.push(cbox(0.4, 0.3, 0.4, x, 0.2, rw.z0, '#ffffff')); rl.push(cbox(0.4, 0.3, 0.4, x, 0.2, rw.z1, '#ffffff')); }
    const rlm = new THREE.Mesh(merge(rl), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    scene.add(rlm);
    world.runwayLightMat = rlm.material;
    world.parkSpots.push({ x: 70, z: -505, h: 0, model: 'taxi' }, { x: 150, z: -505, h: Math.PI / 2, model: 'skoda' });
    world.pickups.push({ type: 'health', x: 125, z: -580 });
    for (let z = BRIDGE_S.z0 - 15; z > -620; z -= 30) lampPos.push([8, z, -Math.PI / 2, 0], [-8, z, Math.PI / 2, 0]);
  }

  // ================= NORTH: desert POIs =================
  const pad = (k) => POI[k];
  // lake
  {
    const w = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 12, 48), new THREE.MeshStandardMaterial({ color: '#2f7fa8', roughness: 0.06, metalness: 0.4, normalMap: world.water.material.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) }));
    w.rotation.x = -Math.PI / 2;
    w.position.set(LAKE.x, LAKE.y, LAKE.z);
    scene.add(w);
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + srand() * 0.3;
      const r = LAKE.r + srange(8, 20);
      treePos.push([LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r, srange(1, 1.4), 'palm']);
    }
    const j = pad('lakeJetty');
    plain.push(cbox(22, 0.25, 3, j.x - 14, LAKE.y + 0.9, j.z, '#8a6a45'));
    for (let k = 0; k < 4; k++) for (const sz of [-1.3, 1.3]) plain.push(cbox(0.3, 3, 0.3, j.x - 4 - k * 6, LAKE.y - 0.5, j.z + sz, '#6a4f33'));
    world.landmarks.push({ name: 'Wüstensee', x: LAKE.x, z: LAKE.z, icon: '🏞️', color: '#3d8fb5' });
  }
  // gas station + desert garage
  {
    const p = pad('tanke'), y = p.y;
    const gx = p.x, gz = p.z;
    plain.push(cbox(40, 0.06, 30, gx, y + 0.03, gz, '#4b4e53'));
    metal.push(cbox(24, 0.9, 12, gx, y + 6, gz, '#e8e8e8'));
    plain.push(cbox(24.2, 0.5, 12.2, gx, y + 5.5, gz, '#d4141c'));
    for (const [a, b] of [[-9, -4], [9, -4], [-9, 4], [9, 4]]) { metal.push(cbox(0.5, 5.4, 0.5, gx + a, y + 2.9, gz + b, '#dddddd')); addCirc(gx + a, gz + b, 0.4, y + 5, y - 1); }
    for (const a of [-5, 0, 5]) { plain.push(cbox(1, 1.8, 0.7, gx + a, y + 1.1, gz, '#d4141c')); addBox(gx + a - 0.5, gx + a + 0.5, gz - 0.35, gz + 0.35, y + 2, { y0: y - 1 }); }
    plain.push(cbox(18, 5, 8, gx, y + 2.5, gz + 11, '#f4efe4'));
    addBox(gx - 9, gx + 9, gz + 7, gz + 15, y + 5, { y0: y - 1 });
    signs('OASE TANKE', '#ffffff', gx, y + 6.2, gz + 6.9, Math.PI, 10, 2, { bg: '#c4121a' });
    world.landmarks.push({ name: 'Oase Tanke', x: gx, z: gz, icon: '⛽', color: '#ffd000' });
    world.garages.push({ name: 'Garage Wüste', x: gx + 16, z: gz - 8, ry: 0, spawn: { x: gx + 16, z: gz - 2, h: 0 }, building: true });
    lampPos.push([gx - 18, gz - 14, 0, y]);
  }
  // village
  {
    const p = pad('village'), y = p.y;
    const houses = [[-28, -22], [-30, 4], [-24, 28], [24, -26], [28, 2], [20, 26], [2, 34], [-4, -34]];
    houses.forEach(([dx, dz], i) => {
      const hx = p.x + dx, hz = p.z + dz;
      const w = srange(8, 11), d = srange(8, 11), h = srange(3.5, 5);
      if (nearGroundRoad(hx, hz, Math.max(w, d) / 2 + 2)) return; // never build on the road
      const col = spick(['#f1e4c8', '#e8d2a8', '#f5efe0', '#d9c39a']);
      const gg = merge([cbox(w, h + 3, d, 0, h / 2 - 1.5, 0, col), cbox(w + 0.6, 0.5, d + 0.6, 0, h + 0.25, 0, '#8a6a45'), cbox(1.4, 2.2, 0.2, 0, 1.1, d / 2 + 0.05, '#4a3a2a'), cbox(0.2, 1.2, 1.2, w / 2 + 0.05, 2.2, 0, '#7aa0b8')]);
      place(gg, hx, y, hz, 0, Math.atan2(-dx, -dz), 0);
      plain.push(gg);
      const rr = Math.max(w, d) / 2 + 0.3;
      addBox(hx - rr * 0.8, hx + rr * 0.8, hz - rr * 0.8, hz + rr * 0.8, y + h, { y0: y - 2 });
      if (i % 2) treePos.push([hx + w / 2 + 3, hz + d / 2 + 2, 1.1, 'palm']);
    });
    plain.push(ccyl(1.5, 1.6, 1.2, 10, p.x, y + 0.6, p.z, '#9c8a6a'));
    addCirc(p.x, p.z, 1.6, y + 1.2, y - 1);
    signs('DILDI-SIEDLUNG', '#ffb347', p.x, y + 4.2, p.z - 46, Math.PI, 14, 2, { bg: '#3a2410' });
    world.landmarks.push({ name: 'Siedlung', x: p.x, z: p.z, icon: '🏘️', color: '#ffb347' });
    world.parkSpots.push({ x: p.x + 12, z: p.z + 12, h: 1.2, model: 'van' });
    world.pickups.push({ type: 'health', x: p.x + 4, z: p.z - 6 });
  }
  // abandoned runway
  {
    const R = RUNWAY, y = R.y;
    const cracked = noiseTex('#6e6a62', 30, 256);
    const g = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0);
    g.rotateX(-Math.PI / 2);
    g.translate((R.x0 + R.x1) / 2, y + 0.05, (R.z0 + R.z1) / 2);
    K.worldUV(g, 7);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: cracked, roughness: 1 }));
    m.receiveShadow = true;
    scene.add(m);
    for (let x = R.x0 + 12; x < R.x1 - 12; x += 20) mark.push(dsh(x, (R.z0 + R.z1) / 2, 9, 0.5, y + 0.07));
    const hx = (R.x0 + R.x1) / 2, hz = R.z1 + 30;
    plain.push(cbox(30, 10, 22, hx, y + 4.5, hz, '#8a7f72'));
    addBox(hx - 15, hx + 15, hz - 11, hz + 11, y + 10, { y0: y - 2 });
    plain.push(cbox(30.4, 1.5, 22.4, hx, y + 10.2, hz, '#5e564c'));
    plain.push(cbox(22, 7.5, 0.4, hx, y + 3.7, hz - 11.1, '#2a2622'));
    signs('LANDEBAHN – VERLASSEN', '#9fb6c8', hx, y + 8, hz - 11.4, Math.PI, 20, 2, { bg: '#2a2622', size: 100 });
    const wg = merge([ccyl(1.2, 1.6, 12, 10, 0, 1.4, 0, '#8d8d8d', Math.PI / 2, 0, 0.2), cbox(14, 0.3, 2.2, 0, 1.1, 1, '#8d8d8d'), cbox(0.3, 3, 2, 0, 2.6, -5.5, '#8d8d8d')]);
    place(wg, R.x1 - 18, y, R.z0 - 12, 0, 0.6, 0);
    plain.push(wg);
    addBox(R.x1 - 25, R.x1 - 11, R.z0 - 19, R.z0 - 5, y + 3, { y0: y - 2 });
    world.landmarks.push({ name: 'Verlassene Landebahn', x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2, icon: '🛬', color: '#9fb6c8' });
    world.pickups.push({ type: 'armor', x: hx, z: hz - 16 });
  }
  // smuggler camp
  {
    const p = pad('camp'), y = p.y, cx = p.x, cz = p.z;
    for (const [a, b, c] of [[-10, -8, '#6b4f3a'], [10, -6, '#4f6b3a'], [-6, 10, '#6b3a3a'], [12, 9, '#3a4f6b']]) {
      if (nearGroundRoad(cx + a, cz + b, 4.5)) continue;
      const t = new THREE.ConeGeometry(4, 3.2, 4);
      colorize(t, c);
      place(t, cx + a, y + 1.6, cz + b, 0, Math.PI / 4, 0);
      plain.push(t);
      addCirc(cx + a, cz + b, 3, y + 3, y - 1);
    }
    for (let k = 0; k < 6; k++) { const x = cx + srange(-4, 4), z = cz + srange(-4, 4); if (nearGroundRoad(x, z, 1.5)) continue; plain.push(cbox(1.2, 1.2, 1.2, x, y + 0.6, z, '#7a5a30')); addBox(x - 0.6, x + 0.6, z - 0.6, z + 0.6, y + 1.2, { y0: y - 1 }); }
    plain.push(ccyl(1.2, 1.4, 0.4, 10, cx, y + 0.2, cz + 2, '#3a3a3a'));
    world.campfire = new THREE.Vector3(cx, y + 0.6, cz + 2);
    for (const [a, b] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) metal.push(cbox(0.25, 8, 0.25, cx + 18 + a, y + 4, cz - 14 + b, '#6a4f3a'));
    plain.push(cbox(3.6, 0.3, 3.6, cx + 18, y + 8, cz - 14, '#8a6a45'));
    addBox(cx + 16.2, cx + 19.8, cz - 15.8, cz - 12.2, y + 9, { y0: y - 1 });
    signs('SCHMUGGLER-CAMP', '#ff8a30', cx, y + 4.5, cz - 22, Math.PI, 16, 2, { bg: '#2a1a0a', size: 110 });
    world.landmarks.push({ name: 'Schmuggler-Camp', x: cx, z: cz, icon: '⛺', color: '#ff8a30' });
    world.parkSpots.push({ x: cx - 20, z: cz + 8, h: 0.5, model: 'van' }, { x: cx + 22, z: cz + 4, h: -0.3, model: 'skoda' });
    world.pickups.push({ type: 'money', x: cx + 3, z: cz - 5, amount: 250 });
  }
  // isolated compounds (walls + house + gate)
  const compound = (p, name, rich) => {
    const y = p.y, cx = p.x, cz = p.z;
    const s = rich ? 20 : 15;
    const wallC = rich ? '#efe6d6' : '#c9b48e';
    const gateW = 5;
    for (const [ax, az, bx, bz] of [[-s, -s, s, -s], [-s, s, s, s], [-s, -s, -s, s], [s, -s, s, s]]) {
      const alongX = az === bz;
      if (alongX && az < 0) {
        // gate opening on the south side
        for (const [a, b] of [[-s, -gateW], [gateW, s]]) {
          plain.push(cbox(b - a, 5.6, 0.5, cx + (a + b) / 2, y - 0.2, cz + az, wallC));
          addBox(cx + a, cx + b, cz + az - 0.3, cz + az + 0.3, y + 2.6, { y0: y - 2 });
        }
        metal.push(cbox(gateW * 2, 0.15, 0.1, cx, y + 2.4, cz + az, '#444'));
        continue;
      }
      if (alongX) { plain.push(cbox(2 * s, 5.6, 0.5, cx, y - 0.2, cz + az, wallC)); addBox(cx - s, cx + s, cz + az - 0.3, cz + az + 0.3, y + 2.6, { y0: y - 2 }); }
      else { plain.push(cbox(0.5, 5.6, 2 * s, cx + ax, y - 0.2, cz, wallC)); addBox(cx + ax - 0.3, cx + ax + 0.3, cz - s, cz + s, y + 2.6, { y0: y - 2 }); }
    }
    const hw = rich ? 14 : 9, hd = rich ? 10 : 8, hh = rich ? 7.5 : 4.5;
    plain.push(cbox(hw, hh + 3, hd, cx, y + hh / 2 - 1.5, cz + 6, rich ? '#ffffff' : '#e8d2a8'));
    plain.push(cbox(hw + 0.8, 0.5, hd + 0.8, cx, y + hh + 0.25, cz + 6, rich ? '#3a3a3a' : '#8a6a45'));
    plain.push(cbox(hw - 2, 2.4, 0.15, cx, y + 2.2, cz + 6 - hd / 2 - 0.05, '#2b3a4a'));
    addBox(cx - hw / 2, cx + hw / 2, cz + 6 - hd / 2, cz + 6 + hd / 2, y + hh, { y0: y - 2 });
    if (rich) {
      const pool = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 5), new THREE.MeshStandardMaterial({ color: '#2fb6d8', roughness: 0.05, metalness: 0.2 }));
      pool.position.set(cx - 4, y + 0.12, cz - 8);
      scene.add(pool);
      for (let k = 0; k < 4; k++) treePos.push([cx + (k % 2 ? 16 : -16), cz + (k < 2 ? -16 : 16), 1.2, 'palm']);
      world.parkSpots.push({ x: cx + 9, z: cz - 10, h: 0, model: 'rs6', color: '#111111' });
    } else {
      plain.push(cbox(2.4, 2.6, 2.4, cx + 10, y + 1.3, cz - 8, '#7a5a30'));
      addBox(cx + 8.8, cx + 11.2, cz - 9.2, cz - 6.8, y + 2.6, { y0: y - 2 });
      if (srand() < 0.6) world.parkSpots.push({ x: cx - 9, z: cz - 9, h: srand() * 3, model: spick(['van', 'skoda']) });
    }
    world.landmarks.push({ name, x: cx, z: cz, icon: rich ? '🏡' : '🏚️', color: '#d9c39a' });
  };
  compound(pad('hofNW'), 'Einsamer Hof', false);
  compound(pad('hofNO'), 'Kakteen-Ranch', false);
  compound(pad('hofS'), 'Altes Gehöft', false);
  compound(pad('hofHuegel'), 'Hügelhaus', false);
  compound(pad('villa'), 'Wüstenvilla', true);

  // cacti + rocks scattered on the dunes (not on roads)
  {
    const onRoad = (x, z) => world.roadCells.has(Math.floor(x / 4) * 100000 + Math.floor(z / 4));
    const deco = [];
    for (let k = 0; k < 420; k++) {
      const D = DESERTS[k % 2];
      const a = srange(0, Math.PI * 2), rr = Math.sqrt(srand()) * 0.95;
      const x = D.x + Math.cos(a) * D.rx * rr, z = D.z + Math.sin(a) * D.rz * rr;
      if (onRoad(x, z) || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 14) continue;
      if (x > RUNWAY.x0 - 15 && x < RUNWAY.x1 + 15 && z > RUNWAY.z0 - 15 && z < RUNWAY.z1 + 50) continue;
      let nearPoi = false;
      for (const kk in POI) { const p = POI[kk]; if (Math.hypot(p.x - x, p.z - z) < (p.r || 0) + 12) nearPoi = true; }
      if (nearPoi) continue;
      const y = T(x, z);
      if (slopeAt(x, z) > 0.5) continue;
      if (srand() < 0.55) {
        const h = srange(2, 4);
        deco.push(cbox(0.7, h + 0.5, 0.7, x, y + h / 2 - 0.25, z, '#3f7d3b'));
        deco.push(cbox(0.5, 1.4, 0.5, x - 0.9, y + h * 0.55, z, '#3f7d3b'));
        deco.push(cbox(1.1, 0.5, 0.5, x - 0.6, y + h * 0.55 + 0.5, z, '#3f7d3b'));
        deco.push(cbox(0.5, 1.0, 0.5, x + 0.9, y + h * 0.45, z, '#3f7d3b'));
        deco.push(cbox(1.1, 0.5, 0.5, x + 0.6, y + h * 0.45 + 0.4, z, '#3f7d3b'));
        addCirc(x, z, 0.5, y + h, y - 2);
      } else {
        const r = srange(1.2, 4);
        const rock = new THREE.DodecahedronGeometry(r, 0);
        colorize(rock, spick(['#a08870', '#8c7860', '#b09880']));
        place(rock, x, y + r * 0.3, z, srange(0, 3), srange(0, 3), 0);
        deco.push(rock);
        addCirc(x, z, r * 0.8, y + r, y - 2);
      }
    }
    world.cullList = world.cullList || [];
    world.cullList.push(...tiledMeshes(scene, deco, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 200, false, (m) => { m.castShadow = true; m.receiveShadow = true; }));
  }
  // world limits (invisible) + far horizon
  {
    addBox(WORLD.x0 - 4, WORLD.x0 + 6, -560, WORLD.z1, 400, { inv: true, y0: -50 });
    addBox(WORLD.x1 - 6, WORLD.x1 + 4, -560, WORLD.z1, 400, { inv: true, y0: -50 });
    addBox(WORLD.x0, WORLD.x1, WORLD.z1 - 6, WORLD.z1 + 4, 400, { inv: true, y0: -50 });
    const ring = [];
    const mountain = (x, z, r, h, col) => {
      const cone = new THREE.ConeGeometry(r, h, 8);
      colorize(cone, col || spick(['#9c7a52', '#8a6a46', '#b08a5c', '#7f6646']));
      place(cone, x, h * 0.42 - 6, z, 0, srange(0, 3), 0);
      ring.push(cone);
    };
    for (let k = 0; k < 30; k++) mountain(srange(-1100, 1100), WORLD.z1 + srange(80, 500), srange(120, 220), srange(90, 220));
    for (let k = 0; k < 18; k++) { mountain(WORLD.x0 - srange(80, 400), srange(-500, 1400), srange(120, 220), srange(90, 220)); mountain(WORLD.x1 + srange(80, 400), srange(-500, 1400), srange(120, 220), srange(90, 220)); }
    for (let k = 0; k < 8; k++) mountain((k % 2 ? 1 : -1) * srange(500, 900), -1200 - srange(0, 300), srange(60, 120), srange(20, 60), spick(['#4f6b4a', '#5b7752']));
    world.cullList.push(...tiledMeshes(scene, ring, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 400));
  }

  world.hotspots = [
    { x: -110, z: -600, r: 50, n: 6 }, // docks
    { x: 110, z: -560, r: 35, n: 5 }, // airport
    { x: POI.village.x, z: POI.village.z, r: 35, n: 7 }, // village
    { x: POI.tanke.x, z: POI.tanke.z, r: 14, n: 2 },
    { x: POI.camp.x, z: POI.camp.z, r: 16, n: 3 },
  ];
  if (world.marketHotspot) world.hotspots.push(world.marketHotspot);
  if (world.bankHotspot) world.hotspots.push(world.bankHotspot);
}

// ---- queries ----
export function isLand(x, z) {
  if (Math.abs(x) <= WALL_OUT && Math.abs(z) <= WALL_OUT) return true;
  if (inIsland(x, z) || onBridgeS(x, z)) return true;
  if (z < -930) { const g = radjGround(x, z); return g > -0.5 || g < -20; } // Radj-Insel + its cellar
  if (z < COAST_Z) return false;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 6) return false;
  return x > WORLD.x0 && x < WORLD.x1 && z < WORLD.z1;
}
export function inCity(x, z) {
  return Math.abs(x) <= BOUND && Math.abs(z) <= BOUND;
}
export function isRoad(x, z) {
  if (inCity(x, z)) return true;
  return world.roadCells.has(Math.floor(x / 4) * 100000 + Math.floor(z / 4));
}
export function areaName(x, z) {
  if (Math.abs(x) <= WALL_OUT && Math.abs(z) <= WALL_OUT) return 'Innenstadt';
  if (inIsland(x, z)) return x < 0 ? 'Docks' : 'Flughafen';
  if (onBridgeS(x, z)) return 'Brücke';
  if (z < -930 && radjGround(x, z) > -0.5) return 'Radj-Insel';
  if (z < COAST_Z) return 'Wasser';
  if (z < -WALL_OUT) return 'Dildi-Kreuz';
  for (const D of DESERTS) {
    const ex = (x - D.x) / D.rx, ez = (z - D.z) / D.rz;
    if (ex * ex + ez * ez < 1) return D.name;
  }
  return 'Berge';
}
