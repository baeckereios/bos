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
 * EINSTELLUNGEN-AUFLÖSUNG (Stand 29.08.2026):
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

  /**
   * Löst die effektiven Berechnungs-Einstellungen für einen Datentopf auf
   * (siehe Header, Abschnitt EINSTELLUNGEN-AUFLÖSUNG): Eigene lokale
   * Einstellungen (falls aktiv) > System-Standard-Datei > Klassen-Konstanten.
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
      ausgeschlosseneTage: []
    });

    // Ebene 1: Eigene lokale Einstellungen, profilgebunden, nur wenn aktiv.
    try {
      const launcherState = JSON.parse(localStorage.getItem('bos_launcher_state_v2') || 'null');
      const profileId = launcherState?.activeProfileId;
      if (profileId) {
        const alle = JSON.parse(localStorage.getItem(this.EINSTELLUNGEN_LOCALSTORAGE_KEY) || '{}');
        const eintrag = alle?.[profileId]?.[datentopf];
        if (eintrag?.aktiv === true && eintrag.einstellungen) {
          return { ...klassenStandard(), ...eintrag.einstellungen };
        }
      }
    } catch (fehler) {
      console.warn('BOS_VERBRAUCH.holeEinstellungen: localStorage nicht lesbar, weiter mit System-Standard.', fehler);
    }

    // Ebene 2: System-Standard-Datei, einmalig geladen und zwischengespeichert.
    try {
      if (!this._einstellungenDateiCache) {
        const antwort = await fetch(this._EINSTELLUNGEN_URL);
        this._einstellungenDateiCache = await antwort.json();
      }
      const block = this._einstellungenDateiCache?.[datentopf];
      if (block) return { ...klassenStandard(), ...block };
    } catch (fehler) {
      console.warn('BOS_VERBRAUCH.holeEinstellungen: Datei nicht ladbar, Fallback auf Klassen-Standard.', fehler);
    }

    // Ebene 3: unterster Boden, funktioniert auch ganz ohne Datei.
    return klassenStandard();
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
      const snap = await db.collection('bos_events')
        .where('type', '==', 'verbrauch_manuell')
        .where('wochentag', '==', wochentag)
        .orderBy('ts', 'desc')
        .limit(this.MAX_DOKUMENTE_SCAN)
        .get();

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
   * Bisherige Werte aus dem OFFIZIELLEN Datentopf — Gegenstück zu
   * holeManuelleWerte(), aber anderes Dokumentschema. Neu 31.08.2026,
   * gebaut gegen das echte Schema aus verbrauch_einstellungen_editor.html
   * (ladeDatenbestand()), NICHT aus eigener Annahme rekonstruiert:
   *   { type: 'verbrauch_offiziell', datum: 'YYYY-MM-DD',
   *     produkte: { '<legacyKey>_stueck': zahl, '<legacyKey>_bleche': zahl, … } }
   * Migrierte historische Daten aus backmengen_db.json (einmaliger Import,
   * siehe PRODUKT_CONFIG_SYNC_DOKU.md/import_dokumentation.md) — anders als
   * verbrauch_manuell KEIN eigener wochentag-String pro Dokument, nur datum.
   * Wochentag wird deshalb clientseitig berechnet, kein serverseitiger
   * .where('wochentag',...)-Filter möglich.
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} legacyKey
   * @param {string} wochentag  z. B. "Dienstag"
   * @param {object} [einstellungen]
   * @returns {Promise<number[]>}
   */
  async holeOffizielleWerte(db, legacyKey, wochentag, einstellungen) {
    const modus            = einstellungen?.modus ?? 'stichprobe';
    const stichprobeAnzahl = einstellungen?.stichprobeAnzahl ?? 6;
    // suchfensterWochen/kontiguierlichTage bewusst NICHT gelesen — siehe
    // Kommentar weiter unten (kein Zeitfenster-Ausschluss für diesen
    // Datentopf). 'kontiguierlich' bedeutet für verbrauch_offiziell damit
    // schlicht "alle verfügbaren Werte, kein Anzahl-Deckel" — 'stichprobe'
    // bleibt durch stichprobeAnzahl weiterhin auf die N neuesten begrenzt.

    // JS Date.getDay()-Index (0=So…6=Sa) — bewusst NICHT der BOS-Index
    // (Mo=0), weil hier direkt aus new Date().getDay() gelesen wird.
    const WT_JS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

    const werte = [];
    try {
      // KORRIGIERT (31.08.2026, dritter Fund im selben Live-Test): kein
      // orderBy('datum') mehr — die Abfrage in verbrauch_einstellungen_
      // editor.html (ladeDatenbestand(), NACHWEISLICH funktionierend, zeigt
      // echte 36 Tage/116 Produkte) nutzt exakt denselben Filter OHNE
      // orderBy. Ein fehlender Index für orderBy(datum) auf dieser Collection
      // hätte die Abfrage still scheitern lassen — abgefangen vom catch
      // unten, ohne sichtbaren Fehler, Ergebnis wäre in jedem Fall []
      // gewesen. Sortierung jetzt clientseitig, damit "neueste zuerst" für
      // stichprobeAnzahl weiterhin gilt.
      const snap = await db.collection('bos_events')
        .where('type', '==', 'verbrauch_offiziell')
        .limit(this.MAX_DOKUMENTE_SCAN)
        .get();

      const docs = snap.docs
        .map(doc => doc.data())
        .filter(data => !!data.datum)
        .sort((a, b) => b.datum.localeCompare(a.datum)); // neueste zuerst, ISO-Strings sortieren lexikalisch korrekt

      docs.forEach(data => {
        if (modus === 'stichprobe' && werte.length >= stichprobeAnzahl) return;

        // Wochentag aus datum ableiten — lokal, kein UTC-Parsing (gleiches
        // Off-by-one-Risiko wie in _tageSeit(), siehe dortiger Kommentar).
        const [jahr, monat, tag] = data.datum.split('-').map(Number);
        const wt = WT_JS[new Date(jahr, monat - 1, tag).getDay()];
        if (wt !== wochentag) return;

        // Zeitkontext-Ausschluss — nur Datei-Ebene verfügbar. Offiziell-
        // Dokumente führen kein eigenes besondererTag-Flag (anders als
        // verbrauch_manuell), das Signal existiert für diesen Datentopf nicht.
        if (window.BOS_IST_BESONDERER_TAG?.(data.datum)) return;
        if (einstellungen?.ausgeschlosseneTage?.some(t => t.datum === data.datum)) return;

        // KEIN Zeitfenster-Ausschluss über alterTage — anders als bei
        // holeManuelleWerte() (Zeile ~311). Dort sinnvoll: laufende
        // Erfassung, "letzte X Wochen" hält die Vergleichsbasis aktuell.
        // Bei verbrauch_offiziell handelt es sich um einen EINMALIGEN
        // historischen Import (backmengen_db.json, Stand 24.05.2026) — die
        // Daten werden nie wieder "frisch". Ein rollierendes Suchfenster
        // relativ zu "heute" würde mit fortschreitendem Datum irgendwann
        // zwangsläufig alles ausschließen, unabhängig vom eingestellten
        // Wert. stichprobeAnzahl begrenzt die Menge weiterhin (siehe oben),
        // nur eben nicht zusätzlich nach "wie alt".

        // legacyKey enthält die Einheit bereits als Bestandteil des
        // Schlüssels selbst (bestätigt gegen echte produkt_config.json,
        // 31.08.2026: "hasenberger_stueck", "kaesebroetchen_stueck", …) —
        // direkter Zugriff, kein Suffix-Anhang.
        const wert = data.produkte?.[legacyKey];
        if (typeof wert === 'number') werte.push(wert);
      });
    } catch (fehler) {
      console.warn('BOS_VERBRAUCH.holeOffizielleWerte: Abfrage fehlgeschlagen, Check wird übersprungen.', fehler);
      return [];
    }
    return werte;
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
   * @param {'manuell'|'offiziell'} [datentopf]  Neu 31.08.2026, Default 'manuell'.
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
      einheit
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
  }
};
