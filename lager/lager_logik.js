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
   Seit Stufe 2 (RK §31): Standorte, Standort am Lagerort, Zählliste je
   Standort, Kennung des Stands (artikelId__ortId), Zählgang, Bausteine der
   Zählung und des Stands. Raster und Karte liegen NICHT hier, sondern im
   gemeinsamen Baustein bos_zaehlkarte.js (auch für den Froster gedacht).

   WICHTIG — keine Daten in dieser Datei: keine Artikel-, Lieferanten-
   oder Rezeptangaben. Das Repo ist öffentlich. Die Startlisten sind
   allgemeine Wörter. Rezeptmengen werden nie gebraucht: „Steckt in …“
   liest nur die Zutaten-KENNUNGEN der Teige.

   WARNUNG: FELDER und GRENZEN müssen zur Regel passen
   (_regeln/_protokolle/firestore_regeln_2026-11-11_lager_zaehlen.rules,
   Blöcke lager_*). test_lager.js vergleicht beides — immer beide ändern.

   CHANGELOG
     2026-11-12 · 07:52 · v4 · Feature (Zuhause im Lager, L19/L21, Freigabe Kontroll-Chat 12.11. 07:46; A23)
       Zuhause der Teigecke-Zutaten: TEIGECKE_BLATT_FELDER, blattMitZuhause (umgezogen aus teigecke_orte.html),
       wagenText, wagenVergleich, wagenSortiert, zuhauseVon, teigeckeGruppen (Ordner Teigecke nach Wagen),
       zuhauseKandidaten („＋ Zutaten hierher …“), zuhauseSperre. ordnerKontext kennt Blätter und Wagen, wenn
       die Seite sie mitgibt; ordnerZeile zeigt den Wagen in der Unterzeile. A23: ordnerBaum stellt die
       intelligenten Ordner in den Abschnitt a:uebersicht (Kopf ohne Inhalt, nurKlappen); vorfahren kennt ihn.
       Datenmodell, FELDER, pruefe(), Regel unverändert.
       lager/_protokolle/SESSION_2026-11-12_LAGER_ZUHAUSE_BAU.md
     2026-11-11 · 20:42 · v3 · Feature (Lager Ordneransicht, #120/#168; Freigabe Kontroll-Chat 20:30)
       Neu, nur rechnend (kein Firestore, kein DOM): ORDNER_INTELLIGENT (Liste der intelligenten
       Ordner, Reihenfolge = Baum), TEMP_ZEICHEN, ordnerKontext, ordnerBaum (Standort → Temperatur
       → Lagerort, Kategorien, Lieferanten), zerlegeOrdner, ordnerGueltig, startordner (F2: gemerkt,
       sonst Unsortiert solange nicht leer, sonst Alle Artikel), ordnerInhalt, ordnerZeile,
       blaetterIds (A19: jeder Artikel einmal), pfad, vorfahren, sucheUeberAlles (mit Pfad),
       archivListe, ortErsetzen/ortDazu/ortWeg (Grenze GRENZEN.orte), standHinweis (A17).
       Datenmodell, FELDER, pruefe(), Regeln unverändert.
     2026-11-11 · 06:50 · v2 · Feature (Lager Stufe 2, #120; Freigabe Kontroll-Chat
       11.11. 06:43 mit A9–A11, Kern-Freigabe Ulf 06:41)
       Neu: COL.standorte/zaehlungen/stand, FELDER lager_standorte und
       lager_orte.standortId, FELDER_ZAEHLUNG, FELDER_STAND, standortDokument,
       ortIdErlaubt (A9: kein „__“, nicht mit „_“ beginnen), standId,
       startlisteFehlende (Startliste nur gegen AKTIVE Namen, B16),
       orteNachStandort, nachStandortUndOrt, zaehlliste, erlaubteStandorte,
       zaehlStatus (Zählgang 12 Stunden, Ulf 06:41), zaehlungDokument,
       standDokument, Archivsperre Standort. STARTLISTE_ORTE bleibt nur für
       Tests (K2, Ulf 06:41: Startliste der Lagerorte entfällt).
       lager/_protokolle/SESSION_2026-11-11_LAGER_STUFE2_ZAEHLEN_BAU.md
     2026-11-02 · 00:58 · v1 · Erstfassung (Lager Stufe 1, #120)
       ANWEISUNG_2026-11-01_LAGER_STUFE1_BAUPLAN.md, Freigabe Kontroll-Chat
       01.11. 23:03 (A1–A8) und 02.11. 00:17 (A1+), Kern-Freigabe Ulf 00:39.
       lager/_protokolle/SESSION_2026-11-01_LAGER_STUFE1_BAU.md
   ================================================================ */
(function (global) {
  'use strict';

  var COL = {
    artikel: 'lager_artikel', orte: 'lager_orte', kategorien: 'lager_kategorien',
    lieferanten: 'lager_lieferanten', sicherungen: 'lager_sicherungen',
    standorte: 'lager_standorte', zaehlungen: 'lager_zaehlungen', stand: 'lager_stand'   /* Stufe 2, RK §31 */
  };
  /* = hasOnly der Regel ohne sicherungId, geaendertVon, geaendertAm */
  var FELDER = {
    lager_artikel: ['name', 'kategorieId', 'bereich', 'gebinde', 'inhaltMenge', 'inhaltEinheit', 'orte',
      'zaehlRaster', 'quellen', 'standardLieferantId', 'teigecke', 'teigeckeGruppe', 'geloescht'],
    lager_orte: ['name', 'sort', 'temperatur', 'folge', 'standortId', 'geloescht'],
    lager_standorte: ['name', 'sort', 'geloescht'],
    lager_kategorien: ['name', 'sort', 'temperatur', 'geloescht'],
    lager_lieferanten: ['name', 'liefertage', 'bestellweg', 'kontakt', 'geloescht']
  };
  var HERKUNFT = ['sicherungId', 'geaendertVon', 'geaendertAm'];
  /* Stufe 2 (RK §31): = hasOnly der Regel, ganz (diese Dokumente tragen keine Sicherung) */
  var FELDER_ZAEHLUNG = ['artikelId', 'ortId', 'standortId', 'wert', 'ersetzt', 'geraetZeit', 'konto', 'ts'];
  var FELDER_STAND = ['artikelId', 'ortId', 'standortId', 'wert', 'zaehlungId', 'konto', 'ts'];
  var STAND_TRENNER = '__';   /* A9: kommt in keiner Ort-Kennung vor */
  var GRENZEN = {
    name: 60, gebinde: 30, kontakt: 120, orte: 10, quellen: 5, folge: 300,
    zaehlRasterMax: 48, minuteMax: 1439, artikelNr: 40,
    wertMax: 99999, nachkomma: 1, zaehlgangStunden: 12   /* Stufe 2: Regel wert <= 99999; Ulf 06:41: eine Nachkommastelle, 12 Stunden */
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

  /* Startlisten: allgemeine Wörter (Ulf 01.11.2026, 20:50; Konzept §3.2).
     STARTLISTE_ORTE wird seit Stufe 2 nicht mehr angeboten (K2, Ulf 11.11., 06:41),
     bleibt nur für die Prüfwerkzeuge stehen. */
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
    if (typeof e.standortId === 'string' && e.standortId) d.standortId = e.standortId;   /* Stufe 2: kein Vorgabewert, fehlt = noch ohne Standort */
    return d;
  }
  function standortDokument(e) {
    e = e || {};
    return { name: String(e.name || '').trim(), sort: istZahl(e.sort) ? e.sort : 0, geloescht: e.geloescht === true };
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
  var BAUER = { lager_artikel: artikelDokument, lager_orte: ortDokument, lager_kategorien: kategorieDokument, lager_lieferanten: lieferantDokument,
    lager_standorte: standortDokument };

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

  /* ---------- Plausibilität Kategorie ↔ Lagerort (Hinweis, keine Sperre) ----------
     Stufe 2: Der STANDORT spielt hier keine Rolle (Standort und Temperatur sind unabhängig, L10). */
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
  function orteDesStandorts(sid, orte) { return aktiv(orte).filter(function (o) { return o.standortId === sid; }); }
  /* Sperrtext oder '' */
  function archivSperre(col, id, d) {
    var namen = function (l) { return l.map(function (x) { return x.name; }).join(', '); };
    var l;
    if (col === COL.standorte && (l = orteDesStandorts(id, d.orte)).length) return 'Archivieren geht nicht: zu diesem Standort gehören noch die Lagerorte ' + namen(l) + '.';
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

  /* ================= Stufe 2: Standorte und Zählen (RK §31) ================= */

  /* A9: Ort-Kennungen ohne „__“ und nicht mit „_“ am Anfang. Dann ist die
     Stand-Kennung artikelId + '__' + ortId eindeutig: die letzte Fundstelle
     von „__“ ist immer der Trenner. Der Editor vergibt Auto-Kennungen
     (collection().doc(), nur Buchstaben und Ziffern). */
  function ortIdErlaubt(id) { return typeof id === 'string' && ID_MUSTER.test(id) && id.charAt(0) !== '_' && id.indexOf(STAND_TRENNER) === -1; }
  function standId(artikelId, ortId) { return String(artikelId) + STAND_TRENNER + String(ortId); }
  function standIdZerlegt(sid) {
    var s = String(sid || ''), i = s.lastIndexOf(STAND_TRENNER);
    return i <= 0 ? null : { artikelId: s.slice(0, i), ortId: s.slice(i + STAND_TRENNER.length) };
  }

  /* Startliste: nur Namen, die nicht schon AKTIV da sind (B16 — das Archiv zählt nicht). */
  function startlisteFehlende(vorlage, liste) {
    var da = {}; aktiv(liste).forEach(function (x) { da[norm(x.name)] = true; });
    return (vorlage || []).filter(function (v) { return !da[norm(v.name)]; });
  }

  /* Lagerorte nach Standort: „Noch ohne Standort“ zuerst (auch Standort archiviert/unbekannt),
     dann die aktiven Standorte nach Reihenfolge, darin die Orte nach Rundgang. Leere Standorte bleiben sichtbar. */
  function orteNachStandort(orte, standorte) {
    var sm = nachId(aktiv(standorte)), akt = aktiv(orte), g = [];
    var ohne = akt.filter(function (o) { return !sm[o.standortId]; }).sort(nachSort);
    if (ohne.length) g.push({ schluessel: '_ohne', titel: 'Noch ohne Standort', orte: ohne });
    aktiv(standorte).slice().sort(nachSort).forEach(function (s) {
      g.push({ schluessel: s.id, titel: s.name, standort: s, orte: akt.filter(function (o) { return o.standortId === s.id; }).sort(nachSort) });
    });
    return g;
  }
  /* Artikel „nach Ort“ mit Standort-Überschriften: [{ standort|null, titel, gruppen: <nachOrt-Gruppen> }]
     „Ohne festen Ort“ bleibt als erste Gruppe ohne Standort-Überschrift. */
  function nachStandortUndOrt(artikel, orte, standorte) {
    var gruppen = nachOrt(artikel, orte), aus = [], ohneOrt = gruppen.filter(function (x) { return x.schluessel === '_ohne'; });
    if (ohneOrt.length) aus.push({ schluessel: '_ohneort', titel: '', standort: null, gruppen: ohneOrt });
    orteNachStandort(orte, standorte).forEach(function (sg) {
      var ids = sg.orte.map(function (o) { return o.id; });
      var gr = ids.map(function (id) { return gruppen.filter(function (x) { return x.schluessel === id; })[0]; }).filter(Boolean);
      aus.push({ schluessel: sg.schluessel, titel: sg.titel, standort: sg.standort || null, gruppen: gr });
    });
    return aus;
  }

  /* Welche Standorte darf dieses Konto zählen? Rolle admin: alle aktiven (Ventil K1).
     Sonst die aktiven aus konto.lagerZaehlenStandorte. Archivierte nie. */
  function erlaubteStandorte(konto, standorte) {
    var k = konto || {}, liste = Array.isArray(k.lagerZaehlenStandorte) ? k.lagerZaehlenStandorte : [];
    return aktiv(standorte).filter(function (s) { return k.role === 'admin' || liste.indexOf(s.id) !== -1; }).sort(nachSort);
  }

  /* Zählliste eines Standorts: seine aktiven Orte nach Rundgang, je Ort die aktiven Artikel,
     die dort fest hingehören (artikel.orte), in der Reihenfolge des Ortes (folge, dann Name).
     [{ ort, artikel: [...] }] — Orte ohne Artikel bleiben drin (die Seite zeigt sie). */
  function zaehlliste(standortId, orte, artikel) {
    var akt = aktiv(artikel);
    return aktiv(orte).filter(function (o) { return o.standortId === standortId; }).sort(nachSort).map(function (o) {
      return { ort: o, artikel: artikelInFolge(o, akt.filter(function (a) { return (a.orte || []).indexOf(o.id) !== -1; })) };
    });
  }

  /* Zeichen in der Zählliste: 'gezaehlt' (✓, Zahl > 0), 'null' (–, bewusst 0), 'offen' (○).
     Gezählt gilt nur im laufenden Zählgang: Stand jünger als GRENZEN.zaehlgangStunden.
     stand = { wert, tsMs } (die Seite rechnet den Zeitstempel in Millisekunden um). */
  function zaehlStatus(stand, jetztMs, stunden) {
    var h = istZahl(stunden) ? stunden : GRENZEN.zaehlgangStunden;
    if (!stand || !istZahl(stand.wert) || !istZahl(stand.tsMs)) return { zeichen: 'offen', wert: null };
    if (jetztMs - stand.tsMs > h * 3600000) return { zeichen: 'offen', wert: null };
    return { zeichen: stand.wert === 0 ? 'null' : 'gezaehlt', wert: stand.wert };
  }

  /* Bausteine für den Batch (ts setzt die Seite als serverTimestamp). */
  function zaehlungDokument(e) {
    var d = { artikelId: String(e.artikelId), ortId: String(e.ortId), standortId: String(e.standortId), wert: e.wert, konto: String(e.konto) };
    if (typeof e.ersetzt === 'string' && e.ersetzt) d.ersetzt = e.ersetzt;
    if (istGanz(e.geraetZeit)) d.geraetZeit = e.geraetZeit;
    return d;
  }
  function standDokument(zaehlungId, z) {
    return { artikelId: z.artikelId, ortId: z.ortId, standortId: z.standortId, wert: z.wert, zaehlungId: zaehlungId, konto: z.konto };
  }
  /* Eingabe-Grenze der Regel: Zahl, 0 … wertMax. Kommastellen prüft der Baustein. */
  function wertGueltig(w) { return istZahl(w) && w >= 0 && w <= GRENZEN.wertMax; }

  /* =================================================================
     Ordneransicht (L16, #168). Baum, Ordner-Inhalt, Pfad, Suche — nur
     berechnet, nichts gespeichert. Kennungen der Ordner (Text):
       i:<id>                 intelligenter Ordner (ORDNER_INTELLIGENT)
       a:standorte|kategorien|lieferanten   Abschnittskopf
       s:<standortId>         Standort
       t:<standortId>:<temp>  Temperatur-Zwischenüberschrift (klickbar, „Gesamtkühlung“)
       o:<ortId>              Lagerort
       k:<kategorieId>  l:<lieferantId>
       x:startliste           Handlung „Startliste anlegen“ (nur Kategorien, B16/K2)
     Wörter für die Anzeige stehen NICHT hier, sondern im Wörterbuch der
     Seite (schluessel = i18n-Schlüssel). Daten-Namen kommen aus den Daten.
     ================================================================= */
  /* Ein neuer intelligenter Ordner = ein Eintrag (§2a). kx = Kontext aus ordnerKontext(). */
  var ORDNER_INTELLIGENT = [
    { id: 'alle', zeichen: '📦', art: 'artikel', immer: true, filter: function () { return true; } },
    { id: 'unsortiert', zeichen: '📥', art: 'artikel', immer: true, filter: function (a, kx) { return !(a.orte || []).some(function (o) { return kx.om[o]; }); } },
    { id: 'pruefen', zeichen: '⚠︎', art: 'artikel', filter: function (a, kx) { return plausibel(a, kx.km, kx.om).length > 0; } },
    { id: 'ohne_kat', zeichen: '🏷', art: 'artikel', filter: function (a, kx) { return !kx.km[a.kategorieId]; } },
    { id: 'ohne_ber', zeichen: '◌', art: 'artikel', filter: function (a) { return !a.bereich; } },
    { id: 'orte_ohne', zeichen: '📍', art: 'orte', filter: function (o, kx) { return !kx.sm[o.standortId]; } },
    { id: 'uebernahme', zeichen: '⇣', art: 'eigen', zahl: function (kx) { return kx.kandidaten; } },
    { id: 'teigecke', zeichen: '🥖', art: 'artikel', filter: function (a) { return a.teigecke === true; } },
    { id: 'archiv', zeichen: '🗄', art: 'eigen', zahl: function (kx) { return kx.archiv; } }
  ];
  var TEMP_ZEICHEN = { ungekuehlt: '▫', gekuehlt: '❄', tk: '🧊' };
  var ORDNER_SPALTEN = ['standorte', 'kategorien', 'lieferanten'];

  /* daten = { artikel, orte, standorte, kategorien, lieferanten, kandidaten (Zahl) } */
  function ordnerKontext(daten) {
    var d = daten || {};
    var alle = ['artikel', 'orte', 'standorte', 'kategorien', 'lieferanten'];
    var archiv = 0;
    alle.forEach(function (k) { archiv += (d[k] || []).filter(function (x) { return x && x.geloescht; }).length; });
    return {
      artikel: aktiv(d.artikel), orte: aktiv(d.orte), standorte: aktiv(d.standorte), kategorien: aktiv(d.kategorien), lieferanten: aktiv(d.lieferanten),
      om: nachId(aktiv(d.orte)), sm: nachId(aktiv(d.standorte)), km: nachId(aktiv(d.kategorien)), lm: nachId(aktiv(d.lieferanten)),
      kandidaten: istZahl(d.kandidaten) ? d.kandidaten : 0, archiv: archiv, roh: d,
      /* Zuhause im Lager (L19): Teigecke-Blätter und Wagen, nur wenn die Seite sie mitgibt */
      mitWagen: Array.isArray(d.teigeckeOrte), bm: nachId(d.blaetter || []), wagen: aktiv(d.teigeckeOrte || []), wm: nachId(aktiv(d.teigeckeOrte || []))
    };
  }
  function tempVon(o) { return TEMP_ORT.indexOf(o && o.temperatur) !== -1 ? o.temperatur : 'ungekuehlt'; }
  function artikelAnOrten(ids, kx) {
    var m = {}; ids.forEach(function (i) { m[i] = true; });
    return kx.artikel.filter(function (a) { return (a.orte || []).some(function (o) { return m[o]; }); });
  }
  function intelligentZahl(e, kx) {
    if (e.zahl) return e.zahl(kx);
    if (e.art === 'orte') return kx.orte.filter(function (o) { return e.filter(o, kx); }).length;
    return kx.artikel.filter(function (a) { return e.filter(a, kx); }).length;
  }
  /* Baum als Knoten für bos_ordnerbaum.js. opt.liste = ORDNER_INTELLIGENT (zum Testen austauschbar). */
  function ordnerBaum(daten, opt) {
    var kx = ordnerKontext(daten), o = opt || {}, liste = o.liste || ORDNER_INTELLIGENT, wurzel = [];
    /* A23 (KC 12.11.): die intelligenten Ordner stehen im Abschnitt ÜBERSICHT. Der Kopf ist kein Ordner (nurKlappen). */
    var ue = { id: 'a:uebersicht', art: 'abschnitt', schluessel: 'abschnitt_uebersicht', nurKlappen: true, kinder: [] };
    liste.forEach(function (e) {
      var n = intelligentZahl(e, kx);
      if (!e.immer && !n) return;
      var k = { id: 'i:' + e.id, art: 'intelligent', schluessel: 'ordner_' + e.id, zeichen: e.zeichen, zahl: n, kinder: [] };
      if (e.art === 'orte') {
        k.kinder = kx.orte.filter(function (x) { return e.filter(x, kx); }).sort(nachSort).map(function (x) {
          return { id: 'o:' + x.id, art: 'ort', name: x.name, zahl: artikelAmOrt(x.id, kx.artikel).length, mitKarte: true, kinder: [] };
        });
      }
      ue.kinder.push(k);
    });
    wurzel.push(ue);
    var st = { id: 'a:standorte', art: 'abschnitt', schluessel: 'abschnitt_standorte', hinzu: 'hinzu_standort', kinder: [] };
    kx.standorte.slice().sort(nachSort).forEach(function (s) {
      var orte = kx.orte.filter(function (x) { return x.standortId === s.id; }).sort(nachSort);
      var sk = { id: 's:' + s.id, art: 'standort', name: s.name, zahl: artikelAnOrten(orte.map(function (x) { return x.id; }), kx).length, mitKarte: true, hinzu: 'hinzu_ort', kinder: [] };
      TEMP_ORT.forEach(function (tp) {
        var to = orte.filter(function (x) { return tempVon(x) === tp; });
        if (!to.length) return;
        sk.kinder.push({ id: 't:' + s.id + ':' + tp, art: 'temperatur', schluessel: 'temp_' + tp, zeichen: TEMP_ZEICHEN[tp],
          zahl: artikelAnOrten(to.map(function (x) { return x.id; }), kx).length,
          kinder: to.map(function (x) { return { id: 'o:' + x.id, art: 'ort', name: x.name, zahl: artikelAmOrt(x.id, kx.artikel).length, mitKarte: true, kinder: [] }; }) });
      });
      st.kinder.push(sk);
    });
    wurzel.push(st);
    var ka = { id: 'a:kategorien', art: 'abschnitt', schluessel: 'abschnitt_kategorien', hinzu: 'hinzu_kategorie', kinder: [] };
    kx.kategorien.slice().sort(nachSort).forEach(function (k) { ka.kinder.push({ id: 'k:' + k.id, art: 'kategorie', name: k.name, zahl: artikelDerKategorie(k.id, kx.artikel).length, mitKarte: true, kinder: [] }); });
    var fehlt = !kx.kategorien.length ? startlisteFehlende(STARTLISTE_KATEGORIEN, (daten || {}).kategorien) : [];
    if (fehlt.length) ka.kinder.push({ id: 'x:startliste', art: 'aktion', schluessel: 'startliste_kategorien', werte: { n: fehlt.length }, kinder: [] });
    wurzel.push(ka);
    var li = { id: 'a:lieferanten', art: 'abschnitt', schluessel: 'abschnitt_lieferanten', hinzu: 'hinzu_lieferant', kinder: [] };
    kx.lieferanten.slice().sort(nachName).forEach(function (l) { li.kinder.push({ id: 'l:' + l.id, art: 'lieferant', name: l.name, zahl: artikelDesLieferanten(l.id, kx.artikel).length, mitKarte: true, kinder: [] }); });
    wurzel.push(li);
    return wurzel;
  }
  function zerlegeOrdner(sel) {
    var s = String(sel || ''), i = s.indexOf(':');
    if (i < 1) return null;
    var art = s.slice(0, i), rest = s.slice(i + 1);
    if (art === 't') { var j = rest.lastIndexOf(':'); return j < 1 ? null : { art: 't', id: rest.slice(0, j), temperatur: rest.slice(j + 1) }; }
    return { art: art, id: rest };
  }
  /* Gibt es den Ordner (noch)? Für den gemerkten Ordner. */
  function ordnerGueltig(sel, daten, opt) {
    var z = zerlegeOrdner(sel); if (!z) return false;
    var kx = ordnerKontext(daten), liste = (opt && opt.liste) || ORDNER_INTELLIGENT;
    if (z.art === 'i') { var e = liste.filter(function (x) { return x.id === z.id; })[0]; return !!e && (e.immer || intelligentZahl(e, kx) > 0); }
    if (z.art === 'a') return ORDNER_SPALTEN.indexOf(z.id) !== -1;
    if (z.art === 's') return !!kx.sm[z.id];
    if (z.art === 't') return !!kx.sm[z.id] && kx.orte.some(function (o) { return o.standortId === z.id && tempVon(o) === z.temperatur; });
    if (z.art === 'o') return !!kx.om[z.id];
    if (z.art === 'k') return !!kx.km[z.id];
    if (z.art === 'l') return !!kx.lm[z.id];
    return false;
  }
  /* Startordner (Ulf F2, 20:29): gemerkter, wenn gültig; sonst „Unsortiert“, solange dort etwas liegt; sonst „Alle Artikel“. */
  function startordner(daten, gemerkt) {
    if (gemerkt && ordnerGueltig(gemerkt, daten)) return gemerkt;
    var kx = ordnerKontext(daten);
    return intelligentZahl(ORDNER_INTELLIGENT[1], kx) > 0 ? 'i:unsortiert' : 'i:alle';
  }
  /* Eine Artikelzeile. ortId = Ort des Ordners (oder null). Marken (§11): heute Teigecke, Prüfen, liegt auch in / liegt in. zahl: Platz für Stufe 3. */
  function ordnerZeile(a, ortId, kx, ohneKategorie) {
    var marken = [];
    if (a.teigecke === true) marken.push({ art: 'teigecke' });
    var p = plausibel(a, kx.km, kx.om);
    if (p.length) marken.push({ art: 'pruefen', text: p.join(' ') });
    var orte = (a.orte || []).filter(function (o) { return kx.om[o]; }).map(function (o) { return kx.om[o]; }).sort(nachSort);
    var andere = orte.filter(function (o) { return o.id !== ortId; }).map(function (o) { return o.name; });
    if (ortId && andere.length) marken.push({ art: 'auchin', orte: andere });
    if (!ortId && andere.length) marken.push({ art: 'liegtin', orte: andere });
    var kat = kx.km[a.kategorieId], l = kx.lm[a.standardLieferantId];
    var unter = [];
    if (!ohneKategorie && kat) unter.push(kat.name);
    var g = gebindeText(a); if (g) unter.push(g);
    unter.push(zaehlText(a));
    if (l) unter.push(l.name);
    var zh = a.teigecke === true && kx.mitWagen ? zuhauseVon(a, kx) : null;   /* L19: Wagen in der Unterzeile, Silo braucht keinen */
    if (zh && !zh.silo) unter.push('🥖 ' + (zh.wagen ? zh.wagen.kennung : 'noch ohne Zuhause'));
    return { artikel: a, id: a.id, ortId: ortId || null, marken: marken, unter: unter, zahl: null };
  }
  /* Inhalt eines Ordners. opt.sortierung: 'ort' | 'kategorie' (nur „Alle Artikel“).
     art: 'artikel' (gruppen mit zeilen) · 'orte' (Liste mit ▲▼) · 'liste' (Abschnitt) · 'eigen' (Seite zeichnet selbst) · null (unbekannt) */
  function ordnerInhalt(sel, daten, opt) {
    var z = zerlegeOrdner(sel), kx = ordnerKontext(daten), o = opt || {}, liste = o.liste || ORDNER_INTELLIGENT;
    var nachNameZeilen = function (arr, ohneKat) { return arr.slice().sort(nachName).map(function (a) { return ordnerZeile(a, null, kx, ohneKat); }); };
    if (!z) return { art: null };
    if (z.art === 'i') {
      var e = liste.filter(function (x) { return x.id === z.id; })[0];
      if (!e) return { art: null };
      if (e.art === 'eigen') return { art: 'eigen', id: e.id };
      if (e.id === 'teigecke' && kx.mitWagen) return { art: 'artikel', wagen: true, gruppen: teigeckeGruppen(kx) };   /* L19 */
      if (e.art === 'orte') return { art: 'orte', orte: kx.orte.filter(function (x) { return e.filter(x, kx); }).sort(nachSort) };
      if (e.id === 'alle') {
        if (o.sortierung === 'kategorie') {
          return { art: 'artikel', gruppen: nachKategorie(kx.artikel, kx.kategorien).map(function (g) {
            return { schluessel: g.schluessel, titel: g.titel, kategorieId: g.schluessel === '_ohne' ? null : g.schluessel, zeilen: g.artikel.map(function (a) { return ordnerZeile(a, null, kx, true); }) };
          }) };
        }
        var gr = [];
        nachStandortUndOrt(kx.artikel, kx.orte, kx.standorte).forEach(function (sg) {
          sg.gruppen.forEach(function (g) {
            var oid = g.schluessel === '_ohne' ? null : g.schluessel;
            gr.push({ schluessel: g.schluessel, titel: g.titel, standortTitel: sg.titel || '', ortId: oid, zeilen: g.artikel.map(function (a) { return ordnerZeile(a, oid, kx); }) });
          });
        });
        return { art: 'artikel', gruppen: gr };
      }
      return { art: 'artikel', gruppen: [{ schluessel: e.id, titel: '', zeilen: nachNameZeilen(kx.artikel.filter(function (a) { return e.filter(a, kx); })) }] };
    }
    if (z.art === 'a') return ORDNER_SPALTEN.indexOf(z.id) !== -1 ? { art: 'liste', col: COL[z.id] } : { art: null };
    if (z.art === 's') return kx.sm[z.id] ? { art: 'orte', standortId: z.id, orte: kx.orte.filter(function (x) { return x.standortId === z.id; }).sort(nachSort) } : { art: null };
    if (z.art === 't') {
      var to = kx.orte.filter(function (x) { return x.standortId === z.id && tempVon(x) === z.temperatur; }).sort(nachSort);
      return { art: 'artikel', gesamt: true, gruppen: to.map(function (x) {
        return { schluessel: x.id, titel: x.name, ortId: x.id, zeilen: artikelInFolge(x, artikelAmOrt(x.id, kx.artikel)).map(function (a) { return ordnerZeile(a, x.id, kx); }) };
      }) };
    }
    if (z.art === 'o') {
      var ort = kx.om[z.id]; if (!ort) return { art: null };
      return { art: 'artikel', ortId: ort.id, gruppen: [{ schluessel: ort.id, titel: '', ortId: ort.id, zeilen: artikelInFolge(ort, artikelAmOrt(ort.id, kx.artikel)).map(function (a) { return ordnerZeile(a, ort.id, kx); }) }] };
    }
    if (z.art === 'k') return kx.km[z.id] ? { art: 'artikel', kategorieId: z.id, gruppen: [{ schluessel: z.id, titel: '', zeilen: nachNameZeilen(artikelDerKategorie(z.id, kx.artikel), true) }] } : { art: null };
    if (z.art === 'l') return kx.lm[z.id] ? { art: 'artikel', lieferantId: z.id, gruppen: [{ schluessel: z.id, titel: '', zeilen: nachNameZeilen(artikelDesLieferanten(z.id, kx.artikel)) }] } : { art: null };
    return { art: null };
  }
  /* A19: Reihenfolge für ‹ › — jeder Artikel nur einmal, beim ersten Vorkommen. */
  function blaetterIds(inhalt) {
    var ids = [];
    ((inhalt && inhalt.gruppen) || []).forEach(function (g) { (g.zeilen || []).forEach(function (z) { if (ids.indexOf(z.id) === -1) ids.push(z.id); }); });
    return ids;
  }
  /* Pfad eines Ordners: [{ id, name } | { id, schluessel, zeichen }] — von außen nach innen. */
  function pfad(sel, daten) {
    var z = zerlegeOrdner(sel), kx = ordnerKontext(daten);
    if (!z) return [];
    var stK = function (s) { return { id: 's:' + s.id, name: s.name }; };
    var tK = function (sid, tp) { return { id: 't:' + sid + ':' + tp, schluessel: 'temp_' + tp, zeichen: TEMP_ZEICHEN[tp] }; };
    if (z.art === 'i') return [{ id: sel, schluessel: 'ordner_' + z.id }];
    if (z.art === 'a') return [{ id: sel, schluessel: 'abschnitt_' + z.id }];
    if (z.art === 's') return kx.sm[z.id] ? [stK(kx.sm[z.id])] : [];
    if (z.art === 't') return kx.sm[z.id] ? [stK(kx.sm[z.id]), tK(z.id, z.temperatur)] : [];
    if (z.art === 'o') {
      var o = kx.om[z.id]; if (!o) return [];
      var s = kx.sm[o.standortId];
      return s ? [stK(s), tK(s.id, tempVon(o)), { id: sel, name: o.name }] : [{ id: 'i:orte_ohne', schluessel: 'ordner_orte_ohne' }, { id: sel, name: o.name }];
    }
    if (z.art === 'k') return kx.km[z.id] ? [{ id: 'a:kategorien', schluessel: 'abschnitt_kategorien' }, { id: sel, name: kx.km[z.id].name }] : [];
    if (z.art === 'l') return kx.lm[z.id] ? [{ id: 'a:lieferanten', schluessel: 'abschnitt_lieferanten' }, { id: sel, name: kx.lm[z.id].name }] : [];
    return [];
  }
  /* Wo liegt der Ordner im Baum? Kennungen der Vorfahren (zum Aufklappen). */
  function vorfahren(sel, daten) {
    var ids = pfad(sel, daten).map(function (x) { return x.id; }).filter(function (id) { return id !== sel; });
    if (/^[st]:/.test(sel) || (ids[0] && /^s:/.test(ids[0]))) ids.unshift('a:standorte');
    if (/^i:/.test(sel) || (ids[0] && /^i:/.test(ids[0]))) ids.unshift('a:uebersicht');   /* A23 */
    return ids;
  }
  /* Suche über alles (aktive Einträge). Artikel: Name, Gebinde, Artikelnummern. Ein Artikel an n Orten hat n Pfade. */
  function sucheUeberAlles(daten, text) {
    var n = norm(text), kx = ordnerKontext(daten), aus = [];
    if (!n) return { treffer: [], archiv: 0 };
    var passt = function (s) { return norm(s).indexOf(n) !== -1; };
    var artikelPasst = function (a) { return passt(a.name) || passt(a.gebinde) || (istKarte(a.quellen) && Object.keys(a.quellen).some(function (k) { return passt(a.quellen[k]); })); };
    kx.artikel.filter(artikelPasst).sort(nachName).forEach(function (a) {
      var orte = (a.orte || []).filter(function (o) { return kx.om[o]; });
      aus.push({ art: 'artikel', id: a.id, name: a.name, pfade: orte.length ? orte.map(function (o) { return pfad('o:' + o, daten); }) : [[{ id: 'i:unsortiert', schluessel: 'ordner_unsortiert' }]] });
    });
    kx.orte.filter(function (o) { return passt(o.name); }).sort(nachName).forEach(function (o) { aus.push({ art: 'ort', id: 'o:' + o.id, name: o.name, pfade: [pfad('o:' + o.id, daten).slice(0, -1)] }); });
    kx.standorte.filter(function (s) { return passt(s.name); }).sort(nachName).forEach(function (s) { aus.push({ art: 'standort', id: 's:' + s.id, name: s.name, pfade: [[{ id: 'a:standorte', schluessel: 'abschnitt_standorte' }]] }); });
    kx.kategorien.filter(function (k) { return passt(k.name); }).sort(nachName).forEach(function (k) { aus.push({ art: 'kategorie', id: 'k:' + k.id, name: k.name, pfade: [[{ id: 'a:kategorien', schluessel: 'abschnitt_kategorien' }]] }); });
    kx.lieferanten.filter(function (l) { return passt(l.name); }).sort(nachName).forEach(function (l) { aus.push({ art: 'lieferant', id: 'l:' + l.id, name: l.name, pfade: [[{ id: 'a:lieferanten', schluessel: 'abschnitt_lieferanten' }]] }); });
    var archiv = 0, d = daten || {};
    ['artikel', 'orte', 'standorte', 'kategorien', 'lieferanten'].forEach(function (k) { archiv += (d[k] || []).filter(function (x) { return x && x.geloescht && passt(x.name); }).length; });
    return { treffer: aus, archiv: archiv };
  }
  /* Archiv: je Sammlung die archivierten Einträge nach Name. */
  function archivListe(daten) {
    var d = daten || {};
    return ['artikel', 'orte', 'standorte', 'kategorien', 'lieferanten'].map(function (k) {
      return { col: COL[k], eintraege: (d[k] || []).filter(function (x) { return x && x.geloescht; }).sort(nachName) };
    }).filter(function (g) { return g.eintraege.length; });
  }
  /* Verschieben / Liegt auch hier / Hier entfernen — neue orte-Liste oder { fehler }. Nur das Feld orte ändert sich. */
  function ortErsetzen(a, alt, neu) {
    var l = ((a && a.orte) || []).slice();
    if (!neu || neu === alt) return { fehler: 'gleich' };
    var i = l.indexOf(alt);
    if (l.indexOf(neu) !== -1) { if (i !== -1) l.splice(i, 1); return { orte: l }; }   /* liegt dort schon: nur vom alten weg */
    if (i === -1) { if (l.length >= GRENZEN.orte) return { fehler: 'grenze' }; l.push(neu); return { orte: l }; }
    l[i] = neu;
    return { orte: l };
  }
  function ortDazu(a, ort) {
    var l = ((a && a.orte) || []).slice();
    if (!ort) return { fehler: 'gleich' };
    if (l.indexOf(ort) !== -1) return { fehler: 'schon' };
    if (l.length >= GRENZEN.orte) return { fehler: 'grenze' };
    l.push(ort);
    return { orte: l };
  }
  function ortWeg(a, ort) {
    var l = ((a && a.orte) || []).slice(), i = l.indexOf(ort);
    if (i === -1) return { fehler: 'nicht_da' };
    l.splice(i, 1);
    return { orte: l };
  }
  /* A17: Was sagt die Rückfrage über den gezählten Stand am alten Ort?
     stand = { wert, tsMs } | null (gelesen im Moment der Handlung). altOrt/neuOrt = Ort-Dokumente (neuOrt null bei „entfernen“). */
  function standHinweis(stand, jetztMs, altOrt, neuOrt, stunden) {
    var s = zaehlStatus(stand, jetztMs, stunden);
    return {
      imZaehlgang: s.zeichen !== 'offen', wert: s.zeichen !== 'offen' ? s.wert : null,
      andererStandort: !!(neuOrt && altOrt && (neuOrt.standortId || '') !== (altOrt.standortId || ''))
    };
  }

  /* ================================================================
     ZUHAUSE DER TEIGECKE-ZUTATEN IM LAGER (L19, Bauplan 12.11. 07:24, Freigabe KC 07:46)
     Die Wahrheit bleibt im Feld ortId am Teigecke-Blatt (teigecke_zutaten/{artikelId}).
     Das Lager ist seit diesem Schritt der einzige Schreiber; Teigecke · Orte zeigt nur an.
     ================================================================ */
  /* = FELDER.teigecke_zutaten der Orte-Seite vor diesem Bau (A1+): die alten Felder werden unverändert
     mitgeschrieben, nur ortId ändert sich — die Regel erlaubt per diff() nur ortId + Herkunft. */
  var TEIGECKE_BLATT_FELDER = ['name', 'ortId', 'gebindeGroesse', 'gebindeEinheit', 'gruppe', 'geloescht'];
  var WAGEN_KENNUNG = /^([A-Z])([0-9]{2,3})$/;   /* = teigecke_logik.js KENNUNG_ORT */
  /* Blatt mit neuem Zuhause (umgezogen aus teigecke_orte.html blattMitZuhause): das rohe Blatt mit neuem
     ortId, oder ein neues nur mit ortId. vorher = rohes Blatt ohne id (für die Sicherung). */
  function blattMitZuhause(roh, ortId) {
    var d = {};
    if (roh) TEIGECKE_BLATT_FELDER.forEach(function (k) { if (roh[k] !== undefined) d[k] = roh[k]; });
    d.ortId = String(ortId || '');
    var vorher = null;
    if (roh) { vorher = Object.assign({}, roh); delete vorher.id; }
    return { daten: d, vorher: vorher, aktion: roh ? 'aendern' : 'anlegen' };
  }
  function wagenText(w) { return w ? w.kennung + (w.bereichName ? ' · ' + w.bereichName : '') + (w.name ? ' · ' + w.name : '') : ''; }
  function wagenVergleich(a, b) {   /* = teigecke_logik.js kennungVergleich */
    var za = WAGEN_KENNUNG.exec(String(a.kennung || '').trim().toUpperCase()), zb = WAGEN_KENNUNG.exec(String(b.kennung || '').trim().toUpperCase());
    if (za && zb) return za[1] === zb[1] ? parseInt(za[2], 10) - parseInt(zb[2], 10) : (za[1] < zb[1] ? -1 : 1);
    if (za || zb) return za ? -1 : 1;
    return String(a.kennung || '').localeCompare(String(b.kennung || ''), 'de', { numeric: true });
  }
  function wagenSortiert(teigeckeOrte) { return aktiv(teigeckeOrte).slice().sort(wagenVergleich); }
  /* Zuhause eines Artikels: Silo braucht keins; ein archivierter oder unbekannter Wagen zählt als „ohne“
     (wie teigecke_logik.js ortInhalt). */
  function zuhauseVon(a, kx) {
    var b = kx.bm[a.id], oid = b && b.ortId ? b.ortId : '';
    return { silo: a.teigeckeGruppe === 'silo', ortId: oid, wagen: oid && kx.wm[oid] ? kx.wm[oid] : null };
  }
  /* Ordner „Teigecke“ nach Wagen: „Noch ohne Zuhause“ zuerst, dann jeder aktive Wagen (auch leer, damit man
     ihn füllen kann) in Kennungsfolge, zuletzt Silo. */
  function teigeckeGruppen(kx) {
    var ohne = [], silo = [], je = {};
    kx.wagen.forEach(function (w) { je[w.id] = []; });
    kx.artikel.filter(function (a) { return a.teigecke === true; }).forEach(function (a) {
      var zh = zuhauseVon(a, kx);
      if (zh.silo) silo.push(a); else if (zh.wagen) je[zh.wagen.id].push(a); else ohne.push(a);
    });
    var zeilen = function (arr) { return arr.slice().sort(nachName).map(function (a) { return ordnerZeile(a, null, kx); }); };
    var gr = [];
    if (ohne.length) gr.push({ schluessel: '_ohne', titel: 'Noch ohne Zuhause', wagenId: '', zeilen: zeilen(ohne) });
    kx.wagen.slice().sort(wagenVergleich).forEach(function (w) { gr.push({ schluessel: 'w:' + w.id, titel: wagenText(w), wagenId: w.id, zeilen: zeilen(je[w.id]) }); });
    if (silo.length) gr.push({ schluessel: '_silo', titel: 'Silo · braucht kein Zuhause', wagenId: null, zeilen: zeilen(silo) });
    return gr;
  }
  /* „＋ Zutaten hierher …“ (Ersatz für „Hierher holen“ in Orte): ohne Zuhause zuerst, dann aus anderen Wagen. Silo nie. */
  function zuhauseKandidaten(daten, wagenId) {
    var kx = ordnerKontext(daten), ohne = [], andere = [];
    kx.artikel.filter(function (a) { return a.teigecke === true; }).sort(nachName).forEach(function (a) {
      var zh = zuhauseVon(a, kx);
      if (zh.silo) return;
      if (!zh.wagen) ohne.push(a);
      else if (zh.wagen.id !== wagenId) andere.push({ artikel: a, wagen: zh.wagen });
    });
    return { ohne: ohne, andere: andere };
  }
  /* Grund, warum ein Artikel (so wie gespeichert) kein Zuhause bekommt: 'nicht_teigecke' | 'silo' | '' */
  function zuhauseSperre(gespeichert) {
    if (!gespeichert || gespeichert.teigecke !== true || gespeichert.geloescht) return 'nicht_teigecke';
    if (gespeichert.teigeckeGruppe === 'silo') return 'silo';
    return '';
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
    verschiebe: verschiebe, naechsteSort: naechsteSort,
    /* Stufe 2 */
    FELDER_ZAEHLUNG: FELDER_ZAEHLUNG, FELDER_STAND: FELDER_STAND, STAND_TRENNER: STAND_TRENNER,
    standortDokument: standortDokument, orteDesStandorts: orteDesStandorts, ortIdErlaubt: ortIdErlaubt,
    standId: standId, standIdZerlegt: standIdZerlegt, startlisteFehlende: startlisteFehlende,
    orteNachStandort: orteNachStandort, nachStandortUndOrt: nachStandortUndOrt, erlaubteStandorte: erlaubteStandorte,
    zaehlliste: zaehlliste, zaehlStatus: zaehlStatus, zaehlungDokument: zaehlungDokument, standDokument: standDokument,
    wertGueltig: wertGueltig,
    /* Ordneransicht (#168) */
    ORDNER_INTELLIGENT: ORDNER_INTELLIGENT, TEMP_ZEICHEN: TEMP_ZEICHEN, ordnerKontext: ordnerKontext, ordnerBaum: ordnerBaum,
    zerlegeOrdner: zerlegeOrdner, ordnerGueltig: ordnerGueltig, startordner: startordner, ordnerInhalt: ordnerInhalt, ordnerZeile: ordnerZeile,
    blaetterIds: blaetterIds, pfad: pfad, vorfahren: vorfahren, sucheUeberAlles: sucheUeberAlles, archivListe: archivListe,
    ortErsetzen: ortErsetzen, ortDazu: ortDazu, ortWeg: ortWeg, standHinweis: standHinweis, tempVon: tempVon,
    TEIGECKE_BLATT_FELDER: TEIGECKE_BLATT_FELDER, blattMitZuhause: blattMitZuhause, wagenText: wagenText, wagenVergleich: wagenVergleich,
    wagenSortiert: wagenSortiert, zuhauseVon: zuhauseVon, teigeckeGruppen: teigeckeGruppen, zuhauseKandidaten: zuhauseKandidaten, zuhauseSperre: zuhauseSperre
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_LAGER_LOGIK = api;
})(typeof window !== 'undefined' ? window : globalThis);
