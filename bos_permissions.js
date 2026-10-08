/* ================================================================
   BäckereiOS · Berechtigungen — Rolle × Satellit → Standard
   ================================================================
   Einzige Wahrheit für "darf Rolle X auf Satellit Y zugreifen?".
   Wird von bos_access.js gelesen (BOS_ACCESS.can()), genutzt von
   bos_access_guard.js (Satelliten-Zugriff) UND launcher.html
   (Kachel-Sichtbarkeit) — eine Mechanik, viele Aufrufer.

   FRÜHER .json, JETZT .js: Der Guard muss VOR dem Rendern der Seite
   blockieren können (siehe bos_access_guard.js) — das geht nur mit
   synchronem <script>-Laden, nicht mit async fetch(). Deshalb hier
   derselbe Trick wie bei bos_app_registry.js und
   bos_launcher_profiles.js: reines JS, window.BOS_PERMISSIONS
   direkt gesetzt, kein JSON.parse nötig.

   Fehlt ein Satellit bei einer Rolle, gilt false — EXCEPT: taucht
   der Satellit in GAR KEINER Rolle hier auf (auch nicht bei admin),
   gilt das als "noch nicht konfiguriert" und BOS_ACCESS.can() fällt
   auf offen zurück (fail-open) — genau wie früher die Registry-Prüfung
   ("Konfigurationsfehler soll dich nicht selbst aussperren"). Siehe
   bos_access.js für die genaue Logik.

   PFLEGE: Diese Datei ist jetzt der Rollen-Standard-Teil der
   Berechtigung. Person-Overrides (kontoOverrides) laufen weiterhin
   separat über bos_accounts / die Freischaltungs-Tabelle und haben
   Vorrang — siehe BOS_ACCESS.can().

   OFFEN, NICHT VON HIER AUS GEFIXT: konten_verwaltung.html (Freischal-
   tungs-Tabelle) hat bisher vermutlich bos_permissions.json per
   fetch() gelesen, um die Standard-Haken zu setzen. Diese Datei muss
   dort auf ein <script src="../bos_permissions.js"> + window.BOS_PERMISSIONS
   umgestellt werden, sonst liest die Tabelle ins Leere. Datei lag mir
   für diesen Schritt nicht vor — bitte separat prüfen.

   EINBINDUNG (neue Reihenfolge in jedem Satelliten):
     <script>var BOS_APP_ID = 'freezer';</script>
     <script src="bos_app_registry.js"></script>
     <script src="bos_launcher_profiles.js"></script>
     <script src="bos_permissions.js"></script>   <!-- NEU -->
     <script src="bos_access.js"></script>         <!-- NEU -->
     <script src="bos_access_guard.js"></script>
     ... restlicher Seiteninhalt ...
   ================================================================ */
/* KORREKTUR 20.09.2026 (Etappe 3.2): schichtplaner_offizieller_plan bei
   backstube und konditorei entfernt. Der offizielle Plan ist ein
   Führungswerkzeug; die Rollenunterscheidung lag bisher clientseitig IN
   der Seite. Registry mitgezogen. Ersatz für alle anderen ist ein reiner
   Lese-Satellit (noch zu bauen).

   KORREKTUR 17.09.2026 (siehe SESSION_2026-09-17_AUTH_UMSTELLUNG_ETAPPE_0.md,
   Fund F-7): fünf Satelliten mit roles-Feld standen bei KEINER Rolle in dieser
   Datei. Laut der Fail-open-Regel oben galten sie damit als "noch nicht
   konfiguriert" und waren für JEDE Rolle offen — auch aufgaben_verwaltung,
   dessen Registry-Kommentar ausdrücklich "Rollenprüfung reicht" sagt.
   Ergänzt: freezer_ziele, aufgaben_verwaltung, druckzentrale,
   druckzentrale_fruehschicht, druckzentrale_absetz — jeweils mit den Rollen
   aus dem roles-Feld der Registry.

   Zusätzlich korrigiert: freezer_produktion stand nur bei admin, obwohl die
   Registry seit 05.09.2026 admin/backstube/konditorei nennt (gleiche Rollen
   wie die Nachbarn im selben Hub). Backstube und Konditorei ergänzt. */
/* NEU 03.10.2026 (14:47): nfc_qr_zentrale nur bei admin, wie das roles-Feld der
   Registry (Registry = Rechte-Matrix, test_nfc_qr.js). */
/* NEU 08.10.2026: Kind teigecke_rezepte („Teige & Rezepte“) bei denselben drei
   Rollen wie teigecke_orte (Registry = Rechte-Matrix, test_teigecke.js Teil 8). */
/* NEU 03.10.2026: Hub teigecke und Kind teigecke_orte bei denselben drei
   Rollen wie teigecke_nacht (Registry = Rechte-Matrix, test_teigecke.js Teil 8). */
/* NEU 28.09.2026 (10:33): teigecke_nacht bei backstube, produktionsleitung
   und admin — dieselben drei Rollen wie das roles-Feld der Registry
   (Checkliste §12: Registry und Matrix übereinstimmend). Siehe
   SESSION_2026-09-28_TEIGECKEN_STUFE1_BAU.md. */
window.BOS_PERMISSIONS = {
  "backstube": {
    "freezer": true,
    "freezer_inventur": true,
    "verbrauch_manuell": true,
    "zeitkontext_editor": true,
    "schnellrechner": true,
    "produktionsplaner": true,
    "produktionsplaner_uebersicht": true,
    "produktionsplaner_rondo": true,
    "produktionsplaner_broetchenstrasse": true,
    "produktionsplaner_fruehschicht": true,
    "produktionsplaner_nachtschicht": true,
    "wunschtag": true,
    "urlaub_anfrage": true,
    "mein_konto": true,
    "schichtplaner": true,
    "freezer_produktion": true,
    "freezer_ziele": true,
    "druckzentrale": true,
    "druckzentrale_fruehschicht": true,
    "druckzentrale_absetz": true,
    "teigecke": true,
    "teigecke_nacht": true,
    "teigecke_orte": true,
    "teigecke_rezepte": true
  },
  "konditorei": {
    "freezer": true,
    "freezer_inventur": true,
    "verbrauch_manuell": true,
    "zeitkontext_editor": true,
    "schnellrechner": true,
    "produktionsplaner": true,
    "produktionsplaner_uebersicht": true,
    "produktionsplaner_rondo": true,
    "produktionsplaner_broetchenstrasse": true,
    "produktionsplaner_fruehschicht": true,
    "produktionsplaner_nachtschicht": true,
    "wunschtag": true,
    "urlaub_anfrage": true,
    "mein_konto": true,
    "schichtplaner": true,
    "freezer_produktion": true,
    "freezer_ziele": true,
    "druckzentrale": true,
    "druckzentrale_fruehschicht": true,
    "druckzentrale_absetz": true
  },
  "verkauf": {
    "verkauf": true
  },
  "kommissionierung": {
    "kommissionierung": true
  },
  "fahrer": {
    "fahrer": true
  },
  "verkaufsleitung": {},
  "produktionsleitung": {
    "verbrauch_manuell": true,
    "zeitkontext_editor": true,
    "schnellrechner": true,
    "wunschtag": true,
    "urlaub_anfrage": true,
    "mein_konto": true,
    "schichtplaner": true,
    "schichtplaner_entwuerfe": true,
    "schichtplaner_abwesenheiten": true,
    "schichtplaner_krankmelder": true,
    "schichtplaner_feiertage": true,
    "schichtplaner_sonntagsplan": true,
    "schichtplaner_einstellungen": true,
    "schichtplaner_offizieller_plan": true,
    "schichtplaner_bankkonto": true,
    "produktionsplaner": true,
    "produktionsplaner_uebersicht": true,
    "produktionsplaner_rondo": true,
    "produktionsplaner_broetchenstrasse": true,
    "produktionsplaner_fruehschicht": true,
    "produktionsplaner_nachtschicht": true,
    "aufgaben_verwaltung": true,
    "teigecke": true,
    "teigecke_nacht": true,
    "teigecke_orte": true,
    "teigecke_rezepte": true
  },
  "admin": {
    "settings": true,
    "freezer": true,
    "freezer_inventur": true,
    "freezer_produktion": true,
    "fahrer": true,
    "verkauf": true,
    "kommissionierung": true,
    "produkt_config": true,
    "produkt_config_editor": true,
    "produkt_config_sync": true,
    "verbrauch_einstellungen_editor": true,
    "verbrauch_manuell": true,
    "verbrauch_werkstatt": true,
    "zeitkontext_editor": true,
    "schnellrechner": true,
    "konten_verwaltung": true,
    "wunschtag": true,
    "urlaub_anfrage": true,
    "mein_konto": true,
    "schichtplaner": true,
    "schichtplaner_entwuerfe": true,
    "schichtplaner_personen": true,
    "schichtplaner_positionen": true,
    "schichtplaner_abwesenheiten": true,
    "schichtplaner_krankmelder": true,
    "schichtplaner_feiertage": true,
    "schichtplaner_sonntagsplan": true,
    "schichtplaner_einstellungen": true,
    "schichtplaner_offizieller_plan": true,
    "schichtplaner_bankkonto": true,
    "produktionsplaner": true,
    "produktionsplaner_uebersicht": true,
    "produktionsplaner_rondo": true,
    "produktionsplaner_broetchenstrasse": true,
    "produktionsplaner_fruehschicht": true,
    "produktionsplaner_nachtschicht": true,
    "freezer_ziele": true,
    "aufgaben_verwaltung": true,
    "druckzentrale": true,
    "druckzentrale_fruehschicht": true,
    "druckzentrale_absetz": true,
    "teigecke": true,
    "teigecke_nacht": true,
    "teigecke_orte": true,
    "teigecke_rezepte": true,
    "nfc_qr_zentrale": true
  }
};
