/* ============================================================
   plan_pruefung.js — Planung gegen die aktuelle Inventur prüfen
   (Produktionsplaner Schritt 3)

   ÄNDERUNGSPROTOKOLL
     2026-11-09 · 06:36 · Anzeige mehrerer Lücken (Produktionsplaner Schritt 4,
     4.6, Entscheidung Kontroll-Chat 08.11., 18:18; Go 09.11., 06:32, E8):
     zeilen() gibt je Produkt EINE laute Zeile „ab ⟨Tag⟩ fehlen N“ (N = Lücke am
     ersten Tag), bei größerem Fehlbetrag „…, bis ⟨Tag⟩ M“ (M = größter
     Fehlbetrag im Horizont); die einzelnen Lücken als `tage` (Inventur und
     Übersicht klappen sie unter „Tage anzeigen“ ein). Rechnung und
     pruefeProdukt() unverändert. SESSION_2026-11-09_PRODUKTIONSPLANER_
     AUFTRAEGE_BAU.md
     2026-11-08 · 17:58 · Erstfassung (Produktionsplaner Schritt 3, Go
     Kontroll-Chat 08.11., 17:31, E1–E10, E7 geändert: keine Toleranz).
     SESSION_2026-11-08_PRODUKTIONSPLANER_PRUEFUNG_INVENTUR_BAU.md

   WAS
     window.BOS_PLAN_PRUEFUNG
       ladeBedarf(db, cfg, quelle?)  — Bedarf eines Produkts, KOPIE aus den
                                       Stationsseiten (einstellungenFuer,
                                       pruefeWochenbedarf); die Stationen
                                       rufen seit Schritt 3 diese Funktion.
       pruefeProdukt(eingabe)        — rein rechnend (Node-Probe): rechnet die
                                       eingereichte Planung mit dem aktuellen
                                       Bestand nach. Schlägt NIE Mengen vor:
                                       alle Backtage gehen gesperrt in die Kette.
       pruefe(db, opt)               — lädt alles einmal und prüft je Produkt.
       vorbereitungsHinweis(…)       — Text für die Station (Schritt 3, 4.4).
       zeilen(ergebnis, produkt)     — Anzeigetexte für Inventur und Übersicht.

   BRAUCHT (vorher laden): bos_produkte.js, bos_verbrauch_durchschnitt.js,
     bos_hamster.js, bos_produktionskette.js, bos_froster.js,
     bestell_regeln.js, plan_laden.js. Für pruefeProdukt reichen
     bos_produktionskette.js, bos_froster.js, bestell_regeln.js, plan_laden.js.

   REGELN (Kontroll-Chat 17:31)
     - Wochen Mo(heute) und Mo(heute)+7, je Station die neueste Einreichung;
       ihre `tage` ab heute als feste Mengen, Horizont = spätestes Ziel.
       Zwei Einreichungen am selben Tag → nicht prüfbar (E3).
     - Plan heute minus heute schon eingetragene Froster-Produktion (E4).
     - Zählung von heute: frosterFertig = Antwort der Zählung, keine
       Korrektur. Zählung von gestern: frosterFertig = Nein; war die
       Vorbereitung beim Zählen nicht fertig, Abzug von genau dem, was die
       Kette für heute als schon herausgenommen annimmt (Bedarf + Bestellungen
       heute, über BOS_KETTE gerechnet). Gruppe ohne Antwort → nicht prüfbar (E5).
     - Fehlmenge nur aus der Einreichung derselben Nacht und nur bei „Ja“ (E6).
     - Alle Bestellungen zählen, auch die noch nicht eingeplanten.
     - Keine Toleranz (E7): Fehlbetrag ab 1 der Einheit = Lücke (laut),
       darunter knapp (leise). Angezeigt aufgerundet.
   ============================================================ */
(function (global) {
  'use strict';

  var WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  // Kopie aus froster/froster_inventur.html (texte.gruppen) — die Inventur behält ihre.
  var GRUPPEN_TEXT = { baecker: 'Bäcker', konditoren: 'Konditoren', sonstige: 'Sonstige' };
  var TAG_MS = 86400000;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function BR() { var r = global.BOS_BESTELL_REGELN; if (!r) throw new Error('bestell_regeln.js ist nicht geladen'); return r; }
  function PL() { var r = global.BOS_PLAN_LADEN; if (!r) throw new Error('plan_laden.js ist nicht geladen'); return r; }
  function KETTE() { var r = global.BOS_KETTE; if (!r || !r.kann || !r.kann.zusatzBedarf) throw new Error('Rechen-Modul veraltet (bos_produktionskette.js kennt keine Bestellungen)'); return r; }
  function FROSTER() { var r = global.BOS_FROSTER; if (!r || typeof r.rechneBestandMitProduktion !== 'function' || typeof r.zaehlungAusDokumenten !== 'function') throw new Error('bos_froster.js ist in einer alten Fassung geladen'); return r; }
  function mitternacht(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function tagText(d) { return WT_LANG[d.getDay()] + ' ' + pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.'; }
  function zahl(n) { var x = Math.round(Number(n) * 100) / 100; return String(x).replace('.', ','); }
  function grund(e) { var t = (e && e.message) ? e.message : String(e); if (e && e.code && t.indexOf(e.code) < 0) t += ' (' + e.code + ')'; return t; }
  function montag(heute) { var d = mitternacht(heute); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }

  // ── Bedarf: KOPIE aus station_*.html (Stand Schritt 2, Z. 469–473 und
  // pruefeWochenbedarf). Die Stationen rufen seit Schritt 3 diese Funktion.
  var einstellungenJeTopf = {};
  async function einstellungenFuer(topf) {
    if (topf === 'richtwert') return null;   // der Richtwert hat keine Einstellungen
    if (!einstellungenJeTopf[topf]) einstellungenJeTopf[topf] = await global.BOS_VERBRAUCH.holeEinstellungen(topf);
    return einstellungenJeTopf[topf];
  }
  // 13.10.2026 (#64): Versionsschutz (aus der Station). Ohne `einheit` käme die Antwort
  // von einer alten bos_verbrauch_durchschnitt.js — dann sichtbar abbrechen.
  function pruefeWochenbedarf(wb) {
    if (!wb || !wb.einheit) {
      throw new Error('Rechen-Modul veraltet (bos_verbrauch_durchschnitt.js liefert keine Einheit) — Seite neu laden. Hilft das nicht: Ulf Bescheid sagen.');
    }
    return wb;
  }
  async function ladeBedarf(db, cfg, quelle) {
    var q = quelle || global.BOS_PRODUKTE.bedarfsQuelle(cfg);
    var einstellungen = await einstellungenFuer(q);
    return pruefeWochenbedarf(await global.BOS_VERBRAUCH.holeWochenbedarf(db, cfg.legacyKey, einstellungen, q, cfg));
  }

  // Was die Kette für HEUTE als schon aus dem Froster annimmt (Grundbedarf +
  // Bestellungen; Tag zu, Hamstertag): über BOS_KETTE selbst gerechnet, mit
  // gestern als „heute“, damit heute Versatz 1 ist.
  function abgangHeute(needs, heute, tagesTypen, bestellungenHeute) {
    var gestern = new Date(heute); gestern.setDate(gestern.getDate() - 1);
    var r = KETTE().berechne({ needs: needs, heute: gestern, zielOff: 1, startBestand: 0, prodTage: {}, frosterFertig: false,
      tagesTypen: { 0: 'normal', 1: (tagesTypen && tagesTypen[0]) || 'normal' }, zusatzBedarf: { 1: bestellungenHeute || 0 } });
    return r.kette[1].verbrauch;
  }

  function nichtPruefbar(text) { return { status: 'nicht_pruefbar', grund: text, luecken: [], knapp: [] }; }

  /* eingabe:
       produkt      Produkt aus der Liste (legacyKey, name, station, frosterZustaendigkeit, einheit)
       heute        Date (lokal, 00:00)
       zaehlung     zaehlungAusDokumenten()-Form (oder zaehlungFehler())
       eintraege    froster_produktion-Dokumente (alle Produkte, ab Zählung bzw. heute 00:00)
       produktionFehler, bedarfFehler, bestellungenFehler   Text oder leer
       einheitGleich  BOS_PRODUKTE.einheitGleich (optional)
       einreichungen  neueste je Station und Woche (Wochen Mo(heute), Mo(heute)+7), mit _docId
       bestellungen   alle Bestellungen (mit id)
       needs, tagesTypen (Versatz → Typ, ab heute)
     Ergebnis: { status: 'passt'|'knapp'|'luecke'|'nicht_pruefbar', grund?, luecken: [...], knapp: [...], details } */
  function pruefeProdukt(e) {
    var p = e.produkt || {}, lk = p.legacyKey, heute = mitternacht(e.heute);
    var heuteIso = BR().datumLokal(heute);
    var eigene = (e.einreichungen || []).filter(function (x) { return x && x.station === p.station && x.produkte && x.produkte[lk]; })
      .sort(function (a, b) { return a.woche < b.woche ? -1 : a.woche > b.woche ? 1 : 0; });
    if (!eigene.length) return nichtPruefbar('keine eingereichte Planung für diese oder die nächste Woche');
    var gruppe = p.frosterZustaendigkeit;
    if (!gruppe || gruppe === 'nein') return nichtPruefbar('kein Froster-Produkt (Froster-Zuständigkeit fehlt)');
    var z = e.zaehlung || {};
    if (z.fehlerText) return nichtPruefbar('Zählung nicht lesbar: ' + z.fehlerText);
    if (z.veraltet !== false || typeof z.bestand !== 'number' || typeof z.ts !== 'number') {
      return nichtPruefbar(z.gefunden ? 'keine Zählung unter 24 Std. (letzte älter)' : 'keine Zählung unter 24 Std. (nie gezählt)');
    }
    var vf = z.vorbereitungFertig ? z.vorbereitungFertig[gruppe] : undefined;
    if (typeof vf !== 'boolean') return nichtPruefbar('Zählung ohne Antwort zur Vorbereitung (' + (GRUPPEN_TEXT[gruppe] || gruppe) + ')');
    if (e.produktionFehler) return nichtPruefbar('Froster-Produktion nicht lesbar: ' + e.produktionFehler);
    if (e.bestellungenFehler) return nichtPruefbar('Bestellungen nicht lesbar: ' + e.bestellungenFehler);
    if (e.bedarfFehler) return nichtPruefbar('Bedarf nicht ladbar: ' + e.bedarfFehler);
    if (!e.needs) return nichtPruefbar('Bedarf nicht geladen');

    // Planung: feste Mengen ab heute, Horizont = spätestes Ziel (E3)
    var feste = {}, horizont = null, quelleTag = {};
    for (var i = 0; i < eigene.length; i++) {
      var ein = eigene[i], pe = ein.produkte[lk];
      if (!Array.isArray(pe.tage)) return nichtPruefbar('Einreichung (Woche ' + ein.woche + ') ohne Tagesmengen');
      var v = PL().verschiebung(ein, heute);
      if (v === null) return nichtPruefbar('Einreichung (Woche ' + ein.woche + ') ohne Planungstag');
      if (typeof pe.zielOff === 'number') { var zo = pe.zielOff - v; if (horizont === null || zo > horizont) horizont = zo; }
      for (var j = 0; j < pe.tage.length; j++) {
        var t = pe.tage[j], dt = BR().ausIso(t.datum);
        if (!dt) continue;
        var off = BR().tageAbstand(heute, dt);
        if (off < 0) continue;   // vor heute: steckt schon in Zählung oder Einträgen
        if (feste[off] !== undefined) return nichtPruefbar('Einreichungen für die Wochen ' + quelleTag[off] + ' und ' + ein.woche + ' planen beide ' + tagText(dt));
        feste[off] = Number(t.menge) || 0; quelleTag[off] = ein.woche;
      }
    }
    if (horizont === null || horizont <= 0) {
      return nichtPruefbar('eingereichte Planung reicht nur bis ' + (horizont === null ? '—' : tagText(BR().plusTage(heute, horizont))));
    }

    // Bestand: Zählung + Produktion seit der Zählung (Schritt 2), gerundet wie an der Station
    var F = FROSTER();
    var b = F.rechneBestandMitProduktion(z, e.eintraege || [], lk, p.einheit || 'bleche', e.einheitGleich);
    var bestand = Math.round(b.gesamt);

    // Produktion heute schon eingetragen (E4)
    var heuteProd = F.rechneBestandMitProduktion({ bestand: 0, ts: heute.getTime() - 1, veraltet: false }, e.eintraege || [], lk, p.einheit || 'bleche', e.einheitGleich).produktion;
    var planHeute = feste[0];
    if (feste[0] !== undefined) feste[0] = Math.max(0, feste[0] - heuteProd);

    // frosterFertig und Korrektur 3.2 (E5)
    var zaehlTag = mitternacht(new Date(z.ts));
    var abstand = BR().tageAbstand(zaehlTag, heute);
    var frosterFertig, korrektur = 0, xTag = null;
    var bestHeute = (e.bestellungen || []).filter(function (x) { return x && x.legacyKey === lk && x.datum === heuteIso && Number(x.menge) > 0; })
      .reduce(function (s, x) { return s + Number(x.menge); }, 0);
    if (abstand === 0) { frosterFertig = vf; }
    else if (abstand === 1) {
      frosterFertig = false;
      if (vf === false) { korrektur = abgangHeute(e.needs, heute, e.tagesTypen, bestHeute); xTag = heute; }
    } else return nichtPruefbar('Zählung vom ' + tagText(zaehlTag) + ' passt nicht zu heute');

    // Fehlmenge nur aus der Einreichung derselben Nacht, nur bei „Ja“ (E6)
    var fehlmenge = 0;
    if (frosterFertig === true) eigene.forEach(function (x) {
      if (BR().planungsTagVon(x) !== heuteIso) return;
      var pe = x.produkte[lk], f = (typeof pe.fehlmengeFroster === 'number') ? pe.fehlmengeFroster : Number(pe.fehlmengeAbs) || 0;
      if (f > 0) fehlmenge += f;
    });

    // Bestellungen: alle (auch nicht eingeplante), so wie die Station sie zählt
    var bst = BR().fuerKette(e.bestellungen || [], lk, heute, horizont, frosterFertig);
    var neu = bst.gerechnet.concat(bst.ueberFroster).filter(function (g) {
      var orig = (e.bestellungen || []).filter(function (x) { return x.id === g.id; })[0];
      return orig && BR().kennzeichen(orig, eigene) === 'neu';
    });

    var start = bestand - korrektur;
    var prodTage = {}; Object.keys(feste).forEach(function (k) { prodTage[k] = true; });
    var r = KETTE().berechne({
      needs: e.needs, startBestand: start, fehlmengeAbs: fehlmenge, zusatzBedarf: bst.zusatz,
      frosterFertig: frosterFertig, zielOff: horizont, prodTage: prodTage,
      gesperrtWerte: feste, manuelleWerte: {}, gleichmaessig: false, heute: heute, tagesTypen: e.tagesTypen || {}
    });

    // Auswertung ohne Toleranz (E7): ab 1 Lücke, darunter knapp
    var luecken = [], knapp = [], strecke = null;
    r.kette.forEach(function (k) {
      if (k.offset === 0) return;
      var fehlt = -k.bestandNachMorgen;
      if (fehlt >= 1) {
        if (!strecke) { strecke = { datum: k.datum, menge: Math.ceil(fehlt - 1e-9), bisDatum: k.datum, bisMenge: Math.ceil(fehlt - 1e-9) }; luecken.push(strecke); }
        else if (Math.ceil(fehlt - 1e-9) > strecke.bisMenge) { strecke.bisDatum = k.datum; strecke.bisMenge = Math.ceil(fehlt - 1e-9); }
        return;
      }
      strecke = null;
      if (fehlt > 0) knapp.push({ datum: k.datum, art: 'unter1', menge: fehlt });
      else if (k.warnung === 'knapp') knapp.push({ datum: k.datum, art: 'knapp', bestand: k.bestand });
    });
    var status = luecken.length ? 'luecke' : (knapp.length ? 'knapp' : 'passt');
    return {
      status: status, luecken: luecken, knapp: knapp,
      details: { zaehlung: z.bestand, zaehlTs: z.ts, produktion: b.produktion, andereEinheit: b.andereEinheit.length + b.ohneEinheit.length,
        bestand: bestand, korrektur: korrektur, xTag: xTag, start: start, frosterFertig: frosterFertig, fehlmenge: fehlmenge,
        planHeute: planHeute, heuteProduziert: heuteProd, feste: feste, horizont: horizont,
        horizontDatum: BR().plusTage(heute, horizont), bestellungenNeu: neu.length,
        einreichungen: eigene.map(function (x) { return { woche: x.woche, von: x.eingereichtVon || null, id: x._docId || null }; }),
        vorschlaege: r.vorschlaege }
    };
  }

  // ── Laden und prüfen ──────────────────────────────────────────────
  /* opt: { heute?: Date, legacyKeys?: [..] (nur diese), zaehlDok?: {id, data} (die eben
     gesendete Zählung; dann gilt sie für ihre Produkte) }
     Ergebnis: { heute, ergebnisse: [{ produkt, ergebnis, zaehlung }], ohneStation: Zahl }
     Wirft nur, wenn gar nichts geprüft werden kann (Produktliste, Einreichungen). */
  async function pruefe(db, opt) {
    opt = opt || {};
    var heute = mitternacht(opt.heute || new Date());
    var F = FROSTER(); KETTE(); BR(); PL();
    var gleich = global.BOS_PRODUKTE && global.BOS_PRODUKTE.einheitGleich;
    var liste = (await global.BOS_PRODUKTE.lade({ sicht: 'laufend' })).liste || [];
    var planbar = liste.filter(function (c) { return c && c.legacyKey && c.station && c.nfcSeite === true; });
    var ohneStation = 0;
    if (opt.legacyKeys) {
      var keys = {}; opt.legacyKeys.forEach(function (k) { keys[k] = true; });
      var planKeys = {}; planbar.forEach(function (c) { planKeys[c.legacyKey] = true; });
      ohneStation = opt.legacyKeys.filter(function (k) { return !planKeys[k]; }).length;
      planbar = planbar.filter(function (c) { return keys[c.legacyKey]; });
    }

    // Einreichungen (E3): eine Abfrage für alle Stationen
    var mo = montag(heute), wochen = [BR().datumLokal(mo), BR().datumLokal(BR().plusTage(mo, 7))];
    var esnap = await db.collection('bos_events').where('type', '==', 'produktionsplan_einreichung').where('woche', 'in', wochen).get();
    var eliste = []; esnap.forEach(function (d) { var x = d.data(); x._docId = d.id; eliste.push(x); });
    var einreichungen = BR().neuesteJeStationUndWoche(eliste);

    // Zählungen (E2) bzw. die eben gesendete (F5)
    var docs = null, zFehler = null;
    if (opt.zaehlDok) docs = [opt.zaehlDok];
    else { try { docs = await F.holeZaehlDokumente(db); } catch (err) { zFehler = err; } }
    var zaehlungen = {};
    planbar.forEach(function (c) { zaehlungen[c.legacyKey] = zFehler ? F.zaehlungFehler(zFehler) : F.zaehlungAusDokumenten(docs, c.legacyKey); });

    // Froster-Produktion ab der frühesten frischen Zählung (höchstens heute 00:00)
    var ab = heute.getTime();
    planbar.forEach(function (c) { var z = zaehlungen[c.legacyKey]; if (z.veraltet === false && typeof z.ts === 'number' && z.ts < ab) ab = z.ts; });
    var eintraege = [], produktionFehler = null;
    try {
      var psnap = await db.collection('bos_events').where('type', '==', 'froster_produktion').where('ts', '>=', new Date(ab)).get();
      psnap.forEach(function (d) { eintraege.push(d.data()); });
    } catch (err) { produktionFehler = grund(err); }

    // Bestellungen heute … heute+17 (≤ 30 Werte für `in`)
    var bestellungen = [], bestellungenFehler = null;
    try {
      var tage = BR().tageVonBis(BR().datumLokal(heute), BR().datumLokal(BR().plusTage(heute, 17)));
      var bsnap = await db.collection('bos_events').where('type', '==', BR().TYP).where('datum', 'in', tage).get();
      bsnap.forEach(function (d) { var x = d.data(); x.id = d.id; bestellungen.push(x); });
    } catch (err) { bestellungenFehler = grund(err); }

    // Tagestypen bis zum spätesten Ziel
    var maxH = 1;
    einreichungen.forEach(function (x) { var v = PL().verschiebung(x, heute); if (v === null) return;
      Object.keys(x.produkte || {}).forEach(function (k) { var zo = x.produkte[k].zielOff; if (typeof zo === 'number' && zo - v > maxH) maxH = zo - v; }); });
    var tagesTypen = await KETTE().ermittleTagesTypen(db, heute, Math.min(maxH, 30));

    var ergebnisse = [];
    for (var i = 0; i < planbar.length; i++) {
      var c = planbar[i], z = zaehlungen[c.legacyKey];
      var basis = { produkt: c, heute: heute, zaehlung: z, eintraege: eintraege, produktionFehler: produktionFehler, bestellungenFehler: bestellungenFehler,
        einheitGleich: gleich, einreichungen: einreichungen, bestellungen: bestellungen, tagesTypen: tagesTypen };
      // Bedarf nur, wo er gebraucht wird (E9): Einreichung + frische Zählung
      var vorab = pruefeProdukt(Object.assign({}, basis, { needs: null, bedarfFehler: null }));
      if (vorab.status === 'nicht_pruefbar' && vorab.grund !== 'Bedarf nicht geladen') { ergebnisse.push({ produkt: c, ergebnis: vorab, zaehlung: z }); continue; }
      var needs = null, bedarfFehler = null;
      try { needs = (await ladeBedarf(db, c)).needs; } catch (err) { bedarfFehler = grund(err); }
      ergebnisse.push({ produkt: c, ergebnis: pruefeProdukt(Object.assign({}, basis, { needs: needs, bedarfFehler: bedarfFehler })), zaehlung: z });
    }
    return { heute: heute, ergebnisse: ergebnisse, ohneStation: ohneStation };
  }

  // ── Hinweis an der Station (4.4, E10) ────────────────────────────
  /* zaehlung: zaehlungAusDokumenten()-Form; gruppe: frosterZustaendigkeit;
     frosterFertigStation: Antwort an der Station (true/false/null); vonHand: Bestand von Hand. */
  function vorbereitungsHinweis(zaehlung, gruppe, heute, frosterFertigStation, vonHand) {
    if (vonHand) return null;
    if (!zaehlung || zaehlung.veraltet !== false || typeof zaehlung.ts !== 'number') return null;
    var vf = zaehlung.vorbereitungFertig ? zaehlung.vorbereitungFertig[gruppe] : undefined;
    if (vf !== false) return null;
    var zt = new Date(zaehlung.ts), abstand = BR().tageAbstand(mitternacht(zt), mitternacht(heute));
    var x;
    if (abstand === 1) x = mitternacht(heute);
    else if (abstand === 0 && frosterFertigStation === true) x = BR().plusTage(mitternacht(heute), 1);
    else return null;
    return 'Gezählt ' + WT_KURZ[zt.getDay()] + ' ' + pad2(zt.getHours()) + ':' + pad2(zt.getMinutes()) + ', da war die Vorbereitung für '
      + (GRUPPEN_TEXT[gruppe] || gruppe) + ' noch nicht fertig. Ist die Ware für ' + WT_LANG[x.getDay()] + ' schon raus, ist der Bestand zu hoch — bitte neu zählen oder Bestand von Hand eintragen.';
  }

  // ── Anzeigetexte (Inventur und Übersicht) ────────────────────────
  // 09.11.2026 (Schritt 4, 4.6): je Produkt EINE laute Zeile. Mehrere Lücken
  // desselben Produkts sind dieselbe fehlende Menge an mehreren Tagen, keine Summe.
  // ~~je Lücke eine laute Zeile~~ (08.11.: „Mi fehlen 3 · Fr fehlen 3 · Mo fehlen 3“ las sich wie 9)
  function zeilen(ergebnis, produkt) {
    var eh = (global.BOS_PRODUKTE && typeof global.BOS_PRODUKTE.einheit === 'function') ? global.BOS_PRODUKTE.einheit(produkt).kurz : '';
    var name = produkt.name + ' (' + produkt.station + ')';
    var r = { laut: [], leise: [], nicht: null, tage: [] };
    if (ergebnis.status === 'nicht_pruefbar') { r.nicht = name + ': nicht prüfbar — ' + ergebnis.grund; return r; }
    if (ergebnis.luecken.length) {
      var erste = ergebnis.luecken[0], groesste = erste;
      ergebnis.luecken.forEach(function (l) { if (l.bisMenge > groesste.bisMenge) groesste = l; });
      var t = '⚠ ' + name + ': ab ' + tagText(erste.datum) + ' fehlen ' + erste.menge + ' ' + eh;
      if (groesste.bisMenge > erste.menge) t += ', bis ' + tagText(groesste.bisDatum) + ' ' + groesste.bisMenge + ' ' + eh;
      r.laut.push(t);
      if (ergebnis.luecken.length > 1) ergebnis.luecken.forEach(function (l) {
        r.tage.push(tagText(l.datum) + ': fehlen ' + l.menge + ' ' + eh + (l.bisMenge > l.menge ? ' (bis ' + tagText(l.bisDatum) + ' ' + l.bisMenge + ' ' + eh + ')' : ''));
      });
    }
    ergebnis.knapp.forEach(function (k) {
      r.leise.push(name + ': ' + tagText(k.datum) + (k.art === 'unter1' ? ' knapp — es fehlt weniger als 1 ' + eh + ' (' + zahl(k.menge) + ')' : ' knapp — danach bleiben ' + zahl(k.bestand) + ' ' + eh + ', zu wenig für den nächsten Tag'));
    });
    return r;
  }

  global.BOS_PLAN_PRUEFUNG = {
    GRUPPEN_TEXT: GRUPPEN_TEXT,
    ladeBedarf: ladeBedarf, pruefeWochenbedarf: pruefeWochenbedarf,
    pruefeProdukt: pruefeProdukt, pruefe: pruefe,
    vorbereitungsHinweis: vorbereitungsHinweis, zeilen: zeilen, montag: montag
  };
})(typeof window !== 'undefined' ? window : globalThis);
