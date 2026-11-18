"""Dildi Casino AG (DIL): Umsatz treibt die Aktie (18.11.2026, Nick).
Vorher fiel sie fast nur (−1,5 % bei jedem Gewinn ab 5.000, +1 % nur bei BJ/Roulette-Verlust ab 5.000).
Jetzt:
- je 10.000 Bits Einsatz (Slots ohne Freispiele, Blackjack, Roulette, Poker, Pferde, Sport-/Liga-/Boxwetten) +1 % (bxWager, Zähler bxw)
- Kauf im Shop +2 %
- verlorener Einsatz ab 5.000 (BJ, Roulette, Poker, Pferde, Wetten) +1 %
- großer Spieler-Gewinn erst ab 20.000, dann −1 % (Slots, Power-Spins, BJ, Roulette, Gekoffert)
- Tageslimit für DIL +30 % (andere Firmen weiter +20 %)
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
if 'function bxWager(' in s:
    print('schon drin'); sys.exit()
reps = [
    # cap per company
    ('if(pct>0){let u=q[k]||0,a=Math.min(pct,20-u);', 'if(pct>0){let u=q[k]||0,a=Math.min(pct,(k==="DIL"?30:20)-u);'),
    # wager counter
    ('function bxCity(sv){', 'function bxWager(n){try{if(!ssOn()||!DD.u||!(n>0))return;let s=DD.s;s.bxw=(s.bxw||0)+n;let k=Math.floor(s.bxw/10000);if(k>0){s.bxw-=k*10000;bxEv("DIL",k,"Umsatz im Casino: "+fmN(k*10000)+" Bits Einsatz")}}catch(e){}}\nfunction bxCity(sv){'),
    # hooks: new thresholds + wagers + shop
    ('if(j>=5000)bxEv("DIL",-1.5,"Großer Slot-Gewinn: "+fmN(Math.round(j))+" Bits")});', 'if(j>=20000)bxEv("DIL",-1,"Riesiger Slot-Gewinn: "+fmN(Math.round(j))+" Bits")});'),
    ('w("pw",(r,j)=>{if(j>=5000)bxEv("DIL",-1.5,', 'w("pw",(r,j)=>{if(j>=20000)bxEv("DIL",-1,'),
    ('w("bjEnd",(r,p)=>{if(p>=5000)bxEv("DIL",-1.5,', 'w("bjEnd",(r,p)=>{if(p>=20000)bxEv("DIL",-1,'),
    ('w("roul",(r,win,bet,zero)=>{if(win&&!zero&&bet>=5000)bxEv("DIL",-1.5,', 'w("roul",(r,win,bet,zero)=>{bxWager(bet);if(win&&!zero&&bet>=20000)bxEv("DIL",-1,'),
    ('w("kEnd",(r,wn)=>{if(wn>=5000)bxEv("DIL",-1.5,', 'w("kEnd",(r,wn)=>{if(wn>=20000)bxEv("DIL",-1,'),
    ('w("smoke",(r)=>{if(r)bxEv("KIP",.7,"Kippe gezogen")})}',
     'w("smoke",(r)=>{if(r)bxEv("KIP",.7,"Kippe gezogen")});'
     'w("spin",(r,l,bet,fr)=>{if(!fr)bxWager(bet)});'
     'w("horse",(r,bet,pay)=>{bxWager(bet);if(!(pay>0)&&bet>=5000)bxEv("DIL",1,"Verliert "+fmN(bet)+" Bits beim Pferderennen")});'
     'w("sport",(r,k,stake,pay)=>{bxWager(stake);if(!(pay>0)&&stake>=5000)bxEv("DIL",1,"Verliert "+fmN(stake)+" Bits bei einer Wette")});'
     'w("buy",()=>bxEv("DIL",2,"Einkauf im Casino-Shop"))}'),
    # blackjack + poker stakes (no DD hook knows them)
    ('let prof=tot-spent;let gotPk=DD.bjEnd(prof,bjw);', 'let prof=tot-spent;try{bxWager(spent)}catch(e){}let gotPk=DD.bjEnd(prof,bjw);'),
    ('let s=pkS(),net=won-g.myIn;', 'let s=pkS(),net=won-g.myIn;try{bxWager(g.myIn);if(net<=-5000)bxEv("DIL",1,"Verliert "+fmN(-net)+" Bits am Pokertisch")}catch(e){}'),
]
for a, b in reps:
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
