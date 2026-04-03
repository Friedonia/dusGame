// ==========================================
// 1. TEAM-ERKENNUNG & UI-AUFBAU
// ==========================================

// Checkt, ob das Team im Link steht (z.B. ?team=rot)
const urlParams = new URLSearchParams(window.location.search);
let urlTeam = urlParams.get('team');
if (urlTeam && ['rot', 'blau', 'gruen', 'gelb'].includes(urlTeam)) {
    localStorage.setItem('team', urlTeam);
}

const myTeam = localStorage.getItem('team');
const teamColors = { 'rot': '#ff3333', 'blau': '#3366ff', 'gruen': '#33ff33', 'gelb': '#ffcc00' };
const teamColorsRgb = { 'rot': '255, 51, 51', 'blau': '51, 102, 255', 'gruen': '51, 255, 51', 'gelb': '255, 204, 0' };

if (myTeam) {
    // 🎨 Das magische Einfärben der gesamten Karte & des HUDs
    document.body.className = 'tint-' + myTeam;
    document.documentElement.style.setProperty('--team-color', teamColors[myTeam]);
    document.documentElement.style.setProperty('--team-color-rgb', teamColorsRgb[myTeam]);
    document.getElementById('hud-header').innerText = "🛡️ Team " + myTeam.toUpperCase();

    // Menüs ein/ausblenden
    document.getElementById('team-selector-container').style.display = 'none';
    document.getElementById('player-controls').style.display = 'block';
    document.getElementById('toggle-hud-btn').style.display = 'block';
    document.getElementById('chat-widget').style.display = 'flex';
} else {
    // Falls noch kein Team gewählt wurde, bleib im neutralen Modus
    document.getElementById('hud-header').innerText = "Wähle dein Team";
}

// Wird aufgerufen, wenn jemand auf einen der 4 Team-Buttons klickt
window.setTeam = function(t) {
    window.location.href = '?team=' + t; // Lädt die Seite sofort mit der Farbe neu!
};

if (!localStorage.getItem('playerId')) {
    localStorage.setItem('playerId', 'Player_' + Math.floor(Math.random() * 1000));
}
const playerId = localStorage.getItem('playerId');

// --- HIER KOMMT DANN DEIN RESTLICHER PLAYER.JS CODE (Map, GPS, Cooldown etc.) ---

// HUD & Chat Steuerung
let hudCollapsed = false;
window.toggleHud = function() {
    const content = document.getElementById('hud-content-wrapper');
    const btn = document.getElementById('toggle-hud-btn');
    hudCollapsed = !hudCollapsed;
    if (hudCollapsed) {
        content.classList.add('collapsed');
        btn.innerHTML = "▼ Scanner öffnen ▼";
    } else {
        content.classList.remove('collapsed');
        btn.innerHTML = "▲ Einklappen ▲";
    }
}

let chatOpen = false;
window.toggleChat = function() {
    const widget = document.getElementById('chat-widget');
    chatOpen = !chatOpen;
    if (chatOpen) {
        widget.classList.add('open');
        document.getElementById('chat-badge').style.display = 'none'; 
    } else {
        widget.classList.remove('open');
    }
}

window.sendChat = function() {
    const input = document.getElementById('chat-message-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg self';
    msgDiv.innerText = msg;
    document.getElementById('chat-messages').appendChild(msgDiv);
    document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
    input.value = '';

    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: playerId, team: myTeam, message: msg, type: 'player' }) }).catch(err => err);
}

// Karte initialisieren
var map = L.map('map', { zoomControl: false }).setView([51.2277, 6.7735], 13.2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

var zoneLayer = L.layerGroup().addTo(map);
var playerLayer = L.layerGroup().addTo(map);
var nfcIcon = L.divIcon({ className: 'custom-nfc-marker', html: '<div style="background-color: #ff8800; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px #ff8800;"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });

let lastAnnouncementTime = 0; 
let timerInterval = null;
let globalCooldownMins = 0; 

function updateMap() {
    fetch('/api/zones').then(res => res.json()).then(data => {
        
        // 🎙 RUNDFUNK & TIMER
        if (data.gameSettings && data.gameSettings.announcement) { 
            if (data.gameSettings.announcement.timestamp > lastAnnouncementTime) {
                let timeDiff = Date.now() - data.gameSettings.announcement.timestamp;
                if (timeDiff < 30000 || lastAnnouncementTime > 0) {
                    let banner = document.getElementById('announcement-banner');
                    banner.innerHTML = "⚠️ ADMIN: " + data.gameSettings.announcement.text;
                    banner.style.display = 'block';
                    setTimeout(() => { banner.style.display = 'none'; }, 8000); 
                }
                lastAnnouncementTime = data.gameSettings.announcement.timestamp;
            }
        }

        if (data.gameSettings && data.gameSettings.endTime) { 
            document.getElementById('game-timer').style.display = 'block';
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                let timeLeft = data.gameSettings.endTime - Date.now();
                if (timeLeft <= 0) {
                    document.getElementById('game-timer').innerText = "00:00";
                    document.getElementById('game-timer').style.color = "red";
                    clearInterval(timerInterval);
                } else {
                    let m = Math.floor(timeLeft / 60000);
                    let s = Math.floor((timeLeft % 60000) / 1000);
                    document.getElementById('game-timer').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            }, 1000);
        } else { 
            document.getElementById('game-timer').style.display = 'none';
            clearInterval(timerInterval);
        }
        
        // 🛒 SHOP ANZEIGE TOGGLE
        if (data.gameSettings && data.gameSettings.shopEnabled === false) {
            document.getElementById('coin-display').style.display = 'none';
        } else {
            document.getElementById('coin-display').style.display = 'block';
        }

        globalCooldownMins = data.gameSettings && data.gameSettings.playerCooldown ? parseInt(data.gameSettings.playerCooldown) : 0;

        zoneLayer.clearLayers();
        L.geoJSON(data, {
            filter: function(f) { 
                if (f.properties.type === "nfc-tag") {
                    if (data.gameSettings && data.gameSettings.gamePaused) return false;
                    return f.properties.visibleToPlayers === true;
                }
                if (f.properties.type === "transit-line") return false;
                return true; 
            },
            pointToLayer: function (f, latlng) {
                let tagName = f.properties.name || "NFC Tag";
                if (f.properties.type === "nfc-tag") return L.marker(latlng, { icon: nfcIcon }).bindPopup(`<b>${tagName}</b>`);
            },
            style: function (f) { 
                if (f.properties.locked) {
                    return { color: '#ffffff', fillColor: '#222222', fillOpacity: 0.8, dashArray: '10, 10', interactive: true };
                }
                let op = 0.4;
                if(f.properties.level === 2) op = 0.65;
                if(f.properties.level === 3) op = 0.9;
                return { color: f.properties.color, fillColor: f.properties.color, fillOpacity: op, interactive: true }; 
            }
        }).addTo(zoneLayer);

        if (data.gameSettings && data.gameSettings.showPlayers === true) fetchPlayers();
        else playerLayer.clearLayers(); 
    });
}

// ⏳ COOLDOWN CHECK
setInterval(() => {
    let modifier = parseInt(localStorage.getItem('cooldownModifier') || 0);
    let effectiveCooldownMins = globalCooldownMins + modifier;
    if(effectiveCooldownMins < 0) effectiveCooldownMins = 0; 

    if (effectiveCooldownMins > 0) {
        let lastScan = localStorage.getItem('lastScanTime') || 0;
        let now = Date.now();
        let diff = (effectiveCooldownMins * 60000) - (now - lastScan);
        
        let submitBtn = document.querySelector('.btn-send');
        let manualInput = document.getElementById('manual-code-input');

        if (diff > 0) {
            let leftSecs = Math.ceil(diff / 1000);
            let m = Math.floor(leftSecs / 60);
            let s = leftSecs % 60;
            document.getElementById('status').innerHTML = `⏳ Scanner blockiert! Bereit in: <b>${m}:${s < 10 ? '0':''}${s}</b>`;
            document.getElementById('status').style.color = "#ff8800";
            if(submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = "0.5"; }
            if(manualInput) { manualInput.disabled = true; }
        } else {
            localStorage.setItem('cooldownModifier', 0);
            document.getElementById('status').innerHTML = "✅ Scanner bereit!";
            document.getElementById('status').style.color = "#00ffcc";
            if(submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
            if(manualInput) { manualInput.disabled = false; }
        }
    } else {
        document.getElementById('status').innerHTML = "📍 GPS aktiv (Kein Cooldown)";
        document.getElementById('status').style.color = "#aaa";
    }
}, 1000);

function fetchPlayers() {
    fetch('/api/location').then(res => res.json()).then(players => {
        playerLayer.clearLayers();
        for (let id in players) {
            const p = players[id];
            if(id === playerId) continue; 
            let playerColor = p.team === 'rot' ? '#ff3333' : (p.team === 'blau' ? '#3366ff' : (p.team === 'gruen' ? '#33ff33' : '#ffcc00'));
            L.circleMarker([p.lat, p.lng], { radius: 6, fillColor: playerColor, color: "#ffffff", weight: 2, fillOpacity: 1 }).addTo(playerLayer);
        }
    }).catch(err => err);
}

setInterval(updateMap, 3000); 
updateMap();

// GPS LOGIK
var myLocationMarker;
window.startGPS = function() {
    const statusDiv = document.getElementById('status');
    if ("geolocation" in navigator) {
        statusDiv.innerText = "GPS wird gesucht...";
        navigator.geolocation.watchPosition((position) => {
            statusDiv.innerText = "📍 GPS aktiv!";
            if (myLocationMarker) map.removeLayer(myLocationMarker);
            myLocationMarker = L.circleMarker([position.coords.latitude, position.coords.longitude], { radius: 8, fillColor: "#00ccff", color: "#ffffff", weight: 3, fillOpacity: 1 }).addTo(map);
            
            fetch('/api/location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: playerId, name: playerId, team: myTeam, lat: position.coords.latitude, lng: position.coords.longitude }) }).catch(e => e);
        }, (e) => { statusDiv.innerText = "❌ Fehler: Bitte GPS im Browser erlauben!"; }, { enableHighAccuracy: true });
    }
}

window.submitManualCode = function() {
    const inputField = document.getElementById('manual-code-input');
    let rawCode = inputField.value.trim().toUpperCase(); 
    if (!rawCode) { alert("Bitte gib einen Code ein!"); return; }
    window.location.href = "/scan.html?code=" + encodeURIComponent(rawCode);
}

// WIRTSCHAFT
function fetchCoins() {
    fetch('/api/coins').then(res => res.json()).then(coins => {
        if(coins[myTeam] !== undefined) {
            document.getElementById('team-coins-val').innerText = coins[myTeam];
        }
    }).catch(err => err);
}
setInterval(fetchCoins, 10000); 

// AUTO-START beim Aufrufen der Seite
window.onload = function() {
    document.getElementById('status').innerHTML = `<button onclick="startGPS()" style="background:var(--team-color); color:#000; padding:10px 20px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; font-size:14px; text-transform:uppercase;">📍 GPS Verbinden</button>`;
    fetchCoins();
};

// ==========================================
// 📶 NATIVE NFC SCANNER VERLINKUNG
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const manualScanDiv = document.getElementById('manual-scan');
    
    if (manualScanDiv) {
        // Erschaffe den neuen NFC Button
        const nfcBtn = document.createElement('button');
        nfcBtn.innerHTML = "📶 NFC-Tag scannen";
        nfcBtn.className = "btn-send";
        nfcBtn.style.width = "100%";
        nfcBtn.style.marginBottom = "15px";
        nfcBtn.style.background = "var(--team-color)";
        nfcBtn.style.color = "#000";
        nfcBtn.style.fontSize = "16px";
        
        nfcBtn.onclick = async function() {
            // Prüft, ob das Handy Web-NFC unterstützt (z.B. Android Chrome)
            if ('NDEFReader' in window) {
                try {
                    const ndef = new NDEFReader();
                    await ndef.scan();
                    
                    document.getElementById('status').innerHTML = "📡 Scanner bereit! Halte dein Handy an den Tag.";
                    document.getElementById('status').style.color = "#00ffcc";
                    
                    ndef.addEventListener("reading", ({ message }) => {
                        const decoder = new TextDecoder();
                        for (const record of message.records) {
                            if (record.recordType === "url") {
                                window.location.href = decoder.decode(record.data); // Leitet zum Tag-Link weiter
                            } else if (record.recordType === "text") {
                                let code = decoder.decode(record.data);
                                window.location.href = "/scan.html?code=" + encodeURIComponent(code);
                            }
                        }
                    });
                } catch (error) {
                    alert("⚠️ NFC Scanner Fehler: " + error);
                }
            } else {
                // Fallback für iPhones (Apple erlaubt Web-NFC aktuell nicht im Browser)
                alert("ℹ️ Auf diesem Gerät/Browser passiert das Scannen automatisch im Hintergrund. Schließe dieses Menü und halte den NFC-Tag einfach direkt an die Oberkante deines Handys!");
            }
        };
        
        // Fügt den Button oben ins "manuelle" Menü ein
        manualScanDiv.insertBefore(nfcBtn, manualScanDiv.firstChild);
    }
});