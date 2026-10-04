/* ================================================================
   BäckereiOS · Host — Zugriffs-Anzeige (Sperre + Warnstreifen)
   ================================================================
   ZWECK: Die sichtbaren Teile der Zugriffsprüfung — Sperrbildschirm
          und Warnstreifen — an EINER Stelle, für alle Aufrufer.

   WARUM ES DIESES MODUL GIBT — Fund F-30, 19.09.2026:
   Am Morgen des 19.09. bekam bos_access_guard.js drei Verbesserungen:
   die Unterscheidung „weiß ich nicht" gegen „darfst du nicht" (F-23),
   Auswege aus der Sperre, und den Warnstreifen bei stillem Fail-open
   (F-24/F-28). bos_standalone_login.js ersetzt den Guard aber auf
   zwölf Satellitenseiten und hatte seine eigene Kopie der Anzeige —
   die alle drei Verbesserungen NICHT bekam. Ausgerechnet auf den
   NFC-Seiten war die Sackgasse ohne Knöpfe also noch da.

   Das ist Kompendium §13.35 in Reinform: eine Mechanik, viele
   Aufrufer — die Absicherung gilt pro Aufrufer. Deshalb jetzt
   gemeinsam statt kopiert: eine Kopie müsste Fallunterscheidung,
   beide Streifentexte und die Wurzelberechnung mitführen und liefe
   später still auseinander.

   AUFRUFER:
     bos_access_guard.js     — Satelliten mit normalem Guard
     bos_standalone_login.js — die zwölf NFC-/QR-Satelliten

   EINBINDUNG: nach bos_app_registry.js und bos_access.js, VOR
   bos_access_guard.js bzw. bos_standalone_login.js.

   ABLAGEORT — bindend NUR für diese Datei: sie liegt im
   Wurzelverzeichnis, neben launcher.html und index.html. Die Wurzel
   für „Zum Launcher" und „Abmelden" wird aus der eigenen
   Skriptadresse bestimmt; liegt die Datei woanders, zeigen die Knöpfe
   ins Leere.

   Die AUFRUFER dürfen liegen, wo sie wollen — genau dafür gibt es
   wurzel(). Wer einen Pfad zur Wurzel braucht, holt ihn hier ab,
   statt ihn selbst aus document.currentScript zu rechnen; sonst hängt
   das Ergebnis daran, wo der Aufrufer liegt und wie er eingebunden
   wurde.
   ================================================================ */

window.BOS_ZUGRIFF_ANZEIGE = (function () {
  'use strict';

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

  return {
    zeigeSperre: zeigeSperre,
    pruefeUndZeigeWarnung: pruefeUndZeigeWarnung,
    wurzel: wurzel
  };
})();
