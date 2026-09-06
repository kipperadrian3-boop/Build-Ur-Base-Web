const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const state = require('../state');
const { getRobloxPlayerData, getDailyRewardData } = require('../opencloud');
const { getPlayerStockData } = require('../stock');
const Player = require('../models/Player');
const PendingAuction = require('../models/PendingAuction');

// Heartbeat from Roblox Server
router.post('/serverSync', (req, res) => {
    const { serverId, players } = req.body;
    if (serverId && players) {
        state.activeServers[serverId] = { lastSeen: Date.now(), players };
        res.status(200).json({ message: 'Heartbeat received' });
    } else {
        res.status(400).json({ error: 'Invalid payload' });
    }
});

// Immediate Player Stat Update
router.post('/updatePlayerStats', (req, res) => {
    const { serverId, userId, cash } = req.body;
    if (serverId && userId && state.activeServers[serverId]) {
        if (!state.activeServers[serverId].players[userId]) {
            state.activeServers[serverId].players[userId] = {};
        }
        state.activeServers[serverId].players[userId].cash = cash;
        res.status(200).json({ message: 'Player stats updated' });
    } else {
        res.status(400).json({ error: 'Server or User not found' });
    }
});

// Frontend Polling Endpoint
router.get('/status/:userId', async (req, res) => {
    const userId = req.params.userId;
    const now = Date.now();
    let isGameServerRunning = false;
    let currentServerId = null;

    for (const [serverId, serverData] of Object.entries(state.activeServers)) {
        if (now - serverData.lastSeen < 10000) {
            isGameServerRunning = true;
            currentServerId = serverId;
            break;
        } else {
            delete state.activeServers[serverId];
        }
    }

    const playerData = await getRobloxPlayerData(userId);
    const dailyData = await getDailyRewardData(userId);
    const stockData = await getPlayerStockData(userId);

    // Update lastSeenAt (fire-and-forget, don't await)
    Player.updateOne(
        { robloxUserId: String(userId) },
        { $set: { lastSeenAt: new Date() } }
    ).catch(() => {});

    res.status(200).json({
        isServerOnline: isGameServerRunning || true,
        isGameServerRunning,
        isPlayerInGame: playerData.isOnline,
        isOpenCloudActive: true,
        currentServerId: currentServerId || 'cloud',
        playerCash: playerData.cash,
        playerStock: stockData,
        playerInventory: playerData.inventory,
        dailyReward: dailyData,
        serverTime: Math.floor(now / 1000)
    });
});

// Get configs
router.get('/configs', (req, res) => {
    res.status(200).json(state.gameConfigs);
});

// Debug servers
router.get('/debugServers', (req, res) => {
    res.status(200).json(state.activeServers);
});

// Poll actions (called by Roblox game server)
router.get('/pollActions/:serverId', async (req, res) => {
    const { serverId } = req.params;
    let actions = state.actionQueues[serverId] || [];
    state.actionQueues[serverId] = [];

    // Check MongoDB for pending offline auction wins
    if (mongoose.connection.readyState === 1) {
        try {
            const pendingWins = await PendingAuction.find({});
            if (pendingWins.length > 0) {
                console.log(`[Sync] Injecting ${pendingWins.length} pending offline auction wins to Server ${serverId}`);
                for (const win of pendingWins) {
                    actions.push({
                        actionId: 'auc_offline_' + win._id,
                        action: 'AUCTION_WIN',
                        userId: win.userId,
                        itemKey: win.itemKey,
                        quantity: win.quantity,
                        cost: win.cost
                    });
                    await PendingAuction.findByIdAndDelete(win._id);
                }
            }
        } catch (err) {
            console.error("[Sync] Error fetching pending auctions:", err);
        }
    }

    res.status(200).json({ actions });
});

// Action result (called by Roblox game server)
router.post('/actionResult', (req, res) => {
    const { actionId, success, message, newStock, reward, newStreak, lastClaimTime, coinsAwarded } = req.body;
    if (actionId) {
        state.actionResults[actionId] = { success, message, newStock, reward, newStreak, lastClaimTime, coinsAwarded };
        res.status(200).json({ message: 'Result accepted' });
    } else {
        res.status(400).json({ error: 'Missing actionId' });
    }
});

module.exports = router;
