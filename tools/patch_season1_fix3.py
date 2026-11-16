"""Saison-1-Fix 3 (16.11.2026): Einmal-Gutschriften liefen nach dem Reset erneut.
jfix() gibt einzelnen Spielern einmalig etwas (Nick: +920.000 / auf 920.000 / auf 1.000.000 Bits, Joshua: Coup-Fortschritt)
und merkt sich das in DD.s (rest1109, rest1109b, restJ1, back920, mio1). ssApply() hat diese Marken beim Reset gelöscht →
beim nächsten Login gab es die Gutschrift noch einmal. Fix: die Marken bleiben beim Reset erhalten (SS_KEEP)."""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
a = 'var SS_KEEP={rev:1,cards:1,'
b = 'var SS_KEEP={rev:1,rest1109:1,rest1109b:1,restJ1:1,back920:1,mio1:1,cards:1,'
if b not in s:
    if s.count(a) != 1: sys.exit('nicht gefunden')
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
