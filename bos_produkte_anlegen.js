/* ================================================================
   BäckereiOS · bos_produkte_anlegen.js — ein neues Produkt, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_PRODUKTE_ANLEGEN (im Browser) bzw.
   module.exports (Node, für die Prüfdatei).

   Einbindung neben bos_produkte.js / bos_produkte_schreiben.js, vor dem
   seiteneigenen Code:

     <script src="../bos_produkte.js"></script>
     <script src="../bos_produkte_schreiben.js"></script>
     <script src="../bos_produkte_anlegen.js"></script>

   Zweck: Wie ein NEUES Produkt aussieht und welchen Schlüssel es bekommt,
   steht genau hier — für alle, die Produkte anlegen. Aufrufer:
     - Produkt-Config (produkt_config/produkt_config_editor.html, „＋ Produkt“)
     - Backzettel (backzettel/backzettel_erfassung.html, „Als neues Produkt
       anlegen“, Stufe 2a)
   Zwei Kopien der Schlüsselbildung laufen irgendwann auseinander (Muster
   „eine Mechanik, viele Aufrufer“). Der legacyKey bleibt FÜR IMMER
   (Dokument-ID in Firestore, Schlüssel in der Verbrauchs- und
   Froster-Geschichte).

   REINE LOGIK: keine Datenbank, keine Oberfläche, kein Netz. Lesen und
   Schreiben bleiben beim Aufrufer; geschrieben wird nur über
   BOS_PRODUKTE_SCHREIBEN.schreibe() (Sicherung + Produkt + Stand).

   HERKUNFT (Starter §4: kopieren, nicht nachbauen) — aus
   produkt_config/produkt_config_editor.html, Stand 24.10.2026, 07:46
   (MD5 de297bd4bbf1106fa94fb6fcf08c390c):
     KATEGORIEN            Z. 553        wörtlich
     slugify()             Z. 1762–1766  wörtlich
     eindeutigerSchluessel() Z. 1784–1798  wörtlich bis auf die Quelle der
                           belegten Schlüssel: Der Editor las sie aus daten,
                           geloeschteSchluessel und dbGeloeschteSchluessel;
                           jetzt übergibt sie der Aufrufer (Liste oder Objekt)
     vorlage()             Z. 1825–1840 (Objekt in neuesProdukt())  wörtlich,
                           Feldliste UND Reihenfolge
     naechsteReihenfolge() Z. 1876–1880  wörtlich
   Prüfung: _PRUEF_produkte_anlegen.js schneidet die alten Funktionen aus
   der alten Editor-Datei und vergleicht (Gegenprobe).

   Aufruf:
     M.KATEGORIEN                                 ['Brötchen','Brot',…]
     M.slugify('Kürbis-Stute 500g')               'kuerbis_stute_500g_stueck'
     M.eindeutigerSchluessel(name, belegt)        belegt: Liste oder { key: true }
     M.vorlage({ legacyKey, name, kategorie })    das leere neue Produkt
     M.naechsteReihenfolge(rohMap)                höchste reihenfolge + 1
     M.kategorieVorschlag(artNr)                  11 → Brötchen, 12 → Brot,
                                                  13 → Konditorei, sonst null
     M.neuesDokument(eingabe, { belegt, rohMap })
        eingabe: { name, kategorie, artNr, stueckProBlech }
        → { key, inhalt, ausweich }   (inhalt fertig für schreibe(), ohne sicherungId)
        wirft Error mit .art: 'name_leer' | 'kategorie' | 'artnr' | 'stueck' | 'schluessel'
        und .feld (für die Anzeige am Feld)

   CHANGELOG
     2026-10-26 · 07:33 · v1 · Erstfassung (Backzettel Stufe 2a „Produkt anlegen“)
       ANWEISUNG_2026-10-26_BACKZETTEL_STUFE2_PRODUKT_ANLEGEN.md (KC 04:31),
       Freigabe Bauplan KC 06:20 (K1: KATEGORIEN mit hierher), Ulf 06:43:
       Freigabe Produkt-Config. SESSION_2026-10-26_BACKZETTEL_STUFE2_PRODUKT_ANLEGEN_BAU.md
   ================================================================ */
(function (global) {
  'use strict';

  /* ---- kopiert: Editor Z. 553 ---- */
  var KATEGORIEN = ['Brötchen','Brot','Konditorei','Fettgebäck','Snack','Schlawiner'];

  /* Vorschlag aus dem Nummernkreis (Anweisung 26.10., Teil A; K4: nur 11/12/13).
     Bewusst NICHT die Abteilungen der Backzettel-Logik („Brote“ ≠ Kategorie „Brot“). */
  var KREIS_KATEGORIE = { '11': 'Brötchen', '12': 'Brot', '13': 'Konditorei' };

  /* ---- kopiert: Editor Z. 1762–1766 ---- */
  function slugify(name) {
    return (name || 'produkt').toLowerCase()
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
      .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') + '_stueck';
  }

  function belegtAls(belegt) {
    var b = {};
    if (Array.isArray(belegt)) belegt.forEach(function (k) { if (k) b[k] = true; });
    else if (belegt && typeof belegt === 'object') Object.keys(belegt).forEach(function (k) { if (belegt[k]) b[k] = true; });
    return b;
  }

  /* ---- kopiert: Editor Z. 1784–1798 (Quelle der belegten Schlüssel: Aufrufer) ---- */
  function eindeutigerSchluessel(name, belegtListe) {
    var belegt = belegtAls(belegtListe);
    var basis = slugify(name);                       // z. B. zwiebelbrot_500g_stueck
    if (!belegt[basis]) return basis;
    var stamm = basis.replace(/_stueck$/, '');       // Zähler VOR die gemeinsame Endung
    for (var n = 2; n < 1000; n++) {
      var kandidat = stamm + '_' + n + '_stueck';
      if (!belegt[kandidat]) return kandidat;
    }
    throw new Error('Kein freier Schlüssel für „' + name + '“ gefunden (über 1000 Varianten belegt).');
  }

  /* ---- kopiert: Editor Z. 1825–1840 (das Objekt aus neuesProdukt()) ---- */
  function vorlage(o) {
    var schluessel = o.legacyKey, name = o.name, kat = o.kategorie;
    return {
      legacyKey: schluessel,
      name: name,
      kategorie: kat,
      artNr: null,
      station: null,
      stueckProBlech: null,
      produktionsSchritt: null,
      einheit: null,   /* 13.10.2026, Nachtrag 1 (Fund N2): bewusst leer → erscheint unter „Nur ohne Einheit“ */
      backTage: [],
      hinweis: null,
      frosterZustaendigkeit: '',
      manuelleErfassung: false,
      schnellrechnerRelevant: false,
      nfcSeite: false
    };
  }

  /* ---- kopiert: Editor Z. 1876–1880 ---- */
  function naechsteReihenfolge(rohMap) {
    var max = -1;
    Object.keys(rohMap || {}).forEach(function (k) { var r = rohMap[k] && rohMap[k].reihenfolge; if (typeof r === 'number' && r > max) max = r; });
    return max + 1;
  }

  function kategorieVorschlag(artNr) {
    var s = String(artNr === null || artNr === undefined ? '' : artNr).replace(/\s/g, '');
    return /^\d{3,10}$/.test(s) ? (KREIS_KATEGORIE[s.slice(0, 2)] || null) : null;
  }

  function fehler(art, feld, text) { var e = new Error(text); e.art = art; e.feld = feld; return e; }

  /* Das fertige neue Dokument (ohne sicherungId — die setzt schreibe()).
     Vorlage wie „＋ Produkt“, dazu artNr, stueckProBlech, reihenfolge — so,
     wie der Editor es nach 💾 schreibt (speichereKarte: reihenfolge =
     naechsteReihenfolge(serverRoh); einheit null bleibt null). */
  function neuesDokument(eingabe, umgebung) {
    var e = eingabe || {}, u = umgebung || {};
    var name = String(e.name === null || e.name === undefined ? '' : e.name).trim();
    if (!name) throw fehler('name_leer', 'name', 'Bitte einen Namen eingeben.');
    if (KATEGORIEN.indexOf(e.kategorie) === -1) throw fehler('kategorie', 'kategorie', 'Bitte eine Kategorie wählen.');
    var artNr = String(e.artNr === null || e.artNr === undefined ? '' : e.artNr).replace(/\s/g, '');
    if (!/^\d{3,10}$/.test(artNr)) throw fehler('artnr', 'artNr', 'Artikelnummer fehlt oder ist keine Nummer.');
    var spb = e.stueckProBlech;
    if (spb === '' || spb === undefined) spb = null;
    if (spb !== null) {
      var n = typeof spb === 'number' ? spb : Number(String(spb).trim());
      if (!Number.isFinite(n) || Math.floor(n) !== n || n < 1) throw fehler('stueck', 'stueckProBlech', 'Stück pro Blech: leer lassen oder eine ganze Zahl ab 1.');
      spb = n;
    }
    var key;
    try { key = eindeutigerSchluessel(name, u.belegt); }
    catch (err) { throw fehler('schluessel', 'name', err.message); }
    var inhalt = vorlage({ legacyKey: key, name: name, kategorie: e.kategorie });
    inhalt.artNr = artNr;
    inhalt.stueckProBlech = spb;
    inhalt.reihenfolge = naechsteReihenfolge(u.rohMap);
    return { key: key, inhalt: inhalt, ausweich: key !== slugify(name) };
  }

  var api = {
    KATEGORIEN: KATEGORIEN.slice(), KREIS_KATEGORIE: KREIS_KATEGORIE,
    slugify: slugify, eindeutigerSchluessel: eindeutigerSchluessel, vorlage: vorlage,
    naechsteReihenfolge: naechsteReihenfolge, kategorieVorschlag: kategorieVorschlag,
    neuesDokument: neuesDokument
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_PRODUKTE_ANLEGEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
