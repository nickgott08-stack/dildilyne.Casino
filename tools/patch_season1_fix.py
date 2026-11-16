"""Saison-1-Fix (16.11.2026): Geld-Transfer-Bildschirm kam immer wieder.

Ursache: ssApply() hat beim Reset auch `rev` (Versionsnummer des Server-Spielstands) gelöscht. Das nächste
Speichern wurde vom Server als „stale“ abgelehnt → resync() lud den ALTEN Stand (ohne ss1) → ssRun() lief
erneut → Bildschirm wieder, endlos.
Fix: `rev` bleibt beim Reset erhalten; der Bildschirm kommt pro Sitzung höchstens einmal, Schließen speichert sofort.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
reps = [
    ('var SS_KEEP={cards:1,items:1,', 'var SS_KEEP={rev:1,cards:1,items:1,'),
    ('if(DD.s.ssShow&&!sh){window.__ssOpen=1;setSh(DD.s.ssShow)}',
     'if(DD.s.ssShow&&!sh&&!window.__ssDone){window.__ssOpen=1;setSh(DD.s.ssShow)}'),
    ('let close=()=>{delete DD.s.ssShow;DD.save();window.__ssOpen=0;setSh(null)}',
     'let close=()=>{delete DD.s.ssShow;DD.save();try{DD.push(!0)}catch(e){}window.__ssOpen=0;window.__ssDone=1;setSh(null)}'),
]
for a, b in reps:
    if b in s:
        continue
    if s.count(a) != 1:
        sys.exit('nicht gefunden: ' + a[:60])
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
