/* ================================================================
   BäckereiOS · Zählkarte — gemeinsamer Baustein für Liste und Karte
   ================================================================
   Einbindung:  <link rel="stylesheet" href="../bos_zaehlkarte.css">
                <script src="../bos_zaehlkarte.js"></script>
   Stellt bereit: window.BOS_ZAEHLKARTE  (in Node: module.exports, nur der reine Teil wird dort gebraucht)
   Doku:        BOS_ZAEHLKARTE_DOKU.md

   WOFÜR: Zählen im Rundgang. Feste Begriffe: STANDORT → ORT → EINTRAG.
   Die Liste zeigt je Ort die Einträge mit ○ (offen) / – (bewusst 0) / ✓ (gezählt).
   Antippen öffnet die Karte als Diashow: Raster, „voll“, Zahlenfeld, ↶ Zurück,
   ‹ › und ✕. Ein Tipp gibt die Zahl an die Seite und blättert weiter; nach dem
   letzten Eintrag eines Ortes kommt der erste des nächsten Ortes desselben
   Standorts; nach dem letzten Ort meldet der Baustein „Ende“.

   GRENZE (Bauplan Lager Stufe 2 §5.3): Der Baustein kennt KEINE Firestore-
   Sammlung, keine Rolle, kein Konto und keinen Artikelstamm. Er bekommt die
   Daten von der Seite (daten(), plan(), status()) und gibt jeden Tipp über
   beiTipp() zurück. Speichern, Rechte, Fehler und „ausstehend“ zählt die Seite.
   Deshalb kann der Froster (Stufe 4) ihn mit Blechen und eigener Speicherung
   übernehmen (zweistufiges Raster 0–200, nur ganze Zahlen).

   ↶ ZURÜCK (Kontroll-Chat 11.11., 06:43): springt zur Karte des letzten Tipps
   und zeigt dessen Zahl markiert. Der nächste Tipp dort ERSETZT ihn: beiTipp()
   bekommt { ersetzt: <id des Fehltipps> }. Die id liefert beiTipp() selbst
   (Rückgabewert { id }). Mehrmals Zurück geht (Stapel der Tipps dieses Gangs).

   Keine Farben im JS, nur Klassen (bos_zaehlkarte.css mit Design-Tokens).

   CHANGELOG
     2026-11-11 · 06:53 · v1 · Erstfassung (Lager Stufe 2, #120; Bauplan
       SESSION_2026-11-11_LAGER_STUFE2_ZAEHLEN_BAU.md, Freigabe KC 06:43)
   ================================================================ */
(function (global) {
  'use strict';

  /* ---------------- reiner Teil (Node-testbar) ---------------- */

  /* Raster einstufig für N (1 … 48): Reihe 1 = 0 … ⌊N/2⌋, Reihe 2 = ⌊N/2⌋+1 … N, „voll“ = N.
     Ohne N (0, fehlt): nur „0“ als Knopf, kein „voll“ (Zahlenfeld macht den Rest). */
  function einstufig(n) {
    var N = typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 1 ? n : 0;
    if (!N) return { art: 'einstufig', reihen: [[0]], voll: null };
    var h = Math.floor(N / 2), r1 = [], r2 = [];
    for (var i = 0; i <= h; i++) r1.push(i);
    for (var j = h + 1; j <= N; j++) r2.push(j);
    return { art: 'einstufig', reihen: [r1, r2], voll: N };
  }
  /* Zweistufig (Froster-artig): erst die Zehner 0, schritt, … bis, dann die Einer 0 … schritt−1.
     Die Summe darf „bis“ nicht überschreiten. Kein „voll“. */
  function zweistufig(o) {
    var schritt = o && o.schritt >= 2 ? Math.floor(o.schritt) : 10, bis = o && o.bis >= 1 ? Math.floor(o.bis) : 200;
    var zehner = [], einer = [];
    for (var z = 0; z <= bis; z += schritt) zehner.push(z);
    for (var e = 0; e < schritt; e++) einer.push(e);
    return { art: 'zweistufig', zehner: zehner, einer: einer, bis: bis, voll: null };
  }
  function einerErlaubt(plan, zehner, einer) { return plan && plan.art === 'zweistufig' && zehner + einer <= plan.bis; }

  /* Zahlenfeld: Text → Zahl nach den Regeln der Seite.
     regeln = { nurGanze: bool, nachkomma: Stellen (0 = ganz), max: obere Grenze }.
     Liefert { wert } oder { fehler: 'leer' | 'keine_zahl' | 'negativ' | 'ganz' | 'nachkomma' | 'zu_gross' }. */
  function wertAusText(text, regeln) {
    var r = regeln || {};
    var s = String(text == null ? '' : text).trim().replace(/\s/g, '').replace(',', '.');
    if (!s) return { fehler: 'leer' };
    if (!/^-?\d+(\.\d+)?$/.test(s)) return { fehler: 'keine_zahl' };
    var w = Number(s);
    if (w < 0) return { fehler: 'negativ' };
    var stellen = (s.split('.')[1] || '').length;
    var erlaubt = r.nurGanze ? 0 : (typeof r.nachkomma === 'number' ? r.nachkomma : 0);
    if (stellen > erlaubt) return { fehler: erlaubt === 0 ? 'ganz' : 'nachkomma' };
    if (typeof r.max === 'number' && w > r.max) return { fehler: 'zu_gross' };
    return { wert: w };
  }

  /* Reihenfolge des Rundgangs: alle Einträge aller Orte hintereinander.
     Schlüssel eines Eintrags = ortId + '|' + eintragId (derselbe Artikel kann an zwei Orten stehen). */
  function schluessel(ortId, eintragId) { return String(ortId) + '|' + String(eintragId); }
  function flach(orte) {
    var aus = [];
    (orte || []).forEach(function (o, oi) {
      (o.eintraege || []).forEach(function (e, ei) { aus.push({ key: schluessel(o.id, e.id), ortId: o.id, eintragId: e.id, ortIndex: oi, eintragIndex: ei }); });
    });
    return aus;
  }
  function index(fl, key) { for (var i = 0; i < fl.length; i++) if (fl[i].key === key) return i; return -1; }
  /* nächster / voriger Schlüssel oder null (Ende / Anfang) */
  function naechster(fl, key) { var i = index(fl, key); return i >= 0 && i + 1 < fl.length ? fl[i + 1].key : null; }
  function voriger(fl, key) { var i = index(fl, key); return i > 0 ? fl[i - 1].key : null; }
  /* wechselt der nächste Eintrag den Ort? (für den kurzen Hinweis „weiter in …“) */
  function ortWechsel(fl, key) {
    var i = index(fl, key);
    return i >= 0 && i + 1 < fl.length && fl[i + 1].ortId !== fl[i].ortId ? fl[i + 1].ortId : null;
  }

  /* ---------------- Anzeige (Browser) ---------------- */
  var DE = {
    offen: '○', null_: '–', ausstehend: '⏳', fehler: '⚠︎',
    keine_eintraege: '(noch keine Einträge)',
    voll: 'voll ({n})', zahl_platzhalter: 'Zahl', ok: 'OK', zurueck: '↶ Zurück', schliessen: '✕', vor: '›', rueck: '‹',
    getippt: 'Getippt: {w} — der nächste Tipp hier ersetzt ihn.', erst_zehner: 'Erst die Zehner, dann die Einer.',
    zehner_gewaehlt: '{z} + …', weiter_in: 'Weiter in {ort}', ende: 'Fertig mit {standort}.',
    f_leer: 'Bitte eine Zahl eingeben.', f_keine_zahl: 'Das ist keine Zahl.', f_negativ: 'Weniger als 0 geht nicht.',
    f_ganz: 'Nur ganze Zahlen.', f_nachkomma: 'Höchstens eine Stelle nach dem Komma.', f_zu_gross: 'Höchstens {max}.',
    nichts_zurueck: 'Noch kein Tipp zum Zurücknehmen.'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function zahlText(w) { return String(w).replace('.', ','); }

  /* opt = {
       liste: Element, karte: Element (Overlay, wird gezeigt/versteckt über das Attribut hidden),
       t: function (key, werte) → Text (optional; Rückfall DE),
       daten: function () → { standort: { id, name }, orte: [{ id, name, eintraege: [{ id, name, unter }] }] },
       plan: function (eintrag, ort) → einstufig(N) | zweistufig(...),
       eingabe: { nurGanze, nachkomma, max },
       status: function (eintrag, ort) → { zeichen: 'offen'|'null'|'gezaehlt', wert, ausstehend: bool, fehler: '' },
       beiTipp: function (eintrag, ort, wert, info { ersetzt }) → { id } (Kennung des Tipps, für ↶),
       ende: function (standort) (optional), hinweis: function (text) (optional, z. B. Toast)
     } */
  function erzeuge(opt) {
    var o = opt || {};
    var T = function (k, w) {
      var s = o.t ? o.t('zk_' + k, w) : null;
      if (s == null || s === 'zk_' + k) s = DE[k] !== undefined ? DE[k] : k;
      Object.keys(w || {}).forEach(function (x) { s = String(s).split('{' + x + '}').join(String(w[x])); });
      return s;
    };
    var Z = { key: null, zehner: null, stapel: [], markiert: null, meldung: '' };   /* markiert = { key, wert, id } nach ↶ */

    function daten() { return (o.daten && o.daten()) || { standort: null, orte: [] }; }
    function finde(key) {
      var d = daten();
      for (var i = 0; i < d.orte.length; i++) {
        var ort = d.orte[i];
        for (var j = 0; j < (ort.eintraege || []).length; j++) if (schluessel(ort.id, ort.eintraege[j].id) === key) return { ort: ort, eintrag: ort.eintraege[j] };
      }
      return null;
    }
    function zeichen(st) {
      if (!st) return { text: T('offen'), klasse: 'zk-offen' };
      if (st.fehler) return { text: T('fehler'), klasse: 'zk-fehler', titel: st.fehler };
      var aus = st.ausstehend ? ' ' + T('ausstehend') : '';
      if (st.zeichen === 'gezaehlt') return { text: zahlText(st.wert) + ' ✓' + aus, klasse: 'zk-gezaehlt' + (st.ausstehend ? ' zk-wartet' : '') };
      if (st.zeichen === 'null') return { text: T('null_') + aus, klasse: 'zk-null' + (st.ausstehend ? ' zk-wartet' : '') };
      return { text: T('offen'), klasse: 'zk-offen' };
    }

    function zeigeListe() {
      if (!o.liste) return;
      var d = daten(), html = '';
      d.orte.forEach(function (ort) {
        var n = (ort.eintraege || []).length, offen = 0;
        var zeilen = (ort.eintraege || []).map(function (e) {
          var st = o.status ? o.status(e, ort) : null, z = zeichen(st);
          if (!st || st.zeichen === 'offen') offen++;
          return '<button type="button" class="zk-zeile" data-zk="oeffne" data-key="' + esc(schluessel(ort.id, e.id)) + '">' +
            '<span class="zk-name">' + esc(e.name) + (e.unter ? '<span class="zk-unter">' + esc(e.unter) + '</span>' : '') + '</span>' +
            '<span class="zk-zeichen ' + z.klasse + '"' + (z.titel ? ' title="' + esc(z.titel) + '"' : '') + '>' + esc(z.text) + '</span></button>' +
            (st && st.fehler ? '<div class="zk-fehlertext">' + esc(st.fehler) + '</div>' : '');
        }).join('');
        html += '<section class="zk-ort"><h2 class="zk-ort-kopf">' + esc(ort.name) + (n ? ' <span class="zk-zahl">' + offen + ' ' + esc(T('offen')) + ' / ' + n + '</span>' : '') + '</h2>' +
          (n ? zeilen : '<div class="zk-leer">' + esc(T('keine_eintraege')) + '</div>') + '</section>';
      });
      o.liste.innerHTML = html;
    }

    function knopf(wert, extra, text) {
      var m = Z.markiert && Z.markiert.key === Z.key && Z.markiert.wert === wert;
      return '<button type="button" class="zk-knopf' + (extra || '') + (m ? ' zk-markiert' : '') + '" data-zk="tipp" data-wert="' + wert + '">' + esc(text != null ? text : zahlText(wert)) + '</button>';
    }
    function zeichneKarte() {
      if (!o.karte || !Z.key) return;
      var f = finde(Z.key);
      if (!f) { schliesse(); return; }
      var fl = flach(daten().orte), plan = o.plan ? o.plan(f.eintrag, f.ort) : einstufig(0);
      var html = '<div class="zk-sheet" role="dialog" aria-modal="true">' +
        '<div class="zk-kopf"><button type="button" class="zk-nav" data-zk="rueck"' + (voriger(fl, Z.key) ? '' : ' disabled') + ' aria-label="' + esc(T('rueck')) + '">' + esc(T('rueck')) + '</button>' +
        '<div class="zk-titel"><div class="zk-titel-name">' + esc(f.eintrag.name) + '</div><div class="zk-titel-unter">' + esc([f.ort.name, f.eintrag.unter].filter(Boolean).join(' · ')) + '</div></div>' +
        '<button type="button" class="zk-nav" data-zk="vor"' + (naechster(fl, Z.key) ? '' : ' disabled') + ' aria-label="' + esc(T('vor')) + '">' + esc(T('vor')) + '</button>' +
        '<button type="button" class="zk-nav zk-zu" data-zk="zu" aria-label="' + esc(T('schliessen')) + '">' + esc(T('schliessen')) + '</button></div>';
      if (plan.art === 'zweistufig') {
        html += '<div class="zk-hinweis">' + esc(Z.zehner == null ? T('erst_zehner') : T('zehner_gewaehlt', { z: Z.zehner })) + '</div>';
        html += '<div class="zk-raster">' + plan.zehner.map(function (z) {
          return '<button type="button" class="zk-knopf' + (Z.zehner === z ? ' zk-markiert' : '') + '" data-zk="zehner" data-wert="' + z + '">' + z + '</button>';
        }).join('') + '</div>';
        html += '<div class="zk-raster">' + plan.einer.map(function (e) {
          var ok = Z.zehner != null && einerErlaubt(plan, Z.zehner, e);
          return '<button type="button" class="zk-knopf" data-zk="einer" data-wert="' + e + '"' + (ok ? '' : ' disabled') + '>' + e + '</button>';
        }).join('') + '</div>';
      } else {
        plan.reihen.forEach(function (r) { html += '<div class="zk-raster">' + r.map(function (w) { return knopf(w); }).join('') + '</div>'; });
        if (plan.voll) html += '<div class="zk-raster">' + knopf(plan.voll, ' zk-voll', T('voll', { n: plan.voll })) + '</div>';
      }
      html += '<div class="zk-eingabe"><input class="zk-feld" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" placeholder="' + esc(T('zahl_platzhalter')) + '" aria-label="' + esc(T('zahl_platzhalter')) + '">' +
        '<button type="button" class="zk-knopf zk-ok" data-zk="ok">' + esc(T('ok')) + '</button>' +
        '<button type="button" class="zk-knopf zk-zurueck" data-zk="zurueck"' + (Z.stapel.length ? '' : ' disabled') + '>' + esc(T('zurueck')) + '</button></div>';
      var meld = Z.meldung || (Z.markiert && Z.markiert.key === Z.key ? T('getippt', { w: zahlText(Z.markiert.wert) }) : '');
      html += '<div class="zk-meldung" aria-live="polite">' + esc(meld) + '</div></div>';
      o.karte.innerHTML = html;
      o.karte.hidden = false;
    }
    function oeffne(key) { Z.key = key; Z.zehner = null; Z.meldung = ''; zeichneKarte(); }
    function schliesse() { Z.key = null; Z.zehner = null; Z.meldung = ''; Z.markiert = null; if (o.karte) { o.karte.hidden = true; o.karte.innerHTML = ''; } zeigeListe(); }
    function blaettere(r) { var fl = flach(daten().orte), k = r > 0 ? naechster(fl, Z.key) : voriger(fl, Z.key); if (k) { Z.markiert = null; oeffne(k); } }

    function tippe(wert) {
      var f = finde(Z.key); if (!f) return;
      var info = {};
      if (Z.markiert && Z.markiert.key === Z.key) info.ersetzt = Z.markiert.id;
      var r = o.beiTipp ? o.beiTipp(f.eintrag, f.ort, wert, info) : null;
      Z.stapel.push({ key: Z.key, wert: wert, id: r && r.id ? r.id : null });
      Z.markiert = null;
      var fl = flach(daten().orte), weiter = naechster(fl, Z.key), wechsel = ortWechsel(fl, Z.key);
      if (weiter) {
        if (wechsel && o.hinweis) { var on = daten().orte.filter(function (x) { return x.id === wechsel; })[0]; if (on) o.hinweis(T('weiter_in', { ort: on.name })); }
        oeffne(weiter);
      } else {
        var st = daten().standort;
        schliesse();
        if (o.hinweis) o.hinweis(T('ende', { standort: st ? st.name : '' }));
        if (o.ende) o.ende(st);
      }
      zeigeListe();
    }
    function nimmFeld() {
      var el = o.karte && o.karte.querySelector('.zk-feld'); if (!el) return;
      var r = wertAusText(el.value, o.eingabe);
      if (r.fehler) { Z.meldung = T('f_' + r.fehler, { max: o.eingabe && o.eingabe.max }); zeichneKarte(); var neu = o.karte.querySelector('.zk-feld'); if (neu) { neu.value = el.value; neu.focus(); } return; }
      tippe(r.wert);
    }
    function zurueck() {
      var letzter = Z.stapel.pop();
      if (!letzter) { if (o.hinweis) o.hinweis(T('nichts_zurueck')); return; }
      Z.markiert = letzter;
      Z.key = letzter.key; Z.zehner = null; Z.meldung = '';
      zeichneKarte();
    }

    function klick(ev) {
      var el = ev.target.closest ? ev.target.closest('[data-zk]') : null;
      if (!el || el.disabled) return;
      var a = el.getAttribute('data-zk'), w = Number(el.getAttribute('data-wert'));
      if (a === 'oeffne') { Z.markiert = null; oeffne(el.getAttribute('data-key')); }
      else if (a === 'tipp') tippe(w);
      else if (a === 'zehner') { Z.zehner = w; Z.meldung = ''; zeichneKarte(); }
      else if (a === 'einer') { if (Z.zehner != null) tippe(Z.zehner + w); }
      else if (a === 'ok') nimmFeld();
      else if (a === 'zurueck') zurueck();
      else if (a === 'vor') blaettere(1);
      else if (a === 'rueck') blaettere(-1);
      else if (a === 'zu') schliesse();
    }
    if (o.liste) o.liste.addEventListener('click', klick);
    if (o.karte) {
      o.karte.addEventListener('click', function (ev) { if (ev.target === o.karte) schliesse(); else klick(ev); });
      o.karte.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('zk-feld')) { ev.preventDefault(); nimmFeld(); }
        else if (ev.key === 'Escape') schliesse();
      });
    }
    return {
      zeigeListe: zeigeListe, oeffne: function (key) { Z.markiert = null; oeffne(key); }, schliesse: schliesse,
      aktualisiere: function () { zeigeListe(); if (Z.key && !(o.karte && o.karte.contains(document.activeElement) && document.activeElement.classList.contains('zk-feld'))) zeichneKarte(); },
      offen: function () { return Z.key; }, stapel: function () { return Z.stapel.slice(); },
      neuerGang: function () { Z.stapel = []; Z.markiert = null; }
    };
  }

  var api = {
    einstufig: einstufig, zweistufig: zweistufig, einerErlaubt: einerErlaubt, wertAusText: wertAusText,
    schluessel: schluessel, flach: flach, naechster: naechster, voriger: voriger, ortWechsel: ortWechsel,
    erzeuge: erzeuge, DE: DE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_ZAEHLKARTE = api;
})(typeof window !== 'undefined' ? window : globalThis);
