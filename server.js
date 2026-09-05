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

// Leaderboard Schema & Storage
const leaderboardPlayerSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    coins: { type: Number, default: 0 },
    highestWave: { type: Number, default: 1 },
    streak: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now }
});
const LeaderboardPlayer = mongoose.model('LeaderboardPlayer', leaderboardPlayerSchema);

const inMemoryLeaderboard = {};

async function updateLeaderboardPlayer(userId, username, stats = {}) {
    if (!userId) return;
    const uid = String(userId);

    let existing = inMemoryLeaderboard[uid] || {
        userId: uid,
        username: username || `Player_${uid}`,
        avatarUrl: `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Png&isCircular=false`,
        coins: 0,
        highestWave: 1,
        streak: 1
    };

    if (username) existing.username = username;
    if (stats.coins !== undefined) existing.coins = Math.max(existing.coins, Number(stats.coins) || 0);
    if (stats.highestWave !== undefined) existing.highestWave = Math.max(existing.highestWave, Number(stats.highestWave) || 1);
    if (stats.streak !== undefined) existing.streak = Math.max(existing.streak, Number(stats.streak) || 1);
    if (stats.avatarUrl) existing.avatarUrl = stats.avatarUrl;
    existing.updatedAt = Date.now();

    inMemoryLeaderboard[uid] = existing;

    try {
        if (mongoose.connection.readyState === 1) {
            await LeaderboardPlayer.findOneAndUpdate(
                { userId: uid },
                { $set: existing },
                { upsert: true, new: true }
            );
        }
    } catch (e) {
        // Fallback to in-memory silently
    }
}

// In-Memory Database for codes
const codesDB = {};

// Game Config Data (Hardcoded to avoid dependency on Roblox server being online)
const fs = require('fs');
let gameConfigs = {};

// Open Cloud Configuration & Offline Player Cache
const crypto = require('crypto');
const ROBLOX_OPENCLOUD_API_KEY = process.env.ROBLOX_OPENCLOUD_API_KEY || "9I06qJ0uGUWTIbGfl3TCupVrdm0pBy+7aVIEPkpYy9HHILbGZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SWpsSk1EWnhTakIxUjFWWFZFbGlSMlpzTTFSRGRYQldjbVJ0TUhCQ2VTczNZVlpKUlZCcmNGbDVPVWhJU1V4aVJ5SXNJbTkzYm1WeVNXUWlPaUl4TURVek1ETTRNRFV4T0NJc0ltVjRjQ0k2TVRjNE9EWTBNek0wTlN3aWFXRjBJam94TnpnNE5qTTVOelExTENKdVltWWlPakUzT0RnMk16azNORFY5LmwzTDFiTENtbTBGOGMxdWFQcjVBQzNFSWNacHZrZzlKOVh2OC1abmR2bXBFQVRzbW9EcDZtdDk1UndUb3hNbm42YlRCYVdYNjF3M2dqV3pKN1kzdllQVF9fNUZxS2hqUXgyM3FHcnhpaHItTC05WkRTZExscUctTm1QTWV2S3E4M3d5RmFkNmF6eWJBb1V2V2tzYTJLNHRYZzNjQm1jNWNYS3ptYnlHTlg3VWhwdVItOG03VUZQbG9DSV92ZTNEODFFcHh4Q3c3UHowOHBGNEthcXFsWHpaQ0hhTzBmWGp5OEN1VWxsMjliYVpIajAyN3kxNjZvSG1HcEdFaVdoRnlfWFRxNUJyamdNSVJqWmZtODJmSmsxLUNOS2VfVDBuSlFQX241YVpVTXllNExPRE1ndUpZLTRNa0JKdVBULVZQVlpfWG43b3hqRGJ4SC1OR2dBakNCUQ==";
const ROBLOX_UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID || "10216403339";

// Cache for offline players to avoid Roblox DataStore rate limits (15-second TTL)
const offlinePlayerCache = {}; // { [userId]: { data: object, timestamp: number } }

async function getRobloxPlayerData(userId) {
    if (!userId) return { isOnline: false, cash: 0, stock: {}, inventory: {}, dailyReward: null, raw: null };

    // 1. Check if user is currently inside a live Roblox server
    for (const server of Object.values(activeServers)) {
        if (server.players && server.players[userId]) {
            return {
                isOnline: true,
                cash: server.players[userId].cash || 0,
                stock: server.players[userId].stock || {},
                inventory: server.players[userId].inventory || {},
                dailyReward: server.players[userId].dailyReward || null,
                raw: null
            };
        }
    }

    // 2. Check local memory cache (15 seconds TTL)
    const cached = offlinePlayerCache[userId];
    if (cached && (Date.now() - cached.timestamp < 15000)) {
        return {
            isOnline: false,
            cash: cached.data.Coins || 0,
            stock: {},
            inventory: cached.data.Inventory || {},
            dailyReward: null,
            raw: cached.data
        };
    }

    // 3. Fetch from Roblox Open Cloud DataStore v1
    try {
        const entryKey = `Player_${userId}`;
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=BuildUrBase_PlayerData_v9&entryKey=${encodeURIComponent(entryKey)}`;
        const res = await fetch(url, {
            headers: { 'x-api-key': ROBLOX_OPENCLOUD_API_KEY }
        });

        if (res.ok) {
            const rawData = await res.json();
            offlinePlayerCache[userId] = {
                data: rawData,
                timestamp: Date.now()
            };
            console.log(`[OpenCloud] Fetched live DataStore for ${userId}: ${rawData.Coins} Coins, ${Object.keys(rawData.Inventory || {}).length} inventory items`);
            return {
                isOnline: false,
                cash: rawData.Coins || 0,
                highestWave: rawData.HighestWave || 1,
                stock: {},
                inventory: rawData.Inventory || {},
                dailyReward: null,
                raw: rawData
            };
        } else {
            console.warn(`[OpenCloud] Fetch returned status ${res.status} for ${userId}`);
        }
    } catch (e) {
        console.error(`[OpenCloud] Error fetching DataStore for ${userId}:`, e);
    }

    // Fallback to older cache if available
    if (cached) {
        return {
            isOnline: false,
            cash: cached.data.Coins || 0,
            highestWave: cached.data.HighestWave || 1,
            stock: {},
            inventory: cached.data.Inventory || {},
            dailyReward: null,
            raw: cached.data
        };
    }

    return {
        isOnline: false,
        cash: 0,
        stock: {},
        inventory: {},
        dailyReward: null,
        raw: null
    };
}

async function saveOpenCloudStore(datastoreName, entryKey, data) {
    try {
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${encodeURIComponent(datastoreName)}&entryKey=${encodeURIComponent(entryKey)}`;
        const bodyStr = JSON.stringify(data);
        const md5 = crypto.createHash('md5').update(bodyStr).digest('base64');
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': ROBLOX_OPENCLOUD_API_KEY,
                'content-type': 'application/json',
                'content-md5': md5
            },
            body: bodyStr
        });
        return res.ok;
    } catch (e) {
        console.error(`[OpenCloud] Error saving to ${datastoreName}:`, e);
        return false;
    }
}

async function saveRobloxPlayerData(userId, rawData) {
    if (!userId || !rawData) return false;
    const ok = await saveOpenCloudStore("BuildUrBase_PlayerData_v9", `Player_${userId}`, rawData);
    if (ok) {
        offlinePlayerCache[userId] = {
            data: rawData,
            timestamp: Date.now()
        };
        console.log(`[OpenCloud] Successfully saved DataStore for Player_${userId}`);
    }
    return ok;
}

// Daily Rewards Open Cloud Fetch & Cache
const offlineDailyCache = {}; // { [userId]: { data, timestamp } }

async function getDailyRewardData(userId) {
    if (!userId) return null;

    // 1. Live server check
    for (const server of Object.values(activeServers)) {
        if (server.players && server.players[userId] && server.players[userId].dailyReward) {
            return server.players[userId].dailyReward;
        }
    }

    // 2. Memory cache check (10s TTL)
    const cached = offlineDailyCache[userId];
    if (cached && (Date.now() - cached.timestamp < 10000)) {
        const data = cached.data;
        const now = Math.floor(Date.now() / 1000);
        const lastClaim = Number(data.LastClaimTime) || 0;
        const canClaim = (lastClaim === 0) || (now - lastClaim >= 86400);
        const remaining = canClaim ? 0 : Math.max(0, 86400 - (now - lastClaim));
        return {
            streak: Number(data.Streak) || 1,
            lastClaimTime: lastClaim,
            canClaim: canClaim,
            remainingSeconds: remaining,
            hasThreeSpeed: data.HasThreeSpeed === true
        };
    }

    // 3. Open Cloud fetch from DailyRewardsStore_v2
    try {
        const entryKey = `Player_${userId}`;
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=DailyRewardsStore_v2&entryKey=${encodeURIComponent(entryKey)}`;
        const res = await fetch(url, { headers: { 'x-api-key': ROBLOX_OPENCLOUD_API_KEY } });
        if (res.ok) {
            const data = await res.json();
            offlineDailyCache[userId] = {
                data: data,
                timestamp: Date.now()
            };
            const now = Math.floor(Date.now() / 1000);
            const lastClaim = Number(data.LastClaimTime) || 0;
            const canClaim = (lastClaim === 0) || (now - lastClaim >= 86400);
            const remaining = canClaim ? 0 : Math.max(0, 86400 - (now - lastClaim));
            return {
                streak: Number(data.Streak) || 1,
                lastClaimTime: lastClaim,
                canClaim: canClaim,
                remainingSeconds: remaining,
                hasThreeSpeed: data.HasThreeSpeed === true
            };
        }
    } catch (e) {
        console.error('[OpenCloud] Error fetching DailyRewardsStore_v2:', e);
    }

    return {
        streak: 1,
        lastClaimTime: 0,
        canClaim: true,
        remainingSeconds: 0,
        hasThreeSpeed: false
    };
}

// 5-Minute Deterministic Item Shop Stock Calculation
function getStockEpoch() {
    return Math.floor(Date.now() / 1000 / 300);
}

function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (((hash * 33) + str.charCodeAt(i)) % 2147483647);
    }
    return hash;
}

function calculateItemStock(itemKey, epoch, stockPercent = 50, stockMax = 5) {
    let seed = (epoch * 1000003 + hashString(itemKey)) >>> 0;
    function nextInt(min, max) {
        seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
        return min + (seed % (max - min + 1));
    }

    let stock = 0;
    for (let i = 0; i < stockMax; i++) {
        if (nextInt(1, 100) <= stockPercent) {
            stock++;
        }
    }
    return stock;
}

async function getOfflinePlayerPurchases(userId) {
    const epoch = getStockEpoch();
    try {
        const entryKey = `ISP_${userId}`;
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=ItemShopPurchases_v5&entryKey=${encodeURIComponent(entryKey)}`;
        const res = await fetch(url, { headers: { 'x-api-key': ROBLOX_OPENCLOUD_API_KEY } });
        if (res.ok) {
            const data = await res.json();
            if (data && data.e === epoch) {
                return data.p || {};
            }
        }
    } catch (e) {
        console.error('[OpenCloud] Error fetching player purchases:', e);
    }
    return {};
}

async function getPlayerStockData(userId) {
    // 1. Live server check
    for (const server of Object.values(activeServers)) {
        if (server.players && server.players[userId] && server.players[userId].stock) {
            return server.players[userId].stock;
        }
    }

    // 2. Offline deterministic stock calculation
    const epoch = getStockEpoch();
    const purchases = await getOfflinePlayerPurchases(userId);
    const stockMap = {};

    for (const cat in gameConfigs) {
        for (const itemKey in gameConfigs[cat]) {
            const itemConf = gameConfigs[cat][itemKey];
            const totalStock = calculateItemStock(itemKey, epoch, itemConf.StockPercent || 50, itemConf.StockMax || 5);
            const bought = purchases[itemKey] || 0;
            stockMap[itemKey] = Math.max(0, totalStock - bought);
        }
    }
    return stockMap;
}

// Endpoint: Master Global Item Shop Stock (Called by Roblox Game Servers & Website)
app.get('/api/shop/globalStock', (req, res) => {
    const epoch = getStockEpoch();
    const stockMap = {};

    for (const cat in gameConfigs) {
        for (const itemKey in gameConfigs[cat]) {
            const itemConf = gameConfigs[cat][itemKey];
            stockMap[itemKey] = calculateItemStock(itemKey, epoch, itemConf.StockPercent || 50, itemConf.StockMax || 5);
        }
    }

    const nextReset = (epoch + 1) * 300;
    res.status(200).json({
        epoch: epoch,
        stock: stockMap,
        nextReset: nextReset,
        serverTime: Math.floor(Date.now() / 1000)
    });
});

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

// 3. Frontend Polling Endpoint (Hybrid: In-Game Live Server + Offline Open Cloud DataStore)
app.get('/api/status/:userId', async (req, res) => {
    const userId = req.params.userId;
    const now = Date.now();
    let isGameServerRunning = false;
    let currentServerId = null;
    
    // Check if any Roblox game server is online
    for (const [serverId, serverData] of Object.entries(activeServers)) {
        if (now - serverData.lastSeen < 10000) {
            isGameServerRunning = true;
            currentServerId = serverId;
            break;
        } else {
            // Clean up stale servers
            delete activeServers[serverId];
        }
    }

    // Retrieve player data (Live Server if player is in-game, or Open Cloud if offline)
    const playerData = await getRobloxPlayerData(userId);
    const dailyData = await getDailyRewardData(userId);
    const stockData = await getPlayerStockData(userId);

    // Update player stats in leaderboard cache
    updateLeaderboardPlayer(userId, null, {
        coins: playerData.cash,
        highestWave: playerData.highestWave || (playerData.raw && playerData.raw.HighestWave) || 1,
        streak: (dailyData && dailyData.streak) || 1
    });
    
    res.status(200).json({
        isServerOnline: isGameServerRunning || true, // Website stays functional 24/7 via Open Cloud
        isGameServerRunning: isGameServerRunning,
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

// Endpoint: Global Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    let allPlayers = Object.values(inMemoryLeaderboard);

    if (mongoose.connection.readyState === 1) {
        try {
            const dbPlayers = await LeaderboardPlayer.find().lean();
            if (dbPlayers && dbPlayers.length > 0) {
                const map = { ...inMemoryLeaderboard };
                dbPlayers.forEach(p => { map[p.userId] = { ...map[p.userId], ...p }; });
                allPlayers = Object.values(map);
            }
        } catch (e) {
            console.error('[Leaderboard] Error querying MongoDB:', e);
        }
    }

    const topCoins = [...allPlayers]
        .sort((a, b) => (b.coins || 0) - (a.coins || 0))
        .slice(0, 20)
        .map((p, i) => ({ rank: i + 1, userId: p.userId, username: p.username, avatarUrl: p.avatarUrl, value: p.coins || 0 }));

    const topWaves = [...allPlayers]
        .sort((a, b) => (b.highestWave || 0) - (a.highestWave || 0))
        .slice(0, 20)
        .map((p, i) => ({ rank: i + 1, userId: p.userId, username: p.username, avatarUrl: p.avatarUrl, value: p.highestWave || 1 }));

    const topStreak = [...allPlayers]
        .sort((a, b) => (b.streak || 0) - (a.streak || 0))
        .slice(0, 20)
        .map((p, i) => ({ rank: i + 1, userId: p.userId, username: p.username, avatarUrl: p.avatarUrl, value: p.streak || 1 }));

    res.status(200).json({
        coins: topCoins,
        waves: topWaves,
        streak: topStreak
    });
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

app.post('/api/auction/bid', async (req, res) => {
    const { userId, username, bidAmount } = req.body;
    if (!userId || !bidAmount) return res.status(400).json({ error: 'Missing params' });

    // Validate if bid is high enough (must be at least currentBid + step)
    const baseBid = currentAuction.currentBid || currentAuction.startPrice;
    const minRequiredBid = baseBid + currentAuction.step;
    if (bidAmount < minRequiredBid) {
        return res.status(400).json({ error: `Bid is too low. Minimum required: ${minRequiredBid} 🪙.` });
    }

    // Check if player has the money (live in-game or Open Cloud DataStore)
    const bidderData = await getRobloxPlayerData(userId);
    if (bidderData.cash < bidAmount) {
        return res.status(400).json({ error: 'Not enough coins!' });
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
    const sellerData = await getRobloxPlayerData(sellerId);
    if (sellerData.cash < fee) {
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

    // Validate inventory: Unplaced items only
    const sellerInv = sellerData.inventory || {};
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

    // Deduct items and 5% fee from seller (In-Game queue or Open Cloud offline)
    if (sellerData.isOnline) {
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
    } else {
        // Offline: Deduct fee and items via Open Cloud
        if (sellerData.raw) {
            const raw = sellerData.raw;
            raw.Coins = Math.max(0, (raw.Coins || 0) - fee);
            raw.Inventory = raw.Inventory || {};
            for (const it of enrichedItems) {
                raw.Inventory[it.itemKey] = Math.max(0, (raw.Inventory[it.itemKey] || 0) - it.quantity);
            }
            await saveRobloxPlayerData(sellerId, raw);
        }
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

    // Verify buyer cash (Live Server or Open Cloud)
    const buyerData = await getRobloxPlayerData(buyerId);
    if (buyerData.cash < offer.price) {
        return res.status(400).json({ error: `Not enough coins! You need ${offer.price} 🪙.` });
    }

    // Mark offer as SOLD
    offer.status = 'SOLD';
    if (mongoose.connection.readyState === 1) {
        await MarketplaceOffer.updateOne({ offerId }, { status: 'SOLD' });
    }

    // Delivery: If a server is running, dispatch live action; otherwise update via Open Cloud
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
    } else {
        // Offline Open Cloud delivery
        // 1. Buyer: deduct price, add items
        if (buyerData.raw) {
            const bRaw = buyerData.raw;
            bRaw.Coins = Math.max(0, (bRaw.Coins || 0) - offer.price);
            bRaw.Inventory = bRaw.Inventory || {};
            for (const it of offer.items) {
                bRaw.Inventory[it.itemKey] = (bRaw.Inventory[it.itemKey] || 0) + (it.quantity || 1);
            }
            await saveRobloxPlayerData(buyerId, bRaw);
        }

        // 2. Seller: credit sellerPayout
        const sellerData = await getRobloxPlayerData(offer.sellerId);
        if (sellerData.raw) {
            const sRaw = sellerData.raw;
            sRaw.Coins = (sRaw.Coins || 0) + offer.sellerPayout;
            await saveRobloxPlayerData(offer.sellerId, sRaw);
        }
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
    } else {
        // Return items offline via Open Cloud
        const sellerData = await getRobloxPlayerData(userId);
        if (sellerData.raw) {
            const raw = sellerData.raw;
            raw.Inventory = raw.Inventory || {};
            for (const it of offer.items) {
                raw.Inventory[it.itemKey] = (raw.Inventory[it.itemKey] || 0) + (it.quantity || 1);
            }
            await saveRobloxPlayerData(userId, raw);
        }
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
    if (!userId || !itemKey) return res.status(400).json({ error: 'Missing params' });
    const qty = quantity || 1;

    // 1. If live game server is online and registered, route through live server
    if (serverId && activeServers[serverId]) {
        const actionId = 'act_' + Math.random().toString(36).substr(2, 9);
        if (!actionQueues[serverId]) actionQueues[serverId] = [];
        actionQueues[serverId].push({ actionId, action: 'BUY', userId, itemKey, quantity: qty });

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
        actionQueues[serverId] = actionQueues[serverId].filter(a => a.actionId !== actionId);
        return res.status(504).json({ success: false, message: 'Roblox server timed out' });
    }

    // 2. OFFLINE: Process item shop purchase directly via Open Cloud
    let itemConfig = null;
    for (const cat in gameConfigs) {
        if (gameConfigs[cat][itemKey]) {
            itemConfig = gameConfigs[cat][itemKey];
            break;
        }
    }
    if (!itemConfig) return res.status(400).json({ error: 'Item not found in catalog' });

    const price = itemConfig.Price || 0;
    const totalCost = price * qty;

    const buyerData = await getRobloxPlayerData(userId);
    if (buyerData.cash < totalCost) {
        return res.status(400).json({ success: false, message: 'Not enough coins!' });
    }

    const stockMap = await getPlayerStockData(userId);
    const availableStock = stockMap[itemKey] !== undefined ? stockMap[itemKey] : 0;
    if (availableStock < qty) {
        return res.status(400).json({ success: false, message: 'Out of stock!' });
    }

    // Deduct coins & add items to player's DataStore
    if (buyerData.raw) {
        buyerData.raw.Coins = Math.max(0, (buyerData.raw.Coins || 0) - totalCost);
        buyerData.raw.Inventory = buyerData.raw.Inventory || {};
        buyerData.raw.Inventory[itemKey] = (buyerData.raw.Inventory[itemKey] || 0) + qty;
        await saveRobloxPlayerData(userId, buyerData.raw);
    }

    // Record purchase in ItemShopPurchases_v5
    const epoch = getStockEpoch();
    const purchases = await getOfflinePlayerPurchases(userId);
    purchases[itemKey] = (purchases[itemKey] || 0) + qty;
    await saveOpenCloudStore('ItemShopPurchases_v5', `ISP_${userId}`, { e: epoch, p: purchases });

    const newStock = Math.max(0, availableStock - qty);
    console.log(`[ItemShop] Offline purchase: ${userId} bought ${qty}x ${itemKey} for ${totalCost} Coins. New stock: ${newStock}`);
    return res.status(200).json({
        success: true,
        message: `Successfully bought ${qty}x ${itemConfig.DisplayName || itemKey}!`,
        newStock: newStock
    });
});

app.post('/api/claimDailyReward', async (req, res) => {
    const { serverId, userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing params' });

    // 1. If live server is active, route through it
    if (serverId && activeServers[serverId]) {
        const actionId = 'claim_' + Math.random().toString(36).substr(2, 9);
        if (!actionQueues[serverId]) actionQueues[serverId] = [];
        actionQueues[serverId].push({ actionId, action: 'CLAIM_DAILY', userId });

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
        actionQueues[serverId] = actionQueues[serverId].filter(a => a.actionId !== actionId);
        return res.status(504).json({ success: false, message: 'Roblox server timed out' });
    }

    // 2. OFFLINE: Claim daily reward directly via Open Cloud
    const entryKey = `Player_${userId}`;
    let data = { Streak: 1, LastClaimTime: 0, HasThreeSpeed: false };
    try {
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=DailyRewardsStore_v2&entryKey=${encodeURIComponent(entryKey)}`;
        const resDs = await fetch(url, { headers: { 'x-api-key': ROBLOX_OPENCLOUD_API_KEY } });
        if (resDs.ok) {
            data = await resDs.json();
        }
    } catch (e) {
        console.error('[OpenCloud] Error fetching DailyRewardsStore_v2:', e);
    }

    const now = Math.floor(Date.now() / 1000);
    const lastClaim = Number(data.LastClaimTime) || 0;
    const canClaim = (lastClaim === 0) || (now - lastClaim >= 86400);

    if (!canClaim) {
        const remaining = 86400 - (now - lastClaim);
        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        return res.status(400).json({ success: false, message: `Please wait ${hours}h ${mins}m before claiming.` });
    }

    const currentStreak = Number(data.Streak) || 1;
    let rewardDesc = "";
    let coinsAwarded = 0;

    if (currentStreak === 1) {
        coinsAwarded = 1000;
        rewardDesc = "1,000 Coins";
    } else if (currentStreak === 2) {
        rewardDesc = "Medium Coins Potion";
    } else if (currentStreak === 3) {
        rewardDesc = "Medium Shards Potion";
    } else if (currentStreak === 4) {
        data.HasThreeSpeed = true;
        rewardDesc = "Unlock x3 GameSpeed";
    } else if (currentStreak === 5) {
        rewardDesc = "Medium Damage Potion";
    } else if (currentStreak === 6) {
        coinsAwarded = 25000;
        rewardDesc = "25,000 Coins";
    } else if (currentStreak === 7) {
        rewardDesc = "Medium Coins, Shards & Damage Potions";
    } else {
        coinsAwarded = Math.floor(Math.random() * 4001) + 1000;
        rewardDesc = `${coinsAwarded.toLocaleString('de-DE')} Coins`;
    }

    data.LastClaimTime = now;
    data.Streak = currentStreak < 7 ? currentStreak + 1 : 8;

    // Save DailyRewardsStore_v2
    await saveOpenCloudStore("DailyRewardsStore_v2", entryKey, data);
    delete offlineDailyCache[userId];

    // Award coins if applicable
    if (coinsAwarded > 0) {
        const pData = await getRobloxPlayerData(userId);
        if (pData.raw) {
            pData.raw.Coins = (pData.raw.Coins || 0) + coinsAwarded;
            await saveRobloxPlayerData(userId, pData.raw);
        }
    }

    console.log(`[DailyRewards] Offline claim for ${userId}: Streak ${currentStreak} -> ${data.Streak}, Reward: ${rewardDesc}`);
    return res.status(200).json({
        success: true,
        message: "Claimed " + rewardDesc,
        reward: rewardDesc,
        newStreak: data.Streak,
        lastClaimTime: now,
        coinsAwarded: coinsAwarded
    });
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

        updateLeaderboardPlayer(userData.userId, userData.username, {
            avatarUrl: avatarUrl
        });

        res.status(200).json({ success: true, user: { ...userData, avatarUrl: avatarUrl } });
    } else {
        res.status(401).json({ success: false, error: 'Code not found. You must be in-game to connect!' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`[Backend] Web server is running on http://localhost:${PORT}`);
});
