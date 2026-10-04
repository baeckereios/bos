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
   anderen Gerät könnten dort nicht passen. order (Reihenfolge) synct
   dagegen bewusst: renderGrid() platziert Kacheln ohne eigene position
   ohnehin automatisch per nextFreeCellInOrder() in der order-Reihen-
   folge neu ins jeweils passende Raster — genau das gewünschte
   Verhalten auf einem neuen Gerät, ohne dass diese Datei davon
   überhaupt wissen muss.

   Datenmodell — Collection `bos_profil_einstellungen`, Dokument-ID
   = profilId (identisch mit dem state.profileData[profilId]-Schlüssel
   in launcher.html):
     {
       theme, density, kachelgroesse, accent, background, symbolpaket, iconStil,
       order, overrides, customApps, installed, backstoreHinweisGesehen,
       aktualisiertAm: Firestore-Timestamp
     }
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
   ================================================================ */

window.BOS_PROFIL_SYNC = (function () {

  var SYNCBARE_FELDER = [
    'theme', 'density', 'kachelgroesse', 'accent', 'background', 'symbolpaket', 'iconStil',
    'order', 'overrides', 'customApps', 'installed', 'backstoreHinweisGesehen'
  ];
  var VERZOEGERUNG_MS = 1000;
  var timer = {}; // { [profilId]: setTimeout-Handle } — pro Profil eigener Debounce

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
    var snap = await db.collection('bos_profil_einstellungen').doc(profilId).get();
    return snap.exists ? snap.data() : null;
  }

  /**
   * Debounced, fire-and-forget. Nimmt das komplette aktuelle
   * profileData-Objekt entgegen und extrahiert selbst den syncbaren
   * Ausschnitt (siehe SYNCBARE_FELDER oben) — der Aufrufer (launcher.html)
   * muss die Feldliste nicht kennen oder doppelt pflegen, "eine
   * Mechanik, ein Ort für die Feldliste".
   */
  function speichere(db, profilId, daten) {
    if (!db || !profilId || !daten) return;
    if (timer[profilId]) clearTimeout(timer[profilId]);
    timer[profilId] = setTimeout(function () {
      delete timer[profilId];
      var ausschnitt = extrahiere(daten);
      ausschnitt.aktualisiertAm = firebase.firestore.FieldValue.serverTimestamp();
      db.collection('bos_profil_einstellungen').doc(profilId).set(ausschnitt)
        .catch(function (fehler) {
          console.warn('BOS_PROFIL_SYNC: Einstellungen konnten nicht synchronisiert werden, bleiben lokal', fehler);
        });
    }, VERZOEGERUNG_MS);
  }

  return {
    lade: lade,
    speichere: speichere
  };
})();
