/* ============================================================
   bos_stikken.js — BäckereiOS Stikken-Verteilung (Rechenteil)
   ------------------------------------------------------------
   Verteilt abzusetzende Bleche als VORSCHLAG in Stikken (der Stikken:
   hoher Wagen mit Rollen, in den die Bleche auf Schienen geschoben
   werden, 24 Fächer) und zeichnet die Verteilung für den Druckzettel.
   Jeder Stikken bekommt einen Buchstaben; den schreibt die Frühschicht
   auf Kreppband an den echten Stikken, so passen Zettel und Wagen
   zusammen. Seit Stufe 2 auch der Reste-Stikken: alte Bleche, die noch
   im Froster stehen, werden abgezogen („Benötigt − Rest = Absetzen“),
   und die Frühschicht füllt ihn auf.

   EIN Rechenteil für alle Formulare (Ulf 08.11.2026, 06:46: „So kann
   ich, wenn ich wollte, alles ergänzen“). Heute zwei Aufrufer:
   druckzentrale/fruehschicht_formular.html, druckzentrale/absetz_formular.html.
   Kein Firebase, kein DOM, kein Datum — in Node mit require() testbar
   (_PRUEF_stikken.js).

   Einbindung (Satellit, eine Ebene unter Root):
     <script src="../bos_stikken.js"></script>

   SCHNITTSTELLE
     BOS_STIKKEN.FAECHER_STANDARD   24
     BOS_STIKKEN.STIKKEN_JE_SEITE    6  (Säulen je Blatt, der Reste-Stikken zählt mit)

     BOS_STIKKEN.verteile(posten, optionen) → stikken[]     (Stufe 1, unverändert)
       posten:   [{ kennung, name, bleche, tag, tagLabel? }] in Formularreihenfolge
                 bleche: ganze Zahl ≥ 0 oder Text nur aus Ziffern ("7");
                 '' / null / undefined / nur Leerzeichen = leer → fällt weg; 0 fällt weg.
       optionen: { faecher: 24 }   (ganze Zahl ≥ 1)
       Rückgabe: [{ buchstabe, tag, tagLabel, faecher,
                    belegung: [{ kennung, name, bleche, vonFach, bisFach }], frei }]
       Fehler (Error mit Klartext): ungültige Bleche (Sorte + Wert), fehlende
       kennung/name/tag, dieselbe Kennung zweimal an einem Tag, ein Tag mit
       zwei verschiedenen tagLabel, ungültige faecher, mehr als 26 Stikken.

     BOS_STIKKEN.plane(posten, optionen) → plan             (Stufe 2, ruft verteile())
       posten:   wie verteile(); bleche = „benötigt“
       optionen: { faecher,
                   rest: { bleche: { <kennung>: n }, fremd: { text, faecher } },
                   tage: { <tag>: { titel: 'Sonntag, 15.11.', name: 'Sonntag' } } }
                 rest gilt immer für den ERSTEN Tag in posten (Ulf R5).
       Rückgabe: { faecher,
                   posten:  [{ kennung, name, tag, will, rest, setztAb, mehrAlsGewollt }],
                   stikken: [frische Stikken wie verteile(), Buchstaben neu A…],
                   reste:   null | { tag, tagLabel, faecher,
                                     alt:   [{ kennung, name, bleche, vonFach, bisFach }],
                                     fremd: null | { text, faecher, vonFach, bisFach },
                                     neu:   [{ kennung, name, bleche, vonFach, bisFach }], frei },
                   tage:    [{ tag, tagLabel, titel, name, reste, stikken }],
                   hinweise: [Texte nur fürs Formular], trennungen: { kennung: 'A|b' },
                   trennungHinweise: [falsche Trennstellen, nur fürs Formular] }
       Zusätzliche Fehler: Rest oder Fremd-Fächer ungültig (Feld + Wert), Rest
       für eine Sorte, die am ersten Tag nicht in posten steht, alte Bleche +
       Fremdbelegung über der Fächerzahl.

     BOS_STIKKEN.restHinweis(postenAusPlan) → Text neben der Zahl ('' ohne Rest)
     BOS_STIKKEN.hinweisHTML(plan | stikken) → eine Zeile für Seite 1
     BOS_STIKKEN.zeichneHTML(plan | stikken, { kopfzeile }) → Blätter ab Seite 2
       ('' wenn nichts zu zeichnen). kopfzeile = Formularname, Datum, Uhrzeit
       (der Aufrufer liefert sie, damit das Rechenteil keine Uhr kennt).
     BOS_STIKKEN.zeichneHTML(plan, { kopfzeile, messen })  (seit 2a): messen(text, pt,
       gewicht) → Breite in mm (Formular: Canvas mit SCHRIFT); ohne messen wird geschätzt
     posten[].trennung (seit 2a, optional): Trennstellen „Schoko|croissants“ aus
       druckzentrale_sorten.js; nur für die Zeichnung, falsche → ignoriert + Hinweis
     BOS_STIKKEN.SCHRIFT, SCHRIFT_MIN_PT → Schriftangabe der Abschnitte, Untergrenze 6,5 pt
     BOS_STIKKEN.DRUCK_TEXTE → { de, en, tr, vi }: ALLE Drucktexte an einer Stelle
     BOS_STIKKEN.DRUCK_CSS   → für extraCSS von BOS_DRUCK.drucken()

   REGELN STUFE 1 (Ulf 08.11.2026, 06:43–06:49; Kompendium STIKKEN_VERTEILUNG §2)
     1. Tage nie mischen, Tage in der Reihenfolge ihres ersten Auftauchens.
     2. Innerhalb eines Tages dürfen Sorten gemischt werden.
     3. Eine Sorte wird nicht auf zwei Stikken geteilt — lieber Fächer frei.
        Ausnahme: mehr Bleche als Fächer → zuerst volle Stikken, der REST
        wird wie eine eigene Menge verteilt, und zwar nach SEINER Größe
        einsortiert (Freigabe KC 10.11., 07:57).
     4. Verfahren: Reste und kleine Sorten nach Blechen absteigend (Gleichstand:
        Formularreihenfolge), jede in den ersten Stikken des Tages, in den sie
        ganz passt, sonst ein neuer. Vorhersagbar statt minimal.
     5. Fach 1 ist oben, belegt in der Reihenfolge des Hineinlegens, freie
        Fächer unten.
     6. Buchstaben A–Z über alle Tage durch; je Tag erst die vollen, dann
        die gemischten Stikken.

   REGELN STUFE 2 (Ulf 13./14.11.2026 R1–R12; Anweisung KC 14.11., 05:46 §6)
     7. setzt ab = max(0, benötigt − Rest), nur am ersten Tag.
     8. „setzt ab“ wird GENAU wie Stufe 1 verteilt (verteile()).
     9. Einen Reste-Stikken gibt es nur ab einem alten Blech (R12). Danach
        wird HÖCHSTENS EIN frischer Stikken des ersten Tages aufgelöst: der am
        wenigsten gefüllte (Gleichstand: der zuletzt angelegte), wenn sein
        Inhalt GANZ in die freien Fächer passt (Fächer − alt − Fremd) und
        danach mindestens ein frischer bleibt. Frisch geht vor (R4).
    10. Reste-Stikken: kein Buchstabe, steht als erste Säule auf dem Blatt
        seines Tages. Von oben: ALT, Fremdbelegung, NEU, frei (die echte Lage
        von ALT und Fremd kennt das System nicht).

   ZEICHNUNG
     Immer ab einer neuen Seite (Ulf 10.11., 07:50). Jeder Tag auf eigenen
     Blättern (R7), höchstens 6 Säulen je Blatt, darüber ein weiteres Blatt
     desselben Tages. Mit tage[...].titel steht der Tag groß oben. Jedes
     Blatt trägt die Kopfzeile des Aufrufers — bos_druck.js wiederholt Kopf
     und Fuß NICHT (im Fluss), und @page hat margin 0: deshalb bringt jedes
     Blatt seinen oberen Rand (12 mm) selbst mit. Nur Grau und Schwarz;
     ALT, Fremd und NEU unterscheiden sich im MUSTER (gestrichelt dunkel /
     schraffiert / hell), damit Graustufen nichts verwischen.
     Froster-Zeile (Stufe 3): Haben mindestens zwei Tage Stikken und alle
     einen tage[...].name, steht unter dem Tagestitel die Reihenfolge im
     Froster („… vorn · … dahinter · … ganz hinten“), der Tag des Blatts
     fett. Die Reihenfolge ist die der Tage in posten.
     Stellschrauben: FACH_MAX_MM, RASTER_MAX_MM, TAGTITEL_MM, FROSTER_MM,
     LEGENDE_MM, STIKKEN_JE_SEITE, DRUCK_TEXTE, Breiten/Schriften in DRUCK_CSS.

   ÜBERSETZUNGEN: Die TR- und VI-Texte in DRUCK_TEXTE sind ENTWÜRFE des
   Kontroll-Chats (14.11.2026) und noch NICHT von Kollegen gegengelesen
   (Kompendium O9). EN ebenfalls Entwurf. Backstuben-Wörter (Froster,
   Stikken, ALT, NEU) bleiben deutsch.

   TRENNUNG (Stufe 2a, Ulf 14.11., 06:43: „Silbentrennung ist für mich wichtig“)
     Keine automatische Silbentrennung mehr. Umbruch nur an den Trennstellen
     der Sortenliste (weiches Trennzeichen, Strich nur beim Umbruch), nach
     Bindestrichen und an Leerzeichen. Passt ein Teilstück nicht, wird die
     Schrift des Abschnitts in 0,5-pt-Schritten kleiner, bis SCHRIFT_MIN_PT;
     erst dann darf ein Wort frei brechen. Gleichartige Abschnitte eines Blatts
     (Namen großer frischer Abschnitte / kleiner frischer / im Reste-Stikken)
     bekommen dieselbe, die kleinste nötige Größe (G3). Zahlen bleiben groß.

   CHANGELOG
     2026-11-14 · 08:19 · v2.2 · Feature
       Stufe 3 (Samstag im Absetz-Formular): Froster-Zeile unter dem
       Tagestitel, „Im Froster: Samstag vorn · Sonntag dahinter · Montag ganz
       hinten“, der Tag des Blatts fett. Nur wenn mindestens zwei Tage Stikken
       haben und jeder davon einen Namen in tage hat (H1); Reihenfolge = die
       der Blätter, kein Wochentag fest eingebaut. Neue Stellschraube
       FROSTER_MM (5) im Höhenbudget. Texte nur DRUCK_TEXTE.de. verteile(),
       plane() und alle Rechenregeln unverändert.
       Anweisung KC 14.11., 07:55; Go 08:05 (H1–H3).
       SESSION_2026-11-14_STIKKEN_SAMSTAG_BAU.md
     2026-11-14 · 07:19 · v2.1 · Feature
       Stufe 2a: Trennung nur an festen Stellen (U+00AD aus posten.trennung,
       hyphens: manual), Schriftgröße je Abschnitt aus Messung (Option
       messen, sonst Schätzung) mit 5 % Zuschlag, gleiche Größe je Kategorie
       und Blatt, bst-frei erst unter 6,5 pt; SCHRIFT als Konstante;
       falsche Trennung → plan.trennungHinweise statt Fehler (G1). Sonderfall „enge
       Schrift im Reste-Stikken bei 5–6 Säulen“ entfällt (geht darin auf).
       Wortlaut „mehr als benötigt“ statt „gewollt“. verteile() und die
       Ergebnisse von plane() unverändert.
       Anweisung KC 14.11., 06:50; Go 07:00 (G1–G3).
       SESSION_2026-11-14_STIKKEN_2A_BAU.md
     2026-11-14 · 06:23 · v2.0 · Feature
       Stufe 2: plane() mit Rest, Reste-Stikken, Fremdbelegung, Auflösen
       höchstens eines frischen Stikkens; restHinweis(); ein Tag je Blatt
       mit Tagestitel; Legende ALT/NEU und „Steht im Froster“ in DE/EN/TR/VI;
       DRUCK_TEXTE; Hinweiszeile ohne Seitenzahl („auf eigenem Blatt“);
       Begriff „der Stikken“ („an den Stikken“). verteile() unverändert;
       Zahlenprüfung in alsGanzzahl() ausgelagert (gleiches Verhalten).
       Anweisung KC 14.11., 05:46 (Fassung 3), Go 06:02 (F1–F6).
       SESSION_2026-11-14_STIKKEN_REST_BAU.md
     2026-11-10 · 08:13 · v1.0 · Feature
       Erstfassung (Stikken-Verteilung, Anweisung KC 08.11., 06:52,
       Go mit Auflagen 10.11., 07:57).
       SESSION_2026-11-08_STIKKEN_VERTEILUNG_BAU.md
   ============================================================ */

(function (global) {
  'use strict';

  var FAECHER_STANDARD = 24;
  var STIKKEN_JE_SEITE = 6;
  var MAX_STIKKEN = 26;          // A–Z
  /* Höhenbudget je Blatt (A4 297 mm, margin 0): 12 mm eigener Rand oben,
     ~21 mm Kopfzeile/Titel/Hinweis, ~22 mm Stikkenkopf, Raster ≤ 192 mm,
     danach auf dem letzten Blatt Fuß von bos_druck.js (~20 mm) und
     Innenabstand unten (12 mm) → ~279 mm. Tagestitel und Legende nehmen
     ihre Höhe vom Raster. Ausgemessen in den Prüfbildern (Seitenzahl). */
  var FACH_MAX_MM = 8;
  var RASTER_MAX_MM = 192;
  var TAGTITEL_MM = 11;
  var LEGENDE_MM = 19;
  var FROSTER_MM = 5;            // Stufe 3: Zeile „Im Froster: … vorn · … dahinter“ unter dem Tagestitel
  /* Stufe 2a: Schrift der Abschnitte EINMAL hier (G2) — DRUCK_CSS und die
     Messfunktion der Formulare benutzen dieselbe Angabe. */
  var SCHRIFT = '"Roboto Condensed","sans-serif-condensed","Arial Narrow",Arial,sans-serif';
  var SCHRIFT_MIN_PT = 6.5;       // Untergrenze, erst darunter darf ein Wort frei brechen
  var SCHRIFT_SCHRITT = 0.5;
  var SCHAETZ_FAKTOR = 0.58;      // Rückfall ohne Messfunktion: Breite je Zeichen × Schriftgröße (eher zu breit)
  var SCHAETZ_FAKTOR_FETT = 0.63;
  var MESS_ZUSCHLAG = 1.05;       // + 5 % auf jede Breite: Druck und Bildschirm runden verschieden (G2)

  /* ALLE Drucktexte an einer Stelle. de vollständig; en/tr/vi nur die
     mehrsprachigen Zeilen (Ulf R9, Anweisung §5.8). TR/VI/EN: Entwürfe,
     NICHT gegengelesen (siehe Dateikopf). */
  var SPRACHEN = ['de', 'en', 'tr', 'vi'];
  var DRUCK_TEXTE = {
    de: {
      titel: 'Stikken-Verteilung (Vorschlag)',
      kreppband: 'Buchstabe auf Kreppband an den Stikken · Fach 1 ist oben · freie Fächer bleiben unten',
      blatt: 'Blatt {n} von {m}',
      hinweisEinBlatt: 'Stikken-Verteilung: auf eigenem Blatt',
      hinweisBlaetter: 'Stikken-Verteilung: auf eigenen Blättern',
      hinweisFuer: ' für {tage}',
      und: ' und ',
      keineBleche: 'Stikken: keine Bleche zum Absetzen.',
      restKopf: 'Rest',
      alt: 'ALT',
      neu: 'NEU',
      restPlus: '+{n} alte im Reste-Stikken',
      restReicht: 'Reste-Stikken reicht ({n} mehr als benötigt)',
      fremdOhneAlt: 'Reste-Stikken zählt erst ab einem alten Blech',
      faecherFehlen: 'Fächer fehlen',
      trennungFalsch: 'Trennstellen bei „{name}“ passen nicht zum Namen und werden ignoriert',
      stehtImFroster: 'Steht im Froster',
      legende: 'ALT = steht schon drin · NEU = kommt dazu',
      /* Stufe 3: Reihenfolge im Froster (Ulf S3, nur Deutsch) */
      frosterZeile: 'Im Froster: {liste}',
      frosterVorn: '{tag} vorn',
      frosterDahinter: '{tag} dahinter',
      frosterGanzHinten: '{tag} ganz hinten',
      frosterTrenner: ' · '
    },
    en: { stehtImFroster: 'In the Froster',       legende: 'ALT = already inside · NEU = add' },
    tr: { stehtImFroster: "Froster'da duruyor",   legende: 'ALT = zaten içinde · NEU = eklenecek' },
    vi: { stehtImFroster: 'Đang ở trong Froster', legende: 'ALT = đã có sẵn bên trong · NEU = thêm vào' }
  };
  SPRACHEN.forEach(function (s) { if (Object.freeze) Object.freeze(DRUCK_TEXTE[s]); });
  if (Object.freeze) Object.freeze(DRUCK_TEXTE);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function istText(v) { return typeof v === 'string' && v.trim() !== ''; }

  function postenBezeichnung(p, nr) {
    if (p && istText(p.name)) return '„' + p.name + '“';
    return 'Posten Nr. ' + nr;
  }

  /* Ganze Zahl ≥ 0 lesen: Zahl oder Text nur aus Ziffern.
     null = leer, undefined = ungültig. Kein parseInt: parseInt("2,5") ergäbe still 2. */
  function alsGanzzahl(v) {
    if (v === null || v === undefined) return null;
    var wert;
    if (typeof v === 'number') {
      wert = v;
    } else if (typeof v === 'string') {
      var t = v.trim();
      if (t === '') return null;
      wert = /^\d+$/.test(t) ? Number(t) : NaN;
    } else {
      wert = NaN;
    }
    return (typeof wert === 'number' && isFinite(wert) && Math.floor(wert) === wert &&
            wert >= 0 && wert <= Number.MAX_SAFE_INTEGER) ? wert : undefined;
  }

  function leseBleche(p, nr) {
    var wert = alsGanzzahl(p.bleche);
    if (wert === undefined) {
      var tagText = istText(p.tagLabel) ? ' (' + p.tagLabel + ')' :
                    (istText(p.tag) ? ' (Tag „' + p.tag + '“)' : '');
      throw new Error('Stikken: Bei ' + postenBezeichnung(p, nr) + tagText +
                      ' steht „' + String(p.bleche) + '“ Bleche — erlaubt sind nur ganze Zahlen ab 0.');
    }
    return wert;
  }

  function nachMengeDannReihenfolge(a, b) { return (b.menge - a.menge) || (a.index - b.index); }

  function verteile(posten, optionen) {
    if (!Array.isArray(posten)) {
      throw new Error('Stikken: Die Posten müssen eine Liste sein (bekommen: ' +
                      (posten === null ? 'null' : typeof posten) + ').');
    }
    var F = FAECHER_STANDARD;
    if (optionen && optionen.faecher !== undefined) {
      F = optionen.faecher;
      if (!(typeof F === 'number' && isFinite(F) && Math.floor(F) === F && F >= 1)) {
        throw new Error('Stikken: Fächerzahl „' + String(optionen.faecher) +
                        '“ ist ungültig — erlaubt ist eine ganze Zahl ab 1.');
      }
    }

    /* 1. Alles prüfen, bevor gerechnet wird (Fehler nicht von der Reihenfolge verdeckt). */
    var tage = [];            // Reihenfolge des ersten Auftauchens
    var jeTag = {};           // tag → { label, eintraege: [{ p, index, menge }] }
    var gesehen = {};
    posten.forEach(function (p, i) {
      var nr = i + 1;
      if (!p || typeof p !== 'object') throw new Error('Stikken: Posten Nr. ' + nr + ' ist leer.');
      if (!istText(p.kennung)) throw new Error('Stikken: ' + postenBezeichnung(p, nr) + ' hat keine Kennung.');
      if (!istText(p.name)) throw new Error('Stikken: Posten Nr. ' + nr + ' (Kennung „' + p.kennung + '“) hat keinen Namen.');
      if (!istText(p.tag)) throw new Error('Stikken: ' + postenBezeichnung(p, nr) + ' hat keinen Tag.');
      var menge = leseBleche(p, nr);
      var schluessel = p.tag + '\u0000' + p.kennung;
      if (gesehen[schluessel]) {
        throw new Error('Stikken: ' + postenBezeichnung(p, nr) + ' (Kennung „' + p.kennung +
                        '“) steht am Tag „' + p.tag + '“ zweimal.');
      }
      gesehen[schluessel] = true;
      if (!jeTag[p.tag]) { jeTag[p.tag] = { label: '', eintraege: [] }; tage.push(p.tag); }
      var t = jeTag[p.tag];
      var label = istText(p.tagLabel) ? p.tagLabel : '';
      if (label) {
        if (t.label && t.label !== label) {
          throw new Error('Stikken: Der Tag „' + p.tag + '“ hat zwei Beschriftungen („' +
                          t.label + '“ und „' + label + '“).');
        }
        t.label = label;
      }
      if (menge) t.eintraege.push({ p: p, index: i, menge: menge });
    });

    /* 2. Planen (ohne volle Stikken schon anzulegen — bei absurden Mengen
          soll der 26er-Fehler kommen, nicht ein Speicherüberlauf). */
    var plaene = [];
    var gesamt = 0;
    tage.forEach(function (tag) {
      var t = jeTag[tag];
      var sortiert = t.eintraege.slice().sort(nachMengeDannReihenfolge);
      var voll = [];      // [{ e, anzahl }]
      var reste = [];     // [{ e, index, menge }]
      sortiert.forEach(function (e) {
        var anzahl = Math.floor(e.menge / F);
        var rest = e.menge % F;
        if (anzahl) voll.push({ e: e, anzahl: anzahl });
        if (rest) reste.push({ e: e, index: e.index, menge: rest });
      });
      reste.sort(nachMengeDannReihenfolge);
      var gemischt = [];  // [{ teile: [{ e, menge }], frei }]
      reste.forEach(function (r) {
        var ziel = null;
        for (var k = 0; k < gemischt.length; k++) {
          if (gemischt[k].frei >= r.menge) { ziel = gemischt[k]; break; }
        }
        if (!ziel) { ziel = { teile: [], frei: F }; gemischt.push(ziel); }
        ziel.teile.push({ e: r.e, menge: r.menge });
        ziel.frei -= r.menge;
      });
      voll.forEach(function (v) { gesamt += v.anzahl; });
      gesamt += gemischt.length;
      plaene.push({ tag: tag, label: t.label, voll: voll, gemischt: gemischt });
    });

    if (gesamt > MAX_STIKKEN) {
      throw new Error('Stikken: Es wären ' + gesamt + ' Stikken nötig, Buchstaben gibt es nur von A bis Z (' +
                      MAX_STIKKEN + '). Bitte die Mengen prüfen.');
    }

    /* 3. Stikken anlegen, Fächer von oben, Buchstaben durchlaufend. */
    var stikken = [];
    function neueStikke(plan, teile, frei) {
      var fach = 1;
      var belegung = teile.map(function (teil) {
        var b = {
          kennung: teil.e.p.kennung, name: teil.e.p.name, bleche: teil.menge,
          vonFach: fach, bisFach: fach + teil.menge - 1
        };
        fach += teil.menge;
        return b;
      });
      stikken.push({
        buchstabe: String.fromCharCode(65 + stikken.length),
        tag: plan.tag, tagLabel: plan.label, faecher: F,
        belegung: belegung, frei: frei
      });
    }
    plaene.forEach(function (plan) {
      plan.voll.forEach(function (v) {
        for (var k = 0; k < v.anzahl; k++) neueStikke(plan, [{ e: v.e, menge: F }], 0);
      });
      plan.gemischt.forEach(function (g) { neueStikke(plan, g.teile, g.frei); });
    });
    return stikken;
  }


  /* ── Stufe 2: Rest, Reste-Stikken, Tage ─────────────────────────── */

  function istObjekt(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function kopie(b, vonFach) {
    return { kennung: b.kennung, name: b.name, bleche: b.bleche, vonFach: vonFach, bisFach: vonFach + b.bleche - 1 };
  }

  function plane(posten, optionen) {
    optionen = optionen || {};
    if (!Array.isArray(posten)) return verteile(posten);   // wirft den Fehler aus Stufe 1
    var rest = optionen.rest === undefined || optionen.rest === null ? {} : optionen.rest;
    if (!istObjekt(rest)) throw new Error('Stikken: Die Rest-Angaben müssen ein Objekt sein.');
    var restBleche = rest.bleche === undefined || rest.bleche === null ? {} : rest.bleche;
    if (!istObjekt(restBleche)) throw new Error('Stikken: Die Rest-Bleche müssen ein Objekt { kennung: Zahl } sein.');
    var fremd = rest.fremd === undefined || rest.fremd === null ? {} : rest.fremd;
    if (!istObjekt(fremd)) throw new Error('Stikken: Die Fremdbelegung muss ein Objekt { text, faecher } sein.');
    var tageInfo = optionen.tage === undefined || optionen.tage === null ? {} : optionen.tage;
    if (!istObjekt(tageInfo)) throw new Error('Stikken: Die Tage müssen ein Objekt { tag: { titel, name } } sein.');

    var ersterTag = posten.length && istObjekt(posten[0]) ? posten[0].tag : null;

    /* Rest je Kennung lesen (nur erster Tag). Unbekannte Kennung = Fehler des Aufrufers. */
    var restJe = {};
    Object.keys(restBleche).forEach(function (kennung) {
      var p = null;
      posten.forEach(function (q) { if (!p && istObjekt(q) && q.tag === ersterTag && q.kennung === kennung) p = q; });
      if (!p) {
        throw new Error('Stikken: Rest für Kennung „' + kennung + '“ — diese Sorte steht am ersten Tag' +
                        (ersterTag ? ' („' + ersterTag + '“)' : '') + ' nicht in der Liste.');
      }
      var n = alsGanzzahl(restBleche[kennung]);
      if (n === undefined) {
        throw new Error('Stikken: Rest bei ' + postenBezeichnung(p, 0) + ' steht „' + String(restBleche[kennung]) +
                        '“ — erlaubt sind nur ganze Zahlen ab 0.');
      }
      restJe[kennung] = n || 0;
    });
    var fremdText = fremd.text === undefined || fremd.text === null ? '' : String(fremd.text).trim();
    var fremdFaecher = alsGanzzahl(fremd.faecher);
    if (fremdFaecher === undefined) {
      throw new Error('Stikken: Bei „Steht auch mit drin“ steht „' + String(fremd.faecher) +
                      '“ Fächer — erlaubt sind nur ganze Zahlen ab 0.');
    }
    fremdFaecher = fremdFaecher || 0;

    /* setzt ab = max(0, will − Rest), nur am ersten Tag (R2, R5) */
    var ergebnisPosten = [];
    var altSumme = 0;
    var alt = [];
    var ab = posten.map(function (p, i) {
      if (!istObjekt(p)) return p;                       // verteile() meldet den Fehler
      var will = leseBleche(p, i + 1) || 0;
      var restN = p.tag === ersterTag && restJe[p.kennung] ? restJe[p.kennung] : 0;
      var setztAb = Math.max(0, will - restN);
      if (restN) { altSumme += restN; alt.push({ kennung: p.kennung, name: p.name, bleche: restN }); }
      ergebnisPosten.push({ kennung: p.kennung, name: p.name, tag: p.tag, will: will, rest: restN,
                            setztAb: setztAb, mehrAlsGewollt: Math.max(0, restN - will) });
      var q = {};
      Object.keys(p).forEach(function (k) { q[k] = p[k]; });
      q.bleche = setztAb;
      return q;
    });

    /* genau Stufe 1 (prüft auch Posten, Fächerzahl und die 26) */
    var stikken = verteile(ab, { faecher: optionen.faecher });
    var F = optionen.faecher === undefined ? FAECHER_STANDARD : optionen.faecher;

    var hinweise = [];
    /* Trennstellen (Stufe 2a): passt `trennung` nicht zum Namen, wird sie
       ignoriert — Hinweis fürs Formular, KEIN Fehler, kein Druckstopp (G1). */
    var trennungen = {}, trennungHinweise = [];
    posten.forEach(function (p) {
      if (!istObjekt(p) || p.trennung === undefined || p.trennung === null || p.trennung === '') return;
      if (Object.prototype.hasOwnProperty.call(trennungen, p.kennung)) return;
      if (typeof p.trennung === 'string' && p.trennung.replace(/\|/g, '') === p.name) {
        trennungen[p.kennung] = p.trennung;
      } else {
        trennungen[p.kennung] = '';
        trennungHinweise.push(DRUCK_TEXTE.de.trennungFalsch.replace('{name}', p.name));
      }
    });
    if (fremdText && !fremdFaecher) hinweise.push(DRUCK_TEXTE.de.faecherFehlen);
    if (fremdFaecher && !altSumme) hinweise.push(DRUCK_TEXTE.de.fremdOhneAlt);

    var reste = null;
    if (altSumme > 0) {                                   // R12: erst ab einem alten Blech
      if (altSumme + fremdFaecher > F) {
        throw new Error('Stikken: Im Reste-Stikken ist nur Platz für ' + F + ' Bleche: ' +
                        altSumme + ' alt + ' + fremdFaecher + ' andere = ' + (altSumme + fremdFaecher) + '.');
      }
      var platz = F - altSumme - fremdFaecher;
      var neu = [];
      /* AUFLOESEN-ANFANG (Anker für die Gegenproben in _PRUEF_stikken.js) */
      var frische = stikken.filter(function (s) { return s.tag === ersterTag; });
      if (frische.length >= 2) {
        var kandidat = null;
        frische.forEach(function (s) {
          if (!kandidat || (F - s.frei) <= (F - kandidat.frei)) kandidat = s;   // Gleichstand: zuletzt angelegt
        });
        if (F - kandidat.frei <= platz) {
          neu = kandidat.belegung;
          stikken = stikken.filter(function (s) { return s !== kandidat; });
        }
      }
      /* AUFLOESEN-ENDE */
      var fach = 1;
      var altFaecher = alt.map(function (b) { var k = kopie(b, fach); fach += b.bleche; return k; });
      var fremdBlock = null;
      if (fremdFaecher) {
        fremdBlock = { text: fremdText, faecher: fremdFaecher, vonFach: fach, bisFach: fach + fremdFaecher - 1 };
        fach += fremdFaecher;
      }
      var neuFaecher = neu.map(function (b) { var k = kopie(b, fach); fach += b.bleche; return k; });
      var neuSumme = 0;
      neu.forEach(function (b) { neuSumme += b.bleche; });
      var erster = null;
      posten.forEach(function (p) { if (!erster && istObjekt(p) && p.tag === ersterTag) erster = p; });
      var label = '';
      posten.forEach(function (p) { if (!label && istObjekt(p) && p.tag === ersterTag && istText(p.tagLabel)) label = p.tagLabel; });
      reste = { tag: ersterTag, tagLabel: label, faecher: F, alt: altFaecher, fremd: fremdBlock,
                neu: neuFaecher, frei: platz - neuSumme };
    }

    /* Buchstaben erst jetzt (nach dem Auflösen), lückenlos über alle Tage */
    stikken.forEach(function (s, i) { s.buchstabe = String.fromCharCode(65 + i); });

    /* Tage in der Reihenfolge des ersten Auftauchens */
    var tage = [];
    posten.forEach(function (p) {
      if (!istObjekt(p)) return;
      var t = null;
      tage.forEach(function (x) { if (x.tag === p.tag) t = x; });
      if (!t) {
        var info = istObjekt(tageInfo[p.tag]) ? tageInfo[p.tag] : {};
        t = { tag: p.tag, tagLabel: '', titel: istText(info.titel) ? info.titel : '',
              name: istText(info.name) ? info.name : '', reste: null, stikken: [] };
        tage.push(t);
      }
      if (!t.tagLabel && istText(p.tagLabel)) t.tagLabel = p.tagLabel;
    });
    tage.forEach(function (t) {
      t.stikken = stikken.filter(function (s) { return s.tag === t.tag; });
      if (reste && reste.tag === t.tag) t.reste = reste;
    });

    return { faecher: F, posten: ergebnisPosten, stikken: stikken, reste: reste, tage: tage, hinweise: hinweise, trennungen: trennungen,
             trennungHinweise: trennungHinweise };
  }

  function restHinweis(pe) {
    if (!pe || !pe.rest) return '';
    var T = DRUCK_TEXTE.de;
    return pe.mehrAlsGewollt > 0 ? T.restReicht.replace('{n}', pe.mehrAlsGewollt) : T.restPlus.replace('{n}', pe.rest);
  }

  /* Zeichnen nimmt den Plan aus plane(); eine Liste aus verteile() (Stufe 1)
     wird als Plan ohne Rest und ohne Tagestitel behandelt. */
  function alsPlan(eingabe, wer) {
    if (Array.isArray(eingabe)) {
      var tage = [];
      eingabe.forEach(function (s) {
        var t = null;
        tage.forEach(function (x) { if (x.tag === s.tag) t = x; });
        if (!t) { t = { tag: s.tag, tagLabel: s.tagLabel || '', titel: '', name: '', reste: null, stikken: [] }; tage.push(t); }
        t.stikken.push(s);
      });
      return { stikken: eingabe, reste: null, tage: tage };
    }
    if (istObjekt(eingabe) && Array.isArray(eingabe.tage)) return eingabe;
    throw new Error('Stikken: ' + wer + ' braucht den Plan aus plane() oder die Liste aus verteile().');
  }

  /* Ein Tag je Blatt (R7), höchstens STIKKEN_JE_SEITE Säulen, Reste-Stikken zuerst */
  function blaetter(plan) {
    var liste = [];
    plan.tage.forEach(function (t) {
      var saeulen = (t.reste ? [{ reste: t.reste }] : []).concat(t.stikken.map(function (s) { return { stikke: s }; }));
      var n = Math.ceil(saeulen.length / STIKKEN_JE_SEITE);
      for (var i = 0; i < n; i++) {
        liste.push({ tag: t, nr: i + 1, von: n,
                     saeulen: saeulen.slice(i * STIKKEN_JE_SEITE, (i + 1) * STIKKEN_JE_SEITE) });
      }
    });
    return liste;
  }

  function aufzaehlung(namen) {
    if (namen.length < 2) return namen.join('');
    return namen.slice(0, -1).join(', ') + DRUCK_TEXTE.de.und + namen[namen.length - 1];
  }

  function hinweisHTML(eingabe) {
    var plan = alsPlan(eingabe, 'hinweisHTML');
    var T = DRUCK_TEXTE.de;
    var b = blaetter(plan);
    if (!b.length) return '<div class="bst-hinweiszeile">' + escapeHtml(T.keineBleche) + '</div>';
    var namen = [];
    plan.tage.forEach(function (t) {
      var hatBlatt = b.some(function (x) { return x.tag === t; });
      if (hatBlatt && istText(t.name)) namen.push(t.name);
    });
    var text = (b.length === 1 ? T.hinweisEinBlatt : T.hinweisBlaetter) +
               (namen.length ? T.hinweisFuer.replace('{tage}', aufzaehlung(namen)) : '');
    return '<div class="bst-hinweiszeile">' + escapeHtml(text) + '</div>';
  }

  function mm(x) { return (Math.round(x * 100) / 100) + 'mm'; }

  /* ── Stufe 2a: Trennung nur an festen Stellen, Schrift passend machen ──
     Der Browser bricht nur an weichen Trennzeichen (U+00AD, aus `trennung`),
     nach Bindestrichen und an Leerzeichen um (hyphens: manual). Damit kein
     Teilstück überläuft, rechnet zeichneHTML je Abschnitt die größte Schrift
     in SCHRIFT_SCHRITT-Schritten bis SCHRIFT_MIN_PT aus, bei der jedes
     Teilstück und die Zeilenzahl passen. Erst wenn auch die Untergrenze nicht
     reicht, darf ein Wort frei brechen (Klasse bst-frei). Gemessen wird mit
     optionen.messen (Formular: Canvas mit SCHRIFT), sonst vorsichtig geschätzt;
     jede Breite bekommt MESS_ZUSCHLAG (Freigabe KC 14.11., 07:00, G2).
     Gleichartige Abschnitte eines Blatts bekommen dieselbe Größe (G3). */
  var PT_MM = 25.4 / 72;
  var INHALT_MM = 180;          // A4 210 mm − 2 × 15 mm Rand von bos_druck.js
  var SAEULEN_ABSTAND_MM = 4;
  var GROESSE = { name: 8.5, nameGross: 10, zahl: 13, zahlGross: 20, kw: 7, fremd: 8 };

  function schaetzung(text, pt, gewicht) {
    return String(text).length * (gewicht >= 600 ? SCHAETZ_FAKTOR_FETT : SCHAETZ_FAKTOR) * pt * PT_MM;
  }
  function breiteMessen(messen) {
    return function (text, pt, gewicht) {
      var roh = typeof messen === 'function' ? messen(text, pt, gewicht) : schaetzung(text, pt, gewicht);
      if (typeof roh !== 'number' || !isFinite(roh) || roh < 0) roh = schaetzung(text, pt, gewicht);
      return roh * MESS_ZUSCHLAG;
    };
  }

  /* Säulenbreiten wie die Flexbox: frische Anteil 1 (max. 40 mm), Reste 1,4 (max. 44 mm) */
  function saeulenBreiten(saeulen) {
    var frei = INHALT_MM - SAEULEN_ABSTAND_MM * (saeulen.length - 1);
    var info = saeulen.map(function (s) { return { anteil: s.reste ? 1.4 : 1, max: s.reste ? 44 : 40, breite: null }; });
    for (var runde = 0; runde < saeulen.length; runde++) {
      var offen = info.filter(function (x) { return x.breite === null; });
      if (!offen.length) break;
      var summe = 0; offen.forEach(function (x) { summe += x.anteil; });
      var rest = frei; info.forEach(function (x) { if (x.breite !== null) rest -= x.breite; });
      var geklemmt = false;
      offen.forEach(function (x) { if (rest * x.anteil / summe > x.max) { x.breite = x.max; geklemmt = true; } });
      if (!geklemmt) { offen.forEach(function (x) { x.breite = rest * x.anteil / summe; }); break; }
    }
    return info.map(function (x) { return x.breite; });
  }

  /* Text in Teilstücke mit Umbruchstellen zerlegen.
     art: 'weich' (U+00AD, Strich nur beim Umbruch), 'strich' (nach „-“), 'leer' (Leerzeichen), '' (Ende) */
  function teilstuecke(text, weicheStellen) {
    var stuecke = [], start = 0;
    for (var i = 1; i <= text.length; i++) {
      var art = '';
      if (i === text.length) art = 'ende';
      else if (text[i - 1] === ' ') art = 'leer';
      else if (text[i - 1] === '-') art = 'strich';
      else if (weicheStellen[i]) art = 'weich';
      if (art) { stuecke.push({ text: text.slice(start, i), art: art === 'ende' ? '' : art }); start = i; }
    }
    return stuecke;
  }
  function weicheStellenAus(name, trennung) {
    var stellen = {};
    if (!trennung) return stellen;
    var pos = 0;
    trennung.split('|').forEach(function (teil, i, alle) {
      pos += teil.length;
      if (i < alle.length - 1) stellen[pos] = true;
    });
    return stellen;
  }
  /* Passt der Text mit Größe pt in breite (mm) und höchstens maxZeilen Zeilen? */
  function passt(stuecke, pt, gewicht, breite, maxZeilen, mess) {
    if (maxZeilen < 1) return false;
    var zeilen = 1, aktuell = '';
    function zeilenText(t, art) { return t.replace(/ $/, '') + (art === 'weich' ? '-' : ''); }
    for (var i = 0; i < stuecke.length; i++) {
      var st = stuecke[i];
      if (mess(zeilenText(st.text, st.art), pt, gewicht) > breite) return false;   // Teilstück allein zu breit
      var probe = aktuell + st.text;
      if (aktuell && mess(zeilenText(probe, st.art), pt, gewicht) > breite) {
        zeilen++;
        if (zeilen > maxZeilen) return false;
        probe = st.text;
      }
      aktuell = probe;
    }
    return true;
  }
  function stufen(grund) {
    var liste = [];
    for (var pt = grund; pt >= SCHRIFT_MIN_PT - 1e-9; pt = Math.round((pt - SCHRIFT_SCHRITT) * 10) / 10) liste.push(pt);
    if (liste[liste.length - 1] !== SCHRIFT_MIN_PT) liste.push(SCHRIFT_MIN_PT);
    return liste;
  }
  /* Größte Größe ab grund, bei der der Text passt; sonst SCHRIFT_MIN_PT und frei */
  function bedarf(stuecke, grund, gewicht, breiteBei, zeilenBei, mess) {
    var st = stufen(grund);
    for (var i = 0; i < st.length; i++) {
      if (passt(stuecke, st[i], gewicht, breiteBei(st[i]), zeilenBei(st[i]), mess)) return { pt: st[i], frei: false };
    }
    return { pt: SCHRIFT_MIN_PT, frei: true };
  }
  function zeilenhoehe(pt) { return pt * 1.05 * PT_MM; }

  /* Einen Abschnitt ausmessen: liefert { kategorie, grund, gewicht, stuecke, html(pt, frei) } */
  function abschnittPlan(b, h, saeulenBreite, istReste, kennwort, trennung, mess) {
    var gross = b.bleche >= 3;
    var rand = istReste ? 2.5 * 25.4 / 96 : 1.5 * 25.4 / 96;
    var innen = saeulenBreite - 2 * rand - 2 * 1.2;
    var hoehe = b.bleche * h - 0.4;
    var gewicht = gross ? 700 : 400;
    var grund = gross ? GROESSE.nameGross : GROESSE.name;
    var kwBreite = kennwort ? mess(kennwort, GROESSE.kw, 900) + 1.4 + 0.53 + 3 * 0.3 * 25.4 / 96 : 0;
    var zahlBreite = mess(String(b.bleche), gross ? GROESSE.zahlGross : GROESSE.zahl, 900);
    var breiteBei = gross ? function () { return innen; }
                          : function () { return innen - zahlBreite - 1 - (kennwort ? kwBreite + 1 : 0); };
    var zeilenBei = gross ?
      function (pt) {
        var frei = hoehe - GROESSE.zahlGross * 1.2 * PT_MM - 2 * 1.5 - (kennwort ? GROESSE.kw * 1.2 * PT_MM + 1.5 : 0);
        return Math.min(3, Math.floor(frei / zeilenhoehe(pt)));
      } :
      function (pt) { return Math.min(2, Math.floor(hoehe / zeilenhoehe(pt))); };
    var weich = weicheStellenAus(b.name, trennung);
    var stuecke = teilstuecke(b.name, weich);
    return {
      kategorie: istReste ? 'reste' : (gross ? 'frischGross' : 'frischKlein'),
      grund: grund,
      bedarf: bedarf(stuecke, grund, gewicht, breiteBei, zeilenBei, mess),
      zeichne: function (pt, frei, klasse) {
        var nameHtml = stuecke.map(function (st) { return escapeHtml(st.text) + (st.art === 'weich' ? '­' : ''); }).join('');
        var stil = pt !== grund ? ' style="font-size:' + pt + 'pt;"' : '';
        return '<div class="bst-ab' + (klasse ? ' ' + klasse : '') + (gross ? ' bst-ab-gross' : '') + '" style="grid-row:' + b.vonFach + ' / span ' + b.bleche + ';">' +
               (kennwort ? '<span class="bst-kw">' + escapeHtml(kennwort) + '</span>' : '') +
               '<span class="bst-name' + (frei ? ' bst-frei' : '') + '"' + stil + '>' + nameHtml + '</span>' +
               '<span class="bst-zahl">' + b.bleche + '</span></div>';
      }
    };
  }

  function fremdPlan(fr, h, saeulenBreite, mess) {
    var innen = saeulenBreite - 2 * 2.5 * 25.4 / 96 - 2 * 1.2 - 2 * 1.2 - 2 * 25.4 / 96;
    var hoehe = fr.faecher * h - 0.4 - 1;
    var stuecke = teilstuecke(fr.text, {});
    var bed = bedarf(stuecke, GROESSE.fremd, 700, function () { return innen; },
                     function (pt) { return Math.min(2, Math.floor(hoehe / zeilenhoehe(pt))); }, mess);
    var stil = bed.pt !== GROESSE.fremd ? ' style="font-size:' + bed.pt + 'pt;"' : '';
    return '<div class="bst-ab bst-fremd" style="grid-row:' + fr.vonFach + ' / span ' + fr.faecher + ';">' +
           (fr.text ? '<span class="bst-fremdtext' + (bed.frei ? ' bst-frei' : '') + '"' + stil + '>' + escapeHtml(fr.text) + '</span>' : '') + '</div>';
  }

  function faecherRaster(F, h) {
    var html = '<div class="bst-faecher" style="grid-template-rows:repeat(' + F + ',' + mm(h) + ');">';
    for (var f = 1; f <= F; f++) html += '<div class="bst-fach" style="grid-row:' + f + ';"></div>';
    return html;
  }

  function legende() {
    return '<div class="bst-legende">' + SPRACHEN.map(function (s) {
      return '<div><b>' + s.toUpperCase() + '</b>' + escapeHtml(DRUCK_TEXTE[s].legende) + '</div>';
    }).join('') + '</div>';
  }

  /* Ein Blatt: erst alle Abschnitte ausmessen, dann je Kategorie die kleinste
     nötige Größe für alle (G3), dann zeichnen. */
  function zeichneReihe(saeulen, h, trennungen, mess) {
    var T = DRUCK_TEXTE.de;
    var breiten = saeulenBreiten(saeulen);
    var plaene = saeulen.map(function (s, i) {
      var liste = [];
      function tr(k) { return trennungen && Object.prototype.hasOwnProperty.call(trennungen, k) ? trennungen[k] : ''; }
      if (s.reste) {
        s.reste.alt.forEach(function (b) { liste.push({ teil: abschnittPlan(b, h, breiten[i], true, T.alt, tr(b.kennung), mess), klasse: 'bst-alt' }); });
        s.reste.neu.forEach(function (b) { liste.push({ teil: abschnittPlan(b, h, breiten[i], true, T.neu, tr(b.kennung), mess), klasse: 'bst-neu', nachFremd: true }); });
      } else {
        s.stikke.belegung.forEach(function (b) { liste.push({ teil: abschnittPlan(b, h, breiten[i], false, '', tr(b.kennung), mess), klasse: '' }); });
      }
      return liste;
    });
    var kleinste = {};
    plaene.forEach(function (liste) {
      liste.forEach(function (x) {
        var k = x.teil.kategorie;
        if (kleinste[k] === undefined || x.teil.bedarf.pt < kleinste[k]) kleinste[k] = x.teil.bedarf.pt;
      });
    });
    return saeulen.map(function (s, i) {
      function teilHtml(x) {
        var pt = Math.min(kleinste[x.teil.kategorie], x.teil.grund);
        return x.teil.zeichne(pt, x.teil.bedarf.frei, x.klasse);
      }
      if (s.reste) {
        var r = s.reste;
        var html = '<div class="bst-stikke bst-reste">' +
          '<div class="bst-kopf bst-reste-kopf"><div class="bst-buchstabe">' + escapeHtml(T.restKopf) + '</div>' +
          '<div class="bst-froster">' + SPRACHEN.map(function (sp) { return escapeHtml(DRUCK_TEXTE[sp].stehtImFroster); }).join('<br>') +
          '</div></div>' + faecherRaster(r.faecher, h);
        plaene[i].filter(function (x) { return !x.nachFremd; }).forEach(function (x) { html += teilHtml(x); });
        if (r.fremd) html += fremdPlan(r.fremd, h, breiten[i], mess);
        plaene[i].filter(function (x) { return x.nachFremd; }).forEach(function (x) { html += teilHtml(x); });
        return html + '</div></div>';
      }
      var st = s.stikke;
      var html2 = '<div class="bst-stikke">' +
        '<div class="bst-kopf"><div class="bst-buchstabe">' + escapeHtml(st.buchstabe) + '</div>' +
        '<div class="bst-tag">' + (st.tagLabel ? escapeHtml(st.tagLabel) : '&nbsp;') + '</div></div>' +
        faecherRaster(st.faecher, h);
      plaene[i].forEach(function (x) { html2 += teilHtml(x); });
      return html2 + '</div></div>';
    }).join('');
  }

  /* Stufe 3: Reihenfolge im Froster. Tage mit Stikken in der Reihenfolge
     der Blätter (H1: ein Tag ohne Bleche hat keinen Platz im Froster).
     Erster „vorn“, letzter ab drei Tagen „ganz hinten“, sonst „dahinter“.
     Nur mit ≥ 2 Tagen, die alle einen Namen haben; sonst null. */
  function frosterFolge(b) {
    var folge = [];
    b.forEach(function (blatt) { if (folge.indexOf(blatt.tag) < 0) folge.push(blatt.tag); });
    if (folge.length < 2 || !folge.every(function (t) { return istText(t.name); })) return null;
    return folge;
  }
  function frosterZeile(folge, aktuell) {
    var T = DRUCK_TEXTE.de;
    var teile = folge.map(function (t, i) {
      var muster = i === 0 ? T.frosterVorn : (i === folge.length - 1 && folge.length >= 3 ? T.frosterGanzHinten : T.frosterDahinter);
      var text = escapeHtml(muster.replace('{tag}', t.name));
      return t === aktuell ? '<b>' + text + '</b>' : text;
    });
    return '<div class="bst-froster-folge">' + escapeHtml(T.frosterZeile).replace('{liste}', teile.join(escapeHtml(T.frosterTrenner))) + '</div>';
  }

  function zeichneHTML(eingabe, optionen) {
    var plan = alsPlan(eingabe, 'zeichneHTML');
    var T = DRUCK_TEXTE.de;
    var b = blaetter(plan);
    if (!b.length) return '';
    var folge = frosterFolge(b);
    var kopfzeile = optionen && istText(optionen.kopfzeile) ? optionen.kopfzeile : '';
    var mess = breiteMessen(optionen && optionen.messen);
    var html = '';
    b.forEach(function (blatt) {
      var t = blatt.tag;
      var mitTitel = istText(t.titel);
      var mitReste = blatt.saeulen.some(function (s) { return s.reste; });
      var erste = blatt.saeulen[0];
      var F = erste.reste ? erste.reste.faecher : erste.stikke.faecher;
      var mitFroster = !!folge;
      var raster = RASTER_MAX_MM - (mitTitel ? TAGTITEL_MM : 0) - (mitFroster ? FROSTER_MM : 0) - (mitReste ? LEGENDE_MM : 0);
      var h = Math.min(FACH_MAX_MM, raster / F);
      var blattText = blatt.von > 1 ?
        '<span class="bst-blatt"> · ' + escapeHtml(T.blatt.replace('{n}', blatt.nr).replace('{m}', blatt.von)) + '</span>' : '';
      html += '<div class="bst-seite" lang="de">' +
        (kopfzeile ? '<div class="bst-kopfzeile">' + escapeHtml(kopfzeile) + '</div>' : '') +
        (mitTitel ? '<div class="bst-tagtitel">' + escapeHtml(t.titel) + blattText + '</div>' : '') +
        (mitFroster ? frosterZeile(folge, t) : '') +
        '<div class="bst-titel">' + escapeHtml(T.titel) + (mitTitel ? '' : blattText) + '</div>' +
        '<div class="bst-hinweis">' + escapeHtml(T.kreppband) + '</div>' +
        '<div class="bst-reihe">' + zeichneReihe(blatt.saeulen, h, plan.trennungen, mess) + '</div>' +
        (mitReste ? legende() : '') +
        '</div>';
    });
    return html;
  }

  /* Nur Grautöne (R = G = B) und Schwarz/Weiß — _PRUEF_stikken.js prüft das.
     ALT / Fremd / NEU unterscheiden sich im Muster, nicht nur im Grau.
     Die Schrift der Abschnitte steht EINMAL in SCHRIFT (G2) und wird auch zum Messen benutzt. */
  var DRUCK_CSS = [
    '.bst-hinweiszeile{margin-top:4mm;font-size:10pt;font-weight:700;color:#000;line-height:1.3;}',
    '.bst-seite{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid;' +
      'padding-top:12mm;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:10pt;line-height:1.2;color:#000;}',
    '.bst-kopfzeile{font-size:9pt;color:#333;border-bottom:1px solid #000;padding-bottom:1.5mm;margin-bottom:3mm;}',
    '.bst-tagtitel{font-size:22pt;font-weight:900;line-height:1.1;margin-bottom:1mm;}',
    '.bst-tagtitel .bst-blatt{font-size:12pt;}',
    '.bst-froster-folge{font-size:11pt;line-height:1.3;margin:0 0 1.5mm;}',
    '.bst-froster-folge b{font-weight:900;}',
    '.bst-titel{font-size:15pt;font-weight:700;}',
    '.bst-blatt{font-size:11pt;font-weight:400;color:#333;}',
    '.bst-hinweis{font-size:9pt;color:#555;margin:1mm 0 4mm;}',
    '.bst-reihe{display:flex;gap:4mm;align-items:flex-start;}',
    '.bst-stikke{flex:1 1 0;min-width:0;max-width:40mm;}',   /* 6 je Reihe → je ~26,7 mm, weniger → bis 40 mm */
    '.bst-kopf{text-align:center;border:1.5px solid #000;border-bottom:none;padding:1.5mm 0 1mm;height:21mm;box-sizing:border-box;overflow:hidden;}',
    '.bst-buchstabe{font-size:36pt;font-weight:900;line-height:1;}',
    '.bst-tag{font-size:11pt;font-weight:700;color:#000;margin-top:1mm;}',
    '.bst-reste{flex-grow:1.4;max-width:44mm;}',   /* Kennwort ALT/NEU braucht Breite (Stufe 2, Prüfbild S2_07); saeulenBreiten() rechnet genauso */
    '.bst-reste-kopf{border-width:2.5px;}',
    '.bst-reste-kopf .bst-buchstabe{font-size:22pt;}',
    '.bst-froster{font-size:6.3pt;line-height:1.15;color:#000;margin-top:0.8mm;}',
    '.bst-faecher{display:grid;grid-template-columns:100%;border:1.5px solid #000;background:#fff;}',
    '.bst-reste .bst-faecher{border-width:2.5px;}',
    '.bst-fach{grid-column:1;border-top:0.3mm solid #bbb;}',
    '.bst-fach:first-child{border-top:none;}',
    '.bst-ab{grid-column:1;position:relative;z-index:1;background:#d9d9d9;border-top:1px solid #000;border-bottom:1px solid #000;' +
      'margin-top:-1px;display:flex;align-items:center;gap:1mm;padding:0 1.2mm;overflow:hidden;font-family:' + SCHRIFT + ';}',
    /* Trennung nur an U+00AD, nach „-“ und an Leerzeichen (Stufe 2a): hyphens manual, kein freier Bruch */
    '.bst-name{flex:1 1 auto;min-width:0;font-size:8.5pt;line-height:1.05;hyphens:manual;-webkit-hyphens:manual;' +
      'overflow-wrap:normal;word-break:normal;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
    '.bst-frei{overflow-wrap:anywhere;}',   /* nur wenn auch SCHRIFT_MIN_PT nicht reicht */
    '.bst-zahl{flex:0 0 auto;font-size:13pt;font-weight:900;}',
    '.bst-ab-gross{flex-direction:column;justify-content:center;text-align:center;gap:1.5mm;}',
    '.bst-ab-gross .bst-name{flex:0 0 auto;font-size:10pt;font-weight:700;-webkit-line-clamp:3;}',
    '.bst-ab-gross .bst-zahl{font-size:20pt;}',
    '.bst-kw{flex:0 0 auto;font-size:7pt;font-weight:900;letter-spacing:0.3px;line-height:1.2;border:1px solid #000;background:#fff;color:#000;padding:0 0.7mm;}',
    '.bst-alt{background:#8c8c8c;border:1.6px dashed #000;}',
    '.bst-alt .bst-kw{background:#000;color:#fff;}',
    '.bst-neu{background:#d9d9d9;}',
    '.bst-fremd{background:repeating-linear-gradient(45deg,#000 0,#000 0.45mm,#fff 0.45mm,#fff 2.2mm);justify-content:center;}',
    '.bst-fremdtext{background:#fff;border:1px solid #000;padding:0.5mm 1.2mm;font-size:8pt;font-weight:700;line-height:1.05;text-align:center;' +
      'max-width:100%;overflow:hidden;hyphens:manual;-webkit-hyphens:manual;overflow-wrap:normal;word-break:normal;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
    '.bst-legende{margin-top:5mm;border-top:1px solid #000;padding-top:2mm;font-size:8.5pt;line-height:1.35;}',
    '.bst-legende b{display:inline-block;width:9mm;}'
  ].join('\n');

  var api = {
    FAECHER_STANDARD: FAECHER_STANDARD,
    STIKKEN_JE_SEITE: STIKKEN_JE_SEITE,
    verteile: verteile,
    plane: plane,
    restHinweis: restHinweis,
    hinweisHTML: hinweisHTML,
    zeichneHTML: zeichneHTML,
    DRUCK_TEXTE: DRUCK_TEXTE,
    DRUCK_CSS: DRUCK_CSS,
    SCHRIFT: SCHRIFT,
    SCHRIFT_MIN_PT: SCHRIFT_MIN_PT,
    FROSTER_MM: FROSTER_MM
  };
  if (Object.freeze) Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_STIKKEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
