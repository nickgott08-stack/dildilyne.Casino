import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1100,'height':620})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        await pg.goto('file:///home/claude/dc3d/dist/dildi_city_3d.html')
        await pg.wait_for_timeout(4000)
        await pg.evaluate("document.getElementById('startBtn').click()")
        await pg.wait_for_timeout(2000)
        await pg.evaluate("G.step(1500)")
        await pg.evaluate("G.player.pos.set(400,G.groundAt(400,0),0);G.step(900)")
        await pg.wait_for_timeout(5000)
        print(await pg.evaluate("JSON.stringify({v:G.vehicles.length,p:G.peds.length,ring:G.phoneRing})"))
        print(errs)
        await b.close()
asyncio.run(main())
