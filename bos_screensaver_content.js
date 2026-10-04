/* ================================================================
   BOS Screensaver — Inhalts-Pool
   ================================================================
   Reine Daten, keine Logik (siehe bos_screensaver.js für die Anzeige-
   Mechanik). Single-Writer-Datei — Ulf pflegt das, analog zu
   produkt_config.json. Kategorie-Labels leben bewusst NICHT hier
   drin (Präsentations-Detail, nicht Inhalt), sondern als Lookup in
   bos_screensaver.js.

   Herkunft: "witz"-Einträge aus Backstube/Nachtschicht/Konditorei/
   Verkauf stammen von Ulf (03.09.2026). "fakt"/"spruch"/"emoji"
   von Claude als Auflockerung dazwischen.

   Neue Einträge einfach unten anhängen — kategorie muss einer der
   Werte sein, die BOS_SCREENSAVER_LABELS in bos_screensaver.js kennt,
   sonst fehlt die kleine Überschrift im Overlay (fällt aber nicht
   hart, siehe dortiger Fallback).
   ================================================================ */
window.BOS_SCREENSAVER_CONTENT = [

  /* ---------- Backstube ---------- */
  { kategorie: 'backstube', text: 'Was macht der Bäcker, wenn er kein Geld hat? Er backt kleine Brötchen.' },
  { kategorie: 'backstube', text: 'Treffen sich zwei Rosinen. Sagt die eine: „Warum hast du einen Helm auf?" Sagt die andere: „Ich muss gleich in den Stollen!"' },
  { kategorie: 'backstube', text: 'Welches Handwerk ist das brutalste? Der Bäcker. Er schlägt Sahne, knetet Teig und zieht Strudel aus.' },
  { kategorie: 'backstube', text: 'Warum weint der Teig? Weil der Bäcker ihm eine geklebt hat.' },
  { kategorie: 'backstube', text: 'Was ruft das Brötchen im Stau? „Hilfe, ich steck in der Klemme!"' },
  { kategorie: 'backstube', text: 'Was ist das Lieblingslied von Bäckern? „Bake me up before you go-go!"' },
  { kategorie: 'backstube', text: 'Wie nennt man ein mehlfreies Brot? Luft.' },
  { kategorie: 'backstube', text: 'Was sagt der Meister zum Lehrling, wenn das Blech runterfällt? „Da haben wir uns wohl verkrümelt."' },
  { kategorie: 'backstube', text: 'Warum arbeiten Bäcker nachts? Weil der Teig tagsüber zu schüchtern zum Aufgehen ist.' },
  { kategorie: 'backstube', text: 'Ein Croissant zum anderen: „Lass dich nicht so hängen!"' },

  /* ---------- Nachtschicht ---------- */
  { kategorie: 'nachtschicht', text: 'Die 3 Phasen der Nachtschicht: 1. Motivation. 2. Existenzkrise am Teigkneter. 3. Zombie-Modus mit Zuckerguss.' },
  { kategorie: 'nachtschicht', text: 'Wenn der Wecker um 1:30 Uhr klingelt, frage ich mich jedes Mal ernsthaft, ob die Menschheit nicht einfach Toastbrot essen könnte.' },
  { kategorie: 'nachtschicht', text: 'Mein Schlafrhythmus ist so im Eimer, ich sag um 14 Uhr „Guten Morgen" und um 3 Uhr nachts „Mahlzeit".' },
  { kategorie: 'nachtschicht', text: '„Hast du Augenringe?" – „Nein, das ist nur der Schattenwurf von meinem mehligen Gesicht."' },
  { kategorie: 'nachtschicht', text: 'In der Backstube gibt es zwei Aggregatzustände: „Alles unter Kontrolle" und „Wo zur Hölle ist das Blech mit den Laugenstangen hin?!"' },
  { kategorie: 'nachtschicht', text: 'Der Moment, wenn der Teig nicht aufgeht und du ihn anstarrst, als hätte er dich gerade persönlich beleidigt.' },
  { kategorie: 'nachtschicht', text: 'Rezept für die perfekte Schicht: 10 % Talent, 20 % Mehl, 70 % Kaffee.' },
  { kategorie: 'nachtschicht', text: 'Wenn der Sauerteig im Kühlhaus mehr Zuneigung, Pflege und Aufmerksamkeit bekommt als das eigene Sozialleben.' },
  { kategorie: 'nachtschicht', text: 'Backstuben-Regel Nr. 1: Es gibt kein optisches Problem, das sich nicht mit einem guten Spritzer Kuvertüre oder Puderzucker überdecken lässt.' },
  { kategorie: 'nachtschicht', text: 'Ich bin nicht nachtragend. Ich speichere nur Fehler im internen Rezeptbuch ab, damit sie mir nicht nochmal passieren.' },

  /* ---------- Konditorei ---------- */
  { kategorie: 'konditorei', text: 'Was ist ein Keks unterm Baum? Ein schattiges Plätzchen.' },
  { kategorie: 'konditorei', text: 'Kalorien sind diese kleinen Tierchen, die nachts in der Konditorei die Arbeitskleidung enger nähen.' },
  { kategorie: 'konditorei', text: '„Ich mache eine Diät. Ich esse jetzt nur noch zuckerfreie Torte." – „Das nennt man Brot."' },
  { kategorie: 'konditorei', text: 'Eine Hochzeitstorte zu backen ist wie Hausbau – nur dass das Haus am Ende von der Verwandtschaft gegessen wird.' },
  { kategorie: 'konditorei', text: 'Marzipan spaltet die Menschheit in zwei Lager: Die, die es lieben, und die, die falsch liegen.' },
  { kategorie: 'konditorei', text: 'Die wichtigste Fähigkeit beim Torten-Verzieren: Nicht in Panik zu geraten, wenn der Spritzbeutel platzt.' },
  { kategorie: 'konditorei', text: 'Ich wollte eigentlich abnehmen, aber die Torte auf dem Tresen hat „Iss mich!" gerufen. Und ich bin nun mal sehr höflich.' },
  { kategorie: 'konditorei', text: 'Warum sind Pralinen so teuer? Weil sie eine anerkannte Therapieform für die Seele sind.' },
  { kategorie: 'konditorei', text: 'Liebe geht durch den Magen, aber Buttercreme nimmt die Abkürzung direkt auf die Hüfte.' },
  { kategorie: 'konditorei', text: 'Konditor-Liebeserklärung: „Du bist das Sahnehäubchen auf meinem Lebkuchenherz."' },

  /* ---------- Verkauf ---------- */
  { kategorie: 'verkauf', text: 'Kunde: „Ich hätte gerne ein Brot." – Verkäuferin: „Welches denn?" – Kunde: „Na, ein normales!"' },
  { kategorie: 'verkauf', text: 'Kunde: „Haben Sie heute frische Brötchen?" – Verkäuferin: „Nein, wir haben die von letzter Woche nochmal aufpoliert."' },
  { kategorie: 'verkauf', text: '„Haben die Dinkelbrötchen auch Dinkel drin?" – „Nein, das ist nur der Vorname von unserem Lehrling."' },
  { kategorie: 'verkauf', text: 'Wenn der Kunde 5 Minuten überlegt, was er will, die ganze Schlange blockiert und dann sagt: „Ein normales Hörnchen, bitte."' },
  { kategorie: 'verkauf', text: '„Geben Sie mir bitte das Brötchen da hinten links. Nein, das rechts daneben. Das ein bisschen dunkler ist." – Jeden. Tag.' },
  { kategorie: 'verkauf', text: 'Der klassische Samstagmorgen: „Das macht 14,80 Euro." – „Warten Sie, ich hab\'s passend!" (Kramt 8 Minuten lang nach 2- und 5-Cent-Stücken).' },
  { kategorie: 'verkauf', text: 'Kunde: „Haben Sie noch Croissants?" (Blech komplett leer, Schild „Croissants" hängt noch dran) – Verkäuferin: „Die sind gerade als Tarnkappen-Gebäck unterwegs."' },
  { kategorie: 'verkauf', text: 'Du reinigst die Kaffeemaschine blitzblank – und exakt eine Sekunde später bestellt jemand einen Latte Macchiato. Ein ungeschriebenes Naturgesetz.' },
  { kategorie: 'verkauf', text: 'Wenn ein Kunde fragt, ob das Gebäck vegan, glutenfrei, zuckerfrei und laktosefrei ist: „Ja, haben wir da. Wir nennen es Leitungswasser."' },
  { kategorie: 'verkauf', text: 'Kunde: „Ist der Kuchen von heute?" – Verkäuferin: „Nee, von morgen, wir sind unserer Zeit einfach voraus."' },

  /* ---------- Fakten ---------- */
  { kategorie: 'fakt', text: 'Honig verdirbt praktisch nie – archäologisch gefundener, Jahrtausende alter Honig war noch genießbar. 🍯' },
  { kategorie: 'fakt', text: 'Der Geruch von frischem Brot aktiviert im Gehirn ähnliche Bereiche wie Musik, die man mag.' },
  { kategorie: 'fakt', text: 'Sauerteig kann theoretisch unbegrenzt am Leben gehalten werden – manche Kulturen sind über 100 Jahre alt.' },
  { kategorie: 'fakt', text: 'Das Wort „Croissant" bedeutet auf Französisch schlicht „Halbmond" – wegen der Form, nicht wegen des Geschmacks.' },
  { kategorie: 'fakt', text: 'Zimt zählt zu den ältesten bekannten Gewürzen der Menschheit – Spuren finden sich schon im alten Ägypten.' },
  { kategorie: 'fakt', text: 'Ein Brotlaib verliert in den ersten Stunden nach dem Backen den meisten Wasserdampf – daher schmeckt er frisch am besten.' },

  /* ---------- Sprüche ---------- */
  { kategorie: 'spruch', text: 'Ein Lächeln kostet nichts und verkauft alles. 😊' },
  { kategorie: 'spruch', text: 'Gute Laune ist ansteckend – steck heute mal jemanden an.' },
  { kategorie: 'spruch', text: 'Der frühe Bäcker fängt den Umsatz. 🥐' },
  { kategorie: 'spruch', text: 'Nicht jeder Tag ist gut, aber in jedem Tag steckt was Gutes.' },
  { kategorie: 'spruch', text: 'Frisch aus dem Ofen, frisch im Kopf.' },
  { kategorie: 'spruch', text: 'Danke, dass ihr die Stadt jeden Tag aufweckt.' },

  /* ---------- Emoji-Kombos ---------- */
  { kategorie: 'emoji', text: '☀️🥐☕ Guten Morgen, Team!' },
  { kategorie: 'emoji', text: '💪🍞✨ Ihr backt das schon.' },
  { kategorie: 'emoji', text: '🌙🥖😴 Nachtschicht-Gang.' },
  { kategorie: 'emoji', text: '🎂🕯️😋 Süßes für die Seele.' }
];
