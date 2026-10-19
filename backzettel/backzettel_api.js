/* ================================================================
   BäckereiOS · backzettel/backzettel_api.js — Anfrage an Claude
   ================================================================
   Stellt bereit: window.BOS_BACKZETTEL_API (Browser) bzw. module.exports
   (Node, für die Prüfdatei). Braucht: BOS_BACKZETTEL_PROMPT (Browser) bzw.
   den Prompt als Parameter (Node).

   Was hier liegt:
     geraet()            Schlüssel, Modell, Gründlichkeit — NUR auf diesem
                         Gerät (localStorage), nie in Firestore (E1, E2)
     setzeSchluessel/loescheSchluessel, setzeModell, setzeGruendlichkeit
     schluesselAnzeige(k)   „…abcd“ (die letzten 4 Zeichen)
     baueAnfrage(…)      Body der Messages-API (rein, prüfbar)
     lies(…)             senden, Zeitlimit, ein zweiter Versuch bei 429/529,
                         Antwort lesen und SELBST nachprüfen (B1)
     pruefeAntwort(d)    Schema-Nachprüfung in BOS → Liste von Problemen
     kosten(usage, m)    US-$ aus dem Verbrauch der Antwort (ca. bei Haiku, B7)
     nacheinander(…)     höchstens N Anfragen gleichzeitig
     entschaerfe(text, k)   Schlüssel aus jedem Text tilgen (doppelte Sicherung)

   DER SCHLÜSSEL (Anweisung A.1, Bauplan §4.14):
     - geht NUR als Kopfzeile x-api-key an https://api.anthropic.com
     - nie in Firestore, nie in eine Meldung (entschaerfe), nie in console.*
     - liegt im localStorage der Adresse baeckereios.github.io — jede Seite
       dieser Adresse könnte ihn lesen. Schutz in der Praxis: eigener
       Workspace mit niedrigem Ausgabenlimit in der Anthropic-Console,
       Schlüssel jederzeit widerrufbar.

   API (Anthropic-Doku, gelesen 19.10.2026):
     POST https://api.anthropic.com/v1/messages
     Kopf: x-api-key, anthropic-version: 2023-06-01,
           anthropic-dangerous-direct-browser-access: true (Aufruf aus dem Browser)
     Antwort im festen Schema über output_config.format (Structured Outputs,
     ohne Beta-Kopfzeile). KEIN erzwungenes Werkzeug: Opus 5.5, Sonnet 5.5,
     Fable 5.1 lehnen tool_choice „tool“/„any“ mit 400 ab (B1). Das Denken
     lässt sich bei Opus/Sonnet 5.5 nicht abschalten, output_config.effort
     steuert es („Gründlichkeit“).

   CHANGELOG
     2026-10-19 · 17:32 · v1 · Erstfassung (Backzettel Stufe 1)
       SESSION_2026-10-19_BACKZETTEL_STUFE1_BAU.md, Freigabe KC 09:47.
   ================================================================ */
(function (wurzel) {
  'use strict';

  var ADRESSE = 'https://api.anthropic.com/v1/messages';
  var VERSION = '2023-06-01';
  var ZEITLIMIT_MS = 150000;      // je Anfrage
  var GLEICHZEITIG = 3;           // höchstens so viele Fotos zugleich
  var MAX_TOKENS = 16000;         // Denken + Antwort (zählt beides)
  var WARTEN_MAX_MS = 20000;      // zweiter Versuch bei 429/529: höchstens so lange warten
  var SPEICHER = { schluessel: 'bos_backzettel_schluessel', modell: 'bos_backzettel_modell', effort: 'bos_backzettel_effort' };

  function prompt() {
    return (typeof wurzel !== 'undefined' && wurzel.BOS_BACKZETTEL_PROMPT) || null;
  }

  /* ---------- Gerät (localStorage, jeder Zugriff abgesichert) ---------- */
  function lesen(k) { try { return wurzel.localStorage.getItem(k); } catch (e) { return null; } }
  function schreiben(k, v) {
    try { if (v === null) wurzel.localStorage.removeItem(k); else wurzel.localStorage.setItem(k, v); return true; }
    catch (e) { return false; }
  }
  function geraet() {
    var P = prompt();
    return {
      schluessel: lesen(SPEICHER.schluessel) || '',
      modell: lesen(SPEICHER.modell) || (P ? P.MODELL_VORGABE : 'claude-sonnet-5-5'),
      effort: lesen(SPEICHER.effort) || (P ? P.GRUENDLICHKEIT_VORGABE : 'medium')
    };
  }
  function setzeSchluessel(k) {
    var s = String(k || '').trim();
    if (!s) return false;
    return schreiben(SPEICHER.schluessel, s);
  }
  function loescheSchluessel() { return schreiben(SPEICHER.schluessel, null); }
  function setzeModell(m) { var s = String(m || '').trim(); return s ? schreiben(SPEICHER.modell, s) : schreiben(SPEICHER.modell, null); }
  function setzeGruendlichkeit(e) { return schreiben(SPEICHER.effort, String(e || '')); }
  function schluesselAnzeige(k) {
    var s = String(k || '');
    return s.length >= 4 ? '…' + s.slice(-4) : (s ? '…' : '');
  }

  /* Den Schlüssel aus jedem Text tilgen, auch Teilstücke ab 8 Zeichen. */
  function entschaerfe(text, schluessel) {
    var t = String(text === undefined || text === null ? '' : text);
    var k = String(schluessel || '');
    if (k.length >= 8) {
      t = t.split(k).join('[Schlüssel]');
      // Mittelteil (falls ein Text den Schlüssel gekürzt wiederholt)
      var mitte = k.slice(4, -4);
      if (mitte.length >= 8) t = t.split(mitte).join('[…]');
    }
    t = t.replace(/sk-ant-[A-Za-z0-9_\-]{6,}/g, '[Schlüssel]');
    return t;
  }

  /* ---------- Anfrage ---------- */
  function baueAnfrage(a) {
    var P = a.prompt || prompt();
    return {
      model: a.modell,
      max_tokens: MAX_TOKENS,
      system: P.TEXT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: a.mediaType || 'image/jpeg', data: a.bildBase64 } },
          { type: 'text', text: P.NUTZER_TEXT }
        ]
      }],
      output_config: {
        effort: a.effort || P.GRUENDLICHKEIT_VORGABE,
        format: { type: 'json_schema', schema: P.SCHEMA }
      }
    };
  }

  function fehler(art, meldung, extra) {
    var e = new Error(meldung);
    e.art = art; e.meldung = meldung;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  /* HTTP-Fehler der API einordnen. body = { type: 'error', error: { type, message } } */
  function ordneEin(status, body, modell, retryAfter) {
    var typ = body && body.error && body.error.type || '';
    var roh = body && body.error && body.error.message || '';
    var zusatz = ' [' + status + (typ ? ' ' + typ : '') + ']' + (roh ? ' — ' + roh : '');
    if (status === 401) return fehler('schluessel', 'Schlüssel ungültig oder widerrufen — unter ⚙ Gerät neu eingeben.' + zusatz, { status: status });
    if (status === 403) return fehler('berechtigung', 'Der Schlüssel darf das nicht (Workspace, Berechtigung?).' + zusatz, { status: status });
    if (status === 404 || (status === 400 && /model/i.test(roh))) return fehler('modell', 'Modell „' + modell + '“ ist nicht bekannt oder nicht freigeschaltet — unter ⚙ Gerät prüfen.' + zusatz, { status: status });
    if (status === 413) return fehler('zu_gross', 'Das Foto ist für die Anfrage zu groß.' + zusatz, { status: status });
    if (status === 429) return fehler('limit', 'Limit erreicht (Ausgabenlimit des Workspace oder zu viele Anfragen)' + (retryAfter ? ', wieder möglich in ' + retryAfter + ' s' : '') + '.' + zusatz, { status: status, retryAfter: retryAfter });
    if (status === 529) return fehler('ueberlastet', 'Anthropic ist gerade überlastet — gleich nochmal versuchen.' + zusatz, { status: status, retryAfter: retryAfter });
    if (status >= 500) return fehler('stoerung', 'Störung bei Anthropic — gleich nochmal versuchen.' + zusatz, { status: status, retryAfter: retryAfter });
    if (status === 400) return fehler('anfrage', 'Die Anfrage wurde abgelehnt.' + zusatz, { status: status });
    return fehler('fehler', 'Unerwartete Antwort von Anthropic.' + zusatz, { status: status });
  }

  /* ---------- Antwort selbst nachprüfen (B1) ---------- */
  function typOk(wert, typen) {
    return typen.some(function (t) {
      if (t === 'null') return wert === null;
      if (t === 'integer') return typeof wert === 'number' && Math.floor(wert) === wert;
      if (t === 'array') return Array.isArray(wert);
      if (t === 'object') return !!wert && typeof wert === 'object' && !Array.isArray(wert);
      return typeof wert === t;
    });
  }
  function pruefeGegen(schema, wert, pfad, probleme) {
    if (schema.anyOf) {
      var eins = schema.anyOf.some(function (s) { var p = []; pruefeGegen(s, wert, pfad, p); return !p.length; });
      if (!eins) probleme.push(pfad + ': passt zu keiner erlaubten Form');
      return;
    }
    var typen = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!typOk(wert, typen)) { probleme.push(pfad + ': falscher Typ (' + (wert === null ? 'null' : Array.isArray(wert) ? 'Liste' : typeof wert) + ')'); return; }
    if (schema.enum && schema.enum.indexOf(wert) === -1) probleme.push(pfad + ': unbekannter Wert „' + wert + '“');
    if (wert && typeof wert === 'object' && !Array.isArray(wert) && schema.properties) {
      (schema.required || []).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(wert, k)) probleme.push(pfad + '.' + k + ': fehlt'); });
      Object.keys(wert).forEach(function (k) {
        if (!schema.properties[k]) { probleme.push(pfad + '.' + k + ': nicht vorgesehen'); return; }
        pruefeGegen(schema.properties[k], wert[k], pfad + '.' + k, probleme);
      });
    }
    if (Array.isArray(wert) && schema.items) wert.forEach(function (x, i) { pruefeGegen(schema.items, x, pfad + '[' + i + ']', probleme); });
  }
  function pruefeAntwort(daten, schema) {
    var probleme = [];
    pruefeGegen(schema || prompt().SCHEMA, daten, 'antwort', probleme);
    return probleme;
  }

  function kosten(usage, modell, preise) {
    var P = preise || (prompt() && prompt().PREISE) || {};
    var p = P[modell];
    if (!usage || !p) return null;
    var ein = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    var aus = usage.output_tokens || 0;
    return { dollar: ein / 1e6 * p.ein + aus / 1e6 * p.aus, ca: !!p.ca, stand: P.stand || null, eingabe: ein, ausgabe: aus };
  }

  function warte(ms) { return new Promise(function (ja) { setTimeout(ja, ms); }); }

  /* Eine Seite lesen. a = { schluessel, modell, effort, bildBase64, mediaType,
     prompt?, fetch? (für Prüfungen), zeitlimitMs? }.
     Ergebnis: { daten, usage, modell, stopReason, dauerMs, versuche }.
     Wirft Error mit .art und .meldung — der Schlüssel steht nie darin. */
  function lies(a) {
    var abrufen = a.fetch || (wurzel.fetch && wurzel.fetch.bind(wurzel));
    var P = a.prompt || prompt();
    var start = Date.now();
    if (!a.schluessel) return Promise.reject(fehler('kein_schluessel', 'Auf diesem Gerät ist kein Schlüssel hinterlegt — unter ⚙ Gerät eintragen.'));
    if (!abrufen) return Promise.reject(fehler('fehler', 'Dieser Browser kann keine Anfragen senden (fetch fehlt).'));
    var body = JSON.stringify(baueAnfrage({ prompt: P, modell: a.modell, effort: a.effort, bildBase64: a.bildBase64, mediaType: a.mediaType }));

    function einmal() {
      var steuer = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var uhr = setTimeout(function () { if (steuer) steuer.abort(); }, a.zeitlimitMs || ZEITLIMIT_MS);
      return Promise.resolve().then(function () {
        return abrufen(ADRESSE, {
          method: 'POST',
          headers: {
            'x-api-key': a.schluessel,
            'anthropic-version': VERSION,
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
          },
          body: body,
          signal: steuer ? steuer.signal : undefined
        });
      }).then(function (antwort) {
        clearTimeout(uhr);
        return antwort.text().then(function (text) {
          var json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
          if (!antwort.ok) {
            var ra = antwort.headers && antwort.headers.get ? Number(antwort.headers.get('retry-after')) : NaN;
            throw ordneEin(antwort.status, json, a.modell, Number.isFinite(ra) && ra > 0 ? ra : null);
          }
          if (!json) throw fehler('kein_json', 'Antwort von Anthropic ist kein lesbares JSON.');
          return json;
        });
      }, function (err) {
        clearTimeout(uhr);
        if (err && err.name === 'AbortError') throw fehler('zeitlimit', 'Keine Antwort nach ' + Math.round((a.zeitlimitMs || ZEITLIMIT_MS) / 1000) + ' s — Netz langsam oder Anthropic überlastet. Nochmal versuchen.');
        throw fehler('kein_netz', 'Keine Verbindung zu Anthropic (Netz weg oder Adresse blockiert).' + (err && err.message ? ' — ' + err.message : ''));
      });
    }

    var versuche = 0;
    function mitZweitemVersuch() {
      versuche++;
      return einmal().catch(function (err) {
        if (versuche === 1 && (err.art === 'limit' || err.art === 'ueberlastet')) {
          var ms = Math.min(WARTEN_MAX_MS, (err.retryAfter ? err.retryAfter * 1000 : 5000));
          if (err.art === 'limit' && err.retryAfter && err.retryAfter * 1000 > WARTEN_MAX_MS) throw err;   // zu lange — Ulf entscheidet
          return warte(ms).then(mitZweitemVersuch);
        }
        throw err;
      });
    }

    return mitZweitemVersuch().then(function (json) {
      var stop = json.stop_reason;
      if (stop === 'max_tokens') throw fehler('abgeschnitten', 'Die Antwort wurde abgeschnitten (zu lang). Gründlichkeit niedriger stellen oder die Seite neu fotografieren.', { usage: json.usage });
      if (stop === 'refusal') throw fehler('abgelehnt', 'Das Modell hat die Antwort abgelehnt.', { usage: json.usage });
      var textBlock = (json.content || []).filter(function (b) { return b && b.type === 'text'; }).pop();
      if (!textBlock) throw fehler('kein_text', 'Die Antwort enthält keinen Text-Block (stop_reason: ' + stop + ').', { usage: json.usage });
      var daten;
      try { daten = JSON.parse(textBlock.text); }
      catch (e) { throw fehler('kein_json', 'Die Antwort ist kein gültiges JSON: ' + e.message, { usage: json.usage }); }
      var probleme = pruefeAntwort(daten, P.SCHEMA);
      if (probleme.length) throw fehler('schema', 'Die Antwort passt nicht zum Schema: ' + probleme.slice(0, 3).join('; ') + (probleme.length > 3 ? ' (+' + (probleme.length - 3) + ')' : ''), { usage: json.usage });
      return { daten: daten, usage: json.usage || null, modell: json.model || a.modell, stopReason: stop, dauerMs: Date.now() - start, versuche: versuche };
    }).catch(function (err) {
      // doppelte Sicherung: kein Schlüssel in Meldungen
      var e = err && err.art ? err : fehler('fehler', String(err && err.message || err));
      e.message = entschaerfe(e.message, a.schluessel);
      e.meldung = entschaerfe(e.meldung, a.schluessel);
      throw e;
    });
  }

  /* Aufgaben (Funktionen, die ein Promise liefern) mit höchstens n zugleich.
     Liefert für jede Aufgabe { ok, wert | fehler } in der Reihenfolge der Liste. */
  function nacheinander(aufgaben, n) {
    var max = n || GLEICHZEITIG;
    var ergebnisse = new Array(aufgaben.length);
    var naechste = 0;
    function arbeiter() {
      if (naechste >= aufgaben.length) return Promise.resolve();
      var i = naechste++;
      return Promise.resolve().then(aufgaben[i]).then(
        function (w) { ergebnisse[i] = { ok: true, wert: w }; },
        function (f) { ergebnisse[i] = { ok: false, fehler: f }; }
      ).then(arbeiter);
    }
    var laeufer = [];
    for (var k = 0; k < Math.min(max, aufgaben.length); k++) laeufer.push(arbeiter());
    return Promise.all(laeufer).then(function () { return ergebnisse; });
  }

  var API = {
    ADRESSE: ADRESSE, VERSION: VERSION, ZEITLIMIT_MS: ZEITLIMIT_MS, GLEICHZEITIG: GLEICHZEITIG, MAX_TOKENS: MAX_TOKENS, SPEICHER: SPEICHER,
    geraet: geraet, setzeSchluessel: setzeSchluessel, loescheSchluessel: loescheSchluessel,
    setzeModell: setzeModell, setzeGruendlichkeit: setzeGruendlichkeit, schluesselAnzeige: schluesselAnzeige,
    entschaerfe: entschaerfe, baueAnfrage: baueAnfrage, ordneEin: ordneEin, pruefeAntwort: pruefeAntwort,
    kosten: kosten, lies: lies, nacheinander: nacheinander
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else wurzel.BOS_BACKZETTEL_API = API;
})(typeof window !== 'undefined' ? window : globalThis);
