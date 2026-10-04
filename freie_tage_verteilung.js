/**
 * freie_tage_verteilung.js — SchichtPlaner V2
 *
 * 2026-10-04 · 14:39 · Online-Gang: Nachnamen von Kollegen in den
 * Kommentaren dieser Datei durch Platzhalter („Person K“ usw.) ersetzt —
 * das Repo wird öffentlich. Nur Kommentare, kein Code. Zuordnung kennt
 * Ulf; siehe 2026-10-04_ONLINE_GANG.md.
 *
 * Verteilt den REGULÄREN freien Tag (§3: grund 'freierTag') über eine
 * Woche (Mo–Sa) für alle Personen mit fester Stammschicht. Das ist die
 * eigentliche "Kunst"-Aufgabe, die im alten Rechner hunderte Durchläufe
 * brauchte (Audit §1) — im Gegensatz zur reinen Tageszuweisung in
 * rechenmodul.js, die für sich genommen kein hartes Problem ist.
 *
 * Ansatz: viele randomisierte Versuche, jeder komplett durch die echte
 * Kaskade aus rechenmodul.js gerechnet, dann der Versuch mit den
 * wenigsten Lücken (und den meisten erfüllten Wunschtagen als
 * Tie-Breaker) gewählt — genau das Prinzip, das V1 schon hatte.
 *
 * ÄNDERUNG 16.09.2026 (T-68, Ulfs ausdrückliche Freigabe, Backup durch
 * Ulf): Konto-Rückkopplung. Der normalisierte Kontostand
 * (`saldo / wochenGezaehlt` aus `konten/<personId>`) fließt als
 * zusätzlicher Posten in `gesamtKosten` ein. Rein additiv: ohne
 * `optionen.kontoDaten` ist der Posten exakt 0 und jedes bisherige
 * Verhalten unverändert. Siehe KONTO_AUSGLEICH_GEWICHT unten für die
 * vollständige Begründung, insbesondere warum der Term mit dem Wert des
 * zugeteilten Tages multipliziert werden MUSS.
 *
 * ÄNDERUNG 16.09.2026 (T-10, dieselbe Freigabe/Backup-Runde): zweiter,
 * getrennter Posten für offene Einsprünge (freieTageSchuld) --
 * SCHULD_AUSGLEICH_GEWICHT, 14. einstellbares Gewicht. Ebenfalls rein
 * additiv.
 *
 * ÄNDERUNG 23.09.2026, 09:08 (Etappe B der Feiertag-Sonntag-Regeln,
 * Ulfs ausdrückliche Freigabe vom 23.09., 07:57, Backup durch Ulf;
 * SCHICHTPLANER_V2_FEIERTAG_SONNTAG_REGELN.md): Zählregel E9, K1,
 * "am Stück" E13/E14, feste Form der Versuche P1. Alles hängt an der
 * NEUEN, optionalen Eingabe `optionen.freieTageSoll` (personId -> Zahl,
 * vom Aufrufer nach E9 berechnet). Ohne sie ist jedes Ergebnis exakt
 * wie vorher (Testsuite test_feiertagswoche_verteilung.js vergleicht
 * mit festgeklemmtem Zufall gegen die alte Fassung).
 *   - Mit Soll fällt eine Person wegen 'feiertag' nicht mehr per ja/nein
 *     aus der Rotation. Rest = Soll minus freie Feiertage der Woche
 *     (Mo-Sa). Rest 0: raus, Rest 1: ein Platz wie bisher, Rest >= 2:
 *     zusätzliche Plätze. Urlaub/Krankheit bleiben ja/nein (E10).
 *   - Plätze: der erste Platz einer Person hat als Schlüssel ihre
 *     personId (wie bisher), weitere `personId#2`, `#3` ... in DERSELBEN
 *     Zuordnung, also derselben Suche (O3, Falle vom 13.09.).
 *   - P1: Versuche werden in eine feste Form gebracht (die frei
 *     wählbaren Tage einer Person aufsteigend auf ihre Plätze), nach dem
 *     Würfeln und nach jedem Schritt der lokalen Suche.
 *   - E13/E14: neuer Posten `stueckKosten` = (Stücke - 1) *
 *     FREIE_TAGE_GETRENNT_PUNKTE je Person; gezählt werden ihre freien
 *     Tage der Woche einschließlich freier Feiertage. Ein einziger
 *     freier Tag ist immer ein Stück, normale Wochen kosten also 0.
 * NACHTRAG 23.09.2026, 09:56 (Befund B1 des Kontroll-Chats): Mit Soll
 * bleibt ein Platz, für den kein erlaubter Tag übrig ist, LEER und steht in
 * nichtVergebenePlaetze -- auch der erste Platz. Vorher landete er auf
 * irgendeinem Tag, den kein anderer Platz der Person hatte, auch auf
 * Schule, Handzuweisung oder dem gearbeiteten Feiertag, und das
 * Rückgabefeld blieb leer. Ohne Soll: altes Verhalten (Zufallstag).
 * Die Konto-Rückkopplung in Feiertagswochen (E18) wird vom AUFRUFER
 * abgeschaltet (keine kontoDaten übergeben), nicht hier.
 * Personen-IDs dürfen kein '#' enthalten (wird mit Soll geprüft).
 *
 * Bewusst NICHT enthalten (siehe SESSION_2026-09-05_SCHICHTPLANER_V2_KONZEPT.md):
 *   - Sonntag — eigene Logik (§6), nicht Teil dieser Mo–Sa-Rotation
 *   - ~~Der Feiertagswoche-Sonderfall~~ seit 23.09.2026 über
 *     `freieTageSoll` abgedeckt, siehe oben
 *
 * Korrektur 09.09.2026 (Ulf): Produktionshelfer waren bis hier von der
 * wöchentlichen freien-Tage-Rotation ausgenommen (`stammschicht:
 * 'flexibel'`). Jetzt nicht mehr — sie bekommen wie alle anderen eine
 * echte Stammschicht und nehmen genauso an der Rotation teil, statt
 * implizit an jedem Tag einsatzbereit zu sein.
 *
 * Erwartet dieselben Personen-/Positionen-Formate wie rechenmodul.js.
 * Voraussetzung: rechenmodul.js ist vor dieser Datei eingebunden (als
 * <script> im Browser) bzw. wird per require() geladen (Node/Test).
 */

(function (global) {
  const R = (typeof module !== 'undefined' && module.exports)
    ? require('./rechenmodul.js')
    : global; // im Browser hängen die Funktionen direkt an window

  const MO_BIS_SA = ['mo', 'di', 'mi', 'do', 'fr', 'sa'];

  // Ergänzt 09.09.2026 (Ulf: "einen Schalter, der die Wichtigkeit
  // anhebt, für z. B. Arzttermine") — Gewicht, mit dem ein als
  // "wichtig" markierter Wunschtag gegenüber einem normalen in der
  // Bewertung zählt. Wirkt NUR als Tie-Breaker unter Wunschtagen
  // selbst (letzte von drei Stufen) — kann niemals eine Lücke oder
  // einen Wochentag-Überschuss aufwiegen, das bleibt unangetastet
  // (Ulf, nach kurzer Rückfrage: "gegen alle Widrigkeiten" hätte
  // bedeutet, dass eine Lücke lautlos in Kauf genommen wird, das
  // wollte er nicht). Reine Zahl, keine Architekturfrage — bei Bedarf
  // jederzeit änderbar.
  // Ergänzt 14.09.2026: `let` statt `const` -- überschreibbar über
  // setzeGewichte(), siehe dort für die vollständige Begründung.
  let WICHTIG_GEWICHT = 5;

  /**
   * Gründe, die den wöchentlichen Ruheanspruch tatsächlich ERSETZEN —
   * wer schon einen dieser Gründe in der Woche hat, braucht keinen
   * separaten freierTag mehr (§3: "ist immer Person gesperrt").
   * Andere Sperrtage (Schule, Termine — grund 'schule'/'sperrtag')
   * sind KEIN Ersatz dafür (05.09.2026, Ulfs Korrektur): sie blockieren
   * zwar einen Tag, sind aber keine Ruhe — der freie Tag steht
   * trotzdem weiterhin zu, nur eben an einem ANDEREN Tag.
   *
   * 'pausiert' entfernt (09.09.2026, Ulf) — hatte nur einen einzigen
   * Anwendungsfall, der jetzt sauberer über die statische
   * Personen-Eigenschaft `gesperrteSchichten` gelöst ist statt über
   * ein datumsgebundenes Ereignis.
   *
   * 'feiertag' ergänzt (09.09.2026, Ulf) — echter Fehler, kein
   * Grenzfall: wer an einem Feiertag nicht arbeiten muss, hat dadurch
   * schon einen freien Tag — genau wie bei Urlaub/Krankheit braucht
   * es dann KEINEN zusätzlichen, separat verteilten freien Tag in
   * derselben Woche mehr. Ohne diesen Eintrag hätte die Rotation
   * fälschlich noch einen zweiten freien Tag drangehängt. Betrifft
   * nur Personen mit einem eigenen `grund: 'feiertag'`-Ereignis.
   * KORRIGIERT 23.09.2026 (O9): Der frühere Verweis auf
   * findeZusaetzlichenFreienTag/wendeWochenAusgleichAn zeigte auf die
   * Spielwiese; diese Funktionen gibt es in V2 nicht. Mit
   * `optionen.freieTageSoll` wird 'feiertag' seit 23.09. gezählt statt
   * per ja/nein ausgewertet, siehe rotationsplaetze().
   */
  const ERSETZENDE_GRUENDE = ['urlaub', 'krankheit', 'feiertag'];

  function hatErsetzendeAbwesenheit(personId, datumISO, ereignisse) {
    return ereignisse.some(e =>
      e.personId === personId && e.bindend &&
      ERSETZENDE_GRUENDE.includes(e.grund) &&
      e.von <= datumISO && datumISO <= e.bis
    );
  }

  /**
   * Datum + 1 Kalendertag, in UTC (siehe rechenmodul.js).
   */
  function naechsterTag(datumISO) {
    const d = new Date(datumISO + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Sucht einen Sperrtag (grund 'schule' oder 'sperrtag') mit Flag
   * `folgtFreierTag: true`, dessen Folgetag innerhalb der angezeigten
   * Woche liegt — typischer Fall: Donnerstag Schule, Freitag MUSS sein
   * freier Tag sein, keine freie Auswahl mehr für diese Person.
   */
  function erzwungenerFreierTag(personId, wochenStartISO, ereignisse) {
    const tage = wochentageMoSa(wochenStartISO);
    for (const e of ereignisse) {
      if (e.personId !== personId || !e.folgtFreierTag) continue;
      if (e.grund !== 'schule' && e.grund !== 'sperrtag') continue;
      const folgetag = naechsterTag(e.bis);
      if (tage.includes(folgetag)) return folgetag;
    }
    return null;
  }

  /**
   * Montag-Datum (ISO) -> die sechs Mo-Sa-Daten dieser Woche.
   * Rechnet bewusst komplett in UTC (siehe rechenmodul.js,
   * parseISO/formatISO) — sonst verschiebt sich das Datum in
   * Zeitzonen östlich von UTC (z. B. Deutschland) um einen Tag.
   */
  function wochentageMoSa(wochenStartISO) {
    const start = new Date(wochenStartISO + 'T00:00:00Z');
    const tage = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      tage.push(d.toISOString().slice(0, 10));
    }
    return tage;
  }

  /**
   * Personen, für die diese Woche ein freierTag entschieden werden
   * muss: aktiv, bei Azubis zusätzlich einsatzfähig — UND keine
   * ERSETZENDE Abwesenheit (Urlaub/Krankheit) in der Woche. Ein reiner
   * Sperrtag wie Schule zählt NICHT als Ersatz (s. o.) — solche
   * Personen bleiben in der Rotation, brauchen also weiterhin einen
   * echten freien Tag.
   *
   * Korrektur 09.09.2026 (Ulf, Wunschtag-Häufungs-Fall): weder der
   * frühere `stammschicht === 'flexibel'`-Ausschluss noch der
   * Status-Filter auf nur `mitarbeiter`/`azubi` gelten noch —
   * Produktionshelfer nehmen jetzt genau wie alle anderen an der
   * wöchentlichen Rotation teil und bekommen einen echten freien Tag,
   * statt implizit als immer verfügbar zu gelten.
   *
   * AUSNAHME (05.09.2026, fester Mo–Fr-Fall ohne Wochenend-Rotation):
   * hat eine Person `arbeitstage` mit 5 oder weniger Einträgen, ist ihr
   * Wochenmuster damit schon vollständig beschrieben (z. B. fest
   * Mo–Fr, immer Sa+So frei) — sie braucht keinen zusätzlichen Tag aus
   * der Rotation mehr und fällt hier bewusst raus. Jemand mit 6
   * Arbeitstagen (Mo–Sa, aber nur 5 davon
   * tatsächlich Arbeit) bleibt dagegen in der Rotation — für ihn muss
   * ja noch entschieden werden, WELCHER der 6 Tage frei wird.
   *
   * ZWEITE AUSNAHME (09.09.2026, echt-6-Tage-Fall): manche Personen
   * arbeiten wirklich an allen 6 (oder 7) markierten Tagen durch, ohne
   * dass ein zusätzlicher freier Tag nötig wäre (in der Praxis: jeden
   * Tag nur wenige Stunden) — die reine Tage-Anzahl reicht hier nicht,
   * um das zu erkennen. `keinRotierenderFreierTag` (explizit gesetzt,
   * unabhängig von der Arbeitstage-Anzahl) deckt diesen Fall ab.
   */
  function rotationspersonen(personen, wochenStartISO, ereignisse) {
    const tage = wochentageMoSa(wochenStartISO);
    return personen.filter(p => {
      if (!nimmtGrundsaetzlichTeil(p)) return false;
      const hatErsatz = tage.some(t => hatErsetzendeAbwesenheit(p.id, t, ereignisse));
      return !hatErsatz;
    });
  }

  // Herausgelöst 23.09.2026 aus rotationspersonen() (unverändert), damit
  // rotationsplaetze() dieselben Filter nutzt statt einer Kopie.
  function nimmtGrundsaetzlichTeil(p) {
    if (!p.aktiv) return false;
    if (p.status === 'azubi' && !p.einsatzfaehig) return false;
    if (p.keinRotierenderFreierTag) return false;
    if (p.arbeitstage && p.arbeitstage.length <= 5) return false; // E11: Mo-Fr-Kräfte bleiben draußen
    return true;
  }

  // ===== Etappe B, 23.09.2026: Plätze, Zählregel E9, feste Form P1 =====

  /** Schlüssel eines Platzes -> personId ('P08#2' -> 'P08'). */
  function personIdVonSchluessel(schluessel) {
    const i = String(schluessel).indexOf('#');
    return i === -1 ? schluessel : schluessel.slice(0, i);
  }

  function istFreierFeiertag(personId, datumISO, ereignisse) {
    return ereignisse.some(e =>
      e.personId === personId && e.bindend && e.grund === 'feiertag' &&
      e.von <= datumISO && datumISO <= e.bis
    );
  }

  /** Wie viele Tage Mo-Sa hat die Person über grund 'feiertag' frei? */
  function anzahlFreieFeiertage(personId, wochenStartISO, ereignisse) {
    return wochentageMoSa(wochenStartISO).filter(t => istFreierFeiertag(personId, t, ereignisse)).length;
  }

  /**
   * Plätze der Rotation. Ohne `freieTageSoll` genau rotationspersonen(),
   * je Person ein Platz mit ihrer personId als Schlüssel. Mit Soll (E9):
   * Urlaub/Krankheit weiter ja/nein (E10); 'feiertag' wird gezählt,
   * Rest = Soll - freie Feiertage; so viele Plätze. Personen ohne
   * Eintrag im Soll behalten die alte Regel.
   * Liefert Kopien der Personen mit zusätzlichem Feld `platzSchluessel`.
   */
  function rotationsplaetze(personen, wochenStartISO, ereignisse, freieTageSoll) {
    if (!freieTageSoll) {
      return rotationspersonen(personen, wochenStartISO, ereignisse)
        .map(p => Object.assign({}, p, { platzSchluessel: p.id }));
    }
    const tage = wochentageMoSa(wochenStartISO);
    const ergebnis = [];
    for (const p of personen) {
      if (String(p.id).indexOf('#') !== -1) {
        throw new Error('Personen-ID "' + p.id + '" enthält "#" -- mit freieTageSoll nicht zulässig (Platz-Schlüssel).');
      }
      const soll = freieTageSoll[p.id];
      if (soll === undefined || soll === null) {
        if (rotationspersonen([p], wochenStartISO, ereignisse).length) ergebnis.push(Object.assign({}, p, { platzSchluessel: p.id }));
        continue;
      }
      if (!nimmtGrundsaetzlichTeil(p)) continue;
      const urlaubOderKrank = tage.some(t => ereignisse.some(e =>
        e.personId === p.id && e.bindend && (e.grund === 'urlaub' || e.grund === 'krankheit') &&
        e.von <= t && t <= e.bis));
      if (urlaubOderKrank) continue; // E10: unverändert ja/nein
      const rest = Number(soll) - anzahlFreieFeiertage(p.id, wochenStartISO, ereignisse);
      for (let n = 1; n <= rest; n++) {
        // mitSoll (23.09.2026, B1): wuerfleVersuch() lässt einen solchen
        // Platz leer, statt ihn auf einen gesperrten Tag zu legen.
        ergebnis.push(Object.assign({}, p, { platzSchluessel: n === 1 ? p.id : p.id + '#' + n, mitSoll: true }));
      }
    }
    return ergebnis;
  }

  /**
   * Erzwungene Tage, frei wählbare Plätze und die für die Suche gültigen
   * Ausschlusstage -- einmal gebaut für verteileFreieTage(),
   * verteileFreieTageVarianten() und das Hill-Climbing in
   * entwuerfe_berechnung.js (damit alle drei dieselben Plätze sehen).
   * Ein erzwungener Tag (folgtFreierTag) belegt immer den ERSTEN Platz;
   * weitere Plätze derselben Person bleiben frei wählbar und dürfen
   * nicht auf den erzwungenen Tag fallen.
   */
  function bauePlaetze(personen, wochenStartISO, ereignisse, freieTageSoll, ausgeschlosseneTage) {
    const plaetze = rotationsplaetze(personen, wochenStartISO, ereignisse, freieTageSoll);
    const erzwungen = {};
    const freiWaehlbar = [];
    for (const pl of plaetze) {
      if (pl.platzSchluessel === pl.id) {
        const tag = erzwungenerFreierTag(pl.id, wochenStartISO, ereignisse);
        if (tag) { erzwungen[pl.id] = tag; continue; }
      }
      freiWaehlbar.push(pl);
    }
    let ausgeschlossen = ausgeschlosseneTage || {};
    const mitErzwungenUndZusatz = freiWaehlbar.filter(pl => erzwungen[pl.id]);
    if (mitErzwungenUndZusatz.length) {
      ausgeschlossen = Object.assign({}, ausgeschlossen);
      for (const pl of mitErzwungenUndZusatz) {
        const liste = (ausgeschlossen[pl.id] || []).slice();
        if (!liste.includes(erzwungen[pl.id])) liste.push(erzwungen[pl.id]);
        ausgeschlossen[pl.id] = liste;
      }
    }
    return { erzwungen, freiWaehlbar, ausgeschlosseneTage: ausgeschlossen, alleSchluessel: plaetze.map(pl => pl.platzSchluessel) };
  }

  /**
   * P1 (23.09.2026): feste Form. Die Tage der frei wählbaren Plätze einer
   * Person werden aufsteigend auf ihre Plätze verteilt (Schlüssel in der
   * Reihenfolge personId, #2, #3 ...). Erzwungene Plätze stehen nicht in
   * `freiWaehlbar` und bleiben unberührt. Verändert `versuch` direkt und
   * gibt es zurück. Eine Person mit nur einem Platz: keine Änderung.
   */
  function normalisiereVersuch(versuch, freiWaehlbar) {
    const gruppen = {};
    for (const pl of freiWaehlbar) {
      const k = pl.platzSchluessel || pl.id;
      if (!(k in versuch)) continue;
      (gruppen[pl.id] = gruppen[pl.id] || []).push(k);
    }
    for (const pid of Object.keys(gruppen)) {
      const schluessel = gruppen[pid];
      if (schluessel.length < 2) continue;
      schluessel.sort((a, b) => platzNummer(a) - platzNummer(b));
      const tage = schluessel.map(k => versuch[k]).sort();
      schluessel.forEach((k, i) => { versuch[k] = tage[i]; });
    }
    return versuch;
  }

  function platzNummer(schluessel) {
    const i = String(schluessel).indexOf('#');
    return i === -1 ? 1 : Number(schluessel.slice(i + 1));
  }

  /**
   * Baut eine Zuordnung Platz -> Tag aus freierTag-Ereignissen wieder auf
   * (Hill-Climbing, entwuerfe_berechnung.js). Ersetzt dort
   * `versuch[e.personId] = e.von`, das bei zwei Tagen einen stumm
   * überschrieb. Pro Person: ein erzwungener Tag auf den ersten Platz,
   * die übrigen aufsteigend -- dieselbe feste Form wie
   * normalisiereVersuch().
   */
  function versuchAusEreignissen(ereignisse, wochenStartISO, bestehendeEreignisse) {
    const proPerson = {};
    for (const e of (ereignisse || [])) {
      if (e.grund !== 'freierTag') continue;
      (proPerson[e.personId] = proPerson[e.personId] || []).push(e.von);
    }
    const versuch = {};
    for (const pid of Object.keys(proPerson)) {
      let tage = proPerson[pid].slice().sort();
      const erzw = erzwungenerFreierTag(pid, wochenStartISO, bestehendeEreignisse || []);
      if (erzw && tage.includes(erzw) && tage.length > 1) tage = [erzw].concat(tage.filter(t => t !== erzw));
      tage.forEach((t, i) => { versuch[i === 0 ? pid : pid + '#' + (i + 1)] = t; });
    }
    return versuch;
  }

  /**
   * Ein zufälliger, aber wunschtag-gewichteter Versuch: für jede
   * Rotationsperson einen Tag Mo–Sa auswürfeln. Tage, an denen die
   * Person schon irgendein bindendes Ereignis hat (auch ein reiner
   * Sperrtag wie Schule), an denen sie laut `arbeitstage` ohnehin
   * nicht arbeitet, die laut `freieTagOptionen` für sie gar nicht als
   * freier Tag infrage kommen (05.09.2026, Sechs-Arbeitstage-Fall:
   * rotierender freier Tag nur Fr/Sa/Mo, nie Di/Mi/Do), ODER eine
   * manuelle Zuweisung ("eine Person statt der anderen"-Fall — wer manuell
   * zum Arbeiten eingeteilt ist, kann an dem Tag keinen freien Tag mehr
   * bekommen), werden ausgeschlossen. Wunschtag (falls vorhanden und
   * in dieser Woche) bekommt ein deutlich höheres Gewicht, ist aber
   * nicht garantiert (nicht bindend, §11).
   */
  function wuerfleVersuch(personenListe, wochenStartISO, wunschtageByPersonId, historieByPersonId, ereignisse, manuelleZuweisungen, ausgeschlosseneTageByPersonId) {
    manuelleZuweisungen = manuelleZuweisungen || [];
    ausgeschlosseneTageByPersonId = ausgeschlosseneTageByPersonId || {};
    const tage = wochentageMoSa(wochenStartISO);
    const zuweisung = {}; // Platz-Schlüssel (bisher: personId) -> datumISO
    const belegtProPerson = {}; // 23.09.2026: Tage anderer Plätze derselben Person
    for (const person of personenListe) {
      const schluessel = person.platzSchluessel || person.id;
      const belegt = belegtProPerson[person.id] || [];
      const wunsch = wunschtageByPersonId[person.id];
      const historie = historieByPersonId[person.id] || [];
      const ausgeschlossen = ausgeschlosseneTageByPersonId[person.id] || [];
      const gewichte = tage.map(t => {
        if (belegt.includes(t)) return 0; // 23.09.2026: schon ein anderer Platz dieser Person
        if (R.hatBindendeSperre(person.id, t, ereignisse)) return 0; // schon anderweitig blockiert (z. B. Schule)
        if (manuelleZuweisungen.some(z => z.personId === person.id && z.datumISO === t)) return 0; // manuell zum Arbeiten eingeteilt
        // Ergänzt 09.09.2026 (Ulf, Feiertag-Ausgleich) — arbeitet die
        // Person diesen konkreten Tag (Feiertag), darf ihr EINER freier
        // Tag nicht ausgerechnet hier landen. Kein Zusatztag, nur
        // Ausschluss dieses einen Kandidaten — der normale Tag
        // verschiebt sich dadurch einfach auf einen anderen Wochentag.
        if (ausgeschlossen.includes(t)) return 0;
        const wochentagKey = R.wochentag(t);
        if (person.arbeitstage && !person.arbeitstage.includes(wochentagKey)) return 0; // Tag, an dem sie ohnehin nicht arbeitet
        if (person.freieTagOptionen && !person.freieTagOptionen.includes(wochentagKey)) return 0; // fuer diese Person kein moeglicher freier Tag
        let g = 1;
        if (wunsch && wunsch === t) g += 8; // Wunschtag stark bevorzugt, nicht erzwungen
        const wieOftKuerzlich = historie.filter(h => h === wochentagKey).length;
        g = Math.max(0.2, g - wieOftKuerzlich); // Abschwächung bei Wiederholung (Fairness)
        return g;
      });
      const summe = gewichte.reduce((a, b) => a + b, 0);
      let tag;
      if (summe > 0) {
        tag = gewichteteZufallsauswahl(tage, gewichte);
      } else if (person.mitSoll) {
        // B1 (23.09.2026): mit Soll kein Ausweichen auf einen gesperrten
        // Tag. Der Platz bleibt leer und erscheint in nichtVergebenePlaetze.
        tag = null;
      } else if (!belegt.length) {
        tag = tage[Math.floor(Math.random() * tage.length)]; // Randfall: jeder Tag blockiert, dann irgendeinen nehmen
      } else {
        // 23.09.2026: Zusatzplatz, alles blockiert -- nur Tage, die kein
        // anderer Platz dieser Person hat. Gibt es keinen, bleibt der
        // Platz leer und erscheint in nichtVergebenePlaetze.
        const rest = tage.filter(t => !belegt.includes(t));
        tag = rest.length ? rest[Math.floor(Math.random() * rest.length)] : null;
      }
      if (tag === null) continue;
      zuweisung[schluessel] = tag;
      belegtProPerson[person.id] = belegt.concat([tag]);
    }
    return zuweisung;
  }

  function gewichteteZufallsauswahl(werte, gewichte) {
    const summe = gewichte.reduce((a, b) => a + b, 0);
    let r = Math.random() * summe;
    for (let i = 0; i < werte.length; i++) {
      r -= gewichte[i];
      if (r <= 0) return werte[i];
    }
    return werte[werte.length - 1];
  }

  /** Baut aus einer Tag-Zuweisung die passenden freierTag-Ereignisse. */
  function zuEreignissen(zuweisung) {
    return Object.entries(zuweisung).map(([schluessel, datumISO]) => ({
      personId: personIdVonSchluessel(schluessel), von: datumISO, bis: datumISO,
      grund: 'freierTag', bindend: true, begruendung: null
    }));
  }

  // Ergänzt 14.09.2026 (Ulf, Punktesystem-Konzept vom 13./14.09.,
  // siehe SESSION_2026-09-13_PUNKTESYSTEM_KONZEPT.md für die komplette
  // Herleitung jeder einzelnen Zahl — hier nur die Kurzfassung).
  //
  // WICHTIGSTE ENTSCHEIDUNG: die Lücke bleibt eine Mauer, KEIN Punktwert
  // (Ulf: "Absolut — darf nie passieren, egal was es kostet"). Dieses
  // Punktesystem bestimmt nur, welche unter mehreren gleich guten
  // (gleiche Lückenzahl, gleiche harte-Lücken-Zahl) Lösungen die beste
  // ist — es kann eine Lücke niemals aufwiegen oder "erkaufen".
  //
  // SCHICHTWECHSEL: Ulf, mit einer konkreten Begründung, die es am
  // 09.09. noch nicht gab (Zeitstruktur der Schichten, nicht bloße
  // Richtung): Frühschicht endet ca. 13 Uhr, Nachtschicht beginnt
  // bereits 20 Uhr am SELBEN Tag — eng, teuer. Nachtschicht endet
  // dagegen früh morgens, Frühschicht beginnt früh morgens am NÄCHSTEN
  // Kalendertag — macht strukturell immer ~24 Stunden, das Zeitproblem
  // existiert dort schlicht nicht. Ulf: "wenn ihr Job erfüllt ist...
  // Lehre zurück und sei dir der Dankbarkeit der Nachtschicht gewiss"
  // — Rückkehr Nacht→Früh kostet deshalb IMMER 0, unabhängig vom
  // Puffer davor. Für Früh→Nacht gilt dagegen: je mehr Ruhe vor dem
  // Wechsel liegt, desto günstiger (direkt am selben Tag am teuersten).
  // Ergänzt 14.09.2026: alle folgenden Werte stehen jetzt als `let`
  // statt `const` -- überschreibbar über setzeGewichte() weiter unten,
  // für den Einstellungs-Editor (Ulf, 14.09.2026 abends: "brauchen wir
  // jetzt noch den Editor für die Punkte"). Ohne einen Aufruf von
  // setzeGewichte() bleiben es exakt dieselben Zahlen wie bisher --
  // rückwärtskompatibel, kein Aufrufer MUSS den Editor je genutzt haben.
  let SCHICHTWECHSEL_FRUEH_NACHT_DIREKT = 50;   // kein Ruhetag dazwischen
  let SCHICHTWECHSEL_FRUEH_NACHT_1_TAG_PUFFER = 20;  // ein freier Tag davor
  let SCHICHTWECHSEL_FRUEH_NACHT_2_PLUS_PUFFER = 10; // Wochenende (2+ Tage) davor
  let SCHICHTWECHSEL_NACHT_FRUEH = 0; // immer 0, siehe Begründung oben

  // AUSFLUG-AUFSCHLAG: ein Aufenthalt im anderen Modus, der wieder
  // verlassen wird, bevor er sich "gelohnt" hat. Ulf: "je länger die
  // zusammenhängende Kette, desto weniger schlimm ist es" — 1 Tag
  // bekommt den vollen Aufschlag, 2 Tage die Hälfte, ab 3 Tagen keinen
  // mehr (gilt dann als "richtiger" Aufenthalt, kein bloßer Ausflug).
  let AUSFLUG_AUFSCHLAG_1_TAG = 25;
  let AUSFLUG_AUFSCHLAG_2_TAGE = 12;

  let AZUBI_EINSATZ_PUNKTE = 10;
  let WUNSCHTAG_PUNKTE = 10; // WICHTIG_GEWICHT (oben) bleibt der Multiplikator für "wichtige" Wunschtage
  let WOCHENTAG_UEBERSCHUSS_MO_FR = 45;
  let WOCHENTAG_UEBERSCHUSS_SAMSTAG = 10;
  let WOCHENTAG_UEBERSCHUSS_FEIERTAGSWOCHE = 0; // Ulf: "praktisch 0"
  // Ergänzt 23.09.2026 (E13/E14): Kosten je zusätzlichem "Stück", in das
  // die freien Tage einer Person in einer Woche zerfallen. Weich: Lücken
  // stehen als eigene Stufe davor und gehen immer vor. Größenordnung
  // zwischen Wunschtag (10) und Wochentag-Überschuss Mo-Fr (45).
  let FREIE_TAGE_GETRENNT_PUNKTE = 30;

  /**
   * KONTO-RÜCKKOPPLUNG (T-68, 16.09.2026, Ulfs ausdrückliche Freigabe).
   *
   * Bis hierher verteilt diese Datei nur INNERHALB einer Woche fair und
   * hat kein Gedächtnis über Wochengrenzen -- das Ausgleichskonto
   * (`konten/<personId>`) ist diese fehlende Langzeit-Erinnerung. Neu:
   * der normalisierte Kontostand fließt als zusätzlicher Posten in
   * `gesamtKosten` ein. Wer über dem Team-Schnitt liegt, für den wird
   * ein WERTVOLLER freier Tag teurer; wer darunter liegt, für den
   * billiger.
   *
   * KEIN lernendes System: jeder Wochenlauf ist ein frischer
   * Optimierungslauf ohne Gedächtnis und liest nur den AKTUELLEN Stand
   * in `konten/`. Der Ausgleich über mehrere Wochen entsteht, weil sich
   * die Eingabedaten zwischen unabhängigen Läufen verschieben (das
   * Konto wird nach jedem offiziell angenommenen Plan aktualisiert) --
   * ein Regelkreis über die Daten, kein Ziel im Code.
   *
   * WICHTIG ZUR FORM DES TERMS: die Konzept-Skizze vom 16.09. hatte
   * `GEWICHT × (persoenlicherDurchschnitt − teamDurchschnitt)` -- das
   * hängt NUR an Person und Kontostand, nicht daran, was die jeweilige
   * Variante dieser Person gibt. Summiert über alle Personen wäre es
   * für JEDE Variante derselbe Wert gewesen, ein konstanter Offset
   * ohne jede Wirkung auf die Rangfolge. Deshalb hier multipliziert mit
   * dem Wert des Tages, den die Variante dieser Person tatsächlich
   * zuteilt (`tagWertFuerAuswahl`). Erst dadurch unterscheiden sich
   * Varianten.
   *
   * Einheit: KONTO_AUSGLEICH_GEWICHT sind Punkte je 0,1 Abweichung --
   * die rohen Abweichungen liegen bei ±0,3, das wäre neben Posten von
   * 10/45/50 nicht einstellbar gewesen (deshalb × 10 unten).
   *
   * STARTWERT 3 IST UNGETESTET -- wie bei den anderen zwölf Gewichten
   * nur am echten Export zu finden.
   */
  let KONTO_AUSGLEICH_GEWICHT = 3;

  /**
   * SCHULD-AUSGLEICH (T-10, 16.09.2026). Zweiter, getrennter Posten.
   *
   * Warum nicht einfach den Saldo stärker drücken: das wären zwei
   * verschiedene Aussagen in einer Zahl. Der Saldo sagt "was habe ich
   * bekommen"; die Schuld sagt "ich habe kurzfristig zugesagte Freizeit
   * hergegeben" -- ein Dienst, kein bloßes Nicht-Bekommen. Ulfs
   * Grundsatz für das Konto war von Anfang an "getrennt, keine
   * Blackbox" (§9.1) -- das gilt hier genauso.
   *
   * Bewusst OHNE Mindestschwelle und ohne Anlauf: wer einmal
   * eingesprungen ist, hat den Anspruch sofort, auch in seiner ersten
   * Woche. Und bewusst deutlich höher als KONTO_AUSGLEICH_GEWICHT --
   * ein hergegebener Tag soll klar schwerer wiegen als "war zuletzt
   * gut dran". Beim Justieren ist das die grobe Schraube, der
   * Saldo-Ausgleich die feine.
   *
   * STARTWERT 12 IST UNGETESTET, wie alle anderen auch.
   */
  let SCHULD_AUSGLEICH_GEWICHT = 12;

  // Anlauf statt Kante: unter KONTO_MIN_WOCHEN fließt gar nichts ein
  // (entspricht exakt dem Zustand ohne Rückkopplung, Ulfs Entscheidung
  // vom 16.09.), ab KONTO_VOLL_WOCHEN voll. Dazwischen linear -- ohne
  // den Anlauf würde eine Person in Woche 4 schlagartig mit vollem
  // Gewicht gedämpft, nur weil ihre ersten vier Wochen zufällig gut
  // waren. Bewusst KEINE einstellbaren Gewichte: das sind Schwellen
  // des Verfahrens, keine Fairness-Werte.
  const KONTO_MIN_WOCHEN = 4;
  const KONTO_VOLL_WOCHEN = 8;

  // Vereinfachte Tageswert-Skala für die AUSWAHL (nicht für die
  // Buchung!). Die echte Bewertung in ausgleichskonto_berechnung.js
  // kennt zusätzlich die Sonntags-Kombis (Mo+So davor, Sa+So danach,
  // Feiertag+Nachbartag) -- dafür bräuchte sie hier die angrenzenden
  // `sonntagsplan`-Dokumente, also einen kompletten zweiten
  // Firestore-Kontext. Bewusst weggelassen: ein Richtwert für die
  // Auswahl muss nicht bis auf die Nachkommastelle mit der späteren
  // Buchung übereinstimmen. Über `optionen.kontoWerte` überschreibbar,
  // damit die Skala nicht auseinanderläuft, wenn ein Admin die
  // Konto-Werte in bankkonto.html verstellt.
  const KONTO_WERTE_STANDARD = Object.freeze({
    normal: 1,
    montagOderSamstagAllein: 1.2,
    feiertagAllein: 1.3,
    wunschtag: 1.5
  });

  // Die Original-Werte, für resetGewichte() und für den Editor (der
  // beim ersten Öffnen ohne eigene Datei die Standardwerte braucht).
  // Ein eigenes, unabhängiges Objekt -- KEIN Verweis auf die let-
  // Variablen oben, sonst würde sich "Standard" nach der ersten
  // Änderung mitändern.
  const GEWICHTE_STANDARD = Object.freeze({
    schichtwechselFruehNachtDirekt: 50,
    schichtwechselFruehNacht1TagPuffer: 20,
    schichtwechselFruehNacht2PlusPuffer: 10,
    schichtwechselNachtFrueh: 0,
    ausflugAufschlag1Tag: 25,
    ausflugAufschlag2Tage: 12,
    azubiEinsatzPunkte: 10,
    wunschtagPunkte: 10,
    wichtigGewicht: 5,
    wochentagUeberschussMoFr: 45,
    wochentagUeberschussSamstag: 10,
    wochentagUeberschussFeiertagswoche: 0,
    kontoAusgleichGewicht: 3,
    schuldAusgleichGewicht: 12,
    freieTageGetrenntPunkte: 30 // ergänzt 23.09.2026 (E13/E14)
  });

  /**
   * Überschreibt die Punktesystem-Gewichte zur Laufzeit (14.09.2026).
   *
   * KORRIGIERT 16.09.2026 (T-39): hier stand noch der ursprüngliche Weg
   * über `punktesystem_gewichte_editor.html` + `punktesystem_gewichte.json`
   * (Download + manueller Commit). Der wurde noch am 14.09. abends
   * abgelöst -- die Werte liegen jetzt live in Firestore unter
   * `einstellungen/punktesystem_gewichte` und werden im dritten Bereich
   * von `einstellungen.html` bearbeitet. Die Funktion selbst ist
   * quellenneutral und war nie betroffen, nur dieser Kommentar schickte
   * Leser auf die falsche Fährte.
   *
   * PARTIELLE Überschreibung erlaubt -- jeder fehlende Schlüssel in
   * `overrides` behält seinen bisherigen Wert. Aufrufer (entwuerfe.html)
   * ruft das EINMAL beim Laden auf, nachdem `punktesystem_gewichte.json`
   * (falls vorhanden) per fetch() geladen wurde. Ohne diesen Aufruf
   * bleiben es exakt die Standardwerte -- rückwärtskompatibel.
   *
   * Bewusst als Objekt mit LESBAREN Schlüsselnamen (camelCase, nicht
   * die internen SCHREIENDEN Variablennamen) -- das ist auch das
   * Feldformat des Firestore-Dokuments und das, was der Editor-Abschnitt
   * in einstellungen.html anzeigt und schreibt.
   */
  function setzeGewichte(overrides) {
    if (!overrides) return;
    if (overrides.schichtwechselFruehNachtDirekt !== undefined) SCHICHTWECHSEL_FRUEH_NACHT_DIREKT = overrides.schichtwechselFruehNachtDirekt;
    if (overrides.schichtwechselFruehNacht1TagPuffer !== undefined) SCHICHTWECHSEL_FRUEH_NACHT_1_TAG_PUFFER = overrides.schichtwechselFruehNacht1TagPuffer;
    if (overrides.schichtwechselFruehNacht2PlusPuffer !== undefined) SCHICHTWECHSEL_FRUEH_NACHT_2_PLUS_PUFFER = overrides.schichtwechselFruehNacht2PlusPuffer;
    if (overrides.schichtwechselNachtFrueh !== undefined) SCHICHTWECHSEL_NACHT_FRUEH = overrides.schichtwechselNachtFrueh;
    if (overrides.ausflugAufschlag1Tag !== undefined) AUSFLUG_AUFSCHLAG_1_TAG = overrides.ausflugAufschlag1Tag;
    if (overrides.ausflugAufschlag2Tage !== undefined) AUSFLUG_AUFSCHLAG_2_TAGE = overrides.ausflugAufschlag2Tage;
    if (overrides.azubiEinsatzPunkte !== undefined) AZUBI_EINSATZ_PUNKTE = overrides.azubiEinsatzPunkte;
    if (overrides.wunschtagPunkte !== undefined) WUNSCHTAG_PUNKTE = overrides.wunschtagPunkte;
    if (overrides.wichtigGewicht !== undefined) WICHTIG_GEWICHT = overrides.wichtigGewicht;
    if (overrides.wochentagUeberschussMoFr !== undefined) WOCHENTAG_UEBERSCHUSS_MO_FR = overrides.wochentagUeberschussMoFr;
    if (overrides.wochentagUeberschussSamstag !== undefined) WOCHENTAG_UEBERSCHUSS_SAMSTAG = overrides.wochentagUeberschussSamstag;
    if (overrides.wochentagUeberschussFeiertagswoche !== undefined) WOCHENTAG_UEBERSCHUSS_FEIERTAGSWOCHE = overrides.wochentagUeberschussFeiertagswoche;
    if (overrides.kontoAusgleichGewicht !== undefined) KONTO_AUSGLEICH_GEWICHT = overrides.kontoAusgleichGewicht;
    if (overrides.schuldAusgleichGewicht !== undefined) SCHULD_AUSGLEICH_GEWICHT = overrides.schuldAusgleichGewicht;
    if (overrides.freieTageGetrenntPunkte !== undefined) FREIE_TAGE_GETRENNT_PUNKTE = overrides.freieTageGetrenntPunkte;
  }

  /** Setzt alle Gewichte zurück auf die Standardwerte (siehe oben). */
  function resetGewichte() {
    setzeGewichte(GEWICHTE_STANDARD);
  }

  /**
   * Liefert die AKTUELL geltenden Gewichte (nach etwaigen
   * setzeGewichte()-Aufrufen) als Objekt -- für Anzeige/Debugging, z. B.
   * damit eine Oberfläche zeigen kann "gerade gelten diese Werte".
   */
  function holeGewichte() {
    return {
      schichtwechselFruehNachtDirekt: SCHICHTWECHSEL_FRUEH_NACHT_DIREKT,
      schichtwechselFruehNacht1TagPuffer: SCHICHTWECHSEL_FRUEH_NACHT_1_TAG_PUFFER,
      schichtwechselFruehNacht2PlusPuffer: SCHICHTWECHSEL_FRUEH_NACHT_2_PLUS_PUFFER,
      schichtwechselNachtFrueh: SCHICHTWECHSEL_NACHT_FRUEH,
      ausflugAufschlag1Tag: AUSFLUG_AUFSCHLAG_1_TAG,
      ausflugAufschlag2Tage: AUSFLUG_AUFSCHLAG_2_TAGE,
      azubiEinsatzPunkte: AZUBI_EINSATZ_PUNKTE,
      wunschtagPunkte: WUNSCHTAG_PUNKTE,
      wichtigGewicht: WICHTIG_GEWICHT,
      wochentagUeberschussMoFr: WOCHENTAG_UEBERSCHUSS_MO_FR,
      wochentagUeberschussSamstag: WOCHENTAG_UEBERSCHUSS_SAMSTAG,
      wochentagUeberschussFeiertagswoche: WOCHENTAG_UEBERSCHUSS_FEIERTAGSWOCHE,
      kontoAusgleichGewicht: KONTO_AUSGLEICH_GEWICHT,
      schuldAusgleichGewicht: SCHULD_AUSGLEICH_GEWICHT,
      freieTageGetrenntPunkte: FREIE_TAGE_GETRENNT_PUNKTE
    };
  }

  /**
   * Baut den Konto-Index für EINEN Generierungslauf (T-68). Bewusst
   * einmal pro Aufruf und NICHT in bewerteVersuch -- die läuft bis zu
   * 5000-mal, der Team-Schnitt ändert sich dabei nie.
   *
   * `kontoDaten`: { personId: { saldo, wochenGezaehlt } } -- genau die
   * beiden Felder aus `konten/<personId>`, vom Aufrufer vorgeladen
   * (diese Datei greift selbst nicht auf Firestore zu).
   *
   * Der Team-Schnitt wird NUR über Personen mit genug Wochen gebildet
   * -- sonst zögen genau die Neuen den Bezugswert, die selbst noch
   * nicht mitgerechnet werden.
   *
   * @returns null (keine Rückkopplung) oder { abweichung, faktor, teamSchnitt }
   */
  function baueKontoIndex(kontoDaten) {
    if (!kontoDaten) return null;
    const ids = Object.keys(kontoDaten);
    if (!ids.length) return null;
    // T-10: offene Schuld gilt sofort, unabhängig von der
    // Wochen-Schwelle des Saldo-Ausgleichs.
    const schuld = {};
    for (const id of ids) {
      const offen = Number((kontoDaten[id] || {}).freieTageSchuld) || 0;
      if (offen > 0) schuld[id] = offen;
    }
    const schnitte = {};
    const zaehlende = [];
    for (const id of ids) {
      const k = kontoDaten[id] || {};
      const wochen = Number(k.wochenGezaehlt) || 0;
      if (wochen <= 0) continue;
      schnitte[id] = (Number(k.saldo) || 0) / wochen;
      if (wochen >= KONTO_MIN_WOCHEN) zaehlende.push(id);
    }
    if (!zaehlende.length) {
      // Kein Saldo-Ausgleich möglich, aber vielleicht offene Schuld --
      // dann trotzdem einen Index liefern, sonst fiele T-10 mit aus.
      return Object.keys(schuld).length ? { abweichung: {}, faktor: {}, teamSchnitt: 0, schuld } : null;
    }
    const teamSchnitt = zaehlende.reduce((s, id) => s + schnitte[id], 0) / zaehlende.length;
    const abweichung = {};
    const faktor = {};
    for (const id of Object.keys(schnitte)) {
      const wochen = Number((kontoDaten[id] || {}).wochenGezaehlt) || 0;
      const anlauf = (wochen - KONTO_MIN_WOCHEN) / (KONTO_VOLL_WOCHEN - KONTO_MIN_WOCHEN);
      const f = Math.max(0, Math.min(1, anlauf));
      if (f <= 0) continue; // unter der Mindestschwelle: gar keine Rückkopplung
      abweichung[id] = schnitte[id] - teamSchnitt;
      faktor[id] = f;
    }
    return { abweichung, faktor, teamSchnitt, schuld };
  }

  /**
   * Wert des Tages, den eine Variante dieser Person zuteilt --
   * vereinfachte Skala, siehe KONTO_WERTE_STANDARD oben. Höchster
   * zutreffender Wert gewinnt, wie in ausgleichskonto_berechnung.js
   * (keine Addition).
   *
   * Ein WICHTIG markierter Wunschtag bekommt bewusst KEINEN
   * Wunsch-Aufschlag (Ulf, 16.09.2026): Anlass war ein Kollege mit
   * wöchentlichem Arzttermin -- für eine Notwendigkeit den
   * Fairness-Nachteil zu kassieren wäre schief. Normale Wünsche zählen
   * dagegen voll, und genau das ist der Kern des Features (Ulf: "wenn
   * ich mal einen freien Tag möchte, dann möchte ich gern vor denen
   * stehen, die sich öfter einen wünschen").
   */
  function tagWertFuerAuswahl(personId, datumISO, feiertage, wunschtageByPersonId, wichtigeWunschtage, werte) {
    const d = new Date(datumISO + 'T00:00:00');
    const wochentag = d.getDay(); // 0=So .. 6=Sa
    let wert = werte.normal;
    if (wochentag === 1 || wochentag === 6) wert = Math.max(wert, werte.montagOderSamstagAllein);
    if (feiertage.includes(datumISO)) wert = Math.max(wert, werte.feiertagAllein);
    if (wunschtageByPersonId[personId] === datumISO && !wichtigeWunschtage[personId]) {
      wert = Math.max(wert, werte.wunschtag);
    }
    return wert;
  }

  /**
   * Baut aus einer Modus-Sequenz ('nacht'|'frueh'|'frei' pro Tag)
   * zusammenhängende Blöcke: [{modus, laenge}, ...]. Reine
   * Datenumformung, keine Bewertung.
   */
  function baueBloecke(modiSequenz) {
    const bloecke = [];
    let aktuell = null;
    for (const modus of modiSequenz) {
      if (aktuell && aktuell.modus === modus) { aktuell.laenge++; }
      else { aktuell = { modus, laenge: 1 }; bloecke.push(aktuell); }
    }
    return bloecke;
  }

  /**
   * Reduziert eine Block-Liste auf die reinen Arbeits-Blöcke (nacht/
   * frueh), jeweils mit dem Puffer (Länge des unmittelbar davor
   * liegenden Frei-Blocks, 0 falls keiner) als Zusatzinfo.
   */
  function arbeitsBloeckeMitPuffer(bloecke) {
    const ergebnis = [];
    let puffer = 0;
    for (const block of bloecke) {
      if (block.modus === 'frei') { puffer = block.laenge; continue; }
      ergebnis.push({ modus: block.modus, laenge: block.laenge, pufferDavor: puffer });
      puffer = 0;
    }
    return ergebnis;
  }

  /**
   * Schichtwechsel-Punkte für EINE Person über die Woche. `modiSequenz`
   * ist die Mo–Sa-Abfolge ('nacht'|'frueh'|'frei'), `stammschicht` ihre
   * Heimatschicht.
   *
   * Modell: ein gedachter Block VOR der Woche in der Stammschicht der
   * Person (Annahme: "so war es normalerweise, bevor diese Woche
   * begann") wird vorangestellt — dadurch behandelt dieselbe Schleife
   * sowohl "kommt diese Woche neu in die Nachtschicht" als auch jeden
   * Wechsel MITTEN in der Woche einheitlich, ohne Sonderfall-Code.
   * GRENZE DES MODELLS, bewusst in Kauf genommen: `bewerteVersuch()`
   * sieht immer nur EINE Woche. Läuft eine Konzentration über mehrere
   * Wochen, wird nur die ERSTE Woche mit dem Eintritts-Wechsel
   * bepreist — die Folgewochen zeigen 0, weil kein Wechsel mehr
   * sichtbar ist. Das ist nach Ulfs eigener Begründung sogar korrekt,
   * nicht nur eine Vereinfachung: die Umstellung passiert einmal, nicht
   * wöchentlich neu — wer schon angekommen ist, "zahlt" nicht erneut.
   */
  function schichtwechselPunkteFuerPerson(modiSequenz, stammschicht) {
    const bloecke = baueBloecke(modiSequenz);
    const arbeitsBloecke = arbeitsBloeckeMitPuffer(bloecke);
    const vollstaendig = [{ modus: stammschicht, laenge: Infinity, pufferDavor: 0 }].concat(arbeitsBloecke);

    let punkte = 0;
    for (let i = 1; i < vollstaendig.length; i++) {
      const vorher = vollstaendig[i - 1];
      const jetzt = vollstaendig[i];
      if (vorher.modus === jetzt.modus) continue; // kein echter Wechsel

      if (vorher.modus === 'frueh' && jetzt.modus === 'nacht') {
        if (jetzt.pufferDavor === 0) punkte += SCHICHTWECHSEL_FRUEH_NACHT_DIREKT;
        else if (jetzt.pufferDavor === 1) punkte += SCHICHTWECHSEL_FRUEH_NACHT_1_TAG_PUFFER;
        else punkte += SCHICHTWECHSEL_FRUEH_NACHT_2_PLUS_PUFFER;
      } else if (vorher.modus === 'nacht' && jetzt.modus === 'frueh') {
        punkte += SCHICHTWECHSEL_NACHT_FRUEH; // = 0, siehe Konstante
      }

      // Ausflug-Aufschlag: gilt dem gerade VERLASSENEN Block — aber
      // NUR, wenn dieser Block selbst eine Abweichung von der
      // Stammschicht war (eine echte "Visite"), nicht bei jedem
      // beliebigen kurzen Stammschicht-Block. FUND beim Testen
      // (14.09.2026): ohne diese Einschränkung feuerte der Aufschlag
      // fälschlich auch beim Verlassen eines GANZ NORMALEN
      // Stammschicht-Blocks, nur weil der zufällig kurz war (z. B. "erst
      // zwei Tage Nacht gearbeitet, bevor der Ausflug in die Früh
      // beginnt" wurde selbst als Ausflug gewertet, obwohl es die
      // eigentliche Heimat-Schicht der Person war). Der synthetische
      // Stammschicht-Block (Länge Infinity) kann diesen Aufschlag ohnehin
      // nie auslösen, aber auch ein ECHTER, nur zufällig kurzer
      // Stammschicht-Block darf ihn nicht auslösen.
      if (vorher.modus !== stammschicht) {
        if (vorher.laenge === 1) punkte += AUSFLUG_AUFSCHLAG_1_TAG;
        else if (vorher.laenge === 2) punkte += AUSFLUG_AUFSCHLAG_2_TAGE;
      }
    }
    return punkte;
  }

  /**
   * Baut für jede Person die Mo–Sa-Modus-Sequenz aus den sechs
   * Tages-Ergebnissen (bereits berechnet, keine zusätzlichen
   * Rechenkern-Aufrufe). 'frei' ist der Sammelbegriff für "an diesem
   * Tag weder in nacht.zuweisungen noch in frueh.zuweisungen" — deckt
   * echten freien Tag, Urlaub, Krankheit und schlicht nicht gebraucht
   * gleichermaßen ab; für die Schichtwechsel-Frage macht das keinen
   * Unterschied (siehe Ulf: "auf einen freien Tag... keinerlei Strafe").
   */
  function ermittleTagesModiProPerson(ergebnisseProTag, personen) {
    const modi = {};
    for (const p of personen) modi[p.id] = [];
    for (const ergebnis of ergebnisseProTag) {
      const heuteModus = {};
      for (const schicht of ['nacht', 'frueh']) {
        const zuw = (ergebnis[schicht] && ergebnis[schicht].zuweisungen) || {};
        for (const personId of Object.values(zuw)) heuteModus[personId] = schicht;
      }
      for (const p of personen) modi[p.id].push(heuteModus[p.id] || 'frei');
    }
    return modi;
  }

  /**
   * Rechnet einen kompletten Mo–Sa-Versuch durch (echte Kaskade aus
   * rechenmodul.js) und bewertet ihn.
   *
   * UMGEBAUT 14.09.2026 (Ulf, ausdrückliche Freigabe, Punktesystem-
   * Konzept vom 13./14.09. — siehe SESSION_2026-09-13_PUNKTESYSTEM_
   * KONZEPT.md für die vollständige Herleitung jedes Wertes). Rangfolge
   * jetzt: Lücken (am wichtigsten, bleibt eine Mauer, siehe istBesser)
   * → harte Lücken → EINE gewichtete Gesamt-Kostensumme aus
   * Schichtwechseln, Azubi-Einsätzen, Wochentag-Nacht-Überschuss und
   * erfüllten Wunschtagen (ersetzt die vorherige separate
   * Wochentag-Überschuss-Stufe und den reinen Wunschtage-Tie-Breaker).
   *
   * `feiertage` (neuer, optionaler 9. Parameter, Liste von ISO-Daten):
   * für den gewichteten Wochentag-Überschuss — in einer Feiertagswoche
   * gilt ein anderer (niedrigerer) Wert, siehe
   * WOCHENTAG_UEBERSCHUSS_FEIERTAGSWOCHE oben. Fehlt der Parameter
   * (ältere Aufrufer), verhält sich die Funktion wie eine ganz normale
   * Woche — rückwärtskompatibel, keine Aufrufstelle MUSS ihn mitgeben.
   */
  function bewerteVersuch(zuweisung, wochenStartISO, personen, positionen, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, feiertage, kontoIndex, kontoWerte) {
    manuelleZuweisungen = manuelleZuweisungen || [];
    wichtigeWunschtage = wichtigeWunschtage || {};
    feiertage = feiertage || [];
    kontoIndex = kontoIndex || null;
    kontoWerte = kontoWerte || KONTO_WERTE_STANDARD;
    const tage = wochentageMoSa(wochenStartISO);
    const testEreignisse = bestehendeEreignisse.concat(zuEreignissen(zuweisung));
    let luecken = 0;
    let harteLuecken = 0;
    let wochentagUeberschussKosten = 0;
    let azubiEinsaetze = 0;
    const ergebnisseProTag = [];
    for (let i = 0; i < tage.length; i++) {
      const datumISO = tage[i];
      const ergebnis = R.berechneTagAlleSchichten(datumISO, personen, positionen, testEreignisse, manuelleZuweisungen);
      ergebnisseProTag.push(ergebnis);
      luecken += ergebnis.nacht.luecken.length + ergebnis.frueh.luecken.length;
      // Ergänzt 13.09.2026 (Ulf, Person F/Person L-Mittwoch-Fall): zwei
      // Verteilungen mit GLEICH VIELEN Lücken sind nicht gleich gut.
      // Eine Lücke, für die `manuellePruefung` einen Cross-Schicht-
      // Kandidaten kennt, lässt sich hinterher noch schließen; eine
      // ohne jeden Kandidaten ist endgültig.
      // BEWUSSTE UNGENAUIGKEIT: eine Person kann an einem Tag nur an
      // EINER Stelle stehen. Zwei Lücken am selben Tag, für die nur
      // derselbe eine Kandidat infrage kommt, werden hier trotzdem
      // beide als deckbar gezählt. Verfeinerung wäre später möglich,
      // bewusst nicht vorweggenommen.
      for (const schicht of ['nacht', 'frueh']) {
        const erg = ergebnis[schicht];
        if (!erg) continue;
        for (const positionId of (erg.luecken || [])) {
          const hatKandidaten = (erg.manuellePruefung || []).some(m => m.positionId === positionId);
          if (!hatKandidaten) harteLuecken++;
        }
        azubiEinsaetze += (erg.azubiEingesetzt || []).length;
      }
      // Sonntag bewusst nicht mitgezählt — eigene Logik, §6.
      // Gewichtet statt roh gezählt (14.09.2026): Mo-Fr teuer, Samstag
      // günstig, Feiertagswoche praktisch kostenlos (Ulf: an solchen
      // Tagen gibt es oft mehr zu tun, ein Überschuss ist dann kein
      // Verschwenden). Reine Zahlen-Ersetzung der alten Zählung, exakt
      // dieselbe zugrunde liegende Personen-Filterung.
      const nachtUeberschuss = (ergebnis.ueberzaehlig || []).filter(id => {
        const p = personen.find(pp => pp.id === id);
        return p && p.stammschicht === 'nacht';
      }).length;
      if (i < 5) { // Mo–Fr (Index 0–4); Samstag (Index 5) separat unten
        const gewicht = feiertage.includes(datumISO) ? WOCHENTAG_UEBERSCHUSS_FEIERTAGSWOCHE : WOCHENTAG_UEBERSCHUSS_MO_FR;
        wochentagUeberschussKosten += nachtUeberschuss * gewicht;
      } else {
        wochentagUeberschussKosten += nachtUeberschuss * WOCHENTAG_UEBERSCHUSS_SAMSTAG;
      }
    }

    let wunschtageErfuellt = 0;
    for (const [schluessel, datumISO] of Object.entries(zuweisung)) {
      const personId = personIdVonSchluessel(schluessel); // 23.09.2026, Plätze
      if (wunschtageByPersonId[personId] === datumISO) {
        wunschtageErfuellt += wichtigeWunschtage[personId] ? WICHTIG_GEWICHT : 1;
      }
    }

    // Schichtwechsel-Kosten: pro Person die Mo-Sa-Modus-Sequenz aus den
    // schon berechneten Tagesergebnissen ableiten (keine zusätzlichen
    // Rechenkern-Aufrufe) und gegen ihre Stammschicht bewerten.
    const modiProPerson = ermittleTagesModiProPerson(ergebnisseProTag, personen);
    let schichtwechselKosten = 0;
    for (const person of personen) {
      schichtwechselKosten += schichtwechselPunkteFuerPerson(modiProPerson[person.id], person.stammschicht);
    }

    // Konto-Rückkopplung (T-68). Multipliziert mit dem Wert des Tages,
    // den DIESE Variante der Person gibt -- ohne diese Kopplung wäre
    // der Posten für alle Varianten identisch und damit wirkungslos
    // (siehe ausführliche Begründung bei KONTO_AUSGLEICH_GEWICHT).
    // Vorzeichen: über dem Team-Schnitt (positive Abweichung) verteuert
    // einen wertvollen Tag, darunter verbilligt ihn -- gesamtKosten
    // wird minimiert.
    let kontoAusgleichKosten = 0;
    let schuldAusgleichKosten = 0;
    if (kontoIndex) {
      const schuldStaende = kontoIndex.schuld || {};
      for (const [schluessel, datumISO] of Object.entries(zuweisung)) {
        const personId = personIdVonSchluessel(schluessel); // 23.09.2026, Plätze
        const tagWert = tagWertFuerAuswahl(personId, datumISO, feiertage, wunschtageByPersonId, wichtigeWunschtage, kontoWerte);
        const abw = kontoIndex.abweichung[personId];
        if (abw !== undefined) {
          kontoAusgleichKosten += KONTO_AUSGLEICH_GEWICHT * (abw * 10) * kontoIndex.faktor[personId] * tagWert;
        }
        // T-10: offene Schuld macht einen guten Tag für diese Person
        // BILLIGER -- negatives Vorzeichen, weil gesamtKosten minimiert
        // wird. Kein Schwellenwert: der Anspruch gilt sofort.
        const offeneSchuld = schuldStaende[personId] || 0;
        if (offeneSchuld > 0) {
          schuldAusgleichKosten -= SCHULD_AUSGLEICH_GEWICHT * offeneSchuld * tagWert;
        }
      }
      kontoAusgleichKosten = Math.round(kontoAusgleichKosten * 100) / 100;
      schuldAusgleichKosten = Math.round(schuldAusgleichKosten * 100) / 100;
    }

    // E13/E14 (23.09.2026): "am Stück". Je Person ihre freien Tage der
    // Woche (Plätze dieses Versuchs plus freie Feiertage), gezählt in
    // zusammenhängenden Stücken Mo-Sa. Ein Stück kostet nichts, jedes
    // weitere FREIE_TAGE_GETRENNT_PUNKTE. Wer nur einen freien Tag hat,
    // hat immer genau ein Stück -- normale Wochen bleiben bei 0.
    let stueckKosten = 0;
    if (FREIE_TAGE_GETRENNT_PUNKTE) {
      const feiertagsEreignisse = bestehendeEreignisse.filter(e => e.grund === 'feiertag' && e.bindend);
      const freiProPerson = {};
      for (const [schluessel, datumISO] of Object.entries(zuweisung)) {
        const pid = personIdVonSchluessel(schluessel);
        (freiProPerson[pid] = freiProPerson[pid] || new Set()).add(datumISO);
      }
      for (const pid of Object.keys(freiProPerson)) {
        const frei = freiProPerson[pid];
        if (feiertagsEreignisse.length) {
          for (const t of tage) if (istFreierFeiertag(pid, t, feiertagsEreignisse)) frei.add(t);
        }
        if (frei.size < 2) continue;
        let stuecke = 0;
        tage.forEach((t, i) => { if (frei.has(t) && !(i > 0 && frei.has(tage[i - 1]))) stuecke++; });
        stueckKosten += (stuecke - 1) * FREIE_TAGE_GETRENNT_PUNKTE;
      }
    }

    const gesamtKosten =
      stueckKosten +
      schichtwechselKosten +
      azubiEinsaetze * AZUBI_EINSATZ_PUNKTE +
      wochentagUeberschussKosten -
      wunschtageErfuellt * WUNSCHTAG_PUNKTE +
      kontoAusgleichKosten +
      schuldAusgleichKosten;

    return {
      luecken, harteLuecken, gesamtKosten,
      // Einzelwerte weiterhin mitgegeben — für Anzeige/Nachvollziehbarkeit
      // und weil `luecken`/`wunschtageErfuellt` schon heute von außen
      // (entwuerfe.html) gelesen werden, unverändertes Format.
      schichtwechselKosten, azubiEinsaetze, wochentagUeberschussKosten,
      wunschtageErfuellt,
      kontoAusgleichKosten, // ergänzt 16.09.2026, rein additiv (T-68)
      schuldAusgleichKosten, // ergänzt 16.09.2026, rein additiv (T-10)
      stueckKosten // ergänzt 23.09.2026, rein additiv (E13/E14)
    };
  }

  /**
   * Vergleicht zwei Bewertungen nach der jetzt DREIstufigen Rangfolge:
   * Lücken (am wichtigsten, eine Mauer — siehe Konstanten-Kommentar
   * oben, kann durch nichts aufgewogen werden) → harte Lücken →
   * gewichtete Gesamtkosten (Schichtwechsel + Azubi + Wochentag-
   * Überschuss − Wunschtage, als EINE Zahl). Gibt true zurück, wenn
   * `neu` besser ist als `alt`. Zentral an einer Stelle, damit
   * Zufallssuche und Hill-Climbing garantiert dieselbe Rangfolge
   * verwenden.
   *
   * UMGEBAUT 14.09.2026 (Ulf, ausdrückliche Freigabe): die vorherigen
   * getrennten Stufen "Wochentag-Überschuss" und "Wunschtage" sind zu
   * EINER gewichteten Summe zusammengeführt (siehe bewerteVersuch) —
   * Schichtwechsel und Azubi-Einsätze fließen jetzt zum ersten Mal
   * überhaupt in die Bewertung ein, statt nur über feste Kaskaden-
   * Regeln in rechenmodul.js entschieden zu werden. Lücken und harte
   * Lücken bleiben unverändert eigene, unantastbare Stufen davor.
   */
  function istBesser(neu, alt) {
    if (neu.luecken !== alt.luecken) return neu.luecken < alt.luecken;
    if ((neu.harteLuecken || 0) !== (alt.harteLuecken || 0)) return (neu.harteLuecken || 0) < (alt.harteLuecken || 0);
    return (neu.gesamtKosten || 0) < (alt.gesamtKosten || 0);
  }

  /**
   * Ergänzt 09.09.2026 (Ulf, Person Bi/Rheon-Freitag-Fund) — die
   * 300-Zufallsversuche-Suche bewertet "braucht Cross-Schicht" schon
   * korrekt als Lücke, aber bei einem großen Kombinationsraum kann sie
   * eine einzelne gute Verteilung trotzdem einfach nie würfeln. Ulf
   * hatte von Hand gefunden: schiebt man EINER Person (hier Person Bi)
   * den freien Tag auf einen anderen Wochentag, löst sich eine
   * Cross-Schicht-Lücke an anderer Stelle in der Woche von selbst auf
   * — ohne dass sich sonst etwas ändert. Genau das prüft dieser
   * Nachbesserungs-Durchlauf systematisch: nimmt das beste Ergebnis
   * der Zufallssuche und probiert für JEDE Rotationsperson einzeln
   * jeden anderen erlaubten Wochentag durch (alle anderen bleiben
   * unverändert) — verbessert sich die Lückenzahl (oder bei Gleichstand
   * die Wunschtag-Erfüllung), wird die Änderung übernommen. Wiederholt,
   * bis eine volle Runde keine Verbesserung mehr bringt oder die
   * Sicherheitsgrenze erreicht ist. Klassisches Hill-Climbing, kein
   * neues Gerüst — nutzt dieselbe `bewerteVersuch`-Funktion wie die
   * Zufallssuche.
   */
  function verbessereDurchLokaleSuche(bester, freiWaehlbar, wochenStartISO, personen, positionen, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, ausgeschlosseneTageByPersonId, feiertage, kontoIndex, kontoWerte) {
    manuelleZuweisungen = manuelleZuweisungen || [];
    ausgeschlosseneTageByPersonId = ausgeschlosseneTageByPersonId || {};
    const tage = wochentageMoSa(wochenStartISO);
    const MAX_RUNDEN = 20; // Sicherheitsgrenze gegen Endlosschleifen
    let verbessert = true;
    let runden = 0;
    while (verbessert && runden < MAX_RUNDEN) {
      verbessert = false;
      runden++;
      for (const person of freiWaehlbar) {
        const schluessel = person.platzSchluessel || person.id; // 23.09.2026, Plätze
        const aktuellerTag = bester.versuch[schluessel];
        const ausgeschlossen = ausgeschlosseneTageByPersonId[person.id] || [];
        for (const kandidatTag of tage) {
          if (kandidatTag === aktuellerTag) continue;
          // 23.09.2026: kein Tag, den schon ein anderer Platz derselben
          // Person hat (auch ein erzwungener).
          if (Object.keys(bester.versuch).some(k => k !== schluessel && personIdVonSchluessel(k) === person.id && bester.versuch[k] === kandidatTag)) continue;
          if (R.hatBindendeSperre(person.id, kandidatTag, bestehendeEreignisse)) continue;
          if (manuelleZuweisungen.some(z => z.personId === person.id && z.datumISO === kandidatTag)) continue;
          if (ausgeschlossen.includes(kandidatTag)) continue; // Feiertag-Ausgleich: dieser Tag bleibt für diese Person tabu
          const wochentagKey = R.wochentag(kandidatTag);
          if (person.arbeitstage && !person.arbeitstage.includes(wochentagKey)) continue;
          if (person.freieTagOptionen && !person.freieTagOptionen.includes(wochentagKey)) continue;

          const testVersuch = normalisiereVersuch({ ...bester.versuch, [schluessel]: kandidatTag }, freiWaehlbar); // P1
          const testBewertung = bewerteVersuch(testVersuch, wochenStartISO, personen, positionen, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, feiertage, kontoIndex, kontoWerte);
          if (istBesser(testBewertung, bester.bewertung)) {
            bester = { versuch: testVersuch, bewertung: testBewertung };
            verbessert = true;
          }
        }
      }
    }
    return bester;
  }

  /**
   * Hauptfunktion: verteilt freie Tage für eine Woche.
   *
   * @param wochenStartISO  Montag der Woche, "YYYY-MM-DD"
   * @param personen        wie in rechenmodul.js
   * @param positionen      wie in rechenmodul.js
   * @param bestehendeEreignisse  bereits bekannte Ereignisse (Urlaub,
   *                        Krankheit, Schule, ...) — werden nicht
   *                        verändert, nur berücksichtigt
   * @param optionen
   *   - versuche: Anzahl randomisierter Durchläufe (Default 5000,
   *     erneut erhöht 09.09.2026 — vorher 1000, davor 200/300. Getestet:
   *     1000≈0,6s, 5000≈1,9s, 10000≈3,5s pro Lauf (lokal gemessen, auf
   *     dem Gerät vermutlich langsamer) — 5000 als Punkt gewählt, der
   *     spürbar mehr Suchraum abdeckt, aber bei einem bewussten
   *     Button-Klick noch nicht unangenehm lang wird. Höher ist auf
   *     Wunsch jederzeit möglich, reine Zahl, keine Architekturfrage.
   *   - wunschtage: { personId: 'YYYY-MM-DD', ... } — optional
   *   - wichtigeWunschtage: { personId: true, ... } — optional,
   *     09.09.2026 (Ulf, Arzttermin-Fall): markiert einzelne Wünsche
   *     als wichtiger als andere. Wirkt NUR als Tie-Breaker
   *     GEGENÜBER ANDEREN Wunschtagen — kann nie eine Lücke oder
   *     einen Wochentag-Überschuss aufwiegen (siehe WICHTIG_GEWICHT).
   *   - historie: { personId: ['mo','di',...] } — Wochentage, an
   *     denen diese Person in den letzten Wochen schon frei hatte,
   *     für die Abschwächung bei Wiederholung
   *   - manuelleZuweisungen: [{ datumISO, positionId, personId }, ...]
   *     — Ulfs direkte Übersteuerung (05.09.2026), wird an den Rechner
   *     durchgereicht UND bei der Freie-Tage-Verteilung berücksichtigt
   *     (wer manuell eingeteilt ist, kann diesen Tag nicht frei haben)
   *
   * @returns {
   *   ereignisse: [...],       // die gewonnenen freierTag-Ereignisse
   *   luecken: N,               // Lücken der besten gefundenen Lösung
   *   wunschtageErfuellt: N,
   *   versucheGelaufen: N
   * }
   */
  function verteileFreieTage(wochenStartISO, personen, positionen, bestehendeEreignisse, optionen) {
    optionen = optionen || {};
    const versucheAnzahl = optionen.versuche || 5000;
    const wunschtageByPersonId = optionen.wunschtage || {};
    const wichtigeWunschtage = optionen.wichtigeWunschtage || {};
    const historieByPersonId = optionen.historie || {};
    const manuelleZuweisungen = optionen.manuelleZuweisungen || [];
    // 09.09.2026 (Ulf, Feiertag-Ausgleich) — personId -> [datumISO,...]:
    // Tage, die für eine bestimmte Person NIE ihr freier Tag sein
    // dürfen (sie arbeitet dort, z. B. am Feiertag). Kein Zusatztag,
    // nur Ausschluss eines Kandidaten — ihr einer freier Tag verschiebt
    // sich dadurch einfach auf einen anderen Wochentag.
    const ausgeschlosseneTageRoh = optionen.ausgeschlosseneTage || {};
    // Ergänzt 14.09.2026, rein additiv — Liste von ISO-Daten, für den
    // gewichteten Wochentag-Überschuss (siehe bewerteVersuch). Fehlt
    // sie, verhält sich jede Woche wie eine normale (kein Aufrufer MUSS
    // das mitgeben).
    const feiertage = optionen.feiertage || [];
    // Ergänzt 16.09.2026 (T-68), rein additiv: Konto-Rückkopplung. Ohne
    // `optionen.kontoDaten` ist kontoIndex null und der Posten exakt 0 --
    // kein Aufrufer MUSS das mitgeben.
    const kontoWerte = optionen.kontoWerte || KONTO_WERTE_STANDARD;
    const kontoIndex = baueKontoIndex(optionen.kontoDaten);

    // Erzwungene Zuweisungen (folgtFreierTag, z. B. nach Schule)
    // stehen vorab fest und werden nicht mitrandomisiert.
    // Seit 23.09.2026 über bauePlaetze() (Etappe B): mit
    // optionen.freieTageSoll mehrere Plätze je Person möglich.
    const plaetzeInfo = bauePlaetze(personen, wochenStartISO, bestehendeEreignisse, optionen.freieTageSoll, ausgeschlosseneTageRoh);
    const erzwungen = plaetzeInfo.erzwungen;
    const freiWaehlbar = plaetzeInfo.freiWaehlbar;
    const ausgeschlosseneTage = plaetzeInfo.ausgeschlosseneTage;

    // Höchstmöglich erreichbare Wunschtag-Punktzahl (statt einfacher
    // Personenzahl) — nötig, seit wichtige Wünsche mehr als 1 zählen
    // können; sonst würde die "perfekte Lösung"-Abbruchbedingung unten
    // nie mehr zutreffen, sobald mindestens ein Wunsch als wichtig
    // markiert ist.
    const maxWunschPunkte = Object.keys(wunschtageByPersonId).reduce(
      (summe, pid) => summe + (wichtigeWunschtage[pid] ? WICHTIG_GEWICHT : 1), 0
    );

    let bester = null;
    for (let i = 0; i < versucheAnzahl; i++) {
      const zufallsTeil = wuerfleVersuch(freiWaehlbar, wochenStartISO, wunschtageByPersonId, historieByPersonId, bestehendeEreignisse, manuelleZuweisungen, ausgeschlosseneTage);
      const versuch = normalisiereVersuch({ ...erzwungen, ...zufallsTeil }, freiWaehlbar); // P1
      const bewertung = bewerteVersuch(versuch, wochenStartISO, personen, positionen, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, feiertage, kontoIndex, kontoWerte);
      if (!bester || istBesser(bewertung, bester.bewertung)) {
        bester = { versuch, bewertung };
      }
      // Korrigiert 14.09.2026 — verwies noch auf das nicht mehr
      // existierende Feld `wochentagUeberschussNacht` (stillschweigend
      // immer `undefined`, Bedingung hätte NIE mehr gegriffen, jede
      // Suche wäre unnötig komplett durchgelaufen). Jetzt: wirklich
      // nichts mehr zu gewinnen, wenn alle Teil-Kosten bei 0 stehen und
      // die volle Wunschtag-Punktzahl erreicht ist.
      // Ergänzt 16.09.2026 (T-68): mit aktiver Konto-Rückkopplung gibt es
      // keine "perfekte" Lösung mehr, an der nichts mehr zu gewinnen wäre
      // -- der Ausgleichsposten ist kontinuierlich und fast nie 0. Die
      // Abbruchbedingung greift dann bewusst gar nicht, die Suche läuft
      // voll durch. Alternative wäre gewesen, `kontoAusgleichKosten === 0`
      // in die Bedingung aufzunehmen: das hätte praktisch nie mehr
      // gegriffen und wäre derselbe stille Dauerläufer gewesen wie der am
      // 14.09. korrigierte Verweis auf `wochentagUeberschussNacht`.
      if (!kontoIndex &&
          bester.bewertung.luecken === 0 && bester.bewertung.harteLuecken === 0 &&
          bester.bewertung.schichtwechselKosten === 0 && bester.bewertung.azubiEinsaetze === 0 &&
          bester.bewertung.wochentagUeberschussKosten === 0 && bester.bewertung.wunschtageErfuellt === maxWunschPunkte &&
          !bester.bewertung.stueckKosten) { // 23.09.2026: "am Stück" gehört zur perfekten Lösung
        break; // perfekte Lösung gefunden, weitere Versuche bringen nichts mehr
      }
    }

    // Nachbesserungs-Durchlauf (Hill-Climbing) — siehe
    // verbessereDurchLokaleSuche oben. Nur nötig, wenn die Zufallssuche
    // noch keine perfekte Lösung gefunden hat. Dieselbe Korrektur wie
    // oben (14.09.2026) — verwies noch auf das alte Feld.
    if (bester && (kontoIndex || !(bester.bewertung.luecken === 0 && bester.bewertung.harteLuecken === 0 &&
        bester.bewertung.schichtwechselKosten === 0 && bester.bewertung.azubiEinsaetze === 0 &&
        bester.bewertung.wochentagUeberschussKosten === 0 && bester.bewertung.wunschtageErfuellt === maxWunschPunkte &&
        !bester.bewertung.stueckKosten))) {
      bester = verbessereDurchLokaleSuche(bester, freiWaehlbar, wochenStartISO, personen, positionen, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, ausgeschlosseneTage, feiertage, kontoIndex, kontoWerte);
    }

    return {
      ereignisse: bester ? zuEreignissen(bester.versuch) : [],
      luecken: bester ? bester.bewertung.luecken : 0,
      // Ergänzt 13.09.2026, rein additiv: wie viele der Lücken keinen
      // Cross-Schicht-Kandidaten haben (siehe bewerteVersuch).
      harteLuecken: bester ? (bester.bewertung.harteLuecken || 0) : 0,
      // Ergänzt 14.09.2026, rein additiv (Punktesystem-Umbau) — die
      // Einzelwerte hinter gesamtKosten, für Anzeige/Nachvollziehbarkeit.
      gesamtKosten: bester ? (bester.bewertung.gesamtKosten || 0) : 0,
      schichtwechselKosten: bester ? (bester.bewertung.schichtwechselKosten || 0) : 0,
      azubiEinsaetze: bester ? (bester.bewertung.azubiEinsaetze || 0) : 0,
      wochentagUeberschussKosten: bester ? (bester.bewertung.wochentagUeberschussKosten || 0) : 0,
      kontoAusgleichKosten: bester ? (bester.bewertung.kontoAusgleichKosten || 0) : 0, // ergänzt 16.09.2026 (T-68)
      schuldAusgleichKosten: bester ? (bester.bewertung.schuldAusgleichKosten || 0) : 0, // ergänzt 16.09.2026 (T-10)
      wunschtageErfuellt: bester ? bester.bewertung.wunschtageErfuellt : 0,
      versucheGelaufen: versucheAnzahl,
      // Ergänzt 23.09.2026, rein additiv (Etappe B):
      stueckKosten: bester ? (bester.bewertung.stueckKosten || 0) : 0,
      nichtVergebenePlaetze: bester ? nichtVergeben(plaetzeInfo.alleSchluessel, bester.versuch) : []
    };
  }

  /**
   * Wie verteileFreieTage, liefert aber bis zu `optionen.varianten`
   * (Default 3) unterschiedliche gute Lösungen statt nur der einen
   * besten — genau das V1-Varianten-Prinzip (§4-Audit), jetzt auch
   * für die neue Verteilung (05.09.2026, Ulfs Frage "Plan
   * Variationen?"). Sortiert nach Lücken, dann erfüllten Wunschtagen;
   * Duplikate (exakt gleiche Tag-Zuweisung) werden nicht doppelt
   * aufgeführt.
   *
   * @returns [{ ereignisse, luecken, wunschtageErfuellt }, ...]
   */
  function verteileFreieTageVarianten(wochenStartISO, personen, positionen, bestehendeEreignisse, optionen) {
    optionen = optionen || {};
    const versucheAnzahl = optionen.versuche || 300;
    const anzahlVarianten = optionen.varianten || 3;
    const wunschtageByPersonId = optionen.wunschtage || {};
    const wichtigeWunschtage = optionen.wichtigeWunschtage || {};
    const historieByPersonId = optionen.historie || {};
    const manuelleZuweisungen = optionen.manuelleZuweisungen || [];
    const feiertage = optionen.feiertage || []; // ergänzt 14.09.2026, rein additiv
    const kontoWerte = optionen.kontoWerte || KONTO_WERTE_STANDARD; // ergänzt 16.09.2026 (T-68)
    const kontoIndex = baueKontoIndex(optionen.kontoDaten);

    // 23.09.2026 (Etappe B): Plätze statt Personen, siehe bauePlaetze().
    const plaetzeInfo = bauePlaetze(personen, wochenStartISO, bestehendeEreignisse, optionen.freieTageSoll, optionen.ausgeschlosseneTage || {});
    const erzwungen = plaetzeInfo.erzwungen;
    const freiWaehlbar = plaetzeInfo.freiWaehlbar;
    const ausgeschlosseneTage = plaetzeInfo.ausgeschlosseneTage;

    const gesehen = new Set();
    const kandidaten = [];
    for (let i = 0; i < versucheAnzahl; i++) {
      const zufallsTeil = wuerfleVersuch(freiWaehlbar, wochenStartISO, wunschtageByPersonId, historieByPersonId, bestehendeEreignisse, manuelleZuweisungen, ausgeschlosseneTage);
      // P1 (23.09.2026): feste Form VOR der Signatur, sonst gelten
      // {p: Mo, p#2: Di} und {p: Di, p#2: Mo} als zwei Pläne.
      const versuch = normalisiereVersuch({ ...erzwungen, ...zufallsTeil }, freiWaehlbar);
      const signatur = JSON.stringify(versuch);
      if (gesehen.has(signatur)) continue;
      gesehen.add(signatur);
      const bewertung = bewerteVersuch(versuch, wochenStartISO, personen, positionen, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, feiertage, kontoIndex, kontoWerte);
      kandidaten.push({ versuch, bewertung });
    }

    // Angeglichen 14.09.2026: dieselbe Rangfolge wie istBesser() --
    // Lücken, dann harte Lücken, dann gewichtete Gesamtkosten (statt
    // vorher nur Wunschtage). Ohne dieselbe Rangfolge würden
    // Varianten-Auswahl und Hill-Climbing unterschiedlich sortieren und
    // könnten sich gegenseitig überstimmen.
    kandidaten.sort((a, b) =>
      a.bewertung.luecken - b.bewertung.luecken ||
      (a.bewertung.harteLuecken || 0) - (b.bewertung.harteLuecken || 0) ||
      (a.bewertung.gesamtKosten || 0) - (b.bewertung.gesamtKosten || 0)
    );

    return kandidaten.slice(0, anzahlVarianten).map(k => ({
      ereignisse: zuEreignissen(k.versuch),
      luecken: k.bewertung.luecken,
      harteLuecken: k.bewertung.harteLuecken || 0, // ergänzt 13.09.2026, rein additiv
      // Ergänzt 14.09.2026, rein additiv (Punktesystem-Umbau):
      gesamtKosten: k.bewertung.gesamtKosten || 0,
      schichtwechselKosten: k.bewertung.schichtwechselKosten || 0,
      azubiEinsaetze: k.bewertung.azubiEinsaetze || 0,
      wochentagUeberschussKosten: k.bewertung.wochentagUeberschussKosten || 0,
      kontoAusgleichKosten: k.bewertung.kontoAusgleichKosten || 0, // ergänzt 16.09.2026 (T-68)
      schuldAusgleichKosten: k.bewertung.schuldAusgleichKosten || 0, // ergänzt 16.09.2026 (T-10)
      wunschtageErfuellt: k.bewertung.wunschtageErfuellt,
      // Ergänzt 23.09.2026, rein additiv (Etappe B):
      stueckKosten: k.bewertung.stueckKosten || 0,
      nichtVergebenePlaetze: nichtVergeben(plaetzeInfo.alleSchluessel, k.versuch)
    }));
  }

  /** Personen, deren Plätze in `versuch` fehlen (je fehlendem Platz einmal). */
  function nichtVergeben(alleSchluessel, versuch) {
    return alleSchluessel.filter(k => !(k in versuch)).map(personIdVonSchluessel);
  }

  const api = { verteileFreieTage, verteileFreieTageVarianten, rotationspersonen, wochentageMoSa, hatErsetzendeAbwesenheit, erzwungenerFreierTag,
    // Ergänzt 09.09.2026 (Auflösung der Spielwiesen-Duplizierung) —
    // diese drei werden von loeseFreieTagKonflikte (Cockpit-Seite,
    // gezielte Teil-Neuwürfelung nach einem manuellen Edit) direkt
    // gebraucht, nicht nur intern von verteileFreieTage.
    wuerfleVersuch, bewerteVersuch, zuEreignissen,
    // Ergänzt 16.09.2026 (T-68, Konto-Rückkopplung): beide werden von
    // test_konto_ausgleich.js direkt geprüft. Reiner Export.
    baueKontoIndex, tagWertFuerAuswahl,
    // Ergänzt 13.09.2026 (harteLuecken-Stufe): istBesser ist die
    // gemeinsame Rangfolge und wird für Tests/Nachvollziehbarkeit von
    // außen gebraucht. Reiner Export, keine Logik-Änderung.
    // Korrigiert 16.09.2026 (T-40): stand hier als "vierstufig", ist seit
    // dem Punktesystem-Umbau vom 14.09. DREIstufig (Lücken → harte
    // Lücken → gesamtKosten).
    istBesser,
    // Ergänzt 13.09.2026, Ulfs ausdrückliche Erlaubnis (einzige Änderung
    // an dieser Datei) — entwuerfe_berechnung.js soll dieselbe
    // Nachbesserungsrunde, die verteileFreieTage() intern schon nutzt,
    // auch auf die von verteileFreieTageVarianten() gelieferten
    // Varianten anwenden können. Reiner Export, keine Logik geändert.
    verbessereDurchLokaleSuche,
    // Ergänzt 14.09.2026 (Einstellungs-Editor für die
    // Punktesystem-Gewichte, Ulf: "brauchen wir jetzt noch den Editor
    // für die Punkte"). Reine Konfiguration, keine Logik-Änderung.
    setzeGewichte, resetGewichte, holeGewichte,
    // Ergänzt 23.09.2026 (Etappe B): für entwuerfe_berechnung.js
    // (Hill-Climbing) und die Testsuite.
    rotationsplaetze, bauePlaetze, normalisiereVersuch, versuchAusEreignissen, personIdVonSchluessel };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(global, api);
  }
})(typeof window !== 'undefined' ? window : global);

/**
 * ~~Bewusst noch offen: Feiertagswoche-Sonderfall~~ -- erledigt
 * 23.09.2026 über optionen.freieTageSoll (siehe Dateikopf). Die frühere
 * Beschreibung ("zweiter freierTag bei Feiertagsarbeit") war ungenau:
 * Feiertagsarbeit VERSCHIEBT den freien Tag, einen zusätzlichen gibt es
 * für Sonntagsarbeit in der Feiertagswoche und für jeden weiteren
 * Feiertag der Woche (E9, SCHICHTPLANER_V2_FEIERTAG_SONNTAG_REGELN.md).
 */
