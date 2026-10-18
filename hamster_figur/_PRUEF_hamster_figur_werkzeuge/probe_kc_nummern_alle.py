"""probe_kc_nummern_alle.py — Kontroll-Chat 18.10.2026: JEDER Satz JEDER Nummer einmal gezielt in der Blase.
Aufruf: python3 -I probe_kc_nummern_alle.py <bos> <launcher|schoner> <breite> <hoehe> <port>
Je Satz: Textliste der Nummer zur Laufzeit auf genau diesen Satz setzen, echte nummer() spielen, Blase messen (im Bild? Text gleich?)."""
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
bos=os.path.abspath(sys.argv[1]); ORT=sys.argv[2]; VW=int(sys.argv[3]); VH=int(sys.argv[4]); PORT=int(sys.argv[5])
H=functools.partial(http.server.SimpleHTTPRequestHandler, directory=bos)
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',PORT),H); srv.RequestHandlerClass.log_message=lambda *a,**k: None
threading.Thread(target=srv.serve_forever,daemon=True).start()
man=json.load(open(os.path.join(bos,'hamster_figur','hamster_figur_manifest.json'),encoding='utf-8'))
E={'ort':ORT,'groesse':f'{VW}x{VH}','geprueft':0,'nicht_gezeigt':[],'ausserhalb':[],'konsole':[],'nummer_dauer_ms':man['verhalten']['nummer_dauer_ms'],'blase_ms':None}
RUHIG="{erste_nummer_s:[900,900],nummer_s:[900,900],lauf_s:[900,900],phase_s:900,nachhol_s:[900,900]}"
with sync_playwright() as pw:
    b=pw.chromium.launch(); h=b.new_page(viewport={'width':VW,'height':VH})
    h.on('pageerror', lambda e: E['konsole'].append(str(e))); h.on('console', lambda x: E['konsole'].append(x.text) if x.type=='error' else None)
    h.goto(f'http://127.0.0.1:{PORT}/hamster_figur/_PRUEF_hamster_figur_schoner.html'); h.wait_for_load_state('load'); h.wait_for_timeout(3500)
    if ORT=='launcher':
        F="BOS_CRUMBLE_HOST.figur()"; h.evaluate(f"{F}.manifest().schreibtisch.sichtkontakt={RUHIG}; {F}.an(true); {F}.sichtbar(true)")
    else:
        h.evaluate("BOS_SCREENSAVER._zeigeJetzt()"); h.wait_for_timeout(1500); F="BOS_SCREENSAVER._figur()"
        h.evaluate(f"{F}.manifest().spielplatz.schlaf_nach_ms = 99999999; {F}.manifest().spielplatz.reaktions_anteil = 0; {F}.an(true)")
    h.wait_for_timeout(400)
    # Blasen-Standzeit einmal echt messen (Nummer mit realer Dauer)
    E['blase_ms']=h.evaluate(f"""new Promise(res=>{{const f={F}; f.nummer('karate'); const t0=performance.now(); const bl=()=>f.wurzel().querySelector('.hf__blase');
       setTimeout(()=>{{const iv=setInterval(()=>{{const x=bl(); if(!x.textContent || getComputedStyle(x).opacity==='0' || x.offsetParent===null){{clearInterval(iv); res(Math.round(performance.now()-t0));}} }},50);}},300);}})""")
    h.wait_for_timeout(2500)
    h.evaluate(f"{F}.manifest().verhalten.nummer_dauer_ms = 900")
    for name,n in man['nummern'].items():
        z='nummer_'+name
        for t in n['texte']:
            r=h.evaluate("""(([F,z,name,t])=>{const f=eval(F); const zs=f.manifest().zustaende[z]; zs.texte=[t]; f.nummer(name); return true})""", [F,z,name,t])
            h.wait_for_timeout(330)
            x=h.evaluate(f"""(()=>{{const bl={F}.wurzel().querySelector('.hf__blase'); const r=bl.getBoundingClientRect(); return {{t:bl.textContent, l:r.left, r:r.right, o:r.top, u:r.bottom, w:innerWidth, h:innerHeight, z:{F}.zustand()}}}})()""")
            E['geprueft']+=1
            if x['t']!=t: E['nicht_gezeigt'].append((name,t,x['t'],x['z']))
            elif x['l']<0 or x['r']>x['w'] or x['o']<0 or x['u']>x['h']: E['ausserhalb'].append((name,len(t),t,[round(v) for v in (x['l'],x['r'],x['o'],x['u'])]))
            h.wait_for_timeout(620)
    b.close()
srv.shutdown()
print(json.dumps(E,ensure_ascii=False))
