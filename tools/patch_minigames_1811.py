"""Minispiele (18.11.2026, Nick):
- Regenbogen-Memory: keine Fahrprüfung (DriveTest) mehr nach guten Runden.
- Hafen-Fang: keine Quizfrage (Dreieck, QuizOverlay) mehr nach guten Runden.
- Erfolg „Nebenjob-Legende“ (nq5) brauchte Fahrprüfung + Quiz → jetzt: die anderen 4 Nebenquests geschafft.
- Gekoffert ist geil: Anruf des Croupiers schneller (650 → 250 ms Pause, 2,4 → 0,9 s Klingeln, einmal klingeln),
  Aufdecken am Ende 1,8 → 1,0 s.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
reps = [
    ('if(r>=(ssOn()?750:1500)){setQz(3);setTimeout(()=>setQz(2),3000)};', ''),
    ('if(sc>200)setTimeout(()=>setQz(1),900);', ''),
    ('["Nebenjob-Legende","Fahrprüfung bestanden und Quiz gelöst",(d)=>!!d.drOk&&!!d.qzOk]',
     '["Nebenjob-Legende","Alle 4 anderen Nebenquests geschafft",(d)=>(d.cigs||0)>=100&&(d.box90||0)>=10&&(((d.gs||{}).wall||{}).hit||0)>=50&&(((d.gs||{}).axe||{}).best||0)>=2000]'),
    ('ring(0);ring(1.15);if(navigator.vibrate)navigator.vibrate([200,100,200,600,200,100,200]);setTimeout(()=>{setPh("offer");tn(523,.18,"triangle",0,.2);tn(784,.22,"triangle",.1,.2)},2400)},650)}',
     'ring(0);if(navigator.vibrate)navigator.vibrate([200,100,200]);setTimeout(()=>{setPh("offer");tn(523,.18,"triangle",0,.2);tn(784,.22,"triangle",.1,.2)},900)},250)}'),
]
for a, b in reps:
    if s.count(a) != 1:
        if b and b in s: continue
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
# reveal at the end of Gekoffert
i = s.find('function Koffer(')
a = 'setRv(!1);setPh("reveal");setTimeout(()=>{setRv(!0);'
k = s.find(a, i)
if k < 0: sys.exit('reveal nicht gefunden')
e = s.find('},1800)', k)
if e < 0 or e - k > 600: sys.exit('1800 nicht gefunden')
s = s[:e] + '},1000)' + s[e + 7:]
open(P, 'w', encoding='utf-8').write(s)
print('ok')
