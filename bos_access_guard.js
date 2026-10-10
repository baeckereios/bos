/* ================================================================
   BäckereiOS · Satellite — Zugriffs-Guard
   ================================================================
   Fumbling-Schutz, KEINE echte Sicherheit — gleiche Grenze wie der
   PIN im Launcher. Verhindert versehentliches/unbedachtes Öffnen
   einer Seite durch die falsche Gruppe (z.B. Backstube-Interna in
   der Filial-Ansicht). Kein Schutz vor jemandem, der gezielt im
   localStorage herumfummelt — dafür bräuchte es echte serverseitige
   Firebase-Auth-Regeln statt anonymer Auth. Aktuell kein konkreter
   Bedarf dafür (siehe LAUNCHER_DOKU.md).

   EINBINDUNG in jeder neuen Satelliten-Seite — als ERSTES Skript
   direkt nach <body>, in genau dieser Reihenfolge.
   NEU seit 19.09.2026: Sperrbildschirm und Warnstreifen liegen in
   bos_access.js — gemeinsam mit bos_standalone_login.js genutzt
   (F-30). Keine zusätzliche Datei einzubinden.

     <body>
       <script>var BOS_APP_ID = 'freezer';</script>  <!-- eigene id aus bos_app_registry.js -->
       <script src="bos_app_registry.js"></script>
       <script src="bos_launcher_profiles.js"></script>
       <script src="bos_permissions.js"></script>   <!-- NEU seit 31.08.2026 -->
       <script src="bos_access.js"></script>         <!-- NEU seit 31.08.2026 -->
       <script src="bos_access_guard.js"></script>
       ... restlicher Seiteninhalt ...
     </body>

   Warum so früh im Body: Guard soll blockieren BEVOR der Rest der
   Seite sichtbar wird, nicht erst danach per CSS überdecken. Deshalb
   auch bos_permissions.js/bos_access.js als synchrones <script> statt
   fetch() — ein async-Load würde die Seite kurz aufblitzen lassen,
   bevor der Guard reagieren kann.

   WOHER die Rollen-Zuweisung kommt (seit 31.08.2026): BOS_ACCESS.can()
   in bos_access.js, das gegen bos_permissions.js (Rolle × Satellit)
   prüft — nicht mehr direkt gegen das "roles"-Feld in
   bos_app_registry.js. Grund der Umstellung: bos_permissions.js kennt
   inzwischen mehr/genauere Rollen (z.B. verkaufsleitung,
   produktionsleitung) als die Registry ursprünglich abbildete, und
   Launcher-Kacheln nutzen jetzt dieselbe Prüfung — eine Stelle, zwei
   Verwendungen, nie zwei Wahrheiten pflegen. Das Registry-"roles"-Feld
   selbst bleibt vorerst stehen (harmlos, evtl. noch anderswo gelesen),
   ist für diese Prüfung hier aber nicht mehr die Quelle. Fail-open
   bleibt erhalten: siehe bos_access.js für die genaue Logik.

   WOHER die aktive Rolle kommt: derselbe localStorage-Key
   'bos_launcher_state_v2'. Geschrieben wird er seit dem 19.09.2026 von
   index.html (der Anmeldetür) UND vom Launcher, beide über
   bos_konto_profil.js — vorher nur vom Launcher, wodurch ein per NFC
   direkt geöffneter Satellit auf einem frischen Gerät keine Rolle
   vorfand und diese Sperre zeigte, obwohl der Kollege berechtigt war. Funktioniert automatisch,
   weil Launcher und Satellit auf derselben Domain laufen (GitHub
   Pages) — kein eigener Sync-Mechanismus nötig.

   CHANGELOG
     2026-10-10 · Reparaturanfrage Stufe 1 · Feature
       profile.kontoHaken als vierter Parameter an BOS_ACCESS.can().
     2026-09-26 · Schritt 2 (Namens-Fundament, §11.5) · Feature
       Profil mit freigeschaltet === false (Konto da, Haken fehlt):
       Sperrseite „Noch nicht freigeschaltet“ statt der Rollen-Sperre; auf
       offenen Seiten ein Streifen. Profile ohne das Feld (vor Schritt 2
       geschrieben) laufen unverändert. Aufspielen erst nach dem Haken an
       allen bleibenden Konten (§11.4, NF-46).
   ================================================================ */

(function () {
  function getActiveProfile() {
    var raw;
    try { raw = localStorage.getItem('bos_launcher_state_v2'); } catch (e) { return null; }
    if (!raw) return null;
    var state;
    try { state = JSON.parse(raw); } catch (e) { return null; }
    if (!state || !state.activeProfileId) return null;
    var all = (window.BOS_PROFILES || []).concat(state.localProfiles || []);
    return all.find(function (p) { return p.id === state.activeProfileId; }) || null;
  }
  var profile = getActiveProfile();
  var role = profile ? profile.role : null;
  var overrides = profile ? profile.kontoOverrides : null;
  // 10.10.2026: Haken des Kontos für Haken-Seiten (bos_access.js, Registry-Feld haken).
  var haken = profile ? profile.kontoHaken : null;
  /* 31.08.2026: Prüfung (Rollen-Standard + Account-Override) liegt jetzt
     zentral in bos_access.js (BOS_ACCESS.can()) — hier nur noch der Aufruf.
     Fehlt BOS_ACCESS selbst (Script vergessen/Ladefehler), fail-open:
     ein Konfigurationsfehler soll nicht aussperren, gleiche Logik wie immer. */
  var ok = window.BOS_ACCESS ? window.BOS_ACCESS.can(window.BOS_APP_ID, role, overrides, haken) : true;

  /* Sperre und Warnstreifen liegen seit dem 19.09.2026 in
     bos_access.js — dieselben Funktionen benutzt
     bos_standalone_login.js, das diesen Guard auf zwölf Satelliten
     ersetzt. Vorher hatte es eine eigene Kopie, die die
     Verbesserungen dieses Tages nicht bekam (F-30). */
  var A = window.BOS_ACCESS;

  if (!A || typeof A.zeigeSperre !== 'function') {
    /* Der einzige Fall, den die zusammengelegte Anzeige nicht selbst
       melden kann: sie fehlt. Der Warnstreifen liegt seit dem
       19.09.2026 in bos_access.js — fehlt die Datei, fehlt auch der
       Streifen. Deshalb hier ein eigener, ganz ohne Abhängigkeit.
       EINE PRO EINSTIEGSPUNKT. Es gibt diesen Block zweimal im
       Zugriffsteil: hier und in bos_standalone_login.js. Das ist kein
       Rückschritt hinter die Zusammenlegung, sondern ihre logische
       Kehrseite: was vor dem Fehlen einer Datei warnt, darf nicht aus
       dieser Datei kommen. Und der Einstiegspunkt ist das Einzige,
       was ohne sie überhaupt noch läuft.
       Bitte NICHT als Altlast entfernen — derselbe Satz steht in der
       anderen Datei.
       Praktischer Anlass: wer einen neuen Satelliten baut, den Guard
       einbindet und bos_access.js vergisst, hat sonst eine offene
       Seite und nur eine Meldung in der Konsole. */
    console.error('[BOS Guard] bos_access.js fehlt oder ist zu alt — ' +
                  'diese Seite ist ungeprüft offen.');
    var notstreifen = document.createElement('div');
    notstreifen.setAttribute('role', 'alert');
    notstreifen.setAttribute('style',
      'position:fixed;left:0;right:0;top:0;z-index:99998;' +
      'padding:9px 14px;background:#7d2f25;color:#fdeae7;' +
      'font-family:sans-serif;font-size:13px;line-height:1.45;');
    notstreifen.textContent =
      '⚠️ Berechtigung konnte nicht geprüft werden — diese Seite ist ' +
      'gerade ungeschützt offen. Fehlt: bos_access.js.';
    if (document.body) document.body.appendChild(notstreifen);
    else document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(notstreifen);
    });
    return;
  }

  A.pruefeUndZeigeWarnung(window.BOS_APP_ID);

  /* Schritt 2 (26.09.2026, Namens-Fundament §11.5): Konto vorhanden, aber
     ohne Haken → eigene Sperre „Noch nicht freigeschaltet“ statt „keine
     Berechtigung“. freigeschaltet === false steht nur in Profilen, die
     bos_konto_profil.js ab Schritt 2 geschrieben hat; ältere Profile
     (Feld fehlt) laufen wie bisher. Offene Seiten (ok) bleiben offen,
     tragen aber einen Streifen — ihre Firestore-Abfragen scheitern ohne
     Haken ohnehin an der Regel. */
  if (profile && profile.freigeschaltet === false && profile.kontoVorhanden !== false) {
    zeigeNichtFreigeschaltet(!ok);
    return;
  }
  if (!ok) A.zeigeSperre(profile);

  function zeigeNichtFreigeschaltet(sperren) {
    var text = 'Noch nicht freigeschaltet — dein Konto ist angelegt, aber noch nicht aktiv. Sag Ulf Bescheid.';
    var setzen = function () {
      if (sperren) {
        /* Wie zeigeSperre() in bos_access.js: eine Deckschicht über der
           ganzen Seite, statt den body zu leeren — der Guard läuft, bevor
           der Rest des body geparst ist; ein geleerter body füllte sich
           danach wieder (im Nachbau gefunden). */
        var wurzel = (typeof A.wurzel === 'function') ? A.wurzel() : '../';
        var decke = document.createElement('div');
        decke.id = 'bosNichtFreigeschaltet';
        decke.setAttribute('role', 'alert');
        decke.setAttribute('style', 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;' +
          'align-items:center;justify-content:center;gap:12px;padding:24px;font-family:sans-serif;text-align:center;' +
          'background:#16120e;color:#f3ece1;');
        decke.innerHTML = '<div style="font-size:40px;">🔒</div><p style="font-size:17px;font-weight:700;margin:0;max-width:420px;"></p>' +
          '<a style="color:#e0973a;" href="' + wurzel + 'launcher.html">Zum Launcher</a>';
        decke.querySelector('p').textContent = text;
        document.body.appendChild(decke);
        document.documentElement.style.overflow = 'hidden';
      } else {
        var streifen = document.createElement('div');
        streifen.setAttribute('role', 'alert');
        streifen.setAttribute('style', 'position:fixed;left:0;right:0;top:0;z-index:99998;padding:9px 14px;' +
          'background:#6b5410;color:#fff6d8;font-family:sans-serif;font-size:13px;line-height:1.45;');
        streifen.textContent = '🔒 ' + text + ' Diese Seite ist offen, ihre Daten nicht.';
        document.body.appendChild(streifen);
      }
    };
    if (document.body) setzen(); else document.addEventListener('DOMContentLoaded', setzen);
  }
})();
