"""requisiten_sprite.py — Bau-Chat Crumble, 17.10.2026 (Stufe 1c, Bauplan §2 / W6).
Macht aus dem Ergebnis von requisiten_trennen.py (nummern/<name>/figur.png, req_NN.png, nummern.json) den
Repo-Ordner und den Manifest-Block:
  - Requisiten 'gross' bleiben einzeln (kopiert), auf ihren Kasten beschnitten? NEIN — gleiche Leinwand wie das Original
    (so stimmen die Lagen ohne Rechnen; das Modul setzt sie absolut nach 'kasten').
  - Requisiten 'klein' werden je Nummer zu EINEM Sprite 'klein.png' zusammengelegt (gleiche Leinwand), fuer die Nummern in
    TEILEN in zwei Haelften links/rechts der Koerpermitte ('klein_links.png', 'klein_rechts.png'), damit Spritzer auseinanderfliegen.
    Sprites werden auf ihren Kasten beschnitten (spart Bytes), der Kasten steht im Manifest.
  - Schreibt den Block 'nummern' in hamster_figur_manifest.json (choreografie, massstab, texte aus der Tabelle unten;
    vorhandene Eintraege im Manifest bleiben erhalten, nur fehlende werden ergaenzt).
Aufruf:  python3 -I requisiten_sprite.py <quelle: ordner mit nummern.json> <ziel: bos/hamster_figur/nummern> [--manifest <hamster_figur_manifest.json>]
Braucht: Pillow.  Erzeugt NUR die Dateien, die das Modul laedt (figur.png, req_NN.png der Klasse gross, klein*.png).
"""
import sys, os, json, shutil, argparse
from PIL import Image

TEILEN = {'torte_gesicht', 'chili', 'geheimagent'}
# Choreografie je Nummer (Anweisung §4 K29-Tabelle, Bauplan W7), Massstab (Demo), Spruch-Vorschlaege (Demo NUMMERN)
VORGABEN = {
 'jongleur':     dict(figur='wippen',   gross='kreisen',     klein=None,       massstab=1.3,  texte=['Vier Brote. Null Hände frei. Kein Problem.', 'Jonglieren ist nur Werfen mit Stil.']),
 'karate':       dict(figur='ruck',     gross='auseinander', klein='sprengen', massstab=1.3,  texte=['HIIIJA. Scheibe gefällig?', 'Brotmesser? Brauch ich nicht.']),
 'mehlbombe':    dict(figur='niesen',   gross='puff',        klein='puff',     massstab=1.3,  texte=['War der Sack kaputt oder ich?', 'Hatschi. Mehl 550. Erkenn ich blind.']),
 'froster':      dict(figur='zittern',  gross='fallen',      klein='flackern', massstab=1.3,  texte=['Im Froster ist es kalt. Hab ich geprüft.', 'Minus achtzehn. Wie mein Humor.']),
 'bowling':      dict(figur='neigen',   gross='umfallen',    klein='sprengen', massstab=1.25, texte=['Strike. Mit Semmel.', 'Stangen umhauen ist auch Sport.']),
 'alchemist':    dict(figur='nicken',   gross='steigen',     klein='steigen',  massstab=1.15, texte=['Es blubbert. Also lebt es.', 'Sauerteig: Tag 847. Er mag mich.']),
 'zombie':       dict(figur='nicken',   gross='steigen',     klein='steigen',  massstab=1.15, texte=['Kaffee. Jetzt. Bitte. Danke.', 'Ich war schon wach, als du kamst.']),
 'croissant':    dict(figur=None,       gross='schweben',    klein='schweben', massstab=1.15, texte=['Pause. Auf Blätterteig.', 'Nicht stören. Ich reife.']),
 'fechter':      dict(figur='ausfallen',gross='wedeln',      klein='sprengen', massstab=1.15, texte=['En garde! Mit Baguette.', 'Touché. Krümel.']),
 'gewichtheber': dict(figur='wackeln',  gross=None,          klein='flackern', massstab=1.25, texte=['Zwei Brezeln. Laugen-Hantel.', 'Noch eine Wiederholung. Dann Pause.']),
 'hamstertag':   dict(figur='wippen',   gross='huepfen',     klein=None,       massstab=1.3,  texte=['Morgen Hamstertag. Ich bin vorbereitet.', 'Vorrat ist kein Hobby. Vorrat ist Pflicht.']),
 'torte_gesicht':dict(figur='einschlag',gross=None,          klein='spritzen', massstab=1.15, texte=['Das war Absicht. Fast.', 'Sahne. Überall. Auch hinten.']),
 'chili':        dict(figur='neigen',   gross=None,          klein='tropfen',  massstab=1.25, texte=['Bisschen Schärfe schadet keiner Torte.', 'Das ist Deko. Rote Deko.']),
 'geheimagent':  dict(figur='ruck',     gross=None,          klein='flitzen',  massstab=1.15, texte=['Der Name ist Crumble. Nur Crumble.', 'Geschüttelt, nicht geknetet.']),
 'backen_voll':  dict(figur='pulsieren',gross=None,          klein=None,       massstab=1.15, texte=['Mmmpf.', 'Ich sag später was.']),
 'teigmonster':  dict(figur='wabern',   gross=None,          klein=None,       massstab=1.45, texte=['Hilfe. Der Teig geht. Mit mir.', 'Ich hab nur kurz reingefasst.']),
}

ap = argparse.ArgumentParser(); ap.add_argument('quelle'); ap.add_argument('ziel'); ap.add_argument('--manifest')
a = ap.parse_args()
quelle = json.load(open(os.path.join(a.quelle, 'nummern.json'), encoding='utf-8'))
os.makedirs(a.ziel, exist_ok=True)
block = {}
dateien = 0
for name, n in quelle.items():
    q = os.path.join(a.quelle, name); z = os.path.join(a.ziel, name); os.makedirs(z, exist_ok=True)
    W, H = n['groesse']
    shutil.copy(os.path.join(q, 'figur.png'), os.path.join(z, 'figur.png')); dateien += 1
    eintrag = {'bild': name + '/figur.png', 'groesse': [W, H], 'koerper': n['koerper'], 'requisiten': [], 'klein': []}
    kleine = []
    for r in n['requisiten']:
        if r['klasse'] == 'gross':
            shutil.copy(os.path.join(q, r['datei']), os.path.join(z, r['datei'])); dateien += 1
            eintrag['requisiten'].append({'datei': name + '/' + r['datei'], 'kasten': r['kasten'], 'klasse': 'gross'})
        else:
            kleine.append(r)
    if kleine:
        k = n['koerper']; mitte = (k[0] + k[2]) / 2
        gruppen = {'klein': kleine}
        if name in TEILEN:
            gruppen = {'klein_links': [r for r in kleine if (r['kasten'][0] + r['kasten'][2]) / 2 < mitte],
                       'klein_rechts': [r for r in kleine if (r['kasten'][0] + r['kasten'][2]) / 2 >= mitte]}
        for gname, liste in gruppen.items():
            if not liste: continue
            leinwand = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            for r in liste:
                im = Image.open(os.path.join(q, r['datei'])).convert('RGBA')
                leinwand.alpha_composite(im)
            bbox = leinwand.getbbox()
            if not bbox: continue
            sprite = leinwand.crop(bbox)
            sprite = sprite.quantize(256, method=Image.Quantize.FASTOCTREE)   # 256 Farben wie die Vorlagen
            sprite.save(os.path.join(z, gname + '.png'), optimize=True); dateien += 1
            eintrag['klein'].append({'datei': name + '/' + gname + '.png', 'kasten': [bbox[0] / W, bbox[1] / H, bbox[2] / W, bbox[3] / H], 'klasse': 'klein', 'anzahl': len(liste)})
    v = VORGABEN.get(name, {})
    eintrag['massstab'] = v.get('massstab', 1.15)
    eintrag['choreografie'] = {'figur': v.get('figur'), 'gross': v.get('gross'), 'klein': v.get('klein')}
    eintrag['texte'] = v.get('texte', [])
    block[name] = eintrag
print('Dateien im Ziel:', dateien, '| Nummern:', len(block))
json.dump(block, open(os.path.join(a.ziel, '_nummern_block.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
if a.manifest:
    m = json.load(open(a.manifest, encoding='utf-8'))
    alt = m.get('nummern', {})
    for name, e in block.items():
        if name in alt:   # Pflegeeintraege (texte, choreografie, massstab, dauer_ms) aus dem Manifest behalten
            for feld in ('texte', 'choreografie', 'massstab', 'dauer_ms'):
                if feld in alt[name]: e[feld] = alt[name][feld]
    m['nummern'] = block
    json.dump(m, open(a.manifest, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('Manifest-Block nummern geschrieben:', a.manifest)
