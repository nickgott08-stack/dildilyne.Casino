import sys
src=open('med/vorschau.html').read()
a=src.index('var vc=Da(),Mc=66')
b=src.index('var xi=new Xe(')
layout = r'''
var An=(i,t,e,n,s=0)=>(i.position.set(t,e,n),i.rotation.y=s,Ce.add(i),i);
{
const H=2.64, SL=5.12, PI=Math.PI;               // level height = 16 steps, stair length
const X0=-36,X1=36,Z0=-30,Z1=30;                 // estate: 72 x 60 m, north (gate) = -z, cliff = +z
const B=_i();
const fl=(x0,x1,z0,z1,y)=>{let g=new Ge(x1-x0,z1-z0);g.rotateX(-PI/2);let p=g.attributes.position,u=g.attributes.uv;for(let k=0;k<u.count;k++)u.setXY(k,p.getX(k)/2,p.getZ(k)/2);g.translate((x0+x1)/2,y,(z0+z1)/2);B.floor.push(g)};
const plat=(x0,x1,z0,z1,y0,y1)=>{B.stucco.push(Vt(x1-x0,y1-y0,z1-z0,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,4));B.stone.push(Vt(x1-x0+.16,.14,z1-z0+.16,(x0+x1)/2,y1-.07,(z0+z1)/2,2));fl(x0,x1,z0,z1,y1+.012)};
// wall from (x0,z0) to (x1,z1) (axis aligned), standing on y, height h, with stone cap + base
const wall=(x0,z0,x1,z1,y,h=3,t=.5)=>{const w=Math.abs(x1-x0)||t,d=Math.abs(z1-z0)||t,cx=(x0+x1)/2,cz=(z0+z1)/2;B.stucco.push(Vt(w,h,d,cx,y+h/2,cz,4));B.stone.push(Vt(w+.14,.16,d+.14,cx,y+h+.08,cz,2),Vt(w+.1,.3,d+.1,cx,y+.15,cz,2))};
const parapet=(x0,z0,x1,z1,y)=>wall(x0,z0,x1,z1,y,1.0,.34);
const rail=(len,x,y,z,rot=0,o={})=>An(Er({len,...o}),x,y,z,rot);
const stair=(x,y,z,dx,dz)=>An(Ju({steps:16}),x,y,z,Math.atan2(-dx,-dz));
const cyp=(x,y,z,h=7)=>{let c=qu(h);c.position.set(x,y,z);Ce.add(c)};
// ---------- terrain ----------
{let g=new Te(new Ge(400,400),new on({color:"#7d8a4a",roughness:1}));g.rotation.x=-PI/2;g.position.y=-.02;g.receiveShadow=!0;Ce.add(g)}
fl(X0,X1,Z0,Z1,.01);
// ---------- platforms ----------
plat(-24,36,Z0,8,0,H);            // level 2: gate court, garden, middle court, east courts
plat(10,36,8,Z1,0,H);             // level 2: court of the U-shaped arcade above the pool
plat(2,20,-14,2,H,2*H);           // level 3: villa podium
plat(20,36,Z0,-14,H,2*H);         // level 3: north-east terrace
// ramp from the forest road up to the main gate
{let L=Math.hypot(14,H),g=Vt(6,.4,L,0,0,0,2);g.rotateX(-Math.atan2(H,14));g.translate(4,H/2-.2,Z0-7);B.floor.push(g);B.stucco.push(Vt(6,.05,.05,4,.02,Z0-14,2))}
// ---------- outer wall ----------
wall(X0,Z0,-24,Z0,0,H+3.2); wall(-24,Z0,.7,Z0,H,3.2); wall(7.3,Z0,20,Z0,H,3.2); wall(20,Z0,X1,Z0,2*H,3.2);
wall(X1,Z0,X1,-14,2*H,3.2); wall(X1,-14,X1,Z1,H,3.2);
wall(X0,Z0,X0,-3.3,0,4.2); wall(X0,3.3,X0,Z1,0,4.2);
// ---------- gates ----------
An(pc(),4,H,Z0);                                   // main gate with grille
An(pc({ends:!1}),X0,0,0,PI/2);                     // west gate (to the helicopter)
// ---------- gate court ----------
An(mc({n:3,roof:"shed"}),-5,H,Z0+1.9);            // gate house, west of the gate
An(mc({n:3,roof:"shed"}),13,H,Z0+1.9);            // gate house, east of the gate
wall(-10.5,Z0,-10.5,-18,H,3);                      // wall to the garden …
An(Zu(5.4),-10.5,H,-15.3,PI/2);                    // … with archway 1
stair(14.88,H,-22,1,0);                            // stairs 1: up to the north-east terrace
stair(8,H,-19.12,0,1);                             // stairs 2: up to the villa
cyp(-8,H,-27,7.5); cyp(-8,H,-20,6.5); cyp(17.5,H,-17,7);
// ---------- garden (north-west) ----------
for(const [x,z,l,r] of [[-17,-26,8,0],[-20.5,-21,6,PI/2],[-14,-19,5,0]]) An(_c(l,1,.8),x,H,z,r);
cyp(-22,H,-28,8); cyp(-13,H,-28,7); cyp(-22,H,-15,7.5);
wall(-24,-12.2,-19.7,-12.2,H,3); wall(-14.3,-12.2,-10.5,-12.2,H,3);
An(Zu(5.4),-17,H,-12.2);                           // archway 2: garden ↔ middle court
parapet(-24,Z0,-24,-17.7,H); parapet(-24,-14.3,-24,8,H);
stair(-29.12,0,-16,1,0);                           // stairs 4: west strip → garden
// ---------- middle court ----------
An(mc({n:5,back:!1}),-12,H,6,PI);                  // loggia with roof terrace, overlooking the pool
An(gc(6,4.6,5),-19.5,H,-6.5,PI/2);                 // small house
rail(8,-20,H,7.83); rail(6,-1,H,7.83); rail(8,6,H,7.83);
stair(-3.12,H,-6,1,0);                             // stairs 3: up to the villa (lift side)
cyp(-8,H,-9,6.5); cyp(-1,H,0,7);
// ---------- villa on its podium (level 3) ----------
An(gc(11,6.8,8),12.5,2*H,-6.5);
An(gc(5,5.4,4.5),16.5,2*H,-11.2,PI);
{let d=new Te(new vn(.12,2.6,1.8),new on({color:"#c9a227",roughness:.35,metalness:.8}));d.position.set(6.94,2*H+1.3,-6);Ce.add(d)}   // lift door
rail(17.6,11,2*H,1.83);
rail(6,2.17,2*H,-10.9,PI/2); rail(6,2.17,2*H,-1.2,PI/2);
rail(4,4.2,2*H,-13.83); rail(9.8,14.9,2*H,-13.83);
rail(15.6,19.83,2*H,-6,PI/2);
// ---------- north-east terrace (level 3) ----------
An(gc(8,4.8,5),30,2*H,-26.5); An(gc(6,4.6,5),32.6,2*H,-18,-PI/2);
parapet(20,Z0,20,-24.6,2*H); parapet(20,-19.4,20,-14,2*H); parapet(20,-14,26.4,-14,2*H); parapet(29.6,-14,X1,-14,2*H);
stair(28,H,-8.88,0,-1);                            // stairs 7: east court → north-east terrace
// ---------- east courts ----------
wall(26.7,-2,X1,-2,H,3); An(Zu(5.4),24,H,-2);      // archway 3
wall(20,-2,21.3,-2,H,3);
An(mc({n:3,roof:"shed"}),34.1,H,3.2,-PI/2);
cyp(22,H,-12,6); cyp(34,H,-11,7);
// ---------- U-shaped arcade above the pool ----------
An(mc({n:6}),34.1,H,19.2,-PI/2);                   // the bar of the U, roof terrace
An(mc({n:3,roof:"shed"}),27,H,9.9);                // north arm
An(mc({n:3,roof:"shed"}),27,H,28.1,PI);            // south arm
An(Zu(5.4),10.4,H,12,PI/2); An(Zu(5.4),10.4,H,26,PI/2);     // archways 4 + 5 at the head of the stairs
parapet(10.2,14.7,10.2,23.3,H); parapet(10.2,8,10.2,9.3,H); parapet(10.2,28.7,10.2,Z1,H);
stair(4.88,0,12,1,0); stair(4.88,0,26,1,0);        // stairs 5 + 6: pool terrace → U court
An(_c(6,1,.8),18,H,19,PI/2); cyp(14,H,19,6.5);
parapet(10,Z1,X1,Z1,H);
// ---------- pool terrace (level 1) ----------
An(ju({size:9,depth:0}),-8,0,19);
rail(33.6,-7,0,Z1-.2);
An(Yu({size:6}),-19.5,0,25.5);                     // look-out pavilion in the corner
for(const [x,z,l,r] of [[-2,11,7,0],[-14,11,6,0],[-23,17,5,PI/2]]) An(_c(l,.9,.8),x,0,z,r);
cyp(1,0,28,7); cyp(-1.5,0,13.5,6); cyp(-12,0,28,6.5);
// ---------- west strip (level 1): garage, house, west gate ----------
An(mc({n:4,roof:"shed"}),-34.1,0,16,PI/2);         // garage
An(gc(7,5,6),-30.5,0,-23,PI/2);
cyp(-33,0,-8,7); cyp(-33,0,6,6.5); cyp(-26,0,-28,7);
rail(11.6,-30,0,Z1-.2);
let grp=gi(B,"anwesen");Ce.add(grp);
}
var Ec={children:[]},Tc=Ec,Na=Ec,wc=Ec;
'''
out=src[:a]+layout+src[b:]
old=out[out.index('yc={"Anlage 2"'):out.index(',Ac=document.createElement')]
new='yc={"Übersicht":[[-6,34,62],[2,2,0]],"Tor":[[4,7,-50],[4,5,-30]],"Torhof":[[3,9,-13.5],[4,3.5,-30]],"Villa":[[-14,9,6],[10,7,-7]],"Pool":[[-22,6,31],[0,2,14]],"U-Hof":[[12,6.5,19],[34,4,19]],"Garten":[[-9,6,-13],[-20,3.5,-26]],"Westtor":[[-22,5,2],[-36,2,0]],"Von oben":[[0,95,1],[0,0,0]]}'
out=out.replace(old,new).replace('ed(...yc["Anlage 2"])','ed(...yc["Übersicht"])').replace('<title>Mediterrane Bauteile</title>','<title>Anwesen Entwurf</title>')
out=out.replace('left:-30,right:30,top:30,bottom:-30,far:90','left:-55,right:55,top:55,bottom:-55,far:140').replace('Ce.fog=new Bs("#b9d3ea",60,160)','Ce.fog=new Bs("#b9d3ea",90,260)')
open('Anwesen_Entwurf.html','w').write(out)
print(len(out))
