"""requisiten_trennen.py — Kontroll-Chat Crumble, 17.10.2026, 09:00 Uhr.
Zerlegt eine freigestellte Figur (PNG mit Alpha) in Figur + frei schwebende Requisiten:
groesste zusammenhaengende Flaeche = Figur, jede weitere Flaeche > MIN_PX = Requisite.
Ausgabe je Nummer: <ziel>/<name>/figur.png, <ziel>/<name>/req_NN.png (gleiche Groesse wie das
Original, nur die Requisite sichtbar — so stimmen die Positionen ohne Rechnen), dazu
<ziel>/nummern.json mit Kasten jeder Requisite in Anteilen 0..1 des Originals (x0,y0,x1,y1),
Flaeche, Klasse ('gross' >= 5000 px, sonst 'klein').
Aufruf: python3 -I requisiten_trennen.py <ordner mit crumble_*.png> <zielordner> [--min 400]
"""
import sys, os, json, argparse
import numpy as np, cv2
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('quelle'); ap.add_argument('ziel'); ap.add_argument('--min', type=int, default=400)
a = ap.parse_args()
os.makedirs(a.ziel, exist_ok=True)
out = {}
for datei in sorted(os.listdir(a.quelle)):
    if not datei.endswith('.png'): continue
    name = datei[:-4].replace('crumble_', '')
    im = np.array(Image.open(os.path.join(a.quelle, datei)).convert('RGBA'))
    h, w = im.shape[:2]; al = im[..., 3]
    cnt, lab, st, _ = cv2.connectedComponentsWithStats((al > 40).astype(np.uint8), connectivity=8)
    idx = sorted(range(1, cnt), key=lambda i: -st[i, cv2.CC_STAT_AREA])
    koerper = idx[0]
    d = os.path.join(a.ziel, name); os.makedirs(d, exist_ok=True)
    figur = im.copy(); figur[lab != koerper] = 0
    # Figur: weiche Kante der Requisiten mitnehmen? Nein — Pixel mit alpha<=40 gehoeren niemandem, bleiben wie sie sind,
    # ausser sie haengen an einer Requisite (Dilatation um 2 px um jede Requisite loeschen)
    req_maske = np.zeros_like(al, dtype=np.uint8)
    reqs = []
    for k, i in enumerate(idx[1:]):
        area = int(st[i, cv2.CC_STAT_AREA])
        if area < a.min: continue
        m = (lab == i).astype(np.uint8)
        md = cv2.dilate(m, np.ones((5, 5), np.uint8))
        req_maske |= md
        r = np.zeros_like(im); r[md > 0] = im[md > 0]
        x, y, bw, bh = [int(v) for v in st[i, :4]]
        fn = f'req_{len(reqs)+1:02d}.png'
        Image.fromarray(r).crop((max(x-2,0), max(y-2,0), min(x+bw+2, w), min(y+bh+2, h))).save(os.path.join(d, fn), optimize=True)
        reqs.append({'datei': fn, 'kasten': [round(max(x-2,0)/w, 4), round(max(y-2,0)/h, 4), round(min(x+bw+2, w)/w, 4), round(min(y+bh+2, h)/h, 4)],
                     'flaeche': area, 'klasse': 'gross' if area >= 5000 else 'klein'})
    figur[req_maske > 0] = 0
    Image.fromarray(figur).save(os.path.join(d, 'figur.png'), optimize=True)
    out[name] = {'bild': f'{name}/figur.png', 'groesse': [w, h], 'requisiten': reqs}
    print(f'{name:16s} Requisiten: {len(reqs):2d} (gross {sum(1 for r in reqs if r["klasse"]=="gross")}, klein {sum(1 for r in reqs if r["klasse"]=="klein")})')
json.dump(out, open(os.path.join(a.ziel, 'nummern.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('geschrieben:', os.path.join(a.ziel, 'nummern.json'))
