// Geography: terrain height, road layout and elevated decks (flyover).
import * as THREE from 'three';
import './dildi_cars.js'; // Nicks Modelle (liefert u. a. die Straßen des Dildi-Kreuzes) – vor den Straßen laden

export const WALL_OUT = 246; // outer edge of the building wall around the city
export const COAST_Z = -420; // south land ends here (sea beyond)
export const ISLAND = { x0: -230, x1: 230, z0: -700, z1: -470 };
export const BRIDGE_S = { x0: -8, x1: 8, z0: -472, z1: -418 };
// two desert halves left and right of the city
export const DESERTS = [
  { x: -490, z: 10, rx: 170, rz: 285, name: 'Ostwüste' },
  { x: 490, z: 10, rx: 170, rz: 285, name: 'Westwüste' },
];
export const LAKE = { x: -520, z: 40, r: 48, y: 9 };
export const WORLD = { x0: -700, x1: 700, z0: -760, z1: 440 };

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function mNoise(x, z) {
  return 34 + 22 * Math.sin(x * 0.021 + 0.7) * Math.cos(z * 0.017 - 0.3) + 14 * Math.sin(x * 0.047 + z * 0.031) + 8 * Math.sin(x * 0.093 - z * 0.071 + 1.1) + 4 * Math.sin(x * 0.17 + z * 0.13);
}
function dunes(x, z) {
  return 11 + 3.6 * Math.sin(x * 0.019 + 1.3) * Math.sin(z * 0.016 + 0.4) + 2.2 * Math.sin(x * 0.027 + z * 0.021 + 0.5) + 1.1 * Math.sin(x * 0.05 - z * 0.043 + 2.1);
}
// 0 inside a desert, 1 outside
function desertE(x, z) {
  let e = 9;
  for (const D of DESERTS) {
    const ex = (x - D.x) / D.rx, ez = (z - D.z) / D.rz;
    e = Math.min(e, ex * ex + ez * ez);
  }
  return e;
}
// mountain envelope 0..1
function envelope(x, z) {
  if (z < -WALL_OUT) return ss(150, 215, Math.abs(x)); // flat land around the Kreuz, hills at the sides
  return ss(0.82, 1.18, desertE(x, z));
}
export function rawH(x, z) {
  if (Math.abs(x) <= WALL_OUT && Math.abs(z) <= WALL_OUT) return 0;
  const env = envelope(x, z);
  const base = z < -WALL_OUT ? 0 : dunes(x, z) * (1 - env * 0.6);
  // gentler mountains around the deserts (were up to ~80 m, now ~45 m max)
  let h = base + env * mNoise(x, z) * 0.55;
  // keep the foot of the mountains low right next to the city wall
  const wd = Math.max(Math.abs(x), Math.abs(z)) - WALL_OUT;
  if (wd < 30 && z >= -WALL_OUT) h *= lerp(0.35, 1, ss(0, 30, wd));
  const d = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (d < LAKE.r + 30) h = lerp(LAKE.y - 3.5, h, ss(LAKE.r - 14, LAKE.r + 30, d));
  return h;
}

// ---------------- roads ----------------
// kind: road (asphalt), dirt, deck (elevated, own heights)
// yMode: 'given' uses y from points, 'terrain' follows smoothed terrain, 'pass' climbs from the city over a pass
export const ROADS = [];
const R = (name, pts, o = {}) => { const r = { name, pts, w: o.w || 11, kind: o.kind || 'road', yMode: o.yMode || (pts[0].length > 2 ? 'given' : 'terrain'), fall: o.fall || 18, traffic: o.traffic !== false, lamps: o.lamps, bump: o.bump || 7, oneway: !!o.oneway, ring: !!o.ring }; ROADS.push(r); return r; };

// --- mountain passes from the west/east city exits into the two deserts ---
R('Pass West-Süd', [[-236, -68], [-264, -69], [-294, -80], [-324, -68], [-352, -82], [-372, -94]], { yMode: 'pass', fall: 30, lamps: true, bump: 7, w: 14 });
R('Pass West-Nord', [[-236, 68], [-264, 69], [-294, 80], [-324, 68], [-352, 82], [-374, 90]], { yMode: 'pass', fall: 30, lamps: true, bump: 8, w: 14 });
R('Pass Ost-Süd', [[236, -68], [264, -67], [294, -56], [324, -70], [350, -58], [370, -60]], { yMode: 'pass', fall: 30, lamps: true, bump: 7, w: 14 });
R('Pass Ost-Nord', [[236, 68], [264, 67], [294, 56], [324, 72], [350, 60], [372, 66]], { yMode: 'pass', fall: 30, lamps: true, bump: 8, w: 14 });
// --- west desert ---
R('Westring', [[-372, -94], [-420, -150], [-490, -200], [-570, -160], [-618, -60], [-612, 70], [-570, 180], [-490, 240], [-410, 200], [-374, 90]]);
R('Westquer', [[-372, -94], [-420, -70], [-440, -10], [-434, 50], [-374, 90]]);
R('Seezufahrt', [[-440, -10], [-462, 4]], { kind: 'dirt', w: 7, traffic: false });
R('Hof West', [[-618, -60], [-626, -98], [-634, -126], [-648, -132], [-652, -124]], { kind: 'dirt', w: 7, traffic: false });
R('Hügelweg', [[-601, 100], [-572, 108], [-546, 112], [-540, 118]], { kind: 'dirt', w: 7, traffic: false });
// --- east desert ---
R('Ostring', [[370, -60], [420, -140], [500, -205], [585, -150], [622, -40], [610, 90], [560, 190], [480, 240], [404, 180], [372, 66]]);
R('Ostquer', [[370, -60], [430, 0], [372, 66]]);
R('Landebahn-Zufahrt', [[430, 0], [452, 40], [446, 70]], { w: 9 });
R('Camp-Piste', [[585, -150], [570, -196], [540, -220]], { kind: 'dirt', w: 7, traffic: false });
R('Ranch-Weg', [[622, -40], [640, 0], [646, 24], [646, 32]], { kind: 'dirt', w: 7, traffic: false });
R('Gehöft-Weg', [[480, 240], [502, 256], [516, 262], [520, 266]], { kind: 'dirt', w: 7, traffic: false });

// --- south: harbour road + compact flyover "Dildi-Kreuz" ---
R('Hafenstraße', [[0, -236, 0], [0, -290, 0], [0, -350, 0], [0, -400, 0], [0, -416, 0]], { w: 12, lamps: true });
// Dildi-Kreuz (Nicks Modell, dildi_cars.js): Hochstraße y=9 bei z=-322 + 4 Kleeblatt-Schleifen auf die Hafenstraße.
// Gezeichnet wird es vom Spiel selbst (Fahrbahn, Schutzwände mit Lücken an den Einmündungen, Pfeiler),
// die Deko (Schilderbrücken, Rasthof, Motel, Skatepark, Plakate) kommt aus dildiKreuz.decor() in outskirts.js.
for (const r of globalThis.DildiCars.dildiKreuz.roads()) R(r.name, r.pts, r.opts);
// island roads (flat)
// the Brückenstraße × Kaistraße crossing is a roundabout (HAFENKREISEL); the roads end at its arms
export const HAFENKREISEL = { x: 0, z: -560, r: 17, w: 9 };
R('Brückenstraße', [[0, -416, 0], [0, -472, 0], [0, -520, 0], [0, -541, 0]], { w: 12, lamps: true });
R('Brückenstraße Süd', [[0, -579, 0], [0, -595, 0], [0, -610, 0]], { w: 12, lamps: true });
R('Kaistraße West', [[-215, -560, 0], [-140, -560, 0], [-60, -560, 0], [-19, -560, 0]], { w: 11, lamps: true });
R('Kaistraße Ost', [[19, -560, 0], [70, -560, 0], [150, -560, 0], [191, -560, 0]], { w: 11, lamps: true });
// ring order (right-hand traffic, right turn in first like the other roundabouts): north → east → south → west → north
R('Hafenkreisel', Array.from({ length: 21 }, (_, k) => { const t = (k / 20) * Math.PI * 2; return [HAFENKREISEL.x + HAFENKREISEL.r * Math.sin(t), HAFENKREISEL.z + HAFENKREISEL.r * Math.cos(t), 0]; }), { w: HAFENKREISEL.w, oneway: true, ring: true });
R('Dockring', [[-60, -560, 0], [-66, -610, 0], [-110, -645, 0], [-170, -640, 0], [-210, -600, 0], [-215, -560, 0]], { w: 10 });
// roundabout at the end of the Brückenstraße (was a dead end where cars tried to turn on the spot).
// One-way ring, counter-clockwise from above (right-hand traffic): start at the top, east, south, west, back to the top.
export const KREISEL = { x: 0, z: -632, r: 20, w: 10 };
// turning loop at the airport end of the Kaistraße (one-way, right turn in first like the roundabout)
export const WENDE = { x: 205, z: -560, r: 14, w: 9 };
R('Wendeschleife Flughafen', Array.from({ length: 15 }, (_, k) => { const t = (k / 14) * Math.PI * 2; return [WENDE.x - Math.cos(t) * WENDE.r, WENDE.z + Math.sin(t) * WENDE.r, 0]; }), { w: WENDE.w, oneway: true, ring: true });
// bus stop in front of the airport terminal (east-bound lane of the Kaistraße) and the loading spot at the cranes
export const BUS_STOP = { x: 110, z: -557 };
export const TRUCK_STOP = { x: -110, z: -645 };
R('Kreisverkehr', Array.from({ length: 17 }, (_, k) => { const t = (k / 16) * Math.PI * 2; return [KREISEL.x + Math.sin(t) * KREISEL.r, KREISEL.z + Math.cos(t) * KREISEL.r, 0]; }), { w: KREISEL.w, oneway: true, ring: true });

// ---------------- sampling ----------------
export function sampleRoad(r) {
  const given = r.yMode === 'given';
  const pts = r.pts.map((p) => new THREE.Vector3(p[0], given ? p[2] : 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const len = curve.getLength();
  const n = Math.max(4, Math.ceil(len / 3));
  const P = curve.getSpacedPoints(n);
  const S = [];
  for (let i = 0; i <= n; i++) {
    const t = curve.getTangentAt(Math.min(1, i / n));
    S.push({ x: P[i].x, z: P[i].z, y: P[i].y, h: Math.atan2(t.x, t.z), w: r.w });
  }
  r.samples = S;
  r.len = len;
  r.curve = curve;
}

// ---------------- flatten grid ----------------
const G = { x0: WORLD.x0, z0: -440, cs: 4 };
G.nx = Math.ceil((WORLD.x1 - G.x0) / G.cs) + 1;
G.nz = Math.ceil((WORLD.z1 - G.z0) / G.cs) + 1;
const FW = new Float32Array(G.nx * G.nz);
const FY = new Float32Array(G.nx * G.nz);
const SQ = new Float32Array(G.nx * G.nz);
const SY = new Float32Array(G.nx * G.nz);
function stamp(x, z, y, r0, r1) {
  const i0 = Math.max(0, Math.floor((x - r1 - G.x0) / G.cs)), i1 = Math.min(G.nx - 1, Math.ceil((x + r1 - G.x0) / G.cs));
  const j0 = Math.max(0, Math.floor((z - r1 - G.z0) / G.cs)), j1 = Math.min(G.nz - 1, Math.ceil((z + r1 - G.z0) / G.cs));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const cx = G.x0 + i * G.cs, cz = G.z0 + j * G.cs;
      const d = Math.hypot(cx - x, cz - z);
      if (d > r1) continue;
      const w = d <= r0 ? 1 : 1 - ss(0, 1, (d - r0) / (r1 - r0));
      const k = j * G.nx + i;
      // weight = strongest influence, height = blend of all roads/pads (smooth junctions)
      const q = Math.exp(-(d * d) / 18) * w + 1e-9;
      SQ[k] += q;
      SY[k] += q * y;
      if (w > FW[k]) FW[k] = w;
      FY[k] = SY[k] / SQ[k];
    }
}
// flat building areas in the outskirts. y is taken from the terrain (after roads) unless a group shares it
export const POI = {
  tanke: { x: 428, z: -82, r: 24 },
  lakeJetty: { x: -462, z: 4, r: 10 },
  village: { x: -470, z: -205, r: 36 },
  camp: { x: 532, z: -226, r: 26 },
  hofNW: { x: -652, z: -104, r: 30 },
  hofNO: { x: 646, z: 50, r: 30 },
  hofS: { x: 520, z: 285, r: 30 },
  hofHuegel: { x: -540, z: 136, r: 30 },
  villa: { x: -470, z: 268, r: 36 },
  runway: { x: 520, z: 85, r: 0 },
};
export const RUNWAY = { x0: 440, x1: 600, z0: 70, z1: 100 };
export const PADS = [];

let built = false;
export function buildGeo() {
  if (built) return;
  built = true;
  for (const r of ROADS) sampleRoad(r);
  // terrain-following roads: smoothed height profile, snapped to junctions
  const done = [];
  for (const r of ROADS) {
    if (r.yMode === 'pass') {
      // from y=0 at the city gap up over a pass and down to the desert floor
      const S = r.samples;
      const yEnd = rawH(S[S.length - 1].x, S[S.length - 1].z);
      const L = S.length - 1;
      S.forEach((p, i) => {
        const t = i / L;
        const tt = ss(0.12, 1, t);
        p.y = Math.max(0, yEnd * tt + Math.sin(Math.PI * tt) * r.bump);
      });
    }
    if (r.yMode === 'terrain') {
      const S = r.samples;
      let ys = S.map((s) => Math.max(rawH(s.x, s.z), LAKE.y + 0.5));
      for (let pass = 0; pass < 3; pass++) {
        const o = ys.slice();
        for (let i = 0; i < ys.length; i++) {
          let a = 0, c = 0;
          for (let k = -7; k <= 7; k++) { const v = o[Math.min(ys.length - 1, Math.max(0, i + k))]; a += v; c++; }
          ys[i] = a / c;
        }
      }
      // snap ends to roads already done
      for (const end of [0, S.length - 1]) {
        let best = null, bd = 14;
        for (const o of done) for (const s of o.samples) { const d = Math.hypot(s.x - S[end].x, s.z - S[end].z); if (d < bd) { bd = d; best = s; } }
        if (best) {
          const span = Math.min(20, S.length - 1);
          for (let k = 0; k <= span; k++) {
            const i = end === 0 ? k : S.length - 1 - k;
            ys[i] = lerp(best.y, ys[i], ss(0, 1, k / span));
          }
        }
      }
      S.forEach((s, i) => (s.y = ys[i]));
    }
    done.push(r);
  }
  // stamp roads + pads into the flatten grid
  for (const r of ROADS) {
    if (r.kind === 'deck') continue;
    for (const s of r.samples) stamp(s.x, s.z, s.y, r.w / 2 + 6, r.w / 2 + 6 + r.fall);
  }
  // POI pads take the height the terrain has after the roads are flattened
  for (const k in POI) {
    const p = POI[k];
    if (!p.r) continue;
    p.y = terrainH(p.x, p.z);
    PADS.push({ x: p.x, z: p.z, r: p.r, y: p.y, fall: 24 });
  }
  // the abandoned runway is one flat plate
  RUNWAY.y = terrainH((RUNWAY.x0 + RUNWAY.x1) / 2, (RUNWAY.z0 + RUNWAY.z1) / 2);
  for (let x = RUNWAY.x0 + 10; x <= RUNWAY.x1 - 10; x += 16) PADS.push({ x, z: (RUNWAY.z0 + RUNWAY.z1) / 2, r: 28, y: RUNWAY.y, fall: 26 });
  POI.runway.y = RUNWAY.y;
  for (const p of PADS) stamp(p.x, p.z, p.y, p.r, p.r + p.fall);
  buildDeckIndex();
}

export function terrainH(x, z) {
  const raw = rawH(x, z);
  const fx = (x - G.x0) / G.cs, fz = (z - G.z0) / G.cs;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= G.nx - 1 || j >= G.nz - 1) return raw;
  const tx = fx - i, tz = fz - j;
  const k = j * G.nx + i;
  const b = [(1 - tx) * (1 - tz), tx * (1 - tz), (1 - tx) * tz, tx * tz];
  const ks = [k, k + 1, k + G.nx, k + G.nx + 1];
  let w = 0, wy = 0;
  for (let q = 0; q < 4; q++) { w += FW[ks[q]] * b[q]; wy += FW[ks[q]] * FY[ks[q]] * b[q]; }
  if (w < 1e-4) return raw;
  return lerp(raw, wy / w, Math.min(1, w));
}

// ---------------- decks (elevated roads) ----------------
const DCELL = 10;
const deckIdx = new Map();
const dkey = (cx, cz) => (cx + 500) * 2000 + (cz + 500);
function buildDeckIndex() {
  for (const r of ROADS) {
    if (r.kind !== 'deck') continue;
    const S = r.samples;
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1];
      const seg = { a, b, w: r.w, r };
      const x0 = Math.min(a.x, b.x) - r.w, x1 = Math.max(a.x, b.x) + r.w, z0 = Math.min(a.z, b.z) - r.w, z1 = Math.max(a.z, b.z) + r.w;
      for (let cx = Math.floor(x0 / DCELL); cx <= Math.floor(x1 / DCELL); cx++)
        for (let cz = Math.floor(z0 / DCELL); cz <= Math.floor(z1 / DCELL); cz++) {
          const k = dkey(cx, cz);
          if (!deckIdx.has(k)) deckIdx.set(k, []);
          deckIdx.get(k).push(seg);
        }
    }
  }
}
// highest deck surface at (x,z) that is not above refY + step
export function deckAt(x, z, refY, step = 1.1) {
  const l = deckIdx.get(dkey(Math.floor(x / DCELL), Math.floor(z / DCELL)));
  if (!l) return -1e9;
  // per deck road only its nearest segment counts (clamped to the segment ends, so there is no gap on the
  // outer side of curves where cars used to drop through); between different decks the highest usable wins
  const near = new Map();
  for (const s of l) {
    const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z;
    const L2 = abx * abx + abz * abz;
    const t = Math.min(1, Math.max(0, ((x - s.a.x) * abx + (z - s.a.z) * abz) / (L2 + 1e-9)));
    const d = Math.hypot(x - (s.a.x + abx * t), z - (s.a.z + abz * t));
    if (d > s.w / 2 + 0.4) continue;
    const y = s.a.y + (s.b.y - s.a.y) * t;
    if (y > refY + step) continue;
    const o = near.get(s.r);
    if (!o || d < o.d - 1e-6) near.set(s.r, { d, y });
  }
  let best = -1e9;
  for (const o of near.values()) if (o.y > best) best = o.y;
  return best;
}

// ---------------- Radj-Insel (far south, only reachable by plane) ----------------
export const RADJ = { x: 0, z: -1225, rx: 255, rz: 205 };
export const RADJ_CELLAR = { x0: 300, x1: 332, z0: -1252, z1: -1208, y: -40 };
export function radjE(x, z) { const ex = (x - RADJ.x) / RADJ.rx, ez = (z - RADJ.z) / RADJ.rz; return ex * ex + ez * ez; }
export const RADJ_STRIP = { x0: -140, x1: 74, z0: -1092, z1: -1066 };
export const RADJ_ESTATE = { x0: -40, x1: 120, z0: -1400, z1: -1270 };
export function radjGround(x, z) {
  if (x > RADJ_CELLAR.x0 && x < RADJ_CELLAR.x1 && z > RADJ_CELLAR.z0 && z < RADJ_CELLAR.z1) return RADJ_CELLAR.y;
  const e = radjE(x, z);
  if (e > 1.15) return -6;
  // the airstrip and the estate are perfectly flat, the rest gently rolling
  const S = RADJ_STRIP, E = RADJ_ESTATE;
  const ds = Math.max(S.x0 - x, x - S.x1, S.z0 - z, z - S.z1, 0), de = Math.max(E.x0 - x, x - E.x1, E.z0 - z, z - E.z1, 0);
  const flat = Math.min(1, Math.min(ds, de) / 14);
  const h = 3.2 + flat * (0.7 * Math.sin(x * 0.03) * Math.cos(z * 0.025) + 0.4 * Math.sin(x * 0.07 + z * 0.05));
  return lerp(h, -6, ss(0.86, 1.12, e));
}
export function inRadj(x, z) { return z < -930; }

export function inIsland(x, z) { return x >= ISLAND.x0 && x <= ISLAND.x1 && z >= ISLAND.z0 && z <= ISLAND.z1; }
export function onBridgeS(x, z) { return x >= BRIDGE_S.x0 && x <= BRIDGE_S.x1 && z >= BRIDGE_S.z0 && z <= BRIDGE_S.z1; }
// ground outside the city (terrain, island, bridge, sea)
export function outerGround(x, z) {
  if (inIsland(x, z) || onBridgeS(x, z)) return 0;
  if (inRadj(x, z)) return radjGround(x, z);
  if (z < COAST_Z) return -6;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 5) return LAKE.y - 3; // in the lake
  return terrainH(x, z);
}
// slope (rise per meter) of the terrain
export function slopeAt(x, z) {
  const e = 1.2;
  const dx = terrainH(x + e, z) - terrainH(x - e, z);
  const dz = terrainH(x, z + e) - terrainH(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}
export { ss as smoothstep };
