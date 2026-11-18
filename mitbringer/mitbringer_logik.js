/* ================================================================
   BäckereiOS · Mitbringer — die Schnittstelle (Logik, Lesen, Schreiben)
   ================================================================
   Einbindung:  <script src="mitbringer_logik.js"></script>   (nach Firebase + bos_firebase_config.js)
   Stellt bereit: window.BOS_MITBRINGER (in Node: module.exports)
   Doku:        mitbringer/MITBRINGER_DOKU.md · Regel: RK §33
   Test:        node mitbringer/_PRUEF_mitbringer_werkzeuge/test_mitbringer.js (Prüfwerkzeug, nie ins Repo)

   EINE Datei für alle, die Mitbringer-Daten brauchen: die Meldeseite
   (mitbringer.html), der Zettel (mitbringer_druck.js, auch im
   Sammeldruck) und später der Monitor im Lager. Niemand liest oder
   schreibt die Sammlungen an dieser Datei vorbei.

   WAS HIER LIEGT
   · Betriebszeit: IMMER Europe/Berlin über Intl, nie toISOString, nie die
     Zeitzone des Geräts. tagVon, tagPlus, zeitpunkt (Ortszeit → Zeitpunkt).
   · Frist: fristMs(tag, …) = Liefertag, Frist-Uhrzeit (Start 05:00,
     Einstellung). vorschlag(): jetzt < Frist(heute) → „heute“, sonst „morgen“.
   · Nachzügler ist KEIN Feld: erstellt (Serverzeit) >= Frist des Tages.
     Bei gedruckten Tagen gilt die Frist aus mitbringer_tage (fristZeit).
   · tagesbild(): fertiges Bild eines Tages (Bereiche, Zeilen, Zettel,
     Nachzügler) — für Bildschirm, Zettel und Monitor dasselbe.
   · beobachteTag(db, tag, rückruf, fehlerRückruf) → Stopp-Funktion.
     DIE Monitor-Schnittstelle: liefert bei jeder Änderung live ein
     tagesbild. Eine Abfrage (tag ==), kein zusammengesetzter Index.
   · Schreiben: melde, aendere, loesche, streiche, nimmAuf,
     speichereMaterial, speichereEinstellungen, legeStartlisteAn,
     haltDruckFest.
   · Druckansicht: druckHTML + DRUCK_CSS (alles unter .bos-zettel-mitbringer).

   DATEN (Firestore, RK §33)
     mitbringer_meldungen/{autoId}  eine Meldung = ein Dokument
       tag 'JJJJ-MM-TT' (fest) · bereich frueh|nacht|konditorei · materialId ·
       materialName (Kopie, Regel prüft sie) · menge 1–999 ganz · einheit ·
       freitext 0–200 · vonKonto, vonPerson, vonName, erstellt (fest, Serverzeit)
       optional: geaendertVon/-Person/-Name/-Am · aufgenommenVon/-Person/-Name/-Am ·
       gestrichenVon/-Person/-Name/-Am
       NAME (RK §34): …Name = Rufname, sonst Beschreibung der Person …Person, die dem Konto
       gehört (Regel nmIch). Kommt NUR aus ichFrisch() → BOS_NAMEN.ichSelbst().
     mitbringer_tage/{JJJJ-MM-TT}   Ausdruck-Stand
       fristZeit (Frist beim ersten Druck, fest) · ersterDruck (fest) ·
       letzterDruck · drucke · druckVon · druckPerson · druckName
     mitbringer_material/{id}       name, einheiten[], aktiv, reihenfolge,
       geaendertVon, geaendertAm, sicherungId — nie löschen
     mitbringer_einstellungen/allgemein  fristMinute, leerzeilen, …
     mitbringer_sicherungen/{autoId}     Vorversion von Material/Einstellungen

   RECHTE (nur die Datenbank entscheidet, hier nur zur Anzeige)
     lesen: jedes freigeschaltete Konto · melden: Personenkonto ·
     drucken: Haken mitbringerDrucken · fremde ändern/streichen,
     Nachzügler aufnehmen, Material, Frist: Haken mitbringerBearbeiten.
     KEINE Rolle zählt, auch admin nicht (Ulf 18.11.2026).

   WARNUNG: FELDER_*, GRENZEN und BEREICHE stehen genauso in der
   Firestore-Regel (firestore_regeln_2026-11-18_namen.rules, RK §33, §34).
   test_mitbringer.js vergleicht beides — immer beide ändern.

   Keine Daten in dieser Datei: keine Personen, keine Betriebsangaben. Die
   Startliste sind allgemeine Wörter (das Repo ist öffentlich).

   2026-11-18 · 02:24 · v1 · Erstfassung (#183; Bauplan 01:22, Go Kontroll-Chat 01:31,
     Ulf 01:28: Sonstiges mit Pflicht-Freitext, lesen für alle Konten, nur Haken, leerer
     Zettel druckbar, nach dem Druck streichen)
     mitbringer/_protokolle/SESSION_2026-11-18_MITBRINGER_BAU.md
   2026-11-18 · 05:45 · v2 · Ein Name überall (RK §34; Bauplan 04:28, Go KC 04:42): Name auf Meldung,
     Änderung, Aufnahme, Streichung und Ausdruck-Stand = Rufname, sonst Beschreibung der EIGENEN Person
     (BOS_NAMEN.ichSelbst, frisch vor jedem Schreiben über ichFrisch), dazu die Personen-Nummer
     (vonPerson, geaendertPerson, aufgenommenPerson, gestrichenPerson, druckPerson). Nie mehr das
     Altfeld bos_accounts.name. REGEL_FASSUNG mitbringer-namen-2026-11-18.
     _protokolle/SESSION_2026-11-18_NAMEN_RUFNAME_BAU.md
   ================================================================ */
(function (global) {
  'use strict';

  var COL = { meldungen: 'mitbringer_meldungen', tage: 'mitbringer_tage', material: 'mitbringer_material',
    einstellungen: 'mitbringer_einstellungen', sicherungen: 'mitbringer_sicherungen' };
  var EINSTELLUNG_ID = 'allgemein';
  var REGEL_FASSUNG = 'mitbringer-namen-2026-11-18';
  var REGEL_DATEI = 'firestore_regeln_2026-11-18_namen.rules';   /* neueste Datei, die REGEL_FASSUNG erfüllt (RK §13) */
  var ZONE = 'Europe/Berlin';
  var SONSTIGES = 'sonstiges';
  var PRUEF_VORSATZ = 'zz_pruef_';   /* Prüf-Material der Prüfseite (Fall Z): keine Seite zeigt es */

  /* Reihenfolge = Reihenfolge auf Bildschirm und Zettel. Namen bleiben deutsch (Drucksache, #87). */
  var BEREICHE = [
    { id: 'frueh', name: 'Frühschicht' },
    { id: 'nacht', name: 'Nachtschicht' },
    { id: 'konditorei', name: 'Konditorei' }
  ];

  var GRENZEN = {
    mengeMin: 1, mengeMax: 999, freitext: 200,
    materialName: 40, einheiten: 8, einheit: 30, reihenfolgeMax: 9999,
    fristMinuteMax: 1439, fristLueckeVon: 120, fristLueckeBis: 180,   /* 02:00–02:59 gibt es an der Zeitumstellung nicht bzw. doppelt */
    leerzeilenMax: 15, druckeMax: 999
  };
  /* Der EINE Startwert der Frist (05:00, Ulf 17.11., „vorläufig“) — gilt nur, solange
     mitbringer_einstellungen/allgemein fehlt. Geändert wird die Frist im Reiter „Material“. */
  var START = { fristMinute: 300, leerzeilen: 5 };

  var FELDER_MELDUNG = ['tag', 'bereich', 'materialId', 'materialName', 'menge', 'einheit', 'freitext', 'vonKonto', 'vonPerson', 'vonName', 'erstellt'];
  var FELDER_INHALT = ['bereich', 'materialId', 'materialName', 'menge', 'einheit', 'freitext'];
  var FELDER_GEAENDERT = ['geaendertVon', 'geaendertPerson', 'geaendertName', 'geaendertAm'];
  var FELDER_AUFGENOMMEN = ['aufgenommenVon', 'aufgenommenPerson', 'aufgenommenName', 'aufgenommenAm'];
  var FELDER_GESTRICHEN = ['gestrichenVon', 'gestrichenPerson', 'gestrichenName', 'gestrichenAm'];
  var FELDER_TAG = ['fristZeit', 'ersterDruck', 'letzterDruck', 'drucke', 'druckVon', 'druckPerson', 'druckName'];
  var FELDER_TAG_NACHDRUCK = ['letzterDruck', 'drucke', 'druckVon', 'druckPerson', 'druckName'];
  var FELDER_MATERIAL = ['name', 'einheiten', 'aktiv', 'reihenfolge', 'geaendertVon', 'geaendertAm', 'sicherungId'];
  var FELDER_EINSTELLUNG = ['fristMinute', 'leerzeilen', 'geaendertVon', 'geaendertAm', 'sicherungId'];
  var FELDER_SICHERUNG = ['collection', 'dokId', 'aktion', 'vorher', 'konto', 'ts'];

  /* Startliste (Bauplan §7): allgemeine Wörter. „Sonstiges“ ist fest: nicht abschaltbar, Freitext Pflicht. */
  var STARTLISTE = [
    { id: 'bleche', name: 'Bleche', einheiten: ['Stück', 'Stapel'], reihenfolge: 10 },
    { id: 'rollcontainer', name: 'Rollcontainer', einheiten: ['Stück'], reihenfolge: 20 },
    { id: 'schlawinerbleche', name: 'Schlawinerbleche', einheiten: ['Stück', 'Stapel'], reihenfolge: 30 },
    { id: 'halbe_kuchenbleche', name: 'Halbe Kuchenbleche', einheiten: ['Stück', 'Stapel'], reihenfolge: 40 },
    { id: 'rote_koerbe', name: 'Rote Körbe', einheiten: ['Stück', 'Stapel', 'Rollcontainer voll'], reihenfolge: 50 },
    { id: 'braune_koerbe', name: 'Braune Körbe', einheiten: ['Stück', 'Stapel', 'Rollcontainer voll'], reihenfolge: 60 },
    { id: SONSTIGES, name: 'Sonstiges', einheiten: ['Stück'], reihenfolge: 9000 }
  ];

  /* ---------- Kleinkram ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function fehler(code, text) { var e = new Error(text); e.code = code; return e; }
  function tsMs(ts) {
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
    if (ts instanceof Date) return ts.getTime();
    return null;
  }

  /* ---------- Betriebszeit Europe/Berlin ---------- */
  var formatierer = null;
  function teile(ms) {
    if (!formatierer) {
      formatierer = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    var o = {};
    formatierer.formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
    return { jahr: o.year, monat: o.month, tag: o.day, stunde: o.hour % 24, minute: o.minute, sekunde: o.second };
  }
  function tagVon(ms) { var p = teile(ms); return p.jahr + '-' + zwei(p.monat) + '-' + zwei(p.tag); }
  function tagTeile(tag) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tag || ''));
    return m ? { jahr: +m[1], monat: +m[2], tag: +m[3] } : null;
  }
  function tagGueltig(tag) {
    var t = tagTeile(tag); if (!t) return false;
    var d = new Date(Date.UTC(t.jahr, t.monat - 1, t.tag));
    return d.getUTCFullYear() === t.jahr && d.getUTCMonth() === t.monat - 1 && d.getUTCDate() === t.tag;
  }
  /* Kalendertag + n (nicht + n·24 Stunden: der Tag hat an der Umstellung 23 oder 25 Stunden) */
  function tagPlus(tag, n) {
    var t = tagTeile(tag); if (!t) return null;
    var d = new Date(Date.UTC(t.jahr, t.monat - 1, t.tag + n));
    return d.getUTCFullYear() + '-' + zwei(d.getUTCMonth() + 1) + '-' + zwei(d.getUTCDate());
  }
  function versatzMs(ms) {
    var p = teile(ms);
    return Date.UTC(p.jahr, p.monat - 1, p.tag, p.stunde, p.minute, p.sekunde) - Math.floor(ms / 1000) * 1000;
  }
  /* Ortszeit (Tag, Minute des Tages) → Zeitpunkt. Eindeutig für alles außer 02:00–02:59 an den
     Umstellungstagen; diese Stunde lässt die Frist-Einstellung nicht zu (GRENZEN.fristLuecke…). */
  function zeitpunkt(tag, minute) {
    var t = tagTeile(tag); if (!t) return NaN;
    var wand = Date.UTC(t.jahr, t.monat - 1, t.tag, 0, minute);
    var a = wand - versatzMs(wand);
    return wand - versatzMs(a);
  }
  var WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function tagKurz(tag) {   /* „Mi 18.11.“ */
    var t = tagTeile(tag); if (!t) return String(tag || '');
    return WOCHENTAGE[new Date(Date.UTC(t.jahr, t.monat - 1, t.tag)).getUTCDay()] + ' ' + zwei(t.tag) + '.' + zwei(t.monat) + '.';
  }
  function uhr(ms) { if (ms === null || !isFinite(ms)) return ''; var p = teile(ms); return zwei(p.stunde) + ':' + zwei(p.minute); }
  function datumUhr(ms) { if (ms === null || !isFinite(ms)) return ''; var p = teile(ms); return zwei(p.tag) + '.' + zwei(p.monat) + '., ' + zwei(p.stunde) + ':' + zwei(p.minute); }
  function uhrText(minute) { return zwei(Math.floor(minute / 60)) + ':' + zwei(minute % 60); }
  function minuteAus(text) {   /* „05:00“ → 300, sonst NaN */
    var m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(text || ''));
    if (!m) return NaN;
    var h = +m[1], mi = +m[2];
    return h <= 23 && mi <= 59 ? h * 60 + mi : NaN;
  }

  /* ---------- Einstellungen, Frist, Vorschlag ---------- */
  function fristMinuteGueltig(n) {
    return typeof n === 'number' && Math.floor(n) === n && n >= 0 && n <= GRENZEN.fristMinuteMax
      && !(n >= GRENZEN.fristLueckeVon && n < GRENZEN.fristLueckeBis);
  }
  function leerzeilenGueltig(n) { return typeof n === 'number' && Math.floor(n) === n && n >= 0 && n <= GRENZEN.leerzeilenMax; }
  /* dok = Daten von mitbringer_einstellungen/allgemein oder null. vorgabe: true = Dokument fehlt, Startwerte gelten. */
  function einstellungenVon(dok) {
    var d = dok || {};
    return {
      fristMinute: fristMinuteGueltig(d.fristMinute) ? d.fristMinute : START.fristMinute,
      leerzeilen: leerzeilenGueltig(d.leerzeilen) ? d.leerzeilen : START.leerzeilen,
      vorgabe: !dok
    };
  }
  /* tagDok (aus tagAus) gewinnt: ein gedruckter Tag behält die Frist seines ersten Drucks. */
  function fristMs(tag, einst, tagDok) {
    if (tagDok && tagDok.fristMs !== null && isFinite(tagDok.fristMs)) return tagDok.fristMs;
    return zeitpunkt(tag, (einst || einstellungenVon(null)).fristMinute);
  }
  /* jetzt < Frist(heute) → „heute“, sonst „morgen“. Genau zur Frist (05:00:00) schon „morgen“. */
  function vorschlag(jetztMs, einst) {
    var e = einst || einstellungenVon(null);
    var heute = tagVon(jetztMs), morgen = tagPlus(heute, 1);
    var fh = zeitpunkt(heute, e.fristMinute);
    return { heute: heute, morgen: morgen, fristHeuteMs: fh, fristMorgenMs: zeitpunkt(morgen, e.fristMinute),
      vorschlag: jetztMs < fh ? 'heute' : 'morgen', tag: jetztMs < fh ? heute : morgen };
  }

  /* ---------- Dokumente lesen ---------- */
  function meldungAus(id, x, wartet) {
    x = x || {};
    return {
      id: id, tag: x.tag, bereich: x.bereich, materialId: x.materialId, materialName: x.materialName,
      menge: x.menge, einheit: x.einheit, freitext: x.freitext || '',
      vonKonto: x.vonKonto, vonName: x.vonName || '', erstelltMs: tsMs(x.erstellt),
      geaendertMs: tsMs(x.geaendertAm), geaendertName: x.geaendertName || '', geaendertVon: x.geaendertVon || '',
      aufgenommenMs: tsMs(x.aufgenommenAm), aufgenommenName: x.aufgenommenName || '',
      gestrichenMs: tsMs(x.gestrichenAm), gestrichenName: x.gestrichenName || '',
      aufgenommen: Object.prototype.hasOwnProperty.call(x, 'aufgenommenAm'),
      gestrichen: Object.prototype.hasOwnProperty.call(x, 'gestrichenAm'),
      wartet: !!wartet
    };
  }
  function tagAus(x) {
    if (!x) return null;
    return { fristMs: tsMs(x.fristZeit), ersterDruckMs: tsMs(x.ersterDruck), letzterDruckMs: tsMs(x.letzterDruck),
      drucke: typeof x.drucke === 'number' ? x.drucke : 0, druckVon: x.druckVon || '', druckName: x.druckName || '' };
  }
  function materialAus(id, x) {
    x = x || {};
    return { id: id, name: String(x.name || ''), einheiten: Array.isArray(x.einheiten) ? x.einheiten.filter(function (e) { return typeof e === 'string' && e; }) : [],
      aktiv: x.aktiv === true, reihenfolge: typeof x.reihenfolge === 'number' ? x.reihenfolge : 0, fest: id === SONSTIGES };
  }
  function nachReihenfolge(a, b) { return (a.reihenfolge - b.reihenfolge) || String(a.name).localeCompare(String(b.name), 'de'); }
  function sichtbaresMaterial(liste) { return (liste || []).filter(function (m) { return m.id.indexOf(PRUEF_VORSATZ) !== 0; }).sort(nachReihenfolge); }
  function aktivesMaterial(liste) { return sichtbaresMaterial(liste).filter(function (m) { return m.aktiv; }); }

  /* ---------- Tagesbild: dasselbe für Bildschirm, Zettel und Monitor ---------- */
  /* frei = steht auf keinem Zettel (wie mbFrei in der Regel): der Melder darf ändern/löschen, mit Haken wird
     wirklich gelöscht statt gestrichen. */
  function istFrei(m, tagDok) {
    if (m.aufgenommen || m.gestrichen) return false;
    if (!tagDok) return true;
    return m.erstelltMs !== null && tagDok.fristMs !== null && m.erstelltMs >= tagDok.fristMs;
  }
  function anzeigeMaterial(m) { return m.materialId === SONSTIGES ? (m.freitext || m.materialName || '') : (m.materialName || ''); }
  function anzeigeNotiz(m) { return m.materialId === SONSTIGES ? '' : (m.freitext || ''); }
  function tagesbild(tag, meldungen, tagDok, einst, jetztMs) {
    var e = einst || einstellungenVon(null);
    var frist = fristMs(tag, e, tagDok);
    var jetzt = typeof jetztMs === 'number' ? jetztMs : Date.now();
    var bild = { tag: tag, fristMs: frist, fristVorbei: jetzt >= frist, gedruckt: tagDok || null, einstellungen: e,
      bereiche: [], fremd: [], anzahl: 0, anzahlZettel: 0, anzahlNachzuegler: 0, neuesteMs: null };
    var je = {};
    BEREICHE.forEach(function (b) { var x = { id: b.id, name: b.name, zeilen: [], zettel: [], nachzuegler: [] }; je[b.id] = x; bild.bereiche.push(x); });
    (meldungen || []).slice().sort(function (a, b) {
      var x = a.erstelltMs === null ? Infinity : a.erstelltMs, y = b.erstelltMs === null ? Infinity : b.erstelltMs;
      return (x - y) || String(a.id).localeCompare(String(b.id));
    }).forEach(function (m) {
      if (m.tag !== tag) return;
      var z = Object.assign({}, m);
      z.material = anzeigeMaterial(m); z.notiz = anzeigeNotiz(m);
      z.nachzuegler = m.erstelltMs !== null ? m.erstelltMs >= frist : jetzt >= frist;
      z.aufZettel = !m.gestrichen && (!z.nachzuegler || m.aufgenommen);
      z.frei = istFrei(m, tagDok);
      /* nochNichtGedruckt: gehört auf den Zettel, kam aber erst nach dem letzten Druck dazu */
      z.nochNichtGedruckt = !!tagDok && z.aufZettel && tagDok.letzterDruckMs !== null
        && Math.max(m.erstelltMs || 0, m.aufgenommenMs || 0) > tagDok.letzterDruckMs;
      var b = je[m.bereich];
      if (!b) { bild.fremd.push(z); return; }
      b.zeilen.push(z);
      if (z.aufZettel) { b.zettel.push(z); bild.anzahlZettel++; }
      if (z.nachzuegler && !m.aufgenommen && !m.gestrichen) { b.nachzuegler.push(z); bild.anzahlNachzuegler++; }
      if (!m.gestrichen) bild.anzahl++;
      if (m.erstelltMs !== null && (bild.neuesteMs === null || m.erstelltMs > bild.neuesteMs)) bild.neuesteMs = m.erstelltMs;
    });
    return bild;
  }

  /* ---------- Eingaben prüfen, Dokumente bauen ---------- */
  function mengeAus(text) {
    var s = String(text == null ? '' : text).trim();
    return /^\d{1,4}$/.test(s) ? parseInt(s, 10) : NaN;
  }
  /* e = { tag?, bereich, materialId, menge, einheit, freitext }, material = materialAus(…) oder null.
     Liefert '' oder einen Schlüssel: bereich · material · material_aus · einheit · menge · freitext_lang · freitext_pflicht · tag */
  function pruefeEingabe(e, material, mitTag) {
    if (mitTag && !tagGueltig(e.tag)) return 'tag';
    if (!BEREICHE.some(function (b) { return b.id === e.bereich; })) return 'bereich';
    if (!material || material.id !== e.materialId) return 'material';
    if (!material.aktiv) return 'material_aus';
    if (material.einheiten.indexOf(e.einheit) === -1) return 'einheit';
    if (typeof e.menge !== 'number' || Math.floor(e.menge) !== e.menge || e.menge < GRENZEN.mengeMin || e.menge > GRENZEN.mengeMax) return 'menge';
    var f = String(e.freitext || '');
    if (f.length > GRENZEN.freitext) return 'freitext_lang';
    if (material.id === SONSTIGES && f.trim().length < 1) return 'freitext_pflicht';
    return '';
  }
  function inhalt(e, material) {
    return { bereich: e.bereich, materialId: material.id, materialName: material.name, menge: e.menge, einheit: e.einheit, freitext: String(e.freitext || '').trim() };
  }
  /* ctx = { kennung, personId, name } aus ichFrisch() (Name ungekürzt, RK §34); zeit = serverTimestamp() */
  function pid(ctx) { return (ctx && typeof ctx.personId === 'string') ? ctx.personId : null; }
  function neueMeldung(e, ctx, material, zeit) {
    return Object.assign({ tag: e.tag }, inhalt(e, material), { vonKonto: ctx.kennung, vonPerson: pid(ctx), vonName: ctx.name || '', erstellt: zeit });
  }
  function inhaltAenderung(e, ctx, material, zeit) {
    return Object.assign(inhalt(e, material), { geaendertVon: ctx.kennung, geaendertPerson: pid(ctx), geaendertName: ctx.name || '', geaendertAm: zeit });
  }
  function aufnahme(ctx, zeit) { return { aufgenommenVon: ctx.kennung, aufgenommenPerson: pid(ctx), aufgenommenName: ctx.name || '', aufgenommenAm: zeit }; }
  function streichung(ctx, zeit) { return { gestrichenVon: ctx.kennung, gestrichenPerson: pid(ctx), gestrichenName: ctx.name || '', gestrichenAm: zeit }; }

  function einheitenAus(text) {   /* „Stück, Stapel“ → ['Stück', 'Stapel'] (ohne Doppelte) */
    var aus = [];
    String(text || '').split(/[,;\n]/).forEach(function (s) { s = s.trim(); if (s && aus.indexOf(s) === -1) aus.push(s); });
    return aus;
  }
  function materialIdAus(name) {   /* „Rote Körbe“ → rote_koerbe */
    var s = String(name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    return s.length >= 2 ? s : '';
  }
  function materialIdGueltig(id) { return /^[a-z0-9_]{2,40}$/.test(String(id || '')); }
  /* e = { name, einheiten[], aktiv, reihenfolge } → '' oder Schlüssel: id · name · einheiten · einheit_lang · reihenfolge · fest_aus */
  function pruefeMaterial(id, e) {
    if (!materialIdGueltig(id)) return 'id';
    var n = String(e.name || '').trim();
    if (n.length < 1 || n.length > GRENZEN.materialName) return 'name';
    if (!Array.isArray(e.einheiten) || e.einheiten.length < 1 || e.einheiten.length > GRENZEN.einheiten) return 'einheiten';
    if (e.einheiten.some(function (x) { return typeof x !== 'string' || x.length < 1 || x.length > GRENZEN.einheit; })) return 'einheit_lang';
    if (typeof e.reihenfolge !== 'number' || Math.floor(e.reihenfolge) !== e.reihenfolge || e.reihenfolge < 0 || e.reihenfolge > GRENZEN.reihenfolgeMax) return 'reihenfolge';
    if (id === SONSTIGES && e.aktiv !== true) return 'fest_aus';
    return '';
  }
  function materialDok(e, ctx, zeit, sicherungId) {
    return { name: String(e.name).trim(), einheiten: e.einheiten.slice(), aktiv: e.aktiv === true, reihenfolge: e.reihenfolge,
      geaendertVon: ctx.kennung, geaendertAm: zeit, sicherungId: sicherungId };
  }
  function einstellungDok(e, ctx, zeit, sicherungId) {
    return { fristMinute: e.fristMinute, leerzeilen: e.leerzeilen, geaendertVon: ctx.kennung, geaendertAm: zeit, sicherungId: sicherungId };
  }
  function sicherungDok(col, id, vorher, ctx, zeit) {
    return { collection: col, dokId: id, aktion: vorher ? 'aendern' : 'anlegen', vorher: vorher || null, konto: ctx.kennung, ts: zeit };
  }

  /* ---------- Rechte (nur Anzeige — das Schloss ist die Regel) ---------- */
  function rechte(konto) {
    var k = konto || {};
    var frei = k.freigeschaltet === true;
    return { lesen: frei, melden: frei && k.art === 'person', drucken: frei && k.mitbringerDrucken === true, bearbeiten: frei && k.mitbringerBearbeiten === true };
  }

  /* ---------- Druckansicht ---------- */
  var Z = '.bos-zettel-mitbringer';
  var DRUCK_CSS = [
    Z + ' .bos-pa-body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.3;color:#000;word-break:normal;}',
    Z + ' .mb-kopf{display:flex;justify-content:space-between;align-items:flex-end;gap:6mm;border-bottom:2px solid #000;padding-bottom:2mm;margin-bottom:3mm;}',
    Z + ' .mb-titel{font-size:18pt;font-weight:700;}',
    Z + ' .mb-stand{font-size:9.5pt;text-align:right;white-space:nowrap;}',
    Z + ' .mb-tab{width:100%;border-collapse:collapse;table-layout:fixed;}',
    Z + ' .mb-tab td,' + Z + ' .mb-tab th{padding:1.6mm 1.5mm;text-align:left;vertical-align:top;border-bottom:0.5pt solid #000;}',
    Z + ' .mb-bereich th{font-size:12pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5pt solid #000;padding-top:5mm;}',
    Z + ' .mb-bereich{break-after:avoid;page-break-after:avoid;}',
    Z + ' .mb-tab tr{break-inside:avoid;page-break-inside:avoid;}',
    Z + ' .mb-c-box{width:8mm;}',
    Z + ' .mb-c-menge{width:14mm;}',
    Z + ' .mb-c-einheit{width:36mm;}',
    Z + ' .mb-c-material{width:48mm;}',
    Z + ' .mb-c-wer{width:30mm;}',
    Z + ' .mb-box span{display:inline-block;width:4.2mm;height:4.2mm;border:1pt solid #000;}',
    Z + ' .mb-menge{font-weight:700;text-align:right;font-size:12pt;}',
    Z + ' .mb-material{font-weight:700;overflow-wrap:anywhere;}',
    Z + ' .mb-notiz{overflow-wrap:anywhere;}',
    Z + ' .mb-wer{font-size:9pt;overflow-wrap:anywhere;}',
    Z + ' .mb-nach{font-size:9pt;font-weight:700;white-space:nowrap;}',
    Z + ' .mb-nichts td{font-style:italic;font-size:10pt;}',
    Z + ' .mb-leerzeile td{height:9mm;}',
    Z + ' .mb-fuss{margin-top:4mm;font-size:9pt;}'
  ].join('\n');
  /* opt: { leerzeilen, gedrucktMs, druckNr }. Auf dem Zettel: pünktliche Meldungen und aufgenommene
     Nachzügler (mit „＋ nachgetragen HH:MM“). Nicht: gestrichene und nicht aufgenommene Nachzügler.
     Immer alle Bereiche, auch ohne Meldung — jeder Bereich hat Leerzeilen zum Eintragen von Hand. */
  function druckHTML(bild, opt) {
    var o = opt || {}, h = [];
    var leer = leerzeilenGueltig(o.leerzeilen) ? o.leerzeilen : bild.einstellungen.leerzeilen;
    var t = tagTeile(bild.tag);
    h.push('<div class="mb-kopf"><div class="mb-titel">Mitbringliste für ' + esc(tagKurz(bild.tag)) + (t ? t.jahr : '') + '</div>' +
      '<div class="mb-stand">gedruckt ' + esc(datumUhr(o.gedrucktMs)) + (o.druckNr > 1 ? ' · ' + o.druckNr + '. Druck' : '') + '</div></div>');
    h.push('<table class="mb-tab"><colgroup><col class="mb-c-box"><col class="mb-c-menge"><col class="mb-c-einheit"><col class="mb-c-material"><col><col class="mb-c-wer"></colgroup>');
    bild.bereiche.forEach(function (b) {
      h.push('<tr class="mb-bereich"><th colspan="6">' + esc(b.name) + '</th></tr>');
      if (!b.zettel.length) h.push('<tr class="mb-nichts"><td colspan="6">noch nichts gemeldet</td></tr>');
      b.zettel.forEach(function (z) {
        var nach = z.nachzuegler ? ' <span class="mb-nach">＋ nachgetragen' + (z.aufgenommenMs ? ' ' + esc(uhr(z.aufgenommenMs)) : '') + '</span>' : '';
        h.push('<tr class="mb-zeile"><td class="mb-box"><span></span></td><td class="mb-menge">' + esc(z.menge) + '</td><td class="mb-einheit">' + esc(z.einheit) + '</td>' +
          '<td class="mb-material">' + esc(z.material) + '</td><td class="mb-notiz">' + esc(z.notiz) + nach + '</td><td class="mb-wer">' + esc(z.vonName || z.vonKonto || '') + '</td></tr>');
      });
      for (var i = 0; i < leer; i++) h.push('<tr class="mb-leerzeile"><td class="mb-box"><span></span></td><td></td><td></td><td></td><td></td><td></td></tr>');
    });
    h.push('</table>');
    if (leer > 0) h.push('<div class="mb-fuss">Leere Zeilen: von Hand eintragen, was noch gebraucht wird (Menge, Einheit, Material, Name).</div>');
    return h.join('');
  }
  /* Optionen für BOS_DRUCK (Zettel-Form): ohne den großen Kopf, schwarz-weiß, hochkant. */
  function druckOptionen(bild, opt) {
    return { inhaltHTML: druckHTML(bild, opt), appName: 'Mitbringer', mitKopf: false, farbig: false, ausrichtung: 'portrait',
      extraCSS: DRUCK_CSS, dateiname: 'Mitbringliste' };
  }

  /* ================================================================
     Firestore: lesen, beobachten, schreiben. db = Firestore-Instanz.
     ================================================================ */
  function fv() {
    var f = global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue;
    if (!f) throw fehler('mitbringer/firebase', 'Firebase ist nicht geladen (FieldValue fehlt)');
    return f;
  }
  function jetztServer() { return fv().serverTimestamp(); }

  /* DIE Monitor-Schnittstelle. rückruf(bild, roh) bei jeder Änderung an den Meldungen des Tages, am
     Ausdruck-Stand oder an den Einstellungen (erst, wenn alle drei einmal da waren). roh = { meldungen,
     tagDok, einst } zum Neurechnen ohne neue Daten (tagesbild(tag, roh.meldungen, roh.tagDok, roh.einst, jetzt)).
     fehlerRückruf(err, was) je gescheitertem Abo. Rückgabe: Funktion, die alle Abos beendet. */
  function beobachteTag(db, tag, rueckruf, fehlerRueckruf, opt) {
    var o = opt || {}, da = { m: false, t: false, e: false }, zu = false;
    var roh = { meldungen: [], tagDok: null, einst: einstellungenVon(null) };
    function melde() {
      if (zu || !da.m || !da.t || !da.e) return;
      rueckruf(tagesbild(tag, roh.meldungen, roh.tagDok, roh.einst, o.jetzt ? o.jetzt() : Date.now()), roh);
    }
    function kaputt(was) { return function (err) { if (!zu && fehlerRueckruf) fehlerRueckruf(err, was); }; }
    var abos = [
      db.collection(COL.meldungen).where('tag', '==', tag).onSnapshot({ includeMetadataChanges: true }, function (snap) {
        var a = [];
        snap.forEach(function (d) { a.push(meldungAus(d.id, d.data({ serverTimestamps: 'estimate' }), d.metadata && d.metadata.hasPendingWrites)); });
        roh.meldungen = a; da.m = true; melde();
      }, kaputt(COL.meldungen)),
      db.collection(COL.tage).doc(tag).onSnapshot({}, function (d) {
        roh.tagDok = d.exists ? tagAus(d.data({ serverTimestamps: 'estimate' })) : null; da.t = true; melde();
      }, kaputt(COL.tage)),
      db.collection(COL.einstellungen).doc(EINSTELLUNG_ID).onSnapshot({}, function (d) {
        roh.einst = einstellungenVon(d.exists ? d.data() : null); da.e = true; melde();
      }, kaputt(COL.einstellungen))
    ];
    return function () { zu = true; abos.forEach(function (f) { try { f(); } catch (e) { /* schon beendet */ } }); };
  }
  function beobachteMaterial(db, rueckruf, fehlerRueckruf) {
    return db.collection(COL.material).onSnapshot(function (snap) {
      var a = []; snap.forEach(function (d) { a.push(materialAus(d.id, d.data())); });
      rueckruf(a);
    }, function (err) { if (fehlerRueckruf) fehlerRueckruf(err, COL.material); });
  }
  /* Einmal frisch vom Server (für den Druck): { meldungen, tagDok, einst } */
  function ladeTag(db, tag) {
    var S = { source: 'server' };
    return Promise.all([
      db.collection(COL.meldungen).where('tag', '==', tag).get(S),
      db.collection(COL.tage).doc(tag).get(S),
      db.collection(COL.einstellungen).doc(EINSTELLUNG_ID).get(S)
    ]).then(function (r) {
      var a = []; r[0].forEach(function (d) { a.push(meldungAus(d.id, d.data(), false)); });
      return { meldungen: a, tagDok: r[1].exists ? tagAus(r[1].data()) : null, einst: einstellungenVon(r[2].exists ? r[2].data() : null) };
    });
  }
  /* Name frisch vor JEDEM Schreibvorgang (RK §34, Go KC 04:42): → ctx { kennung, personId, name, quelle }.
     Ohne Person, ohne Namen: abgelehnt mit code 'mitbringer/name-<grund>' und dem sichtbaren Satz aus
     BOS_NAMEN.ichSelbst. Beim Lesefehler mit dem ECHTEN code (z. B. permission-denied, unavailable) und
     dem Satz „Dein Name ließ sich nicht lesen: <code — message>“; err.ich = Ergebnis von ichSelbst. Melden nur
     Personen — darum kein Ort-Rückfall (ortErlaubt fehlt). */
  function ichFrisch(db, kennung, konto) {
    var N = global.BOS_NAMEN;
    if (!N || typeof N.ichSelbst !== 'function') return Promise.reject(fehler('mitbringer/name-modul', 'bos_namen.js (ab v1.3, ichSelbst) ist nicht geladen — Seite neu laden.'));
    return N.ichSelbst(db, kennung, { konto: konto || null }).then(function (r) {
      /* Beim Lesefehler bleibt der echte Code (permission-denied, unavailable …) — die Seite erklärt ihn dann wie jeden anderen. */
      if (r.grund) { var f = fehler(r.grund === 'lesefehler' && r.fehler && r.fehler.code ? r.fehler.code : 'mitbringer/name-' + r.grund, r.text); f.ich = r; throw f; }
      return { kennung: kennung, personId: r.personId, name: r.name, quelle: r.quelle };
    });
  }
  function ladeKonto(db, kennung) {
    return db.collection('bos_accounts').doc(kennung).get().then(function (d) { return d.exists ? d.data() : null; });
  }
  /* 'passt' · 'alt' (Regel kennt die Fassung nicht) · 'unbekannt' (wohl kein Netz) */
  function pruefeRegelstand(db) {
    return db.collection('bos_regelstand').doc(REGEL_FASSUNG).get({ source: 'server' })
      .then(function () { return { stand: 'passt', grund: '' }; })
      .catch(function (err) {
        return { stand: err && err.code === 'permission-denied' ? 'alt' : 'unbekannt', grund: (err && err.code ? err.code + ' — ' : '') + ((err && err.message) || String(err)) };
      });
  }

  /* Melden. Löst erst auf, wenn der Server bestätigt hat; liefert { id, erstelltMs } (Serverzeit), damit die
     Seite ehrlich sagen kann, ob die Meldung als Nachzügler angekommen ist. */
  function melde(db, ctx, e, material) {
    var p = pruefeEingabe(e, material, true);
    if (p) return Promise.reject(fehler('mitbringer/eingabe-' + p, 'Eingabe ungültig: ' + p));
    var ref = db.collection(COL.meldungen).doc();
    return ref.set(neueMeldung(e, ctx, material, jetztServer())).then(function () {
      return ref.get({ source: 'server' }).then(function (d) { return { id: ref.id, erstelltMs: d.exists ? tsMs(d.data().erstellt) : null }; },
        function () { return { id: ref.id, erstelltMs: null }; });
    });
  }
  function aendere(db, ctx, id, e, material) {
    var p = pruefeEingabe(e, material, false);
    if (p) return Promise.reject(fehler('mitbringer/eingabe-' + p, 'Eingabe ungültig: ' + p));
    return db.collection(COL.meldungen).doc(id).update(inhaltAenderung(e, ctx, material, jetztServer()));
  }
  function loesche(db, id) { return db.collection(COL.meldungen).doc(id).delete(); }
  function streiche(db, ctx, id) { return db.collection(COL.meldungen).doc(id).update(streichung(ctx, jetztServer())); }
  function nimmAuf(db, ctx, id) { return db.collection(COL.meldungen).doc(id).update(aufnahme(ctx, jetztServer())); }

  /* Material/Einstellungen: Vorversion und neues Dokument in EINEM Vorgang (Regel mbGesichert). */
  function schreibeGesichert(db, ctx, col, id, bauen) {
    var ref = db.collection(col).doc(id);
    return ref.get({ source: 'server' }).then(function (s) {
      var vorher = s.exists ? s.data() : null;
      var sr = db.collection(COL.sicherungen).doc();
      var b = db.batch();
      b.set(sr, sicherungDok(col, id, vorher, ctx, jetztServer()));
      b.set(ref, bauen(sr.id));
      return b.commit();
    });
  }
  function speichereMaterial(db, ctx, id, e) {
    var p = pruefeMaterial(id, e);
    if (p) return Promise.reject(fehler('mitbringer/material-' + p, 'Material ungültig: ' + p));
    return schreibeGesichert(db, ctx, COL.material, id, function (sid) { return materialDok(e, ctx, jetztServer(), sid); });
  }
  function speichereEinstellungen(db, ctx, e) {
    if (!fristMinuteGueltig(e.fristMinute)) return Promise.reject(fehler('mitbringer/einstellung-frist', 'Frist ungültig'));
    if (!leerzeilenGueltig(e.leerzeilen)) return Promise.reject(fehler('mitbringer/einstellung-leerzeilen', 'Leerzeilen ungültig'));
    return schreibeGesichert(db, ctx, COL.einstellungen, EINSTELLUNG_ID, function (sid) { return einstellungDok(e, ctx, jetztServer(), sid); });
  }
  /* Legt nur an, was es noch nicht gibt. Liefert die Namen der neu angelegten Materialien. */
  function legeStartlisteAn(db, ctx) {
    return db.collection(COL.material).get({ source: 'server' }).then(function (snap) {
      var da = {}; snap.forEach(function (d) { da[d.id] = true; });
      var neu = STARTLISTE.filter(function (m) { return !da[m.id]; });
      if (!neu.length) return [];
      var b = db.batch();
      neu.forEach(function (m) {
        var sr = db.collection(COL.sicherungen).doc();
        b.set(sr, sicherungDok(COL.material, m.id, null, ctx, jetztServer()));
        b.set(db.collection(COL.material).doc(m.id), materialDok({ name: m.name, einheiten: m.einheiten, aktiv: true, reihenfolge: m.reihenfolge }, ctx, jetztServer(), sr.id));
      });
      return b.commit().then(function () { return neu.map(function (m) { return m.name; }); });
    });
  }
  /* Ausdruck-Stand festhalten. frist = Frist-Zeitpunkt des Tages (ms). Liefert { nr } (1 = erster Druck).
     Läuft im selben Augenblick ein zweiter Druck, lehnt die Regel einen der beiden ab (drucke muss um
     genau 1 steigen) — dann nochmal drucken. */
  function haltDruckFest(db, ctx, tag, frist) {
    var ref = db.collection(COL.tage).doc(tag);
    return ref.get({ source: 'server' }).then(function (s) {
      var z = jetztServer();
      if (!s.exists) {
        return ref.set({ fristZeit: new Date(frist), ersterDruck: z, letzterDruck: z, drucke: 1, druckVon: ctx.kennung, druckPerson: pid(ctx), druckName: ctx.name || '' })
          .then(function () { return { nr: 1 }; });
      }
      var n = (typeof s.data().drucke === 'number' ? s.data().drucke : 0) + 1;
      return ref.update({ letzterDruck: z, drucke: n, druckVon: ctx.kennung, druckPerson: pid(ctx), druckName: ctx.name || '' }).then(function () { return { nr: n }; });
    });
  }

  var api = {
    COL: COL, EINSTELLUNG_ID: EINSTELLUNG_ID, REGEL_FASSUNG: REGEL_FASSUNG, REGEL_DATEI: REGEL_DATEI, ZONE: ZONE,
    SONSTIGES: SONSTIGES, PRUEF_VORSATZ: PRUEF_VORSATZ, BEREICHE: BEREICHE, GRENZEN: GRENZEN, START: START, STARTLISTE: STARTLISTE,
    FELDER_MELDUNG: FELDER_MELDUNG, FELDER_INHALT: FELDER_INHALT, FELDER_GEAENDERT: FELDER_GEAENDERT, FELDER_AUFGENOMMEN: FELDER_AUFGENOMMEN,
    FELDER_GESTRICHEN: FELDER_GESTRICHEN, FELDER_TAG: FELDER_TAG, FELDER_TAG_NACHDRUCK: FELDER_TAG_NACHDRUCK, FELDER_MATERIAL: FELDER_MATERIAL,
    FELDER_EINSTELLUNG: FELDER_EINSTELLUNG, FELDER_SICHERUNG: FELDER_SICHERUNG,
    esc: esc, tsMs: tsMs, teile: teile, tagVon: tagVon, tagPlus: tagPlus, tagGueltig: tagGueltig, zeitpunkt: zeitpunkt,
    tagKurz: tagKurz, uhr: uhr, datumUhr: datumUhr, uhrText: uhrText, minuteAus: minuteAus,
    fristMinuteGueltig: fristMinuteGueltig, leerzeilenGueltig: leerzeilenGueltig, einstellungenVon: einstellungenVon,
    fristMs: fristMs, vorschlag: vorschlag,
    meldungAus: meldungAus, tagAus: tagAus, materialAus: materialAus, sichtbaresMaterial: sichtbaresMaterial, aktivesMaterial: aktivesMaterial,
    istFrei: istFrei, tagesbild: tagesbild,
    mengeAus: mengeAus, pruefeEingabe: pruefeEingabe, neueMeldung: neueMeldung, inhaltAenderung: inhaltAenderung, aufnahme: aufnahme, streichung: streichung,
    einheitenAus: einheitenAus, materialIdAus: materialIdAus, materialIdGueltig: materialIdGueltig, pruefeMaterial: pruefeMaterial,
    materialDok: materialDok, einstellungDok: einstellungDok, sicherungDok: sicherungDok,
    rechte: rechte, DRUCK_CSS: DRUCK_CSS, druckHTML: druckHTML, druckOptionen: druckOptionen,
    beobachteTag: beobachteTag, beobachteMaterial: beobachteMaterial, ladeTag: ladeTag, ladeKonto: ladeKonto, ichFrisch: ichFrisch, pruefeRegelstand: pruefeRegelstand,
    melde: melde, aendere: aendere, loesche: loesche, streiche: streiche, nimmAuf: nimmAuf,
    speichereMaterial: speichereMaterial, speichereEinstellungen: speichereEinstellungen, legeStartlisteAn: legeStartlisteAn, haltDruckFest: haltDruckFest
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_MITBRINGER = api;
})(typeof window !== 'undefined' ? window : globalThis);
