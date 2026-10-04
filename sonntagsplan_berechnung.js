/* ============================================================
   sonntagsplan_berechnung.js — BäckereiOS SchichtPlaner
   ------------------------------------------------------------
   Reine Berechnungslogik für Sonntagsplan, aus sonntagsplan.html
   herausgezogen (Ulf, 12.09.2026: "vielleicht sollten wir die
   Berechnungen langsam in einer eigenen Datei machen"). Enthält
   die vier "bewussten Eingabe-Anpassungen" — rechenmodul.js
   bleibt dabei weiterhin vollständig UNVERÄNDERT, siehe Prinzip
   "keine stillen Architektur-Änderungen" in sonntagsplan.html.

   Bewusst KEINE eigene UI, kein Zugriff auf DOM-Elemente oder
   lokale Namen — reine Funktionen, die Rohdaten entgegennehmen
   und Rohdaten zurückgeben. sonntagsplan.html bleibt für Rendern,
   Formular-Zustand und Firestore-Schreiben zuständig.

   Voraussetzung: rechenmodul.js ist vor dieser Datei eingebunden
   (braucht berechneTagAlleSchichten als globale Funktion).
   Erwartet außerdem window.db (bos_firebase_config.js) sowie
   optional window.BOS_FEIERTAGE / window.BOS_ZEITKONTEXT
   (bos_zeitkontext_referenz.js / bos_zeitkontext.js) für
   ermittleTageImMonat — ohne die beiden liefert diese Funktion
   nur die Sonntage, keine Feiertage (kein Absturz).

   Einbindung (Satellit, eine Ebene unter Root):
     <script src="../rechenmodul.js"></script>
     <script src="../sonntagsplan_berechnung.js"></script>

   2026-09-12 · v0.1 · Feature
     Herausgezogen aus sonntagsplan.html v0.6: isoDatumAusJsDate,
     monatsPrefix, verschobenesDatum, ermittleTageImMonat,
     ladeBaselineFuerMonat, berechneMonat (inkl. aller vier
     bewussten Eingabe-Anpassungen). berechneMonat() bekommt
     personenListe/positionenListe/abwesenheitenListe/
     sonntagStandardObergrenze jetzt als explizite Parameter statt
     stillschweigend aus Closure-Variablen zu lesen — macht die
     Funktion selbst klarer nachvollziehbar und unabhängig von
     sonntagsplan.html's internem Zustand.
   2026-09-12 · 15:06 · v0.2 · Feature
     Fünfte Eingabe-Anpassung: berechneMonat() bekommt neuen optionalen
     Parameter abgelehnteProDatum ({ datum: { personId: true } }) --
     übernommene Sonntag-Ablehnungen aus wunschtag.html (Tab 2, neu)
     schließen die jeweilige Person für den jeweiligen Tag aus, gleiches
     Prinzip wie die anderen Ausschluss-Anpassungen.
   2026-09-16 · 22:18 · v0.4 · Fix (T-59)
     Nachtrag zum T-01-Fix unten: der behaltene Sonntag-Eintrag hiess
     schlicht "Sonntag", der Name des Feiertags ging verloren. Die
     Spalte fuer den 03.10.2027 haette also nicht erkennen lassen, dass
     es der Tag der Deutschen Einheit ist -- fuer die Berechnung egal,
     fuer den Menschen am Ausdruck nicht (Feiertagszuschlag). Der Name
     wird jetzt angehaengt: "Sonntag (Tag der Deutschen Einheit)".
     typ bleibt bewusst 'sonntag', daran haengt die
     Nicht-zwei-Sonntage-Regel.
   2026-09-15 · 10:37 · v0.3 · Fix
     T-01 aus dem Kompendium-Code-Abgleich (von Ulf bestätigt und
     gegen bos_zeitkontext_referenz.js exakt datiert: 03./31.10.2027
     und 26.12.2027 -- unabhängig gegengeprüft, keine weiteren Treffer
     bis 2028). ermittleTageImMonat() erzeugte eine Dublette, wenn ein
     Feiertag selbst auf einen Sonntag fiel und offen:true stand -- der
     Tag stand dann zweimal in tage (einmal typ:'sonntag', einmal
     typ:'feiertag'), zählte doppelt gegen maxSonntageProMonat und
     konnte je nach Verarbeitungsreihenfolge zwei unterschiedliche
     Besetzungen für dasselbe Datum liefern. Fix: Feiertag wird nur
     noch aufgenommen, wenn sein Datum nicht schon (als Sonntag) in
     tage steht -- inhaltlich unbedenklich, weil typ:'sonntag' für
     diesen Tag ohnehin wochentag:'so' liefert, exakt das, was der
     Feiertag-Zweig für einen Sonntag ebenfalls berechnet hätte.
   2026-09-23 · 08:23 · v0.5 · Fix (Feiertag-Handhabung, Etappe A)
     Anpassung 1 korrigiert. Bisher bekamen an einem Feiertag nur die
     schicht:'sonntag'-Positionen den echten Wochentag DAZU -- alle
     normalen Positionen mit diesem Wochentag blieben aber aktiv. Ein
     Samstags-Feiertag (03.10.2026) wurde dadurch als kompletter Samstag
     PLUS Sonntags-Positionen besetzt und doppelt gegen die
     Monats-Obergrenze gezählt, parallel zur Mo-Sa-Planung in Entwürfe.
     Neu, nur für typ:'feiertag' (Ulf, E1): aktiv ist eine Position genau
     dann, wenn sie sonntags aktiv ist -- 'so' in tage ODER
     schicht:'sonntag'. Allen anderen wird der Feiertags-Wochentag
     entzogen. Zusätzlich (Ulf, E12, klärt O8): ob eine Person am
     Feiertag einsetzbar ist, entscheidet ihr Sonntag, nicht der echte
     Wochentag -- ihre arbeitstage werden für diesen einen Aufruf
     entsprechend angepasst. Beides reine Eingabe-Anpassung,
     rechenmodul.js bleibt unverändert. Sonntage (auch ein Feiertag auf
     einem Sonntag, typ bleibt 'sonntag', T-01) sind nicht betroffen.
     Doku: 2026-09-23_FEIERTAG_HANDHABUNG.md.
   2026-09-24 · 09:14 · v0.6 · Fix (O56)
     Liegengebliebene Tage verfälschten die Monatszählung. Fall: Oktober
     mit offenem 31.10. gespeichert, dann den 31.10. geschlossen und neu
     gerechnet -- die Spalte verschwand, das Dokument blieb, und
     ladeBaselineFuerMonat() zählte seine Besetzten weiter als "hatte
     schon einen Sonntag" (Obergrenze E3, Pool-Reihenfolge).
     Geklärt: berechneMonat() rechnet IMMER den ganzen Monat
     (ermittleTageImMonat liefert jeden Sonntag und jeden offenen
     Feiertag, sonntagsplan.html reicht die Liste unverändert durch,
     Handänderungen rechnen nicht neu). Die Grundlage aus "anderen Tagen
     des Monats" konnte also nur Tage enthalten, die nicht mehr zum Plan
     gehören.
     Neu: ladeBaselineFuerMonat(monatPrefix, ausgeschlossen, planDaten)
     zählt nur Tage, die zum Plan gehören (planDaten) und nicht gerade
     gerechnet werden. berechneMonat() übergibt den ganzen Monat, die
     Grundlage ist damit leer -- ohne Lesezugriff (spart den Voll-Lesezug
     aus T-43). Ohne planDaten verhält sich die Funktion wie vorher.
     Dazu veralteteTageImMonat(monatPrefix, planDaten): gespeicherte Tage
     des Monats, die nicht mehr zum Plan gehören -- sonntagsplan.html
     löscht sie beim Speichern nach Rückfrage.
   ============================================================ */

window.BOS_SONNTAGSPLAN_BERECHNUNG = (function () {

  function isoDatumAusJsDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function monatsPrefix(iso) { return iso.slice(0, 7); } // 'YYYY-MM'

  // Datum X Tage vor/nach einem ISO-Datum (negativ = vorher).
  function verschobenesDatum(iso, tageVersatz) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + tageVersatz);
    return isoDatumAusJsDate(d);
  }

  /* ==== Tage im gewählten Monat: alle Sonntage + offene Feiertage ==== */
  function ermittleTageImMonat(jahr, monat) {
    var tage = [];
    var d = new Date(jahr, monat, 1);
    while (d.getMonth() === monat) {
      if (d.getDay() === 0) tage.push({ datum: isoDatumAusJsDate(d), typ: 'sonntag', name: 'Sonntag', wochentag: 'so' });
      d.setDate(d.getDate() + 1);
    }

    var promises = [];
    if (window.BOS_FEIERTAGE && window.BOS_ZEITKONTEXT && window.db) {
      var monatStart = isoDatumAusJsDate(new Date(jahr, monat, 1));
      var monatEnde = isoDatumAusJsDate(new Date(jahr, monat + 1, 0));
      window.BOS_FEIERTAGE.feiertage.filter(function (f) { return f.datum >= monatStart && f.datum <= monatEnde; }).forEach(function (f) {
        promises.push(window.BOS_ZEITKONTEXT.status(window.db, f.datum).then(function (st) {
          if (!st.offen) return;
          // T-01 (Kompendium, 15.09.2026): fällt der Feiertag selbst auf
          // einen Sonntag, steht das Datum durch die Sonntag-Schleife
          // oben schon in tage -- ohne diese Prüfung entstünde eine
          // Dublette (zwei Spalten, Tag zählt doppelt gegen die
          // Monats-Obergrenze). Inhaltlich unbedenklich, den Sonntag-
          // Eintrag zu behalten statt einen zweiten Feiertag-Eintrag
          // anzulegen: typ:'sonntag' setzt wochentag ohnehin schon auf
          // 'so', exakt das, was auch der Feiertag-Zweig hier berechnen
          // würde (wd===0 -> 'so') -- keine verlorene Information. Der
          // NAME des Feiertags wird seit 16.09.2026 an den Sonntag-
          // Eintrag angehaengt (T-59).
          // T-59 (16.09.2026): der behaltene Eintrag hiess bisher schlicht
          // "Sonntag" -- die Spalte fuer den 03.10.2027 haette also nicht
          // mehr erkennen lassen, dass es der Tag der Deutschen Einheit
          // ist. Fuer die Berechnung egal, fuer den Menschen am Ausdruck
          // nicht: an so einem Tag faellt Feiertagszuschlag an. Deshalb
          // den Namen anhaengen statt ihn fallen zu lassen. typ bleibt
          // 'sonntag' -- daran haengt die Nicht-zwei-Sonntage-Regel
          // (Anpassung 4), und die soll fuer diesen Tag gelten.
          var schonDa = tage.find(function (t) { return t.datum === f.datum; });
          if (schonDa) {
            if (schonDa.name.indexOf(f.name) === -1) schonDa.name = schonDa.name + ' (' + f.name + ')';
            return;
          }
          var wd = new Date(f.datum + 'T00:00:00').getDay();
          tage.push({ datum: f.datum, typ: 'feiertag', name: f.name, wochentag: ['so','mo','di','mi','do','fr','sa'][wd] });
        }));
      });
    }
    return Promise.all(promises).then(function () {
      tage.sort(function (a, b) { return a.datum.localeCompare(b.datum); });
      return tage;
    });
  }

  /* ==== Monats-Basiszählung (bereits gespeicherte Tage DESSELBEN Monats,
     außer denen, die gerade neu berechnet werden) ==== */
  function ladeBaselineFuerMonat(monatPrefix, ausgeschlosseneDaten, planDaten) {
    // O56 (24.09.2026): mit planDaten zählen nur Tage, die zum Plan gehören
    // und nicht gerade gerechnet werden. Bleibt keiner übrig (der
    // Normalfall, berechneMonat rechnet den ganzen Monat), wird gar nicht
    // erst gelesen.
    if (Array.isArray(planDaten)) {
      var rest = planDaten.filter(function (d) { return ausgeschlosseneDaten.indexOf(d) === -1; });
      if (!rest.length) return Promise.resolve({});
    }
    return window.db.collection('sonntagsplan').get().then(function (snap) {
      var zaehlung = {};
      snap.forEach(function (doc) {
        if (doc.id.slice(0, 7) !== monatPrefix) return;
        if (ausgeschlosseneDaten.indexOf(doc.id) !== -1) return;
        if (Array.isArray(planDaten) && planDaten.indexOf(doc.id) === -1) return; // O56: nicht mehr im Plan
        var daten = doc.data();
        Object.keys(daten.zuweisungen || {}).forEach(function (posId) {
          var pid = daten.zuweisungen[posId];
          if (pid) zaehlung[pid] = (zaehlung[pid] || 0) + 1;
        });
      });
      return zaehlung;
    });
  }

  /**
   * O56 (24.09.2026): gespeicherte Tage des Monats, die nicht mehr zum
   * Plan gehören (z. B. ein Feiertag, der inzwischen geschlossen ist).
   * Nur Dokument-IDs in Datumsform JJJJ-MM-TT mit passendem Monat --
   * Prüfdokumente (pruefung_fremd.html) o. Ä. bleiben unberührt.
   * @returns Promise<[datumISO, ...]> aufsteigend
   */
  function veralteteTageImMonat(monatPrefix, planDaten) {
    return window.db.collection('sonntagsplan').get().then(function (snap) {
      var veraltet = [];
      snap.forEach(function (doc) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.id)) return;
        if (doc.id.slice(0, 7) !== monatPrefix) return;
        if (planDaten.indexOf(doc.id) === -1) veraltet.push(doc.id);
      });
      return veraltet.sort();
    });
  }

  /**
   * Anpassung 1 (Fassung 23.09.2026, E1): Tage einer Position für EINEN
   * Aufruf. An einem Feiertag gilt die Sonntagsbesetzung: aktiv, wer
   * sonntags aktiv ist ('so' in tage oder schicht:'sonntag'), alle
   * anderen verlieren den Feiertags-Wochentag. An einem Sonntag bleibt
   * alles wie bisher. Gibt immer eine neue Liste zurück, die Position
   * selbst wird nicht verändert.
   */
  function tageFuerAufruf(position, tag) {
    var t = (position.tage || []).slice();
    var wt = tag.wochentag;
    var idx = t.indexOf(wt);
    if (tag.typ === 'feiertag') {
      var sonntagsAktiv = position.schicht === 'sonntag' || t.indexOf('so') !== -1;
      if (sonntagsAktiv && idx === -1) t.push(wt);
      if (!sonntagsAktiv && idx !== -1) t.splice(idx, 1);
      return t;
    }
    // Sonntag: unverändertes Verhalten von vor v0.5.
    if (position.schicht === 'sonntag' && idx === -1) t.push(wt);
    return t;
  }

  /**
   * E12 (23.09.2026, klärt O8): am Feiertag entscheidet der Sonntag der
   * Person über ihre Einsetzbarkeit. Nur Personen MIT arbeitstage werden
   * angepasst -- ohne das Feld gilt jede Person an jedem Tag als
   * verfügbar (rechenmodul.js, istEinsetzbar), daran ändert sich nichts.
   */
  function personFuerFeiertag(person, tag) {
    if (tag.typ !== 'feiertag' || !Array.isArray(person.arbeitstage)) return person;
    var a = person.arbeitstage.slice();
    var idx = a.indexOf(tag.wochentag);
    var sonntags = a.indexOf('so') !== -1;
    if (sonntags && idx === -1) a.push(tag.wochentag);
    if (!sonntags && idx !== -1) a.splice(idx, 1);
    return Object.assign({}, person, { arbeitstage: a });
  }

  /**
   * Berechnet einen ganzen Monat. rechenmodul.js bleibt dabei
   * unverändert -- fünf bewusste Eingabe-Anpassungen (siehe
   * sonntagsplan.html-Kopf für die ausführliche Begründung jeder
   * einzelnen):
   *   1. Feiertag = Sonntagsbesetzung: nur sonntags aktive Positionen
   *      ('so' in tage oder schicht:'sonntag'), Einsetzbarkeit nach dem
   *      Sonntag der Person (Fassung 23.09.2026, E1/E12).
   *   2. Monats-Obergrenze (personId.maxSonntageProMonat, sonst
   *      sonntagStandardObergrenze als Fallback).
   *   3. Pool-Rotation nach laufender Monats-Zählung.
   *   4. Nicht zwei Sonntage hintereinander, monatsübergreifend.
   *   5. Übernommene Sonntag-Ablehnungen (aus wunschtag.html, Tab 2).
   *
   * @param {Array} tage - aus ermittleTageImMonat()
   * @param {Array} personenListe
   * @param {Array} positionenListe
   * @param {Array} abwesenheitenListe - Ereignisse, 1:1 aus der
   *        abwesenheiten-Collection
   * @param {number|null} sonntagStandardObergrenze - Fallback für
   *        Personen ohne eigenes maxSonntageProMonat
   * @param {Object} [abgelehnteProDatum] - { datum: { personId: true } },
   *        übernommene Sonntag-Ablehnungen -- siehe sonntagsplan.html
   * @returns {Promise<Array>} [{ tag, zuweisungen, aktivePositionen, luecken }]
   */
  function berechneMonat(tage, personenListe, positionenListe, abwesenheitenListe, sonntagStandardObergrenze, abgelehnteProDatum) {
    abgelehnteProDatum = abgelehnteProDatum || {};
    if (!tage.length) return Promise.resolve([]);
    var monatPrefix = monatsPrefix(tage[0].datum);
    var datumsListe = tage.map(function (t) { return t.datum; });

    // Anpassung 4 braucht ggf. den Sonntag VOR dem gewählten Monat --
    // nur der allererste Sonntag dieses Monats kann einen Vorgänger
    // AUSSERHALB dieser Berechnung haben.
    var ersterSonntag = tage.find(function (t) { return t.typ === 'sonntag'; });
    var vorMonatsDatum = ersterSonntag ? verschobenesDatum(ersterSonntag.datum, -7) : null;
    var vorMonatsLookup = (vorMonatsDatum && datumsListe.indexOf(vorMonatsDatum) === -1)
      ? window.db.collection('sonntagsplan').doc(vorMonatsDatum).get()
      : Promise.resolve(null);

    // O56 (24.09.2026): planDaten = der ganze Monat -> keine Grundlage aus
    // liegengebliebenen Tagen.
    return Promise.all([ladeBaselineFuerMonat(monatPrefix, datumsListe, datumsListe), vorMonatsLookup]).then(function (ergebnisse) {
      var laufendeZaehlung = Object.assign({}, ergebnisse[0]);
      var zuweisungenProDatum = {};
      if (ergebnisse[1] && ergebnisse[1].exists) {
        zuweisungenProDatum[vorMonatsDatum] = ergebnisse[1].data().zuweisungen || {};
      }
      var ergebnisListe = [];

      tage.forEach(function (tag) {
        // Anpassung 4: wer am Sonntag genau 7 Tage vorher gearbeitet
        // hat, gilt für diesen Sonntag als nicht aktiv. Bewusst NUR
        // Sonntag-zu-Sonntag, nicht Feiertag-zu-Sonntag.
        var geschuetzteVom = {};
        if (tag.typ === 'sonntag') {
          var vorherigesDatum = verschobenesDatum(tag.datum, -7);
          var vorherigeZuweisungen = zuweisungenProDatum[vorherigesDatum];
          if (vorherigeZuweisungen) {
            Object.keys(vorherigeZuweisungen).forEach(function (posId) { geschuetzteVom[vorherigeZuweisungen[posId]] = true; });
          }
        }

        // Anpassung 1 + 3: am Feiertag nur sonntags aktive Positionen
        // (tageFuerAufruf, Fassung 23.09.2026), Pool nach laufender
        // Monats-Zählung aufsteigend sortiert (expliziter Index-Tiebreaker
        // statt Sort-Stabilität).
        var positionenFuerAufruf = positionenListe.map(function (p) {
          var t = tageFuerAufruf(p, tag);
          var sortierterPool = (p.pool || []).map(function (id, i) { return { id: id, i: i }; })
            .sort(function (a, b) {
              var diff = (laufendeZaehlung[a.id] || 0) - (laufendeZaehlung[b.id] || 0);
              return diff !== 0 ? diff : a.i - b.i;
            }).map(function (x) { return x.id; });
          return Object.assign({}, p, { tage: t, pool: sortierterPool });
        });

        // Anpassung 2 + 4 + 5: Monats-Obergrenze (eigener Wert oder
        // allgemeiner Standard), Nicht-zwei-hintereinander-Sperre, und
        // übernommene Sonntag-Ablehnung für genau diesen Tag.
        var abgelehnteHeute = abgelehnteProDatum[tag.datum] || {};
        var personenFuerAufruf = personenListe.map(function (pRoh) {
          var p = personFuerFeiertag(pRoh, tag); // E12, nur an Feiertagen wirksam
          if (geschuetzteVom[p.id] || abgelehnteHeute[p.id]) return Object.assign({}, p, { aktiv: false });
          var grenze = p.maxSonntageProMonat != null ? p.maxSonntageProMonat : sonntagStandardObergrenze;
          if (grenze == null) return p;
          var bisher = laufendeZaehlung[p.id] || 0;
          if (bisher >= grenze) return Object.assign({}, p, { aktiv: false });
          return p;
        });

        var ergebnis = berechneTagAlleSchichten(tag.datum, personenFuerAufruf, positionenFuerAufruf, abwesenheitenListe, []);

        // Alle drei Schichten kombinieren -- an einem Sonntag ist
        // 'nacht' normalerweise einfach leer, kostet aber nichts.
        var kombinierteZuweisungen = Object.assign({}, ergebnis.nacht.zuweisungen, ergebnis.frueh.zuweisungen, ergebnis.sonntag.zuweisungen);
        var alleAktivenPositionen = [].concat(ergebnis.nacht.aktivePositionen || [], ergebnis.frueh.aktivePositionen || [], ergebnis.sonntag.aktivePositionen || []);
        var alleLuecken = [].concat(ergebnis.nacht.luecken || [], ergebnis.frueh.luecken || [], ergebnis.sonntag.luecken || []);

        zuweisungenProDatum[tag.datum] = kombinierteZuweisungen;
        Object.keys(kombinierteZuweisungen).forEach(function (posId) {
          var pid = kombinierteZuweisungen[posId];
          laufendeZaehlung[pid] = (laufendeZaehlung[pid] || 0) + 1;
        });

        ergebnisListe.push({ tag: tag, zuweisungen: kombinierteZuweisungen, aktivePositionen: alleAktivenPositionen, luecken: alleLuecken });
      });

      return ergebnisListe;
    });
  }

  return {
    isoDatumAusJsDate: isoDatumAusJsDate,
    monatsPrefix: monatsPrefix,
    verschobenesDatum: verschobenesDatum,
    ermittleTageImMonat: ermittleTageImMonat,
    ladeBaselineFuerMonat: ladeBaselineFuerMonat,
    berechneMonat: berechneMonat,
    // Ergänzt 23.09.2026 (Etappe A), rein additiv -- für die Testsuite.
    tageFuerAufruf: tageFuerAufruf,
    personFuerFeiertag: personFuerFeiertag,
    // Ergänzt 24.09.2026 (O56), rein additiv.
    veralteteTageImMonat: veralteteTageImMonat
  };

})();
