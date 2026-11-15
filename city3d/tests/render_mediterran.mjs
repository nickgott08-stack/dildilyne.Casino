// baut die Vorschau und macht Bilder: node tests/render_mediterran.mjs <ausgabeordner>
import { build } from 'esbuild';
import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const r = await build({ entryPoints: ['tests/preview_mediterran.js'], bundle: true, write: false, format: 'iife' });
const html = `<!doctype html><html><body style="margin:0;overflow:hidden"><script>${r.outputFiles[0].text}</script></body></html>`;
fs.writeFileSync(out + '/med_preview.html', html);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await pg.goto('file://' + fs.realpathSync(out) + '/med_preview.html');
await pg.waitForFunction('window.ready', null, { timeout: 120000 });
console.log(JSON.stringify(await pg.evaluate('window.info')), errs);
const views = { gesamt: [-6, 14, 34, 2, 2, -2], torbogen: [-9, 3.2, 17, -13, 3.5, 6], bogengang: [6, 3, 10, 2, 3, -4], pavillon: [6, 5, 16, 14, 4, 4], innen: [9, 1.7, -3.7, -4, 2.4, -4.4], pultdach: [-4, 4, 6, -12, 2.5, -6], set2: [60, 11, 27, 60, 1.5, 0], zwischen: [58.5, 2.2, 5, 60, 3.6, -5.3], treppe: [54.5, 2.6, 13, 50, 1.3, 5.5], gelaender: [61, 1.8, 3.6, 67, 0.5, 0], pool: [70.5, 4.2, 10.5, 66, -0.3, 5], pooloben: [66, 9, 5.01, 66, 0, 5] };
const want = process.argv.slice(3);
for (const [k, v] of Object.entries(views)) {
  if (want.length && !want.includes(k)) continue;
  await pg.evaluate((v) => window.shot(...v), v);
  await pg.screenshot({ path: `${out}/med_${k}.png` });
}
await b.close();
