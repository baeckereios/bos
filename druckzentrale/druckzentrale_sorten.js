/* ============================================================
   druckzentrale/druckzentrale_sorten.js — feste Sorten der Druckzettel
   ------------------------------------------------------------
   EINE Stelle für Kennung und Namen der festen Zeilen auf dem
   Frühschicht- und dem Absetz-Formular. Jedes Formular führt nur
   noch seine eigene REIHENFOLGE als Liste von Kennungen; der Name
   kommt immer von hier. So können die beiden Zettel nicht mehr
   auseinanderlaufen (Befund 08.11.2026: „Schokocroissant“ gegen
   „Schokocroissants“, `schokocroissant` gegen `schoko`).

   Einbindung (Formular im selben Ordner):
     <script src="druckzentrale_sorten.js"></script>

   Aufruf:
     BOS_DRUCKZENTRALE_SORTEN.liste          // alle Einträge, feste Reihenfolge
     BOS_DRUCKZENTRALE_SORTEN.sorte('schoko') // → { kennung, name, stikke, trennung }
     BOS_DRUCKZENTRALE_SORTEN.name('schoko')  // → 'Schokocroissants'
   Unbekannte Kennung → Error mit Klartext (nie still leer).

   Feld `stikke`: true = die Sorte wird abgesetzt und kommt auf die
   Stikken-Verteilung (bos_stikken.js). Ulf 08.11.2026, 06:43/06:49:
   Käsebrötchen, Mohn/Sesam und Extra-Zeilen kommen NICHT auf die
   Stikken. Mohn/Sesam steht nicht in dieser Liste (Doppelfeld,
   eigene Form auf beiden Zetteln).

   Feld `trennung` (seit 14.11.2026, Stufe 2a; Ulf 06:43: „Silbentrennung ist
   für mich wichtig“): die EINZIGEN Stellen, an denen die Stikken-Zeichnung
   den Namen umbrechen darf, mit „|“ markiert. Mitten im Wort erscheint
   beim Umbruch ein Strich („Schoko-“ / „croissants“), nach einem echten
   Bindestrich nichts zusätzlich. Ohne „|“ muss es genau der Name sein,
   sonst wird die Trennung ignoriert (Hinweis im Formular, kein Druckstopp).
   Stellschraube: Trennstellen hier ändern. Nur die Zeichnung nutzt das Feld;
   Namen in Texten und auf Seite 1 bleiben ohne Trennzeichen.

   Schreibweise: Ulf 08.11.2026, ~06:49 — Mehrzahl, „Mini-“ mit
   Bindestrich. Neue Sorte: hier eintragen, dann die Kennung in der
   REIHENFOLGE des Formulars ergänzen. Die DOM-IDs der Formulare
   hängen an der Kennung (fh-<kennung>, af-<kennung>-so/-mo).

   Kein Firebase, kein DOM. In Node mit require() ladbar
   (_PRUEF_stikken.js prüft Liste und Formulare dagegen).

   CHANGELOG
     2026-11-14 · 07:19 · v1.1 · Feature
       Feld `trennung` je Sorte (Stufe 2a, Anweisung KC 14.11., 06:50,
       Go 07:00). SESSION_2026-11-14_STIKKEN_2A_BAU.md
     2026-11-10 · 08:13 · v1.0 · Feature
       Erstfassung (Stikken-Verteilung, Go Kontroll-Chat 10.11., 07:57).
       SESSION_2026-11-08_STIKKEN_VERTEILUNG_BAU.md
   ============================================================ */

(function (global) {
  'use strict';

  var LISTE = [
    { kennung: 'butter',     name: 'Buttercroissants',      stikke: true,  trennung: 'Butter|croissants' },
    { kennung: 'schoko',     name: 'Schokocroissants',      stikke: true,  trennung: 'Schoko|croissants' },
    { kennung: 'laugen',     name: 'Laugenecken',           stikke: true,  trennung: 'Laugen|ecken' },
    { kennung: 'minibutter', name: 'Mini-Buttercroissants', stikke: true,  trennung: 'Mini-|Butter|croissants' },
    { kennung: 'minischoko', name: 'Mini-Schokocroissants', stikke: true,  trennung: 'Mini-|Schoko|croissants' },
    { kennung: 'kaese',      name: 'Käsebrötchen belegen',  stikke: false, trennung: 'Käse|brötchen belegen' }
  ];
  LISTE.forEach(function (e) { if (Object.freeze) Object.freeze(e); });
  if (Object.freeze) Object.freeze(LISTE);

  function sorte(kennung) {
    for (var i = 0; i < LISTE.length; i++) {
      if (LISTE[i].kennung === kennung) return LISTE[i];
    }
    throw new Error('Sortenliste: Kennung „' + kennung + '“ ist unbekannt ' +
                    '(druckzentrale_sorten.js). Bekannt: ' +
                    LISTE.map(function (e) { return e.kennung; }).join(', ') + '.');
  }

  function name(kennung) { return sorte(kennung).name; }

  var api = { liste: LISTE, sorte: sorte, name: name };
  if (Object.freeze) Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_DRUCKZENTRALE_SORTEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
