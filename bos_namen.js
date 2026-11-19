/* ================================================================
   MODUL: bos_namen.js — die EINE Namensfunktion (Namens-Fundament, Schritt 5)
          und seit 10.10.2026 auch die EINE Personen-Ladefunktion der
          Planung (Baustelle #59, „gehört in den Schichtplan“)
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

   WER BIN ICH — für gebundene Schreibvorgänge (seit 18.11.2026, RK §34)
     ichSelbst(db, kennung, opt)
                          Promise, wird NIE abgelehnt. Liest JEDES MAL frisch
                          vom Server (source 'server'): erst personen where
                          bosKontoId == kennung (limit 2), dann namen/{P}.
                          Gedacht für den Aufruf UNMITTELBAR vor jedem
                          Schreibvorgang, der einen Namen trägt (ein Rufname-
                          Wechsel gilt ab dem nächsten Schreiben).
                          opt: { konto, ortErlaubt }  — konto = bos_accounts-
                          Dokument des Nutzers; ortErlaubt: true → ein Konto
                          der Art 'ort' ohne Person bekommt seine Notiz.
                          Ergebnis:
                            { personId: 'P07' | null,
                              name:   der gespeicherte Text, UNGEKÜRZT (kein trim —
                                      die Regel nmGilt vergleicht 1:1) | '',
                              quelle: 'rufname' | 'beschreibung' | 'ort' | '',
                              grund:  '' | 'keine_person' | 'mehrere' | 'kein_name' |
                                      'ort_ohne_name' | 'keine_kennung' | 'lesefehler',
                              text:   '' | Satz für die Oberfläche (beim Lesefehler
                                      mit err.code und err.message),
                              fehler: null | err }
                          Reihenfolge NE-6: rufname !== '' → Rufname, sonst
                          beschreibung !== '' → Beschreibung, sonst Grund.
                          Ist grund gesetzt, schreibt der Aufrufer NICHTS und
                          zeigt text (Formular + Fehlerleiste).
                          Nebenwirkung: der frische Eintrag ersetzt den von
                          laden() für diese Person (anzeige() zeigt ihn dann).
                          WARNUNG: dieselbe Reihenfolge steht in der Firestore-
                          Regel (nmGilt, nmIch, nmOrt; RK §34) — immer beide.
                          Unterschied zu anzeige(): anzeige() ist für die
                          Anzeige (einmal geladen, getrimmt, mit Ersatztext);
                          ichSelbst() ist für das, was die Regel prüft.
     ICH_TEXT             die Texte zu grund (für Tests und Seiten)

   PERSONEN FÜR DIE PLANUNG (#59, 10.10.2026)
     Jede Person hat das Feld imSchichtplan (boolean). FEHLT es, gilt
     „im Plan“ — so bleiben alle Bestandspersonen ohne Schreibvorgang
     unverändert. false = die Person ist da (Konto, Reparaturanfrage …),
     wird aber nie eingeteilt (Hausmeister, Fahrer, Verkauf, Büro).
     Das ist KEIN Ersatz für aktiv: aktiv:false heißt „ausgeschieden,
     nur noch nicht gelöscht“ (Ulf, 10.10. 09:47).
     imSchichtplan(person)    true, außer person.imSchichtplan === false.
                              Die EINZIGE Stelle, die das definiert.
     nurImSchichtplan(liste)  neue Liste ohne die Personen „nicht im Plan“
     personenFuerPlanung(db)  Promise: lädt personen UND die Namensliste
                              zusammen und liefert ein Snapshot-Imitat
                              OHNE die Personen „nicht im Plan“.
                              Imitat: forEach(fn), docs, size, empty —
                              die Einträge sind die echten Firestore-
                              Dokumente (doc.id, doc.data(), doc.ref …).
                              Alle acht Planungsseiten laden NUR hierüber;
                              ein Wächter-Test in der Prüfsuite verlangt das.
     personenAlle(db)         dasselbe ohne Filter. Nur für den offiziellen
                              Plan (gespeicherte Pläne bleiben lesbar, der
                              Nachtrag filtert selbst mit nurImSchichtplan)
                              und den Personen-Editor.
     Die Rechenmodule (rechenmodul.js, freie_tage_verteilung.js …) kennen
     das Feld nicht. Wer nicht in der Liste steht, kommt in keine Rechnung.

   ZUGRIFFE: eine Abfrage db.collection('namen').get() je Seite — kein
   Lesen je Nummer. personenFuerPlanung/personenAlle: dazu eine Abfrage
   db.collection('personen').get() je Aufruf (wie vorher auf den Seiten). Regel: namen liest jeder mit Konto (hatKonto()).
   Nichts wird im Gerätespeicher abgelegt.

   CHANGELOG
     2026-09-26 · v1.0 · Feature (Schritt 5, Konzept §10, K-7 bis K-9)
     2026-09-26 · v1.1 · Rückbau (Schritt 8, §10.8)
       Stufe 3 („M. · lokal“ aus bos_lokal_daten.js) und lokalNeuLesen()
       entfernt. Neu: räumt EINMALIG den Browserspeicher-Schlüssel
       bos_lokal_personen ab (dort lagen Vor- und Nachnamen aus der
       lokalen Datei), mit Konsolenvermerk; ist er nicht da, passiert nichts.
     2026-10-10 · v1.2 · Feature (Baustelle #59, „gehört in den Schichtplan“)
       imSchichtplan, nurImSchichtplan, personenFuerPlanung, personenAlle.
       Ersetzt den Inhalt der acht wortgleichen personenUndNamen()-Kopien
       der Planungsseiten. anzeige/auswahl/laden unverändert.
     2026-11-18 · 05:45 · v1.3 · Feature (Ein Name überall, RK §34; Bauplan
       _protokolle/SESSION_2026-11-18_NAMEN_RUFNAME_BAUPLAN.md 04:28, Go KC 04:42)
       ichSelbst() + ICH_TEXT. Erste Nutzer: Mitbringer, Lager anfordern.
       anzeige/auswahl/laden/personen* unverändert.
       Bau-Doku: _protokolle/SESSION_2026-11-18_NAMEN_RUFNAME_BAU.md
   // >>> Zusatz Admin-Sitzung (Personalakte)
     2026-11-18 · 19:40 · v1.4 · Zusatz (Personalakte Lieferung A, KC 18.11. 09:17)
       uebernimm(liste) und leeren(). Nur eingefügt; anzeige, auswahl, laden und alles
       Bestehende unverändert. Nutzer: konten/personalakte.html.
       WARNUNG zu leeren(): Nicht zusammen mit ichSelbst() auf einer Seite benutzen.
       Ein laufendes ichSelbst kann nach leeren() seinen Eintrag zurückschreiben.
       Wer beides braucht, baut vorher einen Stand-Zähler ein.
   // <<< Zusatz Admin-Sitzung
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

  /* ---- Wer bin ich? (RK §34, 18.11.2026) — Name für gebundene Schreibvorgänge ----
     Kopie von bos_meldungen.js eigenerName() (Starter §4: kopieren, nicht nachbauen),
     erweitert: frisch vom Server, Text UNGEKÜRZT (die Regel nmGilt vergleicht 1:1),
     kein Ersatztext, Grund statt Rückfall auf die Kennung. */
  var ICH_TEXT = {
    keine_person: 'Dein Konto ist mit keiner Person verknüpft — bitte Ulf Bescheid geben.',
    mehrere: 'Mit deinem Konto sind mehrere Personen verknüpft — bitte Ulf Bescheid geben.',
    kein_name: 'Für deine Person {p} steht kein Name in der Namensliste — bitte Ulf Bescheid geben.',
    ort_ohne_name: 'Dieses Stationskonto hat keinen Ortsnamen (Notiz) — bitte Ulf Bescheid geben.',
    keine_kennung: 'Nicht angemeldet — bitte an der Tür anmelden.',
    lesefehler: 'Dein Name ließ sich nicht lesen: {f}'
  };
  function ichAntwort(personId, name, quelle, grund, fehler, p) {
    var text = '';
    if (grund) {
      text = ICH_TEXT[grund] || grund;
      text = text.split('{p}').join(p || '');
      if (fehler) text = text.split('{f}').join((fehler.code ? fehler.code + ' — ' : '') + (fehler.message || String(fehler)));
    }
    return { personId: personId, name: name, quelle: quelle, grund: grund, text: text, fehler: fehler || null };
  }
  function roherText(t) { return (typeof t === 'string') ? t : ''; }

  function ichSelbst(db, kennung, opt) {
    var o = opt || {};
    var d = db || window.db;
    if (!kennung) return Promise.resolve(ichAntwort(null, '', '', 'keine_kennung', null));
    if (!d || typeof d.collection !== 'function') {
      return Promise.resolve(ichAntwort(null, '', '', 'lesefehler',
        new Error('Keine Firestore-Verbindung (window.db fehlt — bos_firebase_config.js geladen?)')));
    }
    var server = { source: 'server' };
    return Promise.resolve().then(function () {
      return d.collection('personen').where('bosKontoId', '==', kennung).limit(2).get(server);
    }).then(function (snap) {
      if (snap.size > 1) return ichAntwort(null, '', '', 'mehrere', null);
      if (snap.size === 1) {
        var personId = snap.docs[0].id;
        return d.collection('namen').doc(personId).get(server).then(function (n) {
          var e = n.exists ? (n.data() || {}) : {};
          eintraege[personId] = e;                       // anzeige() zeigt danach den frischen Stand
          var r = roherText(e.rufname), b = roherText(e.beschreibung);
          if (r !== '') return ichAntwort(personId, r, 'rufname', '', null);
          if (b !== '') return ichAntwort(personId, b, 'beschreibung', '', null);
          return ichAntwort(personId, '', '', 'kein_name', null, personId);
        });
      }
      var k = o.konto || null;
      if (o.ortErlaubt && k && k.art === 'ort') {
        var notiz = roherText(k.name);
        return notiz !== '' ? ichAntwort(null, notiz, 'ort', '', null) : ichAntwort(null, '', '', 'ort_ohne_name', null);
      }
      return ichAntwort(null, '', '', 'keine_person', null);
    }).catch(function (f) {
      console.error('[BOS_NAMEN] ichSelbst:', f);
      return ichAntwort(null, '', '', 'lesefehler', f);
    });
  }

  /* ---- Personen für die Planung (#59) ---- */
  function imSchichtplan(person) {
    return !!person && person.imSchichtplan !== false;
  }

  function nurImSchichtplan(liste) {
    return (liste || []).filter(imSchichtplan);
  }

  // Snapshot-Imitat: bedient alles, was die Planungsseiten am Personen-
  // Snapshot benutzen (Stand 10.10.: nur forEach mit doc.id/doc.data()),
  // dazu docs, size, empty wie beim echten QuerySnapshot. Die Dokumente
  // selbst sind die echten — nichts wird kopiert oder umgebaut.
  function snapshotAus(docs) {
    return {
      docs: docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: function (fn, dies) { docs.forEach(function (d) { fn.call(dies, d); }); }
    };
  }

  function personenLaden(db, filtern) {
    var d = db || window.db;
    if (!d || typeof d.collection !== 'function') {
      // abgelehnt statt geworfen: die Seiten zeigen den Grund in ihrem catch
      return Promise.reject(new Error('Personen nicht lesbar: keine Firestore-Verbindung (window.db fehlt — bos_firebase_config.js geladen?)'));
    }
    return Promise.all([d.collection('personen').get(), laden(d)]).then(function (r) {
      var alle = [];
      r[0].forEach(function (doc) { alle.push(doc); });
      if (!filtern) return snapshotAus(alle);
      return snapshotAus(alle.filter(function (doc) { return imSchichtplan(doc.data() || {}); }));
    });
  }

  function personenFuerPlanung(db) { return personenLaden(db, true); }
  function personenAlle(db) { return personenLaden(db, false); }

  // >>> Zusatz Admin-Sitzung (Personalakte)
  /* Für Seiten, die die Namensliste selbst über eine andere Verbindung laden (Personalakte: Admin-Sitzung).
     uebernimm(liste) setzt NUR die Einträge ({ P07: { beschreibung, rufname } }) — keine Abfrage, kein Warten
     auf die normale Anmeldung. Die Reihenfolge Rufname vor Beschreibung bleibt allein in anzeige().
     status().quelle ist danach 'uebernommen' (nicht 'firestore': diese Datei hat nichts geladen). */
  function uebernimm(liste) {
    var neu = {};
    Object.keys(liste || {}).forEach(function (id) {
      var e = liste[id] || {};
      neu[id] = { beschreibung: e.beschreibung || '', rufname: e.rufname || '' };
    });
    eintraege = neu;
    zustand.geladen = true;
    zustand.fehler = null;
    zustand.anzahl = Object.keys(eintraege).length;
    zustand.quelle = 'uebernommen';
    return status();
  }
  /* Leert ALLES: die Einträge (auch einen von ichSelbst gesetzten), das gemerkte laden()-Versprechen und den
     Status. Ein späteres laden() liest dadurch wirklich neu. Die Personalakte ruft das bei jedem Sperren.
     WARNUNG (KC 18.11.2026, 11:17): Nicht zusammen mit ichSelbst() auf einer Seite benutzen. Ein laufendes
     ichSelbst kann nach leeren() seinen Eintrag zurückschreiben. Wer beides braucht, baut vorher einen
     Stand-Zähler ein. */
  function leeren() {
    eintraege = {};
    ladePromise = null;
    zustand.geladen = false;
    zustand.fehler = null;
    zustand.anzahl = 0;
    zustand.quelle = null;
    return status();
  }
  // <<< Zusatz Admin-Sitzung

  lokalenSpeicherRaeumen();

  window.BOS_NAMEN = {
    // >>> Zusatz Admin-Sitzung (Personalakte)
    uebernimm: uebernimm,
    leeren: leeren,
    // <<< Zusatz Admin-Sitzung
    laden: laden,
    anzeige: anzeige,
    auswahl: auswahl,
    anzeigeEinreichung: anzeigeEinreichung,
    status: status,
    fehlerZeigen: fehlerZeigen,
    imSchichtplan: imSchichtplan,
    nurImSchichtplan: nurImSchichtplan,
    personenFuerPlanung: personenFuerPlanung,
    personenAlle: personenAlle,
    ichSelbst: ichSelbst,
    ICH_TEXT: ICH_TEXT
  };
})();
