/* ============================================================
   plan_laden.js — Produktionsplaner: letzten Stand laden (Schritt 2)
   ------------------------------------------------------------
   Rein rechnend (kein DOM, kein Firestore, in Node prüfbar):
   rechnet die Planung eines Produkts aus einer Einreichung auf das
   „heute“ der Station um, damit eine Station beim Öffnen den letzten
   eingereichten Stand wieder anzeigen kann.

   Die Einreichung speichert zielOff, prodTage, manuelleWerte und
   gesperrtWerte als VERSATZ ab ihrem planungsTag (ohne planungsTag:
   lokales Datum von ts — planungsTagVon() aus bestell_regeln.js, nicht
   nachgebaut). Neuer Versatz = alter Versatz − Tage(planungsTag → heute),
   über lokale Daten mit Math.round (Zeitumstellung!).

   Regeln (Anweisung KC 08.11.2026, 15:58, §4.1; Go 16:07):
   - Backtag mit neuem Versatz < 0, an einem Tag, den die Station heute
     nicht anbietet (geschlossen, Sonntag, außerhalb der Planungswoche),
     fällt weg — mit seinen Hand- und Sperrwerten. Je weggefallenem Tag ein
     Hinweis mit Datum.
   - Ziel mit neuem Versatz ≤ 0 oder nicht unter den Zieltagen der Station
     → kein Ziel, Hinweis.
   - gleichmaessig fehlt in Einreichungen vor Schritt 2 → false.
   Braucht window.BOS_BESTELL_REGELN (bestell_regeln.js) vorher geladen.
   Export: window.BOS_PLAN_LADEN

   CHANGELOG
     2026-11-08 · 16:09 · Erstfassung (Produktionsplaner Schritt 2, Go
       Kontroll-Chat 08.11., 16:07, E1). SESSION_2026-11-08_
       PRODUKTIONSPLANER_LETZTER_STAND_BAU.md
   ============================================================ */
(function (global) {
  'use strict';

  var WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function pad2(n) { return String(n).padStart(2, '0'); }

  function BR() {
    var r = global.BOS_BESTELL_REGELN;
    if (!r) throw new Error('bestell_regeln.js ist nicht geladen (vor plan_laden.js einbinden)');
    return r;
  }
  function tagText(heute, versatz) {
    var d = BR().plusTage(heute, versatz);
    return WT_KURZ[d.getDay()] + ' ' + pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.';
  }

  // Tage vom Planungstag der Einreichung bis heute (lokal, Math.round).
  function verschiebung(einreichung, heute) {
    var pt = BR().planungsTagVon(einreichung);
    if (!pt) return null;
    return BR().tageAbstand(BR().ausIso(pt), heute);
  }

  /* produkt:     einreichung.produkte[legacyKey]
     einreichung: das ganze Dokument (für planungsTag / ts)
     heute:       lokales Datum 00:00 der Station
     angebot:     { backtage: [Versätze, die die Station heute als Backtag anbietet],
                    zieltage: [Versätze der Zielknöpfe] }
     Ergebnis:    { zielOff, prodTage, manuelleWerte, gesperrtWerte, gleichmaessig, hinweise: [Text] }
                  oder { fehler: Text }, wenn kein Planungstag bestimmbar ist. */
  function umrechnen(produkt, einreichung, heute, angebot) {
    var d = verschiebung(einreichung, heute);
    if (d === null) return { fehler: 'Einreichung ohne Planungstag und ohne Zeitstempel — nicht übernommen' };
    var backtage = {}; (angebot && angebot.backtage || []).forEach(function (o) { backtage[o] = true; });
    var zieltage = {}; (angebot && angebot.zieltage || []).forEach(function (o) { zieltage[o] = true; });
    var r = { zielOff: null, prodTage: {}, manuelleWerte: {}, gesperrtWerte: {}, gleichmaessig: produkt.gleichmaessig === true, hinweise: [] };

    // Ziel
    if (typeof produkt.zielOff === 'number') {
      var z = produkt.zielOff - d;
      if (z < 0) r.hinweise.push('Ziel ' + tagText(heute, z) + ' liegt in der Vergangenheit — kein Ziel übernommen');
      else if (z === 0) r.hinweise.push('Ziel ' + tagText(heute, z) + ' ist heute — kein Ziel übernommen');
      else if (!zieltage[z]) r.hinweise.push('Ziel ' + tagText(heute, z) + ' ist heute nicht wählbar — kein Ziel übernommen');
      else r.zielOff = z;
    }
    // Backtage mit ihren Hand- und Sperrwerten
    var alteTage = Object.keys(produkt.prodTage || {}).filter(function (k) { return produkt.prodTage[k]; }).map(Number).sort(function (a, b) { return a - b; });
    alteTage.forEach(function (alt) {
      var neu = alt - d;
      if (neu < 0) { r.hinweise.push(tagText(heute, neu) + ' liegt in der Vergangenheit — nicht übernommen'); return; }
      if (!backtage[neu]) { r.hinweise.push(tagText(heute, neu) + ' ist heute als Backtag nicht wählbar (geschlossen oder außerhalb der Woche) — nicht übernommen'); return; }
      if (r.zielOff !== null && neu > r.zielOff) { r.hinweise.push(tagText(heute, neu) + ' liegt nach dem Ziel — nicht übernommen'); return; }
      r.prodTage[neu] = true;
      var m = produkt.manuelleWerte && produkt.manuelleWerte[alt];
      if (m !== undefined && m !== null) r.manuelleWerte[neu] = m;
      var g = produkt.gesperrtWerte && produkt.gesperrtWerte[alt];
      if (g !== undefined && g !== null) r.gesperrtWerte[neu] = g;
    });
    return r;
  }

  // „eingereicht: Mi 46 · Fr 25“ aus tage, sonst „eingereicht: gesamt 71“. Nur Anzeige.
  function vergleichszeile(produkt) {
    if (!produkt) return '';
    if (Array.isArray(produkt.tage)) {
      if (!produkt.tage.length) return 'eingereicht: keine Produktion';
      return 'eingereicht: ' + produkt.tage.map(function (t) {
        var dt = BR().ausIso(t.datum);
        return (dt ? WT_KURZ[dt.getDay()] : t.datum) + ' ' + String(t.menge).replace('.', ',');
      }).join(' · ');
    }
    return 'eingereicht: gesamt ' + String(produkt.gesamtProduktion || 0).replace('.', ',');
  }

  global.BOS_PLAN_LADEN = { verschiebung: verschiebung, umrechnen: umrechnen, vergleichszeile: vergleichszeile };
})(typeof window !== 'undefined' ? window : globalThis);
