// Anwesen-Entwurf (Layout aus dem anderen Chat, entwurf/mk_entwurf.py) + neues Seehaus an der Meerseite
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { torbogen as pc, bogengang as mc, hausblock as gc, torbogenZwischen as Zu, treppe as Ju, gelaender as Er, hecke as _c, heckeGeo as Ku, zypresse as qu, pool as ju,
  seehaus, verbundDach, mediterranParts, mediterranFinish as gi, mBox as Vt, mScaleUV as cn } from '../src/mediterran.js';
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setSize(innerWidth, innerHeight); R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.domElement.style.touchAction = 'none';
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(R.domElement);
const Ce = new THREE.Scene();
Ce.background = new THREE.Color('#9fc4e8'); Ce.fog = new THREE.Fog('#b9d3ea', 90, 260);
Ce.add(new THREE.HemisphereLight('#bcd7ff', '#6b5a40', 1.1));
const sun = new THREE.DirectionalLight('#fff1d6', 3.2); sun.position.set(-30, 50, 40);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, far: 160 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
Ce.add(sun);
const An = (i, t, e, n, s = 0) => (i.position.set(t, e, n), i.rotation.y = s, Ce.add(i), i);
{
const Ge = THREE.PlaneGeometry, Ln = THREE.CylinderGeometry, Te = THREE.Mesh, on = THREE.MeshStandardMaterial, vn = THREE.BoxGeometry;
const H=2.64, PI=Math.PI;
const X0=-36,X1=36,Z0=-30,Z1=30;                 // Anwesen 72 x 60 m, Norden (Tor) = -z, Meer = +z
const B=mediterranParts();
const fl=(x0,x1,z0,z1,y)=>{let g=new Ge(x1-x0,z1-z0);g.rotateX(-PI/2);let p=g.attributes.position,u=g.attributes.uv;for(let k=0;k<u.count;k++)u.setXY(k,p.getX(k)/2,p.getZ(k)/2);g.translate((x0+x1)/2,y,(z0+z1)/2);B.floor.push(g)};
const plat=(x0,x1,z0,z1,y0,y1)=>{B.stucco.push(Vt(x1-x0,y1-y0,z1-z0,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,4));B.stone.push(Vt(x1-x0+.16,.14,z1-z0+.16,(x0+x1)/2,y1-.07,(z0+z1)/2,2));fl(x0,x1,z0,z1,y1+.012)};
const wall=(x0,z0,x1,z1,y,h=3,t=.5)=>{const w=Math.abs(x1-x0)||t,d=Math.abs(z1-z0)||t,cx=(x0+x1)/2,cz=(z0+z1)/2;B.stucco.push(Vt(w,h,d,cx,y+h/2,cz,4));B.stone.push(Vt(w+.14,.16,d+.14,cx,y+h+.08,cz,2),Vt(w+.1,.3,d+.1,cx,y+.15,cz,2))};
const parapet=(x0,z0,x1,z1,y)=>wall(x0,z0,x1,z1,y,1.0,.34);
const rail=(len,x,y,z,rot=0,o={})=>An(Er({len,...o}),x,y,z,rot);
const stair=(x,y,z,dx,dz)=>An(Ju({steps:16}),x,y,z,Math.atan2(-dx,-dz));
const AR={spring:1.5};
const pot=(x,y,z,k=1)=>{let g=cn(new Ln(.46*k,.32*k,.62*k,10),1);g.translate(x,y+.31*k,z);B.stone.push(g);let r=cn(new Ln(.5*k,.5*k,.08*k,10),1);r.translate(x,y+.62*k,z);B.stone.push(r);B.hedge.push(Ku(.95*k,.8*k,.95*k,x,z,y+.6*k))};
const fountain=(x,y,z)=>{const c=(r1,r2,h,yy,b)=>{let g=cn(new Ln(r1,r2,h,20),1);g.translate(x,y+yy,z);b.push(g)};c(2.3,2.4,.5,.25,B.stone);c(2.05,2.05,.06,.5,B.water);c(.32,.42,1.5,.75,B.stone);c(.95,.3,.22,1.6,B.stone);c(.85,.85,.04,1.7,B.water);c(.14,.2,.7,2.05,B.stone);c(.4,.12,.14,2.45,B.stone)};
const cyp=(x,y,z,h=7)=>{let c=qu(h);c.position.set(x,y,z);Ce.add(c)};
{let g=new Te(new Ge(400,400),new on({color:"#7d8a4a",roughness:1}));g.rotation.x=-PI/2;g.position.y=-.02;g.receiveShadow=!0;Ce.add(g)}
fl(X0,X1,Z0,Z1,.01);
plat(-24,36,Z0,8,0,H); plat(10,36,8,Z1,0,H); plat(2,20,-14,2,H,2*H); plat(20,36,Z0,-14,H,2*H);
{let L=Math.hypot(14,H),g=Vt(6,.4,L,0,0,0,2);g.rotateX(-Math.atan2(H,14));g.translate(4,H/2-.2,Z0-7);B.floor.push(g);B.stucco.push(Vt(6,.05,.05,4,.02,Z0-14,2))}
wall(X0,Z0,-24,Z0,0,H+4.2); wall(-24,Z0,-9.3,Z0,H,4.2); wall(17.3,Z0,20,Z0,H,4.2); wall(20,Z0,X1,Z0,2*H,3.2);
wall(X1,Z0,X1,-14,2*H,3.2); wall(X1,-14,X1,Z1,H,4.2);
wall(X0,Z0,X0,-3.3,0,4.2); wall(X0,3.3,X0,22.55,0,4.2);       // NEU: Westmauer endet am Seehaus
An(pc({spring:2.2,ends:!1}),4,H,Z0);
An(pc({spring:2.2,ends:!1}),X0,0,0,PI/2);
An(mc({n:3,roof:"shed",spring:2.9}),-4.3,H,Z0+1.6);
An(mc({n:3,roof:"shed",spring:2.9}),12.3,H,Z0+1.6);
wall(-10.5,Z0,-10.5,-17.5,H,4);
wall(-10.5,-13.1,-10.5,-12.2,H,4);
An(Zu(4.4,AR),-10.5,H,-15.3,PI/2);
stair(14.88,H,-22,1,0);
stair(8,H,-19.12,0,1);
cyp(4.9,H,-20.4,6.5); cyp(11.1,H,-20.4,6.5);
for(const x of [-21.5,-18.5,-15.5,-12.8]) for(const z of [-27,-23.5,-20,-16.5]){ if(z===-16.5&&(x===-12.8||x===-21.5)) continue; pot(x,H,z,(x+z)%2?1:1.15); }
cyp(-22.8,H,-28.8,7.5); cyp(-11.8,H,-28.8,7.5); cyp(-22.8,H,-13.4,7.5); cyp(-11.8,H,-13.6,7.5);
wall(-24,-12.2,-19.2,-12.2,H,4); wall(-14.8,-12.2,-10.5,-12.2,H,4);
An(Zu(4.4,AR),-17,H,-12.2);
parapet(-24,Z0,-24,-17.7,H); parapet(-24,-14.3,-24,8,H);
stair(-29.12,0,-16,1,0);
// Loggia mit Dachterrasse über dem Pool: ENTFERNT (Nicks Wunsch)
An(gc(6,4.6,5),-19.5,H,-6.5,PI/2);
rail(8,-20,H,7.83); rail(6,-1,H,7.83); rail(8,6,H,7.83);
rail(2.4,-14.8,H,7.83); rail(6.4,-7.2,H,7.83);              // NEU: Geländer, wo die Loggia stand (Lücke nur an Treppe 8)
stair(-12,0,13.12,0,-1);
stair(-3.12,H,-6,1,0);
pot(-6,H,-10,1.15); pot(-6,H,-2,1.15); pot(0,H,4,1.15);
An(gc(11,6.8,8),12.5,2*H,-6.5);
An(gc(5,5.4,4.5),16.5,2*H,-11.2,PI);
{let d=new Te(new vn(.12,2.6,1.8),new on({color:"#c9a227",roughness:.35,metalness:.8}));d.position.set(6.94,2*H+1.3,-6);Ce.add(d)}
rail(17.6,11,2*H,1.83);
rail(6,2.17,2*H,-10.9,PI/2); rail(6,2.17,2*H,-1.2,PI/2);
rail(4,4.2,2*H,-13.83); rail(9.8,14.9,2*H,-13.83);
rail(15.6,19.83,2*H,-6,PI/2);
An(gc(8,4.8,5),30,2*H,-26.5); An(gc(6,4.6,5),32.6,2*H,-18,-PI/2);
parapet(20,Z0,20,-24.6,2*H); parapet(20,-19.4,20,-14,2*H); parapet(20,-14,26.4,-14,2*H); parapet(29.6,-14,X1,-14,2*H);
stair(28,H,-8.88,0,-1);
wall(26.2,-2,X1,-2,H,4); An(Zu(4.4,AR),24,H,-2);
wall(20,-2,21.8,-2,H,4);
An(mc({n:3,roof:"none"}),34.1,H,3.2,-PI/2);
cyp(25.4,H,-8.3,6.5); cyp(30.6,H,-8.3,6.5);
// NEU: die vier Stücke im Osten (Nordbau + U) haben EIN zusammenhängendes Ziegeldach statt Pultdach/Dachterrassen
An(mc({n:6,roof:"none"}),34.1,H,19.2,-PI/2);
An(mc({n:3,roof:"none"}),27.5,H,11.15);
An(mc({n:3,roof:"none"}),27.5,H,27.25,PI);
B.stucco.push(Vt(3.8,4.7,1.5,34.1,H+2.35,8.87,4));              // Lücke zwischen Nordbau und U geschlossen
An(verbundDach([[31.55,36.65,-2.45,29.8],[21.85,34,8.6,13.7],[21.85,34,24.7,29.8]],H+4.7),0,0,0);
fountain(19,H,19.2);
parapet(10.2,13.7,10.2,Z1,H); parapet(10.2,8,10.2,10.3,H);    // NEU: Lücke der entfernten Treppe 6 geschlossen
stair(4.88,0,12,1,0);                                          // Treppe 5 bleibt, Treppe 6 (z = 26) ENTFERNT
pot(12,H,15.5,1.15); pot(12,H,22.5,1.15);
parapet(10,Z1,X1,Z1,H);
An(ju({size:9,depth:0}),-8,0,19);
// NEU: Seehaus – L-förmig an der Meerkante, um die Westecke bis zur Garage, endet an der höheren Ebene (x = 10)
An(seehaus({ len: 46, wing: Z1 - 22.55, stairAt: 28 }), X0, 0, Z1);
An(_c(8,.9,.8),-19,0,8.75); An(_c(6,.9,.8),-5.5,0,8.75);
cyp(-21.5,0,10,6.5); cyp(-16.5,0,10,6.5); cyp(-7.5,0,10,6.5); cyp(-3,0,10,6.5);
pot(-15,0,15.5,1.15); pot(-1,0,15.5,1.15); pot(-15,0,22.5,1.15); pot(-1,0,22.5,1.15);
An(mc({n:4,roof:"shed"}),-34.1,0,16,PI/2);
An(gc(7,5,6),-30.5,0,-23,PI/2);
for(const z of [-13,-8.5,-4.5,4.5,8.5]) cyp(-34.4,0,z,6.5);
Ce.add(gi(B,"anwesen"));
}
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 600);
const oc = new OrbitControls(cam, R.domElement); oc.maxPolarAngle = 1.52; oc.enableDamping = true;
const V = { 'Seehaus': [[-12, 12, 4], [-12, 2, 27]], 'Vom Meer': [[-14, 9, 58], [-12, 3, 28]], 'Ecke West': [[-18, 7, 12], [-33, 2.5, 26]], 'Treppe': [[-8, 3, 16.5], [-8, 2.2, 26]], 'Drinnen': [[-30, 2.7, 27.8], [5, 2.6, 27.9]], 'Ende rechts': [[-2, 6, 15], [8, 2.5, 27]], 'Ost-Dach': [[8, 22, 19], [30, 3, 15]], 'Ost von oben': [[28, 60, 14.01], [28, 0, 14]], 'Mittelhof': [[-12, 9, 24], [-12, 3, 4]], 'Übersicht': [[-6, 34, 62], [2, 2, 0]], 'Von oben': [[0, 95, 1], [0, 0, 0]] };
window.go = (k) => { const [p, t] = V[k]; cam.position.set(...p); oc.target.set(...t); oc.update(); R.render(Ce, cam); };
window.views = Object.keys(V);
const bar = document.createElement('div'); bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;gap:6px;padding:8px;justify-content:center;font:14px sans-serif';
for (const k in V) { const b = document.createElement('button'); b.textContent = k; b.style.cssText = 'padding:9px 12px;border:0;border-radius:8px;background:#fff;color:#333'; b.onclick = () => window.go(k); bar.appendChild(b); }
document.body.appendChild(bar); window.go('Seehaus');
addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
(function loop() { requestAnimationFrame(loop); oc.update(); R.render(Ce, cam); })();
let tris = 0, calls = 0; Ce.traverse((o) => { if (o.isMesh) { calls++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
window.info = { tris: Math.round(tris), meshes: calls };
window.ready = true;
