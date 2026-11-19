/* ================================================================
   BäckereiOS · Personalakte — reine Logik (ohne Browser, ohne Firestore)
   ================================================================
   Einbindung:  <script src="personalakte_logik.js"></script>
   Stellt bereit: window.BOS_PERSONALAKTE_LOGIK  (in Node: module.exports)
   Benutzt von: konten/personalakte.html
   Doku:        konten/PERSONALAKTE_DOKU.md

   WOFÜR: alles, was die Akte aus den geladenen Dokumenten macht — und was sie
   davon gar nicht erst behält. Die Seite gibt jedes Dokument sofort an eine
   reinige…()-Funktion; im Speicher der Seite liegt nur, was hier herauskommt.

   DREI GRENZEN (Bauplan §4, Go KC 18.11. 04:42):
     1. Krankheit: Abwesenheiten werden nur mit der Positivliste GRUENDE
        abgefragt (abfragen()). reinigeAbwesenheit() wirft zusätzlich alles
        weg, dessen Grund nicht auf der Liste steht — und zählt es.
     2. Begründungen (Freitext): Firestore liefert ganze Dokumente. Das Feld
        mit dem Satz kommt deshalb technisch mit, wird hier aber NIE übernommen
        (Ulf, U3: „nicht zeigen“). Kein reinige…() gibt Freitext zurück.
     3. Die Wochenpläne werden nie abgefragt (Krankmelder-Spuren, Tagesbuchungen).

   Kein Schreiben. Stufe 1 liest nur.

   ABFRAGEN: Grunddaten einmal beim Öffnen (abfragen()). Einreichungen und der
   Kontostand erst beim Öffnen einer Akte und nur für diese (abfragenFuer()).

   TEXTE: alle Wörter stehen im Wörterbuch DE und laufen über T(). Die Seite
   kann mit setzeUebersetzer(fn) ein eigenes Wörterbuch vorschalten (i18n-Hook,
   Satelliten-Checkliste §6). Platzhalter in geschweiften Klammern.

   BEZEICHNUNGEN (Status, Schicht, Abteilung …): Vorlage ist
   schichtplaner/personen_editor.html. Mit Stufe 2 ziehen sie in das gemeinsame
   Schreib-Modul. HAKEN nennt die Einzel-Haken am Konto in Kurzform; die langen
   Texte stehen in der Kontenverwaltung. Ein Wächter-Test verlangt, dass jeder
   Haken-Setzer aus bos_accounts.js hier eine Bezeichnung hat.

   ANZEIGENAME: kommt nur aus bos_namen.js (nameFn). Hier steht keine eigene
   Reihenfolge Rufname/Beschreibung; ein Wächter-Test hält das fest.

   CHANGELOG
     2026-11-18 · 05:11 · v1 · Erstfassung (Personalakte Lieferung A, Vorarbeit)
     2026-11-18 · 10:06 · v1.1 · Antwort KC 09:17: eigene Namens-Reihenfolge entfernt
       (anzeigeName ruft nur noch nameFn, sonst lauter Abbruch).
   ================================================================ */
(function (global) {
  'use strict';

  /* ---------- Stellschrauben ---------- */
  var GRUENDE = ['urlaub', 'sonstiges'];                      /* Positivliste. Krankheit steht NICHT hier und kommt nie dazu. */
  var EINREICHUNG_ARTEN = ['urlaub_anfrage', 'schichtplaner_wunschtag', 'sonntag_ablehnung'];
  var SCHICHTEN = ['nacht', 'frueh'];
  var ABTEILUNGEN = ['baeckerei', 'konditorei'];
  var STATUS = ['mitarbeiter', 'azubi', 'produktionshelfer', 'aushilfskraft'];
  var TEILBEREICHE = ['versand', 'kuchenversand'];
  var TAGE = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  var ARTEN = ['person', 'ort', 'system'];
  var HAKEN = ['taskboardAbhaken', 'teigeckePflege', 'teigeckeTeige', 'teigeckeRezepte', 'weitereTeige',
    'reparaturLesen', 'reparaturMelden', 'reparaturBearbeiten', 'nachrichtenSchreiben', 'nachrichtenBekanntmachung', 'nachrichtenEmpfangen',
    'lagerZaehlen', 'lagerAnfordern', 'lagerBestellen', 'mitbringerDrucken', 'mitbringerBearbeiten'];
  var KONTO_KEIN_HAKEN = ['freigeschaltet'];                  /* am Konto wahr, aber kein Haken */
  var SPRUNG_ZIEL = {
    konten: 'konten_verwaltung.html',
    personen: '../schichtplaner/personen_editor.html',
    positionen: '../schichtplaner/positionen_editor.html',
    abwesenheiten: '../schichtplaner/abwesenheiten_editor.html',
    entwuerfe: '../schichtplaner/entwuerfe.html',
    sonntagsplan: '../schichtplaner/sonntagsplan.html',
    bankkonto: '../schichtplaner/bankkonto.html'
  };

  /* ---------- Wörterbuch ---------- */
  var DE = {
    schicht_nacht: 'Nacht', schicht_frueh: 'Früh',
    abteilung_baeckerei: 'Bäckerei', abteilung_konditorei: 'Konditorei',
    status_mitarbeiter: 'Mitarbeiter/Fachkraft', status_azubi: 'Azubi', status_produktionshelfer: 'Produktionshelfer', status_aushilfskraft: 'Aushilfskraft',
    teilbereich_versand: 'Versand', teilbereich_kuchenversand: 'Kuchenversand',
    tag_mo: 'Mo', tag_di: 'Di', tag_mi: 'Mi', tag_do: 'Do', tag_fr: 'Fr', tag_sa: 'Sa', tag_so: 'So',
    art_person: 'Person', art_ort: 'Ort / Station', art_system: 'System', art_konto: 'Konto',
    haken_taskboardAbhaken: 'Aufgaben abhaken',
    haken_teigeckePflege: 'Teigecke pflegen', haken_teigeckeTeige: 'Teigecke: Teige', haken_teigeckeRezepte: 'Teigecke: Rezepte', haken_weitereTeige: 'Weitere Teige',
    haken_reparaturLesen: 'Reparatur: mitlesen', haken_reparaturMelden: 'Reparatur: melden', haken_reparaturBearbeiten: 'Reparatur: bearbeiten',
    haken_nachrichtenSchreiben: 'Nachrichten schreiben', haken_nachrichtenBekanntmachung: 'Bekanntmachungen', haken_nachrichtenEmpfangen: 'Nachrichten empfangen',
    haken_lagerZaehlen: 'Lager zählen', haken_lagerAnfordern: 'Lager anfordern', haken_lagerBestellen: 'Lager bestellen',
    haken_mitbringerDrucken: 'Mitbringer drucken', haken_mitbringerBearbeiten: 'Mitbringer bearbeiten',
    haken_unbekannt: 'Haken „{feld}“ (unbekannt)',
    ja: 'ja', nein: 'nein', strich: '—', kein_wert: '–',
    datum_fehlt: '— kein Datum —', datum_ungueltig: '— ungültiges Datum —', zeitraum: '{von} – {bis}',
    fehler_namefn: 'Namensfunktion fehlt (BOS_NAMEN.anzeige) — bos_namen.js ist nicht geladen oder zu alt.',
    fehler_abfrage: 'Unbekannte Abfrage: {id}',
    /* Baum */
    ast_abteilung_offen: 'Abteilung offen', ast_schicht_offen: 'Stammschicht offen', ast_nicht_im_plan: 'Nicht im Schichtplan', ast_inaktiv: 'Inaktiv',
    ast_orte: 'Orte / Stationskonten', ast_ohne_person: 'Konten ohne Person', ast_system: 'Systemkonten',
    marke_kein_konto: 'kein Konto', marke_konto_fehlt: 'Konto fehlt', marke_gesperrt: 'gesperrt',
    knoten_person: '{id} {name}', knoten_konto: '{name} · {kennung}',
    auff_mehrere: 'Konto {kennung} ist mit mehreren Personen verknüpft: {personen}',
    auff_art: 'Konto {kennung} hat die Art „{art}“, ist aber mit {person} verknüpft',
    auff_leer: '{person} ist mit dem Konto {kennung} verknüpft, das es nicht gibt',
    /* Akte: Kopf */
    kopf_person_konto: '{id} · Konto {kennung}', kopf_person_ohne: '{id} · kein Konto', kopf_konto: '{art} · {kennung}',
    hinweis_aktiv_fehlt: 'Feld „aktiv“ fehlt: Der Personen-Editor zeigt diese Person als inaktiv, die Planung rechnet sie als aktiv.',
    /* Akte: Abschnitte */
    ab_name: 'Name', ab_planung: 'Planung', ab_positionen: 'Positionen', ab_konto: 'Konto', ab_rechte: 'Rechte', ab_urlaub: 'Urlaub',
    ab_sonstiges: 'Sonstige Abwesenheit', ab_wunschtag: 'Wunschtag', ab_bankkonto: 'Bankkonto', ab_einreichungen: 'Einreichungen dieses Kontos',
    f_nummer: 'Nummer', f_beschreibung: 'Beschreibung', f_rufname: 'Rufname', f_angezeigt: 'Angezeigt als',
    w_keine_beschreibung: '— keine —', w_kein_rufname: '— keiner —',
    f_status: 'Status', f_im_plan: 'Steht im Schichtplan', f_aktiv: 'Aktiv', f_stammschicht: 'Stammschicht', f_abteilung: 'Abteilung', f_teilbereich: 'Teilbereich',
    f_arbeitstage: 'Arbeitstage', f_freie_tage: 'Mögliche freie Tage', f_gesperrt: 'Gesperrte Schichten', f_kein_rot: 'Kein rotierender freier Tag',
    f_sonntage: 'Sonntage je Monat höchstens', f_einsatz: 'Einsatzfähig (Azubi)',
    w_offen: '— offen —', w_aktiv_fehlt: 'ja (Feld fehlt)', w_schicht_offen: '— noch nicht festgelegt —', w_kein_teilbereich: '— keiner —',
    w_alle_tage: 'alle sieben Tage', w_keine_vorgabe: '— keine Vorgabe —', w_keine_sperre: '— keine —', w_keine_grenze: '— keine Grenze —', w_nicht_gesetzt: '— nicht gesetzt —',
    l_pools: 'Steht im Pool von', leer_pools: 'in keinem Pool', pool_zeile: '{name} · Rang {rang} von {von}', pool_zeile_schicht: '{name} ({schicht}) · Rang {rang} von {von}',
    f_kennung: 'Kennung', f_notiz: 'Notiz', f_art: 'Art', f_rolle: 'Rolle', f_frei: 'Freigeschaltet', f_farbe: 'Farbprofil',
    w_art_offen: '— nicht festgelegt —', w_keine_rolle: '— keine Rolle —', w_gesperrt: 'nein (gesperrt)', w_farbe_rolle: 'wie die Rolle',
    hinweis_kein_konto: 'Kein Konto verknüpft.', hinweis_konto_leer: 'Verknüpft mit dem Konto {kennung}, das es nicht (mehr) gibt.',
    l_darf: 'Darf öffnen', leer_darf: 'keine geschützte Seite', l_dazu: 'Abweichend von der Rolle: zusätzlich', l_entzogen: 'Abweichend von der Rolle: entzogen',
    l_haken: 'Einzelne Haken', leer_haken: 'keine', l_gruppen: 'Gruppen', leer_gruppen: 'in keiner Gruppe',
    hinweis_keine_pruefung: 'Die Zugriffsprüfung (bos_access.js) ist nicht geladen — die Kacheln lassen sich nicht bestimmen.',
    l_eingetragen: 'Eingetragen', leer_urlaub: 'kein Urlaub eingetragen', l_anfragen: 'Anfragen', leer_anfragen: 'keine Anfrage', leer_sonstiges: 'nichts eingetragen',
    l_wunschtage: 'Wunschtage', leer_wunschtage: 'kein Wunschtag', l_absagen: 'Sonntags-Absagen', leer_absagen: 'keine Absage',
    l_urlaubsanfragen: 'Urlaubsanfragen', leer_keine: 'keine',
    hinweis_ohne_konto: 'Ohne Konto stehen hier nur von Hand nachgetragene Einträge. Ältere Einreichungen hängen ggf. an einem früheren Konto (Ast „Konten ohne Person“).',
    hinweis_konto_knoten: 'Dieses Konto ist mit keiner Person verknüpft. Was darüber eingereicht wurde, steht deshalb hier.',
    e_wichtig: 'wichtig', e_nachgetragen: 'nachgetragen', e_eingereicht: 'eingereicht {am}', e_uebernommen: 'übernommen {am}', e_offen: 'offen', e_trenner: ' · ',
    f_saldo: 'Saldo', f_wochen: 'Gezählte Wochen', f_sa: 'Sa-Kombi', f_mo: 'Mo-Kombi', f_wunsch: 'Wunschtag', f_schuld: 'Schuld (freie Tage)', f_stand: 'Stand vom',
    hinweis_kein_stand: 'Noch kein Kontostand — die Person kam noch in keinem offiziellen Plan vor.',
    /* Sprünge */
    sprung_konten: 'In der Kontenverwaltung bearbeiten', sprung_personen: 'Im Personen-Editor bearbeiten', sprung_positionen: 'Im Positionen-Editor bearbeiten',
    sprung_abwesenheiten: 'Im Abwesenheiten-Editor bearbeiten', sprung_entwuerfe: 'In den Entwürfen bearbeiten', sprung_sonntagsplan: 'Im Sonntagsplan bearbeiten',
    sprung_bankkonto: 'Bankkonto öffnen',
    /* Selbsttest */
    st_krank_ok: 'Antworten der Datenbank: 0 Krank-Einträge in {dokumente} Dokumenten — der Filter hält.',
    st_krank_fund: 'Antworten der Datenbank: {zahl} Krank-Einträge in {dokumente} Dokumenten — der Filter greift nicht!',
    st_saetze: 'Antworten der Datenbank: {zahl} Dokumente mit einer Begründung. Die Datenbank liefert immer ganze Dokumente; der Satz wird sofort verworfen (die nächste Zeile prüft das).',
    st_feld_ok: 'Was die Seite behält: kein Feld für Begründungen.', st_feld_fund: 'Was die Seite behält: enthält ein Feld für Begründungen!',
    st_wort_ok: 'Was die Seite behält: nirgends das Wort für den Krank-Grund.', st_wort_fund: 'Was die Seite behält: enthält das Wort für den Krank-Grund!',
    st_freitext: 'In {zahl} der gelieferten Dokumente kommt die Buchstabenfolge „krank“ vor (z. B. in einem Freitext). Diese Texte zeigt und behält die Akte nicht.'
  };
  var uebersetzer = null;
  function setzeUebersetzer(fn) { uebersetzer = typeof fn === 'function' ? fn : null; }
  function T(key, w) {
    var s = (uebersetzer && uebersetzer(key, w)) || DE[key];
    if (s === undefined || s === null) return key;
    return String(s).replace(/\{(\w+)\}/g, function (m, n) { return w && w[n] !== undefined && w[n] !== null ? w[n] : m; });
  }
  /* Bezeichnung zu einem Wert aus einer festen Liste, sonst null. */
  function wort(vorsilbe, listeErlaubt, wert) { return listeErlaubt.indexOf(wert) !== -1 ? T(vorsilbe + wert) : null; }

  /* ---------- kleine Helfer ---------- */
  function text(t) { return (t === null || t === undefined) ? '' : String(t).trim(); }
  function klein(t) { return text(t).toLocaleLowerCase('de'); }
  function zwei(n) { return n < 10 ? '0' + n : String(n); }
  function istTag(t) { return typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t); }
  /* 'JJJJ-MM-TT' → 'TT.MM.JJJJ', rein als Text (kein Date, keine Zeitzone). */
  function tagText(iso) {
    if (!istTag(iso)) return iso ? T('datum_ungueltig') : T('datum_fehlt');
    return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4);
  }
  /* Firestore-Zeitstempel, Date oder Zahl → Millisekunden (sonst 0). */
  function millis(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') return isFinite(ts) ? ts : 0;
    if (typeof ts.toMillis === 'function') { try { return ts.toMillis() || 0; } catch (e) { return 0; } }
    if (ts instanceof Date) return ts.getTime() || 0;
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    return 0;
  }
  /* Millisekunden → 'TT.MM.JJJJ' in ORTSZEIT (nie über UTC — die Falle zwischen 0 und 2 Uhr). */
  function zeitText(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  /* Heute als 'JJJJ-MM-TT' in ORTSZEIT. jetzt (Date) nur für Tests. */
  function heuteIso(jetzt) {
    var d = jetzt || new Date();
    return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
  }
  function zahl(n) { return (typeof n === 'number' && isFinite(n)) ? n : 0; }
  /* wie bankkonto.html runden(): eine Nachkommastelle, nur wenn nötig */
  function runden(n) { return Math.round(zahl(n) * 10) / 10; }
  function liste(a) { return Array.isArray(a) ? a.slice() : null; }
  function zeilen(l) { return l.map(function (t) { return { text: t }; }); }

  /* ---------- Abfragen (Beschreibung; die Seite baut daraus die echte Abfrage) ---------- */
  /* Jede Sammlung, die die Akte liest, steht in abfragen() oder abfragenFuer() — und nur dort. */
  function abfragen() {
    return [
      { id: 'personen', sammlung: 'personen', filter: [] },
      { id: 'namen', sammlung: 'namen', filter: [] },
      { id: 'konten', sammlung: 'bos_accounts', filter: [] },
      { id: 'positionen', sammlung: 'positionen', filter: [] },
      { id: 'abwesenheiten', sammlung: 'abwesenheiten', filter: [['grund', 'in', GRUENDE.slice()]] },
      { id: 'gruppen', sammlung: 'nachrichten_vorlagen', filter: [] }
    ];
  }
  /* Erst beim Öffnen einer Akte, nur für diesen Knoten ('p:P07' oder 'k:kennung'): die Einreichungen
     (je Art eine Abfrage über die Kennung und eine über die Nummer — dieselbe Form wie wunschtag.html,
     nur Gleichheit, kein eigener Index) und der eine Kontostand. Mehr kommt nicht aufs Gerät. */
  function abfragenFuer(z, knotenId) {
    var kz = String(knotenId || ''), aus = [], personId = null, kennung = null;
    if (kz.indexOf('p:') === 0) { personId = kz.slice(2); var p = z.personen[personId]; if (!p) return []; kennung = p.bosKontoId; }
    else if (kz.indexOf('k:') === 0) { kennung = kz.slice(2); if (!z.konten[kennung]) return []; }
    else return [];
    EINREICHUNG_ARTEN.forEach(function (art) {
      if (kennung) aus.push({ id: 'einreichungen', sammlung: 'bos_events', filter: [['type', '==', art], ['bosKontoId', '==', kennung]] });
      if (personId) aus.push({ id: 'einreichungen', sammlung: 'bos_events', filter: [['type', '==', art], ['personId', '==', personId]] });
    });
    if (personId) {
      aus.push({ id: 'einreichungen', sammlung: 'bos_events', filter: [['type', '==', 'sonntag_ablehnung'], ['uebernommenFuerPersonId', '==', personId]] });
      aus.push({ id: 'bankkonto', sammlung: 'konten', dokument: personId });
    }
    return aus;
  }
  /* Baut die Abfrage an einer Firestore-Verbindung (oder Attrappe mit collection().where()/doc()). */
  function baueAbfrage(db, a) {
    var q = db.collection(a.sammlung);
    if (a.dokument) return q.doc(a.dokument);
    (a.filter || []).forEach(function (f) { q = q.where(f[0], f[1], f[2]); });
    return q;
  }

  /* ---------- Reinigen: Dokument → nur das, was die Akte behalten darf ---------- */
  function reinigePerson(id, d) {
    d = d || {};
    return {
      id: String(id),
      status: text(d.status) || null,
      abteilung: text(d.abteilung) || null,
      teilbereich: text(d.teilbereich) || null,
      stammschicht: text(d.stammschicht) || null,
      aktivFeldFehlt: !Object.prototype.hasOwnProperty.call(d, 'aktiv') || d.aktiv === null || d.aktiv === undefined,
      aktiv: d.aktiv !== false,                                   /* Lesart der Planung (Go KC Punkt 4) */
      imSchichtplan: d.imSchichtplan !== false,                   /* wie BOS_NAMEN.imSchichtplan: fehlt = im Plan */
      einsatzfaehig: d.einsatzfaehig === undefined || d.einsatzfaehig === null ? null : !!d.einsatzfaehig,
      keinRotierenderFreierTag: !!d.keinRotierenderFreierTag,
      maxSonntageProMonat: typeof d.maxSonntageProMonat === 'number' ? d.maxSonntageProMonat : null,
      arbeitstage: liste(d.arbeitstage),
      freieTagOptionen: liste(d.freieTagOptionen),
      gesperrteSchichten: liste(d.gesperrteSchichten),
      bosKontoId: text(d.bosKontoId) || null
    };
  }
  function reinigeName(id, d) {
    d = d || {};
    return { id: String(id), beschreibung: text(d.beschreibung), rufname: text(d.rufname) };
  }
  function reinigeKonto(id, d) {
    d = d || {};
    var haken = {}, unbekannt = [];
    Object.keys(d).forEach(function (k) {
      if (d[k] !== true || KONTO_KEIN_HAKEN.indexOf(k) !== -1) return;
      if (HAKEN.indexOf(k) !== -1) haken[k] = true; else unbekannt.push(k);
    });
    var ov = {};
    if (d.overrides && typeof d.overrides === 'object') Object.keys(d.overrides).forEach(function (k) { ov[k] = !!d.overrides[k]; });
    return {
      id: String(id),
      name: text(d.name),                                         /* Notiz der Kontenverwaltung (Ulf), kein Freitext eines Kollegen */
      rolle: text(d.role) || null,
      art: text(d.art) || null,
      freigeschaltet: d.freigeschaltet === true,
      farbschema: text(d.farbschema) || null,
      overrides: ov,
      haken: haken,
      hakenUnbekannt: unbekannt.sort(),
      lagerZaehlenStandorte: liste(d.lagerZaehlenStandorte) || [],
      lagerAnfordernStandorte: liste(d.lagerAnfordernStandorte) || []
    };
  }
  function reinigePosition(id, d) {
    d = d || {};
    return { id: String(id), name: text(d.name) || String(id), schicht: text(d.schicht) || null,
      pool: (Array.isArray(d.pool) ? d.pool : []).map(text) };
  }
  /* null = verworfen; der Zähler sagt der Seite, wie oft und warum. Der Satz der Begründung wird nie übernommen. */
  function reinigeAbwesenheit(id, d, zaehler) {
    d = d || {};
    var z = zaehler || {};
    if (GRUENDE.indexOf(d.grund) === -1) { z.fremderGrund = (z.fremderGrund || 0) + 1; return null; }
    if (text(d['begruendung'])) z.freitextVerworfen = (z.freitextVerworfen || 0) + 1;
    return { id: String(id), personId: text(d.personId) || null, grund: d.grund,
      von: istTag(d.von) ? d.von : null, bis: istTag(d.bis) ? d.bis : null };
  }
  function reinigeEinreichung(id, d, zaehler) {
    d = d || {};
    var z = zaehler || {};
    if (EINREICHUNG_ARTEN.indexOf(d.type) === -1) { z.fremdeArt = (z.fremdeArt || 0) + 1; return null; }
    if (text(d['begruendung'])) z.freitextVerworfen = (z.freitextVerworfen || 0) + 1;
    return {
      id: String(id), art: d.type,
      bosKontoId: text(d.bosKontoId) || null, personId: text(d.personId) || null,
      von: istTag(d.von) ? d.von : null, bis: istTag(d.bis) ? d.bis : null, datum: istTag(d.datum) ? d.datum : null,
      wichtig: d.wichtig === true,
      quelle: d.quelle === 'manuell' ? 'manuell' : 'selbst',
      eingereichtAm: millis(d.eingereichtAm), uebernommenAm: millis(d.uebernommenAm),
      uebernommenFuerPersonId: text(d.uebernommenFuerPersonId) || null
    };
  }
  function reinigeBankkonto(id, d) {
    d = d || {};
    return { id: String(id), saldo: runden(d.saldo), wochenGezaehlt: zahl(d.wochenGezaehlt), samstagKombi: zahl(d.samstagKombi),
      montagKombi: zahl(d.montagKombi), wunschtagScore: zahl(d.wunschtagScore), freieTageSchuld: zahl(d.freieTageSchuld),
      aktualisiertAm: millis(d.aktualisiertAm) };
  }
  function reinigeGruppe(id, d) {
    d = d || {};
    return { id: String(id), name: text(d.name) || String(id), kennungen: (Array.isArray(d.kennungen) ? d.kennungen : []).map(text),
      reihenfolge: zahl(d.reihenfolge) };
  }
  var REINIGER = { personen: reinigePerson, namen: reinigeName, konten: reinigeKonto, positionen: reinigePosition,
    abwesenheiten: reinigeAbwesenheit, gruppen: reinigeGruppe };

  /* ---------- Zustand: alles Geladene an EINER Stelle, damit Sperren alles leert ---------- */
  function neuerZustand() {
    return { personen: {}, namen: {}, konten: {}, positionen: [], abwesenheiten: [], gruppen: [],
      fehler: {}, geladen: {}, verworfen: {}, proKnoten: {}, gewaehlt: null, suche: '' };
  }
  /* Leert den Zustand an Ort und Stelle (dieselbe Variable bleibt gültig). */
  function leere(z) {
    var neu = neuerZustand();
    Object.keys(z).forEach(function (k) { delete z[k]; });
    Object.keys(neu).forEach(function (k) { z[k] = neu[k]; });
    return z;
  }
  /* Nimmt die Dokumente einer Grund-Abfrage auf: [{ id, daten }] → gereinigt in den Zustand. */
  function nimmAuf(z, abfrageId, dokumente) {
    var r = REINIGER[abfrageId];
    if (!r) throw new Error(T('fehler_abfrage', { id: abfrageId }));
    var zaehler = {};
    var alsListe = Array.isArray(neuerZustand()[abfrageId]);
    var ziel = alsListe ? [] : {};
    (dokumente || []).forEach(function (dok) {
      var sauber = r(dok.id, dok.daten, zaehler);
      if (!sauber) return;
      if (alsListe) ziel.push(sauber); else ziel[sauber.id] = sauber;
    });
    z[abfrageId] = ziel;
    z.geladen[abfrageId] = (dokumente || []).length;
    z.verworfen[abfrageId] = zaehler;
    delete z.fehler[abfrageId];
    return zaehler;
  }
  /* Der Teil des Zustands, der zu EINER geöffneten Akte gehört. */
  function knotenStand(z, knotenId) {
    if (!z.proKnoten[knotenId]) z.proKnoten[knotenId] = { einreichungen: [], bankkonto: null, fehler: {}, geladen: {}, verworfen: {} };
    return z.proKnoten[knotenId];
  }
  /* Einreichungen eines Knotens aufnehmen; dieselbe Einreichung aus zwei Abfragen zählt einmal. */
  function nimmEinreichungenAuf(z, knotenId, dokumente) {
    var st = knotenStand(z, knotenId), da = {};
    st.einreichungen.forEach(function (e) { da[e.id] = true; });
    (dokumente || []).forEach(function (dok) {
      var sauber = reinigeEinreichung(dok.id, dok.daten, st.verworfen);
      if (sauber && !da[sauber.id]) { da[sauber.id] = true; st.einreichungen.push(sauber); }
    });
    st.geladen.einreichungen = true;
    return st;
  }
  /* daten = null, wenn es das Dokument nicht gibt. */
  function nimmBankkontoAuf(z, knotenId, personId, daten) {
    var st = knotenStand(z, knotenId);
    st.bankkonto = daten ? reinigeBankkonto(personId, daten) : null;
    st.geladen.bankkonto = true;
    return st;
  }
  function vergissKnoten(z, knotenId) { delete z.proKnoten[knotenId]; }

  /* ---------- Anzeigename ----------
     Welcher Name gezeigt wird, entscheidet NUR bos_namen.js (BOS_NAMEN.anzeige, NE-6). Die Seite gibt diese
     Funktion als nameFn herein. Die Logik hat keine eigene Reihenfolge (KC 18.11. 09:17) — fehlt nameFn,
     bricht sie laut ab, statt selbst einen Namen zu wählen. */
  function anzeigeName(id, nameFn) {
    if (typeof nameFn !== 'function') throw new Error(T('fehler_namefn'));
    return nameFn(id);
  }

  /* ---------- Baum ---------- */
  function kontoVonPerson(z, p) { return p.bosKontoId ? (z.konten[p.bosKontoId] || null) : null; }
  function personenMitKonto(z, kennung) {
    return Object.keys(z.personen).filter(function (id) { return z.personen[id].bosKontoId === kennung; });
  }
  /* Vorrang: inaktiv → nicht im Plan → Stammschicht offen → Schicht/Abteilung. Jede Person genau einmal. */
  function astDerPerson(p) {
    if (!p.aktiv) return 'x:inaktiv';
    if (!p.imSchichtplan) return 'x:nichtimplan';
    if (SCHICHTEN.indexOf(p.stammschicht) === -1) return 'x:schichtoffen';
    return 's:' + p.stammschicht + '/a:' + (ABTEILUNGEN.indexOf(p.abteilung) !== -1 ? p.abteilung : 'offen');
  }
  /* Liefert { knoten, zaehl, ohneAktivFeld, auffaellig, zuAnfangOffen }. opt: { nameFn } */
  function baum(z, opt) {
    var o = opt || {};
    var kontenDa = !z.fehler.konten;
    var nach = {};                                               /* Ast-Kennung → [Personen-Knoten] */
    var ids = Object.keys(z.personen);
    var ohneAktiv = [];
    ids.forEach(function (id) {
      var p = z.personen[id];
      if (p.aktivFeldFehlt) ohneAktiv.push(id);
      var n = anzeigeName(id, o.nameFn);
      var k = kontoVonPerson(z, p);
      var e = z.namen[id] || {};
      var blatt = { id: 'p:' + id, name: T('knoten_person', { id: id, name: n }), art: 'person', kinder: [],
        zahl: !kontenDa ? null : (!p.bosKontoId ? T('marke_kein_konto') : (k ? null : T('marke_konto_fehlt'))),
        such: klein([id, n, e.beschreibung, e.rufname, p.bosKontoId].join(' ')), sortName: n, sortId: id };
      var ast = astDerPerson(p);
      (nach[ast] = nach[ast] || []).push(blatt);
    });
    function sortiert(l) {
      return (l || []).slice().sort(function (a, b) { return a.sortName.localeCompare(b.sortName, 'de') || a.sortId.localeCompare(b.sortId); });
    }
    function kopf(id, name, kinder, art) {
      var summe = 0;
      kinder.forEach(function (k) { summe += k.nurKlappen ? k.zahl : 1; });
      return { id: id, name: name, art: art || 'kopf', nurKlappen: true, zahl: summe, kinder: kinder };
    }
    var knoten = [];
    SCHICHTEN.forEach(function (s) {
      var unter = ABTEILUNGEN.map(function (a) { return kopf('s:' + s + '/a:' + a, T('abteilung_' + a), sortiert(nach['s:' + s + '/a:' + a]), 'unterkopf'); });
      unter.push(kopf('s:' + s + '/a:offen', T('ast_abteilung_offen'), sortiert(nach['s:' + s + '/a:offen']), 'unterkopf'));
      knoten.push(kopf('s:' + s, T('schicht_' + s), unter.filter(function (u) { return u.kinder.length; }), 'kopf'));   /* leere Unter-Äste nicht zeigen */
    });
    knoten.push(kopf('x:schichtoffen', T('ast_schicht_offen'), sortiert(nach['x:schichtoffen']), 'kopf'));
    knoten.push(kopf('x:nichtimplan', T('ast_nicht_im_plan'), sortiert(nach['x:nichtimplan']), 'kopf'));
    knoten.push(kopf('x:inaktiv', T('ast_inaktiv'), sortiert(nach['x:inaktiv']), 'kopf'));

    /* Konten ohne eigene Person */
    var orte = [], ohne = [], system = [], kontenBeiPersonen = 0, auffaellig = [];
    Object.keys(z.konten).forEach(function (kn) {
      var k = z.konten[kn];
      var bei = personenMitKonto(z, kn).sort();
      if (bei.length > 1) auffaellig.push(T('auff_mehrere', { kennung: kn, personen: bei.join(', ') }));
      if (bei.length) {
        kontenBeiPersonen++;
        if (k.art === 'ort' || k.art === 'system') auffaellig.push(T('auff_art', { kennung: kn, art: T('art_' + k.art), person: bei[0] }));
        return;
      }
      var blatt = { id: 'k:' + kn, name: k.name ? T('knoten_konto', { name: k.name, kennung: kn }) : kn, art: 'konto', kinder: [],
        zahl: k.freigeschaltet ? null : T('marke_gesperrt'), such: klein(kn + ' ' + k.name), sortName: k.name || kn, sortId: kn };
      if (k.art === 'ort') orte.push(blatt); else if (k.art === 'system') system.push(blatt); else ohne.push(blatt);
    });
    if (kontenDa) {
      ids.forEach(function (id) {
        var p = z.personen[id];
        if (p.bosKontoId && !z.konten[p.bosKontoId]) auffaellig.push(T('auff_leer', { person: id, kennung: p.bosKontoId }));
      });
      knoten.push(kopf('k:orte', T('ast_orte'), sortiert(orte), 'kopf'));
      knoten.push(kopf('k:ohne', T('ast_ohne_person'), sortiert(ohne), 'kopf'));
      knoten.push(kopf('k:system', T('ast_system'), sortiert(system), 'kopf'));
    }

    var imBaum = 0;
    Object.keys(nach).forEach(function (a) { imBaum += nach[a].length; });
    var kontenImBaum = orte.length + ohne.length + system.length + kontenBeiPersonen;
    return {
      knoten: knoten,
      zaehl: { personenImBaum: imBaum, personenGesamt: ids.length, personenStimmt: imBaum === ids.length,
        kontenImBaum: kontenImBaum, kontenGesamt: Object.keys(z.konten).length, kontenStimmt: kontenImBaum === Object.keys(z.konten).length },
      ohneAktivFeld: ohneAktiv.sort(),
      auffaellig: kontenDa ? auffaellig.sort() : [],
      /* zu Anfang offen: die Schichten mit ihren Abteilungen. „Inaktiv“ und die Sonder-Äste bleiben zu. */
      zuAnfangOffen: [].concat.apply([], SCHICHTEN.map(function (s) {
        return ['s:' + s].concat(ABTEILUNGEN.concat(['offen']).map(function (a) { return 's:' + s + '/a:' + a; }));
      }))
    };
  }
  /* Suche: nur Blätter, deren Such-Text alle Wörter enthält. Liefert { knoten, offen, treffer } — die Köpfe mit Treffern aufgeklappt. */
  function filterBaum(knoten, suchtext) {
    var woerter = klein(suchtext).split(/\s+/).filter(Boolean);
    if (!woerter.length) return { knoten: knoten, offen: null, treffer: null };
    var offen = [], treffer = 0;
    function lauf(l) {
      var aus = [];
      (l || []).forEach(function (k) {
        if (k.nurKlappen) {
          var kinder = lauf(k.kinder);
          if (!kinder.length) return;
          var summe = 0;
          kinder.forEach(function (c) { summe += c.nurKlappen ? c.zahl : 1; });
          offen.push(k.id);
          aus.push(Object.assign({}, k, { kinder: kinder, zahl: summe }));
        } else if (typeof k.such === 'string' && woerter.every(function (w) { return k.such.indexOf(w) !== -1; })) {
          treffer++;
          aus.push(k);
        }
      });
      return aus;
    }
    return { knoten: lauf(knoten), offen: offen, treffer: treffer };
  }

  /* ---------- Akte ---------- */
  function tageText(l, wennLeer) {
    if (!l || !l.length) return wennLeer;
    return TAGE.filter(function (t) { return l.indexOf(t) !== -1; }).map(function (t) { return T('tag_' + t); }).join(', ') || T('strich');
  }
  function poolsVon(z, personId) {
    var aus = [];
    z.positionen.forEach(function (pos) {
      var i = pos.pool.indexOf(personId);
      if (i !== -1) aus.push({ positionId: pos.id, name: pos.name, schicht: pos.schicht, rang: i + 1, von: pos.pool.filter(Boolean).length });
    });
    return aus.sort(function (a, b) { return a.rang - b.rang || a.name.localeCompare(b.name, 'de'); });
  }
  function abwesenheitenVon(z, personId, grund, heute) {
    return z.abwesenheiten.filter(function (a) { return a.personId === personId && a.grund === grund; })
      .sort(function (a, b) { return (b.von || '').localeCompare(a.von || ''); })
      .map(function (a) { return { text: T('zeitraum', { von: tagText(a.von), bis: tagText(a.bis) }), vergangen: !!(a.bis && heute && a.bis < heute) }; });
  }
  /* Einreichungen: über die Nummer (nachgetragen, übernommen) ODER über das Konto (selbst eingereicht). st = Stand des Knotens. */
  function einreichungenVon(st, personId, kennung, art) {
    return ((st && st.einreichungen) || []).filter(function (e) {
      if (e.art !== art) return false;
      if (personId && (e.personId === personId || e.uebernommenFuerPersonId === personId)) return true;
      return !!kennung && e.bosKontoId === kennung;
    }).sort(function (a, b) { return (b.datum || b.von || '').localeCompare(a.datum || a.von || '') || b.eingereichtAm - a.eingereichtAm; });
  }
  function einreichungText(e) {
    var teile = [];
    teile.push(e.art === 'urlaub_anfrage' ? T('zeitraum', { von: tagText(e.von), bis: tagText(e.bis) }) : tagText(e.datum));
    if (e.art === 'schichtplaner_wunschtag' && e.wichtig) teile.push(T('e_wichtig'));
    if (e.quelle === 'manuell') teile.push(T('e_nachgetragen'));
    if (e.eingereichtAm) teile.push(T('e_eingereicht', { am: zeitText(e.eingereichtAm) }));
    if (e.art !== 'schichtplaner_wunschtag') teile.push(e.uebernommenAm ? T('e_uebernommen', { am: zeitText(e.uebernommenAm) }) : T('e_offen'));
    return teile.join(T('e_trenner'));
  }
  function einreichungsZeilen(st, personId, kennung, art, heute) {
    return einreichungenVon(st, personId, kennung, art).map(function (e) {
      var alt = art === 'urlaub_anfrage' ? !!e.uebernommenAm : !!(e.datum && heute && e.datum < heute);
      return { text: einreichungText(e), vergangen: alt };
    });
  }
  /* Rechte eines Kontos. umfeld: { apps: BOS_APPS, permissions: BOS_PERMISSIONS, can: BOS_ACCESS.can, rollen: BOS_ROLES } */
  function rechteVon(z, konto, umfeld) {
    var u = umfeld || {};
    var apps = u.apps || [], perms = u.permissions || {};
    var gesteuert = {};                                           /* wie ladeGatedApps() der Kontenverwaltung: Vereinigung der Quellen */
    Object.keys(perms).forEach(function (r) { if (r.charAt(0) !== '_') Object.keys(perms[r] || {}).forEach(function (id) { gesteuert[id] = true; }); });
    apps.forEach(function (a) { if (a && ((a.roles && a.roles.length) || (a.haken && a.haken.length))) gesteuert[a.id] = true; });
    var pruefbar = typeof u.can === 'function';
    var darf = [], dazu = [], entzogen = [];
    apps.forEach(function (a) {
      if (!a || !gesteuert[a.id] || !pruefbar) return;
      if (u.can(a.id, konto.rolle, konto.overrides, konto.haken)) darf.push(a.name || a.id);
      if (Object.prototype.hasOwnProperty.call(konto.overrides, a.id)) (konto.overrides[a.id] ? dazu : entzogen).push(a.name || a.id);
    });
    var rolle = (u.rollen || []).filter(function (r) { return r.id === konto.rolle; })[0];
    return {
      rolle: rolle ? rolle.name : (konto.rolle || T('w_keine_rolle')),
      zugriffe: darf, dazu: dazu, entzogen: entzogen, zugriffePruefbar: pruefbar,
      haken: HAKEN.filter(function (h) { return konto.haken[h]; }).map(function (h) { return T('haken_' + h); })
        .concat(konto.hakenUnbekannt.map(function (h) { return T('haken_unbekannt', { feld: h }); })),
      gruppen: z.gruppen.filter(function (g) { return g.kennungen.indexOf(konto.id) !== -1; })
        .sort(function (a, b) { return a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name, 'de'); }).map(function (g) { return g.name; })
    };
  }
  /* Stand einer Quelle für die Anzeige: { fehler: Text|null, laedt: bool }. Grunddaten stehen im Zustand,
     Einreichungen und Bankkonto am geöffneten Knoten. */
  function quelleStand(z, st, quelle) {
    if (!quelle) return { fehler: null, laedt: false };
    if (quelle === 'einreichungen' || quelle === 'bankkonto') {
      return { fehler: (st && st.fehler[quelle]) || null, laedt: !(st && (st.geladen[quelle] || st.fehler[quelle])) };
    }
    return { fehler: z.fehler[quelle] || null, laedt: !(Object.prototype.hasOwnProperty.call(z.geladen, quelle) || z.fehler[quelle]) };
  }
  function sprung(name) { return { text: T('sprung_' + name), href: SPRUNG_ZIEL[name] }; }
  function abschnitt(z, st, a) {
    var q = quelleStand(z, st, a.quelle);
    a.titel = T('ab_' + a.id);
    a.fehler = q.fehler; a.laedt = q.laedt;
    a.felder = a.felder || []; a.hinweise = a.hinweise || []; a.spruenge = (a.spruenge || []).map(sprung);
    a.listen = (a.listen || []).map(function (l) {
      var eigen = l.quelle && l.quelle !== a.quelle;
      var lq = eigen ? quelleStand(z, st, l.quelle) : { fehler: null, laedt: false };
      l.fehler = lq.fehler; l.laedt = lq.laedt;
      return l;
    }).filter(function (l) { return l.zeilen.length || l.leer || l.fehler || l.laedt; });
    return a;
  }
  function kontoAbschnitte(z, st, konto, umfeld) {
    var r = rechteVon(z, konto, umfeld);
    return [
      abschnitt(z, st, { id: 'konto', quelle: 'konten', spruenge: ['konten'],
        felder: [[T('f_kennung'), konto.id], [T('f_notiz'), konto.name || T('strich')], [T('f_art'), wort('art_', ARTEN, konto.art) || T('w_art_offen')],
          [T('f_rolle'), r.rolle], [T('f_frei'), konto.freigeschaltet ? T('ja') : T('w_gesperrt')], [T('f_farbe'), konto.farbschema || T('w_farbe_rolle')]] }),
      abschnitt(z, st, { id: 'rechte', quelle: 'konten', spruenge: ['konten'],
        listen: [
          { titel: T('l_darf'), zeilen: zeilen(r.zugriffe), leer: r.zugriffePruefbar ? T('leer_darf') : null },
          { titel: T('l_dazu'), zeilen: zeilen(r.dazu), leer: null },
          { titel: T('l_entzogen'), zeilen: zeilen(r.entzogen), leer: null },
          { titel: T('l_haken'), zeilen: zeilen(r.haken), leer: T('leer_haken') },
          { titel: T('l_gruppen'), zeilen: zeilen(r.gruppen), leer: T('leer_gruppen'), quelle: 'gruppen' }
        ],
        hinweise: r.zugriffePruefbar ? [] : [T('hinweis_keine_pruefung')] })
    ];
  }
  /* Die Akte zu einem Baum-Knoten ('p:P07' oder 'k:kennung'). opt: { nameFn, umfeld, heute } */
  function akte(z, knotenId, opt) {
    var o = opt || {};
    var heute = o.heute || heuteIso();
    var kz = String(knotenId || '');
    var st = z.proKnoten[kz] || null;
    if (kz.indexOf('k:') === 0) {
      var kn = kz.slice(2), konto = z.konten[kn];
      if (!konto) return null;
      var ab = kontoAbschnitte(z, st, konto, o.umfeld);
      /* F6: Einreichungen dieses Kontos (nach einem Weggang nur noch hier zu finden) */
      ab.push(abschnitt(z, st, { id: 'einreichungen', quelle: 'einreichungen',
        listen: [
          { titel: T('l_urlaubsanfragen'), zeilen: einreichungsZeilen(st, null, kn, 'urlaub_anfrage', heute), leer: T('leer_keine') },
          { titel: T('l_wunschtage'), zeilen: einreichungsZeilen(st, null, kn, 'schichtplaner_wunschtag', heute), leer: T('leer_keine') },
          { titel: T('l_absagen'), zeilen: einreichungsZeilen(st, null, kn, 'sonntag_ablehnung', heute), leer: T('leer_keine') }
        ],
        hinweise: [T('hinweis_konto_knoten')] }));
      return { art: 'konto', knotenId: kz, id: kn, titel: konto.name || kn,
        unter: T('kopf_konto', { art: wort('art_', ARTEN, konto.art) || T('art_konto'), kennung: kn }), hinweise: [], abschnitte: ab };
    }
    if (kz.indexOf('p:') !== 0) return null;
    var id = kz.slice(2), p = z.personen[id];
    if (!p) return null;
    var name = z.namen[id] || { beschreibung: '', rufname: '' };
    var konto2 = kontoVonPerson(z, p);
    var kn2 = p.bosKontoId || null;
    var abschnitte = [];

    abschnitte.push(abschnitt(z, st, { id: 'name', quelle: 'namen', spruenge: ['konten'],
      felder: [[T('f_nummer'), id], [T('f_beschreibung'), name.beschreibung || T('w_keine_beschreibung')], [T('f_rufname'), name.rufname || T('w_kein_rufname')],
        [T('f_angezeigt'), anzeigeName(id, o.nameFn)]] }));

    abschnitte.push(abschnitt(z, st, { id: 'planung', quelle: 'personen', spruenge: ['personen'],
      felder: [
        [T('f_status'), wort('status_', STATUS, p.status) || p.status || T('w_offen')],
        [T('f_im_plan'), p.imSchichtplan ? T('ja') : T('nein')],
        [T('f_aktiv'), p.aktivFeldFehlt ? T('w_aktiv_fehlt') : (p.aktiv ? T('ja') : T('nein'))],
        [T('f_stammschicht'), wort('schicht_', SCHICHTEN, p.stammschicht) || T('w_schicht_offen')],
        [T('f_abteilung'), wort('abteilung_', ABTEILUNGEN, p.abteilung) || T('w_offen')],
        [T('f_teilbereich'), p.teilbereich ? (wort('teilbereich_', TEILBEREICHE, p.teilbereich) || p.teilbereich) : T('w_kein_teilbereich')],
        [T('f_arbeitstage'), tageText(p.arbeitstage, T('w_alle_tage'))],
        [T('f_freie_tage'), tageText(p.freieTagOptionen, T('w_keine_vorgabe'))],
        [T('f_gesperrt'), (p.gesperrteSchichten || []).map(function (s) { return wort('schicht_', SCHICHTEN, s) || s; }).join(', ') || T('w_keine_sperre')],
        [T('f_kein_rot'), p.keinRotierenderFreierTag ? T('ja') : T('nein')],
        [T('f_sonntage'), p.maxSonntageProMonat === null ? T('w_keine_grenze') : String(p.maxSonntageProMonat)]
      ].concat(p.status === 'azubi' ? [[T('f_einsatz'), p.einsatzfaehig === null ? T('w_nicht_gesetzt') : (p.einsatzfaehig ? T('ja') : T('nein'))]] : []) }));

    abschnitte.push(abschnitt(z, st, { id: 'positionen', quelle: 'positionen', spruenge: ['positionen'],
      listen: [{ titel: T('l_pools'), zeilen: poolsVon(z, id).map(function (x) {
        var s = wort('schicht_', SCHICHTEN, x.schicht);
        return { text: T(s ? 'pool_zeile_schicht' : 'pool_zeile', { name: x.name, schicht: s, rang: x.rang, von: x.von }) };
      }), leer: T('leer_pools') }] }));

    if (konto2) abschnitte = abschnitte.concat(kontoAbschnitte(z, st, konto2, o.umfeld));
    else abschnitte.push(abschnitt(z, st, { id: 'konto', quelle: 'konten', spruenge: ['konten'],
      hinweise: [kn2 ? T('hinweis_konto_leer', { kennung: kn2 }) : T('hinweis_kein_konto')] }));

    abschnitte.push(abschnitt(z, st, { id: 'urlaub', quelle: 'abwesenheiten', spruenge: ['abwesenheiten'],
      listen: [
        { titel: T('l_eingetragen'), zeilen: abwesenheitenVon(z, id, 'urlaub', heute), leer: T('leer_urlaub') },
        { titel: T('l_anfragen'), zeilen: einreichungsZeilen(st, id, kn2, 'urlaub_anfrage', heute), leer: T('leer_anfragen'), quelle: 'einreichungen' }
      ] }));

    abschnitte.push(abschnitt(z, st, { id: 'sonstiges', quelle: 'abwesenheiten', spruenge: ['abwesenheiten'],
      listen: [{ titel: T('l_eingetragen'), zeilen: abwesenheitenVon(z, id, 'sonstiges', heute), leer: T('leer_sonstiges') }] }));

    abschnitte.push(abschnitt(z, st, { id: 'wunschtag', quelle: 'einreichungen', spruenge: ['entwuerfe', 'sonntagsplan'],
      listen: [
        { titel: T('l_wunschtage'), zeilen: einreichungsZeilen(st, id, kn2, 'schichtplaner_wunschtag', heute), leer: T('leer_wunschtage') },
        { titel: T('l_absagen'), zeilen: einreichungsZeilen(st, id, kn2, 'sonntag_ablehnung', heute), leer: T('leer_absagen') }
      ],
      hinweise: kn2 ? [] : [T('hinweis_ohne_konto')] }));

    var b = st ? st.bankkonto : null;
    var bStand = quelleStand(z, st, 'bankkonto');
    abschnitte.push(abschnitt(z, st, { id: 'bankkonto', quelle: 'bankkonto', spruenge: ['bankkonto'],
      felder: b ? [[T('f_saldo'), String(b.saldo).replace('.', ',')], [T('f_wochen'), String(b.wochenGezaehlt)], [T('f_sa'), String(b.samstagKombi)],
        [T('f_mo'), String(b.montagKombi)], [T('f_wunsch'), String(b.wunschtagScore)], [T('f_schuld'), b.freieTageSchuld ? String(b.freieTageSchuld) : T('kein_wert')],
        [T('f_stand'), zeitText(b.aktualisiertAm) || T('strich')]] : [],
      hinweise: (b || bStand.fehler || bStand.laedt) ? [] : [T('hinweis_kein_stand')] }));

    return { art: 'person', knotenId: kz, id: id, titel: anzeigeName(id, o.nameFn),
      unter: kn2 ? T('kopf_person_konto', { id: id, kennung: kn2 }) : T('kopf_person_ohne', { id: id }),
      hinweise: p.aktivFeldFehlt ? [T('hinweis_aktiv_fehlt')] : [], abschnitte: abschnitte };
  }

  /* ---------- Selbsttest der Krank-Grenze (Go KC Punkt 6) ----------
     roh:   { abfrageId: [ rohe Dokumentdaten ] } — frisch geholt, nur für diesen Test, danach verworfen.
     z:     der gereinigte Zustand der Seite.
     Liefert NUR Zahlen, nie Inhalte (ein Fund darf nicht selbst zur Anzeige werden). */
  function selbsttest(roh, z) {
    var bericht = { sauber: true, zeilen: [] };
    function zeile(ok, t, nurHinweis) { bericht.zeilen.push({ ok: !!ok, hinweis: !!nurHinweis, text: t }); if (!ok) bericht.sauber = false; }
    var kr = 0, saetze = 0, wortKrank = 0, dokumente = 0;
    Object.keys(roh || {}).forEach(function (a) {
      (roh[a] || []).forEach(function (d) {
        dokumente++;
        if (d && d.grund === 'krank' + 'heit') kr++;
        if (d && text(d['begruendung'])) saetze++;
        var s = ''; try { s = JSON.stringify(d) || ''; } catch (e) { s = ''; }
        if (/krank/i.test(s)) wortKrank++;
      });
    });
    zeile(kr === 0, kr ? T('st_krank_fund', { zahl: kr, dokumente: dokumente }) : T('st_krank_ok', { dokumente: dokumente }));
    zeile(true, T('st_saetze', { zahl: saetze }), true);
    var behalten = ''; try { behalten = JSON.stringify(z) || ''; } catch (e2) { behalten = ''; }
    var hatFeld = /begruendung/i.test(behalten), hatKrank = /krankheit/i.test(behalten);
    zeile(!hatFeld, hatFeld ? T('st_feld_fund') : T('st_feld_ok'));
    zeile(!hatKrank, hatKrank ? T('st_wort_fund') : T('st_wort_ok'));
    if (wortKrank) zeile(true, T('st_freitext', { zahl: wortKrank }), true);
    return bericht;
  }

  var api = {
    GRUENDE: GRUENDE, EINREICHUNG_ARTEN: EINREICHUNG_ARTEN, HAKEN: HAKEN, SPRUNG_ZIEL: SPRUNG_ZIEL, DE: DE, T: T, setzeUebersetzer: setzeUebersetzer,
    abfragen: abfragen, abfragenFuer: abfragenFuer, baueAbfrage: baueAbfrage,
    reinigePerson: reinigePerson, reinigeName: reinigeName, reinigeKonto: reinigeKonto, reinigePosition: reinigePosition,
    reinigeAbwesenheit: reinigeAbwesenheit, reinigeEinreichung: reinigeEinreichung, reinigeBankkonto: reinigeBankkonto, reinigeGruppe: reinigeGruppe,
    neuerZustand: neuerZustand, leere: leere, nimmAuf: nimmAuf,
    knotenStand: knotenStand, nimmEinreichungenAuf: nimmEinreichungenAuf, nimmBankkontoAuf: nimmBankkontoAuf, vergissKnoten: vergissKnoten,
    anzeigeName: anzeigeName, baum: baum, filterBaum: filterBaum, akte: akte, rechteVon: rechteVon, poolsVon: poolsVon,
    selbsttest: selbsttest, tagText: tagText, zeitText: zeitText, heuteIso: heuteIso, millis: millis
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_PERSONALAKTE_LOGIK = api;
})(typeof window !== 'undefined' ? window : globalThis);
