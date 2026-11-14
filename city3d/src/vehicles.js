import * as THREE from 'three';
import './dildi_cars.js';
const DC = globalThis.DildiCars;
import { cbox, ccyl, merge, clamp, lerp, damp, angleWrap, rand, pick, colorize } from './util.js';
import { collideCircle, groundY, groundAt } from './world.js';
import { slopeAt } from './geo.js';

export const vehMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55 });
const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

export const MODELS = {
  skoda: { name: 'Skoda Octavia', len: 4.7, wid: 1.82, maxSpeed: 14.2, accel: 6, brake: 18, grip: 7.5, turn: 2.0, mass: 1.3, colors: ['#2e7d32', '#ecf0f1', '#1f3a5f', '#7f8c8d', '#111111', '#a93226'] },
  rs6: { name: 'Audi RS6', len: 5.0, wid: 1.95, maxSpeed: 35.5, accel: 11, brake: 24, grip: 8.5, turn: 2.0, mass: 1.6, colors: ['#8e9397', '#111111', '#1a2b4c', '#e8e8e8'] },
  van: { name: 'VW Transporter', len: 5.1, wid: 1.95, maxSpeed: 22.6, accel: 6, brake: 18, grip: 6.5, turn: 1.7, mass: 2.0, colors: ['#f5f5f5', '#c0392b', '#2471a3', '#f1c40f', '#7f8c8d'] },
  bike: { name: "Julians Motorrad", len: 2.1, wid: 0.75, maxSpeed: 40, accel: 14, brake: 24, grip: 9, turn: 1.75, mass: 0.35, colors: ['#e74c3c'], bike: true },
  ferrari: { name: 'Ferrari', len: 4.6, wid: 1.98, maxSpeed: 60, accel: 18, brake: 30, grip: 9.5, turn: 2.0, mass: 1.4, colors: ['#d40000', '#ffd700', '#111111'] },
  roller: { name: 'Pizza-Roller', len: 1.8, wid: 0.7, maxSpeed: 9.8, accel: 4, brake: 14, grip: 8.5, turn: 1.7, mass: 0.3, colors: ['#c0392b'], bike: true },
  police: { name: 'Polizei-Skoda', len: 4.7, wid: 1.82, maxSpeed: 36, accel: 11, brake: 24, grip: 8.5, turn: 2.2, mass: 1.5, colors: ['#e8eef5'], police: true },
  bus: { name: 'Dildi Bus', len: 10.5, wid: 2.5, maxSpeed: 16, accel: 4, brake: 14, grip: 6, turn: 1.3, mass: 3.5, colors: ['#d81e2a', '#f4c20d', '#1f5fa8'] },
  truck: { name: 'LKW', len: 7.3, wid: 2.45, maxSpeed: 19, accel: 4.5, brake: 14, grip: 6, turn: 1.4, mass: 3, colors: ['#1f5fa8', '#c0392b', '#f5f5f5'] },
  jeep: { name: 'Schmuggler-Jeep', len: 4.3, wid: 1.9, maxSpeed: 23, accel: 8, brake: 20, grip: 8, turn: 2.0, mass: 1.7, colors: ['#5b6b3a'] },
  taxi: { name: 'Dildi Taxi', len: 4.7, wid: 1.82, maxSpeed: 17.5, accel: 7, brake: 20, grip: 7.5, turn: 2.0, mass: 1.3, colors: ['#f4c20d'], taxi: true },
};

function wheelGeo(r, w) {
  const g = [];
  g.push(ccyl(r, r, w, 14, 0, 0, 0, '#151515', 0, 0, Math.PI / 2));
  g.push(ccyl(r * 0.62, r * 0.62, w + 0.02, 10, 0, 0, 0, '#9aa0a6', 0, 0, Math.PI / 2));
  g.push(cbox(w + 0.04, r * 0.18, r * 1.1, 0, 0, 0, '#5c6166'));
  return merge(g);
}

function extrudeProfile(pts, width, color, bevel = 0.06) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  const w = width - bevel * 2;
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(w / 2, 0, 0);
  geo.deleteAttribute('uv');
  colorize(geo, color);
  return geo;
}

const PROFILES = {
  sedan: {
    body: [[-2.35, 0.36], [2.35, 0.36], [2.36, 0.62], [2.24, 0.8], [1.05, 0.93], [-1.6, 0.97], [-2.28, 0.92], [-2.36, 0.68]],
    glass: [[1.0, 0.92], [0.12, 1.4], [-1.02, 1.4], [-1.62, 0.96]],
    roof: [-0.98, 0.1], roofY: 1.4,
  },
  sport: {
    body: [[-2.25, 0.3], [2.3, 0.3], [2.36, 0.48], [2.2, 0.6], [0.95, 0.76], [-1.85, 0.86], [-2.28, 0.8]],
    glass: [[0.9, 0.75], [0.0, 1.12], [-0.85, 1.1], [-1.62, 0.84]],
    roof: [-0.8, 0.0], roofY: 1.1,
  },
  wagon: {
    body: [[-2.48, 0.34], [2.48, 0.34], [2.5, 0.6], [2.38, 0.77], [1.15, 0.9], [-2.4, 0.95], [-2.5, 0.72]],
    glass: [[1.12, 0.89], [0.22, 1.36], [-2.05, 1.35], [-2.4, 0.94]],
    roof: [-2.0, 0.2], roofY: 1.35,
  },
};

function buildCar(type, color, tune) {
  const M = MODELS[type];
  const g = [], L = [];
  const glass = '#16212c';
  const dark = '#151515';
  const W = M.wid, Ln = M.len;
  let wheelR = 0.34, wheelY = 0.34, wx = W / 2 - 0.08, wz = Ln / 2 - 0.85;
  // tuning parts (spoiler / armour) – shared by old and new car models
  const tg = [];
  if (tune && !MODELS[type].bike) {
    const top = type === 'van' ? 2.15 : type === 'rs6' ? 1.4 : type === 'ferrari' ? 1.1 : 1.45;
    if (tune.spoiler) {
      const sh = [0, 0.18, 0.32, 0.46][tune.spoiler];
      const rz = -Ln / 2 + (type === 'van' ? 0.2 : 0.45);
      const ry = { van: 1.98, rs6: 1.12, ferrari: 0.86, skoda: 1.06 }[type] || 0.95;
      tg.push(cbox(W - 0.1, 0.06, 0.45 + tune.spoiler * 0.08, 0, ry + sh, rz, tune.spoiler === 3 ? '#111' : color));
      for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) tg.push(cbox(0.07, sh + 0.04, 0.16, x, ry + sh / 2, rz, '#111'));
    }
    // armour stays (more health, see below) but is invisible – the plates looked like they were floating
  }
  // new detailed models (dildi_cars.js) for the main car types
  if (DC && DC.types.includes(type)) {
    const m = DC.dildiCityVehicle(THREE, type, color, { body: vehMat, lights: lightMat.clone(), wheel: wheelMat }, tg);
    // low-poly stand-in for cars far away
    const pg = [cbox(W, 0.62, Ln, 0, 0.62, 0, color), cbox(W * 0.86, type === 'van' ? 0.95 : 0.5, Ln * (type === 'van' ? 0.8 : 0.48), 0, type === 'van' ? 1.35 : 1.15, type === 'van' ? -0.2 : -0.15, '#1a1f26')];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pg.push(cbox(0.3, 0.6, 0.6, sx * (W / 2 - 0.12), 0.3, sz * (Ln / 2 - 0.85), '#111'));
    m.proxy = new THREE.Mesh(merge(pg), vehMat);
    m.proxy.visible = false;
    m.tilt.add(m.proxy);
    return m;
  }

  if (type === 'van') {
    const body = [[-2.55, 0.4], [2.55, 0.4], [2.56, 0.98], [2.44, 1.18], [1.9, 1.4], [1.55, 2.05], [1.35, 2.15], [-2.48, 2.15], [-2.56, 2.0]];
    g.push(extrudeProfile(body, W, color, 0.07));
    // windshield + side window band
    g.push(cbox(W - 0.18, 0.62, 0.06, 0, 1.73, 1.74, glass, 0, -0.62));
    g.push(cbox(W + 0.02, 0.48, 3.2, 0, 1.72, -0.3, glass));
    g.push(cbox(W + 0.03, 0.06, Ln - 0.4, 0, 1.38, 0, '#202020'));
    g.push(cbox(W + 0.02, 0.22, Ln + 0.02, 0, 0.48, 0, dark));
    g.push(cbox(W - 0.5, 0.34, 0.05, 0, 0.95, Ln / 2 + 0.01, dark));
    g.push(cbox(0.2, 0.1, 0.12, -W / 2 - 0.06, 1.55, 1.65, dark));
    g.push(cbox(0.2, 0.1, 0.12, W / 2 + 0.06, 1.55, 1.65, dark));
    L.push(cbox(0.38, 0.18, 0.05, -W / 2 + 0.32, 1.12, Ln / 2 - 0.02, '#fffbe8'));
    L.push(cbox(0.38, 0.18, 0.05, W / 2 - 0.32, 1.12, Ln / 2 - 0.02, '#fffbe8'));
    L.push(cbox(0.18, 0.55, 0.05, -W / 2 + 0.14, 1.25, -Ln / 2 - 0.02, '#ff1a1a'));
    L.push(cbox(0.18, 0.55, 0.05, W / 2 - 0.14, 1.25, -Ln / 2 - 0.02, '#ff1a1a'));
    wheelR = 0.37; wheelY = 0.37;
  } else if (type === 'jeep') {
    // open off-roader: boxy tub, roll bar, spare wheel, crate in the back
    g.push(cbox(W, 0.55, Ln - 0.3, 0, 0.85, 0, color));
    g.push(cbox(W - 0.1, 0.35, 1.3, 0, 1.25, Ln / 2 - 0.85, color)); // bonnet
    g.push(cbox(W + 0.1, 0.12, Ln - 0.1, 0, 0.6, 0, dark));
    g.push(cbox(W - 0.2, 0.55, 0.06, 0, 1.68, 0.55, glass, -0.0, -0.25)); // windscreen
    for (const sx of [-1, 1]) {
      g.push(cbox(0.08, 0.9, 0.08, sx * (W / 2 - 0.12), 1.55, -0.45, '#222'));
      g.push(cbox(0.4, 0.26, 1.0, sx * (W / 2 + 0.05), 0.62, Ln / 2 - 0.85, dark)); // fenders
      g.push(cbox(0.4, 0.26, 1.0, sx * (W / 2 + 0.05), 0.62, -Ln / 2 + 0.85, dark));
    }
    g.push(cbox(W - 0.16, 0.08, 0.08, 0, 2.0, -0.45, '#222'));
    g.push(cbox(0.9, 0.6, 0.7, 0, 1.4, -1.3, '#7a5a30')); // drill crate
    g.push(ccyl(0.36, 0.36, 0.2, 12, 0, 1.05, -Ln / 2 - 0.12, '#111', Math.PI / 2));
    g.push(cbox(W - 0.5, 0.3, 0.06, 0, 0.95, Ln / 2 + 0.01, '#111'));
    L.push(ccyl(0.12, 0.12, 0.06, 10, -W / 2 + 0.35, 1.15, Ln / 2 + 0.02, '#fffbe8', Math.PI / 2));
    L.push(ccyl(0.12, 0.12, 0.06, 10, W / 2 - 0.35, 1.15, Ln / 2 + 0.02, '#fffbe8', Math.PI / 2));
    L.push(cbox(0.16, 0.12, 0.05, -W / 2 + 0.2, 0.95, -Ln / 2 - 0.02, '#ff1a1a'));
    L.push(cbox(0.16, 0.12, 0.05, W / 2 - 0.2, 0.95, -Ln / 2 - 0.02, '#ff1a1a'));
    wheelR = 0.44; wheelY = 0.44; wz = Ln / 2 - 0.85;
  } else if (type === 'roller') {
    g.push(cbox(0.36, 0.12, 1.2, 0, 0.42, 0, '#222'));
    g.push(cbox(0.42, 0.5, 0.55, 0, 0.62, -0.35, color)); // rear body
    g.push(cbox(0.4, 0.14, 0.6, 0, 0.92, -0.3, '#1a1a1a')); // seat
    g.push(cbox(0.4, 0.7, 0.16, 0, 0.78, 0.48, color, 0, -0.25)); // leg shield
    g.push(cbox(0.08, 0.6, 0.08, 0, 0.95, 0.6, '#999', 0, -0.25)); // steering column
    g.push(cbox(0.6, 0.06, 0.06, 0, 1.25, 0.66, '#333'));
    g.push(cbox(0.32, 0.18, 0.2, 0, 1.18, 0.7, color));
    g.push(cbox(0.56, 0.5, 0.56, 0, 1.28, -0.62, '#d8261c')); // pizza box
    g.push(cbox(0.58, 0.12, 0.58, 0, 1.56, -0.62, '#ffffff'));
    L.push(cbox(0.14, 0.1, 0.04, 0, 1.18, 0.81, '#fffbe8'));
    L.push(cbox(0.14, 0.06, 0.04, 0, 0.78, -0.64, '#ff1a1a'));
    wheelR = 0.24; wheelY = 0.24; wx = 0; wz = 0.55;
  } else if (type === 'bike') {
    g.push(cbox(0.22, 0.25, 1.1, 0, 0.62, 0, '#222'));
    g.push(cbox(0.42, 0.38, 0.7, 0, 0.82, 0.35, color));
    g.push(cbox(0.36, 0.42, 0.4, 0, 0.95, 0.78, color, 0, 0.5));
    g.push(cbox(0.3, 0.12, 0.6, 0, 0.92, -0.3, '#111'));
    g.push(cbox(0.25, 0.18, 0.5, 0, 0.98, -0.7, color, 0, 0.25));
    g.push(cbox(0.3, 0.2, 0.06, 0, 1.2, 0.95, glass, 0, 0.6));
    g.push(cbox(0.7, 0.05, 0.05, 0, 1.12, 0.62, '#333'));
    g.push(cbox(0.06, 0.6, 0.06, 0, 0.68, 0.82, '#888', 0, 0.35));
    g.push(cbox(0.12, 0.12, 0.5, 0.18, 0.45, -0.45, '#999'));
    g.push(cbox(0.42, 0.04, 0.5, 0, 1.04, 0.25, '#ffffff'));
    L.push(cbox(0.18, 0.12, 0.05, 0, 0.98, 1.02, '#fffbe8'));
    L.push(cbox(0.14, 0.06, 0.04, 0, 1.0, -0.96, '#ff1a1a'));
    wheelR = 0.33; wheelY = 0.33; wx = 0; wz = 0.72;
  } else {
    const wagon = type === 'rs6';
    const sport = type === 'ferrari';
    const P = PROFILES[wagon ? 'wagon' : sport ? 'sport' : 'sedan'];
    g.push(extrudeProfile(P.body, W, color, 0.07));
    g.push(extrudeProfile(P.glass, W - 0.2, glass, 0.05));
    // roof panel + pillars in body color
    g.push(cbox(W - 0.3, 0.05, P.roof[1] - P.roof[0], 0, P.roofY + 0.04, (P.roof[0] + P.roof[1]) / 2, color));
    g.push(cbox(W - 0.16, 0.42, 0.1, 0, P.roofY - 0.22, wagon ? -0.35 : -0.2, color));
    // dark lower skirt, bumpers, grille
    g.push(cbox(W + 0.02, 0.16, Ln - 2.3, 0, 0.44, 0, dark));
    g.push(cbox(W + 0.04, 0.2, 0.14, 0, 0.42, Ln / 2 - 0.02, dark));
    g.push(cbox(W + 0.04, 0.2, 0.14, 0, 0.42, -Ln / 2 + 0.02, dark));
    g.push(cbox(wagon ? 1.1 : 0.85, wagon ? 0.32 : 0.22, 0.06, 0, wagon ? 0.6 : 0.66, Ln / 2 + 0.01, wagon ? '#0a0a0a' : '#262626'));
    // mirrors + handles
    g.push(cbox(0.18, 0.11, 0.13, -W / 2 - 0.06, 1.05, 0.85, color));
    g.push(cbox(0.18, 0.11, 0.13, W / 2 + 0.06, 1.05, 0.85, color));
    for (const z of [0.2, -0.9]) {
      g.push(cbox(W + 0.02, 0.04, 0.2, 0, 0.88, z, '#2a2a2a'));
    }
    if (wagon) {
      g.push(cbox(0.06, 0.05, 2.0, -W / 2 + 0.22, P.roofY + 0.09, -0.85, '#111'));
      g.push(cbox(0.06, 0.05, 2.0, W / 2 - 0.22, P.roofY + 0.09, -0.85, '#111'));
      g.push(ccyl(0.07, 0.07, 0.12, 8, -0.55, 0.42, -Ln / 2 - 0.06, '#9a9a9a', Math.PI / 2));
      g.push(ccyl(0.07, 0.07, 0.12, 8, -0.75, 0.42, -Ln / 2 - 0.06, '#9a9a9a', Math.PI / 2));
      g.push(ccyl(0.07, 0.07, 0.12, 8, 0.55, 0.42, -Ln / 2 - 0.06, '#9a9a9a', Math.PI / 2));
      g.push(ccyl(0.07, 0.07, 0.12, 8, 0.75, 0.42, -Ln / 2 - 0.06, '#9a9a9a', Math.PI / 2));
      // four rings
      for (let k = 0; k < 4; k++) g.push(ccyl(0.06, 0.06, 0.02, 10, -0.15 + k * 0.1, 0.66, Ln / 2 + 0.05, '#cfcfcf', Math.PI / 2));
    }
    const fy = wagon ? 0.7 : 0.72;
    L.push(cbox(0.46, 0.1, 0.06, -W / 2 + 0.34, fy, Ln / 2 - 0.02, '#fffbe8', 0, 0.1));
    L.push(cbox(0.46, 0.1, 0.06, W / 2 - 0.34, fy, Ln / 2 - 0.02, '#fffbe8', 0, 0.1));
    L.push(cbox(0.42, 0.1, 0.06, -W / 2 + 0.3, 0.8, -Ln / 2 + 0.02, '#ff1a1a'));
    L.push(cbox(0.42, 0.1, 0.06, W / 2 - 0.3, 0.8, -Ln / 2 + 0.02, '#ff1a1a'));
    if (wagon) L.push(cbox(W - 0.6, 0.035, 0.06, 0, 0.8, -Ln / 2 + 0.02, '#ff1a1a'));
    if (type === 'police') {
      g.push(cbox(W + 0.03, 0.2, Ln - 1.6, 0, 0.66, 0, '#1f4fa8'));
      g.push(cbox(W + 0.035, 0.04, Ln - 1.6, 0, 0.78, 0, '#c9d400'));
      g.push(cbox(1.1, 0.1, 0.3, 0, P.roofY + 0.1, -0.4, '#222'));
      g.push(cbox(0.9, 0.06, 1.2, 0, 0.99, 1.65, '#1f4fa8', 0, 0.1));
    }
    if (sport) {
      g.push(cbox(0.4, 0.28, 1.0, -W / 2 - 0.02, 0.6, -0.9, '#111')); // side intakes
      g.push(cbox(0.4, 0.28, 1.0, W / 2 + 0.02, 0.6, -0.9, '#111'));
      g.push(cbox(W - 0.1, 0.06, 0.5, 0, 1.08, -Ln / 2 + 0.3, color)); // rear wing
      g.push(cbox(0.08, 0.26, 0.2, -0.6, 0.94, -Ln / 2 + 0.3, '#111'));
      g.push(cbox(0.08, 0.26, 0.2, 0.6, 0.94, -Ln / 2 + 0.3, '#111'));
      g.push(cbox(0.9, 0.12, 0.08, 0, 0.46, Ln / 2 + 0.02, '#111'));
      g.push(cbox(0.36, 0.36, 0.06, 0, 0.92, Ln / 2 - 1.2, '#ffd700', 0, -0.3)); // badge
      for (const x of [-0.35, -0.15, 0.15, 0.35]) g.push(ccyl(0.07, 0.07, 0.12, 8, x, 0.4, -Ln / 2 - 0.05, '#9a9a9a', Math.PI / 2));
    }
    if (type === 'taxi') {
      g.push(cbox(0.62, 0.18, 0.28, 0, P.roofY + 0.14, -0.45, '#ffffff'));
      g.push(cbox(W + 0.03, 0.08, Ln - 1.8, 0, 0.7, 0, '#111'));
    }
    if (wagon) { wheelR = 0.37; wheelY = 0.37; }
  }
  g.push(...tg);
  const body = new THREE.Mesh(merge(g), vehMat);
  body.castShadow = true;
  const lights = new THREE.Mesh(merge(L), lightMat.clone());
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.add(body, lights);
  group.add(tilt);
  const wg = wheelGeo(wheelR, type === 'bike' || type === 'roller' ? 0.14 : 0.26);
  const wheels = [];
  const wpos = type === 'bike' || type === 'roller' ? [[0, wz], [0, -wz]] : [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]];
  for (const [x, z] of wpos) {
    const piv = new THREE.Group();
    piv.position.set(x, wheelY, z);
    const w = new THREE.Mesh(wg, wheelMat);
    w.castShadow = true;
    piv.add(w);
    (type === 'bike' || type === 'roller' ? tilt : group).add(piv);
    wheels.push({ piv, w, front: z > 0 });
  }
  let siren = null;
  if (type === 'police') {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.26), new THREE.MeshBasicMaterial({ color: '#ff0000', toneMapped: false }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.26), new THREE.MeshBasicMaterial({ color: '#0044ff', toneMapped: false }));
    red.position.set(-0.3, 1.58, -0.4);
    blue.position.set(0.3, 1.58, -0.4);
    tilt.add(red, blue);
    siren = { red, blue };
  }
  return { group, tilt, body, lights, wheels, wheelR, siren };
}

let VID = 0;
let _neonTex = null;
const NEON_TEX = () => {
  if (_neonTex) return _neonTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _neonTex = new THREE.CanvasTexture(c);
  return _neonTex;
};
export class Vehicle {
  constructor(scene, type, x, z, h, color, tune) {
    this.id = VID++;
    this.type = type;
    this.M = MODELS[type];
    this.tune = tune || null;
    if (tune) {
      // performance from tuning (spoiler = faster, armour = tougher but slower)
      const M = (this.M = { ...MODELS[type] });
      const sp = tune.spoiler || 0, ar = tune.armor || 0;
      M.maxSpeed *= (1 + 0.07 * sp) * (1 - 0.03 * ar);
      M.accel *= (1 + 0.08 * sp) * (1 - 0.04 * ar);
      M.grip += sp * 0.5;
      M.mass *= 1 + 0.15 * ar;
    }
    this.color = (tune && tune.col) || color || pick(this.M.colors);
    const m = buildCar(type, this.color, tune);
    Object.assign(this, m);
    this.scene = scene;
    scene.add(this.group);
    this.pos = new THREE.Vector3(x, groundAt(x, z, 1e9), z);
    this.vy = 0;
    this.air = false;
    this.gPitch = 0;
    this.gRoll = 0;
    this.h = h;
    this.vel = new THREE.Vector2(0, 0); // world x,z
    this.vF = 0;
    this.vL = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.input = { throttle: 0, steer: 0, handbrake: false };
    this.driver = null; // 'player' | ai object
    this.health = 100 * (1 + 0.4 * ((tune && tune.armor) || 0));
    this.maxHealth = this.health;
    this.dead = false;
    this.burn = 0;
    this.pitch = 0;
    this.roll = 0;
    this.wheelSpin = 0;
    this.radius = this.M.len / 2;
    this.lastHitT = 0;
    this.brakeLight = 0;
    this.smokeT = 0;
    this.sirenOn = false;
    this.horn = 0;
    this.y = this.pos.y;
    if (tune && tune.low && !this.M.bike) this.tilt.position.y = -0.08;
    if (tune && tune.neon) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(this.M.wid + 1.2, this.M.len + 1.2), new THREE.MeshBasicMaterial({ color: tune.neon, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, map: NEON_TEX(), toneMapped: false }));
      n.rotation.x = -Math.PI / 2;
      n.position.y = 0.06;
      this.group.add(n);
      this.neon = n;
    }
    this.sync();
  }
  get fwd() { return { x: Math.sin(this.h), z: Math.cos(this.h) }; }
  get speed() { return this.vF; }
  circles() {
    // two collision circles along the body
    const f = this.fwd;
    const off = this.M.bike ? 0.45 : this.M.len / 2 - this.M.wid / 2;
    const r = this.M.bike ? 0.45 : this.M.wid / 2 + 0.05;
    return [
      { x: this.pos.x + f.x * off, z: this.pos.z + f.z * off, r },
      { x: this.pos.x - f.x * off, z: this.pos.z - f.z * off, r },
      { x: this.pos.x, z: this.pos.z, r },
    ];
  }
  update(dt, G) {
    const M = this.M;
    const inp = this.dead ? { throttle: 0, steer: 0, handbrake: true } : this.input;
    const f = this.fwd;
    const rx = -f.z, rz = f.x; // right vector
    // decompose velocity
    let vF = this.vel.x * f.x + this.vel.y * f.z;
    let vL = this.vel.x * rx + this.vel.y * rz;
    const thr = this.air ? 0 : inp.throttle;
    let braking = false;
    // gravity along the slope
    if (!this.air) vF -= 9.8 * Math.sin(this.gPitch) * dt * 0.75;
    if (thr > 0.05) {
      if (vF < -0.5) { vF += M.brake * thr * dt; braking = true; }
      else vF += M.accel * thr * dt * (1 - clamp(vF / M.maxSpeed, 0, 1) ** 2);
    } else if (thr < -0.05) {
      if (vF > 0.5) { vF -= M.brake * -thr * dt; braking = true; }
      else vF = Math.max(vF + M.accel * 0.5 * thr * dt, -Math.min(M.maxSpeed * 0.22, 11));
    } else {
      vF -= vF * 0.35 * dt + Math.sign(vF) * Math.min(Math.abs(vF), 1.2 * dt);
    }
    if (inp.handbrake) { vF -= Math.sign(vF) * Math.min(Math.abs(vF), 9 * dt); braking = true; }
    this.brakeLight = braking ? 1 : 0;
    // air drag
    vF -= vF * Math.abs(vF) * 0.0009 * dt;
    // steering
    const steerTarget = inp.steer;
    this.steer = damp(this.steer, steerTarget, M.bike ? 4.5 : 8, dt);
    const sp = Math.abs(vF);
    const steerScale = 1 / (1 + sp * 0.035);
    const dir = vF >= 0 ? 1 : -1;
    const turnFactor = clamp(sp / 6, 0, 1);
    let yawTarget = -this.steer * M.turn * turnFactor * steerScale * dir * 1.4;
    if (inp.handbrake && sp > 8) yawTarget *= 1.6;
    this.yawRate = damp(this.yawRate, yawTarget, M.bike ? 10 : 7, dt);
    this.h += this.yawRate * dt;
    // lateral grip (drift with handbrake)
    const grip = inp.handbrake ? 1.4 : M.grip;
    vL *= Math.exp(-grip * dt);
    this.slip = Math.abs(vL);
    // recompose with new heading
    const nf = this.fwd;
    const nrx = -nf.z, nrz = nf.x;
    this.vel.set(nf.x * vF + nrx * vL, nf.z * vF + nrz * vL);
    this.vF = vF;
    this.vL = vL;
    this.accelF = (vF - (this._lastVF || 0)) / Math.max(dt, 1e-4);
    this._lastVF = vF;
    // integrate
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    // collisions vs world
    this.collideWorld(G);
    // ground: terrain, sidewalks and elevated roads
    let gy = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6);
    // too steep (mountain side): push back
    if (!this.air && gy > this.pos.y + 0.05 && Math.abs(this.pos.x) > 240 && slopeAt(this.pos.x, this.pos.z) > 0.62) {
      this.pos.x = ox; this.pos.z = oz;
      this.vel.multiplyScalar(-0.25);
      this.vF *= -0.25;
      this._lastVF = this.vF;
      gy = groundAt(ox, oz, this.pos.y + 0.6);
      if (Math.abs(this.vF) > 6) this.onImpact(Math.abs(this.vF), G);
    } else if (!this.air && gy > this.pos.y + 0.05 && Math.abs(this.pos.z) > 240 && slopeAt(this.pos.x, this.pos.z) > 0.62) {
      this.pos.x = ox; this.pos.z = oz;
      this.vel.multiplyScalar(-0.25);
      this.vF *= -0.25;
      this._lastVF = this.vF;
      gy = groundAt(ox, oz, this.pos.y + 0.6);
    }
    if (this.pos.y > gy + 0.08) {
      // airborne (crest jump, falling off)
      if (!this.air) { this.air = true; this.vy = this.groundVy || 0; }
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gy) {
        if (this.vy < -9) this.onImpact(-this.vy * 0.8, G);
        this.pos.y = gy;
        this.vy = 0;
        this.air = false;
        this.pitch += 0.05;
      }
      this.groundVy = 0;
    } else {
      const dy = gy - this.pos.y;
      this.groundVy = dt > 0 ? clamp(dy / dt, -30, 30) : 0;
      this.pos.y = gy;
      this.air = false;
    }
    this.y = this.pos.y;
    // terrain tilt
    if (!this.air) {
      const fl = M.len * 0.4, wl = M.wid * 0.45;
      const ry = this.pos.y + 0.6;
      const hf = groundAt(this.pos.x + nf.x * fl, this.pos.z + nf.z * fl, ry), hb = groundAt(this.pos.x - nf.x * fl, this.pos.z - nf.z * fl, ry);
      const hl = groundAt(this.pos.x - nrx * wl, this.pos.z - nrz * wl, ry), hr = groundAt(this.pos.x + nrx * wl, this.pos.z + nrz * wl, ry);
      this.gPitch = damp(this.gPitch, clamp(Math.atan2(hf - hb, fl * 2), -0.42, 0.42), 12, dt);
      this.gRoll = M.bike ? 0 : damp(this.gRoll, clamp(Math.atan2(hl - hr, wl * 2), -0.35, 0.35), 12, dt);
    }
    // visuals
    this.pitch = damp(this.pitch, clamp(-this.accelF * 0.004, -0.06, 0.06), 6, dt);
    if (M.bike) this.roll = damp(this.roll, clamp(this.yawRate * sp * 0.045, -0.75, 0.75), 8, dt);
    else this.roll = damp(this.roll, clamp(this.yawRate * sp * 0.006, -0.07, 0.07), 6, dt);
    this.wheelSpin += (vF / this.wheelR) * dt;
    // damage effects
    if (!this.dead && this.health <= 0) this.explodeSoon(G);
    if (this.burn > 0) {
      this.burn -= dt;
      if (Math.random() < dt * 40) G.fx.fire(this.pos.x + rand(-0.6, 0.6), this.pos.y + 1, this.pos.z + rand(-0.6, 0.6));
      if (this.burn <= 0 && !this.dead) this.explode(G);
    }
    if (this.dead) {
      this.smokeT -= dt;
      if (this.smokeT < 0) { this.smokeT = 0.15; G.fx.smoke(this.pos.x, this.pos.y + 1.2, this.pos.z, 0.25); }
    } else if (this.health < 35) {
      this.smokeT -= dt;
      if (this.smokeT < 0) { this.smokeT = 0.12; G.fx.smoke(this.pos.x + f.x * this.M.len * 0.35, this.pos.y + 1.1, this.pos.z + f.z * this.M.len * 0.35, 0.18); }
    }
    this.sync(G);
  }
  collideWorld(G) {
    const cs = this.circles();
    let hitN = null;
    for (const c of cs) {
      const r = collideCircle(c.x, c.z, c.r, this.pos.y + 0.25, 1.4);
      if (r.hit) {
        this.pos.x += r.x - c.x;
        this.pos.z += r.z - c.z;
        hitN = { x: r.nx, z: r.nz };
      }
    }
    if (hitN) {
      const vn = this.vel.x * hitN.x + this.vel.y * hitN.z;
      if (vn < 0) {
        this.vel.x -= vn * hitN.x * 1.35;
        this.vel.y -= vn * hitN.z * 1.35;
        const imp = -vn;
        if (imp > 4) this.onImpact(imp, G);
        // lose speed along heading too
        this.vel.multiplyScalar(0.92);
        const f = this.fwd;
        this._lastVF = this.vel.x * f.x + this.vel.y * f.z;
      }
    }
  }
  onImpact(imp, G) {
    const now = G.time;
    if (now - this.lastHitT < 0.25) return;
    this.lastHitT = now;
    this.damage(Math.max(0, imp - 5) * 1.6, G);
    if (G.audio && this.driver === 'player') G.audio.crash(Math.min(1, imp / 25));
    else if (G.audio) G.audio.crash(Math.min(1, imp / 25) * G.audio.dist(this.pos));
    if (this.driver === 'player') G.shake = Math.min(1, G.shake + imp / 30);
    if (imp > 10) G.fx.sparks(this.pos.x + this.fwd.x * this.M.len / 2, this.pos.y + 0.6, this.pos.z + this.fwd.z * this.M.len / 2, 8);
  }
  damage(d, G, byPlayer) {
    if (this.dead) return;
    this.health -= d;
    if (byPlayer) this.lastAttacker = 'player';
    if (byPlayer &&this.driver && this.driver !== 'player' && this.driver.onAttacked) this.driver.onAttacked(G);
    if (this.health <= 0 && this.burn <= 0) this.explodeSoon(G);
  }
  explodeSoon() {
    if (this.burn > 0 || this.dead) return;
    this.health = 0;
    this.burn = 3.5;
  }
  explode(G) {
    this.dead = true;
    this.burn = 0;
    G.explosion(this.pos.x, this.pos.y + 0.8, this.pos.z, this);
    // burnt look
    const col = this.body.geometry.attributes.color;
    for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * 0.12 + 0.04, col.getY(i) * 0.12 + 0.035, col.getZ(i) * 0.12 + 0.03);
    col.needsUpdate = true;
    this.body.geometry = this.body.geometry; // keep
    this.lights.visible = false;
    this.vel.multiplyScalar(0.3);
    this.vel.x += rand(-2, 2);
    this.vel.y += rand(-2, 2);
  }
  sync(G) {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.h;
    this.group.rotation.order = 'YXZ';
    this.group.rotation.x = -this.gPitch;
    this.group.rotation.z = this.gRoll;
    this.tilt.rotation.x = this.pitch;
    this.tilt.rotation.z = this.M.bike ? -this.roll : this.roll;
    for (const w of this.wheels) {
      w.w.rotation.x = this.wheelSpin;
      if (w.front) w.piv.rotation.y = -this.steer * 0.5;
    }
    // light intensity: brake lights brighter
    if (this.siren && G) {
      const on = this.sirenOn;
      const t = G.time * 8;
      this.siren.red.material.color.setScalar(0).setRGB(on && Math.sin(t) > 0 ? 3 : 0.3, 0, 0);
      this.siren.blue.material.color.setRGB(0, 0.1, on && Math.sin(t) <= 0 ? 3 : 0.3);
    }
  }
  remove() {
    this.scene.remove(this.group);
    this.removed = true;
  }
}

// vehicle vs vehicle push
export function collideVehicles(list, G) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.removed) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.removed) continue;
      const dx0 = b.pos.x - a.pos.x, dz0 = b.pos.z - a.pos.z;
      if (dx0 * dx0 + dz0 * dz0 > 49 || Math.abs(a.pos.y - b.pos.y) > 2.2) continue;
      const ca = a.circles(), cb = b.circles();
      let best = null;
      for (const p of ca)
        for (const q of cb) {
          const dx = q.x - p.x, dz = q.z - p.z;
          const rr = p.r + q.r;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const pen = rr - d;
            if (!best || pen > best.pen) best = { nx: dx / d, nz: dz / d, pen };
          }
        }
      if (!best) continue;
      const ma = a.M.mass, mb = b.M.mass;
      const ta = mb / (ma + mb), tb = ma / (ma + mb);
      a.pos.x -= best.nx * best.pen * ta;
      a.pos.z -= best.nz * best.pen * ta;
      b.pos.x += best.nx * best.pen * tb;
      b.pos.z += best.nz * best.pen * tb;
      const rv = (b.vel.x - a.vel.x) * best.nx + (b.vel.y - a.vel.y) * best.nz;
      if (rv < 0) {
        const jimp = (-1.3 * rv) / (1 / ma + 1 / mb);
        a.vel.x -= (jimp / ma) * best.nx;
        a.vel.y -= (jimp / ma) * best.nz;
        b.vel.x += (jimp / mb) * best.nx;
        b.vel.y += (jimp / mb) * best.nz;
        const imp = -rv;
        if (imp > 5) {
          a.onImpact(imp, G);
          b.onImpact(imp, G);
          const pd = a.driver === 'player' || b.driver === 'player';
          if (pd) {
            const other = a.driver === 'player' ? b : a;
            if (other.driver && other.driver.onAttacked && imp > 8) other.driver.onAttacked(G, true);
          }
        }
      }
    }
  }
}
