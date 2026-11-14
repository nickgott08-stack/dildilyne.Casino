import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { world } from './world.js';

export const DAY_LEN = 30 * 60; // 15 min day + 15 min night

export function createSky(scene) {
  const uniforms = {
    top: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color() },
    moonDir: { value: new THREE.Vector3(0, -1, 0) },
    night: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 moonDir; uniform float night;
      varying vec3 vDir;
      float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y*1.4+0.1, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(h, 0.7));
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 900.0)*6.0 + pow(s, 12.0)*0.35);
        float m = max(dot(d, moonDir), 0.0);
        col += vec3(0.85,0.9,1.0) * (smoothstep(0.9993,0.9996,m)*1.4 + pow(m, 60.0)*0.12) * night;
        // stars
        vec3 q = floor(d*260.0);
        float st = step(0.9965, hash(q)) * smoothstep(0.0, 0.25, d.y);
        col += vec3(st) * night * (0.6+0.4*hash(q+3.0));
        // below horizon fade into fog color
        col = mix(bottom, col, smoothstep(-0.05, 0.05, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight('#bcd7ff', '#5b5040', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 3);
  sun.castShadow = true;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  const sc = sun.shadow.camera;
  sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 1; sc.far = 600;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog('#c9dcef', 80, 650);
  return { sky, uniforms, hemi, sun };
}

const C = (h) => new THREE.Color(h);
// keyframes over sun elevation phases
const keys = [
  // t (0..1 of cycle), top, bottom, sun color, sun int, hemi int, night
  [0.0, C('#2b3d6b'), C('#f6a86b'), C('#ffb070'), 1.2, 0.7, 0.2], // sunrise
  [0.06, C('#4d86d1'), C('#cfe2f5'), C('#ffe2b8'), 2.6, 1.1, 0],
  [0.25, C('#3b78d0'), C('#c6dcf2'), C('#fff6e6'), 3.2, 1.3, 0], // noon
  [0.44, C('#4a7fc6'), C('#e8c9a6'), C('#ffd8a8'), 2.4, 1.0, 0],
  [0.5, C('#33366b'), C('#f08452'), C('#ff8a4a'), 1.0, 0.6, 0.3], // sunset
  [0.54, C('#0d1330'), C('#30305a'), C('#8899ff'), 0.4, 0.38, 0.85],
  [0.75, C('#05081a'), C('#141a33'), C('#9fb4ff'), 0.45, 0.32, 1], // midnight
  [0.96, C('#0d1330'), C('#3a3460'), C('#8899ff'), 0.4, 0.38, 0.85],
  [1.0, C('#2b3d6b'), C('#f6a86b'), C('#ffb070'), 1.2, 0.7, 0.2],
];

const tmp = new THREE.Color();
export function updateSky(S, t, focus, dt, quality) {
  // t = cycle fraction 0..1 ; day = 0..0.5
  let a = keys[0], b = keys[1];
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
  S.uniforms.top.value.copy(a[1]).lerp(b[1], f);
  S.uniforms.bottom.value.copy(a[2]).lerp(b[2], f);
  const sunCol = tmp.copy(a[3]).lerp(b[3], f);
  const night = lerp(a[6], b[6], f);
  S.uniforms.night.value = night;
  S.night = night;

  const isDay = t < 0.5;
  const ang = isDay ? (t / 0.5) * Math.PI : ((t - 0.5) / 0.5) * Math.PI;
  const elev = Math.sin(ang);
  const dir = new THREE.Vector3(Math.cos(ang) * 0.85, Math.max(0.12, elev), 0.45).normalize();
  const sunDir = isDay ? dir : new THREE.Vector3(-Math.cos(ang), -0.3, -0.4).normalize();
  const moonDir = isDay ? new THREE.Vector3(0, -1, 0) : dir;
  S.uniforms.sunDir.value.copy(isDay ? new THREE.Vector3(Math.cos(ang) * 0.85, elev, 0.45).normalize() : sunDir);
  S.uniforms.moonDir.value.copy(moonDir);
  S.uniforms.sunColor.value.copy(sunCol).multiplyScalar(isDay ? 1 : 0);

  // main light: sun by day, moon by night
  S.sun.color.copy(isDay ? sunCol : C('#9fb4ff'));
  S.sun.intensity = lerp(a[4], b[4], f);
  S.hemi.intensity = lerp(a[5], b[5], f);
  S.hemi.color.copy(S.uniforms.top.value).lerp(C('#ffffff'), 0.45);
  S.hemi.groundColor.set(night > 0.5 ? '#1c1a24' : '#5b5040');
  const ld = isDay ? dir : moonDir;
  S.sun.position.set(focus.x + ld.x * 250, ld.y * 250, focus.z + ld.z * 250);
  // snap shadow camera to texel grid to prevent shimmering
  const snap = (2 * (quality.shadowR || 90)) / (quality.shadow || 1024);
  S.sun.target.position.set(Math.round(focus.x / snap) * snap, 0, Math.round(focus.z / snap) * snap);
  S.sun.position.x += S.sun.target.position.x - focus.x;
  S.sun.position.z += S.sun.target.position.z - focus.z;

  // fog
  S.sky.position.copy(focus);
  const fogCol = tmp.copy(S.uniforms.bottom.value).lerp(S.uniforms.top.value, 0.25);
  if (S.fogTint) fogCol.lerp(S.fogTint, 0.3);
  // keep the fog a bit lighter by day
  S.sky.parent.fog.color.copy(fogCol);
  S.sky.parent.fog.near = lerp(90, 40, night);
  S.sky.parent.fog.far = lerp(700, 380, night);

  // city lights
  const n2 = clamp((night - 0.15) / 0.6, 0, 1);
  for (const m of world.windowMats) m.emissiveIntensity = m.map && m.map.image.height < 200 ? lerp(0.2, 0.85, n2) : lerp(0.0, 1.25, n2);
  world.poolMat.opacity = n2 * 0.75;
  world.lampHeadMat.color.setScalar(lerp(0.55, 1.6, n2));
  for (const m of world.signMats) m.color.setScalar(lerp(0.75, 1.25, n2));
  S.n2 = n2;
  S.sky.parent.environmentIntensity = lerp(0.65, 0.06, clamp(night, 0, 1));
}

export function timeString(t) {
  // t=0 -> 06:00, t=0.5 -> 18:00, wraps
  const hours = (6 + t * 24) % 24;
  const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
