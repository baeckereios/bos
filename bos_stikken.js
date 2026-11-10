/* ============================================================
   bos_stikken.js — BäckereiOS Stikken-Verteilung (Rechenteil)
   ------------------------------------------------------------
   Verteilt abzusetzende Bleche als VORSCHLAG auf Stikken (Wagen mit
   24 Fächern) und zeichnet die Verteilung für den Druckzettel. Jede
   Stikke bekommt einen Buchstaben; den schreibt die Nachtschicht auf
   Kreppband an die echte Stikke, so passen Zettel und Wagen zusammen.

   EIN Rechenteil für alle Formulare (Ulf 08.11.2026, 06:46: „So kann
   ich, wenn ich wollte, alles ergänzen“). Heute zwei Aufrufer:
   druckzentrale/fruehschicht_formular.html, druckzentrale/absetz_formular.html.
   Kein Firebase, kein DOM, kein Datum — in Node mit require() testbar
   (_PRUEF_stikken.js).

   Einbindung (Satellit, eine Ebene unter Root):
     <script src="../bos_stikken.js"></script>

   SCHNITTSTELLE
     BOS_STIKKEN.FAECHER_STANDARD   24
     BOS_STIKKEN.STIKKEN_JE_SEITE    6  (eine Reihe = ein Blatt)

     BOS_STIKKEN.verteile(posten, optionen) → stikken[]
       posten:   [{ kennung, name, bleche, tag, tagLabel? }] in Formularreihenfolge
                 bleche: ganze Zahl ≥ 0 oder Text nur aus Ziffern ("7");
                 '' / null / undefined / nur Leerzeichen = leer → fällt weg; 0 fällt weg.
       optionen: { faecher: 24 }   (ganze Zahl ≥ 1)
       Rückgabe: [{ buchstabe, tag, tagLabel, faecher,
                    belegung: [{ kennung, name, bleche, vonFach, bisFach }], frei }]
       Fehler (Error mit Klartext): ungültige Bleche (Sorte + Wert), fehlende
       kennung/name/tag, dieselbe Kennung zweimal an einem Tag, ein Tag mit
       zwei verschiedenen tagLabel, ungültige faecher, mehr als 26 Stikken.

     BOS_STIKKEN.hinweisHTML(stikken) → HTML für Seite 1 (eine Zeile):
       „Stikken-Verteilung: siehe Seite 2“ bzw. „Stikken: keine Bleche zum Absetzen.“
     BOS_STIKKEN.zeichneHTML(stikken, { kopfzeile }) → HTML ab Seite 2
       ('' bei keinen Stikken). kopfzeile = Formularname, Datum, Uhrzeit
       (der Aufrufer liefert sie, damit das Rechenteil keine Uhr kennt).
     BOS_STIKKEN.DRUCK_CSS → für extraCSS von BOS_DRUCK.drucken()

   REGELN (Ulf 08.11.2026, 06:43–06:49; Kompendium STIKKEN_VERTEILUNG §2)
     1. Tage nie mischen, Tage in der Reihenfolge ihres ersten Auftauchens.
     2. Innerhalb eines Tages dürfen Sorten gemischt werden.
     3. Eine Sorte wird nicht auf zwei Stikken geteilt — lieber Fächer frei.
        Ausnahme: mehr Bleche als Fächer → zuerst volle Stikken, der REST
        wird wie eine eigene Menge verteilt, und zwar nach SEINER Größe
        einsortiert (Freigabe KC 10.11., 07:57).
     4. Verfahren: Reste und kleine Sorten nach Blechen absteigend (Gleichstand:
        Formularreihenfolge), jede in die erste Stikke des Tages, in die sie
        ganz passt, sonst eine neue. Vorhersagbar statt minimal.
     5. Fach 1 ist oben, belegt in der Reihenfolge des Hineinlegens, freie
        Fächer unten.
     6. Buchstaben A–Z über alle Tage durch; je Tag erst die vollen, dann
        die gemischten Stikken.

   ZEICHNUNG (Freigabe KC 10.11., A1, Ulf 07:50: „automatisch eine zweite Seite“)
     Die Zeichnung steht IMMER ab einer neuen Seite, je Reihe mit bis zu 6
     Stikken ein Blatt, keine Reihe wird zerrissen. Jedes Blatt trägt oben
     die Kopfzeile des Aufrufers, damit es allein zuzuordnen ist —
     bos_druck.js wiederholt Kopf und Fuß NICHT (sie liegen im Fluss am
     Anfang bzw. Ende, siehe dort baueKopf/baueFuss), und @page hat margin 0:
     deshalb bringt jedes Blatt seinen oberen Rand (12 mm) selbst mit.
     Nur Grau und Schwarz (Schalter Farbe/Graustufen verfälscht nichts).
     Stellschrauben: FACH_MAX_MM, RASTER_MAX_MM, Breite in DRUCK_CSS.

   CHANGELOG
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
     Innenabstand unten (12 mm) → ~279 mm. Ausgemessen in den Prüfbildern. */
  var FACH_MAX_MM = 8;
  var RASTER_MAX_MM = 192;

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

  /* Bleche lesen: Zahl (ganz, ≥ 0) oder Text nur aus Ziffern.
     null = leer. Kein parseInt: parseInt("2,5") ergäbe still 2. */
  function leseBleche(p, nr) {
    var v = p.bleche;
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
    if (!(typeof wert === 'number' && isFinite(wert) && Math.floor(wert) === wert &&
          wert >= 0 && wert <= Number.MAX_SAFE_INTEGER)) {
      var tagText = istText(p.tagLabel) ? ' (' + p.tagLabel + ')' :
                    (istText(p.tag) ? ' (Tag „' + p.tag + '“)' : '');
      throw new Error('Stikken: Bei ' + postenBezeichnung(p, nr) + tagText +
                      ' steht „' + String(v) + '“ Bleche — erlaubt sind nur ganze Zahlen ab 0.');
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

  function anzahlBlaetter(stikken) { return Math.ceil(stikken.length / STIKKEN_JE_SEITE); }

  function hinweisHTML(stikken) {
    if (!Array.isArray(stikken)) throw new Error('Stikken: hinweisHTML braucht die Liste aus verteile().');
    if (!stikken.length) return '<div class="bst-hinweiszeile">Stikken: keine Bleche zum Absetzen.</div>';
    var n = anzahlBlaetter(stikken);
    var seiten = n === 1 ? 'Seite 2' : (n === 2 ? 'Seiten 2 und 3' : 'Seiten 2 bis ' + (n + 1));
    return '<div class="bst-hinweiszeile">Stikken-Verteilung: siehe ' + seiten + '</div>';
  }

  function mm(x) { return (Math.round(x * 100) / 100) + 'mm'; }

  function zeichneStikke(s) {
    var F = s.faecher;
    var h = Math.min(FACH_MAX_MM, RASTER_MAX_MM / F);
    var html = '<div class="bst-stikke">' +
      '<div class="bst-kopf"><div class="bst-buchstabe">' + escapeHtml(s.buchstabe) + '</div>' +
      '<div class="bst-tag">' + (s.tagLabel ? escapeHtml(s.tagLabel) : '&nbsp;') + '</div></div>' +
      '<div class="bst-faecher" style="grid-template-rows:repeat(' + F + ',' + mm(h) + ');">';
    for (var f = 1; f <= F; f++) html += '<div class="bst-fach" style="grid-row:' + f + ';"></div>';
    s.belegung.forEach(function (b) {
      var gross = b.bleche >= 3 ? ' bst-ab-gross' : '';
      html += '<div class="bst-ab' + gross + '" style="grid-row:' + b.vonFach + ' / span ' + b.bleche + ';">' +
              '<span class="bst-name">' + escapeHtml(b.name) + '</span>' +
              '<span class="bst-zahl">' + b.bleche + '</span></div>';
    });
    return html + '</div></div>';
  }

  function zeichneHTML(stikken, optionen) {
    if (!Array.isArray(stikken)) throw new Error('Stikken: zeichneHTML braucht die Liste aus verteile().');
    if (!stikken.length) return '';
    var kopfzeile = optionen && istText(optionen.kopfzeile) ? optionen.kopfzeile : '';
    var n = anzahlBlaetter(stikken);
    var html = '';
    for (var blatt = 0; blatt < n; blatt++) {
      var reihe = stikken.slice(blatt * STIKKEN_JE_SEITE, (blatt + 1) * STIKKEN_JE_SEITE);
      html += '<div class="bst-seite" lang="de">' +
        (kopfzeile ? '<div class="bst-kopfzeile">' + escapeHtml(kopfzeile) + '</div>' : '') +
        '<div class="bst-titel">Stikken-Verteilung (Vorschlag)' +
          (n > 1 ? '<span class="bst-blatt"> · Blatt ' + (blatt + 1) + ' von ' + n + '</span>' : '') + '</div>' +
        '<div class="bst-hinweis">Buchstabe auf Kreppband an die Stikke · Fach 1 ist oben · freie Fächer bleiben unten</div>' +
        '<div class="bst-reihe">' + reihe.map(zeichneStikke).join('') + '</div>' +
        '</div>';
    }
    return html;
  }

  /* Nur Grautöne (R = G = B) und Schwarz/Weiß — _PRUEF_stikken.js prüft das. */
  var DRUCK_CSS = [
    '.bst-hinweiszeile{margin-top:4mm;font-size:10pt;font-weight:700;color:#000;line-height:1.3;}',
    '.bst-seite{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid;' +
      'padding-top:12mm;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:10pt;line-height:1.2;color:#000;}',
    '.bst-kopfzeile{font-size:9pt;color:#333;border-bottom:1px solid #000;padding-bottom:1.5mm;margin-bottom:3mm;}',
    '.bst-titel{font-size:15pt;font-weight:700;}',
    '.bst-blatt{font-size:11pt;font-weight:400;color:#333;}',
    '.bst-hinweis{font-size:9pt;color:#555;margin:1mm 0 4mm;}',
    '.bst-reihe{display:flex;gap:4mm;align-items:flex-start;}',
    '.bst-stikke{flex:1 1 0;min-width:0;max-width:40mm;}',   /* 6 je Reihe → je ~26,7 mm, weniger → bis 40 mm */
    '.bst-kopf{text-align:center;border:1.5px solid #000;border-bottom:none;padding:1.5mm 0 1mm;}',
    '.bst-buchstabe{font-size:36pt;font-weight:900;line-height:1;}',
    '.bst-tag{font-size:11pt;font-weight:700;color:#000;margin-top:1mm;}',
    '.bst-faecher{display:grid;grid-template-columns:100%;border:1.5px solid #000;background:#fff;}',
    '.bst-fach{grid-column:1;border-top:0.3mm solid #bbb;}',
    '.bst-fach:first-child{border-top:none;}',
    '.bst-ab{grid-column:1;position:relative;z-index:1;background:#d9d9d9;border-top:1px solid #000;border-bottom:1px solid #000;' +
      'margin-top:-1px;display:flex;align-items:center;gap:1mm;padding:0 1.2mm;overflow:hidden;' +
      'font-family:"Roboto Condensed","sans-serif-condensed","Arial Narrow",Arial,sans-serif;}',
    '.bst-name{flex:1 1 auto;min-width:0;font-size:8.5pt;line-height:1.05;hyphens:auto;-webkit-hyphens:auto;' +
      'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
    '.bst-zahl{flex:0 0 auto;font-size:13pt;font-weight:900;}',
    '.bst-ab-gross{flex-direction:column;justify-content:center;text-align:center;gap:1.5mm;}',
    '.bst-ab-gross .bst-name{flex:0 0 auto;font-size:10pt;font-weight:700;-webkit-line-clamp:3;}',
    '.bst-ab-gross .bst-zahl{font-size:20pt;}'
  ].join('\n');

  var api = {
    FAECHER_STANDARD: FAECHER_STANDARD,
    STIKKEN_JE_SEITE: STIKKEN_JE_SEITE,
    verteile: verteile,
    hinweisHTML: hinweisHTML,
    zeichneHTML: zeichneHTML,
    DRUCK_CSS: DRUCK_CSS
  };
  if (Object.freeze) Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_STIKKEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
