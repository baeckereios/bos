/* ================================================================
   BäckereiOS · Satellite — App-Registry
   ================================================================
   Neuen Satelliten andocken = hier einen Eintrag hinzufügen.
   Der Launcher-Code selbst wird dafür NICHT angefasst.

   Das spiegelt das Mechanik-/Bedeutungs-Schicht-Prinzip aus dem
   Fundament-Dokument: der Launcher weiß nur "hier ist eine Liste
   von Kacheln", nicht was jede einzelne App inhaltlich tut.

   Felder je App:
     id     — eindeutiger, stabiler Schlüssel (wie legacyKey: NIE
              umbenennen, sonst verliert der Nutzer seine lokale
              Sortierung/Anpassungen für diese Kachel)
     name   — Anzeigename auf der Kachel
     icon   — Emoji als Platzhalter fürs Icon (später ggf. Asset)
     color  — Akzentfarbe der Kachel (Hex)
     url    — relativer Pfad zur App-Seite, die im Fenster geöffnet
              wird. null = noch nicht gebaut → Kachel ist sichtbar,
              aber öffnet nur einen Platzhalter ("geplant")
     status — 'live' | 'geplant' | 'system'
     type   — optional. 'hub' = öffnet keine App, sondern eine
              Zwischenseite mit mehreren verwandten Aktionen als
              gleichrangige Kacheln (wie der OpenOffice-Startbildschirm:
              Text/Tabelle/Präsentation nebeneinander). 'system' = Kern-
              Funktion des Launchers selbst (z.B. Einstellungen), kein
              externer Satellit. Fehlt das Feld → normale App-Kachel.
     hub    — optional. Verweist auf die id einer Hub-Kachel. Diese
              Kachel erscheint dann NICHT auf dem Hauptbildschirm,
              sondern nur innerhalb dieses Hubs. Kein Sonderbau pro
              Hub — jede Hub-Kachel sammelt einfach alle Einträge mit
              passendem hub-Wert automatisch ein.
     roles  — welche Rollen (siehe bos_launcher_roles.js) diese
              Kachel sehen dürfen. Fehlt das Feld komplett → für
              ALLE Rollen sichtbar. Rollen-Definitionen selbst
              stehen bewusst NICHT hier, sondern in der eigenen
              Datei — gleiche Trennung wie Stammdaten/Verlauf.
              Bei Hub-Kindern zusätzlich zur eigenen Rolle auch von
              der roles-Angabe der Hub-Kachel selbst abhängig (die
              muss mindestens sichtbar sein, damit man reinkommt).
     pinned — NEU (02.09.2026, siehe BACKSTORE_DOKU.md). optional,
              Standard false. true = Kachel ist immer auf dem Desktop
              vorhanden, unabhängig vom BackStore-Install/Deinstall-
              Zustand (profileData.installed) — aktuell nur beim
              BackStore selbst gesetzt. Betrifft NUR launcher.html/
              renderGrid(), keine Zugriffsprüfung (die läuft weiter
              separat über roles/BOS_ACCESS.can()).
     bereich — NEU (05.09.2026, siehe SESSION_2026-09-05_KONTEN_ROLLEN_
              KARTE_KONZEPT.md). Nur bei Satelliten mit roles-Feld
              gepflegt (reine Anzeige-Gruppierung, keine Zugriffs-
              wirkung). Gruppiert die Rechte-Ansicht in konten_
              verwaltung.html (Konto-Karte, Tab "Zugriffe", und Rollen-
              Karte, Tab "Rechte") — vorher eine ungegliederte Liste
              aller gatedApps. Werte: 'verwaltung' | 'produktion' |
              'verbrauch' | 'vertrieb_filiale' | 'allgemein'. Fehlt
              das Feld bei einem gated Satelliten, landet er sichtbar
              unter "Sonstiges" statt zu verschwinden (siehe BEREICHE
              in konten_verwaltung.html) — gleiches Fail-visible-Prinzip
              wie bei ladeGatedApps().
     direkt — NEU (03.10.2026, 14:47, siehe nfc_qr/NFC_QR_ZENTRALE_DOKU.md).
              optional. Sagt, ob die Seite einen QR-Code oder NFC-Chip
              bekommen darf, also ohne Launcher direkt aufrufbar ist.
              Werte: 'anmeldung' = die Seite bindet bos_standalone_login.js
              ein (Scannen, Anmeldetür, zurück zur Seite). 'offen' = keine
              Rollen, keine Datenbank, die Seite läuft allein und ohne
              Anmeldung (Taschenrechner, Schnelldruck, Stempeluhr).
              Fehlt das Feld → nicht direkt aufrufbar; die NFC-/QR-Zentrale
              zeigt die Seite dann ausgegraut mit Grund.
              ZWEI WÄCHTER in test_nfc_qr.js: (1) Feld und Seite müssen
              zusammenpassen. (2) Jede Adresse mit direkt steht in
              bos_code_adressen.json. Wer url oder id einer solchen Seite
              ändert, macht den Test rot — die Adresse darf auf Schildern
              und Chips stehen. Schon gedruckt: alte Adresse stehen lassen
              und weiterleiten. Noch nichts aufgehängt: Datei anpassen.
     haken  — NEU (10.10.2026, Reparaturanfrage). optional. Liste von
              Feldnamen im Konto-Dokument (bos_accounts), z. B.
              ['reparaturLesen', 'reparaturMelden', 'reparaturBearbeiten'].
              Ist das Feld gesetzt, entscheidet bos_access.js NICHT über die
              Rollen-Matrix, sondern darüber, ob das Konto einen dieser Haken
              trägt (Profilfeld kontoHaken). Ein solcher Eintrag braucht
              weder roles noch eine Zeile in bos_permissions.js und fällt
              nie auf offen zurück. Er erscheint deshalb auch nicht im
              Reiter „Zugriffe“ der Kontenverwaltung — die Haken stehen dort
              in den Stammdaten. Die Datenbank-Regel muss dieselben Haken
              prüfen, sonst ist die Kachel ein Schild ohne Schloss.
   ================================================================ */

window.BOS_APPS = [
  {
    id: 'settings',
    bereich: 'verwaltung',
    name: 'Einstellungen',
    icon: '⚙️',
    color: '#8b5cf6',
    url: null,
    status: 'system',
    type: 'system',
    roles: ['admin']
  },
  {
    id: 'freezer',
    bereich: 'produktion',
    name: 'Froster',
    icon: '❄️',
    color: '#4a8fd6',
    url: null,
    status: 'live',
    type: 'hub',
    roles: ['admin', 'backstube', 'konditorei']
  },
  {
    id: 'freezer_inventur',
    bereich: 'produktion',
    name: 'Inventur zählen',
    icon: '🧮',
    color: '#4a8fd6',
    url: 'froster/froster_inventur.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'freezer',
    roles: ['admin', 'backstube', 'konditorei']
  },
  {
    id: 'freezer_produktion',
    bereich: 'produktion',
    name: 'Neue Produktion eintragen',
    icon: '➕',
    color: '#4a8fd6',
    url: 'froster/froster_produktion.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'freezer',
    roles: ['admin', 'backstube', 'konditorei']
    // NEU 05.09.2026: von 'geplant' auf 'live' gesetzt, siehe
    // SESSION_2026-09-03_FROSTER_PRODUKTION_ZIEL_KONZEPT.md §1 und
    // froster_produktion.html-Kopfkommentar. Rollen von nur ['admin']
    // (Platzhalter-Stand) auf dieselben Werte wie 'freezer_inventur'
    // erweitert, da dieselbe Zielgruppe (Backstube/Konditorei) die Seite
    // tatsächlich bedienen soll. Bekannte Rollen-Namen-Drift
    // ('backstube'/'konditorei' vs. echte bos_launcher_roles.js-Werte
    // 'baecker'/'konditor', siehe BOS_ABHAENGIGKEITEN.md §2.2) hier
    // unverändert übernommen wie beim Nachbarn — nicht in dieser Session
    // behoben.
  },
  {
    id: 'freezer_ziele',
    bereich: 'produktion',
    name: 'Ziele',
    icon: '🎯',
    color: '#4a8fd6',
    url: 'froster/ziele.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'freezer',
    roles: ['admin', 'backstube', 'konditorei']
    // NEU 05.09.2026: rein lesende Fortschritts-Ansicht, siehe
    // SESSION_2026-09-05_ZIELE_BUILD.md. Kein Platzhalter-Vorlauf wie
    // bei freezer_produktion — direkt live angelegt, da diese Session
    // sie vollständig baut. Gleiche Rollen-Drift-Anmerkung wie bei den
    // Nachbarn in diesem Hub.
  },
  {
    id: 'teigecke',
    bereich: 'produktion',
    name: 'Teigecke',
    icon: '🥣',
    color: '#8b5a2b',
    url: null,
    status: 'live',
    type: 'hub',
    roles: ['admin', 'backstube', 'produktionsleitung']
    // NEU 03.10.2026, Hub „Teigecke“ (Muster Druckzentrale). Kinder:
    // teigecke_nacht, teigecke_orte, teigecke_rezepte (seit 08.10.2026).
    // Siehe SESSION_2026-10-03_TEIGECKE_ORTE_HUB_BAU.md. Rollen = die der
    // bisherigen Einzelkachel „Teigecke Nacht“.
  },
  {
    id: 'teigecke_nacht',
    bereich: 'produktion',
    name: 'Teigecke Nacht',
    icon: '🛒',
    color: '#8b5a2b',
    url: 'teigecke/teigecke_nacht.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'teigecke',
    roles: ['admin', 'backstube', 'produktionsleitung']
    // NEU 28.09.2026 (10:33), Teigecke Stufe 1 — Wagen & Zuhause, siehe
    // SESSION_2026-09-28_TEIGECKEN_STUFE1_BAU.md. Standalone-Satellit
    // (bos_standalone_login.js), direkt aufrufbar am Gerät in der Teigecke.
    // Rollen hier = Sichtbarkeit der Kachel; bos_permissions.js hat dieselben
    // drei Einträge. Schreiben regelt NICHT die Rolle, sondern die Haken
    // im Konto (Firestore-Regel, RK §10/§11).
    // 03.10.2026: Kind des Hubs „teigecke“ (hub: 'teigecke') — die Kachel
    // steht nicht mehr im Hauptraster, sondern im Hub. Adresse unverändert.
  },
  {
    id: 'teigecke_orte',
    bereich: 'produktion',
    name: 'Orte',
    icon: '🧺',
    color: '#8b5a2b',
    url: 'teigecke/teigecke_orte.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'teigecke',
    roles: ['admin', 'backstube', 'produktionsleitung']
    // NEU 03.10.2026: Orte, Zutaten und Schilder der Teigecke (vorher Reiter
    // „Orte“ der Nachtseite). Standalone-Satellit, direkt aufrufbar, auch
    // über den QR-Code der Schilder (…/teigecke_orte.html?ort=B01).
    // Lesen: jeder mit Konto. Schreiben: Haken teigeckePflege (RK §10/§14).
    // Details: teigecke/TEIGECKE_ORTE_DOKU.md.
  },
  {
    id: 'teigecke_rezepte',
    bereich: 'produktion',
    name: 'Teige & Rezepte',
    icon: '📜',
    color: '#8b5a2b',
    url: 'teigecke/teigecke_rezepte.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'teigecke',
    roles: ['admin', 'backstube', 'produktionsleitung']
    // NEU 08.10.2026 (Teigecke Etappe 2, Schub 2): Teige anlegen und Rezepte
    // über eine Anlege-Strecke eintippen (vorher Teig-Formular der Nachtseite).
    // Rollen = Sichtbarkeit der Kachel, dieselben drei wie die Geschwister.
    // Lesen: jeder mit Konto. Schreiben: Haken teigeckeRezepte (Rezept und
    // Rezeptmengen), teigeckeTeige (Einwaagen), teigeckePflege (neue Zutat);
    // Brote umhängen (Feld ausTeig) nur Rolle admin (RK §16, §18). Die
    // Registry kennt keine Haken: den Stift zeigt die Seite selbst nur mit
    // Haken (Bauplan F13). Details: teigecke/TEIGECKE_REZEPTE_DOKU.md.
  },
  {
    id: 'fahrer',
    bereich: 'vertrieb_filiale',
    name: 'Fahrer-App',
    icon: '🚚',
    color: '#c07a10',
    url: null,
    status: 'geplant',
    roles: ['admin', 'fahrer']
  },
  {
    id: 'verkauf',
    bereich: 'vertrieb_filiale',
    name: 'Filial-Bestellung',
    icon: '🧾',
    color: '#4caf7d',
    url: null,
    status: 'geplant',
    roles: ['admin', 'verkauf']
  },
  {
    id: 'kommissionierung',
    bereich: 'vertrieb_filiale',
    name: 'Kommissionierung',
    icon: '📦',
    color: '#d6584a',
    url: null,
    status: 'geplant',
    roles: ['admin', 'kommissionierung']
  },
  {
    id: 'produkt_config',
    bereich: 'verwaltung',
    name: 'Produkt-Config',
    icon: '🗂️',
    color: '#8b5cf6',
    url: null,
    status: 'live',
    type: 'hub',
    roles: ['admin']
  },
  {
    id: 'produkt_config_editor',
    bereich: 'verwaltung',
    name: 'Bearbeiten',
    icon: '✎',
    color: '#8b5cf6',
    url: 'produkt_config/produkt_config_editor.html',
    status: 'live',
    hub: 'produkt_config',
    roles: ['admin']
  },
  {
    id: 'produkt_config_sync',
    bereich: 'verwaltung',
    name: 'Import / Export',
    icon: '🔄',
    color: '#8b5cf6',
    url: 'produkt_config/produkt_config_sync.html',
    status: 'live',
    hub: 'produkt_config',
    roles: ['admin']
  },
  {
    id: 'verbrauch_einstellungen_editor',
    bereich: 'verbrauch',
    name: 'Verbrauch-Einstellungen',
    icon: '🎚️',
    color: '#8b5cf6',
    url: 'verbrauch_einstellungen/verbrauch_einstellungen_editor.html',
    status: 'live',
    roles: ['admin']
  },
  {
    id: 'verbrauch_manuell',
    bereich: 'verbrauch',
    name: 'Verbrauch (manuell)',
    icon: '📝',
    color: '#c07a10',
    url: 'verbrauch/verbrauch_manuell.html',
    direkt: 'anmeldung',
    status: 'live',
    roles: ['backstube', 'konditorei', 'produktionsleitung', 'admin']
  },
  {
    id: 'verbrauch_werkstatt',
    bereich: 'verbrauch',
    name: 'Verbrauch-Werkstatt',
    icon: '🛠️',
    color: '#8b5cf6',
    url: 'verbrauch/verbrauch_werkstatt.html',
    status: 'live',
    roles: ['admin']
    // NEU 04.09.2026. Admin-Werkzeug zum Ansehen/Korrigieren/Löschen
    // einzelner bos_events-Dokumente — aktuell nur type: 'verbrauch_manuell',
    // bewusst als Parameter im Code gebaut (Ulf-Entscheidung 04.09.2026: Weg
    // zu 'verbrauch_offiziell' offen halten, ohne ihn jetzt schon zu bauen —
    // dafür gibt es noch keinen laufenden Import). Lila wie die anderen
    // Admin-/System-Werkzeuge (produkt_config_editor, konten_verwaltung).
    // Rollen-Guard hier ist nur Fumbling-Schutz — WICHTIG: bos_permissions.js
    // braucht "verbrauch_werkstatt: true" im admin-Block, sonst fail-open für
    // JEDE Rolle (siehe VERBRAUCH_WERKSTATT_DOKU.md). Bearbeiten/Löschen
    // selbst läuft über adminReauth(Passwort), nicht über den Seiten-PIN.
  },
  {
    id: 'zeitkontext_editor',
    bereich: 'produktion',
    name: 'Zeitkontext & Hamster',
    icon: '🐹',
    color: '#8b5cf6',
    url: 'zeitkontext/zeitkontext_editor.html',
    status: 'live',
    roles: ['backstube', 'konditorei', 'produktionsleitung', 'admin']
  },
  {
    id: 'wunschtag',
    // NEU 10.09.2026, siehe SESSION_2026-09-10_WUNSCHTAG_MELDER.md und
    // WUNSCHTAG_DOKU.md. Erster eigenständiger Satellit im SchichtPlaner-V2-
    // Aufbau — Melder für unverbindliche Wunschfreie Tage (Konzept-Doku §11/§19).
    // bereich bewusst 'allgemein' statt 'produktion': Personal-Selfservice,
    // keine Produktionszahl — rein kosmetische Gruppierung, jederzeit änderbar.
    bereich: 'allgemein',
    name: 'Wunschtag',
    icon: '🗓️',
    color: '#c07a10',
    url: 'wunschtag/wunschtag.html',
    direkt: 'anmeldung',
    status: 'live',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'urlaub_anfrage',
    // NEU 12.09.2026, siehe SESSION_2026-09-12_URLAUB_ANFRAGE.md. Zweiter
    // eigenständiger Selfservice-Satellit neben Wunschtag — Urlaub ist ein
    // echter arbeitsrechtlicher Vorgang (Ulf), deshalb eigenes Formular mit
    // Zeitraum statt Einzeltag und ausdrücklich wiederholter
    // Unverbindlichkeits-Formulierung, keine Ampel/Zähler wie bei
    // Wunschtag. Getrennter Bereich von schichtplaner_abwesenheiten (das
    // ist der bestätigte Zustand) — Verknüpfung dort über "Übernehmen".
    bereich: 'allgemein',
    name: 'Urlaub beantragen',
    icon: '🏖️',
    color: '#c07a10',
    url: 'urlaub/urlaub_anfrage.html',
    direkt: 'anmeldung',
    status: 'live',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'mein_konto',
    // NEU 12.09.2026, siehe SESSION_2026-09-12_MEIN_KONTO.md. Dritter
    // eigenständiger Selfservice-Satellit — personalisierte Ansicht des
    // Ausgleichskontos (siehe AUSGLEICHSKONTO_DOKU.md), über den
    // bestehenden Konto-Login statt der Hub-Kachel bankkonto.html, die
    // dafür technisch keine Personen-Verknüpfung hat. Ulf: die Zahlen
    // sind "irgendwie vertrauliche Daten... nicht vor den Augen der
    // Kollegen" -- dieser Weg zeigt jeder Person NUR die eigenen.
    bereich: 'allgemein',
    name: 'Mein Konto',
    icon: '💳',
    color: '#c07a10',
    url: 'mein_konto/mein_konto.html',
    direkt: 'anmeldung',
    status: 'live',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'reparaturanfrage',
    // NEU 10.10.2026, Reparaturanfrage Stufe 1. Kaputtes melden, der
    // Hausmeister setzt gesehen/repariert, kurzer Chat darunter.
    // KEIN roles-Feld und KEINE Zeile in bos_permissions.js: die Kachel hängt
    // am Feld haken — trägt das Konto einen dieser Haken, ist sie da, sonst
    // nicht (bos_access.js, nie fail-open). Die Datenbank prüft dieselben
    // Haken (RK §20). Haken setzt Ulf je Person in der Kontenverwaltung.
    // Details: reparaturanfrage/REPARATURANFRAGE_DOKU.md.
    bereich: 'allgemein',
    name: 'Reparaturanfrage',
    icon: '🔧',
    color: '#5b7c99',
    url: 'reparaturanfrage/reparaturanfrage.html',
    direkt: 'anmeldung',
    status: 'live',
    haken: ['reparaturLesen', 'reparaturMelden', 'reparaturBearbeiten']
  },
  {
    id: 'konten_verwaltung',
    bereich: 'verwaltung',
    name: 'Konten & Rollen',
    icon: '🔑',
    color: '#8b5cf6',
    url: 'konten/konten_verwaltung.html',
    status: 'live',
    roles: ['admin']
  },
  {
    id: 'nfc_qr_zentrale',
    bereich: 'verwaltung',
    name: 'NFC & QR',
    icon: '📡',
    color: '#8b5cf6',
    url: 'nfc_qr/nfc_qr_zentrale.html',
    direkt: 'anmeldung',
    status: 'live',
    roles: ['admin']
    // NEU 03.10.2026 (14:47). NFC-/QR-Zentrale, Stufe 1: Liste aller Ziele
    // aus dieser Registry, Adresse, Chip beschreiben/prüfen, Einzelschild.
    // Lila wie die anderen Admin-Werkzeuge. Kein Firestore-Zugriff.
    // WICHTIG: bos_permissions.js braucht "nfc_qr_zentrale: true" im
    // admin-Block, sonst fail-open für JEDE Rolle. Direkt aufrufbar
    // (bos_standalone_login.js), weil Chips nur im eigenen Fenster gehen,
    // nicht im eingebetteten Fenster des Launchers.
    // Siehe nfc_qr/NFC_QR_ZENTRALE_DOKU.md.
  },
  {
    id: 'aufgaben_verwaltung',
    bereich: 'allgemein',
    name: 'Aufgaben',
    icon: '🗒️',
    color: '#c07a10',
    url: 'aufgaben/aufgaben_verwaltung.html',
    status: 'live',
    roles: ['admin', 'produktionsleitung']
    // NEU 05.09.2026. Tagesaufgaben-Verwaltung, siehe SESSION_2026-09-05_
    // AUFGABEN_TASKBOARD_KONZEPT.md. Zweite bewusste Ausnahme vom Append-
    // only-Prinzip nach verbrauch_werkstatt (editiert/löscht bestehende
    // bos_events-Dokumente, type: 'produktionsleiter_aufgabe'). Bewusst
    // KEIN zweiter PIN-Layer wie bei den lila Admin-Werkzeugen — Ulf-
    // Entscheidung 05.09.2026, Rollenprüfung reicht (mit vollem Wissen,
    // dass das serverseitig nicht härter durchsetzbar ist als beim Rest
    // des Systems, siehe bos_accounts.js-Kopfkommentar). Amber statt Lila,
    // weil produktionsleitung hier schreibt, nicht nur admin.
  },
  {
    id: 'schnellrechner',
    bereich: 'allgemein',
    name: 'Schnellrechner',
    icon: '🔢',
    color: '#c07a10',
    url: 'schnellrechner/schnellrechner.html',
    status: 'live',
    roles: ['backstube', 'konditorei', 'produktionsleitung', 'admin']
  },
  {
    id: 'taschenrechner',
    name: 'Taschenrechner',
    icon: '➗',
    // GEÄNDERT 05.09.2026: war '🖩' (Pocket Calculator, U+1F5A9) — dieses
    // Zeichen hat kein erzwungenes Farb-Emoji-Presentation (kein U+FE0F im
    // Registry-Wert), viele Fonts zeigen es deshalb nur als mageres
    // Text-Icon statt echtem Symbol. '➗' ist seit Unicode 6.0 verlässlich
    // farbig, auch über Blobmoji (siehe SESSION_2026-09-05_BLOBMOJI.md).
    color: '#4a8fd6',
    url: 'taschenrechner/taschenrechner.html',
    direkt: 'offen',
    status: 'live'
    // Bewusst KEIN roles-Feld: allgemeines Werkzeug, für alle Konten
    // sofort sichtbar (auch vor Rollenzuteilung) — siehe
    // BOS_ACCOUNTS_DOKU.md, wo der Taschenrechner im Nutzer-Hilfetext
    // bereits als Beispiel dafür genannt wird. Kein Eintrag in
    // bos_permissions.js nötig: laut bos_access.js (Stand 31.08.2026)
    // fail-open für jeden dort nicht gelisteten Satelliten.
  },
  {
    id: 'schnelldruck',
    name: 'Schnelldruck',
    icon: '🖨️',
    color: '#c07a10',
    url: 'schnelldruck/schnelldruck.html',
    direkt: 'offen',
    status: 'live'
    // Bewusst KEIN roles-Feld, gleiches Muster wie taschenrechner:
    // allgemeines Werkzeug (Notiz/Checkliste drucken), keine sensiblen
    // Daten, für alle Konten sofort sichtbar. Kein Eintrag in
    // bos_permissions.js nötig — fail-open greift. Entscheidung Ulf,
    // 01.09.2026: "Alle... ist ja nur ne Druck-App".
  },
  {
    id: 'stempeluhr',
    name: 'Stempeluhr',
    icon: '🕐',
    color: '#c07a10',
    url: 'stempeluhr/stempeluhr.html',
    direkt: 'offen',
    status: 'live'
    // NEU 05.09.2026, siehe STEMPELUHR_DOKU.md. Bewusst KEIN roles-Feld,
    // gleiches Muster wie taschenrechner/schnelldruck: rein technisch für
    // alle Konten sichtbar (fail-open, kein bos_permissions.js-Eintrag
    // nötig), obwohl die Seite selbst inhaltlich nur für eine einzelne
    // Person (Ulf) gedacht ist — kein Rollen-/Personen-Konzept im
    // Satelliten, nur localStorage auf dem jeweiligen Gerät.
  },
  {
    id: 'backstore',
    name: 'BackStore',
    icon: '🛍️',
    color: '#4a8fd6',
    url: 'backstore/backstore.html',
    status: 'live',
    pinned: true
    // Bewusst KEIN roles-Feld: wie taschenrechner/schnelldruck offen für
    // alle, auch Grundkonto vor Rollenzuteilung — Entscheidung Ulf,
    // 02.09.2026 ("ich würde den BackStore auch da schon freischalten").
    // Farbe Blau aus demselben Grund wie beim Taschenrechner: "Neutral-
    // Akzent", passt zu einem rollenunabhängigen Werkzeug besser als
    // Amber oder Lila (das ist hier ja quasi das Gegenteil eines
    // Admin-Tools). pinned:true ist NEU, siehe Feld-Doku oben — die
    // Kachel ist immer da, lässt sich nicht über sich selbst deinstallieren.
    // Details zum ganzen Install/Deinstall-Modell: BACKSTORE_DOKU.md.
  },
  {
    id: 'produktionsplaner',
    bereich: 'produktion',
    name: 'Produktionsplaner',
    icon: '📋',
    color: '#c07a10',
    url: null,
    status: 'live',
    type: 'hub',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
    // NEU 03.09.2026. Hub für die Stationsseiten (Rondo, Brötchenstraße,
    // Frühschicht, Nachtschicht) — Wochenplanung pro Station, ersetzt die
    // alten eigenständigen NFC-Seiten. Jede Kind-Kachel bleibt zusätzlich
    // per Direktlink (NFC/QR) eigenständig aufrufbar, siehe
    // bos_standalone_login.js und SESSION_2026-09-03_PRODUKTIONSPLANER_
    // KONZEPT.md. Rollen an zeitkontext_editor/verbrauch_manuell angelehnt.
  },
  {
    id: 'produktionsplaner_uebersicht',
    bereich: 'produktion',
    name: 'Übersicht',
    icon: '📋',
    color: '#c07a10',
    url: 'produktionsplaner/uebersicht.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'produktionsplaner',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'produktionsplaner_rondo',
    bereich: 'produktion',
    name: 'Rondo',
    icon: '🔄',
    color: '#c07a10',
    url: 'produktionsplaner/station_rondo.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'produktionsplaner',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'produktionsplaner_broetchenstrasse',
    bereich: 'produktion',
    name: 'Brötchenstraße',
    icon: '🥐',
    color: '#c07a10',
    url: 'produktionsplaner/station_broetchenstrasse.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'produktionsplaner',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'produktionsplaner_fruehschicht',
    bereich: 'produktion',
    name: 'Frühschicht',
    icon: '🌅',
    color: '#c07a10',
    url: 'produktionsplaner/station_fruehschicht.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'produktionsplaner',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'produktionsplaner_nachtschicht',
    bereich: 'produktion',
    name: 'Nachtschicht',
    icon: '🌙',
    color: '#c07a10',
    url: 'produktionsplaner/station_nachtschicht.html',
    direkt: 'anmeldung',
    status: 'live',
    hub: 'produktionsplaner',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'druckzentrale',
    bereich: 'produktion',
    name: 'Druckzentrale',
    icon: '🗞️',
    color: '#c07a10',
    url: null,
    status: 'live',
    type: 'hub',
    roles: ['admin', 'backstube', 'konditorei']
    // NEU 03.09.2026. Rollen an den Froster-Hub angelehnt — Backstuben-
    // Werkzeug, kein offenes Utility wie Taschenrechner/Schnelldruck.
    // Details: DRUCKZENTRALE_DOKU.md.
  },
  {
    id: 'druckzentrale_fruehschicht',
    bereich: 'produktion',
    name: 'Frühschicht-Formular',
    icon: '🌅',
    color: '#c07a10',
    url: 'druckzentrale/fruehschicht_formular.html',
    status: 'live',
    hub: 'druckzentrale',
    roles: ['admin', 'backstube', 'konditorei']
  },
  {
    id: 'schichtplaner',
    // NEU 10.09.2026, siehe SESSION_2026-09-10_ENTWUERFE_SATELLIT.md und
    // Konzept-Doku SESSION_2026-09-05_SCHICHTPLANER_V2_KONZEPT.md §1.
    // Sechs eigenständige Kacheln statt einer Tab-Seite (Ulfs Vorgabe,
    // 05.09.2026) — nur 'schichtplaner_entwuerfe' ist heute live, der Rest
    // ist bewusster 'geplant'-Platzhalter (kein Vergessen, siehe §12
    // Checkliste). roles hier breit, weil Bankkonto später für alle
    // Mitarbeitenden lesbar sein soll — die planungs-only-Kacheln (Entwürfe,
    // Krankheit/Ausfall, Sonntagsplan) schränken pro Kachel enger ein.
    bereich: 'produktion',
    name: 'SchichtPlaner',
    icon: '📆',
    color: '#c07a10',
    url: null,
    status: 'live',
    type: 'hub',
    roles: ['admin', 'backstube', 'konditorei', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_entwuerfe',
    bereich: 'produktion',
    name: 'Entwürfe',
    icon: '🗓️',
    color: '#c07a10',
    url: 'schichtplaner/entwuerfe.html',
    status: 'live',
    hub: 'schichtplaner',
    // Planungs-Werkzeug, nicht Personal-Selfservice: "nur eine Person
    // macht den Plan" (Ulf, 10.09.2026) — bewusst enger als die Hub-Kachel.
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_personen',
    // NEU 10.09.2026, siehe LOKALE_DATEN_DATENSCHUTZ_DOKU.md und
    // SESSION_2026-09-10_PERSONEN_LOKAL.md. Siebte Kachel, nicht Teil der
    // ursprünglichen Sechser-Planung (§1 Konzept-Doku) — bewusste,
    // dokumentierte Ergänzung: verwaltet Planungsattribute in Firestore,
    // Nachnamen bleiben lokal (bos_lokal_daten.js). Admin-only, kein
    // Personal-Selfservice.
    bereich: 'produktion',
    name: 'Personen',
    icon: '🪪',
    color: '#c07a10',
    url: 'schichtplaner/personen_editor.html',
    status: 'live',
    hub: 'schichtplaner',
    roles: ['admin']
  },
  {
    id: 'schichtplaner_positionen',
    // NEU 10.09.2026, siehe SESSION_2026-09-10_POSITIONEN_FIRESTORE.md.
    // Achte Kachel. Löst das frühere eigenständige Claude-Artefakt ab
    // (window.storage, echte Namen im Quellcode) — jetzt echter Satellit,
    // Firestore Collection 'positionen', Namensauflösung über dieselbe
    // lokale Datei wie Personen (bos_lokal_daten.js, kind 'personen').
    // Ulfs Begründung für Firestore statt Datei: geräteunabhängig
    // weiterarbeiten (USB-Stick mit der lokalen Namensdatei reicht),
    // ein einheitliches Modell statt "mal Datei, mal Firestore".
    bereich: 'produktion',
    name: 'Positionen & Pools',
    icon: '🧩',
    color: '#c07a10',
    url: 'schichtplaner/positionen_editor.html',
    status: 'live',
    hub: 'schichtplaner',
    roles: ['admin']
  },
  {
    id: 'schichtplaner_sonntagsplan',
    // LIVE 12.09.2026, siehe SESSION_2026-09-12_SONNTAGSPLAN.md — erster
    // echter Rechen-Motor-Baustein, nutzt rechenmodul.js direkt und
    // unverändert. Deckt Sonntage UND offene (bearbeitete) Feiertage ab
    // (Ulf: "gleicher Aufbau") sowie die neue Monats-Obergrenze
    // (maxSonntageProMonat).
    bereich: 'produktion',
    name: 'Sonntagsplan',
    icon: '☀️',
    color: '#c07a10',
    url: 'schichtplaner/sonntagsplan.html',
    status: 'live',
    hub: 'schichtplaner',
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_abwesenheiten',
    // UMBENANNT 12.09.2026 (vorher schichtplaner_krankheit_ausfall,
    // status: 'geplant', nie live) — Ulf: ein kombiniertes Werkzeug statt
    // getrennter Krankheit/Ausfall- und Urlaub-Konzepte, siehe
    // SESSION_2026-09-12_ABWESENHEITEN.md. Nur vom Vorgesetzten bedient,
    // keine Selbst-Einreichung durch Kollegen — die zwischenzeitlich
    // erwogene Idee eines eigenen Urlaub-Anfrage-Satelliten ist damit vom
    // Tisch.
    bereich: 'produktion',
    name: 'Krankheit / Ausfall / Urlaub',
    icon: '🤒',
    color: '#c07a10',
    url: 'schichtplaner/abwesenheiten_editor.html',
    status: 'live',
    hub: 'schichtplaner',
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_krankmelder',
    // NEU 12.09.2026, siehe SESSION_2026-09-12_KRANKMELDER.md und
    // SESSION_2026-09-12_KONTO_KRANKMELDER_KONZEPT.md. Baustein 3 des
    // Konzepts — eigener, klar getrennter Einstiegspunkt für den
    // Eilfall "Person hat sich krank gemeldet", eigene Zielfunktion als
    // die normale Wochenplanung. Nur vom Vorgesetzten bedient, wie
    // Abwesenheiten.
    bereich: 'produktion',
    name: 'Krankmelder',
    icon: '🚑',
    color: '#c07a10',
    url: 'schichtplaner/krankmelder.html',
    status: 'live',
    hub: 'schichtplaner',
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_feiertage',
    // NEU 12.09.2026, siehe SESSION_2026-09-12_FEIERTAGE.md. Neunte
    // Hub-Kachel, nicht Teil der ursprünglichen Planung — Ulf: das
    // "Feiertag, an dem trotzdem gearbeitet wird"-Problem ist keine
    // "nebenbei Einstellung" mehr. Baut vollständig auf dem bestehenden
    // bos_zeitkontext.js auf (Firestore > lokal > Referenzdatei-Standard)
    // — KEINE neue Datenwelt, eine Konfiguration gilt auch für Hamster
    // (zeitkontext_editor.html) und umgekehrt.
    bereich: 'produktion',
    name: 'Feiertage',
    icon: '📅',
    color: '#c07a10',
    url: 'schichtplaner/feiertage.html',
    status: 'live',
    hub: 'schichtplaner',
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_offizieller_plan',
    bereich: 'produktion',
    name: 'Offizieller Plan',
    icon: '📋',
    color: '#c07a10',
    url: 'schichtplaner/offizieller_plan.html',
    status: 'live',
    hub: 'schichtplaner',
    // LIVE 12.09.2026, siehe SESSION_2026-09-12_OFFIZIELLER_PLAN.md.
    // EINGESCHRÄNKT 20.09.2026 auf admin/produktionsleitung (Etappe 3.2):
    // Der offizielle Plan ist ein Führungswerkzeug — Gestalten in den
    // Entwürfen, Bestätigen hier. Bis dahin war er für alle sichtbar, und
    // der Rollen-Unterschied lag IN der Seite (localStorage-Rolle): eine
    // Prüfung im Browser, die serverseitig nichts bedeutete.
    // Ausschlaggebend war die neue Leseregel für 'schichtplaner_wunschtag':
    // die Seite fragt beim Laden alle Wünsche der Woche ab, und das darf
    // nur noch die Planung. Für Backstube/Konditorei wäre der Seitenaufbau
    // an dieser Abfrage gescheitert.
    // Der Ersatz für alle anderen ist ein reiner Lese-Satellit, der den
    // bestätigten Plan wiedergibt (siehe Baustellen) — bis dahin bleibt
    // der Aushang der Weg.
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_einstellungen',
    // LIVE 12.09.2026, siehe SESSION_2026-09-12_TABELLE_UND_EINSTELLUNGEN.md.
    // Erste Funktion: eigene Personen-Reihenfolge im Dienstplan (Entwürfe/
    // Tab 2), inklusive Leerzeilen zur optischen Gruppierung.
    bereich: 'produktion',
    name: 'Einstellungen',
    icon: '🎚️',
    color: '#c07a10',
    url: 'schichtplaner/einstellungen.html',
    status: 'live',
    hub: 'schichtplaner',
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'schichtplaner_bankkonto',
    bereich: 'produktion',
    name: 'Bankkonto',
    icon: '💳',
    color: '#c07a10',
    url: 'schichtplaner/bankkonto.html',
    status: 'live',
    hub: 'schichtplaner',
    // GEÄNDERT 12.09.2026, siehe SESSION_2026-09-12_MEIN_KONTO.md: Ulf,
    // "sind ja schon irgendwie vertrauliche Daten... nicht vor den
    // Augen der Kollegen" -- zeigt Saldo/Wochenend-Kombi/Wunschtag-Score
    // ALLER Personen, gehört deshalb nicht vor Kollegen. Jetzt nur noch
    // admin/produktionsleitung (vorher alle vier Rollen). Personalisierte
    // Ansicht dafür jetzt über den eigenständigen Satelliten
    // mein_konto.html (eigener Konto-Login).
    roles: ['admin', 'produktionsleitung']
  },
  {
    id: 'druckzentrale_absetz',
    bereich: 'produktion',
    name: 'Absetz-Formular',
    icon: '📋',
    color: '#c07a10',
    url: 'druckzentrale/absetz_formular.html',
    status: 'live',
    hub: 'druckzentrale',
    roles: ['admin', 'backstube', 'konditorei']
  }
];
