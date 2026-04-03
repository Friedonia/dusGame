const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const ZONES_FILE = path.join(__dirname, 'zones.json');

app.use(cors());
app.use(express.json());
// Stellt die Admin-Website aus dem "public" Ordner bereit
app.use(express.static('public')); 

// API: Alle Zonen abrufen (Das wird deine App später nutzen!)
app.get('/api/zones', (req, res) => {
    if (fs.existsSync(ZONES_FILE)) {
        const data = fs.readFileSync(ZONES_FILE);
        res.json(JSON.parse(data));
    } else {
        res.json({ type: "FeatureCollection", features: [] });
    }
});

// API: Zonen speichern (Das nutzt das Admin-Board)
app.post('/api/zones', (req, res) => {
    const geoJsonData = req.body;
    fs.writeFileSync(ZONES_FILE, JSON.stringify(geoJsonData, null, 2));
    res.json({ message: 'Zonen erfolgreich gespeichert!' });
});

app.listen(PORT, () => {
    console.log(`Server läuft! Öffne http://localhost:${PORT} in deinem Browser.`);
});

// ... (bestehender Code oben)

let messages = []; // Hier landen die Chat-Nachrichten

// API: Alle Nachrichten abrufen
app.get('/api/messages', (req, res) => {
    res.json(messages);
});

// API: Nachricht senden (Admin oder Spieler)
app.post('/api/messages', (req, res) => {
    const { sender, team, text } = req.body;
    const newMessage = { sender, team, text, timestamp: new Date() };
    messages.push(newMessage);
    res.json({ status: "Gesendet" });
});

app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
let playerLocations = {}; // Speichert Standorte: { "Spieler1": { lat: 51.2, lng: 6.7, team: "rot" }, ... }

// API: Standort eines Spielers aktualisieren (wird von der App aufgerufen)
app.post('/api/location', (req, res) => {
    const { id, lat, lng, team, name } = req.body;
    playerLocations[id] = { lat, lng, team, name, lastUpdate: new Date() };
    res.json({ status: "Location received" });
});

// API: Alle Standorte abrufen (wird vom Admin-Board aufgerufen)
app.get('/api/location', (req, res) => {
    res.json(playerLocations);
});