# Dildi City 3D – Online: Kollision, Einsteigen, Schießen

Anleitung für die KI im Dildi-City-Chat. Diese Funktionen müssen im Netzwerk-Code des Spiels gebaut werden. Sie lassen sich nicht als fertiges Modell liefern.

## 1. Persönlicher Schalter „Kollision“ (pro Spieler, nicht pro Lobby)

- **Menü:** Im Online-/Lobby-Menü einen Schalter **„Kollision: AN / AUS“** einbauen. Standard ist AUS. Die Einstellung lokal speichern (z. B. `localStorage` `dc3d_pvp`).
- **Übertragung:** Der Wert wird mit dem eigenen Spielerzustand ins Netz gesendet, also in denselben Daten, die schon Position und Fahrzeug übertragen (Feld `pvp: true/false`).
- **Regel:** Zwischen zwei Spielern A und B gibt es nur dann Kollision, Schaden oder Einsteigen, wenn **beide** `pvp = true` haben. Hat einer AUS, fahren und laufen die beiden durcheinander durch, und Schüsse treffen nicht.
- **Anzeige:** Spieler mit Kollision AN bekommen über dem Namen ein kleines Symbol (z. B. ⚔️). Dann sieht jeder, wer angreifbar ist.

## 2. Rammen zwischen Online-Spielern

- Die Fahrzeuge anderer Spieler (die interpolierten Kopien) brauchen bei beidseitigem `pvp` ein Kollisionsobjekt, z. B. dieselben Kreise wie bei NPC-Autos.
- **Wer rechnet:** Jeder Client berechnet nur den Schaden am **eigenen** Auto (Geschwindigkeitsdifferenz × Faktor) und den Rückstoß für sich selbst. Das ist einfach und schummelarm genug.
- **Nachricht:** Zusätzlich geht eine Nachricht `{t:"ram", to:<id>, imp:<Stärke>, dir:{x,z}}` an den anderen. Der Empfänger zieht sich selbst Schaden ab und bekommt den Stoß. So sehen beide den Unfall.
- **Schadensbild:** Nach jedem Schaden `auto.setDamage(1 - health/maxHealth)` aufrufen (aus `dildi_cars.js`). Den aktuellen Schadensgrad mitsenden, damit die anderen die Dellen ebenfalls sehen.

## 3. In Autos anderer Spieler einsteigen (bis zu 4 Personen)

- **Sitzplätze:** Jedes Fahrzeug hat Sitze: `seats: [fahrer, beifahrer, hinten links, hinten rechts]`. Motorrad und Roller haben 2, Bus 8, Jeep, Pickup und Autos 4.
- **Einsteigen:** Steht ein Spieler mit `pvp = true` nah an einem Spieler-Auto (beide AN), wird die Taste **EIN** zu „Mitfahren“. Er sendet dann `{t:"seat", car:<ownerId>, seat:<n>}`.
- **Bestätigung:** Der Fahrer, also der Besitzer des Autos, bestätigt automatisch, solange der Sitz frei ist. Danach hängt der Mitfahrer seine Position an das Auto des Fahrers (`pos = auto.pos + Sitz-Offset`) und sendet keine eigene Physik mehr.
- **Mitfahrer im Auto:** Er darf aus dem Fenster schießen (Schießen-Taste, Blickrichtung frei). **RAUS** steigt aus.
- **Radj-Insel:** Der Jeep (`jeep`) hat 4 Sitze, die ganze Crew passt rein.
- **Freies Auto übernehmen:** Ist der Fahrer ausgestiegen, darf ein anderer Spieler mit `pvp` AN das Auto übernehmen. Die Besitzrechte wechseln dann per Nachricht `{t:"own", car:<id>}`.

## 4. Gegenseitig abschießen

- Treffer werden nur ausgewertet, wenn **Schütze und Ziel beide `pvp = true`** haben.
- **Wer rechnet:** Der Schütze macht den Raycast lokal. Bei einem Treffer auf einen Online-Spieler sendet er `{t:"hit", to:<id>, dmg:<n>, weapon:<w>}`.
- **Empfänger:** Er zieht sich die Lebenspunkte selbst ab (eigener Client = Autorität über die eigene Gesundheit) und prüft dabei grob die Plausibilität: Abstand ≤ Waffenreichweite, Feuerrate.
- **Tod:** Sendet `{t:"dead", by:<id>}`. Alle zeigen eine Meldung wie „X hat Y erledigt“. Respawn wie bisher im Krankenhaus.
- **Fahrzeuge:** Schüsse auf ein Spieler-Auto machen Fahrzeugschaden, ebenfalls nur bei beidseitig AN. Dann `setDamage` und Feuer und Explosion wie bei NPC-Autos.

## 5. Schadensstufen (ist schon in `dildi_cars.js`)

| Schaden | Optik | Fahrverhalten |
|---|---|---|
| ab 20 % | Dellen und Kratzer | normal |
| ab 40 % | Motorhaube springt auf, mehr Dellen | normal |
| ab 60 % | Vorderrad verbogen | zieht zur Seite: `steer = eingabe + auto.steerPull` |
| ab 80 % | stark zerbeult, ein Scheinwerfer kaputt, Haube abgeknickt | zieht stärker, Rauch (Spiel) |
| 100 % | wie bisher Feuer und Explosion | – |

`auto.repair()` setzt alles zurück, z. B. in der Garage, an der Tanke oder bei Dildi Customs.
