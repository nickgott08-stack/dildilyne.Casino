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
// Versionsanzeige im Casino (☰-Menü der Lobby): Zeitpunkt dieses Einbaus
const VER = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(', ', ' ');
const vi = lines.findIndex((l) => l.includes('DD_VER="'));
if (vi < 0) throw new Error('DD_VER nicht gefunden');
lines[vi] = lines[vi].replace(/DD_VER="[^"]*"/, 'DD_VER="' + VER + '"');
fs.writeFileSync(CASINO, lines.join('\n'));
console.log(`Version ${VER} · Dildi City 3D eingebaut (${(game.length / 1024).toFixed(0)} KB) -> ${CASINO} (${(fs.statSync(CASINO).size / 1024 / 1024).toFixed(2)} MB)`);
