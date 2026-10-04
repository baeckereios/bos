/* ================================================================
   MODUL: bos_namen.js — die EINE Namensfunktion (Namens-Fundament, Schritt 5)
   ----------------------------------------------------------------
   Ersetzt neun Kopien von anzeigeName() in den Planungsseiten. Jede Seite
   lädt die Namensliste (Firestore 'namen', ein Dokument je Nummer:
   { beschreibung, rufname }) EINMAL und fragt dann synchron.

   Reihenfolge der Anzeige (NE-6):
     1. Rufname (vom Besitzer gewählt), wenn nicht leer
     2. sonst Beschreibung (Ulfs Name für die Person)
     3. sonst „P07 · kein Name hinterlegt“
   (Die frühere Stufe „lokale Datei als Kürzel · lokal“ ist seit Schritt 8
   entfernt — die lokale Namensdatei gibt es nicht mehr.)
   Das Ergebnis ist NIE leer und NIE "undefined".

   Auswahllisten (NE-7): „Rufname (Beschreibung)“, wenn beide da sind und
   sich unterscheiden — verglichen OHNE Groß/Klein und Randleerzeichen
   (K-8), sonst wie anzeige().

   SCHNITTSTELLE (window.BOS_NAMEN)
     laden(db)            Promise, wird NIE abgelehnt; einmal je Seite
                          (zweiter Aufruf = dasselbe Promise).
                          Löst auf mit status().
     anzeige(nr)          String — Plan-Zellen, Listen, Texte, Druck
     auswahl(nr)          String — <option> in Auswahllisten
     anzeigeEinreichung(e, personen)
                          Name zu einer Einreichung (Wunschtag, Urlaub,
                          Sonntags-Ablehnung): über personId, sonst über
                          bosKontoId → Person; der in der Einreichung
                          gespeicherte Name wird NICHT benutzt (§10.3).
     status()             { geladen, fehler, anzahl, quelle }
     fehlerZeigen(el?)    Grund sichtbar in el oder als Streifen oben

   ZUGRIFFE: eine Abfrage db.collection('namen').get() je Seite — kein
   Lesen je Nummer. Regel: namen liest jeder mit Konto (hatKonto()).
   Nichts wird im Gerätespeicher abgelegt.

   CHANGELOG
     2026-09-26 · v1.0 · Feature (Schritt 5, Konzept §10, K-7 bis K-9)
     2026-09-26 · v1.1 · Rückbau (Schritt 8, §10.8)
       Stufe 3 („M. · lokal“ aus bos_lokal_daten.js) und lokalNeuLesen()
       entfernt. Neu: räumt EINMALIG den Browserspeicher-Schlüssel
       bos_lokal_personen ab (dort lagen Vor- und Nachnamen aus der
       lokalen Datei), mit Konsolenvermerk; ist er nicht da, passiert nichts.
   ================================================================ */
(function () {
  'use strict';

  var eintraege = {};      // { P07: { beschreibung, rufname } }
  var ladePromise = null;
  var zustand = { geladen: false, fehler: null, anzahl: 0, quelle: null };

  function sauber(t) { return (t === null || t === undefined) ? '' : String(t).trim(); }
  function klein(t) { return sauber(t).toLocaleLowerCase('de'); }

  // Schritt 8 (§10.8, Punkt 5): die lokale Namensdatei lag nicht nur als
  // Datei, sondern auch im Browserspeicher jedes Geräts, auf dem sie je
  // geladen wurde. Einmal entfernen; danach gibt es den Schlüssel nicht mehr.
  var LOKAL_SCHLUESSEL = 'bos_lokal_personen';
  function lokalenSpeicherRaeumen() {
    try {
      if (window.localStorage && window.localStorage.getItem(LOKAL_SCHLUESSEL) !== null) {
        window.localStorage.removeItem(LOKAL_SCHLUESSEL);
        console.info('[BOS_NAMEN] Schritt 8: alte lokale Namensdatei aus dem Browserspeicher entfernt (' + LOKAL_SCHLUESSEL + ').');
        return true;
      }
    } catch (e) {
      console.error('[BOS_NAMEN] Browserspeicher nicht erreichbar — alte lokale Namensdatei nicht entfernt:', e);
    }
    return false;
  }

  function status() {
    return { geladen: zustand.geladen, fehler: zustand.fehler, anzahl: zustand.anzahl, quelle: zustand.quelle };
  }

  function fehlerText() {
    var f = zustand.fehler;
    if (!f) return '';
    return 'Namensliste nicht lesbar: ' + ((f.code ? f.code + ' — ' : '') + (f.message || String(f))) +
      '. Namen fallen auf „kein Name hinterlegt“ zurück.';
  }

  function fehlerZeigen(el) {
    var text = fehlerText();
    if (!text) return;
    if (el) { el.textContent = text; el.hidden = false; if (el.style) el.style.display = ''; return; }
    var setzen = function () {
      if (document.getElementById('bosNamenFehler')) { document.getElementById('bosNamenFehler').textContent = text; return; }
      var d = document.createElement('div');
      d.id = 'bosNamenFehler';
      d.setAttribute('role', 'alert');
      d.style.cssText = 'margin:8px 12px; padding:10px 12px; border:1px solid var(--bos-red, #d9534f); border-radius:8px;' +
        'color:var(--bos-red, #d9534f); background:rgba(217,83,79,.08); font-size:.85rem; font-weight:600;';
      d.textContent = text;
      document.body.insertBefore(d, document.body.firstChild);
    };
    if (document.body) setzen(); else document.addEventListener('DOMContentLoaded', setzen);
  }

  function laden(db) {
    if (ladePromise) return ladePromise;
    var d = db || window.db;
    if (!d || typeof d.collection !== 'function') {
      zustand.fehler = new Error('Keine Firestore-Verbindung (window.db fehlt — bos_firebase_config.js geladen?)');
      zustand.quelle = 'fehler';
      console.error('[BOS_NAMEN]', zustand.fehler);
      fehlerZeigen();
      ladePromise = Promise.resolve(status());
      return ladePromise;
    }
    ladePromise = Promise.resolve(window.BOS_AUTH_READY).then(function () {
      return d.collection('namen').get();
    }).then(function (snap) {
      eintraege = {};
      snap.forEach(function (doc) { eintraege[doc.id] = doc.data() || {}; });
      zustand.geladen = true;
      zustand.anzahl = Object.keys(eintraege).length;
      zustand.quelle = 'firestore';
      return status();
    }).catch(function (f) {
      console.error('[BOS_NAMEN] Namensliste konnte nicht geladen werden:', f);
      zustand.fehler = f;
      zustand.quelle = 'fehler';
      fehlerZeigen();
      return status();
    });
    return ladePromise;
  }

  function anzeige(nr) {
    var id = sauber(nr);
    if (!id) return '— keine Nummer';
    var e = eintraege[id];
    if (e) {
      var r = sauber(e.rufname);
      if (r) return r;
      var b = sauber(e.beschreibung);
      if (b) return b;
    }
    return id + ' · kein Name hinterlegt';
  }

  function auswahl(nr) {
    var id = sauber(nr);
    var e = eintraege[id];
    if (e) {
      var r = sauber(e.rufname), b = sauber(e.beschreibung);
      if (r && b && klein(r) !== klein(b)) return r + ' (' + b + ')';
    }
    return anzeige(id);
  }

  function anzeigeEinreichung(ein, personen) {
    if (!ein) return '—';
    if (ein.personId) return anzeige(ein.personId);
    if (ein.bosKontoId) {
      var p = (personen || []).filter(function (x) { return x && x.bosKontoId && x.bosKontoId === ein.bosKontoId; })[0];
      if (p) return anzeige(p.id);
      return 'Konto ' + ein.bosKontoId + ' · keiner Person zugeordnet';
    }
    return '— ohne Nummer und Konto';
  }

  lokalenSpeicherRaeumen();

  window.BOS_NAMEN = {
    laden: laden,
    anzeige: anzeige,
    auswahl: auswahl,
    anzeigeEinreichung: anzeigeEinreichung,
    status: status,
    fehlerZeigen: fehlerZeigen
  };
})();
