// Koop-Coup: Crew-Lobby (bis zu 4 Spieler) + abgestimmtes Radj-Finale.
// Jeder spielt das Finale auf seinem eigenen Gerät; wichtige Ereignisse (Flug, Wachen ausgeschaltet,
// Karten, Tor, Alarm, Glas, Beute, Flucht) gehen über den Online-Server an die anderen der Crew.
// Beute: Anführer 100.000 (zählt als sein Wochen-Finale), jeder Helfer 37.500 (1× pro Woche).
// Alle in der Crew brauchen die Missionen 1–4.
import { store } from './util.js';
import { weekId, fmt } from './heist.js';
import { ISL } from './radj.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const COOP_PAY = { leader: 100000, helper: 37500, solo: 150000 };
export const CREW_MAX = 4;

// gleiche Zufallszahlen auf allen Geräten der Crew (z. B. welche Wache die Aufzugkarte trägt)
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function installCoop(Missions) {
  const P = Missions.prototype;

  P.online = function () { return this.G.online; };
  P.coopHooks = function () {
    const o = this.online();
    if (!o || this._coopHooked) return;
    this._coopHooked = true;
    o.hooks.crews = () => this.renderLobby();
    o.hooks.crewgo = (m) => this.onCrewGo(m);
    o.hooks.cev = (m) => this.onCrewEv(m);
    o.hooks.crewx = (m) => this.onCrewX(m);
    o.hooks.offline = () => {
      const j = this.job;
      if (j && j.coop && !j.coop.off) { j.coop.off = true; this.api.toast('🌐 Verbindung weg – du machst allein weiter'); }
    };
    $('crewL').addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (b && !b.disabled) this.lobbyAction(b.dataset.a); });
  };
  P.helperPaid = function () { return store.get('dc3d_coupHelpWeek') === weekId(); };
  P.cx = function (e) { const j = this.job; if (j && j.coop && !j.coop.off) this.online().crewEv(e); };

  // ---------- Lobby ----------
  P.openLobby = function () {
    this.coopHooks();
    $('coup').classList.remove('show');
    this.G.paused = true;
    this.lobbyOpen = true;
    $('crewL').classList.add('show');
    this.renderLobby();
  };
  P.closeLobby = function () {
    if (!this.lobbyOpen) return;
    this.lobbyOpen = false;
    $('crewL').classList.remove('show');
    this.G.paused = false;
  };
  P.renderLobby = function () {
    if (!this.lobbyOpen) return;
    const o = this.online();
    const B = (a, txt, bg, dis) => `<button class="mb" data-a="${a}" style="${bg ? 'background:' + bg + ';' : ''}${dis ? 'opacity:.45' : ''}"${dis ? ' disabled' : ''}>${txt}</button>`;
    let h = '', b = '', info = '';
    if (!o || o.state !== 'on') {
      h = '<div class="sub">Fürs Koop-Finale musst du online sein. Alle aus der Crew müssen im <b>gleichen Raum</b> sein (⏸ Menü → 🌐 Online spielen).</div>';
      b = B('close', 'Zurück') + B('online', '🌐 Online gehen', '#2e9e44');
    } else {
      const mine = o.myCrew();
      if (mine) {
        const lead = mine.leader === o.id;
        const me = mine.members.find((q) => q.id === o.id) || {};
        const all = mine.members.length >= 2 && mine.members.every((q) => q.ready);
        h += `<div class="sub">Deine Crew · ${mine.members.length}/${CREW_MAX}${mine.started ? ' · Finale läuft' : ''}</div>`;
        for (const q of mine.members) h += `<div class="mpRow"><span>${q.id === mine.leader ? '👑' : '🧑'}</span>${esc(q.name)}${q.id === o.id ? ' (du)' : ''}<small style="margin-left:auto">${q.ready ? '✅ bereit' : '⏳ wartet'}</small></div>`;
        b += B('leave', lead ? '✖ Auflösen' : '✖ Verlassen');
        if (!mine.started) b += B('ready', me.ready ? '✋ Doch nicht' : '✅ Bereit', me.ready ? '' : '#2e9e44');
        if (lead && !mine.started) b += B('start', '🚀 Finale starten', '#b8860b', !all);
        info = lead ? (all ? 'Alle bereit – starte das Finale!' : 'Warte, bis alle bereit sind (mindestens 2 Spieler).') : 'Der Anführer startet, sobald alle bereit sind.';
        info += ` Beute: Anführer ${fmt(COOP_PAY.leader)} · Helfer je ${fmt(COOP_PAY.helper)}.`;
        if (!lead && this.helperPaid()) info += ' Du hast diese Woche schon geholfen – diesmal ohne Beute.';
      } else {
        const open = o.crews.filter((c) => !c.started && c.members.length < CREW_MAX);
        if (open.length) {
          for (const c of open) {
            const L = c.members.find((q) => q.id === c.leader) || c.members[0] || { name: '?' };
            h += `<div class="mpRow"><span>👑</span>Crew von <b>${esc(L.name)}</b><small style="margin-left:6px">${c.members.length}/${CREW_MAX}</small><span style="margin-left:auto">${B('join:' + c.id, 'Beitreten', '#2e9e44')}</span></div>`;
          }
        } else h = '<div class="sub">Im Raum gibt es noch keine Crew. Gründe eine – die anderen sehen sie dann hier.</div>';
        b = B('close', 'Zurück') + B('create', '👑 Crew gründen', '#b8860b');
        info = `Beute: Anführer ${fmt(COOP_PAY.leader)} · jeder Helfer ${fmt(COOP_PAY.helper)} (1× pro Woche). Alle brauchen die Missionen 1–4.`;
      }
    }
    $('crewBody').innerHTML = h;
    $('crewInfo').textContent = info;
    $('crewBtns').innerHTML = b;
  };
  P.coopBlock = function (asLeader) {
    if (this.coupStep() < 4) return 'Erst die Missionen 1–4 am Planungsbrett schaffen';
    if (asLeader && this.finaleDone()) return 'Du hast Radj diese Woche schon ausgeraubt – als Anführer erst nächste Woche. Tritt einer Crew als Helfer bei!';
    return '';
  };
  P.lobbyAction = function (a) {
    const o = this.online();
    if (a === 'close') return this.closeLobby();
    if (a === 'online') { this.closeLobby(); o.pause(true); o.open(); return; }
    if (!o || o.state !== 'on') return this.renderLobby();
    const mine = o.myCrew();
    const lead = mine && mine.leader === o.id;
    if (a === 'create' || a.startsWith('join:')) {
      const why = this.coopBlock(a === 'create');
      if (why) return this.api.toast(why);
      if (a === 'create') o.crew('create'); else o.crew('join', { id: a.slice(5) });
    } else if (a === 'leave') o.crew('leave');
    else if (a === 'ready') {
      const me = mine && mine.members.find((q) => q.id === o.id);
      if (!me) return;
      if (!me.ready) {
        const why = this.coopBlock(lead);
        if (why) return this.api.toast(why);
        if (this.busy()) return this.api.toast('Erst den laufenden Auftrag beenden');
      }
      o.crew('ready', { v: !me.ready });
    } else if (a === 'start') o.crew('start');
  };

  // ---------- Start ----------
  P.onCrewGo = function (m) {
    const o = this.online();
    const idx = Math.max(0, m.members.findIndex((q) => q.id === o.id));
    this.closeLobby();
    $('coup').classList.remove('show');
    // a running job (taxi, delivery …) ends – the finale has priority
    if (this.job) { if (this.job.kind === 'coup') this.cleanupCoup(true); this.endJob(null); this.G.noPolice = false; }
    this.coopOut = null;
    this.coopStart = { id: m.id, role: m.leader === o.id ? 'leader' : 'helper', seed: m.seed, idx, names: m.members.map((q) => q.name) };
    this.playFilm(4, () => this.beginFinale());
  };
  P.onCrewX = function (m) {
    const j = this.job;
    if (j && j.coop && !j.coop.off) { j.coop.off = true; this.api.toast('👥 Crew aufgelöst – du machst allein weiter'); }
    else if (m && m.why && this.lobbyOpen) this.api.toast('👥 ' + m.why);
    this.renderLobby();
  };

  // everyone boards Bilal's plane together (triggered by whoever reaches it first)
  P.crewBoard = function (who) {
    const j = this.job, G = this.G;
    if (!j || j.n !== 4 || (j.stage !== 'rs6' && j.stage !== 'plane')) return;
    if (G.player.inVehicle) { const v = G.player.inVehicle; v.driver = null; v.input.throttle = 0; v.input.handbrake = true; G.player.inVehicle = null; G.player.h.root.visible = true; this.api.refreshControls && this.api.refreshControls(); }
    j.stage = 'fly';
    this.flyTo({ from: '🛫 Landebahn Westwüste', to: '🏝️ Radj-Insel', title: '👥 KOOP-FINALE · FLUG', lines: [`${who ? who + ' startet' : 'Start'} – die Crew ist an Bord…`, 'Tief über dem Meer, unter Radjs Radar…', 'Die Radj-Insel – Landung auf der Privatpiste!'], secs: 6 }, () => this.arriveIsland());
  };

  // ---------- events from the crew ----------
  P.onCrewEv = function (m) {
    const e = m.e || {}, j = this.job, G = this.G, I = this.isl, who = m.name || 'Jemand';
    if (e.k === 'left') { this.api.toast(`👥 ${who} hat die Crew verlassen`); return; }
    if (e.k === 'down') { this.api.toast(`💀 ${who} ist raus – weiter ohne ${who}!`); return; }
    if (e.k === 'win' && (!j || j.n !== 4) && this.coopOut) { const r = this.coopOut.role; this.coopOut = null; this.coopWinScreen(r, who, null); return; }
    if (!j || j.kind !== 'coup' || j.n !== 4 || !j.coop) return;
    if (e.k === 'fly') return this.crewBoard(who);
    if (e.k === 'kill') {
      const s = j.sentries && j.sentries[e.i];
      if (s && !s.dead && !s.removed) { s.remote = true; s.hit(999, G, 0, 0, false); }
      return;
    }
    if (e.k === 'card') {
      if (e.kind === 'gate') j.hasGate = true; else j.hasLift = true;
      for (const c of j.cards || []) if (c.kind === e.kind && !c.taken) { c.taken = true; this.scene.remove(c.m); }
      this.api.toast(e.kind === 'gate' ? `💳 ${who} hat die Torkarte` : `💳 ${who} hat die Aufzugkarte – ab zum Aufzug!`);
      return;
    }
    if (e.k === 'gate') {
      j.hasGate = true;
      I.gateCol.off = true; I.gateMesh.visible = false;
      if (j.stage === 'island' || j.stage === 'gate') j.stage = 'estate';
      this.api.banner('🔓 TOR OFFEN', `${who} hat das Tor geöffnet`);
      return;
    }
    if (e.k === 'alarm') return this.raiseAlarm(e.why ? `${who}: ${e.why}` : undefined, true);
    if (e.k === 'glass') { j.drilled = true; I.glass.visible = false; this.api.toast(`💎 ${who} hat das Glas aufgeschnitten`); return; }
    if (e.k === 'prize') {
      I.prize.visible = false;
      j.prize = true;
      if (j.stage === 'cellar') { j.stage = 'up'; this.coupTarget(ISL.cellarLift.x, ISL.cellarLift.z, '#ff3030'); this.api.banner('👑 BUBENSAHNE!', `${who} hat sie – schnell zum Aufzug!`); }
      else if (j.stage !== 'up' && j.stage !== 'escape' && j.stage !== 'fly') { this.api.banner('👑 BUBENSAHNE!', `${who} hat sie – ab zum Helikopter!`); this.startEscape(true); }
      return;
    }
    if (e.k === 'win') { if (j.stage !== 'fly') this.winFinale(true, who); return; }
  };

  // payout + win screen (also for crew members who died before the escape)
  P.coopPayout = function (role) {
    let pay;
    if (role === 'leader') { pay = COOP_PAY.leader; store.set('dc3d_coupWeek', weekId()); }
    else if (role === 'helper') { pay = this.helperPaid() ? 0 : COOP_PAY.helper; if (pay) store.set('dc3d_coupHelpWeek', weekId()); }
    else { pay = COOP_PAY.solo; store.set('dc3d_coupWeek', weekId()); }
    if (pay) this.api.addMoney(pay);
    $('winMoney').textContent = pay ? `+${fmt(pay)} D$` : 'Diese Woche schon geholfen – ohne Beute';
    return pay;
  };
  P.coopWinScreen = function (role, who, stats) {
    this.coopPayout(role);
    $('winStats').innerHTML = stats || `🚁 ${esc(who)} hat die Crew rausgeholt – dein Anteil ist da!`;
    $('win').classList.add('show');
    this.G.paused = true;
    this.coopLeave(true);
  };
  P.coopLeave = function (done) { const o = this.online(); if (o) o.crew(done ? 'done' : 'leave'); };
}
