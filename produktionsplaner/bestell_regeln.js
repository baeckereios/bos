/* ============================================================
   bestell_regeln.js — Produktionsplaner: Regeln der Bestellliste
   ------------------------------------------------------------
   EINE Rechenstelle für alles, was mehrere Seiten über Bestellungen
   (bos_events, type 'produktionsplan_bestellung') gleich wissen müssen:
     - Datum lokal (nie toISOString), Planungsspanne einer Woche
     - Kennzeichen einer Bestellung gegen die Einreichungen:
         'eingeplant' · 'neu' (neu seit Einreichung — noch nicht
         eingeplant) · 'offen' (keine Einreichung deckt den Tag →
         kommt in eine spätere Planung, ohne Kennzeichen)
     - gelöschte Bestellungen, die noch in einer Einreichung stecken
     - was eine Station als zusatzBedarf an die Kette gibt
     - Menge und Notiz prüfen
   Aufrufer: station_*.html (vier), uebersicht.html, bestellungen.html,
   ../bos_ziel_berechnung.js (froster/ziele.html, froster_produktion.html).

   REGEL „abdeckende Einreichung“ (Bauplan §3.4.4, Go Kontroll-Chat
   08.11.2026, 14:45, E2):
     Eine Einreichung DECKT eine Bestellung (Produkt P, Tag D), wenn sie
     P enthält und D im Bereich planungsTag+1 … planungsTag+zielOff liegt
     (ohne planungsTag: lokales Datum von ts). Betrachtet werden nur
     Einreichungen derselben Station.
       ID steht in bestellungen einer deckenden Einreichung → 'eingeplant'
       deckende Einreichung da, ID in keiner          → 'neu'
       keine deckt                                    → 'offen'
     Alte Einreichungen ohne `bestellungen` gelten als leere Liste — alte
     Stationen haben keine Bestellungen gerechnet.
     Welche Einreichungen jede Seite liest, legt wochenFuerTag() fest (die
     neueste je Station und Woche aus allen Wochen, die den Tag abdecken
     können). So bekommt dieselbe Bestellung überall dasselbe Kennzeichen.

   Rein rechnend: kein DOM, kein Firestore, in Node prüfbar
   (_PRUEF_froster_bestellung_werkzeuge/test_bestell_regeln.js).
   Einbindung: Station/Übersicht/Bestellungen <script src="bestell_regeln.js">,
   Froster-Seiten <script src="../produktionsplaner/bestell_regeln.js">
   VOR ../bos_ziel_berechnung.js.
   Export: window.BOS_BESTELL_REGELN

   AUFTRÄGE (seit 09.11.2026, Schritt 4): Ein Auftrag ist KEIN eigenes Dokument,
   sondern die Positionen mit derselben `auftragId` (Tag und Notiz an jeder
   Position). Positionen: type TYP (Stationsprodukt, wie bisher) oder
   TYP_SONSTIGES (freier Text, keine Menge, keine Station — liest kein
   Planungsleser, die fragen alle `type == TYP`). Alte Bestellungen ohne
   `auftragId` = Auftrag mit einer Position.

   CHANGELOG
     2026-11-09 · 06:35 · Additiv (Produktionsplaner Schritt 4, Go Kontroll-Chat
       09.11., 06:32, E5): TYP_SONSTIGES, TEXT_MAX, textAusText(),
       auftragSchluessel(), auftraege(), auftragPasst(), positionenJeAuftrag().
       Bestehende Funktionen unverändert. SESSION_2026-11-09_
       PRODUKTIONSPLANER_AUFTRAEGE_BAU.md
     2026-11-08 · 15:38 · Erstfassung (Produktionsplaner Schritt 1, Go
       Kontroll-Chat 08.11., 14:45, Freigabe §3 „eine Rechenstelle für die
       Kennzeichen“). SESSION_2026-11-08_PRODUKTIONSPLANER_FROSTER_
       BESTELLUNGEN_BAU.md
   ============================================================ */
(function (global) {
  'use strict';

  var TYP = 'produktionsplan_bestellung';
  var NOTIZ_MAX = 40;          // Ulf/KC 08.11.: höchstens 40 Zeichen
  var TAG_MS = 86400000;

  function pad2(n) { return String(n).padStart(2, '0'); }

  // 'JJJJ-MM-TT' aus lokalem Datum — nie über UTC.
  function datumLokal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  // 'JJJJ-MM-TT' → lokales Datum 00:00 (nicht new Date(iso), das wäre UTC).
  function ausIso(iso) {
    var t = String(iso || '').split('-');
    if (t.length !== 3) return null;
    var d = new Date(Number(t[0]), Number(t[1]) - 1, Number(t[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  function plusTage(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }
  function plusTageIso(iso, n) { var d = ausIso(iso); return d ? datumLokal(plusTage(d, n)) : null; }
  // Ganze Tage von a nach b (beide lokal 00:00; round wegen Zeitumstellung).
  function tageAbstand(a, b) { return Math.round((b - a) / TAG_MS); }
  function istIso(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && ausIso(iso) !== null && datumLokal(ausIso(iso)) === iso; }

  // Alle Daten von..bis (einschließlich), lokal.
  function tageVonBis(vonIso, bisIso) {
    var von = ausIso(vonIso), bis = ausIso(bisIso), r = [];
    if (!von || !bis) return r;
    for (var d = von; d <= bis; d = plusTage(d, 1)) r.push(datumLokal(d));
    return r;
  }

  // Planungsspanne der Woche W (wochenMo = Montag der Planungswoche):
  // Freitag davor (Fensterstart) bis Sonntag der Woche danach — 17 Tage.
  // Jede Planung, die im Fenster von W eingereicht wird, liegt ganz darin.
  function planungsSpanne(wochenMo) {
    return tageVonBis(datumLokal(plusTage(wochenMo, -3)), datumLokal(plusTage(wochenMo, 13)));
  }

  // Welche Planungswochen können einen Tag überhaupt abdecken? Eine Einreichung
  // der Woche W hat ihren Planungstag im Fenster Fr vor W … Di von W (W−3 … W+1)
  // und ihr Ziel spätestens am So der Woche danach (W+13). Sie deckt Tag D also
  // nur, wenn W zwischen D−13 und D+2 liegt. Ergebnis: Montage als 'JJJJ-MM-TT'.
  // Alle Seiten laden genau diese Wochen — so trägt dieselbe Bestellung überall
  // dasselbe Kennzeichen (Freigabe KC 08.11.2026 §6).
  function wochenFuerTag(datumIso) {
    var d = ausIso(datumIso), r = [];
    if (!d) return r;
    for (var k = -13; k <= 2; k++) {
      var x = plusTage(d, k);
      if (x.getDay() === 1) r.push(datumLokal(x));
    }
    return r;
  }
  function wochenFuerTage(isoListe) {
    var m = {};
    (isoListe || []).forEach(function (iso) { wochenFuerTag(iso).forEach(function (w) { m[w] = true; }); });
    return Object.keys(m).sort();
  }
  // Neueste Einreichung je Station UND Woche (Mehrfach-Einreichen) als Liste.
  function neuesteJeStationUndWoche(liste) {
    var je = {};
    (liste || []).forEach(function (d) { if (d && d.station && d.woche) (je[d.station + '|' + d.woche] = je[d.station + '|' + d.woche] || []).push(d); });
    return Object.keys(je).map(function (k) { var n = neuesteJeStation(je[k]); return n[Object.keys(n)[0]]; });
  }
  // Teilt eine Liste in Stücke für Firestore-`in` (höchstens 30 Werte).
  function stuecke(liste, n) { var r = []; for (var i = 0; i < liste.length; i += (n || 30)) r.push(liste.slice(i, i + (n || 30))); return r; }

  function alsDatum(ts) {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts instanceof Date) return ts;
    if (typeof ts === 'number') return new Date(ts);
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    return null;
  }
  function alsMillis(ts) { var d = alsDatum(ts); return d ? d.getTime() : 0; }

  // Planungstag einer Einreichung: das Feld (seit 08.11.2026), sonst das
  // lokale Datum des Zeitstempels (ältere Einreichungen).
  function planungsTagVon(einreichung) {
    if (!einreichung) return null;
    if (istIso(einreichung.planungsTag)) return einreichung.planungsTag;
    var d = alsDatum(einreichung.ts);
    return d ? datumLokal(d) : null;
  }

  // Deckt diese Einreichung Produkt lk am Tag datumIso?
  function deckt(einreichung, legacyKey, datumIso) {
    if (!einreichung || !einreichung.produkte) return false;
    var p = einreichung.produkte[legacyKey];
    if (!p || typeof p.zielOff !== 'number') return false;
    var pt = planungsTagVon(einreichung);
    if (!pt) return false;
    var abstand = tageAbstand(ausIso(pt), ausIso(datumIso));
    return abstand >= 1 && abstand <= p.zielOff;
  }

  function enthaelt(einreichung, legacyKey, id) {
    var p = einreichung && einreichung.produkte && einreichung.produkte[legacyKey];
    var liste = (p && Array.isArray(p.bestellungen)) ? p.bestellungen : [];
    return liste.some(function (b) { return b && b.id === id; });
  }

  // Kennzeichen einer Bestellung. einreichungen: beliebig viele (z. B. die
  // neueste je Station aus W und W−1); es zählen nur die derselben Station.
  function kennzeichen(bestellung, einreichungen) {
    var deckende = (einreichungen || []).filter(function (e) {
      return e && e.station === bestellung.station && deckt(e, bestellung.legacyKey, bestellung.datum);
    });
    if (!deckende.length) return 'offen';
    var drin = deckende.some(function (e) { return enthaelt(e, bestellung.legacyKey, bestellung.id); });
    return drin ? 'eingeplant' : 'neu';
  }

  var KENNZEICHEN_TEXT = {
    eingeplant: 'eingeplant',
    neu: 'neu seit Einreichung — noch nicht eingeplant',
    offen: ''
  };

  // IDs aus Einreichungen, deren Dokument fehlt (gelöscht nach Einreichung).
  // vorhandeneIds: Menge der gelesenen Bestell-IDs. Nur Tage im gelesenen
  // Bereich (vonIso..bisIso, beide einschließlich, optional), sonst wüsste
  // man nicht, ob das Dokument nur nicht abgefragt wurde. Doppelte IDs
  // (in W−1 und W) nur einmal.
  function geloeschte(einreichungen, vorhandeneIds, bereich) {
    var gesehen = {}, r = [];
    var von = bereich && bereich.von, bis = bereich && bereich.bis;
    (einreichungen || []).forEach(function (e) {
      if (!e || !e.produkte) return;
      Object.keys(e.produkte).forEach(function (lk) {
        var p = e.produkte[lk];
        (Array.isArray(p.bestellungen) ? p.bestellungen : []).forEach(function (b) {
          if (!b || !b.id || gesehen[b.id]) return;
          if (vorhandeneIds[b.id]) return;
          if (von && b.datum < von) return;
          if (bis && b.datum > bis) return;
          gesehen[b.id] = true;
          r.push({ id: b.id, station: e.station, legacyKey: lk, produktName: p.name || lk, datum: b.datum, menge: b.menge });
        });
      });
    });
    r.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0; });
    return r;
  }

  // Neueste Einreichung je Station aus einer Liste (Mehrfach-Einreichen).
  // Ohne Zeitstempel (Schreiben läuft noch) zählt sie als jüngste.
  function neuesteJeStation(liste) {
    var r = {};
    (liste || []).forEach(function (d) {
      if (!d || !d.station) return;
      var b = r[d.station];
      var tn = d.ts ? alsMillis(d.ts) : Infinity, tb = b ? (b.ts ? alsMillis(b.ts) : Infinity) : -1;
      if (!b || tn > tb) r[d.station] = d;
    });
    return r;
  }

  // Was eine Station für ein Produkt an die Kette gibt.
  //   bestellungen: Liste {id, legacyKey, datum, menge, …}
  //   heute: lokales Datum 00:00 der Station; zielOff: Ziel (null = keins)
  //   frosterFertig: true/false/null
  // Ergebnis: zusatz {offset: summe}, gerechnet [{id, datum, menge, offset}]
  // (eingerechnet), ueberFroster [...] (morgen bei „Ja“: nicht gerechnet,
  // aber erledigt — kommt mit ueberFroster: true in die Einreichung),
  // ausserhalb [...] (Tag ≤ heute oder nach dem Ziel oder kein Ziel).
  function fuerKette(bestellungen, legacyKey, heute, zielOff, frosterFertig) {
    var r = { zusatz: {}, gerechnet: [], ueberFroster: [], ausserhalb: [] };
    (bestellungen || []).forEach(function (b) {
      if (!b || b.legacyKey !== legacyKey) return;
      var d = ausIso(b.datum);
      var menge = Number(b.menge);
      if (!d || !(menge > 0)) { r.ausserhalb.push(b); return; }
      var off = tageAbstand(heute, d);
      var eintrag = { id: b.id, datum: b.datum, menge: menge, offset: off };
      if (zielOff === null || zielOff === undefined || off < 1 || off > zielOff) { r.ausserhalb.push(eintrag); return; }
      if (frosterFertig === true && off === 1) { r.ueberFroster.push(eintrag); return; }
      r.gerechnet.push(eintrag);
      r.zusatz[off] = (r.zusatz[off] || 0) + menge;
    });
    function sort(a, b) { return a.offset - b.offset || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
    r.gerechnet.sort(sort); r.ueberFroster.sort(sort);
    return r;
  }

  // Für die Einreichung je Produkt: [{id, datum, menge}] (+ ueberFroster).
  function fuerEinreichung(ergebnisFuerKette) {
    var l = ergebnisFuerKette.gerechnet.map(function (b) { return { id: b.id, datum: b.datum, menge: b.menge }; });
    ergebnisFuerKette.ueberFroster.forEach(function (b) { l.push({ id: b.id, datum: b.datum, menge: b.menge, ueberFroster: true }); });
    l.sort(function (a, b) { return a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : (a.id < b.id ? -1 : 1); });
    return l;
  }

  // Eingabe „Menge“: Komma erlaubt, > 0, endlich; auf zwei Stellen gerundet.
  function mengeAusText(text) {
    var s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = Math.round(Number(s) * 100) / 100;
    return n > 0 && isFinite(n) ? n : null;
  }
  function notizAusText(text) {
    return String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, NOTIZ_MAX);
  }

  // Sortierung für Listen: Tag, dann Eintragzeit, dann ID.
  function sortiere(liste) {
    return (liste || []).slice().sort(function (a, b) {
      if (a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
      var ta = alsMillis(a.ts), tb = alsMillis(b.ts);
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  // ── Aufträge (09.11.2026, Schritt 4) ──────────────────────────────
  var TYP_SONSTIGES = 'produktionsplan_bestellung_sonstiges';
  var TEXT_MAX = 60;           // KC 08.11. (Anweisung Schritt 4, 4.2): Vorschlag ≤ 60 Zeichen
  function textAusText(text) {
    return String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);
  }
  // Alte Bestellungen ohne auftragId bilden je einen eigenen Auftrag.
  function auftragSchluessel(p) { return p && p.auftragId ? 'a:' + p.auftragId : 'einzel:' + (p && p.id); }
  function posWert(p) { return typeof p.pos === 'number' ? p.pos : Infinity; }
  /* bestellungen: TYP-Dokumente (mit id), sonstige: TYP_SONSTIGES-Dokumente (mit id).
     → [{ schluessel, auftragId, datum, notiz, positionen: [{ art: 'produkt'|'sonstiges', …Dokument }] }]
     Positionen nach pos, dann Eintragzeit, dann ID; Tag und Notiz von der ersten Position;
     Aufträge nach Tag, dann Eintragzeit der ersten Position, dann Schlüssel. */
  function auftraege(bestellungen, sonstige) {
    var je = {}, liste = [];
    function nimm(p, art) {
      if (!p) return;
      var k = auftragSchluessel(p);
      if (!je[k]) { je[k] = { schluessel: k, auftragId: p.auftragId || null, positionen: [] }; liste.push(je[k]); }
      var kopie = {}; Object.keys(p).forEach(function (x) { kopie[x] = p[x]; }); kopie.art = art;
      je[k].positionen.push(kopie);
    }
    (bestellungen || []).forEach(function (p) { nimm(p, 'produkt'); });
    (sonstige || []).forEach(function (p) { nimm(p, 'sonstiges'); });
    liste.forEach(function (a) {
      a.positionen.sort(function (x, y) {
        var px = posWert(x), py = posWert(y); if (px !== py) return px < py ? -1 : 1;
        var tx = alsMillis(x.ts), ty = alsMillis(y.ts); if (tx !== ty) return tx - ty;
        return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
      });
      a.datum = a.positionen[0].datum; a.notiz = a.positionen[0].notiz || '';
    });
    liste.sort(function (a, b) {
      if (a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
      var ta = alsMillis(a.positionen[0].ts), tb = alsMillis(b.positionen[0].ts); if (ta !== tb) return ta - tb;
      return a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0;
    });
    return liste;
  }
  // Filter der Seite: ein Auftrag erscheint, wenn EINE seiner Positionen passt.
  // Ohne Filter erscheint jeder; ein reiner Sonstiges-Auftrag nur ohne Filter.
  function auftragPasst(auftrag, station, legacyKey) {
    if (!station && !legacyKey) return true;
    return (auftrag && auftrag.positionen || []).some(function (p) {
      return p.art === 'produkt' && (!station || p.station === station) && (!legacyKey || p.legacyKey === legacyKey);
    });
  }
  // Zahl der Positionen je auftragId (beide Typen) — für „aus Auftrag … (n Positionen)“.
  function positionenJeAuftrag(bestellungen, sonstige) {
    var n = {};
    (bestellungen || []).concat(sonstige || []).forEach(function (p) { if (p && p.auftragId) n[p.auftragId] = (n[p.auftragId] || 0) + 1; });
    return n;
  }

  global.BOS_BESTELL_REGELN = {
    TYP: TYP, NOTIZ_MAX: NOTIZ_MAX, KENNZEICHEN_TEXT: KENNZEICHEN_TEXT,
    datumLokal: datumLokal, ausIso: ausIso, plusTage: plusTage, plusTageIso: plusTageIso, tageAbstand: tageAbstand, istIso: istIso,
    tageVonBis: tageVonBis, planungsSpanne: planungsSpanne, alsDatum: alsDatum, alsMillis: alsMillis,
    planungsTagVon: planungsTagVon, deckt: deckt, enthaelt: enthaelt, kennzeichen: kennzeichen,
    geloeschte: geloeschte, neuesteJeStation: neuesteJeStation, neuesteJeStationUndWoche: neuesteJeStationUndWoche,
    wochenFuerTag: wochenFuerTag, wochenFuerTage: wochenFuerTage, stuecke: stuecke, fuerKette: fuerKette, fuerEinreichung: fuerEinreichung,
    mengeAusText: mengeAusText, notizAusText: notizAusText, sortiere: sortiere,
    // 09.11.2026 (Schritt 4)
    TYP_SONSTIGES: TYP_SONSTIGES, TEXT_MAX: TEXT_MAX, textAusText: textAusText, auftragSchluessel: auftragSchluessel,
    auftraege: auftraege, auftragPasst: auftragPasst, positionenJeAuftrag: positionenJeAuftrag
  };
})(typeof window !== 'undefined' ? window : globalThis);
