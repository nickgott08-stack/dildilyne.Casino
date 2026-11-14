import * as THREE from 'three';
import { NB, roadC, RW, LANE, lightAt, lightState, world, collideCircle, groundY, groundAt, H, P, SW, BOUND } from './world.js';
import { inCity } from './outskirts.js';
import { WALL_OUT } from './geo.js';
import { clamp, rand, pick, angleWrap, dampAngle, damp, randi } from './util.js';
import { makeHuman, animateHuman, randomLook, copLook } from './human.js';

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const right = (d) => [-DIRS[d][1], DIRS[d][0]];
const nodePos = (i, j) => [roadC(i), roadC(j)];

export function nearestNode(x, z) {
  return [clamp(Math.round((x + H) / P), 0, NB), clamp(Math.round((z + H) / P), 0, NB)];
}

// lane point for traveling in dir d relative to node, s along dir
function lanePt(i, j, d, s, lane = LANE) {
  const [x, z] = nodePos(i, j);
  const [rx, rz] = right(d);
  return [x + rx * lane + DIRS[d][0] * s, z + rz * lane + DIRS[d][1] * s];
}

function validDir(i, j, d) {
  const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
  return ni >= 0 && nj >= 0 && ni <= NB && nj <= NB;
}

// ---- path following driver base ----
class PathDriver {
  constructor(veh) {
    this.veh = veh;
    this.pts = []; // [x,z,flags]
    this.idx = 0;
    this.stuck = 0;
    this.reverseT = 0;
    this.lane = LANE;
  }
  snap() {
    const v = this.veh;
    // pick nearest road line and direction along heading
    const f = v.fwd;
    let d;
    if (Math.abs(f.x) > Math.abs(f.z)) d = f.x > 0 ? 0 : 2;
    else d = f.z > 0 ? 1 : 3;
    let [i, j] = nearestNode(v.pos.x, v.pos.z);
    // node ahead along d on the same line
    if (d === 0 || d === 2) {
      j = nearestNode(v.pos.x, v.pos.z)[1];
      i = d === 0 ? Math.ceil((v.pos.x + H) / P + 0.1) : Math.floor((v.pos.x + H) / P - 0.1);
    } else {
      i = nearestNode(v.pos.x, v.pos.z)[0];
      j = d === 1 ? Math.ceil((v.pos.z + H) / P + 0.1) : Math.floor((v.pos.z + H) / P - 0.1);
    }
    i = clamp(i, 0, NB);
    j = clamp(j, 0, NB);
    if (!validDir(i - DIRS[d][0], j - DIRS[d][1], d)) {
      // turned around at the border
      d = (d + 2) % 4;
      i = clamp(i + DIRS[d][0] * 1, 0, NB);
      j = clamp(j + DIRS[d][1] * 1, 0, NB);
    }
    this.pts = [];
    this.idx = 0;
    this.to = [i, j];
    this.d = d;
    const [ex, ez] = lanePt(i, j, d, -(RW + 3), this.lane);
    this.pts.push([v.pos.x + f.x * 3, v.pos.z + f.z * 3, 0], [ex, ez, 1, i, j, d]);
  }
  chooseNext(i, j, d) {
    const opts = [];
    for (const nd of [d, (d + 1) % 4, (d + 3) % 4]) if (validDir(i, j, nd)) opts.push(nd);
    if (!opts.length) return (d + 2) % 4;
    // prefer straight a bit
    if (opts.includes(d) && Math.random() < 0.45) return d;
    return pick(opts);
  }
  extend() {
    const [i, j] = this.to;
    const d = this.d;
    const nd = this.chooseNext(i, j, d);
    const [ax, az] = lanePt(i, j, d, -(RW + 3), this.lane);
    const [bx, bz] = lanePt(i, j, nd, RW + 3, this.lane);
    if (nd === (d + 2) % 4) {
      // u-turn at border: wide arc
      const [cx, cz] = nodePos(i, j);
      for (let k = 1; k <= 6; k++) {
        const t = k / 7;
        const a = Math.PI * t;
        const [rx, rz] = right(d);
        const fx = DIRS[d][0], fz = DIRS[d][1];
        this.pts.push([cx + rx * LANE * Math.cos(a) + fx * Math.sin(a) * 4, cz + rz * LANE * Math.cos(a) + fz * Math.sin(a) * 4, 2]);
      }
    } else if (nd === d) {
      this.pts.push([(ax + bx) / 2, (az + bz) / 2, 2]);
    } else {
      // corner: control point = intersection of lanes
      let cx, cz;
      if (DIRS[d][0] !== 0) { cx = bx; cz = az; } else { cx = ax; cz = bz; }
      for (let k = 1; k <= 5; k++) {
        const t = k / 6;
        const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
        const z = (1 - t) * (1 - t) * az + 2 * (1 - t) * t * cz + t * t * bz;
        this.pts.push([x, z, 2]);
      }
    }
    this.pts.push([bx, bz, 0]);
    const ni = i + DIRS[nd][0], nj = j + DIRS[nd][1];
    const [ex, ez] = lanePt(ni, nj, nd, -(RW + 3), this.lane);
    // intermediate points on long straights
    this.pts.push([(bx + ex) / 2, (bz + ez) / 2, 0]);
    this.pts.push([ex, ez, 1, ni, nj, nd]);
    this.to = [ni, nj];
    this.d = nd;
    // drop old points
    if (this.idx > 20) {
      this.pts.splice(0, this.idx - 2);
      this.idx = 2;
    }
  }
  remaining() {
    let s = 0;
    for (let k = this.idx; k < this.pts.length - 1; k++) s += Math.hypot(this.pts[k + 1][0] - this.pts[k][0], this.pts[k + 1][1] - this.pts[k][1]);
    return s;
  }
  follow(dt, G, targetSpeed, ignoreLights) {
    const v = this.veh;
    if (!this.pts.length) this.snap();
    while (this.remaining() < 45) this.extend();
    // advance idx
    for (let k = 0; k < 3; k++) {
      if (this.idx >= this.pts.length - 1) break;
      const a = this.pts[this.idx], b = this.pts[this.idx + 1];
      const abx = b[0] - a[0], abz = b[1] - a[1];
      const t = ((v.pos.x - a[0]) * abx + (v.pos.z - a[1]) * abz) / (abx * abx + abz * abz + 1e-6);
      if (t > 1) this.idx++;
      else break;
    }
    // deviation
    const a = this.pts[this.idx];
    const b = this.pts[Math.min(this.idx + 1, this.pts.length - 1)];
    const dev = distToSeg(v.pos.x, v.pos.z, a[0], a[1], b[0], b[1]);
    if (dev > 12) { this.snap(); return; }
    // lookahead
    const look = 4 + Math.abs(v.vF) * 0.45;
    let tx = b[0], tz = b[1];
    let acc = Math.hypot(b[0] - v.pos.x, b[1] - v.pos.z);
    let curveAhead = false;
    for (let k = this.idx + 1; k < this.pts.length - 1 && acc < look; k++) {
      const p = this.pts[k], q = this.pts[k + 1];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (p[2] === 2 || q[2] === 2) curveAhead = true;
      if (acc + l >= look) {
        const t = (look - acc) / l;
        tx = p[0] + (q[0] - p[0]) * t;
        tz = p[1] + (q[1] - p[1]) * t;
        acc = look;
        break;
      }
      acc += l;
      tx = q[0];
      tz = q[1];
    }
    const f = v.fwd;
    const dx = tx - v.pos.x, dz = tz - v.pos.z;
    const lf = dx * f.x + dz * f.z;
    const lx = dx * -f.z + dz * f.x;
    const ang = Math.atan2(lx, lf);
    let steer = clamp(ang * 2.2, -1, 1);
    // check curve speed
    let want = targetSpeed;
    for (let k = this.idx; k < Math.min(this.pts.length, this.idx + 6); k++) if (this.pts[k][2] === 2) { want = Math.min(want, ignoreLights ? 14 : 7.5); break; }
    // stop at red lights
    if (!ignoreLights) {
      for (let k = this.idx; k < Math.min(this.pts.length, this.idx + 4); k++) {
        const p = this.pts[k];
        if (p[2] !== 1) continue;
        const L = lightAt(p[3], p[4]);
        if (!L) break;
        const axis = DIRS[p[5]][0] !== 0 ? 'x' : 'z';
        const st = lightState(L, axis, G.time);
        const dist = (p[0] - v.pos.x) * f.x + (p[1] - v.pos.z) * f.z;
        if (st !== 'g' && dist > -0.5 && dist < 30) {
          if (!(st === 'y' && dist < 6)) want = Math.min(want, Math.max(0, Math.sqrt(Math.max(0, 2 * 5 * (dist - 1.5)))));
        }
        break;
      }
    }
    return { steer, want };
  }
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz + 1e-6), 0, 1);
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

// obstacle in front (vehicles, peds, player)
function obstacleDist(v, G, range = 22, ignoreOncoming = false) {
  const f = v.fwd;
  let best = range;
  const halfW = v.M.wid / 2 + 0.6;
  const check = (x, z, r, y, o) => {
    const dx = x - v.pos.x, dz = z - v.pos.z;
    const lf = dx * f.x + dz * f.z;
    // outside the city: oncoming cars drive in their own lane – only stop for them right in front of the bumper
    if (ignoreOncoming && o && lf > 3.5) { const of = o.fwd; if (of.x * f.x + of.z * f.z < -0.5) return; }
    if (lf < 0 || lf > range + 5) return;
    if (Math.abs(y - v.pos.y) > 3) return;
    const lx = Math.abs(dx * -f.z + dz * f.x);
    if (lx < halfW + r) best = Math.min(best, lf - v.M.len / 2 - r);
  };
  for (const o of G.vehicles) if (o !== v && !o.removed) check(o.pos.x, o.pos.z, o.M.wid / 2 + (o.M.len / 2) * 0.5, o.pos.y, o);
  for (const p of G.peds) if (!p.dead && !p.removed) check(p.pos.x, p.pos.z, 0.4, p.pos.y);
  if (!G.player.inVehicle) check(G.player.pos.x, G.player.pos.z, 0.4, G.player.pos.y);
  return best;
}

const inCityArea = (x, z) => Math.abs(x) < WALL_OUT + 4 && Math.abs(z) < WALL_OUT + 4;

// arms of a ring road: other roads whose end lies at the ring (cached)
function ringExits(ring) {
  if (ring._exits) return ring._exits;
  const S = ring.samples, ex = [];
  for (const r of world.outRoads || []) {
    if (r === ring || !r.traffic) continue;
    for (const [ri, dir] of [[0, 1], [r.samples.length - 1, -1]]) {
      const e = r.samples[ri];
      let bi = -1, bd = 12;
      S.forEach((s, i) => { const d = Math.hypot(s.x - e.x, s.z - e.z); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) ex.push({ idx: bi, road: r, ridx: ri, dir: r.oneway && dir < 0 ? 1 : dir });
    }
  }
  return (ring._exits = ex);
}

// ---------- service vehicles on a fixed round (airport shuttle bus, docks truck) ----------
// route = closed list of {x, z} on the right lane; stops = [{ i, t, name }] (index into the route, wait seconds)
export class LoopDriver {
  constructor(veh, route, stops, speed) {
    this.veh = veh; this.route = route; this.stops = stops; this.base = speed;
    this.waitT = 0; this.atStop = null; this.lastStop = null; this.stuck = 0; this.reverseT = 0;
    let bi = 0, bd = 1e9;
    route.forEach((p, i) => { const d = Math.hypot(p.x - veh.pos.x, p.z - veh.pos.z); if (d < bd) { bd = d; bi = i; } });
    this.i = bi;
  }
  onAttacked() { this.waitT = Math.min(this.waitT, 1); }
  update(dt, G) {
    const v = this.veh, R = this.route, N = R.length, f = v.fwd;
    for (let k = 0; k < 6; k++) {
      const p = R[(this.i + 1) % N];
      if ((p.x - v.pos.x) * f.x + (p.z - v.pos.z) * f.z < 3) this.i = (this.i + 1) % N; else break;
    }
    // next stop ahead (distance along the route)
    let want = this.base, stopIn = 1e9, next = null;
    for (const s of this.stops) {
      if (s === this.lastStop) continue;
      const di = (s.i - this.i + N) % N;
      if (di < 12) { let d = Math.hypot(R[s.i].x - v.pos.x, R[s.i].z - v.pos.z); if (d < stopIn) { stopIn = d; next = s; } }
    }
    if (this.atStop) {
      this.waitT -= dt;
      want = 0;
      if (this.waitT <= 0) { this.lastStop = this.atStop; this.atStop = null; }
    } else if (next) {
      want = Math.min(want, Math.max(1.2, stopIn * 0.55));
      if (stopIn < 2.2 && Math.abs(v.vF) < 1.2) { this.atStop = next; this.waitT = next.t; }
    }
    if (this.lastStop && (this.lastStop.i - this.i + N) % N > 20 && (this.lastStop.i - this.i + N) % N < N - 20) this.lastStop = null;
    // steering: pure pursuit on the route
    const look = Math.max(2, Math.round((5 + Math.abs(v.vF) * 0.6) / 3));
    const t = R[(this.i + look) % N];
    const dx = t.x - v.pos.x, dz = t.z - v.pos.z;
    const ang = Math.atan2(dx * -f.z + dz * f.x, dx * f.x + dz * f.z);
    const a = R[this.i], b = R[(this.i + 1) % N], c = R[(this.i + 7) % N], d2 = R[(this.i + 8) % N];
    const turn = Math.abs(angleWrap(Math.atan2(d2.x - c.x, d2.z - c.z) - Math.atan2(b.x - a.x, b.z - a.z)));
    want = Math.min(want, this.base + (5 - this.base) * clamp(turn / 1.1, 0, 1));
    const free = want;
    if (this.ignoreT > 0) this.ignoreT -= dt;
    const ob = obstacleDist(v, G, this.ignoreT > 0 ? 4 : 20, true);
    if (this.ignoreT > 0) { if (ob < 1.2) want = 0; else want = Math.min(want, 3); }
    else if (ob < 20) want = Math.min(want, Math.max(0, (ob - 2.5) * 0.9));
    // blocked (e.g. people standing on the road): honk so they step aside, then creep past
    if (free > 2 && want < 0.5 && Math.abs(v.vF) < 0.6) this.blockT = (this.blockT || 0) + dt; else this.blockT = 0;
    if (this.blockT > 2.5 && !this.honked) {
      this.honked = true;
      if (G.audio && G.audio.honkAt) G.audio.honkAt(v.pos, this);
      for (const p of G.peds) if (!p.dead && Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z) < 16 && p.scare) p.scare(v.pos.x, v.pos.z, 3);
    }
    if (this.blockT > 6) { this.blockT = 0; this.honked = false; this.ignoreT = 3; }
    if (this.blockT === 0) this.honked = false;
    if (this.reverseT > 0) { this.reverseT -= dt; v.input.throttle = -0.6; v.input.steer = -clamp(ang * 2.2, -1, 1); v.input.handbrake = false; return; }
    v.input.steer = clamp(ang * 2.2, -1, 1);
    v.input.throttle = clamp((want - v.vF) * 0.45, -1, 1);
    v.input.handbrake = want < 0.3 && v.vF < 1;
    if (want > 3 && Math.abs(v.vF) < 0.5 && ob > 6) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 4) { this.stuck = 0; this.reverseT = 1.5; }
  }
}
// builds a closed route on the right-hand lane from pieces of roads: [[roadName, fromXZ, toXZ, dir], ...]
export function buildRoute(pieces, lane = 2.8) {
  const out = [];
  for (const [name, a, b] of pieces) {
    const r = (world.outRoads || []).find((q) => q.name === name);
    if (!r) continue;
    const S = r.samples, near = (p) => { let bi = 0, bd = 1e9; S.forEach((s, i) => { const d = Math.hypot(s.x - p[0], s.z - p[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
    const i0 = a ? near(a) : 0, i1 = b ? near(b) : S.length - 1;
    // one-way rings are always driven forwards (wrapping over the end); other roads in either direction
    const idxs = [];
    if (r.oneway) { for (let i = i0, k = 0; k < S.length * 2; i = (i + 1) % (S.length - 1), k++) { idxs.push(i); if (i === i1 && k > 0) break; } }
    else { const st = i1 >= i0 ? 1 : -1; for (let i = i0; st > 0 ? i <= i1 : i >= i1; i += st) idxs.push(i); }
    const fwd = r.oneway || i1 >= i0 ? 1 : -1;
    for (const i of idxs) {
      const st = fwd;
      const s = S[i], q = S[Math.min(S.length - 1, Math.max(0, i + st))], o = S[Math.min(S.length - 1, Math.max(0, i - st))];
      let fx = q.x - o.x, fz = q.z - o.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
      out.push({ x: s.x - fz * lane, z: s.z + fx * lane }); // right of the driving direction
    }
  }
  // drop points that are too close (piece joins)
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 1.2);
}

// nearest sample on any outskirts road
export function nearestRoad(x, z, maxD = 30, filter) {
  let best = null, bd = maxD;
  for (const r of world.outRoads || []) {
    if (filter && !filter(r)) continue;
    const S = r.samples;
    for (let i = 0; i < S.length; i += 2) {
      const d = Math.hypot(S[i].x - x, S[i].z - z);
      if (d < bd) { bd = d; best = { road: r, idx: i, d }; }
    }
  }
  return best;
}
// roads that touch point (x,z) -> [{road, idx, dirs}]
function junctionsAt(x, z, except) {
  const out = [];
  for (const r of world.outRoads || []) {
    if (r === except) continue;
    const S = r.samples;
    let bi = -1, bd = 12;
    for (let i = 0; i < S.length; i++) { const d = Math.hypot(S[i].x - x, S[i].z - z); if (d < bd) { bd = d; bi = i; } }
    if (bi < 0) continue;
    const dirs = [];
    if (bi < S.length - 3) dirs.push(1);
    if (bi > 2 && !r.oneway) dirs.push(-1);
    out.push({ road: r, idx: bi, dirs });
  }
  return out;
}

// follows a sampled road; shared by out-of-town traffic and police
class RoadFollow {
  constructor(road, idx, dir) { this.road = road; this.idx = idx; this.dir = road.oneway ? 1 : dir; }
  advance(v) {
    const S = this.road.samples;
    for (let k = 0; k < 5; k++) {
      const n = this.idx + this.dir;
      if (n < 0 || n >= S.length) break;
      const p = S[n];
      const f = v.fwd;
      if ((p.x - v.pos.x) * f.x + (p.z - v.pos.z) * f.z < 2.5) this.idx = n;
      else break;
    }
    return this.idx + this.dir < 0 || this.idx + this.dir >= S.length; // at end
  }
  steerTo(v, lane = 2.6) {
    const S = this.road.samples;
    const look = Math.max(2, Math.round((4 + Math.abs(v.vF) * 0.45) / 3));
    const ti = clamp(this.idx + this.dir * look, 0, S.length - 1);
    const t = S[ti];
    const th = this.dir > 0 ? t.h : t.h + Math.PI;
    const tx = t.x - Math.cos(th) * lane, tz = t.z + Math.sin(th) * lane;
    const f = v.fwd;
    const dx = tx - v.pos.x, dz = tz - v.pos.z;
    const ang = Math.atan2(dx * -f.z + dz * f.x, dx * f.x + dz * f.z);
    const fi = clamp(this.idx + this.dir * 8, 0, S.length - 1);
    const turn = Math.abs(angleWrap(S[fi].h - S[this.idx].h));
    const dev = Math.hypot(S[this.idx].x - v.pos.x, S[this.idx].z - v.pos.z);
    return { steer: clamp(ang * 2.2, -1, 1), turn, dev };
  }
  endPoint() { const S = this.road.samples; return S[this.dir > 0 ? S.length - 1 : 0]; }
}

// follows the curvy outskirts roads (desert, mountains, Kreuz, island)
export class OutDriver {
  constructor(veh, road, idx, dir) {
    this.veh = veh;
    this.rf = new RoadFollow(road, idx, dir);
    this.base = rand(13, 17);
    this.panic = 0;
    this.stuck = 0;
    this.reverseT = 0;
  }
  get road() { return this.rf.road; }
  onAttacked(G, rammed) { this.panic = rammed ? 4 : 10; }
  update(dt, G) {
    const v = this.veh;
    // roundabouts: at every arm the car may leave (never back into the arm it came from)
    if (this.rf.road.ring) {
      const ex = ringExits(this.rf.road), arms = new Set(ex.map((x) => x.road)).size;
      for (const x of ex) {
        // back into the arm you came from only where it is the only arm (turning loop at a dead end)
        if (x.idx !== this.rf.idx || (x.road === this.cameFrom && arms > 1) || this.lastExitIdx === x.idx) continue;
        this.lastExitIdx = x.idx;
        if (Math.random() < 0.5) { this.cameFrom = null; this.rf = new RoadFollow(x.road, x.ridx, x.dir); this.lastExitIdx = -1; break; }
      }
    }
    if (this.rf.advance(v)) {
      const e = this.rf.endPoint();
      if (inCityArea(e.x, e.z)) { v.driver = new TrafficDriver(v); return; }
      if (this.rf.road.ring) {
        // end of the ring: either leave here (if an arm is here) or keep circling
        const all = ringExits(this.rf.road), arms = new Set(all.map((x) => x.road)).size, L = this.rf.road.samples.length;
        const here = all.filter((x) => (x.idx >= L - 2 || x.idx <= 1) && (x.road !== this.cameFrom || arms === 1));
        if (here.length && Math.random() < 0.6) { const x = pick(here); this.rf = new RoadFollow(x.road, x.ridx, x.dir); this.cameFrom = null; }
        else { this.rf = new RoadFollow(this.rf.road, 0, 1); this.lastExitIdx = -1; }
        return;
      }
      const prev = this.rf.road;
      const opts = junctionsAt(e.x, e.z, this.rf.road).filter((o) => o.road.traffic && o.dirs.length);
      if (opts.length) { const o = pick(opts); this.rf = new RoadFollow(o.road, o.idx, pick(o.dirs)); if (o.road.ring) this.cameFrom = prev; }
      else this.rf.dir = -this.rf.dir;
    }
    const st = this.rf.steerTo(v);
    if (st.dev > 25) { const n = nearestRoad(v.pos.x, v.pos.z, 60); if (n) this.rf = new RoadFollow(n.road, n.idx, this.rf.dir); }
    let want = this.panic > 0 ? 26 : this.base;
    want = Math.min(want, lerpN(want, 7, clamp(st.turn / 1.2, 0, 1)));
    const free = want;
    if (this.ignoreT > 0) this.ignoreT -= dt;
    const ob = obstacleDist(v, G, this.ignoreT > 0 ? 4 : 22, true);
    if (this.ignoreT > 0) { if (ob < 1.2) want = 0; else want = Math.min(want, 5); }
    else if (ob < 22) want = Math.min(want, Math.max(0, (ob - 2.5) * 1.1));
    if (free > 2 && want < 1 && Math.abs(v.vF) < 0.6) this.blockT = (this.blockT || 0) + dt;
    else this.blockT = Math.max(0, (this.blockT || 0) - dt * 2);
    if (this.blockT > 5 && !(this.ignoreT > 0)) { if (Math.random() < 0.5) this.ignoreT = 3; else this.blockT = 3.5; }
    v.jammed = this.blockT > 3 && (this.jamT = (this.jamT || 0) + dt) > 14;
    if (this.blockT === 0) this.jamT = 0;
    this.panic -= dt;
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.input.throttle = -0.7; v.input.steer = -st.steer; v.input.handbrake = false;
      return;
    }
    v.input.steer = st.steer;
    v.input.throttle = clamp((want - v.vF) * 0.45, -1, 1);
    v.input.handbrake = want < 0.3 && v.vF < 1;
    if (want > 3 && Math.abs(v.vF) < 0.6) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 3) { this.stuck = 0; this.reverseT = 1.4; }
  }
}
const lerpN = (a, b, t) => a + (b - a) * t;

export function randomOutRoadSpawn(minD, maxD, from) {
  const roads = (world.outRoads || []).filter((r) => r.traffic);
  for (let k = 0; k < 40; k++) {
    const road = pick(roads);
    if (!road) return null;
    const idx = randi(3, road.samples.length - 4);
    const s = road.samples[idx];
    if (inCityArea(s.x, s.z)) continue;
    const d = Math.hypot(s.x - from.x, s.z - from.z);
    if (d < minD || d > maxD) continue;
    const dir = road.oneway || Math.random() < 0.5 ? 1 : -1;
    const h = dir > 0 ? s.h : s.h + Math.PI;
    return { x: s.x - Math.cos(h) * 2.6, z: s.z + Math.sin(h) * 2.6, h, road, idx, dir };
  }
  return null;
}

// which city exit leads toward a target outside the city
function exitToward(tx, tz) {
  if (tz < -WALL_OUT) return { axis: 'z', c: 0, dir: -1 };
  return { axis: 'x', c: tz < 0 ? roadC(2) : roadC(4), dir: tx < 0 ? -1 : 1 };
}

export class TrafficDriver extends PathDriver {
  constructor(veh) {
    super(veh);
    this.base = rand(10, 13.5);
    this.panic = 0;
    this.honkT = 0;
  }
  onAttacked(G, rammed) {
    if (rammed) {
      this.honkT = 0.6;
      if (Math.random() < 0.3) this.panic = 6;
    } else this.panic = 10;
  }
  update(dt, G) {
    const v = this.veh;
    const r = this.follow(dt, G, this.panic > 0 ? 24 : this.base, this.panic > 0);
    if (!r) return;
    let { steer, want } = r;
    // jam breaker: cars that block each other for a while creep past one by one
    const free = want;
    if (this.ignoreT > 0) this.ignoreT -= dt;
    const ob = obstacleDist(v, G, this.ignoreT > 0 ? 4 : this.panic > 0 ? 12 : 22);
    if (this.ignoreT > 0) { if (ob < 1.2) want = 0; else want = Math.min(want, 5); }
    else if (ob < 22) want = Math.min(want, Math.max(0, (ob - 2.5) * (this.panic > 0 ? 3 : 1.0)));
    if (free > 2 && want < 1 && Math.abs(v.vF) < 0.6) this.blockT = (this.blockT || 0) + dt;
    else this.blockT = Math.max(0, (this.blockT || 0) - dt * 2);
    if (this.blockT > 5 && !(this.ignoreT > 0)) {
      // only every other car tries at once, so two cars facing each other don't both push
      if (Math.random() < 0.5) this.ignoreT = 3;
      else this.blockT = 3.5;
    }
    v.jammed = this.blockT > 3 && (this.jamT = (this.jamT || 0) + dt) > 14;
    if (this.blockT === 0) this.jamT = 0;
    this.panic -= dt;
    if (this.honkT > 0) { this.honkT -= dt; if (G.audio) G.audio.honkAt(v.pos, this); }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.input.throttle = -0.7;
      v.input.steer = -steer;
      v.input.handbrake = false;
      return;
    }
    const sp = v.vF;
    let thr = clamp((want - sp) * 0.45, -1, 1);
    if (want < 0.3 && sp < 0.6) thr = 0;
    v.input.throttle = thr;
    v.input.steer = steer;
    v.input.handbrake = want < 0.3 && sp < 1;
    // stuck detection
    if (want > 3 && Math.abs(sp) < 0.6) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 3.5) { this.stuck = 0; this.reverseT = 1.4; }
  }
}

const MODELS_POLICE_BASE = { maxSpeed: 22, accel: 9 };
export class PoliceDriver extends PathDriver {
  constructor(veh) {
    super(veh);
    this.lane = 1.6;
    this.mode = 'chase';
    this.deployed = false;
  }
  onAttacked() {}
  chooseNext(i, j, d) {
    // greedy toward the player's node (or toward the bridge that leads to the player)
    const G = this.G;
    const pp = this.goal || (G.player.inVehicle ? G.player.inVehicle.pos : G.player.pos);
    const [ti, tj] = nearestNode(pp.x, pp.z);
    let best = d, bd = 1e9;
    for (const nd of [d, (d + 1) % 4, (d + 3) % 4]) {
      if (!validDir(i, j, nd)) continue;
      const ni = i + DIRS[nd][0], nj = j + DIRS[nd][1];
      const dd = Math.abs(ni - ti) + Math.abs(nj - tj) + Math.random() * 0.3;
      if (dd < bd) { bd = dd; best = nd; }
    }
    if (bd === 1e9) return (d + 2) % 4;
    return best;
  }
  // when close to the player's car: drive alongside instead of ramming all the time
  pursuit(v, G, target, dist, lead) {
    const pv = G.player.inVehicle;
    let tx = target.x, tz = target.z;
    let want;
    if (pv) {
      tx += pv.vel.x * lead; tz += pv.vel.y * lead;
      this.ramT = (this.ramT || 0) - (this.dt || 0);
      const pSpd = Math.abs(pv.vF || 0);
      const canRam = this.ramT < 0 && G.wanted.stars >= 3 && dist < 14;
      if (dist < 16 && !canRam) {
        // pull up next to the player (side the cop is already on)
        const fx = pv.fwd.x, fz = pv.fwd.z;
        const side = Math.sign((v.pos.x - target.x) * -fz + (v.pos.z - target.z) * fx) || 1;
        tx += -fz * side * 4.2; tz += fx * side * 4.2;
        want = pSpd + (dist > 8 ? 3 : 0.5);
      } else {
        want = 60;
        if (canRam && dist < 6) this.ramT = rand(5, 8);
      }
    } else want = clamp((dist - 9) * 1.2, 0, 25);
    const f = v.fwd;
    const ddx = tx - v.pos.x, ddz = tz - v.pos.z;
    return { steer: clamp(Math.atan2(ddx * -f.z + ddz * f.x, ddx * f.x + ddz * f.z) * 2.4, -1, 1), want };
  }
  update(dt, G) {
    this.G = G;
    const v = this.veh;
    this.dt = dt;
    // police always reach 80 % of the speed of the car the player sits in
    if (!v.Mown) { v.M = { ...v.M }; v.Mown = true; }
    const pv = G.player.inVehicle;
    const base = MODELS_POLICE_BASE;
    v.M.maxSpeed = pv && pv !== v ? Math.max(9, pv.M.maxSpeed * 0.8) : base.maxSpeed;
    v.M.accel = pv && pv !== v ? Math.max(6, pv.M.accel * 0.85) : base.accel;
    v.sirenOn = G.wanted.stars > 0 || this.mode === 'chase';
    const target = G.player.inVehicle ? G.player.inVehicle.pos : G.player.pos;
    const dx = target.x - v.pos.x, dz = target.z - v.pos.z;
    const dist = Math.hypot(dx, dz);
    if (this.mode === 'leave') {
      v.sirenOn = false;
      const r = this.follow(dt, G, 12, false);
      if (!r) return;
      const ob = obstacleDist(v, G);
      v.input.throttle = clamp((Math.min(r.want, (ob - 2.5)) - v.vF) * 0.5, -1, 1);
      v.input.steer = r.steer;
      v.input.handbrake = false;
      return;
    }
    if (this.mode === 'parked') {
      v.input.throttle = 0;
      v.input.steer = 0;
      v.input.handbrake = true;
      return;
    }
    let steer, want;
    const inC = inCityArea(v.pos.x, v.pos.z);
    const tInC = inCityArea(target.x, target.z);
    let losClear = false;
    this.goal = null;
    if (inC && !tInC) {
      // leave the city through the exit that leads toward the player
      const ex = exitToward(target.x, target.z);
      const gx = ex.axis === 'z' ? ex.c : ex.dir * (WALL_OUT + 14), gz = ex.axis === 'z' ? ex.dir * (WALL_OUT + 14) : ex.c;
      const near = ex.axis === 'z' ? Math.abs(v.pos.x - ex.c) < 14 && v.pos.z * ex.dir > H - 2 : Math.abs(v.pos.z - ex.c) < 14 && v.pos.x * ex.dir > H - 2;
      if (near) {
        const f = v.fwd;
        const ddx = gx - v.pos.x, ddz = gz - v.pos.z;
        steer = clamp(Math.atan2(ddx * -f.z + ddz * f.x, ddx * f.x + ddz * f.z) * 2.4, -1, 1);
        want = 30;
        this.pts = [];
      } else {
        this.goal = ex.axis === 'z' ? { x: ex.c, z: ex.dir * H } : { x: ex.dir * H, z: ex.c };
        const r = this.follow(dt, G, 34, true);
        if (!r) return;
        steer = r.steer;
        want = r.want;
      }
    } else if (!inC) {
      // outskirts: chase directly when close, otherwise follow the roads
      losClear = dist < 75 && !G.rayBlocked(v.pos.x, v.pos.y + 1, v.pos.z, target.x, target.y + 1, target.z);
      if (losClear) {
        ({ steer, want } = this.pursuit(v, G, target, dist, Math.min(1.2, dist / 25)));
      } else {
        if (!this.rf || (this.rfT = (this.rfT || 0) - dt) < 0) {
          this.rfT = 1.5;
          const n = this.rf && Math.hypot(this.rf.road.samples[this.rf.idx].x - v.pos.x, this.rf.road.samples[this.rf.idx].z - v.pos.z) < 20 ? { road: this.rf.road, idx: this.rf.idx } : nearestRoad(v.pos.x, v.pos.z, 45);
          if (n) {
            const S = n.road.samples;
            const ahead = S[Math.min(S.length - 1, n.idx + 15)], back = S[Math.max(0, n.idx - 15)];
            const dir = Math.hypot(ahead.x - target.x, ahead.z - target.z) < Math.hypot(back.x - target.x, back.z - target.z) ? 1 : -1;
            this.rf = new RoadFollow(n.road, n.idx, dir);
          } else this.rf = null;
        }
        if (this.rf) {
          if (this.rf.advance(v)) {
            const e = this.rf.endPoint();
            if (inCityArea(e.x, e.z)) { this.rf = null; this.pts = []; }
            else {
              let best = null, bd = 1e9;
              for (const o of junctionsAt(e.x, e.z, this.rf.road)) for (const d of o.dirs) {
                const S = o.road.samples;
                const q = S[clamp(o.idx + d * 20, 0, S.length - 1)];
                const dd = Math.hypot(q.x - target.x, q.z - target.z);
                if (dd < bd) { bd = dd; best = new RoadFollow(o.road, o.idx, d); }
              }
              this.rf = best || new RoadFollow(this.rf.road, this.rf.idx, -this.rf.dir);
            }
          }
        }
        if (this.rf) {
          const st = this.rf.steerTo(v, 1.6);
          steer = st.steer;
          want = lerpN(36, 12, clamp(st.turn / 1.2, 0, 1));
        } else {
          // off-road: straight at the player
          const f = v.fwd;
          const ddx = target.x - v.pos.x, ddz = target.z - v.pos.z;
          steer = clamp(Math.atan2(ddx * -f.z + ddz * f.x, ddx * f.x + ddz * f.z) * 2.4, -1, 1);
          want = 28;
        }
      }
      this.pts = [];
    } else {
      losClear = dist < 40 && !G.rayBlocked(v.pos.x, v.pos.y + 1, v.pos.z, target.x, target.y + 1, target.z);
      if (losClear) {
        ({ steer, want } = this.pursuit(v, G, target, dist, Math.min(1.2, dist / 25)));
        this.pts = [];
      } else {
        const r = this.follow(dt, G, 34, true);
        if (!r) return;
        steer = r.steer;
        want = r.want;
      }
    }
    // avoid obstacles a bit
    const ob = obstacleDist(v, G, 14);
    if (ob < 10 && !losClear) want = Math.min(want, Math.max(4, ob * 2));
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.input.throttle = -0.8;
      v.input.steer = -steer;
      v.input.handbrake = false;
      return;
    }
    v.input.throttle = clamp((want - v.vF) * 0.4, -1, 1);
    v.input.steer = steer;
    v.input.handbrake = false;
    if (want > 3 && Math.abs(v.vF) < 0.8) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 2) { this.stuck = 0; this.reverseT = 1.2; }
    // deploy officers when player on foot and close
    if (!G.player.inVehicle && dist < 22 && Math.abs(v.vF) < 4 && !this.deployed && G.wanted.stars > 0) {
      this.deployed = true;
      this.mode = 'parked';
      for (const side of [-1, 1]) {
        const f = v.fwd;
        const px = v.pos.x + -f.z * side * 1.6, pz = v.pos.z + f.x * side * 1.6;
        const cop = new Ped(G.scene, copLook, px, pz, 'cop');
        cop.car = v;
        G.peds.push(cop);
      }
    }
  }
}

// ---------------- pedestrians ----------------
let PID = 0;
export class Ped {
  constructor(scene, look, x, z, role = 'civ') {
    this.id = PID++;
    this.role = role;
    this.h = makeHuman(look || randomLook());
    scene.add(this.h.root);
    this.scene = scene;
    this.pos = new THREE.Vector3(x, groundAt(x, z, 1e9), z);
    this.yaw = rand(0, 6.28);
    this.vel = new THREE.Vector3();
    this.speed = 0;
    this.hp = role === 'cop' ? 60 : role === 'guard' ? 70 : 30;
    this.dead = false;
    this.deadT = 0;
    this.fleeT = 0;
    this.threat = null;
    this.walk = rand(1.1, 1.5);
    this.air = false;
    this.shootT = rand(0.5, 1.5);
    this.aim = 0;
    if (role === 'cop' || role === 'guard') {
      // pistol in hand
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.26), new THREE.MeshStandardMaterial({ color: '#222' }));
      g.position.set(0, -0.05, 0.12);
      this.h.hand.add(g);
    }
    this.assignBlock();
  }
  assignBlock() {
    // nearest block perimeter
    const bi = clamp(Math.floor((this.pos.x + H) / P), 0, NB - 1);
    const bj = clamp(Math.floor((this.pos.z + H) / P), 0, NB - 1);
    this.blk = world.blocks[bi * NB + bj];
    this.dirSign = Math.random() < 0.5 ? 1 : -1;
    this.inset = rand(2.9, 3.4); // house side of the 4 m sidewalk – street trees stand at 2.2 m
    this.t = this.project();
    this.cross = null;
  }
  rect() {
    const b = this.blk, s = this.inset;
    return [b.x0 + s, b.x1 - s, b.z0 + s, b.z1 - s];
  }
  perimPt(t) {
    const [x0, x1, z0, z1] = this.rect();
    const w = x1 - x0, d = z1 - z0, per = 2 * (w + d);
    t = ((t % per) + per) % per;
    if (t < w) return [x0 + t, z0];
    t -= w;
    if (t < d) return [x1, z0 + t];
    t -= d;
    if (t < w) return [x1 - t, z1];
    t -= w;
    return [x0, z1 - t];
  }
  project() {
    const [x0, x1, z0, z1] = this.rect();
    const w = x1 - x0, d = z1 - z0;
    const x = clamp(this.pos.x, x0, x1), z = clamp(this.pos.z, z0, z1);
    const dl = [z - z0, x1 - x, z1 - z, x - x0];
    const m = Math.min(...dl);
    if (m === dl[0]) return x - x0;
    if (m === dl[1]) return w + (z - z0);
    if (m === dl[2]) return w + d + (x1 - x);
    return 2 * w + d + (z1 - z);
  }
  scare(x, z, t = 8) {
    if (this.dead || this.role === 'cop' || this.role === 'guard') return;
    this.fleeT = Math.max(this.fleeT, t * rand(0.8, 1.2));
    this.threat = { x, z };
    this.cross = null;
  }
  hit(dmg, G, dirx, dirz, byPlayer) {
    if (this.dead) return;
    this.hp -= dmg;
    G.fx.blood(this.pos.x, this.pos.y + 1.3, this.pos.z);
    if (this.hp <= 0) this.die(G, dirx * 2, dirz * 2, 1.5, byPlayer);
    else this.scare(this.pos.x - dirx * 5, this.pos.z - dirz * 5);
    if (this.role === 'cop') this.alert = true;
  }
  die(G, vx, vz, vy, byPlayer) {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 25;
    this.vel.set(vx, vy, vz);
    this.air = vy > 0.5;
    if (byPlayer) G.onKill(this);
  }
  update(dt, G) {
    const h = this.h;
    if (this.dead) {
      this.deadT -= dt;
      if (this.air) {
        this.vel.y -= 18 * dt;
        this.pos.addScaledVector(this.vel, dt);
        const gy = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
        const r = collideCircle(this.pos.x, this.pos.z, 0.3, this.pos.y, 1);
        if (r.hit) { this.pos.x = r.x; this.pos.z = r.z; this.vel.x *= -0.3; this.vel.z *= -0.3; }
        if (this.pos.y <= gy) { this.pos.y = gy; this.air = false; this.vel.set(0, 0, 0); }
        this.spin = (this.spin || 0) + dt * 8;
        h.body.rotation.z = this.spin;
      } else h.body.rotation.z = damp(h.body.rotation.z, 0, 8, dt);
      animateHuman(h, dt, { dead: true });
      this.sync();
      if (this.deadT < 0) this.remove();
      return;
    }
    let mvx = 0, mvz = 0, sp = 0;
    const P0 = G.player;
    const pp = P0.inVehicle ? P0.inVehicle.pos : P0.pos;
    if (this.role === 'guard') {
      // bank guard: hold the post, take cover moves, shoot when the player is in sight
      const dx = pp.x - this.pos.x, dz = pp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const see = !this.calm && d < 38 && !G.rayBlocked(this.pos.x, this.pos.y + 1.5, this.pos.z, pp.x, pp.y + 1.3, pp.z);
      if (!this.calm) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
      this.aim = damp(this.aim, see ? 1 : 0.3, 6, dt);
      const post = this.post || { x: this.pos.x, z: this.pos.z };
      this.strafeT = (this.strafeT || 0) - dt;
      if (this.strafeT < 0) { this.strafeT = rand(1.2, 2.6); this.strafe = rand(-1, 1) > 0 ? 1 : -1; }
      let gx = post.x, gz = post.z;
      if (!see && d < 60) { gx = lerpN(post.x, pp.x, 0.4); gz = lerpN(post.z, pp.z, 0.4); }
      // side steps
      const sx = -dz / (d || 1), sz = dx / (d || 1);
      gx += sx * this.strafe * 2.2;
      gz += sz * this.strafe * 2.2;
      const mdx = gx - this.pos.x, mdz = gz - this.pos.z;
      const md = Math.hypot(mdx, mdz);
      if (md > 0.6) { sp = see ? 2.2 : 3.8; mvx = mdx / md; mvz = mdz / md; }
      if (this.calm) {
        // bodyguard escort: walk next to the VIP, no shooting yet
        const p2 = this.post || post;
        const ex = p2.x - this.pos.x, ez = p2.z - this.pos.z, ed = Math.hypot(ex, ez);
        this.aim = damp(this.aim, 0, 6, dt);
        sp = ed > 0.8 ? Math.min(3.6, ed * 1.5) : 0; mvx = ex / (ed || 1); mvz = ez / (ed || 1);
        if (sp > 0) this.yaw = dampAngle(this.yaw, Math.atan2(mvx, mvz), 6, dt);
        else if (this.lookYaw !== undefined) this.yaw = dampAngle(this.yaw, this.lookYaw, 3, dt);
        sp *= this.walkMul || 1;
      }
      this.shootT -= dt;
      if (!this.calm && see && this.shootT < 0 && !G.player.dead) {
        this.shootT = rand(0.8, 1.5);
        G.copShoot(this, d);
      }
    } else if (this.role === 'cop') {
      // approach and shoot
      const dx = pp.x - this.pos.x, dz = pp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      this.yaw = Math.atan2(dx, dz);
      if (G.wanted.stars === 0) {
        // go back to car / despawn
        this.aim = damp(this.aim, 0, 6, dt);
        if (d > 70) this.remove();
        sp = this.walk;
        mvx = -Math.sin(this.yaw);
        mvz = -Math.cos(this.yaw);
        this.yaw += Math.PI;
      } else {
        this.aim = damp(this.aim, d < 35 ? 1 : 0, 6, dt);
        if (d > 11) { sp = 4.5; mvx = dx / d; mvz = dz / d; }
        this.shootT -= dt;
        if (d < 35 && this.shootT < 0) {
          this.shootT = rand(0.7, 1.4);
          G.copShoot(this, d);
        }
      }
    } else if (this.fleeT > 0) {
      this.fleeT -= dt;
      const dx = this.pos.x - this.threat.x, dz = this.pos.z - this.threat.z;
      const d = Math.hypot(dx, dz) + 1e-3;
      mvx = dx / d; mvz = dz / d;
      // wobble
      const w = Math.sin(G.time * 2 + this.id) * 0.4;
      const cx = mvx * Math.cos(w) - mvz * Math.sin(w), cz = mvx * Math.sin(w) + mvz * Math.cos(w);
      mvx = cx; mvz = cz;
      sp = 5.2;
      this.yaw = dampAngle(this.yaw, Math.atan2(mvx, mvz), 10, dt);
      if (this.fleeT <= 0) { if (this.home) this.wp = null; else this.assignBlock(); }
    } else if (this.home) {
      // wander inside the hotspot (docks, airport, village ...)
      if (!this.wp || this.waitT > 0) {
        this.waitT = (this.waitT || 0) - dt;
        if (this.waitT <= 0 || !this.wp) {
          const a = rand(0, 6.28), r = rand(0, this.home.r);
          this.wp = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
          this.waitT = 0;
        }
      }
      if (this.wp && this.waitT <= 0) {
        const dx = this.wp.x - this.pos.x, dz = this.wp.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6 || this.blockedT > 1.5) { this.wp = null; this.waitT = rand(1, 5); this.blockedT = 0; }
        else {
          mvx = dx / d; mvz = dz / d;
          sp = this.walk;
          this.yaw = dampAngle(this.yaw, Math.atan2(mvx, mvz), 6, dt);
        }
      }
    } else if (this.cross) {
      const c = this.cross;
      const dx = c.x - this.pos.x, dz = c.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        this.blk = c.blk;
        this.cross = null;
        this.t = this.project();
      } else {
        mvx = dx / d; mvz = dz / d;
        sp = this.walk * 1.3;
        this.yaw = dampAngle(this.yaw, Math.atan2(mvx, mvz), 8, dt);
      }
    } else {
      // walk the perimeter
      this.t += this.walk * this.dirSign * dt;
      const [tx, tz] = this.perimPt(this.t + this.dirSign * 1.2);
      const dx = tx - this.pos.x, dz = tz - this.pos.z;
      const d = Math.hypot(dx, dz) + 1e-3;
      mvx = dx / d; mvz = dz / d;
      sp = Math.min(this.walk, d * 2);
      this.yaw = dampAngle(this.yaw, Math.atan2(mvx, mvz), 6, dt);
      // at corners, sometimes cross the street
      const [x0, x1, z0, z1] = this.rect();
      const atCorner = (Math.abs(this.pos.x - x0) < 0.4 || Math.abs(this.pos.x - x1) < 0.4) && (Math.abs(this.pos.z - z0) < 0.4 || Math.abs(this.pos.z - z1) < 0.4);
      if (atCorner && !this.cornerLock) {
        this.cornerLock = true;
        if (Math.random() < 0.35) {
          const b = this.blk;
          const opts = [];
          const sx = Math.abs(this.pos.x - x0) < 1 ? -1 : 1;
          const sz = Math.abs(this.pos.z - z0) < 1 ? -1 : 1;
          const nbi = b.bi + sx, nbj = b.bj + sz;
          if (nbi >= 0 && nbi < NB) opts.push({ blk: world.blocks[nbi * NB + b.bj], x: this.pos.x + sx * (2 * this.inset + 2 * RW), z: this.pos.z });
          if (nbj >= 0 && nbj < NB) opts.push({ blk: world.blocks[b.bi * NB + nbj], x: this.pos.x, z: this.pos.z + sz * (2 * this.inset + 2 * RW) });
          if (opts.length) this.cross = pick(opts);
        }
      } else if (!atCorner) this.cornerLock = false;
    }
    // move with collision
    this.speed = damp(this.speed, sp, 8, dt);
    const nx = this.pos.x + mvx * this.speed * dt, nz = this.pos.z + mvz * this.speed * dt;
    const r = collideCircle(nx, nz, 0.32, this.pos.y + 0.25, 1.6);
    this.pos.x = r.x;
    this.pos.z = r.z;
    this.pos.y = damp(this.pos.y, groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6), 20, dt);
    if (r.hit && this.home) this.blockedT = (this.blockedT || 0) + dt;
    if (r.hit && this.fleeT > 0) {
      // slide along wall
      this.threat.x += r.nz * 3;
      this.threat.z -= r.nx * 3;
    }
    // vehicle hits
    for (const v of G.vehicles) {
      if (v.removed) continue;
      const dx = this.pos.x - v.pos.x, dz = this.pos.z - v.pos.z;
      if (dx * dx + dz * dz > 16 || Math.abs(this.pos.y - v.pos.y) > 2) continue;
      for (const c of v.circles()) {
        const ddx = this.pos.x - c.x, ddz = this.pos.z - c.z;
        const rr = c.r + 0.3;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < rr * rr) {
          const spd = Math.hypot(v.vel.x, v.vel.y);
          if (spd > 4.5) {
            const byP = v.driver === 'player';
            this.die(G, v.vel.x * 0.9, v.vel.y * 0.9, 3 + spd * 0.18, byP);
            G.fx.blood(this.pos.x, this.pos.y + 1, this.pos.z);
            if (G.audio) G.audio.thud(G.audio.dist(this.pos));
            v.vel.multiplyScalar(0.94);
            return;
          }
          const d = Math.sqrt(d2) + 1e-4;
          this.pos.x = c.x + (ddx / d) * rr;
          this.pos.z = c.z + (ddz / d) * rr;
        }
      }
    }
    animateHuman(h, dt, { speed: this.speed, grounded: true, aim: this.aim, flee: this.fleeT > 0 && this.role !== 'cop' && Math.sin(this.id) > 0.3 });
    this.sync();
  }
  sync() {
    this.h.root.position.copy(this.pos);
    this.h.root.rotation.y = this.yaw;
  }
  remove() {
    this.scene.remove(this.h.root);
    this.removed = true;
  }
}

export function randomSidewalkPoint(minD, maxD, from) {
  for (let k = 0; k < 30; k++) {
    const b = pick(world.blocks);
    const s = rand(2.9, 3.4);
    const side = randi(0, 3);
    const t = rand(0, 1);
    let x, z;
    if (side === 0) { x = b.x0 + s + (b.x1 - b.x0 - 2 * s) * t; z = b.z0 + s; }
    else if (side === 1) { x = b.x1 - s; z = b.z0 + s + (b.z1 - b.z0 - 2 * s) * t; }
    else if (side === 2) { x = b.x0 + s + (b.x1 - b.x0 - 2 * s) * t; z = b.z1 - s; }
    else { x = b.x0 + s; z = b.z0 + s + (b.z1 - b.z0 - 2 * s) * t; }
    const d = from ? Math.hypot(x - from.x, z - from.z) : 50;
    if (d >= minD && d <= maxD) return [x, z];
  }
  return null;
}

export function randomRoadSpawn(minD, maxD, from) {
  for (let k = 0; k < 40; k++) {
    const i = randi(0, NB), j = randi(0, NB);
    const d = randi(0, 3);
    if (!validDir(i, j, d)) continue;
    const s = rand(RW + 6, P - RW - 6);
    const [x, z] = lanePt(i, j, d, s);
    const dist = from ? Math.hypot(x - from.x, z - from.z) : 100;
    if (dist < minD || dist > maxD) continue;
    return { x, z, h: Math.atan2(DIRS[d][0], DIRS[d][1]) };
  }
  return null;
}
