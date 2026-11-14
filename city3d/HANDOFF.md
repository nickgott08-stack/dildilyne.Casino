# Dildi City 3D – Übergabe

GTA-artiges 3D-Spiel (Three.js r187) für das Minicasino **Dildilyne**. Läuft am Handy/iPad im Browser,
gehostet über GitHub Pages. Sprache im Spiel und mit Nick: **Deutsch**.

## Bauen
```
npm install            # three + esbuild
node build.mjs         # bündelt src/ in template.html  ->  dist/dildi_city_3d.html (eine Datei, ~1,1 MB)
```
Tests liefen mit Playwright (headless Chrome, SwiftShader); die Skripte `t*.py` sind schnelle Prüf-Skripte
(z. B. `t19.py` = komplettes Coup-Finale per Autopilot, `t6.py` = Langzeitlauf auf Fehler, `t13.py` = Garagen/Docks-Coup).
Im Spiel ist `window.G` zum Testen offen (`G.step(n)` simuliert n Frames).

## Dateien (src/)
- `main.js` – Spielschleife, Spieler, Waffen, Polizei/Fahndung, HUD, Shop & Wechselstube, Qualitätsstufen + dynamische Auflösung, Flugzeug-Steuerung
- `world.js` – Stadt (6×6 Blöcke), Sonderblöcke (Bank, Casino, Pizza, Customs, Parks …), Kollision (`addBox`/`addCirc`), `groundAt`
- `geo.js` – Gelände, Wüsten, Pässe, Straßen (ROADS), POIs, Radj-Insel-Höhen (`radjGround`)
- `outskirts.js` – Gelände-Mesh, Docks, Flughafen, Wüsten-Orte
- `vehicles.js` – Fahrzeuge & Physik, Tuning (Spoiler/Panzerung/Neon/Tieferlegen), LOD-Klotz für ferne Autos
- `dildi_cars.js` – **Nicks eigene Modelle** (Autos, Flugzeug, Fassaden, Docks/Flughafen-Deko) – `globalThis.DildiCars`
- `ai.js` – Passanten, Wachen, Verkehr (Stadt/Wüste, Stau-Auflöser), Polizei (80 % Tempo des Spielerautos)
- `missions.js` – Garagen + Autokauf, Flaschenpost, Pizza Capri, Bankraub (nur mit eigenem RS6), Docks-Coup (nur eigener Transporter), Dildi Customs, Telefonzellen-Aufträge (alle ~4 Min)
- `heist.js` – Radj-Coup: Planungsbrett, Missionen 1–4, Finale, Glasschneider-Minispiel
- `radj.js` – Radj-Insel (Piste, Waldweg mit Brücke, Anwesen, Keller, Helikopter)
- `plane.js` – Flugzeug-Flugmodell
- `route.js` / `map.js` – GPS-Routen, Minikarte, große Karte
- `template.html` – HUD, Menüs, CSS

## Casino-Anbindung
Im Casino läuft das Spiel im iframe: das Casino ersetzt `/*GCFG*/null` durch `{bits, sv}` und hört auf
`postMessage({gta:'bits'|'save'|'exit'})`. Der Spielstand liegt dann in `sv.d3`. Kurs: 10 D$ = 1 Bit.
**Offen:** Im Casino (`dildilyne_casino_koop.html`) ist noch das alte 2D-Dildi-City eingebaut – austauschen.

## Nicks Wünsche / Arbeitsweise
- Vor größeren Änderungen kurz den Plan bestätigen lassen; immer ehrlich sagen, was (nicht) klappt.
- Qualität vor Dateigröße; testet selbst am Handy/iPad.
- Läuft auf „Mittel“ flüssig (Stand 14.11.2026).

## Offene Punkte
- Echte Bits-Wechselstube erst nach Einbau ins Casino.
- Finale/Landung/Schleichen: Schwierigkeit nach Nicks Test feinjustieren.
- Koop (zu viert) für den Coup: bewusst später.
