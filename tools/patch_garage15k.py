"""Neue Autopreise in Dildi City (Transporter 25.000, RS6 60.000, Ferrari 150.000) → Erfolg „Volle Garage“ 15.000 statt 3.000 (16.11.2026, Nick)."""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
a, b = 'dca4:3000,', 'dca4:15000,'
if b not in s:
    if s.count(a) != 1: sys.exit('nicht gefunden')
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
