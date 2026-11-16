"""Saison-1-Fix 4 (16.11.2026, Nick):
- Flugschule neu (Saison 1, Woche 1, voller Flug mit allen Ringen): leicht ~300 + Landung 1.500, mittel ~750 + 2.000,
  schwer ~2.500 + 15.000 (perfekte Landung je +20 %). Faktor je Schwierigkeit auf Sekunden- und Ringwerte, fsEco() läuft
  jetzt auch beim Start (Schwierigkeit gewählt). Vorher: alles nur halbiert (schwer bis ~15.000 Landebonus + ~2.000 Flug).
- Nicks Sparschwein: 39.737.890 Bits (durch die Endlos-Transfer-Schleife falsch berechnet), einmalig (fixPig1).
- Joshua: Coup-Fortschritt zurück auf Mission 1 (wurde nach dem Reset durch jfix neu auf Mission 3 gesetzt), einmalig (fixJ2).
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
reps = [
    ('function fsEco(){let k=ssOn()?.5:1;[10,20,30,40,60].forEach((v,i)=>{FS_RING[i]=v*k});[2,4,6,8,10].forEach((v,i)=>{FS_SEC[i]=v*k});[[1500,2500],[3000,4500],[25000,30000]].forEach((b,i)=>{FS_DIF[i].b=[b[0]*k,b[1]*k]})}',
     'function fsEco(){let S=ssOn(),k=S?[.25,.28,.62][Math.max(0,FS_DIF.indexOf(FSD))]:1;[10,20,30,40,60].forEach((v,i)=>{FS_RING[i]=Math.max(1,Math.round(v*k))});[2,4,6,8,10].forEach((v,i)=>{FS_SEC[i]=v*k});(S?[[1500,1800],[2000,2400],[15000,18000]]:[[1500,2500],[3000,4500],[25000,30000]]).forEach((b,i)=>{FS_DIF[i].b=[b[0],b[1]]})}'),
    ('let start=()=>{FSD=FS_DIF[dif];', 'let start=()=>{FSD=FS_DIF[dif];fsEco();'),
    ('function jfix(Rz,S7){let u=DD.u;',
     'function jfix(Rz,S7){let u=DD.u;'
     'if(u&&/^nick$/i.test(u.name)&&DD.s.ss1&&!DD.s.fixPig1){DD.s.fixPig1=1;DD.s.pig=Object.assign({},DD.s.pig,{t:39737890});DD.save();try{DD.push(!0)}catch(x){}}'
     'if(u&&/^joshua$/i.test(u.name)&&DD.s.ss1&&!DD.s.fixJ2){DD.s.fixJ2=1;DD.s.restJ1=1;DD.s.hk={n:1,t:0,f:0,run:0};DD.s.hkm=0;DD.save();try{DD.push(!0)}catch(x){}}'),
]
for a, b in reps:
    if b in s:
        continue
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
