# BOS-V2 — Abhängigkeiten & Verkabelung

**Zweck:** Zentrale Übersicht: Was hängt wovon ab, in welcher Reihenfolge wird geladen, was stellt jede geteilte Datei global bereit, welche Firestore-Sammlung gehört zu welcher Regel. Ein neuer Satellit soll von Anfang an richtig verkabelt sein, ohne dass jemand das Muster aus Erinnerung oder alten Dokus zusammensuchen muss.

**Verhältnis zu `BOS_NEUER_SATELLIT_CHECKLISTE.md`:** Seit 31.08. aufgeteilt statt doppelt gepflegt. Diese Datei ist die **alleinige Quelle** für Ladereihenfolge, globale Schnittstellen, Firestore-Sammlungen samt Regel-Bausteinen und Registry-Felder. Die Checkliste bleibt zuständig für Design, i18n, Hilfe-Slot, Fehleranzeige (§7a), Poka-Yoke, Feld-Glossar, Doku-Pflicht, Changelog-Format und den Vor-Auslieferungs-Check. Vom 22.09. bis heute galt Checkliste §2a vorrangig, weil diese Datei nicht nachgezogen war (`BOS_BAUSTELLEN.md` #32). **Mit dieser Fassung ist sie wieder aktuell;** §2a der Checkliste kann auf hier zurückverweisen.

**Stand:** 26.10.2026, 17:36 Uhr (Zeitabfrage). Nachtrag Nachrichtenzentrale Stufe 1a (§2.5 `bos_kachel_zahlen.js`, Registry-Feld `zaehler`). Davor 15.10.2026, 06:58 Uhr (Geräteabfrage). Nachtrag Richtwert #63 (`bos_produkte.js` v0.5, Sicht `laufend`, drei Produktfelder, Topf `richtwert` im Host, Regel-Fassung `richtwert-2026-10-14`, wartet auf Einspielen). Davor 11.10.2026, 10:21 Uhr: Nachtrag Reparaturanfrage Nachtrag 2 (`bos_meldungen.js` v0.2, Gerätespeicher-Schlüssel). Davor 09:30: Nachtrag #59 „gehört in den Schichtplan“ (`personen.imSchichtplan`, `bos_namen.js`). Davor 10.10.2026, 10:34 Uhr: Nachtrag Reparaturanfrage Stufe 1 (siehe Änderungsprotokoll). Vorher: 08.10.2026, 15:37 Uhr. Vollständige Überarbeitung der Fassung vom 06.09.2026. Seitdem sind dazugekommen: Auth-Umstellung (17.–22.09.), Namens-Fundament (26.09.), SchichtPlaner V2, Online-Gang auf GitHub Pages (04.10.), NFC-/QR-Zentrale (03./04.10.), Produkte nur noch in Firestore (05.–07.10.) und die Teigecke (28.09.–08.10.).

---

## Pflege & Vertrauensbasis

**Pflege:** Bei einer neuen Root-Datei, einem neuen globalen Namespace, einer neuen Firestore-Sammlung, einem neuen Regelblock oder einer neuen Regel zur Ladereihenfolge wird diese Datei im selben Arbeitsgang ergänzt wie der Code.

**Grundlage dieser Fassung (ehrlich benannt):**
- **Prüf-Repo:** Ulfs Projekt-Zip vom 30.09. plus alle Teigecke-Lieferungen bis 08.10., 14:40 (Rezepte Schub 1/2, Nachtrag, Nachtrag Nachtseite). Am Code selbst gesehen: Kopfkommentare, `window.*`-Zuweisungen, `<script src>`-Listen aller 45 Seiten des Prüf-Repos, Rückgabe-Objekte.
- **Eingesetzte Regeldatei** `firestore_regeln_2026-10-08_teigecke_nacht.rules`, vollständig gelesen.
- **Dokus:** `2026-10-04_ONLINE_GANG.md`, `BOS_NEUER_SATELLIT_CHECKLISTE.md` (22.09.), `BOS_BAUSTELLEN.md` (24.09.), `PRODUKTE_KOMPENDIUM.md` (18. Fassung), `REGELN_KOMPENDIUM.md` (12. Fassung), `NFC_QR_ZENTRALE_DOKU.md` (08.10.), Teigecke-Dokus.
- **Nicht** gegen das Online-Repo geprüft. Im Prüf-Repo **fehlen** `bos_produkte.js` und `bos_qr.js`; ihre Zeilen stammen nur aus Dokus (📄). Umgekehrt liegen im Prüf-Repo noch Dateien, die der Online-Gang ausgelagert hat (`bos_pin_config.js`, Tests, Dokus). Wo das eine Rolle spielt, steht es dabei.

**Markierung:**
- ✅ = am Code des Prüf-Repos oder an der eingesetzten Regeldatei selbst gesehen
- 📄 = nur aus einer Doku, Datei selbst nicht eingesehen
- ⚠️ = bekannte Abweichung (Drift) oder am Online-Repo noch zu prüfen

Vor einer neuen Integration im Zweifel die echte Datei anfordern. Der Kopfkommentar der jeweiligen Datei ist maßgeblich, nicht dieser Katalog („nie aus der Erinnerung/Doku heraus bauen, wenn die echte Datei existiert", Checkliste §0).

---

## 0. Das Gerüst in einem Blick

```
Gerät ──► index.html (Tür) ──► Firebase-Anmeldung  kennung@baeckereios.intern + Passwort
              │                    (Selbstregistrierung und anonym: abgeschaltet)
              ├─ bos_konto_profil.js schreibt Profil in localStorage 'bos_launcher_state_v2'
              │     (Rolle, Ausnahmen, freigeschaltet — gelesen aus bos_accounts/<kennung>)
              └─► ?weiter=… zurück zur gewünschten Seite, sonst launcher.html

Jede Seite ──► bos_firebase_config.js: ohne Sitzung → zur Tür (zurTuer), mit ?weiter=
           ──► Zugriff: bos_access_guard.js ODER bos_standalone_login.js (nie beide)
                 beide über bos_access.js → BOS_ACCESS.can(appId, rolle, overrides)
                 Quelle: bos_permissions.js (Rolle × Satellit), Ausnahmen aus dem Konto
           ──► Daten: Firestore. Der echte Schutz sind die Regeln, nicht der Guard.
```

- **Der Guard ist Bedienschutz, keine Sicherheit** (eigener Kopfkommentar von `bos_access_guard.js`). Seit 22.09. gibt es **keinen Auffangblock** mehr in den Regeln: Jede Sammlung ohne eigenen `match`-Block ist für alle gesperrt. ✅
- **Seit 04.10. liegt der Code öffentlich auf GitHub Pages.** Damit sind die Regeln der einzige Schutz (Online-Gang §8). Auf dem Tablet läuft parallel der lokale Server `127.0.0.1:24190`. QR-Codes und NFC-Chips dürfen nur `https`-Adressen tragen (`BOS_QR.darfAusgeben`). 📄
- **Zwei Admin-Stufen, nicht verwechseln:** `hatAdminRolle()` = Rolle admin im Konto-Dokument; das können mehrere Konten haben, heute `backstube02` (Ulfs Alltagskonto) und `systempflege`. `istAdmin()` = **genau eine UID**, der Generalschlüssel `systempflege` (Tresorschlüssel für Konten, Rollen, Zähler). ✅

---

## 1. Ladereihenfolge: normaler Satellit (über den Launcher erreicht)

Referenz am Code: `konten/konten_verwaltung.html` (Z. 168–170, 343–348, 511–517). ✅

### `<head>`

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="robots" content="noindex, nofollow">          <!-- Pflicht seit 04.10. (Online-Gang §3.6) -->
<title>… · BäckereiOS</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- MÜSSEN vor bos_design_tokens.css stehen, sonst blitzt kurz das falsche Aussehen auf -->
<script src="../bos_theme_sync.js"></script>
<script src="../bos_density_sync.js"></script>
<link rel="stylesheet" href="../bos_design_tokens.css">
```

`<html lang="de" data-theme="dark">` als statischer Rückfall; `bos_theme_sync.js` überschreibt ihn beim Laden. Theme-Anbindung ist **Pflicht**, nicht Kür (Checkliste §3, Nachtrag 22.09.).

### `<body>`, ganz am Anfang

```html
<script>var BOS_APP_ID = '…';</script>   <!-- exakt die id aus bos_app_registry.js -->
<script src="../bos_app_registry.js"></script>
<script src="../bos_launcher_profiles.js"></script>
<script src="../bos_permissions.js"></script>
<script src="../bos_access.js"></script>        <!-- Pflicht, VOR dem Einstiegspunkt -->
<script src="../bos_access_guard.js"></script>

<!-- danach Firebase und die übrigen Module, dann der Seiteninhalt -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="../bos_firebase_config.js"></script>
<!-- bei Bedarf: ../bos_launcher_backgrounds.js → ../bos_accounts.js, ../bos_produkte.js usw. -->
```

**Root-Ebene** (z. B. `launcher.html`): gleiche Dateien ohne `../`.

**`bos_access_guard.js` hat keine aufrufbare Funktion.** Er läuft beim Laden selbst, liest das Profil aus `localStorage` und ruft `BOS_ACCESS.can()`. Sperre und Warnstreifen kommen seit 20.09. aus `bos_access.js`; der Guard baut keine eigenen mehr. ✅

**Fail-open, bewusst** (damit ein Ladefehler niemanden aussperrt):
1. `BOS_APP_ID` fehlt oder die Seite steht nicht in der Registry → offen.
2. `BOS_ACCESS` lädt nicht → offen, **mit rotem Notstreifen** (Checkliste §2a).
3. Die Seite steht in keiner Rolle von `bos_permissions.js` → offen, Warnstreifen.

**Die Sperre kennt zwei Fälle:** „Kein Zugriff" (Rolle bekannt, Matrix sagt nein) und „Berechtigung unbekannt" (kein Profil oder keine Rolle, mit „Nochmal versuchen"). Kein Satellit baut eine eigene Sperre. ✅ (Checkliste §2a, `bos_access.js`)

---

## 1a. Ladereihenfolge: direkt aufrufbarer Satellit (NFC, QR, Lesezeichen)

**Wann:** Die Seite soll ohne Launcher-Vorlauf aufrufbar sein, auch auf einem frischen Handy. `bos_standalone_login.js` **ersetzt** dann `bos_access_guard.js`; er läuft nicht zusätzlich davor.

**Was das Modul heute tut (seit 19.09., ✅ Kopfkommentar):** Der eigene Login-Teil ist **stillgelegt**. Liegt ein Profil vor, prüft es den Zugriff wie der Guard (Pfad 1). Liegt keins vor, schickt es zur Tür (`index.html`). Eine eigene Anmeldung baut kein Satellit („Die Anmeldung passiert an der Tür", Checkliste §2a). Der Name des Moduls ist geschichtlich.

Referenz am Code: `teigecke/teigecke_rezepte.html` Z. 42–68 (jüngste Seite, am Gerät abgenommen 08.10.). ✅

### `<head>`
```html
<!-- meta charset/viewport/robots/title wie in Abschnitt 1 -->
<script src="../bos_theme_sync.js"></script>
<script src="../bos_density_sync.js"></script>
<link rel="stylesheet" href="../bos_design_tokens.css">
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
```

### `<body>`, ganz am Anfang
```html
<script src="../bos_launcher_backgrounds.js"></script>  <!-- MUSS vor bos_accounts.js (BOS_BV) -->
<script src="../bos_zeitkontext_referenz.js"></script>  <!-- nur wenn Zeitkontext gebraucht, vor bos_zeitkontext.js -->
<script src="../bos_firebase_config.js"></script>
<script src="../bos_zeitkontext.js"></script>           <!-- optional -->
<script src="../bos_accounts.js"></script>
<script>var BOS_APP_ID = '…';</script>
<script src="../bos_app_registry.js"></script>
<script src="../bos_launcher_profiles.js"></script>
<script src="../bos_permissions.js"></script>
<script src="../bos_access.js"></script>
<script src="../bos_standalone_login.js"></script>      <!-- statt bos_access_guard.js -->
<script src="../bos_produkte.js"></script>              <!-- nur bei Produktdaten -->
<script src="../bos_produkte_schreiben.js"></script>    <!-- nur wenn die Seite Produkte schreibt -->
<!-- danach die eigenen Module der Seite -->
```

**Zusätzlich Pflicht für direkt aufrufbare Seiten:**
- Registry-Feld `direkt: 'anmeldung'` setzen (Abschnitt 2.2).
- Adresse in `bos_code_adressen.json` eintragen. `test_nfc_qr.js` wird sonst rot (zwei Wächter: Feld passt zur Seite; jede `direkt`-Adresse steht in der Wächter-Datei). ✅ (Registry-Kopf)

**Kopf oder Body ist für die Ausführung gleichgültig.** Entscheidend ist allein die Position im Dokument. `froster_inventur.html` lädt `bos_firebase_config.js` noch vor `bos_launcher_backgrounds.js`, `froster_produktion.html`/`ziele.html` haben die drei Dateien im `<head>`. Alles läuft und wird nicht rückwirkend angefasst (Klärung 06.09., unverändert gültig).

⚠️ **Namens-Falle, unverändert gültig (05.09. live aufgetreten):** `bos_firebase_config.js` stellt `window.db` bereit. Ein eigenes `var db = …` auf oberster Skriptebene ist dasselbe wie `window.db = …` und überschreibt den Wert still. Darum eigene Top-Level-Namen nie `db`/`auth`/`BOS_*` nennen und oben `let`/`const` statt `var` verwenden.

**Nie `document.currentScript` in einem Rückruf lesen**; es gilt nur, solange das Skript läuft. Wer die Wurzel braucht, nimmt `BOS_ACCESS.wurzel()`. **Nie** `pathname.replace(/^.*\//, '')` für einen Weiterleitungspfad: Das schneidet den Ordner ab und führt zu einem 404 (Funde F-19/F-20 vom 19.09.). ✅

**Seiten mit `bos_standalone_login.js` (16, am Prüf-Repo gezählt ✅):** `froster_inventur`, `froster_produktion`, `ziele`, `verbrauch_manuell`, die vier Stationsseiten und `uebersicht` (Produktionsplaner), `wunschtag`, `urlaub_anfrage`, `mein_konto`, `nfc_qr_zentrale`, die drei Teigecke-Seiten.

---

## 1b. Die Tür und der Launcher

| Seite | lädt (Reihenfolge, ✅ am Code) | Aufgabe |
|---|---|---|
| `index.html` (Tür) | 3 SDKs → `bos_firebase_config.js` → `bos_launcher_roles.js` → `bos_accounts.js` → `bos_konto_profil.js` | Anmeldung mit `kennung@baeckereios.intern`, danach Profil schreiben (`BOS_KONTO_PROFIL.stelleSicher`), dann `?weiter=` oder Launcher. Meldet „Noch nicht freigeschaltet", wenn der Haken fehlt. **Achtung:** Die Endung `KENNUNG_ENDUNG` steht hier **und** in `hatKennung()` der Regeln; ändert sie sich, beide Stellen ändern ✅ |
| `launcher.html` | 3 SDKs → `bos_firebase_config.js` → `bos_app_registry.js` → `bos_launcher_roles.js` → `bos_launcher_profiles.js` → `bos_profil_lookup.js` → `bos_permissions.js` → `bos_access.js` → `bos_launcher_backgrounds.js` → `bos_accounts.js` → `bos_konto_profil.js` → `bos_profil_sync.js` → `bos_bootscreen.js` → `bos_screensaver_content.js` → `bos_screensaver.js` → `bos_aufgaben_logik.js` → `bos_taskboard.js` | Kacheln über `BOS_ACCESS.can()`; Profil aus dem Konto (`BOS_KONTO_PROFIL.aktualisiere`), keine Profilauswahl mehr |
| `404.html` | nichts (Farben fest eingetragen) | fängt falsche Schild-Adressen ab, Knopf „BOS öffnen" → `index.html` 📄 |

**Anmeldemodell (Stand 22.09., ✅ `bos_firebase_config.js`, Checkliste §2a):**
- `BOS_AUTH_MODUS = 'konto'`. Der Rückweg `'anonym'` ist seit Etappe 5 (22.09.) **wirkungslos**, weil der anonyme Anbieter abgeschaltet ist.
- Selbstregistrierung ist abgeschaltet; Firebase lehnt mit `auth/admin-restricted-operation` ab. Konten legt nur die Betriebsleitung an (Kontenverwaltung).
- `bos_firebase_config.js` meldet niemanden an. Ohne Sitzung leitet es zur Tür und hängt den eigenen Pfad, **relativ zur Wurzel**, als `?weiter=` an (Fix v0.3, 19.09.).
- Firebase merkt sich die Anmeldung pro Adresse (Origin): einmal an der Tür, gilt für Launcher und alle Satelliten. Online (`github.io`) und lokal (`127.0.0.1:24190`) sind **zwei getrennte Anmeldungen**.

**Offene Seiten (`direkt: 'offen'`):** `taschenrechner`, `schnelldruck`, `stempeluhr`. Keine Rollen, keine Datenbank, laufen ohne Anmeldung. `taschenrechner`/`schnelldruck` binden trotzdem den Guard ein, `stempeluhr` nicht. ✅

---

## 2. Root-Ebene: geteilte Dateien

### 2.1 Basis: Firebase, Design, Aussehen

| Datei | Liefert global | Ladehinweis | Vertrauen |
|---|---|---|---|
| `bos_firebase_config.js` | `window.db`, `window.BOS_AUTH_READY` (Promise, vor jedem Firestore-Zugriff abwarten). Leitet ohne Sitzung zur Tür | nach den 3 SDKs (10.12.2, app → auth → firestore). Wurzel aus der **eigenen** Adresse, beim Laden gemerkt | ✅ v0.3 (19.09.) |
| `bos_theme_sync.js` | setzt `data-theme` auf `<html>` aus dem Profil | **vor** `bos_design_tokens.css` | ✅ |
| `bos_density_sync.js` | setzt `data-density` (standard/kompakt) | **vor** `bos_design_tokens.css`, neben `bos_theme_sync.js` (Reihenfolge der beiden egal). In 30 Seiten eingebunden | ✅ NEU seit 01.09., hier bisher nicht geführt |
| `bos_zoom_sync.js` | setzt `data-zoom` (100/80/65), mit Iframe-Weiche gegen doppelten Zoom | — | ⚠️ **keine Seite bindet sie ein** (nur in Kommentaren genannt; Launcher hat eigene Weiche). Altlast oder vergessen? Siehe §5 Nr. 12 |
| `bos_design_tokens.css` | `--bos-*`-Variablen und Komponentenklassen. Token-Liste: Checkliste §3 | nach den beiden Sync-Skripten | ✅ |

### 2.2 Registry, Rollen, Zugriff

| Datei | Liefert global | Ladehinweis | Vertrauen |
|---|---|---|---|
| `bos_app_registry.js` | `window.BOS_APPS`, **51 Einträge, 6 Hubs** (seit 10.10. mit `reparaturanfrage`) (`freezer`, `teigecke`, `produkt_config`, `produktionsplaner`, `druckzentrale`, `schichtplaner`). **Seit 21.10. (#110):** am Dateiende `window.BOS_BEREICHE` und `BOS_BEREICH_VON` (eine Liste der Bereiche für BackStore, Kontenverwaltung, NFC-Logik) | vor `bos_launcher_profiles.js` | ✅ (Lieferung 08.10.; Bereiche 21.10., Go KC BackStore 11:26) |
| `bos_backstore_texte.js` (neu 21.10., #110) | App-Texte aus `backstore_texte/{appId}` lesen/schreiben, Sicherungen in `backstore_texte_sicherungen`. **Kein DOM**; die Datenbank übergibt der Aufrufer | nach `bos_app_registry.js`. Aufrufer: BackStore, Kontenverwaltung (Zugangsblatt), NFC-Zentrale, Erst-Füllungs-Erzeuger | ✅ (Go KC BackStore 11:26) |
| `bos_launcher_roles.js` | `window.BOS_ROLES`, **9 Rollen:** `backstube, konditorei, verkauf, kommissionierung, fahrer, verkaufsleitung, produktionsleitung, haustechnik, admin` | geladen von Tür, Launcher, Kontenverwaltung | ✅ **Berichtigt:** Die alte Fassung nannte `baecker`/`konditor`. Das war eine Drift in der Doku, nicht im Code (BAUSTELLEN #26/#32) |
| `bos_launcher_profiles.js` | `window.BOS_PROFILES` = **`[]`** seit 04.10. | bleibt eingebunden, weil ~15 Seiten es mit `\|\| []` lesen | ✅ Profil „ulf"/PIN 1234 entfernt (Online-Gang §3.3) |
| `bos_profil_lookup.js` | `window.BOS_PROFIL_LOOKUP.{liesState, mergeProfile, findeProfil, findeAktiv, aktivesProfil}` | nach `bos_launcher_profiles.js`. Aufrufer: Launcher, Backstore, Taskboard | ✅ |
| `bos_permissions.js` | `window.BOS_PERMISSIONS`: Rolle × Satellit → boolean. **8 Rollen**; `haustechnik` fehlt gewollt (startet ohne Kachel, 31.08.) — **seit 23.10. (#115):** `haustechnik` hat genau einen Eintrag, `maschinenseite` | vor `bos_access.js` | ✅ |
| `bos_access.js` | `window.BOS_ACCESS.{can, istGelistet, zeigeSperre, pruefeUndZeigeWarnung, wurzel}`. Übergangs-Alias `window.BOS_ZUGRIFF_ANZEIGE = BOS_ACCESS` | **Pflicht**, nach `bos_permissions.js`, vor Guard bzw. Standalone-Login | ✅ Sperre und Warnstreifen seit 20.09. hier (F-30). Eine Mechanik, drei Aufrufer: Guard, Standalone-Login, Launcher/Kontenverwaltung | **Seit 10.10.:** `can(appId, role, overrides, kontoHaken)` — vierter Parameter optional; Registry-Einträge mit Feld `haken` entscheiden nur über die Haken des Kontos und fallen **nie** auf offen zurück, ohne Zeile in der Matrix. Sperrtext auf Haken-Seiten „Kein Haken für …“. **Sieben** `can()`-Aufrufer: Launcher, Guard, Standalone-Login, BackStore (mit viertem Parameter), Urlaub, Wunschtag, Mein Konto (ohne). [KC 10.10., Reparaturanfrage Stufe 1]
| `bos_access_guard.js` | kein API, läuft selbst | Abschnitt 1 | ✅ |
| `bos_standalone_login.js` | kein API, läuft selbst; Zugriff wie der Guard, ohne Profil zur Tür | Abschnitt 1a, **liegt in der Wurzel**, eingebunden als `../bos_standalone_login.js` | ✅ BAUSTELLEN #15 erledigt (19.09.) |
| `bos_zugriff_anzeige.js` | (stellte `BOS_ZUGRIFF_ANZEIGE` bereit) | **nicht einbinden**, am 20.09. in `bos_access.js` zurückgeführt | ⚠️ liegt im Prüf-Repo vom 30.09. noch, keine Seite lädt sie. Ob sie im Online-Repo noch liegt: prüfen, ggf. auslagern (§5 Nr. 13) |

**Felder in `bos_app_registry.js`** (hier die einzige Quelle, ✅ Kopfkommentar der Lieferung vom 08.10.):

- `id`: stabil, nie umbenennen. **Identisch mit `BOS_APP_ID`** im Satelliten.
- `name`, `icon` (Emoji), `color` (Hex).
- `url`: relativer Pfad; `null` = Kachel sichtbar, öffnet Platzhalter „geplant".
- `status`: `'live' | 'geplant' | 'system'`.
- `type?`: `'hub'` (Zwischenseite) oder `'system'` (Launcher-Kernfunktion).
- `hub?`: `'<hub-id>'`, macht die Kachel zum Kind eines Hubs.
- `roles?`: fehlt das Feld, ist die Kachel für alle sichtbar. Nur IDs aus `bos_launcher_roles.js`. Bei Hub-Kindern zählt zusätzlich die `roles`-Angabe des Hubs.
- `pinned?` **(neu 02.09.)**: `true` = Kachel immer auf dem Desktop, unabhängig vom BackStore. Nur Darstellung, kein Zugriff.
- `bereich?` **(neu 05.09.)**: Gruppierung der Rechte-Ansicht in der Kontenverwaltung: `'verwaltung' | 'produktion' | 'verbrauch' | 'vertrieb_filiale' | 'allgemein'`. Fehlt es, landet die Seite sichtbar unter „Sonstiges".
- `direkt?` **(neu 03.10.)**: `'anmeldung'` = Seite bindet `bos_standalone_login.js` ein, darf QR/NFC bekommen. `'offen'` = keine Rollen, keine Datenbank. Fehlt es, ist die Seite nicht direkt aufrufbar; die NFC-/QR-Zentrale zeigt sie ausgegraut mit Grund.
- `haken?` **(neu 10.10.)**: Liste von Feldnamen im Konto-Dokument, z. B. `['reparaturLesen', 'reparaturMelden', 'reparaturBearbeiten']`. Ist das Feld gesetzt, erscheint die Kachel genau dann, wenn das Konto einen dieser Haken trägt (Profilfeld `kontoHaken`); `roles` und Matrix-Zeile entfallen, die Seite steht nicht in „Zugriffe“/„Rollen & Rechte“. Grund: Der Export „Rollen & Rechte“ schreibt nur `true`-Einträge — eine Matrix-Zeile mit lauter `false` verschwände und die Seite wäre für jeden offen (Reparatur-Kompendium F15). Die Regel muss dieselben Haken prüfen. [KC 10.10., Reparaturanfrage Stufe 1]
- `zaehler?` **(neu 26.10.)**: `true` = die Kachel darf eine Zahl oben rechts am Symbol tragen (`bos_kachel_zahlen.js`, §2.5). Die Zahl kommt nie aus der Registry, sondern von einem Modul über `BOS_KACHEL_ZAHLEN.setze(id, n)`; ohne das Feld zeigt die Kachel nie eine Zahl, auch wenn ein Modul eine meldet. Nur Darstellung, kein Zugriff; Hub-Kinder kennen die Zahl (noch) nicht. [Bau-Chat Nachrichtenzentrale 1a, Go KC 17:07]

⚠️ **Registry-`roles` ≠ Quelle von `BOS_ACCESS.can()`:** `can()` liest **ausschließlich** `bos_permissions.js` (plus Ausnahmen aus dem Konto). Die Spalten in der Kontenverwaltung zeigen die Vereinigung aus Registry-`roles` und Matrix. Eine Seite kann dort mit ⚠️ auftauchen, ohne dass ein Haken etwas bewirkt. Neue Seite: **beide** Stellen pflegen (Checkliste §12). ✅

### 2.3 Konten, Anmeldung, Namen

| Datei | Liefert global | Ladehinweis | Vertrauen |
|---|---|---|---|
| `bos_launcher_backgrounds.js` | `window.BOS_BACKGROUNDS` + Wirt für `window.BOS_BV` (`.silbe()`, `.adminKennung()`) | **vor** `bos_accounts.js` | ✅ Die Verschleierung ist zurückrechenbar. Die Admin-Kennung gilt als bekannt, der Schutz ist allein das Passwort (Online-Gang §3.4) |
| `bos_accounts.js` | `window.BOS_ACCOUNTS.{pruefeKonto, registriereNeu, loginMitPin, ladeKonto, legeKontoAn, setzeRolle, setzeOverride, setzeTaskboardRecht, setzeTeigeckePflegeRecht, setzeTeigeckeTeigeRecht, setzeTeigeckeRezepteRecht, loescheKonto, ladeAlleKonten, adminReauth, adminReauthEnde, adminAngemeldet, adminFirestore}` | nach `bos_launcher_backgrounds.js` und `bos_firebase_config.js`. Admin-Funktionen laufen über eine **isolierte zweite Firebase-App** (`bos-admin`), die geteilte Sitzung bleibt unberührt | ✅ **Neu seit 06.09.:** `legeKontoAn`, `adminAngemeldet`, drei Teigecke-Haken-Setzer (28./29.09.). `registriereNeu`/`loginMitPin`/`pruefeKonto` stammen aus der Zeit vor den Firebase-Konten; ob noch ein Aufrufer sie nutzt, nicht nachgesehen 📄 | Seit 10.10.: `setzeReparaturLesenRecht`, `setzeReparaturMeldenRecht`, `setzeReparaturBearbeitenRecht` (Muster Teigecke, Sammelaktion). [KC 10.10., Reparaturanfrage Stufe 1]
| ↳ seit 21.10.2026 (#106) | `BOS_ACCOUNTS.setzePasswort()`, `aendereAdminPasswort()` | `setzePasswort` ruft die **Cloud Function** `setzePasswort` (`europe-west3`, nur Generalschlüssel; Code `ENTWICKLUNG_BOS/functions/setzepasswort/`, nie im Repo). Aufrufer: `konten/konten_verwaltung.html` (Zugangsblatt, Admin-Passwort, Laufzeit-Streifen `FUNCTION_LAUFZEIT`). Generalschlüssel-UID steht an zwei Stellen: Regel `istAdmin()` und Function | ✅ online 21.10., 03:40 |
| `bos_konto_profil.js` | `window.BOS_KONTO_PROFIL.{aktualisiere, stelleSicher}`: baut aus dem angemeldeten Konto den Profileintrag in `'bos_launcher_state_v2'`, inkl. `freigeschaltet`. Ohne Haken: `role: null`, keine Ausnahmen | nach `bos_accounts.js`. Zwei Aufrufer: `index.html` (nach der Anmeldung), `launcher.html` (beim Start) | ✅ NEU 19.09., Schritt 2 am 26.09. | Seit 10.10.: Profilfeld **`kontoHaken`** = alle `true`-Felder des Konto-Dokuments, nur bei `freigeschaltet`, sonst `{}`; wirkt nach Launcher-Start oder Anmeldung. Launcher-Rückfall ohne Netz trägt `freigeschaltet` und `kontoHaken` mit (Fix: vorher fälschlich „Noch nicht freigeschaltet“ seit 26.09.). [KC 10.10., Reparaturanfrage Stufe 1]
| `bos_namen.js` | `window.BOS_NAMEN.{laden, anzeige, auswahl, anzeigeEinreichung, status, fehlerZeigen}`, die **eine** Namensfunktion (Rufname → Beschreibung → „P07 · kein Name hinterlegt", nie leer) | eine Abfrage `namen` je Seite. Neun Planungsseiten | ✅ NEU 26.09. (Namens-Fundament Schritt 5/8). Details: `NAMENSMODELL_KOMPENDIUM.md`. **Seit 10.10.2026 (#59, eingespielt 11.10.) auch die Personen-Ladefunktion der Planung:** `imSchichtplan(person)`, `nurImSchichtplan(liste)`, `personenFuerPlanung(db)` (Snapshot-Imitat ohne „nicht im Plan“: `forEach`, `docs`, `size`, `empty`, echte Dokumente), `personenAlle(db)`. Geladen von allen acht Planungsseiten und dem Personen-Editor |

### 2.4 Fachliche Kernlogik (Produktion, Verbrauch, Aufgaben)

| Datei | Liefert global | Abhängigkeit / Aufrufer | Vertrauen |
|---|---|---|---|
| `bos_zeitkontext_referenz.js` | `BOS_FEIERTAGE`, `BOS_IST_BESONDERER_TAG()`, `BOS_BESONDERE_TAGE_IN()`, `BOS_HAMSTER_FAKTOR()` | **vor** `bos_zeitkontext.js` | ✅ im Einsatz (Stationsseiten, Teigecke, SchichtPlaner). Die Notiz „noch nicht deployt" (29.08.) ist überholt |
| `bos_zeitkontext.js` | `window.BOS_ZEITKONTEXT` | Firestore `bos_zeitkontext` > localStorage `bos_zeitkontext_lokal` > Datei-Boden. 14 Seiten | ✅ **Namespace vorhanden**; die Sorge der alten Fassung (globales `status`) ist erledigt |
| `bos_verbrauch_durchschnitt.js` | `window.BOS_VERBRAUCH` u. a. `holeManuelleWerte()`, `pruefeAusreisser()`, `holeDurchschnitt()` (ein Wochentag), `holeWochenbedarf()` (fertiges `needs[]`, seit 15.10. auch `anzahl[7]`), `durchgang()` (Lesevorgänge bündeln, nur im Editor). Töpfe `manuell`, `offiziell` und seit 15.10. `richtwert` (liest nichts, Werte vom Produkt, braucht `produkt` und `bos_produkte.js` v0.5) | lädt `bos_verbrauch_einstellungen.json` relativ zur eigenen Adresse. Aufrufer: Stationsseiten, Schnellrechner, Verbrauch manuell | ✅ Getter seit 31.08. da, Stationsseiten und Schnellrechner nutzen ihn (§5 Nr. 5 erledigt) |
| `bos_hamster.js` | `window.BOS_HAMSTER` | liest `bos_hamster_config.json`; Aufrufer: Stationsseiten, Schnellrechner, Zeitkontext-Editor | ✅ Existenz; Integration siehe §5 Nr. 6 |
| `bos_produktionskette.js` | `window.BOS_KETTE.{berechne, ermittleTagesTypen, berechneMitZeitkontext}` | ruft `BOS_ZEITKONTEXT` und `BOS_HAMSTER`. Aufrufer: Stationsseiten, Schnellrechner | ✅ Namespace bestätigt |
| `bos_froster.js` | `window.BOS_FROSTER` (u. a. `holeBestand()`) | liest `froster_zaehlung` aus `bos_events`. Aufrufer: Schnellrechner, vier Stationsseiten | ✅ |
| `bos_ziel_berechnung.js` | keine `window.*`-Zuweisung; Funktionen auf oberster Ebene (`montagDerWoche()`, `ladeWoche()` …) | Aufrufer: `ziele.html`, `froster_produktion.html` | ✅ |
| `bos_aufgaben_logik.js` | `window.BOS_AUFGABEN_LOGIK.{istOffen, istHeute}` | Aufrufer: `aufgaben_verwaltung.html`, `bos_taskboard.js` | ✅ |

### 2.5 Launcher-Zusatzmodule

| Datei | Liefert global | Ladehinweis | Vertrauen |
|---|---|---|---|
| `bos_taskboard.js` | `window.BOS_TASKBOARD.init()`, übernimmt `#taskbarHome` | nach `bos_accounts.js`, `bos_launcher_profiles.js`, `bos_aufgaben_logik.js` | ✅ |
| `bos_profil_sync.js` | `window.BOS_PROFIL_SYNC.{lade, speichere}`, persönliche Einstellungen geräteübergreifend in `bos_profil_einstellungen/konto_<kennung>` | nach `bos_accounts.js` | ✅ Regel jetzt eigener Block (§3); Mehrgeräte-Test siehe §5 Nr. 10 |
| `bos_bootscreen.js` | `window.BOS_BOOT` | nur Launcher | ✅ **Lücke der alten Fassung geschlossen** |
| `bos_screensaver_content.js` | `window.BOS_SCREENSAVER_CONTENT` | vor `bos_screensaver.js` | ✅ dto. |
| `bos_screensaver.js` | `window.BOS_SCREENSAVER` | nur Launcher | ✅ dto. |
| `bos_ungespeichert.js` | `window.BOS_UNGESPEICHERT.{melde, stand, vorDemSchliessen}`, eigener Rückfrage-Dialog; setzt in den Seiten den `beforeunload` (Seiten setzen keinen eigenen) | Launcher **und** die sieben Seiten mit Schutz (`produkt_config_editor`, `konten_verwaltung`, `reparaturanfrage`, `nfc_qr_zentrale`, `teigecke_rezepte`, `verbrauch_werkstatt`, `teigrechner_teige`), je mit Rückfall falls die Datei fehlt; **dazu die vier Stationen** `produktionsplaner/station_*.html` (Fingerabdruck der Planung; #93, online seit 17.10., 05:25); später #78 | ✅ #77 online seit 17.10., 04:36, am Tablet abgenommen (Checkliste §7b) |
| `bos_kachel_zahlen.js` | `window.BOS_KACHEL_ZAHLEN.{setze, lese, alle, text, fuelle, zeichne}` — Tafel für Zahlen an Kacheln (Registry-Feld `zaehler: true`), Nachrichtenzentrale Stufe 1a (#131) | nur Launcher; keine Abhängigkeit, Reihenfolge egal (steht vor `bos_app_registry.js`); fehlt sie, laufen die Kacheln ohne Zahl. Ab Stufe 1c Aufrufer `bos_nachrichten_zahl.js`. Prüfschalter `launcher.html?kachelzahl=<id>:<n>` | ✅ 1a gebaut 26.10., 17:36 (Go KC 17:07), wartet auf Prüfung/Einspielen; `_PRUEF_kachel_zahlen_werkzeuge/` 40/0 + 18/0 |
| `bos_crumble_host.js` | `window.BOS_CRUMBLE_HOST.{start, setzeAn, neuLaden}` — Brücke Hamster-Figur ↔ Launcher | nur Launcher; Abhängigkeiten alle optional und lazy: `hamster_figur/hamster_figur.js`, `bos_screensaver.js` (`setzeFigur`, `figurAn`), `bos_taskboard.js` (Ereignis `bos:aufgaben`) | ⏳ O26 Zoom (Go 20.10., 11:36: Bühne durch den Launcher-Zoom teilen, Beobachter) wartet aufs Einspielen. Nachtrag 6 online (Repo 18.10., 10:08); Stufe 1e online (Repo 18.10., 14:04: Begrüßungen, Rufname im Hintergrund, schreibt den Gerätewert `localStorage['bos_crumble_tuer']` für die Tür). Braucht seit 1c `#desktop` als Geschwister-Anker für die Bühne |
| `bos_tuer_crumble.js` | `window.BOS_TUER_CRUMBLE` — Loch-Crumble in der Karte „Neu hier?“ an der Anmeldeseite (Schmuck, K60) | nur `index.html` (nach `load` nachgeladen; Fall-Aufrufe in try/catch). **Seit 1f ohne `hamster_figur.js`:** lädt `hamster_figur/loch/loch.css`, `loch.json` (Tür-Texte) und die Büsten-PNG aus `hamster_figur/loch/`; Ein/Aus über den Gerätewert, den der Launcher (`bos_crumble_host.js`) schreibt. Ausfall = nur `console.warn` (Ulf F1, bewusste Ausnahme) | 1f + O24 (Zeitlimit 8 s, Prüfschalter `?crumble=pruefen`) online seit Sync 19.10., 19:05 |

**Crumble im Launcher (#62 Stufe 1; Texte aus der Bau-Doku §5, eingetragen vom Buchhalter 08:24):**

- *Ladereihenfolge:* `hamster_figur/hamster_figur.css` nach `bos_design_tokens.css`; `hamster_figur/hamster_figur.js` vor `bos_bootscreen.js`; `bos_crumble_host.js` nach `bos_taskboard.js`. Reihenfolge ist nicht bindend: alle drei greifen erst bei `BOS_CRUMBLE_HOST.start()` aufeinander zu, der Schoner holt die Figur lazy beim ersten Erscheinen (`BOS_SCREENSAVER.setzeFigur`).
- *Seit Stufe 1c (17.10., Go 14:05):* Crumble steht auf dem Schreibtisch. `bos_crumble_host.js` hängt seine Bühne als Geschwister neben `#desktop` ein (fehlt `#desktop`, gibt es keinen Schreibtisch-Crumble); Bühne auf **Ebene 300** — über den Kacheln, unter den Fenstern. Nummern-Bilder aus `hamster_figur/nummern/` (lazy). Einzelheiten: `HAMSTER_FIGUR_DOKU.md` Fassung 7. Die folgende Zeile „Ebenen“ beschreibt den Stand von Stufe 1 (Ruf-Knopf) und gilt für den Knopf weiter, soweit die Doku nichts anderes sagt.
- *Ebenen:* Crumble-Knopf: Teil der Kopfleiste (600); seine Bühne ragt nach unten, bleibt aber in der Ebene der Kopfleiste (ein z-index innerhalb der Leiste kann 600 weder über- noch unterschreiten) — Hilfe-Blatt (800), Modale (900), Schoner (1850) liegen darüber. Crumble im Schoner: `position: absolute` **im** Schoner-Element, Ebene 1850 (kein eigener Layer). Einbettung `fest` (Prüfseite, Satelliten): fixed, 900.
- *Neue Datei:* `bos_crumble_host.js` — Brücke Hamster-Figur ↔ Launcher. Abhängigkeiten (alle optional, lazy): `hamster_figur/hamster_figur.js`, `bos_screensaver.js` (`setzeFigur`, `figurAn`), `bos_taskboard.js` (Ereignis `bos:aufgaben`). Aufrufer: `launcher.html`.

### 2.6 Produkte (seit 07.10. nur noch Firestore)

**Die Datei `produkt_config.json` ist seit 07.10., 10:21 aus dem Repo.** Die Datenbank-Sammlung `produkte` ist die einzige Quelle. Eine Notfall-Kopie liegt in Ulfs privater Cloud, erzeugt mit dem Export im Sync-Tool (Erinnerung nach 30 Tagen bzw. 5 Ständen). In der Firebase-Konsole wird nie von Hand geändert (Ulf, 05.10., 08:03). Details: `PRODUKTE_KOMPENDIUM.md`.

| Datei | Liefert global | Ladehinweis / Aufrufer | Vertrauen |
|---|---|---|---|
| `bos_produkte.js` | `window.BOS_PRODUKTE`, u. a. `lade({ sicht: 'aktive' \| 'alle' \| 'roh' \| 'laufend' })`; `laufend` = `aktive` ohne `pausiert: true` (Betriebsseiten, seit 15.10.). Seit v0.5 (15.10.) auch `bedarfsQuelle()`, `quelleText()`, `istPausiert()`, `backtagIndizes()`, `richtwert*()` (#63); seit v0.3/v0.4 `einheit()`, `stueckInEinheit()`, `einheitInStueck()`, `EINHEITEN_LISTE` (#64). Gerätekopie + Stand-Zettel `produkte_stand/aktuell`: gelesen wird die Liste nur, wenn die Nummer gestiegen ist; Netz von 7 Tagen. Zustände `kein_netz` (aus `fromCache`), `kontingent` (aus `resource-exhausted`). Nie Gerätekopie bei fehlender Berechtigung | **direkt nach `bos_firebase_config.js`** (Konvention Stufe 1). Leser: vier Stationsseiten, `uebersicht`, `verbrauch_manuell`, `verbrauch_werkstatt`, `verbrauch_einstellungen_editor`, `froster_inventur`, `froster_produktion`, `schnellrechner`, `teigecke_nacht`, `teigecke_rezepte`, dazu Editor und Sync-Tool | 📄 **nicht im Prüf-Repo**, aus `PRODUKTE_KOMPENDIUM.md` §4d/§4g und `TEIGECKE_NACHT_DOKU.md` |
| `bos_produkte_schreiben.js` | `window.BOS_PRODUKTE_SCHREIBEN.schreibe({ kennung, geladenerStand, standExistiert, eintraege })`: **ein** Batch je Vorgang mit Sicherung der Vorversion (`produkte_sicherungen`), Produkt und Stand +1. Gibt `err.code`/`err.message` unverändert weiter | nach `bos_firebase_config.js` und `bos_produkte.js`. Aufrufer: Produkt-Editor (v-firestore-2c), `teigecke_rezepte.html` (Feld `ausTeig`) | ✅ v1 (07.10.) |
| `bos_produkte_anlegen.js` (neu 26.10., #100 Stufe 2a) | `PRODUKT_NEU`: Schlüssel, Vorlage, `KATEGORIEN`, Kategorie-Vorschlag für ein neues Produkt — **eine** Mechanik für Produkt-Editor und Backzettel (vorher nur im Editor) | **nach** `bos_produkte_schreiben.js`. Aufrufer: `produkt_config/produkt_config_editor.html`, `backzettel/backzettel_erfassung.html`. Nie den Editor ohne das Modul syncen | ✅ GO KC Backzettel 07:42 (`_PRUEF_produkte_anlegen.js` 24/0) |
| `produkt_config_felder.json` | Feld-Glossar. **Gekoppelt an `produktFelder()` in der Regel:** ein neues Feld im Glossar ohne Eintrag in der Regel → jedes Speichern wird abgelehnt (RK §17) | Wurzel-Datei; die Zweitkopie in `produkt_config/` ist seit 04.10. ausgelagert | ✅ Glossar `ausTeig` am 08.10. berichtigt |
| `produkt_config/produkt_config_sync.html` | Notfall-Werkzeug: Export, Einspielen mit Sammel-Sicherung (`aktion: 'einspielen'`/`'export'`) | Guard, nur `admin` | ✅ |

⚠️ **Kleine Abweichung von der Konvention:** `teigecke_rezepte.html` lädt `bos_produkte.js` erst **nach** `bos_standalone_login.js` (Z. 66), nicht direkt nach `bos_firebase_config.js`. Funktional gleich (vor dem Seitencode), nur uneinheitlich. Kein Handlungsbedarf.

### 2.7 SchichtPlaner V2: Rechenmodule

Reine Logik ohne DOM und ohne Firestore, alle in der Wurzel, alle auch in Node lauffähig (`module.exports`) und durch die `test_*.js` außerhalb des Repos abgedeckt. Details und Regeln: `SCHICHTPLANER_V2_KOMPENDIUM.md`. ✅ (Aufrufer am Prüf-Repo gezählt)

| Datei | Liefert | Aufrufer |
|---|---|---|
| `rechenmodul.js` | Zuweisungslogik (Funktionen/Konstanten auf oberster Ebene) | `offizieller_plan`, `entwuerfe`, `sonntagsplan`, `krankmelder`, `wochen_spielwiese` |
| `freie_tage_verteilung.js` | Verteilung des regulären freien Tags | `entwuerfe`, `wochen_spielwiese` |
| `entwuerfe_berechnung.js` | aus `entwuerfe.html` ausgelagert (13.09.) | `entwuerfe` |
| `feiertagsregel.js` | Zählregel E9 (Feiertagswoche) | `entwuerfe`, `wunschtag` |
| `schichtplan_tabelle.js` | gemeinsame Darstellung der Plantabelle (16.09., T-75) | `entwuerfe`, `offizieller_plan` |
| `sonntagsplan_berechnung.js` | `window.BOS_SONNTAGSPLAN_BERECHNUNG` | `sonntagsplan` |
| `krankmelder_berechnung.js` | `window.BOS_KRANKMELDER_BERECHNUNG` | `krankmelder`, `offizieller_plan` |
| `ausgleichskonto_berechnung.js` | `window.BOS_AUSGLEICHSKONTO_BERECHNUNG` (schreibt selbst nichts) | `offizieller_plan` |

### 2.8 Drucken, QR, NFC

| Datei | Liefert global | Hinweis | Vertrauen |
|---|---|---|---|
| `bos_druck.js` | `window.BOS_DRUCK.drucken({ inhaltHTML, appName, titel?, mitKopf?, farbig?, ausrichtung?, extraCSS? })`, Android-sichere Iframe-Druckmaschine | 10 Aufrufer: Schnelldruck, Druckzentrale (2), Produktionsplaner-Übersicht, SchichtPlaner (4), NFC-/QR-Zentrale, Teigecke-Orte | ✅ |
| `bos_qr.js` | `window.BOS_QR.{adresse(pfad, zusatz), darfAusgeben(href), …}`. Wurzel aus dem **eigenen** Speicherort, nicht aus der aufrufenden Seite | `darfAusgeben` nur bei `https://` und nicht lokal. Aufrufer: NFC-/QR-Zentrale, Teigecke-Orte (Schilder) | 📄 **nicht im Prüf-Repo**, aus `NFC_QR_ZENTRALE_DOKU.md` |
| `qrcode.min.js` | QR-Bibliothek (davidshimjs/qrcodejs, MIT, unverändert) | Wurzel, eingebunden als `../qrcode.min.js`. Lizenz `QRCODE_LICENSE` laut Bau-Doku vom 07.10. seit dem Online-Gang in `Lizenzen/` | 📄 ⚠️ Im Prüf-Repo liegt noch eine Kopie in `teigecke/` (Altstand Orte-Lieferung), keine Seite lädt sie |
| `bos_code_adressen.json` | **Wächter-Datei:** `fest` (`bos_oeffnen` → `launcher.html`, `teigecke_vorbereitungen` → `teigecke/teigecke_nacht.html?reiter=vorbereitungen`) und `adressen` (alle 19 Registry-Einträge mit `direkt`) | `test_nfc_qr.js` vergleicht mit der Registry. **Gedruckte Adressen nie ändern**, sondern weiterleiten | ✅ Stand 08.10., 14:17 |
| `nfc_qr/nfc_qr_logik.js` | `window.BOS_NFC_QR_LOGIK` (Gruppen, Sammelblatt, `FESTE_ZIELE`) | nur für die Zentrale | ✅ v1.3 (08.10.) |

### 2.9 Teigecke (Hub `teigecke`, Ordner `teigecke/`)

Drei Seiten, alle `direkt: 'anmeldung'`, alle Rollen `admin, backstube, produktionsleitung` in Registry **und** Matrix. ✅ Führendes Dokument: `TEIGECKEN_FUEHRUNG_KONZEPT.md` (Punkte 1–68).

| Datei | Rolle | Stand |
|---|---|---|
| `teigecke_logik.js` | `window.BOS_TEIGECKE_LOGIK`, reine Rechnung (Teigmenge D, Wasserregel, Mehl-Regel `T = D + r − m`, Kessel, Hefe-Tabelle, Langzeitteig, Reiter aus `?reiter=`). Auch in Node lauffähig | v0.12 (08.10., 14:17) ✅ |
| `teigecke_seite.js` / `.css` | gemeinsames Gerüst von Orte und Rezepte; schreibt **ein Batch je Vorgang: Sicherung + Ziel** (`sicherungId`, `geaendertVon`, `geaendertAm`) mit Zeitlimit; liest die Regelstand-Probe | v0.2 ✅ |
| `teigecke_nacht.html` | Nachtseite: Reiter Teige / Vorbereitungen / Einsammeln, Langzeitteig, Vornacht-Anzeige | v0.12 ✅ |
| `teigecke_orte.html` | Wagen & Orte, Zutaten, Schilder mit QR (`bos_druck.js`, `bos_qr.js`, `qrcode.min.js`) | v0.3a ✅ |
| `teigecke_rezepte.html` | Anlege-Strecke „Teige & Rezepte" (Name → Brote → Sauer/Vorstufe/Langzeit → Hauptteig → Zusammenfassung). Schreibt Brote über `bos_produkte_schreiben.js` | v0.2 ✅ |

**Haken im Konto** (einzeln in der Kontenverwaltung, gesetzt nur über den Generalschlüssel):
- `teigeckePflege`: Wagen & Zutaten
- `teigeckeTeige`: Teigwerte (Wasserregel, Tabelle, Einwaagen, Kessel, Mehl-Regel, Langzeit-Hefe), Einstellungen
- `teigeckeRezepte`: Teige und die **geheimen Rezeptmengen**

**Mitbenutzer außerhalb von `teigecke/` (Teigrechner Stufe 1, #67; Go 16.10.2026, 18:57, wartet aufs Einspielen; Satz aus der Bau-Doku §7, eingetragen vom Buchhalter 19:39):**
> `teigrechner/teigrechner_teige.html` und `teigrechner/teigrechner.html` laden das Gerüst `teigecke/teigecke_seite.js` + `teigecke/teigecke_seite.css` und `teigecke/teigecke_logik.js` aus dem Ordner `teigecke/` — wer das Gerüst oder diese Logik ändert, prüft die zwei Seiten mit (`_PRUEF_teigrechner.js`, `ablauftest_teigrechner.js`). `teigecke_nacht.html`, `teigecke_rezepte.html` und `produkt_config_editor.html` lesen `teigrechner_teige` (nur Kennung/Name/archiviert).
Siehe `teigrechner/TEIGRECHNER_DOKU.md`. Neuer Haken im Konto: `weitereTeige` („🥨 Weitere Teige pflegen“, `BOS_ACCOUNTS_DOKU.md`).

---

### 2.9a Reparaturanfrage (Ordner `reparaturanfrage/`, seit 10.10.2026)

| Datei | Liefert global | Ladehinweis | Vertrauen |
|---|---|---|---|
| `bos_meldungen.js` (Wurzel) | `window.BOS_MELDUNGEN.{woerterbuch, ich, pruefeRegelstand, offen, grueneWoche, archivSeite, verlauf, anlegen, status, fenster, dringlichkeit, nachricht, imArchiv, alterText, …}` — gemeinsame Melde-Datei, Kanal + Status getrennt; heute nur Kanal `hausmeister`. Fehler als Error mit `.art/.meldung/.original/.link`. **Seit v0.2 (11.10., Nachtrag 2):** `neuesterEintrag(id, cb, fehlerCb)` (Live, `verlauf` `orderBy(ts desc).limit(1)`, kein eigener Index), `neuMarke(...)` (reine Rechnung „neu“), `verlauf()` liefert je Eintrag `ausstehend`, `status()` gibt `{ letzterEintrag }` zurück. Die Seite `reparaturanfrage.html` merkt sich „gelesen“ im **Gerätespeicher** unter `bos_reparatur_gelesen_v1` (nur dieses Gerät, `try/catch`, gesperrt = keine Kennzeichen + sichtbarer Hinweis). Abos im Posteingang: 2 + N offene + M grüne | nach `bos_firebase_config.js` | ✅ Lieferung 10.10., am echten System geprüft; v0.2 eingespielt und am Handy bestätigt 11.10. |
| `reparaturanfrage/reparaturanfrage.html` | Satellit, `direkt: 'anmeldung'`, Registry-Feld `haken`, `?geraet=` belegt das Gerätefeld vor | Standalone (§1a) | ✅ Prüffälle 82–88 |
| `maschinenseite/maschinenseite.html` (neu 23.10., #115 Stufe A) | Satellit, eigene Module `maschinen_logik.js` (`BOS_MASCHINEN`) und `maschinen_ansicht.js` (`BOS_MASCHINEN_ANSICHT`); lädt u. a. `bos_produkte.js`, `bos_meldungen.js`, `bos_namen.js`, `teigecke/teigecke_logik.js`, `bos_druck.js`, `bos_ungespeichert.js`. Sammlungen `maschinen`, `maschinen_reihenfolge`, `maschinen_angaben`; liest Produktfeld `werdegang`. Farbe fest Stahl. **Stufe B (Go 24.10., 09:38):** Ofenwahl, Reparatur + offene Anfragen (`bos_meldungen.js`), Info-Karten, Chatfenster (TTL über Feld `fristStart`), Ziele „Maschine/Gruppe“ in `nfc_qr/nfc_qr_logik.js` (Kärtchen in der Zentrale) | Standalone (§1a), `bos_standalone_login.js` | ✅ A online 23.10.; B Go 24.10., 09:38 (`test_maschinen_b.js` 244/0) |
| `reparaturanfrage/REPARATURANFRAGE_DOKU.md` | Modul-Doku, Hilfetext identisch | — | — |

Fakten und Entscheidungen: `REPARATURANFRAGE_KOMPENDIUM.md`; Regeln: `REGELN_KOMPENDIUM.md` RK §20.

### 2.9b Backzettel-Erfassung (Ordner `backzettel/`, seit 19.10.2026, #100)

*Text aus der Bau-Doku Backzettel §B.8, eingetragen vom Buchhalter 19.10., 19:02. Stand: online seit Sync 19.10., 19:05 (am Repo geprüft 20.10., 06:09).*

- **`bos_foto.js`** (Wurzel, neu): `BOS_FOTO.verkleinern(datei, e)`, `masse()`, `alsBase64()` — Fotos am Gerät verkleinern, Einstellungen als Parameter (Kantenstufen, Byte-Ziel, Qualität, wahlweise Kachelgrenze). Keine Abhängigkeiten. Nutzer: `backzettel/backzettel_erfassung.html`; Kopie der Mechanik in `bos_meldungen.js` (Umstellung offen, #101).
- **`backzettel/`**: Seite `backzettel_erfassung.html` + `backzettel_logik.js` (rein), `backzettel_api.js` (Anthropic-API aus dem Browser, Schlüssel nur im localStorage), `backzettel_prompt.js`. Braucht `bos_verbrauch_durchschnitt.js` (≥ 19.10.2026: `holeOffizielleTage`, `pruefeBackzettelWert`), `bos_produkte.js`, `bos_zeitkontext_referenz.js`, `bos_ungespeichert.js`, `bos_foto.js`. Firestore: `bos_events` (`verbrauch_offiziell`), Index `type` ↑ / `datum` ↓. Regel: `_regeln/_protokolle/firestore_regeln_2026-10-19_backzettel.rules`.

- **Seit Stufe 1b (#103, Go 20.10., 07:16, Text Bau-Doku 1b §B.9):** `bos_verbrauch_durchschnitt.js` (≥ 20.10.2026): Einstellungen aus Firestore `verbrauch_einstellungen/system` (Gerätekopie `bos_verbrauch_einstellungen_geraetekopie`, Notfall-Datei `bos_verbrauch_einstellungen.json`), `einstellungenHerkunft()`, `EINSTELLUNGEN_FELDER` (= Regel RK §24). Nutzer der Herkunft: Erfassung, Editor, vier Stationen, Schnellrechner. Schreiben nur `verbrauch_einstellungen/verbrauch_einstellungen_editor.html` (bindet jetzt den Rechner und `bos_ungespeichert.js` ein). — `launcher.html` (≥ 20.10.2026): `HUB_UMZUEGE`/`hubUmzug()` — braucht `BOS_APPS` (Registry) und `isVisibleForRole`. Hub `verbrauch` mit 4 Kindern in der Registry.

### 2.10 Weitere Dateien im Repo

| Datei | Rolle | Vertrauen |
|---|---|---|
| `bos_verbrauch_einstellungen.json` | System-Standard für den Verbrauchsdurchschnitt | ✅ |
| `bos_hamster_config.json` | Hamster-Stufen | ✅ |
| `manifest.webmanifest`, `pwa/bos_icon_*.png`, `pwa/bos_icon.svg` | installierbar „Zum Startbildschirm"; **kein Service Worker** (bewusst, wegen täglicher neuer Fassungen) | 📄 Online-Gang §4 |
| `.nojekyll`, `.gitignore` | GitHub liefert unverändert aus; Tests, Dokus, Altfassungen bleiben draußen (wirkt nur beim Hochladen mit Git) | 📄 |
| `bos_backgrounds/` | Hintergrundbilder (Wallpaper legt Ulf selbst ab) | 📄 |

**Seit 04.10. nicht mehr im Repo** (Online-Gang §5.2): `bos_pin_config.js` (ohne Nutzer), `bos_launcher_changelog.json` (von keiner Seite gelesen), `bos_permissions.json` (gültig ist `.js`), `punktesystem_gewichte.json` + `schichtplaner/punktesystem_gewichte_editor.html` (Werte liegen in Firestore), Migrations-JSONs, `produkt_config/produkt_config_felder.json` (Zweitkopie), alle `.md`-Dokus, alle Tests. Seit 07.10. außerdem `produkt_config.json`.

---

## 3. Firestore-Sammlungen und Regeln

**Grundsatz seit 22.09.:** Es gibt keinen Auffangblock. **Jede Sammlung ohne eigenen `match`-Block ist für alle gesperrt.** Ein neuer Satellit, der eine neue Sammlung anfasst, funktioniert erst, wenn die Regel dafür eingesetzt ist (Checkliste §4a). Lese- und Schreibrechte unten stammen aus der eingesetzten Regeldatei vom 08.10. ✅; die Seitenlisten sind am Prüf-Repo gezählt ✅.

### 3.1 Regel-Bausteine

| Funktion | bedeutet |
|---|---|
| `d()` | Abkürzung für `request.resource.data` |
| `hatKennung()` / `kennung()` | Adresse endet auf `@baeckereios.intern` / Teil vor dem @ (= Dokument-ID in `bos_accounts`) |
| `hatKonto()` | Kennung **und** Konto-Dokument mit `freigeschaltet == true` (seit 26.09.; die Checkliste §4a nennt das Freischalten noch nicht) |
| `rolle()` | `role` aus dem eigenen Konto-Dokument |
| `istPlanung()` | `hatKonto()` und Rolle `admin` oder `produktionsleitung` |
| `hatAdminRolle()` | `hatKonto()` und Rolle `admin` (heute `backstube02`, `systempflege`) |
| `istAdmin()` | **eine bestimmte UID**, der Generalschlüssel `systempflege` |
| `gehoertMir(personId)` | `personen/<id>.bosKontoId == kennung()` |
| `teigeckeHaken(feld)` → `darfWagen()`, `darfTeige()`, `darfRezepte()` | Haken im Konto-Dokument |
| `darfNacht()` | `hatKonto()`, Rolle `backstube`/`produktionsleitung`/`admin`, **und nicht der Generalschlüssel** |
| `reparaturHaken(feld)` → `darfMelden()`, `darfBearbeiten()`, `darfMitlesen()` (= einer der drei) | Haken der Reparaturanfrage im Konto-Dokument, über `hatKonto()` (Weggang schließt mit) — RK §20 |
| `produktGesichert()`, `teigeckeGesichert()` | Sicherungsmuster: im selben Schreibvorgang entsteht ein **neues** Sicherungsdokument (`getAfter`), dessen `vorher` gleich dem bisherigen Dokument ist (`vorher == resource.data`) |

**Muster für neue Pflege-Sammlungen** (Teigecke, Produkte, ✅): `hasOnly`-Feldliste, `allow delete: if false` (archivieren statt löschen, Feld `geloescht`), Herkunft (`geaendertVon == kennung()`, `geaendertAm == request.time`), Sicherung je Schreibvorgang. Begründungen: `REGELN_KOMPENDIUM.md`.

### 3.2 Alle Sammlungen

**Konten und Identität**

| Sammlung | Lesen | Schreiben | Seiten | Bemerkung |
|---|---|---|---|---|
| `bos_accounts` | eigenes Dokument (`get`); Liste nur Generalschlüssel | nur Generalschlüssel | Tür, Launcher, Kontenverwaltung, jede Seite mit `bos_accounts.js` | Dokument-ID = Kennung. Felder u. a. `role`, `overrides`, `freigeschaltet`, `taskboardAbhaken`, `teigeckePflege`, `teigeckeTeige`, `teigeckeRezepte`. Die Lese-Einschränkung (26.09.) erledigt BAUSTELLEN #34 in der Regel |
| `bos_profil_einstellungen` | nur eigenes: `profilId == 'konto_' + kennung()` | dto. | `bos_profil_sync.js` | **Berichtigt:** Die alte Fassung nahm eine „offene Regel" an; es gibt einen eigenen Block |
| `personen` | Generalschlüssel, Planung, eigene Person | anlegen/löschen: Generalschlüssel; ändern: Planung, ohne `bosKontoId` zu ändern | 12 Seiten (SchichtPlaner, Wunschtag, Mein Konto, Kontenverwaltung) | Stammdaten SchichtPlaner (P-Nummern), Verknüpfung zum Konto über `bosKontoId`. Feld `imSchichtplan` (#59, **fehlt = im Plan**; `false` = gehört zum Betrieb, wird nie eingeteilt; kein Ersatz für `aktiv`). **Planungsseiten lesen `personen` nur über `bos_namen.js`** (`personenFuerPlanung`, im offiziellen Plan und Personen-Editor `personenAlle`); Wächter-Test `waechter_59.js` (Prüfwerkzeug, nicht im Repo). Regel unverändert (keine Feldliste) |
| `namen` | jeder mit Konto | Generalschlüssel: `beschreibung`; Besitzer: nur `rufname` (≤ 20) | `bos_namen.js`, Mein Konto, Kontenverwaltung | `{ beschreibung, rufname }` je Nummer |
| `konten` | Planung, eigene Person | Planung | Offizieller Plan, Entwürfe, Bankkonto, Krankmelder, Mein Konto | **Ausgleichskonto (Punkte) je Person**, nicht die Anmeldekonten |

**Ereignisse**

| Sammlung | Lesen | Schreiben | Bemerkung |
|---|---|---|---|
| `bos_events` | jeder mit Konto; Einreichungen nur eigene oder Planung | anlegen: jeder mit Konto (Einreichungen nur eigene oder Planung; `verbrauch_offiziell` nur Planung). Ändern/Löschen: `verbrauch_manuell` nur Generalschlüssel, `verbrauch_offiziell` nur Planung | Append-Prinzip mit `type`-Feld. **Typen:** `froster_zaehlung`, `froster_produktion`, `produktionsplan_einreichung`, `produktionsplan_nachtrag`, `verbrauch_manuell`, `verbrauch_offiziell`, `produktionsleiter_aufgabe`, Einreichungen `schichtplaner_wunschtag`, `urlaub_anfrage`, `sonntag_ablehnung`. ⚠️ Nicht append-only: Ein Kollege kann fremde Nicht-Einreichungen ändern/löschen (BAUSTELLEN #35) |

**Planung (SchichtPlaner)**, alle ✅

| Sammlung | Lesen | Schreiben |
|---|---|---|
| `plaene` (Doc-ID = Montag ISO) | Planung | Planung |
| `positionen` | Planung | Planung |
| `abwesenheiten` | Planung | Planung |
| `fruehschicht_einsaetze` | Planung | Planung |
| `sonntagsplan` | jeder mit Konto (E24) | Planung |
| `einstellungen/*` | Planung | Planung (außer den Zählern) |
| `einstellungen/personen_nummern`, `einstellungen/konten_nummern_*` | Generalschlüssel | Generalschlüssel, Zahl `hoechste` darf nur steigen |

**Technik und Zeit**

| Sammlung | Lesen | Schreiben | Bemerkung |
|---|---|---|---|
| `bos_zeitkontext` | jeder mit Konto | Planung | Doc-ID = Datum, Last-Write-Wins |
| `bos_regelstand` | jeder mit Konto, nur `get` auf die freigegebenen Fassungen | niemand | **Regelstand-Probe**, siehe §3.3 |

**Produkte**

| Sammlung | Lesen | Schreiben | Bemerkung |
|---|---|---|---|
| `produkte` | jeder mit Konto | Rolle admin, Stand steigt, Feldliste `produktFelder()`, Sicherung; löschen nie | Doc-ID = `legacyKey`. Rezeptmengen stehen hier **nicht** |
| `produkte_sicherungen` | Rolle admin | Rolle admin, nur anlegen. Aktionen `anlegen, aendern, archivieren, wiederherstellen, einspielen, export` | Vorversion je Änderung; Sammel-Sicherung beim Einspielen |
| `produkte_stand` | `get` jeder mit Konto | nur `aktuell`, Rolle admin, `nummer` steigt | Stand-Zettel für `bos_produkte.js` |

**Teigecke** (Rechte über die Haken aus §2.9)

| Sammlung | Lesen | Schreiben |
|---|---|---|
| `teigecke_orte` | jeder mit Konto | `darfWagen()`; Doc-ID = Kennung klein (`b01`), Kennung `^[A-Z][0-9]{2,3}$` |
| `teigecke_zutaten` | jeder mit Konto | `darfWagen()`; Feld `gruppe` (Mehle & Schrote, Körner & Saaten, Flüssiges, Salz & Backmittel, Vorstufen & Anstellgut, Kühlung, Silo, Sonstiges) |
| `teigecke_teige` | jeder mit Konto | `darfRezepte()`; u. a. `langzeit`, Vorstufe, WinBack-Felder |
| `teigecke_rezeptmengen` | **nur `darfRezepte()`** | `darfRezepte()`; Feld `eingabe` (Map). Die geheimen Mengen |
| `teigecke_teigwerte` | jeder mit Konto | `darfTeige()`; Wasser- und Mehl-Regel, Tabelle, Einwaagen, Kessel, Langzeit-Hefe Sommer/Winter |
| `teigecke_einstellungen` | jeder mit Konto | `darfTeige()`; nur `allgemein`, `jahreszeit` ∈ sommer/winter |
| `teigecke_sicherungen` | `darfRezepte()`; Sicherungen anderer Sammlungen als Rezeptmengen auch `darfWagen()`/`darfTeige()` | nur anlegen, passend zum Haken der Ziel-Sammlung |
| `teigecke_naechte` (Doc-ID = Datum) | jeder mit Konto | `darfNacht()`; Felder u. a. `brote`, `vorrat`, `vorratHaken`, `vorstufeWahl`, `langzeit` |
| `teigecke_nacht_anpassungen` | jeder mit Konto | `darfNacht()`; nur `aktuell` |

**NFC**

| Sammlung | Lesen | Schreiben |
|---|---|---|
| `nfc_sammelblaetter` | Generalschlüssel | Generalschlüssel, ≤ 9 Zeilen, nur Ziel-`id`s, nie Adressen |

**Reparaturanfrage** (seit 10.10., RK §20)

| Sammlung | Lesen | Schreiben |
|---|---|---|
| `meldungen` (Kopf) | `darfMitlesen()`, Abfrage **muss** `kanal == 'hausmeister'` filtern | anlegen: `darfMelden()`, Startzustand fest, `von == kennung()`; ändern: `darfBearbeiten()`, nicht im Archiv, nur zusammen mit einem **neuen** Verlaufseintrag (`letzterEintrag`, `!exists`/`existsAfter`); löschen nie |
| `meldungen/{id}/verlauf` | wie der Kopf | Nachricht: `darfMitlesen()` (≤ 300); Status/Fenster/Dringlichkeit: `darfBearbeiten()`, `vorher`/`nachher` = Kopf vorher/nachher; nie ändern/löschen; nicht im Archiv |

Indizes: Posteingang offen (`kanal ==`, `status in`) ohne Zusatz-Index gelaufen (10.10.); grüne Woche/Archiv (`kanal` ↑, `status` ↑, `repariertAm` ↓) zusammengesetzt — **angelegt 10.10.2026** (Ulf, Firebase-Konsole) ✅

**Faustregel (unverändert):** Zustand (mutierbar, ein Dokument je Sache) → eigene Sammlung. Ereignisreihe → `bos_events` mit `type`, nicht je Satellit eine Sammlung.

**Schreib-Konventionen:**
- Zeitstempel `firebase.firestore.FieldValue.serverTimestamp()` (in der Regel als `request.time` geprüft).
- `bos_events` **nie ohne `.where('type', '==', …)`** abfragen. Wo nur Eigenes lesbar ist, ausdrücklich nach der eigenen Kennung filtern; sonst scheitert die ganze Abfrage (Checkliste §4a).
- `.where()` + `.orderBy()` verlangt meist einen Composite-Index; der Konsolen-Link beim ersten Aufruf ist normal.
- Fehler sichtbar machen: `err.message` in der Oberfläche, nicht nur `console.error` (Projektregel, Checkliste §7a).

### 3.3 Regelstand und Regeldatei

| Was | Stand |
|---|---|
| Eingesetzte Datei | `firestore_regeln_2026-10-10_reparatur.rules` (seit 10.10.2026, ~10:04), liegt **außerhalb** des Repos ✅. Rückweg: `…_2026-10-08_teigecke_nacht.rules` |
| Größe | **23.960 Zeichen** (Python `len`) — **über** der Tablet-Kopiergrenze 20.000. Eingesetzt in **zwei Kopierkästen** (13.649 + 10.311, Schnitt nach `bos_regelstand`), Ulf 10.10., 08:46: kein Platz schaffen. Jede künftige Regel kommt ebenso in zwei Kästen ✅ |
| Zählen | Zeichen, nicht Byte: `LC_ALL=C.UTF-8 wc -m` oder Python (Fehler Nr. 10 vom 08.10.) |
| Fassungen in `bos_regelstand` | `teigecke-2026-10-02`, `teigecke-orte-2026-10-03`, `nfc-qr-2026-10-04`, `produkte-2026-10-05`, `produkte-sicherung-2026-10-06`, `teigecke-rezepte-2026-10-07`, `teigecke-nacht-2026-10-08`, `reparatur-2026-10-10` ✅, `richtwert-2026-10-14` ✅ (eingesetzt 15.10., RK §22; geprüft nur vom Produkt-Editor) |
| Wer probt | `teigecke_seite.js`, `teigecke_nacht.html`, `nfc_qr_zentrale.html`, `produkt_config_editor.html`. Sie fragen „ist meine Fassung eingesetzt?" und zeigen sonst einen Hinweis statt einer rohen Ablehnung ✅ |
| Begründungen | `REGELN_KOMPENDIUM.md` (zwölfte Fassung, RK §1–§19) |

**Bei jeder neuen Regelfassung, im selben Auftrag:** Fassung in die `bos_regelstand`-Liste der Regel; Probe in der Seite; `pruefung_fremd.html` nachziehen (sonst meldet sie die neue Fassung als unbekannt); Eintrag im Regeln-Kompendium; Zeichen zählen. Ulf: „lieber ordentlich und lang als falsch und kurz", notfalls zwei Kopierkästen.

---

## 4. Ordner und Pfade

- Root-Dateien referenzieren sich untereinander ohne Präfix; Unterordner mit `../`.
- Ordner sind nach Hub/Thema gruppiert, nicht 1:1 je Satellit. Heute: `aufgaben/`, `backstore/`, `druckzentrale/`, `froster/`, `konten/`, `mein_konto/`, `nfc_qr/`, `produkt_config/`, `produktionsplaner/`, `schichtplaner/`, `schnelldruck/`, `schnellrechner/`, `stempeluhr/`, `taschenrechner/`, `teigecke/`, `urlaub/`, `verbrauch/`, `verbrauch_einstellungen/`, `wunschtag/`, `zeitkontext/`, dazu `pwa/`, `bos_backgrounds/`. ✅ (Prüf-Repo)
- **Was ins Repo gehört, was nicht** (seit 04.10.): Produktivdateien ja. Tests, Attrappen, Prüfskripte, Dokus, Regeldateien, Migrationsdateien **nein**. Die Tests brauchen die Produktivdateien im selben Ordner, gehören also in Ulfs Arbeitsordner neben das Repo, nicht hinein. **Namen von Kollegen nie in Kommentare** (Online-Gang §3.1).

⚠️ **Falle: Registry-`id` ≠ Dateiname ≠ Ordnername ≠ Hub-`id`.** Beispiel: `froster/froster_inventur.html` hat die `id` `freezer_inventur`, Hub `freezer`. `BOS_APP_ID` muss exakt der Registry-`id` entsprechen, egal wie Datei oder Ordner heißen. Bei direkt aufrufbaren Seiten zusätzlich `bos_code_adressen.json`.

## 4a. Prüfwerkzeuge (außerhalb des Repos)

**Arbeitsordner heißt `bos` (Ulf, 12.10.2026, 08:29: „Ja zukünftig bos“).** Ulf arbeitet direkt im GitHub-Ordner `bos`. Werkzeuge, die eine Ebene darüber liegen (`pruefung_fremd.html`, `testdaten_loeschen.html`), laden die geteilten Dateien deshalb über `bos/…` (früher `baeckereios/…`). Sie liegen **neben** `bos`, nie darin, sonst lädt GitSync sie hoch. `pruefung_fremd.html` ist seit 12.10., 08:28 umgestellt (KC). `testdaten_loeschen.html` ist noch nicht geprüft. *(Eintrag Kontroll-Chat Reparaturanfrage, 12.10., 08:30)*

| Werkzeug | Zweck | Stand |
|---|---|---|
| `pruefung_fremd.html` | Prüft am echten System mit einem Konto, welche Türen auf- und zu sind. Fälle A–K (H mit Admin-Passwort, J Produkte, K Teigecke mit Haken), Knöpfe „Bericht kopieren / speichern". **Nach jeder Regeländerung aufrufen** | Fassung Stufe 2 (Bau-Chat Reparaturanfrage, 12.10.) mit Fall L und M, Pfade auf `bos/` umgestellt (KC, 12.10., 08:28). Regelstand: Firestore `reparatur-2026-10-10`, Speicher `speicher-2026-10-12` |
| `test_teigecke.js` | Rechnung, Ablauf, Wächter der Teigecke | Stand Nachtrag 08.10. (Bau-Chat), Ort der Suite nennt die Bau-Doku |
| `test_nfc_qr.js` | Wächter Registry ↔ `bos_code_adressen.json`, Feld `direkt` ↔ Seite | ✅ |
| `pruefe_*.js` (9 Werkzeuge Produkte) | Lade-Datei, Gleichheit, Sync-Vorschau, Editor-Schlüssel, Regel-Nachbildung | `PRODUKTE_KOMPENDIUM.md` §4d/§4g |
| übrige `test_*.js`, `fake_*.js`, `harness_funcs.js` | SchichtPlaner-Rechnung, Namen, Generalschlüssel u. a. `fake_firebase.js` enthält Admin-Kennungen im Klartext, **nie hochladen** | Online-Gang §5.1 |

**Grenze der Prüfseite:** Sie kann „Block fehlt" nicht von „Block verbietet" unterscheiden, beides ist `permission-denied`. Unterscheidend sind nur **erlaubte** Zeilen; deshalb bei jedem neuen Block eine erlaubte Zeile mitprüfen (PRODUKTE_KOMPENDIUM P28).

---

## 5. Bekannte Abweichungen und offene Verkabelung (Stand 08.10.2026)

Bei Behebung hier streichen bzw. aktualisieren, nicht nur in der Session-Doku.

| # | Abweichung | Stand / Quelle |
|---|---|---|
| 1 | ~~Rollout-Lücke `bos_permissions.js`/`bos_access.js`~~ | **Erledigt 04.09.** |
| 2 | ~~PIN-Zentralisierung unvollständig~~ | **Erledigt anders als geplant:** Seit 22.09. werden PIN-Schleusen ausgebaut statt verschleiert (BAUSTELLEN #6). Die letzten beiden (Verbrauch-Einstellungen, Produkt-Sync) wurden am 04.10. entfernt, `bos_pin_config.js` ausgelagert (Online-Gang §3.2). Was die PIN scheinbar schützte, schützen die Regeln 📄 |
| 3 | ~~Changelog-Doppelspur~~ | **Aufgelöst 04.10.:** `bos_launcher_changelog.json` las keine Seite, ausgelagert. Es gilt nur der Datei-Kopf-Changelog 📄 |
| 4 | ~~`bos_events`-Host-Interpreter fehlt~~ | **Entfallen 05.09.** (unverändert) |
| 5 | ~~`needs[]` für `bos_produktionskette.js` fehlt~~ | **Erledigt:** `holeWochenbedarf()` liefert das fertige Array; Stationsseiten und Schnellrechner nutzen es ✅ |
| 6 | `bos_zeitkontext.js`/`bos_hamster.js`-Integration in der Kette nur gegen Doku gebaut | **Offen, nicht nachgesehen.** Die Kette ruft beide (7 Stellen), eine Prüfung gegen echte Zeitkontext-Einträge ist nicht dokumentiert 📄 |
| 7 | ~~Guard × Konto-Profile~~ | **Erledigt 31.08.** |
| 8 | ~~Alte lokale Profile folgen nicht dem Gerät~~ | **Überholt 19.09.:** Die Identität kommt aus dem Konto an der Tür (BAUSTELLEN #5) |
| 9 | ~~Profil-Lookup dreifach~~ | **Erledigt 05.09.** |
| 10 | `bos_profil_sync.js` ungetestet mit zwei Geräten | **Halb erledigt:** Die Regel-Annahme ist durch einen eigenen Block ersetzt ✅. Ein Live-Test mit zwei Geräten ist nicht dokumentiert 📄 |
| 11 | **Doku-Drift Rollen:** alte Fassung `baecker`/`konditor` | **Berichtigt in dieser Fassung** (§2.2). BAUSTELLEN #26/#32 |
| 12 | ⚠️ `bos_zoom_sync.js` wird von keiner Seite eingebunden | Am Online-Repo prüfen: Altlast (auslagern) oder fehlende Einbindung? Ulf entscheidet |
| 13 | ⚠️ `bos_zugriff_anzeige.js` liegt im Prüf-Repo noch, ist seit 20.09. ersetzt; Alias in `bos_access.js` | Am Online-Repo prüfen, ggf. auslagern; danach kann der Alias weg |
| 14 | ⚠️ Kopie von `qrcode.min.js`/`QRCODE_LICENSE` in `teigecke/` im Prüf-Repo | Am Online-Repo prüfen; geladen wird nur die Wurzel-Datei |
| 15 | Checkliste §4a nennt bei `hatKonto()` den Haken `freigeschaltet` noch nicht | Checkliste beim nächsten Durchgang nachziehen; maßgeblich ist §3.1 hier |
| 16 | ~~Regeldatei hat **80 Zeichen Luft**~~ | **Entschieden 10.10. (Ulf):** kein Platz schaffen, Regel in zwei Kopierkästen (seit RK §20 Standard). Firebase CLI vom PC bleibt Parkplatz (P18) |
| 17 | ~~`pruefung_fremd.html` kennt `teigecke-nacht-2026-10-08` nicht~~ | **Erledigt 10.10.** mit Fall L (Prüfseite `2026-10-10 09:33`, Bau-Chat N1) |
| 18 | `bos_events` nicht append-only für Nicht-Einreichungen | BAUSTELLEN #35, unverändert |
| 19 | UID-Bindung in `hatKonto()` fehlt | BAUSTELLEN #33 / T-140, nicht dringend (Registrierung aus) |
| 20 | `bos_accounts.js` trägt noch die Vor-Konto-Wege (`registriereNeu`, `loginMitPin`, `pruefeKonto`) und Altfelder (`pin`, `geburtsdatum`) | Ob noch ein Aufrufer existiert, nicht nachgesehen. Aufräumen nur mit Auftrag 📄 |

---

## 6. Verwandte Dokumente (bewusst nicht dupliziert)

- `BOS_NEUER_SATELLIT_CHECKLISTE.md` (22.09.): Bauprozess, Design-Tokens, i18n, Hilfe, Fehleranzeige §7a, Regel-Pflicht §4a
- `BOS_BAUSTELLEN.md` (24.09.): projektweite offene Punkte
- `BOS_REBUILD_FUNDAMENT.md`: Grundsatzentscheidungen. ⚠️ §1.1 (Auth „Anonymous", Regel `request.auth != null`) ist seit 22.09. überholt
- `REGELN_KOMPENDIUM.md` (zwölfte Fassung): jede Regel mit Begründung, Prüffälle
- `PRODUKTE_KOMPENDIUM.md` (18. Fassung): Produkte aus Firestore, Stand-Zettel, Sicherung
- `NAMENSMODELL_KOMPENDIUM.md`: Person, Konto, Rufname, `namen`
- `SCHICHTPLANER_V2_KOMPENDIUM.md`: SchichtPlaner, Auth-Umstellung (§21), Funde F-xx, Aufgaben T-xxx
- `2026-10-04_ONLINE_GANG.md`: was ins Repo gehört, GitHub-/PWA-Dateien
- `NFC_QR_ZENTRALE_DOKU.md` / `NFC_QR_ZENTRALE_KOMPENDIUM.md`
- `TEIGECKEN_FUEHRUNG_KONZEPT.md`, `TEIGECKE_NACHT_DOKU.md`, `TEIGECKE_ORTE_DOKU.md`, `TEIGECKE_REZEPTE_DOKU.md`
- `2026-10-02_PFLEGE_STELLSCHRAUBEN.md`: Pflege-Register (u. a. `produktFelder()`, Erinnerungsfristen)
- Modul-Dokus: `BOS_ACCOUNTS_DOKU.md` (Stand 31.08., in Teilen überholt), `BOS_PRODUKTIONSKETTE_DOKU.md`, `BOS_ZEITKONTEXT_DOKU.md`, `BOS_PROFIL_SYNC_DOKU.md`, `BOS_TASKBOARD_DOKU.md`, `AUFGABEN_VERWALTUNG_DOKU.md`, `PRODUKT_CONFIG_EDITOR_DOKU.md`

**Hinweise an andere Dokumente (nicht hier zu ändern):**
- `BOS_BAUSTELLEN.md`: #32 ist mit dieser Fassung erledigt. #34 ist laut Regel seit 26.09. erledigt. #46 (letzte PIN-Schleuse) ist seit 04.10. erledigt. Alle drei stehen dort noch offen.
- `BOS_NEUER_SATELLIT_CHECKLISTE.md` §2a kann auf diese Datei zurückverweisen; §4a um `freigeschaltet` ergänzen (§5 Nr. 15).
- `PRODUKTE_KOMPENDIUM.md` P22 ist erledigt.

---

## Änderungsprotokoll

| Datum | Änderung |
|---|---|
| 31.08.2026 | Erstversion aus Projekt-Doku, nicht gegen Originaldateien geprüft |
| 31.08.2026 | Aufteilung mit der Checkliste; Registry-Felder, Firestore-Konventionen übernommen |
| 04.09.2026 | Abschnitt 1a (Standalone-Login); §5 Nr. 1 und 7 aktualisiert |
| 05.09.2026 | 1a-Korrektur (Kopf), `var db`-Falle; §5 Nr. 4 entfallen; `bos_aufgaben_logik.js`, `bos_taskboard.js`, `bos_profil_lookup.js`, `bos_profil_sync.js`, `bos_profil_einstellungen`; `bos_events`-Typen ergänzt |
| 06.09.2026 | 1a ein zweites Mal korrigiert (Body-Reihenfolge laut `bos_standalone_login.js`) |
| **08.10.2026, 15:37** | **Vollständige Überarbeitung** (Kontroll-Chat Teigecke, auf Ulfs Auftrag; erledigt BAUSTELLEN #32 und PRODUKTE_KOMPENDIUM P22). Neu: §0 Gerüst; §1/§1a nach aktuellem Code (Theme- **und** Dichte-Sync, `noindex`, `bos_access.js` Pflicht, Standalone-Login ohne eigenen Login, Referenzseiten); §1b Tür/Launcher/Anmeldemodell; §2.1 `bos_density_sync.js`, `bos_zoom_sync.js`; §2.2 Rollen berichtigt (9 Rollen, `backstube`/`konditorei`), Matrix 8 Rollen, Registry-Felder `pinned`/`bereich`/`direkt`, `bos_access.js`-API, `bos_zugriff_anzeige.js` entfallen; §2.3 `bos_konto_profil.js`, `bos_namen.js`, `BOS_ACCOUNTS`-API; §2.4 Namespaces bestätigt; §2.5 Bootscreen/Screensaver nachgetragen; **§2.6 Produkte neu** (Datei weg, `bos_produkte.js`, `bos_produkte_schreiben.js`, Glossar-Kopplung); §2.7 SchichtPlaner-Rechenmodule; §2.8 Druck/QR/NFC; §2.9 Teigecke; §2.10 weitere Dateien und Auslagerungen vom 04.10.; **§3 komplett neu** aus der eingesetzten Regeldatei (Bausteine, 27 Sammlungen, Regelstand, 80 Zeichen Luft); §4 Ordnerliste und Repo-Grenze; §4a Prüfwerkzeuge; §5 Nr. 2, 3, 5, 8, 10 aufgelöst bzw. aktualisiert, Nr. 11–20 neu; §6 aktualisiert. **Grundlage:** Prüf-Repo (Zip 30.09. + Teigecke-Lieferungen bis 08.10.), Regeldatei vom 08.10., Dokus. **Nicht** gegen das Online-Repo geprüft; `bos_produkte.js`/`bos_qr.js` nur aus Dokus |
| **15.10.2026, 06:58** | Richtwert #63 (Kontroll-Chat Richtwert/Einheiten, Lieferung geprüft): `bos_produkte.js` Sicht `laufend` und Richtwert-Funktionen, `bos_verbrauch_durchschnitt.js` Topf `richtwert`, `anzahl`, `durchgang()`; Regelstand-Fassung `richtwert-2026-10-14`. `produkte`: `produktFelder()` +`bedarfsQuelle`, `richtwert`, `pausiert` (RK §22). **Eingespielt 15.10., 08:15** |
| **11.10.2026, 10:21** | Reparaturanfrage Nachtrag 2 (Kontroll-Chat Reparaturanfrage): Eintrag `bos_meldungen.js` um v0.2 und den Gerätespeicher-Schlüssel ergänzt. Keine Regeländerung |
| **11.10.2026, 09:30** | #59 „gehört in den Schichtplan“ (Kontroll-Chat Reparaturanfrage, Textbausteine aus der Bau-Doku 22:29): `bos_namen.js` um die Personen-Ladefunktion ergänzt, Zeile `personen` um `imSchichtplan` und den Ladeweg. Keine Regeländerung |
| **10.10.2026, 10:34** | Reparaturanfrage Stufe 1 (Kontroll-Chat Reparaturanfrage): Registry-Feld `haken`, `can()` mit viertem Parameter (sieben Aufrufer), Profilfeld `kontoHaken`, Rückfall ohne Netz, Setzer in `bos_accounts.js`, neuer Abschnitt §2.9a, Regel-Baustein `reparaturHaken`, Sammlungen `meldungen` + `verlauf`, §3.3 Regeldatei 23.960 Zeichen in zwei Kästen, §5 Nr. 16/17 erledigt |
| 16.10.2026, 19:39 | §2.9: Mitbenutzer des Teigecken-Gerüsts außerhalb von `teigecke/` (Teigrechner Stufe 1, #67), Satz aus der Bau-Doku §7; Haken `weitereTeige`. Eingetragen vom Buchhalter nach der Übergabe des Kontroll-Chats Teigrechner (18:57) |
| 17.10.2026, 04:37 | §2.5: `bos_ungespeichert.js` (#77), eingetragen vom Buchhalter nach dem Go des Kontroll-Chats |
| 17.10.2026, 08:24 | §2.5: `bos_crumble_host.js`, Ladereihenfolge und Ebenen für Crumble (#62 Stufe 1, Texte Bau-Doku §5) |
| 17.10.2026, 14:18 | §2.5 `bos_crumble_host.js`: Anker `#desktop`, Bühne Ebene 300 (#62 Stufe 1c, Laufzettel KC 14:11 §9) |
| 18.10.2026, 14:04 | §2.5 neu `bos_tuer_crumble.js` (Aufrufer `index.html`), Status `bos_crumble_host.js` (#62 Stufe 1e, Übergabe KC 13) |
| 19.10.2026, 00:47 | §2.5 `bos_tuer_crumble.js`: seit 1f eigenständig (`hamster_figur/loch/`), nicht mehr über `hamster_figur.js` (#62 Stufe 1f, Übergabe KC 17) |
| 19.10.2026, 19:02 | §2.9b neu: `bos_foto.js`, Ordner `backzettel/` (#100, Übergabe KC Backzettel 18:47, Text Bau-Doku §B.8) |
| 20.10.2026, 07:37 | §2.9b: Einstellungen aus Firestore, `HUB_UMZUEGE` im Launcher (#103, Text Bau-Doku 1b §B.9) |
| 21.10.2026, 03:58 | §2.3 `bos_accounts.js`: `setzePasswort`, `aendereAdminPasswort`, erste Cloud Function (#106) |
| 21.10.2026, 11:54 | Wurzeldateien: neu `bos_backstore_texte.js`; `bos_app_registry.js` mit `BOS_BEREICHE`/`BOS_BEREICH_VON` (#110, Übergabe KC BackStore 11:26, Bau N4) |
| 23.10.2026, 23:30 | Satellit `maschinenseite/` neu; `bos_permissions.js` mit `haustechnik` (#115 Stufe A, Übergabe KC Maschinenseite 23:21) |
| 24.10.2026, 10:08 | `maschinenseite/` Stufe B; Kärtchen-Ziele in `nfc_qr_logik.js` (#115, Übergabe KC Maschinenseite 09:38) |
| 26.10.2026, 07:50 | Wurzeldatei `bos_produkte_anlegen.js` neu (#100 Stufe 2a, Übergabe KC Backzettel 07:43) |
| 26.10.2026, 17:36 | §2.5: Wurzeldatei `bos_kachel_zahlen.js` neu, Registry-Feld `zaehler` (Nachrichtenzentrale Stufe 1a, #131; Bau-Chat) |

---

*Bei Widersprüchen zwischen dieser Datei und direkten Anweisungen von Ulf gilt immer die direkte Anweisung. Bei Widersprüchen zwischen dieser Datei und der echten Datei im Repo gewinnt die echte Datei; dann hier nachziehen, nicht die Diskrepanz stehen lassen.*
