const express = require('express');
const http = require('http'); // 🚨 NEU für Sockets
const { Server } = require('socket.io'); // 🚨 NEU für Sockets
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3'); // 🚨 NEU für SQLite-Datenbank

const app = express();
const server = http.createServer(app); // 🚨 Server einwickeln
const io = new Server(server, { cors: { origin: '*' } }); // 🚨 Sockets starten
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

let globalVersions = { coins: Date.now(), stats: Date.now(), loc: Date.now(), inv: Date.now() };

// ==========================================
// 🗄️ DATENBANK & AUTOMATISCHE MIGRATION
// ==========================================
const db = new Database('game.db'); // Erstellt oder lädt die game.db

// Tabelle erstellen, falls sie noch nicht existiert
db.exec(`
  CREATE TABLE IF NOT EXISTS game_data (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Prüfen, ob die DB leer ist (für die JSON-Migration)
const dbCount = db.prepare('SELECT COUNT(*) as count FROM game_data').get().count;

if (dbCount === 0) {
    console.log("⚠️ Datenbank ist leer! Starte Migration der alten JSON-Dateien...");
    
    const migrateFile = (filePath, key) => {
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                db.prepare('INSERT INTO game_data (key, value) VALUES (?, ?)').run(key, data);
                console.log(`✅ Datei ${path.basename(filePath)} erfolgreich in Datenbank übertragen (Key: ${key})`);
            } catch (e) {
                console.error(`❌ Fehler bei Migration von ${filePath}:`, e);
            }
        }
    };

    // Übertragen der alten JSON-Dateien in die SQLite DB
    migrateFile(path.join(__dirname, 'zones.json'), 'zones');
    migrateFile(path.join(__dirname, 'trails.json'), 'trails');
    migrateFile(path.join(__dirname, 'inventory.json'), 'inventory');
    migrateFile(path.join(__dirname, 'server_state.json'), 'server_state');
    console.log("✅ Migration abgeschlossen! Das Spiel nutzt nun SQLite.");
}

// 🛡️ Hilfsfunktionen für das sichere Lesen & Schreiben in der DB
function loadData(key, defaultVal) {
    const row = db.prepare('SELECT value FROM game_data WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : defaultVal;
}

function saveData(key, data) {
    db.prepare('INSERT OR REPLACE INTO game_data (key, value) VALUES (?, ?)').run(key, JSON.stringify(data));
}


// ==========================================
// 📡 SOCKET TRIGGER FUNKTIONEN
// ==========================================
function triggerMapUpdate() {
    mapVersion = Date.now();
    mapNeedsSaving = true;
    io.emit('update_map'); 
}

function triggerStateUpdate(types = []) {
    stateNeedsSaving = true;
    let now = Date.now();
    if (types.includes('coins')) { globalVersions.coins = now; io.emit('update_coins'); }
    if (types.includes('stats')) { globalVersions.stats = now; io.emit('update_stats'); }
    if (types.includes('inv')) { globalVersions.inv = now; io.emit('update_inv'); }
}

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
    for (let i = 0; i < coords.length; i++) { lngSum += coords[i][0]; latSum += coords[i][1]; count++; }
    return { lat: latSum / count, lng: lngSum / count };
}
const MAX_INTERACT_DISTANCE = 60; 

// ==========================================
// 🗺️ KARTEN-DATENBANK (Jetzt über SQLite!)
// ==========================================
let gameSettings = {}; 
let globalMapData = loadData('zones', { type: "FeatureCollection", features: [] });
if (globalMapData.gameSettings) gameSettings = globalMapData.gameSettings; 

let mapNeedsSaving = false;
let mapVersion = Date.now();

setInterval(() => {
    if (mapNeedsSaving) {
        saveData('zones', globalMapData);
        mapNeedsSaving = false;
    }
}, 5000);

// ==========================================
// 🎒 PERSÖNLICHES INVENTAR (RUCKSACK)
// ==========================================
let playerInventory = loadData('inventory', {});
let invNeedsSaving = false;

setInterval(() => {
    if (invNeedsSaving) {
        saveData('inventory', playerInventory);
        invNeedsSaving = false;
    }
}, 8000);

// ==========================================
// 📊 SPIELER-AKTEN & SERVER-STATE
// ==========================================
let teamWallets = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
let playerStates = {
    rot:  { "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } },
    blau: { "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } },
    gruen:{ "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } },
    gelb: { "1": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "2": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 }, "3": { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 } }
};
let stateNeedsSaving = false;

let savedState = loadData('server_state', {});
if (savedState.teamWallets) teamWallets = savedState.teamWallets;
if (savedState.playerStates) {
    for (let t in savedState.playerStates) { if (playerStates[t]) Object.assign(playerStates[t], savedState.playerStates[t]); }
}

setInterval(() => {
    if (stateNeedsSaving) {
        saveData('server_state', { teamWallets, playerStates });
        stateNeedsSaving = false;
    }
}, 5000);

function getSafePlayerState(team, player) {
    if (!playerStates[team]) playerStates[team] = {};
    if (!playerStates[team][player]) playerStates[team][player] = { lastScan: 0, hacks: 0, distance: 0, trapsHit: 0 };
    return playerStates[team][player];
}

// ==========================================
// 💰 WIRTSCHAFT & AUTO-PAYOUT
// ==========================================
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
                let coins = level === 1 ? 5 : level === 2 ? 10 : level === 3 ? 15 : 0;
                if (f.properties.isKotH) coins *= 3;
                newCoins[team] += coins;
                didPayout = true;
            }
        });
    }
    
    if (didPayout) {
        for (let t in newCoins) teamWallets[t] += newCoins[t];
        triggerStateUpdate(['coins', 'stats']);
        console.log(`Auto-Payout! \n Kontostand:`, teamWallets);
    }
}

function startPayoutLoop(mins) {
    if (payoutTimer) clearInterval(payoutTimer);
    currentPayoutMins = mins > 0 ? mins : 45; 
    payoutTimer = setInterval(distributeCoins, currentPayoutMins * 60 * 1000);
    console.log(`⏱Payout-Intervall auf ${currentPayoutMins} Minuten gesetzt.`);
}

setInterval(() => {
    if (!globalMapData.gameSettings) return;
    let adminSetMins = parseInt(globalMapData.gameSettings.payoutInterval) || 45;
    if (adminSetMins !== currentPayoutMins) startPayoutLoop(adminSetMins);
}, 5000);

setTimeout(() => { distributeCoins(); startPayoutLoop(currentPayoutMins); }, 2000); 

app.get('/api/coins', (req, res) => { 
    const clientVersion = parseInt(req.query.v) || 0;
    if (clientVersion === globalVersions.coins) return res.json({ unchanged: true });
    res.json({ version: globalVersions.coins, data: teamWallets }); 
});

app.post('/api/coins/manage', (req, res) => {
    const { team, amount, action } = req.body;
    let val = parseInt(amount) || 0;
    
    if (action === 'reset_all') {
        teamWallets = { rot: 0, blau: 0, gruen: 0, gelb: 0 };
        triggerStateUpdate(['coins', 'stats']);
        return res.json({ success: true, message: "Alle Kassen auf 0", wallets: teamWallets });
    }

    if (!teamWallets.hasOwnProperty(team)) return res.status(400).json({ error: "Team nicht gefunden" });

    if (action === 'add') teamWallets[team] += val;
    if (action === 'sub') { teamWallets[team] -= val; if (teamWallets[team] < 0) teamWallets[team] = 0; }
    if (action === 'set') teamWallets[team] = val;

    triggerStateUpdate(['coins', 'stats']);
    res.json({ success: true, message: `Aktualisiert!`, wallets: teamWallets });
});

// ==========================================
// 🛒 SHOP & INVENTAR SYSTEM
// ==========================================
function getSafeInventory(invKey) {
    if (!playerInventory[invKey]) playerInventory[invKey] = { trap: 0, buff: 0, revive: 0, emp: 0, defuse: 0, pickpocket: 0 };
    
    // Alte Rucksäcke um neue Items ergänzen, falls sie fehlen
    if (playerInventory[invKey].defuse === undefined) playerInventory[invKey].defuse = 0;
    if (playerInventory[invKey].pickpocket === undefined) playerInventory[invKey].pickpocket = 0;
    if (playerInventory[invKey].revive === undefined) playerInventory[invKey].revive = 0;
    if (playerInventory[invKey].emp === undefined) playerInventory[invKey].emp = 0;

    return playerInventory[invKey];
}

app.get('/api/inventory', (req, res) => {
    const clientVersion = parseInt(req.query.v) || 0;
    if (clientVersion === globalVersions.inv) return res.json({ unchanged: true });
    const { team, player } = req.query;
    res.json({ version: globalVersions.inv, data: getSafeInventory(`${team}_${player}`) });
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
    triggerStateUpdate(['coins', 'stats', 'inv']);
    res.json({ success: true });
});

app.post('/api/shop/use', (req, res) => {
    const { team, player, itemType, zoneCode } = req.body;
    let inv = getSafeInventory(`${team}_${player}`);

    if (inv[itemType] <= 0) return res.status(400).json({ error: "Nicht im Rucksack!" });

    if (itemType === 'revive') {
        // 1. Item aus dem Rucksack abziehen
        inv[itemType] -= 1;
        invNeedsSaving = true;
        triggerStateUpdate(['inv']);
        
        // 2. Cooldown für JEDEN Spieler im Team auf 0 setzen
        if (playerStates[team]) { 
            for (let p in playerStates[team]) {
                playerStates[team][p].lastScan = 0; 
            }
        }
        
        // 3. Speichern und Handys updaten
        stateNeedsSaving = true;
        triggerStateUpdate(['stats']);
        
        return res.json({ success: true, message: "⏱️ Cooldown für das gesamte Team auf 0 gesetzt!" });
    }

    if (!zoneCode) return res.status(400).json({ error: "Zone fehlt!" });
    let zone = globalMapData.features.find(f => f.properties && f.properties.code === zoneCode);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden!" });

    if (zone.properties.empUntil && zone.properties.empUntil > Date.now()) return res.status(403).json({ error: "EMP gestört!" });

    inv[itemType] -= 1;
    invNeedsSaving = true;
    triggerStateUpdate(['inv']);

    if (itemType === 'trap') {
        if (!zone.properties.traps) zone.properties.traps = [];
        if (zone.properties.traps.length >= 5) return res.status(400).json({ error: "Maximal 5!" });
        zone.properties.traps.push(team);
    } else if (itemType === 'buff') {
        if (!zone.properties.buffs) zone.properties.buffs = [];
        if (zone.properties.buffs.length >= 5) return res.status(400).json({ error: "Maximal 5!" });
        zone.properties.buffs.push(team);
    } else if (itemType === 'emp') {
        zone.properties.empUntil = Date.now() + (5 * 60 * 1000); 
    }

    triggerMapUpdate();
    res.json({ success: true, message: `${itemType} eingesetzt!` });
});

app.post('/api/inventory/manage', (req, res) => {
    const { team, player, itemType, amount, action } = req.body;
    let inv = getSafeInventory(`${team}_${player}`);
    let val = parseInt(amount) || 1;

    if (action === 'add') inv[itemType] += val;
    else if (action === 'sub') { inv[itemType] -= val; if (inv[itemType] < 0) inv[itemType] = 0; } 
    else if (action === 'set') inv[itemType] = val;

    invNeedsSaving = true; triggerStateUpdate(['inv']);
    res.json({ success: true, inventory: inv });
});

app.post('/api/inventory/reset-all', (req, res) => {
    playerInventory = {}; 
    invNeedsSaving = true; 
    saveData('inventory', playerInventory);
    triggerStateUpdate(['inv']);
    res.json({ success: true, message: "Alle geleert!" });
});

// ==========================================
// 👑 ADMIN & MAP 
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
        }
    }
    triggerMapUpdate();
    res.json({ success: true });
});

app.get('/api/zones', (req, res) => {
    const clientVersion = parseInt(req.query.v) || 0;
    if (clientVersion === mapVersion) return res.json({ unchanged: true });
    res.json({ version: mapVersion, data: globalMapData });
});

// 1. Speichert NUR Admin-Einstellungen
app.post('/api/admin/settings', (req, res) => {
    if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
    Object.assign(globalMapData.gameSettings, req.body);
    
    // 🚨 WICHTIG: In der Datenbank speichern!
    db.prepare('REPLACE INTO game_data (key, value) VALUES (?, ?)').run('map_data', JSON.stringify(globalMapData));
    
    io.emit('update_map'); // Alle Clients benachrichtigen
    res.json({ success: true });
});

// 2. Speichert NUR Map-Veränderungen
app.post('/api/admin/map', (req, res) => {
    globalMapData.features = req.body.features;
    
    // 🚨 WICHTIG: In der Datenbank speichern!
    db.prepare('REPLACE INTO game_data (key, value) VALUES (?, ?)').run('map_data', JSON.stringify(globalMapData));
    
    io.emit('update_map');
    res.json({ success: true });
});
// ==========================================
// 📊 SPIELER-AKTEN & STATISTIKEN 
// ==========================================
app.get('/api/stats', (req, res) => {
    const clientVersion = parseInt(req.query.v) || 0;
    if (clientVersion === globalVersions.stats) return res.json({ unchanged: true });

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

    let pState = team && player ? getSafePlayerState(team, player) : { hacks: 0, distance: 0, trapsHit: 0 };

    res.json({
        version: globalVersions.stats,
        leaderboard: {
            rot: { coins: teamWallets.rot, zones: zoneCounts.rot },
            blau: { coins: teamWallets.blau, zones: zoneCounts.blau },
            gruen: { coins: teamWallets.gruen, zones: zoneCounts.gruen },
            gelb: { coins: teamWallets.gelb, zones: zoneCounts.gelb }
        },
        personal: { hacks: pState.hacks, distance: pState.distance.toFixed(2), trapsHit: pState.trapsHit },
        teamCooldowns: (globalMapData.gameSettings && globalMapData.gameSettings.teamCooldowns) ? globalMapData.gameSettings.teamCooldowns : {rot:0, blau:0, gruen:0, gelb:0}
    });
});

app.post('/api/player-scan', (req, res) => {
    const { team, player, timestamp } = req.body; 
    let pState = getSafePlayerState(team, player);
    pState.lastScan = timestamp;
    triggerStateUpdate(['stats']);
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
    triggerMapUpdate();
    res.json({ success: true });
});

app.post('/api/reset-cooldowns', (req, res) => {
    const now = Date.now();
    if(!globalMapData.gameSettings) globalMapData.gameSettings = {};
    globalMapData.gameSettings.cooldownResetTime = now;
    globalMapData.gameSettings.fallenTeams = {};
    triggerMapUpdate();

    for (let t in playerStates) {
        for (let p in playerStates[t]) playerStates[t][p].lastScan = 0;
    }
    triggerStateUpdate(['stats']);
    res.json({ success: true, resetTime: now });
});

app.post('/api/admin/reset-stats', (req, res) => {
    for (let t in playerStates) {
        for (let p in playerStates[t]) { playerStates[t][p].hacks = 0; playerStates[t][p].distance = 0; playerStates[t][p].trapsHit = 0; }
    }
    triggerStateUpdate(['stats']);
    res.json({ success: true, message: "Stats gelöscht!" });
});

// ==========================================
// ⚡ SUPER-SCHNELLE SCANNER-ROUTEN
// ==========================================
app.get('/api/zone/:code', (req, res) => {
    const { team, player } = req.query; 
    const zone = globalMapData.features.find(f => f.properties && f.properties.code === req.params.code);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    
    let inv = playerInventory[`${team}_${player}`] || { trap: 0, buff: 0, revive: 0, emp: 0, defuse: 0, pickpocket: 0 };
    res.json({ zone: zone.properties, gameSettings: globalMapData.gameSettings || {}, inventory: inv });
});

app.post('/api/zone-action', (req, res) => {
    const { code, action, newColor, playerLat, playerLng, team, player, cooldownChange, trapsHit, timestamp } = req.body;

    // 🚨 ANTI OFFLINE-BUG: Wenn der Scan älter als 5 Minuten (300.000 ms) ist, werfen wir ihn weg!
    if (timestamp && (Date.now() - timestamp > 300000)) {
        console.log(`[Queue] Ignoriere uralten Offline-Scan von Team ${team}`);
        // noCooldown: true verhindert, dass der Spieler jetzt noch einen Timer bekommt
        return res.json({ success: true, noCooldown: true, message: "Offline-Scan war zu alt." });
    }

    let zone = globalMapData.features.find(f => f.properties && f.properties.code === code);
    if (!zone) return res.status(404).json({ error: "Zone nicht gefunden" });
    if (zone.properties.locked) return res.status(403).json({ error: "Gesperrt" });
    if (zone.properties.empUntil && zone.properties.empUntil > Date.now()) return res.status(403).json({ error: "EMP!" });

    const isGpsRequired = (globalMapData.gameSettings && globalMapData.gameSettings.gpsRequired === false) ? false : true;
    if (action !== 'trigger_items' && action !== 'defuse_traps' && isGpsRequired) { 
        if (!playerLat || !playerLng) return res.status(400).json({ error: "Standort fehlt!" });
        let center = getPolygonCenter(zone.geometry.coordinates);
        if (getDistanceInMeters(playerLat, playerLng, center.lat, center.lng) > MAX_INTERACT_DISTANCE) return res.status(403).json({ error: `Zu weit weg!` });
    }

    let pState = getSafePlayerState(team, player);
    let statsChanged = false;

    if (['capture', 'upgrade', 'attack'].includes(action)) { pState.hacks += 1; statsChanged = true; }
    if (trapsHit > 0) { pState.trapsHit += trapsHit; statsChanged = true; }
    if (statsChanged) triggerStateUpdate(['stats']);

    let resultMessage = null;
    let noCooldown = false; 

    let oldColor = zone.properties.color ? zone.properties.color.toLowerCase() : null;
    let oldTeam = oldColor ? TEAM_COLORS[oldColor] : null;

    if (action === 'attack' && oldTeam && oldTeam !== team) {
        if (globalMapData.gameSettings && globalMapData.gameSettings.fallenTeams && globalMapData.gameSettings.fallenTeams[oldTeam]) noCooldown = true; 
    }

    if (action === 'upgrade') {
        zone.properties.level += 1;
    } else if (action === 'capture') { 
        if (oldTeam && oldTeam !== team) {
            let invKey = `${team}_${player}`;
            if (playerInventory[invKey] && playerInventory[invKey].pickpocket > 0) {
                playerInventory[invKey].pickpocket -= 1; 
                invNeedsSaving = true; triggerStateUpdate(['inv']);

                let victimCoins = teamWallets[oldTeam];
                let stolen = Math.floor((victimCoins * 0.1) / 5) * 5; 
                if (stolen > 0) {
                    teamWallets[oldTeam] -= stolen;
                    teamWallets[team] += stolen;
                    triggerStateUpdate(['coins']);
                    resultMessage = `🕵️ Du hast ${stolen} Coins von ${oldTeam.toUpperCase()} gestohlen!`;
                }
            }
        }
        let isGray = (zone.properties.color === "#808080" || !zone.properties.color);
        if (isGray && team) { teamWallets[team] += 5; triggerStateUpdate(['coins', 'stats']); }
        zone.properties.color = newColor; 
        zone.properties.level = 1; 
    } else if (action === 'attack') {
        let isHQ = (zone.properties.hqTeam && zone.properties.color && TEAM_COLORS[zone.properties.color.toLowerCase()] === zone.properties.hqTeam);
        if (isHQ && !zone.properties.hqArmorHit) {
            zone.properties.hqArmorHit = true; 
            triggerMapUpdate();
            return res.json({ success: true, message: "🛡️ HQ Panzerung getroffen!", noCooldown: noCooldown });
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
                resultMessage = `💥 HAUPTQUARTIER ZERSTÖRT!`;
            }
        }
    } else if (action === 'trigger_items') {
        delete zone.properties.traps; delete zone.properties.buffs;
        if (cooldownChange && team) {
            if (!globalMapData.gameSettings) globalMapData.gameSettings = {};
            if (!globalMapData.gameSettings.teamCooldowns) globalMapData.gameSettings.teamCooldowns = {rot:5, blau:5, gruen:5, gelb:5};
            let currentCD = parseInt(globalMapData.gameSettings.teamCooldowns[team]) || 0;
            globalMapData.gameSettings.teamCooldowns[team] = Math.max(0, currentCD + cooldownChange);
        }
    } else if (action === 'defuse_traps') {
        let invKey = `${team}_${player}`;
        if (playerInventory[invKey] && playerInventory[invKey].defuse > 0) {
            playerInventory[invKey].defuse -= 1; 
            invNeedsSaving = true; triggerStateUpdate(['inv']);
            delete zone.properties.traps; 
        }
    }

    triggerMapUpdate(); triggerStateUpdate(['stats']);
    res.json({ success: true, message: resultMessage || "Erfolgreich!", noCooldown: noCooldown });
});

// ==========================================
// 📍 SPIELER STANDORTE & TRAILS
// ==========================================
let playerLocations = {};
let playerTrails = loadData('trails', {}); 
let trailsNeedSaving = false;

setInterval(() => {
    if (trailsNeedSaving) {
        saveData('trails', playerTrails);
        trailsNeedSaving = false;
    }
}, 10000);

app.post('/api/location', (req, res) => {
    let { id, lat, lng, team, name } = req.body;
    const now = Date.now();

    if (playerLocations[id]) {
        let lastLoc = playerLocations[id];
        let timeDiffSec = (now - lastLoc.lastUpdate) / 1000;
        if (timeDiffSec <= 0) timeDiffSec = 0.1; 
        let dist = getDistanceInMeters(lastLoc.lat, lastLoc.lng, lat, lng);
        let speedMps = dist / timeDiffSec; 

        if (speedMps > 12) return res.json({ status: "Ignored (Jump)" });
        let smoothFactor = speedMps < 1.0 ? 0.15 : 0.6; 
        lat = lastLoc.lat + smoothFactor * (lat - lastLoc.lat);
        lng = lastLoc.lng + smoothFactor * (lng - lastLoc.lng);
    }

    playerLocations[id] = { lat, lng, team, name, lastUpdate: now };
    globalVersions.loc = now; 
    io.emit('update_locations'); 

    if (!playerTrails[id]) playerTrails[id] = { team: team, name: name, path: [] };
    let path = playerTrails[id].path;
    
    let distAdded = 0;
    if (path.length === 0) {
        path.push([lat, lng]); trailsNeedSaving = true;
    } else {
        let lastP = path[path.length - 1];
        distAdded = getDistanceInMeters(lat, lng, lastP[0], lastP[1]);
        if (distAdded > 5) { path.push([lat, lng]); trailsNeedSaving = true; } else { distAdded = 0; }
    }

    if (distAdded > 0) {
        let pState = getSafePlayerState(team, name); 
        pState.distance += (distAdded / 1000); 
        triggerStateUpdate(['stats']);
    }
    res.json({ status: "Location received" });
});

app.get('/api/location', (req, res) => { 
    const clientVersion = parseInt(req.query.v) || 0;
    if (clientVersion === globalVersions.loc) return res.json({ unchanged: true });
    res.json({ version: globalVersions.loc, data: playerLocations }); 
});

app.get('/api/trails', (req, res) => { res.json(playerTrails); });

app.post('/api/trails/reset', (req, res) => {
    playerTrails = {}; 
    trailsNeedSaving = true; 
    saveData('trails', playerTrails);
    res.json({ success: true });
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
        io.emit('update_chat'); 
        
        res.json({ success: true });
    } catch(err) { res.status(500).json({ success: false }); }
});

app.post('/api/chat/reset', (req, res) => {
    chatMessages = []; 
    chatVersion = Date.now(); 
    io.emit('update_chat'); 
    res.json({ success: true, message: "Chat erfolgreich geleert!" });
    console.log(`chatMessages wurden zurückgesetzt!`);
});

// ==========================================
// 🎟️ TICKET-TRESOR (ADMIN FREISCHALTUNG)
// ==========================================
let ticketsUnlocked = false; 

app.get('/api/ticket/:team/:player', (req, res) => {
    if (!ticketsUnlocked) {
        return res.status(403).send("❌ ZUGRIFF VERWEIGERT: Der Admin hat die Tickets noch nicht freigegeben!");
    }

    const { team, player } = req.params;
    const prefixes = { 'rot': 'r', 'blau': 'b', 'gruen': 'g', 'gelb': 'y' }; 
    const prefix = prefixes[team] || 'x';
    const fileName = `${prefix}${player}.jpeg`;
    
    // Dateizugriff bleibt erhalten, da das echte Bilddateien (JPEGs) auf der Platte sind
    const filePath = path.join(__dirname, 'secret_tickets', fileName);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send("Ticket nicht gefunden.");
    }
});

app.post('/api/admin/push-ticket', (req, res) => {
    const { message } = req.body;
    ticketsUnlocked = true; 
    io.emit('show_ticket', { message: message }); 
    res.json({ success: true, message: "Tresor geöffnet! Tickets werden jetzt auf den Handys angezeigt." });
});

// ==========================================
// 🚀 SERVER START
// ==========================================
server.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT} (mit SQLite)`);
    console.log(`🔌 WebSockets SIND AKTIVIERT!`);
});