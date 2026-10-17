/**
 * hamster_figur.js — Crumble, die Hamster-Figur von BäckereiOS (Maskottchen, Baustelle #62)
 * ------------------------------------------------------------------------------
 * NICHT zu verwechseln mit bos_hamster.js (Hamstertage-Rechnung). Diese Datei
 * zeigt nur eine Figur an und kennt weder Firestore noch Konten noch localStorage.
 *
 * Was sie tut:
 *   - lädt hamster_figur_manifest.json (Zustände, Bilder, Ereignisse, Texte,
 *     Ausrüstungs-Slots, Nummern) einmal je basisPfad und die PNGs aus bilder/
 *   - ist eine FABRIK: BOS_HAMSTER_FIGUR.neu(optionen) liefert eine eigene Figur
 *     (eigener DOM, eigene Timer, eigene Rolle). Mehrere Figuren je Seite erlaubt.
 *     BOS_HAMSTER_FIGUR.init(optionen) bleibt als Kurzform (Standard-Figur).
 *   - zwei ROLLEN (Manifest, kein Code-Wissen über Sätze):
 *       'lehrmeister' (Vorgabe) spricht zustaende.*.texte — über die Lage, nie an den Nutzer
 *       'spielplatz'  spricht zustaende.*.texte_spielplatz (fehlt es: texte) — darf albern sein
 *   - vier EINBETTUNGEN:
 *       'fest'         fixed unten rechts (Prüfseite, Satelliten)
 *       'oben'         im Container (Kopfleiste): Knopf inline, Bühne hängt darunter — seit Stufe 1c
 *                      im Launcher NICHT mehr in Gebrauch (bleibt für Prüfseite/Satelliten)
 *       'container'    absolut im Container (Bildschirmschoner), kein eigener Layer, läuft auf der Unterkante
 *       'schreibtisch' absolut in einer Bühne des Hosts (Launcher-Schreibtisch, Stufe 1c): bleibt, läuft,
 *                      spielt Nummern, ist schiebbar, kann versteckt werden (sichtbar())
 *   - Modus 'ecke' (Figur dauerhaft da) oder 'knopf' (Ruf-Knopf; im Launcher seit 1c ungenutzt)
 *   - lebt im Grundzustand: Blinzeln, Blick, Atmen, nach Pause Schlaf; auf Schreibtisch/Schoner
 *     zusätzlich Spaziergänge (laufe) und Nummern (nummer) nach Manifest-Zeiten
 *   - reagiert auf benannte Ereignisse (ereignis('viel_offen')), auf Antippen und zeigt Hinweise
 *   - trägt Ausrüstung (Overlays an benannten Slots) — Vorbereitung für "individuell gestalten"
 *
 * Erweitern ohne Codeänderung: neue Zustände, Ereignisse, Texte, Gegenstände und Nummern
 * kommen ins Manifest (siehe HAMSTER_FIGUR_DOKU.md §4). Zur Laufzeit zusätzlich über registriere.*.
 *
 * Abhängigkeiten: keine. Nutzt die BOS-Design-Tokens, wenn vorhanden, sonst eigene Fallback-Farben.
 * Speichern (Sichtbarkeit, Position) macht der Host über die Option speicher { lese(), schreibe(o) }.
 *
 * CHANGELOG
 *   2026-10-17 · 10:05 · Nachtrag 2 (Kontroll-Chat 09:52): nummer() beendet sich sofort, wenn das
 *     Nummern-Bild nicht ladbar ist (img null / naturalWidth 0) — vorher sechs Sekunden leeres
 *     Bild, z. B. wenn der Ordner nummern/ beim Sync fehlt. Prüffall 1c-9.
 *   2026-10-17 · 09:37 · Stufe 1c (Bau-Chat Crumble, Anweisung Kontroll-Chat 09:00, Bauplan 09:03,
 *     Go 09:12): K24 Blase feste Farben, über dem Kopf nach dem sichtbaren Bild (schreibtisch/container),
 *     hf--hell entfällt · K25 Einbettung schreibtisch (left-basiert, Bühne vom Host) · K26 sichtbar()/
 *     istSichtbar(), wartende Hinweise/Ereignisse (melde 'wartet'), Timer-Zähler für Prüfungen ·
 *     K27 Ziehen (Pointer, 8 px, Anteil, speicher) · K28 Laufen (rAF, Watscheln, Spiegeln), Zeiten aus
 *     Manifest schreibtisch/spielplatz, Vorrang Lehrmeister-Ereignisse, beiläufige werden bei Laufen/
 *     Nummer ausgelassen · K29 Nummern: Zustände nummer_<name> aus manifest.nummern, Requisiten-Ebene
 *     (gross einzeln, klein als Sprite), Choreografie-Klassen, lazy geladen, Ebene wird bei jedem
 *     Abbruch entfernt · Reinschauen nur noch im Modus knopf. Nichts Firestore, nichts localStorage.
 *   2026-10-17 · 08:09 · Nachtrag 1: K21 Rückweg erbt ohneSchlafReset, fälliger Schlaf wird beim Rückweg
 *     nachgeholt · K22 tipp() ruft im Knopf-Modus immer hervorHolen().
 *   2026-10-17 · 06:49 · Stufe 1: K1–K8 (Fabrik, Einbettungen, Rollen, Listen-Ziele, texte_mit_zahl, fehler).
 *   2026-10-17 · ~04:00 · Erstfassung (Figuren-Chat).
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
      manifestLader[pfad].catch(function () { delete manifestLader[pfad]; });
    }
    return manifestLader[pfad].then(kopie);
  }

  function zufall(a, b) { return a + Math.random() * (b - a); }
  function wahl(liste) { return liste[Math.floor(Math.random() * liste.length)]; }
  function klemm(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var reduzierteBewegung = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ================================================================ Eine Figur
  function neu(o) {
    var opt = Object.assign({
      container: document.body, basisPfad: 'hamster_figur/', modus: 'ecke', einbettung: 'fest',
      rolle: 'lehrmeister', hoehe: 150, an: true, ausruestung: {}, zufall: true,
      name: 'standard', vor: null, manifest: null, tippZustaende: null,
      laufen: null, nummern: null, schiebbar: null, speicher: null, xStart: null
    }, o || {});
    if (!/\/$/.test(opt.basisPfad)) opt.basisPfad += '/';
    if (opt.modus !== 'knopf') opt.modus = 'ecke';
    if (['fest', 'oben', 'container', 'schreibtisch'].indexOf(opt.einbettung) < 0) opt.einbettung = 'fest';
    if (opt.rolle !== 'spielplatz') opt.rolle = 'lehrmeister';
    var aufLeiste = (opt.einbettung === 'schreibtisch' || opt.einbettung === 'container');   // steht auf einer Unterkante, Blase über dem Kopf
    if (opt.laufen === null) opt.laufen = aufLeiste;
    if (opt.nummern === null) opt.nummern = aufLeiste;
    if (opt.schiebbar === null) opt.schiebbar = (opt.einbettung === 'schreibtisch');

    var manifest = null, el = {}, aktuell = 'idle', ereignisSperre = false;
    var t = { reaktion: null, blase: null, leben: null, lebenZurueck: null, schlaf: null, reinschauen: null, zufall: null, tipp: null, hervor: null, lauf: null, nummer: null, vorlade: null };
    var tipps = 0, aktiv = opt.an !== false, hervor = false, hinweisOffen = false, hinweisText = '', zerstoert = false;
    var sichtbarIst = true, wartend = null;            // K26: versteckt = Figur weg, Timer gelöscht; wartend = letzter Hinweis/Ereignis im Versteck
    var xAnteil = null;                                // Position auf der Unterkante (0..1)
    var lauf = null;                                   // laufender Spaziergang { ziel, raf }
    var nummerAktiv = null, letzteNummer = null;       // laufende Nummer { name, ebene }
    var zieh = null, ignoriereClick = false;           // Ziehen
    var figW = Math.round(opt.hoehe * 0.95);
    var handler = {}, vorab = [], nachBereit = [];

    function melde(name, daten) {
      daten = Object.assign({ instanz: opt.name }, daten || {});
      (handler[name] || []).forEach(function (fn) { try { fn(daten); } catch (e) { console.error('[hamster_figur] Handler ' + name, e); } });
      try { document.dispatchEvent(new CustomEvent('hamster-figur:' + name, { detail: daten })); } catch (e) {}
    }
    function bildPfad(z) { return z.pfad ? opt.basisPfad + z.pfad : opt.basisPfad + 'bilder/' + z.datei; }
    function sp() { return (manifest && manifest.spielplatz) || {}; }
    function istSpielplatz() { return opt.rolle === 'spielplatz'; }
    function zeiten() { return (opt.einbettung === 'schreibtisch' ? manifest.schreibtisch : (istSpielplatz() ? manifest.spielplatz : null)) || {}; }
    function schlaeft() { return !!(manifest && manifest.zustaende[aktuell] && manifest.zustaende[aktuell].kategorie === 'schlaf'); }
    function beschaeftigt() { return !!(lauf || nummerAktiv || zieh); }
    function speicherLese() { try { return opt.speicher && opt.speicher.lese ? (opt.speicher.lese() || {}) : {}; } catch (e) { return {}; } }
    function speicherSchreibe(teil) { try { if (opt.speicher && opt.speicher.schreibe) opt.speicher.schreibe(Object.assign(speicherLese(), teil)); } catch (e) {} }

    // ---------------------------------------------------------------- Aufbau DOM
    function baue() {
      var wurzel = document.createElement('div');
      wurzel.className = 'hf hf--' + opt.modus + ' hf--' + opt.einbettung + ' hf--' + opt.rolle + (aufLeiste ? ' hf--blase-oben' : '');
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
      el.figur.style.height = opt.hoehe + 'px';
      el.figur.style.width = figW + 'px';
      el.buehne.style.width = figW + 'px';
      el.buehne.style.height = (opt.hoehe + 80) + 'px';
      if (!aufLeiste) { el.blase.style.right = (figW + 8) + 'px'; el.blase.style.bottom = opt.hoehe + 'px'; }

      el.bilder = {};
      Object.keys(manifest.zustaende).forEach(function (name) { if (!manifest.zustaende[name].lazy) legeBildAn(name); });

      el.knopf.addEventListener('click', function (e) { e.stopPropagation(); tipp(); });
      el.knopf.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.knopf.click(); } });
      el.figur.addEventListener('click', function (e) { e.stopPropagation(); if (ignoriereClick) { ignoriereClick = false; return; } tipp(); });
      el.blase.addEventListener('click', function (e) { e.stopPropagation(); tipp(); });
      if (opt.schiebbar) verdrahteZiehen();

      if (opt.vor && opt.vor.parentNode === opt.container) opt.container.insertBefore(wurzel, opt.vor);
      else opt.container.appendChild(wurzel);
      el.knopfBild.addEventListener('error', function () { bildFehlt(manifest.zustaende.idle.datei, el.knopfBild.src); });
      el.knopfBild.src = bildPfad(manifest.zustaende.idle);

      if (aufLeiste) {
        var gesp = speicherLese();
        var start = typeof gesp.x === 'number' ? gesp.x : (typeof opt.xStart === 'number' ? opt.xStart : (typeof zeiten().x_start === 'number' ? zeiten().x_start : 0.12));
        setzeX(start, true);
        if (gesp.sichtbar === false) sichtbarIst = false;
        el.wurzel.classList.toggle('hf--versteckt', !sichtbarIst);
        window.addEventListener('resize', beiResize);
      }
    }
    function beiResize() { if (el.wurzel && xAnteil !== null) setzeX(xAnteil, true); }

    function bildFehlt(datei, url) {
      console.warn('[hamster_figur] Bild fehlt: ' + datei + ' (' + url + ')');
      melde('fehler', { datei: datei, url: url });
    }

    /** Ein Zustandsbild anlegen (Crossfade statt Nachladen). Gibt ein Promise auf das geladene Bild. */
    function legeBildAn(name) {
      var z = manifest.zustaende[name];
      if (el.bilder[name]) return el.bilder[name]._fertig;
      var img = document.createElement('img');
      img.className = 'hf__bild'; img.alt = ''; img.draggable = false;
      img.dataset.zustand = name;
      var k = z.koerper, kh = k[3] - k[1], kw = k[2] - k[0];
      var hoehe = opt.hoehe * (z.massstab || 1) / kh;        // Bildhöhe in px (Skalierung über den Körperkasten)
      img.style.height = hoehe + 'px';
      img.style.bottom = (-(1 - k[3]) * hoehe) + 'px';           // Körperunterkante auf 0
      img.style.left = '50%';
      img._fertig = new Promise(function (ok) {
        img.addEventListener('load', function () {
          var w = (img.naturalWidth / img.naturalHeight) * hoehe;
          img.style.marginLeft = (-(k[0] + kw / 2) * w) + 'px';
          img.dataset.breite = w; img.dataset.hoehe = hoehe;
          if (name === aktuell) aktualisiereAusruestung(name);
          ok(img);
        });
        img.addEventListener('error', function () { bildFehlt(z.datei, img.src); ok(null); });
      });
      img.src = bildPfad(z);
      el.koerper.appendChild(img);
      el.bilder[name] = img;
      return img._fertig;
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
    function aktivesBild() { return el.bilder[aktuell] || null; }

    function animiere(klasse) {
      el.figur.classList.remove('hf--squish', 'hf--nicken', 'hf--wippen');
      void el.figur.offsetWidth;
      el.figur.classList.add(klasse);
    }

    /** Blase legen (K24): über dem Kopf nach dem sichtbaren Bild (Leiste) bzw. links neben der Figur (fest/oben); nie aus dem Bildschirm. */
    function legeBlase() {
      el.blase.style.transform = '';
      if (!el.blase.classList.contains('hf__blase--an')) return;
      var rand = 8, breite = window.innerWidth || document.documentElement.clientWidth;
      if (aufLeiste) {
        var img = aktivesBild(), wr = el.wurzel.getBoundingClientRect();
        var kopf = img ? img.getBoundingClientRect().top : (wr.bottom - opt.hoehe);
        el.blase.style.right = 'auto';
        el.blase.style.bottom = Math.round(Math.max(opt.hoehe, wr.bottom - kopf) + 10) + 'px';
        var bw = el.blase.offsetWidth;
        el.blase.style.left = Math.round(figW / 2 - bw / 2) + 'px';
      }
      var r = el.blase.getBoundingClientRect(), schub = 0;
      if (r.left < rand) schub = rand - r.left;
      else if (r.right > breite - rand) schub = (breite - rand) - r.right;
      if (schub) el.blase.style.transform = 'translateX(' + Math.round(schub) + 'px)';
    }

    function sage(text, dauerMs) {
      clearTimeout(t.blase);
      if (!text || !sichtbarIst) { el.blase.classList.remove('hf__blase--an'); el.blase.style.transform = ''; return; }
      el.blase.textContent = text;
      el.blase.classList.add('hf__blase--an');
      legeBlase();
      if (dauerMs > 0) t.blase = setTimeout(function () { el.blase.classList.remove('hf__blase--an'); }, dauerMs);
    }

    function texteFuer(z) {
      if (istSpielplatz() && z.texte_spielplatz && z.texte_spielplatz.length) return z.texte_spielplatz;
      return z.texte || [];
    }
    function textMitZahl(z, n) {
      var liste = z['texte_mit_zahl_' + n] || z.texte_mit_zahl;
      if (!liste || !liste.length) return undefined;
      return wahl(liste).replace(/\{n\}/g, String(n));
    }

    /** Zustand zeigen. o = { text, n, dauer (ms, 0 = bleibt), dauerText, still, ohneRueckweg, ohneSchlafReset } */
    function zeige(name, o) {
      o = o || {};
      if (!manifest) return;
      if (!manifest.zustaende[name]) { console.warn('[hamster_figur] unbekannter Zustand: ' + name); return; }
      if (nummerAktiv && name !== 'nummer_' + nummerAktiv.name) beendeNummer();   // jeder andere Zustand beendet die Nummer (Ebene weg)
      clearTimeout(t.reaktion);
      var z = manifest.zustaende[name];
      if (!el.bilder[name]) legeBildAn(name);
      aktuell = name;
      zeigeBild(name);
      if (!o.ohneAnimation) animiere(z.kategorie === 'hinweis' ? 'hf--wippen' : 'hf--squish');
      var text = o.text;
      if (text === undefined && typeof o.n === 'number') text = textMitZahl(z, o.n);
      if (text === undefined) { var liste = texteFuer(z); text = liste.length ? wahl(liste) : ''; }
      if (!o.still) sage(text, o.dauer === 0 ? 0 : (o.dauerText || manifest.verhalten.reaktion_ms - 1500));
      var zurueck = o.dauer !== undefined ? o.dauer : (z.kategorie === 'hinweis' ? manifest.verhalten.hinweis_ms : manifest.verhalten.reaktion_ms);
      if (zurueck > 0 && !o.ohneRueckweg && name !== 'idle' && z.kategorie !== 'schlaf') {
        t.reaktion = setTimeout(function () {
          zeige('idle', { still: true, ohneSchlafReset: !!o.ohneSchlafReset });
          if (schlafFaellig) schlafen();
          if (opt.modus === 'knopf') verstecken();
        }, zurueck);
      }
      if (z.kategorie !== 'schlaf' && !o.ohneSchlafReset) armSchlaf();
      melde('zustand', { zustand: name });
    }

    function zielVon(name) {
      var ziel = manifest.ereignisse[name];
      if (Array.isArray(ziel)) ziel = ziel.length ? wahl(ziel) : null;
      return ziel || null;
    }

    /**
     * Ereignis. o = { text, n, beilaeufig, … }
     * beilaeufig (Schoner-Inhalt): Anteil spielplatz.reaktions_anteil, kein Schlaf-Reset, schläft durch,
     * wird ausgelassen, wenn die Figur läuft oder eine Nummer spielt (W4). Alles andere hat Vorrang:
     * unterbricht Spaziergang und Nummer. Versteckt: wird gemerkt (K26) und beim Einblenden gezeigt.
     */
    function ereignis(name, o) {
      if (!manifest) { nachBereit.push(function () { ereignis(name, o); }); return; }
      if (!aktiv || ereignisSperre) return;
      var zustand = zielVon(name);
      if (!zustand || !manifest.zustaende[zustand]) { console.warn('[hamster_figur] unbekanntes Ereignis oder Ziel: ' + name + ' → ' + zustand); return; }
      o = Object.assign({}, o || {});
      if (o.beilaeufig) {
        if (!sichtbarIst || schlaeft() || hinweisOffen || beschaeftigt()) return;
        var anteil = istSpielplatz() && typeof sp().reaktions_anteil === 'number' ? sp().reaktions_anteil : 1;
        if (Math.random() > anteil) return;
        o.ohneSchlafReset = true;
      }
      if (manifest.zustaende[zustand].kategorie === 'hinweis') {
        var text = o.text !== undefined ? o.text : (typeof o.n === 'number' ? textMitZahl(manifest.zustaende[zustand], o.n) : undefined);
        if (text === undefined) { var l = texteFuer(manifest.zustaende[zustand]); text = l.length ? wahl(l) : ''; }
        hinweis(text, o, zustand);
        melde('ereignis', { ereignis: name, zustand: zustand });
        return;
      }
      if (!sichtbarIst) {                                   // K26: merken, Punkt am Knopf
        if (!wartend || wartend.art !== 'hinweis') wartend = { art: 'ereignis', name: name, o: o };
        melde('wartet', { art: 'ereignis', name: name });
        melde('ereignis', { ereignis: name, zustand: zustand, wartet: true });
        return;
      }
      if (!o.beilaeufig) { stoppeLaufen(); }
      if (opt.modus === 'knopf') hervorHolen();
      hinweisOffen = false;
      zeige(zustand, o);
      if (name === 'geburtstag') konfetti();
      melde('ereignis', { ereignis: name, zustand: zustand });
    }

    /** Hinweis: Pfote hoch, Text bleibt stehen, bis jemand tippt. Versteckt: wartet, Punkt am Knopf. */
    function hinweis(text, o, zustand) {
      if (!manifest) { nachBereit.push(function () { hinweis(text, o, zustand); }); return; }
      if (!aktiv) return;
      o = Object.assign({}, o || {}); o.text = text; o.dauer = 0; o.ohneRueckweg = true; delete o.n;
      hinweisOffen = true; hinweisText = text;
      el.wurzel.classList.add('hf--hinweis');
      melde('hinweis', { text: text });
      if (!sichtbarIst) { wartend = { art: 'hinweis', text: text, o: o, zustand: zustand }; melde('wartet', { art: 'hinweis' }); return; }
      stoppeLaufen();
      if (opt.modus === 'knopf') hervorHolen(true);
      zeige(zustand || zielVon('hinweis') || 'raise_hand', o);
    }

    function tipp() {
      if (!aktiv || !manifest || !sichtbarIst) return;
      clearTimeout(t.tipp); tipps++; t.tipp = setTimeout(function () { tipps = 0; }, 1500);
      var war = aktuell;
      stoppeLaufen();
      if (hinweisOffen) {
        hinweisOffen = false; hinweisText = '';
        el.wurzel.classList.remove('hf--hinweis'); sage('');
        melde('hinweis-gesehen', {});
        zeige('idle', { still: true });
        if (opt.modus === 'knopf') verstecken();
        return;
      }
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
        if (aktuell === 'idle' && aktiv && sichtbarIst && !zieh && (opt.modus === 'ecke' || hervor)) {
          clearTimeout(t.lebenZurueck);
          if (Math.random() > v.blick_anteil) {
            zeigeBild('blink', true);
            t.lebenZurueck = setTimeout(function () { if (aktuell === 'idle') zeigeBild('idle', true); }, v.blink_dauer_ms);
          } else {
            zeigeBild(Math.random() < 0.5 ? 'look_left' : 'look_right', true);
            t.lebenZurueck = setTimeout(function () { if (aktuell === 'idle') zeigeBild('idle', true); }, v.blick_dauer_ms);
          }
        }
        leben();
      }, zufall(v.blinzeln_ms[0], v.blinzeln_ms[1]));
    }

    function schlafNachMs() {
      var z = zeiten();
      return typeof z.schlaf_nach_ms === 'number' ? z.schlaf_nach_ms : manifest.verhalten.schlaf_nach_ms;
    }
    var schlafFaellig = false;
    function schlafen() {
      schlafFaellig = false;
      if (aktiv && sichtbarIst && aktuell === 'idle' && !beschaeftigt()) zeige(Math.random() < 0.7 ? 'sleep_sitting' : 'sleep_lying', { dauer: 0 });
    }
    function armSchlaf() {
      clearTimeout(t.schlaf); schlafFaellig = false;
      if (opt.modus !== 'ecke') return;
      var ms = schlafNachMs(); if (!(ms > 0)) return;
      t.schlaf = setTimeout(function () {
        if (!aktiv || schlaeft()) return;
        if (aktuell === 'idle' && !beschaeftigt()) schlafen(); else schlafFaellig = true;   // mitten in Reaktion/Nummer/Lauf: nachholen
      }, ms);
    }

    function armZufall() {
      clearTimeout(t.zufall);
      if (opt.modus !== 'ecke' || !opt.zufall || !manifest.zufall || !manifest.zufall.length) return;
      var m = manifest.verhalten.zufall_min;
      t.zufall = setTimeout(function () { if (aktuell === 'idle' && !beschaeftigt() && sichtbarIst) zeige(wahl(manifest.zufall)); armZufall(); }, zufall(m[0], m[1]) * 60000);
    }

    // Knopf-Modus (im Launcher seit 1c ungenutzt): Figur hervorholen / verstecken, stündliches Reinschauen
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

    // ---------------------------------------------------------------- Position, Laufen (K27/K28)
    function laufBreite() { return Math.max(0, (opt.container.clientWidth || 0) - figW); }
    function setzeX(anteil, still) {
      if (!el.wurzel || !aufLeiste) return;
      xAnteil = klemm(typeof anteil === 'number' ? anteil : 0, 0, 1);
      el.wurzel.style.left = Math.round(xAnteil * laufBreite()) + 'px';
      if (!still) speicherSchreibe({ x: xAnteil });
      melde('position', { x: xAnteil });
    }
    function stoppeLaufen() {
      if (!lauf) return;
      if (lauf.raf) cancelAnimationFrame(lauf.raf);
      lauf = null;
      el.wurzel.classList.remove('hf--laeuft');
      if (xAnteil !== null) speicherSchreibe({ x: xAnteil });
      legeBlase();
    }
    /** Spaziergang zu einer zufälligen Stelle (oder zielAnteil). */
    function laufe(zielAnteil) {
      if (!aktiv || !sichtbarIst || !aufLeiste || !opt.laufen || schlaeft() || nummerAktiv || zieh || hinweisOffen || lauf) return false;
      if (aktuell !== 'idle') return false;
      if (schlafFaellig) { schlafen(); return false; }        // Schlaf war fällig: erst schlafen, nicht noch ein Spaziergang
      var breite = laufBreite(); if (breite < 40) return false;
      var ziel = typeof zielAnteil === 'number' ? klemm(zielAnteil, 0, 1) : null;
      if (ziel === null) { var i = 0; do { ziel = Math.random(); i++; } while (Math.abs(ziel - xAnteil) < 0.15 && i < 20); }
      var tempo = (zeiten().geschwindigkeit_px_s || 55);
      stoppeLaufen(); sage('');
      el.wurzel.classList.toggle('hf--links', ziel < xAnteil);
      el.wurzel.classList.add('hf--laeuft');
      lauf = { ziel: ziel, raf: null, zeit: null };
      melde('laufen', { von: xAnteil, nach: ziel });
      var schritt = function (ts) {
        if (!lauf) return;
        if (lauf.zeit === null) lauf.zeit = ts;
        var dt = (ts - lauf.zeit) / 1000; lauf.zeit = ts;
        var b = laufBreite(), px = xAnteil * b, zielPx = lauf.ziel * b, d = zielPx - px;
        var s = Math.min(Math.abs(d), tempo * dt) * (d < 0 ? -1 : 1);
        xAnteil = b ? klemm((px + s) / b, 0, 1) : xAnteil;
        el.wurzel.style.left = Math.round(xAnteil * b) + 'px';
        if (Math.abs(zielPx - px - s) < 1) { xAnteil = lauf.ziel; el.wurzel.style.left = Math.round(xAnteil * b) + 'px'; stoppeLaufen(); melde('angekommen', { x: xAnteil }); if (schlafFaellig) schlafen(); return; }
        lauf.raf = requestAnimationFrame(schritt);
      };
      lauf.raf = requestAnimationFrame(schritt);
      return true;
    }
    function armLauf() {
      clearTimeout(t.lauf);
      if (!opt.laufen || !aufLeiste) return;
      var m = zeiten().lauf_min; if (!m) return;
      t.lauf = setTimeout(function () { laufe(); armLauf(); }, zufall(m[0], m[1]) * 60000);
    }

    // Ziehen (K27): Pointer auf der Figur; ab 8 px Bewegung ziehen, sonst Tipp (click folgt)
    function verdrahteZiehen() {
      el.figur.style.touchAction = 'none';
      el.figur.addEventListener('pointerdown', function (e) {
        if (!aktiv || !sichtbarIst || e.button) return;
        zieh = { id: e.pointerId, x0: e.clientX, startLinks: parseFloat(el.wurzel.style.left) || 0, aktivGeworden: false };
        try { el.figur.setPointerCapture(e.pointerId); } catch (x) {}
      });
      el.figur.addEventListener('pointermove', function (e) {
        if (!zieh || e.pointerId !== zieh.id) return;
        var dx = e.clientX - zieh.x0;
        if (!zieh.aktivGeworden) {
          if (Math.abs(dx) < 8) return;
          zieh.aktivGeworden = true;
          stoppeLaufen(); beendeNummer(); clearTimeout(t.reaktion); sage('');
          el.wurzel.classList.add('hf--zieht');
          zeigeBild(Math.random() < 0.5 ? 'surprised' : 'tongue', true);
          melde('ziehen', { start: true });
        }
        var b = laufBreite(), links = klemm(zieh.startLinks + dx, 0, b);
        el.wurzel.style.left = Math.round(links) + 'px';
        xAnteil = b ? links / b : 0;
      });
      var ende = function (e) {
        if (!zieh || e.pointerId !== zieh.id) return;
        var war = zieh; zieh = null;
        try { el.figur.releasePointerCapture(e.pointerId); } catch (x) {}
        if (!war.aktivGeworden) return;                   // war ein Tipp: click übernimmt
        ignoriereClick = true; setTimeout(function () { ignoriereClick = false; }, 0);
        el.wurzel.classList.remove('hf--zieht');
        zeigeBild(aktuell, true);
        setzeX(xAnteil);
        armSchlaf(); armLauf(); armNummer();
        melde('ziehen', { ende: true, x: xAnteil });
      };
      el.figur.addEventListener('pointerup', ende);
      el.figur.addEventListener('pointercancel', ende);
    }

    // ---------------------------------------------------------------- Nummern (K29)
    function nummernListe() { return manifest && manifest.nummern ? Object.keys(manifest.nummern) : []; }
    function beendeNummer() {
      if (!nummerAktiv) return;
      var n = nummerAktiv; nummerAktiv = null;
      if (n.ebene && n.ebene.parentNode) n.ebene.parentNode.removeChild(n.ebene);
      el.figur.className = el.figur.className.replace(/\s*hf-fig-\S+/g, '');
      el.wurzel.classList.remove('hf--nummer');
      melde('nummer-ende', { nummer: n.name, abgebrochen: !n.fertig });
    }
    /** Nummer abspielen: Zustandsbild + Requisiten-Ebene + Choreografie + Spruch, nach dauer_ms zurück. */
    function nummer(name) {
      if (!manifest || !aktiv || !sichtbarIst || !opt.nummern || schlaeft() || zieh || hinweisOffen) return false;
      var liste = nummernListe(); if (!liste.length) return false;
      if (!name) { var i = 0; do { name = wahl(liste); i++; } while (liste.length > 1 && name === letzteNummer && i < 20); }
      var n = manifest.nummern[name]; if (!n) { console.warn('[hamster_figur] unbekannte Nummer: ' + name); return false; }
      if (schlafFaellig && !lauf) { schlafen(); return false; }  // Schlaf war fällig: erst schlafen
      stoppeLaufen(); beendeNummer();
      letzteNummer = name;
      var zustand = 'nummer_' + name;
      var dauer = n.dauer_ms || manifest.verhalten.nummer_dauer_ms || 6000;
      var meine = { name: name, ebene: null, fertig: false };
      nummerAktiv = meine;
      el.wurzel.classList.add('hf--nummer');
      legeBildAn(zustand).then(function (img) {
        if (nummerAktiv !== meine) return;                   // inzwischen abgebrochen
        // Nachtrag 2 (Kontroll-Chat 09:52): Bild nicht ladbar (z. B. Ordner nummern/ nicht eingespielt) → Nummer sofort
        // beenden, idle bleibt — sonst stünde sechs Sekunden lang ein leeres Bild. Die Warnung kam schon aus legeBildAn().
        if (!img || !img.naturalWidth) { beendeNummer(); return; }
        if (img.dataset.breite) baueRequisiten(meine, n, img);
        var ch = n.choreografie || {};
        if (ch.figur && !reduzierteBewegung) el.figur.classList.add('hf-fig-' + ch.figur);
        zeige(zustand, { dauer: dauer, dauerText: Math.max(1500, dauer - 1500), ohneSchlafReset: true, ohneAnimation: true });
        melde('nummer', { nummer: name });
        setTimeout(function () { if (nummerAktiv === meine) meine.fertig = true; }, dauer - 20);
      });
      return true;
    }
    function baueRequisiten(meine, n, img) {
      var W = parseFloat(img.dataset.breite), H = parseFloat(img.dataset.hoehe);
      var ebene = document.createElement('div');
      ebene.className = 'hf__req-ebene';
      ebene.style.width = W + 'px'; ebene.style.height = H + 'px';
      ebene.style.bottom = img.style.bottom; ebene.style.left = '50%'; ebene.style.marginLeft = img.style.marginLeft;
      var ch = n.choreografie || {};
      var alle = (n.requisiten || []).concat(n.klein || []);
      alle.forEach(function (r, i) {
        var e = document.createElement('img'); e.alt = ''; e.draggable = false;
        e.className = 'hf__req hf__req--' + (r.klasse === 'gross' ? 'gross' : 'klein');
        var k = r.kasten;
        e.style.left = (k[0] * W) + 'px'; e.style.top = (k[1] * H) + 'px';
        e.style.width = ((k[2] - k[0]) * W) + 'px'; e.style.height = ((k[3] - k[1]) * H) + 'px';
        e.style.setProperty('--i', String(i));
        if (k[0] + (k[2] - k[0]) / 2 < 0.5) e.classList.add('hf__req--linksseite');
        var cho = r.klasse === 'gross' ? ch.gross : ch.klein;
        if (cho && !reduzierteBewegung) e.classList.add('hf-ch-' + cho);
        e.addEventListener('error', function () { bildFehlt(r.datei, e.src); });
        e.src = opt.basisPfad + 'nummern/' + r.datei;
        ebene.appendChild(e);
      });
      ebene.style.setProperty('--n', String(alle.length));
      el.figur.appendChild(ebene);
      meine.ebene = ebene;
    }
    function armNummer() {
      clearTimeout(t.nummer);
      if (!opt.nummern || !aufLeiste || !nummernListe().length) return;
      var m = zeiten().nummer_min; if (!m) return;
      t.nummer = setTimeout(function () { if (aktuell === 'idle' && !beschaeftigt() && !hinweisOffen) nummer(); armNummer(); }, zufall(m[0], m[1]) * 60000);
    }
    /** Nummern-Figuren in Leerlaufzeit vorladen (eine alle 400 ms), damit die erste Nummer nicht hakt. */
    function vorladen() {
      var rest = nummernListe().filter(function (n) { return !el.bilder['nummer_' + n]; });
      if (!rest.length) return;
      var naechste = function () { var n = rest.shift(); if (!n || !el.koerper) return; legeBildAn('nummer_' + n); if (rest.length) t.vorlade = setTimeout(naechste, 400); };
      t.vorlade = setTimeout(naechste, 1500);
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
        if (slot.gruppen && slot.gruppen.indexOf(z.gruppe) < 0) return;
        var img = document.createElement('img'); img.alt = ''; img.draggable = false; img.className = 'hf__gegenstand';
        img.addEventListener('error', function () { bildFehlt(geg.datei, img.src); });
        img.src = opt.basisPfad + 'bilder/' + geg.datei;
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

    // ---------------------------------------------------------------- An/Aus, Sichtbar (K26)
    function clearAll() { Object.keys(t).forEach(function (k) { if (t[k]) { clearTimeout(t[k]); t[k] = null; } }); schlafFaellig = false; }
    function timerAktiv() { var n = 0; Object.keys(t).forEach(function (k) { if (t[k]) n++; }); if (lauf) n++; return n; }
    function starteUhren() { leben(); armReinschauen(); armZufall(); armSchlaf(); armLauf(); armNummer(); }

    function an(wert) {
      aktiv = wert !== false;
      if (!el.wurzel) return;
      el.wurzel.classList.toggle('hf--aus', !aktiv);
      clearAll(); tipps = 0; hinweisOffen = false; hinweisText = ''; wartend = null; el.wurzel.classList.remove('hf--hinweis');
      stoppeLaufen(); beendeNummer(); zieh = null; el.wurzel.classList.remove('hf--zieht');
      verstecken();
      if (aktiv) { zeige('idle', { still: true, ohneSchlafReset: !sichtbarIst }); if (sichtbarIst) { starteUhren(); if (opt.nummern) vorladen(); } }
      else { sage(''); }
    }

    /** Zeigen/Verstecken (Knopf in der Kopfleiste). Versteckt: keine Blase, keine Bewegung, Timer gelöscht. */
    function sichtbar(wert, still) {
      var neu = wert !== false;
      if (!el.wurzel) { sichtbarIst = neu; return; }
      if (neu === sichtbarIst) return;
      sichtbarIst = neu;
      el.wurzel.classList.toggle('hf--versteckt', !neu);
      if (!still) speicherSchreibe({ sichtbar: neu });
      if (!neu) {
        clearAll(); stoppeLaufen(); beendeNummer(); zieh = null; el.wurzel.classList.remove('hf--zieht', 'hf--laeuft');
        clearTimeout(t.reaktion); sage('');
        if (hinweisOffen) wartend = { art: 'hinweis', text: hinweisText, o: { text: hinweisText, dauer: 0, ohneRueckweg: true }, zustand: null };
      } else if (aktiv) {
        zeige('idle', { still: true });
        starteUhren(); if (opt.nummern) vorladen();
        var w = wartend; wartend = null;
        if (w && w.art === 'hinweis') { hinweisOffen = false; hinweis(w.text, w.o, w.zustand); }
        else if (w && w.art === 'ereignis') { ereignis(w.name, w.o); }
      }
      melde('sichtbar', { sichtbar: neu, wartet: !!wartend });
    }
    /** Gespeicherten Stand (Sichtbarkeit, Position) neu lesen — z. B. nach Profilwechsel im Host. */
    function ladeGespeichert() {
      if (!el.wurzel || !aufLeiste) return;
      var g = speicherLese();
      setzeX(typeof g.x === 'number' ? g.x : (typeof opt.xStart === 'number' ? opt.xStart : (zeiten().x_start || 0.12)), true);
      sichtbar(g.sichtbar !== false, true);
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
      if (manifest && aktiv && sichtbarIst) { armSchlaf(); armLauf(); armNummer(); }
    }

    function zerstoere() { clearAll(); stoppeLaufen(); beendeNummer(); window.removeEventListener('resize', beiResize); if (el.wurzel) el.wurzel.remove(); el = {}; aktiv = false; zerstoert = true; }

    function reg(fn) { if (manifest) fn(); else vorab.push(fn); }
    var registriere = {
      zustand: function (name, def) { reg(function () { manifest.zustaende[name] = def; if (el.koerper) legeBildAn(name); }); },
      ereignis: function (name, zustand) { reg(function () { manifest.ereignisse[name] = zustand; }); },
      text: function (zustand, texte) { reg(function () { var z = manifest.zustaende[zustand]; if (z) z.texte = (z.texte || []).concat(texte); }); },
      textSpielplatz: function (zustand, texte) { reg(function () { var z = manifest.zustaende[zustand]; if (z) z.texte_spielplatz = (z.texte_spielplatz || []).concat(texte); }); },
      gegenstand: function (name, def) { reg(function () { manifest.ausruestung.gegenstaende[name] = def; }); },
      slot: function (name, def) { reg(function () { manifest.ausruestung.slots[name] = def; }); },
      nummer: function (name, def) { reg(function () { manifest.nummern = manifest.nummern || {}; manifest.nummern[name] = def; nummerAlsZustand(name, def); }); }
    };
    function auf(name, fn) { (handler[name] = handler[name] || []).push(fn); }

    /** Aus einer Nummer wird ein Zustand nummer_<name> (lazy, Bild unter nummern/). */
    function nummerAlsZustand(name, n) {
      manifest.zustaende['nummer_' + name] = {
        datei: n.bild, pfad: 'nummern/' + n.bild, gruppe: 'nummer', kategorie: 'nummer',
        koerper: n.koerper || [0, 0, 1, 1], massstab: n.massstab || 1.15, texte: n.texte || [], lazy: true
      };
    }

    var api = {
      name: opt.name,
      an: an, zeige: zeige, ereignis: ereignis, hinweis: hinweis,
      sage: function (text, dauer) { if (el.blase) sage(text, dauer); },
      setzeAusruestung: setzeAusruestung, setzeModus: setzeModus, setzeRolle: setzeRolle, zerstoere: zerstoere,
      registriere: registriere, auf: auf,
      sichtbar: sichtbar, istSichtbar: function () { return sichtbarIst; }, ladeGespeichert: ladeGespeichert,
      laufe: laufe, setzeX: setzeX, x: function () { return xAnteil; },
      nummer: nummer, nummern: nummernListe, laufendeNummer: function () { return nummerAktiv ? nummerAktiv.name : null; },
      zustand: function () { return aktuell; },
      manifest: function () { return manifest; },
      rolle: function () { return opt.rolle; },
      wurzel: function () { return el.wurzel || null; },
      istAn: function () { return aktiv; },
      hinweisOffen: function () { return hinweisOffen; },
      wartet: function () { return !!wartend; },
      laeuft: function () { return !!lauf; },
      sperre: function (w) { ereignisSperre = !!w; },
      _timerAktiv: timerAktiv
    };

    api.bereit = ladeManifest(opt.basisPfad, opt.manifest).then(function (m) {
      if (zerstoert) return api;
      manifest = m;
      Object.keys(manifest.nummern || {}).forEach(function (n) { nummerAlsZustand(n, manifest.nummern[n]); });
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
    if (standard) { console.warn('[hamster_figur] init() doppelt — bestehende Figur bleibt'); return standard.bereit; }
    standard = neu(o);
    vorabReg.forEach(function (fn) { fn(standard); }); vorabReg.length = 0;
    vorabAuf.forEach(function (p) { standard.auf(p[0], p[1]); }); vorabAuf.length = 0;
    return standard.bereit;
  }
  function durch(name) { return function () { if (!standard) { console.warn('[hamster_figur] ' + name + '() vor init()'); return; } return standard[name].apply(null, arguments); }; }
  var registriereStandard = {};
  ['zustand', 'ereignis', 'text', 'textSpielplatz', 'gegenstand', 'slot', 'nummer'].forEach(function (art) {
    registriereStandard[art] = function () { var a = arguments; if (standard) standard.registriere[art].apply(null, a); else vorabReg.push(function (s) { s.registriere[art].apply(null, a); }); };
  });

  return {
    neu: neu,
    init: init,
    an: durch('an'), zeige: durch('zeige'), ereignis: durch('ereignis'), hinweis: durch('hinweis'), sage: durch('sage'),
    setzeAusruestung: durch('setzeAusruestung'), setzeModus: durch('setzeModus'), setzeRolle: durch('setzeRolle'),
    sichtbar: durch('sichtbar'), laufe: durch('laufe'), nummer: durch('nummer'),
    zerstoere: function () { if (standard) { standard.zerstoere(); standard = null; } },
    registriere: registriereStandard,
    auf: function (name, fn) { if (standard) standard.auf(name, fn); else vorabAuf.push([name, fn]); },
    zustand: function () { return standard ? standard.zustand() : 'idle'; },
    manifest: function () { return standard ? standard.manifest() : null; },
    sperre: durch('sperre'),
    standard: function () { return standard; }
  };
})();
