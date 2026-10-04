/**
 * entwuerfe_berechnung.js — SchichtPlaner V2
 *
 * 2026-10-04 · 14:39 · Online-Gang: Nachnamen von Kollegen in den
 * Kommentaren dieser Datei durch Platzhalter („Person K“ usw.) ersetzt —
 * das Repo wird öffentlich. Nur Kommentare, kein Code. Zuordnung kennt
 * Ulf; siehe 2026-10-04_ONLINE_GANG.md.
 *
 * Ausgelagert aus entwuerfe.html (13.09.2026, Ulf: "Die Datei wird
 * langsam riesig... Können und wollen wir Dinge auslagern?"), nach
 * exakt demselben Muster wie sonntagsplan_berechnung.js und
 * krankmelder_berechnung.js: reine Funktionen ohne DOM-/Firestore-
 * Zugriff, alle Eingaben als explizite Parameter statt Closure-
 * Variablen. entwuerfe.html bleibt für UI/Rendern/Firestore zuständig,
 * ruft diese Datei über window.BOS_ENTWUERFE_BERECHNUNG auf.
 *
 * Voraussetzung: rechenmodul.js UND freie_tage_verteilung.js sind vorher
 * eingebunden (als <script> im Browser) -- nutzt deren globale
 * berechneTagAlleSchichten(), istEinsetzbar(), istRuhezeitRelevanterWechsel()
 * (rechenmodul.js) sowie rotationspersonen(), erzwungenerFreierTag(),
 * bewerteVersuch(), verbessereDurchLokaleSuche(), zuEreignissen()
 * (freie_tage_verteilung.js, seit 13.09.2026 vollständig exportiert).
 * Beide Kern-Dateien bleiben dabei unangetastet (Architektur-Prinzip
 * seit Projektbeginn) -- außer dem einen, von Ulf ausdrücklich
 * erlaubten Export-Eintrag in freie_tage_verteilung.js selbst.
 *
 * CHANGELOG
 *   2026-09-13 · 03:32 · v0.1 · Auslagerung
 *     Fünf Funktionen 1:1 aus entwuerfe.html übernommen, dabei auf
 *     explizite Parameter statt Closure-Variablen umgestellt:
 *     findeTauschVorschlaege, baueLueckenListeFuerVariante,
 *     berechneTagesDetails (unverändertes Verhalten). Zwei NEU
 *     zusammengefasst statt einfach kopiert: berechneNeueTageFuerZeitraum
 *     (vorher fast identischer Code in akzeptiereVorschlag() UND
 *     akzeptiereTausch()) und baueDebugExportDaten (vorher der
 *     Datenaufbereitungs-Teil von exportiereDebugDaten(), Download-
 *     Mechanik bleibt bewusst in entwuerfe.html, da Blob/DOM).
 *   2026-09-13 · 03:45 · v0.2 · Feature
 *     Ulf: manuell veränderbare Varianten -- nicht nur Lücken füllen,
 *     auch zwei bereits besetzte Zellen direkt tauschen. Neue
 *     baueManuellenTauschEreignisse(): baut die zwei nötigen manuellen
 *     Zuweisungen, UND -- falls eine der beiden Zellen in einer anderen
 *     Schicht liegt als die jeweilige Stammschicht der Person -- das
 *     passende crossSchichtEinsatz-Ereignis dafür, damit ein manueller
 *     Schicht-Tausch dieselbe "(aus Früh)"/"(aus Nacht)"-Kennzeichnung
 *     bekommt wie ein bestätigter automatischer Tausch-Vorschlag (siehe
 *     entwuerfe.html v0.27), nicht eine stille, unsichtbare Umbuchung.
 *   2026-09-13 · 04:40 · v0.3 · Feature
 *     Ulf, direkt aus dem Gespräch über 5000-vs-300-Versuche und die
 *     Teigmacher-Analyse: zwei neue Funktionen.
 *     verbessereVarianteMitHillClimbing() wendet die Nachbesserungsrunde
 *     aus freie_tage_verteilung.js (bisher nur von verteileFreieTage()
 *     genutzt, NICHT von verteileFreieTageVarianten()) auch auf jede der
 *     drei Entwürfe-Varianten an. versucheCrossSchichtNachbesserung()
 *     füllt verbleibende Lücken automatisch über dieselbe Tausch-Suche
 *     wie der manuelle Chip, rundenweise bis kein Fortschritt mehr
 *     möglich ist. Beide reine Funktionen, mutieren nur das übergebene
 *     Varianten-Objekt, kein DOM-Zugriff.
 *   2026-09-13 · 05:32 · v0.4 · Feature
 *     Ulf, direkt im Anschluss: "Cross-Shift bitte anwenden wenn
 *     nötig... er tut so, als ob sie in der Woche in der Nachtschicht
 *     wären." Neue baueCrossSchichtVorabEreignisse() -- baut, VOR der
 *     Generierung, wochenweite crossSchichtEinsatz-Ereignisse für jede
 *     Frühschicht-Person, die auch in mindestens einem Nachtschicht-
 *     Positions-Pool steht. Fließt in entwuerfe.html (neue Checkbox in
 *     Reiter 1) in bestehendeEreignisse ein, bevor
 *     verteileFreieTageVarianten() UND verbessereVarianteMitHillClimbing()
 *     laufen -- die Suche kennt die zusätzlichen Kandidaten dann von
 *     Anfang an, nicht erst nachträglich wie
 *     versucheCrossSchichtNachbesserung() (bleibt unverändert bestehen,
 *     beide Werkzeuge ergänzen sich).
 *   2026-09-13 · 05:48 · v0.5 · Fix (Rückbau) + Feature
 *     Ulfs "Macht das überhaupt Sinn?" hatte recht -- mit echten
 *     Exportdaten bestätigt: baueCrossSchichtVorabEreignisse() (v0.4)
 *     hatte einen ernsten Nebeneffekt. istRuhezeitRelevanterWechsel() in
 *     rechenmodul.js prüft bei bestehender Cross-Schicht-Zuweisung NUR
 *     noch deren zielSchicht gegen die zu prüfende Position -- die
 *     tatsächliche Stammschicht wird dann gar nicht mehr erreicht. Eine
 *     Person mit wochenweitem Cross-Schicht-Ereignis verlor dadurch ihre
 *     EIGENE Position, an jedem Tag der Woche, nicht nur an tatsächlich
 *     benötigten (konkret beobachtet: Person Br verlor seine eigene
 *     Rondo-Position drei Tage lang, obwohl er dort nie für Nacht
 *     gebraucht wurde). Kein Parameter-Problem, ein Architektur-
 *     Mismatch -- auch ein kürzeres Tage-Fenster hätte es nicht
 *     behoben, nur den Schaden zeitlich eingegrenzt. Komplett
 *     zurückgebaut: Funktion samt Export entfernt, Checkbox in
 *     entwuerfe.html raus, bestehendeEreignisse/letzteVarianten wieder
 *     auf den Stand vor v0.4.
 *     Zweiter Fund dabei (Ulf, mit echten Daten beobachtet): Person L UND
 *     Person K wurden beide einzeln in die Nachtschicht geholt, an
 *     einem Tag sogar gleichzeitig -- für eine durch zwei fehlende
 *     Personen verursachte Lücke sollte bevorzugt EINE Person die ganze
 *     Woche wechseln, nicht mehrere verschiedene mit jeweils weniger
 *     Aufwand. versucheCrossSchichtNachbesserung() bevorzugt jetzt,
 *     unter mehreren gefundenen Kandidaten, wer in diesem
 *     Nachbesserungs-Durchlauf schon einmal herangezogen wurde -- nur
 *     eine Präferenz, kein Zwang (fällt zurück auf den ersten Fund,
 *     wenn niemand wiederverwendbar ist). Zwei Lücken auf demselben Tag
 *     brauchen weiterhin zwangsläufig zwei verschiedene Personen (kann
 *     nicht an zwei Stellen zugleich stehen) -- das ist keine
 *     Verbesserungsmöglichkeit, sondern eine physische Grenze.
 *   2026-09-13 · 05:55 · v0.6 · Feature
 *     Ulf, Screenshot der Lücken-Ansicht: "Ich finde das Datum irgendwie
 *     doof... das ist ja auch nur geraten... was will man eingeben als
 *     Mensch?" -- das Bis-Feld jeder Vorschlag-/Tausch-Option stand
 *     bisher immer auf dem einen Tag der Lücke selbst, unabhängig davon,
 *     ob dieselbe Position an den Folgetagen ebenfalls offen bleibt.
 *     baueLueckenListeFuerVariante() liefert jetzt zusätzlich
 *     empfohlenesBisDatum: schaut voraus, wie viele DIREKT folgende Tage
 *     dieselbe Position in derselben Schicht ebenfalls als Lücke zeigen
 *     (endet an der ersten Unterbrechung, nicht automatisch bis
 *     Samstag) -- genau das "Mindeste, um alle Lücken zu schließen".
 *     Bleibt ein reiner VORSCHLAG im Datumsfeld, frei änderbar.
 *   2026-09-13 · 10:28 · v0.7 · Umbau (Fix an der Wurzel)
 *     Ulf, nach dem crossSchichtEinsatz-Fund und der Frage "macht dieses
 *     Datum Sinn?": "Was wäre, wenn die Lücken in der Nachtschicht = die
 *     Tage wären, die eine Person aus der Frühschicht in die Nachtschicht
 *     kommen müsste?" -- geprüft und bestätigt: effektiveSchicht() (der
 *     einzige Nutzer von crossSchichtEinsatz in rechenmodul.js) wird im
 *     ganzen Rechenkern NIRGENDS aufgerufen, nur exportiert. Was die
 *     Kaskade tatsächlich trägt, ist manuelleZuweisungen -- prüft KEINE
 *     Ruhezeit, und berechneTagAlleSchichten() reicht "heute schon
 *     verplant" von Nacht zu Früh zu Sonntag durch (mit echten
 *     Minimal-Daten verifiziert: eine Person, die per manuelleZuweisungen
 *     auf eine Nacht-Position gesetzt wird, fällt an GENAU diesem Tag
 *     automatisch aus der eigenen Früh-Kaskade heraus -- an allen
 *     ANDEREN Tagen bleibt sie unangetastet, exakt das Gegenteil des
 *     alten Bugs).
 *     JEDE Cross-Schicht-Bestätigung läuft ab jetzt über
 *     manuelleZuweisungen statt crossSchichtEinsatz: neue
 *     baueTageweiseManuelleZuweisungen() (ein Eintrag pro Tag im
 *     Zeitraum) ersetzt die alte Ereignis-Erzeugung durchgängig.
 *     baueManuellenTauschEreignisse() radikal vereinfacht (kein
 *     personenListe-Parameter mehr, gibt direkt das Array zurück, kein
 *     crossSchichtEreignisse-Zweig mehr). versucheCrossSchichtNachbesserung()
 *     nutzt jetzt für BEIDE Seiten (Person UND Ersatz) manuelleZuweisungen.
 *     findeTauschVorschlaege()/baueDebugExportDaten() von
 *     crossSchichtEreignisse-Referenzen bereinigt.
 *     Die frühere "ganze Schicht" (breit, zielPosition leer) fällt weg --
 *     passte nicht mehr zu "konkrete Lücke, konkrete Tage, konkrete
 *     Position". Nur noch EIN Übernahme-Weg pro Vorschlag/Tausch.
 *     Getestet mit echten Daten UND einem gezielt konstruierten
 *     Minimal-Fall (Person L nur in Kamut/Nacht + Kuchenposten/Früh, ohne
 *     jeden Konfound durch weitere Positionen): Person L für 14.-15.09 auf
 *     Kamut übernommen -- am 16.09 (NICHT im gewählten Zeitraum) steht er
 *     korrekt weiter auf seiner eigenen Kuchenposten-Position. Der
 *     ursprünglich gemeldete Fall (Person Br/Rondo, Person L/Kuchenposten aus
 *     dem echten Export) tritt so nicht mehr auf.
 *   2026-09-13 · 10:46 · v0.8 · Feature
 *     Ulf, "Schweizer Käse"-Fund: manuell Lücke für Lücke verschiedene
 *     Personen auszuwählen verteilt den Schichtwechsel-Stress unnötig.
 *     "vielleicht sowas wie 'mit Person X können alle Lücken geschlossen
 *     werden -- diese Person wählen?'" Neue
 *     fasseCrossSchichtVorschauZusammen(): führt
 *     versucheCrossSchichtNachbesserung() auf einer TIEFEN KOPIE der
 *     Variante aus (JSON-Klon), verändert nichts Echtes, liefert nur die
 *     Zusammenfassung "welche Person löst wie viele der aktuell offenen
 *     Lücken". Bewusst dieselbe, bereits geprüfte Logik statt einer
 *     zweiten Zähl-Variante (Lücken am selben Tag könnten sonst doppelt
 *     gezählt werden, obwohl eine Person nur an einer Stelle zugleich
 *     stehen kann).
 *   2026-09-13 · 13:26–16:10 · v0.9 · Feature
 *     Umsetzung des "Schweizer Käse"-Konzepts aus
 *     SESSION_2026-09-13_SCHWEIZER_KAESE_KONZEPT.md — Lücken bei
 *     strukturellem Personalmangel bewusst auf EINE Position konzentrieren
 *     statt streuen zu lassen, statt einzeln nach der Generierung
 *     nachzubessern (Ergänzung VOR der Generierung, fasseCrossSchichtVorschau
 *     Zusammen bleibt unverändert für die Nachbesserung NACH der
 *     Generierung bestehen). Zwei neue reine Funktionen:
 *     - waehleKonzentrationsPosition(): Schritt A. Nachtschicht-Position
 *       mit den meisten Frühschicht-Pool-Kandidaten, die AN JEDEM aktiven
 *       Tag der Position diese Woche tatsächlich istEinsetzbar() sind
 *       (nicht nur roh im Pool stehen — Ulfs frühe Entscheidung: echte
 *       Verfügbarkeit statt Pool-Größe). Gleichstand: Zufall (Ulfs
 *       Entscheidung). Kein Kandidat gefunden: liefert null.
 *     - baueKonzentrationsZuweisungen(): Schritt B+C. Freier Tag der
 *       gewählten Person ganz normal über wuerfleVersuch() gewürfelt
 *       (Ulf: "wie bei allen anderen", kein Sonderfall), für die übrigen
 *       Tage manuelleZuweisungen über die bereits vorhandene
 *       baueTageweiseManuelleZuweisungen() gebaut (ein oder zwei Aufrufe
 *       um den freien Tag herum).
 *     KEIN crossSchichtEinsatz verwendet — siehe v0.5/v0.7 oben, der Bug
 *     dort gilt unverändert.
 *     Zusätzlicher, unabhängig davon gefundener Fix: berechneTagesDetails()
 *     reichte manuelleZuweisungen bisher NIE durch (fest [] beim internen
 *     berechneTagAlleSchichten()-Aufruf) — für die Tages-/Lücken-Anzeige
 *     einer Variante unsichtbar, solange manuelleZuweisungen leer war
 *     (bisher immer der Fall). Neuer, optionaler letzter Parameter
 *     (Default [], rückwärtskompatibel), wird jetzt von entwuerfe.html
 *     durchgereicht — sonst hätte die Tabelle/Lücken-Liste einer
 *     konzentrierten Variante die konzentrierte Position weiterhin als
 *     Lücke gezeigt, obwohl sie intern schon besetzt war.
 *   2026-09-13 · 14:11 · v0.10 · Fix (echter Testlauf)
 *     Ulfs erster echter Testlauf (Export vom 13.09., Screenshot Entwürfe/
 *     Tab 2): "Konditorei Nacht 1" wurde als Engpass mit vier Frühschicht-
 *     Kandidaten vorgeschlagen, obwohl sie in Durchlauf 1 an KEINEM Tag
 *     eine Lücke war (Person M/Person Bk deckten die Woche sauber ab) -- die
 *     tatsächlichen 5 Lücken lagen an Rheon (Mo), Kamut (Di) und drei
 *     verschiedenen Positionen am Freitag. Ulf: "ersetzt in der gesamten
 *     Woche, obwohl die Person da ist". Root Cause: waehleKonzentrationsPosition()
 *     prüfte nie, ob die gewählte Position überhaupt eine Lücke in
 *     Durchlauf 1 hatte -- reine Frühschicht-Pool-Überschneidung reichte,
 *     unabhängig vom tatsächlichen Bedarf.
 *     Fix: neuer Pflicht-Parameter besteVariante (varianten1[0] aus
 *     Durchlauf 1). Nur Positionen mit MINDESTENS ZWEI echten Nacht-
 *     Lücken-Tagen in dieser Variante kommen noch infrage (Ulfs
 *     Entscheidung: ein Einzeltag-Fall wie Rheon oder Kamut hier gehört
 *     zur bestehenden Cross-Schicht-Nachbesserung nach der Generierung,
 *     nicht zu einer vollen Wochen-Umstellung).
 *     Regressionstest ergänzt (test_konzentration.js): eine voll besetzte
 *     Position mit vielen Frühschicht-Kandidaten UND eine Einzeltag-Lücke
 *     werden beide korrekt übergangen, nur eine echte Mehrtage-Lücke wird
 *     gewählt -- bildet den echten Fund minimal nach.
 *   2026-09-13 · 14:41 · v0.11 · Fix (echter Testlauf)
 *     Ulfs zweiter echter Testlauf: "diese Unterbrechungen mit Teigmacher
 *     Frühschicht finde ich kacke". Mit echten Daten nachvollzogen:
 *     baueKonzentrationsZuweisungen() baute bisher blind für ALLE sechs
 *     Wochentage außer dem freien Tag eine manuelleZuweisungen-Zeile --
 *     unabhängig davon, ob die Zielposition an diesem Wochentag überhaupt
 *     aktiv ist. Ulfs echte Kamut-Position ist samstags NICHT aktiv
 *     (`tage` fehlt 'sa'). berechneTag() übernimmt eine Zeile für einen
 *     inaktiven Tag gar nicht erst (aktivePositionen.find liefert
 *     nichts), die Person fällt an genau diesem Tag auf ihre eigene,
 *     native Position zurück -- die ungewollte Unterbrechung mitten in
 *     der Konzentration, die den ganzen Zweck (einmal umstellen statt
 *     mehrfach) untergräbt.
 *     Fix: neuer, letzter Parameter positionenFuerMotor -- nur an Tagen
 *     zuweisen, an denen die Zielposition laut ihren `tage` tatsächlich
 *     aktiv ist. Baut die Einträge jetzt direkt (ein Objekt pro
 *     zutreffendem Tag) statt über baueTageweiseManuelleZuweisungen
 *     (kennt nur zusammenhängende Datumsbereiche, keine Wochentag-
 *     Filterung) -- der alte davor/danach-Split ist damit hinfällig.
 *     Regressionstest ergänzt (test_konzentration.js): Position ohne
 *     Samstag im `tage`-Array -- keine Samstag-Zeile, Person fällt dort
 *     korrekt auf ihre eigene Position zurück, kein falscher Lücken-
 *     Eintrag. Mit Ulfs echten Person K/Kamut-Daten verifiziert
 *     (fünfmal wiederholt, Samstag nie mehr dabei).
 *     Offen: eine zweite, bisher nicht erklärte Unterbrechung (Mittwoch,
 *     obwohl Kamut dort aktiv ist) zeigte sich im selben Export -- dieser
 *     Fix behebt sie nicht, siehe Rückfrage an Ulf im Gespräch.
 *   2026-09-13 · 14:52 · v0.12 · Fix (v0.11 zurückgenommen, echter Testlauf)
 *     Ulfs dritter echter Testlauf (frischer, unbearbeiteter Export auf
 *     Ulfs Bitte -- sollte die offene Rückfrage aus v0.11 klären):
 *     "Donnerstag eine massive Lücke...22 Uhr nicht da... Teigmacher
 *     nicht da". Root Cause gefunden UND reproduziert (Node-Harness mit
 *     Ulfs echten Kern-Dateien und Personendaten): v0.11 war selbst ein
 *     Fehlschluss. Eine manuelleZuweisungen-Zeile für einen
 *     positions-inaktiven Tag (Kamut samstags) ist HARMLOS für die
 *     Zuweisung selbst (berechneTag() ignoriert sie ohnehin) -- ihre
 *     eigentliche Funktion ist, in wuerfleVersuch() das Gewicht dieses
 *     Tages auf 0 zu setzen. Ohne sie (v0.11) blieb NEBEN dem echten
 *     freien Tag ein ZWEITER Tag mit offenem Gewicht -- die interne
 *     Suche (verteileFreieTageVarianten) konnte dann zufällig den
 *     FALSCHEN der beiden als freien Tag wählen. Reproduziert: Schritt B
 *     würfelte 15.09., die interne Suche wählte trotzdem den 19.09. --
 *     am 15.09. (obwohl Kamut dort aktiv war) stand die Person dann
 *     weder mit echter Zuweisung noch mit freiem Tag da. Erklärt
 *     vermutlich auch den ursprünglichen, nie aufgeklärten Mittwoch-Fund
 *     aus v0.10/v0.11.
 *     Fix: v0.11 komplett zurückgenommen -- baut wieder für ALLE fünf
 *     Nicht-frei-Tage eine Zeile, unabhängig von den Aktiv-Tagen der
 *     Zielposition. `positionenFuerMotor`-Parameter entfernt (nicht mehr
 *     gebraucht), Aufrufer in entwuerfe.html entsprechend angepasst.
 *     test_konzentration.js: Person K-Regressionsblock korrigiert
 *     (prüft jetzt "genau 5 Zeilen, Samstag inklusive" statt "keine
 *     Samstag-Zeile") und um die entscheidende neue Prüfung ergänzt --
 *     acht Läufe der ECHTEN verteileFreieTageVarianten()-Suche
 *     bestätigen, dass der tatsächlich berechnete freie Tag exakt dem
 *     von Schritt B gewürfelten entspricht. Mit Ulfs echten Person K/
 *     Kamut-Daten nachgestellt (derselbe frische Export): alle drei
 *     Varianten zeigen danach übereinstimmend den von Schritt B
 *     gewürfelten Tag als freien Tag, 5 Zuweisungen je Variante.
 *   2026-09-13 · 15:07 · v0.13 · Fix (echter Testlauf, vier Stellen)
 *     Ulfs vierter echter Testlauf: "Freitag ist jetzt verwirrend..
 *     Teigmacher da... Ofen nicht". Mit echten Daten geprüft: Ofen war
 *     laut `luecken` GAR NICHT offen -- Person T war korrekt eingeteilt,
 *     zeigte aber trotzdem "Frei" in der Tabelle. Root Cause, an vier
 *     Stellen identisch (drei in entwuerfe.html: akzeptiereVorschlag(),
 *     akzeptiereTausch(), akzeptiereManuellenTausch(); hier
 *     versucheCrossSchichtNachbesserung()): `alleEreignisseFuerAufruf`
 *     baute sich bisher nur aus abwesenheitenEreignisse +
 *     fruehschichtEreignisse -- v.ereignisse (die freieTage-Ereignisse)
 *     fehlte. Eine Neuberechnung des betroffenen Tages (nach Übernahme
 *     eines Vorschlags/Tauschs oder automatischer Nachbesserung) lief
 *     dadurch so, als hätte AN DIESEM TAG niemand einen rotierenden
 *     freien Tag -- wer normalerweise frei war, wurde von der Kaskade
 *     wieder eingeplant. Die Zelle zeigte trotzdem weiter "Frei" (aus
 *     v.ereignisse, das selbst unverändert blieb), das tatsächliche
 *     Ergebnis (v.tage[]) aber eine echte Zuweisung -- genau der
 *     Widerspruch, den auch schon der Person K-"frei nicht
 *     überschrieben"-Fund zeigte, hier aber nativ durch die Generierung
 *     selbst ausgelöst, nicht durch eine manuelle fuelleLuecke()-Aktion.
 *     Reproduziert (Node-Harness, Ulfs echte Daten): ohne v.ereignisse
 *     bekam Person T Ofen an ihrem eigenen freien Tag, mit v.ereignisse
 *     korrekt jemand anderes (mit einer echten, sichtbaren Lücke an
 *     anderer Stelle als Folge).
 *     Fix: `v.ereignisse` an allen vier Stellen ergänzt. Regressionstest
 *     ergänzt (test_konzentration.js, testet versucheCrossSchichtNachbesserung()
 *     direkt): eine Person mit festem freien Tag bleibt frei, auch wenn
 *     sie als Tausch-Kandidat für eine andere Lücke infrage käme.
 *   2026-09-14 · NACHGETRAGEN am 16.09.2026 (T-36)
 *     Beim Code-Abgleich aufgefallen: findeRisikoAndernorts() und
 *     findeAlternativeKonzentrationsKette() sowie der durchgereichte
 *     feiertage-Parameter stammen vom 14.09., haben hier aber nie einen
 *     Changelog-Eintrag bekommen. Nachgetragen.
 *   2026-09-16 · 09:51 · v0.14 · Feature (T-68)
 *     verbessereVarianteMitHillClimbing() nimmt kontoDaten/kontoWerte
 *     entgegen, baut daraus über baueKontoIndex() denselben Index wie
 *     die Suche davor und reicht ihn an bewerteVersuch() und
 *     verbessereDurchLokaleSuche() weiter. WICHTIG: ohne das würde das
 *     Hill-Climbing nach einem anderen Maßstab bewerten als die Suche
 *     und deren kontogerechtes Ergebnis wieder "verbessern" -- exakt
 *     dieselbe Falle wie am 13.09. bei manuelleZuweisungen.
 *   2026-09-23 · 09:08 · v0.15 · Feature (Etappe B, Feiertag-Sonntag-Regeln)
 *     verbessereVarianteMitHillClimbing() bekommt den neuen, optionalen
 *     13. Parameter freieTageSoll (personId -> Zahl, E9). Mit Soll:
 *     (1) Wiederaufbau über versuchAusEreignissen() statt
 *     versuch[e.personId] = e.von -- das überschrieb bei zwei freien
 *     Tagen einer Person einen stumm (Befund §2.6, Z. 623). (2) Plätze
 *     über bauePlaetze() statt rotationspersonen(), dieselben wie in der
 *     Suche davor (Z. 628). Ohne Soll: der alte Weg unverändert, auch
 *     mit einer zwischengespeicherten alten freie_tage_verteilung.js;
 *     mit Soll und alter Kern-Datei bricht es mit klarer Meldung ab.
 *     Rückgabe um stueckKosten und nichtVergebenePlaetze ergänzt, rein
 *     additiv. Erwartet freie_tage_verteilung.js vom 23.09.2026.
 */

(function (global) {

  /**
   * Datums-Arithmetik in lokaler Zeit (nicht UTC) -- bewusst identisch
   * zum isoDatum() in entwuerfe.html selbst (dort z.B. für die Wochen-
   * Auswahl genutzt), NICHT zum UTC-basierten isoDatum() aus
   * rechenmodul.js. Eigene, kleine Kopie statt Parameter-Durchreichung
   * -- zu trivial, um eine Abhängigkeit dafür zu rechtfertigen.
   */
  function isoDatum(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /**
   * Findet Tausch-Möglichkeiten für eine Lücke: rechenmodul.js' eigener
   * versucheTausch() (Schritt 4) findet grundsätzlich denselben Tausch,
   * verwirft einen passenden Ersatzkandidaten aber endgültig, wenn der
   * nur per Schicht-Wechsel (Ruhezeit-Bestätigung) einspringen könnte --
   * ohne das je als Vorschlag zu vermerken. Diese Funktion spiegelt
   * versucheTausch() bewusst GENAU UMGEKEHRT: sie akzeptiert nur
   * Ersatzkandidaten, die eine Bestätigung bräuchten (ein unbestätigter
   * Tausch wäre ja längst von rechenmodul.js selbst gefunden und direkt
   * angewendet worden, sonst gäbe es diese Lücke hier gar nicht erst).
   * Rührt rechenmodul.js selbst nicht an, nutzt nur dessen global
   * verfügbare istEinsetzbar()/istRuhezeitRelevanterWechsel().
   *
   * @param v - die Variante (für abwesenheitenEreignisse/
   *   fruehschichtEreignisse)
   * @param tag - {datumISO, ergebnis} aus v.tage
   * @param schicht - 'nacht' | 'frueh'
   * @param offenePosId - die Positions-ID der Lücke
   * @param personenListe - alle Personen (vorher Closure, jetzt Parameter)
   */
  function findeTauschVorschlaege(v, tag, schicht, offenePosId, personenListe) {
    var erg = tag.ergebnis[schicht];
    if (!erg) return [];
    var offenePosition = (erg.aktivePositionen || []).find(function (p) { return p.id === offenePosId; });
    if (!offenePosition) return [];
    var personenById = {};
    personenListe.forEach(function (p) { personenById[p.id] = p; });
    var alleEreignisse = (v.abwesenheitenEreignisse || []).concat(v.fruehschichtEreignisse || []);
    var istVerplant = function (personId) {
      return Object.keys(erg.zuweisungen || {}).some(function (posId) { return erg.zuweisungen[posId] === personId; });
    };

    var funde = [];
    (offenePosition.pool || []).forEach(function (personId) {
      if (!personId) return;
      var person = personenById[personId];
      if (!person) return;
      var vonPositionId = Object.keys(erg.zuweisungen || {}).find(function (posId) { return erg.zuweisungen[posId] === personId; });
      if (!vonPositionId) return; // nicht anderweitig verplant -- kein Tausch-Fall, sondern normale Verfügbarkeits-Lücke
      var vonPosition = (erg.aktivePositionen || []).find(function (p) { return p.id === vonPositionId; });
      if (!vonPosition) return;
      if (istRuhezeitRelevanterWechsel(person, offenePosition, tag.datumISO, alleEreignisse)) return;

      (vonPosition.pool || []).forEach(function (ersatzId) {
        if (!ersatzId || ersatzId === personId || istVerplant(ersatzId)) return;
        var ersatzPerson = personenById[ersatzId];
        if (!ersatzPerson || !istEinsetzbar(ersatzPerson, tag.datumISO, alleEreignisse, vonPosition.schicht)) return;
        if (!istRuhezeitRelevanterWechsel(ersatzPerson, vonPosition, tag.datumISO, alleEreignisse)) return; // genau das Gegenteil von versucheTausch()s eigener Bedingung
        funde.push({ personId: personId, vonPositionId: vonPositionId, vonPositionName: vonPosition.name, ersatzId: ersatzId });
      });
    });
    return funde;
  }

  /**
   * Baut die Lücken-Liste für eine Variante, inkl. Tausch-Vorschlägen.
   * @param tageLabel - TAGE_LABEL-Array aus entwuerfe.html (vorher Closure)
   */
  function baueLueckenListeFuerVariante(v, personenListe, tageLabel) {
    var luecken = [];
    v.tage.forEach(function (tag, tagIndex) {
      ['nacht', 'frueh'].forEach(function (schicht) {
        if (!tag.ergebnis[schicht]) return; // Absicherung, siehe entwuerfe.html-Changelog v0.23
        (tag.ergebnis[schicht].luecken || []).forEach(function (posId) {
          var pos = (tag.ergebnis[schicht].aktivePositionen || []).find(function (p) { return p.id === posId; });
          var vorschlaege = (tag.ergebnis[schicht].manuellePruefung || []).filter(function (m) { return m.positionId === posId; });
          // Ulf, 13.09.2026: "dieses Datum ist ja auch nur geraten... was
          // will man eingeben als Mensch?" -- statt das Bis-Feld immer
          // nur auf den EINEN Tag der Lücke zu setzen, vorausschauen: an
          // wie vielen DIREKT FOLGENDEN Tagen bleibt genau dieselbe
          // Position in derselben Schicht ebenfalls eine Lücke? Das ist
          // das eigentlich gemeinte "Mindeste, um alle Lücken zu
          // schließen" -- endet an der ersten Unterbrechung (Position an
          // dem Tag besetzt, oder Wochenende erreicht), NICHT einfach
          // bis Samstag. Bleibt weiterhin nur ein VORSCHLAG im Feld,
          // frei änderbar (min/max in entwuerfe.html unverändert).
          var empfohlenesBisDatum = tag.datumISO;
          for (var j = tagIndex + 1; j < v.tage.length; j++) {
            var folgeErg = v.tage[j].ergebnis[schicht];
            if (!folgeErg || (folgeErg.luecken || []).indexOf(posId) === -1) break;
            empfohlenesBisDatum = v.tage[j].datumISO;
          }
          luecken.push({
            datumISO: tag.datumISO, schicht: schicht, posId: posId,
            posName: pos ? pos.name : posId,
            tagLabel: tageLabel[(new Date(tag.datumISO + 'T00:00:00').getDay() + 6) % 7] + ' ' + (schicht === 'nacht' ? 'Nacht' : 'Früh'),
            vorschlaege: vorschlaege,
            tauschVorschlaege: findeTauschVorschlaege(v, tag, schicht, posId, personenListe),
            empfohlenesBisDatum: empfohlenesBisDatum
          });
        });
      });
    });
    return luecken;
  }

  /**
   * Berechnet die sechs Tage (Mo-Sa) einer Woche für eine Variante.
   * @param gewaehlterMontag - ISO-Datum des Wochenanfangs (vorher Closure)
   */
  function berechneTagesDetails(variantenEreignisse, bestehendeEreignisse, positionenFuerMotor, gewaehlterMontag, personenListe, manuelleZuweisungen) {
    manuelleZuweisungen = manuelleZuweisungen || []; // Default wie bisher -- rückwärtskompatibel, siehe Changelog v0.9
    var alleEreignisse = bestehendeEreignisse.concat(variantenEreignisse);
    var tage = [];
    var montag = new Date(gewaehlterMontag + 'T00:00:00');
    for (var i = 0; i < 6; i++) {
      var d = new Date(montag); d.setDate(d.getDate() + i);
      var datumISO = isoDatum(d);
      tage.push({ datumISO: datumISO, ergebnis: berechneTagAlleSchichten(datumISO, personenListe, positionenFuerMotor, alleEreignisse, manuelleZuweisungen) });
    }
    return tage;
  }

  /**
   * Berechnet für einen Datumsbereich alle betroffenen Tage neu -- der
   * gemeinsame Kern, der vorher fast identisch in akzeptiereVorschlag()
   * UND akzeptiereTausch() stand (entwuerfe.html). Committet NICHTS
   * selbst (kein v.tage-Schreiben, kein Re-Render) -- das bleibt
   * bewusst in entwuerfe.html, damit ein Fehler hier nicht zu einem
   * Teilzustand führt (siehe dortiger Kommentar, v0.21).
   * @returns { "<datumISO>": ergebnisJeSchicht, ... }
   */
  function berechneNeueTageFuerZeitraum(datumVon, datumBis, personenListe, positionenFuerMotor, alleEreignisse, manuelleZuweisungen) {
    var neueTage = {};
    var d = new Date(datumVon + 'T00:00:00');
    while (isoDatum(d) <= datumBis) {
      var tagIso = isoDatum(d);
      neueTage[tagIso] = berechneTagAlleSchichten(tagIso, personenListe, positionenFuerMotor, alleEreignisse, manuelleZuweisungen || []);
      d.setDate(d.getDate() + 1);
    }
    return neueTage;
  }

  /**
   * Baut EINEN manuelleZuweisungen-Eintrag PRO TAG über einen
   * Datumsbereich (Ulf, 13.09.2026, nach dem crossSchichtEinsatz-Fund:
   * "die Lücken in der Nachtschicht = die Tage, die eine Person... in
   * die Nachtschicht kommen müsste... der Algorithmus würde in den Fall
   * Richtung Nachtschicht laufen"). Ersetzt ab jetzt JEDE Cross-Schicht-
   * Bestätigung (Vorschlag, Tausch, Nachbesserung, manueller Zellen-
   * Tausch) -- manuelleZuweisungen prüft KEINE Ruhezeit (siehe
   * rechenmodul.js), und berechneTagAlleSchichten() reicht "heute schon
   * verplant" von Nacht zu Früh zu Sonntag weiter -- eine Person, die
   * hier für Nacht gesetzt wird, fällt dadurch automatisch UND korrekt
   * aus der eigenen Frühschicht-Kaskade desselben Tages heraus, ohne
   * dass es dafür ein eigenes Ereignis bräuchte. Der frühere
   * crossSchichtEinsatz-Mechanismus (samt seinem Bug, siehe Gespräch
   * 13.09.2026 nachts) wird dadurch komplett überflüssig.
   */
  function baueTageweiseManuelleZuweisungen(datumVon, datumBis, positionId, personId) {
    var ergebnis = [];
    var d = new Date(datumVon + 'T00:00:00');
    while (isoDatum(d) <= datumBis) {
      ergebnis.push({ datumISO: isoDatum(d), positionId: positionId, personId: personId });
      d.setDate(d.getDate() + 1);
    }
    return ergebnis;
  }


  /**
   * Baut das Export-Objekt für den Debug-Export (Ulf, 13.09.2026, "für
   * Dokumentation und Nachvollziehbarkeit") -- NUR die Datenaufbereitung,
   * kein Blob/Download (bleibt in entwuerfe.html, da DOM-Zugriff). Reine
   * Funktion: bekommt anzeigeNameFn als Parameter statt selbst auf
   * BOS_LOKAL zuzugreifen, damit diese Datei komplett ohne DOM/window-
   * Zugriff auskommt.
   * @param anzeigeNameFn - anzeigeName() aus entwuerfe.html
   * @param jetzt - ein Date-Objekt (echte Systemzeit, von entwuerfe.html geliefert)
   */
  function baueDebugExportDaten(letzteVarianten, personenListe, positionenFuerMotor, gewaehlterMontag, anzeigeNameFn, tageLabel, jetzt) {
    var personenExport = personenListe.map(function (p) {
      return Object.assign({}, p, { name: anzeigeNameFn(p.id) });
    });
    var positionenExport = (positionenFuerMotor || []).map(function (pos) {
      return Object.assign({}, pos, {
        poolNamen: (pos.pool || []).map(function (pid) { return pid ? anzeigeNameFn(pid) : ''; })
      });
    });
    var variantenExport = letzteVarianten.map(function (v, idx) {
      return {
        variante: idx + 1,
        luecken: baueLueckenListeFuerVariante(v, personenListe, tageLabel).length,
        wunschtageErfuellt: v.wunschtageErfuellt,
        freieTageEreignisse: v.ereignisse,
        fruehschichtEreignisse: v.fruehschichtEreignisse || [],
        abwesenheitenEreignisse: v.abwesenheitenEreignisse || [],
        manuelleZuweisungen: v.manuelleZuweisungen || [],
        tage: v.tage.map(function (tag) {
          var tagExport = { datumISO: tag.datumISO, wochentag: tageLabel[(new Date(tag.datumISO + 'T00:00:00').getDay() + 6) % 7] };
          ['nacht', 'frueh', 'sonntag'].forEach(function (schicht) {
            var erg = tag.ergebnis[schicht];
            if (!erg) return;
            tagExport[schicht] = {
              zuweisungen: Object.keys(erg.zuweisungen || {}).map(function (posId) {
                var pid = erg.zuweisungen[posId];
                var pos = (erg.aktivePositionen || []).find(function (p) { return p.id === posId; });
                return { positionId: posId, positionName: pos ? pos.name : posId, personId: pid, personName: anzeigeNameFn(pid) };
              }),
              luecken: (erg.luecken || []).map(function (posId) {
                var pos = (erg.aktivePositionen || []).find(function (p) { return p.id === posId; });
                return { positionId: posId, positionName: pos ? pos.name : posId };
              }),
              manuellePruefung: (erg.manuellePruefung || []).map(function (m) {
                var pos = (erg.aktivePositionen || []).find(function (p) { return p.id === m.positionId; });
                return { positionId: m.positionId, positionName: pos ? pos.name : m.positionId, personId: m.personId, personName: anzeigeNameFn(m.personId), grund: m.grund };
              })
            };
          });
          tagExport.ueberzaehlig = (tag.ergebnis.ueberzaehlig || []).map(function (pid) { return { personId: pid, personName: anzeigeNameFn(pid) }; });
          tagExport.lehrschicht = (tag.ergebnis.lehrschicht || []).map(function (l) {
            return { personId: l.personId, personName: anzeigeNameFn(l.personId), positionId: l.positionId, begleitetPersonId: l.begleitetPersonId, begleitetPersonName: anzeigeNameFn(l.begleitetPersonId) };
          });
          return tagExport;
        })
      };
    });

    return {
      zweck: 'Entwürfe-Debug-Export -- vollständiger Rechenstand für Dokumentation/Nachvollziehbarkeit, kein offizieller Plan.',
      exportiertAm: jetzt.toISOString(),
      exportiertAmLesbar: jetzt.toLocaleString('de-DE'),
      gewaehlterMontag: gewaehlterMontag,
      personen: personenExport,
      positionen: positionenExport,
      varianten: variantenExport
    };
  }

  /**
   * Bereitet einen MANUELLEN Tausch zweier bereits besetzter Zellen vor
   * (Ulf, 13.09.2026: "manuell veränderbaren Plan... Bzw die Varianten" --
   * nicht nur Lücken füllen, auch bestehende Zuweisungen direkt tauschen).
   * Baut zwei manuelle Zuweisungen (Seite A bekommt Seite Bs Position,
   * Seite B bekommt Seite As Position) -- das reicht jetzt vollständig
   * aus, auch schichtübergreifend (Ulf, 13.09.2026 nachts, nach dem
   * crossSchichtEinsatz-Fund: manuelleZuweisungen prüft keine Ruhezeit,
   * und berechneTagAlleSchichten() reicht "heute schon verplant" von
   * Nacht zu Früh weiter -- ein zusätzliches crossSchichtEinsatz-
   * Ereignis für den Schicht-Wechsel wird dadurch überflüssig, samt
   * seinem damals gefundenen Bug). Die "(aus Früh)"/"(aus Nacht)"-
   * Kennzeichnung in der Tabelle erkennt eine manuelle, schicht-
   * fremde Zuweisung jetzt direkt selbst (siehe entwuerfe.html,
   * findeCrossSchichtAbdeckung()) -- kein separates Ereignis mehr nötig.
   *
   * @param seiteA/seiteB - {personId, positionId}
   * @returns manuelleZuweisungen (Array, direkt verwendbar)
   */
  function baueManuellenTauschEreignisse(datumISO, seiteA, seiteB) {
    return [
      { datumISO: datumISO, positionId: seiteB.positionId, personId: seiteA.personId },
      { datumISO: datumISO, positionId: seiteA.positionId, personId: seiteB.personId }
    ];
  }

  /**
   * Wendet dieselbe Nachbesserungsrunde (Hill-Climbing), die
   * verteileFreieTage() intern schon nutzt, auch auf eine einzelne, von
   * verteileFreieTageVarianten() gelieferte Variante an (Ulf,
   * 13.09.2026: "wenn du das für jede Variante machst, sollte es
   * vertretbar sein"). verteileFreieTageVarianten() selbst ruft diese
   * Nachbesserung NICHT auf (anders als verteileFreieTage()) -- dieser
   * Unterschied war bisher unbemerkt und vermutlich mit ein Grund für
   * den Teigmacher-Fall von heute Nacht.
   *
   * Rekonstruiert den rohen "Versuch" (personId -> datumISO) aus den
   * bereits umgewandelten freierTag-Ereignissen (zuEreignissen() ist
   * exakt umkehrbar), bewertet ihn frisch über bewerteVersuch() -- die
   * fertige Variante selbst liefert die volle Bewertung nicht mit, das
   * braucht verbessereDurchLokaleSuche() aber für den Vergleich.
   * freiWaehlbar wird identisch zu verteileFreieTageVarianten() selbst
   * aus rotationspersonen()/erzwungenerFreierTag() rekonstruiert.
   *
   * `feiertage` ergänzt 14.09.2026 (Punktesystem-Umbau), rein additiv,
   * optional -- ohne sie verhält sich jede Woche wie eine normale.
   *
   * Nutzt rotationspersonen, erzwungenerFreierTag, bewerteVersuch,
   * verbessereDurchLokaleSuche, zuEreignissen -- alle aus
   * freie_tage_verteilung.js, seit 13.09.2026 vollständig exportiert
   * (Ulfs ausdrückliche Erlaubnis für den einen Export-Eintrag dort,
   * keine Logik dort verändert).
   */
  function verbessereVarianteMitHillClimbing(variante, wochenStartISO, personenListe, positionenFuerMotor, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, ausgeschlosseneTage, feiertage, kontoDaten, kontoWerte, freieTageSoll) {
    wunschtageByPersonId = wunschtageByPersonId || {};
    manuelleZuweisungen = manuelleZuweisungen || [];
    wichtigeWunschtage = wichtigeWunschtage || {};
    ausgeschlosseneTage = ausgeschlosseneTage || {};
    feiertage = feiertage || [];
    // Ergänzt 16.09.2026 (T-68), rein additiv. WICHTIG: derselbe Index
    // muss auch hier gelten -- liefe das Hill-Climbing ohne
    // Konto-Rückkopplung, würde es die von verteileFreieTageVarianten()
    // gefundene, kontogerechte Verteilung anschließend wieder auf den
    // alten Maßstab hin "verbessern". Genau dieselbe Falle wie am
    // 13.09. bei manuelleZuweisungen (dort: das Hill-Climbing verschob
    // den freien Tag der konzentrierten Person wieder weg).
    var kontoIndex = baueKontoIndex(kontoDaten);

    // 23.09.2026 (Etappe B): mit freieTageSoll kann eine Person mehrere
    // freie Tage haben. Der alte Wiederaufbau (versuch[e.personId] =
    // e.von) überschrieb dann einen Tag stumm -- die Falle vom 13.09.
    // versuchAusEreignissen() baut Plätze in fester Form (P1). Ohne Soll
    // bleibt der alte Weg, Ergebnis exakt wie vorher.
    var versuch = {};
    if (freieTageSoll && typeof bauePlaetze !== 'function') {
      // Tablet mit zwischengespeicherter alter freie_tage_verteilung.js:
      // lieber laut abbrechen als mit halbem Stand rechnen.
      throw new Error('freie_tage_verteilung.js ist veraltet (bauePlaetze fehlt) -- Seite hart neu laden.');
    }
    if (freieTageSoll) {
      versuch = versuchAusEreignissen(variante.ereignisse, wochenStartISO, bestehendeEreignisse);
    } else {
      (variante.ereignisse || []).forEach(function (e) {
        if (e.grund === 'freierTag') versuch[e.personId] = e.von;
      });
    }

    var bewertung = bewerteVersuch(versuch, wochenStartISO, personenListe, positionenFuerMotor, bestehendeEreignisse, wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, feiertage, kontoIndex, kontoWerte);

    // 23.09.2026 (Etappe B): dieselben Plätze wie in der Suche davor
    // (bauePlaetze), damit das Hill-Climbing nach demselben Maßstab
    // arbeitet. Ohne Soll: je Person ein Platz, wie bisher.
    var plaetzeInfo = null;
    var freiWaehlbar;
    if (freieTageSoll) {
      plaetzeInfo = bauePlaetze(personenListe, wochenStartISO, bestehendeEreignisse, freieTageSoll, ausgeschlosseneTage);
      freiWaehlbar = plaetzeInfo.freiWaehlbar;
      ausgeschlosseneTage = plaetzeInfo.ausgeschlosseneTage;
    } else {
      var rotPersonenAlle = rotationspersonen(personenListe, wochenStartISO, bestehendeEreignisse);
      freiWaehlbar = rotPersonenAlle.filter(function (p) {
        return !erzwungenerFreierTag(p.id, wochenStartISO, bestehendeEreignisse);
      });
    }

    var verbessert = verbessereDurchLokaleSuche(
      { versuch: versuch, bewertung: bewertung },
      freiWaehlbar, wochenStartISO, personenListe, positionenFuerMotor, bestehendeEreignisse,
      wunschtageByPersonId, manuelleZuweisungen, wichtigeWunschtage, ausgeschlosseneTage, feiertage, kontoIndex, kontoWerte
    );

    return {
      ereignisse: zuEreignissen(verbessert.versuch),
      luecken: verbessert.bewertung.luecken,
      // Ergänzt 14.09.2026, rein additiv (Punktesystem-Umbau):
      harteLuecken: verbessert.bewertung.harteLuecken || 0,
      gesamtKosten: verbessert.bewertung.gesamtKosten || 0,
      schichtwechselKosten: verbessert.bewertung.schichtwechselKosten || 0,
      azubiEinsaetze: verbessert.bewertung.azubiEinsaetze || 0,
      wochentagUeberschussKosten: verbessert.bewertung.wochentagUeberschussKosten || 0,
      kontoAusgleichKosten: verbessert.bewertung.kontoAusgleichKosten || 0, // ergänzt 16.09.2026 (T-68)
      wunschtageErfuellt: verbessert.bewertung.wunschtageErfuellt,
      // Ergänzt 23.09.2026, rein additiv (Etappe B):
      stueckKosten: verbessert.bewertung.stueckKosten || 0,
      nichtVergebenePlaetze: plaetzeInfo
        ? plaetzeInfo.alleSchluessel.filter(function (k) { return !(k in verbessert.versuch); }).map(personIdVonSchluessel)
        : []
    };
  }

  /**
   * Versucht, verbleibende Lücken einer fertig berechneten Variante mit
   * Cross-Schicht-Erlaubnis automatisch zu schließen (Ulf, 13.09.2026:
   * "Lücken erkannt? Gibt es die Erlaubnis für Cross-Shift? ... dann
   * automatisch mit einer Cross-Schicht-Person nochmal das ganze
   * Prozedere"). Nutzt dieselbe findeTauschVorschlaege() wie der
   * manuelle Tausch-Chip.
   *
   * Bei MEHREREN gefundenen Kandidaten für eine Lücke wird bevorzugt,
   * wer in DIESEM Nachbesserungs-Durchlauf schon einmal herangezogen
   * wurde (Ulf, 13.09.2026, nach dem Vorab-Checkbox-Fund: "es sollte
   * eher Wert darauf gelegt werden, dass nur eine Person den Stress
   * eines Schichtwechsels hat... für die Lücke von 2 Leuten braucht es
   * eine Person, die im Prinzip für eine Woche wechselt, keine zwei").
   * Nur eine PRÄFERENZ, kein Zwang: bleibt die einzige Möglichkeit für
   * eine Lücke eine andere/neue Person (weil unterschiedliche Positionen
   * unterschiedliche Pools haben, oder zwei Lücken auf denselben Tag
   * fallen und eine Person nicht an zwei Stellen zugleich stehen kann),
   * wird trotzdem diese genommen -- besser eine zweite Person als eine
   * offene Lücke.
   *
   * Arbeitet die Lücken RUNDENWEISE ab, nicht alle auf einmal aus einer
   * einzigen Momentaufnahme: ein angewendeter Tausch verändert sowohl
   * die Lückenliste als auch die Kandidaten für andere, noch offene
   * Lücken desselben Tages -- ohne Neubewertung nach jedem Schritt
   * könnte derselbe Kandidat für zwei Lücken gleichzeitig "gefunden",
   * aber nur einmal wirklich verplant werden. Bricht ab, sobald eine
   * volle Runde keine einzige Lücke mehr schließen konnte, zusätzlich
   * durch MAX_RUNDEN gegen Endlosschleifen abgesichert.
   *
   * MUTIERT variante.tage direkt (gleiches Vorgehen wie
   * akzeptiereTausch() in entwuerfe.html mit der lebenden
   * letzteVarianten[idx]) und liefert die neu entstandenen
   * manuelleZuweisungen zurück, damit der Aufrufer sie ins
   * Varianten-Objekt einträgt. Seit 13.09.2026 nachts (crossSchichtEinsatz-
   * Fund) läuft auch die Ersatz-Seite über manuelleZuweisungen, nicht
   * mehr über ein eigenes Cross-Schicht-Ereignis -- derselbe Grund wie
   * bei baueManuellenTauschEreignisse(), siehe dort.
   */
  function versucheCrossSchichtNachbesserung(variante, personenListe, positionenFuerMotor, tageLabel) {
    var MAX_RUNDEN = 20;
    var neueManuelleZuweisungen = [];
    var runde = 0;
    var fortschritt = true;

    while (fortschritt && runde < MAX_RUNDEN) {
      fortschritt = false;
      runde++;
      var luecken = baueLueckenListeFuerVariante(variante, personenListe, tageLabel);
      for (var i = 0; i < luecken.length; i++) {
        var l = luecken[i];
        var tag = variante.tage.find(function (t) { return t.datumISO === l.datumISO; });
        if (!tag) continue;
        var kandidaten = findeTauschVorschlaege(variante, tag, l.schicht, l.posId, personenListe);
        if (!kandidaten.length) continue;

        var bereitsGenutzt = {};
        neueManuelleZuweisungen.forEach(function (z) { bereitsGenutzt[z.personId] = true; });
        var k = kandidaten.find(function (kand) { return bereitsGenutzt[kand.ersatzId]; }) || kandidaten[0];

        var neueEintraege = [
          { datumISO: l.datumISO, positionId: l.posId, personId: k.personId },
          { datumISO: l.datumISO, positionId: k.vonPositionId, personId: k.ersatzId }
        ];
        var alleManuelleZuweisungen = (variante.manuelleZuweisungen || []).concat(neueManuelleZuweisungen, neueEintraege);
        // KORREKTUR 13.09.2026 (Person T-Fund, echter Testlauf): variante.ereignisse
        // (die freieTage-Ereignisse) fehlten hier -- eine Neuberechnung lief
        // dadurch so, als hätte an diesem Tag niemand einen rotierenden
        // freien Tag. Wer normalerweise frei ist, wurde von der Kaskade
        // wieder eingeplant, obwohl die Zelle weiterhin "Frei" zeigte
        // (aus variante.ereignisse, unverändert) -- derselbe Fehler wie in
        // akzeptiereVorschlag()/akzeptiereTausch() (entwuerfe.html).
        var alleEreignisseFuerAufruf = (variante.abwesenheitenEreignisse || []).concat(variante.fruehschichtEreignisse || [], variante.ereignisse || []);

        var neuesTagesErgebnis = berechneTagAlleSchichten(l.datumISO, personenListe, positionenFuerMotor, alleEreignisseFuerAufruf, alleManuelleZuweisungen);
        var tagIndex = variante.tage.findIndex(function (t) { return t.datumISO === l.datumISO; });
        if (tagIndex === -1) continue;
        variante.tage[tagIndex] = { datumISO: l.datumISO, ergebnis: neuesTagesErgebnis };

        neueManuelleZuweisungen.push(neueEintraege[0], neueEintraege[1]);
        fortschritt = true;
        break; // Lückenliste hat sich geändert -- äußere Runde neu starten
      }
    }

    return { manuelleZuweisungen: neueManuelleZuweisungen };
  }

  /**
   * Vorschau: welche Person würde bei der Cross-Schicht-Nachbesserung die
   * meisten der AKTUELL offenen Lücken übernehmen? (Ulf, 13.09.2026:
   * "mit Person X können alle Lücken geschlossen werden -- diese Person
   * wählen?", nach dem "Schweizer Käse"-Fund -- manuell Lücke für Lücke
   * unterschiedliche Personen zu wählen verteilt den Schichtwechsel-
   * Stress auf viele statt auf wenige).
   *
   * Führt versucheCrossSchichtNachbesserung() auf einer TIEFEN KOPIE der
   * Variante aus (JSON-Klon reicht, reine Datenobjekte, kein DOM/window-
   * Zugriff) -- verändert die echte Variante NICHT, liefert nur eine
   * Zusammenfassung. Bewusst dieselbe, bereits geprüfte "bevorzugt
   * Wiederverwendung"-Logik als einzige Quelle der Wahrheit, statt einer
   * zweiten, eigenen Zähl-Logik, die bei Lücken am selben Tag (wo eine
   * Person nur EINE davon wirklich übernehmen kann) abweichende
   * Ergebnisse liefern könnte.
   *
   * Jede aufgelöste Lücke erzeugt in versucheCrossSchichtNachbesserung()
   * GENAU ZWEI manuelleZuweisungen hintereinander (Index 0 = die Person,
   * die die offene Position übernimmt, Index 1 = deren Ersatz an der
   * eigenen, bisherigen Position) -- gezählt wird hier nur Index 0,
   * sonst würde ein reiner Ersatz fälschlich als "hat eine Lücke
   * geschlossen" mitgezählt.
   *
   * @returns Array, absteigend sortiert: [{personId, anzahlLuecken}, ...]
   */
  function fasseCrossSchichtVorschauZusammen(variante, personenListe, positionenFuerMotor, tageLabel) {
    var klon = JSON.parse(JSON.stringify({
      tage: variante.tage,
      manuelleZuweisungen: variante.manuelleZuweisungen || [],
      abwesenheitenEreignisse: variante.abwesenheitenEreignisse || [],
      fruehschichtEreignisse: variante.fruehschichtEreignisse || []
    }));
    var ergebnis = versucheCrossSchichtNachbesserung(klon, personenListe, positionenFuerMotor, tageLabel);
    var anzahlProPerson = {};
    for (var i = 0; i < ergebnis.manuelleZuweisungen.length; i += 2) {
      var personId = ergebnis.manuelleZuweisungen[i].personId;
      anzahlProPerson[personId] = (anzahlProPerson[personId] || 0) + 1;
    }
    return Object.keys(anzahlProPerson)
      .map(function (personId) { return { personId: personId, anzahlLuecken: anzahlProPerson[personId] }; })
      .sort(function (a, b) { return b.anzahlLuecken - a.anzahlLuecken; });
  }

  /**
   * Prüft für EINE Person, ob sie -- außer für die Zielposition der
   * Konzentration selbst -- irgendwo anders im Pool steht, wo sie
   * faktisch der einzige Rückhalt wäre. Genau der Brötchenstraße-Fund
   * vom 14.09.2026: Person L wurde für Rheon konzentriert, war dadurch
   * aber an Person As freiem Tag nicht mehr als Rückhalt für
   * Brötchenstraße verfügbar -- Person A und Person L sind dort die
   * einzigen zwei Pool-Mitglieder.
   *
   * KORREKTUR 14.09.2026, echter Testlauf (dieselbe Session): die erste
   * Fassung prüfte tagesgenau (istEinsetzbar an JEDEM aktiven Tag der
   * anderen Position) -- griff bei Ulfs echten Daten aber NICHT, weil
   * zum Zeitpunkt von Schritt A der freie Tag der anderen Pool-Person
   * (hier: Person A) noch gar nicht feststeht -- der wird erst von
   * wuerfleVersuch() selbst gewürfelt, NACH dieser Funktion. Es gab also
   * schlicht noch kein konkretes Datum, an dem die Prüfung hätte
   * anschlagen können, obwohl das Risiko real war.
   * Jetzt STRUKTURELL statt tagesgenau: bleibt für die andere Position
   * nur EINE einsatzfähige Person übrig (oder gar keine), und nimmt die
   * an der normalen Wochenrotation teil (braucht also selbst
   * irgendwann einen freien Tag, `keinRotierenderFreierTag` nicht
   * gesetzt) -- dann ist der Kandidat faktisch der einzige Rückhalt,
   * sobald diese Person ihren (noch nicht feststehenden) freien Tag
   * hat. Etwas vorsichtiger als nötig in seltenen Randfällen (z. B.
   * wenn die Position nur an einem einzigen Wochentag aktiv ist und der
   * freie Tag zufällig nie darauf fällt) -- das ist bewusst in Kauf
   * genommen: eine gemiedene, aber eigentlich unnötig gemiedene
   * Konzentration kostet nichts (es gibt ja per Definition eine
   * Alternative), ein übersehenes echtes Risiko schon.
   *
   * Reine Stammdaten-Prüfung, ruft berechneTagAlleSchichten() NICHT auf.
   *
   * @returns Array von { positionId, positionName } -- leer = kein Risiko.
   */
  function findeRisikoAndernorts(personId, zielPositionId, positionenFuerMotor, personenById, wochenStartISO, bestehendeEreignisse) {
    var tage = wochentageMoSa(wochenStartISO);
    var risiken = [];
    positionenFuerMotor.forEach(function (position2) {
      if (position2.id === zielPositionId) return;
      if ((position2.pool || []).indexOf(personId) === -1) return;
      var aktiveTage2 = tage.filter(function (d) { return (position2.tage || []).indexOf(wochentag(d)) !== -1; });
      if (!aktiveTage2.length) return;
      // Verbleibende Pool-Mitglieder (ohne den Kandidaten selbst), die
      // diese Woche grundsätzlich einsatzfähig sind -- an MINDESTENS
      // einem aktiven Tag, nicht komplett fest abwesend (z. B.
      // durchgehender Urlaub). Der konkrete freie Tag zählt hier bewusst
      // NICHT als Ausschlussgrund (siehe Korrektur oben).
      var verbleibende = (position2.pool || []).filter(function (anderePersonId) {
        if (!anderePersonId || anderePersonId === personId) return false;
        var andere = personenById[anderePersonId];
        if (!andere) return false;
        return aktiveTage2.some(function (d) { return istEinsetzbar(andere, d, bestehendeEreignisse, position2.schicht); });
      });
      if (verbleibende.length === 0) {
        risiken.push({ positionId: position2.id, positionName: position2.name });
      } else if (verbleibende.length === 1) {
        var einzige = personenById[verbleibende[0]];
        if (einzige && !einzige.keinRotierenderFreierTag) {
          risiken.push({ positionId: position2.id, positionName: position2.name });
        }
      }
    });
    return risiken;
  }

  /**
   * "Schweizer Käse"-Konzentration, Schritt A (SESSION_2026-09-13_
   * SCHWEIZER_KAESE_KONZEPT.md §4). Findet die Nachtschicht-Position mit
   * den meisten Frühschicht-Pool-Kandidaten für DIESE Woche -- gezählt
   * wird nur, wer an JEDEM aktiven Tag der Position tatsächlich
   * istEinsetzbar() ist (Ulfs frühe Entscheidung: echte Verfügbarkeit
   * prüfen, nicht nur rohe Pool-Zugehörigkeit). Teilverfügbarkeit zählt
   * bewusst NICHT -- die Person soll die Position für (fast) die ganze
   * Woche übernehmen, sonst verfehlt die Konzentration ihren eigenen
   * Zweck. Mehrere Positionen mit gleich vielen Kandidaten: Zufall (Ulfs
   * Entscheidung, 13.09.2026).
   *
   * KORREKTUR 13.09.2026, echter Testlauf (Konditorei-Nacht-1-Fall):
   * `besteVariante` (varianten1[0] aus Durchlauf 1, schon nach Lücken
   * sortiert) ist jetzt Pflicht-Eingabe -- nur Positionen, die dort an
   * MINDESTENS ZWEI Tagen tatsächlich eine Nacht-Lücke waren, kommen
   * überhaupt infrage (Ulfs Entscheidung: ein Einzeltag-Fall gehört zur
   * bestehenden Cross-Schicht-Nachbesserung, nicht zu einer vollen
   * Wochen-Umstellung). Vorher wurde unter ALLEN Nachtschicht-Positionen
   * gesucht, unabhängig davon, ob sie überhaupt betroffen waren --
   * Konditorei Nacht 1 wurde dadurch vorgeschlagen, obwohl sie die ganze
   * Woche sauber besetzt war.
   *
   * KORREKTUR 14.09.2026, echter Testlauf (Brötchenstraße-Fund): unter
   * mehreren Kandidaten für dieselbe Position werden jetzt die
   * risikofreien bevorzugt (siehe findeRisikoAndernorts) -- eine Person,
   * die anderswo unersetzlich wäre, wird nur noch gewählt, wenn es
   * wirklich keine Alternative gibt. Gibt es für die gewählte Position
   * KEINEN risikofreien Kandidaten, wird trotzdem der/die beste
   * verfügbare gewählt (eine Lücke bleibt schlimmer als das Risiko einer
   * weiteren) -- aber `risikoHinweis` am Ergebnis zeigt an, wo dadurch
   * eine neue Lücke drohen kann, statt es stillschweigend zu riskieren.
   *
   * Reine Stammdaten-Prüfung, ruft berechneTagAlleSchichten() NICHT auf
   * (liest nur die in besteVariante schon vorhandenen Lücken aus).
   *
   * @param besteVariante - ein Element aus dem Rückgabewert von
   *   baueVariantenSatz() (entwuerfe.html) -- braucht .tage[].ergebnis.nacht.luecken
   * @returns { positionId, positionName, kandidaten: [personId,...],
   *   risikoHinweis: [{positionId,positionName}] oder null }
   *   oder null, wenn keine Nachtschicht-Position mit mindestens zwei
   *   echten Lücken-Tagen einen qualifizierten Kandidaten hat.
   */
  function waehleKonzentrationsPosition(personenListe, positionenFuerMotor, wochenStartISO, bestehendeEreignisse, besteVariante) {
    var personenById = {};
    personenListe.forEach(function (p) { personenById[p.id] = p; });
    var tage = wochentageMoSa(wochenStartISO);

    // Fund 13.09.2026, echter Testlauf (Konditorei-Nacht-1-Fall): die
    // Positions-Wahl prüfte bisher NIRGENDS, ob die Position in Durchlauf 1
    // überhaupt eine Lücke war -- reine Frühschicht-Pool-Überschneidung
    // reichte. Konditorei Nacht 1 wurde dadurch als "Engpass" vorgeschlagen,
    // obwohl sie die ganze Woche sauber besetzt war (Person M) -- die
    // tatsächlichen Lücken lagen an Rheon/Kamut/Konditorei Nacht 2/
    // Teigmacher/22 Uhr. Jetzt: pro Position zählen, an wie vielen Tagen sie
    // in der BESTEN Durchlauf-1-Variante (varianten1[0], schon nach Lücken
    // sortiert) tatsächlich eine Nacht-Lücke war.
    var luecktageProPosition = {};
    (besteVariante && besteVariante.tage || []).forEach(function (tag) {
      var nacht = tag.ergebnis && tag.ergebnis.nacht;
      if (!nacht) return;
      (nacht.luecken || []).forEach(function (positionId) {
        luecktageProPosition[positionId] = (luecktageProPosition[positionId] || 0) + 1;
      });
    });

    var treffer = [];
    positionenFuerMotor.filter(function (p) { return p.schicht === 'nacht'; }).forEach(function (position) {
      // Zweiter Fund derselben Session, Ulfs Entscheidung: eine
      // Wochen-Konzentration lohnt sich erst ab ZWEI tatsächlichen
      // Lücken-Tagen derselben Position -- ein Einzeltag-Fall (wie Rheon/
      // Kamut hier) gehört zur bestehenden Cross-Schicht-Nachbesserung
      // (siehe crossSchichtNachbesserungBtn in entwuerfe.html), nicht zu
      // einer vollen Wochen-Umstellung.
      if ((luecktageProPosition[position.id] || 0) < 2) return;

      var aktiveTage = tage.filter(function (datumISO) { return (position.tage || []).indexOf(wochentag(datumISO)) !== -1; });
      if (!aktiveTage.length) return;

      var kandidaten = (position.pool || []).filter(function (personId) {
        if (!personId) return false;
        var person = personenById[personId];
        if (!person || person.stammschicht !== 'frueh') return false;
        return aktiveTage.every(function (datumISO) {
          return istEinsetzbar(person, datumISO, bestehendeEreignisse, 'nacht');
        });
      });

      if (!kandidaten.length) return;

      // 14.09.2026: pro Kandidat prüfen, ob er anderswo unersetzlich wäre
      // -- risikofreie Kandidaten werden bevorzugt herausgefiltert.
      var kandidatenRisikofrei = kandidaten.filter(function (personId) {
        return findeRisikoAndernorts(personId, position.id, positionenFuerMotor, personenById, wochenStartISO, bestehendeEreignisse).length === 0;
      });

      treffer.push({
        positionId: position.id, positionName: position.name,
        kandidaten: kandidaten, kandidatenRisikofrei: kandidatenRisikofrei
      });
    });

    if (!treffer.length) return null;

    // Treffer mit mindestens einem risikofreien Kandidaten werden
    // bevorzugt -- unter DIESEN wird dann nach der bisherigen Regel
    // (meiste Kandidaten, bei Gleichstand Zufall) gewählt. Nur wenn KEIN
    // Treffer einen risikofreien Kandidaten hat, fällt die Auswahl auf
    // alle Treffer zurück (eine Lücke bleibt schlimmer als das Risiko).
    var mitRisikofreien = treffer.filter(function (t) { return t.kandidatenRisikofrei.length > 0; });
    var infrageKommend = mitRisikofreien.length ? mitRisikofreien : treffer;

    var effektiv = infrageKommend.map(function (t) {
      var kandidatenEffektiv = t.kandidatenRisikofrei.length ? t.kandidatenRisikofrei : t.kandidaten;
      return { positionId: t.positionId, positionName: t.positionName, kandidaten: kandidatenEffektiv, warRisikofreiVerfuegbar: t.kandidatenRisikofrei.length > 0 };
    });

    var maxAnzahl = Math.max.apply(null, effektiv.map(function (t) { return t.kandidaten.length; }));
    var beste = effektiv.filter(function (t) { return t.kandidaten.length === maxAnzahl; });
    var gewaehlt = beste[Math.floor(Math.random() * beste.length)];

    // War kein risikofreier Kandidat verfügbar, zeigen, WO das Risiko
    // liegt -- über den ERSTEN der (notgedrungen riskanten) Kandidaten,
    // die tatsächlich zur Auswahl standen (meist gibt es eh nur einen).
    var risikoHinweis = null;
    if (!gewaehlt.warRisikofreiVerfuegbar) {
      var risiken = findeRisikoAndernorts(gewaehlt.kandidaten[0], gewaehlt.positionId, positionenFuerMotor, personenById, wochenStartISO, bestehendeEreignisse);
      if (risiken.length) risikoHinweis = risiken;
    }

    return { positionId: gewaehlt.positionId, positionName: gewaehlt.positionName, kandidaten: gewaehlt.kandidaten, risikoHinweis: risikoHinweis };
  }

  /**
   * "Schweizer Käse"-Konzentration, alternativer Ansatz (14.09.2026,
   * Ulfs echter Testlauf -- "wenn statt Person L Person K in die
   * Nachtschicht kommen würde und Kamut übernimmt"). Nicht die direkte
   * Frage "wer kann DIREKT auf die Lücken-Position?" (das ist
   * waehleKonzentrationsPosition selbst), sondern eine Ebene weiter:
   * "gibt es eine ANDERE Position, deren nacht-nativer Stammbesetzer die
   * Lücken-Position genauso gut könnte, WENN eine Frühschicht-Person
   * stattdessen SEINE Position übernimmt?" -- exakt die Kette, die Ulf
   * von Hand gefunden hat: Person K -> Kamut (keine Lücke, aber
   * Person Fs eigentliche Position), dadurch wird Person F frei für Rheon
   * (die echte Lücke), ohne dass Person F irgendeine Sonderbehandlung
   * bräuchte -- er landet über die ganz normale Kaskade dort, sobald
   * Kamut anderweitig gedeckt ist (mit Ulfs echten Daten geprüft, bevor
   * diese Funktion überhaupt geschrieben wurde).
   *
   * TIEFE BEWUSST AUF GENAU EINEN ZWISCHENSCHRITT BEGRENZT (Ulfs
   * Entscheidung, wie bei der Tausch-Tiefensuche vom 13.09.: tiefer
   * wird es für einen Menschen nicht mehr nachvollziehbar). Findet die
   * Funktion mehrere mögliche Ketten, wird die ERSTE genommen, die
   * einen echten Ersatz-Kandidaten hat -- keine weitere Optimierung
   * zwischen mehreren Ketten, das wäre eine eigene, größere Sache.
   *
   * NIE AUTOMATISCH (Ulf, 14.09.2026, ausdrücklich): das Ergebnis ist
   * ein Vorschlag, kein automatischer Zug -- der Aufrufer
   * (entwuerfe.html) muss ihn Ulf explizit zur Bestätigung vorlegen,
   * "groß genug, dass er nicht im Klein-Klein der anderen
   * Lücken-Schließer untergeht".
   *
   * Reine Stammdaten- und Durchlauf-1-Auswertung, ruft
   * berechneTagAlleSchichten() NICHT auf.
   *
   * @param treffer - das Ergebnis von waehleKonzentrationsPosition()
   * @param besteVariante - dieselbe varianten1[0] wie bei
   *   waehleKonzentrationsPosition (braucht .tage[].ergebnis.nacht.zuweisungen
   *   dieses Mal, nicht nur .luecken)
   * @returns { ersatzPositionId, ersatzPositionName, ersatzKandidaten,
   *   freigewordenePersonId, zielPositionId, zielPositionName } oder null
   */
  function findeAlternativeKonzentrationsKette(treffer, besteVariante, positionenFuerMotor, personenById, wochenStartISO, bestehendeEreignisse) {
    var tage = wochentageMoSa(wochenStartISO);
    var zielPositionObj = positionenFuerMotor.find(function (p) { return p.id === treffer.positionId; });
    if (!zielPositionObj) return null;
    var aktiveTageZiel = tage.filter(function (d) { return (zielPositionObj.tage || []).indexOf(wochentag(d)) !== -1; });

    // Nacht-native Pool-Kollegen der Zielposition -- mögliche
    // "Verdrängte", die anderswo ihre eigentliche Position hätten.
    var nachtKollegen = (zielPositionObj.pool || []).filter(function (pid) {
      var p = personenById[pid];
      return p && p.stammschicht === 'nacht';
    });

    for (var k = 0; k < nachtKollegen.length; k++) {
      var kollegeId = nachtKollegen[k];
      for (var t = 0; t < (besteVariante.tage || []).length; t++) {
        var tagEintrag = besteVariante.tage[t];
        if (aktiveTageZiel.indexOf(tagEintrag.datumISO) === -1) continue;
        var nachtZuweisungen = (tagEintrag.ergebnis && tagEintrag.ergebnis.nacht && tagEintrag.ergebnis.nacht.zuweisungen) || {};
        var seinePositionId = Object.keys(nachtZuweisungen).find(function (posId) { return nachtZuweisungen[posId] === kollegeId; });
        if (!seinePositionId || seinePositionId === treffer.positionId) continue;
        var seinePosition = positionenFuerMotor.find(function (p) { return p.id === seinePositionId; });
        if (!seinePosition) continue;

        var seineAktiveTage = tage.filter(function (d) { return (seinePosition.tage || []).indexOf(wochentag(d)) !== -1; });
        var ersatzKandidaten = (seinePosition.pool || []).filter(function (pid) {
          if (!pid || pid === kollegeId) return false;
          var p = personenById[pid];
          return p && p.stammschicht === 'frueh' && seineAktiveTage.every(function (d) {
            return istEinsetzbar(p, d, bestehendeEreignisse, 'nacht');
          });
        });

        if (ersatzKandidaten.length) {
          return {
            ersatzPositionId: seinePositionId, ersatzPositionName: seinePosition.name,
            ersatzKandidaten: ersatzKandidaten,
            freigewordenePersonId: kollegeId,
            zielPositionId: treffer.positionId, zielPositionName: treffer.positionName
          };
        }
      }
    }
    return null;
  }

  /**
   * "Schweizer Käse"-Konzentration, Schritt B+C. Würfelt den freien Tag
   * der gewählten Person ganz normal (Ulf, 13.09.2026: "wie bei allen
   * anderen" -- kein Sonderfall), über denselben wuerfleVersuch() wie
   * die normale Wochenverteilung, nur mit einer einzelnen Person. Baut
   * für JEDEN anderen Wochentag eine manuelleZuweisungen-Zeile auf die
   * gewählte Position.
   *
   * KORREKTUR 13.09.2026, 14:41 (v0.11) -- WIEDER ZURÜCKGENOMMEN
   * 13.09.2026, 14:46, echter Testlauf: die v0.11-Filterung ("nur an
   * Tagen zuweisen, an denen die Zielposition laut `tage` aktiv ist",
   * z. B. kein Samstag bei Kamut) war ein Fehlschluss. Eine Zeile für
   * einen positions-inaktiven Tag ist HARMLOS -- berechneTag()
   * übernimmt sie ohnehin lautlos nicht (aktivePositionen.find liefert
   * nichts dafür), die Person fällt an dem Tag korrekt auf ihre eigene
   * Position zurück, das ist kein Fehler, sondern richtig (die Position
   * braucht sie ja an dem Tag gar nicht).
   * Was diese Zeile WIRKLICH leistet: in wuerfleVersuch() setzt sie das
   * Gewicht dieses Tages für die Person auf 0. Fehlt sie (v0.11), bleibt
   * NEBEN dem echten freien Tag ein ZWEITER Tag mit offenem Gewicht --
   * die interne Suche (verteileFreieTageVarianten) kann dann zufällig
   * den FALSCHEN der beiden als freien Tag wählen. Reproduziert mit
   * Ulfs echten Daten (13.09.2026, 12:46-Export): Schritt B würfelte
   * 15.09. als freien Tag, die interne Suche wählte wegen der fehlenden
   * Samstags-Zeile trotzdem den 19.09. -- am 15.09. stand die Person
   * dann weder mit echter Zuweisung NOCH mit freiem Tag da ("Donnerstag
   * eine massive Lücke", Ulf -- an einem Tag, an dem die Position laut
   * `tage` durchaus aktiv war). Das erklärt vermutlich auch den bereits
   * zuvor beobachteten, damals nicht aufgeklärten Mittwoch-Fund.
   * Zurück zur ungefilterten Zuweisung -- baut jetzt wieder für ALLE
   * fünf Nicht-frei-Tage eine Zeile, unabhängig von den Aktiv-Tagen der
   * Position. `positionenFuerMotor` wird dafür nicht mehr gebraucht.
   *
   * @returns { freierTag, manuelleZuweisungen }
   */
  function baueKonzentrationsZuweisungen(person, positionId, wochenStartISO, wunschtageByPersonId, historieByPersonId, bestehendeEreignisse, ausgeschlosseneTage) {
    var tage = wochentageMoSa(wochenStartISO);
    var zuweisung = wuerfleVersuch([person], wochenStartISO, wunschtageByPersonId, historieByPersonId, bestehendeEreignisse, [], ausgeschlosseneTage);
    var freierTag = zuweisung[person.id];

    var manuelleZuweisungen = tage.filter(function (t) { return t !== freierTag; }).map(function (t) {
      return { datumISO: t, positionId: positionId, personId: person.id };
    });
    return { freierTag: freierTag, manuelleZuweisungen: manuelleZuweisungen };
  }

  var api = {
    isoDatum: isoDatum,
    findeTauschVorschlaege: findeTauschVorschlaege,
    baueLueckenListeFuerVariante: baueLueckenListeFuerVariante,
    berechneTagesDetails: berechneTagesDetails,
    berechneNeueTageFuerZeitraum: berechneNeueTageFuerZeitraum,
    baueTageweiseManuelleZuweisungen: baueTageweiseManuelleZuweisungen,
    baueDebugExportDaten: baueDebugExportDaten,
    baueManuellenTauschEreignisse: baueManuellenTauschEreignisse,
    verbessereVarianteMitHillClimbing: verbessereVarianteMitHillClimbing,
    versucheCrossSchichtNachbesserung: versucheCrossSchichtNachbesserung,
    fasseCrossSchichtVorschauZusammen: fasseCrossSchichtVorschauZusammen,
    waehleKonzentrationsPosition: waehleKonzentrationsPosition,
    findeRisikoAndernorts: findeRisikoAndernorts,
    findeAlternativeKonzentrationsKette: findeAlternativeKonzentrationsKette,
    baueKonzentrationsZuweisungen: baueKonzentrationsZuweisungen
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.BOS_ENTWUERFE_BERECHNUNG = api;
  }
})(typeof window !== 'undefined' ? window : global);
