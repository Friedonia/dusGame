const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ==========================================
// 🗄️ DATEI-PFADE
// ==========================================
const ZONES_FILE = path.join(__dirname, 'zones.json');
const TRAILS_FILE = path.join(__dirname, 'trails.json'); 
const INVENTORY_FILE = path.join(__dirname, 'inventory.json'); // Das neue Rucksack-System

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// ==========================================
// 🧮 GLOBALE HILFS-FUNKTIONEN (GPS Mathe)
// ==========================================
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

function getPolygonCenter(coordinates) {
    let latSum = 0, lngSum = 0, count = 0;
    let coords = coordinates[0]; 
    if(!Array.isArray(coords[0])) coords = coordinates; // Fallback

    for (let i = 0; i < coords.length; i++) {
        lngSum += coords[i][0]; 
        latSum += coords[i][1];
        count++;
    }
    return { lat: latSum / count, lng: lngSum / count };
}

const MAX_INTERACT_DISTANCE = 60; // Max Entfernung für Zonen-Hacks

// ==========================================
// 🗺️ KARTEN-DATENBANK (RAM-Trick)
// ==========================================
let gameSettings = {}; 
let globalMapData = { type: "FeatureCollection", features: [] };
let mapNeedsSaving = false;
let mapVersion = Date.now();

// Laden der Karte
if (fs.existsSync(ZONES_FILE)) {
    try {
        globalMapData = JSON.parse(fs.readFileSync(ZONES_FILE));
        if (globalMapData.gameSettings) gameSettings = globalMapData.gameSettings; 
        console.log("✅ Zonen-Karte erfolgreich in den RAM geladen!");
    } catch (e) {
        console.error("❌ Fehler beim Laden der zones.json:", e);
    }
}

// Karte speichern (alle 5 Sekunden prüfen)
setInterval(() => {
    if (mapNeedsSaving) {
        fs.writeFile(ZONES_FILE, JSON.stringify(globalMapData, null, 2), (err) => {
            if (err) console.error("❌ Fehler beim Speichern der Zonen:", err);
            else mapNeedsSaving = false;
        });
    }
}, 5000);

// ==========================================
// 🎒 PERSÖNLICHES INVENTAR (RUCKSACK)
// ==========================================
let playerInventory = {};
let invNeedsSaving = false;

// Format: { "rot_1": { trap: 2, buff: 1 }, "blau_2": { trap: 0, buff: 3 } }

if (fs.existsSync(INVENTORY_FILE)) {
    try {
        playerInventory = JSON.parse(fs.readFileSync(INVENTORY_FILE));
        console.log("✅ Rucksäcke erfolgreich geladen!");
    } catch (e) {
        console.error("❌ Fehler beim Laden der inventory.json:", e);
    }
}

setInterval(() => {
    if (invNeedsSaving) {
        fs.writeFile(INVENTORY_FILE, JSON.stringify(playerInventory, null, 2), (err) => {
            if (err) console.error("❌ Fehler beim Speichern der Rucksäcke:", err);
            else invNeedsSaving = false;
        });
    }
}, 8000);

// ==========================================
// 💰 WIRTSCHAFT & AUTO-PAYOUT
// ==========================================
let teamWallets = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
const TEAM_COLORS = { '#ff3333': 'rot', '#3366ff': 'blau', '#33ff33': 'gruen', '#ffcc00': 'gelb' };

let payoutTimer = null;
let currentPayoutMins = 45; 

function distributeCoins() {
    if (globalMapData.gameSettings && globalMapData.gameSettings.shopEnabled === false) return; 

    let newCoins = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
    let didPayout = false;
    
    if (globalMapData.features) {
        globalMapData.features.forEach(f => {
            let zColor = f.properties.color ? f.properties.color.toLowerCase() : "";
            if (f.properties.type === "zone" && TEAM_COLORS[zColor]) {
                let team = TEAM_COLORS[zColor];
                let level = f.properties.level || 1;
                
                if (level === 1) newCoins[team] += 5;
                if (level === 2) newCoins[team] += 10;
                if (level === 3) newCoins[team] += 15;
                didPayout = true;
            }
        });
    }
    
    if (didPayout) {
        for (let t in newCoins) teamWallets[t] += newCoins[t];
        console.log(`💰 Auto-Payout (${currentPayoutMins}min)! Neue Coins:`, newCoins, "| Kontostand:", teamWallets);
    }
}

function startPayoutLoop(mins) {
    if (payoutTimer) clearInterval(payoutTimer);
    currentPayoutMins = mins > 0 ? mins : 45; 
    payoutTimer = setInterval(distributeCoins, currentPayoutMins * 60 * 1000);
    console.log(`⏱️ Payout-Intervall auf ${currentPayoutMins} Minuten gesetzt.`);
}

// Dynamische Payout-Überwachung
setInterval(() => {
    if (!globalMapData.gameSettings) return;
    let adminSetMins = parseInt(globalMapData.gameSettings.payoutInterval) || 45;
    if (adminSetMins !== currentPayoutMins) {
        startPayoutLoop(adminSetMins);
    }
}, 5000);

// Initialer Start (Verzögert)
setTimeout(() => {
    let initialMins = (globalMapData.gameSettings && globalMapData.gameSettings.payoutInterval) ? parseInt(globalMapData.gameSettings.payoutInterval) : 45;
    distributeCoins();
    startPayoutLoop(initialMins);
}, 2000); 

app.get('/api/coins', (req, res) => { 
    res.json(teamWallets); 
});

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
// 🛒 SHOP & INVENTAR SYSTEM
// ==========================================

// 🚀 NEU: Die Heil-Funktion! Sie repariert NaN-Fehler und fügt neue Items sicher hinzu.
function getSafeInventory(invKey) {
    if (!playerInventory[invKey]) {
        playerInventory[invKey] = { trap: 0, buff: 0, revive: 0, emp: 0, defuse: 0, pickpocket: 0 };
    }
    const allItems = ['trap', 'buff', 'revive', 'emp', 'defuse', 'pickpocket'];
    allItems.forEach(item => {
        // Wenn das Item fehlt oder "NaN" ist, setzen wir es auf 0 zurück!
        if (typeof playerInventory[invKey][item] !== 'number' || isNaN(playerInventory[invKey][item])) {
            playerInventory[invKey][item] = 0;
        }
    });
    return playerInventory[invKey];
}

// 1. Rucksack abrufen
app.get('/api/inventory', (req, res) => {
    const { team, player } = req.query;
    const invKey = `${team}_${player}`;
    if (!playerInventory[invKey]) {
        // NEU: entschaerfung, drohne, emp hinzugefügt (Schild ist raus)
        playerInventory[invKey] = { trap: 0, buff: 0, revive: 0, taschendieb: 0, entschaerfung: 0, drohne: 0, emp: 0 };
    }
    res.json(playerInventory[invKey]);
});

// 2. KAUFEN
app.post('/api/shop/buy', (req, res) => {
    const { team, player, itemType } = req.body;
    
    // NEU: Preise für die neuen Items
    const PRICES = { 
        'trap': 30, 'buff': 30, 'revive': 200, 'taschendieb': 30,
        'entschaerfung': 40, 'drohne': 10, 'emp': 80
    };
    const price = PRICES[itemType];
    
    if (!price) return res.status(400).json({ error: "Unbekanntes Item!" });
    if (teamWallets[team] < price) return res.status(400).json({ error: "Das Team hat nicht genug Coins!" });

    teamWallets[team] -= price;
    
    const invKey = `${team}_${player}`;
    if (!playerInventory[invKey]) playerInventory[invKey] = {};
    if (playerInventory[invKey][itemType] === undefined) playerInventory[invKey][itemType] = 0;
    
    playerInventory[invKey][itemType] += 1;
    invNeedsSaving = true;

    res.json({ success: true, newBalance: teamWallets[team], inventory: playerInventory[invKey] });
});

// 3. BENUTZEN
app.post('/api/shop/use', (req, res) => {
    const { team, player, itemType, zoneCode } = req.body;
    const invKey = `${team}_${player}`;

    if (!playerInventory[invKey] || playerInventory[invKey][itemType] <= 0) {
        return res.status(400).json({ error: "Du hast dieses Item nicht im Rucksack!" });
    }

    // === GLOBALES ITEM: TEAM-REVIVE ===
    if (itemType === 'revive') {
        playerInventory[invKey][itemType] -= 1; 
        invNeedsSaving = true;
        if (globalMapData.gameSettings && globalMapData.gameSettings.teamCooldowns) {
            globalMapData.gameSettings.teamCooldowns[team] = 0;
            if(typeof gameSettings !== 'undefined') gameSettings.teamCooldowns[team] = 0;
        }
        mapVersion = Date.now(); mapNeedsSaving = true;
        return res.json({ success: true, message: "🚨 Team erfolgreich wiederbelebt!" });
    }

    if (!zoneCode) return res.status(400).json({ error: "Für dieses Item musst du an einer Zone sein!" });
    let zone = globalMapData.features.find(f => f.properties && f.properties.code === zoneCode);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden!" });

    // NEU: EMP Check, falls die Zone blockiert ist
    if (zone.properties.empUntil && zone.properties.empUntil > Date.now()) {
        return res.status(403).json({ error: "Zone ist durch EMP gestört! Items unwirksam." });
    }

    // Item verbrauchen
    playerInventory[invKey][itemType] -= 1; 
    invNeedsSaving = true;

    // === TASCHENDIEB ===
    if (itemType === 'taschendieb') {
        let zColor = zone.properties.color ? zone.properties.color.toLowerCase() : "";
        let enemyTeam = TEAM_COLORS[zColor];
        if (!enemyTeam || enemyTeam === team) return res.status(400).json({ error: "Zone gehört keinem Feind!" });

        let stealAmount = 15; 
        if (teamWallets[enemyTeam] < stealAmount) stealAmount = teamWallets[enemyTeam]; 
        teamWallets[enemyTeam] -= stealAmount;
        teamWallets[team] += stealAmount;
        return res.json({ success: true, message: `🕵️‍♂️ ${stealAmount} Coins von Team ${enemyTeam.toUpperCase()} gestohlen!` });
    }

    // === ENTSCHÄRFUNG ===
    if (itemType === 'entschaerfung') {
        delete zone.properties.traps;
        mapVersion = Date.now(); mapNeedsSaving = true;
        return res.json({ success: true, message: "✂️ Alle Fallen in dieser Zone sicher entschärft!" });
    }

    // === DROHNE ===
    if (itemType === 'drohne') {
        let trapCount = 0;
        if (zone.properties.traps) trapCount = zone.properties.traps.filter(t => t !== team).length;
        return res.json({ success: true, message: `🚁 Drohne meldet: ${trapCount} feindliche Falle(n) in dieser Zone entdeckt!` });
    }

    // === EMP GRANATE ===
    if (itemType === 'emp') {
        zone.properties.empUntil = Date.now() + (15 * 60 * 1000); // 15 Minuten Sperre
        mapVersion = Date.now(); mapNeedsSaving = true;
        return res.json({ success: true, message: "⚡ EMP gezündet! Zone für 5 Minuten komplett lahmgelegt." });
    }

    // === FALLEN & BUFFS ===
    if (!zone.properties.traps) zone.properties.traps = [];
    if (!zone.properties.buffs) zone.properties.buffs = [];

    if (itemType === 'trap') {
        if (zone.properties.traps.length >= 5) return res.status(400).json({ error: "Maximal 5 Fallen in dieser Zone!" });
        zone.properties.traps.push(team);
    } else if (itemType === 'buff') {
        if (zone.properties.buffs.length >= 5) return res.status(400).json({ error: "Maximal 5 Buffs in dieser Zone!" });
        zone.properties.buffs.push(team);
    }

    mapVersion = Date.now(); mapNeedsSaving = true;
    res.json({ success: true, message: `${itemType} erfolgreich platziert!` });
});

// 4. ADMIN: Inventar von Spielern verwalten
app.post('/api/inventory/manage', (req, res) => {
    const { team, player, itemType, amount, action } = req.body;
    if (!team || !player || !itemType) return res.status(400).json({ error: "Fehlende Daten" });

    let inv = getSafeInventory(`${team}_${player}`);
    let val = parseInt(amount) || 1;

    if (action === 'add') inv[itemType] += val;
    else if (action === 'sub') {
        inv[itemType] -= val;
        if (inv[itemType] < 0) inv[itemType] = 0;
    } else if (action === 'set') {
        inv[itemType] = val;
    }

    invNeedsSaving = true;
    res.json({ success: true, inventory: inv, message: `Inventar von ${team} Spieler ${player} aktualisiert!` });
});

// 5. ADMIN: Alle Inventare komplett leeren
app.post('/api/inventory/reset-all', (req, res) => {
    playerInventory = {}; 
    invNeedsSaving = true; 
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify({}));
    res.json({ success: true, message: "Alle Rucksäcke wurden erfolgreich geleert!" });
});

// COOLDOWN FREIKAUFEN (-2 Min)
app.post('/api/reduce-cooldown', (req, res) => {
    const { team, player } = req.body;
    const REDUCE_PRICE = 50; 
    
    if (teamWallets[team] < REDUCE_PRICE) return res.status(400).json({ error: "Nicht genug Münzen zum Freikaufen!" });

    teamWallets[team] -= REDUCE_PRICE;
    
    if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
    if (!globalMapData.gameSettings.teamCooldowns) globalMapData.gameSettings.teamCooldowns = {rot:5, blau:5, gruen:5, gelb:5};
    
    let currentCD = parseInt(globalMapData.gameSettings.teamCooldowns[team]) || 0;
    currentCD -= 2; 
    if (currentCD < 0) currentCD = 0;
    
    globalMapData.gameSettings.teamCooldowns[team] = currentCD;
    gameSettings.teamCooldowns[team] = currentCD;

    mapVersion = Date.now();
    mapNeedsSaving = true;
    
    console.log(`[SHOP] Team ${team} hat sich freigekauft. Neuer Cooldown: ${currentCD} Min.`);
    res.json({ success: true, newBalance: teamWallets[team] });
});


// ==========================================
// 🗺️ ZONEN VERWALTUNG (MAP SYNC)
// ==========================================
app.get('/api/zones', (req, res) => {
    const clientVersion = parseInt(req.query.v) || 0;
    if (clientVersion === mapVersion) return res.json({ unchanged: true });
    res.json({ version: mapVersion, data: globalMapData });
});

app.post('/api/zones', (req, res) => {
    const geoData = req.body;
    globalMapData = geoData; 
    mapVersion = Date.now(); 
    mapNeedsSaving = true;   

    if (geoData.gameSettings) {
        gameSettings = geoData.gameSettings; 
        if (geoData.gameSettings.payoutInterval) {
            const newMins = parseInt(geoData.gameSettings.payoutInterval);
            if (newMins !== currentPayoutMins) startPayoutLoop(newMins);
        }
    }
    res.json({ message: 'Zonen & Einstellungen erfolgreich aktualisiert!' });
});

// ==========================================
// ⚡ SUPER-SCHNELLE SCANNER-ROUTEN
// ==========================================
app.get('/api/zone/:code', (req, res) => {
    const { team, player } = req.query; // Neu: Wir fragen Team & Spieler ab
    if (!globalMapData.features) return res.status(404).json({ error: "Keine Zonen gefunden" });
    const zone = globalMapData.features.find(f => f.properties && f.properties.code === req.params.code);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    
    // Inventar des Spielers direkt mitschicken
    const invKey = `${team}_${player}`;
    let inv = playerInventory[invKey] || { trap: 0, buff: 0, revive: 0, emp: 0, defuse: 0, pickpocket: 0 };

    res.json({ zone: zone.properties, gameSettings: globalMapData.gameSettings || {}, inventory: inv });
});

app.post('/api/zone-action', (req, res) => {
    const { code, action, newColor, playerLat, playerLng, team, player, cooldownChange } = req.body;
    let zone = globalMapData.features.find(f => f.properties && f.properties.code === code);
    
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    if (zone.properties.locked) return res.status(403).json({ error: "Zone durch Admin gesperrt" });
    
  // NEU: EMP CHECK!
    if (zone.properties.empUntil && zone.properties.empUntil > Date.now()) {
        return res.status(403).json({ error: "⚡ Zone ist durch EMP gestört! Systemausfall." });
    }

    const isGpsRequired = (globalMapData.gameSettings && globalMapData.gameSettings.gpsRequired === false) ? false : true;

    // GPS Anti-Cheat
    function getDistanceInMeters(lat1, lon1, lat2, lon2) { /* ... Deine Mathe Formel bleibt gleich ... */ 
        const R = 6371e3; const p1 = lat1 * Math.PI / 180; const p2 = lat2 * Math.PI / 180;
        const dp = (lat2 - lat1) * Math.PI / 180; const dl = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    }
    function getPolygonCenter(coordinates) { /* ... Deine Mathe Formel bleibt gleich ... */ 
        let latSum = 0, lngSum = 0, count = 0; let coords = coordinates[0]; if(!Array.isArray(coords[0])) coords = coordinates;
        for (let i = 0; i < coords.length; i++) { lngSum += coords[i][0]; latSum += coords[i][1]; count++; }
        return { lat: latSum / count, lng: lngSum / count };
    }

    if (action !== 'trigger_items' && action !== 'defuse_traps' && isGpsRequired) { 
        if (!playerLat || !playerLng) return res.status(400).json({ error: "Standort fehlt!" });
        let center = getPolygonCenter(zone.geometry.coordinates);
        if (getDistanceInMeters(playerLat, playerLng, center.lat, center.lng) > MAX_INTERACT_DISTANCE) return res.status(403).json({ error: `Zu weit entfernt!` });
    }

    let resultMessage = null;

    if (action === 'upgrade') {
        zone.properties.level += 1;
    } else if (action === 'capture') { 
        // TASCHENDIEB CHECK
        let oldColor = zone.properties.color ? zone.properties.color.toLowerCase() : null;
        let oldTeam = oldColor ? TEAM_COLORS[oldColor] : null;

        if (oldTeam && oldTeam !== team) {
            let invKey = `${team}_${player}`;
            if (playerInventory[invKey] && playerInventory[invKey].pickpocket > 0) {
                playerInventory[invKey].pickpocket -= 1; // Item verbraucht!
                invNeedsSaving = true;

                let victimCoins = teamWallets[oldTeam];
                let stolen = Math.floor((victimCoins * 0.1) / 5) * 5; // Deine Mathe: 10%, abgerundet auf 5
                
                if (stolen > 0) {
                    teamWallets[oldTeam] -= stolen;
                    teamWallets[team] += stolen;
                    resultMessage = `🕵️ Taschendieb! Du hast ${stolen} Coins von ${oldTeam.toUpperCase()} gestohlen!`;
                } else {
                    resultMessage = `🕵️ Taschendieb verbraucht. Team ${oldTeam.toUpperCase()} war leider pleite.`;
                }
            }
        }

        let isGray = (zone.properties.color === "#808080" || !zone.properties.color);
        if (isGray && team) teamWallets[team] += 5;
        
        zone.properties.color = newColor; 
        zone.properties.level = 1; 

    } else if (action === 'attack') {
        zone.properties.level -= 1;
        if (zone.properties.level <= 0) { 
            zone.properties.color = "#808080"; 
            zone.properties.level = 0; 
            delete zone.properties.traps; delete zone.properties.buffs; delete zone.properties.empUntil;
        }
    } else if (action === 'trigger_items') {
        delete zone.properties.traps; delete zone.properties.buffs;
        if (cooldownChange && team) {
            if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
            if (!globalMapData.gameSettings.teamCooldowns) globalMapData.gameSettings.teamCooldowns = {rot:5, blau:5, gruen:5, gelb:5};
            let currentCD = parseInt(globalMapData.gameSettings.teamCooldowns[team]) || 0;
            globalMapData.gameSettings.teamCooldowns[team] = Math.max(0, currentCD + cooldownChange);
            gameSettings.teamCooldowns[team] = Math.max(0, currentCD + cooldownChange);
        }
    } else if (action === 'defuse_traps') {
        // ENTSCHÄRFUNGS-KIT CHECK
        let invKey = `${team}_${player}`;
        if (playerInventory[invKey] && playerInventory[invKey].defuse > 0) {
            playerInventory[invKey].defuse -= 1; // Item verbraucht!
            invNeedsSaving = true;
            delete zone.properties.traps; // Fallen weg, kein Cooldown!
        }
    }

    mapVersion = Date.now(); 
    mapNeedsSaving = true;   
    res.json({ success: true, stealMessage: resultMessage });
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
    }
    res.json({ success: true });
});

app.get('/api/admin/cooldown-states', (req, res) => {
    let currentDurations = { rot: 5, blau: 5, gruen: 5, gelb: 5 };
    if (gameSettings && gameSettings.teamCooldowns) currentDurations = gameSettings.teamCooldowns;
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
        }
    }
    res.json({ success: true, resetTime: now });
});


// ==========================================
// 📍 SPIELER STANDORTE & TRAILS
// ==========================================
let playerLocations = {};
let playerTrails = {}; 
let trailsNeedSaving = false;

// Beim Start Spuren laden
if (fs.existsSync(TRAILS_FILE)) {
    try {
        playerTrails = JSON.parse(fs.readFileSync(TRAILS_FILE));
        console.log("✅ GPS-Spuren erfolgreich in den RAM geladen!");
    } catch (e) { console.error("❌ Fehler beim Laden der trails.json:", e); }
}

// Spuren speichern (10 sekunden Intervall)
setInterval(() => {
    if (trailsNeedSaving) {
        fs.writeFile(TRAILS_FILE, JSON.stringify(playerTrails, null, 2), (err) => {
            if (err) console.error("❌ Fehler beim Speichern der Trails:", err);
            else trailsNeedSaving = false;
        });
    }
}, 10000);

// Standort vom Handy empfangen
app.post('/api/location', (req, res) => {
    const { id, lat, lng, team, name } = req.body;
    playerLocations[id] = { lat, lng, team, name, lastUpdate: new Date() };

    // SPUREN AUFZEICHNUNG
    if (!playerTrails[id]) playerTrails[id] = { team: team, name: name, path: [] };
    let path = playerTrails[id].path;
    
    if (path.length === 0) {
        path.push([lat, lng]);
        trailsNeedSaving = true;
    } else {
        let lastP = path[path.length - 1];
        // Nur Punkte speichern, wenn Spieler mehr als 5 Meter gelaufen ist
        if (getDistanceInMeters(lat, lng, lastP[0], lastP[1]) > 5) {
            path.push([lat, lng]);
            trailsNeedSaving = true;
        }
    }
    res.json({ status: "Location received" });
});

app.get('/api/location', (req, res) => { 
    res.json(playerLocations); 
});

// Admin holt sich die Spuren
app.get('/api/trails', (req, res) => { 
    res.json(playerTrails); 
});

// Admin löscht die Spuren
app.post('/api/trails/reset', (req, res) => {
    playerTrails = {}; 
    fs.writeFileSync(TRAILS_FILE, JSON.stringify({}));
    trailsNeedSaving = false; 
    console.log("[ADMIN] GPS-Spuren gelöscht.");
    res.json({ success: true, message: "Spuren gelöscht" });
});

// ==========================================
// 💬 CHAT SYSTEM
// ==========================================
let chatMessages = []; 
let chatVersion = Date.now(); 

app.get('/api/chat', (req, res) => {
    const clientVersion = parseInt(req.query.v) || 0;
    if (clientVersion === chatVersion) return res.json({ unchanged: true }); 
    res.json({ version: chatVersion, messages: chatMessages });
});

app.post('/api/chat', (req, res) => {
    try {
        const newMsg = req.body;
        if (!newMsg || !newMsg.message) return res.status(400).json({ success: false });
        newMsg.timestamp = Date.now();
        chatMessages.push(newMsg);
        
        // Chat auf die letzten 200 Nachrichten beschränken
        if (chatMessages.length > 200) chatMessages.shift(); 
        
        chatVersion = Date.now(); 
        res.json({ success: true });
    } catch(err) { 
        res.status(500).json({ success: false }); 
    }
});

app.post('/api/chat/reset', (req, res) => {
    chatMessages = []; 
    chatVersion = Date.now(); 
    console.log("[ADMIN] Chat gelöscht.");
    res.json({ success: true });
});

// ==========================================
// 🚀 SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📡 RAM-Datenbank aktiv! ONE-FILE Modus sauber formatiert.`);
});