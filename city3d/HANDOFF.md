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
**Erledigt (14.11.2026):** Das 3D-Spiel ersetzt im Casino das alte 2D-Dildi-City. Nach jeder Änderung:
`cd city3d && node build.mjs && cd .. && node tools/embed_city.mjs` (ersetzt die Zeile `var GTAHTML=…` im Casino).
Im Casino wird der Casino-Name als Online-Name vorgeschlagen; Online-Server = `DEFAULT_SERVER` in `online.js`.

## Nicks Wünsche / Arbeitsweise
- Vor größeren Änderungen kurz den Plan bestätigen lassen; immer ehrlich sagen, was (nicht) klappt.
- Qualität vor Dateigröße; testet selbst am Handy/iPad.
- Läuft auf „Mittel“ flüssig (Stand 14.11.2026).

## Offene Punkte
- Echte Bits-Wechselstube erst nach Einbau ins Casino.
- Finale/Landung/Schleichen: Schwierigkeit nach Nicks Test feinjustieren.
- Koop (zu viert) für den Coup: bewusst später.

## Online-Modus (bis zu 10 Spieler) – Stand 14.11.2026
- `src/online.js`: Pausenmenü → „🌐 Online spielen“ (Name, Raum, Hoodie-Farbe, Chat). Sendet 10×/s Position,
  Fahrzeug (Typ, Farbe, Richtung) bzw. Flugzeug; andere Spieler werden 150 ms verzögert interpoliert,
  mit Namensschild und Punkt auf der Minikarte (`G.friends`). Fremde Autos sind nur Modelle (keine Kollision).
- `server/server.js` (Node + ws): liefert unter `/` das gebaute Spiel aus, WebSocket unter `/ws`, `/status` zeigt die Räume.
  Max. 10 pro Raum, 10 Snapshots/s, Eingaben werden geprüft und gedrosselt.
- Server-Adresse: `?server=wss://…/ws` in der URL, im Online-Menü unter „Server“, sonst gleicher Host
  (wenn vom Server ausgeliefert), sonst `DEFAULT_SERVER` in `online.js`.
- Deployment: Render-Webservice https://dildilyne-casino-1.onrender.com (Free Tier, schläft nach ~15 Min ohne Besucher ein; Auto-Deploy von `main`). `render.yaml` im Repo-Root.
- Lokal testen: `cd city3d && node build.mjs && cd .. && node server/server.js` → http://localhost:8080

## Performance (14.11.2026)
- Messung: Spiellogik ~1–2 ms/Frame, ~380 Draw-Calls, ~380k Dreiecke inkl. Schattenpass – Engpass am Handy ist die Pixelberechnung.
- Unsichtbare Lichter kosten pro Pixel trotzdem: Mündungsfeuer-/Explosions-Punktlichter nur auf „Hoch“, Scheinwerfer auf „Hoch“+„Mittel“
  (`QUALITY.fxLights/headLight`, umgeschaltet in `applyQuality`, dort werden die Shader neu gebaut).
- „Mittel“: Schattenbereich ±62 m statt ±90 m (schärfer bei 1024er-Map), Schatten nur jedes 2. Bild neu (`shadowEvery`).
- Passanten werfen nur in der Nähe Schatten (`pedShadow`-Meter, `pedShadow()` in main.js) – spart viele Draw-Calls im Schattenpass.
- Pausenmenü: „📊 FPS-Anzeige“ (FPS, Stufe, Auflösungsfaktor) zum Testen am Handy.

## Radj-Insel überarbeitet (14.11.2026)
- Karte: reicht jetzt bis z ≈ −1490, die Insel wird in `drawRadjIsland()` (map.js) gezeichnet (Strand, Wald, Wege, Landebahn,
  Anwesen, Villa, Pool, Heli-Platz). Minikarte zeigt im Finale die Taschenlampen-Kegel der Wachen (gelb, rot nach Alarm;
  gleiche Reichweite/Winkel wie die Erkennung in heist.js).
- Wald: instanzierte Kiefern (3 Kegel), Laubbäume (Icosaeder-Gruppen) und Büsche, flat-shaded wie die Stadtbäume; gleiche Positionen/Kollision.
- Waldweg: Schotter-Textur mit Spurrillen und Grasrand (`gravelRoad`), Feldsteine statt weißer Bordsteine.
- Villa: Sockel, Gesimse, Eckquader, Walmdächer in Terrakotta (`hipRoof`), Mittelgiebel mit goldenem Rundfenster (`gable`),
  weiße Fensterrahmen, Fenster aus dunklem Glas die nachts leuchten (`world.windowMats`), Balustraden. Kollision/Aufzug unverändert.

## Finale & Sound (14.11.2026)
- Finale: jedes Auto reicht für die Fahrt zur Landebahn (vorher nur der eigene RS6). Bankraub braucht weiterhin den RS6.
- Anwesen: kein Schleich-Tempo mehr (`G.walkMul = 0`), Gehen/Rennen wie überall.
- Motorsound: 5-Gang-Drehzahl (fällt beim Schalten), im 5. Gang mittlere Drehzahl; nach ~3 s Vollgas bei Höchsttempo
  wird der Motor leiser/dumpfer (`cruise` in `audio.engine`), weicherer Klang (Dreieck statt Rechteck, tieferer Filter).
