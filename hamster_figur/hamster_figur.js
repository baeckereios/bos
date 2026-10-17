/**
 * hamster_figur.js — Crumble, die Hamster-Figur von BäckereiOS (Maskottchen, Baustelle #62)
 * ------------------------------------------------------------------------------
 * NICHT zu verwechseln mit bos_hamster.js (Hamstertage-Rechnung). Diese Datei
 * zeigt nur eine Figur an und kennt weder Firestore noch Konten.
 *
 * Was sie tut:
 *   - lädt hamster_figur_manifest.json (Zustände, Bilder, Ereignisse, Texte,
 *     Ausrüstungs-Slots) einmal je basisPfad und die PNGs aus bilder/
 *   - ist eine FABRIK (seit 17.10.2026, Stufe 1): BOS_HAMSTER_FIGUR.neu(optionen)
 *     liefert eine eigene Figur mit eigenem DOM, eigenen Timern, eigener Rolle.
 *     Mehrere Figuren auf einer Seite sind erlaubt (Knopf-Crumble in der
 *     Kopfleiste UND Spielplatz-Crumble im Bildschirmschoner).
 *     BOS_HAMSTER_FIGUR.init(optionen) bleibt als Kurzform: legt die
 *     Standard-Figur an, die restlichen Funktionen am Modul reichen an sie durch.
 *   - zwei ROLLEN (Manifest, kein Code-Wissen über Sätze):
 *       'lehrmeister' (Vorgabe) spricht zustaende.*.texte — über die Lage, nie an den Nutzer
 *       'spielplatz'  spricht zustaende.*.texte_spielplatz (fehlt es: texte) — darf albern sein
 *   - drei EINBETTUNGEN:
 *       'fest'      fixed unten rechts (Prüfseite, Satelliten) — wie bisher
 *       'oben'      im übergebenen Container (Kopfleiste): Knopf inline, Bühne hängt darunter
 *       'container' absolut im Container (Bildschirmschoner), kein eigener Layer
 *   - Modus 'ecke' (Figur dauerhaft da) oder 'knopf' (Ruf-Knopf; die Figur kommt
 *     nur auf Tipp, Ereignis oder zum stündlichen Reinschauen hervor und geht wieder)
 *   - lebt im Grundzustand: Blinzeln, Blick, Atmen, nach Pause Schlaf
 *   - reagiert auf benannte Ereignisse (ereignis('viel_offen')), auf Antippen und
 *     zeigt Hinweise (Kategorie 'hinweis'), die stehen bleiben, bis jemand tippt
 *   - trägt Ausrüstung (Overlays an benannten Slots) — Vorbereitung für
 *     "individuell gestalten" (Ulf, 13.10.2026)
 *
 * Erweitern ohne Codeänderung: neue Zustände, Ereignisse, Texte und Gegenstände
 * kommen ins Manifest (siehe HAMSTER_FIGUR_DOKU.md §4). Zur Laufzeit zusätzlich
 * über registriere.* je Figur.
 *
 * Abhängigkeiten: keine. Nutzt die BOS-Design-Tokens, wenn vorhanden, sonst
 * eigene Fallback-Farben (hamster_figur.css).
 *
 * CHANGELOG
 *   2026-10-17 · 08:09 · Nachtrag 1 (Prüfbefund Kontroll-Chat 07:55): K21 Rückweg erbt
 *     ohneSchlafReset, Schlaf wird bei laufender Reaktion vorgemerkt und beim Rückweg
 *     nachgeholt (N-A: Spielplatz schlief nie) · K22 tipp() ruft im Knopf-Modus immer
 *     hervorHolen(), Knopf-Click nur noch tipp() (N-B: Tipp während draußen klappte die
 *     Figur mitten im Satz weg).
 *   2026-10-17 · 06:49 · Stufe 1 (Bau-Chat Crumble, Anweisung Kontroll-Chat 06:00,
 *     Bauplan 06:18; Ulf 06:27 „Mach alles in einem Rutsch“):
 *     K1 tipp() versteckt nach quittiertem Hinweis (B1) · K2 registriere.zustand
 *     legt nur das neue Bild an, Figur bleibt an (B2) · K3 ereignis() mit Ziel der
 *     Kategorie hinweis läuft über hinweis() (B3) · K4 init() doppelt → warn, eine
 *     Wurzel (B4) · K5 onerror je Bild → melde('fehler') (B5) · K6 Einbettungen
 *     fest/oben/container, Blase bleibt im Bild (B6) · K7 Fabrik neu(), Manifest
 *     einmal geladen, Kopie je Figur (B7) · K8 Rollen, texte_spielplatz,
 *     texte_mit_zahl{,_1,_0} mit {n}, Ereignisse dürfen Listen sein (zufällig),
 *     beiläufige Ereignisse (o.beilaeufig: Anteil, kein Schlaf-Reset, schläft durch).
 *     Meldungen tragen detail.instanz.
 *   2026-10-17 · ~04:00 · Erstfassung (Figuren-Chat), noch in keiner Seite eingebunden.
 */
window.BOS_HAMSTER_FIGUR = (function () {
  'use strict';

  // ---------------------------------------------------------------- Manifest einmal je Pfad
  var manifestLader = {};
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }
  function ladeManifest(pfad, fertig) {
    if (fertig) return Promise.resolve(kopie(fertig));
    if (!manifestLader[pfad]) {
      manifestLader[pfad] = fetch(pfad + 'hamster_figur_manifest.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('Manifest nicht ladbar: HTTP ' + r.status + ' (' + pfad + 'hamster_figur_manifest.json)');
        return r.json();
      });
      manifestLader[pfad].catch(function () { delete manifestLader[pfad]; }); // nächster Versuch lädt neu
    }
    return manifestLader[pfad].then(kopie);
  }

  function zufall(a, b) { return a + Math.random() * (b - a); }
  function wahl(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  // ================================================================ Eine Figur
  function neu(o) {
    var opt = Object.assign({
      container: document.body, basisPfad: 'hamster_figur/', modus: 'ecke', einbettung: 'fest',
      rolle: 'lehrmeister', hoehe: 150, an: true, hell: false, ausruestung: {}, zufall: true,
      name: 'standard', vor: null, manifest: null, tippZustaende: null
    }, o || {});
    if (!/\/$/.test(opt.basisPfad)) opt.basisPfad += '/';
    if (opt.modus !== 'knopf') opt.modus = 'ecke';
    if (['fest', 'oben', 'container'].indexOf(opt.einbettung) < 0) opt.einbettung = 'fest';
    if (opt.rolle !== 'spielplatz') opt.rolle = 'lehrmeister';

    var manifest = null, el = {}, aktuell = 'idle', ereignisSperre = false;
    var t = { reaktion: null, blase: null, leben: null, schlaf: null, reinschauen: null, zufall: null, tipp: null, hervor: null };
    var tipps = 0, aktiv = opt.an !== false, hervor = false, hinweisOffen = false, zerstoert = false;
    var handler = {}, vorab = [], nachBereit = [];

    function melde(name, daten) {
      daten = Object.assign({ instanz: opt.name }, daten || {});
      (handler[name] || []).forEach(function (fn) { try { fn(daten); } catch (e) { console.error('[hamster_figur] Handler ' + name, e); } });
      try { document.dispatchEvent(new CustomEvent('hamster-figur:' + name, { detail: daten })); } catch (e) {}
    }
    function bildPfad(datei) { return opt.basisPfad + 'bilder/' + datei; }
    function sp() { return (manifest && manifest.spielplatz) || {}; }
    function istSpielplatz() { return opt.rolle === 'spielplatz'; }
    function schlaeft() { return !!(manifest && manifest.zustaende[aktuell] && manifest.zustaende[aktuell].kategorie === 'schlaf'); }

    // ---------------------------------------------------------------- Aufbau DOM
    function baue() {
      var wurzel = document.createElement('div');
      wurzel.className = 'hf hf--' + opt.modus + ' hf--' + opt.einbettung + ' hf--' + opt.rolle + (opt.hell ? ' hf--hell' : '');
      wurzel.dataset.instanz = opt.name;
      wurzel.innerHTML =
        '<div class="hf__knopf" role="button" tabindex="0" title="Crumble" aria-label="Crumble"><img class="hf__knopf-bild" alt=""></div>' +
        '<div class="hf__buehne">' +
          '<div class="hf__blase" aria-live="polite"></div>' +
          '<div class="hf__figur" role="button" aria-label="Crumble antippen">' +
            '<div class="hf__koerper"></div>' +
            '<div class="hf__ausr hf__ausr--hinter"></div>' +
            '<div class="hf__ausr hf__ausr--vor"></div>' +
          '</div>' +
        '</div>';
      el.wurzel = wurzel;
      el.knopf = wurzel.querySelector('.hf__knopf');
      el.knopfBild = wurzel.querySelector('.hf__knopf-bild');
      el.buehne = wurzel.querySelector('.hf__buehne');
      el.blase = wurzel.querySelector('.hf__blase');
      el.figur = wurzel.querySelector('.hf__figur');
      el.koerper = wurzel.querySelector('.hf__koerper');
      el.ausrVor = wurzel.querySelector('.hf__ausr--vor');
      el.ausrHinter = wurzel.querySelector('.hf__ausr--hinter');
      var figW = Math.round(opt.hoehe * 0.95);
      el.figur.style.height = opt.hoehe + 'px';
      el.figur.style.width = figW + 'px';
      // Bühne und Blase aus der Höhe ableiten (vorher feste 240×230 / right 150 / bottom 150 für hoehe 150)
      el.buehne.style.width = figW + 'px';
      el.buehne.style.height = (opt.hoehe + 80) + 'px';
      el.blase.style.right = (figW + 8) + 'px';
      el.blase.style.bottom = opt.hoehe + 'px';

      el.bilder = {};
      Object.keys(manifest.zustaende).forEach(legeBildAn);

      el.knopf.addEventListener('click', function (e) { e.stopPropagation(); tipp(); });   // K22: hervorHolen() macht tipp() selbst — ein Weg
      el.knopf.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.knopf.click(); } });
      el.figur.addEventListener('click', function (e) { e.stopPropagation(); tipp(); });
      el.blase.addEventListener('click', function (e) { e.stopPropagation(); tipp(); });

      if (opt.vor && opt.vor.parentNode === opt.container) opt.container.insertBefore(wurzel, opt.vor);
      else opt.container.appendChild(wurzel);
      el.knopfBild.addEventListener('error', function () { bildFehlt(manifest.zustaende.idle.datei, el.knopfBild.src); });
      el.knopfBild.src = bildPfad(manifest.zustaende.idle.datei);
    }

    function bildFehlt(datei, url) {
      console.warn('[hamster_figur] Bild fehlt: ' + datei + ' (' + url + ')');
      melde('fehler', { datei: datei, url: url });
    }

    /** Ein Zustandsbild anlegen (Crossfade statt Nachladen). Auch für registriere.zustand nach init (K2). */
    function legeBildAn(name) {
      var z = manifest.zustaende[name];
      if (el.bilder[name]) { el.bilder[name].remove(); }
      var img = document.createElement('img');
      img.className = 'hf__bild'; img.alt = ''; img.draggable = false;
      img.dataset.zustand = name;
      // Skalierung über den Körperkasten: Körperhöhe = opt.hoehe * massstab, Ankerpunkt unten mitte
      var k = z.koerper, kh = k[3] - k[1], kw = k[2] - k[0];
      var hoehe = opt.hoehe * (z.massstab || 1) / kh;        // Bildhöhe in px
      img.style.height = hoehe + 'px';
      img.style.bottom = (-(1 - k[3]) * hoehe) + 'px';           // Körperunterkante auf 0
      img.style.left = '50%';
      img.addEventListener('load', function () {   // Breite erst nach dem Laden bekannt
        var w = (img.naturalWidth / img.naturalHeight) * hoehe;
        img.style.marginLeft = (-(k[0] + kw / 2) * w) + 'px';
        img.dataset.breite = w;
        if (name === aktuell) aktualisiereAusruestung(name);
      });
      img.addEventListener('error', function () { bildFehlt(z.datei, img.src); });
      img.src = bildPfad(z.datei);
      el.koerper.appendChild(img);
      el.bilder[name] = img;
    }

    // ---------------------------------------------------------------- Zustände
    function zeigeBild(name, schnell) {
      Object.keys(el.bilder).forEach(function (n) {
        var img = el.bilder[n];
        img.classList.toggle('hf__bild--schnell', !!schnell);
        img.classList.toggle('hf__bild--an', n === name);
      });
      aktualisiereAusruestung(name);
    }

    function animiere(klasse) {
      el.figur.classList.remove('hf--squish', 'hf--nicken', 'hf--wippen');
      void el.figur.offsetWidth;
      el.figur.classList.add(klasse);
    }

    /** Blase darf nie aus dem Bildschirm laufen (K6): nach dem Zeigen messen und zurückschieben. */
    function klemmeBlase() {
      el.blase.style.transform = '';
      if (!el.blase.classList.contains('hf__blase--an')) return;
      var r = el.blase.getBoundingClientRect(), rand = 8, breite = window.innerWidth || document.documentElement.clientWidth;
      var schub = 0;
      if (r.left < rand) schub = rand - r.left;
      else if (r.right > breite - rand) schub = (breite - rand) - r.right;
      if (schub) el.blase.style.transform = 'translateX(' + Math.round(schub) + 'px)';
    }

    function sage(text, dauerMs) {
      clearTimeout(t.blase);
      if (!text) { el.blase.classList.remove('hf__blase--an'); el.blase.style.transform = ''; return; }
      el.blase.textContent = text;
      el.blase.classList.add('hf__blase--an');
      klemmeBlase();
      if (dauerMs > 0) t.blase = setTimeout(function () { el.blase.classList.remove('hf__blase--an'); }, dauerMs);
    }

    /** Textliste des Zustands für die Rolle (K8). */
    function texteFuer(z) {
      if (istSpielplatz() && z.texte_spielplatz && z.texte_spielplatz.length) return z.texte_spielplatz;
      return z.texte || [];
    }
    /** Text mit Zahl: texte_mit_zahl_<n> (z. B. _0, _1), sonst texte_mit_zahl mit {n}. */
    function textMitZahl(z, n) {
      var liste = z['texte_mit_zahl_' + n] || z.texte_mit_zahl;
      if (!liste || !liste.length) return undefined;
      return wahl(liste).replace(/\{n\}/g, String(n));
    }

    /** Zustand zeigen. o = { text, n, dauer (ms, 0 = bleibt), still, ohneRueckweg, ohneSchlafReset } */
    function zeige(name, o) {
      o = o || {};
      if (!manifest) return;
      if (!manifest.zustaende[name]) { console.warn('[hamster_figur] unbekannter Zustand: ' + name); return; }
      clearTimeout(t.reaktion);
      var z = manifest.zustaende[name];
      aktuell = name;
      zeigeBild(name);
      animiere(z.kategorie === 'hinweis' ? 'hf--wippen' : 'hf--squish');
      var text = o.text;
      if (text === undefined && typeof o.n === 'number') text = textMitZahl(z, o.n);
      if (text === undefined) { var liste = texteFuer(z); text = liste.length ? wahl(liste) : ''; }
      if (!o.still) sage(text, o.dauer === 0 ? 0 : (o.dauerText || manifest.verhalten.reaktion_ms - 1500));
      var zurueck = o.dauer !== undefined ? o.dauer : (z.kategorie === 'hinweis' ? manifest.verhalten.hinweis_ms : manifest.verhalten.reaktion_ms);
      if (zurueck > 0 && !o.ohneRueckweg && name !== 'idle' && z.kategorie !== 'schlaf') {
        // K21 (Nachtrag 1, N-A): der Rückweg erbt ohneSchlafReset — sonst stellte jede beiläufige Reaktion den Schlaf über ihren Rückweg doch neu
        t.reaktion = setTimeout(function () {
          zeige('idle', { still: true, ohneSchlafReset: !!o.ohneSchlafReset });
          if (schlafFaellig) schlafen();                     // Schlaf war während der Reaktion fällig geworden
          if (opt.modus === 'knopf') verstecken();
        }, zurueck);
      }
      if (z.kategorie !== 'schlaf' && !o.ohneSchlafReset) armSchlaf();
      melde('zustand', { zustand: name });
    }

    /** Ziel eines Ereignisses: String oder Liste (zufällig). */
    function zielVon(name) {
      var ziel = manifest.ereignisse[name];
      if (Array.isArray(ziel)) ziel = ziel.length ? wahl(ziel) : null;
      return ziel || null;
    }

    /**
     * Ereignis auslösen. o = { text, n, beilaeufig, … wie zeige }
     * beilaeufig (Schoner-Inhalt): darf mit Anteil spielplatz.reaktions_anteil ausgelassen
     * werden, stellt den Schlaf nicht zurück, und eine schlafende Figur schläft durch.
     */
    function ereignis(name, o) {
      if (!manifest) { nachBereit.push(function () { ereignis(name, o); }); return; }
      if (!aktiv || ereignisSperre) return;
      var zustand = zielVon(name);
      if (!zustand || !manifest.zustaende[zustand]) { console.warn('[hamster_figur] unbekanntes Ereignis oder Ziel: ' + name + ' → ' + zustand); return; }
      o = Object.assign({}, o || {});
      if (o.beilaeufig) {
        if (schlaeft() || hinweisOffen) return;
        var anteil = istSpielplatz() && typeof sp().reaktions_anteil === 'number' ? sp().reaktions_anteil : 1;
        if (Math.random() > anteil) return;
        o.ohneSchlafReset = true;
      }
      if (manifest.zustaende[zustand].kategorie === 'hinweis') {        // K3: ein Weg für Hinweise
        var text = o.text !== undefined ? o.text : (typeof o.n === 'number' ? textMitZahl(manifest.zustaende[zustand], o.n) : undefined);
        if (text === undefined) { var l = texteFuer(manifest.zustaende[zustand]); text = l.length ? wahl(l) : ''; }
        hinweis(text, o, zustand);
        melde('ereignis', { ereignis: name, zustand: zustand });
        return;
      }
      if (opt.modus === 'knopf') hervorHolen();
      hinweisOffen = false;
      zeige(zustand, o);
      if (name === 'geburtstag') konfetti();
      melde('ereignis', { ereignis: name, zustand: zustand });
    }

    /** Hinweis: Pfote hoch, Text bleibt stehen, bis jemand tippt. */
    function hinweis(text, o, zustand) {
      if (!manifest) { nachBereit.push(function () { hinweis(text, o, zustand); }); return; }
      if (!aktiv) return;
      o = Object.assign({}, o || {}); o.text = text; o.dauer = 0; o.ohneRueckweg = true; delete o.n;
      hinweisOffen = true;
      if (opt.modus === 'knopf') hervorHolen(true);
      zeige(zustand || zielVon('hinweis') || 'raise_hand', o);
      el.wurzel.classList.add('hf--hinweis');
    }

    function tipp() {
      if (!aktiv || !manifest) return;
      clearTimeout(t.tipp); tipps++; t.tipp = setTimeout(function () { tipps = 0; }, 1500);
      var war = aktuell;
      if (hinweisOffen) {
        hinweisOffen = false;                                   // K1: erst lösen, sonst blockt verstecken sich selbst
        el.wurzel.classList.remove('hf--hinweis'); sage('');
        melde('hinweis-gesehen', {});
        zeige('idle', { still: true });
        if (opt.modus === 'knopf') verstecken();
        return;
      }
      // K22 (Nachtrag 1, N-B): im Knopf-Modus zeigt der Versteck-Timer auf die NEUE Reaktion — auch beim Wecken und bei der Zunge.
      // Vorher lief der Timer des auslösenden Ereignisses weiter und klappte die Figur mitten im Satz weg.
      if (opt.modus === 'knopf') hervorHolen();
      if (manifest.zustaende[war].kategorie === 'schlaf') { zeige('surprised'); melde('tipp', { geweckt: true }); return; }
      if (tipps >= manifest.verhalten.zunge_nach_tipps) { tipps = 0; zeige('tongue'); melde('tipp', { zunge: true }); return; }
      var liste = opt.tippZustaende || (istSpielplatz() && sp().tippZustaende) || ['happy', 'thinking', 'shrug', 'wave', 'laughing'];
      zeige(wahl(liste));
      melde('tipp', {});
    }

    // ---------------------------------------------------------------- Leben im Grundzustand
    function leben() {
      clearTimeout(t.leben);
      var v = manifest.verhalten;
      t.leben = setTimeout(function () {
        if (aktuell === 'idle' && aktiv && (opt.modus === 'ecke' || hervor)) {
          if (Math.random() > v.blick_anteil) {
            zeigeBild('blink', true);
            setTimeout(function () { if (aktuell === 'idle') zeigeBild('idle', true); }, v.blink_dauer_ms);
          } else {
            zeigeBild(Math.random() < 0.5 ? 'look_left' : 'look_right', true);
            setTimeout(function () { if (aktuell === 'idle') zeigeBild('idle', true); }, v.blick_dauer_ms);
          }
        }
        leben();
      }, zufall(v.blinzeln_ms[0], v.blinzeln_ms[1]));
    }

    function schlafNachMs() {
      return istSpielplatz() && typeof sp().schlaf_nach_ms === 'number' ? sp().schlaf_nach_ms : manifest.verhalten.schlaf_nach_ms;
    }
    // Nachtrag 1 (K21, N-A): Läuft der Schlaf-Timer mitten in einer Reaktion ab, wird der Schlaf VORGEMERKT und beim
    // Rückweg zu idle nachgeholt (schlafen() aus zeige()). Das „in 3 s noch mal versuchen“ der Stufe 1 traf bei dichtem
    // Takt systematisch wieder in eine Reaktion (Prüffall 14: Fenster 4,0–5,0 s, Prüfung bei 3,0 / 6,0 / 9,0 s).
    var schlafFaellig = false;
    function schlafen() {
      schlafFaellig = false;
      if (aktiv && aktuell === 'idle') zeige(Math.random() < 0.7 ? 'sleep_sitting' : 'sleep_lying', { dauer: 0 });
    }
    function armSchlaf() {
      clearTimeout(t.schlaf); schlafFaellig = false;
      if (opt.modus !== 'ecke') return;
      var ms = schlafNachMs(); if (!(ms > 0)) return;
      t.schlaf = setTimeout(function () {
        if (!aktiv || schlaeft()) return;
        if (aktuell === 'idle') schlafen(); else schlafFaellig = true;   // mitten in einer Reaktion: beim Rückweg einschlafen
      }, ms);
    }

    function armZufall() {
      clearTimeout(t.zufall);
      if (opt.modus !== 'ecke' || !opt.zufall || !manifest.zufall || !manifest.zufall.length) return;
      var m = manifest.verhalten.zufall_min;
      t.zufall = setTimeout(function () { if (aktuell === 'idle') zeige(wahl(manifest.zufall)); armZufall(); }, zufall(m[0], m[1]) * 60000);
    }

    // Knopf-Modus: Figur hervorholen / verstecken, stündliches Reinschauen
    function hervorHolen(bleibt) {
      clearTimeout(t.hervor); hervor = true; el.wurzel.classList.add('hf--hervor');
      if (!bleibt) t.hervor = setTimeout(verstecken, manifest.verhalten.reaktion_ms + 800);
    }
    function verstecken() {
      if (hinweisOffen) return;
      clearTimeout(t.hervor); hervor = false;
      if (el.wurzel) { el.wurzel.classList.remove('hf--hervor'); sage(''); }
    }
    function armReinschauen() {
      clearTimeout(t.reinschauen);
      if (opt.modus !== 'knopf' || !manifest.verhalten.reinschauen_min) return;
      t.reinschauen = setTimeout(function () {
        if (aktiv && !hervor && !hinweisOffen) { hervorHolen(); zeige('idle', { still: true }); animiere('hf--nicken'); setTimeout(verstecken, 2200); }
        armReinschauen();
      }, manifest.verhalten.reinschauen_min * 60000);
    }

    // ---------------------------------------------------------------- Ausrüstung
    function aktualisiereAusruestung(zustandName) {
      el.ausrVor.innerHTML = ''; el.ausrHinter.innerHTML = '';
      var z = manifest.zustaende[zustandName]; if (!z || !el.bilder[zustandName]) return;
      var getragen = opt.ausruestung || {};
      Object.keys(getragen).forEach(function (slotName) {
        var gegName = getragen[slotName]; if (!gegName) return;
        var slot = manifest.ausruestung.slots[slotName], geg = manifest.ausruestung.gegenstaende[gegName];
        if (!slot || !geg) { console.warn('[hamster_figur] Ausrüstung unbekannt: ' + slotName + '=' + gegName); return; }
        if (slot.gruppen && slot.gruppen.indexOf(z.gruppe) < 0) return;   // in dieser Pose nicht tragbar
        var img = document.createElement('img'); img.alt = ''; img.draggable = false; img.className = 'hf__gegenstand';
        img.addEventListener('error', function () { bildFehlt(geg.datei, img.src); });
        img.src = bildPfad(geg.datei);
        var koerperH = opt.hoehe * (z.massstab || 1);
        var bild = el.bilder[zustandName], k = z.koerper;
        var bildW = parseFloat(bild.dataset.breite) || (bild.naturalWidth / bild.naturalHeight) * (koerperH / (k[3] - k[1]));
        var koerperW = (k[2] - k[0]) * bildW;
        var lage = (geg.versatz || [0, 0]);
        img.style.width = (geg.breite * koerperW) + 'px';
        img.style.left = ((slot.x + (lage[0] || 0)) * koerperW - koerperW / 2) + 'px';
        img.style.top = ((slot.y + (lage[1] || 0)) * koerperH - koerperH) + 'px';
        img.style.transform = 'translateX(-50%)';
        (geg.hinter ? el.ausrHinter : el.ausrVor).appendChild(img);
      });
    }

    function setzeAusruestung(neuAusr) { opt.ausruestung = neuAusr || {}; if (manifest) aktualisiereAusruestung(aktuell); melde('ausruestung', { ausruestung: opt.ausruestung }); }

    function konfetti() {
      var farben = ['#e0973a', '#d6584a', '#4a8fd6', '#4caf7d', '#f3ece1'];
      for (var i = 0; i < 40; i++) {
        var d = document.createElement('div'); d.className = 'hf__konfetti';
        d.style.left = (5 + Math.random() * 90) + '%'; d.style.background = farben[i % farben.length];
        d.style.animationDelay = (Math.random() * 0.8) + 's';
        el.buehne.appendChild(d); (function (d) { setTimeout(function () { d.remove(); }, 3500); })(d);
      }
    }

    // ---------------------------------------------------------------- Öffentliche API der Figur
    function clearAll() { Object.keys(t).forEach(function (k) { if (t[k]) { clearTimeout(t[k]); t[k] = null; } }); }

    function an(wert) {
      aktiv = wert !== false;
      if (!el.wurzel) return;                                   // noch nicht gebaut: Wert ist gemerkt
      el.wurzel.classList.toggle('hf--aus', !aktiv);
      clearAll(); tipps = 0; hinweisOffen = false; el.wurzel.classList.remove('hf--hinweis');
      verstecken();
      if (aktiv) { zeige('idle', { still: true }); leben(); armReinschauen(); armZufall(); }
      else { sage(''); }
    }

    function setzeModus(modus) {
      opt.modus = modus === 'knopf' ? 'knopf' : 'ecke';
      if (!el.wurzel) return;
      el.wurzel.className = el.wurzel.className.replace(/hf--(ecke|knopf)/, 'hf--' + opt.modus);
      an(aktiv);
    }
    function setzeRolle(rolle) {
      opt.rolle = rolle === 'spielplatz' ? 'spielplatz' : 'lehrmeister';
      if (el.wurzel) el.wurzel.className = el.wurzel.className.replace(/hf--(lehrmeister|spielplatz)/, 'hf--' + opt.rolle);
      if (manifest && aktiv) armSchlaf();
    }

    function zerstoere() { clearAll(); if (el.wurzel) el.wurzel.remove(); el = {}; aktiv = false; zerstoert = true; }

    function reg(fn) { if (manifest) fn(); else vorab.push(fn); }
    var registriere = {
      zustand: function (name, def) { reg(function () { manifest.zustaende[name] = def; if (el.koerper) legeBildAn(name); }); },   // K2: nur das neue Bild
      ereignis: function (name, zustand) { reg(function () { manifest.ereignisse[name] = zustand; }); },
      text: function (zustand, texte) { reg(function () { var z = manifest.zustaende[zustand]; if (z) z.texte = (z.texte || []).concat(texte); }); },
      textSpielplatz: function (zustand, texte) { reg(function () { var z = manifest.zustaende[zustand]; if (z) z.texte_spielplatz = (z.texte_spielplatz || []).concat(texte); }); },
      gegenstand: function (name, def) { reg(function () { manifest.ausruestung.gegenstaende[name] = def; }); },
      slot: function (name, def) { reg(function () { manifest.ausruestung.slots[name] = def; }); }
    };
    function auf(name, fn) { (handler[name] = handler[name] || []).push(fn); }

    var api = {
      name: opt.name,
      an: an, zeige: zeige, ereignis: ereignis, hinweis: hinweis,
      sage: function (text, dauer) { if (el.blase) sage(text, dauer); },
      setzeAusruestung: setzeAusruestung, setzeModus: setzeModus, setzeRolle: setzeRolle, zerstoere: zerstoere,
      registriere: registriere, auf: auf,
      zustand: function () { return aktuell; },
      manifest: function () { return manifest; },
      rolle: function () { return opt.rolle; },
      wurzel: function () { return el.wurzel || null; },
      istAn: function () { return aktiv; },
      sperre: function (w) { ereignisSperre = !!w; }
    };

    api.bereit = ladeManifest(opt.basisPfad, opt.manifest).then(function (m) {
      if (zerstoert) return api;
      manifest = m;
      vorab.forEach(function (fn) { fn(); }); vorab.length = 0;
      baue();
      an(aktiv);
      nachBereit.forEach(function (fn) { fn(); }); nachBereit.length = 0;
      return api;
    });
    api.bereit.catch(function (e) { melde('fehler', { manifest: true, message: e && e.message ? e.message : String(e) }); });
    return api;
  }

  // ================================================================ Standard-Figur (Kurzform, Doku §3)
  var standard = null, vorabReg = [], vorabAuf = [];
  function init(o) {
    if (standard) { console.warn('[hamster_figur] init() doppelt — bestehende Figur bleibt'); return standard.bereit; }   // K4
    standard = neu(o);
    vorabReg.forEach(function (fn) { fn(standard); }); vorabReg.length = 0;
    vorabAuf.forEach(function (p) { standard.auf(p[0], p[1]); }); vorabAuf.length = 0;
    return standard.bereit;
  }
  function durch(name) { return function () { if (!standard) { console.warn('[hamster_figur] ' + name + '() vor init()'); return; } return standard[name].apply(null, arguments); }; }
  var registriereStandard = {};
  ['zustand', 'ereignis', 'text', 'textSpielplatz', 'gegenstand', 'slot'].forEach(function (art) {
    registriereStandard[art] = function () { var a = arguments; if (standard) standard.registriere[art].apply(null, a); else vorabReg.push(function (s) { s.registriere[art].apply(null, a); }); };
  });

  return {
    neu: neu,
    init: init,
    an: durch('an'), zeige: durch('zeige'), ereignis: durch('ereignis'), hinweis: durch('hinweis'), sage: durch('sage'),
    setzeAusruestung: durch('setzeAusruestung'), setzeModus: durch('setzeModus'), setzeRolle: durch('setzeRolle'),
    zerstoere: function () { if (standard) { standard.zerstoere(); standard = null; } },
    registriere: registriereStandard,
    auf: function (name, fn) { if (standard) standard.auf(name, fn); else vorabAuf.push([name, fn]); },
    zustand: function () { return standard ? standard.zustand() : 'idle'; },
    manifest: function () { return standard ? standard.manifest() : null; },
    sperre: durch('sperre'),
    standard: function () { return standard; }
  };
})();
