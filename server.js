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
                dailyReward = serverData.players[userId].dailyReward || null;
                break;
            }
        } else {
            // Clean up stale servers
            delete activeServers[serverId];
        }
    }
    
    res.status(200).json({ isServerOnline, currentServerId, playerCash, playerStock, dailyReward, serverTime: Math.floor(now / 1000) });
});

app.get('/api/debugServers', (req, res) => {
    res.status(200).json(activeServers);
});

// -------------------------
// GLOBAL AUCTION SYSTEM
// -------------------------
const auctionConfig = [
    // Blocks
    { key: 'Metal Block', category: 'Blocks', start: 1000, up: 100, qty: 5 },
    { key: 'Stone Block', category: 'Blocks', start: 200, up: 25, qty: 20 },
    { key: 'Block', category: 'Blocks', start: 50, up: 10, qty: 50 },

    // Defense Turrets & Weapons
    { key: 'Flamethrower', category: 'Defense', start: 10000, up: 500, qty: 1 },
    { key: '4Turret', category: 'Defense', start: 5000, up: 250, qty: 1 },
    { key: '3Turret', category: 'Defense', start: 1500, up: 100, qty: 2 },
    { key: '2Turret', category: 'Defense', start: 500, up: 50, qty: 4 },
    { key: '1Turret', category: 'Defense', start: 100, up: 20, qty: 5 },

    // Chests
    { key: 'Diamond Chest', category: 'Chests', start: 8000, up: 500, qty: 1 },
    { key: 'Iron Chest', category: 'Chests', start: 2000, up: 150, qty: 2 },
    { key: 'Wood Chest', category: 'Chests', start: 400, up: 50, qty: 5 },

    // Decor & Doors
    { key: 'Metal Laserdoor', category: 'Decor', start: 2000, up: 150, qty: 2 },
    { key: 'Stone Laserdoor', category: 'Decor', start: 300, up: 30, qty: 4 },
    { key: 'Laserdoor', category: 'Decor', start: 50, up: 10, qty: 10 },
    { key: 'Metal Window', category: 'Decor', start: 1000, up: 100, qty: 4 },
    { key: 'Metal Stair', category: 'Decor', start: 1000, up: 100, qty: 4 }
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
        currentBid: 0,
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

    // Validate if bid is high enough
    const minRequiredBid = currentAuction.highestBidderId ? (currentAuction.currentBid + currentAuction.step) : currentAuction.startPrice;
    if (bidAmount < minRequiredBid) {
        return res.status(400).json({ error: 'Bid is too low.' });
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
