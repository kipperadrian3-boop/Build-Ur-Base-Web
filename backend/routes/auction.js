const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const state = require('../state');
const { getRobloxPlayerData } = require('../opencloud');
const PendingAuction = require('../models/PendingAuction');
const Player = require('../models/Player');
const ActivityLog = require('../models/ActivityLog');

// Auction Config
const auctionConfig = [
    { key: 'Metal Block', category: 'Blocks', start: 30000, up: 500, qty: 50 },
    { key: 'Stone Block', category: 'Blocks', start: 11250, up: 250, qty: 75 },
    { key: 'Block', category: 'Blocks', start: 250, up: 25, qty: 100 },
    { key: 'Flamethrower', category: 'Defense', start: 12500, up: 500, qty: 2 },
    { key: '4Turret', category: 'Defense', start: 10000, up: 500, qty: 3 },
    { key: '3Turret', category: 'Defense', start: 4000, up: 300, qty: 5 },
    { key: '2Turret', category: 'Defense', start: 2500, up: 250, qty: 10 },
    { key: '1Turret', category: 'Defense', start: 750, up: 50, qty: 15 },
    { key: 'Metal Laserdoor', category: 'Decor', start: 5000, up: 500, qty: 5 },
    { key: 'Stone Laserdoor', category: 'Decor', start: 1500, up: 250, qty: 10 },
    { key: 'Metal Window', category: 'Decor', start: 30000, up: 500, qty: 50 },
    { key: 'Stone Window', category: 'Decor', start: 11250, up: 250, qty: 75 },
    { key: 'Metal Stair', category: 'Decor', start: 30000, up: 500, qty: 50 },
    { key: 'Stone Stair', category: 'Decor', start: 11250, up: 250, qty: 175 },
];

let currentAuction = {
    item: null, category: null, displayName: null, imageUrl: null,
    qty: 0, startPrice: 0, currentBid: 0,
    highestBidderId: null, highestBidderName: null, endTime: 0, step: 0
};

function getNext10MinuteMark() {
    const d = new Date();
    d.setMinutes(Math.ceil((d.getMinutes() + 1) / 10) * 10);
    d.setSeconds(0); d.setMilliseconds(0);
    return d.getTime();
}

function startNewAuction() {
    const config = auctionConfig[Math.floor(Math.random() * auctionConfig.length)];
    const qty = config.qty || 1;
    const gameConfigs = state.gameConfigs;

    let displayName = config.key;
    let imageUrl = "";
    if (gameConfigs[config.category] && gameConfigs[config.category][config.key]) {
        const itemInfo = gameConfigs[config.category][config.key];
        displayName = itemInfo.DisplayName || config.key;
        imageUrl = itemInfo.imageUrl || "";
    }

    currentAuction = {
        item: config.key, category: config.category, displayName, imageUrl,
        qty, startPrice: config.start, currentBid: config.start,
        highestBidderId: null, highestBidderName: null,
        endTime: getNext10MinuteMark(), step: config.up
    };
    console.log(`[Auction] New: ${qty}x ${displayName}, Ends: ${new Date(currentAuction.endTime).toLocaleTimeString()}`);
}

async function resolveAuction() {
    if (currentAuction.highestBidderId) {
        const userId = currentAuction.highestBidderId;
        const bid = currentAuction.currentBid;
        let hasMoney = false;

        for (const server of Object.values(state.activeServers)) {
            if (server.players[userId] && server.players[userId].cash >= bid) {
                hasMoney = true; break;
            }
        }

        if (hasMoney) {
            console.log(`[Auction] ${currentAuction.highestBidderName} won ${currentAuction.qty}x ${currentAuction.item} for ${bid}!`);
            const activeServerIds = Object.keys(state.activeServers);
            if (activeServerIds.length > 0) {
                const sid = activeServerIds[0];
                if (!state.actionQueues[sid]) state.actionQueues[sid] = [];
                state.actionQueues[sid].push({
                    actionId: 'auc_' + Math.random().toString(36).substr(2, 9),
                    action: 'AUCTION_WIN', userId, itemKey: currentAuction.item,
                    quantity: currentAuction.qty, cost: bid
                });
            } else {
                if (mongoose.connection.readyState === 1) {
                    try {
                        await new PendingAuction({ userId, itemKey: currentAuction.item, quantity: currentAuction.qty, cost: bid }).save();
                    } catch (err) { console.error("[Auction] Failed to save pending:", err); }
                }
            }

            // Track win
            try {
                await Player.updateOne({ robloxUserId: String(userId) }, {
                    $inc: { totalAuctionWins: 1, totalAuctionSpent: bid }
                });
                await ActivityLog.create({
                    robloxUserId: String(userId), action: 'AUCTION_WIN',
                    details: { itemKey: currentAuction.item, quantity: currentAuction.qty, cost: bid }
                });
            } catch (e) { console.error('[Auction] Track error:', e); }
        } else {
            console.log(`[Auction] CANCELED! ${currentAuction.highestBidderName} didn't have ${bid} coins.`);
        }
    } else {
        console.log("[Auction] Ended with no bidders.");
    }
    startNewAuction();
}

// Start auction system
startNewAuction();
setInterval(() => {
    if (Date.now() >= currentAuction.endTime) resolveAuction();
}, 1000);

// Get auction status
router.get('/status', (req, res) => {
    const gameConfigs = state.gameConfigs;
    let img = currentAuction.imageUrl || "";
    let name = currentAuction.displayName || currentAuction.item;
    if (gameConfigs[currentAuction.category] && gameConfigs[currentAuction.category][currentAuction.item]) {
        const itemInfo = gameConfigs[currentAuction.category][currentAuction.item];
        if (itemInfo.imageUrl) img = itemInfo.imageUrl;
        if (itemInfo.DisplayName) name = itemInfo.DisplayName;
    }
    res.json({ ...currentAuction, displayName: name, imageUrl: img, serverTime: Date.now() });
});

// Place bid
router.post('/bid', async (req, res) => {
    const { userId, username, bidAmount } = req.body;
    if (!userId || !bidAmount) return res.status(400).json({ error: 'Missing params' });

    const baseBid = currentAuction.currentBid || currentAuction.startPrice;
    const minRequired = baseBid + currentAuction.step;
    if (bidAmount < minRequired) return res.status(400).json({ error: `Bid too low. Min: ${minRequired} 🪙.` });

    const bidderData = await getRobloxPlayerData(userId);
    if (bidderData.cash < bidAmount) return res.status(400).json({ error: 'Not enough coins!' });

    currentAuction.highestBidderId = userId;
    currentAuction.highestBidderName = username;
    currentAuction.currentBid = bidAmount;

    // Track bid
    try {
        await Player.updateOne({ robloxUserId: String(userId) }, { $inc: { totalAuctionBids: 1 } });
        await ActivityLog.create({
            robloxUserId: String(userId), action: 'AUCTION_BID',
            details: { itemKey: currentAuction.item, bidAmount }
        });
    } catch (e) { console.error('[Auction] Track error:', e); }

    console.log(`[Auction] ${username} bid ${bidAmount}!`);
    res.json({ success: true, message: 'Bid placed successfully!' });
});

module.exports = router;
