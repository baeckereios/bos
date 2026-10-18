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

   SPRUCH ODER CRUMBLE (NEU 18.10.2026, Nachtrag 6, K54; Ulf 04:11): Jeder
   10-s-Wechsel ist ENTWEDER ein Spruch wie bisher (ohne Figur) ODER ein
   Crumble-Auftritt: Figur mittig auf einer eigenen Bühne (.bosss__buehne,
   Unterkante bei --bosss-fuss = 38 % Bildschirmhöhe), Label und Text leer,
   eine Nummer (ihr Spruch in der Blase) oder mit spielplatz.auftritt_pose_anteil
   eine Spielplatz-Pose. Anteil der Auftritte spielplatz.auftritt_anteil (0,35),
   nie zwei hintereinander. Die beiläufigen schoner_*-Reaktionen auf Sprüche
   entfallen (er ist dann nicht da); Schlaf im Schoner entfällt (Fabrik gibt
   schlaf:false). Größe je Gerät über setzeFigurGroesse(px), 0 = aus (Schoner
   wie vor Crumble: nur Sprüche, "Tippen zum Fortfahren", jeder Tipp schließt).
   Konto-Aus (figurAn) bleibt der Hauptschalter. Zeiten 3 min / 10 s und Ebene
   1850 unverändert. Z1 (Go 04:23): die Schoner-Figur hat keinen speicher —
   sichtbar/x je Wechsel landen nie im Gerätespeicher.

   CHANGELOG
     2026-10-18 · 06:23 · Nachtrag 6 (K50/K54, Bau-Chat; Bauplan 04:21, Go 04:23):
       Auftritte statt Figur-daneben, Bühne .bosss__buehne, setzeFigurGroesse(),
       Hinweistext je Wechsel, Prüfhaken _wechsel()/_auftritte()/_letzterWechsel()/_rotation().
       auftritt_anteil = Anteil aller Wechsel (Würfel p = a/(1−a) nach einem Spruch); erster
       Auftritt wartet auf den Aufbau der Figur (N6-8).
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
  var figurPx = null;       // T6 (Nachtrag 6): Größe je Gerät (px), 0 = aus, null = Vorgabe der Fabrik
  var HINT_OHNE = 'Tippen zum Fortfahren';
  var HINT_MIT = 'Neben Crumble tippen';
  var auftritt = false, letzterWarAuftritt = false, zaehlAuftritte = 0, zaehlWechsel = 0, auftrittTimer = null;   // T8
  function figurDa() { return !!(figur && figurAn && figurPx !== 0 && figur.istAn && figur.istAn()); }
  function holeFigur() {
    if (figur || !figurFabrik) return figur;
    try { figur = figurFabrik(buehne) || null; if (figur && figurPx) figur.setzeGroesse(figurPx); }
    catch (e) { console.error('BOS_SCREENSAVER: Figur konnte nicht angelegt werden', e); figur = null; figurFabrik = null; }
    return figur;
  }
  function setzeHint() {
    var h = root.querySelector('.bosss__hint');
    if (h) h.textContent = (figurDa() && auftritt) ? HINT_MIT : HINT_OHNE;
  }
  function sp() { var m = figur && figur.manifest ? figur.manifest() : null; return (m && m.spielplatz) || {}; }
  function zufall(liste) { return liste[Math.floor(Math.random() * liste.length)]; }
  /* Auftritt: Figur mittig, Nummer (oder Pose). Spruch: Figur weg. */
  function figurZeigen(ja) {
    if (!figur) return;
    var tu = function () {
      try {
        if (ja) { if (!visible || !auftritt) return; figur.sichtbar(true, true); figur.setzeX(0.5, true); }
        else { figur.sichtbar(false, true); }
      } catch (e) { console.warn('BOS_SCREENSAVER: Figur zeigen', e); }
    };
    // N6-8: beim allerersten Schoner ist die Figur noch im Aufbau (Manifest lädt) — setzeX vor dem Aufbau verpuffte (Figur bei x_start)
    if (figur.wurzel && figur.wurzel()) tu(); else if (figur.bereit) figur.bereit.then(tu);
  }
  function starteAuftritt() {
    if (auftrittTimer) { clearTimeout(auftrittTimer); auftrittTimer = null; }
    figurZeigen(true);
    auftrittTimer = setTimeout(function () {
      auftrittTimer = null;
      if (!visible || !auftritt || !figurDa()) return;
      if (!(figur.manifest && figur.manifest())) { if (figur.bereit) figur.bereit.then(function () { if (visible && auftritt && figurDa()) starteAuftritt(); }); return; }   // N6-8: erst nach dem Aufbau spielen
      try {
        var poseAnteil = typeof sp().auftritt_pose_anteil === 'number' ? sp().auftritt_pose_anteil : 0.25;
        var posen = sp().tippZustaende || [];
        if (posen.length && Math.random() < poseAnteil) figur.zeige(zufall(posen));
        else if (!figur.nummer()) { if (posen.length) figur.zeige(zufall(posen)); }
      } catch (e) { console.warn('BOS_SCREENSAVER: Auftritt', e); }
    }, 300);
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
  // T9 (Nachtrag 6): Bühne für den Auftritt — Stil in hamster_figur.css (.bosss__buehne), Fuß-Höhe --bosss-fuss
  var buehne = document.createElement('div');
  buehne.className = 'bosss__buehne';
  root.appendChild(buehne);

  /* ---------- Inhalt wählen/anzeigen ---------- */
  function renderContent(crossfade) {
    var entries = window.BOS_SCREENSAVER_CONTENT || [];
    if (!entries.length) return;
    // T8 (Nachtrag 6, K54): Spruch ODER Crumble — Auftritt mit spielplatz.auftritt_anteil, nie zwei hintereinander, nie ohne Figur
    zaehlWechsel++;
    // auftritt_anteil ist der ANTEIL ALLER WECHSEL, der Auftritte sind. Weil nie zwei aufeinander folgen, wird nur nach einem
    // Spruch gewürfelt — mit p = a/(1−a), damit der gemessene Anteil a trifft (0,35 → p 0,54; mit p = a käme nur a/(1+a) = 0,26 heraus).
    var anteil = typeof sp().auftritt_anteil === 'number' ? sp().auftritt_anteil : 0.35;
    var p = anteil >= 0.5 ? 1 : anteil / (1 - anteil);
    var neuAuftritt = figurDa() && !letzterWarAuftritt && Math.random() < p;
    var entry = null;
    if (!neuAuftritt) {
      var idx;
      do { idx = Math.floor(Math.random() * entries.length); }
      while (entries.length > 1 && idx === lastIndex);
      lastIndex = idx;
      entry = entries[idx];
    }
    function apply() {
      auftritt = neuAuftritt; letzterWarAuftritt = neuAuftritt;
      if (neuAuftritt) { zaehlAuftritte++; labelEl.textContent = ''; textEl.textContent = ''; starteAuftritt(); }
      else { labelEl.textContent = LABELS[entry.kategorie] || ''; textEl.textContent = entry.text; if (auftrittTimer) { clearTimeout(auftrittTimer); auftrittTimer = null; } figurZeigen(false); }
      setzeHint();
      buehne.classList.remove('bosss__buehne--out');
    }
    if (crossfade) {
      contentEl.classList.add('bosss__content--out');
      buehne.classList.add('bosss__buehne--out');
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
    letzterWarAuftritt = false; auftritt = false;
    // 17.10.2026: Figur lazy anlegen, dann ein/aus nach Profil; T8: versteckt starten, der Wechsel entscheidet
    if (holeFigur()) { try { figur.an(figurAn && figurPx !== 0); figur.sichtbar(false, true); } catch (e) { console.warn('BOS_SCREENSAVER: figur.an', e); } }
    renderContent(false);
    root.classList.add('bosss--visible');
    rotateTimer = setInterval(function () { renderContent(true); }, ROTATE_INTERVAL_MS);
  }
  function hide() {
    visible = false;
    root.classList.remove('bosss--visible');
    if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
    if (auftrittTimer) { clearTimeout(auftrittTimer); auftrittTimer = null; }
    auftritt = false;
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
      if (visible) { holeFigur(); if (figur) { figur.an(figurAn && figurPx !== 0); figur.sichtbar(auftritt, true); } setzeHint(); }
    },
    /* 17.10.2026 (Crumble): Ein/Aus aus dem Profil (Feld hamster; fehlt = an). Wirkt sofort. */
    figurAn: function (wert) {
      figurAn = wert !== false;
      if (figur && visible) { try { figur.an(figurAn && figurPx !== 0); if (!figurAn) { auftritt = false; } } catch (e) {} }
      setzeHint();
    },
    /* T6 (Nachtrag 6, K50): Größe der Schoner-Figur in px je Gerät; 0 = aus (nie Auftritte, Schoner wie vor Crumble). */
    setzeFigurGroesse: function (px) {
      figurPx = (px === 0 || px === '0' || px === 'aus') ? 0 : (Number(px) > 0 ? Number(px) : null);
      if (figur) {
        try {
          if (figurPx) figur.setzeGroesse(figurPx);
          if (visible) { figur.an(figurAn && figurPx !== 0); if (figurPx === 0) auftritt = false; }
        } catch (e) { console.warn('BOS_SCREENSAVER: setzeFigurGroesse', e); }
      }
      setzeHint();
    },
    /* nur für Prüfwerkzeuge (Playwright, kein Produktivaufrufer): Figur lesen, Sichtbarkeit lesen,
       Schoner sofort zeigen statt 3 Minuten zu warten. Die Zeiten selbst bleiben unverändert. */
    _figur: function () { return figur; },
    _sichtbar: function () { return visible; },
    _letzteAktivitaet: function () { return letzteAktivitaet; },
    _zeigeJetzt: function () { if (started && !visible) { if (idleTimer) clearTimeout(idleTimer); show(); } },
    /* Nachtrag 6, nur Prüfwerkzeuge: nächster Wechsel sofort (ohne Überblendung), Zähler, letzter Wechsel */
    _wechsel: function () { if (visible) renderContent(false); },
    _auftritte: function () { return { auftritte: zaehlAuftritte, wechsel: zaehlWechsel }; },
    _letzterWechsel: function () { return auftritt ? 'auftritt' : 'spruch'; },
    _buehne: function () { return buehne; },
    _rotation: function (ja) { if (!visible) return; if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; } if (ja !== false) rotateTimer = setInterval(function () { renderContent(true); }, ROTATE_INTERVAL_MS); }   // Messung: 10-s-Wechsel anhalten/fortsetzen
  };
})();
