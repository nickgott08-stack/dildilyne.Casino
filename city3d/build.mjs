import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: ['es2020'], legalComments: 'none' });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('template.html', 'utf8');
const VER = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(', ', ' ');
const out = html.split('/*BUNDLE*/').join(js).split('/*VER*/').join(VER); // version shown in the pause menu
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/dildi_city_3d.html', out);
console.log('ok', (out.length/1024).toFixed(0)+' KB');
