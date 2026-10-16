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

   10.10.2026 (Reparaturanfrage Stufe 1): aktualisiere() legt zusätzlich
   kontoHaken an — alle true-Felder des Konto-Dokuments, nur bei
   freigeschaltet, sonst {}. Gelesen von Launcher, Guard, Standalone-Login
   und BackStore als vierter Parameter von BOS_ACCESS.can().

   15.10.2026 · 19:56 (Farbprofile Stufe B, #72): aktualisiere() legt
   farbschema (wirksames Profil über BOS_FARBPROFILE.wirksam) und
   farbschemaKonto (roher Kontowert) an. Braucht bos_farbprofile.js VOR
   dieser Datei. SESSION_2026-10-15_FARBSCHEMA_STUFE_B_BAU.md

   16.10.2026 · 07:54 (Einstellungen für alle, #72 Stufe C; Freigabe
   Kontroll-Chat 07:26): Das wirksame Profil rechnet jetzt setzeFarbschema()
   — mit der EIGENEN Wahl aus state.profileData[id].farbschema, falls dort
   eine steht. aktualisiere() ruft sie auf (Tür), launcher.html ebenso nach
   dem Laden der Einstellungen und nach jeder Auswahl: eine Stelle rechnet,
   zwei rufen sie auf. Die Tür liest das Einstellungs-Dokument NICHT; auf
   einem neuen Gerät gilt bis zum ersten Launcher-Start die Vorgabe (wie bei
   hell/dunkel). Auf einem bekannten Gerät bleibt die eigene Wahl erhalten.
   SESSION_2026-10-16_EINSTELLUNGEN_FUER_ALLE_BAU.md

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

  /* NEU 10.10.2026 (Reparaturanfrage Stufe 1): alle Felder des
     Konto-Dokuments, die genau true sind — { reparaturMelden: true, … }.
     Das ist der vierte Parameter von BOS_ACCESS.can() für Seiten mit
     Registry-Feld haken. Bewusst KEINE feste Liste: ein neuer Haken (Lager
     o. Ä.) soll nicht an einer zweiten Stelle nachgetragen werden müssen.
     Nur Anzeige — das Schloss ist die Firestore-Regel. Stammt die Antwort
     aus einem Rückfall (launcher.html ohne Netz), kommt dort bereits ein
     fertiges kontoHaken-Objekt mit; dann wird es übernommen. */
  function hakenAus(daten) {
    if (daten && daten.kontoHaken && typeof daten.kontoHaken === 'object') {
      var kopie = {};
      Object.keys(daten.kontoHaken).forEach(function (k) {
        if (daten.kontoHaken[k] === true) kopie[k] = true;
      });
      return kopie;
    }
    var h = {};
    Object.keys(daten || {}).forEach(function (k) {
      if (daten[k] === true) h[k] = true;
    });
    return h;
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
      // 10.10.2026 (Reparaturanfrage): Haken für Haken-Seiten, siehe hakenAus().
      eintrag.kontoHaken = eintrag.freigeschaltet ? hakenAus(daten) : {};
    } else {
      // Kennung ohne Konto-Dokument: Grundkonto, keine Rolle.
      eintrag.name = kennung;
      eintrag.role = null;
      eintrag.kontoOverrides = {};
      eintrag.kontoHaken = {};
      eintrag.kontoVorhanden = false;
      eintrag.freigeschaltet = false;
    }
    eintrag.icon = rollenIcon(eintrag.role);

    // 15.10.2026 (#72 Stufe B): Farbprofil. farbschemaKonto = roher Wert am
    // Konto (nur mit Haken), für den Netz-Rückfall im Launcher; farbschema =
    // WIRKSAMES Profil, gelesen von bos_theme_sync.js auf jeder Seite.
    // Ohne Haken ist role schon null → Honig. Fehlt bos_farbprofile.js (alte
    // Datei im Cache), bleibt ein vorhandenes farbschema stehen.
    eintrag.farbschemaKonto = (daten && eintrag.freigeschaltet && typeof daten.farbschema === 'string') ? daten.farbschema : null;
    setzeFarbschema(state, eintrag);

    state.activeProfileId = id;
    return id;
  }

  /**
   * 16.10.2026 (#72 Stufe C): wirksames Farbprofil in den Profileintrag.
   * Vorrang: eigene Wahl (state.profileData[eintrag.id].farbschema) >
   * Konto (eintrag.farbschemaKonto) > Rolle (eintrag.role) > Honig.
   * Die eigene Wahl wirkt auch ohne Haken „freigeschaltet“ — sie ist
   * persönlich, kein Recht. Fehlt bos_farbprofile.js (alte Datei im Cache),
   * bleibt ein vorhandenes farbschema stehen.
   * @returns {string|null} das gesetzte Profil
   */
  function setzeFarbschema(state, eintrag) {
    if (!eintrag) return null;
    if (!window.BOS_FARBPROFILE) {
      console.warn('[BOS Kontoprofil] bos_farbprofile.js fehlt — Farbprofil bleibt unverändert');
      return eintrag.farbschema || null;
    }
    var daten = state && state.profileData ? state.profileData[eintrag.id] : null;
    var eigene = (daten && typeof daten.farbschema === 'string') ? daten.farbschema : null;
    eintrag.farbschema = window.BOS_FARBPROFILE.wirksam({
      eigeneWahl: eigene, konto: eintrag.farbschemaKonto, rolle: eintrag.role
    });
    return eintrag.farbschema;
  }

  /** Vorgabe ohne eigene Wahl (Anzeige „Vorgabe: …“ in den Einstellungen). */
  function vorgabeFarbschema(eintrag) {
    if (!window.BOS_FARBPROFILE) return null;
    return window.BOS_FARBPROFILE.wirksam({
      konto: eintrag ? eintrag.farbschemaKonto : null, rolle: eintrag ? eintrag.role : null
    });
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
    hakenAus: hakenAus,
    setzeFarbschema: setzeFarbschema,
    vorgabeFarbschema: vorgabeFarbschema,
    stelleSicher: stelleSicher
  };
})();
