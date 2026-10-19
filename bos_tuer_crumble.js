/* ================================================================
   BäckereiOS · Loch-Crumble an der Tür (index.html) — #62 Stufe 1f
   ================================================================
   Crumble schaut aus einem Loch in der Karte „Neu hier? Schau, dafür bin ich
   da.“ (statt des Kreis-Symbols), sagt beim Öffnen einen Satz, gibt danach
   ein paar Tipps und reagiert auf die echten Meldungen der Tür — NEBEN der
   Meldung, nie statt ihr. Die Blase steht über der Karte.
   Ersetzt den stehenden Türsteher aus Stufe 1e (Ulf 14:12: „wirkt ein wenig
   verloren dort unten“). Anweisung Kontroll-Chat 14:50, Bauplan 15:04, Go 15:15.

   GRUNDSATZ (K60, unverändert aus 1e): Die Tür ist der einzige Weg ins
   System. Nichts hier darf die Anmeldung aufhalten oder stören:
     - index.html lädt diese Datei erst nach 'load' im Leerlauf, async, ohne
       await irgendwo; spricht sie nur über crumbleFall(schlüssel) an;
     - fehlt etwas (diese Datei, hamster_figur/loch/, loch.json, ein Bild)
       oder wirft etwas: Crumble bleibt weg, das alte Kreis-Symbol bleibt,
       EIN console.warn, sonst nichts (F1, keine sichtbare Meldung) — und
       die Klasse mit-crumble geht von <html>, damit der Platz über der
       Karte zurückgeht.
   Diese Datei braucht KEIN Figuren-Modul und kein Manifest (Bauplan §5):
   loch/loch.css, loch/loch.json, 11 Büsten — zusammen ≈ 120 KB.

   PLATZ: steht schon in index.html (html.mit-crumble, von der Kopfzeile
   gesetzt, bevor etwas zu sehen ist): Symbolkasten 84 × 84, 74 px über der
   Karte für die Blase. Das alte Kreis-Symbol steht darin, bis alle Büsten
   dekodiert sind — erst dann wird es ersetzt (kein leeres Loch, kein Springen).

   VERHALTEN (K63/K79): ~1 s nach dem Erscheinen ein Satz aus „oeffnen“
   (winken); wird gerade durchgewunken: daumen „Rein mit dir. Gute Schicht!“.
   Danach Tipps (zwinkern oder wangen), zufällig, ohne Wiederholung, alle
   20–30 s, höchstens 4; nach der Lesezeit des 4. Tipps 2,5 s lachen, dann
   neutral und still (F3). Ruhe = neutral, alle 3–6 s blinzeln (120 ms, nur
   aus neutral, nicht bei prefers-reduced-motion). 2 min ohne Satz und ohne
   Eingabe → schlafen; die nächste Reaktion oder Eingabe weckt.
   Eingabe ins Formular → Blase sofort weg, 20 s keine Tipps. Als Eingabe
   zählt nur, was ein MENSCH tut (B1, K74): input, Zeiger/Touch auf ein Feld,
   Fokus binnen 500 ms nach Tab — nicht der Autofokus beim Laden und nicht
   der Fokus, den die Tür nach einem Fehler selbst ins Passwort setzt.
   Tipp auf Crumble = Tipp auf die Karte → Tour (er sitzt im Link; kein
   eigener Klick-Weg). Tipp auf die Blase → nichts (pointer-events: none).

   REAKTIONEN (K64): fall(schlüssel) aus index.html — falsch (1. Mal) /
   falsch2 (ab dem 2. Mal je Besuch), format, netz → besorgt; zu_viele →
   gaehnen; freischalten → pfote; angemeldet, durchwinken → daumen;
   gesperrt → neutral, still. Texte, Büsten, Zeiten: hamster_figur/loch/
   loch.json. Kommt ein Fall, bevor er bereit ist, holt er ihn nach, wenn er
   binnen 4 s bereit ist.

   BLASE (K78, K82): höchstens Kartenbreite, nie ein Wort allein in der letzten Zeile, auf die längste Zeile
   zugeschnitten (min. bis hinter die Spitze); ist ein Text auf einer sehr schmalen
   Größe höher als der Platz, bekommt diese Blase eine Stufe kleinere Schrift,
   reicht auch das nicht, wächst der Platz einmalig (--tuer-blasenraum).

   CHANGELOG
     2026-10-19 · 01:18 · Nachtrag 1f (Kontroll-Chat 01:05): K83/K84 — stand '1f' (index.html erkennt eine fremde
       Tür-Datei), Ladeschritte an BOS_TUER_LADEN (Zeitlimit, Prüfzeile), steigt still aus, wenn index.html schon
       zurückgeschaltet hat oder html.mit-crumble fehlt; Prüfmodus: HTTP-Status fehlender Dateien in der Meldung.
     2026-10-18 · 21:20 · Nacharbeit 1f (Kontroll-Chat 20:54): K82 — kein einzelnes Wort allein in der letzten
       Blasenzeile (CSS text-wrap: pretty in loch.css; ohne Unterstützung schrittweise schmaler), Blase danach auf die
       längste Zeile zugeschnitten.
     2026-10-18 · 15:28 · Stufe 1f: neu geschrieben — Loch-Crumble in der Karte
       (K76–K81), ohne Figuren-Modul und Manifest. Eingabe-Stille, Tipps, Reaktionen
       und K74 wie 1e.
     2026-10-18 · 13:07 · Nacharbeit 1e (Kontroll-Chat 12:53): K74 — als Fokus von Menschenhand zählt nur Tab.
     2026-10-18 · 11:43 · Erstfassung (Stufe 1e, K60–K66): stehender Türsteher neben dem Formular.
   ================================================================ */
(function () {
  'use strict';
  if (window.BOS_TUER_CRUMBLE && window.BOS_TUER_CRUMBLE.stand) return;   // schon da, oder index.html hat abgeschaltet (Platzhalter mit Stand); der Platzhalter OHNE Stand vom Lader wird ersetzt

  var BASIS = 'hamster_figur/loch/';
  var RESERVE_LUFT = 16;   // Blase: 12 px über der Karte + 4 px Abstand nach oben

  var daten = null, symbol = null, karte = null, blase = null, altesSymbol = '';
  var bilder = {};
  var bereit = false, kaputt = false;
  var aktuell = 'neutral', schlaeft = false;
  var tipps = [], gezeigt = 0, tTipp = null, tErster = null, tZurueck = null, tBlinzel = null, tSchlaf = null, tLachen = null;
  var stilleBis = 0, letzteTaste = 0, letzteAktivitaet = Date.now();
  var falschZaehler = 0, wartenderFall = null, sprichtBis = 0;
  var wenigBewegung = false;
  try { wenigBewegung = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  /* K83/K84 (19.10.): Ladestand an index.html melden (BOS_TUER_LADEN: Zeitlimit, Prüfzeile). Fehlt das Objekt (ältere
     index.html), geht alles wie bisher. Hat index.html schon abgebrochen (Zeitlimit), steigt diese Datei still aus. */
  var L = window.BOS_TUER_LADEN || null;
  function melde(schritt, wert) { try { if (L && L.melde) L.melde(schritt, wert); } catch (e) {} }
  function abgebrochen() { return !!(L && L.abgebrochen) || !document.documentElement.classList.contains('mit-crumble'); }
  function warne(was, fehler) {
    if (kaputt) return;
    kaputt = true;
    var still = !!(L && L.abgebrochen);   // index.html hat schon gemeldet (Zeitlimit) — keine zweite Konsolenzeile
    if (!still) console.warn('[tuer-crumble] ' + was + ' — die Tür läuft ohne Crumble.', fehler || '');
    try { if (L && L.fehler && !still) L.fehler(was + (fehler && fehler.message && was.indexOf(fehler.message) < 0 ? ' — ' + fehler.message : '')); } catch (e) {}
    [tTipp, tErster, tZurueck, tBlinzel, tSchlaf, tLachen].forEach(function (t) { clearTimeout(t); });
    try { if (symbol && altesSymbol && symbol.classList.contains('loch')) { symbol.classList.remove('loch'); symbol.innerHTML = altesSymbol; } } catch (e) {}
    try { if (blase && blase.parentNode) blase.parentNode.removeChild(blase); } catch (e) {}
    try { document.documentElement.classList.remove('mit-crumble'); } catch (e) {}
  }
  function zufall(a, b) { return a + Math.random() * (b - a); }
  function eins(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  /* ---------- Laden: CSS, Daten, Büsten ---------- */
  function ladeCss() {
    return new Promise(function (ok, nein) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = BASIS + 'loch.css'; l.setAttribute('data-tuer-crumble', '1');
      l.onload = function () { melde('css', true); ok(); };
      l.onerror = function () {
        if (L && L.pruefen && L.statusVon) L.statusVon(BASIS + 'loch.css', function (st) { nein(new Error('loch.css nicht ladbar' + (st ? ' (' + st + ')' : ''))); });
        else nein(new Error('loch.css nicht ladbar'));
      };
      document.head.appendChild(l);
    });
  }
  function ladeDaten() {
    return fetch(BASIS + 'loch.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('loch.json: HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      if (!d || !d.buesten || !d.reaktionen || !d.oeffnen || !d.tipps) throw new Error('loch.json unvollständig');
      daten = d;
      melde('texte', true);
    });
  }
  function ladeBuesten() {
    var namen = Object.keys(daten.buesten).filter(function (n) { return daten.buesten[n].tuer !== false; });   // herzen: nicht an der Tür (O22)
    var da = 0, offen = namen.slice();
    melde('buestenSoll', namen.length); melde('wartetAuf', offen.map(function (n) { return daten.buesten[n].datei; }).join(', '));
    return Promise.all(namen.map(function (n) {
      var img = new Image();
      img.alt = ''; img.className = 'loch__buste'; img.setAttribute('data-buste', n); img.draggable = false;
      img.decoding = 'async';
      img.src = BASIS + daten.buesten[n].datei;
      bilder[n] = img;
      return (img.decode ? img.decode() : new Promise(function (ok, nein) { img.onload = ok; img.onerror = nein; }))
        .then(function () {
          da++; offen.splice(offen.indexOf(n), 1);
          melde('wartetAuf', offen.map(function (x) { return daten.buesten[x].datei; }).join(', ')); melde('buesten', da);
        })
        .catch(function () {
          var datei = daten.buesten[n].datei;
          if (L && L.pruefen && L.statusVon) return new Promise(function (ok, nein) { L.statusVon(BASIS + datei, function (st) { nein(new Error('Büste nicht ladbar: ' + datei + (st ? ' (' + st + ')' : ''))); }); });
          throw new Error('Büste nicht ladbar: ' + datei);
        });
    }));
  }

  /* ---------- Loch einsetzen (K77): erst, wenn alles da ist ---------- */
  function setzeEin() {
    symbol = document.querySelector('.einblick .einblick-symbol');
    karte = document.querySelector('.einblick');
    if (!symbol || !karte) throw new Error('Karte „Neu hier?“ nicht gefunden');
    altesSymbol = symbol.innerHTML;
    var frag = document.createDocumentFragment();
    var hinten = document.createElement('span'); hinten.className = 'loch__hinten'; frag.appendChild(hinten);
    Object.keys(bilder).forEach(function (n) { frag.appendChild(bilder[n]); });
    var schatten = document.createElement('span'); schatten.className = 'loch__schatten'; frag.appendChild(schatten);
    var vorne = document.createElement('span'); vorne.className = 'loch__vorne'; frag.appendChild(vorne);
    symbol.classList.add('loch');   // zuerst: warne() erkennt daran, dass das alte Symbol zurück muss
    symbol.innerHTML = '';
    symbol.appendChild(frag);
    blase = document.createElement('span');
    blase.className = 'loch-blase'; blase.setAttribute('aria-hidden', 'true'); blase.hidden = true;
    karte.appendChild(blase);
    legeSpitze();
    zeige('neutral');
  }
  function legeSpitze() {
    if (!symbol || !karte || !blase) return;
    var s = symbol.getBoundingClientRect(), k = karte.getBoundingClientRect();
    blase.style.setProperty('--spitze-x', Math.round(s.left - k.left + s.width / 2) + 'px');
  }

  /* ---------- Ausdruck und Blase ---------- */
  function zeige(name) {
    if (!bilder[name]) name = 'neutral';
    Object.keys(bilder).forEach(function (n) { bilder[n].classList.toggle('loch__buste--an', n === name); });
    aktuell = name;
  }
  function platzOben() {
    var reihe = document.querySelector('.knopfreihe'), me = document.getElementById('meldung');
    var oben = reihe ? reihe.getBoundingClientRect().bottom : 0;
    if (me) { var r = me.getBoundingClientRect(); if (r.height > 0) oben = Math.max(oben, r.bottom); }
    return karte.getBoundingClientRect().top - oben;
  }
  /* K82 (Nacharbeit 1f): Zeilen der Blase über die Wort-Rechtecke (Range) — wie viele, wie viele Wörter in der letzten,
     wo endet die längste. */
  function zeilen() {
    var tn = blase.firstChild, t = tn ? tn.textContent : '', re = /\S+/g, m, z = [];
    while ((m = re.exec(t))) {
      var r = document.createRange(); r.setStart(tn, m.index); r.setEnd(tn, m.index + m[0].length);
      var rs = r.getClientRects(); if (!rs.length) continue;
      var q = rs[rs.length - 1], y = Math.round(q.top), zl = null;
      for (var i = 0; i < z.length; i++) if (Math.abs(z[i].y - y) < 4) { zl = z[i]; break; }
      if (!zl) { zl = { y: y, n: 0, r: 0 }; z.push(zl); }
      zl.n++; zl.r = Math.max(zl.r, q.right);
    }
    var maxR = 0; z.forEach(function (x) { maxR = Math.max(maxR, x.r); });
    return { anzahl: z.length, letzte: z.length ? z[z.length - 1].n : 0, maxR: maxR };
  }
  var PRETTY = false;
  try { PRETTY = !!(window.CSS && CSS.supports && CSS.supports('text-wrap', 'pretty')); } catch (e) {}
  /* K82: kein einzelnes Wort allein in der letzten Zeile (CSS text-wrap: pretty; ohne Unterstützung: Blase schrittweise schmaler),
     danach die Blase auf die längste Zeile zuschneiden — sonst bliebe rechts bis zu 50 px leer (gemessen, Bau-Doku §7). */
  function passeBreite() {
    blase.style.width = '';
    var z = zeilen();
    if (z.anzahl < 2) return;
    var b = blase.getBoundingClientRect(), w = b.width, n = z.anzahl;
    for (var i = 0; i < 16 && z.letzte === 1 && !PRETTY; i++) {
      w -= 10; blase.style.width = w + 'px'; z = zeilen();
      if (z.anzahl > n + 1) { blase.style.width = ''; z = zeilen(); break; }
    }
    var cs = getComputedStyle(blase); b = blase.getBoundingClientRect();
    var vorher = { anzahl: z.anzahl, letzte: z.letzte, breite: blase.style.width };
    blase.style.width = Math.ceil(z.maxR - b.left + parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth) + 1) + 'px';
    var nach = zeilen();
    if (nach.anzahl !== vorher.anzahl || nach.letzte === 1) blase.style.width = vorher.breite;   // Zuschnitt hätte neu umbrochen: lassen
  }
  function blaseText(text) {
    if (!blase) return;
    if (!text) { blase.hidden = true; blase.textContent = ''; blase.style.width = ''; return; }
    blase.classList.remove('loch-blase--klein');
    blase.style.width = '';
    blase.textContent = text;
    blase.hidden = false;
    legeSpitze();
    // Sicherung (Bauplan §4): passt die Blase nicht in den Platz über der Karte → eine Stufe kleiner, sonst Platz einmalig größer
    var frei = platzOben();
    if (blase.offsetHeight + RESERVE_LUFT > frei) {
      blase.classList.add('loch-blase--klein');
      if (blase.offsetHeight + RESERVE_LUFT > frei) {
        var jetzt = parseFloat(getComputedStyle(karte).marginTop) || 74;
        document.documentElement.style.setProperty('--tuer-blasenraum', Math.ceil(jetzt + blase.offsetHeight + RESERVE_LUFT - frei) + 'px');
        groesser++;
      }
    }
    try { passeBreite(); } catch (e) { blase.style.width = ''; }   // K82; Fehler hier sind kosmetisch → Blase wie vorher
  }
  var groesser = 0;
  function lesedauer(text) {
    var l = daten.lesedauer_ms || {};
    return Math.max(l.min || 4000, Math.min(l.max || 7500, (text || '').length * (l.je_zeichen || 70)));
  }
  function wecke() { if (schlaeft) { schlaeft = false; } }
  function sprich(buste, text, danach) {
    if (!bereit || kaputt) return false;
    wecke();
    clearTimeout(tZurueck); clearTimeout(tLachen); tLachen = null;
    zeige(buste);
    blaseText(text);
    var d = text ? lesedauer(text) : 2500;
    sprichtBis = Date.now() + d;
    letzteAktivitaet = Date.now();
    tZurueck = setTimeout(function () {
      tZurueck = null; sprichtBis = 0;
      blaseText('');
      zeige('neutral');
      if (typeof danach === 'function') danach();
      planeSchlaf();
    }, d);
    return true;
  }

  /* ---------- Blinzeln und Schlaf ---------- */
  function planeBlinzeln() {
    clearTimeout(tBlinzel); tBlinzel = null;
    if (wenigBewegung || kaputt) return;
    var b = daten.blinzeln_s || [3, 6];
    tBlinzel = setTimeout(function () {
      tBlinzel = null;
      if (kaputt) return;
      if (aktuell === 'neutral' && !schlaeft && bilder.blinzeln) {   // nur aus neutral — nie während eines anderen Ausdrucks
        zeige('blinzeln');
        setTimeout(function () { if (aktuell === 'blinzeln') zeige('neutral'); }, daten.blinzel_ms || 120);
      }
      planeBlinzeln();
    }, zufall(b[0], b[1]) * 1000);
  }
  function planeSchlaf() {
    clearTimeout(tSchlaf); tSchlaf = null;
    if (kaputt) return;
    var ms = (daten.schlaf_s || 120) * 1000;
    var rest = letzteAktivitaet + ms - Date.now();
    tSchlaf = setTimeout(function () {
      tSchlaf = null;
      if (kaputt) return;
      if (Date.now() - letzteAktivitaet < ms - 50 || sprichtBis > Date.now()) return planeSchlaf();
      schlaeft = true; blaseText(''); zeige(daten.ausdruck && daten.ausdruck.schlaf || 'schlafen');
    }, Math.max(0, rest));
  }

  /* ---------- Sätze und Tipps (K63) ---------- */
  function ersterSatz() {
    tErster = null;
    if (wartenderFall && Date.now() - wartenderFall.t < 4000) { var f = wartenderFall; wartenderFall = null; fall(f.k); planeTipp(); return; }
    var z = window.BOS_TUER_ZUSTAND || {};
    if (z.durchwinken) { reagiere('angemeldet'); return; }   // die Weiterleitung wartet nicht auf ihn
    if (daten.oeffnen.length && Date.now() >= stilleBis) sprich((daten.ausdruck && daten.ausdruck.oeffnen) || 'winken', eins(daten.oeffnen).text);
    planeTipp();
  }
  function tippsMax() { return daten.tipps_max || 4; }
  function planeTipp() {
    clearTimeout(tTipp); tTipp = null;
    if (gezeigt >= tippsMax() || !tipps.length) return;
    var ab = daten.tipp_abstand_s || [20, 30];
    var ms = zufall(ab[0], ab[1]) * 1000;
    if (stilleBis > Date.now() + ms) ms = stilleBis - Date.now() + zufall(1000, 3000);
    tTipp = setTimeout(function () {
      tTipp = null;
      if (Date.now() < stilleBis || sprichtBis > Date.now()) return planeTipp();
      zeigeTipp();
      planeTipp();
    }, ms);
  }
  function zeigeTipp() {
    if (gezeigt >= tippsMax() || !tipps.length) return false;
    var t = tipps.splice(Math.floor(Math.random() * tipps.length), 1)[0];   // ohne Wiederholung im Besuch
    gezeigt++;
    var letzter = gezeigt >= tippsMax();
    var ausdr = (daten.ausdruck && daten.ausdruck.tipp) || ['zwinkern', 'wangen'];
    sprich(Array.isArray(ausdr) ? eins(ausdr) : ausdr, t.text, letzter ? lachen : null);
    return true;
  }
  /* F3: nach der Lesezeit des 4. Tipps 2,5 s lachen ohne Text, dann neutral und still */
  function lachen() {
    if (kaputt) return;
    zeige((daten.ausdruck && daten.ausdruck.nach_tipps) || 'lachen');
    tLachen = setTimeout(function () { tLachen = null; if (aktuell === ((daten.ausdruck && daten.ausdruck.nach_tipps) || 'lachen')) zeige('neutral'); }, daten.lachen_ms || 2500);
  }

  /* ---------- Eingabe-Stille (K63, B1, K74) ---------- */
  function stille() {
    stilleBis = Date.now() + ((daten && daten.eingabe_stille_s) || 20) * 1000;
    letzteAktivitaet = Date.now();
    if (!bereit) return;
    blaseText('');
    if (tZurueck) { clearTimeout(tZurueck); tZurueck = null; sprichtBis = 0; }   // Satz abgebrochen: Gesicht gleich zurück, nicht erst nach der Lesezeit
    if (schlaeft || aktuell !== 'neutral') { schlaeft = false; zeige('neutral'); }
    planeSchlaf();
  }
  function verdrahteEingabe() {
    // K74: nur Tab (auch Umschalt+Tab) zählt als Fokus von Menschenhand — Zeichen kommen ohnehin als input.
    document.addEventListener('keydown', function (e) { if (e && e.key === 'Tab') letzteTaste = Date.now(); }, true);
    ['kennung', 'passwort'].forEach(function (id) {
      var f = document.getElementById(id); if (!f) return;
      f.addEventListener('input', stille);
      f.addEventListener('pointerdown', stille);   // auch aufs schon fokussierte Feld (Autofokus): kein focus-Ereignis, aber ein Mensch
      f.addEventListener('touchstart', stille, { passive: true });
      f.addEventListener('focus', function () { if (Date.now() - letzteTaste < 500) stille(); });   // Tab ins Feld — Autofokus und Fokus durch die Tür selbst zählen nicht
    });
  }

  /* ---------- Reaktionen auf echte Meldungen (K64, K79) ---------- */
  function reagiere(k) {
    var r = daten && daten.reaktionen && daten.reaktionen[k];
    if (!r || !bereit) return;
    if (!r.text) {   // gesperrt: neutral, still
      clearTimeout(tZurueck); tZurueck = null; sprichtBis = 0; clearTimeout(tLachen); tLachen = null;
      wecke(); blaseText(''); zeige(r.buste || 'neutral'); letzteAktivitaet = Date.now(); planeSchlaf();
      return;
    }
    sprich(r.buste || 'besorgt', r.text);
  }
  function fall(k) {
    if (!k || kaputt) return;
    if (k === 'falsch') { falschZaehler++; if (falschZaehler > 1) k = 'falsch2'; }
    if (k === 'durchwinken') k = 'angemeldet';
    if (!bereit) { wartenderFall = { k: k, t: Date.now() }; return; }
    reagiere(k);
  }

  /* ---------- Start ---------- */
  window.BOS_TUER_CRUMBLE = {
    stand: '1f',   // K83: index.html erkennt daran eine passende Tür-Datei (eine 1e-Datei hat keinen Stand → sofort zurück)
    fall: function (k) { try { fall(k); } catch (e) { warne('Reaktion fehlgeschlagen', e); } },
    /* nur für Prüfwerkzeuge */
    _zustand: function () {
      return { bereit: bereit, kaputt: kaputt, aktuell: aktuell, schlaeft: schlaeft, gezeigt: gezeigt, rest: tipps.map(function (t) { return t.id; }),
               stilleBis: stilleBis, falsch: falschZaehler, blase: blase && !blase.hidden ? blase.textContent : '', klein: !!(blase && blase.classList.contains('loch-blase--klein')),
               groesser: groesser, letzteAktivitaet: letzteAktivitaet };
    },
    _tippJetzt: function () { if (bereit && Date.now() >= stilleBis) { zeigeTipp(); planeTipp(); } },
    _sage: function (buste, text) { if (bereit) { clearTimeout(tZurueck); zeige(buste); blaseText(text); } }
  };
  try {
    melde('datei', true);
    if (abgebrochen()) { kaputt = true; if (!(L && L.abgebrochen)) warne('Tür ohne Platz für Crumble (html.mit-crumble fehlt — index.html älter?)'); return; }
    verdrahteEingabe();
    if (!window.fetch || !window.Promise) throw new Error('Browser ohne fetch/Promise');
    Promise.all([ladeCss(), ladeDaten()]).then(function () {
      if (kaputt) return;
      if (abgebrochen()) { warne('Zeitlimit überschritten'); return; }
      tipps = daten.tipps.slice();
      return ladeBuesten();
    }).then(function () {
      if (kaputt) return;
      if (abgebrochen()) { warne('Zeitlimit überschritten'); return; }   // K83: was nach dem Zurückschalten ankommt, wird nicht mehr gezeigt
      setzeEin();
      melde('eingesetzt', true);
      try { if (L && L.fertigMeldung) L.fertigMeldung(); } catch (e) {}
      bereit = true;
      window.addEventListener('resize', legeSpitze);
      planeBlinzeln();
      planeSchlaf();
      tErster = setTimeout(function () { try { ersterSatz(); } catch (e) { warne('Satz fehlgeschlagen', e); } }, daten.erster_satz_ms || 1000);
    }).catch(function (e) { warne((e && e.message) || 'Laden fehlgeschlagen', e); });
  } catch (e) { warne('Start fehlgeschlagen', e); }
})();
