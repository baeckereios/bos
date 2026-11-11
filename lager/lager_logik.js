/* ================================================================
   BäckereiOS · Lager — reine Logik (kein DOM, kein Firestore)
   ================================================================
   Einbindung:  <script src="lager_logik.js"></script>
   Stellt bereit: window.BOS_LAGER_LOGIK
   Test:        node test_lager.js --repo=<bos-Ordner>   (Prüfwerkzeug, außerhalb des Repos)

   Was hier liegt: Feldlisten und Grenzen (gleich der Firestore-Regel,
   RK §30), Dokumente bauen und prüfen, Startlisten, Archivsperren,
   Plausibilität Kategorie ↔ Lagerort, „Steckt in …“, Übernahme aus der
   Teigecke, Sortierung nach Ort / nach Kategorie.

   WICHTIG — keine Daten in dieser Datei: keine Artikel-, Lieferanten-
   oder Rezeptangaben. Das Repo ist öffentlich. Die Startlisten sind
   allgemeine Wörter. Rezeptmengen werden nie gebraucht: „Steckt in …“
   liest nur die Zutaten-KENNUNGEN der Teige.

   WARNUNG: FELDER und GRENZEN müssen zur Regel passen
   (_regeln/_protokolle/firestore_regeln_2026-11-02_lager.rules,
   Blöcke lager_*). test_lager.js vergleicht beides — immer beide ändern.

   CHANGELOG
     2026-11-02 · 00:58 · v1 · Erstfassung (Lager Stufe 1, #120)
       ANWEISUNG_2026-11-01_LAGER_STUFE1_BAUPLAN.md, Freigabe Kontroll-Chat
       01.11. 23:03 (A1–A8) und 02.11. 00:17 (A1+), Kern-Freigabe Ulf 00:39.
       lager/_protokolle/SESSION_2026-11-01_LAGER_STUFE1_BAU.md
   ================================================================ */
(function (global) {
  'use strict';

  var COL = {
    artikel: 'lager_artikel', orte: 'lager_orte', kategorien: 'lager_kategorien',
    lieferanten: 'lager_lieferanten', sicherungen: 'lager_sicherungen'
  };
  /* = hasOnly der Regel ohne sicherungId, geaendertVon, geaendertAm */
  var FELDER = {
    lager_artikel: ['name', 'kategorieId', 'bereich', 'gebinde', 'inhaltMenge', 'inhaltEinheit', 'orte',
      'zaehlRaster', 'quellen', 'standardLieferantId', 'teigecke', 'teigeckeGruppe', 'geloescht'],
    lager_orte: ['name', 'sort', 'temperatur', 'folge', 'geloescht'],
    lager_kategorien: ['name', 'sort', 'temperatur', 'geloescht'],
    lager_lieferanten: ['name', 'liefertage', 'bestellweg', 'kontakt', 'geloescht']
  };
  var HERKUNFT = ['sicherungId', 'geaendertVon', 'geaendertAm'];
  var GRENZEN = {
    name: 60, gebinde: 30, kontakt: 120, orte: 10, quellen: 5, folge: 300,
    zaehlRasterMax: 48, minuteMax: 1439, artikelNr: 40
  };
  var BEREICHE = ['', 'baeckerei', 'konditorei', 'beide'];
  var EINHEITEN = ['', 'kg', 'l', 'stk'];   /* = teigecke_logik.js EINHEITEN */
  var TEMP_ORT = ['ungekuehlt', 'gekuehlt', 'tk'];
  var TEMP_KATEGORIE = ['', 'gekuehlt', 'tk'];
  var BESTELLWEGE = ['', 'mail', 'telefon', 'fax', 'portal', 'vertreter'];
  var TAGE = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  var TEIGECKE_GRUPPEN = ['mehle', 'koerner', 'fluessig', 'salz_backmittel', 'vorstufen', 'kuehlung', 'silo', 'sonstiges'];   /* = teigecke_logik.js GRUPPEN */
  var ID_MUSTER = /^[A-Za-z0-9_]{2,40}$/;
  var GEBINDE_VORSCHLAEGE = ['Sack', 'Karton', 'Eimer', 'Kanister', 'Beutel', 'Dose', 'Flasche', 'Palette', 'Stück'];

  /* Startlisten: allgemeine Wörter (Ulf 01.11.2026, 20:50; Konzept §3.2). */
  var STARTLISTE_ORTE = [
    { name: 'Kühlung 1', temperatur: 'gekuehlt' }, { name: 'Kühlung 2', temperatur: 'gekuehlt' },
    { name: 'Kühlung 3', temperatur: 'gekuehlt' }, { name: 'Kühlung 4', temperatur: 'gekuehlt' },
    { name: 'Froster 1', temperatur: 'tk' }, { name: 'Froster 2', temperatur: 'tk' },
    { name: 'Vorratslager', temperatur: 'ungekuehlt' }
  ];
  var STARTLISTE_KATEGORIEN = [
    { name: 'Trockenrohstoffe', temperatur: '' }, { name: 'Kühlware', temperatur: 'gekuehlt' },
    { name: 'TK-Rohstoffe', temperatur: 'tk' }, { name: 'TK-Kaufware', temperatur: 'tk' },
    { name: 'Konserven', temperatur: '' }, { name: 'Verpackung', temperatur: '' }, { name: 'Reinigung', temperatur: '' }
  ];

  /* ---------- Hilfen ---------- */
  function istZahl(x) { return typeof x === 'number' && isFinite(x); }
  function istGanz(x) { return istZahl(x) && Math.floor(x) === x; }
  function istKarte(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function aktiv(liste) { return (liste || []).filter(function (x) { return x && !x.geloescht; }); }
  function nachId(liste) { var m = {}; (liste || []).forEach(function (x) { if (x && x.id) m[x.id] = x; }); return m; }
  function norm(text) { return String(text || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function nachName(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'de'); }
  function nachSort(a, b) {
    var sa = istZahl(a.sort) ? a.sort : Infinity, sb = istZahl(b.sort) ? b.sort : Infinity;
    return sa === sb ? nachName(a, b) : (sa < sb ? -1 : 1);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function kopie(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function kanonisch(x) {
    if (Array.isArray(x)) return x.map(kanonisch);
    if (x && typeof x === 'object') { var o = {}; Object.keys(x).sort().forEach(function (k) { o[k] = kanonisch(x[k]); }); return o; }
    return x;
  }
  function ohneHerkunft(dok) { var k = Object.assign({}, dok || {}); delete k.id; HERKUNFT.forEach(function (f) { delete k[f]; }); return k; }
  /* Gleich im Inhalt (ohne id, Sicherung, Herkunft) — für „Unverändertes nicht schreiben“. */
  function inhaltGleich(a, b) { return JSON.stringify(kanonisch(ohneHerkunft(a))) === JSON.stringify(kanonisch(ohneHerkunft(b))); }

  /* ---------- Uhrzeit als Minuten (A4: keine Regex mit | in der Regel) ---------- */
  function minuteText(m) {
    if (!istGanz(m) || m < 0 || m > GRENZEN.minuteMax) return '';
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function minuteAus(text) {
    var t = String(text || '').trim().replace('.', ':');
    var r = /^(\d{1,2}):(\d{2})$/.exec(t) || /^(\d{1,2})$/.exec(t);
    if (!r) return null;
    var h = Number(r[1]), mi = r[2] !== undefined ? Number(r[2]) : 0;
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  /* ---------- Dokumente bauen (nur bekannte Felder, Typen sauber) ---------- */
  function artikelDokument(e) {
    e = e || {};
    var d = {
      name: String(e.name || '').trim(),
      kategorieId: String(e.kategorieId || ''),
      bereich: BEREICHE.indexOf(e.bereich) !== -1 ? e.bereich : '',
      orte: Array.isArray(e.orte) ? e.orte.filter(function (x, i, a) { return typeof x === 'string' && x && a.indexOf(x) === i; }) : [],
      quellen: {},
      standardLieferantId: '',
      teigecke: e.teigecke === true,
      geloescht: e.geloescht === true
    };
    if (typeof e.gebinde === 'string' && e.gebinde.trim()) d.gebinde = e.gebinde.trim();
    if (istZahl(e.inhaltMenge) && e.inhaltMenge > 0) d.inhaltMenge = e.inhaltMenge;
    if (EINHEITEN.indexOf(e.inhaltEinheit) > 0) d.inhaltEinheit = e.inhaltEinheit;
    if (istGanz(e.zaehlRaster) && e.zaehlRaster > 0) d.zaehlRaster = e.zaehlRaster;
    if (istKarte(e.quellen)) Object.keys(e.quellen).forEach(function (lid) { if (lid) d.quellen[lid] = String(e.quellen[lid] == null ? '' : e.quellen[lid]).trim(); });
    if (typeof e.standardLieferantId === 'string' && d.quellen[e.standardLieferantId] !== undefined) d.standardLieferantId = e.standardLieferantId;
    if (d.teigecke && TEIGECKE_GRUPPEN.indexOf(e.teigeckeGruppe) !== -1) d.teigeckeGruppe = e.teigeckeGruppe;
    return d;
  }
  function ortDokument(e) {
    e = e || {};
    var d = { name: String(e.name || '').trim(), sort: istZahl(e.sort) ? e.sort : 0,
      temperatur: TEMP_ORT.indexOf(e.temperatur) !== -1 ? e.temperatur : 'ungekuehlt', geloescht: e.geloescht === true };
    if (Array.isArray(e.folge) && e.folge.length) d.folge = e.folge.filter(function (x, i, a) { return typeof x === 'string' && a.indexOf(x) === i; });
    return d;
  }
  function kategorieDokument(e) {
    e = e || {};
    return { name: String(e.name || '').trim(), sort: istZahl(e.sort) ? e.sort : 0,
      temperatur: TEMP_KATEGORIE.indexOf(e.temperatur) !== -1 ? e.temperatur : '', geloescht: e.geloescht === true };
  }
  function lieferantDokument(e) {
    e = e || {};
    var lt = {};
    if (istKarte(e.liefertage)) TAGE.forEach(function (tag) {
      var x = e.liefertage[tag];
      if (istKarte(x) && TAGE.indexOf(x.bisTag) !== -1 && istGanz(x.bisMinute)) lt[tag] = { bisTag: x.bisTag, bisMinute: x.bisMinute };
    });
    var d = { name: String(e.name || '').trim(), liefertage: lt, geloescht: e.geloescht === true };
    if (BESTELLWEGE.indexOf(e.bestellweg) > 0) d.bestellweg = e.bestellweg;
    if (typeof e.kontakt === 'string' && e.kontakt.trim()) d.kontakt = e.kontakt.trim();
    return d;
  }
  var BAUER = { lager_artikel: artikelDokument, lager_orte: ortDokument, lager_kategorien: kategorieDokument, lager_lieferanten: lieferantDokument };

  /* ---------- Prüfen: dieselben Grenzen wie die Regel, plus Namen eindeutig ----------
     liefert eine Liste von Texten (leer = in Ordnung). liste = alle Dokumente der Sammlung. */
  function pruefe(col, d, id, liste) {
    var f = [];
    if (!d.name) f.push('Der Name fehlt.');
    else if (d.name.length > GRENZEN.name) f.push('Der Name ist zu lang (höchstens ' + GRENZEN.name + ' Zeichen).');
    var gleich = (liste || []).filter(function (x) { return x.id !== id && !x.geloescht && norm(x.name) === norm(d.name); })[0];
    if (d.name && gleich) f.push('„' + d.name + '“ gibt es schon.');
    if (col === COL.artikel) {
      if ((d.gebinde || '').length > GRENZEN.gebinde) f.push('Gebinde: höchstens ' + GRENZEN.gebinde + ' Zeichen.');
      if (d.orte.length > GRENZEN.orte) f.push('Höchstens ' + GRENZEN.orte + ' feste Lagerorte.');
      if (Object.keys(d.quellen).length > GRENZEN.quellen) f.push('Höchstens ' + GRENZEN.quellen + ' Lieferanten.');
      Object.keys(d.quellen).forEach(function (k) { if (d.quellen[k].length > GRENZEN.artikelNr) f.push('Artikelnummer zu lang (höchstens ' + GRENZEN.artikelNr + ' Zeichen).'); });
      if (d.zaehlRaster !== undefined && !(istGanz(d.zaehlRaster) && d.zaehlRaster >= 1 && d.zaehlRaster <= GRENZEN.zaehlRasterMax)) f.push('Raster: ganze Zahl von 1 bis ' + GRENZEN.zaehlRasterMax + '.');
    }
    if (col === COL.orte && (d.folge || []).length > GRENZEN.folge) f.push('Zu viele Artikel in der Reihenfolge.');
    if (col === COL.lieferanten && (d.kontakt || '').length > GRENZEN.kontakt) f.push('Kontakt: höchstens ' + GRENZEN.kontakt + ' Zeichen.');
    return f;
  }

  /* ---------- Anzeige ---------- */
  var EINHEIT_TEXT = { kg: 'kg', l: 'L', stk: 'Stk' };
  function gebindeText(a) {
    if (!a) return '';
    var inhalt = istZahl(a.inhaltMenge) && a.inhaltMenge > 0 ? String(a.inhaltMenge).replace('.', ',') + (EINHEIT_TEXT[a.inhaltEinheit || ''] ? ' ' + EINHEIT_TEXT[a.inhaltEinheit] : '') : '';
    return [a.gebinde || '', inhalt].filter(Boolean).join(' · ');
  }
  function zaehlText(a) { return a && istGanz(a.zaehlRaster) && a.zaehlRaster > 0 ? 'Raster bis ' + a.zaehlRaster : 'Zahlenfeld'; }
  var TAG_TEXT = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
  /* „Mo (bis So 14:00) · Do (bis Mi 10:00)“ */
  function liefertageText(l) {
    var lt = (l && l.liefertage) || {};
    var teile = TAGE.filter(function (t) { return lt[t]; }).map(function (t) { return TAG_TEXT[t] + ' (bis ' + TAG_TEXT[lt[t].bisTag] + ' ' + minuteText(lt[t].bisMinute) + ')'; });
    return teile.join(' · ');
  }

  /* ---------- Plausibilität Kategorie ↔ Lagerort (Hinweis, keine Sperre) ---------- */
  function plausibel(a, kategorienMap, orteMap) {
    var k = kategorienMap && kategorienMap[a.kategorieId];
    if (!k || !k.temperatur) return [];
    var h = [];
    (a.orte || []).forEach(function (oid) {
      var o = orteMap && orteMap[oid];
      if (!o || o.geloescht) return;
      if (k.temperatur === 'gekuehlt' && o.temperatur === 'ungekuehlt') h.push('„' + k.name + '“ braucht Kühlung, „' + o.name + '“ ist ungekühlt.');
      if (k.temperatur === 'tk' && o.temperatur !== 'tk') h.push('„' + k.name + '“ braucht Tiefkühlung, „' + o.name + '“ ist kein TK-Ort.');
    });
    return h;
  }

  /* ---------- Archivsperren (die Regel kann sie nicht prüfen, RK §30) ---------- */
  function artikelAmOrt(ortId, artikel) { return aktiv(artikel).filter(function (a) { return (a.orte || []).indexOf(ortId) !== -1; }); }
  function artikelDerKategorie(kid, artikel) { return aktiv(artikel).filter(function (a) { return a.kategorieId === kid; }); }
  function artikelDesLieferanten(lid, artikel) { return aktiv(artikel).filter(function (a) { return istKarte(a.quellen) && Object.prototype.hasOwnProperty.call(a.quellen, lid); }); }
  function teigeMitArtikel(id, teige) {
    return aktiv(teige).filter(function (t) { return ['zutaten', 'vorstufeZutaten', 'beiBedarf'].some(function (f) { return (t[f] || []).indexOf(id) !== -1; }); });
  }
  /* Sperrtext oder '' */
  function archivSperre(col, id, d) {
    var namen = function (l) { return l.map(function (x) { return x.name; }).join(', '); };
    var l;
    if (col === COL.orte && (l = artikelAmOrt(id, d.artikel)).length) return 'Archivieren geht nicht: an diesem Ort liegen noch ' + namen(l) + '.';
    if (col === COL.kategorien && (l = artikelDerKategorie(id, d.artikel)).length) return 'Archivieren geht nicht: zu dieser Kategorie gehören noch ' + namen(l) + '.';
    if (col === COL.lieferanten && (l = artikelDesLieferanten(id, d.artikel)).length) return 'Archivieren geht nicht: dieser Lieferant liefert noch ' + namen(l) + '.';
    if (col === COL.artikel && (l = teigeMitArtikel(id, d.teige)).length) return 'Archivieren geht nicht: der Artikel steht noch im Teig ' + namen(l) + '. Erst dort herausnehmen.';
    return '';
  }
  /* „In der Teigecke handverwogen“ ausschalten: gesperrt wie das Archivieren */
  function teigeckeAusSperre(id, teige) {
    var l = teigeMitArtikel(id, teige);
    return l.length ? 'Geht nicht: der Artikel steht noch im Teig ' + l.map(function (x) { return x.name; }).join(', ') + '.' : '';
  }

  /* ---------- „Steckt in …“: Zutat → Teig → Brote (ausTeig). Keine Rezeptmengen. ---------- */
  function stecktIn(id, teige, produkte) {
    return teigeMitArtikel(id, teige).sort(nachName).map(function (t) {
      var brote = (produkte || []).filter(function (p) { return p && p.ausTeig === t.id && !p.geloescht; }).map(function (p) { return p.name; })
        .sort(function (a, b) { return String(a).localeCompare(String(b), 'de'); });
      return { teigId: t.id, teig: t.name, brote: brote };
    });
  }

  /* ---------- Übernahme aus der Teigecke (A1: nur der Stamm entsteht) ---------- */
  /* Kandidaten: Blätter mit eigenem name und ohne Stamm. */
  function uebernahmeKandidaten(blaetter, stamm) {
    var sm = nachId(stamm || []);
    return (blaetter || []).filter(function (b) { return b && b.id && typeof b.name === 'string' && !sm[b.id]; })
      .slice().sort(nachName);
  }
  /* Stamm-Dokument aus einem alten Blatt. Kein Vorgabewert für bereich (A5),
     Kategorie offen; die Gruppe ohne Feld wie in der Teigecke „sonstiges“. */
  function uebernahmeDokument(b) {
    var d = { name: String(b.name || '').trim(), kategorieId: '', bereich: '', orte: [], quellen: {}, standardLieferantId: '',
      teigecke: true, teigeckeGruppe: TEIGECKE_GRUPPEN.indexOf(b.gruppe) !== -1 ? b.gruppe : 'sonstiges', geloescht: b.geloescht === true };
    if (istZahl(b.gebindeGroesse) && b.gebindeGroesse > 0) d.inhaltMenge = b.gebindeGroesse;
    if (EINHEITEN.indexOf(b.gebindeEinheit) > 0) d.inhaltEinheit = b.gebindeEinheit;
    return d;
  }

  /* ---------- Übersicht: nach Ort / nach Kategorie ----------
     liefert [{ schluessel, titel, artikel: [...] }]. Ein Artikel an zwei Orten
     steht unter beiden. Gruppen ohne Zuordnung zuerst („Noch ohne …“). */
  function artikelInFolge(ort, liste) {
    var m = nachId(liste), drin = {}, aus = [];
    ((ort && ort.folge) || []).forEach(function (id) { if (m[id] && !drin[id]) { drin[id] = true; aus.push(m[id]); } });
    liste.slice().sort(nachName).forEach(function (a) { if (!drin[a.id]) aus.push(a); });
    return aus;
  }
  function nachOrt(artikel, orte) {
    var akt = artikel || [];
    var om = nachId(aktiv(orte));
    var ohne = akt.filter(function (a) { return !(a.orte || []).some(function (o) { return om[o]; }); }).sort(nachName);
    var g = [];
    if (ohne.length) g.push({ schluessel: '_ohne', titel: 'Ohne festen Ort', artikel: ohne });
    aktiv(orte).slice().sort(nachSort).forEach(function (o) {
      var l = akt.filter(function (a) { return (a.orte || []).indexOf(o.id) !== -1; });
      g.push({ schluessel: o.id, titel: o.name, ort: o, artikel: artikelInFolge(o, l) });
    });
    return g;
  }
  function nachKategorie(artikel, kategorien) {
    var akt = artikel || [];
    var km = nachId(aktiv(kategorien));
    var ohne = akt.filter(function (a) { return !km[a.kategorieId]; }).sort(nachName);
    var g = [];
    if (ohne.length) g.push({ schluessel: '_ohne', titel: 'Noch ohne Kategorie', artikel: ohne });
    aktiv(kategorien).slice().sort(nachSort).forEach(function (k) {
      g.push({ schluessel: k.id, titel: k.name, kategorie: k, artikel: akt.filter(function (a) { return a.kategorieId === k.id; }).sort(nachName) });
    });
    return g;
  }
  function suche(artikel, text) {
    var n = norm(text);
    if (!n) return artikel;
    return (artikel || []).filter(function (a) { return norm(a.name).indexOf(n) !== -1 || norm(a.gebinde).indexOf(n) !== -1; });
  }
  function verschiebe(liste, i, r) {
    var l = (liste || []).slice(), j = i + r;
    if (i < 0 || j < 0 || i >= l.length || j >= l.length) return l;
    var x = l[i]; l[i] = l[j]; l[j] = x;
    return l;
  }
  /* nächste sort-Zahl am Ende (Schritte von 10, Lücken zum Einschieben) */
  function naechsteSort(liste) {
    var max = 0; (liste || []).forEach(function (x) { if (istZahl(x.sort) && x.sort > max) max = x.sort; });
    return max + 10;
  }

  var api = {
    COL: COL, FELDER: FELDER, HERKUNFT: HERKUNFT, GRENZEN: GRENZEN, BEREICHE: BEREICHE, EINHEITEN: EINHEITEN,
    TEMP_ORT: TEMP_ORT, TEMP_KATEGORIE: TEMP_KATEGORIE, BESTELLWEGE: BESTELLWEGE, TAGE: TAGE, TAG_TEXT: TAG_TEXT,
    TEIGECKE_GRUPPEN: TEIGECKE_GRUPPEN, ID_MUSTER: ID_MUSTER, GEBINDE_VORSCHLAEGE: GEBINDE_VORSCHLAEGE,
    STARTLISTE_ORTE: STARTLISTE_ORTE, STARTLISTE_KATEGORIEN: STARTLISTE_KATEGORIEN,
    istZahl: istZahl, istGanz: istGanz, aktiv: aktiv, nachId: nachId, norm: norm, nachName: nachName, nachSort: nachSort,
    esc: esc, kopie: kopie, ohneHerkunft: ohneHerkunft, inhaltGleich: inhaltGleich,
    minuteText: minuteText, minuteAus: minuteAus,
    artikelDokument: artikelDokument, ortDokument: ortDokument, kategorieDokument: kategorieDokument, lieferantDokument: lieferantDokument,
    BAUER: BAUER, pruefe: pruefe,
    gebindeText: gebindeText, zaehlText: zaehlText, liefertageText: liefertageText,
    plausibel: plausibel, artikelAmOrt: artikelAmOrt, artikelDerKategorie: artikelDerKategorie,
    artikelDesLieferanten: artikelDesLieferanten, teigeMitArtikel: teigeMitArtikel,
    archivSperre: archivSperre, teigeckeAusSperre: teigeckeAusSperre, stecktIn: stecktIn,
    uebernahmeKandidaten: uebernahmeKandidaten, uebernahmeDokument: uebernahmeDokument,
    artikelInFolge: artikelInFolge, nachOrt: nachOrt, nachKategorie: nachKategorie, suche: suche,
    verschiebe: verschiebe, naechsteSort: naechsteSort
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_LAGER_LOGIK = api;
})(typeof window !== 'undefined' ? window : globalThis);
