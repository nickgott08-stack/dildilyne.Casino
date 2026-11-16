"""Dildi-City-Erfolge: Belohnung nach Schwierigkeit (16.11.2026, Nick: „10 Bankraube an EINEM Tag für 6k?!“).
Bisher gab ACHB() jedem Erfolg nach seiner Position in der Gruppe 500/1.500/3.000/6.000/10.000 (+5.000 je weiterem).
Jetzt feste Werte je Erfolg in ACH_B (Woche 1, steigen mit dem Wochen-Faktor ssM()). Andere Spiele unverändert.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
B = {
    # Dildi City (allgemein): Erster Job, Bankräuber, Docks-Coup, Radj ausgeraubt, Großverdiener
    'dc1': 1000, 'dc2': 5000, 'dc3': 5000, 'dc4': 30000, 'dc5': 15000,
    # Pizza & Flaschenpost: Pizzabote, Flaschenpost, Heiß & fettig, Glasklar, Lieferlegende
    'dcp1': 2000, 'dcp2': 3000, 'dcp3': 15000, 'dcp4': 25000, 'dcp5': 30000,
    # Aufträge & Autos: Eigene Karre, Startschuss, Aufgemotzt, Volle Garage, Profikiller, Rennlegende
    'dca1': 2000, 'dca2': 3000, 'dca3': 3000, 'dca4': 10000, 'dca5': 25000, 'dca6': 40000,
    # Raubzüge: Radjs Kurier, Bank-Serie, Hafenpirat, Volles Tagespensum, Staatsfeind Nr. 1
    'dcr1': 15000, 'dcr2': 20000, 'dcr3': 20000, 'dcr4': 75000, 'dcr5': 150000,
    # Radj-Coup: Der Plan steht, Bereit für Radj, Crew-Arbeit, Geist, Lautloser Killer, Blitzeinbruch
    'dch1': 5000, 'dch2': 20000, 'dch3': 25000, 'dch4': 60000, 'dch5': 50000, 'dch6': 60000,
}
JS = 'var ACH_B=' + '{' + ','.join('%s:%d' % kv for kv in B.items()) + '};\n'
a = 'function ACHB(a){if(a.id==="leg1")return Math.round(100000*ssM());'
b = JS + 'function ACHB(a){if(a.id==="leg1")return Math.round(100000*ssM());if(ACH_B[a.id])return Math.round(ACH_B[a.id]*ssM());'
if 'var ACH_B=' in s:
    print('schon drin'); sys.exit()
if s.count(a) != 1:
    sys.exit('nicht gefunden')
s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok, Summe Woche 1:', sum(B.values()))
