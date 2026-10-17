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
   mitgezogen. (Der frühere Vergleich mit der "kein Live-Sync"-Grenze von
   bos_theme_sync.js ist seit 16.10.2026 hinfällig — der Theme-Sync zieht
   jetzt über das storage-Ereignis nach. Für die Aktivitäts-Erkennung gilt
   die Grenze hier weiter: Antippen im Iframe sieht der Launcher nicht.)

   z-index 1850: unter Profil-Auswahl (1900) und Bootscreen (1950),
   über Taskbar/Fenstern/Topbar (≤600) — der Screensaver kann also nie
   den Login-Vorgang oder den Bootscreen verdecken, siehe
   BOS_ABHAENGIGKEITEN.md für die vollständige Layer-Reihenfolge.

   CRUMBLE (NEU 17.10.2026, #62 Stufe 1): Der Schoner ist Crumbles
   "Spielplatz" (Ulf 17.10., 04:32). Der Host stellt eine Fabrik:
     BOS_SCREENSAVER.setzeFigur(function (container) { return figur; })
   Sie wird LAZY beim ersten show() gerufen (keine Ladereihenfolge nötig;
   ohne setzeFigur läuft der Schoner wie bisher). Die Figur lebt IM root
   (Einbettung 'container', liegt damit vor dem Hintergrund). show() →
   figur.an(figurAn), hide() → figur.an(false). Nach jedem Inhalt feuert
   figur.ereignis('schoner_' + kategorie, { beilaeufig: true }).
   BOS_SCREENSAVER.figurAn(wert): Ein/Aus aus dem Profil (Feld hamster).
   AUSNAHME von "jeder Tipp schließt" (Ulf 17.10., 05:52, E6 im
   HAMSTER_FIGUR_KOMPENDIUM.md): Ein Tipp AUF Crumble im sichtbaren
   Schoner schließt NICHT (die Figur reagiert selbst), ein Tipp daneben
   schließt wie bisher. Gilt nur für die Figur IM Schoner — der Knopf-
   Crumble in der Kopfleiste zählt weiter als Aktivität (sonst käme der
   Schoner über jemanden, der gerade mit ihm spielt). Hinweistext dann
   "Neben Crumble tippen".

   CHANGELOG
     2026-10-17 · 06:49 · Crumble Stufe 1 (K9, Bau-Chat; Anweisung
       Kontroll-Chat 06:00): setzeFigur(), figurAn(), Ausnahme in
       onActivity(), Hinweistext, Ereignis je Inhalt. Zeiten 3 min / 10 s
       und "Tipp schließt" für alles außer Crumble unverändert.
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

  /* ---------- Crumble (NEU 17.10.2026) ---------- */
  var figurFabrik = null;   // vom Host über setzeFigur() gestellt
  var figur = null;         // Instanz, lazy beim ersten show()
  var figurAn = true;       // Profil-Feld hamster (fehlt = an)
  var HINT_OHNE = 'Tippen zum Fortfahren';
  var HINT_MIT = 'Neben Crumble tippen';
  function figurDa() { return !!(figur && figurAn && figur.istAn && figur.istAn()); }
  function holeFigur() {
    if (figur || !figurFabrik) return figur;
    try { figur = figurFabrik(root) || null; }
    catch (e) { console.error('BOS_SCREENSAVER: Figur konnte nicht angelegt werden', e); figur = null; figurFabrik = null; }
    return figur;
  }
  function setzeHint() {
    var h = root.querySelector('.bosss__hint');
    if (h) h.textContent = figurDa() ? HINT_MIT : HINT_OHNE;
  }

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
      // 17.10.2026: Crumble reagiert auf den Inhalt — beiläufig (darf auslassen, schläft durch)
      if (figurDa()) { try { figur.ereignis('schoner_' + entry.kategorie, { beilaeufig: true }); } catch (e) { console.warn('BOS_SCREENSAVER: Figur-Ereignis', e); } }
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
    // 17.10.2026: Figur lazy anlegen, dann ein/aus nach Profil (vor dem ersten Inhalt, damit er reagieren kann)
    if (holeFigur()) { try { figur.an(figurAn); } catch (e) { console.warn('BOS_SCREENSAVER: figur.an', e); } }
    setzeHint();
    renderContent(false);
    root.classList.add('bosss--visible');
    rotateTimer = setInterval(function () { renderContent(true); }, ROTATE_INTERVAL_MS);
  }
  function hide() {
    visible = false;
    root.classList.remove('bosss--visible');
    if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
    if (figur) { try { figur.an(false); } catch (e) { console.warn('BOS_SCREENSAVER: figur.an(false)', e); } }   // 17.10.2026: Timer aus
    armIdleTimer();
  }

  /* ---------- Idle-Erkennung ---------- */
  var letzteAktivitaet = 0;   // nur für Prüfwerkzeuge: wann der Ruhe-Timer zuletzt neu gestellt wurde
  function armIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!started || visible) return;
    letzteAktivitaet = Date.now();
    idleTimer = setTimeout(show, IDLE_TIMEOUT_MS);
  }
  function onActivity(e) {
    if (!started) return;
    if (visible) {
      // 17.10.2026 (E6): Tipp AUF Crumble im Schoner → nicht schließen, die Figur
      // behandelt den Tipp selbst. Nur für die Figur IM Schoner (root), nicht für
      // den Knopf-Crumble in der Kopfleiste (der zählt als Aktivität wie alles andere).
      var ziel = e && e.target && e.target.closest ? e.target : null;
      if (ziel && figurDa() && root.contains(ziel) && ziel.closest('.hf')) return;
      hide(); return;
    }
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
    },
    /* 17.10.2026 (Crumble): Fabrik für die Figur im Schoner. fabrikFn(container)
       liefert eine Figur-Instanz (BOS_HAMSTER_FIGUR.neu({ container, einbettung:
       'container', rolle: 'spielplatz', … })). Wird lazy beim ersten show() gerufen.
       Zweiter Aufruf ersetzt die Fabrik, eine schon angelegte Figur wird abgebaut. */
    setzeFigur: function (fabrikFn) {
      if (figur && figur.zerstoere) { try { figur.zerstoere(); } catch (e) {} }
      figur = null;
      figurFabrik = typeof fabrikFn === 'function' ? fabrikFn : null;
      if (visible) { holeFigur(); if (figur) figur.an(figurAn); setzeHint(); }
    },
    /* 17.10.2026 (Crumble): Ein/Aus aus dem Profil (Feld hamster; fehlt = an). Wirkt sofort. */
    figurAn: function (wert) {
      figurAn = wert !== false;
      if (figur && visible) { try { figur.an(figurAn); } catch (e) {} }
      setzeHint();
    },
    /* nur für Prüfwerkzeuge (Playwright, kein Produktivaufrufer): Figur lesen, Sichtbarkeit lesen,
       Schoner sofort zeigen statt 3 Minuten zu warten. Die Zeiten selbst bleiben unverändert. */
    _figur: function () { return figur; },
    _sichtbar: function () { return visible; },
    _letzteAktivitaet: function () { return letzteAktivitaet; },
    _zeigeJetzt: function () { if (started && !visible) { if (idleTimer) clearTimeout(idleTimer); show(); } }
  };
})();
