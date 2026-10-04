/* ================================================================
   BOS Aufgaben — Logik
   ================================================================
   Neu 05.09.2026, siehe SESSION_2026-09-05_AUFGABEN_TASKBOARD_KONZEPT.md.

   Eine Mechanik, zwei Aufrufer: aufgaben_verwaltung.html (Verwaltungs-
   satellit) und bos_taskboard.js (Launcher-Widget) brauchen beide
   dieselbe Antwort auf "ist diese Aufgabe gerade offen" — bewusst hier
   zentral herausgezogen, statt sie an zwei Stellen einzeln zu pflegen
   und irgendwann auseinanderlaufen zu lassen.

   Reine Logik, keine Firestore-/DOM-Abhängigkeit. Nimmt ein rohes
   Aufgaben-Objekt (Feld-Schema: type 'produktionsleiter_aufgabe' in
   bos_events — text/verhalten/erledigt/erstellt_am/…, siehe
   aufgaben_verwaltung.html-Kopfkommentar) und gibt reine Werte zurück.

   "Verfällt heute" vs. "Bleibt bestehen": siehe aufgaben_verwaltung.html —
   keine automatische Löschung/Archivierung, ein verfallenes Element
   verschwindet nur aus istOffen(), bleibt aber unverändert in Firestore.
   ================================================================ */
window.BOS_AUFGABEN_LOGIK = (function () {
  function istHeute(ts) {
    if (!ts || typeof ts.toDate !== 'function') return true; // frisch geschrieben, serverTimestamp noch nicht aufgelöst
    return ts.toDate().toDateString() === new Date().toDateString();
  }
  function istOffen(aufgabe) {
    return !aufgabe.erledigt && (aufgabe.verhalten === 'dauerhaft' || istHeute(aufgabe.erstellt_am));
  }
  return { istHeute: istHeute, istOffen: istOffen };
})();
