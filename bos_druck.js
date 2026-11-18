/* ============================================================
   bos_druck.js — BäckereiOS Standard-Druck (Core-Lib)
   ------------------------------------------------------------
   Einheitliche Druckvorlage (Kopf/Fuß) + Android-sichere
   Iframe-Print-Engine für alle Satelliten. Ersetzt die bisher
   doppelt gepflegte Druck-Logik aus schnelldruck.html (V1) und
   druckzentrale_ui.js (V1, doPrint()) durch eine einzige Quelle.

   Einbindung (Satellit, eine Ebene unter Root):
     <script src="../bos_druck.js"></script>

   ── API (seit v0.4) ─────────────────────────────────────────
   BOS_DRUCK.drucken(optionen)            → Promise (bisherige Aufrufer ignorieren es)
     BOS_DRUCK.drucken({
       inhaltHTML: '<p>...</p>',    // Pflicht — Druckinhalt als HTML-String
       appName:    'Schnelldruck',  // Pflicht — erscheint im Fuß "BäckereiOS · <appName>"
       titel:      'Überschrift',   // optional
       mitKopf:    true,            // optional, Default true
       farbig:     true,            // optional, Default true
       ausrichtung: 'portrait',     // optional, 'portrait'|'landscape', Default 'portrait'
       extraCSS:   '.foo{...}',     // optional — Satelliten-eigenes Druck-CSS (z. B. Checklisten-Layout)
       dateiname:  'Frühschicht'    // optional (v0.4) — Name der PDF-Datei ohne Datum, siehe unten
     });
     Fehler beim Bauen (Iframe anlegen/beschreiben) wirft drucken()
     wie bisher SOFORT (synchron) — Aufrufer wie Lager anfordern
     hängen ihren „Nachdrucken“-Knopf an genau dieses catch.
     Fehler beim print() selbst kommen als abgewiesenes Promise.
     In beiden Fällen zusätzlich: Fehlerkasten + console.error.

   BOS_DRUCK.baueSeite(optionen)          → Seite (Objekt, ohne Dokumentrahmen)
     Gleiche Optionen wie drucken(). Liefert u. a. .html (der Zettel
     mit Kopf, Titel, Inhalt, Fuß, Schwarz-Weiß-Klasse), .css und
     .dateiname. Druckt nichts.

   BOS_DRUCK.druckeSeiten([seite, …], { dateiname }) → Promise
     Baut EIN Druckdokument aus einer oder mehreren Seiten und druckt
     es über dieselbe Iframe-Mechanik (400 ms, nie window.print()).
     Eine Seite ohne id = genau das Dokument von drucken().
     Seiten mit id (angemeldete Zettel) stecken je in
     <section class="bos-zettel bos-zettel-<id>">, Seitenumbruch
     zwischen den Zetteln. Hoch- und Querformat gemischt in einem
     Auftrag wird abgewiesen (kommt mit dem Sammeldruck, #190).
     Fehler kommen nur als abgewiesenes Promise (+ Kasten).

   BOS_DRUCK.dateinameFuer(optionen[, datum]) → 'JJJJ-MM-TT <Name>'

   ── Zettel-Form (Grundstein Sammeldruck #190) ───────────────
     BOS_DRUCK.zettel.anmelden({
       id:    'mitbringer',              // eindeutig, ^[a-z0-9_]{2,40}$
       name:  'Mitbringliste',           // Anzeige im Sammeldruck und Dateiname
       datenStand: function () {         // → Promise<{ vorhanden, grund?, stand? }>
         return Promise.resolve({ vorhanden: false, grund: 'Keine Daten vorhanden' });
       },
       baue: function () {               // → Promise<Optionen wie für drucken()>, druckt NIE selbst
         return Promise.resolve({ inhaltHTML: '…', appName: 'Mitbringer',
           extraCSS: '.bos-zettel-mitbringer .zeile{…}' });   // extraCSS NUR unter .bos-zettel-<id>
       }
     });
     BOS_DRUCK.zettel.liste()            → angemeldete Zettel (Kopie)
     BOS_DRUCK.zettel.drucke(['id', …], { dateiname })
       → Promise<{ gedruckt:[id…], fehlend:[{id,name,grund}], dateiname }>
       Baut alle gewählten, druckt EINEN Auftrag. Scheitert einer
       (unbekannt, baue wirft/liefert nichts, CSS nicht unter seiner
       Klasse), druckt der Rest trotzdem; fehlend nennt ihn mit Grund,
       dazu der Fehlerkasten. Ließ sich keiner bauen: abgewiesen.
       datenStand ruft drucke() nicht auf — das Ausgrauen „Keine
       Daten vorhanden“ macht die Sammeldruck-Seite.

   ── Dateiname (#175) ────────────────────────────────────────
   Android/Chrome benennt die PDF nach dem Titel des OBERSTEN
   Dokuments (im Launcher sonst „BäckereiOS · Satellite — Launcher“).
   Name = lokales Datum (nie toISOString) + Leerzeichen + Name:
     1. optionen.dateiname, wenn angegeben
     2. sonst appName, bei titel ≠ appName: „appName – titel“
     3. sonst „BäckereiOS Druck“
   titel/dateiname werden erst von HTML befreit (Tags weg, &amp; usw.
   zurück), dann / \ : * ? " < > | → „-“, Steuerzeichen weg,
   Leerraum zusammengezogen, höchstens 80 Zeichen.
   Beispiel: „2026-11-14 Frühschicht-Formular“ (.pdf hängt Android an).

   ── Titel setzen und zurückstellen ──────────────────────────
   Vor print() trägt das Druck-Iframe den Namen als <title>, und das
   oberste Fenster (window.top, gleiche Herkunft, try/catch) bekommt
   ihn als document.title. Fremde Herkunft/Fehler: nur das Iframe,
   console.warn, der Druck läuft. Zurück auf den alten Titel:
     1. bei afterprint des Iframe-Fensters,
     2. sonst, wenn das oberste Fenster weg war (blur/hidden) und
        wieder sichtbar UND fokussiert ist,
     3. sonst nach RUECK_FRIST_MS (60 s).
   Nie früher als RUECK_MIN_MS (1 s) nach dem print()-Aufruf.
   Nur zurück, wenn oben noch UNSER Titel steht — hat der Launcher
   oder eine Seite ihn inzwischen geändert, bleibt der neue. Zweiter
   Druck vor dem Zurückstellen übernimmt das Original des ersten.

   Kopf/Fuß-An/Aus und Farbe/Schwarz-Weiß sind bewusst KEINE
   Einstellungen dieser Datei — jeder Satellit bringt dafür
   seinen eigenen Schalter im UI mit und reicht das Ergebnis nur
   als Parameter durch (Entscheidung Ulf, 01.09.2026). Schwarz-
   Weiß wird per CSS-Filter (grayscale) auf den ganzen Druck-
   bereich gelegt, nicht durch Suchen einzelner Farbwerte — wirkt
   dadurch automatisch auch bei künftigen Aufrufern mit eigenen
   Farbakzenten im Inhalt.

   Die Akzentfarbe im Kopf wird zur Laufzeit aus --bos-marke
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
   2026-10-15 · 19:56 · v0.3 · Fix (Farbprofile Stufe B, #72, E12)
     Druckkopf liest das feste Token --bos-marke statt --bos-amber. Sonst
     käme das Logo im Profil des Druckenden (z. B. Stahlblau). Ersatzwert
     #c07a10. SESSION_2026-10-15_FARBSCHEMA_STUFE_B_BAU.md
   2026-11-18 · 00:35 · v0.4 · Feature (PDF-Name #175, Zettel-Form #190 Schritt 1)
     Dateiname „JJJJ-MM-TT Name“ als Titel von Druck-Iframe und oberstem
     Fenster, sicher zurückgestellt. drucken() innen getrennt in
     baueSeite() + druckeSeiten(); Zettel-Form zettel.anmelden/liste/
     drucke. Rückgabe Promise. Fehler beim Drucken zusätzlich als
     schließbarer Kasten mit echter Meldung. Neue Option `dateiname`.
     Einzeldruck: Druckdokument zeichengleich mit v0.3 bis auf <title>
     (maschinell geprüft). Kein Aufrufer geändert.
     SESSION_2026-11-17_DRUCKMODUL_BAU.md
   ============================================================ */

window.BOS_DRUCK = (function () {

  var VERSION = '0.4';
  var RUECK_FRIST_MS = 60000;  // letzter Rückfall, wenn weder afterprint noch Rückkehr kommt
  var RUECK_MIN_MS = 1000;     // nie früher zurück (Titel soll beim Druckauftrag sicher drüben sein)
  var NAME_MAX = 80;
  var NAME_ERSATZ = 'BäckereiOS Druck';
  var ID_MUSTER = /^[a-z0-9_]{2,40}$/;

  /* ---------- unverändert aus v0.3 ---------- */

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

  /* ---------- Fehler sichtbar (v0.4) ---------- */

  function fehler(text, code) {
    var e = new Error(text);
    if (code) e.code = code;
    return e;
  }

  function fehlerText(err) {
    if (!err) return 'unbekannter Fehler';
    var m = err.message || String(err);
    return err.code && m.indexOf(err.code) === -1 ? m + ' (' + err.code + ')' : m;
  }

  function zeigeFehlerKasten(text) {
    try {
      var d = document;
      if (!d || !d.body) return;
      var kasten = d.getElementById('bos-druck-fehler');
      if (!kasten) {
        kasten = d.createElement('div');
        kasten.id = 'bos-druck-fehler';
        kasten.setAttribute('role', 'alert');
        kasten.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;margin:0 auto;max-width:560px;' +
          'z-index:2147483647;padding:12px 46px 12px 14px;border-radius:10px;background:#7a1f17;color:#fff;' +
          'border:2px solid var(--bos-red,#d6584a);box-shadow:0 4px 18px rgba(0,0,0,.35);' +
          'font:15px/1.4 "Barlow",system-ui,sans-serif;white-space:pre-wrap;word-break:break-word;';
        var zu = d.createElement('button');
        zu.type = 'button';
        zu.textContent = '×';
        zu.setAttribute('aria-label', 'Meldung schließen');
        zu.style.cssText = 'position:absolute;top:4px;right:6px;width:36px;height:36px;border:0;border-radius:8px;' +
          'background:transparent;color:#fff;font-size:26px;line-height:1;cursor:pointer;';
        zu.addEventListener('click', function () { if (kasten.parentNode) kasten.parentNode.removeChild(kasten); });
        var inhalt = d.createElement('div');
        inhalt.className = 'bos-druck-fehler-text';
        kasten.appendChild(inhalt);
        kasten.appendChild(zu);
        d.body.appendChild(kasten);
      }
      var ziel = kasten.querySelector('.bos-druck-fehler-text');
      var zeile = d.createElement('div');
      zeile.textContent = text;
      ziel.appendChild(zeile);
      while (ziel.childNodes.length > 5) ziel.removeChild(ziel.firstChild);
    } catch (e) {
      console.error('BOS_DRUCK: Fehlerkasten ließ sich nicht anzeigen', e);
    }
  }

  function meldeFehler(vorsatz, err) {
    console.error('BOS_DRUCK: ' + vorsatz, err);
    zeigeFehlerKasten(vorsatz + ': ' + fehlerText(err));
  }

  /* ---------- Dateiname (v0.4, #175) ---------- */

  var ENTITAETEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', middot: '·', hellip: '…', bull: '•', euro: '€', szlig: 'ß',
    auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü' };

  function textAusHtml(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '');
    return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, function (ganz, k) {
      if (k.charAt(0) === '#') {
        var n = k.charAt(1) === 'x' || k.charAt(1) === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        try { return n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : ''; } catch (e) { return ''; }
      }
      return Object.prototype.hasOwnProperty.call(ENTITAETEN, k) ? ENTITAETEN[k] : ganz;
    });
  }

  function saeubereName(roh) {
    var s = textAusHtml(roh);
    s = s.replace(/[\t\n\r\f\v\u00a0\u2028\u2029]/g, ' ')
         .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
         .replace(/[\/\\:*?"<>|]/g, '-')
         .replace(/\s+/g, ' ')
         .trim();
    var zeichen = Array.from(s);
    if (zeichen.length > NAME_MAX) s = zeichen.slice(0, NAME_MAX).join('').trim();
    return s;
  }

  function datumTeil(d) {
    var m = d.getMonth() + 1, t = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (t < 10 ? '0' : '') + t;
  }

  function nameAusOptionen(o) {
    o = o || {};
    var name = o.dateiname != null ? saeubereName(o.dateiname) : '';
    if (!name) {
      var app = saeubereName(o.appName || '');
      var tit = saeubereName(o.titel || '');
      if (app) name = (tit && tit !== app) ? saeubereName(app + ' – ' + tit) : app;
    }
    return name || NAME_ERSATZ;
  }

  function dateinameFuer(optionen, datum) {
    var d = datum && typeof datum.getFullYear === 'function' && !isNaN(datum.getTime()) ? datum : new Date();
    return datumTeil(d) + ' ' + nameAusOptionen(optionen);
  }

  function htmlText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- Titel setzen / zurückstellen (v0.4) ---------- */

  var titelZustand = null;   // { top, original, unser, abbauen }

  function setzeTitel(name) {
    var top;
    try {
      top = window.top;
      void top.document.title;            // wirft bei fremder Herkunft
    } catch (e) {
      console.warn('BOS_DRUCK: oberstes Fenster nicht erreichbar (' + (e && e.message || e) + ') — nur das Druck-Dokument trägt den Dateinamen.');
      return null;
    }
    try {
      var aktuell = top.document.title;
      var original = aktuell;
      if (titelZustand) {
        // Voriger Druck noch nicht zurückgestellt: steht oben noch dessen
        // vorübergehender Titel, bleibt dessen Original das Original.
        if (titelZustand.top === top && aktuell === titelZustand.unser) original = titelZustand.original;
        titelZustand.abbauen();
        titelZustand = null;
      }
      top.document.title = name;
      var z = { top: top, original: original, unser: top.document.title, abbauen: function () {} };
      titelZustand = z;
      return z;
    } catch (e) {
      console.warn('BOS_DRUCK: Titel des obersten Fensters ließ sich nicht setzen (' + (e && e.message || e) + ') — Druck läuft mit dem alten Namen.');
      return null;
    }
  }

  function stelleZurueck(z, anlass) {
    z.abbauen();
    if (titelZustand === z) titelZustand = null;
    try {
      if (z.top.document.title === z.unser) z.top.document.title = z.original;
    } catch (e) {
      console.warn('BOS_DRUCK: Titel ließ sich nicht zurückstellen (' + anlass + ': ' + (e && e.message || e) + ')');
    }
  }

  function planeRueckstellung(z, druckFenster, druckZeit) {
    var fertig = false, wartet = null, warWeg = false, frist = null;
    var top = z.top, topDoc = top.document;

    function zurueck(anlass) {
      if (fertig || wartet) return;
      var rest = RUECK_MIN_MS - (Date.now() - druckZeit);
      if (rest > 0) { wartet = setTimeout(function () { wartet = null; zurueck(anlass); }, rest); return; }
      fertig = true;
      stelleZurueck(z, anlass);
    }
    function nachDruck() { zurueck('afterprint'); }
    function weg() { warWeg = true; }
    function sichtbar() {
      if (topDoc.visibilityState === 'hidden') { warWeg = true; return; }
      try { if (warWeg && topDoc.hasFocus()) zurueck('zurück im Fenster'); } catch (e) { /* kein hasFocus */ }
    }

    z.abbauen = function () {
      fertig = true;
      if (wartet) { clearTimeout(wartet); wartet = null; }
      if (frist) { clearTimeout(frist); frist = null; }
      try { druckFenster.removeEventListener('afterprint', nachDruck); } catch (e) { /* Iframe schon weg */ }
      try {
        top.removeEventListener('blur', weg);
        top.removeEventListener('focus', sichtbar);
        topDoc.removeEventListener('visibilitychange', sichtbar);
      } catch (e) { /* ignorieren */ }
    };
    try { druckFenster.addEventListener('afterprint', nachDruck); } catch (e) { /* dann Rückkehr/Frist */ }
    try {
      top.addEventListener('blur', weg);
      top.addEventListener('focus', sichtbar);
      topDoc.addEventListener('visibilitychange', sichtbar);
    } catch (e) { /* dann Frist */ }
    frist = setTimeout(function () { frist = null; zurueck('Frist'); }, RUECK_FRIST_MS);
  }

  /* ---------- Bauen (v0.4: aus drucken() herausgelöst) ---------- */

  function baueSeite(optionen) {
    optionen = optionen || {};
    var inhaltHTML = optionen.inhaltHTML || '';
    var titel      = optionen.titel || '';
    var appName    = optionen.appName || 'BäckereiOS';
    var mitKopf    = optionen.mitKopf !== false;   // Default: an
    var farbig     = optionen.farbig !== false;    // Default: an
    var extraCSS   = optionen.extraCSS || '';
    var ausrichtung = optionen.ausrichtung === 'landscape' ? 'landscape' : 'portrait'; // Default portrait, bestehende Aufrufer unverändert

    var farbAmber = leseToken('--bos-marke', '#c07a10');   // 15.10.2026 (E12): Ausgedrucktes bleibt Honig, egal welches Farbprofil
    var grundCSS = baueCSS(farbAmber, ausrichtung);

    var teile = [];
    if (mitKopf) teile.push(baueKopf());
    if (titel) teile.push('<div class="bos-pa-titel">' + titel + '</div>');
    teile.push('<div class="bos-pa-body">' + inhaltHTML + '</div>');
    if (mitKopf) teile.push(baueFuss(appName));

    var rootAttr = !farbig ? ' class="bos-druck-sw"' : '';
    var innen = teile.join('');

    return {
      art: 'bos-druck-seite',
      id: optionen.id ? String(optionen.id) : null,
      html: '<div id="bos-print-root"' + rootAttr + '>' + innen + '</div>',
      css: grundCSS + (extraCSS ? '\n' + extraCSS : ''),
      innenHTML: innen,
      grundCSS: grundCSS,
      extraCSS: extraCSS,
      farbig: farbig,
      ausrichtung: ausrichtung,
      dateiname: dateinameFuer(optionen)
    };
  }

  function dokumentEinzeln(seite, dateiname) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
           '<title>' + htmlText(dateiname) + '</title>' +
           '<style>' + seite.css + '</style>' +
           '</head><body>' +
           seite.html +
           '</body></html>';
  }

  function dokumentMehrfach(seiten, dateiname) {
    // Grund-CSS der ersten Seite, Wurzel als Klasse statt id (mehrere Zettel).
    var grund = seiten[0].grundCSS.replace(/#bos-print-root/g, '.bos-print-root');
    var css = grund + '\n' +
      '.bos-zettel + .bos-zettel { break-before: page; page-break-before: always; }' +
      seiten.map(function (s) { return s.extraCSS ? '\n' + s.extraCSS : ''; }).join('');
    var koerper = seiten.map(function (s) {
      return '<section class="bos-zettel bos-zettel-' + s.id + '">' +
               '<div class="bos-print-root' + (s.farbig ? '' : ' bos-druck-sw') + '">' + s.innenHTML + '</div>' +
             '</section>';
    }).join('');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
           '<title>' + htmlText(dateiname) + '</title>' +
           '<style>' + css + '</style>' +
           '</head><body>' + koerper + '</body></html>';
  }

  /* Prüft, ob jede Regel des Zettel-CSS unter .bos-zettel-<id> steht.
     Liefert '' oder den Grund. @media/@supports werden durchlaufen,
     @page ist verboten (setzt das Format des ganzen Auftrags). */
  function cssBereichFehler(css, id) {
    var klasse = new RegExp('^\\.bos-zettel-' + id + '(?![\\w-])');
    var s = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
    var stapel = [], vorspann = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), oben = stapel[stapel.length - 1];
      if (c === '{') {
        var v = vorspann.trim(); vorspann = '';
        if (oben === 'regel' || oben === 'roh') { stapel.push(oben); continue; }
        if (/^@(media|supports|container|layer)\b/i.test(v)) { stapel.push('gruppe'); continue; }
        if (/^@page\b/i.test(v)) return '@page gehört nicht ins Zettel-CSS (setzt das Format des ganzen Auftrags)';
        if (v.charAt(0) === '@') { stapel.push('roh'); continue; }
        var teile = v.split(',');
        for (var k = 0; k < teile.length; k++) {
          if (!klasse.test(teile[k].trim())) return 'extraCSS-Regel „' + teile[k].trim() + '“ steht nicht unter .bos-zettel-' + id;
        }
        stapel.push('regel');
      } else if (c === '}') {
        stapel.pop(); vorspann = '';
      } else if (c === ';' && oben !== 'regel' && oben !== 'roh') {
        vorspann = '';
      } else if (oben !== 'regel' && oben !== 'roh') {
        vorspann += c;
      }
    }
    return '';
  }

  /* ---------- Drucken (bestehende Iframe-Mechanik) ---------- */

  // Synchron bis zum Beschreiben des Iframes (wirft dort sofort), danach Promise.
  function starteDruck(seiten, opt) {
    opt = opt || {};
    if (!Array.isArray(seiten) || !seiten.length) throw fehler('Keine Seite zum Drucken übergeben', 'bos-druck/keine-seite');
    for (var i = 0; i < seiten.length; i++) {
      if (!seiten[i] || seiten[i].art !== 'bos-druck-seite') throw fehler('Seite ' + (i + 1) + ' kommt nicht aus BOS_DRUCK.baueSeite()', 'bos-druck/seite');
    }
    var mehrfach = seiten.length > 1 || seiten.some(function (s) { return !!s.id; });
    if (mehrfach) {
      for (var j = 0; j < seiten.length; j++) {
        if (!seiten[j].id || !ID_MUSTER.test(seiten[j].id)) throw fehler('Mehrere Seiten in einem Auftrag nur als Zettel mit id (Seite ' + (j + 1) + ' hat keine gültige)', 'bos-druck/seite-id');
        var bf = cssBereichFehler(seiten[j].extraCSS, seiten[j].id);
        if (bf) throw fehler(bf, 'bos-druck/zettel-css');
        if (seiten[j].ausrichtung !== seiten[0].ausrichtung) throw fehler('Hoch- und Querformat gemischt in einem Auftrag ist noch nicht gebaut (kommt mit dem Sammeldruck)', 'bos-druck/format-gemischt');
      }
    }
    var dateiname = opt.dateiname != null && String(opt.dateiname).trim() !== ''
      ? dateinameFuer({ dateiname: opt.dateiname })
      : (seiten.length === 1 ? seiten[0].dateiname : dateinameFuer({}));

    var html = mehrfach ? dokumentMehrfach(seiten, dateiname) : dokumentEinzeln(seiten[0], dateiname);

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

    var z = setzeTitel(dateiname);

    return new Promise(function (resolve, reject) {
      // 400ms Pause (Lehre aus dem Alt-System) — Iframe muss vor
      // print() vollständig gerendert sein, sonst Android-Bug.
      setTimeout(function () {
        var fenster = iframe.contentWindow;
        if (!fenster || !iframe.parentNode) {
          // Ein neuerer Druck hat dieses Iframe ersetzt (zweimal schnell getippt) — kein Fehler.
          console.warn('BOS_DRUCK: Druck „' + dateiname + '“ wurde durch einen neueren ersetzt.');
          if (z && titelZustand === z) stelleZurueck(z, 'ersetzt');
          reject(fehler('Durch einen neueren Druck ersetzt', 'bos-druck/ersetzt'));
          return;
        }
        try {
          fenster.focus();
          // Wächter erst NACH dem eigenen focus(): der löst oben ein blur aus,
          // das sonst als „war weg“ zählte (gefunden im Browser-Test).
          if (z) planeRueckstellung(z, fenster, Date.now());
          fenster.print();
          resolve({ dateiname: dateiname, seiten: seiten.length });
        } catch (e) {
          if (z) stelleZurueck(z, 'Fehler');
          meldeFehler('Drucken fehlgeschlagen', e);
          reject(e);
        }
      }, 400);
    });
  }

  function leise(p) { p.catch(function () { /* gemeldet: Kasten + console.error */ }); return p; }

  function druckeSeiten(seiten, opt) {
    try {
      return leise(starteDruck(seiten, opt));
    } catch (e) {
      meldeFehler('Drucken fehlgeschlagen', e);
      return leise(Promise.reject(e));
    }
  }

  function drucken(optionen) {
    try {
      var seite = baueSeite(optionen);
      return leise(starteDruck([seite], { dateiname: optionen && optionen.dateiname }));
    } catch (e) {
      meldeFehler('Drucken fehlgeschlagen', e);
      throw e;   // wie v0.3: synchron, damit die try/catch der Aufrufer greifen
    }
  }

  /* ---------- Zettel-Form (v0.4, Grundstein #190) ---------- */

  var zettelReihe = [];

  function findeZettel(id) {
    for (var i = 0; i < zettelReihe.length; i++) if (zettelReihe[i].id === id) return zettelReihe[i];
    return null;
  }

  function kopie(z) { return { id: z.id, name: z.name, datenStand: z.datenStand, baue: z.baue }; }

  function anmelden(def) {
    try {
      if (!def || typeof def !== 'object') throw fehler('keine Angaben übergeben', 'bos-druck/zettel-angaben');
      if (def.id == null || def.id === '') throw fehler('id fehlt (Pflicht: eindeutiger Kurzname aus a–z, 0–9 und _)', 'bos-druck/zettel-id');
      if (typeof def.id !== 'string' || !ID_MUSTER.test(def.id)) throw fehler('id „' + def.id + '“ ist ungültig — erlaubt sind a–z, 0–9 und _, 2 bis 40 Zeichen', 'bos-druck/zettel-id');
      if (findeZettel(def.id)) throw fehler('id „' + def.id + '“ ist schon angemeldet', 'bos-druck/zettel-doppelt');
      if (typeof def.name !== 'string' || !def.name.trim()) throw fehler('Zettel „' + def.id + '“: name fehlt', 'bos-druck/zettel-name');
      if (typeof def.datenStand !== 'function') throw fehler('Zettel „' + def.id + '“: datenStand ist keine Funktion', 'bos-druck/zettel-datenstand');
      if (typeof def.baue !== 'function') throw fehler('Zettel „' + def.id + '“: baue ist keine Funktion', 'bos-druck/zettel-baue');
      var z = { id: def.id, name: def.name.trim(), datenStand: def.datenStand, baue: def.baue };
      zettelReihe.push(z);
      return kopie(z);
    } catch (e) {
      meldeFehler('Zettel-Anmeldung fehlgeschlagen', e);
      throw e;
    }
  }

  function liste() { return zettelReihe.map(kopie); }

  function zettelDrucke(ids, opt) {
    opt = opt || {};
    if (!Array.isArray(ids) || !ids.length) {
      var leer = fehler('Kein Zettel gewählt', 'bos-druck/keine-wahl');
      meldeFehler('Sammeldruck fehlgeschlagen', leer);
      return leise(Promise.reject(leer));
    }
    var aufgaben = ids.map(function (id) {
      var z = findeZettel(id);
      if (!z) return Promise.resolve({ id: id, name: String(id), grund: 'nicht angemeldet' });
      return Promise.resolve()
        .then(function () { return z.baue(); })
        .then(function (o) {
          if (!o || typeof o !== 'object') throw fehler('baue() lieferte keine Druck-Optionen', 'bos-druck/baue-leer');
          var bf = cssBereichFehler(o.extraCSS, z.id);
          if (bf) throw fehler(bf, 'bos-druck/zettel-css');
          var o2 = {};
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) o2[k] = o[k];
          o2.id = z.id;
          if (o2.dateiname == null || String(o2.dateiname).trim() === '') o2.dateiname = z.name;
          return { id: z.id, name: z.name, seite: baueSeite(o2) };
        })
        .catch(function (e) { return { id: z.id, name: z.name, grund: fehlerText(e) }; });
    });
    return leise(Promise.all(aufgaben).then(function (erg) {
      var seiten = [], gedruckt = [], fehlend = [];
      erg.forEach(function (r) {
        if (r.seite) { seiten.push(r.seite); gedruckt.push(r.id); }
        else fehlend.push({ id: r.id, name: r.name, grund: r.grund });
      });
      var fehlendText = fehlend.map(function (f) { return f.name + ' — ' + f.grund; }).join('; ');
      if (!seiten.length) {
        var keiner = fehler('Kein Zettel ließ sich bauen: ' + fehlendText, 'bos-druck/keiner');
        keiner.fehlend = fehlend;
        meldeFehler('Sammeldruck fehlgeschlagen', keiner);
        throw keiner;
      }
      if (fehlend.length) zeigeFehlerKasten('Nicht gedruckt: ' + fehlendText);
      var name = opt.dateiname != null && String(opt.dateiname).trim() !== '' ? opt.dateiname
        : (seiten.length === 1 ? erg.filter(function (r) { return r.seite; })[0].name : 'Sammeldruck');
      var p;
      try { p = starteDruck(seiten, { dateiname: name }); }
      catch (e) { meldeFehler('Sammeldruck fehlgeschlagen', e); throw e; }
      return p.then(function (r) { return { gedruckt: gedruckt, fehlend: fehlend, dateiname: r.dateiname }; });
    }));
  }

  return {
    version: VERSION,
    drucken: drucken,
    baueSeite: baueSeite,
    druckeSeiten: druckeSeiten,
    dateinameFuer: dateinameFuer,
    zettel: { anmelden: anmelden, liste: liste, drucke: zettelDrucke }
  };

})();
