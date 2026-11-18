// Online-Poker (Texas Hold'em, Fixed Limit) – der Server mischt und verteilt, damit niemand schummeln kann.
// Tische nach Größe (Big Blind): 100 / 250 / 500 / 1.000 / 2.500 / 5.000, je 2–6 Spieler, nur echte Spieler.
// Man setzt sich mit einem Stapel (Bits aus dem Casino) hin; mitspielen darf, wer mind. 24 Big Blinds hat –
// das ist der höchste Betrag, den eine Fixed-Limit-Hand kosten kann (4 Einsätze × 1+1+2+2) → nie „all-in“.
// Nachrichten (Client → Server):  {t:'pk', a:'list'} · {t:'pk', a:'sit', st, stack, name} · {t:'pk', a:'act', k:'fold'|'call'|'raise'} · {t:'pk', a:'leave'}
// Server → Client: pkl (Tischliste) · pks (Tischzustand, eigene Karten offen) · pkr (Ergebnis einer Hand für dich) · pkbye (Stapel zurück)

const STAKES = [100, 250, 500, 1000, 2500, 5000];
const NEED = 24, CAP = 4, MAXS = 6, TURN_MS = 20000, PAUSE_MS = 3500;
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const HN = ['Höchste Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush', 'Royal Flush'];

const val = (c) => (c.r === 'A' ? 14 : c.r === 'K' ? 13 : c.r === 'Q' ? 12 : c.r === 'J' ? 11 : +c.r);
function deck() {
  const a = [];
  for (const s of SUITS) for (const r of RANKS) a.push({ r, s });
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// same evaluation as in the casino (pkEval): [category, tie-breakers…]
export function evalHand(cs) {
  const v = cs.map(val), cnt = {}, su = {};
  cs.forEach((c, i) => { cnt[v[i]] = (cnt[v[i]] || 0) + 1; (su[c.s] = su[c.s] || []).push(v[i]); });
  const str = (vals) => { const u = [...new Set(vals)].sort((a, b) => b - a); if (u[0] === 14) u.push(1); for (let i = 0; i + 4 < u.length; i++) if (u[i] - u[i + 4] === 4) return u[i]; return 0; };
  for (const s in su) if (su[s].length >= 5) { const sf = str(su[s]); if (sf) return [sf === 14 ? 9 : 8, sf]; }
  const g = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  if (cnt[g[0]] === 4) return [7, g[0], Math.max(...v.filter((x) => x !== g[0]))];
  if (cnt[g[0]] === 3 && g.length > 1 && cnt[g[1]] >= 2) return [6, g[0], g[1]];
  for (const s in su) if (su[s].length >= 5) return [5, ...su[s].sort((a, b) => b - a).slice(0, 5)];
  const st = str(v); if (st) return [4, st];
  if (cnt[g[0]] === 3) return [3, g[0], ...v.filter((x) => x !== g[0]).sort((a, b) => b - a).slice(0, 2)];
  if (cnt[g[0]] === 2 && cnt[g[1]] === 2) { const hp = g[0], lp = g[1]; return [2, hp, lp, Math.max(...v.filter((x) => x !== hp && x !== lp))]; }
  if (cnt[g[0]] === 2) return [1, g[0], ...v.filter((x) => x !== g[0]).sort((a, b) => b - a).slice(0, 3)];
  return [0, ...v.sort((a, b) => b - a).slice(0, 5)];
}
export function cmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y; } return 0; }

const TABLES = new Map(STAKES.map((st) => [st, { st, seats: [], hand: null, dl: -1, timer: null, next: null, msg: 'Warte auf Spieler …', last: null }]));
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export function tableList() { return STAKES.map((st) => ({ st, n: TABLES.get(st).seats.length, max: MAXS })); }

function stateFor(T, p) {
  const H = T.hand;
  return {
    t: 'pks', st: T.st, msg: T.msg, you: T.seats.indexOf(p),
    seats: T.seats.map((s) => {
      const inH = H && H.ids.includes(s.id);
      const show = H && (s === p || (H.over && H.shown.includes(s.id)));
      return { name: s.name, stack: s.stack, inH, f: !!s.f, r: s.r || 0, a: s.a || '', h: inH ? (show ? s.h : [null, null]) : null, dl: H && T.seats[T.dl] === s };
    }),
    board: H ? H.board : [], pot: H ? H.pot : 0, cur: H ? H.cur : 0, nb: H ? H.nb : 0, stage: H ? H.stage : -1,
    turn: H && !H.over ? T.seats.indexOf(H.turnP) : -1, left: H && H.deadline ? Math.max(0, H.deadline - Date.now()) : 0,
    over: !H || H.over, res: H && H.over ? H.res : null, bet: H ? (H.stage >= 2 ? T.st * 2 : T.st) : T.st,
  };
}
function push(T) { for (const s of T.seats) send(s.ws, stateFor(T, s)); }

function inHand(T) { return T.hand ? T.seats.filter((s) => T.hand.ids.includes(s.id)) : []; }
function alive(T) { return inHand(T).filter((s) => !s.f); }

function schedule(T, ms) {
  clearTimeout(T.next);
  T.next = setTimeout(() => startHand(T), ms);
}
function startHand(T) {
  T.next = null;
  if (T.hand && !T.hand.over) return;
  // players who left during the last hand are gone already; those without enough chips sit out
  const ok = T.seats.filter((s) => s.stack >= T.st * NEED && !s.leaving);
  for (const s of T.seats) if (s.stack < T.st * NEED) s.a = 'zu wenig Chips';
  if (ok.length < 2) { T.hand = null; T.msg = ok.length ? 'Warte auf einen zweiten Spieler …' : 'Warte auf Spieler …'; push(T); return; }
  // dealer: next eligible seat
  let d = T.dl;
  for (let k = 1; k <= T.seats.length; k++) { const i = (d + k + T.seats.length) % T.seats.length; if (ok.includes(T.seats[i])) { d = i; break; } }
  T.dl = d;
  const order = []; // seats in the hand, starting left of the dealer
  for (let k = 1; k <= T.seats.length; k++) { const s = T.seats[(d + k) % T.seats.length]; if (ok.includes(s)) order.push(s); }
  const D = deck();
  const H = T.hand = { ids: order.map((s) => s.id), order, deck: D, board: [], pot: 0, stage: 0, cur: 0, nb: 0, acted: new Set(), over: false, shown: [], res: null, put: {} };
  for (const s of order) { s.h = [D.pop(), D.pop()]; s.f = false; s.r = 0; s.a = ''; H.put[s.id] = 0; }
  // heads-up: dealer posts the small blind
  const sb = order.length === 2 ? order[1] : order[0], bb = order.length === 2 ? order[0] : order[1];
  pay(T, sb, T.st / 2); sb.a = 'Small Blind';
  pay(T, bb, T.st); bb.a = 'Big Blind';
  H.cur = T.st; H.nb = 1;
  T.msg = `Neue Hand – Blinds ${T.st / 2} / ${T.st}`;
  H.turnP = order[(order.indexOf(bb) + 1) % order.length];
  arm(T);
  push(T);
}
function pay(T, s, a) { s.stack -= a; s.r += a; T.hand.pot += a; T.hand.put[s.id] += a; }
function arm(T) {
  const H = T.hand;
  clearTimeout(T.timer);
  H.deadline = Date.now() + TURN_MS;
  const p = H.turnP;
  T.timer = setTimeout(() => { if (T.hand === H && !H.over && H.turnP === p) act(T, p, H.cur - p.r > 0 ? 'fold' : 'call', true); }, TURN_MS);
}
function nextActor(T, from) {
  const H = T.hand, o = H.order, i0 = o.indexOf(from);
  for (let k = 1; k <= o.length; k++) { const s = o[(i0 + k) % o.length]; if (s.f) continue; if (!H.acted.has(s.id) || s.r < H.cur) return s; }
  return null;
}
export function act(T, p, k, auto) {
  const H = T.hand;
  if (!H || H.over || H.turnP !== p) return;
  const toCall = H.cur - p.r, bet = H.stage >= 2 ? T.st * 2 : T.st;
  if (k === 'raise' && H.nb >= CAP) k = 'call';
  if (k === 'fold') { p.f = true; p.a = auto ? 'Zeit um – Fold' : 'Fold'; }
  else if (k === 'call') { if (toCall > 0) { pay(T, p, toCall); p.a = 'Call ' + toCall; } else p.a = auto ? 'Zeit um – Check' : 'Check'; }
  else if (k === 'raise') { pay(T, p, toCall + bet); H.cur = p.r; H.nb++; p.a = (H.nb === 1 ? 'Bet ' : 'Raise ') + H.cur; H.acted = new Set(); }
  else return;
  H.acted.add(p.id);
  if (alive(T).length === 1) return finish(T, alive(T), null);
  const nx = nextActor(T, p);
  if (!nx) return endRound(T);
  H.turnP = nx; arm(T); push(T);
}
function endRound(T) {
  const H = T.hand;
  for (const s of H.order) s.r = 0;
  H.cur = 0; H.nb = 0; H.acted = new Set();
  if (H.stage === 3) return showdown(T);
  H.stage++;
  if (H.stage === 1) H.board.push(H.deck.pop(), H.deck.pop(), H.deck.pop()); else H.board.push(H.deck.pop());
  for (const s of H.order) if (!s.f) s.a = '';
  T.msg = ['', 'Flop', 'Turn', 'River'][H.stage];
  H.turnP = H.order.find((s) => !s.f); // first active player left of the dealer
  arm(T); push(T);
}
function showdown(T) {
  const al = alive(T), sc = al.map((s) => ({ s, v: evalHand(s.h.concat(T.hand.board)) }));
  sc.sort((a, b) => cmp(b.v, a.v));
  const top = sc[0].v;
  T.hand.shown = al.map((s) => s.id);
  finish(T, sc.filter((x) => cmp(x.v, top) === 0).map((x) => x.s), HN[top[0]]);
}
function finish(T, win, hn) {
  const H = T.hand;
  clearTimeout(T.timer);
  H.over = true; H.deadline = 0;
  const share = Math.floor(H.pot / win.length), rest = H.pot - share * win.length;
  win.forEach((s, i) => { s.stack += share + (i === 0 ? rest : 0); });
  H.res = { win: win.map((s) => T.seats.indexOf(s)), names: win.map((s) => s.name), hn, share, pot: H.pot };
  T.msg = win.map((s) => s.name).join(' & ') + (win.length > 1 ? ' teilen ' : ' gewinnt ') + H.pot + (hn ? ' mit ' + hn : '');
  for (const s of T.seats) {
    if (!H.ids.includes(s.id)) continue;
    const won = win.includes(s) ? share + (win[0] === s ? rest : 0) : 0, put = H.put[s.id] || 0;
    const v = !s.f ? evalHand(s.h.concat(H.board))[0] : -1;
    send(s.ws, { t: 'pkr', won, put, net: won - put, win: win.includes(s), top: win.includes(s) ? v : -1, stack: s.stack });
  }
  push(T);
  // players who wanted to leave during the hand get their chips now
  for (const s of [...T.seats]) if (s.leaving) removeSeat(T, s, true);
  schedule(T, PAUSE_MS);
}
function removeSeat(T, s, bye) {
  const i = T.seats.indexOf(s);
  if (i < 0) return;
  T.seats.splice(i, 1);
  if (i <= T.dl) T.dl--;
  if (bye) send(s.ws, { t: 'pkbye', stack: s.stack });
  if (s.ws) s.ws.pk = null;
  if (T.seats.length < 2 && T.hand && !T.hand.over) { /* last opponent left: the remaining player wins */ }
  push(T);
}

export function leave(ws, gone) {
  const s = ws.pk;
  if (!s) return;
  const T = TABLES.get(s.st);
  if (!T) return;
  const H = T.hand;
  if (H && !H.over && H.ids.includes(s.id) && !s.f) {
    // fold the running hand; the chips already in the pot are lost
    s.leaving = true;
    if (H.turnP === s) act(T, s, 'fold');
    else { s.f = true; s.a = 'Aufgestanden'; if (alive(T).length === 1) finish(T, alive(T), null); else push(T); }
    if (T.seats.includes(s)) removeSeat(T, s, !gone);
    return;
  }
  removeSeat(T, s, !gone);
  if (T.seats.filter((x) => x.stack >= T.st * NEED).length < 2 && (!T.hand || T.hand.over)) { T.hand = null; T.msg = 'Warte auf Spieler …'; push(T); }
}

let PID = 1;
export function onPoker(ws, m) {
  if (m.a === 'list') return send(ws, { t: 'pkl', tables: tableList() });
  if (m.a === 'sit') {
    if (ws.pk) return;
    const T = TABLES.get(+m.st);
    if (!T) return send(ws, { t: 'pkerr', m: 'Diesen Tisch gibt es nicht' });
    if (T.seats.length >= MAXS) return send(ws, { t: 'pkerr', m: `Der Tisch ist voll (${MAXS}/${MAXS})` });
    const stack = Math.floor(+m.stack || 0);
    if (!(stack >= T.st * NEED) || stack > T.st * 200) return send(ws, { t: 'pkerr', m: `Du brauchst mind. ${T.st * NEED} Bits` });
    const s = { id: 'p' + PID++, name: clean(m.name, 16) || 'Gast', ws, st: T.st, stack, h: null, f: true, r: 0, a: 'setzt sich' };
    ws.pk = s;
    T.seats.push(s);
    T.msg = `${s.name} setzt sich an den Tisch`;
    push(T);
    if (!T.hand || T.hand.over) schedule(T, T.hand ? PAUSE_MS : 1500);
    return;
  }
  if (m.a === 'act' && ws.pk) {
    const T = TABLES.get(ws.pk.st);
    if (T && ['fold', 'call', 'raise'].includes(m.k)) act(T, ws.pk, m.k);
    return;
  }
  if (m.a === 'leave') return leave(ws, false);
}
export function pokerStatus() { return Object.fromEntries(STAKES.map((st) => [st, TABLES.get(st).seats.length])); }
