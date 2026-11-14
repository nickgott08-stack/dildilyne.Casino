// Road graph + shortest path (for the GPS line to markers)
import { world, NB, roadC } from './world.js';
import * as THREE from 'three';
import { ROADS, WALL_OUT, radjE } from './geo.js';
import { ISL } from './radj.js';

// Radj's island is not connected to the mainland road graph (you get there by plane):
// routes on the island follow its own forest road, routes between island and mainland get no GPS line.
const onIsland = (x, z) => radjE(x, z) < 1.3;
let islRoads = null;
function islandRoute(ax, az, bx, bz) {
  if (!islRoads) islRoads = [ISL.road, ISL.helRoad].map((pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.4).getSpacedPoints(120).map((p) => ({ x: p.x, z: p.z })));
  const direct = Math.hypot(bx - ax, bz - az);
  let best = null;
  for (const R of islRoads) {
    let ia = 0, ib = 0, da = Infinity, db = Infinity;
    R.forEach((p, i) => { const d1 = Math.hypot(p.x - ax, p.z - az), d2 = Math.hypot(p.x - bx, p.z - bz); if (d1 < da) { da = d1; ia = i; } if (d2 < db) { db = d2; ib = i; } });
    // only worth it if the road actually helps (both ends reasonably close to it, and they are far apart along it)
    if (da > 45 || db > 45 || Math.abs(ia - ib) < 3) continue;
    const seg = ia < ib ? R.slice(ia, ib + 1) : R.slice(ib, ia + 1).reverse();
    const len = da + db + seg.reduce((s, p, i) => s + (i ? Math.hypot(p.x - seg[i - 1].x, p.z - seg[i - 1].z) : 0), 0);
    if (len < direct * 3 && (!best || len < best.len)) best = { len, seg };
  }
  return best ? [{ x: ax, z: az }, ...best.seg, { x: bx, z: bz }] : [{ x: ax, z: az }, { x: bx, z: bz }];
}

let nodes = null; // {x,z,adj:[[idx,cost]]}
const link = (a, b) => {
  const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
  nodes[a].adj.push([b, d]);
  nodes[b].adj.push([a, d]);
};

export function buildRouteGraph() {
  nodes = [];
  // city grid
  const cid = (i, j) => i * (NB + 1) + j;
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) nodes.push({ x: roadC(i), z: roadC(j), adj: [] });
  for (let i = 0; i <= NB; i++)
    for (let j = 0; j <= NB; j++) {
      if (i < NB) link(cid(i, j), cid(i + 1, j));
      if (j < NB) link(cid(i, j), cid(i, j + 1));
    }
  // side streets are walkable/drivable shortcuts too
  for (const st of world.sideStreets) {
    const a = nodes.length;
    if (st.along === 'z') { const cx = (st.x0 + st.x1) / 2; nodes.push({ x: cx, z: st.z0 - 6, adj: [] }, { x: cx, z: st.z1 + 6, adj: [] }); }
    else { const cz = (st.z0 + st.z1) / 2; nodes.push({ x: st.x0 - 6, z: cz, adj: [] }, { x: st.x1 + 6, z: cz, adj: [] }); }
    link(a, a + 1);
    // connect both ends to the two nearest city nodes on that road
    for (const e of [a, a + 1]) {
      const near = [];
      for (let k = 0; k < (NB + 1) * (NB + 1); k++) near.push([k, Math.hypot(nodes[k].x - nodes[e].x, nodes[k].z - nodes[e].z)]);
      near.sort((p, q) => p[1] - q[1]);
      link(e, near[0][0]);
      link(e, near[1][0]);
    }
  }
  // outskirts roads
  const roadNodes = [];
  for (const r of ROADS) {
    const S = r.samples;
    const ids = [];
    for (let i = 0; i < S.length; i += 4) { ids.push(nodes.length); nodes.push({ x: S[i].x, z: S[i].z, y: S[i].y, adj: [] }); }
    if ((S.length - 1) % 4) { ids.push(nodes.length); const p = S[S.length - 1]; nodes.push({ x: p.x, z: p.z, y: p.y, adj: [] }); }
    for (let k = 0; k < ids.length - 1; k++) link(ids[k], ids[k + 1]);
    roadNodes.push({ r, ids });
  }
  // junctions: road ends snap to the nearest node of another road (same level)
  for (const rn of roadNodes) {
    for (const end of [rn.ids[0], rn.ids[rn.ids.length - 1]]) {
      let best = -1, bd = 18;
      for (const o of roadNodes) {
        if (o === rn) continue;
        for (const id of o.ids) {
          const d = Math.hypot(nodes[id].x - nodes[end].x, nodes[id].z - nodes[end].z);
          if (d < bd && Math.abs((nodes[id].y || 0) - (nodes[end].y || 0)) < 2.5) { bd = d; best = id; }
        }
      }
      if (best >= 0) link(end, best);
    }
  }
  // crossings: nodes of different roads that meet on the same level
  for (let a = 0; a < roadNodes.length; a++)
    for (let b = a + 1; b < roadNodes.length; b++)
      for (const ia of roadNodes[a].ids)
        for (const ib of roadNodes[b].ids) {
          const A = nodes[ia], B = nodes[ib];
          if (Math.abs(A.x - B.x) < 8 && Math.abs(A.z - B.z) < 8 && Math.abs((A.y || 0) - (B.y || 0)) < 2.5) link(ia, ib);
        }
  // city exits: boundary intersection <-> first node of the road leaving the gap
  for (const e of world.exits) {
    const ci = e.axis === 'z' ? Math.round((e.c + roadC(NB)) / (roadC(1) - roadC(0))) : e.dir > 0 ? NB : 0;
    const cj = e.axis === 'z' ? (e.dir > 0 ? NB : 0) : Math.round((e.c + roadC(NB)) / (roadC(1) - roadC(0)));
    const inner = cid(ci, cj);
    const ox = e.axis === 'z' ? e.c : e.dir * WALL_OUT, oz = e.axis === 'z' ? e.dir * WALL_OUT : e.c;
    let best = -1, bd = 30;
    for (const rn of roadNodes) for (const id of rn.ids) {
      const d = Math.hypot(nodes[id].x - ox, nodes[id].z - oz);
      if (d < bd) { bd = d; best = id; }
    }
    if (best >= 0) link(inner, best);
  }
}

function nearestNode(x, z) {
  let best = 0, bd = 1e18;
  for (let i = 0; i < nodes.length; i++) {
    const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// returns [{x,z}] from (ax,az) to (bx,bz) along roads
export function findRoute(ax, az, bx, bz) {
  const ia = onIsland(ax, az), ib = onIsland(bx, bz);
  if (ia && ib) return islandRoute(ax, az, bx, bz);
  if (ia || ib) return null; // island <-> mainland: fly there, no road line
  if (!nodes) buildRouteGraph();
  const s = nearestNode(ax, az), t = nearestNode(bx, bz);
  const n = nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[s] = 0;
  // A* with a simple binary heap
  const heap = [[Math.hypot(nodes[s].x - bx, nodes[s].z - bz), s]];
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [, u] = pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === t) break;
    for (const [v, c] of nodes[u].adj) {
      const nd = dist[u] + c;
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd + Math.hypot(nodes[v].x - bx, nodes[v].z - bz), v]); }
    }
  }
  if (dist[t] === Infinity) return [{ x: ax, z: az }, { x: bx, z: bz }];
  const path = [];
  for (let u = t; u >= 0; u = prev[u]) path.push({ x: nodes[u].x, z: nodes[u].z });
  path.reverse();
  path.unshift({ x: ax, z: az });
  path.push({ x: bx, z: bz });
  return path;
}
