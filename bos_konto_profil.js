/* ================================================================
   BäckereiOS · Host — Launcher-Profil aus dem Konto
   ================================================================
   ZWECK: Aus dem angemeldeten Firebase-Konto den Profileintrag bauen,
          den Launcher UND Zugriffs-Guard im localStorage erwarten
          ('bos_launcher_state_v2').

   WARUM ES DIESES MODUL GIBT — Fund 19.09.2026:
   Nach der Kontenumstellung entstand dieser Eintrag ausschließlich im
   Launcher (starteMitKonto). bos_access_guard.js liest ihn aber auf
   JEDER Satellitenseite — auch dann, wenn der Launcher nie gelaufen
   ist. Genau das ist der NFC-/QR-Fall: frisches Handy, Aufkleber am
   Rondo gescannt, an der Tür angemeldet, direkt zur Station. Ohne
   Eintrag ist die Rolle null, und der Guard sperrt einen Kollegen aus,
   der die Seite bedienen darf.

   Deshalb schreibt seitdem die TÜR (index.html) den Eintrag, direkt
   nach der Anmeldung — dort steht als Erstem fest, wer hereingekommen
   ist. Der Launcher benutzt dieselbe Mechanik, damit die Form des
   Eintrags nicht an zwei Stellen gepflegt werden muss.

   EINBINDUNG: nach bos_accounts.js, vor dem seiteneigenen Code.

   SCHRITT 2 (26.09.2026, Namens-Fundament §11.5): aktualisiere()
   übernimmt das Feld freigeschaltet ins Profil. Ohne Haken keine Rolle
   und keine Ausnahmen (role: null, kontoOverrides: {}, freigeschaltet:
   false). stelleSicher() meldet freigeschaltet und kontoVorhanden mit,
   damit die Tür „Noch nicht freigeschaltet“ sagen kann. REIHENFOLGE beim
   Aufspielen (§11.4, NF-46): diese Datei erst, NACHDEM alle bleibenden
   Konten in der Kontenverwaltung den Haken tragen — sonst verliert das
   eigene Konto beim nächsten Anmelden seine Rolle.

   EINE MECHANIK, ZWEI AUFRUFER:
     index.html   — nach der Anmeldung, bevor weitergeleitet wird
     launcher.html — beim Start, mit dem eigenen state-Objekt
   ================================================================ */

window.BOS_KONTO_PROFIL = (function () {
  'use strict';

  var SCHLUESSEL = 'bos_launcher_state_v2';

  /* Der Teil der Kennung vor dem @ ist der Kontoschlüssel und zugleich
     die Dokument-ID in bos_accounts. Karte, Firebase-Adresse und
     Dokument heißen dasselbe. */
  function kennungAus(nutzer) {
    if (!nutzer || !nutzer.email) return null;
    return String(nutzer.email).split('@')[0].toLowerCase();
  }

  function profilIdAus(kennung) {
    return 'konto_' + kennung;
  }

  function rollenIcon(rolleId) {
    var liste = window.BOS_ROLES || [];
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === rolleId && liste[i].icon) return liste[i].icon;
    }
    return '🙂';
  }

  /**
   * Trägt das Konto in ein state-Objekt ein und macht es zum aktiven
   * Profil. Mutiert das übergebene Objekt und gibt die Profil-ID
   * zurück — der Aufrufer entscheidet, wann und wie gespeichert wird.
   *
   * @param {object} state  Launcher-Zustand (wird verändert)
   * @param {string} kennung
   * @param {object|null} daten  Inhalt des bos_accounts-Dokuments
   */
  function aktualisiere(state, kennung, daten) {
    if (!state.localProfiles) state.localProfiles = [];
    if (!state.profileData) state.profileData = {};

    var id = profilIdAus(kennung);
    var eintrag = null;
    for (var i = 0; i < state.localProfiles.length; i++) {
      if (state.localProfiles[i].id === id) { eintrag = state.localProfiles[i]; break; }
    }
    if (!eintrag) {
      eintrag = { id: id, quelle: 'konto', kontoSchluessel: kennung };
      state.localProfiles.push(eintrag);
    }

    if (daten) {
      // name ist die Zuordnungsnotiz des Betreibers ("Jörg"), nicht der
      // später geplante selbstgewählte Anzeigename.
      eintrag.name = daten.name || kennung;
      // Schritt 2 (26.09.2026, §11.5): Rolle und Ausnahmen gelten NUR mit
      // Haken. Ohne ihn verweigert die Regel ohnehin jeden Zugriff — eine
      // übernommene Rolle öffnete nur Satelliten, die dann an jeder Abfrage
      // scheitern. Auch die Ausnahmen (overrides) fallen weg, sonst könnte
      // eine Ausnahme eine Seite trotz fehlendem Haken öffnen.
      eintrag.kontoVorhanden = true;
      eintrag.freigeschaltet = (daten.freigeschaltet === true);
      eintrag.role = eintrag.freigeschaltet ? (daten.role || null) : null;
      eintrag.kontoOverrides = eintrag.freigeschaltet ? (daten.overrides || {}) : {};
    } else {
      // Kennung ohne Konto-Dokument: Grundkonto, keine Rolle.
      eintrag.name = kennung;
      eintrag.role = null;
      eintrag.kontoOverrides = {};
      eintrag.kontoVorhanden = false;
      eintrag.freigeschaltet = false;
    }
    eintrag.icon = rollenIcon(eintrag.role);

    state.activeProfileId = id;
    return id;
  }

  function leseState() {
    var roh;
    try { roh = localStorage.getItem(SCHLUESSEL); } catch (e) { return {}; }
    if (!roh) return {};
    try { return JSON.parse(roh) || {}; } catch (e) { return {}; }
  }

  function schreibeState(state) {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(state)); return true; }
    catch (e) {
      console.error('[BOS Kontoprofil] localStorage nicht beschreibbar:', e);
      return false;
    }
  }

  /**
   * Für Seiten ohne eigenes state-Objekt (die Tür): Konto laden,
   * eintragen, speichern. Scheitert das Laden, bleibt ein vorhandener
   * Eintrag stehen — aussperren wegen eines Netzhusters wäre schlimmer
   * als eine veraltete Rolle, zumal die echten Rechte serverseitig
   * durchgesetzt werden.
   *
   * @returns {Promise<{id:string, kennung:string, rolle:string|null,
   *                    geladen:boolean, fehler:Error|null}>}
   */
  function stelleSicher(db, nutzer) {
    var kennung = kennungAus(nutzer);
    if (!kennung) {
      return Promise.resolve({ id: null, kennung: null, rolle: null,
                               geladen: false, fehler: null });
    }

    var laden = (window.BOS_ACCOUNTS && db)
      ? window.BOS_ACCOUNTS.ladeKonto(db, kennung)
      : Promise.resolve(null);

    return laden.then(function (daten) {
      var state = leseState();
      var id = aktualisiere(state, kennung, daten);
      schreibeState(state);
      var rolle = null, freigeschaltet = null;
      for (var i = 0; i < state.localProfiles.length; i++) {
        if (state.localProfiles[i].id === id) {
          rolle = state.localProfiles[i].role;
          freigeschaltet = state.localProfiles[i].freigeschaltet;
          break;
        }
      }
      return { id: id, kennung: kennung, rolle: rolle, geladen: true, fehler: null,
               freigeschaltet: freigeschaltet, kontoVorhanden: !!daten };
    }).catch(function (fehler) {
      console.warn('[BOS Kontoprofil] Konto konnte nicht geladen werden', fehler);
      var state = leseState();
      var id = profilIdAus(kennung);
      var bekannt = null;
      for (var i = 0; i < (state.localProfiles || []).length; i++) {
        if (state.localProfiles[i].id === id) { bekannt = state.localProfiles[i]; break; }
      }
      if (bekannt) {
        state.activeProfileId = id;
        schreibeState(state);
      }
      return { id: id, kennung: kennung, rolle: bekannt ? bekannt.role : null,
               geladen: false, fehler: fehler };
    });
  }

  return {
    kennungAus: kennungAus,
    profilIdAus: profilIdAus,
    aktualisiere: aktualisiere,
    stelleSicher: stelleSicher
  };
})();
