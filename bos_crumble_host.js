/* ================================================================
   BäckereiOS · Host — Crumble im Launcher (Brücke, #62 Stufe 1c)
   ================================================================
   Neu 17.10.2026 (Bau-Chat Crumble; Stufe 1 06:49, Nachtrag 1 08:09,
   Stufe 1c 09:37). Verdrahtet die Hamster-Figur (hamster_figur/
   hamster_figur.js, Modul ohne Firestore-/localStorage-Wissen) mit dem Launcher:

     1. SCHREIBTISCH-CRUMBLE (Stufe 1c, E11): eine eigene Bühne (fixed, Ebene 300,
        Geschwister direkt hinter dem übergebenen Schreibtisch-Element, gleiche
        Lage wie .bos-windows-layer) — über den Kacheln (Schreibtisch = Ebene 0),
        unter den Fenstern (400). Darin die Figur: Rolle 'lehrmeister', Modus
        'ecke', Einbettung 'schreibtisch', bleibt, läuft, spielt Nummern, ist
        schiebbar. Warum nicht IM Schreibtisch: .bos-desktop ist ein Scroll-
        Container (overflow:auto) mit Padding — ein Kind darin scrollte mit den
        Kacheln weg und stünde 26 px über der Taskleiste (Bauplan 1c §1, T5).
     2. KNOPF in der Kopfleiste (eigenes kleines Element dieses Hosts, 40 px,
        Kopfbild): zeigt/versteckt die Figur (sichtbar), NICHT An/Aus. Oranger
        Punkt, wenn ein Hinweis oder Ereignis im Versteck wartet.
     3. Figur im Bildschirmschoner (Rolle 'spielplatz', Einbettung 'container',
        läuft und spielt Nummern) — Fabrik an BOS_SCREENSAVER.setzeFigur().
     4. Begrüßung bei Profil-Aktivierung mit der Zahl offener Aufgaben aus
        'bos:aufgaben' (bos_taskboard.js); vorher neuLaden() (Nachtrag 1, K23).
     5. Aufgaben-Regeln: viel_offen ab Schwelle (einmal), alles_erledigt nur
        beim echten letzten Abhaken, Fehler/gesperrt → nichts.
     6. Ein/Aus (Profil-Feld hamster, fehlt = an): setzeAn(wert) wirkt auf
        Schreibtisch, Knopf und Schoner — der Hauptschalter (T2).
     7. SPEICHER je Gerät und Profil (localStorage, Schlüssel bos_crumble_<profilId>,
        JSON { sichtbar, x }): Sichtbarkeit und Position auf der Leiste. Kein
        Profil-Sync (K31: keine neuen Sync-Felder). Profil-Id aus
        BOS_PROFIL_LOOKUP.aktivesProfil().id (wie bos_taskboard.js), fehlt sie:
        '_geraet'. localStorage in try/catch (PWA/Privatmodus).

   launcher.html kennt nur: BOS_CRUMBLE_HOST.start({ an, basisPfad, topbar, vor,
   schreibtisch }) in applyProfileUI() und BOS_CRUMBLE_HOST.setzeAn(wert) aus
   der Einstellungs-Zeile.

   Fehlende Bilder / Manifest: Crumble bleibt still (Kompendium T4), Fehler in
   der Konsole und als 'hamster-figur:fehler' auf document.

   Abhängigkeiten (alle optional, lazy): hamster_figur/hamster_figur.js,
   bos_screensaver.js (setzeFigur/figurAn), bos_taskboard.js (bos:aufgaben,
   neuLaden), bos_profil_lookup.js (Profil-Id für den Speicher).

   CHANGELOG
     2026-10-17 · 09:37 · Stufe 1c (K25, K26, K30, K31): Schreibtisch-Bühne statt
       Knopf-Modus in der Kopfleiste; eigener Knopf = zeigen/verstecken mit
       Wartepunkt; Speicher je Gerät/Profil; Schoner-Figur läuft und spielt
       Nummern; knopf() bleibt als Alias für figur().
     2026-10-17 · 08:09 · Nachtrag 1 (K23): start() vergisst letzteAufgaben und
       ruft BOS_TASKBOARD.neuLaden().
     2026-10-17 · 06:49 · Erstfassung (Crumble Stufe 1, K15–K18).
   ================================================================ */
window.BOS_CRUMBLE_HOST = (function () {
  'use strict';

  var WARTE_MS = 2500;          // so lange warten wir auf 'bos:aufgaben', bevor wir ohne Zahl grüßen
  var NACH_GRUSS_MS = 6500;     // viel_offen erst nach der Begrüßung (reaktion_ms 5500 + Luft)
  var SCHWELLE_VORGABE = 5;
  var HOEHE_SCHREIBTISCH = 170, HOEHE_SCHONER = 240;

  var figur = null;             // Figur auf dem Schreibtisch (Lehrmeister)
  var schoner = null;           // Figur im Schoner (legt der Schoner selbst an)
  var buehne = null, knopfEl = null;
  var an = true;
  var optionen = null;
  var letzteAufgaben = null;
  var wartetAufZahl = false, tWarten = null, grussLaeuftBis = 0;
  var vielGemeldet = false;

  function figurModul() { return window.BOS_HAMSTER_FIGUR || null; }
  function profilId() {
    try { var p = window.BOS_PROFIL_LOOKUP && window.BOS_PROFIL_LOOKUP.aktivesProfil ? window.BOS_PROFIL_LOOKUP.aktivesProfil() : null; return (p && p.id) ? String(p.id) : '_geraet'; }
    catch (e) { return '_geraet'; }
  }
  var speicher = {
    lese: function () { try { var raw = localStorage.getItem('bos_crumble_' + profilId()); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } },
    schreibe: function (o) { try { localStorage.setItem('bos_crumble_' + profilId(), JSON.stringify(o || {})); } catch (e) {} }
  };

  function schwelle() {
    var m = figur && figur.manifest ? figur.manifest() : null;
    var s = m && m.verhalten ? m.verhalten.aufgaben_schwelle : null;
    return typeof s === 'number' && s > 0 ? s : SCHWELLE_VORGABE;
  }

  /* ---------- Begrüßung ---------- */
  function begruesseMit(detail) {
    clearTimeout(tWarten); tWarten = null; wartetAufZahl = false;
    if (!figur) return;
    var o = {};
    if (detail && !detail.fehler && !detail.gesperrt && typeof detail.offen === 'number') o.n = detail.offen;
    figur.ereignis('app_geoeffnet', o);
    grussLaeuftBis = Date.now() + NACH_GRUSS_MS;
  }
  function begruesse() {
    clearTimeout(tWarten);
    if (letzteAufgaben) { begruesseMit(letzteAufgaben); return; }
    wartetAufZahl = true;
    tWarten = setTimeout(function () { if (wartetAufZahl) begruesseMit(null); }, WARTE_MS);
  }

  /* ---------- Aufgaben-Regeln ---------- */
  function aufAufgaben(e) {
    var d = e && e.detail ? e.detail : null;
    if (!d) return;
    letzteAufgaben = d;
    if (wartetAufZahl) begruesseMit(d);
    if (!figur || d.fehler || d.gesperrt) return;
    var offen = typeof d.offen === 'number' ? d.offen : 0;
    var vorher = typeof d.vorher === 'number' ? d.vorher : null;
    if (offen >= schwelle()) {
      if (!vielGemeldet) {
        vielGemeldet = true;
        var verzug = Math.max(0, grussLaeuftBis - Date.now());
        setTimeout(function () { if (figur) figur.ereignis('viel_offen', { n: offen }); }, verzug);
      }
    } else {
      vielGemeldet = false;
    }
    if (vorher !== null && vorher > 0 && offen === 0) figur.ereignis('alles_erledigt');
  }

  /* ---------- Bühne und Knopf (K25/K26) ---------- */
  function legeBuehneAn() {
    if (buehne || !optionen.schreibtisch) return;
    buehne = document.createElement('div');
    buehne.className = 'hf-buehne-schreibtisch';
    buehne.setAttribute('aria-hidden', 'false');
    optionen.schreibtisch.insertAdjacentElement('afterend', buehne);
    passeBuehneAn();
    window.addEventListener('resize', passeBuehneAn);
  }
  /* Lage der Bühne = Lage des Schreibtisch-Elements (Kopfleiste oben, Taskleiste unten) — so darf #78 die Maße ändern */
  function passeBuehneAn() {
    if (!buehne || !optionen.schreibtisch) return;
    var r = optionen.schreibtisch.getBoundingClientRect();
    var h = window.innerHeight || document.documentElement.clientHeight;
    buehne.style.top = Math.round(r.top) + 'px';
    buehne.style.bottom = Math.round(Math.max(0, h - r.bottom)) + 'px';
    buehne.style.left = Math.round(r.left) + 'px';
    buehne.style.right = Math.round(Math.max(0, (window.innerWidth || document.documentElement.clientWidth) - r.right)) + 'px';
  }
  function legeKnopfAn() {
    if (knopfEl || !optionen.topbar) return;
    knopfEl = document.createElement('button');
    knopfEl.type = 'button';
    knopfEl.className = 'hf-knopf-host';
    knopfEl.title = 'Crumble zeigen/verstecken';
    knopfEl.setAttribute('aria-label', 'Crumble zeigen/verstecken');
    knopfEl.setAttribute('aria-pressed', 'true');
    knopfEl.innerHTML = '<img alt="" draggable="false">';
    knopfEl.querySelector('img').src = optionen.basisPfad + 'bilder/idle.png';
    knopfEl.addEventListener('click', function (e) { e.stopPropagation(); if (figur) figur.sichtbar(!figur.istSichtbar()); });
    if (optionen.vor && optionen.vor.parentNode === optionen.topbar) optionen.topbar.insertBefore(knopfEl, optionen.vor);
    else optionen.topbar.appendChild(knopfEl);
    aktualisiereKnopf();
  }
  function aktualisiereKnopf() {
    if (!knopfEl) return;
    var sichtbar = figur ? figur.istSichtbar() : true;
    var wartet = figur ? figur.wartet() : false;
    knopfEl.classList.toggle('hf-knopf-host--versteckt', !sichtbar);
    knopfEl.classList.toggle('hf-knopf-host--wartet', wartet);
    knopfEl.classList.toggle('hf-knopf-host--aus', !an);
    knopfEl.setAttribute('aria-pressed', sichtbar ? 'true' : 'false');
    knopfEl.title = sichtbar ? 'Crumble verstecken' : (wartet ? 'Crumble zeigen — er hat etwas' : 'Crumble zeigen');
  }

  /* ---------- Anlegen ---------- */
  function legeFigurAn() {
    var M = figurModul();
    if (figur || !M || !optionen || !buehne) return;
    figur = M.neu({
      name: 'lehrmeister', container: buehne, basisPfad: optionen.basisPfad,
      modus: 'ecke', einbettung: 'schreibtisch', rolle: 'lehrmeister',
      hoehe: optionen.hoeheSchreibtisch || HOEHE_SCHREIBTISCH, an: an, zufall: false,
      laufen: true, nummern: true, schiebbar: true, speicher: speicher
    });
    ['sichtbar', 'wartet', 'hinweis', 'hinweis-gesehen', 'zustand'].forEach(function (n) { figur.auf(n, aktualisiereKnopf); });
    figur.bereit.then(aktualisiereKnopf).catch(function (e) { console.error('[crumble] Schreibtisch-Crumble nicht ladbar: ' + (e && e.message ? e.message : e)); });
  }
  function fabrikSchoner(container) {
    var M = figurModul();
    if (!M) return null;
    schoner = M.neu({
      name: 'spielplatz', container: container, basisPfad: optionen.basisPfad,
      modus: 'ecke', einbettung: 'container', rolle: 'spielplatz',
      hoehe: optionen.hoeheSchoner || HOEHE_SCHONER, an: an, zufall: false,
      laufen: true, nummern: true, schiebbar: false
    });
    schoner.bereit.catch(function (e) { console.error('[crumble] Schoner-Crumble nicht ladbar: ' + (e && e.message ? e.message : e)); });
    return schoner;
  }

  var gestartet = false;
  /**
   * start({ an, basisPfad, topbar, vor, schreibtisch, hoeheSchreibtisch, hoeheSchoner })
   * Bei jeder Profil-Aktivierung aufrufen (dort, wo BOS_SCREENSAVER.start() steht).
   * Erster Aufruf legt Bühne, Knopf und Figur an; jeder Aufruf setzt Ein/Aus, liest den
   * Speicher des (neuen) Profils und begrüßt genau einmal.
   */
  function start(o) {
    optionen = Object.assign({ basisPfad: 'hamster_figur/', an: true }, o || {});
    if (!figurModul()) { console.warn('[crumble] hamster_figur.js nicht geladen — Crumble bleibt aus'); return; }
    an = optionen.an !== false;
    if (!gestartet) {
      gestartet = true;
      document.addEventListener('bos:aufgaben', aufAufgaben);
      if (window.BOS_SCREENSAVER && typeof window.BOS_SCREENSAVER.setzeFigur === 'function') window.BOS_SCREENSAVER.setzeFigur(fabrikSchoner);
    }
    legeBuehneAn();
    legeKnopfAn();
    legeFigurAn();
    if (figur) { figur.bereit.then(function () { figur.ladeGespeichert(); aktualisiereKnopf(); }); }
    setzeAn(an);
    // K23 (Nachtrag 1): nichts vom vorherigen Profil übernehmen, Brett frisch laden
    letzteAufgaben = null;
    vielGemeldet = false;
    if (window.BOS_TASKBOARD && typeof window.BOS_TASKBOARD.neuLaden === 'function') {
      try { var p = window.BOS_TASKBOARD.neuLaden(); if (p && p.catch) p.catch(function () {}); }
      catch (e) { console.warn('[crumble] BOS_TASKBOARD.neuLaden', e); }
    }
    begruesse();
  }

  /** Ein/Aus für alles (Profil-Feld hamster) — der Hauptschalter. */
  function setzeAn(wert) {
    an = wert !== false;
    if (figur) figur.an(an);
    if (window.BOS_SCREENSAVER && typeof window.BOS_SCREENSAVER.figurAn === 'function') window.BOS_SCREENSAVER.figurAn(an);
    else if (schoner) schoner.an(an);
    aktualisiereKnopf();
  }

  return {
    start: start,
    setzeAn: setzeAn,
    istAn: function () { return an; },
    figur: function () { return figur; },
    knopf: function () { return figur; },          // Alias (Stufe 1: Knopf-Crumble); seit 1c die Schreibtisch-Figur
    knopfElement: function () { return knopfEl; },
    buehne: function () { return buehne; },
    schoner: function () { return schoner; },
    /* nur für Prüfwerkzeuge */
    _zustand: function () { return { an: an, wartetAufZahl: wartetAufZahl, vielGemeldet: vielGemeldet, letzteAufgaben: letzteAufgaben, profilId: profilId() }; }
  };
})();
