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
    // 1. Wir fragen den Server nach der Zone UND dem Inventar
    fetch(`/api/zone/${encodeURIComponent(scannedCode)}?team=${team}&player=${myPlayerNum}`)
    .then(res => {
        if(!res.ok) throw new Error("Zone nicht gefunden");
        return res.json();
    })
    .then(data => {
        let props = data.zone;
        let gameSettings = data.gameSettings;
        let inventory = data.inventory; // NEU: Rucksack wird direkt mitgeladen

        if (gameSettings.gamePaused) {
            messageDiv.innerHTML = "🛑 <b>SPIEL PAUSIERT</b><br>Die Administratoren haben die Zonen gesperrt.";
            returnBtn.style.display = "block";
            return;
        }

        // ==========================================
        // ⏳ COOLDOWN & RESET CHECK (Global!)
        // ==========================================
        if (gameSettings.cooldownResetTime) {
            let lastScan = parseInt(localStorage.getItem(`lastScanTime_${team}_${myPlayerNum}`)) || 0;
            if (gameSettings.cooldownResetTime > lastScan) {
                localStorage.setItem(`lastScanTime_${team}_${myPlayerNum}`, 0);
            }
        }

        let effCooldown = gameSettings.teamCooldowns ? parseInt(gameSettings.teamCooldowns[team] || 0) : 0;
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

        // NEU: EMP CHECK IM SCANNER!
        if (props.empUntil && props.empUntil > Date.now()) {
            let leftMins = Math.ceil((props.empUntil - Date.now()) / 60000);
            messageDiv.innerHTML = `⚡ <b>SYSTEMAUSFALL</b><br>Zone durch EMP-Granate getroffen! Neustart in ca. ${leftMins} Minute(n).`;
            returnBtn.style.display = "block";
            return;
        }

        // ==========================================
        // 📍 GPS ODER SOFORT STARTEN?
        // ==========================================
        const isGpsRequired = gameSettings.gpsRequired !== false;

        if (isGpsRequired) {
            messageDiv.innerHTML = `<h3 style="color:#00ccff; text-align:center;">🛰️ Suche GPS Signal...</h3><p style="text-align:center; font-size:12px; color:#888;">Standort wird verifiziert (Anti-Cheat).</p>`;
            
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((position) => {
                    currentLat = position.coords.latitude;
                    currentLng = position.coords.longitude;
                    renderUI(props, gameSettings, inventory); 
                }, (error) => {
                    messageDiv.innerHTML = `❌ <b>Fehler:</b> Der Admin hat den GPS-Zwang aktiviert! Bitte erlaube den Standort in deinem Browser.`;
                    returnBtn.style.display = "block";
                }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            } else {
                messageDiv.innerHTML = "❌ Dein Gerät unterstützt kein GPS.";
                returnBtn.style.display = "block";
            }
        } else {
            renderUI(props, gameSettings, inventory, false); 
        }
    })
    .catch(err => {
        messageDiv.innerHTML = `❌ Fehler: Diese Zone existiert nicht auf der Karte.`; 
        returnBtn.style.display = "block";
    });
}

// ==========================================
// 🖥️ UI AUFBAUEN & FALLEN AUSLÖSEN
// ==========================================
function renderUI(props, gameSettings, inventory, showGpsText = true) {
    const newColor = teamColors[team];
    let isGray = (props.color === "#808080" || !props.color);

    // 🔌 EMP CHECK
    if (props.empUntil && props.empUntil > Date.now()) {
        messageDiv.innerHTML = `<div style="color:#00ffff; border: 2px solid #00ffff; padding: 15px; border-radius:8px; background:rgba(0,255,255,0.1);">
            🔌 <b>EMP AKTIV</b><br>Diese Zone wurde durch eine EMP-Granate komplett lahmgelegt. Scanner blockiert!
        </div>`;
        returnBtn.style.display = "block";
        return;
    }
    
    let trapsTriggered = 0;
    let buffsTriggered = 0;

    if (props.traps && Array.isArray(props.traps)) {
        props.traps.forEach(tColor => { if (tColor !== team) trapsTriggered++; });
    }
    if (props.buffs && Array.isArray(props.buffs)) {
        props.buffs.forEach(bColor => { if (bColor === team) buffsTriggered++; });
    }

    let uiHtml = "";
    // ==========================================
    // 👑 & 🏰 ANZEIGE FÜR BESONDERE ZONEN
    // ==========================================
    let specialHtml = "";
    if (props.isKotH) {
        specialHtml += `<div style="background:#222; border:1px solid #ffcc00; color:#ffcc00; padding:10px; border-radius:8px; margin-bottom:15px; font-weight:bold; text-align:center; box-shadow: 0 0 10px rgba(255, 204, 0, 0.3);">
            👑 KING OF THE HILL<br><span style="font-size:12px; font-weight:normal; color:#aaa;">Generiert 3x so viele Coins!</span>
        </div>`;
    }
    if (props.hqTeam) {
        let teamNames = { rot: 'ROT', blau: 'BLAU', gruen: 'GRÜN', gelb: 'GELB' };
        let hqColor = teamColors[props.hqTeam] || "#fff";
        let armorText = props.hqArmorHit ? "<span style='color:#ff4444; font-size:12px;'>⚠️ Panzerung gebrochen! (Nächster Treffer senkt Level)</span>" : "<span style='color:#aaa; font-size:12px;'>🛡️ Panzerung aktiv (2 Angriffe nötig)</span>";
        
        specialHtml += `<div style="background:#222; border:1px solid ${hqColor}; color:${hqColor}; padding:10px; border-radius:8px; margin-bottom:15px; font-weight:bold; text-align:center; box-shadow: 0 0 10px ${hqColor};">
            🏰 HAUPTQUARTIER ${teamNames[props.hqTeam] || ''}<br>${armorText}
        </div>`;
    }
    uiHtml += specialHtml;

    // 🚨 MINENFELD LOGIK
    if (trapsTriggered > 0) {
        // PASSIV: ENTSCHÄRFUNGS-KIT IM RUCKSACK?
        if (inventory && inventory.defuse > 0) {
            uiHtml += `<div style="color:#ffcc00; font-weight:bold; margin-bottom:15px; border: 1px solid #ffcc00; padding: 10px; border-radius:8px; background:rgba(255,204,0,0.1);">
                🛠️ ENTSCHÄRFUNGS-KIT EINGESETZT!<br><span style="font-size:12px; color:#ddd;">Du bist in ${trapsTriggered} Falle(n) getreten, aber dein Kit hat sie eliminiert!</span>
               </div>`;
            
            // Server die Fallen heimlich löschen lassen (verbraucht das Item)
            fetch('/api/zone-action', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ code: scannedCode, action: 'defuse_traps', team: team, player: myPlayerNum }) 
            });
            inventory.defuse -= 1; // Lokal abziehen, damit es UI-mäßig stimmt
        } else {
            // BOOM! Falle löst voll aus
            const now = Date.now();
            localStorage.setItem(`lastScanTime_${team}_${myPlayerNum}`, now); 
            
            fetch('/api/player-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team: team, player: myPlayerNum, timestamp: now }) });
            fetch('/api/zone-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: scannedCode, action: 'trigger_items', team: team, cooldownChange: trapsTriggered - buffsTriggered }) });

            messageDiv.innerHTML = `<div style="color:#ff4444; border: 2px solid #ff4444; padding: 15px; border-radius:8px; background:rgba(255,0,0,0.1);">
                💥 MINENFELD AUSGELÖST!<br>
                <span style="font-size:14px; color:#ddd;">Du bist in ${trapsTriggered} Falle(n) getreten. Dein Team hat +${trapsTriggered} Min. Cooldown!</span>
               </div>`;
            returnBtn.style.display = "block"; 
            return; // Abbruch! Keine Buttons anzeigen.
        }
    } else if (buffsTriggered > 0) {
        fetch('/api/zone-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: scannedCode, action: 'trigger_items', team: team, cooldownChange: -buffsTriggered }) });
        uiHtml += `<div style="color:#00ffcc; font-weight:bold; margin-bottom:15px; border: 1px solid #00ffcc; padding: 10px; border-radius:8px; background:rgba(0,255,200,0.1);">✨ BUFF GENUTZT (-${buffsTriggered} Min.)</div>`;
    }

    if(showGpsText) uiHtml += `<div style="text-align:center; margin-bottom:10px; color:#00ccff; font-size:12px;">📍 GPS verifiziert.</div>`;

    uiHtml += `<h3 style="color:#aaa; font-size:14px; text-transform:uppercase;">Wähle deine Aktion:</h3>`;
    
    if (props.color === newColor) {
        if (props.level < 3) uiHtml += `<button onclick="executeAction('upgrade')" class="btn" style="background:#3366ff; color:white;">🛡️ Verstärken (Lvl ${props.level} ➔ ${props.level + 1})</button>`;
        else uiHtml += `<p style="color:#33ff33; font-weight:bold; background:#111; padding:10px; border-radius:8px;">✅ Maximales Level (3) erreicht.</p>`;
    } else if (isGray) {
        uiHtml += `<button onclick="executeAction('capture')" class="btn" style="background:#33ff33; color:black;">🎯 Zone Einnehmen</button>`;
    } else {
        uiHtml += `<button onclick="executeAction('attack')" class="btn" style="background:#ff3333; color:white;">⚔️ Angreifen (Gegner Lvl ${props.level})</button>`;
    }


// ==========================================
    // 🎒 RUCKSACK-ITEMS PLATZIEREN
    // ==========================================
    if (gameSettings.shopEnabled !== false) {
        uiHtml += `<div id="inventory-section" style="margin-top:20px; text-align:center; color:#aaa;"><i>Durchsuche Rucksack... 🎒</i></div>`;
        
        fetch(`/api/inventory?team=${team}&player=${myPlayerNum}`)
        .then(res => res.json())
        .then(inv => {
            let invHtml = `<h3 style="color:#aaa; font-size:14px; text-transform:uppercase; text-align:left;">🎒 Aus dem Rucksack:</h3>`;
            
            // Helfer-Funktion für die Buttons
            const btn = (id, name, color, count) => {
                if(count > 0) return `<button onclick="useItemLocal('${id}')" class="btn" style="background:${color}; color:${id==='buff'?'black':'white'}; margin-bottom:8px;">${name} (${count})</button>`;
                return '';
            };

            if (props.color === newColor) {
                // EIGENE ZONE
                invHtml += btn('buff', '⚡ Buff platzieren', '#00ffcc', inv.buff);
                
                if(!inv.buff) invHtml += `<p style="font-size: 13px; color:#666;">Keine passenden Items im Rucksack.</p>`;
            } 
            else {
                // FEINDLICHE ODER GRAUE ZONE
                invHtml += btn('trap', '🪤 Falle legen', '#ff8800', inv.trap);
                invHtml += btn('drohne', '🚁 Drohne (Scannen)', '#0088ff', inv.drohne);
                invHtml += btn('entschaerfung', '✂️ Entschärfen', '#ff00ff', inv.entschaerfung);
                invHtml += btn('emp', '⚡ EMP werfen', '#ff3333', inv.emp);
                
                if (!isGray) {
                    invHtml += btn('taschendieb', '🕵️‍♂️ Taschendieb', '#8a2be2', inv.taschendieb);
                }

                if(!inv.trap && !inv.drohne && !inv.entschaerfung && !inv.emp && !inv.taschendieb) {
                    invHtml += `<p style="font-size: 13px; color:#666;">Keine passenden Items im Rucksack.</p>`;
                }
            }

            document.getElementById('inventory-section').innerHTML = invHtml;
        });
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
        body: JSON.stringify({ code: scannedCode, action: actionType, newColor: newColor, playerLat: currentLat, playerLng: currentLng, team: team, player: myPlayerNum }) 
    })
    .then(res => res.json())
    .then(result => {
        if(result.success) {
            // NEU: Wenn es ein freier Angriff auf ein gefallenes Team war, KEIN Cooldown starten!
            if (!result.noCooldown) {
                registerScanToServer();
            }
            
            let cdNotice = result.noCooldown ? `<br><br><span style="color:#00ffcc; font-weight:bold;">🆓 Freier Angriff! (Gegner hat kein HQ)</span>` : "";
            let stealNotice = result.stealMessage ? `<br><br><span style="color:#ffcc00; font-weight:bold; background:#222; padding:5px; border-radius:5px; display:inline-block;">${result.stealMessage}</span>` : "";
            
            messageDiv.innerHTML = `<h2 style="color:#33ff33; font-size:20px;">✅ Aktion erfolgreich!</h2><p>Zone gesichert.${stealNotice}${cdNotice}</p>`;
        } else if (result.error) {
            messageDiv.innerHTML = `<h2 style="color:#ff4444; font-size:20px;">❌ Abgelehnt</h2><p>${result.error}</p>`;
        }
    });
};

window.useItemLocal = function(itemType) {
    let confirmMsg = itemType === 'emp' ? "Willst du wirklich eine EMP-Granate zünden? (Zone 5 Min blockiert)" : "Item aus Rucksack platzieren?";
    if(!confirm(confirmMsg)) return;

    fetch('/api/shop/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: team, player: myPlayerNum, itemType: itemType, zoneCode: scannedCode })
    }).then(res => res.json()).then(response => {
        if(response.error) {
            alert("Fehler: " + response.error);
        } else {
            registerScanToServer(); // Nach Nutzung Scanner abkühlen lassen
            messageDiv.innerHTML = `<h2 style="color:#ffcc00; font-size:20px;">🎒 Item platziert!</h2><p>${response.message}</p>`;
        }
    });
};