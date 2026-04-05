const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const ZONES_FILE = path.join(__dirname, 'zones.json');
const TRAILS_FILE = path.join(__dirname, 'trails.json'); // NEU: Datei für die Spuren

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// ==========================================
// 🗺️ KARTEN-DATENBANK (RAM-Trick & Versionierung)
// ==========================================
let gameSettings = {}; 
let globalMapData = { type: "FeatureCollection", features: [] };
let mapNeedsSaving = false;
let mapVersion = Date.now(); // Der aktuelle Versions-Stempel!

// Beim Server-Start: Festplatte EINMAL auslesen
if (fs.existsSync(ZONES_FILE)) {
    try {
        globalMapData = JSON.parse(fs.readFileSync(ZONES_FILE));
        if (globalMapData.gameSettings) {
            gameSettings = globalMapData.gameSettings; 
        }
        console.log("✅ Zonen-Karte erfolgreich in den RAM geladen!");
    } catch (e) {
        console.error("❌ Fehler beim Laden der zones.json:", e);
    }
}

// Hintergrund-Job: Speichert die Karte alle 5 Sekunden (nur wenn sich was geändert hat)
setInterval(() => {
    if (mapNeedsSaving) {
        fs.writeFile(ZONES_FILE, JSON.stringify(globalMapData, null, 2), (err) => {
            if (err) console.error("❌ Fehler beim Speichern der Zonen:", err);
            else mapNeedsSaving = false;
        });
    }
}, 5000);


// ==========================================
// 💰 WIRTSCHAFT & SHOP SYSTEM (Dynamisch)
// ==========================================
let teamWallets = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
const TEAM_COLORS = { '#ff3333': 'rot', '#3366ff': 'blau', '#33ff33': 'gruen', '#ffcc00': 'gelb' };

let payoutTimer = null;
let currentPayoutMins = 45; // Standardwert

function distributeCoins() {
    // Liest jetzt sicher und extrem schnell aus dem RAM (globalMapData)
    if (globalMapData.gameSettings && globalMapData.gameSettings.shopEnabled === false) return; 

    let newCoins = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
    
    if (globalMapData.features) {
        globalMapData.features.forEach(f => {
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

// Funktion zum (Neu-)Starten des Timers
function startPayoutLoop(mins) {
    if (payoutTimer) clearInterval(payoutTimer);
    currentPayoutMins = mins > 0 ? mins : 45; // Fallback auf 45
    payoutTimer = setInterval(distributeCoins, currentPayoutMins * 60 * 1000);
    console.log(`⏱️ Payout-Intervall auf ${currentPayoutMins} Minuten gesetzt.`);
}

// Timer beim Start einstellen
if (gameSettings.payoutInterval) {
    currentPayoutMins = parseInt(gameSettings.payoutInterval);
}
distributeCoins(); // Erste Ausschüttung beim Start
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
        if (teamWallets[team] < 0) teamWallets[team] = 0; 
    }
    if (action === 'set') teamWallets[team] = val;

    res.json({ success: true, message: `Team ${team.toUpperCase()} erfolgreich aktualisiert!`, wallets: teamWallets });
});

// ==========================================
// 🗺️ ZONEN & SHOP KÄUFE (Versioniert!)
// ==========================================

// Handys fragen hier an
app.get('/api/zones', (req, res) => {
    const clientVersion = parseInt(req.query.v) || 0;
    
    if (clientVersion === mapVersion) {
        // Spieler hat die aktuelle Version! Nichts Neues senden.
        return res.json({ unchanged: true });
    }
    
    // Spieler braucht ein Update
    res.json({ version: mapVersion, data: globalMapData });
});

// Admin überschreibt die Karte
app.post('/api/zones', (req, res) => {
    const geoData = req.body;
    
    globalMapData = geoData; // RAM aktualisieren
    mapVersion = Date.now(); // NEUE VERSION!
    mapNeedsSaving = true;   // Speichern vormerken

    if (geoData.gameSettings) {
        gameSettings = geoData.gameSettings; 
        if (geoData.gameSettings.payoutInterval) {
            const newMins = parseInt(geoData.gameSettings.payoutInterval);
            if (newMins !== currentPayoutMins) startPayoutLoop(newMins);
        }
    }

    res.json({ message: 'Zonen & Einstellungen erfolgreich aktualisiert!' });
});

// Spieler kauft ein Item
// 1. Shop-Logik für Stacking (Mehrere Fallen/Buffs)
app.post('/api/shop', (req, res) => {
    const { team, zoneCode, itemType } = req.body;
    const PRICE = 30; // Preis pro Item
    
    if (teamWallets[team] < PRICE) return res.status(400).json({ error: "Nicht genug Coins!" });

    let zone = globalMapData.features.find(f => f.properties && f.properties.code === zoneCode);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden!" });

    // Initialisiere Arrays falls sie noch nicht existieren
    if (!zone.properties.traps) zone.properties.traps = [];
    if (!zone.properties.buffs) zone.properties.buffs = [];

    teamWallets[team] -= PRICE;

    if (itemType === 'trap') {
        if (zone.properties.traps.length >= 5) return res.status(400).json({ error: "Maximal 5 Fallen erlaubt!" });
        zone.properties.traps.push(team);
    } else if (itemType === 'buff') {
        if (zone.properties.buffs.length >= 5) return res.status(400).json({ error: "Maximal 5 Buffs erlaubt!" });
        zone.properties.buffs.push(team);
    }

    mapVersion = Date.now();
    mapNeedsSaving = true;
    res.json({ success: true, newBalance: teamWallets[team], message: `${itemType} platziert!` });
});

// 2. NEU: Cooldown Freikauf-Route
app.post('/api/reduce-cooldown', (req, res) => {
    const { team, player } = req.body;
    const REDUCE_PRICE = 35; // Kosten für -1 Minute Cooldown
    
    if (teamWallets[team] < REDUCE_PRICE) return res.status(400).json({ error: "Nicht genug Münzen zum Freikaufen!" });

    if (playerStates[team] && playerStates[team][player]) {
        teamWallets[team] -= REDUCE_PRICE;
        // Wir ziehen 1 Minute vom aktuellen Modifier ab (kann auch ins Negative gehen = Bonus)
        playerStates[team][player].modifier -= 1;
        
        console.log(`[SHOP] Team ${team} Sp. ${player} hat Cooldown reduziert (-1min)`);
        res.json({ success: true, newBalance: teamWallets[team] });
    } else {
        res.status(404).json({ error: "Spieler nicht gefunden" });
    }
});

// ==========================================
// ⏳ COOLDOWN- & SPIELER-STATUS SYSTEM
// ==========================================
// Initialisiere die States jetzt mit einem modifier-Feld
let playerStates = {
    rot:  { "1": { lastScan: 0, modifier: 0 }, "2": { lastScan: 0, modifier: 0 }, "3": { lastScan: 0, modifier: 0 } },
    blau: { "1": { lastScan: 0, modifier: 0 }, "2": { lastScan: 0, modifier: 0 }, "3": { lastScan: 0, modifier: 0 } },
    gruen:{ "1": { lastScan: 0, modifier: 0 }, "2": { lastScan: 0, modifier: 0 }, "3": { lastScan: 0, modifier: 0 } },
    gelb: { "1": { lastScan: 0, modifier: 0 }, "2": { lastScan: 0, modifier: 0 }, "3": { lastScan: 0, modifier: 0 } }
};

app.post('/api/player-scan', (req, res) => {
    const { team, player, timestamp, modifier } = req.body; // Modifier vom Handy empfangen
    
    if (playerStates[team] && playerStates[team][player]) {
        playerStates[team][player].lastScan = timestamp;
        playerStates[team][player].modifier = modifier || 0; // Hier speichern!
        console.log(`[SCAN] Team ${team} | Sp. ${player} | Mod: ${modifier} min.`);
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
    gameSettings.cooldownResetTime = now; 

    if(!globalMapData.gameSettings) globalMapData.gameSettings = {};
    globalMapData.gameSettings.cooldownResetTime = now;
    mapVersion = Date.now();
    mapNeedsSaving = true;

    for (let t in playerStates) {
        for (let p in playerStates[t]) {
            playerStates[t][p].lastScan = 0;
            playerStates[t][p].modifier = 0; // Auch die Strafen löschen!
        }
    }
    res.json({ success: true, resetTime: now });
});
// ==========================================
// ⚡ SUPER-SCHNELLE SCANNER-ROUTEN (NEU)
// ==========================================
// 1. Scanner fragt nur EINE Zone ab (Spart 99% Traffic)
app.get('/api/zone/:code', (req, res) => {
    if (!globalMapData.features) return res.status(404).json({ error: "Keine Zonen gefunden" });
    
    // Sucht die Zone blitzschnell im RAM
    const zone = globalMapData.features.find(f => f.properties && f.properties.code === req.params.code);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    
    // Schickt nur die Eigenschaften dieser einen Zone und die Settings
    res.json({ 
        zone: zone.properties, 
        gameSettings: globalMapData.gameSettings || {}
    });
});

// 2. Scanner führt Aktion 
app.post('/api/zone-action', (req, res) => {
    const { code, action, newColor, playerLat, playerLng, team, cooldownChange } = req.body;
    let zone = globalMapData.features.find(f => f.properties && f.properties.code === code);
    
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    if (zone.properties.locked) return res.status(403).json({ error: "Zone gesperrt" });

    const isGpsRequired = (globalMapData.gameSettings && globalMapData.gameSettings.gpsRequired === false) ? false : true;

    if (action !== 'trigger_items' && isGpsRequired) { 
        if (!playerLat || !playerLng) {
            return res.status(400).json({ error: "Standort fehlt! Bitte aktiviere GPS." });
        }
        let center = getPolygonCenter(zone.geometry.coordinates);
        let distance = getDistanceInMeters(playerLat, playerLng, center.lat, center.lng);
        
        if (distance > MAX_INTERACT_DISTANCE) {
            return res.status(403).json({ error: `Zu weit entfernt! Du bist ${Math.round(distance)}m entfernt.` });
        }
    }

    if (action === 'upgrade') {
        zone.properties.level += 1;
    } else if (action === 'capture') { 
        zone.properties.color = newColor; 
        zone.properties.level = 1; 
    } else if (action === 'attack') {
        zone.properties.level -= 1;
        if (zone.properties.level <= 0) { 
            zone.properties.color = "#808080"; 
            zone.properties.level = 0; 
        }
    } else if (action === 'trigger_items') {
        // Fallen löschen
        delete zone.properties.traps;
        delete zone.properties.buffs;
        
        // GLOBALEN COOLDOWN DES TEAMS ÄNDERN!
        if (cooldownChange && team) {
            if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
            if (!globalMapData.gameSettings.teamCooldowns) globalMapData.gameSettings.teamCooldowns = {rot:5, blau:5, gruen:5, gelb:5};
            
            let currentCD = parseInt(globalMapData.gameSettings.teamCooldowns[team]) || 0;
            currentCD += cooldownChange; 
            if (currentCD < 0) currentCD = 0; // Nicht unter 0 Minuten fallen
            
            // Speichern in beiden Server-RAMs
            globalMapData.gameSettings.teamCooldowns[team] = currentCD;
            gameSettings.teamCooldowns[team] = currentCD;
            console.log(`[ITEM WIRKUNG] Team ${team} Cooldown ist jetzt ${currentCD} Min.`);
        }
    }

    mapVersion = Date.now(); 
    mapNeedsSaving = true;   
    res.json({ success: true });
});

// NEU: Freikauf-Route (Ändert den globalen Team-Wert!)
app.post('/api/reduce-cooldown', (req, res) => {
    const { team } = req.body;
    const REDUCE_PRICE = 50; 
    
    if (teamWallets[team] < REDUCE_PRICE) return res.status(400).json({ error: "Nicht genug Münzen zum Freikaufen!" });

    teamWallets[team] -= REDUCE_PRICE;
    
    if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
    if (!globalMapData.gameSettings.teamCooldowns) globalMapData.gameSettings.teamCooldowns = {rot:5, blau:5, gruen:5, gelb:5};
    
    let currentCD = parseInt(globalMapData.gameSettings.teamCooldowns[team]) || 0;
    currentCD -= 2; // Zieht 2 Minuten vom Team ab
    if (currentCD < 0) currentCD = 0;
    
    globalMapData.gameSettings.teamCooldowns[team] = currentCD;
    gameSettings.teamCooldowns[team] = currentCD;

    mapVersion = Date.now();
    mapNeedsSaving = true;
    
    console.log(`[SHOP] Team ${team} hat sich freigekauft. Neuer Cooldown: ${currentCD} Min.`);
    res.json({ success: true, newBalance: teamWallets[team] });
});
// ==========================================
// 📍 SPIELER STANDORTE
// ==========================================
// ==========================================
// 📍 SPIELER STANDORTE & GPS-SPUREN (TRAILS)
// ==========================================
let playerLocations = {};
let playerTrails = {}; 
let trailsNeedSaving = false;

// 1. Beim Server-Start: Spuren von der Festplatte in den RAM laden
if (fs.existsSync(TRAILS_FILE)) {
    try {
        playerTrails = JSON.parse(fs.readFileSync(TRAILS_FILE));
        console.log("✅ GPS-Spuren erfolgreich in den RAM geladen!");
    } catch (e) {
        console.error("❌ Fehler beim Laden der trails.json:", e);
    }
}

// 2. Hintergrund-Job: Speichert die Spuren alle 10 Sekunden (wenn jemand gelaufen ist)
setInterval(() => {
    if (trailsNeedSaving) {
        fs.writeFile(TRAILS_FILE, JSON.stringify(playerTrails, null, 2), (err) => {
            if (err) console.error("❌ Fehler beim Speichern der Trails:", err);
            else trailsNeedSaving = false;
        });
    }
}, 10000);


app.post('/api/location', (req, res) => {
    const { id, lat, lng, team, name } = req.body;
    playerLocations[id] = { lat, lng, team, name, lastUpdate: new Date() };

    // SPUREN-AUFZEICHNUNG:
    if (!playerTrails[id]) playerTrails[id] = { team: team, name: name, path: [] };
    
    let path = playerTrails[id].path;
    
    if (path.length === 0) {
        path.push([lat, lng]);
        trailsNeedSaving = true; // Markieren: Es gibt was Neues zum Speichern!
    } else {
        let lastPoint = path[path.length - 1];
        let dist = getDistanceInMeters(lat, lng, lastPoint[0], lastPoint[1]);
        if (dist > 5) {
            path.push([lat, lng]);
            trailsNeedSaving = true; // Markieren: Es gibt was Neues zum Speichern!
        }
    }

    res.json({ status: "Location received" });
});

app.get('/api/location', (req, res) => {
    res.json(playerLocations);
});

// Admin holt sich die Spuren zum Zeichnen
app.get('/api/trails', (req, res) => {
    res.json(playerTrails);
});

// Admin löscht die Spuren (Reset)
app.post('/api/trails/reset', (req, res) => {
    playerTrails = {}; // RAM leeren
    
    // SOFORT auch die Datei auf der Festplatte leeren
    fs.writeFileSync(TRAILS_FILE, JSON.stringify({}));
    trailsNeedSaving = false; 
    
    console.log("[ADMIN] GPS-Spuren wurden komplett gelöscht.");
    res.json({ success: true, message: "Spuren gelöscht" });
});

// ==========================================
// 💬 CHAT SYSTEM (Versioniert!)
// ==========================================
let chatMessages = []; 
let chatVersion = Date.now(); // NEU: Der Server merkt sich den Chat-Versionsstand!

app.get('/api/chat', (req, res) => {
    const clientVersion = parseInt(req.query.v) || 0;
    
    // Hat das Handy schon den neuesten Stand? Dann schick nichts!
    if (clientVersion === chatVersion) {
        return res.json({ unchanged: true }); 
    }
    
    // Es gibt neue Nachrichten!
    res.json({ version: chatVersion, messages: chatMessages });
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
        
        chatVersion = Date.now(); // NEU: Versionsnummer hochzählen, damit alle Handys updaten!
        res.json({ success: true });
    } catch(err) {
        console.error("Fehler beim Chat:", err);
        res.status(500).json({ success: false, error: "Server Fehler" });
    }
});

app.post('/api/chat/reset', (req, res) => {
    chatMessages = []; 
    chatVersion = Date.now(); // NEU: Update erzwingen, damit bei allen der Chat sofort verschwindet!
    console.log("[ADMIN] Chat gelöscht.");
    res.json({ success: true });
});

// ==========================================
// 📍 GPS ANTI-CHEAT LOGIK
// ==========================================
// Berechnet die Distanz zwischen zwei Koordinaten in Metern (Haversine Formel)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Erdradius in Metern
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

// Berechnet den absoluten Mittelpunkt eines Polygons (der Zone)
function getPolygonCenter(coordinates) {
    let latSum = 0, lngSum = 0, count = 0;
    // Leaflet GeoJSON hat meistens ein Array in einem Array: [[[lng, lat], [lng, lat], ...]]
    let coords = coordinates[0]; 
    if(!Array.isArray(coords[0])) coords = coordinates; // Fallback

    for (let i = 0; i < coords.length; i++) {
        lngSum += coords[i][0]; // Achtung: GeoJSON speichert [Longitude, Latitude]
        latSum += coords[i][1];
        count++;
    }
    return { lat: latSum / count, lng: lngSum / count };
}

const MAX_INTERACT_DISTANCE = 60; // Erlaubte Entfernung in Metern (Großzügig wegen GPS-Ungenauigkeit)

// ==========================================
// SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Zonen-Datei gespeichert unter: ${ZONES_FILE}`);
    console.log(`📡 RAM-Datenbank aktiv! Polling optimiert.`);
});