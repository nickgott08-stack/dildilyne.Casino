"""Bankraub max. 5 pro Tag (16.11.2026, Nick). Erfolg „Volles Tagespensum“ = 5 Bankraube an einem Tag, Belohnung 15.000
(vorher 10 Bankraube / 25.000). Der Zähler im Spiel heißt weiter bank10 (= volles Tagespensum erreicht)."""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
reps = [
    ('["Volles Tagespensum","10 Bankraube an einem Tag",', '["Volles Tagespensum","5 Bankraube an einem Tag (Maximum)",'),
    ('dcr4:25000,', 'dcr4:15000,'),
]
for a, b in reps:
    if b in s:
        continue
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a))
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
