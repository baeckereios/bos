/**
 * rechenmodul.js — SchichtPlaner V2
 *
 * 2026-10-04 · 14:39 · Online-Gang: Nachnamen von Kollegen in den
 * Kommentaren dieser Datei durch Platzhalter („Person K“ usw.) ersetzt —
 * das Repo wird öffentlich. Nur Kommentare, kein Code. Zuordnung kennt
 * Ulf; siehe 2026-10-04_ONLINE_GANG.md.
 *
 * Reine Zuweisungslogik, kein DOM. Wird von mehreren Satelliten
 * aufgerufen (Entwürfe, Krankheit/Ausfall, ggf. Offizieller Plan) —
 * "eine Mechanik, viele Aufrufer".
 *
 * Setzt auf drei Eingaben auf, die alle an anderer Stelle gepflegt
 * werden:
 *   - personen:    Stammdaten je Person (Einstellungen-Satellit)
 *   - positionen:  Positionen inkl. Pools (Positionen/Pools-Tool,
 *                  gleiche Struktur wie die exportierte JSON-Datei)
 *   - ereignisse:  Verfügbarkeits-Ereignisse (Urlaub, Krankheit, …)
 *
 * Bildet §18/§19 aus SESSION_2026-09-05_SCHICHTPLANER_V2_KONZEPT.md ab.
 *
 * ---------------------------------------------------------------
 * ERWARTETE DATENFORMEN (zur Orientierung, keine Laufzeit-Prüfung)
 * ---------------------------------------------------------------
 * Person:
 *   {
 *     id, name,
 *     abteilung: 'baeckerei' | 'konditorei',
 *     teilbereich: 'versand' | 'kuchenversand' | null,
 *     stammschicht: 'nacht' | 'frueh',   // 'flexibel' entfernt
 *          (09.09.2026, Ulf) — auch Produktionshelfer bekommen eine
 *          echte Stammschicht statt eines Sonderstatus ohne
 *          Ruhezeit-Schutz und ohne Teilnahme an der wöchentlichen
 *          freien-Tage-Rotation. Ulfs Grundsatz: "Flexibilität ist ein
 *          Fehler" — sie sind genauso Menschen wie alle anderen, für
 *          die diese Ausnahme nicht gilt. `status: 'produktionshelfer'`
 *          bleibt bestehen (beeinflusst weiterhin die Pool-Reihenfolge,
 *          siehe `sortiertePoolReihenfolge`), nur eben unabhängig von
 *          der Schicht
 *     status: 'azubi' | 'mitarbeiter' | 'produktionshelfer',
 *     aktiv: boolean,
 *     einsatzfaehig: boolean,  // nur relevant bei status === 'azubi'
 *     arbeitstage: ['mo', 'di', ...] | null  // optional, Default:
 *          kein Eintrag = an jedem Wochentag grundsätzlich verfügbar.
 *          Gesetzt (05.09.2026, fester Mo–Fr-ohne-Samstag-Fall):
 *          schränkt dauerhaft ein, an welchen Wochentagen die Person
 *          überhaupt infrage kommt — anders als ein Verfügbarkeits-
 *          Ereignis (Urlaub, Schule, ...), das für einen befristeten
 *          Zeitraum gilt, ist das ein stehendes Personen-Merkmal.
 *          Hat 5 oder weniger Einträge, gilt das Wochenmuster damit
 *          als vollständig beschrieben — die Person nimmt dann NICHT
 *          mehr an der freien-Tag-Rotation teil (freie_tage_verteilung.js)
 *     keinRotierenderFreierTag: boolean | null  // optional (09.09.2026)
 *          — auch bei 6 oder 7 `arbeitstage` KEIN
 *          zusätzlicher freier Tag nötig — für Personen, die wirklich
 *          jeden markierten Tag arbeiten (in der Praxis: nur wenige
 *          Stunden täglich). Die Arbeitstage-Anzahl allein reicht
 *          nicht, um diesen Fall zu erkennen (6 Tage bedeutet sonst
 *          "braucht noch einen rotierenden freien Tag", siehe
 *          `freieTagOptionen`) — deshalb eigenes, explizites Feld statt
 *          über die Tage-Anzahl abgeleitet
 *     freieTagOptionen: ['fr','sa','mo'] | null  // optional
 *          (05.09.2026, Sechs-Arbeitstage-mit-einem-rotierenden-
 *          freien-Tag-Fall): schränkt ein,
 *          WELCHE der `arbeitstage` als der EINE rotierende freie Tag
 *          infrage kommen — nur relevant, wenn die Person weiterhin
 *          an der Rotation teilnimmt (mehr als 5 arbeitstage)
 *     gesperrteSchichten: ['nacht'] | null  // optional (09.09.2026)
 *          — Schichten, für die diese Person NIE
 *          eingeteilt wird — auch dann nicht, wenn sie in einem Pool
 *          einer Position dieser Schicht steht (Pool-Mitgliedschaft
 *          = Befähigung, `gesperrteSchichten` = trotzdem nie
 *          eingesetzt). Ersetzt den alten `grund: 'pausiert'`-Ansatz
 *          für diesen Fall vollständig — `pausiert` selbst wurde
 *          entfernt (hatte keinen anderen Anwendungsfall mehr, siehe
 *          `grund`-Enum oben), das hier ist ein stehendes
 *          Personen-Merkmal ohne Enddatum, direkt beim Anlegen
 *          setzbar und jederzeit editierbar
 *   }
 *
 * Position (Feldnamen identisch zum Positionen/Pools-Tool):
 *   {
 *     id, name,
 *     schicht: 'nacht' | 'frueh' | 'sonntag',
 *     prioritaet: 1 | 2 | 3,
 *     tage: ['mo', 'di', ...],   // aktive Wochentage
 *     pool: [personId, personId, ...],  // Rang 1 zuerst, '' = leer
 *     schichtneutral: boolean   // optional, Default false. true =
 *          keine 11-Stunden-Ruhezeit-Prüfung für diese Position, weil
 *          sie am Schichtübergang liegt und zeitlich sowohl mit Nacht-
 *          als auch Frühschicht verträglich ist (05.09.2026, Ulfs
 *          Brötchenstraße-Fall). Pool-Mitglieder bleiben unabhängig
 *          von ihrer sonstigen Schicht-Zuordnung dieser Woche wählbar
 *   }
 *
 * Verfügbarkeits-Ereignis:
 *   {
 *     personId, von, bis,        // ISO-Datum, von/bis inklusive
 *     grund: 'urlaub' | 'krankheit' | 'feiertag' | 'zweiterFreierTag'
 *          | 'wunschtag' | 'sonntagsarbeit' | 'crossSchichtEinsatz'
 *          | 'sonstiges',   // 'pausiert' entfernt (09.09.2026, Ulf) —
 *          hatte nur einen einzigen Anwendungsfall, der jetzt
 *          sauberer über `gesperrteSchichten` (statische
 *          Personen-Eigenschaft, s. u.) gelöst ist. Bei echtem Bedarf
 *          für eine zeitlich begrenzte, bewusst nicht als krank/Urlaub
 *          gelabelte Auszeit könnte ein neuer, spezifischerer Grund
 *          später ergänzt werden — keine Abstraktion für Hypothetisches
 *     bindend: boolean,          // true = harte Sperre
 *     begruendung: string | null,
 *     zielSchicht: 'nacht' | 'frueh' | null  // NUR bei grund
 *          'crossSchichtEinsatz': macht die Person für den Zeitraum
 *          zu einem vollwertigen Mitglied dieser Schicht (§9-Korrektur,
 *          05.09.2026) — löst das Früh↔Nacht-Wechsel-Problem, das
 *          sonst tageweise als loser Vorschlag aufflackert
 *     zielPosition: positionId | null  // optional, NUR bei
 *          'crossSchichtEinsatz': schränkt die Zuweisung auf genau
 *          eine Position ein (z. B. nur Kamut), statt die ganze
 *          Zielschicht freizugeben. Ohne dieses Feld gilt die Person
 *          für alle Positionen der Zielschicht (05.09.2026, Ulfs
 *          "wenn dann auch nur für Kamut"-Fall)
 *   }
 */

const WOCHENTAGE = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];

/**
 * Maximale Tiefe der Tausch-Kette (13.09.2026, mit Ulf festgelegt).
 * 4 deckt seine Beispielkette ab (Person D -> Person R -> Person Be -> Person L ->
 * Person A). Tiefer wird das Ergebnis für einen Menschen nicht mehr
 * nachvollziehbar, und der Nutzen fällt steil ab. Reine Zahl, keine
 * Architekturfrage — bei Bedarf jederzeit änderbar.
 * Siehe versucheTauschTief().
 */
const TAUSCH_MAX_TIEFE = 4;

/**
 * Datums-Arithmetik bewusst komplett in UTC, unabhängig von der
 * Zeitzone des Geräts. Reine Kalendertage haben keine Uhrzeit-
 * Bedeutung — sie als lokale Zeit zu behandeln und danach über
 * toISOString() (UTC) wieder auszulesen, verschiebt das Datum in
 * jeder Zeitzone östlich von UTC (z. B. Deutschland) um einen Tag
 * zurück. Deshalb: immer als UTC parsen, immer mit den UTC-Varianten
 * rechnen (getUTCDay, setUTCDate, ...).
 */
function parseISO(datumISO) {
  return new Date(datumISO + 'T00:00:00Z');
}
function formatISO(d) {
  return d.toISOString().slice(0, 10);
}

/** ISO-Datum ("YYYY-MM-DD") -> Wochentags-Kürzel ("mo", "di", ...). */
function wochentag(datumISO) {
  return WOCHENTAGE[parseISO(datumISO).getUTCDay()];
}

/**
 * Heutiges Kalenderdatum aus Sicht des Geräts (lokale Zeitzone),
 * als "YYYY-MM-DD" — bewusst über die lokalen Getter statt über
 * toISOString(), aus demselben Grund wie oben.
 */
function heuteAlsISO() {
  const d = new Date();
  const jahr = d.getFullYear();
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  const tag = String(d.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

/**
 * Prüft, ob eine Person an einem Tag durch ein BINDENDES Ereignis
 * gesperrt ist. Nicht bindende Ereignisse (Wunschtag, Sonntagsarbeit)
 * blockieren nichts — sie sind reine Signale, keine Sperren (§3).
 */
function hatBindendeSperre(personId, datumISO, ereignisse) {
  return ereignisse.some(e =>
    e.personId === personId &&
    e.bindend &&
    e.von <= datumISO &&
    datumISO <= e.bis
  );
}

/**
 * Erkennt einen Früh↔Nacht-Wechsel, für den laut §18 die gesetzliche
 * 11-Stunden-Ruhezeit gilt. Sonntagspositionen (dort ist Mischen
 * ausdrücklich normal, §6) und als `schichtneutral` markierte
 * Positionen (05.09.2026 — Positionen am Schichtübergang ohne echtes
 * Ruhezeit-Problem, z. B. Brötchenstraße; Ulf: "muss einstellbar
 * werden") sind ausgenommen. Berücksichtigt eine evtl. bestätigte
 * Cross-Schicht-Zuweisung — sowohl deren Zielschicht als auch,
 * optional, eine Beschränkung auf genau eine Zielposition (Ulfs
 * "wenn dann auch nur für Kamut"-Fall).
 *
 * Korrektur 09.09.2026 (Ulf, Wunschtag-Häufungs-Fall): die frühere
 * pauschale `stammschicht === 'flexibel'`-Ausnahme für
 * Produktionshelfer ist raus. Sie ließ Produktionshelfer ohne jede
 * Ruhezeit-Prüfung und ohne Landung in `manuellePruefung`
 * schichtübergreifend einspringen — unsichtbar für Ulf, selbst bei
 * echtem Schichtwechsel binnen weniger Stunden. Jetzt gilt für sie
 * dieselbe Prüfung wie für alle anderen.
 */
function istRuhezeitRelevanterWechsel(person, position, datumISO, ereignisse) {
  if (position.schicht === 'sonntag') return false;
  if (position.schichtneutral) return false;
  const zuweisung = findeCrossSchichtZuweisung(person.id, datumISO, ereignisse);
  if (zuweisung) {
    if (zuweisung.zielSchicht !== position.schicht) return true;
    if (zuweisung.zielPosition && zuweisung.zielPosition !== position.id) return true;
    return false;
  }
  return person.stammschicht !== position.schicht;
}

/**
 * Findet die aktive Cross-Schicht-Zuweisung einer Person an einem Tag
 * (falls vorhanden). Ein Ereignis mit `zielPosition` gilt nur für
 * genau diese Position, ohne `zielPosition` für die ganze Zielschicht.
 */
function findeCrossSchichtZuweisung(personId, datumISO, ereignisse) {
  return ereignisse.find(e =>
    e.personId === personId &&
    e.grund === 'crossSchichtEinsatz' &&
    e.von <= datumISO &&
    datumISO <= e.bis
  );
}

/**
 * Effektive Schicht einer Person an einem Tag: normalerweise die
 * Stammschicht, aber überschrieben, wenn eine bestätigte
 * Cross-Schicht-Zuweisung (grund: 'crossSchichtEinsatz', mit
 * zielSchicht) diesen Tag abdeckt. Genau das ist der Unterschied
 * zwischen "könnte theoretisch, wurde aber nie entschieden" (bleibt
 * Stammschicht, landet ggf. in manuellePruefung) und "ist für diesen
 * Zeitraum bewusst umgezogen" (zählt ab sofort als Zielschicht, ganz
 * ohne Sonderfall im Rechner).
 */
function effektiveSchicht(person, datumISO, ereignisse) {
  const zuweisung = findeCrossSchichtZuweisung(person.id, datumISO, ereignisse);
  return zuweisung ? zuweisung.zielSchicht : person.stammschicht;
}

/**
 * Hat eine Person für diesen Tag überhaupt eine bestätigte
 * Cross-Schicht-Zuweisung (unabhängig davon, wohin oder für welche
 * Position)? Entscheidet, ob ein Schicht-/Positions-Mismatch als
 * offener Vorschlag (manuellePruefung) zählt oder als "diese Person
 * ist anderswo bereits fest eingeplant" still übergangen wird.
 */
function hatCrossSchichtZuweisung(personId, datumISO, ereignisse) {
  return !!findeCrossSchichtZuweisung(personId, datumISO, ereignisse);
}

/**
 * Sammelt die an einem Tag aktiven Positionen einer Schicht,
 * sortiert nach Priorität (1 zuerst).
 */
function aktivePositionenFuerTag(positionen, datumISO, schicht) {
  const tag = wochentag(datumISO);
  return positionen
    .filter(p => p.schicht === schicht && p.tage.includes(tag))
    .slice()
    .sort((a, b) => a.prioritaet - b.prioritaet);
}

/**
 * Prüft, ob eine Person an einem Tag grundsätzlich einsetzbar ist:
 * aktiv, bei Azubis zusätzlich einsatzfähig, an einem ihrer
 * regulären Arbeitstage (falls eingeschränkt, 05.09.2026 — fester
 * Mo–Fr-ohne-Samstag-Fall) und keine bindende Sperre.
 * `person.arbeitstage` ist optional: fehlt es, gilt die Person an
 * jedem Wochentag als grundsätzlich verfügbar (Rückwärtskompatibel).
 *
 * `schicht` (optional, 09.09.2026 — Schicht-Sperr-Fall): wird sie
 * mitgegeben, prüft die Funktion zusätzlich `gesperrteSchichten` —
 * eine Person, die für genau diese Schicht gesperrt ist, gilt hier
 * als nicht einsetzbar, UNABHÄNGIG von Pool-Mitgliedschaft (die
 * bleibt reine Befähigung, keine Zusage). Ohne `schicht`-Parameter
 * (z. B. bei der allgemeinen Überzählig-Prüfung) wird diese Sperre
 * bewusst NICHT geprüft — eine für ihre Stammschicht gesperrte Person
 * ist ja trotzdem grundsätzlich da, nur eben nicht für diese eine
 * Schicht einteilbar.
 */
function istEinsetzbar(person, datumISO, ereignisse, schicht) {
  if (!person.aktiv) return false;
  if (person.status === 'azubi' && !person.einsatzfaehig) return false;
  if (person.arbeitstage && !person.arbeitstage.includes(wochentag(datumISO))) return false;
  if (schicht && person.gesperrteSchichten && person.gesperrteSchichten.includes(schicht)) return false;
  return !hatBindendeSperre(person.id, datumISO, ereignisse);
}

/**
 * Sortiert einen Pool für den Zuweisungs-Durchlauf: Fachkräfte
 * (`status: 'mitarbeiter'`) zuerst, dann Produktionshelfer, Azubis
 * zuletzt — innerhalb jeder Gruppe bleibt Ulfs ursprüngliche
 * Pool-Reihenfolge erhalten. Ändert NICHT den gespeicherten Pool,
 * nur die Reihenfolge für diesen einen Berechnungslauf.
 *
 * Hintergrund (05.09.2026, Ulfs "22-Uhr-Azubi"-Fall, aus V1
 * übernommen): ein Azubi soll eine Position nur dann offiziell
 * übernehmen, wenn wirklich niemand Erfahreneres verfügbar ist —
 * nicht schon deshalb, weil er zufällig weiter vorn im Pool steht.
 * Ist ein Azubi trotzdem der einzige Verfügbare, übernimmt er die
 * Position ganz normal (kein Unterschied zu vorher). Ist er es nicht,
 * bleibt er `ueberzaehlig` und taucht stattdessen ggf. als
 * `lehrschicht` auf (siehe `lehrschichtHeute` unten) — läuft bei der
 * Person mit, die die Position tatsächlich übernommen hat, statt
 * unsichtbar zu verschwinden.
 *
 * WICHTIGE KORREKTUR (05.09.2026, Azubi-Cross-Schicht-Fall): eine
 * bestätigte
 * Cross-Schicht-Zuweisung für GENAU diese Position ist eine bewusste
 * Entscheidung von Ulf — die darf die automatische
 * Azubi-Zurückstufung nicht aushebeln, sonst würde z. B. eine
 * extra für 22 Uhr eingetragene Zuweisung eines Azubis an eine
 * Fachkraft/Produktionshelfer einfach übergangen, obwohl Ulf ausdrücklich
 * den Azubi wollte. Ein so zugewiesener Azubi zählt für diese eine Position
 * wie eine Fachkraft (Rang 0).
 */
/**
 * Zählt für jede personId, in wie vielen Positions-Pools sie
 * insgesamt vorkommt — ein reines, aus den Pools abgeleitetes Maß
 * für Vielseitigkeit. War 09.09.2026 kurzzeitig Teil des
 * Zuweisungs-Tie-Breaks in `sortiertePoolReihenfolge`, dort aber
 * wieder entfernt (siehe Kommentar dort — Breite ≠ Tiefe, Ulfs
 * berechtigter Einwand). Bleibt als eigenständige Funktion bestehen,
 * falls sie für reine Anzeige-Zwecke nützlich ist ("wie vielseitig
 * ist diese Person") — wird aktuell aber nirgends aufgerufen.
 */
function berechnePoolHaeufigkeit(positionen) {
  const haeufigkeit = {};
  for (const position of positionen) {
    for (const personId of position.pool) {
      haeufigkeit[personId] = (haeufigkeit[personId] || 0) + 1;
    }
  }
  return haeufigkeit;
}

/**
 * Geändert 09.09.2026 (Ulf: "die Positionen behandeln jeden gleich —
 * eine Hilfskraft steht nirgendwo dort, wo Qualifikation gebraucht
 * wird"). Vorher: mitarbeiter: 0, produktionshelfer: 1, azubi: 2 —
 * Produktionshelfer wurden pauschal hinter Mitarbeiter zurückgestuft,
 * unabhängig von ihrer Stellung im jeweiligen Pool. Ulfs Punkt: wer
 * unqualifiziert ist, steht schon gar nicht im Pool — Pool-
 * Mitgliedschaft IST die Qualifikationsprüfung, und die
 * Pool-Reihenfolge selbst drückt schon "Stammkraft bis
 * Ausweichmöglichkeit" aus. Eine zusätzliche pauschale Regel obendrauf
 * widerspricht dem eher, als dass sie hilft (siehe Person R/22-Uhr-Fall
 * oben) — für die ursprüngliche Rangfolge fand sich auch keine
 * dokumentierte Begründung mehr, weder in der Doku noch bei Ulf
 * selbst. Mitarbeiter und Produktionshelfer daher jetzt gleichrangig
 * — reine Pool-Reihenfolge entscheidet zwischen den beiden.
 *
 * Azubi bleibt bewusst strikt zuletzt, aus einem eigenen, davon
 * unabhängigen Grund (Ulf): eine Hilfskraft ist zum Arbeiten da, ein
 * Azubi soll, wenn es die Tage zulassen, in erster Linie lernen —
 * darf eine Position also nur übernehmen, wenn niemand sonst (weder
 * Mitarbeiter noch Produktionshelfer) verfügbar ist.
 */
const STATUS_RANG = { mitarbeiter: 0, produktionshelfer: 0, azubi: 1 };

/**
 * Rückgängig gemacht 09.09.2026 (Ulf, "Person F hat mehr Erfahrung am
 * Teigposten als ich"-Einwand) — kurzzeitig gab es hier einen
 * zweiten Tie-Break nach Pool-Häufigkeit (wer in weniger Pools
 * steht, gilt als "spezialisierter" und wird zuerst eingeplant).
 * Ulfs berechtigter Einwand: Pool-BREITE (wie viele Stationen jemand
 * abdecken kann) und Pool-TIEFE (wie gut jemand an EINER bestimmten
 * Station wirklich ist) sind zwei verschiedene Dinge — jemand kann
 * viele Pools abdecken UND an einer davon trotzdem der Beste sein.
 * Die ursprüngliche Pool-Reihenfolge, die Ulf selbst beim Anlegen
 * jedes Pools festlegt, spiegelt echte Erfahrung vermutlich eher
 * wider als ein aus der Pool-ZAHL abgeleiteter Wert — der neue
 * Tie-Break hätte das still überstimmen können, ohne dass es
 * auffällt. `berechnePoolHaeufigkeit` bleibt als Funktion bestehen
 * (könnte für anderen Zweck nützlich sein, z. B. reine Anzeige "wie
 * vielseitig ist diese Person"), wird hier aber nicht mehr verwendet.
 */
function sortiertePoolReihenfolge(pool, personenById, positionId, datumISO, ereignisse) {
  return pool
    .map((personId, index) => ({ personId, index }))
    .sort((a, b) => {
      const ra = effektiverStatusRang(a.personId, personenById, positionId, datumISO, ereignisse);
      const rb = effektiverStatusRang(b.personId, personenById, positionId, datumISO, ereignisse);
      if (ra !== rb) return ra - rb;
      return a.index - b.index; // gleicher Rang: ursprüngliche Pool-Reihenfolge erhalten
    })
    .map(x => x.personId);
}

/** Hilfsfunktion zu sortiertePoolReihenfolge, siehe deren Doku. */
function effektiverStatusRang(personId, personenById, positionId, datumISO, ereignisse) {
  const person = personenById[personId];
  if (!person) return 1;
  const zuweisung = findeCrossSchichtZuweisung(personId, datumISO, ereignisse);
  if (zuweisung && (!zuweisung.zielPosition || zuweisung.zielPosition === positionId)) {
    return 0; // bewusste Entscheidung von Ulf, zaehlt wie eine Fachkraft fuer DIESE Position
  }
  return STATUS_RANG[person.status] ?? 1;
}

/**
 * Kernfunktion: berechnet die Zuweisung für einen Tag, innerhalb
 * EINER Schicht. `bereitsVerplant` ist ein Set von Personen-IDs, die
 * an diesem Tag schon in einer anderen (früher gerechneten, §9)
 * Schicht gebunden sind — die fallen hier automatisch raus.
 * `manuelleZuweisungen` (optional, Default []) — Ulfs direkte
 * Übersteuerung einzelner (Tag, Position)-Kombinationen (05.09.2026,
 * "eine Person statt der anderen am Ofen"-Fall): wird vor dem normalen Pool-Durchlauf
 * angewendet, hat also immer Vorrang.
 *
 * Gibt zurück:
 *   {
 *     zuweisungen: { [positionId]: personId },
 *     luecken: [positionId, ...],
 *     manuellePruefung: [{ positionId, personId, grund }, ...]
 *   }
 */
function berechneTag(datumISO, schicht, personen, positionen, ereignisse, bereitsVerplant = new Set(), manuelleZuweisungen = []) {
  const personenById = Object.fromEntries(personen.map(p => [p.id, p]));
  const aktivePositionen = aktivePositionenFuerTag(positionen, datumISO, schicht);

  const zuweisungen = {};
  const verplantHeute = new Set(bereitsVerplant);
  const manuellePruefung = [];

  // --- Manuelle Zuweisungen zuerst, haben Vorrang vor der Kaskade ---
  for (const z of manuelleZuweisungen) {
    if (z.datumISO !== datumISO) continue;
    const position = aktivePositionen.find(p => p.id === z.positionId);
    if (!position || verplantHeute.has(z.personId)) continue;
    zuweisungen[position.id] = z.personId;
    verplantHeute.add(z.personId);
  }

  // --- Schritt 3 (§18): Pools der Reihe nach durchgehen, nach Priorität ---
  for (const position of aktivePositionen) {
    if (zuweisungen[position.id]) continue; // schon manuell vergeben
    let besetzt = false;
    // Kandidaten mit Schicht-Mismatch werden erst NACH dem kompletten
    // Pool-Durchlauf als Vorschlag notiert — nur, wenn die Position
    // wirklich offen bleibt. Sonst würde z. B. eine früher im Pool
    // stehende Person als
    // "könnte helfen" auftauchen, obwohl eine andere (weiter hinten im
    // Pool, aber mit bestätigter Cross-Schicht-Zuweisung) die Position
    // ohnehin füllt — unnötiges Rauschen.
    const zurueckgestellt = [];
    // Ergänzt 09.09.2026 (Ulf, Person D/22-Uhr-Fund): ein Azubi (Rang 1)
    // mit passender Schicht wurde bisher SOFORT zugewiesen, sobald er
    // in der sortierten Reihenfolge an der Reihe war — auch wenn
    // weiter hinten im Pool noch ein Rang-0-Kandidat (Mitarbeiter/
    // Produktionshelfer) stand, der die Position ebenfalls könnte,
    // nur eben mit Schicht-Wechsel und damit erst nach Bestätigung.
    // Widerspricht Ulfs eigenem Grundsatz von eben ("Azubi nur, wenn
    // niemand sonst verfügbar ist — WEDER Mitarbeiter NOCH
    // Produktionshelfer"): ein Rang-0-Cross-Schicht-Kandidat ist
    // verfügbar, nur eben bestätigungspflichtig, und zählt für diese
    // Regel mit. Ein passender Azubi wird deshalb jetzt nur als
    // Fallback vorgemerkt (`azubiFallback`) und der Pool-Durchlauf
    // läuft weiter — kommt danach noch ein Rang-0-Kandidat (ob
    // passende Schicht oder Cross-Schicht), hat der Vorrang.
    //
    // TEILWEISE REVIDIERT 13.09.2026 (Ulf, ausdrückliche Freigabe —
    // erste echte Logik-Änderung an dieser Datei): der Azubi hat jetzt
    // Vorrang VOR einem Cross-Schicht-Kandidaten, nicht mehr umgekehrt.
    // Begründung, die es am 09.09. so noch nicht gab: ein Schichtwechsel
    // kostet die betroffene Person 1–2 Tage Umstellung der inneren Uhr
    // (siehe SESSION_2026-09-13_SCHWEIZER_KAESE_KONZEPT.md §2). Ein
    // Cross-Schicht-Kandidat ist damit NICHT gleichwertig "verfügbar",
    // sondern teurer als ein Azubi, der ohnehin schon in dieser Schicht
    // anwesend ist. Ulf: "gerade der Azubi könnte Lücken auflösen...
    // der Bildungsauftrag der einen Woche wäre ausgehebelt ABER er
    // springt ja nur in der Ausnahme-Situation ein — und die ist selten
    // und zeitlich begrenzt. Es ist also ein vertretbares Übel."
    // Die Ausnahme begrenzt sich dabei selbst, ohne zusätzliche
    // Schwelle: der Azubi bleibt reiner Fallback, jede Rang-0-Person
    // der EIGENEN Schicht hat weiterhin Vorrang. Er kommt also nur dann
    // zum Zug, wenn die einzige Alternative ein echter Schichtwechsel
    // wäre — genau die Definition des Engpasses.
    // Qualifikation bleibt gewahrt (Pool-Mitgliedschaft IST die
    // Qualifikationsprüfung, siehe sortiertePoolReihenfolge), und es
    // trifft strukturell nur Azubis der eigenen Schicht — ein
    // schichtfremder Azubi landet selbst in `zurueckgestellt` und
    // erreicht `azubiFallback` gar nicht erst.
    let azubiFallback = null;

    for (const personId of sortiertePoolReihenfolge(position.pool, personenById, position.id, datumISO, ereignisse)) {
      if (!personId) continue;
      if (verplantHeute.has(personId)) continue;
      const person = personenById[personId];
      if (!person || !istEinsetzbar(person, datumISO, ereignisse, schicht)) continue;

      if (istRuhezeitRelevanterWechsel(person, position, datumISO, ereignisse)) {
        if (!hatCrossSchichtZuweisung(personId, datumISO, ereignisse)) {
          zurueckgestellt.push(personId);
        }
        // Hat eine Zuweisung, nur eben zu einer anderen Schicht als
        // dieser Position — ist dort bereits gebunden, kein Vorschlag.
        continue;
      }

      if (effektiverStatusRang(personId, personenById, position.id, datumISO, ereignisse) > 0 && !azubiFallback) {
        // Passender Azubi, aber noch nicht zuweisen — erst schauen,
        // ob weiter hinten im Pool noch ein Rang-0-Kandidat kommt.
        azubiFallback = personId;
        continue;
      }

      zuweisungen[position.id] = personId;
      verplantHeute.add(personId);
      besetzt = true;
      break;
    }

    if (!besetzt && azubiFallback) {
      // Kein Rang-0-Kandidat der EIGENEN Schicht übrig — jetzt darf der
      // Azubi ran, auch wenn es noch Cross-Schicht-Kandidaten gäbe
      // (13.09.2026, siehe ausführliche Begründung oben). Ein
      // Schichtwechsel für jemand anderen wäre der teurere Weg.
      zuweisungen[position.id] = azubiFallback;
      verplantHeute.add(azubiFallback);
      besetzt = true;
    }

    if (!besetzt) {
      for (const personId of zurueckgestellt) {
        manuellePruefung.push({
          positionId: position.id,
          personId,
          grund: 'Früh↔Nacht-Wechsel — 11-Stunden-Ruhezeit, nur auf ausdrückliche Entscheidung (§18)'
        });
      }
    }
  }

  // --- Schritt 4 (§18): Tausch-Fixup für offen gebliebene Positionen ---
  // Umgestellt 13.09.2026 (Ulf, ausdrückliche Freigabe) von der reinen
  // Ein-Ebenen-Suche (versucheTausch, steht unverändert darunter, wird
  // aber nicht mehr aufgerufen) auf die rekursive Tiefensuche
  // versucheTauschTief(). Ulfs Beobachtung, die dazu führte: "er
  // verschiebt eine Position... vielleicht löst die Aktion noch eine
  // Sache aus... aber es fallen keine weiteren Dominosteine... Danach
  // ist Schluss... Wo ich auf den Plan schaue... drei vier weitere Züge
  // sehe und das Problem löse." Genau diese Ketten findet die alte
  // Ein-Ebenen-Suche strukturell nicht.
  const offenNachErstemDurchlauf = aktivePositionen.filter(p => !zuweisungen[p.id]);
  for (const offenePosition of offenNachErstemDurchlauf) {
    if (zuweisungen[offenePosition.id]) continue; // durch eine frühere Kette schon mitbesetzt
    const kette = versucheTauschTief(
      offenePosition.id, aktivePositionen, zuweisungen, personenById,
      datumISO, ereignisse, verplantHeute, TAUSCH_MAX_TIEFE, new Set()
    );
    if (kette) {
      // Die Kette wird nur als Ganzes übernommen — sie ist per
      // Konstruktion vollständig aufgegangen (jede aufgebrochene
      // Position wurde wieder besetzt), also netto genau eine Lücke
      // weniger. Teilergebnisse gibt es bewusst nicht.
      for (const posId of Object.keys(zuweisungen)) delete zuweisungen[posId];
      Object.assign(zuweisungen, kette.zuweisungen);
      for (const personId of kette.verplantHeute) verplantHeute.add(personId);
    }
  }

  // --- Schritt 6 (§18): was übrig bleibt, bleibt offen ---
  const luecken = aktivePositionen
    .filter(p => !zuweisungen[p.id])
    .map(p => p.id);

  // Ergänzt 14.09.2026 (Ulf, Punktesystem-Umbau) — rein additiv, keine
  // Zuweisungs-Logik geändert. Für die neue gewichtete Wochen-Bewertung
  // in freie_tage_verteilung.js muss gezählt werden können, wie viele
  // Azubi-Einsätze diese Berechnung tatsächlich enthält.
  // Bewusst als Nachprüfung auf den FINALEN Zustand (nicht während des
  // Pool-Durchlaufs mitgezählt): die Tausch-Tiefensuche (Schritt 4) kann
  // eine bereits besetzte Position komplett neu zusammensetzen, ein
  // ursprünglich per Azubi-Fallback besetzter Platz könnte also am Ende
  // an einer anderen Position stehen als zuerst gedacht. Die robuste
  // Prüfung ist deshalb: für jede am Ende besetzte Position, steht dort
  // eine Person mit `effektiverStatusRang > 0` (genau dieselbe Prüfung,
  // die weiter oben schon über Azubi vs. Fachkraft entscheidet)?
  const azubiEingesetzt = aktivePositionen
    .filter(p => zuweisungen[p.id] && effektiverStatusRang(zuweisungen[p.id], personenById, p.id, datumISO, ereignisse) > 0)
    .map(p => p.id);

  return { zuweisungen, luecken, manuellePruefung, verplantHeute, aktivePositionen, azubiEingesetzt };
}

/**
 * Rekursive Tausch-Tiefensuche (13.09.2026, Ulfs ausdrückliche Freigabe)
 * — der Nachfolger von `versucheTausch()` (steht unverändert darunter,
 * wird aber von `berechneTag()` nicht mehr aufgerufen; bewusst nicht
 * gelöscht, damit die Änderung minimal-invasiv und leicht rückrollbar
 * bleibt).
 *
 * DAS PROBLEM: `versucheTausch()` sucht genau EINE Ebene tief — Person X
 * rückt in die offene Position, Xs alte Position wird aus ihrem eigenen
 * Pool nachbesetzt. Klappt diese eine Nachbesetzung nicht direkt, gibt
 * der Mechanismus auf. Ketten über mehrere Stationen (Ulf: "drei vier
 * weitere Züge") sind damit strukturell unerreichbar.
 *
 * DIE LÖSUNG: klassisches Backtracking. Für die offene Position jeden
 * Pool-Kandidaten durchprobieren; steht der schon woanders, wird diese
 * Position aufgebrochen und ihrerseits rekursiv behandelt — bis alles
 * zu ist oder die Tiefe erschöpft. Schlägt ein Zweig fehl, wird er
 * komplett verworfen und der nächste Kandidat probiert.
 *
 * VIER REGELN, mit Ulf vorab festgelegt (13.09.2026):
 *  1. TIEFE 4 (TAUSCH_MAX_TIEFE) — deckt Ulfs Beispielkette ab; tiefer
 *     wird das Ergebnis für einen Menschen nicht mehr nachvollziehbar,
 *     und der Nutzen fällt steil ab.
 *  2. KORREKT BESETZTE POSITIONEN DÜRFEN AUFGEBROCHEN WERDEN — das ist
 *     der eigentliche Unterschied zu vorher (Ulf: "Ein Tag der
 *     eigentlich fertig ist wird geändert und geschaut... gerade das ist
 *     doch der entscheidende Schritt"). Aber NUR innerhalb einer Kette,
 *     die am Ende wirklich eine Lücke schließt — nie "einfach so".
 *  3. NUR ECHTE LÜCKEN-REDUKTION wird übernommen. Eine Kette gilt nur
 *     als Erfolg, wenn jede aufgebrochene Position wieder besetzt werden
 *     konnte; netto also genau eine Lücke weniger. Gleichstand zählt
 *     NICHT, auch wenn das Ergebnis "schöner" aussähe — sonst würfelt
 *     das System bei jedem Lauf anders durch, ohne erkennbaren Grund.
 *  4. KEINE NEUEN SCHICHTWECHSEL. Die Kette nutzt ausschließlich Züge
 *     innerhalb der jeweiligen Schicht (plus Azubis, siehe
 *     `azubiFallback` in berechneTag). Cross-Schicht bleibt
 *     bestätigungspflichtig über manuellePruefung/Konzentration — sonst
 *     würde die Tiefensuche still Leute zwischen Nacht und Früh
 *     schieben, genau der Fehler aus der Sitzung vom 13.09. vormittags.
 *
 * Zyklenschutz: `gesperrt` sammelt jede Position, die in DIESER Kette
 * schon angefasst wurde — sie darf nicht erneut aufgebrochen werden,
 * sonst könnten zwei Positionen einander endlos hin- und herreichen.
 *
 * Arbeitet auf KOPIEN und gibt bei Erfolg den kompletten neuen Zustand
 * zurück; der Aufrufer übernimmt ihn als Ganzes oder gar nicht. Dadurch
 * kann ein fehlgeschlagener Zweig keine halben Änderungen hinterlassen.
 *
 * @returns { zuweisungen, verplantHeute } oder null
 */
/**
 * Hilfsfunktion zur Krankmelder-Anbindung (14.09.2026, siehe unten) --
 * die reine RICHTUNGS-Kosten eines Schichtwechsels, ohne Puffer-Stufen
 * (die bräuchten Kenntnis der Vortage, siehe Begründung bei
 * versucheTauschTief). Nacht->Früh oder gar kein Wechsel: 0 (günstig).
 * Früh->Nacht: 1 (teuer). Spiegelt nur die RICHTUNG aus dem
 * Punktesystem (SESSION_2026-09-13_PUNKTESYSTEM_KONZEPT.md §3), nicht
 * die genauen Punktwerte -- hier reicht die Randordnung.
 */
function wechselRichtungsKosten(person, offenePosition) {
  if (!person) return 0;
  if (person.stammschicht === 'frueh' && offenePosition.schicht === 'nacht') return 1;
  return 0;
}

/**
 * Wie sortiertePoolReihenfolge(), aber mit einer zusätzlichen
 * Sortier-Stufe zwischen Rang und ursprünglicher Pool-Reihenfolge:
 * die Richtungs-Kosten eines nötigen Schichtwechsels (siehe
 * wechselRichtungsKosten). Nur für den Vorschlags-Modus mit
 * Wechsel-Budget gedacht (siehe versucheTauschTief) -- ohne
 * Wechsel-Bedarf ändert sich nichts an der normalen Rang-Reihenfolge.
 */
function sortiertePoolReihenfolgeMitWechselKosten(pool, personenById, positionId, datumISO, ereignisse, offenePosition) {
  const rangSortiert = sortiertePoolReihenfolge(pool, personenById, positionId, datumISO, ereignisse);
  return rangSortiert.slice().sort((a, b) => {
    const ra = effektiverStatusRang(a, personenById, positionId, datumISO, ereignisse);
    const rb = effektiverStatusRang(b, personenById, positionId, datumISO, ereignisse);
    if (ra !== rb) return ra - rb;
    const ka = wechselRichtungsKosten(personenById[a], offenePosition);
    const kb = wechselRichtungsKosten(personenById[b], offenePosition);
    if (ka !== kb) return ka - kb;
    return rangSortiert.indexOf(a) - rangSortiert.indexOf(b); // ursprüngliche Pool-Reihenfolge als letzter Tie-Break
  });
}

/**
 * ERGÄNZT 14.09.2026 (Krankmelder-Anbindung, siehe
 * SESSION_2026-09-13_PUNKTESYSTEM_KONZEPT.md §10 "Krankmelder läuft
 * komplett am neuen Punktesystem vorbei" -- Ulfs Fund und ausdrückliche
 * Freigabe für diese Ergänzung): neuer, optionaler letzter Parameter
 * `guenstigenWechselBevorzugen`. Rein additiv -- fehlt er (wie bei
 * jedem bisherigen Aufrufer, insbesondere dem automatischen Schritt 4
 * in berechneTag() mit Budget 0), verhält sich die Funktion exakt wie
 * vorher.
 *
 * GRUND: `findeTauschKetteMitWechsel()` (siehe unten) fand bisher nur
 * die ERSTE erfolgreiche Kette nach Pool-Rang -- blind dafür, ob der
 * darin enthaltene Wechsel (falls einer nötig war) die günstige
 * Richtung (Nacht->Früh, 0 Punkte) oder die teure (Früh->Nacht, bis zu
 * 50 Punkte) hätte. Für den Krankmelder-Anwendungsfall (Ulf: "läuft das
 * System mit den Punkten aus dem normalen System... wirklich effizient
 * und richtig?" -- nein, tat es nicht) reicht dafür die reine Richtung
 * als Sortier-Kriterium (siehe wechselRichtungsKosten) -- volle
 * Puffer-Genauigkeit (Weg 2 aus demselben Gespräch) bräuchte Kenntnis
 * der Vortage, bewusst nicht gebaut, siehe Doku.
 */
function versucheTauschTief(offenePositionId, aktivePositionen, zuweisungen, personenById, datumISO, ereignisse, verplantHeute, tiefe, gesperrt, wechselBudget, schritte, guenstigenWechselBevorzugen) {
  if (tiefe <= 0) return null;
  wechselBudget = wechselBudget || 0;
  schritte = schritte || [];
  const offenePosition = aktivePositionen.find(p => p.id === offenePositionId);
  if (!offenePosition) return null;

  const kandidatenReihenfolge = guenstigenWechselBevorzugen
    ? sortiertePoolReihenfolgeMitWechselKosten(offenePosition.pool, personenById, offenePosition.id, datumISO, ereignisse, offenePosition)
    : sortiertePoolReihenfolge(offenePosition.pool, personenById, offenePosition.id, datumISO, ereignisse);

  for (const personId of kandidatenReihenfolge) {
    if (!personId) continue;
    const person = personenById[personId];
    if (!person) continue;
    if (!istEinsetzbar(person, datumISO, ereignisse, offenePosition.schicht)) continue;

    // Regel 4: die Kette erzeugt selbst keine Schichtwechsel — es sei
    // denn, sie läuft im VORSCHLAGS-Modus mit einem Wechsel-Budget
    // (13.09.2026, Ulf: "Also gegen Regel 4 verstoßen... wenn uns das
    // näher an den optimalen Samstag bringt... Ja"). Ein solcher Fund
    // wird NIE automatisch angewendet, sondern nur zurückgegeben —
    // siehe findeTauschKetteMitWechsel(). Das Budget ist bewusst auf 1
    // begrenzt (ein Wechsel pro Kette): mehrere Wechsel in EINER Kette
    // würden mehrere Personen die 1–2 Tage Umstellung der inneren Uhr
    // kosten, was Ulfs eigenem Grundsatz widerspricht (eine Person
    // mehrfach belasten statt mehrere leicht).
    let budgetNachher = wechselBudget;
    if (istRuhezeitRelevanterWechsel(person, offenePosition, datumISO, ereignisse)) {
      if (budgetNachher <= 0) continue;
      budgetNachher -= 1;
    }

    // Steht diese Person an diesem Tag schon irgendwo — und wenn ja, wo?
    const aktuellePositionId = Object.keys(zuweisungen).find(posId => zuweisungen[posId] === personId);

    if (!aktuellePositionId) {
      // Nicht in DIESER Schicht verplant. Kann sie trotzdem in einer
      // früher gerechneten Schicht gebunden sein (§9), dann ist sie tabu.
      if (verplantHeute.has(personId)) continue;
      const neueZuweisungen = Object.assign({}, zuweisungen);
      neueZuweisungen[offenePosition.id] = personId;
      const neuVerplant = new Set(verplantHeute);
      neuVerplant.add(personId);
      return {
        zuweisungen: neueZuweisungen,
        verplantHeute: neuVerplant,
        schritte: schritte.concat([{ positionId: offenePosition.id, personId, vorherigePersonId: null }]),
        wechselVerbraucht: (wechselBudget - budgetNachher) + schritte.reduce((s, x) => s + (x.istWechsel ? 1 : 0), 0)
      };
    }

    // Person steht woanders — diese Position aufbrechen (Regel 2) und
    // rekursiv nachbesetzen. Zyklenschutz: nie dieselbe Position zweimal.
    if (gesperrt.has(aktuellePositionId)) continue;

    const neueZuweisungen = Object.assign({}, zuweisungen);
    delete neueZuweisungen[aktuellePositionId];
    neueZuweisungen[offenePosition.id] = personId;

    const neuGesperrt = new Set(gesperrt);
    neuGesperrt.add(offenePosition.id);
    neuGesperrt.add(aktuellePositionId);

    const neueSchritte = schritte.concat([{
      positionId: offenePosition.id,
      personId,
      vorherigePersonId: null,
      vonPositionId: aktuellePositionId,
      istWechsel: budgetNachher < wechselBudget
    }]);

    // verplantHeute bleibt unverändert — die Person ist weiterhin
    // verplant, nur eben auf einer anderen Position.
    const folge = versucheTauschTief(
      aktuellePositionId, aktivePositionen, neueZuweisungen, personenById,
      datumISO, ereignisse, verplantHeute, tiefe - 1, neuGesperrt,
      budgetNachher, neueSchritte, guenstigenWechselBevorzugen
    );
    // Regel 3: nur eine vollständig aufgegangene Kette zählt. Schlägt
    // die Nachbesetzung fehl, wird dieser ganze Zweig verworfen
    // (Backtracking) und der nächste Kandidat probiert.
    if (folge) return folge;
  }
  return null;
}

/**
 * Vorschlags-Variante der Tiefensuche (13.09.2026, Ulfs Freigabe):
 * sucht eine Kette, die EINEN Schichtwechsel enthalten darf, und gibt
 * sie ZURÜCK, ohne irgendetwas anzuwenden.
 *
 * Warum getrennt von `berechneTag()`: ein Schichtwechsel kostet die
 * betroffene Person 1–2 Tage Umstellung der inneren Uhr und ist damit
 * nie etwas, das automatisch passieren darf — das war der Fehler, der
 * am 13.09. vormittags einmal gebaut und wieder zurückgerollt wurde.
 * `berechneTag()` ruft deshalb weiterhin mit Budget 0 auf; diese
 * Funktion existiert ausschließlich für bestätigungspflichtige
 * Vorschläge in der Oberfläche.
 *
 * Wird nur aufgerufen, wenn die strikte Suche bereits gescheitert ist
 * (sonst wäre die Lücke ja schon zu).
 *
 * ERGÄNZT 14.09.2026: neuer, optionaler letzter Parameter
 * `guenstigenWechselBevorzugen` (Default false, siehe versucheTauschTief) --
 * für den Krankmelder gebraucht, rückwärtskompatibel für alle anderen
 * Aufrufer.
 *
 * @returns { zuweisungen, verplantHeute, schritte } oder null.
 *   `schritte` beschreibt die Kette in der Reihenfolge, in der sie
 *   gefunden wurde: jeder Eintrag { positionId, personId, vonPositionId?,
 *   istWechsel? } bedeutet "personId übernimmt positionId" (und kommt
 *   dabei ggf. von vonPositionId).
 */
function findeTauschKetteMitWechsel(offenePositionId, aktivePositionen, zuweisungen, personenById, datumISO, ereignisse, verplantHeute, tiefe, guenstigenWechselBevorzugen) {
  return versucheTauschTief(
    offenePositionId, aktivePositionen, zuweisungen, personenById,
    datumISO, ereignisse, verplantHeute,
    tiefe || TAUSCH_MAX_TIEFE, new Set(), 1, [], guenstigenWechselBevorzugen
  );
}

/**
 * Ein-Ebenen-Tauschversuch (Beispiel siehe §18): sucht in der offenen
 * Position jemanden, der schon einer anderen, aktiven Position
 * zugewiesen ist — und prüft, ob diese andere Position durch jemand
 * anderen aus ihrem eigenen Pool nachbesetzt werden kann.
 */
function versucheTausch(offenePosition, aktivePositionen, zuweisungen, personenById, datumISO, ereignisse, verplantHeute) {
  for (const personId of offenePosition.pool) {
    if (!personId) continue;
    const person = personenById[personId];
    if (!person) continue;

    // Steht diese Person schon woanders? Wo genau?
    const betroffenePositionId = Object.keys(zuweisungen).find(posId => zuweisungen[posId] === personId);
    if (!betroffenePositionId) continue; // nicht verplant, aber dann wäre Schritt 3 schon fündig geworden

    const betroffenePosition = aktivePositionen.find(p => p.id === betroffenePositionId);
    if (!betroffenePosition) continue;
    if (istRuhezeitRelevanterWechsel(person, offenePosition, datumISO, ereignisse)) continue;

    // Kann die betroffene Position durch jemand anderen ersetzt werden?
    for (const ersatzId of betroffenePosition.pool) {
      if (!ersatzId || ersatzId === personId) continue;
      if (verplantHeute.has(ersatzId)) continue;
      const ersatzPerson = personenById[ersatzId];
      if (!ersatzPerson || !istEinsetzbar(ersatzPerson, datumISO, ereignisse, betroffenePosition.schicht)) continue;
      if (istRuhezeitRelevanterWechsel(ersatzPerson, betroffenePosition, datumISO, ereignisse)) continue;

      return {
        neuePersonFuerOffenePosition: personId,
        betroffenePositionId,
        ersatzFuerBetroffenePosition: ersatzId
      };
    }
  }
  return null;
}

/**
 * Orchestriert einen Tag über mehrere Schichten hinweg, in fester
 * Reihenfolge (§9/§19): Nacht → Früh → Sonntag. Wer in einer früher
 * gerechneten Schicht gebunden ist, fällt in der nächsten automatisch
 * raus (§18, Schritt 5).
 */
function berechneTagAlleSchichten(datumISO, personen, positionen, ereignisse, manuelleZuweisungen = []) {
  const reihenfolge = ['nacht', 'frueh', 'sonntag'];
  const ergebnisJeSchicht = {};
  let verplant = new Set();

  for (const schicht of reihenfolge) {
    const ergebnis = berechneTag(datumISO, schicht, personen, positionen, ereignisse, verplant, manuelleZuweisungen);
    ergebnisJeSchicht[schicht] = ergebnis;
    verplant = ergebnis.verplantHeute;
  }
  ergebnisJeSchicht.ueberzaehlig = ueberzaehligeHeute(datumISO, personen, verplant, ereignisse);
  ergebnisJeSchicht.lehrschicht = lehrschichtHeute(personen, ergebnisJeSchicht);
  // Wer eine Lehrschicht hat, ist nicht mehr "einfach überzählig" —
  // hat ja einen erkennbaren Status, keinen unklaren.
  const inLehrschicht = new Set(ergebnisJeSchicht.lehrschicht.map(l => l.personId));
  ergebnisJeSchicht.ueberzaehlig = ergebnisJeSchicht.ueberzaehlig.filter(id => !inLehrschicht.has(id));
  return ergebnisJeSchicht;
}

/**
 * Personen, die an diesem Tag da wären (kein Urlaub, keine Krankheit,
 * kein Sperrtag, kein freier Tag — kurz: nichts, was sie entschuldigt),
 * aber trotz des kompletten Kaskaden-Durchlaufs über alle Schichten
 * KEINER Position zugewiesen wurden (05.09.2026, Ulfs Fund: bei voller
 * Besetzung "fällt sonst jemand einfach unter den Tisch" — weder als
 * frei noch als eingeteilt sichtbar). Wird bewusst nur ANGEZEIGT, nicht
 * automatisch wegoptimiert — Ulf: ein Überschuss an manchen Tagen
 * (z. B. Samstag) ist in Ordnung, an anderen nicht, das ist von Fall
 * zu Fall seine Entscheidung.
 *
 * Der frühere Ausschluss für `stammschicht: 'flexibel'`
 * (Produktionshelfer) ist raus (09.09.2026, Ulf) — sie bekommen jetzt
 * eine echte Stammschicht wie alle anderen und sollen genauso sichtbar
 * als überzählig auftauchen, nicht länger unsichtbar bleiben.
 */
function ueberzaehligeHeute(datumISO, personen, verplantGesamt, ereignisse) {
  return personen
    .filter(p => istEinsetzbar(p, datumISO, ereignisse))
    .filter(p => !verplantGesamt.has(p.id))
    .map(p => p.id);
}

/**
 * Lehrschicht (05.09.2026, aus V1 übernommen, Ulfs "22-Uhr"-Fall):
 * überzählige Azubis, die zwar im Pool einer an diesem Tag besetzten
 * Position stehen, die Position aber nicht übernommen haben (weil
 * dank `sortiertePoolReihenfolge` eine Fachkraft oder ein
 * Produktionshelfer vorgezogen wurde), laufen als zusätzliche Person
 * bei der Position mit, statt einfach als "überzählig" zu
 * verschwinden. Ein Azubi kann bei mehreren Positionen gleichzeitig
 * als Lehrschicht auftauchen, wenn er in mehreren Pools steht — das
 * ist bewusst so (informativ, keine echte Doppel-Zuweisung).
 *
 * Präzisiert 09.09.2026 (Ulf, echter Testlauf 11.09.2026 — zwei
 * Azubis gleichzeitig in Nacht-Lehrschicht): Lehrschicht gibt
 * es strukturell nur in der Nachtschicht, und dort strukturell nur
 * für den einen Azubi mit `stammschicht: 'nacht'` — Früh-Azubis
 * dürfen nie hineinrutschen, auch wenn sie zufällig in
 * einem Nacht-Pool stehen und an dem Tag in ihrer eigenen Schicht
 * überzählig sind. Deshalb jetzt zwei Einschränkungen gegenüber
 * vorher: Filter auf `stammschicht === 'nacht'`, und nur noch
 * `ergebnisJeSchicht.nacht` statt aller drei Schichten durchsucht.
 * Ein zweiter Azubi in der Nachtschicht bei echtem Personalmangel
 * bleibt möglich — dann aber über eine echte Positions-Zuweisung
 * (normale Kaskade), nicht über Lehrschicht.
 *
 * Berücksichtigt seit 09.09.2026 auch `gesperrteSchichten` — für
 * Nachtschicht gesperrte Azubis (Schicht-Sperr-Fall) kommen für
 * Nacht-Lehrschicht ebenso wenig infrage wie für eine echte Position
 * dort.
 */
function lehrschichtHeute(personen, ergebnisJeSchicht) {
  const personenById = Object.fromEntries(personen.map(p => [p.id, p]));
  const ueberzaehligeAzubis = ergebnisJeSchicht.ueberzaehlig
    .map(id => personenById[id])
    .filter(p => p && p.status === 'azubi' && p.stammschicht === 'nacht')
    .filter(p => !(p.gesperrteSchichten && p.gesperrteSchichten.includes('nacht')));

  const lehrschicht = [];
  for (const azubi of ueberzaehligeAzubis) {
    for (const position of ergebnisJeSchicht.nacht.aktivePositionen) {
      if (!position.pool.includes(azubi.id)) continue;
      const besetztVon = ergebnisJeSchicht.nacht.zuweisungen[position.id];
      if (!besetztVon || besetztVon === azubi.id) continue;
      const begleitetPerson = personenById[besetztVon];
      if (begleitetPerson && begleitetPerson.status === 'azubi') continue; // kein Lehrschicht-Nutzen, wenn die begleitete Person selbst Azubi ist
      lehrschicht.push({ personId: azubi.id, positionId: position.id, begleitetPersonId: besetztVon });
    }
  }
  return lehrschicht;
}

/**
 * Berechnet eine ganze Woche (7 Tage ab wochenStartISO, i.d.R. ein
 * Montag). Reine Aggregation von berechneTagAlleSchichten pro Tag —
 * die Wochen-/Genehmigen-Logik selbst (§19) gehört in den jeweiligen
 * Satelliten, nicht hierher.
 */
function berechneWoche(wochenStartISO, personen, positionen, ereignisse, manuelleZuweisungen = []) {
  const tage = [];
  const start = parseISO(wochenStartISO);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const datumISO = formatISO(d);
    tage.push({ datumISO, ...berechneTagAlleSchichten(datumISO, personen, positionen, ereignisse, manuelleZuweisungen) });
  }
  return tage;
}

// Für Einbindung als <script> ODER als Modul nutzbar.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    berechneTag,
    berechneTagAlleSchichten,
    berechneWoche,
    istEinsetzbar,
    hatBindendeSperre,
    istRuhezeitRelevanterWechsel,
    effektiveSchicht,
    hatCrossSchichtZuweisung,
    findeCrossSchichtZuweisung,
    ueberzaehligeHeute,
    lehrschichtHeute,
    sortiertePoolReihenfolge,
    berechnePoolHaeufigkeit,
    aktivePositionenFuerTag,
    // Ergänzt 13.09.2026 (Tiefensuche, Ulfs Freigabe) — die
    // Vorschlags-Variante wird von entwuerfe_berechnung.js gebraucht.
    versucheTauschTief,
    findeTauschKetteMitWechsel,
    wochentag,
    parseISO,
    formatISO,
    heuteAlsISO
  };
}
