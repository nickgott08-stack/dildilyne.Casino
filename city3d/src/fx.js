import * as THREE from 'three';
import { rand } from './util.js';

class ParticleSystem {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/max(0.5,-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard; float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vC.rgb, vC.a*a); }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(o);
  }
  update(dt) {
    let k = 0;
    const alive = [];
    for (const o of this.p) {
      o.life -= dt;
      if (o.life <= 0) continue;
      o.vy -= (o.g || 0) * dt;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.drag) { const f = Math.exp(-o.drag * dt); o.vx *= f; o.vy *= f; o.vz *= f; }
      if (o.floor !== undefined && o.y < o.floor) { o.y = o.floor; o.vy *= -0.3; o.vx *= 0.6; o.vz *= 0.6; }
      const t = 1 - o.life / o.max;
      alive.push(o);
      this.pos[k * 3] = o.x; this.pos[k * 3 + 1] = o.y; this.pos[k * 3 + 2] = o.z;
      const c = o.c;
      const fade = o.fadeIn ? Math.min(1, t * 6) * (1 - t) : 1 - t;
      this.col[k * 4] = c[0]; this.col[k * 4 + 1] = c[1]; this.col[k * 4 + 2] = c[2]; this.col[k * 4 + 3] = (o.a ?? 1) * fade;
      if (o.c2) {
        this.col[k * 4] = c[0] + (o.c2[0] - c[0]) * t;
        this.col[k * 4 + 1] = c[1] + (o.c2[1] - c[1]) * t;
        this.col[k * 4 + 2] = c[2] + (o.c2[2] - c[2]) * t;
      }
      this.size[k] = o.s + (o.grow || 0) * t;
      k++;
    }
    this.p = alive;
    this.geo.setDrawRange(0, k);
    for (const n of ['position', 'color', 'size']) this.geo.attributes[n].needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.add = new ParticleSystem(scene, 900, true);
    this.norm = new ParticleSystem(scene, 700, false);
    // tracers
    this.tracers = [];
    const tg = new THREE.BufferGeometry();
    this.tpos = new Float32Array(64 * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tpos, 3).setUsage(THREE.DynamicDrawUsage));
    this.tgeo = tg;
    this.tline = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.tline.frustumCulled = false;
    scene.add(this.tline);
    // muzzle flash light + flashes
    this.flash = new THREE.PointLight('#ffc070', 0, 12, 2);
    scene.add(this.flash);
    this.flashT = 0;
    this.boom = new THREE.PointLight('#ff8a30', 0, 40, 1.5);
    scene.add(this.boom);
    this.boomT = 0;
  }
  setScale(h) {
    this.add.mat.uniforms.scale.value = h * 0.9;
    this.norm.mat.uniforms.scale.value = h * 0.9;
  }
  muzzle(x, y, z, dx, dy, dz) {
    for (let i = 0; i < 4; i++) this.add.add({ x: x + dx * i * 0.12, y: y + dy * i * 0.12, z: z + dz * i * 0.12, vx: dx * 3, vy: dy * 3, vz: dz * 3, life: 0.06, max: 0.06, s: 0.35 - i * 0.06, c: [1, 0.8, 0.4] });
    this.flash.position.set(x, y, z);
    this.flash.intensity = 30;
    this.flashT = 0.05;
    this.norm.add({ x, y, z, vx: dx + rand(-0.3, 0.3), vy: 0.6, vz: dz, life: 0.6, max: 0.6, s: 0.15, grow: 0.5, c: [0.75, 0.75, 0.75], a: 0.35, drag: 2 });
  }
  tracer(a, b) {
    this.tracers.push({ a: a.clone(), b: b.clone(), life: 0.06 });
  }
  sparks(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) this.add.add({ x, y, z, vx: rand(-4, 4), vy: rand(1, 5), vz: rand(-4, 4), g: 14, life: rand(0.2, 0.45), max: 0.45, s: 0.08, c: [1, 0.85, 0.4], floor: 0.05 });
  }
  dust(x, y, z) {
    for (let i = 0; i < 3; i++) this.norm.add({ x, y, z, vx: rand(-1, 1), vy: rand(0.2, 1), vz: rand(-1, 1), life: 0.6, max: 0.6, s: 0.2, grow: 0.5, c: [0.7, 0.68, 0.62], a: 0.5, drag: 3 });
  }
  blood(x, y, z) {
    for (let i = 0; i < 6; i++) this.norm.add({ x, y, z, vx: rand(-1.5, 1.5), vy: rand(0, 2.5), vz: rand(-1.5, 1.5), g: 12, life: 0.5, max: 0.5, s: 0.12, c: [0.6, 0.02, 0.02], floor: 0.22 });
  }
  smoke(x, y, z, s = 0.3) {
    this.norm.add({ x: x + rand(-0.2, 0.2), y, z: z + rand(-0.2, 0.2), vx: rand(-0.3, 0.3), vy: rand(1, 2), vz: rand(-0.3, 0.3), life: 2.2, max: 2.2, s, grow: 2.2, c: [0.25, 0.25, 0.25], c2: [0.55, 0.55, 0.55], a: 0.5, fadeIn: true, drag: 0.4 });
  }
  tire(x, y, z) {
    this.norm.add({ x, y, z, vx: rand(-0.5, 0.5), vy: rand(0.3, 0.8), vz: rand(-0.5, 0.5), life: 1.2, max: 1.2, s: 0.4, grow: 1.6, c: [0.82, 0.82, 0.82], a: 0.35, fadeIn: true, drag: 1 });
  }
  fire(x, y, z) {
    this.add.add({ x, y, z, vx: rand(-0.5, 0.5), vy: rand(1.5, 3.5), vz: rand(-0.5, 0.5), life: rand(0.4, 0.8), max: 0.8, s: rand(0.5, 0.9), grow: -0.4, c: [1, 0.75, 0.25], c2: [0.9, 0.15, 0.02], drag: 0.5 });
  }
  explosion(x, y, z) {
    for (let i = 0; i < 70; i++) {
      const a = rand(0, 6.28), e = rand(-0.2, 1.2), s = rand(4, 14);
      this.add.add({ x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 2, vz: Math.sin(a) * Math.cos(e) * s, life: rand(0.5, 1.1), max: 1.1, s: rand(1.2, 2.6), grow: -0.8, c: [1, 0.85, 0.4], c2: [0.8, 0.12, 0.0], drag: 3 });
    }
    for (let i = 0; i < 35; i++) this.norm.add({ x: x + rand(-1.5, 1.5), y: y + rand(0, 2), z: z + rand(-1.5, 1.5), vx: rand(-3, 3), vy: rand(2, 6), vz: rand(-3, 3), life: rand(2.5, 4), max: 4, s: rand(1.5, 2.5), grow: 5, c: [0.12, 0.11, 0.1], c2: [0.4, 0.4, 0.4], a: 0.7, drag: 1.2, fadeIn: true });
    this.sparks(x, y, z, 30);
    this.boom.position.set(x, y + 2, z);
    this.boom.intensity = 900;
    this.boomT = 0.7;
  }
  update(dt) {
    this.add.update(dt);
    this.norm.update(dt);
    let k = 0;
    this.tracers = this.tracers.filter((t) => (t.life -= dt) > 0);
    for (const t of this.tracers) {
      if (k >= 64) break;
      this.tpos.set([t.a.x, t.a.y, t.a.z, t.b.x, t.b.y, t.b.z], k * 6);
      k++;
    }
    this.tgeo.setDrawRange(0, k * 2);
    this.tgeo.attributes.position.needsUpdate = true;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.intensity = 0; }
    if (this.boomT > 0) { this.boomT -= dt; this.boom.intensity = Math.max(0, this.boomT / 0.7) * 900; }
  }
}
