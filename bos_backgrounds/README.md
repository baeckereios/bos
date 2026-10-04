# bos_backgrounds/

Hier liegen die Bilddateien für die Hintergrund-Auswahl im Launcher.

## Ablauf

1. Bild hier in diesen Ordner legen (JPG oder WebP, Querformat, ~1920×1080, nach Möglichkeit unter ~800 KB)
2. Eintrag in `bos_launcher_backgrounds.js` (eine Ebene höher) ergänzen:
   ```js
   { id: 'nachtschicht', name: 'Nachtschicht', file: 'bos_backgrounds/nachtschicht.jpg' }
   ```
3. Fertig — taucht automatisch als Vorschau-Kachel in den Launcher-Einstellungen auf, neben den eingebauten CSS-Hintergründen (Ofenkohle/Glut/Verlauf/Mehlstaub/Kachelraster)

## Warum ein eigener Ordner statt direkt reinkopieren?

Gleiches Muster wie überall sonst im System: Daten (hier: Bilder) getrennt von Code, ein Schreiber (du), viele Leser (jedes Gerät, das den Launcher lädt). `bos_launcher_backgrounds.js` ist die Liste, dieser Ordner ist der Inhalt.

## Bild-Empfehlungen

- **Querformat** — der Launcher läuft nur im Querformat (siehe Drehsperre)
- **Eher dunkel/gedeckt.** Der Launcher legt automatisch einen leichten dunklen Schleier über jedes Bild, damit Icons und Text lesbar bleiben — ein von Grund auf sehr helles oder unruhiges Bild wirkt aber trotzdem ablenkend
- **Nicht zu groß.** ~1920×1080 reicht für ein Tablet-Display völlig, größere Dateien laden nur langsamer

## Prompt-Ideen (für Gemini/ImageFX oder ähnliche Tools)

- *"Dunkles, stimmungsvolles Foto einer Backstube nachts, warmer Ofenschein im Hintergrund, mehlbestäubte Arbeitsfläche, cineastisches Licht, Querformat, kein Text, keine Personen"*
- *"Abstrakter dunkler Hintergrund, tiefe warme Braun-Schwarz-Töne, sanfter Glutschimmer, minimalistisch, Querformat, geeignet als Tablet-Hintergrund, kein Text"*
- *"Leeres Gärregal in einer dunklen Backstube nachts, warme Lichtstreifen, cineastisch, Querformat, minimal, keine Personen, kein Text"*
- *"Makroaufnahme von Mehlstaub auf dunklem Holz, warmes Seitenlicht, stimmungsvoll, Querformat, unscharfer Hintergrund, kein Text"*
