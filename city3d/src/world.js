import * as THREE from 'three';
import { cbox, ccyl, merge, canvasTex, neonSign, srand, srange, spick, colorize, place, clamp, lerp } from './util.js';
import { buildOutskirts } from './outskirts.js';
import './dildi_cars.js';
const deco = (scene, kind, params) => { const DC = globalThis.DildiCars; if (!DC) return; const d = DC.dildiCityBuilding(THREE, kind, params); scene.add(d); world.signMats.push(d.userData.glow); };
import { WALL_OUT, outerGround, deckAt, buildGeo, ROADS } from './geo.js';

// ---------- city layout ----------
export const NB = 6; // blocks per axis
export const P = 68; // pitch (block + road)
export const RW = 6; // half road width
export const SW = 4; // sidewalk width
export const H = (NB * P) / 2; // 204
export const BOUND = H + 14; // railing line
export const LANE = 3.2; // lane offset from road center
export const roadC = (i) => -H + i * P; // road centerline i = 0..NB

export const world = {
  colliders: [],
  grid: new Map(),
  blocks: [],
  lights: [], // traffic light intersections
  lightPoles: [],
  landmarks: [],
  pickups: [],
  parkSpots: [],
  nightMats: [],
  signMats: [],
  pools: null,
  windowMats: [],
  roofLights: [],
  exits: [],
  buildingMesh: [],
  interiors: [],
  garages: [],
  sideStreets: [],
};

const CELL = 34;
const key = (cx, cz) => (cx + 200) * 1000 + (cz + 200);

function addCollider(c) {
  world.colliders.push(c);
  let x0, x1, z0, z1;
  if (c.t === 'b') {
    x0 = c.x0; x1 = c.x1; z0 = c.z0; z1 = c.z1;
  } else {
    x0 = c.x - c.r; x1 = c.x + c.r; z0 = c.z - c.r; z1 = c.z + c.r;
  }
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const k = key(cx, cz);
      if (!world.grid.has(k)) world.grid.set(k, []);
      world.grid.get(k).push(c);
    }
}
export function addBox(x0, x1, z0, z1, h, extra) {
  if (extra && extra.y0 === undefined && extra.yb !== undefined) extra.y0 = extra.yb;
  const c = { t: 'b', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h, ...extra };
  addCollider(c);
  return c;
}
export function addCirc(x, z, r, h = 3, y0) {
  addCollider({ t: 'c', x, z, r, h, y0 });
}

const _q = [];
let _qid = 0;
export function query(x, z, r) {
  _q.length = 0;
  _qid++;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const l = world.grid.get(key(cx, cz));
      if (!l) continue;
      for (const c of l) {
        if (c._q === _qid) continue;
        c._q = _qid;
        _q.push(c);
      }
    }
  return _q;
}

// circle vs colliders; returns push vector or null. y = feet height
const _res = { x: 0, z: 0, nx: 0, nz: 0, hit: false };
export function collideCircle(x, z, r, y = 0, top = 2) {
  let px = x, pz = z;
  let hit = false;
  let nx = 0, nz = 0;
  const list = query(x, z, r + 1);
  for (let iter = 0; iter < 2; iter++) {
    for (const c of list) {
      if (c.off || y > c.h - 0.05 || y + top < (c.y0 || 0)) continue;
      if (c.t === 'b') {
        const cx = clamp(px, c.x0, c.x1);
        const cz = clamp(pz, c.z0, c.z1);
        let dx = px - cx, dz = pz - cz;
        let d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-8) {
            // center inside the box: push out along smallest axis
            const l = px - c.x0, rr = c.x1 - px, b = pz - c.z0, f = c.z1 - pz;
            const m = Math.min(l, rr, b, f);
            if (m === l) { dx = -1; dz = 0; px = c.x0 - r; }
            else if (m === rr) { dx = 1; dz = 0; px = c.x1 + r; }
            else if (m === b) { dx = 0; dz = -1; pz = c.z0 - r; }
            else { dx = 0; dz = 1; pz = c.z1 + r; }
            nx = dx; nz = dz;
          } else {
            const d = Math.sqrt(d2);
            nx = dx / d; nz = dz / d;
            px = cx + nx * r;
            pz = cz + nz * r;
          }
          hit = true;
        }
      } else {
        const dx = px - c.x, dz = pz - c.z;
        const rr = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d;
          px = c.x + nx * rr;
          pz = c.z + nz * rr;
          hit = true;
        }
      }
    }
  }
  _res.x = px; _res.z = pz; _res.nx = nx; _res.nz = nz; _res.hit = hit;
  return _res;
}

// ground height (sidewalks are raised 0.2)
export function blockOf(v) {
  const t = v + H;
  const i = Math.floor(t / P);
  const l = t - i * P;
  return { i, l };
}
export function onSidewalk(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax > BOUND + 0.01 || az > BOUND + 0.01) return false; // wall zone / outside
  if (ax > H + RW || az > H + RW) {
    for (const e of world.exits) {
      if (e.axis === 'z' && Math.abs(x - e.c) < RW && z * e.dir > 0 && az > H + RW - 0.5) return false;
      if (e.axis === 'x' && Math.abs(z - e.c) < RW && x * e.dir > 0 && ax > H + RW - 0.5) return false;
    }
    return true;
  }
  const bx = blockOf(x), bz = blockOf(z);
  if (!(bx.i >= 0 && bx.i < NB && bz.i >= 0 && bz.i < NB && bx.l > RW && bx.l < P - RW && bz.l > RW && bz.l < P - RW)) return false;
  for (const st of world.sideStreets) if (x > st.x0 && x < st.x1 && z > st.z0 && z < st.z1) return false;
  return true;
}
export function inCityArea(x, z) { return Math.abs(x) <= WALL_OUT && Math.abs(z) <= WALL_OUT; }
// static ground (sidewalks, terrain, sea), no decks
export function groundY(x, z) {
  if (inCityArea(x, z)) {
    for (const it of world.interiors) if (it.floor !== undefined && x > it.x0 && x < it.x1 && z > it.z0 && z < it.z1) return it.floor;
    return onSidewalk(x, z) ? 0.2 : 0;
  }
  return outerGround(x, z);
}
// ground including elevated roads below refY
export function groundAt(x, z, refY = 1e9) {
  const g = groundY(x, z);
  const d = deckAt(x, z, refY);
  return d > g ? d : g;
}


// segment vs AABB test for line of sight / bullets (2D slab + height)
export function rayBoxes(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT;
  let bn = null;
  const steps = Math.ceil(maxT / CELL) + 1;
  const seen = new Set();
  for (let s = 0; s <= steps; s++) {
    const t = Math.min(maxT, s * CELL);
    const list = query(ox + dx * t, oz + dz * t, CELL);
    for (const c of list) {
      if (seen.has(c)) continue;
      seen.add(c);
      if (c.t !== 'b' || c.off) continue;
      const r = rayAABB(ox, oy, oz, dx, dy, dz, c.x0, c.y0 || 0, c.z0, c.x1, c.h, c.z1);
      if (r !== null && r < best) {
        best = r;
        bn = c;
      }
    }
  }
  return bn ? { t: best, c: bn } : null;
}
export function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1e9;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < mn[a] || o[a] > mx[a]) return null;
    } else {
      let t1 = (mn[a] - o[a]) / d[a];
      let t2 = (mx[a] - o[a]) / d[a];
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

// ---------- textures ----------
function noiseTex(base, var1, size = 256, extra) {
  return canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * var1;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    if (extra) extra(ctx, w, h);
  });
}

function facadeTex(style) {
  // 8x8 windows per tile; returns [map, emissive]
  const S = 512, cols = 8, rows = 8, cw = S / cols, rh = S / rows;
  const lit = [];
  for (let i = 0; i < cols * rows; i++) lit.push(Math.random() < (style === 0 ? 0.3 : 0.42));
  const map = canvasTex(S, S, (ctx) => {
    const wall = ['#c9d3dc', '#e8e2d6', '#b5654a', '#d8d2c4'][style];
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, S, S);
    if (style === 2) {
      // brick rows
      ctx.fillStyle = 'rgba(60,20,10,0.25)';
      for (let y = 0; y < S; y += 8) ctx.fillRect(0, y, S, 1);
      for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < S; x += 16) ctx.fillRect(x, y, 1, 8);
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * rh;
        if (style === 0) {
          // glass curtain wall
          const g = ctx.createLinearGradient(x, y, x + cw, y + rh);
          g.addColorStop(0, '#6f8fae');
          g.addColorStop(0.5, '#a9c4dc');
          g.addColorStop(1, '#4d6a8a');
          ctx.fillStyle = g;
          ctx.fillRect(x + 2, y + 2, cw - 4, rh - 6);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(x + 2, y + 2, cw * 0.3, rh - 6);
        } else {
          const mx = cw * 0.22, my = rh * 0.2;
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x + mx - 2, y + my - 2, cw - mx * 2 + 4, rh - my * 2 + 6);
          const g = ctx.createLinearGradient(x, y + my, x, y + rh - my);
          g.addColorStop(0, '#5a7088');
          g.addColorStop(1, '#2a3646');
          ctx.fillStyle = g;
          ctx.fillRect(x + mx, y + my, cw - mx * 2, rh - my * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(x + mx, y + my, (cw - mx * 2) * 0.35, rh - my * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x + mx - 3, y + rh - my, cw - mx * 2 + 6, 3); // sill
        }
      }
    // plain wall corner for roofs (bottom-left)
    ctx.fillStyle = '#8d8d8d';
    ctx.fillRect(0, S - 6, 6, 6);
  });
  const em = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (!lit[r * cols + c]) continue;
        const x = c * cw, y = r * rh;
        const col = ['#ffd9a0', '#ffe9c4', '#fff4dc', '#bfe0ff', '#ffc27a'][Math.floor(Math.random() * 5)];
        ctx.fillStyle = col;
        if (style === 0) ctx.fillRect(x + 3, y + 3, cw - 6, rh - 8);
        else {
          const mx = cw * 0.22, my = rh * 0.2;
          ctx.fillRect(x + mx, y + my, cw - mx * 2, rh - my * 2);
        }
      }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, S - 6, 6, 6);
  });
  return [map, em];
}

function shopTex() {
  const S = 512;
  const awn = ['#c0392b', '#2471a3', '#1e8449', '#d4ac0d', '#7d3c98', '#e67e22', '#17a589', '#cb4335'];
  const names = ['DÖNER', 'KIOSK', 'BÄCKER', 'FRISEUR', 'SPÄTI', 'HANDY', 'APOTHEKE', 'IMBISS', 'BAR', 'WETTEN', 'SHISHA', 'MARKT'];
  const map = canvasTex(S, S / 4, (ctx) => {
    ctx.fillStyle = '#6b6560';
    ctx.fillRect(0, 0, S, S / 4);
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      ctx.fillStyle = '#26303a';
      ctx.fillRect(x + 8, 40, 112, 80);
      const g = ctx.createLinearGradient(x, 40, x + 112, 120);
      g.addColorStop(0, 'rgba(160,200,230,0.5)');
      g.addColorStop(1, 'rgba(40,60,80,0.2)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 8, 40, 112, 80);
      ctx.fillStyle = awn[(i * 3) % awn.length];
      ctx.fillRect(x + 4, 8, 120, 26);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(names[(i * 5 + 2) % names.length], x + 64, 28);
    }
  });
  const em = canvasTex(S, S / 4, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S / 4);
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      ctx.fillStyle = ['#a8865a', '#b09a70', '#7c98a8', '#a88060'][i];
      ctx.fillRect(x + 10, 42, 108, 76);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(names[(i * 5 + 2) % names.length], x + 64, 28);
    }
  });
  return [map, em];
}

// planar world uv
function worldUV(g, s) {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / s;
    uv[i * 2 + 1] = p.getZ(i) / s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// building with facade uv (u per 32m, v per 28m)
function buildingGeo(x0, x1, z0, z1, y0, y1, color, roofColor, uoff) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const c = new THREE.Color(color), rc = new THREE.Color(roofColor);
  const quad = (a, b, cc, d, n, uvs, cl) => {
    const base = pos.length / 3;
    for (const v of [a, b, cc, d]) pos.push(...v);
    for (let i = 0; i < 4; i++) { nor.push(...n); col.push(cl.r, cl.g, cl.b); }
    uv.push(...uvs);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const vy0 = y0 / 28, vy1 = y1 / 28;
  const W = x1 - x0, D = z1 - z0;
  // +z face
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [uoff, vy0, uoff + W / 32, vy0, uoff + W / 32, vy1, uoff, vy1], c);
  // -z face
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [uoff, vy0, uoff + W / 32, vy0, uoff + W / 32, vy1, uoff, vy1], c);
  // +x
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [uoff, vy0, uoff + D / 32, vy0, uoff + D / 32, vy1, uoff, vy1], c);
  // -x
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [uoff, vy0, uoff + D / 32, vy0, uoff + D / 32, vy1, uoff, vy1], c);
  // roof
  const ru = 0.004, rv = 0.996;
  quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [ru, rv, ru, rv, ru, rv, ru, rv], rc);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// shop band (ground floor) uv: u per 32m (4 shops of 8m)
function shopGeo(x0, x1, z0, z1, h, uoff) {
  const g = buildingGeo(x0, x1, z0, z1, 0.2, h, '#ffffff', '#555555', uoff);
  const uv = g.attributes.uv;
  for (let i = 0; i < 16; i++) uv.setY(i, i % 4 < 2 ? 0 : 1);
  return g;
}

// ---------- build ----------
export function buildWorld(scene, quality) {
  buildGeo();
  const facade = [0, 1, 2, 3].map(facadeTex);
  const facadeMats = facade.map(
    ([map, em], i) =>
      new THREE.MeshStandardMaterial({
        map,
        emissiveMap: em,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0,
        vertexColors: true,
        roughness: i === 0 ? 0.25 : 0.85,
        metalness: i === 0 ? 0.35 : 0.0,
      })
  );
  world.windowMats.push(...facadeMats);
  const [shopMap, shopEm] = shopTex();
  const shopMat = new THREE.MeshStandardMaterial({ map: shopMap, emissiveMap: shopEm, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.15, roughness: 0.6 });
  world.windowMats.push(shopMat);
  const plainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 });

  const bGeos = [[], [], [], []];
  const shopGeos = [];
  const plain = [];
  const metal = [];

  // --- asphalt (city + gaps through the building wall) ---
  const asphalt = noiseTex('#3a3d42', 26, 256, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = Math.random() * w, y = Math.random() * h;
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  const ag = new THREE.PlaneGeometry(WALL_OUT * 2 + 2, WALL_OUT * 2 + 2);
  ag.rotateX(-Math.PI / 2);
  worldUV(ag, 10);
  const ground = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92 }));
  ground.receiveShadow = true;
  scene.add(ground);
  world.asphaltMat = ground.material;

  // --- exits through the wall: 3 south (Kreuz + harbour road), 2 west + 2 east (mountain passes) ---
  // axis = direction of travel through the gap, c = position across it
  world.exits = [];
  for (const i of [1, 3, 5]) world.exits.push({ axis: 'z', c: roadC(i), dir: -1 });
  for (const j of [2, 4]) { world.exits.push({ axis: 'x', c: roadC(j), dir: -1 }); world.exits.push({ axis: 'x', c: roadC(j), dir: 1 }); }

  // --- side streets (Querstraßen) splitting some blocks ---
  const SPLIT = { '0,3': 'v', '1,5': 'h', '0,4': 'h', '2,0': 'v', '5,2': 'h', '3,0': 'h', '2,5': 'v', '5,4': 'v', '4,3': 'h', '2,1': 'h' };
  const SSW = 5; // half width of a side street
  world.sideStreets = [];

  // --- sidewalks ---
  const paveTex = noiseTex('#a9a59d', 18, 128, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(70,65,60,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
    }
  });
  const swGeos = [];
  const swBox = (x0, x1, z0, z1) => {
    const g = new THREE.BoxGeometry(x1 - x0, 0.2, z1 - z0);
    g.translate((x0 + x1) / 2, 0.1, (z0 + z1) / 2);
    swGeos.push(worldUV(g, 4));
  };
  for (let bi = 0; bi < NB; bi++)
    for (let bj = 0; bj < NB; bj++) {
      const x0 = roadC(bi) + RW, x1 = roadC(bi + 1) - RW;
      const z0 = roadC(bj) + RW, z1 = roadC(bj + 1) - RW;
      const split = SPLIT[`${bi},${bj}`];
      const blk = { bi, bj, x0, x1, z0, z1, type: 'city', split };
      if (split === 'v') {
        const cx = (x0 + x1) / 2;
        swBox(x0, cx - SSW, z0, z1);
        swBox(cx + SSW, x1, z0, z1);
        world.sideStreets.push({ x0: cx - SSW, x1: cx + SSW, z0, z1, along: 'z' });
      } else if (split === 'h') {
        const cz = (z0 + z1) / 2;
        swBox(x0, x1, z0, cz - SSW);
        swBox(x0, x1, cz + SSW, z1);
        world.sideStreets.push({ x0, x1, z0: cz - SSW, z1: cz + SSW, along: 'x' });
      } else swBox(x0, x1, z0, z1);
      world.blocks.push(blk);
    }
  // promenade ring (inside the building wall) with gaps for the exits
  const prom = [
    { r: [-BOUND, BOUND, H + RW, BOUND], axis: 'z', dir: 1 },
    { r: [-BOUND, BOUND, -BOUND, -H - RW], axis: 'z', dir: -1 },
    { r: [H + RW, BOUND, -H - RW, H + RW], axis: 'x', dir: 1 },
    { r: [-BOUND, -H - RW, -H - RW, H + RW], axis: 'x', dir: -1 },
  ];
  for (const pr of prom) {
    const [x0, x1, z0, z1] = pr.r;
    let segs = pr.axis === 'z' ? [[x0, x1]] : [[z0, z1]];
    for (const e of world.exits) {
      if (e.axis !== pr.axis || e.dir !== pr.dir) continue;
      const n = [];
      for (const [a2, b2] of segs) {
        if (e.c + RW <= a2 || e.c - RW >= b2) n.push([a2, b2]);
        else {
          if (e.c - RW > a2) n.push([a2, e.c - RW]);
          if (e.c + RW < b2) n.push([e.c + RW, b2]);
        }
      }
      segs = n;
    }
    for (const [a2, b2] of segs) pr.axis === 'z' ? swBox(a2, b2, z0, z1) : swBox(x0, x1, a2, b2);
  }
  const sidewalk = new THREE.Mesh(merge(swGeos, true), new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.9 }));
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  // railing helper (used on decks, bridge, quays)
  const railSeg = (ax, az, bx, bz, y = 0) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    metal.push(cbox(0.08, 0.08, len, (ax + bx) / 2, y + 1.2, (az + bz) / 2, '#2d3a44', ang));
    metal.push(cbox(0.06, 0.06, len, (ax + bx) / 2, y + 0.75, (az + bz) / 2, '#2d3a44', ang));
    const n = Math.floor(len / 2.5);
    for (let i = 0; i <= n; i++) {
      const t = i / Math.max(1, n);
      metal.push(cbox(0.08, 1.05, 0.08, lerp(ax, bx, t), y + 0.72, lerp(az, bz, t), '#2d3a44'));
    }
  };

  const mark = [];
  const dash = (x, z, w, d, y = 0.02, col = '#e8e8e2') => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    return colorize(g, col);
  };
  // dashes through the wall gaps + side streets
  for (const e of world.exits) for (let t = H + RW + 2; t < WALL_OUT; t += 7) mark.push(e.axis === 'z' ? dash(e.c, e.dir * (t + 1.5), 0.22, 3) : dash(e.dir * (t + 1.5), e.c, 3, 0.22));
  for (const st of world.sideStreets) {
    if (st.along === 'z') { const cx = (st.x0 + st.x1) / 2; for (let t = st.z0 + 3; t < st.z1 - 3; t += 6) mark.push(dash(cx, t + 1, 0.16, 2)); }
    else { const cz = (st.z0 + st.z1) / 2; for (let t = st.x0 + 3; t < st.x1 - 3; t += 6) mark.push(dash(t + 1, cz, 2, 0.16)); }
  }

  // sea (only south of the coast now)
  const waterNormal = canvasTex(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const a2 = Math.sin(x * 0.15 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin(y * 0.21 + x * 0.05) * 0.5;
        const b2 = Math.cos(y * 0.13 + Math.sin(x * 0.09) * 2) * 0.5 + Math.cos(x * 0.19 - y * 0.04) * 0.5;
        const i = (y * w + x) * 4;
        img.data[i] = 128 + a2 * 40;
        img.data[i + 1] = 128 + b2 * 40;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  });
  waterNormal.colorSpace = THREE.NoColorSpace;
  waterNormal.repeat.set(120, 120);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: '#1f5d7a', roughness: 0.08, metalness: 0.5, normalMap: waterNormal, normalScale: new THREE.Vector2(0.6, 0.6) })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.3;
  scene.add(water);
  world.water = water;

  // ---------- road markings ----------
  for (let i = 0; i <= NB; i++) {
    const c = roadC(i);
    for (let j = 0; j < NB; j++) {
      const a = roadC(j) + RW + 3, b = roadC(j + 1) - RW - 3;
      for (let t = a; t < b - 2; t += 7) {
        mark.push(dash(c, t + 1.5, 0.22, 3)); // along z
        mark.push(dash(t + 1.5, c, 3, 0.22)); // along x
      }
      // edge lines
      mark.push(dash(c - RW + 0.4, (a + b) / 2, 0.15, b - a + 6));
      mark.push(dash(c + RW - 0.4, (a + b) / 2, 0.15, b - a + 6));
      mark.push(dash((a + b) / 2, c - RW + 0.4, b - a + 6, 0.15));
      mark.push(dash((a + b) / 2, c + RW - 0.4, b - a + 6, 0.15));
    }
  }
  // zebra crossings + stop lines
  for (let i = 0; i <= NB; i++)
    for (let j = 0; j <= NB; j++) {
      const x = roadC(i), z = roadC(j);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ex = x + dx * (RW + 1.6), ez = z + dz * (RW + 1.6);
        if (Math.abs(ex) > H + RW || Math.abs(ez) > H + RW) continue;
        for (let k = -2; k <= 2; k++) {
          const off = k * 2.2;
          if (dx) mark.push(dash(ex, z + off, 2.4, 1.0));
          else mark.push(dash(x + off, ez, 1.0, 2.4));
        }
      }
    }
  const markMesh = new THREE.Mesh(merge(mark), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  markMesh.receiveShadow = true;
  scene.add(markMesh);

  // ---------- special blocks ----------
  const special = {
    '2,2': 'park',
    '3,2': 'casino',
    '2,3': 'tower',
    '4,4': 'police',
    '1,4': 'pizza',
    '4,1': 'gas',
    '0,5': 'parking',
    '5,0': 'parking2',
    '3,4': 'hospital',
    '1,1': 'hideout',
    '4,2': 'bank',
    '0,1': 'depot',
    '5,3': 'market',
    '5,1': 'customs',
    // more green: three former building blocks are now parks
    '1,3': 'park2',
    '4,5': 'park2',
    '4,0': 'park2',
  };

  const treePos = [];
  const lampPos = [];
  const benchGeos = [];
  const grass = [];
  const signs = [];

  const wallColors = ['#ffffff', '#f3ece0', '#e6efff', '#ffe9d6', '#e9f6ec', '#f6f0ff', '#fff6dc', '#dcdcdc'];
  const roofColors = ['#5d5f63', '#6e6e70', '#4f5357', '#757068'];

  const addBuilding = (x0, x1, z0, z1, h, style, opts = {}) => {
    const col = opts.color || spick(wallColors);
    const roof = spick(roofColors);
    const uoff = Math.floor(srand() * 8) / 8;
    const shopH = opts.shops ? 4.2 : 0;
    if (opts.shops) {
      shopGeos.push(shopGeo(x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15, shopH, Math.floor(srand() * 4) / 4));
    }
    bGeos[style].push(buildingGeo(x0, x1, z0, z1, shopH || 0.2, h, col, roof, uoff));
    addBox(x0, x1, z0, z1, h);
    // parapet
    plain.push(cbox(x1 - x0 + 0.3, 0.6, 0.3, (x0 + x1) / 2, h + 0.3, z0 + 0.15, roof));
    plain.push(cbox(x1 - x0 + 0.3, 0.6, 0.3, (x0 + x1) / 2, h + 0.3, z1 - 0.15, roof));
    plain.push(cbox(0.3, 0.6, z1 - z0, x0 + 0.15, h + 0.3, (z0 + z1) / 2, roof));
    plain.push(cbox(0.3, 0.6, z1 - z0, x1 - 0.15, h + 0.3, (z0 + z1) / 2, roof));
    // roof details
    if (!opts.noRoof) {
      const n = 1 + Math.floor(srand() * 3);
      for (let k = 0; k < n; k++) {
        const w = srange(2, 4), d = srange(2, 4), hh = srange(1, 2.4);
        const cx = srange(x0 + 3, x1 - 3), cz = srange(z0 + 3, z1 - 3);
        plain.push(cbox(w, hh, d, cx, h + hh / 2, cz, spick(['#9a9a9a', '#b0b0b0', '#7a7f85'])));
      }
      if (srand() < 0.35) {
        // water tank / antenna
        const cx = srange(x0 + 3, x1 - 3), cz = srange(z0 + 3, z1 - 3);
        if (srand() < 0.5) {
          plain.push(ccyl(1.3, 1.3, 2.5, 10, cx, h + 3.2, cz, '#8b5a3c'));
          for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) metal.push(cbox(0.12, 2, 0.12, cx + a * 0.9, h + 1, cz + b * 0.9, '#444'));
        } else {
          metal.push(cbox(0.15, 7, 0.15, cx, h + 3.5, cz, '#777'));
          world.roofLights.push(new THREE.Vector3(cx, h + 7.1, cz));
        }
      }
    }
    if (h > 50) world.roofLights.push(new THREE.Vector3(x0 + 1, h + 1, z0 + 1), new THREE.Vector3(x1 - 1, h + 1, z1 - 1));
  };

  // gable roof (ridge along x or z)
  const gable = (x0, x1, z0, z1, y, hr, color, alongX) => {
    const w = x1 - x0, d = z1 - z0;
    const sh = new THREE.Shape();
    const half = (alongX ? d : w) / 2 + 0.35;
    sh.moveTo(-half, 0); sh.lineTo(half, 0); sh.lineTo(0, hr); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: (alongX ? w : d) + 0.5, bevelEnabled: false });
    g.deleteAttribute('uv');
    if (alongX) { g.rotateY(Math.PI / 2); g.translate(x0 - 0.25, y, (z0 + z1) / 2); }
    else g.translate((x0 + x1) / 2, y, z0 - 0.25);
    colorize(g, color);
    plain.push(g);
  };
  // old town: narrow row houses with gable roofs
  const buildAltstadt = (A0, A1, C0, C1) => {
    const alongX = A1 - A0 >= C1 - C0;
    const rows = (alongX ? C1 - C0 : A1 - A0) > 26 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      let t = alongX ? A0 : C0;
      const end = alongX ? A1 : C1;
      while (t < end - 5) {
        const wdt = Math.min(end - t, srange(7, 11));
        const h = Math.round(srange(3, 5)) * 3.5 + 0.2;
        const col = spick(['#e8c9a0', '#d98c6c', '#f0e0c0', '#c9a27a', '#e6b8a2', '#bcd2c0', '#f2d7a6', '#d7c2e0']);
        let x0, x1, z0, z1;
        if (alongX) { x0 = t; x1 = t + wdt; const span = (C1 - C0) / rows; z0 = C0 + r * span; z1 = z0 + span; }
        else { z0 = t; z1 = t + wdt; const span = (A1 - A0) / rows; x0 = A0 + r * span; x1 = x0 + span; }
        const sty = srand() < 0.5 ? 2 : 1;
        shopGeos.push(shopGeo(x0 + 0.25, x1 - 0.25, z0 + 0.25, z1 - 0.25, 4.2, Math.floor(srand() * 4) / 4));
        bGeos[sty].push(buildingGeo(x0 + 0.4, x1 - 0.4, z0 + 0.4, z1 - 0.4, 4.2, h, col, '#7a3b2a', Math.floor(srand() * 8) / 8));
        addBox(x0 + 0.4, x1 - 0.4, z0 + 0.4, z1 - 0.4, h + 3);
        gable(x0 + 0.4, x1 - 0.4, z0 + 0.4, z1 - 0.4, h, srange(2.6, 4), spick(['#8a3b2b', '#7a3326', '#5d4037', '#6b4a3a']), !alongX);
        if (srand() < 0.4) plain.push(cbox(0.9, 2.2, 0.9, x0 + wdt * 0.7, h + 1.4, (z0 + z1) / 2, '#6d5a50'));
        t += wdt;
      }
    }
  };
  // commercial area: low halls, yards, fences, containers
  const buildGewerbe = (A0, A1, C0, C1) => {
    const halls = A1 - A0 > C1 - C0 ? [[A0, (A0 + A1) / 2 + 4, C0, C1]] : [[A0, A1, C0, (C0 + C1) / 2 + 4]];
    for (const [a2, b2, c2, d2] of halls) {
      const h = srange(8, 11);
      bGeos[3].push(buildingGeo(a2 + 0.6, b2 - 0.6, c2 + 0.6, d2 - 0.6, 0.2, h, spick(['#b9c2c9', '#c9b99a', '#9fb0bd', '#d0d0c8']), '#5d6266', 0));
      addBox(a2 + 0.6, b2 - 0.6, c2 + 0.6, d2 - 0.6, h);
      // roller doors + roof sheds
      plain.push(cbox(Math.min(8, b2 - a2 - 4), 5, 0.3, (a2 + b2) / 2, 2.7, c2 + 0.5, '#4a5058'));
      for (let k = 0; k < 3; k++) plain.push(cbox(b2 - a2 - 1.4, 0.8, 1.2, (a2 + b2) / 2, h + 0.4, c2 + 3 + k * ((d2 - c2 - 6) / 2), '#7a8288'));
    }
    // yard
    const yx0 = A1 - A0 > C1 - C0 ? (A0 + A1) / 2 + 5 : A0 + 1, yx1 = A1 - 1;
    const yz0 = A1 - A0 > C1 - C0 ? C0 + 1 : (C0 + C1) / 2 + 5, yz1 = C1 - 1;
    plain.push(cbox(yx1 - yx0, 0.03, yz1 - yz0, (yx0 + yx1) / 2, 0.22, (yz0 + yz1) / 2, '#55585c'));
    for (let x = yx0; x <= yx1; x += 2.5) metal.push(cbox(0.06, 2, 0.06, x, 1.2, yz1, '#8a9096'));
    metal.push(cbox(yx1 - yx0, 0.05, 0.05, (yx0 + yx1) / 2, 2.1, yz1, '#8a9096'));
    addBox(yx0, yx1, yz1 - 0.1, yz1 + 0.1, 2.2);
    const cc = ['#c0392b', '#2471a3', '#1e8449', '#d68910'];
    if (yx1 - yx0 > 8) { plain.push(cbox(2.45, 2.6, 6, yx0 + 2, 1.5, (yz0 + yz1) / 2, spick(cc))); addBox(yx0 + 0.75, yx0 + 3.25, (yz0 + yz1) / 2 - 3, (yz0 + yz1) / 2 + 3, 2.8); }
    if (srand() < 0.6) world.parkSpots.push({ x: (yx0 + yx1) / 2 + 2, z: (yz0 + yz1) / 2, h: srand() * 6, model: 'van' });
  };

  // ---- the bank: hollow building with hall, counter and vault ----
  const buildBank = (lx0, lx1, lz0, lz1, cx) => {
    const bx0 = lx0 + 4, bx1 = lx1 - 4, bz0 = lz0 + 13, bz1 = lz1 - 0.2;
    // customer car park between the street and the bank steps
    plain.push(cbox(bx1 - bx0 + 6, 0.03, 6.2, cx, 0.225, lz0 + 3.2, '#45484d'));
    for (let x = bx0 - 1.5; x <= bx1 + 1.6; x += 3.1) {
      if (Math.abs(x - cx) < 4.2) continue;
      mark.push(cbox(0.14, 0.02, 5.2, x, 0.245, lz0 + 3.2, '#e8e8e8'));
      const sx = x + 1.55;
      if (Math.abs(sx - cx) > 4.2 && sx < bx1 + 1.6 && srand() < 0.7) world.parkSpots.push({ x: sx, z: lz0 + 3.1, h: srand() < 0.5 ? 0 : Math.PI, model: null });
    }
    mark.push(cbox(bx1 - bx0 + 6, 0.02, 0.14, cx, 0.245, lz0 + 5.9, '#e8e8e8'));
    const T = 0.8, HH = 14, CEIL = 9;
    const stone = '#e8dfcc', stone2 = '#d6ccb6';
    const wallBox = (x0, x1, z0, z1, h = HH, col = stone) => {
      plain.push(cbox(x1 - x0, h, z1 - z0, (x0 + x1) / 2, h / 2 + 0.1, (z0 + z1) / 2, col));
      addBox(x0, x1, z0, z1, h);
    };
    const doorW = 3.2;
    // outer walls (door gap in the south wall)
    wallBox(bx0, cx - doorW, bz0, bz0 + T);
    wallBox(cx + doorW, bx1, bz0, bz0 + T);
    plain.push(cbox(doorW * 2, HH - 5.5, T, cx, 5.5 + (HH - 5.5) / 2, bz0 + T / 2, stone));
    addBox(cx - doorW, cx + doorW, bz0, bz0 + T, HH, { y0: 5.4 });
    wallBox(bx0, bx1, bz1 - T, bz1);
    wallBox(bx0, bx0 + T, bz0, bz1 - T);
    wallBox(bx1 - T, bx1, bz0, bz1 - T);
    // roof slab (ceiling inside at y = CEIL)
    plain.push(cbox(bx1 - bx0 + 0.6, HH - CEIL, bz1 - bz0 + 0.6, (bx0 + bx1) / 2, CEIL + (HH - CEIL) / 2, (bz0 + bz1) / 2, '#b8ae98'));
    addBox(bx0, bx1, bz0, bz1, HH + 0.4, { y0: CEIL });
    // facade: columns, steps, pediment, windows
    for (let k = 0; k < 8; k++) {
      const x = bx0 + 2 + k * ((bx1 - bx0 - 4) / 7);
      if (Math.abs(x - cx) < doorW + 0.8) continue;
      plain.push(ccyl(0.7, 0.8, 10.5, 12, x, 5.5, bz0 - 2.2, '#f2ecdf'));
      addCirc(x, bz0 - 2.2, 0.8, 11);
    }
    plain.push(cbox(bx1 - bx0 + 1, 1.2, 4.2, (bx0 + bx1) / 2, 11.3, bz0 - 2, stone2));
    plain.push(cbox(bx1 - bx0 + 1, 0.25, 6, (bx0 + bx1) / 2, 0.3, bz0 - 3, '#cfc6b2'));
    plain.push(cbox(bx1 - bx0 + 1, 0.25, 4, (bx0 + bx1) / 2, 0.55, bz0 - 2, '#d8cfbb'));
    {
      const sh = new THREE.Shape();
      const hw = (bx1 - bx0) / 2 + 0.5;
      sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, 3.6); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 4.2, bevelEnabled: false });
      g.deleteAttribute('uv');
      g.translate((bx0 + bx1) / 2, 11.9, bz0 - 4.1);
      colorize(g, stone2);
      plain.push(g);
    }
    for (const side of [bx0 - 0.05, bx1 + 0.05]) for (let k = 0; k < 4; k++) plain.push(cbox(0.15, 4, 2.4, side, 4.5, bz0 + 6 + k * 7, '#2b3a4a'));
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(20, 2.4), new THREE.MeshBasicMaterial({ map: neonSign('DILDI BANK', '#ffd700', { size: 150, bg: '#2a2008' }), toneMapped: false }));
    sg.position.set(cx, 8.2, bz0 - 0.08);
    sg.rotation.y = Math.PI;
    scene.add(sg);
    world.signMats.push(sg.material);
    // interior: marble floor, counter, pillars, lamps
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0 - 2 * T, bz1 - bz0 - 2 * T), new THREE.MeshStandardMaterial({ color: '#cfc3ae', roughness: 0.3, metalness: 0.1 }));
    fl.rotation.x = -Math.PI / 2;
    fl.position.set((bx0 + bx1) / 2, 0.215, (bz0 + bz1) / 2);
    fl.receiveShadow = true;
    scene.add(fl);
    const counterZ = bz0 + 11;
    plain.push(cbox(bx1 - bx0 - 12, 1.2, 1.2, (bx0 + bx1) / 2 - 4, 0.8, counterZ, '#6b4a2f'));
    plain.push(cbox(bx1 - bx0 - 12, 0.1, 1.4, (bx0 + bx1) / 2 - 4, 1.45, counterZ, '#2b2b2b'));
    for (let k = 0; k < 5; k++) plain.push(cbox(0.06, 1.4, 1.2, bx0 + 6 + k * 5, 2.2, counterZ, '#a8c8e0'));
    addBox(bx0 + 2, bx1 - 10, counterZ - 0.6, counterZ + 0.6, 1.4);
    for (const [px, pz] of [[bx0 + 8, bz0 + 5.5], [bx1 - 8, bz0 + 5.5], [bx0 + 8, bz0 + 16], [bx1 - 8, bz0 + 16]]) {
      plain.push(ccyl(0.6, 0.6, CEIL, 12, px, CEIL / 2, pz, '#f2ecdf'));
      addCirc(px, pz, 0.6, CEIL);
    }
    // vault wall with a round door – behind it a long, narrow strongroom
    const vz = bz0 + 19.5;
    const VW = 6.4; // half width of the strongroom
    for (const sx of [-1, 1]) {
      wallBox(cx + sx * VW - (sx > 0 ? 0 : 0.8), cx + sx * VW + (sx > 0 ? 0.8 : 0), vz, bz1, CEIL, '#5f6064');
      // dead space beside the vault is solid (no hidden rooms)
      const a0 = sx > 0 ? cx + VW + 0.8 : bx0 + T, a1 = sx > 0 ? bx1 - T : cx - VW - 0.8;
      plain.push(cbox(a1 - a0, CEIL, bz1 - vz, (a0 + a1) / 2, CEIL / 2 + 0.1, (vz + bz1) / 2, '#6d6d70'));
      addBox(a0, a1, vz, bz1, CEIL);
    }
    wallBox(bx0, cx - 2.2, vz - 0.6, vz + 0.6, CEIL, '#6d6d70');
    wallBox(cx + 2.2, bx1, vz - 0.6, vz + 0.6, CEIL, '#6d6d70');
    plain.push(cbox(4.4, CEIL - 4.4, 1.2, cx, 4.4 + (CEIL - 4.4) / 2, vz, '#6d6d70'));
    const doorCol = addBox(cx - 2.2, cx + 2.2, vz - 0.6, vz + 0.6, 4.4);
    const vdoor = new THREE.Group();
    const dm = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.3, metalness: 0.85 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.7, 32), dm);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(2.1, 0, 0);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.1, 8, 24), new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.3 }));
    wheel.position.set(2.1, 0, -0.45);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.08), wheel.material); sp.rotation.z = (k * Math.PI) / 3; sp.position.copy(wheel.position); vdoor.add(sp); }
    vdoor.add(disc, wheel);
    vdoor.position.set(cx - 2.1, 2.3, vz - 0.65);
    disc.castShadow = true;
    scene.add(vdoor);
    // vault contents
    const gold = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.25, emissive: '#3a2a00' });
    const cashM = new THREE.MeshStandardMaterial({ color: '#3fae5a', roughness: 0.7 });
    const loot = [];
    for (const [ox, oz] of [[-2.2, 4], [2.2, 8.5], [0, 12.2]]) {
      const g = new THREE.Group();
      for (let q = 0; q < 6; q++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.45), q % 2 ? gold : cashM); b.position.set((q % 3) * 0.95 - 0.95, 0.4 + Math.floor(q / 3) * 0.36, 0); g.add(b); }
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.4), new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.6 }));
      table.position.y = 0.2;
      g.add(table);
      g.position.set(cx + ox, 0.2, vz + oz);
      scene.add(g);
      loot.push(g);
    }
    // gold shelves along both vault walls
    {
      const frame = [], bars = [];
      const z0s = vz + 1.6, z1s = bz1 - 1;
      for (const sx of [-1, 1]) {
        const xw = cx + sx * (VW - 0.55);
        for (let z = z0s; z <= z1s + 0.01; z += (z1s - z0s) / 4) frame.push(cbox(0.9, 4.2, 0.12, xw, 2.3, z, '#3b3e44'));
        for (let lv = 0; lv < 4; lv++) {
          const y = 0.5 + lv * 1.05;
          frame.push(cbox(0.95, 0.07, z1s - z0s, xw, y, (z0s + z1s) / 2, '#4a4d52'));
          for (let z = z0s + 0.35; z < z1s - 0.2; z += 0.5) {
            for (let q = 0; q < 2; q++) bars.push(cbox(0.42, 0.13, 0.22, xw - 0.22 + q * 0.44, y + 0.11, z, '#d4af37'));
            if ((lv + Math.round(z * 2)) % 3 === 0) bars.push(cbox(0.42, 0.13, 0.22, xw, y + 0.24, z, '#d4af37'));
          }
        }
        addBox(xw - 0.5, xw + 0.5, z0s, z1s, 4.4);
      }
      plain.push(...frame);
      const gm = new THREE.Mesh(merge(bars), gold);
      scene.add(gm);
    }
    // lamps
    const lampM = new THREE.MeshBasicMaterial({ color: '#fff3d0', toneMapped: false });
    for (const [lx, lz] of [[cx - 10, bz0 + 5], [cx + 10, bz0 + 5], [cx - 10, bz0 + 15], [cx + 10, bz0 + 15], [cx, vz + 3.5], [cx, vz + 8], [cx, vz + 12.5]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.8), lampM);
      l.position.set(lx, CEIL - 0.1, lz);
      scene.add(l);
    }
    world.interiors.push({ x0: bx0 + T, x1: bx1 - T, z0: bz0 + T, z1: bz1 - T, ceil: CEIL, floor: 0.2, name: 'bank' });
    world.bank = {
      cx, entrance: { x: cx, z: bz0 + 3 }, outside: { x: cx, z: bz0 - 7 }, vault: { x: cx, z: vz - 2.2 }, vz, counterZ,
      door: vdoor, doorCol, loot: loot.map((g) => ({ g, x: g.position.x, z: g.position.z, taken: false })),
      guards: [[cx - 12, bz0 + 4], [cx + 12, bz0 + 4], [cx - 14, counterZ + 3.5], [cx + 6, counterZ + 3.5], [cx + 15, vz - 2.5], [cx - 6, vz - 2.5]],
      x0: bx0, x1: bx1, z0: bz0, z1: bz1,
    };
    deco(scene, 'bank', { x0: bx0, x1: bx1, zFront: bz0, zBack: bz1, cx, h: HH });
    world.landmarks.push({ name: 'Dildi Bank', x: cx, z: (bz0 + bz1) / 2, icon: '🏦', color: '#ffd700' });
    world.bankHotspot = { x: cx, z: bz0 + 6, r: 7, n: 3, inside: true };
  };

  for (const blk of world.blocks) {
    const { bi, bj } = blk;
    const lx0 = blk.x0 + SW, lx1 = blk.x1 - SW, lz0 = blk.z0 + SW, lz1 = blk.z1 - SW;
    const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
    const type = special[`${bi},${bj}`];
    blk.type = type || 'city';
    // lamps along all 4 edges
    for (const edge of [0, 1, 2, 3]) {
      for (let t = 10; t < 56 - 8; t += 18) {
        let x, z, ang;
        if (edge === 0) { x = blk.x0 + t; z = blk.z0 + 0.7; ang = Math.PI; }
        else if (edge === 1) { x = blk.x0 + t; z = blk.z1 - 0.7; ang = 0; }
        else if (edge === 2) { x = blk.x0 + 0.7; z = blk.z0 + t; ang = -Math.PI / 2; }
        else { x = blk.x1 - 0.7; z = blk.z0 + t; ang = Math.PI / 2; }
        lampPos.push([x, z, ang]);
      }
    }
    const dist = Math.max(Math.abs(cx), Math.abs(cz)) / H;
    if (!type) {
      const district = bi <= 1 && bj >= 3 ? 'alt' : bi >= 3 && bi <= 4 && bj >= 1 && bj <= 3 ? 'bank' : bi <= 1 && bj <= 1 ? 'gewerbe' : 'mix';
      blk.district = district;
      // building areas (two halves when a side street splits the block)
      let areas;
      if (blk.split === 'v') { const m = (blk.x0 + blk.x1) / 2; areas = [[lx0, m - SSW - SW], [m + SSW + SW, lx1]].map(([a2, b2]) => [a2, b2, lz0, lz1]); }
      else if (blk.split === 'h') { const m = (blk.z0 + blk.z1) / 2; areas = [[lz0, m - SSW - SW], [m + SSW + SW, lz1]].map(([c2, d2]) => [lx0, lx1, c2, d2]); }
      else areas = [[lx0, lx1, lz0, lz1]];
      if (district !== 'alt' && district !== 'gewerbe' && srand() < 0.6 && !blk.split)
        for (let t = 19; t < 50; t += 18) {
          treePos.push([blk.x0 + t, blk.z0 + 2.2, 0.8]);
          treePos.push([blk.x0 + t, blk.z1 - 2.2, 0.8]);
        }
      for (const [A0, A1, C0, C1] of areas) {
        if (district === 'alt') buildAltstadt(A0, A1, C0, C1);
        else if (district === 'gewerbe') buildGewerbe(A0, A1, C0, C1);
        else if (district === 'bank') {
          // glass towers of the banking district
          const big = !blk.split && srand() < 0.5;
          const lots = big ? [[A0, A1, C0, C1]] : (A1 - A0 > C1 - C0 ? [[A0, (A0 + A1) / 2, C0, C1], [(A0 + A1) / 2, A1, C0, C1]] : [[A0, A1, C0, (C0 + C1) / 2], [A0, A1, (C0 + C1) / 2, C1]]);
          for (const [a2, b2, c2, d2] of lots) {
            const h = Math.round(srange(55, 110) / 3.5) * 3.5 + 0.2;
            const st = srand() < 0.8 ? 0 : 3;
            addBuilding(a2 + 0.6, b2 - 0.6, c2 + 0.6, d2 - 0.6, h, st, { shops: true, color: spick(['#ffffff', '#e6efff', '#dfe8f5', '#f0f0f0']) });
            if (srand() < 0.7) {
              const s2 = Math.min(b2 - a2, d2 - c2) * 0.18;
              const h2 = h + Math.round(srange(10, 30) / 3.5) * 3.5;
              bGeos[st].push(buildingGeo(a2 + 0.6 + s2, b2 - 0.6 - s2, c2 + 0.6 + s2, d2 - 0.6 - s2, h, h2, '#ffffff', '#555', 0.25));
              addBox(a2 + 0.6 + s2, b2 - 0.6 - s2, c2 + 0.6 + s2, d2 - 0.6 - s2, h2);
              world.roofLights.push(new THREE.Vector3((a2 + b2) / 2, h2 + 0.5, (c2 + d2) / 2));
            }
          }
        } else {
          const dist = Math.max(Math.abs(cx), Math.abs(cz)) / H;
          const layout = srand();
          const baseH = lerp(60, 14, dist);
          const lots = [];
          const w2 = A1 - A0, d2 = C1 - C0;
          if (layout < 0.2 && dist < 0.6 && w2 > 30 && d2 > 30) lots.push([A0, A1, C0, C1]);
          else if (layout < 0.55 || w2 < 30 || d2 < 30) {
            if (w2 >= d2) { const m = (A0 + A1) / 2; lots.push([A0, m, C0, C1], [m, A1, C0, C1]); }
            else { const m = (C0 + C1) / 2; lots.push([A0, A1, C0, m], [A0, A1, m, C1]); }
          } else {
            const m = (A0 + A1) / 2, mz = (C0 + C1) / 2;
            lots.push([A0, m, C0, mz], [m, A1, C0, mz], [A0, m, mz, C1], [m, A1, mz, C1]);
          }
          for (const [a2, b2, c2, d3] of lots) {
            let h = Math.round((baseH * srange(0.45, 1.35)) / 3.5) * 3.5 + 0.2;
            if ((b2 - a2) * (d3 - c2) > 1000) h *= 1.3;
            h = Math.max(h, 10.7);
            const style = h > 45 ? (srand() < 0.75 ? 0 : 3) : spick([1, 1, 2, 3, 3]);
            addBuilding(a2 + 0.6, b2 - 0.6, c2 + 0.6, d3 - 0.6, h, style, { shops: h < 60 || srand() < 0.5 });
          }
        }
      }
    } else if (type === 'park2') {
      // city park: lawn, crossing paths, pond, playground, benches, lots of trees
      const gm = new THREE.PlaneGeometry(lx1 - lx0 + 6, lz1 - lz0 + 6);
      gm.rotateX(-Math.PI / 2);
      gm.translate(cx, 0.21, cz);
      grass.push(gm);
      const diag = Math.hypot(lx1 - lx0, lz1 - lz0) + 4;
      plain.push(cbox(2.6, 0.04, diag, cx, 0.23, cz, '#c8b994', Math.atan2(lx1 - lx0, lz1 - lz0)));
      plain.push(cbox(2.6, 0.04, diag, cx, 0.23, cz, '#c8b994', -Math.atan2(lx1 - lx0, lz1 - lz0)));
      // pond with a little jetty
      const px = cx + (bi % 2 ? -11 : 11), pz = cz + (bj % 2 ? 11 : -11);
      plain.push(ccyl(7.4, 7.6, 0.3, 28, px, 0.2, pz, '#b9b4aa'));
      const pw = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.08, 28), new THREE.MeshStandardMaterial({ color: '#3d8fb5', roughness: 0.05, metalness: 0.3 }));
      pw.position.set(px, 0.36, pz);
      scene.add(pw);
      addCirc(px, pz, 7.6, 0.6);
      plain.push(cbox(1.4, 0.1, 4, px, 0.45, pz + (pz > cz ? -6 : 6), '#7a5634'));
      // playground on the opposite corner
      const qx = cx - (px - cx), qz = cz - (pz - cz);
      plain.push(cbox(9, 0.05, 9, qx, 0.23, qz, '#d9b48a'));
      plain.push(cbox(0.15, 2.6, 0.15, qx - 3, 1.3, qz - 2, '#e74c3c'), cbox(0.15, 2.6, 0.15, qx + 0.5, 1.3, qz - 2, '#e74c3c'), cbox(3.8, 0.15, 0.15, qx - 1.25, 2.6, qz - 2, '#e74c3c'));
      plain.push(cbox(0.6, 0.06, 0.3, qx - 2.2, 0.7, qz - 2, '#333'), cbox(0.6, 0.06, 0.3, qx - 0.3, 0.7, qz - 2, '#333'));
      plain.push(cbox(1.6, 1.8, 1.6, qx + 2.5, 0.9, qz + 2, '#3498db'), cbox(0.9, 0.08, 3.4, qx + 2.5, 1.0, qz + 4.2, '#f1c40f', 0, -0.5));
      addBox(qx + 1.7, qx + 3.3, qz + 1.2, qz + 2.8, 1.8);
      // benches along the paths
      for (const [a, b, r] of [[-9, -5, 0.6], [9, 5, 0.6 + Math.PI], [-5, 9, -0.9], [5, -9, Math.PI - 0.9]]) {
        const bx = cx + a, bz = cz + b;
        benchGeos.push(cbox(2.2, 0.12, 0.6, bx, 0.65, bz, '#8b5a2b', r));
        benchGeos.push(cbox(2.2, 0.5, 0.1, bx + Math.sin(r) * -0.3, 0.95, bz + Math.cos(r) * -0.3, '#8b5a2b', r));
      }
      for (let k = 0; k < 34; k++) {
        const x = srange(lx0, lx1), z = srange(lz0, lz1);
        if (Math.hypot(x - px, z - pz) < 10 || Math.hypot(x - qx, z - qz) < 8) continue;
        const u = (x - cx) / (lx1 - lx0), w2 = (z - cz) / (lz1 - lz0);
        if (Math.abs(u - w2) < 0.06 || Math.abs(u + w2) < 0.06) continue;
        treePos.push([x, z, srange(0.8, 1.5)]);
      }
    } else if (type === 'park') {
      const gm = new THREE.PlaneGeometry(lx1 - lx0 + 6, lz1 - lz0 + 6);
      gm.rotateX(-Math.PI / 2);
      gm.translate(cx, 0.21, cz);
      grass.push(gm);
      // paths
      plain.push(cbox(lx1 - lx0 + 6, 0.04, 3, cx, 0.23, cz, '#c8b994'));
      plain.push(cbox(3, 0.04, lz1 - lz0 + 6, cx, 0.23, cz, '#c8b994'));
      // fountain
      plain.push(ccyl(5, 5.3, 0.8, 24, cx, 0.6, cz, '#b9b4aa'));
      const wtr = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.1, 24), new THREE.MeshStandardMaterial({ color: '#3d8fb5', roughness: 0.05, metalness: 0.3 }));
      wtr.position.set(cx, 0.95, cz);
      scene.add(wtr);
      plain.push(ccyl(0.6, 0.9, 2.6, 12, cx, 1.5, cz, '#a9a49a'));
      plain.push(ccyl(1.8, 1.2, 0.4, 16, cx, 2.8, cz, '#b9b4aa'));
      addCirc(cx, cz, 5.3, 1);
      world.fountain = new THREE.Vector3(cx, 3, cz);
      for (let k = 0; k < 28; k++) {
        let x = srange(lx0, lx1), z = srange(lz0, lz1);
        if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
        if (Math.hypot(x - cx, z - cz) < 9) continue;
        treePos.push([x, z, srange(0.9, 1.5)]);
      }
      // benches
      for (const [bx, bz, r] of [[cx - 8, cz + 3, 0], [cx + 8, cz - 3, Math.PI], [cx + 3, cz + 8, Math.PI / 2], [cx - 3, cz - 8, -Math.PI / 2]]) {
        benchGeos.push(cbox(2.2, 0.12, 0.6, bx, 0.65, bz, '#8b5a2b', r));
        benchGeos.push(cbox(2.2, 0.5, 0.1, bx + Math.sin(r) * -0.3, 0.95, bz + Math.cos(r) * -0.3, '#8b5a2b', r));
      }
      world.landmarks.push({ name: 'Stadtpark', x: cx, z: cz, icon: '🌳', color: '#3cb371' });
      world.spawn = new THREE.Vector3(cx + 12, 0.2, cz - 2);
      world.pickups.push({ type: 'health', x: cx + 6, z: cz + 6 });
      world.pickups.push({ type: 'ammo', x: cx - 6, z: cz - 6 });
    } else if (type === 'casino') {
      const x0 = lx0 + 2, x1 = lx1 - 2, z0 = lz0 + 6, z1 = lz1 - 2;
      bGeos[0].push(buildingGeo(x0, x1, z0, z1, 0.2, 22, '#ffd27a', '#3a2a10', 0));
      addBox(x0, x1, z0, z1, 22);
      // gold base and pillars
      plain.push(cbox(x1 - x0 + 1, 5, z1 - z0 + 1, cx, 2.7, (z0 + z1) / 2, '#1a1206'));
      addBox(x0 - 0.5, x1 + 0.5, z0 - 0.5, z1 + 0.5, 5);
      for (let k = 0; k < 8; k++) metal.push(cbox(0.8, 5, 0.8, x0 + 2 + k * ((x1 - x0 - 4) / 7), 2.7, z0 - 1.5, '#d4af37'));
      // canopy
      metal.push(cbox(x1 - x0 - 2, 0.5, 4, cx, 5.5, z0 - 1.8, '#d4af37'));
      // red carpet
      plain.push(cbox(4, 0.03, 8, cx, 0.22, z0 - 4, '#a3121b'));
      // big neon sign facing -z (road)
      const s = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), new THREE.MeshBasicMaterial({ map: neonSign('DILDILYNE', '#ff3df0', { size: 170 }), toneMapped: false }));
      s.position.set(cx, 14, z0 - 0.25);
      s.rotation.y = Math.PI;
      scene.add(s);
      world.signMats.push(s.material);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.2), new THREE.MeshBasicMaterial({ map: neonSign('★ CASINO ★', '#ffd700', { size: 150 }), toneMapped: false }));
      s2.position.set(cx, 7.4, z0 - 0.25);
      s2.rotation.y = Math.PI;
      scene.add(s2);
      world.signMats.push(s2.material);
      world.casinoBulbs = { x0, x1, z: z0 - 3.9, y: 5.85 };
      // palms
      for (const px of [x0 + 1, x1 - 1]) treePos.push([px, z0 - 5, 1.2, 'palm']);
      deco(scene, 'casino', { x0, x1, z0, z1, h: 22 });
      world.landmarks.push({ name: 'Casino Dildilyne', x: cx, z: cz, icon: '🎰', color: '#ff3df0' });
    } else if (type === 'tower') {
      const s = 13;
      bGeos[0].push(buildingGeo(cx - s, cx + s, cz - s, cz + s, 0.2, 120, '#7b8794', '#222', 0));
      addBox(cx - s, cx + s, cz - s, cz + s, 120);
      bGeos[0].push(buildingGeo(cx - 9, cx + 9, cz - 9, cz + 9, 120, 140, '#5c6670', '#222', 0.5));
      addBox(cx - 9, cx + 9, cz - 9, cz + 9, 140);
      metal.push(cbox(0.5, 22, 0.5, cx, 151, cz, '#999'));
      world.towerTop = new THREE.Vector3(cx, 162, cz);
      for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: neonSign('RADJ', '#ff2a2a', { size: 190, w: 512, h: 128, border: false }), toneMapped: false }));
        sg.position.set(cx + Math.sin(r) * 9.3, 134, cz + Math.cos(r) * 9.3);
        sg.rotation.y = r;
        scene.add(sg);
        world.signMats.push(sg.material);
      }
      // plaza
      plain.push(cbox(lx1 - lx0, 0.05, lz1 - lz0, cx, 0.22, cz, '#8f8a84'));
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) treePos.push([cx + a * 19, cz + b * 19, 1.0]);
      deco(scene, 'tower', { cx, cz });
      world.landmarks.push({ name: 'Radj Tower', x: cx, z: cz, icon: '🏢', color: '#ff2a2a' });
    } else if (type === 'police') {
      const x0 = lx0 + 4, x1 = lx1 - 4, z0 = lz0 + 16, z1 = lz1 - 2;
      bGeos[1].push(buildingGeo(x0, x1, z0, z1, 0.2, 14.2, '#eef2f8', '#444', 0));
      addBox(x0, x1, z0, z1, 14.2);
      plain.push(cbox(x1 - x0 + 0.2, 1.2, 0.3, cx, 4.5, z0 - 0.1, '#1f4fa8'));
      plain.push(cbox(x1 - x0 + 0.2, 1.2, 0.3, cx, 9.5, z0 - 0.1, '#1f4fa8'));
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: neonSign('POLIZEI', '#3d8bff', { size: 160, w: 1024, h: 200 }), toneMapped: false }));
      sg.position.set(cx, 12, z0 - 0.3);
      sg.rotation.y = Math.PI;
      scene.add(sg);
      world.signMats.push(sg.material);
      plain.push(cbox(lx1 - lx0, 0.03, 14, cx, 0.22, lz0 + 7, '#4a4d52'));
      world.parkSpots.push({ x: cx - 6, z: lz0 + 7, h: 0, model: 'police' }, { x: cx + 6, z: lz0 + 7, h: 0, model: 'police' });
      world.policeHQ = new THREE.Vector3(cx, 0, lz0 + 4);
      world.landmarks.push({ name: 'Polizeiwache', x: cx, z: cz, icon: '🚓', color: '#3d8bff' });
      world.pickups.push({ type: 'armor', x: lx1 - 3, z: lz0 + 3 });
    } else if (type === 'pizza') {
      // neighbours
      addBuilding(lx0 + 0.6, lx1 - 0.6, cz + 2, lz1 - 0.6, 24.7, 2, { shops: true });
      const x0 = lx0 + 4, x1 = lx1 - 18, z0 = lz0 + 6, z1 = cz - 2;
      bGeos[2].push(buildingGeo(x0, x1, z0, z1, 0.2, 7.2, '#fff1dc', '#7a2a1a', 0));
      addBox(x0, x1, z0, z1, 7.2);
      deco(scene, 'pizza', { x0, x1, z0, z1, h: 7.2 });
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.6), new THREE.MeshBasicMaterial({ map: neonSign('PIZZA CAPRI', '#ff5a1f', { size: 120 }), toneMapped: false }));
      sg.position.set((x0 + x1) / 2, 5.6, z0 - 0.25);
      sg.rotation.y = Math.PI;
      scene.add(sg);
      world.signMats.push(sg.material);
      for (let k = 0; k < 3; k++) {
        plain.push(ccyl(0.5, 0.5, 0.06, 12, x0 + 3 + k * 4, 0.95, z0 - 4, '#ffffff'));
        plain.push(ccyl(0.06, 0.06, 0.75, 6, x0 + 3 + k * 4, 0.57, z0 - 4, '#333'));
      }
      plain.push(cbox(lx1 - x1 - 1, 0.03, cz - lz0 - 4, (x1 + lx1) / 2, 0.22, (lz0 + cz) / 2, '#4a4d52'));
      world.pizza = { x: x1 + 5, z: lz0 + 4, spawn: { x: x1 + 9, z: lz0 + 13, h: 0 } };
      world.parkSpots.push({ x: x1 + 14, z: lz0 + 10, h: 0, model: 'roller', decor: true });
      world.landmarks.push({ name: 'Pizza Capri', x: (x0 + x1) / 2, z: (z0 + z1) / 2, icon: '🍕', color: '#ff5a1f' });
    } else if (type === 'hospital') {
      const x0 = lx0 + 3, x1 = lx1 - 3, z0 = lz0 + 3, z1 = lz1 - 12;
      bGeos[1].push(buildingGeo(x0, x1, z0, z1, 0.2, 28.2, '#ffffff', '#555', 0));
      addBox(x0, x1, z0, z1, 28.2);
      plain.push(cbox(6, 6, 0.4, cx, 24, z1 + 0.2, '#ffffff'));
      plain.push(cbox(4.5, 1.3, 0.5, cx, 24, z1 + 0.3, '#e02020'));
      plain.push(cbox(1.3, 4.5, 0.5, cx, 24, z1 + 0.3, '#e02020'));
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshBasicMaterial({ map: neonSign('KRANKENHAUS', '#ff4040', { size: 120 }), toneMapped: false }));
      sg.position.set(cx, 4.5, z1 + 0.25);
      scene.add(sg);
      world.signMats.push(sg.material);
      world.hospital = new THREE.Vector3(cx, 0.2, lz1 - 4);
      world.landmarks.push({ name: 'Krankenhaus', x: cx, z: cz, icon: '🏥', color: '#ff4040' });
    } else if (type === 'gas') {
      plain.push(cbox(lx1 - lx0, 0.03, lz1 - lz0, cx, 0.22, cz, '#4b4e53'));
      // canopy
      metal.push(cbox(26, 0.9, 14, cx, 6, cz, '#e8e8e8'));
      plain.push(cbox(26.2, 0.5, 14.2, cx, 5.5, cz, '#d4141c'));
      for (const [a, b] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) {
        metal.push(cbox(0.5, 5.4, 0.5, cx + a, 2.9, cz + b, '#dddddd'));
        addCirc(cx + a, cz + b, 0.4, 5);
      }
      for (const a of [-6, 0, 6]) {
        plain.push(cbox(1, 1.8, 0.7, cx + a, 1.1, cz, '#d4141c'));
        plain.push(cbox(1.1, 0.4, 0.8, cx + a, 2.1, cz, '#ffffff'));
        addBox(cx + a - 0.5, cx + a + 0.5, cz - 0.35, cz + 0.35, 2);
      }
      world.gasLight = new THREE.Vector3(cx, 5.4, cz);
      // shop
      bGeos[1].push(buildingGeo(lx0 + 2, lx1 - 2, lz1 - 10, lz1 - 1, 0.2, 5.2, '#ffffff', '#444', 0));
      addBox(lx0 + 2, lx1 - 2, lz1 - 10, lz1 - 1, 5.2);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(10, 2), new THREE.MeshBasicMaterial({ map: neonSign('DILDI TANKE', '#ffffff', { size: 120, bg: '#c4121a' }), toneMapped: false }));
      sg.position.set(cx, 6.1, cz - 7.1);
      sg.rotation.y = Math.PI;
      scene.add(sg);
      world.signMats.push(sg.material);
      world.parkSpots.push({ x: cx - 3, z: cz - 3, h: 0.0, model: 'rs6' });
      world.landmarks.push({ name: 'Tankstelle', x: cx, z: cz, icon: '⛽', color: '#ffd000' });
      world.pickups.push({ type: 'ak', x: lx0 + 4, z: lz1 - 12 });
    } else if (type === 'hideout') {
      addBuilding(lx0 + 0.6, cx - 2, lz0 + 0.6, lz1 - 0.6, 21.2, 2, { shops: true });
      // the hideout: old workshop with garage doors and a yard
      const x0 = cx + 6, x1 = lx1 - 2, z0 = cz - 4, z1 = lz1 - 2;
      bGeos[2].push(buildingGeo(x0, x1, z0, z1, 0.2, 8.2, '#d8cbb8', '#3a3a3a', 0));
      addBox(x0, x1, z0, z1, 8.2);
      for (let k = 0; k < 2; k++) plain.push(cbox(5.2, 4, 0.3, x0 + 5 + k * 7.5, 2.2, z0 - 0.1, '#30353b'));
      for (let k = 0; k < 2; k++) for (let r = 0; r < 5; r++) plain.push(cbox(5.2, 0.08, 0.34, x0 + 5 + k * 7.5, 0.7 + r * 0.75, z0 - 0.12, '#4a5058'));
      plain.push(cbox(lx1 - cx - 2, 0.03, cz - lz0 - 2, (cx + 2 + lx1) / 2, 0.22, (lz0 + cz - 4) / 2, '#4a4d52'));
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.2), new THREE.MeshBasicMaterial({ map: neonSign('VERSTECK', '#39ff88', { size: 150 }), toneMapped: false }));
      sg.position.set((x0 + x1) / 2, 6.6, z0 - 0.25);
      sg.rotation.y = Math.PI;
      scene.add(sg);
      world.signMats.push(sg.material);
      world.hideout = new THREE.Vector3((x0 + x1) / 2, 0.2, z0 - 6);
      world.coupBoard = { x: x1 - 2.5, z: z0 - 1.4 };
      world.garages.push({ name: 'Garage Versteck', x: x0 + 8.75, z: z0 - 2.5, ry: Math.PI, spawn: { x: x0 + 8.75, z: z0 - 11, h: Math.PI }, building: false });
      world.landmarks.push({ name: 'Versteck', x: (x0 + x1) / 2, z: (z0 + z1) / 2, icon: '🏠', color: '#39ff88' });
      world.pickups.push({ type: 'armor', x: x1 - 2, z: z0 - 3 }, { type: 'health', x: x0 + 1, z: z0 - 3 });
    } else if (type === 'bank') {
      buildBank(lx0, lx1, lz0, lz1, cx);
    } else if (type === 'depot') {
      // Flaschenpost depot: green hall + yard with vans
      const hx0 = lx0 + 1, hx1 = lx1 - 1, hz0 = cz + 2, hz1 = lz1 - 1;
      bGeos[3].push(buildingGeo(hx0, hx1, hz0, hz1, 0.2, 10.2, '#cfe8d2', '#3d5a40', 0));
      addBox(hx0, hx1, hz0, hz1, 10.2);
      for (let k = 0; k < 3; k++) plain.push(cbox(7, 5.4, 0.3, hx0 + 8 + k * 14, 2.9, hz0 - 0.1, '#2e7d3a'));
      plain.push(cbox(lx1 - lx0, 0.03, cz - lz0, cx, 0.22, (lz0 + cz) / 2, '#4a4d52'));
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.2), new THREE.MeshBasicMaterial({ map: neonSign('🍾 FLASCHENPOST', '#3dff6a', { size: 120, bg: '#0d2412' }), toneMapped: false }));
      sg.position.set(cx, 8, hz0 - 0.25);
      sg.rotation.y = Math.PI;
      scene.add(sg);
      world.signMats.push(sg.material);
      deco(scene, 'depot', { x0: hx0, x1: hx1, z0: hz0, z1: hz1, h: 10.2 });
      world.depot = { x: cx, z: lz0 + 8, spawn: { x: cx - 10, z: lz0 + 8, h: Math.PI } };
      world.parkSpots.push({ x: cx + 12, z: cz - 6, h: Math.PI / 2, model: 'van', color: '#f5f5f5', decor: true }, { x: cx + 12, z: cz - 14, h: Math.PI / 2, model: 'van', color: '#6a1fb5', decor: true });
      world.landmarks.push({ name: 'Flaschenpost', x: cx, z: cz, icon: '🍾', color: '#3dff6a' });
    } else if (type === 'customs') {
      // Dildi Customs: tuning workshop, drive in from the west road
      const hx0 = cx - 6, hx1 = lx1 - 1, hz0 = lz0 + 2, hz1 = lz1 - 2;
      bGeos[3].push(buildingGeo(hx0, hx1, hz0, hz1, 0.2, 11.2, '#2b2b33', '#111', 0));
      addBox(hx0, hx1, hz0, hz1, 11.2);
      plain.push(cbox(lx1 - lx0, 0.03, lz1 - lz0, cx, 0.22, cz, '#3a3a42'));
      for (let k = 0; k < 3; k++) {
        plain.push(cbox(0.3, 6, 9, hx0 - 0.1, 3.1, hz0 + 7 + k * 14, '#121216'));
        plain.push(cbox(0.32, 0.25, 9.2, hx0 - 0.12, 6.2, hz0 + 7 + k * 14, '#ff3df0'));
      }
      for (let k = 0; k < 6; k++) plain.push(cbox(0.6, 0.02, 3, lx0 + 6, 0.24, lz0 + 6 + k * 8, '#ffd23b'));
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(4, 18), new THREE.MeshBasicMaterial({ map: neonSign('DILDI CUSTOMS', '#ff3df0', { size: 140 }), toneMapped: false }));
      sg.geometry.dispose();
      sg.geometry = new THREE.PlaneGeometry(18, 4);
      sg.position.set(hx0 - 0.3, 8.8, cz);
      sg.rotation.y = -Math.PI / 2;
      scene.add(sg);
      world.signMats.push(sg.material);
      deco(scene, 'customs', { x0: hx0, x1: hx1, z0: hz0, z1: hz1, h: 11.2 });
      world.customs = { x: lx0 + 9, z: cz, door: hx0 };
      world.landmarks.push({ name: 'Dildi Customs', x: cx, z: cz, icon: '🎨', color: '#ff3df0' });
    } else if (type === 'market') {
      // market square: stalls, fountain, trees
      plain.push(cbox(lx1 - lx0 + 6, 0.04, lz1 - lz0 + 6, cx, 0.22, cz, '#b8a88e'));
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if ((i + j) % 2 === 0) plain.push(cbox(6.6, 0.02, 6.6, cx + i * 7, 0.25, cz + j * 7, '#a8977b'));
      plain.push(ccyl(3.2, 3.5, 0.7, 20, cx, 0.55, cz, '#c9c1b2'));
      plain.push(ccyl(0.4, 0.6, 3.6, 10, cx, 2, cz, '#b0a898'));
      addCirc(cx, cz, 3.5, 0.9);
      const wtr = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.1, 20), new THREE.MeshStandardMaterial({ color: '#3d8fb5', roughness: 0.05, metalness: 0.3 }));
      wtr.position.set(cx, 0.88, cz);
      scene.add(wtr);
      const stallCols = ['#c0392b', '#2471a3', '#f1c40f', '#27ae60', '#e67e22', '#8e44ad'];
      let k = 0;
      for (const [sx, sz] of [[-15, -14], [-5, -15], [5, -15], [15, -14], [-15, 14], [-5, 15], [5, 15], [15, 14]]) {
        const x = cx + sx, z = cz + sz;
        plain.push(cbox(4, 0.9, 2, x, 0.65, z, '#8b5a2b'));
        plain.push(cbox(4.4, 0.12, 2.6, x, 2.6, z, stallCols[k++ % stallCols.length], 0, sz > 0 ? 0.15 : -0.15));
        for (const [a2, b2] of [[-1.9, -1], [1.9, -1], [-1.9, 1], [1.9, 1]]) metal.push(cbox(0.08, 2.5, 0.08, x + a2, 1.35, z + b2, '#5a4a3a'));
        for (let q = 0; q < 4; q++) plain.push(cbox(0.5, 0.35, 0.5, x - 1.4 + q * 0.95, 1.25, z, spick(['#e74c3c', '#f39c12', '#27ae60', '#f1c40f', '#ecf0f1'])));
        addBox(x - 2, x + 2, z - 1, z + 1, 1.2);
      }
      for (const [a2, b2] of [[-20, 0], [20, 0], [0, -22], [0, 22]]) treePos.push([cx + a2, cz + b2, 1.1]);
      world.landmarks.push({ name: 'Marktplatz', x: cx, z: cz, icon: '🛍️', color: '#f1c40f' });
      world.marketHotspot = { x: cx, z: cz, r: 20, n: 8 };
    } else if (type === 'parking' || type === 'parking2') {
      plain.push(cbox(lx1 - lx0, 0.03, lz1 - lz0, cx, 0.22, cz, '#45484d'));
      for (let k = 0; k < 6; k++)
        for (const row of [-1, 1]) {
          const x = lx0 + 5 + k * 7.5;
          mark.push(dash(x - 3.6, cz + row * 9, 0.15, 6));
          if (srand() < 0.55) world.parkSpots.push({ x, z: cz + row * 9, h: row > 0 ? 0 : Math.PI, model: null });
        }
      // small kiosk
      bGeos[2].push(buildingGeo(lx1 - 8, lx1 - 1, lz0 + 1, lz0 + 7, 0.2, 4.2, '#ffffff', '#444', 0));
      addBox(lx1 - 8, lx1 - 1, lz0 + 1, lz0 + 7, 4.2);
      // the NW lot already shows up as 'Garage Nordwest' – only one P per place
      if (type === 'parking2') world.garages.push({ name: 'Garage Nordost', x: lx0 + 9, z: cz, ry: Math.PI / 2, spawn: { x: lx0 + 17, z: cz, h: Math.PI / 2 }, building: true });
      if (type === 'parking') world.garages.push({ name: 'Garage Nordwest', x: lx0 + 9, z: cz, ry: Math.PI / 2, spawn: { x: lx0 + 17, z: cz, h: Math.PI / 2 }, building: true });
    }
  }
  // ---------- the wall of houses around the city ----------
  {
    const gaps = (axis, dir) => world.exits.filter((e) => e.axis === axis && e.dir === dir).map((e) => [e.c - RW - 1, e.c + RW + 1]);
    const span = (a0, a1, holes, fn) => {
      let t = a0;
      while (t < a1 - 1) {
        let w = Math.min(a1 - t, srange(16, 34));
        const hole = holes.find(([g0, g1]) => t < g1 && t + w > g0);
        if (hole) {
          if (t < hole[0] - 1) w = hole[0] - t;
          else { t = hole[1]; continue; }
        }
        if (w > 2) fn(t, t + w);
        t += w;
      }
    };
    const wallH = () => Math.round(srange(30, 82) / 3.5) * 3.5 + 0.2;
    const wb = (x0, x1, z0, z1) => {
      const h = wallH();
      const st = h > 55 ? spick([0, 0, 3]) : spick([1, 2, 3, 0]);
      addBuilding(x0 + 0.3, x1 - 0.3, z0, z1, h, st, { shops: true });
      if (h > 45 && srand() < 0.5) {
        const h2 = h + Math.round(srange(7, 20) / 3.5) * 3.5;
        bGeos[st].push(buildingGeo(x0 + 3, x1 - 3, z0 + 3, z1 - 3, h, h2, '#ffffff', '#555', 0.25));
        addBox(x0 + 3, x1 - 3, z0 + 3, z1 - 3, h2);
      }
    };
    for (const dir of [-1, 1]) {
      span(-WALL_OUT, WALL_OUT, gaps('z', dir), (a2, b2) => (dir > 0 ? wb(a2, b2, BOUND + 0.5, WALL_OUT) : wb(a2, b2, -WALL_OUT, -BOUND - 0.5)));
      span(-BOUND - 0.5, BOUND + 0.5, gaps('x', dir), (a2, b2) => {
        const h = wallH();
        const st = h > 55 ? 0 : spick([1, 2, 3]);
        const x0 = dir > 0 ? BOUND + 0.5 : -WALL_OUT, x1 = dir > 0 ? WALL_OUT : -BOUND - 0.5;
        addBuilding(x0, x1, a2 + 0.3, b2 - 0.3, h, st, { shops: true });
      });
    }
    // gate buildings bridging the main exits
    for (const e of world.exits) {
      if (e.axis === 'z' && e.c !== 0) continue;
      const out0 = e.dir > 0 ? BOUND + 0.5 : -WALL_OUT, out1 = e.dir > 0 ? WALL_OUT : -BOUND - 0.5;
      const a0 = e.c - RW - 1.2, a1 = e.c + RW + 1.2;
      const [x0, x1, z0, z1] = e.axis === 'z' ? [a0, a1, out0, out1] : [out0, out1, a0, a1];
      bGeos[1].push(buildingGeo(x0, x1, z0, z1, 9, 26.2, '#efe6d6', '#555', 0));
      addBox(x0, x1, z0, z1, 26.2, { y0: 9 });
      plain.push(cbox(x1 - x0, 0.6, z1 - z0, (x0 + x1) / 2, 8.9, (z0 + z1) / 2, '#8a8478'));
      const label = e.axis === 'z' ? '▼ HAFEN · FLUGHAFEN' : e.dir > 0 ? 'WESTWÜSTE' : 'OSTWÜSTE';
      for (const side of [-1, 1]) {
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.2), new THREE.MeshBasicMaterial({ map: neonSign(label, '#8fd3ff', { size: 110, bg: '#10233a' }), toneMapped: false }));
        const outer = side * e.dir > 0;
        if (e.axis === 'z') {
          sg.position.set(e.c, 7.6, outer ? (e.dir > 0 ? z1 : z0) + e.dir * 0.06 : (e.dir > 0 ? z0 : z1) - e.dir * 0.06);
          sg.rotation.y = (outer ? e.dir : -e.dir) > 0 ? 0 : Math.PI;
        } else {
          sg.position.set(outer ? (e.dir > 0 ? x1 : x0) + e.dir * 0.06 : (e.dir > 0 ? x0 : x1) - e.dir * 0.06, 7.6, e.c);
          sg.rotation.y = (outer ? e.dir : -e.dir) > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        scene.add(sg);
        world.signMats.push(sg.material);
      }
    }
  }

  buildOutskirts(scene, { ground, plain, metal, mark, dash, railSeg, addBox, addCirc, treePos, worldUV, lampPos, grass });
  // re-merge markings including parking lines
  markMesh.geometry.dispose();
  markMesh.geometry = merge(mark);

  // ---------- meshes ----------
  bGeos.forEach((list, i) => {
    if (!list.length) return;
    const m = new THREE.Mesh(merge(list, true), facadeMats[i]);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    world.buildingMesh.push(m);
  });
  const shopMesh = new THREE.Mesh(merge(shopGeos, true), shopMat);
  shopMesh.receiveShadow = true;
  shopMesh.castShadow = true;
  scene.add(shopMesh);

  const grassTex = noiseTex('#4f8f3a', 30, 128);
  if (grass.length) {
    const gm = new THREE.Mesh(merge(grass.map((g) => worldUV(g, 6)), true), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
    gm.receiveShadow = true;
    scene.add(gm);
  }

  // ---------- street lamps ----------
  const lampGeo = [];
  const headGeo = [];
  const poolGeo = [];
  // no lamp may stand on a driveable surface (side streets, other roads at junctions, gates)
  const onDrive = (x, z, yy) => {
    for (const st of world.sideStreets) if (x > st.x0 - 0.6 && x < st.x1 + 0.6 && z > st.z0 - 0.6 && z < st.z1 + 0.6) return true;
    for (const e of world.exits) {
      const along = e.axis === 'z' ? z * e.dir : x * e.dir, across = e.axis === 'z' ? x - e.c : z - e.c;
      if (along > H - 2 && Math.abs(across) < RW + 0.6) return true;
    }
    for (const r of ROADS) {
      const S = r.samples;
      if (!S) continue;
      const lim = r.w / 2 + 0.45;
      for (let i = 1; i < S.length; i++) {
        const a = S[i - 1], q = S[i];
        if (Math.min(a.x, q.x) - lim - 1 > x || Math.max(a.x, q.x) + lim + 1 < x || Math.min(a.z, q.z) - lim - 1 > z || Math.max(a.z, q.z) + lim + 1 < z) continue;
        const dx = q.x - a.x, dz = q.z - a.z, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
        const px = a.x + dx * t, pz = a.z + dz * t;
        const py = a.y === undefined ? undefined : a.y + (q.y - a.y) * t;
        if (Math.hypot(px - x, pz - z) < lim && (yy === undefined || py === undefined || Math.abs(py - yy) < 3)) return true;
      }
    }
    return false;
  };
  let lampsDropped = 0;
  for (const [x, z, ang, yy] of lampPos) {
    if (onDrive(x, z, yy)) { lampsDropped++; continue; }
    const ax = Math.sin(ang), az = Math.cos(ang); // arm toward road
    const y = yy === undefined ? groundY(x, z) : yy;
    lampGeo.push(ccyl(0.09, 0.13, 6.7, 6, x, y + 3.35, z, '#2c3238'));
    lampGeo.push(cbox(0.08, 0.08, 1.6, x + ax * 0.75, y + 6.65, z + az * 0.75, '#2c3238', ang));
    headGeo.push(cbox(0.55, 0.14, 0.32, x + ax * 1.5, y + 6.55, z + az * 1.5, '#fff1c8', ang));
    const pg = new THREE.CircleGeometry(4.2, 16);
    pg.rotateX(-Math.PI / 2);
    const py = yy === undefined ? groundY(x + ax * 1.6, z + az * 1.6) : yy;
    pg.translate(x + ax * 1.6, py + 0.1, z + az * 1.6);
    poolGeo.push(pg);
    addCirc(x, z, 0.18, y + 6, y - 1);
  }
  world.lampsDropped = lampsDropped;
  const lamps = new THREE.Mesh(merge(lampGeo), metalMat);
  lamps.castShadow = true;
  scene.add(lamps);
  const lampHeadMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  world.lampHeadMat = lampHeadMat;
  scene.add(new THREE.Mesh(merge(headGeo), lampHeadMat));
  const poolTex = canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,220,150,0.9)');
    g.addColorStop(0.5, 'rgba(255,200,120,0.35)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }, false);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  world.poolMat = poolMat;
  const pools = new THREE.Mesh(merge(poolGeo, true), poolMat);
  pools.renderOrder = 2;
  scene.add(pools);

  // ---------- traffic lights ----------
  const tlGeo = [];
  const bulbs = [];
  for (let i = 1; i < NB; i++)
    for (let j = 1; j < NB; j++) {
      const x = roadC(i), z = roadC(j);
      const L = { i, j, x, z, offset: srand() * 16, poles: [] };
      world.lights.push(L);
      // approaches: direction of travel d entering intersection
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        // pole at the near-right corner for traffic moving (dx,dz)
        const rx = -dz, rz = dx; // right of travel (see vehicles: right = (-cos h, sin h))
        const px = x - dx * (RW + 1.2) + -rx * 0 + (dz !== 0 ? -dz * -1 : 0) * 0;
        const cxp = x - dx * (RW + 0.8) - rz * 0 + (rx === 0 ? 0 : 0);
        void px; void cxp;
        // position: before intersection, on the right sidewalk corner
        const right = { x: dz === 0 ? 0 : -dz, z: dx === 0 ? 0 : dx };
        // compute right of travel for forward (dx,dz): right = (-fz, fx)?? forward (sin h, cos h), right (-cos h, sin h) => (-fz, fx)
        right.x = -dz; right.z = dx;
        const polex = x - dx * (RW + 0.9) + right.x * (RW + 0.9);
        const polez = z - dz * (RW + 0.9) + right.z * (RW + 0.9);
        tlGeo.push(ccyl(0.11, 0.14, 5.4, 6, polex, 2.9, polez, '#22282e'));
        // arm over lane
        const armLen = 4.2;
        const ang = Math.atan2(-right.x, -right.z);
        tlGeo.push(cbox(0.1, 0.1, armLen, polex - right.x * armLen / 2, 5.5, polez - right.z * armLen / 2, '#22282e', ang));
        const hx = polex - right.x * (armLen - 0.4), hz = polez - right.z * (armLen - 0.4);
        tlGeo.push(cbox(0.42, 1.25, 0.32, hx, 4.85, hz, '#15181b', Math.atan2(dx, dz)));
        // bulbs face incoming traffic (toward -d)
        for (let k = 0; k < 3; k++) {
          bulbs.push({ x: hx - dx * 0.17, y: 5.25 - k * 0.38, z: hz - dz * 0.17, axis: dx !== 0 ? 'x' : 'z', k, L });
        }
        // small pedestrian-height second head on pole
        tlGeo.push(cbox(0.3, 0.8, 0.25, polex, 2.6, polez, '#15181b', Math.atan2(dx, dz)));
        for (let k = 0; k < 3; k++) bulbs.push({ x: polex - dx * 0.13, y: 2.85 - k * 0.25, z: polez - dz * 0.13, axis: dx !== 0 ? 'x' : 'z', k, L, small: true });
        addCirc(polex, polez, 0.2, 5);
      }
    }
  const tlMesh = new THREE.Mesh(merge(tlGeo), plainMat);
  tlMesh.castShadow = true;
  scene.add(tlMesh);
  const bulbGeo = new THREE.OctahedronGeometry(0.17, 0);
  const bulbMesh = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), bulbs.length);
  const m4 = new THREE.Matrix4();
  bulbs.forEach((b, i) => {
    const s = b.small ? 0.7 : 1;
    m4.makeScale(s, s, s);
    m4.setPosition(b.x, b.y, b.z);
    bulbMesh.setMatrixAt(i, m4);
    bulbMesh.setColorAt(i, new THREE.Color('#222'));
  });
  scene.add(bulbMesh);
  world.bulbs = bulbs;
  world.bulbMesh = bulbMesh;

  // ---------- trees ----------
  const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6);
  trunkG.translate(0, 1.3, 0);
  const crownG = new THREE.IcosahedronGeometry(1.9, 1);
  crownG.translate(0, 3.9, 0);
  const palmLeaf = new THREE.ConeGeometry(2.6, 1.2, 7);
  palmLeaf.translate(0, 6.2, 0);
  const normalTrees = treePos.filter((t) => t[3] !== 'palm');
  const palms = treePos.filter((t) => t[3] === 'palm');
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1 }), normalTrees.length);
  const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }), normalTrees.length);
  const tc = new THREE.Color();
  normalTrees.forEach(([x, z, s], i) => {
    const y = groundY(x, z);
    m4.makeRotationY(srand() * 6);
    m4.scale(new THREE.Vector3(s, s * srange(0.85, 1.2), s));
    m4.setPosition(x, y, z);
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
    tc.setHSL(srange(0.22, 0.33), srange(0.4, 0.6), srange(0.25, 0.38));
    crowns.setColorAt(i, tc);
    addCirc(x, z, 0.3 * s, y + 3, y - 1);
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  scene.add(trunks, crowns);
  if (palms.length) {
    const pg = [];
    for (const [x, z] of palms) {
      const y = groundY(x, z);
      pg.push(ccyl(0.18, 0.3, 6.6, 6, x, y + 3.2, z, '#8a6a45'));
      const g = palmLeaf.clone();
      colorize(g, '#2f7d32');
      place(g, x, y, z);
      pg.push(g);
      addCirc(x, z, 0.35, y + 4, y - 1);
    }
    const pm = new THREE.Mesh(merge(pg), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    pm.castShadow = true;
    scene.add(pm);
  }

  // misc
  if (benchGeos.length) plain.push(...benchGeos);
  // bins + hydrants scattered
  for (const blk of world.blocks) {
    if (srand() < 0.6) {
      const x = blk.x0 + srange(8, 48), z = blk.z0 + 1.0;
      plain.push(ccyl(0.3, 0.3, 0.9, 8, x, 0.65, z, '#2e6b3f'));
      addCirc(x, z, 0.3, 1);
    }
    if (srand() < 0.5) {
      const x = blk.x1 - 1.0, z = blk.z0 + srange(8, 48);
      plain.push(ccyl(0.16, 0.2, 0.75, 8, x, 0.55, z, '#c0281c'));
      addCirc(x, z, 0.2, 1);
    }
  }
  const plainMesh = new THREE.Mesh(merge(plain), plainMat);
  plainMesh.castShadow = true;
  plainMesh.receiveShadow = true;
  scene.add(plainMesh);
  const metalMesh = new THREE.Mesh(merge(metal), metalMat);
  metalMesh.castShadow = true;
  scene.add(metalMesh);

  // roof aircraft lights (blinking red)
  const rl = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: '#ff2020', toneMapped: false }), world.roofLights.length + 1);
  world.roofLights.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y, p.z);
    rl.setMatrixAt(i, m4);
  });
  if (world.towerTop) {
    m4.makeScale(2, 2, 2);
    m4.setPosition(world.towerTop);
    rl.setMatrixAt(world.roofLights.length, m4);
  }
  world.roofLightMesh = rl;
  scene.add(rl);

  // casino marquee bulbs
  if (world.casinoBulbs) {
    const cb = world.casinoBulbs;
    const n = 40;
    const mi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    for (let k = 0; k < n; k++) {
      m4.makeTranslation(lerp(cb.x0 + 2, cb.x1 - 2, k / (n - 1)), cb.y, cb.z);
      mi.setMatrixAt(k, m4);
      mi.setColorAt(k, new THREE.Color('#ffd700'));
    }
    world.marquee = mi;
    scene.add(mi);
  }

  return world;
}

// ---------- traffic light state ----------
// returns 'g' | 'y' | 'r' for travel axis at intersection
export function lightState(L, axis, time) {
  const t = (time + L.offset) % 16;
  if (axis === 'z') return t < 7 ? 'g' : t < 8 ? 'y' : 'r';
  return t >= 8 && t < 15 ? 'g' : t >= 15 ? 'y' : 'r';
}
export function lightAt(i, j) {
  if (i <= 0 || j <= 0 || i >= NB || j >= NB) return null;
  return world.lights[(i - 1) * (NB - 1) + (j - 1)];
}
const COLS = { r: [new THREE.Color('#ff2a1a'), new THREE.Color('#3a0a08')], y: [new THREE.Color('#ffb000'), new THREE.Color('#3a2a05')], g: [new THREE.Color('#25ff5a'), new THREE.Color('#062a10')] };
let lastLightUpdate = -1;
export function updateLights(time) {
  const q = Math.floor(time * 4);
  if (q === lastLightUpdate) return;
  lastLightUpdate = q;
  const order = ['r', 'y', 'g'];
  world.bulbs.forEach((b, i) => {
    const s = lightState(b.L, b.axis, time);
    const me = order[b.k];
    world.bulbMesh.setColorAt(i, COLS[me][s === me ? 0 : 1]);
  });
  world.bulbMesh.instanceColor.needsUpdate = true;
}
