/* ==========================================================================
   MODUL: bos_nachrichten_zahl.js
   ZWECK: Die Zahl an der Kachel „Nachrichten“ (Nachrichtenzentrale Stufe 1c,
          Baustelle #131). EINE Zählregel für zwei Aufrufer:
          - der Launcher (eine Script-Zeile hinter bos_kachel_zahlen.js):
            zählt bei Start, alle 5 Minuten und beim Zurückkommen auf den
            Bildschirm (visibilitychange → sichtbar) und schreibt die Zahl
            an die Tafel (BOS_KACHEL_ZAHLEN.setze);
          - die Zentrale (nachrichtenzentrale/nachrichtenzentrale.html, im
            Fenster des Launchers): zählt nach jedem Lesen, Ausblenden und
            Senden aus den Listen, die sie ohnehin hat, und meldet sofort —
            so fällt die Zahl beim Lesen, ohne Launcher-Code.

   WARUM eine Datei für beide (Bauplan 1c §1.1, K-b, Go KC 07:54): Zwei
          Kopien einer Zählregel laufen auseinander. Hier steht sie einmal,
          als reine Funktion zaehle(), in Node geprüft.

   API (window.BOS_NACHRICHTEN_ZAHL, in Node module.exports)
     APP_ID, REFRESH_MS, ANTWORT_NACHRICHTEN (20), CRUMBLE ('crumble_willkommen')
     zaehle(d)        rein. d = { ich, postfach: [m], aushaenge: [m],
                      antwortenAnMich: [a], status: { gelesen, ausgeblendet },
                      heute: 'JJJJ-MM-TT' } → ganze Zahl ≥ 0 (Regel unten)
     istEmpfaenger(konto)   genau nzEmpfaenger() der Regel RK §29:
                      freigeschaltet und (art 'person' oder Haken nachrichtenEmpfangen)
     zustand(konto)   'ohne_konto' | 'gesperrt' | 'system' | 'station' | 'ohne_art' | 'voll'
     heute(datum?)    lokales Datum 'JJJJ-MM-TT' (nie toISOString — UTC, Checkliste §13)
     ms(zeit)         Firestore-Zeit/Date/Zahl → Millisekunden oder null
     gesperrt(m), haengt(m, heute), antwortenAnMich(liste, ich)
     lade(db, kennung) Promise { zahl, anfragen, antwortenJeNachricht, fehler }
                      — die Abfragen des Launchers (unten)
     melde(n)         Tafel im eigenen Fenster, sonst window.parent; try/catch
     starte()         Takt (nur im Launcher; siehe unten)
     neuLaden()       ein Takt jetzt (Promise), auch mit frischem Konto
     stand()          { zahl, anfragen, fehler, zuletzt, laeuft, kontoGelesen }

   DIE ZÄHLREGEL (Anweisung 1c §6.3, T9, U2)
     neue Nachrichten an mich: Postfach (L1) ohne gesperrte (ersetztDurch),
       ohne ausgeblendete, ohne gelesene, ohne eigene (Nachricht an mich
       selbst, Fall V)
     + hängende neue Aushänge (L2): ohne fristStart, giltBis ≥ heute, nicht
       gelesen, nicht eigene
     + neue Antworten an mich auf meinen gesendeten Nachrichten: unter den
       20 neuesten gesendeten (L3, nicht gesperrt) die Antworten mit
       an == ich, nicht gelesen.
     NICHT: Antworten, die ein Absender mir unter SEINER Nachricht schreibt
       (die Regel vom 27.10. hat keinen Sammelpfad für Antworten, B15/U2 —
       kommt mit Stufe 2); Daumen; die Beispiel-Nachricht von Crumble.

   ABFRAGEN JE TAKT (Launcher)
     L1 N.where('empfaenger','array-contains',ich).orderBy('erstellt','desc').limit(200)
     L2 N.where('typ','==','bekanntmachung').orderBy('erstellt','desc').limit(100)
     L3 N.where('von','==',ich).orderBy('erstellt','desc').limit(20)
     L4 nachrichten_status/<ich>
     je nicht gesperrter gesendeter Nachricht (≤ 20): N.doc(id).collection('antworten').get()
       OHNE Filter — als Absender beweist die Regel über nzKopf(id).von (Fall V
       V6f am echten System belegt, 27.10.); gefiltert wird hier auf an == ich.
       Grund statt where('an','==',ich): dieselbe Abfrage liefert der Zentrale
       auch die Antwort-Zahl je Karte (Bauplan 1c, Abweichung F24).
     = 4 bis 24 Anfragen. Dazu das eigene Konto (bos_accounts/<ich>) beim
       ersten Takt und nach jedem Zurückkommen (A3), sonst aus dem Speicher.

   TAKT (F-K5, T9): startet NUR, wenn window.BOS_KACHEL_ZAHLEN im EIGENEN
     Fenster liegt (= Launcher). Die Zentrale lädt diese Datei auch, hat aber
     keine Tafel im eigenen Fenster — dort startet nie ein Takt (K-b).
     Kein Live-Lauscher (Hausregel, bos_taskboard.js). Läuft schon ein Takt,
     wird kein zweiter gestartet.
     Nicht freigeschaltet, Station (Ort ohne Haken), Systemkonto, Konto ohne
     Art, kein Konto → setze(…, 0), KEINE Abfrage.
     Fehler: console.error + setze(…, 0) — die Kachel zeigt nie eine alte Zahl.

   ABHÄNGIGKEITEN (nur zur Laufzeit angefasst, nie beim Laden — im Launcher
     kommt bos_accounts.js erst nach dieser Datei): window.db,
     window.BOS_AUTH_READY (bos_firebase_config.js), window.BOS_ACCOUNTS
     (ladeKonto; Rückfall direktes get), window.BOS_KACHEL_ZAHLEN.

   CHANGELOG
     2026-10-27 · 08:03 · v1.0 · Feature (Nachrichtenzentrale Stufe 1c, #131;
       Bauplan 07:52, Go Kontroll-Chat 07:54 mit A1–A8). Neu.
       nachrichtenzentrale/_protokolle/SESSION_2026-10-27_NACHRICHTENZENTRALE_STUFE_1C_BAU.md
   ========================================================================== */
(function (global) {
  'use strict';

  var APP_ID = 'nachrichtenzentrale';
  var REFRESH_MS = 5 * 60 * 1000;          // wie bos_taskboard.js
  var ANTWORT_NACHRICHTEN = 20;            // L3 limit — so viele gesendete werden auf Antworten angesehen
  var CRUMBLE = 'crumble_willkommen';      // Sonderschlüssel im Status (Beispiel-Nachricht), zählt nie
  var ZEITLIMIT_MS = 12000;

  /* ---------------- rein ---------------- */
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function heute(datum) {
    var d = datum instanceof Date ? datum : new Date(typeof datum === 'number' ? datum : Date.now());
    return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
  }
  function ms(z) {
    if (z === null || z === undefined) return null;
    if (typeof z === 'number') return isFinite(z) ? z : null;
    if (z instanceof Date) return z.getTime();
    if (typeof z.toMillis === 'function') { try { return z.toMillis(); } catch (e) { return null; } }
    if (typeof z.seconds === 'number') return z.seconds * 1000 + Math.floor((z.nanoseconds || 0) / 1e6);
    if (typeof z.ms === 'number') return z.ms;
    return null;
  }
  function gesperrt(m) { return !!(m && Object.prototype.hasOwnProperty.call(m, 'ersetztDurch')); }
  function hat(karte, id) { return !!(karte && Object.prototype.hasOwnProperty.call(karte, id)); }
  function haengt(m, tag) {
    return !!m && m.typ === 'bekanntmachung' && !Object.prototype.hasOwnProperty.call(m, 'fristStart') &&
      typeof m.giltBis === 'string' && m.giltBis >= tag;
  }
  function istEmpfaenger(konto) {
    return !!konto && konto.freigeschaltet === true && (konto.art === 'person' || konto.nachrichtenEmpfangen === true);
  }
  function zustand(konto) {
    if (!konto) return 'ohne_konto';
    if (konto.freigeschaltet !== true) return 'gesperrt';
    if (konto.art === 'system') return 'system';
    if (istEmpfaenger(konto)) return 'voll';
    if (konto.art === 'ort') return 'station';
    return 'ohne_art';
  }
  function antwortenAnMich(liste, ich) {
    return (liste || []).filter(function (a) { return a && a.an === ich; });
  }
  function zaehle(d) {
    d = d || {};
    var ich = d.ich, st = d.status || {}, g = st.gelesen || {}, aus = st.ausgeblendet || {};
    var tag = d.heute || heute();
    var n = 0;
    (d.postfach || []).forEach(function (m) {
      if (!m || !m.id || m.id === CRUMBLE) return;
      if (m.von === ich || gesperrt(m) || hat(aus, m.id) || hat(g, m.id)) return;
      if (m.typ === 'bekanntmachung') return;             // gehört in L2, nie ins Postfach (Regel: ohne empfaenger)
      n++;
    });
    var gezaehlt = {};
    (d.aushaenge || []).forEach(function (m) {
      if (!m || !m.id || gezaehlt[m.id]) return;
      gezaehlt[m.id] = true;
      if (m.von === ich || gesperrt(m) || !haengt(m, tag) || hat(g, m.id)) return;
      n++;
    });
    (d.antwortenAnMich || []).forEach(function (a) {
      if (!a || !a.id || a.an !== ich || a.von === ich || hat(g, a.id)) return;
      n++;
    });
    return n;
  }

  /* ---------------- Datenbank ---------------- */
  function mitZeitlimit(p) {
    return new Promise(function (ja, nein) {
      var fertig = false;
      var uhr = setTimeout(function () { if (fertig) return; fertig = true; var e = new Error('Keine Antwort nach ' + (ZEITLIMIT_MS / 1000) + ' s'); e.code = 'zeitlimit'; nein(e); }, ZEITLIMIT_MS);
      Promise.resolve(p).then(function (x) { if (fertig) return; fertig = true; clearTimeout(uhr); ja(x); },
        function (e) { if (fertig) return; fertig = true; clearTimeout(uhr); nein(e); });
    });
  }
  function liste(snap) { var l = []; snap.forEach(function (d) { var x = d.data() || {}; x.id = d.id; l.push(x); }); return l; }

  /* Die Abfragen des Launchers. Wirft nie — Fehler stehen in .fehler. */
  function lade(db, ich) {
    var N = db.collection('nachrichten');
    var anfragen = 0;
    function zaehl(p) { anfragen++; return mitZeitlimit(p); }
    var erg = { zahl: 0, anfragen: 0, antwortenJeNachricht: {}, fehler: null };
    return Promise.all([
      zaehl(N.where('empfaenger', 'array-contains', ich).orderBy('erstellt', 'desc').limit(200).get()).then(liste),
      zaehl(N.where('typ', '==', 'bekanntmachung').orderBy('erstellt', 'desc').limit(100).get()).then(liste),
      zaehl(N.where('von', '==', ich).orderBy('erstellt', 'desc').limit(ANTWORT_NACHRICHTEN).get()).then(liste),
      zaehl(db.collection('nachrichten_status').doc(ich).get()).then(function (s) { return s.exists ? (s.data() || {}) : {}; })
    ]).then(function (r) {
      var gesendet = r[2].filter(function (m) { return !gesperrt(m) && m.typ !== 'bekanntmachung'; });
      return Promise.all(gesendet.map(function (m) {
        return zaehl(N.doc(m.id).collection('antworten').get()).then(function (s) {
          var a = liste(s); erg.antwortenJeNachricht[m.id] = a; return antwortenAnMich(a, ich);
        });
      })).then(function (je) {
        var alle = [].concat.apply([], je);
        erg.zahl = zaehle({ ich: ich, postfach: r[0], aushaenge: r[1], antwortenAnMich: alle, status: r[3], heute: heute() });
        erg.anfragen = anfragen;
        return erg;
      });
    }).catch(function (err) {
      erg.fehler = err; erg.anfragen = anfragen; erg.zahl = 0;
      return erg;
    });
  }

  /* ---------------- Tafel ---------------- */
  function tafelHier() {
    try { return global.BOS_KACHEL_ZAHLEN && typeof global.BOS_KACHEL_ZAHLEN.setze === 'function' ? global.BOS_KACHEL_ZAHLEN : null; } catch (e) { return null; }
  }
  function tafel() {
    var t = tafelHier();
    if (t) return t;
    try {
      var p = global.parent;
      if (p && p !== global && p.BOS_KACHEL_ZAHLEN && typeof p.BOS_KACHEL_ZAHLEN.setze === 'function') return p.BOS_KACHEL_ZAHLEN;
    } catch (e) { /* fremder Ursprung — nichts */ }
    return null;
  }
  function melde(n) {
    try { var t = tafel(); if (t) { t.setze(APP_ID, n); return true; } } catch (e) { /* still: Kachel ist nur Anzeige */ }
    return false;
  }

  /* ---------------- Takt (nur Launcher) ---------------- */
  var zust = { zahl: 0, anfragen: 0, fehler: null, zuletzt: null, laeuft: false, kontoGelesen: 0 };
  var konto = null, kennung = null, kontoFrisch = true, uhr = null, laufend = null;

  function ladeKonto(db, k) {
    zust.kontoGelesen++;
    if (global.BOS_ACCOUNTS && typeof global.BOS_ACCOUNTS.ladeKonto === 'function') return mitZeitlimit(global.BOS_ACCOUNTS.ladeKonto(db, k));
    return mitZeitlimit(db.collection('bos_accounts').doc(k).get()).then(function (s) { return s.exists ? s.data() : null; });
  }
  function takt() {
    if (laufend) return laufend;
    var bereit = global.BOS_AUTH_READY;
    if (!bereit || !global.db) return Promise.resolve(zust);
    zust.laeuft = true;
    laufend = Promise.resolve(bereit).then(function (nutzer) {
      if (!nutzer || !nutzer.email) { konto = null; return null; }
      var k = String(nutzer.email).split('@')[0].toLowerCase();
      if (k !== kennung) { kennung = k; kontoFrisch = true; }
      if (!kontoFrisch && konto !== undefined) return konto;
      return ladeKonto(global.db, kennung).then(function (kd) { konto = kd; kontoFrisch = false; return kd; });
    }).then(function (kd) {
      if (zustand(kd) !== 'voll') { zust.fehler = null; zust.zahl = 0; zust.anfragen = 0; melde(0); return; }
      return lade(global.db, kennung).then(function (e) {
        zust.anfragen = e.anfragen;
        if (e.fehler) {
          zust.fehler = e.fehler; zust.zahl = 0;
          console.error('[BOS_NACHRICHTEN_ZAHL] Zahl nicht lesbar — ' + ((e.fehler.code ? e.fehler.code + ' — ' : '') + (e.fehler.message || e.fehler)), e.fehler);
          melde(0); return;
        }
        zust.fehler = null; zust.zahl = e.zahl; melde(e.zahl);
      });
    }).catch(function (err) {
      zust.fehler = err; zust.zahl = 0; kontoFrisch = true;
      console.error('[BOS_NACHRICHTEN_ZAHL] Konto nicht lesbar — ' + ((err && err.code ? err.code + ' — ' : '') + (err && err.message || err)), err);
      melde(0);
    }).then(function () {
      zust.zuletzt = Date.now(); zust.laeuft = false; laufend = null; return stand();
    });
    return laufend;
  }
  function neuLaden(mitKonto) { if (mitKonto) kontoFrisch = true; return takt(); }
  function sichtbar() {
    try { if (global.document && global.document.visibilityState === 'visible') { kontoFrisch = true; takt(); } } catch (e) { /* nichts */ }
  }
  function starte() {
    if (!tafelHier() || uhr) return false;           // nur mit Tafel im EIGENEN Fenster (Launcher), nur einmal
    takt();
    uhr = setInterval(takt, REFRESH_MS);
    try { global.document.addEventListener('visibilitychange', sichtbar); } catch (e) { /* Node */ }
    return true;
  }
  function stand() { return { zahl: zust.zahl, anfragen: zust.anfragen, fehler: zust.fehler, zuletzt: zust.zuletzt, laeuft: zust.laeuft, kontoGelesen: zust.kontoGelesen, takt: !!uhr }; }

  var api = {
    APP_ID: APP_ID, REFRESH_MS: REFRESH_MS, ANTWORT_NACHRICHTEN: ANTWORT_NACHRICHTEN, CRUMBLE: CRUMBLE,
    zaehle: zaehle, istEmpfaenger: istEmpfaenger, zustand: zustand, heute: heute, ms: ms,
    gesperrt: gesperrt, haengt: haengt, antwortenAnMich: antwortenAnMich,
    lade: lade, melde: melde, starte: starte, neuLaden: neuLaden, stand: stand,
    _sichtbar: sichtbar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_NACHRICHTEN_ZAHL = api;

  /* Selbststart: nur im Launcher (Tafel im eigenen Fenster). Nach dem Laden
     des Dokuments, damit bos_accounts.js und die Registry da sind. */
  if (global.document && typeof global.document.addEventListener === 'function') {
    var los = function () { starte(); };
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', los);
    else setTimeout(los, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
