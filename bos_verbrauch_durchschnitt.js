/**
 * bos_verbrauch_durchschnitt.js
 * ------------------------------------------------------------
 * Zentrale Host-Funktion zur Durchschnittsberechnung und zum
 * automatischen Ausreißer-Check für Verbrauchsdaten.
 *
 * Grund für eine eigene, zentrale Datei statt Inline-Logik im
 * Satelliten: "eine Host-Funktion, mehrere Aufrufer" — gleiches
 * Prinzip wie bos_firebase_config.js. Jeder künftige Aufrufer
 * (Foto-Prompt-Erfassung, ein späterer Schnellrechner, KI-Chat)
 * soll dieselbe Rechenlogik nutzen, nicht jeweils eine eigene.
 *
 * WICHTIG — strikte Trennung der Datentöpfe:
 * Diese Datei rechnet AUSSCHLIESSLICH mit type: 'verbrauch_manuell'.
 * Offizielle Daten (künftig 'verbrauch_offiziell') bekommen bei
 * Bedarf eine eigene, getrennte Berechnung — kein gemeinsamer
 * Mittelwert über beide Datentöpfe. Siehe SESSION_2026-08-27_
 * VERBRAUCH_FIRESTORE_MIGRATION.md, §4.
 *
 * Einbindung (Unterordner-Satellit) — Reihenfolge wichtig, die
 * Zeitkontext-Referenzdatei muss vor dieser Datei geladen sein:
 *   <script src="../bos_zeitkontext_referenz.js"></script>
 *   <script src="../bos_firebase_config.js"></script>
 *   <script src="../bos_produkte.js"></script>   (seit 13.10.2026 Pflicht
 *        für holeWochenbedarf/holeDurchschnitt mit Produkt — Einheiten)
 *   <script src="../bos_verbrauch_durchschnitt.js"></script>
 *
 * ZIEL-ABLAGEORT: baeckereios/bos_verbrauch_durchschnitt.js (Root-Ebene,
 * gleiche Ebene wie bos_firebase_config.js, bos_access_guard.js). Root
 * nutzt ./bos_verbrauch_durchschnitt.js, Unterordner-Satelliten ../.
 * Bestätigt korrekt abgelegt seit 29.08.2026.
 *
 * Firestore-Hinweis: Die Abfrage in holeManuelleWerte() kombiniert
 * zwei Gleichheits-Filter (type, wochentag) mit einer Sortierung
 * (orderBy ts). Firestore verlangt dafür einen Composite-Index.
 * Beim allerersten Aufruf erscheint in der Browser-Konsole ein
 * Fehler mit einem direkten Link zum Anlegen dieses Index — einmalig
 * anklicken, danach funktioniert die Abfrage dauerhaft.
 *
 * ABWEICHUNGS-DEFINITION (Stand 29.08.2026) — AND-Logik statt
 * einzelner Prozent-Schwelle:
 * Ein Wert gilt nur als auffällig, wenn ER GLEICHZEITIG die absolute
 * UND die relative Schwelle reißt. Übernommen aus der bewährten
 * Ausreißerkontrolle des Altsystems (mega_erfassung.html,
 * getWochentagDurchschnitt, Mai 2026) — siehe
 * abweichung_ausreisserkontrolle.md. Dort wörtlich begründet:
 * "Die AND-Verknüpfung ist das Herzstück des Systems, sie verhindert
 * False Positives bei kleinen Produkten." Eine reine Prozent-Schwelle
 * bestraft kleine Produkte unverhältnismäßig (3 → 4 Stück ist schon
 * +33 %, obwohl das normale Schwankung ist) — die absolute Schwelle
 * fängt genau das ab. BEWUSST NICHT auf OR umschaltbar (Altsystem-
 * Entscheidung explizit übernommen, siehe Quelldoku §4.4, Frage 2).
 *
 * ÄNDERUNGSPROTOKOLL:
 * 29.08.2026 — SCHWELLE_ABWEICHUNG (einzelne 50%-Schwelle, ungeprüfter
 *   Platzhalterwert) ersetzt durch SCHWELLE_PROZENT + SCHWELLE_ABSOLUT
 *   mit AND-Verknüpfung, Werte aus dem Altsystem übernommen (30% /
 *   5 Einheiten). pruefeAusreisser() nimmt jetzt optional ein
 *   einstellungen-Objekt entgegen (Vorbereitung für die künftige
 *   System-Standard-/Eigene-Einstellungen-Ebene aus SESSION_2026-08-29_
 *   DURCHSCHNITTSBERECHNUNG_ZEITKONTEXT.md, §3) — ohne dieses Argument
 *   verhält sich die Funktion wie bisher (rückwärtskompatibel zum
 *   bestehenden Aufruf aus verbrauch_manuell.html).
 * 29.08.2026 — holeManuelleWerte() schließt jetzt besondere Tage aus
 *   der Vergleichsbasis aus (Zeitkontext-Anbindung, siehe unten).
 * 29.08.2026 — System-Standard-/Eigene-Einstellungen-Ebene aus
 *   SESSION_2026-08-29_DURCHSCHNITTSBERECHNUNG_ZEITKONTEXT.md, §3
 *   tatsächlich gebaut (siehe Abschnitt EINSTELLUNGEN-AUFLÖSUNG unten).
 *   Kontiguierlich/Stichprobe-Modus aus dem Altsystem (wochenconfig_
 *   editor.html) jetzt real implementiert statt "alle Werte". Aktiv-
 *   Flag-Entscheidung final: pro Datentopf, nicht pro Feld.
 * 31.08.2026 — holeDurchschnitt() + holeWochenbedarf() ergänzt (siehe
 *   Abschnitt PRODUKTIONSKETTE unten) — schließt die needs[]-Lücke für
 *   bos_produktionskette.js. Reine Getter, keine Änderung an bestehenden
 *   Funktionen, rückwärtskompatibel.
 * 31.08.2026 — holeOffizielleWerte() ergänzt, holeDurchschnitt()/
 *   holeWochenbedarf() um optionalen datentopf-Parameter erweitert
 *   (Default 'manuell', bestehende Aufrufer unverändert kompatibel).
 *   Schließt die Lücke aus SCHNELLRECHNER_DOKU.md §8 Punkt 10: der
 *   Offiziell-Datentopf hatte echte migrierte Daten (backmengen_db.json),
 *   aber keine Leseslogik. Dokumentschema gegen die echte
 *   verbrauch_einstellungen_editor.html (ladeDatenbestand()) geprüft, NICHT
 *   angenommen — anderes Schema als verbrauch_manuell (produkte-Objekt statt
 *   eintraege-Array, kein eigener wochentag-String, wird aus datum abgeleitet).
 * 31.08.2026 — FIX (Ulf-Fund, echter Firestore-Test): holeOffizielleWerte()
 *   hängte fälschlich "_stueck"/"_bleche" an legacyKey an, obwohl legacyKey
 *   diesen Suffix bereits als festen Bestandteil enthält (z. B.
 *   "hasenberger_stueck") — jedes Produkt zeigte dadurch 0 Verbrauch.
 *   Lookup jetzt direkt über legacyKey ohne Suffix-Anhang.
 * 31.08.2026 — FIX #2, gleicher Live-Test (Produkt blieb nach Fix #1 immer
 *   noch bei 0): holeOffizielleWerte() wendete das rollierende "letzte X
 *   Wochen"-Suchfenster an, das für laufende Manuell-Erfassung Sinn ergibt,
 *   aber nicht für einen einmaligen historischen Import (Daten enden
 *   24.05.2026, werden nie wieder "frisch"). Zeitfenster-Ausschluss für
 *   diesen Datentopf komplett entfernt — stichprobeAnzahl begrenzt die
 *   Menge weiterhin, nur nicht mehr zusätzlich nach Alter.
 * 31.08.2026 — FIX #3, gleicher Live-Test (immer noch 0, jetzt gegen echte
 *   produkt_config.json geprüft — legacyKey war korrekt, Fix #1 also schon
 *   richtig): orderBy('datum') aus der Abfrage entfernt. Die nachweislich
 *   funktionierende Referenz-Abfrage in verbrauch_einstellungen_editor.html
 *   (ladeDatenbestand(), zeigt echte 36 Tage/116 Produkte) nutzt exakt
 *   denselben where-Filter OHNE orderBy — ein fehlender Index dafür hätte
 *   die Abfrage still scheitern lassen (vom catch abgefangen, kein
 *   sichtbarer Fehler, Ergebnis in jedem Fall []). Sortierung jetzt
 *   clientseitig nach dem Abruf.
 * 13.10.2026 · 12:08 — EINHEITEN (Baustelle #64, SESSION_2026-10-13_
 *   EINHEITEN_BAU.md, Freigabe Kontroll-Chat 11:48). holeDurchschnitt()/
 *   holeWochenbedarf() nehmen als letzten Parameter das Produkt und liefern
 *   in dessen Einheit, mit `einheit` in der Antwort. Behebt die Doppel-
 *   teilung an den Stationen (Mitschrift lag schon in Trägern, die Station
 *   teilte trotzdem) und die Teilung bei Stück-Produkten. Ohne Produkt
 *   unverändert roh (alte Aufrufer). holeManuelleWerte(), holeOffizielle-
 *   Werte(), pruefeAusreisser() unverändert. Siehe Abschnitt EINHEITEN.
 * 15.10.2026 · 01:18 — RICHTWERT (Baustelle #63, SESSION_2026-10-14_
 *   RICHTWERT_BAU.md, Freigabe Kontroll-Chat 14.10., 19:19). Dritter
 *   Datentopf 'richtwert': liest NICHT aus bos_events, sondern aus dem
 *   mitgegebenen Produkt (Feld richtwert, Mo = 0 … So = 6, schon in der
 *   Einheit des Produkts — keine Umrechnung, keine Rundung). Nicht-Backtag
 *   (Feld backTage) → 0, verlässlich; Backtag mit Wert → Wert, verlässlich;
 *   Backtag leer → 0, NICHT verlässlich (die Warnung der Aufrufer greift).
 *   Kein Mischen mit anderen Töpfen. holeWochenbedarf() liefert mit Produkt
 *   zusätzlich anzahl[7] (Werte je Tag; additiv, das Füllen im Editor
 *   unterscheidet damit „keine Backzettel-Zahl“ von „Schnitt 0“). Neu
 *   durchgang(): solange er läuft, holt jede Abfrage (Topf + Wochentag) ihre
 *   Dokumente nur einmal, und Lesefehler werden gesammelt und am Ende
 *   geworfen statt still zu [] zu werden. Nur die Sammel-Knöpfe im Editor
 *   nutzen ihn; ohne durchgang() ist alles wie vorher (#65 bleibt offen).
 * 19.10.2026 · 17:32 — BACKZETTEL-ERFASSUNG Stufe 1 (Kern-Datei, Freigabe
 *   Ulf E19 08:28; Bauplan SESSION_2026-10-19_BACKZETTEL_STUFE1_BAU.md,
 *   FREIGABE_2026-10-19_BACKZETTEL_STUFE1_BAUPLAN.md 09:47, B2–B5). Nur der
 *   Backzettel-Topf; Mitschrift, Richtwert, Einheiten, pruefeAusreisser()
 *   unverändert. Neu bzw. geändert:
 *   - F1: Der Topf wird NEUESTE zuerst gelesen (orderBy datum desc + limit).
 *     Vorher limit() ohne Sortierung = die ÄLTESTEN 400 Tage (Firestore
 *     sortiert dann nach Dokument-ID) — nach ~1 Jahr täglicher Erfassung
 *     wären neue Zettel still nicht mehr in den Schnitt gegangen. Braucht
 *     EINMAL einen Index (bos_events: type ↑, datum ↓); fehlt er, kommt ein
 *     sichtbarer Fehler mit Link (Art 'index_fehlt'), kein stilles [].
 *   - Leseflut (Bauplan Fund 2, Ulf 09:15): EINE gemeinsame Abfrage
 *     (_offizielleDokumente). Gleichzeitige Aufrufer teilen sie, das Ergebnis
 *     bleibt OFFIZIELL_MERKEN_MS (60 s) gemerkt; ein FEHLER wird nicht gemerkt
 *     (B2). vergissOffizielle() leert den Speicher (nach dem Speichern).
 *     Station mit 15 Backzettel-Produkten: 1 statt 105 Abrufe, gleiche Zahlen.
 *   - #65 nur für diesen Topf: holeOffizielleWerte() WIRFT einen eingeordneten
 *     Fehler (art, meldung, code, original, link) statt still [] zu liefern.
 *     holeManuelleWerte() bleibt wie es ist (nicht beauftragt).
 *   - F2: Werte, deren legacyKey im Feld `ausgeschlossen` des Tages steht,
 *     zählen nicht (Alttage ohne das Feld unverändert).
 *   - B3 (Ulf U2): Schulferien zählen beim Backzettel MIT; nur Feiertage und
 *     Betriebsurlaub fliegen raus. BOS_IST_BESONDERER_TAG() meldet Ferien und
 *     Betriebsurlaub beide als 'ferien' — der Betriebsurlaub wird deshalb
 *     getrennt über window.BOS_FEIERTAGE.betriebsurlaub erkannt.
 *   - B4 (Ulf U3, O8): Das Zeitfenster gilt wieder, wie bei der Mitschrift:
 *     Stichprobe nur innerhalb suchfensterWochen, Kontiguierlich innerhalb
 *     kontiguierlichTage. Der alte Grund („einmaliger Import, nie wieder
 *     frisch“) stimmt seit der Erfassung nicht mehr.
 *   - B5: Tage NACH heute zählen nie (Test-Dokumente, falsch gelesenes Jahr).
 *   - Neu holeOffizielleTage(db): die Tagesdokumente selbst, neueste zuerst
 *     (Erfassungs-Seite: Startstand, „fehlt“, „kam n×“). Dieselbe Abfrage.
 *   - Neu pruefeBackzettelWert(): Abweichung in Blechen UND Prozent (AND),
 *     Schwellen erfassungSchwelleBleche / erfassungSchwelleProzent.
 *   - holeEinstellungen(): Klassen-Standard um diese zwei Schwellen ergänzt
 *     (3 Bleche, 20 %, Ulf E18 08:25).
 * 20.10.2026 · 06:59 — EINSTELLUNGEN IN DIE DATENBANK (Kern-Datei, Ulf
 *   „Ja, beide“ 06:20; Bauplan SESSION_2026-10-20_VERBRAUCH_AUFRAEUMEN_BAU.md,
 *   FREIGABE_2026-10-20_VERBRAUCH_AUFRAEUMEN_BAUPLAN.md, V1–V6). Geändert nur
 *   holeEinstellungen() (Quelle; Rückgabeform gleich, Kommentarfelder der
 *   Datei fallen weg). Neu: EINSTELLUNGEN_FELDER (Grenzen = Editor = Regel),
 *   einstellungsFelder(), nurEinstellungsFelder(), pruefeEinstellungsBlock(),
 *   einstellungenHerkunft(), holeEinstellungenHerkunft(), vergissEinstellungen()
 *   und die internen _einstellungenQuelle/_ladeEinstellungenQuelle/
 *   _leseEinstellungenDok/_leseEinstellungenDatei/_leseEinstellungsKopie/
 *   _schreibeEinstellungsKopie/_einstellungenGrund/_einstellungenHerkunftTexte.
 *   Entfernt: Ebene „Eigene lokale Einstellungen“ (P2). Unverändert: die ganze
 *   Rechnung (holeManuelleWerte, holeOffizielleWerte, pruefeAusreisser,
 *   pruefeBackzettelWert, holeDurchschnitt, holeWochenbedarf, durchgang).
 *
 * EINHEITEN (Stand 13.10.2026, Baustelle #64):
 *   Regel: jede Bedarfszahl verlässt diesen Host in der `einheit` des
 *   Produkts (Träger: Blech, Diele, Lochblech … — oder Stück). Die Aufrufer
 *   rechnen nichts mehr um. Die Einheiten-Logik selbst (Stück oder Träger,
 *   welcher, Stück ↔ Träger) steht in bos_produkte.js (BOS_PRODUKTE.einheit),
 *   hier wird nur entschieden, in welcher Einheit ein Topf vorliegt:
 *     offiziell (Backzettel)  Stück (Schlüssel <x>_stueck) → in den Träger
 *                             teilen; Schlüssel auf _bleche: schon Träger
 *     manuell (Mitschrift)    schon Produkt-Einheit → nichts
 *     Froster-Bestand         Träger, berührt dieser Host nicht
 *   Stück-Produkte werden nie umgerechnet. Fehlt `einheit`, wird wie bis
 *   13.10. gerechnet (Träger mit stueckProBlech) — Übergang, der Editor
 *   zeigt die Lücke.
 *   ~~ALT (31.08.–13.10.2026): „Verbrauch ist intern durchgehend in STÜCK,
 *   die Aufrufer rechnen über stueckProBlech in Bleche um“ (schnellrechner.
 *   html, Kommentar 01.09.).~~ Stimmte nur für den Backzettel. Die Mitschrift
 *   speichert seit 29.08. bei Umschalter-Produkten in Trägern; die Stationen
 *   teilten sie trotzdem noch einmal (10 Bleche → 0,5 Blech).
 *
 * EINSTELLUNGEN-AUFLÖSUNG — NEU 20.10.2026 (Verbrauch aufräumen, Freigabe KC
 * 06:20, Ulf: Kern-Datei „Ja, beide“): Reihenfolge jetzt
 *   1. Datenbank verbrauch_einstellungen/system (einmal je Seite, geteilte
 *      Anfrage, Zeitlimit 10 s; ein vorhandenes Dokument gilt GANZ oder gar
 *      nicht — nie mit Datei oder Startwerten gemischt)
 *   2. Gerätekopie (localStorage bos_verbrauch_einstellungen_geraetekopie),
 *      nur wenn die Datenbank nicht antwortet oder das Dokument ungültig ist
 *   3. Datei bos_verbrauch_einstellungen.json — Datenbank leer, oder keine
 *      Kopie da (Notfall-Kopie, Ulf speichert im Editor)
 *   4. Klassen-Konstanten
 * Herkunft immer sichtbar: einstellungenHerkunft() / holeEinstellungenHerkunft().
 * Die frühere Ebene „Eigene lokale Einstellungen“ ist ENTFERNT (kein Schreiber,
 * keine Anzeige). Der folgende Absatz ist der alte Stand (zur Geschichte):
 *
 * ~~EINSTELLUNGEN-AUFLÖSUNG (Stand 29.08.2026):~~
 * holeEinstellungen(datentopf) löst die Berechnungs-Einstellungen nach
 * der in SESSION_2026-08-29_DURCHSCHNITTSBERECHNUNG_ZEITKONTEXT.md §3
 * festgelegten Reihenfolge auf:
 *   1. Eigene lokale Einstellungen (localStorage, profilgebunden über
 *      activeProfileId aus bos_launcher_state_v2) — NUR wenn `aktiv:
 *      true` für den jeweiligen Datentopf gesetzt ist
 *   2. System-Standard-Datei (bos_verbrauch_einstellungen.json,
 *      Root-Ebene, per URL relativ zu dieser Skriptdatei selbst
 *      aufgelöst — funktioniert daher unabhängig davon, aus welcher
 *      Ordnertiefe der aufrufende Satellit liegt)
 *   3. Klassen-Konstanten (MIN_STICHPROBE/SCHWELLE_PROZENT/
 *      SCHWELLE_ABSOLUT) als unterster Boden, falls weder 1 noch 2
 *      verfügbar sind — funktioniert also auch ganz ohne Datei
 *
 * pruefeAusreisser() löst das automatisch auf, wenn kein einstellungen-
 * Objekt übergeben wird — der bestehende Aufruf aus verbrauch_manuell.html
 * (ohne 5. Parameter) profitiert davon ohne Codeänderung dort.
 *
 * NACHTRÄGLICH DOCH ÜBERNOMMEN (29.08.2026): manuelle Tages-Ausschlüsse
 * mit Grund (`einstellungen.ausgeschlosseneTage`) — Ulf wollte den alten
 * Kalender-Klick-Workflow zurück (wochenconfig_editor.html-Vorbild),
 * siehe verbrauch_einstellungen_editor.html. WEITERHIN NICHT übernommen:
 * die Abschaltbarkeit von Feiertage-/Sondertage-Ausschluss — der bleibt
 * unbedingt (siehe ZEITKONTEXT-ANBINDUNG oben), dafür gab es keine
 * konkrete Anfrage.
 *
 * ZEITKONTEXT-ANBINDUNG (Stand 29.08.2026):
 * holeManuelleWerte() schließt Tage aus der Vergleichsbasis aus, für
 * die entweder das Nutzer-Flag `besondererTag` gesetzt wurde ODER
 * bos_zeitkontext_referenz.js sie als Feiertag/Ferien führt. Beide
 * Signale sind unabhängig voneinander ausreichend — ein Tag muss
 * nicht von beiden erkannt werden. Bewusst NUR die synchrone Datei-
 * Ebene aus bos_zeitkontext.js' Prioritätskette genutzt (nicht die
 * volle status()-Funktion mit Firestore-Abfrage): Für jeden der bis
 * zu MAX_DOKUMENTE_SCAN historischen Einträge zusätzlich einen
 * Firestore-Read für einen möglichen Admin-Override zu machen, wäre
 * unverhältnismäßig teuer für einen Zweck (spontane Tages-Overrides
 * durch den Chef), der ohnehin auf den aktuellen Tag zielt, nicht auf
 * die rückwirkende Neubewertung der Vergleichsbasis. Graceful
 * Degradation: fehlt bos_zeitkontext_referenz.js (nicht eingebunden),
 * wird einfach nichts ausgeschlossen — Verhalten wie vor dieser
 * Änderung.
 *
 * PRODUKTIONSKETTE (Stand 31.08.2026): bos_produktionskette.js
 * (BOS_KETTE.berechne()) existiert jetzt und braucht needs[] pro Produkt,
 * Mo=0…So=6. Dafür neu: holeDurchschnitt() (ein Wochentag) und
 * holeWochenbedarf() (alle sieben, fertiges needs[]-Array). Beide reine
 * Getter über holeManuelleWerte() — keine eigene Filter-/Modus-Logik,
 * keine Dopplung der Einstellungen-Auflösung. [Stand 13.10.2026: Aufrufer
 * sind die vier Stationsseiten und der Schnellrechner; sie reichen needs[]
 * an BOS_KETTE.berechne() weiter. bos_produktionskette.js ruft diesen Host
 * selbst nicht auf.]
 *
 * NICHT verdrahtet: bos_hamster.js dockt weiterhin nicht hier an — das
 * war nie der richtige Ort (Hamster-Eskalation gehört in die Kette selbst,
 * nicht in die Durchschnittsberechnung, siehe SESSION_2026-08-29_
 * HAMSTER_KONZEPT.md §4.2). Bleibt unverändert getrennt.
 * ------------------------------------------------------------
 */

window.BOS_VERBRAUCH = {

  // Pfad zur System-Standard-Datei, aufgelöst relativ zu dieser Skriptdatei
  // selbst (nicht relativ zur aufrufenden Seite) — funktioniert daher aus
  // jeder Ordnertiefe, ohne dass ein Aufrufer einen Pfad kennen muss.
  // Fallback auf den reinen Dateinamen, falls document.currentScript nicht
  // verfügbar ist (z. B. bei dynamischem Nachladen des Skripts).
  _EINSTELLUNGEN_URL: (() => {
    try {
      return new URL('bos_verbrauch_einstellungen.json', document.currentScript.src).href;
    } catch (fehler) {
      return 'bos_verbrauch_einstellungen.json';
    }
  })(),

  // UNGENUTZT seit 20.10.2026 (Ebene „Eigene lokale Einstellungen“ entfernt,
  // P2). Name NICHT wiederverwenden — alte Geräte können das Objekt noch tragen.
  EINSTELLUNGEN_LOCALSTORAGE_KEY: 'bos_verbrauch_einstellungen_lokal',

  // Einmalig geladene System-Standard-Datei, danach aus dem Speicher bedient
  // statt bei jedem Aufruf erneut zu fetchen.
  _einstellungenDateiCache: null,

  // AND-Logik (siehe Header): ein Wert ist nur dann auffällig, wenn BEIDE
  // Schwellen gleichzeitig gerissen werden. Werte 1:1 aus dem bewährten
  // Altsystem übernommen (mega_erfassung.html, Stand Mai 2026).
  //
  // Relative Mindestabweichung vom Durchschnitt (30 % = 0.30).
  SCHWELLE_PROZENT: 0.30,

  // Absolute Mindestabweichung in Produkteinheiten (Bleche, Stück, …).
  // Fängt genau die kleinen Produkte ab, bei denen eine winzige absolute
  // Änderung schon eine große relative Abweichung ergibt.
  SCHWELLE_ABSOLUT: 5,

  // Kaltstart-Schutz: Unter dieser Anzahl an vorhandenen Werten für das
  // jeweilige Produkt + Wochentag findet kein Alarm statt (siehe Konzept-
  // Doku: "kein Alarm, kein Ersatz-Vergleichswert" im Kaltstart-Fall).
  MIN_STICHPROBE: 3,

  // Obergrenze, wie viele bos_events-Dokumente pro Abfrage gescannt werden.
  // Begrenzung aus Performance-Gründen, analog zum Batch-Limit-Gedanken bei
  // produkt_config_sync.html. Bei aktueller Erfassungsfrequenz (max. 1x/Tag)
  // deckt das grob mehr als ein Jahr an Historie ab.
  MAX_DOKUMENTE_SCAN: 400,

  // 15.10.2026 (#63): laufender Durchgang (siehe durchgang()), sonst null.
  _durchgang: null,

  // 19.10.2026 (Backzettel Stufe 1, Fund 2 / B2): gemeinsame Abfrage des
  // Backzettel-Topfs außerhalb eines Durchgangs. { db, zeit, laeuft, promise }
  OFFIZIELL_MERKEN_MS: 60000,
  _offiziellSpeicher: null,
  // Startwerte der Abweichungsprüfung beim Erfassen (Ulf E18, 19.10., 08:25):
  // in BLECHEN laut Zettel (Stück ÷ Charge) UND in Prozent.
  ERFASSUNG_SCHWELLE_BLECHE: 3,
  ERFASSUNG_SCHWELLE_PROZENT: 0.20,
  WT_LANG: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],

  /**
   * Durchgang (15.10.2026, #63): führt `arbeit` aus; währenddessen liest jede
   * Abfrage (Topf + Wochentag) ihre Dokumente nur EINMAL, alle Produkte werten
   * dieselbe Antwort aus — dieselbe Auswertung, nur weniger Lesevorgänge. Ein
   * Lesefehler wird gesammelt; nach der Arbeit wirft durchgang() ihn mit der
   * echten Meldung (die einzelnen Funktionen liefern wie immer []). So wird
   * aus einem Netzfehler nie still „kein Backzettel vorhanden“.
   * @param {function(): Promise<any>} arbeit
   * @returns {Promise<any>} das Ergebnis von `arbeit`
   */
  async durchgang(arbeit) {
    if (this._durchgang) return arbeit();   // verschachtelt: derselbe Speicher
    const dg = { abfragen: new Map(), fehler: [], abrufe: 0 };
    this._durchgang = dg;
    let ergebnis;
    try {
      ergebnis = await arbeit();
    } finally {
      this._durchgang = null;
    }
    if (dg.fehler.length) {
      const e = dg.fehler[0];
      const fehler = new Error('Lesefehler in der Datenbank: ' + ((e && e.message) || String(e)) + (dg.fehler.length > 1 ? ' (und ' + (dg.fehler.length - 1) + ' weitere)' : ''));
      fehler.code = e && e.code;
      fehler.original = e;
      throw fehler;
    }
    return ergebnis;
  },
  /** Statistik des laufenden Durchgangs (für Tests): Zahl der echten Abrufe. */
  durchgangAbrufe() { return this._durchgang ? this._durchgang.abrufe : null; },
  _abfrage(schluessel, holen) {
    const dg = this._durchgang;
    if (!dg) return holen();
    if (!dg.abfragen.has(schluessel)) {
      dg.abrufe++;
      const p = holen();
      p.catch(fehler => { dg.fehler.push(fehler); });
      dg.abfragen.set(schluessel, p);
    }
    return dg.abfragen.get(schluessel);
  },

  /**
   * Richtwert eines Tages (15.10.2026, #63). i = needs-Index (Mo = 0).
   * Wirft sichtbar, wenn bos_produkte.js fehlt oder zu alt ist.
   */
  _richtwertTag(produkt, i) {
    const P = (typeof window !== 'undefined' && window.BOS_PRODUKTE) || null;
    if (!P || typeof P.richtwertWerte !== 'function' || typeof P.backtagIndizes !== 'function') {
      throw new Error('Richtwert: bos_produkte.js ist nicht (oder in einer alten Fassung) geladen — Seite neu laden.');
    }
    if (!P.backtagIndizes(produkt)[i]) return { wert: 0, verlaesslich: true, anzahl: 0, backtag: false };
    const w = P.richtwertWerte(produkt)[i];
    return w === null
      ? { wert: 0, verlaesslich: false, anzahl: 0, backtag: true }
      : { wert: w, verlaesslich: true, anzahl: 1, backtag: true };
  },
  _richtwertOhneProdukt(legacyKey) {
    return new Error('Richtwert: ohne Produkt nicht rechenbar (' + legacyKey + ') — der Richtwert steht am Produkt. Seite neu laden; hilft das nicht: Ulf Bescheid sagen.');
  },

  /**
   * Löst die effektiven Berechnungs-Einstellungen für einen Datentopf auf
   * (siehe Header, Abschnitt EINSTELLUNGEN-AUFLÖSUNG, Stand 20.10.2026):
   * Datenbank (verbrauch_einstellungen/system) > Gerätekopie (nur wenn die
   * Datenbank nicht antwortet) > Datei (Datenbank leer, oder keine Kopie) >
   * Klassen-Konstanten. Woher die Werte kamen: einstellungenHerkunft().
   * Rückgabeform unverändert: { ...Klassen-Standard, ...Block }.
   *
   * @param {'manuell'|'offiziell'} datentopf
   * @returns {Promise<{modus: 'stichprobe'|'kontiguierlich', stichprobeAnzahl: number, suchfensterWochen: number, kontiguierlichTage: number, minStichprobe: number, schwelleProzent: number, schwelleAbsolut: number}>}
   */
  async holeEinstellungen(datentopf) {
    const klassenStandard = () => ({
      modus: 'stichprobe',
      stichprobeAnzahl: 6,
      suchfensterWochen: 12,
      kontiguierlichTage: 28,
      minStichprobe: this.MIN_STICHPROBE,
      schwelleProzent: this.SCHWELLE_PROZENT,
      schwelleAbsolut: this.SCHWELLE_ABSOLUT,
      ausgeschlosseneTage: [],
      // 19.10.2026: nur der Backzettel-Erfassung (pruefeBackzettelWert) — additiv
      erfassungSchwelleBleche: this.ERFASSUNG_SCHWELLE_BLECHE,
      erfassungSchwelleProzent: this.ERFASSUNG_SCHWELLE_PROZENT
    });

    // 20.10.2026: Die frühere Ebene 1 „Eigene lokale Einstellungen“
    // (localStorage bos_verbrauch_einstellungen_lokal) ist entfernt — sie
    // hatte keinen Schreiber und keine Anzeige (P2, SESSION_2026-10-20_
    // VERBRAUCH_AUFRAEUMEN_BAU.md Fund 1). Ein altes Objekt wird nicht
    // gelesen und nicht gelöscht.
    const quelle = await this._einstellungenQuelle();
    const block = quelle.bloecke && quelle.bloecke[datentopf];
    if (block) return { ...klassenStandard(), ...block };
    return klassenStandard();
  },

  /* ---------------- Einstellungen aus der Datenbank (20.10.2026) ----------------
     Muster bos_produkte.js (Gerätekopie, Fehlerarten) und Backzettel B2
     (geteilte Anfrage). EINMAL je Seite gelesen: alle gleichzeitigen Aufrufer
     teilen sich die laufende Anfrage (die Stationen rufen holeEinstellungen
     für alle Produkte gleichzeitig auf — Fund 2). Gilt bis zum Neuladen der
     Seite oder vergissEinstellungen(). Nie still: einstellungenHerkunft(). */

  /** Felder je Topf mit Grenzen — DIESELBEN wie im Editor (min/max) und in der
   *  Regel (veBlock, RK §24). Prozent als Anteil (0,3 = 30 %). V3: die
   *  Prüfdatei vergleicht alle drei maschinell. */
  EINSTELLUNGEN_FELDER: {
    modus: { art: 'wahl', werte: ['stichprobe', 'kontiguierlich'] },
    stichprobeAnzahl: { art: 'ganz', min: 1, max: 50 },
    suchfensterWochen: { art: 'ganz', min: 1, max: 52 },
    kontiguierlichTage: { art: 'ganz', min: 1, max: 365 },
    minStichprobe: { art: 'ganz', min: 1, max: 20 },
    schwelleProzent: { art: 'zahl', min: 0.01, max: 1 },
    schwelleAbsolut: { art: 'zahl', min: 0, max: 1000 },
    ausgeschlosseneTage: { art: 'tage', max: 400, grundMax: 100 },
    erfassungSchwelleBleche: { art: 'zahl', min: 0, max: 100, nurTopf: 'offiziell' },
    erfassungSchwelleProzent: { art: 'zahl', min: 0.01, max: 1, nurTopf: 'offiziell' }
  },
  EINSTELLUNGEN_COLLECTION: 'verbrauch_einstellungen',
  EINSTELLUNGEN_SICHERUNGEN: 'verbrauch_einstellungen_sicherungen',
  EINSTELLUNGEN_DOK: 'system',
  EINSTELLUNGEN_KOPIE_KEY: 'bos_verbrauch_einstellungen_geraetekopie',
  EINSTELLUNGEN_ZEITLIMIT_MS: 10000,
  _einstellungenQuelleP: null,
  _einstellungenHerkunftWert: null,

  /** Die Feldnamen eines Topfs (manuell: 8, offiziell: 10). */
  einstellungsFelder(datentopf) {
    return Object.keys(this.EINSTELLUNGEN_FELDER).filter(k => {
      const n = this.EINSTELLUNGEN_FELDER[k].nurTopf;
      return !n || n === datentopf;
    });
  },

  /** Nur die erlaubten Felder eines Topfs (V1: im Block manuell nie die
   *  Erfassungs-Schwellen, auch wenn der Klassen-Standard sie trägt). */
  nurEinstellungsFelder(block, datentopf) {
    const out = {};
    this.einstellungsFelder(datentopf).forEach(k => { if (block && block[k] !== undefined) out[k] = block[k]; });
    return out;
  },

  /**
   * Prüft einen Block wie die Regel (veBlock): genau die Felder des Topfs,
   * Typen, Grenzen; dazu die Einträge in ausgeschlosseneTage (das kann die
   * Regel nicht). Liefert [] oder [{ feld, grund }].
   */
  pruefeEinstellungsBlock(block, datentopf) {
    const fehler = [];
    if (!block || typeof block !== 'object' || Array.isArray(block)) return [{ feld: null, grund: 'Block fehlt' }];
    const felder = this.einstellungsFelder(datentopf);
    Object.keys(block).forEach(k => { if (felder.indexOf(k) === -1) fehler.push({ feld: k, grund: 'unbekanntes Feld' }); });
    felder.forEach(k => {
      const d = this.EINSTELLUNGEN_FELDER[k];
      const w = block[k];
      if (w === undefined || w === null) { fehler.push({ feld: k, grund: 'fehlt' }); return; }
      if (d.art === 'wahl') {
        if (d.werte.indexOf(w) === -1) fehler.push({ feld: k, grund: 'unbekannter Wert „' + w + '“' });
      } else if (d.art === 'ganz' || d.art === 'zahl') {
        if (typeof w !== 'number' || !Number.isFinite(w)) fehler.push({ feld: k, grund: 'keine Zahl' });
        else if (d.art === 'ganz' && !Number.isInteger(w)) fehler.push({ feld: k, grund: 'keine ganze Zahl' });
        else if (w < d.min || w > d.max) fehler.push({ feld: k, grund: 'außerhalb ' + d.min + '–' + d.max });
      } else if (d.art === 'tage') {
        if (!Array.isArray(w)) { fehler.push({ feld: k, grund: 'keine Liste' }); return; }
        if (w.length > d.max) fehler.push({ feld: k, grund: 'mehr als ' + d.max + ' Tage' });
        w.forEach((t, i) => {
          const ok = t && typeof t === 'object' && !Array.isArray(t)
            && Object.keys(t).every(x => x === 'datum' || x === 'grund')
            && typeof t.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.datum)
            && (t.grund === undefined || (typeof t.grund === 'string' && t.grund.length <= d.grundMax));
          if (!ok) fehler.push({ feld: k, grund: 'Eintrag ' + (i + 1) + ' ungültig (Datum JJJJ-MM-TT, Grund höchstens ' + d.grundMax + ' Zeichen)' });
        });
      }
    });
    return fehler;
  },

  /** Woher die Einstellungen dieser Seite kommen (null, solange nicht geladen).
   *  { quelle: 'datenbank'|'geraetekopie'|'datei'|'konstanten', stand,
   *    geaendertAm (ms|null), geaendertVon, leer, grund {art, meldung}|null,
   *    dateiGrund, text, kurz, warnung } */
  einstellungenHerkunft() {
    const h = this._einstellungenHerkunftWert;
    if (!h) return null;
    return Object.assign({}, h, this._einstellungenHerkunftTexte(h));
  },
  /** Wie einstellungenHerkunft(), lädt aber vorher (für Anzeigen beim Start). */
  async holeEinstellungenHerkunft() {
    await this._einstellungenQuelle();
    return this.einstellungenHerkunft();
  },
  /** Vergisst den gelesenen Stand dieser Seite (Editor nach dem Speichern). */
  vergissEinstellungen() {
    this._einstellungenQuelleP = null;
    this._einstellungenHerkunftWert = null;
  },

  _einstellungenQuelle() {
    if (!this._einstellungenQuelleP) {
      this._einstellungenQuelleP = this._ladeEinstellungenQuelle().then(q => {
        this._einstellungenHerkunftWert = q.herkunft;
        if (q.herkunft.quelle !== 'datenbank') {
          try { console.warn('BOS_VERBRAUCH.holeEinstellungen: ' + this._einstellungenHerkunftTexte(q.herkunft).text); } catch (e) { /* ohne Konsole */ }
        }
        return q;
      });
    }
    return this._einstellungenQuelleP;
  },

  async _ladeEinstellungenQuelle() {
    let dbGrund = null;
    try {
      const dok = await this._leseEinstellungenDok();
      if (!dok.existiert) {
        // Datenbank leer → Datei (bis zur Erst-Füllung im Editor)
        const leer = { art: 'leer', meldung: 'Die Datenbank ist noch leer.' };
        try {
          return { bloecke: await this._leseEinstellungenDatei(), herkunft: { quelle: 'datei', leer: true, grund: leer } };
        } catch (e2) {
          return { bloecke: null, herkunft: { quelle: 'konstanten', leer: true, grund: leer, dateiGrund: this._einstellungenGrund(e2) } };
        }
      }
      const d = dok.daten || {};
      const fm = this.pruefeEinstellungsBlock(d.manuell, 'manuell');
      const fo = this.pruefeEinstellungsBlock(d.offiziell, 'offiziell');
      if (!fm.length && !fo.length && Number.isInteger(d.stand)) {
        const am = d.geaendertAm && typeof d.geaendertAm.toMillis === 'function' ? d.geaendertAm.toMillis() : null;
        const herkunft = { quelle: 'datenbank', stand: d.stand, geaendertAm: am, geaendertVon: d.geaendertVon || null, grund: null };
        this._schreibeEinstellungsKopie({ stand: d.stand, geaendertAm: am, geaendertVon: d.geaendertVon || null, manuell: d.manuell, offiziell: d.offiziell });
        return { bloecke: { manuell: d.manuell, offiziell: d.offiziell }, herkunft };
      }
      // „ganz oder gar nicht“: ein unvollständiges Dokument wird nie mit Startwerten aufgefüllt
      const erste = fm.map(f => 'Mitschrift ' + f.feld + ': ' + f.grund).concat(fo.map(f => 'Backzettel ' + f.feld + ': ' + f.grund));
      if (!Number.isInteger(d.stand)) erste.push('stand fehlt');
      dbGrund = { art: 'unvollstaendig', meldung: 'Datenbank-Dokument unvollständig oder ungültig: ' + erste.slice(0, 3).join('; ') };
    } catch (fehler) {
      dbGrund = this._einstellungenGrund(fehler);
    }
    const kopie = this._leseEinstellungsKopie();
    if (kopie) {
      return { bloecke: { manuell: kopie.manuell, offiziell: kopie.offiziell },
        herkunft: { quelle: 'geraetekopie', stand: kopie.stand, geaendertAm: kopie.geaendertAm, geaendertVon: kopie.geaendertVon, grund: dbGrund } };
    }
    try {
      return { bloecke: await this._leseEinstellungenDatei(), herkunft: { quelle: 'datei', leer: false, grund: dbGrund } };
    } catch (e3) {
      return { bloecke: null, herkunft: { quelle: 'konstanten', leer: false, grund: dbGrund, dateiGrund: this._einstellungenGrund(e3) } };
    }
  },

  async _leseEinstellungenDok() {
    const w = typeof window !== 'undefined' ? window : {};
    const db = w.db;
    if (!db || typeof db.collection !== 'function') {
      const e = new Error('Datenbank nicht geladen (die Seite bindet bos_firebase_config.js nicht ein)');
      e.art = 'nicht_geladen'; e.meldung = e.message;
      throw e;
    }
    let uhr = null;
    const zeit = new Promise((_, nein) => {
      uhr = setTimeout(() => { const e = new Error('keine Antwort nach ' + (this.EINSTELLUNGEN_ZEITLIMIT_MS / 1000) + ' s'); e.code = 'deadline-exceeded'; nein(e); }, this.EINSTELLUNGEN_ZEITLIMIT_MS);
    });
    const lesen = (async () => {
      if (w.BOS_AUTH_READY) {
        try { await w.BOS_AUTH_READY; } catch (e) { const f = new Error((e && e.message) || String(e)); f.code = 'unauthenticated'; throw f; }
      }
      return db.collection(this.EINSTELLUNGEN_COLLECTION).doc(this.EINSTELLUNGEN_DOK).get();
    })();
    try {
      const snap = await Promise.race([lesen, zeit]);
      if (snap && snap.metadata && snap.metadata.fromCache) {
        const e = new Error('Antwort nur aus dem Zwischenspeicher des Geräts'); e.code = 'unavailable'; throw e;
      }
      const existiert = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
      return { existiert, daten: existiert ? snap.data() : null };
    } finally {
      clearTimeout(uhr);
    }
  },

  async _leseEinstellungenDatei() {
    if (!this._einstellungenDateiCache) {
      const antwort = await fetch(this._EINSTELLUNGEN_URL);
      if (antwort && antwort.ok === false) throw new Error('bos_verbrauch_einstellungen.json nicht ladbar (HTTP ' + antwort.status + ')');
      this._einstellungenDateiCache = await antwort.json();
    }
    const c = this._einstellungenDateiCache || {};
    // Kommentarfelder (_kommentar) der Datei gehören nicht zu den Einstellungen
    const ohneKommentar = b => {
      if (!b || typeof b !== 'object') return null;
      const o = {};
      Object.keys(b).forEach(k => { if (k.charAt(0) !== '_') o[k] = b[k]; });
      return o;
    };
    return { manuell: ohneKommentar(c.manuell), offiziell: ohneKommentar(c.offiziell) };
  },

  _leseEinstellungsKopie() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      const k = JSON.parse(localStorage.getItem(this.EINSTELLUNGEN_KOPIE_KEY) || 'null');
      if (!k || !Number.isInteger(k.stand)) return null;
      if (this.pruefeEinstellungsBlock(k.manuell, 'manuell').length || this.pruefeEinstellungsBlock(k.offiziell, 'offiziell').length) return null;
      return k;
    } catch (e) {
      return null;
    }
  },
  /** Gerätekopie schreiben — nur aus einem vorhandenen, gültigen Dokument
   *  (Leseweg oben, Editor nach dem Speichern). */
  _schreibeEinstellungsKopie(k) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return;
      localStorage.setItem(this.EINSTELLUNGEN_KOPIE_KEY, JSON.stringify({
        stand: k.stand, geaendertAm: k.geaendertAm || null, geaendertVon: k.geaendertVon || null,
        gelesenAm: Date.now(), manuell: k.manuell, offiziell: k.offiziell
      }));
    } catch (e) { /* ohne Speicher geht es auch — dann gibt es eben keine Kopie */ }
  },

  _einstellungenGrund(fehler) {
    if (fehler && fehler.art === 'nicht_geladen') return { art: 'nicht_geladen', meldung: fehler.message };
    if (fehler && !fehler.code && !fehler.art) return { art: 'fehler', meldung: String((fehler && fehler.message) || fehler) };
    const e = this._lesefehler(fehler, 'Einstellungen');
    let meldung = e.message.replace(/^Lesefehler Einstellungen: /, '');
    if (e.art === 'keine_berechtigung') meldung += ' — ist die Regel vom 20.10.2026 schon eingesetzt?';
    return { art: e.art, meldung };
  },

  _einstellungenHerkunftTexte(h) {
    const zwei = n => String(n).padStart(2, '0');
    const wann = ms => { if (!ms) return ''; const d = new Date(ms); return ' vom ' + zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '., ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes()); };
    const g = h.grund && h.grund.meldung ? h.grund.meldung : '';
    if (h.quelle === 'datenbank') {
      return { text: 'Einstellungen aus der Datenbank · Stand ' + h.stand + wann(h.geaendertAm) + (h.geaendertVon ? ' (' + h.geaendertVon + ')' : ''),
        kurz: 'Einstellungen Stand ' + h.stand, warnung: false };
    }
    if (h.quelle === 'geraetekopie') {
      return { text: '⚠︎ Einstellungen vom Gerät (Stand ' + h.stand + wann(h.geaendertAm) + ') — Datenbank nicht erreichbar: ' + g,
        kurz: '⚠︎ Einstellungen vom Gerät', warnung: true };
    }
    if (h.quelle === 'datei') {
      return h.leer
        ? { text: 'Einstellungen aus der Datei — die Datenbank ist noch leer (Einstellungs-Editor: „Aus der Datei in die Datenbank übernehmen“)', kurz: 'Einstellungen aus der Datei', warnung: false }
        : { text: '⚠︎ Einstellungen aus der Datei — Datenbank nicht erreichbar, keine Kopie auf diesem Gerät: ' + g, kurz: '⚠︎ Einstellungen aus der Datei', warnung: true };
    }
    const dg = h.dateiGrund && h.dateiGrund.meldung ? h.dateiGrund.meldung : '';
    return { text: '✕ Einstellungen: Startwerte aus dem Programm — weder Datenbank noch Datei erreichbar: ' + g + ' / ' + dg,
      kurz: '✕ Einstellungen: Startwerte', warnung: true };
  },

  /**
   * Tage zwischen einem ISO-Datum ('YYYY-MM-DD') und heute, lokal berechnet.
   * Bewusst KEIN toISOString()/UTC-Vergleich — führt in deutschen Zeitzonen
   * nachts zu Off-by-one-Fehlern (bekannter Bug, siehe FEHLENDE_TAGE_DOKU.md).
   * Fehlt datumStr, wird "unendlich alt" zurückgegeben (schließt sicherheits-
   * halber aus, statt fälschlich einzuschließen).
   */
  _tageSeit(datumStr) {
    if (!datumStr) return Infinity;
    const [jahr, monat, tag] = datumStr.split('-').map(Number);
    const doc = new Date(jahr, monat - 1, tag);
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    doc.setHours(0, 0, 0, 0);
    return Math.round((heute - doc) / 86400000);
  },

  /**
   * Holt alle bisher manuell erfassten Mengen für ein Produkt an einem
   * bestimmten Wochentag. Nur type: 'verbrauch_manuell' — nie vermischt
   * mit anderen Datentöpfen. Schließt besondere Tage aus (siehe Header,
   * Abschnitt ZEITKONTEXT-ANBINDUNG): weder Tage mit gesetztem
   * `besondererTag`-Flag, noch Feiertage/Ferien laut
   * bos_zeitkontext_referenz.js, noch manuell in den Einstellungen
   * ausgeschlossene Einzeltage (`einstellungen.ausgeschlosseneTage`,
   * neu 29.08.2026 — Kalender-Klick im Editor, siehe VERBRAUCH_
   * EINSTELLUNGEN_EDITOR_DOKU.md) fließen in die Vergleichsbasis ein.
   * Wendet zusätzlich den gewählten Modus an (siehe Header, Abschnitt
   * EINSTELLUNGEN-AUFLÖSUNG): Stichprobe (Anzahl + Suchfenster) oder
   * Kontiguierlich (fester Zeitraum in Tagen).
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} legacyKey
   * @param {string} wochentag  z. B. "Dienstag"
   * @param {object} [einstellungen]  siehe holeEinstellungen() — fehlt es,
   *   gelten die Klassen-Konstanten (Stichprobe, 6 Werte, 12 Wochen Suchfenster)
   * @returns {Promise<number[]>}
   */
  async holeManuelleWerte(db, legacyKey, wochentag, einstellungen) {
    const modus            = einstellungen?.modus ?? 'stichprobe';
    const stichprobeAnzahl = einstellungen?.stichprobeAnzahl ?? 6;
    const suchfensterTage  = (einstellungen?.suchfensterWochen ?? 12) * 7;
    const kontiguierlichTage = einstellungen?.kontiguierlichTage ?? 28;

    const werte = [];
    try {
      // 15.10.2026: im Durchgang nur einmal je Wochentag gelesen (siehe durchgang()).
      const snap = await this._abfrage('manuell|' + wochentag, () => db.collection('bos_events')
        .where('type', '==', 'verbrauch_manuell')
        .where('wochentag', '==', wochentag)
        .orderBy('ts', 'desc')
        .limit(this.MAX_DOKUMENTE_SCAN)
        .get());

      snap.forEach(doc => {
        // Im Stichprobe-Modus reicht's, sobald genug Werte gesammelt sind —
        // Dokumente kommen bereits neueste-zuerst sortiert aus der Abfrage.
        if (modus === 'stichprobe' && werte.length >= stichprobeAnzahl) return;

        const data = doc.data();

        // Zeitkontext-Ausschluss — alle drei Signale unabhängig ausreichend.
        if (data.besondererTag === true) return;
        if (window.BOS_IST_BESONDERER_TAG?.(data.datum)) return;
        if (einstellungen?.ausgeschlosseneTage?.some(t => t.datum === data.datum)) return;

        // Modus-Zeitfenster.
        const alterTage = this._tageSeit(data.datum);
        if (modus === 'kontiguierlich' && alterTage > kontiguierlichTage) return;
        if (modus === 'stichprobe' && alterTage > suchfensterTage) return;

        (data.eintraege || []).forEach(eintrag => {
          if (eintrag.legacyKey === legacyKey && typeof eintrag.menge === 'number') {
            werte.push(eintrag.menge);
          }
        });
      });
    } catch (fehler) {
      // Häufigste Ursache: fehlender Composite-Index beim allerersten Aufruf
      // (siehe Kommentar am Dateianfang). Kein Alarm auslösen, wenn die
      // Datenbasis nicht lesbar ist — lieber kein Check als ein falscher.
      console.warn('BOS_VERBRAUCH.holeManuelleWerte: Abfrage fehlgeschlagen, Check wird übersprungen.', fehler);
      return [];
    }
    return werte;
  },

  /**
   * Bisherige Werte aus dem BACKZETTEL-Topf (type 'verbrauch_offiziell') —
   * Gegenstück zu holeManuelleWerte(), anderes Dokumentschema:
   *   { type: 'verbrauch_offiziell', datum: 'YYYY-MM-DD',
   *     produkte: { '<legacyKey>': Stück, … },          // legacyKey endet auf _stueck
   *     ausgeschlossen: { '<legacyKey>': 'abweichung'|'von_hand' } }   // seit 19.10.2026
   * Der Wochentag wird aus `datum` abgeleitet (Alttage aus dem Import führen
   * ihn nicht verlässlich), deshalb kein serverseitiger Wochentag-Filter.
   *
   * Stand 19.10.2026 (Backzettel-Erfassung Stufe 1) — was zählt NICHT:
   *   - Tage nach heute (B5)
   *   - Feiertage und Betriebsurlaub (Datei-Ebene); Schulferien ZÄHLEN (B3)
   *   - Tage aus einstellungen.ausgeschlosseneTage (Kalender im Editor)
   *   - Tage außerhalb des Zeitfensters (B4): Stichprobe = suchfensterWochen,
   *     Kontiguierlich = kontiguierlichTage — wie bei der Mitschrift
   *   - ein Produkt, das am Tag in `ausgeschlossen` steht (F2)
   * Stichprobe: die stichprobeAnzahl NEUESTEN Werte des Produkts.
   * Lesefehler werden NICHT mehr verschluckt (#65 für diesen Topf): die
   * Funktion wirft den eingeordneten Fehler aus _offizielleDokumente().
   *
   * ~~31.08.2026: kein orderBy, kein Zeitfenster („einmaliger Import, nie
   * wieder frisch“)~~ — beides seit 19.10.2026 überholt (F1, O8/B4).
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} legacyKey
   * @param {string} wochentag  z. B. "Dienstag"
   * @param {object} [einstellungen]
   * @returns {Promise<number[]>}
   */
  async holeOffizielleWerte(db, legacyKey, wochentag, einstellungen) {
    const modus              = einstellungen?.modus ?? 'stichprobe';
    const stichprobeAnzahl   = einstellungen?.stichprobeAnzahl ?? 6;
    const suchfensterTage    = (einstellungen?.suchfensterWochen ?? 12) * 7;
    const kontiguierlichTage = einstellungen?.kontiguierlichTage ?? 28;

    // JS Date.getDay()-Index (0=So…6=Sa) — bewusst NICHT der BOS-Index (Mo=0).
    const WT_JS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const heute = this._heuteIso();

    // Wirft bei Lesefehlern (eingeordnet, mit Index-Link) — kein stilles [].
    const alle = await this._offizielleDokumente(db);
    const docs = alle
      .filter(data => !!data && typeof data.datum === 'string')
      .slice()
      .sort((a, b) => b.datum.localeCompare(a.datum)); // neueste zuerst (Abfrage tut das schon; sicher ist sicher)

    const werte = [];
    docs.forEach(data => {
      if (modus === 'stichprobe' && werte.length >= stichprobeAnzahl) return;

      if (data.datum > heute) return;                       // B5: Zukunft zählt nie

      const [jahr, monat, tag] = data.datum.split('-').map(Number);
      const wt = WT_JS[new Date(jahr, monat - 1, tag).getDay()];
      if (wt !== wochentag) return;

      if (this._feiertagOderBetriebsurlaub(data.datum)) return;   // B3
      if (einstellungen?.ausgeschlosseneTage?.some(t => t.datum === data.datum)) return;

      const alterTage = this._tageSeit(data.datum);               // B4
      if (modus === 'kontiguierlich' && alterTage > kontiguierlichTage) return;
      if (modus === 'stichprobe' && alterTage > suchfensterTage) return;

      // F2: „zählt nicht“ für dieses Produkt an diesem Tag
      if (data.ausgeschlossen && Object.prototype.hasOwnProperty.call(data.ausgeschlossen, legacyKey)) return;

      // legacyKey enthält die Einheit bereits (z. B. "hasenberger_stueck") —
      // direkter Zugriff, kein Suffix-Anhang (Fix 31.08.2026).
      const wert = data.produkte?.[legacyKey];
      if (typeof wert === 'number') werte.push(wert);
    });
    return werte;
  },

  /**
   * Die Tagesdokumente des Backzettel-Topfs, neueste zuerst (Kopien der Daten).
   * Neu 19.10.2026 für die Erfassungs-Seite (Startstand, „fehlt“, „kam n×“).
   * Dieselbe Abfrage wie holeOffizielleWerte() — kein zweiter Weg, im
   * Durchgang und außerhalb geteilt. Wirft eingeordnete Lesefehler.
   * @returns {Promise<object[]>}
   */
  async holeOffizielleTage(db) {
    const alle = await this._offizielleDokumente(db);
    return alle
      .filter(data => !!data && typeof data.datum === 'string')
      .map(data => Object.assign({}, data))
      .sort((a, b) => b.datum.localeCompare(a.datum));
  },

  /** Leert den gemerkten Backzettel-Topf (nach dem Speichern eines Tages). */
  vergissOffizielle() { this._offiziellSpeicher = null; },

  /**
   * DIE eine Abfrage des Backzettel-Topfs (19.10.2026).
   *  - neueste zuerst: orderBy('datum','desc') + limit (F1) — braucht den
   *    Index type ↑ / datum ↓, sonst Fehler 'index_fehlt' mit Link
   *  - im Durchgang: wie bisher einmal je Durchgang (_abfrage)
   *  - außerhalb: gleichzeitige Aufrufer teilen die laufende Abfrage, das
   *    Ergebnis bleibt OFFIZIELL_MERKEN_MS gemerkt; ein Fehler wird nicht
   *    gemerkt — der nächste Aufruf fragt neu (B2)
   * Liefert die Daten (doc.data()) als Liste.
   */
  _offizielleDokumente(db) {
    const holen = () => {
      const sp = this._offiziellSpeicher;
      if (sp && sp.db === db && (sp.laeuft || Date.now() - sp.zeit < this.OFFIZIELL_MERKEN_MS)) {
        return sp.promise;
      }
      const eintrag = { db, zeit: Date.now(), laeuft: true, promise: null };
      this._offiziellSpeicher = eintrag;
      let anfrage;
      try {
        anfrage = Promise.resolve(db.collection('bos_events')
          .where('type', '==', 'verbrauch_offiziell')
          .orderBy('datum', 'desc')
          .limit(this.MAX_DOKUMENTE_SCAN)
          .get());
      } catch (fehler) {
        anfrage = Promise.reject(fehler);
      }
      eintrag.promise = anfrage.then(snap => {
        eintrag.laeuft = false;
        eintrag.zeit = Date.now();
        return snap.docs.map(doc => doc.data());
      }, fehler => {
        if (this._offiziellSpeicher === eintrag) this._offiziellSpeicher = null;   // B2: Fehler nicht merken
        throw this._lesefehler(fehler, 'Backzettel');
      });
      return eintrag.promise;
    };
    return this._abfrage('offiziell', holen);
  },

  /**
   * Ordnet einen Lesefehler ein (Muster einordnen() aus bos_meldungen.js).
   * Ergebnis: Error mit message (Klartext + Code + Originalmeldung, damit
   * Seiten, die nur e.message zeigen, den Grund nennen), art, meldung, code,
   * original und bei fehlendem Index link.
   */
  _lesefehler(fehler, topf) {
    if (fehler && fehler.art && fehler.meldung) return fehler;   // schon eingeordnet
    const code = (fehler && fehler.code) || '';
    const roh = String((fehler && fehler.message) || fehler || '');
    let art = 'fehler', meldung = 'Unerwarteter Fehler beim Lesen.', link = null;
    if (code === 'permission-denied') { art = 'keine_berechtigung'; meldung = 'Die Datenbank hat das Lesen abgelehnt (Konto freigeschaltet? angemeldet?).'; }
    else if (code === 'unavailable') { art = 'kein_netz'; meldung = 'Keine Verbindung zum Server (WLAN?).'; }
    else if (code === 'deadline-exceeded') { art = 'zeitlimit'; meldung = 'Der Server hat nicht rechtzeitig geantwortet.'; }
    else if (code === 'resource-exhausted') { art = 'kontingent'; meldung = 'Das Tageskontingent der Datenbank ist aufgebraucht.'; }
    else if (code === 'unauthenticated') { art = 'nicht_angemeldet'; meldung = 'Nicht angemeldet — bitte an der Tür anmelden.'; }
    else if (code === 'failed-precondition' && /index/i.test(roh)) {
      art = 'index_fehlt';
      const m = roh.match(/https:\/\/console\.firebase\.google\.com\/[^\s)"']+/);
      link = m ? m[0] : null;
      meldung = 'Die Datenbank braucht für den ' + topf + ' einmalig einen Index (bos_events: type aufsteigend, datum absteigend). ' +
        (link ? 'Den Link öffnen, „Index erstellen“ wählen, ein paar Minuten warten, dann neu laden.' : 'In der Firebase-Konsole unter Firestore → Indexe anlegen.');
    }
    const e = new Error('Lesefehler ' + topf + ': ' + meldung + (code ? ' [' + code + ']' : '') + (roh ? ' — ' + roh : ''));
    e.art = art; e.meldung = meldung; e.code = code; e.original = fehler; e.link = link;
    return e;
  },

  /** Heute als 'JJJJ-MM-TT', LOKAL gebildet (nie toISOString — UTC-Falle 0–2 Uhr). */
  _heuteIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  /**
   * B3 (19.10.2026): Feiertag oder Betriebsurlaub? Schulferien nicht.
   * BOS_IST_BESONDERER_TAG() (bos_zeitkontext_referenz.js) meldet Ferien UND
   * Betriebsurlaub als typ 'ferien'; der Betriebsurlaub wird deshalb hier
   * getrennt über window.BOS_FEIERTAGE.betriebsurlaub erkannt. Fehlt die
   * Referenzdatei, wird nichts ausgeschlossen (wie bisher).
   */
  _feiertagOderBetriebsurlaub(datum) {
    const info = (typeof window !== 'undefined' && window.BOS_IST_BESONDERER_TAG) ? window.BOS_IST_BESONDERER_TAG(datum) : null;
    if (info && info.typ === 'feiertag') return true;
    const bu = (typeof window !== 'undefined' && window.BOS_FEIERTAGE && window.BOS_FEIERTAGE.betriebsurlaub) || [];
    return bu.some(f => f && f.von && f.bis && datum >= f.von && datum <= f.bis);
  },

  /**
   * Durchschnittsmenge für ein Produkt an einem Wochentag — dünner Getter
   * über holeManuelleWerte(), keine eigene Filter-/Modus-Logik. Neu
   * 31.08.2026, erster Aufrufer: bos_produktionskette.js (needs[]).
   *
   * Anders als pruefeAusreisser() bricht dieser Getter bei zu wenig Werten
   * NICHT ab, sondern liefert den Durchschnitt trotzdem — eine Planung
   * braucht irgendeine Zahl, auch eine unsichere. `verlaesslich` sagt dem
   * Aufrufer, ob die Mindeststichprobe erreicht wurde; bei komplett
   * fehlenden Werten (`anzahl: 0`) ist `durchschnitt: 0` der bewusste
   * Nullfall, nicht `null` — vermeidet NaN-Fallstricke bei der Weiterrechnung.
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} legacyKey
   * @param {string} wochentag
   * @param {object} [einstellungen]  Wird das weggelassen, löst die Funktion
   *   die Einstellungen selbst über holeEinstellungen(datentopf) auf —
   *   gleiches Muster wie bei pruefeAusreisser().
   * @param {'manuell'|'offiziell'} [datentopf]  Neu 31.08.2026. Default
   *   'manuell' — bestehende Aufrufer (bos_produktionskette.js) bleiben
   *   dadurch unverändert kompatibel, ohne diesen Parameter je zu kennen.
   *   [13.10.2026: bos_produktionskette.js ruft diesen Host gar nicht auf;
   *   Aufrufer sind die vier Stationen und der Schnellrechner.]
   * @param {object} [produkt]  Neu 13.10.2026 (#64): das Produkt aus
   *   BOS_PRODUKTE.lade() (gebraucht: einheit, stueckProBlech). Mit Produkt
   *   kommt `durchschnitt` in der EINHEIT DES PRODUKTS (siehe
   *   _inProduktEinheit), dazu `durchschnittRoh` (im Topf, unverändert) und
   *   `einheit` (BOS_PRODUKTE.einheit). Ohne Produkt: roh wie bisher.
   * @returns {Promise<{durchschnitt: number, anzahl: number, verlaesslich: boolean, durchschnittRoh?: number, einheit?: object}>}
   */
  async holeDurchschnitt(db, legacyKey, wochentag, einstellungen, datentopf, produkt) {
    const effektiverDatentopf = datentopf || 'manuell';
    // 15.10.2026 (#63): Richtwert steht am Produkt — kein Lesevorgang.
    if (effektiverDatentopf === 'richtwert') {
      if (!produkt) throw this._richtwertOhneProdukt(legacyKey);
      const einheitR = this._einheitInfo(produkt);
      const i = this.WT_LANG.indexOf(wochentag);
      if (i === -1) throw new Error('Richtwert: unbekannter Wochentag „' + wochentag + '“.');
      const t = this._richtwertTag(produkt, i);
      return { durchschnitt: t.wert, durchschnittRoh: t.wert, anzahl: t.anzahl, verlaesslich: t.verlaesslich, einheit: einheitR };
    }
    // 13.10.2026 (#64): Einheit VOR dem Lesen klären — fehlt bos_produkte.js,
    // soll der Aufrufer einen sichtbaren Fehler bekommen, keine rohe Zahl.
    const einheit = produkt ? this._einheitInfo(produkt) : null;
    const effektiveEinstellungen = einstellungen || await this.holeEinstellungen(effektiverDatentopf);
    const werte = effektiverDatentopf === 'offiziell'
      ? await this.holeOffizielleWerte(db, legacyKey, wochentag, effektiveEinstellungen)
      : await this.holeManuelleWerte(db, legacyKey, wochentag, effektiveEinstellungen);

    if (werte.length === 0) {
      return produkt
        ? { durchschnitt: 0, durchschnittRoh: 0, anzahl: 0, verlaesslich: false, einheit }
        : { durchschnitt: 0, anzahl: 0, verlaesslich: false };
    }
    const durchschnitt = werte.reduce((summe, w) => summe + w, 0) / werte.length;
    const ergebnis = {
      durchschnitt,
      anzahl: werte.length,
      verlaesslich: werte.length >= effektiveEinstellungen.minStichprobe
    };
    if (!produkt) return ergebnis; // alter Aufruf: unverändert roh (siehe Kopf, EINHEITEN)
    ergebnis.durchschnittRoh = durchschnitt;
    ergebnis.durchschnitt = this._inProduktEinheit(durchschnitt, effektiverDatentopf, legacyKey, produkt, false);
    ergebnis.einheit = einheit;
    return ergebnis;
  },

  /**
   * EINHEITEN (13.10.2026, #64): Die Einheiten-Logik selbst steht in
   * bos_produkte.js (BOS_PRODUKTE.einheit), nicht hier — eine Stelle für
   * Host, Stationen, Schnellrechner, Mitschrift und Editor.
   * Wirft, wenn bos_produkte.js nicht geladen ist (lieber ein sichtbarer
   * Fehler an der Station als eine Zahl in unbekannter Einheit).
   */
  _einheitInfo(produkt) {
    const P = (typeof window !== 'undefined' && window.BOS_PRODUKTE) || null;
    if (!P || typeof P.einheit !== 'function') {
      throw new Error('Einheiten: bos_produkte.js ist nicht (oder in einer alten Fassung) geladen — Seite neu laden. Ohne die Einheit rechnet der Bedarf nicht.');
    }
    return P.einheit(produkt);
  },

  /**
   * Bringt einen Tagesschnitt aus einem Datentopf in die Einheit des Produkts.
   * Topf-Tabelle (Anweisung 13.10., §3; Bauplan §3.3–§3.5):
   *   offiziell (Backzettel) liegt in STÜCK vor, wenn legacyKey auf "_stueck"
   *     endet (Normalfall: produkte['<x>_stueck']); endet er auf "_bleche",
   *     liest holeOffizielleWerte() die BOS1-Blechzahl, die schon im Träger liegt.
   *   manuell (Mitschrift) liegt schon in der Produkt-Einheit vor
   *     (verbrauch_manuell.html speichert bei Umschalter-Produkten in Trägern).
   *   Stück-Produkte: nie umrechnen.
   * runden = true (needs[]): auf GANZE STÜCK gerundet, dann in die Einheit.
   *   Backzettel/_stueck: Math.round(Schnitt) / faktor — byte-gleich zu den
   *   Stationen bis 13.10. (dort: round im Host, Teilung in der Station).
   *   Mitschrift/Träger: Math.round(Schnitt × faktor) / faktor — sonst würden
   *   aus 2,4 Dielen am Tag 2 (eine Woche: zwei Dielen zu wenig).
   */
  _inProduktEinheit(schnitt, datentopf, legacyKey, produkt, runden) {
    const P = window.BOS_PRODUKTE;
    const liegtInStueck = datentopf === 'offiziell' && !/_bleche$/.test(String(legacyKey || ''));
    if (liegtInStueck) {
      return P.stueckInEinheit(runden ? Math.round(schnitt) : schnitt, produkt);
    }
    // liegt schon in der Produkt-Einheit (Mitschrift, BOS1-Blechzahl)
    if (!runden) return schnitt;
    return P.stueckInEinheit(Math.round(P.einheitInStueck(schnitt, produkt)), produkt);
  },

  /**
   * needs[]-Array für ein Produkt, Mo=0…So=6 (BOS-Wochentag-Index) — genau
   * die Form, die bos_produktionskette.js (BOS_KETTE.berechne()) als Input
   * erwartet. Ruft holeDurchschnitt() siebenmal auf, einmal pro Wochentag.
   * Neu 31.08.2026 — schließt die Lücke aus BOS_PRODUKTIONSKETTE_DOKU.md §5.1.
   *
   * Die Einstellungen werden einmal aufgelöst und für alle sieben Aufrufe
   * wiederverwendet, statt sie siebenmal einzeln nachzuladen.
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} legacyKey
   * @param {object} [einstellungen]  Wie bei holeDurchschnitt().
   * @param {'manuell'|'offiziell'|'richtwert'} [datentopf]  Neu 31.08.2026, Default 'manuell'.
   *   'richtwert' seit 15.10.2026 (#63): braucht das Produkt, liest nichts.
   * @param {object} [produkt]  Neu 13.10.2026 (#64), wie bei holeDurchschnitt().
   *   Die Aufrufer (Stationen, Schnellrechner) geben es immer mit und prüfen,
   *   dass `einheit` in der Antwort steht (sonst ist der Host veraltet).
   * @returns {Promise<{needs: number[], verlaesslich: boolean[], einheit: object|null}>}
   *   needs: sieben Durchschnittswerte, Mo=0…So=6 — mit Produkt in der
   *     EINHEIT DES PRODUKTS, auf ganze Stück gerundet (Bauplan §3.4);
   *     ohne Produkt wie bis 13.10.: Math.round im Topf, einheit: null.
   *   einheit: BOS_PRODUKTE.einheit(produkt) — art, kurz, lang, faktor …
   *   verlaesslich: parallel dazu, ob je Tag die Mindeststichprobe erreicht wurde —
   *   der Aufrufer entscheidet selbst, ob er bei false trotzdem rechnet oder warnt.
   */
  async holeWochenbedarf(db, legacyKey, einstellungen, datentopf, produkt) {
    const effektiverDatentopf = datentopf || 'manuell';
    // 15.10.2026 (#63): Richtwert — aus dem Produkt, ohne Umrechnung und Rundung.
    if (effektiverDatentopf === 'richtwert') {
      if (!produkt) throw this._richtwertOhneProdukt(legacyKey);
      const einheitR = this._einheitInfo(produkt);
      const tage = [0, 1, 2, 3, 4, 5, 6].map(i => this._richtwertTag(produkt, i));
      return {
        needs: tage.map(t => t.wert),
        verlaesslich: tage.map(t => t.verlaesslich),
        einheit: einheitR,
        anzahl: tage.map(t => t.anzahl)
      };
    }
    const einheit = produkt ? this._einheitInfo(produkt) : null; // wirft sichtbar, s. _einheitInfo()
    const effektiveEinstellungen = einstellungen || await this.holeEinstellungen(effektiverDatentopf);
    const WT_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    const ergebnisse = await Promise.all(
      WT_LANG.map(tag => this.holeDurchschnitt(db, legacyKey, tag, effektiveEinstellungen, effektiverDatentopf, produkt))
    );

    if (!produkt) {
      // Alter Aufruf ohne Produkt (z. B. eine noch zwischengespeicherte alte
      // Seite): Ergebnis wie bis 13.10., roh im Topf. einheit: null sagt
      // „unbekannt“ — neue Aufrufer prüfen darauf und rechnen dann nicht.
      console.warn('BOS_VERBRAUCH.holeWochenbedarf: ohne Produkt aufgerufen (' + legacyKey + ') — liefere roh wie vor dem 13.10.2026, Einheit unbekannt.');
      return {
        needs: ergebnisse.map(e => Math.round(e.durchschnitt)),
        verlaesslich: ergebnisse.map(e => e.verlaesslich),
        einheit: null
      };
    }
    return {
      needs: ergebnisse.map(e => this._inProduktEinheit(e.durchschnittRoh, effektiverDatentopf, legacyKey, produkt, true)),
      verlaesslich: ergebnisse.map(e => e.verlaesslich),
      einheit,
      anzahl: ergebnisse.map(e => e.anzahl)   // 15.10.2026 (#63), additiv
    };
  },

  /**
   * Prüft einen neu eingegebenen Wert gegen den manuellen Durchschnitt
   * für dasselbe Produkt am selben Wochentag.
   *
   * AND-Logik (siehe Header): auffällig nur, wenn absolute UND relative
   * Schwelle gleichzeitig gerissen werden — nicht konfigurierbar auf OR,
   * das ist eine bewusste, aus dem Altsystem übernommene Entscheidung.
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} legacyKey
   * @param {string} wochentag
   * @param {number} neuerWert
   * @param {object} [einstellungenOverride]  Optional. Wird das weggelassen
   *   (aktueller Aufruf aus verbrauch_manuell.html), löst die Funktion die
   *   Einstellungen selbst über holeEinstellungen('manuell') auf — System-
   *   Standard-Datei bzw. Eigene lokale Einstellungen greifen dadurch ohne
   *   Codeänderung am Aufrufer.
   * @returns {Promise<{pruefungAktiv: boolean, auffaellig?: boolean, durchschnitt?: number, anzahl?: number, absDelta?: number, pctDelta?: number, grund?: string}>}
   */
  async pruefeAusreisser(db, legacyKey, wochentag, neuerWert, einstellungenOverride) {
    const einstellungen = einstellungenOverride || await this.holeEinstellungen('manuell');

    const werte = await this.holeManuelleWerte(db, legacyKey, wochentag, einstellungen);

    if (werte.length < einstellungen.minStichprobe) {
      return { pruefungAktiv: false, grund: 'kaltstart' };
    }

    const durchschnitt = werte.reduce((summe, w) => summe + w, 0) / werte.length;
    const absDelta = Math.abs(neuerWert - durchschnitt);

    // Division durch 0 vermeiden: bei einem Nullschnitt zählt jede
    // Abweichung > 0 als volle (100%) relative Abweichung.
    const pctDelta = durchschnitt === 0 ? (absDelta > 0 ? 1 : 0) : absDelta / durchschnitt;

    // AND, nicht OR — siehe Header, bewusst nicht änderbar.
    const auffaellig = (absDelta >= einstellungen.schwelleAbsolut) && (pctDelta >= einstellungen.schwelleProzent);

    return {
      pruefungAktiv: true,
      auffaellig,
      durchschnitt,
      anzahl: werte.length,
      absDelta,
      pctDelta
    };
  },

  /**
   * Abweichungsprüfung beim ERFASSEN eines Backzettels (19.10.2026,
   * Backzettel Stufe 1; Kompendium E4, E5, E12, E18). Gegenstück zu
   * pruefeAusreisser() (Mitschrift), bewusst eigene Funktion: anderer Topf,
   * Schwelle in BLECHEN laut Zettel statt in Einheiten des Topfs (F3).
   * Der Schnitt kommt über holeOffizielleWerte() — dieselbe Leseleitung wie
   * an den Stationen (Fenster, Feiertage, „zählt nicht“, Zukunft). Der
   * Backtag selbst ist aus dem Vergleich genommen (Bauplan Fund 5: ein
   * zweiter Durchgang am selben Tag vergliche sonst gegen sich selbst).
   *
   * AND-Logik (RosinenBatzen-Fall, nicht verhandelbar): auffällig nur, wenn
   * Abweichung in Blechen ≥ erfassungSchwelleBleche UND in Prozent ≥
   * erfassungSchwelleProzent. Unter minStichprobe Werten keine Prüfung.
   *
   * Bleche = Stück ÷ Charge der Zettelzeile (P1 hat sie gerade bestätigt,
   * F6: = stueckProBlech). Ohne lesbare Charge über die Einheit des Produkts
   * (BOS_PRODUKTE.stueckInEinheit, nur Träger-Produkte). Geht beides nicht:
   * keine Prüfung, grund 'keine_charge'.
   *
   * @param {object} a
   * @param {firebase.firestore.Firestore} a.db
   * @param {object} a.produkt     aus BOS_PRODUKTE.lade() (legacyKey, einheit, stueckProBlech)
   * @param {string} a.wochentag   z. B. "Samstag"
   * @param {string} a.backtag     'JJJJ-MM-TT' — wird aus dem Vergleich genommen
   * @param {number} a.stueck      gelesene Anzahl
   * @param {number|null} a.charge Charge der Zettelzeile
   * @param {object} [a.einstellungen]  sonst holeEinstellungen('offiziell')
   * @returns {Promise<{pruefungAktiv: boolean, grund?: string, auffaellig?: boolean,
   *   schnittStueck?: number, anzahl: number, deltaStueck?: number, deltaBleche?: number,
   *   deltaProzent?: number, blecheQuelle?: 'zettel'|'produkt', schwelleBleche: number, schwelleProzent: number}>}
   */
  async pruefeBackzettelWert(a) {
    const einst = a.einstellungen || await this.holeEinstellungen('offiziell');
    const schwelleBleche = Number.isFinite(Number(einst.erfassungSchwelleBleche)) ? Number(einst.erfassungSchwelleBleche) : this.ERFASSUNG_SCHWELLE_BLECHE;
    const schwelleProzent = Number.isFinite(Number(einst.erfassungSchwelleProzent)) ? Number(einst.erfassungSchwelleProzent) : this.ERFASSUNG_SCHWELLE_PROZENT;
    const minStichprobe = Number.isFinite(Number(einst.minStichprobe)) ? Number(einst.minStichprobe) : this.MIN_STICHPROBE;
    const ohneBacktag = Object.assign({}, einst, {
      ausgeschlosseneTage: (einst.ausgeschlosseneTage || []).concat(a.backtag ? [{ datum: a.backtag, grund: 'erfassung' }] : [])
    });
    const werte = await this.holeOffizielleWerte(a.db, a.produkt.legacyKey, a.wochentag, ohneBacktag);
    const basis = { anzahl: werte.length, schwelleBleche, schwelleProzent };
    if (werte.length < minStichprobe) return Object.assign({ pruefungAktiv: false, grund: 'zu_wenig' }, basis);

    const schnitt = werte.reduce((s, w) => s + w, 0) / werte.length;
    const deltaStueck = Math.abs(a.stueck - schnitt);
    let deltaBleche = null, blecheQuelle = null;
    if (typeof a.charge === 'number' && a.charge > 0) {
      deltaBleche = deltaStueck / a.charge; blecheQuelle = 'zettel';
    } else if (a.produkt) {
      const P = (typeof window !== 'undefined' && window.BOS_PRODUKTE) || null;
      const e = P && typeof P.einheit === 'function' ? P.einheit(a.produkt) : null;
      if (e && e.art === 'traeger' && e.hatFaktor) { deltaBleche = P.stueckInEinheit(deltaStueck, a.produkt); blecheQuelle = 'produkt'; }
    }
    if (deltaBleche === null) return Object.assign({ pruefungAktiv: false, grund: 'keine_charge', schnittStueck: schnitt }, basis);

    const deltaProzent = schnitt === 0 ? (deltaStueck > 0 ? 1 : 0) : deltaStueck / schnitt;
    // Rundungsrauschen (z. B. 2,9999999 Bleche) nicht über die Schwelle kippen lassen
    const r = x => Math.round(x * 1e9) / 1e9;
    const auffaellig = (r(deltaBleche) >= schwelleBleche) && (r(deltaProzent) >= schwelleProzent);   // AND, nie OR
    return Object.assign({ pruefungAktiv: true, auffaellig, schnittStueck: schnitt, deltaStueck, deltaBleche, deltaProzent, blecheQuelle }, basis);
  }
};
