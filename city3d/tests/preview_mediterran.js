// Vorschau der mediterranen Bauteile (nicht im Spiel): node build in tests/render_mediterran.mjs
import * as THREE from 'three';
import { torbogen, bogengang, pavillon, zypresse, mediterranMats, torbogenZwischen, hausblock, treppe, gelaender, hecke, pool, poolOutline } from '../src/mediterran.js';
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setSize(innerWidth, innerHeight); R.setPixelRatio(1);
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(R.domElement);
const S = new THREE.Scene();
S.background = new THREE.Color('#9fc4e8'); S.fog = new THREE.Fog('#b9d3ea', 60, 160);
S.add(new THREE.HemisphereLight('#bcd7ff', '#6b5a40', 1.1));
const sun = new THREE.DirectionalLight('#fff1d6', 3.2); sun.position.set(-18, 26, 20);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 90 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
S.add(sun);
const M = mediterranMats();
// Boden mit Loch für den Pool (Set 2 bei x = 60)
const PX = 66, PZ = 5;
const gs = new THREE.Shape([[-100, -100], [200, -100], [200, 100], [-100, 100]].map(([x, y]) => new THREE.Vector2(x, y)));
gs.holes.push(new THREE.Path(poolOutline(0.28).map(([x, z]) => new THREE.Vector2(PX + x, -(PZ + z)))));
const ground = new THREE.Mesh(new THREE.ShapeGeometry(gs), new THREE.MeshStandardMaterial({ color: '#7d8a4a', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
{
  const ps = new THREE.Shape([[42, -13], [78, -13], [78, 4], [42, 4]].map(([x, y]) => new THREE.Vector2(x, y)));
  ps.holes.push(new THREE.Path(poolOutline(0.28).map(([x, z]) => new THREE.Vector2(PX + x, -(PZ + z)))));
  const g = new THREE.ShapeGeometry(ps); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  const m = new THREE.Mesh(g, M0().floor); m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.receiveShadow = true; S.add(m);
}
function M0() { return mediterranMats(); }
const add = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; S.add(o); return o; };
// Set 2: Torbogen zwischen zwei Häusern, Treppe zur Terrasse, Geländer mit Hecken, Pool
add(hausblock(8, 6.5, 7), 60 - 6.7, 0, -8); add(hausblock(8, 7.2, 7), 60 + 6.7, 0, -8);
add(torbogenZwischen(5.4), 60, 0, -5.3);
{
  const tr = add(treppe(), 50, 0, 8), H = tr.userData.stairs.height, T = tr.userData.stairs.length;
  const ter = new THREE.Mesh(new THREE.BoxGeometry(13, H, 5), M0().stucco); ter.position.set(50, H / 2, 8 - T - 2.5); ter.castShadow = ter.receiveShadow = true; S.add(ter);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(13, 5), M0().floor); top.geometry.attributes.uv.array.forEach((v, i, a) => (a[i] = v * (i % 2 ? 2.5 : 6.5)));
  top.rotation.x = -Math.PI / 2; top.position.set(50, H + 0.01, 8 - T - 2.5); top.receiveShadow = true; S.add(top);
  add(gelaender({ len: 4.6 }), 50 - 4.2, H, 8 - T - 0.25); add(gelaender({ len: 4.6 }), 50 + 4.2, H, 8 - T - 0.25);
  add(hecke(4.6, 1.0, 0.8), 50 - 4.2, 0, 8 - T + 0.5); add(hecke(4.6, 1.0, 0.8), 50 + 4.2, 0, 8 - T + 0.5);
}
add(pool(), PX, 0, PZ);
add(gelaender({ len: 9.6, hedge: -1 }), 66, 0, 0.2);
add(gelaender({ len: 7.2, hedge: 0 }), 72.2, 0, 4, Math.PI / 2);
const plaza = new THREE.Mesh(new THREE.PlaneGeometry(44, 22), M.floor.clone());
plaza.material.map = M.floor.map.clone(); plaza.material.map.repeat.set(22, 11); plaza.material.normalMap = M.floor.normalMap.clone(); plaza.material.normalMap.repeat.set(22, 11);
plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.01, 2); plaza.receiveShadow = true; S.add(plaza);
const t = torbogen(); t.position.set(-13, 0, 6); S.add(t);
const b = bogengang(); b.position.set(2, 0, -4); S.add(b);
const p = pavillon(); p.position.set(14, 0, 4); p.rotation.y = -0.3; S.add(p);
const b2 = bogengang({ n: 3, roof: 'shed' }); b2.position.set(-12, 0, -6); S.add(b2);
for (const [x, z, h] of [[-17, 3, 8], [-9, 3, 7], [8, -9, 9], [-4, -9, 8], [20, -4, 7]]) { const c = zypresse(h); c.position.set(x, 0, z); S.add(c); }
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 400);
S.add(sun.target);
window.shot = (x, y, z, tx, ty, tz) => { sun.position.set(tx - 18, 26, tz + 20); sun.target.position.set(tx, 0, tz); sun.target.updateMatrixWorld(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); R.render(S, cam); };
let tris = 0; S.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
window.info = { tris: Math.round(tris), meshes: [t, b, p, b2].map((g) => g.children.length) };
window.ready = true;
