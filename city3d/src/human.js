import * as THREE from 'three';
import { cbox, merge, pick, rand, lerp, damp } from './util.js';

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
export function makeHuman(look) {
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
  h.armR.rotation.z = 0;
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
