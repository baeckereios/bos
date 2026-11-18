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

   Seit Stufe 3a (RK §32): Anforderungslisten und Bestellungen
   (lager_listen), Korrekturen, Mindestmengen, Bestand je Ort, Hauptort,
   „Bitte nachbestellen“, Druckansicht der Liste.

   Seit 18.11.2026 (RK §34, Ein Name überall): Personen-Nummer an Eintrag,
   Abschluss und Korrektur (vonPerson, abgeschlossenPerson, person).

   WARNUNG: FELDER und GRENZEN müssen zur Regel passen
   (_regeln/_protokolle/firestore_regeln_2026-11-18_namen.rules,
   Blöcke lager_*). test_lager.js und test_lager_anfordern.js vergleichen
   beides — immer beide ändern.

   CHANGELOG
     2026-11-18 · 05:45 · v7 · Ein Name überall (RK §34; Bauplan 04:28, Go KC 04:42): FELDER_LISTE,
       FELDER_EINTRAG, FELDER_KORREKTUR um die Personen-Nummer; eintragDokument mit vonPerson,
       abschlussFelder(von, name, person). Sonst unverändert.
       _protokolle/SESSION_2026-11-18_NAMEN_RUFNAME_BAU.md
     2026-11-16 · 09:52 · v6 · Feature (Lager Stufe 3a, #169; Freigabe Kontroll-Chat 16.11. 08:44/08:49 mit A27–A29,
       Kern-Freigabe Ulf 08:42 für Regel/Konten)
       Neu, nur rechnend: COL listen/korrekturen/mindest, FELDER_LISTE/EINTRAG/KORREKTUR/MINDEST (= Regel RK §32),
       GRENZEN mengeMax/mindestMax/posMax/hinweisStunden, listeId, neuePosId, mengeGueltig/mengeAus/mengeText,
       Bausteine (neueListeDokument, eintragDokument, abschlussFelder, korrekturDokument, mindestDokument),
       offeneListe, juengsteAbgeschlossen (A28), orteImStandort/hauptort/alsHauptort (A27), buchungenAus,
       bestandAb (T0), bestand je Ort (Bauplan §3.2), bestandAlle, bestandAmOrt, nachbestellen, listeNachOrt,
       druckHTML/DRUCK_CSS. Geändert: archivSperre (Ort mit rechnerischem Bestand), zaehlliste (noch: „liegt hier
       noch?“), ordnerKontext (bestand), ordnerZeile (zahl), ORDNER_INTELLIGENT + „Unter Mindestmenge“ (Übersicht).
       Bestehende FELDER und pruefe() unverändert.
       lager/_protokolle/SESSION_2026-11-12_LAGER_STUFE3A_BAU.md
     2026-11-16 · 04:36 · v5 · Feature (Baum neu ordnen, A24/L25; Freigabe Kontroll-Chat 16.11. 04:27 mit A25/A26)
       ORDNER_INTELLIGENT: Feld abschnitt (uebersicht/standorte/kategorien/lieferanten) und ohne (sichtbar
       abgesetzt, Knoten-Art 'ohne'). „Unsortiert“ → „ohne Lagerort“ (i:ohne_ort, unten bei STANDORTE, nur bei
       Treffern), „Lagerorte ohne Standort“ unten bei STANDORTE, „ohne Kategorie“ unten bei KATEGORIEN, neu „ohne
       Lieferant“ (i:ohne_lief: keine aktive Bezugsquelle) unten bei LIEFERANTEN. Neuer Abschnitt TEIGECKE
       (a:teigecke, Kopf = Ordner nach Wagen; Kinder w:_ohne, w:<wagenId>, w:_silo), i:teigecke entfällt.
       Neu: statusZaehler (A25/A26: dieselben Filter wie der Baum), ordnerAltNeu (gemerkte alte Kennungen),
       pfad/vorfahren nach Abschnitt. Datenmodell, FELDER, pruefe(), Regel unverändert.
       lager/_protokolle/SESSION_2026-11-12_LAGER_BAUM_NEU_BAU.md
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
    standorte: 'lager_standorte', zaehlungen: 'lager_zaehlungen', stand: 'lager_stand',   /* Stufe 2, RK §31 */
    listen: 'lager_listen', korrekturen: 'lager_korrekturen', mindest: 'lager_mindest'     /* Stufe 3a, RK §32 */
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
    wertMax: 99999, nachkomma: 1, zaehlgangStunden: 12,   /* Stufe 2: Regel wert <= 99999; Ulf 06:41: eine Nachkommastelle, 12 Stunden */
    mengeMax: 9999, mindestMax: 99999, posMax: 200, hinweisStunden: 24   /* Stufe 3a: Regel RK §32; A28: 24 Stunden */
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
    /* Stufe 3a: rechnerischer Bestand am Ort (nur wenn die Seite Stand und Buchungen mitgibt) */
    if (col === COL.orte && d.stand && (l = bestandAmOrt(d, id)).length) {
      return 'Archivieren geht nicht: hier liegt rechnerisch noch ' + l.map(function (x) { return x.artikel.name + ' ' + mengeText(x.wert); }).join(', ') + '. Erst zählen (0), dann archivieren.';
    }
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
     [{ ort, artikel: [...], noch: [...] }] — Orte ohne Artikel bleiben drin (die Seite zeigt sie).
     Stufe 3a (B26, Bauplan §6.3): noch = aktive Artikel, die dort NICHT mehr fest liegen, aber einen Stand > 0
     haben („liegt hier noch?“, ans Ende des Orts). stand = { artikelId__ortId: { wert } } (fehlt = keine). */
  function zaehlliste(standortId, orte, artikel, stand) {
    var akt = aktiv(artikel), st = stand || {};
    return aktiv(orte).filter(function (o) { return o.standortId === standortId; }).sort(nachSort).map(function (o) {
      var fest = akt.filter(function (a) { return (a.orte || []).indexOf(o.id) !== -1; });
      var noch = akt.filter(function (a) { var s = st[standId(a.id, o.id)]; return fest.indexOf(a) === -1 && s && istZahl(s.wert) && s.wert > 0; }).sort(nachName);
      return { ort: o, artikel: artikelInFolge(o, fest), noch: noch };
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
  /* Ein neuer intelligenter Ordner = ein Eintrag (§2a). kx = Kontext aus ordnerKontext().
     abschnitt (A24): wo er im Baum hängt — 'uebersicht' (oben) oder unten in 'standorte' / 'kategorien' / 'lieferanten'.
     ohne: ein „ohne …“-Ordner (Knoten-Art 'ohne', die Seite setzt ihn sichtbar ab). Reihenfolge = Reihenfolge im Abschnitt. */
  var ORDNER_INTELLIGENT = [
    { id: 'alle', abschnitt: 'uebersicht', zeichen: '📦', art: 'artikel', immer: true, filter: function () { return true; } },
    { id: 'pruefen', abschnitt: 'uebersicht', zeichen: '⚠︎', art: 'artikel', filter: function (a, kx) { return plausibel(a, kx.km, kx.om).length > 0; } },
    { id: 'ohne_ber', abschnitt: 'uebersicht', zeichen: '◌', art: 'artikel', filter: function (a) { return !a.bereich; } },
    /* Stufe 3a: über alle Standorte; nur wenn die Seite den Bestand mitgibt (kx.bestand) */
    { id: 'unter_mindest', abschnitt: 'uebersicht', zeichen: '📉', art: 'artikel', filter: function (a, kx) { return unterMindestIn(a, kx).length > 0; } },
    { id: 'uebernahme', abschnitt: 'uebersicht', zeichen: '⇣', art: 'eigen', zahl: function (kx) { return kx.kandidaten; } },
    { id: 'archiv', abschnitt: 'uebersicht', zeichen: '🗄', art: 'eigen', zahl: function (kx) { return kx.archiv; } },
    { id: 'ohne_ort', abschnitt: 'standorte', ohne: true, zeichen: '📥', art: 'artikel', filter: function (a, kx) { return !(a.orte || []).some(function (o) { return kx.om[o]; }); } },
    { id: 'orte_ohne', abschnitt: 'standorte', ohne: true, zeichen: '📍', art: 'orte', filter: function (o, kx) { return !kx.sm[o.standortId]; } },
    { id: 'ohne_kat', abschnitt: 'kategorien', ohne: true, zeichen: '🏷', art: 'artikel', filter: function (a, kx) { return !kx.km[a.kategorieId]; } },
    { id: 'ohne_lief', abschnitt: 'lieferanten', ohne: true, zeichen: '🚚', art: 'artikel', filter: function (a, kx) { return !(istKarte(a.quellen) && Object.keys(a.quellen).some(function (l) { return kx.lm[l]; })); } }
  ];
  /* Gemerkte Kennungen von vor A24 (bos_lager_ordner, bos_lager_baum_offen) → neue. Wo sich nur der Platz änderte, blieb die Kennung. */
  var ORDNER_ALT_NEU = { 'i:unsortiert': 'i:ohne_ort', 'i:teigecke': 'a:teigecke' };
  function ordnerAltNeu(sel) { return Object.prototype.hasOwnProperty.call(ORDNER_ALT_NEU, sel) ? ORDNER_ALT_NEU[sel] : sel; }
  /* Statuszeile (A25/A26): „n Artikel“ immer, dann nur Zähler über 0 — aus denselben Filtern wie der Baum. */
  var STATUS_FOLGE = ['ohne_ort', 'ohne_kat', 'ohne_lief', 'ohne_ber', 'pruefen', 'orte_ohne'];
  var TEMP_ZEICHEN = { ungekuehlt: '▫', gekuehlt: '❄', tk: '🧊' };
  var ORDNER_SPALTEN = ['standorte', 'kategorien', 'lieferanten'];
  var ABSCHNITTE = ['uebersicht', 'standorte', 'teigecke', 'kategorien', 'lieferanten'];
  function eintragVon(id, liste) { return (liste || ORDNER_INTELLIGENT).filter(function (x) { return x.id === id; })[0] || null; }
  function abschnittVon(e) { return e && ABSCHNITTE.indexOf(e.abschnitt) !== -1 && e.abschnitt !== 'teigecke' ? e.abschnitt : 'uebersicht'; }

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
      mitWagen: Array.isArray(d.teigeckeOrte), bm: nachId(d.blaetter || []), wagen: aktiv(d.teigeckeOrte || []), wm: nachId(aktiv(d.teigeckeOrte || [])),
      /* Stufe 3a: { standortId: { artikelId: bestand() } }, nur wenn die Seite ihn mitgibt */
      bestand: istKarte(d.bestand) ? d.bestand : null
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
  /* Baum als Knoten für bos_ordnerbaum.js. opt.liste = ORDNER_INTELLIGENT (zum Testen austauschbar).
     A24: Abschnitte ÜBERSICHT, STANDORTE, TEIGECKE, KATEGORIEN, LIEFERANTEN; die Einträge der Liste hängen unten an ihrem Abschnitt. */
  function ordnerBaum(daten, opt) {
    var kx = ordnerKontext(daten), o = opt || {}, liste = o.liste || ORDNER_INTELLIGENT, wurzel = [];
    var eintraege = function (ab) {
      return liste.filter(function (e) { return abschnittVon(e) === ab; }).map(function (e) {
        var n = intelligentZahl(e, kx);
        if (!e.immer && !n) return null;
        var k = { id: 'i:' + e.id, art: e.ohne ? 'ohne' : 'intelligent', schluessel: 'ordner_' + e.id, zeichen: e.zeichen, zahl: n, kinder: [] };
        if (e.art === 'orte') {
          k.kinder = kx.orte.filter(function (x) { return e.filter(x, kx); }).sort(nachSort).map(function (x) {
            return { id: 'o:' + x.id, art: 'ort', name: x.name, zahl: artikelAmOrt(x.id, kx.artikel).length, mitKarte: true, kinder: [] };
          });
        }
        return k;
      }).filter(Boolean);
    };
    /* A23 (KC 12.11.): Kopf ÜBERSICHT ist kein Ordner (nurKlappen). */
    wurzel.push({ id: 'a:uebersicht', art: 'abschnitt', schluessel: 'abschnitt_uebersicht', nurKlappen: true, kinder: eintraege('uebersicht') });
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
    st.kinder = st.kinder.concat(eintraege('standorte'));
    wurzel.push(st);
    wurzel.push(teigeckeAbschnitt(kx));
    var ka = { id: 'a:kategorien', art: 'abschnitt', schluessel: 'abschnitt_kategorien', hinzu: 'hinzu_kategorie', kinder: [] };
    kx.kategorien.slice().sort(nachSort).forEach(function (k) { ka.kinder.push({ id: 'k:' + k.id, art: 'kategorie', name: k.name, zahl: artikelDerKategorie(k.id, kx.artikel).length, mitKarte: true, kinder: [] }); });
    var fehlt = !kx.kategorien.length ? startlisteFehlende(STARTLISTE_KATEGORIEN, (daten || {}).kategorien) : [];
    if (fehlt.length) ka.kinder.push({ id: 'x:startliste', art: 'aktion', schluessel: 'startliste_kategorien', werte: { n: fehlt.length }, kinder: [] });
    ka.kinder = ka.kinder.concat(eintraege('kategorien'));
    wurzel.push(ka);
    var li = { id: 'a:lieferanten', art: 'abschnitt', schluessel: 'abschnitt_lieferanten', hinzu: 'hinzu_lieferant', kinder: [] };
    kx.lieferanten.slice().sort(nachName).forEach(function (l) { li.kinder.push({ id: 'l:' + l.id, art: 'lieferant', name: l.name, zahl: artikelDesLieferanten(l.id, kx.artikel).length, mitKarte: true, kinder: [] }); });
    li.kinder = li.kinder.concat(eintraege('lieferanten'));
    wurzel.push(li);
    return wurzel;
  }
  /* Abschnitt TEIGECKE (A24, L19: ein Wagen ist kein Lagerort): Kopf = Ordner (Inhalt nach Wagen gruppiert), Kinder
     „noch ohne Zuhause“ (nur mit Inhalt), jeder aktive Wagen (auch leer), Silo (nur mit Inhalt). Kein ✎, kein ＋ an den Wagen. */
  function teigeckeAbschnitt(kx) {
    var te = { id: 'a:teigecke', art: 'abschnitt', schluessel: 'abschnitt_teigecke', zahl: kx.artikel.filter(function (a) { return a.teigecke === true; }).length, kinder: [] };
    if (!kx.mitWagen) return te;
    teigeckeGruppen(kx).forEach(function (g) {
      if (g.schluessel === '_ohne') te.kinder.push({ id: 'w:_ohne', art: 'wagen', schluessel: 'ordner_wagen_ohne', zeichen: '🚧', zahl: g.zeilen.length, kinder: [] });
      else if (g.schluessel === '_silo') te.kinder.push({ id: 'w:_silo', art: 'wagen', schluessel: 'ordner_wagen_silo', zahl: g.zeilen.length, kinder: [] });
      else te.kinder.push({ id: 'w:' + g.wagenId, art: 'wagen', name: g.titel, zahl: g.zeilen.length, kinder: [] });
    });
    return te;
  }
  /* Statuszeile (A25/A26). opt.liste wie ordnerBaum. „Lagerorte ohne Standort“ nur, wenn es Standorte gibt (wie bisher). */
  function statusZaehler(daten, opt) {
    var kx = ordnerKontext(daten), liste = (opt && opt.liste) || ORDNER_INTELLIGENT;
    var aus = [{ id: 'alle', ordner: 'i:alle', n: kx.artikel.length }];
    STATUS_FOLGE.forEach(function (id) {
      var e = eintragVon(id, liste); if (!e) return;
      if (id === 'orte_ohne' && !kx.standorte.length) return;
      var n = intelligentZahl(e, kx);
      if (n > 0) aus.push({ id: id, ordner: 'i:' + id, n: n });
    });
    return aus;
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
    if (z.art === 'a') return ORDNER_SPALTEN.indexOf(z.id) !== -1 || z.id === 'teigecke';
    if (z.art === 'w') return !kx.mitWagen || z.id === '_ohne' || z.id === '_silo' || !!kx.wm[z.id];   /* bis die Wagen geladen sind: gültig */
    if (z.art === 's') return !!kx.sm[z.id];
    if (z.art === 't') return !!kx.sm[z.id] && kx.orte.some(function (o) { return o.standortId === z.id && tempVon(o) === z.temperatur; });
    if (z.art === 'o') return !!kx.om[z.id];
    if (z.art === 'k') return !!kx.km[z.id];
    if (z.art === 'l') return !!kx.lm[z.id];
    return false;
  }
  /* Startordner (Ulf F2, 20:29): gemerkter, wenn gültig (alte Kennung vorher abgebildet, A24); sonst „ohne Lagerort“,
     solange dort etwas liegt; sonst „Alle Artikel“. */
  function startordner(daten, gemerkt) {
    var g = gemerkt ? ordnerAltNeu(gemerkt) : gemerkt;
    if (g && ordnerGueltig(g, daten)) return g;
    var kx = ordnerKontext(daten);
    return intelligentZahl(eintragVon('ohne_ort'), kx) > 0 ? 'i:ohne_ort' : 'i:alle';
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
    /* Stufe 3a: Zahl rechts = Bestand an diesem Ort (nur mit Ort und Bestand); Marke unter Mindestmenge */
    var zahl = null, um = unterMindestIn(a, kx);
    if (um.length) marken.push({ art: 'mindest' });
    if (ortId && kx.bestand && kx.om[ortId] && kx.om[ortId].standortId) {
      var bs = (kx.bestand[kx.om[ortId].standortId] || {})[a.id];
      var bo = bs ? bs.orte.filter(function (x) { return x.ortId === ortId; })[0] : null;
      zahl = { status: bs ? bs.status : 'unbekannt', wert: bo ? bo.wert : (bs && bs.status === 'bekannt' ? 0 : null), unterNull: !!(bo && bo.unterNull),
        unterMindest: !!(bs && bs.unterMindest), einheit: a.gebinde || '' };
    }
    return { artikel: a, id: a.id, ortId: ortId || null, marken: marken, unter: unter, zahl: zahl };
  }
  /* Standorte, an denen ein Artikel unter der Mindestmenge liegt: [{ standort, summe, mindest }] */
  function unterMindestIn(a, kx) {
    if (!kx.bestand) return [];
    return kx.standorte.slice().sort(nachSort).map(function (s) {
      var b = (kx.bestand[s.id] || {})[a.id];
      return b && b.unterMindest ? { standort: s, summe: b.summe, mindest: b.mindest } : null;
    }).filter(Boolean);
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
      var zeilenI = nachNameZeilen(kx.artikel.filter(function (a) { return e.filter(a, kx); }));
      if (e.id === 'unter_mindest') zeilenI.forEach(function (z) {   /* „Bestand 3 von 10 · ‹Standort›“ */
        unterMindestIn(z.artikel, kx).forEach(function (u) { z.unter.unshift('Bestand ' + mengeText(u.summe) + ' von ' + mengeText(u.mindest) + ' · ' + u.standort.name); });
      });
      return { art: 'artikel', gruppen: [{ schluessel: e.id, titel: '', zeilen: zeilenI }] };
    }
    if (z.art === 'a' && z.id === 'teigecke') {   /* A24: Kopf TEIGECKE = der bisherige Ordner „Teigecke“ (L19) */
      if (kx.mitWagen) return { art: 'artikel', wagen: true, teigecke: true, gruppen: teigeckeGruppen(kx) };
      return { art: 'artikel', teigecke: true, gruppen: [{ schluessel: 'teigecke', titel: '', zeilen: nachNameZeilen(kx.artikel.filter(function (a) { return a.teigecke === true; })) }] };
    }
    if (z.art === 'w') {
      if (!kx.mitWagen) return { art: 'artikel', wagen: true, wartet: true, gruppen: [] };
      var sch = z.id === '_ohne' || z.id === '_silo' ? z.id : 'w:' + z.id;
      var gw = teigeckeGruppen(kx).filter(function (g) { return g.schluessel === sch; })[0];
      if (!gw && sch.indexOf('w:') === 0) return { art: null };
      return { art: 'artikel', wagen: true, wagenOrdner: true, gruppen: [gw || { schluessel: sch, titel: '', wagenId: z.id === '_ohne' ? '' : null, zeilen: [] }] };
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
    if (z.art === 'i') {   /* A24: ein Ordner unten in einem Abschnitt hat den Abschnitt im Pfad („Kategorien › ohne Kategorie“) */
      var ab = abschnittVon(eintragVon(z.id));
      return ab === 'uebersicht' ? [{ id: sel, schluessel: 'ordner_' + z.id }] : [{ id: 'a:' + ab, schluessel: 'abschnitt_' + ab }, { id: sel, schluessel: 'ordner_' + z.id }];
    }
    if (z.art === 'a') return [{ id: sel, schluessel: 'abschnitt_' + z.id }];
    if (z.art === 'w') {
      var tk = { id: 'a:teigecke', schluessel: 'abschnitt_teigecke' };
      if (z.id === '_ohne') return [tk, { id: sel, schluessel: 'ordner_wagen_ohne', zeichen: '🚧' }];
      if (z.id === '_silo') return [tk, { id: sel, schluessel: 'ordner_wagen_silo' }];
      return kx.wm[z.id] ? [tk, { id: sel, name: wagenText(kx.wm[z.id]) }] : [tk];
    }
    if (z.art === 's') return kx.sm[z.id] ? [stK(kx.sm[z.id])] : [];
    if (z.art === 't') return kx.sm[z.id] ? [stK(kx.sm[z.id]), tK(z.id, z.temperatur)] : [];
    if (z.art === 'o') {
      var o = kx.om[z.id]; if (!o) return [];
      var s = kx.sm[o.standortId];
      return s ? [stK(s), tK(s.id, tempVon(o)), { id: sel, name: o.name }] : [{ id: 'a:standorte', schluessel: 'abschnitt_standorte' }, { id: 'i:orte_ohne', schluessel: 'ordner_orte_ohne' }, { id: sel, name: o.name }];
    }
    if (z.art === 'k') return kx.km[z.id] ? [{ id: 'a:kategorien', schluessel: 'abschnitt_kategorien' }, { id: sel, name: kx.km[z.id].name }] : [];
    if (z.art === 'l') return kx.lm[z.id] ? [{ id: 'a:lieferanten', schluessel: 'abschnitt_lieferanten' }, { id: sel, name: kx.lm[z.id].name }] : [];
    return [];
  }
  /* Wo liegt der Ordner im Baum? Kennungen der Vorfahren (zum Aufklappen). */
  function vorfahren(sel, daten) {
    var ids = pfad(sel, daten).map(function (x) { return x.id; }).filter(function (id) { return id !== sel; });
    var erst = ids[0] || sel, kopf = null;
    if (/^[sto]:/.test(erst)) kopf = 'a:standorte';
    else if (/^i:/.test(erst)) kopf = 'a:' + abschnittVon(eintragVon(erst.slice(2)));   /* A23/A24 */
    else if (/^w:/.test(erst)) kopf = 'a:teigecke';
    if (kopf && kopf !== sel && ids[0] !== kopf) ids.unshift(kopf);
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
      aus.push({ art: 'artikel', id: a.id, name: a.name, pfade: orte.length ? orte.map(function (o) { return pfad('o:' + o, daten); }) : [pfad('i:ohne_ort', daten)] });
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

  /* =================================================================
     STUFE 3a (#169, RK §32): Anforderungslisten, Bestellungen, Korrekturen,
     Mindestmengen, Bestand je Ort. Bauplan SESSION_2026-11-12_LAGER_STUFE3A_BAU.md,
     Freigabe KC 16.11. 08:44/08:49 (A27–A29). Nur Rechnen, kein Firestore.
     Zeitstempel kommen als Millisekunden (die Seite rechnet um).
     ================================================================= */
  /* RK §34 (18.11.2026): …Person = Personen-Nummer zum Namen (Stationskonto: null); der Name ist Rufname, sonst
     Beschreibung dieser Person bzw. die Notiz des Stationskontos — die Seite holt beides über BOS_NAMEN.ichSelbst. */
  var FELDER_LISTE = ['art', 'standortId', 'nummer', 'status', 'pos', 'letzte', 'abgeschlossenVon', 'abgeschlossenPerson', 'abgeschlossenName', 'abgeschlossenAm'];
  var FELDER_EINTRAG = ['artikelId', 'menge', 'ortId', 'von', 'vonPerson', 'vonName', 'ts'];
  var FELDER_KORREKTUR = ['listeId', 'posId', 'art', 'artikelId', 'ortId', 'standortId', 'statt', 'nur', 'wirktAb', 'konto', 'person', 'name', 'ts'];
  var FELDER_MINDEST = ['artikelId', 'standortId', 'menge', 'geaendertVon', 'geaendertAm'];
  var LISTEN_ART = { anforderung: 'a', bestellung: 'b' };
  var POS_MUSTER = /^[A-Za-z0-9]{6,20}$/;
  var POS_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  function listeId(standortId, art, nummer) { return String(standortId) + '__' + LISTEN_ART[art] + String(nummer); }
  function korrekturId(lid, posId) { return String(lid) + '__' + String(posId); }
  function mindestId(artikelId, standortId) { return String(artikelId) + '__' + String(standortId); }
  /* Kennung eines Eintrags: 12 Zeichen. zufall() = Zahl in [0,1) (zum Testen austauschbar). */
  function neuePosId(zufall) {
    var z = typeof zufall === 'function' ? zufall : Math.random, s = '';
    for (var i = 0; i < 12; i++) s += POS_ZEICHEN.charAt(Math.floor(z() * POS_ZEICHEN.length) % POS_ZEICHEN.length);
    return s;
  }
  function posIdGueltig(p) { return typeof p === 'string' && POS_MUSTER.test(p); }
  function eineStelle(x) { return Math.abs(x * 10 - Math.round(x * 10)) < 1e-9; }
  /* Menge eines Eintrags (Gebinde): > 0, höchstens mengeMax, eine Nachkommastelle (wie beim Zählen) */
  function mengeGueltig(m) { return istZahl(m) && m > 0 && m <= GRENZEN.mengeMax && eineStelle(m); }
  function mindestGueltig(m) { return istZahl(m) && m >= 0 && m <= GRENZEN.mindestMax && eineStelle(m); }
  function mengeAus(text) {
    var t = String(text == null ? '' : text).trim().replace(',', '.');
    if (!/^[0-9]+(\.[0-9]+)?$/.test(t)) return NaN;
    return parseFloat(t);   /* nicht runden: 2,55 soll als ungültig auffallen (mengeGueltig), nicht still 2,6 werden */
  }
  function mengeText(m) { return istZahl(m) ? String(Math.round(m * 10) / 10).replace('.', ',') : ''; }
  /* „4 Sack“ — Gebinde aus dem Stamm, sonst nur die Zahl */
  function mengeMitGebinde(m, a) { var g = a && a.gebinde ? String(a.gebinde) : ''; return mengeText(m) + (g ? ' ' + g : ''); }

  /* Bausteine (Zeitstempel setzt die Seite als serverTimestamp) */
  function neueListeDokument(art, standortId, nummer) {
    return { art: art, standortId: String(standortId), nummer: nummer, status: 'offen', pos: {}, letzte: '' };
  }
  function eintragDokument(e) {
    return { artikelId: String(e.artikelId), menge: e.menge, ortId: String(e.ortId || ''), von: String(e.von),
      vonPerson: typeof e.vonPerson === 'string' ? e.vonPerson : null, vonName: String(e.vonName || '') };
  }
  /* person: Personen-Nummer (RK §34) oder null beim Stationskonto */
  function abschlussFelder(von, name, person) {
    return { status: 'zu', abgeschlossenVon: String(von), abgeschlossenPerson: typeof person === 'string' ? person : null, abgeschlossenName: String(name || '') };
  }
  function korrekturDokument(liste, posId, nur) {
    var p = (liste && liste.pos && liste.pos[posId]) || null;
    if (!p) return null;
    return { listeId: liste.id, posId: posId, art: liste.art, artikelId: p.artikelId, ortId: p.ortId || '', standortId: liste.standortId, statt: p.menge, nur: nur };
  }
  function korrekturGueltig(statt, nur) { return istZahl(statt) && istZahl(nur) && nur >= 0 && nur < statt && eineStelle(nur); }
  function mindestDokument(artikelId, standortId, menge) { return { artikelId: String(artikelId), standortId: String(standortId), menge: menge }; }

  /* Die offene Liste eines Standorts und einer Art (höchste Nummer) — oder null */
  function offeneListe(listen, standortId, art) {
    return (listen || []).filter(function (l) { return l && l.standortId === standortId && l.art === art && l.status === 'offen'; })
      .sort(function (a, b) { return b.nummer - a.nummer; })[0] || null;
  }
  /* A28: jüngste abgeschlossene Anforderungsliste des Standorts in den letzten `stunden` Stunden — oder null */
  function juengsteAbgeschlossen(listen, standortId, jetztMs, stunden) {
    var h = istZahl(stunden) ? stunden : GRENZEN.hinweisStunden;
    return (listen || []).filter(function (l) {
      return l && l.standortId === standortId && l.art === 'anforderung' && l.status === 'zu' && istZahl(l.abgeschlossenMs) && jetztMs - l.abgeschlossenMs <= h * 3600000;
    }).sort(function (a, b) { return b.abgeschlossenMs - a.abgeschlossenMs; })[0] || null;
  }

  /* Orte eines Artikels in einem Standort, in der Reihenfolge von artikel.orte (aktive Orte). A27: der erste ist der Hauptort. */
  function orteImStandort(a, standortId, orteMap) {
    return ((a && a.orte) || []).map(function (o) { return orteMap[o]; }).filter(function (o) { return o && !o.geloescht && o.standortId === standortId; });
  }
  function hauptort(a, standortId, orteMap) { var l = orteImStandort(a, standortId, orteMap || {}); return l.length ? l[0].id : ''; }
  /* A27: Ort nach vorn holen („als Hauptort“) — neue orte-Liste */
  function alsHauptort(a, ortId, standortId, orteMap) {
    var l = ((a && a.orte) || []).slice(), i = l.indexOf(ortId);
    if (i === -1) return { fehler: 'nicht_da' };
    var erster = hauptort(a, standortId, orteMap);
    if (erster === ortId) return { fehler: 'schon' };
    var j = l.indexOf(erster);
    l.splice(i, 1); l.splice(j, 0, ortId);
    return { orte: l };
  }

  /* Buchungen aus abgeschlossenen Listen und Korrekturen.
     listen: [{ id, art, standortId, nummer, status, pos, abgeschlossenMs }], korrekturen: [{ listeId, posId, art, artikelId, ortId, standortId, statt, nur, wirktMs }]
     → [{ artikelId, ortId, standortId, menge (±), wirktMs, quelle: { art: 'liste'|'korrektur', listenArt, listeId, nummer, posId } }] */
  function buchungenAus(listen, korrekturen) {
    var aus = [], nr = {};
    (listen || []).forEach(function (l) {
      if (!l || l.status !== 'zu' || !istZahl(l.abgeschlossenMs) || !istKarte(l.pos)) return;
      nr[l.id] = l.nummer;
      var vz = l.art === 'bestellung' ? 1 : (l.art === 'anforderung' ? -1 : 0);
      if (!vz) return;
      Object.keys(l.pos).forEach(function (pid) {
        var p = l.pos[pid];
        if (!p || !istZahl(p.menge)) return;
        aus.push({ artikelId: p.artikelId, ortId: p.ortId || '', standortId: l.standortId, menge: vz * p.menge, wirktMs: l.abgeschlossenMs,
          quelle: { art: 'liste', listenArt: l.art, listeId: l.id, nummer: l.nummer, posId: pid } });
      });
    });
    (korrekturen || []).forEach(function (k) {
      if (!k || !istZahl(k.statt) || !istZahl(k.nur) || !istZahl(k.wirktMs)) return;
      var vz = k.art === 'anforderung' ? 1 : (k.art === 'bestellung' ? -1 : 0);   /* Gegenvorzeichen */
      if (!vz) return;
      aus.push({ artikelId: k.artikelId, ortId: k.ortId || '', standortId: k.standortId, menge: vz * (k.statt - k.nur), wirktMs: k.wirktMs,
        quelle: { art: 'korrektur', listenArt: k.art, listeId: k.listeId, nummer: nr[k.listeId] || null, posId: k.posId } });
    });
    return aus;
  }
  /* Ältester Zeitpunkt, ab dem Buchungen zählen können (T0, Bauplan §3.4) — oder null (noch nie gezählt) */
  function bestandAb(stand) {
    var t = null;
    standListe(stand).forEach(function (s) { if (istZahl(s.tsMs) && (t === null || s.tsMs < t)) t = s.tsMs; });
    return t;
  }
  function standListe(stand) {
    if (Array.isArray(stand)) return stand;
    var aus = []; Object.keys(stand || {}).forEach(function (k) { var s = stand[k]; if (s) { var z = standIdZerlegt(k) || {}; aus.push(Object.assign({ artikelId: z.artikelId, ortId: z.ortId }, s)); } }); return aus;
  }
  function runde(x) { return Math.round(x * 1000) / 1000; }
  /* Bestand je Artikel in einem Standort (Bauplan §3.2, Freigabe §2):
       Ort mit Zählung:   Stand + Buchungen auf diesen Ort, die NACH der Zählung wirken
       Ort ohne Zählung:  0 + Buchungen ab der ersten Zählung des Artikels im Standort (T_erst); Position ohne Ort = Ort ''
       nie gezählt:       'unbekannt' (nicht 0)
     Nur aktive Artikel, aktive Orte, aktiver Standort (F8). Buchungen auf archivierte oder fremde Orte zählen nicht.
     daten = { artikel, orte, standorte, stand, listen, korrekturen, mindest } → { artikelId: Ergebnis } */
  function bestand(daten, standortId) {
    var d = daten || {}, aus = {};
    var sm = nachId(aktiv(d.standorte));
    if (!sm[standortId]) return aus;
    var orteS = {}; aktiv(d.orte).forEach(function (o) { if (o.standortId === standortId) orteS[o.id] = o; });
    var standJe = {}, buchJe = {}, mindJe = {};
    standListe(d.stand).forEach(function (s) { if (s && orteS[s.ortId] && istZahl(s.wert) && istZahl(s.tsMs)) (standJe[s.artikelId] || (standJe[s.artikelId] = {}))[s.ortId] = s; });
    buchungenAus(d.listen, d.korrekturen).forEach(function (b) {
      if (b.standortId !== standortId || (b.ortId !== '' && !orteS[b.ortId])) return;
      (buchJe[b.artikelId] || (buchJe[b.artikelId] = [])).push(b);
    });
    (d.mindest || []).forEach(function (m) { if (m && m.standortId === standortId && istZahl(m.menge) && m.menge > 0) mindJe[m.artikelId] = m.menge; });
    aktiv(d.artikel).forEach(function (a) {
      var st = standJe[a.id] || {}, bu = buchJe[a.id] || [], fest = orteImStandort(a, standortId, orteS);
      var festIds = fest.map(function (o) { return o.id; });
      var ids = festIds.slice();
      Object.keys(st).forEach(function (o) { if (ids.indexOf(o) === -1) ids.push(o); });
      bu.forEach(function (b) { if (ids.indexOf(b.ortId) === -1) ids.push(b.ortId); });
      var tErst = null;
      Object.keys(st).forEach(function (o) { if (tErst === null || st[o].tsMs < tErst) tErst = st[o].tsMs; });
      var mindest = Object.prototype.hasOwnProperty.call(mindJe, a.id) ? mindJe[a.id] : null;
      if (tErst === null) {
        if (!ids.length && mindest === null) return;
        aus[a.id] = { artikelId: a.id, status: 'unbekannt', summe: null, orte: ids.map(function (o) { return { ortId: o, wert: null, gezaehltMs: null, buchungen: bu.filter(function (b) { return b.ortId === o; }).length, unterNull: false, fest: festIds.indexOf(o) !== -1, liegtNoch: false }; }),
          mindest: mindest, unterMindest: false, letzteZaehlungMs: null, hauptortId: festIds[0] || '' };
        return;
      }
      var summe = 0, letzte = tErst;
      var orte = ids.map(function (o) {
        var s = st[o], ab = s ? s.tsMs : tErst, w = s ? s.wert : 0, n = 0;
        bu.forEach(function (b) { if (b.ortId === o && b.wirktMs > ab) { w += b.menge; n++; } });
        w = runde(w); summe += w;
        if (s && s.tsMs > letzte) letzte = s.tsMs;
        var istFest = festIds.indexOf(o) !== -1;
        return { ortId: o, wert: w, gezaehltMs: s ? s.tsMs : null, buchungen: n, unterNull: w < 0, fest: istFest, liegtNoch: !istFest && o !== '' && w > 0 };
      });
      summe = runde(summe);
      aus[a.id] = { artikelId: a.id, status: 'bekannt', summe: summe, orte: orte, mindest: mindest, unterMindest: mindest !== null && summe < mindest,
        letzteZaehlungMs: letzte, hauptortId: festIds[0] || '' };
    });
    return aus;
  }
  /* Bestand aller aktiven Standorte: { standortId: { artikelId: Ergebnis } } */
  function bestandAlle(daten) {
    var aus = {};
    aktiv((daten || {}).standorte).forEach(function (s) { aus[s.id] = bestand(daten, s.id); });
    return aus;
  }
  /* Was liegt an einem Ort rechnerisch noch (≠ 0)? Für die Archivsperre. [{ artikel, wert }] */
  function bestandAmOrt(daten, ortId) {
    var o = nachId(aktiv((daten || {}).orte))[ortId];
    if (!o || !o.standortId) return [];
    var b = bestand(daten, o.standortId), am = nachId(aktiv(daten.artikel)), aus = [];
    Object.keys(b).forEach(function (aid) {
      (b[aid].orte || []).forEach(function (x) { if (x.ortId === ortId && istZahl(x.wert) && x.wert !== 0) aus.push({ artikel: am[aid], wert: x.wert }); });
    });
    return aus.sort(function (x, y) { return nachName(x.artikel, y.artikel); });
  }
  /* Lieferant eines Artikels für „Bitte nachbestellen“: Standard-Lieferant, sonst die erste aktive Bezugsquelle, sonst null */
  function lieferantVon(a, lm) {
    if (a.standardLieferantId && lm[a.standardLieferantId]) return lm[a.standardLieferantId];
    var k = istKarte(a.quellen) ? Object.keys(a.quellen).filter(function (l) { return lm[l]; }).map(function (l) { return lm[l]; }).sort(nachName) : [];
    return k[0] || null;
  }
  /* „Bitte nachbestellen“: unter Mindestmenge, nach Lieferant und Name. „Noch nie gezählt“: nur Artikel MIT Mindestmenge. */
  function nachbestellen(bestandS, daten) {
    var am = nachId(aktiv((daten || {}).artikel)), lm = nachId(aktiv((daten || {}).lieferanten)), liste = [], nie = [];
    Object.keys(bestandS || {}).forEach(function (aid) {
      var b = bestandS[aid], a = am[aid];
      if (!a || b.mindest === null) return;
      if (b.status === 'unbekannt') nie.push(a);
      else if (b.unterMindest) liste.push({ artikel: a, lieferant: lieferantVon(a, lm), summe: b.summe, mindest: b.mindest });
    });
    liste.sort(function (x, y) {
      var lx = x.lieferant ? x.lieferant.name : '￿', ly = y.lieferant ? y.lieferant.name : '￿';
      var c = String(lx).localeCompare(String(ly), 'de');
      return c || nachName(x.artikel, y.artikel);
    });
    return { liste: liste, nieGezaehlt: nie.sort(nachName) };
  }

  /* Einträge einer Liste nach Lagerort (Rundgang), darin nach Reihenfolge des Ortes. Ohne Ort zuletzt.
     zusammen = true: eine Zeile je Artikel und Ort (Druck, „4 Sack (2 + 2)“), sonst jeder Eintrag einzeln (Bildschirm). */
  function listeNachOrt(liste, daten, zusammen) {
    var d = daten || {}, pos = (liste && liste.pos) || {}, sid = liste && liste.standortId;
    var om = nachId(d.orte || []), am = nachId(d.artikel || []);
    var je = {};
    Object.keys(pos).forEach(function (pid) {
      var p = pos[pid]; if (!p) return;
      var o = p.ortId || '';
      (je[o] || (je[o] = [])).push({ posId: pid, eintrag: p, artikel: am[p.artikelId] || { id: p.artikelId, name: '(unbekannter Artikel)' } });
    });
    var reihe = aktiv(d.orte).filter(function (o) { return o.standortId === sid; }).sort(nachSort).map(function (o) { return o.id; });
    Object.keys(je).forEach(function (o) { if (o !== '' && reihe.indexOf(o) === -1) reihe.push(o); });
    if (je['']) reihe.push('');
    var tsVon = function (e) { var t = e.eintrag.tsMs; return istZahl(t) ? t : 0; };
    return reihe.filter(function (o) { return je[o]; }).map(function (o) {
      var ort = om[o] || null, eintraege = je[o];
      var folge = artikelInFolge(ort, aktiv(eintraege.map(function (x) { return x.artikel; })).filter(function (a, i, arr) { return arr.indexOf(a) === i; }));
      var rang = function (aid) { var i = folge.map(function (a) { return a.id; }).indexOf(aid); return i === -1 ? 1e9 : i; };
      eintraege.sort(function (x, y) { return (rang(x.artikel.id) - rang(y.artikel.id)) || nachName(x.artikel, y.artikel) || (tsVon(x) - tsVon(y)); });
      var gruppe = { ortId: o, ort: ort, titel: o === '' ? '' : (ort ? ort.name : '(unbekannter Ort)'), eintraege: eintraege };
      if (zusammen) {
        var zeilen = [];
        eintraege.forEach(function (x) {
          var z = zeilen.filter(function (y) { return y.artikel.id === x.artikel.id; })[0];
          if (!z) { z = { artikel: x.artikel, summe: 0, teile: [] }; zeilen.push(z); }
          z.summe = Math.round((z.summe + x.eintrag.menge) * 10) / 10; z.teile.push(x.eintrag.menge);
        });
        gruppe.zeilen = zeilen;
      }
      return gruppe;
    });
  }
  /* Druckansicht (A4 hochkant, schwarz-weiß). Namen nur aus den Daten. opt = { standortName, titelArt, zeitText, name,
     nachdruck, nb: nachbestellen()-Ergebnis | null, bestandFehler: Text | '' } → HTML (ohne <html>) */
  function druckHTML(liste, daten, opt) {
    var o = opt || {}, h = [];
    var kopf = (liste.art === 'bestellung' ? 'Bestellung ' : 'Anforderung ') + esc(o.standortName || '') + ' · Liste ' + esc(String(liste.nummer));
    h.push('<h1>' + kopf + (o.nachdruck ? ' · Nachdruck' : '') + '</h1>');
    h.push('<p class="unter">' + esc(o.zeitText || '') + (o.name ? ' · abgeschlossen von ' + esc(o.name) : '') + '</p>');
    h.push('<table class="liste">');
    listeNachOrt(liste, daten, true).forEach(function (g) {
      h.push('<tr class="ort"><th colspan="2">' + esc(g.ortId === '' ? 'Ohne Lagerort' : g.titel) + '</th><td class="box">☐</td></tr>');
      g.zeilen.forEach(function (z) {
        var teile = z.teile.length > 1 ? ' (' + z.teile.map(mengeText).join(' + ') + ')' : '';
        h.push('<tr><td class="name">' + esc(z.artikel.name) + '</td><td class="menge">' + esc(mengeMitGebinde(z.summe, z.artikel)) + esc(teile) + '</td><td class="box">☐</td></tr>');
      });
    });
    h.push('</table>');
    if (o.bestandFehler) h.push('<p class="fehler">⚠ Bestand nicht berechenbar: ' + esc(o.bestandFehler) + '</p>');
    else if (o.nb) {
      h.push('<h2>Bitte nachbestellen' + (o.nachdruck ? ' (Stand jetzt)' : ' (nach dieser Liste)') + '</h2>');
      if (!o.nb.liste.length) h.push('<p>Nichts unter der Mindestmenge.</p>');
      else {
        h.push('<table class="nb">');
        o.nb.liste.forEach(function (x) {
          h.push('<tr><td>' + esc(x.lieferant ? x.lieferant.name : 'ohne Lieferant') + '</td><td>' + esc(x.artikel.name) + '</td><td>Bestand ' + esc(mengeMitGebinde(x.summe, x.artikel)) + ' · Mindestmenge ' + esc(mengeText(x.mindest)) + '</td></tr>');
        });
        h.push('</table>');
      }
      if (o.nb.nieGezaehlt.length) h.push('<h3>Noch nie gezählt (mit Mindestmenge)</h3><p>' + o.nb.nieGezaehlt.map(function (a) { return esc(a.name); }).join(', ') + '</p>');
    }
    return h.join('\n');
  }
  var DRUCK_CSS = 'body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12pt} h1{font-size:16pt;margin:0 0 2mm} h2{font-size:13pt;margin:6mm 0 2mm} h3{font-size:11pt;margin:4mm 0 1mm}' +
    ' .unter{margin:0 0 4mm;font-size:10pt} table{border-collapse:collapse;width:100%} td,th{padding:1.2mm 2mm;border-bottom:0.3mm solid #999;text-align:left;vertical-align:top}' +
    ' tr.ort th{font-size:12.5pt;border-bottom:0.6mm solid #000;padding-top:4mm} td.menge{white-space:nowrap} td.box{width:8mm;font-size:14pt;text-align:center} .fehler{font-weight:bold;border:0.6mm solid #000;padding:2mm}';

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
    ABSCHNITTE: ABSCHNITTE, ORDNER_ALT_NEU: ORDNER_ALT_NEU, ordnerAltNeu: ordnerAltNeu, statusZaehler: statusZaehler,
    zerlegeOrdner: zerlegeOrdner, ordnerGueltig: ordnerGueltig, startordner: startordner, ordnerInhalt: ordnerInhalt, ordnerZeile: ordnerZeile,
    blaetterIds: blaetterIds, pfad: pfad, vorfahren: vorfahren, sucheUeberAlles: sucheUeberAlles, archivListe: archivListe,
    ortErsetzen: ortErsetzen, ortDazu: ortDazu, ortWeg: ortWeg, standHinweis: standHinweis, tempVon: tempVon,
    TEIGECKE_BLATT_FELDER: TEIGECKE_BLATT_FELDER, blattMitZuhause: blattMitZuhause, wagenText: wagenText, wagenVergleich: wagenVergleich,
    wagenSortiert: wagenSortiert, zuhauseVon: zuhauseVon, teigeckeGruppen: teigeckeGruppen, zuhauseKandidaten: zuhauseKandidaten, zuhauseSperre: zuhauseSperre,
    /* Stufe 3a (RK §32) */
    FELDER_LISTE: FELDER_LISTE, FELDER_EINTRAG: FELDER_EINTRAG, FELDER_KORREKTUR: FELDER_KORREKTUR, FELDER_MINDEST: FELDER_MINDEST,
    LISTEN_ART: LISTEN_ART, POS_MUSTER: POS_MUSTER, listeId: listeId, korrekturId: korrekturId, mindestId: mindestId,
    neuePosId: neuePosId, posIdGueltig: posIdGueltig, mengeGueltig: mengeGueltig, mindestGueltig: mindestGueltig,
    mengeAus: mengeAus, mengeText: mengeText, mengeMitGebinde: mengeMitGebinde,
    neueListeDokument: neueListeDokument, eintragDokument: eintragDokument, abschlussFelder: abschlussFelder,
    korrekturDokument: korrekturDokument, korrekturGueltig: korrekturGueltig, mindestDokument: mindestDokument,
    offeneListe: offeneListe, juengsteAbgeschlossen: juengsteAbgeschlossen,
    orteImStandort: orteImStandort, hauptort: hauptort, alsHauptort: alsHauptort,
    buchungenAus: buchungenAus, bestandAb: bestandAb, bestand: bestand, bestandAlle: bestandAlle, bestandAmOrt: bestandAmOrt,
    lieferantVon: lieferantVon, nachbestellen: nachbestellen, unterMindestIn: unterMindestIn,
    listeNachOrt: listeNachOrt, druckHTML: druckHTML, DRUCK_CSS: DRUCK_CSS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_LAGER_LOGIK = api;
})(typeof window !== 'undefined' ? window : globalThis);
