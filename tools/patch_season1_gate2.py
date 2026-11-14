# Alle Saison-1-Änderungen erst ab Saisonstart (ssOn()): Einsätze, Kippen, Coup-Wartezeit.
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf8').read()
if 'function hkh()' in s:
    print('schon gepatcht'); sys.exit(0)
def rep(a, b, n=1):
    global s
    c = s.count(a)
    if c != n: raise SystemExit(f'{n}x erwartet, {c}x gefunden: {a[:90]!r}')
    s = s.replace(a, b)
# Coup-Wartezeit
rep('var HKH=3600000;', 'function hkh(){return ssOn()?3600000:900000}')
rep('t:T+HKH,', 't:T+hkh(),', 3)
rep('t:Date.now()+HKH,', 't:Date.now()+hkh(),')
# Kippen
rep('smokeLeft(){return Math.max(0,(this.s.cig||0)+300000-Date.now())}', 'smokeLeft(){return Math.max(0,(this.s.cig||0)+(ssOn()?300000:600000)-Date.now())}')
# Pferderennen
rep('(P.big?[1000,2500,5000,10000,25000].filter((v)=>v<=[5000,10000,25000,25000,25000][ssW()]):[100,250,500,1000]).map((v)=>{',
    '(!ssOn()?(P.big?[1000,5000,10000,25000]:[100,500,1000,5000,10000]):P.big?[1000,2500,5000,10000,25000].filter((v)=>v<=[5000,10000,25000,25000,25000][ssW()]):[100,250,500,1000]).map((v)=>{')
rep('P.big?m("button",{key:"half",', 'P.big&&ssOn()?m("button",{key:"half",')
rep('P.big&&ssW()>=2?m("button",{key:"allin",', 'P.big&&(!ssOn()||ssW()>=2)?m("button",{key:"allin",')
rep('children:(P.big?"EINSÄTZE AB 1.000 BITS • MAX "+fmN([5000,10000,25000,25000,25000][ssW()])+(ssW()>=2?" ODER ALL-IN":"")+" • ":"MAX 1.000 BITS • ")',
    'children:(!ssOn()?(P.big?"EINSÄTZE AB 1.000 BITS BIS ALL-IN • ":""):P.big?"EINSÄTZE AB 1.000 BITS • MAX "+fmN([5000,10000,25000,25000,25000][ssW()])+(ssW()>=2?" ODER ALL-IN":"")+" • ":"MAX 1.000 BITS • ")')
# Boxen
rep('sChips(chip,setChip,P.bits,0,[20,50,100,250,500,1000])', 'sChips(chip,setChip,P.bits,0,ssOn()?[20,50,100,250,500,1000]:[20,50,100,500,1000,5000,10000])')
rep('if(pk<0||P.bits<chip||chip>1000||ph!=="pick")return;', 'if(pk<0||P.bits<chip||(ssOn()&&chip>1000)||ph!=="pick")return;')
open(P, 'w', encoding='utf8').write(s)
print('ok')
