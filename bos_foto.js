/* ================================================================
   BäckereiOS · bos_foto.js — Fotos am Gerät verkleinern, eine Mechanik
   ================================================================
   Stellt bereit: window.BOS_FOTO

   Einbindung (Root-Datei, keine Abhängigkeiten):
     <script src="../bos_foto.js"></script>

   HERKUNFT (Freigabe Backzettel B6, Weg A): verkleinern(), bildLesen(),
   zuBlob() und fehler() sind aus bos_meldungen.js (Reparaturanfrage,
   Fassung im Paket 19.10.2026, Z. 149–156 und 722–785) KOPIERT, nicht
   nachgebaut. Geändert nur: Die Einstellungen kommen als Parameter statt
   aus der festen Tabelle FOTO, und die Maße laufen über masse(), das
   wahlweise eine Kachelgrenze beachtet (Backzettel: Bildgrenze der
   Claude-Modelle). Ohne e.kacheln sind die Maße byte-gleich zur Quelle
   (geprüft in backzettel/_PRUEF_backzettel.js, Teil F).
   BIS ZUR UMSTELLUNG DER REPARATURANFRAGE GIBT ES DIESE MECHANIK ZWEIMAL
   (neue Baustelle ohne Nummer, an den Buchhalter): Wer hier einen Fehler
   behebt, behebt ihn in bos_meldungen.js auch — und umgekehrt.

   Aufruf:
     BOS_FOTO.verkleinern(datei, e) → Promise<{ blob, breite, hoehe,
        qualitaet, bytes, versuche[, ueberRichtwert] }>
     e = { kanten: [px, …]   lange Kante je Stufe (erste zuerst)
           ziel: Bytes       Richtwert; wird er überschritten, erst Qualität
                             senken (qStart → qMin in qSchritt), dann nächste Stufe
           qStart, qMin, qSchritt
           regelMax: Bytes   harte Obergrenze für die kleinste Stufe
           kacheln, kachelPx (wahlweise) höchstens so viele Kacheln à
                             kachelPx × kachelPx — Backzettel: 4784 à 28 px }
     BOS_FOTO.masse(breite, hoehe, kante, e) → { breite, hoehe }   (rein, prüfbar)
     BOS_FOTO.alsBase64(blob) → Promise<string>  (ohne „data:…;base64,“)

   Fehler: Error mit .art ('ungueltig' | 'foto_lesen'), .meldung, .original.

   CHANGELOG
     2026-10-19 · 17:32 · v1 · Neu (Backzettel-Erfassung Stufe 1, B6)
       SESSION_2026-10-19_BACKZETTEL_STUFE1_BAU.md, Freigabe KC 09:47.
   ================================================================ */
window.BOS_FOTO = (function () {
  'use strict';

  /* ---------------- Fehler (Kopie aus bos_meldungen.js) ---------------- */
  function fehler(art, meldung, original, extra) {
    var e = new Error(meldung);
    e.art = art;
    e.meldung = meldung;
    e.original = original ? (original.code ? original.code + ' — ' : '') + (original.message || String(original)) : '';
    if (original && original.code) e.code = original.code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  /* Maße einer Stufe. Ohne e.kacheln genau die Rechnung der Quelle
     (s = min(1, kante / lange Seite), gerundet). Mit e.kacheln wird so lange
     um 0,5 % verkleinert, bis ⌈b/px⌉ × ⌈h/px⌉ ≤ kacheln (Doku „Vision“:
     ein Bild kostet ⌈Breite/28⌉ × ⌈Höhe/28⌉ Bildkacheln). */
  function masse(b, h, kante, e) {
    var s = Math.min(1, kante / Math.max(b, h));
    var bb = Math.max(1, Math.round(b * s)), hh = Math.max(1, Math.round(h * s));
    if (e && e.kacheln) {
      var px = e.kachelPx || 28;
      while (s > 0.01 && Math.ceil(bb / px) * Math.ceil(hh / px) > e.kacheln) {
        s *= 0.995;
        bb = Math.max(1, Math.round(b * s)); hh = Math.max(1, Math.round(h * s));
      }
    }
    return { breite: bb, hoehe: hh };
  }

  /* ---------------- Kopie aus bos_meldungen.js Z. 722–785 ---------------- */
  function bildLesen(datei) {
    return createImageBitmap(datei, { imageOrientation: 'from-image' }).catch(function (err) {
      // Ältere Browser kennen die Option nicht (TypeError) — Chrome dreht seit
      // Fassung 81 ohnehin nach den Kameradaten.
      if (err && err.name === 'TypeError') return createImageBitmap(datei);
      throw err;
    });
  }
  function zuBlob(c, q) {
    return new Promise(function (ja, nein) {
      c.toBlob(function (b) { if (b) ja(b); else nein(new Error('canvas.toBlob lieferte nichts')); }, 'image/jpeg', q);
    });
  }
  function verkleinern(datei, e) {
    e = e || {};
    return Promise.resolve().then(function () {
      if (!datei) throw fehler('ungueltig', 'Kein Foto gewählt.');
      if (datei.type && !/^image\//.test(datei.type)) throw fehler('ungueltig', 'Das ist kein Foto (' + datei.type + ').');
      if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
        throw fehler('foto_lesen', 'Dieses Gerät kann Fotos nicht verkleinern (createImageBitmap fehlt) — bitte ohne Foto senden.');
      }
      return bildLesen(datei).catch(function (err) {
        throw fehler('foto_lesen', 'Das Foto lässt sich nicht lesen (' + (datei.type || 'unbekannte Art') +
          '). Fotos im HEIC-Format (iPhone) gehen im Browser oft nicht — in den Kamera-Einstellungen „Maximale Kompatibilität“ wählen.', err);
      });
    }).then(function (bmp) {
      var versuche = [];
      function malen(quelle, b, h, kante) {
        var m = masse(b, h, kante, e);   // ohne e.kacheln byte-gleich zur Quelle
        var c = document.createElement('canvas');
        c.width = m.breite;
        c.height = m.hoehe;
        var g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';   // Schilder und Risse bleiben lesbar
        g.drawImage(quelle, 0, 0, c.width, c.height);
        return c;
      }
      // Das volle Handyfoto (12–50 MP) nur EINMAL im Speicher: gleich auf
      // die größte Stufe zeichnen und freigeben; kleinere Stufen entstehen
      // aus dieser Zeichenfläche (alte Handys, Gegenprüfung 12.10.).
      var gross = malen(bmp, bmp.width, bmp.height, e.kanten[0]);
      try { bmp.close(); } catch (e) { /* egal */ }
      function stufe(ki) {
        var c = ki === 0 ? gross : malen(gross, gross.width, gross.height, e.kanten[ki]);
        function versuch(q) {
          return zuBlob(c, q).then(function (blob) {
            versuche.push({ kante: e.kanten[ki], q: Math.round(q * 100) / 100, bytes: blob.size });
            if (blob.size <= e.ziel) return { blob: blob, breite: c.width, hoehe: c.height, qualitaet: q };
            if (q - e.qSchritt >= e.qMin - 1e-9) return versuch(q - e.qSchritt);
            if (ki + 1 < e.kanten.length) return stufe(ki + 1);
            // Kleinste Stufe noch über dem Richtwert: nehmen, solange die Regel es erlaubt.
            if (blob.size <= e.regelMax) return { blob: blob, breite: c.width, hoehe: c.height, qualitaet: q, ueberRichtwert: true };
            throw fehler('foto_lesen', 'Das Foto bleibt auch verkleinert zu groß (' + Math.round(blob.size / 1024) + ' KB).');
          });
        }
        return versuch(e.qStart);
      }
      return stufe(0).then(function (r) {
        r.versuche = versuche; r.bytes = r.blob.size;
        return r;
      });
    });
  }


  function alsBase64(blob) {
    return new Promise(function (ja, nein) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result || ''); ja(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { nein(fehler('foto_lesen', 'Das verkleinerte Foto lässt sich nicht umwandeln.', r.error)); };
      r.readAsDataURL(blob);
    });
  }

  return { verkleinern: verkleinern, masse: masse, alsBase64: alsBase64 };
})();
