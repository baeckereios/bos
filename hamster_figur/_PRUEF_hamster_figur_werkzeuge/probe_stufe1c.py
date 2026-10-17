"""probe_stufe1c.py — Funktionsprobe Crumble Stufe 1c (Bau-Chat, 17.10.2026, 09:37) — enthaelt probe_stufe1.py (Faelle 1-17) plus 1c-1..1c-8.
Faehrt die Faelle 1-11 und 13 der Anweisung ANWEISUNG_2026-10-17_HAMSTER_STUFE1.md §6 headless in Chromium:
  Seite A  hamster_figur/_PRUEF_hamster_figur_vorschau.html   (Faelle 1-5, 9, Rollen, Zahl-Texte, Blase im Bild)
  Seite B  hamster_figur/_PRUEF_hamster_figur_schoner.html    (Faelle 6, 7, 8, 10, 11 und F1 aus dem Bauplan)
  Gegenprobe (Fall 13): Faelle 1-3 gegen die ALTE hamster_figur.js — muessen dort rot sein.
Legt fehlende Bilder als Platzhalter an (die echten liegen im Bilder-Archiv), startet einen http-Server im bos-Ordner.
Ergebnis als JSON (stdout und probe_ergebnis.json daneben), Bildschirmfotos daneben (bild_*.png).

Aufruf:  python3 -I probe_stufe1c.py <pfad zu bos> [--alt <bos aus Paket 0607>] [--geliefert <bos der Lieferung 06:50>] [--stufe1 <bos der Lieferung Nachtrag 1, 08:09>]
Stufe 1c (Anweisung 09:00 §6): 1c-1 Blase, 1c-2 Ebene, 1c-3 Knopf (+ Timer-Zaehler), 1c-4 Schieben, 1c-5 Laufen, 1c-6 Nummern (+ Ebene nach Abbruch),
1c-7 Schlaf, 1c-8 Spielplatz; Gegenprobe --stufe1: 1c-1..1c-4 muessen gegen die Stufe-1-Dateien rot sein.
Nachtrag 2 (10:05, Anweisung 09:52): 1c-9 Nummer mit fehlendem Bild -> sofort beendet, idle; Gegenprobe --geliefert1c <bos der Lieferung 09:39> muss rot sein.
Nachtrag 1 (17.10., 08:09): Faelle 14-16 (Einschlafen trotz Inhalt, Tipp waehrend draussen, Profilwechsel) und Fall 17
(Gegenprobe gegen die GELIEFERTE Fassung von 06:50 — dort muessen 14-16 rot sein).
Braucht: playwright (chromium), Pillow.   Jede Zahl steht mit ihrem Fall in der Session-Doku.
"""
import sys, os, json, threading, http.server, socketserver, functools, shutil, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
bos = os.path.abspath(args[0])
alt = None
if '--alt' in args: alt = os.path.abspath(args[args.index('--alt') + 1])
geliefert = None
if '--geliefert' in args: geliefert = os.path.abspath(args[args.index('--geliefert') + 1])
stufe1 = None
if '--stufe1' in args: stufe1 = os.path.abspath(args[args.index('--stufe1') + 1])
geliefert1c = None   # Nachtrag 2: Gegenprobe Fall 1c-9 gegen die Lieferung 1c von 09:39
if '--geliefert1c' in args: geliefert1c = os.path.abspath(args[args.index('--geliefert1c') + 1])
hier = os.path.dirname(os.path.abspath(__file__))

def platzhalter(bos_ordner):
    hf = os.path.join(bos_ordner, 'hamster_figur'); bilder = os.path.join(hf, 'bilder'); os.makedirs(bilder, exist_ok=True)
    m = json.load(open(os.path.join(hf, 'hamster_figur_manifest.json'), encoding='utf-8'))
    namen = [z['datei'] for z in m['zustaende'].values()] + [g['datei'] for g in m['ausruestung']['gegenstaende'].values()]
    n = 0
    for d in namen:
        p = os.path.join(bilder, d)
        if not os.path.exists(p): Image.new('RGBA', (480, 480), (232, 184, 109, 255)).save(p); n += 1
    return n, len(namen)

def server(ordner, port):
    Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ordner)
    class Q(socketserver.TCPServer): allow_reuse_address = True
    srv = Q(('127.0.0.1', port), Handler); srv.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv

E = {}
E['platzhalter'] = platzhalter(bos)
PORT = 8766
srv = server(bos, PORT)
U = f'http://127.0.0.1:{PORT}/hamster_figur/'

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ================================================================ Seite A: Pruefseite
    pg = b.new_page(viewport={'width': 1100, 'height': 900})
    konsole = []; pg.on('console', lambda m: konsole.append((m.type, m.text))); pg.on('pageerror', lambda e: konsole.append(('pageerror', str(e))))
    http_fehler = []; pg.on('response', lambda r: http_fehler.append(r.url.split(str(PORT))[-1]) if r.status >= 400 else None)
    pg.goto(U + '_PRUEF_hamster_figur_vorschau.html')
    pg.wait_for_function("window.K && window.S && window.D && document.querySelectorAll('.hf').length===4 && K.manifest() && S.manifest() && D.manifest() && BOS_HAMSTER_FIGUR.manifest()")
    pg.wait_for_timeout(700)
    E['A_start'] = pg.evaluate("({wurzeln: document.querySelectorAll('.hf').length, oben: document.querySelectorAll('.hf--oben').length, container: document.querySelectorAll('.hf--container').length, schreibtisch: document.querySelectorAll('.hf--schreibtisch').length, fest: document.querySelectorAll('.hf--fest').length, knopfImTopbar: !!document.querySelector('#topbar > .hf--oben'), knopfVorUhr: document.querySelector('#topbar > .hf--oben').nextElementSibling.id})")

    # Fall 1: Knopf, Hinweis, Tipp -> hervor nach 1 s false
    pg.evaluate("K.hinweis('Probe')"); pg.wait_for_timeout(200)
    f1a = pg.evaluate("({hervor: K.wurzel().classList.contains('hf--hervor'), hinweis: K.wurzel().classList.contains('hf--hinweis'), zustand: K.zustand()})")
    pg.evaluate("K.wurzel().querySelector('.hf__figur').click()"); pg.wait_for_timeout(1000)
    f1b = pg.evaluate("({hervor: K.wurzel().classList.contains('hf--hervor'), hinweis: K.wurzel().classList.contains('hf--hinweis'), zustand: K.zustand()})")
    E['fall1_knopf_hinweis_tipp'] = {'nach_hinweis': f1a, 'nach_tipp_1s': f1b, 'bestanden': f1a['hervor'] is True and f1b['hervor'] is False}

    # Fall 3: ereignis('hinweis') -> hf--hinweis true (ein Pfad)
    pg.evaluate("K.ereignis('hinweis')"); pg.wait_for_timeout(200)
    f3 = pg.evaluate("({hinweis: K.wurzel().classList.contains('hf--hinweis'), hervor: K.wurzel().classList.contains('hf--hervor'), zustand: K.zustand(), blase: K.wurzel().querySelector('.hf__blase').textContent})")
    pg.evaluate("K.wurzel().querySelector('.hf__blase').click()"); pg.wait_for_timeout(1000)
    f3b = pg.evaluate("({hinweis: K.wurzel().classList.contains('hf--hinweis'), hervor: K.wurzel().classList.contains('hf--hervor')})")
    E['fall3_ereignis_hinweis'] = {'nach_ereignis': f3, 'nach_tipp_auf_blase_1s': f3b, 'bestanden': f3['hinweis'] is True and f3b['hervor'] is False and f3b['hinweis'] is False}

    # Fall 2: registriere.zustand nach init -> hf--aus false, Ereignis wirkt
    pg.evaluate("K.registriere.zustand('probe_neu', {datei:'idle.png', gruppe:'stand', kategorie:'geste', koerper:[0,0,1,1], texte:['Probe']})"); pg.wait_for_timeout(300)
    f2 = pg.evaluate("({aus: K.wurzel().classList.contains('hf--aus'), wurzeln: document.querySelectorAll('.hf').length, bilderK: K.wurzel().querySelectorAll('.hf__bild').length, bilderS: S.wurzel().querySelectorAll('.hf__bild').length, neuInS: !!S.manifest().zustaende.probe_neu})")
    pg.evaluate("K.ereignis('app_geoeffnet')"); z2 = pg.evaluate("K.zustand()")
    pg.evaluate("K.zeige('probe_neu',{still:true})"); z2b = pg.evaluate("[...K.wurzel().querySelectorAll('.hf__bild--an')].map(i=>i.dataset.zustand)")
    E['fall2_registriere_nach_init'] = {'nachher': f2, 'ereignis_danach': z2, 'neuer_zustand_sichtbar': z2b, 'bestanden': f2['aus'] is False and z2 == 'wave' and z2b == ['probe_neu'] and f2['bilderK'] == 31 and f2['bilderS'] >= 30 and f2['neuInS'] is False}
    pg.evaluate("K.an(true)")

    # Fall 4: init() zweimal -> genau eine feste Wurzel, Warnung
    pg.evaluate("BOS_HAMSTER_FIGUR.init({basisPfad:'./'})"); pg.wait_for_timeout(500)
    f4 = pg.evaluate("({fest: document.querySelectorAll('.hf--fest').length, alle: document.querySelectorAll('.hf').length})")
    f4w = [t for t in konsole if 'init() doppelt' in t[1]]
    E['fall4_init_doppelt'] = {'wurzeln_fest': f4['fest'], 'wurzeln_alle': f4['alle'], 'warnung': len(f4w), 'bestanden': f4['fest'] == 1 and len(f4w) == 1}

    # Fall 5: zwei Instanzen unabhaengig
    pg.evaluate("K.an(true); S.an(true)"); pg.wait_for_timeout(200)
    pg.evaluate("K.ereignis('viel_offen')"); pg.wait_for_timeout(100)
    f5a = pg.evaluate("({K: K.zustand(), S: S.zustand()})")
    pg.evaluate("K.an(false)"); pg.wait_for_timeout(100)
    pg.evaluate("S.ereignis('erfolg')"); pg.wait_for_timeout(100)
    f5b = pg.evaluate("({Kaus: K.wurzel().classList.contains('hf--aus'), Saus: S.wurzel().classList.contains('hf--aus'), S: S.zustand(), Kan: K.istAn(), San: S.istAn()})")
    pg.evaluate("K.an(true)")
    E['fall5_zwei_instanzen'] = {'ereignis_an_K': f5a, 'K_aus_S_laeuft': f5b, 'bestanden': f5a == {'K': 'sweating', 'S': 'idle'} and f5b['Kaus'] is True and f5b['Saus'] is False and f5b['S'] == 'laughing'}

    # Rollen: S spricht texte_spielplatz, K spricht texte; Zahl-Texte
    pg.evaluate("S.zeige('idle'); K.ereignis('app_geoeffnet',{n:3})"); pg.wait_for_timeout(150)
    rollen = pg.evaluate("""() => { const m=S.manifest(); const sT=S.wurzel().querySelector('.hf__blase').textContent, kT=K.wurzel().querySelector('.hf__blase').textContent;
      return {S_text: sT, S_aus_spielplatz: m.zustaende.idle.texte_spielplatz.includes(sT), K_text: kT, K_hat_3: /3/.test(kT) && !/\\{n\\}/.test(kT)}; }""")
    pg.evaluate("K.ereignis('app_geoeffnet',{n:1})"); pg.wait_for_timeout(100); t1 = pg.evaluate("K.wurzel().querySelector('.hf__blase').textContent")
    pg.evaluate("K.ereignis('app_geoeffnet',{n:0})"); pg.wait_for_timeout(100); t0 = pg.evaluate("K.wurzel().querySelector('.hf__blase').textContent")
    pg.evaluate("S.setzeRolle('lehrmeister'); S.zeige('idle')"); pg.wait_for_timeout(100)
    lehr = pg.evaluate("S.manifest().zustaende.idle.texte.includes(S.wurzel().querySelector('.hf__blase').textContent)")
    pg.evaluate("S.setzeRolle('spielplatz')")
    E['rollen_und_zahl'] = {'spielplatz': rollen, 'n1': t1, 'n0': t0, 'S_als_lehrmeister_spricht_texte': lehr, 'bestanden': rollen['S_aus_spielplatz'] and rollen['K_hat_3'] and 'Eine Aufgabe' in t1 and 'Nichts offen' in t0 or 'leer' in t0}

    # Listen-Ereignis: schoner_backstube trifft eins der vier Ziele (20 Versuche, nicht beilaeufig)
    treffer = pg.evaluate("""() => { const out=new Set(); for (let i=0;i<20;i++){ S.ereignis('schoner_backstube'); out.add(S.zustand()); } return [...out]; }""")
    E['listen_ereignis_schoner_backstube'] = {'getroffene_ziele': treffer, 'bestanden': set(treffer) <= {'bread_peel', 'flour_sack', 'apron', 'wheat'} and len(treffer) >= 2}

    # Beilaeufig: schlafend -> schlaeft durch
    pg.evaluate("S.zeige('sleep_sitting',{dauer:0}); S.ereignis('schoner_fakt',{beilaeufig:true})"); pg.wait_for_timeout(100)
    E['beilaeufig_schlaeft_durch'] = {'zustand': pg.evaluate("S.zustand()"), 'bestanden': pg.evaluate("S.zustand()") == 'sleep_sitting'}
    pg.evaluate("S.wurzel().querySelector('.hf__figur').click()"); pg.wait_for_timeout(100)
    E['tipp_weckt'] = {'zustand': pg.evaluate("S.zustand()"), 'bestanden': pg.evaluate("S.zustand()") == 'surprised'}

    # Fall 9: Bild fehlt -> fehler sichtbar im Log (rot)
    pg.evaluate("K.registriere.zustand('kaputt', {datei:'gibt_es_nicht.png', gruppe:'stand', kategorie:'geste', koerper:[0,0,1,1]})"); pg.wait_for_timeout(900)
    f9 = pg.evaluate("({rot: [...document.querySelectorAll('#log .fehler')].map(e=>e.textContent).filter(t=>t.includes('gibt_es_nicht')).length, farbe: getComputedStyle(document.querySelector('#log .fehler')||document.body).color})")
    E['fall9_bild_fehlt'] = {'rote_zeilen_mit_dateiname': f9['rot'], 'farbe': f9['farbe'], 'warnung_konsole': len([t for t in konsole if 'Bild fehlt: gibt_es_nicht.png' in t[1]]), 'bestanden': f9['rot'] >= 1}

    # Bildschirmfotos: dunkel, hell (beide Figuren drauf: K hervor, S mit Blase)
    pg.evaluate("K.an(true); S.an(true); K.ereignis('app_geoeffnet',{n:3}); S.ereignis('schoner_konditorei')"); pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(hier, 'bild_pruefseite_dunkel.png'), full_page=False)
    pg.evaluate("hellDunkel(); K.ereignis('app_geoeffnet',{n:3}); S.ereignis('schoner_verkauf')"); pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(hier, 'bild_pruefseite_hell.png'), full_page=False)
    pg.evaluate("hellDunkel()")

    # Blase im Bild (K6): schmaler Viewport, Spielplatz-Blase darf nicht links hinaus
    pg.set_viewport_size({'width': 420, 'height': 800}); pg.wait_for_timeout(200)
    pg.evaluate("S.sage('Fünfundzwanzig Kilo. Ich wiege dreißig Gramm. Läuft. Und das ist ein sehr langer Satz für eine Blase.', 0)"); pg.wait_for_timeout(100)
    bl = pg.evaluate("(() => { const r=S.wurzel().querySelector('.hf__blase').getBoundingClientRect(); return {left: Math.round(r.left), right: Math.round(r.right), breite: innerWidth}; })()")
    pg.evaluate("K.hinweis('Knopf-Blase bei schmalem Bildschirm, auch lang genug um zu testen.')"); pg.wait_for_timeout(100)
    bk = pg.evaluate("(() => { const r=K.wurzel().querySelector('.hf__blase').getBoundingClientRect(); return {left: Math.round(r.left), right: Math.round(r.right), breite: innerWidth}; })()")
    E['blase_im_bild_420px'] = {'spielplatz': bl, 'knopf': bk, 'bestanden': bl['left'] >= 8 and bl['right'] <= 412 and bk['left'] >= 8 and bk['right'] <= 412}
    pg.screenshot(path=os.path.join(hier, 'bild_pruefseite_schmal_420.png'))
    E['A_http_fehler'] = {'urls': sorted(set(http_fehler)), 'nur_absichtlich': set(http_fehler) <= {'/hamster_figur/bilder/gibt_es_nicht.png'}}
    E['A_konsole_fehler'] = [t for t in konsole if t[0] == 'pageerror' or (t[0] == 'error' and '404' not in t[1])]   # der 404 ist gibt_es_nicht.png (Fall 9), steht in A_http_fehler
    E['A_konsole_warnungen'] = [t for t in konsole if t[0] == 'warning' and 'gibt_es_nicht' not in t[1] and 'init() doppelt' not in t[1]]

    # ================================================================ Seite B: Huelle (Schoner + Host)
    def huelle(query=''):
        p = b.new_page(viewport={'width': 1100, 'height': 800})
        k = []; p.on('console', lambda m: k.append((m.type, m.text))); p.on('pageerror', lambda e: k.append(('pageerror', str(e))))
        p.add_init_script("window.__er=[]; document.addEventListener('hamster-figur:ereignis', e => window.__er.push(e.detail));")
        p.goto(U + '_PRUEF_hamster_figur_schoner.html' + query)
        p.wait_for_load_state('load'); p.wait_for_timeout(400)
        return p, k

    # Fall 10 (Aufgaben-Regeln) + Begruessung
    p, k = huelle()
    p.wait_for_function("BOS_CRUMBLE_HOST.knopf() && BOS_CRUMBLE_HOST.knopf().manifest()")
    p.evaluate("feuer({offen:0, vorher:null, fehler:null})"); p.wait_for_timeout(300)
    er1 = p.evaluate("window.__er.map(e=>e.ereignis)")
    gruss0 = p.evaluate("BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__blase').textContent")
    p.evaluate("feuer({offen:0, vorher:2, fehler:null})"); p.wait_for_timeout(200)
    er2 = p.evaluate("window.__er.map(e=>e.ereignis)")
    p.evaluate("feuer({offen:7, vorher:0, fehler:null}); feuer({offen:7, vorher:7, fehler:null})"); p.wait_for_timeout(7200)   # viel_offen kommt nach der Begruessung (<= 6,5 s)
    er3 = p.evaluate("window.__er.map(e=>e.ereignis)")
    schwitz = p.evaluate("BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__blase').textContent")
    p.evaluate("feuer({offen:9, vorher:7, fehler:'permission-denied — Probe'})"); p.wait_for_timeout(300)
    er4 = p.evaluate("window.__er.map(e=>e.ereignis)")
    p.evaluate("feuer({offen:2, vorher:9, fehler:null}); feuer({offen:8, vorher:2, fehler:null})"); p.wait_for_timeout(300)
    er5 = p.evaluate("window.__er.map(e=>e.ereignis)")
    E['fall10_aufgaben'] = {
        'nach_offen0_vorher_null': er1, 'begruessung_text': gruss0,
        'nach_offen0_vorher2': er2,
        'nach_offen7_zweimal': er3, 'schwitz_text': schwitz,
        'nach_fehler': er4, 'nach_unter_und_wieder_ueber_schwelle': er5,
        'bestanden': er1 == ['app_geoeffnet'] and er2 == ['app_geoeffnet', 'alles_erledigt'] and er3.count('viel_offen') == 1 and er4 == er3 and er5.count('viel_offen') == 2 and ('Nichts offen' in gruss0 or 'leer' in gruss0)
    }
    # Begruessung ohne Zahl, wenn bos:aufgaben nicht kommt (2,5 s) — neue Seite
    p2, k2 = huelle()
    p2.wait_for_timeout(3200)
    E['begruessung_ohne_zahl'] = {'ereignisse': p2.evaluate("window.__er.map(e=>e.ereignis)"), 'text': p2.evaluate("BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__blase').textContent || '(Blase schon zu)'")}
    p2.evaluate("feuer({offen:3, vorher:null, fehler:null})"); p2.wait_for_timeout(300)
    E['begruessung_ohne_zahl']['nach_spaetem_bos_aufgaben'] = p2.evaluate("window.__er.map(e=>e.ereignis)")
    E['begruessung_ohne_zahl']['bestanden'] = E['begruessung_ohne_zahl']['ereignisse'] == ['app_geoeffnet'] and E['begruessung_ohne_zahl']['nach_spaetem_bos_aufgaben'] == ['app_geoeffnet']
    p2.close()

    # Fall 6 + 11 + F1: Schoner mit Figur
    p.evaluate("BOS_SCREENSAVER._zeigeJetzt()"); p.wait_for_timeout(600)
    p.wait_for_function("BOS_SCREENSAVER._figur() && BOS_SCREENSAVER._figur().manifest() && BOS_SCREENSAVER._figur().wurzel()")
    p.wait_for_timeout(600)
    s0 = p.evaluate("""() => { const r=document.getElementById('bosScreensaver'); const f=BOS_SCREENSAVER._figur(); const w=f.wurzel();
      const fr=w.querySelector('.hf__figur').getBoundingClientRect(); const cx=fr.left+fr.width/2, cy=fr.top+fr.height*0.6;
      const oben=document.elementFromPoint(cx, cy); return {sichtbar: r.classList.contains('bosss--visible'), figurImRoot: r.contains(w), container: w.classList.contains('hf--container'),
        hint: r.querySelector('.bosss__hint').textContent, zustand: f.zustand(), obenIstFigur: !!(oben && oben.closest('.hf')), cx: Math.round(cx), cy: Math.round(cy)}; }""")
    p.screenshot(path=os.path.join(hier, 'bild_schoner_dunkel.png'))
    p.mouse.click(s0['cx'], s0['cy']); p.wait_for_timeout(300)
    s1 = p.evaluate("({sichtbar: document.getElementById('bosScreensaver').classList.contains('bosss--visible'), zustand: BOS_SCREENSAVER._figur().zustand()})")
    p.mouse.click(80, 400); p.wait_for_timeout(300)   # daneben
    s2 = p.evaluate("({sichtbar: document.getElementById('bosScreensaver').classList.contains('bosss--visible'), figurAn: BOS_SCREENSAVER._figur().istAn()})")
    E['fall6_11_schoner_tipp'] = {'offen': s0, 'nach_tipp_auf_crumble': s1, 'nach_tipp_daneben': s2,
        'bestanden': s0['sichtbar'] and s0['figurImRoot'] and s0['obenIstFigur'] and s0['hint'] == 'Neben Crumble tippen' and s1['sichtbar'] is True and s1['zustand'] != 'idle' and s2['sichtbar'] is False and s2['figurAn'] is False}
    # F1: Schoner zu, Tipp auf den Knopf-Crumble in der Kopfleiste zaehlt als Aktivitaet (Ruhe-Timer neu gestellt)
    a0 = p.evaluate("BOS_SCREENSAVER._letzteAktivitaet()"); p.wait_for_timeout(60)
    p.evaluate("BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__knopf').click()")
    kb = p.evaluate("(() => { const r=BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__knopf').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; })()")
    p.mouse.click(kb[0], kb[1]); p.wait_for_timeout(100)
    a1 = p.evaluate("BOS_SCREENSAVER._letzteAktivitaet()")
    E['F1_knopf_crumble_zaehlt_als_aktivitaet'] = {'vorher': a0, 'nachher': a1, 'schoner_sichtbar': p.evaluate("BOS_SCREENSAVER._sichtbar()"), 'bestanden': a1 > a0}
    # hell
    p.evaluate("document.documentElement.setAttribute('data-theme','light'); BOS_SCREENSAVER._zeigeJetzt()"); p.wait_for_timeout(900)
    p.evaluate("BOS_SCREENSAVER._figur().ereignis('schoner_fakt')"); p.wait_for_timeout(300)
    p.screenshot(path=os.path.join(hier, 'bild_schoner_hell.png'))
    E['B_konsole_fehler'] = [t for t in k if t[0] in ('error', 'pageerror')]
    p.close()

    # Fall 7: Schoner ohne Modul
    p7, k7 = huelle('?ohneModul=1')
    p7.evaluate("BOS_SCREENSAVER._zeigeJetzt()"); p7.wait_for_timeout(500)
    s7 = p7.evaluate("({sichtbar: document.getElementById('bosScreensaver').classList.contains('bosss--visible'), figuren: document.querySelectorAll('.hf').length, hint: document.querySelector('.bosss__hint').textContent, modul: !!window.BOS_HAMSTER_FIGUR})")
    p7.mouse.click(300, 400); p7.wait_for_timeout(300)
    s7b = p7.evaluate("document.getElementById('bosScreensaver').classList.contains('bosss--visible')")
    E['fall7_ohne_modul'] = {'offen': s7, 'nach_tipp_sichtbar': s7b, 'konsole_fehler': [t for t in k7 if t[0] in ('error', 'pageerror')], 'warnung_host': len([t for t in k7 if 'nicht geladen' in t[1]]),
        'bestanden': s7['sichtbar'] and s7['figuren'] == 0 and s7['hint'] == 'Tippen zum Fortfahren' and s7b is False and not [t for t in k7 if t[0] in ('error', 'pageerror')]}
    p7.close()

    # Fall 8: Profil hamster:false
    p8, k8 = huelle('?hamster=false')
    p8.wait_for_function("BOS_CRUMBLE_HOST.knopf() && BOS_CRUMBLE_HOST.knopf().wurzel()")
    p8.wait_for_timeout(300)
    s8 = p8.evaluate("({knopfAus: BOS_CRUMBLE_HOST.knopf().wurzel().classList.contains('hf--aus'), knopfSichtbar: BOS_CRUMBLE_HOST.knopf().wurzel().offsetParent !== null})")
    p8.evaluate("BOS_CRUMBLE_HOST.knopf().ereignis('viel_offen')"); z8 = p8.evaluate("BOS_CRUMBLE_HOST.knopf().zustand()")
    p8.evaluate("BOS_SCREENSAVER._zeigeJetzt()"); p8.wait_for_timeout(800)
    s8b = p8.evaluate("({sichtbar: document.getElementById('bosScreensaver').classList.contains('bosss--visible'), hint: document.querySelector('.bosss__hint').textContent, figurAus: !BOS_SCREENSAVER._figur() || !BOS_SCREENSAVER._figur().wurzel() || BOS_SCREENSAVER._figur().wurzel().classList.contains('hf--aus')})")
    p8.evaluate("BOS_CRUMBLE_HOST.setzeAn(true)"); p8.wait_for_timeout(300)
    s8c = p8.evaluate("({knopfAus: BOS_CRUMBLE_HOST.knopf().wurzel().classList.contains('hf--aus'), hint: document.querySelector('.bosss__hint').textContent, schonerFigurAus: BOS_SCREENSAVER._figur().wurzel().classList.contains('hf--aus')})")
    E['fall8_hamster_false'] = {'knopf': s8, 'ereignis_zustand': z8, 'schoner': s8b, 'nach_setzeAn_true': s8c,
        'bestanden': s8['knopfAus'] and s8['knopfSichtbar'] is False and z8 == 'idle' and s8b['sichtbar'] and s8b['hint'] == 'Tippen zum Fortfahren' and s8b['figurAus'] and s8c['knopfAus'] is False and s8c['hint'] == 'Neben Crumble tippen' and s8c['schonerFigurAus'] is False}
    p8.close()


    # ================================================================ Nachtrag 2: Fall 1c-9 — Nummer mit fehlendem Bild
    def fall_1c9(basis_url):
        q9 = b.new_page(viewport={'width': 1100, 'height': 900}); k9 = []; q9.on('console', lambda m: k9.append((m.type, m.text)))
        q9.goto(basis_url + '_PRUEF_hamster_figur_vorschau.html')
        q9.wait_for_function("window.D && D.manifest && D.manifest() && D.wurzel()"); q9.wait_for_timeout(600)
        q9.evaluate("D.registriere.nummer('kaputt', {bild: 'kaputt/gibt_es_nicht.png', groesse: [100, 100], koerper: [0, 0, 1, 1], requisiten: [], klein: [], massstab: 1, texte: ['?']})")
        r = q9.evaluate("D.nummer('kaputt')"); q9.wait_for_timeout(900)
        z = q9.evaluate("({zustand: D.zustand(), klasse: D.wurzel().classList.contains('hf--nummer'), laufend: D.laufendeNummer(), req: D.wurzel().querySelectorAll('.hf__req').length, bild_an: [...D.wurzel().querySelectorAll('.hf__bild--an')].map(i=>i.dataset.zustand)})")
        q9.wait_for_timeout(600)
        z2 = q9.evaluate("({zustand: D.zustand(), klasse: D.wurzel().classList.contains('hf--nummer')})")
        warn = [t for t in k9 if 'Bild fehlt' in t[1] and 'gibt_es_nicht' in t[1]]
        q9.close()
        return {'rueckgabe': r, 'nach_0_9s': z, 'nach_1_5s': z2, 'warnungen': len(warn),
                'bestanden': (r is False or z['laufend'] is None) and z['zustand'] == 'idle' and z['klasse'] is False and z['bild_an'] == ['idle'] and z['req'] == 0 and z2['zustand'] == 'idle' and len(warn) == 1}
    E['1c9_nummer_bild_fehlt'] = fall_1c9(U)
    if geliefert1c:
        tmp9 = tempfile.mkdtemp(prefix='crumble_1c_')
        shutil.copy(os.path.join(bos, 'bos_design_tokens.css'), tmp9)
        shutil.copytree(os.path.join(geliefert1c, 'hamster_figur'), os.path.join(tmp9, 'hamster_figur'), ignore=shutil.ignore_patterns('_PRUEF_hamster_figur_werkzeuge', 'nummern'))
        shutil.copytree(os.path.join(bos, 'hamster_figur', 'bilder'), os.path.join(tmp9, 'hamster_figur', 'bilder'))
        shutil.copytree(os.path.join(bos, 'hamster_figur', 'nummern'), os.path.join(tmp9, 'hamster_figur', 'nummern'))
        srv9 = server(tmp9, PORT + 4)
        G9 = fall_1c9(f'http://127.0.0.1:{PORT + 4}/hamster_figur/')
        E['gegenprobe_1c9_lieferung_0939'] = {'bestanden': G9['bestanden'], 'rot_wie_erwartet': not G9['bestanden'], 'kurz': {k: v for k, v in G9.items() if k != 'bestanden'}}
        srv9.shutdown(); shutil.rmtree(tmp9, ignore_errors=True)

    # ================================================================ Stufe 1c: Faelle 1c-1 .. 1c-8
    def faelle_1c(basis_url, foto_prefix):
        R = {}
        def sicher(name, fn):
            try: R[name] = fn()
            except Exception as ex: R[name] = {'fehler': str(ex)[:300], 'bestanden': False}
        # ---- Pruefseite: 1c-1 Blase, 1c-5 Laufen, 1c-6 Nummern, 1c-7 Schlaf
        q = b.new_page(viewport={'width': 1100, 'height': 900}); kq = []; q.on('console', lambda m: kq.append((m.type, m.text))); q.on('pageerror', lambda e: kq.append(('pageerror', str(e))))
        q.goto(basis_url + '_PRUEF_hamster_figur_vorschau.html')
        q.wait_for_function("window.D && D.manifest && D.manifest() && D.wurzel()"); q.wait_for_timeout(600)
        def f1():
            q.evaluate("document.documentElement.setAttribute('data-theme','light'); document.body.style.background='#16120e'; D.sage('Blase auf dunkler Tapete im hellen Modus', 0)"); q.wait_for_timeout(200)
            a = q.evaluate("(() => { const cs=getComputedStyle(D.wurzel().querySelector('.hf__blase')); return {bg: cs.backgroundColor, rand: cs.borderTopColor, randBreite: cs.borderTopWidth, farbe: cs.color}; })()")
            q.evaluate("document.documentElement.removeAttribute('data-theme'); document.body.style.background=''; D.sage('Blase im dunklen Modus', 0)"); q.wait_for_timeout(200)
            d = q.evaluate("getComputedStyle(D.wurzel().querySelector('.hf__blase')).backgroundColor")
            q.evaluate("D.manifest().verhalten.nummer_dauer_ms = 4000; D.nummer('teigmonster')"); q.wait_for_timeout(1500)
            q.evaluate("D.sage('Teig-Monster: Blase ueber dem Kopf?', 0)"); q.wait_for_timeout(250)
            tm = q.evaluate("(() => { const bl=D.wurzel().querySelector('.hf__blase').getBoundingClientRect(); const im=D.wurzel().querySelector('.hf__bild--an').getBoundingClientRect(); return {blase_bottom: Math.round(bl.bottom), bild_top: Math.round(im.top), zustand: D.zustand()}; })()")
            q.locator('#schreibtisch').screenshot(path=os.path.join(hier, foto_prefix + 'teigmonster_blase.png'))
            q.wait_for_timeout(3500)
            return {'hell_auf_dunkel': a, 'dunkel_bg': d, 'teigmonster': tm,
                    'bestanden': a['bg'] == 'rgb(251, 243, 228)' and a['rand'] == 'rgb(74, 47, 26)' and a['randBreite'] == '2px' and d == 'rgb(251, 243, 228)' and tm['zustand'] == 'nummer_teigmonster' and tm['blase_bottom'] <= tm['bild_top'] + 2}
        sicher('1c1_blase', f1)
        def f5():
            q.evaluate("D.an(true)"); q.wait_for_timeout(300)
            x0 = q.evaluate("D.x()")
            ok = q.evaluate("D.laufe(0.5)"); q.wait_for_timeout(300)
            w = q.evaluate("({laeuft: D.wurzel().classList.contains('hf--laeuft'), links: D.wurzel().classList.contains('hf--links'), api: D.laeuft()})")
            q.wait_for_function("!D.laeuft()", timeout=15000); q.wait_for_timeout(100)
            n = q.evaluate("({x: D.x(), laeuft: D.wurzel().classList.contains('hf--laeuft'), links_px: parseFloat(D.wurzel().style.left), breite: document.getElementById('schreibtisch').clientWidth})")
            q.evaluate("D.laufe(0.1)"); q.wait_for_timeout(400)
            l = q.evaluate("({links: D.wurzel().classList.contains('hf--links'), laeuft: D.laeuft(), x: D.x()})")
            q.evaluate("D.wurzel().querySelector('.hf__figur').click()"); q.wait_for_timeout(150)
            ab = q.evaluate("({laeuft: D.laeuft(), klasse: D.wurzel().classList.contains('hf--laeuft'), zustand: D.zustand()})")
            return {'start_x': x0, 'laufe_angenommen': ok, 'waehrend': w, 'angekommen': n, 'rueckweg_links': l, 'tipp_bricht_ab': ab,
                    'bestanden': ok is True and w['laeuft'] and w['links'] is False and n['laeuft'] is False and abs(n['x'] - 0.5) < 0.01 and 0 <= n['links_px'] <= n['breite'] and l['links'] is True and l['laeuft'] is True and ab['laeuft'] is False and ab['klasse'] is False and ab['zustand'] != 'idle'}
        sicher('1c5_laufen', f5)
        def f6():
            q.evaluate("D.an(true); D.manifest().verhalten.nummer_dauer_ms = 1600"); q.wait_for_timeout(300)
            liste = q.evaluate("D.nummern()")
            je = {}
            for n in liste:
                erw = q.evaluate(f"(D.manifest().nummern['{n}'].requisiten||[]).length + (D.manifest().nummern['{n}'].klein||[]).length")
                q.evaluate(f"D.nummer('{n}')")
                q.wait_for_function(f"D.zustand()==='nummer_{n}' && document.querySelectorAll('.hf--schreibtisch .hf__req').length>=0", timeout=8000); q.wait_for_timeout(700)
                m = q.evaluate("({zustand: D.zustand(), bild_an: [...D.wurzel().querySelectorAll('.hf__bild--an')].map(i=>i.dataset.zustand), req: D.wurzel().querySelectorAll('.hf__req').length, ebene: D.wurzel().querySelectorAll('.hf__req-ebene').length, fig_klasse: D.wurzel().querySelector('.hf__figur').className})")
                if n in ('jongleur', 'karate', 'teigmonster', 'bowling', 'froster'): q.locator('#schreibtisch').screenshot(path=os.path.join(hier, foto_prefix + 'nummer_' + n + '.png'))
                q.wait_for_function("D.zustand()==='idle'", timeout=8000); q.wait_for_timeout(200)
                e = q.evaluate("({zustand: D.zustand(), req: D.wurzel().querySelectorAll('.hf__req').length, ebene: D.wurzel().querySelectorAll('.hf__req-ebene').length, fig_klasse: D.wurzel().querySelector('.hf__figur').className})")
                je[n] = {'erwartet_req': erw, 'waehrend': m, 'danach': e, 'ok': m['zustand'] == 'nummer_' + n and m['bild_an'] == ['nummer_' + n] and m['req'] == erw and (erw == 0 or m['ebene'] == 1) and e['zustand'] == 'idle' and e['req'] == 0 and e['ebene'] == 0 and 'hf-fig-' not in e['fig_klasse']}
            # schlafend -> nummer() tut nichts
            q.evaluate("D.zeige('sleep_sitting',{dauer:0})"); q.wait_for_timeout(100)
            schl = q.evaluate("({rueckgabe: D.nummer('karate'), zustand: D.zustand(), req: D.wurzel().querySelectorAll('.hf__req').length})")
            q.evaluate("D.wurzel().querySelector('.hf__figur').click()"); q.wait_for_timeout(200)
            # Abbruch durch Lehrmeister-Ereignis mitten in der Nummer -> Ebene auf 0 (Bitte KC)
            q.evaluate("D.manifest().verhalten.nummer_dauer_ms = 6000; D.nummer('karate')"); q.wait_for_function("D.zustand()==='nummer_karate'", timeout=8000); q.wait_for_timeout(700)
            vor = q.evaluate("D.wurzel().querySelectorAll('.hf__req').length")
            q.evaluate("D.ereignis('viel_offen',{n:7})"); q.wait_for_timeout(150)
            ab = q.evaluate("({zustand: D.zustand(), req: D.wurzel().querySelectorAll('.hf__req').length, ebene: D.wurzel().querySelectorAll('.hf__req-ebene').length, laufend: D.laufendeNummer(), fig_klasse: D.wurzel().querySelector('.hf__figur').className})")
            # Abbruch durch Tipp
            q.wait_for_timeout(6000); q.evaluate("D.nummer('bowling')"); q.wait_for_function("D.zustand()==='nummer_bowling'", timeout=8000); q.wait_for_timeout(500)
            q.evaluate("D.wurzel().querySelector('.hf__figur').click()"); q.wait_for_timeout(150)
            ab2 = q.evaluate("({zustand: D.zustand(), req: D.wurzel().querySelectorAll('.hf__req').length, ebene: D.wurzel().querySelectorAll('.hf__req-ebene').length})")
            alle_ok = all(v['ok'] for v in je.values())
            return {'anzahl': len(liste), 'je_nummer_ok': {k: v['ok'] for k, v in je.items()}, 'details_fehl': {k: v for k, v in je.items() if not v['ok']}, 'schlafend': schl,
                    'abbruch_ereignis': {'req_vorher': vor, 'danach': ab}, 'abbruch_tipp': ab2,
                    'bestanden': len(liste) == 16 and alle_ok and schl['rueckgabe'] is False and schl['zustand'] == 'sleep_sitting' and vor > 0 and ab['zustand'] == 'sweating' and ab['req'] == 0 and ab['ebene'] == 0 and ab['laufend'] is None and 'hf-fig-' not in ab['fig_klasse'] and ab2['req'] == 0 and ab2['ebene'] == 0}
        sicher('1c6_nummern', f6)
        def f7():
            q.evaluate("D.manifest().schreibtisch.schlaf_nach_ms = 3000; D.manifest().schreibtisch.lauf_min = [0.03, 0.03]; D.manifest().schreibtisch.nummer_min = [0.05, 0.05]; D.manifest().verhalten.nummer_dauer_ms = 1500; D.an(true)")
            verlauf = []
            for i in range(12):
                q.wait_for_timeout(2000); verlauf.append(q.evaluate("({z: D.zustand(), laeuft: D.laeuft(), nummer: D.laufendeNummer()})"))
                if 'sleep' in verlauf[-1]['z']: break
            geschl = any('sleep' in v['z'] for v in verlauf)
            bewegt = any(v['laeuft'] or v['nummer'] for v in verlauf)
            q.evaluate("D.wurzel().querySelector('.hf__figur').click()"); q.wait_for_timeout(150)
            w = q.evaluate("D.zustand()")
            q.evaluate("D.manifest().schreibtisch.schlaf_nach_ms = 600000; D.manifest().schreibtisch.lauf_min = [2,6]; D.manifest().schreibtisch.nummer_min = [3,8]; D.an(true)")
            return {'verlauf_alle_2s': verlauf, 'eingeschlafen': geschl, 'zwischendurch_gelaufen_oder_nummer': bewegt, 'nach_tipp': w, 'bestanden': geschl and w == 'surprised'}
        sicher('1c7_schlaf', f7)
        R['A1c_konsole_fehler'] = [t for t in kq if t[0] == 'pageerror' or (t[0] == 'error' and '404' not in t[1])]
        q.evaluate("D.an(true); D.sage('Prüfseite: Schreibtisch-Kasten', 0); document.getElementById('fenster').classList.add('an')"); q.wait_for_timeout(300)
        q.locator('#schreibtisch').screenshot(path=os.path.join(hier, foto_prefix + 'pruefseite_schreibtisch_mit_fenster.png'))
        q.evaluate("document.getElementById('fenster').classList.remove('an')")
        q.close()
        # ---- Huelle: 1c-2 Ebene, 1c-3 Knopf, 1c-4 Schieben, 1c-8 Spielplatz
        h = b.new_page(viewport={'width': 1100, 'height': 800}); kh = []; h.on('console', lambda m: kh.append((m.type, m.text))); h.on('pageerror', lambda e: kh.append(('pageerror', str(e))))
        h.add_init_script("window.__er=[]; document.addEventListener('hamster-figur:ereignis', e => window.__er.push(e.detail)); window.__ev=[]; ['laufen','tipp','ziehen','sichtbar','wartet'].forEach(n => document.addEventListener('hamster-figur:'+n, e => window.__ev.push([n, e.detail])));")
        h.goto(basis_url + '_PRUEF_hamster_figur_schoner.html'); h.wait_for_load_state('load')
        h.evaluate("try { localStorage.clear(); } catch (e) {}")
        h.wait_for_function("BOS_CRUMBLE_HOST.figur && BOS_CRUMBLE_HOST.figur() && BOS_CRUMBLE_HOST.figur().manifest() && BOS_CRUMBLE_HOST.figur().wurzel()"); h.wait_for_timeout(3200)   # Begruessung abwarten
        FIG = "BOS_CRUMBLE_HOST.figur()"
        def mitte():
            return h.evaluate(f"(() => {{ const r={FIG}.wurzel().querySelector('.hf__figur').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height*0.6]; }})()")
        def f2():
            cx, cy = mitte()
            ohne = h.evaluate(f"(() => {{ const e=document.elementFromPoint({cx},{cy}); return e ? (e.closest('.hf') ? 'figur' : (e.closest('.fenster') ? 'fenster' : e.className)) : null; }})()")
            h.evaluate("document.getElementById('fenster').classList.add('an')"); h.wait_for_timeout(100)
            # Fenster ueber die Figur legen
            h.evaluate(f"(() => {{ const f=document.getElementById('fenster'); const r={FIG}.wurzel().getBoundingClientRect(); f.style.left=(r.left-20)+'px'; f.style.top='10px'; f.style.width=(r.width+60)+'px'; f.style.height='95%'; }})()"); h.wait_for_timeout(100)
            mit = h.evaluate(f"(() => {{ const e=document.elementFromPoint({cx},{cy}); return e ? (e.closest('.hf') ? 'figur' : (e.closest('.fenster') ? 'fenster' : e.className)) : null; }})()")
            h.evaluate("document.getElementById('fenster').classList.remove('an')"); h.wait_for_timeout(100)
            # Kachel unter die Figur legen: liegt die Figur drueber?
            h.evaluate(f"(() => {{ const k=document.querySelector('.bos-tile'); const r={FIG}.wurzel().querySelector('.hf__figur').getBoundingClientRect(); const g=document.getElementById('grid').getBoundingClientRect(); k.style.position='absolute'; k.style.left=(r.left-g.left+r.width/2-42)+'px'; k.style.top=(r.top-g.top+r.height*0.3)+'px'; k.style.height='120px'; k.id='kachelUnterCrumble'; }})()"); h.wait_for_timeout(100)
            ueber = h.evaluate(f"(() => {{ const e=document.elementFromPoint({cx},{cy}); return e ? (e.closest('.hf') ? 'figur' : (e.closest('#kachelUnterCrumble') ? 'kachel' : e.className)) : null; }})()")
            h.evaluate(f"{FIG}.sichtbar(false)"); h.wait_for_timeout(100)
            darunter = h.evaluate(f"(() => {{ const e=document.elementFromPoint({cx},{cy}); return e ? (e.closest('.hf') ? 'figur' : (e.closest('#kachelUnterCrumble') ? 'kachel' : e.className)) : null; }})()")
            h.evaluate(f"{FIG}.sichtbar(true)"); h.wait_for_timeout(100)
            st = h.evaluate("(() => { const b=document.querySelector('.hf-buehne-schreibtisch'); const d=document.getElementById('desktop'); return {z: getComputedStyle(b).zIndex, pos: getComputedStyle(b).position, hinterDesktop: d.nextElementSibling===b, top: getComputedStyle(b).top, bottom: getComputedStyle(b).bottom}; })()")
            return {'ohne_fenster': ohne, 'mit_fenster': mit, 'ueber_kachel': ueber, 'versteckt_kachel_frei': darunter, 'buehne': st,
                    'bestanden': ohne == 'figur' and mit == 'fenster' and ueber == 'figur' and darunter == 'kachel' and st['z'] == '300' and st['hinterDesktop'] and st['top'] == '52px' and st['bottom'] == '64px'}
        sicher('1c2_ebene', f2)
        def f3():
            kb = h.evaluate("(() => { const r=document.querySelector('.hf-knopf-host').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; })()")
            h.mouse.click(kb[0], kb[1]); h.wait_for_timeout(200)
            v = h.evaluate(f"({{versteckt: {FIG}.wurzel().classList.contains('hf--versteckt'), sichtbar: {FIG}.istSichtbar(), timer: {FIG}._timerAktiv(), gespeichert: JSON.parse(localStorage.getItem('bos_crumble_pruef')||'null'), knopf: document.querySelector('.hf-knopf-host').className}})")
            h.evaluate("window.__ev.length=0")
            h.evaluate(f"{FIG}.hinweis('Die Inventur ist von vorgestern.')"); h.wait_for_timeout(5000)
            w = h.evaluate(f"({{punkt: document.querySelector('.hf-knopf-host').classList.contains('hf-knopf-host--wartet'), blase: {FIG}.wurzel().querySelector('.hf__blase').classList.contains('hf__blase--an'), laeuft: {FIG}.laeuft(), zustand: {FIG}.zustand(), timer: {FIG}._timerAktiv(), ereignisse: window.__ev.filter(e=>e[0]==='laufen').length, versteckt: {FIG}.wurzel().classList.contains('hf--versteckt')}})")
            h.mouse.click(kb[0], kb[1]); h.wait_for_timeout(400)
            z = h.evaluate(f"({{sichtbar: {FIG}.istSichtbar(), hinweisOffen: {FIG}.hinweisOffen(), zustand: {FIG}.zustand(), blase: {FIG}.wurzel().querySelector('.hf__blase').textContent, punkt: document.querySelector('.hf-knopf-host').classList.contains('hf-knopf-host--wartet'), timer: {FIG}._timerAktiv()}})")
            # Hinweis quittieren, verstecken, neu laden -> bleibt versteckt
            h.evaluate(f"{FIG}.wurzel().querySelector('.hf__figur').click(); {FIG}.sichtbar(false)"); h.wait_for_timeout(200)
            h.reload(); h.wait_for_load_state('load')
            h.wait_for_function("BOS_CRUMBLE_HOST.figur && BOS_CRUMBLE_HOST.figur() && BOS_CRUMBLE_HOST.figur().manifest() && BOS_CRUMBLE_HOST.figur().wurzel()"); h.wait_for_timeout(600)
            nl = h.evaluate(f"({{versteckt: {FIG}.wurzel().classList.contains('hf--versteckt'), sichtbar: {FIG}.istSichtbar(), timer: {FIG}._timerAktiv()}})")
            h.evaluate(f"{FIG}.sichtbar(true)"); h.wait_for_timeout(300)
            return {'nach_knopf': v, 'hinweis_versteckt_5s': w, 'nach_knopf_wieder': z, 'nach_neuladen': nl,
                    'bestanden': v['versteckt'] and v['sichtbar'] is False and v['timer'] == 0 and v['gespeichert'] and v['gespeichert'].get('sichtbar') is False
                                 and w['punkt'] and w['blase'] is False and w['laeuft'] is False and w['timer'] == 0 and w['ereignisse'] == 0 and w['versteckt']
                                 and z['sichtbar'] and z['hinweisOffen'] and z['zustand'] == 'raise_hand' and 'Inventur' in z['blase'] and z['punkt'] is False and z['timer'] > 0
                                 and nl['versteckt'] and nl['sichtbar'] is False and nl['timer'] == 0}
        sicher('1c3_knopf', f3)
        def f4():
            h.wait_for_timeout(3200)
            x0 = h.evaluate(f"{FIG}.x()"); cx, cy = mitte()
            h.mouse.move(cx, cy); h.mouse.down()
            for i in range(1, 11): h.mouse.move(cx + 20 * i, cy); h.wait_for_timeout(20)
            h.mouse.up(); h.wait_for_timeout(250)
            d = h.evaluate(f"({{x: {FIG}.x(), links: parseFloat({FIG}.wurzel().style.left), gespeichert: JSON.parse(localStorage.getItem('bos_crumble_pruef')||'null'), zieht: {FIG}.wurzel().classList.contains('hf--zieht'), tipps: window.__ev.filter(e=>e[0]==='tipp').length, ziehen: window.__ev.filter(e=>e[0]==='ziehen').length}})")
            h.reload(); h.wait_for_load_state('load')
            h.wait_for_function("BOS_CRUMBLE_HOST.figur && BOS_CRUMBLE_HOST.figur() && BOS_CRUMBLE_HOST.figur().manifest() && BOS_CRUMBLE_HOST.figur().wurzel()"); h.wait_for_timeout(600)
            n = h.evaluate(f"({{x: {FIG}.x(), links: parseFloat({FIG}.wurzel().style.left)}})")
            h.set_viewport_size({'width': 400, 'height': 800}); h.wait_for_timeout(300)
            k = h.evaluate(f"(() => {{ const w={FIG}.wurzel(); const b=document.querySelector('.hf-buehne-schreibtisch'); return {{links: parseFloat(w.style.left), figW: parseFloat(w.querySelector('.hf__figur').style.width), breite: b.clientWidth, x: {FIG}.x()}}; }})()")
            h.set_viewport_size({'width': 1100, 'height': 800}); h.wait_for_timeout(300)
            # 5 px: ein Tipp, kein Ziehen
            h.evaluate("window.__ev.length=0"); x1 = h.evaluate(f"{FIG}.x()"); cx, cy = mitte()
            h.mouse.move(cx, cy); h.mouse.down(); h.mouse.move(cx + 5, cy); h.wait_for_timeout(30); h.mouse.up(); h.wait_for_timeout(200)
            t5 = h.evaluate(f"({{x: {FIG}.x(), tipps: window.__ev.filter(e=>e[0]==='tipp').length, ziehen: window.__ev.filter(e=>e[0]==='ziehen').length, zustand: {FIG}.zustand()}})")
            return {'start_x': x0, 'nach_200px': d, 'nach_neuladen': n, 'viewport_400': k, 'fuenf_px': t5,
                    'bestanden': d['x'] > x0 + 0.1 and d['gespeichert'] and abs(d['gespeichert'].get('x', -1) - d['x']) < 0.001 and d['zieht'] is False and d['ziehen'] == 2 and d['tipps'] == 0
                                 and abs(n['links'] - d['links']) <= 2 and k['links'] + k['figW'] <= k['breite'] + 1 and k['links'] >= 0
                                 and t5['tipps'] == 1 and t5['ziehen'] == 0 and abs(t5['x'] - x1) < 0.001}
        sicher('1c4_schieben', f4)
        def f8():
            h.evaluate("BOS_SCREENSAVER._zeigeJetzt()"); h.wait_for_timeout(600)
            h.wait_for_function("BOS_SCREENSAVER._figur() && BOS_SCREENSAVER._figur().manifest() && BOS_SCREENSAVER._figur().wurzel()"); h.wait_for_timeout(500)
            S = "BOS_SCREENSAVER._figur()"
            h.evaluate(f"{S}.manifest().verhalten.nummer_dauer_ms = 2500; {S}.nummer('bowling')"); h.wait_for_function(f"{S}.zustand()==='nummer_bowling'", timeout=8000); h.wait_for_timeout(700)
            n = h.evaluate(f"({{zustand: {S}.zustand(), req: {S}.wurzel().querySelectorAll('.hf__req').length, sichtbar: document.getElementById('bosScreensaver').classList.contains('bosss--visible'), imRoot: document.getElementById('bosScreensaver').contains({S}.wurzel()), links: parseFloat({S}.wurzel().style.left)}})")
            h.screenshot(path=os.path.join(hier, foto_prefix + 'schoner_nummer.png'))
            h.wait_for_function(f"{S}.zustand()==='idle'", timeout=8000); h.wait_for_timeout(200)
            ok = h.evaluate(f"{S}.laufe(0.3)"); h.wait_for_timeout(400)
            l = h.evaluate(f"({{laeuft: {S}.laeuft(), klasse: {S}.wurzel().classList.contains('hf--laeuft')}})")
            r = h.evaluate(f"(() => {{ const r={S}.wurzel().querySelector('.hf__figur').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height*0.6]; }})()")
            h.mouse.click(r[0], r[1]); h.wait_for_timeout(300)
            t = h.evaluate(f"({{sichtbar: document.getElementById('bosScreensaver').classList.contains('bosss--visible'), laeuft: {S}.laeuft(), zustand: {S}.zustand()}})")
            h.mouse.click(60, 400); h.wait_for_timeout(300)
            zu = h.evaluate("document.getElementById('bosScreensaver').classList.contains('bosss--visible')")
            return {'nummer_im_schoner': n, 'laufe': ok, 'laeuft': l, 'tipp_auf_crumble': t, 'tipp_daneben_zu': zu is False,
                    'bestanden': n['zustand'] == 'nummer_bowling' and n['req'] > 0 and n['sichtbar'] and n['imRoot'] and ok is True and l['laeuft'] and t['sichtbar'] and t['laeuft'] is False and t['zustand'] != 'idle' and zu is False}
        sicher('1c8_spielplatz', f8)
        R['B1c_konsole_fehler'] = [t for t in kh if t[0] == 'pageerror' or (t[0] == 'error' and '404' not in t[1])]
        # Fotos Schreibtisch quer/hoch, hell/dunkel (falls die Seite nach einer Probe neu geladen wurde: auf die Figur warten)
        h.wait_for_function("window.BOS_CRUMBLE_HOST && BOS_CRUMBLE_HOST.figur() && BOS_CRUMBLE_HOST.figur().wurzel()", timeout=15000)
        h.evaluate(f"document.getElementById('fenster').classList.remove('an'); {FIG}.an(true); {FIG}.nummer('jongleur')"); h.wait_for_timeout(1200)
        h.screenshot(path=os.path.join(hier, foto_prefix + 'schreibtisch_quer_dunkel.png'))
        h.evaluate(f"document.documentElement.setAttribute('data-theme','light'); {FIG}.sage('Moin. 3 Aufgaben warten.', 0)"); h.wait_for_timeout(300)
        h.screenshot(path=os.path.join(hier, foto_prefix + 'schreibtisch_quer_hell.png'))
        h.set_viewport_size({'width': 800, 'height': 1200}); h.wait_for_timeout(400)
        h.evaluate(f"{FIG}.nummer('karate')"); h.wait_for_timeout(900)
        h.screenshot(path=os.path.join(hier, foto_prefix + 'schreibtisch_hoch_hell.png'))
        h.evaluate("document.documentElement.removeAttribute('data-theme')"); h.wait_for_timeout(200)
        h.screenshot(path=os.path.join(hier, foto_prefix + 'schreibtisch_hoch_dunkel.png'))
        h.evaluate("try { localStorage.clear(); } catch (e) {}")
        h.close()
        return R
    E.update(faelle_1c(U, 'bild_1c_'))
    if stufe1:
        tmp1 = tempfile.mkdtemp(prefix='crumble_stufe1_')
        for name in ['bos_screensaver.js', 'bos_screensaver_content.js', 'bos_crumble_host.js', 'bos_design_tokens.css']:
            src = os.path.join(stufe1, name) if os.path.exists(os.path.join(stufe1, name)) else os.path.join(bos, name)
            shutil.copy(src, tmp1)
        os.makedirs(os.path.join(tmp1, 'hamster_figur'))
        for name in ['hamster_figur.js', 'hamster_figur.css', 'hamster_figur_manifest.json']:
            src = os.path.join(stufe1, 'hamster_figur', name) if os.path.exists(os.path.join(stufe1, 'hamster_figur', name)) else os.path.join(bos, 'hamster_figur', name)
            shutil.copy(src, os.path.join(tmp1, 'hamster_figur'))
        for name in ['_PRUEF_hamster_figur_vorschau.html', '_PRUEF_hamster_figur_schoner.html']:   # NEUE Pruefseiten gegen ALTE Dateien
            shutil.copy(os.path.join(bos, 'hamster_figur', name), os.path.join(tmp1, 'hamster_figur'))
        shutil.copytree(os.path.join(bos, 'hamster_figur', 'bilder'), os.path.join(tmp1, 'hamster_figur', 'bilder'))
        shutil.copytree(os.path.join(bos, 'hamster_figur', 'nummern'), os.path.join(tmp1, 'hamster_figur', 'nummern'))
        srv4 = server(tmp1, PORT + 3)
        try:
            G1 = faelle_1c(f'http://127.0.0.1:{PORT + 3}/hamster_figur/', 'bild_gegenprobe_stufe1_')
        except Exception as ex:
            G1 = {'fehler': str(ex)[:300]}
        kern = {k: G1.get(k, {}) for k in ('1c1_blase', '1c2_ebene', '1c3_knopf', '1c4_schieben')}
        E['gegenprobe_stufe1_1c'] = {k: {'bestanden': bool(v.get('bestanden')), 'rot_wie_erwartet': not v.get('bestanden'), 'kurz': (v.get('fehler') or {kk: vv for kk, vv in v.items() if kk != 'bestanden'})} for k, v in kern.items()}
        E['gegenprobe_stufe1_1c']['alle_rot'] = all(not v.get('bestanden') for v in kern.values())
        srv4.shutdown(); shutil.rmtree(tmp1, ignore_errors=True)
        for f in os.listdir(hier):
            if f.startswith('bild_gegenprobe_stufe1_'): os.remove(os.path.join(hier, f))

    # ================================================================ Nachtrag 1: Faelle 14-16 (gegen beliebigen bos-Ordner fahrbar)
    def faelle_14_16(basis_url):
        R = {}
        q = b.new_page(viewport={'width': 1100, 'height': 900}); kq = []; q.on('console', lambda m: kq.append((m.type, m.text)))
        q.goto(basis_url + '_PRUEF_hamster_figur_vorschau.html')
        q.wait_for_function("window.K && window.S && K.manifest() && S.manifest()"); q.wait_for_timeout(500)
        # 14 Einschlafen trotz Inhalt: schlaf 3 s, reaktion 1,5 s, Anteil 1, beilaeufig alle 2,5 s -> binnen 10 s sleep_*
        q.evaluate("S.manifest().spielplatz.schlaf_nach_ms = 3000; S.manifest().spielplatz.reaktions_anteil = 1; S.manifest().verhalten.reaktion_ms = 1500; S.setzeRolle('spielplatz'); S.an(true)")
        verlauf = []
        for i in range(4):
            q.evaluate("S.ereignis('schoner_fakt', {beilaeufig: true})"); q.wait_for_timeout(2500); verlauf.append(q.evaluate("S.zustand()"))
        eingeschlafen = any('sleep' in z for z in verlauf)
        for i in range(3):
            q.evaluate("S.ereignis('schoner_spruch', {beilaeufig: true})"); q.wait_for_timeout(300)
        durch = q.evaluate("S.zustand()")
        q.evaluate("S.wurzel().querySelector('.hf__figur').click()"); q.wait_for_timeout(150)
        geweckt = q.evaluate("S.zustand()")
        R['fall14_einschlafen_trotz_inhalt'] = {'verlauf_alle_2_5s': verlauf, 'binnen_10s_eingeschlafen': eingeschlafen, 'nach_3_weiteren_beilaeufigen': durch, 'nach_tipp': geweckt,
            'bestanden': eingeschlafen and 'sleep' in durch and geweckt == 'surprised'}
        # 15 Tipp waehrend draussen (Knopf und Figur): Ereignis, 4 s, Klick -> nach 2,6 s hervor wahr + Blase an; nach 6,5 s hervor falsch
        def tipp_draussen(sel):
            q.evaluate("K.an(true)"); q.wait_for_timeout(200)
            q.evaluate("K.ereignis('erfolg')"); q.wait_for_timeout(4000)
            q.evaluate(f"K.wurzel().querySelector('{sel}').click()"); q.wait_for_timeout(2600)
            m = q.evaluate("({zustand: K.zustand(), hervor: K.wurzel().classList.contains('hf--hervor'), blase: K.wurzel().querySelector('.hf__blase').classList.contains('hf__blase--an')})")
            q.wait_for_timeout(3900)
            e = q.evaluate("({hervor: K.wurzel().classList.contains('hf--hervor'), zustand: K.zustand()})")
            return {'nach_2_6s': m, 'nach_6_5s': e, 'bestanden': m['hervor'] is True and m['blase'] is True and m['zustand'] != 'idle' and e['hervor'] is False}
        R['fall15_tipp_waehrend_draussen_knopf'] = tipp_draussen('.hf__knopf')
        R['fall15_tipp_waehrend_draussen_figur'] = tipp_draussen('.hf__figur')
        q.close()
        # 16 Profilwechsel in der Huelle
        h = b.new_page(viewport={'width': 1100, 'height': 800}); kh = []; h.on('console', lambda m: kh.append((m.type, m.text)))
        h.add_init_script("window.__er=[]; document.addEventListener('hamster-figur:ereignis', e => window.__er.push(e.detail));")
        h.goto(basis_url + '_PRUEF_hamster_figur_schoner.html'); h.wait_for_load_state('load')
        h.wait_for_function("BOS_CRUMBLE_HOST.knopf() && BOS_CRUMBLE_HOST.knopf().manifest()"); h.wait_for_timeout(300)
        h.evaluate("feuer({offen:4, vorher:null, fehler:null, gesperrt:false})"); h.wait_for_timeout(300)
        g1 = h.evaluate("BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__blase').textContent")
        START = "starteHost()"
        h.evaluate("window.__neuLadenAntwort = {offen:4, gesperrt:true}; " + START); h.wait_for_timeout(700)
        g2 = h.evaluate("({text: BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__blase').textContent, gruesse: window.__er.filter(e=>e.ereignis==='app_geoeffnet').length, neuLaden: window.__neuLadenAufrufe||0})")
        h.wait_for_timeout(6000)   # Gruss ablaufen lassen
        h.evaluate("window.__neuLadenAntwort = null; " + START); h.wait_for_timeout(3200)
        g3 = h.evaluate("({text: BOS_CRUMBLE_HOST.knopf().wurzel().querySelector('.hf__blase').textContent, gruesse: window.__er.filter(e=>e.ereignis==='app_geoeffnet').length})")
        h.close()
        R['fall16_profilwechsel'] = {'gruss_1_mit_4': g1, 'gruss_2_attrappe_gesperrt': g2, 'gruss_3_ohne_antwort_3_2s': g3,
            'bestanden': '4' in g1 and '4' not in g2['text'] and g2['gruesse'] == 2 and '4' not in g3['text'] and g3['gruesse'] == 3}
        return R
    E.update(faelle_14_16(U))
    if geliefert:
        tmpg = tempfile.mkdtemp(prefix='crumble_geliefert_')
        for name in ['bos_screensaver.js', 'bos_screensaver_content.js', 'bos_crumble_host.js', 'bos_design_tokens.css']:
            src = os.path.join(geliefert, name) if os.path.exists(os.path.join(geliefert, name)) else os.path.join(bos, name)
            shutil.copy(src, tmpg)
        shutil.copytree(os.path.join(geliefert, 'hamster_figur'), os.path.join(tmpg, 'hamster_figur'), ignore=shutil.ignore_patterns('bilder', '_PRUEF_hamster_figur_werkzeuge'))
        # Huelle der NEUEN Fassung (mit Attrappe) auch dort, damit Fall 16 vergleichbar ist; Pruefseite der gelieferten Fassung
        shutil.copy(os.path.join(bos, 'hamster_figur', '_PRUEF_hamster_figur_schoner.html'), os.path.join(tmpg, 'hamster_figur'))
        shutil.copytree(os.path.join(bos, 'hamster_figur', 'bilder'), os.path.join(tmpg, 'hamster_figur', 'bilder'))
        srv3 = server(tmpg, PORT + 2)
        G = faelle_14_16(f'http://127.0.0.1:{PORT + 2}/hamster_figur/')
        E['fall17_gegenprobe_gelieferte_fassung'] = {k: {'bestanden': v['bestanden'], 'rot_wie_erwartet': not v['bestanden'], 'kurz': {kk: vv for kk, vv in v.items() if kk != 'bestanden'}} for k, v in G.items()}
        E['fall17_gegenprobe_gelieferte_fassung']['alle_rot'] = all(not v['bestanden'] for v in G.values())
        srv3.shutdown(); shutil.rmtree(tmpg, ignore_errors=True)

    # ================================================================ Fall 13: Gegenprobe mit der ALTEN hamster_figur.js (alte Pruefseite, alte API)
    def alte_api_proben(url, seite, sel):
        # sel: Wurzel der Figur, die die alte API (H = BOS_HAMSTER_FIGUR) steuert — neue Seite '.hf--fest', alte Seite '.hf'
        q = b.new_page(viewport={'width': 1000, 'height': 800}); kq = []; q.on('console', lambda m: kq.append((m.type, m.text)))
        q.goto(url); q.wait_for_function("document.querySelectorAll('.hf__bild').length>0"); q.wait_for_timeout(500)
        q.evaluate("H.setzeModus('knopf')"); q.wait_for_timeout(200)
        q.evaluate("H.hinweis('Probe')"); q.wait_for_timeout(200)
        q.evaluate(f"document.querySelector('{sel} .hf__figur').click()"); q.wait_for_timeout(1000)
        c = q.evaluate(f"document.querySelector('{sel}').classList.contains('hf--hervor')")
        q.evaluate("H.an(true)"); q.wait_for_timeout(100)
        q.evaluate("H.ereignis('hinweis')"); q.wait_for_timeout(200)
        c2 = q.evaluate(f"document.querySelector('{sel}').classList.contains('hf--hinweis')")
        q.evaluate(f"document.querySelector('{sel} .hf__figur').click()"); q.evaluate("H.setzeModus('ecke'); H.an(true)"); q.wait_for_timeout(200)
        q.evaluate("H.registriere.zustand('probe_neu', {datei:'idle.png', gruppe:'stand', kategorie:'geste', koerper:[0,0,1,1], texte:['Probe']})"); q.wait_for_timeout(300)
        d = q.evaluate(f"({{aus: document.querySelector('{sel}').classList.contains('hf--aus'), wurzeln: document.querySelectorAll('.hf').length}})")
        q.evaluate("H.ereignis('app_geoeffnet')"); d2 = q.evaluate("H.zustand()")
        q.close()
        return {'seite': seite, 'fall1_hervor_nach_tipp_1s': c, 'fall3_hinweis_klasse_nach_ereignis': c2, 'fall2_aus_nach_registriere': d['aus'], 'fall2_ereignis_danach': d2,
                'gruen': (c is False and c2 is True and d['aus'] is False and d2 == 'wave')}
    # neu (Standard-Instanz 'fest' auf der neuen Pruefseite — gleiche Aufrufe wie frueher)
    E['fall13_neu_alte_api'] = alte_api_proben(U + '_PRUEF_hamster_figur_vorschau.html', 'neue Dateien', '.hf--fest')
    if alt:
        tmp = tempfile.mkdtemp(prefix='crumble_alt_')
        shutil.copytree(os.path.join(alt, 'hamster_figur'), os.path.join(tmp, 'hamster_figur'), ignore=shutil.ignore_patterns('bilder'))
        shutil.copytree(os.path.join(bos, 'hamster_figur', 'bilder'), os.path.join(tmp, 'hamster_figur', 'bilder'))
        if os.path.exists(os.path.join(alt, 'bos_design_tokens.css')): shutil.copy(os.path.join(alt, 'bos_design_tokens.css'), tmp)
        srv2 = server(tmp, PORT + 1)
        E['fall13_alt_gegenprobe'] = alte_api_proben(f'http://127.0.0.1:{PORT + 1}/hamster_figur/_PRUEF_hamster_figur_vorschau.html', 'ALTE Dateien aus ' + alt, '.hf')
        E['fall13_alt_gegenprobe']['rot_wie_erwartet'] = not E['fall13_alt_gegenprobe']['gruen']
        srv2.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
    b.close()
srv.shutdown()

E['zusammenfassung'] = {k: v.get('bestanden') for k, v in E.items() if isinstance(v, dict) and 'bestanden' in v and not k.startswith('gegenprobe')}   # Gegenproben zaehlen als 'rot' separat
E['zusammenfassung']['fall13_neu_gruen'] = E['fall13_neu_alte_api']['gruen']
if alt: E['zusammenfassung']['fall13_alt_rot'] = E['fall13_alt_gegenprobe']['rot_wie_erwartet']
if geliefert: E['zusammenfassung']['fall17_geliefert_14_16_rot'] = E['fall17_gegenprobe_gelieferte_fassung']['alle_rot']
if stufe1: E['zusammenfassung']['gegenprobe_stufe1_1c_rot'] = E['gegenprobe_stufe1_1c']['alle_rot']
if geliefert1c: E['zusammenfassung']['gegenprobe_1c9_rot'] = E['gegenprobe_1c9_lieferung_0939']['rot_wie_erwartet']
json.dump(E, open(os.path.join(hier, 'probe_ergebnis.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(json.dumps(E, indent=1, ensure_ascii=False))
