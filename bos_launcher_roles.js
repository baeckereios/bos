/* ================================================================
   BäckereiOS · Satellite — Rollen-Definition
   ================================================================
   Reiner Berechtigungs-Rahmen: welche Rollen gibt es, welche App-
   Kacheln sind für welche Rolle überhaupt erlaubt (siehe "roles"-
   Feld in bos_app_registry.js). Kein PIN mehr hier — der lebt jetzt
   pro Person in bos_launcher_profiles.js, weil Schutz eine Sache
   der einzelnen Person ist, nicht der Kategorie.

   Diese Liste füllt außerdem das Rollen-Auswahlfeld, wenn sich
   jemand über die "+"-Kachel im Profil-Bildschirm selbst ein neues
   Profil anlegt.

   Felder je Rolle:
     id    — eindeutiger Schlüssel, wird in bos_app_registry.js
             ("roles"-Array) und bos_launcher_profiles.js ("role")
             referenziert. NIE umbenennen.
     name  — Anzeigename, z.B. im Rollen-Auswahlfeld beim Profil-Anlegen
     icon  — Emoji, aktuell nur als Fallback verwendet
   ================================================================ */

/* 30.08.2026: Von 4 auf 8 Rollen erweitert (Ulf, Chat). Abteilungs-
   statt Personenbezeichnungen ("Backstube" statt "Bäcker/Bäckerin"),
   damit umgeht das Modell bewusst die Frage nach gegenderten Titeln.
   Bestehende IDs unverändert (siehe Regel oben), nur "verkauf" hat
   einen ungegenderten Anzeigenamen bekommen ("Verkäuferin" → "Verkauf").
   Verkaufsleitung/Produktionsleitung sind bewusst eigene, schmalere
   Rollen — nicht automatisch Admin-Rechte, siehe Ulfs Begründung im
   Chat: Produktionsleitung soll nicht in jedem internen Programm
   mitreden können, nur wo es inhaltlich passt. */

/* 31.08.2026: Neunte Rolle "haustechnik" ergänzt (Ulf, Chat). Startet
   bewusst ohne jede Kachel — kein Satellit trägt "haustechnik" im
   "roles"-Feld der Registry, daher automatisch null Zugriff bis
   gezielt über bos_app_registry.js oder Override in
   konten_verwaltung.html vergeben. Gleiches sichere Vorgehen wie bei
   der Erweiterung von 4 auf 8 Rollen am 30.08.2026. */
window.BOS_ROLES = [
  { id: 'backstube', name: 'Backstube', icon: '🍞' },
  { id: 'konditorei', name: 'Konditorei', icon: '🍰' },
  { id: 'verkauf', name: 'Verkauf', icon: '🧾' },
  { id: 'kommissionierung', name: 'Kommissionierung', icon: '📦' },
  { id: 'fahrer', name: 'Fahrer', icon: '🚚' },
  { id: 'verkaufsleitung', name: 'Verkaufsleitung', icon: '📈' },
  { id: 'produktionsleitung', name: 'Produktionsleitung', icon: '🛠️' },
  { id: 'haustechnik', name: 'Haustechnik', icon: '🔧' },
  { id: 'admin', name: 'Admin', icon: '👑' }
];
