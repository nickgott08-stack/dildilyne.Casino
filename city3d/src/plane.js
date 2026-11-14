// Small propeller plane (Bilal's Flugschule) – arcade flight model, flown by the player
import * as THREE from 'three';
import './dildi_cars.js';
import { cbox, ccyl, merge, clamp, damp, dampAngle } from './util.js';
import { groundAt, collideCircle } from './world.js';
import { WORLD } from './geo.js';

const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });

function buildPlane(color) {
  const g = [];
  // fuselage (nose points +z)
  g.push(cbox(1.25, 1.3, 6.2, 0, 1.35, 0.2, color));
  g.push(cbox(1.0, 1.0, 1.4, 0, 1.3, 3.9, color)); // nose
  g.push(cbox(0.7, 0.75, 2.2, 0, 1.55, -3.9, color)); // tail boom
  g.push(cbox(1.15, 0.55, 1.6, 0, 2.15, 1.2, '#1a2633')); // cockpit glass
  g.push(cbox(1.28, 0.1, 6.2, 0, 1.0, 0.2, '#ffffff'));
  g.push(cbox(1.28, 0.18, 5.0, 0, 1.55, 0.0, '#d4141c')); // stripe
  // wings (high wing)
  g.push(cbox(11.2, 0.16, 1.7, 0, 2.55, 0.9, '#f2f2f2'));
  g.push(cbox(0.5, 0.06, 1.72, -5.35, 2.56, 0.9, '#d4141c'));
  g.push(cbox(0.5, 0.06, 1.72, 5.35, 2.56, 0.9, '#d4141c'));
  for (const sx of [-1, 1]) g.push(cbox(0.08, 1.3, 0.1, sx * 1.6, 1.9, 0.9, '#888', 0, 0, sx * 0.55)); // struts
  // tail
  g.push(cbox(3.6, 0.12, 1.1, 0, 1.75, -4.6, '#f2f2f2'));
  g.push(cbox(0.12, 1.5, 1.2, 0, 2.45, -4.7, color));
  g.push(cbox(0.13, 0.4, 1.0, 0, 2.95, -4.75, '#d4141c'));
  // landing gear
  for (const sx of [-1, 1]) {
    g.push(cbox(0.08, 0.8, 0.08, sx * 0.9, 0.6, 1.0, '#333', 0, 0, sx * 0.4));
    g.push(ccyl(0.3, 0.3, 0.2, 12, sx * 1.15, 0.3, 1.0, '#111', 0, 0, Math.PI / 2));
  }
  g.push(ccyl(0.2, 0.2, 0.15, 10, 0, 0.2, 3.6, '#111', 0, 0, Math.PI / 2));
  g.push(cbox(0.06, 0.5, 0.06, 0, 0.5, 3.6, '#333'));
  g.push(ccyl(0.22, 0.12, 0.4, 10, 0, 1.3, 4.75, '#d4141c', Math.PI / 2)); // spinner
  const body = new THREE.Mesh(merge(g), mat);
  body.castShadow = true;
  const prop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 0.06), new THREE.MeshStandardMaterial({ color: '#222', transparent: true, opacity: 0.85 }));
  prop.position.set(0, 1.3, 4.9);
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.add(body, prop);
  root.add(tilt);
  return { root, tilt, prop };
}

export class Plane {
  constructor(scene, x, z, h, color = '#2471a3') {
    this.scene = scene;
    const m = globalThis.DildiCars ? globalThis.DildiCars.dildiCityPlane(THREE, color, { body: mat }) : buildPlane(color);
    this.root = m.root; this.tilt = m.tilt; this.prop = m.prop;
    this.tilt.rotation.order = 'YXZ';
    scene.add(this.root);
    this.pos = new THREE.Vector3(x, groundAt(x, z, 1e9), z);
    this.h = h; this.pitch = 0; this.roll = 0;
    this.speed = 0; this.vy = 0; this.thr = 0;
    this.onGround = true;
    this.crashed = false;
    this.camYaw = h;
    this.sync();
  }
  get kmh() { return Math.round(Math.abs(this.speed) * 3.6); }
  get alt() { return Math.max(0, this.pos.y - groundAt(this.pos.x, this.pos.z, 1e9)); }
  // steer: -1..1 (wheel), throttle: -1..1 (gas/brake), pitchIn: -1..1 (nose down/up)
  update(dt, steer, throttle, pitchIn) {
    if (this.crashed) return null;
    const gnd = groundAt(this.pos.x, this.pos.z, 1e9);
    this.thr = clamp(this.thr + throttle * dt * 0.55, 0, 1);
    if (this.onGround) {
      // taxi / take-off run
      const brake = throttle < 0 ? 1 : 0;
      const target = this.thr * 46;
      this.speed += (target - this.speed) * dt * 0.35 - brake * this.speed * dt * 0.8;
      this.speed = Math.max(0, this.speed);
      this.h -= steer * dt * clamp(this.speed / 8, 0, 1) * 0.9;
      this.roll = damp(this.roll, 0, 6, dt);
      // rotate: nose up once fast enough
      if (pitchIn > 0 && this.speed > 22) this.pitch = damp(this.pitch, 0.22, 2.5, dt);
      else this.pitch = damp(this.pitch, 0, 4, dt);
      if (this.pitch > 0.12 && this.speed > 24) { this.onGround = false; this.vy = 2; }
      this.pos.y = gnd;
      if (gnd < -1 && this.speed > 1) return this.crash(); // rolled into the water
    } else {
      // flying: bank to turn, pitch with the buttons, auto-level when released
      // landing assist: close to the ground the wings level out by themselves
      const lowAlt = this.pos.y - gnd < 7;
      this.roll = damp(this.roll, steer * (lowAlt ? 0.25 : 0.75), lowAlt ? 4 : 2.6, dt);
      this.h -= Math.sin(this.roll) * dt * 1.0 * clamp(this.speed / 30, 0.4, 1.2);
      if (pitchIn) this.pitch = clamp(this.pitch + pitchIn * dt * 0.75, -0.6, 0.5);
      else this.pitch = damp(this.pitch, 0.04, 0.8, dt);
      const target = 22 + this.thr * 36; // 80 .. 210 km/h
      this.speed += (target - this.speed) * dt * 0.4 - Math.sin(this.pitch) * 9.8 * dt * 0.6;
      this.speed = clamp(this.speed, 8, 75);
      // lift: below ~85 km/h the plane sinks (stall)
      const stall = clamp((24 - this.speed) / 10, 0, 1);
      // less throttle = the plane glides down by itself (easy approach), full throttle = slight climb
      const wantVy = Math.sin(this.pitch) * this.speed - stall * 12 - (1 - this.thr) * 3.6 + this.thr * 0.8;
      this.vy = damp(this.vy, wantVy, 2.5, dt);
      this.pos.y += this.vy * dt;
      this.pos.y = Math.min(this.pos.y, 220);
      // touching the ground
      if (this.pos.y <= gnd + 0.05) {
        if (gnd < -1) return this.crash(); // into the sea
        const soft = this.vy > -7.5 && Math.abs(this.roll) < 0.45 && this.pitch > -0.2 && this.speed < 46;
        if (!soft) return this.crash();
        this.onGround = true;
        this.pos.y = gnd;
        this.vy = 0;
        this.landedT = 0;
      }
    }
    this.pos.x += Math.sin(this.h) * this.speed * dt * Math.cos(this.onGround ? 0 : this.pitch);
    this.pos.z += Math.cos(this.h) * this.speed * dt * Math.cos(this.onGround ? 0 : this.pitch);
    // map edge: turn back
    if (this.pos.x < WORLD.x0 + 20 || this.pos.x > WORLD.x1 - 20 || this.pos.z < -1600 || this.pos.z > WORLD.z1 - 20) {
      this.pos.x = clamp(this.pos.x, WORLD.x0 + 20, WORLD.x1 - 20);
      this.pos.z = clamp(this.pos.z, -1600, WORLD.z1 - 20);
      this.h += Math.PI * dt;
    }
    // buildings, walls, cranes …
    const r = collideCircle(this.pos.x, this.pos.z, 2.2, this.pos.y + 0.6, 1.8);
    if (r.hit) {
      if (this.speed > 9) return this.crash();
      this.pos.x = r.x; this.pos.z = r.z; this.speed = 0;
    }
    this.prop.rotation.z += dt * (8 + this.thr * 60);
    this.sync();
    return null;
  }
  crash() {
    this.crashed = true;
    this.speed = 0;
    this.tilt.rotation.z = 0.6;
    return 'crash';
  }
  sync() {
    this.root.position.copy(this.pos);
    this.tilt.rotation.set(-this.pitch, this.h, -this.roll);
  }
  // chase camera behind the plane; swiping looks around a bit
  camera(cam, dt, lx) {
    this.camYaw = dampAngle(this.camYaw, this.h, 3.5, dt) - lx;
    const back = 15, up = 4.5 + Math.max(0, -this.pitch) * 6;
    const cx = this.pos.x - Math.sin(this.camYaw) * back, cz = this.pos.z - Math.cos(this.camYaw) * back;
    const cy = Math.max(this.pos.y + up, groundAt(cx, cz, 1e9) + 2);
    cam.position.set(cx, cy, cz);
    cam.lookAt(this.pos.x + Math.sin(this.h) * 8, this.pos.y + 1.6 + Math.sin(this.pitch) * 6, this.pos.z + Math.cos(this.h) * 8);
  }
  remove() { this.scene.remove(this.root); this.removed = true; }
}
