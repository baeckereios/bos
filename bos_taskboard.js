/* ================================================================
   BOS Taskboard — eigenständiges Launcher-Widget
   ================================================================
   Neu 05.09.2026, siehe SESSION_2026-09-05_AUFGABEN_TASKBOARD_KONZEPT.md.

   Muster wie bos_bootscreen.js/bos_screensaver.js: eine Datei, die sich
   selbst um ihr Markup/CSS kümmert und dem Host nur eine schmale
   Funktion anbietet — HIER mit einer bewussten Abweichung: bootscreen/
   screensaver injizieren komplett NEUE DOM-Knoten, dieses Widget
   übernimmt dagegen ein BESTEHENDES Host-Element (#taskbarHome, bisher
   "B"-Knopf/"alle minimieren"). Ulf-Entscheidung 05.09.2026: die
   Aufgabenliste sollte den bestehenden, prominenten Taskbar-Platz
   bekommen statt eines neuen Header-Icons — "alle minimieren" wird
   ersatzlos gestrichen (unbekannt/ungenutzt, selbst Windows hat das
   trotz mehr offener Programme nicht). Keine stille Übernahme:
   launcher.html hat den alten taskbarHome-Click-Handler entfernt, siehe
   dortiger Kommentar an der Stelle.

   Öffentliche Schnittstelle: BOS_TASKBOARD.init() — einmal aus
   launcher.html init() aufgerufen, analog zu anderen Modulen hier.

   Abhängigkeiten (müssen VOR dieser Datei geladen sein, siehe
   launcher.html-Script-Reihenfolge):
   - bos_firebase_config.js (window.db, window.BOS_AUTH_READY)
   - bos_launcher_profiles.js (window.BOS_PROFILES)
   - bos_profil_lookup.js (window.BOS_PROFIL_LOOKUP)
   - bos_accounts.js (window.BOS_ACCOUNTS, für ladeKonto())
   - bos_aufgaben_logik.js (window.BOS_AUFGABEN_LOGIK)
   - #taskbarHome muss bereits im DOM existieren (Markup steht vor den
     Script-Includes am Ende von <body>)

   Popup-Mechanik: zentriertes Modal, wiederverwendet .bos-modal-overlay/
   .bos-modal — dasselbe Muster wie das Kachel-Bearbeiten-Modal und der
   BackStore-Hinweis in launcher.html, deren CSS dort schon steckt, hier
   NICHT dupliziert. **Geändert 05.09.2026, live nach Ulf-Feedback:**
   ursprünglich das Bottom-Sheet-Muster der ❓-Kurzhilfe (.bos-help-sheet)
   — wirkte in der Praxis für dieses Popup nicht passend, auf Ulfs
   Wunsch auf das zentrierte Modal umgestellt.

   Berechtigung "Abhaken": clientseitig geprüft (Ulf-Entscheidung
   05.09.2026, siehe bos_accounts.js-Kopfkommentar — serverseitig ist das
   mit der geteilten anonymen Sitzung nicht härter durchsetzbar). Admin
   darf immer abhaken (gleiche Konvention wie überall sonst im System),
   alle anderen nur mit frisch aus Firestore gelesenem
   taskboardAbhaken:true. Die lokale Profil-Auflösung kommt aus
   bos_profil_lookup.js (geteilt mit launcher.html/backstore.html, siehe
   dortiger Kopfkommentar — konsolidiert 05.09.2026, vorher drei
   unabhängige Kopien derselben Logik).

   Aktualisierung: lädt einmal bei init(), danach direkt nach jedem
   eigenen Abhaken neu, zusätzlich alle 5 Minuten im Hintergrund. Kein
   Live-Listener — konsistent mit dem Rest des Projekts (einmaliges
   .get() statt onSnapshot, siehe konten_verwaltung.html/
   aufgaben_verwaltung.html).

   CHANGELOG
     2026-09-26 · Fix (N-9 / NF-14, Kontroll-Chat) — nicht Teil des
       Namens-Fundaments, getrennt ausgeliefert.
       pruefeAbhakenRecht() las das Konto unter profil.id
       ("konto_backstube01") statt unter der Kennung ("backstube01") — das
       Dokument gibt es nicht, also konnten nur Admins abhaken, egal was
       in der Kontenverwaltung gesetzt war. Seit der Kontenliste-Regel vom
       26.09. scheiterte der Zugriff zusätzlich still (catch → false).
       Jetzt: profil.kontoSchluessel; fehlt der (alte Profile), aus
       profil.id abgeleitet ("konto_" abgeschnitten, sonst unverändert).
       Scheitert das Lesen, steht der Grund im Popup statt nur "keine
       Berechtigung".
     2026-09-27 · Fix (NF-52, Namens-Fundament)
       Konto ohne Haken (Profil freigeschaltet === false): keine Abfrage
       mehr — sie scheiterte an der Regel und warnte bei jedem Laden und alle
       paar Minuten erneut. Popup sagt stattdessen „Noch nicht
       freigeschaltet“. Außerdem: scheitert das Laden sonst, steht der Grund
       im Popup statt „Nichts offen“ (vorher still).
     2026-09-26 · Fix (N-18 / NF-27, Kontroll-Chat)
       Rückfall an ermittleKontoId() in mein_konto.html angeglichen: ohne
       kontoSchluessel und ohne Präfix "konto_" → null, kein Lesezugriff,
       neutraler Hinweis. Vorher las er unter profil.id und meldete bei
       alten Nicht-Konto-Profilen "permission-denied".
   ================================================================ */
(function () {
  'use strict';

  var REFRESH_MS = 5 * 60 * 1000;
  var offeneAufgaben = [];
  var ladeFehler = null;        // 27.09.2026: Grund, falls das Laden scheiterte (vorher still)
  var nichtFreigeschaltet = false;

  /* NF-52 (27.09.2026): Konto ohne Haken — gar nicht erst lesen. Die Regel
     verweigert es ohnehin; jeder Versuch war ein gescheiterter Zugriff mit
     Konsolenwarnung, und das Popup behauptete „Nichts offen“. */
  function istNichtFreigeschaltet() {
    var p = window.BOS_PROFIL_LOOKUP && window.BOS_PROFIL_LOOKUP.aktivesProfil ? window.BOS_PROFIL_LOOKUP.aktivesProfil() : null;
    return !!(p && p.freigeschaltet === false && p.kontoVorhanden !== false);
  }
  var darfAbhaken = false;
  var rechteFehler = null;   // 26.09.2026: Grund, falls das Konto nicht lesbar war

  /* ---------- Style injizieren (nur das Neue — Bottom-Sheet-CSS existiert schon in launcher.html) ---------- */
  var style = document.createElement('style');
  style.textContent =
    '#taskbarHome { display: flex; align-items: center; justify-content: center; position: relative; }' +
    '.bt-badge {' +
    '  position: absolute; top: -4px; right: -4px; min-width: 17px; height: 17px; padding: 0 3px;' +
    '  border-radius: 999px; background: var(--bos-red); color: #fff; font-family: var(--bos-font-label);' +
    '  font-size: .62rem; font-weight: 800; display: flex; align-items: center; justify-content: center;' +
    '  border: 2px solid var(--bos-surface); line-height: 1;' +
    '}' +
    '.bt-item {' +
    '  display: flex; align-items: flex-start; gap: .6rem; padding: .6rem 0;' +
    '  border-bottom: 1px solid var(--bos-border);' +
    '}' +
    '.bt-item:last-of-type { border-bottom: none; }' +
    '.bt-item__check {' +
    '  width: 32px; height: 32px; border-radius: var(--bos-radius-sm); flex-shrink: 0;' +
    '  border: 1px solid var(--bos-border-strong); background: var(--bos-bg-soft); color: var(--bos-text);' +
    '  display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer;' +
    '}' +
    '.bt-item__check[disabled] { cursor: default; opacity: .35; }' +
    '.bt-item__text { font-size: .92rem; flex: 1; padding-top: .35rem; }' +
    '.bt-item__badge {' +
    '  font-family: var(--bos-font-label); font-size: .6rem; text-transform: uppercase; letter-spacing: .04em;' +
    '  color: var(--bos-amber); margin-left: .5em; white-space: nowrap;' +
    '}' +
    '.bt-empty, .bt-locked { color: var(--bos-text-dim); font-size: .88rem; padding: .5rem 0; }';
  document.head.appendChild(style);

  /* ---------- Popup-Markup injizieren (wiederverwendet .bos-modal-overlay/.bos-modal) ---------- */
  var overlay = document.createElement('div');
  overlay.className = 'bos-modal-overlay';
  overlay.id = 'taskboardOverlay';
  overlay.innerHTML =
    '<div class="bos-modal" id="taskboardModal">' +
    '  <h3 class="bos-title">🗒️ Aufgaben</h3>' +
    '  <div id="taskboardList"></div>' +
    '  <button class="bos-btn bos-btn--amber" id="taskboardCloseBtn">Schließen</button>' +
    '</div>';
  document.body.appendChild(overlay);
  // Klick auf den abgedunkelten Rand schließt, Klick in die Box selbst nicht —
  // gleiche Prüfung wie beim bestehenden profileOverlay in launcher.html.
  overlay.addEventListener('click', function (e) {
    if (e.target.id === 'taskboardOverlay') schliessePopup();
  });

  /* ---------------- Lokales Profil ---------------- */
  // NEU 05.09.2026: kommt jetzt aus bos_profil_lookup.js (geteilt mit
  // launcher.html/backstore.html) — vorher eine dritte, unabhängige Kopie
  // derselben Logik, siehe BOS_ABHAENGIGKEITEN.md §5 Punkt 9 (jetzt erledigt).
  function leseLokalesProfil() {
    return window.BOS_PROFIL_LOOKUP ? window.BOS_PROFIL_LOOKUP.aktivesProfil() : null;
  }

  /* ---------- Berechtigung "Abhaken" prüfen ---------- */
  function pruefeAbhakenRecht() {
    var profil = leseLokalesProfil();
    if (!profil) return Promise.resolve(false);
    if (profil.role === 'admin') return Promise.resolve(true); // gleiche Konvention wie überall sonst im System
    if (!window.BOS_ACCOUNTS || !window.db) return Promise.resolve(false);
    // 26.09.2026 (N-9): die Konto-Dokument-ID ist die Kennung, nicht die
    // Profil-ID. Alte Profile ohne kontoSchluessel: aus der ID ableiten.
    // 26.09.2026 (N-18 / NF-27): wie ermittleKontoId() in mein_konto.html —
    // ohne kontoSchluessel und ohne Präfix "konto_" ist es kein Konto-Profil:
    // null, kein Lesen, der neutrale Hinweis.
    var kennung = profil.kontoSchluessel ||
      (profil.id && profil.id.indexOf('konto_') === 0 ? profil.id.slice(6) : null);
    rechteFehler = null;
    if (!kennung) return Promise.resolve(false);
    return window.BOS_ACCOUNTS.ladeKonto(window.db, kennung).then(function (konto) {
      return !!(konto && konto.taskboardAbhaken);
    }).catch(function (fehler) {
      console.error('BOS Taskboard: Abhak-Recht nicht lesbar für ' + kennung, fehler);
      rechteFehler = ((fehler && fehler.code) ? fehler.code + ' — ' : '') + ((fehler && fehler.message) || String(fehler));
      return false;
    });
  }

  /* ---------- Aufgaben laden ---------- */
  function ladeOffeneAufgaben() {
    if (!window.BOS_AUTH_READY || !window.db) return Promise.resolve();
    nichtFreigeschaltet = istNichtFreigeschaltet();
    if (nichtFreigeschaltet) { offeneAufgaben = []; ladeFehler = null; renderBadge(); return Promise.resolve(); }
    return window.BOS_AUTH_READY.then(function () {
      return window.db.collection('bos_events').where('type', '==', 'produktionsleiter_aufgabe').get();
    }).then(function (snap) {
      var alle = [];
      snap.forEach(function (doc) { alle.push(Object.assign({ id: doc.id }, doc.data())); });
      offeneAufgaben = alle.filter(function (a) {
        return window.BOS_AUFGABEN_LOGIK ? window.BOS_AUFGABEN_LOGIK.istOffen(a) : !a.erledigt;
      });
      ladeFehler = null;
      renderBadge();
    }).catch(function (fehler) {
      console.warn('BOS_TASKBOARD: Laden fehlgeschlagen', fehler);
      // 27.09.2026: sichtbar im Popup statt „Nichts offen“
      ladeFehler = ((fehler && fehler.code) ? fehler.code + ' — ' : '') + ((fehler && fehler.message) || String(fehler));
    });
  }

  /* ---------- Badge auf dem Taskbar-Knopf ---------- */
  function renderBadge() {
    var btn = document.getElementById('taskbarHome');
    if (!btn) return;
    var n = offeneAufgaben.length;
    btn.innerHTML = '🗒️' + (n > 0 ? '<span class="bt-badge">' + (n > 99 ? '99+' : n) + '</span>' : '');
  }

  /* ---------- Popup-Inhalt rendern ---------- */
  function renderPopup() {
    var list = document.getElementById('taskboardList');
    list.innerHTML = '';
    if (!offeneAufgaben.length) {
      list.innerHTML = nichtFreigeschaltet
        ? '<div class="bt-empty">Noch nicht freigeschaltet — Aufgaben siehst du, sobald dein Konto aktiv ist.</div>'
        : (ladeFehler
          ? '<div class="bt-empty">Aufgaben konnten nicht geladen werden: ' + String(ladeFehler).replace(/[&<>]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }) + '</div>'
          : '<div class="bt-empty">Nichts offen 🌙</div>');
      return;
    }
    if (!darfAbhaken) {
      var hinweis = document.createElement('div');
      hinweis.className = 'bt-locked';
      hinweis.textContent = rechteFehler
        ? 'Abhak-Recht konnte nicht geprüft werden: ' + rechteFehler
        : 'Nur ausgewählte Personen können Aufgaben abhaken.';
      list.appendChild(hinweis);
    }
    offeneAufgaben.forEach(function (a) {
      var row = document.createElement('div');
      row.className = 'bt-item';

      var check = document.createElement('button');
      check.className = 'bt-item__check';
      check.textContent = '☐';
      check.title = darfAbhaken ? 'Als erledigt markieren' : 'Keine Berechtigung';
      check.disabled = !darfAbhaken;
      check.addEventListener('click', function () { if (darfAbhaken) abhaken(a); });
      row.appendChild(check);

      var text = document.createElement('div');
      text.className = 'bt-item__text';
      text.textContent = a.text;
      if (a.verhalten === 'dauerhaft') {
        var badge = document.createElement('span');
        badge.className = 'bt-item__badge';
        badge.textContent = 'bleibt bestehen';
        text.appendChild(badge);
      }
      row.appendChild(text);

      list.appendChild(row);
    });
  }

  function abhaken(aufgabe) {
    var profil = leseLokalesProfil();
    window.db.collection('bos_events').doc(aufgabe.id).update({
      erledigt: true,
      erledigt_von: profil ? profil.id : null,
      erledigt_am: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      return ladeOffeneAufgaben();
    }).then(renderPopup).catch(function (fehler) {
      console.warn('BOS_TASKBOARD: Abhaken fehlgeschlagen', fehler);
    });
  }

  /* ---------- Öffnen/Schließen ---------- */
  function oeffnePopup() {
    document.getElementById('taskboardOverlay').classList.add('bos-modal-overlay--visible');
    renderPopup(); // sofort der letzte bekannte Stand, kein leeres Flackern beim Öffnen
    Promise.all([ladeOffeneAufgaben(), pruefeAbhakenRecht()]).then(function (ergebnisse) {
      darfAbhaken = ergebnisse[1];
      renderPopup(); // dann mit frisch geladenem Stand überschreiben
    });
  }
  function schliessePopup() {
    document.getElementById('taskboardOverlay').classList.remove('bos-modal-overlay--visible');
  }
  document.getElementById('taskboardCloseBtn').addEventListener('click', schliessePopup);

  /* ---------- Öffentliche Schnittstelle ---------- */
  function init() {
    var btn = document.getElementById('taskbarHome');
    if (!btn) { console.warn('BOS_TASKBOARD: #taskbarHome nicht im DOM gefunden'); return; }
    btn.title = 'Aufgaben';
    renderBadge(); // sofort Icon setzen, auch bevor die erste Ladung durch ist
    btn.addEventListener('click', oeffnePopup);
    ladeOffeneAufgaben();
    setInterval(ladeOffeneAufgaben, REFRESH_MS);
  }

  window.BOS_TASKBOARD = { init: init };
})();
