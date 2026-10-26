/* ==========================================================================
   MODUL: bos_kachel_zahlen.js
   ZWECK: Eine Tafel, an die Module ihre Zahl für eine Launcher-Kachel
          schreiben (Nachrichtenzentrale Stufe 1a, Baustelle #131). Der
          Launcher zeigt die Zahl oben rechts am Kachel-Symbol — aber nur an
          Kacheln, deren Registry-Eintrag zaehler: true trägt. Eine
          Mechanik, viele Aufrufer: ab Stufe 1c meldet
          bos_nachrichten_zahl.js hier die ungelesenen Nachrichten; jeder
          weitere Satellit, der eine Zahl will, setzt nur das Registry-Feld
          und ruft setze().

   WARUM: Ulf will die Zahl direkt an der Kachel, nicht in der Taskleiste
          (26.10.2026, 15:33: „Direkt am Symbol … So können wir die andere
          Stelle für andere Sachen freihalten“). Vorbild für Aussehen und
          Logik ist die Zahl am Taskleisten-Knopf (bos_taskboard.js,
          renderBadge: „99+“ ab 100).

   API (window.BOS_KACHEL_ZAHLEN)
     setze(appId, zahl)   merkt die Zahl und zeichnet jede sichtbare Kachel
                          mit dieser id sofort nach. 0, negativ, null, keine
                          Zahl → Zahl verschwindet (Eintrag wird gelöscht).
                          Unbekannte id oder keine Kachel im Raster → nichts,
                          kein Fehler, kein console.error (Normalfall: Modul
                          meldet vor dem Raster, Kachel nicht installiert
                          oder bei dieser Rolle nicht sichtbar).
     lese(appId)          Zahl oder 0 — nie null/undefined.
     alle()               flache Kopie der Tafel { appId: zahl } (nur > 0).
     text(zahl)           '' | '1' … '99' | '99+'  — DIE Formatierstelle.
     fuelle(span, zahl)   setzt textContent und hidden an einem vorhandenen
                          <span class="bos-tile__zahl">; nutzt text().
     zeichne(appId)       sucht .bos-tile[data-id] mit dieser id und ruft
                          fuelle() mit lese(appId). Wird von setze() gerufen.

   LAUNCHER (launcher.html, buildTileEl)
     Baut das <span class="bos-tile__zahl" hidden> nur bei zaehler: true und
     füllt es sofort mit fuelle(span, lese(app.id)) — so überlebt die Zahl
     jedes Neuzeichnen des Rasters (renderGrid bei Resize, storage-Ereignis,
     Profilwechsel, Fenster öffnen/schließen). Fehlt diese Datei (Ladefehler),
     läuft der Launcher ohne Zahlen weiter (window.BOS_KACHEL_ZAHLEN ? … : 0).
     Prüfschalter: launcher.html?kachelzahl=<appId>:<n>[,<appId>:<n>…] ruft
     setze() vor dem ersten Raster.

   GRENZEN (bewusst)
     - Die Tafel prüft zaehler NICHT. Ob eine Zahl erscheint, entscheidet
       allein der Launcher beim Bauen der Kachel (Registry-Feld). lese()
       liefert deshalb auch für fremde ids die gemerkte Zahl — gezeichnet
       wird sie nirgends.
     - appId wird nur verglichen (el.dataset.id === appId), nie in einen
       Selektor und nie in HTML gesetzt.
     - Nichts im Gerätespeicher, keine Datenbank. Nach einem Neuladen ist
       die Tafel leer; die Module melden neu.
     - Hub-Kinder (.bos-hubtile, data-hub-child) kennt die Tafel nicht —
       Zahl an Hub-Kindern wäre ein eigener kleiner Auftrag.

   ABHÄNGIGKEITEN: keine. Läuft auch ohne document (Node-Test): zeichne()
     tut dann nichts.

   CHANGELOG
     2026-10-26 · 17:18 · v1.0 · Neu (Nachrichtenzentrale Stufe 1a; Bauplan
       17:01, Go Kontroll-Chat 17:07 mit Auflagen A1–A4).
       Siehe nachrichtenzentrale/_protokolle/SESSION_2026-10-26_NACHRICHTENZENTRALE_STUFE_1A_BAU.md.
   ========================================================================== */
(function (global) {
  'use strict';

  var tafel = {};

  /* Zahl säubern: alles, was keine positive endliche Zahl ist, wird 0. */
  function sauber(zahl) {
    var n = Number(zahl);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  }

  function text(zahl) {
    var n = sauber(zahl);
    if (n <= 0) return '';
    return n > 99 ? '99+' : String(n);
  }

  function lese(appId) {
    return Object.prototype.hasOwnProperty.call(tafel, appId) ? tafel[appId] : 0;
  }

  function alle() {
    var kopie = {};
    Object.keys(tafel).forEach(function (id) { kopie[id] = tafel[id]; });
    return kopie;
  }

  function fuelle(span, zahl) {
    if (!span) return;
    var t = text(zahl);
    span.textContent = t;
    if (t) span.removeAttribute('hidden'); else span.setAttribute('hidden', '');
  }

  function zeichne(appId) {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var n = lese(appId);
    var kacheln = document.querySelectorAll('.bos-tile[data-id]');
    for (var i = 0; i < kacheln.length; i++) {
      if (kacheln[i].dataset.id !== appId) continue;
      fuelle(kacheln[i].querySelector('.bos-tile__zahl'), n);
    }
  }

  function setze(appId, zahl) {
    if (typeof appId !== 'string' || !appId) return;
    var n = sauber(zahl);
    if (n > 0) tafel[appId] = n; else delete tafel[appId];
    zeichne(appId);
  }

  global.BOS_KACHEL_ZAHLEN = {
    setze: setze,
    lese: lese,
    alle: alle,
    text: text,
    fuelle: fuelle,
    zeichne: zeichne
  };
})(typeof window !== 'undefined' ? window : this);
