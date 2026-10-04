/**
 * bos_produktionskette.js — BäckereiOS V2
 * ============================================================
 * Zentrale Host-Funktion für die Produktionskette (Fundament §3).
 * Reine Berechnungslogik im Kern — kein DOM, kein direkter Firestore-
 * Zugriff im Rechenkern selbst. Der optionale Async-Wrapper unten
 * übernimmt die Zeitkontext-Auflösung, ruft aber nur bereits
 * dokumentierte, öffentliche Schnittstellen anderer Module auf.
 *
 * HERKUNFT — zusammengeführt aus zwei Alt-System-Versionen:
 *   - produktionskette_logik.js  → gesperrt/manuell/automatisch-Kette,
 *                                   Ausgabe-Struktur, Grundmodell
 *   - froster_gehirn.js (V125)   → robustere Verschiebe-Logik für den
 *                                   "gleichmäßig"-Modus (Donor/Receiver)
 *
 * ABWEICHUNGEN VOM ALT-SYSTEM (mit Ulf abgestimmt, 31.08.2026):
 *   1. Hamster-Eskalation bleibt bei bos_hamster.js/bos_hamster_config.json
 *      wie bereits gebaut — NICHT die "Raketen"-Logik aus froster_gehirn.js
 *      übernommen (dort: Stufe 3 an Nicht-Samstagen = Tageswert × 2).
 *   2. "gesperrt" ist real und wird übernommen: ein Tageswert, der weder
 *      von Automatik noch von Verteilung mehr angefasst wird.
 *   3. Lücke/Knapp-Warnung schaut jetzt einen Tag voraus (deckt der
 *      Bestand NACH heutiger Produktion den MORGIGEN Bedarf?), statt nur
 *      auf "Bestand exakt 0" zu prüfen — Ulfs Käsebrötchen-Beispiel.
 *   4. "Grill"-Sondertag (aus froster_gehirn.js) ersatzlos gestrichen —
 *      war nie mehr als eine unbenutzte Idee ("Blödsinn", O-Ton Ulf).
 *   5. Durchgehend BOS-Wochentag-Index (0=Mo…6=So). Die JS-Sonntag-
 *      first-Parallel-Indizierung aus froster_gehirn.js (session.startDayIdx)
 *      wurde NICHT übernommen — nur eine einzige Umrechnung an der Stelle,
 *      wo aus einem Date-Objekt ein Wochentag gelesen wird.
 *
 * ZEITLICHE REIHENFOLGE PRO TAG (Kernprinzip, niemals vertauschen):
 *   1. Verbrauch abziehen        → bestandNachMorgen
 *   2. Lücke/Knapp DARAUF prüfen → warnung
 *   3. Produktion ADDIEREN       → bestand (Endstand des Tages)
 *
 * Export: window.BOS_KETTE = { berechne, ermittleTagesTypen, berechneMitZeitkontext }
 * ============================================================
 */

(function () {
'use strict';

const JS_ZU_BOS = [6, 0, 1, 2, 3, 4, 5]; // JS getDay() (0=So) → BOS-Index (0=Mo)
const WT_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WT_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function pad2(n) { return String(n).padStart(2, '0'); }

function bosWochentag(heute, offset) {
  const d = new Date(heute);
  d.setDate(heute.getDate() + offset);
  return JS_ZU_BOS[d.getDay()];
}

// ============================================================
// GLEICHMÄSSIG-VERTEILUNG mit Nachbesserung (Donor/Receiver)
// Neu zusammengeführt — KEINE 1:1-Kopie aus einer der beiden Alt-
// Dateien. Grundverteilung wie produktionskette_logik.js (gleichmäßig
// auf freie, nicht-gesperrte Tage, Rest an die letzten Tage), danach
// iterative Korrektur wie froster_gehirn.js (Charge von einem späteren
// auf einen früheren freien Tag vorziehen, falls sonst eine Lücke
// entstünde). Bitte mit echten Szenarien gegentesten, bevor produktiv
// genutzt — das ist die am wenigsten "nur portierte" Stelle dieser Datei.
// ============================================================
function verteileGleichmaessig({ prodOffsets, zielOff, batch, startBestand, fehlmengeAbs, gesperrtWerte, verbrauchAn }) {
  const vorschlaege = {};

  const gesperrtSumme = prodOffsets
    .filter(o => gesperrtWerte[o] !== undefined)
    .reduce((s, o) => s + gesperrtWerte[o], 0);
  prodOffsets
    .filter(o => gesperrtWerte[o] !== undefined)
    .forEach(o => { vorschlaege[o] = gesperrtWerte[o]; });

  const freie = prodOffsets.filter(o => gesperrtWerte[o] === undefined);
  if (freie.length === 0) return vorschlaege;

  let gesamtBedarf = fehlmengeAbs;
  for (let j = 1; j <= zielOff; j++) gesamtBedarf += verbrauchAn(j);
  // fehlmengeAbs steckt oben bereits einmal in gesamtBedarf — hier NICHT nochmal
  // über einen reduzierten Startbestand abziehen, sonst wird sie doppelt gezählt.
  gesamtBedarf = Math.max(0, gesamtBedarf - startBestand);
  const restBedarf = Math.max(0, gesamtBedarf - gesperrtSumme);

  const n = freie.length;
  const totalBatches = Math.ceil(restBedarf / batch);
  const basis = Math.floor(totalBatches / n);
  const rest = totalBatches % n;
  const batches = new Array(n).fill(basis);
  for (let i = n - 1; i >= n - rest; i--) batches[i]++;

  let valid = false, sanity = 0;
  while (!valid && sanity < 50) {
    valid = true;
    let sim = startBestand - fehlmengeAbs;
    for (let i = 0; i <= zielOff; i++) {
      const vb = verbrauchAn(i);
      const nachVerbrauch = i === 0 ? sim : sim - vb;

      const idxInFreie = freie.indexOf(i);
      let prodHeute = idxInFreie > -1 ? batches[idxInFreie] * batch : 0;
      if (gesperrtWerte[i] !== undefined) prodHeute = gesperrtWerte[i];

      if (nachVerbrauch < 0) {
        let donor = -1;
        for (let d = n - 1; d >= 0; d--) { if (batches[d] > 0 && freie[d] > i) { donor = d; break; } }
        let receiver = -1;
        for (let r = 0; r < n; r++) { if (freie[r] <= i) receiver = r; else break; }
        if (donor > -1 && receiver > -1 && donor !== receiver) {
          batches[donor]--; batches[receiver]++;
          valid = false;
          break;
        }
      }
      sim = nachVerbrauch + prodHeute;
    }
    sanity++;
  }

  freie.forEach((o, i) => { vorschlaege[o] = batches[i] * batch; });
  return vorschlaege;
}

// ============================================================
// KERN: reine, synchrone Kettenberechnung
// ============================================================
/**
 * @param {object} inp
 * @param {number[]} inp.needs           Grundbedarf pro BOS-Wochentag [Mo..So], Länge 7
 * @param {number}  [inp.satNeed]        Override für Samstagsbedarf (Hamster-Basis). Default needs[5]
 * @param {number}  [inp.batchSize]      Chargengröße. Default 1
 * @param {number}  inp.startBestand     Aktueller Bestand (Bleche/Stück)
 * @param {number}  [inp.fehlmengeAbs]   Positive Zahl: sofortiger Zusatzbedarf durch unzureichenden Froster
 * @param {boolean} inp.frosterFertig    Ist der Froster für morgen (Offset 1) fertig befüllt?
 * @param {number}  inp.zielOff          Ziel-Tag als Offset (0=heute)
 * @param {object}  inp.prodTage         { offset: true } — an diesen Tagen wird produziert
 * @param {object}  [inp.manuelleWerte]  { offset: Zahl } — weiche Überschreibung
 * @param {object}  [inp.gesperrtWerte]  { offset: Zahl } — harte Sperrung, gewinnt immer
 * @param {boolean} [inp.gleichmaessig]  Verteilmodus statt sequenzieller Automatik
 * @param {Date}    inp.heute            Datum "heute", 00:00:00
 * @param {object}  [inp.tagesTypen]     { offset: 'normal'|'zu'|'hamster_1'|'hamster_2'|'hamster_3' }.
 *                                        Fehlt ein Offset, gilt 'normal'. Siehe ermittleTagesTypen().
 * @returns {{kette:object[], vorschlaege:object, gesamtVerbrauch:number, gesamtProduktion:number, endlager:number, warnungen:object[], istOk:boolean}}
 */
function berechne(inp) {
  const needs = inp.needs;
  const satBedarf = (inp.satNeed != null) ? inp.satNeed : (needs[5] || 0);
  const batch = inp.batchSize || 1;
  const startBestand = inp.startBestand || 0;
  const fehlmengeAbs = inp.fehlmengeAbs || 0;
  const frosterFertig = !!inp.frosterFertig;
  const zielOff = inp.zielOff;
  const prodTage = inp.prodTage || {};
  const manuelleWerte = inp.manuelleWerte || {};
  const gesperrtWerte = inp.gesperrtWerte || {};
  const gleichmaessig = !!inp.gleichmaessig;
  const heute = inp.heute;
  const tagesTypen = inp.tagesTypen || {};

  function verbrauchAn(offset) {
    if (offset <= 0) return 0;
    if (frosterFertig && offset === 1) return 0;

    const typ = tagesTypen[offset] || 'normal';
    if (typ === 'zu') return 0;

    const bosIdx = bosWochentag(heute, offset);
    if (typ.indexOf('hamster_') === 0) {
      const stufe = parseInt(typ.slice(8), 10);
      if (window.BOS_HAMSTER && typeof window.BOS_HAMSTER.berechne === 'function') {
        return Math.ceil(window.BOS_HAMSTER.berechne(stufe, needs[bosIdx] || 0, satBedarf, bosIdx));
      }
      console.warn('[BOS_KETTE] BOS_HAMSTER nicht geladen — nutze Normalbedarf statt Stufe', stufe, 'an Offset', offset);
    }
    return needs[bosIdx] || 0;
  }

  const prodOffsets = Object.keys(prodTage)
    .map(Number).filter(o => prodTage[o]).sort((a, b) => a - b);

  // ── Vorschläge ermitteln ──────────────────────────────────
  let vorschlaege = {};

  if (gleichmaessig) {
    vorschlaege = verteileGleichmaessig({
      prodOffsets, zielOff, batch, startBestand, fehlmengeAbs, gesperrtWerte, verbrauchAn
    });
  } else {
    // simBestand startet OHNE Abzug von fehlmengeAbs — die Fehlmenge wird
    // stattdessen unten einmalig als garantierter Zusatzbedarf beim ersten
    // automatisch berechneten Produktionstag aufgeschlagen (fehlmengeOffen).
    //
    // FIX 03.09.2026 (Rondo-Livetest, Ulf): "verfuegbar" wird jetzt NICHT
    // mehr auf 0 gekappt. Kappen hätte ein bereits VOR der Produktion
    // entstandenes Minus (z.B. startBestand reicht nicht mal für den
    // Verbrauch am Produktionstag selbst — unabhängig von fehlmengeAbs)
    // stillschweigend verschluckt: der Vorschlag deckte dann nur noch den
    // KÜNFTIGEN Bedarf, nicht das bereits bestehende Loch — dieselbe Lücke
    // tauchte dadurch unverändert am Zieltag wieder auf, obwohl der
    // Vorschlag als "automatisch berechnet" auftrat. Ohne Kappung fließt
    // ein negativer bestandNachMorgen jetzt als zusätzlicher Bedarf mit ein
    // (fehlend = futureBedarf - bestandNachMorgen), unabhängig davon, ob
    // das Minus von fehlmengeAbs oder schlicht zu wenig startBestand kommt.
    // Kein Konflikt mit fehlmengeOffen: die beiden Mechanismen greifen an
    // unterschiedlichen Stellen (einmaliger Fixbetrag oben drauf vs. der
    // tatsächliche, tagesaktuelle Bestandsverlauf) und addieren sich sauber.
    let simBestand = startBestand;
    let fehlmengeOffen = fehlmengeAbs;

    for (let i = 0; i <= zielOff; i++) {
      const vb_i = verbrauchAn(i);
      const bestandNachMorgen = i === 0 ? simBestand : simBestand - vb_i;

      if (prodTage[i]) {
        if (gesperrtWerte[i] !== undefined) {
          vorschlaege[i] = gesperrtWerte[i];
        } else if (manuelleWerte[i] !== undefined) {
          vorschlaege[i] = manuelleWerte[i];
        } else {
          const naechster = prodOffsets.find(o => o > i);
          const bis = naechster !== undefined ? naechster : zielOff;
          let futureBedarf = fehlmengeOffen;
          for (let j = i + 1; j <= bis; j++) futureBedarf += verbrauchAn(j);
          const verfuegbar = bestandNachMorgen;
          const fehlend = Math.max(0, futureBedarf - verfuegbar);
          vorschlaege[i] = fehlend > 0 ? Math.ceil(fehlend / batch) * batch : 0;
          fehlmengeOffen = 0; // nur einmal verrechnen, an der ersten automatischen Stelle
        }
      }

      const prod_i = prodTage[i] ? (vorschlaege[i] || 0) : 0;
      simBestand = bestandNachMorgen + prod_i;
    }
  }

  // ── Kette aufbauen ────────────────────────────────────────
  const kette = [];
  let bestand = startBestand - fehlmengeAbs;
  let gesamtVerbrauch = 0;
  let gesamtProduktion = 0;

  for (let i = 0; i <= zielOff; i++) {
    const bosIdx = bosWochentag(heute, i);
    const gedeckt = frosterFertig && i === 1;
    const typ = tagesTypen[i] || 'normal';
    const vb_i = verbrauchAn(i);
    const prod_i = prodTage[i] ? (vorschlaege[i] || 0) : 0;

    // 1. Verbrauch abziehen
    const bestandNachMorgen = i === 0 ? bestand : bestand - vb_i;
    const istLuecke = i > 0 && bestandNachMorgen < 0;

    // 3. Produktion addieren (NACH der Prüfung — nie vorher!)
    bestand = bestandNachMorgen + prod_i;

    // 2. Warnung — schaut voraus: deckt der Endstand den Bedarf von MORGEN?
    const morgenBedarf = (i < zielOff) ? verbrauchAn(i + 1) : 0;
    const istKnapp = !istLuecke && i > 0 && i < zielOff && bestand < morgenBedarf;
    const warnung = istLuecke ? 'luecke' : (istKnapp ? 'knapp' : null);

    if (i > 0 && !gedeckt) gesamtVerbrauch += vb_i;
    gesamtProduktion += prod_i;

    const d = new Date(heute);
    d.setDate(heute.getDate() + i);

    kette.push({
      offset: i,
      datum: d,
      bosIdx,
      tagKurz: WT_KURZ[bosIdx],
      tagLang: WT_LANG[bosIdx],
      istHeute: i === 0,
      istSonntag: bosIdx === 6,
      gedecktDurchFroster: gedeckt,
      tagTyp: typ,
      istZu: typ === 'zu',
      istHamster: typ.indexOf('hamster_') === 0,
      verbrauch: vb_i,
      produktion: prod_i,
      bestandNachMorgen,
      bestand,
      prodTag: !!prodTage[i],
      istGesperrt: gesperrtWerte[i] !== undefined,
      istManuell: gesperrtWerte[i] === undefined && manuelleWerte[i] !== undefined,
      vorschlag: vorschlaege[i] ?? 0,
      warnung
    });
  }

  const warnungen = kette
    .filter(t => t.warnung)
    .map(t => ({
      typ: t.warnung,
      tag: t.tagLang,
      datum: pad2(t.datum.getDate()) + '.' + pad2(t.datum.getMonth() + 1) + '.',
      delta: t.bestandNachMorgen
    }));

  return {
    kette,
    vorschlaege,
    gesamtVerbrauch,
    gesamtProduktion,
    endlager: bestand,
    warnungen,
    istOk: warnungen.length === 0
  };
}

// ============================================================
// ASYNC-HILFE: Tagestypen aus bos_zeitkontext.js auflösen
// Ruft ausschließlich die dokumentierte Schnittstelle
// bos_zeitkontext.js → status(db, datumStr) auf (BOS_ZEITKONTEXT_DOKU.md §3).
// Baut daraus { offset: 'normal'|'zu'|'hamster_N' } für berechne().
// UNGETESTET gegen die echte bos_zeitkontext.js-Datei — nur gegen deren
// Doku gebaut. Bitte beim ersten echten Einsatz gegenprüfen.
// ============================================================
async function ermittleTagesTypen(db, heute, zielOff) {
  const typen = {};
  if (!window.BOS_ZEITKONTEXT || typeof window.BOS_ZEITKONTEXT.status !== 'function') {
    console.warn('[BOS_KETTE] BOS_ZEITKONTEXT nicht geladen — alle Tage gelten als "normal"');
    return typen;
  }
  for (let i = 0; i <= zielOff; i++) {
    const d = new Date(heute);
    d.setDate(heute.getDate() + i);
    const datumStr = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    try {
      const s = await window.BOS_ZEITKONTEXT.status(db, datumStr);
      if (!s.offen) typen[i] = 'zu';
      else if (s.hamsterStufe > 0) typen[i] = 'hamster_' + s.hamsterStufe;
      else typen[i] = 'normal';
    } catch (e) {
      console.warn('[BOS_KETTE] Zeitkontext-Abfrage fehlgeschlagen für', datumStr, e);
      typen[i] = 'normal';
    }
  }
  return typen;
}

/**
 * Komfort-Wrapper: löst tagesTypen automatisch auf und ruft dann berechne().
 * inp entspricht berechne(), nur ohne tagesTypen — die werden hier ermittelt.
 * Braucht zusätzlich inp.db (Firestore-Instanz).
 */
async function berechneMitZeitkontext(inp) {
  const tagesTypen = await ermittleTagesTypen(inp.db, inp.heute, inp.zielOff);
  return berechne(Object.assign({}, inp, { tagesTypen }));
}

window.BOS_KETTE = {
  berechne,
  ermittleTagesTypen,
  berechneMitZeitkontext
};

})();
