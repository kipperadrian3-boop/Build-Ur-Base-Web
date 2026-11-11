const express = require('express');
const router = express.Router();
const state = require('../state');
const ActivityLog = require('../models/ActivityLog');

router.post('/claimDailyReward', async (req, res) => {
    const { serverId, userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing params' });

    // 1. Game server route: the player's own server, else any running server
    //    (the game claims for offline players directly in its DataStore)
    const servers = Object.keys(state.activeServers).filter(id => Date.now() - state.activeServers[id].lastSeen < 10000);
    const liveServerId = servers.find(id => state.activeServers[id].players && state.activeServers[id].players[String(userId)]) || servers[0];
    if (liveServerId) {
        const serverId = liveServerId;
        const actionId = 'claim_' + Math.random().toString(36).substr(2, 9);
        if (!state.actionQueues[serverId]) state.actionQueues[serverId] = [];
        state.actionQueues[serverId].push({ actionId, action: 'CLAIM_DAILY', userId });

        let attempts = 0;
        while (attempts < 30) {
            if (state.actionResults[actionId]) {
                const result = state.actionResults[actionId];
                delete state.actionResults[actionId];

                // Track
                try {
                    const tracking = require('../tracking');
                    tracking.trackDailyClaim(userId, result.streak || 1, result.coinsAwarded || 0);
                } catch (e) {}

                if (result.success) return res.status(200).json(result);
                else return res.status(400).json(result);
            }
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }
        state.actionQueues[serverId] = state.actionQueues[serverId].filter(a => a.actionId !== actionId);
        return res.status(504).json({ success: false, message: 'Roblox server timed out' });
    }

    // 2. No game server running: claims need the game (Open Cloud is not used anymore)
    return res.status(503).json({ success: false, message: 'No game server is online right now. Join the game to claim your reward.' });
});

module.exports = router;
