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

   „NEU“ (Nachtrag 2, 11.10.2026, E23/E24): Die Seite merkt sich je Gerät,
   bis wann sie eine Anfrage gelesen hat (Gerätespeicher, Sache der Seite).
   Diese Datei liefert dazu nur Lesen und Rechnen, KEIN neues Feld:
     neuesterEintrag(id, cb, fehlerCb)  Live: der jüngste Verlaufseintrag
                          (orderBy ts desc, limit 1) — eine Rückfrage ändert
                          den Kopf nicht, deshalb reicht geaendertAm nicht.
                          Ein Eintrag, der noch zum Server unterwegs ist,
                          kommt mit ts = null.
     neuMarke(kopf, letzter, merk, kennung, standard)  reine Rechnung:
                          null oder { art: 'nachricht'|'sonst', ts }.

   FOTOS (Stufe 2, 12.10.2026, Bau-Doku SESSION_2026-10-11_REPARATURANFRAGE_STUFE2_BAU.md):
   Cloud Storage, Regeln speicher_regeln_2026-10-12_fotos.rules (RK, Abschnitt
   Speicher). Braucht firebase-storage-compat.js (lädt nur die Reparaturanfrage);
   fehlt es, gehen Fotos nicht, Text schon. KEIN neues Firestore-Feld:
     meldungen/<anfrageId>/<eintrag>~<kennung>~<n>.jpg    n = 1..3
       eintrag = 'anfrage' (Fotos der Meldung) oder Kennung des Verlaufseintrags
     meldungen/<anfrageId>/geloescht~<anzahl>~<JJJJ-MM-TT> leerer Vermerk
   Reihenfolge: Foto zuerst, Eintrag danach, mit vorab vergebener Kennung
   (neueAnfrageId/neueEintragId). Angezeigt wird ein Foto nur, wenn die
   Kennung im Namen der Absender des Eintrags ist (fotosFuer).
   Abruf NIE über Download-Adressen (getDownloadURL), sondern mit Anmeldung
   (fotoHolen: fetch mit ID-Token, die Regel prüft bei jedem Abruf; der
   Speicher braucht dafür einmal CORS).
   Verkleinern am Gerät: längste Kante 1600 (sonst 1280), JPEG ≤ 300 KB,
   Drehung aus den Kameradaten übernommen, Kameradaten und Standort weg.
   Fehlerarten zusätzlich:
     'speicher_fehlt'     Foto-Modul nicht geladen
     'speicher_aus'       Speicher nicht erreichbar / Bezahlkonto aus (402 …)
     'speicher_regel_alt' abgelehnt, und die Speicher-Regelstand-Probe sagt: alt
     'nicht_da'           Foto gibt es nicht (mehr)
     'abruf'              Abruf scheiterte im Browser (kein Netz oder CORS)
     'foto_lesen'         Foto lässt sich am Gerät nicht lesen/verkleinern
     'abgebrochen'        Hochladen vom Nutzer abgebrochen (verworfen)

   CHANGELOG
     2026-10-21 · 07:29 · Nur REGEL_DATEI: nennt jetzt die neueste Regeldatei firestore_regeln_2026-10-21_zugangsblatt.rules (Zugangsblatt-Schnellzugriffe, Freigabe KC 21.10., 06:47, Auflage N4). Die alte Angabe hätte bei „Regel zu alt“ eine veraltete Datei empfohlen; wer sie eingesetzt hätte, hätte neuere Regeln hinausgeworfen. Fassung (REGEL_FASSUNG) und Logik unverändert. SESSION_2026-10-21_ZUGANGSBLATT_QR_BAU.md
     2026-10-12 · 01:57 · v0.3 · Feature (Reparaturanfrage Stufe 2, Fotos)
       Fotos: verkleinern, neueAnfrageId/neueEintragId, fotoHochladen (mit
       Abbruch-Griff), fotosListen, fotosFuer, fotoHolen, fotosEinerAnfrage-
       Loeschen, archivFotosAufraeumen (Fenster 7 + 90 Tage, 1 Std.
       Uhr-Spielraum), pruefeSpeicherRegelstand, fotosVerfuegbar.
       anlegen()/nachricht() nehmen eine vorab vergebene Kennung (opt. id /
       eintragId) und prüfen bei Wiederholung zuerst Gerät, dann Server, ob
       der Eintrag schon geschrieben ist. Ohne Kennung unverändert.
       Firestore-Regel unverändert.
     2026-10-11 · 09:37 · v0.2 · Feature (Reparaturanfrage, Nachtrag 2)
       neuesterEintrag() und neuMarke() für die Markierung „neu“; verlauf()
       liefert je Eintrag ausstehend (true, solange er zum Server unterwegs
       ist); status() gibt { letzterEintrag } zurück (für „zurücknehmen“
       aus dem Posteingang ohne veralteten Kopf). Keine neuen Felder, keine
       Regeländerung.
     2026-10-10 · 09:33 · v0.1 · Erstfassung (Reparaturanfrage Stufe 1)
   ================================================================ */
window.BOS_MELDUNGEN = (function () {
  'use strict';

  var ZEITLIMIT_MS = 15000;
  var ARCHIV_TAGE = 7;
  var TAG_MS = 24 * 60 * 60 * 1000;
  var SEITE = 20;
  var REGEL_FASSUNG = 'reparatur-2026-10-10';
  var REGEL_DATEI = 'firestore_regeln_2026-10-21_zugangsblatt.rules';
  var GRENZEN = { text: 500, nachricht: 300, geraet: 60, name: 40, grund: 300 };
  var STATUS = ['gemeldet', 'gesehen', 'repariert'];
  var DRINGLICHKEIT = ['normal', 'dringend'];
  var WEITERARBEITEN = ['ja', 'eingeschraenkt', 'nein'];
  var KENNUNG_RE = /^[A-Za-z0-9]{1,40}$/;   // Dokument-Kennungen (Firestore vergibt 20 Zeichen)

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
  /* „Neu“ (Nachtrag 2, E24): gibt es etwas VON JEMAND ANDEREM, das jünger
     ist als der gemerkte Lesezeitpunkt? Kandidaten: die Anfrage selbst
     (neue fremde Anfrage), der jüngste Verlaufseintrag, und der zuletzt
     gemerkte fremde Eintrag (merk.f — bleibt stehen, wenn danach ein
     EIGENER Eintrag kam, z. B. „repariert“ aus dem Posteingang).
       merk     { g: gelesen bis (ms), f: fremd zuletzt (ms), fa: dessen Art } oder undefined
       standard Lesezeitpunkt, wenn merk.g fehlt
     Rückgabe null oder { art: 'nachricht'|'sonst', ts } — der jüngste
     fremde Kandidat bestimmt die Art. Eigene Einträge machen nie „neu“,
     Einträge ohne Serverzeit (unterwegs) auch nicht. */
  function neuMarke(kopf, letzter, merk, kennung, standard) {
    var g = (merk && typeof merk.g === 'number') ? merk.g : standard;
    if (typeof g !== 'number') return null;
    var kand = [];
    if (kopf && kopf.von && kopf.von !== kennung) {
      var e = ms(kopf.erstellt);
      if (e !== null && e > g) kand.push({ ts: e, art: 'anfrage' });
    }
    if (letzter && !letzter.ausstehend && letzter.von && letzter.von !== kennung) {
      var t = ms(letzter.ts);
      if (t !== null && t > g) kand.push({ ts: t, art: letzter.art });
    }
    if (merk && typeof merk.f === 'number' && merk.f > g) kand.push({ ts: merk.f, art: merk.fa || '' });
    if (!kand.length) return null;
    kand.sort(function (a, b) { return b.ts - a.ts; });
    return { art: kand[0].art === 'nachricht' ? 'nachricht' : 'sonst', ts: kand[0].ts };
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
    return datenbank().collection('meldungen').doc(id).collection('verlauf').orderBy('ts')
      .onSnapshot({ includeMetadataChanges: true }, function (snap) {
        var a = [];
        snap.forEach(function (d) {
          a.push(Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' }),
            { ausstehend: !!(d.metadata && d.metadata.hasPendingWrites) }));
        });
        cb(a, { ausCache: !!(snap.metadata && snap.metadata.fromCache), ausstehend: !!(snap.metadata && snap.metadata.hasPendingWrites) });
      }, function (err) { if (fehlerCb) fehlerCb(einordnen(err)); });
  }
  /* Nachtrag 2: der jüngste Verlaufseintrag einer Anfrage, live. Eine
     Einzelfeld-Sortierung braucht keinen eigenen Index; die Leseregel
     verlauf erlaubt es jedem mit Mitlesen-Haken. cb(eintrag|null).
     ts kommt OHNE Schätzung: Unterwegs ist ts = null (zählt nicht als neu). */
  function neuesterEintrag(id, cb, fehlerCb) {
    return datenbank().collection('meldungen').doc(id).collection('verlauf').orderBy('ts', 'desc').limit(1)
      .onSnapshot({ includeMetadataChanges: true }, function (snap) {
        var e = null;
        snap.forEach(function (d) {
          if (e) return;
          var x = d.data({ serverTimestamps: 'none' }) || {};
          var ausstehend = !!(d.metadata && d.metadata.hasPendingWrites);
          e = { id: d.id, art: x.art, von: x.von, ts: ausstehend ? null : (x.ts === undefined ? null : x.ts), ausstehend: ausstehend };
        });
        cb(e);
      }, function (err) { if (fehlerCb) fehlerCb(einordnen(err)); });
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
      if (eingabe.id !== undefined && !KENNUNG_RE.test(String(eingabe.id))) throw fehler('ungueltig', 'Ungültige Kennung der Anfrage.');
      var ref = eingabe.id ? db.collection('meldungen').doc(eingabe.id) : db.collection('meldungen').doc();
      var kopf = {
        kanal: kanal, text: text, geraet: geraet, weiterarbeiten: eingabe.weiterarbeiten,
        von: i.kennung, vonName: sauber(i.name, GRENZEN.name), erstellt: serverZeit(),
        status: 'gemeldet', dringlichkeit: 'normal', fenster: '', repariertAm: null,
        geaendertVon: i.kennung, geaendertAm: serverZeit(), letzterEintrag: ''
      };
      // Stufe 2: Wiederholung mit derselben Kennung (Fotos sind schon oben).
      // Ist die Anfrage doch angekommen, nicht noch einmal schreiben — ein
      // zweites set wäre beim Server eine Änderung, und die lehnt die Regel ab.
      var schon = eingabe.id && eingabe.wiederholung ? schonGeschrieben(ref, i.kennung) : Promise.resolve(false);
      return schon.then(function (da) {
        if (da) return ref.id;
        return mitZeitlimit(ref.set(kopf)).then(function () { return ref.id; },
          function (err) { return ursache(err, null, 'melden').then(function (e) { throw e; }); });
      });
    });
  }

  /* Stufe 2, Wiederholung mit derselben Kennung: Ist der Eintrag schon
     geschrieben? Erst auf dem Gerät — ein Schreibvorgang, der nach dem
     Zeitlimit noch zum Server unterwegs ist, steht dort schon (dann NICHT
     noch einmal schreiben, er kommt an) —, dann beim Server. Ist der Server
     nicht erreichbar: noch einmal schreiben. Doppelt wird es dadurch nie,
     die Kennung ist dieselbe; im ungünstigsten Fall lehnt die Regel das
     zweite Schreiben ab, und die Seite zeigt den Grund. */
  function schonGeschrieben(ref, kennung) {
    function vonMir(snap) { return !!(snap && snap.exists && (snap.data() || {}).von === kennung); }
    return ref.get({ source: 'cache' }).then(vonMir, function () { return false; }).then(function (geraet) {
      if (geraet) return true;
      return ref.get({ source: 'server' }).then(vonMir, function () { return false; });
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
      var eintrag = aenderungInBatch(batch, i, kopf, 'status', neu, grund);
      // Nachtrag 2: der neue letzterEintrag geht an die Seite zurück
      // („zurücknehmen“ aus dem Posteingang, bevor die Liste nachgezogen hat).
      return senden(batch, kopf, 'bearbeiten').then(function () { return { letzterEintrag: eintrag }; });
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
  /* Stufe 2: opt.eintragId = vorab vergebene Kennung (Fotos liegen schon
     darunter); opt.wiederholung = vorher prüfen, ob der Eintrag schon da ist. */
  function nachricht(kopf, text, opt) {
    opt = opt || {};
    return ich().then(function (i) {
      if (!i.rechte.lesen) throw fehler('kein_haken', 'Dafür fehlt dir ein Haken der Reparaturanfrage — Ulf fragen.');
      if (!kopf || !kopf.id) throw fehler('ungueltig', 'Keine Anfrage gewählt.');
      if (imArchiv(kopf)) throw fehler('archiviert', 'Diese Anfrage liegt im Archiv — der Chat ist zu.');
      var t = pruefeText(text, GRENZEN.nachricht, 'Die Nachricht ist leer.');
      if (opt.eintragId !== undefined && !KENNUNG_RE.test(String(opt.eintragId))) throw fehler('ungueltig', 'Ungültige Kennung des Eintrags.');
      var db = datenbank();
      var eRef = opt.eintragId ? db.collection('meldungen').doc(kopf.id).collection('verlauf').doc(opt.eintragId)
                               : db.collection('meldungen').doc(kopf.id).collection('verlauf').doc();
      var schon = opt.eintragId && opt.wiederholung ? schonGeschrieben(eRef, i.kennung) : Promise.resolve(false);
      return schon.then(function (da) {
        if (da) return { gesehenGesetzt: false, schonDa: true };
        var batch = db.batch();
        var gesehen = i.rechte.bearbeiten && kopf.status === 'gemeldet';
        if (gesehen) aenderungInBatch(batch, i, kopf, 'status', 'gesehen', 'Antwort im Chat');
        batch.set(eRef, {
          art: 'nachricht', von: i.kennung, vonName: sauber(i.name, GRENZEN.name), ts: serverZeit(), text: t
        });
        return senden(batch, kopf, 'lesen').then(function () { return { gesehenGesetzt: gesehen }; });
      });
    });
  }

  /* ================================================================
     FOTOS (Stufe 2)
     ================================================================ */
  var SPEICHER_FASSUNG = 'speicher-2026-10-12';
  var SPEICHER_DATEI = 'speicher_regeln_2026-10-12_fotos.rules';
  var FOTO = {
    max: 3,
    kanten: [1600, 1280],         // erst 1600 px, reicht das nicht: 1280 px
    ziel: 300 * 1024,             // Richtwert (Anweisung §4)
    qStart: 0.82, qMin: 0.5, qSchritt: 0.08,
    hochladenMs: 60000,           // je Foto, dann Abbruch mit Grund
    abrufMs: 30000,
    regelMax: 600 * 1024          // Grenze der Speicher-Regel
  };
  var AUFRAEUM_TAGE = 90;        // = Lebensdauer-Regel am Speicher (Ulf, 12.10.)
  var UHR_SPIELRAUM_MS = 60 * 60 * 1000;   // Aufräumen erst 1 Std. nach dem Archivtag (Geräteuhr vs. Serverzeit)
  var FOTO_RE = /^([A-Za-z0-9]{1,40})~([^~\/]{1,60})~([1-3])\.jpg$/;
  var VERMERK_RE = /^geloescht~([1-9][0-9]?)~(20[0-9]{2}-[01][0-9]-[0-3][0-9])$/;

  function speicher() {
    if (!window.firebase || typeof firebase.storage !== 'function') {
      throw fehler('speicher_fehlt', 'Das Foto-Modul ist nicht geladen (firebase-storage-compat.js) — Fotos gehen gerade nicht, Text schon. Seite neu laden; bleibt es, Ulf Bescheid geben.');
    }
    var sp = firebase.storage();
    if (!speicher.eingestellt) {
      speicher.eingestellt = true;
      // Ohne Netz nicht zwei Minuten still warten (Standard des SDK), sondern mit Grund aufhören.
      try { sp.setMaxOperationRetryTime(20000); sp.setMaxUploadRetryTime(FOTO.hochladenMs); } catch (e) { /* ältere Fassung */ }
    }
    return sp;
  }
  function fotosVerfuegbar() {
    try { speicher(); return { ok: true }; } catch (e) { return { ok: false, grund: e }; }
  }
  function neueAnfrageId() { return datenbank().collection('meldungen').doc().id; }
  function neueEintragId(anfrageId) { return datenbank().collection('meldungen').doc(anfrageId).collection('verlauf').doc().id; }

  /* Speicher-Antwort einordnen, ohne Nachfragen. */
  function speicherEinordnen(err) {
    if (err && err.art) return err;
    var code = String((err && err.code) || '');
    var status = err && typeof err.status === 'number' ? err.status : 0;
    var text = String((err && err.message) || '') + ' ' + String((err && err.customData && err.customData.serverResponse) || (err && err.serverResponse) || '');
    if (status === 402 || /\b402\b/.test(text) || code === 'storage/quota-exceeded' || code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
      return fehler('speicher_aus', 'Der Foto-Speicher ist nicht erreichbar oder das Bezahlkonto ist aus — Ulf Bescheid geben. Text geht weiter.', err);
    }
    if (code === 'storage/unauthorized') return fehler('keine_berechtigung', 'Der Foto-Speicher hat abgelehnt.', err);
    if (code === 'storage/unauthenticated') return fehler('nicht_angemeldet', 'Nicht angemeldet — bitte an der Tür anmelden.', err);
    if (code === 'storage/retry-limit-exceeded') return fehler('kein_netz', 'Keine Verbindung zum Foto-Speicher (WLAN?).', err);
    if (code === 'storage/object-not-found') return fehler('nicht_da', 'Das Foto gibt es nicht (mehr).', err);
    return fehler('fehler', 'Unerwarteter Fehler beim Foto-Speicher.', err);
  }
  /* Regelstand-Probe Speicher: Abfrage einer Datei, die es nicht gibt.
     404 = diese Regeln stehen ('passt'), 403 = alte Regeln ('alt').
     'fehlt' = Modul nicht geladen, 'aus' = Speicher/Bezahlkonto. */
  function pruefeSpeicherRegelstand() {
    var ref;
    try { ref = speicher().ref('bos_regelstand/' + SPEICHER_FASSUNG); } catch (e) { return Promise.resolve('fehlt'); }
    return ref.getMetadata().then(function () { return 'passt'; }, function (err) {
      var c = err && err.code;
      if (c === 'storage/object-not-found') return 'passt';
      if (c === 'storage/unauthorized') return 'alt';
      return speicherEinordnen(err).art === 'speicher_aus' ? 'aus' : 'unbekannt';
    });
  }
  /* Warum hat der Speicher „nein“ gesagt? Erst Regelstand, dann Haken. */
  function ursacheSpeicher(err, braucht) {
    var e = speicherEinordnen(err);
    if (e.art !== 'keine_berechtigung') return Promise.resolve(e);
    return pruefeSpeicherRegelstand().then(function (stand) {
      if (stand === 'alt') {
        return fehler('speicher_regel_alt', 'Die Speicher-Regeln passen nicht zu dieser Seite (erwartet: Regelstand „' + SPEICHER_FASSUNG +
          '“). Bitte die Regeldatei ' + SPEICHER_DATEI + ' im Storage einsetzen. Stehen sie schon: Speicher bzw. Bezahlkonto prüfen.', err, { regelDatei: SPEICHER_DATEI });
      }
      if (stand === 'aus') return fehler('speicher_aus', 'Der Foto-Speicher ist nicht erreichbar oder das Bezahlkonto ist aus — Ulf Bescheid geben. Text geht weiter.', err);
      return ich(true).then(function (i) {
        if (braucht && !i.rechte[braucht]) {
          var name = { lesen: 'Mitlesen & antworten', melden: 'Melden', bearbeiten: 'Bearbeiten' }[braucht];
          return fehler('kein_haken', 'Dafür fehlt dir der Haken „' + name + '“ (Reparaturanfrage) — Ulf fragen.', err);
        }
        return fehler('keine_berechtigung', 'Der Foto-Speicher hat abgelehnt. Mögliche Gründe: die Anfrage ist inzwischen im Archiv, das Foto gibt es schon, oder Speicher bzw. Bezahlkonto ist aus — sonst Ulf Bescheid geben.', err);
      });
    }).catch(function () { return e; });
  }

  /* ---------- Verkleinern am Gerät ----------
     Liest das Foto mit der Drehung aus den Kameradaten (Hochformat bleibt
     hoch), zeichnet es neu und speichert ein neues JPEG. Das neue JPEG
     enthält KEINE Kameradaten und KEINEN Standort (Beweis: Bau-Doku §2.6). */
  function bildLesen(datei) {
    return createImageBitmap(datei, { imageOrientation: 'from-image' }).catch(function (err) {
      // Ältere Browser kennen die Option nicht (TypeError) — Chrome dreht seit
      // Fassung 81 ohnehin nach den Kameradaten.
      if (err && err.name === 'TypeError') return createImageBitmap(datei);
      throw err;
    });
  }
  function zuBlob(c, q) {
    return new Promise(function (ja, nein) {
      c.toBlob(function (b) { if (b) ja(b); else nein(new Error('canvas.toBlob lieferte nichts')); }, 'image/jpeg', q);
    });
  }
  function verkleinern(datei) {
    return Promise.resolve().then(function () {
      if (!datei) throw fehler('ungueltig', 'Kein Foto gewählt.');
      if (datei.type && !/^image\//.test(datei.type)) throw fehler('ungueltig', 'Das ist kein Foto (' + datei.type + ').');
      if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
        throw fehler('foto_lesen', 'Dieses Gerät kann Fotos nicht verkleinern (createImageBitmap fehlt) — bitte ohne Foto senden.');
      }
      return bildLesen(datei).catch(function (err) {
        throw fehler('foto_lesen', 'Das Foto lässt sich nicht lesen (' + (datei.type || 'unbekannte Art') +
          '). Fotos im HEIC-Format (iPhone) gehen im Browser oft nicht — in den Kamera-Einstellungen „Maximale Kompatibilität“ wählen.', err);
      });
    }).then(function (bmp) {
      var versuche = [];
      function malen(quelle, b, h, kante) {
        var s = Math.min(1, kante / Math.max(b, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(b * s));
        c.height = Math.max(1, Math.round(h * s));
        var g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';   // Schilder und Risse bleiben lesbar
        g.drawImage(quelle, 0, 0, c.width, c.height);
        return c;
      }
      // Das volle Handyfoto (12–50 MP) nur EINMAL im Speicher: gleich auf
      // die größte Stufe zeichnen und freigeben; kleinere Stufen entstehen
      // aus dieser Zeichenfläche (alte Handys, Gegenprüfung 12.10.).
      var gross = malen(bmp, bmp.width, bmp.height, FOTO.kanten[0]);
      try { bmp.close(); } catch (e) { /* egal */ }
      function stufe(ki) {
        var c = ki === 0 ? gross : malen(gross, gross.width, gross.height, FOTO.kanten[ki]);
        function versuch(q) {
          return zuBlob(c, q).then(function (blob) {
            versuche.push({ kante: FOTO.kanten[ki], q: Math.round(q * 100) / 100, bytes: blob.size });
            if (blob.size <= FOTO.ziel) return { blob: blob, breite: c.width, hoehe: c.height, qualitaet: q };
            if (q - FOTO.qSchritt >= FOTO.qMin - 1e-9) return versuch(q - FOTO.qSchritt);
            if (ki + 1 < FOTO.kanten.length) return stufe(ki + 1);
            // Kleinste Stufe noch über dem Richtwert: nehmen, solange die Regel es erlaubt.
            if (blob.size <= FOTO.regelMax) return { blob: blob, breite: c.width, hoehe: c.height, qualitaet: q, ueberRichtwert: true };
            throw fehler('foto_lesen', 'Das Foto bleibt auch verkleinert zu groß (' + Math.round(blob.size / 1024) + ' KB).');
          });
        }
        return versuch(FOTO.qStart);
      }
      return stufe(0).then(function (r) {
        r.versuche = versuche; r.bytes = r.blob.size;
        return r;
      });
    });
  }

  function fotoName(eintrag, kennung, n) { return eintrag + '~' + kennung + '~' + n + '.jpg'; }
  function pfadPruefen(anfrageId, eintrag, n) {
    if (!KENNUNG_RE.test(String(anfrageId))) throw fehler('ungueltig', 'Ungültige Kennung der Anfrage.');
    if (!KENNUNG_RE.test(String(eintrag))) throw fehler('ungueltig', 'Ungültige Kennung des Eintrags.');
    if ([1, 2, 3].indexOf(n) === -1) throw fehler('ungueltig', 'Höchstens 3 Fotos je Eintrag.');
  }

  /* Ein Foto hochladen. eintrag = 'anfrage' oder Kennung des Verlaufseintrags.
     fortschritt(0..1) wahlweise. Je Foto Zeitlimit FOTO.hochladenMs.
     steuer (wahlweise): bekommt steuer.abbrechen() — die Seite bricht damit
     ab, wenn der Nutzer verwirft (Fehlerart 'abgebrochen'). */
  function fotoHochladen(anfrageId, eintrag, n, blob, fortschritt, steuer) {
    return ich().then(function (i) {
      pfadPruefen(anfrageId, eintrag, n);
      if (!/^[^~\/]{1,60}$/.test(i.kennung)) throw fehler('ungueltig', 'Deine Kennung passt nicht in einen Dateinamen — Ulf Bescheid geben.');
      if (!blob || !blob.size) throw fehler('ungueltig', 'Das Foto ist leer.');
      if (blob.size > FOTO.regelMax) throw fehler('ungueltig', 'Das Foto ist zu groß (' + Math.round(blob.size / 1024) + ' KB, höchstens ' + Math.round(FOTO.regelMax / 1024) + ' KB).');
      var sp = speicher();
      var pfad = 'meldungen/' + anfrageId + '/' + fotoName(eintrag, i.kennung, n);
      return new Promise(function (ja, nein) {
        var task = sp.ref(pfad).put(blob, { contentType: 'image/jpeg' });
        var abgebrochen = false, vomNutzer = false;
        var uhr = setTimeout(function () { abgebrochen = true; try { task.cancel(); } catch (e) { /* egal */ } }, FOTO.hochladenMs);
        if (steuer) steuer.abbrechen = function () { vomNutzer = true; clearTimeout(uhr); try { task.cancel(); } catch (e) { /* egal */ } };
        task.on('state_changed', function (s) {
          if (fortschritt && s && s.totalBytes) { try { fortschritt(s.bytesTransferred / s.totalBytes); } catch (e) { /* Anzeige */ } }
        }, function (err) {
          clearTimeout(uhr);
          if (vomNutzer) return nein(fehler('abgebrochen', 'Hochladen abgebrochen.', err));
          nein(abgebrochen ? fehler('zeitlimit', 'Foto ' + n + ' nach ' + Math.round(FOTO.hochladenMs / 1000) + ' s noch nicht oben — Netz zu langsam oder weg.', err) : err);
        }, function () { clearTimeout(uhr); ja(pfad); });
      }).catch(function (err) {
        return ursacheSpeicher(err, eintrag === 'anfrage' ? 'melden' : 'lesen').then(function (e) { throw e; });
      });
    });
  }

  /* Alle Dateien einer Anfrage, EINMAL aufgelistet. Rückgabe
     { fotos: [{ pfad, name, eintrag, kennung, n }], vermerk: { anzahl, datum } | null }. */
  function fotosAusNamen(namen, basis) {
    var fotos = [], vermerk = null;
    namen.forEach(function (name) {
      var m = FOTO_RE.exec(name);
      if (m) { fotos.push({ pfad: basis + '/' + name, name: name, eintrag: m[1], kennung: m[2], n: Number(m[3]) }); return; }
      var v = VERMERK_RE.exec(name);
      if (v && (!vermerk || v[2] > vermerk.datum)) vermerk = { anzahl: Number(v[1]), datum: v[2], name: name };
    });
    fotos.sort(function (a, b) { return a.eintrag < b.eintrag ? -1 : a.eintrag > b.eintrag ? 1 : a.n - b.n; });
    return { fotos: fotos, vermerk: vermerk };
  }
  function fotosListen(anfrageId) {
    return Promise.resolve().then(function () {
      if (!KENNUNG_RE.test(String(anfrageId))) throw fehler('ungueltig', 'Ungültige Kennung der Anfrage.');
      var basis = 'meldungen/' + anfrageId;
      return speicher().ref(basis).listAll().then(function (res) {
        return fotosAusNamen((res.items || []).map(function (r) { return r.name; }), basis);
      }, function (err) { return ursacheSpeicher(err, 'lesen').then(function (e) { throw e; }); });
    });
  }
  /* Anzeige-Filter (Bauplan §2.1): nur Fotos, deren Kennung im Namen der
     Absender des Eintrags ist. Ein Foto, das jemand in einen fremden Eintrag
     legt, erscheint nie. Höchstens eins je Nummer, höchstens drei. */
  function fotosFuer(liste, eintrag, von) {
    var gesehen = {};
    return (liste || []).filter(function (f) {
      if (f.eintrag !== eintrag || !von || f.kennung !== von || gesehen[f.n]) return false;
      gesehen[f.n] = true;
      return true;
    }).sort(function (a, b) { return a.n - b.n; }).slice(0, FOTO.max);
  }

  /* Foto mit Anmeldung holen — wie getBlob im modularen SDK. Die Regel
     prüft bei JEDEM Abruf. Braucht CORS am Speicher (Handgriff 6). */
  function kurzeAntwort(text) {
    try { var j = JSON.parse(text); if (j && j.error) return (j.error.code ? j.error.code + ' ' : '') + (j.error.message || ''); } catch (e) { /* kein JSON */ }
    return String(text || '').slice(0, 200);
  }
  function fotoHolen(pfad) {
    return Promise.resolve().then(function () {
      var sp = speicher();
      var nutzer = firebase.auth && firebase.auth().currentUser;
      if (!nutzer || typeof nutzer.getIdToken !== 'function') throw fehler('nicht_angemeldet', 'Nicht angemeldet — bitte an der Tür anmelden.');
      var bucket = sp.ref().bucket;
      return nutzer.getIdToken().then(function (token) {
        var url = 'https://firebasestorage.googleapis.com/v0/b/' + encodeURIComponent(bucket) + '/o/' + encodeURIComponent(pfad) + '?alt=media';
        var steuer = typeof AbortController === 'function' ? new AbortController() : null;
        var uhr = setTimeout(function () { if (steuer) steuer.abort(); }, FOTO.abrufMs);
        return fetch(url, { headers: { Authorization: 'Firebase ' + token }, signal: steuer ? steuer.signal : undefined, credentials: 'omit' })
          .then(function (antwort) {
            clearTimeout(uhr);
            if (antwort.ok) return antwort.blob();
            return antwort.text().catch(function () { return ''; }).then(function (text) {
              var original = { code: 'http-' + antwort.status, message: kurzeAntwort(text) || antwort.statusText || '' };
              if (antwort.status === 404) throw fehler('nicht_da', 'Das Foto gibt es nicht (mehr).', original);
              if (antwort.status === 402) throw fehler('speicher_aus', 'Der Foto-Speicher ist nicht erreichbar oder das Bezahlkonto ist aus — Ulf Bescheid geben.', original);
              if (antwort.status === 401) throw fehler('nicht_angemeldet', 'Nicht angemeldet — bitte an der Tür anmelden.', original);
              if (antwort.status === 429) throw fehler('kontingent', 'Zu viele Abrufe — kurz warten.', original);
              if (antwort.status === 403) {
                return ursacheSpeicher(fehler('keine_berechtigung', 'Der Foto-Speicher hat abgelehnt.', original), 'lesen').then(function (e) {
                  if (e.art === 'keine_berechtigung') e.meldung = e.message = 'Der Foto-Speicher hat abgelehnt (403). Speicher nicht erreichbar oder Bezahlkonto aus — Ulf Bescheid geben.';
                  throw e;
                });
              }
              throw fehler('fehler', 'Der Foto-Speicher antwortet mit ' + antwort.status + '.', original);
            });
          }, function (err) {
            clearTimeout(uhr);
            if (err && err.name === 'AbortError') throw fehler('zeitlimit', 'Foto nach ' + Math.round(FOTO.abrufMs / 1000) + ' s nicht geladen — Netz zu langsam oder weg.', err);
            throw fehler('abruf', 'Foto nicht abrufbar. Ohne Netz geht das nicht; mit Netz fehlt vermutlich die Freigabe dieser Seite am Speicher (CORS, Ulfs Handgriff 6).', err);
          });
      });
    });
  }

  /* ---------- Löschen beim Archiv (E12) ----------
     Nur mit Bearbeiten-Haken; die Speicher-Regel erlaubt es erst, wenn die
     Anfrage im Archiv ist (repariertAm + 7 Tage, Serverzeit). Erst der
     Vermerk „n Fotos, gelöscht am …“, dann die Fotos — bricht es mittendrin
     ab, stimmt die Zahl trotzdem, und beim nächsten Mal wird nur weiter
     gelöscht. */
  function vermerkAnlegen(anfrageId, anzahl) {
    var name = 'geloescht~' + Math.max(1, Math.min(99, anzahl)) + '~' + heute();
    return speicher().ref('meldungen/' + anfrageId + '/' + name).put(new Blob([]), { contentType: 'application/octet-stream' })
      .then(function () { return { anzahl: anzahl, datum: heute(), name: name }; });
  }
  function fotosEinerAnfrageLoeschen(anfrageId) {
    return fotosListen(anfrageId).then(function (l) {
      if (!l.fotos.length) return { id: anfrageId, geloescht: 0, vermerk: l.vermerk };
      var schritt = l.vermerk ? Promise.resolve(l.vermerk)
        : vermerkAnlegen(anfrageId, l.fotos.length).catch(function (err) { return ursacheSpeicher(err, 'bearbeiten').then(function (e) { throw e; }); });
      return schritt.then(function (v) {
        var sp = speicher();
        return Promise.all(l.fotos.map(function (f) {
          return sp.ref(f.pfad).delete().catch(function (err) {
            if (err && err.code === 'storage/object-not-found') return null;   // schon weg (anderes Gerät)
            return ursacheSpeicher(err, 'bearbeiten').then(function (e) { throw e; });
          });
        })).then(function () { return { id: anfrageId, geloescht: l.fotos.length, vermerk: v }; });
      });
    });
  }
  /* Beim Öffnen der Seite (nur Bearbeiten-Haken): Anfragen, die in den
     letzten AUFRAEUM_TAGE (90) Tagen ins Archiv gerutscht sind, aufräumen —
     so lange, wie die Lebensdauer-Regel am Speicher (90 Tage) ohnehin
     reicht; danach gibt es nichts mehr zu löschen. erledigt(id) und
     merke(id) kommen von der Seite (Gerätespeicher), damit eine Anfrage
     nicht bei jedem Öffnen neu aufgelistet wird. Einzelfehler sammeln,
     nicht abbrechen. */
  function archivFotosAufraeumen(erledigt, merke, jetzt) {
    return ich().then(function (i) {
      if (!i.rechte.bearbeiten) return { geprueft: 0, geloescht: 0, fehler: [] };
      speicher();
      var t = jetzt === undefined ? Date.now() : ms(jetzt);
      var q = datenbank().collection('meldungen').where('kanal', '==', 'hausmeister').where('status', '==', 'repariert')
        .where('repariertAm', '<', grenzeArchiv(t - UHR_SPIELRAUM_MS))   // Geräteuhr kann vorgehen, die Regel rechnet mit Serverzeit
        .where('repariertAm', '>=', firebase.firestore.Timestamp.fromMillis(t - (ARCHIV_TAGE + AUFRAEUM_TAGE) * TAG_MS))
        .orderBy('repariertAm', 'desc');
      return q.get().then(function (snap) {
        var ids = [];
        snap.forEach(function (d) { if (!erledigt || !erledigt(d.id)) ids.push(d.id); });
        var erg = { geprueft: ids.length, geloescht: 0, fehler: [], ids: [] };
        return ids.reduce(function (kette, id) {
          return kette.then(function () {
            return fotosEinerAnfrageLoeschen(id).then(function (r) {
              erg.geloescht += r.geloescht; erg.ids.push(id);
              if (merke) merke(id);
            }, function (err) { erg.fehler.push({ id: id, fehler: err }); });
          });
        }, Promise.resolve()).then(function () { return erg; });
      }, function (err) { throw einordnen(err); });
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
    neuesterEintrag: neuesterEintrag,
    anlegen: anlegen,
    status: status,
    fenster: fenster,
    dringlichkeit: dringlichkeit,
    nachricht: nachricht,
    // Fotos (Stufe 2)
    SPEICHER_FASSUNG: SPEICHER_FASSUNG,
    SPEICHER_DATEI: SPEICHER_DATEI,
    FOTO: FOTO,
    fotosVerfuegbar: fotosVerfuegbar,
    pruefeSpeicherRegelstand: pruefeSpeicherRegelstand,
    neueAnfrageId: neueAnfrageId,
    neueEintragId: neueEintragId,
    verkleinern: verkleinern,
    fotoHochladen: fotoHochladen,
    fotosListen: fotosListen,
    fotoHolen: fotoHolen,
    fotosEinerAnfrageLoeschen: fotosEinerAnfrageLoeschen,
    archivFotosAufraeumen: archivFotosAufraeumen,
    fotosFuer: fotosFuer,
    fotosAusNamen: fotosAusNamen,
    speicherEinordnen: speicherEinordnen,
    // reine Rechnung (für die Seite und die Tests)
    rechteAus: rechteAus,
    neuMarke: neuMarke,
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
