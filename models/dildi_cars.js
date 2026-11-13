/*
 * dildi_cars.js - Zwei Low-Poly-Autos fuer dildi City (three.js)
 * ==============================================================
 *  - createRS6(THREE, opts)      Kombi im Stil eines RS6 Avant (Nardo-Grau)
 *  - createFerrari(THREE, opts)  Mittelmotor-Sportwagen im Stil eines Ferrari 296 (Rosso Corsa)
 *
 * Stil: echte Abmessungen, aber kantig/facettiert (Flat-Shading) - passt in eine Low-Poly-Stadt.
 * Die Geometrie wird hier per Code erzeugt, es werden KEINE externen Dateien/Texturen geladen.
 *
 * ---------------------------------------------------------------------------------------------
 * EINBAU IN DILDI CITY 3D (Hinweis fuer die KI im dildi-City-Chat)
 * Diese Datei muss VOR dem Spiel-Code geladen sein (oder Inhalt oben ins Script kopieren).
 * THREE = das three.js-Namespace-Objekt des Spiels (import * as THREE from 'three').
 *
 * 1) FAHRZEUGE  -  Typen: 'rs6', 'ferrari', 'skoda', 'police', 'taxi', 'van'
 *    Die Funktion, die Fahrzeugmodelle baut (bekommt typ, farbe, tuning und gibt
 *    { group, tilt, body, lights, wheels:[{piv,w,front}], wheelR, siren } zurueck), ganz am Anfang:
 *
 *      if (DildiCars.types.includes(typ)) {
 *        const extra = [];   // optional: Tuning-Geometrien (Spoiler/Panzerung) hier rein
 *        return DildiCars.dildiCityVehicle(THREE, typ, farbe,
 *          { body: <Karosserie-Material mit vertexColors>,
 *            lights: <Licht-Material mit vertexColors>.clone(),
 *            wheel: <Rad-Material mit vertexColors> }, extra);
 *      }
 *    - Lackfarbe ueber "farbe" (Dildi Customs funktioniert weiter), Explosion ueber
 *      body.geometry.attributes.color funktioniert weiter.
 *    - 'police' liefert siren:{red,blue} (das Spiel laesst sie wie bisher blinken).
 *    - 'van': Seitenwaende sitzen bei x = +-0.975, die Flaschenpost-Beklebung liegt sauber an.
 *    - Masse passen zur Fahrzeugliste: RS6 5.0x1.95, Ferrari 4.6x1.96, Skoda 4.7x1.83, Van 5.1x1.95.
 *
 * 2) FLUGZEUG  -  in der Funktion, die das Flugzeug baut (gibt { root, tilt, prop } zurueck):
 *      return DildiCars.dildiCityPlane(THREE, farbe, { body: <bisheriges Flugzeug-Material mit vertexColors> });
 *    Nase = +Z, Propeller dreht wie bisher ueber prop.rotation.z, Raeder auf y = 0.
 *
 * 3) GEBAEUDE  -  die bestehenden Gebaeude (Waende, Kollision, Innenraum, Logik) BLEIBEN.
 *    Direkt nach dem Bau des jeweiligen Gebaeudes nur eine Fassaden-Deko hinzufuegen:
 *      const deko = DildiCars.dildiCityBuilding(THREE, art, params);  scene.add(deko);
 *      W.signMats.push(deko.userData.glow);   // optional: Leuchtteile wie die Schilder behandeln
 *    Parameter (x0/x1 = Aussenwaende links/rechts, z0 = Front-/Strassenseite, an der das Schild haengt):
 *    - 'pizza'   { x0, x1, z0, z1, h: 7.2 }   = genau das Rechteck der Pizza-Capri-Waende.
 *                Die alte gruene Markise (Box ueber der Front auf ~3.6 m Hoehe) bitte entfernen.
 *    - 'depot'   { x0, x1, z0, z1, h: 10.2 }  = Flaschenpost-Halle (Tore bei x0+8, x0+22, x0+36).
 *    - 'customs' { x0, x1, z0, z1, h: 11.2 }  = Dildi Customs, Torseite = x0 (Front zeigt nach -x).
 *    - 'bank'    { x0, x1, zFront, zBack, cx, h: 14 } = Hauptgebaeude der Bank (Aussenwaende),
 *                zFront = Frontwand mit dem Eingang, cx = Mitte des Eingangs. Eingang bleibt frei,
 *                Saeulen-Positionen werden wie im Spiel berechnet (Basis + goldenes Kapitell).
 *    Nichts davon ragt in Eingaenge oder Fahrwege; es wird keine Kollision hinzugefuegt.
 * ---------------------------------------------------------------------------------------------
 *
 * ALTERNATIV (eigenstaendige Nutzung in anderen three.js-Projekten):
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
        const wm = Math.max(wm0, spec.archW || 0.975);
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

  // Punkt an einer abgeschraegten Front/Heck-Ecke nach aussen schieben
  const cornerOut = (p, d, s, x0, dx, dir) => {
    const t = Math.min(1, Math.max(0, (Math.abs(p[0]) - x0) / dx));
    let nrm = [s * t * 0.8, 0, dir * (1 - 0.4 * t)];
    nrm = mul(nrm, 1 / len(nrm));
    return add(p, mul(nrm, d));
  };

  // ======================================================================
  // Skoda Octavia (Limousine/Liftback) - Varianten: '' | 'police' | 'taxi'
  // ======================================================================
  const OCT_AXLES = [
    { z: 1.435, r: 0.32, w: 0.225, x: 0.78, arch: 0.38, liner: 0.60 },
    { z: -1.255, r: 0.32, w: 0.225, x: 0.78, arch: 0.38, liner: 0.60 }];
  function octaviaBody(variant) {
    const mb = new MB();
    const loft = makeLoft({
      axles: OCT_AXLES, archW: 0.915,
      extraZ: [0.45, -0.70, -0.80, -1.62, 1.90, -0.40],
      keys: [
        [2.345, .25, .62, .30, .78, .52, .72, .68, .48, .70, .22, .71, .71],
        [2.29, .19, .74, .26, .88, .58, .83, .76, .56, .78, .25, .79, .795],
        [2.00, .15, .80, .23, .905, .64, .86, .84, .58, .87, .27, .88, .885],
        [1.435, .14, .82, .23, .915, .68, .88, .90, .60, .93, .29, .94, .945],
        [0.85, .14, .82, .23, .91, .70, .87, .97, .62, 1.00, .31, 1.01, 1.015],
        [0.80, .14, .82, .23, .91, .70, .87, .975, .76, .985, .68, .995, 1.00],
        [-0.05, .14, .82, .23, .905, .70, .85, 1.00, .66, 1.40, .58, 1.455, 1.47],
        [-0.85, .14, .82, .23, .905, .70, .85, 1.01, .66, 1.40, .58, 1.45, 1.465],
        [-1.30, .14, .82, .23, .91, .71, .85, 1.02, .64, 1.36, .56, 1.41, 1.425],
        [-2.10, .16, .80, .25, .89, .72, .82, 1.00, .58, 1.04, .50, 1.05, 1.055],
        [-2.30, .22, .76, .30, .86, .70, .78, .98, .55, 1.00, .45, 1.005, 1.01],
        [-2.345, .27, .70, .34, .80, .68, .72, .94, .50, .95, .40, .955, .955]],
      mats: (z0, z1, a0, a1) => {
        const zm = (z0 + z1) / 2;
        const m = ['Underbody', 'Underbody', 'Underbody', 'TrimMatte', 'Paint', 'Paint', 'Paint', 'Paint', 'Paint'];
        if (a0 && a1) m[3] = 'Paint';
        if (Math.abs(z0 - z1) < 1e-6) { m[3] = 'Underbody'; m[4] = 'Underbody'; }
        if (zm > 0.80 && zm < 0.85) { m[7] = 'TrimMatte'; m[8] = 'TrimMatte'; }
        else if (zm > -0.05 && zm < 0.80) { m[6] = zm < 0.45 ? 'Glass' : 'Paint'; m[7] = 'TrimGloss'; m[8] = 'Glass'; }
        else if (zm > -1.30 && zm < -0.05) { m[6] = (zm > -0.80 && zm < -0.70) ? 'TrimGloss' : 'Glass'; m[7] = 'TrimGloss'; }
        else if (zm > -2.10 && zm < -1.30) { m[6] = zm > -1.62 ? 'Glass' : 'Paint'; m[7] = 'TrimGloss'; m[8] = 'Glass'; }
        return m;
      },
    });
    loft.build(mb);
    const zf = 2.345, zr = -2.345;
    // Front: Grill mit Chromrahmen + senkrechten Lamellen, unterer Einlass, Kennzeichen
    const gr = [[-0.36, 0.665], [0.36, 0.665], [0.32, 0.53], [-0.32, 0.53]];
    mb.slab('Chrome', gr.map(([x, y]) => [x, y, zf + 0.018]), [0, 0, -0.04]);
    mb.slab('TrimGloss', gr.map(([x, y]) => [x * 0.93, y > 0.6 ? y - 0.012 : y + 0.012, zf + 0.022]), [0, 0, -0.04]);
    for (let i = -6; i <= 6; i++) mb.box('Grille', [i * 0.05 - 0.008, 0.545, zf + 0.022], [i * 0.05 + 0.008, 0.65, zf + 0.03]);
    mb.slab('TrimMatte', [[-0.56, 0.38, zf + 0.012], [0.56, 0.38, zf + 0.012], [0.50, 0.25, zf + 0.012], [-0.50, 0.25, zf + 0.012]], [0, 0, -0.04]);
    mb.box('Plate', [-0.26, 0.40, zf + 0.012], [0.26, 0.51, zf + 0.024]);
    // Heck: Kennzeichen, Stossfaenger unten schwarz
    mb.box('Plate', [-0.26, 0.62, zr - 0.012], [0.26, 0.73, zr + 0.002]);
    mb.hexa('TrimMatte', [[-0.80, 0.42, zr - 0.02], [0.80, 0.42, zr - 0.02], [0.78, 0.26, zr - 0.03], [-0.78, 0.26, zr - 0.03],
      [-0.82, 0.42, -2.20], [0.82, 0.42, -2.20], [0.80, 0.24, -2.20], [-0.80, 0.24, -2.20]]);
    for (const s of SIDES) {
      // Scheinwerfer (schmal, eckig) + Tagfahrlicht
      const co = (p, d) => cornerOut(p, d, s, 0.70, 0.16, 1);
      const lens = [[s * 0.40, 0.700, zf], [s * 0.78, 0.765, 2.29], [s * 0.84, 0.675, 2.255], [s * 0.44, 0.625, zf]];
      mb.hexa('LightLens', lens.map((p) => co(p, 0.02)).concat(lens.map((p) => co(p, -0.05))));
      const drl = [[s * 0.42, 0.636, zf], [s * 0.82, 0.69, 2.262], [s * 0.83, 0.675, 2.256], [s * 0.43, 0.624, zf]];
      mb.hexa('HeadLight', drl.map((p) => co(p, 0.028)).concat(drl.map((p) => co(p, 0))));
      mb.hexa('HeadLight', [[s * 0.55, 0.70, zf], [s * 0.66, 0.72, zf], [s * 0.66, 0.66, zf], [s * 0.55, 0.645, zf]].map((p) => co(p, 0.026))
        .concat([[s * 0.55, 0.70, zf], [s * 0.66, 0.72, zf], [s * 0.66, 0.66, zf], [s * 0.55, 0.645, zf]].map((p) => co(p, 0))));
      // Nebelscheinwerfer
      mb.box('HeadLight', [s * 0.62 - 0.05, 0.30, zf - 0.005], [s * 0.62 + 0.05, 0.33, zf + 0.012]);
      // Rueckleuchten (C-Form angedeutet) + Ecke
      const cr = (p, d) => cornerOut(p, d, s, 0.70, 0.16, -1);
      const tl = [[s * 0.42, 0.93, zr], [s * 0.76, 0.93, zr], [s * 0.76, 0.82, zr], [s * 0.46, 0.84, zr]];
      mb.hexa('TailLight', tl.map((p) => cr(p, 0.014)).concat(tl.map((p) => cr(p, -0.04))));
      mb.hexa('TailLight', [[s * 0.76, 0.93, zr - 0.014], [s * 0.85, 0.97, -2.27], [s * 0.86, 0.86, -2.25], [s * 0.76, 0.82, zr - 0.014],
        [s * 0.74, 0.93, zr + 0.04], [s * 0.83, 0.97, -2.24], [s * 0.84, 0.86, -2.22], [s * 0.74, 0.82, zr + 0.04]]);
      mb.slab('LightLens', [[s * 0.50, 0.905, zr - 0.017], [s * 0.70, 0.905, zr - 0.017], [s * 0.70, 0.855, zr - 0.017], [s * 0.52, 0.86, zr - 0.017]], [0, 0, 0.01]);
      mb.box('TailLight', [s * 0.70 - 0.05, 0.38, zr - 0.032], [s * 0.70 + 0.05, 0.40, zr - 0.02]);
      // Spiegel, Tuergriffe, Schweller, Radhaeuser
      mb.hexa('Paint', [[s * 0.84, 0.98, 0.76], [s * 1.0, 1.0, 0.71], [s * 1.0, 1.09, 0.71], [s * 0.84, 1.07, 0.76],
        [s * 0.84, 0.98, 0.60], [s * 0.99, 0.99, 0.60], [s * 0.99, 1.08, 0.62], [s * 0.84, 1.06, 0.62]]);
      mb.box('TrimGloss', [s * 0.84 - 0.03, 0.97, 0.62], [s * 0.84 + 0.03, 1.0, 0.72]);
      for (const z of [0.15, -0.95]) mb.box('Chrome', [s > 0 ? 0.885 : -0.905, 0.90, z - 0.07], [s > 0 ? 0.905 : -0.885, 0.92, z + 0.07]);
      for (const ax of OCT_AXLES) mb.box('Underbody', [s * ax.liner - 0.01, 0.10, ax.z - ax.arch], [s * ax.liner + 0.01, ax.r + ax.arch, ax.z + ax.arch]);
      // Varianten-Beklebung an der Seite
      if (variant === 'police') {
        loft.decal(mb, 'PoliceBlue', [[1.00, 4.15], [1.00, 4.95], [-1.0, 4.95], [-1.0, 4.15]], s, 0.006, 0.01, 2, 6);
        loft.decal(mb, 'PoliceYellow', [[1.00, 4.95], [1.00, 5.05], [-1.0, 5.05], [-1.0, 4.95]], s, 0.006, 0.01, 1, 6);
      } else if (variant === 'taxi') {
        loft.decal(mb, 'TrimGloss', [[0.90, 4.55], [0.90, 4.75], [-1.0, 4.75], [-1.0, 4.55]], s, 0.006, 0.01, 1, 6);
      }
    }
    mb.hexa('TrimGloss', [[-0.03, 1.465, -0.75], [0.03, 1.465, -0.75], [0.015, 1.52, -0.86], [-0.015, 1.52, -0.86],
      [-0.035, 1.46, -0.95], [0.035, 1.46, -0.95], [0.02, 1.47, -0.95], [-0.02, 1.47, -0.95]]);
    if (variant === 'police') {
      // Haube-Streifen + Lichtbalken-Basis (die blinkenden Teile kommen als "siren")
      loft.decal(mb, 'PoliceBlue', [[2.25, 8.0], [2.25, 9.0], [0.88, 9.0], [0.88, 8.0]], 1, 0.004, 0.01, 2, 3);
      loft.decal(mb, 'PoliceBlue', [[2.25, 8.0], [2.25, 9.0], [0.88, 9.0], [0.88, 8.0]], -1, 0.004, 0.01, 2, 3);
      mb.box('TrimGloss', [-0.62, 1.465, -0.52], [0.62, 1.52, -0.28]);
    } else if (variant === 'taxi') {
      mb.box('TrimGloss', [-0.30, 1.465, -0.55], [0.30, 1.49, -0.35]);
      mb.hexa('TaxiSign', [[-0.30, 1.49, -0.36], [0.30, 1.49, -0.36], [0.27, 1.65, -0.40], [-0.27, 1.65, -0.40],
        [-0.30, 1.49, -0.54], [0.30, 1.49, -0.54], [0.27, 1.65, -0.50], [-0.27, 1.65, -0.50]]);
    }
    calipers(mb, OCT_AXLES, 0.03);
    return mb;
  }

  // ======================================================================
  // VW Transporter (Kastenwagen) - Seitenwaende fast senkrecht, damit
  // Beklebungen des Spiels (Flaschenpost) sauber anliegen
  // ======================================================================
  const VAN_AXLES = [
    { z: 1.60, r: 0.35, w: 0.235, x: 0.82, arch: 0.41, liner: 0.62 },
    { z: -1.40, r: 0.35, w: 0.235, x: 0.82, arch: 0.41, liner: 0.62 }];
  function vanBody() {
    const mb = new MB();
    const loft = makeLoft({
      axles: VAN_AXLES, archW: 0.975,
      extraZ: [1.90, 0.70, 0.62, 0.0, -0.8],
      keys: [
        [2.55, .30, .80, .36, .90, .62, .86, .92, .62, .95, .30, .96, .96],
        [2.48, .24, .86, .30, .95, .66, .92, 1.02, .66, 1.05, .32, 1.06, 1.07],
        [2.15, .20, .88, .28, .97, .70, .955, 1.15, .70, 1.18, .34, 1.19, 1.20],
        [2.10, .20, .88, .28, .97, .70, .96, 1.16, .88, 1.17, .82, 1.18, 1.19],
        [1.35, .20, .88, .28, .97, .72, .965, 1.18, .935, 1.88, .82, 1.96, 1.98],
        [-2.40, .22, .88, .30, .97, .72, .965, 1.20, .945, 1.88, .82, 1.96, 1.98],
        [-2.55, .30, .82, .36, .93, .70, .925, 1.18, .90, 1.86, .78, 1.93, 1.95]],
      mats: (z0, z1, a0, a1) => {
        const zm = (z0 + z1) / 2;
        const m = ['Underbody', 'Underbody', 'Underbody', 'TrimMatte', 'Paint', 'Paint', 'Paint', 'Paint', 'Paint'];
        if (a0 && a1) m[3] = 'Paint';
        if (Math.abs(z0 - z1) < 1e-6) { m[3] = 'Underbody'; m[4] = 'Underbody'; }
        if (zm > 2.10 && zm < 2.15) { m[7] = 'TrimMatte'; m[8] = 'TrimMatte'; }
        else if (zm > 1.35 && zm < 2.10) { m[6] = zm < 1.90 ? 'Glass' : 'Paint'; m[7] = 'TrimGloss'; m[8] = 'Glass'; }
        else if (zm > 0.70 && zm < 1.35) { m[6] = 'Glass'; m[7] = 'TrimGloss'; }
        else if (zm > 0.62 && zm < 0.70) { m[6] = 'TrimGloss'; }
        return m;
      },
    });
    loft.build(mb);
    const zf = 2.55, zr = -2.55;
    // Front: Chrom-Querstreben zwischen den Scheinwerfern, grosser unterer Grill, Stossfaenger
    mb.slab('TrimGloss', [[-0.56, 0.93, zf + 0.012], [0.56, 0.93, zf + 0.012], [0.56, 0.76, zf + 0.012], [-0.56, 0.76, zf + 0.012]], [0, 0, -0.05]);
    for (const y of [0.80, 0.85, 0.90]) mb.box('Chrome', [-0.54, y - 0.007, zf + 0.012], [0.54, y + 0.007, zf + 0.022]);
    mb.hexa('TrimMatte', [[-0.90, 0.66, zf + 0.04], [0.90, 0.66, zf + 0.04], [0.88, 0.30, zf + 0.05], [-0.88, 0.30, zf + 0.05],
      [-0.94, 0.66, 2.30], [0.94, 0.66, 2.30], [0.92, 0.30, 2.30], [-0.92, 0.30, 2.30]]);
    mb.slab('TrimGloss', [[-0.58, 0.62, zf + 0.052], [0.58, 0.62, zf + 0.052], [0.50, 0.36, zf + 0.055], [-0.50, 0.36, zf + 0.055]], [0, 0, -0.03]);
    for (const y of [0.44, 0.52]) mb.box('Grille', [-0.52, y - 0.006, zf + 0.055], [0.52, y + 0.006, zf + 0.062]);
    mb.box('Plate', [-0.26, 0.36, zf + 0.056], [0.26, 0.47, zf + 0.066]);
    // Heck: zwei Fluegeltueren mit Fenstern, hohe Leuchten, Stossfaenger, 3. Bremsleuchte
    for (const s of SIDES) mb.slab('Glass', [[s * 0.06, 1.80, zr - 0.012], [s * 0.78, 1.80, zr - 0.012], [s * 0.78, 1.32, zr - 0.012], [s * 0.06, 1.32, zr - 0.012]], [0, 0, 0.03]);
    mb.box('TrimGloss', [-0.012, 0.42, zr - 0.014], [0.012, 1.86, zr + 0.01]);
    mb.box('TailLight', [-0.25, 1.875, zr - 0.012], [0.25, 1.905, zr + 0.01]);
    mb.box('Plate', [-0.26, 0.66, zr - 0.012], [0.26, 0.77, zr + 0.002]);
    mb.hexa('TrimMatte', [[-0.92, 0.58, zr - 0.05], [0.92, 0.58, zr - 0.05], [0.90, 0.30, zr - 0.05], [-0.90, 0.30, zr - 0.05],
      [-0.95, 0.58, -2.30], [0.95, 0.58, -2.30], [0.93, 0.30, -2.30], [-0.93, 0.30, -2.30]]);
    for (const s of SIDES) {
      // Scheinwerfer (eckig) + LED-Leiste
      const co = (p, d) => cornerOut(p, d, s, 0.80, 0.14, 1);
      const lens = [[s * 0.56, 0.95, zf], [s * 0.88, 0.97, 2.50], [s * 0.92, 0.80, 2.47], [s * 0.56, 0.77, zf]];
      mb.hexa('LightLens', lens.map((p) => co(p, 0.022)).concat(lens.map((p) => co(p, -0.05))));
      const drl = [[s * 0.58, 0.79, zf], [s * 0.90, 0.82, 2.475], [s * 0.905, 0.80, 2.47], [s * 0.58, 0.775, zf]];
      mb.hexa('HeadLight', drl.map((p) => co(p, 0.03)).concat(drl.map((p) => co(p, 0))));
      mb.box('HeadLight', [s * 0.70 - 0.07, 0.86, zf + 0.012], [s * 0.70 + 0.07, 0.93, zf + 0.03]);
      // Rueckleuchten senkrecht an den Ecken
      mb.slab('TailLight', [[s * 0.80, 1.45, zr - 0.012], [s * 0.93, 1.45, zr - 0.012], [s * 0.93, 0.95, zr - 0.012], [s * 0.80, 0.95, zr - 0.012]], [0, 0, 0.03]);
      mb.slab('LightLens', [[s * 0.82, 1.20, zr - 0.016], [s * 0.91, 1.20, zr - 0.016], [s * 0.91, 1.10, zr - 0.016], [s * 0.82, 1.10, zr - 0.016]], [0, 0, 0.01]);
      mb.box('Chrome', [s * 0.40 - 0.06, 1.15, zr - 0.02], [s * 0.40 + 0.06, 1.18, zr - 0.005]);
      // grosse Spiegel
      mb.hexa('TrimGloss', [[s * 0.95, 1.22, 1.98], [s * 1.14, 1.24, 1.92], [s * 1.14, 1.46, 1.92], [s * 0.95, 1.44, 1.98],
        [s * 0.95, 1.22, 1.84], [s * 1.13, 1.23, 1.84], [s * 1.13, 1.45, 1.86], [s * 0.95, 1.43, 1.86]]);
      // Schiebetuer-Schiene, Tuergriffe
      mb.box('TrimGloss', [s > 0 ? 0.962 : -0.982, 1.50, -1.55], [s > 0 ? 0.982 : -0.962, 1.53, 0.66]);
      for (const z of [1.10, 0.45]) mb.box('TrimGloss', [s > 0 ? 0.965 : -0.985, 1.05, z - 0.08], [s > 0 ? 0.985 : -0.965, 1.08, z + 0.08]);
      for (const ax of VAN_AXLES) mb.box('Underbody', [s * ax.liner - 0.01, 0.12, ax.z - ax.arch], [s * ax.liner + 0.01, ax.r + ax.arch, ax.z + ax.arch]);
    }
    calipers(mb, VAN_AXLES, 0.03);
    return mb;
  }

  // ======================================================================
  // Flugzeug (einmotoriger Hochdecker, ~9.8 m lang, 11.2 m Spannweite)
  // Nase = +Z, Raeder stehen auf y = 0. Propeller dreht um die lokale Z-Achse.
  // ======================================================================
  function planeParts() {
    const mb = new MB(), prop = new MB();
    // Rumpf: achteckige Querschnitte (z, unten, oben, halbe Breite)
    const S = [
      [4.65, 0.98, 1.62, 0.40], [4.30, 0.86, 1.78, 0.54], [3.40, 0.78, 1.92, 0.61], [2.70, 0.76, 1.98, 0.62],
      [1.75, 0.76, 2.50, 0.62], [0.00, 0.78, 2.50, 0.62], [-0.70, 0.84, 2.46, 0.60], [-1.60, 0.98, 2.22, 0.50],
      [-3.40, 1.30, 1.98, 0.30], [-5.00, 1.58, 1.96, 0.12]];
    const ring = ([z, b, t, w]) => {
      const h = t - b;
      const r = [[0, b], [w * 0.72, b], [w, b + h * 0.30], [w, b + h * 0.62], [w * 0.82, t - h * 0.04], [0, t]];
      return r.map(([x, y]) => [x, y, z]);
    };
    const R = S.map(ring);
    const segMat = (zm, k) => {
      if (k <= 1) return 'Paint';
      if (k === 2) return 'PlaneWhite';
      if (k === 3) {
        if (zm < 2.70 && zm > -1.60) return (zm > 0.95 && zm < 1.05) || (zm > -0.75 && zm < -0.65) ? 'TrimGloss' : 'Glass';
        return 'PlaneWhite';
      }
      if (zm < 2.70 && zm > 1.75) return 'Glass';   // Frontscheibe
      return 'PlaneWhite';
    };
    for (let i = 0; i < R.length - 1; i++) {
      const zm = (S[i][0] + S[i + 1][0]) / 2;
      for (let k = 0; k < 5; k++) {
        const a = R[i][k], b = R[i + 1][k], c = R[i + 1][k + 1], d = R[i][k + 1];
        const m = segMat(zm, k);
        mb.quad(m, a, b, c, d);
        mb.quad(m, mirror(a), mirror(d), mirror(c), mirror(b));
      }
    }
    // Rumpfenden zumachen
    const cap = (r, facing) => {
      const full = r.concat(r.slice().reverse().slice(1, -1).map(mirror));
      let c = [0, 0, 0];
      full.forEach((p) => { c = add(c, p); });
      c = mul(c, 1 / full.length);
      for (let i = 0; i < full.length; i++) {
        const a = full[i], b = full[(i + 1) % full.length];
        if (facing > 0) mb.tri('Grille', c, a, b); else mb.tri('Paint', c, b, a);
      }
    };
    cap(R[0], 1); cap(R[R.length - 1], -1);
    // Tragflaeche (Hochdecker) mit V-Stellung, Spitzen in Lackfarbe
    for (const s of SIDES) {
      const root = { x: 0.55, y: 2.50, zl: 1.75, zt: 0.05, th: 0.17 }, tip = { x: 5.30, y: 2.66, zl: 1.55, zt: 0.25, th: 0.10 };
      const sec = (p) => [[s * p.x, p.y, p.zl], [s * p.x, p.y + p.th, p.zl - (p.zl - p.zt) * 0.28], [s * p.x, p.y + p.th * 0.4, p.zt], [s * p.x, p.y - 0.02, p.zl - (p.zl - p.zt) * 0.35]];
      const a = sec(root), b = sec(tip);
      mb.convex('PlaneWhite', [a, b, [a[0], a[1], b[1], b[0]], [a[1], a[2], b[2], b[1]], [a[2], a[3], b[3], b[2]], [a[3], a[0], b[0], b[3]]]);
      const tp = { x: 5.62, y: 2.68, zl: 1.50, zt: 0.32, th: 0.08 };
      const c = sec(tp);
      mb.convex('Paint', [b, c, [b[0], b[1], c[1], c[0]], [b[1], b[2], c[2], c[1]], [b[2], b[3], c[3], c[2]], [b[3], b[0], c[0], c[3]]]);
      mb.box(s > 0 ? 'NavRed' : 'NavGreen', [s * 5.64 - 0.04, 2.66, 1.30], [s * 5.64 + 0.04, 2.74, 1.42]);
      // Fluegelstrebe
      mb.hexa('Exhaust', [[s * 0.58, 1.02, 0.95], [s * 0.58, 1.08, 0.95], [s * 0.58, 1.08, 0.82], [s * 0.58, 1.02, 0.82],
        [s * 2.40, 2.48, 0.95], [s * 2.40, 2.54, 0.95], [s * 2.40, 2.54, 0.82], [s * 2.40, 2.48, 0.82]]);
      // Hauptfahrwerk: Federbein, Radverkleidung, Rad
      mb.hexa('Exhaust', [[s * 0.58, 0.88, 1.06], [s * 0.58, 0.95, 1.06], [s * 0.58, 0.95, 0.94], [s * 0.58, 0.88, 0.94],
        [s * 1.10, 0.36, 1.06], [s * 1.10, 0.43, 1.06], [s * 1.10, 0.43, 0.94], [s * 1.10, 0.36, 0.94]]);
      const wx = s * 1.15;
      mb.prism('Tire', hexagon(0.30, 0, 0, 0.30, 12, 0, 1, 1).map(([zz, y]) => [wx - 0.09, 0.30 + y, 1.0 + zz - 0.30]), [0.18, 0, 0]);
      mb.hexa('Paint', [[wx - 0.14, 0.42, 1.45], [wx + 0.14, 0.42, 1.45], [wx + 0.12, 0.66, 1.25], [wx - 0.12, 0.66, 1.25],
        [wx - 0.14, 0.42, 0.55], [wx + 0.14, 0.42, 0.55], [wx + 0.12, 0.62, 0.75], [wx - 0.12, 0.62, 0.75]]);
    }
    // Bugrad
    mb.box('Exhaust', [-0.04, 0.22, 3.56], [0.04, 0.90, 3.64]);
    mb.prism('Tire', hexagon(0.2, 0, 0, 0.2, 10, 0, 1, 1).map(([zz, y]) => [-0.06, 0.20 + y, 3.6 + zz - 0.2]), [0.12, 0, 0]);
    // Hoehenleitwerk + Seitenleitwerk
    for (const s of SIDES) {
      mb.slab('PlaneWhite', [[0, 1.84, -4.02], [s * 1.8, 1.86, -4.42], [s * 1.8, 1.86, -4.95], [0, 1.84, -4.99]], [0, 0.06, 0]);
      mb.slab('Paint', [[s * 1.62, 1.855, -4.38], [s * 1.81, 1.858, -4.42], [s * 1.81, 1.858, -4.96], [s * 1.62, 1.855, -4.96]], [0, 0.07, 0]);
    }
    const fin = [[-0.06, 1.90, -3.20], [-0.03, 3.20, -4.40], [-0.03, 3.20, -5.04], [-0.06, 1.90, -5.02]];
    mb.hexa('Paint', fin.concat(fin.map(([x, y, z]) => [-x, y, z])));
    for (const s of SIDES) {
      mb.slab('PlaneWhite', [[s * 0.062, 2.30, -3.95], [s * 0.05, 2.75, -4.30], [s * 0.05, 2.75, -4.50], [s * 0.062, 2.30, -4.40]], [s * 0.004, 0, 0]);
      mb.slab('TailLight', [[s * 0.05, 2.80, -4.36], [s * 0.035, 3.10, -4.58], [s * 0.035, 3.10, -5.02], [s * 0.05, 2.80, -5.01]], [s * 0.004, 0, 0]);
    }
    // Motorhaube: Lufteinlaesse + Auspuff
    for (const s of SIDES) mb.box('TrimGloss', [s * 0.18 - 0.1, 1.00, 4.62], [s * 0.18 + 0.1, 1.12, 4.70]);
    mb.prism('Exhaust', hexagon(0.35, 0.86, 3.6, 0.04, 6, 0, 1, 1), [0, -0.02, -0.35]);
    // Propeller (eigenes Mesh, Mitte = Drehpunkt): Spinner + 2 Blaetter
    const sp = hexagon(0, 0, -0.18, 0.22, 8, 0, 1, 1);
    prop.convex('Paint', [sp].concat(sp.map((p, i) => [p, sp[(i + 1) % 8], [0, 0, 0.18]])));
    for (const s of SIDES) {
      prop.hexa('TrimGloss', [[s * 0.10, -0.06, 0.02], [s * 1.15, -0.04, 0.0], [s * 1.15, 0.04, -0.02], [s * 0.10, 0.07, -0.04],
        [s * 0.10, -0.06, -0.04], [s * 1.15, -0.04, -0.03], [s * 1.15, 0.04, -0.05], [s * 0.10, 0.07, -0.08]]);
      prop.box('PlaneTip', [s * 1.05 - 0.05, -0.045, -0.05], [s * 1.15, 0.045, 0.005]);
    }
    return { mb, prop };
  }

  // Gibt genau das zurueck, was die Flugzeug-Baufunktion von Dildi City 3D liefert: { root, tilt, prop }
  function dildiCityPlane(THREE, color, mats) {
    const { mb, prop } = planeParts();
    const paint = new THREE.Color(color || '#2471a3');
    const fixed = Object.assign({}, SRGB, { PlaneWhite: [0.93, 0.93, 0.92], NavRed: [1, 0.1, 0.1], NavGreen: [0.1, 1, 0.2], PlaneTip: [0.95, 0.75, 0.1] });
    const cache = {};
    const colorOf = (m) => (m === 'Paint' ? paint : cache[m] || (cache[m] = new THREE.Color().setRGB(...(fixed[m] || [0.5, 0.5, 0.5]), THREE.SRGBColorSpace)));
    const body = new THREE.Mesh(vcGeometry(THREE, mb, () => true, colorOf), mats.body);
    body.castShadow = true;
    const p = new THREE.Mesh(vcGeometry(THREE, prop, () => true, colorOf), mats.prop || mats.body);
    p.position.set(0, 1.30, 4.88);
    const root = new THREE.Group(), tilt = new THREE.Group();
    tilt.add(body, p);
    root.add(tilt);
    return { root, tilt, prop: p };
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
      Chrome: [[0.78, 0.79, 0.81], 1.0, 0.15],
      PoliceBlue: [[0.12, 0.31, 0.66], 0.1, 0.4],
      PoliceYellow: [[0.79, 0.83, 0.0], 0.0, 0.4],
      TaxiSign: [[1.0, 0.97, 0.85], 0.0, 0.3, [1, 0.95, 0.8]],
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

  // ======================================================================
  // Direkter Anschluss an Dildi City 3D
  // ======================================================================
  // Liefert genau das Objekt, das die Fahrzeug-Baufunktion von Dildi City 3D zurueckgibt:
  //   { group, tilt, body, lights, wheels:[{piv, w, front}], wheelR, siren:null }
  // - body:   EIN Mesh, Geometrie mit Vertex-Farben (Lack = color), Material = mats.body
  // - lights: EIN Mesh mit Vertex-Farben (Scheinwerfer weiss, Ruecklichter rot), Material = mats.lights
  // - wheels: piv = Lenk-Pivot (rotation.y), w = Rad-Mesh (rotation.x = Rollen), Material = mats.wheel
  // extraGeos: optionale weitere Geometrien (z. B. Spoiler/Panzerung aus dem Tuning), werden in body gemischt.
  const SRGB = {
    Glass: [0.03, 0.035, 0.04], TrimGloss: [0.04, 0.04, 0.045], TrimMatte: [0.06, 0.06, 0.06],
    Underbody: [0.03, 0.03, 0.03], Grille: [0.12, 0.12, 0.13], LightLens: [0.10, 0.11, 0.14],
    Plate: [0.92, 0.92, 0.90], Exhaust: [0.45, 0.45, 0.47], Tire: [0.07, 0.07, 0.07],
    RimInner: [0.08, 0.08, 0.09], BrakeDisc: [0.45, 0.45, 0.46],
    HeadLight: [1.0, 0.98, 0.9], TailLight: [1.0, 0.1, 0.1], TaxiSign: [1.0, 0.95, 0.75],
    Chrome: [0.70, 0.71, 0.73], PoliceBlue: [0.12, 0.31, 0.66], PoliceYellow: [0.79, 0.83, 0.0],
  };

  function vcGeometry(THREE, mb, pick, colorOf, xform) {
    let n = 0;
    for (const m in mb.t) if (pick(m)) n += mb.t[m].length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let v = 0;
    for (const m in mb.t) {
      if (!pick(m)) continue;
      const c = colorOf(m);
      for (const p0 of mb.t[m]) {
        const p = xform ? xform(p0) : p0;
        pos.set(p, v * 3); col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; v++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  function mergeVC(THREE, geos) {        // einfache Zusammenfuehrung (position/normal/color)
    const parts = geos.map((g) => {
      g = g.index ? g.toNonIndexed() : g;
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color) {
        const c = new Float32Array(g.attributes.position.count * 3).fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      return g;
    });
    const out = new THREE.BufferGeometry();
    for (const a of ['position', 'normal', 'color']) {
      const total = parts.reduce((s, g) => s + g.attributes[a].count * 3, 0);
      const arr = new Float32Array(total);
      let o = 0;
      for (const g of parts) { const src = g.attributes[a]; for (let i = 0; i < src.count; i++) { arr[o++] = src.getX(i); arr[o++] = src.getY(i); arr[o++] = src.getZ(i); } }
      out.setAttribute(a, new THREE.BufferAttribute(arr, 3));
    }
    out.computeBoundingSphere();
    return out;
  }

  const RED_CAL = [0.75, 0.05, 0.04], GREY_CAL = [0.35, 0.36, 0.38];
  const VEHICLES = {
    rs6: { body: () => rs6Body(), axles: RS6_AXLES, paint: '#8e9397', rim: [0.55, 0.56, 0.58], caliper: RED_CAL },
    ferrari: { body: () => ferrariBody(), axles: F_AXLES, paint: '#d40000', rim: [0.32, 0.33, 0.35], caliper: [0.95, 0.78, 0.05] },
    skoda: { body: () => octaviaBody(''), axles: OCT_AXLES, paint: '#7f8c8d', rim: [0.62, 0.63, 0.65], caliper: GREY_CAL },
    police: { body: () => octaviaBody('police'), axles: OCT_AXLES, paint: '#e8eef5', rim: [0.62, 0.63, 0.65], caliper: GREY_CAL, siren: true },
    taxi: { body: () => octaviaBody('taxi'), axles: OCT_AXLES, paint: '#f4c20d', rim: [0.62, 0.63, 0.65], caliper: GREY_CAL },
    van: { body: () => vanBody(), axles: VAN_AXLES, paint: '#f5f5f5', rim: [0.60, 0.61, 0.63], caliper: GREY_CAL },
  };

  function dildiCityVehicle(THREE, type, color, mats, extraGeos) {
    const V = VEHICLES[type];
    if (!V) throw new Error('DildiCars: unbekannter Fahrzeugtyp ' + type);
    const mb = V.body();
    const axles = V.axles;
    const paint = new THREE.Color(color || V.paint);
    const caliper = new THREE.Color().setRGB(...V.caliper, THREE.SRGBColorSpace);
    const rim = new THREE.Color().setRGB(...V.rim, THREE.SRGBColorSpace);
    const cache = {};
    const colorOf = (m) => {
      if (m === 'Paint') return paint;
      if (m === 'Caliper') return caliper;
      if (m === 'Rim') return rim;
      return cache[m] || (cache[m] = new THREE.Color().setRGB(...(SRGB[m] || [0.5, 0.5, 0.5]), THREE.SRGBColorSpace));
    };
    const isLight = (m) => m === 'HeadLight' || m === 'TailLight' || m === 'TaxiSign';
    let bodyGeo = vcGeometry(THREE, mb, (m) => !isLight(m), colorOf);
    if (extraGeos && extraGeos.length) bodyGeo = mergeVC(THREE, [bodyGeo].concat(extraGeos));
    const lightGeo = vcGeometry(THREE, mb, isLight, colorOf);

    const body = new THREE.Mesh(bodyGeo, mats.body);
    body.castShadow = true;
    const lights = new THREE.Mesh(lightGeo, mats.lights);
    const group = new THREE.Group(), tilt = new THREE.Group();
    tilt.add(body, lights);
    group.add(tilt);
    const wheels = [];
    axles.forEach((ax, ai) => {
      const wmb = buildWheel(ax.r, ax.w);
      const geoL = vcGeometry(THREE, wmb, () => true, colorOf);
      const geoR = vcGeometry(THREE, wmb, () => true, colorOf, (p) => [-p[0], p[1], -p[2]]);  // Felge nach aussen
      for (const s of SIDES) {
        const piv = new THREE.Group();
        piv.position.set(s * ax.x, ax.r, ax.z);
        const w = new THREE.Mesh(s > 0 ? geoL : geoR, mats.wheel);
        w.castShadow = true;
        piv.add(w);
        group.add(piv);
        wheels.push({ piv, w, front: ai === 0 });
      }
    });
    let siren = null;
    if (V.siren) {   // Blaulicht: das Spiel setzt red/blue.material.color selbst (blinken)
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.22), new THREE.MeshBasicMaterial({ color: '#ff0000', toneMapped: false }));
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.22), new THREE.MeshBasicMaterial({ color: '#0044ff', toneMapped: false }));
      red.position.set(-0.3, 1.58, -0.4);
      blue.position.set(0.3, 1.58, -0.4);
      tilt.add(red, blue);
      siren = { red, blue };
    }
    return { group, tilt, body, lights, wheels, wheelR: axles[1].r, siren };
  }

  // ======================================================================
  // Gebaeude-Aufwertungen fuer Dildi City 3D
  // Die Grundgebaeude (Waende, Kollision, Innenraum, Logik) bleiben unveraendert -
  // hier kommt nur Fassaden-Deko dazu, die keine Eingaenge oder Wege versperrt.
  // Rueckgabe: THREE.Group mit .userData.glow (Material der Leuchtteile, z. B. fuer W.signMats)
  // ======================================================================
  const BPAL = {
    Brick: [0.55, 0.24, 0.17], Cream: [0.96, 0.92, 0.84], Terracotta: [0.72, 0.36, 0.22], GreenTrim: [0.10, 0.36, 0.20],
    AwnRed: [0.80, 0.12, 0.10], AwnWhite: [0.96, 0.95, 0.92], AwnGreen: [0.10, 0.50, 0.25], Wood: [0.35, 0.20, 0.10],
    DarkGlass: [0.08, 0.10, 0.13], Crust: [0.85, 0.58, 0.25], Cheese: [0.98, 0.80, 0.30], Pepperoni: [0.70, 0.12, 0.08],
    Steel: [0.55, 0.57, 0.60], DarkSteel: [0.22, 0.23, 0.25], Rib: [0.70, 0.82, 0.72], Hazard: [0.98, 0.78, 0.05], Black: [0.05, 0.05, 0.06],
    BottleGreen: [0.10, 0.45, 0.18], Label: [0.95, 0.95, 0.90], Gold: [0.83, 0.66, 0.22], Marble: [0.93, 0.91, 0.86],
    FlagPink: [1.0, 0.24, 0.94], Rubber: [0.07, 0.07, 0.07], Checker: [0.95, 0.95, 0.95],
    // Leuchtteile
    GlowWarm: [1.0, 0.85, 0.55], GlowWin: [1.0, 0.78, 0.45], GlowPink: [1.0, 0.24, 0.94], GlowCyan: [0.2, 0.9, 1.0], GlowWhite: [1.0, 1.0, 0.95],
  };

  function pizzaDecor(d, g, p) {
    const { x0, x1, z0, z1, h } = p, W = x1 - x0, cx = (x0 + x1) / 2, f = z0;   // Front = -z bei z0
    d.box('Brick', [x0 - 0.06, 0.2, f - 0.1], [x1 + 0.06, 1.0, f + 0.02]);                       // Sockel
    d.box('Terracotta', [x0 - 0.3, h - 0.15, f - 0.35], [x1 + 0.3, h + 0.3, z1 + 0.3]);         // Gesims
    d.box('Brick', [x1 - 3.0, h, z1 - 3.0], [x1 - 1.8, h + 2.6, z1 - 1.8]);                      // Kamin
    d.box('Black', [x1 - 3.1, h + 2.6, z1 - 3.1], [x1 - 1.7, h + 2.8, z1 - 1.7]);
    // Erdgeschoss: Tuer in der Mitte, Schaufenster links/rechts
    d.box('GreenTrim', [cx - 1.0, 0.2, f - 0.12], [cx + 1.0, 2.8, f + 0.01]);
    d.box('Wood', [cx - 0.8, 0.2, f - 0.14], [cx + 0.8, 2.6, f - 0.1]);
    d.box('Gold', [cx + 0.5, 1.2, f - 0.18], [cx + 0.58, 1.6, f - 0.14]);
    for (const s of SIDES) {
      for (let x = cx + s * 2.2; s > 0 ? x < x1 - 1.6 : x > x0 + 1.6; x += s * 3.2) {
        const a = Math.min(x, x + s * 2.6), b = Math.max(x, x + s * 2.6);
        if (b > x1 - 0.8 || a < x0 + 0.8) continue;
        d.box('GreenTrim', [a - 0.12, 1.0, f - 0.12], [b + 0.12, 3.05, f + 0.01]);
        g.box('GlowWin', [a, 1.12, f - 0.14], [b, 2.93, f - 0.12]);
        d.box('GreenTrim', [a, 2.0, f - 0.17], [b, 2.06, f - 0.13]);
      }
      g.box('GlowWarm', [cx + s * 1.35 - 0.12, 2.2, f - 0.35], [cx + s * 1.35 + 0.12, 2.6, f - 0.12]);  // Wandlampen
    }
    // Markise rot-weiss gestreift (ersetzt die gruene Markise)
    let i = 0;
    for (let x = x0 - 0.4; x < x1 + 0.4 - 1e-6; x += 0.6, i++) {
      const xe = Math.min(x + 0.6, x1 + 0.4), m = i % 2 ? 'AwnWhite' : 'AwnRed';
      d.hexa(m, [[x, 4.05, f - 0.02], [xe, 4.05, f - 0.02], [xe, 3.35, f - 2.3], [x, 3.35, f - 2.3],
        [x, 4.13, f - 0.02], [xe, 4.13, f - 0.02], [xe, 3.43, f - 2.3], [x, 3.43, f - 2.3]]);
      d.box(m, [x, 3.0, f - 2.34], [xe, 3.43, f - 2.28]);
    }
    for (let x = x0; x <= x1 + 1e-6; x += 1.2) g.box('GlowWarm', [x - 0.07, 2.88, f - 2.40], [x + 0.07, 3.0, f - 2.30]);
    // Obergeschoss: Fenster mit gruenen Laeden (nicht hinter dem Schild in der Mitte)
    for (let x = x0 + 2.0; x < x1 - 2.0; x += 3.0) {
      if (Math.abs(x - cx) < 7.2) continue;
      d.box('Cream', [x - 0.75, 4.5, f - 0.08], [x + 0.75, 6.3, f + 0.01]);
      g.box('GlowWin', [x - 0.55, 4.65, f - 0.1], [x + 0.55, 6.15, f - 0.08]);
      for (const s of SIDES) d.box('GreenTrim', [x + s * 0.6 - 0.25, 4.6, f - 0.16], [x + s * 0.6 + 0.25, 6.2, f - 0.1]);
      d.box('Terracotta', [x - 0.8, 4.4, f - 0.25], [x + 0.8, 4.52, f]);
    }
    // Riesen-Pizza auf dem Dach
    const pz = f + 1.2, py = h + 2.5;
    for (const s of SIDES) d.box('DarkSteel', [cx + s * 0.9 - 0.08, h + 0.3, pz + 0.05], [cx + s * 0.9 + 0.08, py, pz + 0.2]);
    d.prism('Crust', hexagon(cx, py, pz, 2.0, 14, 0, 1, 1), [0, 0, -0.18]);
    d.prism('Cheese', hexagon(cx, py, pz - 0.18, 1.72, 14, 0, 1, 1), [0, 0, -0.05]);
    for (const [ox, oy] of [[0, 0], [0.9, 0.5], [-0.8, 0.7], [0.7, -0.8], [-0.9, -0.5], [0.05, 1.15], [0.1, -1.2], [1.25, -0.15], [-1.25, 0.1]])
      d.prism('Pepperoni', hexagon(cx + ox, py + oy, pz - 0.23, 0.22, 8, 0, 1, 1), [0, 0, -0.04]);
    for (let k = 0; k < 3; k++) {   // Schnittlinien
      const a = k * Math.PI / 3;
      d.hexa('Crust', [[cx - Math.cos(a) * 1.7 - 0.02 * Math.sin(a), py - Math.sin(a) * 1.7, pz - 0.24], [cx + Math.cos(a) * 1.7, py + Math.sin(a) * 1.7, pz - 0.24],
        [cx + Math.cos(a) * 1.7, py + Math.sin(a) * 1.7 + 0.04, pz - 0.24], [cx - Math.cos(a) * 1.7, py - Math.sin(a) * 1.7 + 0.04, pz - 0.24],
        [cx - Math.cos(a) * 1.7, py - Math.sin(a) * 1.7, pz - 0.27], [cx + Math.cos(a) * 1.7, py + Math.sin(a) * 1.7, pz - 0.27],
        [cx + Math.cos(a) * 1.7, py + Math.sin(a) * 1.7 + 0.04, pz - 0.27], [cx - Math.cos(a) * 1.7, py - Math.sin(a) * 1.7 + 0.04, pz - 0.27]]);
    }
  }

  function depotDecor(d, g, p) {
    const { x0, x1, z0, z1, h } = p, cx = (x0 + x1) / 2, f = z0;
    const doors = [0, 1, 2].map((i) => x0 + 8 + i * 14);
    const nearDoor = (x) => doors.some((dx) => Math.abs(x - dx) < 3.9);
    // Wellblech-Rippen auf Front und Seiten
    for (let x = x0 + 0.5; x < x1 - 0.3; x += 1.0) {
      const y0 = nearDoor(x) ? 5.95 : 0.25;
      d.box('Rib', [x - 0.07, y0, f - 0.06], [x + 0.07, h - 0.1, f + 0.01]);
    }
    for (const xs of [x0, x1]) for (let z = z0 + 0.8; z < z1 - 0.3; z += 1.0)
      d.box('Rib', [xs === x0 ? xs - 0.06 : xs - 0.01, 0.25, z - 0.07], [xs === x0 ? xs + 0.01 : xs + 0.06, h - 0.1, z + 0.07]);
    // Tore: Warnmarkierung schwarz-gelb + Lampen + Rammschutz
    for (const dx of doors) {
      for (const s of SIDES) {
        for (let y = 0.2, k = 0; y < 5.8; y += 0.5, k++) d.box(k % 2 ? 'Black' : 'Hazard', [dx + s * 3.75 - 0.2, y, f - 0.2], [dx + s * 3.75 + 0.2, Math.min(y + 0.5, 5.8), f + 0.01]);
        d.box('Black', [dx + s * 3.2 - 0.25, 0.2, f - 0.45], [dx + s * 3.2 + 0.25, 1.0, f - 0.15]);
      }
      d.box('Hazard', [dx - 3.95, 5.8, f - 0.2], [dx + 3.95, 6.1, f + 0.01]);
      d.box('DarkSteel', [dx - 0.5, 6.35, f - 0.5], [dx + 0.5, 6.55, f]);
      g.box('GlowWhite', [dx - 0.42, 6.28, f - 0.46], [dx + 0.42, 6.35, f - 0.04]);
    }
    // Buero-Fenster oben (nicht hinter dem grossen Schild)
    for (let x = x0 + 2.5; x < x1 - 2.0; x += 3.0) {
      if (Math.abs(x - cx) < 11.8) continue;
      d.box('DarkSteel', [x - 1.1, 7.0, f - 0.1], [x + 1.1, 8.7, f + 0.01]);
      g.box('GlowWin', [x - 0.95, 7.12, f - 0.12], [x + 0.95, 8.58, f - 0.1]);
    }
    // Dachkante, Lueftungsgeraete, Oberlichter
    d.box('Steel', [x0 - 0.15, h - 0.1, z0 - 0.15], [x1 + 0.15, h + 0.5, z0 + 0.15]);
    d.box('Steel', [x0 - 0.15, h - 0.1, z1 - 0.15], [x1 + 0.15, h + 0.5, z1 + 0.15]);
    d.box('Steel', [x0 - 0.15, h - 0.1, z0], [x0 + 0.15, h + 0.5, z1]);
    d.box('Steel', [x1 - 0.15, h - 0.1, z0], [x1 + 0.15, h + 0.5, z1]);
    for (let i = 0; i < 3; i++) {
      const ax = x1 - 6 - i * 5, az = z1 - 5;
      d.box('Steel', [ax - 1.4, h, az - 1.0], [ax + 1.4, h + 1.3, az + 1.0]);
      d.prism('DarkSteel', hexagon(ax, az, 0, 0.75, 10, 0, 1, 1).map(([x, z]) => [x, h + 1.3, z]), [0, 0.08, 0]);
    }
    for (let x = x0 + 14; x < x1 - 16; x += 7) d.slab('DarkGlass', [[x, h + 0.02, z0 + 9], [x + 3, h + 0.02, z0 + 9], [x + 3, h + 0.02, z1 - 9], [x, h + 0.02, z1 - 9]], [0, 0.4, 0]);
    // Riesige Flaschenpost-Flasche auf dem Dach
    const bx = x0 + 5, bz = z0 + 4.5;
    const ring = (r, y, n = 8) => hexagon(bx, bz, 0, r, n, Math.PI / 8, 1, 1).map(([x, z]) => [x, y, z]);
    d.prism('BottleGreen', ring(1.3, h + 0.2), [0, 3.4, 0]);
    d.prism('Label', ring(1.34, h + 1.2), [0, 1.3, 0]);
    d.convex('BottleGreen', [ring(1.3, h + 3.6), ring(0.5, h + 4.6)].concat(ring(1.3, h + 3.6).map((p, i, a) => [p, a[(i + 1) % 8], ring(0.5, h + 4.6)[(i + 1) % 8], ring(0.5, h + 4.6)[i]])));
    d.prism('BottleGreen', ring(0.45, h + 4.6), [0, 1.5, 0]);
    d.prism('Gold', ring(0.52, h + 6.1), [0, 0.35, 0]);
  }

  function customsDecor(d, g, p) {
    const { x0, x1, z0, z1, h } = p, cz = (z0 + z1) / 2, f = x0;   // Front = -x bei x0
    const doors = [0, 1, 2].map((i) => z0 + 7 + i * 14);
    // Neon-Rahmen um die Front + Dachkante
    g.box('GlowPink', [f - 0.2, h - 0.35, z0 - 0.1], [f - 0.05, h - 0.15, z1 + 0.1]);
    g.box('GlowCyan', [f - 0.2, 0.25, z0 - 0.1], [f - 0.05, 0.4, z1 + 0.1]);
    for (const zz of [z0, z1]) g.box('GlowPink', [f - 0.2, 0.25, zz - 0.1], [f - 0.05, h - 0.15, zz + 0.1]);
    for (const zz of [z0, z1]) g.box('GlowCyan', [x0, h - 0.35, zz === z0 ? zz - 0.2 : zz + 0.05], [x1, h - 0.15, zz === z0 ? zz - 0.05 : zz + 0.2]);
    // Zielflaggen-Band unter dem Schild
    let k = 0;
    for (let z = z0; z < z1 - 1e-6; z += 0.4, k++) {
      for (let r = 0; r < 2; r++) d.box((k + r) % 2 ? 'Black' : 'Checker', [f - 0.1, 6.25 + r * 0.25, z], [f + 0.01, 6.5 + r * 0.25, Math.min(z + 0.4, z1)]);
    }
    // Tore: helle Lichtleisten oben, Neon-Saeulen dazwischen
    for (const dz of doors) {
      g.box('GlowWhite', [f - 0.35, 6.0, dz - 4.2], [f - 0.15, 6.08, dz + 4.2]);
      d.box('DarkSteel', [f - 0.4, 6.05, dz - 4.4], [f, 6.2, dz + 4.4]);
    }
    for (let i = 0; i < 2; i++) g.box('GlowPink', [f - 0.2, 0.3, doors[i] + 6.7], [f - 0.08, 5.9, doors[i] + 7.3]);
    // Reifenstapel an den Ecken
    for (const [tx, tz] of [[f - 1.4, z0 + 1.2], [f - 1.4, z1 - 1.2], [f - 1.2, z0 + 2.8]]) {
      for (let n = 0; n < 3; n++) {
        d.prism('Rubber', hexagon(tx, tz, 0, 0.42, 12, 0, 1, 1).map(([x, z]) => [x, 0.22 + n * 0.26, z]), [0, 0.24, 0]);
        d.prism('Steel', hexagon(tx, tz, 0, 0.22, 10, 0, 1, 1).map(([x, z]) => [x, 0.23 + n * 0.26, z]), [0, 0.245, 0]);
      }
    }
    // Strahler am Dach, die aufs Schild zeigen
    for (const dz of [-6, 0, 6]) {
      d.box('DarkSteel', [f - 0.9, h + 0.05, cz + dz - 0.2], [f - 0.3, h + 0.35, cz + dz + 0.2]);
      g.box('GlowWhite', [f - 0.92, h + 0.0, cz + dz - 0.15], [f - 0.85, h + 0.1, cz + dz + 0.15]);
    }
    // Show-Auto auf dem Dach: pinker RS6 auf Podest (Schraeg zur Strasse)
    const car = rs6Body(), wh = buildWheel(0.365, 0.285);
    const ang = -Math.PI / 2 + 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
    const px = x0 + 6.5, pz = cz, py = h + 0.5;
    const place = (q) => [px + q[0] * ca + q[2] * sa, py + q[1], pz - q[0] * sa + q[2] * ca];
    d.prism('DarkSteel', hexagon(px, pz, 0, 3.4, 12, 0, 1, 1).map(([x, z]) => [x, h, z]), [0, 0.5, 0]);
    g.prism('GlowPink', hexagon(px, pz, 0, 3.45, 12, 0, 1, 1).map(([x, z]) => [x, h + 0.38, z]), [0, 0.08, 0]);
    const carMat = (m) => (m === 'Paint' ? 'FlagPink' : m === 'HeadLight' ? 'GlowWhite' : m === 'TailLight' ? 'Pepperoni' : 'CAR_' + m);
    for (const m in car.t) for (let i = 0; i < car.t[m].length; i += 3) d.tri(carMat(m), place(car.t[m][i]), place(car.t[m][i + 1]), place(car.t[m][i + 2]));
    for (const ax of RS6_AXLES) for (const s of SIDES) {
      for (const m in wh.t) for (let i = 0; i < wh.t[m].length; i += 3) {
        const tr = (q) => place(s > 0 ? [q[0] + ax.x, q[1] + ax.r, q[2] + ax.z] : [-q[0] - ax.x, q[1] + ax.r, -q[2] + ax.z]);
        d.tri('CAR_' + m, tr(wh.t[m][i]), tr(wh.t[m][i + 1]), tr(wh.t[m][i + 2]));
      }
    }
  }

  function bankDecor(d, g, p) {
    const { x0: N, x1: X, zFront: M, zBack: z, cx: L } = p, H = p.h || 14;
    const tt = 3.2;
    // Saeulen: Basis + Kapitell (gleiche Positionen wie im Spiel)
    for (let c = 0; c < 8; c++) {
      const e = N + 2 + c * ((X - N - 4) / 7);
      if (Math.abs(e - L) < tt + 0.8) continue;
      const cz = M - 2.2;
      d.box('Marble', [e - 0.95, 0.68, cz - 0.95], [e + 0.95, 0.98, cz + 0.95]);
      d.box('Marble', [e - 0.85, 0.98, cz - 0.85], [e + 0.85, 1.15, cz + 0.85]);
      d.box('Marble', [e - 0.8, 10.25, cz - 0.8], [e + 0.8, 10.45, cz + 0.8]);
      d.box('Gold', [e - 1.0, 10.45, cz - 1.0], [e + 1.0, 10.72, cz + 1.0]);
    }
    // Gebaelk: goldenes Band + Zahnschnitt, Wappen im Giebel
    d.box('Gold', [N - 0.55, 11.05, M - 4.16], [X + 0.55, 11.4, M - 4.08]);
    for (let x = N - 0.3; x < X + 0.4; x += 0.6) d.box('Marble', [x - 0.15, 11.6, M - 4.25], [x + 0.15, 11.85, M - 4.08]);
    d.prism('Gold', hexagon(L, 13.1, M - 4.12, 1.0, 16, 0, 1, 1), [0, 0, -0.12]);
    d.prism('Marble', hexagon(L, 13.1, M - 4.24, 0.72, 16, 0, 1, 1), [0, 0, -0.04]);
    d.box('Gold', [L - 0.12, 12.7, M - 4.32], [L + 0.12, 13.5, M - 4.26]);
    d.box('Gold', [L - 0.35, 12.7, M - 4.32], [L - 0.1, 12.82, M - 4.26]);
    d.box('Gold', [L - 0.35, 13.38, M - 4.32], [L - 0.1, 13.5, M - 4.26]);
    // Goldenes Gesims oben an der Front + Balustrade auf dem Dach
    d.box('Gold', [N - 0.1, H - 0.45, M - 0.12], [X + 0.1, H - 0.1, M + 0.02]);
    const rail = (ax0, az0, ax1, az1) => {
      const n = Math.max(1, Math.round(Math.hypot(ax1 - ax0, az1 - az0) / 0.55));
      for (let i = 0; i <= n; i++) {
        const x = ax0 + (ax1 - ax0) * i / n, zz = az0 + (az1 - az0) * i / n;
        d.box('Marble', [x - 0.1, H, zz - 0.1], [x + 0.1, H + 0.85, zz + 0.1]);
      }
      d.box('Marble', [Math.min(ax0, ax1) - 0.18, H + 0.85, Math.min(az0, az1) - 0.18], [Math.max(ax0, ax1) + 0.18, H + 1.05, Math.max(az0, az1) + 0.18]);
    };
    rail(N + 0.3, M + 0.4, X - 0.3, M + 0.4); rail(N + 0.3, z - 0.4, X - 0.3, z - 0.4);
    rail(N + 0.4, M + 0.4, N + 0.4, z - 0.4); rail(X - 0.4, M + 0.4, X - 0.4, z - 0.4);
    // Fahnenmasten
    for (const fx of [N + 2, X - 2]) {
      d.box('Steel', [fx - 0.06, H + 1.05, M + 1.4], [fx + 0.06, H + 7.5, M + 1.52]);
      d.box('Gold', [fx - 0.12, H + 7.5, M + 1.34], [fx + 0.12, H + 7.7, M + 1.58]);
      d.box('FlagPink', [fx + 0.06, H + 5.6, M + 1.44], [fx + 2.2, H + 7.3, M + 1.48]);
      d.box('Gold', [fx + 0.06, H + 6.3, M + 1.43], [fx + 2.2, H + 6.6, M + 1.49]);
    }
    // Eingang: goldener Rahmen (bleibt offen), Laternen, Geldautomaten, Kameras
    for (const s of SIDES) {
      d.box('Gold', [L + s * tt - (s > 0 ? 0 : 0.35), 0.4, M - 0.12], [L + s * tt + (s > 0 ? 0.35 : 0), 5.6, M + 0.02]);
      d.box('DarkSteel', [L + s * 4.6 - 0.18, 2.6, M - 0.35], [L + s * 4.6 + 0.18, 3.0, M - 0.05]);
      g.box('GlowWarm', [L + s * 4.6 - 0.15, 3.0, M - 0.32], [L + s * 4.6 + 0.15, 3.7, M - 0.08]);
      d.box('DarkSteel', [L + s * 4.6 - 0.2, 3.7, M - 0.35], [L + s * 4.6 + 0.2, 3.85, M - 0.05]);
      const ax = L + s * 7.0;
      d.box('DarkSteel', [ax - 0.55, 0.7, M - 0.22], [ax + 0.55, 2.4, M + 0.01]);
      g.box('GlowCyan', [ax - 0.35, 1.6, M - 0.24], [ax + 0.35, 2.1, M - 0.22]);
      d.box('Black', [ax - 0.25, 1.15, M - 0.26], [ax + 0.25, 1.25, M - 0.22]);
      d.box('DarkSteel', [N + 0.2 + (s > 0 ? X - N - 0.6 : 0), 7.0, M - 0.6], [N + 0.6 + (s > 0 ? X - N - 0.6 : 0), 7.3, M - 0.05]);
    }
    d.box('Gold', [L - tt - 0.35, 5.45, M - 0.12], [L + tt + 0.35, 5.9, M + 0.02]);
  }

  function dildiCityBuilding(THREE, kind, params, mats) {
    const d = new MB(), g = new MB();
    if (kind === 'pizza') pizzaDecor(d, g, params);
    else if (kind === 'depot') depotDecor(d, g, params);
    else if (kind === 'customs') customsDecor(d, g, params);
    else if (kind === 'bank') bankDecor(d, g, params);
    else throw new Error('DildiCars: unbekanntes Gebaeude ' + kind);
    const cache = {};
    const colorOf = (m) => {
      if (cache[m]) return cache[m];
      let c = BPAL[m];
      if (!c && m.startsWith('CAR_')) c = SRGB[m.slice(4)] || (m === 'CAR_Rim' ? [0.55, 0.56, 0.58] : m === 'CAR_Caliper' ? [0.75, 0.05, 0.04] : [0.5, 0.5, 0.5]);
      return (cache[m] = new THREE.Color().setRGB(...(c || [0.5, 0.5, 0.5]), THREE.SRGBColorSpace));
    };
    const group = new THREE.Group();
    const decor = new THREE.Mesh(vcGeometry(THREE, d, () => true, colorOf),
      mats && mats.decor || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }));
    decor.castShadow = true;
    decor.receiveShadow = true;
    const glowMat = mats && mats.glow || new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const glow = new THREE.Mesh(vcGeometry(THREE, g, () => true, colorOf), glowMat);
    group.add(decor, glow);
    group.name = 'Decor_' + kind;
    group.userData.glow = glowMat;
    return group;
  }

  // Eigenstaendige Nutzung fuer alle Typen (eigene PBR-Materialien wie createRS6)
  function createVehicle(THREE, type, options) {
    const V = VEHICLES[type];
    const toArr = (c) => (Array.isArray(c) ? c : c);
    const o = opt(options, { paint: V.paint, paintRough: 0.3, rim: V.rim, caliper: V.caliper });
    o.paint = toArr(o.paint);
    const car = assemble(THREE, type, V.body(), V.axles, o, null);
    return car;
  }

  const api = { createRS6, createFerrari, createVehicle, dildiCityVehicle, dildiCityPlane, dildiCityBuilding, types: Object.keys(VEHICLES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DildiCars = api;
})(typeof window !== 'undefined' ? window : globalThis);
