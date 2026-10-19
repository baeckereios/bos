/* ================================================================
   BäckereiOS · backzettel/backzettel_logik.js — reine Logik der Erfassung
   ================================================================
   Stellt bereit: window.BOS_BACKZETTEL_LOGIK (im Browser) bzw.
   module.exports (Node, für die Prüfdatei). KEINE Datenbank, KEINE
   Oberfläche, KEIN Netz — alles hier ist mit Zahlen prüfbar.

   Was hier liegt (Bauplan SESSION_2026-10-19_BACKZETTEL_STUFE1_BAU.md):
     zahl(text)               deutsche Zahl aus dem Zettel („1.170“, „58,50“)
     kopf(text)               Backtag aus „Backzettel für Sa 04.07.2026“ (P5)
     abteilungNorm(text)      „Brötchen“ | „Brote“ | „Konditorei“ | Rohtext
     kreisAbteilung(artNr)    Abteilung aus dem Nummernkreis (P6)
     zeileAusAntwort(z, …)    eine Antwortzeile → Zeile der Erfassung
     pruefeZeile(zeile)       P1 Bleche, Nummer, Sorten-Summe → rot/Hinweis
     produktIndex(liste)      artNr → Produkte (doppelte erkannt)
     bestellungVorschlag(z)   Kunde-Menge = Anzahl → Vorschlag „Kundenbestellung“
     ordneZu(zeile, index)    'produkt' | 'bestellung' | 'ohneProdukt' |
                              'konflikt' | 'kein_stueck' (F7, E8, E11);
                              Ulfs Wahl (zeile.kundenbestellung) geht vor (N1)
     pruefeCharge(zeile, p)   P4 Charge ≠ stueckProBlech → Pflege-Hinweis
     doppelteSeiten(seiten)   gleiche Abteilung + Seite zweimal
     datumsLage(seiten, heute) P5 über alle Seiten, alter/künftiger Backtag
     vorkommen(tage, artNr, feld, backtag)   „kam n× in den letzten 4 Wochen“
     fehltListe(…)            „heute nicht auf dem Zettel — Seite vergessen?“
     anderswo(dok, eintrag)   wo derselbe Artikel im Tag in einem ANDEREN Topf steht (N2)
     konflikte(altDok, eintraege)   „bisher / jetzt“ — auch beim Topfwechsel (N2)
     baueTagesdokument(altDok, eintraege, opt)   das ganze neue Dokument

   ZAHLEN-REGELN (Ulf/KC 19.10.2026): gespeichert wird nur Stück (E16);
   Bleche und Charge sind stille Kontrolle (P1), die Charge bleibt nur bei
   Zeilen ohne Produkt. Zuordnung NUR über die Artikelnummer (F7).
   Kundenbestellung = Kunde-Block mit Menge = Anzahl (Fall A); Menge <
   Anzahl ist ein normales Produkt (E8). Das ist nur der VORSCHLAG: Ulf
   stellt jede Zeile im Zeilen-Fenster um (E6, Nachtrag 1 N1), seine Wahl
   geht vor.

   EIN ARTIKEL, EIN TOPF (Nachtrag 1 N2): Steht ein Artikel im Tag in einem
   Topf (produkte über den legacyKey, bestellungen/ohneProdukt über die
   artNr), verschwindet er beim Schreiben aus den anderen beiden — bei
   produkte samt ausgeschlossen. sorten bleibt. Ein solcher Wechsel gegenüber
   dem gespeicherten Tag ist ein „bisher / jetzt“ und sperrt das Speichern,
   bis entschieden ist.

   BEWUSSTE AUSNAHME vom Prinzip „nur anhängen“ (Freigabe B11): Das
   Tagesdokument wird bei jedem Durchgang als GANZES neu geschrieben (in
   einer Transaktion, siehe Seite) — ein Dokument je Backtag (ID = Datum,
   wie beim Import), mehrere Durchgänge am selben Tag, und ein
   zurückgenommener Ausschluss muss wirklich verschwinden.

   Datum nie über toISOString() (UTC-Falle zwischen 0 und 2 Uhr).

   CHANGELOG
     2026-10-19 · 17:32 · v1 · Erstfassung (Backzettel Stufe 1)
       Freigabe KC 09:47 (B1–B12). Prüfung: _PRUEF_backzettel.js.
     2026-10-19 · 18:32 · v2 · Nachtrag 1 (KC 18:02)
       N1: zeile.kundenbestellung (null = automatisch, true/false = Ulfs
       Wahl), bestellungVorschlag(); ordneZu() meldet vorschlag/wahl/bekannt.
       N2: anderswo(); konflikte() meldet Topfwechsel (wechsel: true,
       bisherArt); baueTagesdokument() räumt die anderen Töpfe auf, „bisher“
       beim Topfwechsel lässt den alten Stand ganz stehen. Einträge tragen
       artNr und legacyKeys. Prüfung: _PRUEF_backzettel.js Teil N.
   ================================================================ */
(function (wurzel) {
  'use strict';

  var WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];               // JS getDay()
  var WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var KREISE = { '11': 'Brötchen', '12': 'Brote', '13': 'Konditorei' };   // P6 (Kompendium §4)

  // Stellschrauben (Pflege-Register, Bauplan §7)
  var FEHLT_TAGE = 4;          // die letzten 4 erfassten gleichen Wochentage …
  var FEHLT_MINDEST = 3;       // … davon mindestens 3 mit dem Produkt = „regelmäßig“
  var FEHLT_WOCHEN = 8;        // nur innerhalb der letzten 8 Wochen
  var VORKOMMEN_TAGE = 28;     // „kam n× in den letzten 4 Wochen“
  var ALT_TAGE = 7;            // Backtag älter → Rückfrage (Fund 11)
  var ZUKUNFT_TAGE = 2;        // Backtag weiter voraus → Rückfrage
  var STILL_TAGE = 3;          // „Letzter erfasster Backtag: vor n Tagen“ ab hier in Warnfarbe
  var P1_TOLERANZ = 0.005;

  /* ---------- Hilfen ---------- */
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function ausIso(s) {
    var t = String(s || '').split('-').map(Number);
    return new Date(t[0], t[1] - 1, t[2]);
  }
  function tageZwischen(a, b) {   // b − a in ganzen Tagen, lokal
    return Math.round((ausIso(b) - ausIso(a)) / 86400000);
  }
  function wochentagLang(datum) { return WT_LANG[ausIso(datum).getDay()]; }
  function hat(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  /* ---------- Zahlen vom Zettel (Fund 6) ----------
     "1170" → 1170 · "1.170" → 1170 · "1.170,5" → 1170.5 · "58,50" → 58.5 ·
     "58.50" → 58.5 (Punkt mit 1–2 Nachkommastellen = Dezimalpunkt) ·
     "" / null / "12a" → null. Drei Ziffern nach einem Punkt gelten als
     Tausendertrennung, wie auf deutschen Zetteln. */
  function zahl(text) {
    if (text === null || text === undefined) return null;
    if (typeof text === 'number') return Number.isFinite(text) ? text : null;
    var s = String(text).replace(/[\s  ]/g, '');
    if (s === '') return null;
    var neg = false;
    if (/^-/.test(s)) { neg = true; s = s.slice(1); }
    var w = null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) w = Number(s.replace(/\./g, '').replace(',', '.'));
    else if (/^\d+(,\d+)?$/.test(s)) w = Number(s.replace(',', '.'));
    else if (/^\d+\.\d{1,2}$/.test(s)) w = Number(s);
    else if (/^,\d+$/.test(s)) w = Number('0' + s.replace(',', '.'));
    if (w === null || !Number.isFinite(w)) return null;
    return neg ? -w : w;
  }

  /* ---------- Kopf: Backtag (E3, P5) ---------- */
  function kopf(text) {
    var s = String(text || '');
    // bevorzugt nach „für“; sonst das erste Muster „Wt TT.MM.JJJJ“
    var teil = s;
    var f = s.search(/f(ü|ue|u)r/i);
    if (f >= 0) teil = s.slice(f);
    var m = teil.match(/(Mo|Di|Mi|Do|Fr|Sa|So)[a-z]*\.?,?\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/i);
    if (!m) return { datum: null, wtKurz: null, wtPasst: false, grund: 'kein_datum' };
    var jahr = Number(m[4]); if (jahr < 100) jahr += 2000;
    var monat = Number(m[3]), tag = Number(m[2]);
    var d = new Date(jahr, monat - 1, tag);
    if (d.getFullYear() !== jahr || d.getMonth() !== monat - 1 || d.getDate() !== tag) {
      return { datum: null, wtKurz: null, wtPasst: false, grund: 'datum_ungueltig' };
    }
    var kurz = m[1].charAt(0).toUpperCase() + m[1].charAt(1).toLowerCase();
    return { datum: iso(d), wtKurz: kurz, wtPasst: WT_KURZ[d.getDay()] === kurz, wochentag: WT_LANG[d.getDay()] };
  }

  /* ---------- Abteilung ---------- */
  function abteilungNorm(text) {
    var s = String(text || '').trim();
    var k = s.toLowerCase();
    if (/br(ö|oe|o)tchen/.test(k)) return 'Brötchen';
    if (/kondit/.test(k)) return 'Konditorei';
    if (/^brot|brote/.test(k)) return 'Brote';
    return s || null;
  }
  function kreisAbteilung(artNr) {
    var n = artNrNorm(artNr);
    return n ? (KREISE[n.slice(0, 2)] || null) : null;
  }
  function artNrNorm(a) {
    if (a === null || a === undefined) return null;
    var s = String(a).replace(/[\s ]/g, '');
    return /^\d{3,10}$/.test(s) ? s : null;
  }

  /* ---------- Antwort → Zeile ---------- */
  var zaehler = 0;
  function zeileAusAntwort(z, seite) {
    var sorten = Array.isArray(z.sorten) && z.sorten.length
      ? z.sorten.map(function (x) { return { art: x && x.art ? String(x.art).trim() : null, anzahl: zahl(x && x.anzahl), anzahlText: x ? x.anzahl : null }; })
      : null;
    zaehler++;
    return {
      id: 'z' + zaehler + '_' + (seite && seite.fotoId || ''),
      fotoId: seite ? seite.fotoId : null,
      abteilung: seite ? seite.abteilung : null,
      seite: seite ? seite.seite : null,
      artNr: artNrNorm(z.artNr),
      artNrText: z.artNr === undefined ? null : z.artNr,
      name: z.name ? String(z.name).trim() : null,
      anzahl: zahl(z.anzahl),
      bleche: zahl(z.bleche),
      charge: zahl(z.charge),
      kundeMenge: zahl(z.kundeMenge),
      roh: { anzahl: z.anzahl, bleche: z.bleche, charge: z.charge, kundeMenge: z.kundeMenge },
      sorten: sorten,
      unsicher: z.unsicher === true,
      bestaetigt: false,     // Ulf: „Wert stimmt so“ (rote P1-Zeile)
      verworfen: false,      // Ulf: „Zeile verwerfen“
      zaehltNicht: null,     // null = automatisch (gelb → zählt nicht), sonst Ulfs Wahl
      kundenbestellung: null, // null = automatisch (Kunde-Menge = Anzahl), sonst Ulfs Wahl (N1)
      entscheidung: null     // bei „bisher / jetzt“: 'bisher' | 'jetzt'
    };
  }

  /* ---------- Prüfungen je Zeile ---------- */
  // P1: round(Anzahl ÷ Charge, 2) = gelesene Bleche. Ohne die drei Zahlen ist
  // die Zeile nicht nachgerechnet → rot (Bestätigen möglich).
  function p1(zeile) {
    if (zeile.anzahl === null) return { ok: false, grund: 'anzahl_fehlt' };
    if (zeile.charge === null || zeile.charge <= 0 || zeile.bleche === null) return { ok: false, grund: 'p1_nicht_pruefbar' };
    var soll = Math.round(zeile.anzahl / zeile.charge * 100) / 100;
    return Math.abs(soll - zeile.bleche) <= P1_TOLERANZ
      ? { ok: true, soll: soll }
      : { ok: false, grund: 'p1_falsch', soll: soll };
  }
  function sortenSumme(zeile) {
    if (!zeile.sorten || !zeile.sorten.length) return null;
    var summe = 0;
    for (var i = 0; i < zeile.sorten.length; i++) {
      if (zeile.sorten[i].anzahl === null) return { ok: false, summe: null };
      summe += zeile.sorten[i].anzahl;
    }
    return { ok: zeile.anzahl !== null && Math.abs(summe - zeile.anzahl) < 1e-9, summe: summe };
  }
  /* Ergebnis: { rot: [gründe], hinweise: [gründe], p1, sorten }.
     „bestaetigt“ hebt NUR die P1-Gründe auf (Wert stimmt so), nicht eine
     fehlende Nummer oder Anzahl. */
  function pruefeZeile(zeile) {
    var rot = [], hinweise = [];
    if (!zeile.artNr) rot.push('nummer_fehlt');
    var r1 = p1(zeile);
    if (zeile.anzahl === null) rot.push('anzahl_fehlt');
    else if (!r1.ok && !zeile.bestaetigt) rot.push(r1.grund);
    var su = sortenSumme(zeile);
    if (su && !su.ok) hinweise.push('sorten_summe');
    if (zeile.unsicher) hinweise.push('unsicher');
    var abt = kreisAbteilung(zeile.artNr);
    if (abt && zeile.abteilung && abt !== zeile.abteilung) hinweise.push('abteilung');   // P6
    return { rot: rot, hinweise: hinweise, p1: r1, sorten: su };
  }

  /* ---------- Zuordnung (F7, E8, E11) ---------- */
  function produktIndex(liste) {
    var idx = {};
    (liste || []).forEach(function (p) {
      var n = artNrNorm(p && p.artNr);
      if (!n) return;
      (idx[n] = idx[n] || []).push(p);
    });
    return idx;
  }
  // Vorschlag (Fall A): Kunde-Block mit Menge = Anzahl
  function bestellungVorschlag(zeile) {
    return zeile.kundeMenge !== null && zeile.kundeMenge !== undefined && zeile.anzahl !== null && zeile.kundeMenge === zeile.anzahl;
  }
  /* Ergebnis trägt immer: vorschlag (bool), wahl (null | true | false —
     Ulfs Umschalter, N1), bekannt (Artikelnummer in der Produktliste). */
  function ordneZu(zeile, index) {
    if (!zeile.artNr) return { art: 'ohne_nummer' };
    var treffer = index[zeile.artNr] || [];
    var vorschlag = bestellungVorschlag(zeile);
    var wahl = zeile.kundenbestellung === true || zeile.kundenbestellung === false ? zeile.kundenbestellung : null;
    var extra = function (o) { o.vorschlag = vorschlag; o.wahl = wahl; o.bekannt = treffer.length > 0; return o; };
    if (wahl === null ? vorschlag : wahl) {
      return extra({ art: 'bestellung', produkt: treffer.length === 1 ? treffer[0] : null });   // auch bei bekannter Nummer
    }
    if (treffer.length > 1) return extra({ art: 'konflikt', produkte: treffer });
    if (treffer.length === 0) return extra({ art: 'ohneProdukt' });
    var p = treffer[0];
    if (!/_stueck$/.test(String(p.legacyKey || ''))) return extra({ art: 'kein_stueck', produkt: p });   // der Topf liegt in Stück
    return extra({ art: 'produkt', produkt: p });
  }
  // P4: Charge vom Zettel = stueckProBlech des Produkts (nur Pflege-Hinweis, F6)
  function pruefeCharge(zeile, produkt) {
    if (!produkt || zeile.charge === null) return null;
    var spb = Number(produkt.stueckProBlech);
    if (!Number.isFinite(spb) || spb <= 0) return { ok: false, produkt: null, zettel: zeile.charge };
    return spb === zeile.charge ? null : { ok: false, produkt: spb, zettel: zeile.charge };
  }

  /* ---------- Seiten ---------- */
  function doppelteSeiten(seiten) {
    var gruppen = {};
    (seiten || []).forEach(function (s) {
      if (!s || s.verworfen || !s.abteilung || s.seite === null || s.seite === undefined) return;
      var k = s.abteilung + '|' + s.seite;
      (gruppen[k] = gruppen[k] || []).push(s);
    });
    return Object.keys(gruppen).filter(function (k) { return gruppen[k].length > 1; })
      .map(function (k) { return { abteilung: gruppen[k][0].abteilung, seite: gruppen[k][0].seite, seiten: gruppen[k] }; });
  }
  /* P5 über alle (nicht verworfenen) Seiten: ein Backtag, Wochentag passt,
     alter oder künftiger Backtag → Rückfrage vor dem Speichern. */
  function datumsLage(seiten, heute) {
    var aktiv = (seiten || []).filter(function (s) { return s && !s.verworfen; });
    var daten = {}, probleme = [];
    aktiv.forEach(function (s) {
      var k = s.kopf || {};
      if (!k.datum) probleme.push({ fotoId: s.fotoId, grund: k.grund || 'kein_datum' });
      else {
        daten[k.datum] = true;
        if (!k.wtPasst) probleme.push({ fotoId: s.fotoId, grund: 'wochentag', datum: k.datum, wtKurz: k.wtKurz });
      }
    });
    var liste = Object.keys(daten).sort();
    if (liste.length > 1) probleme.push({ grund: 'mehrere_backtage', daten: liste });
    var backtag = liste.length === 1 ? liste[0] : null;
    var rueckfrage = null;
    if (backtag && heute) {
      var d = tageZwischen(backtag, heute);   // positiv = Backtag liegt zurück
      if (d > ALT_TAGE) rueckfrage = { grund: 'alt', tage: d };
      else if (-d > ZUKUNFT_TAGE) rueckfrage = { grund: 'zukunft', tage: -d };
    }
    return { backtag: backtag, wochentag: backtag ? wochentagLang(backtag) : null, probleme: probleme, rueckfrage: rueckfrage };
  }

  /* ---------- Geschichte aus dem Topf ---------- */
  function vorkommen(tage, artNr, feld, backtag) {
    var n = 0;
    (tage || []).forEach(function (t) {
      if (!t || !t.datum || t.datum === backtag) return;
      var d = tageZwischen(t.datum, backtag);
      if (d <= 0 || d > VORKOMMEN_TAGE) return;
      if (hat(t[feld], artNr)) n++;
    });
    return n;
  }
  /* „fehlt“-Regel (Bauplan §3.3, freigegeben):
     Vergleichstage = gespeicherte Tage desselben Wochentags MIT Seitenangabe
     (nur neue Erfassungen), höchstens FEHLT_TAGE, innerhalb FEHLT_WOCHEN vor
     dem Backtag. Ein Produkt zählt an einem Tag nur, wenn seine Abteilung
     (Nummernkreis) dort erfasst war. Regelmäßig = an ≥ FEHLT_MINDEST dieser
     Tage auf dem Zettel (gezählt oder „zählt nicht“). Hinweis, wenn es heute
     fehlt, seine Abteilung heute aber erfasst ist. Nicht bei pausierten
     Produkten und an Nicht-Backtagen. Bestellungen/ohne Produkt nie (E7).
     Ergebnis: { aktiv, vergleichstage, fehlt: [{ produkt, abteilung, an }] } */
  function fehltListe(a) {
    var wt = wochentagLang(a.backtag);
    var vergleich = (a.tage || []).filter(function (t) {
      if (!t || !t.datum || t.datum >= a.backtag) return false;
      if (!Array.isArray(t.seiten) || !t.seiten.length) return false;
      if (wochentagLang(t.datum) !== wt) return false;
      return tageZwischen(t.datum, a.backtag) <= FEHLT_WOCHEN * 7;
    }).sort(function (x, y) { return y.datum.localeCompare(x.datum); }).slice(0, FEHLT_TAGE);
    if (vergleich.length < FEHLT_MINDEST) return { aktiv: false, vergleichstage: vergleich.length, fehlt: [] };
    var heuteAbt = {};
    (a.heuteAbteilungen || []).forEach(function (x) { heuteAbt[x] = true; });
    var heuteKeys = {};
    (a.heuteKeys || []).forEach(function (k) { heuteKeys[k] = true; });
    var wtIndex = (ausIso(a.backtag).getDay() + 6) % 7;   // Mo = 0 (BOS-Index)
    var fehlt = [];
    (a.produkte || []).forEach(function (p) {
      if (!p || !p.legacyKey) return;
      var abt = kreisAbteilung(p.artNr);
      if (!abt || !heuteAbt[abt]) return;
      if (heuteKeys[p.legacyKey]) return;
      if (p.pausiert === true) return;
      if (a.istBacktag && !a.istBacktag(p, wtIndex)) return;
      var an = 0, moeglich = 0;
      vergleich.forEach(function (t) {
        var erfasst = t.seiten.some(function (s) { return s && s.abteilung === abt; });
        if (!erfasst) return;
        moeglich++;
        if (hat(t.produkte, p.legacyKey) || hat(t.ausgeschlossen, p.legacyKey)) an++;
      });
      if (an >= FEHLT_MINDEST) fehlt.push({ produkt: p, abteilung: abt, an: an, von: moeglich });
    });
    return { aktiv: true, vergleichstage: vergleich.length, fehlt: fehlt };
  }
  function letzterBacktag(tage, heute) {
    var neu = (tage || []).filter(function (t) { return t && t.datum && t.datum <= heute && t.quelle === 'backzettel_ki'; })
      .map(function (t) { return t.datum; }).sort();
    if (!neu.length) return null;
    var l = neu[neu.length - 1];
    var d = tageZwischen(l, heute);
    return { datum: l, tage: d, warnung: d >= STILL_TAGE };
  }

  /* ---------- Einträge → Dokument ----------
     eintraege: [{ art: 'produkt'|'bestellung'|'ohneProdukt', key (legacyKey
     bzw. artNr), anzahl, name, charge, zaehltNicht (bool), grund
     ('abweichung'|'von_hand'), entscheidung ('bisher'|'jetzt'|null), sorten,
     artNr, legacyKeys (alle Produkte mit dieser artNr, aus der Produktliste —
     für N2) }] — von der Seite aus den geprüften Zeilen gebaut. */
  var FELD = { produkt: 'produkte', bestellung: 'bestellungen', ohneProdukt: 'ohneProdukt' };
  function wertVon(eintrag) {
    if (eintrag.art === 'produkt') return eintrag.anzahl;
    if (eintrag.art === 'bestellung') return { name: eintrag.name || null, anzahl: eintrag.anzahl };
    return { name: eintrag.name || null, anzahl: eintrag.anzahl, charge: eintrag.charge === undefined ? null : eintrag.charge };
  }
  function anzahlIn(wert) { return (wert && typeof wert === 'object') ? wert.anzahl : wert; }
  function nummerVon(e) { return artNrNorm(e.artNr) || (e.art !== 'produkt' ? artNrNorm(e.key) : null); }
  /* N2: Wo steht DIESER Artikel im Tag in einem ANDEREN Topf?
     produkte über die legacyKeys des Eintrags, bestellungen/ohneProdukt über
     die artNr. Ergebnis: [{ art, feld, key, wert }] */
  function anderswo(dok, e) {
    var out = [];
    if (!dok) return out;
    var keys = Array.isArray(e.legacyKeys) ? e.legacyKeys : [];
    if (e.art !== 'produkt') {
      keys.forEach(function (lk) {
        if (lk && hat(dok.produkte, lk)) out.push({ art: 'produkt', feld: 'produkte', key: lk, wert: dok.produkte[lk] });
      });
    }
    var nr = nummerVon(e);
    if (nr) {
      ['bestellung', 'ohneProdukt'].forEach(function (art) {
        if (art !== e.art && hat(dok[FELD[art]], nr)) out.push({ art: art, feld: FELD[art], key: nr, wert: dok[FELD[art]][nr] });
      });
    }
    return out;
  }
  /* „bisher / jetzt“: (a) vorhandener Wert desselben Schlüssels im selben Feld
     mit anderer Anzahl, (b) derselbe Artikel steht schon in einem ANDEREN Topf
     (Topfwechsel, N2 — auch bei gleicher Anzahl): wechsel: true, bisherArt.
     Nie still überschreiben (Kompendium §5). */
  function konflikte(altDok, eintraege) {
    if (!altDok) return [];
    var out = [];
    (eintraege || []).forEach(function (e) {
      var feld = FELD[e.art];
      if (!feld) return;
      var weg = anderswo(altDok, e);
      if (weg.length) {
        out.push({ art: e.art, key: e.key, bisher: anzahlIn(weg[0].wert), jetzt: e.anzahl, eintrag: e,
          wechsel: true, bisherArt: weg[0].art, bisherKey: weg[0].key, anderswo: weg });
        return;
      }
      if (!altDok[feld] || !hat(altDok[feld], e.key)) return;
      var bisher = anzahlIn(altDok[feld][e.key]);
      if (bisher !== e.anzahl) out.push({ art: e.art, key: e.key, bisher: bisher, jetzt: e.anzahl, eintrag: e });
    });
    return out;
  }
  function importTag(altDok) {
    return !!altDok && altDok.quelle !== 'backzettel_ki';
  }
  /* Baut das GANZE neue Dokument (wird per transaction.set ohne merge
     geschrieben — B11). Felder des alten Dokuments bleiben, die fünf
     Sammelfelder werden als Ganzes neu gesetzt. Ein zurückgenommener
     Ausschluss fehlt danach wirklich (§3.5).
     N2: Wird ein Artikel in einen Topf geschrieben, verschwindet er aus den
     anderen (produkte samt ausgeschlossen; sorten bleibt). Beim Topfwechsel
     mit „bisher“ bleibt der alte Stand ganz stehen, der neue Topf bekommt
     nichts.
     opt: { datum, modell, promptFassung, serverZeit (Sentinel) }
     Wirft { art: 'import_tag' } bei einem Tag aus dem Import (Fund 12) und
     { art: 'entscheidung_fehlt' }, solange ein „bisher / jetzt“ offen ist. */
  function baueTagesdokument(altDok, eintraege, opt) {
    if (importTag(altDok)) { var e1 = new Error('Für diesen Tag liegen alte BOS1-Zahlen vor — nicht ergänzt.'); e1.art = 'import_tag'; throw e1; }
    var offen = konflikte(altDok, eintraege).filter(function (k) { return k.eintrag.entscheidung !== 'bisher' && k.eintrag.entscheidung !== 'jetzt'; });
    if (offen.length) { var e2 = new Error('Noch ' + offen.length + '× „bisher / jetzt“ offen.'); e2.art = 'entscheidung_fehlt'; e2.offen = offen; throw e2; }
    var alt = altDok || {};
    var dok = {};
    Object.keys(alt).forEach(function (k) { dok[k] = alt[k]; });
    function kopie(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { r[k] = o[k]; }); return r; }
    dok.produkte = kopie(alt.produkte);
    dok.ausgeschlossen = kopie(alt.ausgeschlossen);
    dok.bestellungen = kopie(alt.bestellungen);
    dok.ohneProdukt = kopie(alt.ohneProdukt);
    dok.sorten = kopie(alt.sorten);
    (eintraege || []).forEach(function (e) {
      var feld = FELD[e.art];
      if (!feld) return;
      var weg = anderswo(dok, e);
      var wechselBisher = e.entscheidung === 'bisher' && weg.length > 0;
      if (!wechselBisher) {
        var behalten = e.entscheidung === 'bisher' && hat(dok[feld], e.key);
        if (!behalten) dok[feld][e.key] = wertVon(e);
        weg.forEach(function (w) {
          delete dok[w.feld][w.key];
          if (w.feld === 'produkte') delete dok.ausgeschlossen[w.key];
        });
        if (e.art === 'produkt') {
          if (e.zaehltNicht) dok.ausgeschlossen[e.key] = e.grund === 'von_hand' ? 'von_hand' : 'abweichung';
          else delete dok.ausgeschlossen[e.key];
        }
      }
      if (e.sorten && e.sorten.length && e.artNr) {
        dok.sorten[e.artNr] = e.sorten.map(function (s) { return { art: s.art, anzahl: s.anzahl }; });
      }
    });
    var seiten = (alt.seiten || []).slice();
    (opt.seiten || []).forEach(function (s) {
      if (!seiten.some(function (x) { return x.abteilung === s.abteilung && x.seite === s.seite; })) seiten.push({ abteilung: s.abteilung, seite: s.seite });
    });
    seiten.sort(function (a, b) { return String(a.abteilung).localeCompare(String(b.abteilung), 'de') || (a.seite - b.seite); });
    dok.seiten = seiten;
    dok.type = 'verbrauch_offiziell';
    dok.datum = opt.datum;
    dok.wochentag = wochentagLang(opt.datum);
    dok.quelle = 'backzettel_ki';
    dok.modell = opt.modell || null;
    dok.promptFassung = opt.promptFassung === undefined ? null : opt.promptFassung;
    if (!altDok) dok.erfasstAm = opt.serverZeit;
    dok.zuletztBearbeitet = opt.serverZeit;
    ['ausgeschlossen', 'bestellungen', 'ohneProdukt', 'sorten'].forEach(function (k) { if (!Object.keys(dok[k]).length) delete dok[k]; });
    return dok;
  }

  var L = {
    WT_LANG: WT_LANG, KREISE: KREISE,
    FEHLT_TAGE: FEHLT_TAGE, FEHLT_MINDEST: FEHLT_MINDEST, FEHLT_WOCHEN: FEHLT_WOCHEN,
    VORKOMMEN_TAGE: VORKOMMEN_TAGE, ALT_TAGE: ALT_TAGE, ZUKUNFT_TAGE: ZUKUNFT_TAGE, STILL_TAGE: STILL_TAGE,
    iso: iso, ausIso: ausIso, tageZwischen: tageZwischen, wochentagLang: wochentagLang,
    zahl: zahl, kopf: kopf, abteilungNorm: abteilungNorm, kreisAbteilung: kreisAbteilung, artNrNorm: artNrNorm,
    zeileAusAntwort: zeileAusAntwort, p1: p1, sortenSumme: sortenSumme, pruefeZeile: pruefeZeile,
    produktIndex: produktIndex, bestellungVorschlag: bestellungVorschlag, ordneZu: ordneZu, pruefeCharge: pruefeCharge,
    doppelteSeiten: doppelteSeiten, datumsLage: datumsLage,
    vorkommen: vorkommen, fehltListe: fehltListe, letzterBacktag: letzterBacktag,
    anderswo: anderswo, konflikte: konflikte, importTag: importTag, baueTagesdokument: baueTagesdokument
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  else wurzel.BOS_BACKZETTEL_LOGIK = L;
})(typeof window !== 'undefined' ? window : this);
