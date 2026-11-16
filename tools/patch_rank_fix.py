"""Rangliste aufräumen (16.11.2026, Nick).
- „Wochenaufgaben erledigt“ zählte die alten Wochenaufgaben (nicht mehr erreichbar) → jetzt „Pass-Aufgaben erledigt“
  (Tages- + Wochenaufgaben im Sigma-Pass, neuer Zähler DD.s.psn beim Abholen).
- „Fischmarkt-Umsatz“, „Fischmarkt: verkaufte Karten“ und „Dildi City: Koop-Finale“ raus.
- Fehler: alle außer Nick hatten 30 Min Spielzeit (gesamt + Pferde). dm() hat die alte Pferde-Gutschrift (HRB, Saison 0)
  mit dem Namen des BETRACHTERS auf fremde Spielstände gerechnet (Nick: 30 Min). Die Gutschrift gilt jetzt nur noch vor
  dem Saisonstart (dm und HRF), in Saison 1 gibt es sie nicht mehr.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
reps = [
    ('{n:"Wochenaufgaben erledigt",f:(p)=>p.data.wkn||0,u:""}', '{n:"Pass-Aufgaben erledigt",f:(p)=>p.data.psn||0,u:""}'),
    (',{n:"Fischmarkt-Umsatz",f:(p)=>p.data.mkt.earned,u:" €"},{n:"Fischmarkt: verkaufte Karten",f:(p)=>p.data.mkt.sold,u:""}', ''),
    ('{n:"Dildi City: Koop-Finale",f:(p)=>dcS(p.data).coop||0,u:""},', ''),
    ('mp[t.id]=1;let L0=psLvl(q.xp);', 'mp[t.id]=1;DD.s.psn=(DD.s.psn||0)+1;let L0=psLvl(q.xp);'),
    ('if(typeof DD!=="undefined"&&DD&&DD.u&&HRB(DD.u.name)&&!b.fixhr){', 'if(typeof DD!=="undefined"&&DD&&DD.u&&HRB(DD.u.name)&&!b.fixhr&&!ssOn()){'),
    ('function HRF(n,d){if(d&&HRB(n)&&!d.fixhr)', 'function HRF(n,d){if(d&&HRB(n)&&!d.fixhr&&!ssOn())'),
]
for a, b in reps:
    if s.count(a) != 1:
        if b and b in s:
            continue
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
# a trailing comma could be left in the Gesamt tab if Fischmarkt was last: check
if ',]}' in s[s.find('function mkTabsAll'):s.find('function mkTabsAll') + 30000]:
    sys.exit('Komma-Fehler in mkTabsAll')
open(P, 'w', encoding='utf-8').write(s)
print('ok')
