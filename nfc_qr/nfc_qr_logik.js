/* ================================================================
   BäckereiOS · NFC-/QR-Zentrale — reine Logik (kein DOM, kein NFC)
   ================================================================
   Einbindung:  <script src="nfc_qr_logik.js"></script>
   Stellt bereit: window.BOS_NFC_QR_LOGIK
   Test:        node test_nfc_qr.js   (im Projekt-Wurzelordner)
   Doku:        nfc_qr/NFC_QR_ZENTRALE_DOKU.md

   Warum eine eigene Datei: Alles hier lässt sich ohne Browser und ohne
   Handy prüfen (Zielliste, Chip-Prüfung, Schild, Fehlertexte). Die
   Seite nfc_qr_zentrale.html ruft nur auf.

   KEINE Daten in dieser Datei: keine Namen, keine Adressen von Hand.
   Die Ziele kommen aus bos_app_registry.js. Einzige Ausnahme, bewusst:
   ZIEL_BOS („BOS öffnen“, führt auf launcher.html). Der Launcher steht
   nicht in der Registry; dieses eine Ziel wird hier von Hand geführt
   (Ulf, 03.10.2026) und steht auch in bos_code_adressen.json.

   CHANGELOG
     2026-10-04 · 11:58 · v1.2 · Fix (Gruppe vom Papier, Ulf 04.10., 11:57)
       Zwei getrennte Schalter statt einem: GRUPPE_AM_BILDSCHIRM (an) und
       GRUPPE_AUF_PAPIER (aus). Einzelschild und Sammelblatt tragen keine
       Gruppenzeile mehr, auch nicht im dritten Schritt. Am Bildschirm
       (anzeigeName) bleibt die Gruppe. Neu: papierGruppe, papierName.
     2026-10-04 · 11:02 · v1.1 · Feature (Stufe 2, Sammelblatt) + Fix
       ANWEISUNG_2026-10-04_NFC_QR_ZENTRALE_STUFE2.md (KC, 10:55).
       Neu: SAMMELBLATT (Grenzen, Felder), blattLeer, blattFehler,
       blattPruefung, darfZeileDazu, verschiebeZeile, blattDokument,
       blattAusDokument, sammelblattHTML, SAMMELBLATT_CSS.
       Neu: gruppe() und anzeigeName() — die EINE Stelle für „Gruppe
       über dem Namen“ (L1); schildHTML und chipErgebnis nutzen sie.
       Fix L3: adresseAusNachricht gibt Text unverändert zurück, die
       Kurzform-Entschlüsselung gilt nur noch für Einträge vom Typ url.
     2026-10-03 · 14:47 · v1.0 · Feature (Stufe 1)
       ANWEISUNG_2026-10-03_NFC_QR_ZENTRALE_STUFE1.md (KC, 11:51).
       zielListe, chipErgebnis, decodeUrlRecord (aus dem alten
       AdminTools/nfc_zentrale.html kopiert), nfcFehlerArt, schildHTML
       (Einzelschild A4 quer, neu gestaltet), waechter und
       feldPasstZurSeite (für die Tests).
   ================================================================ */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ohneZusatz(adr) { return String(adr || '').split('#')[0].split('?')[0]; }

  /* ---------- Gruppe eines Ziels (L1, 04.10.2026) ----------
     Sechs Ziele heißen so kurz, dass der Name allein nichts sagt („Ziele“,
     „Orte“, „Übersicht“ …). Die Gruppe ist der Name des Hubs.
     ZWEI SCHALTER, bewusst getrennt (Ulf, 04.10.2026, 11:57):
     - AM BILDSCHIRM an: Dort wird ausgewählt, und „Orte“, „Ziele“,
       „Übersicht“ sind ohne Gruppe in einer Liste nicht zu unterscheiden.
       Gilt für alles, was anzeigeName() benutzt (Auswahlliste und Zeilen
       des Sammelblatt-Editors, „Chip prüfen“, Titel beim Beschreiben).
     - AUF DEM PAPIER aus: Einzelschild und Sammelblatt tragen nur den Namen,
       auch im dritten Schritt („bei „Ziele““). Das Schild hängt am Ort, der
       Ort erklärt die Gruppe.
     Nur an diesen zwei Stellen drehen. */
  var GRUPPE_AM_BILDSCHIRM = true;
  var GRUPPE_AUF_PAPIER = false;
  function gruppe(ziel) { return GRUPPE_AM_BILDSCHIRM && ziel && ziel.hubName ? String(ziel.hubName) : ''; }
  function anzeigeName(ziel) { var g = gruppe(ziel); return (g ? g + ' · ' : '') + (ziel && ziel.name ? ziel.name : ''); }
  function papierGruppe(ziel) { return GRUPPE_AUF_PAPIER && ziel && ziel.hubName ? String(ziel.hubName) : ''; }
  function papierName(ziel) { var g = papierGruppe(ziel); return (g ? g + ' · ' : '') + (ziel && ziel.name ? ziel.name : ''); }
  function hubNamen(apps) { var h = {}; (apps || []).forEach(function (a) { if (a && a.type === 'hub') h[a.id] = a.name; }); return h; }

  /* Das eine Ziel, das nicht in der Registry steht. */
  var ZIEL_BOS = { id: 'bos_oeffnen', name: 'BOS öffnen', icon: '🏠', url: 'launcher.html', direkt: 'anmeldung', fest: true };

  /* Reihenfolge und Überschriften der Gruppen. Werte wie das Feld
     „bereich“ der Registry; Einträge ohne bereich (die offenen Werkzeuge)
     landen unter „allgemein“, unbekannte Werte sichtbar unter „sonstiges“. */
  var BEREICHE = [
    { id: 'allgemein', titel: 'Allgemein' },
    { id: 'produktion', titel: 'Produktion' },
    { id: 'verbrauch', titel: 'Verbrauch' },
    { id: 'vertrieb_filiale', titel: 'Vertrieb & Filiale' },
    { id: 'verwaltung', titel: 'Verwaltung' },
    { id: 'sonstiges', titel: 'Sonstiges' }
  ];

  /* Liste für die Zentrale. Einträge ohne Adresse (Hubs, „geplant“,
     Einstellungen) erscheinen nicht. Wählbar ist, wer das Feld direkt
     trägt; alle anderen stehen mit Grund da. */
  function zielListe(apps) {
    var bekannt = {}; BEREICHE.forEach(function (b) { bekannt[b.id] = true; });
    var hubName = hubNamen(apps);
    var gruppen = {};
    (apps || []).forEach(function (a) {
      if (!a || !a.url) return;
      var b = a.bereich || 'allgemein';
      if (!bekannt[b]) b = 'sonstiges';
      var waehlbar = a.direkt === 'anmeldung' || a.direkt === 'offen';
      (gruppen[b] = gruppen[b] || []).push({
        id: a.id, name: a.name, icon: a.icon || '', url: a.url, direkt: waehlbar ? a.direkt : null,
        hubName: a.hub && hubName[a.hub] ? hubName[a.hub] : '',
        waehlbar: waehlbar, grund: waehlbar ? '' : 'nicht_direkt'
      });
    });
    return BEREICHE.filter(function (b) { return gruppen[b.id]; }).map(function (b) {
      return { bereich: b.id, titel: b.titel, eintraege: gruppen[b.id] };
    });
  }

  /* Alle wählbaren Ziele, das feste zuerst. */
  function waehlbareZiele(apps) {
    var aus = [ZIEL_BOS];
    zielListe(apps).forEach(function (g) { g.eintraege.forEach(function (e) { if (e.waehlbar) aus.push(e); }); });
    return aus;
  }
  function zielNachId(apps, id) {
    return waehlbareZiele(apps).filter(function (z) { return z.id === id; })[0] || null;
  }

  /* ---------- Chip prüfen ----------
     Wohin führt eine gelesene Adresse? Verglichen wird gegen die Wurzel
     und die Pfade der Registry; Zusätze hinter „?“ zählen nicht.
     art: 'leer' | 'ziel' | 'ziel_fehlt' | 'fremd'
     Bei 'ziel': ziel = { id, name, … }, direkt = ob die Seite (noch) für
     den Direktaufruf freigegeben ist, zusatz = was hinter dem Pfad steht. */
  function chipErgebnis(href, wurzel, apps) {
    var roh = String(href || '').trim();
    if (!roh) return { art: 'leer', adresse: '' };
    var w = String(wurzel || '');
    var ohne = ohneZusatz(roh);
    if (!w || ohne.toLowerCase().indexOf(w.toLowerCase()) !== 0) return { art: 'fremd', adresse: roh };
    var pfad = ohne.slice(w.length);
    var zusatz = roh.slice(ohne.length);
    if (pfad === '' || pfad === ZIEL_BOS.url || pfad === 'index.html') {
      return { art: 'ziel', adresse: roh, ziel: ZIEL_BOS, direkt: true, zusatz: zusatz };
    }
    var treffer = (apps || []).filter(function (a) { return a && a.url && ohneZusatz(a.url) === pfad; })[0];
    if (!treffer) return { art: 'ziel_fehlt', adresse: roh, pfad: pfad };
    return {
      art: 'ziel', adresse: roh, zusatz: zusatz,
      ziel: { id: treffer.id, name: treffer.name, icon: treffer.icon || '', url: treffer.url, hubName: (treffer.hub && hubNamen(apps)[treffer.hub]) || '' },
      direkt: treffer.direkt === 'anmeldung' || treffer.direkt === 'offen'
    };
  }

  /* ---------- Adresse aus einem NDEF-Eintrag ----------
     Aus AdminTools/nfc_zentrale.html (altes System) kopiert.
     Eine Zeile angepasst: record.data ist ein DataView; die alte Zeile
     „new Uint8Array(record.data)“ ergab daraus ein leeres Feld.
     URI-Identifier-Code-Prefix (NFC Forum URI Record Type). */
  var URI_PREFIXES = [
    '', 'http://www.', 'https://www.', 'http://', 'https://',
    'tel:', 'mailto:', 'ftp://anonymous:anonymous@', 'ftp://ftp.',
    'ftps://', 'sftp://', 'smb://', 'nfs://', 'ftp://', 'dav://',
    'news:', 'telnet://', 'imap:', 'rtsp://', 'urn:', 'pop:', 'sip:',
    'sips:', 'tftp:', 'btspp://', 'btl2cap://', 'btgoep://',
    'tcpobex://', 'irdaobex://', 'file://', 'urn:epc:id:',
    'urn:epc:tag:', 'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:', 'urn:nfc:'
  ];
  function decodeUrlRecord(record) {
    var raw = new TextDecoder().decode(record.data);
    // Wenn schon ein gültiges URL-Schema vorhanden → direkt zurück
    if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(raw) || /^(tel:|mailto:|urn:|sip:)/i.test(raw)) return raw;
    // Sonst: erstes Byte = URI Identifier Code
    var bytes = new Uint8Array(record.data.buffer || record.data, record.data.byteOffset || 0, record.data.byteLength);
    var prefix = URI_PREFIXES[bytes[0]] !== undefined ? URI_PREFIXES[bytes[0]] : '';
    return prefix + new TextDecoder().decode(bytes.slice(1));
  }
  /* Erster Inhalt aus einer gelesenen Nachricht ('' wenn keiner).
     Adresse (url): mit Kurzform-Entschlüsselung. Text: unverändert (L3,
     04.10.2026 — vorher fehlte bei Text das erste Zeichen). */
  function adresseAusNachricht(message) {
    var recs = (message && message.records) || [];
    for (var i = 0; i < recs.length; i++) {
      if (recs[i].recordType === 'url') return decodeUrlRecord(recs[i]);
      if (recs[i].recordType === 'text') return new TextDecoder().decode(recs[i].data);
    }
    return '';
  }

  /* ---------- NFC-Fehler: Ursache unterscheiden ----------
     vorgang: 'lesen' | 'schreiben'. Rückgabe = Schlüssel für den Text der
     Seite; die echte Meldung (err.message) zeigt die Seite zusätzlich.
     Zuordnung nach der Web-NFC-Beschreibung, am Gerät NICHT geprüft. */
  function nfcFehlerArt(err, vorgang) {
    var n = err && err.name;
    if (n === 'AbortError') return 'nfc_abgebrochen';
    if (n === 'NotAllowedError') return 'nfc_keine_erlaubnis';
    if (n === 'NotReadableError') return 'nfc_aus';
    if (n === 'NotSupportedError') return vorgang === 'schreiben' ? 'nfc_chip_nicht_beschreibbar' : 'nfc_kein_geraet';
    if (n === 'NetworkError') return vorgang === 'schreiben' ? 'nfc_chip_nicht_beschreibbar' : 'nfc_chip_nicht_lesbar';
    if (n === 'ChipLesefehler') return 'nfc_chip_nicht_lesbar';
    return 'nfc_unbekannt';
  }

  /* ---------- Einzelschild: A4 quer, ein Ziel groß ----------
     ziel: { name, icon, direkt }. o: { variante: 'beides'|'qr'|'chip',
     qrSvg, adresse, spruch, stand }. Reine Textfunktion. */
  var VARIANTEN = ['beides', 'qr', 'chip'];
  var SPRUCH_VORGABE = 'Scan mich. BäckereiOS öffnet direkt.';
  function schritte(variante, ziel) {
    var name = '„' + papierName(ziel) + '“';
    var drei = ziel && ziel.direkt === 'offen'
      ? name + ' öffnet sich sofort, ohne Anmeldung.'
      : 'Anmelden. Danach bist du direkt bei ' + name + '.';
    if (variante === 'qr') return ['Kamera am Handy öffnen und auf den Code halten.', 'Auf den Link tippen, der erscheint.', drei];
    if (variante === 'chip') return ['Handy entsperren. NFC muss eingeschaltet sein.', 'Rückseite des Handys an das Chip-Feld halten und auf die Meldung tippen.', drei];
    return ['Code mit der Kamera scannen ODER das entsperrte Handy ans Chip-Feld halten.', 'Auf den Link oder die Meldung tippen.', drei];
  }
  function namenKlasse(name) {
    var n = String(name || '').length;
    return n <= 10 ? 'xl' : n <= 16 ? 'l' : n <= 26 ? 'm' : 's';
  }
  var NFC_SYMBOL = '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7a13 13 0 0 1 0 10"/><path d="M17 9.5a8 8 0 0 1 0 5"/><circle cx="6" cy="12" r="4"/><path d="M10 12h4"/></svg>';
  function schildHTML(ziel, o) {
    o = o || {};
    var v = VARIANTEN.indexOf(o.variante) === -1 ? 'beides' : o.variante;
    var mitQr = v !== 'chip', mitChip = v !== 'qr';
    var spruch = o.spruch == null ? SPRUCH_VORGABE : String(o.spruch);
    var s = schritte(v, ziel);
    return '<section class="ws">' +
      '<div class="ws-kopf"><span class="ws-marke">Bäckerei<i>OS</i></span><span class="ws-art">Wegweiser</span></div>' +
      '<div class="ws-mitte">' +
        '<div class="ws-links">' + (papierGruppe(ziel) ? '<div class="ws-gruppe">' + esc(papierGruppe(ziel)) + '</div>' : '') +
          '<div class="ws-name ws-name-' + namenKlasse(ziel.name) + '">' + esc(ziel.name) + '</div>' +
          (spruch ? '<div class="ws-spruch">' + esc(spruch) + '</div>' : '') + '</div>' +
        '<div class="ws-rechts' + (mitQr && mitChip ? ' zwei' : '') + '">' +
          (mitQr ? '<div class="ws-feld ws-qr">' + (o.qrSvg || '') + '<div class="ws-feldtext">Scannen</div></div>' : '') +
          (mitChip ? '<div class="ws-feld ws-chip"><div class="ws-chipkreis">' + NFC_SYMBOL + '</div><div class="ws-feldtext">Handy hier dranhalten</div></div>' : '') +
        '</div>' +
      '</div>' +
      '<ol class="ws-schritte">' + s.map(function (t, i) { return '<li><b>' + (i + 1) + '</b><span>' + esc(t) + '</span></li>'; }).join('') + '</ol>' +
      '<div class="ws-fuss"><span class="ws-adresse">' + esc(o.adresse || '') + '</span>' +
        '<span class="ws-powered">Powered by BäckereiOS · Stand ' + esc(o.stand || '') + '</span></div>' +
      '</section>';
  }
  var SCHILD_CSS =
    '.ws{width:297mm;height:209mm;box-sizing:border-box;padding:12mm 14mm 9mm;display:flex;flex-direction:column;overflow:hidden;' +
      'background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;line-height:1.2;page-break-after:always;break-after:page;}' +
    '.ws:last-child{page-break-after:auto;break-after:auto;}.ws,.ws *{box-sizing:border-box;}' +
    '.ws-kopf{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.6mm solid #000;padding-bottom:3mm;}' +
    '.ws-marke{font-family:Georgia,serif;font-size:22pt;font-weight:900;}.ws-marke i{font-weight:400;color:#555;}' +
    '.ws-art{font-size:10pt;letter-spacing:.18em;text-transform:uppercase;color:#555;}' +
    '.ws-mitte{flex:1;min-height:0;display:flex;gap:10mm;align-items:center;padding:5mm 0;}' +
    '.ws-links{flex:1;min-width:0;}' +
    '.ws-gruppe{font-size:22pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#333;margin-bottom:3mm;overflow-wrap:anywhere;}' +
    '.ws-name{font-family:Georgia,serif;font-weight:900;line-height:.95;letter-spacing:-.02em;overflow-wrap:anywhere;hyphens:auto;}' +
    '.ws-name-xl{font-size:104pt;}.ws-name-l{font-size:80pt;}.ws-name-m{font-size:58pt;}.ws-name-s{font-size:42pt;}' +
    '.ws-spruch{font-family:Georgia,serif;font-style:italic;font-size:20pt;color:#333;margin-top:7mm;overflow-wrap:anywhere;}' +
    '.ws-rechts{flex:0 0 auto;display:flex;flex-direction:column;gap:5mm;align-items:center;}' +
    '.ws-feld{border:.5mm dashed #888;border-radius:3mm;padding:4mm;display:flex;flex-direction:column;align-items:center;gap:2.5mm;width:84mm;}' +
    '.ws-rechts.zwei .ws-feld{width:62mm;padding:3mm;}' +
    '.ws-qr svg{width:74mm;height:74mm;display:block;}.ws-rechts.zwei .ws-qr svg{width:52mm;height:52mm;}' +
    '.ws-chipkreis{width:74mm;height:74mm;border:.7mm solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;}' +
    '.ws-rechts.zwei .ws-chipkreis{width:52mm;height:52mm;}' +
    '.ws-chipkreis svg{width:45%;height:45%;}' +
    '.ws-feldtext{font-size:10pt;letter-spacing:.12em;text-transform:uppercase;color:#333;text-align:center;}' +
    '.ws-schritte{list-style:none;margin:0;padding:4mm 0 0;border-top:.3mm solid #999;display:flex;gap:8mm;}' +
    '.ws-schritte li{flex:1;display:flex;gap:3mm;align-items:flex-start;font-size:13pt;line-height:1.3;}' +
    '.ws-schritte b{flex:0 0 auto;width:8mm;height:8mm;border:.5mm solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11pt;}' +
    '.ws-fuss{display:flex;justify-content:space-between;align-items:baseline;gap:8mm;margin-top:4mm;font-size:8pt;color:#555;}' +
    '.ws-adresse{font-family:monospace;overflow-wrap:anywhere;min-width:0;}.ws-powered{white-space:nowrap;font-weight:700;}';
  /* bos_druck.js legt um den Inhalt 12/15 mm Rand und Zeilenhöhe 1,75 —
     für ein Schild, das die ganze Seite füllt, muss das weg (wie in
     teigecke_logik.js, SCHILD_DRUCK_CSS). */
  var SCHILD_DRUCK_CSS = '#bos-print-root{padding:0;}.bos-pa-body{font-size:12pt;line-height:normal;word-break:normal;}';

  /* ================================================================
     SAMMELBLATT (Stufe 2, 04.10.2026): ein Standort, mehrere Ziele,
     A4 hoch. Gespeichert wird je Zeile die id aus der Registry, NIE
     eine Adresse. Die Adresse entsteht erst beim Drucken (bos_qr.js).
     ================================================================
     Grenzen: im Browser GEMESSEN (ablauftest_nfc_qr.js, Lauf 8), nicht
     geschätzt. Ein Ziel braucht 32 mm Höhe (Code 30 mm breit), eine
     Überschrift 9 mm. 7 Ziele + 2 Überschriften füllen das Blatt.
     MAX_ZEILEN = MAX_ZIELE + MAX_UEBERSCHRIFTEN und steht genauso in
     der Firestore-Regel (zeilen.size() <= 9, RK §15); test_nfc_qr.js
     vergleicht beides mit --regeln=<Datei>. Wer hier dreht, muss die
     Regel, SAMMELBLATT_CSS und die Prüfbilder mitziehen. */
  var SAMMELBLATT = {
    COLLECTION: 'nfc_sammelblaetter',
    MAX_ZIELE: 7, MAX_UEBERSCHRIFTEN: 2, MAX_ZEILEN: 9,
    STANDORT_MAX: 40, UEBERSCHRIFT_MAX: 40,
    /* muss 1:1 zur hasOnly-Liste der Regel passen */
    FELDER: ['standort', 'ausstattung', 'zeilen', 'geloescht', 'geaendertVon', 'geaendertAm']
  };
  function blattLeer() { return { id: null, standort: '', ausstattung: 'beides', zeilen: [], geloescht: false, geaendertAm: null }; }
  function zaehle(blatt, art) { return ((blatt && blatt.zeilen) || []).filter(function (z) { return z && z.art === art; }).length; }

  /* Darf noch eine Zeile dieser Art dazu? '' = ja, sonst der Grund. */
  function darfZeileDazu(blatt, art) {
    if (art === 'ziel' && zaehle(blatt, 'ziel') >= SAMMELBLATT.MAX_ZIELE) return 'max_ziele';
    if (art === 'ueberschrift' && zaehle(blatt, 'ueberschrift') >= SAMMELBLATT.MAX_UEBERSCHRIFTEN) return 'max_ueberschriften';
    return '';
  }
  /* Zeile um einen Platz verschieben (richtung -1 hoch, +1 runter). Neue Liste. */
  function verschiebeZeile(zeilen, index, richtung) {
    var a = (zeilen || []).slice(), j = index + richtung;
    if (index < 0 || index >= a.length || j < 0 || j >= a.length) return a;
    var t = a[index]; a[index] = a[j]; a[j] = t;
    return a;
  }
  /* Form eines Blatts: Liste der Fehler-Schlüssel (leer = in Ordnung).
     Sagt nichts darüber, ob es die Ziele noch gibt (dafür blattPruefung). */
  function blattFehler(blatt) {
    var f = [], b = blatt || {};
    var st = typeof b.standort === 'string' ? b.standort.trim() : '';
    if (st.length < 1) f.push('standort_leer');
    if (st.length > SAMMELBLATT.STANDORT_MAX) f.push('standort_lang');
    if (VARIANTEN.indexOf(b.ausstattung) === -1) f.push('ausstattung');
    if (!Array.isArray(b.zeilen)) { f.push('zeilen'); return f; }
    if (zaehle(b, 'ziel') > SAMMELBLATT.MAX_ZIELE) f.push('max_ziele');
    if (zaehle(b, 'ueberschrift') > SAMMELBLATT.MAX_UEBERSCHRIFTEN) f.push('max_ueberschriften');
    if (b.zeilen.length > SAMMELBLATT.MAX_ZEILEN) f.push('max_zeilen');
    b.zeilen.forEach(function (z) {
      if (z && z.art === 'ziel' && typeof z.zielId === 'string' && z.zielId) return;
      if (z && z.art === 'ueberschrift' && typeof z.text === 'string' && z.text.trim().length >= 1 && z.text.trim().length <= SAMMELBLATT.UEBERSCHRIFT_MAX) return;
      if (f.indexOf('zeile_form') === -1) f.push('zeile_form');
    });
    return f;
  }
  /* „Ziel gibt es nicht mehr“: jede Ziel-Zeile gegen waehlbareZiele().
     Rückgabe: { ok, tote: [{ index, zielId, grund: 'fehlt' | 'nicht_waehlbar', name }] } */
  function blattPruefung(blatt, apps) {
    var wahl = {}, alle = {};
    waehlbareZiele(apps).forEach(function (z) { wahl[z.id] = z; });
    (apps || []).forEach(function (a) { if (a) alle[a.id] = a; });
    var tote = [];
    ((blatt && blatt.zeilen) || []).forEach(function (z, i) {
      if (!z || z.art !== 'ziel' || wahl[z.zielId]) return;
      tote.push({ index: i, zielId: z.zielId, grund: alle[z.zielId] ? 'nicht_waehlbar' : 'fehlt', name: alle[z.zielId] ? alle[z.zielId].name : '' });
    });
    return { ok: tote.length === 0, tote: tote };
  }
  /* Genau die Felder, die die Regel erlaubt. Keine Adresse, kein Name
     eines Ziels: nur die id. zeit = serverTimestamp() der Seite. */
  function blattDokument(blatt, kennung, zeit) {
    return {
      standort: String(blatt.standort || '').trim(),
      ausstattung: blatt.ausstattung,
      zeilen: (blatt.zeilen || []).map(function (z) {
        return z.art === 'ziel' ? { art: 'ziel', zielId: String(z.zielId) } : { art: 'ueberschrift', text: String(z.text || '').trim() };
      }),
      geloescht: blatt.geloescht === true,
      geaendertVon: kennung,
      geaendertAm: zeit
    };
  }
  /* Dokument aus der Datenbank → Blatt der Seite. Unbekanntes wird nicht
     erfunden: eine Zeile ohne lesbare Art bleibt als kaputte Zeile stehen
     und fällt in blattFehler auf. zeitMs = Stand zum Vergleich beim Speichern. */
  function blattAusDokument(id, d, zeitMs) {
    d = d || {};
    return {
      id: id, standort: typeof d.standort === 'string' ? d.standort : '',
      ausstattung: VARIANTEN.indexOf(d.ausstattung) === -1 ? 'beides' : d.ausstattung,
      zeilen: Array.isArray(d.zeilen) ? d.zeilen.map(function (z) {
        if (z && z.art === 'ziel') return { art: 'ziel', zielId: z.zielId };
        if (z && z.art === 'ueberschrift') return { art: 'ueberschrift', text: z.text };
        return { art: 'unbekannt' };
      }) : [],
      geloescht: d.geloescht === true, geaendertVon: d.geaendertVon || '', geaendertAm: zeitMs == null ? null : zeitMs
    };
  }
  /* Schriftstufen so gewählt, dass auch lauter breite Buchstaben („W“) in die
     Zeile passen (im Ablauftest gemessen): nichts wird still abgeschnitten. */
  function standortKlasse(text) { var n = String(text || '').length; return n <= 12 ? 'xl' : n <= 18 ? 'l' : n <= 28 ? 'm' : 's'; }
  /* QR so einpassen, dass der CODE SELBST (ohne Ruhezone) genau 30 mm
     breit ist. Die Ruhezone (4 Module) ragt in den weißen Rand der Zeile. */
  function qrGenau(svg) {
    var m = /viewBox="0 0 (\d+) (\d+)"/.exec(String(svg || ''));
    if (!m) return '';
    var ganz = Number(m[1]), code = ganz - 8;
    if (!(code > 0)) return '';
    var breite = 30 * ganz / code, rand = 30 * 4 / code;
    return '<div class="sb-qr">' + String(svg).replace('<svg ', '<svg style="width:' + breite.toFixed(3) + 'mm;height:' + breite.toFixed(3) + 'mm;margin:-' + rand.toFixed(3) + 'mm" ') + '</div>';
  }
  /* Sammelblatt A4 hoch. blatt: { standort, ausstattung, zeilen }.
     o: { ziele: { id: { name, hubName, qrSvg, adresse } }, stand }.
     Code und Chip-Feld wechseln je Ziel-Zeile die Seite, damit das Handy
     nicht den Chip der Nachbarzeile erwischt. Reine Textfunktion; ob
     gedruckt werden DARF, entscheidet die Seite (druckeSammelblatt). */
  function sammelblattHTML(blatt, o) {
    o = o || {};
    var v = VARIANTEN.indexOf(blatt.ausstattung) === -1 ? 'beides' : blatt.ausstattung;
    var mitQr = v !== 'chip', mitChip = v !== 'qr', nr = 0;
    var chip = '<div class="sb-chip"><div class="sb-chipkreis">' + NFC_SYMBOL + '</div></div>', leer = '<div class="sb-frei"></div>';
    var zeilen = (blatt.zeilen || []).map(function (z) {
      if (z.art === 'ueberschrift') return '<div class="sb-ueber">' + esc(z.text) + '</div>';
      var info = (o.ziele || {})[z.zielId] || {}, links = nr % 2 === 0; nr++;
      var qr = mitQr ? qrGenau(info.qrSvg) : '';
      /* gerade Zeile: Code links, Chip rechts. Ungerade: getauscht. Bei nur
         einer Sorte wechselt diese eine die Seite, die andere Seite bleibt frei. */
      var a = mitQr ? qr : chip, b = mitQr && mitChip ? chip : leer;
      return '<div class="sb-zeile ' + (links ? 'sb-links' : 'sb-rechts') + '">' + (links ? a : b) +
        '<div class="sb-text">' + (papierGruppe(info) ? '<div class="sb-gruppe">' + esc(papierGruppe(info)) + '</div>' : '') +
          '<div class="sb-name">' + esc(info.name || '') + '</div><div class="sb-adresse">' + esc(info.adresse || '') + '</div></div>' +
        (links ? b : a) + '</div>';
    }).join('');
    var hinweis = mitQr && mitChip ? 'Code scannen oder das entsperrte Handy an den Kreis halten.' : mitQr ? 'Code mit der Kamera des Handys scannen.' : 'Entsperrtes Handy mit der Rückseite an den Kreis halten.';
    return '<section class="sb">' +
      '<div class="sb-kopf"><span class="sb-marke">Bäckerei<i>OS</i></span><span class="sb-art">Wegweiser</span></div>' +
      '<div class="sb-standort sb-standort-' + standortKlasse(blatt.standort) + '">' + esc(blatt.standort) + '</div>' +
      '<div class="sb-hinweis">' + hinweis + '</div>' +
      '<div class="sb-zeilen">' + zeilen + '</div>' +
      '<div class="sb-fuss"><span>Powered by BäckereiOS</span><span>Stand ' + esc(o.stand || '') + '</span></div>' +
      '</section>';
  }
  var SAMMELBLATT_CSS =
    '.sb{width:210mm;height:296mm;box-sizing:border-box;padding:9mm 11mm 8mm;display:flex;flex-direction:column;overflow:hidden;' +
      'background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;line-height:1.15;page-break-after:always;break-after:page;}' +
    '.sb:last-child{page-break-after:auto;break-after:auto;}.sb,.sb *{box-sizing:border-box;}' +
    '.sb-kopf{height:8mm;display:flex;justify-content:space-between;align-items:baseline;border-bottom:.5mm solid #000;}' +
    '.sb-marke{font-family:Georgia,serif;font-size:14pt;font-weight:900;}.sb-marke i{font-weight:400;color:#555;}' +
    '.sb-art{font-size:8pt;letter-spacing:.18em;text-transform:uppercase;color:#555;}' +
    '.sb-standort{height:15mm;display:flex;align-items:center;font-family:Georgia,serif;font-weight:900;white-space:nowrap;overflow:hidden;letter-spacing:-.01em;}' +
    '.sb-standort-xl{font-size:34pt;}.sb-standort-l{font-size:26pt;}.sb-standort-m{font-size:17pt;}.sb-standort-s{font-size:12pt;}' +
    '.sb-hinweis{height:6mm;font-size:9.5pt;color:#333;}' +
    '.sb-zeilen{flex:1;min-height:0;}' +
    '.sb-ueber{height:9mm;display:flex;align-items:flex-end;padding-bottom:1.2mm;font-size:13pt;font-weight:700;letter-spacing:.04em;text-transform:uppercase;' +
      'border-bottom:.4mm solid #000;white-space:nowrap;overflow:hidden;}' +
    '.sb-zeile{height:32mm;display:flex;align-items:center;gap:6mm;}' +
    '.sb-qr{flex:0 0 30mm;width:30mm;height:30mm;overflow:visible;}.sb-qr svg{display:block;}' +
    '.sb-chip,.sb-frei{flex:0 0 30mm;width:30mm;height:30mm;display:flex;align-items:center;justify-content:center;}' +
    '.sb-chipkreis{width:26mm;height:26mm;border:.6mm solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;}' +
    '.sb-chipkreis svg{width:45%;height:45%;}' +
    '.sb-text{flex:1;min-width:0;}.sb-rechts .sb-text{text-align:right;}' +
    '.sb-gruppe{font-size:9pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#333;margin-bottom:.8mm;}' +
    '.sb-name{font-family:Georgia,serif;font-size:20pt;font-weight:900;line-height:1.05;max-height:15mm;overflow:hidden;overflow-wrap:anywhere;}' +
    '.sb-adresse{font-family:monospace;font-size:6.5pt;color:#555;margin-top:1.2mm;overflow-wrap:anywhere;max-height:6mm;overflow:hidden;}' +
    '.sb-fuss{height:6mm;display:flex;justify-content:space-between;align-items:flex-end;font-size:8pt;font-weight:700;color:#555;border-top:.3mm solid #999;}';

  /* ---------- Wächter (für test_nfc_qr.js) ----------
     datei = Inhalt von bos_code_adressen.json. Liefert die Abweichungen
     als Texte; leere Liste = alles gleich. */
  function waechter(apps, datei) {
    var soll = (datei && datei.adressen) || {}, fest = (datei && datei.fest) || {};
    var ist = {}, aus = [];
    (apps || []).forEach(function (a) { if (a && a.url && (a.direkt === 'anmeldung' || a.direkt === 'offen')) ist[a.id] = a.url; });
    Object.keys(soll).forEach(function (id) {
      if (!(id in ist)) aus.push(id + ': steht in bos_code_adressen.json, aber in der Registry fehlt der Eintrag, seine Adresse oder das Feld direkt');
      else if (ist[id] !== soll[id]) aus.push(id + ': Adresse geändert (freigegeben „' + soll[id] + '“, Registry „' + ist[id] + '“)');
    });
    Object.keys(ist).forEach(function (id) {
      if (!(id in soll)) aus.push(id + ': hat in der Registry das Feld direkt, fehlt aber in bos_code_adressen.json');
    });
    if (fest[ZIEL_BOS.id] !== ZIEL_BOS.url) aus.push(ZIEL_BOS.id + ': festes Ziel weicht ab (freigegeben „' + fest[ZIEL_BOS.id] + '“, Zentrale „' + ZIEL_BOS.url + '“)');
    return aus;
  }
  var WAECHTER_SATZ = 'Diese Adresse darf auf Schildern stehen. Wenn schon gedruckt wurde: alte Adresse stehen lassen und weiterleiten. Wenn noch nichts hängt: Datei anpassen.';

  /* Passt das Feld direkt zur Seite? html = Quelltext der Seite.
     'anmeldung' genau dann, wenn die Seite bos_standalone_login.js als
     echte <script src>-Zeile einbindet (Kommentare zählen nicht).
     'offen' nur ohne roles, ohne Anmelde-Skript und ohne Datenbank.
     Rückgabe: '' wenn es passt, sonst der Grund. */
  function feldPasstZurSeite(app, html) {
    var h = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
    var login = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*bos_standalone_login\.js/i.test(h);
    var datenbank = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*(firebase|bos_firebase_config)/i.test(h);
    if (app.direkt === 'anmeldung') return login ? '' : 'direkt: \'anmeldung\', aber die Seite bindet bos_standalone_login.js nicht ein';
    if (app.direkt === 'offen') {
      if (app.roles) return 'direkt: \'offen\', aber der Eintrag hat roles';
      if (login) return 'direkt: \'offen\', aber die Seite bindet bos_standalone_login.js ein (dann \'anmeldung\')';
      if (datenbank) return 'direkt: \'offen\', aber die Seite lädt die Datenbank';
      return '';
    }
    if (app.direkt != null) return 'direkt hat einen unbekannten Wert: ' + app.direkt;
    return login ? 'die Seite bindet bos_standalone_login.js ein, aber das Feld direkt fehlt' : '';
  }

  var api = {
    esc: esc, ohneZusatz: ohneZusatz, ZIEL_BOS: ZIEL_BOS, BEREICHE: BEREICHE,
    zielListe: zielListe, waehlbareZiele: waehlbareZiele, zielNachId: zielNachId,
    chipErgebnis: chipErgebnis, decodeUrlRecord: decodeUrlRecord, adresseAusNachricht: adresseAusNachricht,
    nfcFehlerArt: nfcFehlerArt,
    VARIANTEN: VARIANTEN, SPRUCH_VORGABE: SPRUCH_VORGABE, schritte: schritte, schildHTML: schildHTML,
    SCHILD_CSS: SCHILD_CSS, SCHILD_DRUCK_CSS: SCHILD_DRUCK_CSS,
    waechter: waechter, WAECHTER_SATZ: WAECHTER_SATZ, feldPasstZurSeite: feldPasstZurSeite,
    gruppe: gruppe, anzeigeName: anzeigeName, papierGruppe: papierGruppe, papierName: papierName,
    SAMMELBLATT: SAMMELBLATT, blattLeer: blattLeer, blattFehler: blattFehler, blattPruefung: blattPruefung,
    darfZeileDazu: darfZeileDazu, verschiebeZeile: verschiebeZeile, blattDokument: blattDokument, blattAusDokument: blattAusDokument,
    sammelblattHTML: sammelblattHTML, SAMMELBLATT_CSS: SAMMELBLATT_CSS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_NFC_QR_LOGIK = api;
})(typeof window !== 'undefined' ? window : globalThis);
