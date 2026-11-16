"""Erfolge fest + Budget, Dildi City zählt bei „Insgesamt erspielt“ (16.11.2026, Nick).
Ziel der Saison: 1 Mio „Insgesamt erspielt“ (Titel Ultimativer Gambler) und Sigma-Pass knapp in 30 Tagen;
spätes Einsteigen darf sich nicht lohnen.
1. Erfolge zahlen immer gleich viel (kein Wochen-Faktor mehr – vorher zahlte Woche 4 doppelt, Warten lohnte sich).
2. Budget: andere Spiele ×0,7 (500/1.500/3.000/6.000/10.000 → 350/1.000/2.000/4.000/7.000, ab dem 6. +3.500),
   Dildi City fest nach Schwierigkeit (zusammen ~200.000), Legende 100.000.
4. Dildi City: Bits, die aus dem Spiel ins Casino getauscht werden, zählen zu „Insgesamt erspielt“ – aber nur, was
   über das hinausgeht, was man vorher an Bits hineingetauscht hat (sonst Hin-und-her-Tauschen = endlos Punkte).
   Zähler im Spielstand: dcIn (Bits rein), dcOut (Bits raus), dcTot (schon gezählt).
"""
import sys, re
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
B = {
    # Dildi City (allgemein): Erster Job, Bankräuber, Docks-Coup, Radj ausgeraubt, Großverdiener
    'dc1': 500, 'dc2': 2000, 'dc3': 2000, 'dc4': 10000, 'dc5': 5000,
    # Pizza & Flaschenpost: Pizzabote, Flaschenpost, Heiß & fettig, Glasklar, Lieferlegende
    'dcp1': 500, 'dcp2': 1000, 'dcp3': 4000, 'dcp4': 8000, 'dcp5': 10000,
    # Aufträge & Autos: Eigene Karre, Startschuss, Aufgemotzt, Volle Garage, Profikiller, Rennlegende
    'dca1': 500, 'dca2': 1000, 'dca3': 1000, 'dca4': 3000, 'dca5': 8000, 'dca6': 12000,
    # Raubzüge: Radjs Kurier, Bank-Serie, Hafenpirat, Volles Tagespensum, Staatsfeind Nr. 1
    'dcr1': 4000, 'dcr2': 6000, 'dcr3': 6000, 'dcr4': 25000, 'dcr5': 30000,
    # Radj-Coup: Der Plan steht, Bereit für Radj, Crew-Arbeit, Geist, Lautloser Killer, Blitzeinbruch
    'dch1': 1000, 'dch2': 5000, 'dch3': 8000, 'dch4': 20000, 'dch5': 15000, 'dch6': 15000,
}
NEW = ('var ACH_B={' + ','.join('%s:%d' % kv for kv in B.items()) + '};\n'
       'function ACHB(a){if(a.id==="leg1")return 100000;if(ACH_B[a.id])return ACH_B[a.id];'
       'let i=(parseInt(String(a.id).replace(/^[a-z]+/,""))||1)-1,T=[350,1000,2000,4000,7000];return i<5?T[i]:7000+3500*(i-4)}')
m = re.search(r'var ACH_B=\{[^}]*\};\nfunction ACHB\(a\)\{[^\n]*?\}\n', s)
if not m:
    sys.exit('ACHB nicht gefunden')
s = s[:m.start()] + NEW + '\n' + s[m.end():]
# Dildi City → „Insgesamt erspielt“ (nur Netto über das Hineingetauschte)
a = 'if(d.gta==="bits"){let n=Math.round(+d.n||0);if(n)P.earn(n)}'
b = ('if(d.gta==="bits"){let n=Math.round(+d.n||0);if(n){P.earn(n);let S=DD.s;if(n<0)S.dcIn=(S.dcIn||0)-n;else S.dcOut=(S.dcOut||0)+n;'
     'let c=Math.max(0,(S.dcOut||0)-(S.dcIn||0));if(c>(S.dcTot||0)){S.tot=(S.tot||0)+c-(S.dcTot||0);S.dcTot=c}DD.save()}}')
if b not in s:
    if s.count(a) != 1:
        sys.exit('bits-Nachricht nicht gefunden')
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok, Dildi City Summe:', sum(B.values()))
