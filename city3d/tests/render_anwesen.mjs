// baut Anwesen_Entwurf.html (zum Anschauen am Handy) und macht Bilder: PW=… node tests/render_anwesen.mjs <ordner> [Ansicht …]
import { build } from 'esbuild';
import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const r = await build({ entryPoints: ['tests/preview_anwesen.js'], bundle: true, minify: true, write: false, format: 'iife' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.writeFileSync(out + '/Anwesen_Entwurf.html', `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,user-scalable=no"><title>Anwesen Entwurf</title></head><body style="margin:0;overflow:hidden"><script>${js}</script></body></html>`);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await pg.goto('file://' + fs.realpathSync(out) + '/Anwesen_Entwurf.html');
await pg.waitForFunction('window.ready', null, { timeout: 180000 });
console.log(JSON.stringify(await pg.evaluate('window.info')), errs);
const want = process.argv.slice(3);
for (const k of await pg.evaluate('window.views')) {
  if (want.length && !want.includes(k)) continue;
  await pg.evaluate((k) => window.go(k), k);
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${out}/anw_${k.replace(/\W+/g, '_')}.png` });
}
await b.close();
