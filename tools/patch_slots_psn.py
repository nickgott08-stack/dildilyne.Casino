"""Slots: „Insgesamt gewonnen“ in der Rangliste; Pass-Aufgaben nachzählen (16.11.2026, Nick).
- Slots-Reiter: je Slot „Insgesamt gewonnen“ (won.h / won.r) dazu.
- „Pass-Aufgaben erledigt“ (psn) gibt es erst seit heute Nachmittag. Einmalig (fixPsn1) wird psn auf die heute
  schon abgeholten Aufgaben gesetzt: abgeholte Tagesaufgaben von Saisontag 0 + abgeholte Wochenaufgaben von Woche 0.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
reps = [
    ('let sl=(k)=>[{n:"Größter Gewinn auf einmal",f:(p)=>p.data.bw[k],u:" Bits"},',
     'let sl=(k)=>[{n:"Insgesamt gewonnen",f:(p)=>p.data.won[k],u:" Bits"},{n:"Größter Gewinn auf einmal",f:(p)=>p.data.bw[k],u:" Bits"},'),
    ('function jfix(Rz,S7){let u=DD.u;',
     'function jfix(Rz,S7){let u=DD.u;'
     'if(u&&DD.s.ss1&&!DD.s.fixPsn1){let q=DD.s.ps||{},n=(q.p===0?Object.keys(q.wc||{}).length:0)+(q.p===0&&(q.d||{}).id==="0_0"?Object.keys(q.dc||{}).length:0);'
     'DD.s.fixPsn1=1;DD.s.psn=Math.max(DD.s.psn||0,n);DD.save()}'),
]
for a, b in reps:
    if b in s:
        continue
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
