/* ================================================================
   BOS Bootscreen — eigenständiges Modul
   ================================================================
   Ausgelagert aus launcher.html am 03.09.2026 (SESSION_2026-09-03_
   BOOTSCREEN_SCREENSAVER_AUSLAGERUNG.md), Anlass: launcher.html wuchs
   zu stark an, cinematische Start-Animation ist aber vollständig
   in sich geschlossen und hat außer window.BOS_APPS keine Abhängigkeit
   zum Rest des Launchers — sauberer Schnitt.

   Muster: gleiche Form wie bos_theme_sync.js — eine Datei, die sich
   selbst um ihr Markup/CSS kümmert und dem Host nur eine Funktion
   anbietet. launcher.html bindet diese Datei per <script src> ein
   und ruft BOS_BOOT.play(onDone) auf, wo früher bosBootPlaySequence
   direkt aufgerufen wurde.

   WICHTIG — Ladereihenfolge: Diese Datei muss VOR dem Launcher-
   Inline-Script eingebunden werden (bei den übrigen <script src>-
   Includes kurz vor </body>, siehe BOS_ABHAENGIGKEITEN.md), und zwar
   nachdem <body> im Markup begonnen hat. Sie injiziert Style+DOM-Node
   sofort beim Laden (nicht erst bei play()), damit applyI18nStatic()
   im Launcher — das VOR play() läuft — die data-i18n-Elemente dieses
   Overlays (boot.status, launcher.subtitle) bereits vorfindet und
   korrekt übersetzt.

   Reine Optik, keine State-/Firestore-Abhängigkeit — kann den
   eigentlichen Start nie blockieren: fehlt das Overlay-Element oder
   ist prefers-reduced-motion gesetzt, ruft play(onDone) sofort
   (bzw. fast sofort) auf, statt die Sequenz zu erzwingen.

   Orbit-Icons kommen bewusst live aus window.BOS_APPS statt fest
   verdrahtet zu sein — eine Mechanik, eine Quelle, kein Duplikat
   der Registry.
   ================================================================ */
(function () {
  'use strict';

  /* ---------- Style injizieren ---------- */
  var SKIP_CSS =
    '.bosboot__skip {' +
    '  position: absolute; left: 0; right: 0; bottom: 28px; text-align: center;' +
    '  font-family: var(--bos-font-label, Barlow Condensed, sans-serif);' +
    '  font-size: 12px; letter-spacing: .14em; text-transform: uppercase;' +
    '  color: var(--bos-text-faint, #736656); opacity: 0;' +
    '  transition: opacity .8s ease; pointer-events: none; z-index: 3;' +
    '}' +
    '.bosboot__skip--an { opacity: 1; }';

  var style = document.createElement('style');
  style.textContent =
    '.bosboot {' +
    '  position: fixed; inset: 0; z-index: 1950; background: var(--bos-bg);' +
    '  display: flex; align-items: center; justify-content: center; overflow: hidden;' +
    '  opacity: 1; transition: opacity 700ms var(--bos-ease);' +
    '}' +
    '.bosboot--done { opacity: 0; pointer-events: none; }' +
    '.bosboot__layer { position: absolute; inset: 0; }' +
    '.bosboot__space {' +
    '  background: radial-gradient(ellipse at 50% 40%, #241d29, #05060a 72%);' +
    '  opacity: 1; transition: opacity 1.6s ease;' +
    '}' +
    '.bosboot--bakery .bosboot__space { opacity: 0; }' +
    '.bosboot__star { position: absolute; background: #fff; border-radius: 50%; animation: bosboot-twinkle 3s ease-in-out infinite; }' +
    '@keyframes bosboot-twinkle { 0%, 100% { opacity: .15; } 50% { opacity: .9; } }' +
    '.bosboot__bakery {' +
    '  opacity: 0; transition: opacity 2s ease; background: var(--bos-bg);' +
    '  background-image: radial-gradient(ellipse 80% 65% at 50% 68%, var(--bos-amber-glow-soft), transparent 70%);' +
    '}' +
    '.bosboot--bakery .bosboot__bakery { opacity: 1; }' +
    '.bosboot__ember {' +
    '  position: absolute; bottom: -10px; width: 4px; height: 4px; border-radius: 50%;' +
    '  background: var(--bos-amber-bright); opacity: 0; animation: bosboot-rise linear infinite;' +
    '}' +
    '.bosboot--bakery .bosboot__ember { opacity: .85; }' +
    '@keyframes bosboot-rise {' +
    '  0% { transform: translateY(0) translateX(0); opacity: 0; }' +
    '  12% { opacity: .9; }' +
    '  100% { transform: translateY(-160px) translateX(var(--drift)); opacity: 0; }' +
    '}' +
    '.bosboot__orbit { position: absolute; top: 50%; left: 50%; width: 1px; height: 1px; opacity: 0; transition: opacity 1s ease; }' +
    '.bosboot--orbit .bosboot__orbit { opacity: 1; }' +
    '.bosboot--bakery .bosboot__orbit { opacity: 0; }' +
    '.bosboot__nodewrap { position: absolute; top: 0; left: 0; width: 0; height: 0; perspective: 250px; }' +
    '.bosboot__node {' +
    '  position: absolute; top: 0; left: 0; margin: -18px; width: 36px; height: 36px; border-radius: 50%;' +
    '  background: var(--bos-amber-glow-soft); border: 1px solid var(--bos-amber-glow);' +
    '  display: flex; align-items: center; justify-content: center; font-size: 1.15rem;' +
    '  backface-visibility: hidden;' +
    '}' +
    '.bosboot__node--flip { transform: rotateX(90deg); opacity: 0; transition: transform .5s ease-in, opacity .45s ease-in; }' +
    '.bosboot__wordmark {' +
    '  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);' +
    '  display: flex; flex-direction: column; align-items: center; gap: .5rem;' +
    '  transition: transform 1.4s ease, filter 1.6s ease;' +
    '}' +
    '.bosboot--bakery .bosboot__wordmark { transform: translate(-50%, -50%) scale(1.07); filter: drop-shadow(0 0 20px var(--bos-amber-glow)); }' +
    '.bosboot__title { display: flex; gap: 1px; font-size: clamp(2.6rem, 6vw, 4rem); }' +
    '.bosboot__title .bosboot__letter--lead { font-family: var(--bos-font-display); font-weight: 900; letter-spacing: -0.01em; color: var(--bos-text); }' +
    '.bosboot__title .bosboot__letter--accent { font-family: var(--bos-font-display); font-style: italic; font-weight: 700; color: var(--bos-amber-bright); }' +
    '.bosboot__letter {' +
    '  display: inline-block; opacity: 0;' +
    '  transform: translate(var(--sx, 0px), var(--sy, 0px)) rotate(var(--sr, 0deg));' +
    '  transition: transform 1.1s cubic-bezier(.2,.8,.2,1), opacity .7s ease;' +
    '  transition-delay: calc(var(--i) * 45ms);' +
    '}' +
    '.bosboot--title .bosboot__letter { opacity: 1; transform: translate(0,0) rotate(0deg); }' +
    '.bosboot__slot { position: relative; height: 30px; width: 260px; margin: 0 auto; perspective: 500px; }' +
    '.bosboot__subtitle {' +
    '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;' +
    '  font-family: var(--bos-font-label); font-weight: 800; font-size: 1.1rem;' +
    '  text-transform: uppercase; letter-spacing: .14em; color: var(--bos-amber);' +
    '  opacity: 0; transform: rotateX(-90deg);' +
    '  transition: transform .55s ease-out, opacity .5s ease-out; transition-delay: .22s;' +
    '  backface-visibility: hidden;' +
    '}' +
    '.bosboot--flip .bosboot__subtitle { opacity: 1; transform: rotateX(0deg); }' +
    '.bosboot__loader { position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%); width: min(64%, 260px); text-align: center; opacity: 0; transition: opacity .8s ease; }' +
    '.bosboot--ready .bosboot__loader { opacity: 1; }' +
    '.bosboot__bar { height: 2px; background: var(--bos-border-strong); border-radius: 2px; overflow: hidden; margin-bottom: .5rem; }' +
    '.bosboot__barfill { height: 100%; width: 0; background: var(--bos-amber); transition: width 1.8s ease; }' +
    '.bosboot--ready .bosboot__barfill { width: 100%; }' +
    '.bosboot__status { font-family: var(--bos-font-label); font-size: .68rem; letter-spacing: .04em; color: var(--bos-text-dim); text-transform: uppercase; }' + SKIP_CSS;
  document.head.appendChild(style);

  /* ---------- Markup injizieren ---------- */
  var root = document.createElement('div');
  root.className = 'bosboot';
  root.id = 'bosBoot';
  root.innerHTML =
    '<div class="bosboot__layer bosboot__space" id="bosBootSpace"></div>' +
    '<div class="bosboot__layer bosboot__bakery"></div>' +
    '<div class="bosboot__layer" id="bosBootEmbers"></div>' +
    '<div class="bosboot__orbit" id="bosBootOrbit"></div>' +
    '<div class="bosboot__wordmark">' +
    '  <div class="bosboot__title" id="bosBootTitle"></div>' +
    '  <div class="bosboot__slot" id="bosBootSlot">' +
    '    <div class="bosboot__subtitle" id="bosBootSubtitle" data-i18n="launcher.subtitle"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="bosboot__loader">' +
    '  <div class="bosboot__bar"><div class="bosboot__barfill"></div></div>' +
    '  <div class="bosboot__status" data-i18n="boot.status"></div>' +
    '</div>';
  document.body.appendChild(root);

  /* ---------- Logik (unverändert aus launcher.html übernommen) ---------- */
  function bosBootPickIcons(n) {
    var apps = (window.BOS_APPS || []).filter(function (a) {
      return a.status === 'live' && a.type !== 'hub' && a.type !== 'system' && a.icon;
    });
    if (!apps.length) return ['🥐', '🍞', '🧁', '🥯', '🥖'];
    var out = [];
    for (var i = 0; i < n; i++) out.push(apps[Math.floor(i * apps.length / n)].icon);
    return out;
  }

  function bosBootPlaySequence(onDone) {
    var root = document.getElementById('bosBoot');
    if (!root) { onDone(); return; }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.remove();
      onDone();
      return;
    }

    var spaceEl = document.getElementById('bosBootSpace');
    var embersEl = document.getElementById('bosBootEmbers');
    var orbitEl = document.getElementById('bosBootOrbit');
    var titleEl = document.getElementById('bosBootTitle');
    var slotEl = document.getElementById('bosBootSlot');

    var TITLE = ['B', 'ä', 'c', 'k', 'e', 'r', 'e', 'i', 'O', 'S'];
    var ICONS = bosBootPickIcons(5);
    var timers = [];
    var nodeWraps = [];
    var raf = null;
    var ORBIT_RX = 130, ORBIT_RY = 30, ORBIT_PERIOD = 6400, ECC = 0.65;
    var orbitStart = null;

    function buildLetters() {
      titleEl.innerHTML = '';
      TITLE.forEach(function (ch, i) {
        var span = document.createElement('span');
        span.className = 'bosboot__letter ' + (i < 8 ? 'bosboot__letter--lead' : 'bosboot__letter--accent');
        span.textContent = ch;
        var angle = Math.random() * Math.PI * 2;
        var r = 70 + Math.random() * 70;
        span.style.setProperty('--sx', (Math.cos(angle) * r).toFixed(1) + 'px');
        span.style.setProperty('--sy', (Math.sin(angle) * r * 0.55).toFixed(1) + 'px');
        span.style.setProperty('--sr', (Math.random() * 160 - 80).toFixed(1) + 'deg');
        span.style.setProperty('--i', i);
        titleEl.appendChild(span);
      });
    }
    function buildStars() {
      spaceEl.innerHTML = '';
      for (var i = 0; i < 55; i++) {
        var s = document.createElement('div');
        s.className = 'bosboot__star';
        var size = (Math.random() * 2 + 1).toFixed(1);
        s.style.width = size + 'px'; s.style.height = size + 'px';
        s.style.top = (Math.random() * 100) + '%'; s.style.left = (Math.random() * 100) + '%';
        s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
        spaceEl.appendChild(s);
      }
    }
    function buildEmbers() {
      embersEl.innerHTML = '';
      for (var i = 0; i < 16; i++) {
        var e = document.createElement('div');
        e.className = 'bosboot__ember';
        e.style.left = (Math.random() * 100) + '%';
        e.style.setProperty('--drift', (Math.random() * 30 - 15) + 'px');
        e.style.animationDuration = (3 + Math.random() * 3).toFixed(2) + 's';
        e.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
        embersEl.appendChild(e);
      }
    }
    function buildOrbit() {
      orbitEl.innerHTML = '';
      nodeWraps = [];
      ICONS.forEach(function (icon, i) {
        var wrap = document.createElement('div');
        wrap.className = 'bosboot__nodewrap';
        var node = document.createElement('div');
        node.className = 'bosboot__node';
        node.textContent = icon;
        wrap.appendChild(node);
        orbitEl.appendChild(wrap);
        nodeWraps.push({ el: wrap, offset: (2 * Math.PI * i) / ICONS.length, docked: false });
      });
    }
    function tickOrbit(now) {
      if (orbitStart === null) orbitStart = now;
      var u = ((now - orbitStart) % ORBIT_PERIOD) / ORBIT_PERIOD;
      var warped = u + (ECC / (2 * Math.PI)) * Math.sin(2 * Math.PI * u);
      var theta = warped * 2 * Math.PI;
      nodeWraps.forEach(function (n) {
        if (n.docked) return;
        var a = theta + n.offset;
        var x = ORBIT_RX * Math.cos(a), y = ORBIT_RY * Math.sin(a);
        n.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      raf = requestAnimationFrame(tickOrbit);
    }
    function dockNode(k, tx, ty) {
      var n = nodeWraps[k];
      n.docked = true;
      n.el.style.transition = 'transform 1.15s cubic-bezier(.3,.7,.2,1)';
      n.el.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)';
    }
    function beginDocking() {
      var slotRect = slotEl.getBoundingClientRect();
      var slotCX = slotRect.left + slotRect.width / 2, slotCY = slotRect.top + slotRect.height / 2;
      var orbitRect = orbitEl.getBoundingClientRect();
      var orbitCX = orbitRect.left + orbitRect.width / 2, orbitCY = orbitRect.top + orbitRect.height / 2;
      var offsets = [-88, -44, 0, 44, 88];
      for (var k = 0; k < ICONS.length; k++) {
        (function (k) {
          var tx = (slotCX + offsets[k]) - orbitCX, ty = slotCY - orbitCY;
          timers.push(setTimeout(function () { dockNode(k, tx, ty); }, k * 160));
        })(k);
      }
    }
    function flipToSatellite() {
      nodeWraps.forEach(function (n) { n.el.querySelector('.bosboot__node').classList.add('bosboot__node--flip'); });
      root.classList.add('bosboot--flip');
    }
    /* Überspringen — NEU 19.09.2026. Die volle Sequenz läuft 12,6 s; das
       ist beim ersten Start am Abend schön und beim fünften Neuladen
       während der Arbeit im Weg. Ein Tippen irgendwo bricht ab.
       fertig verhindert, dass onDone() zweimal läuft — sonst startet
       der Launcher doppelt, wenn kurz vor Ende getippt wird. */
    var fertig = false;

    function abbrechen() {
      if (fertig) return;
      fertig = true;
      timers.forEach(function (id) { clearTimeout(id); });
      if (raf) cancelAnimationFrame(raf);
      root.remove();
      onDone();
    }

    function finish() {
      if (fertig) return;
      fertig = true;
      onDone();
      root.classList.add('bosboot--done');
      setTimeout(function () {
        if (raf) cancelAnimationFrame(raf);
        root.remove();
      }, 750);
    }

    buildStars();
    buildLetters();
    buildOrbit();
    buildEmbers();
    raf = requestAnimationFrame(tickOrbit);

    root.style.cursor = 'pointer';
    root.addEventListener('pointerdown', abbrechen);

    var skipEl = document.createElement('div');
    skipEl.className = 'bosboot__skip';
    skipEl.textContent = 'Tippen zum Überspringen';
    root.appendChild(skipEl);
    timers.push(setTimeout(function () { skipEl.classList.add('bosboot__skip--an'); }, 1500));

    timers.push(setTimeout(function () { root.classList.add('bosboot--title'); }, 700));
    timers.push(setTimeout(function () {
      var tr = titleEl.getBoundingClientRect();
      ORBIT_RX = tr.width / 2 + 54; ORBIT_RY = tr.height / 2 + 24;
      root.classList.add('bosboot--orbit');
    }, 2500));
    timers.push(setTimeout(beginDocking, 6200));
    timers.push(setTimeout(function () { flipToSatellite(); root.classList.add('bosboot--bakery'); }, 8750));
    timers.push(setTimeout(function () { root.classList.add('bosboot--ready'); }, 10900));
    timers.push(setTimeout(finish, 12600));
  }

  /* ---------- Öffentliche Schnittstelle ---------- */
  window.BOS_BOOT = { play: bosBootPlaySequence };
})();
