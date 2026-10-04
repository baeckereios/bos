/* ================================================================
   BäckereiOS · Satellite — Dichte-Sync
   ================================================================
   Liest die Dichte-Einstellung (standard/kompakt), die der Launcher
   für das aktuell aktive Profil gespeichert hat, und setzt sie auf
   DIESEM Dokument (data-density auf <html>) — bevor
   bos_design_tokens.css ausgewertet wird, damit kein falscher Look
   kurz aufblitzt. 1:1 nach dem Muster von bos_theme_sync.js gebaut,
   gleicher Speicherort, gleiche Grenzen — siehe dortigen Kopfkommentar
   für die ausführliche Begründung, hier nur die Abweichungen.

   NEU 01.09.2026 (Ulf: "geht es nicht etwas filigraner... einstellbar
   machen?"): zweite, unabhängige Achse neben dem Theme — Theme
   entscheidet Farben (hell/dunkel), Dichte entscheidet Abstände/
   Schriftgrößen/Eckenradien (standard/kompakt). Beide Einstellungen
   werden getrennt gespeichert und wirken unabhängig voneinander.

   EINBINDUNG — im <head>, VOR bos_design_tokens.css, direkt nach
   bos_theme_sync.js (Reihenfolge der beiden untereinander egal, beide
   nur additiv auf verschiedene Attribute):

     <script src="../bos_theme_sync.js"></script>
     <script src="../bos_density_sync.js"></script>
     <link rel="stylesheet" href="../bos_design_tokens.css">

   WOHER: derselbe localStorage-Key wie Theme (bos_launcher_state_v2),
   aber eigenes Feld state.profileData[activeProfileId].density —
   bewusst neben .theme, nicht vermischt (zwei unabhängige Achsen,
   siehe oben). Fehlt ein Wert, ist 'standard' der Default — entspricht
   dem bisherigen, unveränderten Look alter Satelliten.

   ANNAHME, NICHT AM ORIGINAL GEPRÜFT (launcher.html lag nie vor, siehe
   §0 BOS_NEUER_SATELLIT_CHECKLISTE.md): Es gibt aktuell noch KEINE
   UI im Launcher, die state.profileData[...].density tatsächlich
   schreibt — dieses Skript liest nur vor. Bis diese UI existiert,
   bleibt jeder Satellit ohne manuellen localStorage-Eingriff auf
   'standard'. Siehe BOS_DICHTE_DOKU.md für den vollständigen Stand.
   ================================================================ */

(function () {
  function leseDensity() {
    try {
      var raw = localStorage.getItem('bos_launcher_state_v2');
      if (!raw) return 'standard';
      var state = JSON.parse(raw);
      if (!state || !state.activeProfileId || !state.profileData) return 'standard';
      var data = state.profileData[state.activeProfileId];
      return (data && data.density) ? data.density : 'standard';
    } catch (e) {
      return 'standard';
    }
  }
  document.documentElement.setAttribute('data-density', leseDensity());
})();
