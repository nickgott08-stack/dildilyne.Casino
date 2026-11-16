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

## Kreisel-Tempo, iPad-Tasten, Jeeps (15.11.)
- OutDriver (ai.js): vor einem Kreisverkehr abbremsen (`endsAtRing`, letzte ~14 Punkte), im Ring max. 6,5 m/s, nach der Ausfahrt kurz max. 7,5.
- Tablets: Tasten unten rechts (`.tb.foot/.car/.plane`) per `zoom:1.4` größer (template.html, gleiche Media-Query wie der Joystick).
- Jeeps fahren nicht mehr im normalen Verkehr (Stadt + außen), nur noch Radj-Missionen/Insel (heist.js).
- Nicht getestet (Nick testet selbst).
- Dildi-Kreisel größer (r 22, Fahrbahn 11 m), Arme enden am Außenrand des Rings (vorher fast auf der Ring-Mitte → Autos fuhren in die Insel);
  LKW/Bus (`M.len > 6`) fahren am/im Kreisel noch langsamer. Fern-Modell (`proxy` in vehicles.js) für LKW und Bus in voller Höhe
  (vorher flacher PKW-Klotz). Nicht getestet.

## Keine Kreisel mehr am Dildi-Kreuz und Hafen (15.11., Nick: „damit kommen die nicht klar“)
- Dildi-Kreisel und Hafenkreisel entfernt → normale Kreuzungen. Je 4 Arme enden am Rand eines 11-m-Asphaltquadrats
  (`Dildi-Kreuz` / `Hafenkreuzung`, Straßen mit `traffic: false`), OutDriver biegt am Straßenende in einen der anderen Arme ab
  (`junctionsAt`), rollt langsam heran (`endsAtCrossing` in ai.js). Gebiet/Schilder heißen wieder „Dildi-Kreuz“.
- Geblieben: Kreisverkehr am Ende der Brückenstraße (`KREISEL`) und Wendeschleife Flughafen (`WENDE`) zum Wenden.
- Bus-Route (main.js `serviceRoutes`) fährt über die Hafenkreuzung statt durch den Hafenkreisel. Nicht getestet.

## Vorfahrt, Finale Teil 1: Türme, Wald, Waffen (15.11.) – nicht getestet
- Kreuzungen (`CROSSINGS` in geo.js): Nord-Süd-Straßen haben `prio`. Wer aus der Seitenstraße kommt, wartet an der Haltelinie, solange
  auf der Hauptstraße im Umkreis von 26 m etwas fährt (`mainRoadBusy` in ai.js, nach 8 s fährt er trotzdem). Schilder (Stopp / gelbe Raute)
  und Haltelinien in outskirts.js.
- Finale: Flugzeug hält am Ostende der Piste neben dem Jeep (`arriveIsland`). Baumwand (2 Reihen, Kollision r 1,4) beidseits des Waldwegs
  und um die Pisten-Lichtung (radj.js) – man muss den Weg nehmen.
- 4 Wachtürme am Waldweg (`isl.roadTowers`, radj.js): Lichtfleck (r 5,2) schwenkt quer über den Weg (heist.js `updateFinale`),
  ~0,25 s im Licht → `raiseAlarm` (Wachen wissen Bescheid, Mission läuft weiter). Turmwache ist nur eine Figur (nicht abschießbar).
- Waffen: AK gibt es nur noch im Finale (`has[2]` wird dort gesetzt, in `cleanupFinale` entfernt; Shop-Eintrag + Pickup entfernt).
  Pistole mit Schalldämpfer: auf der Insel keine Zielhilfe (`G.noAssist`), Kopfschuss auf Wache = sofort tot und lautlos.
  AK-Schuss auf der Insel → sofort Alarm (`G.lastShot.w`).
- Offen (Teil 2): Anwesen vergrößern, Höfe/Gebäude/Pflanzen, feste Wachrouten, keine Wache direkt hinterm Tor.

## Finale Teil 2: größeres Anwesen, feste Wachrouten (15.11.) – nicht getestet
- `RADJ_ESTATE` jetzt x −60…120, z −1400…−1240 (vorher −40…120 / −1400…−1270): Vorhof im Norden, Gästehaus-Streifen im Westen.
  Haupttor z = −1240, Westtor x = −60, Waldweg endet bei (40, −1228), `helRoad` beginnt am neuen Westtor.
- Neuer Block „bigger estate“ in radj.js: Innenmauer auf der alten Mauerlinie (z = −1270) mit 3 Durchgängen, Zypressen-Allee, Torhaus,
  Lagerhaus, Kolonnaden am Brunnenhof, Pflasterwege, Pergola am Pool, Palmen, Beete, Gästehaus (rot, 2 Stockwerke), Pavillon.
- Wachen: `sentryPosts` sind feste Routen – Rundwege mit 4 Ecken (`loop()`) oder Hin-und-zurück; heist.js läuft beliebig viele Punkte ab.
  Im Vorhof direkt hinter dem Tor steht niemand. 13 Wachen + Torwache.
- Flucht-Jeeps starten auf dem Heli-Weg außerhalb der Mauer.

## Neues Anwesen – Schritt 1: Technik (15.11.)
Nick will fürs Finale ein dichtes, GTA-artiges Anwesen auf 3 Ebenen nach seiner Skizze (gespiegelt, Westtor links). Plan in 4 Schritten:
1 Technik (dieser Stand) · 2 grauer Rohbau nach Skizze · 3 Ausbau (Bögen, Säulen, Dächer, rundere Figuren) · 4 Wachrouten/Feinschliff.
Ebenen: Pool + Garage/Westtor = unten (Gelände-Höhe), Haupttor/Torhof = Mitte (+3,4 m, Rampe vor dem Tor), Villa + U-Dach = oben.
Skizze: Torhaus, Torhof, Garten (NO in der Skizze → gespiegelt NW), 2 feste Gebäude neben dem Torhof, Höfe mit 3 Torbögen, Villa mit Aufzug
in der Mitte, U-förmige Halle mit 2 Treppen über dem Pool, Poolterrasse an der Klippe, Garage am Westtor; 7 Treppen, 6 Torbögen,
9 Wachen + Wachen unter den Dächern. „Grüne Kästen“ = offene Hallen (Stützen + Dach), kein Brunnen.
- `addFloor(x0, x1, z0, z1, y, y2, axis)` in world.js: begehbare Flächen über dem Boden (Terrasse, Balkon; mit `y2` Rampe/Treppe).
  `groundAt` nimmt die höchste Fläche unter `refY` → man kann drunter durch und oben drauf laufen. Wände/Körper weiter per `addBox(…, { y0 })`.
- Deckung (main.js, nur wenn `G.coverOK`, setzt heist.js auf der Insel): 0,3 s gegen eine Wand laufen → `player.cover = { nx, nz, peek }`.
  An der Wand entlang (2,3 m/s), am Wandende schaut die Kamera ums Eck (`cam.peekK`), weg von der Wand oder Zielen = raus.
  Wachen sehen einen in Deckung nur bis 7 m (sonst 14). Anzeige `#coverTag`.
- Getestet (Probestück per `G.world.addFloor/addBox`): Treppe hoch, von der Kante fallen, Terrasse blockt von unten, Deckung rein/entlang/Ecke/raus.

## Neues Anwesen – Schritt 2: grauer Rohbau nach Nicks Skizze (15.11.)
- Estate-Block in radj.js komplett ersetzt (altes Anwesen mit Villa/Brunnen/Pool ist raus). Alles grau, nur Aufteilung.
  Helfer im Block: `plat` (Plattform mit begehbarer Oberseite), `stairs` (Rampe + Stufen + Wangen), `line`/`rail` (Mauer/Geländer mit Lücken,
  optional Torbogen-Sturz), `hall` (Stützen + Dach), `block` (festes Gebäude).
- Ebenen: L1 = Gelände (Poolterrasse x −36…46 / z −1400…−1329, Weststreifen x −60…−36 mit Garage + Westtor),
  L2 = +3,4 (Torhof, Garten, Mittelhof: x −36…66 / z −1329…−1240; Ostgasse, Osthöfe, U-Hof, Südosthof: x 46…120 / z −1400…−1297;
  Ausguck SW; Podest vor dem Tor), L3 = +6,8 (Villa-Podest x 30…64 / z −1324…−1290; Nordost-Terrasse x 66…120 / z −1297…−1240).
- 8 Treppen (eine mehr als in der Skizze: Nordost-Terrasse ↔ Osthöfe) + Rampe vom Waldweg (endet jetzt bei 74/−1234) aufs Podest vor dem Tor.
  6 Torbögen (gelber Sturz). Aufzug: `ISL.lift` = Westseite der Villa auf dem Podest; `ISL.mansion` angepasst.
- 15 Wachen auf festen Routen je Ebene + Torwache. `out.levels`, `out.towers = []` (Eck-Türme entfallen).
- Getestet: alle 16 Bereiche zu Fuß vom Waldweg erreichbar (Flood-Fill mit echter Kollision), Wachen laufen auf richtiger Höhe ohne Alarm,
  Jeep fährt die Rampe hoch. Nicht getestet: Finale-Ablauf ab Tor (Karten, Aufzug, Flucht), Karte (map.js zeichnet noch das alte Anwesen).
- Rundgang zum Anschauen: `…/city3d/dist/dildi_city_3d.html?test=anwesen` (oder `window.DC_TEST = 'anwesen'`) → `missions.estateTour()`:
  direkt vors offene Haupttor, Wachen laufen, sehen einen aber nicht (`job.tour`), keine Auszahlung.

## Neues Anwesen – Schritt 3a: Nicks Modul `anwesen.js` im Spiel (15.11.)
- Der graue Rohbau ist ersetzt durch `src/anwesen.js` (aus Nicks anderem Chat, basiert auf meinem Entwurf `city3d/entwurf/`):
  72 × 60 m, Ebenen je 2,64 m, Villa mit Treppe → Balkon → Büro mit Fahrstuhl, Seehaus an der Meerseite, U-Bau mit Verbunddach.
  Unsere Anpassungen in der Datei (bei neuer Version von Nick wieder übernehmen!): sparsame Baluster (5 Seiten, Abstand 0,34),
  `curveSegments` 10, kein PointLight im Büro, `root.userData.rec` (plats/walls/round/ramp) in `anwesen()`.
- radj.js Estate-Block: Modul wird in z gespiegelt (Tor nach Norden, Westtor nach Westen), alle Teile pro Material zu einem Mesh
  gebacken (Wicklung gedreht), die zwei Tor-Gitter bleiben einzeln (`out.gateMesh`/`westGateMesh`). Kollision automatisch aus
  `rec`, den `userData.colliders` der Bauteile und jeder `treppe` (→ `addFloor`-Rampe); Villa und Seehaus von Hand (Büro oben begehbar).
- `RADJ_ESTATE` = x 0…72 / z −1400…−1340, Tor (40/−1340) auf Ebene 2 mit Rampe, Waldweg verlängert bis (40/−1326), Westtor (0/−1370),
  `ISL.lift`/`ISL.liftOut` werden aus dem Villa-Modell gesetzt (Büro, Ebene 3 + 3,4 m). Steinsockel unter dem Anwesen.
- Leistung: Anwesen ~120k Dreiecke in ~10 Meshes; Schatten werfen nur Putz + Dach; Bäume der Insel werfen keinen Schatten mehr.
- 9 vorläufige Wachrouten + Torwache auf der Rampe. Getestet: alles vom Waldweg erreichbar (auch Balkon/Büro, Seehaus),
  Wachen laufen auf richtiger Höhe. Offen (3b/4): Wachrouten ausbauen, Finale-Ablauf ab Tor testen, Karte (map.js), FPS am Handy.

## Anwesen-Korrekturen nach Nicks Rundgang (15.11. spät)
- Anwesen in einer Grube: Ebene 2 (Tor) = Inselhöhe, Pool-Ebene 2,64 m tiefer (`RADJ_PIT` in geo.js, `radjGround(x, z, visual)`).
  Das Insel-Mesh wird über dem Anwesen per Shader weggeschnitten (discard im Rechteck), südlich (Meerseite) liegt der Boden auf Pool-Höhe.
  Rampe vor dem Tor entfällt, Waldweg endet direkt am Tor.
- Pool: Kollision als Pfostenreihe entlang der echten Beckenform (`poolOutline`) statt Rechteck.
- Wachen-Lichtkegel nur noch auf der Minikarte (`cone.visible = false`), Kartenträger ohne Goldmarke und ohne Zielmarker.
- Geld + Sterne im Finale ausgeblendet (`#money`/`#stars`, zurück in `cleanupFinale`).
- Keine Autos/Motorrad im Anwesen; ein grünes Motorrad steht draußen links vor dem Haupttor.
- Nächster Schritt laut Nick: erst Spielfigur + Wachen (runder, natürlicher), dann die Wachrouten.
- Finale immer bei Tag: `G.forceDay` (heist.js setzt es im Finale, `cleanupFinale` nimmt es zurück) → `G.cycle = 0.22` (Mittag) in simStep.

## Runde Figuren + Wachrouten im Anwesen (16.11.)
- **Neue Figur nur fürs Finale** (`makeRoundHuman` in human.js, über `look.round`): Kapseln/Kugeln statt Klötze, Eikopf mit Nase/Ohren/
  Augenbrauen, Knie- und Ellbogen-Gelenke (`kneeL/R`, `elbowL/R`, bewegt in `animateJoints`), gleiche Schnittstelle wie `makeHuman`
  (root/body/torso/armL…/hand), das Fern-Modell (`setHumanLod`) geht jetzt auch mit verschachtelten Gelenken.
  - Spieler: `G.setRoundPlayer(true/false)` (main.js) tauscht die Figur samt Waffen – an in `arriveIsland`, aus in `cleanupFinale`.
    Online: Mitspieler werden im Finale ebenfalls rund gezeichnet (`G.roundFigs`, online.js).
  - Wachen (`sentryLook` in heist.js): runde Figur, dunkle Uniform, Weste mit Funkkabel, Handschuhe, verschiedene Hauttöne.
    Auch die Turmwachen am Waldweg (radj.js).
- **Wachrouten (Schritt 4)**: 14 Routen + Torwache (`out.sentryPosts` in radj.js, Helfer `R(lv, …punkte)` in Modul-Koordinaten).
  Punkt = `[x, z]` oder `[x, z, schauX, schauZ, warten]` (warten 0 = steht fest); 1 Punkt = Posten, 2 = hin und her, mehr = Runde.
  Jede Route hat ihre Ebene (`route.y`), die Wache startet darauf (unter Dächern nicht auf dem Dach).
  Torhof: Ost-Arkade (unter dem Dach, nicht direkt hinterm Tor) · Garten zwischen den Töpfen · Mittelhof-Runde · Mittelhof ↔ Treppe aufs
  Villa-Podium · Villa-Podium West/Süd · **Ausguck auf dem Villa-Balkon** (schaut über den Torhof) · Nordost-Terrasse · Osthof ·
  Brunnen-Runde · U-Halle Süd (unter dem Dach) · Posten U-Halle Nord (unter dem Dach) · Poolterrasse · Seehaus-Kolonnade · Weststreifen.
- Getestet (Headless): alle Routen-Abschnitte ohne Wand und ohne Höhensprung (Prüfung mit r 0,36), 90 s Laufen: jede Wache bleibt auf
  ihrer Ebene und Route, kein Alarm im Rundgang; Nahaufnahme Spieler + Wache. **Nicht getestet**: FPS am Handy (eine runde Figur = 9 Teile
  statt 5 in der Nähe), kompletter Finale-Ablauf mit Karten/Aufzug, Schwierigkeit mit 15 statt 10 Wachen.
