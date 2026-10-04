/* ================================================================
   BäckereiOS · Satellite — Zoom-Sync
   ================================================================
   Liest die Zoomstufe (100/80/65), die der Launcher für das aktuell
   aktive Profil gespeichert hat, und setzt sie auf DIESEM Dokument
   (data-zoom auf <html>) — bevor bos_design_tokens.css ausgewertet
   wird, damit kein falscher Look kurz aufblitzt. Nach dem Muster von
   bos_density_sync.js gebaut, gleicher Speicherort — siehe dortigen
   Kopfkommentar für die ausführliche Begründung des Grundmusters,
   hier nur die Abweichung.

   WICHTIGER UNTERSCHIED ZU THEME/DICHTE — IFRAME-WEICHE:
   Theme und Dichte ändern nur CSS-Token-WERTE innerhalb JEDES
   Dokuments für sich — das kaskadiert nicht über Iframe-Grenzen,
   jedes Dokument braucht also seine eigene, unabhängige Anwendung.
   Zoom dagegen ist eine echte Rendering-Skalierung (CSS zoom-
   Property). Läuft ein Satellit als Fenster IM Launcher (Iframe),
   hat der Launcher selbst bereits data-zoom auf seinem eigenen
   <html> gesetzt — das skaliert das gesamte Kompositbild inklusive
   aller offenen Satelliten-Fenster automatisch mit (wie Chromes
   eigener Seitenzoom). Würde dieser Satellit sich JETZT zusätzlich
   selbst zoomen, würde sich der Effekt aufsummieren (65% × 65% ≈
   42% — deutlich zu klein). Deshalb: Dieses Skript setzt data-zoom
   NUR, wenn das Dokument selbst das oberste Fenster ist (window.self
   === window.top) — also beim eigenständigen Aufruf eines Satelliten
   (z. B. direkt in Chrome zum Testen, so wie Ulf es mit launcher.html
   heute Nacht gemacht hat). Läuft der Satellit als Iframe im Launcher,
   bleibt data-zoom hier bewusst unangetastet (Default "100" aus
   bos_design_tokens.css, was in diesem Fall korrekt ist — der äußere
   Zoom übernimmt die Skalierung).

   UNGEPRÜFTE ANNAHME (nicht an einem echten Tablet getestet): dass
   CSS zoom auf dem Launcher tatsächlich den gerenderten Inhalt
   verschachtelter Satelliten-Iframes mitskaliert, nicht nur deren
   Außenmaße. Nach dem ersten echten Test mit offenem Satelliten-
   Fenster bei aktivem Zoom verifizieren — siehe BOS_BAUSTELLEN.md
   und SESSION_2026-09-11_ZOOMSTUFE_KONZEPT.md. Stellt sich die
   Annahme als falsch heraus, muss diese Weiche entfernt werden
   (jeder Satellit müsste sich dann doch unabhängig zoomen, exakt
   wie bei Dichte).

   EINBINDUNG — im <head>, VOR bos_design_tokens.css, zusammen mit
   bos_theme_sync.js und bos_density_sync.js (Reihenfolge der drei
   untereinander egal, alle nur additiv auf verschiedene Attribute):

     <script src="../bos_theme_sync.js"></script>
     <script src="../bos_density_sync.js"></script>
     <script src="../bos_zoom_sync.js"></script>
     <link rel="stylesheet" href="../bos_design_tokens.css">

   WOHER: derselbe localStorage-Key wie Theme/Dichte (bos_launcher_
   state_v2), eigenes Feld state.profileData[activeProfileId].zoom —
   bewusst neben .theme/.density, nicht vermischt. Fehlt ein Wert,
   ist '100' der Default — entspricht dem unskalierten Normalzustand.

   ROLLOUT-STAND (11.09.2026): Noch KEIN Satellit bindet diese Datei
   ein — das ist ein eigener Folgeschritt pro Satellit, analog zum
   Dichte-Rollout (siehe BOS_DICHTE_DOKU.md §7). Bis dahin bleibt
   jeder Satellit unverändert bei Zoom "100", auch wenn im Launcher
   eine andere Stufe eingestellt ist.
   ================================================================ */

(function () {
  if (window.self !== window.top) return; // Iframe-Weiche, siehe Kopfkommentar oben
  function leseZoom() {
    try {
      var raw = localStorage.getItem('bos_launcher_state_v2');
      if (!raw) return '100';
      var state = JSON.parse(raw);
      if (!state || !state.activeProfileId || !state.profileData) return '100';
      var data = state.profileData[state.activeProfileId];
      return (data && data.zoom) ? data.zoom : '100';
    } catch (e) {
      return '100';
    }
  }
  document.documentElement.setAttribute('data-zoom', leseZoom());
})();
