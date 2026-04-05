// ==========================================
// 🎨 CSS INJECTION FÜR TRANSPARENTE LABELS
// ==========================================
const style = document.createElement('style');
style.innerHTML = `.dummy-transparent { background: transparent; border: none; box-shadow: none; }`;
document.head.appendChild(style);

// ==========================================
// 🔐 CODE-GENERATOR ALGORITHMUS
// ==========================================
const lettersList = ['R', 'E', 'I', 'H', 'N', 'T', 'U', 'R', 'M'];

function generateSpecialCode(number = 0) {
    const char1 = lettersList[Math.floor(Math.random() * lettersList.length)];
    const char2 = lettersList[Math.floor(Math.random() * lettersList.length)];
    let digits = [];
    if (number !== 0) {
        const paddedStr = String(number).padStart(4, '0');
        digits = paddedStr.split('').map(Number);
    } else {
        for (let i = 0; i < 4; i++) digits.push(Math.floor(Math.random() * 10));
    }
    const digitStr = digits.join('');
    const val1 = lettersList.indexOf(char1);
    const val2 = lettersList.indexOf(char2);
    const totalSum = digits.reduce((a, b) => a + b, 0) + val1 + val2;
    const checksum = String(totalSum).padStart(2, '0');
    return `${char1}${char2}#${digitStr}#${checksum}`;
}

// ==========================================
// 🧠 RÄUMLICHE ERKENNUNG (Point in Polygon)
// ==========================================
function isPointInPolygon(latlng, polygon) {
    let latlngs = polygon.getLatLngs();
    while (latlngs.length > 0 && Array.isArray(latlngs[0])) latlngs = latlngs[0];
    let x = latlng.lat, y = latlng.lng, inside = false;
    for (let i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
        let xi = latlngs[i].lat, yi = latlngs[i].lng;
        let xj = latlngs[j].lat, yj = latlngs[j].lng;
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ==========================================
// 🎙 GAME MASTER GLOBALS
// ==========================================
let gameEndTime = null;
let gameAnnouncement = null;

function startTimer() {
    let mins = document.getElementById('timer-input').value;
    gameEndTime = Date.now() + (mins * 60000); 
    saveZones();
    alert("Countdown (" + mins + " Min) wurde gestartet!");
}

function stopTimer() {
    gameEndTime = null;
    saveZones();
    alert("Countdown gestoppt!");
}

function sendAnnouncement() {
    let msg = document.getElementById('announcement-input').value.trim();
    if(!msg) return;
    gameAnnouncement = { text: msg, timestamp: Date.now() };
    document.getElementById('announcement-input').value = '';
    saveZones();
    alert("Rundfunk gesendet: " + msg);
}

window.toggleGameFreeze = function() {
    let isPaused = document.getElementById('global-freeze-toggle').checked;
    if (isPaused) {
        drawnItems.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties.type === "nfc-tag") {
                layer.feature.properties.visibleToPlayers = false;
                layer.setIcon(getNfcIcon(false));
                layer.setPopupContent(generateNfcPopupContent(layer.feature.properties));
            }
        });
        alert("🛑 SPIEL PAUSIERT! Alle NFC-Tags wurden deaktiviert und sind für Spieler unsichtbar.");
    } else {
        alert("✅ Spiel wieder freigegeben. Du musst die NFC-Tags jetzt manuell wieder einschalten.");
    }
    saveZones();
}

function toggleDock() {
    const dock = document.getElementById('controls');
    if(dock) dock.classList.toggle('minimized');
}

// ==========================================
// 🛠 DYNAMISCHE ICONS & KARTEN SETUP
// ==========================================
var bounds = [[51.205, 6.73], [51.258, 6.80]];
var map = L.map('map', { zoomControl: false, minZoom: 13.2, maxBounds: bounds, maxBoundsViscosity: 1.0 }).setView([51.2277, 6.7735], 13.2);        
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

var drawnItems = new L.FeatureGroup().addTo(map);
var playerGroup = L.layerGroup().addTo(map); 

var drawControl = new L.Control.Draw({ edit: { featureGroup: drawnItems }, draw: { polygon: true, polyline: true, marker: { icon: getNfcIcon(false) }, rectangle: false, circle: false, circlemarker: false } });
map.addControl(drawControl);

function getNfcIcon(isVisible) {
    let color = isVisible ? "#ff8800" : "#666666"; 
    let shadow = isVisible ? "0 0 8px #ff8800" : "none"; 
    return L.divIcon({ className: 'custom-nfc-marker', html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: ${shadow}; transition: background-color 0.3s;"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
}

function toggleSection(id, element) {
    var content = document.getElementById(id);
    if (content.style.display === "none") {
        content.style.display = "block"; element.innerHTML = element.innerHTML.replace("▶", "▼");
    } else {
        content.style.display = "none"; element.innerHTML = element.innerHTML.replace("▼", "▶");
    }
}

function updateStatistics() {
    let counts = { '#ff3333': 0, '#3366ff': 0, '#33ff33': 0, '#ffcc00': 0 };
    drawnItems.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties && layer.feature.properties.type === "zone") {
            let color = layer.feature.properties.color;
            if (counts[color] !== undefined) counts[color]++;
        }
    });
    document.getElementById('stat-rot').innerText = counts['#ff3333'];
    document.getElementById('stat-blau').innerText = counts['#3366ff'];
    document.getElementById('stat-gruen').innerText = counts['#33ff33'];
    document.getElementById('stat-gelb').innerText = counts['#ffcc00'];
}

// ==========================================
// 👁️ LEGENDE & SICHTBARKEIT 
// ==========================================
function applyZoneStyle(layer) {
    let props = layer.feature.properties;
    let isVisible = document.getElementById('check-zones') ? document.getElementById('check-zones').checked : true;
    
    if (!isVisible) {
        layer.setStyle({ opacity: 0, fillOpacity: 0 });
        if (layer.getTooltip()) layer.unbindTooltip();
        return;
    }

    if (props.locked) {
        layer.setStyle({ color: '#ffffff', fillColor: '#222222', opacity: 1, fillOpacity: 0.8, dashArray: '10, 10' });
    } else {
        let op = 0.4;
        if (props.level === 2) op = 0.65;
        if (props.level === 3) op = 0.9;
        layer.setStyle({ color: props.color, fillColor: props.color, opacity: 1, fillOpacity: op, dashArray: '' });
    }

    // 👑 🏰 HAUPTQUARTIER & KOTH TOOLTIPS (Markierungen)
    if (layer.getTooltip()) layer.unbindTooltip();
    let labels = [];
    if (props.isKotH) labels.push("👑");
    if (props.hqTeam) {
        let icons = { rot: '🔴 HQ', blau: '🔵 HQ', gruen: '🟢 HQ', gelb: '🟡 HQ' };
        labels.push(icons[props.hqTeam] || "🏰 HQ");
    }
    if (labels.length > 0 && isVisible) {
        layer.bindTooltip(`<div style="background:rgba(0,0,0,0.7); padding:4px 8px; border-radius:6px; color:white; font-size:14px; border:1px solid #666; font-weight:bold;">${labels.join(" ")}</div>`, { permanent: true, direction: "center", className: 'dummy-transparent' });
    }
}

function toggleFeatures(type, isVisible) {
    drawnItems.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties && layer.feature.properties.type === type) {
            if (type === 'zone') {
                applyZoneStyle(layer); 
                if (layer._path) layer._path.style.pointerEvents = isVisible ? 'auto' : 'none';
            } 
            else if (type === 'transit-line') {
                layer.setStyle({ opacity: isVisible ? 1 : 0 });
                if (layer._path) layer._path.style.pointerEvents = isVisible ? 'auto' : 'none';
            } 
            else if (type === 'nfc-tag') {
                if (layer._icon) layer._icon.style.display = isVisible ? '' : 'none';
                if (layer._shadow) layer._shadow.style.display = isVisible ? '' : 'none';
            }
        }
    });
}

function applyAllLegendFilters() {
    let showZones = document.getElementById('check-zones') ? document.getElementById('check-zones').checked : true;
    let showLines = document.getElementById('check-lines') ? document.getElementById('check-lines').checked : true;
    let showTags = document.getElementById('check-tags') ? document.getElementById('check-tags').checked : true;
    
    toggleFeatures('zone', showZones);
    toggleFeatures('transit-line', showLines);
    toggleFeatures('nfc-tag', showTags);
}

// ==========================================
// 🛠 POPUP GENERATOREN & HQ LOGIK
// ==========================================
function generateZonePopupContent(props) {
    let lvl = props.level || 1;
    let zCode = props.code || "Kein Code";
    let lockState = props.locked ? "<span style='color:#ff4444;'>Gesperrt</span>" : "<span style='color:#33ff33;'>Aktiv</span>";
    let btnText = props.locked ? "🔓 Zone entsperren" : "🔒 Zone sperren";
    
    let itemStatus = "";
    if (props.traps && props.traps.length > 0) itemStatus += `<span style='color:#ff8800; font-weight:bold;'>🪤 ${props.traps.length} Falle(n)</span><br>`;
    if (props.buffs && props.buffs.length > 0) itemStatus += `<span style='color:#00ffcc; font-weight:bold;'>⚡ ${props.buffs.length} Buff(s)</span><br>`;
    if (props.empUntil && props.empUntil > Date.now()) itemStatus += `<span style='color:#ff3333; font-weight:bold;'>⚡ EMP AKTIV</span><br>`;

    if (itemStatus === "") itemStatus = "<span style='color:#888;'>Keine</span>";

    let deleteBtn = (props.traps?.length > 0 || props.buffs?.length > 0 || (props.empUntil && props.empUntil > Date.now())) 
                    ? `<button onclick="removeZoneItem('${zCode}')" style="background:#ff4444; color:white; border:none; border-radius:3px; cursor:pointer; padding:4px; font-size:11px; width:100%; margin-top:5px;">🗑️ Items & EMP löschen</button>` 
                    : "";

    // 👑 KING OF THE HILL & HQ DROPDOWN
    let kothHtml = `
        <label style="display:block; margin-top:10px; cursor:pointer; background:#222; padding:5px; border-radius:4px; border:1px solid #444;">
            <input type="checkbox" id="koth-${zCode}" onchange="updateZoneSpecial('${zCode}')" ${props.isKotH ? 'checked' : ''}>
            👑 King of the Hill (3x Coins)
        </label>
    `;

    let hqHtml = `
        <label style="display:block; margin-top:5px; background:#222; padding:5px; border-radius:4px; border:1px solid #444;">
            HQ Zuweisung:<br>
            <select id="hq-${zCode}" onchange="updateZoneSpecial('${zCode}')" style="width:100%; background:#111; color:white; border:1px solid #555; padding:5px; margin-top:3px;">
                <option value="">-- Kein HQ --</option>
                <option value="rot" ${props.hqTeam === 'rot' ? 'selected' : ''}>🔴 HQ Rot</option>
                <option value="blau" ${props.hqTeam === 'blau' ? 'selected' : ''}>🔵 HQ Blau</option>
                <option value="gruen" ${props.hqTeam === 'gruen' ? 'selected' : ''}>🟢 HQ Grün</option>
                <option value="gelb" ${props.hqTeam === 'gelb' ? 'selected' : ''}>🟡 HQ Gelb</option>
            </select>
        </label>
    `;
    
    return `<div style="font-size:13px; font-family:sans-serif; min-width:180px;">
                <b style="font-size:15px;">Zone</b><br>
                Code: <span style="font-family:monospace; color:#00ffcc;">${zCode}</span><br>
                Level: <b style="color:yellow;">${lvl}</b><br>
                Status: <b>${lockState}</b><br>
                <hr style="border-color:#555; margin:8px 0;">
                <b>Aktive Items:</b><br> ${itemStatus} ${deleteBtn}
                <hr style="border-color:#555; margin:8px 0;">
                ${kothHtml}
                ${hqHtml}
                <hr style="border-color:#555; margin:8px 0;">
                <button onclick="toggleZoneLock('${zCode}')" style="background:#444; color:white; border:1px solid #666; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; width:100%; font-weight:bold;">${btnText}</button>
            </div>`;
}

window.updateZoneSpecial = function(code) {
    let isKotH = document.getElementById(`koth-${code}`).checked;
    let hqTeam = document.getElementById(`hq-${code}`).value;

    fetch('/api/admin/set-zone-special', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, isKotH: isKotH, hqTeam: hqTeam })
    })
    .then(res => res.json())
    .then(data => {
        drawnItems.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties && layer.feature.properties.code === code) {
                layer.feature.properties.isKotH = isKotH;
                layer.feature.properties.hqTeam = hqTeam;
                applyZoneStyle(layer);
            }
        });
        saveZones();
    });
};

window.removeZoneItem = function(code) {
    drawnItems.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties && layer.feature.properties.code === code) {
            delete layer.feature.properties.buffs;
            delete layer.feature.properties.traps;
            delete layer.feature.properties.empUntil;
            saveZones(); 
            if (layer.getPopup()) {
                layer.setPopupContent(generateZonePopupContent(layer.feature.properties)); 
            }
        }
    });
};

window.resetAllItems = function() {
    if(confirm("⚠️ Sollen ALLE Buffs, Fallen und EMPs auf der gesamten Karte gelöscht werden?")) {
        let changed = false;
        drawnItems.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties && layer.feature.properties.type === "zone") {
                if (layer.feature.properties.buffs || layer.feature.properties.traps || layer.feature.properties.empUntil) {
                    delete layer.feature.properties.buffs;
                    delete layer.feature.properties.traps;
                    delete layer.feature.properties.empUntil;
                    changed = true;
                }
            }
        });
        if (changed) {
            saveZones();
            alert("✅ Alle Shop-Items (Buffs/Fallen/EMPs) wurden von der Karte entfernt!");
        } else {
            alert("ℹ️ Es gab keine aktiven Items.");
        }
    }
};

window.toggleZoneLock = function(code) {
    drawnItems.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties && layer.feature.properties.code === code) {
            let props = layer.feature.properties;
            props.locked = !props.locked;
            applyZoneStyle(layer);
            
            if (layer.getPopup()) {
                layer.setPopupContent(generateZonePopupContent(props));
            }
            saveZones();
        }
    });
};

function generateNfcPopupContent(props) {
    let checked = props.visibleToPlayers === true ? "checked" : "";
    return `<b>${props.name}</b><br>
            Ziel: <span style="font-family:monospace; color:#00ffcc;">${props.targetCode}</span><br>
            <hr style="border-color:#555; margin:8px 0;">
            <label style="cursor:pointer; font-size:13px;">
            <input type="checkbox" ${checked} onchange="updateTagVisibility('${props.tagId}', this.checked)"> 👁️ Für Spieler sichtbar</label>`;
}

function bindNfcPopup(layer) {
    let props = layer.feature.properties;
    if (!props.tagId) props.tagId = "nfc_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    layer.bindPopup(generateNfcPopupContent(props));
}

window.updateTagVisibility = function(tagId, isVisible) {
    let isPaused = document.getElementById('global-freeze-toggle').checked;
    if (isPaused && isVisible) {
        alert("⚠️ Das Spiel ist pausiert! Du kannst keine Tags sichtbar machen, solange der Not-Aus-Schalter aktiv ist.");
        return;
    }

    drawnItems.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties && layer.feature.properties.tagId === tagId) {
            layer.feature.properties.visibleToPlayers = isVisible; 
            layer.setIcon(getNfcIcon(isVisible)); 
            saveZones(); 
            layer.setPopupContent(generateNfcPopupContent(layer.feature.properties));
        }
    });
};

// ==========================================
// 🎨 EDITIER LOGIK 
// ==========================================
function makeEditable(layer) {
    layer.on('click', function(e) {
        L.DomEvent.stopPropagation(e); 
        
        if (layer.feature.properties.locked) {
            alert("🔒 Diese Zone ist gesperrt und kann gerade nicht umgefärbt werden!");
            return;
        }

        var newColor = document.getElementById('zoneColor').value;
        var levelElement = document.getElementById('zoneLevel');
        var newLevel = levelElement ? parseInt(levelElement.value) : 1;
        
        if (newColor === "#808080") newLevel = 1;

        layer.feature.properties.color = newColor;
        layer.feature.properties.level = newLevel;
        
        applyZoneStyle(layer); 
        
        layer.setStyle({fillOpacity: 0.9});
        setTimeout(() => applyZoneStyle(layer), 200);
        
        saveZones();
        updateStatistics();
    });

    layer.on('contextmenu', function(e) {
        L.DomEvent.stopPropagation(e);
        layer.bindPopup(generateZonePopupContent(layer.feature.properties)).openPopup(e.latlng);
    });

    layer.on('popupclose', function() {
        layer.unbindPopup();
    });
}

// ==========================================
// ✏️ ZEICHNEN EVENTS
// ==========================================
map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;
    var type = event.layerType;
    var feature = layer.feature = layer.feature || {};
    feature.type = "Feature"; feature.properties = feature.properties || {};

    if (type === 'polygon') {
        var defaultCode = generateSpecialCode();
        var zoneCode = prompt("Generierter Code für diese Zone (kopieren erlaubt):", defaultCode);
        if (!zoneCode) zoneCode = defaultCode;

        feature.properties.color = document.getElementById('zoneColor').value;
        var levelElement = document.getElementById('zoneLevel');
        feature.properties.level = levelElement ? parseInt(levelElement.value) : 1;
        if (feature.properties.color === "#808080") feature.properties.level = 1;

        feature.properties.type = "zone";
        feature.properties.code = zoneCode;
        feature.properties.locked = false; 
        feature.properties.isKotH = false;
        feature.properties.hqTeam = "";
        
        applyZoneStyle(layer);
        makeEditable(layer);
        drawnItems.addLayer(layer);

    } else if (type === 'polyline') {
        feature.properties.color = document.getElementById('lineType').value;
        feature.properties.type = "transit-line";
        layer.setStyle({ color: feature.properties.color, weight: 4 });
        drawnItems.addLayer(layer);

    } else if (type === 'marker') {
        var pointName = prompt("Name für diesen NFC-Punkt:", "NFC Tag");
        if (pointName === null) pointName = "Unbenannter Tag"; 
        
        var targetCode = null;
        var markerLatLng = layer.getLatLng();
        drawnItems.eachLayer(function(existingLayer) {
            if (existingLayer.feature && existingLayer.feature.properties.type === "zone") {
                if (isPointInPolygon(markerLatLng, existingLayer)) targetCode = existingLayer.feature.properties.code;
            }
        });
        if (!targetCode) { alert("⚠️ Achtung: NFC-Punkt außerhalb einer Zone platziert."); targetCode = "FEHLER_KEINE_ZONE"; }
        
        feature.properties.name = pointName;
        feature.properties.type = "nfc-tag";
        feature.properties.targetCode = targetCode;
        feature.properties.visibleToPlayers = false; 
        
        layer.setIcon(getNfcIcon(false)); 
        drawnItems.addLayer(layer);
        bindNfcPopup(layer);
    }
    updateStatistics(); 
    saveZones();
    applyAllLegendFilters(); 
});

map.on(L.Draw.Event.EDITED, saveZones);
map.on(L.Draw.Event.DELETED, function (e) { saveZones(); updateStatistics(); });

// ==========================================
// 🛑 ZUSTAND FÜR DEN ZEICHEN-MODUS
// ==========================================
let isEditingMap = false;
let isPopupOpen = false;

map.on('draw:editstart', () => isEditingMap = true);
map.on('draw:editstop', () => isEditingMap = false);
map.on('draw:drawstart', () => isEditingMap = true);
map.on('draw:drawstop', () => isEditingMap = false);
map.on('draw:deletestart', () => isEditingMap = true);
map.on('draw:deletestop', () => isEditingMap = false);

map.on('popupopen', () => isPopupOpen = true);
map.on('popupclose', () => isPopupOpen = false);

// ==========================================
// 🔄 AUTOMATISCHE AKTUALISIERUNG (EFFIZIENTES POLLING)
// ==========================================
let currentMapVersion = 0; 

function loadZonesFromServer() {
    if (isEditingMap || isPopupOpen) return;

    fetch('/api/zones?v=' + currentMapVersion)
    .then(res => res.json())
    .then(response => {
        if (response.unchanged) return;

        currentMapVersion = response.version;
        let data = response.data;

        if (data.gameSettings) {
            let radarToggle = document.getElementById('global-radar-toggle');
            if (radarToggle) radarToggle.checked = data.gameSettings.showPlayers === true;
            
            let freezeToggle = document.getElementById('global-freeze-toggle');
            if (freezeToggle) freezeToggle.checked = data.gameSettings.gamePaused === true;

            let shopToggle = document.getElementById('global-shop-toggle');
            if (shopToggle && data.gameSettings.shopEnabled !== undefined) {
                shopToggle.checked = data.gameSettings.shopEnabled;
            }

            let gpsToggle = document.getElementById('global-gps-toggle');
            if (gpsToggle && data.gameSettings.gpsRequired !== undefined) {
                gpsToggle.checked = data.gameSettings.gpsRequired;
            }

            let payoutInput = document.getElementById('payout-interval-input');
            if (payoutInput && data.gameSettings.payoutInterval !== undefined && document.activeElement !== payoutInput) {
                payoutInput.value = data.gameSettings.payoutInterval;
            }

            if (data.gameSettings.teamCooldowns) {
                if (document.getElementById('cd-rot') && document.activeElement !== document.getElementById('cd-rot')) document.getElementById('cd-rot').value = data.gameSettings.teamCooldowns.rot || 0;
                if (document.getElementById('cd-blau') && document.activeElement !== document.getElementById('cd-blau')) document.getElementById('cd-blau').value = data.gameSettings.teamCooldowns.blau || 0;
                if (document.getElementById('cd-gruen') && document.activeElement !== document.getElementById('cd-gruen')) document.getElementById('cd-gruen').value = data.gameSettings.teamCooldowns.gruen || 0;
                if (document.getElementById('cd-gelb') && document.activeElement !== document.getElementById('cd-gelb')) document.getElementById('cd-gelb').value = data.gameSettings.teamCooldowns.gelb || 0;
            }

            if (data.gameSettings.cooldownResetTime) window.globalCooldownResetTime = data.gameSettings.cooldownResetTime;
            gameEndTime = data.gameSettings.endTime || null;
            gameAnnouncement = data.gameSettings.announcement || null;
        }
        
        drawnItems.clearLayers();
        let needsSave = false;
        
        if (data.features && data.features.length > 0) {
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    if (feature.properties.type === "nfc-tag") return L.marker(latlng, { icon: getNfcIcon(feature.properties.visibleToPlayers) });
                    return L.marker(latlng);
                },
                style: function (feature) {
                    if (feature.properties.type === "transit-line") return { color: feature.properties.color, weight: 4 };
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties.type === "zone") {
                        if (!feature.properties.code || !feature.properties.code.includes('#')) { feature.properties.code = generateSpecialCode(); needsSave = true; }
                        applyZoneStyle(layer); 
                        makeEditable(layer);
                    } else if (feature.properties.type === "nfc-tag") {
                        bindNfcPopup(layer);
                    }
                    drawnItems.addLayer(layer);
                }
            });
            updateStatistics();
            applyAllLegendFilters(); 
            
            if (needsSave) setTimeout(saveZones, 1000);
        }
    }).catch(err => console.log("Live-Update fehlgeschlagen:", err));
}

setInterval(loadZonesFromServer, 10000); 
loadZonesFromServer();

// ==========================================
// 📍 LIVE SPIELER STANDORTE
// ==========================================
function updateLiveLocations() {
    fetch('/api/location?t=' + new Date().getTime()).then(res => res.json()).then(players => {
        playerGroup.clearLayers();
        const listDiv = document.getElementById('player-list');
        if (Object.keys(players).length === 0) { listDiv.innerHTML = '<span style="color:#aaa;">Keine Spieler online</span>'; return; }
        listDiv.innerHTML = '';
        for (let id in players) {
            const p = players[id];
            let playerColor = p.team === 'rot' ? '#ff3333' : (p.team === 'blau' ? '#3366ff' : (p.team === 'gruen' ? '#33ff33' : '#ffcc00'));
            L.circleMarker([p.lat, p.lng], { radius: 8, fillColor: playerColor, color: "#ffffff", weight: 2, fillOpacity: 1 }).addTo(playerGroup).bindTooltip(p.name + " (" + p.team + ")");
            listDiv.innerHTML += `<div class="legend-item"><div class="circle-box" style="background:${playerColor}"></div>${p.name}</div>`;
        }
    }).catch(err => err);
}
setInterval(updateLiveLocations, 5000);


// ==========================================
// ⏳ LIVE SPIELER-COOLDOWNS IM ADMIN-PANEL 
// ==========================================
window.adminAccordionState = window.adminAccordionState || { rot: false, blau: false, gruen: false, gelb: false };

window.toggleTeamAccordion = function(team) {
    window.adminAccordionState[team] = !window.adminAccordionState[team];
    let details = document.getElementById('cd-details-' + team);
    let icon = document.getElementById('cd-icon-' + team);
    if(details && icon) {
        details.style.display = window.adminAccordionState[team] ? 'block' : 'none';
        icon.innerText = window.adminAccordionState[team] ? '▼' : '▶';
    }
};

function updateAdminCooldowns() {
    fetch('/api/admin/cooldown-states?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('cooldown-live-view');
            if (!container) return; 

            const now = Date.now();
            const colors = { rot: '#ff3333', blau: '#3366ff', gruen: '#33ff33', gelb: '#ffcc00' };

            let htmlStr = "";
            for (let team in data.states) {
                let cdInput = document.getElementById('cd-' + team);
                
                // 🚨 FIX FÜR NaN ERROR:
                let baseDurationMins = 0;
                if (cdInput && cdInput.value !== "") {
                    baseDurationMins = parseInt(cdInput.value) || 0;
                } else {
                    baseDurationMins = data.durations[team] || 0;
                }
                
                let isOpen = window.adminAccordionState[team];
                let icon = isOpen ? '▼' : '▶';
                let displayStyle = isOpen ? 'block' : 'none';

                // 🚨 NEU: Der Rettungsbutton für HQ-verlust!
                let isFallen = data.fallenTeams && data.fallenTeams[team];
                let fallenWarning = isFallen ? `<button onclick="adminReviveTeam('${team}'); event.stopPropagation();" style="background:#ff4444; color:white; border:1px solid white; border-radius:3px; padding:2px 6px; font-size:11px; cursor:pointer; margin-left:10px; box-shadow: 0 0 5px red;">☠️ HQ ZERSTÖRT (Klick = Retten)</button>` : "";

                htmlStr += `
                <div style="margin-bottom: 5px; border: 1px solid #444; border-radius: 4px; overflow: hidden;">
                    <div onclick="toggleTeamAccordion('${team}')" style="background: #333; padding: 8px; cursor: pointer; display: flex; justify-content: space-between; border-left: 4px solid ${colors[team] || '#aaa'}; align-items:center;">
                        <strong style="color:white;">Team ${team.toUpperCase()} ${fallenWarning}</strong>
                        <span style="color:#aaa; font-size: 12px;">(${baseDurationMins} Min) <span id="cd-icon-${team}">${icon}</span></span>
                    </div>
                    <div id="cd-details-${team}" style="display: ${displayStyle}; padding: 10px; background: #222;">`;

                for (let playerNum in data.states[team]) {
                    let pData = data.states[team][playerNum];
                    let lastScan = pData.lastScan || 0; 
                    
                    let effectiveMs = baseDurationMins * 60000;
                    let diff = effectiveMs - (now - lastScan);
                    
                    let statusText = "";
                    if (lastScan === 0 || diff <= 0 || effectiveMs <= 0) {
                        statusText = `<span style="color: #00ffcc; font-weight:bold;">Bereit</span>`;
                    } else {
                        let leftSecs = Math.ceil(diff / 1000);
                        if (isNaN(leftSecs)) {
                            statusText = `<span style="color: #aaa;">Bereit</span>`; // Sicherheitsnetz
                        } else {
                            let m = Math.floor(leftSecs / 60);
                            let s = leftSecs % 60;
                            statusText = `<span style="color: #ff8800; font-weight:bold;">⏳ ${m}:${s < 10 ? '0':''}${s}</span>`;
                        }
                    }
                    
                    htmlStr += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #333; padding-bottom: 2px;">
                                    <span style="color:#ddd;">Spieler ${playerNum}:</span> 
                                    ${statusText}
                                </div>`;
                }
                htmlStr += `</div></div>`;
            }
            container.innerHTML = htmlStr;
        }).catch(err => console.log("Live-Cooldown Update Fehler:", err));
}

if (!window.adminCooldownInterval) {
    window.adminCooldownInterval = setInterval(updateAdminCooldowns, 1000);
}

// Die Funktion für den neuen HQ-Rettungs-Button
window.adminReviveTeam = function(team) {
    if(confirm(`Möchtest du Team ${team.toUpperCase()} aus dem 'Free Real Estate' Modus befreien?`)) {
        fetch('/api/admin/revive-team', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({team: team})
        }).then(res=>res.json()).then(data=>{
            if(data.success) {
                alert(`✅ Team ${team.toUpperCase()} ist wieder geschützt!`);
                updateAdminCooldowns();
            }
        });
    }
};

// ==========================================
// 💾 SPEICHERN & RESET-BEFEHLE
// ==========================================
function saveZones() {
    var geoJsonData = drawnItems.toGeoJSON();
    
    let toggleRadar = document.getElementById('global-radar-toggle');
    let toggleFreeze = document.getElementById('global-freeze-toggle');
    let toggleShop = document.getElementById('global-shop-toggle');
    let toggleGps = document.getElementById('global-gps-toggle'); 
    let payoutVal = document.getElementById('payout-interval-input');
    
    let cdRot = document.getElementById('cd-rot');
    let cdBlau = document.getElementById('cd-blau');
    let cdGruen = document.getElementById('cd-gruen');
    let cdGelb = document.getElementById('cd-gelb');
    
    geoJsonData.gameSettings = {
        showPlayers: toggleRadar ? toggleRadar.checked : false,
        gamePaused: toggleFreeze ? toggleFreeze.checked : false,
        shopEnabled: toggleShop ? toggleShop.checked : true,
        gpsRequired: toggleGps ? toggleGps.checked : true, 
        endTime: gameEndTime,
        announcement: gameAnnouncement,
        teamCooldowns: {
            rot: cdRot ? parseInt(cdRot.value) : 0,
            blau: cdBlau ? parseInt(cdBlau.value) : 0,
            gruen: cdGruen ? parseInt(cdGruen.value) : 0,
            gelb: cdGelb ? parseInt(cdGelb.value) : 0
        },
        payoutInterval: payoutVal ? parseInt(payoutVal.value) : 45,
        cooldownResetTime: window.globalCooldownResetTime || 0
    };
    
    fetch('/api/zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geoJsonData) })
    .then(res => res.json()).then(data => console.log("Auto-Save erfolgreich!")).catch(err => err);
}

// 🔄 SICHERER RESET-BEFEHL
window.resetAllCooldowns = function() {
    if(confirm("⚠️ Sollen die aktiven Cooldown-Sperren ALLER Spieler auf der Straße JETZT sofort beendet werden?")) {
        fetch('/api/reset-cooldowns', { method: 'POST' })
            .then(async res => {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    return res.json();
                } else {
                    throw new Error("Fehler beim Erreichen der Reset-Route.");
                }
            })
            .then(data => {
                window.globalCooldownResetTime = data.resetTime || Date.now(); 
                saveZones(); 
                alert("✅ Signal gesendet! Alle Scanner sind in wenigen Sekunden wieder bereit.");
                if(typeof updateAdminCooldowns === 'function') updateAdminCooldowns();
            })
            .catch(err => alert("❌ Fehler beim Reset:\n" + err.message));
    }
};

// ==========================================
// 🐾 GPS-SPUREN (TRAILS) MANUELL LADEN
// ==========================================
var trailsGroup = L.layerGroup().addTo(map);

window.fetchAndDrawTrails = function(btn) {
    let oldText = btn.innerText;
    btn.innerText = "⏳ Lade Spuren...";
    btn.style.background = "#ffcc00";
    btn.style.color = "#000";

    fetch('/api/trails')
        .then(res => res.json())
        .then(trails => {
            trailsGroup.clearLayers();
            const colors = { rot: '#ff3333', blau: '#3366ff', gruen: '#33ff33', gelb: '#ffcc00' };

            for (let id in trails) {
                let tData = trails[id];
                if (tData.path.length > 1) {
                    let teamColor = colors[tData.team] || '#ffffff';
                    let polyline = L.polyline(tData.path, {
                        color: teamColor, weight: 4, opacity: 0.6, dashArray: '5, 10' 
                    });
                    polyline.bindTooltip(`<b>${tData.name}</b> (${tData.team})`);
                    trailsGroup.addLayer(polyline);
                }
            }

            btn.innerText = "✅ Spuren gezeichnet!";
            btn.style.background = "#33ff33";
            
            document.getElementById('show-trails-toggle').checked = true;
            toggleTrailsLayer();

            setTimeout(() => {
                btn.innerText = oldText;
                btn.style.background = "#444";
                btn.style.color = "white";
            }, 3000);
        })
        .catch(err => {
            btn.innerText = "❌ Fehler";
            console.error(err);
        });
};

window.toggleTrailsLayer = function() {
    let isChecked = document.getElementById('show-trails-toggle').checked;
    if (isChecked) map.addLayer(trailsGroup);
    else map.removeLayer(trailsGroup);
};

window.resetTrails = function() {
    if(confirm("Möchtest du wirklich alle aufgezeichneten GPS-Spuren unwiderruflich löschen?")) {
        fetch('/api/trails/reset', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            trailsGroup.clearLayers();
            alert("✅ Spuren auf dem Server gelöscht.");
        });
    }
};

// ==========================================
// 💸 WIRTSCHAFT MANUELL VERWALTEN & ANZEIGEN
// ==========================================
function updateAdminCoins() {
    fetch('/api/coins?t=' + new Date().getTime())
        .then(res => res.json())
        .then(coins => {
            if(document.getElementById('admin-coins-rot')) document.getElementById('admin-coins-rot').innerText = coins.rot || 0;
            if(document.getElementById('admin-coins-blau')) document.getElementById('admin-coins-blau').innerText = coins.blau || 0;
            if(document.getElementById('admin-coins-gruen')) document.getElementById('admin-coins-gruen').innerText = coins.gruen || 0;
            if(document.getElementById('admin-coins-gelb')) document.getElementById('admin-coins-gelb').innerText = coins.gelb || 0;
        })
        .catch(err => console.log("Fehler beim Laden der Coins:", err));
}

setInterval(updateAdminCoins, 5000);
updateAdminCoins(); 

window.adminManageInventory = function(actionType) {
    let team = document.getElementById('admin-inv-team').value;
    let player = document.getElementById('admin-inv-player').value;
    let item = document.getElementById('admin-inv-item').value;
    let amount = document.getElementById('admin-inv-amount').value;

    fetch('/api/inventory/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            team: team, player: player, itemType: item, amount: amount, action: actionType
        })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) alert(`✅ ${data.message}\nAktueller Bestand (${item}): ${data.inventory[item]}`);
        else alert(`❌ Fehler: ${data.error}`);
    });
};

window.adminResetAllInventories = function() {
    if (confirm("ACHTUNG: Möchtest du wirklich ALLE Gegenstände aus den Rucksäcken ALLER Spieler löschen?")) {
        fetch('/api/inventory/reset-all', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .then(res => res.json())
        .then(data => {
            if(data.success) alert("✅ " + data.message);
            else alert("❌ Fehler beim Zurücksetzen.");
        });
    }
};

window.manageCoins = function(action) {
    let teamSelect = document.getElementById('bank-team-select');
    let amountInput = document.getElementById('bank-amount');
    
    let team = teamSelect ? teamSelect.value : null;
    let amount = amountInput ? amountInput.value : 0;

    if (action === 'reset_all') {
        if (!confirm("⚠️ ACHTUNG: Möchtest du wirklich die Kassen ALLER Teams auf 0 Coins zurücksetzen?")) return;
    }

    fetch('/api/coins/manage', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ team: team, amount: amount, action: action }) 
    })
    .then(async res => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) return res.json();
        else throw new Error("Server hat nicht richtig geantwortet.");
    })
    .then(data => {
        if(data.success) {
            updateAdminCoins(); 
            alert(`✅ ${data.message}`);
        } else {
            alert("❌ Fehler: " + data.error);
        }
    })
    .catch(err => alert("⚠️ " + err.message));
};

window.adminResetStats = function() {
    if (confirm("⚠️ Willst du wirklich alle persönlichen Spieler-Statistiken (Kilometer, Hacks, Abzeichen) löschen?")) {
        fetch('/api/admin/reset-stats', { method: 'POST' })
        .then(res => res.json())
        .then(data => alert(data.message));
    }
};