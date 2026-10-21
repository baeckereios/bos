/* ================================================================
   BäckereiOS · BackStore-Texte — gemeinsame Mechanik (kein DOM)
   ================================================================
   Einbindung:  <script src="../bos_backstore_texte.js"></script>
                (nach bos_app_registry.js; Laden braucht window.db oder eine
                andere Firestore-Instanz, die der Aufrufer übergibt)
   Stellt bereit: window.BOS_BACKSTORE_TEXTE (in Node: module.exports)
   Test:        node backstore/_PRUEF_backstore_werkzeuge/test_backstore.js
   Doku:        backstore/BACKSTORE_DOKU.md, Regel: RK §26

   WARUM: Drei Seiten brauchen die App-Texte — der BackStore (zeigt und
   pflegt sie), die Kontenverwaltung (Zugangsblatt) und die NFC-/QR-
   Zentrale (Vorschau). Eine Mechanik, drei Aufrufer: Grenzen, Prüfung,
   Rückfall (eigener Text → Seite → Ordner), Zählregel, „Neu“-Punkt und
   Laden stehen nur hier.

   DATEN (Firestore, RK §26):
     backstore_texte/{appId}
       kurz:    { de: '…' }        0–160 Zeichen (leer = Text des Ordners gilt)
       lang:    { de: '…' }        0–1200 Zeichen (leer = Kurztext steht dort)
       verlauf: [{ datum: 'JJJJ-MM-TT', text: '…' }]  höchstens 100, nur Deutsch
       wieBei:  '<appId>'          optional: Lang und Verlauf stehen dort
       sicherungId, geaendertVon, geaendertAm
     backstore_texte_sicherungen/{autoId}
       appId, aktion, vorher, konto, ts

   WARNUNG: GRENZEN und FELDER stehen genauso in der Firestore-Regel
   (RK §26). test_backstore.js --regeln=<Datei> vergleicht beides. Wer
   hier dreht, dreht dort mit — und umgekehrt.

   CHANGELOG
     2026-10-21 · 11:07 · v1.0 · Neu (#110, BackStore wie ein App
       Store; Bauplan freigegeben KC 10:27).
   ================================================================ */
(function (global) {
  'use strict';

  var COLLECTION = 'backstore_texte';
  var SICHERUNGEN = 'backstore_texte_sicherungen';
  var SPRACHE = 'de';
  /* muss 1:1 zur Regel passen (RK §26) */
  var GRENZEN = { KURZ: 160, LANG: 1200, VERLAUF: 100, VERLAUF_TEXT: 200, ID_MUSTER: '^[a-z0-9_]{1,40}$' };
  var FELDER = ['kurz', 'lang', 'verlauf', 'wieBei', 'sicherungId', 'geaendertVon', 'geaendertAm'];
  var PFLICHT = ['kurz', 'lang', 'verlauf', 'sicherungId', 'geaendertVon', 'geaendertAm'];
  var SICHERUNG_FELDER = ['appId', 'aktion', 'vorher', 'konto', 'ts'];
  var AKTIONEN_ANLEGEN = ['erstfuellung', 'anlegen'];
  var AKTIONEN_AENDERN = ['aendern', 'zurueckholen'];
  /* Stellschrauben (BACKSTORE_DOKU.md §6) */
  var NEU_TAGE = 14;
  var ALTE_FASSUNGEN = 10;
  var LADE_ZEITLIMIT_MS = 15000;
  var DATEI_ART = 'bos-backstore-texte';

  var ID_RE = new RegExp(GRENZEN.ID_MUSTER);
  var DATUM_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function istText(x) { return typeof x === 'string'; }
  function istKarte(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function zwei(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- Datum (lokal, nie toISOString) ---------- */
  function datumHeute(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
  }
  function datumGueltig(s) {
    var m = DATUM_RE.exec(String(s || ''));
    if (!m) return false;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
  }
  /* Ganze Kalendertage von a bis b (beide 'JJJJ-MM-TT'), lokal; Sommerzeit egal. */
  function tageZwischen(a, b) {
    var x = DATUM_RE.exec(a), y = DATUM_RE.exec(b);
    if (!x || !y) return NaN;
    var da = Date.UTC(Number(x[1]), Number(x[2]) - 1, Number(x[3]));
    var db = Date.UTC(Number(y[1]), Number(y[2]) - 1, Number(y[3]));
    return Math.round((db - da) / 86400000);
  }
  function anzeigeDatum(s, mitJahr) {
    var m = DATUM_RE.exec(String(s || ''));
    if (!m) return String(s || '');
    return m[3] + '.' + m[2] + '.' + (mitJahr === false ? '' : m[1]);
  }
  /* „Neu“: Eintrag heute oder in den NEU_TAGE − 1 Tagen davor. */
  function istNeu(datum, heute) {
    var t = tageZwischen(datum, heute);
    return t >= 0 && t < NEU_TAGE;
  }

  /* ---------- Inhalt eines Dokuments ---------- */
  function sprachText(karte) { return istKarte(karte) && istText(karte[SPRACHE]) ? karte[SPRACHE] : ''; }
  /* Rohdaten aus der Datenbank → Inhalt zum Anzeigen. Erfindet nichts:
     Unlesbares wird leer, ein kaputter Verlauf-Eintrag bleibt als
     { datum, text } mit dem, was da ist, und fällt in pruefeInhalt auf. */
  function inhaltAus(roh) {
    roh = roh || {};
    var aus = {
      kurz: sprachText(roh.kurz), lang: sprachText(roh.lang),
      verlauf: Array.isArray(roh.verlauf) ? roh.verlauf.map(function (e) {
        return { datum: e && istText(e.datum) ? e.datum : '', text: e && istText(e.text) ? e.text : '' };
      }) : []
    };
    if (istText(roh.wieBei) && roh.wieBei) aus.wieBei = roh.wieBei;
    return aus;
  }
  /* Prüft den Inhalt (kurz, lang, verlauf, wieBei) wie Seite + Regel.
     Rückgabe: Liste { feld, grund } — leer = in Ordnung. heute für „nicht in der Zukunft“. */
  function pruefeInhalt(id, inh, heute) {
    var f = [];
    function fehler(feld, grund) { f.push({ feld: feld, grund: grund }); }
    if (!istText(id) || !ID_RE.test(id)) fehler('id', 'Kennung passt nicht (nur a–z, 0–9, _; höchstens 40)');
    inh = inh || {};
    if (!istText(inh.kurz)) fehler('kurz', 'kein Text');
    else if (inh.kurz.length > GRENZEN.KURZ) fehler('kurz', 'länger als ' + GRENZEN.KURZ + ' Zeichen (' + inh.kurz.length + ')');
    if (!istText(inh.lang)) fehler('lang', 'kein Text');
    else if (inh.lang.length > GRENZEN.LANG) fehler('lang', 'länger als ' + GRENZEN.LANG + ' Zeichen (' + inh.lang.length + ')');
    if (!Array.isArray(inh.verlauf)) fehler('verlauf', 'keine Liste');
    else {
      if (inh.verlauf.length > GRENZEN.VERLAUF) fehler('verlauf', 'mehr als ' + GRENZEN.VERLAUF + ' Einträge');
      inh.verlauf.forEach(function (e, i) {
        var n = 'verlauf ' + (i + 1);
        if (!istKarte(e)) { fehler(n, 'Eintrag kaputt'); return; }
        Object.keys(e).forEach(function (k) { if (k !== 'datum' && k !== 'text') fehler(n, 'unbekanntes Feld ' + k); });
        if (!datumGueltig(e.datum)) fehler(n, 'Datum fehlt oder ungültig (JJJJ-MM-TT)');
        else if (heute && tageZwischen(heute, e.datum) > 0) fehler(n, 'Datum liegt in der Zukunft');
        if (!istText(e.text) || !e.text.trim()) fehler(n, 'Text fehlt');
        else if (e.text.length > GRENZEN.VERLAUF_TEXT) fehler(n, 'Text länger als ' + GRENZEN.VERLAUF_TEXT + ' Zeichen');
      });
    }
    if ('wieBei' in inh && inh.wieBei !== undefined) {
      if (!istText(inh.wieBei) || !ID_RE.test(inh.wieBei)) fehler('wieBei', 'Kennung passt nicht');
      else if (inh.wieBei === id) fehler('wieBei', 'zeigt auf sich selbst');
      if (istText(inh.lang) && inh.lang !== '') fehler('wieBei', 'mit gemeinsamem Text muss der eigene Langtext leer sein');
      if (Array.isArray(inh.verlauf) && inh.verlauf.length) fehler('wieBei', 'mit gemeinsamem Text muss der eigene Verlauf leer sein');
    }
    return f;
  }
  /* Genau die Felder der Regel. zeit = serverTimestamp() der Seite. */
  function dokumentFuer(inh, sicherungId, kennung, zeit) {
    var d = {
      kurz: { de: String(inh.kurz) }, lang: { de: String(inh.lang) },
      verlauf: (inh.verlauf || []).map(function (e) { return { datum: String(e.datum), text: String(e.text) }; }),
      sicherungId: sicherungId, geaendertVon: kennung, geaendertAm: zeit
    };
    if (inh.wieBei) d.wieBei = String(inh.wieBei);
    return d;
  }
  function sicherungFuer(appId, aktion, vorher, kennung, zeit) {
    return { appId: appId, aktion: aktion, vorher: vorher == null ? null : vorher, konto: kennung, ts: zeit };
  }
  /* Neueste zuerst (Anzeige). Gleiches Datum: spätere Position zuerst. */
  function verlaufSortiert(verlauf) {
    return (verlauf || []).map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { return a.e.datum < b.e.datum ? 1 : a.e.datum > b.e.datum ? -1 : b.i - a.i; })
      .map(function (x) { return x.e; });
  }

  /* ---------- Registry-Hilfen ---------- */
  function nachId(apps) { var m = {}; (apps || []).forEach(function (a) { if (a && a.id) m[a.id] = a; }); return m; }
  function kinder(apps, hubId) { return (apps || []).filter(function (a) { return a && a.hub === hubId; }); }
  /* Alle IDs, die einen Text haben können: Registry ohne type 'system', dazu feste Ziele. */
  function bekannteIds(apps, festeZiele) {
    var ids = (apps || []).filter(function (a) { return a && a.type !== 'system'; }).map(function (a) { return a.id; });
    (festeZiele || []).forEach(function (f) { if (ids.indexOf(f.id) === -1) ids.push(f.id); });
    return ids;
  }

  /* ---------- Texte auflösen ----------
     texte = { appId: Rohdaten } (wie geladen). */
  function eigen(texte, id) { return texte && texte[id] ? inhaltAus(texte[id]) : null; }
  /* Lang und Verlauf über wieBei (EINE Stufe, keine Ketten). */
  function aufgeloest(texte, id) {
    var e = eigen(texte, id);
    if (!e) return null;
    var aus = { kurz: e.kurz, lang: e.lang, verlauf: e.verlauf, wieBei: e.wieBei || '', quelle: id };
    if (e.wieBei) {
      var z = eigen(texte, e.wieBei);
      aus.lang = z ? z.lang : ''; aus.verlauf = z ? z.verlauf : []; aus.quelle = e.wieBei;
    }
    return aus;
  }
  /* Kurztext mit Rückfall: eigener Text → (festes Ziel: Text seiner Seite) → Text des Ordners
     (Feld hub) der Seite. Leer, wenn nichts da ist. seiteVon = { festeId: seitenId }. */
  function kurzMitRueckfall(texte, id, apps, seiteVon) {
    var app = nachId(apps);
    function k(x) { var e = eigen(texte, x); return e ? e.kurz.trim() : ''; }
    var t = k(id);
    if (t) return t;
    var traeger = seiteVon && seiteVon[id] ? seiteVon[id] : id;
    if (traeger !== id) { t = k(traeger); if (t) return t; }
    var a = app[traeger];
    return a && a.hub ? k(a.hub) : '';
  }

  /* ---------- Zählregel „Zahlen zur Entwicklung“ ----------
     Gezählt werden die Verlauf-Einträge der App UND aller Bestandteile, jeder
     gespeicherte Eintrag einmal, einschließlich „erste Fassung“ (Skizze §3.1:
     Froster 16.08. · 9 Updates). wieBei zählt nicht doppelt (Quelle einmal).
     live seit = ältestes Datum, zuletzt = jüngstes. */
  function zahlen(texte, appId, apps, heute) {
    var quellen = {}, eintraege = [];
    [appId].concat(kinder(apps, appId).map(function (a) { return a.id; })).forEach(function (id) {
      var r = aufgeloest(texte, id);
      if (!r || quellen[r.quelle]) return;
      quellen[r.quelle] = true;
      r.verlauf.forEach(function (e) { if (datumGueltig(e.datum)) eintraege.push(e.datum); });
    });
    eintraege.sort();
    return {
      anzahl: eintraege.length,
      erstes: eintraege[0] || '', letztes: eintraege[eintraege.length - 1] || '',
      neu: !!heute && eintraege.some(function (d) { return istNeu(d, heute); })
    };
  }
  /* Anzeige: „live seit 16.08.2026 · 9 Updates · zuletzt 15.10.“; ein Eintrag:
     nur „live seit …“; keiner: ''; geplant: „in Planung“. */
  function zahlenText(z, geplant) {
    if (geplant) return 'in Planung';
    if (!z || !z.anzahl) return '';
    var t = 'live seit ' + anzeigeDatum(z.erstes);
    if (z.anzahl === 1) return t;
    t += ' · ' + z.anzahl + ' Updates';
    if (z.letztes !== z.erstes) t += ' · zuletzt ' + anzeigeDatum(z.letztes, false);
    return t;
  }
  /* IDs ohne eigenen Kurztext (fehlendes Dokument oder leer). */
  function luecken(texte, ids) {
    return (ids || []).filter(function (id) { var e = eigen(texte, id); return !e || !e.kurz.trim(); });
  }

  /* ---------- Erst-Füllungs-Datei ----------
     { art: 'bos-backstore-texte', fassung: 1, texte: { appId: { kurz, lang, verlauf, wieBei? } } }
     Rückgabe: { fehler: [Text], neu: [{ id, inhalt }], vorhanden: [id], unbekannt: [id] } */
  function pruefeDatei(json, ids, texte, heute) {
    var aus = { fehler: [], neu: [], vorhanden: [], unbekannt: [] };
    if (!istKarte(json) || json.art !== DATEI_ART || json.fassung !== 1 || !istKarte(json.texte)) {
      aus.fehler.push('Das ist keine Texte-Datei für den BackStore (erwartet art „' + DATEI_ART + '“, fassung 1).');
      return aus;
    }
    var bekannt = {}; (ids || []).forEach(function (i) { bekannt[i] = true; });
    Object.keys(json.texte).forEach(function (id) {
      var roh = json.texte[id];
      if (!bekannt[id]) { aus.unbekannt.push(id); return; }
      if (texte && texte[id]) { aus.vorhanden.push(id); return; }
      var inh = istKarte(roh) ? { kurz: roh.kurz, lang: roh.lang, verlauf: roh.verlauf } : {};
      if (istKarte(roh) && roh.wieBei !== undefined) inh.wieBei = roh.wieBei;
      if (istKarte(roh)) Object.keys(roh).forEach(function (k) { if (['kurz', 'lang', 'verlauf', 'wieBei'].indexOf(k) === -1) aus.fehler.push(id + ': unbekanntes Feld ' + k); });
      pruefeInhalt(id, inh, heute).forEach(function (f) { aus.fehler.push(id + ' · ' + f.feld + ': ' + f.grund); });
      if (inh.wieBei && !json.texte[inh.wieBei] && !(texte && texte[inh.wieBei])) aus.fehler.push(id + ' · wieBei: „' + inh.wieBei + '“ fehlt in Datei und Datenbank');
      aus.neu.push({ id: id, inhalt: inh });
    });
    return aus;
  }

  /* ---------- Fehlerart ---------- */
  function fehlerArt(err) {
    var c = (err && err.code) || '';
    if (c === 'permission-denied') return 'berechtigung';
    if (c === 'unavailable') return 'netz';
    if (c === 'zeitlimit' || c === 'deadline-exceeded') return 'zeitlimit';
    return 'unbekannt';
  }
  function fehlerText(err) { return '[' + ((err && err.code) || 'ohne Code') + ': ' + ((err && err.message) || String(err)) + ']'; }
  function mitZeitlimit(p, ms) {
    var uhr;
    return Promise.race([p, new Promise(function (_, nein) {
      uhr = setTimeout(function () { var e = new Error('keine Antwort nach ' + Math.round(ms / 1000) + ' s'); e.code = 'zeitlimit'; nein(e); }, ms);
    })]).then(function (w) { clearTimeout(uhr); return w; }, function (e) { clearTimeout(uhr); throw e; });
  }

  /* ---------- Laden (Firestore-Instanz vom Aufrufer) ----------
     Eine Abfrage auf die Sammlung, vom Server. Rückgabe: { appId: Rohdaten }. */
  function ladeAlle(db, ms) {
    if (!db || typeof db.collection !== 'function') return Promise.reject(Object.assign(new Error('Datenbank nicht geladen (Firebase fehlt?)'), { code: 'bos/keine-datenbank' }));
    return mitZeitlimit(db.collection(COLLECTION).get({ source: 'server' }), ms || LADE_ZEITLIMIT_MS).then(function (snap) {
      var t = {};
      snap.forEach(function (d) { t[d.id] = d.data(); });
      return t;
    });
  }
  /* Letzte Sicherungen einer App, neueste zuerst. Ohne zusammengesetzten Index:
     Filter auf appId, sortiert auf dem Gerät. */
  function ladeSicherungen(db, appId, n) {
    return mitZeitlimit(db.collection(SICHERUNGEN).where('appId', '==', appId).get({ source: 'server' }), LADE_ZEITLIMIT_MS).then(function (snap) {
      var l = [];
      snap.forEach(function (d) { var x = d.data(); l.push({ id: d.id, aktion: x.aktion, vorher: x.vorher, konto: x.konto, ms: x.ts && x.ts.toMillis ? x.ts.toMillis() : 0 }); });
      l.sort(function (a, b) { return b.ms - a.ms; });
      return l.slice(0, n || ALTE_FASSUNGEN);
    });
  }
  /* Ein Batch: Sicherung + Text (RK §26 btGesichert). aktion: erstfuellung |
     anlegen (vorher null) | aendern | zurueckholen (vorher = Serverstand). */
  function schreibe(db, FieldValue, appId, inhalt, aktion, vorher, kennung) {
    var ts = FieldValue.serverTimestamp();
    var b = db.batch();
    var sRef = db.collection(SICHERUNGEN).doc();
    b.set(sRef, sicherungFuer(appId, aktion, vorher, kennung, ts));
    b.set(db.collection(COLLECTION).doc(appId), dokumentFuer(inhalt, sRef.id, kennung, ts));
    return b.commit();
  }

  var api = {
    COLLECTION: COLLECTION, SICHERUNGEN: SICHERUNGEN, SPRACHE: SPRACHE, GRENZEN: GRENZEN, FELDER: FELDER,
    PFLICHT: PFLICHT, SICHERUNG_FELDER: SICHERUNG_FELDER, AKTIONEN_ANLEGEN: AKTIONEN_ANLEGEN,
    AKTIONEN_AENDERN: AKTIONEN_AENDERN, NEU_TAGE: NEU_TAGE, ALTE_FASSUNGEN: ALTE_FASSUNGEN,
    LADE_ZEITLIMIT_MS: LADE_ZEITLIMIT_MS, DATEI_ART: DATEI_ART,
    datumHeute: datumHeute, datumGueltig: datumGueltig, tageZwischen: tageZwischen, anzeigeDatum: anzeigeDatum, istNeu: istNeu,
    inhaltAus: inhaltAus, pruefeInhalt: pruefeInhalt, dokumentFuer: dokumentFuer, sicherungFuer: sicherungFuer,
    verlaufSortiert: verlaufSortiert, kinder: kinder, bekannteIds: bekannteIds, aufgeloest: aufgeloest,
    kurzMitRueckfall: kurzMitRueckfall, zahlen: zahlen, zahlenText: zahlenText, luecken: luecken,
    pruefeDatei: pruefeDatei, fehlerArt: fehlerArt, fehlerText: fehlerText, mitZeitlimit: mitZeitlimit,
    ladeAlle: ladeAlle, ladeSicherungen: ladeSicherungen, schreibe: schreibe
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_BACKSTORE_TEXTE = api;
})(typeof window !== 'undefined' ? window : globalThis);
