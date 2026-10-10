/* ================================================================
   BäckereiOS · Host — Accounts & Registrierung
   ================================================================
   Zentrale Mechanik für Selbstregistrierung, geräteübergreifende
   Identität und Rollen-/Rechte-Zuweisung. "Eine Mechanik, viele
   Aufrufer" — Launcher-Login UND die künftige Freischaltungs-
   Tabelle rufen ausschließlich diese Funktionen auf. Niemand
   sonst liest/schreibt die Collection `bos_accounts` direkt.

   STATUS (31.08.2026, Abend-Update): PIN jetzt Pflicht bei Registrierung,
   prüft bei Namensgleichheit automatisch dagegen statt stillschweigend
   fremde Konten zu übernehmen. Auslöser: Vorname+Geburtsdatum allein
   ließ jeden, der Name+Geburtsdatum einer Kollegin/eines Kollegen kennt,
   deren Konto auf einem neuen Gerät übernehmen — Zwischensilbe schützt
   davor nicht, sie wird von der App automatisch für JEDE Eingabe mit
   angehängt. Siehe BOS_BAUSTELLEN.md #7/#8.

   STATUS (31.08.2026, nachts): Admin-Anmeldung lief bisher über die
   geteilte Standard-Firebase-Sitzung — Ulf hat in der Praxis erlebt, dass
   danach zugewiesene Rollen beim betroffenen Konto nicht ankamen (auf
   den alten, zwischengespeicherten Stand zurückgefallen). Grund: Firebase
   merkt sich die Anmeldung pro Adresse, nicht pro Fenster — die Admin-
   An-/Abmeldung im Konten&Rollen-Fenster hat die geteilte Sitzung auch
   im Launcher-Elternfenster mit umgeschaltet. adminReauth()/adminReauthEnde()/
   setzeRolle()/setzeOverride() laufen jetzt über eine isolierte zweite
   Firebase-App-Instanz (`bos-admin`), die geteilte Sitzung bleibt unberührt.

   Datenmodell — Collection `bos_accounts`, Dokument-ID = deter-
   ministischer Schlüssel aus Vorname+Geburtsdatum+Silbe(+Zusatz):
     {
       name: string,
       geburtsdatum: string,      // "YYYY-MM-DD"
       pin: string,               // Pflicht seit heute Abend, s.o.
       role: string | null,       // null = Grundkonto ("Light")
       overrides: { [satellitId: string]: boolean },  // sparse
       taskboardAbhaken: boolean, // NEU 05.09.2026, siehe unten
       teigeckePflege: boolean,   // NEU 28.09.2026 — Anzeige seit 29.09.: „🧺 Wagen & Zutaten pflegen“
       teigeckeTeige: boolean,    // NEU 29.09.2026 — „🥣 Teige pflegen“ (Wasserregel, Tabelle, Einwaagen, Kessel)
       teigeckeRezepte: boolean,  // NEU 29.09.2026 — „📜 Rezepte pflegen“ (Zutatenliste, Vorstufe, Werte je kg)
       reparaturLesen: boolean,   // NEU 10.10.2026 — „Mitlesen & antworten“ (Posteingang, Verlauf, Chat)
       reparaturMelden: boolean,  // NEU 10.10.2026 — „Melden“ (neue Anfrage; schließt Mitlesen ein)
       reparaturBearbeiten: boolean, // NEU 10.10.2026 — „Bearbeiten“, Hausmeister (Status, Fenster, Dringlichkeit; schließt Mitlesen ein)
       erstelltAm: Firestore-Timestamp
     }

   NEU (05.09.2026, Taskboard-Feature): `taskboardAbhaken` entscheidet,
   ob diese Person Aufgaben im Taskboard-Popup als erledigt markieren
   darf — bewusst NICHT rollenbasiert (Ulf: einzelne Personen, nicht
   Rollen, "sonst hat der Azubi, der schnell nach Hause will, plötzlich
   alle Aufgaben samt Weltherrschaft erledigt"). Gleicher Schreibschutz
   wie role/overrides/pin (siehe Security Rule) — nur admin (Passwort)
   kann es setzen, über setzeTaskboardRecht() unten. Das eigentliche
   "erledigt"-Schreiben im Popup selbst prüft dieses Feld nur clientseitig
   (Ulf-Entscheidung 05.09.2026: reicht, gleiche Schutzstufe wie der Rest
   des Systems — echte serverseitige Rollen-Unterscheidung ist mit der
   geteilten anonymen Sitzung ohnehin nicht möglich, siehe
   SESSION_2026-09-05_AUFGABEN_TASKBOARD_KONZEPT.md).

   WICHTIG zum PIN: liegt als normales Feld im selben, für alle authenti-
   fizierten Clients lesbaren Dokument — jeder mit App-Zugriff könnte ihn
   theoretisch per Firestore-Abfrage auslesen (kein serverseitiges Redigieren
   einzelner Felder ohne Cloud Functions möglich). Genau wie jeder andere
   PIN im System: Fumbling-Schutz, keine echte Kryptographie — aber besser
   als vorher (gar keine Prüfung bei Geräte-Wechsel). Schreibschutz über
   die Security Rule (siehe unten) verhindert wenigstens das stille
   Überschreiben fremder PINs.

   Bewusst NICHT append-only: Zustand pro Person, kein Messwert —
   dieselbe Unterscheidung wie produkt_config vs. bos_events.

   STATUS (26.09.2026, Namens-Fundament Schritt 1 — Kontenliste zu):
   Jeder liest nur noch sein EIGENES Konto-Dokument, die ganze Liste
   nur die Admin-Sitzung (Ulf, 26.09.: "ausschließlich ein Admintool").
   Die Absätze oben zu PIN und "für alle lesbar" beschreiben den Stand
   vor der Kontenumstellung und gelten so nicht mehr.

   CHANGELOG
     2026-10-10 · 09:33 · v-Reparatur-1 · Feature
       Drei Haken der Reparaturanfrage: reparaturLesen, reparaturMelden,
       reparaturBearbeiten, mit setzeReparaturLesenRecht(),
       setzeReparaturMeldenRecht(), setzeReparaturBearbeitenRecht() nach dem
       Muster der Teigecke. Die Firestore-Regel prüft jeden serverseitig
       (reparaturHaken(), RK §20); ein Haken genügt auch für die Kachel
       (Registry-Feld haken, bos_access.js). Siehe
       SESSION_2026-10-10_REPARATURANFRAGE_STUFE1_BAU.md.
     2026-09-29 · 19:45 · v-Teigecke-2 · Feature
       Zwei weitere Teigecke-Haken: teigeckeTeige und teigeckeRezepte, mit
       setzeTeigeckeTeigeRecht() und setzeTeigeckeRezepteRecht() nach dem
       Muster von setzeTeigeckePflegeRecht(). Drei Haken, drei Bereiche,
       die Firestore-Regel prüft jeden getrennt (RK §11). teigeckePflege
       behält den Feldnamen (Bestandsdaten), heißt in der Oberfläche jetzt
       „Wagen & Zutaten pflegen“. Siehe SESSION_2026-09-29_TEIGECKE_STUFE2_BAU.md.
     2026-09-28 · 10:33 · v-Teigecke-1 · Feature
       Neues Feld teigeckePflege (Haken „Teigecke pflegen“) und
       setzeTeigeckePflegeRecht() — Vorbild setzeTaskboardRecht(). Anders
       als dort prüft hier die Firestore-Regel den Haken serverseitig
       (darfTeigeckePflegen(), RK §10): ohne Haken kein Schreiben in die
       teigecke_*-Collections. Siehe SESSION_2026-09-28_TEIGECKEN_STUFE1_BAU.md.
     2026-09-26 · v-Namensfundament-1 · Umbau
       adminReauth(): Admin-Sitzung mit Persistence NONE (nie im
       Browser gespeichert). Neu adminAngemeldet(). Kommentar an
       ladeAlleKonten(): nur noch mit adminFirestore() aufrufen.
   ================================================================ */

window.BOS_ACCOUNTS = (function () {

  function normalisiere(text) {
    var ersatz = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[äöüß]/g, function (z) { return ersatz[z]; })
      .replace(/[^a-z0-9]/g, '');
  }

  function berechneSchluessel(vorname, geburtsdatum, zusatz) {
    var silbe = (window.BOS_BV && typeof window.BOS_BV.silbe === 'function')
      ? window.BOS_BV.silbe()
      : '';
    if (!silbe) {
      console.warn('BOS_ACCOUNTS: keine Zwischensilbe verfügbar — bos_launcher_backgrounds.js vor bos_accounts.js geladen? Schlüssel aktuell ungeschützt vorhersehbar.');
    }
    var basis = normalisiere(vorname) + '-' + geburtsdatum + '-' + silbe;
    return zusatz ? basis + '-' + normalisiere(zusatz) : basis;
  }

  /**
   * Eigene, zweite Firebase-App-Instanz nur für Admin-Aktionen — Firebase
   * merkt sich die Anmeldung pro Adresse (Origin), nicht pro Fenster/Iframe.
   * Ohne diese Trennung würde adminReauth() die geteilte anonyme Sitzung
   * ALLER offenen Fenster (auch des Launchers im Elternfenster) umschalten,
   * inklusive currentUser-Wechsel danach zurück zu einer NEUEN, anderen
   * anonymen UID. Genau in diesem Umschalt-Moment kann ein gleichzeitiges
   * Nachladen anderswo scheitern und still auf den alten Stand zurückfallen.
   * 31.08.2026, nachts: an genau diesem Symptom in der Praxis gefunden.
   */
  function holeAdminApp() {
    var vorhandene = firebase.apps.filter(function (a) { return a.name === 'bos-admin'; });
    if (vorhandene.length) return vorhandene[0];
    return firebase.initializeApp(firebase.app().options, 'bos-admin');
  }

  /**
   * Meldet eine isolierte Zweit-Sitzung mit dem Admin-Konto an (E-Mail-
   * Kennung kommt aus BOS_BV, Passwort wird nie im Code gespeichert —
   * Ulf tippt es im Moment der Aktion ein). Berührt die normale, geteilte
   * anonyme Sitzung NICHT. Einmal vor einem Block von Änderungen
   * aufrufen, nicht vor jeder einzelnen.
   */
  async function adminReauth(passwort) {
    var email = (window.BOS_BV && typeof window.BOS_BV.adminKennung === 'function')
      ? window.BOS_BV.adminKennung()
      : null;
    if (!email) {
      throw new Error('BOS_ACCOUNTS: Admin-Kennung nicht verfügbar — bos_launcher_backgrounds.js geladen?');
    }
    var adminAuth = holeAdminApp().auth();
    /* NEU 26.09.2026 (Namens-Fundament, Schritt 1): die Admin-Sitzung wird
       NIRGENDS gespeichert — nicht im Browser, nicht über ein Neuladen
       hinaus. Grund: die Kontenverwaltung hält die Admin-Sitzung seit
       heute, solange die Seite offen ist (Passwort beim Öffnen statt bei
       jeder Aktion). Mit der Standard-Einstellung LOCAL läge sie danach im
       Browserspeicher dieses Geräts, und das nächste Öffnen wäre ohne
       Passwort möglich. NONE = nur im Arbeitsspeicher dieser Seite.
       Für die übrigen Aufrufer (verbrauch_werkstatt.html) ändert sich
       nichts Sichtbares: sie melden sich an, handeln und sind fertig. */
    await adminAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);
    return adminAuth.signInWithEmailAndPassword(email, passwort);
  }

  /**
   * NEU 26.09.2026: Ist die isolierte Admin-Sitzung gerade angemeldet?
   * Die Kontenverwaltung fragt das, bevor sie eine Aktion ohne erneute
   * Passwortabfrage ausführt. Liefert false statt zu werfen, wenn die
   * Admin-App noch gar nicht existiert.
   */
  function adminAngemeldet() {
    try {
      return !!holeAdminApp().auth().currentUser;
    } catch (e) {
      return false;
    }
  }

  /**
   * Meldet die isolierte Admin-Sitzung wieder ab. Kein "zurück zu anonym"
   * mehr nötig — die normale Sitzung wurde ja nie verändert.
   */
  async function adminReauthEnde() {
    return holeAdminApp().auth().signOut();
  }

  /**
   * Nur prüfen, ob unter Vorname+Geburtsdatum(+Zusatz) bereits ein Konto
   * existiert — legt noch nichts an, fragt noch keinen PIN ab. Erster
   * Schritt jeder Registrierung/Anmeldung.
   */
  async function pruefeKonto(db, vorname, geburtsdatum, zusatz) {
    var schluessel = berechneSchluessel(vorname, geburtsdatum, zusatz);
    var snap = await db.collection('bos_accounts').doc(schluessel).get();
    return { id: schluessel, existiert: snap.exists };
  }

  /**
   * Legt ein neues Grundkonto an. PIN ist Pflicht — ohne ihn könnte auf
   * einem neuen Gerät jeder mit Vorname+Geburtsdatum dieses Konto über-
   * nehmen (die Zwischensilbe schützt nicht davor, sie wird von der App
   * automatisch für jede Eingabe mit angehängt, nicht nur für die echte
   * Person). zusatz nur beim Kollisionsfall setzen (siehe pruefeKonto).
   */
  async function registriereNeu(db, vorname, geburtsdatum, pin, zusatz) {
    if (!pin) throw new Error('BOS_ACCOUNTS: PIN ist Pflicht bei der Registrierung.');
    var schluessel = berechneSchluessel(vorname, geburtsdatum, zusatz);
    var ref = db.collection('bos_accounts').doc(schluessel);
    var snap = await ref.get();
    if (snap.exists) {
      throw new Error('BOS_ACCOUNTS: Konto existiert bereits — pruefeKonto() vorher prüfen, registriereNeu() nicht für bestehende Konten aufrufen.');
    }
    var neuesKonto = {
      name: String(vorname).trim(),
      geburtsdatum: geburtsdatum,
      pin: String(pin),
      role: null,
      overrides: {},
      erstelltAm: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(neuesKonto);
    return { id: schluessel, daten: neuesKonto };
  }

  /**
   * Anmeldung an einem bestehenden Konto (v. a. neues Gerät). Gibt bei
   * falschem PIN { falscherPin: true } zurück statt eines Fehlers, damit
   * der Aufrufer sauber zwischen "existiert nicht" (siehe pruefeKonto)
   * und "existiert, aber falscher PIN — evtl. andere Person mit gleichem
   * Namen+Geburtsdatum" unterscheiden kann.
   */
  async function loginMitPin(db, schluessel, pin) {
    var snap = await db.collection('bos_accounts').doc(schluessel).get();
    if (!snap.exists) return null;
    var daten = snap.data();
    if (String(daten.pin) !== String(pin)) {
      return { falscherPin: true };
    }
    return { id: schluessel, daten: daten };
  }

  /** Frischer Rollen-/Override-Stand bei jedem Start — Freischaltung wirkt sofort. */
  async function ladeKonto(db, schluessel) {
    var snap = await db.collection('bos_accounts').doc(schluessel).get();
    return snap.exists ? snap.data() : null;
  }

  /** Admin-Funktion. Vorher adminReauth(passwort) aufrufen, sonst blockt die Security Rule. Schreibt über die isolierte Admin-App, nicht über die geteilte Sitzung (db-Parameter bleibt aus Kompatibilität, wird intern nicht mehr genutzt). */
  /**
   * Legt ein Konto-Dokument an — der Weg ab der Kontenumstellung vom
   * 17.09.2026. Anders als registriereNeu():
   *   - Die Dokument-ID IST die Kennung (kein berechneter Schlüssel mehr).
   *     Karte, Firebase-Adresse und Dokument-ID sind damit dasselbe; es
   *     gibt nichts mehr, was auseinanderlaufen könnte.
   *   - Rolle wird gleich mitgesetzt, weil Ulf anlegt und nicht der Nutzer.
   *   - Kein PIN, kein Geburtsdatum — beide gehören zum alten Weg.
   * Läuft über die Admin-Instanz, wie jede andere schreibende Aktion hier.
   * adminReauth() muss vorher gelaufen sein.
   *
   * @param {string} kennung  'backstube01' oder 'backstube01@baeckereios.intern'
   * @param {string} name     Ulfs Notiz, wer das ist ('Jörg')
   * @param {string|null} rolle  Rollen-ID oder null
   */
  async function legeKontoAn(db, kennung, name, rolle) {
    var schluessel = String(kennung || '').trim().toLowerCase().split('@')[0];
    if (!schluessel) {
      throw new Error('BOS_ACCOUNTS: Kennung fehlt.');
    }
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(schluessel)) {
      throw new Error('BOS_ACCOUNTS: Kennung "' + schluessel + '" enthält unerlaubte Zeichen. Erlaubt sind Kleinbuchstaben, Ziffern, Punkt, Bindestrich und Unterstrich.');
    }
    var adminDb = holeAdminApp().firestore();
    var ref = adminDb.collection('bos_accounts').doc(schluessel);
    var snap = await ref.get();
    if (snap.exists) {
      throw new Error('BOS_ACCOUNTS: Es gibt bereits ein Konto mit der Kennung "' + schluessel + '".');
    }
    var neuesKonto = {
      name: String(name || '').trim() || schluessel,
      role: rolle || null,
      overrides: {},
      erstelltAm: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(neuesKonto);
    return { id: schluessel, daten: neuesKonto };
  }

  async function setzeRolle(db, schluessel, rolle) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ role: rolle });
  }

  /** Admin-Funktion, vorher adminReauth(passwort). wert=null löscht den Override wieder (zurück auf Rollen-Standard). Schreibt über die isolierte Admin-App. */
  async function setzeOverride(db, schluessel, satellitId, wert) {
    var adminDb = holeAdminApp().firestore();
    var feld = 'overrides.' + satellitId;
    var update = {};
    update[feld] = (wert === null) ? firebase.firestore.FieldValue.delete() : wert;
    return adminDb.collection('bos_accounts').doc(schluessel).update(update);
  }

  /**
   * NEU (05.09.2026, Taskboard-Feature). Admin-Funktion, vorher
   * adminReauth(passwort) — sonst blockt die Security Rule (taskboardAbhaken
   * steht in derselben geschützten Feldliste wie role/overrides/pin).
   * Eigenes, einzelnes Feld statt Wiederverwendung von overrides, weil es
   * keine Satelliten-Zugriffsentscheidung ist, sondern eine Aktions-
   * Berechtigung innerhalb eines für alle offenen Popups (siehe
   * SESSION_2026-09-05_AUFGABEN_TASKBOARD_KONZEPT.md, Abschnitt
   * "Berechtigung Abhaken").
   */
  async function setzeTaskboardRecht(db, schluessel, wert) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ taskboardAbhaken: !!wert });
  }

  /**
   * NEU (28.09.2026, Teigecke Stufe 1). Admin-Funktion, vorher
   * adminReauth(passwort). Setzt den Haken „Teigecke pflegen“: wer ihn hat,
   * darf Orte, Zutaten und Teige der Teigecke ändern. Einzelne Personen,
   * nicht Rollen (Ulf: „nur ich oder ausgesuchte Leute“ — Zutaten sollen
   * feste Orte haben). Anders als beim Taskboard-Haken prüft hier die
   * Firestore-Regel serverseitig (darfTeigeckePflegen(), RK §10) — der
   * Haken ist das Schloss, nicht nur Bedienung. Schreiben darf ihn nur der
   * Generalschlüssel (Regel bos_accounts: update nur istAdmin()).
   */
  async function setzeTeigeckePflegeRecht(db, schluessel, wert) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ teigeckePflege: !!wert });
  }
  /**
   * NEU (29.09.2026, Teigecke Stufe 2). Admin-Funktionen wie oben. „Teige
   * pflegen“ = Wasserregel, Wassertemperatur-/Hefe-Tabelle, Einwaage-Stamm-
   * werte, Kessel-Höchstmenge, Kesselrest-Vorgabe, Abwiegefolge. „Rezepte
   * pflegen“ = Zutatenliste je Teig, Vorstufe, Sauer/Hefe/Vorstufe je kg
   * (faktisch nur Ulf). Die Regel prüft beide serverseitig (RK §11).
   */
  async function setzeTeigeckeTeigeRecht(db, schluessel, wert) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ teigeckeTeige: !!wert });
  }
  async function setzeTeigeckeRezepteRecht(db, schluessel, wert) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ teigeckeRezepte: !!wert });
  }

  /**
   * NEU (10.10.2026, Reparaturanfrage Stufe 1). Admin-Funktionen wie die
   * Teigecke-Setzer. Haken je Person, nicht nach Rolle (Ulf, 10.10.: „wer ist
   * vertrauenswürdig genug“). Die Regel prüft alle drei serverseitig
   * (reparaturHaken(), RK §20). Jeder der drei öffnet die Kachel.
   */
  async function setzeReparaturLesenRecht(db, schluessel, wert) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ reparaturLesen: !!wert });
  }
  async function setzeReparaturMeldenRecht(db, schluessel, wert) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ reparaturMelden: !!wert });
  }
  async function setzeReparaturBearbeitenRecht(db, schluessel, wert) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).update({ reparaturBearbeiten: !!wert });
  }

  /** Admin-Funktion, vorher adminReauth(passwort). Löscht das Konto unwiderruflich — kein Zurückholen. Schreibt über die isolierte Admin-App. */
  async function loescheKonto(db, schluessel) {
    return holeAdminApp().firestore().collection('bos_accounts').doc(schluessel).delete();
  }

  /**
   * NEU (04.09.2026, für verbrauch_werkstatt.html): gibt die Firestore-
   * Instanz der isolierten bos-admin-App zurück — dieselbe, die
   * setzeRolle()/setzeOverride()/loescheKonto() intern schon nutzen.
   * Zweck: jedes weitere Admin-Werkzeug, das nach adminReauth(passwort)
   * echte Schreibzugriffe außerhalb von bos_accounts braucht (hier:
   * bos_events-Dokumente bearbeiten/löschen), bekommt darüber dieselbe
   * eine, geprüfte Instanz statt holeAdminApp() anderswo zu duplizieren —
   * "eine Mechanik, mehrere Aufrufer". Nur sinnvoll nutzbar NACH
   * erfolgreichem adminReauth(passwort), sonst blockt die Security Rule
   * (bzw. aktuell, siehe bos_firebase_config.js: kein Unterschied zur
   * geteilten anonymen Sitzung, solange dafür keine eigene Firestore-Rule
   * existiert — siehe Hinweis dazu in VERBRAUCH_WERKSTATT_DOKU.md).
   */
  function adminFirestore() {
    return holeAdminApp().firestore();
  }

  /**
   * Alle Konten. SEIT 26.09.2026 nur noch mit der Admin-Sitzung lesbar
   * (Regel: list nur istAdmin()) — Aufrufer übergeben adminFirestore(),
   * nicht window.db. Mit window.db scheitert die Abfrage mit
   * permission-denied, auch für Konten mit der Rolle admin.
   */
  async function ladeAlleKonten(db) {
    var snap = await db.collection('bos_accounts').get();
    var ergebnis = [];
    snap.forEach(function (doc) {
      ergebnis.push(Object.assign({ id: doc.id }, doc.data()));
    });
    return ergebnis;
  }

  return {
    pruefeKonto: pruefeKonto,
    registriereNeu: registriereNeu,
    loginMitPin: loginMitPin,
    ladeKonto: ladeKonto,
    legeKontoAn: legeKontoAn,
    setzeRolle: setzeRolle,
    setzeOverride: setzeOverride,
    setzeTaskboardRecht: setzeTaskboardRecht,
    setzeTeigeckePflegeRecht: setzeTeigeckePflegeRecht,
    setzeTeigeckeTeigeRecht: setzeTeigeckeTeigeRecht,
    setzeTeigeckeRezepteRecht: setzeTeigeckeRezepteRecht,
    setzeReparaturLesenRecht: setzeReparaturLesenRecht,
    setzeReparaturMeldenRecht: setzeReparaturMeldenRecht,
    setzeReparaturBearbeitenRecht: setzeReparaturBearbeitenRecht,
    loescheKonto: loescheKonto,
    ladeAlleKonten: ladeAlleKonten,
    adminReauth: adminReauth,
    adminReauthEnde: adminReauthEnde,
    adminAngemeldet: adminAngemeldet,
    adminFirestore: adminFirestore
  };
})();
