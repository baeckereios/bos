/* ================================================================
   BäckereiOS · Satellite — Firebase-Grundkonfiguration
   ================================================================
   Initialisiert Firebase und stellt global bereit:
     window.db             — Firestore-Instanz
     window.BOS_AUTH_READY — Promise, das jede Seite awaiten kann,
                             bevor sie auf Firestore zugreift

   Einbindung im <head>, in GENAU dieser Reihenfolge (siehe launcher.html
   als Referenz-Einbindung), danach erst der seiteneigene Code:

     <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
     <script src="bos_firebase_config.js"></script>

   Diese Datei gehört in den Repo-Root, analog zu shell.js — ein
   Schreiber (du), viele Leser (Launcher + jeder Satellit).

   WICHTIG — kein Geheimnis: Diese Werte liegen zwangsläufig offen im
   Client-JS, jede Firebase-Web-App funktioniert so. Absicherung läuft
   über die Firestore Security Rules, nicht über Geheimhaltung dieser
   Werte.

   ----------------------------------------------------------------
   UMSTELLUNG 17.09.2026 — Etappe 2, Schritt 1
   ----------------------------------------------------------------
   VORHER: signInAnonymously() beim ersten Laden. Jeder Besucher war
   angemeldet, die Rules konnten deshalb nicht zwischen einem Kollegen
   und einem Fremden unterscheiden.

   JETZT: diese Datei meldet NIEMANDEN mehr an. Sie wartet nur darauf,
   dass eine Sitzung da ist. Angemeldet wird ausschließlich auf
   index.html — Firebase merkt sich die Anmeldung pro Adresse, nicht
   pro Seite, also gilt sie danach für den Launcher und jeden
   Satelliten.

   Fehlt eine Sitzung, leitet diese Datei zur Tür weiter und hängt den
   eigenen Pfad als ?weiter= an, damit man nach der Anmeldung dort
   landet, wo man hinwollte (NFC/QR-Direktaufruf einer Stationsseite).

   RÜCKWEG: BOS_AUTH_MODUS unten auf 'anonym' setzen — dann verhält
   sich die Datei exakt wie vor dem 17.09. Solange Anonymous Auth in
   der Firebase-Konsole aktiviert bleibt, ist das ein Ein-Zeilen-
   Rückweg ohne weitere Folgen. Erst Etappe 5 schaltet den Anbieter ab.

   ÜBERGANGSVERHALTEN, bewusst so: Geräte mit einer bestehenden
   anonymen Sitzung laufen ohne Anmeldung weiter, bis diese Sitzung
   endet. Das ist kein Versehen, sondern das Sicherheitsnetz für die
   Umstellung — zum Testen der Tür muss man sich aktiv abmelden
   (in der Browser-Konsole: firebase.auth().signOut()).

   CHANGELOG
     2026-09-19 · 06:5x · v0.3 · Fix
       Zwei Fehler im Weg zurück zur Tür, beide nur beim Direktaufruf
       eines Satelliten auf einem abgemeldeten Gerät sichtbar:
       document.currentScript wurde zu spät gelesen (Wurzel unbekannt),
       und der ?weiter=-Pfad verlor den Ordnernamen. Beides ergab 404
       nach erfolgreicher Anmeldung.
     2026-09-17 · 09:4x · v0.2 · Umbau
       signInAnonymously() entfernt, Weiterleitung zu index.html
       ergänzt, Anmeldefehler werden sichtbar angezeigt statt nur
       console.error (Ulfs Regel — ein stummer Fehlschlag sperrt
       jemanden aus, ohne dass er weiß warum).
     (davor) v0.1 — Anonymous Auth
   ================================================================ */

var BOS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBQHOj5D4M6lq8qCHAU5Z-Ele41mQARyEg",
  authDomain: "baeckereios-46488.firebaseapp.com",
  projectId: "baeckereios-46488",
  storageBucket: "baeckereios-46488.firebasestorage.app",
  messagingSenderId: "442205816908",
  appId: "1:442205816908:web:8f2101a6b2e0703aab8ce9"
};

/* 'konto'  — echte Konten, Anmeldung über index.html (Stand ab 17.09.)
   'anonym' — alter Zustand, meldet jedes Gerät anonym an (Rückweg) */
var BOS_AUTH_MODUS = 'konto';

firebase.initializeApp(BOS_FIREBASE_CONFIG);
window.db = firebase.firestore();

window.BOS_AUTH_READY = (function () {

  /* Wo liegt index.html? Diese Datei liegt im Repo-Root, also ergibt
     sich der Weg dorthin aus ihrer eigenen Adresse — unabhängig davon,
     ob der Aufrufer im Root liegt (launcher.html) oder in einem
     Unterordner (froster/froster_inventur.html). Kein hartkodiertes
     '../', das bei einer neuen Ordnerebene stillschweigend bricht.

     WICHTIG — Fund 19.09.2026: document.currentScript ist NUR gültig,
     solange dieses Skript gerade läuft. tuerAdresse() wird aber erst
     später aus dem Anmelde-Rückruf heraus aufgerufen; dort ist es null,
     und der Rückfall "gleicher Ordner" schickte einen Satelliten im
     Unterordner auf produktionsplaner/index.html → 404. Deshalb wird
     die eigene Adresse HIER, synchron beim Laden, festgehalten. */
  var WURZEL = (function () {
    var eigene = (document.currentScript && document.currentScript.src) || '';
    return eigene ? eigene.replace(/[^/]*$/, '') : '';
  })();

  function tuerAdresse() {
    return (WURZEL || '') + 'index.html';
  }

  /* Der eigene Pfad, wie ihn index.html später wieder aufrufen kann —
     also RELATIV ZUR WURZEL, nicht nur der Dateiname.

     Fund 19.09.2026: vorher stand hier
       window.location.pathname.replace(/^.*\//, '')
     Das schneidet alles bis zum letzten Schrägstrich weg und damit den
     Ordner. Aus produktionsplaner/station_rondo.html wurde
     station_rondo.html, und weil index.html im Wurzelverzeichnis liegt,
     landete man nach der Anmeldung auf einer Datei, die es dort nicht
     gibt. Betraf jeden Satelliten, weil alle in Unterordnern liegen —
     sichtbar aber nur beim Weg über die Tür, also genau beim NFC- oder
     QR-Aufruf auf einem noch nicht angemeldeten Gerät. */
  function hierRelativZurWurzel() {
    var hier = window.location.href.split('#')[0];
    if (WURZEL && hier.indexOf(WURZEL) === 0) return hier.slice(WURZEL.length);
    return window.location.pathname.replace(/^.*\//, '') + window.location.search;
  }

  function zeigeFehler(text, fehler) {
    console.error('[BOS Firebase]', text, fehler || '');
    try {
      var box = document.createElement('div');
      box.setAttribute('role', 'alert');
      box.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:24px', 'background:#16120e', 'color:#f3ece1',
        'font-family:Barlow,-apple-system,sans-serif', 'font-size:15px',
        'line-height:1.6', 'text-align:center'
      ].join(';');
      var innen = document.createElement('div');
      innen.style.cssText = 'max-width:420px';
      var titel = document.createElement('p');
      titel.style.cssText = 'margin:0 0 10px;font-weight:600';
      titel.textContent = text;
      var detail = document.createElement('p');
      detail.style.cssText = 'margin:0;font-size:12px;color:#736656;word-break:break-word';
      detail.textContent = (fehler && (fehler.code ? fehler.code + ' — ' : '') +
                           (fehler.message || String(fehler))) || '';
      innen.appendChild(titel);
      innen.appendChild(detail);
      box.appendChild(innen);
      (document.body || document.documentElement).appendChild(box);
    } catch (e) {
      /* Wenn nicht einmal das geht, bleibt console.error oben. */
    }
  }

  function zurTuer() {
    /* Läuft diese Seite als Satellitenfenster im Launcher, würde eine
       Weiterleitung nur das kleine Fenster umlenken — Anmeldung im
       Fenster im Fenster. Stattdessen das äußere Fenster schicken.
       Gleiche Iframe-Weiche wie in bos_zoom_sync.js und den
       Stationsseiten (window.self !== window.top). */
    var fenster = (window.self !== window.top) ? window.top : window;
    var ziel = tuerAdresse() + '?weiter=' + encodeURIComponent(hierRelativZurWurzel());
    try {
      fenster.location.replace(ziel);
    } catch (e) {
      /* Fremde Herkunft im äußeren Fenster (sollte hier nie vorkommen,
         alles liegt auf derselben Adresse) — dann wenigstens selbst. */
      window.location.replace(ziel);
    }
  }

  return new Promise(function (resolve, reject) {

    if (BOS_AUTH_MODUS === 'anonym') {
      firebase.auth().onAuthStateChanged(function (nutzer) {
        if (nutzer) resolve(nutzer);
      });
      firebase.auth().signInAnonymously().catch(function (err) {
        zeigeFehler('Anmeldung fehlgeschlagen. Ohne Anmeldung sind keine Daten abrufbar.', err);
        reject(err);
      });
      return;
    }

    /* onAuthStateChanged meldet sich beim ersten Aufruf IMMER — mit
       dem wiederhergestellten Nutzer oder mit null. Deshalb reicht
       dieser eine Weg; kein Timeout nötig. */
    var erledigt = false;
    firebase.auth().onAuthStateChanged(function (nutzer) {
      if (erledigt) return;
      erledigt = true;

      if (nutzer) { resolve(nutzer); return; }

      if (window.BOS_LOGIN_SEITE) {
        /* index.html selbst: nicht weiterleiten, sonst Endlosschleife.
           Die Seite kümmert sich um die Anmeldung. */
        return;
      }

      zurTuer();
    }, function (err) {
      if (erledigt) return;
      erledigt = true;
      zeigeFehler('Die Anmeldung konnte nicht geprüft werden.', err);
      reject(err);
    });
  });
})();
