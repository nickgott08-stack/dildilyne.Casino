"""Sigma Liga: am 16.11.2026 (Spieltag-Index d = 10, Start Saison 1) konnte niemand tippen (Saison-Fehler im Casino).
Nick: die Spiele dieses Tages auf 18, 19 und 20 Uhr verschieben. Alle anderen Tage bleiben wie gehabt."""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
a = 'function slTimes(d){if(d===0)return SL_FIRST;'
b = 'function slTimes(d){if(d===0)return SL_FIRST;if(d===10)return[18,19,20];'
if b not in s:
    if s.count(a) != 1: sys.exit('nicht gefunden')
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
