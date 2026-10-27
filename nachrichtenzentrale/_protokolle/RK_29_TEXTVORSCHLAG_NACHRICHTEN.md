# RK §29 · Textvorschlag für `REGELN_KOMPENDIUM.md` (schreibt der Kontroll-Chat)

**Von:** Bau-Chat Nachrichtenzentrale Stufe 1b (#131), 26.10.2026, 23:43 Uhr MEZ (Zeitabfrage)
**Einordnen:** als neuer Abschnitt nach RK §28. Dazu bei RK §13 die Fassung `nachrichten-2026-10-27` nachtragen (Rückfall: `nachrichten-flach-2026-10-27`).

---

## RK §29 nachrichten_adressbuch, nachrichten_vorlagen, nachrichten_status, nachrichten, nachrichten/{id}/antworten — Nachrichtenzentrale Stufe 1b (neu 27.10.2026)

**Regeldatei:** `firestore_regeln_2026-10-27_nachrichten.rules`, **47.470 Zeichen** (Python `len()`; 47.520 Byte, MD5 `e471bd81…`), **eine Datei**.

Sie entsteht aus der eingesetzten Datei `firestore_regeln_2026-10-24_maschinen_b.rules` (41.021 Zeichen) durch genau drei Änderungen:
1. **Kopfzeile:** „Stand 27.10.2026 (Nachrichtenzentrale Stufe 1b; Rückweg: firestore_regeln_2026-10-24_maschinen_b.rules). Begründungen: …“
2. **`bos_regelstand`:** Fassung `nachrichten-2026-10-27` angehängt.
3. **Neuer Block** (107 Zeilen) **ganz am Ende**, hinter `meldungen`, vor den zwei schließenden Klammern: Hilfsfunktionen `nzKonto`, `nzHaken`, `nzEmpfaenger`, `nz`, `nzKopf`, `nzGesperrt`, `nzLeser`, `nzName`, `nzLeitung`, `nzKopfGleich`, `nzNormal`, `nzBekanntmachung`, `nzKorrektur`, `nzDaumenDazu`, `nzDaumenWeg`; vier `match`-Blöcke plus Unter-Sammlung `antworten`.

Sonst ist die Datei Zeichen für Zeichen gleich der eingesetzten Regel (geprüft in `_PRUEF_nachrichten_werkzeuge/test_nachrichten_regel.js` Teil A). **Nicht gekürzt, nichts umformuliert.** Kein `?:`, kein `liste[i:j]`, kein Karten-Literal, kein `let`; `diff().affectedKeys()` wie in RK §8/§20 (dort seit 26.09./10.10. im Einsatz).

**Rückweg:** `firestore_regeln_2026-10-24_maschinen_b.rules`. Dann sind alle fünf Sammlungen zu (keine Regel = abgelehnt); die Kontenverwaltung zeigt im Reiter „Gruppen“ den Grund (`permission-denied`), Konten bleiben bedienbar.

**Rückfall (flache Listen), Auflage A5:** `RUECKFALL_FLACH_firestore_regeln_2026-10-27_nachrichten.rules`, **47.381 Zeichen** (MD5 `b149f457…`), Fassung `nachrichten-flach-2026-10-27`. Gleiche Datei; nur drei Stellen anders: Daumen dazu = `neu == alt.concat([kennung()])` (nur anhängen), Daumen weg = `alt == neu.concat([kennung()])` (nur der letzte), Kritik ohne Bekanntmachungs-Haken = `d().empfaenger == nzLeitung()` (genau die Leitungsliste). Nur einsetzen, wenn Fall V in der Hauptform einen erlaubten Listen-Weg als GESPERRT meldet (B15). Die Prüfseite erkennt beide Fassungen.

**Anlass [Ulf 25./26.10.2026, Ideen-Doku E1–E32; Kontroll-Chat K1–K11, T1–T7; Anweisung 1b 22:54; Bauplan 23:05, Go 23:12 mit A1–A5; U1–U4 Ulf 23:00–23:22]:** Ein Postfach für Dienstliches. Stufe 1b legt das Schloss für alles, was 1b und 1c brauchen, in **einer** Regel an, damit Ulf sie nur einmal einsetzt.

**Bausteine:**
- `nzKonto()`, `nzHaken(feld)`: Muster `reparaturHaken()` — Haken aus `bos_accounts/<kennung>` über `hatKonto()`; Weggang (`freigeschaltet: false`) schließt auch bei stehendem Haken.
- `nzEmpfaenger()`: Personen-Konto (`art == 'person'`) **oder** Ort-Konto mit `nachrichtenEmpfangen` (Filiale, U2). Arbeitsstationen ohne Haken sind keine Empfänger — sie dürfen weder antworten noch Daumen geben.
- `nzLeser(k)`: Absender, **oder** `typ == 'bekanntmachung'` (für jedes Konto, auch spätere — U1), **oder** `kennung() in empfaenger` (`get('empfaenger', [])`, weil Bekanntmachungen das Feld nicht tragen).
- `nzLeitung()`: `nachrichten_vorlagen/leitung.kennungen` — **ein** `get` (T6).
- `nzKorrektur(neuId)`: ohne Feld `ersetzt` immer wahr; sonst muss die alte Nachricht vom selben Absender, nicht gesperrt und vom selben Typ sein, und **im selben Batch** `ersetztDurch == neuId` bekommen (`getAfter`, Muster RK §20). `get` statt `exists` + `get` (RK §2, K-b).
- `nzDaumenDazu/Weg(alt, neu)`: Größe ± 1 und Teilmenge in beide Richtungen (`hasAll`) — genau ein Eintrag kommt dazu oder geht weg, und es ist der eigene; Doppelte unmöglich.

**`nachrichten_adressbuch/{k}`** (das Schild, T2): lesen `istAdmin() || hatKonto()`; anlegen/löschen `istAdmin()` (Kontenverwaltung, Abgleich); ändern `istAdmin()` **oder** Besitzer (`k == kennung()`) nur `beschreibung` (≤ 40, K1/K6; Admin darf leeren).
**`nachrichten_vorlagen/{id}`** (T7): lesen `istAdmin() || hatKonto()`; schreiben `istAdmin()`.
**`nachrichten_status/{k}`** (T4, privat): lesen/löschen `istAdmin()` (Ventil, RK §3) oder eigenes Konto mit `hatKonto()`; anlegen/ändern eigenes Konto, genau die Felder `gelesen`, `ausgeblendet`, beide Maps.
**`nachrichten/{id}`:**
- **Lesen:** `istAdmin()` oder `hatKonto() && nzLeser()`. Abfragen in 1c müssen dazu passen: `where('empfaenger','array-contains', ich)`, `where('von','==', ich)`, `where('typ','==','bekanntmachung')` — je mit `orderBy('erstellt')` ein zusammengesetzter Index.
- **Anlegen:** `nzHaken('nachrichtenSchreiben')`, `von == kennung()`, `vonName` ≤ 40, `text` 1–2000, `erstellt == request.time`, dann je Typ:
  - `nachricht | info | lob | kritik`: Felder `von, vonName, typ, empfaenger, text, erstellt, fristStart, daumen` (+ optional `ersetzt`), `empfaenger` 1–100, `fristStart == request.time`, `daumen == []`. **Kritik** ohne Bekanntmachungs-Haken nur, wenn `nzLeitung().hasAll(empfaenger)` (jede Empfängerin steht auf der Leitungsliste; E30/E32, K5, T6).
  - `bekanntmachung`: zusätzlich `nzHaken('nachrichtenBekanntmachung')`, Felder `von, vonName, typ, text, erstellt, giltBis` (+ `ersetzt`), `giltBis` `JJJJ-MM-TT`; **kein** `empfaenger` (U1), **kein** `fristStart` (angepinnt, RK §28-Muster), **kein** `daumen` (E17).
  - mit `ersetzt`: `nzKorrektur(id)`.
- **Ändern — genau drei Wege, sonst nichts:** (1) **Daumen:** Empfänger (`nzEmpfaenger() && kennung() in empfaenger`), keine Bekanntmachung, nicht gesperrt, nur `daumen` geändert, dazu oder weg. Der Absender hebt nicht den Daumen für sich (K-a). (2) **Sperren per Korrektur:** Absender, noch nicht gesperrt, nur `ersetztDurch`, und die neue Nachricht entsteht im selben Batch mit `ersetzt == id` und demselben Absender (`getAfter`, T5). (3) **Bekanntmachung lösen:** `typ == 'bekanntmachung'`, noch ohne `fristStart`, nur `fristStart == request.time`, durch den Verfasser **oder** `istPlanung()` (U3: Produktionsleitung und Admin dürfen jeden Aushang abnehmen).
- **Löschen:** nie (TTL räumt).
**`nachrichten/{id}/antworten/{a}`** (E29, U4): lesen `istAdmin()` oder Absender des Kopfes oder Verfasser der Antwort oder Adressat (`an == kennung()`); anlegen `nzEmpfaenger()`, Leser des Kopfes, Kopf nicht gesperrt und keine Bekanntmachung (E17), Felder genau `von, vonName, an, text, ts, fristStart`, `von == kennung()`, `an != kennung()`, **entweder** Absender antwortet an einen Empfänger (`an in empfaenger`) **oder** Empfänger antwortet dem Absender (`an == Kopf.von`), `text` 1–1000, `ts == fristStart == request.time`; ändern/löschen nie (E18). So bleibt jedes Gespräch unter vier Augen; eine Gruppendiskussion gibt es nicht.

**Zugriffe je Vorgang** (gezählt, `test_nachrichten_regel.js` Teil C; `get` und `getAfter` auf dasselbe Dokument konservativ getrennt): lesen 1 · anlegen 1 · Kritik 2 · Korrektur-Batch 4 + 2 = 6 (Grenze 10 je Dokument, 20 je Batch) · Daumen 1 · Lösen 1 · Antwort anlegen 2 · Antworten lesen 2 · Status/Beschreibung 1 · Generalschlüssel (Kontenverwaltung) 0.

**TTL (Ulf, Google-Cloud-Konsole, nach dem Einspielen, Bild an den KC):** zwei Richtlinien — Sammlungsgruppe `nachrichten`, Feld `fristStart`, Versatz 40 Tage (E11); Sammlungsgruppe `antworten`, Feld `fristStart`, Versatz 40 Tage (Unter-Sammlungen werden vom Kopf nicht mitgelöscht, F-K4). Bekanntmachungen ohne `fristStart` bleiben, bis jemand löst.

**Nicht erzwungen (bewusst):** dass Empfänger-Kennungen im Adressbuch stehen (die Seite löst Vorlagen auf; eine Nachricht an eine Kennung ohne Konto liegt einfach ungelesen — Fall V nutzt genau das mit `zz_pruef_niemand`); dass `giltBis` in der Zukunft liegt (Anzeige); dass `vonName` der Rufname ist (Anzeige).

**Neu in der Sprache des Projekts (Checkliste §4a):** `hasAll` auf Datenlisten (Daumen, Kritik). `getAfter` auf ein im selben Batch entstehendes Dokument ist seit RK §20 bewiesen. Beleg am echten System: `pruefung_fremd.html` Fall V (Daumen dazu/weg und Kritik an die Leitung je zweimal; Kritik-Beleg nur ohne Bekanntmachungs-Haken, weil der Haken die Listenprüfung umgeht).

**Prüfseite — Fall V** (Fassung „2026-10-27 23:43 (Fall V, Nachrichtenzentrale Stufe 1b)“), **schreibt wirklich**: ohne Schreib-Haken Lesen erlaubt / Schreiben zu; mit Schreib-Haken Nachricht an sich selbst + Phantom-Empfänger `zz_pruef_niemand` (zweimal), Daumen dazu/weg/dazu/weg, fremde Kennung im Daumen (zu), Text ändern (zu), Antwort als Absender an den Phantom-Empfänger (zweimal), Antwort an sich selbst (zu), Antwort ändern/löschen (zu), Kritik außerhalb der Leitung (zu), Kritik an sich selbst als Leitungsmitglied ohne Bekanntmachungs-Haken (zweimal), Bekanntmachung ohne Haken (zu) bzw. anlegen + lösen (zweimal), Korrektur-Batch (zweimal), Sperren ohne neue Nachricht (zu), zweite Korrektur (zu). Aufräumen über `fristStart` (TTL), Status gelöscht, Beschreibung zurückgesetzt. Reihenfolge für Ulf: `backstube02` (Schreib-Haken, **ohne** Bekanntmachung) → `backstube01` → Bekanntmachungs-Haken setzen → `backstube02`.

```
    // RK §29 · Nachrichtenzentrale Stufe 1b: Adressbuch (Schild, nur Anzeige), Vorlagen, privater Lesestatus, Nachrichten
    // mit Antworten. Das Schloss sind die Haken im Konto (nzHaken). Kritik ohne Bekanntmachungs-Haken nur an die Leitungsliste;
    // Korrektur = neue Nachricht + Sperre der alten im selben Batch (getAfter); Bekanntmachung ohne Empfängerliste, ohne
    // Daumen, ohne fristStart bis zum Lösen; Antworten unter vier Augen (Feld an). Ohne ?:, liste[i:j], Karten-Literal (RK §29).
    function nzKonto() { return get(/databases/$(database)/documents/bos_accounts/$(kennung())).data; }
    function nzHaken(feld) { return hatKonto() && nzKonto().get(feld, false) == true; }
    function nzEmpfaenger() {
      return hatKonto()
        && (nzKonto().get('art', '') == 'person' || nzKonto().get('nachrichtenEmpfangen', false) == true);
    }
    function nz(id) { return /databases/$(database)/documents/nachrichten/$(id); }
    function nzKopf(id) { return get(nz(id)).data; }
    function nzGesperrt(k) { return k.keys().hasAny(['ersetztDurch']); }
    function nzLeser(k) {
      return k.von == kennung() || k.typ == 'bekanntmachung' || kennung() in k.get('empfaenger', []);
    }
    function nzName(n) { return n is string && n.size() <= 40; }
    function nzLeitung() { return get(/databases/$(database)/documents/nachrichten_vorlagen/leitung).data.kennungen; }
    function nzKopfGleich() {
      return d().von == kennung() && nzName(d().vonName)
        && d().text is string && d().text.size() >= 1 && d().text.size() <= 2000
        && d().erstellt == request.time;
    }
    function nzNormal() {
      return d().typ in ['nachricht', 'info', 'lob', 'kritik']
        && d().keys().hasOnly(['von', 'vonName', 'typ', 'empfaenger', 'text', 'erstellt', 'fristStart', 'daumen', 'ersetzt'])
        && d().keys().hasAll(['von', 'vonName', 'typ', 'empfaenger', 'text', 'erstellt', 'fristStart', 'daumen'])
        && d().empfaenger is list && d().empfaenger.size() >= 1 && d().empfaenger.size() <= 100
        && d().fristStart == request.time
        && d().daumen is list && d().daumen.size() == 0
        && (d().typ != 'kritik' || nzHaken('nachrichtenBekanntmachung') || nzLeitung().hasAll(d().empfaenger));
    }
    function nzBekanntmachung() {
      return d().typ == 'bekanntmachung' && nzHaken('nachrichtenBekanntmachung')
        && d().keys().hasOnly(['von', 'vonName', 'typ', 'text', 'erstellt', 'giltBis', 'ersetzt'])
        && d().keys().hasAll(['von', 'vonName', 'typ', 'text', 'erstellt', 'giltBis'])
        && d().giltBis is string && d().giltBis.matches('^20[0-9]{2}-[01][0-9]-[0-3][0-9]$');
    }
    function nzKorrektur(neuId) {
      return !d().keys().hasAny(['ersetzt'])
        || (d().ersetzt is string
            && nzKopf(d().ersetzt).von == kennung()
            && !nzGesperrt(nzKopf(d().ersetzt))
            && nzKopf(d().ersetzt).typ == d().typ
            && getAfter(nz(d().ersetzt)).data.ersetztDurch == neuId);
    }
    function nzDaumenDazu(alt, neu) {
      return neu.size() == alt.size() + 1 && neu.hasAll(alt)
        && neu.hasAll([kennung()]) && !alt.hasAll([kennung()]);
    }
    function nzDaumenWeg(alt, neu) {
      return neu.size() == alt.size() - 1 && alt.hasAll(neu)
        && alt.hasAll([kennung()]) && !neu.hasAll([kennung()]);
    }
    match /nachrichten_adressbuch/{k} {
      allow read: if istAdmin() || hatKonto();
      allow create, delete: if istAdmin();
      allow update: if istAdmin()
        || (hatKonto() && k == kennung()
            && d().diff(resource.data).affectedKeys().hasOnly(['beschreibung'])
            && d().beschreibung is string && d().beschreibung.size() <= 40);
    }
    match /nachrichten_vorlagen/{id} {
      allow read: if istAdmin() || hatKonto();
      allow create, update, delete: if istAdmin();
    }
    match /nachrichten_status/{k} {
      allow read, delete: if istAdmin() || (hatKonto() && k == kennung());
      allow create, update: if hatKonto() && k == kennung()
        && d().keys().hasOnly(['gelesen', 'ausgeblendet']) && d().keys().hasAll(['gelesen', 'ausgeblendet'])
        && d().gelesen is map && d().ausgeblendet is map;
    }
    match /nachrichten/{id} {
      allow read: if istAdmin() || (hatKonto() && nzLeser(resource.data));
      allow create: if nzHaken('nachrichtenSchreiben') && nzKopfGleich()
        && (nzNormal() || nzBekanntmachung())
        && nzKorrektur(id);
      allow update: if hatKonto() && (
        (nzEmpfaenger() && kennung() in resource.data.get('empfaenger', [])
          && resource.data.typ != 'bekanntmachung' && !nzGesperrt(resource.data)
          && d().diff(resource.data).affectedKeys().hasOnly(['daumen']) && d().daumen is list
          && (nzDaumenDazu(resource.data.daumen, d().daumen) || nzDaumenWeg(resource.data.daumen, d().daumen)))
        || (resource.data.von == kennung() && !nzGesperrt(resource.data)
          && d().diff(resource.data).affectedKeys().hasOnly(['ersetztDurch']) && d().ersetztDurch is string
          && getAfter(nz(d().ersetztDurch)).data.ersetzt == id
          && getAfter(nz(d().ersetztDurch)).data.von == kennung())
        || (resource.data.typ == 'bekanntmachung' && !resource.data.keys().hasAny(['fristStart'])
          && d().diff(resource.data).affectedKeys().hasOnly(['fristStart']) && d().fristStart == request.time
          && (resource.data.von == kennung() || istPlanung())));
      allow delete: if false;

      match /antworten/{a} {
        allow read: if istAdmin() || (hatKonto()
          && (nzKopf(id).von == kennung() || resource.data.von == kennung() || resource.data.an == kennung()));
        allow create: if nzEmpfaenger() && nzLeser(nzKopf(id))
          && !nzGesperrt(nzKopf(id)) && nzKopf(id).typ != 'bekanntmachung'
          && d().keys().hasOnly(['von', 'vonName', 'an', 'text', 'ts', 'fristStart'])
          && d().keys().hasAll(['von', 'vonName', 'an', 'text', 'ts', 'fristStart'])
          && d().von == kennung() && nzName(d().vonName)
          && d().an is string && d().an != kennung()
          && ((d().von == nzKopf(id).von && d().an in nzKopf(id).empfaenger)
              || (d().von != nzKopf(id).von && d().an == nzKopf(id).von))
          && d().text is string && d().text.size() >= 1 && d().text.size() <= 1000
          && d().ts == request.time && d().fristStart == request.time;
        allow update, delete: if false;
      }
    }
```
