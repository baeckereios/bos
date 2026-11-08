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
 * 08.11.2026, 16:41 — Feature (Produktionsplaner Schritt 2, Go Kontroll-
 *   Chat 08.11., 16:07, E2/E3): NEU rechneBestandMitProduktion() (rein
 *   rechnend) und holeBestandMitProduktion() — Zählung wie holeBestand()
 *   plus die froster_produktion-Einträge des Produkts mit ts NACH dem ts
 *   der Zählung (streng „>“: bei gleichem Zeitstempel ist unklar, ob die
 *   Ware schon gezählt war — nicht addieren ist die sichere Seite, doppelt
 *   gezählt hieße eine Lücke). Nur Einträge in der Einheit des Produkts
 *   (die Zählung selbst trägt keine Einheit; Inventur und Froster-
 *   Produktion nehmen beide cfg.einheit || 'bleche'); andere oder fehlende
 *   Einheit wird nicht addiert und gemeldet. Verglichen wird mit
 *   BOS_PRODUKTE.einheitGleich, wenn der Aufrufer sie mitgibt („bleche“ =
 *   „Blech“), sonst streng (ohne Rand-Leerzeichen, ohne Groß/klein). Abfrage type ==
 *   'froster_produktion' + ts >= Zählzeit (dieselbe Form wie
 *   bos_ziel_berechnung.js, also derselbe Index), legacyKey im Gerät.
 *   holeBestand() UNVERÄNDERT. SESSION_2026-11-08_PRODUKTIONSPLANER_
 *   LETZTER_STAND_BAU.md
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
  },

  // ── 08.11.2026: Bestand = Zählung + Produktion seit der Zählung ─────────
  // Einheit des Produkts wie Inventur und Froster-Produktion sie schreiben
  // (Freitext, Rückfall 'bleche'); verglichen ohne Leerzeichen am Rand und
  // ohne Groß/klein.
  EINHEIT_STANDARD: 'bleche',
  _einheitNorm(e) { return String(e).trim().toLowerCase(); },
  _alsMillis(ts) {
    if (ts === null || ts === undefined) return null;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    return null;
  },

  /**
   * Rein rechnend (in Node prüfbar). zaehlung = Ergebnis von holeBestand().
   * eintraege = froster_produktion-Dokumente (beliebige Produkte).
   * @returns {{zaehlung:number|null, zaehlTs:number|null, frisch:boolean, produktion:number,
   *   gezaehlt:object[], andereEinheit:object[], ohneEinheit:object[], gesamt:number|null}}
   *   gesamt ist null, wenn die Zählung fehlt oder älter als FRISCHE_GRENZE_STUNDEN ist —
   *   dann wird auch keine Produktion aufgerechnet (Regel aus Schritt 1 gilt weiter).
   */
  rechneBestandMitProduktion(zaehlung, eintraege, legacyKey, produktEinheit, einheitGleich) {
    const z = zaehlung || {};
    const frisch = z.veraltet === false && typeof z.bestand === 'number' && typeof z.ts === 'number';
    const r = { zaehlung: (typeof z.bestand === 'number') ? z.bestand : null, zaehlTs: (typeof z.ts === 'number') ? z.ts : null,
                frisch, produktion: 0, gezaehlt: [], andereEinheit: [], ohneEinheit: [], gesamt: null };
    if (!frisch) return r;
    const soll = produktEinheit || this.EINHEIT_STANDARD;
    const gleich = (typeof einheitGleich === 'function') ? einheitGleich
      : (a, b) => this._einheitNorm(a) === this._einheitNorm(b);
    (eintraege || []).forEach((e) => {
      if (!e || e.legacyKey !== legacyKey) return;
      const t = this._alsMillis(e.ts);
      if (t === null || !(t > z.ts)) return;            // streng NACH der Zählung
      const menge = Number(e.menge);
      if (!(menge > 0)) return;
      const eintrag = { menge, ts: t, einheit: e.einheit, eingetragenVon: e.eingetragenVon || null };
      if (e.einheit === undefined || e.einheit === null || String(e.einheit).trim() === '') { r.ohneEinheit.push(eintrag); return; }
      if (!gleich(e.einheit, soll)) { r.andereEinheit.push(eintrag); return; }
      r.gezaehlt.push(eintrag);
      r.produktion += menge;
    });
    r.produktion = Math.round(r.produktion * 100) / 100;
    r.gesamt = z.bestand + r.produktion;
    return r;
  },

  /**
   * Zählung (holeBestand) + Produktion seit der Zählung, mit Fehlern samt Grund.
   * produktEinheit: cfg.einheit || 'bleche' (wie Inventur und Froster-Produktion).
   * einheitGleich: optional BOS_PRODUKTE.einheitGleich.
   * @returns {Promise<object>} alle Felder von holeBestand() und von
   *   rechneBestandMitProduktion(); dazu produktionFehler (Text), falls die
   *   Abfrage der Produktion scheiterte — dann ist gesamt null (lieber einmal
   *   von Hand als ein falscher Bestand).
   */
  async holeBestandMitProduktion(db, legacyKey, produktEinheit, einheitGleich) {
    const z = await this.holeBestand(db, legacyKey);
    const leer = this.rechneBestandMitProduktion(z, [], legacyKey, produktEinheit, einheitGleich);
    if (!leer.frisch) return Object.assign({}, z, leer);
    try {
      const snap = await db.collection('bos_events')
        .where('type', '==', 'froster_produktion')
        .where('ts', '>=', new Date(z.ts))
        .get();
      const eintraege = [];
      snap.forEach((doc) => eintraege.push(doc.data()));
      return Object.assign({}, z, this.rechneBestandMitProduktion(z, eintraege, legacyKey, produktEinheit, einheitGleich));
    } catch (fehler) {
      let text = (fehler && fehler.message) ? fehler.message : String(fehler);
      if (fehler && fehler.code && text.indexOf(fehler.code) < 0) text += ' (' + fehler.code + ')';
      console.warn('BOS_FROSTER.holeBestandMitProduktion: Produktion nicht ladbar.', fehler);
      return Object.assign({}, z, leer, { gesamt: null, produktionFehler: text });
    }
  }
};
