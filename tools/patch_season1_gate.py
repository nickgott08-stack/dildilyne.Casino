# Hafen-Fang, Memory, Flugschule und Rangliste erst ab Saisonstart (ssOn()) auf die neuen Werte.
import sys
P = 'dildilyne_casino_koop.html'
s = open(P, encoding='utf8').read()
if 'function fsEco()' in s:
    print('schon gepatcht'); sys.exit(0)
def rep(a, b, n=1):
    global s
    c = s.count(a)
    if c != n: raise SystemExit(f'{n}x erwartet, {c}x gefunden: {a[:90]!r}')
    s = s.replace(a, b)
# Hafen-Fang: Deckel/Fangwert/Dichte vor Saisonstart wie früher
rep('let b=Math.min(760,Math.max(ld("dd_hs_h",0)||0,(DD.s&&DD.s.bh)||0)),c0=HF_BASE;',
    'let S1=ssOn(),b=Math.min(S1?760:380,Math.max(ld("dd_hs_h",0)||0,(DD.s&&DD.s.bh)||0)),c0=S1?HF_BASE:250;')
rep('hcR=K.useRef(610);hcR.current=hc||610;', 'hcR=K.useRef(ssOn()?610:305);hcR.current=hc||(ssOn()?610:305);')
rep('let f=Math.max(0,hcR.current/610-1)', 'let f=Math.max(0,hcR.current/(ssOn()?610:305)-1)')
rep('setSc((x)=>T?Math.min(hc,x+y.value/5):x+y.value/10)', 'setSc((x)=>T?Math.min(hc,x+y.value/(ssOn()?5:10)):x+y.value/10)')
# Memory: Hälfte erst ab Saisonstart
rep('let r=Math.round((Math.max(300,Math.round(2400-(n2-9)*100))+bn.current)/2),', 'let r=Math.round((Math.max(300,Math.round(2400-(n2-9)*100))+bn.current)/(ssOn()?2:1)),')
rep('if(r>=750){setQz(3)', 'if(r>=(ssOn()?750:1500)){setQz(3)')
# Flugschule: Basiswerte zurück, ab Saisonstart halbiert (Arrays werden in place gesetzt -> Anzeige stimmt)
rep('FS_RING=[5,10,15,20,30],FS_SEC=[1,2,3,4,5]', 'FS_RING=[10,20,30,40,60],FS_SEC=[2,4,6,8,10]')
rep('b:[750,1250]', 'b:[1500,2500]'); rep('b:[1500,2250]', 'b:[3000,4500]'); rep('b:[12500,15000]', 'b:[25000,30000]')
i = s.index('FS_LV=['); j = s.index(';', i) + 1
s = s[:j] + '\nfunction fsEco(){let k=ssOn()?.5:1;[10,20,30,40,60].forEach((v,i)=>{FS_RING[i]=v*k});[2,4,6,8,10].forEach((v,i)=>{FS_SEC[i]=v*k});[[1500,2500],[3000,4500],[25000,30000]].forEach((b,i)=>{FS_DIF[i].b=[b[0]*k,b[1]*k]})}' + s[j:]
rep('function FlightSchool(P){', 'function FlightSchool(P){fsEco();')
# Rangliste: bis Saisonstart wie früher (alle Kategorien)
rep('function mkTabs(){let RX=', 'function mkTabs(){if(!ssOn())return mkTabsAll();let RX=')
open(P, 'w', encoding='utf8').write(s)
print('ok')
