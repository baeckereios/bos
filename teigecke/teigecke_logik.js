/* ================================================================
   BäckereiOS · Teigecke — reine Logik (kein DOM, kein Firestore)
   ================================================================
   Einbindung:  <script src="teigecke_logik.js"></script>
   Stellt bereit: window.BOS_TEIGECKE_LOGIK
   Test:        node test_teigecke.js   (im Projekt-Wurzelordner)

   Warum eine eigene Datei: alles, was hier steht, lässt sich ohne
   Browser prüfen (Backtag, Vorauswahl, Einsammelliste, Löschschutz,
   Startdaten-Prüfung). Die Seite teigecke_nacht.html ruft nur auf.

   WICHTIG — keine Daten in dieser Datei: keine Zutatennamen, keine
   Teignamen, keine Mengen. Das Repo ist öffentlich (Grundsatz
   „Schutzbedarf“, Konzept Punkt 36). Beispiele in Kommentaren sind
   bewusst Platzhalter.

   CHANGELOG
     2026-10-03 · 14:47 · v0.9 · Refactor (QR-Teil zieht in die Wurzel)
       ANWEISUNG_2026-10-03_NFC_QR_ZENTRALE_STUFE1.md (KC, 11:51).
       istLokal und qrSvg sind nach ../bos_qr.js umgezogen (dort kopiert,
       nicht nachgebaut). basisAdresse, basisBereinigt und qrAdresse sind
       entfallen: das Adressfeld der Orte-Seite gibt es nicht mehr, die
       Adresse bildet BOS_QR.adresse() aus der Wurzel und dem Pfad der
       Registry. schildHTML kennt o.qrLeer (leeres Feld statt Code).
     2026-10-03 · 04:42 · v0.8 · Feature (Orte-Seite, Schild quer mit QR)
       ANWEISUNG_2026-10-02_TEIGECKE_ORTE_HUB.md (KC 03.10., 03:42),
       Bauplan SESSION_2026-10-03_TEIGECKE_ORTE_HUB_BAU.md (freigegeben).
       Kennung = Bereich (ein Großbuchstabe) + laufende Nummer („B01“):
       KENNUNG_ORT, kennungZerlegen, kennungBilden, ortIdAus,
       naechsteNummer (höchste + 1, archivierte zählen mit, Lücken
       bleiben), BEREICH_VORGABEN, bereichsListe, bereichGueltig, sucheOrt.
       Reihenfolge auf dem Schild: zutatenInSchildFolge,
       schildFolgeBereinigt (Feld schildFolge am Ort; NICHT „sort“, das
       ist die Reihenfolge im Gang). QR: istLokal, basisAdresse,
       qrAdresse, qrSvg. gebindeText. ortDokument kennt bereich,
       bereichName, schildFolge. schildHTML/SCHILD_CSS neu: A4 quer,
       Kennung links, Zutaten mit Gebinde rechts (ab 9 zweispaltig),
       QR unten links, „Powered by BäckereiOS“ unten rechts; die
       Schriftgröße der Liste setzt die Seite (einpassen statt Stufen).
     2026-10-02 · 10:30 · v0.7 · Feature
       vorstufeSchritte: jede Option trägt zuWenig (Schritte × Schrittmenge
       < Bedarf) und broteBedarf (Brote der Prognose) — für die rötliche
       Markierung der kleineren Stufe (Anweisung Rötlich, KC 02.10., 10:13).
     2026-10-02 · 09:34 · v0.6 · Feature
       behaelterZeilen: je Behälter eine Zeile mit seinen Mengen
       („graue Wanne 1: 9 kg … + 27 L …“), nummeriert; Ulf 02.10., §5.1a.
     2026-10-02 · 08:54 · v0.5 · Feature (Vorrat, Rumpf-Teige, Vorstufen-Schritte)
       Anweisung ANWEISUNG_2026-09-30_TEIGECKE_VORRAT.md mit Anhang 1–3.
       Vorrats-Teige: istVorratsTeig/vorratsTeige (Merkmal ausTeig UND
       frosterZustaendigkeit, kein neues Feld); teigeDesTages und vorauswahl
       nehmen sie nur, wenn sie für den Backtag angehakt sind.
       teiglingeStueck: Bleche/Dielen → Stück über stueckProBlech.
       Vorstufen in festen Schritten: parseSchritt, schrittText,
       vorstufeSchritte (zwei Nachbarn, Vorbelegung aufgerundet, „reicht
       für“), behaelterAufteilung (gleichmäßig, höchstens n je Behälter).
       mitSauer darf fehlen (= unbekannt, nicht „nein“): importPlan und
       teigDokument übernehmen es nur, wenn es gesetzt ist.
       importPlan nimmt Version 2 und 3; neue Teigfelder vorstufeSchritt,
       vorstufeSchritteJeBehaelter, vorstufeBehaelter und (vorgemerkt,
       Punkt 56) winbackFeld, winbackName, vorstufeWinbackFeld,
       vorstufeWinbackName.
     2026-10-02 · 07:03 · v0.4 · Fix (Sicherheit der Anzeige)
       Neu: mengeJeKessel(gesamt, anzahl) — die Zahl, die bei Chargen
       eingegeben bzw. abgewogen wird, steht vorn („2 × 106,6 kg“), die
       Gesamtmenge nur als Zweitinformation („213,2 kg gesamt“). Anlass:
       Die Liste zeigte „213,2 kg (2×)“, lesbar als zweimal 213,2 kg —
       wer das wörtlich nimmt, macht die doppelte Menge (Ulf, 02.10.2026).
     2026-09-29 · 19:45 · v0.3 · Umbau + Feature (Stufe 2)
       Umbau: „welche Brote aus welchem Teig“ kommt jetzt aus dem Feld
       ausTeig je Produkt (produkt_config.json), nicht mehr aus der Liste
       produkte im Teig. Entfallen: produktKonflikte, unbekannteProdukte,
       produktGehoertZu (ein Feld je Produkt kann keinen Konflikt haben).
       Neu: unbekannterTeig, teigeDesTages, produkteDesTeigs, kennungAus.
       Stufe 2: rechneTeig (Teigmenge D, Wasserabzug r, WinBack-Eingabe
       T = D + r, Kessel, Hefe auf T), wasserRegelLiterJeKg, interpoliere,
       sauerAnsatz, reichtPruefung, anpassungHeute, folge-Helfer,
       importPlan Version 2 (Teig-Kennungen, Rezeptwerte, Einwaagen).
       Weiterhin keine Daten in dieser Datei (Repo öffentlich).
       Siehe SESSION_2026-09-29_TEIGECKE_STUFE2_BAU.md.
     2026-09-29 · 09:18 · v0.2 · Feature
       istVeraltet(vorher, frisch): Hat sich ein Dokument seit dem Laden
       geändert? Grundlage für die Konfliktmeldung der Seite, seit die
       Regel den Inhalt von „vorher“ gegen den Serverstand prüft (RK §10).
     2026-09-28 · 10:33 · v0.1 · Feature
       Erstfassung, Teigecke Stufe 1 (Wagen & Zuhause).
       Siehe SESSION_2026-09-28_TEIGECKEN_STUFE1_BAU.md.
   ================================================================ */
(function (global) {
  'use strict';

  var UMSCHALT_STUNDE = 12;   // Ulf, 28.09.2026: ab 12:00 gilt der Backtag „morgen“

  /* ---------- Backtag ----------
     backTage in der Produkt-Config (seit 05.10.2026 aus Firestore) = der Tag, FÜR den gebacken wird
     (Nacht zum Mittwoch = Mittwoch). Lokal gerechnet, nie über
     toISOString() — das ist UTC und liefert zwischen 0 und 2 Uhr den
     Vortag (Checkliste §13). */
  function backtag(jetzt, umschaltStunde) {
    var grenze = (typeof umschaltStunde === 'number') ? umschaltStunde : UMSCHALT_STUNDE;
    var d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    if (jetzt.getHours() >= grenze) d.setDate(d.getDate() + 1);
    return d;
  }
  function naechsterTag(d) {
    var n = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    n.setDate(n.getDate() + 1);
    return n;
  }
  function datumStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- Grundhelfer ---------- */
  function aktiv(liste) { return (liste || []).filter(function (x) { return x && !x.geloescht; }); }
  function nachId(liste) { var m = {}; (liste || []).forEach(function (x) { if (x && x.id) m[x.id] = x; }); return m; }
  function norm(text) { return String(text || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function produktMap(produkte) { var m = {}; (produkte || []).forEach(function (p) { if (p && p.legacyKey) m[p.legacyKey] = p; }); return m; }

  /* Welche Produkte zählen als „Brot der Nachtschicht“? Maßgeblich für
     den Hinweis „noch kein Teig hinterlegt“. Filter nach den echten
     Feldern der Produkt-Config (kategorie, station), geprüft 28.09.2026. */
  function istNachtBrot(p) { return !!p && p.kategorie === 'Brot' && p.station === 'Nachtschicht'; }
  function wirdGebacken(p, wochentag) { return !!p && Array.isArray(p.backTage) && p.backTage.indexOf(wochentag) !== -1; }

  /* ---------- Teig ↔ Produkte (seit Stufe 2: Feld ausTeig am Produkt) ----------
     Die Zuordnung pflegt Ulf in der Produkt-Config. Ein Produkt hat genau
     ein Feld, kann also nie in zwei Teigen stehen. */
  function produkteDesTeigs(kennung, produkte, wochentag) {
    return (produkte || []).filter(function (p) {
      return p && p.ausTeig === kennung && (typeof wochentag !== 'number' || wirdGebacken(p, wochentag));
    });
  }
  function sortName(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'de'); }

  /* Teige des Tages in der Abwiegefolge: erst die gepflegte Reihenfolge des
     Wochentags, dann alles Übrige nach sort, dann nach Name. */
  /* Vorrats-Teig (Konzept Punkt 53): mindestens ein Brot des Teigs trägt
     ausTeig UND frosterZustaendigkeit — gemacht wird auf Vorrat für den
     Froster, nicht nach Backzettel. Eine Quelle, kein eigenes Feld. */
  function istVorratsTeig(kennung, produkte) {
    return produkteDesTeigs(kennung, produkte).some(function (p) { return !!p.frosterZustaendigkeit; });
  }
  function vorratsTeige(teige, produkte) {
    return aktiv(teige).filter(function (t) { return istVorratsTeig(t.id, produkte); }).sort(sortName);
  }
  /* Teige des Tages: Backzettel-Teige, deren Brote an dem Wochentag gebacken
     werden; Vorrats-Teige NUR, wenn sie für den Backtag angehakt sind
     (vorrat = { kennung: true }). Ohne Haken: nicht in der Liste, kein Status. */
  function teigeDesTages(teige, produkte, wochentag, folge, vorrat) {
    var haken = vorrat || {};
    var liste = aktiv(teige).filter(function (t) {
      if (istVorratsTeig(t.id, produkte)) return haken[t.id] === true;
      return produkteDesTeigs(t.id, produkte, wochentag).length > 0;
    });
    return sortiereNachFolge(liste, folge);
  }
  /* Teiglinge eines Vorrats-Brots in Stück: Eingabe in Blechen/Dielen wird
     über stueckProBlech umgerechnet. null bei ungültiger Eingabe. */
  function teiglingeStueck(zahl, einheit, stueckProBlech) {
    if (!istZahl(zahl) || zahl < 0 || Math.floor(zahl) !== zahl) return null;
    if (einheit === 'bleche') return istZahl(stueckProBlech) && stueckProBlech > 0 ? zahl * stueckProBlech : null;
    return zahl;
  }
  function sortiereNachFolge(teige, folge) {
    var pos = {};
    (folge || []).forEach(function (k, i) { if (pos[k] === undefined) pos[k] = i; });
    return teige.slice().sort(function (a, b) {
      var pa = pos[a.id] !== undefined ? pos[a.id] : 1e6, pb = pos[b.id] !== undefined ? pos[b.id] : 1e6;
      if (pa !== pb) return pa - pb;
      var sa = typeof a.sort === 'number' ? a.sort : 1e6, sb = typeof b.sort === 'number' ? b.sort : 1e6;
      if (sa !== sb) return sa - sb;
      return sortName(a, b);
    });
  }
  /* „Wie Montag übernehmen“: Reihenfolge des Quelltags auf die Teige des
     Zieltags anwenden; Teige, die es am Quelltag nicht gibt, kommen hinten
     in ihrer bisherigen Folge dazu. */
  function folgeUebernehmen(quellFolge, zielIds) {
    var ziel = {}; (zielIds || []).forEach(function (k) { ziel[k] = true; });
    var neu = (quellFolge || []).filter(function (k) { return ziel[k]; });
    (zielIds || []).forEach(function (k) { if (neu.indexOf(k) === -1) neu.push(k); });
    return neu;
  }
  function verschiebe(liste, index, richtung) {
    var neu = liste.slice(), ziel = index + richtung;
    if (index < 0 || index >= neu.length || ziel < 0 || ziel >= neu.length) return neu;
    var x = neu[index]; neu[index] = neu[ziel]; neu[ziel] = x;
    return neu;
  }

  /* Einsammeln-Vorauswahl: Teige, deren Brote an diesem Wochentag gebacken werden. */
  function vorauswahl(teige, produkte, wochentag, vorrat) {
    return teigeDesTages(teige, produkte, wochentag, null, vorrat).map(function (t) { return t.id; });
  }
  /* Nachtbrote, die an dem Tag gebacken werden, aber keinen Teig haben —
     offene Baustelle, sichtbar statt versteckt. */
  function ohneTeig(produkte, teige, wochentag) {
    return (produkte || []).filter(function (p) { return istNachtBrot(p) && wirdGebacken(p, wochentag) && !p.ausTeig; });
  }
  /* Produkte, die auf einen Teig zeigen, den es nicht (mehr) gibt. */
  function unbekannterTeig(produkte, teige) {
    var tm = nachId(aktiv(teige));
    return (produkte || []).filter(function (p) { return p && p.ausTeig && !tm[p.ausTeig]; });
  }
  /* Lesbare, feste Teig-Kennung aus dem Namen (Dokument-ID, wie legacyKey). */
  function kennungAus(name) {
    return String(name || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  }
  var KENNUNG_MUSTER = /^[a-z0-9_]{2,40}$/;

  /* ---------- Orte sortieren ---------- */
  function ortVergleich(a, b) {
    var sa = (typeof a.sort === 'number') ? a.sort : 9999;
    var sb = (typeof b.sort === 'number') ? b.sort : 9999;
    if (sa !== sb) return sa - sb;
    return String(a.kennung || a.name || '').localeCompare(String(b.kennung || b.name || ''), 'de', { numeric: true });
  }

  /* ---------- Einsammelliste ----------
     feld: 'zutaten' (Hauptteig, heute Nacht) oder 'vorstufeZutaten'
     (Vorbereitung für den nächsten Backtag). beiBedarf-Zutaten stehen
     bewusst NICHT drin (nur Teig- und Orts-Ansicht).
     Ergebnis: Gruppen nach Ort, in Gangreihenfolge; „noch ohne Zuhause“
     und „unbekannt“ am Ende, damit nichts verschwindet. */
  function einsammelliste(teigIds, teige, zutaten, orte, feld) {
    var tm = nachId(teige), zm = nachId(zutaten), om = nachId(orte);
    var sammel = {};   // zutatId -> { zutat, teige: [namen] }
    (teigIds || []).forEach(function (tid) {
      var t = tm[tid];
      if (!t || t.geloescht) return;
      (t[feld] || []).forEach(function (zid) {
        if (!sammel[zid]) sammel[zid] = { zutatId: zid, zutat: zm[zid] || null, teige: [] };
        if (sammel[zid].teige.indexOf(t.name) === -1) sammel[zid].teige.push(t.name);
      });
    });
    var gruppen = {};  // ortId | '_ohne' | '_unbekannt'
    Object.keys(sammel).forEach(function (zid) {
      var e = sammel[zid];
      var schluessel;
      if (!e.zutat || e.zutat.geloescht) schluessel = '_unbekannt';
      else if (!e.zutat.ortId || !om[e.zutat.ortId] || om[e.zutat.ortId].geloescht) schluessel = '_ohne';
      else schluessel = e.zutat.ortId;
      (gruppen[schluessel] = gruppen[schluessel] || []).push(e);
    });
    var sortName = function (a, b) {
      return String(a.zutat ? a.zutat.name : a.zutatId).localeCompare(String(b.zutat ? b.zutat.name : b.zutatId), 'de');
    };
    var ergebnis = Object.keys(gruppen).filter(function (k) { return k.charAt(0) !== '_'; })
      .map(function (k) { return { art: 'ort', ort: om[k], eintraege: gruppen[k].sort(sortName) }; })
      .sort(function (a, b) { return ortVergleich(a.ort, b.ort); });
    if (gruppen._ohne) ergebnis.push({ art: 'ohne', ort: null, eintraege: gruppen._ohne.sort(sortName) });
    if (gruppen._unbekannt) ergebnis.push({ art: 'unbekannt', ort: null, eintraege: gruppen._unbekannt.sort(sortName) });
    return ergebnis;
  }

  /* ---------- Orts-Ansicht ---------- */
  function ortInhalt(orte, zutaten) {
    var om = nachId(orte);
    var inhalt = { _ohne: [] };
    aktiv(orte).forEach(function (o) { inhalt[o.id] = []; });
    aktiv(zutaten).forEach(function (z) {
      if (z.ortId && om[z.ortId] && !om[z.ortId].geloescht) inhalt[z.ortId].push(z);
      else inhalt._ohne.push(z);
    });
    Object.keys(inhalt).forEach(function (k) {
      inhalt[k].sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'de'); });
    });
    return inhalt;
  }

  /* ---------- Löschschutz (Archivieren) ---------- */
  function zutatenAmOrt(ortId, zutaten) { return aktiv(zutaten).filter(function (z) { return z.ortId === ortId; }); }
  function teigeMitZutat(zutatId, teige) {
    return aktiv(teige).filter(function (t) {
      return ['zutaten', 'vorstufeZutaten', 'beiBedarf'].some(function (f) { return (t[f] || []).indexOf(zutatId) !== -1; });
    });
  }

  /* ---------- Konflikt: seit dem Laden geändert? (29.09.2026) ----------
     Die Regel lehnt ein Speichern ab, wenn „vorher“ nicht dem Serverstand
     gleicht. permission-denied ist dann mehrdeutig (Recht fehlt ODER jemand
     war schneller). Die Seite liest das Dokument frisch und fragt hier.
     Verglichen wird die sicherungId: Jedes gelungene Schreiben setzt laut
     Regel eine NEUE — gleiche sicherungId heißt also unverändert. Das ist
     gleichwertig zum Vollvergleich, aber unabhängig davon, wie
     Zeitstempel-Objekte im Browser verglichen werden. */
  function istVeraltet(vorher, frisch) {
    if (!vorher) return false;                 // Anlegen: nichts zu vergleichen
    if (!frisch) return true;                  // Dokument fehlt jetzt
    return String(frisch.sicherungId || '') !== String(vorher.sicherungId || '');
  }

  /* ---------- Namensgleichheit ---------- */
  function namensKonflikt(liste, name, ausserId, feld) {
    var f = feld || 'name';
    var n = norm(name);
    return aktiv(liste).filter(function (x) { return x.id !== ausserId && norm(x[f]) === n; })[0] || null;
  }

  /* ================================================================
     STUFE 2 — Rechnungen (Konzept §3–§5). Alle Mengen in kg bzw. L,
     Einwaagen in g. Gerundet wird erst in der Anzeige.
     ================================================================ */
  function istZahl(x) { return typeof x === 'number' && isFinite(x); }
  function aufrunden(wert, schritt) { return Math.ceil(wert / schritt - 1e-9) * schritt; }

  /* Wasserregel: gepflegt an der echten Menge („bei 83 Broten 2 L“),
     intern je kg Teig vor der Wasserkorrektur (Konzept §4.3). */
  function wasserRegelLiterJeKg(liter, refKg) {
    if (!istZahl(liter) || !istZahl(refKg) || refKg <= 0) return null;
    return liter / refKg;
  }

  /* Tabelle Außentemperatur → Wert. Linear zwischen den beiden nächsten
     Zeilen, außerhalb der Randwert mit Hinweis, leere Tabelle = leer. */
  function interpoliere(tabelle, aussenC, feld) {
    var zeilen = (tabelle || []).filter(function (z) { return z && istZahl(z.aussenC) && istZahl(z[feld]); })
      .sort(function (a, b) { return a.aussenC - b.aussenC; });
    if (!zeilen.length) return { leer: true, wert: null, rand: false };
    if (!istZahl(aussenC)) return { leer: false, wert: null, rand: false, ohneTemperatur: true };
    if (aussenC <= zeilen[0].aussenC) return { leer: false, wert: zeilen[0][feld], rand: aussenC < zeilen[0].aussenC };
    var letzte = zeilen[zeilen.length - 1];
    if (aussenC >= letzte.aussenC) return { leer: false, wert: letzte[feld], rand: aussenC > letzte.aussenC };
    for (var i = 0; i < zeilen.length - 1; i++) {
      var a = zeilen[i], b = zeilen[i + 1];
      if (aussenC >= a.aussenC && aussenC <= b.aussenC) {
        var anteil = (aussenC - a.aussenC) / (b.aussenC - a.aussenC);
        return { leer: false, wert: a[feld] + (b[feld] - a[feld]) * anteil, rand: false };
      }
    }
    return { leer: true, wert: null, rand: false };
  }

  /* Ein Teig für eine Nacht.
     posten: [{ lk, anzahl (Zahl oder fehlt = nicht eingetragen), einwaageG }]
     D = Σ Anzahl × Einwaage + Kesselrest (einmal je Teig, Ulf 29.09.)
     r = Wasserabzug (Nacht-Abweichung vor Regel × D); ohne Schüttwasser 0
     T = D + r → WinBack. Hefe auf T (Auflage KC: WinBack verteilt alles auf T).
     Kessel: gleichmäßig, Wasser anteilig. */
  function rechneTeig(o) {
    var posten = o.posten || [];
    var eingetragen = posten.filter(function (p) { return istZahl(p.anzahl); });
    var erg = { status: 'leer', fehlendeEinwaage: [], summeKg: null, D: null, rRegel: null, r: null, T: null,
      kessel: null, jeKesselKg: null, jeKesselL: null, hefeRezeptKg: null, hefeDeltaKg: null, hefeKg: null, anzahl: 0 };
    if (!eingetragen.length) return erg;
    erg.anzahl = eingetragen.reduce(function (s, p) { return s + p.anzahl; }, 0);
    erg.fehlendeEinwaage = eingetragen.filter(function (p) { return p.anzahl > 0 && !(istZahl(p.einwaageG) && p.einwaageG > 0); })
      .map(function (p) { return p.lk; });
    var alle = eingetragen.length === posten.length;
    if (erg.fehlendeEinwaage.length) { erg.status = 'einwaageFehlt'; return erg; }
    erg.summeKg = eingetragen.reduce(function (s, p) { return s + (p.anzahl > 0 ? p.anzahl * p.einwaageG / 1000 : 0); }, 0);
    if (alle && erg.anzahl === 0) { erg.status = 'null'; erg.D = 0; erg.r = 0; erg.T = 0; return erg; }
    var kesselrest = istZahl(o.kesselrestKg) ? o.kesselrestKg : 0;
    erg.D = erg.summeKg + kesselrest;
    if (o.ohneSchuettwasser) { erg.rRegel = 0; erg.r = 0; }
    else {
      erg.rRegel = istZahl(o.literJeKg) ? o.literJeKg * erg.D : null;
      erg.r = istZahl(o.wasserL) ? o.wasserL : (erg.rRegel || 0);
    }
    erg.T = erg.D + erg.r;
    var max = istZahl(o.kesselMaxKg) && o.kesselMaxKg > 0 ? o.kesselMaxKg : 190;
    erg.kessel = Math.max(1, Math.ceil(erg.T / max - 1e-9));
    erg.jeKesselKg = erg.T / erg.kessel;
    erg.jeKesselL = erg.r / erg.kessel;
    if (istZahl(o.hefeJeKg)) {
      erg.hefeRezeptKg = o.hefeJeKg * erg.T;
      erg.hefeDeltaKg = (istZahl(o.hefeDeltaG) && istZahl(o.rezeptBasisKg) && o.rezeptBasisKg > 0)
        ? (o.hefeDeltaG / 1000) * erg.T / o.rezeptBasisKg : 0;
      erg.hefeKg = erg.hefeRezeptKg + erg.hefeDeltaKg;
    }
    if (istZahl(o.hefeKg)) erg.hefeKg = o.hefeKg;   // Nacht-Abweichung
    erg.status = alle ? 'fertig' : 'teilweise';
    return erg;
  }

  /* Anzeige bei Chargen (02.10.2026, Sicherheitsregel): Vorn steht immer
     die Zahl, die je Kessel/Charge eingegeben oder abgewogen wird, mit dem
     Multiplikator davor („2 × 106,6 kg“). Die Gesamtmenge erscheint nur
     getrennt als „213,2 kg gesamt“ — nie als führende Zahl neben einem „×“.
     einheit: 'kg' oder 'L'; stellen: Nachkommastellen (Vorgabe 1). */
  function deZahl(x, stellen) { return x.toFixed(stellen).replace('.', ','); }
  function mengeJeKessel(gesamt, anzahl, einheit, stellen) {
    if (!istZahl(gesamt)) return null;
    var n = istZahl(anzahl) && anzahl > 1 ? Math.round(anzahl) : 1;
    var st = istZahl(stellen) ? stellen : 1, e = einheit || 'kg';
    var je = gesamt / n;
    if (n === 1) return { n: 1, haupt: deZahl(je, st) + ' ' + e, gesamt: null, jeWert: je };
    return { n: n, haupt: n + ' × ' + deZahl(je, st) + ' ' + e, gesamt: deZahl(gesamt, st) + ' ' + e + ' gesamt', jeWert: je };
  }

  /* Vorstufen in festen Schritten (Konzept §5.1a, Punkt 55). Ein Schritt ist
     eine feste Ansatz-Portion, z. B. „3 kg Schrot + 9 L Wasser“. Text ↔
     Liste [{ menge, einheit: 'kg'|'L', name }]; 1 L Wasser = 1 kg. */
  function parseSchritt(text) {
    var teile = String(text || '').split('+').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!teile.length) return { schritt: null, fehler: null };
    var schritt = [], fehler = null;
    teile.forEach(function (teil) {
      var m = /^(\d+(?:[.,]\d+)?)\s*(kg|l)\s+(.+)$/i.exec(teil);
      if (!m) { fehler = fehler || teil; return; }
      var menge = Number(m[1].replace(',', '.'));
      if (!(menge > 0)) { fehler = fehler || teil; return; }
      schritt.push({ menge: menge, einheit: m[2].toLowerCase() === 'l' ? 'L' : 'kg', name: m[3].trim() });
    });
    return fehler ? { schritt: null, fehler: fehler } : { schritt: schritt, fehler: null };
  }
  function istSchritt(schritt) {
    return Array.isArray(schritt) && schritt.length > 0 && schritt.every(function (z) {
      return z && istZahl(z.menge) && z.menge > 0 && (z.einheit === 'kg' || z.einheit === 'L') && typeof z.name === 'string' && z.name.trim();
    });
  }
  function schrittKg(schritt) { return istSchritt(schritt) ? schritt.reduce(function (s, z) { return s + z.menge; }, 0) : null; }
  function schrittText(schritt, faktor) {
    var f = istZahl(faktor) ? faktor : 1;
    return (schritt || []).map(function (z) { return deZahl(z.menge * f, (z.menge * f) % 1 ? 1 : 0) + ' ' + z.einheit + ' ' + z.name; }).join(' + ');
  }
  /* Gleichmäßig auf Behälter, höchstens jeBehaelter Schritte je Behälter:
     6 bei 3 → [3, 3]; 7 bei 3 → [3, 2, 2]. */
  function behaelterAufteilung(n, jeBehaelter) {
    if (!istZahl(n) || n <= 0) return [];
    var je = istZahl(jeBehaelter) && jeBehaelter >= 1 ? Math.floor(jeBehaelter) : n;
    var b = Math.ceil(n / je), grund = Math.floor(n / b), rest = n % b, liste = [];
    for (var i = 0; i < b; i++) liste.push(grund + (i < rest ? 1 : 0));
    return liste;
  }
  /* Je Behälter eine Zeile mit seinen Mengen (Ulf, 02.10.2026): Name aus dem
     Rezept, nummeriert ab 1; ohne Namen „Behälter“. Ein einzelner Behälter
     bekommt keine Nummer. */
  function behaelterZeilen(schritt, aufteilung, name) {
    var kg = schrittKg(schritt);
    if (!kg || !Array.isArray(aufteilung) || !aufteilung.length) return [];
    var n = String(name || '').trim() || 'Behälter';
    return aufteilung.map(function (anzahl, i) {
      return { name: aufteilung.length > 1 ? n + ' ' + (i + 1) : n, schritte: anzahl, kg: anzahl * kg, text: schrittText(schritt, anzahl) };
    });
  }
  /* Auswahl für die Nacht: die zwei Nachbarn um den Bedarf, vorbelegt
     aufgerundet. Geht der Bedarf genau auf, sind es n und n + 1.
     „reicht für“ = Brote der Prognose × Schrittmenge ÷ Bedarf (abgerundet). */
  function vorstufeSchritte(bedarfKg, schritt, jeBehaelter, broteAnzahl) {
    var kg = schrittKg(schritt);
    if (!kg || !istZahl(bedarfKg) || bedarfKg <= 0) return null;
    var x = bedarfKg / kg, oben = Math.ceil(x - 1e-9), unten = Math.floor(x + 1e-9);
    var auswahl = unten === oben ? [oben, oben + 1] : [unten, oben];
    if (auswahl[0] < 1) auswahl = [oben, oben + 1];
    var option = function (n) {
      return { n: n, kg: n * kg, reichtBrote: istZahl(broteAnzahl) && broteAnzahl > 0 ? Math.floor(broteAnzahl * n * kg / bedarfKg + 1e-9) : null,
        broteBedarf: istZahl(broteAnzahl) && broteAnzahl > 0 ? broteAnzahl : null,
        zuWenig: n * kg < bedarfKg - 1e-9,   // rechnerisch zu wenig — bleibt wählbar (Ulf, 02.10.)
        behaelter: behaelterAufteilung(n, jeBehaelter) };
    };
    return { schrittKg: kg, vorschlag: oben, optionen: auswahl.map(option) };
  }

  /* Sauer (Konzept §5.2): Mindestmenge = Bedarf ÷ (1 − Anstellgut-Anteil),
     aufrunden auf die 30er-Stufe; liegt die mehr als „schwelle“ über der
     Mindestmenge, auf die 15er-Stufe. Chargen ≤ 90 kg gleichmäßig. */
  var SAUER_VORGABE = { stufeKg: 30, halbStufeKg: 15, schwelleKg: 20, chargeMaxKg: 90 };
  function sauerAnsatz(bedarfKg, anteil, einst) {
    var e = {}; Object.keys(SAUER_VORGABE).forEach(function (k) { e[k] = (einst && istZahl(einst[k]) && einst[k] > 0) ? einst[k] : SAUER_VORGABE[k]; });
    if (einst && istZahl(einst.schwelleKg) && einst.schwelleKg >= 0) e.schwelleKg = einst.schwelleKg;
    if (!istZahl(bedarfKg) || bedarfKg <= 0) return { bedarfKg: 0, mindestKg: 0, ansatzKg: 0, chargen: 0, jeChargeKg: 0, anstellgutKg: 0 };
    if (!istZahl(anteil) || anteil <= 0 || anteil >= 1) return null;
    var M = bedarfKg / (1 - anteil);
    var voll = aufrunden(M, e.stufeKg), halb = aufrunden(M, e.halbStufeKg);
    var ansatz = (voll - M > e.schwelleKg) ? halb : voll;
    var n = Math.max(1, Math.ceil(ansatz / e.chargeMaxKg - 1e-9));
    return { bedarfKg: bedarfKg, mindestKg: M, stufe30Kg: voll, ansatzKg: ansatz, chargen: n, jeChargeKg: ansatz / n, anstellgutKg: anteil * ansatz };
  }
  /* Reicht-Prüfung: gestriger Ansatz − Sauer für die Teige von heute (auf T)
     ≥ Anstellgut für den neuen Ansatz? Kein Vorschlag (Konzept Punkt 34). */
  function reichtPruefung(ansatzGesternKg, sauerHeuteKg, anstellgutNeuKg) {
    if (!istZahl(ansatzGesternKg) || !istZahl(sauerHeuteKg) || !istZahl(anstellgutNeuKg)) return null;
    var rest = ansatzGesternKg - sauerHeuteKg;
    return { restKg: rest, reicht: rest >= anstellgutNeuKg - 1e-9, fehltKg: Math.max(0, anstellgutNeuKg - rest) };
  }

  /* Nacht-Anpassungen liegen in EINEM Dokument mit Feld backtag (Auflage
     KC, Punkt 39 bleibt offen): passt der Backtag nicht, gilt es als leer. */
  function anpassungHeute(dok, backtagStr) {
    return (dok && dok.backtag === backtagStr && dok.teige && typeof dok.teige === 'object') ? dok.teige : {};
  }

  /* ---------- Startdaten-Datei (Version 2, außerhalb des Repos) ----------
     Eine Datei für alles: Orte, Zutaten, Teige mit Kennung, Rezeptwerte
     je kg und Einwaagen. Unbekannte Felder werden abgelehnt (keine
     Einzelmengen durch die Hintertür). Einwaage null = „fehlt noch“. */
  var IMPORT_FELDER = {
    kopf: ['version', 'hinweis', 'orte', 'zutaten', 'teige'],
    ort: ['kennung', 'name', 'art', 'beschreibung', 'sort'],
    zutat: ['name', 'ort', 'gebindeGroesse', 'gebindeEinheit'],
    teig: ['kennung', 'name', 'istSauerteig', 'mitSauer', 'hinweisOben', 'zutaten', 'vorstufe', 'vorstufeZutaten', 'vorstufeHinweis',
      'beiBedarf', 'sauerJeKg', 'hefeJeKg', 'vorstufeJeKg', 'anstellgutAnteil', 'rezeptBasisKg', 'ohneSchuettwasser', 'sort',
      'einwaage', 'kesselMaxKg', 'kesselrestKg',
      'vorstufeSchritt', 'vorstufeSchritteJeBehaelter', 'vorstufeBehaelter',
      'winbackFeld', 'winbackName', 'vorstufeWinbackFeld', 'vorstufeWinbackName']
  };
  var TEIG_TEXTE_NEU = ['vorstufeBehaelter', 'winbackFeld', 'winbackName', 'vorstufeWinbackFeld', 'vorstufeWinbackName'];
  var TEIG_ZAHLEN = ['sauerJeKg', 'hefeJeKg', 'vorstufeJeKg', 'anstellgutAnteil', 'rezeptBasisKg', 'kesselMaxKg'];
  var EINHEITEN = ['', 'kg', 'l', 'stk'];

  function fremdeFelder(obj, erlaubt) {
    return Object.keys(obj || {}).filter(function (k) { return erlaubt.indexOf(k) === -1; });
  }

  function importPlan(datei, bestand, produkte) {
    var fehler = [], hinweise = [], einwaagen = [];
    var plan = { orte: [], zutaten: [], teige: [] };
    var ergebnis = function () { return { plan: plan, fehler: fehler, hinweise: hinweise, einwaagen: einwaagen }; };
    if (!datei || typeof datei !== 'object' || Array.isArray(datei)) {
      fehler.push('Die Datei ist kein Startdaten-Objekt (erwartet { version, orte, zutaten, teige }).');
      return ergebnis();
    }
    if (datei.version === 1) fehler.push('Das ist die alte Startdaten-Datei vom 28.09. (Version 1). Seit Stufe 2 gilt Version 2 mit Teig-Kennungen und Rezeptwerten.');
    else if (datei.version !== 2 && datei.version !== 3) fehler.push('Unbekannte Version „' + datei.version + '“ — erwartet 2 oder 3.');
    fremdeFelder(datei, IMPORT_FELDER.kopf).forEach(function (k) { fehler.push('Unbekanntes Feld oben in der Datei: „' + k + '“.'); });
    ['orte', 'zutaten', 'teige'].forEach(function (k) {
      if (datei[k] !== undefined && !Array.isArray(datei[k])) fehler.push('„' + k + '“ muss eine Liste sein.');
    });
    if (fehler.length) return ergebnis();

    var best = bestand || { orte: [], zutaten: [], teige: [] };
    var pm = produktMap(produkte);

    var ortKennungen = {};
    aktiv(best.orte).forEach(function (o) { ortKennungen[norm(o.kennung)] = { vorhanden: true, id: o.id }; });
    (datei.orte || []).forEach(function (o, i) {
      var wo = 'Ort Nr. ' + (i + 1);
      fremdeFelder(o, IMPORT_FELDER.ort).forEach(function (k) { fehler.push(wo + ': unbekanntes Feld „' + k + '“.'); });
      if (!o || typeof o.kennung !== 'string' || !o.kennung.trim()) { fehler.push(wo + ': Kennung fehlt.'); return; }
      if (typeof o.name !== 'string' || !o.name.trim()) fehler.push(wo + ' (' + o.kennung + '): Name fehlt.');
      if (o.art !== undefined && ['wagen', 'ort'].indexOf(o.art) === -1) fehler.push(wo + ': Art muss „wagen“ oder „ort“ sein.');
      var n = norm(o.kennung);
      if (ortKennungen[n] && ortKennungen[n].vorhanden) { hinweise.push('Ort ' + o.kennung + ' gibt es schon — wird übersprungen.'); plan.orte.push({ aktion: 'vorhanden', daten: o }); return; }
      if (ortKennungen[n]) { fehler.push(wo + ': Kennung „' + o.kennung + '“ steht doppelt in der Datei.'); return; }
      ortKennungen[n] = { vorhanden: false };
      plan.orte.push({ aktion: 'neu', daten: o });
    });

    var zutatNamen = {};
    aktiv(best.zutaten).forEach(function (z) { zutatNamen[norm(z.name)] = { vorhanden: true, id: z.id }; });
    (datei.zutaten || []).forEach(function (z, i) {
      var wo = 'Zutat Nr. ' + (i + 1);
      fremdeFelder(z, IMPORT_FELDER.zutat).forEach(function (k) { fehler.push(wo + ': unbekanntes Feld „' + k + '“.'); });
      if (!z || typeof z.name !== 'string' || !z.name.trim()) { fehler.push(wo + ': Name fehlt.'); return; }
      if (z.ort !== undefined && z.ort !== '' && !ortKennungen[norm(z.ort)]) fehler.push(wo + ' (' + z.name + '): Ort „' + z.ort + '“ gibt es weder in der Datei noch im Bestand.');
      if (z.gebindeGroesse !== undefined && z.gebindeGroesse !== null && (typeof z.gebindeGroesse !== 'number' || !(z.gebindeGroesse > 0))) fehler.push(wo + ' (' + z.name + '): Gebindegröße muss eine Zahl über 0 sein.');
      if (z.gebindeEinheit !== undefined && EINHEITEN.indexOf(z.gebindeEinheit) === -1) fehler.push(wo + ' (' + z.name + '): Einheit muss kg, l, stk oder leer sein.');
      var n = norm(z.name);
      if (zutatNamen[n] && zutatNamen[n].vorhanden) { hinweise.push('Zutat „' + z.name + '“ gibt es schon — wird übersprungen.'); plan.zutaten.push({ aktion: 'vorhanden', daten: z }); return; }
      if (zutatNamen[n]) { fehler.push(wo + ': „' + z.name + '“ steht doppelt in der Datei.'); return; }
      zutatNamen[n] = { vorhanden: false };
      plan.zutaten.push({ aktion: 'neu', daten: z });
    });

    var teigKennungen = {}, teigNamen = {};
    aktiv(best.teige).forEach(function (t) { teigKennungen[t.id] = true; teigNamen[norm(t.name)] = true; });
    var sauerteige = 0;
    (datei.teige || []).forEach(function (t, i) {
      var wo = 'Teig Nr. ' + (i + 1);
      fremdeFelder(t, IMPORT_FELDER.teig).forEach(function (k) { fehler.push(wo + ': unbekanntes Feld „' + k + '“.'); });
      if (!t || typeof t.name !== 'string' || !t.name.trim()) { fehler.push(wo + ': Name fehlt.'); return; }
      var wer = wo + ' (' + t.name + ')';
      if (typeof t.kennung !== 'string' || !KENNUNG_MUSTER.test(t.kennung)) { fehler.push(wer + ': Kennung fehlt oder ist ungültig (nur a–z, 0–9, _; 2–40 Zeichen).'); return; }
      if (teigKennungen[t.kennung] === true || teigNamen[norm(t.name)] === true) {
        hinweise.push('Teig „' + t.name + '“ gibt es schon — wird übersprungen (auch Einwaagen und Kessel).');
        plan.teige.push({ aktion: 'vorhanden', daten: t }); return;
      }
      if (teigKennungen[t.kennung] === 'datei' || teigNamen[norm(t.name)] === 'datei') { fehler.push(wer + ': steht doppelt in der Datei.'); return; }
      ['zutaten', 'vorstufeZutaten', 'beiBedarf'].forEach(function (f) {
        if (t[f] !== undefined && !Array.isArray(t[f])) { fehler.push(wer + ': „' + f + '“ muss eine Liste sein.'); return; }
        (t[f] || []).forEach(function (zn) {
          if (typeof zn !== 'string' || !zutatNamen[norm(zn)]) fehler.push(wer + ': Zutat „' + zn + '“ (' + f + ') gibt es weder in der Datei noch im Bestand.');
        });
      });
      ['vorstufe', 'hinweisOben', 'vorstufeHinweis'].concat(TEIG_TEXTE_NEU).forEach(function (f) { if (t[f] !== undefined && typeof t[f] !== 'string') fehler.push(wer + ': „' + f + '“ muss Text sein.'); });
      if (t.vorstufeSchritt !== undefined && !istSchritt(t.vorstufeSchritt)) fehler.push(wer + ': „vorstufeSchritt“ muss eine Liste aus { menge, einheit: kg oder L, name } sein.');
      if (t.vorstufeSchritt !== undefined && !String(t.vorstufe || '').trim()) fehler.push(wer + ': Vorstufen-Schritt ohne Namen der Vorstufe.');
      if (t.vorstufeSchritteJeBehaelter !== undefined && !(istZahl(t.vorstufeSchritteJeBehaelter) && t.vorstufeSchritteJeBehaelter >= 1 && Math.floor(t.vorstufeSchritteJeBehaelter) === t.vorstufeSchritteJeBehaelter)) fehler.push(wer + ': „vorstufeSchritteJeBehaelter“ muss eine ganze Zahl ab 1 sein.');
      if (t.mitSauer === undefined && !t.istSauerteig) hinweise.push(wer + ': ohne Angabe „mitSauer“ — gilt als „Sauer unbekannt“, bis es im Rezept gesetzt ist.');
      ['mitSauer', 'istSauerteig', 'ohneSchuettwasser'].forEach(function (f) { if (t[f] !== undefined && typeof t[f] !== 'boolean') fehler.push(wer + ': „' + f + '“ muss true oder false sein.'); });
      TEIG_ZAHLEN.forEach(function (f) {
        if (t[f] !== undefined && t[f] !== null && !(istZahl(t[f]) && t[f] > 0)) fehler.push(wer + ': „' + f + '“ muss eine Zahl über 0 sein.');
      });
      if (istZahl(t.anstellgutAnteil) && t.anstellgutAnteil >= 1) fehler.push(wer + ': Anstellgut-Anteil muss unter 1 liegen.');
      if (t.kesselrestKg !== undefined && t.kesselrestKg !== null && !(istZahl(t.kesselrestKg) && t.kesselrestKg >= 0)) fehler.push(wer + ': Kesselrest muss eine Zahl ab 0 sein.');
      if (t.sort !== undefined && !istZahl(t.sort)) fehler.push(wer + ': „sort“ muss eine Zahl sein.');
      if ((t.vorstufeZutaten || []).length && !String(t.vorstufe || '').trim()) fehler.push(wer + ': Vorstufen-Zutaten ohne Namen der Vorstufe.');
      if (t.istSauerteig) { sauerteige++; if (!istZahl(t.anstellgutAnteil)) hinweise.push(wer + ': Sauerteig ohne Anstellgut-Anteil — der Sauerrechner zeigt dann nichts an.'); }
      if (t.einwaage !== undefined) {
        if (!t.einwaage || typeof t.einwaage !== 'object' || Array.isArray(t.einwaage)) fehler.push(wer + ': „einwaage“ muss { Produkt-Schlüssel: Gramm } sein.');
        else Object.keys(t.einwaage).forEach(function (lk) {
          var g = t.einwaage[lk];
          if (g !== null && !(istZahl(g) && g > 0)) fehler.push(wer + ': Einwaage für „' + lk + '“ muss Gramm über 0 oder null (fehlt) sein.');
          if (!pm[lk]) hinweise.push(wer + ': Einwaage für „' + lk + '“ — dieses Produkt steht nicht in der Produkt-Config.');
          else if (pm[lk].ausTeig !== t.kennung) hinweise.push(wer + ': „' + (pm[lk].name || lk) + '“ gehört laut Produkt-Config zu „' + (pm[lk].ausTeig || 'keinem Teig') + '“, nicht zu „' + t.kennung + '“.');
          einwaagen.push({ teig: t.name, lk: lk, produkt: pm[lk] ? pm[lk].name : lk, gramm: istZahl(g) ? g : null });
        });
      }
      teigKennungen[t.kennung] = 'datei'; teigNamen[norm(t.name)] = 'datei';
      plan.teige.push({ aktion: 'neu', daten: t });
    });
    if (sauerteige > 1) fehler.push('Mehr als ein Teig ist als Sauerteig markiert.');
    return ergebnis();
  }

  /* Aus einem Plan-Eintrag das Firestore-Dokument bauen (ohne
     sicherungId/geaendertVon/geaendertAm — die setzt die Seite). */
  function ortDokument(o) {
    var d = { kennung: String(o.kennung).trim(), name: String(o.name || '').trim(), art: o.art === 'ort' ? 'ort' : 'wagen', beschreibung: String(o.beschreibung || '').trim(), geloescht: false };
    if (typeof o.sort === 'number') d.sort = o.sort;
    var z = kennungZerlegen(d.kennung);
    if (z) { d.bereich = z.bereich; d.bereichName = String(o.bereichName || '').trim(); }
    if (Array.isArray(o.schildFolge)) d.schildFolge = o.schildFolge.slice();
    return d;
  }
  function zutatDokument(z, ortIdVonKennung) {
    var d = { name: String(z.name).trim(), ortId: (z.ort && ortIdVonKennung[norm(z.ort)]) || '', geloescht: false };
    if (typeof z.gebindeGroesse === 'number') d.gebindeGroesse = z.gebindeGroesse;
    d.gebindeEinheit = z.gebindeEinheit || '';
    return d;
  }
  /* Rezept-Dokument (teigecke_teige/{kennung}, Rezept-Haken). */
  function teigDokument(t, zutatIdVonName) {
    var ids = function (liste) { return (liste || []).map(function (n) { return zutatIdVonName[norm(n)]; }).filter(Boolean); };
    var d = {
      name: String(t.name).trim(),
      istSauerteig: !!t.istSauerteig,
      ohneSchuettwasser: !!t.ohneSchuettwasser,
      hinweisOben: String(t.hinweisOben || '').trim(),
      zutaten: ids(t.zutaten),
      vorstufe: String(t.vorstufe || '').trim(),
      vorstufeZutaten: ids(t.vorstufeZutaten),
      vorstufeHinweis: String(t.vorstufeHinweis || '').trim(),
      beiBedarf: ids(t.beiBedarf),
      geloescht: false
    };
    /* mitSauer nur, wenn gesetzt: fehlt = „unbekannt“, nicht „nein“ (02.10.2026). */
    if (typeof t.mitSauer === 'boolean') d.mitSauer = t.mitSauer;
    else if (t.istSauerteig) d.mitSauer = false;
    ['sauerJeKg', 'hefeJeKg', 'vorstufeJeKg', 'anstellgutAnteil', 'rezeptBasisKg', 'sort', 'vorstufeSchritteJeBehaelter'].forEach(function (f) { if (istZahl(t[f])) d[f] = t[f]; });
    if (istSchritt(t.vorstufeSchritt)) d.vorstufeSchritt = t.vorstufeSchritt.map(function (z) { return { menge: z.menge, einheit: z.einheit, name: z.name.trim() }; });
    TEIG_TEXTE_NEU.forEach(function (f) { if (typeof t[f] === 'string' && t[f].trim()) d[f] = t[f].trim(); });
    return d;
  }
  /* Teigwerte-Dokument (teigecke_teigwerte/{kennung}, Teig-Haken) — nur,
     wenn die Datei Einwaagen oder Kesselwerte mitbringt. null-Einwaagen
     („fehlt noch“) werden weggelassen. */
  function teigwerteDokument(t) {
    var d = {}, einwaage = {};
    Object.keys(t.einwaage || {}).forEach(function (lk) { if (istZahl(t.einwaage[lk])) einwaage[lk] = t.einwaage[lk]; });
    if (Object.keys(einwaage).length) d.einwaage = einwaage;
    if (istZahl(t.kesselMaxKg)) d.kesselMaxKg = t.kesselMaxKg;
    if (istZahl(t.kesselrestKg)) d.kesselrestKg = t.kesselrestKg;
    return Object.keys(d).length ? d : null;
  }

  /* ---------- Wagenschild (Druck) ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* ================================================================
     ORTE (03.10.2026) — Kennung, Bereich, Schild-Reihenfolge, QR
     ================================================================
     Kennung = Bereich (EIN Großbuchstabe) + laufende Nummer, mindestens
     zweistellig: „B01“. Der Dokumentname des Orts ist die Kennung in
     Kleinbuchstaben („b01“) — so kann die Datenbank eine Kennung nicht
     zweimal halten (RK §14). Einmal B01, immer B01. */
  var KENNUNG_ORT = /^[A-Z][0-9]{2,3}$/;
  function bereichGueltig(b) { return typeof b === 'string' && /^[A-Z]$/.test(b); }
  function kennungZerlegen(kennung) {
    var k = String(kennung || '').trim().toUpperCase();
    if (!KENNUNG_ORT.test(k)) return null;
    return { bereich: k.charAt(0), nummer: parseInt(k.slice(1), 10), kennung: k };
  }
  function kennungBilden(bereich, nummer) {
    if (!bereichGueltig(bereich) || !(nummer >= 1 && nummer <= 999 && Math.floor(nummer) === nummer)) return null;
    return bereich + (nummer < 10 ? '0' : '') + nummer;
  }
  function ortIdAus(kennung) { var z = kennungZerlegen(kennung); return z ? z.kennung.toLowerCase() : null; }
  /* Nächste Nummer = höchste vergebene + 1. ALLE Orte zählen, auch
     archivierte: eine Lücke bleibt leer, vergeben wird nur nach oben. */
  function naechsteNummer(orte, bereich) {
    var max = 0;
    (orte || []).forEach(function (o) {
      var z = o && kennungZerlegen(o.kennung);
      if (z && z.bereich === bereich && z.nummer > max) max = z.nummer;
    });
    return max + 1;
  }
  /* Nur Vorschläge für die Auswahl, keine Bedeutung im Code. */
  var BEREICH_VORGABEN = [
    { bereich: 'B', name: 'Backstube' }, { bereich: 'K', name: 'Kühlung' }, { bereich: 'P', name: 'Palette' },
    { bereich: 'T', name: 'Tisch' }, { bereich: 'W', name: 'Wagen' }
  ];
  /* Bereiche aus den vorhandenen Orten (auch archivierten) plus Vorgaben.
     belegt: hat mindestens einen Ort → Buchstabe fest. namen: alle Wörter,
     die an Orten dieses Bereichs stehen (mehr als eins = angleichen). */
  function bereichsListe(orte) {
    var m = {};
    (orte || []).forEach(function (o) {
      var z = o && kennungZerlegen(o.kennung);
      if (!z) return;
      var e = m[z.bereich] || (m[z.bereich] = { bereich: z.bereich, name: '', namen: [], anzahl: 0, belegt: true });
      e.anzahl++;
      var w = String(o.bereichName || '').trim();
      if (w && e.namen.indexOf(w) === -1) e.namen.push(w);
    });
    Object.keys(m).forEach(function (b) { m[b].namen.sort(); m[b].name = m[b].namen[0] || ''; });
    BEREICH_VORGABEN.forEach(function (v) {
      if (!m[v.bereich]) m[v.bereich] = { bereich: v.bereich, name: v.name, namen: [v.name], anzahl: 0, belegt: false };
      else if (!m[v.bereich].name) m[v.bereich].name = v.name;
    });
    return Object.keys(m).sort().map(function (b) { return m[b]; });
  }
  /* Suche „b01“ / „B01“ / „ b01 “: aktiver Ort zuerst, sonst archivierter. */
  function sucheOrt(orte, text) {
    var z = kennungZerlegen(text);
    if (!z) return null;
    var treffer = (orte || []).filter(function (o) { return o && String(o.kennung || '').toUpperCase() === z.kennung; });
    return treffer.filter(function (o) { return !o.geloescht; })[0] || treffer[0] || null;
  }
  /* Kennung-Vergleich für die Orte-Seite: Bereich, dann Nummer. */
  function kennungVergleich(a, b) {
    var za = kennungZerlegen(a.kennung), zb = kennungZerlegen(b.kennung);
    if (za && zb) return za.bereich === zb.bereich ? za.nummer - zb.nummer : (za.bereich < zb.bereich ? -1 : 1);
    if (za || zb) return za ? -1 : 1;
    return String(a.kennung || '').localeCompare(String(b.kennung || ''), 'de', { numeric: true });
  }

  /* ---------- Reihenfolge auf dem Schild (Feld schildFolge am Ort) ----------
     Erst die gepflegte Reihenfolge, dann alle übrigen alphabetisch. IDs,
     die nicht (mehr) an diesem Ort wohnen, werden überlesen. */
  function zutatenInSchildFolge(ort, zutatenAmOrt) {
    var rest = (zutatenAmOrt || []).slice().sort(sortName);
    var m = nachId(rest), aus = [], drin = {};
    ((ort && ort.schildFolge) || []).forEach(function (id) {
      if (m[id] && !drin[id]) { aus.push(m[id]); drin[id] = true; }
    });
    rest.forEach(function (z) { if (!drin[z.id]) aus.push(z); });
    return aus;
  }
  function schildFolgeBereinigt(folgeIds, zutatenAmOrt) {
    var m = nachId(zutatenAmOrt || []), drin = {};
    return (folgeIds || []).filter(function (id) { if (!m[id] || drin[id]) return false; drin[id] = true; return true; });
  }
  function gebindeText(z) {
    if (!z || !istZahl(z.gebindeGroesse) || !(z.gebindeGroesse > 0)) return '';
    var e = { kg: 'kg', l: 'L', stk: 'Stk' }[z.gebindeEinheit || ''] || '';
    return String(z.gebindeGroesse).replace('.', ',') + (e ? ' ' + e : '');
  }

  /* ---------- QR ----------
     Seit 03.10.2026 (14:47) liegt der Adress- und QR-Teil in ../bos_qr.js
     (Wurzel): wurzel, adresse, istLokal, darfAusgeben, qrSvg, qrFuer.
     Hier steht dazu nichts mehr; die Orte-Seite ruft BOS_QR auf. */

  /* ---------- Schild: A4 quer, ein Ort je Seite (Ulf, 03.10.2026) ----------
     zutaten: bereits in Schild-Reihenfolge. o: { stand, qrSvg, qrLeer, schriftPt }.
     qrLeer: kein Code, aber ein leeres Feld an seiner Stelle (lokal, solange
     BOS nicht online ist; Ulf, 03.10.2026, 11:38).
     Die Schriftgröße der Liste (schriftPt) misst die Seite vor dem Druck
     ein; ohne Angabe gilt die CSS-Vorgabe. Ab 9 Zutaten zwei Spalten. */
  var SCHILD_ZWEISPALTIG_AB = 9;
  function schildHTML(ort, zutaten, o) {
    o = o || {};
    var liste = (zutaten || []).map(function (z) {
      var g = gebindeText(z);
      return '<li><span class="schild-zutat">' + esc(z.name) + '</span>' + (g ? '<span class="schild-gebinde">' + esc(g) + '</span>' : '') + '</li>';
    }).join('');
    var zwei = (zutaten || []).length >= SCHILD_ZWEISPALTIG_AB;
    return '<section class="schild">' +
      '<div class="schild-links"><div class="schild-kennung">' + esc(ort.kennung) + '</div>' +
        (ort.bereichName ? '<div class="schild-bereich">' + esc(ort.bereichName) + '</div>' : '') +
        (ort.name ? '<div class="schild-name">' + esc(ort.name) + '</div>' : '') + '</div>' +
      (liste ? '<ul class="schild-liste' + (zwei ? ' zwei' : '') + '"' + (o.schriftPt ? ' style="font-size:' + Number(o.schriftPt) + 'pt"' : '') + '>' + liste + '</ul>'
             : '<p class="schild-leer">(noch keine Zutaten zugeordnet)</p>') +
      '<div class="schild-fuss"><div class="schild-qr">' + (o.qrSvg || (o.qrLeer ? '<div class="schild-qr-leer"></div>' : '')) +
        (o.qrSvg ? '<div class="schild-qrtext">Scannen: dieses Schild ändern und neu drucken</div>'
                 : (o.qrLeer ? '<div class="schild-qrtext">Platz für den Code. Er kommt, sobald BäckereiOS online ist.</div>' : '')) + '</div>' +
        '<div class="schild-powered">Powered by BäckereiOS<small>Stand ' + esc(o.stand || '') + '</small></div></div>' +
      '</section>';
  }
  var SCHILD_SCHRIFT_MAX_PT = 32, SCHILD_SCHRIFT_MIN_PT = 10;
  var SCHILD_CSS =
    '.schild{width:297mm;height:209mm;box-sizing:border-box;padding:12mm 14mm 10mm;display:grid;grid-template-columns:98mm 1fr;' +
      'grid-template-rows:1fr auto;column-gap:10mm;overflow:hidden;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;' +
      'page-break-after:always;break-after:page;}' +
    '.schild:last-child{page-break-after:auto;break-after:auto;}' +
    '.schild,.schild *{box-sizing:border-box;}.schild{line-height:1.2;}' +
    '.schild-links{min-width:0;}' +
    '.schild-kennung{font-size:150pt;font-weight:900;line-height:.95;letter-spacing:-3px;white-space:nowrap;}' +
    '.schild-bereich{font-size:32pt;font-weight:700;margin-top:4mm;overflow-wrap:anywhere;}' +
    '.schild-name{font-size:18pt;color:#333;margin-top:2mm;overflow-wrap:anywhere;}' +
    '.schild-liste{list-style:none;margin:0;padding:0 0 0 9mm;border-left:1.2mm solid #000;align-self:start;font-size:24pt;' +
      'column-gap:9mm;column-rule:.3mm solid #bbb;min-width:0;}' +
    '.schild-liste.zwei{columns:2;}' +
    '.schild-liste li{display:flex;justify-content:space-between;align-items:baseline;gap:6mm;padding:.35em 0;border-bottom:.3mm solid #bbb;' +
      'font-weight:700;line-height:1.15;break-inside:avoid;}' +
    '.schild-zutat{overflow-wrap:anywhere;}' +
    '.schild-gebinde{font-size:.55em;font-weight:400;color:#333;white-space:nowrap;}' +
    '.schild-leer{font-size:16pt;color:#666;align-self:start;margin:0;padding-left:9mm;border-left:1.2mm solid #000;}' +
    '.schild-fuss{grid-column:1/3;display:flex;justify-content:space-between;align-items:flex-end;margin-top:5mm;}' +
    '.schild-qr svg{width:34mm;height:34mm;display:block;}' +
    '.schild-qr-leer{width:34mm;height:34mm;border:.4mm dashed #999;}' +
    '.schild-qrtext{font-size:8pt;color:#444;margin-top:1.5mm;}' +
    '.schild-powered{text-align:right;font-size:13pt;font-weight:700;}' +
    '.schild-powered small{display:block;font-size:8pt;font-weight:400;color:#444;margin-top:1mm;}';
  /* bos_druck.js legt um den Inhalt 12/15 mm Rand und Zeilenhöhe 1,75 —
     für ein Schild, das die ganze Seite füllt, muss das weg. */
  var SCHILD_DRUCK_CSS = '#bos-print-root{padding:0;}.bos-pa-body{font-size:12pt;line-height:normal;word-break:normal;}';

  var api = {
    UMSCHALT_STUNDE: UMSCHALT_STUNDE, EINHEITEN: EINHEITEN, KENNUNG_MUSTER: KENNUNG_MUSTER, SAUER_VORGABE: SAUER_VORGABE,
    backtag: backtag, naechsterTag: naechsterTag, datumStr: datumStr,
    aktiv: aktiv, nachId: nachId, norm: norm, produktMap: produktMap, istZahl: istZahl,
    istNachtBrot: istNachtBrot, wirdGebacken: wirdGebacken,
    produkteDesTeigs: produkteDesTeigs, teigeDesTages: teigeDesTages, sortiereNachFolge: sortiereNachFolge,
    folgeUebernehmen: folgeUebernehmen, verschiebe: verschiebe,
    vorauswahl: vorauswahl, ohneTeig: ohneTeig, unbekannterTeig: unbekannterTeig, kennungAus: kennungAus,
    ortVergleich: ortVergleich, einsammelliste: einsammelliste, ortInhalt: ortInhalt,
    zutatenAmOrt: zutatenAmOrt, teigeMitZutat: teigeMitZutat, namensKonflikt: namensKonflikt, istVeraltet: istVeraltet,
    istVorratsTeig: istVorratsTeig, vorratsTeige: vorratsTeige, teiglingeStueck: teiglingeStueck,
    parseSchritt: parseSchritt, istSchritt: istSchritt, schrittKg: schrittKg, schrittText: schrittText,
    behaelterAufteilung: behaelterAufteilung, behaelterZeilen: behaelterZeilen, vorstufeSchritte: vorstufeSchritte,
    wasserRegelLiterJeKg: wasserRegelLiterJeKg, interpoliere: interpoliere, rechneTeig: rechneTeig,
    sauerAnsatz: sauerAnsatz, reichtPruefung: reichtPruefung, anpassungHeute: anpassungHeute, mengeJeKessel: mengeJeKessel,
    importPlan: importPlan, ortDokument: ortDokument, zutatDokument: zutatDokument, teigDokument: teigDokument, teigwerteDokument: teigwerteDokument,
    esc: esc, schildHTML: schildHTML, SCHILD_CSS: SCHILD_CSS, SCHILD_DRUCK_CSS: SCHILD_DRUCK_CSS,
    SCHILD_SCHRIFT_MAX_PT: SCHILD_SCHRIFT_MAX_PT, SCHILD_SCHRIFT_MIN_PT: SCHILD_SCHRIFT_MIN_PT, SCHILD_ZWEISPALTIG_AB: SCHILD_ZWEISPALTIG_AB,
    KENNUNG_ORT: KENNUNG_ORT, bereichGueltig: bereichGueltig, kennungZerlegen: kennungZerlegen, kennungBilden: kennungBilden,
    ortIdAus: ortIdAus, naechsteNummer: naechsteNummer, BEREICH_VORGABEN: BEREICH_VORGABEN, bereichsListe: bereichsListe,
    sucheOrt: sucheOrt, kennungVergleich: kennungVergleich, zutatenInSchildFolge: zutatenInSchildFolge,
    schildFolgeBereinigt: schildFolgeBereinigt, gebindeText: gebindeText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_TEIGECKE_LOGIK = api;
})(typeof window !== 'undefined' ? window : globalThis);
