/* ================================================================
   BäckereiOS · bos_meldungen.js — Meldungen, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_MELDUNGEN

   Einbindung NACH bos_firebase_config.js und bos_accounts.js (braucht
   window.db, window.BOS_AUTH_READY, window.BOS_ACCOUNTS), dann erst der
   seiteneigene Code:

     <script src="../bos_firebase_config.js"></script>
     <script src="../bos_accounts.js"></script>
     <script src="../bos_meldungen.js"></script>

   Zweck (Reparaturanfrage Stufe 1, Anweisung des Kontroll-Chats vom
   10.10.2026, Bauplan SESSION_2026-10-10_REPARATURANFRAGE_STUFE1_BAU.md):
   die EINE Stelle, die Meldungen anlegt, liest und weiterschaltet. Erster
   Nutzer ist die Reparaturanfrage (Kanal 'hausmeister'). Ein späterer
   Kanal (Lager) bekommt hier ein Wörterbuch und eigene Haken, keine
   zweite Speicherstelle. Bewusst KEINE Universalmaschine: gebaut ist nur,
   was der erste Kanal braucht.

   DATEN (Firestore, Regel RK §20):
     meldungen/{id}                Kopf: kanal, text, geraet, weiterarbeiten,
                                   von, vonName, erstellt, status,
                                   dringlichkeit, fenster, repariertAm,
                                   geaendertVon, geaendertAm, letzterEintrag
     meldungen/{id}/verlauf/{e}    angehängt, nie geändert, nie gelöscht:
                                   art 'nachricht' (text) oder
                                   art 'status' | 'fenster' | 'dringlichkeit'
                                   (vorher, nachher, grund)
   Jede Änderung am Kopf geht mit IHREM Verlaufseintrag in EINEM Batch;
   letzterEintrag im Kopf zeigt auf diesen Eintrag, die Regel prüft das
   (neuer Eintrag, richtige Art, vorher/nachher stimmen). Ohne Spur kein
   Statuswechsel.

   ARCHIV ist eine Ansicht, kein Feld: status 'repariert' und repariertAm
   älter als 7 Tage. Danach lässt die Regel nichts mehr zu.

   HAKEN (bos_accounts, je Konto, von Ulf gesetzt):
     reparaturLesen       Mitlesen & antworten
     reparaturMelden      zusätzlich neue Anfragen stellen
     reparaturBearbeiten  Hausmeister: Status, Fenster, Dringlichkeit
   Melden und Bearbeiten schließen Mitlesen ein (KC, 10.10.2026).

   STATUS-SCHRITTE (Ulf/KC, 10.10.2026):
     gemeldet → gesehen · gemeldet → repariert (ein Tipp, Ulf 09:09)
     gesehen → repariert · repariert → gesehen (nur bis zum Archivtag)
     sonst nichts; erneuter Defekt = neue Anfrage.
   Eine Nachricht des Hausmeisters auf eine rote Anfrage setzt sie im
   selben Batch auf „gesehen“ (Ulf, 08:52).

   FEHLER kommen als Error mit .art, .meldung (normale Sprache),
   .original („code — message“ der Datenbank) und ggf. .link:
     'nicht_geladen'      Firebase, bos_firebase_config.js oder diese Datei fehlt
     'nicht_angemeldet'   keine Sitzung
     'kein_netz'          unavailable
     'zeitlimit'          keine Antwort nach ZEITLIMIT_MS — kann noch ankommen
     'kontingent'         resource-exhausted
     'regel_alt'          abgelehnt, und die Regelstand-Probe sagt: Regel zu alt
     'kein_haken'         abgelehnt, und dem Konto fehlt der Haken
     'konflikt'           abgelehnt, weil jemand anderes inzwischen geändert hat
     'archiviert'         die Anfrage liegt inzwischen im Archiv
     'index_fehlt'        Firestore verlangt einen Index (.link zum Anlegen)
     'ungueltig'          Eingabe passt nicht (vor dem Senden geprüft)
     'keine_berechtigung' abgelehnt, Ursache nicht eindeutig
     'fehler'             alles andere
   Die Seite zeigt .meldung und .original sichtbar an (Ulfs Regel).

   Datum nie über toISOString() (UTC-Falle zwischen 0 und 2 Uhr).

   CHANGELOG
     2026-10-10 · 09:33 · v0.1 · Erstfassung (Reparaturanfrage Stufe 1)
   ================================================================ */
window.BOS_MELDUNGEN = (function () {
  'use strict';

  var ZEITLIMIT_MS = 15000;
  var ARCHIV_TAGE = 7;
  var TAG_MS = 24 * 60 * 60 * 1000;
  var SEITE = 20;
  var REGEL_FASSUNG = 'reparatur-2026-10-10';
  var REGEL_DATEI = 'firestore_regeln_2026-10-10_reparatur.rules';
  var GRENZEN = { text: 500, nachricht: 300, geraet: 60, name: 40, grund: 300 };
  var STATUS = ['gemeldet', 'gesehen', 'repariert'];
  var DRINGLICHKEIT = ['normal', 'dringend'];
  var WEITERARBEITEN = ['ja', 'eingeschraenkt', 'nein'];

  /* Beschriftung je Kanal. Der Status ist bei allen Kanälen gleich, nur die
     Wörter unterscheiden sich (Ulf, 10.10.2026, 07:45). */
  var WOERTERBUCH = {
    hausmeister: { gemeldet: 'gemeldet', gesehen: 'gesehen', repariert: 'repariert' }
  };
  var HAKEN = {
    hausmeister: { lesen: 'reparaturLesen', melden: 'reparaturMelden', bearbeiten: 'reparaturBearbeiten' }
  };

  /* ---------------- Fehler ---------------- */
  function fehler(art, meldung, original, extra) {
    var e = new Error(meldung);
    e.art = art;
    e.meldung = meldung;
    e.original = original ? (original.code ? original.code + ' — ' : '') + (original.message || String(original)) : '';
    if (original && original.code) e.code = original.code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  function indexLink(err) {
    var m = String((err && err.message) || '').match(/https:\/\/console\.firebase\.google\.com\/[^\s)"']+/);
    return m ? m[0] : null;
  }
  /* Ordnet eine Datenbank-Antwort ein — ohne Nachfragen beim Server. */
  function einordnen(err) {
    if (err && err.art) return err;
    var code = err && err.code;
    if (code === 'permission-denied') return fehler('keine_berechtigung', 'Die Datenbank hat abgelehnt.', err);
    if (code === 'unavailable') return fehler('kein_netz', 'Keine Verbindung zum Server (WLAN?).', err);
    if (code === 'deadline-exceeded') return fehler('zeitlimit', 'Der Server hat nicht rechtzeitig geantwortet.', err);
    if (code === 'resource-exhausted') return fehler('kontingent', 'Das Tageskontingent der Datenbank ist aufgebraucht — morgen geht es wieder.', err);
    if (code === 'unauthenticated') return fehler('nicht_angemeldet', 'Nicht angemeldet — bitte an der Tür anmelden.', err);
    if (code === 'failed-precondition' && /index/i.test(String(err && err.message))) {
      var link = indexLink(err);
      return fehler('index_fehlt', 'Die Datenbank braucht für diese Liste einmalig einen Index. ' +
        (link ? 'Den Link antippen, „Index erstellen“ wählen, ein paar Minuten warten, dann neu laden.' : 'Den Link aus der Meldung in der Firebase-Konsole öffnen.'), err, { link: link });
    }
    return fehler('fehler', 'Unerwarteter Fehler.', err);
  }

  function datenbank() {
    if (!window.firebase || !window.db) throw fehler('nicht_geladen', 'Firebase oder bos_firebase_config.js ist nicht geladen.');
    return window.db;
  }
  function serverZeit() { return firebase.firestore.FieldValue.serverTimestamp(); }

  function mitZeitlimit(versprechen) {
    var uhr;
    var zeit = new Promise(function (_, nein) {
      uhr = setTimeout(function () {
        nein(fehler('zeitlimit', 'Noch nicht beim Server angekommen (nach ' + Math.round(ZEITLIMIT_MS / 1000) +
          ' s). Vermutlich kein Netz. Die Änderung wird gesendet, sobald Netz da ist — Seite offen lassen und danach nachsehen.'));
      }, ZEITLIMIT_MS);
    });
    return Promise.race([versprechen, zeit]).then(function (w) { clearTimeout(uhr); return w; },
      function (e) { clearTimeout(uhr); throw e; });
  }

  /* ---------------- reine Rechnung (ohne Datenbank, testbar) ---------------- */
  function ms(ts) {
    if (ts === null || ts === undefined) return null;
    if (typeof ts === 'number') return ts;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
    return null;
  }
  /* Archivtag = repariertAm + 7 Tage. Die Regel rechnet mit der Serverzeit,
     die Seite mit der Gerätezeit — am Rand kann ein Knopf eine Minute zu
     lang stehen; die Regel lehnt dann ab und die Seite sagt „Archiv“. */
  function archivAb(kopf) {
    if (!kopf || kopf.status !== 'repariert') return null;
    var r = ms(kopf.repariertAm);
    return r === null ? null : r + ARCHIV_TAGE * TAG_MS;
  }
  function imArchiv(kopf, jetzt) {
    var a = archivAb(kopf);
    return a !== null && (jetzt === undefined ? Date.now() : ms(jetzt)) >= a;
  }
  /* Dieselben Schritte wie statusSchritt() in der Regel. */
  function erlaubterSchritt(vorher, nachher) {
    return (vorher === 'gemeldet' && nachher === 'gesehen')
      || ((vorher === 'gemeldet' || vorher === 'gesehen') && nachher === 'repariert')
      || (vorher === 'repariert' && nachher === 'gesehen');
  }
  function alterText(ts, jetzt) {
    var t = ms(ts);
    if (t === null) return 'gerade eben';
    var d = Math.max(0, (jetzt === undefined ? Date.now() : ms(jetzt)) - t);
    var min = Math.floor(d / 60000);
    if (min < 2) return 'gerade eben';
    if (min < 60) return 'seit ' + min + ' Min.';
    var std = Math.floor(min / 60);
    if (std < 24) return 'seit ' + std + ' Std.';
    var tage = Math.floor(std / 24);
    return tage === 1 ? 'seit 1 Tag' : 'seit ' + tage + ' Tagen';
  }
  var WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  /* 'JJJJ-MM-TT' → „Fr 16.10.“ — lokal gerechnet, nie über UTC. */
  function fensterText(datum) {
    if (!fensterGueltig(datum) || !datum) return '';
    var p = datum.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return WOCHENTAG[d.getDay()] + ' ' + zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.';
  }
  function fensterGueltig(datum) {
    if (datum === '') return true;
    if (typeof datum !== 'string' || !/^20[0-9]{2}-[01][0-9]-[0-3][0-9]$/.test(datum)) return false;
    var p = datum.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.getFullYear() === Number(p[0]) && d.getMonth() === Number(p[1]) - 1 && d.getDate() === Number(p[2]);
  }
  /* Heute als 'JJJJ-MM-TT' — lokal. */
  function heute(jetzt) {
    var d = jetzt === undefined ? new Date() : new Date(ms(jetzt));
    return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
  }
  function uhrText(ts) {
    var t = ms(ts);
    if (t === null) return 'gerade eben';
    var d = new Date(t);
    return WOCHENTAG[d.getDay()] + ' ' + zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '. ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  }
  /* rot zuerst, dann gelb, dann grün; darin die älteste oben (rot/gelb),
     bei grün die zuletzt reparierte oben. */
  function sortiere(liste) {
    var rang = { gemeldet: 0, gesehen: 1, repariert: 2 };
    return liste.slice().sort(function (a, b) {
      var r = (rang[a.status] === undefined ? 9 : rang[a.status]) - (rang[b.status] === undefined ? 9 : rang[b.status]);
      if (r) return r;
      if (a.status === 'repariert') return (ms(b.repariertAm) || 0) - (ms(a.repariertAm) || 0);
      return (ms(a.erstellt) || Date.now()) - (ms(b.erstellt) || Date.now());
    });
  }
  function sauber(text, max) {
    // Steuerzeichen raus, Ränder weg, Länge begrenzen (die Regel prüft die Länge ohnehin).
    return String(text === null || text === undefined ? '' : text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
  }
  function woerterbuch(kanal) {
    var w = WOERTERBUCH[kanal];
    if (!w) throw fehler('ungueltig', 'Unbekannter Kanal „' + kanal + '“.');
    return { gemeldet: w.gemeldet, gesehen: w.gesehen, repariert: w.repariert };
  }
  function rechteAus(haken, kanal) {
    var h = HAKEN[kanal || 'hausmeister'];
    haken = haken || {};
    var melden = haken[h.melden] === true;
    var bearbeiten = haken[h.bearbeiten] === true;
    return { lesen: melden || bearbeiten || haken[h.lesen] === true, melden: melden, bearbeiten: bearbeiten };
  }

  /* ---------------- wer bin ich? ---------------- */
  function profilAusGeraet() {
    try {
      var s = JSON.parse(localStorage.getItem('bos_launcher_state_v2') || 'null');
      if (!s || !s.activeProfileId) return null;
      return (s.localProfiles || []).filter(function (p) { return p.id === s.activeProfileId; })[0] || null;
    } catch (e) { return null; }
  }
  /* Name, wie ihn die Kollegen ohnehin sehen (Bauplan, Frage 2):
     Rufname → Beschreibung aus der Namensliste (über die eigene Person);
     Ort-Konto → Konto-Notiz (Ortsname); sonst die Kennung. NIE Ulfs
     Konto-Notiz bei einem Personen-Konto — die ist nicht für Kollegen. */
  function eigenerName(db, kennung, konto) {
    return db.collection('personen').where('bosKontoId', '==', kennung).limit(2).get().then(function (snap) {
      if (snap.size === 1) {
        var personId = snap.docs[0].id;
        return db.collection('namen').doc(personId).get().then(function (n) {
          var e = n.exists ? (n.data() || {}) : {};
          var name = sauber(e.rufname, GRENZEN.name) || sauber(e.beschreibung, GRENZEN.name);
          return name ? { name: name, quelle: e.rufname ? 'rufname' : 'beschreibung' } : { name: kennung, quelle: 'kennung', warnung: 'Für deine Person ' + personId + ' steht kein Name in der Namensliste — es erscheint deine Kennung.' };
        });
      }
      if (snap.size > 1) return { name: kennung, quelle: 'kennung', warnung: 'Mit deinem Konto sind mehrere Personen verknüpft — es erscheint deine Kennung. Ulf Bescheid geben.' };
      if (konto && konto.art === 'ort' && sauber(konto.name, GRENZEN.name)) return { name: sauber(konto.name, GRENZEN.name), quelle: 'ort' };
      return { name: kennung, quelle: 'kennung' };
    }).catch(function (err) {
      return { name: kennung, quelle: 'kennung', warnung: 'Name nicht lesbar, es erscheint deine Kennung (' + einordnen(err).original + ').' };
    });
  }

  var ichVersprechen = null;
  /* Einmal je Seite. Liest das eigene Konto FRISCH (die Knöpfe sollen den
     echten Stand zeigen), ohne Netz Rückfall auf das Profil im Gerät. */
  function ich(neu) {
    if (ichVersprechen && !neu) return ichVersprechen;
    ichVersprechen = (window.BOS_AUTH_READY || Promise.reject(fehler('nicht_geladen', 'bos_firebase_config.js ist nicht geladen.')))
      .then(function (nutzer) {
        if (!nutzer || !nutzer.email) throw fehler('nicht_angemeldet', 'Nicht angemeldet — bitte an der Tür anmelden.');
        var db = datenbank();
        var kennung = String(nutzer.email).split('@')[0].toLowerCase();
        var laden = window.BOS_ACCOUNTS ? window.BOS_ACCOUNTS.ladeKonto(db, kennung) : Promise.reject(fehler('nicht_geladen', 'bos_accounts.js ist nicht geladen.'));
        return laden.then(function (konto) {
          var frei = !!(konto && konto.freigeschaltet === true);
          var haken = frei ? konto : {};
          return eigenerName(db, kennung, konto).then(function (n) {
            return { kennung: kennung, name: n.name, nameQuelle: n.quelle, warnungen: n.warnung ? [n.warnung] : [],
                     freigeschaltet: frei, kontoDa: !!konto, rechte: rechteAus(haken), quelle: 'server' };
          });
        }, function (err) {
          var p = profilAusGeraet();
          var e = einordnen(err);
          // Ohne Netz kein Name aus der Namensliste — dann die Kennung, nie die Konto-Notiz.
          return { kennung: kennung, name: kennung, nameQuelle: 'kennung',
                   warnungen: ['Konto nicht frisch lesbar — es gilt der Stand auf diesem Gerät (' + e.original + ').'],
                   freigeschaltet: !!(p && p.freigeschaltet !== false), kontoDa: true,
                   rechte: rechteAus(p && p.kontoHaken), quelle: 'geraet', grund: e };
        });
      });
    return ichVersprechen;
  }

  /* ---------------- Regelstand-Probe (RK §13) ---------------- */
  function pruefeRegelstand() {
    return datenbank().collection('bos_regelstand').doc(REGEL_FASSUNG).get({ source: 'server' })
      .then(function () { return 'passt'; }, function (err) {
        return err && err.code === 'permission-denied' ? 'alt' : 'unbekannt';
      });
  }

  /* Warum hat die Datenbank „nein“ gesagt? Erst Regelstand, dann Haken,
     dann ob jemand anderes inzwischen geändert hat (Muster bos_produkte.js
     und Teigecke „Gegenlesen nach abgelehntem Speichern“). */
  function ursache(err, kopf, braucht) {
    var e = einordnen(err);
    if (e.art !== 'keine_berechtigung') return Promise.resolve(e);
    var db = datenbank();
    return pruefeRegelstand().then(function (stand) {
      if (stand === 'alt') {
        return fehler('regel_alt', 'Die Firestore-Regeln passen nicht zu dieser Seite (erwartet: Regelstand „' + REGEL_FASSUNG +
          '“). Bitte die Regeldatei ' + REGEL_DATEI + ' einsetzen.', err, { regelDatei: REGEL_DATEI });
      }
      return ich(true).then(function (i) {
        if (braucht && !i.rechte[braucht]) {
          var name = { lesen: 'Mitlesen & antworten', melden: 'Melden', bearbeiten: 'Bearbeiten' }[braucht];
          return fehler('kein_haken', 'Dafür fehlt dir der Haken „' + name + '“ (Reparaturanfrage) — Ulf fragen.', err);
        }
        if (!kopf || !kopf.id) return e;
        return db.collection('meldungen').doc(kopf.id).get({ source: 'server' }).then(function (snap) {
          var jetzt = snap.exists ? snap.data() : null;
          if (jetzt && imArchiv(jetzt)) return fehler('archiviert', 'Diese Anfrage liegt inzwischen im Archiv — dort ändert sich nichts mehr.', err);
          if (jetzt && jetzt.letzterEintrag !== kopf.letzterEintrag) {
            return fehler('konflikt', 'Inzwischen von ' + (jetzt.geaendertVon || 'jemand anderem') + ' geändert — die Anzeige ist jetzt aktuell, bitte noch einmal.', err);
          }
          return e;
        }, function () { return e; });
      });
    }).catch(function () { return e; });
  }

  /* ---------------- Lesen ---------------- */
  function mitId(snap) {
    var a = [];
    snap.forEach(function (d) { a.push(Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' }))); });
    return a;
  }
  function abo(abfrage, cb, fehlerCb) {
    return abfrage.onSnapshot({ includeMetadataChanges: true }, function (snap) {
      cb(mitId(snap), { ausCache: !!snap.metadata.fromCache, ausstehend: !!snap.metadata.hasPendingWrites });
    }, function (err) { if (fehlerCb) fehlerCb(einordnen(err)); });
  }
  function grenzeArchiv(jetzt) {
    return firebase.firestore.Timestamp.fromMillis((jetzt === undefined ? Date.now() : ms(jetzt)) - ARCHIV_TAGE * TAG_MS);
  }
  /* A — offen (rot und gelb), Live. Sortiert wird auf dem Gerät. */
  function offen(kanal, cb, fehlerCb) {
    woerterbuch(kanal);
    return abo(datenbank().collection('meldungen').where('kanal', '==', kanal)
      .where('status', 'in', ['gemeldet', 'gesehen']), cb, fehlerCb);
  }
  /* B — grüne Woche, Live. Index: kanal ↑, status ↑, repariertAm ↓. */
  function grueneWoche(kanal, cb, fehlerCb, jetzt) {
    woerterbuch(kanal);
    return abo(datenbank().collection('meldungen').where('kanal', '==', kanal)
      .where('status', '==', 'repariert').where('repariertAm', '>=', grenzeArchiv(jetzt))
      .orderBy('repariertAm', 'desc'), cb, fehlerCb);
  }
  /* C — Archiv, nur auf Knopfdruck, 20 je Seite. nach = letzter Eintrag der
     vorigen Seite (das Objekt aus .letzter), sonst von vorn. */
  function archivSeite(kanal, nach, jetzt) {
    woerterbuch(kanal);
    var q = datenbank().collection('meldungen').where('kanal', '==', kanal)
      .where('status', '==', 'repariert').where('repariertAm', '<', grenzeArchiv(jetzt))
      .orderBy('repariertAm', 'desc');
    if (nach) q = q.startAfter(nach);
    return q.limit(SEITE).get().then(function (snap) {
      return { liste: mitId(snap), letzter: snap.docs.length ? snap.docs[snap.docs.length - 1] : null, mehr: snap.docs.length === SEITE };
    }, function (err) { throw einordnen(err); });
  }
  function verlauf(id, cb, fehlerCb) {
    return abo(datenbank().collection('meldungen').doc(id).collection('verlauf').orderBy('ts'), cb, fehlerCb);
  }

  /* ---------------- Schreiben ---------------- */
  function pruefeText(text, max, wasFehlt) {
    var t = sauber(text, 100000);
    if (!t) throw fehler('ungueltig', wasFehlt);
    if (t.length > max) throw fehler('ungueltig', 'Zu lang: höchstens ' + max + ' Zeichen (jetzt ' + t.length + ').');
    return t;
  }

  function anlegen(eingabe) {
    return ich().then(function (i) {
      var kanal = eingabe.kanal;
      woerterbuch(kanal);
      if (!i.rechte.melden) throw fehler('kein_haken', 'Dafür fehlt dir der Haken „Melden“ (Reparaturanfrage) — Ulf fragen.');
      var text = pruefeText(eingabe.text, GRENZEN.text, 'Bitte schreiben, was kaputt ist.');
      if (WEITERARBEITEN.indexOf(eingabe.weiterarbeiten) === -1) throw fehler('ungueltig', 'Bitte antippen: Kann weitergearbeitet werden?');
      var geraet = sauber(eingabe.geraet, GRENZEN.geraet);
      var db = datenbank();
      var ref = db.collection('meldungen').doc();
      var kopf = {
        kanal: kanal, text: text, geraet: geraet, weiterarbeiten: eingabe.weiterarbeiten,
        von: i.kennung, vonName: sauber(i.name, GRENZEN.name), erstellt: serverZeit(),
        status: 'gemeldet', dringlichkeit: 'normal', fenster: '', repariertAm: null,
        geaendertVon: i.kennung, geaendertAm: serverZeit(), letzterEintrag: ''
      };
      return mitZeitlimit(ref.set(kopf)).then(function () { return ref.id; },
        function (err) { return ursache(err, null, 'melden').then(function (e) { throw e; }); });
    });
  }

  /* Baut Kopf-Änderung + Verlaufseintrag in einen vorhandenen Batch. */
  function aenderungInBatch(batch, i, kopf, art, nachher, grund) {
    var db = datenbank();
    var ref = db.collection('meldungen').doc(kopf.id);
    var eRef = ref.collection('verlauf').doc();
    var upd = {};
    upd[art] = nachher;
    upd.geaendertVon = i.kennung;
    upd.geaendertAm = serverZeit();
    upd.letzterEintrag = eRef.id;
    if (art === 'status') upd.repariertAm = nachher === 'repariert' ? serverZeit() : null;
    batch.update(ref, upd);
    batch.set(eRef, {
      art: art, von: i.kennung, vonName: sauber(i.name, GRENZEN.name), ts: serverZeit(),
      vorher: kopf[art] === undefined ? '' : kopf[art], nachher: nachher, grund: sauber(grund, GRENZEN.grund)
    });
    return eRef.id;
  }
  function bearbeitenVorab(i, kopf) {
    if (!i.rechte.bearbeiten) throw fehler('kein_haken', 'Dafür fehlt dir der Haken „Bearbeiten“ (Reparaturanfrage) — Ulf fragen.');
    if (!kopf || !kopf.id) throw fehler('ungueltig', 'Keine Anfrage gewählt.');
    if (imArchiv(kopf)) throw fehler('archiviert', 'Diese Anfrage liegt im Archiv — dort ändert sich nichts mehr.');
  }
  function senden(batch, kopf, braucht) {
    return mitZeitlimit(batch.commit()).catch(function (err) {
      return ursache(err, kopf, braucht).then(function (e) { throw e; });
    });
  }

  function status(kopf, neu, grund) {
    return ich().then(function (i) {
      bearbeitenVorab(i, kopf);
      if (STATUS.indexOf(neu) === -1) throw fehler('ungueltig', 'Unbekannter Status „' + neu + '“.');
      if (!erlaubterSchritt(kopf.status, neu)) throw fehler('ungueltig', 'Von „' + kopf.status + '“ nach „' + neu + '“ geht nicht.');
      var batch = datenbank().batch();
      aenderungInBatch(batch, i, kopf, 'status', neu, grund);
      return senden(batch, kopf, 'bearbeiten');
    });
  }
  function fenster(kopf, datum, grund) {
    return ich().then(function (i) {
      bearbeitenVorab(i, kopf);
      datum = datum || '';
      if (!fensterGueltig(datum)) throw fehler('ungueltig', 'Kein gültiges Datum.');
      if (datum === (kopf.fenster || '')) throw fehler('ungueltig', 'Das Fenster steht schon so.');
      // Verschieben verlangt einen Grund (die Regel nicht — Bedienung, kein Schloss).
      if (kopf.fenster && !sauber(grund, GRENZEN.grund)) throw fehler('ungueltig', 'Beim Verschieben bitte kurz den Grund nennen.');
      if (String(grund || '').trim().length > GRENZEN.grund) throw fehler('ungueltig', 'Grund zu lang: höchstens ' + GRENZEN.grund + ' Zeichen.');
      var batch = datenbank().batch();
      aenderungInBatch(batch, i, kopf, 'fenster', datum, grund);
      return senden(batch, kopf, 'bearbeiten');
    });
  }
  function dringlichkeit(kopf, stufe) {
    return ich().then(function (i) {
      bearbeitenVorab(i, kopf);
      if (DRINGLICHKEIT.indexOf(stufe) === -1) throw fehler('ungueltig', 'Unbekannte Dringlichkeit „' + stufe + '“.');
      if (stufe === kopf.dringlichkeit) throw fehler('ungueltig', 'Steht schon auf „' + stufe + '“.');
      var batch = datenbank().batch();
      aenderungInBatch(batch, i, kopf, 'dringlichkeit', stufe, '');
      return senden(batch, kopf, 'bearbeiten');
    });
  }
  /* Nachricht. Mit Bearbeiten-Haken auf einer roten Anfrage: im selben
     Batch auf „gesehen“ (Ulf, 08:52 — wer antwortet, hat gesehen).
     Rückgabe: { gesehenGesetzt: true|false }. */
  function nachricht(kopf, text) {
    return ich().then(function (i) {
      if (!i.rechte.lesen) throw fehler('kein_haken', 'Dafür fehlt dir ein Haken der Reparaturanfrage — Ulf fragen.');
      if (!kopf || !kopf.id) throw fehler('ungueltig', 'Keine Anfrage gewählt.');
      if (imArchiv(kopf)) throw fehler('archiviert', 'Diese Anfrage liegt im Archiv — der Chat ist zu.');
      var t = pruefeText(text, GRENZEN.nachricht, 'Die Nachricht ist leer.');
      var db = datenbank();
      var batch = db.batch();
      var gesehen = i.rechte.bearbeiten && kopf.status === 'gemeldet';
      if (gesehen) aenderungInBatch(batch, i, kopf, 'status', 'gesehen', 'Antwort im Chat');
      batch.set(db.collection('meldungen').doc(kopf.id).collection('verlauf').doc(), {
        art: 'nachricht', von: i.kennung, vonName: sauber(i.name, GRENZEN.name), ts: serverZeit(), text: t
      });
      return senden(batch, kopf, 'lesen').then(function () { return { gesehenGesetzt: gesehen }; });
    });
  }

  return {
    REGEL_FASSUNG: REGEL_FASSUNG,
    REGEL_DATEI: REGEL_DATEI,
    GRENZEN: GRENZEN,
    ARCHIV_TAGE: ARCHIV_TAGE,
    woerterbuch: woerterbuch,
    ich: ich,
    pruefeRegelstand: pruefeRegelstand,
    offen: offen,
    grueneWoche: grueneWoche,
    archivSeite: archivSeite,
    verlauf: verlauf,
    anlegen: anlegen,
    status: status,
    fenster: fenster,
    dringlichkeit: dringlichkeit,
    nachricht: nachricht,
    // reine Rechnung (für die Seite und die Tests)
    rechteAus: rechteAus,
    erlaubterSchritt: erlaubterSchritt,
    imArchiv: imArchiv,
    archivAb: archivAb,
    alterText: alterText,
    fensterText: fensterText,
    fensterGueltig: fensterGueltig,
    heute: heute,
    uhrText: uhrText,
    sortiere: sortiere,
    sauber: sauber,
    einordnen: einordnen,
    ms: ms
  };
})();
