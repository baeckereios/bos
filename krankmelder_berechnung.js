/* ============================================================
   krankmelder_berechnung.js — BäckereiOS SchichtPlaner
   ------------------------------------------------------------
   Berechnungslogik für den Krankmelder (Baustein 3 aus
   SESSION_2026-09-12_KONTO_KRANKMELDER_KONZEPT.md).

   WICHTIG, BEWUSST NUR EIN TAG PRO AUFRUF (Ulf, 12.09.2026 gefragt,
   "da steht gerade für einen Tag... hab ich das falsch verstanden?" —
   nein, aber die Datei allein liest sich missverständlich): diese
   Datei berechnet die Korrektur für GENAU EINEN Tag. Ein mehrtägiger
   Krankheitszeitraum (z. B. "Mittwoch krank, Rest der Woche") deckt
   NICHT diese Datei ab, sondern krankmelder.html — die ruft
   berechneTagKorrektur() in einer SCHLEIFE für JEDEN betroffenen Tag
   des gewählten Von-Bis-Zeitraums einzeln auf (siehe dort,
   Funktion berechnen()) und zeigt jeden Tag als eigene Karte mit
   eigener Strategie-Wahl. Diese Datei kennt den Zeitraum selbst gar
   nicht — bewusst so aufgeteilt: eine kleine, klar testbare
   Berechnungseinheit pro Tag, die Schleife über mehrere Tage ist
   Sache der aufrufenden Seite.

   Korrigiert also (pro Aufruf) EINEN Tag eines bereits OFFIZIELLEN
   Plans, nachdem eine Person für diesen Tag krank gemeldet wurde —
   mit ZWEI Strategien nebeneinander (Ulf, 12.09.2026: "möglichst
   wenig ändern... aber wir sollten uns vor Neusortierung nicht
   verschließen"):

     - 'minimal': alle bestehenden Zuweisungen ANDERER Personen bleiben
       fix (als manuelleZuweisungen an rechenmodul.js gereicht — hat
       dort ohnehin Vorrang vor der Kaskade). Nur die vom Kranken
       hinterlassene(n) Position(en) werden neu zu füllen versucht,
       inklusive Cross-Schicht-Vorschlägen (manuellePruefung), die
       rechenmodul.js dafür ohnehin mitliefert.
     - 'neu': kompletter Neudurchlauf des Tages ohne jede Fixierung
       (leere manuelleZuweisungen) — kann mehr als eine Person
       umsortieren, wenn das ein besseres Ergebnis liefert (weniger
       Lücken).

   BEIDE Strategien nutzen exakt denselben rechenmodul.js-Aufruf
   (berechneTagAlleSchichten), nur mit unterschiedlichem
   manuelleZuweisungen-Argument -- rechenmodul.js selbst bleibt
   vollständig unangetastet, Prinzip "keine stillen Architektur-
   Änderungen" wie überall sonst in diesem Projekt.

   ZWEITEILUNG DES KRANKHEITSZEITRAUMS (Ulf: Enddatum frei wählbar,
   kann über die aktuelle Woche hinausgehen): diese Datei behandelt
   NUR die Korrektur bereits OFFIZIELLER Wochen. Für Tage in noch
   nicht offiziellen (zukünftigen) Wochen reicht ein normaler
   Krankheits-Eintrag in 'abwesenheiten' -- der bestehende Entwürfe/
   Offizieller-Plan-Ablauf berücksichtigt den automatisch, keine
   eigene Logik hier nötig. Diese Aufteilung übernimmt der Aufrufer
   (krankmelder.html), nicht diese Datei.

   Voraussetzung: rechenmodul.js ist vor dieser Datei eingebunden
   (berechneTagAlleSchichten als globale Funktion).

   ERGÄNZT 14.09.2026 (siehe SESSION_2026-09-13_PUNKTESYSTEM_KONZEPT.md
   §10): `findeGuenstigstenWechselVorschlag()` -- für eine Lücke, die
   sich weder minimal noch neu sortiert schließen lässt, ein
   Cross-Schicht-Vorschlag MIT Schichtwechsel (über
   findeTauschKetteMitWechsel() aus rechenmodul.js), der die günstige
   Richtung (Nacht->Früh) vor der teuren (Früh->Nacht) bevorzugt, statt
   blind nach Pool-Rang zu gehen. Nur Richtung, keine Puffer-Genauigkeit
   (bräuchte Kenntnis der Vortage, bewusst nicht gebaut). Nie automatisch
   -- reiner Vorschlag, wie überall sonst in diesem Projekt.

   CHANGELOG
     2026-09-12 · v0.1 · Feature
       Erste Version. berechneTagKorrektur() mit zwei Strategien.
     2026-09-13 · 00:27 · v0.2 · Fix
       Ulf, beim Lesen des Headers: "da steht gerade für einen Tag...
       hab ich das falsch verstanden?" -- Funktionalität war korrekt
       (krankmelder.html ruft diese Datei längst pro Tag in einer
       Schleife auf), aber der Text allein las sich missverständlich.
       Kopf umformuliert, erklärt jetzt klar den Ein-Tag-pro-Aufruf-
       Charakter und wo die Mehrtage-Schleife tatsächlich sitzt.
     2026-09-14 · 18:22 · v0.3 · Feature
       findeGuenstigstenWechselVorschlag() ergänzt -- siehe oben.
   ============================================================ */

window.BOS_KRANKMELDER_BERECHNUNG = (function () {

  /**
   * Baut manuelleZuweisungen aus einem gespeicherten Plan-Tag (siehe
   * offizieller_plan.html für das schlanke tage-Schema), OHNE die
   * kranke Person -- genau die Lücke, die neu gefüllt werden soll,
   * bleibt frei, alles andere ist fix.
   */
  function baueManuelleZuweisungenAusPlanTag(planTag, krankePersonId) {
    var manuell = [];
    ['nacht', 'frueh', 'sonntag'].forEach(function (schicht) {
      var erg = planTag[schicht] || {};
      Object.keys(erg.zuweisungen || {}).forEach(function (posId) {
        var personId = erg.zuweisungen[posId];
        if (personId === krankePersonId) return;
        manuell.push({ personId: personId, positionId: posId, datumISO: planTag.datumISO });
      });
    });
    return manuell;
  }

  /**
   * Berechnet EINEN Tag neu, in einer von zwei Strategien.
   *
   * @param {Object} planTag - der betroffene Tag aus dem offiziellen
   *        Plan (plaene/<Montag>.tage[i]), inkl. datumISO
   * @param {string} krankePersonId
   * @param {Array} personenListe
   * @param {Array} positionenListe
   * @param {Array} ereignisse - bestehende Ereignisse INKLUSIVE des
   *        neuen, bindenden Krankheits-Ereignisses für diesen Tag
   *        (baut der Aufrufer, nicht diese Funktion -- sie kennt den
   *        Zeitraum der Krankmeldung nicht)
   * @param {string} strategie - 'minimal' | 'neu'
   * @returns {Object} Ergebnis von berechneTagAlleSchichten (siehe
   *        rechenmodul.js) -- { nacht, frueh, sonntag, ueberzaehlig,
   *        lehrschicht }
   */
  function berechneTagKorrektur(planTag, krankePersonId, personenListe, positionenListe, ereignisse, strategie) {
    var manuelleZuweisungen = strategie === 'minimal'
      ? baueManuelleZuweisungenAusPlanTag(planTag, krankePersonId)
      : [];
    return berechneTagAlleSchichten(planTag.datumISO, personenListe, positionenListe, ereignisse, manuelleZuweisungen);
  }

  /**
   * Zählt Lücken eines Tagesergebnisses (nacht+frueh+sonntag
   * zusammen) -- für den Vergleich der beiden Strategien.
   */
  function zaehleLuecken(tagesErgebnis) {
    return ['nacht', 'frueh', 'sonntag'].reduce(function (summe, schicht) {
      return summe + ((tagesErgebnis[schicht] || {}).luecken || []).length;
    }, 0);
  }

  /**
   * ERGÄNZT 14.09.2026 (siehe Kopf-Kommentar-Nachtrag unten). Sucht für
   * EINE verbleibende Lücke einen Cross-Schicht-Vorschlag MIT
   * Schichtwechsel -- über `findeTauschKetteMitWechsel()` aus
   * rechenmodul.js, mit `guenstigenWechselBevorzugen=true`: bevorzugt
   * die günstige Richtung (Nacht->Früh bzw. gar kein Wechsel nötig) vor
   * der teuren (Früh->Nacht), statt blind nach Pool-Rang zu gehen (Ulfs
   * Fund: "läuft das System mit den Punkten aus dem normalen System...
   * wirklich effizient und richtig?" -- bisher nein). Reine Richtung,
   * KEINE Puffer-Genauigkeit (bräuchte Kenntnis der Vortage -- Weg 2 aus
   * demselben Gespräch, bewusst nicht gebaut, siehe
   * SESSION_2026-09-13_PUNKTESYSTEM_KONZEPT.md §10).
   *
   * NIE AUTOMATISCH -- reiner Vorschlag, wie jeder Schichtwechsel in
   * diesem Projekt. Der Aufrufer (krankmelder.html) zeigt das Ergebnis
   * zur Bestätigung an, wendet es nicht selbst an.
   *
   * @param tagesErgebnis - Ergebnis von berechneTagAlleSchichten() für
   *   den betroffenen Tag (egal welche Strategie, beide liefern
   *   dieselbe Struktur inkl. aktivePositionen/verplantHeute pro Schicht)
   * @param positionId - die offene Position, für die ein Vorschlag
   *   gesucht wird
   * @returns { positionId, personId, schritte, wechselVerbraucht } oder
   *   null, wenn keine Kette gefunden wurde
   */
  function findeGuenstigstenWechselVorschlag(tagesErgebnis, positionId, personenListe, datumISO, ereignisse) {
    var personenById = {};
    personenListe.forEach(function (p) { personenById[p.id] = p; });
    var schichten = ['nacht', 'frueh', 'sonntag'];
    for (var i = 0; i < schichten.length; i++) {
      var erg = tagesErgebnis[schichten[i]];
      if (!erg || !erg.aktivePositionen) continue;
      if (!erg.aktivePositionen.some(function (p) { return p.id === positionId; })) continue;
      var kette = findeTauschKetteMitWechsel(positionId, erg.aktivePositionen, erg.zuweisungen, personenById, datumISO, ereignisse, erg.verplantHeute, undefined, true);
      if (!kette) return null;
      return {
        positionId: positionId,
        personId: kette.zuweisungen[positionId],
        schritte: kette.schritte,
        wechselVerbraucht: kette.wechselVerbraucht
      };
    }
    return null;
  }

  return {
    baueManuelleZuweisungenAusPlanTag: baueManuelleZuweisungenAusPlanTag,
    berechneTagKorrektur: berechneTagKorrektur,
    zaehleLuecken: zaehleLuecken,
    findeGuenstigstenWechselVorschlag: findeGuenstigstenWechselVorschlag
  };

})();
