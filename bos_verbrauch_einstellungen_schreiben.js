/* ================================================================
   BäckereiOS · bos_verbrauch_einstellungen_schreiben.js — Verbrauch-Einstellungen schreiben, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_VERBRAUCH_EINSTELLUNGEN_SCHREIBEN (im Browser)
   bzw. module.exports (Node, für die Prüfdatei).

   Einbindung NACH bos_firebase_config.js und bos_verbrauch_durchschnitt.js
   (Konstanten und Prüffunktionen werden nur MITBENUTZT, nie geändert):

     <script src="../bos_firebase_config.js"></script>
     <script src="../bos_verbrauch_durchschnitt.js"></script>
     <script src="../bos_verbrauch_einstellungen_schreiben.js"></script>

   Zweck: Es gibt genau einen Schreibweg in verbrauch_einstellungen/system
   (Regel RK §24: Sicherung der Vorversion im selben Batch, Stand + 1, nur
   Rolle admin). Vorbild bos_produkte_schreiben.js. Aufrufer:
     - Verbrauch-Einstellungen-Editor (verbrauch_einstellungen/…_editor.html):
       Erst-Füllung, Speichern, Vorversion zurückholen
     - Backzettel-Erfassung (backzettel/backzettel_erfassung.html, Stufe 2b):
       einen ganzen Backtag in offiziell.ausgeschlosseneTage setzen/entfernen

   HERKUNFT (Starter §4): Der Batch-Bau in schreibe() ist aus
   verbrauch_einstellungen_editor.html, schreibe(), Stand 20.10.2026
   (MD5 151e87f5db20b15ce13bcf9c9d9a233f), Z. 1254–1262 KOPIERT. Die Zeilen
   stehen unten wörtlich (nur window.db/firebase als Parameter).

   Was hier NICHT liegt: Meldungstexte des Editors, Zeitlimit (Aufrufer),
   Neuladen und Gerätekopie danach.

   Aufruf:
     M.schreibe({ kennung, aktion, vorher, bloecke: { manuell, offiziell } }, umgebung?)
       aktion  'erstfuellung' | 'aendern' | 'zurueckholen'
       vorher  rohes Serverdokument (== resource.data für veGesichert) oder null
       → Promise { stand, sicherungId }. Fehler der Datenbank unverändert (code, message).
     M.tagAusschlussListe(liste, datum, grund)       reine Logik
       grund null = entfernen · → { liste, geaendert, vorher }
     M.setzeTagAusschluss({ kennung, datum, grund }, umgebung?)
       liest frisch vom Server, ändert NUR diesen einen Eintrag in
       offiziell.ausgeschlosseneTage, alles andere bleibt wie gelesen;
       unverändert → nichts geschrieben, kein Stand + 1 (idempotent).
       Konflikt (Stand inzwischen gestiegen) → genau EINE Wiederholung mit
       dem frischen Stand. → Promise { geschrieben, stand, vorher }
       Fehler tragen .art: 'grund_zu_lang' | 'voll' | 'ungueltig' | 'leer' |
       'konflikt' | 'rolle' | 'kein_netz' | 'aufruf' und .code/.original.
     umgebung: { db, firebase, V } (Vorgabe: window.db, window.firebase, window.BOS_VERBRAUCH)

   CHANGELOG
     2026-10-28 · 17:41 · v1 · Erstfassung (Backzettel Stufe 2b „ganzen Tag ausschließen“)
       ANWEISUNG_2026-10-28_BACKZETTEL_TAG_AUSSCHLIESSEN.md (KC 09:32),
       Freigabe Bauplan KC (28.10., 09:53/17:24), K1 tagAusschlussListe hier.
       SESSION_2026-10-28_BACKZETTEL_TAG_AUSSCHLIESSEN_BAU.md
   ================================================================ */
(function (global) {
  'use strict';

  var AKTIONEN = ['erstfuellung', 'aendern', 'zurueckholen'];
  var TOEPFE = ['manuell', 'offiziell'];

  function umg(u) {
    u = u || {};
    return { db: u.db || global.db, firebase: u.firebase || global.firebase, V: u.V || global.BOS_VERBRAUCH };
  }
  function fehler(art, text, original) {
    var e = new Error(text);
    e.art = art;
    if (original) { e.code = original.code; e.original = original; }
    else e.code = art === 'aufruf' ? 'aufruf' : undefined;
    return e;
  }

  /* ---------- schreiben (Batch: Sicherung + system) ---------- */
  function schreibe(o, umgebung) {
    var u = umg(umgebung), db = u.db, firebase = u.firebase, V = u.V;
    if (!db || !firebase || !V) return Promise.reject(fehler('aufruf', 'Datenbank oder Rechner nicht geladen (bos_firebase_config.js / bos_verbrauch_durchschnitt.js fehlt?).'));
    if (!o || typeof o.kennung !== 'string' || !o.kennung) return Promise.reject(fehler('aufruf', 'Keine Kennung — bist du angemeldet?'));
    if (AKTIONEN.indexOf(o.aktion) === -1) return Promise.reject(fehler('aufruf', 'Unbekannte Aktion „' + o.aktion + '“.'));
    if (!(o.vorher === null || (o.vorher && typeof o.vorher === 'object'))) return Promise.reject(fehler('aufruf', 'Vorversion muss das Serverdokument oder null sein.'));
    if (!o.bloecke) return Promise.reject(fehler('aufruf', 'Nichts zu speichern.'));
    for (var i = 0; i < TOEPFE.length; i++) {
      var f = V.pruefeEinstellungsBlock(V.nurEinstellungsFelder(o.bloecke[TOEPFE[i]], TOEPFE[i]), TOEPFE[i]);
      if (f.length) { var e = fehler('ungueltig', TOEPFE[i] + ': ' + f.map(function (x) { return (x.feld || '') + ' ' + x.grund; }).join('; ')); e.fehler = f; e.topf = TOEPFE[i]; return Promise.reject(e); }
    }
    var k = o.kennung, aktion = o.aktion, vorher = o.vorher, bloecke = o.bloecke;
    var geladenerStand = vorher ? vorher.stand : 0;
    /* ---- ab hier kopiert aus dem Editor, schreibe() Z. 1254–1262 ---- */
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const b = db.batch();
    const sRef = db.collection(V.EINSTELLUNGEN_SICHERUNGEN).doc();
    b.set(sRef, { dokId: V.EINSTELLUNGEN_DOK, aktion: aktion, vorher: vorher, konto: k, ts: ts });
    b.set(db.collection(V.EINSTELLUNGEN_COLLECTION).doc(V.EINSTELLUNGEN_DOK), {
      manuell: V.nurEinstellungsFelder(bloecke.manuell, 'manuell'),     // V1: nur die acht Felder
      offiziell: V.nurEinstellungsFelder(bloecke.offiziell, 'offiziell'),
      stand: geladenerStand + 1, sicherungId: sRef.id, geaendertVon: k, geaendertAm: ts
    });
    /* ---- Ende der Kopie (commit: der Aufrufer setzt das Zeitlimit) ---- */
    return b.commit().then(function () { return { stand: geladenerStand + 1, sicherungId: sRef.id }; });
  }

  /* ---------- reine Logik: ein Eintrag in ausgeschlosseneTage ----------
     Nur der Eintrag des Datums ändert sich; alle anderen bleiben (gleiche
     Objekte, gleiche Reihenfolge). Neu: an die absteigend sortierte Stelle
     (wie kalenderTagKlick im Editor). Gleicher Grund (fehlend = '') →
     geaendert: false. grund null → entfernen. */
  function tagAusschlussListe(liste, datum, grund) {
    var alt = Array.isArray(liste) ? liste : [];
    var idx = -1;
    for (var i = 0; i < alt.length; i++) if (alt[i] && alt[i].datum === datum) { idx = i; break; }
    var vorher = idx > -1 ? alt[idx] : null;
    if (grund === null || grund === undefined) {
      if (idx === -1) return { liste: alt.slice(), geaendert: false, vorher: null };
      return { liste: alt.slice(0, idx).concat(alt.slice(idx + 1)), geaendert: true, vorher: vorher };
    }
    var g = String(grund);
    if (idx > -1) {
      if ((vorher.grund === undefined || vorher.grund === null ? '' : String(vorher.grund)) === g) return { liste: alt.slice(), geaendert: false, vorher: vorher };
      var neu1 = alt.slice(); neu1[idx] = { datum: datum, grund: g };
      return { liste: neu1, geaendert: true, vorher: vorher };
    }
    var stelle = alt.length;
    for (var j = 0; j < alt.length; j++) if (alt[j] && String(alt[j].datum) < datum) { stelle = j; break; }
    var neu2 = alt.slice(0, stelle).concat([{ datum: datum, grund: g }], alt.slice(stelle));
    return { liste: neu2, geaendert: true, vorher: null };
  }

  /* ---------- einen Backtag setzen / entfernen ---------- */
  function liesSystem(u) {
    return u.db.collection(u.V.EINSTELLUNGEN_COLLECTION).doc(u.V.EINSTELLUNGEN_DOK).get({ source: 'server' }).then(function (snap) {
      if (snap && snap.metadata && snap.metadata.fromCache) { var e = new Error('Antwort aus dem Zwischenspeicher'); e.code = 'unavailable'; throw e; }
      return snap && snap.exists ? snap.data() : null;
    });
  }
  function einordnen(err) {
    if (err && err.art) return err;
    var code = err && err.code;
    if (code === 'unavailable') return fehler('kein_netz', (err && err.message) || 'kein Netz', err);
    if (code === 'permission-denied') return fehler('rolle', (err && err.message) || 'abgelehnt', err);
    return fehler('fehler', (err && err.message) || String(err), err);
  }
  function setzeTagAusschluss(o, umgebung) {
    var u = umg(umgebung), V = u.V;
    if (!u.db || !u.firebase || !V) return Promise.reject(fehler('aufruf', 'Datenbank oder Rechner nicht geladen.'));
    if (!o || typeof o.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.datum)) return Promise.reject(fehler('aufruf', 'Datum fehlt (JJJJ-MM-TT).'));
    var grund = o.grund === null || o.grund === undefined ? null : String(o.grund);
    var grenze = V.EINSTELLUNGEN_FELDER.ausgeschlosseneTage;
    if (grund !== null && grund.length > grenze.grundMax) return Promise.reject(fehler('grund_zu_lang', 'Grund höchstens ' + grenze.grundMax + ' Zeichen (jetzt ' + grund.length + ').'));
    var gelesenerStand = null;

    function einmal() {
      return liesSystem(u).then(function (roh) {
        if (!roh) throw fehler('leer', 'Die Einstellungen stehen noch nicht in der Datenbank (Erst-Füllung im Editor).');
        gelesenerStand = roh.stand;
        var off = roh.offiziell || {};
        var r = tagAusschlussListe(off.ausgeschlosseneTage, o.datum, grund);
        if (!r.geaendert) return { geschrieben: false, stand: roh.stand, vorher: r.vorher };
        if (r.liste.length > grenze.max) throw fehler('voll', 'Die Liste der ausgeschlossenen Tage ist voll (' + grenze.max + ').');
        var offNeu = V.nurEinstellungsFelder(off, 'offiziell');
        offNeu.ausgeschlosseneTage = r.liste;
        return schreibe({ kennung: o.kennung, aktion: 'aendern', vorher: roh, bloecke: { manuell: roh.manuell, offiziell: offNeu } }, umgebung)
          .then(function (erg) { return { geschrieben: true, stand: erg.stand, vorher: r.vorher }; });
      });
    }
    return einmal().catch(function (err) {
      if (!err || err.code !== 'permission-denied' || err.art) throw einordnen(err);
      var ersterStand = gelesenerStand;
      // Konflikt oder Rolle? Stand neu lesen (Muster Editor)
      return liesSystem(u).then(function (jetzt) { return jetzt ? jetzt.stand : null; }, function () { return ersterStand; }).then(function (standJetzt) {
        if (standJetzt === ersterStand) throw fehler('rolle', err.message, err);
        // Stand gestiegen: genau EINE Wiederholung mit dem frischen Stand
        return einmal().catch(function (err2) {
          if (err2 && err2.code === 'permission-denied' && !err2.art) {
            return liesSystem(u).then(function (j2) { return j2 ? j2.stand : null; }, function () { return gelesenerStand; }).then(function (s2) {
              throw s2 !== gelesenerStand ? fehler('konflikt', err2.message, err2) : fehler('rolle', err2.message, err2);
            });
          }
          throw einordnen(err2);
        });
      });
    });
  }

  var api = { schreibe: schreibe, tagAusschlussListe: tagAusschlussListe, setzeTagAusschluss: setzeTagAusschluss, AKTIONEN: AKTIONEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_VERBRAUCH_EINSTELLUNGEN_SCHREIBEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
