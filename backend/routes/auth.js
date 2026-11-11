const express = require('express');
const router = express.Router();
const state = require('../state');
const Player = require('../models/Player');
const ActivityLog = require('../models/ActivityLog');

// Register a code (called by Roblox game server)
router.post('/registerCode', (req, res) => {
    const { code, username, userId } = req.body;
    if (!code || !username || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    state.codesDB[code] = { username, userId };
    console.log(`[Auth] Code registered for ${username}: ${code}`);

    // Track code per user immediately in MongoDB
    try {
        const tracking = require('../tracking');
        tracking.trackRegisteredCode(userId, username, code);
    } catch (err) {
        console.error('[Auth] Error tracking registered code:', err);
    }

    res.status(200).json({ message: 'Code successfully registered' });
});

// Website login via code
router.post('/login', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const userData = state.codesDB[code];
    if (!userData) {
        return res.status(401).json({ success: false, error: 'Code not found. You must be in-game to connect!' });
    }

    console.log(`[Auth] User ${userData.username} logged in via code.`);

    // Avatar goes through the thumbnail proxy so the link never expires
    const avatarUrl = `/api/avatar/${userData.userId}`;

    // Track player and save login code in MongoDB
    const tracking = require('../tracking');
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const device = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';
    await tracking.trackLogin(userData.userId, userData.username, code, avatarUrl, ip, device);

    res.status(200).json({ success: true, user: { ...userData, avatarUrl } });
});

module.exports = router;
