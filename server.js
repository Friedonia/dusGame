const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const ZONES_FILE = path.join(__dirname, 'zones.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// ==========================================
// 💰 WIRTSCHAFT & SHOP SYSTEM (Dynamisch)
// ==========================================
let teamWallets = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
const TEAM_COLORS = { '#ff3333': 'rot', '#3366ff': 'blau', '#33ff33': 'gruen', '#ffcc00': 'gelb' };

let payoutTimer = null;
let currentPayoutMins = 45; // Standardwert

function distributeCoins() {
    if (fs.existsSync(ZONES_FILE)) {
        const data = JSON.parse(fs.readFileSync(ZONES_FILE));
        if (data.gameSettings && data.gameSettings.shopEnabled === false) return; 

        let newCoins = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
        
        data.features.forEach(f => {
            // FIX: color.toLowerCase() sorgt dafür, dass #FF3333 und #ff3333 beides erkannt wird!
            let zColor = f.properties.color ? f.properties.color.toLowerCase() : "";
            
            if (f.properties.type === "zone" && TEAM_COLORS[zColor]) {
                let team = TEAM_COLORS[zColor];
                let level = f.properties.level || 1;
                if (level === 1) newCoins[team] += 5;
                if (level === 2) newCoins[team] += 10;
                if (level === 3) newCoins[team] += 15;
            }
        });

        for (let t in newCoins) teamWallets[t] += newCoins[t];
        console.log(`💰 Auto-Payout (${currentPayoutMins}min)! Neue Coins:`, newCoins, "| Kontostand:", teamWallets);
    }
}

// Funktion zum (Neu-)Starten des Timers
function startPayoutLoop(mins) {
    if (payoutTimer) clearInterval(payoutTimer);
    currentPayoutMins = mins > 0 ? mins : 45; // Fallback auf 45
    payoutTimer = setInterval(distributeCoins, currentPayoutMins * 60 * 1000);
    console.log(`⏱️ Payout-Intervall auf ${currentPayoutMins} Minuten gesetzt.`);
}

// 1. Einmal sofort beim Serverstart ausschütten (falls gewünscht)
distributeCoins();

// 2. Den dynamischen Timer starten (Liest beim Start den gespeicherten Wert)
if (fs.existsSync(ZONES_FILE)) {
    const data = JSON.parse(fs.readFileSync(ZONES_FILE));
    if (data.gameSettings && data.gameSettings.payoutInterval) {
        currentPayoutMins = parseInt(data.gameSettings.payoutInterval);
    }
}
startPayoutLoop(currentPayoutMins);

// API: Kontostände abrufen
app.get('/api/coins', (req, res) => {
    res.json(teamWallets);
});

// API: Shop-Kauf
app.post('/api/shop', (req, res) => {
    const { team, zoneCode, itemType } = req.body;
    if (teamWallets[team] < 30) return res.status(400).json({ error: "Nicht genug Coins!" });

    const data = JSON.parse(fs.readFileSync(ZONES_FILE));
    let zone = data.features.find(f => f.properties.code === zoneCode);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden!" });

    teamWallets[team] -= 30;
    if (itemType === 'trap') zone.properties.trap = team;
    else if (itemType === 'buff') zone.properties.buff = team;

    fs.writeFileSync(ZONES_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, newBalance: teamWallets[team], message: `${itemType} erfolgreich platziert!` });
});

// 🔄 API für die Manuelle Bank-Verwaltung (Admin)
app.post('/api/coins/manage', (req, res) => {
    const { team, amount, action } = req.body;
    let val = parseInt(amount) || 0;

    if (action === 'reset_all') {
        teamWallets = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
        return res.json({ success: true, message: "Alle Kassen wurden auf 0 gesetzt.", wallets: teamWallets });
    }

    if (!teamWallets.hasOwnProperty(team)) return res.status(400).json({ error: "Team nicht gefunden" });

    if (action === 'add') teamWallets[team] += val;
    if (action === 'sub') {
        teamWallets[team] -= val;
        if (teamWallets[team] < 0) teamWallets[team] = 0; // Verhindert negative Coins (Schulden)
    }
    if (action === 'set') teamWallets[team] = val;

    res.json({ success: true, message: `Team ${team.toUpperCase()} erfolgreich aktualisiert!`, wallets: teamWallets });
});


// ==========================================
// 🗺️ ZONEN LOGIK (Wichtig für das Admin-Dashboard)
// ==========================================
app.get('/api/zones', (req, res) => {
    if (fs.existsSync(ZONES_FILE)) res.json(JSON.parse(fs.readFileSync(ZONES_FILE)));
    else res.json({ type: "FeatureCollection", features: [] });
});

app.post('/api/zones', (req, res) => {
    const geoData = req.body;

    // Prüfen, ob der Admin das Intervall geändert hat
    if (geoData.gameSettings && geoData.gameSettings.payoutInterval) {
        const newMins = parseInt(geoData.gameSettings.payoutInterval);
        if (newMins !== currentPayoutMins) {
            startPayoutLoop(newMins);
        }
    }

    fs.writeFileSync(ZONES_FILE, JSON.stringify(geoData, null, 2));
    res.json({ message: 'Zonen & Einstellungen erfolgreich gespeichert!' });
});


// ==========================================
// ⏳ NEU: COOLDOWN- & SPIELER-STATUS SYSTEM
// ==========================================

// Hier speichern wir die Scan-Zeiten (Timestamps) der Spieler auf dem Server
let playerStates = {
    rot:  { "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } },
    blau: { "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } },
    gruen:{ "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } },
    gelb: { "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } }
};

// 1. Wenn ein Spieler scannt, ruft er das hier auf:
app.post('/api/player-scan', (req, res) => {
    const { team, player, timestamp } = req.body;
    
    if (playerStates[team] && playerStates[team][player]) {
        playerStates[team][player].lastScan = timestamp;
        console.log(`[SCAN] Team ${team} | Spieler ${player} hat gescannt.`);
    }
    res.json({ success: true });
});

app.get('/api/admin/cooldown-states', (req, res) => {
    // Falls gameSettings mal nicht definiert sein sollte, haben wir hier einen Fallback:
    let currentDurations = { rot: 5, blau: 5, gruen: 5, gelb: 5 };
    try {
        // Das greift auf deine global gespeicherten Server-Settings zu
        if (typeof gameSettings !== 'undefined' && gameSettings.teamCooldowns) {
            currentDurations = gameSettings.teamCooldowns;
        }
    } catch(e) {
        console.log("Settings noch nicht geladen, verwende Standard.");
    }
    
    res.json({ 
        states: playerStates,
        durations: currentDurations
    });
});
// 3. Admin resettet die Cooldowns (Button: "Aktive Cooldowns sofort beenden")
app.post('/api/reset-cooldowns', (req, res) => {
    const { team } = req.body; // Optional: Wenn der Admin nur ein bestimmtes Team resetten will
    const now = Date.now();
    
    // WICHTIG: Setzt das Signal für alle Handys (die player.js prüft diesen Wert!)
    if (!gameSettings) gameSettings = {};
    gameSettings.cooldownResetTime = now; 

    if (team && playerStates[team]) {
        // Nur ein Team resetten
        playerStates[team]["1"].lastScan = 0;
        playerStates[team]["2"].lastScan = 0;
        playerStates[team]["3"].lastScan = 0;
    } else {
        // Alle Teams resetten
        for (let t in playerStates) {
            playerStates[t]["1"].lastScan = 0;
            playerStates[t]["2"].lastScan = 0;
            playerStates[t]["3"].lastScan = 0;
        }
    }
    
    console.log("[ADMIN] Cooldowns wurden resettet!");
    res.json({ success: true, resetTime: now });
});

// ==========================================
// 📍 SPIELER STANDORTE
// ==========================================
let playerLocations = {};
app.post('/api/location', (req, res) => {
    const { id, lat, lng, team, name } = req.body;
    playerLocations[id] = { lat, lng, team, name, lastUpdate: new Date() };
    res.json({ status: "Location received" });
});

app.get('/api/location', (req, res) => {
    res.json(playerLocations);
});

// ==========================================
// 💬 CHAT LOGIK
// ==========================================
let messages = [];
app.get('/api/messages', (req, res) => res.json(messages));
app.post('/api/messages', (req, res) => {
    const { sender, team, text } = req.body;
    messages.push({ sender, team, text, timestamp: new Date() });
    res.json({ status: "Gesendet" });
});

app.listen(PORT, () => {
    console.log(`Server läuft! Öffne http://localhost:${PORT} in deinem Browser.`);
});