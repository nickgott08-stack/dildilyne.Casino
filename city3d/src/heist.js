// Radj-Coup, Etappe 1: planning board in the Versteck + missions 1–4
// (installed as extra methods on the Missions class)
import * as THREE from 'three';
import { world, groundAt, addBox } from './world.js';
import { POI, ROADS, RUNWAY } from './geo.js';
import { Vehicle } from './vehicles.js';
import { Ped, OutDriver } from './ai.js';
import { Plane } from './plane.js';
import { buildRadjIsland, ISL } from './radj.js';
import { RADJ_CELLAR, radjE } from './geo.js';
import { neonSign, rand, store } from './util.js';

const $ = (id) => document.getElementById(id);
const weekId = () => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-' + Math.ceil(((t - y0) / 864e5 + 1) / 7); };
const fmt = (n) => Math.round(n).toLocaleString('de-DE');

export const COUP = [
  {
    title: 'Radjs Lagerhalle',
    icon: '💻',
    where: 'Docks',
    short: '5 Wachen ausschalten, Computer hacken, Plan runterladen',
    film: [
      ['🎩', 'Vladimir Radj hütet in seinem Anwesen die goldene Bubensahne.'],
      ['🏭', 'In seiner Lagerhalle an den Docks steht ein Computer mit dem Grundriss.'],
      ['💻', 'Schalte die 5 Wachen aus und lade den Plan herunter. Keine Polizei – das hier bleibt unter uns.'],
    ],
  },
  {
    title: 'Waffen der Schmuggler',
    icon: '🪖',
    where: 'Schmuggler-Camp (Westwüste)',
    short: 'AK-Kiste aus dem Camp holen und ins Versteck bringen',
    film: [
      ['⛺', 'Im Schmuggler-Camp in der Westwüste lagern frische AKs.'],
      ['🪖', 'Für Radjs Wachen brauchen wir mehr als eine Pistole.'],
      ['📦', 'Hol die Waffenkiste und bring sie ins Versteck. Die Schmuggler schießen sofort.'],
    ],
  },
  {
    title: 'Der Glasschneider',
    icon: '🛠️',
    where: 'Siedlung (Ostwüste)',
    short: 'Jeep mit dem Glasschneider stoppen, Kiste ins Versteck bringen',
    film: [
      ['🔐', 'Radjs Glaskasten ist aus Panzerglas – wir brauchen einen Diamant-Glasschneider.'],
      ['🚙', 'Ein Schmuggler-Jeep bringt ihn gerade durch die Ostwüste.'],
      ['💥', 'Der Fahrer haut ab, sobald er dich sieht. Ramm oder beschieß den Jeep, bis er liegen bleibt.'],
    ],
  },
  {
    title: "Bilal's Flugzeug",
    icon: '✈️',
    where: 'Flughafen → Landebahn Westwüste',
    short: 'Flugzeug klauen und auf der verlassenen Landebahn landen',
    film: [
      ['🏝️', 'Radjs Insel erreicht man nur aus der Luft.'],
      ['✈️', "Bilal lässt sein Schulflugzeug immer am Rollfeld stehen. Schlüssel steckt."],
      ['🛬', 'Flieg es zur verlassenen Landebahn in der Westwüste und lande sauber. Dort wartet es aufs Finale.'],
    ],
  },
  {
    title: 'Das Finale',
    icon: '👑',
    where: 'Radj-Insel',
    short: 'Mit dem Auto zur Landebahn, Flug zur Insel, Anwesen, goldene Bubensahne',
    film: [
      ['🚙', 'Heute Nacht holen wir sie. Fahr mit einem Auto deiner Wahl zur Landebahn in der Westwüste.'],
      ['✈️', 'Flieg nach Süden aufs Meer – Radjs Insel liegt hinter den Docks. Lande auf seiner Privatpiste.'],
      ['🌲', 'Ein Schlängelweg durch dichten Wald führt zum Anwesen. Die Torwache hat die Torkarte.'],
      ['🔦', 'Drinnen patrouillieren rund 20 Wachen mit Taschenlampen. Bleib aus den Lichtkegeln. Nur Schalldämpfer, keine Weste.'],
      ['💳', 'Eine Wache trägt die Aufzugkarte. Der Aufzug führt in den Keller zum Glaskasten.'],
      ['👑', 'Schneid das Glas auf, schnapp dir die goldene Bubensahne – und dann ab zum Helikopter!'],
    ],
  },
];

const smugglerLook = () => ({ skin: '#c68a62', hair: '#111', shirt: '#6b5a3a', pants: '#3a3a2a', shoes: '#2a2216', hairStyle: 0, cap: '#4a3a22', cop: true });
const radjLook = () => ({ skin: '#e0ac85', hair: '#222', shirt: '#7a1010', pants: '#141414', shoes: '#111', hairStyle: 0, cap: '#111', cop: true });

export function installHeist(Missions) {
  const P = Missions.prototype;

  P.coupStep = function () { return Math.min(4, +store.get('dc3d_coup') || 0); };

  P.buildHeist = function () {
    const scene = this.scene;
    // planning board in front of the Versteck
    const b = world.coupBoard;
    if (b) {
      const y = groundAt(b.x, b.z);
      const grp = new THREE.Group();
      const legM = new THREE.MeshStandardMaterial({ color: '#3a2a1a' });
      for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), legM); l.position.set(sx * 1.3, 1.3, 0); grp.add(l); }
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), new THREE.MeshBasicMaterial({ map: neonSign('RADJ-COUP', '#ffd23b', { size: 110, bg: '#1b2a1b' }), toneMapped: false, side: THREE.DoubleSide }));
      board.position.set(0, 2.0, 0.07);
      grp.add(board);
      grp.position.set(b.x, y, b.z);
      grp.rotation.y = Math.PI;
      scene.add(grp);
      world.signMats.push(board.material);
      addBox(b.x - 1.4, b.x + 1.4, b.z - 0.15, b.z + 0.15, y + 2.8, { y0: y - 1 });
      world.landmarks.push({ name: 'Radj-Coup', x: b.x, z: b.z - 2, icon: '👑', color: '#ffd23b' });
    }
    // Radj's computer at the warehouse door
    const w = world.radjWarehouse;
    if (w) {
      this.coupPC = { x: w.x, z: w.z - 6.5 };
      const g = new THREE.Group();
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.8), new THREE.MeshStandardMaterial({ color: '#4a4d52' }));
      desk.position.y = 0.45;
      const scr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), new THREE.MeshBasicMaterial({ color: '#39ff88', toneMapped: false }));
      scr.position.set(0, 1.25, -0.2);
      g.add(desk, scr);
      g.position.set(this.coupPC.x, groundAt(this.coupPC.x, this.coupPC.z), this.coupPC.z);
      scene.add(g);
      this.coupPCScreen = scr;
    }
    // the plane: at Bilal's runway, or already hidden on the desert runway
    const hidden = this.coupStep() >= 4;
    const pp = hidden ? { x: RUNWAY.x0 + 40, z: (RUNWAY.z0 + RUNWAY.z1) / 2, h: Math.PI / 2 } : { x: 44, z: -676, h: Math.PI / 2 };
    this.plane = new Plane(scene, pp.x, pp.z, pp.h);
    this.G.planeProp = this.plane;
    this.isl = buildRadjIsland(scene);
  };
  P.finaleDone = function () { return store.get('dc3d_coupWeek') === weekId(); };

  // ---------- planning board ----------
  P.openBoard = function () {
    const step = this.coupStep();
    this.G.paused = true;
    const el = $('coupList');
    el.innerHTML = COUP.map((m, i) => {
      const st = i < step ? 'done' : i === step ? 'next' : 'lock';
      const fin = i === 4 && st === 'next' && this.finaleDone();
      const badge = st === 'done' ? '✓ Erledigt' : fin ? '✓ Diese Woche geschafft' : st === 'next' ? '▶ Als Nächstes' : '🔒';
      return `<div class="cm ${st}"><div class="cmI">${m.icon}</div><div class="cmT"><b>${i + 1}. ${m.title}</b><small>${m.where} · ${m.short}</small></div><span>${badge}</span></div>`;
    }).join('');
    const can = step < 4 || !this.finaleDone();
    $('coupGo').style.display = can ? '' : 'none';
    $('coupGo').textContent = step >= 4 ? '👑 Finale starten' : `▶ Mission ${step + 1} starten`;
    $('coupInfo').textContent = step >= 4 ? (this.finaleDone() ? 'Diese Woche hast du Radj schon ausgeraubt – nächste Woche wieder.' : 'Finale: 150.000 D$ · 1× pro Woche · ohne Polizei, aber mit 20 Wachen.') : 'Missionen laufen ohne Polizei. Belohnung nach dem Finale: 150.000 D$.';
    $('coup').classList.add('show');
  };
  P.closeBoard = function () { $('coup').classList.remove('show'); this.G.paused = false; };

  // ---------- briefing film ----------
  P.playFilm = function (n, done) {
    const m = COUP[n];
    const el = $('film');
    let k = 0, timer = null;
    this.G.paused = true;
    el.classList.add('show');
    $('filmT').textContent = `MISSION ${n + 1}: ${m.title.toUpperCase()}`;
    const show = () => {
      clearTimeout(timer);
      if (k >= m.film.length) { el.classList.remove('show'); el.onclick = null; this.G.paused = false; done(); return; }
      const [ic, txt] = m.film[k];
      $('filmIco').textContent = ic;
      const tx = $('filmTxt');
      tx.textContent = '';
      let c = 0;
      const type = () => { if (c <= txt.length) { tx.textContent = txt.slice(0, c); c += 2; this._typeT = setTimeout(type, 28); } };
      clearTimeout(this._typeT);
      type();
      $('filmIco').classList.remove('pop'); void $('filmIco').offsetWidth; $('filmIco').classList.add('pop');
      k++;
      timer = setTimeout(show, 3800);
    };
    el.onclick = () => show();
    show();
  };

  P.startCoup = function () {
    const n = this.coupStep();
    this.closeBoard();
    if (this.busy()) return;
    if (n >= 4) { if (this.finaleDone()) return; this.playFilm(4, () => this.beginFinale()); return; }
    this.playFilm(n, () => this.beginCoup(n));
  };

  P.beginCoup = function (n) {
    const G = this.G;
    G.noPolice = true;
    this.api.setStars(0);
    this.job = { kind: 'coup', n, stage: 'go', peds: [], vehs: [] };
    const j = this.job;
    if (n === 0) {
      const w = world.radjWarehouse;
      const posts = [[w.x - 18, w.z + 6], [w.x + 2, w.z + 10], [w.x + 22, w.z + 4], [w.x - 6, w.z + 22], [w.x + 30, w.z + 18]];
      for (const [x, z] of posts) j.peds.push(this.coupGuard(x, z, radjLook()));
      j.target = { x: w.x, z: w.z };
      this.api.banner('💻 MISSION 1', 'Fahr zu Radjs Lagerhalle an den Docks');
    } else if (n === 1) {
      const c = POI.camp;
      for (const [dx, dz] of [[-6, -14], [8, -12], [-16, 2], [14, 4], [0, 16]]) j.peds.push(this.coupGuard(c.x + dx, c.z + dz, smugglerLook()));
      j.crate = this.coupCrate(c.x + 2, c.z - 6, '#5b6b3a');
      j.target = { x: c.x, z: c.z };
      this.api.banner('🪖 MISSION 2', 'Ab ins Schmuggler-Camp (Westwüste)');
    } else if (n === 2) {
      // the jeep waits on the Westring next to the settlement
      const r = ROADS.find((q) => q.name === 'Westring');
      let bi = 0, bd = 1e9;
      r.samples.forEach((q, i) => { const d = Math.hypot(q.x - POI.village.x, q.z - POI.village.z); if (d < bd) { bd = d; bi = i; } });
      const S = r.samples[bi];
      const v = new Vehicle(this.scene, 'jeep', S.x, S.z, S.h + Math.PI, '#5b6b3a');
      v.parked = true;
      v.keep = true;
      v.health = 260;
      G.vehicles.push(v);
      j.vehs.push(v);
      j.jeep = v;
      j.road = r; j.idx = bi;
      j.target = { x: S.x, z: S.z };
      this.api.banner('🛠️ MISSION 3', 'Der Jeep mit dem Glasschneider steht an der Siedlung (Ostwüste)');
    } else if (n === 3) {
      const pl = this.plane;
      j.target = { x: pl.pos.x, z: pl.pos.z };
      // two security guards at the hangar
      j.peds.push(this.coupGuard(70, -650, radjLook()), this.coupGuard(30, -650, radjLook()));
      this.api.banner('✈️ MISSION 4', "Schnapp dir Bilal's Flugzeug am Flughafen");
    }
    this.marker.set(j.target.x, j.target.z);
    G.missionTarget = { x: j.target.x, z: j.target.z, color: '#ffd23b' };
  };

  P.coupGuard = function (x, z, look) {
    const gd = new Ped(this.scene, look, x, z, 'guard');
    gd.post = { x, z };
    gd.keep = true;
    gd.hp = 80;
    gd.shootT = rand(1.4, 2.6);
    this.G.peds.push(gd);
    return gd;
  };
  P.coupCrate = function (x, z, col) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
    m.position.set(x, groundAt(x, z) + 0.4, z);
    m.castShadow = true;
    this.scene.add(m);
    return { m, x, z };
  };

  P.coupTarget = function (x, z, col = '#ffd23b') {
    const j = this.job;
    j.target = { x, z };
    this.marker.set(x, z);
    this.G.missionTarget = { x, z, color: col };
  };

  P.coupHint = function (pp, v) {
    const j = this.job;
    if (!j || j.kind !== 'coup') return null;
    if (j.n === 4) return this.finaleHint(pp, v);
    if (j.n === 0 && j.stage === 'hack' && !v && Math.hypot(pp.x - this.coupPC.x, pp.z - this.coupPC.z) < 3) return { text: '💻 Computer hacken', run: () => this.openHack() };
    if ((j.n === 1 || j.n === 2) && j.stage === 'grab' && !v && j.crate && Math.hypot(pp.x - j.crate.x, pp.z - j.crate.z) < 3) return { text: j.n === 1 ? '📦 Waffenkiste schnappen' : '💎 Glasschneider schnappen', run: () => this.grabCrate() };
    if (j.n === 3 && !v && !this.G.flight && Math.hypot(pp.x - this.plane.pos.x, pp.z - this.plane.pos.z) < 7) return { text: '✈️ Ins Flugzeug', run: () => { j.stage = 'fly'; this.api.enterPlane(this.plane); this.coupTarget((RUNWAY.x0 + RUNWAY.x1) / 2, (RUNWAY.z0 + RUNWAY.z1) / 2, '#39c6ff'); } };
    return null;
  };

  P.grabCrate = function () {
    const j = this.job;
    j.stage = 'deliver';
    this.scene.remove(j.crate.m);
    j.crate = null;
    this.G.audio.pickup();
    const h = world.hideout;
    this.coupTarget(h.x, h.z, '#39ff88');
    this.api.toast(j.n === 1 ? '📦 Kiste geschnappt – ab ins Versteck' : '💎 Glasschneider geschnappt – ab ins Versteck');
  };

  P.updateCoup = function (dt) {
    if (this.job.n === 4) return this.updateFinale(dt);
    const j = this.job, G = this.G;
    const pp = this.api.playerPos();
    const v = G.player.inVehicle;
    const dist = (t) => Math.round(Math.hypot(pp.x - t.x, pp.z - t.z));
    const alive = () => j.peds.filter((p) => !p.dead && !p.removed).length;
    const atHideout = () => Math.hypot(pp.x - world.hideout.x, pp.z - world.hideout.z) < 12;
    const T = `${COUP[j.n].icon} MISSION ${j.n + 1}`;
    if (j.n === 0) {
      if (j.stage === 'go' || j.stage === 'fight') {
        const a = alive();
        if (j.stage === 'go' && dist(j.target) < 70) { j.stage = 'fight'; this.api.toast('🔫 Radjs Wachen haben dich gesehen!'); }
        if (a === 0) {
          j.stage = 'hack';
          this.coupTarget(this.coupPC.x, this.coupPC.z, '#39ff88');
          this.api.banner('✅ LAGERHALLE GESICHERT', 'Jetzt den Computer hacken');
        } else this.setJobHUD(T, j.stage === 'go' ? 'Fahr zu Radjs Lagerhalle' : 'Schalte Radjs Wachen aus', j.stage === 'go' ? `📍 ${dist(j.target)} m` : `Wachen übrig: ${a}/5`, false);
      } else if (j.stage === 'hack') {
        if (this.coupPCScreen) this.coupPCScreen.material.color.set(Math.sin(G.time * 6) > 0 ? '#39ff88' : '#0a3a1a');
        this.setJobHUD(T, 'Hack den Computer an der Hallentür', `📍 ${dist(this.coupPC)} m · zu Fuß EIN drücken`, false);
      }
    } else if (j.n === 1 || j.n === 2) {
      if (j.n === 2 && j.stage === 'go') {
        const jp = j.jeep;
        if (jp.removed) return this.failCoup('Der Jeep ist weg');
        this.coupTarget(jp.pos.x, jp.pos.z, '#ff4040');
        if (dist(jp.pos) < 75) {
          // spotted: the driver floors it
          let bi = 0, bd = 1e9;
          j.road.samples.forEach((q, i) => { const d = Math.hypot(q.x - jp.pos.x, q.z - jp.pos.z); if (d < bd) { bd = d; bi = i; } });
          const S = j.road.samples;
          const ahead = S[Math.min(S.length - 1, bi + 10)], back = S[Math.max(0, bi - 10)];
          const dir = Math.hypot(ahead.x - pp.x, ahead.z - pp.z) > Math.hypot(back.x - pp.x, back.z - pp.z) ? 1 : -1;
          jp.parked = false;
          jp.driver = new OutDriver(jp, j.road, bi, dir);
          jp.driver.panic = 1e9;
          j.stage = 'chase';
          this.api.banner('🚙 ER HAUT AB!', 'Ramm oder beschieß den Jeep, bis er liegen bleibt');
        } else this.setJobHUD(T, 'Fahr zur Siedlung in der Ostwüste', `📍 ${dist(jp.pos)} m`, false);
        return;
      }
      if (j.n === 2 && j.stage === 'chase') {
        const jp = j.jeep;
        const d = dist(jp.pos);
        this.coupTarget(jp.pos.x, jp.pos.z, '#ff4040');
        if (d > 420) return this.failCoup('Der Jeep ist entkommen');
        if (jp.dead || jp.health < 70) {
          jp.driver = null;
          jp.input.throttle = 0; jp.input.steer = 0; jp.input.handbrake = true;
          j.stage = 'grab';
          const f = jp.fwd;
          const cx = jp.pos.x - f.x * 3.6, cz = jp.pos.z - f.z * 3.6;
          j.crate = this.coupCrate(cx, cz, '#7a5a30');
          this.coupTarget(cx, cz, '#ffd23b');
          this.api.banner('💥 JEEP GESTOPPT', 'Schnapp dir die Kiste mit dem Glasschneider');
          return;
        }
        this.setJobHUD(T, 'Stopp den Jeep!', `🚙 Zustand ${Math.max(0, Math.round(((jp.health - 70) / 190) * 100))} % · 📍 ${d} m`, d > 250);
        return;
      }
      if (j.stage === 'go') {
        if (dist(j.target) < 80) { j.stage = 'grab'; this.coupTarget(j.crate.x, j.crate.z, '#ffd23b'); this.api.toast('🪖 Die Schmuggler sind bewaffnet!'); }
        this.setJobHUD(T, 'Fahr zum Schmuggler-Camp', `📍 ${dist(j.target)} m`, false);
      } else if (j.stage === 'grab') {
        this.setJobHUD(T, j.n === 1 ? 'Schnapp dir die Waffenkiste' : 'Schnapp dir den Glasschneider', `📍 ${dist(j.target)} m · zu Fuß EIN drücken${j.n === 1 ? ` · Schmuggler: ${alive()}` : ''}`, false);
      } else if (j.stage === 'deliver') {
        if (atHideout()) return this.completeCoup();
        this.setJobHUD(T, 'Bring die Kiste ins Versteck', `📍 ${dist(world.hideout)} m`, false);
      }
    } else if (j.n === 3) {
      const pl = this.plane;
      if (j.stage === 'go') {
        this.coupTarget(pl.pos.x, pl.pos.z, '#ffd23b');
        this.setJobHUD(T, "Steig in Bilal's Flugzeug", `📍 ${dist(pl.pos)} m`, false);
      } else if (j.stage === 'fly') {
        const R = RUNWAY;
        const onRw = pl.pos.x > R.x0 - 25 && pl.pos.x < R.x1 + 25 && pl.pos.z > R.z0 - 25 && pl.pos.z < R.z1 + 25;
        if (G.flight === pl && pl.onGround && onRw && pl.speed < 3) {
          store.set('dc3d_planeHidden', '1');
          this.api.leavePlane();
          return this.completeCoup();
        }
        if (G.flight !== pl) { j.stage = 'go'; return; }
        const hint = pl.onGround ? (pl.speed < 20 ? 'GAS geben, ab 80 km/h ▲ NASE HOCH' : '▲ NASE HOCH zum Abheben') : onRw ? 'Gas raus und sanft aufsetzen' : 'Flieg zur verlassenen Landebahn (Westwüste)';
        this.setJobHUD(T, hint, `✈️ ${pl.kmh} km/h · Höhe ${Math.round(pl.alt)} m · 📍 ${dist({ x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2 })} m`, false);
      }
    }
  };

  P.onPlaneCrash = function () {
    const j = this.job;
    if (!j || j.kind !== 'coup' || (j.n !== 3 && j.n !== 4)) return;
    this.failCoup('Flugzeug abgestürzt');
  };

  P.completeCoup = function () {
    const j = this.job, G = this.G;
    const n = j.n;
    store.set('dc3d_coup', String(n + 1));
    if (n === 1) { G.player.has[2] = true; store.set('dc3d_ak', '1'); }
    this.cleanupCoup(false);
    this.endJob(null);
    G.noPolice = false;
    this.api.banner(`✅ MISSION ${n + 1} GESCHAFFT`, n === 1 ? 'Die AK-47 gehört jetzt auch dir' : n === 3 ? 'Das Flugzeug wartet auf der Landebahn' : 'Weiter am Planungsbrett im Versteck');
  };

  P.failCoup = function (msg) {
    const j = this.job;
    if (!j || j.kind !== 'coup') return;
    this.cleanupCoup(true);
    this.endJob(`❌ ${msg} – nochmal am Planungsbrett im Versteck`);
    this.G.noPolice = false;
  };

  P.cleanupCoup = function (failed) {
    const j = this.job, G = this.G;
    if (!j) return;
    for (const p of j.peds) { p.keep = false; if (failed && !p.removed) p.remove(); }
    for (const v of j.vehs) { v.keep = false; if (failed && !v.removed && G.player.inVehicle !== v) v.remove(); }
    if (j.crate) this.scene.remove(j.crate.m);
    if (j.n === 4) this.cleanupFinale();
    if (j.n === 3 && failed) {
      // a new plane appears back at Bilal's runway
      if (G.flight === this.plane) this.api.leavePlane();
      this.plane.remove();
      this.plane = new Plane(this.scene, 44, -676, Math.PI / 2);
    }
  };

  // ---------- hack minigame (Simon-style) ----------
  P.openHack = function () {
    this.G.paused = true;
    this.hack = { round: 0, seq: [], input: [], busy: false };
    const grid = $('hackGrid');
    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('button');
      b.className = 'hk';
      b.textContent = '0123456789ABCDEF'[(i * 7 + 3) % 16] + '0123456789ABCDEF'[(i * 5 + 11) % 16];
      b.addEventListener('click', () => this.hackPress(i));
      grid.appendChild(b);
    }
    $('hack').classList.add('show');
    this.hackRound();
  };
  P.hackRound = function () {
    const h = this.hack;
    const len = [4, 5, 6][h.round];
    h.seq = Array.from({ length: len }, () => Math.floor(Math.random() * 9));
    h.input = [];
    h.busy = true;
    $('hackMsg').textContent = `Firewall ${h.round + 1}/3 – merk dir die Reihenfolge…`;
    $('hackBar').style.width = `${(h.round / 3) * 100}%`;
    const btns = [...$('hackGrid').children];
    h.seq.forEach((k, i) => {
      setTimeout(() => { btns[k].classList.add('lit'); this.G.audio.tone(0.12, 500 + k * 90, 500 + k * 90, 0.18, 'square'); }, 700 + i * 620);
      setTimeout(() => btns[k].classList.remove('lit'), 700 + i * 620 + 400);
    });
    setTimeout(() => { h.busy = false; $('hackMsg').textContent = 'Jetzt du: tippe die Felder in derselben Reihenfolge'; }, 700 + h.seq.length * 620);
  };
  P.hackPress = function (i) {
    const h = this.hack;
    if (!h || h.busy) return;
    const btns = [...$('hackGrid').children];
    btns[i].classList.add('lit');
    setTimeout(() => btns[i].classList.remove('lit'), 180);
    this.G.audio.tone(0.12, 500 + i * 90, 500 + i * 90, 0.12, 'square');
    if (h.seq[h.input.length] !== i) {
      h.busy = true;
      $('hackMsg').textContent = '⛔ Zugriff verweigert – nochmal!';
      this.G.audio.hurt();
      setTimeout(() => this.hackRound(), 1100);
      return;
    }
    h.input.push(i);
    if (h.input.length === h.seq.length) {
      h.round++;
      h.busy = true;
      if (h.round >= 3) {
        $('hackMsg').textContent = '✅ Zugriff! Plan wird heruntergeladen…';
        $('hackBar').style.width = '100%';
        this.G.audio.pickup();
        setTimeout(() => { $('hack').classList.remove('show'); this.G.paused = false; this.hack = null; this.completeCoup(); }, 1600);
      } else {
        $('hackMsg').textContent = '✅ Firewall geknackt';
        setTimeout(() => this.hackRound(), 900);
      }
    }
  };
  P.closeHack = function () { $('hack').classList.remove('show'); this.G.paused = false; this.hack = null; };
}

// ======================= FINALE (Etappe 2) =======================
const sentryLook = () => ({ skin: '#e0ac85', hair: '#222', shirt: '#151515', pants: '#101010', shoes: '#111', hairStyle: 0, cap: '#101010', cop: true });
let coneGeo = null;
function makeCone(scene) {
  if (!coneGeo) {
    coneGeo = new THREE.ConeGeometry(Math.tan(0.5) * 14, 14, 24, 1, true);
    coneGeo.translate(0, -7, 0);
    coneGeo.rotateX(-Math.PI / 2); // apex at the origin, opening towards +z
  }
  const m = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  scene.add(m);
  return m;
}
class ChaseDriver {
  constructor(veh) { this.veh = veh; this.rev = 0; this.stuck = 0; }
  update(dt, G) {
    const v = this.veh, t = G.player.inVehicle ? G.player.inVehicle.pos : G.player.pos;
    const f = v.fwd, dx = t.x - v.pos.x, dz = t.z - v.pos.z;
    const ang = Math.atan2(dx * -f.z + dz * f.x, dx * f.x + dz * f.z);
    if (this.rev > 0) { this.rev -= dt; v.input.throttle = -0.8; v.input.steer = -Math.sign(ang); v.input.handbrake = false; return; }
    v.input.steer = Math.max(-1, Math.min(1, ang * 2.2));
    const want = Math.hypot(dx, dz) < 6 ? 6 : 21;
    v.input.throttle = Math.max(-1, Math.min(1, (want - v.vF) * 0.4));
    v.input.handbrake = false;
    if (Math.abs(v.vF) < 0.8) this.stuck += dt; else this.stuck = 0;
    if (this.stuck > 1.6) { this.stuck = 0; this.rev = 1.2; }
  }
}

export function installFinale(Missions) {
  const P = Missions.prototype;
  P.beginFinale = function () {
    const G = this.G;
    G.noPolice = true;
    this.api.setStars(0);
    G.player.armor = 0;
    G.noVest = true;
    // the plane always waits on the desert runway
    if (this.plane.removed || Math.hypot(this.plane.pos.x - (RUNWAY.x0 + 40), this.plane.pos.z - (RUNWAY.z0 + RUNWAY.z1) / 2) > 2) {
      this.plane.remove();
      this.plane = new Plane(this.scene, RUNWAY.x0 + 40, (RUNWAY.z0 + RUNWAY.z1) / 2, Math.PI / 2);
    }
    this.job = { kind: 'coup', n: 4, stage: 'rs6', peds: [], vehs: [], sentries: [], t0: G.time, takedowns: 0 };
    this.coupTarget(RUNWAY.x0 + 20, (RUNWAY.z0 + RUNWAY.z1) / 2, '#ffd23b');
    this.api.banner('👑 DAS FINALE', 'Mit einem Auto zur Landebahn (Westwüste)');
  };

  P.spawnIsland = function () {
    const j = this.job, G = this.G, I = this.isl;
    // Radj's jeep at the airstrip + the rally bike in the courtyard
    const jp = new Vehicle(this.scene, 'jeep', ISL.strip.x1 - 4, ISL.strip.z1 + 8, Math.PI / 2, '#111111');
    jp.parked = true; jp.keep = true;
    const bk = new Vehicle(this.scene, 'bike', -6, -1296, Math.PI, '#e74c3c');
    bk.parked = true; bk.keep = true;
    G.vehicles.push(jp, bk);
    j.vehs.push(jp, bk);
    for (const c of I.garageCars || []) { const v = new Vehicle(this.scene, c.type, c.x, c.z, c.h, c.color); v.parked = true; v.keep = true; G.vehicles.push(v); j.vehs.push(v); }
    // gate guard walks along the wall in front of the gate
    const mk = (route, gate) => {
      const [a, b] = route;
      const p = new Ped(this.scene, sentryLook(), a[0], a[1], 'guard');
      p.keep = true; p.calm = true; p.walkMul = 0.42; p.hp = 60; p.hp0 = 60;
      p.route = route; p.leg = 1; p.post = { x: b[0], z: b[1] };
      p.lookYaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      p.seen = 0; p.gate = !!gate;
      p.cone = makeCone(this.scene);
      G.peds.push(p);
      j.peds.push(p);
      j.sentries.push(p);
      return p;
    };
    j.gateGuard = mk([[ISL.gate.x - 14, ISL.gate.z + 5], [ISL.gate.x + 14, ISL.gate.z + 5]], true);
    for (const r of I.sentryPosts) mk(r);
    // one of them carries the lift card (gold badge)
    const holder = j.sentries[1 + Math.floor(Math.random() * (j.sentries.length - 1))];
    holder.card = true;
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: '#ffd700', toneMapped: false }));
    badge.position.set(0.18, 1.0, 0.17);
    holder.h.root.add(badge);
    j.holder = holder;
    j.alarm = false;
  };

  P.cleanupFinale = function () {
    const j = this.job, G = this.G, I = this.isl;
    for (const s of j.sentries || []) if (s.cone) { this.scene.remove(s.cone); s.cone = null; }
    for (const c of j.cards || []) this.scene.remove(c.m);
    G.walkMul = 0; G.silenced = false; G.noVest = false;
    $('vign').style.boxShadow = '';
    // reset the estate for the next attempt
    I.gateCol.off = false; I.gateMesh.visible = true;
    I.westGateCol.off = false; I.westGateMesh.visible = true;
    I.glass.visible = true; I.prize.visible = true;
    if (G.flight === this.plane) this.api.leavePlane();
    this.plane.remove();
    this.plane = new Plane(this.scene, RUNWAY.x0 + 40, (RUNWAY.z0 + RUNWAY.z1) / 2, Math.PI / 2);
  };

  P.dropCard = function (x, z, kind) {
    const j = this.job;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.4), new THREE.MeshBasicMaterial({ color: kind === 'gate' ? '#39c6ff' : '#ffd700', toneMapped: false }));
    m.position.set(x, groundAt(x, z) + 0.6, z);
    this.scene.add(m);
    (j.cards = j.cards || []).push({ m, x, z, kind });
  };

  P.raiseAlarm = function (why) {
    const j = this.job;
    if (j.alarm) return;
    j.alarm = true;
    for (const s of j.sentries) { if (!s.dead) { s.calm = false; s.post = { x: s.pos.x, z: s.pos.z }; s.walkMul = 1; } if (s.cone) s.cone.material.color.set('#ff3030'); }
    this.G.audio.star();
    this.api.banner('🚨 ALARM!', why || 'Radjs Wachen haben dich entdeckt');
  };

  P.finaleHint = function (pp, v) {
    const j = this.job, G = this.G, I = this.isl;
    if (j.stage === 'plane' && !v && !G.flight && Math.hypot(pp.x - this.plane.pos.x, pp.z - this.plane.pos.z) < 7)
      return { text: '✈️ Ins Flugzeug', run: () => { j.stage = 'fly'; this.api.enterPlane(this.plane); this.coupTarget((ISL.strip.x0 + ISL.strip.x1) / 2, (ISL.strip.z0 + ISL.strip.z1) / 2, '#39c6ff'); } };
    if (v) {
      if (j.stage === 'escape' && Math.hypot(pp.x - ISL.helipad.x, pp.z - ISL.helipad.z) < 14) return { text: '🚁 In den Helikopter', run: () => this.winFinale() };
      return null;
    }
    // silent takedown from behind
    if (!j.alarm && j.sentries) {
      for (const s of j.sentries) {
        if (s.dead || !s.calm) continue;
        const dx = pp.x - s.pos.x, dz = pp.z - s.pos.z, d = Math.hypot(dx, dz);
        if (d > 2.1) continue;
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        if ((dx * fx + dz * fz) / d < -0.2) return { text: '🔪 Lautlos ausschalten', run: () => { s.hit(999, G, fx, fz, true); j.takedowns++; G.audio.tone(0.15, 200, 80, 0.12, 'sine'); } };
      }
    }
    if (j.stage === 'gate' && j.hasGate && Math.hypot(pp.x - ISL.gate.x, pp.z - ISL.gate.z) < 7) return { text: '🔓 Tor öffnen (Torkarte)', run: () => { I.gateCol.off = true; I.gateMesh.visible = false; j.stage = 'estate'; G.audio.pickup(); this.api.banner('🔓 TOR OFFEN', 'Finde die Wache mit der Aufzugkarte (gold)'); } };
    if (j.stage === 'lift' && Math.hypot(pp.x - ISL.lift.x, pp.z - (ISL.lift.z + 1)) < 3.5) return { text: '▼ Aufzug in den Keller', run: () => this.rideLift(true) };
    if (j.stage === 'cellar' && Math.hypot(pp.x - ISL.glass.x, pp.z - ISL.glass.z) < 3) {
      if (!j.drilled) return { text: '💎 Glas aufschneiden', run: () => this.openCutter() };
      return { text: '👑 Goldene Bubensahne nehmen', run: () => this.takePrize() };
    }
    if (j.stage === 'up' && Math.hypot(pp.x - ISL.cellarLift.x, pp.z - ISL.cellarLift.z) < 4) return { text: '▲ Aufzug nach oben', run: () => this.rideLift(false) };
    if (j.stage === 'escape' && Math.hypot(pp.x - ISL.helipad.x, pp.z - ISL.helipad.z) < 8) return { text: '🚁 In den Helikopter', run: () => this.winFinale() };
    return null;
  };

  P.rideLift = function (down) {
    const G = this.G, el = $('film');
    G.paused = true;
    $('filmT').textContent = down ? 'AUFZUG ▼' : 'AUFZUG ▲';
    $('filmIco').textContent = '🛗';
    $('filmTxt').textContent = down ? 'Es geht in Radjs geheimen Keller…' : 'Zurück nach oben – gleich wird es laut!';
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      G.paused = false;
      const j = this.job;
      if (!j) return;
      if (down) {
        const p = ISL.cellarLift;
        G.player.pos.set(p.x, RADJ_CELLAR.y, p.z - 3);
        j.stage = 'cellar';
        this.coupTarget(ISL.glass.x, ISL.glass.z, '#ffd700');
      } else {
        G.player.pos.set(ISL.lift.x, this.isl.estateY + 0.1, ISL.lift.z + 3);
        this.startEscape();
      }
    }, 1800);
  };

  P.takePrize = function () {
    const j = this.job;
    this.isl.prize.visible = false;
    j.stage = 'up';
    j.prize = true;
    this.G.audio.pickup();
    this.coupTarget(ISL.cellarLift.x, ISL.cellarLift.z, '#ff3030');
    this.api.banner('👑 GOLDENE BUBENSAHNE!', 'Stiller Alarm ausgelöst – schnell zum Aufzug!');
  };

  P.startEscape = function () {
    const j = this.job, G = this.G, I = this.isl;
    j.stage = 'escape';
    G.walkMul = 0;
    this.raiseAlarm('Radj weiß Bescheid – ab zum Helikopter!');
    I.westGateCol.off = true; I.westGateMesh.visible = false;
    // two jeeps full of Radj's men come after you
    for (const [x, z] of [[-60, -1300], [-80, -1380]]) {
      const v = new Vehicle(this.scene, 'jeep', x, z, Math.PI / 2, '#111111');
      v.keep = true;
      v.driver = new ChaseDriver(v);
      G.vehicles.push(v);
      j.vehs.push(v);
    }
    for (const [x, z] of [[-110, -1320], [-150, -1345], [-176, -1318]]) j.peds.push(this.coupGuard(x, z, sentryLook()));
    this.coupTarget(ISL.helipad.x, ISL.helipad.z, '#39ff88');
  };

  P.winFinale = function () {
    const j = this.job, G = this.G;
    const secs = Math.round(G.time - j.t0);
    const dead = j.sentries.filter((s) => s.dead).length;
    G.audio.pickup();
    store.set('dc3d_coupWeek', weekId());
    this.api.addMoney(150000);
    if (G.player.inVehicle) { const v = G.player.inVehicle; v.driver = null; G.player.inVehicle = null; }
    this.cleanupCoup(false);
    this.endJob(null);
    G.noPolice = false;
    // back home to the Versteck
    const h = world.hideout;
    G.player.pos.set(h.x, 0.2, h.z);
    G.player.h.root.visible = true;
    this.api.refreshControls && this.api.refreshControls();
    $('winStats').innerHTML = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} Min · 🔪 ${j.takedowns} lautlos · 💀 ${dead} Wachen<br>${j.alarm ? '🚨 Mit Alarm' : '🤫 Ohne Alarm – Profi!'}`;
    $('win').classList.add('show');
    G.paused = true;
  };

  P.updateFinale = function (dt) {
    const j = this.job, G = this.G, I = this.isl;
    const pp = this.api.playerPos();
    const v = G.player.inVehicle;
    const dist = (t) => Math.round(Math.hypot(pp.x - t.x, pp.z - t.z));
    const T = '👑 FINALE';
    G.player.weapon = 1; // silenced pistol only
    G.silenced = true;
    I.rotor.rotation.y += dt * (j.stage === 'escape' ? 16 : 0);
    for (const [k, t] of (I.towers || []).entries()) t.rotation.y = Math.sin(G.time * 0.35 + k * 2) * 1.6 + (k ? Math.PI : 0);
    if (j.stage === 'rs6') {
      const rw = { x: RUNWAY.x0 + 20, z: (RUNWAY.z0 + RUNWAY.z1) / 2 };
      // any car will do (own, bought or "borrowed")
      const ok = !!v && !v.dead;
      if (dist(rw) < 30) {
        if (ok) { j.stage = 'plane'; this.coupTarget(this.plane.pos.x, this.plane.pos.z, '#39c6ff'); this.api.toast('✈️ Steig ins Flugzeug'); }
        else this.setJobHUD(T, 'Komm mit einem Auto her!', 'Schnapp dir irgendein Auto', true);
        return;
      }
      this.setJobHUD(T, 'Fahr mit einem Auto zur Landebahn', `📍 ${dist(rw)} m${ok ? '' : ' · 🚗 Auto nötig'}`, !ok);
      return;
    }
    if (j.stage === 'plane') { this.setJobHUD(T, 'Steig ins Flugzeug', `📍 ${dist(this.plane.pos)} m`, false); return; }
    if (j.stage === 'fly') {
      const pl = this.plane;
      if (G.flight !== pl) { j.stage = 'plane'; return; }
      if (pl.onGround && pl.speed < 3 && radjE(pl.pos.x, pl.pos.z) < 0.9) {
        this.api.leavePlane();
        j.stage = 'island';
        this.spawnIsland();
        this.coupTarget(ISL.gate.x, ISL.gate.z + 12, '#ffd23b');
        this.api.banner('🏝️ RADJ-INSEL', 'Folge dem Weg durch den Wald zum Anwesen');
        return;
      }
      const S = ISL.strip;
      const sd = dist({ x: (S.x0 + S.x1) / 2, z: (S.z0 + S.z1) / 2 });
      const hint = pl.onGround ? (pl.speed < 20 ? 'GAS geben, ab 80 km/h ▲ NASE HOCH' : '▲ NASE HOCH zum Abheben') : sd < 260 ? 'Gas raus und auf der Piste aufsetzen' : 'Flieg nach Süden zur Radj-Insel';
      this.setJobHUD(T, hint, `✈️ ${pl.kmh} km/h · Höhe ${Math.round(pl.alt)} m · 📍 ${sd} m`, false);
      return;
    }
    // ---- on the island ----
    if (G.flight || G.player.dead) return;
    const E = ISL.estate;
    const inEstate = pp.x > E.x0 && pp.x < E.x1 && pp.z > E.z0 && pp.z < E.z1 + 2;
    G.walkMul = 0; // normal walking/running speed in the estate too
    // sentries: patrol, flashlight cones, detection
    let watched = 0;
    for (const s of j.sentries) {
      if (s.dead || s.removed) {
        if (s.cone) { this.scene.remove(s.cone); s.cone = null; }
        if (s.dead && !s.dropped) {
          s.dropped = true;
          if (s.gate) this.dropCard(s.pos.x, s.pos.z, 'gate');
          if (s.card) this.dropCard(s.pos.x, s.pos.z, 'lift');
        }
        continue;
      }
      if (s.cone) {
        s.cone.position.set(s.pos.x, s.pos.y + 1.55, s.pos.z);
        s.cone.rotation.set(0.12, s.yaw, 0);
        if (!j.alarm) s.cone.material.opacity = 0.12 + s.seen * 0.22;
      }
      if (!s.calm) continue;
      // hit but not dead → alarm
      if (s.hp < s.hp0) { this.raiseAlarm('Eine Wache wurde angeschossen!'); continue; }
      // patrol between the two route points, look around at the ends
      const tgt = s.route[s.leg];
      if (Math.hypot(s.pos.x - tgt[0], s.pos.z - tgt[1]) < 0.9) {
        s.waitT = (s.waitT || 0) + dt;
        s.lookYaw = Math.atan2(tgt[0] - s.route[1 - s.leg][0], tgt[1] - s.route[1 - s.leg][1]) + Math.sin(G.time * 0.9 + s.id) * 1.1;
        if (s.waitT > 3.5) { s.waitT = 0; s.leg = 1 - s.leg; const n2 = s.route[s.leg]; s.post = { x: n2[0], z: n2[1] }; }
      }
      // can he see you?
      const dx = pp.x - s.pos.x, dz = pp.z - s.pos.z, d = Math.hypot(dx, dz);
      const range = v ? 24 : 14;
      if (d < range && G.lastShot && G.time - G.lastShot.t < 0.1 && d < 7) { this.raiseAlarm('Ein Schuss wurde gehört!'); continue; }
      let see = false;
      if (d < range) {
        const a = Math.acos(Math.max(-1, Math.min(1, (dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)) / (d || 1))));
        see = (a < 0.5 || d < 2.2) && !G.rayBlocked(s.pos.x, s.pos.y + 1.6, s.pos.z, pp.x, pp.y + 1.2, pp.z);
      }
      if (see) { s.seen += dt * (1.6 - d / range); watched = Math.max(watched, s.seen); } else s.seen = Math.max(0, s.seen - dt * 0.6);
      if (s.seen > 0.9) this.raiseAlarm('Eine Wache hat dich im Lichtkegel gesehen!');
    }
    $('vign').style.boxShadow = watched > 0.05 && !j.alarm ? `inset 0 0 ${60 + watched * 120}px rgba(255,200,0,${Math.min(0.7, watched)})` : '';
    // cards on the ground
    for (const c of j.cards || []) {
      if (c.taken) continue;
      c.m.rotation.y += dt * 3;
      if (Math.hypot(pp.x - c.x, pp.z - c.z) < 1.8 && !v) {
        c.taken = true;
        this.scene.remove(c.m);
        G.audio.pickup();
        if (c.kind === 'gate') { j.hasGate = true; this.api.toast('💳 Torkarte genommen'); }
        else { j.hasLift = true; this.api.toast('💳 Aufzugkarte genommen – ab zum Aufzug!'); }
      }
    }
    if (j.stage === 'island' || j.stage === 'gate') {
      if (j.stage === 'island' && dist(ISL.gate) < 60) j.stage = 'gate';
      const gg = j.gateGuard;
      if (j.hasGate) this.coupTarget(ISL.gate.x, ISL.gate.z + 4, '#39c6ff');
      else if (!gg.dead && j.stage === 'gate') this.coupTarget(gg.pos.x, gg.pos.z, '#ff4040');
      else if (gg.dead) { const c = (j.cards || []).find((q) => q.kind === 'gate' && !q.taken); if (c) this.coupTarget(c.x, c.z, '#39c6ff'); }
      const line = j.hasGate ? 'Öffne das Tor mit der Torkarte' : gg.dead ? 'Nimm die Torkarte' : j.stage === 'gate' ? 'Schalte die Torwache lautlos aus (von hinten)' : 'Folge dem Weg zum Anwesen';
      this.setJobHUD(T, line, j.stage === 'island' ? `📍 ${dist(ISL.gate)} m` : '🔦 Bleib aus dem Lichtkegel', false);
      return;
    }
    if (j.stage === 'estate') {
      const h = j.holder;
      if (j.hasLift) { j.stage = 'lift'; this.coupTarget(ISL.lift.x, ISL.lift.z + 2, '#ffd700'); return; }
      if (!h.dead) this.coupTarget(h.pos.x, h.pos.z, '#ffd700');
      else { const c = (j.cards || []).find((q) => q.kind === 'lift' && !q.taken); if (c) this.coupTarget(c.x, c.z, '#ffd700'); }
      this.setJobHUD(T, h.dead ? 'Nimm die Aufzugkarte' : 'Schalte die Wache mit der goldenen Karte aus', j.alarm ? '🚨 ALARM – sie schießen!' : `🔦 Wachen: ${j.sentries.filter((q) => !q.dead).length} · schleichen`, j.alarm);
      return;
    }
    if (j.stage === 'lift') { this.setJobHUD(T, 'Zum Aufzug am Haupthaus', `📍 ${dist(ISL.lift)} m`, j.alarm); return; }
    if (j.stage === 'cellar') {
      this.setJobHUD(T, j.drilled ? 'Nimm die goldene Bubensahne' : 'Schneid den Glaskasten auf', j.drilled ? 'EIN am Glaskasten' : `💎 EIN am Glaskasten · Fehlversuche ${j.cutFails || 0}/3`, false);
      return;
    }
    if (j.stage === 'up') { this.setJobHUD(T, 'Schnell zurück zum Aufzug!', '👑 Bubensahne dabei', true); return; }
    if (j.stage === 'escape') {
      this.setJobHUD(T, 'Flieh zum Helikopter!', `🚁 ${dist(ISL.helipad)} m · Westtor ist offen`, true);
    }
  };
}

// ======================= GLASSCHNEIDER-Minispiel =======================
export function installCutter(Missions) {
  const P = Missions.prototype;
  P.openCutter = function () {
    const G = this.G, j = this.job;
    G.paused = true;
    $('cutter').classList.add('show');
    const cv = $('cutCv');
    const S = Math.min(300, Math.round(window.innerHeight * 0.58));
    cv.width = cv.height = S * 2;
    cv.style.width = cv.style.height = S + 'px';
    const ctx = cv.getContext('2d');
    const R = S * 0.36 * 2, C = S, tol = S * 0.075 * 2;
    const st = { on: false, prog: 0, last: null, path: [], cracks: [], done: false };
    this.cut = st;
    const draw = () => {
      ctx.clearRect(0, 0, S * 2, S * 2);
      // glass pane
      const gr = ctx.createLinearGradient(0, 0, S * 2, S * 2);
      gr.addColorStop(0, 'rgba(170,220,255,0.30)'); gr.addColorStop(1, 'rgba(120,180,230,0.16)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, S * 2, S * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, S * 2 - 6, S * 2 - 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(S * 0.2, S * 0.3); ctx.lineTo(S * 0.6, S * 0.1); ctx.stroke();
      // the golden prize behind the glass
      ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.ellipse(C, C + 20, 34, 70, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(C - 12, C - 90, 24, 60);
      // tolerance band + dashed guide
      ctx.strokeStyle = 'rgba(57,255,136,0.12)'; ctx.lineWidth = tol * 2;
      ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([18, 14]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      // start mark
      ctx.fillStyle = '#39ff88'; ctx.beginPath(); ctx.arc(C, C - R, 14, 0, Math.PI * 2); ctx.fill();
      // cut line
      if (st.path.length > 1) {
        ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 6; ctx.shadowColor = '#9ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); st.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.shadowBlur = 0;
      }
      for (const c of st.cracks) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
      $('cutBar').style.width = `${Math.min(100, (Math.abs(st.prog) / (Math.PI * 2)) * 100)}%`;
    };
    const posOf = (e) => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * 2, (t.clientY - r.top) * 2]; };
    const crack = (x, y) => {
      const c = [[x, y]];
      let a = Math.random() * 6.28;
      for (let k = 0; k < 6; k++) { a += (Math.random() - 0.5) * 1.4; const [px, py] = c[c.length - 1]; c.push([px + Math.cos(a) * 30, py + Math.sin(a) * 30]); }
      st.cracks.push(c);
    };
    const fail = (x, y) => {
      st.on = false; st.prog = 0; st.path = [];
      crack(x, y);
      j.cutFails = (j.cutFails || 0) + 1;
      G.audio.tone(0.25, 1800, 500, 0.25, 'sawtooth');
      if (j.cutFails >= 3 && !j.alarm) { $('cutMsg').textContent = '🚨 Zu viele Risse – der Alarm ist losgegangen! Weiter schneiden!'; this.raiseAlarm('Das Glas hat Alarm ausgelöst!'); }
      else $('cutMsg').textContent = `💥 Riss im Glas! Zu ungenau – nochmal (${j.cutFails}/3)`;
      draw();
    };
    const down = (e) => {
      e.preventDefault();
      if (st.done) return;
      const [x, y] = posOf(e);
      if (Math.hypot(x - C, y - (C - R)) > tol * 1.6) { $('cutMsg').textContent = 'Fang am grünen Punkt oben an'; return; }
      st.on = true; st.prog = 0; st.last = Math.atan2(y - C, x - C); st.path = [[x, y]];
      $('cutMsg').textContent = 'Langsam und sauber im Kreis ziehen…';
    };
    const move = (e) => {
      if (!st.on) return;
      e.preventDefault();
      const [x, y] = posOf(e);
      if (Math.abs(Math.hypot(x - C, y - C) - R) > tol) return fail(x, y);
      const a = Math.atan2(y - C, x - C);
      let da = a - st.last;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > 0.6) return fail(x, y); // too fast / jumped
      st.prog += da; st.last = a;
      st.path.push([x, y]);
      if ((G._cutS = (G._cutS || 0) - 1) < 0) { G._cutS = 4; G.audio.tone(0.05, 2400 + Math.random() * 600, 2200, 0.05, 'square'); }
      if (Math.abs(st.prog) >= Math.PI * 2 - 0.05) {
        st.on = false; st.done = true;
        $('cutMsg').textContent = '✅ Sauber geschnitten! Die Scheibe ist raus.';
        G.audio.pickup();
        setTimeout(() => this.closeCutter(true), 1100);
      }
      draw();
    };
    const up = () => { if (st.on && !st.done) { st.on = false; st.prog = 0; st.path = []; $('cutMsg').textContent = 'Losgelassen – fang nochmal am grünen Punkt an'; draw(); } };
    cv.ontouchstart = down; cv.ontouchmove = move; cv.ontouchend = up;
    cv.onmousedown = down; cv.onmousemove = move; cv.onmouseup = up; cv.onmouseleave = up;
    $('cutMsg').textContent = 'Setz den Glasschneider am grünen Punkt an und zieh einmal ganz herum';
    draw();
  };
  P.closeCutter = function (ok) {
    $('cutter').classList.remove('show');
    this.G.paused = false;
    const j = this.job;
    if (ok && j) { j.drilled = true; this.isl.glass.visible = false; this.api.toast('💎 Glas offen – nimm die Bubensahne!'); }
  };
}
