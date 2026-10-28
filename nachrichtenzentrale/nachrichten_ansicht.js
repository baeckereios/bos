/* ================================================================
   BäckereiOS · nachrichtenzentrale/nachrichten_ansicht.js — Ansicht der Nachrichtenzentrale
   ================================================================
   Stellt bereit: window.BOS_NACHRICHTEN_ANSICHT (für die Prüfung: zustand(), neuLaden(), oeffne(id))

   Einbindung als letztes Skript der Seite, nach nachrichten_logik.js. Startet bei DOMContentLoaded.
   Alles mit Daten über textContent / createElement (nie innerHTML mit Daten); Druck-HTML über esc().
   Texte nur über t() (Checkliste §6). Jeder Fehler mit err.message sichtbar (Checkliste §7a).

   CHANGELOG
     2026-10-28 · 01:08 · v1.2 · Nacharbeit (Kontroll-Chat 27.10. 19:52). N1: Nachtrag nur mit Schreib-Haken — ohne Haken
       statt Knopf der Satz „Nachträge braucht den Haken …“, Fehlertext f_kein_haken_nachtrag. N2 (Antwort auf K-e/F47):
       erkennt die Seite die Regel vom 27.10. und scheitert der Sammelpfad mit permission-denied, steht der Rückweg als
       ERKLÄRTER Zustand im gelben Hinweis (Satz + Code in Klammern), nicht in der roten Zeile; rot bleibt alles
       Unerwartete (Index fehlt, Netz, andere Codes, neue Fassung erkannt und trotzdem abgelehnt). console.error bleibt.
     2026-10-27 · 19:14 · v1.1 · Feature (Nachrichtenzentrale Stufe 1d, #131; Bauplan 18:45, Go Kontroll-Chat 18:55,
       A1–A6). Kästchen „Antworten sehen alle Empfänger“ (nur mit Regel-Fassung 1d, nie Kritik/Aushang; in der
       Korrektur gesperrt), Marke „👥 offen“, Satz über dem Antwortfeld, Antworten immer „von … an …“; Nachtrag
       (Knopf beim Absender offener Nachrichten, Empfänger nur dazu, Satz K29), Nachträge hervorgehoben unter dem
       Text, Marke „Nachtrag“; Lese-Schlüssel id#n; G (Sammelpfad) für „💬 n“ und „neue Antwort“, Rückweg in der
       Fehlerzeile genannt (A3).
       nachrichtenzentrale/_protokolle/SESSION_2026-10-27_NACHRICHTENZENTRALE_STUFE_1D_BAU.md
     2026-10-27 · 08:09 · v1.0 · Feature (Nachrichtenzentrale Stufe 1c, #131; Go Kontroll-Chat 07:54, A1–A8). Neu.
       nachrichtenzentrale/_protokolle/SESSION_2026-10-27_NACHRICHTENZENTRALE_STUFE_1C_BAU.md
   ================================================================ */
(function () {
  'use strict';
  var L = window.BOS_NACHRICHTEN, Z = window.BOS_NACHRICHTEN_ZAHL;

  /* ---------- Texte (Checkliste §6; A1: kein Kummerkasten, kein Vorname, kein „Launcher“) ---------- */
  var I18N_DE = {
    titel: 'Nachrichten', laden: 'Lädt …', neu_laden: 'Neu laden', hilfe: 'Hilfe', schliessen: 'Schließen', zurueck: '← zurück', suchen: 'Name suchen …',
    r_postfach: 'Postfach', r_aushaenge: 'Aushänge', r_gesendet: 'Gesendet', r_schreiben: '✎ Schreiben',
    alle_gelesen_aus: 'Alle gelesenen ausblenden', zeige_ausgeblendete: 'ausgeblendete zeigen',
    aushaenge_satz: 'Aushänge sieht jedes Konto. Sie hängen bis zum Datum oder bis jemand sie abnimmt.',
    feld_art: 'Art', feld_an: 'An', feld_gilt_bis: 'Gilt bis', feld_text: 'Text',
    aushang_satz_schreiben: 'Alle Konten sehen den Aushang, auch Stationen. Er hängt bis zum Datum oder bis du ihn abnimmst.',
    fester_hinweis: 'Nur für Dienstliches. Nicht vertraulich — Absender ist immer sichtbar, und wer den Generalschlüssel hat, kann technisch alles lesen. Kritik trägt immer den Namen; anonym geht hier nichts.',
    senden: 'Senden', verwerfen: 'Verwerfen', crumble_wieder: 'Beispiel-Nachricht wieder zeigen',
    typ_nachricht: 'Nachricht', typ_info: 'Info', typ_lob: 'Lob', typ_kritik: 'Kritik', typ_bekanntmachung: 'Aushang',
    wer: '{name} · {art}', art_person: 'persönliches Konto', art_ort: 'Ort-Konto', art_system: 'Systemkonto', art_ohne: 'Konto ohne Art',
    z_gesperrt: 'Noch nicht freigeschaltet — Nachrichten siehst du, sobald dein Konto aktiv ist.',
    z_station: 'Dieses Gerät bekommt keine Nachrichten. Aushänge siehst du hier trotzdem.',
    z_system: 'Systemkonto — keine Nachrichten. Aushänge siehst du hier trotzdem.',
    z_ohne_art: 'Bei deinem Konto ist noch nicht eingetragen, ob es ein persönliches Konto oder ein Ort ist — Nachrichten bekommst du erst danach (der Admin trägt es in der Kontenverwaltung ein). Aushänge siehst du hier trotzdem.',
    z_ohne_konto: 'Zu deiner Anmeldung gibt es kein Konto in BäckereiOS — keine Nachrichten.',
    regel_flach: 'Hinweis: In der Datenbank ist die Ersatz-Fassung der Regeln eingesetzt ({fassung}). Alles geht wie gewohnt; Daumen und Kritik prüft die Datenbank etwas strenger.',
    regel_unbekannt: 'Welche Regeln in der Datenbank eingesetzt sind, ließ sich gerade nicht prüfen ({grund}). Die Seite lädt trotzdem.',
    regel_alt: 'Die Firestore-Regeln sind älter als diese Seite — in der Firebase-Konsole {datei} einsetzen. Bis dahin lehnt die Datenbank alles hier ab.',
    name_kennung: 'Dein Name erscheint als {name} — dein Eintrag im Adressbuch fehlt noch (der Admin gleicht in der Kontenverwaltung ab).',
    name_ok: 'Absender: {name}',
    leer_postfach: 'Keine Nachrichten.', leer_postfach_aus: 'Alles ausgeblendet — „ausgeblendete zeigen“ holt sie zurück.',
    leer_aushaenge: 'Gerade hängt kein Aushang.', leer_gesendet: 'Du hast noch nichts gesendet.',
    neu: 'neu', neue_antwort: '{n} neue Antwort', neue_antworten: '{n} neue Antworten', antworten_n: '💬 {n}', daumen_n: '👍 {n}',
    an_liste: 'an: {namen}', an_kurz: 'an {erste} und {n} weitere', von: 'von {name}',
    heute: 'heute {uhr}', gestern: 'gestern {uhr}', datum_uhr: '{tag} {uhr}', eben: 'eben',
    korrigiert_hier: 'korrigiert', korrigiert_nicht_an_dich: 'korrigiert — die neue Fassung ging nicht an dich',
    korrigiert_nicht_hier: 'korrigiert — die neue Fassung steht nicht in dieser Liste',
    ersetzt_von: 'ersetzt Nachricht von {zeit} ▸', ersetzt_unbekannt: 'ersetzt eine frühere Fassung ▸', ersetzt_zu: '▾ frühere Fassungen',
    glied_zu: 'Eine frühere Fassung ist für dich nicht lesbar — sie ging nicht an dich oder ist nach 40 Tagen schon gelöscht.', glied_weg: 'Eine frühere Fassung ist nicht mehr da (nach 40 Tagen gelöscht).',
    glied_laden: 'frühere Fassung wird geladen …', glied_antworten: 'Antworten dieser Fassung zeigen',
    gilt_bis: 'gilt bis {datum}', abgelaufen: 'abgelaufen — abnehmen?', abgenommen: 'abgenommen',
    kenne_ich: 'Kenne ich ✓', kenne_ich_ok: '✓ gelesen', drucken: '🖨 Als Aushang drucken', abnehmen: 'Aushang abnehmen',
    alten_abnehmen: 'Alten Aushang abnehmen', zweiter_schritt: 'Die Korrektur ist da, aber der alte Aushang hängt noch — er ließ sich nicht abnehmen. Knopf „Alten Aushang abnehmen“ versucht es noch einmal.',
    ausblenden: 'Für mich ausblenden', einblenden: 'Wieder einblenden', korrektur: 'Korrektur',
    daumen_geben: '👍 Daumen', daumen_weg: '👍 Daumen zurücknehmen', daumen_keiner: 'Noch kein Daumen.',
    antworten_titel: 'Antworten', antworten_keine: 'Noch keine Antworten.', antworten_laden: 'Antworten werden geladen …',
    an_dich: 'an dich', an_name: 'an {name}', antwort_an: 'Antwort an {name}', antwort_an_wahl: 'Antwort an',
    antwort_schicken: 'Antwort senden', antwort_e18: 'Antworten lassen sich nicht ändern — wer sich vertan hat, schreibt eine weitere.',
    antworten_name: '{name} antworten', antwort_aushang: 'Aushänge haben keine Antworten.', antwort_gesperrt: 'Diese Fassung ist korrigiert — Antworten unter der neuen.',
    a7_satz: 'Antworten an dich können gerade nicht geladen werden — Kontroll-Chat Bescheid geben. Deine eigenen Antworten stehen trotzdem da.',
    korrektur_satz: 'Korrektur zu deiner Nachricht von {zeit} — die alte wird durchgestrichen und gesperrt. Die Art bleibt gleich.',
    korrektur_abbrechen: 'Korrektur abbrechen',
    empf_zaehler: '{n} von {max}', typ_aushang_kein_haken: 'Aushänge darf nur schreiben, wer den Haken „Bekanntmachungen“ hat.',
    kritik_leitung: 'Kritik geht an die Leitung. Einzelne kannst du abwählen, einer bleibt immer.',
    kritik_leitung_letzter: 'Einer aus der Leitung muss bleiben.',
    leitung_leer: 'Gerade ist niemand als Leitung eingetragen — dem Admin Bescheid geben.',
    text_zaehler: '{n} / {max}', sendet: 'Wird gesendet …', gesendet_ok: '✓ gesendet',
    f_kein_haken: 'Neue Nachrichten anfangen darf, wer den Haken dafür hat — den setzt der Admin in der Kontenverwaltung.',
    f_kein_haken_aushang: 'Aushänge darf nur schreiben, wer den Haken „Bekanntmachungen“ hat.', f_typ: 'Bitte eine Art wählen.',
    f_text_leer: 'Der Text ist leer.', f_text_lang: 'Der Text ist zu lang (höchstens {max} Zeichen).',
    f_giltbis_form: 'Bitte ein Datum bei „gilt bis“ wählen.', f_giltbis_vorbei: '„Gilt bis“ liegt in der Vergangenheit.',
    f_empfaenger_leer: 'Bitte mindestens einen Empfänger wählen.', f_empfaenger_viele: 'Zu viele Empfänger (höchstens {max}).',
    f_ich_empfaenger: 'Dich selbst brauchst du nicht anzuschreiben.', f_leitung_leer: 'Gerade ist niemand als Leitung eingetragen — dem Admin Bescheid geben.',
    f_kritik_nicht_leitung: 'Kritik geht nur an die Leitung.', f_an: 'Bitte wählen, an wen die Antwort geht.',
    f_aushang: 'Aushänge haben keine Antworten.', f_gesperrt: 'Diese Fassung ist korrigiert — bitte unter der neuen antworten.',
    f_kein_empfaenger: 'Von diesem Konto aus geht keine Antwort (Konto bekommt keine Nachrichten).',
    fehler_mit: '{meldung}\n({original})', fehler_unbehandelt: 'Unerwarteter Fehler auf der Seite',
    fehler_laden: 'Laden fehlgeschlagen: {liste}', liste_postfach: 'Postfach', liste_aushaenge: 'Aushänge', liste_gesendet: 'Gesendet',
    liste_status: 'Lese-Merker', liste_adressbuch: 'Adressbuch', liste_vorlagen: 'Gruppen', liste_antworten_gesendet: 'Antworten auf Gesendetes', liste_konto: 'dein Konto',
    crumble_name: 'Crumble', crumble_vorschau: 'Moin. Ich bin Crumble — kurz, wie das hier geht.',
    crumble_text: 'Moin. Ich bin Crumble, der Hamster von deinem Schreibtisch. Das hier ist dein Postfach — für Dienstliches: „Wer kann Samstag?“, „Kisten bitte in den Hof“, „Danke fürs Einspringen“.\n' +
      'Ein paar Dinge vorweg. Nichts hier ist vertraulich: Der Absender steht immer dran, und wer den Generalschlüssel hat, kann technisch alles lesen. Anonym geht hier nichts — was du schreibst, trägt deinen Namen.\n' +
      'Unter jeder Nachricht kannst du antworten — die Antwort geht nur an den, der geschrieben hat. Steht an der Nachricht „👥 offen“, lesen alle Empfänger die Antworten mit. Ein Daumen sagt „gesehen, passt“ und sieht jeder Empfänger. Ausblenden räumt dein Postfach auf, sonst niemandem — mit „ausgeblendete zeigen“ holst du alles zurück. Wer sich vertippt hat, drückt Korrektur: Die alte Fassung bleibt durchgestrichen stehen, die neue kommt oben drauf. In offenen Gesprächen schreibt der Absender stattdessen einen Nachtrag.\n' +
      'Neue Nachrichten anfangen darf, wer den Haken dafür hat — den setzt der Admin in der Kontenverwaltung. Antworten darf jeder. Aushänge sieht jeder, auch die Stationen; sie hängen bis zum Datum oder bis jemand sie abnimmt.\n' +
      'Alles hier verschwindet nach 40 Tagen von selbst. Eine Benachrichtigung aufs Handy gibt es noch nicht — die kommt in einer späteren Stufe, dann steht hier, wie du sie einschaltest.\n' +
      'Bis dahin: einmal am Tag reinschauen reicht. — Crumble',
    druck_kopf: 'Bekanntmachung · Aushang', druck_von: 'von', druck_gilt: 'gilt bis', druck_fuss: 'Aus der Nachrichtenzentrale gedruckt. Der Aushang selbst nimmt keine Antworten an.',
    druck_titel: 'Bekanntmachung', druck_app: 'Nachrichten',
    wochentag: 'So,Mo,Di,Mi,Do,Fr,Sa',
    /* Stufe 1d */
    offen_kaestchen: 'Antworten sehen alle Empfänger', offen_satz: 'Gut für Fragen an eine Gruppe — so sieht jeder, wer schon geantwortet hat.',
    offen_korrektur: 'Bleibt wie beim Original.', offen_marke: '👥 offen', offen_antwort_satz: 'Deine Antwort sehen alle Empfänger.',
    offen_rueckweg: 'Die Antworten der anderen Empfänger lassen sich gerade nicht laden — du siehst nur deine eigenen und die an dich. Kontroll-Chat Bescheid geben.',
    nachtrag: 'Nachtrag', nachtrag_marke: 'Nachtrag', nachtrag_zeile: 'Nachtrag {zeit}:', nachtrag_titel: 'Nachtrag schreiben',
    nachtrag_senden: 'Nachtrag senden', nachtrag_abbrechen: 'Abbrechen',
    nachtrag_satz: 'Der Text oben bleibt, wie er ist. Der Nachtrag steht hervorgehoben darunter und macht die Nachricht für alle Empfänger wieder „neu“.',
    nachtrag_dazu: 'Empfänger hinzufügen (freiwillig)', nachtrag_dazu_satz: 'Neue Empfänger sehen das bisherige Gespräch.', nachtrag_schon: 'schon dabei',
    nachtrag_voll: 'Höchstens {max} Nachträge — mehr geht hier nicht.',
    f_nicht_absender: 'Einen Nachtrag schreibt nur, wer die Nachricht geschickt hat.', f_nicht_offen: 'Nachträge gibt es nur bei offenen Gesprächen — sonst „Korrektur“.',
    f_nachtraege_voll: 'Höchstens {max} Nachträge.', f_kritik_offen: 'Kritik ist nie offen — Antworten auf Kritik sieht nur der Absender.',
    f_aushang_offen: 'Aushänge haben keine Antworten.', f_korrektur_offen: 'Eine Korrektur übernimmt die Einstellung des Originals.',
    f_offen_regel_alt: 'Die eingesetzten Regeln kennen „Antworten sehen alle Empfänger“ noch nicht — bitte das Kästchen aus.',
    rueckweg_zahl: 'Die Zahl an der Kachel und „💬“ in Gesendet laufen gerade über den alten Weg (nur Antworten auf deine 20 neuesten gesendeten Nachrichten; wenn dir ein Absender zurückschreibt, zählt das nicht). Grund: {hinweis}',
    regel_alt_offen: 'Hinweis: In der Datenbank sind die Regeln vom 27.10. eingesetzt ({fassung}). Alles geht wie gewohnt — nur „Antworten sehen alle Empfänger“ und Nachträge gibt es erst mit {datei}.',
    rueckweg_erklaert: 'Darum laufen die Zahl an der Kachel und „💬“ in Gesendet über den alten Weg (nur Antworten auf deine 20 neuesten gesendeten Nachrichten; wenn dir ein Absender zurückschreibt, zählt das nicht). ({original})',
    nachtrag_kein_haken: 'Nachträge braucht den Haken „Nachrichten schreiben“ — den setzt der Admin in der Kontenverwaltung.',
    f_kein_haken_nachtrag: 'Nachträge schreibt nur, wer den Haken „Nachrichten schreiben“ hat — den setzt der Admin in der Kontenverwaltung.'
  };
  function t(k, p) {
    var s = Object.prototype.hasOwnProperty.call(I18N_DE, k) ? I18N_DE[k] : k;
    if (p) Object.keys(p).forEach(function (x) { s = s.split('{' + x + '}').join(String(p[x])); });
    return s;
  }

  /* ---------- Zustand ---------- */
  var S = {
    db: null, z: null, ich: null, regel: null, adressbuch: {}, vorlagen: [], leitung: [], name: function (k) { return k; },
    postfach: [], aushaenge: [], gesendet: [], antwortenJe: {}, koepfe: {}, antwortenWeg: null, nachtragForm: null, status: { gelesen: {}, ausgeblendet: {} },
    bekannt: {}, reiter: 'postfach', zeigeAus: { postfach: false, gesendet: false }, offen: null, antworten: {}, kettenOffen: {},
    entwurf: null, sendet: false, ladeFehler: [], geladen: false, zweiterSchritt: null
  };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, attrs, kinder) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (k === 'hidden') e.hidden = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kinder || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function zeit(z) {
    var ms = L.ms(z);
    if (ms === null) return t('eben');
    var d = new Date(ms), uhr = zwei(d.getHours()) + ':' + zwei(d.getMinutes());
    var tag = L.heute(d), h = L.heute();
    if (tag === h) return t('heute', { uhr: uhr });
    if (tag === L.plusTage(h, -1)) return t('gestern', { uhr: uhr });
    return t('datum_uhr', { tag: t('wochentag').split(',')[d.getDay()] + ' ' + zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.', uhr: uhr });
  }
  function datumLang(tag) {
    if (!L.istTag(tag)) return String(tag || '');
    var p = tag.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2], 12);
    return t('wochentag').split(',')[d.getDay()] + ' ' + zwei(p[2]) + '.' + zwei(p[1]) + '.' + p[0];
  }
  function ersteZeile(s) { var x = String(s || '').split('\n').filter(function (z) { return z.trim(); })[0] || ''; return x.length > 140 ? x.slice(0, 140) + '…' : x; }
  function hat(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  /* ---------- Fehler (Checkliste §7a) ---------- */
  function zeigeFehler(meldung, err) {
    var original = err ? ((err.code ? err.code + ' — ' : '') + (err.message || String(err))) : '';
    if (err) console.error('[Nachrichten] ' + meldung, err);
    var box = $('fehlerZeile'), ziel = $('fehlerText');
    if (!box || !ziel) return;
    var text = original && meldung.indexOf(original) === -1 ? t('fehler_mit', { meldung: meldung, original: original }) : meldung;
    if (!box.hidden && ziel.textContent && ziel.textContent.indexOf(text) === -1) text = ziel.textContent + '\n\n' + text;
    else if (!box.hidden && ziel.textContent.indexOf(text) !== -1) text = ziel.textContent;
    setzeMitLinks(ziel, text);
    box.hidden = false;
  }
  /* Links in der Meldung klickbar (failed-precondition bringt den Index-Link mit) — ohne innerHTML. */
  function setzeMitLinks(ziel, text) {
    ziel.textContent = '';
    String(text).split(/(https:\/\/[^\s)]+)/).forEach(function (teil, i) {
      if (i % 2 === 1) ziel.appendChild(el('a', { href: teil, target: '_blank', rel: 'noopener', text: teil }));
      else if (teil) ziel.appendChild(document.createTextNode(teil));
    });
  }
  function fehlerAusErklaerung(e) { return e.meldung ? t('fehler_mit', { meldung: e.meldung, original: e.original }) : e.original; }
  function erklaereUndZeige(err, kontext, ziel) {
    console.error('[Nachrichten] ' + (kontext.art || ''), err);
    return L.erklaere(S.db, err, Object.assign({ z: S.z }, kontext)).then(function (e) {
      var text = fehlerAusErklaerung(e);
      if (ziel) { setzeMitLinks(ziel, text); ziel.hidden = false; }
      else zeigeFehler(text);
      return e;
    }, function (e2) { var text = (err && err.message) || String(err); if (ziel) { ziel.textContent = text; ziel.hidden = false; } else zeigeFehler(text, err); console.error(e2); });
  }
  window.onerror = function (msg, quelle, zeile, spalte, err) {
    zeigeFehler(t('fehler_unbehandelt') + ': ' + msg + (quelle ? ' (' + String(quelle).split('/').pop() + ':' + zeile + ')' : ''), err || null);
  };
  window.addEventListener('unhandledrejection', function (ev) { zeigeFehler(t('fehler_unbehandelt'), ev.reason); });

  /* ---------- Zahl an der Kachel ---------- */
  function meldeZahl() {
    if (!S.z || !S.z.voll) { Z.melde(0); return 0; }
    var n = L.zahlAus({ ich: S.ich.kennung, postfach: S.postfach, aushaenge: S.aushaenge, gesendet: S.gesendet, koepfe: S.koepfe, antwortenJe: S.antwortenJe, status: S.status, heute: L.heute() });
    Z.melde(n);
    return n;
  }
  function setzeStatus(aenderung) {
    if (!L.statusAendertEtwas(S.status, aenderung)) return Promise.resolve(false);
    return L.statusSetzen(S.db, S.ich.kennung, aenderung).then(function (r) {
      S.status = r.status; meldeZahl(); return r.geschrieben;
    }, function (err) { erklaereUndZeige(err, { art: 'status' }); return false; });
  }

  /* ---------- Laden ---------- */
  function bekanntNeu() {
    var b = {};
    [S.postfach, S.aushaenge, S.gesendet].forEach(function (l) { (l || []).forEach(function (m) { b[m.id] = m; }); });
    Object.keys(S.bekannt).forEach(function (id) { if (!b[id] && S.bekannt[id] && S.bekannt[id].__glied) b[id] = S.bekannt[id]; });
    S.bekannt = b;
  }
  function versuche(name, p) { return p.then(function (x) { return { ok: true, x: x }; }, function (err) { return { ok: false, err: err, name: name }; }); }
  function ladeListen() {
    S.ladeFehler = [];
    var k = S.ich.kennung, db = S.db;
    var teile = [
      versuche('liste_status', L.ladeStatus(db, k)),
      versuche('liste_aushaenge', L.ladeAushaenge(db))
    ];
    if (S.z.voll) {
      teile.push(versuche('liste_postfach', L.ladePostfach(db, k)));
      teile.push(versuche('liste_gesendet', L.ladeGesendet(db, k)));
    }
    return Promise.all(teile).then(function (r) {
      if (r[0].ok) S.status = r[0].x; else S.ladeFehler.push(r[0]);
      if (r[1].ok) S.aushaenge = r[1].x; else S.ladeFehler.push(r[1]);
      if (S.z.voll) {
        if (r[2].ok) S.postfach = r[2].x; else S.ladeFehler.push(r[2]);
        if (r[3].ok) S.gesendet = r[3].x; else S.ladeFehler.push(r[3]);
        return versuche('liste_antworten_gesendet', L.ladeAntwortenAnMich(db, k, { postfach: S.postfach, gesendet: S.gesendet, status: S.status })).then(function (a) {
          if (!a.ok) { S.ladeFehler.push(a); return; }
          S.antwortenJe = a.x.je; S.koepfe = a.x.koepfe; S.antwortenWeg = a.x.weg;
          /* A3: Rückweg nie stumm — Grund (welcher Index/welche Regel) in der Fehlerzeile, mit Code und Link */
          if (a.x.rueckweg) zeigeRueckweg(a.x.rueckweg);
        });
      }
    }).then(function () {
      bekanntNeu();
      return Promise.all(S.ladeFehler.map(function (f) {
        return L.erklaere(db, f.err, { art: 'lesen', z: S.z }).then(function (e) {
          console.error('[Nachrichten] ' + t(f.name), f.err);
          zeigeFehler(t('fehler_laden', { liste: t(f.name) }) + '\n' + fehlerAusErklaerung(e));
        });
      }));
    }).then(function () { S.geladen = true; meldeZahl(); zeichneAlles(); });
  }
  function start() {
    wendeI18nAn();
    bindeEreignisse();
    if (!L || !Z) { zeigeFehler('nachrichten_logik.js oder bos_nachrichten_zahl.js nicht geladen.'); return; }
    try { S.db = window.db || null; if (!S.db) throw Object.assign(new Error('Datenbank nicht geladen (bos_firebase_config.js fehlt?)'), { code: 'nicht_geladen' }); }
    catch (e) { $('ladenZeile').hidden = true; zeigeFehler(e.message, e); return; }
    L.wer(S.db).then(function (z) {
      S.z = z;
      if (z.zustand === 'gesperrt' || z.zustand === 'ohne_konto') {
        $('ladenZeile').hidden = true; zustandSatz('z_' + z.zustand); Z.melde(0); $('werZeile').textContent = z.kennung; return null;
      }
      var regel = L.pruefeRegelstand(S.db).then(function (r) { S.regel = r; zeigeRegel(r); }, function () {});
      var nebenbei = Promise.all([
        versuche('liste_adressbuch', L.ladeAdressbuch(S.db)),
        z.voll ? versuche('liste_vorlagen', L.ladeVorlagen(S.db)) : Promise.resolve({ ok: true, x: [] }),
        window.BOS_NAMEN ? window.BOS_NAMEN.laden(S.db) : Promise.resolve(null)
      ]).then(function (r) {
        if (r[0].ok) S.adressbuch = r[0].x; else S.ladeFehler.push(r[0]);
        if (r[1].ok) { S.vorlagen = r[1].x; var lv = r[1].x.filter(function (v) { return v.id === 'leitung'; })[0]; S.leitung = lv ? (lv.kennungen || []).slice() : []; }
        else S.ladeFehler.push(r[1]);
        var nm = window.BOS_NAMEN || null;
        S.name = L.namenAus(S.adressbuch, nm);
        var en = L.eigenerName(S.adressbuch, nm, z.kennung);
        S.ich = { kennung: z.kennung, name: en.name, nameQuelle: en.quelle };
        var fl = S.ladeFehler.slice();
        fl.forEach(function (f) { erklaereUndZeige(f.err, { art: 'lesen' }); });
      });
      return Promise.all([regel, nebenbei]).then(function () {
        $('werZeile').textContent = t('wer', { name: S.ich.name, art: t(z.art === 'person' ? 'art_person' : z.art === 'ort' ? 'art_ort' : z.art === 'system' ? 'art_system' : 'art_ohne') });
        if (z.nurAushaenge) zustandSatz('z_' + z.zustand);
        richteReiterEin();
        return ladeListen();
      });
    }).catch(function (err) {
      $('ladenZeile').hidden = true;
      erklaereUndZeige(err, { art: 'lesen' });
    });
  }
  function zeigeRegel(r) {
    var h = $('hinweisZeile');
    if (r.stand === 'passt' && r.art === 'offen') { h.hidden = true; return; }
    if (r.stand === 'passt' && r.art === 'haupt') { h.textContent = t('regel_alt_offen', { fassung: r.fassung, datei: L.REGEL_DATEI }); h.hidden = false; return; }
    if (r.stand === 'passt') { h.textContent = t('regel_flach', { fassung: r.fassung }); h.hidden = false; return; }
    if (r.stand === 'alt') { zeigeFehler(t('regel_alt', { datei: L.REGEL_DATEI })); return; }
    h.textContent = t('regel_unbekannt', { grund: r.fehler ? ((r.fehler.code ? r.fehler.code + ' — ' : '') + r.fehler.message) : '—' }); h.hidden = false;
  }
  /* N2 (KC 27.10. 19:52, Antwort auf K-e): Rückweg auf die 1c-Zählung. ERKLÄRT ist er nur, wenn die Seite die Regel vom
     27.10. erkannt hat (Fassung ohne „offen“) und der Sammelpfad mit permission-denied abgelehnt wurde — dann gelber
     Hinweis mit dem Code in Klammern (die echte Meldung bleibt sichtbar), keine rote Zeile. Alles andere ist unerwartet
     und steht rot mit err.message (Index fehlt, Netz, andere Codes, neue Fassung erkannt und trotzdem abgelehnt). */
  function rueckwegErklaert(rw) {
    return !!(S.regel && S.regel.stand === 'passt' && S.regel.offen !== true && rw && rw.grund && rw.grund.code === 'permission-denied');
  }
  function zeigeRueckweg(rw) {
    /* console.error kommt schon aus BOS_NACHRICHTEN_ZAHL.ladeAntwortenAnMich (A3) */
    if (!rueckwegErklaert(rw)) { zeigeFehler(t('rueckweg_zahl', { hinweis: rw.hinweis }), rw.grund); return; }
    zeigeRegel(S.regel);
    var h = $('hinweisZeile');
    var original = (rw.grund.code ? rw.grund.code + ' — ' : '') + (rw.grund.message || String(rw.grund));
    h.textContent = (h.hidden ? '' : h.textContent + '\n') + t('rueckweg_erklaert', { original: original });
    h.hidden = false;
  }
  function zustandSatz(k) { var s = $('zustandSatz'); s.textContent = t(k); s.hidden = false; }

  /* ---------- Reiter ---------- */
  function richteReiterEin() {
    var r = $('reiter'); r.hidden = false;
    Array.prototype.forEach.call(r.querySelectorAll('.tab-btn'), function (b) {
      var id = b.getAttribute('data-reiter');
      var sichtbar = S.z.voll ? (id !== 'schreiben' || S.z.schreiben) : id === 'aushaenge';
      b.hidden = !sichtbar;
    });
    S.reiter = S.z.voll ? 'postfach' : 'aushaenge';
  }
  function zeigeReiter(id) {
    S.reiter = id; S.offen = null;
    $('detail').hidden = true;
    ['postfach', 'aushaenge', 'gesendet', 'schreiben'].forEach(function (p) { $('panel-' + p).hidden = p !== id; });
    Array.prototype.forEach.call($('reiter').querySelectorAll('.tab-btn'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-reiter') === id ? 'true' : 'false'); });
    if (id === 'schreiben') zeichneSchreiben();
    try { window.scrollTo(0, 0); } catch (e) { /* nichts */ }
  }
  function setzeTabZahl(id, n) {
    var b = $('reiter').querySelector('.tab-btn[data-reiter="' + id + '"] .tab-zahl');
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n;
  }
  function zeichneAlles() {
    $('ladenZeile').hidden = true;
    if (!S.z) return;
    zeichnePostfach(); zeichneAushaenge(); zeichneGesendet();
    if (S.offen) zeichneDetail(); else zeigeReiter(S.reiter);
  }

  /* ---------- Karten ---------- */
  function symbol(name, crumble) {
    var s = el('span', { class: 'symbol', 'aria-hidden': 'true' });
    if (crumble) {
      var img = el('img', { src: '../hamster_figur/bilder/wave.png', alt: '' });
      img.addEventListener('error', function () { s.textContent = 'C'; });
      s.appendChild(img);
    } else s.textContent = (String(name || '?').trim()[0] || '?').toUpperCase();
    return s;
  }
  function typWort(typ) { return el('span', { class: 'typ-wort', text: t('typ_' + typ) }); }
  function empfaengerKurz(m) {
    var l = (m.empfaenger || []).map(function (k) { return S.name(k); });
    if (l.length <= 3) return t('an_liste', { namen: l.join(', ') });
    return t('an_kurz', { erste: l.slice(0, 2).join(', '), n: l.length - 2 });
  }
  function karte(e, art) {
    var m = e.m, gesp = L.gesperrt(m);
    var name = art === 'gesendet' ? empfaengerKurz(m) : S.name(m.von, m.vonName);
    var fuss = [];
    if (e.neu) fuss.push(el('span', { class: 'marke-neu', text: t('neu') }));
    if (e.nachtragNeu) fuss.push(el('span', { class: 'marke-neu marke-nachtrag', text: t('nachtrag_marke') }));
    if (e.neueAntworten) fuss.push(el('span', { class: 'marke-neu', text: t(e.neueAntworten === 1 ? 'neue_antwort' : 'neue_antworten', { n: e.neueAntworten }) }));
    if (e.offen) fuss.push(el('span', { class: 'marke-offen', text: t('offen_marke') }));
    if (m.daumen && m.daumen.length) fuss.push(el('span', { text: t('daumen_n', { n: m.daumen.length }) }));
    if (art === 'gesendet' && typeof e.antworten === 'number' && e.antworten) fuss.push(el('span', { text: t('antworten_n', { n: e.antworten }) }));
    if (gesp) fuss.push(el('span', { class: 'marke-korr', text: art === 'postfach' ? t('korrigiert_nicht_an_dich') : t('korrigiert_nicht_hier') }));
    else if (m.ersetzt) fuss.push(el('span', { class: 'marke-korr', text: t('korrigiert_hier') }));
    return el('button', { type: 'button', class: 'karte typ-' + m.typ + (e.neu || e.neueAntworten ? ' neu' : '') + (e.ausgeblendet ? ' ausgeblendet' : ''), 'data-id': m.id,
      onclick: function () { oeffne(m.id, art); } }, [
      symbol(art === 'gesendet' ? S.ich.name : name),
      el('span', { class: 'karte-mitte' }, [
        el('span', { class: 'karte-kopf' }, [typWort(m.typ), el('span', { class: 'absender', text: name }), el('span', { class: 'zeit', text: zeit(m.erstellt) })]),
        el('span', { class: 'karte-text' + (gesp ? ' durch' : ''), text: ersteZeile(m.text) }),
        fuss.length ? el('span', { class: 'karte-fuss' }, fuss) : null
      ])
    ]);
  }
  function crumbleKarte() {
    return el('button', { type: 'button', class: 'karte typ-info', 'data-id': L.CRUMBLE, onclick: function () { oeffne(L.CRUMBLE, 'postfach'); } }, [
      symbol('C', true),
      el('span', { class: 'karte-mitte' }, [
        el('span', { class: 'karte-kopf' }, [typWort('info'), el('span', { class: 'absender', text: t('crumble_name') })]),
        el('span', { class: 'karte-text', text: t('crumble_vorschau') })
      ])
    ]);
  }
  function crumbleSichtbar() { return !hat(S.status.ausgeblendet, L.CRUMBLE); }
  function zeichnePostfach() {
    if (!S.z.voll) return;
    var ziel = $('listePostfach'); ziel.textContent = '';
    var l = L.postfachSicht(S.postfach, S.status, S.ich.kennung, { zeigeAusgeblendete: S.zeigeAus.postfach, antwortenJe: S.antwortenJe });
    if (crumbleSichtbar()) ziel.appendChild(crumbleKarte());
    l.forEach(function (e) { ziel.appendChild(karte(e, 'postfach')); });
    if (!l.length && !crumbleSichtbar()) ziel.appendChild(el('p', { class: 'leer', text: t(S.postfach.length ? 'leer_postfach_aus' : 'leer_postfach') }));
    setzeTabZahl('postfach', l.filter(function (e) { return e.neu || e.neueAntworten; }).length);
    $('alleGelesenBtn').disabled = !l.some(function (e) { return !e.neu && !e.ausgeblendet; });
  }
  function zeichneGesendet() {
    if (!S.z.voll) return;
    var ziel = $('listeGesendet'); ziel.textContent = '';
    var l = L.gesendetSicht(S.gesendet, S.status, S.ich.kennung, S.antwortenJe, { zeigeAusgeblendete: S.zeigeAus.gesendet, alleGezaehlt: S.antwortenWeg === 'sammelpfad' });
    l.forEach(function (e) { ziel.appendChild(karte(e, 'gesendet')); });
    if (!l.length) ziel.appendChild(el('p', { class: 'leer', text: t('leer_gesendet') }));
    setzeTabZahl('gesendet', l.reduce(function (s, e) { return s + (e.neueAntworten || 0); }, 0));
  }

  /* ---------- Aushänge (ganzer Text in der Liste, Knöpfe direkt am Aushang) ---------- */
  function aushangKarte(e, alsGlied) {
    var m = e.m, r = L.rechte(m, S.z), gelesen = hat(S.status.gelesen, m.id) || m.von === S.ich.kennung;
    var kn = [];
    if (!alsGlied) {
      kn.push(gelesen ? el('span', { class: 'erledigt', text: t('kenne_ich_ok') })
        : el('button', { type: 'button', class: 'klein-btn', text: t('kenne_ich'), onclick: function (ev) { ev.target.disabled = true; setzeStatus({ gelesen: [m.id] }).then(zeichneAushaenge); } }));
      kn.push(el('button', { type: 'button', class: 'klein-btn', text: t('drucken'), onclick: function () { drucke(m); } }));
    }
    if (r.abnehmen) kn.push(el('button', { type: 'button', class: 'klein-btn', text: alsGlied ? t('alten_abnehmen') : t('abnehmen'), onclick: function (ev) { abnehmen(m, ev.target); } }));
    if (!alsGlied && r.korrektur) kn.push(el('button', { type: 'button', class: 'klein-btn', text: t('korrektur'), onclick: function () { starteKorrektur(m); } }));
    var kette = null;
    if (!alsGlied && m.ersetzt) {
      var alt = S.bekannt[m.ersetzt];
      if (alt && L.gesperrt(alt) && !hat(alt, 'fristStart')) kette = el('div', { class: 'kette' }, [el('p', { class: 'satz', text: t('zweiter_schritt') }), aushangKarte({ m: alt }, true)]);
    }
    return el('article', { class: 'aushang' + (e.neu ? ' neu' : ''), 'data-id': m.id }, [
      el('div', { class: 'karte-kopf' }, [typWort('bekanntmachung'), el('span', { class: 'absender', text: S.name(m.von, m.vonName) }), el('span', { class: 'zeit', text: zeit(m.erstellt) }),
        e.neu ? el('span', { class: 'marke-neu', text: t('neu') }) : null]),
      el('div', { class: 'aushang-text' + (alsGlied ? ' durch' : ''), text: m.text }),
      el('div', { class: 'aushang-zeile' }, [t('gilt_bis', { datum: datumLang(m.giltBis) }), e.abgelaufen ? ' · ' : '', e.abgelaufen ? el('span', { class: 'abgelaufen', text: t('abgelaufen') }) : null]),
      kn.length ? el('div', { class: 'knoepfe' }, kn) : null,
      kette
    ]);
  }
  function zeichneAushaenge() {
    var ziel = $('listeAushaenge'); ziel.textContent = '';
    var l = L.aushaengeSicht(S.aushaenge, S.status, S.z, L.heute());
    l.forEach(function (e) { ziel.appendChild(aushangKarte(e)); });
    if (!l.length) ziel.appendChild(el('p', { class: 'leer', text: t('leer_aushaenge') }));
    setzeTabZahl('aushaenge', l.filter(function (e) { return e.neu; }).length);
  }
  function drucke(m) {
    if (!window.BOS_DRUCK) { zeigeFehler('bos_druck.js nicht geladen — Drucken geht gerade nicht.'); return; }
    var html = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:9pt;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:3mm">' + esc(t('druck_kopf')) + '</div>' +
      '<div style="font-size:22pt;line-height:1.35;font-weight:600;white-space:pre-wrap;margin-bottom:10mm">' + esc(m.text) + '</div>' +
      '<table style="font-size:11pt;border-top:1px solid #ddd;width:100%"><tr><td style="padding:3mm 0;color:#666;width:22mm">' + esc(t('druck_von')) + '</td><td style="padding:3mm 0"><b>' +
      esc(S.name(m.von, m.vonName)) + '</b> · ' + esc(zeitLang(m.erstellt)) + '</td></tr><tr><td style="padding:3mm 0;color:#666">' + esc(t('druck_gilt')) + '</td><td style="padding:3mm 0"><b>' +
      esc(datumLang(m.giltBis)) + '</b></td></tr></table>' +
      '<div style="margin-top:8mm;font-size:9pt;color:#888">' + esc(t('druck_fuss')) + '</div>';
    try { window.BOS_DRUCK.drucken({ inhaltHTML: html, appName: t('druck_app'), titel: t('druck_titel') }); }
    catch (err) { zeigeFehler('Drucken fehlgeschlagen', err); }
  }
  function zeitLang(z) {
    var ms = L.ms(z); if (ms === null) return '';
    var d = new Date(ms);
    return datumLang(L.heute(d)) + ', ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes()) + ' Uhr';
  }
  function abnehmen(m, knopf) {
    if (knopf) knopf.disabled = true;
    L.aushangAbnehmen(S.db, m.id).then(function () { return ladeListen(); }, function (err) {
      if (knopf) knopf.disabled = false; erklaereUndZeige(err, { art: 'abnehmen' });
    });
  }

  /* ---------- Detail ---------- */
  function oeffne(id, quelle) {
    S.offen = { id: id, quelle: quelle };
    zeichneDetail();
    if (id === L.CRUMBLE) return;
    var m = S.bekannt[id];
    if (!m) return;
    ladeAntwortenFuer(m).then(function () { markiereGelesen(m); });
  }
  function markiereGelesen(m) {
    var ids = [];
    if (m.von !== S.ich.kennung) ids = ids.concat(L.leseSchluessel(m));   // K28: id und id#<Anzahl Nachträge>
    var a = S.antworten[m.id];
    if (a && a.liste) a.liste.forEach(function (x) { if (x.von !== S.ich.kennung) ids.push(x.id); });
    return setzeStatus({ gelesen: ids }).then(function () { zeichnePostfach(); zeichneGesendet(); });
  }
  function ladeAntwortenFuer(m) {
    if (m.typ === 'bekanntmachung') return Promise.resolve();
    S.antworten[m.id] = { laedt: true, liste: (S.antworten[m.id] && S.antworten[m.id].liste) || null };
    if (S.offen && S.offen.id === m.id) zeichneAntworten(m);
    return L.ladeAntworten(S.db, m, S.ich.kennung).then(function (r) {
      S.antworten[m.id] = { liste: r.liste, warnung: r.warnung };
      /* G-Stand nachziehen: im Sammelpfad-Weg nur Antworten an mich (wie G), im 1c-Rückweg alle Antworten meiner gesendeten */
      if (!L.gesperrt(m)) {
        if (S.antwortenWeg === 'sammelpfad') S.antwortenJe[m.id] = r.liste.filter(function (a) { return a.an === S.ich.kennung; }).map(function (a) { return Object.assign({ kopfId: m.id }, a); });
        else if (m.von === S.ich.kennung) S.antwortenJe[m.id] = r.liste;
      }
      if (r.warnung) console.error('[Nachrichten] ' + (r.warnung.art === 'offen_rueckweg' ? 'offene Antworten ohne Filter abgelehnt — zwei gefilterte Abfragen' : 'A7: Antworten an mich nicht ladbar'), r.warnung.fehler);
      if (S.offen && S.offen.id === m.id) zeichneAntworten(m);
    }, function (err) {
      S.antworten[m.id] = { liste: [], fehler: err };
      if (S.offen && S.offen.id === m.id) zeichneAntworten(m);
      erklaereUndZeige(err, { art: 'lesen' });
    });
  }
  function zeichneDetail() {
    var o = S.offen; if (!o) return;
    ['postfach', 'aushaenge', 'gesendet', 'schreiben'].forEach(function (p) { $('panel-' + p).hidden = true; });
    $('detail').hidden = false;
    var ziel = $('detailInhalt'); ziel.textContent = '';
    if (o.id === L.CRUMBLE) { ziel.appendChild(crumbleDetail()); return; }
    var m = S.bekannt[o.id];
    if (!m) { ziel.appendChild(el('p', { class: 'leer', text: t('glied_weg') })); return; }
    ziel.appendChild(detailArtikel(m, o.quelle));
    zeichneAntworten(m);
    try { window.scrollTo(0, 0); } catch (e) { /* nichts */ }
  }
  function crumbleDetail() {
    var absaetze = t('crumble_text').split('\n').map(function (p) { return el('p', { text: p }); });
    return el('article', { class: 'detail typ-info' }, [
      el('div', { class: 'detail-kopf' }, [symbol('C', true), el('div', {}, [typWort('info'), el('div', { class: 'absender', text: t('crumble_name') })])]),
      el('div', { class: 'detail-text crumble-text' }, absaetze),
      el('div', { class: 'knoepfe' }, [el('button', { type: 'button', class: 'klein-btn', text: t('ausblenden'), onclick: function () {
        setzeStatus({ ausgeblendet: [L.CRUMBLE] }).then(function () { S.offen = null; zeigeReiter('postfach'); zeichnePostfach(); });
      } })])
    ]);
  }
  function daumenZeile(m, r, eingefroren) {
    var namen = (m.daumen || []).map(function (k) { return S.name(k); });
    var kinder = [el('span', { text: namen.length ? t('daumen_n', { n: namen.length }) + ' · ' + namen.join(', ') : t('daumen_keiner') })];
    if (!eingefroren && r.daumen) {
      var hab = (m.daumen || []).indexOf(S.ich.kennung) !== -1;
      kinder.unshift(el('button', { type: 'button', class: 'klein-btn daumen-btn', 'aria-pressed': hab ? 'true' : 'false', text: hab ? t('daumen_weg') : t('daumen_geben'),
        onclick: function (ev) {
          ev.target.disabled = true;
          L.daumen(S.db, m.id, S.ich.kennung).then(function (x) { S.bekannt[m.id].daumen = x.m.daumen; ersetzeInListen(m.id, { daumen: x.m.daumen }); zeichneDetail(); zeichnePostfach(); },
            function (err) { ev.target.disabled = false; erklaereUndZeige(err, { art: 'daumen' }); });
        } }));
    }
    return el('div', { class: 'daumen-zeile' }, kinder);
  }
  function ersetzeInListen(id, felder) {
    [S.postfach, S.aushaenge, S.gesendet].forEach(function (l) { l.forEach(function (m) { if (m.id === id) Object.keys(felder).forEach(function (k) { m[k] = felder[k]; }); }); });
  }
  function detailArtikel(m, quelle) {
    var r = L.rechte(m, S.z), gesp = L.gesperrt(m);
    var kn = [];
    if (r.korrektur) kn.push(el('button', { type: 'button', class: 'klein-btn', text: t('korrektur'), onclick: function () { starteKorrektur(m); } }));
    if (r.nachtrag) kn.push(el('button', { type: 'button', class: 'klein-btn', text: t('nachtrag'), 'aria-expanded': S.nachtragForm && S.nachtragForm.id === m.id ? 'true' : 'false',
      onclick: function () { S.nachtragForm = S.nachtragForm && S.nachtragForm.id === m.id ? null : { id: m.id, text: '', dazu: [], such: '' }; zeichneDetail(); } }));
    else if (r.nachtragOhneHaken) kn.push(el('span', { class: 'satz', text: t('nachtrag_kein_haken') }));   // N1
    else if (r.binAbsender && r.offen && !gesp && L.nachtragZahl(m) >= L.GRENZEN.NACHTRAEGE) kn.push(el('span', { class: 'satz', text: t('nachtrag_voll', { max: L.GRENZEN.NACHTRAEGE }) }));
    if (r.ausblenden) {
      var aus = hat(S.status.ausgeblendet, m.id);
      kn.push(el('button', { type: 'button', class: 'klein-btn', text: aus ? t('einblenden') : t('ausblenden'), onclick: function (ev) {
        ev.target.disabled = true;
        setzeStatus(aus ? { einblenden: [m.id] } : { ausgeblendet: [m.id] }).then(function () { S.offen = null; zeigeReiter(quelle === 'gesendet' ? 'gesendet' : 'postfach'); zeichnePostfach(); zeichneGesendet(); });
      } }));
    }
    var banner = null;
    if (gesp) banner = el('div', { class: 'banner', text: S.bekannt[m.ersetztDurch] ? t('korrigiert_hier') : (quelle === 'postfach' ? t('korrigiert_nicht_an_dich') : t('korrigiert_nicht_hier')) });
    return el('article', { class: 'detail typ-' + m.typ, 'data-id': m.id }, [
      el('div', { class: 'detail-kopf' }, [symbol(S.name(m.von, m.vonName)), el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { class: 'karte-kopf' }, [typWort(m.typ), el('span', { class: 'zeit', text: zeit(m.erstellt) }), r.offen ? el('span', { class: 'marke-offen', text: t('offen_marke') }) : null]),
        el('div', { class: 'absender', text: t('von', { name: S.name(m.von, m.vonName) }) })])]),
      banner,
      el('div', { class: 'detail-an', text: t('an_liste', { namen: (m.empfaenger || []).map(function (k) { return S.name(k); }).join(', ') }) }),
      el('div', { class: 'detail-text' + (gesp ? ' durch' : ''), text: m.text }),
      nachtraegeBox(m),
      daumenZeile(m, r, gesp),
      kn.length ? el('div', { class: 'knoepfe' }, kn) : null,
      r.nachtrag && S.nachtragForm && S.nachtragForm.id === m.id ? nachtragFormular(m) : null,
      ketteBox(m),
      el('section', { class: 'antworten', id: 'antworten-' + m.id })
    ]);
  }
  /* K27: Nachträge hervorgehoben direkt unter dem Text, über den Antworten, der Reihe nach. „neu“ an denen, die ich
     noch nicht gesehen habe (höchstes gelesenes id#k). */
  function nachtraegeBox(m) {
    var l = L.nachtraegeListe(m);
    if (!l.length) return null;
    var bis = 0;
    if (m.von !== S.ich.kennung) { for (var k = l.length; k >= 1; k--) { if (hat(S.status.gelesen, m.id + '#' + k)) { bis = k; break; } } }
    else bis = l.length;
    return el('div', { class: 'nachtraege' }, l.map(function (n) {
      return el('div', { class: 'nachtrag' }, [
        el('div', { class: 'nachtrag-kopf' }, [el('b', { text: t('nachtrag_zeile', { zeit: zeit(n.ts) }) }), n.nr > bis ? el('span', { class: 'marke-neu', text: t('neu') }) : null]),
        el('div', { class: 'nachtrag-text', text: n.text })
      ]);
    }));
  }
  /* K27–K29: Formular für den Absender — Text, freiwillig Empfänger dazu (enthaltene ausgegraut), Satz bei neuen. */
  function nachtragFormular(m) {
    var f = S.nachtragForm, ich = S.ich.kennung;
    var box = el('div', { class: 'nachtrag-form' });
    box.appendChild(el('h3', { text: t('nachtrag_titel') }));
    box.appendChild(el('p', { class: 'satz', text: t('nachtrag_satz') }));
    var ta = el('textarea', { class: 'eingabe', id: 'nachtragText-' + m.id, maxlength: String(L.GRENZEN.NACHTRAG), rows: '3' });
    ta.value = f.text;
    ta.addEventListener('input', function () { f.text = ta.value; });
    box.appendChild(ta);
    box.appendChild(el('div', { class: 'feld-titel', style: 'margin-top:8px' }, [el('span', { text: t('nachtrag_dazu') })]));
    var such = el('input', { type: 'search', class: 'eingabe', placeholder: t('suchen') });
    such.value = f.such || '';
    var liste = el('div', { class: 'adressbuch' });
    var satz = el('p', { class: 'satz satz-wichtig', text: t('nachtrag_dazu_satz'), hidden: !f.dazu.length });
    function zeichneListe() {
      liste.textContent = '';
      var q = String(such.value || '').toLocaleLowerCase('de').trim();
      var drin = m.empfaenger || [];
      var kennungen = Object.keys(S.adressbuch).filter(function (k) { return k !== ich && S.adressbuch[k] && S.adressbuch[k].aktiv !== false; });
      drin.forEach(function (k) { if (kennungen.indexOf(k) === -1 && k !== ich) kennungen.push(k); });
      kennungen.sort(function (a, b) { return S.name(a).localeCompare(S.name(b), 'de'); });
      kennungen.forEach(function (k) {
        var eintrag = S.adressbuch[k] || {}, name = S.name(k), schon = drin.indexOf(k) !== -1;
        if (q && (name + ' ' + (eintrag.beschreibung || '') + ' ' + k).toLocaleLowerCase('de').indexOf(q) === -1 && f.dazu.indexOf(k) === -1) return;
        var cb = el('input', { type: 'checkbox', 'data-kennung': k, disabled: schon });
        cb.checked = schon || f.dazu.indexOf(k) !== -1;
        cb.addEventListener('change', function () {
          if (cb.checked) { if (f.dazu.indexOf(k) === -1) f.dazu.push(k); } else f.dazu = f.dazu.filter(function (x) { return x !== k; });
          satz.hidden = !f.dazu.length;
        });
        liste.appendChild(el('label', { class: 'ab-zeile' + (schon ? ' schon' : '') }, [cb, el('span', { class: 'ab-art', text: eintrag.art === 'ort' ? '📍' : '👤' }),
          el('span', {}, [el('span', { class: 'ab-name', text: name }), schon ? el('span', { class: 'ab-beschr', text: '· ' + t('nachtrag_schon') }) : (eintrag.beschreibung ? el('span', { class: 'ab-beschr', text: '· ' + eintrag.beschreibung }) : null)])]));
      });
    }
    such.addEventListener('input', function () { f.such = such.value; zeichneListe(); });
    zeichneListe();
    box.appendChild(such); box.appendChild(liste); box.appendChild(satz);
    var fehlerBox = el('div', { class: 'fehler-zeile', hidden: true });
    var knopf = el('button', { type: 'button', class: 'klein-btn haupt', text: t('nachtrag_senden'), onclick: function () {
      var entwurf = { text: ta.value, empfaengerDazu: f.dazu.slice() };
      var fl = L.pruefeNachtrag(entwurf, m, Object.assign({}, S.z, { kennung: ich }));
      if (fl.length) { fehlerBox.textContent = fl.map(function (x) { return t('f_' + x, { max: x === 'text_lang' ? L.GRENZEN.NACHTRAG : x === 'nachtraege_voll' ? L.GRENZEN.NACHTRAEGE : L.GRENZEN.EMPFAENGER }); }).join('\n'); fehlerBox.hidden = false; return; }
      knopf.disabled = true; S.sendet = true; fehlerBox.hidden = true;
      L.nachtrag(S.db, m.id, entwurf, S.ich, Object.assign({}, S.z, { kennung: ich })).then(function () {
        S.sendet = false; S.nachtragForm = null;
        return ladeListen().then(function () { if (S.offen && S.offen.id === m.id) { zeichneDetail(); var mm = S.bekannt[m.id]; if (mm) ladeAntwortenFuer(mm); } });
      }, function (err) {
        S.sendet = false; knopf.disabled = false;
        if (err && err.schluessel) { fehlerBox.textContent = err.schluessel.map(function (x) { return t('f_' + x, { max: x === 'text_lang' ? L.GRENZEN.NACHTRAG : x === 'nachtraege_voll' ? L.GRENZEN.NACHTRAEGE : L.GRENZEN.EMPFAENGER }); }).join('\n') + '\n(' + err.message + ')'; fehlerBox.hidden = false; return; }
        erklaereUndZeige(err, { art: 'nachtrag' }, fehlerBox);
      });
    } });
    box.appendChild(fehlerBox);
    box.appendChild(el('div', { class: 'knoepfe' }, [knopf, el('button', { type: 'button', class: 'klein-btn', text: t('nachtrag_abbrechen'), onclick: function () { S.nachtragForm = null; zeichneDetail(); } })]));
    return box;
  }
  function ketteBox(m) {
    if (!m.ersetzt) return null;
    var k = L.kette(m, S.bekannt), offen = !!S.kettenOffen[m.id];
    var erste = k.glieder[0];
    var box = el('div', { class: 'kette' });
    box.appendChild(el('button', { type: 'button', class: 'klein-btn', text: offen ? t('ersetzt_zu') : (erste ? t('ersetzt_von', { zeit: zeit(erste.erstellt) }) : t('ersetzt_unbekannt')),
      onclick: function () { S.kettenOffen[m.id] = !offen; zeichneDetail(); } }));
    if (!offen) return box;
    k.glieder.forEach(function (g) { box.appendChild(gliedBox(g)); });
    if (k.fehlt) {
      var info = S.bekannt['__glied_' + k.fehlt];
      if (info && info.art === 'zu') box.appendChild(el('p', { class: 'satz', text: t('glied_zu') }));
      else if (info && info.art === 'weg') box.appendChild(el('p', { class: 'satz', text: t('glied_weg') }));
      else {
        box.appendChild(el('p', { class: 'satz', text: t('glied_laden') }));
        L.ladeGlied(S.db, k.fehlt).then(function (x) {
          if (x.art === 'da') { x.m.__glied = true; S.bekannt[x.id] = x.m; } else S.bekannt['__glied_' + x.id] = { art: x.art, __glied: true };
          zeichneDetail();
        }, function (err) { erklaereUndZeige(err, { art: 'lesen' }); });
      }
    }
    return box;
  }
  function gliedBox(g) {
    var a = S.antworten[g.id];
    var kinder = [
      el('div', { class: 'karte-kopf' }, [typWort(g.typ), el('span', { class: 'absender', text: S.name(g.von, g.vonName) }), el('span', { class: 'zeit', text: zeit(g.erstellt) })]),
      el('div', { class: 'detail-text durch', text: g.text }),
      daumenZeile(g, {}, true)
    ];
    if (g.typ !== 'bekanntmachung') {
      if (a && a.liste) a.liste.forEach(function (x) { kinder.push(antwortBox(x, g)); });
      else kinder.push(el('button', { type: 'button', class: 'klein-btn', text: t('glied_antworten'), onclick: function () { ladeAntwortenFuer(g).then(zeichneDetail); } }));
    }
    return el('div', { class: 'kette-glied' }, kinder);
  }
  function antwortBox(a, kopf, mitKnopf) {
    var ich = S.ich.kennung, eigene = a.von === ich;
    var kopfZ = [el('b', { text: S.name(a.von, a.vonName) }), el('span', { text: zeit(a.ts) })];
    /* 1d: bei jeder Antwort steht, von wem an wen (bei offenen lesen alle mit) */
    if (a.an === ich && !eigene) kopfZ.push(el('span', { class: 'an-dich', text: t('an_dich') }));
    else kopfZ.push(el('span', { text: t('an_name', { name: S.name(a.an) }) }));
    if (!hat(S.status.gelesen, a.id) && !eigene) kopfZ.push(el('span', { class: 'marke-neu', text: t('neu') }));
    var k = [el('div', { class: 'antwort-kopf' }, kopfZ), el('div', { class: 'antwort-text', text: a.text })];
    if (mitKnopf && kopf.von === ich && !eigene) k.push(el('button', { type: 'button', class: 'klein-btn', style: 'margin-top:6px', text: t('antworten_name', { name: S.name(a.von, a.vonName) }),
      onclick: function () { var s = document.getElementById('antwortAn-' + kopf.id); if (s) { s.value = a.von; } var f = document.getElementById('antwortText-' + kopf.id); if (f) f.focus(); } }));
    return el('div', { class: 'antwort' + (eigene ? ' eigene' : '') }, k);
  }
  function zeichneAntworten(m) {
    var box = document.getElementById('antworten-' + m.id);
    if (!box) return;
    var alterText = (document.getElementById('antwortText-' + m.id) || {}).value || '';
    var alteWahl = (document.getElementById('antwortAn-' + m.id) || {}).value || '';
    box.textContent = '';
    if (m.typ === 'bekanntmachung') return;
    box.appendChild(el('h3', { text: t('antworten_titel') }));
    var a = S.antworten[m.id] || {};
    if (a.warnung) {
      var w = el('div', { class: 'fehler-zeile' });
      setzeMitLinks(w, t(a.warnung.art === 'offen_rueckweg' ? 'offen_rueckweg' : 'a7_satz') + '\n(' + ((a.warnung.fehler.code ? a.warnung.fehler.code + ' — ' : '') + a.warnung.fehler.message) + ')');
      box.appendChild(w);
    }
    if (a.laedt && !a.liste) box.appendChild(el('p', { class: 'satz', text: t('antworten_laden') }));
    else if (a.liste && !a.liste.length) box.appendChild(el('p', { class: 'satz', text: t('antworten_keine') }));
    (a.liste || []).forEach(function (x) { box.appendChild(antwortBox(x, m, true)); });
    var r = L.rechte(m, S.z);
    if (L.gesperrt(m)) { box.appendChild(el('p', { class: 'satz', text: t('antwort_gesperrt') })); return; }
    if (!r.antworten) return;
    var form = el('div', { class: 'antwort-form' });
    if (r.offen) form.appendChild(el('p', { class: 'satz satz-wichtig', text: t('offen_antwort_satz') }));   // K23
    if (r.binAbsender) {
      var sel = el('select', { class: 'eingabe', id: 'antwortAn-' + m.id, 'aria-label': t('antwort_an_wahl') });
      sel.appendChild(el('option', { value: '', text: t('antwort_an_wahl') + ' …' }));
      (m.empfaenger || []).filter(function (k) { return k !== S.ich.kennung; }).forEach(function (k) { sel.appendChild(el('option', { value: k, text: S.name(k) })); });
      if (alteWahl) sel.value = alteWahl;
      form.appendChild(sel);
    } else form.appendChild(el('div', { class: 'satz', text: t('antwort_an', { name: S.name(m.von, m.vonName) }) }));
    var ta = el('textarea', { class: 'eingabe', id: 'antwortText-' + m.id, maxlength: String(L.GRENZEN.ANTWORT), rows: '3' });
    ta.value = alterText;
    form.appendChild(ta);
    var fehlerBox = el('div', { class: 'fehler-zeile', hidden: true });
    var knopf = el('button', { type: 'button', class: 'klein-btn haupt', text: t('antwort_schicken'), onclick: function () {
      var an = r.binAbsender ? sel.value : m.von;
      var entwurf = { an: an, text: ta.value };
      var f = L.pruefeAntwort(entwurf, m, Object.assign({}, S.z, { kennung: S.ich.kennung }));
      if (f.length) { fehlerBox.textContent = f.map(function (x) { return t('f_' + x, { max: L.GRENZEN.ANTWORT }); }).join('\n'); fehlerBox.hidden = false; return; }
      knopf.disabled = true; S.sendet = true; fehlerBox.hidden = true;
      L.antworten(S.db, m.id, entwurf, S.ich).then(function () {
        S.sendet = false; ta.value = '';
        return ladeAntwortenFuer(m).then(function () { meldeZahl(); zeichneGesendet(); });
      }, function (err) { S.sendet = false; knopf.disabled = false; erklaereUndZeige(err, { art: 'antwort' }, fehlerBox); });
    } });
    form.appendChild(fehlerBox);
    form.appendChild(knopf);
    form.appendChild(el('p', { class: 'satz', text: t('antwort_e18') }));
    box.appendChild(form);
  }

  /* ---------- Schreiben ---------- */
  function neuerEntwurf() { return { typ: 'nachricht', empfaenger: [], text: '', giltBis: L.plusTage(L.heute(), L.GRENZEN.GILT_VORGABE_TAGE), korrekturVon: null, antwortenOffen: false }; }
  function starteKorrektur(m) {
    if (L.istOffen(m)) return;   // K27: offene werden nicht korrigiert (Knopf fehlt ohnehin)
    S.entwurf = { typ: m.typ, empfaenger: (m.empfaenger || []).slice(), text: m.text || '', giltBis: m.typ === 'bekanntmachung' && m.giltBis >= L.heute() ? m.giltBis : L.plusTage(L.heute(), L.GRENZEN.GILT_VORGABE_TAGE), korrekturVon: m, antwortenOffen: false };
    $('textFeld').value = S.entwurf.text;
    zeigeReiter('schreiben');
  }
  function kritikModus() { return S.entwurf && L.kritikGesperrt(S.z, S.entwurf.typ); }
  function zeichneSchreiben() {
    if (!S.z || !S.z.schreiben) return;
    if (!S.entwurf) { S.entwurf = neuerEntwurf(); $('textFeld').value = ''; }
    var e = S.entwurf;
    /* Korrektur-Zeile */
    var kz = $('korrekturZeile');
    if (e.korrekturVon) {
      kz.textContent = '';
      kz.appendChild(el('span', { text: t('korrektur_satz', { zeit: zeit(e.korrekturVon.erstellt) }) + ' ' }));
      kz.appendChild(el('button', { type: 'button', class: 'klein-btn', text: t('korrektur_abbrechen'), onclick: function () { S.entwurf = null; $('textFeld').value = ''; $('schreibFehler').hidden = true; zeichneSchreiben(); } }));
      kz.hidden = false;
    } else kz.hidden = true;
    /* Typ */
    var tc = $('typChips'); tc.textContent = '';
    L.TYPEN.forEach(function (typ) {
      var gesperrt = (typ === 'bekanntmachung' && !S.z.bekanntmachung) || (!!e.korrekturVon && typ !== e.typ);
      tc.appendChild(el('button', { type: 'button', class: 'chip typ typ-' + typ, 'aria-pressed': e.typ === typ ? 'true' : 'false', disabled: gesperrt, 'data-typ': typ, text: t('typ_' + typ),
        onclick: function () { waehleTyp(typ); } }));
    });
    var ts = $('typSatz');
    if (!S.z.bekanntmachung) { ts.textContent = t('typ_aushang_kein_haken'); ts.hidden = false; } else ts.hidden = true;
    var aushang = e.typ === 'bekanntmachung';
    $('aushangBlock').hidden = !aushang;
    $('empfaengerBlock').hidden = aushang;
    var gb = $('giltBis'); gb.min = L.heute(); gb.value = e.giltBis;
    if (!aushang) zeichneEmpfaenger();
    zeichneOffen();
    zaehleText();
    var nz = $('nameZeile');
    nz.textContent = S.ich.nameQuelle === 'kein_eintrag' ? t('name_kennung', { name: S.ich.name }) : t('name_ok', { name: S.ich.name });
    pruefeSendbar();
  }
  /* K23/K24, F34: Kästchen nur mit erkannter Regel-Fassung 1d, nie bei Kritik und Aushang; Korrektur: gesperrt wie das Original. */
  function offenMoeglich() { return !!(S.regel && S.regel.offen); }
  function zeichneOffen() {
    var e = S.entwurf, zeile = $('offenZeile'), kb = $('offenKaestchen'), satz = $('offenSatz');
    var zeigen = offenMoeglich() && e.typ !== 'kritik' && e.typ !== 'bekanntmachung';
    zeile.hidden = !zeigen; satz.hidden = !zeigen;
    if (!zeigen) { e.antwortenOffen = false; kb.checked = false; return; }
    kb.disabled = !!e.korrekturVon;
    kb.checked = e.antwortenOffen === true;
    satz.textContent = e.korrekturVon ? t('offen_korrektur') : t('offen_satz');
  }
  function waehleTyp(typ) {
    var e = S.entwurf, vorher = kritikModus();
    e.typ = typ;
    if (typ === 'kritik' || typ === 'bekanntmachung') e.antwortenOffen = false;
    if (kritikModus()) e.empfaenger = L.leitungFuer(S.leitung, S.ich.kennung);
    else if (vorher) e.empfaenger = [];
    zeichneSchreiben();
  }
  function zeichneEmpfaenger() {
    var e = S.entwurf, kritik = kritikModus(), ich = S.ich.kennung;
    var ks = $('kritikSatz');
    var leitung = L.leitungFuer(S.leitung, ich);
    if (kritik) { ks.textContent = leitung.length ? t('kritik_leitung') : t('leitung_leer'); ks.hidden = false; } else ks.hidden = true;
    /* Vorlagen-Chips (im Kritik-Modus gesperrt) */
    var vc = $('vorlagenChips'); vc.textContent = '';
    S.vorlagen.forEach(function (v) {
      var k = (v.kennungen || []).filter(function (x) { return x !== ich; });
      if (!k.length) return;
      var alle = k.every(function (x) { return e.empfaenger.indexOf(x) !== -1; });
      vc.appendChild(el('button', { type: 'button', class: 'chip', 'aria-pressed': alle ? 'true' : 'false', disabled: kritik, 'data-vorlage': v.id,
        text: (v.id === 'leitung' ? 'Leitung' : (v.name || v.id)) + ' (' + k.length + ')',
        onclick: function () {
          if (alle) e.empfaenger = e.empfaenger.filter(function (x) { return k.indexOf(x) === -1; });
          else k.forEach(function (x) { if (e.empfaenger.indexOf(x) === -1) e.empfaenger.push(x); });
          zeichneEmpfaenger(); pruefeSendbar();
        } }));
    });
    vc.hidden = kritik;
    $('empfSuche').hidden = kritik;
    /* Adressbuch bzw. Leitungsliste */
    var ab = $('adressbuchListe'); ab.textContent = '';
    var such = String($('empfSuche').value || '').toLocaleLowerCase('de').trim();
    var kennungen = kritik ? leitung : Object.keys(S.adressbuch).filter(function (k) { return k !== ich && S.adressbuch[k] && S.adressbuch[k].aktiv !== false; });
    /* Empfänger aus einer Korrektur, die nicht (mehr) im Adressbuch stehen, bleiben wählbar (Phantom, Weggang) */
    e.empfaenger.forEach(function (k) { if (kennungen.indexOf(k) === -1 && k !== ich && !kritik) kennungen.push(k); });
    kennungen.sort(function (a, b) { return S.name(a).localeCompare(S.name(b), 'de'); });
    kennungen.forEach(function (k) {
      var eintrag = S.adressbuch[k] || {}, name = S.name(k);
      if (such && (name + ' ' + (eintrag.beschreibung || '') + ' ' + k).toLocaleLowerCase('de').indexOf(such) === -1 && e.empfaenger.indexOf(k) === -1) return;
      var cb = el('input', { type: 'checkbox', 'data-kennung': k });
      cb.checked = e.empfaenger.indexOf(k) !== -1;
      cb.addEventListener('change', function () {
        if (cb.checked) { if (e.empfaenger.indexOf(k) === -1) e.empfaenger.push(k); }
        else {
          if (kritik && e.empfaenger.length <= 1) { cb.checked = true; ks.textContent = t('kritik_leitung_letzter'); return; }
          e.empfaenger = e.empfaenger.filter(function (x) { return x !== k; });
        }
        zeichneEmpfaenger(); pruefeSendbar();
      });
      ab.appendChild(el('label', { class: 'ab-zeile' }, [cb, el('span', { class: 'ab-art', text: eintrag.art === 'ort' ? '📍' : '👤' }),
        el('span', {}, [el('span', { class: 'ab-name', text: name }), eintrag.beschreibung ? el('span', { class: 'ab-beschr', text: '· ' + eintrag.beschreibung }) : null])]));
    });
    var n = e.empfaenger.length;
    var zz = $('empfZaehler'); zz.textContent = t('empf_zaehler', { n: n, max: L.GRENZEN.EMPFAENGER }); zz.classList.toggle('zu-viel', n > L.GRENZEN.EMPFAENGER);
  }
  function zaehleText() {
    var n = $('textFeld').value.length, z = $('textZaehler');
    z.textContent = t('text_zaehler', { n: n, max: L.GRENZEN.TEXT }); z.classList.toggle('zu-viel', n > L.GRENZEN.TEXT);
  }
  function entwurfJetzt() {
    var e = S.entwurf;
    return { typ: e.typ, empfaenger: e.empfaenger.slice(), text: $('textFeld').value, giltBis: $('giltBis').value, ersetzt: e.korrekturVon ? e.korrekturVon.id : null,
             antwortenOffen: e.antwortenOffen === true && !e.korrekturVon && offenMoeglich() };
  }
  function pruefeSendbar() {
    if (!S.entwurf) return [];
    var f = L.pruefeEntwurf(entwurfJetzt(), Object.assign({}, S.z, { kennung: S.ich.kennung }), L.leitungFuer(S.leitung, S.ich.kennung), L.heute(), { offenMoeglich: offenMoeglich() });
    var harte = f.filter(function (x) { return x === 'leitung_leer' || x === 'empfaenger_viele' || x === 'kein_haken' || x === 'kein_haken_aushang'; });
    $('sendenBtn').disabled = S.sendet || harte.length > 0;
    return f;
  }
  function sende() {
    var sf = $('schreibFehler'); sf.hidden = true;
    var e = entwurfJetzt(), f = pruefeSendbar();
    if (f.length) { sf.textContent = f.map(function (x) { return t('f_' + x, { max: x === 'text_lang' ? L.GRENZEN.TEXT : L.GRENZEN.EMPFAENGER }); }).join('\n'); sf.hidden = false; return; }
    S.sendet = true; $('sendenBtn').disabled = true; $('sendenBtn').textContent = t('sendet');
    var alt = S.entwurf.korrekturVon;
    var p = alt ? L.korrektur(S.db, alt, e, S.ich) : L.senden(S.db, e, S.ich);
    p.then(function (r) {
      S.sendet = false; S.entwurf = null; $('textFeld').value = '';
      $('sendenBtn').textContent = t('senden');
      if (r.zweiterSchritt === 'fehler') erklaereUndZeige(r.fehler, { art: 'abnehmen' }).then(function () { zeigeFehler(t('zweiter_schritt')); });
      return ladeListen().then(function () { zeigeReiter(e.typ === 'bekanntmachung' ? 'aushaenge' : 'gesendet'); });
    }, function (err) {
      S.sendet = false; $('sendenBtn').textContent = t('senden'); pruefeSendbar();
      erklaereUndZeige(err, { art: alt ? 'korrektur' : 'senden', typ: e.typ }, sf);
    });
  }

  /* ---------- Ereignisse, Hilfe, i18n ---------- */
  function wendeI18nAn() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (x) { x.textContent = t(x.getAttribute('data-i18n')); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-title]'), function (x) { x.title = t(x.getAttribute('data-i18n-title')); x.setAttribute('aria-label', x.title); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (x) { x.placeholder = t(x.getAttribute('data-i18n-placeholder')); });
  }
  function zeigeHilfe(an) {
    if (an && typeof helpData !== 'undefined') {
      $('hilfeTitel').textContent = helpData.titel;
      var ziel = $('hilfeInhalt'); ziel.textContent = '';
      helpData.abschnitte.forEach(function (a) { ziel.appendChild(el('h3', { text: a[0] })); ziel.appendChild(el('p', { text: a[1] })); });
      $('crumbleWiederBtn').hidden = !(S.z && S.z.voll && !crumbleSichtbar());
    }
    $('hilfeSheet').hidden = !an; $('hilfeHintergrund').hidden = !an;
  }
  function bindeEreignisse() {
    Array.prototype.forEach.call(document.querySelectorAll('#reiter .tab-btn'), function (b) { b.addEventListener('click', function () { zeigeReiter(b.getAttribute('data-reiter')); }); });
    $('neuLadenBtn').addEventListener('click', function () { if (!S.z || !S.ich) { location.reload(); return; } $('fehlerZeile').hidden = true; ladeListen(); });
    $('hilfeBtn').addEventListener('click', function () { zeigeHilfe(true); });
    $('hilfeZu').addEventListener('click', function () { zeigeHilfe(false); });
    $('hilfeHintergrund').addEventListener('click', function () { zeigeHilfe(false); });
    $('crumbleWiederBtn').addEventListener('click', function () { setzeStatus({ einblenden: [L.CRUMBLE] }).then(function () { zeigeHilfe(false); S.offen = null; zeigeReiter('postfach'); zeichnePostfach(); }); });
    $('fehlerZu').addEventListener('click', function () { $('fehlerZeile').hidden = true; $('fehlerText').textContent = ''; });
    $('detailZurueck').addEventListener('click', function () { var q = S.offen && S.offen.quelle; S.offen = null; zeigeReiter(q === 'gesendet' ? 'gesendet' : 'postfach'); });
    $('zeigeAusPostfach').addEventListener('change', function (ev) { S.zeigeAus.postfach = ev.target.checked; zeichnePostfach(); });
    $('zeigeAusGesendet').addEventListener('change', function (ev) { S.zeigeAus.gesendet = ev.target.checked; zeichneGesendet(); });
    $('alleGelesenBtn').addEventListener('click', function (ev) {
      var ids = L.postfachSicht(S.postfach, S.status, S.ich.kennung, {}).filter(function (e) { return !e.neu; }).map(function (e) { return e.m.id; });
      if (!ids.length) return;
      ev.target.disabled = true;
      setzeStatus({ ausgeblendet: ids }).then(zeichnePostfach);
    });
    $('textFeld').addEventListener('input', function () { zaehleText(); pruefeSendbar(); });
    $('giltBis').addEventListener('input', function () { if (S.entwurf) S.entwurf.giltBis = $('giltBis').value; pruefeSendbar(); });
    $('empfSuche').addEventListener('input', zeichneEmpfaenger);
    $('offenKaestchen').addEventListener('change', function (ev) { if (S.entwurf) S.entwurf.antwortenOffen = ev.target.checked === true; pruefeSendbar(); });
    $('sendenBtn').addEventListener('click', sende);
    $('verwerfenBtn').addEventListener('click', function () { S.entwurf = null; $('textFeld').value = ''; $('schreibFehler').hidden = true; zeichneSchreiben(); });
    if (window.BOS_UNGESPEICHERT) {
      window.BOS_UNGESPEICHERT.melde(function () {
        if ($('textFeld').value.trim()) return true;
        return Array.prototype.some.call(document.querySelectorAll('textarea[id^="antwortText-"], textarea[id^="nachtragText-"]'), function (x) { return !!x.value.trim(); });
      }, { laeuft: function () { return S.sendet; } });
    }
  }

  window.BOS_NACHRICHTEN_ANSICHT = { zustand: function () { return S; }, neuLaden: function () { return ladeListen(); }, oeffne: oeffne, t: t, I18N_DE: I18N_DE };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
