const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database for codes
const codesDB = {}; 

// Game Config Data
let currentConfigVersion = "none";
let gameConfigs = {};

// 1. Endpoint for Roblox Server to register a code
app.post('/api/registerCode', (req, res) => {
    const { code, username, userId } = req.body;

    if (!code || !username || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    codesDB[code] = { username, userId };
    console.log(`[Backend] Code registered for ${username}: ${code}`);

    res.status(200).json({ message: 'Code successfully registered' });
});

// Endpoint: Check Config Version
app.get('/api/configVersion', (req, res) => {
    res.status(200).json({ version: currentConfigVersion });
});

// Endpoint: Update Configs (from Roblox)
app.post('/api/configs', (req, res) => {
    const { version, configs } = req.body;
    if (version && configs) {
        currentConfigVersion = version;
        gameConfigs = configs;
        console.log(`[Backend] Configs updated to version: ${version}`);
        res.status(200).json({ message: 'Configs updated' });
    } else {
        res.status(400).json({ error: 'Invalid config payload' });
    }
});

// Endpoint: Get Configs (for Frontend)
app.get('/api/configs', (req, res) => {
    res.status(200).json(gameConfigs);
});

// 2. Endpoint for the Website to login via code
app.post('/api/login', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    const userData = codesDB[code];

    if (userData) {
        console.log(`[Backend] User ${userData.username} logged in via code.`);
        
        let avatarUrl = 'https://tr.rbxcdn.com/38c6edcb50633730ff4cf39ac8859840/150/150/AvatarHeadshot/Png';
        try {
            const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userData.userId}&size=150x150&format=Png&isCircular=false`);
            const thumbData = await thumbRes.json();
            if (thumbData && thumbData.data && thumbData.data.length > 0) {
                avatarUrl = thumbData.data[0].imageUrl;
            }
        } catch (err) {
            console.error('[Backend] Fehler beim Laden des Avatars:', err);
        }

        res.status(200).json({ success: true, user: { ...userData, avatarUrl: avatarUrl } });
    } else {
        res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`[Backend] Web server is running on http://localhost:${PORT}`);
});
