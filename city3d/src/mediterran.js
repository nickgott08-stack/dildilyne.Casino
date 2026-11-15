// mediterran.js – Mediterrane Bauteile im realistischen Stil (Torbögen, Bogengang, Pavillon)
// Vorbild: Nicks Foto (Villa an der Steilküste): ockerfarbener Putz, Travertin-Gesimse,
// Rundbögen mit Bogenstein-Ring und Schlussstein, Balustraden, Walmdächer aus Mönch-Nonne-Ziegeln.
//
// Alles wird per Code erzeugt (keine Dateien). Texturen = Canvas mit passender Normal-Map.
// Jede Funktion gibt eine THREE.Group zurück: ein Mesh pro Material (wenige Draw-Calls),
// dazu group.userData.colliders = [{x, z, w, d, ry}] (Grundriss-Kästen, lokal) für die Kollision.
//
//   torbogen(opts)   – freistehender Torbogen (z. B. Einfahrt), ~6,6 × 7,4 m
//   bogengang(opts)  – Arkade mit n Bögen, Pultdach oder Terrasse mit Balustrade
//   pavillon(opts)   – zweistöckiger Pavillon: unten Bögen, oben offene Loggia, Walmdach
//
// Vorne = +z, Boden = y 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- Texturen
let _mats = null;
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Höhenfeld (Float32, 0..1) -> Normal-Map-Canvas
function normalCanvas(hf, S, strength) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const l = hf[y * S + ((x - 1 + S) % S)], r = hf[y * S + ((x + 1) % S)];
      const u = hf[((y - 1 + S) % S) * S + x], d = hf[((y + 1) % S) * S + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const n = Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      img.data[i] = (nx / n * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / n * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / n * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
// kachelbares Wert-Rauschen (mehrere Oktaven)
function noiseField(S, seed, octaves = 5, base = 4) {
  const R = rng(seed), out = new Float32Array(S * S);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const g = base << o, grid = new Float32Array(g * g);
    for (let i = 0; i < g * g; i++) grid[i] = R();
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const fx = (x / S) * g, fy = (y / S) * g, x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = grid[y0 * g + x0], b = grid[y0 * g + ((x0 + 1) % g)];
        const c = grid[((y0 + 1) % g) * g + x0], d = grid[((y0 + 1) % g) * g + ((x0 + 1) % g)];
        out[y * S + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    tot += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function tex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function paint(S, hf, colorAt) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, col = colorAt(x, y, hf[i]);
      img.data[i * 4] = col[0];
      img.data[i * 4 + 1] = col[1];
      img.data[i * 4 + 2] = col[2];
      img.data[i * 4 + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
const mix = (a, b, t) => a + (b - a) * t;
const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Kalkputz: warmes Ocker mit Flecken, feiner Körnung, leichter Abnutzung (1 Kachel = 4 m)
function stuccoTex() {
  const S = 512, n = noiseField(S, 11, 6, 3), g = noiseField(S, 12, 2, 64), st = noiseField(S, 13, 4, 2);
  const hf = new Float32Array(S * S);
  for (let i = 0; i < hf.length; i++) hf[i] = n[i] * 0.4 + g[i] * 0.6;
  const map = paint(S, hf, (x, y, h) => {
    const i = y * S + x, m = n[i], s = cl((st[i] - 0.45) * 3);
    const k = 0.86 + m * 0.22 + (g[i] - 0.5) * 0.08;
    let r = 214 * k, gg = 176 * k, b = 112 * k;               // Ocker
    r = mix(r, 186, s * 0.35); gg = mix(gg, 160, s * 0.35); b = mix(b, 122, s * 0.35); // ausgeblichene Flecken
    return [r, gg, b];
  });
  return { map: tex(map, true), normalMap: tex(normalCanvas(hf, S, 2.2)) };
}
// Travertin / Sandstein für Gesimse, Bögen, Balustraden (1 Kachel = 2 m)
function stoneTex() {
  const S = 512, n = noiseField(S, 21, 5, 4), v = noiseField(S, 22, 3, 2);
  const hf = new Float32Array(S * S);
  const R = rng(23), pores = new Float32Array(S * S);
  for (let k = 0; k < 900; k++) {
    const px = Math.floor(R() * S), py = Math.floor(R() * S), len = 2 + Math.floor(R() * 9);
    for (let j = 0; j < len; j++) pores[py * S + ((px + j) % S)] = 1;      // Travertin-Poren (waagrecht)
  }
  for (let i = 0; i < hf.length; i++) hf[i] = n[i] * 0.6 - pores[i] * 0.5;
  const map = paint(S, hf, (x, y, h) => {
    const i = y * S + x, band = Math.sin((y / S) * Math.PI * 14 + v[i] * 6) * 0.5 + 0.5;
    const k = 0.84 + n[i] * 0.2 + band * 0.05 - pores[i] * 0.22;
    return [232 * k, 214 * k, 178 * k];
  });
  return { map: tex(map, true), normalMap: tex(normalCanvas(hf, S, 3.0)) };
}
// Mönch-Nonne-Ziegel (Coppi): 8 Ziegelreihen nebeneinander, 6 Lagen; 1 Kachel = 2 × 2,4 m
function roofTex() {
  const S = 512, cols = 8, rows = 6, n = noiseField(S, 31, 5, 4), lich = noiseField(S, 32, 4, 3);
  const R = rng(33), tint = [];
  for (let i = 0; i < cols * rows; i++) tint.push([0.85 + R() * 0.25, R()]);
  const hf = new Float32Array(S * S), shade = new Float32Array(S * S), idx = new Int32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const cw = S / cols, rh = S / rows;
      const cx = Math.floor(x / cw), fx = (x % cw) / cw;
      const shift = cx % 2 ? 0.5 : 0;                         // Lagen versetzt
      const ry = y / rh + shift, ri = Math.floor(ry), fy = ry - ri;
      const prof = Math.sin(fx * Math.PI);                   // gewölbter Ziegel
      const lap = fy < 0.12 ? fy / 0.12 : 1;                  // Überlappung: Kante wirft Stufe
      const i = y * S + x;
      hf[i] = prof * 0.8 * (0.75 + 0.25 * lap) + n[i] * 0.1;
      shade[i] = (0.55 + 0.45 * prof) * (fy < 0.07 ? 0.55 : 1) * (fx < 0.04 || fx > 0.96 ? 0.45 : 1);
      idx[i] = (cx * rows + (((ri % rows) + rows) % rows)) % (cols * rows);
    }
  const map = paint(S, hf, (x, y) => {
    const i = y * S + x, t = tint[idx[i]], k = shade[i] * t[0] * (0.88 + n[i] * 0.24);
    let r = mix(196, 168, t[1]) * k, g = mix(112, 86, t[1]) * k, b = mix(62, 52, t[1]) * k;
    const l = cl((lich[i] - 0.6) * 4) * 0.5;                  // Flechten / Staub
    r = mix(r, 150, l); g = mix(g, 138, l); b = mix(b, 108, l);
    return [r, g, b];
  });
  return { map: tex(map, true), normalMap: tex(normalCanvas(hf, S, 6.0)) };
}
// Terrakotta-Bodenplatten für Böden/Terrassen (1 Kachel = 2 m, 5×5 Platten)
function floorTex() {
  const S = 512, N = 5, n = noiseField(S, 41, 4, 4), R = rng(42), tint = [];
  for (let i = 0; i < N * N; i++) tint.push(0.85 + R() * 0.25);
  const hf = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * N % 1, fy = (y / S) * N % 1;
      const joint = Math.min(fx, 1 - fx, fy, 1 - fy) < 0.03;
      hf[y * S + x] = joint ? 0 : 0.6 + n[y * S + x] * 0.3;
    }
  const map = paint(S, hf, (x, y, h) => {
    if (h === 0) return [150, 138, 118];
    const k = tint[Math.floor((y / S) * N) * N + Math.floor((x / S) * N)] * (0.9 + n[y * S + x] * 0.2);
    return [178 * k, 104 * k, 70 * k];
  });
  return { map: tex(map, true), normalMap: tex(normalCanvas(hf, S, 4.0)) };
}

// Buchsbaum-Hecke: dichtes kleines Laub (1 Kachel = 1 m)
function hedgeTex() {
  const S = 256, a = noiseField(S, 51, 3, 32), b = noiseField(S, 52, 4, 4);
  const hf = new Float32Array(S * S);
  for (let i = 0; i < hf.length; i++) hf[i] = a[i];
  const map = paint(S, hf, (x, y) => {
    const i = y * S + x, k = cl((a[i] - 0.3) * 2.2), l = 0.8 + b[i] * 0.4;
    return [mix(22, 86, k) * l, mix(44, 128, k) * l, mix(18, 52, k) * l];
  });
  return { map: tex(map, true), normalMap: tex(normalCanvas(hf, S, 5.0)) };
}
// Pool-Mosaik: 16×16 kleine blaue Fliesen (1 Kachel = 1,6 m)
function mosaicTex() {
  const S = 512, N = 16, n = noiseField(S, 61, 3, 8), R = rng(62), tint = [];
  for (let i = 0; i < N * N; i++) tint.push([R(), 0.85 + R() * 0.3]);
  const hf = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * N % 1, fy = (y / S) * N % 1;
      hf[y * S + x] = Math.min(fx, 1 - fx, fy, 1 - fy) < 0.07 ? 0 : 0.7;
    }
  const map = paint(S, hf, (x, y, h) => {
    if (h === 0) return [214, 226, 228];
    const t = tint[Math.floor((y / S) * N) * N + Math.floor((x / S) * N)], k = t[1] * (0.95 + n[y * S + x] * 0.1);
    return [mix(40, 96, t[0]) * k, mix(132, 186, t[0]) * k, mix(190, 222, t[0]) * k];
  });
  return { map: tex(map, true), normalMap: tex(normalCanvas(hf, S, 2.0)) };
}
function waterNormal() {
  const S = 256, t = tex(normalCanvas(noiseField(S, 71, 4, 6), S, 6.0));
  t.repeat.set(0.5, 0.5);
  return t;
}

export function mediterranMats() {
  if (_mats) return _mats;
  const st = stuccoTex(), sn = stoneTex(), rf = roofTex(), fl = floorTex();
  const m = (t, rough, nscale) => new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(nscale, nscale), roughness: rough, metalness: 0 });
  _mats = {
    stucco: m(st, 0.92, 0.6),
    stone: m(sn, 0.8, 0.7),
    roof: m(rf, 0.75, 1.0),
    floor: m(fl, 0.85, 0.6),
    iron: new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 0.55, metalness: 0.6 }),
    wood: new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.7 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#cfd4d8', roughness: 0.25, metalness: 0.7 }),
  };
  const hg = hedgeTex(), mo = mosaicTex(), wa = waterNormal();
  _mats.hedge = m(hg, 0.95, 1.2);
  _mats.mosaic = m(mo, 0.35, 0.4);
  _mats.water = new THREE.MeshStandardMaterial({ color: '#4cc3d8', transparent: true, opacity: 0.62, roughness: 0.06, metalness: 0.1, normalMap: wa, normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false });
  return _mats;
}

// ---------------------------------------------------------------- Geometrie-Helfer
// UV in Metern skaliert (u = m / tile)
function scaleUV(g, s) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / s, uv.getY(i) / s);
  return g;
}
// Box mit Welt-Meter-UV auf allen Seiten (Textur läuft nicht gestreckt)
function box(w, h, d, x, y, z, tile, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    if (ay > 0.5) uv.setXY(i, (px + x) / tile, (pz + z) / tile);
    else if (ax > 0.5) uv.setXY(i, (pz + z) / tile, (py + y) / tile);
    else uv.setXY(i, (px + x) / tile, (py + y) / tile);
  }
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}
const PI = Math.PI;
// Dreiecks-Umlaufsinn umdrehen (nach Spiegelung), nicht-indiziert
function flip(g) {
  for (const a of Object.values(g.attributes)) {
    const k = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3)
      for (let j = 0; j < k; j++) { const t = arr[(i + 1) * k + j]; arr[(i + 1) * k + j] = arr[(i + 2) * k + j]; arr[(i + 2) * k + j] = t; }
  }
  g.computeVertexNormals();
  return g;
}

// Wand mit Rundbogen-Öffnungen (Kamm-Kontur, Öffnungen gehen bis zum Boden).
// Läuft entlang x von 0 bis L, Dicke t (z von -t/2 bis +t/2).
// openings: [{c: Mitte, w: Breite, s: Kämpferhöhe}] – Bogen = Halbkreis mit r = w/2.
function archWall(L, H, t, openings, tile = 4, sill = 0) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  const ops = [...openings].sort((a, b) => a.c - b.c);
  for (const o of ops) {
    const r = o.w / 2;
    sh.lineTo(o.c - r, 0);
    sh.lineTo(o.c - r, o.s);
    sh.absarc(o.c, o.s, r, PI, 0, true);
    sh.lineTo(o.c + r, 0);
  }
  sh.lineTo(L, 0);
  sh.lineTo(L, H);
  sh.lineTo(0, H);
  sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 20 });
  // Öffnungen mit Brüstung: Bogenfenster statt Durchgang
  g.translate(0, 0, -t / 2);
  // UVs: ExtrudeGeometry gibt Shape-Koordinaten für Vorder-/Rückseite, Seitenflächen über Kontur-Länge – beides in Metern
  return scaleUV(g, tile);
}
// Bogenstein-Ring (Archivolte) um eine Öffnung: Halbkreis-Band r..r+b, Tiefe t, etwas vorstehend
function archRing(cx, spring, r, b, t, tile = 2) {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, r + b, 0, PI, false);
  sh.lineTo(-r, 0);
  sh.absarc(0, 0, r, PI, 0, true);
  sh.lineTo(r + b, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 20 });
  g.translate(cx, spring, -t / 2);
  return scaleUV(g, tile);
}
// Schlussstein oben im Bogen
function keystone(cx, y, t) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.13, 0); sh.lineTo(0.13, 0); sh.lineTo(0.19, 0.42); sh.lineTo(-0.19, 0.42); sh.lineTo(-0.13, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
  g.translate(cx, y - 0.05, -t / 2);
  return scaleUV(g, 2);
}
// Gesims-Profil entlang x (Länge L), Profil: [[vorsprung, höhe], …] von unten nach oben
function cornice(L, prof, t, tile = 2) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  for (const [o, y] of prof) sh.lineTo(o, y);
  sh.lineTo(0, prof[prof.length - 1][1]);
  sh.lineTo(0, 0);
  // Profil liegt in (z-Vorsprung, y); entlang x extrudieren, auf beide Seiten der Wand spiegeln
  const one = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false, curveSegments: 6 });
  one.rotateY(PI / 2);               // depth -> +x … Profil-x -> -z
  const front = one.clone(); front.scale(1, 1, -1); front.translate(0, 0, t / 2);
  const back = one.clone(); back.translate(0, 0, -t / 2);
  for (const g of [front, back]) {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / tile, (p.getY(i) + p.getZ(i)) / tile);
  }
  return mergeGeometries([flip(front.index ? front.toNonIndexed() : front), back.index ? back.toNonIndexed() : back]);
}
const CORNICE = [[0.06, 0], [0.06, 0.08], [0.16, 0.16], [0.24, 0.26], [0.26, 0.34]];
const IMPOST = [[0.04, 0], [0.07, 0.06], [0.07, 0.16]];
const PLINTH = [[0.08, 0], [0.08, 0.45], [0.03, 0.52]];

// Baluster (gedrechselt) + Balustrade entlang x
let _baluster = null;
function baluster() {
  if (_baluster) return _baluster;
  const pts = [[0.09, 0], [0.09, 0.05], [0.06, 0.08], [0.075, 0.14], [0.1, 0.26], [0.085, 0.36], [0.05, 0.45], [0.04, 0.52], [0.06, 0.56], [0.075, 0.6], [0.075, 0.64]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 8);
  _baluster = scaleUV(g, 0.5);
  return _baluster;
}
// Balustrade von x0 bis x1 auf Höhe y, in z = z
function balustrade(x0, x1, y, z, out, ry = 0, ox = 0, oz = 0) {
  const L = x1 - x0, H = 0.98;
  const parts = [box(L, 0.14, 0.34, (x0 + x1) / 2, y + 0.07, z, 2), box(L + 0.04, 0.12, 0.4, (x0 + x1) / 2, y + H - 0.06, z, 2)];
  const n = Math.max(2, Math.floor(L / 0.24));
  for (let i = 0; i < n; i++) {
    const b = baluster().clone();
    b.scale(1, (H - 0.26) / 0.64, 1);
    b.translate(x0 + (i + 0.5) * (L / n), y + 0.14, z);
    parts.push(b);
  }
  for (const p of parts) {
    if (ry) p.rotateY(ry);
    p.translate(ox, 0, oz);
    out.push(p);
  }
}
// Säule (toskanisch) mit Basis und Kapitell
function column(x, y, z, h, r = 0.17) {
  const pts = [[r * 1.45, 0], [r * 1.45, 0.08], [r * 1.25, 0.12], [r * 1.12, 0.18], [r, 0.24], [r, h * 0.35], [r * 0.9, h - 0.3], [r * 0.95, h - 0.26],
    [r * 0.95, h - 0.22], [r * 1.25, h - 0.12], [r * 1.25, h - 0.1]].map(([a, b]) => new THREE.Vector2(a, b));
  const g = scaleUV(new THREE.LatheGeometry(pts, 14), 1);
  g.translate(x, y, z);
  return [g, box(r * 2.9, 0.12, r * 2.9, x, y + h - 0.05, z, 1), box(r * 2.9, 0.08, r * 2.9, x, y + 0.04, z, 1)];
}

// Walmdach mit Ziegel-UV (Reihen laufen waagrecht), Grat-/Firstziegeln und Traufbrett.
// Rechteck x0..x1, z0..z1 (inkl. Überstand), Traufhöhe y, Neigung pitch (rad).
function hipRoof(x0, x1, z0, z1, y, pitch, roofOut, stoneOut) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const half = Math.min(w, d) / 2, h = Math.tan(pitch) * half, top = y + h;
  const along = w >= d;
  const R1 = along ? [x0 + half, top, cz] : [cx, top, z0 + half];
  const R2 = along ? [x1 - half, top, cz] : [cx, top, z1 - half];
  const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], D = [x0, y, z1];
  const slope = Math.hypot(half, h);
  const pos = [], uv = [];
  // Fläche: Traufkante e0->e1, Ziegel-UV: u entlang Traufe, v die Neigung hinauf
  const face = (e0, e1, p) => {
    const ex = e1[0] - e0[0], ez = e1[2] - e0[2], el = Math.hypot(ex, ez), ux = ex / el, uz = ez / el;
    const uvOf = (q) => [((q[0] - e0[0]) * ux + (q[2] - e0[2]) * uz) / 2, ((q[1] - y) / h) * slope / 2.4];
    for (let i = 0; i < p.length - 2; i++)
      for (const q of [p[0], p[i + 1], p[i + 2]]) { pos.push(...q); uv.push(...uvOf(q)); }
  };
  if (along) {
    face(B, A, [B, A, R1, R2]);       // Nordseite (z0)
    face(D, C, [D, C, R2, R1]);       // Südseite (z1)
    face(A, D, [A, D, R1]);
    face(C, B, [C, B, R2]);
  } else {
    face(A, D, [A, D, R2, R1]);
    face(C, B, [C, B, R1, R2]);
    face(B, A, [B, A, R1]);
    face(D, C, [D, C, R2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // Dreiecke so drehen, dass die Normale nach oben zeigt
  const n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    if (n.getY(i) < 0) {
      for (const arr of [p, g.attributes.uv]) {
        const k = arr.itemSize, a = arr.array;
        for (let j = 0; j < k; j++) { const t = a[(i + 1) * k + j]; a[(i + 1) * k + j] = a[(i + 2) * k + j]; a[(i + 2) * k + j] = t; }
      }
    }
  }
  g.computeVertexNormals();
  roofOut.push(g);
  // Unterseite (sichtbar unter dem Überstand) – einfache Platte in Putz-Ton
  const under = new THREE.PlaneGeometry(w, d); under.rotateX(PI / 2); under.translate(cx, y - 0.01, cz); scaleUV(under, 4);
  stoneOut.push(under);
  // First- und Gratziegel: Halbrohre entlang der Kanten
  const ridge = (a, b) => {
    const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = v.length();
    if (L < 0.01) return;
    const c = new THREE.CylinderGeometry(0.11, 0.11, L, 8, 1, false, -PI / 2, PI);
    scaleUV(c, 0.5);
    c.translate(0, L / 2, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
    c.translate(a[0], a[1] + 0.03, a[2]);
    roofOut.push(c);
  };
  ridge(R1, R2);
  for (const [e, r] of along ? [[A, R1], [D, R1], [B, R2], [C, R2]] : [[A, R1], [B, R1], [C, R2], [D, R2]]) ridge(e, r);
  // Traufkante: Ziegelköpfe als dünnes Band
  stoneOut.push(box(w, 0.1, 0.12, cx, y - 0.04, z0 + 0.04, 2), box(w, 0.1, 0.12, cx, y - 0.04, z1 - 0.04, 2),
    box(0.12, 0.1, d, x0 + 0.04, y - 0.04, cz, 2), box(0.12, 0.1, d, x1 - 0.04, y - 0.04, cz, 2));
  return top;
}
// Pultdach (lehnt an einer Wand bei z = zBack, fällt nach +z)
function shedRoof(x0, x1, zBack, zFront, yBack, yFront, roofOut) {
  const g = new THREE.PlaneGeometry(x1 - x0, Math.hypot(zFront - zBack, yBack - yFront));
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + (x1 - x0) / 2) / 2, (p.getY(i) + 50) / 2.4);
  g.rotateX(-PI / 2 + Math.atan2(yBack - yFront, zFront - zBack));
  g.translate((x0 + x1) / 2, (yBack + yFront) / 2, (zBack + zFront) / 2);
  roofOut.push(g);
}

function finish(parts, name) {
  const M = mediterranMats();
  const grp = new THREE.Group();
  grp.name = name;
  for (const k of Object.keys(parts)) {
    if (!parts[k].length) continue;
    const list = parts[k].map((g) => {
      let q = g.index ? g.toNonIndexed() : g;
      for (const a of Object.keys(q.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') q.deleteAttribute(a);
      return q;
    });
    const mesh = new THREE.Mesh(mergeGeometries(list, false), M[k]);
    mesh.castShadow = mesh.receiveShadow = true;
    if (k === 'water') { mesh.castShadow = false; mesh.renderOrder = 2; }
    mesh.name = name + '_' + k;
    grp.add(mesh);
  }
  return grp;
}
const P = () => ({ stucco: [], stone: [], roof: [], floor: [], iron: [], wood: [], hedge: [], mosaic: [], chrome: [], water: [] });

// ---------------------------------------------------------------- 1) Torbogen
// freistehendes Tor: zwei Pfeiler, großer Rundbogen, Gesims und Ziegelabdeckung, optional schmiedeeisernes Tor
export function torbogen(opts = {}) {
  const o = { w: 3.6, spring: 3.4, pier: 1.5, t: 0.9, gate: true, ends: true, ...opts }; // ends:false = steht zwischen zwei Gebäuden (keine Eck-Pilaster/Kugeln)
  const P_ = P(), r = o.w / 2, L = o.w + 2 * o.pier, H = o.spring + r + 1.3, x0 = -L / 2;
  const wall = archWall(L, H, o.t, [{ c: L / 2, w: o.w, s: o.spring }]);
  wall.translate(x0, 0, 0);
  P_.stucco.push(wall);
  P_.stone.push(archRing(0, o.spring, r, 0.32, o.t + 0.08), keystone(0, o.spring + r, o.t + 0.14));
  // Kämpfer + Sockel + Gesims
  for (const s of [-1, 1]) {
    const px = s * (r + o.pier / 2);
    P_.stone.push(box(o.pier + 0.1, 0.16, o.t + 0.14, px, o.spring - 0.08, 0, 2));
    P_.stone.push(box(o.pier + 0.12, 0.5, o.t + 0.16, px, 0.25, 0, 2));
    if (!o.ends) continue;
    // Pilaster an den Außenkanten
    P_.stone.push(box(0.4, H - 1.0, o.t + 0.1, s * (L / 2 - 0.2), (H - 1.0) / 2 + 0.5, 0, 2));
    // Pfeiler-Aufsatz mit Kugel
    P_.stone.push(box(0.7, 0.5, o.t + 0.1, s * (L / 2 - 0.35), H + 0.62, 0, 2));
    const ball = new THREE.SphereGeometry(0.26, 12, 8); scaleUV(ball, 1); ball.translate(s * (L / 2 - 0.35), H + 1.12, 0);
    P_.stone.push(ball);
  }
  const c = cornice(L, CORNICE, o.t); c.translate(x0, H - 0.34, 0); P_.stone.push(c);
  // Ziegelabdeckung (Satteldach-Kappe)
  { const e = o.ends ? 0.2 : 0.85; hipRoof(x0 - e, -x0 + e, -o.t / 2 - 0.32, o.t / 2 + 0.32, H + 0.02, 0.5, P_.roof, P_.stone); } // ohne Enden: Walm steckt in den Nachbarhäusern
  // Tor: zwei Flügel aus Stäben mit Rundbogen-Abschluss
  if (o.gate) {
    const bars = Math.round(o.w / 0.13);
    for (let i = 0; i <= bars; i++) {
      const x = -r + 0.05 + (i / bars) * (o.w - 0.1), top = o.spring + Math.sqrt(Math.max(0, r * r - x * x)) * 0.88 - 0.05;
      const b = new THREE.CylinderGeometry(0.016, 0.016, top, 5); b.translate(x, top / 2, 0); P_.iron.push(b);
      const tip = new THREE.ConeGeometry(0.035, 0.12, 5); tip.translate(x, top + 0.06, 0); P_.iron.push(tip);
    }
    for (const y of [0.12, 1.1, 2.3]) P_.iron.push(box(o.w - 0.1, 0.05, 0.05, 0, y, 0, 1));
    P_.iron.push(box(0.06, o.spring, 0.07, 0, o.spring / 2, 0, 1));
    // Zierkreise
    for (const s of [-1, 1]) {
      const t = new THREE.TorusGeometry(0.28, 0.022, 5, 18); t.translate(s * r * 0.5, 1.7, 0); P_.iron.push(t);
    }
  }
  const grp = finish(P_, 'torbogen');
  grp.userData.colliders = [{ x: -(r + o.pier / 2), z: 0, w: o.pier, d: o.t }, { x: r + o.pier / 2, z: 0, w: o.pier, d: o.t }];
  if (o.gate) grp.userData.colliders.push({ x: 0, z: 0, w: o.w, d: 0.2, gate: true });
  return grp;
}

// ---------------------------------------------------------------- 2) Bogengang
// Arkade: n Bögen vorne, Rückwand mit Bogenfenstern/Türen, Terrakotta-Boden.
// roof: 'shed' (Pultdach), 'terrace' (Flachdach mit Balustrade, wie im Foto) oder 'none' (Dach kommt von verbundDach)
export function bogengang(opts = {}) {
  const o = { n: 5, span: 2.4, pier: 0.7, spring: 2.6, depth: 3.2, t: 0.6, roof: 'terrace', back: true, ...opts };
  const P_ = P(), r = o.span / 2, L = o.n * o.span + (o.n + 1) * o.pier, H = o.spring + r + 0.9, x0 = -L / 2;
  const zf = o.depth / 2, zb = -o.depth / 2;
  const ops = [];
  for (let i = 0; i < o.n; i++) ops.push({ c: o.pier + r + i * (o.span + o.pier), w: o.span, s: o.spring });
  const front = archWall(L, H, o.t, ops); front.translate(x0, 0, zf); P_.stucco.push(front);
  for (const op of ops) {
    const cx = x0 + op.c;
    const ring = archRing(cx, o.spring, r, 0.24, o.t + 0.06); ring.translate(0, 0, zf); P_.stone.push(ring);
    const k = keystone(cx, o.spring + r, o.t + 0.1); k.translate(0, 0, zf); P_.stone.push(k);
  }
  for (let i = 0; i <= o.n; i++) {
    const px = x0 + o.pier / 2 + i * (o.span + o.pier);
    P_.stone.push(box(o.pier + 0.1, 0.14, o.t + 0.12, px, o.spring - 0.07, zf, 2), box(o.pier + 0.1, 0.4, o.t + 0.14, px, 0.2, zf, 2));
  }
  // Seitenwände mit je einem Bogen
  for (const s of [-1, 1]) {
    const sw = archWall(o.depth - o.t, H, o.t, [{ c: (o.depth - o.t) / 2, w: Math.min(o.span, o.depth - o.t - 1.2), s: o.spring }]);
    sw.translate(-(o.depth - o.t) / 2, 0, 0); sw.rotateY(PI / 2); sw.translate(s * (L / 2 - o.t / 2), 0, -o.t / 2 + 0.0);
    P_.stucco.push(sw);
  }
  // Rückwand mit Bogenfenstern (Brüstung 0,9 m) und Tür in der Mitte
  if (o.back) {
    const bw = new THREE.Shape(), Lb = L;
    bw.moveTo(0, 0); bw.lineTo(Lb, 0); bw.lineTo(Lb, H); bw.lineTo(0, H); bw.lineTo(0, 0);
    for (let i = 0; i < o.n; i++) {
      const c = ops[i].c, mid = i === Math.floor(o.n / 2), ww = mid ? 1.3 : 1.0, y0 = mid ? 0.02 : 0.95, s = mid ? 2.2 : 2.1, rr = ww / 2;
      const hole = new THREE.Path();
      hole.moveTo(c - rr, y0); hole.lineTo(c + rr, y0); hole.lineTo(c + rr, s); hole.absarc(c, s, rr, 0, PI, false); hole.lineTo(c - rr, y0);
      bw.holes.push(hole);
      // Glas/Holz dahinter
      const pane = new THREE.PlaneGeometry(ww, s - y0 + rr); pane.translate(x0 + c, (s + rr + y0) / 2, zb - o.t * 0.2);
      (mid ? P_.wood : P_.iron).push(pane);
      // Fensterbank / Bogenrahmen
      const fr = archRing(x0 + c, s, rr, 0.12, 0.1, 2); fr.translate(0, 0, zb + o.t / 2 + 0.03); P_.stone.push(fr);
      if (!mid) P_.stone.push(box(ww + 0.2, 0.08, 0.2, x0 + c, y0 - 0.02, zb + o.t / 2 + 0.06, 2));
    }
    const g = scaleUV(new THREE.ExtrudeGeometry(bw, { depth: o.t, bevelEnabled: false, curveSegments: 16 }), 4);
    g.translate(x0, 0, zb - o.t / 2); P_.stucco.push(g);
  }
  // Boden
  const fl = new THREE.PlaneGeometry(L - 0.2, o.depth); fl.rotateX(-PI / 2);
  { const p = fl.attributes.position, uv = fl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, p.getZ(i) / 2); }
  fl.translate(0, 0.02, 0); P_.floor.push(fl);
  // Sockel + Gesims vorne
  const im = cornice(L, IMPOST, o.t); im.translate(x0, H - 0.75, zf); // Band über den Bögen
  P_.stone.push(im);
  if (o.roof === 'terrace') {
    // Flachdach als Terrasse + Balustrade ringsum
    P_.stone.push(box(L + 0.3, 0.22, o.depth + o.t + 0.3, 0, H + 0.11, 0, 2));
    const tf = new THREE.PlaneGeometry(L, o.depth + o.t); tf.rotateX(-PI / 2);
    { const p = tf.attributes.position, uv = tf.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, p.getZ(i) / 2); }
    tf.translate(0, H + 0.23, 0); P_.floor.push(tf);
    const zz = (o.depth + o.t) / 2 - 0.05, xx = L / 2 - 0.05;
    balustrade(-xx, xx, H + 0.22, zz, P_.stone);
    balustrade(-zz, zz, H + 0.22, 0, P_.stone, PI / 2, -xx, 0);
    balustrade(-zz, zz, H + 0.22, 0, P_.stone, PI / 2, xx, 0);
    // Pfosten an den Ecken
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P_.stone.push(box(0.42, 1.1, 0.42, sx * xx, H + 0.77, sz * zz, 2));
    const c = cornice(L, CORNICE, o.t); c.translate(x0, H - 0.34, zf); P_.stone.push(c);
  } else if (o.roof === 'none') {
    // ohne eigenes Dach: mehrere Stücke bekommen ein gemeinsames (siehe verbundDach)
    const c = cornice(L, CORNICE, o.t); c.translate(x0, H - 0.34, zf); P_.stone.push(c);
  } else {
    const c = cornice(L, CORNICE, o.t); c.translate(x0, H - 0.34, zf); P_.stone.push(c);
    shedRoof(x0 - 0.35, -x0 + 0.35, zb - o.t / 2, zf + o.t / 2 + 0.6, H + 1.4, H + 0.05, P_.roof);
  }
  const grp = finish(P_, 'bogengang');
  const cs = [{ x: 0, z: zb, w: L, d: o.t }];
  for (let i = 0; i <= o.n; i++) cs.push({ x: x0 + o.pier / 2 + i * (o.span + o.pier), z: zf, w: o.pier, d: o.t });
  grp.userData.colliders = cs;
  return grp;
}

// ---------------------------------------------------------------- 3) Pavillon
// Quadratisch: unten auf jeder Seite 3 Bögen (Mitte breiter), oben offene Loggia mit Säulen + Balustrade, Walmdach.
export function pavillon(opts = {}) {
  const o = { size: 7.6, spring: 2.5, t: 0.55, upper: true, ...opts };
  const P_ = P(), S = o.size, h0 = S / 2, t = o.t;
  const spans = [1.6, 2.0, 1.6], piers = (S - spans.reduce((a, b) => a + b, 0)) / 4;
  const ops = [];
  let x = piers;
  for (const w of spans) { ops.push({ c: x + w / 2, w, s: o.spring }); x += w + piers; }
  const H = o.spring + 1.0 + 0.7;
  for (let side = 0; side < 4; side++) {
    const ry = (side * PI) / 2;
    const L = S, w = archWall(L, H, t, ops);
    w.translate(-L / 2, 0, h0 - t / 2); w.rotateY(ry); P_.stucco.push(w);
    for (const op of ops) {
      const rr = op.w / 2, cx = -L / 2 + op.c;
      const ring = archRing(cx, o.spring, rr, 0.2, t + 0.06); ring.translate(0, 0, h0 - t / 2); ring.rotateY(ry); P_.stone.push(ring);
      const k = keystone(cx, o.spring + rr, t + 0.1); k.translate(0, 0, h0 - t / 2); k.rotateY(ry); P_.stone.push(k);
    }
    // Sockel nur an den Pfeilern (Durchgänge bleiben frei)
    let edge = 0;
    for (let i = 0; i <= ops.length; i++) {
      const e2 = i < ops.length ? ops[i].c - ops[i].w / 2 : L;
      const bx = box(e2 - edge + 0.1, 0.45, t + 0.14, -L / 2 + (edge + e2) / 2, 0.225, h0 - t / 2, 2); bx.rotateY(ry); P_.stone.push(bx);
      const im = box(e2 - edge + 0.1, 0.14, t + 0.1, -L / 2 + (edge + e2) / 2, o.spring - 0.07, h0 - t / 2, 2); im.rotateY(ry); P_.stone.push(im);
      if (i < ops.length) edge = ops[i].c + ops[i].w / 2;
    }
    const c = cornice(L + 0.1, CORNICE, t); c.translate(-L / 2 - 0.05, H - 0.34, h0 - t / 2); c.rotateY(ry); P_.stone.push(c);
  }
  // Eckquader (Lisenen)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P_.stone.push(box(0.5, H - 0.4, 0.5, sx * (h0 - 0.2), (H - 0.4) / 2, sz * (h0 - 0.2), 2));
  const fl = new THREE.PlaneGeometry(S - t * 2, S - t * 2); fl.rotateX(-PI / 2);
  { const p = fl.attributes.position, uv = fl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, p.getZ(i) / 2); }
  fl.translate(0, 0.03, 0); P_.floor.push(fl.clone());
  // Zwischendecke
  P_.stucco.push(box(S - 0.1, 0.3, S - 0.1, 0, H - 0.15, 0, 4));
  let eave = H;
  if (o.upper) {
    const y1 = H, uh = 2.5;
    const f2 = fl.clone(); f2.translate(0, y1 + 0.01 - 0.03, 0); P_.floor.push(f2);
    // Säulen: 4 pro Seite (Ecken als Pfeiler)
    const n = 3, inner = h0 - 0.35;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P_.stucco.push(box(0.55, uh, 0.55, sx * inner, y1 + uh / 2, sz * inner, 4));
    for (let side = 0; side < 4; side++) {
      const ry = (side * PI) / 2;
      for (let i = 1; i <= n; i++) {
        const cx = -inner + (i * 2 * inner) / (n + 1);
        for (const g of column(cx, y1, inner, uh)) { g.rotateY(ry); P_.stone.push(g); }
      }
      const parts = [];
      balustrade(-inner + 0.3, inner - 0.3, y1, inner, parts);
      for (const p of parts) { p.rotateY(ry); P_.stone.push(p); }
      // Gebälk (Architrav) über den Säulen
      const ar = box(S - 0.3, 0.45, 0.5, 0, y1 + uh + 0.22, inner, 4); ar.rotateY(ry); P_.stucco.push(ar);
      const c = cornice(S - 0.2, IMPOST, 0.5); c.translate(-(S - 0.2) / 2, y1 + uh + 0.29, inner); c.rotateY(ry); P_.stone.push(c);
    }
    eave = y1 + uh + 0.45;
    // Holzbalken unter dem Dach
    for (let i = -2; i <= 2; i++) P_.wood.push(box(0.14, 0.18, S - 0.6, i * (S / 6), eave - 0.1, 0, 1));
  }
  hipRoof(-h0 - 0.65, h0 + 0.65, -h0 - 0.65, h0 + 0.65, eave, 0.42, P_.roof, P_.stone);
  const grp = finish(P_, 'pavillon');
  const cs = [];
  // Pfeiler als Kollision (zwischen den Bögen)
  for (let side = 0; side < 4; side++) {
    const ry = (side * PI) / 2, cos = Math.cos(ry), sin = Math.sin(ry);
    let px = 0;
    for (let i = 0; i <= 3; i++) {
      const lx = -h0 + px + piers / 2, lz = h0 - t / 2;
      cs.push({ x: lx * cos + lz * sin, z: -lx * sin + lz * cos, w: side % 2 ? t : piers, d: side % 2 ? piers : t });
      px += piers + (spans[i] || 0);
    }
  }
  grp.userData.colliders = cs;
  return grp;
}

// Mittelmeer-Zypresse + Palme als passende Deko (einfach, aber nicht flat)
export function zypresse(h = 7) {
  const g = new THREE.Group();
  const leaf = new THREE.MeshStandardMaterial({ color: '#2f4a22', roughness: 0.95 });
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.sin(Math.pow(t, 0.7) * PI) * 0.75 * (1 - t * 0.35) + 0.02, t * h)); }
  const lg = new THREE.LatheGeometry(pts, 10);
  const p = lg.attributes.position, R = rng(7);
  for (let i = 0; i < p.count; i++) { const k = 0.85 + R() * 0.3; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  lg.computeVertexNormals();
  const m = new THREE.Mesh(lg, leaf); m.position.y = 0.5; m.castShadow = m.receiveShadow = true;
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 }));
  tr.position.y = 0.4;
  g.add(m, tr);
  return g;
}

// ---------------------------------------------------------------- 4) Torbogen zwischen zwei Gebäuden
// ohne Tor/Zaun, ohne Eck-Pilaster; gap = Abstand der beiden Hauswände (Bogen füllt ihn ganz aus)
export function torbogenZwischen(gap = 5.4, opts = {}) {
  const w = Math.min(3.6, gap - 1.2);
  const g = torbogen({ w, pier: (gap - w) / 2, gate: false, ends: false, spring: 3.2, t: 0.8, ...opts });
  g.name = 'torbogenZwischen';
  return g;
}
// schlichter Hausblock im gleichen Stil (für Vorschau / als Nachbarhaus): Putz, Sockel, Gesims, Walmdach, Bogenfenster vorne
export function hausblock(w = 8, h = 6.5, d = 7) {
  const P_ = P();
  P_.stucco.push(box(w, h, d, 0, h / 2, 0, 4));
  P_.stone.push(box(w + 0.16, 0.5, d + 0.16, 0, 0.25, 0, 2), box(w + 0.3, 0.3, d + 0.3, 0, h - 0.15, 0, 2), box(w + 0.12, 0.14, d + 0.12, 0, h * 0.5, 0, 2));
  const n = Math.max(1, Math.floor(w / 2.6));
  for (let fl = 0; fl < 2; fl++)
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + (i + 0.5) * (w / n), y0 = fl ? h * 0.5 + 0.8 : 1.0, s = y0 + 1.1;
      const pane = new THREE.PlaneGeometry(0.9, 1.1); pane.translate(cx, y0 + 0.55, d / 2 + 0.02); P_.iron.push(pane);
      const top = new THREE.CircleGeometry(0.45, 12, 0, PI); top.translate(cx, s, d / 2 + 0.02); P_.iron.push(top);
      const ring = archRing(cx, s, 0.45, 0.12, 0.1); ring.translate(0, 0, d / 2 + 0.05); P_.stone.push(ring);
      P_.stone.push(box(1.15, 0.08, 0.2, cx, y0 - 0.04, d / 2 + 0.06, 2));
    }
  hipRoof(-w / 2 - 0.6, w / 2 + 0.6, -d / 2 - 0.6, d / 2 + 0.6, h, 0.42, P_.roof, P_.stone);
  const grp = finish(P_, 'hausblock');
  grp.userData.colliders = [{ x: 0, z: 0, w, d }];
  return grp;
}

// ---------------------------------------------------------------- 5) Treppe
// Steigt von vorne (+z, Boden) nach hinten (−z) an. Terrakotta-Stufen mit Travertin-Kante,
// seitlich verputzte Wangen mit Stein-Abdeckung und Pfosten mit Kugel.
// userData.stairs = {w, steps, rise, run} (für die Höhenabfrage im Spiel)
export function treppe(opts = {}) {
  const o = { w: 2.4, steps: 8, rise: 0.165, run: 0.32, wangen: true, ...opts };
  const P_ = P(), T = o.steps * o.run, Ht = o.steps * o.rise;
  for (let i = 0; i < o.steps; i++) {
    const y = (i + 1) * o.rise, zc = -(i + 0.5) * o.run;
    P_.stucco.push(box(o.w, y - 0.05, o.run, 0, (y - 0.05) / 2, zc, 4));
    const tr = box(o.w, 0.05, o.run - 0.05, 0, y - 0.025, zc - 0.025, 2); P_.floor.push(tr);
    P_.stone.push(box(o.w, 0.065, 0.1, 0, y - 0.0325 + 0.004, zc + o.run / 2 - 0.02, 2)); // Stufenkante mit 3 cm Überstand
  }
  if (o.wangen) {
    const th = 0.32, rh = 0.8, sl = Math.atan2(Ht, T), len = Math.hypot(T, Ht);
    for (const sd of [-1, 1]) {
      const x = sd * (o.w / 2 + th / 2);
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(T, 0); sh.lineTo(T, Ht + rh); sh.lineTo(0, rh); sh.lineTo(0, 0);
      const g = scaleUV(new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }), 4);
      g.rotateY(PI / 2); g.translate(x - th / 2, 0, 0);
      P_.stucco.push(g);
      const cap = box(th + 0.12, 0.1, len + 0.1, 0, 0, 0, 2); cap.rotateX(sl); cap.translate(x, rh + Ht / 2 + 0.05 / Math.cos(sl), -T / 2);
      P_.stone.push(cap);
      // Pfosten unten und oben
      for (const [z, y0] of [[0.22, 0], [-T - 0.22, Ht]]) {
        P_.stucco.push(box(0.46, y0 + 1.05, 0.46, x, (y0 + 1.05) / 2, z, 4));
        P_.stone.push(box(0.58, 0.1, 0.58, x, y0 + 1.1, z, 2), box(0.54, 0.3, 0.54, x, 0.15, z, 2));
        const ball = new THREE.SphereGeometry(0.2, 12, 8); scaleUV(ball, 1); ball.translate(x, y0 + 1.33, z); P_.stone.push(ball);
      }
    }
  }
  const grp = finish(P_, 'treppe');
  grp.userData.stairs = { w: o.w, steps: o.steps, rise: o.rise, run: o.run, height: Ht, length: T };
  grp.userData.colliders = o.wangen ? [-1, 1].map((sd) => ({ x: sd * (o.w / 2 + 0.16), z: -T / 2, w: 0.32, d: T + 0.9 })) : [];
  return grp;
}

// ---------------------------------------------------------------- 6) Geländer + Hecke
// Hecke (Buchsbaum, geschnitten): Länge entlang x, leicht unregelmäßig, runde Kanten
export function heckeGeo(len, h = 0.9, d = 0.7, x = 0, z = 0, y = 0) {
  const g = box(len, h, d, 0, h / 2, 0, 1);
  const sx = Math.max(2, Math.round(len / 0.25)), sy = 4, sz = 3;
  const b = new THREE.BoxGeometry(len, h, d, sx, sy, sz); b.translate(0, h / 2, 0);
  const p = b.attributes.position, nrm = b.attributes.normal, uv = b.attributes.uv, rr = Math.min(d, h) * 0.32;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const nx0 = nrm.getX(i), ny0 = nrm.getY(i);
    uv.setXY(i, Math.abs(ny0) > 0.5 ? px : Math.abs(nx0) > 0.5 ? pz : px, Math.abs(ny0) > 0.5 ? pz : py);
    // Kern-Punkt (für runde Kanten): alles liegt rr vom Kern entfernt
    const cx = Math.max(-len / 2 + rr, Math.min(len / 2 - rr, px)), cy = Math.max(0, Math.min(h - rr, py)), cz = Math.max(-d / 2 + rr, Math.min(d / 2 - rr, pz));
    let nx = px - cx, ny = py - cy, nz = pz - cz;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const j = Math.sin(px * 12.9 + py * 7.3 + pz * 9.1) * Math.cos(px * 3.7 - pz * 5.3 + py * 4.1) * 0.035; // gleiche Verschiebung für doppelte Eckpunkte
    const k = py < 0.01 ? 0 : 1;
    p.setXYZ(i, cx + nx * (rr + j) * (l > 0.001 ? 1 : 0) + (l > 0.001 ? 0 : 0), cy + ny * (rr + j) * k, cz + nz * (rr + j));
    if (l > 0.001) nrm.setXYZ(i, nx, ny, nz);
  }
  b.translate(x, y, z);
  g.dispose();
  return b.toNonIndexed();
}
// Geländer: Steinbalustrade mit Pfosten alle ~2,4 m auf niedrigem Sockel.
// hedge: 0 = keine, 1 = Hecke davor (+z), -1 = dahinter
export function gelaender(opts = {}) {
  const o = { len: 6, post: 2.4, hedge: 0, hedgeH: 0.85, ...opts };
  const P_ = P(), n = Math.max(1, Math.round(o.len / o.post)), seg = o.len / n, x0 = -o.len / 2;
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * seg;
    P_.stone.push(box(0.36, 1.08, 0.4, x, 0.54, 0, 2), box(0.46, 0.08, 0.5, x, 1.12, 0, 2), box(0.42, 0.16, 0.46, x, 0.08, 0, 2));
    if (i < n) balustrade(x + 0.18, x + seg - 0.18, 0, 0, P_.stone);
  }
  if (o.hedge) P_.hedge.push(heckeGeo(o.len - 0.2, o.hedgeH, 0.7, 0, o.hedge * 0.62));
  const grp = finish(P_, 'gelaender');
  grp.userData.colliders = [{ x: 0, z: o.hedge ? o.hedge * 0.3 : 0, w: o.len, d: o.hedge ? 1.0 : 0.4 }];
  return grp;
}
export function hecke(len = 4, h = 0.9, d = 0.7) {
  const P_ = P();
  P_.hedge.push(heckeGeo(len, h, d));
  const grp = finish(P_, 'hecke');
  grp.userData.colliders = [{ x: 0, z: 0, w: len, d }];
  return grp;
}

// ---------------------------------------------------------------- 7) Pool (Nicks Skizze, passt in 5 × 5 m)
// Umriss aus der Zeichnung: kleines Becken links, großes rundes rechts, eckig gezeichnet. Mit Steinrand 5,0 × 3,9 m.
const POOL_PX = [[415, 1320], [450, 1265], [585, 1185], [660, 1200], [750, 1155], [750, 1070], [880, 970], [960, 975], [1035, 1060], [1030, 1200],
  [990, 1320], [870, 1425], [820, 1430], [790, 1410], [715, 1395], [600, 1430], [475, 1415]];
const POOL_RIM = 0.3;
function offsetPoly(pts, d) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area > 0 ? 1 : -1, out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
    const n1 = [(b[1] - a[1]), -(b[0] - a[0])], n2 = [(c[1] - b[1]), -(c[0] - b[0])];
    const l1 = Math.hypot(...n1), l2 = Math.hypot(...n2);
    n1[0] *= sg / l1; n1[1] *= sg / l1; n2[0] *= sg / l2; n2[1] *= sg / l2;
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const k = Math.min(2.2, 1 / Math.max(0.3, mx * n1[0] + mz * n1[1]));
    out.push([b[0] + mx * d * k, b[1] + mz * d * k]);
  }
  return out;
}
// Umriss in Metern [[x, z], …], Mitte = 0/0. off = Abstand nach außen (0 = Wasserkante, POOL_RIM = Außenkante Steinrand)
export function poolOutline(off = 0, size = 5) {
  const k = (size - 2 * POOL_RIM) / 620;
  const pts = POOL_PX.map(([x, y]) => [(x - 725) * k, (y - 1200) * k]);
  return off ? offsetPoly(pts, off) : pts;
}
// depth > 0: echtes Becken unter y = 0 (der Boden braucht dort ein Loch in Form von poolOutline(0.3));
// depth = 0: flach auf dem Boden (Wasser 8 cm über Grund) – für Stellen, wo kein Loch möglich ist.
export function pool(opts = {}) {
  const o = { size: 5, depth: 1.3, ladder: true, ...opts };
  const P_ = P(), inner = poolOutline(0, o.size), outer = poolOutline(POOL_RIM, o.size);
  const shapeOf = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const flat = (pts, y, tile) => { const g = new THREE.ShapeGeometry(shapeOf(pts)); scaleUV(g, tile); g.rotateX(-PI / 2); g.translate(0, y, 0); return g; };
  const sunk = o.depth > 0, rimTop = sunk ? 0.07 : 0.16, floorY = sunk ? -o.depth : 0.02, waterY = sunk ? -0.08 : 0.1;
  // Steinrand
  const rs = shapeOf(outer); rs.holes.push(new THREE.Path(inner.map(([x, z]) => new THREE.Vector2(x, -z))));
  const rim = scaleUV(new THREE.ExtrudeGeometry(rs, { depth: sunk ? 0.2 : rimTop, bevelEnabled: false }), 2);
  rim.rotateX(-PI / 2); rim.translate(0, sunk ? rimTop - 0.2 : 0, 0);
  P_.stone.push(rim);
  P_.mosaic.push(flat(inner, floorY, 1.6));
  if (sunk) {
    let u = 0;
    const pos = [], uv = [];
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i], b = inner[(i + 1) % inner.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const q = [[a, 0, u], [b, 0, u + l], [b, -o.depth, u + l], [a, 0, u], [b, -o.depth, u + l], [a, -o.depth, u]];
      for (const [pt, y, uu] of q) { pos.push(pt[0], y, pt[1]); uv.push(uu / 1.6, y / 1.6); }
      u += l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    // Wände sollen nach innen zeigen
    const n = g.attributes.normal, c0 = inner[0], c1 = inner[1], mid = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2];
    if (n.getX(0) * -mid[0] + n.getZ(0) * -mid[1] < 0) flip(g);
    P_.mosaic.push(g);
  }
  P_.water.push(flat(inner, waterY, 1));
  if (o.ladder) {
    // Einstiegsleiter an der rechten Kante
    const a = inner[8], b = inner[9], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    for (const dz of [-0.25, 0.25]) {
      const t = new THREE.TorusGeometry(0.3, 0.022, 6, 14, PI); t.translate(mx + 0.05, rimTop + 0.35, mz + dz); P_.chrome.push(t);
      for (const dx of [-0.3, 0.3]) { const c = new THREE.CylinderGeometry(0.022, 0.022, dx < 0 ? 0.35 + 0.9 * (sunk ? 1 : 0) : 0.35, 6); c.translate(mx + 0.05 + dx, rimTop + 0.175 - (dx < 0 && sunk ? 0.45 : 0), mz + dz); P_.chrome.push(c); }
    }
    if (sunk) for (let i = 0; i < 3; i++) { const st = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6); st.rotateX(PI / 2); st.translate(mx - 0.25, -0.2 - i * 0.28, mz); P_.chrome.push(st); }
  }
  const grp = finish(P_, 'pool');
  grp.userData.outline = outer;
  grp.userData.water = inner;
  return grp;
}

// Bausteine für eigene Zusammenstellungen (Anwesen-Entwurf)
export { P as mediterranParts, finish as mediterranFinish, box as mBox, scaleUV as mScaleUV };

// ---------------------------------------------------------------- 8) Seehaus (Nicks Wunsch, Meerseite des Anwesens)
// L-förmige, erhöhte Arkadenhalle mit Ziegeldach. Lokal: Außenecke = 0/0, langer Flügel läuft nach +x (Länge len),
// Meerseite bei z = 0 (schaut nach +z), Hofseite bei z = −depth. Der kurze Flügel läuft von der Ecke nach −z (Länge wing).
// Beide Langseiten offene Rundbögen mit Balustrade; im Bogen bei x ≈ stairAt führt eine Treppe vom Hof hinauf.
export function seehaus(opts = {}) {
  const o = { len: 46, wing: 7.45, depth: 4.5, steps: 6, rise: 0.165, span: 2.4, spring: 2.6, t: 0.6, stairAt: 28, ...opts };
  const P_ = P(), pod = o.steps * o.rise, r = o.span / 2, H = o.spring + r + 0.9, t = o.t, D = o.depth;
  let stairX = null;
  // Bogenwand entlang lokal +x (0..L), dann um ry gedreht und nach (ax, az) geschoben
  const run = (L, ax, az, ry, mode, stairLocal = null, e0 = 0, e1 = 0) => {
    const put = (g, into) => { g.rotateY(ry); g.translate(ax, pod, az); into.push(g); };
    if (mode === 'closed') { put(box(L, H, t, L / 2, H / 2, 0, 4), P_.stucco); }
    else {
      // e0/e1 = breitere Endpfeiler (wo eine Querwand anschließt)
      const n = Math.max(1, Math.floor((L - e0 - e1 - 0.7) / (o.span + 0.7))), pier = (L - e0 - e1 - n * o.span) / (n + 1), ops = [];
      for (let i = 0; i < n; i++) ops.push({ c: e0 + pier + r + i * (o.span + pier), w: o.span, s: o.spring });
      let skip = -1;
      if (stairLocal !== null) { let best = 1e9; ops.forEach((op, i) => { const d = Math.abs(op.c - stairLocal); if (d < best) { best = d; skip = i; } }); stairX = ops[skip].c; }
      put(archWall(L, H, t, ops), P_.stucco);
      let edge = 0;
      ops.forEach((op, i) => {
        put(archRing(op.c, o.spring, r, 0.24, t + 0.06), P_.stone);
        put(keystone(op.c, o.spring + r, t + 0.1), P_.stone);
        if (i !== skip) { const parts = []; balustrade(op.c - r, op.c + r, 0, 0, parts); for (const g of parts) put(g, P_.stone); }
      });
      for (let i = 0; i <= n; i++) {
        const e2 = i < n ? ops[i].c - r : L, c = (edge + e2) / 2, w = e2 - edge;
        put(box(w + 0.1, 0.14, t + 0.12, c, o.spring - 0.07, 0, 2), P_.stone);
        put(box(w + 0.1, 0.4, t + 0.14, c, 0.2, 0, 2), P_.stone);
        if (i < n) edge = ops[i].c + r;
      }
    }
    const c = cornice(L, CORNICE, t); c.translate(0, H - 0.34, 0); put(c, P_.stone);
    const im = cornice(L, IMPOST, t); im.translate(0, H - 0.75, 0); put(im, P_.stone);
  };
  // Sockel (erhöhte Ebene) + Böden
  const slab = (x0, x1, z0, z1) => {
    P_.stucco.push(box(x1 - x0, pod, z1 - z0, (x0 + x1) / 2, pod / 2, (z0 + z1) / 2, 4));
    P_.stone.push(box(x1 - x0 + 0.12, 0.12, z1 - z0 + 0.12, (x0 + x1) / 2, pod - 0.06, (z0 + z1) / 2, 2));
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + (x0 + x1) / 2) / 2, (p.getZ(i) + (z0 + z1) / 2) / 2);
    g.translate((x0 + x1) / 2, pod + 0.012, (z0 + z1) / 2); P_.floor.push(g);
  };
  slab(0, o.len, -D, 0);
  slab(0, D, -o.wing, -D);
  run(o.len, 0, -t / 2, 0, 'open', null, 0.5, 0.5);                        // Meerseite
  run(o.len - D, D, -D + t / 2, 0, 'open', o.stairAt - D, 0.5, 0.5);       // Hofseite (zum Pool)
  run(o.wing, t / 2, 0, PI / 2, 'open', null, 0.5, 0.5);                   // kurzer Flügel, Außenseite
  if (o.wing - D > 2.2) run(o.wing - D, D - t / 2, -D, PI / 2, 'open', null, 0.4, 0.4); // kurzer Flügel, Hofseite
  run(D, 0, -o.wing + t / 2, 0, 'closed');                                 // Abschluss am Nachbargebäude
  run(D, o.len - t / 2, 0, PI / 2, 'closed');                              // Abschluss an der höheren Ebene
  // Dachbalken + Ziegeldach (zwei Walmdächer, die sich über der Ecke verschneiden)
  const eave = pod + H;
  for (let x = D + 1.5; x < o.len - 0.5; x += 1.55) P_.wood.push(box(0.16, 0.2, D - 0.3, x, eave - 0.12, -D / 2, 1));
  for (let z = -D - 0.8; z > -o.wing + 0.5; z -= 1.55) P_.wood.push(box(D - 0.3, 0.2, 0.16, D / 2, eave - 0.12, z, 1));
  hipRoof(-0.65, o.len + 0.65, -D - 0.65, 0.65, eave, 0.42, P_.roof, P_.stone);
  hipRoof(-0.65, D + 0.65, -o.wing - 0.65, 0.65, eave + 0.004, 0.42, P_.roof, P_.stone);
  const grp = finish(P_, 'seehaus');
  // Treppe vom Hof
  const st = treppe({ steps: o.steps, rise: o.rise, w: o.span });
  st.position.set(D + stairX, 0, -D - o.steps * 0.32); st.rotation.y = PI;
  grp.add(st);
  grp.userData.podium = pod;
  grp.userData.stairX = D + stairX;
  grp.userData.colliders = [{ x: o.len / 2, z: -t / 2, w: o.len, d: t }, { x: o.len / 2, z: -D + t / 2, w: o.len, d: t, gapAt: D + stairX, gap: o.span }, { x: t / 2, z: -o.wing / 2, w: t, d: o.wing }];
  return grp;
}

// ---------------------------------------------------------------- 9) Verbund-Dach
// Ein zusammenhängendes Ziegeldach über mehrere Gebäudestücke: rects = [[x0, x1, z0, z1], …] (Dachkanten inkl. Überstand),
// alle mit gleicher Traufhöhe y. Rechtecke gleicher Breite verschneiden sich sauber (gleiche Firsthöhe).
export function verbundDach(rects, y, pitch = 0.42) {
  const P_ = P();
  rects.forEach((r, i) => hipRoof(r[0], r[1], r[2], r[3], y + i * 0.004, pitch, P_.roof, P_.stone));
  return finish(P_, 'verbundDach');
}
