/* ================================================================
   BäckereiOS · Host — Crumble im Launcher (Brücke, #62 Stufe 1c)
   ================================================================
   Neu 17.10.2026 (Bau-Chat Crumble; Stufe 1 06:49, Nachtrag 1 08:09,
   Stufe 1c 09:37). Verdrahtet die Hamster-Figur (hamster_figur/
   hamster_figur.js, Modul ohne Firestore-/localStorage-Wissen) mit dem Launcher:

     1. SCHREIBTISCH-CRUMBLE (Stufe 1c, E11): eine eigene Bühne (fixed, Ebene 300,
        Geschwister direkt hinter dem übergebenen Schreibtisch-Element, gleiche
        Lage wie .bos-windows-layer) — über den Kacheln (Schreibtisch = Ebene 0),
        unter den Fenstern (400). Darin die Figur: Rolle 'lehrmeister', Modus
        'ecke', Einbettung 'schreibtisch', bleibt, läuft, spielt Nummern, ist
        schiebbar. Warum nicht IM Schreibtisch: .bos-desktop ist ein Scroll-
        Container (overflow:auto) mit Padding — ein Kind darin scrollte mit den
        Kacheln weg und stünde 26 px über der Taskleiste (Bauplan 1c §1, T5).
     2. KNOPF in der Kopfleiste (eigenes kleines Element dieses Hosts, 40 px,
        Kopfbild): zeigt/versteckt die Figur (sichtbar), NICHT An/Aus. Oranger
        Punkt, wenn ein Hinweis oder Ereignis im Versteck wartet.
     3. Figur im Bildschirmschoner (Rolle 'spielplatz', Einbettung 'container',
        läuft und spielt Nummern) — Fabrik an BOS_SCREENSAVER.setzeFigur().
     4. Begrüßung bei Profil-Aktivierung mit der Zahl offener Aufgaben aus
        'bos:aufgaben' (bos_taskboard.js); vorher neuLaden() (Nachtrag 1, K23).
     5. Aufgaben-Regeln: viel_offen ab Schwelle (einmal), alles_erledigt nur
        beim echten letzten Abhaken, Fehler/gesperrt → nichts.
     6. Ein/Aus (Profil-Feld hamster, fehlt = an): setzeAn(wert) wirkt auf
        Schreibtisch, Knopf und Schoner — der Hauptschalter (T2).
     7. SPEICHER je Gerät und Profil (localStorage, Schlüssel bos_crumble_<profilId>,
        JSON { sichtbar, x }): Sichtbarkeit und Position auf der Leiste. Kein
        Profil-Sync (K31: keine neuen Sync-Felder). Profil-Id aus
        BOS_PROFIL_LOOKUP.aktivesProfil().id (wie bos_taskboard.js), fehlt sie:
        '_geraet'. localStorage in try/catch (PWA/Privatmodus).

   launcher.html kennt: BOS_CRUMBLE_HOST.start({ an, basisPfad, tray, schreibtisch })
   in applyProfileUI(), setzeAn(wert) aus der Einstellungs-Zeile, und seit Nachtrag 6
   setzeGroesse('aus'|50|75|100) / setzeSchoner(0|50|75|100) / stufen() für die
   Geräte-Stufen (T5). topbar/vor als Knopf-Ort bleibt für Hülle und Satelliten.

   Fehlende Bilder / Manifest: Crumble bleibt still (Kompendium T4), Fehler in
   der Konsole und als 'hamster-figur:fehler' auf document.

   Abhängigkeiten (alle optional, lazy): hamster_figur/hamster_figur.js,
   bos_screensaver.js (setzeFigur/figurAn), bos_taskboard.js (bos:aufgaben,
   neuLaden), bos_profil_lookup.js (Profil-Id für den Speicher).

   CHANGELOG
     2026-10-18 · 13:07 · Nacharbeit 1e (Kontroll-Chat 12:53): K75 — Konto aus: begruesse()/begruesseMit()
       zählen nicht, merken keine IDs, lesen keinen Rufnamen (keine Fehlerzeile für ein abgeschaltetes Feature).
     2026-10-18 · 11:43 · Stufe 1e (K61, K67–K73; Bauplan 10:06, Go 10:22): Begrüßung nach
       Schichttag (ab 20:00 Folgetag), Zähler je Gerät/Profil (gruss { tag, starts, letzte,
       rufname, rufnameTag }), Topf Tageszeit/Wochentag/wieder da, Rufname im Hintergrund
       (eigene Person, genau 1, kein Ort-Konto, ≤ 20 Zeichen), Aufgabenzahl als zweite Blase
       (versteckt: eine Blase, Z1), ruhe() bis zum Ende der Folge; viel_offen wartet auf das
       Ende der ganzen Folge (grussLaeuftBis wird sofort gesetzt und beim Ablauf erneut gelesen —
       sonst kam viel_offen bei 7 offenen gleichzeitig mit dem Gruß, Fund probe_1e e10);
       Rufname-Lesefehler: einmal je Schichttag je Seite, Speicher unverändert; Tür-Schalter
       localStorage bos_crumble_tuer bei start()/setzeAn().
     2026-10-18 · 06:23 · Nachtrag 6 (K48–K50, Bauplan 04:21, Go 04:23): Knopf im Tray
       (Option tray, Klasse hf-knopf-host--tray); Speicher { groesse, schoner } je Gerät
       mit Stufen 50/75/100 (Schoner 0 = aus), Vorgaben 75/100; setzeGroesse/setzeSchoner/
       stufen; Schoner-Figur ohne speicher (Z1), schlaf:false, laufen:false; schreibe() wirft
       weiter (err.message ins Einstellungsfenster).
     2026-10-17 · 13:49 · Nachtrag 4 (K38–K40): Long-Press weckt einen schlafenden Crumble
       (nummer({wecken:true}) / show(3,{wecken:true})) und zählt als Sichtkontakt
       (figur.sichtkontakt('knopf')); pointercancel schaltet nichts mehr um (eigener
       Handler, click danach 1 s verschluckt); contextmenu auf dem Knopf unterdrückt.
     2026-10-17 · 12:35 · Nachtrag 3 (K35): Long-Press auf den Kopf-Knopf — ≥ 600 ms eine
       Nummer, ≥ 2000 ms Show (drei Nummern), kurz = zeigen/verstecken wie bisher;
       click nach Long-Press verschluckt. Sichtphase (K34) startet im Modul bei an()/start().
     2026-10-17 · 09:37 · Stufe 1c (K25, K26, K30, K31): Schreibtisch-Bühne statt
       Knopf-Modus in der Kopfleiste; eigener Knopf = zeigen/verstecken mit
       Wartepunkt; Speicher je Gerät/Profil; Schoner-Figur läuft und spielt
       Nummern; knopf() bleibt als Alias für figur().
     2026-10-17 · 08:09 · Nachtrag 1 (K23): start() vergisst letzteAufgaben und
       ruft BOS_TASKBOARD.neuLaden().
     2026-10-17 · 06:49 · Erstfassung (Crumble Stufe 1, K15–K18).
   ================================================================ */
window.BOS_CRUMBLE_HOST = (function () {
  'use strict';

  var WARTE_MS = 2500;          // so lange warten wir auf 'bos:aufgaben', bevor wir ohne Zahl grüßen
  var NACH_GRUSS_MS = 6500;     // viel_offen erst nach der Begrüßung (reaktion_ms 5500 + Luft) — Stufe 1e: Ende der ganzen Folge, siehe begruesseMit
  var SCHWELLE_VORGABE = 5;
  var HOEHE_SCHREIBTISCH = 170, HOEHE_SCHONER = 240;

  var figur = null;             // Figur auf dem Schreibtisch (Lehrmeister)
  var schoner = null;           // Figur im Schoner (legt der Schoner selbst an)
  var buehne = null, knopfEl = null;
  var an = true;
  var optionen = null;
  var letzteAufgaben = null;
  var wartetAufZahl = false, tWarten = null, grussLaeuftBis = 0;
  var vielGemeldet = false;

  function figurModul() { return window.BOS_HAMSTER_FIGUR || null; }
  function profilId() {
    try { var p = window.BOS_PROFIL_LOOKUP && window.BOS_PROFIL_LOOKUP.aktivesProfil ? window.BOS_PROFIL_LOOKUP.aktivesProfil() : null; return (p && p.id) ? String(p.id) : '_geraet'; }
    catch (e) { return '_geraet'; }
  }
  /* T5 (Nachtrag 6): { sichtbar, x, groesse (50/75/100, fehlt = 75), schoner (0/50/75/100, fehlt = 100) } je Gerät und Profil.
     schreibe() wirft weiter (err.message) — der Aufrufer zeigt es (Einstellungsfenster, Projektregel); die Figur fängt
     ihre eigenen Schreibvorgänge ab und meldet 'fehler' { speicher }. */
  var STUFEN = [50, 75, 100], GROESSE_VORGABE = 75, SCHONER_VORGABE = 100;
  var speicher = {
    lese: function () { try { var raw = localStorage.getItem('bos_crumble_' + profilId()); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } },
    schreibe: function (o) { localStorage.setItem('bos_crumble_' + profilId(), JSON.stringify(o || {})); }
  };
  function stufe(wert, vorgabe, nullErlaubt) {
    var n = Number(wert);
    if (nullErlaubt && n === 0) return 0;
    return STUFEN.indexOf(n) >= 0 ? n : vorgabe;
  }
  function gespeicherteGroesse() { return stufe(speicher.lese().groesse, GROESSE_VORGABE, false); }
  function gespeicherterSchoner() { return stufe(speicher.lese().schoner, SCHONER_VORGABE, true); }
  function pxSchreibtisch(st) { return Math.round((optionen && optionen.hoeheSchreibtisch || HOEHE_SCHREIBTISCH) * st / 100); }
  function pxSchoner(st) { return Math.round((optionen && optionen.hoeheSchoner || HOEHE_SCHONER) * st / 100); }

  function schwelle() {
    var m = figur && figur.manifest ? figur.manifest() : null;
    var s = m && m.verhalten ? m.verhalten.aufgaben_schwelle : null;
    return typeof s === 'number' && s > 0 ? s : SCHWELLE_VORGABE;
  }

  /* ---------- Begrüßung (Stufe 1e, K67–K73) ----------
     Je start(): Schichttag (ab 20:00 der Folgetag) → Zähler im Gerätespeicher → Topf (erster Start: Tageszeit nach der Uhr
     oder an Mo/Fr/Sa/So mit wochentag_anteil der Wochentag; weitere Starts: „wieder da“, {mal} ab dem 3.) → ohne die letzten
     5 → mit Rufname (name_anteil, nur wenn im Speicher) → Gruß als Ereignis app_geoeffnet (Pose wave). Die Aufgabenzahl
     folgt nach zahl_nach_ms als zweite Blase; ist Crumble versteckt, stehen Gruß und Zahl in EINER Blase (Z1), weil der
     Wartepunkt nur das Ereignis merkt. Bis zum Ende der Folge ruhe(): keine Nummer, kein Spaziergang. */
  var grussZahl = null, tZahl = null;   // nur für Prüfwerkzeuge: was als zweite Blase kam
  function zweistellig(n) { return (n < 10 ? '0' : '') + n; }
  function datumText(d) { return d.getFullYear() + '-' + zweistellig(d.getMonth() + 1) + '-' + zweistellig(d.getDate()); }
  /** Schichttag: ab abUhr (20) zählt schon der Folgetag (K67). Liefert { tag: 'JJJJ-MM-TT', wochentag: 0..6 }. */
  function schichttag(jetzt, abUhr) {
    var d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    if (jetzt.getHours() >= abUhr) d.setDate(d.getDate() + 1);
    return { tag: datumText(d), wochentag: d.getDay() };
  }
  function tageszeitTopf(b, stunde) {
    var t = b.tageszeit || {}, k;
    for (k in t) {
      if (!t.hasOwnProperty(k)) continue;
      var v = t[k].von, bis = t[k].bis;
      if (v < bis ? (stunde >= v && stunde < bis) : (stunde >= v || stunde < bis)) return t[k].zeilen || [];
    }
    return [];
  }
  function zufall(liste) { return liste[Math.floor(Math.random() * liste.length)]; }
  function meldeFehler(detail) { try { document.dispatchEvent(new CustomEvent('hamster-figur:fehler', { detail: detail })); } catch (e) {} }
  /** Den Gruß wählen und den Zähler fortschreiben. Gibt { text, id, start } oder null (kein Block im Manifest). */
  function waehleGruss(b) {
    var jetzt = new Date();
    var st = schichttag(jetzt, typeof b.schichttag_ab_uhr === 'number' ? b.schichttag_ab_uhr : 20);
    var g = speicher.lese().gruss || {};
    var start = (g.tag === st.tag ? (g.starts || 0) : 0) + 1;
    var letzte = Array.isArray(g.letzte) ? g.letzte : [];   // je Profil, über Schichttage hinweg (K69)
    var topf;
    if (start === 1) {
      var woche = (b.wochentag || {})[String(st.wochentag)];
      topf = (woche && woche.length && Math.random() < (typeof b.wochentag_anteil === 'number' ? b.wochentag_anteil : 0.33)) ? woche : tageszeitTopf(b, jetzt.getHours());
    } else {
      topf = (b.wieder_da || []).filter(function (z) { return !z.ab_start || start >= z.ab_start; });
    }
    if (!topf.length) return null;
    var frei = topf.filter(function (z) { return letzte.indexOf(z.id) < 0; });
    var z = zufall(frei.length ? frei : topf);
    var rufname = (g.rufnameTag && typeof g.rufname === 'string') ? g.rufname : '';
    var text = (rufname && z.name && Math.random() < (typeof b.name_anteil === 'number' ? b.name_anteil : 0.5)) ? z.name.replace(/\{name\}/g, function () { return rufname; }) : z.text;
    text = text.replace(/\{mal\}/g, String(start));
    if (/[{}]/.test(text)) text = z.text.replace(/\{mal\}/g, String(start));   // K70: nie {name}/{mal} wörtlich
    if (/[{}]/.test(text)) return null;
    var neu = Object.assign({}, g, { tag: st.tag, starts: start, letzte: [z.id].concat(letzte.filter(function (i) { return i !== z.id; })).slice(0, b.letzte_merken || 5) });
    try { speicher.schreibe(Object.assign(speicher.lese(), { gruss: neu })); }
    catch (err) { console.warn('[crumble] Begrüßung: Zähler nicht gespeichert', err); meldeFehler({ speicher: true, message: (err && err.message) || String(err) }); }
    return { text: text, id: z.id, start: start, tag: st.tag };
  }
  function zahlText(b, n) {
    var z = b.zahl || {};
    var liste = n === 0 ? z['null'] : (n === 1 ? z.eins : z.mehr);
    return (liste && liste.length) ? zufall(liste).replace(/\{n\}/g, String(n)) : '';
  }
  function begruesseMit(detail) {
    clearTimeout(tWarten); tWarten = null; wartetAufZahl = false;
    if (!figur) return;
    if (!an) return;   // K75 (Nacharbeit 1e): Konto-Aus — nicht zählen, keine IDs merken, keinen Rufnamen lesen. Später eingeschaltet: der nächste Start ist der „erste“
    var n = (detail && !detail.fehler && !detail.gesperrt && typeof detail.offen === 'number') ? detail.offen : null;
    var f = figur;
    grussLaeuftBis = Date.now() + NACH_GRUSS_MS;   // sofort, wie vor 1e: aufAufgaben() liest den Wert gleich danach; das Ende der Folge setzt bereit.then genauer
    f.bereit.then(function () {
      if (f !== figur) return;
      var m = f.manifest(), b = m && m.begruessung;
      if (!b) { f.ereignis('app_geoeffnet', typeof n === 'number' ? { n: n } : {}); grussLaeuftBis = Date.now() + NACH_GRUSS_MS; return; }
      var gruss = waehleGruss(b);
      if (!gruss) return;
      var zahlNach = typeof b.zahl_nach_ms === 'number' ? b.zahl_nach_ms : 3500, zahlDauer = typeof b.zahl_dauer_ms === 'number' ? b.zahl_dauer_ms : 4000;
      var mitZahl = typeof n === 'number' && (gruss.start === 1 || n > 0);
      var zt = mitZahl ? zahlText(b, n) : '';
      grussZahl = { gruss: gruss.text, id: gruss.id, start: gruss.start, zahl: zt, versteckt: !f.istSichtbar() };
      clearTimeout(tZahl); tZahl = null;
      var reaktion = (m.verhalten && m.verhalten.reaktion_ms) || 5500;
      var dauer = zt ? zahlNach + zahlDauer : reaktion;
      if (!f.istSichtbar() || !f.istAn()) {
        f.ereignis('app_geoeffnet', { text: zt ? gruss.text + ' ' + zt : gruss.text });   // Z1: versteckt → eine Blase, der Wartepunkt merkt sie
      } else {
        f.ereignis('app_geoeffnet', { text: gruss.text });
        if (zt) tZahl = setTimeout(function () { tZahl = null; if (f === figur && f.istAn() && f.istSichtbar()) f.sage(zt, zahlDauer); }, zahlNach);
      }
      if (f.ruhe) f.ruhe(dauer + 500);
      grussLaeuftBis = Date.now() + dauer + 500;
      leseRufnameSpaeter(gruss.tag);
    });
  }
  function begruesse() {
    clearTimeout(tWarten);
    if (!an) { wartetAufZahl = false; tWarten = null; return; }   // K75
    if (letzteAufgaben) { begruesseMit(letzteAufgaben); return; }
    wartetAufZahl = true;
    tWarten = setTimeout(function () { if (wartetAufZahl) begruesseMit(null); }, WARTE_MS);
  }

  /* ---------- Rufname (K70): im Hintergrund, höchstens einmal je Schichttag; der Gruß wartet nie darauf ----------
     Nur der Rufname der EIGENEN Person (personen.where bosKontoId == Kennung, genau 1 Treffer, kein Ort-Konto,
     namen/<Nr>.rufname 1–20 Zeichen). Nie Beschreibung, nie BOS_NAMEN.anzeige(), nie Kennung. Konto ohne Haken: gar nicht
     lesen (die Regel verweigert es ohnehin — sonst stünde jeden Tag ein Fehler in den Einstellungen). Lesefehler: Gruß ohne
     Namen, console.warn und 'hamster-figur:fehler' { name: true } → Crumble-Zeile der Einstellungen; Gerätespeicher unverändert,
     an diesem Schichttag liest diese Seite nicht noch einmal (ein Neuladen versucht es wieder). */
  var nameLiest = false, fehlVersuch = {};   // fehlVersuch[profilId] = Schichttag eines fehlgeschlagenen Lesens (nur im Speicher der Seite)
  function leseRufnameSpaeter(tag) {
    var g = speicher.lese().gruss || {};
    if (g.rufnameTag === tag || nameLiest || fehlVersuch[profilId()] === tag) return;
    var p = null;
    try { p = window.BOS_PROFIL_LOOKUP && window.BOS_PROFIL_LOOKUP.aktivesProfil ? window.BOS_PROFIL_LOOKUP.aktivesProfil() : null; } catch (e) {}
    if (p && p.freigeschaltet === false) return;
    if (!window.db || !window.firebase || typeof window.firebase.auth !== 'function') return;
    nameLiest = true;
    var db = window.db, pid = profilId();
    (window.BOS_AUTH_READY || Promise.resolve()).then(function () {
      var u = window.firebase.auth().currentUser;
      if (!u || !u.email) return null;
      var kennung = String(u.email).split('@')[0].toLowerCase();
      var konto = (window.BOS_ACCOUNTS && typeof window.BOS_ACCOUNTS.ladeKonto === 'function') ? window.BOS_ACCOUNTS.ladeKonto(db, kennung).catch(function () { return null; }) : Promise.resolve(null);
      return Promise.all([db.collection('personen').where('bosKontoId', '==', kennung).limit(2).get(), konto]).then(function (r) {
        var snap = r[0], k = r[1];
        if (!snap || snap.size !== 1 || (k && k.art === 'ort')) return '';
        return db.collection('namen').doc(snap.docs[0].id).get().then(function (d) {
          var e = d && d.exists ? (d.data() || {}) : {};
          var rn = String(e.rufname || '').trim();
          return (rn.length >= 1 && rn.length <= 20 && !/[{}]/.test(rn)) ? rn : '';
        });
      });
    }).then(function (rn) {
      nameLiest = false;
      if (rn === null || pid !== profilId()) return;
      try { var alt = speicher.lese(); speicher.schreibe(Object.assign(alt, { gruss: Object.assign({}, alt.gruss || {}, { rufname: rn, rufnameTag: tag }) })); }
      catch (err) { meldeFehler({ speicher: true, message: (err && err.message) || String(err) }); }
    }).catch(function (err) {
      nameLiest = false;
      // Bauplan §2.2: Speicher bleibt unverändert (ein schon bekannter Name bleibt). „Höchstens einmal je Schichttag“ hält ein
      // Merker im Speicher der Seite: weitere Starts dieser Seite lesen heute nicht erneut; ein Neuladen versucht es wieder.
      fehlVersuch[pid] = tag;
      console.warn('[crumble] Rufname für die Begrüßung nicht lesbar', err);
      meldeFehler({ name: true, message: (err && (err.code ? err.code + ' — ' : '') + (err.message || '')) || String(err) });
    });
  }

  /* ---------- Tür (K61): Konto-Schalter als Gerätewert für index.html ---------- */
  function schreibeTuer() {
    try { localStorage.setItem('bos_crumble_tuer', an ? 'an' : 'aus'); }
    catch (err) { meldeFehler({ speicher: true, message: (err && err.message) || String(err) }); }
  }

  /* ---------- Aufgaben-Regeln ---------- */
  function aufAufgaben(e) {
    var d = e && e.detail ? e.detail : null;
    if (!d) return;
    letzteAufgaben = d;
    if (wartetAufZahl) begruesseMit(d);
    if (!figur || d.fehler || d.gesperrt) return;
    var offen = typeof d.offen === 'number' ? d.offen : 0;
    var vorher = typeof d.vorher === 'number' ? d.vorher : null;
    if (offen >= schwelle()) {
      if (!vielGemeldet) {
        vielGemeldet = true;
        // Stufe 1e: das Ende der Folge kann sich nach hinten schieben (Zahl-Blase) — beim Ablauf erneut nachsehen
        var spaeter = function () { var rest = grussLaeuftBis - Date.now(); if (rest > 0) { setTimeout(spaeter, rest); return; } if (figur) figur.ereignis('viel_offen', { n: offen }); };
        setTimeout(spaeter, Math.max(0, grussLaeuftBis - Date.now()));
      }
    } else {
      vielGemeldet = false;
    }
    if (vorher !== null && vorher > 0 && offen === 0) figur.ereignis('alles_erledigt');
  }

  /* ---------- Bühne und Knopf (K25/K26) ---------- */
  function legeBuehneAn() {
    if (buehne || !optionen.schreibtisch) return;
    buehne = document.createElement('div');
    buehne.className = 'hf-buehne-schreibtisch';
    buehne.setAttribute('aria-hidden', 'false');
    optionen.schreibtisch.insertAdjacentElement('afterend', buehne);
    passeBuehneAn();
    window.addEventListener('resize', passeBuehneAn);
  }
  /* Lage der Bühne = Lage des Schreibtisch-Elements (Kopfleiste oben, Taskleiste unten) — so darf #78 die Maße ändern */
  function passeBuehneAn() {
    if (!buehne || !optionen.schreibtisch) return;
    var r = optionen.schreibtisch.getBoundingClientRect();
    var h = window.innerHeight || document.documentElement.clientHeight;
    buehne.style.top = Math.round(r.top) + 'px';
    buehne.style.bottom = Math.round(Math.max(0, h - r.bottom)) + 'px';
    buehne.style.left = Math.round(r.left) + 'px';
    buehne.style.right = Math.round(Math.max(0, (window.innerWidth || document.documentElement.clientWidth) - r.right)) + 'px';
  }
  /* T4 (Nachtrag 6, K48): Knopf im Tray unten rechts (erstes Kind, vor ⚙️ und 🌙); topbar/vor bleibt als Rückfall (Hülle, Satelliten). */
  function legeKnopfAn() {
    if (knopfEl || !(optionen.tray || optionen.topbar)) return;
    knopfEl = document.createElement('button');
    knopfEl.type = 'button';
    knopfEl.className = 'hf-knopf-host' + (optionen.tray ? ' hf-knopf-host--tray' : '');
    knopfEl.title = 'Crumble zeigen/verstecken';
    knopfEl.setAttribute('aria-label', 'Crumble zeigen/verstecken');
    knopfEl.setAttribute('aria-pressed', 'true');
    knopfEl.innerHTML = '<img alt="" draggable="false">';
    knopfEl.querySelector('img').src = optionen.basisPfad + 'bilder/idle.png';
    verdrahteKnopf(knopfEl);
    if (optionen.tray) optionen.tray.insertBefore(knopfEl, optionen.tray.firstChild);
    else if (optionen.vor && optionen.vor.parentNode === optionen.topbar) optionen.topbar.insertBefore(knopfEl, optionen.vor);
    else optionen.topbar.appendChild(knopfEl);
    aktualisiereKnopf();
  }
  /* K35 (Nachtrag 3, Easter Egg): Kurz tippen = zeigen/verstecken. Halten ≥ HALTEN_MS = eine Nummer (versteckt: erst zeigen).
     Halten ≥ SHOW_MS = Show, drei verschiedene Nummern nacheinander. Der click nach einem Long-Press wird verschluckt
     (Muster K27); Bewegung während des Haltens ist egal, der Knopf bewegt sich nicht. Kein Tooltip, keine Hilfe. */
  var HALTEN_MS = 600, SHOW_MS = 2000, KURZ_MS = 500;
  function verdrahteKnopf(el) {
    var halt = null;
    function aufraeumen() { if (!halt) return; clearTimeout(halt.t1); clearTimeout(halt.t2); el.classList.remove('hf-knopf-host--haelt'); }
    /* click nach pointerup kommt im selben Ereignislauf → bis zum nächsten Tick verschlucken; nach pointercancel kommt er
       (wenn überhaupt) erst beim Loslassen → ein Fenster von 1 s (K39). Tastatur-click (Enter/Leertaste) hat kein pointerdown. */
    function verschlucke(ms) { el._verschlucke = true; el._verschluckeBis = ms ? Date.now() + ms : 0; if (!ms) setTimeout(function () { el._verschlucke = false; }, 0); }
    /* K38 (Nachtrag 4): vor der Nummer zeigen, Berührung zählt als Sichtkontakt, Schlafender wird geweckt */
    function bereitFuerNummer() { if (!figur.istSichtbar()) figur.sichtbar(true); figur.sichtkontakt('knopf'); }
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      aufraeumen(); el._verschlucke = false;
      halt = { id: e.pointerId, start: Date.now(), lang: false, t1: null, t2: null };
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      halt.t1 = setTimeout(function () {
        if (!halt || !figur) return;
        halt.lang = true; el.classList.add('hf-knopf-host--haelt');
        bereitFuerNummer();
        figur.nummer({ wecken: true });
      }, HALTEN_MS);
      halt.t2 = setTimeout(function () {
        if (!halt || !figur) return;
        halt.lang = true;
        bereitFuerNummer();
        figur.show(3, { wecken: true });
      }, SHOW_MS);
    });
    function ende(e) {
      if (!halt || e.pointerId !== halt.id) return;
      var h = halt; halt = null;
      clearTimeout(h.t1); clearTimeout(h.t2); el.classList.remove('hf-knopf-host--haelt');
      try { el.releasePointerCapture(e.pointerId); } catch (x) {}
      verschlucke(0);
      if (h.lang) return;
      if (Date.now() - h.start < KURZ_MS && figur) figur.sichtbar(!figur.istSichtbar());   // zwischen kurz und lang: nichts
    }
    /* K39 (Nachtrag 4): abgebrochener Zeiger (Browser übernimmt die Geste) → aufräumen, NICHT umschalten. Nur pointerup entscheidet. */
    function abbruch(e) {
      if (!halt || e.pointerId !== halt.id) return;
      var h = halt; halt = null;
      clearTimeout(h.t1); clearTimeout(h.t2); el.classList.remove('hf-knopf-host--haelt');
      try { el.releasePointerCapture(e.pointerId); } catch (x) {}
      verschlucke(1000);
    }
    el.addEventListener('pointerup', ende);
    el.addEventListener('pointercancel', abbruch);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // K40: Long-Press darf kein Kontextmenü öffnen
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (el._verschlucke) { el._verschlucke = false; if (!el._verschluckeBis || Date.now() < el._verschluckeBis) return; }
      if (figur) figur.sichtbar(!figur.istSichtbar());
    });
  }
  function aktualisiereKnopf() {
    if (!knopfEl) return;
    var sichtbar = figur ? figur.istSichtbar() : true;
    var wartet = figur ? figur.wartet() : false;
    knopfEl.classList.toggle('hf-knopf-host--versteckt', !sichtbar);
    knopfEl.classList.toggle('hf-knopf-host--wartet', wartet);
    knopfEl.classList.toggle('hf-knopf-host--aus', !an);
    knopfEl.setAttribute('aria-pressed', sichtbar ? 'true' : 'false');
    knopfEl.title = sichtbar ? 'Crumble verstecken' : (wartet ? 'Crumble zeigen — er hat etwas' : 'Crumble zeigen');
  }

  /* ---------- Anlegen ---------- */
  function legeFigurAn() {
    var M = figurModul();
    if (figur || !M || !optionen || !buehne) return;
    figur = M.neu({
      name: 'lehrmeister', container: buehne, basisPfad: optionen.basisPfad,
      modus: 'ecke', einbettung: 'schreibtisch', rolle: 'lehrmeister',
      hoehe: pxSchreibtisch(gespeicherteGroesse()), an: an, zufall: false,
      laufen: true, nummern: true, schiebbar: true, speicher: speicher
    });
    ['sichtbar', 'wartet', 'hinweis', 'hinweis-gesehen', 'zustand'].forEach(function (n) { figur.auf(n, aktualisiereKnopf); });
    figur.bereit.then(aktualisiereKnopf).catch(function (e) { console.error('[crumble] Schreibtisch-Crumble nicht ladbar: ' + (e && e.message ? e.message : e)); });
  }
  function fabrikSchoner(container) {
    var M = figurModul();
    if (!M) return null;
    // Z1 (Go 04:23): KEIN speicher — die Schoner-Figur schreibt nie in den Gerätespeicher (sichtbar/x je Wechsel sind Schoner-Sache).
    // T8: schlaf:false (Auftritte beginnen wach), laufen:false (steht mittig).
    schoner = M.neu({
      name: 'spielplatz', container: container, basisPfad: optionen.basisPfad,
      modus: 'ecke', einbettung: 'container', rolle: 'spielplatz',
      hoehe: pxSchoner(gespeicherterSchoner() || SCHONER_VORGABE), an: an, zufall: false,
      laufen: false, nummern: true, schiebbar: false, schlaf: false
    });
    schoner.bereit.catch(function (e) { console.error('[crumble] Schoner-Crumble nicht ladbar: ' + (e && e.message ? e.message : e)); });
    return schoner;
  }

  var gestartet = false;
  /**
   * start({ an, basisPfad, topbar, vor, schreibtisch, hoeheSchreibtisch, hoeheSchoner })
   * Bei jeder Profil-Aktivierung aufrufen (dort, wo BOS_SCREENSAVER.start() steht).
   * Erster Aufruf legt Bühne, Knopf und Figur an; jeder Aufruf setzt Ein/Aus, liest den
   * Speicher des (neuen) Profils und begrüßt genau einmal.
   */
  function start(o) {
    optionen = Object.assign({ basisPfad: 'hamster_figur/', an: true }, o || {});
    if (!figurModul()) { console.warn('[crumble] hamster_figur.js nicht geladen — Crumble bleibt aus'); return; }
    an = optionen.an !== false;
    if (!gestartet) {
      gestartet = true;
      document.addEventListener('bos:aufgaben', aufAufgaben);
      if (window.BOS_SCREENSAVER && typeof window.BOS_SCREENSAVER.setzeFigur === 'function') window.BOS_SCREENSAVER.setzeFigur(fabrikSchoner);
    }
    legeBuehneAn();
    legeKnopfAn();
    legeFigurAn();
    if (figur) { figur.bereit.then(function () { figur.ladeGespeichert(); figur.setzeGroesse(pxSchreibtisch(gespeicherteGroesse())); aktualisiereKnopf(); }); }
    wendeSchonerAn();
    setzeAn(an);
    // K23 (Nachtrag 1): nichts vom vorherigen Profil übernehmen, Brett frisch laden
    letzteAufgaben = null;
    vielGemeldet = false;
    if (window.BOS_TASKBOARD && typeof window.BOS_TASKBOARD.neuLaden === 'function') {
      try { var p = window.BOS_TASKBOARD.neuLaden(); if (p && p.catch) p.catch(function () {}); }
      catch (e) { console.warn('[crumble] BOS_TASKBOARD.neuLaden', e); }
    }
    begruesse();
  }

  /* ---------- Stufen je Gerät (T5/T6, Nachtrag 6) ---------- */
  function wendeSchonerAn() {
    var st = gespeicherterSchoner();
    if (window.BOS_SCREENSAVER && typeof window.BOS_SCREENSAVER.setzeFigurGroesse === 'function') window.BOS_SCREENSAVER.setzeFigurGroesse(st ? pxSchoner(st) : 0);
    else if (schoner && st) schoner.setzeGroesse(pxSchoner(st));
  }
  function schreibeStufe(teil) { speicher.schreibe(Object.assign(speicher.lese(), teil)); }   // wirft bei gesperrtem localStorage → Aufrufer zeigt err.message
  /** Schreibtisch: 'aus' | 50 | 75 | 100. 'aus' = verstecken wie der Knopf (derselbe Zustand). Wirft bei Speicherfehler. */
  function setzeGroesse(wert) {
    if (wert === 'aus' || wert === 0) { if (figur) figur.sichtbar(false); return; }
    var st = stufe(wert, GROESSE_VORGABE, false);
    schreibeStufe({ groesse: st });
    if (figur) { figur.setzeGroesse(pxSchreibtisch(st)); if (!figur.istSichtbar()) figur.sichtbar(true); }
  }
  /** Schoner: 0 (aus) | 50 | 75 | 100. Wirft bei Speicherfehler. */
  function setzeSchoner(wert) {
    var st = (wert === 'aus') ? 0 : stufe(wert, SCHONER_VORGABE, true);
    schreibeStufe({ schoner: st });
    wendeSchonerAn();
  }
  function stufen() {
    return { schreibtisch: (figur && !figur.istSichtbar()) ? 'aus' : gespeicherteGroesse(), schoner: gespeicherterSchoner() };
  }

  /** Ein/Aus für alles (Profil-Feld hamster) — der Hauptschalter. */
  function setzeAn(wert) {
    an = wert !== false;
    schreibeTuer();
    if (figur) figur.an(an);
    if (window.BOS_SCREENSAVER && typeof window.BOS_SCREENSAVER.figurAn === 'function') window.BOS_SCREENSAVER.figurAn(an);
    else if (schoner) schoner.an(an);
    aktualisiereKnopf();
  }

  return {
    start: start,
    setzeAn: setzeAn,
    istAn: function () { return an; },
    setzeGroesse: setzeGroesse, groesse: gespeicherteGroesse, setzeSchoner: setzeSchoner, schoner: gespeicherterSchoner, stufen: stufen,
    figur: function () { return figur; },
    knopf: function () { return figur; },          // Alias (Stufe 1: Knopf-Crumble); seit 1c die Schreibtisch-Figur
    knopfElement: function () { return knopfEl; },
    buehne: function () { return buehne; },
    schoner: function () { return schoner; },
    /* nur für Prüfwerkzeuge */
    _zustand: function () { return { an: an, wartetAufZahl: wartetAufZahl, vielGemeldet: vielGemeldet, letzteAufgaben: letzteAufgaben, profilId: profilId(), gruss: grussZahl, grussLaeuftBis: grussLaeuftBis }; },
    _schichttag: function (d, ab) { return schichttag(d || new Date(), typeof ab === 'number' ? ab : 20); }
  };
})();
