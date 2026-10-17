"""key_figur.py — Wallpaper-Figur freistellen (Kontroll-Chat Crumble, 17.10.2026, 07:12 Uhr).
Nutzt die Freistellung aus key_gruen.py (gleiche Regeln), aber: keine Skalierung, Zuschnitt auf alles
Nicht-Gruene (Figur + Requisiten) mit Rand, volle Aufloesung. Ergebnis: PNG mit Alpha fuer den
Hintergrund-Typ "figur" im Launcher (K20).
Aufruf: python3 -I key_figur.py <bild.jpg> <ziel.png> [--rand 24] [--voll]
Standard (seit 07:45): 256 Farben (Palette mit Alpha, ohne Dither) — flache Flaechen, ~1/8 der Groesse,
Kante unveraendert; --voll schreibt stattdessen das volle RGBA-PNG (ca. 1-2 MB je Figur).
"""
import sys, os, argparse, importlib.util
import cv2, numpy as np
hier = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('key_gruen', os.path.join(hier, 'key_gruen.py'))
kg = importlib.util.module_from_spec(spec); spec.loader.exec_module(kg)
ap = argparse.ArgumentParser(); ap.add_argument('bild'); ap.add_argument('ziel'); ap.add_argument('--rand', type=int, default=24); ap.add_argument('--voll', action='store_true')
a = ap.parse_args()
im = kg.key(a.bild)
al = im[:, :, 3]
ys, xs = np.where(al > 8)
y0, y1, x0, x1 = max(ys.min()-a.rand, 0), min(ys.max()+a.rand, im.shape[0]-1), max(xs.min()-a.rand, 0), min(xs.max()+a.rand, im.shape[1]-1)
out = im[y0:y1+1, x0:x1+1]
if a.voll:
    cv2.imwrite(a.ziel, out, [cv2.IMWRITE_PNG_COMPRESSION, 9])
else:
    from PIL import Image
    pil = Image.fromarray(out[..., [2, 1, 0, 3]], 'RGBA')
    pil.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(a.ziel, optimize=True)
# Restgruen-Messung: Pixel mit alpha>0, bei denen G deutlich ueber max(R,B) liegt
b, g, r = out[..., 0].astype(int), out[..., 1].astype(int), out[..., 2].astype(int)
sichtbar = out[..., 3] > 32
rest = sichtbar & (g - np.maximum(r, b) > 40)
print('geschrieben:', a.ziel, out.shape[1], 'x', out.shape[0], '| Quelle', im.shape[1], 'x', im.shape[0],
      '| Restgruen-Pixel:', int(rest.sum()), 'von', int(sichtbar.sum()), '| Bytes:', os.path.getsize(a.ziel))
