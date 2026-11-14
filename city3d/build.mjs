import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: ['es2020'], legalComments: 'none' });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('template.html', 'utf8');
const out = html.split('/*BUNDLE*/').join(js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/dildi_city_3d.html', out);
console.log('ok', (out.length/1024).toFixed(0)+' KB');
