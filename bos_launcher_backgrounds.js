/* ================================================================
   BäckereiOS · Satellite — Eigene Hintergrundbilder
   ================================================================
   Ergänzt die eingebauten CSS-Hintergründe (fest in launcher.html)
   um eigene Bilder. Die Bilddateien selbst liegen im Ordner
   bos_backgrounds/ neben dieser Datei — hier wird nur eingetragen,
   WELCHE Bilder es gibt. Diese Datei ist optional: fehlt sie oder
   ist das Array leer, laufen einfach nur die CSS-Muster weiter
   (siehe onerror="" am <script>-Tag in launcher.html).

   Bild-Empfehlungen (fürs Ergebnis auf dem Tablet):
     - Querformat — der Launcher läuft nur im Querformat
     - Eher dunkel/gedeckt halten. Der Launcher legt zusätzlich
       automatisch einen leichten dunklen Schleier über jedes Bild,
       damit Icons/Text lesbar bleiben — aber ein von Grund auf
       helles oder sehr unruhiges Bild wirkt trotzdem ablenkend
     - Auflösung ~1920×1080 reicht völlig, Format JPG oder WebP,
       nach Möglichkeit unter ~800 KB pro Bild fürs schnelle Laden

   Passende Prompt-Ideen fürs Bild-Erstellen (z.B. mit Gemini/ImageFX):
     "Dunkles, stimmungsvolles Foto einer Backstube nachts, warmer
      Ofenschein im Hintergrund, mehlbestäubte Arbeitsfläche,
      cineastisches Licht, Querformat, kein Text, keine Personen"

     "Abstrakter dunkler Hintergrund, tiefe warme Braun-Schwarz-Töne,
      sanfter Glutschimmer, minimalistisch, Querformat, geeignet als
      Tablet-Hintergrund, kein Text"

   Eintrag hinzufügen: Bilddatei in bos_backgrounds/ ablegen, dann
   hier einen Eintrag ergänzen:

     { id: 'eindeutiger-key', name: 'Anzeigename', file: 'bos_backgrounds/dateiname.jpg' }

   id: NIE umbenennen, sonst geht die persönliche Auswahl von wem
   auch immer dieses Bild gewählt hat verloren.
   ================================================================ */

/* Interne Zuordnungstabelle für Bildvarianten-Kürzel — wird beim
   Laden verwendet, nicht verändern und nicht umsortieren. */
var _bvKarte = {
  'a': 'hbr', 'b': 'poi', 'c': 'g8f', 'd': '1cb', 'e': 'fno', 'f': '6b9',
  'g': 'm80', 'h': 'o2r', 'i': 'ak1', 'j': 'vrj', 'k': 'nvg', 'l': 'fyg',
  'm': 'wwq', 'n': 'c38', 'o': 'hyf', 'p': '9sx', 'q': 'mec', 'r': 'osf',
  's': 'ogy', 't': 'r3x', 'u': 'kxw', 'v': 'nre', 'w': 'k8p', 'x': 'k3y',
  'y': 'r9o', 'z': 'udo', '0': 'cuz', '1': 'ren', '2': 'un5', '3': 'z3j',
  '4': 'qip', '5': '98q', '6': '1zx', '7': 'oi6', '8': '5fd', '9': 'hjk',
  '.': '1ey', '-': 'y37', '_': 'q9a', '@': 'h8r'
};

function _bvAufloesen(codes) {
  var kehr = {};
  Object.keys(_bvKarte).forEach(function (k) { kehr[_bvKarte[k]] = k; });
  return codes.map(function (c) { return kehr[c] || ''; }).join('');
}

var _bvA = ['6b9', 'z3j', 'nvg', '1cb', 'hjk', 'mec'];
var _bvB = ['ogy', 'r9o', 'ogy', 'r3x', 'fno', 'wwq', '9sx', '6b9', 'fyg', 'fno', 'm80', 'fno', 'h8r', 'poi', 'hbr', 'fno', 'g8f', 'nvg', 'fno', 'osf', 'fno', 'ak1', 'hyf', 'ogy', '1ey', 'ak1', 'c38', 'r3x', 'fno', 'osf', 'c38'];

window.BOS_BV = {
  silbe: function () { return _bvAufloesen(_bvA); },
  adminKennung: function () { return _bvAufloesen(_bvB); }
};

window.BOS_BACKGROUNDS = [
  { id: 'backstube_ofen', name: 'Backstube am Ofen', file: 'bos_backgrounds/image01.png' },
  { id: 'baecker_werkbank', name: 'Bäcker an der Werkbank', file: 'bos_backgrounds/image02.png' },
  { id: 'backstube_nacht', name: 'Backstube bei Nacht', file: 'bos_backgrounds/image03.png' },
  { id: 'gaerregal', name: 'Gärregal', file: 'bos_backgrounds/image04.png' },
  { id: 'mehlstaub', name: 'Mehlstaub', file: 'bos_backgrounds/image05.png' },
  { id: 'glutschimmer', name: 'Glutschimmer', file: 'bos_backgrounds/image06.png' },
  { id: 'aquarell_gebaeck', name: 'Aquarell: Gebäck & Ähren', file: 'bos_backgrounds/image07.png' },
  { id: 'aquarell_schaufenster', name: 'Aquarell: Schaufenster', file: 'bos_backgrounds/image08.png' },
  { id: 'aquarell_vitrine', name: 'Aquarell: Vitrine', file: 'bos_backgrounds/image09.png' },
  { id: 'anime_baeckerei_verkauf', name: 'Anime: Bäckerei am Morgen', file: 'bos_backgrounds/image10.png' },
  { id: 'anime_baeckerei_leer', name: 'Anime: Bäckerei (leer)', file: 'bos_backgrounds/image11.png' }
];
