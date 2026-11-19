/* ================================================================
   BäckereiOS · Admin-Sitzung — gemeinsamer Baustein (Leerlauf-Uhr und Sperren)
   ================================================================
   Einbindung:  <script src="../bos_accounts.js"></script>
                <script src="../bos_admin_sitzung.js"></script>
   Stellt bereit: window.BOS_ADMIN_SITZUNG  (in Node: module.exports)
   Benutzt von: konten/personalakte.html
   Doku:        BOS_ADMIN_SITZUNG_DOKU.md

   WOFÜR: eine Seite, die nur mit dem Admin-Passwort arbeitet, sperrt sich
   selbst — nach 5 Minuten ohne Eingabe (eine Minute vorher ein Hinweis), mit
   🔒 Sperren und beim Verlassen. Der Baustein führt die Uhr und meldet der
   Seite „entsperrt“, „Vorwarnung“ und „gesperrt“. Die Seite leert dann ALLES,
   was sie geladen hat, und zeigt ihr Sperrbild.

   WAS ER NICHT TUT: Er meldet nicht selbst an. Anmelden, Abmelden und „die
   Sitzung wird nie gespeichert“ (Persistence NONE) stehen in bos_accounts.js
   (adminReauth, adminReauthEnde, adminAngemeldet). Er kennt keine Seite, keine
   Sammlung, keine Wörter außer den zwei Sperrgründen unten.

   HERKUNFT: Verhalten und Zahlen wörtlich aus konten/konten_verwaltung.html
   (Leerlauf-Block „Automatische Sperre nach Untätigkeit“, 26.09.2026, N-15;
   Stand Paket 18.11.2026 03:07: Z. 2854–2907, Anmeldefehler Z. 3058–3065).
   Die Kontenverwaltung selbst ist NICHT umgestellt — sie nutzt weiter ihre
   eigene Fassung, bis sie ersetzt wird (Bauplan Personalakte §6, Go KC 18.11.).

   ZEITSTEMPEL STATT LANGEM TIMER: Browser drosseln Timer in Hintergrund-Tabs,
   ein Zeitstempel lügt nicht. Geprüft wird alle taktMs und sofort, wenn die
   Seite wieder sichtbar wird.

   SCHNITTSTELLE
     BOS_ADMIN_SITZUNG.erzeuge(opt) → sitzung
       opt.konten          BOS_ACCOUNTS (Pflicht: adminReauth, adminReauthEnde)
       opt.beiEntsperrt()                  nach erfolgreicher Anmeldung
       opt.beiGesperrt(grund, info)        grund = Text oder ''; info = { art: 'knopf'|'leerlauf'|'verlassen'|'rueckkehr', hatteAenderungen }
       opt.beiVorwarnung(restSekunden, vergangenMs)   restSekunden = null → Hinweis ausblenden
       opt.ungespeichert() → bool          optional; nur für den Text des Sperrgrunds
       opt.leerlaufMs / vorwarnungMs / taktMs         Vorgabe 5 min / 60 s / 5 s
       opt.jetzt(), opt.fenster, opt.dokument, opt.setzeTakt(fn, ms)   nur für Tests
     sitzung.anmelden(passwort) → Promise  (lehnt mit Klartext-Fehler ab: e.message ist anzeigbar)
     sitzung.sperren()                     🔒 — die Rückfrage „ungespeichert?“ stellt vorher die Seite
     sitzung.entsperrt() → bool
     sitzung.pruefe()                      Uhr jetzt prüfen (läuft sonst von selbst)
     sitzung.rest() → Millisekunden bis zur Sperre (0, wenn gesperrt)

   CHANGELOG
     2026-11-18 · 05:11 · v1 · Erstfassung (Personalakte Lieferung A, Vorarbeit)
   ================================================================ */
(function (global) {
  'use strict';

  var LEERLAUF_MS = 5 * 60 * 1000;
  var VORWARNUNG_MS = 60 * 1000;
  var TAKT_MS = 5000;
  var EINGABEN = ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart', 'scroll'];

  /* Anmeldefehler als Klartext — wie in der Kontenverwaltung. */
  function anmeldeFehlerText(fehler) {
    var code = (fehler && fehler.code) || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'Admin-Passwort stimmt nicht.';
    return (code ? code + ' — ' : '') + ((fehler && fehler.message) || String(fehler));
  }

  function erzeuge(opt) {
    var o = opt || {};
    var konten = o.konten || global.BOS_ACCOUNTS;
    if (!konten || typeof konten.adminReauth !== 'function' || typeof konten.adminReauthEnde !== 'function') {
      throw new Error('BOS_ADMIN_SITZUNG: bos_accounts.js fehlt oder ist zu alt (adminReauth/adminReauthEnde nicht gefunden).');
    }
    var leerlaufMs = o.leerlaufMs || LEERLAUF_MS;
    var vorwarnungMs = o.vorwarnungMs || VORWARNUNG_MS;
    var jetzt = o.jetzt || function () { return Date.now(); };
    var fenster = o.fenster || (typeof window !== 'undefined' ? window : null);
    var dokument = o.dokument || (typeof document !== 'undefined' ? document : null);
    var offen = false;
    var letzteEingabe = jetzt();

    function melde(name, a, b) {
      if (typeof o[name] !== 'function') return;
      try { o[name](a, b); } catch (e) { console.error('BOS_ADMIN_SITZUNG: ' + name + ' warf', e); }
    }
    function abmelden() {
      try {
        var p = konten.adminReauthEnde();
        if (p && typeof p.catch === 'function') p.catch(function (f) { console.error('BOS_ADMIN_SITZUNG: Abmelden fehlgeschlagen', f); });
      } catch (e) { console.error('BOS_ADMIN_SITZUNG: Abmelden fehlgeschlagen', e); }
    }
    function hatAenderungen() {
      try { return typeof o.ungespeichert === 'function' ? !!o.ungespeichert() : false; } catch (e) { return true; }
    }
    /* Reihenfolge: erst zu (offen = false), dann die Seite leeren lassen, dann abmelden —
       die Seite ist damit leer, auch wenn das Abmelden hängt. */
    function schliesse(grund, art) {
      var hatte = offen ? hatAenderungen() : false;
      offen = false;
      melde('beiVorwarnung', null, 0);
      melde('beiGesperrt', grund, { art: art, hatteAenderungen: hatte });
      abmelden();
    }
    function pruefe() {
      if (!offen) return;
      var vergangen = jetzt() - letzteEingabe;
      if (vergangen >= leerlaufMs) {
        var hatte = hatAenderungen();
        schliesse('Nach ' + Math.round(leerlaufMs / 60000) + ' Minuten ohne Eingabe automatisch gesperrt.' +
          (hatte ? ' Ungespeicherte Änderungen wurden verworfen.' : ''), 'leerlauf');
        return;
      }
      if (vergangen >= leerlaufMs - vorwarnungMs) melde('beiVorwarnung', Math.max(0, Math.ceil((leerlaufMs - vergangen) / 1000)), vergangen);
      else melde('beiVorwarnung', null, vergangen);
    }
    function beruehrt() {
      if (!offen) return;
      letzteEingabe = jetzt();
      melde('beiVorwarnung', null, 0);
    }

    if (fenster && fenster.addEventListener) {
      EINGABEN.forEach(function (typ) { fenster.addEventListener(typ, beruehrt, { passive: true, capture: true }); });
      /* Beim Verlassen abmelden und leeren. Mit Persistence NONE wäre die Sitzung ohnehin weg —
         das Leeren zählt für den Fall, dass die Seite im Zwischenspeicher des Browsers bleibt. */
      fenster.addEventListener('pagehide', function () { schliesse('', 'verlassen'); });
      /* Kommt die Seite aus dem Zwischenspeicher zurück (Zurück-Taste), stünden sonst alte Daten da. */
      fenster.addEventListener('pageshow', function (e) { if (e && e.persisted) schliesse('', 'rueckkehr'); });
    }
    if (dokument && dokument.addEventListener) {
      dokument.addEventListener('visibilitychange', function () { if (!dokument.hidden) pruefe(); });
    }
    (o.setzeTakt || function (fn, ms) { return setInterval(fn, ms); })(pruefe, o.taktMs || TAKT_MS);

    function anmelden(passwort) {
      if (!passwort) return Promise.reject(new Error('Bitte das Admin-Passwort eingeben.'));
      return Promise.resolve().then(function () { return konten.adminReauth(passwort); }).then(function () {
        letzteEingabe = jetzt();
        offen = true;
        melde('beiEntsperrt');
        return true;
      }, function (fehler) {
        console.error('BOS_ADMIN_SITZUNG: Admin-Anmeldung fehlgeschlagen', fehler);
        var e = new Error(anmeldeFehlerText(fehler));
        e.code = (fehler && fehler.code) || '';
        throw e;
      });
    }

    return {
      anmelden: anmelden,
      sperren: function () { schliesse('', 'knopf'); },
      entsperrt: function () { return offen; },
      pruefe: pruefe,
      rest: function () { return offen ? Math.max(0, leerlaufMs - (jetzt() - letzteEingabe)) : 0; }
    };
  }

  var api = { erzeuge: erzeuge, anmeldeFehlerText: anmeldeFehlerText, LEERLAUF_MS: LEERLAUF_MS, VORWARNUNG_MS: VORWARNUNG_MS, TAKT_MS: TAKT_MS, EINGABEN: EINGABEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BOS_ADMIN_SITZUNG = api;
})(typeof window !== 'undefined' ? window : globalThis);
