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
const INVENTORY_FILE = path.join(__dirname, 'inventory.json'); 

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// ==========================================
// 🧮 GLOBALE HILFS-FUNKTIONEN (GPS Mathe)
// ==========================================
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
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
    if(!Array.isArray(coords[0])) coords = coordinates; 

    for (let i = 0; i < coords.length; i++) {
        lngSum += coords[i][0]; 
        latSum += coords[i][1];
        count++;
    }
    return { lat: latSum / count, lng: lngSum / count };
}

const MAX_INTERACT_DISTANCE = 60; 

// ==========================================
// 🗺️ KARTEN-DATENBANK (RAM-Trick)
// ==========================================
let gameSettings = {}; 
let globalMapData = { type: "FeatureCollection", features: [] };
let mapNeedsSaving = false;
let mapVersion = Date.now();

if (fs.existsSync(ZONES_FILE)) {
    try {
        globalMapData = JSON.parse(fs.readFileSync(ZONES_FILE));
        if (globalMapData.gameSettings) gameSettings = globalMapData.gameSettings; 
        console.log("✅ Zonen-Karte erfolgreich in den RAM geladen!");
    } catch (e) {
        console.error("❌ Fehler beim Laden der zones.json:", e);
    }
}

setInterval(() => {
    if (mapNeedsSaving) {
        fs.writeFile(ZONES_FILE, JSON.stringify(globalMapData, null, 2), (err) => {
            if (err) console.error("❌ Fehler beim Speichern:", err);
            else mapNeedsSaving = false;
        });
    }
}, 5000);

// ==========================================
// 🎒 PERSÖNLICHES INVENTAR (RUCKSACK)
// ==========================================
let playerInventory = {};
let invNeedsSaving = false;

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
            if (err) console.error("❌ Fehler beim Speichern:", err);
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
                
                let coins = 0;
                if (level === 1) coins = 5;
                if (level === 2) coins = 10;
                if (level === 3) coins = 15;

                // 👑 KING OF THE HILL MULTIPLIKATOR
                if (f.properties.isKotH) coins *= 3;

                newCoins[team] += coins;
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

setInterval(() => {
    if (!globalMapData.gameSettings) return;
    let adminSetMins = parseInt(globalMapData.gameSettings.payoutInterval) || 45;
    if (adminSetMins !== currentPayoutMins) startPayoutLoop(adminSetMins);
}, 5000);

setTimeout(() => {
    let initialMins = (globalMapData.gameSettings && globalMapData.gameSettings.payoutInterval) ? parseInt(globalMapData.gameSettings.payoutInterval) : 45;
    distributeCoins();
    startPayoutLoop(initialMins);
}, 2000); 

app.get('/api/coins', (req, res) => { res.json(teamWallets); });

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
function getSafeInventory(invKey) {
    if (!playerInventory[invKey]) {
        playerInventory[invKey] = { trap: 0, buff: 0, revive: 0, emp: 0, defuse: 0, pickpocket: 0 };
    }
    const allItems = ['trap', 'buff', 'revive', 'emp', 'defuse', 'pickpocket'];
    allItems.forEach(item => {
        if (typeof playerInventory[invKey][item] !== 'number' || isNaN(playerInventory[invKey][item])) {
            playerInventory[invKey][item] = 0;
        }
    });
    return playerInventory[invKey];
}

app.get('/api/inventory', (req, res) => {
    const { team, player } = req.query;
    res.json(getSafeInventory(`${team}_${player}`));
});

app.post('/api/shop/buy', (req, res) => {
    const { team, player, itemType } = req.body;
    
    const PRICES = { 'trap': 30, 'buff': 30, 'revive': 200, 'emp': 80, 'defuse': 40, 'pickpocket': 30 };
    const price = PRICES[itemType];
    
    if (!price) return res.status(400).json({ error: "Unbekanntes Item!" });
    if (teamWallets[team] < price) return res.status(400).json({ error: "Nicht genug Coins!" });

    teamWallets[team] -= price;
    
    let inv = getSafeInventory(`${team}_${player}`);
    inv[itemType] += 1; 
    invNeedsSaving = true;

    res.json({ success: true, newBalance: teamWallets[team], inventory: inv });
});

app.post('/api/shop/use', (req, res) => {
    const { team, player, itemType, zoneCode } = req.body;
    let inv = getSafeInventory(`${team}_${player}`);

    if (inv[itemType] <= 0) return res.status(400).json({ error: "Du hast dieses Item nicht im Rucksack!" });

    if (itemType === 'revive') {
        inv[itemType] -= 1;
        invNeedsSaving = true;
        
        if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
        if (!globalMapData.gameSettings.teamReviveTimes) globalMapData.gameSettings.teamReviveTimes = {};
        globalMapData.gameSettings.teamReviveTimes[team] = Date.now();
        
        if (playerStates[team]) {
            for (let p in playerStates[team]) playerStates[team][p].lastScan = 0;
        }

        mapVersion = Date.now(); mapNeedsSaving = true;
        return res.json({ success: true, message: "🚨 Team erfolgreich wiederbelebt!" });
    }

    if (!zoneCode) return res.status(400).json({ error: "Du musst an einer Zone sein!" });
    let zone = globalMapData.features.find(f => f.properties && f.properties.code === zoneCode);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden!" });

    if (zone.properties.empUntil && zone.properties.empUntil > Date.now()) {
        return res.status(403).json({ error: "Zone ist durch EMP gestört! Items unwirksam." });
    }

    inv[itemType] -= 1;
    invNeedsSaving = true;

    if (itemType === 'trap') {
        if (!zone.properties.traps) zone.properties.traps = [];
        if (zone.properties.traps.length >= 5) return res.status(400).json({ error: "Maximal 5 Fallen erlaubt!" });
        zone.properties.traps.push(team);
    } else if (itemType === 'buff') {
        if (!zone.properties.buffs) zone.properties.buffs = [];
        if (zone.properties.buffs.length >= 5) return res.status(400).json({ error: "Maximal 5 Buffs erlaubt!" });
        zone.properties.buffs.push(team);
    } else if (itemType === 'emp') {
        zone.properties.empUntil = Date.now() + (5 * 60 * 1000); // 5 Min sperren
    }

    mapVersion = Date.now(); mapNeedsSaving = true;
    res.json({ success: true, message: `${itemType} erfolgreich eingesetzt!` });
});

app.post('/api/inventory/manage', (req, res) => {
    const { team, player, itemType, amount, action } = req.body;
    if (!team || !player || !itemType) return res.status(400).json({ error: "Fehlende Daten" });

    let inv = getSafeInventory(`${team}_${player}`);
    let val = parseInt(amount) || 1;

    if (action === 'add') inv[itemType] += val;
    else if (action === 'sub') {
        inv[itemType] -= val;
        if (inv[itemType] < 0) inv[itemType] = 0;
    } else if (action === 'set') inv[itemType] = val;

    invNeedsSaving = true;
    res.json({ success: true, inventory: inv, message: `Inventar von ${team} Spieler ${player} aktualisiert!` });
});

app.post('/api/inventory/reset-all', (req, res) => {
    playerInventory = {}; invNeedsSaving = true; 
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify({}));
    res.json({ success: true, message: "Alle Rucksäcke geleert!" });
});


// ==========================================
// 👑 ADMIN: KOTH & HQ VERWALTUNG
// ==========================================
app.post('/api/admin/set-zone-special', (req, res) => {
    const { code, isKotH, hqTeam } = req.body;
    let zone = globalMapData.features.find(f => f.properties && f.properties.code === code);
    
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });

    if (isKotH !== undefined) zone.properties.isKotH = isKotH;
    if (hqTeam !== undefined) {
        zone.properties.hqTeam = hqTeam;
        
        if (hqTeam !== "") {
            if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
            if (!globalMapData.gameSettings.fallenTeams) globalMapData.gameSettings.fallenTeams = {};
            globalMapData.gameSettings.fallenTeams[hqTeam] = false;
            if(typeof gameSettings !== 'undefined') gameSettings.fallenTeams = globalMapData.gameSettings.fallenTeams;
        }
    }

    mapVersion = Date.now();
    mapNeedsSaving = true;

    res.json({ success: true, message: "Zonen-Eigenschaften aktualisiert!" });
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
    globalMapData = geoData; mapVersion = Date.now(); mapNeedsSaving = true;   

    if (geoData.gameSettings) {
        gameSettings = geoData.gameSettings; 
        if (geoData.gameSettings.payoutInterval) {
            const newMins = parseInt(geoData.gameSettings.payoutInterval);
            if (newMins !== currentPayoutMins) startPayoutLoop(newMins);
        }
    }
    res.json({ message: 'Zonen erfolgreich aktualisiert!' });
});

// ==========================================
// 📊 SPIELER-AKTEN & STATISTIKEN (NEU)
// ==========================================
// 🚨 FIX: Alle 12 Spieler werden direkt beim Serverstart sauber geladen, inklusive trapsHit!
let playerStates = {
    rot:  { "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } },
    blau: { "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } },
    gruen:{ "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } },
    gelb: { "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } }
};

function getSafePlayerState(team, player) {
    if (!playerStates[team]) playerStates[team] = {};
    if (!playerStates[team][player]) playerStates[team][player] = { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 };
    if (typeof playerStates[team][player].hacks !== 'number') playerStates[team][player].hacks = 0;
    if (typeof playerStates[team][player].distance !== 'number') playerStates[team][player].distance = 0;
    if (typeof playerStates[team][player].trapsHit !== 'number') playerStates[team][player].trapsHit = 0;
    return playerStates[team][player];
}

app.get('/api/stats', (req, res) => {
    const { team, player } = req.query;
    
    let zoneCounts = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
    if (globalMapData.features) {
        globalMapData.features.forEach(f => {
            if (f.properties.type === "zone" && f.properties.color) {
                let t = TEAM_COLORS[f.properties.color.toLowerCase()];
                if (t) zoneCounts[t]++;
            }
        });
    }

    let pState = getSafePlayerState(team, player);

    res.json({
        leaderboard: {
            rot: { coins: teamWallets.rot, zones: zoneCounts.rot },
            blau: { coins: teamWallets.blau, zones: zoneCounts.blau },
            gruen: { coins: teamWallets.gruen, zones: zoneCounts.gruen },
            gelb: { coins: teamWallets.gelb, zones: zoneCounts.gelb }
        },
        personal: {
            hacks: pState.hacks,
            distance: pState.distance.toFixed(2),
            trapsHit: pState.trapsHit // 🚨 NEU: Geht ans Dashboard
        },
        teamCooldowns: (globalMapData.gameSettings && globalMapData.gameSettings.teamCooldowns) ? globalMapData.gameSettings.teamCooldowns : {rot:0, blau:0, gruen:0, gelb:0}
    });
});

app.post('/api/player-scan', (req, res) => {
    const { team, player, timestamp } = req.body; 
    let pState = getSafePlayerState(team, player);
    pState.lastScan = timestamp;
    res.json({ success: true });
});

app.get('/api/admin/cooldown-states', (req, res) => {
    let currentDurations = { rot: 5, blau: 5, gruen: 5, gelb: 5 };
    let fallen = {}; 
    
    if (globalMapData.gameSettings) {
        if (globalMapData.gameSettings.teamCooldowns) currentDurations = globalMapData.gameSettings.teamCooldowns;
        if (globalMapData.gameSettings.fallenTeams) fallen = globalMapData.gameSettings.fallenTeams;
    }
    res.json({ states: playerStates, durations: currentDurations, fallenTeams: fallen });
});

app.post('/api/admin/revive-team', (req, res) => {
    const { team } = req.body;
    if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
    if (!globalMapData.gameSettings.fallenTeams) globalMapData.gameSettings.fallenTeams = {};
    
    globalMapData.gameSettings.fallenTeams[team] = false;
    if(typeof gameSettings !== 'undefined') gameSettings.fallenTeams = globalMapData.gameSettings.fallenTeams;
    
    mapVersion = Date.now(); mapNeedsSaving = true;
    res.json({ success: true });
});

app.post('/api/reset-cooldowns', (req, res) => {
    const now = Date.now();
    gameSettings.cooldownResetTime = now; 

    if(!globalMapData.gameSettings) globalMapData.gameSettings = {};
    globalMapData.gameSettings.cooldownResetTime = now;
    
    globalMapData.gameSettings.fallenTeams = {};
    if(typeof gameSettings !== 'undefined') gameSettings.fallenTeams = {};

    mapVersion = Date.now(); mapNeedsSaving = true;

    for (let t in playerStates) {
        for (let p in playerStates[t]) playerStates[t][p].lastScan = 0;
    }
    res.json({ success: true, resetTime: now });
});

// 🛠️ ADMIN RETTUNGS-ROUTE FÜR STATS: Alles auf 0 setzen
app.post('/api/admin/reset-stats', (req, res) => {
    for (let t in playerStates) {
        for (let p in playerStates[t]) {
            playerStates[t][p].hacks = 0;
            playerStates[t][p].distance = 0;
            playerStates[t][p].trapsHit = 0;
        }
    }
    res.json({ success: true, message: "📊 Alle Spieler-Laufstatistiken & Abzeichen wurden gelöscht!" });
});

// ==========================================
// ⚡ SUPER-SCHNELLE SCANNER-ROUTEN
// ==========================================
app.get('/api/zone/:code', (req, res) => {
    const { team, player } = req.query; 
    if (!globalMapData.features) return res.status(404).json({ error: "Keine Zonen gefunden" });
    const zone = globalMapData.features.find(f => f.properties && f.properties.code === req.params.code);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    
    const invKey = `${team}_${player}`;
    let inv = playerInventory[invKey] || { trap: 0, buff: 0, revive: 0, emp: 0, defuse: 0, pickpocket: 0 };
    res.json({ zone: zone.properties, gameSettings: globalMapData.gameSettings || {}, inventory: inv });
});

app.post('/api/zone-action', (req, res) => {
    // 🚨 NEU: 'trapsHit' aus dem Request auslesen
    const { code, action, newColor, playerLat, playerLng, team, player, cooldownChange, trapsHit } = req.body;
    let zone = globalMapData.features.find(f => f.properties && f.properties.code === code);
    
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    if (zone.properties.locked) return res.status(403).json({ error: "Zone durch Admin gesperrt" });
    
    if (zone.properties.empUntil && zone.properties.empUntil > Date.now()) {
        return res.status(403).json({ error: "⚡ Zone ist durch EMP gestört! Systemausfall." });
    }

    const isGpsRequired = (globalMapData.gameSettings && globalMapData.gameSettings.gpsRequired === false) ? false : true;

    if (action !== 'trigger_items' && action !== 'defuse_traps' && isGpsRequired) { 
        if (!playerLat || !playerLng) return res.status(400).json({ error: "Standort fehlt!" });
        let center = getPolygonCenter(zone.geometry.coordinates);
        if (getDistanceInMeters(playerLat, playerLng, center.lat, center.lng) > MAX_INTERACT_DISTANCE) return res.status(403).json({ error: `Zu weit entfernt!` });
    }

    // 🕵️ HACKS & FALLEN ZÄHLEN FÜR STATISTIKEN
    let pState = getSafePlayerState(team, player);
    if (['capture', 'upgrade', 'attack'].includes(action)) {
        pState.hacks += 1;
    }
    if (trapsHit > 0) {
        pState.trapsHit += trapsHit;
    }

    let resultMessage = null;
    let noCooldown = false; 

    let oldColor = zone.properties.color ? zone.properties.color.toLowerCase() : null;
    let oldTeam = oldColor ? TEAM_COLORS[oldColor] : null;

    if (action === 'attack' && oldTeam && oldTeam !== team) {
        if (globalMapData.gameSettings && globalMapData.gameSettings.fallenTeams && globalMapData.gameSettings.fallenTeams[oldTeam]) {
            noCooldown = true; 
        }
    }

    if (action === 'upgrade') {
        zone.properties.level += 1;
    } else if (action === 'capture') { 
        if (oldTeam && oldTeam !== team) {
            let invKey = `${team}_${player}`;
            if (playerInventory[invKey] && playerInventory[invKey].pickpocket > 0) {
                playerInventory[invKey].pickpocket -= 1; 
                invNeedsSaving = true;

                let victimCoins = teamWallets[oldTeam];
                let stolen = Math.floor((victimCoins * 0.1) / 5) * 5; 
                
                if (stolen > 0) {
                    teamWallets[oldTeam] -= stolen;
                    teamWallets[team] += stolen;
                    resultMessage = `🕵️ Taschendieb! Du hast ${stolen} Coins von ${oldTeam.toUpperCase()} gestohlen!`;
                }
            }
        }

        let isGray = (zone.properties.color === "#808080" || !zone.properties.color);
        if (isGray && team) teamWallets[team] += 5;
        
        zone.properties.color = newColor; 
        zone.properties.level = 1; 

    } else if (action === 'attack') {
        let isHQ = (zone.properties.hqTeam && zone.properties.color && TEAM_COLORS[zone.properties.color.toLowerCase()] === zone.properties.hqTeam);
        
        if (isHQ && !zone.properties.hqArmorHit) {
            zone.properties.hqArmorHit = true; 
            mapVersion = Date.now(); mapNeedsSaving = true;
            return res.json({ success: true, message: "🛡️ HQ Panzerung getroffen! Du musst noch einmal scannen, um das Level zu senken.", noCooldown: noCooldown });
        }
        
        zone.properties.hqArmorHit = false; 
        zone.properties.level -= 1;
        
        if (zone.properties.level <= 0) { 
            let deadHQTeam = zone.properties.hqTeam; 
            
            zone.properties.color = "#808080"; 
            zone.properties.level = 0; 
            delete zone.properties.traps; delete zone.properties.buffs; delete zone.properties.empUntil; delete zone.properties.hqArmorHit;
            zone.properties.hqTeam = ""; 
            
            if (deadHQTeam && deadHQTeam === oldTeam) {
                if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
                if (!globalMapData.gameSettings.fallenTeams) globalMapData.gameSettings.fallenTeams = {};
                globalMapData.gameSettings.fallenTeams[deadHQTeam] = true;
                if(typeof gameSettings !== 'undefined') gameSettings.fallenTeams = globalMapData.gameSettings.fallenTeams;
                
                resultMessage = `💥 HAUPTQUARTIER ZERSTÖRT! Alle Zonen von Team ${deadHQTeam.toUpperCase()} sind nun schutzlos und können ohne Cooldown erobert werden!`;
            }
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
        let invKey = `${team}_${player}`;
        if (playerInventory[invKey] && playerInventory[invKey].defuse > 0) {
            playerInventory[invKey].defuse -= 1; 
            invNeedsSaving = true;
            delete zone.properties.traps; 
        }
    }

    mapVersion = Date.now(); mapNeedsSaving = true;   
    res.json({ success: true, message: resultMessage || "Aktion erfolgreich ausgeführt!", noCooldown: noCooldown });
});

// ==========================================
// 📍 SPIELER STANDORTE & TRAILS (MIT SCHRITTZÄHLER!)
// ==========================================

let playerLocations = {};
let playerTrails = {}; 
let trailsNeedSaving = false;

if (fs.existsSync(TRAILS_FILE)) {
    try { playerTrails = JSON.parse(fs.readFileSync(TRAILS_FILE)); } 
    catch (e) { console.error("❌ Fehler:", e); }
}

setInterval(() => {
    if (trailsNeedSaving) fs.writeFile(TRAILS_FILE, JSON.stringify(playerTrails, null, 2), () => { trailsNeedSaving = false; });
}, 10000);

app.post('/api/location', (req, res) => {
    let { id, lat, lng, team, name } = req.body;
    const now = Date.now();

    // 🧠 GPS KALMAN-LITE & AUSREISSER-FILTER
    if (playerLocations[id]) {
        let lastLoc = playerLocations[id];
        let timeDiffSec = (now - lastLoc.lastUpdate) / 1000;
        if (timeDiffSec <= 0) timeDiffSec = 0.1; // Div/0 Schutz
        
        let dist = getDistanceInMeters(lastLoc.lat, lastLoc.lng, lat, lng);
        let speedMps = dist / timeDiffSec; // Meter pro Sekunde

        // 🛑 1. Ausreißer blockieren (Schneller als 12 m/s = ~43 km/h -> Spieler in der Stadt = unmöglich)
        if (speedMps > 12) {
            console.log(`🛡️ GPS-Ausreißer ignoriert: ${team} ${name} (${speedMps.toFixed(1)} m/s)`);
            return res.json({ status: "Ignored (Jump)" });
        }

        // 🌊 2. Kalman-Lite Glättung (Exponential Moving Average)
        // Beseitigt das "Zittern" an Ort und Stelle.
        let smoothFactor = 0.6; // Normal: 60% neuer Wert, 40% alter Wert
        if (speedMps < 1.0) {
            // Wenn der Spieler fast steht, sehr stark glätten, damit die Position nicht wandert!
            smoothFactor = 0.15; 
        }

        lat = lastLoc.lat + smoothFactor * (lat - lastLoc.lat);
        lng = lastLoc.lng + smoothFactor * (lng - lastLoc.lng);
    }

    // Geglätteten Standort updaten
    playerLocations[id] = { lat, lng, team, name, lastUpdate: now };

    // 🐾 SPUREN & SCHRITTZÄHLER ZEICHNEN
    if (!playerTrails[id]) playerTrails[id] = { team: team, name: name, path: [] };
    let path = playerTrails[id].path;
    
    let distAdded = 0;
    if (path.length === 0) {
        path.push([lat, lng]); trailsNeedSaving = true;
    } else {
        let lastP = path[path.length - 1];
        distAdded = getDistanceInMeters(lat, lng, lastP[0], lastP[1]);
        
        // Nur auf die Karte malen, wenn mehr als 5 Meter gelaufen (Verhindert "Tintenkleckse" auf der Karte)
        if (distAdded > 5) { 
            path.push([lat, lng]); trailsNeedSaving = true; 
        } else {
            distAdded = 0; 
        }
    }

    // 🏃‍♂️ SCHRITTZÄHLER FÜR DIE AKTE
    if (distAdded > 0) {
        let pState = getSafePlayerState(team, name); // 'name' ist meist 1, 2, 3
        pState.distance += (distAdded / 1000); // In km umrechnen
    }

    res.json({ status: "Location received" });
});

app.get('/api/location', (req, res) => { res.json(playerLocations); });
app.get('/api/trails', (req, res) => { res.json(playerTrails); });

app.post('/api/trails/reset', (req, res) => {
    playerTrails = {}; fs.writeFileSync(TRAILS_FILE, JSON.stringify({}));
    trailsNeedSaving = false; res.json({ success: true, message: "Spuren gelöscht" });
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
        if (chatMessages.length > 200) chatMessages.shift(); 
        chatVersion = Date.now(); 
        res.json({ success: true });
    } catch(err) { res.status(500).json({ success: false }); }
});

app.post('/api/chat/reset', (req, res) => {
    chatMessages = []; chatVersion = Date.now(); 
    res.json({ success: true });
});

// ==========================================
// 🚀 SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📡 RAM-Datenbank aktiv! ONE-FILE Modus.`);
});