/* ================================================================
   BäckereiOS · Satellite — Standalone-Login
   ================================================================
   10.10.2026 (Reparaturanfrage Stufe 1): pruefeZugriff() gibt
   profil.kontoHaken als vierten Parameter an BOS_ACCESS.can().
   STAND 19.09.2026: Der Login-Teil ist stillgelegt. Das Modul prüft
   weiterhin den Zugriff, wenn ein Profil vorliegt (PFAD 1) — es
   ERSETZT auf diesen Seiten bos_access_guard.js, siehe unten. Liegt
   kein Profil vor, leitet es zur Anmeldetür (index.html) statt einen
   eigenen Login zu zeigen. Grund: Konten heißen seit der
   Kontenumstellung wie die Kennung und werden nur noch von der
   Betriebsleitung angelegt; der alte Weg hätte ein zweites, falsches
   Konto-Dokument erzeugt.
   ================================================================
   Zweck: ermöglicht Satelliten-Seiten, die per NFC/QR DIREKT (ohne
   vorherigen Launcher-Aufruf) auf einem privaten Handy geöffnet
   werden, trotzdem eine echte Identität + Rolle zu bekommen — nicht
   nur den üblichen Fumbling-Schutz von bos_access_guard.js, der
   voraussetzt, dass der Launcher vorher schon localStorage befüllt
   hat. Gebaut für den Produktionsplaner (Stationsseiten), siehe
   SESSION_2026-09-03_PRODUKTIONSPLANER_KONZEPT.md.

   KEINE NEUE MECHANIK — nur ein zweiter Aufrufer der bestehenden
   Konto-Logik (bos_accounts.js), des bestehenden Rechte-Checks
   (bos_access.js) und — seit 19.09.2026 — der dort ebenfalls
   liegenden gemeinsamen Zugriffs-Anzeige. Sperrbildschirm und
   Warnstreifen sind damit identisch mit denen von
   bos_access_guard.js, weil es dieselbe Datei ist und nicht mehr
   eine Kopie, die auseinanderläuft (F-30).
   Ursprünglich derselbe Weg wie in launcher.html
   (schreibeLokalUndAktiviere/activateProfile, gegen die echte Datei
   geprüft, 03.09.2026). Schreibt am Ende exakt dasselbe
   localStorage-Schema unter demselben Key ('bos_launcher_state_v2'),
   damit jede andere Stelle im System (z.B. bos_zeitkontext.js,
   Theme/Dichte-Sync) es unverändert weiterlesen kann.

   BEWUSSTE ABWEICHUNG von der Standard-Einbindung aus
   bos_access_guard.js: Dieses Modul ERSETZT bos_access_guard.js auf
   den Seiten, die es einbinden — es läuft NICHT zusätzlich davor.
   Grund: bos_access_guard.js prüft synchron beim Laden, ohne auf
   irgendetwas zu warten. Ein frisches Login braucht aber zwingend
   eine asynchrone Nutzereingabe (Name+Geburtsdatum+PIN eintippen).
   Zwei synchron hintereinander geschaltete Skripte könnten das nicht
   abbilden — deshalb übernimmt dieses Modul den Rechte-Check
   (BOS_ACCESS.can()) und die Anzeige (bos_access.js) selbst,
   sobald ein Profil feststeht — ob sofort
   (schon aktives Profil vorhanden) oder erst nach Login.

   EINBINDUNG — nur auf Satelliten, die auch standalone (NFC/QR)
   aufgerufen werden können. Reihenfolge bindend:

     <head>
       <link rel="stylesheet" href="../bos_design_tokens.css">
       <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
       <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
       <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
     </head>
     <body>
       <script src="../bos_launcher_backgrounds.js"></script>  <!-- MUSS vor bos_accounts.js -->
       <script src="../bos_firebase_config.js"></script>
       <script src="../bos_accounts.js"></script>
       <script>var BOS_APP_ID = 'produktionsplaner_rondo';</script>  <!-- eigene id -->
       <script src="../bos_app_registry.js"></script>
       <script src="../bos_launcher_profiles.js"></script>
       <script src="../bos_permissions.js"></script>
       <script src="../bos_access.js"></script>
       <script src="../bos_standalone_login.js"></script>   <!-- statt bos_access_guard.js -->
       ... restlicher Seiteninhalt ...
     </body>

   WICHTIG — bos_launcher_backgrounds.js: bos_accounts.js braucht
   window.BOS_BV.silbe() für die Schlüsselberechnung (siehe dortige
   berechneSchluessel()). Fehlt die Datei, berechnet diese Seite für
   dieselbe Person einen ANDEREN Schlüssel als der Launcher — zwei
   Konten für eine Person. Kein Fumbling-Schutz-Detail, sondern ein
   echter Korrektheitsfehler — deshalb hier hart dokumentiert, nicht
   nur als Kommentar in bos_accounts.js selbst.

   NICHT verifiziert (03.09.2026, kein Zugriff auf die echte Datei):
   ob bos_access.js / bos_permissions.js exakt die hier angenommene
   Signatur BOS_ACCESS.can(appId, role, overrides) haben — 1:1 aus
   bos_access_guard.js übernommen, dort aber ebenfalls nur an der
   Aufruf-Stelle bestätigt, nicht am Original selbst. Vor Einsatz
   gegen die echten Dateien prüfen.
   ================================================================ */

(function () {
  var STORAGE_KEY = 'bos_launcher_state_v2';
  var ICON_STANDARD = '🧑';

  // ---------- localStorage lesen/schreiben ----------
  function leseState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return null;
      return s;
    } catch (e) { return null; }
  }

  function schreibeState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.error('BOS Standalone-Login: State konnte nicht gespeichert werden', e); }
  }

  function aktivesProfil(state) {
    if (!state || !state.activeProfileId) return null;
    var all = (window.BOS_PROFILES || []).concat(state.localProfiles || []);
    return all.find(function (p) { return p.id === state.activeProfileId; }) || null;
  }

  // ---------- Rechte-Check (dieselbe Mechanik wie bos_access_guard.js) ----------
  function pruefeZugriff(profil) {
    var role = profil ? profil.role : null;
    var overrides = profil ? profil.kontoOverrides : null;
    // 10.10.2026: Haken des Kontos für Haken-Seiten (bos_access.js, Registry-Feld haken).
    var haken = profil ? profil.kontoHaken : null;
    return window.BOS_ACCESS ? window.BOS_ACCESS.can(window.BOS_APP_ID, role, overrides, haken) : true;
  }

  /* Sperre und Warnstreifen kommen seit dem 19.09.2026 aus
     bos_access.js — gemeinsam mit bos_access_guard.js.
     Vorher stand hier eine eigene Kopie, die die Verbesserungen des
     Tages nicht bekam: keine Unterscheidung zwischen „weiß ich nicht"
     und „darfst du nicht", keine Auswege, kein Warnstreifen. Auf zwölf
     NFC-Seiten war die Sackgasse damit noch offen (F-30, §13.35). */
  function zeigeKeinZugriff(profil) {
    if (window.BOS_ACCESS && typeof window.BOS_ACCESS.zeigeSperre === 'function') {
      window.BOS_ACCESS.zeigeSperre(profil || null);
      return;
    }
    /* Der Notstreifen oben ist in diesem Fall bereits gesetzt; hier
       bleibt nur die Konsolenmeldung. Die Seite bleibt offen — ohne
       Rechtedaten wäre eine Sperre geraten, nicht geprüft. */
    console.error('BOS Standalone-Login: bos_access.js fehlt — ' +
                  'Sperre kann nicht angezeigt werden, Seite bleibt offen.');
  }

  // ================================================================
  // PFAD 1: Schon ein aktives Profil auf diesem Gerät (Launcher war
  // hier schon mal aktiv, oder frühere NFC-Anmeldung) — sofort prüfen,
  // kein Login-Overlay nötig.
  // ================================================================
  /* ----------------------------------------------------------------
     Notstreifen — abhängigkeitsfrei, bewusst verdoppelt
     ----------------------------------------------------------------
     EINE PRO EINSTIEGSPUNKT. Es gibt sie zweimal im Zugriffsteil:
     hier und in bos_access_guard.js. Das ist kein Rückschritt hinter
     die Zusammenlegung vom 20.09.2026, sondern ihre logische
     Kehrseite: was vor dem Fehlen einer Datei warnt, darf nicht aus
     dieser Datei kommen. Und der Einstiegspunkt ist das Einzige, was
     ohne sie überhaupt noch läuft.

     Bitte NICHT als Altlast entfernen — derselbe Satz steht in der
     anderen Datei.

     Verhalten: warnen und WEITERLAUFEN. Fail-open bleibt; aussperren
     wäre genau das, was die Notbremse verhindern soll. */
  function notstreifen() {
    console.error('[BOS Standalone-Login] bos_access.js fehlt oder ist zu alt — ' +
                  'diese Seite ist ungeprüft offen.');
    var el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.setAttribute('style',
      'position:fixed;left:0;right:0;top:0;z-index:99998;' +
      'padding:9px 14px;background:#7d2f25;color:#fdeae7;' +
      'font-family:sans-serif;font-size:13px;line-height:1.45;');
    el.textContent =
      '\u26A0\uFE0F Berechtigung konnte nicht gepr\u00fcft werden \u2014 diese Seite ist ' +
      'gerade ungesch\u00fctzt offen. Fehlt: bos_access.js.';
    if (document.body) document.body.appendChild(el);
    else document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(el);
    });
  }

  /* Vor allem anderen: fehlt bos_access.js, kann nichts geprüft und
     nichts Sichtbares gemeldet werden — dafür dieser Streifen. */
  if (!window.BOS_ACCESS || typeof window.BOS_ACCESS.zeigeSperre !== 'function') {
    notstreifen();
  } else {
    window.BOS_ACCESS.pruefeUndZeigeWarnung(window.BOS_APP_ID);
  }

  var bestehenderState = leseState();
  var bestehendesProfil = aktivesProfil(bestehenderState);
  if (bestehendesProfil) {
    if (!pruefeZugriff(bestehendesProfil)) zeigeKeinZugriff(bestehendesProfil);
    return;
  }

  // ================================================================
  // PFAD 2: Kein Profil auf dem Gerät.
  // ----------------------------------------------------------------
  // STILLGELEGT am 19.09.2026 (Kontenumstellung, Etappe 3.1).
  //
  // Bis dahin baute dieser Pfad aus Vorname + Geburtsdatum + PIN einen
  // Kontoschlüssel nach dem ALTEN Muster (joerg-1987-ber) und legte
  // das Konto notfalls selbst an. Seit dem 19.09. heißen Konten wie
  // die Kennung (backstube01) und werden ausschließlich von der
  // Betriebsleitung angelegt. Dieser Weg würde also ein ZWEITES,
  // falsches Konto-Dokument erzeugen — schlimmer als eine
  // Fehlermeldung.
  //
  // Den Zweck erfüllt jetzt index.html: die Anmeldetür schreibt den
  // Profileintrag (über bos_konto_profil.js), bevor sie zum Satelliten
  // weiterleitet. Dieser Pfad wird deshalb nur noch in einer Lücke
  // erreicht — etwa wenn an der Tür die Drei-Sekunden-Grenze griff.
  // Richtige Antwort darauf: zurück zur Tür, nicht ein eigener Login.
  //
  // Das Login-Overlay samt Datums-Auswahl steht weiter unten noch im
  // Code, hat aber keinen Aufrufer mehr. Aufräumen zusammen mit
  // registriereNeu/pruefeKonto/loginMitPin in bos_accounts.js (B-25),
  // wenn der neue Weg im Betrieb bestätigt ist.
  // ================================================================
  (function () {
    /* Die Wurzel kommt vom Anzeigemodul, nicht aus der eigenen Adresse.
       Härtung vom 19.09.2026: bos_access.js liegt per Vertrag
       im Wurzelverzeichnis und rechnet dort richtig. Diese Datei tut
       das heute zwar auch — sie liegt ebenfalls dort und wird von allen
       zwölf Satelliten als ../bos_standalone_login.js geladen (am Repo
       nachgezählt) —, aber dann hinge die Anmeldung daran, WO diese
       Datei liegt. Über wurzel() ist das egal.
       (Das Einbindungsbeispiel im Kopf zeigte sie fälschlich ohne ../;
        korrigiert am 19.09.2026.) */
    var A = window.BOS_ACCESS;

    /* Ohne Anzeigemodul keine verlässliche Wurzel — dann lieber gar
       nicht weiterleiten als mit geratenem Pfad auf 404 laufen (F-20).
       Der frühere Rückfall pathname.replace(/^.*\//, '') verschluckte
       genau den Ordnernamen. */
    if (!A || typeof A.wurzel !== 'function' || !A.wurzel()) {
      console.error('BOS Standalone-Login: Wurzelverzeichnis nicht bestimmbar ' +
                    '(bos_access.js fehlt oder liegt falsch) — ' +
                    'keine Weiterleitung zur Anmeldung.');
      if (A && typeof A.zeigeSperre === 'function') A.zeigeSperre(null);
      return;
    }

    var wurzel = A.wurzel();
    var hier = window.location.href.split('#')[0];
    if (hier.indexOf(wurzel) !== 0) {
      console.error('BOS Standalone-Login: Seite liegt ausserhalb des ' +
                    'Wurzelverzeichnisses (' + wurzel + ') — keine Weiterleitung.');
      A.zeigeSperre(null);
      return;
    }

    /* weiter= gegen DIESELBE Wurzel gebildet — damit bleibt der
       Ordnername erhalten (produktionsplaner/station_rondo.html). */
    var ziel = wurzel + 'index.html?weiter=' + encodeURIComponent(hier.slice(wurzel.length));
    var fenster = (window.self !== window.top) ? window.top : window;
    try { fenster.location.replace(ziel); }
    catch (e) { window.location.replace(ziel); }
  })();
  return;

  // ---- ab hier ohne Aufrufer, siehe Hinweis oben ----
  /* eslint-disable no-unreachable */
  var style = document.createElement('style');
  style.textContent =
    '.bsl-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;' +
    'justify-content:center;padding:1.2rem;background:var(--bos-bg,#16120e);}' +
    '.bsl-card{width:100%;max-width:380px;background:var(--bos-surface,#221b14);' +
    'border:1px solid var(--bos-border,rgba(255,255,255,.08));border-radius:var(--bos-radius-lg,22px);' +
    'padding:1.6rem 1.4rem;box-shadow:var(--bos-shadow-lg,0 20px 56px rgba(0,0,0,.6));}' +
    '.bsl-title{font-family:var(--bos-font-display,serif);font-weight:900;font-size:1.4rem;' +
    'color:var(--bos-text,#f3ece1);margin:0 0 .2rem;}' +
    '.bsl-sub{font-family:var(--bos-font-body,sans-serif);font-size:.85rem;' +
    'color:var(--bos-text-dim,#ab9c8a);margin:0 0 1.2rem;}' +
    '.bsl-row{margin-bottom:.7rem;}' +
    '.bsl-label{display:block;font-family:var(--bos-font-label,sans-serif);font-weight:700;' +
    'text-transform:uppercase;letter-spacing:.06em;font-size:.72rem;' +
    'color:var(--bos-text-dim,#ab9c8a);margin-bottom:.3rem;}' +
    '.bsl-dates{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:.4rem;}' +
    '.bsl-err{display:none;color:var(--bos-red,#d6584a);font-size:.8rem;margin:.5rem 0 0;' +
    'font-family:var(--bos-font-body,sans-serif);}' +
    '.bsl-btn{width:100%;margin-top:.9rem;padding:.85rem;}' +
    '.bsl-zusatz{display:none;}';
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.className = 'bsl-overlay';
  overlay.innerHTML =
    '<div class="bsl-card">' +
    '  <p class="bsl-title">Wer bist du?</p>' +
    '  <p class="bsl-sub">Einmalig auf diesem Handy — merkt sich dein Profil danach.</p>' +
    '  <div class="bsl-row">' +
    '    <label class="bsl-label">Vorname</label>' +
    '    <input class="bos-input" id="bslName" type="text" autocomplete="given-name">' +
    '  </div>' +
    '  <div class="bsl-row">' +
    '    <label class="bsl-label">Geburtsdatum</label>' +
    '    <div class="bsl-dates">' +
    '      <select class="bos-input" id="bslTag"></select>' +
    '      <select class="bos-input" id="bslMonat"></select>' +
    '      <select class="bos-input" id="bslJahr"></select>' +
    '    </div>' +
    '  </div>' +
    '  <div class="bsl-row bsl-zusatz" id="bslZusatzRow">' +
    '    <label class="bsl-label">Zusatz (falls Name+Geburtsdatum schon vergeben)</label>' +
    '    <input class="bos-input" id="bslZusatz" type="text">' +
    '  </div>' +
    '  <div class="bsl-row">' +
    '    <label class="bsl-label">PIN</label>' +
    '    <input class="bos-input" id="bslPin" type="tel" inputmode="numeric" autocomplete="off">' +
    '  </div>' +
    '  <p class="bsl-err" id="bslErr"></p>' +
    '  <button class="bos-btn bos-btn--amber bsl-btn" id="bslSubmit">Weiter</button>' +
    '</div>';

  if (document.body) document.body.appendChild(overlay);
  else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(overlay); });
  document.documentElement.style.overflow = 'hidden';

  // ---------- Geburtsdatum-Selects befüllen (1:1 Logik aus launcher.html) ----------
  function befuelleDatumsSelects() {
    var tagSel = document.getElementById('bslTag');
    var monatSel = document.getElementById('bslMonat');
    var jahrSel = document.getElementById('bslJahr');

    var tagLeer = document.createElement('option');
    tagLeer.value = ''; tagLeer.textContent = 'Tag';
    tagSel.appendChild(tagLeer);
    for (var t = 1; t <= 31; t++) {
      var ot = document.createElement('option');
      ot.value = (t < 10 ? '0' : '') + t; ot.textContent = t;
      tagSel.appendChild(ot);
    }

    var monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    var monatLeer = document.createElement('option');
    monatLeer.value = ''; monatLeer.textContent = 'Monat';
    monatSel.appendChild(monatLeer);
    monate.forEach(function (name, i) {
      var om = document.createElement('option');
      om.value = (i + 1 < 10 ? '0' : '') + (i + 1); om.textContent = name;
      monatSel.appendChild(om);
    });

    var jahrLeer = document.createElement('option');
    jahrLeer.value = ''; jahrLeer.textContent = 'Jahr';
    jahrSel.appendChild(jahrLeer);
    var heuer = new Date().getFullYear();
    for (var j = heuer - 14; j >= heuer - 80; j--) {
      var oj = document.createElement('option');
      oj.value = String(j); oj.textContent = j;
      jahrSel.appendChild(oj);
    }
  }
  befuelleDatumsSelects();

  // Gibt "YYYY-MM-DD" zurück oder '' bei unvollständig/ungültig (z.B. 31. Februar)
  function leseGeburtsdatum() {
    var t = document.getElementById('bslTag').value;
    var m = document.getElementById('bslMonat').value;
    var j = document.getElementById('bslJahr').value;
    if (!t || !m || !j) return '';
    var probe = new Date(Number(j), Number(m) - 1, Number(t));
    if (probe.getFullYear() !== Number(j) || probe.getMonth() !== Number(m) - 1 || probe.getDate() !== Number(t)) return '';
    return j + '-' + m + '-' + t;
  }

  function zeigeFehler(text) {
    var err = document.getElementById('bslErr');
    err.textContent = text;
    err.style.display = 'block';
  }

  // ---------- Nach erfolgreichem Login/Registrierung ----------
  function schreibeLokalUndAktiviere(kontoId, daten) {
    var state = leseState() || { activeProfileId: null, localProfiles: [], profileData: {} };
    if (!state.localProfiles) state.localProfiles = [];
    if (!state.profileData) state.profileData = {};

    var id = 'konto_' + kontoId;
    var bestehend = state.localProfiles.find(function (p) { return p.id === id; });
    var profil = bestehend || { id: id, quelle: 'konto', kontoSchluessel: kontoId };
    profil.name = daten.name;
    profil.icon = profil.icon || ICON_STANDARD;
    profil.role = daten.role;
    profil.kontoOverrides = daten.overrides || {};
    if (!bestehend) state.localProfiles.push(profil);

    state.activeProfileId = id;
    schreibeState(state);

    overlay.remove();
    if (pruefeZugriff(profil)) {
      document.documentElement.style.overflow = '';
    } else {
      zeigeKeinZugriff(); // frisches, sauberes Overlay statt Login-Karte umzubauen
    }
  }

  // ---------- Submit-Handler ----------
  document.getElementById('bslSubmit').addEventListener('click', function () {
    var vorname = document.getElementById('bslName').value.trim();
    var geburtsdatum = leseGeburtsdatum();
    var pin = document.getElementById('bslPin').value.trim();
    var zusatz = document.getElementById('bslZusatz').value.trim();
    var btn = document.getElementById('bslSubmit');

    document.getElementById('bslErr').style.display = 'none';

    if (!vorname || !geburtsdatum || !pin) {
      zeigeFehler('Bitte Vorname, Geburtsdatum und PIN ausfüllen.');
      return;
    }
    if (!window.BOS_ACCOUNTS || !window.db) {
      zeigeFehler('Offline oder Konto-System nicht geladen — bitte später erneut versuchen.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Einen Moment …';

    (window.BOS_AUTH_READY || Promise.resolve())
      .then(function () { return window.BOS_ACCOUNTS.pruefeKonto(window.db, vorname, geburtsdatum, zusatz); })
      .then(function (stand) {
        if (!stand.existiert) {
          return window.BOS_ACCOUNTS.registriereNeu(window.db, vorname, geburtsdatum, pin, zusatz)
            .then(function (ergebnis) { schreibeLokalUndAktiviere(ergebnis.id, ergebnis.daten); });
        }
        return window.BOS_ACCOUNTS.loginMitPin(window.db, stand.id, pin).then(function (ergebnis) {
          if (!ergebnis || ergebnis.falscherPin) {
            btn.disabled = false;
            btn.textContent = 'Weiter';
            document.getElementById('bslZusatzRow').style.display = 'block';
            zeigeFehler('PIN passt nicht zu Vorname+Geburtsdatum. Falls du eine andere Person mit demselben Namen+Geburtsdatum bist: Zusatz ausfüllen und erneut versuchen.');
            return;
          }
          schreibeLokalUndAktiviere(ergebnis.id, ergebnis.daten);
        });
      })
      .catch(function (fehler) {
        console.warn('BOS Standalone-Login: fehlgeschlagen', fehler);
        btn.disabled = false;
        btn.textContent = 'Weiter';
        zeigeFehler('Etwas ist schiefgelaufen. Bitte erneut versuchen.');
      });
  });
})();
