# Dildilyne Casino – Regeln für Claude

Spaß-Casino von Nick mit dem 3D-Spiel **Dildi City** (three.js). Nick hat **keinen Computer**: er spielt und testet
nur am Handy (Android) und iPad (Chrome). Alles läuft über Pull Requests auf GitHub.

## Arbeitsweise
- Immer **Deutsch** antworten, kurz und ehrlich (auch sagen, was nicht geklappt hat oder nicht getestet ist).
- Vor größeren oder Geschmacks-Entscheidungen kurz fragen; kleine Dinge einfach machen.
- Änderungen als **Pull Request** vorbereiten. **Übernehmen (mergen) nur, wenn Nick es sagt** („mach du“, „ja, mach den Pull“, „weiter“ nach der Frage).
  Danach den Arbeits-Branch auf `origin/main` zurücksetzen.
- Nach dem Mergen ist alles automatisch live: GitHub Pages (Casino, ~1 Min.) und Render (Online-Server, ~3–5 Min.).
- Token sparen: kleine Änderungen nur gezielt prüfen, große Playwright-Tests nur bei größeren Umbauten oder wenn Nick es will.

## Wichtige Dateien
- `dildilyne_casino_koop.html` – das Casino (eine große Datei). Das Spiel steckt darin in der Zeile `var GTAHTML=…`.
- `city3d/` – Quellcode von Dildi City 3D, **Details in `city3d/HANDOFF.md` (zuerst lesen bei Spiel-Aufgaben)**.
- `city3d/src/dildi_cars.js` – Nicks eigene Modelle (Autos, Gebäude, Kreuz, Laternen). Bei einer neuen Version von Nick
  **nur die neuen Teile übernehmen**; unsere Anpassungen darin bleiben (Raute in `kreuzRoads`, `glowMat`/`cull` bei den Laternen,
  `KREUZ_EXTRAS`-Positionen).
- `server/server.js` – Online-Server (Render, https://dildilyne-casino-1.onrender.com), Räume mit max. 10 Spielern, Koop-Crews.
- `tools/patch_season1*.py` – dokumentieren die Saison-1-Änderungen im Casino.

## Nach jeder Spiel-Änderung
```
cd city3d && node build.mjs && cd .. && node tools/embed_city.mjs
```
(baut `city3d/dist/dildi_city_3d.html` und setzt es ins Casino ein). Beides committen. `city3d/HANDOFF.md` aktuell halten.

## Season 1 (Sigma Season, Start Mo 16.11.2026)
- Alles Neue der Season ist an `ssOn()` (Casino) bzw. `season.on` (Dildi City) gekoppelt – **vor dem Start darf sich nichts ändern**.
- Finale-Wochen-Limit gilt erst ab Saisonstart.

## Testen
- Playwright + Chromium sind installiert (SwiftShader, langsam). Im Headless-Browser läuft die Bildschleife des Spiels nicht:
  zum Testen `G.step(n)`, `G.distCull()`, `G.renderer.render(G.scene, G.camera)` benutzen. `window.G` ist offen.
- Online/Koop lokal: `PORT=8099 node server/server.js`, Spiel mit `?server=ws://localhost:8099/ws` öffnen.

## Links
- Casino: https://nickgott08-stack.github.io/dildilyne.Casino/
