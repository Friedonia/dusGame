const messageDiv = document.getElementById('message');
const returnBtn = document.getElementById('btn-return');

// 1. Team- & Spieler-Erkennung & dynamisches Design
const team = localStorage.getItem('team');
const urlParams = new URLSearchParams(window.location.search);
const myPlayerNum = urlParams.get('player') || localStorage.getItem('playerNum') || '1';

const teamColors = { 'rot': '#ff3333', 'blau': '#3366ff', 'gruen': '#33ff33', 'gelb': '#ffcc00' };

if (team && teamColors[team]) {
    document.getElementById('terminal').style.borderColor = teamColors[team];
    document.getElementById('terminal').style.boxShadow = `0 10px 30px rgba(${teamColors[team].replace('#', '')}88)`;
}

// 2. Intelligente Rückleitung
window.returnToHQ = function() {
    window.location.href = `/player.html?team=${team}&player=${myPlayerNum}`; 
};

// 3. Code extrahieren
let scannedCode = null;
const urlMatch = window.location.href.match(/code=([^&]+)/);
if (urlMatch) scannedCode = decodeURIComponent(urlMatch[1].split('&')[0]); // Sichert ab, falls &player dahinter steht

if (!team) {
    messageDiv.innerHTML = "❌ Fehler: System konnte dein Team nicht verifizieren!";
    returnBtn.style.display = "block";
} else if (!scannedCode) {
    messageDiv.innerHTML = "❌ Fehler: Ungültiger oder beschädigter NFC-Tag.";
    returnBtn.style.display = "block";
} else {
    const newColor = teamColors[team];

    fetch('/api/zones').then(res => res.json()).then(data => {
        if (data.gameSettings && data.gameSettings.gamePaused) {
            messageDiv.innerHTML = "🛑 <b>SPIEL PAUSIERT</b><br>Die Administratoren haben die Zonen gesperrt.";
            returnBtn.style.display = "block";
            return;
        }

        // ==========================================
        // ⏳ SPIELER-COOLDOWN & RESET LOGIK
        // ==========================================
        // 1. Reset-Signal vom Admin prüfen (für den aktuellen Spieler)
        if (data.gameSettings && data.gameSettings.cooldownResetTime) {
            let lastScan = localStorage.getItem('lastScanTime_' + myPlayerNum) || 0;
            if (data.gameSettings.cooldownResetTime > lastScan) {
                localStorage.setItem('lastScanTime_' + myPlayerNum, 0);
                localStorage.setItem('cooldownModifier_' + myPlayerNum, 0);
            }
        }

        // 2. Individuellen Team-Cooldown auslesen
        let cooldownMins = 0;
        if (data.gameSettings && data.gameSettings.teamCooldowns) {
            cooldownMins = parseInt(data.gameSettings.teamCooldowns[team]) || 0;
        }
        
        let modifier = parseInt(localStorage.getItem('cooldownModifier_' + myPlayerNum) || 0);
        let effCooldown = cooldownMins + modifier;
        let lastScan = localStorage.getItem('lastScanTime_' + myPlayerNum) || 0;
        
        if (effCooldown > 0 && (Date.now() - lastScan) < (effCooldown * 60000)) {
            messageDiv.innerHTML = `⏳ <b>COOLDOWN AKTIV</b><br>Dein Scanner (Spieler ${myPlayerNum}) muss abkühlen.`;
            returnBtn.style.display = "block";
            return;
        }

        // ==========================================
        // 🗺️ ZONEN-LOGIK
        // ==========================================
        let targetZone = null;
        if (data.features) targetZone = data.features.find(f => f.properties.type === "zone" && f.properties.code === scannedCode);

        if (!targetZone) { 
            messageDiv.innerHTML = `❌ Fehler: Diese Zone existiert nicht in der Datenbank.`; 
            returnBtn.style.display = "block";
            return; 
        }
        if (targetZone.properties.locked) { 
            messageDiv.innerHTML = "🔒 <b>ZONE GESPERRT</b><br>Zugriff durch Admin verweigert."; 
            returnBtn.style.display = "block";
            return; 
        }

        let props = targetZone.properties;
        let isGray = (props.color === "#808080" || !props.color);

        // 🚨 FALLEN & BUFFS
        let trapTriggered = false;
        let buffTriggered = false;

        if (props.trap && props.trap !== team) {
            trapTriggered = true;
            localStorage.setItem('cooldownModifier_' + myPlayerNum, 1);
            delete props.trap; 
        }
        if (props.buff && props.buff === team) {
            buffTriggered = true;
            localStorage.setItem('cooldownModifier_' + myPlayerNum, -1);
            delete props.buff; 
        }

        let uiHtml = "";
        if (trapTriggered) {
            uiHtml += `<div style="color:#ff4444; font-weight:bold; margin-bottom:15px; border: 1px solid #ff4444; padding: 10px; border-radius:8px; background:rgba(255,0,0,0.1);">💥 FALLE AUSGELÖST!<br><span style="font-size:13px; color:#ddd;">+1 Min. Cooldown-Strafe für deinen nächsten Scan!</span></div>`;
        }
        if (buffTriggered) {
            uiHtml += `<div style="color:#00ffcc; font-weight:bold; margin-bottom:15px; border: 1px solid #00ffcc; padding: 10px; border-radius:8px; background:rgba(0,255,200,0.1);">✨ BUFF GENUTZT!<br><span style="font-size:13px; color:#ddd;">-1 Min. Cooldown-Bonus erhalten!</span></div>`;
        }

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
        if (data.gameSettings && data.gameSettings.shopEnabled !== false) {
            uiHtml += `<h3 style="color:#aaa; margin-top:20px; font-size:14px; text-transform:uppercase;">🛒 Shop (30 Coins):</h3>`;
            if (isGray && !props.trap) {
                uiHtml += `<button onclick="buyShopItem('trap')" class="btn" style="background:#ff8800; color:white;">🪤 Falle legen (Zone bleibt grau)</button>`;
            } else if (props.color === newColor && !props.buff) {
                uiHtml += `<button onclick="buyShopItem('buff')" class="btn" style="background:#00ffcc; color:black;">⚡ Cooldown-Buff platzieren</button>`;
            } else {
                uiHtml += `<p style="font-size: 13px; color:#666; background:#111; padding:10px; border-radius:8px;">Der Shop ist an dieser Zone aktuell nicht nutzbar.</p>`;
            }
        }

        messageDiv.innerHTML = uiHtml;
        returnBtn.style.display = "block"; // Falls der Spieler nichts drücken will

        // ==========================================
        // 📡 SERVER-KOMMUNIKATION & COOLDOWN START
        // ==========================================
        
        function registerScanToServer() {
            const now = Date.now();
            localStorage.setItem('lastScanTime_' + myPlayerNum, now); 
            
            // Sendet den Zeitstempel an den Server, damit der Admin das Dashboard sieht
            fetch('/api/player-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team: team, player: myPlayerNum, timestamp: now })
            }).catch(err => console.error("Admin-Dashboard Update fehlgeschlagen:", err));
        }

        window.executeAction = function(actionType) {
            if (actionType === 'upgrade') props.level += 1;
            else if (actionType === 'capture') { props.color = newColor; props.level = 1; }
            else if (actionType === 'attack') {
                props.level -= 1;
                if (props.level <= 0) { props.color = "#808080"; props.level = 0; }
            }

            fetch('/api/zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            .then(() => {
                registerScanToServer();
                messageDiv.innerHTML = `<h2 style="color:#33ff33; font-size:20px;">✅ Zone gesichert!</h2><p>Die Daten wurden an den Server übertragen.</p>`;
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

        // Wenn beim Öffnen eine Falle hochging, abspeichern (da sie jetzt verbraucht ist)
        if (trapTriggered || buffTriggered) {
            fetch('/api/zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            // WICHTIG: Wenn man nur eine Falle auslöst, ohne eine Aktion zu machen, soll das den Scan zählen?
            // Wenn ja, dann hier auch registerScanToServer() aufrufen.
            // registerScanToServer(); 
        }
    });
}