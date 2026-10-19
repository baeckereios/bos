/* ================================================================
   BäckereiOS · backzettel/backzettel_prompt.js — was die KI liest
   ================================================================
   Stellt bereit: window.BOS_BACKZETTEL_PROMPT

   HIER SCHÄRFT ULF DEN TEXT. Nach jeder Änderung FASSUNG hochzählen —
   jedes gespeicherte Tagesdokument trägt die Fassung (Feld promptFassung),
   so lässt sich später sagen, welcher Text welchen Tag gelesen hat.

   Inhalt:
     FASSUNG       Nummer des Prompts (Text + Schema)
     TEXT          Anweisung an die KI (system)
     NUTZER_TEXT   kurzer Satz nach dem Bild
     SCHEMA        JSON-Schema der Antwort (Structured Outputs,
                   output_config.format). Regeln der API: additionalProperties
                   false an JEDEM Objekt, keine minimum/maxLength, alle Felder
                   Pflicht, Unlesbares als null.
     BILD          Grenzen je Modellfamilie (lange Kante, Bildkacheln à 28 px)
     PREISE        US-$ je 1 Mio. Tokens, mit Datum (nur für die Kostenzeile)
     MODELLE       Auswahl unter ⚙ Gerät; Vorgabe bis zum Vergleichslauf
                   Sonnet 5.5 (Freigabe B7)

   Öffentliches Repo: KEINE Produktnamen, Mengen oder Kunden aus dem
   Betrieb im Text (die Beispiele sind erfunden).

   Warum Zahlen als TEXT: „1.170“ würde als JSON-Zahl leicht zu 1,17. BOS
   wandelt die Texte selbst nach deutschem Format um und rechnet nach
   (Bauplan Fund 6). Warum kein erzwungenes Werkzeug: Opus 5.5, Sonnet 5.5
   und Fable 5.1 lehnen tool_choice „tool“/„any“ mit Fehler 400 ab
   (Anthropic-Doku „Thinking“, gelesen 19.10.2026; Freigabe B1).

   CHANGELOG
     2026-10-19 · 17:32 · v1 · Erstfassung (Backzettel Stufe 1)
       SESSION_2026-10-19_BACKZETTEL_STUFE1_BAU.md, Freigabe KC 09:47.
       Ohne seitenGesamt (B8: auf den Zetteln steht nur „Seite 0001“),
       mit sorten (davon-Zeilen, Ulf U1 09:15).
   ================================================================ */
(function () {
  'use strict';

  var FASSUNG = 1;

  var TEXT = [
    'Du liest genau EINE fotografierte Seite eines Backzettels aus einer Bäckerei ab und gibst sie im vorgegebenen JSON-Format zurück.',
    'Du schreibst nur ab. Du rechnest nichts, du ergänzt nichts, du rätst nichts.',
    '',
    'KOPF DER SEITE',
    '- Oben links steht „Backzettel für <Wochentag> <Datum>“, zum Beispiel „Backzettel für Mi 07.01.2026“. Das ist der Backtag. Schreibe diese Zeile wörtlich in kopfText.',
    '- Oben rechts steht ein zweites Datum (Druckdatum). Das gehört NICHT in kopfText. Ignoriere es.',
    '- Die Abteilung (zum Beispiel Brötchen, Brote, Konditorei) steht im Kopf. Schreibe sie wörtlich in abteilung.',
    '- Die Seitennummer steht als „Seite 0001“ o. ä. im Kopf. Gib sie als Zahl in seite an (aus „Seite 0002“ wird 2).',
    '',
    'TABELLE — je Artikel eine Zeile in zeilen, in der Reihenfolge wie auf dem Papier, keine Zeile auslassen',
    '- artNr: die Artikelnummer, nur Ziffern, als Text, führende Nullen behalten.',
    '- name: der Artikelname so, wie er gedruckt ist.',
    '- anzahl: die Spalte „Anzahl“.',
    '- bleche: die Spalte „Bleche“.',
    '- charge: die Spalte „Menge Charge“.',
    '- Die Spalten „Einheit“ und „Differenz“ NICHT übernehmen.',
    '- ZAHLEN GENAU SO ABSCHREIBEN, WIE SIE GEDRUCKT SIND, als Text: mit Punkten und Kommas wie auf dem Papier (zum Beispiel "2.340" oder "12,75"). Nicht umrechnen, nicht runden, keine Einheiten anhängen.',
    '',
    '„DAVON“-ZEILEN',
    '- Unter manchen Zeilen (oft „GESAMT“) stehen eingerückte Zeilen „davon …“ mit einer Sorte und einer Menge.',
    '- Diese gehören in sorten der Zeile direkt darüber: art = Sorte wörtlich, anzahl = Menge als Text.',
    '- Daraus KEINE eigene Zeile machen. Hat eine Zeile keine davon-Zeilen, ist sorten null.',
    '',
    'KUNDE-BLOCK',
    '- Unter manchen Zeilen steht ein Block „Kunde: … Menge: … bestellt“.',
    '- Übernimm davon NUR die Menge, als Text, in kundeMenge. Kundennummer, Kundenname und Kommentartext NICHT übernehmen.',
    '- Ohne Kunde-Block ist kundeMenge null.',
    '',
    'WAS DU IGNORIERST',
    '- Alles Handschriftliche: Stift, Kugelschreiber, Haken, Striche, Durchstreichungen, Zahlen am Rand oder in leeren Spalten. Es zählt nur Gedrucktes.',
    '- Kommentarzeilen ohne Artikelnummer.',
    '- Summen: bilde keine.',
    '',
    'UNLESBARES',
    '- Ist ein Wert unlesbar, verdeckt, abgeschnitten oder verschmiert: setze das Feld auf null und unsicher auf true. Lieber null als geraten.',
    '- Schwankst du zwischen zwei Ziffern (zum Beispiel 3 oder 8): schreibe die wahrscheinlichere und setze unsicher auf true.',
    '- Ist die Zeile sicher gelesen, ist unsicher false.',
    '',
    'GESAMTURTEIL',
    '- lesbarkeit: "gut" (alles lesbar), "teilweise" (einzelne Stellen unlesbar oder ein Rand abgeschnitten), "schlecht" (die Seite ist insgesamt kaum lesbar).',
    '- hinweis: ein kurzer Satz, was fehlt oder schwierig war (zum Beispiel „unterer Rand abgeschnitten“), sonst null.',
    '- istBackzettel: false, wenn das Foto keinen solchen Backzettel zeigt. Dann ist zeilen eine leere Liste.'
  ].join('\n');

  var NUTZER_TEXT = 'Lies diese eine Seite ab.';

  function nullbar(typ) { return { type: [typ, 'null'] }; }

  var SORTE = {
    type: 'object', additionalProperties: false,
    required: ['art', 'anzahl'],
    properties: { art: nullbar('string'), anzahl: nullbar('string') }
  };

  var ZEILE = {
    type: 'object', additionalProperties: false,
    required: ['artNr', 'name', 'anzahl', 'bleche', 'charge', 'kundeMenge', 'sorten', 'unsicher'],
    properties: {
      artNr: nullbar('string'),
      name: nullbar('string'),
      anzahl: nullbar('string'),
      bleche: nullbar('string'),
      charge: nullbar('string'),
      kundeMenge: nullbar('string'),
      sorten: { anyOf: [{ type: 'null' }, { type: 'array', items: SORTE }] },
      unsicher: { type: 'boolean' }
    }
  };

  var SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['istBackzettel', 'kopfText', 'abteilung', 'seite', 'lesbarkeit', 'hinweis', 'zeilen'],
    properties: {
      istBackzettel: { type: 'boolean' },
      kopfText: nullbar('string'),
      abteilung: nullbar('string'),
      seite: nullbar('integer'),
      lesbarkeit: { type: 'string', enum: ['gut', 'teilweise', 'schlecht'] },
      hinweis: nullbar('string'),
      zeilen: { type: 'array', items: ZEILE }
    }
  };

  /* Bildgrenzen (Anthropic-Doku „Vision“, gelesen 19.10.2026): „Claude 4.7
     and later models“ 2576 px lange Kante / 4784 Bildkacheln à 28 × 28 px,
     alle anderen 1568 / 1568. Am Gerät wird genau auf die Grenze verkleinert,
     damit der Server nicht ein zweites Mal umrechnet (Bauplan Fund 4). */
  var BILD = {
    kachelPx: 28,
    hoch: { kante: 2576, kacheln: 4784 },
    standard: { kante: 1568, kacheln: 1568 },
    hochMuster: /^claude-(opus-4-[7-9]|(opus|sonnet|haiku|fable|mythos)-[5-9])/
  };
  function bildGrenzen(modell) {
    var m = String(modell || '');
    // Unbekannter Name: hohe Grenze — der Server verkleinert notfalls selbst.
    if (!/^claude-/.test(m) || BILD.hochMuster.test(m)) return { kante: BILD.hoch.kante, kacheln: BILD.hoch.kacheln, kachelPx: BILD.kachelPx };
    return { kante: BILD.standard.kante, kacheln: BILD.standard.kacheln, kachelPx: BILD.kachelPx };
  }

  /* US-$ je 1 Mio. Tokens (Modellübersicht, gelesen 19.10.2026). Haiku hat
     dort nur „ab“-Preise → ca: true, die Kostenzeile sagt „ca.“ (B7). */
  var PREISE = {
    stand: '19.10.2026',
    'claude-fable-5-1': { ein: 10, aus: 50 },
    'claude-opus-5-5': { ein: 4, aus: 20 },
    'claude-sonnet-5-5': { ein: 2, aus: 10 },
    'claude-haiku-5-5': { ein: 0.10, aus: 0.50, ca: true }
  };

  var MODELLE = [
    { name: 'claude-haiku-5-5', label: 'Haiku 5.5 (klein, günstig)' },
    { name: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (mittel)' },
    { name: 'claude-opus-5-5', label: 'Opus 5.5 (groß)' }
  ];
  var MODELL_VORGABE = 'claude-sonnet-5-5';
  var GRUENDLICHKEIT = ['low', 'medium', 'high'];
  var GRUENDLICHKEIT_VORGABE = 'medium';

  window.BOS_BACKZETTEL_PROMPT = {
    FASSUNG: FASSUNG, TEXT: TEXT, NUTZER_TEXT: NUTZER_TEXT, SCHEMA: SCHEMA,
    BILD: BILD, bildGrenzen: bildGrenzen, PREISE: PREISE,
    MODELLE: MODELLE, MODELL_VORGABE: MODELL_VORGABE,
    GRUENDLICHKEIT: GRUENDLICHKEIT, GRUENDLICHKEIT_VORGABE: GRUENDLICHKEIT_VORGABE
  };
})();
