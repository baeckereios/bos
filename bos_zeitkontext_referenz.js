// ═══════════════════════════════════════════════════════════════
// bos_zeitkontext_referenz.js — Niedersachsen
// EINZIGE WAHRHEITSQUELLE für Feiertage, Schulferien, Betriebsurlaub.
// Hier pflegen — nirgendwo sonst.
// Quelle Schulferien: Ferienordnung MK Niedersachsen 2024/25–2029/30
//
// Umbenannt aus feiertage_nds.js (29.08.2026) — Inhalt der Feiertage/
// Ferien/Betriebsurlaub-Abschnitte unverändert 1:1 übernommen.
//
// KORREKTUR 29.08.2026: Diese Datei hatte kurzzeitig einen hamsterFaktoren-
// Block. Rausgenommen — Hamster gehört fachlich nicht hierher. Anhand der
// echten Altsystem-Dateien (hamster_config.json, wochenconfig.json)
// bestätigt: Hamster ist eine manuelle Tages-Zuweisung (Stufe 0-3, von
// Ulf/Personal pro Tag gesetzt), keine aus dem Kalender automatisch
// abgeleitete Größe. Feiertage erscheinen in der alten Wochenplanung nur
// als Info-Badge neben dem Datum — der Mensch entscheidet. Siehe
// bos_hamster.js für die jetzt richtige Stelle.
//
// Unterste Ebene der Zeitkontext-Prioritätskette (siehe
// bos_zeitkontext.js): Firestore (Admin, spontan) > localStorage
// (Nutzer, lokal) > diese Datei (System-Standard). Diese Datei allein
// liefert nur den Fallback-Boden, keine spontanen Änderungen — dafür
// ist Firestore da.
// ═══════════════════════════════════════════════════════════════

const BOS_FEIERTAGE_NDS = {

    // ── GESETZLICHE FEIERTAGE ──────────────────────────────────
    feiertage: [
        // 2025
        { datum: '2025-01-01', name: 'Neujahr' },
        { datum: '2025-04-18', name: 'Karfreitag' },
        { datum: '2025-04-21', name: 'Ostermontag' },
        { datum: '2025-05-01', name: 'Tag der Arbeit' },
        { datum: '2025-05-29', name: 'Christi Himmelfahrt' },
        { datum: '2025-06-09', name: 'Pfingstmontag' },
        { datum: '2025-10-03', name: 'Tag der Deutschen Einheit' },
        { datum: '2025-10-31', name: 'Reformationstag' },
        { datum: '2025-12-25', name: '1. Weihnachtstag' },
        { datum: '2025-12-26', name: '2. Weihnachtstag' },
        // 2026
        { datum: '2026-01-01', name: 'Neujahr' },
        { datum: '2026-04-03', name: 'Karfreitag' },
        { datum: '2026-04-06', name: 'Ostermontag' },
        { datum: '2026-05-01', name: 'Tag der Arbeit' },
        { datum: '2026-05-14', name: 'Christi Himmelfahrt' },
        { datum: '2026-05-25', name: 'Pfingstmontag' },
        { datum: '2026-10-03', name: 'Tag der Deutschen Einheit' },
        { datum: '2026-10-31', name: 'Reformationstag' },
        { datum: '2026-12-25', name: '1. Weihnachtstag' },
        { datum: '2026-12-26', name: '2. Weihnachtstag' },
        // 2027
        { datum: '2027-01-01', name: 'Neujahr' },
        { datum: '2027-03-26', name: 'Karfreitag' },
        { datum: '2027-03-29', name: 'Ostermontag' },
        { datum: '2027-05-01', name: 'Tag der Arbeit' },
        { datum: '2027-05-06', name: 'Christi Himmelfahrt' },
        { datum: '2027-05-17', name: 'Pfingstmontag' },
        { datum: '2027-10-03', name: 'Tag der Deutschen Einheit' },
        { datum: '2027-10-31', name: 'Reformationstag' },
        { datum: '2027-12-25', name: '1. Weihnachtstag' },
        { datum: '2027-12-26', name: '2. Weihnachtstag' },
        // 2028
        { datum: '2028-01-01', name: 'Neujahr' },
        { datum: '2028-04-14', name: 'Karfreitag' },
        { datum: '2028-04-17', name: 'Ostermontag' },
        { datum: '2028-05-01', name: 'Tag der Arbeit' },
        { datum: '2028-05-25', name: 'Christi Himmelfahrt' },
        { datum: '2028-06-05', name: 'Pfingstmontag' },
        { datum: '2028-10-03', name: 'Tag der Deutschen Einheit' },
        { datum: '2028-10-31', name: 'Reformationstag' },
        { datum: '2028-12-25', name: '1. Weihnachtstag' },
        { datum: '2028-12-26', name: '2. Weihnachtstag' },
    ],

    // ── SCHULFERIEN NIEDERSACHSEN ──────────────────────────────
    // Quelle: Ferienordnung MK NDS, Schuljahre 2024/25 bis 2027/28
    ferien: [
        // Schuljahr 2025/2026
        { name: 'Weihnachtsferien 2025/26',  von: '2025-12-22', bis: '2026-01-05' },
        { name: 'Halbjahresferien 2026',      von: '2026-02-02', bis: '2026-02-03' },
        { name: 'Osterferien 2026',           von: '2026-03-23', bis: '2026-04-07' },
        { name: 'Tag nach Himmelfahrt 2026',  von: '2026-05-15', bis: '2026-05-15' },
        { name: 'Pfingstferien 2026',         von: '2026-05-26', bis: '2026-05-26' },
        { name: 'Sommerferien 2026',          von: '2026-07-02', bis: '2026-08-12' },
        { name: 'Herbstferien 2026',          von: '2026-10-12', bis: '2026-10-24' },
        // Schuljahr 2026/2027
        { name: 'Weihnachtsferien 2026/27',  von: '2026-12-23', bis: '2027-01-09' },
        { name: 'Halbjahresferien 2027',      von: '2027-02-01', bis: '2027-02-02' },
        { name: 'Osterferien 2027',           von: '2027-03-22', bis: '2027-04-03' },
        { name: 'Tag nach Himmelfahrt 2027',  von: '2027-05-07', bis: '2027-05-07' },
        { name: 'Pfingstferien 2027',         von: '2027-05-18', bis: '2027-05-18' },
        { name: 'Sommerferien 2027',          von: '2027-07-08', bis: '2027-08-18' },
        { name: 'Herbstferien 2027',          von: '2027-10-16', bis: '2027-10-30' },
        // Schuljahr 2027/2028
        { name: 'Weihnachtsferien 2027/28',  von: '2027-12-23', bis: '2028-01-08' },
    ],

    // ── BETRIEBSURLAUB ────────────────────────────────────────
    // Hier eintragen wenn gewünscht
    betriebsurlaub: [
        // { name: 'Betriebsurlaub Weihnachten 2026', von: '2026-12-24', bis: '2026-12-26' },
    ],
};

// Für alle anderen Dateien zugänglich
window.BOS_FEIERTAGE = BOS_FEIERTAGE_NDS;

// Hilfsfunktion: Ist ein Datum (YYYY-MM-DD String) ein Feiertag oder in Ferien?
window.BOS_IST_BESONDERER_TAG = function(datumStr) {
    const d = new Date(datumStr); d.setHours(0,0,0,0);
    const alle = BOS_FEIERTAGE_NDS.feiertage.map(f => f.datum);
    if (alle.includes(datumStr)) return { typ: 'feiertag', name: BOS_FEIERTAGE_NDS.feiertage.find(f => f.datum === datumStr).name };
    for (const f of [...BOS_FEIERTAGE_NDS.ferien, ...BOS_FEIERTAGE_NDS.betriebsurlaub]) {
        const von = new Date(f.von); von.setHours(0,0,0,0);
        const bis = new Date(f.bis); bis.setHours(0,0,0,0);
        if (d >= von && d <= bis) return { typ: 'ferien', name: f.name };
    }
    return null;
};

// Hilfsfunktion: Alle besonderen Tage innerhalb der nächsten N Tage
window.BOS_BESONDERE_TAGE_IN = function(tage) {
    const heute = new Date(); heute.setHours(0,0,0,0);
    const ergebnis = [];
    for (let i = 0; i <= tage; i++) {
        const d = new Date(heute); d.setDate(heute.getDate() + i);
        const str = d.toISOString().split('T')[0];
        const info = window.BOS_IST_BESONDERER_TAG(str);
        if (info) ergebnis.push({ datum: str, ...info });
    }
    return ergebnis;
};
