/* ================================================================
   BOS Profil-Lookup
   ================================================================
   Neu 05.09.2026. Konsolidiert eine kleine, aber an drei Stellen fast
   identisch geschriebene Logik — "wer ist gerade aktiv" — die sich
   sonst leise hätte auseinanderentwickeln können:
     - launcher.html    (getMergedProfiles/getProfileById/getActiveProfile)
     - backstore.html   (bsGetProfile())
     - bos_taskboard.js (leseLokalesProfil())
   Ulf: "Ich will nicht mehrere Wahrheiten im System" — deshalb hier
   eine Mechanik, drei Aufrufer, statt drei Kopien.

   Liest denselben localStorage-Key wie launcher.html selbst
   (bos_launcher_state_v2). Reine Lese-Logik — schreibt nichts, kennt
   auch keine der launcher-eigenen Zusatzfelder wie "custom" (Tagging
   für die Profil-Auswahl-Kacheln) oder "profileData" — das bleibt
   Sache von launcher.html selbst.

   Abhängigkeit: window.BOS_PROFILES muss geladen sein (bos_launcher_
   profiles.js), bevor mergeProfile()/findeProfil()/findeAktiv()
   aufgerufen werden — nicht zwingend vor dem Laden DIESER Datei,
   nur vor dem ersten tatsächlichen Aufruf.
   ================================================================ */
window.BOS_PROFIL_LOOKUP = (function () {
  var STORAGE_KEY = 'bos_launcher_state_v2';

  /** Liest den rohen State frisch aus localStorage. Für Aufrufer ohne eigenes, schon geladenes state-Objekt (backstore.html hat sein eigenes — siehe unten; bos_taskboard.js nicht). */
  function liesState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { activeProfileId: null, localProfiles: [] };
    } catch (e) {
      console.warn('BOS_PROFIL_LOOKUP: state konnte nicht gelesen werden', e);
      return { activeProfileId: null, localProfiles: [] };
    }
  }

  /** Vordefinierte Profile (bos_launcher_profiles.js) + lokal gespeicherte, in dieser Reihenfolge — wie bisher in allen drei Kopien. */
  function mergeProfile(state) {
    var predefined = window.BOS_PROFILES || [];
    var local = (state && state.localProfiles) || [];
    return predefined.concat(local);
  }

  function findeProfil(state, id) {
    if (!id) return null;
    return mergeProfile(state).find(function (p) { return p.id === id; }) || null;
  }

  function findeAktiv(state) {
    return state && state.activeProfileId ? findeProfil(state, state.activeProfileId) : null;
  }

  /** Komfortfunktion für Aufrufer ohne eigenes state-Objekt: liest frisch aus localStorage und gibt direkt das aktive Profil zurück. */
  function aktivesProfil() {
    return findeAktiv(liesState());
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    liesState: liesState,
    mergeProfile: mergeProfile,
    findeProfil: findeProfil,
    findeAktiv: findeAktiv,
    aktivesProfil: aktivesProfil
  };
})();
