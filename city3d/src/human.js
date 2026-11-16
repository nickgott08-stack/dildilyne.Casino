import * as THREE from 'three';
import { cbox, merge, pick, rand, lerp, damp, colorize, place } from './util.js';

export const humanMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

const SKINS = ['#f1c7a5', '#e0ac85', '#c68a62', '#8d5a3b', '#f5d3b8', '#a86f4c'];
const HAIR = ['#2b1d14', '#5a3a22', '#111111', '#c9a25b', '#7a4a2a', '#d8d0c0', '#3b2a1a'];
const SHIRTS = ['#c0392b', '#2471a3', '#27ae60', '#f1c40f', '#8e44ad', '#ecf0f1', '#2c3e50', '#e67e22', '#16a085', '#7f8c8d', '#d35400', '#1abc9c', '#fd79a8'];
const PANTS = ['#2c3e50', '#1f2a36', '#5d4e3c', '#34495e', '#222222', '#4a5568', '#6b5b45'];

export function randomLook() {
  return { skin: pick(SKINS), hair: pick(HAIR), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(['#111', '#eee', '#5a3a22', '#333']), hairStyle: Math.floor(rand(0, 4)) };
}
export const nickLook = { skin: '#f1c7a5', hair: '#3b2a1a', shirt: '#1d1d24', pants: '#2c3e66', shoes: '#f2f2f2', hairStyle: 1, hoodie: '#ff3df0' };
export const copLook = { skin: '#e0ac85', hair: '#222', shirt: '#2a4a8a', pants: '#1c2a44', shoes: '#111', hairStyle: 0, cap: '#1c2a44', cop: true };

// builds a blocky humanoid. Parts pivot correctly for animation.
// look.round → the rounder figure with knees/elbows (only used in the Radj finale)
export function makeHuman(look) {
  if (look.round) return makeRoundHuman(look);
  const root = new THREE.Group();
  const body = new THREE.Group(); // tilts for falls
  root.add(body);
  // torso + head
  const t = [];
  t.push(cbox(0.5, 0.62, 0.28, 0, 1.33, 0, look.shirt));
  t.push(cbox(0.48, 0.14, 0.27, 0, 0.98, 0, look.pants)); // hips
  if (look.hoodie) {
    t.push(cbox(0.52, 0.06, 0.3, 0, 1.18, 0, look.hoodie));
    t.push(cbox(0.3, 0.1, 0.05, 0, 1.45, 0.15, look.hoodie));
  }
  if (look.cop) {
    t.push(cbox(0.52, 0.08, 0.3, 0, 1.06, 0, '#111')); // belt
    t.push(cbox(0.12, 0.08, 0.02, 0.14, 1.5, 0.15, '#d4af37')); // badge
  }
  t.push(cbox(0.14, 0.1, 0.14, 0, 1.68, 0, look.skin)); // neck
  t.push(cbox(0.34, 0.36, 0.32, 0, 1.9, 0, look.skin)); // head
  // face
  t.push(cbox(0.06, 0.06, 0.02, -0.08, 1.93, 0.165, '#1a1a1a'));
  t.push(cbox(0.06, 0.06, 0.02, 0.08, 1.93, 0.165, '#1a1a1a'));
  t.push(cbox(0.12, 0.03, 0.02, 0, 1.8, 0.165, '#8a4a3a'));
  // hair
  if (look.cap) {
    t.push(cbox(0.37, 0.12, 0.36, 0, 2.12, 0, look.cap));
    t.push(cbox(0.3, 0.04, 0.16, 0, 2.07, 0.22, look.cap));
  } else if (look.hairStyle === 0) {
    t.push(cbox(0.36, 0.08, 0.34, 0, 2.11, 0, look.hair));
  } else if (look.hairStyle === 1) {
    t.push(cbox(0.37, 0.14, 0.35, 0, 2.12, -0.01, look.hair));
    t.push(cbox(0.37, 0.22, 0.08, 0, 1.98, -0.14, look.hair));
  } else if (look.hairStyle === 2) {
    t.push(cbox(0.38, 0.12, 0.36, 0, 2.12, 0, look.hair));
    t.push(cbox(0.38, 0.4, 0.1, 0, 1.86, -0.15, look.hair));
  }
  const torso = new THREE.Mesh(merge(t), humanMat);
  torso.castShadow = true;
  body.add(torso);

  const limb = (w, h, d, colTop, colBot, botH) => {
    const g = [];
    g.push(cbox(w, h - botH, d, 0, -(h - botH) / 2, 0, colTop));
    g.push(cbox(w * 1.02, botH, d * 1.02, 0, -h + botH / 2, 0, colBot));
    const m = new THREE.Mesh(merge(g), humanMat);
    m.castShadow = true;
    const pivot = new THREE.Group();
    pivot.add(m);
    return pivot;
  };
  const armL = limb(0.15, 0.62, 0.16, look.shirt, look.skin, 0.16);
  const armR = limb(0.15, 0.62, 0.16, look.shirt, look.skin, 0.16);
  armL.position.set(-0.33, 1.6, 0);
  armR.position.set(0.33, 1.6, 0);
  const legL = limb(0.2, 0.92, 0.22, look.pants, look.shoes, 0.12);
  const legR = limb(0.2, 0.92, 0.22, look.pants, look.shoes, 0.12);
  legL.position.set(-0.13, 0.92, 0);
  legR.position.set(0.13, 0.92, 0);
  body.add(armL, armR, legL, legR);
  // hand anchor for weapons
  const hand = new THREE.Group();
  hand.position.set(0, -0.58, 0.02);
  armR.add(hand);
  return { root, body, torso, armL, armR, legL, legR, hand, phase: rand(0, 6), look };
}

// ---------- rounder figure (Radj finale: player + guards) ----------
// same interface as makeHuman (root/body/torso/arm*/leg*/hand) plus knee*/elbow* sub-pivots
const sph = (r, x, y, z, color, sx = 1, sy = 1, sz = 1, ws = 10, hs = 7) => place(colorize(new THREE.SphereGeometry(r, ws, hs), color), x, y, z, 0, 0, 0, sx, sy, sz);
const cap = (r, len, x, y, z, color, rx = 0, rz = 0, sx = 1, sz = 1) => place(colorize(new THREE.CapsuleGeometry(r, len, 3, 9), color), x, y, z, rx, 0, rz, sx, 1, sz);
const cyl = (rt, rb, h, x, y, z, color, seg = 10, sx = 1, sz = 1) => place(colorize(new THREE.CylinderGeometry(rt, rb, h, seg), color), x, y, z, 0, 0, 0, sx, 1, sz);
const halfSph = (r, x, y, z, color, sx = 1, sy = 1, sz = 1) => place(colorize(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color), x, y, z, 0, 0, 0, sx, sy, sz);

function makeRoundHuman(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const t = [];
  // torso: a slightly tapered oval, chest wider than the waist
  t.push(place(colorize(new THREE.CapsuleGeometry(0.19, 0.3, 4, 12), look.shirt), 0, 1.36, 0, 0, 0, 0, 1.28, 1, 0.78));
  t.push(sph(0.1, -0.24, 1.57, 0, look.shirt, 1, 0.85, 1)); // shoulders
  t.push(sph(0.1, 0.24, 1.57, 0, look.shirt, 1, 0.85, 1));
  t.push(cap(0.125, 0.2, 0, 0.99, 0, look.pants, 0, Math.PI / 2, 1, 0.95)); // hips
  if (look.vest) { // tactical vest
    t.push(place(colorize(new THREE.CapsuleGeometry(0.2, 0.2, 3, 12), look.vest), 0, 1.38, 0.005, 0, 0, 0, 1.3, 1, 0.82));
    t.push(cbox(0.1, 0.12, 0.05, -0.1, 1.3, 0.165, look.vest));
    t.push(cbox(0.1, 0.12, 0.05, 0.1, 1.3, 0.165, look.vest));
    t.push(cyl(0.012, 0.012, 0.22, -0.14, 1.66, 0.09, '#111', 5)); // radio cable
  }
  if (look.hoodie) {
    t.push(cyl(0.255, 0.25, 0.08, 0, 1.12, 0, look.hoodie, 14, 1, 0.66)); // waistband
    t.push(sph(0.13, 0, 1.68, -0.11, look.hoodie, 1.35, 0.5, 0.65)); // hood lying behind the neck
    t.push(cbox(0.02, 0.16, 0.02, -0.05, 1.55, 0.155, '#f2f2f2'));
    t.push(cbox(0.02, 0.16, 0.02, 0.05, 1.55, 0.155, '#f2f2f2'));
    t.push(cbox(0.22, 0.12, 0.04, 0, 1.25, 0.155, look.hoodie)); // pocket
  }
  if (look.cop) {
    t.push(cyl(0.26, 0.26, 0.07, 0, 1.06, 0, '#111', 14, 1, 0.68)); // belt
    t.push(cbox(0.08, 0.06, 0.03, 0.12, 1.06, 0.17, '#3a3a3a'));
    t.push(cbox(0.07, 0.05, 0.02, 0.12, 1.5, 0.17, '#d4af37')); // badge
  }
  t.push(cyl(0.065, 0.075, 0.14, 0, 1.71, 0, look.skin, 8)); // neck
  // head: egg shape, face details
  t.push(sph(0.165, 0, 1.9, 0, look.skin, 0.95, 1.12, 1, 14, 10));
  t.push(sph(0.03, 0, 1.885, 0.16, look.skin, 0.8, 1, 1, 6, 5)); // nose
  t.push(sph(0.035, -0.158, 1.9, 0, look.skin, 0.5, 1, 0.8, 6, 5)); // ears
  t.push(sph(0.035, 0.158, 1.9, 0, look.skin, 0.5, 1, 0.8, 6, 5));
  t.push(sph(0.022, -0.06, 1.93, 0.143, '#1a1a1a', 1, 1, 0.5, 6, 4)); // eyes
  t.push(sph(0.022, 0.06, 1.93, 0.143, '#1a1a1a', 1, 1, 0.5, 6, 4));
  t.push(cbox(0.07, 0.015, 0.02, -0.06, 1.97, 0.145, look.hair)); // brows
  t.push(cbox(0.07, 0.015, 0.02, 0.06, 1.97, 0.145, look.hair));
  t.push(cap(0.012, 0.06, 0, 1.82, 0.148, '#8a4a3a', 0, Math.PI / 2)); // mouth
  // hair / cap
  if (look.cap) {
    t.push(halfSph(0.172, 0, 1.96, 0, look.cap, 1, 0.8, 1.04));
    t.push(cyl(0.175, 0.175, 0.03, 0, 1.965, 0, look.cap, 14, 1, 1.04));
    t.push(place(colorize(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12, 1, false, -Math.PI / 2, Math.PI), look.cap), 0, 1.96, 0.1, 0.12, 0, 0, 1, 1, 0.9)); // brim
  } else {
    t.push(halfSph(0.176, 0, 1.915, -0.008, look.hair, 0.97, 1.02, 1.05));
    if (look.hairStyle === 1) t.push(sph(0.15, 0, 1.92, -0.06, look.hair, 1.08, 0.95, 0.9));
    else if (look.hairStyle === 2) t.push(cap(0.13, 0.22, 0, 1.8, -0.07, look.hair, 0, 0, 1.15, 0.7));
    else if (look.hairStyle === 3) t.push(halfSph(0.18, 0, 2.0, 0, look.hair, 1, 0.9, 1.05));
  }
  const torso = new THREE.Mesh(merge(t), humanMat);
  torso.castShadow = true;
  body.add(torso);

  const mesh = (gs) => { const m = new THREE.Mesh(merge(gs), humanMat); m.castShadow = true; return m; };
  const sleeve = look.shirt;
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.add(mesh([cap(0.068, 0.2, 0, -0.15, 0, sleeve)]));
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    elbow.add(mesh([
      cap(0.06, 0.15, 0, -0.12, 0, look.cop || look.hoodie ? sleeve : look.skin),
      sph(0.058, 0, -0.29, 0.005, look.glove || look.skin, 0.85, 1.1, 1.05),
      sph(0.022, side * -0.04, -0.27, 0.035, look.glove || look.skin, 1, 1.4, 1, 5, 4), // thumb
    ]));
    pivot.add(elbow);
    return { pivot, elbow };
  };
  const leg = () => {
    const pivot = new THREE.Group();
    pivot.add(mesh([cap(0.096, 0.27, 0, -0.22, 0, look.pants)]));
    const knee = new THREE.Group();
    knee.position.y = -0.45;
    knee.add(mesh([
      cap(0.086, 0.26, 0, -0.19, 0, look.pants),
      cap(0.062, 0.13, 0, -0.415, 0.045, look.shoes, Math.PI / 2, 0, 1.1, 1), // shoe, toe forward
    ]));
    pivot.add(knee);
    return { pivot, knee };
  };
  const aL = arm(-1), aR = arm(1), lL = leg(), lR = leg();
  aL.pivot.position.set(-0.29, 1.58, 0);
  aR.pivot.position.set(0.29, 1.58, 0);
  lL.pivot.position.set(-0.12, 0.93, 0);
  lR.pivot.position.set(0.12, 0.93, 0);
  aL.pivot.rotation.z = -0.06; aR.pivot.rotation.z = 0.06;
  body.add(aL.pivot, aR.pivot, lL.pivot, lR.pivot);
  const hand = new THREE.Group();
  hand.position.set(0, -0.28, 0.02);
  aR.elbow.add(hand);
  return { root, body, torso, armL: aL.pivot, armR: aR.pivot, legL: lL.pivot, legR: lR.pivot, elbowL: aL.elbow, elbowR: aR.elbow, kneeL: lL.knee, kneeR: lR.knee, hand, phase: rand(0, 6), look, round: true };
}

// knees + elbows of the round figure (called at the end of animateHuman)
function animateJoints(h, dt, o, amp) {
  if (o.dead) {
    h.kneeL.rotation.x = damp(h.kneeL.rotation.x, 0.25, 6, dt);
    h.kneeR.rotation.x = damp(h.kneeR.rotation.x, 0.5, 6, dt);
    h.elbowL.rotation.x = damp(h.elbowL.rotation.x, -0.3, 6, dt);
    h.elbowR.rotation.x = damp(h.elbowR.rotation.x, -0.5, 6, dt);
    return;
  }
  if (o.sit) {
    h.kneeL.rotation.x = damp(h.kneeL.rotation.x, 1.4, 10, dt);
    h.kneeR.rotation.x = damp(h.kneeR.rotation.x, 1.4, 10, dt);
    h.elbowL.rotation.x = damp(h.elbowL.rotation.x, -0.4, 10, dt);
    h.elbowR.rotation.x = damp(h.elbowR.rotation.x, -0.4, 10, dt);
    return;
  }
  // the knee bends while the leg swings forward (and a bit on landing)
  const c = Math.cos(h.phase), run = Math.min(1, (o.speed || 0) / 6);
  let kl = amp * (0.12 + (0.7 + run * 0.7) * Math.max(0, -c));
  let kr = amp * (0.12 + (0.7 + run * 0.7) * Math.max(0, c));
  if (!o.grounded) { kl = 1.1; kr = 0.4; }
  h.kneeL.rotation.x = damp(h.kneeL.rotation.x, kl, 18, dt);
  h.kneeR.rotation.x = damp(h.kneeR.rotation.x, kr, 18, dt);
  const aim = o.aim || 0;
  const walkE = -0.18 - amp * (0.25 + run * 0.9); // arms bend more when running
  let el = walkE, er = walkE;
  if (o.flee || !o.grounded) el = er = -0.2;
  if (o.punch) er = -0.1;
  h.elbowL.rotation.x = damp(h.elbowL.rotation.x, lerp(el, o.twoHand ? -0.55 : el, aim), 16, dt);
  h.elbowR.rotation.x = damp(h.elbowR.rotation.x, lerp(er, -0.05, aim), 20, dt);
}

// pose: speed (m/s), aim (0..1), grounded, sit
export function animateHuman(h, dt, o) {
  const sp = o.speed || 0;
  if (o.dead) {
    h.body.rotation.x = damp(h.body.rotation.x, -Math.PI / 2, 10, dt);
    h.body.position.y = damp(h.body.position.y, 0.18, 10, dt);
    h.armL.rotation.x = damp(h.armL.rotation.x, -2.8, 6, dt);
    h.armR.rotation.x = damp(h.armR.rotation.x, -2.6, 6, dt);
    h.legL.rotation.x = damp(h.legL.rotation.x, 0.15, 6, dt);
    h.legR.rotation.x = damp(h.legR.rotation.x, -0.1, 6, dt);
    if (h.round) animateJoints(h, dt, o, 0);
    return;
  }
  h.body.rotation.x = damp(h.body.rotation.x, o.lean || 0, 10, dt);
  h.body.position.y = damp(h.body.position.y, 0, 12, dt);
  if (o.sit) {
    h.legL.rotation.x = damp(h.legL.rotation.x, -1.4, 10, dt);
    h.legR.rotation.x = damp(h.legR.rotation.x, -1.4, 10, dt);
    h.armL.rotation.x = damp(h.armL.rotation.x, -1.1, 10, dt);
    h.armR.rotation.x = damp(h.armR.rotation.x, -1.1, 10, dt);
    h.legL.rotation.z = 0.12;
    h.legR.rotation.z = -0.12;
    if (h.round) animateJoints(h, dt, o, 0);
    return;
  }
  h.legL.rotation.z = h.legR.rotation.z = 0;
  const freq = sp < 3 ? 5.5 + sp : 6.5 + sp * 0.7;
  h.phase += dt * freq * (sp > 0.1 ? 1 : 0);
  const amp = Math.min(1, sp / 6) * 0.95 + (sp > 0.1 ? 0.15 : 0);
  const s = Math.sin(h.phase);
  let ll = s * amp, lr = -s * amp;
  if (!o.grounded) { ll = -0.7; lr = 0.35; }
  h.legL.rotation.x = damp(h.legL.rotation.x, ll, 18, dt);
  h.legR.rotation.x = damp(h.legR.rotation.x, lr, 18, dt);
  // bob
  h.torso.position.y = Math.abs(Math.cos(h.phase)) * 0.05 * amp;
  const aim = o.aim || 0;
  let al = -s * amp * 0.9, ar = s * amp * 0.9;
  if (!o.grounded) { al = -2.6; ar = -2.6; }
  if (o.flee) { al = -2.9; ar = -2.9; }
  if (o.punch) { ar = -1.6 - o.punch * 0.2; }
  h.armL.rotation.x = damp(h.armL.rotation.x, lerp(al, o.twoHand ? -1.35 : al * 0.5, aim), 16, dt);
  h.armR.rotation.x = damp(h.armR.rotation.x, lerp(ar, -1.5 - (o.pitch || 0), aim), 20, dt);
  h.armL.rotation.y = damp(h.armL.rotation.y, o.twoHand ? aim * 0.6 : 0, 16, dt);
  h.armR.rotation.z = h.round ? 0.06 * (1 - aim) : 0;
  if (h.round) animateJoints(h, dt, o, amp);
}

// balaclava for robberies
export function setMask(h, on) {
  if (on && !h.mask) {
    const g = [];
    g.push(cbox(0.4, 0.43, 0.38, 0, 1.93, -0.005, '#16161a'));
    g.push(cbox(0.24, 0.08, 0.02, 0, 1.935, 0.185, h.look.skin));
    g.push(cbox(0.06, 0.05, 0.02, -0.07, 1.935, 0.192, '#1a1a1a'));
    g.push(cbox(0.06, 0.05, 0.02, 0.07, 1.935, 0.192, '#1a1a1a'));
    g.push(cbox(0.1, 0.05, 0.02, 0, 1.8, 0.19, '#5a2a2a'));
    g.push(cbox(0.12, 0.06, 0.12, 0, 2.17, 0, '#16161a'));
    h.mask = new THREE.Mesh(merge(g), humanMat);
    h.mask.castShadow = true;
    h.torso.add(h.mask);
  }
  if (h.mask) h.mask.visible = !!on;
}

// far away: one merged mesh in rest pose instead of torso + 4 limbs (1 draw call instead of 5)
export function setHumanLod(h, far) {
  if (h._far === far) return;
  if (far && !h.lod) {
    const gs = [h.torso.geometry.clone()];
    const walk = (o, x, y, z) => {
      for (const c of o.children) {
        if (c.isMesh) gs.push(c.geometry.clone().translate(x, y, z));
        else if (c !== h.hand) walk(c, x + c.position.x, y + c.position.y, z + c.position.z);
      }
    };
    for (const p of [h.armL, h.armR, h.legL, h.legR]) walk(p, p.position.x, p.position.y, p.position.z);
    h.lod = new THREE.Mesh(merge(gs), humanMat);
    h.lod.castShadow = false;
    h.body.add(h.lod);
  }
  h._far = far;
  h.torso.visible = h.armL.visible = h.armR.visible = h.legL.visible = h.legR.visible = !far;
  if (h.lod) h.lod.visible = far;
}
