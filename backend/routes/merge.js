// Merge defenses: 2x level N from the INVENTORY -> 1x level N+1 (same rule as in-game).
// The level chain comes from configs.json (Defense items carry NextId).
//   POST /api/merge  { userId, itemKey, all }
// - Player in a live game server: the action is queued for that server (WebSyncActions "MERGE")
//   so the game applies it to the loaded data.
// - Player not in the game: refused (merging only works live, the game validates everything).
const express = require('express');
const router = express.Router();
const state = require('../state');

const MERGE_COST = 2;
const LIVE_TIMEOUT_MS = 15000;
const busy = new Set();

function findDefense(itemKey) {
    const defs = state.gameConfigs.Defense || {};
    return defs[itemKey] || null;
}

function findLiveServer(userId) {
    const now = Date.now();
    for (const [serverId, server] of Object.entries(state.activeServers)) {
        if (now - server.lastSeen < 10000 && server.players && server.players[userId]) return serverId;
    }
    return null;
}

async function mergeLive(serverId, userId, itemKey, all) {
    const actionId = 'mrg_' + Math.random().toString(36).slice(2, 11);
    if (!state.actionQueues[serverId]) state.actionQueues[serverId] = [];
    state.actionQueues[serverId].push({ actionId, action: 'MERGE', userId, itemKey, all: !!all });

    const deadline = Date.now() + LIVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const result = state.actionResults[actionId];
        if (result) {
            delete state.actionResults[actionId];
            return result;
        }
        await new Promise(r => setTimeout(r, 400));
    }
    state.actionQueues[serverId] = (state.actionQueues[serverId] || []).filter(a => a.actionId !== actionId);
    return { success: false, message: 'Roblox server timed out' };
}

router.post('/merge', async (req, res) => {
    const userId = req.body && req.body.userId ? String(req.body.userId) : '';
    const itemKey = req.body && typeof req.body.itemKey === 'string' ? req.body.itemKey : '';
    const all = req.body && req.body.all === true;
    if (!userId || !itemKey) return res.status(400).json({ success: false, message: 'Missing params' });

    const cfg = findDefense(itemKey);
    if (!cfg || !cfg.NextId || !findDefense(cfg.NextId)) {
        return res.status(400).json({ success: false, message: 'This item cannot be merged.' });
    }
    if (busy.has(userId)) return res.status(429).json({ success: false, message: 'Please wait...' });

    busy.add(userId);
    try {
        const nextCfg = findDefense(cfg.NextId);
        const serverId = findLiveServer(userId);
        // Only live: the game checks the inventory itself (no offline writes)
        if (!serverId) return res.status(400).json({ success: false, message: 'Join the game to merge.' });
        const result = await mergeLive(serverId, userId, itemKey, all);

        if (result.success) {
            const count = result.count || 1;
            return res.status(200).json({
                success: true,
                count,
                newItemId: cfg.NextId,
                message: result.message || `Merged ${count}x into ${nextCfg.DisplayName || cfg.NextId}!`,
            });
        }
        return res.status(400).json({ success: false, message: result.message || 'Merge failed.' });
    } catch (err) {
        console.error('[Merge] Error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        busy.delete(userId);
    }
});

module.exports = router;
