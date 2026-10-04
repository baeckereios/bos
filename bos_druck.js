/* ============================================================
   bos_druck.js — BäckereiOS Standard-Druck (Core-Lib)
   ------------------------------------------------------------
   Einheitliche Druckvorlage (Kopf/Fuß) + Android-sichere
   Iframe-Print-Engine für alle Satelliten. Ersetzt die bisher
   doppelt gepflegte Druck-Logik aus schnelldruck.html (V1) und
   druckzentrale_ui.js (V1, doPrint()) durch eine einzige Quelle.

   Einbindung (Satellit, eine Ebene unter Root):
     <script src="../bos_druck.js"></script>

   Aufruf:
     BOS_DRUCK.drucken({
       inhaltHTML: '<p>...</p>',    // Pflicht — Druckinhalt als HTML-String
       appName:    'Schnelldruck',  // Pflicht — erscheint im Fuß "BäckereiOS · <appName>"
       titel:      'Überschrift',   // optional
       mitKopf:    true,            // optional, Default true
       farbig:     true,            // optional, Default true
       ausrichtung: 'portrait',     // optional, 'portrait'|'landscape', Default 'portrait'
       extraCSS:   '.foo{...}'      // optional — Satelliten-eigenes Druck-CSS (z. B. Checklisten-Layout)
     });

   Kopf/Fuß-An/Aus und Farbe/Schwarz-Weiß sind bewusst KEINE
   Einstellungen dieser Datei — jeder Satellit bringt dafür
   seinen eigenen Schalter im UI mit und reicht das Ergebnis nur
   als Parameter durch (Entscheidung Ulf, 01.09.2026). Schwarz-
   Weiß wird per CSS-Filter (grayscale) auf den ganzen Druck-
   bereich gelegt, nicht durch Suchen einzelner Farbwerte — wirkt
   dadurch automatisch auch bei künftigen Aufrufern mit eigenen
   Farbakzenten im Inhalt.

   Die Akzentfarbe im Kopf wird zur Laufzeit aus --bos-amber
   gelesen (bos_design_tokens.css), nicht hier hartcodiert.
   Alle übrigen Druckfarben sind bewusst feste Druck-Neutrale
   (#fff/#000/#666/#888/#ddd) und unabhängig vom aktuellen
   Hell/Dunkel-Theme des Satelliten — Papier ist immer weiß,
   unabhängig davon, wie das Gerät gerade eingestellt ist.

   Nie window.print() direkt aufrufen (Android-Lehre, siehe
   BOS_REBUILD_FUNDAMENT.md §6 / Checkliste §14) — diese Datei
   kapselt die Iframe-Engine, die das umgeht.

   2026-09-01 · v0.1 · Feature
     Erstversion. Konsolidiert aus schnelldruck.html (V1) und
     druckzentrale_ui.js (V1, doPrint()).
   2026-09-12 · v0.2 · Feature
     Ulf: Dienstplan-Tabelle in Entwürfe wird beim Drucken nicht breiter
     als eine schmale Spalte, Rest der Seite bleibt leer — @page { size:
     A4 portrait } war fest einprogrammiert und überschrieb sogar eine
     manuelle Querformat-Wahl im Browser-Druckdialog. Neuer optionaler
     Parameter `ausrichtung` ('portrait'|'landscape'), Default weiterhin
     'portrait' — bestehende Aufrufer (Wunschtag, Urlaub-Anfrage,
     Abwesenheiten, Sonntagsplan) bleiben unverändert. entwuerfe.html
     nutzt jetzt 'landscape'. Hinweis: bei vielen Personen kann der
     Ausdruck trotzdem mehrseitig werden — das ist schlicht die
     Zeilenzahl, kein Bug.
   ============================================================ */

window.BOS_DRUCK = (function () {

  function leseToken(name, fallback) {
    try {
      var wert = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return wert || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function formatDatum(d) {
    var tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    var monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
                  'August', 'September', 'Oktober', 'November', 'Dezember'];
    return tage[d.getDay()] + ', ' + d.getDate() + '. ' + monate[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatZeit(d) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  function baueCSS(farbAmber, ausrichtung) {
    return [
      '@page { size: A4 ' + ausrichtung + '; margin: 0; }',
      '* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
      'html, body { margin: 0; padding: 0; background: #fff; color: #000; }',
      '#bos-print-root { width: 100%; padding: 12mm 15mm; font-family: "Barlow", sans-serif; }',
      '#bos-print-root.bos-druck-sw { filter: grayscale(1); }',
      '.bos-pa-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 5mm; margin-bottom: 7mm; }',
      '.bos-pa-logo { font-family: "Fraunces", serif; font-weight: 900; font-size: 20pt; letter-spacing: -.02em; line-height: 1; }',
      '.bos-pa-logo em { color: ' + farbAmber + '; font-style: italic; }',
      '.bos-pa-logo-sub { font-family: "Barlow Condensed", sans-serif; font-size: 7pt; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-top: 2mm; }',
      '.bos-pa-meta { text-align: right; font-size: 8pt; color: #666; line-height: 1.7; }',
      '.bos-pa-titel { font-family: "Fraunces", serif; font-weight: 900; font-size: 18pt; margin-bottom: 5mm; padding-bottom: 3mm; border-bottom: 1px solid #ddd; }',
      '.bos-pa-body { font-size: 11pt; line-height: 1.75; word-break: break-word; }',
      '.bos-pa-footer { margin-top: 12mm; border-top: 1px solid #ddd; padding-top: 3mm; display: flex; justify-content: space-between; font-family: "Barlow Condensed", sans-serif; font-size: 7.5pt; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #bbb; }'
    ].join('\n');
  }

  function baueKopf() {
    var jetzt = new Date();
    return '<div class="bos-pa-header">' +
             '<div>' +
               '<div class="bos-pa-logo">Bäckerei<em>OS</em></div>' +
               '<div class="bos-pa-logo-sub">Produktionssteuerung</div>' +
             '</div>' +
             '<div class="bos-pa-meta">' + formatDatum(jetzt) + '<br>' + formatZeit(jetzt) + ' Uhr</div>' +
           '</div>';
  }

  function baueFuss(appName) {
    var jetzt = new Date();
    return '<div class="bos-pa-footer">' +
             '<span>BäckereiOS · ' + appName + '</span>' +
             '<span>' + formatDatum(jetzt) + ' · ' + formatZeit(jetzt) + '</span>' +
           '</div>';
  }

  function drucken(optionen) {
    optionen = optionen || {};
    var inhaltHTML = optionen.inhaltHTML || '';
    var titel      = optionen.titel || '';
    var appName    = optionen.appName || 'BäckereiOS';
    var mitKopf    = optionen.mitKopf !== false;   // Default: an
    var farbig     = optionen.farbig !== false;    // Default: an
    var extraCSS   = optionen.extraCSS || '';
    var ausrichtung = optionen.ausrichtung === 'landscape' ? 'landscape' : 'portrait'; // Default portrait, bestehende Aufrufer unverändert

    var farbAmber = leseToken('--bos-amber', '#c07a10');
    var css = baueCSS(farbAmber, ausrichtung) + (extraCSS ? '\n' + extraCSS : '');

    var teile = [];
    if (mitKopf) teile.push(baueKopf());
    if (titel) teile.push('<div class="bos-pa-titel">' + titel + '</div>');
    teile.push('<div class="bos-pa-body">' + inhaltHTML + '</div>');
    if (mitKopf) teile.push(baueFuss(appName));

    var rootAttr = !farbig ? ' class="bos-druck-sw"' : '';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
               '<title>BäckereiOS Druck</title>' +
               '<style>' + css + '</style>' +
               '</head><body>' +
               '<div id="bos-print-root"' + rootAttr + '>' + teile.join('') + '</div>' +
               '</body></html>';

    // Altes Iframe entfernen, neues erstellen
    var alt = document.getElementById('bos-druck-frame');
    if (alt) alt.parentNode.removeChild(alt);

    var iframe = document.createElement('iframe');
    iframe.id = 'bos-druck-frame';
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;left:-9999px;';
    document.body.appendChild(iframe);

    var doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // 400ms Pause (Lehre aus dem Alt-System) — Iframe muss vor
    // print() vollständig gerendert sein, sonst Android-Bug.
    setTimeout(function () {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 400);
  }

  return { drucken: drucken };

})();
