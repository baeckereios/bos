/* ================================================================
   BäckereiOS · maschinenseite/maschinen_ansicht.js — Backprogramm-Ansicht
   ================================================================
   Stellt bereit: window.BOS_MASCHINEN_ANSICHT (in Node: module.exports)

   Der Baustein „Backprogramme“ (K7): aus Maschine, Produkten, Angaben und
   Backreihenfolge die Zeilen bauen, sortieren, nach Warenart gruppieren,
   „heute“ filtern und als HTML für Bildschirm und Druck ausgeben.
   Kein Firestore, kein DOM. Soll die Ansicht später woanders erscheinen
   (Launcher, Druckzentrale), wird dieser Baustein eingebunden, nicht
   nachgebaut.

   Braucht (vorher eingebunden, in Node über das Optionsobjekt):
     maschinen_logik.js        window.BOS_MASCHINEN (Reihenfolge, Werdegang)
     ../bos_produkte.js        window.BOS_PRODUKTE.backtagWerte — „ohne Backtage = alle Tage“
     ../teigecke/teigecke_logik.js   window.BOS_TEIGECKE_LOGIK.backtag — Wechsel um 12:00
   Fehlt eine davon, wirft zeilen() einen Fehler mit dem Namen der Datei.

   Regeln (Ulf, 23.10.2026, Kompendium M25, M30):
     - Sortierung „Backreihenfolge“ (Standard, eine Liste) oder „Nach
       Warenart“ (gruppiert nach kategorie, innerhalb Backreihenfolge).
       Gruppenfolge = erstes Vorkommen in der Backreihenfolge.
     - Filter „Alle“ oder „Heute“ = Werdegang enthält die Maschine UND
       heute ist Backtag (ab 12:00 gilt der nächste Tag).
     - Saison-Pause: weggelassen, Namen in pausiertAusgeblendet (die Seite
       zeigt sie in einer Zeile).
     - Leeres Feld = „–“ nur in der Anzeige.

   CHANGELOG
     2026-10-23 · 23:04 · v1.0 · Neu (Maschinenseite Stufe A, Bauplan Go KC 22:22)
   ================================================================ */
(function (global) {
  'use strict';

  var LEER = '–';
  var OHNE_WARENART = 'ohne Warenart';
  var SPEICHER_KEY = 'bos_maschinen_ansicht';
  var SORTIERUNGEN = ['reihenfolge', 'warenart'];
  var FILTER = ['alle', 'heute'];
  var WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function abh(o) {
    o = o || {};
    var M = o.M || global.BOS_MASCHINEN, P = o.P || global.BOS_PRODUKTE, L = o.L || global.BOS_TEIGECKE_LOGIK;
    if (!M) throw new Error('maschinen_logik.js ist nicht geladen.');
    if (!P || typeof P.backtagWerte !== 'function') throw new Error('bos_produkte.js ist nicht geladen.');
    if (!L || typeof L.backtag !== 'function') throw new Error('teigecke/teigecke_logik.js ist nicht geladen (Backtag-Wechsel 12:00).');
    return { M: M, P: P, L: L };
  }

  /* Backtag „heute“ als lokales Datum (ab 12:00 der nächste Tag). */
  function backtagHeute(jetzt, o) { return abh(o).L.backtag(jetzt || new Date()); }
  function backtagSatz(datum) {
    return 'Heute = Backtag ' + WOCHENTAG[datum.getDay()] + ', ' + zwei(datum.getDate()) + '.' + zwei(datum.getMonth() + 1) + '. (ab 12 Uhr gilt der nächste Tag)';
  }
  function backtagKurz(datum) { return WOCHENTAG[datum.getDay()] + ', ' + zwei(datum.getDate()) + '.' + zwei(datum.getMonth() + 1) + '.'; }
  /* Backtage zählen wie Date.getDay() (So = 0). Ohne gültige Backtage: jeden Tag. */
  function hatBacktag(produkt, datum, o) {
    var w = abh(o).P.backtagWerte(produkt);
    return w === null || w.indexOf(datum.getDay()) !== -1;
  }

  /* a = { maschine, produkte (Sicht 'aktive', in Produktreihenfolge), angaben { key: dok },
          reihenfolge (Liste oder null), sortierung, filter, jetzt } */
  function zeilen(a, o) {
    var d = abh(o);
    var m = a.maschine;
    var sort = SORTIERUNGEN.indexOf(a.sortierung) !== -1 ? a.sortierung : 'reihenfolge';
    var filt = FILTER.indexOf(a.filter) !== -1 ? a.filter : 'alle';
    var spalten = (m.felder || []).map(function (f) { return { id: f.id, name: f.name, art: f.art }; });
    var eigene = d.M.produkteDerMaschine(a.produkte, m.id);
    var r = d.M.inReihenfolge(eigene, a.reihenfolge || []);
    var heute = backtagHeute(a.jetzt, o);
    var pausiert = [], nichtHeute = 0, liste = [];
    r.liste.forEach(function (p) {
      if (p.pausiert === true) { pausiert.push(p.name || p.legacyKey); return; }
      if (filt === 'heute' && !hatBacktag(p, heute, o)) { nichtHeute++; return; }
      var ang = (a.angaben || {})[p.legacyKey];
      var w = ang && ang.werte ? ang.werte : {};
      liste.push({
        key: p.legacyKey, name: p.name || p.legacyKey, kategorie: p.kategorie || '',
        werte: spalten.map(function (s) { var v = w[s.id]; return v === undefined || v === null || v === '' ? null : String(v); }),
        neu: !!r.neu[p.legacyKey]
      });
    });
    var gruppen;
    if (sort === 'warenart') {
      var folge = [], je = {};
      liste.forEach(function (z) {
        var g = z.kategorie || OHNE_WARENART;
        if (!je[g]) { je[g] = []; folge.push(g); }
        je[g].push(z);
      });
      gruppen = folge.map(function (g) { return { titel: g, zeilen: je[g] }; });
    } else {
      gruppen = [{ titel: null, zeilen: liste }];
    }
    return {
      maschine: { id: m.id, name: m.name || m.id }, spalten: spalten, gruppen: gruppen,
      anzahl: liste.length, pausiertAusgeblendet: pausiert, nichtHeute: nichtHeute,
      sortierung: sort, filter: filt, heute: heute, heuteSatz: backtagSatz(heute)
    };
  }

  function wertHTML(v) { return v === null ? '<span class="ma-leer">' + LEER + '</span>' : esc(v).replace(/\n/g, '<br>'); }
  /* Tabelle für den Bildschirm (Klassen ma-*, Stil liefert die Seite). */
  function tabelleHTML(e) {
    if (!e.anzahl) return '';
    var kopf = '<tr><th>Produkt</th>' + e.spalten.map(function (s) { return '<th class="' + (s.art === 'nummer' ? 'ma-nr' : '') + '">' + esc(s.name) + '</th>'; }).join('') + '</tr>';
    var koerper = e.gruppen.map(function (g) {
      var h = g.titel !== null ? '<tr class="ma-gruppe"><th colspan="' + (e.spalten.length + 1) + '">' + esc(g.titel) + '</th></tr>' : '';
      return h + g.zeilen.map(function (z) {
        return '<tr><td class="ma-produkt">' + esc(z.name) + '</td>' + z.werte.map(function (v, i) {
          return '<td class="' + (e.spalten[i].art === 'nummer' ? 'ma-nr' : 'ma-text') + '">' + wertHTML(v) + '</td>';
        }).join('') + '</tr>';
      }).join('');
    }).join('');
    return '<table class="ma-tabelle"><thead>' + kopf + '</thead><tbody>' + koerper + '</tbody></table>';
  }
  function untertitel(e) {
    return (e.filter === 'heute' ? 'heute: Backtag ' + backtagKurz(e.heute) : 'alle Produkte') + ' · ' + (e.sortierung === 'warenart' ? 'nach Warenart' : 'Backreihenfolge');
  }
  /* Für BOS_DRUCK.drucken: { titel, inhaltHTML, extraCSS }. Papier ist weiß, Stil fest. */
  function druck(e, stand) {
    var tab = tabelleHTML(e) || '<p>Keine Produkte in dieser Ansicht.</p>';
    var pause = e.pausiertAusgeblendet.length ? '<p class="ma-fuss">' + esc(e.pausiertAusgeblendet.length + ' in Saison-Pause, nicht gedruckt: ' + e.pausiertAusgeblendet.join(', ')) + '</p>' : '';
    return {
      titel: 'Backprogramme · ' + e.maschine.name,
      inhaltHTML: '<p class="ma-unter">' + esc(untertitel(e)) + (stand ? ' · ' + esc(stand) : '') + '</p>' + tab + pause,
      extraCSS: '.ma-unter{margin:0 0 8px;font-size:10pt;color:#444}' +
        '.ma-tabelle{width:100%;border-collapse:collapse;font-size:10.5pt}' +
        '.ma-tabelle th,.ma-tabelle td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}' +
        '.ma-tabelle thead th{background:#eee}' +
        '.ma-tabelle .ma-nr{text-align:center;white-space:nowrap;width:5.5em;font-weight:700;font-size:12pt}' +
        '.ma-gruppe th{background:#f6f6f6;font-size:10pt;text-transform:uppercase;letter-spacing:.05em}' +
        '.ma-produkt{font-weight:600}.ma-leer{color:#888}' +
        '.ma-tabelle tr{page-break-inside:avoid}.ma-fuss{margin-top:8px;font-size:9pt;color:#555}'
    };
  }

  /* Gerätespeicher je Maschine (nur Komfort; ohne Speicher gilt der Standard). */
  function ansichtLaden(maschineId, speicher) {
    var aus = { sortierung: 'reihenfolge', filter: 'alle' };
    try {
      var s = speicher || global.localStorage;
      var alles = JSON.parse(s.getItem(SPEICHER_KEY) || '{}') || {};
      var x = alles[maschineId] || {};
      if (SORTIERUNGEN.indexOf(x.sortierung) !== -1) aus.sortierung = x.sortierung;
      if (FILTER.indexOf(x.filter) !== -1) aus.filter = x.filter;
    } catch (e) { /* kein Speicher: Standard */ }
    return aus;
  }
  function ansichtSpeichern(maschineId, wahl, speicher) {
    try {
      var s = speicher || global.localStorage;
      var alles = JSON.parse(s.getItem(SPEICHER_KEY) || '{}') || {};
      alles[maschineId] = { sortierung: wahl.sortierung, filter: wahl.filter };
      s.setItem(SPEICHER_KEY, JSON.stringify(alles));
      return true;
    } catch (e) { return false; }
  }

  var api = {
    LEER: LEER, OHNE_WARENART: OHNE_WARENART, SPEICHER_KEY: SPEICHER_KEY, SORTIERUNGEN: SORTIERUNGEN, FILTER: FILTER,
    backtagHeute: backtagHeute, backtagSatz: backtagSatz, backtagKurz: backtagKurz, hatBacktag: hatBacktag,
    zeilen: zeilen, tabelleHTML: tabelleHTML, untertitel: untertitel, druck: druck,
    ansichtLaden: ansichtLaden, ansichtSpeichern: ansichtSpeichern, esc: esc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_MASCHINEN_ANSICHT = api;
})(typeof window !== 'undefined' ? window : globalThis);
