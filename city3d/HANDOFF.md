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

## Saison 1 – neue Wirtschaft (Start Mo 16.11.2026)
Casino-Änderungen per `tools/patch_season1.py` (einmalig angewendet, dokumentiert die Stellen):
- Saison-Reset (`ssApply`): alles auf 0 (Bits, Euro, Erfolge, Sigma-Pass, Skins, Rekorde, Dildi City), es bleiben nur
  Karten + Shop-Käufe (items/buys/packs/noAds) und Technisches (adm, bx, cm, Fischmarkt-Angebote lst/sacc/srej, arch).
  Doppelte Karten → Händlerpreis. Sparschwein `pig` = Bits + Euro×100 + D$ (alt /10) + Doppelte×100 + Anteile/Aktien×100,
  nur Anzeige (Saison-Ansage + Profil).
- Rangliste `mkTabs()` = nur Rekord-Kategorien; `mkTabsAll()` = alle (für Saison-0-Archiv/Meisterschaft „Saison 0“).
- `ssW()` Saisonwoche 0–4, `ssDay()` Tag 0–29, `ssM()` Faktor 1/1,25/1,5/1,75/2 für Minispiele, Erfolge (`ACHB`), Wochenaufgaben (`WK.r`).
- Hafen-Fang ~500/Runde (Fang-Wert und Deckel ×2, gleiche Fisch-Dichte), Memory und Flugschule halbiert – erst ab Saisonstart (`ssOn()`, `fsEco()`), ebenso die Rekord-Rangliste. Kippen alle 5 Min.
- Einsätze: kleines Pferderennen + Boxen max. 1.000; großes Pferderennen max 5k/10k/25k (Woche 1/2/3+), 50-%-Knopf, ALL-IN ab Woche 3.
  Der Coup (Roulette) 1 h zwischen Missionen.
- Dildi City bekommt `sd`/`wk`/`son` in GCFG.
Dildi City (Quellcode):
- Kurs 1 D$ = 1 Bit, alte D$ einmalig /10 (`dc3d_eco2`), Preise /10, alle Job-Bezahlungen über `ecoPay()` (alt/10 × Wochen-Faktor),
  Radj-Finale fest 150.000 (1×/Woche). Tauschgrenze D$→Bits pro Tag 10.000 + 5.000 × Saisontag, ab Tag 24 unbegrenzt.
- Bankraub + Docks-Coup: alle 30 Min, max. 10× pro Tag (`robCheck`/`robDone`).
- **Alles erst ab Saisonstart** (`ssOn()` im Casino, `season.on` in Dildi City – im Casino über GCFG.son, sonst Datum 16.11.2026):
  Einsätze, Kippen, Coup-Wartezeit (`hkh()`), Minispiel-Werte, Rangliste, Dildi-City-Kurs/Preise (`P10`)/Bezahlung/Raub-Regeln.
  D$ werden je nach Zustand umgerechnet (`dc3d_eco2` = '1' neuer Maßstab, '0' alter); das Sparschwein liest das Flag.
  Patch-Skripte: `tools/patch_season1.py`, `tools/patch_season1_gate.py`, `tools/patch_season1_gate2.py`.

## Flüssiger / nicht mehr pixelig (14.11.2026)
- Bug: die Radj-Insel wurde immer gezeichnet (`visible = null` statt `false` in missions.js) – ~150k Dreiecke gespart.
- Außenbereich (Straßen, Wüsten-Deko, Horizont-Berge) in Kacheln (`tiledMeshes` in util.js); Gelände-Kacheln + diese
  werden hinter der Nebelgrenze ausgeblendet (`distCull` in main.js). Wegweiser-Strahl bleibt sichtbar.
- Automatik: bei <30 FPS (2× hintereinander) zuerst Grafikstufe runter, dann Auflösung, aber nie unter Pixel-Ratio 1.0.

## Passanten, Zeitrennen, Straßen, Bank (14.11.2026)
- Passanten: mehr (hoch 42 / mittel 34 / niedrig 22), erscheinen ab 35 m (außerhalb des Bildes), Sichtbarkeit mit Hysterese
  (an <125 m, aus >140 m) gegen Aufblitzen; Laufspur 2,9–3,4 m vom Gehwegrand (Straßenbäume stehen bei 2,2 m).
- Zeitrennen: Schild über dem Checkpoint zeigt die nächste Richtung (`Marker.arrow`, berechnet in `raceMark`).
- Mittelstreifen außerhalb: von Straßenpunkt zu Straßenpunkt mit Höhe an beiden Enden (kein Schweben an Hängen/Rampen).
- Kamera near 0.3 statt 0.1 (bessere Tiefengenauigkeit, weniger Flackern); Bank-Seitenwände überlappen die Rückwand nicht mehr.
- Kreisverkehr am Ende der Brückenstraße (`KREISEL` in geo.js): Einbahn-Ring (`oneway`), Mittelinsel mit Kollision, auf der Karte.

## Neues Dildi-Kreuz + Jeep (dildi_cars.js v3, 14.11.2026)
- `dildi_cars.js` ersetzt (Nicks Version 3): neue Fahrzeugmodelle jeep/bus/truck (jeep wird automatisch genutzt).
- Straßen des Kreuzes aus `DildiCars.dildiKreuz.roads()` (Hochstraße w14 bei z=-322 + 4 Kleeblatt-Schleifen),
  gezeichnet vom Spiel (Schutzwand-Lücken an Einmündungen), Deko aus `dildiKreuz.decor(THREE, {decks:false})`
  (Schilderbrücken, Skatepark, Rasthof/Tanke, Motel, Plakate) mit Kollision. Laternen werden nicht in Einmündungen gesetzt.
- `deckAt`: pro Hochstraße zählt nur das nächste Segment (geklemmt) – vorher fielen Autos auf der Kurven-Außenseite durch Spalten.

## Shuttle-Bus, Docks-LKW, Hafenkreisel (14.11.2026)
- Fahrzeuge `bus`/`truck` (Werte aus Nicks Datei) in MODELS. `LoopDriver` (ai.js) fährt feste Rundkurse (`buildRoute`) mit Haltestellen,
  hupt bei Blockade (Fußgänger gehen zur Seite) und schiebt sich vorbei. In main.js `updateService`: Bus + LKW werden gehalten,
  sobald der Spieler südlich von z=-380 ist; am Halt „airport“ laufen die Flughafen-Gäste (Hotspot) zur Bustür und steigen ein.
- Kreuzung Brückenstraße × Kaistraße ist jetzt der `HAFENKREISEL` (Straßen geteilt: Brückenstraße/Brückenstraße Süd,
  Kaistraße West/Ost), Wendeschleife am Flughafen-Ende der Kaistraße (`WENDE`). Ringe haben `ring: true`:
  OutDriver kann an jedem Arm ausfahren (`ringExits`), bei nur einem Arm auch zurück.
- Außerhalb der Stadt ignorieren Fahrer entgegenkommende Autos (außer direkt vor der Stoßstange) – vorher Stau an Einmündungen.

## Umfahrbare Laternen & Mülleimer (dildi_cars.js v4)
- Alle Straßenlaternen (Stadt + außen) sind `DildiCars.dildiCityProps`-Laternen (ohne feste Kollision), dazu Mülleimer/Tonnen an
  den Bordsteinen. `world.props.update(dt, G.vehicles)` in simStep; Treffer bremsen das Auto (Laterne ×0.8, Eimer ×0.95),
  beim Spieler-Auto Rumms + Kamerawackeln. Nach 90 s steht alles wieder. Leuchtköpfe = `world.lampHeadMat` (nachts heller).

## Flüge → Ladebildschirm, Laternen-Ausblendung, mehr Leben, Koop-Coup (15.11.2026)
- **Flüge**: Mission 4 und der Finale-Flug sind kein selbst geflogener Flug mehr. Ins Flugzeug steigen → Ladebildschirm
  (`flyTo` in heist.js, Overlay `#travel` in template.html, ~6 s) → Ankunft (`landRunway` / `arriveIsland`). Freies Fliegen gab es
  ohnehin nur in diesen Missionen; `enterPlane`/`plane.js` bleiben im Code, werden aber nicht mehr benutzt.
- **Leistung**: Laternen/Mülleimer (`dildiCityProps`) werden nur noch im Umkreis von 170 m gezeichnet (`cull()` in dildi_cars.js
  sortiert die Instanzen um, aufgerufen aus `distCull` in main.js, wenn sich die Kamera >15 m bewegt hat). Vorher immer alle 464
  Laternen (~90k Dreiecke + Schattenpass). Deko-/Metallteile der Stadt (`plain`/`metal` in world.js) sind jetzt Kacheln in
  `world.cullList`. Gemessen (Docks/Wüste): 330–450k → 75–120k Dreiecke pro Bild.
  Hinweis Tests: im Headless-Browser läuft die Bildschleife nicht – `G.distCull()` ist zum Testen offen.
- **Mehr Leben**: Verkehr hoch/mittel/niedrig 26/21/15, Passanten 48/40/26; Bus, LKW, Jeep fahren im normalen Verkehr mit;
  Leute im Stadtpark und vor dem Casino (`world.extraHotspots`).
- **Koop-Coup** (`src/coop.js`, Server `server/server.js`):
  - Planungsbrett → „👥 Koop-Finale“ → Lobby (nur online, gleicher Raum): Crew gründen / beitreten (max. 4), jeder „Bereit“,
    Anführer startet (mind. 2). Nur der Anführer braucht die Missionen 1–4 und darf das Finale diese Woche noch nicht gemacht haben; Helfer können sofort mitmachen (Knopf immer am Planungsbrett).
  - Server: `t:'crew'` (create/join/leave/done/ready/start) → `crews`-Liste an alle im Raum, `crewgo` (mit `seed`) an die Crew;
    `t:'cev'` wird an die anderen der Crew weitergeleitet. Anführer weg → Crew aufgelöst (`crewx`).
  - Ereignisse (`cx()`): `fly` (wer zuerst einsteigt, nimmt alle mit), `kill` (Wachen-Index), `card`, `gate`, `alarm`, `glass`,
    `prize` (andere: Flucht beginnt), `win` (alle gewinnen), `down` (Spieler raus). Welche Wache die Aufzugkarte trägt: `seeded(seed)`.
  - Beute: Anführer 100.000 (zählt als sein Wochen-Finale `dc3d_coupWeek`), Helfer je 37.500 (1× pro Woche, `dc3d_coupHelpWeek`),
    alleine weiter 150.000. Wer im Finale stirbt, ist raus, bekommt aber seinen Anteil, wenn die Crew entkommt (`coopOut`).
  - Wachen/KI laufen auf jedem Gerät für sich; nur die Ereignisse oben werden abgeglichen.

## Nicks Fotos vom 14.11. abends
- Wochen-Limit fürs Finale (Anführer + Helfer) gilt erst ab Saisonstart (`season.on` in `finaleDone`/`helperPaid`).
- iPad: Spiel-iframe im Casino `inset:0; 100%` statt `100vw/100vh` (unten war ein weißer Streifen über der Auto-Leiste);
  Lenkrad `min(42vh, max(170px, 21vw))`, Joystick auf Tablets größer (Radius aus `#joyBase`).
- Dildi-Kreuz als **Raute**: Kleeblatt-Schleifen ersetzt durch 4 gerade Rampen („Rampe Nordwest“ …, `kreuzRoads` in dildi_cars.js),
  sie zweigen bündig von der Hochstraße ab und münden rechtwinklig in die Hafenstraße (z = −274 / −370).
  OutDriver biegt jetzt auch mitten auf einer Straße in Seitenstraßen ab (`branchesOf` in ai.js) und fädelt in Fahrtrichtung ein.
- Stadtmauer: 1–3 m breite Reststücke neben den Ausfahrten waren 60–80 m hohe „Scheiben“ → jetzt niedrige Anbauten (11 m).
  Zufallszahlen werden wie vorher gezogen, der Rest der Stadt bleibt gleich.
- Dildi-Customs-Halle heller (war fast schwarz); Flaschenpost-Transporter: Schild sitzt auf der Karosserie, klare Schrift.
- **dildi_cars.js v5 (Nicks neue Kreuz-Gebäude)**: nur `kreuzExtras` übernommen (Wasserturm, Funkmast, Solarpark, Park mit DILDI-Buchstaben,
  Drive-in „Dildi Burger“, Waschstraße, Autobahnmeisterei mit Salzkuppel, Kiosk + Bushaltestelle). Die Positionen stehen jetzt in
  `KREUZ_EXTRAS` (passend zur Raute statt zu den alten Kleeblatt-Schleifen), Kollision über `userData.colliders` wie die übrige Deko.
  Unsere Änderungen an der Datei (Raute in `kreuzRoads`, `glowMat`/`cull` bei den Laternen) bleiben – bei einer neuen Version von Nick
  wieder nur die neuen Teile übernehmen.

## Nicks Fotos vom 15.11. (FPS, Kreuz-Rampen, Tankstelle)
- **FPS**: Messung (Mittel) zeigte: Spiellogik unkritisch (~1 ms), aber Draw-Calls in der Stadt 237 → 415 seit „Mehr Leben“ + Laternen
  (Passanten je 5 Teile + Schatten, mehr Verkehr). Jetzt:
  - Passanten-LOD: ab `Q.pedLod` (hoch 60 / mittel 35 / niedrig 25 m) ein zusammengefügtes Modell statt 5 Teile (`setHumanLod` in human.js).
  - Passanten-Schatten auf Mittel nur noch Rumpf (`pedLimbs`), bis 30 m; Sichtweite Passanten `pedFar` 140/115/100 m.
  - Laternen/Mülleimer: Radius `propR` 170/140/120 m, Eimer/Tonnen nur bis 60 % davon, Schatten nur auf „Hoch“ (`props.setShadows`),
    Laternen-Sockel ohne Schatten. Lichtkegel am Boden (`world.pools`) werden tagsüber nicht gezeichnet.
  - Ergebnis Headless (Mittel): Stadtmitte 415 → ~370 Draw-Calls, 342k → 245k Dreiecke; Kreuz 150k → 112–128k Dreiecke.
- **Rampen**: beginnen als Einfädelspur unter der Hochstraße (`beside()` in `kreuzRoads`), laufen ~40 m 2-spurig daneben her, dann im Bogen
  runter und fädeln schräg in die Hafenstraße ein (z = −258 / −386). Schutzwand: Lücke nur noch, wo der Punkt wirklich auf der anderen
  Fahrbahn liegt (`coveredByOtherDeck`, outskirts.js) – keine Löcher mehr.
- KI: am Straßenende werden Anschlüsse in Fahrtrichtung bevorzugt (vorher wendete ein Auto quer in die Nachbar-Rampe → Stau oben).
  Test: 4800 Schritte am Kreuz ohne stehende Autos.
- Tankstelle steht jetzt allein an der Hafenstraße (West, `KREUZ_EXTRAS.tankstelle`, `petrolStation()` mit Asphalt-Zufahrt + Preisschild),
  der Diner bleibt am Wasser. Kiosk + Bushaltestelle auf der Ostseite gegenüber (`kiosk`), mit Wartenden (Hotspot in outskirts.js);
  standen vorher im Pfeiler der Schilderbrücke. Salzkuppel (brauner Klotz) entfernt. Parkbäume nicht mehr auf Fahrbahnen.

## Dildi-Kreisel statt Dildi-Kreuz (15.11., Nicks Wunsch)
- Hochstraße + Rampen entfernt. Flach: `Querstraße West/Ost` (von den Stadtausfahrten x = ±136 nach z = −322) treffen die
  `Hafenstraße` (Nord bis −303) / `Hafenstraße Süd` (ab −341) am Kreisverkehr `DILDI_KREISEL` (geo.js, wie der Hafenkreisel;
  Insel mit pink-weißer Säule in outskirts.js, Karte in map.js). Schilder/Gebietsname „Dildi-Kreisel“.
- `kreuzRoads()` (Hochstraße/Rampen) bleibt in dildi_cars.js, wird vom Spiel aber nicht mehr benutzt.
- Gebäude an den Straßen mit Asphalt-Zufahrten (`kreuzAprons`, dort auch keine Laternen – `places().aprons` in world.js):
  Diner + Meisterei (NW), Burger-Drive-in (NO), Tankstelle (SW), Waschstraße + Motel (SO), Kiosk + Bushaltebucht (Hafenstraße Nord, Ost).
  Gebäude südlich der Straße werden mit `facingNorth()` an z gespiegelt (Front zur Straße). Deko ohne Zufahrt: Wasserturm, Funkmast,
  Solarpark, Park mit DILDI-Buchstaben, Plakate. Skatepark entfernt. Positionen in `KREUZ_EXTRAS`.
- **Nicht getestet** (Nick testet selbst, Tokens sparen) – nur gebaut.
