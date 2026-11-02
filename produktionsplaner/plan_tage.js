/* ============================================================
   plan_tage.js — Produktionsplaner: Tagesaufteilung einer Einreichung
   ------------------------------------------------------------
   Eine Mechanik für alle vier Stationsseiten (station_*.html):
   macht aus dem Ergebnis von BOS_KETTE.berechne() die Liste
     tage: [{ datum: 'JJJJ-MM-TT', menge: <Zahl> }]
   die beim Einreichen je Produkt in bos_events
   (type 'produktionsplan_einreichung') mitgeschrieben wird. Die
   Übersicht (uebersicht.html) druckt daraus den Wochenzettel
   nach Tagen.

   Regeln:
   - Nur Tage mit Menge > 0, aufsteigend nach Datum (Reihenfolge der
     Kette).
   - Menge = Math.round(produktion), dieselbe Rundung wie rd() in der
     Station. Heute wirkungslos: alle vier Entstehungswege der
     Tagesproduktion liefern ganze Zahlen (batchSize nie gesetzt → 1,
     Math.ceil bzw. ganze Chargen, parseInt bei Handwerten).
     SESSION_2026-11-02_PRODUKTIONSPLANER_WOCHENZETTEL_BAU.md §3 Fund 1.
   - Datum LOKAL aus getFullYear/getMonth/getDate — nie toISOString
     (zwischen 0 und 1/2 Uhr wäre das der Vortag).
   - Rein rechnend: kein DOM, kein Firestore. bos_produktionskette.js
     wird nicht angefasst, nur sein Ergebnis gelesen.

   Einbindung (Station, gleicher Ordner): <script src="plan_tage.js"></script>
   Export: window.BOS_PLAN_TAGE = { datumLokal, ausKette, summe }

   CHANGELOG
     2026-11-02 · 17:41 · Erstfassung (Wochenzettel nach Tagen, Go
       Kontroll-Chat 02.11., 17:2x).
   ============================================================ */
(function () {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  function datumLokal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function ausKette(result) {
    var tage = [];
    if (!result || !Array.isArray(result.kette)) return tage;
    result.kette.forEach(function (t) {
      var menge = Math.round(t.produktion || 0);
      if (menge > 0 && t.datum instanceof Date) tage.push({ datum: datumLokal(t.datum), menge: menge });
    });
    tage.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });
    return tage;
  }

  function summe(tage) {
    return (tage || []).reduce(function (s, t) { return s + (Number(t.menge) || 0); }, 0);
  }

  window.BOS_PLAN_TAGE = { datumLokal: datumLokal, ausKette: ausKette, summe: summe };
})();
