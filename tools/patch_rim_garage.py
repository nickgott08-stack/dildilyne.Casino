"""RIM-Pickup (19.11.2026): Erfolg „Volle Garage“ braucht jetzt alle 4 Autos (Van, RS6, Ferrari, RIM)."""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
a = '["Volle Garage","Alle Autos gekauft",(d)=>(dcS(d).cars||0)>=3]'
b = '["Volle Garage","Alle Autos gekauft (Van, RS6, Ferrari, RIM)",(d)=>(dcS(d).cars||0)>=4]'
if b in s: print('schon drin'); sys.exit()
if s.count(a) != 1: sys.exit('nicht gefunden')
open(P, 'w', encoding='utf-8').write(s.replace(a, b)); print('ok')
