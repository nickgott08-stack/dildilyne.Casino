"""Dildi City + Dildi Peak in Erfolgen und Rangliste (16.11.2026, Nick).
- Erfolge: Dildi-Peak-Gruppe ("dp", gab es schon, wurde aber nicht angezeigt) + neue Gruppe "dc" Dildi City.
- Rangliste: eigene Reiter „Dildi Peak“ und „Dildi City“ (Dildi Peak Rekord aus „Minispiele“ dorthin verschoben).
- Dildi City zählt im Spiel in dc3d_stats (util.js stat()): jobs, bank, docks, fin, coop, earned; Autos aus dc3d_owned.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
DCS = ('function dcS(d){let o={};try{let d3=((d||{}).gta||{}).d3||{};o=JSON.parse(d3.dc3d_stats||"{}")||{};'
       'let ow={};try{ow=JSON.parse(d3.dc3d_owned||"{}")||{}}catch(e){}o.cars=Object.keys(ow).filter((k)=>k!=="skoda"&&ow[k]).length}catch(e){}return o}\n')
ACH = ('ACH_NEW.push(["dc","Dildi City",[["Erster Job","1 Auftrag in Dildi City erledigt",(d)=>(dcS(d).jobs||0)>=1],'
       '["Bankräuber","Die Bank ausgeraubt",(d)=>(dcS(d).bank||0)>=1],["Docks-Coup","Fracht von den Docks verkauft",(d)=>(dcS(d).docks||0)>=1],'
       '["Radj ausgeraubt","Das Radj-Finale geschafft",(d)=>((dcS(d).fin||0)+(dcS(d).coop||0))>=1],'
       '["Großverdiener","100.000 D$ verdient",(d)=>(dcS(d).earned||0)>=100000]]]);')
TABS = ('{t:"Dildi Peak",c:[{n:"Dildi Peak Rekord",f:(p)=>((p.data||{}).dp||{}).best||0,u:" Pkt"},'
        '{n:"Dildi Peak: Weitester Lauf",f:(p)=>Math.round(((p.data||{}).dp||{}).bestD||0),u:" m"},'
        '{n:"Dildi Peak: Läufe",f:(p)=>((p.data||{}).dp||{}).p||0,u:""},'
        '{n:"Dildi Peak: Münzen",f:(p)=>((p.data||{}).dp||{}).coins||0,u:""},'
        '{n:"Dildi Peak: Tricks",f:(p)=>((p.data||{}).dp||{}).tricks||0,u:""},'
        '{n:"Dildi Peak: Insgesamt verdient",f:(p)=>((p.data||{}).dp||{}).won||0,u:" Bits"}]},'
        '{t:"Dildi City",c:[{n:"Dildi City: Verdient",f:(p)=>dcS(p.data).earned||0,u:" D$"},'
        '{n:"Dildi City: Aufträge",f:(p)=>dcS(p.data).jobs||0,u:""},'
        '{n:"Dildi City: Bankraube",f:(p)=>dcS(p.data).bank||0,u:""},'
        '{n:"Dildi City: Docks-Coups",f:(p)=>dcS(p.data).docks||0,u:""},'
        '{n:"Dildi City: Radj-Finale",f:(p)=>dcS(p.data).fin||0,u:""},'
        '{n:"Dildi City: Koop-Finale",f:(p)=>dcS(p.data).coop||0,u:""},'
        '{n:"Dildi City: Autos gekauft",f:(p)=>dcS(p.data).cars||0,u:""}]},')
reps = [
    ('function mkTabsAll(){', DCS + 'function mkTabsAll(){'),
    ('ACH_NEW.forEach((G)=>G[2]', ACH + 'ACH_NEW.forEach((G)=>G[2]'),
    ('gs=["leg","h","r","hm","rm","gk","bj","ro","fs","hk",', 'gs=["leg","h","r","hm","rm","gk","bj","ro","fs","dp","dc","hk",'),
    ('{n:"Dildi Peak Rekord",f:(p)=>((p.data||{}).dp||{}).best||0,u:" Pkt"},{n:"Hafen-Fang Rekord"', '{n:"Hafen-Fang Rekord"'),
    ('{t:"Transfermarkt",c:[', TABS + '{t:"Transfermarkt",c:['),
]
if 'function dcS(' in s:
    print('schon drin'); sys.exit()
for a, b in reps:
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:60]))
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
