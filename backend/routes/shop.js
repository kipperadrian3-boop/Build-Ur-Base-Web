const express = require('express');
const router = express.Router();
const state = require('../state');
const DS = require('../datastores');
const { getRobloxPlayerData, saveRobloxPlayerData, saveOpenCloudStore, getOfflinePlayerPurchases } = require('../opencloud');
const { getStockEpoch, calculateItemStock, getPlayerStockData } = require('../stock');
const Player = require('../models/Player');
const ActivityLog = require('../models/ActivityLog');

// Master Global Item Shop Stock
router.get('/globalStock', (req, res) => {
    const epoch = getStockEpoch();
    const stockMap = {};
    const gameConfigs = state.gameConfigs;

    for (const cat in gameConfigs) {
        for (const itemKey in gameConfigs[cat]) {
            const itemConf = gameConfigs[cat][itemKey];
            stockMap[itemKey] = (itemConf.NotBuyable ? 0 : calculateItemStock(itemKey, epoch, itemConf.StockPercent ?? 50, itemConf.StockMax ?? 5));
        }
    }

    const nextReset = (epoch + 1) * 300;
    res.status(200).json({
        epoch, stock: stockMap, nextReset,
        serverTime: Math.floor(Date.now() / 1000)
    });
});

// Buy Item
router.post('/buyItem', async (req, res) => {
    const { serverId, userId, itemKey, quantity } = req.body;
    if (!userId || !itemKey) return res.status(400).json({ error: 'Missing params' });
    const qty = quantity || 1;

    // 1. Live game server route (only the server the player is actually in)
    const liveServerId = Object.keys(state.activeServers).find(id => {
        const s = state.activeServers[id];
        return s && s.players && s.players[String(userId)] && Date.now() - s.lastSeen < 10000;
    });
    if (liveServerId) {
        const serverId = liveServerId;
        const actionId = 'act_' + Math.random().toString(36).substr(2, 9);
        if (!state.actionQueues[serverId]) state.actionQueues[serverId] = [];
        state.actionQueues[serverId].push({ actionId, action: 'BUY', userId, itemKey, quantity: qty });

        let attempts = 0;
        while (attempts < 30) {
            if (state.actionResults[actionId]) {
                const result = state.actionResults[actionId];
                delete state.actionResults[actionId];

                // Track purchase
                const tracking = require('../tracking');
                tracking.trackShopPurchase(userId, itemKey, '', qty, result.totalCost || 0);

                if (result.success) return res.status(200).json(result);
                else return res.status(400).json(result);
            }
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }
        state.actionQueues[serverId] = state.actionQueues[serverId].filter(a => a.actionId !== actionId);
        return res.status(504).json({ success: false, message: 'Roblox server timed out' });
    }

    // 2. Not in the game: buying only works live (server-side checks in the game)
    return res.status(400).json({ success: false, message: 'Join the game to buy items.' });
});

module.exports = router;
