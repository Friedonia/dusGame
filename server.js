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

// GLOBALE EINSTELLUNGEN (Wichtig, sonst stürzt der Server ab!)
let gameSettings = {}; 

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
        
        if (data.features) {
            data.features.forEach(f => {
                let zColor = f.properties.color ? f.properties.color.toLowerCase() : "";
                
                if (f.properties.type === "zone" && TEAM_COLORS[zColor]) {
                    let team = TEAM_COLORS[zColor];
                    let level = f.properties.level || 1;
                    if (level === 1) newCoins[team] += 5;
                    if (level === 2) newCoins[team] += 10;
                    if (level === 3) newCoins[team] += 15;
                }
            });
        }

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

// 1. Den dynamischen Timer starten (Liest beim Start den gespeicherten Wert)
if (fs.existsSync(ZONES_FILE)) {
    const data = JSON.parse(fs.readFileSync(ZONES_FILE));
    if (data.gameSettings) {
        gameSettings = data.gameSettings; // Settings in den RAM laden!
        if (data.gameSettings.payoutInterval) {
            currentPayoutMins = parseInt(data.gameSettings.payoutInterval);
        }
    }
}
distributeCoins();
startPayoutLoop(currentPayoutMins);

// API: Kontostände abrufen
app.get('/api/coins', (req, res) => {
    res.json(teamWallets);
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
// 🗺️ ZONEN & SHOP KÄUFE
// ==========================================
app.get('/api/zones', (req, res) => {
    if (fs.existsSync(ZONES_FILE)) res.json(JSON.parse(fs.readFileSync(ZONES_FILE)));
    else res.json({ type: "FeatureCollection", features: [] });
});

app.post('/api/zones', (req, res) => {
    const geoData = req.body;

    if (geoData.gameSettings) {
        gameSettings = geoData.gameSettings; // Update RAM Einstellungen
        if (geoData.gameSettings.payoutInterval) {
            const newMins = parseInt(geoData.gameSettings.payoutInterval);
            if (newMins !== currentPayoutMins) startPayoutLoop(newMins);
        }
    }

    fs.writeFileSync(ZONES_FILE, JSON.stringify(geoData, null, 2));
    res.json({ message: 'Zonen & Einstellungen erfolgreich gespeichert!' });
});

app.post('/api/shop', (req, res) => {
    const { team, zoneCode, itemType } = req.body;
    if (teamWallets[team] < 30) return res.status(400).json({ error: "Nicht genug Coins!" });

    if (!fs.existsSync(ZONES_FILE)) return res.status(500).json({ error: "Datenbank fehlt!" });
    
    const data = JSON.parse(fs.readFileSync(ZONES_FILE));
    if(!data.features) return res.status(404).json({ error: "Keine Zonen gefunden!" });
    
    let zone = data.features.find(f => f.properties && f.properties.code === zoneCode);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden!" });

    teamWallets[team] -= 30;
    if (itemType === 'trap') zone.properties.trap = team;
    else if (itemType === 'buff') zone.properties.buff = team;

    fs.writeFileSync(ZONES_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, newBalance: teamWallets[team], message: `${itemType} erfolgreich platziert!` });
});

// ==========================================
// ⏳ COOLDOWN- & SPIELER-STATUS SYSTEM
// ==========================================
let playerStates = {
    rot:  { "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } },
    blau: { "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } },
    gruen:{ "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } },
    gelb: { "1": { lastScan: 0 }, "2": { lastScan: 0 }, "3": { lastScan: 0 } }
};

app.post('/api/player-scan', (req, res) => {
    const { team, player, timestamp } = req.body;
    
    if (playerStates[team] && playerStates[team][player]) {
        playerStates[team][player].lastScan = timestamp;
        console.log(`[SCAN] Team ${team} | Spieler ${player} hat gescannt.`);
    }
    res.json({ success: true });
});

app.get('/api/admin/cooldown-states', (req, res) => {
    let currentDurations = { rot: 5, blau: 5, gruen: 5, gelb: 5 };
    if (gameSettings && gameSettings.teamCooldowns) {
        currentDurations = gameSettings.teamCooldowns;
    }
    res.json({ states: playerStates, durations: currentDurations });
});

app.post('/api/reset-cooldowns', (req, res) => {
    const now = Date.now();
    
    // In RAM speichern, damit die Route nicht wegbricht
    gameSettings.cooldownResetTime = now; 

    // Auch in die JSON schreiben, damit die Handys das Signal über /api/zones bekommen!
    if (fs.existsSync(ZONES_FILE)) {
        let data = JSON.parse(fs.readFileSync(ZONES_FILE));
        if(!data.gameSettings) data.gameSettings = {};
        data.gameSettings.cooldownResetTime = now;
        fs.writeFileSync(ZONES_FILE, JSON.stringify(data, null, 2));
    }

    // Server-RAM leeren
    for (let t in playerStates) {
        playerStates[t]["1"].lastScan = 0;
        playerStates[t]["2"].lastScan = 0;
        playerStates[t]["3"].lastScan = 0;
    }
    
    console.log("[ADMIN] Cooldowns wurden global resettet!");
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
// 💬 CHAT SYSTEM
// ==========================================
let chatMessages = []; 

app.get('/api/chat', (req, res) => {
    res.json(chatMessages);
});

app.post('/api/chat', (req, res) => {
    try {
        const newMsg = req.body;
        if (!newMsg || !newMsg.message) {
            return res.status(400).json({ success: false, error: "Leere Nachricht" });
        }
        
        newMsg.timestamp = Date.now();
        chatMessages.push(newMsg);
        
        if (chatMessages.length > 200) chatMessages.shift(); 
        
        res.json({ success: true });
    } catch(err) {
        console.error("Fehler beim Chat:", err);
        res.status(500).json({ success: false, error: "Server Fehler" });
    }
});

app.post('/api/chat/reset', (req, res) => {
    chatMessages = []; 
    console.log("[ADMIN] Chat gelöscht.");
    res.json({ success: true });
});

// ==========================================
// SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Zonen-Datei gespeichert unter: ${ZONES_FILE}`);
});