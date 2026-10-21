/* ================================================================
   BäckereiOS · bos_produkte.js — die Produktliste, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_PRODUKTE

   Einbindung NACH bos_firebase_config.js (braucht window.db und
   window.BOS_AUTH_READY), dann erst der seiteneigene Code:

     <script src="../bos_firebase_config.js"></script>
     <script src="../bos_produkte.js"></script>

   Zweck (Stufe 1, Anweisung vom 05.10.2026): Alle Seiten lesen die
   Produktliste aus Firestore `produkte` statt aus produkt_config.json.
   Zwölf Aufrufer, eine Mechanik. Kein Rückfall auf die Datei — sonst
   gäbe es wieder zwei Quellen.

   Aufruf:
     const e = await BOS_PRODUKTE.lade({ sicht: 'aktive' });
     e.liste        Produkte in derselben Form wie bisher aus der Datei
     e.quelle       'server' | 'geraetekopie_aktuell' | 'geraetekopie'
     e.stand        Date — Zeitpunkt des Server-Stands bzw. der Kopie
     e.standNummer  Nummer des Stand-Zettels (null, wenn es ihn nicht gibt)
     e.grund        nur bei 'geraetekopie': der Fehler, warum der Server
                    nicht geantwortet hat (Objekt mit art, meldung, original)
     e.warnungen    Auffälligkeiten in den Dokumenten (Liste von Texten)

   Sichten:
     'aktive'  Standard. Ohne gelöschte, sortiert nach `reihenfolge`
               (Dokumente ohne das Feld ans Ende, dort nach legacyKey),
               ohne die Datenbank-Felder `reihenfolge`, `geloescht`, `sicherungId`.
     'alle'    wie 'aktive', aber mit gelöschten — die tragen
               `geloescht: true`. Für Seiten, die Namen zu alten Daten
               nachschlagen (Werkstatt, Verbrauch-Einstellungen) und für
               die Schlüsselprüfung im Editor.
     'laufend' wie 'aktive', aber ohne pausierte Produkte (pausiert: true,
               Saison-Pause, seit 15.10.2026). Für die Betriebsseiten:
               Stationen, Übersicht (Nachtrag), Schnellrechner, Mitschrift,
               Froster-Inventur und -Produktion, BrotTeigRechner (bis
               16.10.2026 „Teigecke Nacht“), Teigrechner.
     'roh'     Dokumente unverändert als { id, daten }. Nur Sync-Tool.

   Weitere Optionen:
     nurServer: true   nie die Gerätekopie liefern (Editor, Sync-Tool —
                       wer einen alten Stand bearbeitet und einspielt,
                       dreht neuere Änderungen zurück)
     frisch: true      erzwingt einen neuen Vollabruf („Neu laden“)

   Stand-Zettel (Ulf, 05.10.2026, 08:00): Vor dem Vollabruf wird nur
   das Dokument produkte_stand/aktuell gelesen (ein Lesevorgang). Trägt
   die Gerätekopie dieselbe Nummer, kommt die Liste vom Gerät
   ('geraetekopie_aktuell', kein Hinweis — das ist der Alltag). Nur bei
   höherer Nummer wird die ganze Sammlung geholt. Das Sync-Tool (und ab
   Stufe 2 der Editor) zählt die Nummer im selben Batch hoch, die Regel
   erzwingt das (RK: produkte_stand).

   Gerätekopie (localStorage): nur aus einer Server-Antwort mit
   mindestens einem Produkt geschrieben, nie aus einer leeren oder aus
   dem Zwischenspeicher. Geliefert nur bei „kein Netz“, „Zeitlimit“ und
   „Kontingent aufgebraucht“ — nie bei „keine Berechtigung“ (ein
   gesperrtes Konto darf die Liste auch nicht über den Umweg sehen).
   Zeitnetz: ist die Kopie älter als ZEITNETZ_MS, wird auch bei gleichem
   Stand voll geladen (heilt einen Fehler im Schreibweg von selbst).

   Fehler kommen als Error mit .art, .meldung (normale Sprache),
   .original (Code — Meldung der Datenbank) und bei 'regel_alt'
   .regelDatei. Die Seite zeigt .meldung sichtbar an (Ulfs Regel).
     'nicht_geladen'       Firebase oder bos_firebase_config.js fehlt
     'nicht_angemeldet'    BOS_AUTH_READY lehnt ab
     'kein_netz'           unavailable / Antwort aus dem Zwischenspeicher
     'zeitlimit'           keine Antwort nach ZEITLIMIT_MS
     'kontingent'          resource-exhausted (Tagesrahmen aufgebraucht)
     'keine_berechtigung'  abgelehnt, Konto ohne Haken „freigeschaltet“
     'regel_alt'           abgelehnt, Konto hat den Haken, die eingesetzte
                           Regel kennt diese Seite noch nicht (RK §13)
     'leer'                Server antwortet mit null Produkten
     'fehler'              alles andere

   Datum nie über toISOString() (UTC-Falle zwischen 0 und 2 Uhr).

   Einheiten (seit 13.10.2026, Baustelle #64) — die EINE Stelle für
   „Stück oder Träger, welcher Träger, Stück ↔ Träger“, reine Logik ohne
   Datenbank:
     BOS_PRODUKTE.einheit(produkt) → { art: 'stueck'|'traeger'|'fehlt',
        traeger, kurz ('Stk.', 'Bl.', 'Dl.', 'LoBl.' …), lang ('Stück',
        'Bleche', 'Rote Dielen' …), einzahl ('Blech', 'Diele' …), faktor,
        hatFaktor }
     BOS_PRODUKTE.stueckInEinheit(stueck, produkt), .einheitInStueck(menge, produkt)
     BOS_PRODUKTE.einheitGleich(a, b)
     BOS_PRODUKTE.EINHEITEN_LISTE (Auswahlliste), .einheitListenEintrag(wert),
        .einheitNorm(wert), .einheitIstKurzform(text)   (seit Nachtrag 1)
   Nutzer: bos_verbrauch_durchschnitt.js, Stationen, Übersicht,
   Schnellrechner, Mitschrift, Editor. Teigecke noch mit eigener Logik
   (Umzug später, SESSION_2026-10-13_EINHEITEN_BAU.md §2.6).

   Bedarfsquelle, Richtwert, Saison-Pause (seit 15.10.2026, Baustelle #63):
     BOS_PRODUKTE.bedarfsQuelle(p) → 'richtwert'|'offiziell'|'manuell' (fehlt → 'manuell')
     BOS_PRODUKTE.quelleText(q) → 'Richtwert'|'Backzettel'|'Mitschrift'
     BOS_PRODUKTE.istPausiert(p), .backtagIndizes(p) (Mo = 0, ohne Backtage alle true)
     BOS_PRODUKTE.richtwertWerte(p), .richtwertPruefen(eingaben, p), .rundeRichtwert(x, p)

   CHANGELOG
     2026-10-21 · 11:07 · Nur REGEL_DATEI: nennt jetzt die neueste Regeldatei firestore_regeln_2026-10-21_backstore.rules (BackStore-Texte, #110, Bauplan freigegeben KC 10:27; elf Stellen). Fassung (REGEL_FASSUNG) und Logik unverändert. SESSION_2026-10-21_BACKSTORE_APPSTORE_BAU.md
     2026-10-21 · 07:29 · Nur REGEL_DATEI: nennt jetzt die neueste Regeldatei firestore_regeln_2026-10-21_zugangsblatt.rules (Zugangsblatt-Schnellzugriffe, Freigabe KC 21.10., 06:47, Auflage N4). Die alte Angabe hätte bei „Regel zu alt“ eine veraltete Datei empfohlen; wer sie eingesetzt hätte, hätte neuere Regeln hinausgeworfen. Fassung (REGEL_FASSUNG) und Logik unverändert. SESSION_2026-10-21_ZUGANGSBLATT_QR_BAU.md
     2026-10-16 · 16:55 · v0.6 · Einheit „Halbes Kuchenblech“ (Teigrechner Stufe 1, #67, Teil A)
       ANWEISUNG_2026-10-16_TEIGRECHNER_STUFE1.md, Freigabe Kontroll-Chat 16:37.
       EINHEITEN_LISTE + „Halbes Kuchenblech“ (hinter Kuchenblech), Kurzform
       „halbKuBl.“ fest (EINHEIT_KURZ_FEST). Sonst unverändert: Laden, Sichten,
       Rechnung, REGEL_FASSUNG. teigrechner/_protokolle/SESSION_2026-10-16_TEIGRECHNER_STUFE1_BAU.md
     2026-10-15 · 10:55 · Farbprofile Stufe A (#72, Freigabe Kontroll-Chat 10:50)
       Meldungsleiste (Art ≠ Fehler) Randfarbe auf feste Warnfarbe --bos-warn. Nur diese eine Farbzeile. SESSION_2026-10-15_FARBSCHEMA_STUFE_A_BAU.md
     2026-10-15 · 01:17 · v0.5 · Richtwert und Saison-Pause (Baustelle #63)
       SESSION_2026-10-14_RICHTWERT_BAU.md (Freigabe Kontroll-Chat 14.10., 19:19).
       Neu: Sicht 'laufend' (aktive ohne pausierte), bedarfsQuelle(), quelleText(),
       istPausiert(), Backtag-Zählung (backtagIndizes, backtagWert, needsIndex),
       Richtwert-Logik (richtwertWerte, richtwertPruefen, rundeRichtwert …).
       Rein additiv: Laden, Gerätekopie, die Sichten 'aktive'/'alle'/'roh' und
       REGEL_FASSUNG bleiben unverändert (Lesen braucht keine neue Regel).
     2026-10-13 · 14:47 · v0.4 · Einheiten Nachtrag 1 (Auswahlliste)
       ANWEISUNG_2026-10-13_EINHEITEN_NACHTRAG1.md (KC 14:45, Ulf 14:44).
       Neu: EINHEITEN_LISTE (Stück, Blech, Lochblech, Kuchenblech,
       Schlawinerblech, Rote Diele, Blaue Diele), einheitNorm(),
       einheitListenEintrag(), einheitIstKurzform(). einheitGleich() vergleicht
       Träger jetzt über die Normalform ('bleche' = 'Blech', 'Rote Dielen' =
       'rote Diele'); vorher nur Groß/klein. Rechnung unverändert.
     2026-10-13 · 12:06 · v0.3 · Einheiten (Baustelle #64)
       Neu: einheit(), stueckInEinheit(), einheitInStueck(), einheitGleich(),
       EINHEIT_NEUTRAL. Rein additiv, keine Firestore-Änderung, Laden und
       Sichten unverändert. Kurzformen nach Ulf (13.10., 12:04).
       SESSION_2026-10-13_EINHEITEN_BAU.md (Freigabe Kontroll-Chat 11:48).
     2026-10-06 · v0.2 · Stufe 2 (KC-Freigabe S2, 08:26)
       sicherungId gehört wie reihenfolge/geloescht der Datenbank und wird aus
       den Sichten 'aktive' und 'alle' entfernt (DB_FELDER) — sonst landete das
       Feld in jeder Leser-Seite, im Sync-Export und in der Vorschau. Sonst
       unverändert; Regelstand-Fassung bleibt produkte-2026-10-05.
     2026-10-05 · v0.1 · Neu
       Erstfassung. Bauplan SESSION_2026-10-05_PRODUKTE_AUS_FIRESTORE_
       STUFE1.md (Freigabe Kontroll-Chat 08:18 Uhr, von Ulf weitergegeben). Zeitlimit kopiert aus
       nfc_qr/nfc_qr_zentrale.html (mitZeitlimit), Gerätekopie nach dem
       Muster aus teigecke/teigecke_nacht.html (ladeProdukte), erweitert
       um Stand-Zettel und die Unterscheidung „Konto gesperrt“ /
       „Regel zu alt“ über das eigene Konto-Dokument.
   ================================================================ */
(function (global) {
  'use strict';

  var COLLECTION = 'produkte';
  var STAND_COLLECTION = 'produkte_stand';
  var STAND_DOK = 'aktuell';
  var KOPIE_KEY = 'bos_produkte_geraetekopie_v1';
  var ZEITLIMIT_MS = 10000;
  /* Zeitnetz (KC 05.10., 08:18): sieben Tage, 0 = aus. */
  var ZEITNETZ_MS = 7 * 24 * 60 * 60 * 1000;
  var REGEL_FASSUNG = 'produkte-2026-10-05';
  var REGEL_DATEI = 'firestore_regeln_2026-10-21_backstore.rules';
  var MELDUNG_ID = 'bosProdukteMeldung';

  /* Texte an einer Stelle. */
  var T = {
    nicht_geladen: 'Produktliste: Firebase oder bos_firebase_config.js ist nicht geladen.',
    nicht_angemeldet: 'Produktliste: Die Anmeldung konnte nicht geprüft werden.',
    kein_netz: 'Produktliste: Keine Verbindung zum Server (WLAN?).',
    zeitlimit: 'Produktliste: Keine Antwort vom Server nach {s} s — vermutlich kein Netz.',
    kontingent: 'Produktliste: Das Tageskontingent der Datenbank ist aufgebraucht. Ab morgen geht es wieder; bis dahin läuft die Seite mit dem Stand vom Gerät.',
    keine_berechtigung: 'Produktliste: Keine Berechtigung — dein Konto ist nicht freigeschaltet oder hat kein Konto-Dokument. Sag Ulf Bescheid.',
    keine_berechtigung_unklar: 'Produktliste: Keine Berechtigung — die Datenbank hat abgelehnt, der Grund ließ sich nicht feststellen.',
    regel_alt: 'Produktliste: Die Firestore-Regeln sind älter als diese Seite. In der Firebase-Konsole {datei} einsetzen (Fassung {fassung}).',
    leer: 'Produktliste: Der Server meldet null Produkte. Das ist kein Netzproblem — Sammlung „produkte“ in der Firebase-Konsole prüfen oder im Sync-Tool einspielen.',
    fehler: 'Produktliste konnte nicht geladen werden.',
    kopie: 'Produktliste vom {zeit} (Gerätekopie — {grund})',
    kopie_grund_netz: 'kein Netz',
    kopie_grund_zeit: 'Server antwortet nicht',
    kopie_grund_kontingent: 'Tageskontingent aufgebraucht',
    warn_ohne_key: 'Dokument „{id}“ hat kein Feld legacyKey.',
    warn_id: 'Dokument „{id}“ trägt legacyKey „{key}“ — Dokument-ID und Schlüssel müssen gleich sein.'
  };
  function t(k, v) {
    var s = T[k] || k;
    Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(String(v[n])); });
    return s;
  }

  function zeitText(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '?';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ' Uhr';
  }

  /* Kopiert aus nfc_qr/nfc_qr_zentrale.html (mitZeitlimit), nicht nachgebaut. */
  function mitZeitlimit(promise, ms) {
    var timer;
    var zeit = new Promise(function (_, reject) {
      timer = setTimeout(function () { var e = new Error('Zeitlimit ' + (ms / 1000) + ' s überschritten'); e.code = 'zeitlimit'; reject(e); }, ms);
    });
    return Promise.race([promise, zeit]).finally(function () { clearTimeout(timer); });
  }

  function zeitMs(wert) {
    return wert && typeof wert.toMillis === 'function' ? wert.toMillis() : (typeof wert === 'number' ? wert : null);
  }

  function fehler(art, meldung, original, extra) {
    var e = new Error(meldung);
    e.art = art;
    e.meldung = meldung;
    e.original = original ? ((original.code ? original.code + ' — ' : '') + (original.message || String(original))) : '';
    e.code = original && original.code ? original.code : art;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  /* Welche Art Fehler hat die Datenbank gemeldet? Nur die groben Klassen —
     „keine Berechtigung“ wird danach noch unterschieden (F1). */
  function artAus(err) {
    var c = (err && err.code) || '';
    if (c === 'zeitlimit') return 'zeitlimit';
    if (c === 'unavailable') return 'kein_netz';
    if (c === 'resource-exhausted') return 'kontingent';
    if (c === 'permission-denied') return 'keine_berechtigung';
    if (/offline/i.test((err && err.message) || '')) return 'kein_netz';
    return 'fehler';
  }
  function liefertKopie(art) {
    return art === 'kein_netz' || art === 'zeitlimit' || art === 'kontingent';
  }
  function kopieGrund(art) {
    if (art === 'zeitlimit') return t('kopie_grund_zeit');
    if (art === 'kontingent') return t('kopie_grund_kontingent');
    return t('kopie_grund_netz');
  }

  /* Felder, die der Datenbank gehören und nie in die Liste kommen (K7; sicherungId seit Stufe 2). */
  var DB_FELDER = ['reihenfolge', 'geloescht', 'sicherungId'];

  /* ---------- Sortieren und Sichten (reine Logik, testbar) ---------- */
  function vergleich(a, b) {
    var ra = typeof a.reihenfolge === 'number' ? a.reihenfolge : null;
    var rb = typeof b.reihenfolge === 'number' ? b.reihenfolge : null;
    if (ra !== null && rb !== null && ra !== rb) return ra - rb;
    if (ra !== null && rb === null) return -1;
    if (ra === null && rb !== null) return 1;
    return String(a.legacyKey || a.id || '').localeCompare(String(b.legacyKey || b.id || ''), 'de');
  }
  function ohneFelder(daten, felder) {
    var k = {};
    Object.keys(daten).forEach(function (f) { if (felder.indexOf(f) === -1) k[f] = daten[f]; });
    return k;
  }
  /* roh: [{ id, daten }] → Liste je Sicht. */
  function sicht(roh, name) {
    if (name === 'roh') return roh.map(function (d) { return { id: d.id, daten: d.daten }; });
    var sortiert = roh.map(function (d) { return d.daten; }).slice().sort(vergleich);
    if (name === 'alle') {
      return sortiert.map(function (p) {
        var o = ohneFelder(p, DB_FELDER);
        if (p.geloescht === true) o.geloescht = true;
        return o;
      });
    }
    var aktive = sortiert
      .filter(function (p) { return p.geloescht !== true; })
      .map(function (p) { return ohneFelder(p, DB_FELDER); });
    /* 'laufend' (15.10.2026, #63): 'aktive' ohne Saison-Pause — für die
       Betriebsseiten. 'aktive' selbst bleibt Wort für Wort (Export, Notfall-Kopie). */
    if (name === 'laufend') return aktive.filter(function (p) { return p.pausiert !== true; });
    return aktive;
  }
  function warnungenFuer(roh) {
    var w = [];
    roh.forEach(function (d) {
      if (!d.daten || !d.daten.legacyKey) w.push(t('warn_ohne_key', { id: d.id }));
      else if (d.daten.legacyKey !== d.id) w.push(t('warn_id', { id: d.id, key: d.daten.legacyKey }));
    });
    return w;
  }

  /* ---------- Einheiten: die eine Stelle (seit 13.10.2026, Baustelle #64) ----------
     Regel (Konzept 2026-10-13_RICHTWERT_VERBRAUCH.md §5.3, Ulf 07:45–07:51):
       1. Der Träger ist die Zähl- und Planungseinheit, je Produkt genau einer.
          `einheit` sagt, welcher (Blech, Lochblech, Diele …) — oder Stück.
       2. Stück ist neutral: keine Umrechnung, stueckProBlech spielt keine Rolle.
       3. Stück ist die gemeinsame Währung (nur beim Zusammenzählen, z. B. Teig).
       4. Jede Bedarfszahl verlässt bos_verbrauch_durchschnitt.js in der
          `einheit` des Produkts. Die Aufrufer rechnen nicht mehr um.
       5. `einheit` ist Pflicht; fehlt sie, meldet das der Editor.
     Übergang, solange `einheit` fehlt: gerechnet wird wie ein Träger mit
     stueckProBlech (so rechneten die Stationen bisher; der Backzettel bleibt
     damit byte-gleich). art 'fehlt' bleibt unterscheidbar, damit Mitschrift
     und Editor die Lücke zeigen können — die Station zeigt nichts davon.
     Neutral: 'stueck'/'stück' in jeder Schreibweise, getrimmt. Jeder andere
     nicht leere Wert ist ein Träger.
     Wer sonst durch stueckProBlech teilt oder damit malnimmt, wird vom
     Wächter (_PRUEF_einheiten_waechter.js) gemeldet. */
  var EINHEIT_NEUTRAL = ['stueck', 'stück'];
  /* Kurzformen an der Station (Ulf, 13.10.2026, 12:04). */
  /* 16.10.2026 (#67, Ulf 12:38): 'halbes kuchenblech' fest, sonst ergäbe die …blech-Regel „HaBl.“. */
  var EINHEIT_KURZ_FEST = { lochblech: 'LoBl.', kuchenblech: 'KuBl.', 'halbes kuchenblech': 'halbKuBl.', schlawinerblech: 'SchlaBl.' };

  function grossAnfang(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function einheitKurz(text) {
    var k = text.toLowerCase().replace(/bleche$/, 'blech');
    if (k === 'blech') return 'Bl.';
    if (k.indexOf('diele') !== -1) return 'Dl.';
    if (EINHEIT_KURZ_FEST[k]) return EINHEIT_KURZ_FEST[k];
    if (/blech$/.test(k)) return grossAnfang(k.slice(0, 2)) + 'Bl.';
    return grossAnfang(text.slice(0, 4)) + '.';
  }
  function einheitEinzahl(text) {
    var s = text;
    if (/^bleche?$/i.test(s)) return 'Blech';
    if (/dielen$/i.test(s)) s = s.slice(0, -1);
    else if (/bleche$/i.test(s)) s = s.slice(0, -1);
    return grossAnfang(s);
  }
  /* produkt: Objekt mit `einheit` und `stueckProBlech` (z. B. aus lade()).
     Liefert, wie gezählt, umgerechnet und angezeigt wird. */
  function einheit(produkt) {
    var p = produkt || {};
    var roh = (typeof p.einheit === 'string') ? p.einheit.trim() : '';
    var spb = Number(p.stueckProBlech);
    var hatFaktor = spb > 0 && isFinite(spb);
    if (roh && EINHEIT_NEUTRAL.indexOf(roh.toLowerCase()) !== -1) {
      return { art: 'stueck', traeger: null, kurz: 'Stk.', lang: 'Stück', einzahl: 'Stück', faktor: 1, hatFaktor: hatFaktor };
    }
    if (!roh) {
      return { art: 'fehlt', traeger: null, kurz: 'Bl.', lang: 'Bleche', einzahl: 'Träger', faktor: hatFaktor ? spb : 1, hatFaktor: hatFaktor };
    }
    return {
      art: 'traeger', traeger: roh, kurz: einheitKurz(roh),
      lang: /^bleche?$/i.test(roh) ? 'Bleche' : grossAnfang(roh),
      einzahl: einheitEinzahl(roh), faktor: hatFaktor ? spb : 1, hatFaktor: hatFaktor
    };
  }
  /* Stück → Einheit des Produkts (bei Stück unverändert). */
  function stueckInEinheit(stueck, produkt) {
    var e = einheit(produkt);
    return e.art === 'stueck' ? stueck : stueck / e.faktor;
  }
  /* Einheit des Produkts → Stück (bei Stück unverändert). */
  function einheitInStueck(menge, produkt) {
    var e = einheit(produkt);
    return e.art === 'stueck' ? menge : menge * e.faktor;
  }
  /* Auswahlliste der Einheiten (Ulf, 13.10.2026, 14:44, „Passt so“) — EINE
     Stelle für Editor, Richtwert (#63) und spätere Seiten. Gespeichert wird
     der Listentext genau so. „Andere …“ (Freitext) bietet die Seite selbst an. */
  /* 16.10.2026 (#67, Ulf 12:33/12:38): „Halbes Kuchenblech“ (60×20) hinter „Kuchenblech“ (60×40). */
  var EINHEITEN_LISTE = ['Stück', 'Blech', 'Lochblech', 'Kuchenblech', 'Halbes Kuchenblech', 'Schlawinerblech', 'Rote Diele', 'Blaue Diele'];
  /* Normalform zum Vergleichen: getrimmt, klein, Leerzeichen zusammengefasst,
     Stück-Schreibweisen → 'stück', Mehrzahl …bleche → …blech, …dielen → …diele.
     'bleche' = 'Blech', 'Rote Dielen' = 'rote Diele', 'stueck' = 'Stück'. */
  function einheitNorm(wert) {
    var s = (typeof wert === 'string' ? wert : '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s) return '';
    if (EINHEIT_NEUTRAL.indexOf(s) !== -1) return 'stück';
    return s.replace(/bleche$/, 'blech').replace(/dielen$/, 'diele');
  }
  /* Welcher Listeneintrag entspricht diesem Wert? null, wenn keiner (oder leer). */
  function einheitListenEintrag(wert) {
    var n = einheitNorm(wert);
    if (!n) return null;
    for (var i = 0; i < EINHEITEN_LISTE.length; i++) if (einheitNorm(EINHEITEN_LISTE[i]) === n) return EINHEITEN_LISTE[i];
    return null;
  }
  /* Ist der Text eine Stations-Kurzform (Stk., Bl., Dl., LoBl., KuBl., halbKuBl., SchlaBl. — auch ohne Punkt)? */
  function einheitIstKurzform(wert) {
    var n = (typeof wert === 'string' ? wert : '').trim().toLowerCase().replace(/\.$/, '');
    if (!n) return false;
    var kurz = EINHEITEN_LISTE.map(function (e) { return einheit({ einheit: e }).kurz.toLowerCase().replace(/\.$/, ''); });
    return kurz.indexOf(n) !== -1;
  }
  /* Bedeuten zwei einheit-Werte dasselbe? ('stueck' = 'Stück', 'bleche' = 'Blech',
     'Rote Dielen' = 'rote Diele') — seit 13.10.2026 (Nachtrag 1) über die Normalform. */
  function einheitGleich(a, b) {
    var ea = einheit({ einheit: a }), eb = einheit({ einheit: b });
    if (ea.art !== eb.art) return false;
    if (ea.art !== 'traeger') return true;
    return einheitNorm(ea.traeger) === einheitNorm(eb.traeger);
  }

  /* ---------- Bedarfsquelle, Richtwert, Saison-Pause (seit 15.10.2026, #63) ----------
     Reine Logik ohne Datenbank, die EINE Stelle für Host, Editor, Stationen,
     Schnellrechner und Tests (SESSION_2026-10-14_RICHTWERT_BAU.md).
     Felder am Produkt (Glossar produkt_config_felder.json):
       bedarfsQuelle  'richtwert' | 'offiziell' | 'manuell'. Fehlt das Feld
                      (oder ist der Wert unbekannt), gilt 'manuell' — das, womit
                      die Stationen bis zum 15.10. von selbst rechneten.
       richtwert      sieben Werte Mo = 0 … So = 6 (wie needs[]), je Zahl ≥ 0
                      oder null (leer). Leer ≠ 0. In der Einheit des Produkts.
       pausiert       true oder fehlt (Saison-Pause, Haken „Aktiv“ im Editor).
     Datenbankwerte bleiben 'offiziell'/'manuell'; angezeigt wird QUELLEN_TEXT
     (Ulf E2: Richtwert · Backzettel · Mitschrift).
     Backtage (Ulf 14.10., 19:07/19:18): backTage zählt wie Date.getDay()
     (0 = So), needs[] ab Montag (0 = Mo). Beide meinen den Tag, FÜR den
     gebacken wird (Bauplan §10) — nur die Zählung ist verschoben:
       needs-Index i  ↔  backTage-Wert (i + 1) % 7. */
  var QUELLEN = ['richtwert', 'offiziell', 'manuell'];
  var QUELLE_VORGABE = 'manuell';
  var QUELLEN_TEXT = { richtwert: 'Richtwert', offiziell: 'Backzettel', manuell: 'Mitschrift' };
  var WT_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  function bedarfsQuelle(produkt) {
    var q = produkt && produkt.bedarfsQuelle;
    return QUELLEN.indexOf(q) !== -1 ? q : QUELLE_VORGABE;
  }
  function quelleText(q) { return QUELLEN_TEXT[q] || QUELLEN_TEXT[QUELLE_VORGABE]; }
  function istPausiert(produkt) { return !!produkt && produkt.pausiert === true; }
  /* needs-Index (Mo = 0) → backTage-Wert (So = 0) und zurück. */
  function backtagWert(index) { return (index + 1) % 7; }
  function needsIndex(backtag) { return (backtag + 6) % 7; }
  /* Gültige Backtage des Produkts (Zahlen 0–6), oder null = „alle Tage offen“:
     Feld fehlt, ist keine Liste, ist leer oder enthält keine gültige Zahl
     (Altlast Schlawiner-Kürzel bis 28.08.). Leere Liste = offen, sonst wäre
     das Produkt an jedem Tag 0 und warnte nie (Bauplan §10). */
  function backtagWerte(produkt) {
    var b = produkt && produkt.backTage;
    if (!Array.isArray(b)) return null;
    var g = [];
    b.forEach(function (x) { if (typeof x === 'number' && x >= 0 && x <= 6 && Math.floor(x) === x && g.indexOf(x) === -1) g.push(x); });
    return g.length ? g : null;
  }
  /* Je needs-Index (Mo = 0 … So = 6): ist das ein Backtag? Ohne Backtage: alle true. */
  function backtagIndizes(produkt) {
    var g = backtagWerte(produkt), r = [];
    for (var i = 0; i < 7; i++) r.push(g === null || g.indexOf(backtagWert(i)) !== -1);
    return r;
  }
  /* Die sieben gespeicherten Richtwerte, bereinigt: Zahl ≥ 0 oder null. */
  function richtwertWerte(produkt) {
    var r = produkt && produkt.richtwert, w = [];
    for (var i = 0; i < 7; i++) {
      var x = Array.isArray(r) ? r[i] : null;
      w.push(typeof x === 'number' && isFinite(x) && x >= 0 ? x : null);
    }
    return w;
  }
  function richtwertLeer(produkt) { return richtwertWerte(produkt).every(function (x) { return x === null; }); }
  /* Leere Richtwert-Tage, die zählen: nur Backtage (Ulf 14.10.). */
  function richtwertLueckenTage(produkt) {
    var w = richtwertWerte(produkt), bt = backtagIndizes(produkt), t = [];
    for (var i = 0; i < 7; i++) if (bt[i] && w[i] === null) t.push(WT_KURZ[i]);
    return t;
  }
  /* Rundung in der Einheit des Produkts: Stück ganze Zahl, sonst eine Nachkommastelle. */
  function rundeRichtwert(wert, produkt) {
    if (typeof wert !== 'number' || !isFinite(wert)) return null;
    return einheit(produkt).art === 'stueck' ? Math.round(wert) : Math.round(wert * 10) / 10;
  }
  /* Eingabe eines Kästchens → { ok, wert (Zahl|null), fehler }.
     Komma oder Punkt; leer = null; negativ, keine Zahl oder bei Stück eine
     Nachkommastelle = Fehler (nichts still gerundet); bei Trägern wird auf
     eine Nachkommastelle gerundet (sichtbar, weil das Feld den Wert zeigt). */
  function richtwertZahl(eingabe, produkt) {
    if (eingabe === null || eingabe === undefined) return { ok: true, wert: null, fehler: '' };
    if (typeof eingabe === 'number') eingabe = String(eingabe);
    var t = String(eingabe).trim().replace(/\s+/g, '');
    if (!t) return { ok: true, wert: null, fehler: '' };
    if (!/^\d+([.,]\d*)?$|^[.,]\d+$/.test(t)) {
      return { ok: false, wert: null, fehler: /^-/.test(t) ? 'keine negative Zahl' : '„' + String(eingabe).trim() + '“ ist keine Zahl' };
    }
    var z = Number(t.replace(',', '.'));
    if (!isFinite(z)) return { ok: false, wert: null, fehler: '„' + String(eingabe).trim() + '“ ist keine Zahl' };
    if (einheit(produkt).art === 'stueck' && Math.floor(z) !== z) return { ok: false, wert: null, fehler: 'bei Stück nur ganze Zahlen' };
    return { ok: true, wert: rundeRichtwert(z, produkt), fehler: '' };
  }
  /* Sieben Eingaben → { ok, werte[7], fehler: ['Di: „1,5“ — bei Stück nur ganze Zahlen', …] }. */
  function richtwertPruefen(liste, produkt) {
    var werte = [], fehler = [];
    for (var i = 0; i < 7; i++) {
      var e = Array.isArray(liste) ? liste[i] : null;
      var z = richtwertZahl(e, produkt);
      werte.push(z.ok ? z.wert : null);
      if (!z.ok) fehler.push(WT_KURZ[i] + ': „' + String(e).trim() + '“ — ' + z.fehler);
    }
    return { ok: fehler.length === 0, werte: werte, fehler: fehler };
  }
  /* Anzeige eines Werts mit Komma (leer bleibt leer). */
  function richtwertText(wert) {
    return typeof wert === 'number' && isFinite(wert) ? String(wert).replace('.', ',') : '';
  }

  /* ---------- Die Mechanik, mit austauschbarer Umgebung (Tests) ---------- */
  function erstelle(umg) {
    umg = umg || {};
    var holeDb = umg.db || function () { return global.db; };
    var holeAuth = umg.authReady || function () { return global.BOS_AUTH_READY; };
    var holeFirebase = umg.firebase || function () { return global.firebase; };
    var speicher = umg.speicher || (function () {
      try { return global.localStorage; } catch (e) { return null; }
    })();
    var istOnline = umg.online || function () { return !global.navigator || global.navigator.onLine !== false; };
    var jetzt = umg.jetzt || function () { return Date.now(); };
    var zeitlimitMs = umg.zeitlimitMs || ZEITLIMIT_MS;
    var zeitnetzMs = (typeof umg.zeitnetzMs === 'number') ? umg.zeitnetzMs : ZEITNETZ_MS;
    var dokument = umg.dokument || function () { return global.document; };

    var laufend = null;      /* Promise des Vollabrufs dieser Seite */
    var laufendNurServer = false;

    function liesKopie() {
      if (!speicher) return null;
      try {
        var k = JSON.parse(speicher.getItem(KOPIE_KEY) || 'null');
        if (!k || !Array.isArray(k.roh) || !k.roh.length || typeof k.zeit !== 'number') return null;
        return k;
      } catch (e) { return null; }
    }
    function schreibeKopie(roh, standNummer, standZeit) {
      if (!speicher || !roh.length) return;
      try {
        speicher.setItem(KOPIE_KEY, JSON.stringify({ zeit: jetzt(), stand: standNummer, standZeit: standZeit, roh: roh }));
      } catch (e) { /* voll oder gesperrt: egal, dann gibt es keine Kopie */ }
    }
    function kopieErgebnis(k, quelle, grund) {
      return {
        roh: k.roh, quelle: quelle,
        stand: new Date(k.standZeit || k.zeit), standNummer: (typeof k.stand === 'number') ? k.stand : null,
        kopieZeit: new Date(k.zeit),
        grund: grund || null, warnungen: warnungenFuer(k.roh)
      };
    }
    function kopieFrisch(k) {
      return !zeitnetzMs || (jetzt() - k.zeit) < zeitnetzMs;
    }

    /* F1: „Konto gesperrt“ oder „Regel zu alt“? Nur im Fehlerfall, zwei Lesevorgänge. */
    function unterscheideBerechtigung(db, nutzer, original) {
      var kennung = nutzer && nutzer.email ? String(nutzer.email).split('@')[0] : null;
      if (!kennung) return Promise.resolve(fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original));
      return mitZeitlimit(db.collection('bos_accounts').doc(kennung).get({ source: 'server' }), zeitlimitMs)
        .then(function (konto) {
          var daten = konto && konto.exists ? (konto.data() || {}) : null;
          if (!daten || daten.freigeschaltet !== true) {
            return fehler('keine_berechtigung', t('keine_berechtigung'), original);
          }
          /* Konto in Ordnung → liegt es an der Regel? */
          return mitZeitlimit(db.collection('bos_regelstand').doc(REGEL_FASSUNG).get({ source: 'server' }), zeitlimitMs)
            .then(function () {
              /* Regel kennt die Fassung, Konto hat den Haken, trotzdem abgelehnt: unerwartet. */
              return fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original);
            }, function (e2) {
              if (artAus(e2) === 'keine_berechtigung') {
                return fehler('regel_alt', t('regel_alt', { datei: REGEL_DATEI, fassung: REGEL_FASSUNG }), original, { regelDatei: REGEL_DATEI, regelFassung: REGEL_FASSUNG });
              }
              return fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original);
            });
        }, function () {
          return fehler('keine_berechtigung', t('keine_berechtigung_unklar'), original);
        });
    }

    /* Fehler der Datenbank in unseren Fehler übersetzen; bei Berechtigung mit Unterscheidung. */
    function uebersetze(err, db, nutzer) {
      var art = artAus(err);
      if (art === 'keine_berechtigung') return unterscheideBerechtigung(db, nutzer, err);
      if (art === 'zeitlimit') return Promise.resolve(fehler('zeitlimit', t('zeitlimit', { s: zeitlimitMs / 1000 }), err));
      return Promise.resolve(fehler(art, t(art), err));
    }

    /* Liest den Stand-Zettel. Ergebnis: { nummer, zeit } oder null (gibt es nicht). */
    function liesStand(db) {
      return mitZeitlimit(db.collection(STAND_COLLECTION).doc(STAND_DOK).get({ source: 'server' }), zeitlimitMs)
        .then(function (dok) {
          if (dok && dok.metadata && dok.metadata.fromCache) { var e = new Error('Antwort aus dem Zwischenspeicher'); e.code = 'unavailable'; throw e; }
          if (!dok || !dok.exists) return null;
          var d = dok.data() || {};
          return { nummer: (typeof d.nummer === 'number') ? d.nummer : null, zeit: zeitMs(d.geaendertAm) };
        });
    }

    function vollabruf(db) {
      return mitZeitlimit(db.collection(COLLECTION).get({ source: 'server' }), zeitlimitMs)
        .then(function (snap) {
          if (snap && snap.metadata && snap.metadata.fromCache) { var e = new Error('Antwort aus dem Zwischenspeicher'); e.code = 'unavailable'; throw e; }
          var roh = [];
          snap.forEach(function (d) { roh.push({ id: d.id, daten: d.data() }); });
          return roh;
        });
    }

    /* Der eigentliche Ablauf. Liefert { roh, quelle, stand, standNummer, grund, warnungen }. */
    function holeRoh(opt) {
      var nurServer = !!opt.nurServer;
      var db = holeDb();
      var auth = holeAuth();
      if (typeof holeFirebase() === 'undefined' || !db || !auth) {
        return Promise.reject(fehler('nicht_geladen', t('nicht_geladen'), new Error('window.db oder window.BOS_AUTH_READY fehlt')));
      }
      var nutzer = null;
      return Promise.resolve(auth).then(function (n) { nutzer = n; }, function (err) {
        throw fehler('nicht_angemeldet', t('nicht_angemeldet'), err);
      }).then(function () {
        var kopie = nurServer ? null : liesKopie();

        /* Das Gerät sagt selbst „kein Netz“: nicht 10 s warten (F9). */
        if (!istOnline()) {
          var eNetz = fehler('kein_netz', t('kein_netz'), new Error('navigator.onLine = false'));
          if (kopie) return kopieErgebnis(kopie, 'geraetekopie', eNetz);
          throw eNetz;
        }

        return liesStand(db).then(function (stand) {
          var nummer = stand ? stand.nummer : null;
          /* Alltag: Stand gleich, Kopie jung genug → vom Gerät, ohne Hinweis. */
          if (!opt.frisch && kopie && nummer !== null && kopie.stand === nummer && kopieFrisch(kopie)) {
            return kopieErgebnis(kopie, 'geraetekopie_aktuell', null);
          }
          return vollabruf(db).then(function (roh) {
            if (!roh.length) throw fehler('leer', t('leer'), new Error('0 Dokumente in ' + COLLECTION));
            var standZeit = stand && stand.zeit ? stand.zeit : jetzt();
            if (!nurServer) schreibeKopie(roh, nummer, standZeit);
            return { roh: roh, quelle: 'server', stand: new Date(standZeit), standNummer: nummer, kopieZeit: null, grund: null, warnungen: warnungenFuer(roh) };
          }, function (err) {
            return uebersetze(err, db, nutzer).then(function (f) {
              if (kopie && liefertKopie(f.art)) return kopieErgebnis(kopie, 'geraetekopie', f);
              throw f;
            });
          });
        }, function (err) {
          return uebersetze(err, db, nutzer).then(function (f) {
            if (kopie && liefertKopie(f.art)) return kopieErgebnis(kopie, 'geraetekopie', f);
            throw f;
          });
        });
      });
    }

    function lade(opt) {
      opt = opt || {};
      var name = opt.sicht || 'aktive';
      if (['aktive', 'alle', 'roh', 'laufend'].indexOf(name) === -1) return Promise.reject(fehler('fehler', 'Unbekannte Sicht „' + name + '“'));
      var nurServer = !!opt.nurServer;
      if (!laufend || opt.frisch || nurServer !== laufendNurServer) {
        laufendNurServer = nurServer;
        laufend = holeRoh(opt);
        laufend.catch(function () { laufend = null; });   /* nächster Aufruf versucht es neu */
      }
      return laufend.then(function (e) {
        return {
          liste: sicht(e.roh, name), quelle: e.quelle, stand: e.stand, standNummer: e.standNummer,
          kopieZeit: e.kopieZeit, grund: e.grund, warnungen: e.warnungen
        };
      });
    }

    /* Text für die Seite: '' im Normalfall, sonst der Hinweis zur Gerätekopie. */
    function hinweisText(e) {
      if (!e || e.quelle !== 'geraetekopie') return '';
      var grund = e.grund && e.grund.art ? kopieGrund(e.grund.art) : t('kopie_grund_netz');
      return t('kopie', { zeit: zeitText(e.kopieZeit || e.stand), grund: grund });
    }
    function fehlerText(err) {
      if (!err) return t('fehler');
      var m = err.meldung || err.message || String(err);
      return err.original && err.original !== m ? m + ' (' + err.original + ')' : m;
    }

    /* Schmale Meldezeile oben für Seiten ohne eigene Meldestelle (F12).
       art: 'fehler' (rot) | 'hinweis' (bernstein). Nur textContent, nie HTML. */
    function zeigeMeldung(text, art) {
      var doc = dokument();
      if (!doc || !doc.body) return;
      var el = doc.getElementById(MELDUNG_ID);
      if (!text) { if (el) el.remove(); return; }
      if (!el) {
        el = doc.createElement('div');
        el.id = MELDUNG_ID;
        el.setAttribute('role', 'alert');
        doc.body.insertBefore(el, doc.body.firstChild);
      }
      var farbe = art === 'fehler' ? 'var(--bos-red, #d6584a)' : 'var(--bos-warn, var(--bos-amber, #c07a10))';
      el.style.cssText = [
        'position:sticky', 'top:0', 'z-index:2147483000', 'box-sizing:border-box', 'width:100%',
        'padding:8px 14px', 'font-family:var(--bos-font-body, Barlow, sans-serif)', 'font-size:var(--bos-font-sm, 0.82rem)',
        'line-height:1.4', 'color:var(--bos-text, #f3ece1)', 'background:var(--bos-surface-raised, #2b2218)',
        'border-left:4px solid ' + farbe, 'border-bottom:1px solid var(--bos-border, rgba(255,255,255,0.08))',
        'word-break:break-word'
      ].join(';');
      el.textContent = text;
    }
    function versteckeMeldung() { zeigeMeldung('', ''); }

    /* Für Fehlerleisten anderer Seiten: Fehler mit Hinweis anzeigen, Ergebnis zurück. */
    return {
      lade: lade,
      hinweisText: hinweisText,
      fehlerText: fehlerText,
      zeigeMeldung: zeigeMeldung,
      versteckeMeldung: versteckeMeldung,
      /* Konstanten für Sync-Tool, Editor und Tests */
      COLLECTION: COLLECTION, STAND_COLLECTION: STAND_COLLECTION, STAND_DOK: STAND_DOK,
      KOPIE_KEY: KOPIE_KEY, REGEL_FASSUNG: REGEL_FASSUNG, REGEL_DATEI: REGEL_DATEI, DB_FELDER: DB_FELDER,
      ZEITLIMIT_MS: zeitlimitMs, ZEITNETZ_MS: zeitnetzMs,
      /* reine Logik, auch für den Sync-Export */
      sicht: sicht, vergleich: vergleich, warnungenFuer: warnungenFuer, mitZeitlimit: mitZeitlimit,
      /* Einheiten, die eine Stelle (13.10.2026, #64) */
      einheit: einheit, stueckInEinheit: stueckInEinheit, einheitInStueck: einheitInStueck,
      einheitGleich: einheitGleich, EINHEIT_NEUTRAL: EINHEIT_NEUTRAL.slice(),
      /* Auswahlliste (13.10.2026, Nachtrag 1) */
      EINHEITEN_LISTE: EINHEITEN_LISTE.slice(), einheitListenEintrag: einheitListenEintrag,
      einheitNorm: einheitNorm, einheitIstKurzform: einheitIstKurzform,
      /* Bedarfsquelle, Richtwert, Saison-Pause (15.10.2026, #63) */
      bedarfsQuelle: bedarfsQuelle, quelleText: quelleText, istPausiert: istPausiert,
      QUELLEN: QUELLEN.slice(), QUELLE_VORGABE: QUELLE_VORGABE, QUELLEN_TEXT: JSON.parse(JSON.stringify(QUELLEN_TEXT)),
      WT_KURZ: WT_KURZ.slice(), backtagWert: backtagWert, needsIndex: needsIndex,
      backtagWerte: backtagWerte, backtagIndizes: backtagIndizes,
      richtwertWerte: richtwertWerte, richtwertLeer: richtwertLeer, richtwertLueckenTage: richtwertLueckenTage,
      rundeRichtwert: rundeRichtwert, richtwertZahl: richtwertZahl, richtwertPruefen: richtwertPruefen,
      richtwertText: richtwertText
    };
  }

  var api = erstelle();
  api.erstelle = erstelle;
  global.BOS_PRODUKTE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
