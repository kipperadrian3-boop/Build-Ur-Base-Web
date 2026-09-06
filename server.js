const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI && (MONGO_URI.startsWith('mongodb://') || MONGO_URI.startsWith('mongodb+srv://'))) {
    mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log("[Backend] MongoDB erfolgreich verbunden!"))
        .catch(err => console.log("[Backend] MongoDB Fehler:", err));
} else {
    console.log("[Backend] Kein gültiger MONGO_URI in .env gefunden. Fallback auf In-Memory.");
}

// Load Game Configs
const state = require('./backend/state');
try {
    const data = fs.readFileSync(path.join(__dirname, 'configs.json'), 'utf8');
    state.gameConfigs = JSON.parse(data);
    console.log("[Backend] Loaded configs.json successfully.");
    fetchThumbnails();
} catch (e) {
    console.error("[Backend] Could not load configs.json", e);
}

// Fetch Roblox Thumbnails
async function fetchThumbnails() {
    let assetIds = [];
    for (const cat in state.gameConfigs) {
        for (const key in state.gameConfigs[cat]) {
            if (state.gameConfigs[cat][key].ImageId) assetIds.push(state.gameConfigs[cat][key].ImageId);
        }
    }
    if (assetIds.length === 0) return;

    try {
        const res = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
        const json = await res.json();
        if (json && json.data) {
            const imageMap = {};
            json.data.forEach(item => { imageMap[item.targetId.toString()] = item.imageUrl; });
            for (const cat in state.gameConfigs) {
                for (const key in state.gameConfigs[cat]) {
                    const id = state.gameConfigs[cat][key].ImageId;
                    if (id && imageMap[id]) state.gameConfigs[cat][key].imageUrl = imageMap[id];
                }
            }
            console.log("[Backend] Thumbnails fetched and mapped!");
        }
    } catch (err) {
        console.error("[Backend] Error fetching thumbnails:", err);
    }
}

// Routes
app.use('/api', require('./backend/routes/auth'));
app.use('/api', require('./backend/routes/sync'));
app.use('/api', require('./backend/routes/shop'));
app.use('/api/shop', require('./backend/routes/shop'));
app.use('/api/auction', require('./backend/routes/auction'));
app.use('/api/marketplace', require('./backend/routes/marketplace'));
app.use('/api', require('./backend/routes/daily'));
app.use('/api/games', require('./backend/routes/games'));

// Start
app.listen(PORT, () => {
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
});
