/* ================================================================
   BäckereiOS · Satellite — Theme-Sync
   ================================================================
   Liest das Theme (hell/dunkel), das der Launcher für das aktuell
   aktive Profil gespeichert hat, und setzt es auf DIESEM Dokument
   (data-theme auf <html>) — bevor bos_design_tokens.css ausgewertet
   wird, damit kein falsches Theme kurz aufblitzt.

   WARUM NÖTIG (28.08.2026, siehe SESSION_2026-08-28_THEME_SYNC.md):
   Jeder Satellit läuft als eigenes Dokument in einem eigenen iframe-
   Fenster. Ein data-theme, das der Launcher auf SEINEM <html> setzt,
   gilt nicht automatisch auch im Satelliten-Dokument — jede Seite
   muss es selbst lesen und selbst setzen. Bisher tat das keine der
   Satelliten-Seiten, weshalb sie unabhängig vom Launcher-Profil immer
   in ihrem eigenen fest codierten data-theme liefen.

   EINBINDUNG — im <head>, VOR bos_design_tokens.css, als eines der
   ersten Skripte (synchron, kein defer/async, damit es vor dem
   ersten Rendern fertig ist):

     <script src="../bos_theme_sync.js"></script>
     <link rel="stylesheet" href="../bos_design_tokens.css">

   WOHER: derselbe localStorage-Key, den der Launcher schreibt und
   auch bos_access_guard.js liest (bos_launcher_state_v2) — aber ein
   anderes Feld. Die Rolle liegt direkt auf dem Profil-Objekt, das
   Theme dagegen pro Profil in state.profileData[activeProfileId]
   .theme (siehe launcher.html, defaultProfileData()). Fehlt an
   irgendeiner Stelle ein Wert, ist 'dark' der Standard — exakt wie
   im Launcher selbst.

   ABSICHTLICHE GRENZE: Liest nur EINMAL beim Laden der Seite, wie
   bos_access_guard.js auch. Wechselt Ulf das Theme, während ein
   Satelliten-Fenster schon offen ist, zieht das nicht automatisch
   nach — dafür müsste die Seite neu geladen werden. Kein Live-Sync
   über mehrere gleichzeitig offene Fenster hinweg; aktuell kein
   konkreter Bedarf dafür.
   ================================================================ */

(function () {
  function leseTheme() {
    try {
      var raw = localStorage.getItem('bos_launcher_state_v2');
      if (!raw) return 'dark';
      var state = JSON.parse(raw);
      if (!state || !state.activeProfileId || !state.profileData) return 'dark';
      var data = state.profileData[state.activeProfileId];
      return (data && data.theme) ? data.theme : 'dark';
    } catch (e) {
      return 'dark';
    }
  }
  document.documentElement.setAttribute('data-theme', leseTheme());
})();
