const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "DEINE_DATENBANK_URL_HIER_EINFUEGEN";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("[Backend] MongoDB erfolgreich verbunden!"))
    .catch(err => console.log("[Backend] MongoDB Fehler (Auktionen werden nicht gespeichert wenn offline):", err));

// MongoDB Schema for Pending Auctions
const pendingAuctionSchema = new mongoose.Schema({
    userId: String,
    itemKey: String,
    quantity: Number,
    cost: Number,
    createdAt: { type: Date, default: Date.now }
});
const PendingAuction = mongoose.model('PendingAuction', pendingAuctionSchema);

// MongoDB Schema for Marketplace Offers
const marketplaceOfferSchema = new mongoose.Schema({
    offerId: { type: String, required: true, unique: true },
    sellerId: { type: String, required: true },
    sellerName: { type: String, required: true },
    sellerAvatar: { type: String, default: '' },
    items: [{
        itemKey: String,
        category: String,
        displayName: String,
        imageUrl: String,
        quantity: Number
    }],
    sellerPayout: { type: Number, required: true },
    price: { type: Number, required: true },
    fee: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, default: 'ACTIVE' }
});
const MarketplaceOffer = mongoose.model('MarketplaceOffer', marketplaceOfferSchema);
const inMemoryMarketplaceOffers = [];

// In-Memory Database for codes
const codesDB = {};

// Game Config Data (Hardcoded to avoid dependency on Roblox server being online)
const fs = require('fs');
let gameConfigs = {};

// Live Server Sync Data
const activeServers = {}; // Format: { serverId: { lastSeen: Date.now(), players: { "userId": { cash: 100 } } } }

try {
    const data = fs.readFileSync(path.join(__dirname, 'configs.json'), 'utf8');
    gameConfigs = JSON.parse(data);
    console.log("[Backend] Loaded static configs.json successfully.");
    
    // Fetch all thumbnails from Roblox
    fetchThumbnails();
} catch (e) {
    console.error("[Backend] Could not load configs.json", e);
}

// -------------------------
// LIVE SYNC ENDPOINTS
// -------------------------

// 1. Heartbeat from Roblox Server
app.post('/api/serverSync', (req, res) => {
    const { serverId, players } = req.body;
    if (serverId && players) {
        activeServers[serverId] = {
            lastSeen: Date.now(),
            players: players
        };
        res.status(200).json({ message: 'Heartbeat received' });
    } else {
        res.status(400).json({ error: 'Invalid payload' });
    }
});

// 2. Immediate Player Stat Update
app.post('/api/updatePlayerStats', (req, res) => {
    const { serverId, userId, cash } = req.body;
    if (serverId && userId && activeServers[serverId]) {
        if (!activeServers[serverId].players[userId]) {
            activeServers[serverId].players[userId] = {};
        }
        activeServers[serverId].players[userId].cash = cash;
        res.status(200).json({ message: 'Player stats updated' });
    } else {
        res.status(400).json({ error: 'Server or User not found' });
    }
});

// 3. Frontend Polling Endpoint
app.get('/api/status/:userId', (req, res) => {
    const userId = req.params.userId;
    const now = Date.now();
    let isServerOnline = false;
    let currentServerId = null;
    let playerCash = 0;
    let playerStock = {};
    let playerInventory = {};
    let dailyReward = null;
    
    // A server is considered online if it sent a heartbeat in the last 10 seconds (10,000 ms)
    for (const [serverId, serverData] of Object.entries(activeServers)) {
        if (now - serverData.lastSeen < 10000) {
            isServerOnline = true;
            currentServerId = serverId;
            // Check if our player is in this server
            if (serverData.players[userId]) {
                playerCash = serverData.players[userId].cash;
                playerStock = serverData.players[userId].stock || {};
                playerInventory = serverData.players[userId].inventory || {};
                dailyReward = serverData.players[userId].dailyReward || null;
                break;
            }
        } else {
            // Clean up stale servers
            delete activeServers[serverId];
        }
    }
    
    res.status(200).json({ isServerOnline, currentServerId, playerCash, playerStock, playerInventory, dailyReward, serverTime: Math.floor(now / 1000) });
});

app.get('/api/debugServers', (req, res) => {
    res.status(200).json(activeServers);
});

// -------------------------
// GLOBAL AUCTION SYSTEM
// -------------------------
const auctionConfig = [
    // Blocks
    { key: 'Metal Block', category: 'Blocks', start: 30000, up: 500, qty: 50 },//50x1.000=50k
    { key: 'Stone Block', category: 'Blocks', start: 11250, up: 250, qty: 75 },//75x150=11.250
    { key: 'Block', category: 'Blocks', start: 250, up: 25, qty: 100 },//10x100=1k

    // Defense Turrets & Weapons
    { key: 'Flamethrower', category: 'Defense', start: 12500, up: 500, qty: 2 },//10.000x2=20k
    { key: '4Turret', category: 'Defense', start: 10000, up: 500, qty: 3 },//5.000x3=15k
    { key: '3Turret', category: 'Defense', start: 4000, up: 300, qty: 5 },//1.500x5=7.5k
    { key: '2Turret', category: 'Defense', start: 2500, up: 250, qty: 10 },//500x10=5k
    { key: '1Turret', category: 'Defense', start: 750, up: 50, qty: 15 },//100x15=1.5k

    // Chests
    { key: 'Diamond Chest', category: 'Chests', start: 8000, up: 500, qty: 1 },
    { key: 'Iron Chest', category: 'Chests', start: 2000, up: 150, qty: 2 },
    { key: 'Wood Chest', category: 'Chests', start: 400, up: 50, qty: 5 },

    // Decor & Doors
    { key: 'Metal Laserdoor', category: 'Decor', start: 5000, up: 500, qty: 5 },//2.000x5=10k
    { key: 'Stone Laserdoor', category: 'Decor', start: 1500, up: 250, qty: 10 },//300x10=3k
    { key: 'Metal Window', category: 'Decor', start: 30000, up: 500, qty: 50 },//1.000x50=50k
    { key: 'Stone Window', category: 'Decor', start: 11250, up: 250, qty: 75 },//150x75=11.250
    { key: 'Metal Stair', category: 'Decor', start: 30000, up: 500, qty: 50 },//1.000x50=50k
    { key: 'Stone Stair', category: 'Decor', start: 11250, up: 250, qty: 175 },//150x75=11.250
    
];

let currentAuction = {
    item: null,
    category: null,
    displayName: null,
    imageUrl: null,
    qty: 0,
    startPrice: 0,
    currentBid: 0,
    highestBidderId: null,
    highestBidderName: null,
    endTime: 0,
    step: 0
};

function getNext10MinuteMark() {
    const d = new Date();
    d.setMinutes(Math.ceil((d.getMinutes() + 1) / 10) * 10);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d.getTime();
}

function startNewAuction() {
    const config = auctionConfig[Math.floor(Math.random() * auctionConfig.length)];
    const qty = config.qty || 1;
    
    let displayName = config.key;
    let imageUrl = "";
    if (gameConfigs[config.category] && gameConfigs[config.category][config.key]) {
        const itemInfo = gameConfigs[config.category][config.key];
        displayName = itemInfo.DisplayName || config.key;
        imageUrl = itemInfo.imageUrl || "";
    }

    currentAuction = {
        item: config.key,
        category: config.category,
        displayName: displayName,
        imageUrl: imageUrl,
        qty: qty,
        startPrice: config.start,
        currentBid: config.start,
        highestBidderId: null,
        highestBidderName: null,
        endTime: getNext10MinuteMark(),
        step: config.up
    };
    console.log(`[Auction] Started new auction: ${qty}x ${displayName} (${config.key}), Ends at: ${new Date(currentAuction.endTime).toLocaleTimeString()}`);
}
startNewAuction();

async function resolveAuction() {
    if (currentAuction.highestBidderId) {
        // Validate if they still have enough cash!
        const userId = currentAuction.highestBidderId;
        const bid = currentAuction.currentBid;
        let hasMoney = false;

        for (const server of Object.values(activeServers)) {
            if (server.players[userId] && server.players[userId].cash >= bid) {
                hasMoney = true;
                break;
            }
        }

        if (hasMoney) {
            console.log(`[Auction] ${currentAuction.highestBidderName} won ${currentAuction.qty}x ${currentAuction.item} for ${bid}!`);
            
            // Check if any server is online
            const activeServerIds = Object.keys(activeServers);
            if (activeServerIds.length > 0) {
                const targetServerId = activeServerIds[0];
                if (!actionQueues[targetServerId]) actionQueues[targetServerId] = [];
                
                actionQueues[targetServerId].push({
                    actionId: 'auc_' + Math.random().toString(36).substr(2, 9),
                    action: 'AUCTION_WIN',
                    userId: userId,
                    itemKey: currentAuction.item,
                    quantity: currentAuction.qty,
                    cost: bid
                });
                console.log(`[Auction] Sent win to Roblox Server ${targetServerId}`);
            } else {
                console.log(`[Auction] NO SERVERS ONLINE! Saving win to MongoDB for ${userId}.`);
                if (mongoose.connection.readyState === 1) {
                    try {
                        const pending = new PendingAuction({
                            userId: userId,
                            itemKey: currentAuction.item,
                            quantity: currentAuction.qty,
                            cost: bid
                        });
                        await pending.save();
                    } catch(err) {
                        console.error("[Auction] Failed to save pending auction:", err);
                    }
                }
            }
        } else {
            console.log(`[Auction] CANCELED! ${currentAuction.highestBidderName} won but didn't have ${bid} coins anymore.`);
        }
    } else {
        console.log("[Auction] Ended with no bidders.");
    }
    startNewAuction();
}

// Auction loop
setInterval(() => {
    if (Date.now() >= currentAuction.endTime) {
        resolveAuction();
    }
}, 1000);

app.get('/api/auction/status', (req, res) => {
    let img = currentAuction.imageUrl || "";
    let name = currentAuction.displayName || currentAuction.item;
    if (gameConfigs[currentAuction.category] && gameConfigs[currentAuction.category][currentAuction.item]) {
        const itemInfo = gameConfigs[currentAuction.category][currentAuction.item];
        if (itemInfo.imageUrl) img = itemInfo.imageUrl;
        if (itemInfo.DisplayName) name = itemInfo.DisplayName;
    }
    res.json({
        ...currentAuction,
        displayName: name,
        imageUrl: img,
        serverTime: Date.now()
    });
});

app.post('/api/auction/bid', (req, res) => {
    const { userId, username, bidAmount } = req.body;
    if (!userId || !bidAmount) return res.status(400).json({ error: 'Missing params' });

    // Validate if bid is high enough (must be at least currentBid + step)
    const baseBid = currentAuction.currentBid || currentAuction.startPrice;
    const minRequiredBid = baseBid + currentAuction.step;
    if (bidAmount < minRequiredBid) {
        return res.status(400).json({ error: `Bid is too low. Minimum required: ${minRequiredBid} 🪙.` });
    }

    // Check if player has the money across all servers
    let actualCash = 0;
    for (const server of Object.values(activeServers)) {
        if (server.players[userId]) {
            actualCash = server.players[userId].cash;
            break;
        }
    }

    if (actualCash < bidAmount) {
        return res.status(400).json({ error: 'Not enough in-game coins!' });
    }

    currentAuction.highestBidderId = userId;
    currentAuction.highestBidderName = username;
    currentAuction.currentBid = bidAmount;
    
    console.log(`[Auction] ${username} just bid ${bidAmount}!`);
    res.json({ success: true, message: 'Bid placed successfully!' });
});

// -------------------------
// P2P MARKETPLACE ("SELL & BUY")
// -------------------------

// 1. Get all active offers
app.get('/api/marketplace/offers', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const offers = await MarketplaceOffer.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).limit(60);
            return res.status(200).json({ success: true, offers });
        }
        res.status(200).json({ success: true, offers: inMemoryMarketplaceOffers.filter(o => o.status === 'ACTIVE') });
    } catch (err) {
        console.error('[Marketplace] Error fetching offers:', err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// 2. Create an offer (+5% fee automatically added to price)
app.post('/api/marketplace/createOffer', async (req, res) => {
    const { sellerId, sellerName, sellerAvatar, items, sellerPayout } = req.body;
    if (!sellerId || !sellerName || !items || !Array.isArray(items) || items.length === 0 || !sellerPayout) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const payoutNum = parseInt(sellerPayout, 10);
    if (isNaN(payoutNum) || payoutNum <= 0) {
        return res.status(400).json({ error: 'Price must be greater than 0.' });
    }

    // Calculate 5% fee (seller pays this fee upon creation)
    const fee = Math.ceil(payoutNum * 0.05);
    const finalPrice = payoutNum; // Other players buy for this exact price

    // Validate seller has enough coins to pay 5% creation fee
    let sellerCash = 0;
    for (const server of Object.values(activeServers)) {
        if (server.players && server.players[sellerId]) {
            sellerCash = server.players[sellerId].cash || 0;
            break;
        }
    }
    if (sellerCash < fee) {
        return res.status(400).json({ error: `You need at least ${fee} 🪙 to pay the 5% creation fee!` });
    }

    // Forbid Chests completely from trading
    for (const it of items) {
        const isChest = (it.category && it.category.toLowerCase() === 'chests') 
            || (it.itemKey && it.itemKey.toLowerCase().includes('chest'))
            || (it.displayName && it.displayName.toLowerCase().includes('chest'));
        if (isChest) {
            return res.status(400).json({ error: 'Chests cannot be traded or offered on the marketplace!' });
        }
    }

    // Validate inventory: Player must be currently in-game with verified unplaced inventory
    let sellerInv = null;
    for (const server of Object.values(activeServers)) {
        if (server.players && server.players[sellerId] && server.players[sellerId].inventory) {
            sellerInv = server.players[sellerId].inventory;
            break;
        }
    }

    if (!sellerInv) {
        return res.status(400).json({ error: 'You must be in the Roblox game to create an offer so your unplaced inventory can be verified!' });
    }

    for (const it of items) {
        const owned = sellerInv[it.itemKey] || 0;
        if (owned < it.quantity) {
            return res.status(400).json({ 
                error: `Not enough unplaced ${it.displayName || it.itemKey} in your inventory! (You own ${owned} unplaced items; blocks built on your base cannot be traded).` 
            });
        }
    }

    // Enrich items with DisplayName, ImageUrl, Category from gameConfigs
    const enrichedItems = items.map(it => {
        let cat = it.category || 'Blocks';
        let disp = it.displayName || it.itemKey;
        let img = it.imageUrl || '';
        if (gameConfigs) {
            for (const c in gameConfigs) {
                if (gameConfigs[c][it.itemKey]) {
                    cat = c;
                    disp = gameConfigs[c][it.itemKey].DisplayName || disp;
                    img = gameConfigs[c][it.itemKey].imageUrl || img;
                    break;
                }
            }
        }
        return {
            itemKey: it.itemKey,
            category: cat,
            displayName: disp,
            imageUrl: img,
            quantity: it.quantity
        };
    });

    const offerId = 'off_' + Math.random().toString(36).substr(2, 9);
    const offerDoc = {
        offerId,
        sellerId,
        sellerName,
        sellerAvatar: sellerAvatar || '',
        items: enrichedItems,
        sellerPayout: payoutNum,
        price: finalPrice,
        fee: fee,
        createdAt: new Date(),
        status: 'ACTIVE'
    };

    // Queue deduction action for Roblox server (items + 5% fee)
    const activeServerIds = Object.keys(activeServers);
    if (activeServerIds.length > 0) {
        const targetServerId = activeServerIds[0];
        if (!actionQueues[targetServerId]) actionQueues[targetServerId] = [];
        actionQueues[targetServerId].push({
            actionId: 'mkt_deduct_' + Math.random().toString(36).substr(2, 9),
            action: 'MARKETPLACE_DEDUCT_ITEMS',
            userId: sellerId,
            items: enrichedItems,
            fee: fee
        });
    }

    if (mongoose.connection.readyState === 1) {
        try {
            const newOffer = new MarketplaceOffer(offerDoc);
            await newOffer.save();
        } catch (err) {
            console.error('[Marketplace] Save error:', err);
        }
    }
    inMemoryMarketplaceOffers.unshift(offerDoc);

    console.log(`[Marketplace] ${sellerName} created offer ${offerId} with ${enrichedItems.length} items. Listed at ${finalPrice} 🪙 (Fee paid: ${fee} 🪙).`);
    res.status(200).json({ success: true, offer: offerDoc });
});

// 3. Buy an offer
app.post('/api/marketplace/buyOffer', async (req, res) => {
    const { buyerId, buyerName, offerId } = req.body;
    if (!buyerId || !buyerName || !offerId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    let offer = null;
    if (mongoose.connection.readyState === 1) {
        offer = await MarketplaceOffer.findOne({ offerId, status: 'ACTIVE' });
    }
    if (!offer) {
        offer = inMemoryMarketplaceOffers.find(o => o.offerId === offerId && o.status === 'ACTIVE');
    }

    if (!offer) {
        return res.status(404).json({ error: 'Offer not found or already sold!' });
    }

    if (offer.sellerId === buyerId) {
        return res.status(400).json({ error: 'You cannot buy your own offer!' });
    }

    // Verify buyer cash
    let buyerCash = 0;
    for (const server of Object.values(activeServers)) {
        if (server.players && server.players[buyerId]) {
            buyerCash = server.players[buyerId].cash;
            break;
        }
    }

    if (buyerCash < offer.price) {
        return res.status(400).json({ error: `Not enough coins! You need ${offer.price} 🪙.` });
    }

    // Mark offer as SOLD
    offer.status = 'SOLD';
    if (mongoose.connection.readyState === 1) {
        await MarketplaceOffer.updateOne({ offerId }, { status: 'SOLD' });
    }

    // Queue delivery action to Roblox server
    const activeServerIds = Object.keys(activeServers);
    if (activeServerIds.length > 0) {
        const targetServerId = activeServerIds[0];
        if (!actionQueues[targetServerId]) actionQueues[targetServerId] = [];
        actionQueues[targetServerId].push({
            actionId: 'mkt_deliver_' + Math.random().toString(36).substr(2, 9),
            action: 'MARKETPLACE_DELIVER_SALE',
            buyerId: buyerId,
            sellerId: offer.sellerId,
            items: offer.items,
            price: offer.price,
            sellerPayout: offer.sellerPayout
        });
    }

    console.log(`[Marketplace] ${buyerName} bought offer ${offerId} from ${offer.sellerName} for ${offer.price} 🪙!`);
    res.status(200).json({ success: true, message: 'Offer purchased successfully!' });
});

// 4. Cancel an offer
app.post('/api/marketplace/cancelOffer', async (req, res) => {
    const { userId, offerId } = req.body;
    if (!userId || !offerId) return res.status(400).json({ error: 'Missing parameters' });

    let offer = null;
    if (mongoose.connection.readyState === 1) {
        offer = await MarketplaceOffer.findOne({ offerId, sellerId: userId, status: 'ACTIVE' });
    }
    if (!offer) {
        offer = inMemoryMarketplaceOffers.find(o => o.offerId === offerId && o.sellerId === userId && o.status === 'ACTIVE');
    }

    if (!offer) {
        return res.status(404).json({ error: 'Active offer not found.' });
    }

    offer.status = 'CANCELLED';
    if (mongoose.connection.readyState === 1) {
        await MarketplaceOffer.updateOne({ offerId }, { status: 'CANCELLED' });
    }

    // Return items to seller
    const activeServerIds = Object.keys(activeServers);
    if (activeServerIds.length > 0) {
        const targetServerId = activeServerIds[0];
        if (!actionQueues[targetServerId]) actionQueues[targetServerId] = [];
        actionQueues[targetServerId].push({
            actionId: 'mkt_cancel_' + Math.random().toString(36).substr(2, 9),
            action: 'MARKETPLACE_CANCEL_RETURN',
            sellerId: userId,
            items: offer.items
        });
    }

    console.log(`[Marketplace] ${offer.sellerName} cancelled offer ${offerId}.`);
    res.status(200).json({ success: true, message: 'Offer cancelled and items returned to your inventory.' });
});

// -------------------------
// 2-WAY SYNC (REMOTE SHOP & DAILY REWARDS)
// -------------------------
const actionQueues = {}; // { serverId: [ { actionId, action, userId, itemKey } ] }
const actionResults = {}; // { actionId: { success, message, newStock, ... } }

app.post('/api/buyItem', async (req, res) => {
    const { serverId, userId, itemKey, quantity } = req.body;
    if (!serverId || !userId || !itemKey) return res.status(400).json({ error: 'Missing params' });
    if (!activeServers[serverId]) return res.status(400).json({ error: 'Server offline' });

    const actionId = 'act_' + Math.random().toString(36).substr(2, 9);
    
    if (!actionQueues[serverId]) actionQueues[serverId] = [];
    actionQueues[serverId].push({ actionId, action: 'BUY', userId, itemKey, quantity: quantity || 1 });

    // Wait for result (timeout after 15 seconds)
    let attempts = 0;
    while (attempts < 30) {
        if (actionResults[actionId]) {
            const result = actionResults[actionId];
            delete actionResults[actionId];
            if (result.success) return res.status(200).json(result);
            else return res.status(400).json(result);
        }
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }
    
    // Timeout
    actionQueues[serverId] = actionQueues[serverId].filter(a => a.actionId !== actionId);
    res.status(504).json({ success: false, message: 'Roblox server timed out' });
});

app.post('/api/claimDailyReward', async (req, res) => {
    const { serverId, userId } = req.body;
    if (!serverId || !userId) return res.status(400).json({ error: 'Missing params' });
    if (!activeServers[serverId]) return res.status(400).json({ error: 'Server offline' });

    const actionId = 'claim_' + Math.random().toString(36).substr(2, 9);
    
    if (!actionQueues[serverId]) actionQueues[serverId] = [];
    actionQueues[serverId].push({ actionId, action: 'CLAIM_DAILY', userId });

    // Wait for result (timeout after 15 seconds)
    let attempts = 0;
    while (attempts < 30) {
        if (actionResults[actionId]) {
            const result = actionResults[actionId];
            delete actionResults[actionId];
            if (result.success) return res.status(200).json(result);
            else return res.status(400).json(result);
        }
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }
    
    // Timeout
    actionQueues[serverId] = actionQueues[serverId].filter(a => a.actionId !== actionId);
    res.status(504).json({ success: false, message: 'Roblox server timed out' });
});

app.get('/api/pollActions/:serverId', async (req, res) => {
    const { serverId } = req.params;
    let actions = actionQueues[serverId] || [];
    actionQueues[serverId] = []; // Clear queue
    
    // Check MongoDB for any pending Offline Auction Wins
    if (mongoose.connection.readyState === 1) {
        try {
            const pendingWins = await PendingAuction.find({});
            if (pendingWins.length > 0) {
                console.log(`[Backend] Injecting ${pendingWins.length} pending offline auction wins to Server ${serverId}`);
                for (const win of pendingWins) {
                    actions.push({
                        actionId: 'auc_offline_' + win._id,
                        action: 'AUCTION_WIN',
                        userId: win.userId,
                        itemKey: win.itemKey,
                        quantity: win.quantity,
                        cost: win.cost
                    });
                    // Delete from DB since we are sending it
                    await PendingAuction.findByIdAndDelete(win._id);
                }
            }
        } catch (err) {
            console.error("[Backend] Error fetching pending auctions:", err);
        }
    }

    res.status(200).json({ actions });
});

app.post('/api/actionResult', (req, res) => {
    const { actionId, success, message, newStock, reward, newStreak, lastClaimTime, coinsAwarded } = req.body;
    if (actionId) {
        actionResults[actionId] = { success, message, newStock, reward, newStreak, lastClaimTime, coinsAwarded };
        res.status(200).json({ message: 'Result accepted' });
    } else {
        res.status(400).json({ error: 'Missing actionId' });
    }
});

// -------------------------

async function fetchThumbnails() {
    let assetIds = [];
    // Collect all IDs
    for (const cat in gameConfigs) {
        for (const key in gameConfigs[cat]) {
            if (gameConfigs[cat][key].ImageId) {
                assetIds.push(gameConfigs[cat][key].ImageId);
            }
        }
    }
    
    if (assetIds.length === 0) return;
    
    try {
        // Fetch in chunks of 50 (Roblox limit) if necessary, but we only have ~23 items
        const res = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
        const json = await res.json();
        
        if (json && json.data) {
            const imageMap = {};
            json.data.forEach(item => {
                imageMap[item.targetId.toString()] = item.imageUrl;
            });
            
            // Map back to configs
            for (const cat in gameConfigs) {
                for (const key in gameConfigs[cat]) {
                    const id = gameConfigs[cat][key].ImageId;
                    if (id && imageMap[id]) {
                        gameConfigs[cat][key].imageUrl = imageMap[id];
                    }
                }
            }
            console.log("[Backend] Roblox Thumbnails successfully fetched and mapped!");
        }
    } catch (err) {
        console.error("[Backend] Error fetching thumbnails:", err);
    }
}

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
        res.status(401).json({ success: false, error: 'Code not found. You must be in-game to connect!' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`[Backend] Web server is running on http://localhost:${PORT}`);
});
