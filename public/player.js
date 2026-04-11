// ==========================================
// 🔊 AUDIO & HAPTISCHES FEEDBACK SYSTEM
// ==========================================
window.playFeedback = function(type) {
    // 1. Vibration
    if (navigator.vibrate) {
        if (type === 'success') navigator.vibrate([100, 50, 100]);
        if (type === 'clump') navigator.vibrate([400, 100, 400]); // Error/Warnung
        if (type === 'uium') navigator.vibrate(50); // UI Klick/Öffnen
        if (type === 'dudim') navigator.vibrate([30, 50, 30]); // Chat/Funk
    }
    // 2. Audio
    try {
        let snd = new Audio(`/audio/${type}.mp3`);
        snd.volume = 0.5; // Angenehme Lautstärke
        snd.play();
    } catch(e) {
        console.log("Audio konnte nicht abgespielt werden:", e);
    }
}

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
// 🎨 CSS INJECTION FÜR TRANSPARENTE LABELS
// ==========================================
if (!document.getElementById('dummy-css')) {
    const style = document.createElement('style');
    style.id = 'dummy-css';
    style.innerHTML = `.dummy-transparent { background: transparent; border: none; box-shadow: none; }`;
    document.head.appendChild(style);
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
    playFeedback('uium'); // Klick Sound
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
    playFeedback('uium'); // UI Klick
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
// 💬 CHAT-SYSTEM
// ==========================================
let chatOpen = false;
window.toggleChat = function() {
    playFeedback('uium'); // Funkgerät öffnen/schließen
    const widget = document.getElementById('chat-widget');
    chatOpen = !chatOpen;
    if (chatOpen) {
        widget.classList.add('open');
        document.getElementById('chat-badge').style.display = 'none'; 
        loadPlayerChat(true); 
    } else {
        widget.classList.remove('open');
    }
}

window.sendChat = function() {
    const input = document.getElementById('chat-message-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    input.value = ''; 
    playFeedback('dudim'); // Sendesound

    fetch('/api/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ sender: `Sp. ${myPlayerNum}`, team: myTeam, message: msg, type: 'player' }) 
    }).then(() => loadPlayerChat(true)).catch(err => err);
}

let lastPlayerMsgCount = 0;
let currentChatVersion = 0; 

function loadPlayerChat(forceScroll = false) {
    fetch('/api/chat?v=' + currentChatVersion)
        .then(res => res.json())
        .then(response => {
            if (response.unchanged) return; 

            currentChatVersion = response.version;
            const allMsgs = response.messages;
            const teamMsgs = allMsgs.filter(m => m.team === myTeam || m.team === 'all');
            
            // Wenn neue Nachrichten reinkommen...
            if (teamMsgs.length > lastPlayerMsgCount && lastPlayerMsgCount !== 0) {
                if (!chatOpen) {
                    let badge = document.getElementById('chat-badge');
                    if(badge) badge.style.display = 'block';
                }
                // Sound abspielen (Funk-Benachrichtigung)
                playFeedback('dudim');
            }
            
            lastPlayerMsgCount = teamMsgs.length;
            const chatBox = document.getElementById('chat-messages');
            if(!chatBox) return;
            
            chatBox.innerHTML = ''; 

            teamMsgs.forEach(m => {
                const msgDiv = document.createElement('div');
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

            if (forceScroll || chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 50) {
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        }).catch(err => console.log("Chat offline."));
}

loadPlayerChat(true);

var map = L.map('map', { zoomControl: false }).setView([51.2277, 6.7735], 13.2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

var zoneLayer = L.layerGroup().addTo(map);
var playerLayer = L.layerGroup().addTo(map);
var nfcIcon = L.divIcon({ className: 'custom-nfc-marker', html: '<div style="background-color: #ff8800; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px #ff8800;"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });

// ==========================================
// 🔄 MAP UPDATE LOGIK
// ==========================================
let lastAnnouncementTime = 0; 
let timerInterval = null;
let globalCooldownMins = 0; 
let currentMapVersion = 0; 

function updateMap() {
    fetch('/api/zones?v=' + currentMapVersion).then(res => res.json()).then(response => {
        if (response.unchanged) return; 

        currentMapVersion = response.version;
        let data = response.data;
        
        if (data.gameSettings && data.gameSettings.announcement) { 
            if (data.gameSettings.announcement.timestamp > lastAnnouncementTime) {
                let timeDiff = Date.now() - data.gameSettings.announcement.timestamp;
                if (timeDiff < 30000 || lastAnnouncementTime > 0) {
                    let banner = document.getElementById('announcement-banner');
                    banner.innerHTML = "⚠️ ADMIN: " + data.gameSettings.announcement.text;
                    banner.style.display = 'block';
                    playFeedback('clump'); // Warnton bei Admin Announcement
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

if (data.gameSettings && data.gameSettings.cooldownResetTime) {
    let knownReset = parseInt(localStorage.getItem('knownResetTime')) || 0;
    // Wir prüfen ab jetzt, ob es ein NEUES Reset-Event vom Admin gab (nicht die pure Uhrzeit des Scans)
    if (data.gameSettings.cooldownResetTime > knownReset) {
        localStorage.setItem(`lastScanTime_${myTeam}_${myPlayerNum}`, 0);
        localStorage.setItem('knownResetTime', data.gameSettings.cooldownResetTime); // Reset markieren!
    }
}

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
            },
            onEachFeature: function (f, layer) {
                if (f.properties.type === "zone") {
                    let labels = [];
                    if (f.properties.isKotH) labels.push("👑");
                    if (f.properties.hqTeam) {
                        let icons = { rot: '🔴', blau: '🔵', gruen: '🟢', gelb: '🟡' };
                        labels.push(icons[f.properties.hqTeam] || "🏰 HQ");
                    }
                    if (labels.length > 0) {
                        layer.bindTooltip(
                            `<div style="background:rgba(0,0,0,0.8); padding:4px 8px; border-radius:6px; color:white; font-size:14px; border:1px solid #666; font-weight:bold; text-shadow: 0 0 5px black;">${labels.join(" ")}</div>`, 
                            { permanent: true, direction: "center", className: 'dummy-transparent' }
                        );
                    }
                }
            }
        }).addTo(zoneLayer);

        if (data.gameSettings && data.gameSettings.showPlayers === true) fetchPlayers();
        else playerLayer.clearLayers(); 
    }).catch(err => console.error(err)); 
}

// ==========================================
// ⏳ COOLDOWN CHECK
// ==========================================
window.isCooldownActive = false;

setInterval(() => {
    let pNum = myPlayerNum; 
    let tName = myTeam; 
    
    let lastScan = parseInt(localStorage.getItem(`lastScanTime_${tName}_${pNum}`)) || 0;
    let effectiveCooldownMins = globalCooldownMins || 0; 

    let cdBox = document.getElementById('dedicated-cooldown-display');
    let submitBtn = document.querySelector('.btn-send');
    let manualInput = document.getElementById('manual-code-input');

    if (lastScan > 0 && effectiveCooldownMins > 0) {
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
                cdBox.innerHTML = `⏳ SCANNER KÜHLT AB<br><span style="font-size:32px;">${m}:${s < 10 ? '0':''}${s}</span><br>
                                   <div style="font-size:12px; color:#aaa;">(Team Basis-Cooldown: ${effectiveCooldownMins} Min)</div>`;
            }
            if(submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = "0.3"; }
            if(manualInput) { manualInput.disabled = true; }
            
        } else {
            // Cooldown frisch abgelaufen!
            if (window.isCooldownActive) {
                playFeedback('uium'); // Kleines Geräusch wenn Scanner wieder bereit
            }
            window.isCooldownActive = false;
            localStorage.setItem(`lastScanTime_${tName}_${pNum}`, 0);
            
            fetch('/api/player-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team: tName, player: pNum, timestamp: 0 })
            }).catch(e => e);
            
            if(cdBox) {
                cdBox.style.borderColor = "#00ffcc";
                cdBox.style.background = "rgba(0, 255, 204, 0.1)";
                cdBox.style.color = "#00ffcc";
                cdBox.innerHTML = `✅ BEREIT FÜR DEN NÄCHSTEN SCAN!<br><div style="font-size:12px; color:#888;">(Basis-Cooldown: ${effectiveCooldownMins} Min)</div>`;
            }
            if(submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
            if(manualInput) { manualInput.disabled = false; }
        }
    } else {
        window.isCooldownActive = false;
        if(cdBox) {
            if (globalCooldownMins === 0) {
                cdBox.style.borderColor = "#444";
                cdBox.style.background = "#222";
                cdBox.style.color = "#aaa";
                cdBox.innerHTML = `Scanner dauerhaft aktiv (Kein Cooldown)`;
            } else {
                cdBox.style.borderColor = "#00ffcc";
                cdBox.style.background = "rgba(0, 255, 204, 0.1)";
                cdBox.style.color = "#00ffcc";
                cdBox.innerHTML = `✅ BEREIT FÜR DEN NÄCHSTEN SCAN!<br><div style="font-size:12px; color:#888;">(Basis-Cooldown: ${effectiveCooldownMins} Min)</div>`;
            }
        }
        if(submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
        if(manualInput) { manualInput.disabled = false; }
    }
}, 1000);

// ==========================================
// 📍 LIVE SPIELER STANDORTE (Optimiert)
// ==========================================
let currentLocVersion = 0;
function fetchPlayers() {
    fetch('/api/location?v=' + currentLocVersion)
        .then(res => res.json())
        .then(response => {
            if (response.unchanged) return;
            currentLocVersion = response.version;
            let players = response.data;
            
            playerLayer.clearLayers();
            for (let id in players) {
                const p = players[id];
                if(id === playerId) continue; 
                let playerColor = p.team === 'rot' ? '#ff3333' : (p.team === 'blau' ? '#3366ff' : (p.team === 'gruen' ? '#33ff33' : '#ffcc00'));
                L.circleMarker([p.lat, p.lng], { radius: 6, fillColor: playerColor, color: "#ffffff", weight: 2, fillOpacity: 1 }).addTo(playerLayer);
            }
        }).catch(err => err);
}


updateMap();

// ==========================================
// 🎒 RUCKSACK & SHOP MODAL (Optimiert)
// ==========================================
window.openShopModal = function() {
    playFeedback('uium'); // Rucksack öffnen Sound
    let modal = document.getElementById('shop-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shop-modal';
        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:flex; justify-content:center; align-items:center; flex-direction:column; color:white; font-family:monospace;`;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.innerHTML = `<h2>Lade Rucksack... ⏳</h2>`;

    // v=0 erzwingt hier einen kompletten Fetch, da der User aktiv das Modal öffnet
    Promise.all([
        fetch(`/api/inventory?v=0&team=${myTeam}&player=${myPlayerNum}`).then(res => res.json()),
        fetch('/api/coins?v=0').then(res => res.json())
    ]).then(([invRes, walletsRes]) => {
        let inv = invRes.data || invRes; 
        let wallets = walletsRes.data || walletsRes;
        let teamCoins = wallets[myTeam] || 0;
        
        const drawItem = (id, name, desc, price, color, count) => `
            <div style="display:flex; justify-content:space-between; background:#222; padding:8px; margin-bottom:8px; border-radius:5px; border-left:3px solid ${color};">
                <div>
                    <strong style="font-size:14px;">${name}</strong><br>
                    <span style="font-size:11px; color:#aaa;">${desc}<br>Im Rucksack: <span style="color:${color}; font-weight:bold;">${count || 0}x</span></span>
                </div>
                <button onclick="buyItemGlobal('${id}')" style="background:${color}; color:${id==='buff'?'black':'white'}; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">${price}💰</button>
            </div>
        `;

        modal.innerHTML = `
            <div style="background:#111; padding:15px; border:2px solid ${teamColors[myTeam]}; border-radius:10px; width:95%; max-width:400px; max-height:85vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="margin:0; font-size:18px;">🛒 BLACK MARKET</h2>
                    <button onclick="document.getElementById('shop-modal').style.display='none'; playFeedback('uium');" style="background:red; color:white; border:none; padding:5px 10px; border-radius:5px; font-weight:bold;">X</button>
                </div>
                
                <div style="background:#222; padding:10px; border-radius:5px; margin-bottom:15px; text-align:center;">
                    <span style="color:#aaa;">Team-Kasse:</span> <strong style="color:#ffcc00; font-size:20px;">${teamCoins} 💰</strong>
                </div>

                <h3 style="color:#aaa; border-bottom:1px solid #444; padding-bottom:5px; font-size:14px;">Taktische Items:</h3>
                
                ${drawItem('trap', '🪤 Falle (Lokal)', 'Bestraft Scanner (+1 Min).', 30, '#ff8800', inv.trap)}
                ${drawItem('buff', '⚡ Buff (Lokal)', 'Belohnt dein Team (-1 Min).', 30, '#00ffcc', inv.buff)}
                ${drawItem('defuse', '✂️ Entschärfer (Passiv)', 'Löscht alle Fallen der Zone.', 40, '#ff00ff', inv.defuse)}
                ${drawItem('pickpocket', '🕵️‍♂️ Dieb (Passiv)', 'Klaut Coins an Feindes-Zone.', 30, '#8a2be2', inv.pickpocket)}
                ${drawItem('emp', '⚡ EMP-Granate (Lokal)', 'Sperrt Zone für 15 Minuten.', 80, '#ff3333', inv.emp)}
                ${drawItem('revive', '🚑 Revive (Global)', 'Löscht Team-Cooldown.', 200, '#ff4444', inv.revive)}

                ${inv.revive > 0 ? `<button onclick="useItemGlobal('revive')" style="width:100%; padding:15px; background:#aa0000; color:white; font-weight:bold; font-size:16px; border:none; border-radius:8px; margin-top:10px; cursor:pointer; text-transform:uppercase; animation: pulse 2s infinite;">🚨 Revive zünden! (${inv.revive})</button>` : ''}
            </div>
        `;
    });
};

window.buyItemGlobal = function(type) {
    fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: myTeam, player: myPlayerNum, itemType: type })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            playFeedback('clump'); // Error Sound
            alert("❌ " + data.error);
        } else {
            playFeedback('success'); // Gekauft Sound
            openShopModal(); 
        }
    });
};

window.useItemGlobal = function(type) {
    // 🚨 1. PASSIVE ITEMS ABFANGEN
    if (type === 'defuse') {
        playFeedback('clump');
        alert("ℹ️ Der Entschärfer ist PASSIV! Du musst ihn nicht hier aktivieren. Wenn du eine gegnerische Falle scannst, erscheint in der Scan-App automatisch ein Button zum Entschärfen.");
        return;
    }
    if (type === 'pickpocket') {
        playFeedback('clump');
        alert("ℹ️ Der Dieb ist PASSIV! Behalte ihn einfach im Rucksack. Wenn du eine gegnerische Zone einnimmst, stiehlt er ganz von alleine Coins vom Feind!");
        return;
    }

    // 🚨 2. SANI-KASTEN (Revive) - Braucht keine Zone!
    if (type === 'revive') {
        if(!confirm("🚨 Sani-Kasten einsetzen? Dein gesamtes Team wird sofort wiederbelebt!")) return;
        
        fetch('/api/shop/use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team: myTeam, player: myPlayerNum, itemType: type })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                playFeedback('clump');
                alert("❌ " + data.error);
            } else {
                playFeedback('success');
                alert("✅ " + data.message);
                if (typeof openShopModal === 'function') openShopModal(); 
            }
        });
        return;
    }

    // 🚨 3. MAP-ITEMS (Falle, Buff, EMP) - Brauchen eine Zone!
    const targetZone = prompt(`Auf welche Zone möchtest du das Item anwenden?\nGib den ZONEN-CODE ein (z.B. TR#9694#33):`);
    
    // Wenn der Spieler auf Abbrechen drückt
    if (!targetZone || targetZone.trim() === "") return;

    fetch('/api/shop/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: myTeam, player: myPlayerNum, itemType: type, zoneCode: targetZone.trim() })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            playFeedback('clump');
            alert("❌ " + data.error);
        } else {
            playFeedback('success');
            alert("✅ " + data.message);
            if (typeof openShopModal === 'function') openShopModal(); 
        }
    });
};

// ==========================================
// 📊 STATS MODAL (Optimiert)
// ==========================================
window.openStatsModal = function() {
    playFeedback('uium'); // Akte öffnen Sound
    let modal = document.getElementById('shop-modal'); 
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shop-modal';
        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:flex; justify-content:center; align-items:center; flex-direction:column; color:white; font-family:monospace;`;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.innerHTML = `<h2>Lade Server-Akte... ⏳</h2>`;

    fetch(`/api/stats?v=0&team=${myTeam}&player=${myPlayerNum}`)
    .then(res => res.json())
    .then(data => {
        
        let teams = ['rot', 'blau', 'gruen', 'gelb'];
        teams.sort((a, b) => {
            if (data.leaderboard[b].zones !== data.leaderboard[a].zones) {
                return data.leaderboard[b].zones - data.leaderboard[a].zones;
            }
            return data.leaderboard[b].coins - data.leaderboard[a].coins;
        });

        let lbHtml = "";
        let rank = 1;
        const teamNames = { rot: 'ROT', blau: 'BLAU', gruen: 'GRÜN', gelb: 'GELB' };

        teams.forEach(t => {
            let isMe = t === myTeam;
            let bg = isMe ? '#333' : '#111';
            let border = isMe ? `border-left: 4px solid ${teamColors[t]};` : `border-left: 4px solid #444;`;
            
            let statusText = `Cooldown: ${data.teamCooldowns[t] || 0} Min`;
            if (globalMapData && globalMapData.gameSettings && globalMapData.gameSettings.fallenTeams && globalMapData.gameSettings.fallenTeams[t]) {
                statusText = `<span style="color:#ff4444; font-weight:bold;">☠️ HQ ZERSTÖRT</span>`;
            }

            lbHtml += `
                <div style="display:flex; justify-content:space-between; background:${bg}; padding:10px; margin-bottom:5px; border-radius:5px; ${border}">
                    <div>
                        <strong style="color:${teamColors[t]}">${rank}. Team ${teamNames[t]}</strong><br>
                        <span style="font-size:11px; color:#aaa;">${statusText}</span>
                    </div>
                    <div style="text-align:right;">
                        <strong>${data.leaderboard[t].zones} 🎯</strong><br>
                        <span style="font-size:12px; color:#ffcc00;">${data.leaderboard[t].coins} 💰</span>
                    </div>
                </div>
            `;
            rank++;
        });

        modal.innerHTML = `
            <div style="background:#111; padding:15px; border:2px solid ${teamColors[myTeam]}; border-radius:10px; width:95%; max-width:400px; max-height:85vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="margin:0; font-size:18px;">📊 LEADERBOARD</h2>
                    <button onclick="document.getElementById('shop-modal').style.display='none'; playFeedback('uium');" style="background:red; color:white; border:none; padding:5px 10px; border-radius:5px; font-weight:bold;">X</button>
                </div>
                
                <h3 style="color:#aaa; border-bottom:1px solid #444; padding-bottom:5px; font-size:14px;">Globale Rangliste:</h3>
                ${lbHtml}

                <h3 style="color:#aaa; border-bottom:1px solid #444; padding-bottom:5px; font-size:14px; margin-top:20px;">🕵️ Deine Agenten-Akte:</h3>
                <div style="background:#222; padding:15px; border-radius:5px; display:flex; justify-content:space-around; text-align:center;">
                    <div>
                        <div style="font-size:26px; color:#00ffcc; font-weight:bold;">${data.personal.hacks}</div>
                        <div style="font-size:11px; color:#aaa; text-transform:uppercase;">Zonen gehackt</div>
                    </div>
                    <div>
                        <div style="font-size:26px; color:#ff8800; font-weight:bold;">${data.personal.distance}</div>
                        <div style="font-size:11px; color:#aaa; text-transform:uppercase;">km Gelaufen</div>
                    </div>
                </div>
            </div>
        `;
    });
};

// ==========================================
// 📍 GPS LOGIK 
// ==========================================
var myLocationMarker;
window.startGPS = function() {
    playFeedback('uium');
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
    playFeedback('uium');
    const inputField = document.getElementById('manual-code-input');
    let rawCode = inputField.value.trim().toUpperCase(); 
    if (!rawCode) { alert("Bitte gib einen Code ein!"); return; }
    
    window.location.href = `/scan.html?code=${encodeURIComponent(rawCode)}&player=${myPlayerNum}`;
}

let currentCoinsVersion = 0;
function fetchCoins() {
    fetch('/api/coins?v=' + currentCoinsVersion)
        .then(res => res.json())
        .then(response => {
            if (response.unchanged) return;
            currentCoinsVersion = response.version;
            let coins = response.data;
            if(coins[myTeam] !== undefined) {
                document.getElementById('team-coins-val').innerText = coins[myTeam];
            }
        }).catch(err => err);
}


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
            playFeedback('uium');
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
                    playFeedback('clump');
                    alert("⚠️ NFC Scanner Fehler: " + error);
                }
            } else {
                playFeedback('clump');
                alert("ℹ️ Auf diesem Gerät/Browser passiert das Scannen automatisch im Hintergrund. Schließe dieses Menü und halte den NFC-Tag einfach direkt an die Oberkante deines Handys!");
            }
        };
        manualScanDiv.insertBefore(nfcBtn, manualScanDiv.firstChild);
    }
});
// ==========================================
// 🔌 SOCKET.IO - ECHTZEIT VERBINDUNG (NEU!)
// ==========================================
const socket = io(); // Verbindet sich sofort mit dem Server!

// 1. Initialer Ladevorgang (Beim App-Start)
loadPlayerChat(true);
updateMap();
fetchCoins();
fetchPlayers();

// 2. Wir warten völlig lautlos auf Befehle vom Server!
socket.on('update_map', () => {
    console.log("⚡ Server meldet: Neue Map-Daten!");
    updateMap(); 
});

socket.on('update_chat', () => {
    loadPlayerChat(false); 
});

socket.on('update_coins', () => {
    fetchCoins(); 
});

socket.on('update_locations', () => {
    fetchPlayers(); 
});

socket.on('update_stats', () => {
    // Falls das Dashboard gerade offen ist, lade es neu
    let modal = document.getElementById('shop-modal');
    if(modal && modal.style.display === 'flex' && modal.innerHTML.includes('LEADERBOARD')) {
        openStatsModal(); 
    }
});

socket.on('show_ticket', (data) => {
    playFeedback('success'); // Erfolgs-Sound für die Rheinturm-Tickets
    
    // Falls noch ein altes Overlay offen ist
    let existingTicket = document.getElementById('final-ticket-overlay');
    if (existingTicket) existingTicket.remove();

    // Wir fragen den Tresor über die sichere Route ab!
    let secureTicketUrl = `/api/ticket/${myTeam}/${myPlayerNum}`;

    let overlay = document.createElement('div');
    overlay.id = 'final-ticket-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.95); z-index: 99999;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        color: #00ffcc; font-family: monospace; text-align: center; padding: 20px;
        box-sizing: border-box; backdrop-filter: blur(5px);
    `;

    overlay.innerHTML = `
        <h1 style="color: #ffcc00; text-transform: uppercase; text-shadow: 0 0 10px #ffcc00; animation: pulse 2s infinite;">
            🎉 EVAKUIERUNG ERFOLGREICH 🎉
        </h1>
        <p style="font-size: 16px; color: white; margin-bottom: 20px; white-space: pre-wrap;">${data.message}</p>
        
        <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 0 20px ${teamColors[myTeam]};">
            <img src="${secureTicketUrl}" alt="Dein persönliches Ticket" style="width: 250px; height: 250px; display: block; object-fit: contain;">
        </div>
        
        <p style="margin-top: 15px; color: #888; font-size: 14px;">AGENT-ID: <strong style="color:${teamColors[myTeam]}">${myTeam.toUpperCase()} ${myPlayerNum}</strong></p>
        <p style="margin-top: 5px; color: #888; font-size: 12px;">Bitte Helligkeit des Displays erhöhen beim Scannen!</p>
        
        <button onclick="document.getElementById('final-ticket-overlay').remove(); playFeedback('uium');" 
                style="margin-top: 30px; background: #333; color: white; border: 1px solid #666; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            Ticket schließen
        </button>
    `;

    document.body.appendChild(overlay);
});

// ==========================================
// 📡 WALD-FAKTOR: RECONNECT NACH STANDBY & OFFLINE QUEUE
// ==========================================

// Überwacht, ob das Handy aus dem Standby aufwacht oder der Tab gewechselt wird
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.log("📱 Handy aufgewacht! Prüfe Verbindung...");
        
        // 1. Wenn der WebSocket tot ist, manuell neu verbinden
        if (socket && !socket.connected) {
            console.log("🔄 Stelle Verbindung zum Server wieder her...");
            socket.connect();
        }
        
        // 2. Den kompletten Spielstand vom Server anfragen
        fetch('/api/game-state')
            .then(res => res.json())
            .then(state => {
                if (window.updateGameUI) {
                    window.updateGameUI(state);
                } else {
                    location.reload(); 
                }
            })
            .catch(err => console.log("Kein Netz für Synchronisation:", err));
    }
});

socket.on("disconnect", () => {
    console.warn("⚠️ Verbindung zum Server verloren. (Edge/Funkloch)");
});

socket.on("connect", () => {
    console.log("✅ Erfolgreich mit Server verbunden!");
});

function syncOfflineQueue() {
    let queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (queue.length === 0) return;

    console.log("📡 Sende " + queue.length + " zwischengespeicherte Offline-Aktionen...");
    
    queue.forEach(payload => {
        fetch('/api/zone-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(() => {
            // Wenn erfolgreich gesendet, zeige einen kleinen Banner und einen positiven Sound
            playFeedback('success');
            let banner = document.getElementById('announcement-banner');
            banner.innerHTML = "✅ Offline-Scans erfolgreich nachgetragen!";
            banner.style.display = 'block';
            banner.style.background = "rgba(0, 255, 0, 0.9)";
            setTimeout(() => { banner.style.display = 'none'; }, 4000);
        }).catch(e => console.log("Immer noch offline..."));
    });

    // Warteschlange leeren
    localStorage.setItem('offlineQueue', '[]');
}

// Event-Listener: Feuern, wenn das Netz wieder da ist oder WebSocket reconnectet
window.addEventListener('online', syncOfflineQueue);
if (socket) socket.on('connect', syncOfflineQueue);