/* ================================================================
   BäckereiOS · Teigrechner — reine Logik (kein DOM, kein Firestore)
   ================================================================
   Einbindung:  <script src="teigrechner_logik.js"></script>
   Stellt bereit: window.BOS_TEIGRECHNER_LOGIK
   Prüfung:     node _PRUEF_teigrechner.js   (liegt außerhalb des Repos)

   Wofür: Die Teige der Stationen (Rondo, Frühschicht, Brötchenstraße) in
   Firestore teigrechner_teige. Je Teig: Name, Stationen, Hefe („x kg Teig mit
   y g Hefe“, freiwillig), Kessel („höchstens … kg“, freiwillig), je Produkt
   die Ausbeute so, wie sie auf dem Zettel steht („x kg Teig ergibt y
   <Einheit des Produkts>“). Welches Produkt zu welchem Teig gehört, steht wie
   in der Nacht am Produkt (Feld ausTeig).

   Gerechnet wird NUR in kg: Einheiten × kg je Einheit. stueckProBlech kommt
   hier nicht vor (Wächter _PRUEF_einheiten_waechter.js). Gemischte Einheiten in
   einem Teig sind deshalb kein Problem.

   KEINE Daten in dieser Datei: keine Teignamen, keine Zahlen vom Zettel
   (Repo öffentlich). Beispiele in Kommentaren sind Platzhalter.

   CHANGELOG
     2026-10-16 · 17:51 · v0.1 · Erstfassung (Teigrechner Stufe 1, #67)
       ANWEISUNG_2026-10-16_TEIGRECHNER_STUFE1.md, Bauplan
       SESSION_2026-10-16_TEIGRECHNER_STUFE1_BAU.md, Freigabe Kontroll-Chat
       16:37. Kessel-Formel kopiert aus teigecke_logik.js rechneTeig (Z. 422),
       aber ohne Vorgabe von 190 kg (leer = nicht aufteilen).
   ================================================================ */
(function (global) {
  'use strict';

  /* Reiter der Stationen in dieser Reihenfolge (Ulf 14.10./16.10.; Konditorei
     später, „vielleicht ganz eigenständig“). Die Regel erlaubt mehr Werte
     (STATIONEN_ERLAUBT), damit ein späterer Reiter keine neue Regel braucht. */
  var STATIONEN_REITER = ['Rondo', 'Frühschicht', 'Brötchenstraße'];
  /* = stationen.hasOnly(...) der Regel (RK §23). Nachtschicht bewusst NICHT:
     Nacht-Teige gehören in die Teigecke (teigecke_teige). */
  var STATIONEN_ERLAUBT = ['Brötchenstraße', 'Frühschicht', 'Rondo', 'Konditorei', 'Versand'];
  /* = hasOnly der Regel ohne die Herkunftsfelder, die das Gerüst setzt. */
  var FELDER_TEIG = ['name', 'stationen', 'hefeRefKg', 'hefeRefG', 'kesselMaxKg', 'ausbeute', 'geloescht'];
  var NAME_MAX = 60;
  var KENNUNG_MUSTER = /^[a-z0-9_]{2,40}$/;

  function istZahl(x) { return typeof x === 'number' && isFinite(x); }
  function positiv(x) { return istZahl(x) && x > 0; }
  function norm(text) { return String(text || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function aktiv(liste) { return (liste || []).filter(function (x) { return x && !x.geloescht; }); }
  function sortName(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'de'); }

  /* ---------- Zahlen in deutscher Schreibweise ---------- */
  function deZahl(x, stellen) { return x.toFixed(stellen).replace('.', ','); }
  /* Tausenderpunkt für ganze Zahlen: 1680 → „1.680“. */
  function tausender(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  /* kg wie die Nacht (fmtKg): eine Nachkommastelle. */
  function kgText(x) { return istZahl(x) ? deZahl(x, 1) + ' kg' : '–'; }
  /* kg je Einheit im Editor: zwei Nachkommastellen. */
  function jeEinheitText(x) { return istZahl(x) ? deZahl(x, 2) : '–'; }
  /* Gramm: ganze Gramm mit Tausenderpunkt, unter 10 g eine Nachkommastelle
     (wie L.grammText der Nacht, plus Tausenderpunkt). */
  function grammText(g) {
    if (!istZahl(g)) return '–';
    var z = Math.round(g * 10) / 10;
    return (z < 10 ? deZahl(z, 1) : tausender(Math.round(g))) + ' g';
  }
  /* Eingabe eines Pflegefelds (kg, Anzahl, Gramm): Komma oder Punkt, leer = null,
     sonst eine Zahl über 0. → { ok, wert, leer } */
  function pflegeZahl(text) {
    var s = String(text == null ? '' : text).trim().replace(/\s+/g, '');
    if (!s) return { ok: true, wert: null, leer: true };
    if (!/^\d+([.,]\d*)?$|^[.,]\d+$/.test(s)) return { ok: false, wert: null, leer: false };
    var n = Number(s.replace(',', '.'));
    return positiv(n) ? { ok: true, wert: n, leer: false } : { ok: false, wert: null, leer: false };
  }
  function zahlText(x) { return istZahl(x) ? String(x).replace('.', ',') : ''; }

  /* ---------- Ausbeute, Hefe, Kessel ---------- */
  /* Ausbeute { kg, anzahl }: „kg Teig ergibt anzahl <Einheit>“. */
  function ausbeuteGueltig(a) { return !!a && positiv(a.kg) && positiv(a.anzahl); }
  function kgJeEinheit(a) { return ausbeuteGueltig(a) ? a.kg / a.anzahl : null; }
  /* Teig einer Zeile: erst malnehmen, dann teilen (98 × 150 ÷ 98 = genau 150). */
  function zeilenKg(menge, a) { return menge * a.kg / a.anzahl; }
  function hefeGueltig(teig) { return !!teig && positiv(teig.hefeRefKg) && positiv(teig.hefeRefG); }
  function hefeGJeKg(teig) { return hefeGueltig(teig) ? teig.hefeRefG / teig.hefeRefKg : null; }
  /* Kessel: n = max(1, ⌈T ÷ Höchstmenge − 1e-9⌉), gleich aufgeteilt. Formel kopiert
     aus teigecke_logik.js rechneTeig (Z. 422). Ohne Höchstmenge: 1 (E9, keine
     Vorgabe wie die 190 kg der Nacht). */
  function kessel(T, kesselMaxKg) {
    if (!istZahl(T)) return null;
    var n = positiv(kesselMaxKg) ? Math.max(1, Math.ceil(T / kesselMaxKg - 1e-9)) : 1;
    return { n: n, jeKg: T / n, gepflegt: positiv(kesselMaxKg) };
  }

  /* ---------- Rechnung eines Teigs ----------
     teig: { hefeRefKg, hefeRefG, kesselMaxKg, ausbeute }
     zeilen: [{ lk, menge }] — menge: Zahl ≥ 0, null (leer = 0) oder NaN (ungültige Eingabe)
     Ergebnis:
       status 'leer'          nichts über 0 eingetragen (keine WinBack-Zahl)
              'fertig'        T steht, Kessel und Hefe dazu
              'ausbeuteFehlt' bei einem Produkt ohne Ausbeute steht eine Menge über 0
                              → KEINE Summe, auch keine Teilsumme (Freigabe KC §2)
              'eingabeFehler' ein Feld ist keine gültige Zahl → keine Summe
       T, kessel { n, jeKg, gepflegt }, hefeG, hefeJeKesselG, fehlend [lk], falsch [lk] */
  function rechne(teig, zeilen) {
    var t = teig || {}, ausb = t.ausbeute || {};
    var erg = { status: 'leer', T: null, kessel: null, hefeG: null, hefeJeKesselG: null, fehlend: [], falsch: [], anzahlZeilen: 0 };
    var summe = 0, etwas = false;
    (zeilen || []).forEach(function (z) {
      var m = z.menge;
      if (m === null || m === undefined) return;
      if (!istZahl(m) || m < 0) { erg.falsch.push(z.lk); return; }
      if (m === 0) return;
      etwas = true; erg.anzahlZeilen++;
      var a = ausb[z.lk];
      if (!ausbeuteGueltig(a)) { erg.fehlend.push(z.lk); return; }
      summe += zeilenKg(m, a);
    });
    if (erg.falsch.length) { erg.status = 'eingabeFehler'; return erg; }
    if (erg.fehlend.length) { erg.status = 'ausbeuteFehlt'; return erg; }
    if (!etwas) return erg;
    erg.status = 'fertig';
    erg.T = summe;
    erg.kessel = kessel(summe, t.kesselMaxKg);
    var g = hefeGJeKg(t);
    if (g !== null) { erg.hefeG = summe * g; erg.hefeJeKesselG = erg.hefeG / erg.kessel.n; }
    return erg;
  }

  /* ---------- Teige, Produkte, Stationen ---------- */
  function teigeDerStation(teige, station) {
    return aktiv(teige).filter(function (x) { return Array.isArray(x.stationen) && x.stationen.indexOf(station) !== -1; }).sort(sortName);
  }
  function produkteDesTeigs(kennung, produkte) {
    return (produkte || []).filter(function (p) { return p && !p.geloescht && p.ausTeig === kennung; }).sort(sortName);
  }
  /* Rechner: je Teig der Station eine Karte, je LAUFENDEM Produkt eine Zeile
     (produkteLaufend kommt aus der Sicht 'laufend'). Ein Teig ohne laufendes
     Produkt erscheint nicht (E10). */
  function rechnerKarten(teige, produkteLaufend, station) {
    return teigeDerStation(teige, station).map(function (teig) {
      return { teig: teig, produkte: produkteDesTeigs(teig.id, produkteLaufend) };
    }).filter(function (k) { return k.produkte.length > 0; });
  }
  /* Steht das Produkt in der Produktliste bei einer Station, die der Teig nicht hat?
     Nur ein Hinweis, keine Sperre. Produkt ohne Station: kein Hinweis. */
  function stationAbweichend(produkt, teig) {
    if (!produkt || !produkt.station || !teig) return false;
    return (teig.stationen || []).indexOf(produkt.station) === -1;
  }
  /* Übersicht „Produkte dieser Station ohne Teig“ (nur Anzeige, keine Mahnung). */
  function produkteOhneTeig(produkte, station) {
    return (produkte || []).filter(function (p) { return p && !p.geloescht && p.station === station && !p.ausTeig; }).sort(sortName);
  }

  /* ---------- Kennung über beide Welten ----------
     nacht: teigecke_teige, weitere: teigrechner_teige — beide [{ id, name, geloescht }],
     archivierte zählen mit. Die Regel prüft dasselbe (RK §23, beide Richtungen). */
  function kennungBelegt(kennung, nacht, weitere) {
    return (nacht || []).concat(weitere || []).some(function (x) { return x && x.id === kennung; });
  }
  function nameBelegt(name, nacht, weitere, ausserId) {
    var n = norm(name);
    return (nacht || []).concat(weitere || []).filter(function (x) { return x && x.id !== ausserId && norm(x.name) === n; })[0] || null;
  }

  /* ---------- Formular des Editors ----------
     form: { neu, kennung (bei neu: aus dem Namen gebildet), name, stationen [],
             hefeKg, hefeG, kesselKg (Texte), ausbeute { lk: { kg, anzahl } (Texte) } }
     ctx:  { nacht, weitere }
     → Liste von Fehlerkennungen ('name_fehlt', 'ausbeute_halb:<lk>' …) */
  function pruefeForm(form, ctx) {
    var f = [], c = ctx || {};
    var name = String(form.name || '').trim();
    if (!name) f.push('name_fehlt');
    else if (name.length > NAME_MAX) f.push('name_lang');
    if (form.neu) {
      if (name && !KENNUNG_MUSTER.test(form.kennung || '')) f.push('kennung_ungueltig');
      else if (name && kennungBelegt(form.kennung, c.nacht, c.weitere)) f.push('kennung_belegt');
    }
    if (name && nameBelegt(name, c.nacht, c.weitere, form.neu ? null : form.kennung)) f.push('name_doppelt');
    var st = form.stationen || [];
    if (!st.length) f.push('station_fehlt');
    if (st.some(function (s) { return STATIONEN_ERLAUBT.indexOf(s) === -1; })) f.push('station_unbekannt');
    var hk = pflegeZahl(form.hefeKg), hg = pflegeZahl(form.hefeG);
    if (!hk.ok || !hg.ok) f.push('hefe_zahl');
    else if (hk.leer !== hg.leer) f.push('hefe_halb');
    if (!pflegeZahl(form.kesselKg).ok) f.push('kessel_zahl');
    Object.keys(form.ausbeute || {}).forEach(function (lk) {
      var a = form.ausbeute[lk] || {}, k = pflegeZahl(a.kg), n = pflegeZahl(a.anzahl);
      if (!k.ok || !n.ok) f.push('ausbeute_zahl:' + lk);
      else if (k.leer !== n.leer) f.push('ausbeute_halb:' + lk);
    });
    return f;
  }
  /* Formular → Felder des Teig-Dokuments (ohne Herkunft und Sicherung, die setzt
     das Gerüst). altAusbeute: die gespeicherte Map — Einträge für Produkte, die
     nicht im Formular stehen (umgehängte, verwaiste), bleiben unverändert liegen
     (Freigabe KC §2: „bleiben liegen“). Im Formular geleerte Ausbeute: Eintrag weg. */
  function teigDokument(form, altAusbeute, geloescht) {
    var d = { name: String(form.name || '').trim() };
    d.stationen = STATIONEN_ERLAUBT.filter(function (s) { return (form.stationen || []).indexOf(s) !== -1; })
      .sort(function (a, b) { return reihe(a) - reihe(b); });
    var hk = pflegeZahl(form.hefeKg).wert, hg = pflegeZahl(form.hefeG).wert;
    if (positiv(hk) && positiv(hg)) { d.hefeRefKg = hk; d.hefeRefG = hg; }
    var kk = pflegeZahl(form.kesselKg).wert;
    if (positiv(kk)) d.kesselMaxKg = kk;
    var aus = {};
    Object.keys(altAusbeute || {}).forEach(function (lk) { if (ausbeuteGueltig(altAusbeute[lk])) aus[lk] = { kg: altAusbeute[lk].kg, anzahl: altAusbeute[lk].anzahl }; });
    Object.keys(form.ausbeute || {}).forEach(function (lk) {
      var a = form.ausbeute[lk] || {}, k = pflegeZahl(a.kg).wert, n = pflegeZahl(a.anzahl).wert;
      if (positiv(k) && positiv(n)) aus[lk] = { kg: k, anzahl: n }; else delete aus[lk];
    });
    d.ausbeute = aus;
    d.geloescht = !!geloescht;
    return d;
  }
  function reihe(s) { var i = STATIONEN_REITER.indexOf(s); return i === -1 ? 100 + STATIONEN_ERLAUBT.indexOf(s) : i; }
  /* Gespeicherter Teig → Formular (Texte mit Komma). */
  function formAusTeig(teig, produkteDesTeigs) {
    var t = teig || {}, aus = {};
    (produkteDesTeigs || []).forEach(function (p) {
      var a = (t.ausbeute || {})[p.legacyKey];
      aus[p.legacyKey] = ausbeuteGueltig(a) ? { kg: zahlText(a.kg), anzahl: zahlText(a.anzahl) } : { kg: '', anzahl: '' };
    });
    return {
      neu: !teig, kennung: teig ? teig.id : '', name: t.name || '', stationen: (t.stationen || []).slice(),
      hefeKg: zahlText(t.hefeRefKg), hefeG: zahlText(t.hefeRefG), kesselKg: zahlText(t.kesselMaxKg), ausbeute: aus
    };
  }
  /* Vergleich ohne Herkunft und Sicherung: unverändert = nicht schreiben. */
  function teigGleich(neu, alt) {
    if (!alt) return false;
    var a = {}, b = {};
    FELDER_TEIG.forEach(function (k) { if (neu[k] !== undefined) a[k] = neu[k]; if (alt[k] !== undefined) b[k] = alt[k]; });
    if (b.geloescht === undefined) b.geloescht = false;
    return stabil(a) === stabil(b);
  }
  function stabil(x) {
    if (Array.isArray(x)) return '[' + x.map(stabil).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + stabil(x[k]); }).join(',') + '}';
    return JSON.stringify(x);
  }

  /* ---------- Zuordnen (Feld ausTeig) ----------
     Keine eigene Logik: Die Seite nimmt L.ausTeigAenderungen und L.teile der
     Teigecke (teigecke_logik.js) mit der Auswahl als { lk: { an } }, wie
     „Teige & Rezepte“. Hier steht nur die Teilgröße. */
  /* Höchstens 4 Produkte je Vorgang (Freigabe KC §2, RK §17: geprüftes Gelände). */
  var PRODUKTE_JE_VORGANG = 4;

  var api = {
    STATIONEN_REITER: STATIONEN_REITER.slice(), STATIONEN_ERLAUBT: STATIONEN_ERLAUBT.slice(), FELDER_TEIG: FELDER_TEIG.slice(),
    NAME_MAX: NAME_MAX, KENNUNG_MUSTER: KENNUNG_MUSTER, PRODUKTE_JE_VORGANG: PRODUKTE_JE_VORGANG,
    istZahl: istZahl, positiv: positiv, norm: norm, aktiv: aktiv,
    deZahl: deZahl, tausender: tausender, kgText: kgText, jeEinheitText: jeEinheitText, grammText: grammText,
    pflegeZahl: pflegeZahl, zahlText: zahlText,
    ausbeuteGueltig: ausbeuteGueltig, kgJeEinheit: kgJeEinheit, zeilenKg: zeilenKg, hefeGueltig: hefeGueltig, hefeGJeKg: hefeGJeKg,
    kessel: kessel, rechne: rechne,
    teigeDerStation: teigeDerStation, produkteDesTeigs: produkteDesTeigs, rechnerKarten: rechnerKarten,
    stationAbweichend: stationAbweichend, produkteOhneTeig: produkteOhneTeig,
    kennungBelegt: kennungBelegt, nameBelegt: nameBelegt,
    pruefeForm: pruefeForm, teigDokument: teigDokument, formAusTeig: formAusTeig, teigGleich: teigGleich
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_TEIGRECHNER_LOGIK = api;
})(typeof window !== 'undefined' ? window : globalThis);
