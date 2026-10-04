/* ================================================================
   BäckereiOS V2 · bos_ziel_berechnung.js
   ================================================================
   ZWECK: Rechnet den Ziel-Fortschritt pro Produkt aus drei bereits
   existierenden Ereignis-Typen zusammen — keine eigene, neue
   Kette-Berechnung, nur Zusammenführung von bereits vorliegenden
   Zahlen:
     - produktionsplan_einreichung.produkte[legacyKey].gesamtProduktion
       → Basis-Ziel, von der jeweiligen Stationsseite bereits mit
         BOS_KETTE.berechne() fertig gerechnet.
     - produktionsplan_nachtrag → Zusatzbedarf, der NACH der Einreichung
       entstanden ist (spontane Kundenbestellung o.ä.), fließt nie von
       selbst in gesamtProduktion ein (siehe Chat-Klärung 05.09.2026).
     - froster_produktion → bereits eingetragene Ist-Produktion.

   VERFALLS-PRINZIP (identisch zur Regel zwischen froster_produktion und
   froster_zaehlung, siehe SESSION_2026-09-03_FROSTER_PRODUKTION_ZIEL_
   KONZEPT.md): Nachtrag- und Produktions-Ereignisse zählen nur, wenn
   ihr Zeitstempel NACH der aktuell gültigen Einreichung liegt. Ältere
   Ereignisse sind entweder schon im Startbestand der Einreichung
   berücksichtigt oder durch eine neuere Einreichung überholt — kein
   Sonderfall, nur ein Zeitstempel-Filter.

   BEWUSST NICHT HIER: kein Aufruf von bos_produktionskette.js. Dieses
   Modul liest nur fertige Zahlen, rechnet die Kette nicht neu.

   AUFRUFER: froster/ziele.html, froster/froster_produktion.html (v0.3+)

   CHANGELOG
     2026-09-05 · v0.1 · Feature — Erste Version.
     2026-09-06 · v0.2 · Fix — montagDerWoche() lieferte den Montag der
       KALENDERWOCHE, die das übergebene Datum enthält — an einem Fr/Sa/So
       (Planungsfenster läuft Fr 00:01–Di 23:59) damit eine ganze Woche zu
       früh, weil an diesen Tagen bereits für die KOMMENDE Woche eingereicht
       wird. Exakt derselbe Bug, der am 05.09.2026 in den vier
       Produktionsplaner-Stationsseiten gefunden und dort über
       planWocheMontag() behoben wurde (siehe SESSION_2026-09-05_
       PRODUKTIONSPLANER_WOCHENANKER_FIX.md) — hier beim Bau dieser Datei
       am selben Tag nicht mitgezogen. Symptom: ziele.html zeigte "noch
       keine Einreichung diese Woche" für alle Stationen, obwohl frisch
       eingereicht war — wocheIso zeigte schlicht auf die falsche Woche.
       Fix: identische Berechnung wie planWocheMontag() übernommen (Montag
       der Planungswoche = Tag vor dem Dienstag, an dem das aktuell
       laufende Fenster schließt), inklusive der dafür nötigen
       naechsterDienstag()-Hilfsfunktion. Name/Signatur von
       montagDerWoche() unverändert — kein Breaking Change für
       froster_produktion.html, das dieselbe Funktion nutzt (dort bitte
       trotzdem einmal gegenprüfen, lag in dieser Runde nicht vor).
       Details: SESSION_2026-09-06_FROSTER_BESTAND_STATIONEN_FIX.md.
     2026-09-06 · v0.3 · Fix — ladeWoche(): untere Zeitgrenze für
       froster_produktion war "montag" (Start der Zielwoche), fiel damit
       genau in die Fr–Di-Planungsfensterlücke, die v0.2 erst korrekt
       sichtbar gemacht hat. Auf Planungsfenster-Start (Freitag 00:01,
       3 Tage vor "montag") vorgezogen. Details siehe Kommentar bei
       ladeWoche().
   ================================================================ */
(function (global) {

  // Planungsfenster: Fr 00:01–Di 23:59 (identisch zu den vier
  // Produktionsplaner-Stationsseiten, dort bewusst dupliziert statt
  // gemeinsam ausgelagert — hier ausnahmsweise doch gemeinsam, weil
  // bos_ziel_berechnung.js ohnehin schon ein geteiltes Modul ist).
  function naechsterDienstag(von) {
    var d = new Date(von);
    var tag = (d.getDay() + 6) % 7;
    var diff = (2 - 1 - tag + 7) % 7;
    d.setDate(d.getDate() + diff);
    d.setHours(23, 59, 0, 0);
    if (d < von) d.setDate(d.getDate() + 7);
    return d;
  }

  function montagDerWoche(datum) {
    var mo = naechsterDienstag(new Date(datum));
    mo.setDate(mo.getDate() - 1);
    mo.setHours(0, 0, 0, 0);
    return mo;
  }

  function isoDatum(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function alsMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return 0;
  }

  function alsDatum(ts) {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts instanceof Date) return ts;
    return null;
  }

  var WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  function formatTag(d) {
    return WT_KURZ[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.';
  }

  /* Lädt alle drei Ereignis-Typen für eine Woche parallel und bereitet
     sie so auf, dass berechneProdukt()/berechneStation() ohne weiteren
     Firestore-Zugriff arbeiten können. */
  function ladeWoche(db, wocheIso) {
    var montag = new Date(wocheIso + 'T00:00:00');
    // 06.09.2026 · Fix (v0.3): untere Grenze für froster_produktion war
    // bisher "montag" (Start der ZIELWOCHE) — Einreichung UND erste
    // Produktions-Einträge passieren aber typischerweise schon während des
    // Fr–Di-Planungsfensters DAVOR, also vor diesem Montag (z.B. Einträge
    // an einem Sonntag für die kommende Woche). Mit "montag" als Grenze
    // fielen solche frühen, eigentlich gültigen Einträge aus der Firestore-
    // Abfrage komplett raus, obwohl das Verfalls-Prinzip in
    // berechneProdukt() (ts > einreichungMillis) sie korrekt gezählt hätte
    // — sie kamen dort nie an. Vor dem montagDerWoche()-Fix (v0.2) fiel das
    // nicht auf, weil "montag" damals eine ganze Woche in der Vergangenheit
    // lag und dadurch jeden halbwegs aktuellen Eintrag ohnehin durchließ.
    // Symptom: frisch eingetragene Produktion zeigte "0 / X bleche" statt
    // des echten Zwischenstands. Fix: Grenze auf den tatsächlichen Start
    // des Planungsfensters vorgezogen (Freitag 00:01 vor dieser Zielwoche
    // — 3 Tage vor "montag", identisch zur planungsfenster()-Berechnung in
    // den Stationsseiten). Reine Vorab-Eingrenzung für die Abfrage, keine
    // fachliche Änderung — die exakte Filterung bleibt weiterhin
    // berechneProdukt()s Verfalls-Prinzip.
    var fensterStart = new Date(montag);
    fensterStart.setDate(fensterStart.getDate() - 3);
    fensterStart.setHours(0, 1, 0, 0);
    return Promise.all([
      db.collection('bos_events').where('type', '==', 'produktionsplan_einreichung').where('woche', '==', wocheIso).get(),
      db.collection('bos_events').where('type', '==', 'produktionsplan_nachtrag').where('woche', '==', wocheIso).get(),
      db.collection('bos_events').where('type', '==', 'froster_produktion').where('ts', '>=', fensterStart).get()
    ]).then(function (results) {
      var einreichungenSnap = results[0], nachtragSnap = results[1], produktionSnap = results[2];

      // Mehrfaches Einreichen ist möglich — pro Station nur die neueste behalten.
      var einreichungProStation = {};
      einreichungenSnap.forEach(function (doc) {
        var d = doc.data();
        var bestehend = einreichungProStation[d.station];
        if (!bestehend || alsMillis(d.ts) > alsMillis(bestehend.ts)) {
          einreichungProStation[d.station] = d;
        }
      });

      var nachtraege = [];
      nachtragSnap.forEach(function (doc) { nachtraege.push(doc.data()); });

      var produktionen = [];
      produktionSnap.forEach(function (doc) { produktionen.push(doc.data()); });

      return { einreichungProStation: einreichungProStation, nachtraege: nachtraege, produktionen: produktionen };
    });
  }

  /* Ergebnis für EIN Produkt einer Station. null, wenn diese Station für
     dieses Produkt diese Woche noch nichts eingereicht hat. */
  function berechneProdukt(kontext, station, legacyKey) {
    var einreichung = kontext.einreichungProStation[station];
    if (!einreichung || !einreichung.produkte || !einreichung.produkte[legacyKey]) return null;
    var p = einreichung.produkte[legacyKey];
    var einreichungMillis = alsMillis(einreichung.ts);

    var passendeNachtraege = kontext.nachtraege.filter(function (n) {
      return n.legacyKey === legacyKey && n.station === station && alsMillis(n.ts) > einreichungMillis;
    });
    var nachtragSumme = passendeNachtraege.reduce(function (sum, n) { return sum + (n.menge || 0); }, 0);

    var produziert = kontext.produktionen
      .filter(function (e) { return e.legacyKey === legacyKey && alsMillis(e.ts) > einreichungMillis; })
      .reduce(function (sum, e) { return sum + (e.menge || 0); }, 0);

    var basis = p.gesamtProduktion || 0;
    var ziel = basis + nachtragSumme;
    var offen = Math.max(0, ziel - produziert);
    var erfuellt = ziel > 0 && produziert >= ziel;

    var zielDatum = null, zielLabel = '';
    var einreichungDatum = alsDatum(einreichung.ts);
    if (einreichungDatum && typeof p.zielOff === 'number') {
      zielDatum = new Date(einreichungDatum);
      zielDatum.setDate(zielDatum.getDate() + p.zielOff);
      zielLabel = formatTag(zielDatum);
    }

    return {
      legacyKey: legacyKey,
      name: p.name || legacyKey,
      station: station,
      basis: basis,
      nachtragSumme: nachtragSumme,
      nachtraege: passendeNachtraege,   // Rohdaten für Detail-Aufklapp (menge, eingetragenVon, ts)
      ziel: ziel,
      produziert: produziert,
      offen: offen,
      erfuellt: erfuellt,
      zielDatum: zielDatum,
      zielLabel: zielLabel
    };
  }

  /* Ergebnisse für ALLE Produkte einer Station (aus deren letzter Einreichung). */
  function berechneStation(kontext, station) {
    var einreichung = kontext.einreichungProStation[station];
    if (!einreichung || !einreichung.produkte) return [];
    return Object.keys(einreichung.produkte)
      .map(function (legacyKey) { return berechneProdukt(kontext, station, legacyKey); })
      .filter(Boolean);
  }

  global.BOS_ZIEL = {
    montagDerWoche: montagDerWoche,
    isoDatum: isoDatum,
    formatTag: formatTag,
    ladeWoche: ladeWoche,
    berechneProdukt: berechneProdukt,
    berechneStation: berechneStation
  };

})(window);
