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

    // Fetch avatar
    let avatarUrl = 'https://tr.rbxcdn.com/38c6edcb50633730ff4cf39ac8859840/150/150/AvatarHeadshot/Png';
    try {
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userData.userId}&size=150x150&format=Png&isCircular=false`);
        const thumbData = await thumbRes.json();
        if (thumbData && thumbData.data && thumbData.data.length > 0) {
            avatarUrl = thumbData.data[0].imageUrl;
        }
    } catch (err) {
        console.error('[Auth] Error fetching avatar:', err);
    }

    // Track player and save login code in MongoDB
    const tracking = require('../tracking');
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const device = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';
    await tracking.trackLogin(userData.userId, userData.username, code, avatarUrl, ip, device);

    res.status(200).json({ success: true, user: { ...userData, avatarUrl } });
});

module.exports = router;
