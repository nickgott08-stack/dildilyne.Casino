"""Saison-1-Fix 2 (16.11.2026, Nick): Rangliste der neuen Saison = genau wie vorher (alle Kategorien), nur bei 0.
Vorher zeigte mkTabs() ab Saisonstart nur die Rekord-Kategorien. Saison 0 bleibt nur als Meisterschaftstabelle
(Rangliste → Meisterschaft → „Saison 0“) sichtbar.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
a = 'function mkTabs(){if(!ssOn())return mkTabsAll();let RX='
b = 'function mkTabs(){return mkTabsAll();let RX='
if b not in s:
    if s.count(a) != 1:
        sys.exit('nicht gefunden')
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
