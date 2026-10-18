/* ================================================================
   BäckereiOS · Türsteher Crumble an der Tür (index.html) — #62 Stufe 1e
   ================================================================
   Neu 18.10.2026 (Bau-Chat Crumble; Anweisung Kontroll-Chat 09:49,
   Bauplan 10:06, Go 10:22). Crumble steht neben dem Anmeldeformular,
   sagt beim Öffnen einen Satz, gibt danach ein paar Tipps und reagiert
   auf die echten Meldungen der Tür — NEBEN der Meldung, nie statt ihr.

   GRUNDSATZ (K60, B3): Die Tür ist der einzige Weg ins System. Nichts
   hier darf die Anmeldung aufhalten oder stören:
     - index.html lädt diese Datei erst nach 'load' und im Leerlauf
       (requestIdleCallback), als async-Skript, ohne await irgendwo;
     - fehlt diese Datei, hamster_figur/, das Manifest oder wirft das
       Modul: Crumble bleibt weg, EIN console.warn, sonst nichts
       (F1, Ulf 10:2x: an der Tür keine sichtbare Fehlermeldung für
       einen fehlenden Türsteher — er ist Schmuck);
     - index.html spricht ihn nur über crumbleFall(schlüssel) an, ein
       eingepackter Aufruf, der ohne Crumble nichts tut.

   EIN/AUS (K61): localStorage['bos_crumble_tuer'] ('an'/'aus'), geschrieben
   vom Launcher (bos_crumble_host.js) bei jedem start()/setzeAn(). Fehlt
   er oder wirft der Speicher → an. Das prüft schon der Lader in index.html.

   PLATZ (K62, Bauplan §1.3): (A) rechter Streifen neben der Formularspalte
   ≥ 220 px → Bühne = Streifen, Figur mittig unten; sonst (B) freier Raum
   unter dem untersten geschützten Element → Figur rechts; Figurhöhe
   zwischen tuer.min_hoehe_px (60) und max_hoehe_px (150), sonst WEG.
   Blase über dem Kopf, höchstens Bühnenbreite − 8 px breit. Neu gerechnet
   bei resize, visualViewport-resize (Tastatur) und wenn die Formularspalte
   wächst (Meldung erscheint) — passt er nicht mehr, geht er (und ist dann
   auch nicht antippbar).

   VERHALTEN (K63): ~1 s nach dem Erscheinen ein Satz aus tuer.oeffnen
   (wird gerade durchgewunken: „Rein mit dir. Gute Schicht!“). Danach
   Tipps aus tuer.tipps, zufällig, ohne Wiederholung, alle 20–30 s,
   höchstens 4, dann still. Eingabe ins Formular → Blase sofort weg,
   20 s keine Tipps. Als Eingabe zählt nur, was ein MENSCH tut (B1):
   input, Zeiger/Touch auf ein Feld, Fokus binnen 500 ms nach Tab (K74) —
   NICHT der Autofokus beim Laden und nicht der Fokus, den die Tür nach einem
   Fehler selbst ins Passwort setzt (index.html).
   Tipp auf Crumble → nächster Tipp (zählt in die 4); danach freut er sich
   nur noch. Keine Nummern, kein Laufen, kein Schieben, kein Long-Press.

   REAKTIONEN (K64): fall(schlüssel) aus index.html — falsch (1. Mal) /
   falsch2 (ab dem 2. Mal je Besuch), format, zu_viele, netz, freischalten,
   angemeldet, durchwinken (= angemeldet), gesperrt (schweigt). Texte und
   Posen: Manifest-Block tuer. Kommt ein Fall, bevor er geladen ist, holt
   er ihn nach, wenn er binnen 4 s bereit ist.

   CHANGELOG
     2026-10-18 · 13:07 · Nacharbeit 1e (Kontroll-Chat 12:53): K74 — als Fokus von Menschenhand zählt nur Tab;
       Enter im Kennungsfeld wischte die Reaktion weg (Tür setzt danach selbst passwortFeld.focus()).
     2026-10-18 · 11:43 · Erstfassung (Stufe 1e, K60–K66).
   ================================================================ */
(function () {
  'use strict';
  if (window.BOS_TUER_CRUMBLE) return;

  var BASIS = 'hamster_figur/';
  var GESCHUETZT = ['.marke', '#kennung', '#passwort', '#anmeldenBtn', '#mobilBtn', '#meldung', '.einblick', '.wechsel', '#band'];
  var STREIFEN_MIN = 220, RAND = 12, LUFT = 26, BLASE_H = 80;   // BLASE_H: Reserve über dem Kopf wie im Bauplan-Prototyp (längster Tür-Text 82 px bei 260 px Breite)

  var figur = null, buehne = null, tuer = null, manifest = null;
  var bereit = false, kaputt = false, weg = true;
  var modus = null, hoehe = 0;
  var tipps = [], gezeigt = 0, tTipp = null, tErster = null;
  var stilleBis = 0, letzteTaste = 0;
  var falschZaehler = 0, wartenderFall = null;

  function warne(was, fehler) {
    if (kaputt) return;
    kaputt = true;
    console.warn('[tuer-crumble] ' + was + ' — die Tür läuft ohne Crumble.', fehler || '');
    try { if (buehne && buehne.parentNode) buehne.parentNode.removeChild(buehne); } catch (e) {}
    try { if (figur) figur.zerstoere(); } catch (e) {}
    figur = null;
  }
  function zufallZahl(a, b) { return a + Math.random() * (b - a); }

  /* ---------- Laden: CSS und Modul (beides selbst, ohne index.html zu berühren) ---------- */
  function ladeCss() {
    if (document.querySelector('link[data-tuer-crumble]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = BASIS + 'hamster_figur.css'; l.setAttribute('data-tuer-crumble', '1');
    document.head.appendChild(l);
  }
  function ladeModul() {
    return new Promise(function (ok, nein) {
      if (window.BOS_HAMSTER_FIGUR) return ok();
      var s = document.createElement('script');
      s.src = BASIS + 'hamster_figur.js'; s.async = true;
      s.onload = function () { window.BOS_HAMSTER_FIGUR ? ok() : nein(new Error('hamster_figur.js geladen, aber BOS_HAMSTER_FIGUR fehlt')); };
      s.onerror = function () { nein(new Error('hamster_figur.js nicht ladbar')); };
      document.head.appendChild(s);
    });
  }

  /* ---------- Platz (K62) ---------- */
  function rechteck(el) { var r = el.getBoundingClientRect(); return (r.width > 0 && r.height > 0) ? r : null; }
  function platz() {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (window.visualViewport) { vw = Math.min(vw, window.visualViewport.width); vh = Math.min(vh, window.visualViewport.height); }
    var mitte = document.querySelector('.mitte');
    var spalte = mitte ? mitte.getBoundingClientRect() : { left: vw / 2 - 190, right: vw / 2 + 190 };
    var unten = 0;
    GESCHUETZT.forEach(function (s) {
      var e = document.querySelector(s); if (!e || e.hidden) return;
      var r = rechteck(e); if (r) unten = Math.max(unten, r.bottom);
    });
    var minH = (tuer && tuer.min_hoehe_px) || 60, maxH = (tuer && tuer.max_hoehe_px) || 150;
    var streifen = vw - spalte.right - RAND - 8;
    if (streifen >= STREIFEN_MIN) {
      var h = Math.max(minH, Math.min(maxH, Math.round(vh * 0.22)));
      if (h + LUFT + BLASE_H + 16 <= vh) return { modus: 'streifen', h: h, x: 0.5, r: { left: spalte.right + RAND, top: 0, width: streifen, height: vh - 8 } };
    }
    var frei = vh - unten - RAND - 8;
    var hb = Math.min(maxH, Math.floor(frei - LUFT - BLASE_H));
    if (hb >= minH) return { modus: 'unten', h: hb, x: 0.9, r: { left: 8, top: unten + RAND, width: vw - 16, height: frei } };
    return { modus: null };
  }
  function legeBuehne(p) {
    buehne.style.left = Math.round(p.r.left) + 'px'; buehne.style.top = Math.round(p.r.top) + 'px';
    buehne.style.width = Math.round(p.r.width) + 'px'; buehne.style.height = Math.round(p.r.height) + 'px';
    buehne.style.setProperty('--tuer-blase-max', Math.max(120, Math.min(260, Math.round(p.r.width) - 8)) + 'px');
  }
  function neuLegen() {
    if (kaputt || !buehne) return;
    try {
      var p = platz();
      if (!p.modus) {
        modus = null;
        if (!weg) { weg = true; buehne.classList.add('bos-tuer-buehne--weg'); if (figur && bereit) figur.sage(''); }
        return;
      }
      legeBuehne(p);
      var neu = !figur;
      modus = p.modus;
      if (neu) { hoehe = p.h; legeFigurAn(p); }
      else if (bereit) {
        if (p.h !== hoehe) { hoehe = p.h; figur.setzeGroesse(p.h); }
        figur.setzeX(p.x, true);
        pruefeTrefflaeche();
      }
      if (weg) { weg = false; buehne.classList.remove('bos-tuer-buehne--weg'); }
    } catch (e) { warne('Platz konnte nicht gerechnet werden', e); }
  }

  /* ---------- Figur ---------- */
  function legeFigurAn(p) {
    try { figur = baueFigur(p); } catch (e) { figur = null; warne('Figur nicht anlegbar', e); return; }   // eigener Text: die Konsole soll sagen, was los ist
    figur.auf('fehler', function (d) { if (d && d.manifest) warne('Manifest nicht ladbar', d.message); });
    warteAufFigur(p);
  }
  function baueFigur(p) {
    return window.BOS_HAMSTER_FIGUR.neu({
      name: 'tuer', container: buehne, basisPfad: BASIS, einbettung: 'container', rolle: 'lehrmeister',
      modus: 'ecke', hoehe: p.h, laufen: false, nummern: false, schiebbar: false, zufall: false, sichtkontakt: false,
      xStart: p.x, klasse: 'hf--tuer',
      nurZustaende: function (m) { return (m.tuer && m.tuer.zustaende) || null; },   // K65: 15 Bilder statt 30
      beiTipp: beiTipp
    });
  }
  function warteAufFigur(p) {
    figur.bereit.then(function () {
      if (kaputt) return;
      manifest = figur.manifest();
      if (!manifest) return warne('Manifest leer');
      tuer = manifest.tuer || null;
      if (!tuer) return warne('Manifest ohne Block tuer');
      tipps = (tuer.tipps || []).slice();
      bereit = true;
      figur.setzeX(p.x, true);
      pruefeTrefflaeche();
      neuLegen();
      tErster = setTimeout(ersterSatz, tuer.erster_satz_ms || 1000);
    }).catch(function (e) { warne('Figur nicht ladbar', e); });
  }
  /* Z3: Körperkasten unter 40 px breit → Tipp auf Crumble aus (zu klein, um ihn sicher zu treffen) */
  function pruefeTrefflaeche() {
    var w = figur && figur.wurzel && figur.wurzel(); if (!w) return;
    var k = w.querySelector('.hf__figur'); if (!k) return;
    w.classList.toggle('hf--ohne-tipp', k.getBoundingClientRect().width < 40);
  }
  function lesedauer(text) { return Math.max(4000, Math.min(7500, (text || '').length * 70)); }
  function sprich(pose, text) {
    if (!figur || !bereit || kaputt || weg) return false;
    var d = lesedauer(text);
    figur.zeige(pose || 'idle', { text: text || '', dauer: d + 1000, dauerText: d });
    return true;
  }

  /* ---------- Sätze und Tipps (K63) ---------- */
  function ersterSatz() {
    tErster = null;
    if (wartenderFall && Date.now() - wartenderFall.t < 4000) { var f = wartenderFall; wartenderFall = null; fall(f.k); planeTipp(); return; }
    var z = window.BOS_TUER_ZUSTAND || {};
    if (z.durchwinken) { reagiere('angemeldet'); return; }   // die Weiterleitung wartet nicht auf ihn — ist er zu spät, sieht man es eben nicht
    var liste = tuer.oeffnen || [];
    if (liste.length && Date.now() >= stilleBis) { var s = liste[Math.floor(Math.random() * liste.length)]; sprich('wave', s.text); }
    planeTipp();
  }
  function planeTipp() {
    clearTimeout(tTipp); tTipp = null;
    if (gezeigt >= ((tuer && tuer.tipps_max) || 4) || !tipps.length) return;
    var ab = (tuer.tipp_abstand_s || [20, 30]);
    var ms = zufallZahl(ab[0], ab[1]) * 1000;
    if (stilleBis > Date.now() + ms) ms = stilleBis - Date.now() + zufallZahl(1000, 3000);
    tTipp = setTimeout(function () {
      tTipp = null;
      if (Date.now() < stilleBis) return planeTipp();
      if (weg) return planeTipp();
      zeigeTipp();
      planeTipp();
    }, ms);
  }
  function zeigeTipp() {
    if (gezeigt >= ((tuer && tuer.tipps_max) || 4) || !tipps.length) return false;
    var i = Math.floor(Math.random() * tipps.length), t = tipps.splice(i, 1)[0];   // ohne Wiederholung im Besuch
    gezeigt++;
    sprich(t.pose || 'raise_hand', t.text);
    return true;
  }
  /* Tipp auf Crumble (Modul-Option beiTipp): nächster Tipp, zählt mit; danach freut er sich nur noch */
  function beiTipp(info) {
    if (!bereit || kaputt) return true;
    var weiter = function () { if (kaputt || !figur) return; if (!zeigeTipp()) figur.zeige('happy', { text: '' }); planeTipp(); };
    if (info && info.schlief) {   // Bauplan §1.4: Tipp weckt (surprised), dann zählt er als Tipp
      figur.zeige('surprised', { text: '' });
      setTimeout(weiter, (manifest && manifest.verhalten && manifest.verhalten.aufwach_ms) || 1000);
      return true;
    }
    weiter();
    return true;
  }

  /* ---------- Eingabe-Stille (K63, B1) ---------- */
  function stille() {
    stilleBis = Date.now() + (((tuer && tuer.eingabe_stille_s) || 20) * 1000);
    if (figur && bereit) figur.sage('');
  }
  function verdrahteEingabe() {
    // K74 (Nacharbeit 1e): nur Tab (auch Umschalt+Tab) zählt als Fokus von Menschenhand — Zeichen kommen ohnehin als input.
    // Vorher zählte jede Taste: Enter im Kennungsfeld → Tür setzt nach dem Fehler selbst passwortFeld.focus() → Stille wischte die Reaktion weg.
    document.addEventListener('keydown', function (e) { if (e && e.key === 'Tab') letzteTaste = Date.now(); }, true);
    ['kennung', 'passwort'].forEach(function (id) {
      var f = document.getElementById(id); if (!f) return;
      f.addEventListener('input', stille);
      f.addEventListener('pointerdown', stille);   // auch aufs schon fokussierte Feld (Autofokus): kein focus-Ereignis, aber ein Mensch
      f.addEventListener('touchstart', stille, { passive: true });
      f.addEventListener('focus', function () { if (Date.now() - letzteTaste < 500) stille(); });   // Tab ins Feld — Autofokus und Fokus durch die Tür selbst zählen nicht
    });
  }

  /* ---------- Reaktionen auf echte Meldungen (K64) ---------- */
  function reagiere(k) {
    var r = tuer && tuer.reaktionen && tuer.reaktionen[k];
    if (!r) return;
    if (!r.text) { if (figur && bereit) { figur.zeige('idle', { still: true }); figur.sage(''); } return; }   // gesperrt: schweigt
    sprich(r.pose, r.text);
  }
  function fall(k) {
    if (!k || kaputt) return;
    if (k === 'falsch') { falschZaehler++; if (falschZaehler > 1) k = 'falsch2'; }
    if (k === 'durchwinken') k = 'angemeldet';
    if (!bereit) { wartenderFall = { k: k, t: Date.now() }; return; }
    reagiere(k);
  }

  /* ---------- Start ---------- */
  window.BOS_TUER_CRUMBLE = {
    fall: function (k) { try { fall(k); } catch (e) { warne('Reaktion fehlgeschlagen', e); } },
    /* nur für Prüfwerkzeuge */
    _zustand: function () {
      return { bereit: bereit, kaputt: kaputt, weg: weg, modus: modus, hoehe: hoehe, gezeigt: gezeigt, rest: tipps.map(function (t) { return t.id; }),
               stilleBis: stilleBis, falsch: falschZaehler, figur: figur };
    },
    _tippJetzt: function () { if (bereit && Date.now() >= stilleBis) { zeigeTipp(); planeTipp(); } }
  };
  try {
    ladeCss();
    buehne = document.createElement('div');
    buehne.className = 'bos-tuer-buehne bos-tuer-buehne--weg';
    buehne.setAttribute('aria-hidden', 'true');
    document.body.appendChild(buehne);
    verdrahteEingabe();
    ladeModul().then(function () {
      if (kaputt) return;
      neuLegen();
      window.addEventListener('resize', neuLegen);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', neuLegen);
      var mitte = document.querySelector('.mitte');
      if (mitte && window.ResizeObserver) new ResizeObserver(function () { neuLegen(); }).observe(mitte);
    }).catch(function (e) { warne('Modul nicht ladbar', e); });
  } catch (e) { warne('Start fehlgeschlagen', e); }
})();
