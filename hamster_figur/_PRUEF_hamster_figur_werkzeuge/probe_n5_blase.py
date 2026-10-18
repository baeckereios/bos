"""probe_n5_blase.py — Bau-Chat Crumble, Nachtrag 5 (18.10.2026): Blase liegt nicht mehr auf der Figur (K44 Luft, K45 Mitgehen, K46 durchlaessig).
Messmethode wie probe_kc_blase_abstand.py (Kontroll-Chat): Abstand Blasenspitze <-> oberste deckende Bildzeile (Alpha > 40) alle 40 ms
ueber die stehende Blase; negativ = Blase auf der Figur. Spitze streng = Blasenkasten + 12 px (die um 45 Grad gedrehte 14-px-Spitze reicht
12 px unter den Kasten); KC-Mass (+9) wird mitgefuehrt.
Aufruf: python3 -I probe_n5_blase.py <bos> [--geliefertn4 <bos der Lieferung Nachtrag 4, 13:49>]
Faelle je Groesse 800x1280, 1280x800, 420x860 (Huelle _PRUEF_hamster_figur_schoner.html, Schreibtisch-Figur):
  n5-1 alle 16 Nummern: kleinster Abstand >= 10 px (streng), Blase nie ausserhalb des Bildschirms, danach _timerAktiv() wie vorher, kein rAF
  n5-2 Tipp-Reaktionen happy, thinking, shrug, wave, laughing, tongue, surprised: dasselbe
  n5-3 (800x1280) K46: Punkt in der sichtbaren Blase trifft nicht die Figur/Blase (elementFromPoint), click dort loest keinen Tipp aus
  Gegenprobe --geliefertn4: torte_gesicht, bowling, teigmonster muessen dort rot sein (Abstand < 10).
Ergebnis: JSON (stdout + probe_n5_ergebnis.json daneben).
"""
import sys, os, json, threading, http.server, socketserver, functools, shutil, tempfile
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
bos = os.path.abspath(args[0])
geliefertn4 = os.path.abspath(args[args.index('--geliefertn4') + 1]) if '--geliefertn4' in args else None
hier = os.path.dirname(os.path.abspath(__file__))
GROESSEN = [(800, 1280), (1280, 800), (420, 860)]
REAKTIONEN = ['happy', 'thinking', 'shrug', 'wave', 'laughing', 'tongue', 'surprised']
MINDEST = 10

def server(ordner, port):
    Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ordner)
    class Q(socketserver.TCPServer): allow_reuse_address = True
    http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
    srv = Q(('127.0.0.1', port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv

# Messschleife im Browser: [art, name, ms] -> {min_streng, min_kc, erst, n, aus_bild, oben_rand}
JS = """async ([art, name, ms]) => {
  const f=BOS_CRUMBLE_HOST.figur(); const w=f.wurzel();
  const obenAnteil = (img) => { if (img.__oben!==undefined) return img.__oben; const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
     const g=c.getContext('2d'); g.drawImage(img,0,0); const d=g.getImageData(0,0,c.width,c.height).data;
     for (let y=0;y<c.height;y++){ for(let x=0;x<c.width;x++){ if(d[(y*c.width+x)*4+3]>40){ img.__oben=y/c.height; return img.__oben; } } } img.__oben=0; return 0; };
  f.zeige('idle',{still:true}); await new Promise(r=>setTimeout(r,250));
  const timerVor = f._timerAktiv();
  if (art === 'nummer') f.nummer(name); else f.zeige(name);
  const streng=[], kc=[]; let aus=0, obenRand=0, n=0; const t0=performance.now();
  while (performance.now()-t0 < ms) {
    await new Promise(r=>setTimeout(r,40));
    const bl=w.querySelector('.hf__blase'); if(!bl.classList.contains('hf__blase--an')) continue;
    const z=f.zustand(); const img=w.querySelector('.hf__bild[data-zustand="'+z+'"]'); if(!img || !img.naturalWidth) continue;
    const r=img.getBoundingClientRect(); const oben=r.top + obenAnteil(img)*r.height;
    const b=bl.getBoundingClientRect(); n++;
    if (b.left < 0 || b.right > innerWidth || b.top < 0 || b.bottom + 12 > innerHeight) aus++;
    if (b.top < 8) obenRand++;
    if (b.right < r.left || b.left > r.right) continue;
    streng.push(Math.round(oben - (b.bottom + 12))); kc.push(Math.round(oben - (b.bottom + 9)));
  }
  // Blase ablaufen lassen, dann Zaehler
  f.zeige('idle',{still:true}); f.sage('');
  await new Promise(r=>setTimeout(r,80));
  return {min_streng: streng.length?Math.min(...streng):null, min_kc: kc.length?Math.min(...kc):null, erst: streng[0], n, aus_bild: aus, oben_rand: obenRand,
          timer_vor: timerVor, timer_nach: f._timerAktiv(), raf_nach: f._blaseFolgt ? f._blaseFolgt() : null};
}"""

def messe(basis_url, port_hint, mit_k46):
    man = json.load(open(os.path.join(bos, 'hamster_figur', 'hamster_figur_manifest.json'), encoding='utf-8'))
    R = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for (VW, VH) in GROESSEN:
            h = b.new_page(viewport={'width': VW, 'height': VH}); kons = []
            h.on('pageerror', lambda e: kons.append(('pageerror', str(e)))); h.on('console', lambda m: kons.append((m.type, m.text)) if m.type == 'error' else None)
            h.add_init_script("window.__tipps=0; document.addEventListener('hamster-figur:tipp', e => { if (e.detail.instanz==='lehrmeister') window.__tipps++; });")
            h.goto(basis_url + '_PRUEF_hamster_figur_schoner.html'); h.wait_for_load_state('load'); h.wait_for_timeout(3000)
            F = "BOS_CRUMBLE_HOST.figur()"
            h.wait_for_function(f"{F}.zustand() === 'idle'", timeout=12000)
            h.evaluate(f"{F}.manifest().schreibtisch.sichtkontakt = {{erste_nummer_s:[900,900], nummer_s:[900,900], lauf_s:[900,900], phase_s:900, nachhol_s:[900,900]}}; {F}.manifest().schreibtisch.schlaf_nach_ms = 9999999; {F}.manifest().verhalten.nummer_dauer_ms = 4500; {F}.an(true); {F}.sichtbar(true)")
            h.wait_for_timeout(8500)   # Vorladen der 16 Nummern-Bilder (1,5 s + 16 x 0,4 s) abwarten, sonst wandert der Timer-Zaehler waehrend des ersten Falls
            G = {'nummern': {}, 'reaktionen': {}}
            for name in man['nummern']:
                G['nummern'][name] = h.evaluate(JS, ['nummer', name, 3300]); h.wait_for_timeout(150)
            for name in REAKTIONEN:
                G['reaktionen'][name] = h.evaluate(JS, ['zeige', name, 1400]); h.wait_for_timeout(150)
            alle = list(G['nummern'].values()) + list(G['reaktionen'].values())
            G['kleinster_abstand_streng'] = min(v['min_streng'] for v in alle if v['min_streng'] is not None)
            G['kleinster_abstand_kc'] = min(v['min_kc'] for v in alle if v['min_kc'] is not None)
            G['unter_mindest'] = sorted([k for k, v in list(G['nummern'].items()) + list(G['reaktionen'].items()) if v['min_streng'] is None or v['min_streng'] < MINDEST])
            G['ohne_messung'] = sorted([k for k, v in list(G['nummern'].items()) + list(G['reaktionen'].items()) if v['min_streng'] is None])
            G['aus_bild_gesamt'] = sum(v['aus_bild'] for v in alle)
            G['oben_am_rand_frames'] = sum(v['oben_rand'] for v in alle)
            G['timer_gleich_danach'] = all(v['timer_nach'] == v['timer_vor'] for v in alle)
            G['raf_uebrig'] = any(v['raf_nach'] for v in alle)
            if mit_k46 and (VW, VH) == (800, 1280):
                h.evaluate(f"{F}.manifest().verhalten.nummer_dauer_ms = 6000; {F}.nummer('torte_gesicht')"); h.wait_for_timeout(1200)
                k = h.evaluate(f"""(() => {{ const bl={F}.wurzel().querySelector('.hf__blase'); const r=bl.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
                    const el=document.elementFromPoint(x, y); window.__tipps=0; return {{an: bl.classList.contains('hf__blase--an'), x: Math.round(x), y: Math.round(y), trifft: el ? (el.className && el.className.toString().slice(0,40) || el.tagName) : null, in_hf: !!(el && el.closest && el.closest('.hf')), pe: getComputedStyle(bl).pointerEvents}}; }})()""")
                h.mouse.click(k['x'], k['y']); h.wait_for_timeout(200)
                k['tipps_nach_click'] = h.evaluate("window.__tipps"); k['zustand_nach_click'] = h.evaluate(f"{F}.zustand()")
                # Gegenstueck: Tipp auf den Koerper (Mitte des Koerperkastens) trifft Crumble weiterhin
                kk = h.evaluate(f"(() => {{ const r={F}.wurzel().querySelector('.hf__figur').getBoundingClientRect(); return [Math.round(r.left+r.width/2), Math.round(r.top+r.height*0.6)]; }})()")
                k['koerper_trifft'] = h.evaluate(f"(() => {{ const el=document.elementFromPoint({kk[0]}, {kk[1]}); return !!(el && el.closest('.hf__figur')); }})()")
                h.evaluate(f"{F}.zeige('idle',{{still:true}}); {F}.sage('')")
                G['k46'] = dict(k, bestanden=(k['an'] and not k['in_hf'] and k['pe'] == 'none' and k['tipps_nach_click'] == 0 and k['zustand_nach_click'].startswith('nummer_') and k['koerper_trifft']))
            G['konsole'] = kons
            G['bestanden'] = (not G['unter_mindest'] and not G['ohne_messung'] and G['aus_bild_gesamt'] == 0 and G['timer_gleich_danach'] and not G['raf_uebrig']
                              and not kons and (G.get('k46', {'bestanden': True})['bestanden']))
            R[f'{VW}x{VH}'] = G
            h.close()
        b.close()
    return R

E = {}
PORT = 8830
srv = server(bos, PORT)
E['neu'] = messe(f'http://127.0.0.1:{PORT}/hamster_figur/', PORT, True)
srv.shutdown()
if geliefertn4:
    tmp = tempfile.mkdtemp(prefix='crumble_n4_')
    shutil.copy(os.path.join(bos, 'bos_design_tokens.css'), tmp)
    shutil.copytree(os.path.join(geliefertn4, 'hamster_figur'), os.path.join(tmp, 'hamster_figur'), ignore=shutil.ignore_patterns('_PRUEF_hamster_figur_werkzeuge', 'nummern', 'bilder'))
    shutil.copytree(os.path.join(bos, 'hamster_figur', 'bilder'), os.path.join(tmp, 'hamster_figur', 'bilder'))
    shutil.copytree(os.path.join(bos, 'hamster_figur', 'nummern'), os.path.join(tmp, 'hamster_figur', 'nummern'))
    for name in ['bos_screensaver.js', 'bos_screensaver_content.js', 'bos_crumble_host.js']:
        src = os.path.join(geliefertn4, name) if os.path.exists(os.path.join(geliefertn4, name)) else os.path.join(bos, name)
        shutil.copy(src, tmp)
    shutil.copy(os.path.join(bos, 'hamster_figur', '_PRUEF_hamster_figur_schoner.html'), os.path.join(tmp, 'hamster_figur'))
    srv2 = server(tmp, PORT + 1)
    G = messe(f'http://127.0.0.1:{PORT + 1}/hamster_figur/', PORT + 1, False)
    srv2.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
    E['gegenprobe_n4'] = {g: {'unter_mindest': v['unter_mindest'], 'kleinster_abstand_streng': v['kleinster_abstand_streng'], 'kleinster_abstand_kc': v['kleinster_abstand_kc'],
                              'torte_bowling_teigmonster_rot': all(v['nummern'][n]['min_streng'] is not None and v['nummern'][n]['min_streng'] < MINDEST for n in ('torte_gesicht', 'bowling', 'teigmonster')),
                              'rot_wie_erwartet': not v['bestanden']} for g, v in G.items()}
    E['gegenprobe_n4']['alle_rot'] = all(v['rot_wie_erwartet'] and v['torte_bowling_teigmonster_rot'] for v in E['gegenprobe_n4'].values() if isinstance(v, dict))
E['zusammenfassung'] = {g: v['bestanden'] for g, v in E['neu'].items()}
if geliefertn4: E['zusammenfassung']['gegenprobe_n4_rot'] = E['gegenprobe_n4']['alle_rot']
json.dump(E, open(os.path.join(hier, 'probe_n5_ergebnis.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(json.dumps(E['zusammenfassung'], ensure_ascii=False))
for g, v in E['neu'].items():
    print(g, 'min streng', v['kleinster_abstand_streng'], 'min kc', v['kleinster_abstand_kc'], 'unter', v['unter_mindest'], 'aus_bild', v['aus_bild_gesamt'], 'rand', v['oben_am_rand_frames'], 'timer', v['timer_gleich_danach'], 'raf', v['raf_uebrig'], 'k46', v.get('k46', {}).get('bestanden'), 'konsole', v['konsole'])
if geliefertn4:
    for g, v in E['gegenprobe_n4'].items():
        if isinstance(v, dict): print('GEGEN', g, v)
