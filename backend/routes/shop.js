const express = require('express');
const router = express.Router();
const state = require('../state');
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
            stockMap[itemKey] = calculateItemStock(itemKey, epoch, itemConf.StockPercent || 50, itemConf.StockMax || 5);
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

    // 1. Live game server route
    if (serverId && state.activeServers[serverId]) {
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

    // 2. Offline: Open Cloud
    const gameConfigs = state.gameConfigs;
    let itemConfig = null;
    for (const cat in gameConfigs) {
        if (gameConfigs[cat][itemKey]) { itemConfig = gameConfigs[cat][itemKey]; break; }
    }
    if (!itemConfig) return res.status(400).json({ error: 'Item not found in catalog' });

    const price = itemConfig.Price || 0;
    const totalCost = price * qty;

    const buyerData = await getRobloxPlayerData(userId);
    if (buyerData.cash < totalCost) return res.status(400).json({ success: false, message: 'Not enough coins!' });

    const stockMap = await getPlayerStockData(userId);
    const availableStock = stockMap[itemKey] !== undefined ? stockMap[itemKey] : 0;
    if (availableStock < qty) return res.status(400).json({ success: false, message: 'Out of stock!' });

    if (buyerData.raw) {
        buyerData.raw.Coins = Math.max(0, (buyerData.raw.Coins || 0) - totalCost);
        buyerData.raw.Inventory = buyerData.raw.Inventory || {};
        buyerData.raw.Inventory[itemKey] = (buyerData.raw.Inventory[itemKey] || 0) + qty;
        await saveRobloxPlayerData(userId, buyerData.raw);
    }

    const epoch = getStockEpoch();
    const purchases = await getOfflinePlayerPurchases(userId);
    purchases[itemKey] = (purchases[itemKey] || 0) + qty;
    await saveOpenCloudStore('ItemShopPurchases_v5', `ISP_${userId}`, { e: epoch, p: purchases });

    // Track purchase
    const tracking = require('../tracking');
    tracking.trackShopPurchase(userId, itemKey, '', qty, totalCost);

    const newStock = Math.max(0, availableStock - qty);
    console.log(`[Shop] Offline purchase: ${userId} bought ${qty}x ${itemKey} for ${totalCost}. Stock: ${newStock}`);
    return res.status(200).json({
        success: true,
        message: `Successfully bought ${qty}x ${itemConfig.DisplayName || itemKey}!`,
        newStock
    });
});

module.exports = router;
