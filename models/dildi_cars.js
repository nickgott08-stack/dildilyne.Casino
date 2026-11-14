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
 * 1) FAHRZEUGE  -  Typen: 'rs6', 'ferrari', 'skoda', 'police', 'taxi', 'van', 'jeep', 'bus', 'truck'
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
 *    - NEU 'bus' (10.5x2.5x3.1 m) und 'truck' (7.3x2.45x3.6 m): in die Fahrzeugliste des Spiels eintragen, z. B.
 *      bus:{name:"Dildi Bus",len:10.5,wid:2.5,maxSpeed:16,accel:4,brake:14,grip:6,turn:1.3,mass:3.5,colors:["#d81e2a","#f4c20d","#1f5fa8"]}
 *      truck:{name:"LKW",len:7.3,wid:2.45,maxSpeed:19,accel:4.5,brake:14,grip:6,turn:1.4,mass:3,colors:["#1f5fa8","#c0392b","#f5f5f5"]}
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
 *    - 'casino'  { x0, x1, z0, z1, h: 22 }    = Casino-Hauptgebaeude (z0 = Front mit Schild/Teppich).
 *    - 'tower'   { cx, cz }                   = Mitte des Radj Towers (Sockel 26x26x120, Aufsatz 18x18 bis 140).
 *
 * 5) DILDI-KREUZ ERSETZEN (zwischen Innenstadt und Bruecke zu Docks/Flughafen)
 *    a) In der Strassenliste die drei alten Eintraege entfernen:
 *       vn("Dildi-Kreuz",...), vn("Rampe West",...), vn("Rampe Ost",...)
 *       und stattdessen eintragen:
 *         for (const r of DildiCars.dildiKreuz.roads()) vn(r.name, r.pts, r.opts);
 *       (pts im Format [x, z, y] wie bisher, kind "deck" -> das Spiel baut Fahrbahn, Pfeiler, Lampen
 *       und macht alles befahrbar wie vorher). Anschluesse an Stadt und Hafenstrasse bleiben gleich.
 *       Neu: 4 Kleeblatt-Schleifen statt 2 Rampen - von jeder Richtung auf die Hafenstrasse und zurueck.
 *    b) Deko (Schilderbruecken, Skatepark unter der Hochstrasse, Rasthof-Diner + Tanke, Motel mit Pool,
 *       2 Leucht-Plakatwaende):
 *         const deko = DildiCars.dildiKreuz.decor(THREE); scene.add(deko);
 *         for (const c of deko.userData.colliders) Oe(c.x0, c.x1, c.z0, c.z1, c.h);   // Kollision
 *         W.signMats.push(deko.userData.glow);
 *    (dildiCityInterchange ist die grosse freistehende Variante, fuer Dildi City nicht noetig.)
 *    Jeep: Typ 'jeep' ersetzt den Schmuggler-Jeep (Fahrzeug-Abschnitt 1).
 *
 * 4) DOCKS & FLUGHAFEN  -  liefern fertige Geometrien mit Vertex-Farben fuer die gemergten Deko-Listen:
 *    - Container:  statt k(2.45,2.6,6.1, x,y,z, farbe)  ->  DildiCars.dildiCityDocks.container(THREE, x, y, z, farbe)
 *    - Kraene:     die Kran-Boxen (Fundament, 4 Beine, Kabine, Ausleger, Seil) an (x,z) entfernen und
 *                  DildiCars.dildiCityDocks.crane(THREE, x, z) pushen (Kollision ueber dem Fundament bleibt).
 *    - Frachter:   Rumpf, rotes Deckband, weisser Aufbau und Deck-Container des Schiffs (Mitte -110/-722)
 *                  entfernen und DildiCars.dildiCityDocks.ship(THREE, -110, -722) pushen.
 *    - Tower:      Schaft, Kanzel, Dach bei (190,-600) entfernen -> DildiCars.dildiCityAirport.tower(THREE, 190, -600)
 *    - Hangars:    zusaetzlich pushen: DildiCars.dildiCityAirport.hangar(THREE, mitteX, mitteZ, nummer)  (1 und 2)
 *    - Flugschule: zusaetzlich pushen: DildiCars.dildiCityAirport.terminal(THREE)  (60..140 / -540..-515, 10 m)
 *    - Geparkte Deko-Flugzeuge: Rumpf-Geometrie ersetzen durch
 *                  DildiCars.dildiCityAirport.parkedPlane(THREE, x, z, drehungY, farbe)  (Kollision bleibt)
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
    poly(m, pts, center) {
      let c = center;
      if (!c) { c = [0, 0, 0]; pts.forEach((p) => { c = add(c, p); }); c = mul(c, 1 / pts.length); }
      for (let i = 0; i < pts.length; i++) this.tri(m, c, pts[i], pts[(i + 1) % pts.length]);
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
  // Linienbus (10.5 m) und LKW (7,5 t Koffer) - kastig, Radlaeufe ausgespart
  // ======================================================================
  const BUS_AXLES = [
    { z: 3.0, r: 0.5, w: 0.30, x: 1.02, arch: 0.62, liner: 0.8 },
    { z: -2.4, r: 0.5, w: 0.36, x: 1.0, arch: 0.62, liner: 0.8 }];
  const TRUCK_AXLES = [
    { z: 2.35, r: 0.48, w: 0.30, x: 0.98, arch: 0.6, liner: 0.75 },
    { z: -1.9, r: 0.48, w: 0.36, x: 0.96, arch: 0.6, liner: 0.75 }];

  // Unterteil mit Aussparungen fuer die Raeder
  function skirt(mb, m, hw, y0, y1, zf, zr, axles) {
    const cuts = axles.map((a) => [a.z - a.arch, a.z + a.arch]).sort((a, b) => a[0] - b[0]);
    let z = zr;
    for (const [c0, c1] of cuts) { if (c0 > z) mb.box(m, [-hw, y0, z], [hw, y1, c0]); z = c1; }
    if (zf > z) mb.box(m, [-hw, y0, z], [hw, y1, zf]);
    for (const a of axles) {
      mb.box('Underbody', [-hw + 0.02, a.r + 0.05, a.z - a.arch], [hw - 0.02, y1, a.z + a.arch]);
      for (const s of SIDES) mb.box('TrimGloss', [s * hw - 0.04, a.r + a.arch * 0.9, a.z - a.arch - 0.05], [s * hw + 0.04, a.r + a.arch * 0.9 + 0.08, a.z + a.arch + 0.05]);
    }
  }

  function busBody() {
    const mb = new MB(), hw = 1.25, zf = 5.25, zr = -5.25;
    skirt(mb, 'Paint', hw, 0.32, 1.12, zf, zr, BUS_AXLES);
    mb.hexa('Paint', [[-hw, 1.12, zf], [hw, 1.12, zf], [hw, 2.95, zf - 0.25], [-hw, 2.95, zf - 0.25],
      [-hw, 1.12, zr], [hw, 1.12, zr], [hw, 2.95, zr + 0.1], [-hw, 2.95, zr + 0.1]]);
    mb.box('Paint', [-hw + 0.15, 2.95, zr + 0.4], [hw - 0.15, 3.12, zf - 0.6]);
    mb.box('Concrete', [-0.7, 3.12, -3.5], [0.7, 3.4, -1.8]);            // Klimaanlage
    // Seitenfenster-Band + Tueren (rechte Seite = -X)
    for (const s of SIDES) {
      mb.box('Glass', [s * hw - 0.02 * s - 0.02, 1.35, zr + 0.6], [s * hw + 0.02 * s + 0.02, 2.65, zf - 0.6].map((v, i) => v));
      for (let z = zr + 1.6; z < zf - 0.8; z += 1.5) mb.box('TrimGloss', [s * hw - 0.05, 1.33, z - 0.06], [s * hw + 0.05, 2.67, z + 0.06]);
    }
    for (const dz of [zf - 1.4, -0.4]) {
      mb.box('Glass', [-hw - 0.05, 0.4, dz - 0.65], [-hw + 0.02, 2.7, dz + 0.65]);
      mb.box('Chrome', [-hw - 0.07, 0.4, dz - 0.02], [-hw - 0.04, 2.7, dz + 0.02]);
    }
    mb.box('PoliceYellow', [-hw - 0.01, 1.14, zr + 0.3], [hw + 0.01, 1.24, zf - 0.3]);   // Zierlinie
    // Front: grosse Scheibe, Zielanzeige, Lichter
    mb.hexa('Glass', [[-hw + 0.08, 1.35, zf + 0.0], [hw - 0.08, 1.35, zf + 0.0], [hw - 0.08, 2.55, zf - 0.17], [-hw + 0.08, 2.55, zf - 0.17],
      [-hw + 0.08, 1.35, zf + 0.03], [hw - 0.08, 1.35, zf + 0.03], [hw - 0.08, 2.55, zf - 0.14], [-hw + 0.08, 2.55, zf - 0.14]]);
    mb.hexa('Black', [[-0.9, 2.6, zf - 0.18], [0.9, 2.6, zf - 0.18], [0.9, 2.88, zf - 0.22], [-0.9, 2.88, zf - 0.22],
      [-0.9, 2.6, zf - 0.15], [0.9, 2.6, zf - 0.15], [0.9, 2.88, zf - 0.19], [-0.9, 2.88, zf - 0.19]]);
    mb.box('TaxiSign', [-0.8, 2.64, zf - 0.24], [0.8, 2.84, zf - 0.2]);
    mb.box('TrimGloss', [-hw, 0.32, zf], [hw, 0.75, zf + 0.08]);
    mb.box('Plate', [-0.26, 0.45, zf + 0.08], [0.26, 0.56, zf + 0.1]);
    for (const s of SIDES) {
      mb.box('LightLens', [s * 0.95 - 0.25, 0.8, zf], [s * 0.95 + 0.25, 1.05, zf + 0.05]);
      mb.box('HeadLight', [s * 0.95 - 0.2, 0.84, zf + 0.04], [s * 0.95 + 0.2, 0.92, zf + 0.06]);
      mb.box('TrimGloss', [s * (hw + 0.02), 2.3, zf - 0.5], [s * (hw + 0.08), 2.35, zf - 0.1]);   // Spiegelarm
      mb.box('TrimGloss', [s * (hw + 0.08) - 0.04, 1.9, zf - 0.15], [s * (hw + 0.08) + 0.04, 2.35, zf - 0.05]);
      mb.box('TailLight', [s * 1.05 - 0.15, 0.7, zr - 0.04], [s * 1.05 + 0.15, 1.5, zr]);
    }
    mb.box('Glass', [-1.0, 1.9, zr - 0.03], [1.0, 2.7, zr]);
    mb.box('TrimGloss', [-1.0, 1.25, zr - 0.04], [1.0, 1.65, zr]);   // Motorklappe
    mb.box('Plate', [-0.26, 0.5, zr - 0.04], [0.26, 0.61, zr]);
    mb.box('TrimGloss', [-hw, 0.32, zr - 0.08], [hw, 0.62, zr]);
    return mb;
  }

  function truckBody() {
    const mb = new MB(), hw = 1.22, zf = 3.55, zc = 1.45, zr = -3.7;
    // Fahrerhaus (Frontlenker)
    skirt(mb, 'Paint', hw, 0.45, 1.25, zf, zc, [TRUCK_AXLES[0]]);
    mb.hexa('Paint', [[-hw, 1.25, zf], [hw, 1.25, zf], [hw, 2.95, zf - 0.22], [-hw, 2.95, zf - 0.22],
      [-hw, 1.25, zc], [hw, 1.25, zc], [hw, 2.95, zc], [-hw, 2.95, zc]]);
    mb.hexa('Paint', [[-hw + 0.1, 2.95, zf - 0.3], [hw - 0.1, 2.95, zf - 0.3], [hw - 0.2, 3.4, zf - 0.7], [-hw + 0.2, 3.4, zf - 0.7],
      [-hw + 0.1, 2.95, zc], [hw - 0.1, 2.95, zc], [hw - 0.2, 3.4, zc], [-hw + 0.2, 3.4, zc]]);   // Windabweiser
    mb.hexa('Glass', [[-hw + 0.1, 1.85, zf + 0.0], [hw - 0.1, 1.85, zf + 0.0], [hw - 0.1, 2.75, zf - 0.17], [-hw + 0.1, 2.75, zf - 0.17],
      [-hw + 0.1, 1.85, zf + 0.03], [hw - 0.1, 1.85, zf + 0.03], [hw - 0.1, 2.75, zf - 0.14], [-hw + 0.1, 2.75, zf - 0.14]]);
    for (const s of SIDES) {
      mb.box('Glass', [s * hw - 0.03, 1.85, zf - 1.0], [s * hw + 0.03, 2.75, zf - 0.25]);
      mb.box('TrimGloss', [s * (hw + 0.02), 2.6, zf - 0.6], [s * (hw + 0.25), 2.65, zf - 0.5]);
      mb.box('TrimGloss', [s * (hw + 0.25) - 0.05, 1.9, zf - 0.6], [s * (hw + 0.25) + 0.05, 2.65, zf - 0.45]);
      mb.box('Chrome', [s * hw - 0.03, 0.55, zf - 1.3], [s * hw + 0.03, 1.15, zf - 1.25]);   // Einstiegsgriff
      mb.box('LightLens', [s * 0.9 - 0.25, 0.75, zf], [s * 0.9 + 0.25, 1.05, zf + 0.05]);
      mb.box('HeadLight', [s * 0.9 - 0.2, 0.8, zf + 0.04], [s * 0.9 + 0.2, 0.9, zf + 0.06]);
      mb.box('HeadLight', [s * 0.6 - 0.12, 3.3, zf - 0.68], [s * 0.6 + 0.12, 3.38, zf - 0.62]);   // Dachleuchten
    }
    // Kuehlergrill + Stossstange
    mb.box('TrimGloss', [-0.7, 1.15, zf], [0.7, 1.75, zf + 0.04]);
    for (const y of [1.25, 1.4, 1.55]) mb.box('Chrome', [-0.68, y, zf + 0.04], [0.68, y + 0.04, zf + 0.06]);
    mb.box('TrimGloss', [-hw, 0.45, zf], [hw, 0.75, zf + 0.12]);
    mb.box('Plate', [-0.26, 0.5, zf + 0.12], [0.26, 0.61, zf + 0.14]);
    // Rahmen + Kofferaufbau
    mb.box('Underbody', [-0.5, 0.55, zr + 0.2], [0.5, 0.95, zc]);
    mb.box('TrimGloss', [-hw, 0.95, zr], [hw, 1.1, zc - 0.15]);
    mb.box('White', [-hw - 0.03, 1.1, zr], [hw + 0.03, 3.6, zc - 0.2]);
    for (let z = zr + 0.6; z < zc - 0.3; z += 0.6) for (const s of SIDES) mb.box('HangarGrey', [s * (hw + 0.03) - 0.02, 1.15, z - 0.03], [s * (hw + 0.03) + 0.02, 3.55, z + 0.03]);
    mb.box('Paint', [-hw - 0.05, 2.4, zr - 0.01], [hw + 0.05, 2.9, zc - 0.25].map((v) => v));    // Firmenstreifen
    for (const s of SIDES) mb.box('Paint', [s * (hw + 0.05) - 0.02, 2.4, zr], [s * (hw + 0.05) + 0.02, 2.9, zc - 0.2]);
    // Hecktueren
    mb.box('HangarGrey', [-hw, 1.1, zr - 0.04], [hw, 3.6, zr]);
    mb.box('TrimGloss', [-0.02, 1.15, zr - 0.06], [0.02, 3.55, zr - 0.03]);
    for (const x of [-0.6, 0.6]) mb.box('Chrome', [x - 0.03, 1.2, zr - 0.08], [x + 0.03, 3.5, zr - 0.04]);
    for (const s of SIDES) {
      mb.box('TailLight', [s * 1.0 - 0.15, 0.7, zr - 0.06], [s * 1.0 + 0.15, 0.9, zr - 0.02]);
      mb.box('TrimGloss', [s * hw - 0.05, 0.45, zr + 0.6], [s * hw + 0.05, 0.95, zc - 0.6]);    // Seitenschutz
      mb.box('Chrome', [s * 0.8 - 0.25, 0.55, -0.2], [s * 0.8 + 0.25, 0.95, 0.6]);           // Tank
    }
    mb.box('TrimGloss', [-hw, 0.5, zr - 0.06], [hw, 0.68, zr + 0.1]);
    mb.box('Plate', [-0.26, 0.72, zr - 0.08], [0.26, 0.83, zr - 0.06]);
    mb.box('TrimGloss', [-0.06, 2.95, zc - 0.05], [0.06, 3.5, zc + 0.05]);   // Auspuff hinterm Fahrerhaus
    return mb;
  }


  // ======================================================================
  // Offroad-Jeep (Radj-Insel): kastig, Rammbuegel, Ersatzrad, Dachtraeger
  // ======================================================================
  const JEEP_AXLES = [
    { z: 1.25, r: 0.42, w: 0.30, x: 0.82, arch: 0.52, liner: 0.6 },
    { z: -1.30, r: 0.42, w: 0.30, x: 0.82, arch: 0.52, liner: 0.6 }];
  function jeepBody() {
    const mb = new MB(), hw = 0.88, zf = 2.0, zr = -2.0;
    skirt(mb, 'Paint', hw, 0.55, 1.05, zf, zr, JEEP_AXLES);
    // Kotfluegel-Verbreiterungen
    for (const a of JEEP_AXLES) for (const s of SIDES) mb.hexa('TrimMatte', [[s * hw, 1.0, a.z + 0.65], [s * (hw + 0.13), 0.98, a.z + 0.6], [s * (hw + 0.13), 0.98, a.z - 0.6], [s * hw, 1.0, a.z - 0.65],
      [s * hw, 1.12, a.z + 0.65], [s * (hw + 0.13), 1.08, a.z + 0.6], [s * (hw + 0.13), 1.08, a.z - 0.6], [s * hw, 1.12, a.z - 0.65]]);
    mb.box('Paint', [-hw, 1.05, zr], [hw, 1.35, zf]);
    mb.hexa('Paint', [[-hw + 0.04, 1.35, zf], [hw - 0.04, 1.35, zf], [hw - 0.06, 1.42, 0.85], [-hw + 0.06, 1.42, 0.85],
      [-hw + 0.04, 1.35, zf - 0.02], [hw - 0.04, 1.35, zf - 0.02], [hw - 0.06, 1.35, 0.85], [-hw + 0.06, 1.35, 0.85]]);   // Haube
    // Kabine mit Hardtop (eckig), Scheiben
    mb.hexa('Glass', [[-hw + 0.06, 1.42, 0.85], [hw - 0.06, 1.42, 0.85], [hw - 0.08, 2.0, 0.72], [-hw + 0.08, 2.0, 0.72],
      [-hw + 0.06, 1.35, 0.75], [hw - 0.06, 1.35, 0.75], [hw - 0.08, 2.0, 0.62], [-hw + 0.08, 2.0, 0.62]]);
    mb.box('Paint', [-hw + 0.02, 1.35, zr + 0.05], [hw - 0.02, 1.42, 0.75]);
    mb.box('TrimMatte', [-hw + 0.03, 2.0, zr + 0.05], [hw - 0.03, 2.1, 0.75]);
    for (const s of SIDES) {
      mb.box('Glass', [s * (hw - 0.02) - 0.02, 1.47, zr + 0.25], [s * (hw - 0.02) + 0.02, 1.95, 0.65]);
      for (const z of [0.05, -0.9]) mb.box('TrimMatte', [s * (hw - 0.02) - 0.03, 1.42, z - 0.05], [s * (hw - 0.02) + 0.03, 2.0, z + 0.05]);
      mb.box('TrimMatte', [s * (hw - 0.0) - 0.05, 1.42, zr + 0.05], [s * hw + 0.05, 2.0, zr + 0.25]);
      mb.box('TrimMatte', [s * (hw + 0.02), 0.62, -0.9], [s * (hw + 0.16), 0.7, 0.6]);           // Trittbrett
      mb.box('TrimMatte', [s * (hw + 0.02), 1.6, 0.6], [s * (hw + 0.2), 1.75, 0.7]);             // Spiegel
      mb.box('LightLens', [s * 0.62 - 0.14, 1.1, zf], [s * 0.62 + 0.14, 1.3, zf + 0.03]);
      mb.box('HeadLight', [s * 0.62 - 0.1, 1.14, zf + 0.03], [s * 0.62 + 0.1, 1.26, zf + 0.05]);
      mb.box('TailLight', [s * 0.75 - 0.08, 1.05, zr - 0.03], [s * 0.75 + 0.08, 1.35, zr]);
      mb.box('HeadLight', [s * 0.35 - 0.12, 2.12, 0.6], [s * 0.35 + 0.12, 2.22, 0.68]);         // Zusatzscheinwerfer
    }
    // Grill mit senkrechten Schlitzen, Rammbuegel, Seilwinde
    mb.box('TrimGloss', [-0.42, 1.05, zf], [0.42, 1.35, zf + 0.02]);
    for (let i = -3; i <= 3; i++) mb.box('Paint', [i * 0.11 - 0.025, 1.08, zf + 0.02], [i * 0.11 + 0.025, 1.32, zf + 0.04]);
    mb.box('TrimMatte', [-0.95, 0.55, zf + 0.05], [0.95, 0.8, zf + 0.3]);
    for (const s of SIDES) strut(mb, 'TrimMatte', [s * 0.55, 0.8, zf + 0.25], [s * 0.45, 1.3, zf + 0.18], 0.07);
    strut(mb, 'TrimMatte', [-0.45, 1.3, zf + 0.18], [0.45, 1.3, zf + 0.18], 0.07);
    mb.box('DarkSteel', [-0.25, 0.6, zf + 0.3], [0.25, 0.78, zf + 0.42]);
    // Dachtraeger mit Kanister, Schnorchel, Ersatzrad hinten
    for (const s of SIDES) mb.box('TrimMatte', [s * 0.72 - 0.03, 2.1, zr + 0.15], [s * 0.72 + 0.03, 2.25, 0.6]);
    for (let z = zr + 0.3; z < 0.6; z += 0.45) mb.box('TrimMatte', [-0.75, 2.22, z - 0.02], [0.75, 2.26, z + 0.02]);
    mb.box('BottleGreen', [-0.55, 2.26, zr + 0.4], [-0.15, 2.6, zr + 0.75]);
    mb.box('PoliceYellow', [0.1, 2.26, zr + 0.4], [0.5, 2.6, zr + 0.75]);
    strut(mb, 'TrimMatte', [hw + 0.05, 1.1, 0.95], [hw + 0.05, 2.05, 0.85], 0.1);
    mb.box('TrimMatte', [-0.72, 0.6, zr - 0.08], [0.72, 0.85, zr]);
    mb.prism('Rubber', hexagon(0, 1.45, zr - 0.1, 0.4, 12, 0, 1, 1), [0, 0, -0.26]);
    mb.prism('DarkSteel', hexagon(0, 1.45, zr - 0.36, 0.2, 8, 0, 1, 1), [0, 0, -0.02]);
    mb.box('Plate', [-0.26, 0.62, zr - 0.1], [0.26, 0.73, zr - 0.08]);
    return mb;
  }

  // ======================================================================
  // Autobahnkreuz (Kleeblatt) + Gebaeude drumherum
  // Mitte (cx, cz). Autobahn A laeuft ebenerdig in x-Richtung, Autobahn B
  // als Bruecke (8 m) in z-Richtung; 4 Schleifenrampen verbinden beide.
  // ======================================================================
  function interchangeRoads(cx, cz) {
    const roads = [];
    const A = []; for (let x = -220; x <= 220; x += 10) A.push({ x: cx + x, y: 0.3, z: cz });
    roads.push({ name: 'A', w: 18, samples: A });
    const B = [];
    for (let z = -220; z <= 220; z += 6) {
      const a = Math.abs(z), y = a < 60 ? 8.3 : a < 140 ? 0.3 + 8 * (1 - (a - 60) / 80) : 0.3;
      B.push({ x: cx, y, z: cz + z });
    }
    roads.push({ name: 'B', w: 18, samples: B });
    for (const sx of SIDES) for (const sz of SIDES) {
      const ccx = cx + sx * 46, ccz = cz + sz * 46, r = 37;
      const a0 = sx > 0 ? Math.PI : 0, a1 = sz > 0 ? -Math.PI / 2 : Math.PI / 2;
      let sweep = a1 - a0;
      for (let k = -2; k <= 2; k++) if (Math.abs(Math.abs(a1 - a0 + 2 * Math.PI * k) - 1.5 * Math.PI) < 0.01) sweep = a1 - a0 + 2 * Math.PI * k;
      const L = [];
      for (let i = 0; i <= 36; i++) {
        const t = i / 36, a = a0 + sweep * t;
        L.push({ x: ccx + r * Math.cos(a), y: 8.3 + (0.3 - 8.3) * t, z: ccz + r * Math.sin(a) });
      }
      roads.push({ name: 'Rampe' + (sx > 0 ? 'O' : 'W') + (sz > 0 ? 'S' : 'N'), w: 7, samples: L });
    }
    return roads;
  }

  function deckParts(mb, road) {
    const S = road.samples, hw = road.w / 2;
    const side = (i) => {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      return [-dz, dx];
    };
    for (let i = 0; i < S.length - 1; i++) {
      const p = S[i], q = S[i + 1], [nx, nz] = side(i), [mx, mz] = side(i + 1);
      const L0 = [p.x + nx * hw, p.y, p.z + nz * hw], R0 = [p.x - nx * hw, p.y, p.z - nz * hw];
      const L1 = [q.x + mx * hw, q.y, q.z + mz * hw], R1 = [q.x - mx * hw, q.y, q.z - mz * hw];
      const dn = (v, d) => [v[0], v[1] - d, v[2]];
      const elevated = Math.max(p.y, q.y) > 1.2;
      const th = elevated ? 0.9 : 0.25;
      mb.triO('Asphalt', L0, R0, R1, dn(L0, 5)); mb.triO('Asphalt', L0, R1, L1, dn(L0, 5));
      mb.triO('Concrete', dn(L0, th), dn(R0, th), dn(R1, th), [L0[0], L0[1] + 5, L0[2]]); mb.triO('Concrete', dn(L0, th), dn(R1, th), dn(L1, th), [L0[0], L0[1] + 5, L0[2]]);
      // Seitenflaechen
      const mid = [(p.x + q.x) / 2, (p.y + q.y) / 2 - th / 2, (p.z + q.z) / 2];
      mb.triO('Concrete', L0, L1, dn(L1, th), mid); mb.triO('Concrete', L0, dn(L1, th), dn(L0, th), mid);
      mb.triO('Concrete', R0, R1, dn(R1, th), mid); mb.triO('Concrete', R0, dn(R1, th), dn(R0, th), mid);
      // Leitplanken / Betonschutzwand
      strut(mb, 'Concrete', [L0[0], L0[1] + 0.45, L0[2]], [L1[0], L1[1] + 0.45, L1[2]], 0.5);
      strut(mb, 'Concrete', [R0[0], R0[1] + 0.45, R0[2]], [R1[0], R1[1] + 0.45, R1[2]], 0.5);
      // Markierungen
      if (i % 2 === 0) {
        if (road.w > 10) {
          strut(mb, 'LaneWhite', [p.x, p.y + 0.03, p.z], [q.x, q.y + 0.03, q.z], 0.25);
          for (const k of [-0.5, 0.5]) strut(mb, 'LaneWhite', [p.x + nx * hw * k, p.y + 0.03, p.z + nz * hw * k], [(p.x + q.x) / 2 + nx * hw * k, (p.y + q.y) / 2 + 0.03, (p.z + q.z) / 2 + nz * hw * k], 0.15);
        }
      }
      for (const k of [0.92, -0.92]) strut(mb, 'LaneWhite', [p.x + nx * hw * k, p.y + 0.03, p.z + nz * hw * k], [q.x + mx * hw * k, q.y + 0.03, q.z + mz * hw * k], 0.15);
      // Pfeiler
      if (elevated && i % 3 === 0 && p.y > 2) {
        const off = road.w > 10 ? [-hw * 0.55, hw * 0.55] : [0];
        for (const o of off) {
          const px = p.x + nx * o, pz = p.z + nz * o;
          mb.prism('Concrete', hexagon(px, pz, 0, 0.8, 8, Math.PI / 8, 1, 1).map(([a, b]) => [a, 0, b]), [0, p.y - th, 0]);
          mb.box('Concrete', [px - 1.4, p.y - th - 0.6, pz - 1.4], [px + 1.4, p.y - th, pz + 1.4]);
        }
      }
    }
  }

  function signGantry(mb, x, z, along, y0, text) {
    // Schilderbruecke ueber Autobahn (blau, Zeichen als Balken angedeutet)
    const o = along === 'x' ? [0, 1] : [1, 0], hw = 10;
    for (const s of SIDES) mb.box('Steel', [x + o[0] * s * hw - 0.2, y0, z + o[1] * s * hw - 0.2], [x + o[0] * s * hw + 0.2, y0 + 6.5, z + o[1] * s * hw + 0.2]);
    strut(mb, 'Steel', [x - o[0] * hw, y0 + 6.3, z - o[1] * hw], [x + o[0] * hw, y0 + 6.3, z + o[1] * hw], 0.35);
    for (const s of SIDES) {
      const c = [x + o[0] * s * 4.5, z + o[1] * s * 4.5];
      mb.box('SignBlue', [c[0] - (o[0] ? 3.6 : 0.1), y0 + 4.2, c[1] - (o[1] ? 3.6 : 0.1)], [c[0] + (o[0] ? 3.6 : 0.1), y0 + 6.2, c[1] + (o[1] ? 3.6 : 0.1)]);
      for (let k = 0; k < 2; k++) mb.box('LaneWhite', [c[0] - (o[0] ? 2.8 - k : 0.12), y0 + 5.5 - k * 0.7, c[1] - (o[1] ? 2.8 - k : 0.12)], [c[0] + (o[0] ? 2.2 : 0.12), y0 + 5.75 - k * 0.7, c[1] + (o[1] ? 2.2 : 0.12)]);
    }
  }

  // --- Einzigartige Gebaeude ---
  function diner(d, g, x, z) {           // Rasthof-Diner (Retro), Front -z
    const W = 12, D = 22;
    d.box('Steel', [x - W, 0.2, z - D / 2], [x + W, 4.6, z + D / 2]);
    for (let i = 0; i < 6; i++) d.box(i % 2 ? 'Steel' : 'HangarGrey', [x - W - 0.02, 0.2 + i * 0.6, z - D / 2 - 0.02], [x + W + 0.02, 0.5 + i * 0.6, z + D / 2 + 0.02]);
    for (let xx = x - W + 1.5; xx < x + W - 1; xx += 2.6) g.box('GlowWin', [xx, 1.5, z - D / 2 - 0.08], [xx + 2.0, 3.6, z - D / 2 - 0.03]);
    d.box('ChipRed', [x - W - 0.4, 4.6, z - D / 2 - 0.6], [x + W + 0.4, 5.3, z + D / 2 + 0.4]);
    g.box('GlowCyan', [x - W - 0.45, 4.55, z - D / 2 - 0.65], [x + W + 0.45, 4.62, z - D / 2 - 0.55]);
    d.box('ChipRed', [x - 2, 0.2, z - D / 2 - 0.5], [x + 2, 3.8, z - D / 2]);
    g.box('GlowWin', [x - 1.4, 0.25, z - D / 2 - 0.55], [x + 1.4, 3.2, z - D / 2 - 0.5]);
    // Pylon-Schild "DINER" (Pfeil)
    d.box('Steel', [x + W + 3, 0, z - D / 2 - 3], [x + W + 3.6, 14, z - D / 2 - 2.4]);
    d.box('ChipRed', [x + W + 1.5, 9, z - D / 2 - 2.9], [x + W + 7.5, 13, z - D / 2 - 2.5]);
    g.box('GlowWarm', [x + W + 1.8, 9.4, z - D / 2 - 2.95], [x + W + 7.2, 9.6, z - D / 2 - 2.9]);
    g.box('GlowWarm', [x + W + 1.8, 12.4, z - D / 2 - 2.95], [x + W + 7.2, 12.6, z - D / 2 - 2.9]);
    g.hexa('GlowPink', [[x + W + 7.5, 10, z - D / 2 - 2.95], [x + W + 9.5, 11, z - D / 2 - 2.95], [x + W + 9.5, 11, z - D / 2 - 2.85], [x + W + 7.5, 10, z - D / 2 - 2.85],
      [x + W + 7.5, 12, z - D / 2 - 2.95], [x + W + 9.5, 11.01, z - D / 2 - 2.95], [x + W + 9.5, 11.01, z - D / 2 - 2.85], [x + W + 7.5, 12, z - D / 2 - 2.85]]);
    // Tankstelle daneben
    const tx = x - W - 16;
    d.box('White', [tx - 9, 5.2, z - 8], [tx + 9, 6.0, z + 8]);
    g.box('GlowWhite', [tx - 8.5, 5.1, z - 7.5], [tx + 8.5, 5.2, z + 7.5]);
    for (const [a, b] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) d.box('Steel', [tx + a - 0.25, 0, z + b - 0.25], [tx + a + 0.25, 5.2, z + b + 0.25]);
    for (const a of [-3, 3]) { d.box('ChipRed', [tx + a - 0.5, 0.2, z - 0.35], [tx + a + 0.5, 1.9, z + 0.35]); d.box('Concrete', [tx + a - 1.5, 0.05, z - 1], [tx + a + 1.5, 0.25, z + 1]); }
    return [{ x0: x - W, x1: x + W, z0: z - D / 2, z1: z + D / 2, h: 5.3 }, { x0: x + W + 3, x1: x + W + 3.6, z0: z - D / 2 - 3, z1: z - D / 2 - 2.4, h: 14 }];
  }

  function motel(d, g, x, z) {           // 2-stoeckiges Motel mit Laubengang, Front -z
    const W = 24, D = 10;
    d.box('Cream', [x - W, 0.2, z], [x + W, 7.0, z + D]);
    d.box('Terracotta', [x - W - 0.4, 7.0, z - 2.6], [x + W + 0.4, 7.5, z + D + 0.4]);
    d.box('Concrete', [x - W, 3.3, z - 2.2], [x + W, 3.6, z]);                         // Laubengang
    d.box('Steel', [x - W, 4.5, z - 2.25], [x + W, 4.6, z - 2.15]);
    for (let xx = x - W + 0.3; xx < x + W; xx += 4) for (const y0 of [0.2, 3.6]) {
      d.box('Steel', [xx - 0.1, y0, z - 2.2], [xx + 0.1, y0 + 3.3, z - 2.0]);
      d.box('Wood', [xx + 0.6, y0 + 0.1, z - 0.06], [xx + 1.6, y0 + 2.3, z]);
      g.box('GlowWin', [xx + 2.0, y0 + 1.0, z - 0.06], [xx + 3.4, y0 + 2.3, z - 0.02]);
    }
    // grosser Pylon "INN"
    d.box('Steel', [x - W - 6, 0, z - 6], [x - W - 5.2, 16, z - 5.2]);
    d.box('BottleGreen', [x - W - 9, 11, z - 5.8], [x - W - 2.2, 16, z - 5.4]);
    for (let i = 0; i < 3; i++) g.box('GlowWarm', [x - W - 8.4 + i * 2.1, 12, z - 5.85], [x - W - 7.0 + i * 2.1, 15, z - 5.8]);
    // Pool
    d.box('Concrete', [x - 8, 0.05, z - 16], [x + 8, 0.35, z - 7]);
    d.box('ChipBlue', [x - 7.3, 0.1, z - 15.3], [x + 7.3, 0.36, z - 7.7]);
    return [{ x0: x - W, x1: x + W, z0: z, z1: z + D, h: 7.5 }, { x0: x - W - 6, x1: x - W - 5.2, z0: z - 6, z1: z - 5.2, h: 16 }];
  }

  function logistics(d, g, x, z) {       // Logistikzentrum mit 6 Ladetoren, Front -z
    const W = 30, D = 26, H = 12;
    d.box('White', [x - W, 0.2, z], [x + W, H, z + D]);
    d.box('ChipBlue', [x - W - 0.05, H - 2.5, z - 0.05], [x + W + 0.05, H - 1.2, z + D + 0.05]);
    for (let i = 0; i < 6; i++) {
      const dx = x - W + 6 + i * 9.5;
      d.box('Concrete', [dx - 2.4, 0.2, z - 2.5], [dx + 2.4, 1.3, z]);                // Rampe
      d.box('DarkSteel', [dx - 1.6, 1.3, z - 0.15], [dx + 1.6, 4.6, z]);
      d.box('Black', [dx - 1.9, 1.3, z - 0.6], [dx + 1.9, 4.9, z - 0.2]);             // Torabdichtung
      g.box('GlowWhite', [dx - 0.3, 5.1, z - 0.4], [dx + 0.3, 5.2, z - 0.1]);
      d.box(i % 2 ? 'Hazard' : 'Black', [dx - 2.4, 0.2, z - 2.55], [dx + 2.4, 0.5, z - 2.5]);
    }
    for (let i = 0; i < 4; i++) d.box('Steel', [x - 20 + i * 12, H, z + 8], [x - 16 + i * 12, H + 1.5, z + 12]);
    // Hochregal-Turm
    d.box('HangarGrey', [x + W - 12, 0.2, z + D - 10], [x + W - 2, 26, z + D]);
    d.box('ChipBlue', [x + W - 12.05, 22, z + D - 10.05], [x + W - 1.95, 24, z + D + 0.05]);
    return [{ x0: x - W, x1: x + W, z0: z, z1: z + D, h: H }, { x0: x + W - 12, x1: x + W - 2, z0: z + D - 10, z1: z + D, h: 26 }];
  }

  function underBridge(d, g, cx, cz) {   // Skatepark + Graffiti unter der Bruecke (zwischen A und Rampen)
    const z0 = cz + 16, z1 = cz + 40;
    d.box('Concrete', [cx - 8, 0.05, z0], [cx + 8, 0.2, z1]);
    for (const s of SIDES) {          // Quarterpipes
      for (let i = 0; i < 5; i++) {
        const a0 = i / 5 * Math.PI / 2, a1 = (i + 1) / 5 * Math.PI / 2, R = 2.4;
        const P = (a) => [cx + s * (7.8 - R * Math.sin(a)), 0.2 + R - R * Math.cos(a)];
        const [xa, ya] = P(a0), [xb, yb] = P(a1);
        d.quad('Concrete', [xa, ya, z0 + 2], [xb, yb, z0 + 2], [xb, yb, z1 - 2], [xa, ya, z1 - 2]);
        d.quad('Concrete', [xa, ya, z1 - 2], [xb, yb, z1 - 2], [xb, yb, z0 + 2], [xa, ya, z0 + 2]);
      }
      d.box('Steel', [cx + s * 7.8 - 0.05, 2.6, z0 + 2], [cx + s * 7.8 + 0.05, 2.7, z1 - 2]);
    }
    d.box('Concrete', [cx - 2, 0.2, (z0 + z1) / 2 - 2], [cx + 2, 0.9, (z0 + z1) / 2 + 2]);      // Funbox
    d.box('Steel', [cx - 0.05, 0.9, (z0 + z1) / 2 - 2], [cx + 0.05, 1.0, (z0 + z1) / 2 + 2]);
    // Graffiti-Waende (bunte Flaechen) + Strassenlaternen unter der Bruecke
    const cols = ['GlowPink', 'GlowCyan', 'Hazard', 'ChipRed', 'BottleGreen'];
    for (const s of SIDES) for (let k = 0; k < 6; k++) {
      const zz = z0 + 1 + k * 4;
      d.box(cols[k % 5], [cx + s * 8.6 - 0.05, 0.4 + (k % 2) * 0.6, zz], [cx + s * 8.6 + 0.05, 2.6 + (k % 3) * 0.5, zz + 3.2]);
    }
    for (let k = 0; k < 3; k++) g.box('GlowWarm', [cx - 1, 7.2, z0 + 4 + k * 8], [cx + 1, 7.35, z0 + 4.4 + k * 8]);
    return [{ x0: cx - 2, x1: cx + 2, z0: (z0 + z1) / 2 - 2, z1: (z0 + z1) / 2 + 2, h: 1.0 }];
  }

  function billboard(d, g, x, z, ry) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (a, y, b) => [x + a * c + b * s, y, z - a * s + b * c];
    d.prism('Steel', hexagon(x, z, 0, 0.7, 8, 0, 1, 1).map(([a, b]) => [a, 0, b]), [0, 14, 0]);
    d.hexa('DarkSteel', [P(-8, 14, -0.3), P(8, 14, -0.3), P(8, 20, -0.3), P(-8, 20, -0.3), P(-8, 14, 0.3), P(8, 14, 0.3), P(8, 20, 0.3), P(-8, 20, 0.3)]);
    g.hexa('GlowPink', [P(-7.6, 14.4, -0.35), P(0, 14.4, -0.35), P(0, 19.6, -0.35), P(-7.6, 19.6, -0.35), P(-7.6, 14.4, -0.31), P(0, 14.4, -0.31), P(0, 19.6, -0.31), P(-7.6, 19.6, -0.31)]);
    g.hexa('GlowWarm', [P(0, 14.4, -0.35), P(7.6, 14.4, -0.35), P(7.6, 19.6, -0.35), P(0, 19.6, -0.35), P(0, 14.4, -0.31), P(7.6, 14.4, -0.31), P(7.6, 19.6, -0.31), P(0, 19.6, -0.31)]);
    return [{ x0: x - 0.7, x1: x + 0.7, z0: z - 0.7, z1: z + 0.7, h: 20 }];
  }

  function dildiCityInterchange(THREE, opts) {
    const o = Object.assign({ cx: 0, cz: 0, buildings: true }, opts || {}), cx = o.cx, cz = o.cz;
    Object.assign(BPAL, { Asphalt: [0.20, 0.21, 0.22], LaneWhite: [0.92, 0.92, 0.88], SignBlue: [0.08, 0.25, 0.65] });
    const roads = interchangeRoads(cx, cz);
    const mb = new MB(), g = new MB();
    for (const r of roads) deckParts(mb, r);
    signGantry(mb, cx - 100, cz, 'x', 0.3);
    signGantry(mb, cx + 100, cz, 'x', 0.3);
    signGantry(mb, cx, cz + 175, 'z', 0.3);
    let colliders = [];
    if (o.buildings) {
      colliders = colliders.concat(diner(mb, g, cx + 130, cz + 120), motel(mb, g, cx - 130, cz + 105),
        logistics(mb, g, cx + 125, cz - 150), underBridge(mb, g, cx, cz), billboard(mb, g, cx - 110, cz - 95, 0.6));
    }
    const cache = {};
    const colorOf = (m) => cache[m] || (cache[m] = new THREE.Color().setRGB(...(BPAL[m] || SRGB[m] || [0.5, 0.5, 0.5]), THREE.SRGBColorSpace));
    const group = new THREE.Group();
    const deck = new THREE.Mesh(vcGeometry(THREE, mb, () => true, colorOf), o.material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    deck.castShadow = deck.receiveShadow = true;
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    group.add(deck, new THREE.Mesh(vcGeometry(THREE, g, () => true, colorOf), glowMat));
    group.name = 'Autobahnkreuz';
    group.userData = { roads, colliders, glow: glowMat };
    return group;
  }


  // ======================================================================
  // DILDI-KREUZ (Ersatz fuer das alte Kreuz zwischen Innenstadt und Bruecke)
  // Gleiche Anschluesse wie bisher: Stadtausfahrten (-136/-236) und (136/-236),
  // Hafenstrasse x=0 von z=-236 bis -416 (zur Bruecke -> Docks/Flughafen).
  // Neu: Kleeblatt mit 4 Schleifenrampen zwischen Hochstrasse (y=9, z=-320)
  // und Hafenstrasse statt der 2 alten Rampen.
  // ======================================================================
  function kreuzRoads() {
    const R = [];
    R.push({ name: 'Dildi-Kreuz', opts: { kind: 'deck', w: 14, lamps: true }, pts: [[-136, -236, 0], [-136, -258, 0], [-140, -280, 1.5], [-128, -302, 5], [-100, -318, 8], [-60, -322, 9], [0, -322, 9], [60, -322, 9], [100, -318, 8], [128, -302, 5], [140, -280, 1.5], [136, -258, 0], [136, -236, 0]] });
    const r = 33;
    for (const sx of SIDES) for (const sz of SIDES) {
      const ccx = sx * 40, ccz = -322 + sz * 40;
      const a0 = Math.atan2(-sz, 0) , a1 = sx > 0 ? Math.PI : 0;   // Start an der Hochstrasse, Ende an der Hafenstrasse
      let sweep = a1 - a0;
      for (let k = -2; k <= 2; k++) if (Math.abs(Math.abs(a1 - a0 + 2 * Math.PI * k) - 1.5 * Math.PI) < 0.01) sweep = a1 - a0 + 2 * Math.PI * k;
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, a = a0 + sweep * t;
        pts.push([+(ccx + r * Math.cos(a)).toFixed(2), +(ccz + r * Math.sin(a)).toFixed(2), +(9 * (1 - t)).toFixed(2)]);
      }
      R.push({ name: 'Kleeblatt ' + (sz > 0 ? 'Nord' : 'Sued') + (sx > 0 ? 'ost' : 'west'), opts: { kind: 'deck', w: 9 }, pts });
    }
    return R;
  }

  function kreuzDecor(THREE, opts) {
    Object.assign(BPAL, { Asphalt: [0.20, 0.21, 0.22], LaneWhite: [0.92, 0.92, 0.88], SignBlue: [0.08, 0.25, 0.65] });
    const mb = new MB(), g = new MB();
    let col = [];
    signGantry(mb, 0, -252, 'z', 0.2);
    signGantry(mb, 0, -404, 'z', 0.2);
    col = col.concat(
      underBridge(mb, g, 110, -350),            // Skatepark unter der Hochstrasse (Ost)
      diner(mb, g, -105, -385),                 // Rasthof-Diner + Tankstelle (Suedwest, am Wasser)
      motel(mb, g, 105, -398),                  // Motel mit Pool (Suedost)
      billboard(mb, g, -96, -262, 0.5),         // Leucht-Plakatwand (Nordwest)
      billboard(mb, g, 96, -262, -0.5));
    const cache = {};
    const colorOf = (m) => cache[m] || (cache[m] = new THREE.Color().setRGB(...(BPAL[m] || SRGB[m] || [0.5, 0.5, 0.5]), THREE.SRGBColorSpace));
    const group = new THREE.Group();
    const m = new THREE.Mesh(vcGeometry(THREE, mb, () => true, colorOf), (opts && opts.material) || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    m.castShadow = m.receiveShadow = true;
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    group.add(m, new THREE.Mesh(vcGeometry(THREE, g, () => true, colorOf), glowMat));
    group.name = 'Dildi-Kreuz-Deko';
    group.userData = { colliders: col, glow: glowMat };
    return group;
  }
  const dildiKreuz = { roads: kreuzRoads, decor: kreuzDecor };

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
    bus: { body: () => busBody(), axles: BUS_AXLES, paint: '#d81e2a', rim: [0.75, 0.76, 0.78], caliper: GREY_CAL },
    truck: { body: () => truckBody(), axles: TRUCK_AXLES, paint: '#1f5fa8', rim: [0.75, 0.76, 0.78], caliper: GREY_CAL },
    jeep: { body: () => jeepBody(), axles: JEEP_AXLES, paint: '#5b6b3a', rim: [0.15, 0.15, 0.16], caliper: GREY_CAL },
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

  Object.assign(BPAL, {
    HullBlue: [0.17, 0.24, 0.31], HullRed: [0.55, 0.12, 0.10], Deck: [0.33, 0.38, 0.34], Orange: [0.83, 0.33, 0.0],
    White: [0.92, 0.93, 0.93], WinDark: [0.10, 0.13, 0.17], Concrete: [0.62, 0.62, 0.60], TowerGlass: [0.22, 0.42, 0.56],
    DiceWhite: [0.97, 0.97, 0.95], ChipRed: [0.75, 0.08, 0.10], ChipBlue: [0.10, 0.25, 0.70], ChipBlack: [0.08, 0.08, 0.09],
    GlowRed: [1.0, 0.12, 0.12], HangarGrey: [0.68, 0.71, 0.74], RoofGrey: [0.42, 0.44, 0.47],
  });

  // Gerader Balken zwischen zwei Punkten (fuer Fachwerk, Streben, Seile)
  function strut(mb, m, a, b, w) {
    const d = sub(b, a), L = len(d), u = mul(d, 1 / L);
    let t = Math.abs(u[1]) < 0.9 ? cross(u, [0, 1, 0]) : cross(u, [1, 0, 0]);
    t = mul(t, 1 / len(t));
    const v = cross(u, t), hw = w / 2;
    const o = (p, s1, s2) => add(add(p, mul(t, s1 * hw)), mul(v, s2 * hw));
    mb.hexa(m, [o(a, -1, -1), o(a, 1, -1), o(a, 1, 1), o(a, -1, 1), o(b, -1, -1), o(b, 1, -1), o(b, 1, 1), o(b, -1, 1)]);
  }

  // Deterministischer Zufall (gleiche Stadt bei jedem Laden)
  const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  // ---------- Casino Dildilyne ----------
  function casinoDecor(d, g, p) {
    const { x0, x1, z0, z1, h } = p, cx = (x0 + x1) / 2, f = z0;
    // Gluehbirnen-Rahmen um das grosse DILDILYNE-Schild (30 x 7.5 m auf 14 m Hoehe)
    for (let x = cx - 15.6; x <= cx + 15.6 + 1e-6; x += 0.78) {
      for (const y of [10.0, 18.0]) g.box('GlowWarm', [x - 0.1, y - 0.1, f - 0.45], [x + 0.1, y + 0.1, f - 0.25]);
    }
    for (let y = 10.0; y <= 18.0 + 1e-6; y += 0.8) for (const s of SIDES) g.box('GlowWarm', [cx + s * 15.6 - 0.1, y - 0.1, f - 0.45], [cx + s * 15.6 + 0.1, y + 0.1, f - 0.25]);
    d.box('Gold', [cx - 15.9, 9.7, f - 0.3], [cx + 15.9, 9.85, f]);
    d.box('Gold', [cx - 15.9, 18.15, f - 0.3], [cx + 15.9, 18.3, f]);
    // senkrechte Neon-Streifen neben dem Schild, goldene Gesimse
    for (let x = x0 + 1.0; x < x1 - 0.5; x += 3.2) {
      if (Math.abs(x - cx) < 16.3) continue;
      g.box(Math.round((x - x0) / 3.2) % 2 ? 'GlowPink' : 'GlowWarm', [x - 0.12, 6.2, f - 0.18], [x + 0.12, h - 1.2, f - 0.02]);
    }
    for (const y of [9.2, h - 0.6]) d.box('Gold', [x0 - 0.3, y, f - 0.35], [x1 + 0.3, y + 0.4, f + 0.02]);
    for (const xs of [x0, x1]) g.box('GlowPink', [xs - 0.2, 6.0, f - 0.2], [xs + 0.2, h, f + 0.1]);
    // Krone: gestufte goldene Attika + Kugeln
    d.box('Gold', [x0 - 0.2, h, z0 - 0.2], [x1 + 0.2, h + 0.8, z0 + 0.6]);
    d.box('Gold', [cx - 9, h + 0.8, z0], [cx + 9, h + 2.2, z0 + 0.6]);
    d.box('Gold', [cx - 4.5, h + 2.2, z0], [cx + 4.5, h + 3.6, z0 + 0.6]);
    for (const x of [cx - 9, cx - 4.5, cx + 4.5, cx + 9]) d.prism('Gold', hexagon(x, z0 + 0.3, 0, 0.45, 8, 0, 1, 1).map(([a, b]) => [a, h + (Math.abs(x - cx) > 6 ? 2.2 : 3.6), b]), [0, 0.7, 0]);
    // Dach: zwei Riesen-Wuerfel + Chip-Stapel
    const dz = z0 + 8;
    const die = (x, y, z, s, pips) => {
      d.box('DiceWhite', [x - s, y, z - s], [x + s, y + 2 * s, z + s]);
      for (const [px, py] of pips) d.box('ChipBlack', [x + px * s - 0.22, y + s + py * s - 0.22, z - s - 0.04], [x + px * s + 0.22, y + s + py * s + 0.22, z - s + 0.01]);
      for (const [px, pz] of [[0, 0]]) d.box('ChipBlack', [x + px - 0.22, y + 2 * s - 0.01, z + pz - 0.22], [x + px + 0.22, y + 2 * s + 0.04, z + pz + 0.22]);
    };
    die(cx - 5, h, dz, 1.6, [[-0.5, 0.5], [0, 0], [0.5, -0.5]]);
    die(cx - 1.4, h, dz + 1.2, 1.6, [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [0, 0]]);
    let k = 0;
    for (const [sx, sz, n] of [[cx + 4.5, dz, 7], [cx + 7.5, dz + 1.5, 5]]) for (let i = 0; i < n; i++, k++)
      d.prism(['ChipRed', 'ChipBlue', 'ChipBlack', 'Gold'][k % 4], hexagon(sx, sz, 0, 1.3, 14, 0, 1, 1).map(([a, b]) => [a, h + i * 0.34, b]), [0, 0.3, 0]);
    // Eingang: Glastueren (leuchten) + goldene Pfosten mit rotem Seil am Teppich
    const zd = f - 0.52;
    d.box('Gold', [cx - 4.3, 0.2, zd - 0.06], [cx + 4.3, 4.3, zd + 0.02]);
    g.box('GlowWin', [cx - 4.0, 0.25, zd - 0.1], [cx + 4.0, 4.0, zd - 0.06]);
    for (let i = -3; i <= 3; i += 2) d.box('Gold', [cx + i - 0.04, 0.25, zd - 0.12], [cx + i + 0.04, 4.0, zd - 0.08]);
    for (const s of SIDES) {
      for (let z = f - 1.2; z >= f - 7.6; z -= 1.6) {
        d.prism('Gold', hexagon(cx + s * 2.3, z, 0, 0.07, 6, 0, 1, 1).map(([a, b]) => [a, 0.22, b]), [0, 0.95, 0]);
        d.prism('Gold', hexagon(cx + s * 2.3, z, 0, 0.12, 6, 0, 1, 1).map(([a, b]) => [a, 1.12, b]), [0, 0.14, 0]);
      }
      strut(d, 'ChipRed', [cx + s * 2.3, 1.0, f - 1.2], [cx + s * 2.3, 1.0, f - 7.6], 0.06);
    }
  }

  // ---------- Radj Tower ----------
  function towerDecor(d, g, p) {
    const { cx, cz } = p;
    const fins = (half, y0, y1, step, depth) => {
      for (let o = -half + step; o < half - 0.5; o += step) for (const s of SIDES) {
        d.box('DarkSteel', [cx + o - 0.12, y0, cz + s * half - (s > 0 ? 0 : depth)], [cx + o + 0.12, y1, cz + s * half + (s > 0 ? depth : 0)]);
        d.box('DarkSteel', [cx + s * half - (s > 0 ? 0 : depth), y0, cz + o - 0.12], [cx + s * half + (s > 0 ? depth : 0), y1, cz + o + 0.12]);
      }
    };
    fins(13, 6.5, 119.5, 2.6, 0.35);
    fins(9, 120.5, 139.5, 2.0, 0.3);
    // Leuchtbaender an den Absaetzen + rote Kanten oben
    for (const [hf, y] of [[13.05, 119.4], [9.05, 139.4], [13.05, 6.2]]) {
      g.box('GlowRed', [cx - hf - 0.15, y, cz - hf - 0.15], [cx + hf + 0.15, y + 0.35, cz - hf + 0.05]);
      g.box('GlowRed', [cx - hf - 0.15, y, cz + hf - 0.05], [cx + hf + 0.15, y + 0.35, cz + hf + 0.15]);
      g.box('GlowRed', [cx - hf - 0.15, y, cz - hf], [cx - hf + 0.05, y + 0.35, cz + hf]);
      g.box('GlowRed', [cx + hf - 0.05, y, cz - hf], [cx + hf + 0.15, y + 0.35, cz + hf]);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box('GlowRed', [cx + sx * 9 - 0.2, 120.5, cz + sz * 9 - 0.2], [cx + sx * 9 + 0.2, 139.4, cz + sz * 9 + 0.2]);
    // Terrasse mit Gelaender auf dem Absatz (120 m)
    for (const s of SIDES) {
      d.box('Steel', [cx - 12.8, 121.1, cz + s * 12.8 - 0.05], [cx + 12.8, 121.2, cz + s * 12.8 + 0.05]);
      d.box('Steel', [cx + s * 12.8 - 0.05, 121.1, cz - 12.8], [cx + s * 12.8 + 0.05, 121.2, cz + 12.8]);
    }
    // Krone: schraeges Stahlgeruest um die Antenne + Leuchtfeuer
    const top = 140, ap = [cx, top + 12, cz];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strut(d, 'Steel', [cx + sx * 8.5, top, cz + sz * 8.5], ap, 0.5);
    for (const yy of [top + 3, top + 6.5]) {
      const r = 8.5 * (1 - (yy - top) / 12);
      for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]])
        strut(d, 'Steel', [cx + a[0] * r, yy, cz + a[1] * r], [cx + b[0] * r, yy, cz + b[1] * r], 0.3);
    }
    g.box('GlowRed', [cx - 0.5, 161.6, cz - 0.5], [cx + 0.5, 162.6, cz + 0.5]);
    g.box('GlowRed', [cx - 0.35, 152, cz - 0.35], [cx + 0.35, 152.6, cz + 0.35]);
    // Lobby-Vordaecher (Nord + Sued) mit Glastueren
    for (const s of SIDES) {
      const zf = cz + s * 13;
      d.box('DarkSteel', [cx - 6, 5.0, Math.min(zf, zf + s * 4.5)], [cx + 6, 5.5, Math.max(zf, zf + s * 4.5)]);
      g.box('GlowWhite', [cx - 5.6, 4.9, Math.min(zf + s * 4.2, zf + s * 4.4)], [cx + 5.6, 5.0, Math.max(zf + s * 4.2, zf + s * 4.4)]);
      g.box('GlowWin', [cx - 4, 0.25, Math.min(zf, zf + s * 0.06)], [cx + 4, 4.6, Math.max(zf, zf + s * 0.06)]);
      d.box('Gold', [cx - 4.3, 4.6, Math.min(zf, zf + s * 0.1)], [cx + 4.3, 4.9, Math.max(zf, zf + s * 0.1)]);
    }
  }

  // ---------- Docks: Container (ersetzt die einfachen Container-Kisten) ----------
  // Mitte (x,y,z), 2.45 breit (x), 2.6 hoch, 6.1 lang (z) - genau wie im Spiel
  function containerParts(mb, x, y, z, along) {
    const W = 1.225, H = 1.3, Lh = 3.05;
    const P = (a, b, c) => (along === 'x' ? [x + c, y + b, z + a] : [x + a, y + b, z + c]);
    const box = (m, lo, hi) => { const a = P(lo[0], lo[1], lo[2]), b = P(hi[0], hi[1], hi[2]); mb.box(m, [Math.min(a[0], b[0]), a[1], Math.min(a[2], b[2])], [Math.max(a[0], b[0]), b[1], Math.max(a[2], b[2])]); };
    box('Paint', [-W + 0.05, -H, -Lh + 0.06], [W - 0.05, H - 0.04, Lh - 0.06]);
    for (const s of SIDES) for (const t of SIDES) box('PaintDark', [s > 0 ? W - 0.15 : -W, -H, t > 0 ? Lh - 0.15 : -Lh], [s > 0 ? W : -W + 0.15, H, t > 0 ? Lh : -Lh + 0.15]);
    for (const s of SIDES) {
      for (let c = -Lh + 0.45; c < Lh - 0.3; c += 0.62) box('PaintDark', [s > 0 ? W - 0.06 : -W, -H + 0.12, c - 0.1], [s > 0 ? W : -W + 0.06, H - 0.12, c + 0.1]);
      box('PaintDark', [-W, s * H - (s > 0 ? 0.1 : 0), -Lh], [W, s * H + (s > 0 ? 0 : 0.1), Lh]);
    }
    for (const bx of [-0.75, -0.3, 0.3, 0.75]) box('Steel', [bx - 0.03, -H + 0.12, -Lh - 0.03], [bx + 0.03, H - 0.12, -Lh + 0.01]);
  }

  // ---------- Docks: Containerbruecke / Kran ----------
  function craneParts(mb, x, z) {
    const legs = [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]];
    mb.box('Concrete', [x - 1.6, 0, z - 1.6], [x + 1.6, 0.6, z + 1.6]);
    for (const [a, b] of legs) mb.box('Orange', [x + a - 0.22, 0.6, z + b - 0.22], [x + a + 0.22, 31, z + b + 0.22]);
    for (let y = 2; y < 30; y += 4) {
      for (const [p, q] of [[0, 1], [1, 3], [3, 2], [2, 0]]) {
        const A = legs[p], B = legs[q];
        strut(mb, 'Orange', [x + A[0], y, z + A[1]], [x + B[0], y + 4, z + B[1]], 0.12);
        strut(mb, 'Orange', [x + A[0], y + 4, z + A[1]], [x + B[0], y + 4, z + B[1]], 0.14);
      }
    }
    // Maschinenhaus mit Fenstern + Fuehrerkabine
    mb.box('Orange', [x - 1.8, 31, z - 1.8], [x + 1.8, 33.4, z + 2.6]);
    mb.box('WinDark', [x - 1.82, 32.0, z - 1.0], [x + 1.82, 32.7, z + 2.0]);
    mb.box('White', [x - 0.8, 29.6, z - 3.4], [x + 0.8, 31.2, z - 1.8]);
    mb.box('WinDark', [x - 0.82, 30.1, z - 3.42], [x + 0.82, 30.9, z - 2.2]);
    // Fachwerk-Ausleger (dreieckig) Richtung Wasser (-z) + Gegengewicht
    const z0 = z + 8, z1 = z - 29, yb = 33.0, yt = 35.0;
    const ch = [[-0.6, yb], [0.6, yb], [0, yt]];
    for (const [cx, cy] of ch) mb.box('Orange', [x + cx - 0.12, cy - 0.12, z1], [x + cx + 0.12, cy + 0.12, z0]);
    for (let zz = z1; zz < z0 - 0.1; zz += 2.0) {
      const zn = Math.min(zz + 2.0, z0);
      strut(mb, 'Orange', [x - 0.6, yb, zz], [x, yt, zn], 0.08);
      strut(mb, 'Orange', [x + 0.6, yb, zz], [x, yt, zn], 0.08);
      strut(mb, 'Orange', [x - 0.6, yb, zz], [x + 0.6, yb, zn], 0.08);
    }
    mb.box('Concrete', [x - 1.4, 31.5, z + 5.5], [x + 1.4, 33.0, z + 8.0]);
    strut(mb, 'Steel', [x, 37.5, z], [x, yt, z1 + 1], 0.07);
    strut(mb, 'Steel', [x, 37.5, z], [x, yt, z0 - 0.5], 0.07);
    mb.box('Orange', [x - 0.3, 33.4, z - 0.3], [x + 0.3, 37.6, z + 0.3]);
    mb.box('GlowRed', [x - 0.2, 37.6, z - 0.2], [x + 0.2, 37.9, z + 0.2]);
    // Laufkatze + Seile + Spreader (haengt wie im Spiel bei z-24)
    const zt = z - 24;
    mb.box('DarkSteel', [x - 0.9, yb - 0.6, zt - 0.8], [x + 0.9, yb - 0.1, zt + 0.8]);
    for (const s of SIDES) strut(mb, 'Black', [x + s * 0.3, yb - 0.6, zt], [x + s * 0.8, 15.4, zt], 0.05);
    mb.box('Hazard', [x - 1.25, 14.8, zt - 3.05], [x + 1.25, 15.4, zt + 3.05]);
  }

  // ---------- Docks: Frachtschiff (ersetzt Rumpf/Aufbau am Kai) ----------
  function shipParts(mb, cx, cz) {
    // Laengsschnitte: x relativ zur Mitte (Bug bei -55, Heck bei +55), halbe Breite, Kiel-y, Deck-y
    const S = [[-55, 0.3, 2.5, 6.6], [-52.5, 5.5, -0.5, 6.3], [-48, 9.5, -3.2, 5.9], [-40, 11.6, -4.0, 5.6], [-25, 12, -4.0, 5.4],
      [30, 12, -4.0, 5.4], [44, 11.6, -3.6, 5.5], [52, 10.5, -1.8, 5.8], [55, 9.6, -0.6, 6.0]];
    const ring = ([x, w, keel, deck]) => {
      const wl = 0.3, k2 = Math.min(keel + 1.6, wl - 0.1);
      const pts = [[0, keel], [w * 0.8, keel], [w, Math.max(k2, keel)], [w, Math.max(wl, k2)], [w, deck - 1.0], [w * 1.0, deck]];
      return pts.map(([zz, y]) => [cx + x, y, zz]);
    };
    const R = S.map(ring);
    const mats = ['HullRed', 'HullRed', 'HullRed', 'HullBlue', 'HullRed'];
    for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < 5; k++) {
      const P = (r, j) => [r[j][0], r[j][1], cz + r[j][2]], M = (r, j) => [r[j][0], r[j][1], cz - r[j][2]];
      const a = P(R[i], k), b = P(R[i + 1], k), c = P(R[i + 1], k + 1), dd = P(R[i], k + 1);
      const ax = (p) => [p[0], 1.0, cz];
      const O = (m, q) => { const ctr = ax(q[0]); mb.triO(m, q[0], q[1], q[2], ctr); mb.triO(m, q[0], q[2], q[3], ctr); };
      O(mats[k], [a, b, c, dd]);
      O(mats[k], [M(R[i], k), M(R[i + 1], k), M(R[i + 1], k + 1), M(R[i], k + 1)]);
      if (k === 4) {
        const q = [[R[i][5][0], R[i][5][1], cz - R[i][5][2]], [R[i + 1][5][0], R[i + 1][5][1], cz - R[i + 1][5][2]],
          [R[i + 1][5][0], R[i + 1][5][1], cz + R[i + 1][5][2]], [R[i][5][0], R[i][5][1], cz + R[i][5][2]]];
        mb.triO('Deck', q[0], q[1], q[2], [q[0][0], 0, cz]); mb.triO('Deck', q[0], q[2], q[3], [q[0][0], 0, cz]);
      }
    }
    const last = R[R.length - 1], stern = last.map((p) => [p[0], p[1], cz + p[2]]).concat(last.slice().reverse().map((p) => [p[0], p[1], cz - p[2]]));
    { let c = [0, 0, 0]; stern.forEach((p) => { c = add(c, p); }); c = mul(c, 1 / stern.length);
      for (let i = 0; i < stern.length; i++) mb.triO('HullBlue', c, stern[i], stern[(i + 1) % stern.length], [c[0] - 5, c[1], c[2]]); }
    // Ladung: Containerreihen auf Deck (laengs), 2-3 hoch
    const r = rng(7), cols = ['ChipRed', 'ChipBlue', 'Orange', 'BottleGreen', 'Hazard', 'White', 'HangarGrey'];
    for (let bx = -44; bx < 20; bx += 6.5) for (let row = -4; row < 4; row++) {
      const hgt = 1 + Math.floor(r() * 3);
      for (let k = 0; k < hgt; k++) {
        const zz = cz + row * 2.6 + 1.3, yy = 5.5 + k * 2.6;
        mb.box(cols[Math.floor(r() * cols.length)], [cx + bx - 3.0, yy, zz - 1.2], [cx + bx + 3.0, yy + 2.55, zz + 1.2]);
      }
    }
    // Aufbau am Heck: Wohndeck, Bruecke mit Nocken, Schornstein, Mast mit Radar
    const ax = cx + 38;
    mb.box('White', [ax - 6, 5.4, cz - 9], [ax + 6, 17, cz + 9]);
    for (let y = 7; y < 16.5; y += 2.6) mb.box('WinDark', [ax - 6.05, y, cz - 8], [ax - 5.95, y + 1.0, cz + 8]);
    mb.box('White', [ax - 6.5, 17, cz - 12], [ax + 4, 19.6, cz + 12]);
    mb.box('WinDark', [ax - 6.55, 17.9, cz - 11.5], [ax - 6.45, 19.2, cz + 11.5]);
    mb.box('Concrete', [ax - 6.8, 19.6, cz - 12.2], [ax + 4.2, 19.9, cz + 12.2]);
    mb.box('HullBlue', [ax + 7, 5.4, cz - 2.2], [ax + 11, 22, cz + 2.2]);
    mb.box('Hazard', [ax + 6.98, 18.5, cz - 2.22], [ax + 11.02, 19.6, cz + 2.22]);
    mb.box('Black', [ax + 7.2, 22, cz - 2.0], [ax + 10.8, 22.4, cz + 2.0]);
    mb.box('White', [ax - 1, 19.9, cz - 0.2], [ax - 0.6, 26, cz + 0.2]);
    mb.box('DarkSteel', [ax - 1.0, 24, cz - 1.8], [ax - 0.6, 24.3, cz + 1.8]);
    mb.box('GlowRed', [ax - 0.95, 26, cz - 0.15], [ax - 0.65, 26.3, cz + 0.15]);
    // Bugmast + Ankerkluesen
    mb.box('White', [cx - 50.5, 6.3, cz - 0.15], [cx - 50.2, 13, cz + 0.15]);
    for (const s of SIDES) mb.prism('Black', hexagon(cz + s * 3.6, 4.2, 0, 0.45, 8, 0, 1, 1).map(([a, b]) => [cx - 52.3 + 0.0, b, a]), [0.5, 0, 0]);
  }

  // ---------- Flughafen ----------
  function towerAirportParts(mb, x, z) {
    const oct = (r, y) => hexagon(x, z, 0, r, 8, Math.PI / 8, 1, 1).map(([a, b]) => [a, y, b]);
    const band = (m, r0, y0, r1, y1) => {
      const A = oct(r0, y0), B = oct(r1, y1);
      mb.convex(m, [A, B].concat(A.map((p, i) => [p, A[(i + 1) % 8], B[(i + 1) % 8], B[i]])));
    };
    band('Concrete', 3.3, 0, 2.5, 23.8);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + i * Math.PI / 4;
      if (i % 2) continue;
      strut(mb, 'WinDark', [x + Math.cos(a) * 3.2, 2, z + Math.sin(a) * 3.2], [x + Math.cos(a) * 2.55, 22.5, z + Math.sin(a) * 2.55], 0.5);
    }
    band('White', 4.6, 23.8, 4.6, 25.9);
    band('Steel', 4.75, 25.9, 4.75, 26.05);
    band('TowerGlass', 4.3, 26.05, 5.3, 30.0);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + i * Math.PI / 4;
      strut(mb, 'White', [x + Math.cos(a) * 4.32, 26.05, z + Math.sin(a) * 4.32], [x + Math.cos(a) * 5.32, 30.0, z + Math.sin(a) * 5.32], 0.18);
    }
    band('White', 5.5, 30.0, 4.8, 30.9);
    mb.box('Steel', [x - 0.08, 30.9, z - 0.08], [x + 0.08, 35, z + 0.08]);
    mb.box('GlowRed', [x - 0.2, 35, z - 0.2], [x + 0.2, 35.4, z + 0.2]);
    mb.box('DarkSteel', [x + 1.6, 30.9, z - 0.2], [x + 1.9, 31.8, z + 0.2]);
    mb.box('DarkSteel', [x + 0.6, 31.8, z - 0.15], [x + 2.9, 32.1, z + 0.15]);
    mb.prism('White', hexagon(x - 2.2, z + 1.2, 0, 0.9, 10, 0, 1, 1).map(([a, b]) => [a, 30.9, b]), [0, 1.2, 0]);
  }

  function hangarParts(mb, cx, cz, num) {
    // Tonnendach ueber dem flachen Dach (Oberkante 12.6), Front = -z
    const N = 8, hw = 16.4, rise = 3.6, y0 = 12.6;
    const arc = (i) => { const t = i / N, a = Math.PI * t; return [cx - hw * Math.cos(a), y0 + rise * Math.sin(a)]; };
    for (let i = 0; i < N; i++) {
      const [xa, ya] = arc(i), [xb, yb] = arc(i + 1);
      mb.quad('RoofGrey', [xa, ya, cz - 11.4], [xa, ya, cz + 11.4], [xb, yb, cz + 11.4], [xb, yb, cz - 11.4]);
    }
    for (const s of SIDES) {
      const zz = cz + s * 11.4, pts = [];
      for (let i = 0; i <= N; i++) { const [xa, ya] = arc(i); pts.push([xa, ya, zz]); }
      if (s < 0) mb.poly('HangarGrey', pts.slice().reverse(), [cx, y0, zz]); else mb.poly('HangarGrey', pts, [cx, y0, zz]);
    }
    // Schiebetore mit Streifen, Leuchten, Hangar-Nummer (7-Segment)
    const f = cz - 11.1;
    for (let i = 0; i < 6; i++) {
      const x0 = cx - 12 + i * 4;
      mb.box('Steel', [x0 + 0.05, 0.2, f - 0.35], [x0 + 3.95, 8.4, f - 0.25]);
      mb.box('DarkSteel', [x0 + 0.05, 4.2, f - 0.38], [x0 + 3.95, 4.35, f - 0.34]);
      for (let k = 0; k < 4; k++) mb.box(k % 2 ? 'Black' : 'Hazard', [x0 + k, 0.2, f - 0.4], [x0 + k + 1, 0.7, f - 0.36]);
    }
    mb.box('DarkSteel', [cx - 12.5, 8.4, f - 0.6], [cx + 12.5, 8.9, f - 0.2]);
    for (const x of [cx - 9, cx - 3, cx + 3, cx + 9]) mb.box('GlowWarm', [x - 0.5, 8.3, f - 0.55], [x + 0.5, 8.4, f - 0.25]);
    const seg = { 1: ['b', 'c'], 2: ['a', 'b', 'g', 'e', 'd'], 3: ['a', 'b', 'g', 'c', 'd'] }[num] || [];
    const sx = cx, sy = 9.6, w = 1.2, hh = 1.0, t = 0.25;
    const S7 = { a: [[-w / 2, hh * 2 - t], [w / 2, hh * 2]], b: [[w / 2 - t, hh], [w / 2, hh * 2]], c: [[w / 2 - t, 0], [w / 2, hh]],
      d: [[-w / 2, 0], [w / 2, t]], e: [[-w / 2, 0], [-w / 2 + t, hh]], f: [[-w / 2, hh], [-w / 2 + t, hh * 2]], g: [[-w / 2, hh - t / 2], [w / 2, hh + t / 2]] };
    mb.box('Black', [sx - 1.0, sy - 0.25, f - 0.25], [sx + 1.0, sy + 2.25, f - 0.2]);
    for (const k of seg) mb.box('Hazard', [sx - S7[k][1][0], sy + S7[k][0][1], f - 0.3], [sx - S7[k][0][0], sy + S7[k][1][1], f - 0.25]);
  }

  function terminalParts(mb, x0, x1, z0, z1, h) {
    const f = z0;   // Front (Flugschule-Seite) = -z
    // auskragendes Vordach + Glasfassade mit Pfosten
    mb.box('White', [x0 - 0.5, h - 0.2, f - 4.0], [x1 + 0.5, h + 0.35, f]);
    mb.box('Steel', [x0 - 0.5, h - 0.4, f - 4.05], [x1 + 0.5, h - 0.2, f - 3.9]);
    for (let x = x0 + 2.0; x < x1 - 1.9; x += 2.0) mb.box('DarkSteel', [x - 0.08, 2.0, f - 0.42], [x + 0.08, 7.0, f - 0.25]);
    mb.box('DarkSteel', [x0 + 1.9, 6.9, f - 0.42], [x1 - 1.9, 7.1, f - 0.25]);
    mb.box('GlowWin', [x0 + (x1 - x0) / 2 - 3, 0.2, f - 0.12], [x0 + (x1 - x0) / 2 + 3, 3.4, f - 0.05]);
    // Dach: Lueftung + Radarkuppel + Windsack
    for (let i = 0; i < 4; i++) mb.box('Steel', [x0 + 8 + i * 6, h, z1 - 8], [x0 + 11 + i * 6, h + 1.2, z1 - 5]);
    const rx = x1 - 8, rz = (z0 + z1) / 2;
    mb.box('Concrete', [rx - 1.2, h, rz - 1.2], [rx + 1.2, h + 1.6, rz + 1.2]);
    const dome = (r, y) => hexagon(rx, rz, 0, r, 10, 0, 1, 1).map(([a, b]) => [a, y, b]);
    mb.convex('White', [dome(1.8, h + 1.6), dome(1.6, h + 2.8), dome(0.9, h + 3.6)].concat(
      dome(1.8, h + 1.6).map((p, i, A) => [p, A[(i + 1) % 10], dome(1.6, h + 2.8)[(i + 1) % 10], dome(1.6, h + 2.8)[i]]),
      dome(1.6, h + 2.8).map((p, i, A) => [p, A[(i + 1) % 10], dome(0.9, h + 3.6)[(i + 1) % 10], dome(0.9, h + 3.6)[i]])));
    mb.box('Steel', [x0 + 3 - 0.07, h, z0 + 3 - 0.07], [x0 + 3 + 0.07, h + 6, z0 + 3 + 0.07]);
    for (let i = 0; i < 4; i++) {
      const r0 = 0.45 - i * 0.07;
      mb.prism(i % 2 ? 'White' : 'Orange', hexagon(h + 5.7, z0 + 3, 0, r0, 8, 0, 1, 1).map(([a, b]) => [x0 + 3.1 + i * 0.6, a, b]), [0.6, 0, 0]);
    }
  }

  // Liefert fertige Geometrie mit Vertex-Farben (fuer die gemergten Deko-Listen des Spiels)
  function toGeo(THREE, mb, paintHex) {
    const paint = new THREE.Color(paintHex || '#888888');
    const dark = paint.clone().multiplyScalar(0.62);
    const cache = {};
    const colorOf = (m) => {
      if (m === 'Paint') return paint;
      if (m === 'PaintDark') return dark;
      if (cache[m]) return cache[m];
      return (cache[m] = new THREE.Color().setRGB(...(BPAL[m] || SRGB[m] || [0.5, 0.5, 0.5]), THREE.SRGBColorSpace));
    };
    return vcGeometry(THREE, mb, () => true, colorOf);
  }

  const dildiCityDocks = {
    // ersetzt k(2.45,2.6,6.1, x, y, z, farbe) bei den Container-Stapeln
    container(THREE, x, y, z, color) { const mb = new MB(); containerParts(mb, x, y, z, 'z'); return toGeo(THREE, mb, color); },
    // ersetzt die orangenen Kran-Boxen (Fundament, 4 Beine, Kabine, Ausleger, Seil) an (x, z)
    crane(THREE, x, z) { const mb = new MB(); craneParts(mb, x, z); return toGeo(THREE, mb); },
    // ersetzt Rumpf, Deckband, Aufbau und Deck-Container des Frachters (Mitte cx, cz)
    ship(THREE, cx = -110, cz = -722) { const mb = new MB(); shipParts(mb, cx, cz); return toGeo(THREE, mb); },
  };
  const dildiCityAirport = {
    // ersetzt Schaft, Kanzel und Dach des Towers bei (x, z)
    tower(THREE, x = 190, z = -600) { const mb = new MB(); towerAirportParts(mb, x, z); return toGeo(THREE, mb); },
    // Zusatz-Deko pro Hangar (Box + Dachplatte des Spiels bleiben): Mitte (cx, cz), Nummer 1/2
    hangar(THREE, cx, cz, num) { const mb = new MB(); hangarParts(mb, cx, cz, num); return toGeo(THREE, mb); },
    // Zusatz-Deko fuer Bilal's Flugschule / Terminal (Gebaeude bleibt): Rechteck + Hoehe
    terminal(THREE, x0 = 60, x1 = 140, z0 = -540, z1 = -515, h = 10) { const mb = new MB(); terminalParts(mb, x0, x1, z0, z1, h); return toGeo(THREE, mb); },
    // ersetzt die Geometrie eines geparkten Deko-Flugzeugs: Position, Drehung, Farbe
    parkedPlane(THREE, x, z, rotY, color) {
      const { mb, prop } = planeParts();
      const all = new MB();
      for (const m in mb.t) all.t[m] = mb.t[m].slice();
      for (const m in prop.t) (all.t[m] = all.t[m] || []).push(...prop.t[m].map((p) => [p[0], p[1] + 1.30, p[2] + 4.88]));
      const c = Math.cos(rotY), s = Math.sin(rotY);
      for (const m in all.t) all.t[m] = all.t[m].map((p) => [x + p[0] * c + p[2] * s, p[1], z - p[0] * s + p[2] * c]);
      const fixed = { PlaneWhite: [0.93, 0.93, 0.92], NavRed: [1, 0.1, 0.1], NavGreen: [0.1, 1, 0.2], PlaneTip: [0.95, 0.75, 0.1] };
      Object.assign(BPAL, fixed);
      return toGeo(THREE, all, color);
    },
  };

  function dildiCityBuilding(THREE, kind, params, mats) {
    const d = new MB(), g = new MB();
    if (kind === 'pizza') pizzaDecor(d, g, params);
    else if (kind === 'depot') depotDecor(d, g, params);
    else if (kind === 'customs') customsDecor(d, g, params);
    else if (kind === 'bank') bankDecor(d, g, params);
    else if (kind === 'casino') casinoDecor(d, g, params);
    else if (kind === 'tower') towerDecor(d, g, params);
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

  const api = { createRS6, createFerrari, createVehicle, dildiCityVehicle, dildiCityPlane, dildiCityBuilding, dildiCityDocks, dildiCityAirport, dildiCityInterchange, dildiKreuz, types: Object.keys(VEHICLES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DildiCars = api;
})(typeof window !== 'undefined' ? window : globalThis);
