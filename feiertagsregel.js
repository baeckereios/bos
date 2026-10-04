/* ============================================================
   feiertagsregel.js — BäckereiOS SchichtPlaner
   ------------------------------------------------------------
   EINE gemeinsame, reine Funktion für die Zählregel E9
   (SCHICHTPLANER_V2_FEIERTAG_SONNTAG_REGELN.md): Wie viele freie Tage
   stehen einer Person in einer Feiertagswoche zu (Soll), wie viele davon
   deckt ein freier Feiertag schon ab, und wie viele muss die Rotation noch
   verteilen (Rest)?

   Genutzt von entwuerfe.html (Soll je Person für die Suche) und
   wunschtag.html (persönlicher Hinweis zum Wunschtag, E22). Beide Seiten
   rechnen damit garantiert dasselbe.

   Bewusst eine EIGENE kleine Datei, nicht in freie_tage_verteilung.js
   oder bos_zeitkontext.js:
   - wunschtag.html ist eine Kollegen-Seite; sie soll nicht den ganzen
     Rechenkern (plus rechenmodul.js) laden, um eine Zahl zu zeigen.
   - bos_zeitkontext.js ist ein Firestore-Modul, das in vielen Satelliten
     hängt; eine Regeländerung dort träfe alle.
   - Reine Funktion ohne Abhängigkeiten, ohne Firestore, ohne DOM: in Node
     direkt testbar, im Browser ohne Ladereihenfolge-Fragen.
   Die Kern-Datei (rotationsplaetze) rechnet den Rest weiter selbst aus
   den Ereignissen; test_feiertagsregel.js prüft, dass beide für alle
   Zeilen der Tabelle 4.2 übereinstimmen.

   Eingabe (Aufrufer liefert nur Feiertage Mo-Sa; E17 -- ein Feiertag auf
   dem Sonntag zählt nicht -- ist Sache des Aufrufers, der die Woche kennt):
     feiertage:          [{ datum, offen, eingeteilt: [personId, ...] }]
                         eingeteilt = wer laut Sonntagsplan am Feiertag
                         arbeitet; bei geschlossenem Feiertag ignoriert (E5:
                         dort arbeitet niemand)
     sonntagEingeteilt:  [personId, ...] laut Sonntagsplan für den Sonntag
                         der Woche
   Ausgabe: { feiertagswoche, soll, freieFeiertage, rest, arbeitetFeiertag:
              [datum...], arbeitetSonntag }

   2026-09-23 · 10:39 · v0.1 · Feature (O40)
   2026-09-24 · 08:43 · v0.2 · Feature (E25, Teil 1)
     rotationsStatus(person) / ausserhalbDerRotation(person): das Kriterium
     "außerhalb der Rotation", inhaltlich gleich nimmtGrundsaetzlichTeil()
     im Rechenkern (freie_tage_verteilung.js), dieselbe Reihenfolge der
     Prüfungen. Der Kern bleibt unverändert; test_feiertagsregel.js prüft
     den Gleichlauf über rotationspersonen() (ohne Ereignisse).
     Zusätzlich der Grund, weil die Texte je Grund verschieden sein
     müssen (E25: "Deine Woche" nur, wo arbeitstage die Woche wirklich
     beschreiben).
   ============================================================ */
(function (global) {
  function sollUndRest(personId, eingabe) {
    var feiertage = (eingabe && eingabe.feiertage) || [];
    var sonntag = (eingabe && eingabe.sonntagEingeteilt) || [];
    var arbeitetFeiertag = feiertage.filter(function (f) {
      return f.offen && (f.eingeteilt || []).indexOf(personId) !== -1;
    }).map(function (f) { return f.datum; });
    var arbeitetSonntag = sonntag.indexOf(personId) !== -1;
    if (!feiertage.length) {
      // Keine Feiertagswoche: die normale Rotation, ein freier Tag.
      return { feiertagswoche: false, soll: 1, freieFeiertage: 0, rest: 1, arbeitetFeiertag: [], arbeitetSonntag: arbeitetSonntag };
    }
    // E9: so viele freie Tage wie Feiertage Mo-Sa, mindestens einer, plus
    // einer bei Sonntagsarbeit in der Feiertagswoche.
    var soll = Math.max(1, feiertage.length) + (arbeitetSonntag ? 1 : 0);
    var freieFeiertage = feiertage.length - arbeitetFeiertag.length;
    return {
      feiertagswoche: true,
      soll: soll,
      freieFeiertage: freieFeiertage,
      rest: Math.max(0, soll - freieFeiertage),
      arbeitetFeiertag: arbeitetFeiertag,
      arbeitetSonntag: arbeitetSonntag
    };
  }

  /**
   * E25 (24.09.2026): Steht die Person außerhalb der Rotation, und warum?
   * Gleiche Prüfungen, gleiche Reihenfolge wie nimmtGrundsaetzlichTeil()
   * im Kern:
   *   'inaktiv'                   aktiv === false (bzw. nicht wahr)
   *   'azubiNichtEinsatzfaehig'   status 'azubi' ohne einsatzfaehig
   *   'keinRotierenderFreierTag'  explizites Personen-Merkmal
   *   'festeArbeitstage'          arbeitstage mit höchstens 5 Einträgen
   * Liefert { ausserhalb, grund } -- grund null, wenn die Person rotiert.
   */
  function rotationsStatus(p) {
    if (!p) return { ausserhalb: false, grund: null };
    if (!p.aktiv) return { ausserhalb: true, grund: 'inaktiv' };
    if (p.status === 'azubi' && !p.einsatzfaehig) return { ausserhalb: true, grund: 'azubiNichtEinsatzfaehig' };
    if (p.keinRotierenderFreierTag) return { ausserhalb: true, grund: 'keinRotierenderFreierTag' };
    if (p.arbeitstage && p.arbeitstage.length <= 5) return { ausserhalb: true, grund: 'festeArbeitstage' };
    return { ausserhalb: false, grund: null };
  }
  function ausserhalbDerRotation(p) { return rotationsStatus(p).ausserhalb; }

  var api = { sollUndRest: sollUndRest, rotationsStatus: rotationsStatus, ausserhalbDerRotation: ausserhalbDerRotation, FASSUNG: 'E9 (23.09.2026), E25 (24.09.2026)' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BOS_FEIERTAGSREGEL = api;
})(typeof window !== 'undefined' ? window : this);
