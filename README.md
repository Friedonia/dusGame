🐸 Operation: FrogHack (Düsseldorf City-Control)
Willkommen beim ultimativen, GPS-basierten Real-Life-Strategiespiel! Operation: FrogHack verwandelt die echten Straßen der Stadt in ein gnadenloses, taktisches Schlachtfeld. Vier Teams treten gegeneinander an, um Zonen zu erobern, virtuelle Wirtschaftskreisläufe aufzubauen und die Gegner mit Cyber-Waffen in den Wahnsinn zu treiben.

Und der Schlüssel zur Macht? Die Frösche. 🐸
In der ganzen Stadt sind NFC-Tags versteckt, die als kleine Frösche getarnt sind. Wer den Frosch findet und scannt, hackt das System!

📖 Die kurze Einführung ins Spiel (Für Spieler)
Deine Mission: Du bist ein Agent für eines von vier Teams (🔴 Rot, 🔵 Blau, 🟢 Grün, 🟡 Gelb). Dein Ziel ist es, so viele Zonen wie möglich für dein Team zu beanspruchen, um die Team-Kasse mit Coins zu füllen.

Wie man spielt:

Finde die Frösche: Schau auf dein Radar (Handy-Browser). Gehe physisch zu den Zonen auf der Karte und suche den versteckten NFC-Frosch.

Scanne & Hacke: Halte dein Handy an den Frosch. Das Terminal öffnet sich. Du kannst Zonen einnehmen, gegnerische Zonen angreifen oder dein eigenes Gebiet verstärken (Level 1 bis 3).

Achtung, Cooldown: Jeder Hack kostet dich Zeit. Wenn du einen Frosch scannst, kassiert dein Scanner einen Cooldown (z. B. 5 Minuten), in denen du nichts tun kannst – es sei denn, dein Team kauft dich frei!

Der Schwarzmarkt: Nutze die verdienten Coins deines Teams, um dir im "Black Market" taktische Items in deinen persönlichen Rucksack zu kaufen. Lege Fallen für die Gegner, wirf EMP-Granaten auf Zonen oder klaue ihnen per Taschendieb das Geld!

Das Ziel: Dominiert das Leaderboard, verteidigt euer Hauptquartier (HQ) und lasst die gegnerischen Teams in eure Minenfelder laufen!

🚀 Features (Game-Mechaniken)
🗺️ Live GPS-Tracking: Die Karte zeigt Spieler in Echtzeit. Anti-Cheat-Systeme (Kalman-Filter) verhindern GPS-Spoofing und "Teleportationen".

🏰 Hauptquartiere (HQs): Jedes Team hat eine stark gepanzerte Basis. Fällt das HQ, wird das gesamte Gebiet des Teams zu "Free Real Estate" (kein Cooldown für Angreifer!).

👑 King of the Hill: Besondere Zonen, die den 3-fachen Coin-Payout generieren.

🎒 Persönliches Inventar: Kauf Items im globalen Shop und wende sie lokal an den Zonen (Fröschen) an:

🪤 Falle: Bestraft feindliche Scanner mit Extra-Cooldown.

⚡ Buff: Belohnt eigene Teammitglieder mit weniger Cooldown.

🔌 EMP-Granate: Legt eine Zone für 5 Minuten komplett lahm.

✂️ Entschärfungs-Kit: Löscht feindliche Fallen lautlos.

🕵️ Taschendieb: Klaut 10% der feindlichen Teamkasse beim Hacken.

🚑 Team-Revive: Löscht sofort die Cooldowns deines gesamten Teams.

🏆 Agenten-Akte & Leaderboard: Schrittzähler (gelaufene Kilometer), Hack-Statistiken und freischaltbare Abzeichen ("Sprengmeister", "Marathon").

🛠️ Technik & Installation (Für den Admin)
Das Spiel läuft als leichtgewichtige Node.js Anwendung im "One-File-Backend"-Modus. Der Server frisst fast keinen RAM und speichert alle Daten (Karte, Spuren, Inventar) sicher in lokalen JSON-Dateien.

Voraussetzungen

Node.js installiert.

Ein Server, Laptop oder Raspberry Pi, der im gleichen Netzwerk läuft oder per Port-Forwarding (z. B. ngrok) ins Internet freigegeben wird.

NFC-Tags (programmiert mit der URL zum Scanner: http://DEINE-IP/scan.html?code=GENERIERTER_CODE).

Setup

Repository klonen oder den Ordner öffnen.

Abhängigkeiten installieren (falls nötig, z.B. für Express):

Bash
npm install express cors
Server starten:

Bash
node server.js
Admin-Panel aufrufen: http://localhost:3000/ (Hier erstellst du die Zonen, verteilst die Frösche auf der Karte und überwachst die Spieler).

Spieler-Login: Spieler rufen http://localhost:3000/player.html?team=rot&player=1 auf.

🎮 Die Rolle des Game Masters (Admin)

Das Admin-Panel ist dein Gott-Modus. Du kannst Zonen zeichnen, live die Cooldowns der Spieler sehen, Teams wiederbeleben, GPS-Spuren (Trails) der Spieler nachverfolgen, Rundfunknachrichten an alle schicken und das Spiel bei Regelverstößen sofort pausieren (Not-Aus).

Möge das beste Team gewinnen.
