/* ================================================================
   BäckereiOS · Mitbringer — der Zettel „Mitbringliste“ (Zettel-Form von bos_druck.js v0.4)
   ================================================================
   Einbindung (nach bos_firebase_config.js, mitbringer_logik.js, bos_namen.js, bos_druck.js):
     <script src="../mitbringer/mitbringer_druck.js"></script>
   Lädt OHNE die Meldeseite — die Sammeldruck-Seite (#190) bindet genau diese
   drei Dateien ein und hat damit den Zettel „mitbringer“ in ihrer Liste.
   Stellt bereit: window.BOS_MITBRINGER_DRUCK { ID, datenStand, baue, drucke }
   und meldet den Zettel beim Laden an: BOS_DRUCK.zettel.anmelden({ id: 'mitbringer', … }).
   Doku: mitbringer/MITBRINGER_DOKU.md · Regel: RK §33

   datenStand()  liest nur, schreibt nie (der Sammeldruck ruft es zum Ausgrauen beliebig oft).
                 → { vorhanden, grund?, stand? }. Gründe: nicht angemeldet · Haken „Mitbringer
                 drucken“ fehlt · „Druck ab 05:00“ (vor der Frist) · echte Fehlermeldung.
                 Nach der Frist ist der Zettel immer „vorhanden“, auch ohne Meldungen
                 (Ulf 18.11.: leerer Zettel mit Leerzeilen zum Eintragen von Hand).
   baue()        prüft dasselbe noch einmal, liest den Tag frisch vom Server, baut die Optionen
                 und HÄLT ALS LETZTEN SCHRITT DEN DRUCK FEST (mitbringer_tage/<Tag>).

   ACHTUNG — bewusste Abweichung von „baue liefert nur Optionen“ (Kontroll-Chat 18.11., 01:31):
   baue() hält den Druck fest. Wer den Druckdialog abbricht, hat trotzdem einen Druck gezählt
   und druckt einfach noch einmal (zählt als Nachdruck). Grund: Auf Android lässt sich das Ende
   eines Drucks nicht verlässlich erkennen. Scheitert das Festhalten, wird NICHT gedruckt, mit Grund.
   Für den Sammeldruck (#190): baue() nur beim echten Drucken aufrufen, nie für eine Vorschau.

   Gedruckt wird immer der heutige Tag (Betriebszeit Europe/Berlin), sobald seine Frist vorbei ist.
   Kein Vorab-Druck. „gedruckt TT.MM., HH:MM“ ist die Uhr des Geräts; festgehalten wird die Serverzeit.

   2026-11-18 · 02:24 · v1 · Erstfassung (#183, Schritt 2 des Druck-Plans; Go Kontroll-Chat 01:31)
     mitbringer/_protokolle/SESSION_2026-11-18_MITBRINGER_BAU.md
   2026-11-18 · 05:45 · v2 · Ein Name überall (RK §34): baue() holt den Namen FRISCH über
     BOS_MITBRINGER.ichFrisch (BOS_NAMEN.ichSelbst) unmittelbar vor dem Festhalten — nie mehr das
     Altfeld bos_accounts.name. Ohne Person oder Namen wird nicht gedruckt, der Grund steht sichtbar da.
     Einbindung jetzt: … mitbringer_logik.js, bos_namen.js, bos_druck.js, mitbringer_druck.js (auch im
     Sammeldruck #190 — ohne bos_namen.js meldet baue() das mit Grund).
     _protokolle/SESSION_2026-11-18_NAMEN_RUFNAME_BAU.md
   ================================================================ */
(function (global) {
  'use strict';
  var ID = 'mitbringer', NAME = 'Mitbringliste';

  /* i18n (Checkliste §6): Gründe erscheinen im Sammeldruck und im Fehlerkasten. */
  var I18N_DE = {
    kein_modul: 'mitbringer_logik.js oder bos_druck.js (ab v0.4) ist nicht geladen.',
    kein_firebase: 'Die Datenbank ist nicht geladen (window.db / BOS_AUTH_READY fehlt).',
    nicht_angemeldet: 'Nicht angemeldet.',
    kein_konto: 'Dein Konto ist nicht freigeschaltet.',
    kein_haken: 'Dafür fehlt dir der Haken „Mitbringer drucken“ (Kontenverwaltung).',
    vor_frist: 'Druck ab {uhr} Uhr (Mitbringliste für {tag}).',
    nicht_pruefbar: 'Nicht prüfbar: {grund}',
    festhalten: 'Der Druck ließ sich nicht festhalten, darum wird nicht gedruckt: {grund}',
    kein_name: 'Nicht gedruckt — dein Name für den Zettel fehlt: {grund}'
  };
  function t(k, w) {
    var s = I18N_DE[k]; if (s === undefined) s = k;
    Object.keys(w || {}).forEach(function (x) { s = s.split('{' + x + '}').join(String(w[x])); });
    return s;
  }
  function roh(err) { return (err && err.code ? err.code + ' — ' : '') + ((err && err.message) || String(err)); }
  function fehler(code, text) { var e = new Error(text); e.code = code; return e; }

  /* Wer bin ich, was darf ich, wie steht der heutige Tag? Liest nur. Wirft mit lesbarem Grund. */
  function lage() {
    var L = global.BOS_MITBRINGER;
    if (!L) return Promise.reject(fehler('mitbringer/modul', t('kein_modul')));
    if (!global.db || !global.BOS_AUTH_READY) return Promise.reject(fehler('mitbringer/firebase', t('kein_firebase')));
    var db = global.db, a = {};
    return Promise.resolve(global.BOS_AUTH_READY).then(function (nutzer) {
      a.kennung = nutzer && nutzer.email ? nutzer.email.split('@')[0] : null;
      if (!a.kennung) throw fehler('mitbringer/anmeldung', t('nicht_angemeldet'));
      return L.ladeKonto(db, a.kennung);
    }).then(function (konto) {
      a.konto = konto; a.recht = L.rechte(konto);
      if (!a.recht.lesen) throw fehler('mitbringer/konto', t('kein_konto'));
      if (!a.recht.drucken) throw fehler('mitbringer/haken', t('kein_haken'));
      a.jetzt = Date.now();
      a.tag = L.tagVon(a.jetzt);
      return L.ladeTag(db, a.tag);
    }).then(function (r) {
      a.daten = r;
      a.frist = L.fristMs(a.tag, r.einst, r.tagDok);
      if (a.jetzt < a.frist) throw fehler('mitbringer/vor-frist', t('vor_frist', { uhr: L.uhr(a.frist), tag: L.tagKurz(a.tag) }));
      a.bild = L.tagesbild(a.tag, r.meldungen, r.tagDok, r.einst, a.jetzt);
      a.db = db; a.L = L;   /* der Name kommt erst in baue() — frisch (RK §34) */
      return a;
    });
  }
  var EIGENE = ['mitbringer/modul', 'mitbringer/firebase', 'mitbringer/anmeldung', 'mitbringer/konto', 'mitbringer/haken', 'mitbringer/vor-frist'];

  /* Ohne Nebenwirkung. Löst immer auf (nie abgewiesen): der Grund steht in grund. */
  function datenStand() {
    return lage().then(function (a) {
      var aus = { vorhanden: true, anzahl: a.bild.anzahlZettel, tag: a.tag };
      if (a.bild.neuesteMs !== null) aus.stand = new Date(a.bild.neuesteMs);
      return aus;
    }, function (err) {
      return { vorhanden: false, grund: EIGENE.indexOf(err && err.code) !== -1 ? err.message : t('nicht_pruefbar', { grund: roh(err) }) };
    });
  }

  /* Baut die Druck-Optionen für heute. LETZTER Schritt: Ausdruck-Stand festhalten (siehe Kopf). */
  function baue() {
    return lage().then(function (a) {
      return a.L.ichFrisch(a.db, a.kennung, a.konto).then(function (ctx) { a.ctx = ctx; return a; },
        function (err) { throw fehler((err && err.code) || 'mitbringer/name', t('kein_name', { grund: (err && err.message) || String(err) })); });
    }).then(function (a) {
      var L = a.L;
      var nr = (a.daten.tagDok ? a.daten.tagDok.drucke : 0) + 1;
      var optionen = L.druckOptionen(a.bild, { gedrucktMs: a.jetzt, druckNr: nr });
      return L.haltDruckFest(a.db, a.ctx, a.tag, a.frist).then(function (r) {
        /* Hat in derselben Sekunde noch jemand gedruckt, stimmt nur die Nummer nicht mehr: neu einsetzen. */
        return r.nr === nr ? optionen : L.druckOptionen(a.bild, { gedrucktMs: a.jetzt, druckNr: r.nr });
      }, function (err) { throw fehler((err && err.code) || 'mitbringer/festhalten', t('festhalten', { grund: roh(err) })); });
    });
  }

  function drucke() {
    var D = global.BOS_DRUCK;
    if (!D || !D.zettel) return Promise.reject(fehler('mitbringer/modul', t('kein_modul')));
    return D.zettel.drucke([ID]);
  }

  var api = { ID: ID, NAME: NAME, datenStand: datenStand, baue: baue, drucke: drucke, angemeldet: false, fehler: '' };
  try {
    var D = global.BOS_DRUCK;
    if (!D || !D.zettel || typeof D.zettel.anmelden !== 'function') throw new Error(t('kein_modul'));
    if (!D.zettel.liste().some(function (z) { return z.id === ID; })) D.zettel.anmelden({ id: ID, name: NAME, datenStand: datenStand, baue: baue });
    api.angemeldet = true;
  } catch (e) {
    api.fehler = (e && e.message) || String(e);
    console.error('[Mitbringer] Zettel-Anmeldung fehlgeschlagen', e);
  }
  global.BOS_MITBRINGER_DRUCK = api;
})(typeof window !== 'undefined' ? window : globalThis);
