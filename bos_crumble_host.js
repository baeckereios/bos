/* ================================================================
   BäckereiOS · Host — Crumble im Launcher (Brücke, #62 Stufe 1)
   ================================================================
   Neu 17.10.2026 (Bau-Chat Crumble; Anweisung Kontroll-Chat 06:00,
   Bauplan 06:18 F5). Verdrahtet die Hamster-Figur (hamster_figur/
   hamster_figur.js, Modul ohne Firestore-Wissen) mit dem Launcher:

     1. Ruf-Knopf in der Kopfleiste (Rolle 'lehrmeister', Modus 'knopf',
        Einbettung 'oben') — wird vor dem übergebenen Element eingesetzt
        (launcher.html: vor .bos-topbar__clockwrap).
     2. Figur im Bildschirmschoner (Rolle 'spielplatz', Einbettung
        'container') — als Fabrik an BOS_SCREENSAVER.setzeFigur() gegeben,
        der Schoner legt sie lazy beim ersten Erscheinen an.
     3. Begrüßung bei Profil-Aktivierung: ereignis('app_geoeffnet', { n })
        mit der Zahl offener Aufgaben, wenn 'bos:aufgaben' (bos_taskboard.js)
        binnen WARTE_MS kommt — sonst ohne Zahl. NIE zweimal je Aktivierung.
     4. Aufgaben-Regeln aus 'bos:aufgaben':
        - offen >= Schwelle (Manifest verhalten.aufgaben_schwelle, Vorgabe 5)
          → ereignis('viel_offen', { n }) — EINMAL, bis die Zahl wieder unter
          die Schwelle fällt (sonst schwitzt er alle 5 Minuten neu).
        - vorher > 0 && offen === 0 → ereignis('alles_erledigt') — die
          Sonnenbrille gibt es nur, wenn wirklich jemand die letzte Aufgabe
          abgehakt hat, nicht beim Start mit leerer Liste (vorher === null).
        - fehler oder gesperrt gesetzt → nichts (das Taskboard zeigt den
          Grund selbst, 27.09.2026).
     5. Ein/Aus (Profil-Feld hamster, fehlt = an): setzeAn(wert) wirkt sofort
        auf Knopf UND Schoner (ein Schalter für beides, Kompendium T2).

   Warum eine eigene Datei statt Inline-Code in launcher.html (Bauplan F5):
   Die Regeln unter 4. müssen ausführbar geprüft werden (Prüffall 10 der
   Anweisung); launcher.html läuft nur mit Firebase, Registry und Profilen.
   Außerdem #79 (Launcher zerlegen). launcher.html kennt nur zwei Aufrufe:
   BOS_CRUMBLE_HOST.start({...}) und BOS_CRUMBLE_HOST.setzeAn(wert).

   Fehlende Bilder / fehlendes Manifest: Crumble bleibt still (bewusste,
   benannte Ausnahme von "jeder Fehler sichtbar" — Kompendium T4: der Hamster
   ist Ambiente, keine Berechnung). Der Fehler steht in der Konsole und als
   CustomEvent 'hamster-figur:fehler' auf document; die Prüfseite zeigt ihn.

   Abhängigkeiten (Reihenfolge egal, alles wird erst in start() angefasst):
   - hamster_figur/hamster_figur.js (window.BOS_HAMSTER_FIGUR) — fehlt es,
     tut diese Datei nichts außer einer Konsolenwarnung.
   - bos_screensaver.js (window.BOS_SCREENSAVER.setzeFigur/figurAn) — optional.
   - bos_taskboard.js (Ereignis 'bos:aufgaben') — optional.

   CHANGELOG
     2026-10-17 · 08:09 · Nachtrag 1 (K23, N-C): start() vergisst letzteAufgaben und
       vielGemeldet und ruft BOS_TASKBOARD.neuLaden() — Profilwechsel grüßt nie mit
       der Zahl des Vorgängers, gesperrte Konten ohne Zahl. Beim allerersten Start
       lädt das Brett dadurch zweimal (init + neuLaden) — ein Lesezugriff mehr, bewusst.
     2026-10-17 · 06:49 · Erstfassung (Crumble Stufe 1, K15–K18).
   ================================================================ */
window.BOS_CRUMBLE_HOST = (function () {
  'use strict';

  var WARTE_MS = 2500;          // so lange warten wir auf 'bos:aufgaben', bevor wir ohne Zahl grüßen
  var NACH_GRUSS_MS = 6500;     // viel_offen erst nach der Begrüßung (reaktion_ms 5500 + Luft)
  var SCHWELLE_VORGABE = 5;

  var knopf = null;             // Figur in der Kopfleiste
  var schoner = null;           // Figur im Schoner (legt der Schoner selbst an, wir merken sie uns)
  var an = true;
  var optionen = null;
  var letzteAufgaben = null;    // letztes detail von 'bos:aufgaben'
  var wartetAufZahl = false, tWarten = null, grussLaeuftBis = 0;
  var vielGemeldet = false;

  function figurModul() { return window.BOS_HAMSTER_FIGUR || null; }

  function schwelle() {
    var m = knopf && knopf.manifest ? knopf.manifest() : null;
    var s = m && m.verhalten ? m.verhalten.aufgaben_schwelle : null;
    return typeof s === 'number' && s > 0 ? s : SCHWELLE_VORGABE;
  }

  /* ---------- Begrüßung ---------- */
  function begruesseMit(detail) {
    clearTimeout(tWarten); tWarten = null; wartetAufZahl = false;
    if (!knopf) return;
    var o = {};
    if (detail && !detail.fehler && !detail.gesperrt && typeof detail.offen === 'number') o.n = detail.offen;
    knopf.ereignis('app_geoeffnet', o);
    grussLaeuftBis = Date.now() + NACH_GRUSS_MS;
  }
  function begruesse() {
    clearTimeout(tWarten);
    if (letzteAufgaben) { begruesseMit(letzteAufgaben); return; }   // Zahl ist schon da (Taskboard war schneller)
    wartetAufZahl = true;
    tWarten = setTimeout(function () { if (wartetAufZahl) begruesseMit(null); }, WARTE_MS);
  }

  /* ---------- Aufgaben-Regeln ---------- */
  function aufAufgaben(e) {
    var d = e && e.detail ? e.detail : null;
    if (!d) return;
    letzteAufgaben = d;
    if (wartetAufZahl) begruesseMit(d);
    if (!knopf || d.fehler || d.gesperrt) return;
    var offen = typeof d.offen === 'number' ? d.offen : 0;
    var vorher = typeof d.vorher === 'number' ? d.vorher : null;
    if (offen >= schwelle()) {
      if (!vielGemeldet) {
        vielGemeldet = true;
        var verzug = Math.max(0, grussLaeuftBis - Date.now());
        setTimeout(function () { if (knopf) knopf.ereignis('viel_offen', { n: offen }); }, verzug);
      }
    } else {
      vielGemeldet = false;
    }
    if (vorher !== null && vorher > 0 && offen === 0) knopf.ereignis('alles_erledigt');
  }

  /* ---------- Anlegen ---------- */
  function legeKnopfAn() {
    var M = figurModul();
    if (knopf || !M || !optionen || !optionen.topbar) return;
    knopf = M.neu({
      name: 'lehrmeister', container: optionen.topbar, vor: optionen.vor || null,
      basisPfad: optionen.basisPfad, modus: 'knopf', einbettung: 'oben', rolle: 'lehrmeister',
      hoehe: optionen.hoeheKnopf || 150, an: an, zufall: false
    });
    knopf.bereit.catch(function (e) { console.error('[crumble] Knopf-Crumble nicht ladbar: ' + (e && e.message ? e.message : e)); });
  }
  function fabrikSchoner(container) {
    var M = figurModul();
    if (!M) return null;
    schoner = M.neu({
      name: 'spielplatz', container: container, basisPfad: optionen.basisPfad,
      modus: 'ecke', einbettung: 'container', rolle: 'spielplatz',
      hoehe: optionen.hoeheSchoner || 240, an: an, zufall: false
    });
    schoner.bereit.catch(function (e) { console.error('[crumble] Schoner-Crumble nicht ladbar: ' + (e && e.message ? e.message : e)); });
    return schoner;
  }

  var gestartet = false;
  /**
   * start({ an, basisPfad, topbar, vor, hoeheKnopf, hoeheSchoner })
   * Bei jeder Profil-Aktivierung aufrufen (dort, wo BOS_SCREENSAVER.start() steht).
   * Erster Aufruf legt an; jeder Aufruf setzt Ein/Aus und begrüßt genau einmal.
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
    legeKnopfAn();
    setzeAn(an);
    // K23 (Nachtrag 1, N-C): nichts vom vorherigen Profil übernehmen — das Brett lädt sonst nur alle 5 Minuten,
    // ein gesperrtes Konto bekäme bis dahin die Aufgabenzahl des Vorgängers in die Begrüßung.
    letzteAufgaben = null;
    vielGemeldet = false;
    if (window.BOS_TASKBOARD && typeof window.BOS_TASKBOARD.neuLaden === 'function') {
      try { var p = window.BOS_TASKBOARD.neuLaden(); if (p && p.catch) p.catch(function () {}); }
      catch (e) { console.warn('[crumble] BOS_TASKBOARD.neuLaden', e); }
    }
    begruesse();
  }

  /** Ein/Aus für beide Figuren (Profil-Feld hamster). */
  function setzeAn(wert) {
    an = wert !== false;
    if (knopf) knopf.an(an);
    if (window.BOS_SCREENSAVER && typeof window.BOS_SCREENSAVER.figurAn === 'function') window.BOS_SCREENSAVER.figurAn(an);
    else if (schoner) schoner.an(an);
  }

  return {
    start: start,
    setzeAn: setzeAn,
    istAn: function () { return an; },
    knopf: function () { return knopf; },
    schoner: function () { return schoner; },
    /* nur für Prüfwerkzeuge */
    _zustand: function () { return { an: an, wartetAufZahl: wartetAufZahl, vielGemeldet: vielGemeldet, letzteAufgaben: letzteAufgaben }; }
  };
})();
