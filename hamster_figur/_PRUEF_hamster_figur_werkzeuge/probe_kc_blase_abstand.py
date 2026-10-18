"""probe_kc_blase_abstand.py — Kontroll-Chat 18.10.2026: Abstand Blasenspitze ↔ Figur über die ganze Nummer (alle 40 ms).
Aufruf: python3 -I probe_kc_blase_abstand.py <bos> <breite> <hoehe>. Negativ = Blase liegt auf der Figur.
Figur-Oberkante = oberste Zeile des sichtbaren Bildes mit Alpha > 40 (aus dem PNG gemessen, nicht der Bildkasten)."""
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
bos=os.path.abspath(sys.argv[1]); VW=int(sys.argv[2]); VH=int(sys.argv[3]); PORT=8820
H=functools.partial(http.server.SimpleHTTPRequestHandler, directory=bos)
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',PORT),H); srv.RequestHandlerClass.log_message=lambda *a,**k: None
threading.Thread(target=srv.serve_forever,daemon=True).start()
man=json.load(open(os.path.join(bos,'hamster_figur','hamster_figur_manifest.json'),encoding='utf-8'))
E={}
JS="""async ([name, ms]) => {
  const f=BOS_CRUMBLE_HOST.figur(); const w=f.wurzel();
  // oberste deckende Zeile des aktiven Bildes (Alpha) einmal je Bild bestimmen
  const obenAnteil = (img) => { if (img.__oben!==undefined) return img.__oben; const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
     const g=c.getContext('2d'); g.drawImage(img,0,0); const d=g.getImageData(0,0,c.width,c.height).data;
     for (let y=0;y<c.height;y++){ for(let x=0;x<c.width;x++){ if(d[(y*c.width+x)*4+3]>40){ img.__oben=y/c.height; return img.__oben; } } } img.__oben=0; return 0; };
  f.zeige('idle',{still:true}); await new Promise(r=>setTimeout(r,300));
  f.nummer(name); const min=[]; const t0=performance.now();
  while (performance.now()-t0 < ms) {
    await new Promise(r=>setTimeout(r,40));
    const bl=w.querySelector('.hf__blase'); if(!bl.classList.contains('hf__blase--an')) continue;
    const img=[...w.querySelectorAll('.hf__bild')].find(i=>getComputedStyle(i).opacity!=='0' && i.dataset.zustand && i.dataset.zustand.startsWith('nummer_')) ; if(!img) continue;
    const r=img.getBoundingClientRect(); const oben=r.top + obenAnteil(img)*r.height;
    const b=bl.getBoundingClientRect(); const spitze=b.bottom+9;
    // nur zählen, wenn Blase und Figur sich waagerecht überdecken
    if (b.right < r.left || b.left > r.right) continue;
    min.push(Math.round(oben - spitze));
  }
  return {min: min.length?Math.min(...min):null, erst: min[0], n: min.length};
}"""
with sync_playwright() as pw:
    b=pw.chromium.launch(); h=b.new_page(viewport={'width':VW,'height':VH})
    h.goto(f'http://127.0.0.1:{PORT}/hamster_figur/_PRUEF_hamster_figur_schoner.html'); h.wait_for_load_state('load'); h.wait_for_timeout(3500)
    F="BOS_CRUMBLE_HOST.figur()"
    h.evaluate(F+".manifest().schreibtisch.sichtkontakt={erste_nummer_s:[900,900],nummer_s:[900,900],lauf_s:[900,900],phase_s:900,nachhol_s:[900,900]}; "+F+".an(true); "+F+".sichtbar(true)")
    h.wait_for_timeout(500)
    for name in man['nummern']:
        E[name]=h.evaluate(JS,[name,3500]); h.wait_for_timeout(300)
    # Grundzustände mit Text (Tipp-Reaktionen)
    b.close()
srv.shutdown()
print(json.dumps(E,ensure_ascii=False))
