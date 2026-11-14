// Baut Dildi City 3D in das Casino ein: ersetzt die Zeile `var GTAHTML="…";` in
// dildilyne_casino_koop.html durch das aktuelle city3d/dist/dildi_city_3d.html.
// Aufruf (im Repo-Root):  node tools/embed_city.mjs
import fs from 'fs';
const CASINO = 'dildilyne_casino_koop.html';
const GAME = 'city3d/dist/dildi_city_3d.html';
const game = fs.readFileSync(GAME, 'utf8');
if (game.split('/*GCFG*/null').length !== 2) throw new Error('/*GCFG*/null muss genau einmal im Spiel stehen');
const lines = fs.readFileSync(CASINO, 'utf8').split('\n');
const idx = lines.findIndex((l) => l.startsWith('var GTAHTML='));
if (idx < 0) throw new Error('var GTAHTML= nicht gefunden');
// JSON-String, dazu </ entschärfen, damit der <script>-Block des Casinos nicht endet
const lit = JSON.stringify(game).replace(/<\//g, '<\\/');
lines[idx] = 'var GTAHTML=' + lit + ';';
fs.writeFileSync(CASINO, lines.join('\n'));
console.log(`Dildi City 3D eingebaut (${(game.length / 1024).toFixed(0)} KB) -> ${CASINO} (${(fs.statSync(CASINO).size / 1024 / 1024).toFixed(2)} MB)`);
