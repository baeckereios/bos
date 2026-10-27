/* ================================================================
   BäckereiOS · nachrichtenzentrale/nachrichten_logik.js — die Nachrichtenzentrale ohne DOM
   ================================================================
   Stellt bereit: window.BOS_NACHRICHTEN (in Node: module.exports)

   Einbindung NACH bos_firebase_config.js, bos_accounts.js, bos_namen.js und
   ../bos_nachrichten_zahl.js (Zählregel und gemeinsame kleine Helfer), vor
   nachrichten_ansicht.js:
     <script src="../bos_nachrichten_zahl.js"></script>
     <script src="nachrichten_logik.js"></script>

   WARUM eine eigene Datei: Laden, Grenzen, Dokumente bauen, Schreiben,
   Status und „warum hat die Datenbank nein gesagt“ stehen nur hier und sind
   in Node prüfbar (Muster maschinenseite/maschinen_logik.js). Jedes
   Dokument, das die Seite schreibt, baut eine Funktion dieser Datei — die
   Prüfung schickt genau diese Objekte durch die Regel-Nachbildung.

   DATEN (Firestore, Regel RK §29, Fassung REGEL_FASSUNG — die Feldlisten der
   Regel sind das Gesetz; ein Feld mehr und die Datenbank lehnt ab):
     nachrichten/{id}
       normal:  { von, vonName, typ ∈ nachricht|info|lob|kritik, empfaenger [1–100],
                  text 1–2000, erstellt, fristStart, daumen [] } (+ ersetzt)
       Aushang: { von, vonName, typ 'bekanntmachung', text, erstellt, giltBis 'JJJJ-MM-TT' }
                  (+ ersetzt) — kein empfaenger, kein daumen, kein fristStart bis zum Abnehmen
       ändern:  nur daumen (eigene Kennung dazu/weg, Empfänger) · nur ersetztDurch
                (Korrektur-Batch) · nur fristStart (Aushang abnehmen: Verfasser/Planung)
     nachrichten/{id}/antworten/{a}  { von, vonName, an, text 1–1000, ts, fristStart }
     nachrichten_status/{ich}  { gelesen: { id: ms }, ausgeblendet: { id: ms } } (T8)
     nachrichten_adressbuch/{kennung}  Schild (1b), lesen jeder mit Konto
     nachrichten_vorlagen/{id}  { name, kennungen, quelle, reihenfolge } (1b)

   ABFRAGEN (Anweisung 1c §2 — genau diese, keine anderen; Indexe 1–3):
     L1 Postfach  N.where('empfaenger','array-contains',ich).orderBy('erstellt','desc').limit(200)
     L2 Aushänge  N.where('typ','==','bekanntmachung').orderBy('erstellt','desc').limit(100)
     L3 Gesendet  N.where('von','==',ich).orderBy('erstellt','desc').limit(200)
     L4 Status    nachrichten_status/<ich>
     L5 Adressbuch, L6 Vorlagen — ohne Filter (die Regel erlaubt es jedem Konto)
     L7 Antworten je Nachricht, erst beim Öffnen: Absender ohne Filter;
        Empfänger zwei Abfragen where('von','==',ich) + where('an','==',ich),
        zusammengeführt, nach ts in der Seite sortiert. Kein collectionGroup
        (die Regel hat keinen Sammelpfad, B15).
     L8 Namen: BOS_NAMEN.laden(db) — eine Abfrage 'namen' je Seite.
     Kette: ein get je fehlendem Glied (ersetzt), höchstens GRENZEN.KETTE.

   CHANGELOG
     2026-10-27 · 08:04 · v1.0 · Feature (Nachrichtenzentrale Stufe 1c, #131;
       Bauplan, Go Kontroll-Chat 07:54 mit A1–A8). Neu.
       nachrichtenzentrale/_protokolle/SESSION_2026-10-27_NACHRICHTENZENTRALE_STUFE_1C_BAU.md
   ================================================================ */
(function (global) {
  'use strict';

  var Z = global.BOS_NACHRICHTEN_ZAHL ||
    (typeof require === 'function' ? require('../bos_nachrichten_zahl.js') : null);
  if (!Z) throw new Error('bos_nachrichten_zahl.js fehlt — muss VOR nachrichten_logik.js geladen werden.');

  /* Regelstand (RK §13). REGEL_DATEI = neueste Datei, die REGEL_FASSUNG erfüllt (Pflege bei jeder neuen Regel). */
  var REGEL_FASSUNG = 'nachrichten-2026-10-27';
  var REGEL_DATEI = 'firestore_regeln_2026-10-27_nachrichten.rules';
  /* Die drei Fassungen, die RK §29 erfüllen (Bau-Doku 1b §6 Nr. 13): Hauptform, flache Listen, Rückfall B. */
  var FASSUNGEN = [
    { fassung: REGEL_FASSUNG, datei: REGEL_DATEI, art: 'haupt' },
    { fassung: 'nachrichten-flach-2026-10-27', datei: 'RUECKFALL_FLACH_firestore_regeln_2026-10-27_nachrichten.rules', art: 'flach' },
    { fassung: 'nachrichten-leser-2026-10-27', datei: 'RUECKFALL_B_LESER_firestore_regeln_2026-10-27_nachrichten.rules', art: 'leser' }
  ];
  var SAMMLUNG = { N: 'nachrichten', STATUS: 'nachrichten_status', ADRESSBUCH: 'nachrichten_adressbuch', VORLAGEN: 'nachrichten_vorlagen', ANTWORTEN: 'antworten' };
  /* muss 1:1 zur Regel passen (RK §29) — Seite prüft vorher, die Regel prüft hart */
  var GRENZEN = {
    TEXT: 2000, ANTWORT: 1000, NAME: 40, EMPFAENGER: 100,
    POSTFACH: 200, AUSHAENGE: 100, GESENDET: 200,
    KETTE: 10, STATUS_TAGE: 41, GILT_VORGABE_TAGE: 14
  };
  var TYPEN = ['nachricht', 'info', 'lob', 'kritik', 'bekanntmachung'];
  var CRUMBLE = Z.CRUMBLE;
  var TAG_MS = 86400000;
  var ZEITLIMIT_MS = 12000;

  /* ---------- kleine Helfer ---------- */
  function text(t) { return (t === null || t === undefined) ? '' : String(t); }
  function sauber(t, max) { var s = text(t).replace(/\s+/g, ' ').trim(); return max ? s.slice(0, max) : s; }
  function hatFeld(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function einmal(liste) { var s = {}, r = []; (liste || []).forEach(function (x) { if (x && !s[x]) { s[x] = true; r.push(x); } }); return r; }
  function plusTage(tag, n) {
    var t = String(tag).split('-').map(Number);
    var d = new Date(t[0], t[1] - 1, t[2] + n, 12);   // Mittag: keine Sommerzeit-Falle
    return Z.heute(d);
  }
  function istTag(s) {
    if (typeof s !== 'string' || !/^20[0-9]{2}-[01][0-9]-[0-3][0-9]$/.test(s)) return false;   // Regel: matches('^20[0-9]{2}-[01][0-9]-[0-3][0-9]$')
    var t = s.split('-').map(Number), d = new Date(t[0], t[1] - 1, t[2], 12);
    return d.getFullYear() === t[0] && d.getMonth() === t[1] - 1 && d.getDate() === t[2];
  }
  function mitZeitlimit(p, ms) {
    return new Promise(function (ja, nein) {
      var fertig = false;
      var uhr = setTimeout(function () { if (fertig) return; fertig = true; var e = new Error('Keine Antwort nach ' + ((ms || ZEITLIMIT_MS) / 1000) + ' s'); e.code = 'zeitlimit'; nein(e); }, ms || ZEITLIMIT_MS);
      Promise.resolve(p).then(function (x) { if (fertig) return; fertig = true; clearTimeout(uhr); ja(x); },
        function (e) { if (fertig) return; fertig = true; clearTimeout(uhr); nein(e); });
    });
  }
  function fehler(code, meldung) { var e = new Error(meldung); e.code = code; return e; }
  function datenbank(db) { var d = db || global.db; if (!d) throw fehler('nicht_geladen', 'Datenbank nicht geladen (bos_firebase_config.js fehlt?)'); return d; }
  function serverZeit() { return global.firebase.firestore.FieldValue.serverTimestamp(); }
  function liste(snap) { var l = []; snap.forEach(function (d) { var x = d.data() || {}; x.id = d.id; l.push(x); }); return l; }
  function nachZeit(feld, ab) {
    return function (a, b) {
      var x = Z.ms(a[feld]), y = Z.ms(b[feld]);
      if (x === null) x = ab ? -Infinity : Infinity;   // noch ohne Serverzeit (eben geschrieben) = neueste
      if (y === null) y = ab ? -Infinity : Infinity;
      return ab ? (y - x) : (x - y);
    };
  }

  /* ---------- wer bin ich (Anweisung §1) ---------- */
  /* zugang(konto, kennung) — rein. zustand: 'ohne_konto' | 'gesperrt' | 'system' | 'station' | 'ohne_art' | 'voll'
     (Z.zustand: dieselbe Mechanik wie die Kachel-Zahl). */
  function zugang(konto, kennung) {
    var k = konto || {};
    var zustand = Z.zustand(konto);
    var rolle = k.role || null;
    return {
      kennung: kennung, zustand: zustand, freigeschaltet: k.freigeschaltet === true, art: k.art || null, rolle: rolle,
      schreiben: zustand === 'voll' && k.nachrichtenSchreiben === true,
      bekanntmachung: zustand === 'voll' && k.nachrichtenSchreiben === true && k.nachrichtenBekanntmachung === true,
      empfangen: k.nachrichtenEmpfangen === true,
      empfaenger: Z.istEmpfaenger(konto),
      istPlanung: k.freigeschaltet === true && (rolle === 'admin' || rolle === 'produktionsleitung'),
      voll: zustand === 'voll',
      nurAushaenge: zustand === 'station' || zustand === 'system' || zustand === 'ohne_art'
    };
  }
  function ladeKonto(db, kennung) {
    var d = datenbank(db);
    if (global.BOS_ACCOUNTS && typeof global.BOS_ACCOUNTS.ladeKonto === 'function') return mitZeitlimit(global.BOS_ACCOUNTS.ladeKonto(d, kennung));
    return mitZeitlimit(d.collection('bos_accounts').doc(kennung).get()).then(function (s) { return s.exists ? s.data() : null; });
  }
  /* wer(db) — Kennung aus der Anmeldung, Konto frisch. Wirft bei „nicht angemeldet“ und bei unlesbarem Konto
     (die Seite zeigt den Grund; ohne Konto keine Nachrichten — kein Geräte-Rückfall, weil die Regel ohnehin
     am Konto hängt und ein falsches „Postfach leer“ schlimmer wäre als eine ehrliche Fehlerzeile, Checkliste §7a). */
  function wer(db) {
    var bereit = global.BOS_AUTH_READY || Promise.reject(fehler('nicht_geladen', 'bos_firebase_config.js ist nicht geladen.'));
    return Promise.resolve(bereit).then(function (nutzer) {
      if (!nutzer || !nutzer.email) throw fehler('nicht_angemeldet', 'Nicht angemeldet — bitte an der Tür anmelden.');
      var kennung = String(nutzer.email).split('@')[0].toLowerCase();
      return ladeKonto(db, kennung).then(function (konto) { var z = zugang(konto, kennung); z.konto = konto; return z; });
    });
  }

  /* ---------- Regelstand (RK §13) ---------- */
  function pruefeRegelstand(db) {
    var d = datenbank(db), i = 0, letzter = null;
    function naechste() {
      if (i >= FASSUNGEN.length) return Promise.resolve({ stand: letzter && letzter.code === 'permission-denied' ? 'alt' : 'unbekannt', fassung: null, datei: REGEL_DATEI, fehler: letzter });
      var f = FASSUNGEN[i++];
      return mitZeitlimit(d.collection('bos_regelstand').doc(f.fassung).get({ source: 'server' }))
        .then(function () { return { stand: 'passt', fassung: f.fassung, datei: f.datei, art: f.art }; },
          function (err) { letzter = err; if (err && err.code !== 'permission-denied') { i = FASSUNGEN.length; } return naechste(); });
    }
    return naechste();
  }

  /* ---------- Namen (Bauplan §1.2) ---------- */
  /* namenAus(adressbuch, namen) → name(kennung, rueckfall). adressbuch: { kennung: Eintrag }.
     namen: { anzeige(nr) } (BOS_NAMEN) oder null. Reihenfolge: Person → Rufname/Beschreibung
     über personId; Ort → name aus dem Eintrag; sonst rueckfall (vonName der Nachricht); sonst Kennung.
     NIE die Konto-Notiz einer Person (Muster bos_meldungen.js eigenerName). */
  function personName(namen, personId) {
    if (!namen || typeof namen.anzeige !== 'function' || !personId) return '';
    var n = text(namen.anzeige(personId));
    /* bos_namen.js kennt kein „fehlt“ — es liefert dann genau diesen Rückfalltext (bos_namen.js anzeige(),
       Fund F16; Nebenfund N8: BOS_NAMEN.hat(nr) wäre sauberer). */
    if (!n || n === personId + ' · kein Name hinterlegt' || n === '— keine Nummer') return '';
    return sauber(n, GRENZEN.NAME);
  }
  function namenAus(adressbuch, namen) {
    var cache = {};
    return function name(kennung, rueckfall) {
      var k = text(kennung);
      if (!k) return '—';
      if (!rueckfall && hatFeld(cache, k)) return cache[k];
      var e = (adressbuch || {})[k];
      var n = '';
      if (e) {
        if (e.personId) n = personName(namen, e.personId);
        else if (e.art === 'ort') n = sauber(e.name, GRENZEN.NAME);
      }
      if (!n && rueckfall) n = sauber(rueckfall, GRENZEN.NAME);
      if (!n) n = k;
      if (!rueckfall) cache[k] = n;
      return n;
    };
  }
  /* eigener Name (vonName, ≤ 40, Regel nzName): derselbe Weg über den eigenen Adressbuch-Eintrag. */
  function eigenerName(adressbuch, namen, kennung) {
    var e = (adressbuch || {})[kennung];
    if (e && e.personId) { var p = personName(namen, e.personId); if (p) return { name: p, quelle: 'rufname' }; }
    if (e && e.art === 'ort' && sauber(e.name, GRENZEN.NAME)) return { name: sauber(e.name, GRENZEN.NAME), quelle: 'ort' };
    return { name: sauber(kennung, GRENZEN.NAME), quelle: e ? 'kennung' : 'kein_eintrag' };
  }

  /* ---------- Status (T4, T8) ---------- */
  function statusNormal(roh) {
    var r = roh || {};
    var st = { gelesen: {}, ausgeblendet: {} };
    ['gelesen', 'ausgeblendet'].forEach(function (f) {
      var k = r[f];
      if (k && typeof k === 'object' && !Array.isArray(k)) Object.keys(k).forEach(function (id) { st[f][id] = k[id]; });
    });
    return st;
  }
  /* Schlüssel älter als 41 Tage fliegen raus — die Nachricht dahinter hat die TTL (40 Tage) schon geräumt.
     Werte, die keine Zahl sind (alter Stand „true“), bekommen jetzt die Zeit (laufen dann normal ab).
     SONDERFALL crumble_willkommen: bleibt immer (Beispiel-Nachricht, kein Dokument; A6). */
  function statusRaeumen(st, jetzt) {
    var grenze = jetzt - GRENZEN.STATUS_TAGE * TAG_MS;
    var r = statusNormal(st);
    ['gelesen', 'ausgeblendet'].forEach(function (f) {
      Object.keys(r[f]).forEach(function (id) {
        if (id === CRUMBLE) return;
        var w = r[f][id];
        if (typeof w !== 'number' || !isFinite(w)) { r[f][id] = jetzt; return; }
        if (w < grenze) delete r[f][id];
      });
    });
    return r;
  }
  /* aenderung = { gelesen: [ids], ausgeblendet: [ids], einblenden: [ids] } → neues Status-Objekt (rein). */
  function statusMit(st, aenderung, jetzt) {
    var r = statusNormal(st), a = aenderung || {};
    (a.gelesen || []).forEach(function (id) { if (id && !hatFeld(r.gelesen, id)) r.gelesen[id] = jetzt; });
    (a.ausgeblendet || []).forEach(function (id) { if (id && !hatFeld(r.ausgeblendet, id)) r.ausgeblendet[id] = jetzt; });
    (a.einblenden || []).forEach(function (id) { delete r.ausgeblendet[id]; });
    return statusRaeumen(r, jetzt);
  }
  function statusAendertEtwas(st, aenderung) {
    var r = statusNormal(st), a = aenderung || {};
    return (a.gelesen || []).some(function (id) { return id && !hatFeld(r.gelesen, id); }) ||
      (a.ausgeblendet || []).some(function (id) { return id && !hatFeld(r.ausgeblendet, id); }) ||
      (a.einblenden || []).some(function (id) { return hatFeld(r.ausgeblendet, id); });
  }

  /* ---------- Dokumente bauen (genau die Feldlisten von RK §29) ---------- */
  function nachrichtDokument(e, ich, srv) {
    var d = { von: ich.kennung, vonName: sauber(ich.name, GRENZEN.NAME) || ich.kennung, typ: e.typ, empfaenger: einmal(e.empfaenger).slice(),
              text: text(e.text), erstellt: srv, fristStart: srv, daumen: [] };
    if (e.ersetzt) d.ersetzt = e.ersetzt;
    return d;
  }
  function bekanntmachungDokument(e, ich, srv) {
    var d = { von: ich.kennung, vonName: sauber(ich.name, GRENZEN.NAME) || ich.kennung, typ: 'bekanntmachung', text: text(e.text), erstellt: srv, giltBis: e.giltBis };
    if (e.ersetzt) d.ersetzt = e.ersetzt;
    return d;
  }
  function dokumentFuer(e, ich, srv) { return e.typ === 'bekanntmachung' ? bekanntmachungDokument(e, ich, srv) : nachrichtDokument(e, ich, srv); }
  function antwortDokument(e, ich, srv) {
    return { von: ich.kennung, vonName: sauber(ich.name, GRENZEN.NAME) || ich.kennung, an: e.an, text: text(e.text), ts: srv, fristStart: srv };
  }
  /* Daumen: genau ein Element Unterschied (Regel nzDaumenDazu/nzDaumenWeg). */
  function daumenNeu(alt, kennung) {
    var a = (alt || []).slice();
    var i = a.indexOf(kennung);
    if (i === -1) { a.push(kennung); return { daumen: a, dazu: true }; }
    a.splice(i, 1);
    return { daumen: a, dazu: false };
  }

  /* ---------- Entwurf prüfen (vor dem Senden; die Regel prüft hart) ---------- */
  /* Leitungsliste für Kritik ohne Bekanntmachungs-Haken (E30, T6): die Liste ohne mich selbst. */
  function leitungFuer(leitung, kennung) { return einmal((leitung || []).filter(function (k) { return k !== kennung; })); }
  function kritikGesperrt(z, typ) { return typ === 'kritik' && !z.bekanntmachung; }
  /* Gibt eine Liste von Fehlerschlüsseln zurück (leer = sendbar). leitung = nachrichten_vorlagen/leitung.kennungen. */
  function pruefeEntwurf(e, z, leitung, tag) {
    var f = [];
    if (!z || !z.schreiben) f.push('kein_haken');
    if (TYPEN.indexOf(e.typ) === -1) f.push('typ');
    if (e.typ === 'bekanntmachung' && !(z && z.bekanntmachung)) f.push('kein_haken_aushang');
    var t = text(e.text);
    if (!t.trim()) f.push('text_leer');
    if (t.length > GRENZEN.TEXT) f.push('text_lang');
    if (e.typ === 'bekanntmachung') {
      if (!istTag(e.giltBis)) f.push('giltbis_form');
      else if (e.giltBis < (tag || Z.heute())) f.push('giltbis_vorbei');
    } else {
      var emp = einmal(e.empfaenger);
      if (!emp.length) f.push('empfaenger_leer');
      if (emp.length > GRENZEN.EMPFAENGER) f.push('empfaenger_viele');
      if (emp.indexOf(z && z.kennung) !== -1 && !e.ersetzt) f.push('ich_empfaenger');
      if (kritikGesperrt(z || {}, e.typ)) {
        var l = leitung || [];
        if (!l.length) f.push('leitung_leer');
        else if (!emp.every(function (k) { return l.indexOf(k) !== -1; })) f.push('kritik_nicht_leitung');
      }
    }
    return f;
  }
  function pruefeAntwort(e, kopf, z) {
    var f = [], t = text(e.text);
    if (!t.trim()) f.push('text_leer');
    if (t.length > GRENZEN.ANTWORT) f.push('text_lang');
    if (!kopf || kopf.typ === 'bekanntmachung') f.push('aushang');
    else if (Z.gesperrt(kopf)) f.push('gesperrt');
    if (!z || !z.empfaenger) f.push('kein_empfaenger');
    if (!e.an || e.an === (z && z.kennung)) f.push('an');
    else if (kopf && kopf.von === (z && z.kennung)) { if ((kopf.empfaenger || []).indexOf(e.an) === -1) f.push('an'); }
    else if (kopf && e.an !== kopf.von) f.push('an');
    return f;
  }

  /* ---------- Rechte in der geöffneten Nachricht ---------- */
  function rechte(m, z) {
    var ich = z.kennung, aushang = m.typ === 'bekanntmachung', gesp = Z.gesperrt(m);
    var binEmpf = !aushang && (m.empfaenger || []).indexOf(ich) !== -1;
    var binAbs = m.von === ich;
    return {
      daumen: z.empfaenger && binEmpf && !binAbs && !gesp,                         // K-a: nicht beim Absender
      antworten: z.empfaenger && !aushang && !gesp && (binAbs ? (m.empfaenger || []).some(function (k) { return k !== ich; }) : binEmpf),
      antwortAnFest: binAbs ? null : m.von,
      korrektur: binAbs && !gesp && z.schreiben && (!aushang || z.bekanntmachung),
      ausblenden: !aushang,
      kenneIch: aushang,
      drucken: aushang,
      abnehmen: aushang && !hatFeld(m, 'fristStart') && (binAbs || z.istPlanung),
      binAbsender: binAbs, binEmpfaenger: binEmpf
    };
  }

  /* ---------- Sichten (rein) ---------- */
  /* Baut aus einer Liste die Einträge oben: gesperrte, deren Nachfolger IN DIESER Liste ist, hängen nur
     als Kette unter ihm (E16). Gesperrte ohne Nachfolger hier → sichtbar mit Hinweis (Anweisung §2.3). */
  function obenUndKette(l) {
    var nachId = {};
    l.forEach(function (m) { nachId[m.id] = m; });
    var oben = [];
    l.forEach(function (m) {
      if (Z.gesperrt(m) && nachId[m.ersetztDurch]) return;
      oben.push({ m: m, nachfolgerFehlt: Z.gesperrt(m) });
    });
    return { oben: oben, nachId: nachId };
  }
  function ungelesen(m, st, ich) { return m.von !== ich && !hatFeld(st.gelesen, m.id); }
  /* Postfach: L1 (+ Crumble getrennt in der Ansicht). opt.zeigeAusgeblendete. */
  function postfachSicht(l1, status, ich, opt) {
    var st = statusNormal(status), o = opt || {};
    var b = obenUndKette((l1 || []).filter(function (m) { return m.typ !== 'bekanntmachung'; }).sort(nachZeit('erstellt', true)));
    return b.oben.filter(function (e) { return o.zeigeAusgeblendete || !hatFeld(st.ausgeblendet, e.m.id); }).map(function (e) {
      return { m: e.m, neu: ungelesen(e.m, st, ich) && !Z.gesperrt(e.m), ausgeblendet: hatFeld(st.ausgeblendet, e.m.id), nachfolgerFehlt: e.nachfolgerFehlt };
    });
  }
  /* Aushänge: hängend (kein fristStart, giltBis ≥ heute); abgelaufene nur für Verfasser/Planung. Aushänge sind
     nicht ausblendbar (Anweisung §3.5). Ein korrigierter Aushang, dessen alte Fassung noch nicht abgenommen ist
     (zweiter Schritt gescheitert), hängt als Kette unter der neuen. */
  function aushaengeSicht(l2, status, z, tag) {
    var st = statusNormal(status);
    var l = (l2 || []).filter(function (m) { return m.typ === 'bekanntmachung' && !hatFeld(m, 'fristStart'); }).sort(nachZeit('erstellt', true));
    var b = obenUndKette(l);
    var r = [];
    b.oben.forEach(function (e) {
      var m = e.m;
      var abgelaufen = !(typeof m.giltBis === 'string' && m.giltBis >= tag);
      if (abgelaufen && !(m.von === z.kennung || z.istPlanung)) return;
      r.push({ m: m, neu: !abgelaufen && ungelesen(m, st, z.kennung) && !Z.gesperrt(m), abgelaufen: abgelaufen, nachfolgerFehlt: e.nachfolgerFehlt });
    });
    return r;
  }
  /* Gesendet: L3. Antworten je Nachricht (aus dem Zähl-Laden, höchstens 20) für die Zahl und „neue Antwort“.
     Eine ausgeblendete Nachricht mit NEUER Antwort an mich erscheint trotzdem (sonst zählte die Kachel etwas,
     das niemand findet). */
  function gesendetSicht(l3, status, ich, antwortenJe, opt) {
    var st = statusNormal(status), o = opt || {}, aj = antwortenJe || {};
    var b = obenUndKette((l3 || []).slice().sort(nachZeit('erstellt', true)));
    var r = [];
    b.oben.forEach(function (e) {
      var a = aj[e.m.id];
      var neuAntw = a ? a.filter(function (x) { return x.an === ich && x.von !== ich && !hatFeld(st.gelesen, x.id); }).length : 0;
      var aus = hatFeld(st.ausgeblendet, e.m.id);
      if (aus && !o.zeigeAusgeblendete && !neuAntw) return;
      r.push({ m: e.m, antworten: a ? a.length : null, neueAntworten: neuAntw, ausgeblendet: aus, nachfolgerFehlt: e.nachfolgerFehlt });
    });
    return r;
  }
  /* Kette rückwärts über ersetzt, so weit bekannt: { glieder: [m …] (neueste zuerst, ohne den Kopf), fehlt: id | null }. */
  function kette(kopf, bekannt) {
    var glieder = [], cur = kopf, n = 0, gesehen = {};
    while (cur && cur.ersetzt && n < GRENZEN.KETTE) {
      if (gesehen[cur.ersetzt]) break;
      gesehen[cur.ersetzt] = true;
      var alt = bekannt[cur.ersetzt];
      if (!alt) return { glieder: glieder, fehlt: cur.ersetzt };
      glieder.push(alt); cur = alt; n++;
    }
    return { glieder: glieder, fehlt: null };
  }
  /* Antworten zusammenführen (Empfänger: zwei Abfragen), doppelte raus, nach ts aufsteigend. */
  function antwortenZusammen(a, b) {
    var s = {}, r = [];
    (a || []).concat(b || []).forEach(function (x) { if (x && x.id && !s[x.id]) { s[x.id] = true; r.push(x); } });
    return r.sort(nachZeit('ts', false));
  }
  function vorlagenSortiert(l6) {
    return (l6 || []).slice().sort(function (a, b) {
      var x = typeof a.reihenfolge === 'number' ? a.reihenfolge : 999, y = typeof b.reihenfolge === 'number' ? b.reihenfolge : 999;
      return x !== y ? x - y : text(a.name).localeCompare(text(b.name), 'de');
    });
  }
  /* Kachel-Zahl aus den Listen der Seite — dieselbe Regel wie im Launcher (Z.zaehle). */
  function zahlAus(d) {
    var an = [];
    Object.keys(d.antwortenJe || {}).forEach(function (id) { an = an.concat(Z.antwortenAnMich(d.antwortenJe[id], d.ich)); });
    return Z.zaehle({ ich: d.ich, postfach: d.postfach, aushaenge: d.aushaenge, antwortenAnMich: an, status: d.status, heute: d.heute });
  }

  /* ---------- Laden (L1–L7) ---------- */
  function N(db) { return datenbank(db).collection(SAMMLUNG.N); }
  function ladePostfach(db, ich) { return mitZeitlimit(N(db).where('empfaenger', 'array-contains', ich).orderBy('erstellt', 'desc').limit(GRENZEN.POSTFACH).get()).then(liste); }
  function ladeAushaenge(db) { return mitZeitlimit(N(db).where('typ', '==', 'bekanntmachung').orderBy('erstellt', 'desc').limit(GRENZEN.AUSHAENGE).get()).then(liste); }
  function ladeGesendet(db, ich) { return mitZeitlimit(N(db).where('von', '==', ich).orderBy('erstellt', 'desc').limit(GRENZEN.GESENDET).get()).then(liste); }
  function ladeStatus(db, ich) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.STATUS).doc(ich).get({ source: 'server' })).then(function (s) { return statusNormal(s.exists ? s.data() : null); });
  }
  function ladeAdressbuch(db) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.ADRESSBUCH).get()).then(function (snap) {
      var r = {}; snap.forEach(function (d) { r[d.id] = d.data() || {}; }); return r;
    });
  }
  function ladeVorlagen(db) { return mitZeitlimit(datenbank(db).collection(SAMMLUNG.VORLAGEN).get()).then(liste).then(vorlagenSortiert); }
  /* Antworten für die 20 neuesten gesendeten, nicht gesperrten (wie der Launcher; ohne Filter, Absender). */
  function ladeAntwortenGesendet(db, gesendet) {
    var l = (gesendet || []).filter(function (m) { return !Z.gesperrt(m) && m.typ !== 'bekanntmachung'; })
      .sort(nachZeit('erstellt', true)).slice(0, Z.ANTWORT_NACHRICHTEN);
    var je = {};
    return Promise.all(l.map(function (m) {
      return mitZeitlimit(N(db).doc(m.id).collection(SAMMLUNG.ANTWORTEN).get()).then(function (s) { je[m.id] = antwortenZusammen(liste(s)); });
    })).then(function () { return je; });
  }
  /* L7 — beim Öffnen. Absender: ohne Filter. Empfänger: zwei Abfragen; scheitert „an == ich“, NICHT stumm (A7):
     es kommt ein warnung-Objekt mit dem Fehler zurück, die Seite zeigt err.message und den Satz. */
  function ladeAntworten(db, kopf, ich) {
    var A = N(db).doc(kopf.id).collection(SAMMLUNG.ANTWORTEN);
    if (kopf.von === ich) return mitZeitlimit(A.get()).then(function (s) { return { liste: antwortenZusammen(liste(s)), warnung: null }; });
    var von = mitZeitlimit(A.where('von', '==', ich).get()).then(liste);
    var an = mitZeitlimit(A.where('an', '==', ich).get()).then(liste).then(function (l) { return { l: l, f: null }; }, function (err) { return { l: [], f: err }; });
    return Promise.all([von, an]).then(function (r) {
      return { liste: antwortenZusammen(r[0], r[1].l), warnung: r[1].f ? { art: 'antworten_an_mich', fehler: r[1].f } : null };
    });
  }
  /* Ein Glied der Kette, das in keiner Liste ist (Bauplan §1.5): da | zu | weg. ACHTUNG: Ein von der TTL gelöschtes
     Dokument lässt die Leseregel (nzLeser(resource.data), resource == null) scheitern — für Kollegen sind „ging nicht
     an mich“ und „schon gelöscht“ beide permission-denied, also 'zu'. 'weg' sieht nur der Generalschlüssel. */
  function ladeGlied(db, id) {
    return mitZeitlimit(N(db).doc(id).get({ source: 'server' })).then(function (s) {
      if (!s.exists) return { art: 'weg', id: id };
      var m = s.data() || {}; m.id = s.id; return { art: 'da', id: id, m: m };
    }, function (err) {
      if (err && err.code === 'permission-denied') return { art: 'zu', id: id };
      throw err;
    });
  }

  /* ---------- Schreiben ---------- */
  /* Status: vor JEDEM set frisch lesen (A6, Anweisung §3.3), mischen, räumen, ganzes Dokument setzen. */
  function statusSetzen(db, ich, aenderung) {
    var d = datenbank(db);
    return ladeStatus(d, ich).then(function (alt) {
      if (!statusAendertEtwas(alt, aenderung)) return { status: alt, geschrieben: false };
      var neu = statusMit(alt, aenderung, Date.now());
      return mitZeitlimit(d.collection(SAMMLUNG.STATUS).doc(ich).set({ gelesen: neu.gelesen, ausgeblendet: neu.ausgeblendet }))
        .then(function () { return { status: neu, geschrieben: true }; });
    });
  }
  function senden(db, entwurf, ich) {
    var ref = N(db).doc();
    var dok = dokumentFuer(entwurf, ich, serverZeit());
    return mitZeitlimit(ref.set(dok)).then(function () { return { id: ref.id, dokument: dok }; });
  }
  /* Korrektur = EIN Batch: neue Nachricht mit ersetzt + Sperre der alten (T5, Regel nzKorrektur/Weg 2).
     Aushang (B13): danach ZWEITER Schritt — alte abnehmen (fristStart). Scheitert er, kommt zweiterSchritt:
     'fehler' + der Fehler zurück; die Seite bietet „alten Aushang abnehmen“ an (wiederholt nur Schritt 2). */
  function korrektur(db, alt, entwurf, ich) {
    var d = datenbank(db), ref = N(d).doc();
    var e = {}; Object.keys(entwurf).forEach(function (k) { e[k] = entwurf[k]; });
    e.typ = alt.typ; e.ersetzt = alt.id;                 // Typ bleibt gleich (Regel)
    var dok = dokumentFuer(e, ich, serverZeit());
    var b = d.batch();
    b.set(ref, dok);
    b.update(N(d).doc(alt.id), { ersetztDurch: ref.id });
    return mitZeitlimit(b.commit()).then(function () {
      var erg = { id: ref.id, dokument: dok, zweiterSchritt: null, fehler: null };
      if (alt.typ !== 'bekanntmachung') return erg;
      return aushangAbnehmen(d, alt.id).then(function () { erg.zweiterSchritt = 'ok'; return erg; },
        function (err) { erg.zweiterSchritt = 'fehler'; erg.fehler = err; return erg; });
    });
  }
  function aushangAbnehmen(db, id) { return mitZeitlimit(N(db).doc(id).update({ fristStart: serverZeit() })); }
  /* Daumen: frischen Kopf lesen, genau ein Element Unterschied, update({ daumen }). */
  function daumen(db, id, kennung) {
    var ref = N(db).doc(id);
    return mitZeitlimit(ref.get({ source: 'server' })).then(function (s) {
      if (!s.exists) throw fehler('weg', 'Die Nachricht gibt es nicht mehr.');
      var m = s.data() || {};
      if (Z.gesperrt(m)) throw fehler('gesperrt', 'Die Nachricht ist korrigiert und gesperrt — kein Daumen mehr.');
      var n = daumenNeu(m.daumen, kennung);
      return mitZeitlimit(ref.update({ daumen: n.daumen })).then(function () { m.daumen = n.daumen; m.id = id; return { m: m, dazu: n.dazu }; });
    });
  }
  function antworten(db, kopfId, entwurf, ich) {
    var dok = antwortDokument(entwurf, ich, serverZeit());
    var ref = N(db).doc(kopfId).collection(SAMMLUNG.ANTWORTEN).doc();
    return mitZeitlimit(ref.set(dok)).then(function () { return { id: ref.id, dokument: dok }; });
  }

  /* ---------- Warum nein? (Checkliste §7a: Ursache unterscheiden) ---------- */
  function einordnen(err) {
    var code = (err && err.code) || '', orig = ((code ? code + ' — ' : '') + ((err && err.message) || String(err))).trim();
    if (code === 'permission-denied') return { art: 'keine_berechtigung', original: orig };
    if (code === 'failed-precondition') return { art: 'index', original: orig, meldung: 'Der Datenbank fehlt ein Index für diese Liste. Der Admin legt ihn über den Link in der Meldung an (einmal antippen, „Erstellen“, 2–5 Minuten warten, dann neu laden).' };
    if (code === 'unavailable' || code === 'zeitlimit' || code === 'deadline-exceeded') return { art: 'netz', original: orig, meldung: 'Keine Verbindung zur Datenbank (Netz?). Nichts verloren — gleich noch einmal versuchen.' };
    if (code === 'not-found' || code === 'weg') return { art: 'weg', original: orig, meldung: 'Die Nachricht gibt es nicht mehr (nach 40 Tagen gelöscht?).' };
    return { art: 'fehler', original: orig, meldung: '' };
  }
  /* erklaere(db, err, kontext) → Promise { art, meldung, original }. kontext.art: lesen | senden | korrektur |
     antwort | daumen | status | abnehmen; kontext.z = zugang beim Laden. Bei permission-denied erst den Regelstand,
     dann das Konto FRISCH (ein inzwischen entzogener Haken soll die Erklärung sein, nicht der alte Stand). */
  function erklaere(db, err, k) {
    var e = einordnen(err);
    function g(art, meldung) { return { art: art, meldung: meldung, original: e.original }; }
    if (e.art !== 'keine_berechtigung') return Promise.resolve(g(e.art, e.meldung || ''));
    var z = (k && k.z) || {};
    return pruefeRegelstand(db).then(function (rs) {
      if (rs.stand === 'alt') return { rs: rs };
      if (!z.kennung) return { rs: rs };
      return ladeKonto(db, z.kennung).then(function (konto) { return { rs: rs, z: zugang(konto, z.kennung) }; }, function () { return { rs: rs }; });
    }).then(function (x) {
      if (x.rs.stand === 'alt') return g('regel_alt', 'Die Firestore-Regeln sind älter als diese Seite. In der Firebase-Konsole ' + REGEL_DATEI + ' einsetzen (Fassung ' + REGEL_FASSUNG + '). Nichts gespeichert.');
      if (x.z) z = x.z;
      var a = k && k.art;
      if (z.zustand === 'gesperrt') return g('gesperrt', 'Dein Konto ist nicht (mehr) freigeschaltet. Nichts gespeichert.');
      if (a === 'senden' || a === 'korrektur') {
        if (!z.schreiben) return g('kein_haken', 'Neue Nachrichten anfangen darf, wer den Haken dafür hat — den setzt der Admin in der Kontenverwaltung. Antworten geht ohne Haken. Nichts gesendet.');
        if (k.typ === 'bekanntmachung' && !z.bekanntmachung) return g('kein_haken_aushang', 'Aushänge darf nur schreiben, wer den Haken „Bekanntmachungen“ hat. Nichts gesendet.');
        if (k.typ === 'kritik' && !z.bekanntmachung) return g('kritik', 'Kritik geht nur an die Leitung. Die Leitungsliste hat sich vielleicht gerade geändert — neu laden und noch einmal. Nichts gesendet.');
        if (a === 'korrektur') return g('korrektur', 'Die Korrektur wurde abgelehnt — vielleicht wurde die alte Nachricht inzwischen schon korrigiert. Neu laden. Nichts gesendet.');
        return g('abgelehnt', 'Die Datenbank hat die Nachricht abgelehnt. Nichts gesendet.');
      }
      if (a === 'antwort') return g('antwort', 'Die Datenbank hat die Antwort abgelehnt — vielleicht wurde die Nachricht gerade korrigiert (dann unter der neuen Fassung antworten). Nichts gesendet.');
      if (a === 'daumen') return g('daumen', 'Den Daumen geben nur Empfänger, nicht bei Aushängen und nicht bei korrigierten Nachrichten. Nichts gespeichert.');
      if (a === 'abnehmen') return g('abnehmen', 'Abnehmen dürfen der Verfasser, die Produktionsleitung und der Admin — oder der Aushang ist schon abgenommen. Neu laden.');
      if (a === 'status') return g('status', 'Dein Lese-Merker wurde abgelehnt. Nichts verloren, nur „neu“ bleibt stehen.');
      return g('abgelehnt', 'Die Datenbank hat das Lesen abgelehnt.');
    });
  }

  var api = {
    REGEL_FASSUNG: REGEL_FASSUNG, REGEL_DATEI: REGEL_DATEI, FASSUNGEN: FASSUNGEN, SAMMLUNG: SAMMLUNG, GRENZEN: GRENZEN, TYPEN: TYPEN, CRUMBLE: CRUMBLE,
    heute: Z.heute, ms: Z.ms, gesperrt: Z.gesperrt, haengt: Z.haengt, plusTage: plusTage, istTag: istTag, sauber: sauber,
    zugang: zugang, wer: wer, ladeKonto: ladeKonto, pruefeRegelstand: pruefeRegelstand,
    namenAus: namenAus, eigenerName: eigenerName,
    statusNormal: statusNormal, statusRaeumen: statusRaeumen, statusMit: statusMit, statusAendertEtwas: statusAendertEtwas,
    nachrichtDokument: nachrichtDokument, bekanntmachungDokument: bekanntmachungDokument, dokumentFuer: dokumentFuer,
    antwortDokument: antwortDokument, daumenNeu: daumenNeu,
    leitungFuer: leitungFuer, kritikGesperrt: kritikGesperrt, pruefeEntwurf: pruefeEntwurf, pruefeAntwort: pruefeAntwort, rechte: rechte,
    postfachSicht: postfachSicht, aushaengeSicht: aushaengeSicht, gesendetSicht: gesendetSicht, kette: kette,
    antwortenZusammen: antwortenZusammen, vorlagenSortiert: vorlagenSortiert, zahlAus: zahlAus,
    ladePostfach: ladePostfach, ladeAushaenge: ladeAushaenge, ladeGesendet: ladeGesendet, ladeStatus: ladeStatus,
    ladeAdressbuch: ladeAdressbuch, ladeVorlagen: ladeVorlagen, ladeAntwortenGesendet: ladeAntwortenGesendet,
    ladeAntworten: ladeAntworten, ladeGlied: ladeGlied,
    statusSetzen: statusSetzen, senden: senden, korrektur: korrektur, aushangAbnehmen: aushangAbnehmen, daumen: daumen, antworten: antworten,
    einordnen: einordnen, erklaere: erklaere, mitZeitlimit: mitZeitlimit
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_NACHRICHTEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
