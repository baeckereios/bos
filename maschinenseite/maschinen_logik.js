/* ================================================================
   BäckereiOS · maschinenseite/maschinen_logik.js — Maschinen, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_MASCHINEN (in Node: module.exports)

   Einbindung NACH bos_firebase_config.js (braucht window.db,
   window.BOS_AUTH_READY, window.firebase), vor dem Seitencode:
     <script src="../maschinenseite/maschinen_logik.js"></script>   (aus einem anderen Ordner)
     <script src="maschinen_logik.js"></script>                     (aus maschinenseite/)

   WARUM eine eigene Datei: Zwei Seiten brauchen die Maschinen — die
   Maschinenseite (alles) und der Produkt-Editor (Maschinenliste für den
   Werdegang). Laden, Grenzen, Dokumente bauen, Schreiben und „warum hat
   die Datenbank nein gesagt“ stehen nur hier. Kein DOM.

   DATEN (Firestore, Regel RK §27, Fassung REGEL_FASSUNG):
     maschinen/{maschineId}                 nur Rolle admin schreibt
       name, exemplare { "1": "Stikkenofen 1", … }, fuehrer [Kennungen],
       felder [{ id, name, art: 'text'|'nummer' }], geloescht?,
       geaendertVon, geaendertAm
       (reserviert, NICHT gebaut, NICHT in der Regel: apps — K6)
     maschinen_reihenfolge/{maschineId}     nur Maschinenführer
       produkte [legacyKey …], geaendertVon, geaendertVonName, geaendertAm
     maschinen_angaben/{maschineId}__{legacyKey}   nur Maschinenführer
       maschine, produkt, werte { feldId: 'Text' }, frueher [ { werte, von,
       vonName, am } … ] (neueste zuerst, höchstens 20), geaendertVon,
       geaendertVonName, geaendertAm
     Produktfeld werdegang [maschineId …] — schreibt der Produkt-Editor,
       nicht diese Datei.

   frueher (K12): Beim Speichern rutscht der BISHERIGE Serverstand vorn in
   die Liste, der Rest rutscht nach, ab 21 fällt der älteste weg. Die
   Regel prüft das Wort für Wort (msFolgt). Wer auf einem veralteten Stand
   speichert, wird abgelehnt — das ist der Sperrzettel.

   WARNUNG: GRENZEN und ID_MUSTER stehen genauso in der Firestore-Regel
   (RK §27). test_maschinen.js --regeln=<Datei> vergleicht beides. Wer hier
   dreht, dreht dort mit — und umgekehrt.

   CHANGELOG
     2026-10-23 · 23:04 · v1.0 · Neu (Maschinenseite Stufe A, #115/#116;
       Bauplan Go KC 22:22, SESSION_2026-10-23_MASCHINENSEITE_STUFE_A_BAU.md)
   ================================================================ */
(function (global) {
  'use strict';

  var REGEL_FASSUNG = 'maschinen-2026-10-23';
  var REGEL_DATEI = 'firestore_regeln_2026-10-23_maschinen.rules';   /* neueste Datei, die REGEL_FASSUNG erfüllt (RK §13, Pflege) */
  var SAMMLUNG = { MASCHINEN: 'maschinen', REIHENFOLGE: 'maschinen_reihenfolge', ANGABEN: 'maschinen_angaben' };
  /* muss 1:1 zur Regel passen (RK §27) */
  var GRENZEN = {
    ID_MUSTER: '^[a-z0-9]{2,30}$', NAME: 40, EXEMPLARE: 12, FUEHRER: 20, FELDER: 12,
    WERTE: 12, FRUEHER: 20, REIHENFOLGE: 300, VON_NAME: 40
  };
  /* nur die Seite (Regel prüft Werte nicht einzeln, RK §27 A3) */
  var SEITE = { TEXT: 300, NUMMER_STELLEN: 4, EXEMPLAR_NAME: 40, FELD_NAME: 40, FELD_ID: 30 };
  var FELD_ARTEN = ['text', 'nummer'];
  var ZEITLIMIT_MS = 15000;
  var ID_RE = new RegExp(GRENZEN.ID_MUSTER);
  var NUMMER_RE = /^[0-9]{1,4}$/;

  function istKarte(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function text(x) { return x === null || x === undefined ? '' : String(x); }
  function zwei(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- Kennungen ---------- */
  function idGueltig(id) { return typeof id === 'string' && ID_RE.test(id); }
  function angabenId(maschineId, produktKey) { return maschineId + '__' + produktKey; }
  /* Feld-Kennung aus der Beschriftung: „Programm Ganz“ → programm_ganz, eindeutig gemacht. */
  function feldIdAus(name, vorhanden) {
    var basis = text(name).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, SEITE.FELD_ID - 3) || 'feld';
    var belegt = {}; (vorhanden || []).forEach(function (x) { belegt[x] = true; });
    if (!belegt[basis]) return basis;
    for (var i = 2; i < 100; i++) if (!belegt[basis + '_' + i]) return basis + '_' + i;
    return basis + '_' + Date.now();
  }
  function exemplarSchluessel(exemplare) {
    return Object.keys(exemplare || {}).filter(function (k) { return /^[0-9]+$/.test(k); })
      .sort(function (a, b) { return Number(a) - Number(b); });
  }
  function naechsterExemplarSchluessel(exemplare) {
    var s = exemplarSchluessel(exemplare);
    return String(s.length ? Number(s[s.length - 1]) + 1 : 1);
  }
  function standardFelder() { return [{ id: 'hinweis', name: 'Hinweis', art: 'text' }]; }

  /* ---------- Maschine prüfen und bauen ---------- */
  /* eingabe: { id, name, exemplare, fuehrer, felder, geloescht } — Ergebnis: Liste von Fehlertexten. */
  function pruefeMaschine(e) {
    var f = [];
    if (!e || typeof e !== 'object') return ['Keine Angaben.'];
    if (!idGueltig(e.id)) f.push('Kennung: nur Kleinbuchstaben und Ziffern, 2 bis 30 Zeichen, kein Leerzeichen, kein Unterstrich.');
    var name = text(e.name).trim();
    if (!name) f.push('Name fehlt.');
    else if (name.length > GRENZEN.NAME) f.push('Name: höchstens ' + GRENZEN.NAME + ' Zeichen.');
    var ex = exemplarSchluessel(e.exemplare);
    if (!istKarte(e.exemplare) || !ex.length) f.push('Mindestens ein Exemplar.');
    else if (Object.keys(e.exemplare).length !== ex.length) f.push('Exemplare: unbekannter Schlüssel.');
    else if (ex.length > GRENZEN.EXEMPLARE) f.push('Höchstens ' + GRENZEN.EXEMPLARE + ' Exemplare.');
    else ex.forEach(function (k) {
      var n = text(e.exemplare[k]).trim();
      if (!n) f.push('Exemplar ' + k + ': Name fehlt.');
      else if (n.length > SEITE.EXEMPLAR_NAME) f.push('Exemplar ' + k + ': höchstens ' + SEITE.EXEMPLAR_NAME + ' Zeichen.');
    });
    if (!Array.isArray(e.fuehrer)) f.push('Maschinenführer: keine Liste.');
    else {
      if (e.fuehrer.length > GRENZEN.FUEHRER) f.push('Höchstens ' + GRENZEN.FUEHRER + ' Maschinenführer.');
      var gesehen = {};
      e.fuehrer.forEach(function (k) {
        if (typeof k !== 'string' || !/^[a-z0-9._-]{1,60}$/.test(k)) f.push('Maschinenführer: ungültige Kennung „' + text(k) + '“.');
        else if (gesehen[k]) f.push('Maschinenführer doppelt: ' + k + '.');
        gesehen[k] = true;
      });
    }
    if (!Array.isArray(e.felder) || !e.felder.length) f.push('Mindestens ein Feld (Standard: Hinweis).');
    else {
      if (e.felder.length > GRENZEN.FELDER) f.push('Höchstens ' + GRENZEN.FELDER + ' Felder.');
      var ids = {};
      e.felder.forEach(function (x, i) {
        var n = 'Feld ' + (i + 1);
        if (!istKarte(x)) { f.push(n + ': ungültig.'); return; }
        if (typeof x.id !== 'string' || !/^[a-z0-9_]{1,30}$/.test(x.id)) f.push(n + ': ungültige Kennung.');
        else if (ids[x.id]) f.push(n + ': Kennung doppelt (' + x.id + ').');
        ids[x.id] = true;
        var fn = text(x.name).trim();
        if (!fn) f.push(n + ': Beschriftung fehlt.');
        else if (fn.length > SEITE.FELD_NAME) f.push(n + ': Beschriftung höchstens ' + SEITE.FELD_NAME + ' Zeichen.');
        if (FELD_ARTEN.indexOf(x.art) === -1) f.push(n + ': Art muss Text oder Nummer sein.');
      });
    }
    return f;
  }
  function maschineDokument(e, kennung, zeit) {
    var ex = {};
    exemplarSchluessel(e.exemplare).forEach(function (k) { ex[k] = text(e.exemplare[k]).trim(); });
    var d = {
      name: text(e.name).trim(), exemplare: ex, fuehrer: (e.fuehrer || []).slice(),
      felder: (e.felder || []).map(function (x) { return { id: x.id, name: text(x.name).trim(), art: x.art }; }),
      geaendertVon: kennung, geaendertAm: zeit
    };
    if (e.geloescht === true) d.geloescht = true;
    return d;
  }
  function istFuehrer(maschine, kennung) {
    return !!maschine && maschine.geloescht !== true && Array.isArray(maschine.fuehrer) && maschine.fuehrer.indexOf(kennung) !== -1;
  }

  /* ---------- Werte ---------- */
  /* Ein Eingabewert → gespeicherter Text oder null (leer = Feld fehlt in werte). */
  function normWert(feld, roh) {
    var s = text(roh).replace(/\r\n?/g, '\n');
    s = feld && feld.art === 'nummer' ? s.replace(/\s+/g, '') : s.trim();
    return s === '' ? null : s;
  }
  function pruefeWert(feld, roh) {
    var s = normWert(feld, roh);
    if (s === null) return null;
    if (feld.art === 'nummer' && !NUMMER_RE.test(s)) return feld.name + ': nur Ziffern, höchstens ' + SEITE.NUMMER_STELLEN + '.';
    if (feld.art !== 'nummer' && s.length > SEITE.TEXT) return feld.name + ': höchstens ' + SEITE.TEXT + ' Zeichen (jetzt ' + s.length + ').';
    return null;
  }
  /* Neue Werte-Karte: Felder der Maschine aus der Eingabe, alle übrigen
     Schlüssel (entfernte Felder) bleiben aus dem bisherigen Stand (K10). */
  function werteAus(felder, eingabe, alteWerte) {
    var neu = {};
    var aktiv = {};
    (felder || []).forEach(function (f) { aktiv[f.id] = true; });
    Object.keys(alteWerte || {}).forEach(function (k) { if (!aktiv[k]) neu[k] = alteWerte[k]; });
    (felder || []).forEach(function (f) {
      var v = normWert(f, (eingabe || {})[f.id]);
      if (v !== null) neu[f.id] = v;
    });
    return neu;
  }
  function werteGleich(a, b) {
    var ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
    if (ka.join('\u0001') !== kb.join('\u0001')) return false;
    return ka.every(function (k) { return text(a[k]) === text(b[k]); });
  }

  /* ---------- Angaben-Dokument mit frueher (K12) ---------- */
  function frueherEintrag(alt) {
    return { werte: alt.werte, von: alt.geaendertVon, vonName: alt.geaendertVonName, am: alt.geaendertAm };
  }
  /* alt = rohes Serverdokument oder null. ich = { kennung, name }. */
  function angabenDokument(maschineId, produktKey, werte, alt, ich, zeit) {
    var frueher = [];
    if (alt) {
      frueher = [frueherEintrag(alt)].concat(Array.isArray(alt.frueher) ? alt.frueher : []);
      if (frueher.length > GRENZEN.FRUEHER) frueher = frueher.slice(0, GRENZEN.FRUEHER);
    }
    return {
      maschine: maschineId, produkt: produktKey, werte: werte, frueher: frueher,
      geaendertVon: ich.kennung, geaendertVonName: vonName(ich), geaendertAm: zeit
    };
  }
  function vonName(ich) { var n = text(ich && ich.name).trim() || text(ich && ich.kennung); return n.slice(0, GRENZEN.VON_NAME); }
  function reihenfolgeDokument(liste, ich, zeit) {
    return { produkte: liste.slice(0, GRENZEN.REIHENFOLGE), geaendertVon: ich.kennung, geaendertVonName: vonName(ich), geaendertAm: zeit };
  }

  /* ---------- Produkte und Reihenfolge ---------- */
  function werdegangVon(p) { return p && Array.isArray(p.werdegang) ? p.werdegang : []; }
  function produkteDerMaschine(produkte, maschineId) {
    return (produkte || []).filter(function (p) { return werdegangVon(p).indexOf(maschineId) !== -1; });
  }
  /* produkte in Backreihenfolge: erst die gepflegte Liste, dann die übrigen
     in ihrer Eingangsreihenfolge (= Produktreihenfolge), markiert als neu. */
  function inReihenfolge(produkte, liste) {
    var pos = {}; (liste || []).forEach(function (k, i) { if (pos[k] === undefined) pos[k] = i; });
    var drin = [], neu = [];
    (produkte || []).forEach(function (p, i) { (pos[p.legacyKey] !== undefined ? drin : neu).push({ p: p, i: i }); });
    drin.sort(function (a, b) { return pos[a.p.legacyKey] - pos[b.p.legacyKey]; });
    var neuKeys = {}; neu.forEach(function (x) { neuKeys[x.p.legacyKey] = true; });
    return { liste: drin.concat(neu).map(function (x) { return x.p; }), neu: neuKeys };
  }
  /* Neue gespeicherte Liste: unsichtbare Schlüssel behalten ihren Platz,
     die sichtbaren Plätze werden in der neuen Reihenfolge gefüllt, neue hinten. */
  function reihenfolgeNeu(alteListe, sichtbar) {
    var sicht = {}; sichtbar.forEach(function (k) { sicht[k] = true; });
    var gesehen = {}, rest = sichtbar.slice(), aus = [];
    (alteListe || []).forEach(function (k) {
      if (gesehen[k]) return; gesehen[k] = true;
      if (sicht[k]) { if (rest.length) aus.push(rest.shift()); }
      else aus.push(k);
    });
    rest.forEach(function (k) { if (aus.indexOf(k) === -1) aus.push(k); });
    while (aus.length > GRENZEN.REIHENFOLGE) {
      var weg = -1;
      for (var i = 0; i < aus.length; i++) if (!sicht[aus[i]]) { weg = i; break; }
      if (weg === -1) break;
      aus.splice(weg, 1);
    }
    return aus;
  }
  function verschiebe(liste, index, richtung) {
    var neu = liste.slice(), ziel = index + richtung;
    if (index < 0 || index >= neu.length || ziel < 0 || ziel >= neu.length) return neu;
    var x = neu[index]; neu[index] = neu[ziel]; neu[ziel] = x;
    return neu;
  }
  /* Werdegang gegen die angelegten Maschinen: je Eintrag ok | ausgeblendet | unbekannt. */
  function werdegangPruefen(werdegang, maschinen) {
    var m = {}; (maschinen || []).forEach(function (x) { m[x.id] = x; });
    return (werdegang || []).map(function (id) {
      var x = m[id];
      if (!x) return { id: id, status: 'unbekannt', name: id };
      return { id: id, status: x.geloescht === true ? 'ausgeblendet' : 'ok', name: x.name || id };
    });
  }

  /* ---------- Konto ---------- */
  function kontoArt(konto) { var a = konto && konto.art; return a === 'person' || a === 'ort' || a === 'system' ? a : ''; }
  /* Darf dieses Konto die Maschinenseite lesen? (wie msLesen der Regel; Generalschlüssel erkennt die Seite nicht) */
  function zugang(konto) {
    if (!konto) return { lesen: false, grund: 'kein_konto' };
    if (konto.freigeschaltet !== true) return { lesen: false, grund: 'gesperrt' };
    var admin = konto.role === 'admin';
    var art = kontoArt(konto);
    if (art === 'person') return { lesen: true, person: true, admin: admin, grund: '' };
    if (admin) return { lesen: true, person: false, admin: true, grund: art === '' ? 'ohne_art' : art };
    return { lesen: false, person: false, admin: false, grund: art === '' ? 'ohne_art' : art };
  }

  /* ---------- Zeit ---------- */
  function msVon(t) {
    if (!t) return null;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.ms === 'number') return t.ms;
    if (t instanceof Date) return t.getTime();
    if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
    return null;
  }
  function zeitText(t) {
    var ms = msVon(t); if (ms === null) return '';
    var d = new Date(ms);
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes()) + ' Uhr';
  }

  /* ---------- Fehler einordnen ---------- */
  function fehlerOriginal(err) { return ((err && err.code) ? err.code + ' — ' : '') + ((err && err.message) || String(err)); }
  function fehlerArt(err) {
    var c = err && err.code;
    if (c === 'permission-denied') return 'keine_berechtigung';
    if (c === 'unavailable') return 'kein_netz';
    if (c === 'zeitlimit') return 'zeitlimit';
    if (c === 'resource-exhausted') return 'kontingent';
    return 'fehler';
  }
  var ART_TEXT = {
    kein_netz: 'Kein Netz — die Datenbank ist gerade nicht erreichbar. Gleich noch einmal versuchen.',
    zeitlimit: 'Keine Antwort nach ' + (ZEITLIMIT_MS / 1000) + ' Sekunden (Zeitlimit). Es kann trotzdem noch ankommen — nachsehen, dann erst wiederholen.',
    kontingent: 'Das Tageskontingent der Datenbank ist aufgebraucht — morgen wieder, oder Ulf Bescheid geben.',
    keine_berechtigung: 'Die Datenbank hat abgelehnt (keine Berechtigung).',
    fehler: 'Unerwarteter Fehler.'
  };
  function einordnen(err) {
    if (err && err.art && err.meldung) return err;
    var a = fehlerArt(err);
    return { art: a, meldung: ART_TEXT[a], original: fehlerOriginal(err) };
  }
  function mitZeitlimit(p, ms) {
    return new Promise(function (ja, nein) {
      var fertig = false;
      var uhr = setTimeout(function () { if (fertig) return; fertig = true; var e = new Error('Keine Antwort nach ' + ((ms || ZEITLIMIT_MS) / 1000) + ' s'); e.code = 'zeitlimit'; nein(e); }, ms || ZEITLIMIT_MS);
      p.then(function (x) { if (fertig) return; fertig = true; clearTimeout(uhr); ja(x); },
        function (e) { if (fertig) return; fertig = true; clearTimeout(uhr); nein(e); });
    });
  }

  /* ---------- Datenbank ---------- */
  function datenbank(db) { var d = db || global.db; if (!d) { var e = new Error('Datenbank nicht geladen (bos_firebase_config.js fehlt?)'); e.code = 'nicht_geladen'; throw e; } return d; }
  function serverZeit() { return global.firebase.firestore.FieldValue.serverTimestamp(); }
  function pruefeRegelstand(db) {
    return mitZeitlimit(datenbank(db).collection('bos_regelstand').doc(REGEL_FASSUNG).get({ source: 'server' }))
      .then(function () { return 'passt'; }, function (err) { return err && err.code === 'permission-denied' ? 'alt' : 'unbekannt'; });
  }
  function ladeKonto(db, kennung) {
    var d = datenbank(db);
    if (global.BOS_ACCOUNTS && typeof global.BOS_ACCOUNTS.ladeKonto === 'function') return mitZeitlimit(global.BOS_ACCOUNTS.ladeKonto(d, kennung));
    return mitZeitlimit(d.collection('bos_accounts').doc(kennung).get()).then(function (s) { return s.exists ? s.data() : null; });
  }
  function ladeMaschinen(db) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.MASCHINEN).get()).then(function (snap) {
      var l = []; snap.forEach(function (d) { var x = d.data() || {}; x.id = d.id; l.push(x); });
      l.sort(function (a, b) { return text(a.name).localeCompare(text(b.name), 'de'); });
      return l;
    });
  }
  function ladeMaschine(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.MASCHINEN).doc(id).get({ source: 'server' }))
      .then(function (s) { if (!s.exists) return null; var x = s.data() || {}; x.id = s.id; return x; });
  }
  function ladeReihenfolge(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.REIHENFOLGE).doc(id).get({ source: 'server' }))
      .then(function (s) { return s.exists ? s.data() : null; });
  }
  /* alle Angaben einer Maschine: { legacyKey: rohes Dokument } */
  function ladeAngaben(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.ANGABEN).where('maschine', '==', id).get({ source: 'server' }))
      .then(function (snap) { var m = {}; snap.forEach(function (d) { var x = d.data() || {}; if (x.produkt) m[x.produkt] = x; }); return m; });
  }
  function ladeAngabe(db, maschineId, produktKey) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.ANGABEN).doc(angabenId(maschineId, produktKey)).get({ source: 'server' }))
      .then(function (s) { return s.exists ? s.data() : null; });
  }
  function speichereMaschine(db, eingabe, kennung) {
    var f = pruefeMaschine(eingabe);
    if (f.length) { var e = new Error(f.join(' ')); e.code = 'eingabe'; return Promise.reject(e); }
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.MASCHINEN).doc(eingabe.id).set(maschineDokument(eingabe, kennung, serverZeit())));
  }
  /* alt = rohes Serverdokument (beim Laden) oder null */
  function speichereAngaben(db, maschineId, produktKey, werte, alt, ich) {
    if (Object.keys(werte).length > GRENZEN.WERTE) { var e = new Error('Zu viele Werte (' + Object.keys(werte).length + ', höchstens ' + GRENZEN.WERTE + ').'); e.code = 'eingabe'; return Promise.reject(e); }
    var dok = angabenDokument(maschineId, produktKey, werte, alt, ich, serverZeit());
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.ANGABEN).doc(angabenId(maschineId, produktKey)).set(dok));
  }
  function speichereReihenfolge(db, maschineId, liste, ich) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.REIHENFOLGE).doc(maschineId).set(reihenfolgeDokument(liste, ich, serverZeit())));
  }

  /* Nach einer Ablehnung den richtigen Grund finden (Checkliste §7a:
     „eine falsche Erklärung ist schlechter als keine“).
     k = { art: 'angaben'|'reihenfolge'|'maschine', kennung, maschineId, produktKey, altAm } */
  function erklaere(db, err, k) {
    var basis = einordnen(err);
    if (basis.art !== 'keine_berechtigung') return Promise.resolve(basis);
    var orig = basis.original;
    function g(art, meldung, extra) { var r = { art: art, meldung: meldung, original: orig }; if (extra) Object.keys(extra).forEach(function (x) { r[x] = extra[x]; }); return r; }
    return pruefeRegelstand(db).then(function (stand) {
      if (stand === 'alt') return g('regel_alt', 'Die Firestore-Regeln sind älter als diese Seite. In der Firebase-Konsole ' + REGEL_DATEI + ' einsetzen (Fassung ' + REGEL_FASSUNG + '). Nichts gespeichert.');
      return ladeKonto(db, k.kennung).then(function (konto) {
        var z = zugang(konto);
        if (k.art === 'maschine') {
          if (!konto || konto.role !== 'admin') return g('kein_admin', 'Maschinen anlegen und ändern darf nur die Rolle Admin. Nichts gespeichert.');
          return g('abgelehnt', 'Die Datenbank hat die Maschine abgelehnt. Nichts gespeichert.');
        }
        if (!z.person) return g('keine_person', 'Dein Konto ist kein persönliches Konto (' + (z.grund === 'ort' ? 'eingetragen als „Ort“' : z.grund === 'ohne_art' ? 'keine Art eingetragen' : z.grund === 'system' ? 'Generalschlüssel' : 'nicht freigeschaltet') + '). Speichern dürfen nur eingetragene Maschinenführer mit persönlichem Konto. Ulf fragen (Konten & Rollen → Konto → Freigabe).');
        return ladeMaschine(db, k.maschineId).then(function (m) {
          if (!istFuehrer(m, k.kennung)) return g('kein_fuehrer', m && m.geloescht === true ? 'Die Maschine ist ausgeblendet — dort speichert niemand mehr. Nichts gespeichert.' : 'Du bist bei dieser Maschine nicht (mehr) als Maschinenführer eingetragen. Nichts gespeichert. Admin fragen (Verwalten → Maschinenführer).');
          if (k.art === 'angaben') {
            return ladeAngabe(db, k.maschineId, k.produktKey).then(function (jetzt) {
              var a = msVon(k.altAm), b = msVon(jetzt && jetzt.geaendertAm);
              if ((jetzt && !k.altAm) || (jetzt && a !== b)) return g('konflikt', 'Inzwischen hat ' + (jetzt.geaendertVonName || jetzt.geaendertVon || 'jemand') + ' hier gespeichert (' + zeitText(jetzt.geaendertAm) + '). Nichts gespeichert. Neu laden — deine Eingaben bleiben stehen.', { jetzt: jetzt });
              return g('abgelehnt', 'Die Datenbank hat die Angaben abgelehnt. Nichts gespeichert.');
            });
          }
          return g('abgelehnt', 'Die Datenbank hat die Reihenfolge abgelehnt. Nichts gespeichert.');
        });
      });
    }).catch(function (e2) {
      var r = einordnen(err); r.meldung = r.meldung + ' Den Grund konnte die Seite nicht klären (' + fehlerOriginal(e2) + ').'; return r;
    });
  }

  var api = {
    REGEL_FASSUNG: REGEL_FASSUNG, REGEL_DATEI: REGEL_DATEI, SAMMLUNG: SAMMLUNG, GRENZEN: GRENZEN, SEITE: SEITE,
    FELD_ARTEN: FELD_ARTEN, ZEITLIMIT_MS: ZEITLIMIT_MS,
    idGueltig: idGueltig, angabenId: angabenId, feldIdAus: feldIdAus, exemplarSchluessel: exemplarSchluessel,
    naechsterExemplarSchluessel: naechsterExemplarSchluessel, standardFelder: standardFelder,
    pruefeMaschine: pruefeMaschine, maschineDokument: maschineDokument, istFuehrer: istFuehrer,
    normWert: normWert, pruefeWert: pruefeWert, werteAus: werteAus, werteGleich: werteGleich,
    frueherEintrag: frueherEintrag, angabenDokument: angabenDokument, reihenfolgeDokument: reihenfolgeDokument,
    werdegangVon: werdegangVon, produkteDerMaschine: produkteDerMaschine, inReihenfolge: inReihenfolge,
    reihenfolgeNeu: reihenfolgeNeu, verschiebe: verschiebe, werdegangPruefen: werdegangPruefen,
    kontoArt: kontoArt, zugang: zugang, msVon: msVon, zeitText: zeitText,
    fehlerOriginal: fehlerOriginal, fehlerArt: fehlerArt, einordnen: einordnen, mitZeitlimit: mitZeitlimit,
    pruefeRegelstand: pruefeRegelstand, ladeKonto: ladeKonto, ladeMaschinen: ladeMaschinen, ladeMaschine: ladeMaschine,
    ladeReihenfolge: ladeReihenfolge, ladeAngaben: ladeAngaben, ladeAngabe: ladeAngabe,
    speichereMaschine: speichereMaschine, speichereAngaben: speichereAngaben, speichereReihenfolge: speichereReihenfolge,
    erklaere: erklaere
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_MASCHINEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
