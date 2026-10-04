/* ================================================================
   BOS Screensaver — eigenständiges Modul
   ================================================================
   Neu am 03.09.2026 (SESSION_2026-09-03_BOOTSCREEN_SCREENSAVER_
   AUSLAGERUNG.md). Ziel: "offizielleres" System-Gefühl + beiläufig
   positive Stimmung (Fakten/Sprüche/Witze/Emoji aus Backstube,
   Nachtschicht, Konditorei, Verkauf) während längerer Inaktivität.

   BEWUSST KEIN Zugriffsschutz — reine Ambiente-Anzeige, jeder Tipp/
   Klick/Tastendruck schließt sofort (Entscheidung Ulf, 03.09.2026,
   Alternative wäre ein PIN-geschützter Sperrbildschirm gewesen).
   Verwechsle das nicht mit einem Lock-Screen-Konzept.

   Inhalt kommt aus bos_screensaver_content.js (reine Daten, siehe
   dort). Diese Datei ist nur die Anzeige-Mechanik.

   Muster: gleiche Form wie bos_theme_sync.js / bos_bootscreen.js —
   injiziert sich selbst, bietet dem Host eine schmale Schnittstelle:
     BOS_SCREENSAVER.start()  — einmal aufrufen, sobald ein echtes
                                 Profil aktiv ist (siehe applyProfileUI()
                                 in launcher.html). Mehrfachaufruf ist
                                 unschädlich (no-op ab dem 2. Mal).

   BEKANNTE V1-EINSCHRÄNKUNG (bewusst, siehe BOS_BAUSTELLEN.md):
   Aktivität wird nur auf dem Launcher-Desktop selbst erkannt (Klicks/
   Tastendruck auf diesem Dokument). Tippt jemand nur INNERHALB eines
   offenen Satelliten-iframes (z. B. in verbrauch_manuell), sieht der
   Launcher das nicht — der Screensaver könnte sich theoretisch über
   ein aktiv genutztes Fenster legen. Sauber wäre eine geräteweite
   Aktivitäts-Erkennung über alle Satelliten hinweg, das würde aber an
   jede Satelliten-Datei ein neues Skript hängen (= das offene Access-
   Guard-Rollout-Thema aus BOS_BAUSTELLEN.md). Für v1 bewusst nicht
   mitgezogen, analog zur "kein Live-Sync"-Einschränkung bei
   bos_theme_sync.js.

   z-index 1850: unter Profil-Auswahl (1900) und Bootscreen (1950),
   über Taskbar/Fenstern/Topbar (≤600) — der Screensaver kann also nie
   den Login-Vorgang oder den Bootscreen verdecken, siehe
   BOS_ABHAENGIGKEITEN.md für die vollständige Layer-Reihenfolge.
   ================================================================ */
(function () {
  'use strict';

  var IDLE_TIMEOUT_MS = 3 * 60 * 1000;   // 3 Minuten Inaktivität bis der Screensaver kommt
  var ROTATE_INTERVAL_MS = 10 * 1000;    // Inhalt wechselt alle 10s solange sichtbar
  // Beide Werte bei Bedarf einfach hier anpassen, keine weitere Stelle im Code betroffen.

  var LABELS = {
    backstube: 'Aus der Backstube',
    nachtschicht: 'Nachtschicht',
    konditorei: 'Konditorei',
    verkauf: 'Vorne im Verkauf',
    fakt: 'Wusstest du schon?',
    spruch: '',
    emoji: ''
  };

  var started = false;
  var visible = false;
  var idleTimer = null;
  var rotateTimer = null;
  var lastIndex = -1;

  /* ---------- Style injizieren ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.bosss {' +
    '  position: fixed; inset: 0; z-index: 1850; background: var(--bos-bg);' +
    '  background-image: radial-gradient(ellipse 70% 55% at 50% 45%, var(--bos-amber-glow-soft), transparent 70%);' +
    '  display: flex; align-items: center; justify-content: center; padding: 2rem;' +
    '  opacity: 0; pointer-events: none; transition: opacity 500ms var(--bos-ease);' +
    '}' +
    '.bosss--visible { opacity: 1; pointer-events: auto; }' +
    '.bosss__content {' +
    '  display: flex; flex-direction: column; align-items: center; gap: 1rem;' +
    '  max-width: 62ch; text-align: center;' +
    '  transition: opacity .3s ease, transform .3s ease;' +
    '}' +
    '.bosss__content--out { opacity: 0; transform: translateY(6px); }' +
    '.bosss__label {' +
    '  font-family: var(--bos-font-label); font-weight: 800; font-size: .78rem;' +
    '  text-transform: uppercase; letter-spacing: .14em; color: var(--bos-amber); min-height: 1em;' +
    '}' +
    '.bosss__text {' +
    '  font-family: var(--bos-font-display); font-weight: 600; font-style: italic;' +
    '  font-size: clamp(1.3rem, 3.4vw, 2rem); line-height: 1.35; color: var(--bos-text);' +
    '}' +
    '.bosss__hint {' +
    '  font-family: var(--bos-font-label); font-size: .68rem; letter-spacing: .06em;' +
    '  text-transform: uppercase; color: var(--bos-text-faint); margin-top: .6rem;' +
    '}';
  document.head.appendChild(style);

  /* ---------- Markup injizieren ---------- */
  var root = document.createElement('div');
  root.className = 'bosss';
  root.id = 'bosScreensaver';
  root.innerHTML =
    '<div class="bosss__content" id="bosssContent">' +
    '  <div class="bosss__label" id="bosssLabel"></div>' +
    '  <div class="bosss__text" id="bosssText"></div>' +
    '  <div class="bosss__hint">Tippen zum Fortfahren</div>' +
    '</div>';
  document.body.appendChild(root);

  var contentEl = document.getElementById('bosssContent');
  var labelEl = document.getElementById('bosssLabel');
  var textEl = document.getElementById('bosssText');

  /* ---------- Inhalt wählen/anzeigen ---------- */
  function renderContent(crossfade) {
    var entries = window.BOS_SCREENSAVER_CONTENT || [];
    if (!entries.length) return;
    var idx;
    do { idx = Math.floor(Math.random() * entries.length); }
    while (entries.length > 1 && idx === lastIndex);
    lastIndex = idx;
    var entry = entries[idx];

    function apply() {
      labelEl.textContent = LABELS[entry.kategorie] || '';
      textEl.textContent = entry.text;
    }
    if (crossfade) {
      contentEl.classList.add('bosss__content--out');
      setTimeout(function () {
        apply();
        contentEl.classList.remove('bosss__content--out');
      }, 260);
    } else {
      apply();
    }
  }

  /* ---------- Anzeigen / Verbergen ---------- */
  function show() {
    visible = true;
    renderContent(false);
    root.classList.add('bosss--visible');
    rotateTimer = setInterval(function () { renderContent(true); }, ROTATE_INTERVAL_MS);
  }
  function hide() {
    visible = false;
    root.classList.remove('bosss--visible');
    if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
    armIdleTimer();
  }

  /* ---------- Idle-Erkennung ---------- */
  function armIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!started || visible) return;
    idleTimer = setTimeout(show, IDLE_TIMEOUT_MS);
  }
  function onActivity() {
    if (!started) return;
    if (visible) { hide(); return; }
    armIdleTimer();
  }
  document.addEventListener('pointerdown', onActivity, true);
  document.addEventListener('touchstart', onActivity, true);
  document.addEventListener('keydown', onActivity, true);

  /* ---------- Öffentliche Schnittstelle ---------- */
  window.BOS_SCREENSAVER = {
    start: function () {
      if (started) return; // Mehrfachaufruf (z.B. bei Profilwechsel) ist ein no-op
      started = true;
      armIdleTimer();
    }
  };
})();
