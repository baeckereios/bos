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

   15.10.2026 · 19:56 · Farbprofile Stufe B (#72, Freigabe Kontroll-Chat
   18:48): zusätzlich data-farbschema aus dem Profileintrag, siehe unten.
   SESSION_2026-10-15_FARBSCHEMA_STUFE_B_BAU.md
   ================================================================ */

/* ----------------------------------------------------------------
   FARBPROFIL (15.10.2026, Baustelle #72, Stufe B)
   Setzt zusätzlich data-farbschema auf <html>, aus dem Profileintrag des
   aktiven Profils (state.localProfiles[…].farbschema — NICHT profileData).
   Dort steht schon das WIRKSAME Profil, ausgerechnet von
   bos_konto_profil.js (Tür, Launcher) über bos_farbprofile.js. Diese
   Datei braucht deshalb keine weitere Datei und bleibt synchron im <head>.
   Geprüft wird nur die Form (a–z); eine unbekannte ID hat keinen CSS-Block
   und sieht aus wie Honig.
   E3 (Maschinenseiten): Steht data-farbschema schon im HTML (ohne
   data-farbschema-quelle="konto"), wird es NIE angefasst. Was dieser Sync
   setzt, trägt die Marke data-farbschema-quelle="konto"; nur das darf er
   (bzw. der Launcher beim Profilwechsel) neu setzen oder entfernen.
   EINE Funktion für alle: Der Launcher lädt diese Datei ebenfalls (mit
   window.BOS_THEME_SYNC_NUR_FUNKTION = true, also OHNE das Setzen beim Laden)
   und ruft BOS_FARBSCHEMA_SYNC.setze(state) mit seinem eigenen state-Objekt
   in applyProfileUI().
   ---------------------------------------------------------------- */
window.BOS_FARBSCHEMA_SYNC = (function () {
  var FORM = /^[a-z]{2,20}$/;

  function ausState(state) {
    if (!state || !state.activeProfileId || !state.localProfiles || !state.localProfiles.length) return null;
    for (var i = 0; i < state.localProfiles.length; i++) {
      var p = state.localProfiles[i];
      if (p && p.id === state.activeProfileId) {
        return (typeof p.farbschema === 'string' && FORM.test(p.farbschema)) ? p.farbschema : null;
      }
    }
    return null;
  }

  function setze(state, el) {
    el = el || document.documentElement;
    if (el.hasAttribute('data-farbschema') && el.getAttribute('data-farbschema-quelle') !== 'konto') {
      return el.getAttribute('data-farbschema');   // fest im HTML (E3)
    }
    var id = ausState(state);
    if (id) {
      el.setAttribute('data-farbschema', id);
      el.setAttribute('data-farbschema-quelle', 'konto');
    } else {
      el.removeAttribute('data-farbschema');
      el.removeAttribute('data-farbschema-quelle');
    }
    return id;
  }

  return { ausState: ausState, setze: setze };
})();

(function () {
  // Der Launcher lädt diese Datei nur wegen BOS_FARBSCHEMA_SYNC und setzt
  // Theme und Farbprofil selbst in applyProfileUI() (wie bisher das Theme).
  // Würde der Sync hier schon data-theme setzen, liefe der Startbildschirm im
  // hellen Modus mit heller Schrift auf seinem dunklen Grund (Bildvergleich
  // Honig, 15.10.2026, Fund F27).
  if (window.BOS_THEME_SYNC_NUR_FUNKTION) return;
  var state = null;
  try {
    var raw = localStorage.getItem('bos_launcher_state_v2');
    state = raw ? JSON.parse(raw) : null;
  } catch (e) {
    state = null;
  }
  function leseTheme() {
    if (!state || !state.activeProfileId || !state.profileData) return 'dark';
    var data = state.profileData[state.activeProfileId];
    return (data && data.theme) ? data.theme : 'dark';
  }
  document.documentElement.setAttribute('data-theme', leseTheme());
  try { window.BOS_FARBSCHEMA_SYNC.setze(state); } catch (e) { /* ohne Profil: Honig */ }
})();
