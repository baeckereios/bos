/**
 * bos_zeitkontext.js
 * ------------------------------------------------------------
 * Zentrale Host-Funktion für den Zeitkontext eines Datums: ist der
 * Tag offen oder geschlossen, und welche Hamster-Stufe (0-3) gilt
 * für diesen Tag.
 *
 * EINE HOST-FUNKTION, ZWEI ABNEHMER (Fundament §5.3): sowohl die
 * Durchschnittsberechnung (bos_verbrauch_durchschnitt.js — einen
 * Tag aus dem Schnitt ausschließen) als auch die künftige Produktions-
 * kette (tagTyp(j)/vbAn(j), Fundament §3.2) sollen dieselbe Funktion
 * nutzen. Bewusste Lehre aus dem Altsystem: zwei widersprüchliche
 * BOS_HAMSTER-Implementierungen mit inkompatiblen Signaturen
 * (Fundament §6, Bekannte Bugs — live bestätigt am 29.08.2026 anhand
 * der echten hamster_gehirn.js/hamster_logik.js) — nicht wiederholen.
 *
 * KORREKTUR 29.08.2026: hamsterFaktor (Zahl, Zeitraum-gebunden) durch
 * hamsterStufe (0-3, pro Tag) ersetzt. Anhand der echten Altsystem-
 * Dateien bestätigt: Hamster ist eine manuelle Tages-Zuweisung, keine
 * aus dem Kalender abgeleitete Größe — gehört fachlich hierher (Ulf
 * setzt sie pro Tag), nicht in bos_zeitkontext_referenz.js. Was eine
 * Stufe rechnerisch bedeutet (Modi, Faktoren), lebt separat in
 * bos_hamster.js + bos_hamster_config.json — dieser Datei hier ist
 * nur die Zuweisung wichtig, nicht die Berechnung damit.
 *
 * PRIORITÄTSKETTE (SESSION_2026-08-29_DURCHSCHNITTSBERECHNUNG_
 * ZEITKONTEXT.md, §4.2, präzisiert 29.08.2026 im Chat) — dieselbe
 * Rangfolge wie in der Produktionskette (gesperrt > manuell >
 * automatisch, Fundament §3.3), auf den Zeitkontext übertragen:
 *
 *   1. Firestore    — Ulf als Admin, global, spontan. Gewinnt immer,
 *                      wenn für das Datum ein Dokument existiert.
 *                      Beispiel Ulf: "Donnerstag vor dem Feiertag mit
 *                      Hamster 2 rechnen."
 *   2. localStorage  — einzelner Nutzer, lokal. Nur wirksam, wenn
 *                      Firestore für das Datum nichts sagt — "kann vom
 *                      User bestimmt werden, wenn Firestore keine
 *                      Infos hergibt" (Ulf, 29.08.2026).
 *   3. Datei/Boden   — für offen/grund: System-Standard-Referenz
 *                      (bos_zeitkontext_referenz.js). Für hamsterStufe
 *                      gibt es KEINEN Datei-Boden — mangels Admin-/
 *                      Nutzer-Eintrag ist der Boden schlicht Stufe 0
 *                      (kein Hamster). Ein "Standard-Hamster" ergibt
 *                      fachlich keinen Sinn, im Gegensatz zu Feiertagen.
 *
 * Einbindung (Unterordner-Satellit) — Reihenfolge wichtig, die
 * Referenzdatei muss vor dieser Datei geladen sein:
 *   <script src="../bos_zeitkontext_referenz.js"></script>
 *   <script src="../bos_firebase_config.js"></script>
 *   <script src="../bos_zeitkontext.js"></script>
 *
 * Root-Ebene, daher Konvention wie bos_firebase_config.js: Root nutzt
 * ./bos_zeitkontext.js, Unterordner-Satelliten ../.
 *
 * FIRESTORE-DATENMODELL: Dokument pro Datum (Schlüssel = Datum,
 * 'YYYY-MM-DD'), Collection 'bos_zeitkontext'. KEIN Append-only —
 * das hier ist ein Zustand, keine Messreihe, Last-Write-Wins reicht
 * (gleiche Einordnung wie bei produkt_config.json). Erwartete Felder:
 *   { offen: boolean, grund: string, hamsterStufe: 0|1|2|3,
 *     gesetztVon: string, ts: serverTimestamp }
 * Fehlende Felder sind erlaubt — z. B. nur hamsterStufe setzen, ohne
 * offen zu berühren (siehe _holeFirestore: offen !== false).
 *
 * LOCALSTORAGE-DATENMODELL: profilgebunden über activeProfileId aus
 * bos_launcher_state_v2 (gleiches Prinzip wie Theme/Accent/Background,
 * siehe bos_theme_sync.js), damit auf gemeinsam genutzten Geräten
 * Einstellungen nicht profilübergreifend durchschlagen:
 *   bos_zeitkontext_lokal: {
 *     "<profileId>": {
 *       "<datumStr>": { offen: boolean, grund?: string, hamsterStufe?: 0|1|2|3 }
 *     }
 *   }
 * Bewusst ein eigener, separater Key (nicht in bos_launcher_state_v2
 * selbst) — Launcher-Zustand und fachlicher Zeitkontext sind zwei
 * verschiedene Dinge, sollen nicht vermischt werden.
 *
 * GRACEFUL DEGRADATION durchgängig: Jede Ebene, die nicht lesbar ist
 * (Firestore-Fehler, kaputtes localStorage, fehlende Referenzdatei),
 * wird übersprungen statt einen Absturz zu verursachen — die nächste
 * Ebene der Kette übernimmt.
 * ------------------------------------------------------------
 */

window.BOS_ZEITKONTEXT = {

  FIRESTORE_COLLECTION: 'bos_zeitkontext',
  LOCALSTORAGE_KEY: 'bos_zeitkontext_lokal',

  /**
   * Ermittelt den Zeitkontext für ein Datum nach der Prioritätskette
   * Firestore > localStorage > Datei/Boden.
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} datumStr  'YYYY-MM-DD'
   * @returns {Promise<{offen: boolean, grund: string|null, hamsterStufe: 0|1|2|3, quelle: 'firestore'|'lokal'|'datei'}>}
   */
  async status(db, datumStr) {
    const firestoreEintrag = await this._holeFirestore(db, datumStr);
    if (firestoreEintrag) {
      return { ...firestoreEintrag, quelle: 'firestore' };
    }

    const lokalerEintrag = this._holeLokal(datumStr);
    if (lokalerEintrag) {
      return { ...lokalerEintrag, quelle: 'lokal' };
    }

    return { ...this._holeReferenz(datumStr), quelle: 'datei' };
  },

  /**
   * Ebene 1 — Firestore. null, wenn kein Dokument für dieses Datum
   * existiert oder die Abfrage fehlschlägt (dann übernimmt die
   * nächste Ebene, kein Absturz).
   */
  async _holeFirestore(db, datumStr) {
    try {
      const doc = await db.collection(this.FIRESTORE_COLLECTION).doc(datumStr).get();
      if (!doc.exists) return null;
      const data = doc.data() || {};
      return {
        offen: data.offen !== false,
        grund: data.grund || null,
        hamsterStufe: this._parseStufe(data.hamsterStufe)
      };
    } catch (fehler) {
      console.warn('BOS_ZEITKONTEXT._holeFirestore: Abfrage fehlgeschlagen, Fallback auf localStorage/Datei.', fehler);
      return null;
    }
  },

  /**
   * Admin-Schreibzugriff — Ebene 1. Setzt (oder überschreibt) den
   * Zeitkontext für ein Datum in Firestore. Last-Write-Wins, kein
   * Merge mit einem evtl. vorhandenen Dokument nötig (Zustand, keine
   * Messreihe) — wer schreibt, gibt den vollständigen neuen Stand an.
   *
   * @param {firebase.firestore.Firestore} db
   * @param {string} datumStr
   * @param {{offen?: boolean, grund?: string, hamsterStufe?: 0|1|2|3}} eintrag
   * @param {string} [gesetztVon]  z. B. Profilname — rein informativ
   * @returns {Promise<boolean>} true bei Erfolg
   */
  /* Letzter Fehler aus setzeFirestore() — NEU 21.09.2026 (B-40).
     setzeFirestore() wirft absichtlich nicht, sondern liefert true/false
     (T-84); feiertage.html baut ausdrücklich darauf auf. Dieser Vertrag
     bleibt. Nur ging dabei der GRUND verloren: ein Aufrufer sah
     "fehlgeschlagen", aber nicht "keine Berechtigung". Seit Etappe 3.4
     lehnt der Server das globale Schreiben für alle außer der Planung
     ab — ohne Grund hält ein Kollege die Seite dann für kaputt statt
     für richtig verriegelt. Aufrufer lesen den Grund hier nach. */
  letzterFehler: null,

  /* Klartext zum letzten Fehler — für die Anzeige beim Aufrufer. */
  grundDesLetztenFehlers() {
    var f = this.letzterFehler;
    if (!f) return '';
    if (f.code === 'permission-denied') {
      return 'Keine Berechtigung — global speichern darf nur die Planung. ' +
             'Auf diesem Gerät lokal speichern geht weiterhin.';
    }
    if (f.code === 'unavailable') {
      return 'Keine Verbindung zu Firestore.';
    }
    return (f.code ? f.code + ' — ' : '') + (f.message || String(f));
  },

  async setzeFirestore(db, datumStr, eintrag, gesetztVon) {
    this.letzterFehler = null;
    try {
      await db.collection(this.FIRESTORE_COLLECTION).doc(datumStr).set({
        offen: eintrag.offen !== false,
        grund: eintrag.grund || null,
        hamsterStufe: this._parseStufe(eintrag.hamsterStufe),
        gesetztVon: gesetztVon || null,
        ts: firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (fehler) {
      this.letzterFehler = fehler;
      console.warn('BOS_ZEITKONTEXT.setzeFirestore: Schreiben fehlgeschlagen.', fehler);
      return false;
    }
  },

  /**
   * Ebene 2 — localStorage, profilgebunden. null, wenn kein aktives
   * Profil ermittelbar ist oder kein Eintrag für dieses Datum existiert.
   */
  _holeLokal(datumStr) {
    try {
      const launcherState = JSON.parse(localStorage.getItem('bos_launcher_state_v2') || 'null');
      const profileId = launcherState?.activeProfileId;
      if (!profileId) return null;

      const alle = JSON.parse(localStorage.getItem(this.LOCALSTORAGE_KEY) || '{}');
      const eintrag = alle?.[profileId]?.[datumStr];
      if (!eintrag) return null;

      return {
        offen: eintrag.offen !== false,
        grund: eintrag.grund || null,
        hamsterStufe: this._parseStufe(eintrag.hamsterStufe)
      };
    } catch (fehler) {
      console.warn('BOS_ZEITKONTEXT._holeLokal: localStorage nicht lesbar, Fallback auf Datei.', fehler);
      return null;
    }
  },

  /**
   * Ebene 3 — Datei/Boden. Für offen/grund: System-Standard aus
   * bos_zeitkontext_referenz.js (Feiertage/Ferien). Für hamsterStufe
   * gibt es keinen Datei-Boden — Standard ist Stufe 0 (kein Hamster),
   * siehe Header. Fehlt die Referenzdatei (nicht eingebunden), gilt
   * der Tag als offen — graceful degradation, kein Absturz.
   */
  _holeReferenz(datumStr) {
    const besonders = window.BOS_IST_BESONDERER_TAG?.(datumStr) ?? null;

    return {
      offen: besonders === null,
      grund: besonders?.name ?? null,
      hamsterStufe: 0
    };
  },

  /**
   * Schreibt ein lokales Nutzer-Override in localStorage, profilgebunden.
   * Bewusst synchron (kein Firestore-Zugriff) — das ist genau der Zweck
   * der lokalen Ebene: sofort verfügbar, ohne Admin-Rechte.
   *
   * @param {string} datumStr
   * @param {{offen?: boolean, grund?: string, hamsterStufe?: 0|1|2|3}} eintrag
   * @returns {boolean} true bei Erfolg, false wenn kein Profil ermittelbar war
   */
  setzeLokal(datumStr, eintrag) {
    try {
      const launcherState = JSON.parse(localStorage.getItem('bos_launcher_state_v2') || 'null');
      const profileId = launcherState?.activeProfileId;
      if (!profileId) return false;

      const alle = JSON.parse(localStorage.getItem(this.LOCALSTORAGE_KEY) || '{}');
      alle[profileId] = alle[profileId] || {};
      alle[profileId][datumStr] = {
        offen: eintrag.offen !== false,
        grund: eintrag.grund || null,
        hamsterStufe: this._parseStufe(eintrag.hamsterStufe)
      };
      localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(alle));
      return true;
    } catch (fehler) {
      console.warn('BOS_ZEITKONTEXT.setzeLokal: localStorage nicht beschreibbar.', fehler);
      return false;
    }
  },

  /**
   * Validiert/normalisiert eine Hamster-Stufe auf 0-3. Alles andere
   * (fehlt, falscher Typ, außerhalb 0-3) wird zu 0 — lieber "kein
   * Hamster" als ein unsinniger Wert, der irgendwo unbemerkt eine
   * Bedarfsberechnung verzerrt.
   */
  _parseStufe(wert) {
    const n = Number(wert);
    return (Number.isInteger(n) && n >= 0 && n <= 3) ? n : 0;
  }
};
