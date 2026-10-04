/**
 * bos_hamster.js
 * ------------------------------------------------------------
 * Zentrale Host-Funktion für die Hamster-Berechnung: wie stark wird
 * der Bedarf eines Produkts an einem Tag erhöht, wenn für diesen Tag
 * eine Hamster-Stufe (1-3) gesetzt ist.
 *
 * ERSETZT ZWEI WIDERSPRÜCHLICHE ALTSYSTEM-DATEIEN (Fundament §6,
 * Bekannte Bugs — am 29.08.2026 live bestätigt anhand der echten
 * Dateien):
 *   - hamster_gehirn.js:  berechne(level, need, satNeed, bos),
 *                         icon(level) — level als Zahl 1-3
 *   - hamster_logik.js:   berechne(stufe, needs, bosIdx),
 *                         label(stufe) — stufe als String 'hamster_2',
 *                         kompletter needs-Array statt Einzelwert,
 *                         UND fehlender Modus 'faktor_samstag' — mit
 *                         der echten hamster_config.json (Stufe 3 =
 *                         faktor_samstag) hätte diese Datei bei Stufe 3
 *                         still falsch gerechnet (Fallback auf
 *                         unveränderten Bedarf, siehe default-Zweig).
 * Diese Datei hier ist die einzige, für V2 gültige Version — an
 * hamster_gehirn.js angelehnt (deren Modi zur echten Config passen),
 * mit Icon-Funktion und Signatur bewusst beibehalten.
 *
 * WICHTIG — WAS HAMSTER NICHT IST (Korrektur einer eigenen Fehlannahme
 * vom 29.08.2026, siehe SESSION_2026-08-29_HAMSTER_KONZEPT.md): Hamster
 * ist KEINE aus dem Kalender automatisch abgeleitete Größe und hat mit
 * Ferien nichts zu tun. Es ist eine manuelle Tages-Zuweisung (Stufe
 * 0-3), die ein Mensch setzt — typischerweise für den/die Tag(e) vor
 * einem Feiertag, weil Kunden dann vorher mehr einkaufen. WO diese
 * Zuweisung pro Tag herkommt, regelt bos_zeitkontext.js (Firestore >
 * localStorage > Stufe 0 als Boden) — diese Datei hier weiß nichts von
 * Tagen oder Kalendern, sie rechnet nur: gegeben eine Stufe und die
 * Bedarfszahlen eines Produkts, was ist der angepasste Bedarf.
 *
 * EINE HOST-FUNKTION, EIN AUFRUFER-VERTRAG: berechne() nimmt bewusst
 * einzelne Zahlen entgegen (normaler Bedarf des Tages + Samstags-
 * Bedarf), nicht den ganzen needs-Array wie hamster_logik.js — der
 * Aufrufer (künftig die Produktionskette) weiß bereits, welcher
 * Wochentag gerade gerechnet wird, und kann die passenden Werte aus
 * seinem eigenen needs-Array selbst herausgreifen. Das hält diese
 * Datei von der genauen Struktur des needs-Arrays unabhängig.
 *
 * KONFIGURATION: bos_hamster_config.json (Root-Ebene, ein Schreiber,
 * daher Datei statt Firestore — analog produkt_config.json). Definiert
 * je Stufe Bezeichnung, Emoji, Rechenmodus und ggf. Faktoren. init()
 * MUSS vor icon()/berechne() abgeschlossen sein (await), sonst greift
 * der eingebaute Fallback (siehe FALLBACK unten, identisch zur echten
 * hamster_config.json vom 29.08.2026).
 *
 * MODI (identisch zur echten Config, siehe hamster_config_editor.html):
 *   mittelwert_samstag  →  ceil((satNeed + need) / 2)
 *   samstag              →  satNeed
 *   faktor                →  bos===5 ? satNeed*faktor_samstag : need*faktor_normal
 *   faktor_samstag        →  satNeed * faktor  (garantiert mehr als Stufe "samstag")
 *
 * Einbindung (Unterordner-Satellit):
 *   <script src="../bos_hamster.js"></script>
 * Root nutzt ./bos_hamster.js, Unterordner-Satelliten ../.
 *
 * VERDRAHTET (seit 03.09.2026): `bos_produktionskette.js` ruft diese Datei
 * pro Tag über `berechne()`/`verbrauchAn()` auf, sobald `tagesTypen[i]`
 * einen `hamster_N`-Wert liefert (Produktionsplaner-Stationsseiten sind
 * der erste echte Aufrufer). Bis dahin war diese Datei eigenständig
 * lauffähig und getestet (Testfälle vom 29.08.2026), aber unverdrahtet.
 *
 * ÄNDERUNGSPROTOKOLL:
 * 29.08.2026 — Erstversion, ersetzt die zwei Altsystem-Dateien.
 * 03.09.2026 — Fix: init() nutzte document.currentScript?.src zum
 *              Aufrufzeitpunkt, das ist bei externem Aufruf (nach dem
 *              eigenen Laden, insb. aus einem Event-Handler) immer leer
 *              oder zeigt auf den Aufrufer, nie auf diese Datei — löste
 *              die Basis-URL für Aufrufer außerhalb des Root-Ordners
 *              falsch auf. Bisher folgenlos (Catch-Fallback entspricht
 *              exakt der echten Config), jetzt korrekt über eine beim
 *              eigenen Laden gemerkte Script-URL gelöst. Erster echter
 *              externer Aufruf: Produktionsplaner-Stationsseiten.
 * ------------------------------------------------------------
 */

window.BOS_HAMSTER = (function () {

  // Eigene Script-URL JETZT merken (während dieser Datei selbst synchron
  // ausgeführt wird, ist document.currentScript korrekt gesetzt). init()
  // wird aber immer von AUSSEN aufgerufen, meist deutlich später (z.B. aus
  // einem window.addEventListener('load', ...)) — zu dem Zeitpunkt zeigt
  // document.currentScript entweder auf den aufrufenden Script-Tag oder
  // (aus einem Event-Handler heraus) auf gar nichts (null), nie mehr auf
  // diese Datei selbst. Ohne dieses Vor-Merken hätte init() für jeden
  // Aufrufer außerhalb des Root-Ordners (z.B. produktionsplaner/*.html)
  // die falsche Basis-URL berechnet und wäre über den Catch-Fallback still
  // auf FALLBACK zurückgefallen — bisher folgenlos, weil FALLBACK exakt
  // der echten Config entspricht, aber technisch trotzdem kaputt (Fund
  // 03.09.2026, beim ersten echten Abgleich mit der echten Config-Datei).
  const _eigeneScriptUrl = document.currentScript ? document.currentScript.src : location.href;

  let _config = null;

  // Fallback, falls bos_hamster_config.json nicht geladen werden kann —
  // identisch zur echten, von Ulf bereitgestellten Config vom 29.08.2026.
  const FALLBACK = {
    stufen: {
      hamster_1: { bezeichnung: 'Leicht erhöht',  emoji: '🐹',       modus: 'mittelwert_samstag' },
      hamster_2: { bezeichnung: 'Samstag-Niveau', emoji: '🐹🐹',     modus: 'samstag' },
      hamster_3: { bezeichnung: 'Maximal',        emoji: '🐹🐹🐹',   modus: 'faktor_samstag', faktor: 1.5 }
    }
  };

  /**
   * Lädt bos_hamster_config.json. Sollte vor berechne()/icon()
   * abgeschlossen sein (await) — schlägt die Ladung fehl, greift der
   * Fallback automatisch, kein Absturz.
   * @returns {Promise<void>}
   */
  function init() {
    return fetch(new URL('bos_hamster_config.json', _eigeneScriptUrl).href, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) { _config = cfg; })
      .catch(function () { _config = FALLBACK; });
  }

  /**
   * Gibt das Emoji für eine Hamster-Stufe zurück.
   * @param {number} level 1|2|3
   * @returns {string}
   */
  function icon(level) {
    const cfg = _config || FALLBACK;
    const s = cfg.stufen && cfg.stufen['hamster_' + level];
    if (s && s.emoji) return s.emoji;
    return FALLBACK.stufen['hamster_' + level]
      ? FALLBACK.stufen['hamster_' + level].emoji
      : '🐹';
  }

  /**
   * Berechnet den angepassten Bedarf für einen Hamster-Tag.
   *
   * @param {number} level    Hamster-Stufe 1|2|3 (Stufe 0 = kein Hamster,
   *                          diese Funktion für Stufe 0 gar nicht erst
   *                          aufrufen — der Aufrufer prüft das vorher)
   * @param {number} need     normaler Bedarf des Produkts an diesem Tag
   * @param {number} satNeed  Samstags-Bedarf desselben Produkts
   * @param {number} bos      BOS-Wochentag-Index, 0=Mo … 6=So (nur für
   *                          Modus 'faktor' relevant, um zwischen
   *                          faktor_normal/faktor_samstag zu wählen)
   * @returns {number}        angepasster Bedarf, ganzzahlig aufgerundet
   */
  function berechne(level, need, satNeed, bos) {
    const cfg = _config || FALLBACK;
    const s = cfg.stufen && cfg.stufen['hamster_' + level];

    if (!s) {
      // Unbekannte Stufe (z. B. 0 versehentlich hier reingereicht) —
      // unveränderten Bedarf zurückgeben statt zu raten.
      return need;
    }

    switch (s.modus) {
      case 'mittelwert_samstag':
        return Math.ceil((satNeed + need) / 2);

      case 'samstag':
        return satNeed;

      case 'faktor': {
        const f = bos === 5
          ? (parseFloat(s.faktor_samstag) || 1.5)
          : (parseFloat(s.faktor_normal) || 2.0);
        return Math.ceil(need * f);
      }

      case 'faktor_samstag':
        return Math.ceil(satNeed * (parseFloat(s.faktor) || 1.5));

      default:
        return need;
    }
  }

  return { init: init, icon: icon, berechne: berechne };

}());
