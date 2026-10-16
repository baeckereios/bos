/* ================================================================
   BäckereiOS · Host — Farbprofile (Baustelle #72, Stufe B)
   ================================================================
   ZWECK: Die EINE Stelle für die Farbprofile. Kontenverwaltung,
          bos_konto_profil.js und die persönlichen Einstellungen im
          Launcher (Stufe C) lesen nur von hier (E11).

   Ein Profil = Akzent + Grundton der Flächen, je hell und dunkel. Die
   Farbwerte selbst stehen in bos_design_tokens.css als Block
   html[data-farbschema="<id>"] (dunkel) und
   html[data-theme="light"][data-farbschema="<id>"] (hell). Honig ist der
   Grundstand der Tokens und hat KEINEN Block.
   Statusfarben (Rot, Gelb, Grün, Warnung) und Ausgedrucktes (--bos-marke)
   gehören zu keinem Profil.

   NEUES PROFIL (E11, „die Liste bleibt offen“):
     1. hier einen Eintrag in PROFILE (id klein, nur a–z),
     2. in bos_design_tokens.css je einen Block dunkel und hell mit allen
        neun Tokens (siehe dort),
     3. falls es Vorgabe einer Rolle sein soll: in ROLLEN eintragen.
   Sonst nichts. Eine Rolle, die hier fehlt (z. B. neu angelegt), bekommt
   Honig.

   WIRKSAMES PROFIL — wirksam({ eigeneWahl, konto, rolle }):
     eigene Wahl (Einstellungen, profileData.farbschema; Stufe C seit
     16.10.2026) > Feld farbschema am Konto
     > Profil der Rolle > Honig. Eine leere oder unbekannte ID fällt auf
     die nächste Stufe zurück. Das Ergebnis ist IMMER eine gültige ID.
     Ohne Haken „freigeschaltet“ übergibt bos_konto_profil.js weder Konto
     noch Rolle, es gilt also Honig.

   EINBINDUNG: vor bos_konto_profil.js (index.html, launcher.html) bzw.
   vor dem Seitencode (konten/konten_verwaltung.html). bos_theme_sync.js
   braucht diese Datei NICHT — er liest das fertige Profil aus dem
   Profileintrag.

   CHANGELOG
     2026-10-15 · 19:56 · v1 · Erstfassung (Farbprofile Stufe B, Freigabe
       Kontroll-Chat 18:48). Acht Profile (E8), Rollen-Vorgabe (E10, E11).
       SESSION_2026-10-15_FARBSCHEMA_STUFE_B_BAU.md
     2026-10-16 · 07:54 · nur Kommentar (Stufe C): eigene Wahl ist jetzt
       belegt, gerechnet in bos_konto_profil.js → setzeFarbschema().
       SESSION_2026-10-16_EINSTELLUNGEN_FUER_ALLE_BAU.md
   ================================================================ */

window.BOS_FARBPROFILE = (function () {
  'use strict';

  var STANDARD = 'honig';

  /* Reihenfolge = Reihenfolge im Auswahlfeld. tupfer = Akzent dunkel. */
  var PROFILE = [
    { id: 'honig',    name: 'Honig',    tupfer: '#c07a10' },
    { id: 'zitrone',  name: 'Zitrone',  tupfer: '#d8d65a' },
    { id: 'apfel',    name: 'Apfel',    tupfer: '#9bcf4a' },
    { id: 'stahl',    name: 'Stahl',    tupfer: '#6cb4e4' },
    { id: 'lavendel', name: 'Lavendel', tupfer: '#9b8cf2' },
    { id: 'orchidee', name: 'Orchidee', tupfer: '#d46ee0' },
    { id: 'himbeere', name: 'Himbeere', tupfer: '#e0679a' },
    { id: 'kreide',   name: 'Kreide',   tupfer: '#d8c9ad' }
  ];

  /* Vorgabe je Rolle (Anweisung Stufe B §3). Azubis haben keine eigene
     Rolle, sie bekommen Apfel per Auswahl am Konto. */
  var ROLLEN = {
    backstube: 'honig',
    konditorei: 'himbeere',
    verkauf: 'zitrone',
    kommissionierung: 'kreide',
    fahrer: 'kreide',
    verkaufsleitung: 'lavendel',
    produktionsleitung: 'lavendel',
    haustechnik: 'stahl',
    admin: 'orchidee'
  };

  function profil(id) {
    for (var i = 0; i < PROFILE.length; i++) if (PROFILE[i].id === id) return PROFILE[i];
    return null;
  }
  function gueltig(id) { return typeof id === 'string' && !!profil(id); }
  function ausRolle(rolle) {
    var id = (typeof rolle === 'string' && Object.prototype.hasOwnProperty.call(ROLLEN, rolle)) ? ROLLEN[rolle] : null;
    return gueltig(id) ? id : STANDARD;
  }
  function wirksam(arg) {
    arg = arg || {};
    if (gueltig(arg.eigeneWahl)) return arg.eigeneWahl;
    if (gueltig(arg.konto)) return arg.konto;
    return ausRolle(arg.rolle);
  }
  function liste() { return PROFILE.slice(); }
  function name(id) { var p = profil(id); return p ? p.name : null; }

  return {
    STANDARD: STANDARD,
    liste: liste,
    profil: profil,
    name: name,
    gueltig: gueltig,
    ausRolle: ausRolle,
    wirksam: wirksam,
    rollen: function () { var k = {}; Object.keys(ROLLEN).forEach(function (r) { k[r] = ROLLEN[r]; }); return k; }
  };
})();
