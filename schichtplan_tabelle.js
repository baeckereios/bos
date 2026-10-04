/**
 * schichtplan_tabelle.js — gemeinsame Darstellung der Dienstplan-Tabelle
 *
 * WARUM ES DIESE DATEI GIBT (16.09.2026, T-75)
 * Ulf: "Entwürfe ist inzwischen unsere größte Einzeldatei... kann man die
 * nicht aufspalten?" Der Anlass war die Größe (191 KB, 3034 Zeilen), der
 * Grund für GENAU DIESEN Schnitt ist ein anderer: `hellOderDunkel()`,
 * `hexZuRgba()` und `farbStil()` standen ZEICHENGLEICH in entwuerfe.html
 * UND in offizieller_plan.html, und `baueVarianteTabelle()` /
 * `baueTabelle()` waren zwei Implementierungen derselben Tabelle, die sich
 * nur in zwei Details unterschieden (Lücken-Marker im Kopf, klickbare
 * Zellen). Wer die Farblogik ändert, musste bisher daran denken, es
 * zweimal zu tun.
 *
 * Aufspalten allein hätte Code nur verschoben und jede neue Datei ist ein
 * weiterer Request (siehe T-74: ein stumm fehlgeschlagener Script-Load hat
 * am 16.09. nachts den halben Motor lahmgelegt). Dieser Schnitt lohnt
 * sich, weil er eine Dopplung ENTFERNT.
 *
 * DER SCHNITT ist derselbe wie bei entwuerfe_berechnung.js: reine
 * Funktionen raus, DOM-Orchestrierung bleibt beim Aufrufer. Diese Datei
 * kennt weder `document` noch Firestore noch Modulvariablen der
 * Aufrufer -- alles, was sie braucht, kommt als Parameter herein und geht
 * als HTML-String heraus.
 *
 * WAS BEWUSST NICHT HIER LIEGT: der Aufbau der Zell-DATEN
 * (`baueTabellenDaten()` in Entwürfe, `baueZellen()` im offiziellen Plan).
 * Die beiden lesen wirklich Verschiedenes -- die eine ein Varianten-
 * Ergebnis mit Cross-Schicht-Kennzeichnung und Tausch-Informationen, die
 * andere ein gespeichertes Plan-Dokument. Sie sehen sich nur oberflächlich
 * ähnlich; sie zu vereinen hätte einen Parameter-Sumpf ergeben.
 *
 * CHANGELOG
 *   2026-09-16 · 21:47 · v0.1 · Feature (T-75)
 *     Erste Version. Inhalt 1:1 aus entwuerfe.html/offizieller_plan.html
 *     übernommen, keine Verhaltensänderung -- mit einer Ausnahme, die
 *     beide Fassungen vereint: der Aufrufer kann pro Spaltenkopf einen
 *     Marker und pro Zelle zusätzliche Attribute beisteuern. Genau die
 *     zwei Stellen, in denen sich die beiden Kopien unterschieden.
 *   2026-09-26 · v0.2 · Fix (K-11 / N-34, Namens-Fundament)
 *     Ohne gespeicherte Dienstplan-Reihenfolge sortiert die Tabelle nach
 *     NUMMER (P9 < P10 < P100), nicht mehr nach anzeigeName. Seit Schritt 5
 *     liefert anzeigeName den Rufnamen — ein neuer Rufname hätte sonst die
 *     Zeilen verschoben. Gleiche Regel wie die Vorbelegung in
 *     einstellungen.html (nummerZahl). Mit gespeicherter Reihenfolge
 *     unverändert.
 */
(function (global) {
  'use strict';

  var TAGE_LABEL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  var MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // K-11: Nummer als Zahl (P9 < P10 < P100); fremde IDs ans Ende, dann
  // als Text. Wie nummerZahl() in einstellungen.html.
  function nummerZahl(id) {
    var m = /^P(\d+)$/.exec(id);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  }

  function formatDatumKurz(d) {
    return String(d.getDate()).padStart(2, '0') + '.' + MONATE[d.getMonth()];
  }

  /**
   * Helligkeit einer Positionsfarbe -- liefert direkt die passende
   * Textfarbe (nicht "hell"/"dunkel"), so war es in beiden Kopien.
   * Feste 12er-Palette aus dem Positionen-Editor.
   *
   * ACHTUNG BEIM AUSLAGERN (16.09.2026): diese drei Funktionen sind
   * ZEICHENGLEICH aus entwuerfe.html/offizieller_plan.html uebernommen,
   * nicht nachgebaut. Beim ersten Versuch hatte ich sie aus dem
   * Gedaechtnis geschrieben -- mit anderen Rueckgabewerten und
   * "background:" statt "background-color:". Das waere eine stille
   * Aenderung an jeder farbigen Zelle gewesen. Wer hier etwas aendert,
   * aendert es fuer beide Seiten.
   */
  function hellOderDunkel(hex) {
    if (!hex) return null;
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1a1208' : '#f3ece1';
  }

  function hexZuRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  /**
   * Zwei Deckkraft-Stufen je nach Kontext (Ulf, 12.09.2026): am dunklen
   * Bildschirm nur ein zarter Einschlag ueber dem normalen
   * Zellenhintergrund (Textfarbe bleibt die normale helle Schrift), im
   * Druck auf weissem Papier die volle Pastellfarbe mit passendem
   * Kontrast-Text -- dieselbe gespeicherte Farbe, zwei Wirkungen.
   */
  function farbStil(hex, modus) {
    if (!hex) return '';
    if (modus === 'druck') return ' style="background-color:' + hex + '; color:' + (hellOderDunkel(hex) || '#1a1208') + ';"';
    var rgba = hexZuRgba(hex, 0.22);
    return rgba ? ' style="background-color:' + rgba + ';"' : '';
  }

  /**
   * Baut die komplette Dienstplan-Tabelle.
   *
   * @param tage    [{ datumISO }] -- Reihenfolge = Spaltenreihenfolge
   * @param zellen  { personId: { datumISO: { text, cls, farbe } } }
   * @param optionen {
   *   modus              'bildschirm' | 'druck'
   *   personenListe      [{ id, stammschicht }]
   *   reihenfolge        { nacht: [personId|''], frueh: [...] } oder null
   *                      -- gespeicherte Reihenfolge aus einstellungen.html
   *                      hat Vorrang (inkl. Leerzeilen als ''), sonst
   *                      nach Nummer (seit v0.2, K-11)
   *   anzeigeName        fn(personId) -> string
   *   kopfMarker         fn(tag) -> HTML-String vor dem Wochentag (optional)
   *   zelleAttribute     fn(personId, datumISO, zelle) -> ' data-x="y"' (optional)
   *   zelleKlassen       fn(personId, datumISO, zelle) -> zusätzliche Klassen (optional)
   * }
   */
  function baueDienstplanTabelle(tage, zellen, optionen) {
    var modus = optionen.modus || 'bildschirm';
    var personenListe = optionen.personenListe || [];
    var reihenfolge = optionen.reihenfolge || null;
    var anzeigeName = optionen.anzeigeName || function (id) { return id; };
    var kopfMarker = optionen.kopfMarker || function () { return ''; };
    var zelleAttribute = optionen.zelleAttribute || function () { return ''; };
    var zelleKlassen = optionen.zelleKlassen || function () { return ''; };

    var gruppen = [
      { label: 'Nachtschicht', stammschicht: 'nacht' },
      { label: 'Frühschicht', stammschicht: 'frueh' }
    ];

    var kopf = '<tr><th class="sp-name">Name</th>' + tage.map(function (tag) {
      var d = new Date(tag.datumISO + 'T00:00:00');
      return '<th>' + kopfMarker(tag) + TAGE_LABEL[(d.getDay() + 6) % 7] + '<br>'
        + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.</th>';
    }).join('') + '</tr>';

    var koerper = gruppen.map(function (g) {
      var gespeicherteReihe = reihenfolge && reihenfolge[g.stammschicht];
      var eintraege;
      if (gespeicherteReihe && gespeicherteReihe.length) {
        eintraege = gespeicherteReihe.map(function (id) {
          if (!id) return { leer: true };
          var p = personenListe.find(function (pp) { return pp.id === id; });
          return p ? { person: p } : null; // nicht mehr aktive Person: Zeile überspringen
        }).filter(function (e) { return e !== null; });
      } else {
        eintraege = personenListe.filter(function (p) { return p.stammschicht === g.stammschicht; })
          .sort(function (a, b) { return (nummerZahl(a.id) - nummerZahl(b.id)) || String(a.id).localeCompare(String(b.id)); })
          .map(function (p) { return { person: p }; });
      }
      if (!eintraege.length) return '';

      var gruppenZeile = '<tr class="sp-gruppe"><td colspan="' + (tage.length + 1) + '">' + g.label + '</td></tr>';
      var zeilen = eintraege.map(function (eintrag) {
        if (eintrag.leer) return '<tr class="sp-leerzeile"><td colspan="' + (tage.length + 1) + '">&nbsp;</td></tr>';
        var p = eintrag.person;
        var zellenHtml = tage.map(function (tag) {
          var z = (zellen[p.id] || {})[tag.datumISO];
          var style = z && z.farbe ? farbStil(z.farbe, modus) : '';
          // Reihenfolge bewusst: Zusatzklassen ZUERST, dann die Klasse
          // der Zelle -- so stand es in entwuerfe.html ('zelle-tauschbar
          // zelle-frei'), und so bleibt die Ausgabe zeichengleich zur
          // bisherigen.
          var klassen = [zelleKlassen(p.id, tag.datumISO, z) || '', (z && z.cls) || ''].filter(Boolean).join(' ');
          var attribute = zelleAttribute(p.id, tag.datumISO, z) || '';
          return '<td class="' + klassen + '"' + attribute + style + '>' + (z ? escHtml(z.text) : '') + '</td>';
        }).join('');
        return '<tr><td class="sp-name">' + escHtml(anzeigeName(p.id)) + '</td>' + zellenHtml + '</tr>';
      }).join('');
      return gruppenZeile + zeilen;
    }).join('');

    return '<div class="tabelle-wrap"><table class="dienstplan-tabelle"><thead>' + kopf + '</thead><tbody>' + koerper + '</tbody></table></div>';
  }

  var api = {
    TAGE_LABEL: TAGE_LABEL,
    MONATE: MONATE,
    escHtml: escHtml,
    formatDatumKurz: formatDatumKurz,
    hellOderDunkel: hellOderDunkel,
    hexZuRgba: hexZuRgba,
    farbStil: farbStil,
    baueDienstplanTabelle: baueDienstplanTabelle
  };

  global.BOS_SCHICHTPLAN_TABELLE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : global);
