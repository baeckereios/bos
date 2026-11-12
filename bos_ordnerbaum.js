/* ================================================================
   BäckereiOS · Ordnerbaum — gemeinsamer Baustein (wie ein Dateimanager)
   ================================================================
   Einbindung:  <link rel="stylesheet" href="../bos_ordnerbaum.css">
                <script src="../bos_ordnerbaum.js"></script>
   Stellt bereit: window.BOS_ORDNERBAUM  (in Node: module.exports)
   Doku:        BOS_ORDNERBAUM_DOKU.md

   WOFÜR: einen Baum aus fertigen Knoten zeichnen und bedienen. Zwei Arten:
     navigation  Name tippen = Ordner wählen (beiWahl), ▸/▾ = nur auf/zu,
                 ✎ = Karte des Ordners (beiKarte), ＋ = anlegen (beiHinzu)
     auswahl     nur Knoten mit waehlbar: true sind tippbar, markiert zeigt ✓,
                 kein ✎, kein ＋ (für „Verschieben nach …“, später die Anforderung)

   GRENZE (Bauplan Ordneransicht §10, Freigabe KC 11.11. 20:30): Der Baustein
   kennt KEINE Lager-Wörter, keine Firestore-Sammlung, keine Rolle. Er bekommt
   die Knoten von der Seite (knoten()) und gibt Ereignisse zurück. Die Wörter
   kommen über t() (Schlüssel 'ob_' + …) oder als fertiger Name im Knoten.

   EIN ZEICHEN, EIN VERHALTEN (A16): ✎ öffnet immer direkt eine Karte. Ein ⋯
   (Menü) gibt es im Baum nicht.

   Knoten: { id, name, zeichen, zahl, art, kinder: [...], mitKarte, hinzu: 'Text'|null,
             hinzuAls: 'knopf' | 'zeile', waehlbar (auswahl), markiert (auswahl), aus: 'Grund' (grau) }
   Keine Farben im JS, nur Klassen (bos_ordnerbaum.css mit Design-Tokens).

   CHANGELOG
     2026-11-11 · 20:45 · v1 · Erstfassung (Lager Ordneransicht, #120/#168; Bauplan 20:22,
       Freigabe Kontroll-Chat 20:30 mit A16–A19)
   ================================================================ */
(function (global) {
  'use strict';

  var DE = {
    ob_auf: 'Aufklappen', ob_zu: 'Zuklappen', ob_karte: 'Karte öffnen', ob_hinzu: 'Anlegen', ob_markiert: 'schon hier', ob_leer: 'Nichts da.'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  /* ---------- reiner Teil ---------- */
  function finde(knoten, id) {
    var weg = [];
    function such(liste, eltern) {
      for (var i = 0; i < (liste || []).length; i++) {
        var k = liste[i];
        if (k.id === id) { weg = eltern.concat([k]); return true; }
        if (such(k.kinder, eltern.concat([k]))) return true;
      }
      return false;
    }
    such(knoten, []);
    return weg.length ? { knoten: weg[weg.length - 1], vorfahren: weg.slice(0, -1).map(function (k) { return k.id; }) } : null;
  }
  function aufklappbar(k) { return !!((k.kinder && k.kinder.length) || (k.hinzu && k.hinzuAls === 'zeile')); }
  /* Sichtbare Zeilen in Reihenfolge (für Tastatur und Tests): [{ id, tiefe, knoten }] */
  function sichtbar(knoten, offen) {
    var aus = [];
    (function lauf(liste, tiefe) {
      (liste || []).forEach(function (k) {
        aus.push({ id: k.id, tiefe: tiefe, knoten: k });
        if (aufklappbar(k) && offen[k.id]) lauf(k.kinder, tiefe + 1);
      });
    })(knoten, 0);
    return aus;
  }

  /* ---------- Anzeige ---------- */
  function erzeuge(opt) {
    var o = opt || {};
    var wurzel = o.wurzel;
    var modus = o.modus === 'auswahl' ? 'auswahl' : 'navigation';
    var t = function (k, w) {
      var s = (o.t && o.t(k, w)) || DE[k] || k;
      return String(s).replace(/\{(\w+)\}/g, function (m, n) { return w && w[n] != null ? w[n] : m; });
    };
    var offen = {};
    (o.offen || []).forEach(function (id) { offen[id] = true; });

    function gesperrt() { return typeof o.hinzuGesperrt === 'function' ? o.hinzuGesperrt() : (o.hinzuGesperrt || ''); }
    function zeile(k, tiefe) {
      var hg = gesperrt();
      var gew = modus === 'navigation' && o.gewaehlt && o.gewaehlt() === k.id;
      var klapp = aufklappbar(k);
      var waehlbar = modus === 'auswahl' ? !!k.waehlbar : k.waehlbar !== false;
      var html = '<div class="ob-zeile ob-art-' + esc(k.art || 'x') + (gew ? ' ob-gewaehlt' : '') + (modus === 'auswahl' && k.markiert ? ' ob-markiert' : '') + '" data-ob-id="' + esc(k.id) + '" style="--ob-tiefe:' + tiefe + '" role="treeitem"' +
        (klapp ? ' aria-expanded="' + !!offen[k.id] + '"' : '') + (gew ? ' aria-selected="true"' : '') + '>';
      html += klapp
        ? '<button type="button" class="ob-klappe" data-ob="klappe" aria-label="' + esc(t(offen[k.id] ? 'ob_zu' : 'ob_auf')) + '">' + (offen[k.id] ? '▾' : '▸') + '</button>'
        : '<span class="ob-klappe ob-leer-klappe" aria-hidden="true"></span>';
      html += '<button type="button" class="ob-name" data-ob="wahl"' + (waehlbar ? '' : ' disabled') + (k.aus ? ' title="' + esc(k.aus) + '"' : '') + '>' +
        (k.zeichen ? '<span class="ob-zeichen">' + esc(k.zeichen) + '</span>' : '') + '<span class="ob-text">' + esc(k.name) + '</span>' +
        (modus === 'auswahl' && k.markiert ? '<span class="ob-haken" title="' + esc(t('ob_markiert')) + '">✓</span>' : '') + '</button>';
      html += k.zahl != null ? '<span class="ob-zahl">' + esc(k.zahl) + '</span>' : '';
      if (modus === 'navigation' && k.mitKarte) html += '<button type="button" class="ob-knopf" data-ob="karte" aria-label="' + esc(t('ob_karte')) + ': ' + esc(k.name) + '">✎</button>';
      if (modus === 'navigation' && k.hinzu && k.hinzuAls !== 'zeile') html += '<button type="button" class="ob-knopf" data-ob="hinzu" aria-label="' + esc(k.hinzu) + '"' + (hg ? ' disabled title="' + esc(hg) + '"' : '') + '>＋</button>';
      html += '</div>';
      if (klapp && offen[k.id]) {
        (k.kinder || []).forEach(function (c) { html += zeile(c, tiefe + 1); });
        if (modus === 'navigation' && k.hinzu && k.hinzuAls === 'zeile') {
          html += '<div class="ob-zeile ob-hinzu-zeile" data-ob-id="' + esc(k.id) + '" style="--ob-tiefe:' + (tiefe + 1) + '"><span class="ob-klappe ob-leer-klappe" aria-hidden="true"></span>' +
            '<button type="button" class="ob-name ob-hinzu" data-ob="hinzu"' + (hg ? ' disabled title="' + esc(hg) + '"' : '') + '>＋ ' + esc(k.hinzu) + '</button></div>';
        }
      }
      return html;
    }
    function zeichne() {
      if (!wurzel) return;
      var k = o.knoten ? o.knoten() : [];
      wurzel.setAttribute && wurzel.setAttribute('role', 'tree');
      wurzel.innerHTML = k.length ? k.map(function (x) { return zeile(x, 0); }).join('') : '<div class="ob-leer">' + esc(t('ob_leer')) + '</div>';
    }
    function umschalten(id, auf) {
      if (auf) offen[id] = true; else delete offen[id];
      if (o.beiUmschalten) o.beiUmschalten(id, !!auf, Object.keys(offen));
      zeichne();
    }
    function klappeAuf(ids) { (ids || []).forEach(function (id) { offen[id] = true; }); zeichne(); }
    function scrolleZu(id) {
      if (!wurzel || !wurzel.querySelector) return;
      var el = wurzel.querySelector('[data-ob-id="' + String(id).replace(/"/g, '\\"') + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    if (wurzel && wurzel.addEventListener) {
      wurzel.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-ob]') : null;
        if (!b || b.disabled) return;
        var z = b.closest('[data-ob-id]'); if (!z) return;
        var id = z.getAttribute('data-ob-id'), was = b.getAttribute('data-ob');
        var f = finde(o.knoten ? o.knoten() : [], id); if (!f) return;
        if (was === 'klappe') umschalten(id, !offen[id]);
        else if (was === 'wahl' && o.beiWahl) o.beiWahl(id, f.knoten);
        else if (was === 'karte' && o.beiKarte) o.beiKarte(id, f.knoten);
        else if (was === 'hinzu' && o.beiHinzu) o.beiHinzu(id, f.knoten);
      });
      /* Tastatur (PC): ↑ ↓ wandern, → auf, ← zu, Enter wählt (Knopf nativ) */
      wurzel.addEventListener('keydown', function (ev) {
        var b = ev.target; if (!b || !b.closest) return;
        var z = b.closest('[data-ob-id]'); if (!z) return;
        var id = z.getAttribute('data-ob-id');
        var liste = sichtbar(o.knoten ? o.knoten() : [], offen), i = -1;
        for (var n = 0; n < liste.length; n++) if (liste[n].id === id) i = n;
        var fokus = function (j) { if (j < 0 || j >= liste.length) return; var el = wurzel.querySelector('[data-ob-id="' + String(liste[j].id).replace(/"/g, '\\"') + '"] [data-ob="wahl"]'); if (el) el.focus(); };
        if (ev.key === 'ArrowDown') { ev.preventDefault(); fokus(i + 1); }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); fokus(i - 1); }
        else if (ev.key === 'ArrowRight' && i >= 0 && aufklappbar(liste[i].knoten) && !offen[id]) { ev.preventDefault(); umschalten(id, true); fokus(i); }
        else if (ev.key === 'ArrowLeft' && i >= 0 && offen[id]) { ev.preventDefault(); umschalten(id, false); fokus(i); }
      });
    }
    return { zeichne: zeichne, klappeAuf: klappeAuf, scrolleZu: scrolleZu, umschalten: umschalten,
      offen: function () { return Object.keys(offen); }, istOffen: function (id) { return !!offen[id]; } };
  }

  var api = { erzeuge: erzeuge, finde: finde, sichtbar: sichtbar, aufklappbar: aufklappbar, DE: DE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_ORDNERBAUM = api;
})(typeof window !== 'undefined' ? window : globalThis);
