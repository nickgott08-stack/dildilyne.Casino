import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const angleWrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const dampAngle = (a, b, k, dt) => a + angleWrap(b - a) * (1 - Math.exp(-k * dt));

// seeded RNG so the city looks the same for every player
let seed = 1337;
export const srand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
export const srange = (a, b) => a + srand() * (b - a);
export const spick = (arr) => arr[Math.floor(srand() * arr.length)];

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// colors a geometry with a flat vertex color
export function colorize(geo, color) {
  _c.set(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _c.r;
    arr[i * 3 + 1] = _c.g;
    arr[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  geo.applyMatrix4(_m);
  return geo;
}

// box with vertex color, positioned by its center
export function cbox(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  colorize(g, color);
  return place(g, x, y, z, rx, ry, rz);
}
export function ccyl(rt, rb, h, seg, x, y, z, color, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  colorize(g, color);
  return place(g, x, y, z, rx, ry, rz);
}

// strips uv so geometries can be merged with or without uv
export function normalizeGeo(g, keepUV) {
  if (!keepUV && g.attributes.uv) g.deleteAttribute('uv');
  if (keepUV && !g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  if (g.index === null) {
    // make indexed for consistency
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

export function merge(geos, keepUV = false) {
  const list = geos.filter(Boolean).map((g) => normalizeGeo(g, keepUV));
  if (!list.length) return new THREE.BufferGeometry();
  const out = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return out;
}

export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  return t;
}

// draws glowing neon text onto a canvas texture
export function neonSign(text, color, opts = {}) {
  const w = opts.w || 1024;
  const h = opts.h || 256;
  return canvasTex(
    w,
    h,
    (ctx) => {
      ctx.fillStyle = opts.bg || '#0b0710';
      ctx.fillRect(0, 0, w, h);
      if (opts.border !== false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 10;
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.strokeRect(14, 14, w - 28, h - 28);
      }
      let size = opts.size || 150;
      const fam = opts.font || 'Arial Black, Impact, sans-serif';
      ctx.font = `900 ${size}px ${fam}`;
      const maxW = w * 0.88;
      const tw = ctx.measureText(text).width;
      if (tw > maxW) { size = Math.floor(size * maxW / tw); ctx.font = `900 ${size}px ${fam}`; }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      for (let i = 0; i < 3; i++) {
        ctx.shadowBlur = 40 - i * 12;
        ctx.fillStyle = i === 2 ? '#fff' : color;
        ctx.fillText(text, w / 2, h / 2 + 6);
      }
    },
    false
  );
}

export class Pool {
  constructor(make) {
    this.make = make;
    this.free = [];
  }
  get() {
    return this.free.pop() || this.make();
  }
  put(o) {
    this.free.push(o);
  }
}

// ---------- storage + casino link ----------
// Inside the Dildilyne casino the game runs in an iframe: the casino injects
// window.GCFG = { bits, sv } and listens for postMessage { gta: 'bits' | 'save' | 'exit' }.
const GCFG = (typeof window !== 'undefined' && window.GCFG) || null;
const SV = GCFG ? (GCFG.sv && typeof GCFG.sv === 'object' ? JSON.parse(JSON.stringify(GCFG.sv)) : {}) : null;
if (SV && (!SV.d3 || typeof SV.d3 !== 'object')) {
  SV.d3 = {};
  // carry over the cash from the old 2D Dildi City once
  if (SV.cash > 0) SV.d3.dc3d_dollar = String(Math.round(SV.cash));
}
let saveT = null;
function postSave() {
  if (!GCFG) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { parent.postMessage({ gta: 'save', sv: SV }, '*'); } catch (e) {} }, 400);
}
export const store = {
  get(k) {
    if (SV) return k in SV.d3 ? SV.d3[k] : null;
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },
  set(k, v) {
    if (SV) { SV.d3[k] = String(v); postSave(); return; }
    try { localStorage.setItem(k, v); } catch (e) {}
  },
};
let _bits = GCFG ? +GCFG.bits || 0 : 0;
export const casino = {
  linked: !!GCFG,
  bits() { return GCFG ? _bits : +(store.get('dc3d_testbits') || 25000); },
  addBits(n) {
    n = Math.round(n);
    if (n < 0 && casino.bits() + n < 0) return false;
    if (GCFG) { _bits += n; try { parent.postMessage({ gta: 'bits', n }, '*'); } catch (e) {} }
    else store.set('dc3d_testbits', String(casino.bits() + n));
    return true;
  },
  exit() { if (GCFG) { clearTimeout(saveT); try { parent.postMessage({ gta: 'exit', sv: SV }, '*'); } catch (e) {} } },
};
