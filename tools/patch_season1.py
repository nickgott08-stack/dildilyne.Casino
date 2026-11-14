# Einmaliger Umbau des Casinos für Saison 1 (Wirtschaft, Saison-Reset, Rangliste, Einsätze).
# Aufruf im Repo-Root: python3 tools/patch_season1.py   (bricht ab, wenn eine Stelle nicht genau 1x gefunden wird)
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf8').read()
if 'function ssM()' in s:
    print('schon gepatcht'); sys.exit(0)

def rep(a, b, n=1):
    global s
    c = s.count(a)
    if c != n:
        raise SystemExit(f'Stelle {n}x erwartet, {c}x gefunden: {a[:90]!r}')
    s = s.replace(a, b)

# ---------- 1. Saison-Reset: alles weg außer Karten + Shop, Doppelte verkaufen, Sparschwein ----------
i = s.index('var SS_KEEP=')
j = s.index('function ssArch(')
s = s[:i] + '''var SS_KEEP={cards:1,items:1,buys:1,packs:1,noAds:1,spent:1,seen:1,at:1,adm:1,bx:1,cm:1,lst:1,sacc:1,srej:1,arch:1,pig:1};
/* Saisonwoche (0..4) / Saisontag (0..29) / Gewinn-Faktor pro Woche */
function ssW(){try{let n=psNow();return n.p<0?0:Math.min(4,n.wk)}catch(e){return 0}}
function ssDay(){try{let n=psNow();return n.p<0?0:n.din}catch(e){return 0}}
function ssM(){return[1,1.25,1.5,1.75,2][ssW()]}
function ssOn(now){try{return slDay(now==null?Date.now():now)>=PS_D0}catch(e){return!1}}
function ssKey(t,c){return t.t+"|"+c.n}
''' + s[j:]
rep('mkTabs().forEach((t)=>{if(t.ch)return;t.c.forEach((c)=>{let v=0;try{v=+c.f(p)||0}',
    'mkTabsAll().forEach((t)=>{if(t.ch)return;t.c.forEach((c)=>{let v=0;try{v=+c.f(p)||0}')
i = s.index('function ssApply(')
j = s.index('function ssRun(')
s = s[:i] + '''function ssApply(s,name){s=s||{};let ob=+s.bits||0,oe=+s.eur||0,tv=0;try{tv=trValue(s.tr)||0}catch(e){}try{tv+=bxValue(s.stk)||0}catch(e){}
 /* Dildi City: D$ (vor dem 1:1-Kurs zählen 10 D$ = 1 Bit) */
 let od=0;try{let d3=((s.gta||{}).d3)||{},dl=+d3.dc3d_dollar||0;od=Math.round(d3.dc3d_eco2==="1"?dl:dl/10)}catch(e){}
 /* doppelte Karten zum Händlerpreis verkaufen (angebotene Karten bleiben) */
 let cards=Object.assign({},s.cards),oc=0,dup=0,DR=[.5,.3,.1,.03,.01],lc={};
 try{(s.lst||[]).forEach((l)=>{if(l&&l.c)lc[l.c]=(lc[l.c]||0)+1})}catch(e){}
 Object.keys(cards).forEach((k)=>{let n=+cards[k]||0,x=k.split("."),f=+x[0],r=+x[1],sell=Math.max(0,n-1-(lc[k]||0));if(sell>0){let p=0;try{p=cardVal(f,r)*DR[r]}catch(e){}oc+=sell*p;dup+=sell;cards[k]=n-sell}});
 oc=Math.round(oc*100)/100;
 let pig=Math.round(ob+oe*100+od+oc*100+tv*100),n=dd0();
 Object.keys(s).forEach((k)=>{if(SS_KEEP[k]||/^(upd|fix)/.test(k))n[k]=s[k]});
 n.cards=cards;
 n.arch=Object.assign({},s.arch,{s0:ssArch(s,name)});
 n.tot0=0;n.ss1=1;n.bits=0;n.eur=0;n.w=0;n.pk=0;n.fix1=1;
 n.pig={t:pig,ob:ob,oe:oe,od:od,oc:oc,tv:Math.round(tv*100)/100,dup:dup};
 n.ssShow={ob:ob,oe:oe,od:od,oc:oc,tv:Math.round(tv*100)/100,pig:pig,dup:dup};
 return n}
''' + s[j:]

# ---------- 2. Saison-Ansage: neue Texte, Sparschwein statt 10 % ----------
rep('children:"Saison 1 startet – jeder fängt neu an. 10 % deines alten Vermögens kommen mit."',
    'children:"Saison 1 startet – alle fangen bei 0 an. Dein altes Vermögen kommt ins Sparschwein 🐷 (zur Erinnerung, nicht ausgebbar)."')
rep('box("ALTER STAND","#8f8fb8",[row("Bits",bi(sh.ob)),row("Euro (×100 Bits)",eu(sh.oe)),row("Gesamt",bi(old)),row("Anteile & Aktien",eu(sh.tv))],{opacity:1-.35*a3})',
    'box("ALTER STAND","#8f8fb8",[row("Bits",bi(sh.ob)),row("Euro (×100 Bits)",eu(sh.oe)),row("Dildi City (D$)",bi(sh.od||0)),row((sh.dup||0)+" doppelte Karten",eu(sh.oc||0)),row("Anteile & Aktien",eu(sh.tv))],{opacity:1-.35*a3})')
rep('children:"10 %"}),m("div",{style:{fontSize:46,animation:done?"none":"ssFly .7s linear infinite"},children:"➜"}),m("div",{style:{fontSize:12,color:"rgba(255,255,255,.6)",textAlign:"center"},children:"Anteile werden zu Euro"})',
    'children:"🐷"}),m("div",{style:{fontSize:46,animation:done?"none":"ssFly .7s linear infinite"},children:"➜"}),m("div",{style:{fontSize:12,color:"rgba(255,255,255,.6)",textAlign:"center"},children:"alles ins Sparschwein"})')
rep('box("NEUER STAND","#5CFF8A",[row("10 % vom Vermögen",bi(sh.nb*a1),.3+.7*a1),row("Startgeld",eu(100*a2),.3+.7*a2),row("Anteile & Aktien → Euro",eu(sh.tv*a2),.3+.7*a2),',
    'box("NEUER STAND","#5CFF8A",[row("🐷 Sparschwein",bi((sh.pig||0)*a1),.3+.7*a1),row("Bits",bi(0),.3+.7*a2),row("Euro",eu(0),.3+.7*a2),')
rep('children:[eu(sh.ne*a3),bi(sh.nb*a3)]', 'children:[eu(0),bi(0)]')
rep('"Rangliste, Rekorde und Hafen-Fang-Grenze starten bei null."',
    '"Alles startet bei 0: Bits, Euro, Erfolge, Sigma-Pass, Rekorde, Dildi City (Geld + Autos). Gewinne steigen jede Saisonwoche."')
rep('"Erfolge, Ränge, Skins, Profilbild, Karten, Shop-Käufe und Sigma-Pass."',
    '"Deine Kartensammlung (doppelte wurden an den Händler verkauft) und deine Shop-Käufe."')
rep('old=sh.ob+sh.oe*100,', 'old=sh.pig||0,')

# ---------- 3. Sparschwein im Profil ----------
rep('children:"Profilbild, Rahmen, Namensfarbe und Titel sehen alle in der Rangliste.',
    'children:(DD.s&&DD.s.pig?"🐷 Sparschwein aus Saison 0: "+fmN(DD.s.pig.t)+" Bits (nur zur Erinnerung) • ":"")+"Profilbild, Rahmen, Namensfarbe und Titel sehen alle in der Rangliste.')

# ---------- 4. Rangliste: nur Rekorde (+ Meisterschaft mit Saison-0-Archiv) ----------
rep('function mkTabs(){let sl=(k)=>', 'function mkTabsAll(){let sl=(k)=>')
rep('function chCalc(R,TB,md){if(md==="all"){', '''function mkTabs(){let RX=/Rekord|Größter|Bester|wenigste Züge|Längster|Wertvollster|Bestwert|bestes Ergebnis/;return mkTabsAll().map((t)=>t.ch?t:Object.assign({},t,{c:t.c.filter((c)=>RX.test(c.n))})).filter((t)=>t.ch||t.c.length)}
function chCalc(R,TB,md){if(md==="s0")TB=mkTabsAll();if(md==="all"){''')

# ---------- 5. Minispiele: Auszahlungen + Wochen-Faktor ----------
# Hafen-Fang: Fänge und Deckel doppelt (~500 Bits/Runde), gleiche Fisch-Dichte
rep('var HF_BASE=250;', 'var HF_BASE=500;')
rep('let b=Math.min(380,Math.max(ld("dd_hs_h",0)||0,(DD.s&&DD.s.bh)||0)),c0=HF_BASE;', 'let b=Math.min(760,Math.max(ld("dd_hs_h",0)||0,(DD.s&&DD.s.bh)||0)),c0=HF_BASE;')
rep('hcR=K.useRef(305);hcR.current=hc||305;', 'hcR=K.useRef(610);hcR.current=hc||610;')
rep('let f=Math.max(0,hcR.current/305-1)', 'let f=Math.max(0,hcR.current/610-1)')
rep('setSc((x)=>T?Math.min(hc,x+y.value/10):x+y.value/10)', 'setSc((x)=>T?Math.min(hc,x+y.value/5):x+y.value/10)')
rep('setRew(sc);P.earn(sc);DD.mgEnd(!0,sc,0);', 'let scM=Math.round(sc*ssM());setRew(scM);P.earn(scM);DD.mgEnd(!0,sc,0);')
# Memory: halb so viel
rep('let r=Math.max(300,Math.round(2400-(n2-9)*100))+bn.current;setRew(r);P.earn(r);DD.mgEnd(!1,r,n2);if(r>=1500)',
    'let r=Math.round((Math.max(300,Math.round(2400-(n2-9)*100))+bn.current)/2),rM=Math.round(r*ssM());setRew(rM);P.earn(rM);DD.mgEnd(!1,r,n2);if(r>=750)')
# Flugschule: halb so viel (Sekunden, Ringe, Landebonus)
rep('FS_RING=[10,20,30,40,60],FS_SEC=[2,4,6,8,10]', 'FS_RING=[5,10,15,20,30],FS_SEC=[1,2,3,4,5]')
rep('b:[1500,2500]', 'b:[750,1250]'); rep('b:[3000,4500]', 'b:[1500,2250]'); rep('b:[25000,30000]', 'b:[12500,15000]')
rep('if(tot>0)P.earn(tot);DD.s.tot=(DD.s.tot||0)+tot;', 'let totM=Math.round(tot*ssM());if(totM>0)P.earn(totM);DD.s.tot=(DD.s.tot||0)+totM;')
rep('setUi({ph:"end",how,bits:Math.round(g.bits),bonus,tot,', 'setUi({ph:"end",how,bits:Math.round(g.bits),bonus,tot:totM,')
# Dildi Peak
rep('bits=Math.max(0,bD+bS);', 'bits=Math.max(0,Math.round((bD+bS)*ssM()));')
# Torwand, Axt, Boxautomat
rep('if(sh.hit){P.earn(400);', 'if(sh.hit){P.earn(Math.round(400*ssM()));')
rep('setMsg("⚽ TOOOR!!! +400 Bits")', 'setMsg("⚽ TOOOR!!! +"+fmN(Math.round(400*ssM()))+" Bits")')
rep('if(q.pts>0){P.earn(q.pts);', 'if(q.pts>0){P.earn(Math.round(q.pts*ssM()));')
rep('setMsg(q.lab+(q.pts>0?" +"+q.pts+" Bits":""))', 'setMsg(q.lab+(q.pts>0?" +"+Math.round(q.pts*ssM())+" Bits":""))')
rep('P.earn(pts*4);DD.boxEnd(pts);', 'P.earn(Math.round(pts*4*ssM()));DD.boxEnd(pts);')
# Kippen: alle 5 statt 10 Minuten
rep('smokeLeft(){return Math.max(0,(this.s.cig||0)+600000-Date.now())}', 'smokeLeft(){return Math.max(0,(this.s.cig||0)+300000-Date.now())}')
# Erfolge + Wochenaufgaben mit Wochen-Faktor (Anzeige = Auszahlung)
rep('function ACHB(a){if(a.id==="leg1")return 100000;let i=(parseInt(String(a.id).replace(/^[a-z]+/,""))||1)-1,T=[500,1500,3000,6000,10000];return i<5?T[i]:10000+5000*(i-4)}',
    'function ACHB(a){if(a.id==="leg1")return Math.round(100000*ssM());let i=(parseInt(String(a.id).replace(/^[a-z]+/,""))||1)-1,T=[500,1500,3000,6000,10000];return Math.round((i<5?T[i]:10000+5000*(i-4))*ssM())}')
i = s.index('var WK=[')
j = s.index('\n', s.index('];', i))
s = s[:j] + '\nWK.forEach((t)=>{let b=t.r;Object.defineProperty(t,"r",{get:()=>Math.round(b*ssM()),configurable:!0})});' + s[j:]

# ---------- 6. Einsätze ----------
# Großes Pferderennen: max 5k / 10k / 25k je Saisonwoche, 50-%-Knopf, ALL-IN erst ab Woche 3; kleines: max 1.000
rep('(P.big?[1000,5000,10000,25000]:[100,500,1000,5000,10000]).map((v)=>{let ok=P.bits>=v,',
    '(P.big?[1000,2500,5000,10000,25000].filter((v)=>v<=[5000,10000,25000,25000,25000][ssW()]):[100,250,500,1000]).map((v)=>{let ok=P.bits>=v,')
rep('background:({10:"#1e6fb0",20:"#2f9e44",50:"#7b2cbf",100:"#b8860b",500:"#d9480f",1000:"#1e6fb0",5000:"#2f9e44",10000:"#7b2cbf",25000:"#b8860b"})[v]',
    'background:({10:"#1e6fb0",20:"#2f9e44",50:"#7b2cbf",100:"#b8860b",250:"#2f9e44",500:"#d9480f",1000:"#1e6fb0",2500:"#d9480f",5000:"#2f9e44",10000:"#7b2cbf",25000:"#b8860b"})[v]')
rep('P.big?m("button",{key:"allin",onClick:()=>P.bits>=1000&&dp===0&&setChip(P.bits),',
    'P.big?m("button",{key:"half",onClick:()=>{let h=Math.min([5000,10000,25000,25000,25000][ssW()],Math.floor(P.bits/2));if(h>=1000&&dp===0)setChip(h)},disabled:Math.floor(P.bits/2)<1000||dp!==0,style:{height:62,padding:"0 14px",borderRadius:31,border:"4px dashed rgba(255,255,255,.85)",background:"linear-gradient(180deg,#e08a1e,#7d4a0b)",color:"#fff",fontFamily:"Impact, sans-serif",fontSize:19,cursor:Math.floor(P.bits/2)>=1000&&dp===0?"pointer":"not-allowed",opacity:Math.floor(P.bits/2)<1000||dp!==0?.4:1},children:"50 %"}):null,P.big&&ssW()>=2?m("button",{key:"allin",onClick:()=>P.bits>=1000&&dp===0&&setChip(P.bits),')
rep('![1000,5000,10000,25000].includes(chip)', '![1000,2500,5000,10000,25000].includes(chip)')
rep('children:(P.big?"EINSÄTZE AB 1.000 BITS BIS ALL-IN • ":"")', 'children:(P.big?"EINSÄTZE AB 1.000 BITS • MAX "+fmN([5000,10000,25000,25000,25000][ssW()])+(ssW()>=2?" ODER ALL-IN":"")+" • ":"MAX 1.000 BITS • ")')
# Boxkampf: max 1.000
rep('sChips(chip,setChip,P.bits,0,[20,50,100,500,1000,5000,10000])', 'sChips(chip,setChip,P.bits,0,[20,50,100,250,500,1000])')
rep('let start=()=>{if(pk<0||P.bits<chip||ph!=="pick")return;P.spend(chip);bet.current=chip;', 'let start=()=>{if(pk<0||P.bits<chip||chip>1000||ph!=="pick")return;P.spend(chip);bet.current=chip;')
# Der Coup (Roulette): 1 Stunde zwischen den Missionen
rep('var HKH=900000;', 'var HKH=3600000;')

# ---------- 7. Dildi City bekommt Saisontag/-woche ----------
rep('JSON.stringify({bits:P.bits,sv:DD.s.gta||null,name:(DD.u&&DD.u.name)||"",rt:DDCFG})',
    'JSON.stringify({bits:P.bits,sv:DD.s.gta||null,name:(DD.u&&DD.u.name)||"",rt:DDCFG,sd:ssDay(),wk:ssW(),son:ssOn()})')

open(P, 'w', encoding='utf8').write(s)
print('ok')
