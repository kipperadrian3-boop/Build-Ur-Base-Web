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

// Item images: point every item at the thumbnail proxy (/api/thumb/:assetId).
// The proxy resolves fresh Roblox CDN links on demand, so images never go stale.
function fetchThumbnails() {
    const ids = [];
    for (const cat in state.gameConfigs) {
        for (const key in state.gameConfigs[cat]) {
            const item = state.gameConfigs[cat][key];
            if (item.ImageId) {
                item.imageUrl = `/api/thumb/${item.ImageId}`;
                ids.push(item.ImageId);
            }
        }
    }
    // One batched Roblox request for all item images (avoids rate limits)
    require('./backend/routes/thumbs').prewarmAssets(ids);
    console.log("[Backend] Item image URLs mapped to thumbnail proxy.");
}

// Routes
app.use('/api', require('./backend/routes/thumbs'));
app.use('/api', require('./backend/routes/auth'));
app.use('/api', require('./backend/routes/merge'));
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
