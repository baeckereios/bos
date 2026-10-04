/**
 * bos_froster.js
 * ------------------------------------------------------------
 * Host-Interpreter für den Frosterbestand: liest die rohen
 * froster_zaehlung-Ereignisse aus Firestore und macht daraus den
 * aktuellen Bestand pro Produkt nutzbar — "eine Host-Funktion,
 * mehrere Aufrufer" (Fundament §5.3), analog zu
 * bos_verbrauch_durchschnitt.js. Erster Aufrufer: der künftige
 * Schnellrechner-Satellit (siehe SESSION_2026-08-31_
 * SCHNELLRECHNER_KONZEPT.md).
 *
 * BEWUSST KLEINER SCOPE (Stand 31.08.2026, mit Ulf abgestimmt):
 * Diese Datei interpretiert AUSSCHLIESSLICH den Bestandswert
 * (zaehlungen[legacyKey]) aus froster_inventur.html. Sie liest
 * NICHT vorbereitungFertig — die Frage "ist der Froster für morgen
 * fertig vorbereitet?" bleibt bewusst eine eigene, lokale
 * Poka-Yoke-Eingabe im jeweiligen Aufrufer (30-Minuten-Cache, kein
 * Firestore-Schreiben). fehlmengeAbs bleibt ebenfalls reine manuelle
 * Eingabe im Aufrufer. Damit ist BOS_BAUSTELLEN.md #9 ("Host-
 * seitiger Handler für type: 'froster_zaehlung', der daraus
 * startBestand/fehlmengeAbs/frosterFertig macht") in der Praxis
 * kleiner als ursprünglich vermerkt — nur startBestand kommt
 * tatsächlich aus dieser Datei.
 *
 * FRISCHE-REGEL — 1:1 aus dem Alt-System übernommen
 * (schnellrechner.html, syncStock()/BOS_INVENTUR.products[key].ts):
 * Der jüngste Zählwert pro legacyKey gilt nur dann als verlässlich,
 * wenn sein Zeitstempel jünger als FRISCHE_GRENZE_STUNDEN ist. Sonst
 * muss der Aufrufer den Bestand manuell abfragen statt ihn
 * automatisch zu übernehmen — gleiche UX wie früher (Warnung + Zwang
 * zur Eingabe).
 *
 * "LETZTER WERT PRO PRODUKT GEWINNT": froster_zaehlung-Dokumente sind
 * append-only, ein einzelnes Dokument kann mehrere Produkte
 * enthalten. holeBestand() sucht — von neu nach alt — im ersten
 * Dokument, das einen Eintrag für den gefragten legacyKey enthält,
 * und nimmt dessen Wert + Zeitstempel. Genau das im Kopf von
 * FROSTER_INVENTUR_DOKU.md skizzierte Verhalten ("Geplantes
 * Host-Verhalten"), hier aber bewusst OHNE eigene, separat gepflegte
 * "aktueller Bestand"-Collection (das Dokument schlägt dort
 * `froster_bestand_aktuell` vor) — wird stattdessen bei jedem Aufruf
 * live aus den Rohdaten berechnet, analog zum Muster in
 * bos_verbrauch_durchschnitt.js. Keine zweite Wahrheit, kein
 * Synchronisationsrisiko, kein Cloud-Function-Bedarf. Sollte die
 * Scan-Menge bei sehr hoher Zählfrequenz irgendwann spürbar werden,
 * ist die separate Collection die dokumentierte Alternative.
 *
 * Kein Composite-Index nötig: nur ein Gleichheitsfilter (type) plus
 * orderBy auf einem anderen Feld (ts) — anders als bei
 * bos_verbrauch_durchschnitt.js (zwei Gleichheitsfilter + orderBy).
 *
 * ZIEL-ABLAGEORT: baeckereios/bos_froster.js (Root-Ebene, geteilte
 * Host-Funktion, kein eigener Satellit). Root nutzt ./bos_froster.js,
 * Unterordner-Satelliten ../bos_froster.js.
 *
 * ÄNDERUNGSPROTOKOLL:
 * 31.08.2026 — Erstversion. holeBestand() aus der Konzept-Session
 *   zum Schnellrechner-Rebuild.
 * ------------------------------------------------------------
 */

window.BOS_FROSTER = {

  // Wie viele froster_zaehlung-Dokumente maximal gescannt werden, bis
  // "kein Wert gefunden" gilt. Zählungen laufen ca. 1x/Tag — 30
  // Dokumente decken großzügig mehr als vier Wochen Historie ab, mehr
  // wird für "nur den jüngsten Wert finden" nie gebraucht.
  MAX_DOKUMENTE_SCAN: 30,

  // Ab wann ein Zählwert als zu alt gilt, um automatisch übernommen zu
  // werden (Stunden). 1:1 aus dem Alt-System übernommen.
  FRISCHE_GRENZE_STUNDEN: 24,

  /**
   * Aktueller Frosterbestand für ein Produkt, aus den rohen
   * froster_zaehlung-Ereignissen berechnet.
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} legacyKey
   * @returns {Promise<{bestand: number|null, ts: number|null, gefunden: boolean, veraltet: boolean, fehlerText: string|undefined}>}
   *   bestand:    letzter gezählter Wert, oder null wenn nie gezählt.
   *   ts:         Zeitstempel dieser Zählung in Millisekunden (epoch),
   *               oder null.
   *   gefunden:   ob überhaupt ein Wert für dieses Produkt existiert.
   *   veraltet:   true, wenn gefunden===false ODER die Zählung älter als
   *               FRISCHE_GRENZE_STUNDEN ist — der Aufrufer sollte in
   *               diesem Fall NICHT automatisch übernehmen, sondern
   *               manuelle Eingabe verlangen (gleiche UX wie im
   *               Alt-System: roter Rahmen + Warnhinweis).
   *   fehlerText: nur gesetzt, wenn die Firestore-Abfrage selbst
   *               fehlgeschlagen ist (z.B. fehlender Index, Rechte-
   *               Problem) — unterscheidet "echter Fehler" von "wurde
   *               einfach noch nie gezählt". Sonst undefined.
   */
  async holeBestand(db, legacyKey) {
    try {
      const snap = await db.collection('bos_events')
        .where('type', '==', 'froster_zaehlung')
        .orderBy('ts', 'desc')
        .limit(this.MAX_DOKUMENTE_SCAN)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        const wert = data.zaehlungen?.[legacyKey];
        if (wert === undefined) continue;

        const tsMillis = data.ts?.toMillis ? data.ts.toMillis() : null;
        // Kein lesbarer Zeitstempel (z. B. serverTimestamp() lokal noch
        // nicht committed) → sicherheitshalber als veraltet behandeln,
        // nicht als frisch — lieber einmal zu viel manuell fragen als
        // einen falschen Bestand automatisch übernehmen.
        const veraltet = tsMillis === null
          ? true
          : (Date.now() - tsMillis) / 3600000 > this.FRISCHE_GRENZE_STUNDEN;

        return { bestand: wert, ts: tsMillis, gefunden: true, veraltet };
      }

      return { bestand: null, ts: null, gefunden: false, veraltet: true };
    } catch (fehler) {
      // Gleiche Haltung wie bos_verbrauch_durchschnitt.js: lieber kein
      // automatischer Bestand als ein falscher. Häufigste Ursache: noch
      // keine froster_zaehlung-Dokumente vorhanden oder Firestore nicht
      // erreichbar.
      //
      // 06.09.2026 · Diagnose-Fix: echte Fehlermeldung zusätzlich als
      // fehlerText zurückgeben, statt sie nur per console.warn zu loggen.
      // Grund: auf dem Handy ist die Konsole praktisch unsichtbar — die
      // Seite zeigte bisher in JEDEM Fehlerfall (fehlender Firestore-
      // Index, Rechte-Problem, Netzwerkfehler, ...) identisch "nie
      // gezählt", ununterscheidbar vom Fall "wurde wirklich noch nie
      // gezählt". Gleiche Lektion wie schon in SESSION_2026-09-05_
      // FROSTER_ZIELE_VOLLDOKU.md §4.3. Der Aufrufer entscheidet, ob/wie
      // er fehlerText anzeigt — reine Zusatzinformation, ändert nichts
      // an gefunden/veraltet/bestand.
      var fehlerText = (fehler && fehler.message) ? fehler.message : String(fehler);
      console.warn('BOS_FROSTER.holeBestand: Abfrage fehlgeschlagen, manuelle Eingabe erforderlich.', fehler);
      return { bestand: null, ts: null, gefunden: false, veraltet: true, fehlerText: fehlerText };
    }
  }
};
