/* ================================================================
   BäckereiOS · Teigecke — gemeinsames Seiten-Gerüst (DOM + Firestore)
   ================================================================
   Einbindung (klassisches Skript, NACH dem Seiten-Kopf, VOR der
   Seitenlogik):
       <script> …Seiten-Kopf… </script>
       <script src="teigecke_seite.js"></script>
       <script> …Seitenlogik… </script>

   Was hier liegt: Fehleranzeige (err.message sichtbar), Toast,
   Verbindungsleiste, Konto/Haken, Live-Abos, Regelstand-Probe (RK §13),
   Schreiben mit Sicherung im selben Vorgang (RK §10), Konflikt-Erkennung,
   Bearbeiten-Blatt. Reine Rechenlogik bleibt in teigecke_logik.js.

   HERKUNFT: wörtlich aus teigecke_nacht.html v0.8 (02.10.2026, 10:30)
   kopiert, nicht nachgebaut (Starter §4). Jeder Block nennt seine
   Quellzeilen. Die Nachtseite behält ihre eigene Fassung bis Etappe 2
   (Entscheidung KC, 03.10.2026: Probelauf läuft, das Gerüst bewährt sich
   erst auf der neuen Seite). BIS DAHIN GIBT ES DIESE MECHANIK ZWEIMAL:
   Wer hier einen Fehler behebt, muss ihn in teigecke_nacht.html auch
   beheben — und umgekehrt.

   Die Seite muss VORHER bereitstellen (gemeinsamer Namensraum):
     L              = window.BOS_TEIGECKE_LOGIK
     I18N_DE        Texte der Seite; Pflicht-Schlüssel siehe SEITE_TEXTE
     COL            { …, sicherungen: 'teigecke_sicherungen' }
     FELDER         { collection: [Felder] }   (= hasOnly der Regel)
     HAKEN_FUER     { collection: 'wagen'|'teige'|'rezepte' }
     S              Zustand mit kennung, haken, regelstand, verbindung
     REGEL_FASSUNG, REGEL_DATEI
   und NACHHER (werden erst beim Aufruf gebraucht):
     render(), neuLaden(), oeffneNachCol(col, id)
   Im HTML: #fehlerLeiste #fehlerListe #fehlerZuBtn #toast
     #verbindungLeiste #regelLeiste #editSheet #editTitel #editInhalt
     #editFehler #editInfo #editKnoepfe

   CHANGELOG
     2026-10-03 · 04:42 · v0.1 · Erstfassung (Auszug aus der Nachtseite)
       Neu gegenüber der Quelle nur: SEITE_TEXTE (Liste der Pflicht-Texte),
       schreibeNeuEindeutig() — Anlegen unter einem festen Dokumentnamen,
       der noch frei sein muss (Orte: Kennung = Dokumentname, RK §14).
   ================================================================ */
'use strict';

const SCHREIB_ZEITLIMIT_MS = 20000;   /* Quelle Z. 633 */
/* Texte, die das Gerüst über t() abruft — die Seite muss sie in I18N_DE haben
   (test_teigecke.js prüft das). */
const SEITE_TEXTE = ['err_perm', 'err_perm_regel_alt', 'err_netz', 'err_zeit', 'err_unbehandelt', 'err_laden', 'err_konto',
  'err_speichern', 'err_gegenlesen', 'err_haken_fehlt', 'offline_pflege', 'warte_uebertragung', 'offline_stand', 'ausstehend',
  'regel_alt', 'konflikt', 'v_pflicht', 'v_zu_lang', 'f_keine_zutaten'];

/* ===== i18n — Quelle Z. 792–800 ===== */
function t(schluessel, werte) {
  let text = I18N_DE[schluessel] || schluessel;
  Object.keys(werte || {}).forEach(function (k) { text = text.split('{' + k + '}').join(String(werte[k])); });
  return text;
}
function wendeI18nAn() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
}
const esc = L.esc;

/* ===== Fehler sichtbar, Toast — Quelle Z. 818–856 ===== */
/* ---------- Fehler sichtbar (Checkliste §7a) ---------- */
function erklaerung(err) {
  const c = (err && err.code) || '';
  if (c === 'permission-denied') return (S.regelstand === 'alt' ? t('err_perm_regel_alt') : '') + t('err_perm');
  if (c === 'unavailable') return t('err_netz');
  if (c === 'zeitlimit') return t('err_zeit', { s: SCHREIB_ZEITLIMIT_MS / 1000 });
  return '';
}
function fehlerText(kontext, err) {
  const roh = (err && err.code ? err.code + ' — ' : '') + ((err && err.message) || String(err));
  return kontext + ': ' + [erklaerung(err), roh].filter(Boolean).join(' · ');
}
function zeigeFehler(kontext, err) {
  console.error('[Teigecke] ' + kontext, err);
  const liste = document.getElementById('fehlerListe');
  const li = document.createElement('li');
  li.textContent = fehlerText(kontext, err);
  liste.insertBefore(li, liste.firstChild);
  while (liste.children.length > 6) liste.removeChild(liste.lastChild);
  document.getElementById('fehlerLeiste').hidden = false;
}
window.addEventListener('error', function (e) {
  zeigeFehler(t('err_unbehandelt'), { message: (e.message || 'unbekannt') + ' (' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || '?') + ')' });
});
window.addEventListener('unhandledrejection', function (e) {
  zeigeFehler(t('err_unbehandelt'), e.reason || { message: 'unbekannt' });
});
document.getElementById('fehlerZuBtn').addEventListener('click', function () {
  document.getElementById('fehlerLeiste').hidden = true;
  document.getElementById('fehlerListe').innerHTML = '';
});

let toastTimer = null;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.hidden = true; }, 4200);
}

/* ===== Zahl aus Text — Quelle Z. 913–918 ===== */
function parseZahl(text) {
  const s = String(text == null ? '' : text).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

/* ===== online — Quelle Z. 927 ===== */
function online() { return navigator.onLine !== false && !Object.keys(S.verbindung.ausCache).some(function (k) { return S.verbindung.ausCache[k]; }); }

/* ===== Konto und Haken — Quelle Z. 955–966 ===== */
async function ladeKonto() {
  S.haken = { wagen: false, teige: false, rezepte: false };
  if (!S.kennung) return;
  try {
    const konto = await window.BOS_ACCOUNTS.ladeKonto(window.db, S.kennung);
    S.haken = {
      wagen: !!(konto && konto.teigeckePflege === true),
      teige: !!(konto && konto.teigeckeTeige === true),
      rezepte: !!(konto && konto.teigeckeRezepte === true)
    };
  } catch (err) { zeigeFehler(t('err_konto'), err); }
}

/* ===== Live-Daten — Quelle Z. 977–996 ===== */
function merkeVerbindung(schluessel, meta) {
  S.verbindung.ausCache[schluessel] = !!meta.fromCache;
  S.verbindung.ausstehend[schluessel] = !!meta.hasPendingWrites;
  if (!meta.fromCache) S.verbindung.letzteServerZeit = new Date();
}
function mitId(snap) { const a = []; snap.forEach(function (d) { a.push(Object.assign({ id: d.id }, d.data())); }); return a; }
function aboCollection(name, verarbeite) {
  return window.db.collection(COL[name]).onSnapshot({ includeMetadataChanges: true }, function (snap) {
    merkeVerbindung(name, snap.metadata);
    verarbeite(mitId(snap));
    planeRender();
  }, function (err) { zeigeFehler(t('err_laden', { was: COL[name] }), err); });
}
function aboDokument(col, id, schluessel, verarbeite) {
  return window.db.collection(col).doc(id).onSnapshot({ includeMetadataChanges: true }, function (snap) {
    merkeVerbindung(schluessel, snap.metadata);
    verarbeite(snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null);
    planeRender();
  }, function (err) { zeigeFehler(t('err_laden', { was: col + '/' + id }), err); });
}

/* ===== Regelstand-Probe — Quelle Z. 1069–1080 ===== */
async function pruefeRegelstand() {
  try {
    await window.db.collection('bos_regelstand').doc(REGEL_FASSUNG).get({ source: 'server' });
    S.regelstand = 'passt';
  } catch (err) {
    S.regelstand = err && err.code === 'permission-denied' ? 'alt' : 'unbekannt';
    if (S.regelstand === 'unbekannt') console.warn('[Teigecke] Regelstand nicht prüfbar:', err && err.message);
  }
  const el = document.getElementById('regelLeiste');
  el.textContent = t('regel_alt', { fassung: REGEL_FASSUNG, datei: REGEL_DATEI });
  el.hidden = S.regelstand !== 'alt';
}

/* ===== Neu zeichnen, Verbindungsleiste — Quelle Z. 1198–1223 ===== */
let renderGeplant = false, renderAufgeschoben = false;
function planeRender() {
  if (renderGeplant) return;
  renderGeplant = true;
  requestAnimationFrame(function () { renderGeplant = false; render(); });
}
function fokusIn(el) {
  const a = document.activeElement;
  return !!(a && el && el.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
}
document.addEventListener('focusout', function () {
  setTimeout(function () { if (renderAufgeschoben) { renderAufgeschoben = false; render(); } }, 0);
});
function renderVerbindung() {
  const el = document.getElementById('verbindungLeiste');
  const ausstehend = Object.keys(S.verbindung.ausstehend).filter(function (k) { return S.verbindung.ausstehend[k]; }).length;
  const teile = [];
  if (!online()) {
    const z = S.verbindung.letzteServerZeit;
    teile.push(t('offline_stand', { zeit: z ? String(z.getHours()).padStart(2, '0') + ':' + String(z.getMinutes()).padStart(2, '0') : '?' }));
  }
  if (ausstehend) teile.push(t('ausstehend'));
  if (S.produkteAusSpiegel) teile.push(t('produkte_spiegel', { zeit: S.produkteAusSpiegel.toLocaleString('de-DE') }));
  el.hidden = !teile.length;
  el.textContent = teile.join(' · ');
}

/* ===== Quelle Z. 2007–2052 ===== */
/* ---------- Schreiben: Sicherung + Dokument in EINEM Batch ----------
   Die Regel (RK §10) verlangt: sicherungId zeigt auf eine Sicherung, die
   in genau diesem Batch neu entsteht und auf genau dieses Dokument zeigt.
   Eine Mechanik für jeden Schreibweg dieser Seite (Pflege, Archiv,
   Startdaten) — ein künftiger Aufrufer (Produkt-Karte) muss denselben
   Weg gehen, sonst lehnt die Regel ab. */
function nurErlaubteFelder(col, daten) {
  const d = {};
  FELDER[col].forEach(function (k) { if (daten[k] !== undefined) d[k] = daten[k]; });
  return d;
}
function ohneId(dok) { if (!dok) return null; const k = Object.assign({}, dok); delete k.id; return k; }
function mitZeitlimit(promise) {
  let timer;
  const zeit = new Promise(function (_, reject) {
    timer = setTimeout(function () { const e = new Error('Zeitlimit ' + (SCHREIB_ZEITLIMIT_MS / 1000) + ' s überschritten'); e.code = 'zeitlimit'; reject(e); }, SCHREIB_ZEITLIMIT_MS);
  });
  return Promise.race([promise, zeit]).finally(function () { clearTimeout(timer); });
}
/* Vorab (29.09.2026): Haken passend zur Collection, Verbindung da, nichts
   mehr ausstehend. Sonst eine verständliche Meldung statt einer späten
   Ablehnung durch die Regel oder eines Schreibvorgangs, der offline hängt. */
function schreibSperre(col, ohneWarten) {
  const haken = HAKEN_FUER[col];
  if (!haken || !S.haken[haken]) return { code: 'haken-fehlt', text: t('err_haken_fehlt') };
  if (!online()) return { code: 'offline', text: t('offline_pflege') };
  const name = Object.keys(COL).filter(function (k) { return COL[k] === col; })[0];
  if (!ohneWarten && name && S.verbindung.ausstehend[name]) return { code: 'ausstehend', text: t('warte_uebertragung') };
  return null;
}
/* ohneWarten: nur das Einlesen, das Eintrag für Eintrag schreibt und jeden
   Schritt selbst abwartet — dort wäre „wird noch übertragen“ ein Fehlalarm
   (die Bestätigung des vorigen Eintrags kann kurz nach dem commit kommen). */
async function schreibe(col, id, daten, aktion, vorher, ohneWarten) {
  const sperre = schreibSperre(col, ohneWarten);
  if (sperre) { const e = new Error(sperre.text); e.code = sperre.code; throw e; }
  const db = window.db;
  const ts = firebase.firestore.FieldValue.serverTimestamp();
  const sichRef = db.collection(COL.sicherungen).doc();
  const zielRef = id ? db.collection(col).doc(id) : db.collection(col).doc();
  const batch = db.batch();
  batch.set(sichRef, { collection: col, dokId: zielRef.id, aktion: aktion, vorher: ohneId(vorher), konto: S.kennung, ts: ts });
  batch.set(zielRef, Object.assign(nurErlaubteFelder(col, daten), { sicherungId: sichRef.id, geaendertVon: S.kennung, geaendertAm: ts }));
  await mitZeitlimit(batch.commit());
  return zielRef.id;
}

/* ===== Quelle Z. 2054–2080 ===== */
/* ---------- Bearbeiten-Sheet ---------- */
let editZustand = null;   // { typ, id, auswahl: { feld: Set } }
function oeffneEdit(titel, inhaltHTML, knoepfe) {
  document.getElementById('editTitel').textContent = titel;
  document.getElementById('editInhalt').innerHTML = inhaltHTML;
  document.getElementById('editFehler').textContent = '';
  document.getElementById('editInfo').textContent = '';
  document.getElementById('editKnoepfe').innerHTML = knoepfe.map(function (k) {
    return '<button type="button" class="bos-btn ' + (k.klasse || '') + '" data-aktion="' + k.aktion + '">' + esc(k.text) + '</button>';
  }).join('');
  document.getElementById('editSheet').hidden = false;
}
function schliesseEdit() { document.getElementById('editSheet').hidden = true; editZustand = null; }
function editFehler(text) { document.getElementById('editFehler').textContent = text; }
function wert(id) { const el = document.getElementById(id); return el ? String(el.value).trim() : ''; }
function feldHTML(label, inner, hilfe) {
  return '<div class="feld"><label class="bos-label">' + esc(label) + '</label>' + inner + (hilfe ? '<div class="feld-hilfe">' + esc(hilfe) + '</div>' : '') + '</div>';
}
function eingabe(id, wertText, extra) {
  return '<input class="bos-input" id="' + id + '" value="' + esc(wertText == null ? '' : wertText) + '" ' + (extra || '') + '>';
}
function chipAuswahlHTML(feld, eintraege) {
  if (!eintraege.length) return '<p class="feld-hilfe">' + esc(t('f_keine_zutaten')) + '</p>';
  return '<div class="chips">' + eintraege.map(function (e) {
    return '<button type="button" class="chip' + (e.warn ? ' warn' : '') + '" data-aktion="chip" data-feld="' + feld + '" data-id="' + esc(e.id) + '" aria-pressed="' + (!!e.an) + '"' + (e.gesperrt ? ' disabled' : '') + '>' + esc(e.text) + '</button>';
  }).join('') + '</div>';
}

/* ===== Pflichttext — Quelle Z. 2159–2163 ===== */
function pruefeText(feldLabel, text, max) {
  if (!text) return t('v_pflicht', { feld: feldLabel });
  if (text.length > max) return t('v_zu_lang', { feld: feldLabel, max: max });
  return '';
}

/* ===== Quelle Z. 2237–2265 ===== */
/* ---------- Konflikt statt Rätsel (29.09.2026) ----------
   Seit die Regel „vorher“ gegen den Serverstand prüft, heißt
   permission-denied entweder „Haken fehlt“ oder „jemand war schneller“.
   Frisch vom Server lesen und unterscheiden. Liefert den Meldungstext
   oder null (dann gilt die normale Berechtigungsmeldung). */
async function konfliktText(col, id, vorher) {
  if (!id || !vorher) return null;
  let frisch = null;
  try {
    const snap = await window.db.collection(col).doc(id).get({ source: 'server' });
    frisch = snap.exists ? snap.data() : null;
  } catch (err) {
    zeigeFehler(t('err_gegenlesen'), err);
    return null;
  }
  if (!L.istVeraltet(vorher, frisch)) return null;
  uebernimmFrisch(col, id, frisch);
  return t('konflikt', { wer: (frisch && frisch.geaendertVon) || '?' });
}
/* Frischen Serverstand sofort in S übernehmen — das Formular öffnet damit,
   auch wenn der Live-Abruf (onSnapshot) noch nicht nachgezogen hat. */
function uebernimmFrisch(col, id, frisch) {
  const dok = frisch ? Object.assign({ id: id }, frisch) : null;
  if (col === COL.einstellungen) { S.einstellungen = dok || {}; return; }
  if (col === COL.teigwerte) { if (dok) S.teigwerte[id] = dok; else delete S.teigwerte[id]; return; }
  const name = Object.keys(COL).filter(function (k) { return COL[k] === col; })[0];
  if (!name || !Array.isArray(S[name])) return;
  S[name] = S[name].filter(function (x) { return x.id !== id; }).concat(dok ? [dok] : []);
}

/* ===== Speichern aus dem Bearbeiten-Blatt — Quelle Z. 2275–2300 ===== */
async function fuehreSchreibenAus(col, id, daten, aktion, vorher, erfolgText) {
  const knoepfe = document.querySelectorAll('#editKnoepfe button');
  knoepfe.forEach(function (b) { b.disabled = true; });
  document.getElementById('editInfo').textContent = '…';
  try {
    await schreibe(col, id, daten, aktion, vorher);
    schliesseEdit();
    toast(erfolgText);
    await neuLaden();
  } catch (err) {
    document.getElementById('editInfo').textContent = '';
    if (err && err.code === 'permission-denied') {
      const konflikt = await konfliktText(col, id, vorher);
      if (konflikt) {
        console.error('[Teigecke] Speichern abgelehnt: veralteter Stand', err);
        await neuLaden();
        oeffneNachCol(col, id);      // Formular mit dem frischen Stand
        editFehler(konflikt);
        return;
      }
    }
    editFehler(fehlerText(t('err_speichern'), err));
    zeigeFehler(t('err_speichern'), err);
    knoepfe.forEach(function (b) { b.disabled = false; });
  }
}

/* ===== NEU 03.10.2026: Anlegen unter festem, noch freiem Dokumentnamen =====
   Für Orte: Dokumentname = Kennung in Kleinbuchstaben. kandidat(versuch)
   liefert { id, daten } für den n-ten Versuch (0, 1, 2 …) oder null.
   In einer Transaktion wird der Name vom Server gelesen; ist er belegt
   (ein zweites Gerät war schneller), kommt der nächste Kandidat dran.
   Sicherung und Dokument entstehen wie bei schreibe() im selben Vorgang.
   Das Schloss bleibt die Regel: Ein vorhandenes Dokument kann nicht als
   „anlegen“ überschrieben werden (vorher muss dem Serverstand gleichen). */
async function schreibeNeuEindeutig(col, kandidat, hoechstens) {
  const sperre = schreibSperre(col, false);
  if (sperre) { const e = new Error(sperre.text); e.code = sperre.code; throw e; }
  const db = window.db;
  const ts = firebase.firestore.FieldValue.serverTimestamp();
  for (let versuch = 0; versuch < (hoechstens || 25); versuch++) {
    const k = kandidat(versuch);
    if (!k) break;
    const zielRef = db.collection(col).doc(k.id);
    const sichRef = db.collection(COL.sicherungen).doc();
    try {
      await mitZeitlimit(db.runTransaction(async function (tx) {
        const snap = await tx.get(zielRef);
        if (snap.exists) { const e = new Error('Dokumentname ' + k.id + ' ist schon vergeben'); e.code = 'belegt'; throw e; }
        tx.set(sichRef, { collection: col, dokId: zielRef.id, aktion: 'anlegen', vorher: null, konto: S.kennung, ts: ts });
        tx.set(zielRef, Object.assign(nurErlaubteFelder(col, k.daten), { sicherungId: sichRef.id, geaendertVon: S.kennung, geaendertAm: ts }));
      }));
      return k;
    } catch (err) {
      if (err && err.code === 'belegt') continue;
      throw err;
    }
  }
  const e = new Error('Keine freie Nummer gefunden (alle Versuche belegt)'); e.code = 'belegt';
  throw e;
}
