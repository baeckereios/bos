/* ============================================================
   ausgleichskonto_berechnung.js — BäckereiOS SchichtPlaner
   ------------------------------------------------------------
   Berechnungslogik für das Ausgleichskonto (Baustein 2 aus
   SESSION_2026-09-12_KONTO_KRANKMELDER_KONZEPT.md). Verarbeitet
   EINEN offiziellen Plan (plaene/<Montag-ISO>) zu Punkt-Deltas pro
   Person -- schreibt selbst NICHTS nach Firestore, das bleibt
   Aufgabe von offizieller_plan.html (FieldValue.increment-Batch,
   siehe dort).

   FUND VOR DEM BAUEN (14./15.09.2026): diese Datei existierte
   bisher nur in der Doku, nicht als echte Datei -- offizieller_plan.
   html rief window.BOS_AUSGLEICHSKONTO_BERECHNUNG.verarbeiteWoche()
   bereits auf, lief aber ins Leere (TypeError, im .catch() sichtbar
   als "Fehlgeschlagen: ..."). Plan wurde dabei trotzdem offiziell
   (Schritt 1 lief unabhängig durch), nur die Konto-Verbuchung nie.
   System lief zum Fundzeitpunkt noch nicht produktiv -- keine
   rückwirkende Nachverarbeitung nötig (Ulf, 15.09.2026 bestätigt).

   REINE FUNKTION, KEIN EIGENER FIRESTORE-ZUGRIFF (bewusste
   Architektur-Entscheidung, 15.09.2026): anders als
   krankmelder_berechnung.js oder Teile von sonntagsplan_berechnung.js
   liest diese Datei nichts selbst aus Firestore. Alle externen Daten
   (angrenzende Sonntage, Wunschtag-Events, Feiertag-Offen-Status)
   müssen vom Aufrufer VORGELADEN und als `kontext`-Objekt übergeben
   werden. Grund: offizieller_plan.html hat ohnehin schon fast alles
   geladen bzw. lädt es kostengünstig gezielt nach -- hält diese Datei
   dafür isoliert testbar (wie sonntagsplan_berechnung.js's
   berechneMonat), keine Kopplung an window.db.

   DIE VIER KONTO-WERTE, GETRENNT (Ulf: "wenn du sagst getrennt, dann
   machen wir getrennt") -- freieTageSchuld (fünfter, konzeptioneller
   Wert) ist NICHT Teil dieser Datei, wird bereits korrekt direkt aus
   krankmelder.html geschrieben:
     - saldo           -- gewichteter Punktestand freier Tage (Tabelle
                           unten), nur der höchste zutreffende Bonus
                           pro Tag zählt, keine Addition ("kein
                           Arschloch-System", Ulf)
     - samstagKombi     -- Rohzählung ECHTER verlängerter Wochenenden
                           (Samstag frei + Sonntag danach frei)
     - montagKombi      -- Rohzählung ECHTER verlängerter Wochenenden
                           (Montag frei + Sonntag davor frei)
     - wunschtagScore   -- Rohzählung erfüllter Wunschtage
     - wochenGezaehlt   -- NEU 15.09.2026 (Kompendium T-07): Rohzählung,
                           in wie vielen Wochen diese Person ÜBERHAUPT in
                           die Saldo-Berechnung eingeflossen ist (Urlaub/
                           Krankheit/keinRotierenderFreierTag/Teilzeit-
                           Wochen zählen NICHT mit -- da gibt's ja keinen
                           bewerteTag()-Aufruf für sie). KEINE Wertung,
                           reiner Kontext: macht in bankkonto.html sichtbar,
                           ob ein niedriger Saldo "wenig verdient" oder
                           "wenig Wochen dabei" bedeutet, ohne dass die
                           Datei selbst eine Fairness-Entscheidung trifft
                           (bewusst KEIN Durchschnitt -- der Nenner dafür
                           wäre selbst eine eigene, angreifbare Entscheidung).

   SALDO-WERTETABELLE (Stand 15.09.2026, Ulf-Entscheidungen aus dem
   Chat vom selben Tag -- nur der höchste zutreffende Wert zählt).
   DIES SIND DIE DEFAULTS (siehe STANDARD_WERTE-Konstante unten) --
   seit v0.3 über Firestore einstellbar, siehe WERTE-KONFIGURATION:
     1    normaler freier Tag
     1,2  Montag oder Samstag frei, allein (kein weiterer Bonus)
     1,3  Feiertag frei, Betrieb an dem Tag lt. bos_zeitkontext OFFEN
          (typ:'feiertag' via BOS_IST_BESONDERER_TAG -- Ferien/
          Betriebsurlaub zählen bewusst NICHT, Ulf: "zu große
          Zeitfenster... ein Bonus, den jeder kriegt... Blödsinn")
     1,5  erfüllter Wunschtag
     1,5  Montag frei UND Sonntag davor auch frei
     2    Samstag frei UND Sonntag danach auch frei
     2    Feiertag (offen) frei UND Tag davor ODER danach auch frei

   WERTE-KONFIGURATION (neu, 15.09.2026): die sieben Werte oben sind
   keine Magic Numbers mehr im Code, sondern liegen als Fallback in
   STANDARD_WERTE (unten) UND sind per Firestore-Dokument
   einstellungen/ausgleichskonto_werte überschreibbar -- Editor dafür:
   zweiter Tab "Punkte-Werte" in bankkonto.html (admin/
   produktionsleitung, kein extra PIN, dieselbe Rollen-Absicherung wie
   der Rest der Seite). Ulf, 15.09.2026: "Punkte bitte nach firestore...
   das wird sonst zu kompliziert mit den zig verschiedenen Wegen" --
   JSON-Datei-Ansatz (wie bos_hamster_config.json) bewusst verworfen.
   offizieller_plan.html liest das Dokument in
   baueAusgleichskontoKontext() und reicht es als kontext.werte durch.
   Fehlt das Dokument komplett ODER fehlt nur ein einzelnes Feld darin:
   STANDARD_WERTE springt ein, Feld für Feld, kein Alles-oder-nichts
   (siehe baueWerte()). Die Reihenfolge der Bedingungen im Code bleibt
   unabhängig von den eingestellten Werten korrekt, weil Math.max()
   entscheidet, nicht eine feste Rangfolge -- ein Admin kann die Werte
   theoretisch "falsch herum" einstellen, ohne dass die Logik bricht.
   ACHTUNG (siehe offizieller_plan.html-Changelog / Chat 15.09.2026):
   der Datei-Boden von bos_zeitkontext.js (_holeReferenz) setzt JEDEN
   Feiertag standardmäßig auf offen:false -- der 1,3/2-Bonus greift
   nur, wenn für den Feiertag ein Firestore-Override (offen:true)
   existiert, z. B. über zeitkontext_editor.html gesetzt. Kein Bug,
   bewusster Systemstandard (Ulf, 29.08.2026: "wir sind Bäcker,
   Feiertage sind eher offen" -- Standard trotzdem nicht geändert,
   um Hamster/Verbrauchsberechnung nicht zu beeinflussen).

   ANGRENZENDE TAGE AUSSERHALB DER WOCHE: bei einer Mo-Sa-Woche kann
   ein "Tag davor/danach" außerhalb des Plans NUR der Sonntag vor
   Montag oder der Sonntag nach Samstag sein -- beide werden ohnehin
   für die Kombi-Boni gebraucht, es gibt keinen dritten Fall. Fehlt
   für einen dieser Sonntage das sonntagsplan-Dokument komplett (kein
   Bedarf an dem Tag) ODER ist die Person darin für keine Position
   eingetragen, zählt das als "frei" (Ulf, 15.09.2026, Fall 1a+1b:
   keine Sonderprüfung auf Urlaub/Krankheit, kein Sonderfall für
   fehlendes Dokument).

   WUNSCHTAG-ZUORDNUNG: nur exakter Datums-Treffer zwischen einem
   bos_events-Eintrag (type:'schichtplaner_wunschtag', kalenderwoche,
   personId, datum) und einem freierTag-Ereignis derselben Person am
   selben Datum zählt als erfüllt (Ulf, 15.09.2026: "die Person hatte
   das ja so geplant... alles andere gilt nicht"). plan.wunschtageErfuellt
   wird bewusst NICHT genutzt -- seit 14.09. eine GEWICHTETE Punktesumme
   aus freie_tage_verteilung.js, keine Personenzahl, siehe dortige Warnung.

   FUND, GEGEN entwuerfe.html VERIFIZIERT (15.09.2026, zweiter Testlauf --
   erster Versuch hatte type:'wunschtag' und einen datum-Bereichs-Query
   angenommen, beides falsch, siehe offizieller_plan.html-Changelog):
   der echte type-Wert ist 'schichtplaner_wunschtag', das Scoping-Feld
   ist 'kalenderwoche' (vom Absender gewählte Zielwoche), nicht datum.
   Kein `uebernommenFuerPersonId`-Feld existiert im Projekt -- die
   ursprüngliche Annahme dazu war frei erfunden, jetzt entfernt.

   WUNSCHTAG-PERSONID-LÜCKE, AUFGELÖST (15.09.2026, dritter Fund
   desselben Tages): self-eingereichte Wünsche (wunschtag.html) haben
   KEIN personId-Feld, nur bosKontoId -- der Generierungs-Motor
   (entwuerfe.html, "Motor kennt nur personId") wertet sie deshalb
   nicht. Gegen mein_konto.html verifiziert: personen.bosKontoId ist
   der bereits etablierte, echte Verknüpfungsmechanismus (dort per
   Firestore-where-Query aufgelöst). Diese Datei löst jetzt genauso auf
   -- ohne Zusatz-Query, weil der Aufrufer personenListe (inkl.
   bosKontoId) bereits geladen hat (siehe baueBosKontoIdIndex(),
   kontext.personenListe). Ulf, 15.09.2026: "es ist alles noch im
   Test... keine Verknüpfungen" -- ändert deshalb HEUTE noch nichts
   Sichtbares (keine echte Person trägt aktuell eine echte bosKontoId),
   ist aber bereit, sobald das gepflegt wird, ohne erneuten Code-Eingriff.
   ACHTUNG, bewusst NICHT mitgelöst: entwuerfe.html selbst löst
   bosKontoId weiterhin NICHT auf -- diese Lücke betrifft also weiterhin
   die Plan-Generierung (welche Wünsche in Varianten einfließen), nur
   nicht mehr das Ausgleichskonto. Größere, eigenständige Datei
   (3000+ Zeilen), heute bewusst nicht angefasst.

   Voraussetzung: keine (reine Funktion, kein rechenmodul.js-Bezug).
   Aufrufer: offizieller_plan.html, siehe dortiger Kopf für
   baueAusgleichskontoKontext() -- sammelt genau das kontext-Objekt,
   das verarbeiteWoche() hier erwartet.

   CHANGELOG
     2026-09-15 · 07:23 · v0.1 · Feature
       Erste Version. Datei existierte vorher nur als Doku-Behauptung,
       nicht als echter Code (siehe Fund oben). verarbeiteWoche(plan,
       kontext) -- Signatur bewusst um kontext erweitert gegenüber der
       ursprünglich dokumentierten verarbeiteWoche(plan), weil die
       reine Funktion die Zusatzdaten von außen braucht.
     2026-09-15 · 07:59 · v0.2 · Fix
       Live im zweiten Testlauf gefunden: wunschtagScore blieb bei allen
       Personen 0, obwohl die Kachel "1 Wünsche erfüllt" zeigte. Ursache
       gegen entwuerfe.html verifiziert (siehe WUNSCHTAG-ZUORDNUNG oben) --
       baueWunschtagIndex() korrigiert: kein erfundenes
       uebernommenFuerPersonId-Feld mehr, dafür Dedupe auf den neuesten
       Eintrag pro Person (mehrere Einträge = Änderung, kein Update/
       Delete). Zugehöriger Query-Fix (type/kalenderwoche statt
       type/datum-Bereich) lebt in offizieller_plan.html, siehe dortiger
       Changelog.
     2026-09-15 · 08:35 · v0.3 · Feature
       Ulf: Punkte-Werte sollen einstellbar sein, aber über Firestore,
       nicht als JSON-Datei ("zu kompliziert mit den zig verschiedenen
       Wegen"). Die sieben Werte aus der Saldo-Wertetabelle (siehe
       Kopf) in STANDARD_WERTE-Konstante gezogen, verarbeiteWoche()
       nimmt jetzt kontext.werte entgegen (Firestore-Override,
       einstellungen/ausgleichskonto_werte, Feld-für-Feld-Fallback auf
       STANDARD_WERTE über baueWerte()). Editor: zweiter Tab in
       bankkonto.html. Kein Verhaltensunterschied, wenn das Dokument
       fehlt -- exakt dieselbe Tabelle wie zuvor.
     2026-09-15 · 08:52 · v0.4 · Feature
       Wunschtag-personId-Lücke für diese Datei aufgelöst (siehe
       WUNSCHTAG-PERSONID-LÜCKE im Kopf): neue baueBosKontoIdIndex(),
       baueWunschtagIndex() nimmt jetzt zusätzlich einen
       bosKontoIdIndex-Parameter und löst fehlende personId darüber
       auf. verarbeiteWoche() erwartet dafür neu kontext.personenListe.
       Ändert heute noch nichts Sichtbares (keine echten bosKontoId-
       Verknüpfungen im System), ist aber bereit, sobald sie gepflegt
       werden. entwuerfe.html/Plan-Generierung bewusst nicht mitgelöst,
       eigene, größere Baustelle.
     2026-09-15 · 10:26 · v0.5 · Feature
       T-07 aus dem Kompendium-Code-Abgleich: neuer Wert
       wochenGezaehlt/wochenGezaehltDelta -- reine Zählung, in wie
       vielen Wochen eine Person überhaupt einen bewerteTag()-Eintrag
       bekommen hat, unabhängig von der Punktehöhe. Kontext für
       bankkonto.html, kein Eingriff in die Saldo-Logik, bewusst kein
       Durchschnitt (siehe Kopf, WERTE-KONFIGURATION-Nachbarabschnitt).
     2026-09-16 · 10:14 · v0.7 · Feature (T-71, T-73, T-10)
       Drei zusammenhängende Ergänzungen, alle rein additiv:
       (1) buchungen: pro Person und Tag wird protokolliert, was
       gutgeschrieben wurde (Saldo + alle Zähler). offizieller_plan.html
       legt das als plan.kontoBuchung ab, der Krankmelder nimmt später
       exakt diese Beträge zurück, statt sie neu zu berechnen -- keine
       Drift bei geänderten Punkte-Werten, und nebenbei der Verlauf, der
       bisher fehlte.
       (2) plan.verzichte (aus Entwürfe, T-73): bucht freieTageSchuld
       und legt einen Delta-Eintrag an, damit wochenGezaehlt mitzählt --
       ohne den fiele die Woche, in der die Person nichts bekommen hat,
       aus ihrem Durchschnitt heraus.
       (3) Schuld-Abbau (T-10): wer offene Schuld hat und einen
       ÜBERDURCHSCHNITTLICH guten Tag bekommt, dessen Schuld sinkt um 1
       (höchstens einmal pro Woche). Der reguläre Rotationstag zählt
       dafür bewusst nicht -- er wäre keine Entschädigung. Ohne diesen
       Abbau bliebe eine einmal erworbene Schuld für immer stehen.
       NEUE REGEL, von Ulf noch zu bestätigen.
     2026-09-16 · 09:51 · v0.6 · Feature (T-68)
       Ulfs Entscheidung vom 16.09.: ein PRIORISIERTER ("wichtiger")
       Wunschtag bekommt den Wunsch-Aufschlag im Saldo nicht mehr --
       Anlass war ein Kollege mit wöchentlichem Arzttermin. Der Tag
       zählt weiterhin als bekommener freier Tag (normaler Tageswert)
       und unverändert im Rohzähler wunschtagScore; nur der Aufschlag
       entfällt. baueWunschtagIndex() speichert dafür das
       wichtig-Kennzeichen statt pauschal true -- vorhandener Schlüssel
       bedeutet weiterhin "Wunsch erfüllt". Wirkt dadurch automatisch
       korrekt in der Konto-Rückkopplung (T-68 in
       freie_tage_verteilung.js), ohne dass die dortige Formel eine
       Ausnahme kennen muss.
     2026-09-23 · 09:02 · v0.8 · Feature (E16, Feiertag-Sonntag-Regeln)
       Ulfs Entscheidung vom 23.09., 08:51 (SCHICHTPLANER_V2_FEIERTAG_
       SONNTAG_REGELN.md, E16): In einer Feiertagswoche werden
       freierTag-Ereignisse NICHT gebucht. Jeder von der Rotation
       verteilte freie Tag ist dort ein Ausgleich -- für den gearbeiteten
       Feiertag, für den gearbeiteten Sonntag (Sonntag-Plus) oder als
       verschobener Tag dessen, der den Feiertag arbeitet, stellvertretend
       für den freien Feiertag der anderen. Der freie Feiertag selbst
       (grund 'feiertag') wurde schon bisher nicht gebucht; ohne E16 stünde
       der Feiertagsarbeiter im Konto so da, als hätte er mehr Gutes
       bekommen (Ulf: "sonst wird der Kollege ja bestraft").
       Feiertagswoche = mindestens ein Tag in kontext.feiertageOffenProDatum,
       egal ob offen:true oder offen:false (E5: auch ein geschlossener
       Feiertag). Der Schlüsselsatz dieses Objekts IST die Feiertagsliste
       der Woche (offizieller_plan.html, baueAusgleichskontoKontext).
       Unverändert: Verzicht (T-73) wird weiter gebucht, samt
       wochenGezaehlt. Folgen, bewusst: in einer Feiertagswoche kein
       Wunsch-Aufschlag, kein wunschtagScore, keine Kombi-Zähler, kein
       Schuld-Abbau über einen guten Tag, und wer nur freie Tage hatte,
       zählt diese Woche nicht in wochenGezaehlt. Ein Sonntags-Feiertag
       (O23) wird hier noch NICHT erkannt: der Kontext enthält nur Mo-Sa.
       Normale Wochen: exakt unverändert.
   ============================================================ */

window.BOS_AUSGLEICHSKONTO_BERECHNUNG = (function () {

  // Fallback, falls einstellungen/ausgleichskonto_werte in Firestore
  // fehlt oder ein einzelnes Feld darin fehlt (15.09.2026, siehe
  // WERTE-KONFIGURATION im Datei-Kopf) -- exakt die Tabelle vom
  // ursprünglichen Bau-Tag. Jedes einzelne Feld wird gegen dieses
  // Objekt gemerged, kein Alles-oder-nichts.
  var STANDARD_WERTE = {
    normal: 1,
    montagOderSamstagAllein: 1.2,
    feiertagAllein: 1.3,
    wunschtag: 1.5,
    montagKombi: 1.5,
    samstagKombi: 2,
    feiertagKombi: 2
  };

  function baueWerte(override) {
    var werte = {};
    Object.keys(STANDARD_WERTE).forEach(function (feld) {
      var wert = override && override[feld];
      werte[feld] = (typeof wert === 'number' && !isNaN(wert)) ? wert : STANDARD_WERTE[feld];
    });
    return werte;
  }

  /**
   * Baut personId -> Konto-ID-Zuordnung aus der geladenen personenListe
   * (Feld bosKontoId, siehe personen-Schema) -- exakt dieselbe Auflösung
   * wie mein_konto.html (dort per Firestore-where-Query, hier ohne
   * Zusatz-Query, weil der Aufrufer personenListe eh schon geladen hat).
   */
  function baueBosKontoIdIndex(personenListe) {
    var index = {};
    (personenListe || []).forEach(function (p) {
      if (p.bosKontoId) index[p.bosKontoId] = p.id;
    });
    return index;
  }

  function isoDatumAusJsDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Datum X Tage vor/nach einem ISO-Datum (negativ = vorher).
  function verschobenesDatum(iso, tageVersatz) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + tageVersatz);
    return isoDatumAusJsDate(d);
  }

  /**
   * Index aller freierTag-Ereignisse der Woche: 'personId|datumISO' -> true.
   * ereignisse tragen von/bis (Format wie überall sonst im Projekt) --
   * i. d. R. ein Tag, aber generisch als Zeitraum behandelt, falls
   * doch mehrtägig gespeichert.
   */
  function baueFreierTagIndex(plan) {
    var index = {};
    (plan.ereignisse || []).forEach(function (e) {
      if (e.grund !== 'freierTag') return;
      var d = new Date(e.von + 'T00:00:00');
      var bis = e.bis || e.von;
      while (isoDatumAusJsDate(d) <= bis) {
        index[e.personId + '|' + isoDatumAusJsDate(d)] = true;
        d.setDate(d.getDate() + 1);
      }
    });
    return index;
  }

  /**
   * Index erfüllbarer Wunschtage: 'personId|datum' -> true.
   *
   * personId wird ENTWEDER direkt aus dem Event genommen (manuell
   * eingetragene Wünsche haben es immer) ODER, falls es fehlt, über
   * bosKontoId aufgelöst (bosKontoIdIndex, siehe baueBosKontoIdIndex) --
   * exakt dasselbe personen.bosKontoId-Verfahren wie mein_konto.html
   * (15.09.2026, Ulf: "es ist alles noch im Test... keine
   * Verknüpfungen" -- Auflösung ist bereit, ändert aber erst etwas,
   * sobald echte Personen echte bosKontoId-Werte tragen). Bleibt
   * personId trotzdem unauflösbar: Event zählt nicht mit (deckt sich
   * mit entwuerfe.html, das self-eingereichte Wünsche ohne Verknüpfung
   * ebenfalls nicht in die Plan-Generierung einbezieht -- ACHTUNG,
   * NICHT identisch: entwuerfe.html selbst löst bosKontoId bisher noch
   * NICHT auf, siehe SESSION_2026-09-15_AUSGLEICHSKONTO_BERECHNUNG.md,
   * eigenständige Baustelle, nicht Teil dieser Datei).
   *
   * Mehrere Einträge derselben Person (kein Update/Delete in
   * wunschtag.html -- eine Änderung ist ein zweiter Eintrag): nur der
   * NEUESTE (eingereichtAm) zählt, wie in entwuerfe.html.
   */
  function baueWunschtagIndex(wunschtagEvents, bosKontoIdIndex) {
    bosKontoIdIndex = bosKontoIdIndex || {};
    var neuesterProPerson = {};
    (wunschtagEvents || []).forEach(function (e) {
      var personId = e.personId || (e.bosKontoId && bosKontoIdIndex[e.bosKontoId]) || null;
      if (!personId || !e.datum) return;
      var ms = (e.eingereichtAm && typeof e.eingereichtAm.toMillis === 'function') ? e.eingereichtAm.toMillis() : 0;
      var bisher = neuesterProPerson[personId];
      var bisherMs = bisher ? ((bisher.eingereichtAm && typeof bisher.eingereichtAm.toMillis === 'function') ? bisher.eingereichtAm.toMillis() : 0) : -1;
      if (ms > bisherMs) neuesterProPerson[personId] = e;
    });
    var index = {};
    Object.keys(neuesterProPerson).forEach(function (personId) {
      // Geändert 16.09.2026 (T-68, Ulfs Entscheidung): der Wert ist jetzt
      // das `wichtig`-Kennzeichen des Wunsches statt pauschal `true`.
      // Vorhandener Schlüssel = Wunsch erfüllt (unverändert), Wert true =
      // als wichtig/priorisiert eingereicht.
      index[personId + '|' + neuesterProPerson[personId].datum] = !!neuesterProPerson[personId].wichtig;
    });
    return index;
  }

  /**
   * War eine Person an einem gegebenen Datum frei? Für Daten innerhalb
   * der Woche: freierTagIndex. Für die beiden angrenzenden Sonntage
   * (siehe Kopf, "Angrenzende Tage"): sonntagsplan-Dokument, fehlende
   * Zuweisung ODER fehlendes Dokument zählt als frei.
   */
  function warPersonFrei(personId, datumISO, freierTagIndex, sonntagDavorDatum, sonntagDavorDoc, sonntagDanachDatum, sonntagDanachDoc) {
    var sonntagDoc = null;
    if (datumISO === sonntagDavorDatum) sonntagDoc = sonntagDavorDoc;
    else if (datumISO === sonntagDanachDatum) sonntagDoc = sonntagDanachDoc;
    else return !!freierTagIndex[personId + '|' + datumISO];

    if (!sonntagDoc) return true; // kein Dokument -> als frei gewertet, siehe Kopf
    var zuweisungen = sonntagDoc.zuweisungen || {};
    return Object.keys(zuweisungen).every(function (posId) { return zuweisungen[posId] !== personId; });
  }

  /**
   * Verarbeitet einen offiziellen Plan zu Punkt-Deltas pro Person.
   * Schreibt selbst nichts -- reine Berechnung, Firestore-Schreiben
   * bleibt Aufgabe des Aufrufers (siehe offizieller_plan.html).
   *
   * @param {Object} plan - plaene/<Montag-ISO>-Dokument, siehe dortiges
   *        Schema (ereignisse, tage, montag)
   * @param {Object} [kontext]
   * @param {Array}  [kontext.wunschtagEvents] - bos_events,
   *        type:'schichtplaner_wunschtag', eingegrenzt auf
   *        kalenderwoche == plan.montag
   * @param {Array}  [kontext.personenListe] - personen-Dokumente (inkl. id,
   *        bosKontoId) -- NEU 15.09.2026, für die bosKontoId->personId-
   *        Auflösung bei self-eingereichten Wunschtagen ohne personId,
   *        siehe baueBosKontoIdIndex()/baueWunschtagIndex()
   * @param {Object|null} [kontext.sonntagDavor] - sonntagsplan-Dokument
   *        für den Sonntag VOR plan.montag, oder null falls es nicht existiert
   * @param {Object|null} [kontext.sonntagDanach] - sonntagsplan-Dokument
   *        für den Sonntag NACH dem letzten Plan-Tag (Samstag), oder null
   * @param {Object} [kontext.feiertageOffenProDatum] - { 'YYYY-MM-DD': boolean },
   *        NUR für Tage der Woche, die laut BOS_IST_BESONDERER_TAG
   *        typ:'feiertag' sind -- Wert = bos_zeitkontext status().offen
   * @param {Object} [kontext.werte] - Override für die Saldo-Wertetabelle
   *        (siehe STANDARD_WERTE oben), z. B. aus
   *        einstellungen/ausgleichskonto_werte (Firestore). Fehlende
   *        einzelne Felder fallen auf STANDARD_WERTE zurück, kein
   *        Alles-oder-nichts.
   * @returns {Promise<Object>} { [personId]: { saldoDelta, samstagKombiDelta,
   *        montagKombiDelta, wunschtagScoreDelta, wochenGezaehltDelta,
   *        freieTageSchuldDelta, buchungen: { datumISO: {...} } } } --
   *        exakt die Form, die offizieller_plan.html per FieldValue.increment
   *        schreibt
   */
  function verarbeiteWoche(plan, kontext) {
    kontext = kontext || {};
    var bosKontoIdIndex = baueBosKontoIdIndex(kontext.personenListe);
    var wunschtagIndex = baueWunschtagIndex(kontext.wunschtagEvents, bosKontoIdIndex);
    var freierTagIndex = baueFreierTagIndex(plan);
    var feiertageOffenProDatum = kontext.feiertageOffenProDatum || {};
    // E16 (23.09.2026): jeder Feiertag der Woche zählt, offen ODER
    // geschlossen (E5) -- deshalb die Schlüssel, nicht die Werte.
    var istFeiertagswoche = Object.keys(feiertageOffenProDatum).length > 0;
    var werte = baueWerte(kontext.werte);
    // T-10/T-71 (16.09.2026): aktuelle Schuldstände, für den Abbau unten.
    // Fehlen sie, wird nichts abgebaut -- rückwärtskompatibel.
    var schuldProPerson = kontext.schuldProPerson || {};

    var samstagDatum = verschobenesDatum(plan.montag, 5);
    var sonntagDavorDatum = verschobenesDatum(plan.montag, -1);
    var sonntagDanachDatum = verschobenesDatum(samstagDatum, 1);

    var deltas = {};
    function delta(personId) {
      // wochenGezaehltDelta: immer genau 1 beim ERSTEN Delta-Eintrag
      // dieser Person in dieser Woche (siehe || -- der Ausdruck läuft
      // nur beim Anlegen, nicht bei jedem weiteren bewerteTag()-Aufruf
      // derselben Person). T-07: reine Zählung, wie oft eine Person
      // überhaupt in die Saldo-Berechnung eingeflossen ist -- KEIN
      // Eingriff in die Punkte-Logik, nur zusätzlicher Kontext für
      // bankkonto.html, damit ein niedriger Saldo nicht mit "hat
      // wenig verdient" verwechselt wird, wenn er eigentlich "war
      // wenig Wochen dabei" bedeutet (Urlaub/Krankheit/Teilzeit).
      // Ergänzt 16.09.2026 (T-71/T-10): `freieTageSchuldDelta` für
      // Verzichte und deren Abbau, `buchungen` als Protokoll dessen,
      // was an welchem Tag gutgeschrieben wurde -- der Krankmelder
      // nimmt damit später exakt den gebuchten Betrag zurück, statt
      // ihn neu zu berechnen (keine Drift bei geänderten Punkte-Werten).
      deltas[personId] = deltas[personId] || { saldoDelta: 0, samstagKombiDelta: 0, montagKombiDelta: 0, wunschtagScoreDelta: 0, wochenGezaehltDelta: 1, freieTageSchuldDelta: 0, buchungen: {} };
      return deltas[personId];
    }

    function frei(personId, datumISO) {
      return warPersonFrei(personId, datumISO, freierTagIndex, sonntagDavorDatum, kontext.sonntagDavor, sonntagDanachDatum, kontext.sonntagDanach);
    }

    function bewerteTag(personId, datumISO) {
      var wochentag = new Date(datumISO + 'T00:00:00').getDay(); // 0=So .. 6=Sa
      var istMontag = wochentag === 1;
      var istSamstag = wochentag === 6;

      // Geändert 16.09.2026 (T-68): zwei getrennte Aussagen aus einem
      // Index. `istWunschtag` = der Wunsch wurde erfüllt (zählt weiterhin
      // voll in den Rohzähler wunschtagScore). `istWichtigerWunschtag` =
      // er war als wichtig/priorisiert eingereicht -- dann entfällt der
      // Wunsch-AUFSCHLAG im Saldo (siehe unten).
      var wunschSchluessel = personId + '|' + datumISO;
      var istWunschtag = wunschtagIndex[wunschSchluessel] !== undefined;
      var istWichtigerWunschtag = wunschtagIndex[wunschSchluessel] === true;
      var istMontagKombi = istMontag && frei(personId, sonntagDavorDatum);
      var istSamstagKombi = istSamstag && frei(personId, sonntagDanachDatum);

      var istFeiertagOffen = feiertageOffenProDatum[datumISO] === true;
      var istFeiertagKombi = istFeiertagOffen && (
        frei(personId, verschobenesDatum(datumISO, -1)) || frei(personId, verschobenesDatum(datumISO, 1))
      );

      // Höchster zutreffender Wert gewinnt -- keine Addition ("kein
      // Arschloch-System", Ulf). Werte aus 'werte' (Firestore-Override
      // oder STANDARD_WERTE), Bedingungen unverändert. Die Reihenfolge
      // dieser Zeilen ist reine Lesbarkeit, keine erzwungene Rangfolge
      // -- Math.max entscheidet, unabhängig davon, ob ein Admin die
      // Werte später "unsortiert" einstellt.
      var saldoWert = werte.normal;
      if (istMontag || istSamstag) saldoWert = Math.max(saldoWert, werte.montagOderSamstagAllein);
      if (istFeiertagOffen) saldoWert = Math.max(saldoWert, werte.feiertagAllein);
      // Ulf, 16.09.2026: ein PRIORISIERTER Wunsch bekommt den
      // Wunsch-Aufschlag NICHT. Anlass war ein Kollege mit wöchentlichem
      // Arzttermin -- für eine Notwendigkeit den Fairness-Nachteil zu
      // kassieren wäre schief. Der Tag zählt weiterhin als bekommener
      // freier Tag (normaler Tageswert oben/unten) und auch im Rohzähler
      // wunschtagScore, nur der Aufschlag entfällt. Dadurch wirkt es
      // automatisch korrekt in der Konto-Rückkopplung (T-68), ohne dass
      // die dortige Formel eine Ausnahme kennen muss.
      if (istWunschtag && !istWichtigerWunschtag) saldoWert = Math.max(saldoWert, werte.wunschtag);
      if (istMontagKombi) saldoWert = Math.max(saldoWert, werte.montagKombi);
      if (istSamstagKombi) saldoWert = Math.max(saldoWert, werte.samstagKombi);
      if (istFeiertagKombi) saldoWert = Math.max(saldoWert, werte.feiertagKombi);

      var d = delta(personId);
      d.saldoDelta += saldoWert;
      if (istMontagKombi) d.montagKombiDelta += 1;
      if (istSamstagKombi) d.samstagKombiDelta += 1;
      if (istWunschtag) d.wunschtagScoreDelta += 1;

      // T-71: protokollieren, was dieser eine Tag eingebracht hat.
      // Bewusst mit allen Zählern, nicht nur dem Saldo -- wird der Tag
      // später hergegeben, behauptet sonst z. B. wunschtagScore weiter
      // "Wunsch erfüllt", obwohl die Person gearbeitet hat.
      d.buchungen[datumISO] = {
        saldo: saldoWert,
        wunschtagScore: istWunschtag ? 1 : 0,
        montagKombi: istMontagKombi ? 1 : 0,
        samstagKombi: istSamstagKombi ? 1 : 0
      };

      // T-10, Schuld-Abbau: wer noch offene freieTageSchuld hat und in
      // dieser Woche einen ÜBERDURCHSCHNITTLICH guten Tag bekommt, hat
      // seinen Anspruch damit eingelöst -- die Schuld sinkt um 1.
      // Bewusst nur bei einem Tag über dem Normalwert: der reguläre
      // Rotationstag, den die Person ohnehin bekommen hätte, ist keine
      // Entschädigung. Ohne diesen Abbau bliebe eine einmal erworbene
      // Schuld für immer stehen und die Person dauerhaft bevorzugt.
      // NEUE ENTSCHEIDUNG vom 16.09.2026 -- von Ulf noch zu bestätigen.
      if (!d._schuldAbgebaut && saldoWert > werte.normal && (schuldProPerson[personId] || 0) > 0) {
        d.freieTageSchuldDelta -= 1;
        d._schuldAbgebaut = true; // höchstens einmal pro Woche
      }
    }

    // T-73 (16.09.2026): Verzichte, die schon in Entwürfe festgelegt
    // wurden. Anders als beim Krankmelder ist hier noch nichts gebucht
    // -- die Person hat schlicht kein freierTag-Ereignis. Zu tun bleibt
    // zweierlei: die Schuld buchen, und die Woche trotzdem mitzählen.
    // Letzteres ist wichtig: ohne einen Delta-Eintrag fiele die Person
    // ganz aus wochenGezaehlt heraus, und ihr Durchschnitt würde die
    // Woche, in der sie nichts bekommen hat, einfach ignorieren -- die
    // Ungerechtigkeit verschwände aus der Statistik, statt sich
    // auszugleichen.
    (plan.verzichte || []).forEach(function (v) {
      if (!v || !v.personId) return;
      delta(v.personId).freieTageSchuldDelta += 1;
    });

    (plan.ereignisse || []).forEach(function (e) {
      if (e.grund !== 'freierTag') return;
      // E16 (23.09.2026): in einer Feiertagswoche wird kein freierTag
      // gebucht, siehe Changelog v0.8. Der Verzicht oben bleibt davon
      // bewusst unberührt.
      if (istFeiertagswoche) return;
      var d = new Date(e.von + 'T00:00:00');
      var bis = e.bis || e.von;
      while (isoDatumAusJsDate(d) <= bis) {
        bewerteTag(e.personId, isoDatumAusJsDate(d));
        d.setDate(d.getDate() + 1);
      }
    });

    // Internes Merkfeld wieder entfernen -- es hat im Ergebnis (und
    // erst recht in Firestore) nichts verloren.
    Object.keys(deltas).forEach(function (pid) { delete deltas[pid]._schuldAbgebaut; });

    return Promise.resolve(deltas);
  }

  return {
    STANDARD_WERTE: STANDARD_WERTE,
    isoDatumAusJsDate: isoDatumAusJsDate,
    verschobenesDatum: verschobenesDatum,
    baueFreierTagIndex: baueFreierTagIndex,
    baueBosKontoIdIndex: baueBosKontoIdIndex,
    baueWunschtagIndex: baueWunschtagIndex,
    warPersonFrei: warPersonFrei,
    verarbeiteWoche: verarbeiteWoche,
    // Ergänzt 23.09.2026 (E16), rein additiv -- dieselbe Regel für
    // Aufrufer, die sie anzeigen wollen.
    istFeiertagswoche: function (kontext) {
      return Object.keys((kontext && kontext.feiertageOffenProDatum) || {}).length > 0;
    }
  };

})();
