// ==========================================
// 🛡️ ANTI-UNDEFINED SCHUTZ
// ==========================================
if (localStorage.getItem('team') === 'undefined' || localStorage.getItem('team') === 'null') {
    localStorage.removeItem('team');
}
if (localStorage.getItem('playerNum') === 'undefined' || localStorage.getItem('playerNum') === 'null') {
    localStorage.setItem('playerNum', '1');
}

const urlParamsCheck = new URLSearchParams(window.location.search);
if (urlParamsCheck.get('team') === 'undefined' || urlParamsCheck.get('team') === 'null') {
    window.location.href = window.location.pathname; 
}

// ==========================================
// 1. TEAM- & SPIELER-ERKENNUNG & UI-AUFBAU
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
let urlTeam = urlParams.get('team');
let urlPlayer = urlParams.get('player');

if (urlTeam && ['rot', 'blau', 'gruen', 'gelb'].includes(urlTeam)) {
    localStorage.setItem('team', urlTeam);
}
if (urlPlayer && ['1', '2', '3'].includes(urlPlayer)) {
    localStorage.setItem('playerNum', urlPlayer);
} else if (!localStorage.getItem('playerNum')) {
    localStorage.setItem('playerNum', '1');
}

// WICHTIG: Teamname immer als Kleinbuchstaben erzwingen!
const myTeam = String(localStorage.getItem('team') || 'rot').toLowerCase(); 
let myPlayerNum = localStorage.getItem('playerNum') || '1'; 
const playerId = `${myTeam}_Player${myPlayerNum}`;

const teamColors = { 'rot': '#ff3333', 'blau': '#3366ff', 'gruen': '#33ff33', 'gelb': '#ffcc00' };
const teamColorsRgb = { 'rot': '255, 51, 51', 'blau': '51, 102, 255', 'gruen': '51, 255, 51', 'gelb': '255, 204, 0' };

if (localStorage.getItem('team')) {
    document.body.className = 'tint-' + myTeam;
    document.documentElement.style.setProperty('--team-color', teamColors[myTeam]);
    document.documentElement.style.setProperty('--team-color-rgb', teamColorsRgb[myTeam]);
    
    document.getElementById('hud-header').innerText = `🛡️ Team ${myTeam.toUpperCase()} | Spieler ${myPlayerNum}`;

    document.getElementById('team-selector-container').style.display = 'none';
    document.getElementById('player-controls').style.display = 'block';
    document.getElementById('toggle-hud-btn').style.display = 'block';
    document.getElementById('chat-widget').style.display = 'flex';
} else {
    document.getElementById('hud-header').innerText = "Wähle dein Team";
}

window.setTeam = function(t) {
    window.location.href = '?team=' + t + '&player=1'; 
};

// ==========================================
// 🚨 EIGENE COOLDOWN-BOX IM DASHBOARD
// ==========================================
function setupDedicatedCooldownUI() {
    let controls = document.getElementById('player-controls');
    if(controls && !document.getElementById('dedicated-cooldown-display')) {
        let display = document.createElement('div');
        display.id = 'dedicated-cooldown-display';
        display.style.cssText = "background: #222; border: 2px solid #444; border-radius: 8px; padding: 15px; margin-bottom: 15px; text-align: center; font-size: 16px; font-weight: bold; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);";
        display.innerHTML = "Lade Cooldown-Daten...";
        controls.insertBefore(display, controls.firstChild);
    }
}
if(localStorage.getItem('team')) setupDedicatedCooldownUI();

// ==========================================
// 🛠 DEBUG / TROUBLESHOOTING UI 
// ==========================================
function setupPlayerSwitcher() {
    document.querySelectorAll('#debug-player-switch').forEach(el => el.remove());

    const switcher = document.createElement('div');
    switcher.id = "debug-player-switch";
    switcher.style.cssText = "position: fixed; bottom: 80px; left: 20px; background: rgba(0, 0, 0, 0.8); color: white; padding: 10px; border-radius: 8px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 8px;";
    
    switcher.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; color: #aaa;">🛠 Sp:</div>
      <button onclick="changePlayer('1')" style="padding: 6px 12px; cursor: pointer; background: ${myPlayerNum === '1' ? 'var(--team-color)' : '#333'}; color: ${myPlayerNum === '1' ? '#000' : '#fff'}; border: none; border-radius: 4px; font-weight: bold;">P 1</button>
      <button onclick="changePlayer('2')" style="padding: 6px 12px; cursor: pointer; background: ${myPlayerNum === '2' ? 'var(--team-color)' : '#333'}; color: ${myPlayerNum === '2' ? '#000' : '#fff'}; border: none; border-radius: 4px; font-weight: bold;">P 2</button>
      <button onclick="changePlayer('3')" style="padding: 6px 12px; cursor: pointer; background: ${myPlayerNum === '3' ? 'var(--team-color)' : '#333'}; color: ${myPlayerNum === '3' ? '#000' : '#fff'}; border: none; border-radius: 4px; font-weight: bold;">P 3</button>
    `;
    document.body.appendChild(switcher);
}
if(localStorage.getItem('team')) setupPlayerSwitcher(); 

window.changePlayer = function(num) {
    myPlayerNum = num;
    localStorage.setItem('playerNum', num);
    
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('player', num);
    window.history.pushState({}, '', newUrl);
    
    document.getElementById('hud-header').innerText = `🛡️ Team ${myTeam.toUpperCase()} | Spieler ${num}`;
    setupPlayerSwitcher(); 
};

// ==========================================
// 2. HUD, CHAT & KARTE
// ==========================================
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


// ==========================================
// 💬 CHAT-SYSTEM (Spieler)
// ==========================================
let chatOpen = false;
window.toggleChat = function() {
    const widget = document.getElementById('chat-widget');
    chatOpen = !chatOpen;
    if (chatOpen) {
        widget.classList.add('open');
        document.getElementById('chat-badge').style.display = 'none'; 
        loadPlayerChat(true); // Direkt beim Öffnen nach unten scrollen
    } else {
        widget.classList.remove('open');
    }
}

// Nachricht senden
window.sendChat = function() {
    const input = document.getElementById('chat-message-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    input.value = ''; // Feld sofort leeren

    // Wir malen die Nachricht NICHT mehr manuell rein, sondern senden sie an den Server.
    // Der Server schickt sie uns dann beim nächsten 2-Sekunden-Check offiziell zurück.
    fetch('/api/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ sender: `Sp. ${myPlayerNum}`, team: myTeam, message: msg, type: 'player' }) 
    }).then(() => loadPlayerChat(true)).catch(err => err);
}

// Nachrichten vom Server abrufen
let lastPlayerMsgCount = 0;

function loadPlayerChat(forceScroll = false) {
    fetch('/api/chat?t=' + new Date().getTime())
        .then(res => res.json())
        .then(allMsgs => {
            // Nur Nachrichten für mein Team oder globale ("all") filtern
            const teamMsgs = allMsgs.filter(m => m.team === myTeam || m.team === 'all');
            
            // Wenn keine neue Nachricht da ist, müssen wir nichts neu zeichnen
            if (!forceScroll && teamMsgs.length === lastPlayerMsgCount) return;
            
            // Notification-Badge anzeigen, wenn Chat zu ist und neue Nachrichten kommen
            if (!chatOpen && teamMsgs.length > lastPlayerMsgCount && lastPlayerMsgCount !== 0) {
                let badge = document.getElementById('chat-badge');
                if(badge) badge.style.display = 'block';
            }
            
            lastPlayerMsgCount = teamMsgs.length;
            const chatBox = document.getElementById('chat-messages');
            if(!chatBox) return;
            
            chatBox.innerHTML = ''; // Leeren

            teamMsgs.forEach(m => {
                const msgDiv = document.createElement('div');
                
                // Design für Admin vs. Ich vs. Teamkollege
                if (m.type === 'admin') {
                    msgDiv.className = 'msg admin-msg';
                    msgDiv.style.cssText = "background: #005a4e; color: white; padding: 8px; border-radius: 5px; margin-bottom: 5px; border-left: 3px solid #00ffcc;";
                    msgDiv.innerHTML = `<b style="color:#00ffcc; font-size:11px; display:block;">${m.sender}</b> ${m.message}`;
                } else if (m.sender === `Sp. ${myPlayerNum}`) {
                    msgDiv.className = 'msg self';
                    msgDiv.style.cssText = "background: #444; color: white; padding: 8px; border-radius: 5px; margin-bottom: 5px; text-align: right;";
                    msgDiv.innerHTML = `<b style="color:#aaa; font-size:11px; display:block;">Ich</b> ${m.message}`;
                } else {
                    msgDiv.className = 'msg other';
                    msgDiv.style.cssText = "background: #222; color: white; padding: 8px; border-radius: 5px; margin-bottom: 5px;";
                    msgDiv.innerHTML = `<b style="color:var(--team-color); font-size:11px; display:block;">${m.sender}</b> ${m.message}`;
                }
                chatBox.appendChild(msgDiv);
            });

            // Automatisch nach unten scrollen
            if (forceScroll || chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 50) {
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        }).catch(err => console.log("Chat offline."));
}

// Alle 2 Sekunden Chat checken
setInterval(() => loadPlayerChat(false), 2000);
loadPlayerChat(true);

// KARTE LADEN
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
        
        if (data.gameSettings && data.gameSettings.shopEnabled === false) {
            document.getElementById('coin-display').style.display = 'none';
        } else {
            document.getElementById('coin-display').style.display = 'block';
        }

        // RESET-SIGNAL PRÜFEN (Abwärtskompatibel zu alten Keys)
        if (data.gameSettings && data.gameSettings.cooldownResetTime) {
            let lastScan = parseInt(localStorage.getItem(`lastScanTime_${myTeam}_${myPlayerNum}`) || localStorage.getItem(`lastScanTime_${myPlayerNum}`)) || 0;
            if (data.gameSettings.cooldownResetTime > lastScan) {
                localStorage.setItem(`lastScanTime_${myTeam}_${myPlayerNum}`, 0);
                localStorage.setItem(`cooldownModifier_${myTeam}_${myPlayerNum}`, 0);
                // Alte Keys sicherheitshalber auch nullen
                localStorage.setItem(`lastScanTime_${myPlayerNum}`, 0);
                localStorage.setItem(`cooldownModifier_${myPlayerNum}`, 0);
            }
        }

        // COOLDOWN ZEIT LADEN
        if (data.gameSettings && data.gameSettings.teamCooldowns) {
            globalCooldownMins = parseInt(data.gameSettings.teamCooldowns[myTeam]) || 0;
        } else {
            globalCooldownMins = 0;
        }

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
    }).catch(err => console.error(err)); 
}

// ==========================================
// ⏳ COOLDOWN CHECK (Steuert die neue Box)
// ==========================================
window.isCooldownActive = false;

setInterval(() => {
    // WICHTIG: Nutzt jetzt die festen Variablen (myTeam, myPlayerNum),
    // anstatt jede Sekunde den geteilten Tab-Speicher abzufragen!
    let pNum = myPlayerNum; 
    let tName = myTeam; 
    
    let modifier = parseInt(localStorage.getItem(`cooldownModifier_${tName}_${pNum}`) || localStorage.getItem(`cooldownModifier_${pNum}`)) || 0;
    
    let effectiveCooldownMins = (globalCooldownMins || 0) + modifier;
    if(effectiveCooldownMins < 0) effectiveCooldownMins = 0; 

    let cdBox = document.getElementById('dedicated-cooldown-display');
    let submitBtn = document.querySelector('.btn-send');
    let manualInput = document.getElementById('manual-code-input');

    if (effectiveCooldownMins > 0) {
        let lastScanStr = localStorage.getItem(`lastScanTime_${tName}_${pNum}`) || localStorage.getItem(`lastScanTime_${pNum}`);
        let lastScan = lastScanStr ? parseInt(lastScanStr) : 0;
        let now = Date.now();
        let diff = (effectiveCooldownMins * 60000) - (now - lastScan);
        
        if (diff > 0) {
            window.isCooldownActive = true;
            let leftSecs = Math.ceil(diff / 1000);
            let m = Math.floor(leftSecs / 60);
            let s = leftSecs % 60;
            
            if(cdBox) {
                cdBox.style.borderColor = "#ff4444";
                cdBox.style.background = "rgba(255, 68, 68, 0.1)";
                cdBox.style.color = "#ff4444";
                cdBox.innerHTML = `⏳ SCANNER KÜHLT AB<br><span style="font-size:32px;">${m}:${s < 10 ? '0':''}${s}</span>`;
            }
            if(submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = "0.3"; }
            if(manualInput) { manualInput.disabled = true; }
            
        } else {
            window.isCooldownActive = false;
            localStorage.setItem(`cooldownModifier_${tName}_${pNum}`, 0);
            localStorage.setItem(`cooldownModifier_${pNum}`, 0); // Cleanup für alte Version
            
            if(cdBox) {
                cdBox.style.borderColor = "#00ffcc";
                cdBox.style.background = "rgba(0, 255, 204, 0.1)";
                cdBox.style.color = "#00ffcc";
                cdBox.innerHTML = `✅ BEREIT FÜR DEN NÄCHSTEN SCAN!`;
            }
            if(submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
            if(manualInput) { manualInput.disabled = false; }
        }
    } else {
        window.isCooldownActive = false;
        if(cdBox) {
            cdBox.style.borderColor = "#444";
            cdBox.style.background = "#222";
            cdBox.style.color = "#aaa";
            cdBox.innerHTML = `Scanner dauerhaft aktiv (Kein Cooldown)`;
        }
        if(submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
        if(manualInput) { manualInput.disabled = false; }
    }
}, 1000);
// ==========================================
// 📍 LIVE SPIELER STANDORTE
// ==========================================
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

// ==========================================
// 📍 GPS LOGIK 
// ==========================================
var myLocationMarker;
window.startGPS = function() {
    const statusDiv = document.getElementById('status');
    if ("geolocation" in navigator) {
        if(statusDiv) statusDiv.innerText = "GPS wird gesucht...";
        navigator.geolocation.watchPosition((position) => {
            
            if(statusDiv) {
                statusDiv.innerText = `📍 GPS aktiv!`;
                statusDiv.style.color = "#00ccff";
            }
            
            if (myLocationMarker) map.removeLayer(myLocationMarker);
            myLocationMarker = L.circleMarker([position.coords.latitude, position.coords.longitude], { radius: 8, fillColor: "#00ccff", color: "#ffffff", weight: 3, fillOpacity: 1 }).addTo(map);
            
            fetch('/api/location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: playerId, name: playerId, team: myTeam, lat: position.coords.latitude, lng: position.coords.longitude }) }).catch(e => e);
        }, (e) => { 
            if(statusDiv) statusDiv.innerText = "❌ Fehler: Bitte GPS erlauben!"; 
        }, { enableHighAccuracy: true });
    }
}

window.submitManualCode = function() {
    const inputField = document.getElementById('manual-code-input');
    let rawCode = inputField.value.trim().toUpperCase(); 
    if (!rawCode) { alert("Bitte gib einen Code ein!"); return; }
    
    window.location.href = `/scan.html?code=${encodeURIComponent(rawCode)}&player=${myPlayerNum}`;
}

function fetchCoins() {
    fetch('/api/coins').then(res => res.json()).then(coins => {
        if(coins[myTeam] !== undefined) {
            document.getElementById('team-coins-val').innerText = coins[myTeam];
        }
    }).catch(err => err);
}
setInterval(fetchCoins, 10000); 

window.onload = function() {
    let statDiv = document.getElementById('status');
    if(statDiv) statDiv.innerHTML = `<button onclick="startGPS()" style="background:var(--team-color); color:#000; padding:10px 20px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; font-size:14px; text-transform:uppercase;">📍 GPS Verbinden</button>`;
    fetchCoins();
};

window.addEventListener('DOMContentLoaded', () => {
    const manualScanDiv = document.getElementById('manual-scan');
    
    if (manualScanDiv) {
        const nfcBtn = document.createElement('button');
        nfcBtn.innerHTML = "📶 NFC-Tag scannen";
        nfcBtn.className = "btn-send";
        nfcBtn.style.width = "100%";
        nfcBtn.style.marginBottom = "15px";
        nfcBtn.style.background = "var(--team-color)";
        nfcBtn.style.color = "#000";
        nfcBtn.style.fontSize = "16px";
        
        nfcBtn.onclick = async function() {
            if ('NDEFReader' in window) {
                try {
                    const ndef = new NDEFReader();
                    await ndef.scan();
                    
                    let statDiv = document.getElementById('status');
                    if(statDiv) {
                        statDiv.innerHTML = "📡 Halte dein Handy an den Tag.";
                        statDiv.style.color = "#00ffcc";
                    }
                    
                    ndef.addEventListener("reading", ({ message }) => {
                        const decoder = new TextDecoder();
                        for (const record of message.records) {
                            if (record.recordType === "url") {
                                let decodedUrl = decoder.decode(record.data);
                                let sep = decodedUrl.includes('?') ? '&' : '?';
                                window.location.href = `${decodedUrl}${sep}player=${myPlayerNum}`; 
                            } else if (record.recordType === "text") {
                                let code = decoder.decode(record.data);
                                window.location.href = `/scan.html?code=${encodeURIComponent(code)}&player=${myPlayerNum}`;
                            }
                        }
                    });
                } catch (error) {
                    alert("⚠️ NFC Scanner Fehler: " + error);
                }
            } else {
                alert("ℹ️ Auf diesem Gerät/Browser passiert das Scannen automatisch im Hintergrund. Schließe dieses Menü und halte den NFC-Tag einfach direkt an die Oberkante deines Handys!");
            }
        };
        
        manualScanDiv.insertBefore(nfcBtn, manualScanDiv.firstChild);
    }
});