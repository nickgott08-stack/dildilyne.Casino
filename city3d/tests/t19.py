import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':844,'height':390})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/dc3d/dist/dildi_city_3d.html')
        await pg.evaluate("localStorage.setItem('dc3d_coup','4');localStorage.removeItem('dc3d_coupWeek')")
        await pg.reload()
        await pg.wait_for_timeout(4500)
        await pg.evaluate("document.getElementById('startBtn').click()")
        await pg.wait_for_timeout(1000)
        E=pg.evaluate
        print('tris', await E("G.renderer.info.render.triangles"))
        await E("G.missions.beginFinale()")
        # RS6 to the runway
        await E("""(()=>{const V=G.vehicles[0].constructor;const v=new V(G.missions.scene,'rs6',470,85,Math.PI/2);v.mine=true;G.vehicles.push(v);G.myCar=v;G.missions.api.putPlayerInVehicle(v);G.step(5)})()""")
        print('stage', await E("G.missions.job.stage"))
        await E("(()=>{const pv=G.player.inVehicle;pv.driver=null;G.player.inVehicle=null;G.missions.api.refreshControls();const pl=G.missions.plane;G.player.pos.set(pl.pos.x-3,pl.pos.y,pl.pos.z+3);G.step(2);G.missions.contextHint().run()})()")
        print('fly', await E("G.missions.job.stage"), await E("!!G.flight"))
        r = await E("""(()=>{
          const pl=G.flight; const inp=G.input; let log=[]; let phase='takeoff';
          const RZ=-1079, gR=G.groundAt(-40,-1079,1e9);
          const steerTo=(tx,tz,k=2)=>{const w=Math.atan2(tx-pl.pos.x,tz-pl.pos.z);let e=w-pl.h;while(e>Math.PI)e-=2*Math.PI;while(e<-Math.PI)e+=2*Math.PI;return Math.max(-1,Math.min(1,-e*k));};
          const holdAlt=(a)=>{const err=a-pl.pos.y; const wantVy=Math.max(-8,Math.min(14,err*0.4)); return wantVy>pl.vy+0.5?1:wantVy<pl.vy-0.5?-1:0;};
          for(let i=0;i<30*400 && G.flight;i++){
            let steer=0,thr=1,pin=0;
            if(phase==='takeoff'){ if(pl.speed>23) pin=1; if(!pl.onGround&&pl.alt>12) phase='c1'; }
            else if(phase==='c1'){ steer=steerTo(360,-500); pin=holdAlt(140); if(Math.hypot(360-pl.pos.x,-500-pl.pos.z)<60) phase='c2'; }
            else if(phase==='c2'){ steer=steerTo(330,-1000); pin=holdAlt(60); thr=0.5; if(Math.hypot(330-pl.pos.x,-980-pl.pos.z)<40) phase='base'; }
            else if(phase==='base'){ steer=steerTo(250,RZ); pin=holdAlt(40); thr=0.3; if(Math.hypot(250-pl.pos.x,RZ-pl.pos.z)<30) phase='final'; }
            else if(phase==='final'){ steer=steerTo(pl.pos.x-70,RZ,2.5); const dist=pl.pos.x-60; const want=gR-3+Math.max(0,dist)*0.22; pin=holdAlt(want); thr=dist>80?0.3:-1; if(pl.onGround) phase='roll'; }
            else if(phase==='roll'){ steer=steerTo(pl.pos.x-60,RZ,1.5); thr=-1; }
            inp.steering=()=>steer; inp.throttle=()=>thr; inp.pitchUp=pin>0; inp.pitchDown=pin<0;
            G.step(1);
            if(i%300===0||(phase==='final'&&i%15===0)) log.push([phase,Math.round(pl.pos.x),Math.round(pl.pos.y*10)/10,Math.round(G.groundAt(pl.pos.x,pl.pos.z,1e9)*10)/10,pl.kmh,Math.round(pl.vy*10)/10,Math.round(pl.pitch*100)/100,pl.onGround?1:0]);
            if(pl.crashed){log.push(['CRASH',Math.round(pl.pos.x),Math.round(pl.pos.z)]);break;}
          }
          inp.steering=()=>0; inp.throttle=()=>0; inp.pitchUp=false; inp.pitchDown=false;
          return JSON.stringify({log,stage:G.missions.job&&G.missions.job.stage,flight:!!G.flight});
        })()""")
        print(r[:3000])
        await pg.wait_for_timeout(500); await pg.screenshot(path='shots/f_island.png')
        print('sentries', await E("G.missions.job.sentries.length"))
        # sneak behind gate guard and take him out
        await E("""(()=>{const g=G.missions.job.gateGuard;G.step(1);const fx=Math.sin(g.yaw),fz=Math.cos(g.yaw);G.player.pos.set(g.pos.x-fx*1.5,g.pos.y,g.pos.z-fz*1.5);G.missions.job.stage='gate';G.step(1);const h=G.missions.contextHint();window._h=h&&h.text;h&&h.run();G.step(10)})()""")
        print('takedown', await E("window._h"), await E("JSON.stringify({gd:G.missions.job.gateGuard.dead,alarm:G.missions.job.alarm,cards:(G.missions.job.cards||[]).length})"))
        await E("(()=>{const c=G.missions.job.cards[0];G.player.pos.set(c.x,G.groundAt(c.x,c.z),c.z);G.step(3);G.player.pos.set(40,G.groundAt(40,-1265),-1265);G.step(2);const h=G.missions.contextHint();window._h=h&&h.text;h&&h.run();G.step(2)})()")
        print('gate', await E("window._h"), await E("G.missions.job.stage"))
        # night screenshot inside the estate
        await E("(()=>{G.player.pos.set(40,G.groundAt(40,-1285),-1285);G.cam.yaw=Math.PI;G.step(20)})()")
        await pg.wait_for_timeout(600); await pg.screenshot(path='shots/f_estate.png')
        print('alarm?', await E("G.missions.job.alarm"))
        await E("(()=>{const h=G.missions.job.holder;h.hit(999,G,0,1,true);G.step(3);const c=G.missions.job.cards.find(c=>c.kind==='lift');G.player.pos.set(c.x,G.groundAt(c.x,c.z),c.z);G.step(3)})()")
        print('lift stage', await E("G.missions.job.stage"))
        await E("(()=>{const L={x:42,z:-1320};G.player.pos.set(L.x,G.groundAt(L.x,-1318),-1318);G.step(2);const h=G.missions.contextHint();window._h=h&&h.text;h&&h.run()})()")
        print('lift hint', await E("window._h"))
        await pg.wait_for_timeout(2300)
        print('cellar', await E("JSON.stringify({st:G.missions.job.stage,y:G.player.pos.y})"))
        await E("(()=>{G.player.pos.set(316,-40,-1237.5);G.step(2);G.missions.contextHint().run();G.missions.closeCutter(true);G.step(5)})()")
        await pg.wait_for_timeout(300); await pg.screenshot(path='shots/f_cellar.png')
        await E("(()=>{const h=G.missions.contextHint();window._h=h&&h.text;h&&h.run()})()")
        print('prize', await E("window._h"), await E("G.missions.job.stage"))
        await E("(()=>{G.player.pos.set(316,-40,-1214);G.step(2);G.missions.contextHint().run()})()")
        await pg.wait_for_timeout(2300)
        print('escape', await E("JSON.stringify({st:G.missions.job.stage,alarm:G.missions.job.alarm})"))
        await E("G.player.hp=1e6;G.step(60)")
        print("after60", await E("JSON.stringify({job:!!G.missions.job,st:G.missions.job&&G.missions.job.stage,dead:G.player.dead})"))
        await E("(()=>{G.player.pos.set(-186,G.groundAt(-186,-1328),-1328);G.player.hp=100;G.step(2);const h=G.missions.contextHint();window._h=h&&h.text;h&&h.run()})()")
        print('heli', await E("window._h"))
        await pg.wait_for_timeout(400); await pg.screenshot(path='shots/f_win.png')
        print('won', await E("JSON.stringify({m:G.money,week:localStorage.getItem('dc3d_coupWeek'),job:!!G.missions.job,pos:[Math.round(G.player.pos.x),Math.round(G.player.pos.z)]})"))
        print(errs[:10]); await b.close()
asyncio.run(main())
