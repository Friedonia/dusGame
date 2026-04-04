const messageDiv = document.getElementById('message');
const returnBtn = document.getElementById('btn-return');

// 1. Team- & Spieler-Erkennung
const team = localStorage.getItem('team') || 'rot';
const urlParams = new URLSearchParams(window.location.search);
const myPlayerNum = urlParams.get('player') || localStorage.getItem('playerNum') || '1';

const teamColors = { 'rot': '#ff3333', 'blau': '#3366ff', 'gruen': '#33ff33', 'gelb': '#ffcc00' };

if (team && teamColors[team]) {
    document.getElementById('terminal').style.borderColor = teamColors[team];
    document.getElementById('terminal').style.boxShadow = `0 10px 30px rgba(${teamColors[team].replace('#', '')}88)`;
}

window.returnToHQ = function() {
    window.location.href = `/player.html?team=${team}&player=${myPlayerNum}`; 
};

let scannedCode = null;
const urlMatch = window.location.href.match(/code=([^&]+)/);
if (urlMatch) scannedCode = decodeURIComponent(urlMatch[1].split('&')[0]); 

let currentLat = null;
let currentLng = null;

if (!team) {
    messageDiv.innerHTML = "❌ Fehler: System konnte dein Team nicht verifizieren!";
    returnBtn.style.display = "block";
} else if (!scannedCode) {
    messageDiv.innerHTML = "❌ Fehler: Ungültiger oder beschädigter NFC-Tag.";
    returnBtn.style.display = "block";
} else {
    // 1. Wir fragen den Server nach der Zone UND den Einstellungen
    fetch(`/api/zone/${encodeURIComponent(scannedCode)}`)
    .then(res => {
        if(!res.ok) throw new Error("Zone nicht gefunden");
        return res.json();
    })
    .then(data => {
        let props = data.zone;
        let gameSettings = data.gameSettings;

        if (gameSettings.gamePaused) {
            messageDiv.innerHTML = "🛑 <b>SPIEL PAUSIERT</b><br>Die Administratoren haben die Zonen gesperrt.";
            returnBtn.style.display = "block";
            return;
        }

        // ==========================================
        // ⏳ COOLDOWN & RESET CHECK
        // ==========================================
        if (gameSettings.cooldownResetTime) {
            let lastScan = parseInt(localStorage.getItem(`lastScanTime_${team}_${myPlayerNum}`) || localStorage.getItem(`lastScanTime_${myPlayerNum}`)) || 0;
            if (gameSettings.cooldownResetTime > lastScan) {
                localStorage.setItem(`lastScanTime_${team}_${myPlayerNum}`, 0);
                localStorage.setItem(`cooldownModifier_${team}_${myPlayerNum}`, 0);
            }
        }

        let cooldownMins = gameSettings.teamCooldowns ? parseInt(gameSettings.teamCooldowns[team] || 0) : 0;
        let modifier = parseInt(localStorage.getItem(`cooldownModifier_${team}_${myPlayerNum}`) || 0);
        let effCooldown = cooldownMins + modifier;
        let lastScan = parseInt(localStorage.getItem(`lastScanTime_${team}_${myPlayerNum}`) || 0);
        
        if (effCooldown > 0 && (Date.now() - lastScan) < (effCooldown * 60000)) {
            messageDiv.innerHTML = `⏳ <b>COOLDOWN AKTIV</b><br>Dein Scanner (Spieler ${myPlayerNum}) muss abkühlen.`;
            returnBtn.style.display = "block";
            return;
        }

        if (props.locked) { 
            messageDiv.innerHTML = "🔒 <b>ZONE GESPERRT</b><br>Zugriff durch Admin verweigert."; 
            returnBtn.style.display = "block";
            return; 
        }

        // ==========================================
        // 📍 GPS ODER SOFORT STARTEN?
        // ==========================================
        // Prüfen, ob der Admin GPS ausgemacht hat. Wenn nichts da steht, ist es AN.
        const isGpsRequired = gameSettings.gpsRequired !== false;

        if (isGpsRequired) {
            messageDiv.innerHTML = `<h3 style="color:#00ccff; text-align:center;">🛰️ Suche GPS Signal...</h3><p style="text-align:center; font-size:12px; color:#888;">Standort wird verifiziert (Anti-Cheat).</p>`;
            
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((position) => {
                    currentLat = position.coords.latitude;
                    currentLng = position.coords.longitude;
                    renderUI(props, gameSettings); // GPS gefunden -> Knöpfe anzeigen!
                }, (error) => {
                    messageDiv.innerHTML = `❌ <b>Fehler:</b> Der Admin hat den GPS-Zwang aktiviert! Bitte erlaube den Standort in deinem Browser.`;
                    returnBtn.style.display = "block";
                }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            } else {
                messageDiv.innerHTML = "❌ Dein Gerät unterstützt kein GPS.";
                returnBtn.style.display = "block";
            }
        } else {
            // Admin hat GPS ausgemacht -> Wir überspringen das Warten und zeigen sofort die Knöpfe!
            renderUI(props, gameSettings, false); 
        }
    })
    .catch(err => {
        messageDiv.innerHTML = `❌ Fehler: Diese Zone existiert nicht auf der Karte.`; 
        returnBtn.style.display = "block";
    });
}

// ==========================================
// 🖥️ UI AUFBAUEN (Wird gerufen, wenn GPS da ist oder ignoriert wird)
// ==========================================
function renderUI(props, gameSettings, showGpsText = true) {
    const newColor = teamColors[team];
    let isGray = (props.color === "#808080" || !props.color);
    let trapTriggered = false;
    let buffTriggered = false;

    if (props.trap && props.trap !== team) {
        trapTriggered = true;
        localStorage.setItem(`cooldownModifier_${team}_${myPlayerNum}`, 1);
    }
    if (props.buff && props.buff === team) {
        buffTriggered = true;
        localStorage.setItem(`cooldownModifier_${team}_${myPlayerNum}`, -1);
    }

    if (trapTriggered || buffTriggered) {
        fetch('/api/zone-action', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ code: scannedCode, action: 'clear_items' }) 
        });
    }

    let uiHtml = "";
    if(showGpsText) {
        uiHtml += `<div style="text-align:center; margin-bottom:10px; color:#00ccff; font-size:12px;">📍 GPS verifiziert.</div>`;
    } else {
        uiHtml += `<div style="text-align:center; margin-bottom:10px; color:#ffcc00; font-size:12px;">⚠️ GPS-Zwang ist durch Admin deaktiviert.</div>`;
    }
    
    if (trapTriggered) uiHtml += `<div style="color:#ff4444; font-weight:bold; margin-bottom:15px; border: 1px solid #ff4444; padding: 10px; border-radius:8px; background:rgba(255,0,0,0.1);">💥 FALLE AUSGELÖST!<br><span style="font-size:13px; color:#ddd;">+1 Min. Cooldown-Strafe für deinen nächsten Scan!</span></div>`;
    if (buffTriggered) uiHtml += `<div style="color:#00ffcc; font-weight:bold; margin-bottom:15px; border: 1px solid #00ffcc; padding: 10px; border-radius:8px; background:rgba(0,255,200,0.1);">✨ BUFF GENUTZT!<br><span style="font-size:13px; color:#ddd;">-1 Min. Cooldown-Bonus erhalten!</span></div>`;

    uiHtml += `<h3 style="color:#aaa; font-size:14px; text-transform:uppercase;">Wähle deine Aktion:</h3>`;
    
    if (props.color === newColor) {
        if (props.level < 3) {
            uiHtml += `<button onclick="executeAction('upgrade')" class="btn" style="background:#3366ff; color:white;">🛡️ Verstärken (Lvl ${props.level} ➔ ${props.level + 1})</button>`;
        } else {
            uiHtml += `<p style="color:#33ff33; font-weight:bold; background:#111; padding:10px; border-radius:8px;">✅ Maximales Level (3) erreicht.</p>`;
        }
    } else if (isGray) {
        uiHtml += `<button onclick="executeAction('capture')" class="btn" style="background:#33ff33; color:black;">🎯 Zone Einnehmen</button>`;
    } else {
        uiHtml += `<button onclick="executeAction('attack')" class="btn" style="background:#ff3333; color:white;">⚔️ Angreifen (Gegner Lvl ${props.level})</button>`;
    }

    // 🛒 SHOP
    if (gameSettings.shopEnabled !== false) {
        uiHtml += `<h3 style="color:#aaa; margin-top:20px; font-size:14px; text-transform:uppercase;">🛒 Shop (30 Coins):</h3>`;
        if (isGray && !props.trap && !trapTriggered) {
            uiHtml += `<button onclick="buyShopItem('trap')" class="btn" style="background:#ff8800; color:white;">🪤 Falle legen (Zone bleibt grau)</button>`;
        } else if (props.color === newColor && !props.buff && !buffTriggered) {
            uiHtml += `<button onclick="buyShopItem('buff')" class="btn" style="background:#00ffcc; color:black;">⚡ Cooldown-Buff platzieren</button>`;
        } else {
            uiHtml += `<p style="font-size: 13px; color:#666; background:#111; padding:10px; border-radius:8px;">Der Shop ist an dieser Zone aktuell nicht nutzbar.</p>`;
        }
    }

    messageDiv.innerHTML = uiHtml;
    returnBtn.style.display = "block"; 
}

// ==========================================
// 🚀 AKTIONEN SENDEN 
// ==========================================
function registerScanToServer() {
    const now = Date.now();
    localStorage.setItem(`lastScanTime_${team}_${myPlayerNum}`, now); 
    fetch('/api/player-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: team, player: myPlayerNum, timestamp: now })
    }).catch(err => console.error(err));
}

window.executeAction = function(actionType) {
    const newColor = teamColors[team];
    fetch('/api/zone-action', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ code: scannedCode, action: actionType, newColor: newColor, playerLat: currentLat, playerLng: currentLng }) 
    })
    .then(res => res.json())
    .then(result => {
        if(result.success) {
            registerScanToServer();
            messageDiv.innerHTML = `<h2 style="color:#33ff33; font-size:20px;">✅ Zone gesichert!</h2><p>Deine Aktion wurde erfolgreich übermittelt.</p>`;
        } else if (result.error) {
            messageDiv.innerHTML = `<h2 style="color:#ff4444; font-size:20px;">❌ Abgelehnt</h2><p>${result.error}</p>`;
        }
    });
};

window.buyShopItem = function(itemType) {
    fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: team, zoneCode: scannedCode, itemType: itemType })
    }).then(res => res.json()).then(response => {
        if(response.error) {
            alert("Fehler: " + response.error);
        } else {
            registerScanToServer();
            messageDiv.innerHTML = `<h2 style="color:#ffcc00; font-size:20px;">🛒 Item gekauft!</h2><p>Neue Team-Kasse: ${response.newBalance} Coins.</p>`;
        }
    });
};