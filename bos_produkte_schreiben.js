/* ================================================================
   BäckereiOS · bos_produkte_schreiben.js — Produkte schreiben, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_PRODUKTE_SCHREIBEN

   Einbindung NACH bos_firebase_config.js (braucht window.db und
   window.firebase), vor dem seiteneigenen Code:

     <script src="../bos_firebase_config.js"></script>
     <script src="../bos_produkte.js"></script>
     <script src="../bos_produkte_schreiben.js"></script>

   Zweck: Es gibt genau einen Schreibweg in die Sammlung `produkte`
   (neben dem Sync-Tool mit seiner Sammel-Sicherung). Die Regel verlangt
   je Produkt eine Sicherung der Vorversion im selben Vorgang und dass
   der Stand-Zettel im selben Vorgang steigt (RK §16, §17). Wer das
   nachbaut, baut es irgendwann anders. Aufrufer: Produkt-Editor (ein
   Produkt je Speichern), Seite „Teige & Rezepte“ (Feld ausTeig an den
   Broten eines Teigs, ab Etappe 2 Schub 2).

   HERKUNFT: Der Batch-Bau ist aus produkt_config_editor.html,
   speichereKarte(), Stand v-firestore-2b (07.10.2026, 10:08), Zeilen
   1061–1072 KOPIERT, nicht nachgebaut (Starter §4). Die Zeilen stehen
   unten wörtlich, nur in eine Schleife über mehrere Produkte gesetzt.

   Was hier NICHT liegt (bleibt beim Aufrufer): Stand vorab vom Server
   lesen und vergleichen (Konfliktmeldung), Meldungen, Anzeige, Fehler
   erklären. Dieses Modul schreibt nur und gibt den Fehler der Datenbank
   unverändert weiter (err.code, err.message), damit der Aufrufer ihn
   sichtbar machen kann.

   Aufruf:
     const e = await BOS_PRODUKTE_SCHREIBEN.schreibe({
       kennung,            // Konto-Kennung (Mail vor dem @), wird geprüft
       geladenerStand,     // Nummer des Stand-Zettels beim Laden, oder null
       standExistiert,     // gibt es produkte_stand/aktuell schon?
       eintraege: [{ key, inhalt, vorher, aktion }]
         // key     = legacyKey = Dokument-ID
         // inhalt  = vollständiges neues Dokument (mit reihenfolge, ggf. geloescht);
         //           sicherungId setzt dieses Modul hinein (der Aufrufer
         //           behält das Objekt als neuen Serverstand)
         // vorher  = rohes Serverdokument oder null beim Anlegen
         // aktion  = 'anlegen' | 'aendern' | 'archivieren' | 'wiederherstellen'
     });
     e.neuerStand          Nummer, die der Stand-Zettel jetzt trägt
     e.sicherungIds        { key: Kennung der Sicherung }

   Grenzen:
     - höchstens HOECHSTENS_JE_VORGANG Produkte je Aufruf (Zugriffsgrenze
       der Regel: je Produkt liest sie seine Sicherung; Konto und Stand
       zählen einmal, RK §16). Mehr teilt der Aufrufer in mehrere Aufrufe;
       jeder Aufruf zählt den Stand um 1 hoch.
     - Ein Aufruf ist EIN Batch: alles oder nichts.

   CHANGELOG
     2026-10-08 · 06:03 · v1 · Erstfassung (Teigecke Etappe 2, Schub 1)
       ANWEISUNG_2026-10-07_TEIGECKE_REZEPTE_STRECKE.md (KC 21:16), Teil D.
       Siehe SESSION_2026-10-07_TEIGECKE_REZEPTE_BAU.md.
   ================================================================ */
(function (global) {
  'use strict';

  var COLLECTION = 'produkte';
  var SICH_COLLECTION = 'produkte_sicherungen';
  var STAND_COLLECTION = 'produkte_stand', STAND_DOK = 'aktuell';
  var AKTIONEN = ['anlegen', 'aendern', 'archivieren', 'wiederherstellen'];
  var HOECHSTENS_JE_VORGANG = 10;

  function fehler(text) { var e = new Error(text); e.code = 'aufruf'; return e; }

  /* Prüft den Aufruf, bevor irgendetwas geschrieben wird. Liefert einen
     Fehlertext oder null. Reine Funktion (getestet). */
  function pruefeAufruf(o) {
    if (!o || typeof o !== 'object') return 'Kein Auftrag übergeben.';
    if (typeof o.kennung !== 'string' || !o.kennung) return 'Keine Kennung — bist du angemeldet?';
    if (!(o.geladenerStand === null || (typeof o.geladenerStand === 'number' && o.geladenerStand >= 0 && Math.floor(o.geladenerStand) === o.geladenerStand))) return 'Geladener Stand fehlt oder ist keine ganze Zahl.';
    if (typeof o.standExistiert !== 'boolean') return 'Unbekannt, ob es den Stand-Zettel schon gibt.';
    if (!Array.isArray(o.eintraege) || !o.eintraege.length) return 'Nichts zu speichern.';
    if (o.eintraege.length > HOECHSTENS_JE_VORGANG) return 'Zu viele Produkte in einem Vorgang (' + o.eintraege.length + ', höchstens ' + HOECHSTENS_JE_VORGANG + ').';
    var gesehen = {};
    for (var i = 0; i < o.eintraege.length; i++) {
      var e = o.eintraege[i] || {};
      if (typeof e.key !== 'string' || !e.key) return 'Eintrag ' + (i + 1) + ': Produkt-Schlüssel fehlt.';
      if (gesehen[e.key]) return 'Produkt „' + e.key + '“ steht zweimal im Auftrag.';
      gesehen[e.key] = true;
      if (!e.inhalt || typeof e.inhalt !== 'object') return 'Produkt „' + e.key + '“: Inhalt fehlt.';
      if (e.inhalt.legacyKey !== undefined && e.inhalt.legacyKey !== e.key) return 'Produkt „' + e.key + '“: Schlüssel im Inhalt passt nicht (' + e.inhalt.legacyKey + ').';
      if (AKTIONEN.indexOf(e.aktion) === -1) return 'Produkt „' + e.key + '“: unbekannte Aktion „' + e.aktion + '“.';
      /* Wie die Regel: vorher ist das rohe Serverdokument oder null (gibt es noch nicht). Mehr wird
         bewusst nicht verlangt, damit der Editor sich durch den Umzug nicht anders verhält. */
      if (!(e.vorher === null || (typeof e.vorher === 'object' && !Array.isArray(e.vorher)))) return 'Produkt „' + e.key + '“: Vorversion muss das Serverdokument oder null sein.';
    }
    return null;
  }

  async function schreibe(o, umgebung) {
    var u = umgebung || {};
    var db = u.db || global.db, firebase = u.firebase || global.firebase;
    if (!db || !firebase) throw fehler('Datenbank nicht geladen (bos_firebase_config.js fehlt?).');
    var falsch = pruefeAufruf(o);
    if (falsch) throw fehler(falsch);
    var kennung = o.kennung, geladenerStand = o.geladenerStand;
    var standRef = db.collection(STAND_COLLECTION).doc(STAND_DOK);
    var sicherungIds = {};

    /* ---- ab hier kopiert aus speichereKarte (Editor Z. 1061–1072) ---- */
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    var neuerStand = (geladenerStand === null ? 0 : geladenerStand) + 1;
    var batch = db.batch();
    o.eintraege.forEach(function (e) {
      var key = e.key, inhalt = e.inhalt, roh = e.vorher, aktion = e.aktion;
      var sichRef = db.collection(SICH_COLLECTION).doc();
      inhalt.sicherungId = sichRef.id;
      batch.set(sichRef, { collection: COLLECTION, dokId: key, aktion: aktion, vorher: roh, konto: kennung, ts: ts });
      batch.set(db.collection(COLLECTION).doc(key), inhalt);
      sicherungIds[key] = sichRef.id;
    });
    var standDaten = { nummer: neuerStand, geaendertAm: ts, geaendertVon: kennung };
    if (o.standExistiert) batch.update(standRef, standDaten); else batch.set(standRef, standDaten);
    await batch.commit();
    /* ---- Ende der Kopie ---- */

    return { neuerStand: neuerStand, sicherungIds: sicherungIds };
  }

  var api = {
    schreibe: schreibe, pruefeAufruf: pruefeAufruf,
    HOECHSTENS_JE_VORGANG: HOECHSTENS_JE_VORGANG, AKTIONEN: AKTIONEN,
    COLLECTION: COLLECTION, SICH_COLLECTION: SICH_COLLECTION, STAND_COLLECTION: STAND_COLLECTION, STAND_DOK: STAND_DOK
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_PRODUKTE_SCHREIBEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
