"""Börse: Spieler bewegen die Kurse (16.11.2026, Nick).
Gutes/schlechtes Spielen erzeugt Börsen-Ereignisse (bxEv). Sie liegen im eigenen Spielstand (bxe: je Firma
Stunden-Eimer mit Log-Rendite, bxn: letzte Nachrichten, bxd: Tageslimit) und kommen über die Ranglisten-Abfrage
(DD.board, alle 60 s über MktSync + beim Öffnen der Börse) zu allen anderen. bxIngest() summiert die Ereignisse
aller Spieler, bxBuild() rechnet sie zum festen Kursverlauf dazu → alle sehen denselben Kurs.
Tageslimit: pro Spieler, Firma und Saisontag höchstens +20 % (Kursrückgänge ohne Limit). Nur ab Saisonstart.

Firma ← Ereignis:
  BIL  Bilal Airlines   Flugschule-Landung leicht +1, mittel +2, schwer +4, schwer perfekt +6; Absturz < 10 s −0,5
  HFS  Hafensänger      Hafen-Fang mit vollem Netz (Deckel erreicht) +1,5; Jackpot am Hafensänger-Slot −3
  FLP  Flaschen Post    Fläschchen-Pack geöffnet +1; Flaschenpost-Tour in Dildi City +1,5
  CAPRI Pizza Capri     heiße Pizza in Dildi City +0,3; Serie 15 +3; kalte Pizza −0,2
  KIP  Kippen AG        Kippe gezogen +0,7
  GAUL Gaul & Doping    Doping erfolgreich +3; Außenseiter gewinnt +2; Doping missglückt −4
  DIL  Dildi Casino AG  Gewinn ab 5.000 an Slots/Tischen −1,5; verlorener Einsatz ab 5.000 +1
  SIG bleibt an den Sigma-Liga-Toren, MON und EIS reiner Zufall.
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
if 'function bxEv(' in s:
    print('schon drin'); sys.exit()

CORE = r'''
/* ---- Spieler bewegen die Kurse (bxEv / bxIngest) ---- */
var BXI={m:BX.map(()=>({})),news:[],rows:[],sg:""};
function bxIngest(rows){try{if(rows)BXI.rows=rows;let me=DD.u?DD.u.name:"",all=(BXI.rows||[]).filter((x)=>x&&x.name!==me&&x.data).map((x)=>({n:x.name,d:x.data}));if(DD.u)all.push({n:me,d:DD.s});
 let mm=BX.map(()=>({})),nw=[];all.forEach((p)=>{let e=p.d.bxe||{};Object.keys(e).forEach((k)=>{let i=BX.findIndex((x)=>x.k===k);if(i<0)return;Object.keys(e[k]||{}).forEach((b)=>{let t=(+b)*4;mm[i][t]=(mm[i][t]||0)+(+e[k][b]||0)})});(p.d.bxn||[]).forEach((x)=>{let i=BX.findIndex((y)=>y.k===x.k);if(i>=0)nw.push({t:x.t,i:i,up:x.p>0,p:x.p,tx:"👤 "+p.n+": "+x.x})})});
 let sg=JSON.stringify(mm);BXI.news=nw;if(sg!==BXI.sg){BXI.sg=sg;BXI.m=mm;BXC.L=BX.map(()=>[]);BXC.news=[]}}catch(e){}}
function bxEv(k,pct,tx){try{if(!ssOn()||!DD.u||!pct)return;if(BX.findIndex((x)=>x.k===k)<0)return;let s=DD.s,T=Math.max(0,bxTn()),day=ssDay(),q=s.bxd=(s.bxd&&s.bxd.d===day)?Object.assign({},s.bxd):{d:day};
 if(pct>0){let u=q[k]||0,a=Math.min(pct,20-u);if(a<.001)return;q[k]=Math.round((u+a)*1000)/1000;pct=a}
 let b=Math.floor(T/4);s.bxe=Object.assign({},s.bxe);let e=s.bxe[k]=Object.assign({},s.bxe[k]);e[b]=Math.round(((e[b]||0)+Math.log(1+pct/100))*1e5)/1e5;
 s.bxn=[{t:T,k:k,p:Math.round(pct*10)/10,x:tx}].concat(s.bxn||[]).slice(0,12);DD.save();bxIngest(null)}catch(e){}}
function bxCity(sv){try{let a=dcS(DD.s),b=dcS({gta:sv}),d=(k)=>Math.max(0,(b[k]||0)-(a[k]||0));
 let fp=d("fp"),ph=d("pzHot"),pc=d("pzCold"),p15=d("pzS15");if(fp)bxEv("FLP",1.5*fp,"Flaschenpost-Tour in Dildi City");if(ph)bxEv("CAPRI",.3*ph,ph+"× heiße Pizza geliefert");if(p15)bxEv("CAPRI",3*p15,"Pizza-Serie ×15!");if(pc)bxEv("CAPRI",-.2*pc,pc+"× kalte Pizza")}catch(e){}}
function bxHook(){if(window.__bxHooked||typeof DD==="undefined")return;window.__bxHooked=1;let w=(name,fn)=>{let o=DD[name];if(typeof o!=="function")return;DD[name]=function(){let r=o.apply(this,arguments);try{fn.apply(null,[r].concat([].slice.call(arguments)))}catch(e){}return r}};
 w("res",(r,l,j,j0)=>{if(l&&j0>=100)bxEv("HFS",-3,"Jackpot am Hafensänger – die Reederei zahlt");if(j>=5000)bxEv("DIL",-1.5,"Großer Slot-Gewinn: "+fmN(Math.round(j))+" Bits")});
 w("pw",(r,j)=>{if(j>=5000)bxEv("DIL",-1.5,"Power-Spins bringen "+fmN(Math.round(j))+" Bits")});
 w("bjEnd",(r,p)=>{if(p>=5000)bxEv("DIL",-1.5,"Blackjack-Gewinn: "+fmN(p)+" Bits");else if(p<=-5000)bxEv("DIL",1,"Verliert "+fmN(-p)+" Bits am Blackjack-Tisch")});
 w("roul",(r,win,bet,zero)=>{if(win&&!zero&&bet>=5000)bxEv("DIL",-1.5,"Roulette-Gewinn: "+fmN(bet)+" Bits");else if(!win&&!zero&&bet>=5000)bxEv("DIL",1,"Verliert "+fmN(bet)+" Bits am Roulette")});
 w("kEnd",(r,wn)=>{if(wn>=5000)bxEv("DIL",-1.5,"Gekoffert: "+fmN(wn)+" Bits")});
 w("openPack",(r)=>{if(r)bxEv("FLP",1,"Fläschchen-Pack geöffnet")});
 w("smoke",(r)=>{if(r)bxEv("KIP",.7,"Kippe gezogen")})}
'''
reps = [
    ('var BXC={L:BX.map(()=>[]),news:[],sig:null};', 'var BXC={L:BX.map(()=>[]),news:[],sig:null};' + CORE),
    ('L.push(l+r)}})}', 'r+=(BXI.m[i]&&BXI.m[i][t])||0;L.push(l+r)}})}'),
    ('function bxNews(T,lim){bxBuild(T);let a=[];for(let q=BXC.news.length-1;q>=0&&a.length<(lim||40);q--){let x=BXC.news[q];',
     'function bxNews(T,lim){bxBuild(T);let a=[],N=BXC.news.concat(BXI.news||[]).filter((x)=>x.t<=T).sort((x,y)=>x.t-y.t);for(let q=N.length-1;q>=0&&a.length<(lim||40);q--){let x=N[q];'),
    ('let b=await this.board();if(!b)return null;', 'let b=await this.board();if(!b)return null;try{bxIngest(b)}catch(e){}'),
    ('else if(d.gta==="save"){if(d.sv&&typeof d.sv==="object"){DD.s.gta=d.sv;DD.save()}}else if(d.gta==="exit"){if(d.sv&&typeof d.sv==="object"){DD.s.gta=d.sv;DD.save()}',
     'else if(d.gta==="save"){if(d.sv&&typeof d.sv==="object"){bxCity(d.sv);DD.s.gta=d.sv;DD.save()}}else if(d.gta==="exit"){if(d.sv&&typeof d.sv==="object"){bxCity(d.sv);DD.s.gta=d.sv;DD.save()}'),
    ('if(sc>=hc*.95){', 'if(sc>=hc*.95){bxEv("HFS",1.5,"Volles Netz beim Hafen-Fang");'),
    ('let totM=Math.round(tot*ssM());', 'let totM=Math.round(tot*ssM());try{let di=FS_DIF.indexOf(FSD);if(how==="landed")bxEv("BIL",di===2?(g.land==="perfekt"?6:4):di===1?2:1,(g.land==="perfekt"?"Perfekte":"Sichere")+" Landung in der Flugschule ("+FSD.lb+")");else if(how==="crash"&&g.t<10)bxEv("BIL",-.5,"Absturz kurz nach dem Start")}catch(e){}'),
    ('if(d>0){DD.s.dopeOk=(DD.s.dopeOk||0)+1;DD.save()}', 'if(d>0){DD.s.dopeOk=(DD.s.dopeOk||0)+1;DD.save();bxEv("GAUL",3,"Doping erfolgreich gesetzt")}else if(d<0)bxEv("GAUL",-4,"Doping missglückt – Pferd verletzt")'),
    ('{DD.s.hrOut=1;DD.save()}', '{DD.s.hrOut=1;DD.save();bxEv("GAUL",2,"Außenseiter gewinnt das Rennen")}'),
    ('function Vz0(){psHook();', 'function Vz0(){psHook();bxHook();'),
]
for a, b in reps:
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
# Börse: beim Öffnen und jede Minute die Ereignisse aller Spieler holen
a = 'function BoerseGame(P){let [now,setNow]=K.useState(Date.now()),'
b = 'function BoerseGame(P){K.useEffect(()=>{let go=()=>{try{DD.board().then((b)=>{if(b)bxIngest(b)}).catch(()=>{})}catch(e){}};go();let iv=setInterval(()=>{if(!document.hidden)go()},60000);return()=>clearInterval(iv)},[]);let [now,setNow]=K.useState(Date.now()),'
if s.count(a) != 1:
    sys.exit('BoerseGame nicht gefunden')
s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
