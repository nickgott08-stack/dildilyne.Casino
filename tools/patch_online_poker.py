"""Online-Poker im Casino + Kartenvorderseiten zu den Kartenrücken-Skins (18.11.2026, Nick/Julian).
- Poker-Lobby: Knopf „🌐 ONLINE-POKER“ → OnlinePoker: verbindet sich mit dem Online-Server (server/poker.js, wss://…/ws,
  Nachrichten t:'pk'), Tische 100–5.000, 2–6 echte Spieler, 20 s pro Zug. Buy-in = min(Bits, 60 × Tisch), mind. 24 × Tisch.
  Der Stapel liegt solange in DD.s.pko {st, stack} (vom Server laufend aktualisiert); beim Aufstehen (pkbye), bei
  Verbindungsabbruch oder beim nächsten Login (jfix) kommt der letzte bekannte Stapel zurück aufs Konto.
  Statistik/„Insgesamt erspielt“/Pass/Börse wie beim normalen Poker (pkr = Ergebnis einer Hand).
- Kartenvorderseite passend zum Kartenrücken-Skin (psCardFront): Schwarz-Gold = schwarze Karte, goldene/rote Zeichen,
  Sigma-Lila = lila Karte, weiße/rosa Zeichen. Gilt für Blackjack und Poker (BJC).
"""
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf-8').read()
if 'function OnlinePoker(' in s:
    print('schon drin'); sys.exit()

ONLINE = r'''
/* ===== ONLINE-POKER (echte Spieler über den Online-Server, server/poker.js) ===== */
var PK_SRV="wss://dildilyne-casino-1.onrender.com/ws";
function OnlinePoker(P){pkCss();let [st,setSt]=K.useState(null),[tl,setTl]=K.useState(null),[err,setErr]=K.useState(""),[conn,setConn]=K.useState("connecting"),[,rf]=K.useState(0),[win,setWin]=K.useState(null),ws=K.useRef(null),lastTurn=K.useRef(-1),tn=gTn(P),me=DD.u?DD.u.name:"Gast";
 let srv=()=>{try{let q=new URLSearchParams(location.search).get("server");if(q)return q}catch(e){}return PK_SRV};
 let snd=(o)=>{try{if(ws.current&&ws.current.readyState===1)ws.current.send(JSON.stringify(o))}catch(e){}};
 let refund=()=>{let o=DD.s.pko;if(o){delete DD.s.pko;DD.save();if(o.stack>0)P.earn(o.stack)}};
 K.useEffect(()=>{let w;try{w=new WebSocket(srv())}catch(e){setConn("err");return}ws.current=w;
  w.onopen=()=>{setConn("ok");snd({t:"pk",a:"list"})};
  w.onclose=()=>{setConn((c)=>c==="ok"?"lost":"err");refund();setSt(null)};w.onerror=()=>{};
  w.onmessage=(e)=>{let m;try{m=JSON.parse(e.data)}catch(x){return}
   if(m.t==="pkl")setTl(m.tables);
   else if(m.t==="pkerr"){setErr(m.m);refund()}
   else if(m.t==="pks"){let y=m.seats[m.you];if(y&&DD.s.pko){DD.s.pko.stack=y.stack;sv("dd_stats",DD.s)}m.at=Date.now();
    let mt=m.turn===m.you&&!m.over;if(mt&&lastTurn.current!==m.turn+"|"+m.stage+"|"+m.cur+"|"+m.pot)tn(880,.12,"triangle",.15);lastTurn.current=mt?m.turn+"|"+m.stage+"|"+m.cur+"|"+m.pot:-1;setSt(m)}
   else if(m.t==="pkr"){try{let s=pkS(),net=m.net;s.h++;if(m.win){s.w++;s.big=Math.max(s.big,m.won)}if(net>0){s.won+=net;DD.s.tot=(DD.s.tot||0)+net;s.best=Math.max(s.best,net)}else s.lost+=-net;if(m.win&&m.top>s.top)s.top=m.top;
     DD.s.pl=Object.assign({},DD.s.pl);DD.s.pl.pk=(DD.s.pl.pk||0)+1;if(DD.s.pko)DD.s.pko.stack=m.stack;try{psEv("pkh");if(m.win)psEv("pkw");psPlay("pk")}catch(x){}
     try{bxWager(m.put);if(net<=-5000)bxEv("DIL",1,"Verliert "+fmN(-net)+" Bits am Online-Pokertisch")}catch(x){}if(net>=1000&&DD.bigw)DD.bigw("Online-Poker",net);DD.save();
     if(m.win){setWin(m.won);[523,659,784,1047].forEach((f,k)=>tn(f,.22,"triangle",.16,k*.09));setTimeout(()=>setWin(null),2500)}else tn(196,.4,"sawtooth",.1)}catch(x){}}
   else if(m.t==="pkbye"){delete DD.s.pko;DD.save();if(m.stack>0)P.earn(m.stack);setSt(null);snd({t:"pk",a:"list"})}};
  let iv=setInterval(()=>{if(!DD.s.pko)snd({t:"pk",a:"list"});rf((x)=>x+1)},1000);
  return()=>{clearInterval(iv);try{if(DD.s.pko)snd({t:"pk",a:"leave"})}catch(e){}try{w.close()}catch(e){}refund()}},[]);
 let sit=(v)=>{setErr("");if(DD.s.pko)return;let buy=Math.min(P.bits,v*60);if(buy<v*PK_NEED){setErr("Du brauchst mind. "+fmN(v*PK_NEED)+" Bits");return}P.spend(buy);DD.s.pko={st:v,stack:buy};DD.save();snd({t:"pk",a:"sit",st:v,stack:buy,name:me});tn(600,.05,"square",.08)};
 let stand=()=>{if(DD.s.pko)snd({t:"pk",a:"leave"});else P.back()};
 let back=m("button",{key:"bk",onClick:()=>{if(st)stand();else P.back()},style:{position:"absolute",left:14,top:10,zIndex:50,background:"rgba(0,0,0,0.7)",border:"1px solid #D4AF37",borderRadius:8,color:"#FFE27A",fontFamily:"monospace",fontSize:12,padding:"7px 12px",cursor:"pointer"},children:st?"← AUFSTEHEN":"← POKER"});
 let bits=m("div",{key:"bits",style:{position:"absolute",right:14,top:10,zIndex:50,border:"1px solid #D4AF37",borderRadius:8,background:"rgba(0,0,0,0.6)",color:"#FFE27A",fontFamily:"monospace",fontSize:12,padding:"6px 10px"},children:"BITS: "+fmN(P.bits)});
 if(!st){let cs=conn==="ok"?"🟢 verbunden":conn==="connecting"?"🟡 verbinde mit dem Online-Server … (kann beim ersten Mal ~30 s dauern)":conn==="lost"?"🔴 Verbindung verloren – zurück und nochmal öffnen":"🔴 Online-Server nicht erreichbar";
  return gFrame(P,"radial-gradient(ellipse at 50% 30%,#0f2a4a 0%,#06101e 60%,#020408 100%)",[back,bits,m("div",{key:"t",style:{position:"absolute",left:0,right:0,top:18,textAlign:"center",fontFamily:"Impact, sans-serif",fontSize:34,color:"#FFE27A"},children:"🌐 ONLINE-POKER"}),
   W("div",{key:"c",style:{position:"absolute",left:120,right:120,top:80,bottom:24,borderRadius:20,border:"2px solid rgba(76,201,255,.5)",background:"rgba(0,0,0,.5)",display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:20,boxSizing:"border-box"},children:[
    m("div",{style:{fontSize:13,color:"#cfe8ff"},children:cs}),
    m("div",{style:{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"},children:PK_ST.map((v)=>{let t=(tl||[]).find((x)=>x.st===v)||{n:0,max:6},ok=P.bits>=v*PK_NEED&&conn==="ok"&&t.n<t.max;return W("button",{key:v,onClick:()=>sit(v),disabled:!ok,style:{width:150,height:116,borderRadius:14,border:"3px solid "+(t.n?"#4cc9ff":"rgba(255,255,255,.18)"),background:"rgba(0,0,0,.55)",color:"#fff",cursor:ok?"pointer":"default",opacity:ok?1:.45,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3},children:[m("div",{style:{fontFamily:"Impact, sans-serif",fontSize:28,color:"#FFE27A"},children:fmN(v)}),m("div",{style:{fontSize:10.5,color:"#e8e0cc"},children:"Blinds "+fmN(v/2)+"/"+fmN(v)}),m("div",{style:{fontSize:13,fontWeight:900,color:t.n?"#4cc9ff":"#aaa"},children:"👥 "+t.n+" / "+t.max}),m("div",{style:{fontSize:10,color:P.bits>=v*PK_NEED?"#7CFF6B":"#ff8a80"},children:"Buy-in "+fmN(Math.min(Math.max(P.bits,v*PK_NEED),v*60))})]})})}),
    err?m("div",{style:{color:"#ff8a80",fontWeight:900},children:err}):null,
    m("div",{style:{fontSize:13,color:"#e8e0cc",lineHeight:1.6,maxWidth:900,textAlign:"center"},children:"Echte Spieler, keine Computer. Du setzt dich mit einem Stapel hin (bis 60 × Tischgröße, mind. 24 ×). Eine Hand startet, sobald mind. 2 Spieler am Tisch sitzen. 20 Sekunden pro Zug – sonst automatisch Check bzw. Fold. Fixed Limit wie beim normalen Poker. Beim Aufstehen kommt dein Stapel zurück aufs Konto."})]})])}
 let N=st.seats.length,you=st.seats[st.you]||{},myTurn=st.turn===st.you&&!st.over&&!you.f&&you.inH,toCall=st.cur-(you.r||0),canRaise=st.nb<PK_CAP,left=Math.max(0,Math.ceil((st.left-(Date.now()-st.at))/1000));
 let card=(c,k,hide,sc)=>m("div",{key:k,style:{transform:"scale("+(sc||1)+")",transformOrigin:"center",margin:sc?"0 "+(-78*(1-sc)/2+2)+"px":"0 4px"},children:m(BJC,{c:c||{r:"",s:"♠"},first:!0,hide:hide||!c})});
 let POS=[{x:640,y:612},{x:150,y:380},{x:300,y:110},{x:640,y:92},{x:980,y:110},{x:1130,y:380}],SL=[[0],[0],[0,3],[0,2,4],[0,1,3,5],[0,1,2,4,5],[0,1,2,3,4,5]][N]||[0,1,2,3,4,5],felt=psFelt();
 let seat=(s,i)=>{let rel=(i-st.you+N)%N,p=POS[SL[rel]],turn=st.turn===i&&!st.over,isW=st.res&&st.res.win.includes(i);return W("div",{key:"s"+i,style:{position:"absolute",left:p.x-120,top:p.y-(rel===0?70:62),width:240,display:"flex",flexDirection:"column",alignItems:"center",gap:4,zIndex:4,opacity:s.f&&s.inH?.45:1},children:[
  rel===0||!s.inH?null:m("div",{style:{display:"flex",height:70,alignItems:"center"},children:(s.h||[null,null]).map((c,k)=>card(c,k,!c,.62))}),
  W("div",{style:{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:30,background:isW?"linear-gradient(90deg,rgba(124,255,107,.35),rgba(0,0,0,.8))":"rgba(0,0,0,.78)",border:"2px solid "+(isW?"#7CFF6B":turn?"#FFE27A":"rgba(76,201,255,.5)"),animation:turn?"pkTurn 1s infinite":"none"},children:[
   m("div",{style:{fontWeight:900,fontSize:14},children:s.name}),m("div",{style:{fontSize:12,color:"#FFE27A"},children:"🪙 "+fmN(s.stack)}),
   s.dl?m("div",{style:{width:22,height:22,borderRadius:"50%",background:"#fff",color:"#000",fontWeight:900,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"},children:"D"}):null,
   turn?m("div",{style:{fontSize:12,fontWeight:900,color:left<=5?"#ff6b6b":"#fff"},children:"⏱ "+left}):null]}),
  s.a?m("div",{style:{fontSize:13,fontWeight:900,padding:"2px 10px",borderRadius:8,background:/Fold/.test(s.a)?"rgba(120,0,0,.8)":/Raise|Bet/.test(s.a)?"rgba(160,110,0,.9)":"rgba(0,0,0,.7)",color:"#fff"},children:s.a}):null,
  (st.over&&st.res&&st.res.hn&&s.inH&&!s.f&&s.h&&s.h[0])?m("div",{style:{fontSize:11,color:"#FFE27A"},children:PK_HN[pkEval(s.h.concat(st.board))[0]]}):null]})};
 let myHand=!you.inH||you.f||!you.h||!you.h[0]?"":(st.board.length?PK_HN[pkEval(you.h.concat(st.board))[0]]:(pkV(you.h[0])===pkV(you.h[1])?"Pocket-Paar":"Starthand"));
 let btn=(t,fn,on,bg)=>m("button",{onClick:fn,disabled:!on,style:{...mgB(190),height:58,fontSize:18,whiteSpace:"nowrap",opacity:on?1:.35,background:bg||undefined,color:bg?"#fff":undefined},children:t});
 let acts=[btn("FOLD",()=>snd({t:"pk",a:"act",k:"fold"}),myTurn,"linear-gradient(180deg,#e0463e,#8e1b12)"),btn(toCall>0?"CALL "+fmN(toCall):"CHECK",()=>snd({t:"pk",a:"act",k:"call"}),myTurn),btn(st.cur>0?"RAISE AUF "+fmN(st.cur+st.bet):"BET "+fmN(st.bet),()=>snd({t:"pk",a:"act",k:"raise"}),myTurn&&canRaise,"linear-gradient(180deg,#2f9e44,#14532d)")];
 return gFrame(P,"radial-gradient(ellipse at 50% 40%,#08121a 0%,#030608 70%,#000 100%)",[back,bits,
  m("div",{key:"tbl",style:{position:"absolute",left:170,top:120,width:940,height:420,borderRadius:"50%",border:"18px solid "+felt.rim,background:felt.bg,boxShadow:"inset 0 0 0 4px #4cc9ff, inset 0 0 60px rgba(0,0,0,.5), 0 20px 50px rgba(0,0,0,.7)"}}),
  W("div",{key:"mid",style:{position:"absolute",left:340,top:232,width:600,display:"flex",flexDirection:"column",alignItems:"center",gap:10,zIndex:3},children:[
   W("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"5px 16px",borderRadius:20,background:"rgba(0,0,0,.6)",border:"1px solid rgba(255,226,122,.6)"},children:[m("span",{style:{fontSize:20},children:"🪙"}),m("span",{style:{fontFamily:"Impact, sans-serif",fontSize:24,color:"#FFE27A"},children:"POT "+fmN(st.pot)})]}),
   m("div",{style:{display:"flex",height:116,alignItems:"center"},children:[0,1,2,3,4].map((k)=>st.board[k]?card(st.board[k],"b"+k):m("div",{key:"e"+k,style:{width:78,height:112,margin:"0 4px",borderRadius:9,border:"2px dashed rgba(255,255,255,.18)"}}))}),
   m("div",{style:{fontSize:14,fontWeight:800,color:"#fff",textShadow:"0 2px 6px #000",minHeight:20,textAlign:"center"},children:st.msg||""})]}),
  ...st.seats.map(seat),
  W("div",{key:"me",style:{position:"absolute",left:30,top:540,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6,zIndex:5},children:[you.inH&&you.h?m("div",{style:{display:"flex"},children:you.h.map((c,k)=>card(c,"m"+k,!1))}):m("div",{style:{fontSize:13,color:"#cfe8ff",maxWidth:300},children:you.stack<st.st*PK_NEED?"Zu wenig Chips für die nächste Hand – steh auf und setz dich neu hin.":"Du bist ab der nächsten Hand dabei …"}),
   m("div",{style:{fontSize:13,fontWeight:900,color:"#FFE27A"},children:you.f&&you.inH?"Ausgestiegen":myHand})]}),
  W("div",{key:"act",style:{position:"absolute",left:395,bottom:20,display:"flex",gap:10,zIndex:6},children:acts}),
  win?m("div",{key:"wn",style:{position:"absolute",left:0,right:0,top:182,textAlign:"center",fontFamily:"Impact, sans-serif",fontSize:46,color:"#7CFF6B",textShadow:"0 0 20px rgba(124,255,107,.8),0 4px 0 #000",zIndex:7,pointerEvents:"none"},children:"+"+fmN(win)+" BITS"}):null])}
'''
reps = [
    # online poker component goes right before the game blob
    ('\nvar GTAHTML=', ONLINE + '\nvar GTAHTML='),
    # lobby button + route
    ('m("button",{onClick:newTable,disabled:P.bits<stake*PK_NEED,style:{...mgB(340),height:64,fontSize:26,opacity:P.bits>=stake*PK_NEED?1:.4,animation:"slGlow 1.4s infinite"},children:"♠ AN DEN TISCH"}),',
     'm("button",{onClick:newTable,disabled:P.bits<stake*PK_NEED,style:{...mgB(340),height:64,fontSize:26,opacity:P.bits>=stake*PK_NEED?1:.4,animation:"slGlow 1.4s infinite"},children:"♠ AN DEN TISCH"}),'
     'm("button",{onClick:()=>{setPh("online")},style:{...mgB(340),height:52,fontSize:19,background:"linear-gradient(180deg,#2f6fde,#173a80)",color:"#fff"},children:"🌐 ONLINE-POKER (echte Spieler)"}),'),
    (' let felt=psFelt();\n if(ph==="lobby"){', ' let felt=psFelt();\n if(ph==="online")return m(OnlinePoker,{...P,back:()=>setPh("lobby")});\n if(ph==="lobby"){'),
    # chips back after a closed page
    ('function jfix(Rz,S7){let u=DD.u;', 'function jfix(Rz,S7){let u=DD.u;if(u&&DD.s.pko){let o=DD.s.pko;delete DD.s.pko;DD.save();if(o.stack>0)S7((v)=>v+o.stack)}'),
    # card fronts for the card skins
    ('function psCardBack(){', 'function psCardFront(red){let k=psSk("cards");return k==="sk12"?{background:"linear-gradient(160deg,#262626,#050505)",color:red?"#ff4d5e":"#FFD34D",boxShadow:"0 4px 12px rgba(0,0,0,0.55), inset 0 0 0 2px #D4AF37"}:k==="sk13"?{background:"linear-gradient(160deg,#8a3fd1,#3c0f6e)",color:red?"#ffb3e0":"#ffffff",boxShadow:"0 4px 12px rgba(0,0,0,0.55), inset 0 0 0 2px #f0e0ff"}:{background:"#fff",color:red?"#c0152a":"#111"}}\nfunction psCardBack(){'),
    ('return W("div",{style:{...base,background:"#fff",color:red?"#c0152a":"#111",fontFamily:"Georgia, serif",fontWeight:900},children:',
     'return W("div",{style:{...base,...psCardFront(red),fontFamily:"Georgia, serif",fontWeight:900},children:'),
]
for a, b in reps:
    if s.count(a) != 1:
        sys.exit('nicht eindeutig (%d): %s' % (s.count(a), a[:70]))
    s = s.replace(a, b)
open(P, 'w', encoding='utf-8').write(s)
print('ok')
