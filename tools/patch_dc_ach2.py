"""Dildi City: viel mehr Erfolge (16.11.2026, Nick) – 4 neue Gruppen mit 21 Erfolgen, auch schwere.
Werte kommen aus dc3d_stats (Spiel zählt mit, util.js stat/statMax/statMin), dc3d_owned, dc3d_tune und dc3d_coup.
Die alte Gruppe "dc" (5 Erfolge) bleibt unverändert, damit schon erreichte Erfolge gültig bleiben.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
OLD_DCS = ('let ow={};try{ow=JSON.parse(d3.dc3d_owned||"{}")||{}}catch(e){}o.cars=Object.keys(ow).filter((k)=>k!=="skoda"&&ow[k]).length}catch(e){}return o}')
NEW_DCS = ('let ow={};try{ow=JSON.parse(d3.dc3d_owned||"{}")||{}}catch(e){}o.cars=Object.keys(ow).filter((k)=>k!=="skoda"&&ow[k]).length;'
           'let tu={};try{tu=JSON.parse(d3.dc3d_tune||"{}")||{}}catch(e){}o.tuned=Object.keys(tu).filter((k)=>tu[k]&&Object.keys(tu[k]).some((q)=>tu[k][q])).length;'
           'o.coup=Math.min(4,+d3.dc3d_coup||0)}catch(e){}return o}')
G = lambda gid, name, items: ('["%s","%s",[' % (gid, name)) + ','.join('["%s","%s",(d)=>%s]' % it for it in items) + ']]'
c = lambda k: '(dcS(d).%s||0)' % k
GROUPS = [
    G('dcp', 'Dildi City: Pizza & Flaschenpost', [
        ('Pizzabote', '10 Pizzen ausgeliefert', c('pz') + '>=10'),
        ('Flaschenpost', 'Eine Flaschenpost-Tour geschafft', c('fp') + '>=1'),
        ('Heiß & fettig', '50 Pizzen heiß ausgeliefert', c('pzHot') + '>=50'),
        ('Glasklar', '10 Touren mit Bonus für saubere Fahrt', c('fpPerf') + '>=10'),
        ('Lieferlegende', 'Pizza-Serie ×15 in einer Schicht', c('pzSer') + '>=15')]),
    G('dca', 'Dildi City: Aufträge & Autos', [
        ('Eigene Karre', 'Erstes Auto beim Händler gekauft', c('cars') + '>=1'),
        ('Startschuss', 'Ein Zeitrennen gewonnen', c('race') + '>=1'),
        ('Aufgemotzt', 'Ein Auto bei Dildi Customs getunt', c('tuned') + '>=1'),
        ('Volle Garage', 'Alle Autos gekauft', c('cars') + '>=3'),
        ('Profikiller', '15 Attentate erledigt', c('hit') + '>=15'),
        ('Rennlegende', '25 Zeitrennen gewonnen', c('race') + '>=25')]),
    G('dcr', 'Dildi City: Raubzüge', [
        ('Radjs Kurier', '10 Lieferungen für Radj', c('radj') + '>=10'),
        ('Bank-Serie', '10 Bankraube', c('bank') + '>=10'),
        ('Hafenpirat', '10 Docks-Coups', c('docks') + '>=10'),
        ('Volles Tagespensum', '10 Bankraube an einem Tag', c('bank10') + '>=1'),
        ('Staatsfeind Nr. 1', '100 Raubzüge (Bank + Docks)', '(' + c('bank') + '+' + c('docks') + ')>=100')]),
    G('dch', 'Dildi City: Radj-Coup', [
        ('Der Plan steht', 'Coup-Mission 1 geschafft', c('coup') + '>=1'),
        ('Bereit für Radj', 'Alle 4 Coup-Missionen geschafft', c('coup') + '>=4'),
        ('Crew-Arbeit', 'Das Koop-Finale geschafft', c('coop') + '>=1'),
        ('Geist', 'Finale ohne Alarm geschafft', c('finQuiet') + '>=1'),
        ('Lautloser Killer', '8 lautlose Takedowns in einem Finale', c('finTD') + '>=8'),
        ('Blitzeinbruch', 'Finale in unter 12 Minuten', '(dcS(d).finT||1e9)<=720')]),
]
OLD_PUSH = 'ACH_NEW.push(["dc","Dildi City",['
reps = [
    (OLD_DCS, NEW_DCS),
    (OLD_PUSH, 'ACH_NEW.push(' + ','.join(GROUPS) + ');' + OLD_PUSH),
    ('"fs","dp","dc","hk",', '"fs","dp","dc","dcp","dca","dcr","dch","hk",'),
]
if '"dch","Dildi City: Radj-Coup"' in s:
    print('schon drin'); sys.exit()
for a, b in reps:
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
