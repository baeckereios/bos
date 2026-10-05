/* ================================================================
   BäckereiOS · bos_produkte.js — die Produktliste, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_PRODUKTE

   Einbindung NACH bos_firebase_config.js (braucht window.db und
   window.BOS_AUTH_READY), dann erst der seiteneigene Code:

     <script src="../bos_firebase_config.js"></script>
     <script src="../bos_produkte.js"></script>

   Zweck (Stufe 1, Anweisung vom 05.10.2026): Alle Seiten lesen die
   Produktliste aus Firestore `produkte` statt aus produkt_config.json.
   Zwölf Aufrufer, eine Mechanik. Kein Rückfall auf die Datei — sonst
   gäbe es wieder zwei Quellen.

   Aufruf:
     const e = await BOS_PRODUKTE.lade({ sicht: 'aktive' });
     e.liste        Produkte in derselben Form wie bisher aus der Datei
     e.quelle       'server' | 'geraetekopie_aktuell' | 'geraetekopie'
     e.stand        Date — Zeitpunkt des Server-Stands bzw. der Kopie
     e.standNummer  Nummer des Stand-Zettels (null, wenn es ihn nicht gibt)
     e.grund        nur bei 'geraetekopie': der Fehler, warum der Server
                    nicht geantwortet hat (Objekt mit art, meldung, original)
     e.warnungen    Auffälligkeiten in den Dokumenten (Liste von Texten)

   Sichten:
     'aktive'  Standard. Ohne gelöschte, sortiert nach `reihenfolge`
               (Dokumente ohne das Feld ans Ende, dort nach legacyKey),
               ohne die Felder `reihenfolge` und `geloescht`.
     'alle'    wie 'aktive', aber mit gelöschten — die tragen
               `geloescht: true`. Für Seiten, die Namen zu alten Daten
               nachschlagen (Werkstatt, Verbrauch-Einstellungen) und für
               die Schlüsselprüfung im Editor.
     'roh'     Dokumente unverändert als { id, daten }. Nur Sync-Tool.

   Weitere Optionen:
     nurServer: true   nie die Gerätekopie liefern (Editor, Sync-Tool —
                       wer einen alten Stand bearbeitet und einspielt,
                       dreht neuere Änderungen zurück)
     frisch: true      erzwingt einen neuen Vollabruf („Neu laden“)

   Stand-Zettel (Ulf, 05.10.2026, 08:00): Vor dem Vollabruf wird nur
   das Dokument produkte_stand/aktuell gelesen (ein Lesevorgang). Trägt
   die Gerätekopie dieselbe Nummer, kommt die Liste vom Gerät
   ('geraetekopie_aktuell', kein Hinweis — das ist der Alltag). Nur bei
   höherer Nummer wird die ganze Sammlung geholt. Das Sync-Tool (und ab
   Stufe 2 der Editor) zählt die Nummer im selben Batch hoch, die Regel
   erzwingt das (RK: produkte_stand).

   Gerätekopie (localStorage): nur aus einer Server-Antwort mit
   mindestens einem Produkt geschrieben, nie aus einer leeren oder aus
   dem Zwischenspeicher. Geliefert nur bei „kein Netz“, „Zeitlimit“ und
   „Kontingent aufgebraucht“ — nie bei „keine Berechtigung“ (ein
   gesperrtes Konto darf die Liste auch nicht über den Umweg sehen).
   Zeitnetz: ist die Kopie älter als ZEITNETZ_MS, wird auch bei gleichem
   Stand voll geladen (heilt einen Fehler im Schreibweg von selbst).

   Fehler kommen als Error mit .art, .meldung (normale Sprache),
   .original (Code — Meldung der Datenbank) und bei 'regel_alt'
   .regelDatei. Die Seite zeigt .meldung sichtbar an (Ulfs Regel).
     'nicht_geladen'       Firebase oder bos_firebase_config.js fehlt
     'nicht_angemeldet'    BOS_AUTH_READY lehnt ab
     'kein_netz'           unavailable / Antwort aus dem Zwischenspeicher
     'zeitlimit'           keine Antwort nach ZEITLIMIT_MS
     'kontingent'          resource-exhausted (Tagesrahmen aufgebraucht)
     'keine_berechtigung'  abgelehnt, Konto ohne Haken „freigeschaltet“
     'regel_alt'           abgelehnt, Konto hat den Haken, die eingesetzte
                           Regel kennt diese Seite noch nicht (RK §13)
     'leer'                Server antwortet mit null Produkten
     'fehler'              alles andere

   Datum nie über toISOString() (UTC-Falle zwischen 0 und 2 Uhr).

   CHANGELOG
     2026-10-05 · v0.1 · Neu
       Erstfassung. Bauplan SESSION_2026-10-05_PRODUKTE_AUS_FIRESTORE_
       STUFE1.md (Freigabe Kontroll-Chat 08:18 Uhr, von Ulf weitergegeben). Zeitlimit kopiert aus
       nfc_qr/nfc_qr_zentrale.html (mitZeitlimit), Gerätekopie nach dem
       Muster aus teigecke/teigecke_nacht.html (ladeProdukte), erweitert
       um Stand-Zettel und die Unterscheidung „Konto gesperrt“ /
       „Regel zu alt“ über das eigene Konto-Dokument.
   ================================================================ */
(function (global) {
  'use strict';

  var COLLECTION = 'produkte';
  var STAND_COLLECTION = 'produkte_stand';
  var STAND_DOK = 'aktuell';
  var KOPIE_KEY = 'bos_produkte_geraetekopie_v1';
  var ZEITLIMIT_MS = 10000;
  /* Zeitnetz (KC 05.10., 08:18): sieben Tage, 0 = aus. */
  var ZEITNETZ_MS = 7 * 24 * 60 * 60 * 1000;
  var REGEL_FASSUNG = 'produkte-2026-10-05';
  var REGEL_DATEI = 'firestore_regeln_2026-10-05_produkte_stand.rules';
  var MELDUNG_ID = 'bosProdukteMeldung';

  /* Texte an einer Stelle. */
  var T = {
    nicht_geladen: 'Produktliste: Firebase oder bos_firebase_config.js ist nicht geladen.',
    nicht_angemeldet: 'Produktliste: Die Anmeldung konnte nicht geprüft werden.',
    kein_netz: 'Produktliste: Keine Verbindung zum Server (WLAN?).',
    zeitlimit: 'Produktliste: Keine Antwort vom Server nach {s} s — vermutlich kein Netz.',
    kontingent: 'Produktliste: Das Tageskontingent der Datenbank ist aufgebraucht. Ab morgen geht es wieder; bis dahin läuft die Seite mit dem Stand vom Gerät.',
    keine_berechtigung: 'Produktliste: Keine Berechtigung — dein Konto ist nicht freigeschaltet oder hat kein Konto-Dokument. Sag Ulf Bescheid.',
    keine_berechtigung_unklar: 'Produktliste: Keine Berechtigung — die Datenbank hat abgelehnt, der Grund ließ sich nicht feststellen.',
    regel_alt: 'Produktliste: Die Firestore-Regeln sind älter als diese Seite. In der Firebase-Konsole {datei} einsetzen (Fassung {fassung}).',
    leer: 'Produktliste: Der Server meldet null Produkte. Das ist kein Netzproblem — Sammlung „produkte“ in der Firebase-Konsole prüfen oder im Sync-Tool einspielen.',
    fehler: 'Produktliste konnte nicht geladen werden.',
    kopie: 'Produktliste vom {zeit} (Gerätekopie — {grund})',
    kopie_grund_netz: 'kein Netz',
    kopie_grund_zeit: 'Server antwortet nicht',
    kopie_grund_kontingent: 'Tageskontingent aufgebraucht',
    warn_ohne_key: 'Dokument „{id}“ hat kein Feld legacyKey.',
    warn_id: 'Dokument „{id}“ trägt legacyKey „{key}“ — Dokument-ID und Schlüssel müssen gleich sein.'
  };
  function t(k, v) {
    var s = T[k] || k;
    Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(String(v[n])); });
    return s;
  }

  function zeitText(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '?';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ' Uhr';
  }

  /* Kopiert aus nfc_qr/nfc_qr_zentrale.html (mitZeitlimit), nicht nachgebaut. */
  function mitZeitlimit(promise, ms) {
    var timer;
    var zeit = new Promise(function (_, reject) {
      timer = setTimeout(function () { var e = new Error('Zeitlimit ' + (ms / 1000) + ' s überschritten'); e.code = 'zeitlimit'; reject(e); }, ms);
    });
    return Promise.race([promise, zeit]).finally(function () { clearTimeout(timer); });
  }

  function zeitMs(wert) {
    return wert && typeof wert.toMillis === 'function' ? wert.toMillis() : (typeof wert === 'number' ? wert : null);
  }

  function fehler(art, meldung, original, extra) {
    var e = new Error(meldung);
    e.art = art;
    e.meldung = meldung;
    e.original = original ? ((original.code ? original.code + ' — ' : '') + (original.message || String(original))) : '';
    e.code = original && original.code ? original.code : art;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  /* Welche Art Fehler hat die Datenbank gemeldet? Nur die groben Klassen —
     „keine Berechtigung“ wird danach noch unterschieden (F1). */
  function artAus(err) {
    var c = (err && err.code) || '';
    if (c === 'zeitlimit') return 'zeitlimit';
    if (c === 'unavailable') return 'kein_netz';
    if (c === 'resource-exhausted') return 'kontingent';
    if (c === 'permission-denied') return 'keine_berechtigung';
    if (/offline/i.test((err && err.message) || '')) return 'kein_netz';
    return 'fehler';
  }
  function liefertKopie(art) {
    return art === 'kein_netz' || art === 'zeitlimit' || art === 'kontingent';
  }
  function kopieGrund(art) {
    if (art === 'zeitlimit') return t('kopie_grund_zeit');
    if (art === 'kontingent') return t('kopie_grund_kontingent');
    return t('kopie_grund_netz');
  }

  /* ---------- Sortieren und Sichten (reine Logik, testbar) ---------- */
  function vergleich(a, b) {
    var ra = typeof a.reihenfolge === 'number' ? a.reihenfolge : null;
    var rb = typeof b.reihenfolge === 'number' ? b.reihenfolge : null;
    if (ra !== null && rb !== null && ra !== rb) return ra - rb;
    if (ra !== null && rb === null) return -1;
    if (ra === null && rb !== null) return 1;
    return String(a.legacyKey || a.id || '').localeCompare(String(b.legacyKey || b.id || ''), 'de');
  }
  function ohneFelder(daten, felder) {
    var k = {};
    Object.keys(daten).forEach(function (f) { if (felder.indexOf(f) === -1) k[f] = daten[f]; });
    return k;
  }
  /* roh: [{ id, daten }] → Liste je Sicht. */
  function sicht(roh, name) {
    if (name === 'roh') return roh.map(function (d) { return { id: d.id, daten: d.daten }; });
    var sortiert = roh.map(function (d) { return d.daten; }).slice().sort(vergleich);
    if (name === 'alle') {
      return sortiert.map(function (p) {
        var o = ohneFelder(p, ['reihenfolge', 'geloescht']);
        if (p.geloescht === true) o.geloescht = true;
        return o;
      });
    }
    return sortiert
      .filter(function (p) { return p.geloescht !== true; })
      .map(function (p) { return ohneFelder(p, ['reihenfolge', 'geloescht']); });
  }
  function warnungenFuer(roh) {
    var w = [];
    roh.forEach(function (d) {
      if (!d.daten || !d.daten.legacyKey) w.push(t('warn_ohne_key', { id: d.id }));
      else if (d.daten.legacyKey !== d.id) w.push(t('warn_id', { id: d.id, key: d.daten.legacyKey }));
    });
    return w;
  }

  /* ---------- Die Mechanik, mit austauschbarer Umgebung (Tests) ---------- */
  function erstelle(umg) {
    umg = umg || {};
    var holeDb = umg.db || function () { return global.db; };
    var holeAuth = umg.authReady || function () { return global.BOS_AUTH_READY; };
    var holeFirebase = umg.firebase || function () { return global.firebase; };
    var speicher = umg.speicher || (function () {
      try { return global.localStorage; } catch (e) { return null; }
    })();
    var istOnline = umg.online || function () { return !global.navigator || global.navigator.onLine !== false; };
    var jetzt = umg.jetzt || function () { return Date.now(); };
    var zeitlimitMs = umg.zeitlimitMs || ZEITLIMIT_MS;
    var zeitnetzMs = (typeof umg.zeitnetzMs === 'number') ? umg.zeitnetzMs : ZEITNETZ_MS;
    var dokument = umg.dokument || function () { return global.document; };

    var laufend = null;      /* Promise des Vollabrufs dieser Seite */
    var laufendNurServer = false;

    function liesKopie() {
      if (!speicher) return null;
      try {
        var k = JSON.parse(speicher.getItem(KOPIE_KEY) || 'null');
        if (!k || !Array.isArray(k.roh) || !k.roh.length || typeof k.zeit !== 'number') return null;
        return k;
      } catch (e) { return null; }
    }
    function schreibeKopie(roh, standNummer, standZeit) {
      if (!speicher || !roh.length) return;
      try {
        speicher.setItem(KOPIE_KEY, JSON.stringify({ zeit: jetzt(), stand: standNummer, standZeit: standZeit, roh: roh }));
      } catch (e) { /* voll oder gesperrt: egal, dann gibt es keine Kopie */ }
    }
    function kopieErgebnis(k, quelle, grund) {
      return {
        roh: k.roh, quelle: quelle,
        stand: new Date(k.standZeit || k.zeit), standNummer: (typeof k.stand === 'number') ? k.stand : null,
        kopieZeit: new Date(k.zeit),
        grund: grund || null, warnungen: warnungenFuer(k.roh)
      };
    }
    function kopieFrisch(k) {
      return !zeitnetzMs || (jetzt() - k.zeit) < zeitnetzMs;
    }

    /* F1: „Konto gesperrt“ oder „Regel zu alt“? Nur im Fehlerfall, zwei Lesevorgänge. */
    function unterscheideBerechtigung(db, nutzer, original) {
      var kennung = nutzer && nutzer.email ? String(nutzer.email).split('@')[0] : null;
      if (!kennung) return Promise.resolve(fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original));
      return mitZeitlimit(db.collection('bos_accounts').doc(kennung).get({ source: 'server' }), zeitlimitMs)
        .then(function (konto) {
          var daten = konto && konto.exists ? (konto.data() || {}) : null;
          if (!daten || daten.freigeschaltet !== true) {
            return fehler('keine_berechtigung', t('keine_berechtigung'), original);
          }
          /* Konto in Ordnung → liegt es an der Regel? */
          return mitZeitlimit(db.collection('bos_regelstand').doc(REGEL_FASSUNG).get({ source: 'server' }), zeitlimitMs)
            .then(function () {
              /* Regel kennt die Fassung, Konto hat den Haken, trotzdem abgelehnt: unerwartet. */
              return fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original);
            }, function (e2) {
              if (artAus(e2) === 'keine_berechtigung') {
                return fehler('regel_alt', t('regel_alt', { datei: REGEL_DATEI, fassung: REGEL_FASSUNG }), original, { regelDatei: REGEL_DATEI, regelFassung: REGEL_FASSUNG });
              }
              return fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original);
            });
        }, function () {
          return fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original);
        });
    }

    /* Fehler der Datenbank in unseren Fehler übersetzen; bei Berechtigung mit Unterscheidung. */
    function uebersetze(err, db, nutzer) {
      var art = artAus(err);
      if (art === 'keine_berechtigung') return unterscheideBerechtigung(db, nutzer, err);
      if (art === 'zeitlimit') return Promise.resolve(fehler('zeitlimit', t('zeitlimit', { s: zeitlimitMs / 1000 }), err));
      return Promise.resolve(fehler(art, t(art), err));
    }

    /* Liest den Stand-Zettel. Ergebnis: { nummer, zeit } oder null (gibt es nicht). */
    function liesStand(db) {
      return mitZeitlimit(db.collection(STAND_COLLECTION).doc(STAND_DOK).get({ source: 'server' }), zeitlimitMs)
        .then(function (dok) {
          if (dok && dok.metadata && dok.metadata.fromCache) { var e = new Error('Antwort aus dem Zwischenspeicher'); e.code = 'unavailable'; throw e; }
          if (!dok || !dok.exists) return null;
          var d = dok.data() || {};
          return { nummer: (typeof d.nummer === 'number') ? d.nummer : null, zeit: zeitMs(d.geaendertAm) };
        });
    }

    function vollabruf(db) {
      return mitZeitlimit(db.collection(COLLECTION).get({ source: 'server' }), zeitlimitMs)
        .then(function (snap) {
          if (snap && snap.metadata && snap.metadata.fromCache) { var e = new Error('Antwort aus dem Zwischenspeicher'); e.code = 'unavailable'; throw e; }
          var roh = [];
          snap.forEach(function (d) { roh.push({ id: d.id, daten: d.data() }); });
          return roh;
        });
    }

    /* Der eigentliche Ablauf. Liefert { roh, quelle, stand, standNummer, grund, warnungen }. */
    function holeRoh(opt) {
      var nurServer = !!opt.nurServer;
      var db = holeDb();
      var auth = holeAuth();
      if (typeof holeFirebase() === 'undefined' || !db || !auth) {
        return Promise.reject(fehler('nicht_geladen', t('nicht_geladen'), new Error('window.db oder window.BOS_AUTH_READY fehlt')));
      }
      var nutzer = null;
      return Promise.resolve(auth).then(function (n) { nutzer = n; }, function (err) {
        throw fehler('nicht_angemeldet', t('nicht_angemeldet'), err);
      }).then(function () {
        var kopie = nurServer ? null : liesKopie();

        /* Das Gerät sagt selbst „kein Netz“: nicht 10 s warten (F9). */
        if (!istOnline()) {
          var eNetz = fehler('kein_netz', t('kein_netz'), new Error('navigator.onLine = false'));
          if (kopie) return kopieErgebnis(kopie, 'geraetekopie', eNetz);
          throw eNetz;
        }

        return liesStand(db).then(function (stand) {
          var nummer = stand ? stand.nummer : null;
          /* Alltag: Stand gleich, Kopie jung genug → vom Gerät, ohne Hinweis. */
          if (!opt.frisch && kopie && nummer !== null && kopie.stand === nummer && kopieFrisch(kopie)) {
            return kopieErgebnis(kopie, 'geraetekopie_aktuell', null);
          }
          return vollabruf(db).then(function (roh) {
            if (!roh.length) throw fehler('leer', t('leer'), new Error('0 Dokumente in ' + COLLECTION));
            var standZeit = stand && stand.zeit ? stand.zeit : jetzt();
            if (!nurServer) schreibeKopie(roh, nummer, standZeit);
            return { roh: roh, quelle: 'server', stand: new Date(standZeit), standNummer: nummer, kopieZeit: null, grund: null, warnungen: warnungenFuer(roh) };
          }, function (err) {
            return uebersetze(err, db, nutzer).then(function (f) {
              if (kopie && liefertKopie(f.art)) return kopieErgebnis(kopie, 'geraetekopie', f);
              throw f;
            });
          });
        }, function (err) {
          return uebersetze(err, db, nutzer).then(function (f) {
            if (kopie && liefertKopie(f.art)) return kopieErgebnis(kopie, 'geraetekopie', f);
            throw f;
          });
        });
      });
    }

    function lade(opt) {
      opt = opt || {};
      var name = opt.sicht || 'aktive';
      if (['aktive', 'alle', 'roh'].indexOf(name) === -1) return Promise.reject(fehler('fehler', 'Unbekannte Sicht „' + name + '“'));
      var nurServer = !!opt.nurServer;
      if (!laufend || opt.frisch || nurServer !== laufendNurServer) {
        laufendNurServer = nurServer;
        laufend = holeRoh(opt);
        laufend.catch(function () { laufend = null; });   /* nächster Aufruf versucht es neu */
      }
      return laufend.then(function (e) {
        return {
          liste: sicht(e.roh, name), quelle: e.quelle, stand: e.stand, standNummer: e.standNummer,
          kopieZeit: e.kopieZeit, grund: e.grund, warnungen: e.warnungen
        };
      });
    }

    /* Text für die Seite: '' im Normalfall, sonst der Hinweis zur Gerätekopie. */
    function hinweisText(e) {
      if (!e || e.quelle !== 'geraetekopie') return '';
      var grund = e.grund && e.grund.art ? kopieGrund(e.grund.art) : t('kopie_grund_netz');
      return t('kopie', { zeit: zeitText(e.kopieZeit || e.stand), grund: grund });
    }
    function fehlerText(err) {
      if (!err) return t('fehler');
      var m = err.meldung || err.message || String(err);
      return err.original && err.original !== m ? m + ' (' + err.original + ')' : m;
    }

    /* Schmale Meldezeile oben für Seiten ohne eigene Meldestelle (F12).
       art: 'fehler' (rot) | 'hinweis' (bernstein). Nur textContent, nie HTML. */
    function zeigeMeldung(text, art) {
      var doc = dokument();
      if (!doc || !doc.body) return;
      var el = doc.getElementById(MELDUNG_ID);
      if (!text) { if (el) el.remove(); return; }
      if (!el) {
        el = doc.createElement('div');
        el.id = MELDUNG_ID;
        el.setAttribute('role', 'alert');
        doc.body.insertBefore(el, doc.body.firstChild);
      }
      var farbe = art === 'fehler' ? 'var(--bos-red, #d6584a)' : 'var(--bos-amber, #c07a10)';
      el.style.cssText = [
        'position:sticky', 'top:0', 'z-index:2147483000', 'box-sizing:border-box', 'width:100%',
        'padding:8px 14px', 'font-family:var(--bos-font-body, Barlow, sans-serif)', 'font-size:var(--bos-font-sm, 0.82rem)',
        'line-height:1.4', 'color:var(--bos-text, #f3ece1)', 'background:var(--bos-surface-raised, #2b2218)',
        'border-left:4px solid ' + farbe, 'border-bottom:1px solid var(--bos-border, rgba(255,255,255,0.08))',
        'word-break:break-word'
      ].join(';');
      el.textContent = text;
    }
    function versteckeMeldung() { zeigeMeldung('', ''); }

    /* Für Fehlerleisten anderer Seiten: Fehler mit Hinweis anzeigen, Ergebnis zurück. */
    return {
      lade: lade,
      hinweisText: hinweisText,
      fehlerText: fehlerText,
      zeigeMeldung: zeigeMeldung,
      versteckeMeldung: versteckeMeldung,
      /* Konstanten für Sync-Tool, Editor und Tests */
      COLLECTION: COLLECTION, STAND_COLLECTION: STAND_COLLECTION, STAND_DOK: STAND_DOK,
      KOPIE_KEY: KOPIE_KEY, REGEL_FASSUNG: REGEL_FASSUNG, REGEL_DATEI: REGEL_DATEI,
      ZEITLIMIT_MS: zeitlimitMs, ZEITNETZ_MS: zeitnetzMs,
      /* reine Logik, auch für den Sync-Export */
      sicht: sicht, vergleich: vergleich, warnungenFuer: warnungenFuer, mitZeitlimit: mitZeitlimit
    };
  }

  var api = erstelle();
  api.erstelle = erstelle;
  global.BOS_PRODUKTE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
