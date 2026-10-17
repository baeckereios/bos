/* ==========================================================================
   MODUL: bos_ungespeichert.js
   ZWECK: Ein Weg für „hier ist etwas nicht gespeichert“ (Baustelle #77).
          Satelliten melden ihren Zustand, der Launcher fragt ihn vor dem
          Schließen eines Fensters ab und zeigt bei Bedarf die Rückfrage.
          Eine Mechanik, viele Aufrufer: später auch BOS-Knopf und
          Zurück-Taste im Handy-Modus (#78).

   WARUM: Das ✕ im Launcher entfernt das Fenster samt <iframe>. Dabei
          kommt kein beforeunload, die Schutz-Rückfrage der Seiten griff im
          Launcher also nie (Befund Mobile Ansicht §5, 16.10.2026).

   SATELLIT
     <script src="../bos_ungespeichert.js"></script>
     BOS_UNGESPEICHERT.melde(fn [, { laeuft: fn2 }])
       fn()     → true = ungespeichert. Wird erst BEIM FRAGEN aufgerufen
                  (keine vorher gesetzte Flagge) und muss sofort antworten;
                  ein Promise zählt als „ungespeichert“ (immer wahr).
       laeuft() → optional, nur eine SCHON VORHANDENE Funktion „Speichern
                  läuft gerade“. Ändert nur den Text der Rückfrage.
       Beim ersten melde() setzt diese Datei EINEN beforeunload-Zuhörer:
       die Einzelseite (QR/NFC) bleibt beim Neuladen/Verlassen geschützt.
       Wirft fn beim Verlassen, kommt KEINE Browser-Rückfrage (console.error)
       — das ist das Verhalten des früheren Zuhörers in den Seiten.
     BOS_UNGESPEICHERT.stand() → { ungespeichert, laeuft, fehler }
       fehler = Text (err.message) oder null. Fehler fängt stand() selbst.

   LAUNCHER
     BOS_UNGESPEICHERT.vorDemSchliessen(iframe, appName) → Promise<boolean>
       true = schließen. LEHNT NIE AB (Zusicherung). Der Launcher sichert
       sich trotzdem selbst ab (Auflage A2 des Kontroll-Chats: zwei
       Schlösser) — siehe closeWindow() in launcher.html.
       - kein iframe / Seite ohne melde() / fremde Adresse (SecurityError)
         → true, ohne Frage, ohne Meldung (wie vor #77)
       - nichts ungespeichert → true, ohne Frage
       - ungespeichert / Speichern läuft / Prüfung warf → Rückfrage
       - gleiches iframe, Frage schon offen → dasselbe Promise (eine Frage)
       - Fragen zu verschiedenen Fenstern → nacheinander (Warteschlange)
       Vorrang des Texts: Prüfung warf > Speichern läuft > ungespeichert.

   DIALOG: eigener kleiner Dialog im BOS-Stil (Design-Tokens, .bos-btn).
     z-index 1800: über Fenstern (400), Taskleiste, Modal (900); unter
     Bildschirmschoner (1850), Startanzeige (1940), Bootscreen (1950).
     „Weiterarbeiten“ hat den Fokus; Enter, Esc und Tipp auf den
     Hintergrund = Weiterarbeiten. Ein Knopf zählt nur, wenn der Druck im
     Dialog begann (Geisterklick-Schutz, z. B. Antippen zum Wecken des
     Bildschirmschoners). Lässt sich der Dialog nicht aufbauen,
     fragt window.confirm (OK = schließen). Scheitert auch das: Fenster
     bleibt offen (console.error) — Daten gehen nie still verloren.

   ABHÄNGIGKEITEN: keine. Nutzt die Klassen aus bos_design_tokens.css,
     wenn die Seite sie lädt (der Launcher tut das).

   CHANGELOG
     2026-10-17 · 02:36 · v1.0 · Neu (#77, Bauplan freigegeben vom
       Kontroll-Chat 17.10., 02:03; Auflagen A1–A3).
       Siehe SESSION_2026-10-17_UNGESPEICHERT_SCHUTZ_BAU.md.
   ========================================================================== */
(function () {
  'use strict';
  if (window.BOS_UNGESPEICHERT) return;   // doppelt eingebunden: die erste Fassung gilt

  /* Texte — später weitere Sprachen ergänzen (#87), Code bleibt gleich. */
  var TEXTE = { de: {
    titel: 'Nicht gespeichert',
    titelLaeuft: 'Speichern läuft',
    titelFehler: 'Prüfung nicht möglich',
    ungespeichert: 'In {app} ist etwas nicht gespeichert. Trotzdem schließen?',
    laeuft: 'In {app} wird gerade gespeichert. Wer jetzt schließt, weiß nicht, ob alles angekommen ist. Trotzdem schließen?',
    fehler: 'Konnte nicht prüfen, ob in {app} etwas ungespeichert ist: {grund}. Trotzdem schließen?',
    schliessen: 'Schließen',
    weiter: 'Weiterarbeiten',
    ohneDialog: '(Eigener Dialog nicht verfügbar: {grund})',
    appUnbekannt: 'diesem Fenster'
  } };
  var SPRACHE = 'de';
  function tx(schluessel, werte) {
    var s = (TEXTE[SPRACHE] && TEXTE[SPRACHE][schluessel]) || TEXTE.de[schluessel] || schluessel;
    if (werte) Object.keys(werte).forEach(function (k) { s = s.split('{' + k + '}').join(String(werte[k])); });
    return s;
  }
  function grundVon(err) {
    if (err == null) return 'unbekannter Fehler';
    if (typeof err === 'string') return err;
    return (err.message || err.code || String(err));
  }

  /* ---------------- Satellit ---------------- */
  var meldungen = [];          // { fn, laeuft }
  var zuhoererGesetzt = false;

  function melde(fn, opt) {
    if (typeof fn !== 'function') throw new TypeError('BOS_UNGESPEICHERT.melde: erwartet eine Funktion');
    meldungen.push({ fn: fn, laeuft: (opt && typeof opt.laeuft === 'function') ? opt.laeuft : null });
    if (!zuhoererGesetzt) {
      window.addEventListener('beforeunload', beimVerlassen);
      zuhoererGesetzt = true;
    }
  }

  /* Neuladen / Verlassen der Seite: nur die Bedingung zählt, wie früher. */
  function beimVerlassen(e) {
    var ja = false;
    meldungen.forEach(function (m) {
      try { if (m.fn()) ja = true; }
      catch (err) { console.error('[BOS_UNGESPEICHERT] Prüfung beim Verlassen fehlgeschlagen:', err); }
    });
    if (ja) { e.preventDefault(); e.returnValue = ''; }
  }

  function stand() {
    var erg = { ungespeichert: false, laeuft: false, fehler: null };
    meldungen.forEach(function (m) {
      try { if (m.fn()) erg.ungespeichert = true; }
      catch (err) { console.error('[BOS_UNGESPEICHERT] Prüfung fehlgeschlagen:', err); if (erg.fehler === null) erg.fehler = grundVon(err); }
      if (m.laeuft) {
        try { if (m.laeuft()) erg.laeuft = true; }
        catch (err) { console.error('[BOS_UNGESPEICHERT] Prüfung „Speichern läuft“ fehlgeschlagen:', err); if (erg.fehler === null) erg.fehler = grundVon(err); }
      }
    });
    return erg;
  }

  /* ---------------- Launcher ---------------- */
  var offeneFragen = new WeakMap();   // iframe → Promise (eine Frage je Fenster)
  var kette = Promise.resolve();      // Warteschlange: eine Rückfrage nach der anderen
  function nichts() {}

  /* Wird auch bei Ablehnung frei (Auflage A1): sonst hinge jede weitere
     Frage hinter einer toten. */
  function einreihen(aufgabe) {
    var p = kette.then(aufgabe);
    kette = p.then(nichts, nichts);
    return p;
  }

  function istSicherheitsfehler(err) {
    return !!err && (err.name === 'SecurityError' || err.code === 18);
  }

  /* Was sagt die Seite im Fenster? null = schließen ohne Frage. */
  function befragen(iframe, app) {
    var api, s;
    try {
      var w = iframe.contentWindow;
      api = w ? w.BOS_UNGESPEICHERT : null;
      if (!api || typeof api.stand !== 'function') return null;   // alte Seite, lädt noch, keine Kachel-Seite
      s = api.stand();
    } catch (err) {
      if (istSicherheitsfehler(err)) return null;                  // fremde Adresse: wie vor #77
      console.error('[BOS_UNGESPEICHERT] Seite im Fenster nicht abfragbar:', err);
      return { titel: tx('titelFehler'), text: tx('fehler', { app: app, grund: grundVon(err) }) };
    }
    if (!s) return null;
    if (s.fehler) {
      console.error('[BOS_UNGESPEICHERT] ' + app + ': ' + s.fehler);
      return { titel: tx('titelFehler'), text: tx('fehler', { app: app, grund: s.fehler }) };
    }
    if (s.laeuft) return { titel: tx('titelLaeuft'), text: tx('laeuft', { app: app }) };
    if (s.ungespeichert) return { titel: tx('titel'), text: tx('ungespeichert', { app: app }) };
    return null;
  }

  function rueckfallConfirm(text, err) {
    try {
      return !!window.confirm(text + (err ? '\n\n' + tx('ohneDialog', { grund: grundVon(err) }) : ''));
    } catch (err2) {
      console.error('[BOS_UNGESPEICHERT] Auch window.confirm nicht möglich — Fenster bleibt offen:', err2);
      return false;
    }
  }

  function vorDemSchliessen(iframe, appName) {
    try {
      if (!iframe) return Promise.resolve(true);
      if (offeneFragen.has(iframe)) return offeneFragen.get(iframe);
      var app = (appName && String(appName).trim()) ? '„' + String(appName).trim() + '“' : tx('appUnbekannt');
      var befund = befragen(iframe, app);
      if (!befund) return Promise.resolve(true);
      var p = einreihen(function () { return zeigeRueckfrage(befund.titel, befund.text); })
        .then(function (ja) { return !!ja; }, function (err) {
          console.error('[BOS_UNGESPEICHERT] Dialog nicht aufgebaut, Rückfall auf confirm:', err);
          return rueckfallConfirm(befund.text, err);
        });
      offeneFragen.set(iframe, p);
      var frei = function () { offeneFragen.delete(iframe); };
      p.then(frei, frei);
      return p;
    } catch (err) {
      console.error('[BOS_UNGESPEICHERT] vorDemSchliessen:', err);
      return Promise.resolve(rueckfallConfirm(tx('fehler', { app: tx('appUnbekannt'), grund: grundVon(err) }), null));
    }
  }

  /* ---------------- Dialog ---------------- */
  var STIL_ID = 'bosUngespeichertStil';
  function stilEinmal() {
    if (document.getElementById(STIL_ID)) return;
    var st = document.createElement('style');
    st.id = STIL_ID;
    st.textContent =
      '.bosu-hg{position:fixed;inset:0;z-index:1800;display:flex;align-items:center;justify-content:center;' +
      'padding:16px;background:rgba(10,7,4,.62);}' +
      '.bosu-karte{width:min(92vw,400px);background:var(--bos-surface-raised,#2a221b);color:var(--bos-text,#f3ece1);' +
      'border:1px solid var(--bos-border-strong,#5a4a3a);border-radius:var(--bos-radius-lg,14px);padding:1.3rem 1.4rem;' +
      'box-shadow:var(--bos-shadow-lg,0 10px 30px rgba(0,0,0,.5));display:flex;flex-direction:column;gap:.9rem;' +
      'font-family:var(--bos-font-body,Barlow,sans-serif);}' +
      '.bosu-karte h3{margin:0;font-size:1.12rem;}' +
      '.bosu-karte p{margin:0;line-height:1.45;color:var(--bos-text,#f3ece1);overflow-wrap:anywhere;}' +
      '.bosu-knoepfe{display:flex;gap:.6rem;justify-content:flex-end;flex-wrap:wrap;margin-top:.2rem;}' +
      '.bosu-knoepfe button{min-height:var(--bos-tap-min,44px);}' +
      '.bosu-zu{color:var(--bos-red,#d6584a);}';
    (document.head || document.documentElement).appendChild(st);
  }

  function zeigeRueckfrage(titel, text) {
    return new Promise(function (resolve, reject) {
      if (!document.body) { reject(new Error('document.body fehlt')); return; }
      stilEinmal();
      var hg = document.createElement('div');
      hg.className = 'bosu-hg';
      hg.setAttribute('data-bos-ungespeichert', 'rueckfrage');
      var karte = document.createElement('div');
      karte.className = 'bosu-karte';
      karte.setAttribute('role', 'alertdialog');
      karte.setAttribute('aria-modal', 'true');
      var h = document.createElement('h3');
      h.id = 'bosuTitel'; h.textContent = titel;
      var p = document.createElement('p');
      p.id = 'bosuText'; p.textContent = text;
      karte.setAttribute('aria-labelledby', 'bosuTitel');
      karte.setAttribute('aria-describedby', 'bosuText');
      var reihe = document.createElement('div');
      reihe.className = 'bosu-knoepfe';
      var zu = document.createElement('button');
      zu.type = 'button'; zu.className = 'bos-btn bosu-zu'; zu.setAttribute('data-aktion', 'schliessen');
      zu.textContent = tx('schliessen');
      var weiter = document.createElement('button');
      weiter.type = 'button'; weiter.className = 'bos-btn bos-btn--amber'; weiter.setAttribute('data-aktion', 'weiter');
      weiter.textContent = tx('weiter');
      reihe.appendChild(zu); reihe.appendChild(weiter);
      karte.appendChild(h); karte.appendChild(p); karte.appendChild(reihe);
      hg.appendChild(karte);

      var fertig = false;
      /* Geisterklick-Schutz (wie #71 im Launcher): Ein Knopf zählt nur, wenn
         auch der Druck dazu im Dialog begann. Sonst könnte das Antippen, das
         den Bildschirmschoner weckt, am Touchscreen als click auf dem Knopf
         landen, der danach unter dem Finger liegt — „Schließen“ ohne Absicht.
         Tastatur-Klicks (detail 0) gelten immer. */
      var druckImDialog = false;
      function merkeDruck(e) { druckImDialog = !!(e.target && hg.contains(e.target)); }
      function gilt(e) { return e.detail === 0 || druckImDialog; }
      function ende(ja) {
        if (fertig) return;
        fertig = true;
        document.removeEventListener('keydown', taste, true);
        document.removeEventListener('pointerdown', merkeDruck, true);
        if (hg.parentNode) hg.parentNode.removeChild(hg);
        resolve(ja);
      }
      function taste(e) {
        if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); ende(false); return; }
        if (e.key === 'Tab') {   // Fokus bleibt bei den zwei Knöpfen
          e.preventDefault();
          (document.activeElement === weiter ? zu : weiter).focus();
        }
      }
      zu.addEventListener('click', function (e) { if (gilt(e)) ende(true); });
      weiter.addEventListener('click', function (e) { if (gilt(e)) ende(false); });
      hg.addEventListener('click', function (e) { if (e.target === hg && gilt(e)) ende(false); });
      document.addEventListener('keydown', taste, true);
      document.addEventListener('pointerdown', merkeDruck, true);
      document.body.appendChild(hg);
      try { weiter.focus(); } catch (e) { /* Fokus ist nur Komfort */ }
    });
  }

  window.BOS_UNGESPEICHERT = {
    melde: melde,
    stand: stand,
    vorDemSchliessen: vorDemSchliessen
  };
})();
