/*
 * dildi_cars.js - Zwei Low-Poly-Autos fuer dildi City (three.js)
 * ==============================================================
 *  - createRS6(THREE, opts)      Kombi im Stil eines RS6 Avant (Nardo-Grau)
 *  - createFerrari(THREE, opts)  Mittelmotor-Sportwagen im Stil eines Ferrari 296 (Rosso Corsa)
 *
 * Stil: echte Abmessungen, aber kantig/facettiert (Flat-Shading) - passt in eine Low-Poly-Stadt.
 * Die Geometrie wird hier per Code erzeugt, es werden KEINE externen Dateien/Texturen geladen.
 *
 * EINBAU (Hinweis fuer den Entwickler / die KI im dildi-City-Chat):
 *   1. Diese Datei per <script src="dildi_cars.js"></script> einbinden ODER den Inhalt direkt in
 *      das Spiel-Script kopieren. Danach gibt es window.DildiCars = { createRS6, createFerrari }.
 *      (In ES-Modulen: das THREE-Objekt aus dem Import als ersten Parameter uebergeben.)
 *   2. const car = DildiCars.createRS6(THREE);   // oder createFerrari(THREE)
 *      car.position.set(x, 0, z); scene.add(car);
 *   3. Pro Frame:  car.userData.update(dt, speed, steer);
 *        dt    = Sekunden seit letztem Frame
 *        speed = Geschwindigkeit in m/s (positiv = vorwaerts) -> Raeder rollen passend
 *        steer = Lenkwinkel der Vorderraeder in Radiant (z. B. -0.5 .. 0.5)
 *      Die Fahrphysik / Bewegung des Autos selbst (car.position, car.rotation.y) macht das Spiel.
 *   4. Extras:  car.userData.setLights(true/false)   Scheinwerfer + Ruecklichter
 *               car.userData.setPaint('#1e3a8a')      Lackfarbe aendern
 *               car.userData.size  -> {length, width, height} fuer Kollisionsbox
 *
 * Konventionen: 1 Einheit = 1 Meter. Vorne = +Z, oben = +Y, Raeder stehen auf y = 0.
 * Mit car.rotation.y dreht man das Auto; Fahrtrichtung = (sin(rotY), 0, cos(rotY)).
 * Metallische Teile (Felgen, Auspuff) sehen am besten aus, wenn scene.environment gesetzt ist
 * (z. B. RoomEnvironment + PMREMGenerator); ohne funktioniert es trotzdem.
 * Benoetigt three.js r150 oder neuer.
 */
(function (root) {
  'use strict';

  // ---------- Vektor-Helfer ----------
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.sqrt(dot(a, a));
  const mirror = (p) => [-p[0], p[1], p[2]];
  const lerp = (a, b, t) => a + (b - a) * t;
  const SIDES = [1, -1];

  // ---------- Mesh-Sammler (Dreiecke je Material) ----------
  class MB {
    constructor() { this.t = {}; }
    tri(m, a, b, c) {
      if (len(cross(sub(b, a), sub(c, a))) < 1e-9) return;
      (this.t[m] || (this.t[m] = [])).push(a, b, c);
    }
    quad(m, a, b, c, d) { this.tri(m, a, b, c); this.tri(m, a, c, d); }
    triO(m, a, b, c, away) {            // Normale zeigt von "away" weg
      const n = cross(sub(b, a), sub(c, a));
      const ctr = mul(add(add(a, b), c), 1 / 3);
      if (dot(n, sub(ctr, away)) < 0) [b, c] = [c, b];
      this.tri(m, a, b, c);
    }
    convex(m, faces) {
      let ctr = [0, 0, 0], n = 0;
      for (const f of faces) for (const p of f) { ctr = add(ctr, p); n++; }
      ctr = mul(ctr, 1 / n);
      for (const f of faces) for (let i = 1; i < f.length - 1; i++) this.triO(m, f[0], f[i], f[i + 1], ctr);
    }
    hexa(m, p) {
      this.convex(m, [[p[0], p[1], p[2], p[3]], [p[4], p[5], p[6], p[7]],
        [p[0], p[1], p[5], p[4]], [p[1], p[2], p[6], p[5]],
        [p[2], p[3], p[7], p[6]], [p[3], p[0], p[4], p[7]]]);
    }
    box(m, lo, hi) {
      const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
      this.hexa(m, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]);
    }
    slab(m, q, d) { this.hexa(m, q.concat(q.map((p) => add(p, d)))); }
    prism(m, ring, off) {
      const top = ring.map((p) => add(p, off));
      const faces = [ring, top];
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        faces.push([ring[i], ring[j], top[j], top[i]]);
      }
      this.convex(m, faces);
    }
  }

  const hexagon = (cx, cy, z, r, n, rot, sx, sy) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rot + 2 * Math.PI * i / n;
      out.push([cx + sx * r * Math.cos(a), cy + sy * r * Math.sin(a), z]);
    }
    return out;
  };

  // ---------- Karosserie-Loft (Querschnitte entlang der Laenge) ----------
  // KEYS-Spalten: z, yf, wbot, yrk, wm, ym, wbl, ybl, wwin, ywin, wr, yr, yc
  function makeLoft(spec) {
    const keys = spec.keys;
    const ARCH_ANGLES = [-90, -58, -22, 22, 58, 90];
    const params = (z) => {
      const out = [];
      for (let c = 1; c < 13; c++) {
        if (z >= keys[0][0]) { out.push(keys[0][c]); continue; }
        if (z <= keys[keys.length - 1][0]) { out.push(keys[keys.length - 1][c]); continue; }
        for (let i = 0; i < keys.length - 1; i++) {
          const k0 = keys[i], k1 = keys[i + 1];
          if (z <= k0[0] && z >= k1[0]) { out.push(lerp(k0[c], k1[c], (k0[0] - z) / (k0[0] - k1[0]))); break; }
        }
      }
      return out;
    };
    const archInfo = (z) => {
      for (const ax of spec.axles) {
        const d = (ax.z - z) / ax.arch;
        if (Math.abs(d) <= 1 + 1e-9) {
          const a = Math.asin(Math.max(-1, Math.min(1, d)));
          return { inArch: true, ya: ax.r + ax.arch * Math.min(Math.cos(a), 0.93), ax };
        }
      }
      return { inArch: false, ya: null, ax: null };
    };
    const profile = (z, override) => {
      const [yf, wbot, yrk, wm0, ym, wbl, ybl, wwin, ywin, wr, yr, yc] = params(z);
      let { inArch, ya, ax } = archInfo(z);
      if (override !== undefined) { inArch = override; if (inArch) ya = ax.r; }
      const liner = ax ? ax.liner : 0.64;
      if (inArch) {
        const wm = Math.max(wm0, 0.975);
        const ym2 = Math.min(Math.max(ym, ya + 0.06), ybl - 0.03);
        return [[0, yf], [liner, yf], [liner, ya], [wm - 0.03, ya], [wm, ya + 0.025],
          [wm, ym2], [wbl, ybl], [wwin, ywin], [wr, yr], [0, yc]];
      }
      return [[0, yf], [liner, yf], [liner, yf], [wbot, yf], [wm0 - 0.03, yrk],
        [wm0, ym], [wbl, ybl], [wwin, ywin], [wr, yr], [0, yc]];
    };
    const build = (mb) => {
      const zset = new Map();
      const addZ = (z) => zset.set(z.toFixed(6), z);
      keys.forEach((k) => addZ(k[0]));
      spec.extraZ.forEach(addZ);
      for (const ax of spec.axles) for (const a of ARCH_ANGLES) addZ(ax.z - ax.arch * Math.sin(a * Math.PI / 180));
      const zs = [...zset.values()].sort((a, b) => b - a);
      const st = [];
      for (const z of zs) {
        const { inArch, ax } = archInfo(z);
        if (inArch && Math.abs(Math.abs(z - ax.z) - ax.arch) < 1e-6) {
          const pn = { z, p: profile(z, false), arch: false }, pa = { z, p: profile(z, true), arch: true };
          if (z > ax.z) st.push(pn, pa); else st.push(pa, pn);
        } else st.push({ z, p: profile(z), arch: inArch });
      }
      const P = (s, i) => [s.p[i][0], s.p[i][1], s.z];
      const nseg = st[0].p.length - 1;
      for (let k = 0; k < st.length - 1; k++) {
        const s0 = st[k], s1 = st[k + 1];
        const mats = spec.mats(s0.z, s1.z, s0.arch, s1.arch);
        for (let s = 0; s < nseg; s++) {
          const a = P(s0, s), b = P(s1, s), c = P(s1, s + 1), d = P(s0, s + 1);
          mb.quad(mats[s], a, b, c, d);
          mb.quad(mats[s], mirror(a), mirror(d), mirror(c), mirror(b));
        }
      }
      for (const [s, facing] of [[st[0], 1], [st[st.length - 1], -1]]) {
        const right = [];
        for (let i = 0; i <= nseg; i++) right.push(P(s, i));
        const ring = right.concat(right.slice().reverse().slice(1, -1).map(mirror));
        const clean = [ring[0]];
        for (const p of ring.slice(1)) if (len(sub(p, clean[clean.length - 1])) > 1e-6) clean.push(p);
        let ctr = [0, 0, 0];
        clean.forEach((p) => { ctr = add(ctr, p); });
        ctr = mul(ctr, 1 / clean.length);
        for (let i = 0; i < clean.length; i++) {
          const a = clean[i], b = clean[(i + 1) % clean.length];
          if (facing > 0) mb.tri('Paint', ctr, a, b); else mb.tri('Paint', ctr, b, a);
        }
      }
    };
    // Punkt + Aussennormale auf der Karosserie (Station z, Profilparameter u = 0..9)
    const surf = (z, u, side) => {
      const p = profile(z, false);
      const i = Math.min(Math.floor(u), p.length - 2), t = u - i;
      const [x0, y0] = p[i], [x1, y1] = p[i + 1];
      const pt = [side * lerp(x0, x1, t), lerp(y0, y1, t), z];
      let n = [side * (y1 - y0), -(x1 - x0), 0];
      n = mul(n, 1 / (len(n) + 1e-12));
      return [pt, n];
    };
    const decal = (mb, m, corners, side, lift, depth, nu = 4, nz = 2) => {
      const [[z0, a0], [, b0], [z1, b1], [, a1]] = corners;
      const at = (v, w) => {
        const a = lerp(a0, a1, w), b = lerp(b0, b1, w);
        return [lerp(z0, z1, w), lerp(a, b, v)];
      };
      for (let i = 0; i < nu; i++) for (let j = 0; j < nz; j++) {
        const q = [at(i / nu, j / nz), at((i + 1) / nu, j / nz), at((i + 1) / nu, (j + 1) / nz), at(i / nu, (j + 1) / nz)];
        const f = [], bk = [];
        for (const [z, u] of q) { const [p, n] = surf(z, u, side); f.push(add(p, mul(n, lift))); bk.push(sub(p, mul(n, depth))); }
        mb.hexa(m, f.concat(bk));
      }
    };
    return { build, decal };
  }

  // ---------- Rad (Aussenseite = +X, dreht um X) ----------
  function buildWheel(radius, width) {
    const mb = new MB();
    const hw = 0.1425, n = 20;
    const rp = (r, x, a) => [x, r * Math.cos(a), r * Math.sin(a)];
    const prof = [[0.272, -hw + 0.008], [0.335, -hw], [0.358, -hw + 0.018], [0.365, -hw + 0.05],
      [0.365, hw - 0.05], [0.358, hw - 0.018], [0.335, hw], [0.272, hw - 0.008]];
    for (let i = 0; i < n; i++) {
      const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n, am = (a0 + a1) / 2;
      const core = rp(0.318, 0, am);
      for (let j = 0; j < prof.length - 1; j++) {
        const [r0, x0] = prof[j], [r1, x1] = prof[j + 1];
        const a = rp(r0, x0, a0), b = rp(r0, x0, a1), c = rp(r1, x1, a1), d = rp(r1, x1, a0);
        mb.triO('Tire', a, b, c, core); mb.triO('Tire', a, c, d, core);
      }
      // Felgenbett (Innenseite)
      const r = 0.274, out = rp(1, 0, am);
      const a = rp(r, -hw + 0.01, a0), b = rp(r, -hw + 0.01, a1), c = rp(r, hw - 0.02, a1), d = rp(r, hw - 0.02, a0);
      mb.triO('RimInner', a, b, c, out); mb.triO('RimInner', a, c, d, out);
      // Felgenhorn
      const xo = hw - 0.012, ri = 0.248, ro = 0.282, xi = xo - 0.03;
      mb.convex('Rim', [
        [rp(ri, xo, a0), rp(ro, xo, a0), rp(ro, xo, a1), rp(ri, xo, a1)],
        [rp(ri, xi, a0), rp(ro, xi, a0), rp(ro, xi, a1), rp(ri, xi, a1)],
        [rp(ro, xo, a0), rp(ro, xo, a1), rp(ro, xi, a1), rp(ro, xi, a0)],
        [rp(ri, xo, a0), rp(ri, xo, a1), rp(ri, xi, a1), rp(ri, xi, a0)],
        [rp(ri, xo, a0), rp(ro, xo, a0), rp(ro, xi, a0), rp(ri, xi, a0)],
        [rp(ri, xo, a1), rp(ro, xo, a1), rp(ro, xi, a1), rp(ri, xi, a1)]]);
    }
    const disc = [];
    for (let i = 0; i < 18; i++) disc.push(rp(0.205, -0.035, 2 * Math.PI * i / 18));
    mb.prism('BrakeDisc', disc, [0.028, 0, 0]);
    for (let k = 0; k < 5; k++) for (const off of [-0.13, 0.13]) {   // 5 Doppelspeichen
      const th = 2 * Math.PI * k / 5 + off;
      const d = [0, Math.cos(th), Math.sin(th)], t = [0, -Math.sin(th), Math.cos(th)];
      const tilt = -Math.sign(off) * 0.012;
      const pin = add(mul(d, 0.075), mul(t, tilt)), pout = mul(d, 0.255);
      const X1 = [hw - 0.055, 0, 0], X2 = [hw - 0.018, 0, 0];
      const f = [sub(add(X1, pin), mul(t, 0.02)), add(add(X1, pin), mul(t, 0.02)),
        add(add(X2, pout), mul(t, 0.03)), sub(add(X2, pout), mul(t, 0.03))];
      mb.hexa('Rim', f.concat(f.map((p) => sub(p, [0.035, 0, 0]))));
    }
    const hub = [], cap = [];
    for (let i = 0; i < 10; i++) hub.push(rp(0.085, hw - 0.075, 2 * Math.PI * i / 10));
    for (let i = 0; i < 6; i++) cap.push(rp(0.035, hw - 0.046, 2 * Math.PI * i / 6));
    mb.prism('Rim', hub, [0.03, 0, 0]);
    mb.prism('RimInner', cap, [0.006, 0, 0]);
    // auf Zielgroesse skalieren
    const kr = radius / 0.365, kw = width / 0.285;
    for (const m in mb.t) mb.t[m] = mb.t[m].map((p) => [p[0] * kw, p[1] * kr, p[2] * kr]);
    return mb;
  }

  function calipers(mb, axles, outOff) {
    for (const [ax, deg] of [[axles[0], 150], [axles[1], 30]]) {
      const ang = deg * Math.PI / 180, k = ax.r / 0.365;
      const pts = [];
      for (const r of [0.16 * k, 0.235 * k]) for (const a of [ang - 0.42, ang + 0.42]) pts.push([r * Math.sin(a), r * Math.cos(a)]);
      for (const s of SIDES) {
        const cx = s * ax.x, ord = [0, 1, 3, 2];
        const f = ord.map((i) => [cx + s * outOff, ax.r + pts[i][1], ax.z + pts[i][0]]);
        const b = ord.map((i) => [cx - s * 0.05, ax.r + pts[i][1], ax.z + pts[i][0]]);
        mb.hexa('Caliper', f.concat(b));
      }
    }
  }

  // ======================================================================
  // RS6 Avant
  // ======================================================================
  const RS6_AXLES = [
    { z: 1.51, r: 0.365, w: 0.285, x: 0.83, arch: 0.44, liner: 0.64 },
    { z: -1.42, r: 0.365, w: 0.285, x: 0.83, arch: 0.44, liner: 0.64 }];
  function rs6Body() {
    const mb = new MB();
    const loft = makeLoft({
      axles: RS6_AXLES,
      extraZ: [0.56, -0.78, -0.90, -1.56, -1.64, 1.20, -0.40, 0.30],
      keys: [
        [2.50, .26, .66, .32, .80, .55, .74, .70, .50, .72, .22, .73, .73],
        [2.44, .20, .78, .27, .92, .62, .86, .78, .58, .80, .26, .81, .815],
        [2.15, .15, .84, .24, .965, .70, .89, .85, .60, .88, .28, .89, .90],
        [1.51, .13, .86, .24, .975, .74, .90, .90, .62, .935, .30, .945, .955],
        [0.95, .13, .86, .24, .955, .74, .905, .97, .64, 1.00, .32, 1.01, 1.02],
        [0.90, .13, .86, .24, .955, .74, .905, .975, .80, .985, .72, .995, 1.00],
        [0.02, .13, .86, .24, .945, .74, .90, 1.00, .70, 1.36, .62, 1.42, 1.44],
        [-0.95, .13, .86, .24, .945, .74, .895, 1.02, .70, 1.37, .63, 1.425, 1.445],
        [-1.88, .13, .86, .24, .965, .75, .88, 1.04, .69, 1.36, .61, 1.42, 1.44],
        [-2.20, .16, .84, .26, .94, .76, .84, 1.03, .62, 1.09, .54, 1.11, 1.12],
        [-2.40, .22, .80, .30, .91, .74, .80, 1.00, .58, 1.02, .50, 1.025, 1.03],
        [-2.49, .28, .74, .34, .85, .72, .74, .95, .55, .97, .45, .975, .98]],
      mats: (z0, z1, a0, a1) => {
        const zm = (z0 + z1) / 2;
        const m = ['Underbody', 'Underbody', 'Underbody', 'TrimGloss', 'Paint', 'Paint', 'Paint', 'Paint', 'Paint'];
        if (a0 && a1) m[3] = 'Paint';
        if (Math.abs(z0 - z1) < 1e-6) { m[3] = 'Underbody'; m[4] = 'Underbody'; }
        if (zm > 0.90 && zm < 0.95) { m[7] = 'TrimMatte'; m[8] = 'TrimMatte'; }
        else if (zm > 0.02 && zm < 0.90) { m[6] = zm < 0.56 ? 'Glass' : 'Paint'; m[7] = 'TrimGloss'; m[8] = 'Glass'; }
        else if (zm > -1.88 && zm < 0.02) {
          m[6] = ((zm > -0.90 && zm < -0.78) || (zm > -1.64 && zm < -1.56)) ? 'TrimGloss' : 'Glass';
          m[7] = 'TrimGloss';
        } else if (zm > -2.20 && zm < -1.88) { m[6] = 'Glass'; m[7] = 'TrimGloss'; m[8] = 'Glass'; }
        return m;
      },
    });
    loft.build(mb);

    // --- Front ---
    const zf = 2.50;
    const g = [[-0.40, 0.62], [0.40, 0.62], [0.52, 0.52], [0.46, 0.30], [0.30, 0.25], [-0.30, 0.25], [-0.46, 0.30], [-0.52, 0.52]];
    mb.prism('TrimGloss', g.map(([x, y]) => [x, y, zf - 0.01]), [0, 0, 0.025]);
    for (let row = 0; row < 4; row++) for (let col = -4; col <= 4; col++) {   // Wabengitter
      const cx = col * 0.1 + (row % 2 ? 0.05 : 0), cy = 0.315 + row * 0.075;
      if (Math.abs(cx) > 0.44 - ((row > 0 && row < 3) ? 0 : 0.06)) continue;
      mb.prism('Grille', hexagon(cx, cy, zf + 0.015, 0.032, 6, Math.PI / 6, 1, 0.85), [0, 0, 0.012]);
    }
    mb.box('Plate', [-0.26, 0.33, zf + 0.025], [0.26, 0.44, zf + 0.035]);
    for (const s of SIDES) {
      mb.slab('TrimMatte', [[s * 0.56, 0.47, zf + 0.012], [s * 0.78, 0.50, zf + 0.012], [s * 0.74, 0.30, zf + 0.012], [s * 0.54, 0.29, zf + 0.012]], [0, 0, -0.03]);
      mb.slab('Paint', [[s * 0.55, 0.40, zf + 0.02], [s * 0.77, 0.415, zf + 0.02], [s * 0.765, 0.39, zf + 0.02], [s * 0.55, 0.375, zf + 0.02]], [0, 0, -0.03]);
      const out = (p, d) => {
        const t = Math.min(1, Math.max(0, (Math.abs(p[0]) - 0.70) / 0.18));
        let nrm = [s * t * 0.8, 0, 1 - 0.4 * t];
        nrm = mul(nrm, 1 / len(nrm));
        return add(p, mul(nrm, d));
      };
      const lens = [[s * 0.44, 0.700, zf], [s * 0.86, 0.780, 2.432], [s * 0.90, 0.685, 2.395], [s * 0.50, 0.612, zf]];
      mb.hexa('LightLens', lens.map((p) => out(p, 0.022)).concat(lens.map((p) => out(p, -0.05))));
      const drl = [[s * 0.45, 0.694, zf], [s * 0.85, 0.772, 2.438], [s * 0.855, 0.754, 2.430], [s * 0.46, 0.678, zf]];
      mb.hexa('HeadLight', drl.map((p) => out(p, 0.03)).concat(drl.map((p) => out(p, 0))));
      for (let i = 0; i < 5; i++) {
        const t = i / 4, x = 0.52 + t * 0.26, y = 0.660 + t * 0.065;
        const z = zf - (Math.max(0, x - 0.70) / 0.18) * 0.06;
        const seg = [[s * x, y, z], [s * (x + 0.024), y + 0.005, z], [s * (x + 0.028), y - 0.040, z], [s * (x + 0.004), y - 0.045, z]];
        mb.hexa('HeadLight', seg.map((p) => out(p, 0.03)).concat(seg.map((p) => out(p, 0))));
      }
    }
    mb.hexa('TrimGloss', [[-0.74, 0.25, 2.54], [0.74, 0.25, 2.54], [0.74, 0.21, 2.55], [-0.74, 0.21, 2.55],
      [-0.80, 0.25, 2.30], [0.80, 0.25, 2.30], [0.80, 0.18, 2.30], [-0.80, 0.18, 2.30]]);

    // --- Heck ---
    const zr = -2.49;
    for (const s of SIDES) {
      mb.slab('TailLight', [[s * 0.30, 0.935, zr - 0.012], [s * 0.73, 0.945, zr - 0.012], [s * 0.74, 0.83, zr - 0.012], [s * 0.36, 0.85, zr - 0.012]], [0, 0, 0.03]);
      mb.hexa('TailLight', [[s * 0.73, 0.945, zr - 0.012], [s * 0.81, 0.99, -2.40], [s * 0.83, 0.88, -2.37], [s * 0.74, 0.83, zr - 0.012],
        [s * 0.71, 0.945, zr + 0.03], [s * 0.79, 0.99, -2.37], [s * 0.81, 0.88, -2.34], [s * 0.72, 0.83, zr + 0.03]]);
      mb.slab('LightLens', [[s * 0.40, 0.915, zr - 0.016], [s * 0.68, 0.922, zr - 0.016], [s * 0.685, 0.86, zr - 0.016], [s * 0.43, 0.872, zr - 0.016]], [0, 0, 0.01]);
      const cx = s * 0.56, cy = 0.315;
      mb.prism('Exhaust', hexagon(cx, cy, zr + 0.10, 0.085, 10, 0, 1, 0.55), [0, 0, -0.17]);
      mb.prism('Underbody', hexagon(cx, cy, zr - 0.071, 0.07, 10, 0, 1, 0.5), [0, 0, -0.002]);
      mb.box('TailLight', [s * 0.74 - 0.05, 0.495, zr - 0.045], [s * 0.74 + 0.05, 0.52, zr - 0.03]);
    }
    mb.box('TrimGloss', [-0.36, 0.885, zr - 0.012], [0.36, 0.925, zr + 0.01]);
    mb.box('Plate', [-0.26, 0.62, zr - 0.012], [0.26, 0.73, zr + 0.002]);
    mb.hexa('Paint', [[-0.84, 0.56, zr - 0.035], [0.84, 0.56, zr - 0.035], [0.86, 0.46, zr - 0.04], [-0.86, 0.46, zr - 0.04],
      [-0.86, 0.58, -2.30], [0.86, 0.58, -2.30], [0.88, 0.46, -2.30], [-0.88, 0.46, -2.30]]);
    mb.hexa('TrimGloss', [[-0.72, 0.42, zr - 0.02], [0.72, 0.42, zr - 0.02], [0.70, 0.24, zr - 0.05], [-0.70, 0.24, zr - 0.05],
      [-0.72, 0.42, zr + 0.06], [0.72, 0.42, zr + 0.06], [0.70, 0.20, -2.25], [-0.70, 0.20, -2.25]]);
    for (const x of [-0.30, -0.15, 0, 0.15, 0.30]) mb.box('TrimMatte', [x - 0.012, 0.22, zr - 0.06], [x + 0.012, 0.30, -2.30]);

    // --- Seite ---
    for (const s of SIDES) {
      mb.hexa('TrimGloss', [[s * 0.86, 1.00, 0.80], [s * 1.06, 1.03, 0.74], [s * 1.06, 1.13, 0.74], [s * 0.86, 1.10, 0.80],
        [s * 0.86, 1.00, 0.62], [s * 1.05, 1.02, 0.62], [s * 1.05, 1.12, 0.64], [s * 0.86, 1.09, 0.64]]);
      mb.hexa('HeadLight', [[s * 0.98, 1.02, 0.772], [s * 1.06, 1.035, 0.742], [s * 1.06, 1.045, 0.742], [s * 0.98, 1.03, 0.772],
        [s * 0.98, 1.02, 0.76], [s * 1.05, 1.035, 0.73], [s * 1.05, 1.045, 0.73], [s * 0.98, 1.03, 0.76]]);
      mb.hexa('TrimGloss', [[s * 0.54, 1.425, 0.00], [s * 0.60, 1.425, 0.00], [s * 0.60, 1.465, -0.10], [s * 0.54, 1.465, -0.10],
        [s * 0.54, 1.425, -1.92], [s * 0.59, 1.425, -1.92], [s * 0.59, 1.465, -1.82], [s * 0.54, 1.465, -1.82]]);
      for (const z of [0.22, -0.72]) mb.box('TrimGloss', [s > 0 ? 0.905 : -0.935, 0.90, z - 0.08], [s > 0 ? 0.935 : -0.905, 0.925, z + 0.08]);
      mb.hexa('TrimGloss', [[s * 0.93, 0.27, 1.05], [s * 0.965, 0.25, 1.05], [s * 0.965, 0.15, 1.05], [s * 0.90, 0.15, 1.05],
        [s * 0.93, 0.27, -0.96], [s * 0.965, 0.25, -0.96], [s * 0.965, 0.15, -0.96], [s * 0.90, 0.15, -0.96]]);
      for (const ax of RS6_AXLES) mb.box('Underbody', [s * ax.liner - 0.01, 0.10, ax.z - ax.arch], [s * ax.liner + 0.01, ax.r + ax.arch, ax.z + ax.arch]);
    }
    mb.hexa('TrimGloss', [[-0.60, 1.405, -1.84], [0.60, 1.405, -1.84], [0.60, 1.445, -1.84], [-0.60, 1.445, -1.84],
      [-0.58, 1.37, -2.04], [0.58, 1.37, -2.04], [0.58, 1.39, -2.04], [-0.58, 1.39, -2.04]]);
    mb.hexa('TrimGloss', [[-0.03, 1.44, -1.55], [0.03, 1.44, -1.55], [0.015, 1.50, -1.68], [-0.015, 1.50, -1.68],
      [-0.035, 1.44, -1.76], [0.035, 1.44, -1.76], [0.02, 1.455, -1.76], [-0.02, 1.455, -1.76]]);
    calipers(mb, RS6_AXLES, 0.035);
    return mb;
  }

  // ======================================================================
  // Ferrari 296 (Mittelmotor)
  // ======================================================================
  const F_AXLES = [
    { z: 1.20, r: 0.330, w: 0.245, x: 0.83, arch: 0.40, liner: 0.66 },
    { z: -1.40, r: 0.354, w: 0.305, x: 0.82, arch: 0.42, liner: 0.62 }];
  function ferrariBody() {
    const mb = new MB();
    const loft = makeLoft({
      axles: F_AXLES,
      extraZ: [0.30, -0.40, 1.95, -1.60, 2.05],
      keys: [
        [2.25, .14, .70, .18, .80, .36, .74, .44, .45, .46, .20, .465, .465],
        [2.18, .11, .82, .15, .90, .42, .86, .55, .50, .56, .22, .555, .55],
        [1.85, .10, .86, .14, .965, .52, .91, .70, .58, .66, .25, .62, .61],
        [1.20, .10, .86, .14, .975, .58, .93, .78, .60, .74, .28, .70, .69],
        [0.75, .10, .86, .14, .96, .60, .91, .79, .62, .76, .30, .75, .75],
        [0.70, .10, .86, .14, .96, .60, .91, .795, .80, .78, .72, .785, .79],
        [-0.15, .10, .86, .14, .93, .58, .86, .84, .66, 1.12, .56, 1.17, 1.185],
        [-0.70, .10, .86, .14, .95, .60, .84, .86, .64, 1.10, .54, 1.15, 1.165],
        [-0.95, .10, .86, .14, .97, .62, .90, .84, .62, 1.00, .50, 1.04, 1.05],
        [-1.40, .10, .86, .14, .98, .64, .94, .84, .58, .88, .45, .89, .89],
        [-2.05, .12, .84, .16, .95, .64, .90, .83, .55, .84, .40, .84, .84],
        [-2.25, .16, .80, .20, .90, .62, .84, .80, .50, .81, .35, .81, .81],
        [-2.31, .20, .74, .24, .84, .60, .78, .77, .45, .775, .30, .775, .775]],
      mats: (z0, z1, a0, a1) => {
        const zm = (z0 + z1) / 2;
        const m = ['Underbody', 'Underbody', 'Underbody', 'TrimGloss', 'Paint', 'Paint', 'Paint', 'Paint', 'Paint'];
        if (a0 && a1) m[3] = 'Paint';
        if (Math.abs(z0 - z1) < 1e-6) { m[3] = 'Underbody'; m[4] = 'Underbody'; }
        if (zm > 0.70 && zm < 0.75) { m[7] = 'TrimMatte'; m[8] = 'TrimMatte'; }
        else if (zm > -0.15 && zm < 0.70) { m[6] = zm < 0.30 ? 'Glass' : 'Paint'; m[7] = 'TrimGloss'; m[8] = 'Glass'; }
        else if (zm > -0.95 && zm < -0.15) { m[6] = 'Glass'; }
        else if (zm > -1.60 && zm < -0.95) { m[7] = 'TrimGloss'; m[8] = 'Glass'; }
        return m;
      },
    });
    loft.build(mb);

    // --- Front ---
    const zf = 2.25;
    mb.slab('TrimGloss', [[-0.50, 0.37, zf + 0.012], [0.50, 0.37, zf + 0.012], [0.42, 0.17, zf + 0.012], [-0.42, 0.17, zf + 0.012]], [0, 0, -0.04]);
    for (const y of [0.22, 0.27, 0.32]) mb.box('Grille', [-0.45 + (0.37 - y) * 0.2, y - 0.008, zf + 0.012], [0.45 - (0.37 - y) * 0.2, y + 0.008, zf + 0.022]);
    mb.box('Paint', [-0.10, 0.17, zf + 0.012], [0.10, 0.37, zf + 0.03]);
    mb.hexa('TrimGloss', [[-0.72, 0.15, zf + 0.04], [0.72, 0.15, zf + 0.04], [0.72, 0.11, zf + 0.05], [-0.72, 0.11, zf + 0.05],
      [-0.80, 0.15, 2.00], [0.80, 0.15, 2.00], [0.80, 0.09, 2.00], [-0.80, 0.09, 2.00]]);
    for (const s of SIDES) {
      mb.slab('TrimMatte', [[s * 0.55, 0.36, zf + 0.012], [s * 0.76, 0.38, zf + 0.012], [s * 0.74, 0.18, zf + 0.012], [s * 0.48, 0.17, zf + 0.012]], [0, 0, -0.03]);
      loft.decal(mb, 'LightLens', [[2.17, 5.25], [2.17, 6.25], [1.90, 6.40], [1.90, 5.65]], s, 0.018, 0.04);
      loft.decal(mb, 'HeadLight', [[2.165, 5.95], [2.165, 6.15], [1.91, 6.33], [1.91, 6.18]], s, 0.026, 0);
      loft.decal(mb, 'TrimGloss', [[1.98, 8.15], [1.98, 8.55], [1.72, 8.60], [1.72, 8.20]], s, 0.01, 0.03);
    }

    // --- Heck ---
    const zr = -2.31;
    for (const s of SIDES) {
      for (const [x0, x1] of [[0.30, 0.50], [0.55, 0.76]]) {
        mb.slab('TailLight', [[s * x0, 0.735, zr - 0.012], [s * x1, 0.74, zr - 0.012], [s * x1, 0.685, zr - 0.012], [s * x0, 0.69, zr - 0.012]], [0, 0, 0.03]);
      }
      mb.slab('TrimMatte', [[s * 0.62, 0.62, zr - 0.012], [s * 0.80, 0.60, zr - 0.012], [s * 0.78, 0.30, zr - 0.012], [s * 0.66, 0.30, zr - 0.012]], [0, 0, 0.03]);
    }
    mb.slab('TrimGloss', [[-0.58, 0.64, zr - 0.012], [0.58, 0.64, zr - 0.012], [0.56, 0.40, zr - 0.012], [-0.56, 0.40, zr - 0.012]], [0, 0, 0.03]);
    for (const y of [0.45, 0.50, 0.55, 0.60]) mb.box('Grille', [-0.54, y - 0.007, zr - 0.02], [0.54, y + 0.007, zr - 0.012]);
    mb.prism('Exhaust', hexagon(0, 0.52, zr + 0.10, 0.14, 10, 0, 1, 0.45), [0, 0, -0.17]);
    mb.prism('Underbody', hexagon(0, 0.52, zr - 0.071, 0.12, 10, 0, 1, 0.38), [0, 0, -0.002]);
    mb.box('Plate', [-0.26, 0.26, zr - 0.012], [0.26, 0.37, zr + 0.002]);
    mb.hexa('TrimGloss', [[-0.76, 0.25, zr - 0.03], [0.76, 0.25, zr - 0.03], [0.74, 0.12, zr - 0.07], [-0.74, 0.12, zr - 0.07],
      [-0.76, 0.25, zr + 0.06], [0.76, 0.25, zr + 0.06], [0.74, 0.10, -2.00], [-0.74, 0.10, -2.00]]);
    for (const x of [-0.45, -0.25, 0.25, 0.45]) mb.box('TrimMatte', [x - 0.012, 0.11, zr - 0.08], [x + 0.012, 0.22, -2.05]);
    mb.hexa('Paint', [[-0.78, 0.77, zr], [0.78, 0.77, zr], [0.78, 0.81, zr - 0.04], [-0.78, 0.81, zr - 0.04],
      [-0.80, 0.80, -2.15], [0.80, 0.80, -2.15], [0.80, 0.83, -2.15], [-0.80, 0.83, -2.15]]);

    // --- Seite ---
    const zf_ = F_AXLES[0].z - F_AXLES[0].arch, zr_ = F_AXLES[1].z + F_AXLES[1].arch;
    for (const s of SIDES) {
      loft.decal(mb, 'TrimMatte', [[-0.50, 4.85], [-0.50, 5.55], [-0.93, 6.05], [-0.93, 4.35]], s, 0.01, 0.06);
      mb.hexa('Paint', [[s * 0.86, 0.80, 0.42], [s * 1.02, 0.83, 0.38], [s * 1.02, 0.92, 0.38], [s * 0.86, 0.89, 0.42],
        [s * 0.86, 0.80, 0.26], [s * 1.01, 0.82, 0.26], [s * 1.01, 0.90, 0.28], [s * 0.86, 0.88, 0.28]]);
      mb.box('TrimGloss', [s * 0.84 - 0.02, 0.79, 0.30], [s * 0.84 + 0.02, 0.83, 0.36]);
      mb.hexa('TrimGloss', [[s * 0.93, 0.17, zf_], [s * 0.97, 0.15, zf_], [s * 0.97, 0.08, zf_], [s * 0.88, 0.08, zf_],
        [s * 0.93, 0.17, zr_], [s * 0.97, 0.15, zr_], [s * 0.97, 0.08, zr_], [s * 0.88, 0.08, zr_]]);
      for (const ax of F_AXLES) mb.box('Underbody', [s * ax.liner - 0.01, 0.08, ax.z - ax.arch], [s * ax.liner + 0.01, ax.r + ax.arch, ax.z + ax.arch]);
    }
    calipers(mb, F_AXLES, 0.03);
    return mb;
  }

  // ======================================================================
  // three.js-Aufbau
  // ======================================================================
  const toHex = (c) => (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);

  function makeMaterials(THREE, o) {
    const def = {
      Paint: [o.paint, 0.0, o.paintRough],
      Glass: [[0.03, 0.035, 0.04], 0.0, 0.12],
      TrimGloss: [[0.04, 0.04, 0.045], 0.2, 0.18],
      TrimMatte: [[0.05, 0.05, 0.05], 0.0, 0.75],
      Underbody: [[0.03, 0.03, 0.03], 0.0, 0.9],
      Grille: [[0.10, 0.10, 0.11], 0.5, 0.35],
      HeadLight: [[0.9, 0.95, 1.0], 0.0, 0.2, [1, 1, 1]],
      LightLens: [[0.10, 0.11, 0.14], 0.5, 0.06],
      TailLight: [[0.75, 0.02, 0.02], 0.0, 0.25, [0.8, 0, 0]],
      Plate: [[0.92, 0.92, 0.90], 0.0, 0.5],
      Exhaust: [[0.25, 0.25, 0.27], 1.0, 0.3],
      Tire: [[0.07, 0.07, 0.07], 0.0, 0.92],
      Rim: [o.rim, 0.85, 0.3],
      RimInner: [[0.08, 0.08, 0.09], 0.6, 0.5],
      BrakeDisc: [[0.45, 0.45, 0.46], 1.0, 0.45],
      Caliper: [o.caliper, 0.2, 0.35],
    };
    const mats = {};
    for (const [name, [col, metal, rough, emi]] of Object.entries(def)) {
      const p = { color: new THREE.Color(typeof col === 'string' ? col : toHex(col)), metalness: metal, roughness: rough };
      let m;
      if (name === 'Paint') m = new THREE.MeshPhysicalMaterial(Object.assign(p, { clearcoat: 1, clearcoatRoughness: 0.05 }));
      else m = new THREE.MeshStandardMaterial(p);
      if (emi) { m.emissive = new THREE.Color(toHex(emi)); m.emissiveIntensity = 2; }
      m.name = name;
      mats[name] = m;
    }
    return mats;
  }

  function toMesh(THREE, mb, mats, name) {
    const geo = new THREE.BufferGeometry();
    let total = 0;
    for (const m in mb.t) total += mb.t[m].length;
    const pos = new Float32Array(total * 3);
    const list = [];
    let v = 0;
    for (const m in mb.t) {
      const start = v;
      for (const p of mb.t[m]) { pos[v * 3] = p[0]; pos[v * 3 + 1] = p[1]; pos[v * 3 + 2] = p[2]; v++; }
      geo.addGroup(start, v - start, list.length);
      list.push(mats[m]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();          // nicht indiziert -> flache Facetten-Normalen
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, list);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function assemble(THREE, name, bodyMB, axles, o, size) {
    const mats = makeMaterials(THREE, o);
    const car = new THREE.Group();
    car.name = name;
    car.add(toMesh(THREE, bodyMB, mats, 'Body'));
    const wheels = {}, wheelGeo = axles.map((ax) => toMesh(THREE, buildWheel(ax.r, ax.w), mats, 'Wheel'));
    axles.forEach((ax, ai) => {
      for (const s of SIDES) {
        const id = (ai === 0 ? 'F' : 'R') + (s > 0 ? 'L' : 'R');
        const pivot = new THREE.Group();          // Lenkung (rotation.y)
        pivot.name = 'Wheel_' + id;
        pivot.position.set(s * ax.x, ax.r, ax.z);
        const spinner = new THREE.Group();         // Rollen (rotation.x)
        const mesh = wheelGeo[ai].clone();
        if (s < 0) mesh.rotation.y = Math.PI;      // Felgenseite nach aussen
        spinner.add(mesh);
        pivot.add(spinner);
        car.add(pivot);
        wheels[id] = { pivot, spinner, r: ax.r, front: ai === 0 };
      }
    });
    car.userData = {
      wheels, materials: mats, size,
      update(dt, speed, steer) {
        for (const w of Object.values(wheels)) {
          w.spinner.rotation.x += (speed || 0) * dt / w.r;
          if (w.front) w.pivot.rotation.y = steer || 0;
        }
      },
      setLights(on) { mats.HeadLight.emissiveIntensity = on ? 2 : 0; mats.TailLight.emissiveIntensity = on ? 2 : 0.3; },
      setPaint(color) { mats.Paint.color.set(color); },
    };
    return car;
  }

  const opt = (o, d) => Object.assign({}, d, o || {});

  function createRS6(THREE, options) {
    const o = opt(options, { paint: [0.45, 0.47, 0.48], paintRough: 0.32, rim: [0.46, 0.47, 0.49], caliper: [0.75, 0.05, 0.04] });
    return assemble(THREE, 'RS6_Avant', rs6Body(), RS6_AXLES, o, { length: 4.99, width: 1.95, height: 1.47 });
  }

  function createFerrari(THREE, options) {
    const o = opt(options, { paint: [0.80, 0.02, 0.02], paintRough: 0.25, rim: [0.32, 0.33, 0.35], caliper: [0.95, 0.78, 0.05] });
    return assemble(THREE, 'Ferrari_296', ferrariBody(), F_AXLES, o, { length: 4.56, width: 1.96, height: 1.19 });
  }

  const api = { createRS6, createFerrari };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DildiCars = api;
})(typeof window !== 'undefined' ? window : globalThis);
