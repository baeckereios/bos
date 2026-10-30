/* ================================================================
   BäckereiOS · Host — Profil-Einstellungen-Sync
   ================================================================
   Spiegelt die persönlichen "Geschmacks"-Einstellungen eines Profils
   (Theme, Dichte, Kachelgröße, Akzentfarbe, Hintergrund, Symbolpaket,
   Icon-Stil, Kachel-Reihenfolge, Kachel-Anpassungen, eigene Kacheln,
   installierte Apps) zusätzlich nach Firestore — geräteübergreifend, geschlüsselt
   über dieselbe profilId, die launcher.html auch lokal als
   state.profileData[profilId]-Schlüssel nutzt. Gilt für Konto-Profile
   UND feste Profile aus bos_launcher_profiles.js gleichermaßen (z.B.
   Ulfs Admin-Profil) — anders als der Rollen-Sync über bos_accounts.js,
   der nur Konto-Profile betrifft.

   Auslöser: Ulf, Chat 04./05.09.2026 — Tablet-Szenario, siehe
   SESSION_2026-09-04_PROFIL_EINSTELLUNGEN_SYNC_KONZEPT.md (dort auch
   die vollständige Begründung/Alternativen-Abwägung).

   Bewusst eigene Collection, nicht Teil von bos_accounts:
   - Feste Profile (z.B. Ulf) haben gar kein bos_accounts-Dokument —
     ein Feld dort würde sie ausschließen.
   - Andere Zuständigkeit als Rolle/Rechte: bos_accounts verlangt für
     Schreibzugriffe adminReauth() (Missbrauch dort hätte echten
     Schaden), hier darf jedes Profil sich jederzeit selbst ändern.

   Bewusst NICHT synchronisiert: positions (col/row). Das Raster wird
   in launcher.html erst zur Laufzeit aus der tatsächlichen Bildschirm-
   breite berechnet (computeCols()) — übernommene Koordinaten von einem
   anderen Gerät könnten dort nicht passen. order (Reihenfolge) synct.
   BERICHTIGT 29.10.2026: Bis dahin stand hier, die Reihenfolge gehe damit
   „sinnvoll mit“. Das stimmte nur für NEUE Geräte: order änderte sich nur
   beim Installieren/Entfernen, und ein Gerät mit eigenen positions las
   order nie wieder — eine Anordnung kam nie auf einem anderen Gerät an.
   Seit 29.10.2026: launcher.html schreibt nach jedem Verschieben die
   Lesereihenfolge des Bildschirms in order und einen neuen orderStand;
   ein anderes Gerät, dessen zuletzt ausgelegter Stand (orderStandAngewendet,
   lokal) davon abweicht, leert beim Laden seine positions und legt nach
   order neu aus (uebernimmEinstellungen in launcher.html).

   SCHUTZ VOR ZURÜCKDREHEN (29.10.2026, Auflage A1 Kontroll-Chat): .set()
   ohne merge schreibt das ganze Dokument. Ein Gerät, das schon offen war,
   bevor ein anderes verschoben hat, würde beim nächsten Speichern irgend-
   einer Kleinigkeit seine alte order + seinen alten orderStand zurück-
   schreiben. Deshalb liest speichere() vor dem Schreiben den Stand in
   Firestore (ordnungAbgleichen):
     - Firestore ohne orderStand oder gleich dem eigenen → normal schreiben.
     - eigener orderStand ≠ orderStandBasis (lokal: der Stand, den Firestore
       beim letzten Laden/Schreiben dieses Geräts trug) → dieses Gerät hat
       seitdem selbst verschoben → seine Reihenfolge gilt.
     - sonst hat ein anderes Gerät verschoben: dessen order + orderStand
       gehen in den Schreibvorgang und über lokalNachtragen() in den lokalen
       Stand (ohne orderStandAngewendet — neu ausgelegt wird beim nächsten
       Start).
   Lesefehler vor dem Schreiben: es wird NICHT geschrieben (lieber nichts
   als zurückdrehen), der Fehler geht an rueckmeldung (sichtbar im
   Einstellungs-Fenster). Schreibvorgänge eines Profils laufen nacheinander.
   OHNE NETZ (30.10.2026, Nacharbeit N1): Scheitert Lesen oder Schreiben mit
   unavailable / zeitlimit (15 s) / deadline-exceeded, wird der Vorgang
   gemerkt und nachgeholt — beim Ereignis 'online' und nach 15 s, 30 s, 1, 2,
   dann alle 5 min —, immer mit den neuesten Daten und wieder mit Lesen +
   ordnungAbgleichen. rueckmeldung(fehler, 'wartet') → der Launcher zeigt
   gelb „Nur auf diesem Gerät gespeichert …“; nach dem Nachholen
   rueckmeldung(null). Andere Fehler (permission-denied …): rot, kein
   Nachholen. Das Nachholen lebt nur, solange die Seite offen ist; danach
   holt das nächste Speichern den lokalen Stand nach.
   orderStandAngewendet und orderStandBasis syncen NICHT.

   Datenmodell — Collection `bos_profil_einstellungen`, Dokument-ID
   = profilId (identisch mit dem state.profileData[profilId]-Schlüssel
   in launcher.html):
     {
       theme, density, kachelgroesse, accent, background, symbolpaket, iconStil,
       order, overrides, customApps, installed, backstoreHinweisGesehen,
       farbschema, hamster, orderStand,
       aktualisiertAm: Firestore-Timestamp
     }
   farbschema (NEU 16.10.2026, #72 Stufe C): das selbst gewählte Farbprofil
   (ID aus bos_farbprofile.js). FEHLT das Feld, gilt die Vorgabe aus Konto
   bzw. Rolle. „Vorgabe“ in den Einstellungen löscht es lokal; weil .set()
   ohne merge schreibt, ist es danach auch hier weg. launcher.html löscht
   es beim Laden lokal, wenn es hier fehlt (uebernimmEinstellungen) —
   Object.assign allein würde den alten Wert stehen lassen.
   kachelgroesse (NEU 06.09.2026, siehe SESSION_2026-09-06_LAUNCHER_KACHELGROESSE_KONZEPT.md):
   Grundgröße der Launcher-Symbole ('standard'|'gross'|'riesig'). Die
   Einzel-Override-Größe pro Kachel (span:{cols,rows}) braucht KEIN eigenes
   Feld hier — die liegt bereits innerhalb von overrides bzw. customApps und
   wird darüber automatisch mitsynchronisiert.
   Bewusst "overrides" NICHT umbenannt, trotz Namensgleichheit mit dem
   Rollen-Overrides-Feld in bos_accounts (dort: Rechte-Ausnahmen pro
   Satellit; hier: Name/Icon/Farbe-Anpassung pro Kachel — inhaltlich
   nichts miteinander zu tun). Das lokale Feld in state.profileData
   heißt bereits "overrides", ein anderer Name nur hier hätte mehr
   verwirrt als geholfen. Getrennte Collections, getrennte Dokumente —
   nur der Feldname ist zufällig gleich, siehe Konzept-Doku §4.

   Sicherheitsniveau: gleiche offene Security Rule wie der Rest des
   Systems (siehe bos_firebase_config.js — aktuell keine differenzierte
   Zugriffskontrolle je Collection). Kein adminReauth nötig, reine
   Geschmackseinstellungen, geringer Schaden im Missbrauchsfall.

   Schreiben ist bewusst "fire and forget" mit kurzer Verzögerung
   (debounced), nicht bei jedem einzelnen saveState()-Aufruf sofort:
   launcher.html ruft saveState() sehr häufig auf (Drag&Drop, jede
   Kleinigkeit) — ein Firestore-Schreibvorgang pro Aufruf wäre unnötig
   teuer, mehrere schnelle Änderungen sollen sich zu einem Schreib-
   vorgang bündeln. Kein Retry bei Schreibfehlern (kein Vorbau für
   einen beim aktuellen Nutzungsmuster — ein Gerät zur Zeit — seltenen
   Fall): der nächste erfolgreiche saveState()-Aufruf synchronisiert
   den dann aktuellen Stand automatisch nach.

   RÜCKMELDUNG (NEU 16.10.2026): speichere() nimmt als viertes Argument
   eine Funktion rueckmeldung(fehler). Sie bekommt nach dem Schreiben null
   (gelungen) oder den Fehler. launcher.html zeigt fehler.message damit
   sichtbar im Einstellungs-Fenster (Projektregel Fehlermeldungen); die
   console.warn bleibt zusätzlich.

   hamster (NEU 17.10.2026, Crumble #62 Stufe 1): true/false, Ein/Aus der
   Hamster-Figur (Ruf-Knopf in der Kopfleiste UND Figur im Bildschirmschoner,
   ein Schalter für beides). FEHLT das Feld, gilt AN. Die Einstellungs-Zeile
   in launcher.html schreibt immer ausdrücklich true oder false — so braucht
   uebernimmEinstellungen() keine Löschlogik wie bei farbschema.
   Achtung beim Ausrollen (gleiche Lehre wie farbschema am 16.10.): Ein Gerät
   mit der ALTEN Datei kennt hamster nicht und löscht es beim nächsten
   Speichern (.set() ohne merge) — nach dem Einspielen JEDES GERÄT EINMAL
   NEU LADEN. Firestore-Regel (RK §9) schränkt keine Felder ein, geprüft
   17.10.2026 (Bauplan Crumble §4) — keine Regeländerung nötig.

   CHANGELOG
     2026-10-30 · 03:57 · Nacharbeit N1 (KC allgemein 30.10., 03:4x): ohne Netz
       (unavailable/zeitlimit/deadline-exceeded) wird nachgeholt — 'online' + Zeitstaffel,
       neueste Daten, wieder Lesen + Abgleich; rueckmeldung(fehler, 'wartet'). Zeitlimit
       15 s für Lesen und Schreiben. Lesefehler-Text „nichts abgeglichen“ statt „nichts
       gespeichert“ (lokal ist es gespeichert).
     2026-10-29 · 19:11 · Feature (Launcher: Reihenfolge geräteübergreifend,
       KC allgemein 17:43, Go 17:53 mit A1): Feld orderStand in SYNCBARE_FELDER;
       speichere() liest vor dem Schreiben (Schutz vor Zurückdrehen, siehe oben),
       fünftes Argument lokalNachtragen(profilId, felder); auch ein sofort
       geworfener Fehler beim Lesen geht sichtbar an rueckmeldung. Kopfkommentar zur
       Reihenfolge berichtigt. Ein Gerät mit der ALTEN Datei lässt orderStand
       beim Speichern weg (kein Neuordnen anderswo, harmlos) und schreibt seine
       order ohne Schutz — nach dem Einspielen jedes Gerät einmal neu laden.
     2026-10-17 · 06:49 · Feature (Crumble Stufe 1, K11): Feld hamster in
       SYNCBARE_FELDER. Nach dem Einspielen jedes Gerät einmal neu laden.
     2026-10-16 · 07:54 · Feature (Einstellungen für alle, #72 Stufe C;
       Freigabe Kontroll-Chat 07:26): Feld farbschema in SYNCBARE_FELDER,
       Rückmeldung an den Aufrufer. Achtung beim Ausrollen: Ein Gerät mit
       der ALTEN Datei kennt farbschema nicht und löscht es beim nächsten
       Speichern (.set() ohne merge) — nach dem Einspielen jedes Gerät
       einmal neu laden. SESSION_2026-10-16_EINSTELLUNGEN_FUER_ALLE_BAU.md
   ================================================================ */

window.BOS_PROFIL_SYNC = (function () {

  var SYNCBARE_FELDER = [
    'theme', 'density', 'kachelgroesse', 'accent', 'background', 'symbolpaket', 'iconStil',
    'order', 'overrides', 'customApps', 'installed', 'backstoreHinweisGesehen',
    'farbschema',  // 16.10.2026, #72 Stufe C: eigene Wahl; fehlt = Vorgabe
    'hamster',     // 17.10.2026, Crumble #62: true/false; fehlt = an
    'orderStand'   // 29.10.2026: Takt der Reihenfolge; jedes Verschieben setzt einen neuen
  ];
  var SAMMLUNG = 'bos_profil_einstellungen';
  var VERZOEGERUNG_MS = 1000;
  var timer = {}; // { [profilId]: setTimeout-Handle } — pro Profil eigener Debounce
  var kette = {}; // { [profilId]: Promise } — Schreibvorgänge eines Profils nacheinander (Lesen + Schreiben)
  /* 30.10.2026 (Nacharbeit N1, offline): Ein Schreibvorgang, der an fehlendem Netz scheitert
     (unavailable, zeitlimit, deadline-exceeded), wird gemerkt und nachgeholt — beim Ereignis
     'online' und in einer Zeitstaffel —, jeweils mit den NEUESTEN Daten (letzte[]) und wieder mit
     Lesen + ordnungAbgleichen. Vorher hielt das SDK ein set() ohne Netz selbst in seiner
     Warteschlange; seit dem Lesen vor dem Schreiben (A1) scheitert schon das get(). */
  var letzte = {};      // { [profilId]: { db, daten, rueckmeldung, lokalNachtragen } } — Argumente des jüngsten speichere()
  var offen = {};       // { [profilId]: true } — wartet aufs Nachholen
  var staffel = {};     // { [profilId]: { uhr, stufe } }
  var STAFFEL_MS = [15000, 30000, 60000, 120000, 300000];   // danach alle 5 min
  var ZEITLIMIT_MS = 15000;   // Lesen und Schreiben je höchstens so lange, dann code 'zeitlimit'
  var NETZ_CODES = ['unavailable', 'zeitlimit', 'deadline-exceeded'];

  function extrahiere(daten) {
    var ausschnitt = {};
    SYNCBARE_FELDER.forEach(function (feld) {
      if (daten && Object.prototype.hasOwnProperty.call(daten, feld)) {
        ausschnitt[feld] = daten[feld];
      }
    });
    return ausschnitt;
  }

  /**
   * Frischer Einstellungs-Stand bei Profil-Aktivierung (analog zu
   * bos_accounts.js → ladeKonto(), gleiches Rückgabemuster). null,
   * wenn für diese profilId noch nie synchronisiert wurde (neues
   * Profil auf diesem oder jedem anderen Gerät) — der Aufrufer behält
   * dann einfach den lokalen/Default-Stand.
   */
  async function lade(db, profilId) {
    var snap = await db.collection(SAMMLUNG).doc(profilId).get();
    return snap.exists ? snap.data() : null;
  }

  /**
   * Debounced, fire-and-forget. Nimmt das komplette aktuelle
   * profileData-Objekt entgegen und extrahiert selbst den syncbaren
   * Ausschnitt (siehe SYNCBARE_FELDER oben) — der Aufrufer (launcher.html)
   * muss die Feldliste nicht kennen oder doppelt pflegen, "eine
   * Mechanik, ein Ort für die Feldliste".
   */
  function speichere(db, profilId, daten, rueckmeldung, lokalNachtragen) {
    if (!db || !profilId || !daten) return;
    letzte[profilId] = { db: db, daten: daten, rueckmeldung: rueckmeldung, lokalNachtragen: lokalNachtragen };
    if (timer[profilId]) clearTimeout(timer[profilId]);
    timer[profilId] = setTimeout(function () {
      delete timer[profilId];
      einreihen(profilId);
    }, VERZOEGERUNG_MS);
  }
  function einreihen(profilId) {
    kette[profilId] = (kette[profilId] || Promise.resolve()).then(function () {
      return schreibe(profilId);
    });
  }

  /* ---------- Nachholen (N1) ---------- */
  function istNetzFehler(f) { return !!f && NETZ_CODES.indexOf(f.code) !== -1; }
  function staffelStopp(profilId) {
    if (staffel[profilId]) clearTimeout(staffel[profilId].uhr);
    delete staffel[profilId];
  }
  function staffelWeiter(profilId) {
    var s = staffel[profilId] || { stufe: 0 };
    if (s.uhr) clearTimeout(s.uhr);
    var ms = STAFFEL_MS[Math.min(s.stufe, STAFFEL_MS.length - 1)];
    s.stufe++;
    s.uhr = setTimeout(function () { nachholen(profilId); }, ms);
    staffel[profilId] = s;
  }
  // Wartet ein Profil, wird es mit den neuesten Daten wieder eingereiht. Steht ohnehin ein
  // speichere() in der Verzögerung, übernimmt das (neuere Daten, gleiche Kette).
  function nachholen(profilId) {
    if (!offen[profilId] || !letzte[profilId] || timer[profilId]) return;
    einreihen(profilId);
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', function () {
      Object.keys(offen).forEach(function (id) { if (offen[id]) nachholen(id); });
    });
  }
  function mitZeitlimit(p, ms) {
    var uhr;
    return Promise.race([p, new Promise(function (_, nein) {
      uhr = setTimeout(function () { var e = new Error('keine Antwort nach ' + Math.round(ms / 1000) + ' s'); e.code = 'zeitlimit'; nein(e); }, ms);
    })]).then(function (w) { clearTimeout(uhr); return w; }, function (e) { clearTimeout(uhr); throw e; });
  }

  /* Schutz vor Zurückdrehen (A1, siehe Kopf). Ändert ausschnitt (order, orderStand),
     wenn ein anderes Gerät verschoben hat und dieses nicht. Rückgabe: was lokal
     nachzutragen ist. fern = Dokument aus Firestore oder null. */
  function ordnungAbgleichen(ausschnitt, daten, fern) {
    var nachtrag = {};
    var fernStand = fern && fern.orderStand ? String(fern.orderStand) : '';
    var meinStand = daten.orderStand ? String(daten.orderStand) : '';
    var basis = daten.orderStandBasis ? String(daten.orderStandBasis) : '';
    if (!fernStand || fernStand === meinStand) return nachtrag;   // nichts zu schützen
    if (meinStand !== basis) return nachtrag;                      // selbst verschoben → eigene Reihenfolge gilt
    if (Array.isArray(fern.order)) { ausschnitt.order = fern.order.slice(); nachtrag.order = fern.order.slice(); }
    ausschnitt.orderStand = fernStand;
    nachtrag.orderStand = fernStand;
    return nachtrag;
  }

  /* Ein Schreibvorgang mit den NEUESTEN Argumenten des Profils (letzte[]): lesen →
     ordnungAbgleichen → schreiben. rueckmeldung(fehler, art): art 'wartet' = Netz fehlt,
     wird nachgeholt (gelb); ohne art = echter Fehler (rot). */
  function schreibe(profilId) {
    var a = letzte[profilId];
    if (!a) return Promise.resolve();
    var db = a.db, daten = a.daten, rueckmeldung = a.rueckmeldung, lokalNachtragen = a.lokalNachtragen;
    var ref = null;
    var gelesen = false;
    // Promise.resolve().then: auch ein SOFORT geworfener Fehler (z. B. db ohne get) landet
    // unten in catch → sichtbar über rueckmeldung, nicht als stiller Seitenfehler.
    return Promise.resolve().then(function () {
      ref = db.collection(SAMMLUNG).doc(profilId);
      return mitZeitlimit(ref.get(), ZEITLIMIT_MS);
    }).then(function (snap) {
      gelesen = true;
      var ausschnitt = extrahiere(daten);
      var nachtrag = ordnungAbgleichen(ausschnitt, daten, snap && snap.exists ? snap.data() : null);
      ausschnitt.aktualisiertAm = firebase.firestore.FieldValue.serverTimestamp();
      /* Zeitlimit auch hier: geht das Netz zwischen Lesen und Schreiben weg, hält das SDK das
         set() in seiner Warteschlange — die Kette soll daran nicht hängen. Ein später doch noch
         bestätigtes set() wird bewusst nicht mehr ausgewertet; das Nachholen liest und schreibt
         ohnehin mit den neuesten Daten. */
      return mitZeitlimit(ref.set(ausschnitt), ZEITLIMIT_MS).then(function () {
        offen[profilId] = false;
        staffelStopp(profilId);
        nachtrag.orderStandBasis = ausschnitt.orderStand;   // undefined = Feld lokal entfernen
        if (typeof lokalNachtragen === 'function') lokalNachtragen(profilId, nachtrag);
        if (typeof rueckmeldung === 'function') rueckmeldung(null);
      });
    }).catch(function (fehler) {
      if (istNetzFehler(fehler)) {
        offen[profilId] = true;
        staffelWeiter(profilId);
        console.warn('BOS_PROFIL_SYNC: kein Netz — Einstellungen nur auf diesem Gerät, werden nachgeholt', fehler);
        if (typeof rueckmeldung === 'function') rueckmeldung(fehler, 'wartet');
        return;
      }
      offen[profilId] = false;
      staffelStopp(profilId);
      var f = fehler;
      if (!gelesen) {
        // Lesefehler: NICHT geschrieben — lieber nichts als eine fremde Reihenfolge zurückdrehen.
        f = new Error('Stand in Firestore nicht lesbar, nichts abgeglichen: ' + ((fehler && fehler.message) || String(fehler)));
        f.code = fehler && fehler.code;
      }
      console.warn('BOS_PROFIL_SYNC: Einstellungen konnten nicht synchronisiert werden, bleiben lokal', f);
      if (typeof rueckmeldung === 'function') rueckmeldung(f);
    });
  }

  return {
    lade: lade,
    speichere: speichere,
    ordnungAbgleichen: ordnungAbgleichen   // 29.10.2026: offen für die Prüfung (reine Funktion)
  };
})();
