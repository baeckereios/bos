/* ================================================================
   BäckereiOS · maschinenseite/maschinen_logik.js — Maschinen, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_MASCHINEN (in Node: module.exports)

   Einbindung NACH bos_firebase_config.js (braucht window.db,
   window.BOS_AUTH_READY, window.firebase), vor dem Seitencode:
     <script src="../maschinenseite/maschinen_logik.js"></script>   (aus einem anderen Ordner)
     <script src="maschinen_logik.js"></script>                     (aus maschinenseite/)

   WARUM eine eigene Datei: Zwei Seiten brauchen die Maschinen — die
   Maschinenseite (alles) und der Produkt-Editor (Maschinenliste für den
   Werdegang). Laden, Grenzen, Dokumente bauen, Schreiben und „warum hat
   die Datenbank nein gesagt“ stehen nur hier. Kein DOM.

   DATEN (Firestore, Regel RK §27, Fassung REGEL_FASSUNG):
     maschinen/{maschineId}                 nur Rolle admin schreibt
       name, exemplare { "1": "Stikkenofen 1", … }, fuehrer [Kennungen],
       felder [{ id, name, art: 'text'|'nummer' }], geloescht?,
       geaendertVon, geaendertAm
       (reserviert, NICHT gebaut, NICHT in der Regel: apps — K6)
     maschinen_reihenfolge/{maschineId}     nur Maschinenführer
       produkte [legacyKey …], geaendertVon, geaendertVonName, geaendertAm
     maschinen_angaben/{maschineId}__{legacyKey}   nur Maschinenführer
       maschine, produkt, werte { feldId: 'Text' }, frueher [ { werte, von,
       vonName, am } … ] (neueste zuerst, höchstens 20), geaendertVon,
       geaendertVonName, geaendertAm
     Produktfeld werdegang [maschineId …] — schreibt der Produkt-Editor,
       nicht diese Datei.

   STUFE B (24.10.2026, Regel RK §28, Fassung REGEL_FASSUNG):
     maschinen_notizen/{auto}   Chatfenster — jedes Personenkonto
       maschine, exemplar ("1"…"12" | "alle"), text (≤ 500), von, vonName,
       erstellt (Serverzeit), fristStart (= erstellt; fehlt = angepinnt),
       angepinntVon, angepinntVonName (nur solange angepinnt).
       Gelöscht wird von der TTL-Richtlinie der Datenbank: Feld fristStart,
       Versatz 40 Tage (Google-Cloud-Konsole bzw. Cloud Shell). Die Seite
       blendet selbst nach FRIST_TAGE aus (K2) und rechnet NIE mit
       fristStart, immer mit erstellt.
       RÜCKFALL (a): FRIST_WEG = 'fenster' — Feld ablauf = erstellt + 40 Tage
       (beim Anlegen aus der Gerätezeit, die Regel lässt ±1 h zu; beim Lösen
       genau aus dem gelesenen erstellt, MIT Nanosekunden). Dazu gehört die
       Regeldatei RUECKFALL.datei. Nur Konstante + Datei wechseln (Auflage B1).
     maschinen_karten/{auto}    Info-Karten — nur Maschinenführer
       maschine, exemplar, titel (≤ 60), text (≤ 2000), rang (0–99),
       stand (1, dann genau +1 = Sperrzettel), geaendertVon,
       geaendertVonName, geaendertAm.
     Offene Reparaturanfragen: BOS_MELDUNGEN.offen() (bos_meldungen.js),
       hier nur der Abgleich Gerät ↔ Exemplar-Name (geraetPasst).

   frueher (K12): Beim Speichern rutscht der BISHERIGE Serverstand vorn in
   die Liste, der Rest rutscht nach, ab 21 fällt der älteste weg. Die
   Regel prüft das Wort für Wort (msFolgt). Wer auf einem veralteten Stand
   speichert, wird abgelehnt — das ist der Sperrzettel.

   WARNUNG: GRENZEN und ID_MUSTER stehen genauso in der Firestore-Regel
   (RK §27). test_maschinen.js --regeln=<Datei> vergleicht beides. Wer hier
   dreht, dreht dort mit — und umgekehrt.

   CHANGELOG
     2026-10-27 · 00:06 · v1.4 · Nur REGEL_DATEI (Hauptform): nennt jetzt die neueste Regeldatei firestore_regeln_2026-10-27_nachrichten.rules
       (Nachrichtenzentrale Stufe 1b, Nacharbeit N1 des Kontroll-Chats 00:01; RK §29). Sonst unverändert. nachrichtenzentrale/_protokolle/SESSION_2026-10-27_NACHRICHTENZENTRALE_STUFE_1B_BAU.md Der Rückfall-Zweig (RUECKFALL) bleibt unverändert.
     2026-10-24 · 13:41 · v1.3 · Feature (Nachtrag 2, Go KC 24.10. 13:28, M43): notizenSicht() —
       angepinnte + die neuesten fünf, Rest „älter“ (rein, additiv). Sonst unverändert.
       SESSION_2026-10-24_MASCHINENSEITE_NACHTRAG_2_BAU.md
     2026-10-24 · 11:30 · v1.2 · Feature (Nachtrag Übersicht, Go KC 24.10. 11:1x, K16):
       ofenKurz() für die Ofenknöpfe der Kopfleiste (rein, additiv). Sonst unverändert.
       SESSION_2026-10-24_MASCHINENSEITE_NACHTRAG_UEBERSICHT_BAU.md
     2026-10-24 · 07:46 · v1.1 · Feature (Maschinenseite Stufe B, Bauplan Go KC 24.10.,
       00:32, Auflagen B1–B7): Ofen wählen, Reparatur-Link, Abgleich offener
       Anfragen (geraetPasst), Notizen (Chatfenster, FRIST_WEG versatz|fenster),
       Info-Karten (stand), erklaere() für notiz/karte. REGEL_FASSUNG
       maschinen-b-2026-10-24, REGEL_DATEI …_2026-10-24_maschinen_b.rules.
       SESSION_2026-10-24_MASCHINENSEITE_STUFE_B_BAU.md
     2026-10-23 · 23:04 · v1.0 · Neu (Maschinenseite Stufe A, #115/#116;
       Bauplan Go KC 22:22, SESSION_2026-10-23_MASCHINENSEITE_STUFE_A_BAU.md)
   ================================================================ */
(function (global) {
  'use strict';

  /* Weg der Notiz-Frist (Auflage B1): 'versatz' = Weg (c), 40 Tage als Versatz der TTL-Richtlinie;
     'fenster' = Rückfall (a), wenn die Konsole keinen Versatz anbietet. Nur zusammen mit der
     Regeldatei wechseln (REGEL_DATEI bzw. RUECKFALL.datei). */
  var FRIST_WEG = 'versatz';
  var REGEL_FASSUNG = 'maschinen-b-2026-10-24';
  var REGEL_DATEI = 'firestore_regeln_2026-10-27_nachrichten.rules';   /* neueste Datei, die REGEL_FASSUNG erfüllt (RK §13, Pflege) */
  var RUECKFALL = { fassung: 'maschinen-b-fenster-2026-10-24', datei: 'RUECKFALL_A_firestore_regeln_2026-10-24_maschinen_b.rules' };
  if (FRIST_WEG === 'fenster') { REGEL_FASSUNG = RUECKFALL.fassung; REGEL_DATEI = RUECKFALL.datei; }
  var FRIST_FELD = FRIST_WEG === 'fenster' ? 'ablauf' : 'fristStart';
  var FRIST_TAGE = 40;
  var TAG_MS = 86400000;
  var SAMMLUNG = { MASCHINEN: 'maschinen', REIHENFOLGE: 'maschinen_reihenfolge', ANGABEN: 'maschinen_angaben', NOTIZEN: 'maschinen_notizen', KARTEN: 'maschinen_karten' };
  /* muss 1:1 zur Regel passen (RK §27) */
  var GRENZEN = {
    ID_MUSTER: '^[a-z0-9]{2,30}$', NAME: 40, EXEMPLARE: 12, FUEHRER: 20, FELDER: 12,
    WERTE: 12, FRUEHER: 20, REIHENFOLGE: 300, VON_NAME: 40
  };
  /* nur die Seite (Regel prüft Werte nicht einzeln, RK §27 A3) */
  var SEITE = { TEXT: 300, NUMMER_STELLEN: 4, EXEMPLAR_NAME: 40, FELD_NAME: 40, FELD_ID: 30 };
  /* Stufe B — Regel RK §28 (Notiz 500, Titel 60, Karte 2000, rang 0–99, Name 40); Karten je Maschine zählt nur die Seite */
  var GRENZEN_B = { NOTIZ: 500, TITEL: 60, KARTE: 2000, RANG_MAX: 99, KARTEN_MAX: 12 };
  var KARTEN_VORSCHLAEGE = ['Kurz & wichtig', 'Eigenheiten', 'Einstellungen / Richtwerte', 'Reinigung', 'Bei Störung'];
  var FELD_ARTEN = ['text', 'nummer'];
  var ZEITLIMIT_MS = 15000;
  var ID_RE = new RegExp(GRENZEN.ID_MUSTER);
  var NUMMER_RE = /^[0-9]{1,4}$/;

  function istKarte(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function text(x) { return x === null || x === undefined ? '' : String(x); }
  function zwei(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- Kennungen ---------- */
  function idGueltig(id) { return typeof id === 'string' && ID_RE.test(id); }
  function angabenId(maschineId, produktKey) { return maschineId + '__' + produktKey; }
  /* Feld-Kennung aus der Beschriftung: „Programm Ganz“ → programm_ganz, eindeutig gemacht. */
  function feldIdAus(name, vorhanden) {
    var basis = text(name).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, SEITE.FELD_ID - 3) || 'feld';
    var belegt = {}; (vorhanden || []).forEach(function (x) { belegt[x] = true; });
    if (!belegt[basis]) return basis;
    for (var i = 2; i < 100; i++) if (!belegt[basis + '_' + i]) return basis + '_' + i;
    return basis + '_' + Date.now();
  }
  function exemplarSchluessel(exemplare) {
    return Object.keys(exemplare || {}).filter(function (k) { return /^[0-9]+$/.test(k); })
      .sort(function (a, b) { return Number(a) - Number(b); });
  }
  function naechsterExemplarSchluessel(exemplare) {
    var s = exemplarSchluessel(exemplare);
    return String(s.length ? Number(s[s.length - 1]) + 1 : 1);
  }
  function standardFelder() { return [{ id: 'hinweis', name: 'Hinweis', art: 'text' }]; }

  /* ---------- Maschine prüfen und bauen ---------- */
  /* eingabe: { id, name, exemplare, fuehrer, felder, geloescht } — Ergebnis: Liste von Fehlertexten. */
  function pruefeMaschine(e) {
    var f = [];
    if (!e || typeof e !== 'object') return ['Keine Angaben.'];
    if (!idGueltig(e.id)) f.push('Kennung: nur Kleinbuchstaben und Ziffern, 2 bis 30 Zeichen, kein Leerzeichen, kein Unterstrich.');
    var name = text(e.name).trim();
    if (!name) f.push('Name fehlt.');
    else if (name.length > GRENZEN.NAME) f.push('Name: höchstens ' + GRENZEN.NAME + ' Zeichen.');
    var ex = exemplarSchluessel(e.exemplare);
    if (!istKarte(e.exemplare) || !ex.length) f.push('Mindestens ein Exemplar.');
    else if (Object.keys(e.exemplare).length !== ex.length) f.push('Exemplare: unbekannter Schlüssel.');
    else if (ex.length > GRENZEN.EXEMPLARE) f.push('Höchstens ' + GRENZEN.EXEMPLARE + ' Exemplare.');
    else ex.forEach(function (k) {
      var n = text(e.exemplare[k]).trim();
      if (!n) f.push('Exemplar ' + k + ': Name fehlt.');
      else if (n.length > SEITE.EXEMPLAR_NAME) f.push('Exemplar ' + k + ': höchstens ' + SEITE.EXEMPLAR_NAME + ' Zeichen.');
    });
    if (!Array.isArray(e.fuehrer)) f.push('Maschinenführer: keine Liste.');
    else {
      if (e.fuehrer.length > GRENZEN.FUEHRER) f.push('Höchstens ' + GRENZEN.FUEHRER + ' Maschinenführer.');
      var gesehen = {};
      e.fuehrer.forEach(function (k) {
        if (typeof k !== 'string' || !/^[a-z0-9._-]{1,60}$/.test(k)) f.push('Maschinenführer: ungültige Kennung „' + text(k) + '“.');
        else if (gesehen[k]) f.push('Maschinenführer doppelt: ' + k + '.');
        gesehen[k] = true;
      });
    }
    if (!Array.isArray(e.felder) || !e.felder.length) f.push('Mindestens ein Feld (Standard: Hinweis).');
    else {
      if (e.felder.length > GRENZEN.FELDER) f.push('Höchstens ' + GRENZEN.FELDER + ' Felder.');
      var ids = {};
      e.felder.forEach(function (x, i) {
        var n = 'Feld ' + (i + 1);
        if (!istKarte(x)) { f.push(n + ': ungültig.'); return; }
        if (typeof x.id !== 'string' || !/^[a-z0-9_]{1,30}$/.test(x.id)) f.push(n + ': ungültige Kennung.');
        else if (ids[x.id]) f.push(n + ': Kennung doppelt (' + x.id + ').');
        ids[x.id] = true;
        var fn = text(x.name).trim();
        if (!fn) f.push(n + ': Beschriftung fehlt.');
        else if (fn.length > SEITE.FELD_NAME) f.push(n + ': Beschriftung höchstens ' + SEITE.FELD_NAME + ' Zeichen.');
        if (FELD_ARTEN.indexOf(x.art) === -1) f.push(n + ': Art muss Text oder Nummer sein.');
      });
    }
    return f;
  }
  function maschineDokument(e, kennung, zeit) {
    var ex = {};
    exemplarSchluessel(e.exemplare).forEach(function (k) { ex[k] = text(e.exemplare[k]).trim(); });
    var d = {
      name: text(e.name).trim(), exemplare: ex, fuehrer: (e.fuehrer || []).slice(),
      felder: (e.felder || []).map(function (x) { return { id: x.id, name: text(x.name).trim(), art: x.art }; }),
      geaendertVon: kennung, geaendertAm: zeit
    };
    if (e.geloescht === true) d.geloescht = true;
    return d;
  }
  function istFuehrer(maschine, kennung) {
    return !!maschine && maschine.geloescht !== true && Array.isArray(maschine.fuehrer) && maschine.fuehrer.indexOf(kennung) !== -1;
  }

  /* ---------- Werte ---------- */
  /* Ein Eingabewert → gespeicherter Text oder null (leer = Feld fehlt in werte). */
  function normWert(feld, roh) {
    var s = text(roh).replace(/\r\n?/g, '\n');
    s = feld && feld.art === 'nummer' ? s.replace(/\s+/g, '') : s.trim();
    return s === '' ? null : s;
  }
  function pruefeWert(feld, roh) {
    var s = normWert(feld, roh);
    if (s === null) return null;
    if (feld.art === 'nummer' && !NUMMER_RE.test(s)) return feld.name + ': nur Ziffern, höchstens ' + SEITE.NUMMER_STELLEN + '.';
    if (feld.art !== 'nummer' && s.length > SEITE.TEXT) return feld.name + ': höchstens ' + SEITE.TEXT + ' Zeichen (jetzt ' + s.length + ').';
    return null;
  }
  /* Neue Werte-Karte: Felder der Maschine aus der Eingabe, alle übrigen
     Schlüssel (entfernte Felder) bleiben aus dem bisherigen Stand (K10). */
  function werteAus(felder, eingabe, alteWerte) {
    var neu = {};
    var aktiv = {};
    (felder || []).forEach(function (f) { aktiv[f.id] = true; });
    Object.keys(alteWerte || {}).forEach(function (k) { if (!aktiv[k]) neu[k] = alteWerte[k]; });
    (felder || []).forEach(function (f) {
      var v = normWert(f, (eingabe || {})[f.id]);
      if (v !== null) neu[f.id] = v;
    });
    return neu;
  }
  function werteGleich(a, b) {
    var ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
    if (ka.join('\u0001') !== kb.join('\u0001')) return false;
    return ka.every(function (k) { return text(a[k]) === text(b[k]); });
  }

  /* ---------- Angaben-Dokument mit frueher (K12) ---------- */
  function frueherEintrag(alt) {
    return { werte: alt.werte, von: alt.geaendertVon, vonName: alt.geaendertVonName, am: alt.geaendertAm };
  }
  /* alt = rohes Serverdokument oder null. ich = { kennung, name }. */
  function angabenDokument(maschineId, produktKey, werte, alt, ich, zeit) {
    var frueher = [];
    if (alt) {
      frueher = [frueherEintrag(alt)].concat(Array.isArray(alt.frueher) ? alt.frueher : []);
      if (frueher.length > GRENZEN.FRUEHER) frueher = frueher.slice(0, GRENZEN.FRUEHER);
    }
    return {
      maschine: maschineId, produkt: produktKey, werte: werte, frueher: frueher,
      geaendertVon: ich.kennung, geaendertVonName: vonName(ich), geaendertAm: zeit
    };
  }
  function vonName(ich) { var n = text(ich && ich.name).trim() || text(ich && ich.kennung); return n.slice(0, GRENZEN.VON_NAME); }
  function reihenfolgeDokument(liste, ich, zeit) {
    return { produkte: liste.slice(0, GRENZEN.REIHENFOLGE), geaendertVon: ich.kennung, geaendertVonName: vonName(ich), geaendertAm: zeit };
  }

  /* ---------- Produkte und Reihenfolge ---------- */
  function werdegangVon(p) { return p && Array.isArray(p.werdegang) ? p.werdegang : []; }
  function produkteDerMaschine(produkte, maschineId) {
    return (produkte || []).filter(function (p) { return werdegangVon(p).indexOf(maschineId) !== -1; });
  }
  /* produkte in Backreihenfolge: erst die gepflegte Liste, dann die übrigen
     in ihrer Eingangsreihenfolge (= Produktreihenfolge), markiert als neu. */
  function inReihenfolge(produkte, liste) {
    var pos = {}; (liste || []).forEach(function (k, i) { if (pos[k] === undefined) pos[k] = i; });
    var drin = [], neu = [];
    (produkte || []).forEach(function (p, i) { (pos[p.legacyKey] !== undefined ? drin : neu).push({ p: p, i: i }); });
    drin.sort(function (a, b) { return pos[a.p.legacyKey] - pos[b.p.legacyKey]; });
    var neuKeys = {}; neu.forEach(function (x) { neuKeys[x.p.legacyKey] = true; });
    return { liste: drin.concat(neu).map(function (x) { return x.p; }), neu: neuKeys };
  }
  /* Neue gespeicherte Liste: unsichtbare Schlüssel behalten ihren Platz,
     die sichtbaren Plätze werden in der neuen Reihenfolge gefüllt, neue hinten. */
  function reihenfolgeNeu(alteListe, sichtbar) {
    var sicht = {}; sichtbar.forEach(function (k) { sicht[k] = true; });
    var gesehen = {}, rest = sichtbar.slice(), aus = [];
    (alteListe || []).forEach(function (k) {
      if (gesehen[k]) return; gesehen[k] = true;
      if (sicht[k]) { if (rest.length) aus.push(rest.shift()); }
      else aus.push(k);
    });
    rest.forEach(function (k) { if (aus.indexOf(k) === -1) aus.push(k); });
    while (aus.length > GRENZEN.REIHENFOLGE) {
      var weg = -1;
      for (var i = 0; i < aus.length; i++) if (!sicht[aus[i]]) { weg = i; break; }
      if (weg === -1) break;
      aus.splice(weg, 1);
    }
    return aus;
  }
  function verschiebe(liste, index, richtung) {
    var neu = liste.slice(), ziel = index + richtung;
    if (index < 0 || index >= neu.length || ziel < 0 || ziel >= neu.length) return neu;
    var x = neu[index]; neu[index] = neu[ziel]; neu[ziel] = x;
    return neu;
  }
  /* Werdegang gegen die angelegten Maschinen: je Eintrag ok | ausgeblendet | unbekannt. */
  function werdegangPruefen(werdegang, maschinen) {
    var m = {}; (maschinen || []).forEach(function (x) { m[x.id] = x; });
    return (werdegang || []).map(function (id) {
      var x = m[id];
      if (!x) return { id: id, status: 'unbekannt', name: id };
      return { id: id, status: x.geloescht === true ? 'ausgeblendet' : 'ok', name: x.name || id };
    });
  }


  /* ================= Stufe B — rein (ohne Datenbank) ================= */

  /* ---------- Ofen wählen ---------- */
  /* gültige Wahl: ein Schlüssel aus exemplare oder 'alle'. Einzelmaschine: immer der eine Schlüssel. */
  function ofenNormal(maschine, ofen) {
    var s = exemplarSchluessel(maschine && maschine.exemplare);
    if (s.length === 1) return s[0];
    if (ofen === 'alle') return 'alle';
    return s.indexOf(String(ofen || '')) !== -1 ? String(ofen) : null;
  }
  function einzelOfen(maschine) { var s = exemplarSchluessel(maschine && maschine.exemplare); return s.length === 1 ? s[0] : null; }
  function ofenName(maschine, ofen) {
    if (ofen === 'alle') return 'alle';
    var ex = (maschine && maschine.exemplare) || {};
    return text(ex[ofen]) || ('Nr. ' + ofen);
  }
  /* Nachtrag Übersicht (K16): Kurzname für die Ofenknöpfe. Beginnt der Exemplar-Name mit dem
     Maschinennamen (Vergleich wie geraetNorm), zeigt der Knopf nur den Rest — vorne ohne
     Leerzeichen und - – · : # . —, sonst (auch bei leerem Rest) den ganzen Namen.
     „Stikkenofen 3“ → „3“, „Stikkenofen-Nord“ → „Nord“, „Ofen links“ → „Ofen links“.
     Der volle Name bleibt überall sonst (Schild „gilt für“, Reparatur, title). */
  function ofenKurz(maschine, ofen) {
    if (ofen === 'alle') return 'alle';
    var voll = ofenName(maschine, ofen);
    var basis = geraetNorm(maschine && maschine.name);
    var n = text(voll).replace(/\s+/g, ' ').trim();
    if (!basis || n.toLocaleLowerCase('de').indexOf(basis) !== 0) return voll;
    var rest = n.slice(basis.length).replace(/^[\s\-–·:#.]+/, '');
    return rest || voll;
  }
  function reparaturAdresse(exemplarName) { return '../reparaturanfrage/reparaturanfrage.html?geraet=' + encodeURIComponent(text(exemplarName).trim()); }

  /* ---------- Offene Reparaturanfragen (Auflage B5): DIE Stelle für den Abgleich ----------
     Gerät der Anfrage (frei getippt oder aus ?geraet=) gegen den Namen des Exemplars:
     Groß/Klein egal, Ränder und mehrfache Leerzeichen egal, sonst genau.
     „Stikkenofen3“ ≠ „Stikkenofen 3“. Wird ein Exemplar umbenannt, passen die
     alten Anfragen (mit dem alten Namen) nicht mehr — gewollt einfach (K8). */
  function geraetNorm(s) { return text(s).replace(/\s+/g, ' ').trim().toLocaleLowerCase('de'); }
  function geraetPasst(geraet, exemplarName) {
    var a = geraetNorm(geraet), b = geraetNorm(exemplarName);
    return a !== '' && a === b;
  }
  /* meldungen: Liste der offenen Anfragen (Kopf, wie BOS_MELDUNGEN.offen liefert).
     Ergebnis: [{ m, schluessel, name }] nur für diese Maschine, unter ofen 'alle' für jedes Exemplar. */
  function offeneFuer(meldungen, maschine, ofen) {
    var ex = (maschine && maschine.exemplare) || {};
    var schl = ofen === 'alle' ? exemplarSchluessel(ex) : [ofen];
    var aus = [];
    (meldungen || []).forEach(function (m) {
      for (var i = 0; i < schl.length; i++) {
        if (geraetPasst(m && m.geraet, ex[schl[i]])) { aus.push({ m: m, schluessel: schl[i], name: text(ex[schl[i]]) }); break; }
      }
    });
    aus.sort(function (a, b) { return (msVon(b.m.erstellt) || 0) - (msVon(a.m.erstellt) || 0); });
    return aus;
  }

  /* ---------- Notizen (Chatfenster) ---------- */
  function istAngepinnt(n) { return !!n && !Object.prototype.hasOwnProperty.call(n, FRIST_FELD); }
  /* Ende der 40 Tage in ms, aus erstellt (nie aus fristStart/ablauf). null = noch ohne Serverzeit. */
  function fristEnde(n) { var e = msVon(n && n.erstellt); return e === null ? null : e + FRIST_TAGE * TAG_MS; }
  function abgelaufen(n, jetztMs) { if (istAngepinnt(n)) return false; var f = fristEnde(n); return f !== null && f <= jetztMs; }
  /* angefangene Tage, die noch bleiben (aufgerundet): frisch angelegt = 40, letzte 24 Stunden = 1 */
  function restTage(n, jetztMs) { var f = fristEnde(n); if (f === null) return FRIST_TAGE; return Math.max(0, Math.ceil((f - jetztMs) / TAG_MS)); }
  function restText(n, jetztMs) {
    if (istAngepinnt(n)) return '';
    var t = restTage(n, jetztMs);
    return t === 1 ? 'noch 1 Tag' : 'noch ' + t + ' Tage';
  }
  function restDeutlich(n, jetztMs) { return !istAngepinnt(n) && restTage(n, jetztMs) <= 3; }
  /* Alter in vollen Tagen (für die Rückfrage beim Lösen) */
  function alterTage(n, jetztMs) { var e = msVon(n && n.erstellt); return e === null ? 0 : Math.floor((jetztMs - e) / TAG_MS); }
  /* Lösen einer Notiz, die älter als FRIST_TAGE ist → verschwindet sofort (M2) */
  function loesenLoescht(n, jetztMs) { return istAngepinnt(n) && alterTage(n, jetztMs) >= FRIST_TAGE; }
  /* Sichtbar für die Wahl: unter 'alle' alles, sonst dieser Ofen und 'alle'. Angepinnte oben, dann neueste zuerst. */
  function sichtbarFuer(exemplar, ofen) { return ofen === 'alle' || exemplar === 'alle' || exemplar === ofen; }
  function notizenFuer(liste, ofen, jetztMs) {
    return (liste || []).filter(function (n) { return n && sichtbarFuer(n.exemplar, ofen) && !abgelaufen(n, jetztMs); })
      .sort(function (a, b) {
        var pa = istAngepinnt(a) ? 1 : 0, pb = istAngepinnt(b) ? 1 : 0;
        if (pa !== pb) return pb - pa;
        var ea = msVon(a.erstellt), eb = msVon(b.erstellt);
        if (ea === null) ea = Infinity; if (eb === null) eb = Infinity;   /* noch ohne Serverzeit = ganz neu */
        return eb - ea;
      });
  }
  /* Nachtrag 2 (M43): Chatfenster zeigt die angepinnten und die neuesten n (Standard 5) der Sicht; der Rest
     steht unter „ältere anzeigen“. Rechnet nur mit der Liste im Gerät — keine Lesezugriffe. */
  var CHAT_NEUESTE = 5;
  function notizenSicht(liste, ofen, jetztMs, n) {
    var k = n === undefined || n === null ? CHAT_NEUESTE : n, pin = [], rest = [];
    notizenFuer(liste, ofen, jetztMs).forEach(function (x) { (istAngepinnt(x) ? pin : rest).push(x); });
    return { zeigen: pin.concat(rest.slice(0, k)), aelter: rest.slice(k) };
  }
  function pruefeNotizText(roh) {
    var s = text(roh).replace(/\r\n?/g, '\n').trim();
    if (!s) return { text: '', fehler: 'Die Notiz ist leer.' };
    if (s.length > GRENZEN_B.NOTIZ) return { text: s, fehler: 'Höchstens ' + GRENZEN_B.NOTIZ + ' Zeichen (jetzt ' + s.length + ').' };
    return { text: s, fehler: null };
  }
  /* erstellt + 40 Tage als Zeitstempel, aus Sekunden und Nanosekunden (NICHT über toMillis —
     sonst fehlen die Mikrosekunden und das Lösen scheitert an ==; nur Rückfall a). */
  function plusFrist(ts, Zeitstempel) {
    if (!ts || typeof ts.seconds !== 'number') throw new Error('Erstellzeit fehlt oder ist kein Zeitstempel.');
    return new Zeitstempel(ts.seconds + FRIST_TAGE * 86400, ts.nanoseconds || 0);
  }
  /* neues Notiz-Dokument. zeit = Serverzeit-Platzhalter, jetztMs + Zeitstempel nur für den Rückfall. */
  function notizDokument(e, ich, zeit, angepinnt, jetztMs, Zeitstempel) {
    var d = { maschine: e.maschine, exemplar: String(e.exemplar), text: e.text, von: ich.kennung, vonName: vonName(ich), erstellt: zeit };
    if (angepinnt) { d.angepinntVon = ich.kennung; d.angepinntVonName = vonName(ich); }
    else if (FRIST_WEG === 'fenster') d.ablauf = Zeitstempel.fromMillis(jetztMs + FRIST_TAGE * TAG_MS);
    else d.fristStart = zeit;
    return d;
  }
  /* aus dem frisch gelesenen Server-Dokument: angepinnt bzw. gelöst. Die festen Felder
     werden unverändert übernommen (erstellt als gelesener Zeitstempel). */
  function notizBasis(alt) { return { maschine: alt.maschine, exemplar: alt.exemplar, text: alt.text, von: alt.von, vonName: alt.vonName, erstellt: alt.erstellt }; }
  function notizAngepinnt(alt, ich) { var d = notizBasis(alt); d.angepinntVon = ich.kennung; d.angepinntVonName = vonName(ich); return d; }
  function notizGeloest(alt, Zeitstempel) {
    var d = notizBasis(alt);
    if (FRIST_WEG === 'fenster') d.ablauf = plusFrist(alt.erstellt, Zeitstempel);
    else d.fristStart = alt.erstellt;
    return d;
  }
  function darfNotizLoeschen(n, kennung, zg) { return !!n && ((!!zg && zg.person && n.von === kennung) || (!!zg && zg.admin)); }

  /* ---------- Info-Karten ---------- */
  function pruefeKarte(e, maschine) {
    var f = [];
    var titel = text(e && e.titel).trim(), inhalt = text(e && e.text).replace(/\r\n?/g, '\n');
    if (!titel) f.push('Überschrift fehlt.');
    else if (titel.length > GRENZEN_B.TITEL) f.push('Überschrift: höchstens ' + GRENZEN_B.TITEL + ' Zeichen.');
    if (inhalt.length > GRENZEN_B.KARTE) f.push('Text: höchstens ' + GRENZEN_B.KARTE + ' Zeichen (jetzt ' + inhalt.length + ').');
    var ex = String(e && e.exemplar);
    if (ex !== 'alle' && exemplarSchluessel(maschine && maschine.exemplare).indexOf(ex) === -1) f.push('„Gilt für“: diesen Ofen gibt es nicht.');
    if (!(typeof (e && e.rang) === 'number' && Math.floor(e.rang) === e.rang && e.rang >= 0 && e.rang <= GRENZEN_B.RANG_MAX)) f.push('Reihenfolge ungültig.');
    return f;
  }
  function karteDokument(e, alt, ich, zeit) {
    return {
      maschine: e.maschine, exemplar: String(e.exemplar), titel: text(e.titel).trim(),
      text: text(e.text).replace(/\r\n?/g, '\n').replace(/\s+$/, ''), rang: e.rang,
      stand: alt ? Number(alt.stand) + 1 : 1,
      geaendertVon: ich.kennung, geaendertVonName: vonName(ich), geaendertAm: zeit
    };
  }
  function kartenSortiert(liste) {
    return (liste || []).slice().sort(function (a, b) { return (a.rang - b.rang) || text(a.titel).localeCompare(text(b.titel), 'de'); });
  }
  function kartenFuer(liste, ofen) { return kartenSortiert((liste || []).filter(function (k) { return k && sichtbarFuer(k.exemplar, ofen); })); }
  function naechsterRang(liste) { var m = -1; (liste || []).forEach(function (k) { if (typeof k.rang === 'number' && k.rang > m) m = k.rang; }); return Math.min(m + 1, GRENZEN_B.RANG_MAX); }
  /* Tauschen zweier Nachbarn: die zwei Ränge werden getauscht; sind sie gleich, bekommen sie zwei verschiedene. */
  function rangTausch(a, b) {
    if (a.rang !== b.rang) return { a: b.rang, b: a.rang };
    var r = Math.min(a.rang, GRENZEN_B.RANG_MAX - 1);
    return { a: r + 1, b: r };
  }

  /* ---------- Konto ---------- */
  function kontoArt(konto) { var a = konto && konto.art; return a === 'person' || a === 'ort' || a === 'system' ? a : ''; }
  /* Darf dieses Konto die Maschinenseite lesen? (wie msLesen der Regel; Generalschlüssel erkennt die Seite nicht) */
  function zugang(konto) {
    if (!konto) return { lesen: false, grund: 'kein_konto' };
    if (konto.freigeschaltet !== true) return { lesen: false, grund: 'gesperrt' };
    var admin = konto.role === 'admin';
    var art = kontoArt(konto);
    if (art === 'person') return { lesen: true, person: true, admin: admin, grund: '' };
    if (admin) return { lesen: true, person: false, admin: true, grund: art === '' ? 'ohne_art' : art };
    return { lesen: false, person: false, admin: false, grund: art === '' ? 'ohne_art' : art };
  }

  /* ---------- Zeit ---------- */
  function msVon(t) {
    if (!t) return null;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.ms === 'number') return t.ms;
    if (t instanceof Date) return t.getTime();
    if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
    return null;
  }
  function zeitText(t) {
    var ms = msVon(t); if (ms === null) return '';
    var d = new Date(ms);
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes()) + ' Uhr';
  }

  /* ---------- Fehler einordnen ---------- */
  function fehlerOriginal(err) { return ((err && err.code) ? err.code + ' — ' : '') + ((err && err.message) || String(err)); }
  function fehlerArt(err) {
    var c = err && err.code;
    if (c === 'permission-denied') return 'keine_berechtigung';
    if (c === 'unavailable') return 'kein_netz';
    if (c === 'zeitlimit') return 'zeitlimit';
    if (c === 'resource-exhausted') return 'kontingent';
    return 'fehler';
  }
  var ART_TEXT = {
    kein_netz: 'Kein Netz — die Datenbank ist gerade nicht erreichbar. Gleich noch einmal versuchen.',
    zeitlimit: 'Keine Antwort nach ' + (ZEITLIMIT_MS / 1000) + ' Sekunden (Zeitlimit). Es kann trotzdem noch ankommen — nachsehen, dann erst wiederholen.',
    kontingent: 'Das Tageskontingent der Datenbank ist aufgebraucht — morgen wieder, oder Ulf Bescheid geben.',
    keine_berechtigung: 'Die Datenbank hat abgelehnt (keine Berechtigung).',
    fehler: 'Unerwarteter Fehler.'
  };
  function einordnen(err) {
    if (err && err.art && err.meldung) return err;
    var a = fehlerArt(err);
    return { art: a, meldung: ART_TEXT[a], original: fehlerOriginal(err) };
  }
  function mitZeitlimit(p, ms) {
    return new Promise(function (ja, nein) {
      var fertig = false;
      var uhr = setTimeout(function () { if (fertig) return; fertig = true; var e = new Error('Keine Antwort nach ' + ((ms || ZEITLIMIT_MS) / 1000) + ' s'); e.code = 'zeitlimit'; nein(e); }, ms || ZEITLIMIT_MS);
      p.then(function (x) { if (fertig) return; fertig = true; clearTimeout(uhr); ja(x); },
        function (e) { if (fertig) return; fertig = true; clearTimeout(uhr); nein(e); });
    });
  }

  /* ---------- Datenbank ---------- */
  function datenbank(db) { var d = db || global.db; if (!d) { var e = new Error('Datenbank nicht geladen (bos_firebase_config.js fehlt?)'); e.code = 'nicht_geladen'; throw e; } return d; }
  function serverZeit() { return global.firebase.firestore.FieldValue.serverTimestamp(); }
  function pruefeRegelstand(db) {
    return mitZeitlimit(datenbank(db).collection('bos_regelstand').doc(REGEL_FASSUNG).get({ source: 'server' }))
      .then(function () { return 'passt'; }, function (err) { return err && err.code === 'permission-denied' ? 'alt' : 'unbekannt'; });
  }
  function ladeKonto(db, kennung) {
    var d = datenbank(db);
    if (global.BOS_ACCOUNTS && typeof global.BOS_ACCOUNTS.ladeKonto === 'function') return mitZeitlimit(global.BOS_ACCOUNTS.ladeKonto(d, kennung));
    return mitZeitlimit(d.collection('bos_accounts').doc(kennung).get()).then(function (s) { return s.exists ? s.data() : null; });
  }
  function ladeMaschinen(db) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.MASCHINEN).get()).then(function (snap) {
      var l = []; snap.forEach(function (d) { var x = d.data() || {}; x.id = d.id; l.push(x); });
      l.sort(function (a, b) { return text(a.name).localeCompare(text(b.name), 'de'); });
      return l;
    });
  }
  function ladeMaschine(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.MASCHINEN).doc(id).get({ source: 'server' }))
      .then(function (s) { if (!s.exists) return null; var x = s.data() || {}; x.id = s.id; return x; });
  }
  function ladeReihenfolge(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.REIHENFOLGE).doc(id).get({ source: 'server' }))
      .then(function (s) { return s.exists ? s.data() : null; });
  }
  /* alle Angaben einer Maschine: { legacyKey: rohes Dokument } */
  function ladeAngaben(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.ANGABEN).where('maschine', '==', id).get({ source: 'server' }))
      .then(function (snap) { var m = {}; snap.forEach(function (d) { var x = d.data() || {}; if (x.produkt) m[x.produkt] = x; }); return m; });
  }
  function ladeAngabe(db, maschineId, produktKey) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.ANGABEN).doc(angabenId(maschineId, produktKey)).get({ source: 'server' }))
      .then(function (s) { return s.exists ? s.data() : null; });
  }
  function speichereMaschine(db, eingabe, kennung) {
    var f = pruefeMaschine(eingabe);
    if (f.length) { var e = new Error(f.join(' ')); e.code = 'eingabe'; return Promise.reject(e); }
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.MASCHINEN).doc(eingabe.id).set(maschineDokument(eingabe, kennung, serverZeit())));
  }
  /* alt = rohes Serverdokument (beim Laden) oder null */
  function speichereAngaben(db, maschineId, produktKey, werte, alt, ich) {
    if (Object.keys(werte).length > GRENZEN.WERTE) { var e = new Error('Zu viele Werte (' + Object.keys(werte).length + ', höchstens ' + GRENZEN.WERTE + ').'); e.code = 'eingabe'; return Promise.reject(e); }
    var dok = angabenDokument(maschineId, produktKey, werte, alt, ich, serverZeit());
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.ANGABEN).doc(angabenId(maschineId, produktKey)).set(dok));
  }
  function speichereReihenfolge(db, maschineId, liste, ich) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.REIHENFOLGE).doc(maschineId).set(reihenfolgeDokument(liste, ich, serverZeit())));
  }


  /* ================= Stufe B — Datenbank ================= */
  function Zeitstempel() { return global.firebase.firestore.Timestamp; }
  function mitIdDaten(d) { var x = d.data({ serverTimestamps: 'estimate' }) || {}; x.id = d.id; x._ausstehend = !!(d.metadata && d.metadata.hasPendingWrites); return x; }
  /* live: alle Notizen einer Maschine (ein Gleich-Filter, kein zusammengesetzter Index) */
  function notizenLive(db, maschineId, cb, fehlerCb) {
    return datenbank(db).collection(SAMMLUNG.NOTIZEN).where('maschine', '==', maschineId)
      .onSnapshot({ includeMetadataChanges: true }, function (snap) {
        var l = []; snap.forEach(function (d) { l.push(mitIdDaten(d)); });
        cb(l, { ausCache: !!(snap.metadata && snap.metadata.fromCache) });
      }, function (err) { if (fehlerCb) fehlerCb(err); });
  }
  function notizAnlegen(db, e, ich, angepinnt) {
    var t = pruefeNotizText(e.text);
    if (t.fehler) { var f = new Error(t.fehler); f.code = 'eingabe'; return Promise.reject(f); }
    var d = notizDokument({ maschine: e.maschine, exemplar: e.exemplar, text: t.text }, ich, serverZeit(), angepinnt, Date.now(), Zeitstempel());
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.NOTIZEN).add(d));
  }
  function ladeNotiz(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.NOTIZEN).doc(id).get({ source: 'server' }))
      .then(function (s) { return s.exists ? s.data() : null; });
  }
  /* anpinnen/lösen: erst frisch vom Server lesen (erstellt genau), dann das ganze Dokument schreiben */
  function notizPinnen(db, id, anpinnen, ich) {
    return ladeNotiz(db, id).then(function (alt) {
      if (!alt) { var e = new Error('Die Notiz gibt es nicht mehr (gelöscht).'); e.code = 'weg'; throw e; }
      var d = anpinnen ? notizAngepinnt(alt, ich) : notizGeloest(alt, Zeitstempel());
      return mitZeitlimit(datenbank(db).collection(SAMMLUNG.NOTIZEN).doc(id).set(d));
    });
  }
  function notizLoeschen(db, id) { return mitZeitlimit(datenbank(db).collection(SAMMLUNG.NOTIZEN).doc(id).delete()); }
  function ladeKarten(db, maschineId) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.KARTEN).where('maschine', '==', maschineId).get({ source: 'server' }))
      .then(function (snap) { var l = []; snap.forEach(function (d) { var x = d.data() || {}; x.id = d.id; l.push(x); }); return kartenSortiert(l); });
  }
  function ladeKarte(db, id) {
    return mitZeitlimit(datenbank(db).collection(SAMMLUNG.KARTEN).doc(id).get({ source: 'server' }))
      .then(function (s) { if (!s.exists) return null; var x = s.data() || {}; x.id = s.id; return x; });
  }
  /* e = { id?, maschine, exemplar, titel, text, rang }, alt = Server-Dokument beim Laden (Sperrzettel stand) oder null */
  function speichereKarte(db, e, alt, ich, maschine) {
    var f = pruefeKarte(e, maschine);
    if (f.length) { var x = new Error(f.join(' ')); x.code = 'eingabe'; return Promise.reject(x); }
    var ref = alt ? datenbank(db).collection(SAMMLUNG.KARTEN).doc(alt.id) : datenbank(db).collection(SAMMLUNG.KARTEN).doc();
    return mitZeitlimit(ref.set(karteDokument(e, alt, ich, serverZeit()))).then(function () { return ref.id; });
  }
  function loescheKarte(db, id) { return mitZeitlimit(datenbank(db).collection(SAMMLUNG.KARTEN).doc(id).delete()); }
  /* zwei Karten tauschen: EIN Vorgang (Batch), beide stand +1 */
  function tauscheKarten(db, a, b, ich) {
    var r = rangTausch(a, b), d = datenbank(db), batch = d.batch(), zeit = serverZeit();
    batch.set(d.collection(SAMMLUNG.KARTEN).doc(a.id), karteDokument({ maschine: a.maschine, exemplar: a.exemplar, titel: a.titel, text: a.text, rang: r.a }, a, ich, zeit));
    batch.set(d.collection(SAMMLUNG.KARTEN).doc(b.id), karteDokument({ maschine: b.maschine, exemplar: b.exemplar, titel: b.titel, text: b.text, rang: r.b }, b, ich, zeit));
    return mitZeitlimit(batch.commit());
  }

  /* Nach einer Ablehnung den richtigen Grund finden (Checkliste §7a:
     „eine falsche Erklärung ist schlechter als keine“).
     k = { art: 'angaben'|'reihenfolge'|'maschine'|'notiz'|'pinnen'|'notiz_loeschen'|'karte'|'karte_loeschen',
           kennung, maschineId, produktKey, altAm, notiz (Stufe B), karteId, altStand } */
  function erklaere(db, err, k) {
    var basis = einordnen(err);
    if (basis.art !== 'keine_berechtigung') return Promise.resolve(basis);
    var orig = basis.original;
    function g(art, meldung, extra) { var r = { art: art, meldung: meldung, original: orig }; if (extra) Object.keys(extra).forEach(function (x) { r[x] = extra[x]; }); return r; }
    return pruefeRegelstand(db).then(function (stand) {
      if (stand === 'alt') return g('regel_alt', 'Die Firestore-Regeln sind älter als diese Seite. In der Firebase-Konsole ' + REGEL_DATEI + ' einsetzen (Fassung ' + REGEL_FASSUNG + '). Nichts gespeichert.');
      return ladeKonto(db, k.kennung).then(function (konto) {
        var z = zugang(konto);
        if (k.art === 'notiz_loeschen') {
          if (z.admin) return g('abgelehnt', 'Die Datenbank hat das Löschen abgelehnt. Nichts gelöscht.');
          if (!z.person) return g('keine_person', 'Löschen darf nur, wer die Notiz geschrieben hat (mit persönlichem Konto), oder ein Admin. Nichts gelöscht.');
          if (k.notiz && k.notiz.von !== k.kennung) return g('nicht_deine', 'Diese Notiz hat ' + (k.notiz.vonName || k.notiz.von || 'jemand anderes') + ' geschrieben. Löschen darf nur, wer sie geschrieben hat, oder ein Admin. Nichts gelöscht.');
          return g('abgelehnt', 'Die Datenbank hat das Löschen abgelehnt. Nichts gelöscht.');
        }
        if (k.art === 'maschine') {
          if (!konto || konto.role !== 'admin') return g('kein_admin', 'Maschinen anlegen und ändern darf nur die Rolle Admin. Nichts gespeichert.');
          return g('abgelehnt', 'Die Datenbank hat die Maschine abgelehnt. Nichts gespeichert.');
        }
        if (!z.person) return g('keine_person', 'Dein Konto ist kein persönliches Konto (' + (z.grund === 'ort' ? 'eingetragen als „Ort“' : z.grund === 'ohne_art' ? 'keine Art eingetragen' : z.grund === 'system' ? 'Generalschlüssel' : 'nicht freigeschaltet') + '). Speichern dürfen nur eingetragene Maschinenführer mit persönlichem Konto. Ulf fragen (Konten & Rollen → Konto → Freigabe).');
        if (k.art === 'notiz' || k.art === 'pinnen') {
          return ladeMaschine(db, k.maschineId).then(function (m) {
            if (!m || m.geloescht === true) return g('maschine_weg', 'Die Maschine gibt es nicht (mehr) oder sie ist ausgeblendet — dort schreibt niemand mehr. Nichts gespeichert.');
            if (k.art === 'notiz' && k.exemplar !== 'alle' && exemplarSchluessel(m.exemplare).indexOf(String(k.exemplar)) === -1) return g('ofen_weg', 'Diesen Ofen gibt es bei der Maschine nicht (mehr). Ofen neu wählen. Nichts gespeichert.');
            return g('abgelehnt', 'Die Datenbank hat die Notiz abgelehnt. Nichts gespeichert.' + (FRIST_WEG === 'fenster' ? ' Geht die Uhr dieses Geräts mehr als eine Stunde falsch? Uhrzeit auf „automatisch“ stellen.' : ''));
          });
        }
        return ladeMaschine(db, k.maschineId).then(function (m) {
          if (!istFuehrer(m, k.kennung)) return g('kein_fuehrer', m && m.geloescht === true ? 'Die Maschine ist ausgeblendet — dort speichert niemand mehr. Nichts gespeichert.' : 'Du bist bei dieser Maschine nicht (mehr) als Maschinenführer eingetragen. Nichts gespeichert. Admin fragen (Verwalten → Maschinenführer).');
          if (k.art === 'angaben') {
            return ladeAngabe(db, k.maschineId, k.produktKey).then(function (jetzt) {
              var a = msVon(k.altAm), b = msVon(jetzt && jetzt.geaendertAm);
              if ((jetzt && !k.altAm) || (jetzt && a !== b)) return g('konflikt', 'Inzwischen hat ' + (jetzt.geaendertVonName || jetzt.geaendertVon || 'jemand') + ' hier gespeichert (' + zeitText(jetzt.geaendertAm) + '). Nichts gespeichert. Neu laden — deine Eingaben bleiben stehen.', { jetzt: jetzt });
              return g('abgelehnt', 'Die Datenbank hat die Angaben abgelehnt. Nichts gespeichert.');
            });
          }
          if (k.art === 'karte' || k.art === 'karte_loeschen') {
            if (!k.karteId) return g('abgelehnt', 'Die Datenbank hat die Karte abgelehnt. Nichts gespeichert.');
            return ladeKarte(db, k.karteId).then(function (jetzt) {
              if (!jetzt && k.altStand) return g('karte_weg', 'Die Karte hat inzwischen jemand gelöscht. Nichts gespeichert. Neu laden — deine Eingaben bleiben stehen.');
              if (jetzt && Number(jetzt.stand) !== Number(k.altStand)) return g('konflikt', 'Inzwischen hat ' + (jetzt.geaendertVonName || jetzt.geaendertVon || 'jemand') + ' die Karte geändert (' + zeitText(jetzt.geaendertAm) + '). Nichts gespeichert. Neu laden — deine Eingaben bleiben stehen.', { jetzt: jetzt });
              return g('abgelehnt', 'Die Datenbank hat die Karte abgelehnt. Nichts gespeichert.');
            });
          }
          return g('abgelehnt', 'Die Datenbank hat die Reihenfolge abgelehnt. Nichts gespeichert.');
        });
      });
    }).catch(function (e2) {
      var r = einordnen(err); r.meldung = r.meldung + ' Den Grund konnte die Seite nicht klären (' + fehlerOriginal(e2) + ').'; return r;
    });
  }

  var api = {
    REGEL_FASSUNG: REGEL_FASSUNG, REGEL_DATEI: REGEL_DATEI, SAMMLUNG: SAMMLUNG, GRENZEN: GRENZEN, SEITE: SEITE,
    FELD_ARTEN: FELD_ARTEN, ZEITLIMIT_MS: ZEITLIMIT_MS,
    idGueltig: idGueltig, angabenId: angabenId, feldIdAus: feldIdAus, exemplarSchluessel: exemplarSchluessel,
    naechsterExemplarSchluessel: naechsterExemplarSchluessel, standardFelder: standardFelder,
    pruefeMaschine: pruefeMaschine, maschineDokument: maschineDokument, istFuehrer: istFuehrer,
    normWert: normWert, pruefeWert: pruefeWert, werteAus: werteAus, werteGleich: werteGleich,
    frueherEintrag: frueherEintrag, angabenDokument: angabenDokument, reihenfolgeDokument: reihenfolgeDokument,
    werdegangVon: werdegangVon, produkteDerMaschine: produkteDerMaschine, inReihenfolge: inReihenfolge,
    reihenfolgeNeu: reihenfolgeNeu, verschiebe: verschiebe, werdegangPruefen: werdegangPruefen,
    kontoArt: kontoArt, zugang: zugang, msVon: msVon, zeitText: zeitText,
    fehlerOriginal: fehlerOriginal, fehlerArt: fehlerArt, einordnen: einordnen, mitZeitlimit: mitZeitlimit,
    pruefeRegelstand: pruefeRegelstand, ladeKonto: ladeKonto, ladeMaschinen: ladeMaschinen, ladeMaschine: ladeMaschine,
    ladeReihenfolge: ladeReihenfolge, ladeAngaben: ladeAngaben, ladeAngabe: ladeAngabe,
    speichereMaschine: speichereMaschine, speichereAngaben: speichereAngaben, speichereReihenfolge: speichereReihenfolge,
    erklaere: erklaere,
    /* Stufe B */
    FRIST_WEG: FRIST_WEG, FRIST_FELD: FRIST_FELD, FRIST_TAGE: FRIST_TAGE, RUECKFALL: RUECKFALL, GRENZEN_B: GRENZEN_B,
    KARTEN_VORSCHLAEGE: KARTEN_VORSCHLAEGE,
    ofenNormal: ofenNormal, einzelOfen: einzelOfen, ofenName: ofenName, reparaturAdresse: reparaturAdresse,
    /* Nachtrag Übersicht */
    ofenKurz: ofenKurz,
    /* Nachtrag 2 */
    CHAT_NEUESTE: CHAT_NEUESTE, notizenSicht: notizenSicht,
    geraetNorm: geraetNorm, geraetPasst: geraetPasst, offeneFuer: offeneFuer,
    istAngepinnt: istAngepinnt, fristEnde: fristEnde, abgelaufen: abgelaufen, restTage: restTage, restText: restText,
    restDeutlich: restDeutlich, alterTage: alterTage, loesenLoescht: loesenLoescht, sichtbarFuer: sichtbarFuer,
    notizenFuer: notizenFuer, pruefeNotizText: pruefeNotizText, plusFrist: plusFrist, notizDokument: notizDokument,
    notizBasis: notizBasis, notizAngepinnt: notizAngepinnt, notizGeloest: notizGeloest, darfNotizLoeschen: darfNotizLoeschen,
    pruefeKarte: pruefeKarte, karteDokument: karteDokument, kartenSortiert: kartenSortiert, kartenFuer: kartenFuer,
    naechsterRang: naechsterRang, rangTausch: rangTausch,
    notizenLive: notizenLive, notizAnlegen: notizAnlegen, ladeNotiz: ladeNotiz, notizPinnen: notizPinnen,
    notizLoeschen: notizLoeschen, ladeKarten: ladeKarten, ladeKarte: ladeKarte, speichereKarte: speichereKarte,
    loescheKarte: loescheKarte, tauscheKarten: tauscheKarten
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_MASCHINEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
