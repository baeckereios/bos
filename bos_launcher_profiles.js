/* ================================================================
   BäckereiOS · Satellite — Profile
   ================================================================
   Echte Personen, nicht abstrakte Rollen. Jedes Profil hat eine
   Rolle (steuert, was technisch erlaubt ist — siehe bos_launcher_roles.js
   und das "roles"-Feld in bos_app_registry.js), aber eine EIGENE,
   persönliche Kachel-Anordnung.

   Ein Schreiber (du, per Hand editiert für fest eingerichtete Profile),
   viele Leser — gleiches Muster wie überall sonst im System. Wer neu
   dazukommt, muss aber nicht auf dich warten: über die "+"-Kachel im
   Profil-Bildschirm kann sich jeder direkt auf seinem eigenen Gerät
   ein Profil anlegen (landet lokal in localStorage, nicht in dieser
   Datei — genau wie selbst angelegte App-Kacheln).

   WICHTIG — derselbe Sicherheitshinweis wie bei bos_launcher_roles.js:
   Ein hier hinterlegter PIN ist im öffentlichen Quelltext einsehbar.
   Fumbling-Schutz, keine echte Zugriffskontrolle.

   STAND 04.10.2026 · 14:24 (Vorbereitung Online-Gang): Die Liste ist
   LEER. Seit der Konto-Umstellung (19./22.09.2026) kommt das aktive
   Profil aus dem angemeldeten Firebase-Konto (bos_konto_profil.js,
   Profil-ID "konto_<kennung>"); die Profilauswahl im Launcher ist
   abgeschafft. Der frühere Eintrag "ulf" (role admin, pin 1234) war
   Altlast und wurde entfernt — ein öffentlich lesbarer Admin-PIN hat
   im Repo nichts verloren. Die Datei bleibt bestehen, weil rund 15
   Seiten window.BOS_PROFILES lesen (immer mit "|| []"); sie darf bei
   Bedarf wieder feste Profile bekommen, aber keine PINs mehr.

   Felder je Profil:
     id    — eindeutiger Schlüssel, NIE umbenennen (sonst gehen
             persönliche Anpassungen verloren, die daran hängen)
     name  — Anzeigename auf der Profil-Kachel
     icon  — Emoji fürs Profil
     role  — welche Rolle (id aus bos_launcher_roles.js) gilt für
             dieses Profil — bestimmt, welche App-Kacheln sichtbar sind
     pin   — optional. Nur nötig für Profile mit weitreichenden
             Rechten (z.B. role: 'admin').
   ================================================================ */

window.BOS_PROFILES = [];
