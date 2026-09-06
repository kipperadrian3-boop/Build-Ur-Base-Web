const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const state = require('../state');
const { getRobloxPlayerData, saveRobloxPlayerData } = require('../opencloud');
const PendingAuction = require('../models/PendingAuction');
const ActiveAuction = require('../models/ActiveAuction');

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

// Sofortiger Münzabzug beim Bieten (Live Roblox Server + Offline Open Cloud)
async function deductCoins(userId, amount) {
    if (!userId || amount <= 0) return;
    const uid = String(userId);

    // 1. Live Server Check
    let onlineInServer = false;
    for (const [sid, server] of Object.entries(state.activeServers)) {
        if (server.players && server.players[uid]) {
            server.players[uid].cash = Math.max(0, (server.players[uid].cash || 0) - amount);
            onlineInServer = true;
            if (!state.actionQueues[sid]) state.actionQueues[sid] = [];
            state.actionQueues[sid].push({
                actionId: 'auc_deduct_' + Math.random().toString(36).substr(2, 9),
                action: 'AUCTION_BID_DEDUCT',
                userId: uid,
                amount: amount
            });
            break;
        }
    }

    // 2. Open Cloud DataStore Update (wenn offline oder Fallback)
    const pData = await getRobloxPlayerData(uid);
    if (pData.raw) {
        pData.raw.Coins = Math.max(0, (pData.raw.Coins || 0) - amount);
        await saveRobloxPlayerData(uid, pData.raw);
    }
}

// Sofortige Rückerstattung bei Überbietung (Live Roblox Server + Offline Open Cloud)
async function refundCoins(userId, amount) {
    if (!userId || amount <= 0) return;
    const uid = String(userId);

    // 1. Live Server Check
    let onlineInServer = false;
    for (const [sid, server] of Object.entries(state.activeServers)) {
        if (server.players && server.players[uid]) {
            server.players[uid].cash = (server.players[uid].cash || 0) + amount;
            onlineInServer = true;
            if (!state.actionQueues[sid]) state.actionQueues[sid] = [];
            state.actionQueues[sid].push({
                actionId: 'auc_refund_' + Math.random().toString(36).substr(2, 9),
                action: 'AUCTION_BID_REFUND',
                userId: uid,
                amount: amount
            });
            break;
        }
    }

    // 2. Open Cloud DataStore Update (wenn offline oder Fallback)
    const pData = await getRobloxPlayerData(uid);
    if (pData.raw) {
        pData.raw.Coins = (pData.raw.Coins || 0) + amount;
        await saveRobloxPlayerData(uid, pData.raw);
    }
}

async function startNewAuction() {
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

    const endTime = getNext10MinuteMark();

    currentAuction = {
        item: config.key, category: config.category, displayName, imageUrl,
        qty, startPrice: config.start, currentBid: config.start,
        highestBidderId: null, highestBidderName: null,
        endTime, step: config.up
    };

    if (mongoose.connection.readyState === 1) {
        try {
            await ActiveAuction.updateOne(
                { auctionId: 'current' },
                {
                    $set: {
                        itemKey: config.key,
                        qty,
                        currentBid: config.start,
                        highestBidderId: null,
                        endTime
                    }
                },
                { upsert: true }
            );
        } catch (e) {
            console.error('[Auction] Failed to persist new auction:', e.message);
        }
    }

    console.log(`[Auction] New: ${qty}x ${displayName}, Ends: ${new Date(currentAuction.endTime).toLocaleTimeString()}`);
}

async function resolveAuction() {
    if (currentAuction.highestBidderId) {
        const userId = currentAuction.highestBidderId;
        const bid = currentAuction.currentBid;

        console.log(`[Auction] ${currentAuction.highestBidderName || userId} won ${currentAuction.qty}x ${currentAuction.item}! (Paid: ${bid} Coins)`);

        // Da die Coins bereits direkt beim Bieten abgezogen wurden, beträgt der Restpreis beim Gewinnen 0 Coins!
        const activeServerIds = Object.keys(state.activeServers);
        if (activeServerIds.length > 0) {
            const sid = activeServerIds[0];
            if (!state.actionQueues[sid]) state.actionQueues[sid] = [];
            state.actionQueues[sid].push({
                actionId: 'auc_' + Math.random().toString(36).substr(2, 9),
                action: 'AUCTION_WIN',
                userId,
                itemKey: currentAuction.item,
                quantity: currentAuction.qty,
                cost: 0 // Bereits beim Bieten bezahlt!
            });
        } else {
            // Offline: Direkt über Open Cloud ins Inventar übertragen
            let delivered = false;
            try {
                const winnerData = await getRobloxPlayerData(userId);
                if (winnerData.raw) {
                    winnerData.raw.Inventory = winnerData.raw.Inventory || {};
                    winnerData.raw.Inventory[currentAuction.item] = (winnerData.raw.Inventory[currentAuction.item] || 0) + currentAuction.qty;
                    await saveRobloxPlayerData(userId, winnerData.raw);
                    delivered = true;
                    console.log(`[Auction] Offline delivery: Added ${currentAuction.qty}x ${currentAuction.item} directly to ${userId}'s DataStore inventory.`);
                }
            } catch (ocErr) {
                console.error('[Auction] Open Cloud delivery error:', ocErr);
            }

            if (!delivered && mongoose.connection.readyState === 1) {
                try {
                    await new PendingAuction({
                        userId,
                        itemKey: currentAuction.item,
                        quantity: currentAuction.qty,
                        cost: 0
                    }).save();
                } catch (err) {
                    console.error("[Auction] Failed to save pending auction:", err);
                }
            }
        }

        // Track win in MongoDB
        try {
            const tracking = require('../tracking');
            tracking.trackAuctionWin(userId, bid, currentAuction.item, currentAuction.qty);
        } catch (tErr) {
            console.error('[Auction] Track win error:', tErr);
        }
    } else {
        console.log("[Auction] Ended with no bidders.");
    }

    await startNewAuction();
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
    if (!userId || !bidAmount) return res.status(400).json({ error: 'Missing parameters' });

    const numBid = parseInt(bidAmount, 10);
    if (isNaN(numBid) || numBid <= 0) return res.status(400).json({ error: 'Invalid bid amount' });

    // Spieler darf nicht gegen sich selbst bieten, wenn er bereits der Höchstbietende ist!
    if (currentAuction.highestBidderId && String(currentAuction.highestBidderId) === String(userId)) {
        return res.status(400).json({ error: "You are already the highest bidder!" });
    }

    // Mindestgebot berechnen
    const baseBid = currentAuction.highestBidderId ? currentAuction.currentBid : currentAuction.startPrice;
    const minRequired = currentAuction.highestBidderId ? (baseBid + currentAuction.step) : baseBid;
    if (numBid < minRequired) {
        return res.status(400).json({ error: `Bid too low. Min: ${minRequired.toLocaleString('de-DE')} 🪙.` });
    }

    const bidderData = await getRobloxPlayerData(userId);
    if (bidderData.cash < numBid) {
        return res.status(400).json({ error: `Not enough coins! You need ${numBid.toLocaleString('de-DE')} 🪙.` });
    }

    // 1. Geld SOFORT vom neuen Bieter abziehen
    await deductCoins(userId, numBid);

    // 2. Vorherigen Höchstbietenden SOFORT VOLLSTÄNDIG zurückerstatten
    const prevBidderId = currentAuction.highestBidderId;
    const prevBidAmount = currentAuction.currentBid;
    if (prevBidderId && prevBidderId !== String(userId) && prevBidAmount > 0) {
        console.log(`[Auction] Outbid! Refunding ${prevBidAmount} 🪙 to user ${prevBidderId}`);
        await refundCoins(prevBidderId, prevBidAmount);
    }

    // 3. Auktionsstatus aktualisieren
    currentAuction.highestBidderId = String(userId);
    currentAuction.highestBidderName = username;
    currentAuction.currentBid = numBid;

    // In MongoDB persistieren
    if (mongoose.connection.readyState === 1) {
        try {
            await ActiveAuction.updateOne(
                { auctionId: 'current' },
                { $set: { currentBid: numBid, highestBidderId: String(userId) } }
            );
        } catch (e) {}
    }

    // 4. Tracking
    try {
        const tracking = require('../tracking');
        tracking.trackAuctionBid(userId, numBid, currentAuction.item);
    } catch (e) {}

    console.log(`[Auction] ${username} bid ${numBid} 🪙! (Deducted: ${numBid} 🪙, Outbid refunded: ${prevBidderId ? prevBidAmount : 0} 🪙)`);
    res.json({
        success: true,
        message: `Bid placed! ${numBid.toLocaleString('de-DE')} 🪙 deducted.`,
        currentBid: numBid
    });
});

module.exports = router;
