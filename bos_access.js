/* ================================================================
   BäckereiOS · BOS_ACCESS — zentrale Berechtigungsprüfung
   ================================================================
   Einzige Stelle, die "darf Rolle X auf Satellit Y zugreifen?"
   beantwortet. Ersetzt die bisherige direkte Prüfung gegen das
   "roles"-Feld in bos_app_registry.js.

   Aufrufer:
     - bos_access_guard.js  → Satelliten-Zugriff (Seite blockieren)
     - launcher.html        → Kachel-Sichtbarkeit
   Eine Mechanik, viele Aufrufer — nie zwei Prüfungen parallel pflegen.

   Quelle: window.BOS_PERMISSIONS aus bos_permissions.js.

   PRIORITÄT:
     1. Account-Override (kontoOverrides[appId]), falls gesetzt → gewinnt
     2. Rollen-Standard aus BOS_PERMISSIONS[role][appId]
     3. Fail-open, wenn der Satellit in KEINER Rolle in BOS_PERMISSIONS
        auftaucht (auch nicht bei admin) — dann gilt er als noch nicht
        konfiguriert, und ein Konfigurationsfehler soll niemanden
        (v.a. nicht den Admin) aussperren. Taucht der Satellit
        irgendwo auf, aber nicht bei der aktuellen Rolle: das ist eine
        bewusste Einschränkung, also false.
     4. Fehlt BOS_PERMISSIONS selbst komplett (Ladefehler) → fail-open.

   EINBINDUNG: nach bos_permissions.js, vor bos_access_guard.js.

   SCHNITTSTELLE:
     can(appId, role, kontoOverrides) → true/false
     istGelistet(appId)               → steht der Satellit überhaupt in
                                        BOS_PERMISSIONS? (für Warnungen)
     zeigeSperre(profil)              → Sperrbildschirm, mit
                                        Fallunterscheidung und Auswegen
     pruefeUndZeigeWarnung(appId)     → Warnstreifen bei stillem
                                        Fail-open; true = gewarnt
     wurzel()                         → Pfad zum Wurzelverzeichnis
   Die letzten drei seit 19.09.2026 — siehe Abschnitt ANZEIGE unten.
   ================================================================ */
(function () {
  function istSatellitIrgendwoGelistet(appId, perms) {
    for (var rolle in perms) {
      if (!Object.prototype.hasOwnProperty.call(perms, rolle)) continue;
      if (rolle.charAt(0) === '_') continue; // z.B. _hinweis
      var rollenRechte = perms[rolle];
      if (rollenRechte && Object.prototype.hasOwnProperty.call(rollenRechte, appId)) {
        return true;
      }
    }
    return false;
  }

  function can(appId, role, kontoOverrides) {
    if (kontoOverrides && kontoOverrides[appId] !== undefined) {
      return !!kontoOverrides[appId];
    }
    var perms = window.BOS_PERMISSIONS || null;
    if (!perms) return true; // bos_permissions.js fehlt/nicht geladen -> nicht aussperren
    if (!istSatellitIrgendwoGelistet(appId, perms)) return true; // unkonfiguriert -> fail-open
    var rollenRechte = role ? perms[role] : null;
    return !!(rollenRechte && rollenRechte[appId]);
  }

  /* NEU 19.09.2026 — rein additiv, can() bleibt unverändert.
     Aufrufer sollen unterscheiden können, WARUM durchgelassen wurde:
     fehlende Rechtedaten oder ein Satellit, der in keiner Rolle steht.
     Die Antwort gehört hierher, weil hier definiert ist, was
     "gelistet" heißt (inkl. Überspringen von Meta-Schlüsseln wie
     _hinweis). Eine Kopie beim Aufrufer würde still auseinanderlaufen —
     und zwar die Kopie, die entscheidet, ob überhaupt gewarnt wird. */
  function istGelistet(appId) {
    var perms = window.BOS_PERMISSIONS || null;
    if (!perms) return false;
    return istSatellitIrgendwoGelistet(appId, perms);
  }

  /* ================================================================
     ANZEIGE — Sperrbildschirm und Warnstreifen
     ================================================================
     Liegt seit dem 19.09.2026 hier und nicht in einer eigenen Datei.

     Begründung: Sperre und Streifen brauchen bos_access_guard.js UND
     bos_standalone_login.js, das den Guard auf zwölf Satelliten
     ersetzt. Vorher hatte jedes seine eigene Kopie, und die des
     Standalone-Moduls bekam die Verbesserungen des Tages nicht (F-30,
     §13.35). Eine eigene Datei hätte 38 Einbindungen gebraucht —
     38 Gelegenheiten, eine zu vergessen. Genau das ist die
     wiederkehrende Fehlerklasse dieses Projekts: nicht schlechte
     Architektur, sondern der vergessene Eintrag. bos_access.js wird
     von allen betroffenen Seiten ohnehin geladen.

     Der Preis: diese Datei ist nicht mehr reine Entscheidungslogik.
     Der Launcher lädt sie ebenfalls und ruft die Anzeige nie auf —
     das stört dort nicht.

     ABLAGEORT — bindend für DIESE Datei: Wurzelverzeichnis, neben
     launcher.html und index.html. Die Wurzel für "Zum Launcher" und
     "Abmelden" wird aus der eigenen Skriptadresse bestimmt. Die
     AUFRUFER dürfen liegen, wo sie wollen — dafür gibt es wurzel().
     ================================================================ */

  /* document.currentScript ist NUR gültig, solange dieses Skript
     läuft — später null. Deshalb hier, synchron. Derselbe Fund wie
     F-19 am 19.09.2026. */
  var WURZEL = (function () {
    var eigene = (document.currentScript && document.currentScript.src) || '';
    return eigene ? eigene.replace(/[^/]*$/, '') : '';
  })();

  function wurzel() { return WURZEL; }

  function anhaengen(el, danach) {
    if (document.body) { document.body.appendChild(el); if (danach) danach(); }
    else document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(el); if (danach) danach();
    });
  }

  /* ----------------------------------------------------------------
     Sperre — mit der Fallunterscheidung aus F-23
     ---------------------------------------------------------------- */
  function zeigeSperre(profil) {
    var wer = profil && profil.name ? profil.name : null;

    /* geprueft = ein Profil MIT Rolle liegt vor → wirklich verweigert.
       Sonst: kein Eintrag, oder Eintrag ohne Rolle (Gerät war nie im
       Launcher, Websitedaten gelöscht, Kennung ohne Konto-Dokument).
       Dann ist „darfst du nicht" schlicht falsch — und wer die Seite
       bedienen darf, fordert sonst Rechte an, die er längst hat. */
    var geprueft = !!(profil && profil.role);

    var el = document.createElement('div');
    el.setAttribute('style',
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:1rem;text-align:center;padding:2rem;' +
      'background:var(--bos-bg,#16120e);color:var(--bos-text,#f3ece1);' +
      'font-family:var(--bos-font-body,sans-serif);'
    );

    var text = geprueft
      ? ('Diese Seite ist für dein Konto nicht freigegeben' +
         (wer ? ' (angemeldet als ' + wer + ')' : '') + '.')
      : ('Deine Berechtigung ist auf diesem Gerät nicht bekannt. ' +
         'Das heißt nicht, dass sie fehlt' +
         (wer ? ' (angemeldet als ' + wer + ')' : '') + '.');

    var knoepfe =
      (geprueft ? '' :
        '<button type="button" id="bosZaNochmal" class="bos-btn bos-btn--amber">Nochmal versuchen</button>') +
      '<button type="button" id="bosZaLauncher" class="bos-btn' +
        (geprueft ? ' bos-btn--amber' : '') + '">Zum Launcher</button>' +
      '<button type="button" id="bosZaAbmelden" class="bos-btn">Abmelden</button>';

    el.innerHTML =
      '<div style="font-size:3rem;">' + (geprueft ? '🔒' : '❓') + '</div>' +
      '<div style="font-size:1.2rem;font-weight:700;">' +
        (geprueft ? 'Kein Zugriff' : 'Berechtigung unbekannt') + '</div>' +
      '<p style="color:var(--bos-text-dim,#ab9c8a);max-width:34ch;margin:0;">' + text + '</p>' +
      '<div style="display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center;">' +
      knoepfe + '</div>';

    document.documentElement.style.overflow = 'hidden';
    anhaengen(el, function () {
      var n = document.getElementById('bosZaNochmal');
      var l = document.getElementById('bosZaLauncher');
      var a = document.getElementById('bosZaAbmelden');
      if (n) n.addEventListener('click', function () { window.location.reload(); });
      if (l) l.addEventListener('click', function () {
        window.location.href = WURZEL + 'launcher.html';
      });
      if (a) a.addEventListener('click', function () {
        window.location.href = WURZEL + 'index.html?wechseln=1';
      });
    });
  }

  /* ----------------------------------------------------------------
     Warnstreifen — die beiden stillen Fail-open-Gründe aus F-24/F-28
     ---------------------------------------------------------------- */
  function gelistet(appId) {
    if (window.BOS_ACCESS && typeof window.BOS_ACCESS.istGelistet === 'function') {
      return window.BOS_ACCESS.istGelistet(appId);
    }
    /* Rückfall für eine ältere bos_access.js ohne istGelistet — damit
       die Anzeige nicht an der Reihenfolge des Ausrollens scheitert. */
    var perms = window.BOS_PERMISSIONS || null;
    if (!perms) return false;
    for (var rolle in perms) {
      if (!Object.prototype.hasOwnProperty.call(perms, rolle)) continue;
      if (rolle.charAt(0) === '_') continue;
      if (perms[rolle] && Object.prototype.hasOwnProperty.call(perms[rolle], appId)) return true;
    }
    return false;
  }

  /* Nicht jeder ungelistete Satellit ist ein Fehler: Taschenrechner,
     Schnelldruck, Stempeluhr und BackStore haben absichtlich kein
     roles-Feld und sind gewollt offen. Gewarnt wird nur bei echter
     Drift — Registry nennt roles, Matrix hat nichts dazu. */
  function sollteGesteuertSein(appId) {
    var apps = window.BOS_APPS || [];
    for (var i = 0; i < apps.length; i++) {
      if (apps[i].id === appId) return !!(apps[i].roles && apps[i].roles.length);
    }
    return false;
  }

  /**
   * Zeigt einen Warnstreifen, falls die Prüfung gar nicht stattfand.
   * @returns {boolean} true, wenn gewarnt wurde
   */
  function pruefeUndZeigeWarnung(appId) {
    var fehlt = [];
    if (!window.BOS_ACCESS) fehlt.push('bos_access.js');
    if (!window.BOS_PERMISSIONS) fehlt.push('bos_permissions.js');

    var warnung = null;
    if (fehlt.length) {
      warnung = {
        text: '⚠️ Berechtigung konnte nicht geprüft werden — diese Seite ist ' +
              'gerade ungeschützt offen. Fehlt: ' + fehlt.join(', ') +
              '. Seite neu laden; bleibt es, stimmt etwas mit den Dateien nicht.',
        neuLaden: true
      };
      console.error('[BOS Zugriff] Rechtedaten fehlen (' + fehlt.join(', ') +
                    ') — diese Seite ist ungeprüft offen.');
    } else if (!gelistet(appId) && sollteGesteuertSein(appId)) {
      warnung = {
        text: '⚠️ Dieser Satellit steht in keiner Rechte-Matrix und ist deshalb ' +
              'für alle offen. Nachzutragen in bos_permissions.js unter der ' +
              'Kennung „' + appId + '“.',
        neuLaden: false   // Neuladen ändert nichts, die Datei muss ergänzt werden
      };
      console.error('[BOS Zugriff] Satellit "' + appId +
                    '" fehlt in bos_permissions.js — Seite ist für jede Rolle offen.');
    }

    if (!warnung) return false;

    var streifen = document.createElement('div');
    streifen.setAttribute('role', 'alert');
    streifen.setAttribute('style',
      'position:fixed;left:0;right:0;top:0;z-index:99998;' +
      'display:flex;align-items:center;gap:10px;padding:9px 14px;' +
      'background:#7d2f25;color:#fdeae7;' +
      'font-family:var(--bos-font-body,sans-serif);font-size:13px;line-height:1.45;'
    );
    streifen.innerHTML =
      '<span style="flex:1;">' + warnung.text + '</span>' +
      (warnung.neuLaden
        ? '<button type="button" id="bosZaNeuLaden" class="bos-btn" style="flex:none;">Neu laden</button>'
        : '');

    anhaengen(streifen, function () {
      var b = document.getElementById('bosZaNeuLaden');
      if (b) b.addEventListener('click', function () { window.location.reload(); });
    });
    return true;
  }

  window.BOS_ACCESS = {
    can: can,
    istGelistet: istGelistet,
    zeigeSperre: zeigeSperre,
    pruefeUndZeigeWarnung: pruefeUndZeigeWarnung,
    wurzel: wurzel
  };

  /* Übergangsweise unter dem alten Namen erreichbar, damit eine Seite,
     die bos_zugriff_anzeige.js noch einbindet oder BOS_ZUGRIFF_ANZEIGE
     aufruft, nicht stumm ausfällt. Kann weg, sobald nichts mehr darauf
     zeigt. */
  window.BOS_ZUGRIFF_ANZEIGE = window.BOS_ACCESS;
})();
