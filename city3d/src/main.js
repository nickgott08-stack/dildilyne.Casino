import * as THREE from 'three';
import { buildWorld, world, collideCircle, groundY, groundAt, rayBoxes, updateLights, BOUND, H, NB, roadC, RW, query, P } from './world.js';
import { slopeAt, WALL_OUT } from './geo.js';
import { createSky, updateSky, DAY_LEN, timeString } from './sky.js';
import { buildMapCanvas, drawMinimap, BigMap, Waypoint } from './map.js';
import { Missions } from './missions.js';
import { findRoute } from './route.js';
import { isLand, inCity, areaName } from './outskirts.js';
import { makeHuman, animateHuman, nickLook, humanMat } from './human.js';
import { Vehicle, collideVehicles, MODELS } from './vehicles.js';
import { TrafficDriver, PoliceDriver, OutDriver, Ped, randomSidewalkPoint, randomRoadSpawn, randomOutRoadSpawn } from './ai.js';
import { FX } from './fx.js';
import { Online } from './online.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { clamp, lerp, damp, dampAngle, angleWrap, rand, randi, pick, store, casino } from './util.js';

const $ = (id) => document.getElementById(id);
function lockPointer() {
  try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---------- quality ----------
const QUALITY = {
  hoch: { pr: Math.min(window.devicePixelRatio || 1, 1.6), shadow: 2048, shadows: true, traffic: 22, peds: 26, lod: 70 },
  mittel: { pr: Math.min(window.devicePixelRatio || 1, 1.2), shadow: 1024, shadows: true, traffic: 17, peds: 20, lod: 50 },
  niedrig: { pr: 1, shadow: 512, shadows: false, traffic: 13, peds: 14, lod: 35 },
};
let qName = store.get('dc3d_q') || 'hoch';
let Q = QUALITY[qName];

// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 2200);

const G = {
  scene, camera, time: 0, vehicles: [], peds: [], pickups: [], shake: 0,
  wanted: { level: 0, stars: 0, evadeT: 0, seenT: 0 },
  money: parseInt(store.get('dc3d_dollar') || '500', 10),
  cycle: ((Date.now() / 1000) / 1800) % 1, // time of day (0..1), follows the real clock
  paused: true,
};
window.G = G;

function applyQuality() {
  Q = QUALITY[qName];
  renderer.setPixelRatio(Q.pr);
  renderer.shadowMap.enabled = Q.shadows;
  sky.sun.castShadow = Q.shadows;
  if (sky.sun.shadow.map) { sky.sun.shadow.map.dispose(); sky.sun.shadow.map = null; }
  sky.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => (m.needsUpdate = true)); } });
  resize();
  store.set('dc3d_q', qName);
}

const sky = createSky(scene);
// environment map for reflections (car paint, glass towers)
{
  const envScene = new THREE.Scene();
  const eg = new THREE.SphereGeometry(10, 32, 16);
  const cols = [];
  const pos = eg.attributes.position;
  const top = new THREE.Color('#8fb8f0'), hor = new THREE.Color('#eef2f6'), bot = new THREE.Color('#4a4640');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.min(1, -y * 3));
    cols.push(c.r, c.g, c.b);
  }
  eg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  envScene.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sunB = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.5, 4.5) }));
  sunB.position.set(5, 6, 3);
  envScene.add(sunB);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.6;
}
buildWorld(scene, Q);
const fx = new FX(scene);
G.fx = fx;
const audio = new Audio();
G.audio = audio;
const input = new Input();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fx.setScale(h * Q.pr);
}
window.addEventListener('resize', resize);
applyQuality();

// headlight for the player's car
const headL = new THREE.SpotLight('#fff2d0', 0, 60, 0.55, 0.5, 1.2);
scene.add(headL, headL.target);

// ---------- player ----------
const player = {
  pos: world.spawn.clone(),
  vy: 0, yaw: 0, grounded: true, hp: 100, armor: 0,
  inVehicle: null, weapon: 1, has: [true, true, store.get('dc3d_ak') === '1'],
  fireT: 0, reloadT: 0, ammo: [Infinity, 12, 30], punchT: 0, speed: 0, hurtT: 0, dead: false, deadT: 0, knockT: 0,
};
G.player = player;
player.h = makeHuman(nickLook);
scene.add(player.h.root);
// weapon meshes
const gunMat = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.4, metalness: 0.6 });
const woodMat = new THREE.MeshStandardMaterial({ color: '#7a4a24', roughness: 0.7 });
const pistolM = new THREE.Group();
{
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.26), gunMat); a.position.set(0, 0.02, 0.1);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.07), gunMat); b.position.set(0, -0.06, 0.02);
  pistolM.add(a, b);
}
const akM = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.62), gunMat); body.position.set(0, 0.02, 0.2);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), gunMat); barrel.position.set(0, 0.05, 0.68);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.34), woodMat); stock.position.set(0, -0.01, -0.22);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.09), gunMat); mag.position.set(0, -0.12, 0.28); mag.rotation.x = 0.35;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.22), woodMat); guard.position.set(0, 0.0, 0.45);
  akM.add(body, barrel, stock, mag, guard);
}
player.h.hand.add(pistolM, akM);
pistolM.rotation.x = -Math.PI / 2; akM.rotation.x = -Math.PI / 2;
// the hand points down the arm; rotate guns so they point forward when the arm is raised
pistolM.rotation.set(Math.PI / 2, 0, 0);
akM.rotation.set(Math.PI / 2, 0, 0);
pistolM.position.set(0, -0.05, 0);
akM.position.set(0, -0.05, 0);

const WEAPONS = [
  { name: 'Faust', icon: '👊' },
  { name: 'Pistole', icon: '🔫', dmg: 34, rate: 0.26, mag: 12, spread: 0.006, sound: 'pistol', reload: 1.2 },
  { name: 'AK-47', icon: '🪖', dmg: 26, rate: 0.1, mag: 30, spread: 0.018, sound: 'ak', reload: 1.8 },
];

// camera state
const cam = { yaw: Math.PI, pitch: 0.18, dist: 4.2, mode: 0, lastLook: -10, fov: 68, aim: 0 };
player.yaw = cam.yaw;
G.cam = cam;

// ---------- spawning ----------
function spawnParked() {
  for (const s of world.parkSpots) {
    // fewer parked cars (each detailed car costs several draw calls); decor cars always stay
    if (!s.decor && Math.random() < 0.35) continue;
    const type = s.model || pick(['skoda', 'skoda', 'van', 'rs6', 'taxi']);
    const v = new Vehicle(scene, type, s.x, s.z, s.h, s.color);
    v.parked = true;
    G.vehicles.push(v);
  }
  // your own Skoda (starter car) is always parked next to the park when you join
  const sp = world.spawn;
  let tune = null;
  try { tune = JSON.parse(store.get('dc3d_tune') || '{}').skoda || null; } catch (e) {}
  // on the park path right next to you, nose towards the street
  const cx = sp.x + 7, cz = sp.z + 2;
  const b = new Vehicle(scene, 'skoda', cx, cz, Math.PI / 2, '#2e7d32', tune);
  b.parked = true;
  b.mine = true;
  G.vehicles.push(b);
  G.myCar = b;
}
spawnParked();

function trafficCount() { return G.vehicles.filter((v) => v.driver instanceof TrafficDriver).length; }
function outTrafficCount() { return G.vehicles.filter((v) => v.driver instanceof OutDriver).length; }
function spawnOutTraffic(initial) {
  const pp = G.focusPos ? G.focusPos() : player.pos;
  const p = randomOutRoadSpawn(initial ? 30 : 90, 200, pp);
  if (!p) return;
  for (const v of G.vehicles) if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 12) return;
  if (!initial && isVisible(p.x, 1, p.z, 6)) return;
  const desert = p.z > 0;
  const type = pick(desert ? ['skoda', 'van', 'van', 'rs6', 'ferrari', 'taxi', 'skoda'] : ['van', 'van', 'skoda', 'taxi']);
  const v = new Vehicle(scene, type, p.x, p.z, p.h);
  v.driver = new OutDriver(v, p.road, p.idx, p.dir);
  v.vel.set(Math.sin(p.h) * 10, Math.cos(p.h) * 10);
  G.vehicles.push(v);
}
function spawnHotspotPeds() {
  const pp = G.focusPos ? G.focusPos() : player.pos;
  for (const hs of world.hotspots || []) {
    const d = Math.hypot(hs.x - pp.x, hs.z - pp.z);
    if (d > 170) continue;
    const have = G.peds.filter((p) => p.home === hs && !p.dead).length;
    if (have >= hs.n) continue;
    for (let k = 0; k < 6; k++) {
      const a = rand(0, 6.28), r = rand(0, hs.r);
      const x = hs.x + Math.cos(a) * r, z = hs.z + Math.sin(a) * r;
      if (!isLand(x, z) || collideCircle(x, z, 0.5, groundAt(x, z) + 0.2, 1.6).hit) continue;
      if (isVisible(x, 1, z, 1.5) && Math.hypot(x - pp.x, z - pp.z) < 70) continue;
      const ped = new Ped(scene, null, x, z);
      ped.home = hs;
      G.peds.push(ped);
      break;
    }
  }
}

function spawnTraffic(initial) {
  const pp = player.inVehicle ? player.inVehicle.pos : player.pos;
  const p = randomRoadSpawn(initial ? 15 : 90, initial ? 200 : 180, pp);
  if (!p) return;
  // avoid spawning on other cars
  for (const v of G.vehicles) if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 9) return;
  if (!initial && isVisible(p.x, 1, p.z, 6)) return;
  const type = pick(['skoda', 'skoda', 'skoda', 'van', 'van', 'rs6', 'taxi', 'taxi', 'skoda', 'van']);
  const v = new Vehicle(scene, type, p.x, p.z, p.h);
  v.driver = new TrafficDriver(v);
  v.driverLook = true;
  const f = v.fwd;
  v.vel.set(f.x * 8, f.z * 8);
  G.vehicles.push(v);
}

function spawnPed(initial) {
  const pp = player.inVehicle ? player.inVehicle.pos : player.pos;
  const p = randomSidewalkPoint(initial ? 6 : 60, initial ? 140 : 120, pp);
  if (!p) return;
  if (!initial && isVisible(p[0], 1, p[1], 1.5)) return;
  G.peds.push(new Ped(scene, null, p[0], p[1]));
}

const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _sph = new THREE.Sphere();
function isVisible(x, y, z, r) {
  _sph.center.set(x, y, z);
  _sph.radius = r;
  return _frustum.intersectsSphere(_sph) && Math.hypot(x - camera.position.x, z - camera.position.z) < 160;
}

function manageSpawns() {
  const pp = player.inVehicle ? player.inVehicle.pos : player.pos;
  // despawn far traffic / peds
  for (const v of G.vehicles) {
    if (v.removed || v.driver === 'player' || v === player.inVehicle || v === G.lastCar || v.keep) continue;
    const d = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z);
    const isTraffic = v.driver instanceof TrafficDriver || v.driver instanceof OutDriver || (v.driver instanceof PoliceDriver && v.driver.mode === 'leave');
    const abandoned = !v.driver && !v.parked && d > 200;
    // hopeless jams dissolve as soon as nobody is looking
    if (v.jammed && (v.driver instanceof TrafficDriver || v.driver instanceof OutDriver) && d > 25 && !isVisible(v.pos.x, 1, v.pos.z, 4)) { v.remove(); continue; }
    if ((isTraffic && d > 230) || (v.dead && d > 150) || abandoned) {
      if (!isVisible(v.pos.x, 1, v.pos.z, 4) || d > 300) v.remove();
    }
  }
  G.vehicles = G.vehicles.filter((v) => !v.removed);
  for (const p of G.peds) {
    if (p.removed) continue;
    const d = Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z);
    if (!p.keep && d > (p.home ? 200 : 150) && !isVisible(p.pos.x, 1, p.pos.z, 1)) p.remove();
  }
  G.peds = G.peds.filter((p) => !p.removed);
  const city = inCity(pp.x, pp.z) || Math.max(Math.abs(pp.x), Math.abs(pp.z)) < BOUND + 120;
  if (city && trafficCount() < Q.traffic) { spawnTraffic(false); spawnTraffic(false); }
  if (!inCity(pp.x, pp.z) && outTrafficCount() < Math.round(Q.traffic * 0.55)) spawnOutTraffic(false);
  if (city && G.peds.filter((p) => p.role === 'civ' && !p.home).length < Q.peds) spawnPed(false);
  spawnHotspotPeds();
}

// ---------- pickups ----------
const pickupMeshes = [];
function makePickupMesh(type) {
  const g = new THREE.Group();
  const glowCol = { health: '#ff3b3b', armor: '#3b8bff', ammo: '#ffd23b', ak: '#ffffff', money: '#3bff6a' }[type];
  if (type === 'health') {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff2020', emissiveIntensity: 0.4 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), m);
    g.add(a, b);
  } else if (type === 'armor') {
    const m = new THREE.MeshStandardMaterial({ color: '#2c4f8a', emissive: '#1a3bff', emissiveIntensity: 0.3 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.18), m));
  } else if (type === 'ammo') {
    const m = new THREE.MeshStandardMaterial({ color: '#4d5a2a', emissive: '#806010', emissiveIntensity: 0.3 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.35), m));
  } else if (type === 'ak') {
    const c = akM.clone();
    c.rotation.set(0, 0, 0);
    c.scale.setScalar(1.3);
    g.add(c);
  } else if (type === 'money') {
    const m = new THREE.MeshStandardMaterial({ color: '#3fae5a', emissive: '#1f8a3a', emissiveIntensity: 0.5 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.26), m));
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24), new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.85;
  g.add(ring);
  scene.add(g);
  return g;
}
for (const p of world.pickups) {
  // weapons, health and vests no longer lie around – they are bought in the shop
  if (p.type !== 'money') continue;
  G.pickups.push({ ...p, mesh: makePickupMesh(p.type), respawn: 0, y: groundAt(p.x, p.z) + 1 });
}
function dropMoney(x, z, amount) {
  G.pickups.push({ type: 'money', x, z, amount, mesh: makePickupMesh('money'), respawn: 0, y: groundAt(x, z) + 0.9, once: true, life: 40 });
}

function updatePickups(dt) {
  for (const p of G.pickups) {
    if (p.respawn > 0) {
      p.respawn -= dt;
      if (p.respawn <= 0) p.mesh.visible = true;
      continue;
    }
    if (p.once) { p.life -= dt; if (p.life < 0) { scene.remove(p.mesh); p.gone = true; continue; } }
    p.mesh.position.set(p.x, p.y + Math.sin(G.time * 3 + p.x) * 0.12, p.z);
    p.mesh.children[0].parent.rotation.y = G.time * 2;
    if (player.inVehicle || player.dead) continue;
    if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 1.3) {
      let took = true;
      if (p.type === 'health') { if (player.hp >= 100) took = false; else { player.hp = 100; toast('❤️ Gesundheit aufgefüllt'); } }
      else if (p.type === 'armor') { if (player.armor >= 100) took = false; else { player.armor = 100; toast('🦺 Schutzweste angezogen'); } }
      else if (p.type === 'ammo') took = false;
      else if (p.type === 'ak') {
        if (!player.has[2]) { player.has[2] = true; player.weapon = 2; toast('🪖 AK-47 aufgesammelt!'); }
        else took = false;
      } else if (p.type === 'money') { addMoney(p.amount); }
      if (took) {
        audio.pickup();
        if (p.once) { scene.remove(p.mesh); p.gone = true; }
        else { p.respawn = 60; p.mesh.visible = false; }
      }
    }
  }
  G.pickups = G.pickups.filter((p) => !p.gone);
}

function addMoney(n) {
  G.money += n;
  store.set('dc3d_dollar', String(G.money));
  floatMoney(n);
}

// ---------- combat ----------
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
function rayHuman(o, d, p) {
  // three spheres along the body
  let best = null;
  for (const [hy, r] of [[0.5, 0.3], [1.2, 0.34], [1.85, 0.24]]) {
    const cx = p.pos.x - o.x, cy = p.pos.y + hy - o.y, cz = p.pos.z - o.z;
    const t = cx * d.x + cy * d.y + cz * d.z;
    if (t < 0) continue;
    const d2 = cx * cx + cy * cy + cz * cz - t * t;
    if (d2 < r * r) { const tt = t - Math.sqrt(r * r - d2); if (best === null || tt < best) best = tt; }
  }
  return best;
}
function rayVehicle(o, d, v) {
  const c = Math.cos(-v.h), s = Math.sin(-v.h);
  const ox = o.x - v.pos.x, oz = o.z - v.pos.z;
  const lx = ox * c + oz * s, lz = -ox * s + oz * c;
  const dx = d.x * c + d.z * s, dz = -d.x * s + d.z * c;
  const ly = o.y - v.pos.y;
  const hw = v.M.wid / 2, hl = v.M.len / 2;
  let tmin = 0, tmax = 1e9;
  const O = [lx, ly, lz], D = [dx, d.y, dz], mn = [-hw, 0.25, -hl], mx = [hw, v.type === 'van' ? 2.3 : 1.55, hl];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(D[a]) < 1e-9) { if (O[a] < mn[a] || O[a] > mx[a]) return null; continue; }
    let t1 = (mn[a] - O[a]) / D[a], t2 = (mx[a] - O[a]) / D[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
G.rayBlocked = (x1, y1, z1, x2, y2, z2) => {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const L = Math.hypot(dx, dy, dz);
  const r = rayBoxes(x1, y1, z1, dx / L, dy / L, dz / L, L);
  return !!r;
};

function castShot(o, d, maxT, minT, exclude) {
  let best = { t: maxT, kind: 'none' };
  const wb = rayBoxes(o.x, o.y, o.z, d.x, d.y, d.z, maxT);
  if (wb && wb.t > minT) best = { t: wb.t, kind: 'world' };
  if (d.y < -1e-4) { const tg = -o.y / d.y; if (tg > minT && tg < best.t) best = { t: tg, kind: 'ground' }; }
  for (const p of G.peds) {
    if (p.dead || p.removed || p === exclude) continue;
    const t = rayHuman(o, d, p);
    if (t !== null && t > minT && t < best.t) best = { t, kind: 'ped', p };
  }
  for (const v of G.vehicles) {
    if (v.removed || v === player.inVehicle) continue;
    if (Math.hypot(v.pos.x - o.x, v.pos.z - o.z) > maxT + 5) continue;
    const t = rayVehicle(o, d, v);
    if (t !== null && t > minT && t < best.t) best = { t, kind: 'veh', v };
  }
  return best;
}

function muzzlePos(out) {
  const w = player.weapon === 2 ? akM : pistolM;
  w.updateWorldMatrix(true, false);
  return out.set(0, 0, player.weapon === 2 ? 0.9 : 0.25).applyMatrix4(w.matrixWorld);
}

function fire() {
  const W = WEAPONS[player.weapon];
  if (player.weapon === 0) {
    // punch
    player.punchT = 0.3;
    audio.shot('punch');
    const f = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) };
    for (const p of G.peds) {
      if (p.dead) continue;
      const dx = p.pos.x - player.pos.x, dz = p.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6 && (dx * f.x + dz * f.z) / d > 0.5) {
        p.hit(14, G, f.x, f.z, true);
        if (!p.dead) { p.pos.x += f.x * 0.6; p.pos.z += f.z * 0.6; }
        if (p.role === 'cop') crime(1.0, 'Polizist angegriffen');
        else crime(0.15, null, true);
        break;
      }
    }
    return;
  }
  if (player.reloadT > 0) return;
  if (player.ammo[player.weapon] <= 0) { startReload(); return; }
  player.ammo[player.weapon]--;
  // ray from camera
  const o = camera.position.clone();
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  // aim assist: locked target gets hit directly, otherwise a small cone around the crosshair
  let target = lock.target && !lock.target.dead ? lock.target : findTarget(o, d, isTouch ? 0.09 : 0.03, 70);
  const minT = o.distanceTo(_v2.set(player.pos.x, player.pos.y + 1.5, player.pos.z)) + 0.4;
  let partial = false;
  if (target) {
    // aim at the part of the body that is actually visible (e.g. only the head above a car)
    let found = false;
    for (const hy of [1.25, 1.5, 1.82, 0.6]) {
      _v1.set(target.pos.x, target.pos.y + hy, target.pos.z).sub(o).normalize();
      const tst = castShot(o, _v1, 160, minT);
      if (tst.kind === 'ped' && tst.p === target) { d.copy(_v1); found = true; partial = hy !== 1.25; break; }
    }
    if (!found) d.set(target.pos.x, target.pos.y + 1.25, target.pos.z).sub(o).normalize();
  }
  // less spread on a locked target, almost none when only the head is visible
  const spr = W.spread * (player.speed > 2 ? 2 : 1) * (lock.target ? 0.5 : 1) * (partial ? 0.15 : 1);
  d.x += rand(-spr, spr); d.y += rand(-spr, spr); d.z += rand(-spr, spr);
  d.normalize();
  const hit = castShot(o, d, 160, minT);
  const hp = o.clone().addScaledVector(d, hit.t);
  const mp = muzzlePos(new THREE.Vector3());
  fx.tracer(mp, hp);
  const md = hp.clone().sub(mp).normalize();
  fx.muzzle(mp.x, mp.y, mp.z, md.x, md.y, md.z);
  // silencer (Radj-Coup finale): quiet shot, only very close guards hear it
  if (G.silenced) audio.tone(0.08, 900, 300, 0.06, 'triangle'); else audio.shot(W.sound);
  G.lastShot = { x: player.pos.x, z: player.pos.z, t: G.time };
  G.shake = Math.min(1, G.shake + (player.weapon === 2 ? 0.12 : 0.1));
  cam.recoil = (cam.recoil || 0) + (player.weapon === 2 ? 0.012 : 0.02);
  if (hit.kind === 'world' || hit.kind === 'ground') { fx.sparks(hp.x, hp.y, hp.z, 4); fx.dust(hp.x, hp.y, hp.z); }
  else if (hit.kind === 'ped') {
    const p = hit.p;
    const wasCop = p.role === 'cop';
    p.hit(W.dmg * (hp.y - p.pos.y > 1.65 ? 2.5 : 1), G, d.x, d.z, true);
    if (wasCop) crime(1.0, 'Polizist angeschossen');
    else if (p.role !== 'guard') crime(0.2, null, true);
  } else if (hit.kind === 'veh') {
    hit.v.damage(W.dmg * 0.35, G, true);
    fx.sparks(hp.x, hp.y, hp.z, 5);
    if (hit.v.type === 'police') crime(0.6, 'Auf Polizei geschossen');
  }
  // noise scares peds
  for (const p of G.peds) {
    if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 40) p.scare(player.pos.x, player.pos.z, 10);
  }
  for (const v of G.vehicles) if (v.driver instanceof TrafficDriver && Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < 30) v.driver.panic = 8;
  // shooting in public near police
  if (nearestCopDist() < 35) crime(0.2, 'Schüsse gemeldet');
  if (player.ammo[player.weapon] <= 0) setTimeout(startReload, 120);
}
// infinite magazines, but every magazine has to be reloaded
function startReload() {
  const W = WEAPONS[player.weapon];
  if (player.weapon === 0 || player.reloadT > 0 || player.ammo[player.weapon] >= W.mag) return;
  player.reloadT = W.reload;
  player.reloadW = player.weapon;
  audio.reload();
}

// ---------- lock-on ----------
const lock = { target: null, lostT: 0 };
function targetScore(p) {
  // cops first when wanted
  if (p.role === 'guard') return 0.35;
  return p.role === 'cop' ? (G.wanted.stars > 0 ? 0.45 : 0.8) : 1;
}
function findTarget(o, d, cone, range, exclude) {
  let best = null, bs = cone;
  for (const p of G.peds) {
    if (p.dead || p.removed || p === exclude) continue;
    // aim assist only locks onto police and enemies, never onto passers-by
    if (p.role === 'civ' && !p.isTarget) continue;
    _v1.set(p.pos.x, p.pos.y + 1.25, p.pos.z).sub(o);
    const L = _v1.length();
    if (L > range || L < 1) continue;
    _v1.divideScalar(L);
    const a = Math.acos(clamp(_v1.dot(d), -1, 1));
    const sc = a * targetScore(p) + L * 0.0015;
    if (sc < bs && !G.rayBlocked(o.x, o.y, o.z, p.pos.x, p.pos.y + 1.25, p.pos.z)) { bs = sc; best = p; }
  }
  return best;
}
function acquireLock(exclude) {
  const o = new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z);
  const d = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
  // wide cone in front of the camera, then anything nearby
  lock.target = findTarget(o, d, 1.0, 55, exclude) || findTarget(o, d, 3.2, 22, exclude);
  lock.lostT = 0;
  if (lock.target) audio.tone(0.12, 1400, 1800, 0.06, 'square');
}
function updateLock(dt, aiming) {
  if (!aiming || player.weapon === 0 || player.inVehicle) { lock.target = null; return; }
  const t = lock.target;
  if (t) {
    const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
    const blocked = G.rayBlocked(player.pos.x, player.pos.y + 1.6, player.pos.z, t.pos.x, t.pos.y + 1.25, t.pos.z);
    if (blocked) lock.lostT += dt; else lock.lostT = 0;
    if (t.dead || t.removed || d > 65 || lock.lostT > 0.8) {
      // automatically move on to the next target
      lock.target = null;
      acquireLock(t);
    }
  }
}

function nearestCopDist() {
  let d = 1e9;
  const pp = player.inVehicle ? player.inVehicle.pos : player.pos;
  for (const p of G.peds) if (p.role === 'cop' && !p.dead) d = Math.min(d, Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z));
  for (const v of G.vehicles) if (v.type === 'police' && !v.dead) d = Math.min(d, Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z));
  return d;
}

function crime(amount, msg, civ) {
  if (G.noPolice) return; // Radj-Coup missions run without police
  const w = G.wanted;
  const before = w.stars;
  // unseen minor crimes are often not reported
  if (civ && w.level < 1 && nearestCopDist() > 60 && Math.random() < 0.5) return;
  w.level = Math.min(5.5, w.level + amount);
  w.stars = Math.min(5, Math.floor(w.level));
  if (w.stars > before) {
    audio.star();
    if (msg) toast('⭐ ' + msg);
    flashStars();
  }
  w.evadeT = 0;
}
G.onKill = (p) => {
  if (p.role === 'guard') { stats.kills++; return; }
  if (p.role === 'cop') { G.wanted.level = Math.max(G.wanted.level, 1.5); crime(1.0, 'Polizist erledigt'); }
  else {
    G.wanted.level = Math.max(G.wanted.level, 0.45);
    crime(0.6, 'Mord gemeldet');
    if (Math.random() < 0.6) dropMoney(p.pos.x + rand(-0.5, 0.5), p.pos.z + rand(-0.5, 0.5), randi(5, 60));
  }
  stats.kills++;
};

G.copShoot = (cop, d) => {
  if (player.dead) return;
  const pp = player.inVehicle ? player.inVehicle.pos : player.pos;
  const from = new THREE.Vector3();
  cop.h.hand.getWorldPosition(from);
  const to = new THREE.Vector3(pp.x, pp.y + (player.inVehicle ? 1 : 1.3), pp.z);
  if (G.rayBlocked(from.x, from.y, from.z, to.x, to.y, to.z)) return;
  const moving = player.inVehicle ? Math.abs(player.inVehicle.vF) > 8 : player.speed > 3;
  const pHit = clamp(0.5 - d * 0.009 - (moving ? 0.18 : 0), 0.08, 0.6);
  audio.shot('pistol', 0.6 * audio.dist(cop.pos) + 0.1);
  if (Math.random() < pHit) {
    fx.tracer(from, to);
    damagePlayer(rand(5, 9), cop.pos);
  } else {
    to.x += rand(-2, 2); to.y += rand(-0.5, 1.5); to.z += rand(-2, 2);
    fx.tracer(from, to);
    fx.sparks(to.x, to.y, to.z, 2);
  }
  fx.muzzle(from.x, from.y, from.z, (to.x - from.x) / d, 0, (to.z - from.z) / d);
};

function damagePlayer(dmg, from) {
  if (player.dead) return;
  if (player.inVehicle) {
    player.inVehicle.damage(dmg * 0.8, G);
    dmg *= 0.25;
  }
  if (player.armor > 0) {
    const a = Math.min(player.armor, dmg * 0.7);
    player.armor -= a;
    dmg -= a;
  }
  player.hp -= dmg;
  player.hurtT = 0.4;
  audio.hurt();
  if (from) showHitDir(from);
  if (player.hp <= 0) killPlayer();
}

G.explosion = (x, y, z, src) => {
  fx.explosion(x, y, z);
  audio.explode(Math.max(0.25, audio.dist({ x, z })));
  G.shake = Math.min(1.5, G.shake + 1.2 * Math.max(0, 1 - Math.hypot(x - camera.position.x, z - camera.position.z) / 60));
  for (const p of G.peds) {
    const d = Math.hypot(p.pos.x - x, p.pos.z - z);
    if (d < 7 && !p.dead) p.die(G, (p.pos.x - x) * 2, (p.pos.z - z) * 2, 6, src && src.lastAttacker === 'player');
    else if (d < 40) p.scare(x, z, 10);
  }
  for (const v of G.vehicles) {
    if (v === src || v.removed) continue;
    const d = Math.hypot(v.pos.x - x, v.pos.z - z);
    if (d < 8) { v.damage(70 * (1 - d / 8), G); v.vel.x += (v.pos.x - x) * 1.5; v.vel.y += (v.pos.z - z) * 1.5; }
  }
  const pp = player.inVehicle ? player.inVehicle.pos : player.pos;
  const dP = Math.hypot(pp.x - x, pp.z - z);
  if (player.inVehicle === src) {
    damagePlayer(200, null);
  } else if (dP < 8) {
    damagePlayer(80 * (1 - dP / 8), { x, z });
    if (!player.inVehicle) { player.vy = 6; player.knockT = 1.2; }
  }
  if (src && src.wasPlayerCar) crime(0.5, null, true);
};

// ---------- vehicles: enter/exit ----------
function tryEnter() {
  const ctxA = missions.contextHint();
  if (ctxA) { ctxA.run(); return; }
  if (player.inVehicle) return exitVehicle();
  let best = null, bd = 4.2;
  for (const v of G.vehicles) {
    if (v.dead || v.removed || v.burn > 0) continue;
    const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) - v.M.wid * 0.3;
    if (d < bd) { bd = d; best = v; }
  }
  if (!best) return;
  const v = best;
  if (v.driver && v.driver !== 'player') {
    // jack the car
    const f = v.fwd;
    const ex = v.pos.x + f.z * (v.M.wid / 2 + 0.8), ez = v.pos.z - f.x * (v.M.wid / 2 + 0.8);
    if (v.driver instanceof PoliceDriver) {
      crime(2, 'Polizeiwagen geklaut');
      const cop = new Ped(scene, null, ex, ez, 'cop');
      G.peds.push(cop);
    } else {
      const p = new Ped(scene, null, ex, ez);
      p.scare(v.pos.x, v.pos.z, 12);
      G.peds.push(p);
      crime(0.3, null, true);
    }
  } else if (v.type === 'police' && !v.driver) {
    crime(1.5, 'Polizeiwagen geklaut');
  }
  putPlayerIn(v);
}
function enterPlane(f) {
  if (player.inVehicle) exitVehicleForce();
  G.flight = f;
  player.h.root.visible = false;
  f.camYaw = f.h;
  audio.door();
  setControlsMode();
  toast('✈️ GAS = Schub · Lenkrad = Kurven · ▲/▼ = Nase hoch/runter');
}
function leavePlane(crash) {
  const f = G.flight;
  if (!f) return;
  G.flight = null;
  const sx = f.pos.x + Math.cos(f.h) * 4, sz = f.pos.z - Math.sin(f.h) * 4;
  player.pos.set(sx, groundAt(sx, sz, f.pos.y + 1), sz);
  player.vy = 0;
  player.h.root.visible = true;
  audio.engine(false, 0, 0);
  if (crash) { player.hp = Math.min(player.hp, 35); }
  setControlsMode();
}
function putPlayerIn(v) {
  if (player.inVehicle && player.inVehicle !== v) exitVehicleForce();
  v.driver = 'player';
  v.parked = false;
  v.wasPlayerCar = true;
  player.inVehicle = v;
  player.pos.copy(v.pos);
  audio.door();
  if (v.M.bike) {
    player.h.root.visible = true;
    v.tilt.add(player.h.root);
    player.h.root.position.set(0, 0.25, -0.3);
    player.h.root.rotation.set(0, 0, 0);
  } else player.h.root.visible = false;
  cam.lastLook = -10;
  cam.alignT = 0.9;
  toast(`${v.M.bike ? '🏍️' : v.type === 'police' ? '🚓' : '🚗'} ${v.M.name}`);
  setControlsMode();
}
function exitVehicle() {
  const v = player.inVehicle;
  if (!v) return;
  if (Math.abs(v.vF) > 12) return; // too fast
  const f = v.fwd;
  const leftx = f.z, leftz = -f.x; // left of travel
  let ex = v.pos.x + leftx * (v.M.wid / 2 + 0.7), ez = v.pos.z + leftz * (v.M.wid / 2 + 0.7);
  let r = collideCircle(ex, ez, 0.35, v.pos.y + 0.3, 1.6);
  if (r.hit) { ex = v.pos.x - leftx * (v.M.wid / 2 + 0.7); ez = v.pos.z - leftz * (v.M.wid / 2 + 0.7); r = collideCircle(ex, ez, 0.35, v.pos.y + 0.3, 1.6); }
  if (v.M.bike) { scene.add(player.h.root); }
  player.pos.set(r.x, groundAt(r.x, r.z, v.pos.y + 1), r.z);
  player.vy = 0;
  player.yaw = v.h;
  player.h.root.visible = true;
  v.driver = null;
  v.input.throttle = 0; v.input.steer = 0; v.input.handbrake = true;
  v.sirenOn = false;
  if (v.type !== 'police' && v.type !== 'roller') G.lastCar = v;
  player.inVehicle = null;
  audio.door();
  audio.engine(false, 0, 0);
  audio.horn(false);
  setControlsMode();
}

// ---------- player update ----------
const stats = { kills: 0 };
function updatePlayer(dt) {
  if (G.flight) {
    // flying Bilal's plane
    const f = G.flight;
    const pin = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0) + (input.keys.has('r') ? 1 : 0) - (input.keys.has('f') ? 1 : 0);
    const r = f.update(dt, input.steering(), input.throttle(), clamp(pin, -1, 1));
    player.pos.copy(f.pos);
    player.yaw = f.h;
    audio.engine(true, 0.3 + f.thr * 0.7, f.thr);
    if (r === 'crash') {
      G.explosion(f.pos.x, f.pos.y + 1, f.pos.z, null);
      leavePlane(true);
      missions.onPlaneCrash && missions.onPlaneCrash(f);
      return;
    }
    if (input.consume('enter')) {
      if (f.onGround && f.speed < 2.5) leavePlane(false);
      else toast('✈️ Erst landen und anhalten');
    }
    return;
  }
  if (player.dead) {
    player.deadT -= dt;
    animateHuman(player.h, dt, { dead: true });
    if (player.deadT <= 0) respawn();
    return;
  }
  player.fireT -= dt;
  if (player.reloadT > 0) {
    if (player.reloadW !== player.weapon) player.reloadT = 0;
    else {
      player.reloadT -= dt;
      if (player.reloadT <= 0) player.ammo[player.weapon] = WEAPONS[player.weapon].mag;
    }
  }
  if (input.consume('reload')) startReload();
  if (input.consume('enter')) tryEnter();
  if (input.consume('weapon')) switchWeapon(1);
  for (let k = 0; k < 3; k++) if (input.consume('w' + k) && player.has[k]) { player.weapon = k; lock.target = null; }
  if (input.wheel) { switchWeapon(input.wheel > 0 ? 1 : -1); input.wheel = 0; }

  const v = player.inVehicle;
  if (v) {
    let thr = input.throttle();
    // holding BREMSE: first brake to a stop, short pause, then reverse
    if (thr < 0 && v.vF < 0.6) {
      G.revHold = (G.revHold || 0) + dt;
      if (G.revHold < 0.35 && v.vF > -0.3) thr = 0;
    } else if (thr >= 0) G.revHold = 0;
    v.input.throttle = thr;
    v.input.steer = input.steering();
    v.input.handbrake = input.handbrake || input.kbHandbrake;
    const horn = input.horn || input.kbHorn;
    audio.horn(horn);
    if (horn) for (const p of G.peds) if (Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z) < 12 && Math.random() < 0.02) p.scare(v.pos.x, v.pos.z, 3);
    input.consume('jump');
    player.pos.copy(v.pos);
    if (v.M.bike) {
      animateHuman(player.h, dt, { sit: true });
      player.h.legL.rotation.x = -1.0; player.h.legR.rotation.x = -1.0;
      player.h.armL.rotation.x = -1.2; player.h.armR.rotation.x = -1.2;
      player.h.body.rotation.x = 0.35;
      pistolM.visible = akM.visible = false;
    }
    const rpm = (Math.abs(v.vF) % 18) / 18 * 0.6 + Math.min(1, Math.abs(v.vF) / v.M.maxSpeed) * 0.6 + Math.abs(thr) * 0.15;
    audio.engine(!v.dead, rpm, Math.abs(thr));
    if (v.dead) {
      exitVehicleForce();
    }
    // tyre smoke when drifting
    if (v.slip > 4 && Math.random() < 0.6) {
      const f = v.fwd;
      fx.tire(v.pos.x - f.x * v.M.len * 0.4, 0.3, v.pos.z - f.z * v.M.len * 0.4);
    }
    // being run over by player is handled in peds
    return;
  }

  // on foot
  if (input.consume('aimOn') && player.weapon > 0) acquireLock();
  if (input.consume('aimOff')) lock.target = null;
  if (input.consume('nextTarget') && input.aim) acquireLock(lock.target);
  updateLock(dt, input.aim);
  const wantAim = (input.aim || input.shoot) && player.weapon > 0;
  const aimK = wantAim ? 1 : 0;
  cam.aim = damp(cam.aim, aimK, 10, dt);
  const fwdx = Math.sin(cam.yaw), fwdz = Math.cos(cam.yaw);
  const rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
  let mx = fwdx * input.my + rx * input.mx;
  let mz = fwdz * input.my + rz * input.mx;
  const mag = Math.min(1, Math.hypot(mx, mz));
  let sp = 0;
  if (mag > 0.08) {
    const l = Math.hypot(mx, mz);
    mx /= l; mz /= l;
    const run = input.kbSprint || input.sprintToggle || (isTouch && mag > 0.92);
    sp = run && !G.walkMul ? 7.2 : isTouch ? lerp(1.6, 4.4, mag) : 4.4;
    if (G.walkMul) sp *= G.walkMul; // sneaking in Radj's estate
    if (wantAim) sp = Math.min(sp, 3.6);
  }
  if (player.knockT > 0) { player.knockT -= dt; sp = 0; }
  player.speed = damp(player.speed, sp, 10, dt);
  if (wantAim) player.yaw = dampAngle(player.yaw, cam.yaw, 22, dt);
  else if (sp > 0.1) player.yaw = dampAngle(player.yaw, Math.atan2(mx, mz), 12, dt);
  const curMx = mag > 0.08 ? mx : 0, curMz = mag > 0.08 ? mz : 0;
  player.vx = damp(player.vx || 0, curMx * player.speed, 12, dt);
  player.vz = damp(player.vz || 0, curMz * player.speed, 12, dt);
  let nx = player.pos.x + player.vx * dt;
  let nz = player.pos.z + player.vz * dt;
  // jump + gravity
  if (input.consume('jump') && player.grounded) { player.vy = 5.2; player.grounded = false; }
  player.vy -= 16 * dt;
  let ny = player.pos.y + player.vy * dt;
  const r = collideCircle(nx, nz, 0.34, player.pos.y + 0.3, 1.6);
  nx = r.x; nz = r.z;
  // mountains too steep to walk up
  if (!(Math.abs(nx) < WALL_OUT && Math.abs(nz) < WALL_OUT) && slopeAt(nx, nz) > 0.85 && groundAt(nx, nz, player.pos.y + 0.6) > player.pos.y + 0.02) { nx = player.pos.x; nz = player.pos.z; }
  // stand on low objects (benches, fountain rim)
  let floor = groundAt(nx, nz, player.pos.y + 0.6);
  for (const c of query(nx, nz, 1)) {
    if (c.t === 'c' && c.h - (c.y0 || 0) <= 1.3 && c.h <= player.pos.y + 1.3 && c.h > floor && Math.hypot(nx - c.x, nz - c.z) < c.r) floor = c.h;
  }
  if (ny <= floor) {
    ny = floor;
    player.vy = 0;
    player.grounded = true;
  } else if (player.grounded && player.vy <= 0 && ny - floor < 0.7) {
    ny = floor; // walk down slopes and steps without "falling"
    player.vy = 0;
  } else if (ny > floor + 0.05) player.grounded = false;
  // step up curb smoothly
  if (player.grounded && floor > player.pos.y) ny = damp(player.pos.y, floor, 25, dt);
  player.pos.set(nx, ny, nz);
  // vehicle collisions on foot
  for (const v2 of G.vehicles) {
    if (v2.removed) continue;
    const dx = player.pos.x - v2.pos.x, dz = player.pos.z - v2.pos.z;
    if (dx * dx + dz * dz > 20) continue;
    for (const c of v2.circles()) {
      const ddx = player.pos.x - c.x, ddz = player.pos.z - c.z;
      const rr = c.r + 0.34;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < rr * rr && player.pos.y < v2.pos.y + 1.4) {
        const spd = Math.hypot(v2.vel.x, v2.vel.y);
        const d = Math.sqrt(d2) + 1e-4;
        player.pos.x = c.x + (ddx / d) * rr;
        player.pos.z = c.z + (ddz / d) * rr;
        if (spd > 5 && player.knockT <= 0) {
          damagePlayer(spd * 1.6, v2.pos);
          player.vy = 3 + spd * 0.15;
          player.vx = v2.vel.x * 0.8; player.vz = v2.vel.y * 0.8;
          player.knockT = 1.2;
          audio.thud(1);
        }
      }
    }
  }
  // shooting
  if (input.shoot && player.fireT <= 0) {
    const W = WEAPONS[player.weapon];
    player.fireT = player.weapon === 0 ? 0.45 : W.rate;
    if (cam.aim > 0.6 || player.weapon === 0) fire();
  }
  if (player.punchT > 0) player.punchT -= dt;
  // visuals
  pistolM.visible = player.weapon === 1;
  akM.visible = player.weapon === 2;
  const pitch = cam.pitch;
  animateHuman(player.h, dt, { speed: player.speed, grounded: player.grounded, aim: cam.aim, pitch: -pitch * 0.9, twoHand: player.weapon === 2, punch: player.punchT > 0 ? 1 : 0, lean: player.knockT > 0 ? -0.6 : 0 });
  player.h.root.position.copy(player.pos);
  player.h.root.rotation.y = player.yaw;
  if (player.hurtT > 0) player.hurtT -= dt;
  // heal slowly when not hurt
  if (player.hp < 100 && G.wanted.stars === 0) player.hp = Math.min(100, player.hp + dt * (player.hp < 50 ? 1.5 : 0.6));
}
function exitVehicleForce() {
  const v = player.inVehicle;
  if (!v) return;
  const saved = v.vF;
  v.vF = 0;
  v.vel.set(0, 0);
  exitVehicle();
  v.vF = saved;
}
function switchWeapon(dir) {
  let w = player.weapon;
  for (let k = 0; k < 3; k++) {
    w = (w + dir + 3) % 3;
    if (player.has[w]) break;
  }
  player.weapon = w;
  lock.target = null;
  if (input.aim && w > 0) acquireLock();
  audio.click();
}

function killPlayer() {
  if (player.dead) return;
  if (player.inVehicle) exitVehicleForce();
  player.dead = true;
  player.deadT = 4;
  missions.onPlayerDeath();
  player.hp = 0;
  $('dead').classList.add('show');
  input.shoot = false;
}
function respawn() {
  $('dead').classList.remove('show');
  player.dead = false;
  player.hp = 100;
  player.armor = 0;
  const loss = Math.floor(G.money * 0.1);
  if (loss > 0) { G.money -= loss; store.set('dc3d_dollar', String(G.money)); toast(`🏥 Krankenhausrechnung: −${loss.toLocaleString('de-DE')} D$`); }
  const p = world.hospital || world.spawn;
  player.pos.copy(p);
  player.h.body.rotation.set(0, 0, 0);
  player.h.body.position.y = 0;
  G.wanted.level = 0; G.wanted.stars = 0;
  for (const v of G.vehicles) if (v.driver instanceof PoliceDriver) v.driver.mode = 'leave';
  for (const c of G.peds) if (c.role === 'cop') c.remove();
  cam.yaw = 0; player.yaw = 0;
}

// ---------- wanted / police ----------
function updateWanted(dt) {
  const w = G.wanted;
  const pp = player.inVehicle ? player.inVehicle.pos : player.pos;
  const police = G.vehicles.filter((v) => v.driver instanceof PoliceDriver && v.driver.mode !== 'leave');
  if (w.stars > 0) {
    // seen by police?
    let seen = false;
    for (const v of G.vehicles) if (v.type === 'police' && !v.dead && v.driver instanceof PoliceDriver && Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) < 55 && !G.rayBlocked(v.pos.x, 1.5, v.pos.z, pp.x, 1.5, pp.z)) seen = true;
    for (const p of G.peds) if (p.role === 'cop' && !p.dead && Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z) < 45) seen = true;
    if (seen || w.lock) w.evadeT = 0; // locked stars (Docks-Coup) only go away at the hideout
    else w.evadeT += dt;
    const need = 10 + w.stars * 3;
    w.evading = w.evadeT > 1.5;
    w.evadeFrac = clamp(w.evadeT / need, 0, 1);
    if (w.evadeT > need) {
      w.level = 0; w.stars = 0; w.evadeT = 0;
      toast('😎 Polizei abgehängt!');
      for (const v of police) v.driver.mode = 'leave';
    }
    // spawn police cars
    const want = [0, 1, 2, 3, 4, 5][w.stars];
    if (police.length < want && (G._polT = (G._polT || 0) - dt) < 0) {
      G._polT = 4;
      const p = inCity(pp.x, pp.z) ? randomRoadSpawn(70, 150, pp) : randomOutRoadSpawn(80, 200, pp) || randomRoadSpawn(60, 400, pp);
      if (p && !isVisible(p.x, 1, p.z, 5)) {
        const v = new Vehicle(scene, 'police', p.x, p.z, p.h);
        v.driver = new PoliceDriver(v);
        v.sirenOn = true;
        G.vehicles.push(v);
      }
    }
    // parked police re-mount when the player drives away
    for (const v of police) {
      const d = v.driver;
      if (d.mode === 'parked' && (player.inVehicle || Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) > 40)) {
        d.mode = 'chase';
        d.deployed = false;
        // cops near this car get back in
        for (const c of G.peds) if (c.role === 'cop' && c.car === v && !c.dead && Math.hypot(c.pos.x - v.pos.x, c.pos.z - v.pos.z) < 30) c.remove();
      }
    }
  } else {
    w.evading = false;
    for (const v of police) v.driver.mode = 'leave';
  }
  // siren sound
  let sv = 0;
  for (const v of G.vehicles) if (v.sirenOn) sv = Math.max(sv, audio.dist(v.pos));
  audio.siren(sv, G.time);
}

// ---------- camera ----------
const _ct = new THREE.Vector3();
function updateCamera(dt) {
  const [lx, ly] = input.takeLook();
  if (G.flight) { G.flight.camera(camera, dt, lx); cam.yaw = G.flight.camYaw; return; }
  if (lx || ly) cam.lastLook = G.time;
  const lt = lock.target;
  if (lt && !player.inVehicle) {
    // aim assist: the camera follows the locked target, swiping still nudges it a little
    const sx = player.pos.x - Math.cos(cam.yaw) * 0.75, sz = player.pos.z + Math.sin(cam.yaw) * 0.75;
    const dx = lt.pos.x - sx, dz = lt.pos.z - sz;
    const dy = lt.pos.y + 1.25 - (player.pos.y + 1.7);
    const wantYaw = Math.atan2(dx, dz);
    const wantPitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.55, 1.15);
    // swiping (also with the shooting finger) takes the camera back right away
    lock.swipe = (lock.swipe || 0) * Math.exp(-dt * 4) + Math.abs(lx) + Math.abs(ly);
    if (lock.swipe > 0.035) {
      lock.target = null;
      lock.swipe = 0;
      cam.yaw -= lx;
      cam.pitch = clamp(cam.pitch + ly, -0.55, 1.15);
    } else {
      cam.yaw = dampAngle(cam.yaw, wantYaw, 14, dt) - lx;
      cam.pitch = clamp(damp(cam.pitch, wantPitch, 14, dt) + ly, -0.55, 1.15);
    }
  } else {
    cam.yaw -= lx;
    cam.pitch = clamp(cam.pitch + ly, -0.55, 1.15);
  }
  if (input.consume('cam')) { cam.mode = (cam.mode + 1) % 3; toast(['Kamera: Normal', 'Kamera: Weit', 'Kamera: Nah'][cam.mode]); }
  const v = player.inVehicle;
  let tx, ty, tz, dist, fovT;
  if (v) {
    // follow behind the car when not looking around
    const basePitch = v.M.bike ? 0.34 : 0.2;
    if (cam.alignT > 0) { cam.alignT -= dt; cam.yaw = dampAngle(cam.yaw, v.h, 9, dt); cam.pitch = damp(cam.pitch, basePitch, 6, dt); }
    else if (G.time - cam.lastLook > 1.3 && Math.abs(v.vF) > 1.5) {
      const behindYaw = v.vF >= -1 ? v.h : v.h + Math.PI;
      cam.yaw = dampAngle(cam.yaw, behindYaw, 3, dt);
      cam.pitch = damp(cam.pitch, basePitch, 2, dt);
    }
    const base = v.M.bike ? 6.2 : v.type === 'van' ? 8 : 6.6;
    dist = base * [1, 1.35, 0.8][cam.mode];
    tx = v.pos.x; ty = v.pos.y + (v.M.bike ? 2.6 : v.type === 'van' ? 2.3 : 1.7); tz = v.pos.z;
    fovT = 68 + clamp(Math.abs(v.vF) / v.M.maxSpeed, 0, 1) * 16;
  } else {
    const a = cam.aim;
    dist = lerp([4.2, 5.6, 3.2][cam.mode], 2.4, a);
    const sh = lerp(0.45, 0.75, a);
    const rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    tx = player.pos.x + rx * sh; ty = player.pos.y + lerp(1.6, 1.7, a); tz = player.pos.z + rz * sh;
    fovT = lerp(68, 58, a) + (player.speed > 6 ? 4 : 0);
  }
  cam.fov = damp(cam.fov, fovT, 5, dt);
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  const recoil = cam.recoil || 0;
  cam.recoil = damp(recoil, 0, 12, dt);
  const pitch = cam.pitch - recoil;
  const dx = Math.sin(cam.yaw) * Math.cos(pitch), dy = -Math.sin(pitch), dz = Math.cos(cam.yaw) * Math.cos(pitch);
  // collision: march from target to desired
  let d = dist;
  const steps = 14;
  for (let k = 1; k <= steps; k++) {
    const t = (k / steps) * dist;
    const x = tx - dx * t, y = ty - dy * t, z = tz - dz * t;
    if (y < groundAt(x, z, y) + 0.3 || insideBuilding(x, y, z)) { d = Math.max(0.6, t - 0.4); break; }
  }
  cam.d = damp(cam.d || d, d, d < (cam.d || d) ? 30 : 4, dt);
  _ct.set(tx - dx * cam.d, ty - dy * cam.d, tz - dz * cam.d);
  { const gmin = groundAt(_ct.x, _ct.z, _ct.y) + 0.35; if (_ct.y < gmin) _ct.y = gmin; }
  // inside a building with a roof (bank): keep the camera under the ceiling and inside the walls
  for (const it of world.interiors) {
    if (tx > it.x0 && tx < it.x1 && tz > it.z0 && tz < it.z1) {
      _ct.y = Math.min(_ct.y, it.ceil - 0.5);
      _ct.x = clamp(_ct.x, it.x0 + 0.4, it.x1 - 0.4);
      _ct.z = clamp(_ct.z, it.z0 + 0.4, it.z1 - 0.4);
    }
  }
  camera.position.copy(_ct);
  camera.lookAt(tx + dx * 10, ty + dy * 10, tz + dz * 10);
  // shake
  if (G.shake > 0.001) {
    camera.rotation.x += rand(-1, 1) * G.shake * 0.02;
    camera.rotation.y += rand(-1, 1) * G.shake * 0.02;
    G.shake = damp(G.shake, 0, 6, dt);
  }
  audio.listener.x = camera.position.x;
  audio.listener.z = camera.position.z;
}
function insideBuilding(x, y, z) {
  for (const c of query(x, z, 0.4)) {
    if (c.t !== 'b' || c.h - (c.y0 || 0) < 2.5 || c.inv || c.off) continue;
    if (x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3 && y < c.h + 0.3 && y > (c.y0 || 0) - 0.3) return true;
  }
  return false;
}

// ---------- HUD ----------
let toastT = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  toastT = 2.6;
}
function floatMoney(n) {
  const el = document.createElement('div');
  el.className = 'moneyFloat';
  el.textContent = `+${n} D$`;
  $('hud').appendChild(el);
  setTimeout(() => el.remove(), 1400);
}
function flashStars() {
  const el = $('stars');
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
function showHitDir(from) {
  const el = $('hitDir');
  const pp = player.pos;
  const ang = Math.atan2(from.x - pp.x, from.z - pp.z) - cam.yaw;
  el.style.transform = `translate(-50%,-50%) rotate(${-ang}rad)`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
const hudCache = {};
const setText = (id, t) => { if (hudCache[id] !== t) { hudCache[id] = t; $(id).textContent = t; } };
const setHTML = (id, t) => { if (hudCache[id] !== t) { hudCache[id] = t; $(id).innerHTML = t; } };
function setControlsMode() {
  const inCar = !!player.inVehicle || !!G.flight;
  document.body.classList.toggle('incar', inCar);
  document.body.classList.toggle('inplane', !!G.flight);
  input.setCarMode(inCar);
  $('bAim').classList.remove('on');
  lock.target = null;
}
function updateHUD(dt) {
  setText('clock', timeString(G.cycle));
  setText('money', `D$ ${G.money.toLocaleString('de-DE')}`);
  const w = G.wanted;
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="${i <= w.stars ? 'on' : ''}${w.evading && i <= w.stars ? ' blink' : ''}">★</span>`;
  setHTML('stars', s);
  $('hpFill').style.width = Math.max(0, player.hp) + '%';
  $('arFill').style.width = Math.max(0, player.armor) + '%';
  $('hpBar').classList.toggle('low', player.hp < 30);
  const W = WEAPONS[player.weapon];
  setText('wIcon', W.icon);
  setText('wName', W.name);
  setText('wAmmo', player.weapon === 0 ? '' : player.reloadT > 0 ? 'Nachladen…' : `${player.ammo[player.weapon]}`);
  $('bReload').classList.toggle('empty', player.weapon > 0 && player.ammo[player.weapon] < WEAPONS[player.weapon].mag * 0.34);
  const v = player.inVehicle;
  if (G.flight) {
    const f = G.flight;
    setText('spd', String(f.kmh));
    setText('carName', `✈️ Höhe ${Math.round(f.alt)} m · Gas ${Math.round(f.thr * 100)} %`);
    $('carHp').style.width = '100%';
  } else if (v) {
    setText('spd', String(Math.round(Math.abs(v.vF) * 3.6)));
    setText('carName', v.M.name);
    $('carHp').style.width = Math.max(0, v.health) + '%';
  }
  const cr = $('cross');
  cr.classList.toggle('hide', !!v || player.dead);
  cr.classList.toggle('gun', player.weapon > 0);
  cr.classList.toggle('aim', cam.aim > 0.5);
  cr.classList.toggle('lock', !!lock.target);
  $('bAim').classList.toggle('on', input.aimToggle);
  // marker over the locked target
  const lm = $('lockMark');
  if (lock.target && !v) {
    _v3.set(lock.target.pos.x, lock.target.pos.y + 1.2, lock.target.pos.z).project(camera);
    if (_v3.z < 1) {
      lm.style.left = ((_v3.x + 1) / 2) * window.innerWidth + 'px';
      lm.style.top = ((1 - _v3.y) / 2) * window.innerHeight + 'px';
      lm.classList.add('show');
    } else lm.classList.remove('show');
  } else lm.classList.remove('show');
  // waypoint distance + arrival
  const wpEl = $('wpInfo');
  if (G.waypoint.pos) {
    const pp = G.focusPos();
    const d = Math.hypot(G.waypoint.pos.x - pp.x, G.waypoint.pos.z - pp.z);
    if (d < 9) { G.waypoint.clear(); toast('📍 Ziel erreicht'); audio.pickup(); }
    setText('wpInfo', `📍 ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`);
    wpEl.classList.add('show');
  } else wpEl.classList.remove('show');
  // area name when entering a new region
  const an = areaName(G.focusPos().x, G.focusPos().z);
  if (an !== G.lastArea && an !== 'Brücke' && an !== 'Wasser') {
    if (G.lastArea) { const el = $('areaName'); el.textContent = an.toUpperCase(); el.classList.add('show'); G.areaT = 3; }
    G.lastArea = an;
  }
  if (G.areaT > 0) { G.areaT -= dt; if (G.areaT <= 0) $('areaName').classList.remove('show'); }
  $('vign').style.opacity = player.hurtT > 0 ? 0.8 : player.hp < 30 ? 0.35 + Math.sin(G.time * 5) * 0.15 : 0;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  // enter hint
  let hint = '';
  const ca = !player.dead ? missions.contextHint() : null;
  if (ca) hint = `${isTouch ? (v ? 'START' : 'EIN') : 'F'} – ${ca.text}`;
  else if (!v && !player.dead) {
    for (const o of G.vehicles) {
      if (o.dead || o.removed) continue;
      if (Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) - o.M.wid * 0.3 < 4.2) { hint = `${isTouch ? 'EIN' : 'F'} – ${o.M.name}${o.driver ? ' klauen' : ''}`; break; }
    }
  }
  setText('hint', hint);
  setText('bExit', v && ca ? 'START' : 'RAUS');
  $('hint').classList.toggle('show', !!hint);
}

// ---------- minimap + big map ----------
buildMapCanvas();
const mini = $('mini');
const mctx = mini.getContext('2d');
G.focusPos = () => (player.inVehicle ? player.inVehicle.pos : player.pos);
G.waypoint = new Waypoint(scene);
const bigMap = new BigMap(G, () => { G.paused = false; last = performance.now(); G.routeT = 0; });
function openMap() {
  if (!G.started || G.paused) return;
  G.paused = true;
  input.shoot = false; input.gas = input.brake = false;
  audio.engine(false, 0, 0); audio.siren(0, 0); audio.horn(false);
  if (document.exitPointerLock) document.exitPointerLock();
  bigMap.open();
}
$('miniWrap').addEventListener('click', openMap);
$('miniWrap').addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); openMap(); }, { passive: false });
$('miniWrap').addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
function drawMini() {
  const pp = G.focusPos();
  const v = player.inVehicle;
  const meters = v ? lerp(150, 260, clamp(Math.abs(v.vF) / 40, 0, 1)) : inCity(pp.x, pp.z) ? 130 : 200;
  G.miniZoom = damp(G.miniZoom || meters, meters, 2, 1 / 30);
  drawMinimap(mctx, mini.width, G, cam, pp, v ? v.h : player.yaw, G.miniZoom);
}

// fell into the water somehow (explosion etc.) -> back to the hideout
let waterT = 0;
function checkWater(dt) {
  const pp = G.focusPos();
  if (player.dead || G.flight || isLand(pp.x, pp.z)) { waterT = 0; return; }
  waterT += dt;
  if (waterT > 0.6) {
    waterT = 0;
    if (player.inVehicle) exitVehicleForce();
    const p = world.hideout || world.spawn;
    player.pos.copy(p);
    player.vy = 0;
    toast('🌊 Ins Wasser gefallen – zurück im Versteck');
  }
}

// ---------- day/night extras ----------
const roofBlink = { t: 0 };
function updateAmbient(dt) {
  roofBlink.t += dt;
  world.roofLightMesh.material.color.setRGB(Math.sin(roofBlink.t * 3) > 0.6 ? 3 : 0.25, 0.05, 0.05);
  if (world.marquee) {
    const n = world.marquee.count;
    const c = new THREE.Color();
    const k = Math.floor(G.time * 8);
    for (let i = 0; i < n; i++) { c.set((i + k) % 3 === 0 ? '#fff6b0' : '#a07a10'); world.marquee.setColorAt(i, c); }
    world.marquee.instanceColor.needsUpdate = true;
  }
  if (world.water) {
    const nm = world.water.material.normalMap;
    nm.offset.x = (G.time * 0.004) % 1;
    nm.offset.y = (G.time * 0.0025) % 1;
  }
  // player car headlights at night
  const v = player.inVehicle;
  const night = sky.n2 || 0;
  if (v && !v.dead && night > 0.05) {
    const f = v.fwd;
    headL.intensity = 260 * night;
    headL.position.set(v.pos.x + f.x * v.M.len * 0.45, v.pos.y + 0.9, v.pos.z + f.z * v.M.len * 0.45);
    headL.target.position.set(v.pos.x + f.x * 25, v.pos.y - 1.5, v.pos.z + f.z * 25);
  } else headL.intensity = 0;
  // vehicle lights brightness (brake lights)
  const fp = G.focusPos();
  for (const o of G.vehicles) {
    // detailed cars: only nearby ones cast shadows (saves a lot of GPU time on phones)
    const md = Math.abs(o.pos.x - fp.x) + Math.abs(o.pos.z - fp.z);
    const near = md < 55;
    if (o.body && o.body.castShadow !== near) { o.body.castShadow = near; for (const w of o.wheels) w.w.castShadow = false; }
    // far away: swap the detailed model for a tiny low-poly box (huge saving with many cars)
    if (o.proxy) {
      const far = md > Q.lod && o !== player.inVehicle;
      if (o.proxy.visible !== far) {
        o.proxy.visible = far;
        o.body.visible = !far;
        if (o.lights) o.lights.visible = !far;
        for (const w of o.wheels) w.w.visible = !far;
      }
    }
    if (o.dead) continue;
    const b = 0.9 + night * 1.6 + o.brakeLight * 1.4;
    o.lights.material.color.setScalar(b);
  }
}

// ---------- pause / start ----------
function setPaused(p) {
  G.paused = p;
  $('pause').classList.toggle('show', p && G.started);
  if (p) { audio.engine(false, 0, 0); audio.siren(0, 0); audio.horn(false); if (document.exitPointerLock) document.exitPointerLock(); }
}
$('startBtn').addEventListener('click', start);
$('startBtn').addEventListener('touchend', (e) => { e.preventDefault(); start(); });
function start() {
  if (G.started) return;
  G.started = true;
  audio.start();
  $('start').classList.add('hide');
  setTimeout(() => ($('start').style.display = 'none'), 600);
  G.paused = false;
  input.enabled = true;
  if (!isTouch) lockPointer();
  toast(isTouch ? 'Minikarte antippen = große Karte' : 'Klick = Maus fangen · M = Karte');
}
const qBtns = document.querySelectorAll('[data-q]');
const markQ = () => qBtns.forEach((b) => b.classList.toggle('sel', b.dataset.q === qName));
markQ();
qBtns.forEach((b) => b.addEventListener('click', () => { qName = b.dataset.q; applyQuality(); markQ(); }));
$('resume').addEventListener('click', () => setPaused(false));

// ---------- shop + exchange (pause menu) ----------
const fmtN = (n) => Math.round(n).toLocaleString('de-DE');
const RATE = 10; // 10 D$ = 1 Bit
function openShop(tab) {
  G.shopTab = tab;
  $('pause').classList.remove('show');
  $('shop').classList.add('show');
  renderShop();
}
function closeShop() {
  $('shop').classList.remove('show');
  if (G.started) $('pause').classList.add('show');
}
function renderShop() {
  const tab = G.shopTab;
  $('shopTitle').textContent = tab === 'shop' ? '🛒 DILDI SHOP' : '💱 WECHSELSTUBE';
  let h = `<div class="wal"><div><small>Dildi-Dollar</small><b style="color:#3bff6a">D$ ${fmtN(G.money)}</b></div><div><small>Deine Bits${casino.linked ? '' : ' (Test)'}</small><b style="color:#ffd23b">◆ ${fmtN(casino.bits())}</b></div></div>`;
  if (tab === 'shop') {
    const items = [
      ['vest', '🦺', 'Schutzweste', 'Volle Panzerung (100)', 1500, player.armor >= 100 ? 'Schon voll' : ''],
      ['heal', '🩹', 'Erste-Hilfe-Kasten', 'Volle Gesundheit', 500, player.hp >= 100 ? 'Schon voll' : ''],
      ['ak', '🪖', 'AK-47', 'Für immer freigeschaltet', 8000, player.has[2] ? 'Gekauft' : ''],
    ];
    h += '<div class="shopGrid">' + items.map(([k, ic, n, d, pr, off]) => `<button class="gcar" data-buy="${k}" ${off ? 'disabled style="opacity:.45"' : ''}><div class="gi">${ic}</div><div class="gn">${n}</div><div class="gs">${d}</div><div class="gs" style="opacity:1;color:#3bff6a;font-weight:900">${off || fmtN(pr) + ' D$'}</div></button>`).join('') + '</div>';
  } else {
    h += `<p class="sub">Kurs: <b>10 D$ = 1 Bit</b> – in beide Richtungen.${casino.linked ? '' : '<br><span style="color:#ff8a8a">Nur im Casino werden echte Bits getauscht – hier läuft ein Test-Konto.</span>'}</p>`;
    h += '<div class="xrow"><b>Bits → D$</b><div class="cbs">' + [100, 1000, 5000, 25000].map((b) => `<button class="cb" data-x="in" data-v="${b}" ${casino.bits() < b ? 'disabled style="opacity:.4"' : ''}>◆ ${fmtN(b)}<small>→ D$ ${fmtN(b * RATE)}</small></button>`).join('') + '</div></div>';
    h += '<div class="xrow"><b>D$ → Bits</b><div class="cbs">' + [1000, 10000, 50000, 250000].map((d) => `<button class="cb" data-x="out" data-v="${d}" ${G.money < d ? 'disabled style="opacity:.4"' : ''}>D$ ${fmtN(d)}<small>→ ◆ ${fmtN(d / RATE)}</small></button>`).join('') + '</div></div>';
  }
  const body = $('shopBody');
  body.innerHTML = h;
  body.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buyItem(b.dataset.buy)));
  body.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => exchange(b.dataset.x, +b.dataset.v)));
}
function buyItem(k) {
  const price = { vest: 1500, heal: 500, ak: 8000 }[k];
  if (G.money < price) { toast(`💸 Zu wenig Geld (${fmtN(price)} D$)`); return; }
  if (k === 'vest') { if (G.noVest) { toast('🦺 Im Finale gibt es keine Weste'); return; } if (player.armor >= 100) return; player.armor = 100; }
  else if (k === 'heal') { if (player.hp >= 100) return; player.hp = 100; }
  else if (k === 'ak') { if (player.has[2]) return; player.has[2] = true; store.set('dc3d_ak', '1'); }
  addMoney(-price);
  audio.pickup();
  toast({ vest: '🦺 Schutzweste angezogen', heal: '🩹 Wieder fit', ak: '🪖 AK-47 gekauft – mit 🔄 wechseln' }[k]);
  renderShop();
}
function exchange(dir, v) {
  if (dir === 'in') {
    if (!casino.addBits(-v)) { toast('Zu wenig Bits'); return; }
    addMoney(v * RATE);
  } else {
    if (G.money < v) { toast('Zu wenig D$'); return; }
    addMoney(-v);
    casino.addBits(v / RATE);
  }
  audio.tone(0.2, 700, 1300, 0.12, 'triangle');
  renderShop();
}
$('shopBtn').addEventListener('click', () => openShop('shop'));
$('xchgBtn').addEventListener('click', () => openShop('x'));
$('shopClose').addEventListener('click', closeShop);
if (casino.linked) {
  $('casinoBtn').style.display = '';
  $('casinoBtn').addEventListener('click', () => {
    if (G.wanted.stars > 0) { toast('🚨 Erst die Polizei abhängen!'); return; }
    if (missions.busy()) { toast('Erst den Auftrag beenden oder abbrechen'); return; }
    store.set('dc3d_dollar', String(G.money));
    casino.exit();
  });
}
$('muteBtn').addEventListener('click', () => { audio.setMuted(!audio.muted); $('muteBtn').textContent = audio.muted ? '🔇 Ton aus' : '🔊 Ton an'; });
$('sens').addEventListener('input', (e) => { input.sens = parseFloat(e.target.value); store.set('dc3d_sens', e.target.value); });
const savedSens = store.get('dc3d_sens');
if (savedSens) { input.sens = parseFloat(savedSens); $('sens').value = savedSens; }
$('helpTxt').innerHTML = isTouch
  ? '<b>Zu Fuß:</b> linker Daumen laufen (ganz drücken = rennen) · rechts wischen = Kamera · 🎯 ZIELEN an/aus · 💥 SCHIESSEN halten (dabei wischen = Kamera) · EIN = einsteigen / Aktion<br><b>Im Auto:</b> Lenkrad drehen · GAS / BREMSE (stehend = rückwärts) · Handbremse zum Driften · RAUS / START<br><b>Flugzeug:</b> GAS = Schub · Lenkrad = Kurven · ▲/▼ = Nase hoch/runter<br><b>Karte:</b> Minikarte antippen → Markierung setzen · ⏸ Menü: Shop &amp; Wechselstube'
  : '<b>Zu Fuß:</b> WASD · Maus umsehen · Shift rennen · Leertaste springen · Rechtsklick halten = zielen (aufschalten, Tab = nächstes Ziel) · Linksklick schießen · Q/1-3 Waffe · F einsteigen<br><b>Im Auto:</b> W Gas · S Bremse/rückwärts · A/D lenken · Leertaste Handbremse · H Hupe · F aussteigen · C Kamera<br><b>Karte:</b> M oder Minikarte anklicken → Markierung setzen'
document.addEventListener('visibilitychange', () => { if (document.hidden && G.started) setPaused(true); });

// ---------- missions (garages, Flaschenpost, bank) ----------
function banner(title, sub) {
  const el = $('banner');
  $('bannerT').textContent = title;
  $('bannerS').textContent = sub || '';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => el.classList.remove('show'), 3600);
}
const missions = new Missions(G, scene, {
  toast,
  banner,
  addMoney,
  putPlayerInVehicle: (v) => putPlayerIn(v),
  enterPlane: (f) => enterPlane(f),
  leavePlane: () => leavePlane(false),
  refreshControls: () => setControlsMode(),
  playerPos: () => G.focusPos(),
  setStars: (n, msg) => {
    G.wanted.level = n ? n + 0.3 : 0;
    G.wanted.stars = n;
    G.wanted.evadeT = 0;
    if (n) { audio.star(); flashStars(); if (msg) toast('⭐ ' + msg); }
    else for (const v of G.vehicles) if (v.driver instanceof PoliceDriver) v.driver.mode = 'leave';
  },
});
G.missions = missions;
$('abortBtn').addEventListener('click', () => { missions.abort(); setPaused(false); });

// ---------- initial population ----------
for (let i = 0; i < Q.traffic; i++) spawnTraffic(true);
for (let i = 0; i < Q.peds; i++) spawnPed(true);
setControlsMode();

// ---------- main loop ----------
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsCheckT = 0, autoChecked = false;
let mapT = 0, spawnT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  if (input.consume('pause') && G.started) { if (bigMap.isOpen) bigMap.close(); else setPaused(!G.paused); }
  if (input.consume('mute')) audio.setMuted(!audio.muted);
  if (input.consume('map')) { if (bigMap.isOpen) bigMap.close(); else openMap(); }
  if (!G.paused) simStep(dt);
  if (!G.freeCam) updateCamera(G.paused ? 0 : dt);
  render(dt);
}
function simStep(dt) {
  {
    input.poll();
    G.time += dt;
    // day & night run on their own, tied to the real clock (same time for everybody)
    G.cycle = ((Date.now() / 1000) / DAY_LEN) % 1;
    updatePlayer(dt);
    for (const v of G.vehicles) {
      if (v.removed) continue;
      if (v.driver && v.driver !== 'player') v.driver.update(dt, G);
      else if (v.driver !== 'player') { v.input.throttle = 0; v.input.steer = 0; v.input.handbrake = true; }
      v.update(dt, G);
    }
    collideVehicles(G.vehicles, G);
    for (const p of G.peds) if (!p.removed) p.update(dt, G);
    updateWanted(dt);
    updatePickups(dt);
    checkWater(dt);
    missions.update(dt);
    // GPS routes (recomputed every second)
    G.routeT = (G.routeT || 0) - dt;
    if (G.routeT <= 0) {
      G.routeT = 1;
      const pp = G.focusPos();
      const wp = G.waypoint.pos, mt = G.missionTarget;
      G.routeWp = wp ? findRoute(pp.x, pp.z, wp.x, wp.z) : null;
      G.routeMt = mt ? findRoute(pp.x, pp.z, mt.x, mt.z) : null;
    }
    G.waypoint.update(G.time);
    spawnT -= dt;
    if (spawnT < 0) { spawnT = 0.5; manageSpawns(); }
    updateLights(G.time);
    fx.update(dt);
    updateAmbient(dt);
  }
}
G.step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { simStep(dt); updateCamera(dt); } };
G.input = input;
G.tryEnter = () => tryEnter();
G.world = world;
G.findRoute = findRoute;
G.renderer = renderer;
G.camera = camera;
G.groundAt = groundAt;
function render(dt) {
  const focus = player.inVehicle ? player.inVehicle.pos : player.pos;
  updateSky(sky, G.cycle, focus, dt, Q);
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_pm);
  // cull far humans
  for (const p of G.peds) p.h.root.visible = Math.hypot(p.pos.x - camera.position.x, p.pos.z - camera.position.z) < 130;
  if (!G.paused) updateHUD(dt);
  mapT -= dt;
  if (mapT <= 0) { mapT = 1 / 30; drawMini(); }
  online.update(dt);
  renderer.render(scene, camera);
  // auto quality: if the device struggles on "hoch", drop once
  if (G.started && !G.paused) {
    fpsAcc += dt; fpsN++;
    fpsCheckT += dt;
    if (fpsCheckT > 4) {
      const fps = fpsN / fpsAcc;
      fpsAcc = 0; fpsN = 0; fpsCheckT = 0;
      // dynamic resolution: render fewer pixels when the device struggles, more when it has headroom
      const cur = renderer.getPixelRatio();
      if (fps < 32 && cur > 0.7) { renderer.setPixelRatio(Math.max(0.7, cur - 0.15)); resize(); }
      else if (fps > 52 && cur < Q.pr) { renderer.setPixelRatio(Math.min(Q.pr, cur + 0.1)); resize(); }
      // still too slow at low resolution: step the quality down (unless chosen by hand)
      if (fps < 24 && renderer.getPixelRatio() <= 0.75 && !store.get('dc3d_qmanual')) {
        if (qName === 'hoch') { qName = 'mittel'; applyQuality(); markQ(); toast('Grafik automatisch auf MITTEL gestellt (flüssiger)'); }
        else if (qName === 'mittel') { qName = 'niedrig'; applyQuality(); markQ(); toast('Grafik automatisch auf NIEDRIG gestellt (flüssiger)'); }
      }
    }
  }
}
qBtns.forEach((b) => b.addEventListener('click', () => store.set('dc3d_qmanual', '1')));
const online = new Online({ scene, camera, player, G, toast, pause: (p) => setPaused(p) });
G.online = online;
requestAnimationFrame(loop);
// minimap canvas resolution
{
  const s = Math.round(150 * Math.min(2, window.devicePixelRatio || 1));
  mini.width = mini.height = s;
}
$('loading').style.display = 'none';
