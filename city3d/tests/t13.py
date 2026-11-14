import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True)
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        await pg.goto('file:///home/claude/dc3d/dist/dildi_city_3d.html')
        await pg.wait_for_timeout(4000)
        await pg.evaluate("document.getElementById('startBtn').click()")
        await pg.wait_for_timeout(1500)
        E=pg.evaluate
        print('start', await E("JSON.stringify({car:G.myCar&&G.myCar.type,mine:G.myCar&&G.myCar.mine,d:G.myCar&&Math.round(Math.hypot(G.myCar.pos.x-G.player.pos.x,G.myCar.pos.z-G.player.pos.z)),garages:G.world.garages.map(g=>g.name)})"))
        await pg.screenshot(path='shots/n_start.png')
        # garage NO: buy van
        await E("(()=>{const g=G.world.garages.find(g=>g.name==='Garage Nordost');G.player.pos.set(g.x,G.groundAt(g.x,g.z),g.z);G.step(2);G.missions.contextHint().run()})()")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/n_garage.png')
        await E("document.querySelectorAll('#garageList .gcar')[1].click()")
        print('poor buy', await E("JSON.stringify({m:G.money,in:G.player.inVehicle&&G.player.inVehicle.type})"))
        await E("G.money=60000;(()=>{const g=G.world.garages.find(g=>g.name==='Garage Nordost');G.missions.openGarage(g)})();document.querySelectorAll('#garageList .gcar')[1].click()")
        print('buy van', await E("JSON.stringify({m:G.money,in:G.player.inVehicle&&G.player.inVehicle.type,mine:G.player.inVehicle&&G.player.inVehicle.mine,own:localStorage.getItem('dc3d_owned')})"))
        # docks
        await E("(()=>{const v=G.player.inVehicle,d=G.world.docksCargo;v.pos.set(d.x,G.groundAt(d.x,d.z),d.z);v.vF=0;v.vel.set(0,0);G.step(3);const h=G.missions.contextHint();window._h=h&&h.text;h.run();G.step(120)})()")
        print('docks', await E("window._h"), await E("JSON.stringify({job:G.missions.job&&G.missions.job.stage,stars:G.wanted.stars,lock:G.wanted.lock,t:G.missionTarget})"))
        await E("G.step(600)")
        print('stars after 20s', await E("G.wanted.stars"))
        await E("(()=>{const v=G.player.inVehicle,h=G.world.hideout;v.pos.set(h.x,G.groundAt(h.x,h.z),h.z);G.step(5)})()")
        print('delivered', await E("JSON.stringify({job:!!G.missions.job,stars:G.wanted.stars,m:G.money,cd:localStorage.getItem('dc3d_docksCD')>Date.now()})"))
        # call popup position
        await E("G.missions.phone.next=0;G.step(2)")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path='shots/n_call.png')
        await E("document.getElementById('callNo').click()")
        # jam test: simulate 4000 steps & count jammed removals
        await E("G.player.inVehicle&&(G.player.inVehicle.driver=null,G.player.inVehicle=null);G.player.pos.set(0,0.2,0);")
        r = await E("""(()=>{let jams=0,max=0;for(let i=0;i<60;i++){G.step(60);const s=G.vehicles.filter(v=>v.driver&&v.driver.blockT>4).length;max=Math.max(max,s);}return JSON.stringify({maxBlocked:max,veh:G.vehicles.length})})()""")
        print('jam', r)
        print(errs)
        await b.close()
asyncio.run(main())
