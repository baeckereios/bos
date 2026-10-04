/* ================================================================
   BäckereiOS · bos_qr.js — Adresse und QR-Code für alle Satelliten
   ================================================================
   ABLAGEORT — bindend: Wurzelverzeichnis, neben launcher.html,
   index.html und bos_access.js. Die Wurzel von BOS wird aus dem
   EIGENEN Speicherort dieser Datei bestimmt (Muster BOS_ACCESS.wurzel()
   in bos_access.js), nicht aus der Adresse der aufrufenden Seite.
   Dadurch ist egal, in welchem Unterordner der Aufrufer liegt.

   Einbindung (Satellit, eine Ebene unter der Wurzel):
     <script src="../bos_qr.js"></script>
     <script src="../qrcode.min.js"></script>   (nur wer einen Code zeichnet)
   Stellt bereit: window.BOS_QR
   Test:          node test_nfc_qr.js   (im Projekt-Wurzelordner)

   GRUNDSATZ für jeden Code in BOS (QR und NFC-Chip): Ein Code ist nur
   eine Adresse = Wurzel + Pfad der Seite aus bos_app_registry.js +
   optionaler Zusatz (z. B. ?ort=B01). Keine Adresse wird von Hand
   eingetragen, es gibt kein Feld und keinen Speicherwert dafür.

   DIE SPERRE: darfAusgeben(href) ist nur wahr, wenn die Seite über
   https läuft UND nicht lokal ist. Alles andere ist falsch. Das ist
   bewusst eine Beschreibung des Erlaubten, keine Liste von Verboten:
   solange BOS nicht online ist, entsteht kein Code, der ins Leere
   führt. Es gibt KEINEN Schalter, Parameter oder Speicherwert, der die
   Sperre aufhebt. Wer hier einen einbauen will: nicht tun, sondern die
   Tests unter einer erfundenen https-Adresse laufen lassen (siehe
   NFC_QR_ZENTRALE_DOKU.md, Abschnitt Prüfen).

   AUFRUFER (Stand 03.10.2026): teigecke/teigecke_orte.html (Schild mit
   Zutatenliste), nfc_qr/nfc_qr_zentrale.html (Wegweiser, Chips).

   qrSvg() und qrFuer() sind aus teigecke/teigecke_logik.js bzw.
   teigecke/teigecke_orte.html hierher KOPIERT (nicht nachgebaut).
   qrFuer() liest das Muster über _oQRCode, ein inneres Feld von
   qrcode.min.js (davidshimjs/qrcodejs, MIT, siehe QRCODE_LICENSE). Die
   Bibliothek liegt fest im Repo; wer sie austauscht, muss ein Schild
   prüfen. Fehlt das Feld, kommt eine klare Fehlermeldung.

   CHANGELOG
     2026-10-03 · 14:47 · v1.0 · Refactor (Umzug aus der Teigecke)
       ANWEISUNG_2026-10-03_NFC_QR_ZENTRALE_STUFE1.md (KC, 11:51).
       istLokal, qrSvg, qrFuer aus der Teigecke hierher. Neu: wurzel()
       aus dem eigenen Speicherort, adresse(pfad, zusatz), darfAusgeben().
       istLokal erkennt zusätzlich 172.16. bis 172.31., 169.254.,
       Rechnernamen auf .local und Rechnernamen ohne Punkt. Entfallen
       (mit dem Adressfeld der Teigecke): basisAdresse, basisBereinigt,
       qrAdresse.
   ================================================================ */
(function (global) {
  'use strict';

  /* ---------- Wurzel: aus dem eigenen Speicherort ----------
     document.currentScript ist NUR gültig, solange dieses Skript läuft,
     später null. Deshalb hier, synchron beim Laden gemerkt (wie in
     bos_access.js, Kompendium F-19). */
  function wurzelAus(skriptAdresse) {
    var h = String(skriptAdresse || '').split('#')[0].split('?')[0];
    return h ? h.replace(/[^/]*$/, '') : '';
  }
  var WURZEL = (function () {
    try {
      var d = global.document;
      return wurzelAus(d && d.currentScript && d.currentScript.src);
    } catch (e) { return ''; }
  })();
  function wurzel() { return WURZEL; }

  /* Wurzel + Pfad aus der Registry + optionaler Zusatz (z. B. '?ort=B01').
     Ein Zusatz, den schon der Registry-Pfad trägt, bleibt nicht doppelt:
     der Pfad wird ohne eigenen Zusatz genommen, wenn einer übergeben wird. */
  function adresseAus(w, pfad, zusatz) {
    var p = String(pfad || '').replace(/^\/+/, '');
    var z = String(zusatz || '');
    if (z) p = p.split('#')[0].split('?')[0];
    if (z && z.charAt(0) !== '?' && z.charAt(0) !== '#') z = '?' + z;
    return String(w || '') + p + z;
  }
  function adresse(pfad, zusatz) {
    if (!WURZEL) throw new Error('bos_qr.js: Wurzel von BOS nicht bestimmbar (Datei liegt falsch oder wurde nicht als <script src> geladen)');
    return adresseAus(WURZEL, pfad, zusatz);
  }

  /* ---------- lokal? ----------
     Rechnername aus der Adresse; ohne lesbaren Rechnernamen gilt die
     Adresse als lokal (im Zweifel gesperrt). */
  function rechnername(href) {
    var m = /^[a-z][a-z0-9+.\-]*:\/\/([^\/?#]*)/i.exec(String(href || '').trim());
    if (!m) return '';
    var h = m[1];
    var at = h.lastIndexOf('@');
    if (at !== -1) h = h.slice(at + 1);
    if (h.charAt(0) === '[') { var zu = h.indexOf(']'); return zu === -1 ? '' : h.slice(0, zu + 1).toLowerCase(); }
    return h.replace(/:\d*$/, '').replace(/\.$/, '').toLowerCase();
  }
  function istLokal(href) {
    var s = String(href || '').trim();
    if (/^file:/i.test(s)) return true;
    var h = rechnername(s);
    if (!h) return true;
    if (h.charAt(0) === '[') {                       /* IPv6 */
      var v6 = h.slice(1, -1);
      return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
    }
    var ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (ip) {
      var a = Number(ip[1]), b = Number(ip[2]);
      return a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
    }
    if (h === 'localhost' || /\.localhost$/.test(h)) return true;
    if (/\.local$/.test(h)) return true;
    if (h.indexOf('.') === -1) return true;          /* Rechnername ohne Punkt (http://tablet/) */
    return false;
  }

  /* Darf von dieser Seite aus ein Code gedruckt / ein Chip beschrieben
     werden? Reine Funktion, bekommt nur die Adresse. */
  function darfAusgeben(href) {
    return /^https:\/\//i.test(String(href || '').trim()) && !istLokal(href);
  }

  /* SVG aus einer fertigen QR-Matrix (istDunkel(zeile, spalte), n × n).
     Ruhezone 4 Module. Reine Textfunktion, kein DOM. */
  function qrSvg(istDunkel, n) {
    var p = '', r, c;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (istDunkel(r, c)) p += 'M' + (c + 4) + ' ' + (r + 4) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 8) + ' ' + (n + 8) + '" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + p + '" fill="#000"/></svg>';
  }

  /* QR-Code für einen fertigen Text (eine Adresse) als SVG-Text.
     Braucht qrcode.min.js und einen Browser. Fehlerkorrektur M. */
  function qrFuer(text) {
    var QRCode = global.QRCode;
    if (typeof QRCode !== 'function') throw new Error('qrcode.min.js nicht geladen');
    if (!text) throw new Error('bos_qr.js: kein Text für den QR-Code');
    var halter = global.document.createElement('div');
    var q = new QRCode(halter, { text: String(text), correctLevel: QRCode.CorrectLevel.M });
    var m = q && q._oQRCode;
    if (!m || typeof m.isDark !== 'function' || typeof m.getModuleCount !== 'function') throw new Error('qrcode.min.js: QR-Muster nicht lesbar (Bibliothek geändert?)');
    return qrSvg(function (r, c) { return m.isDark(r, c); }, m.getModuleCount());
  }

  var api = {
    wurzel: wurzel, wurzelAus: wurzelAus, adresse: adresse, adresseAus: adresseAus,
    rechnername: rechnername, istLokal: istLokal, darfAusgeben: darfAusgeben,
    qrSvg: qrSvg, qrFuer: qrFuer
  };
  if (Object.freeze) Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_QR = api;
})(typeof window !== 'undefined' ? window : globalThis);
