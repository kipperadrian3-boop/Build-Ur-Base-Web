// Roblox Open Cloud API helpers for DataStore access
const crypto = require('crypto');
const state = require('./state');

const ROBLOX_OPENCLOUD_API_KEY = process.env.ROBLOX_OPENCLOUD_API_KEY || "9I06qJ0uGUWTIbGfl3TCupVrdm0pBy+7aVIEPkpYy9HHILbGZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SWpsSk1EWnhTakIxUjFWWFZFbGlSMlpzTTFSRGRYQldjbVJ0TUhCQ2VTczNZVlpKUlZCcmNGbDVPVWhJU1V4aVJ5SXNJbTkzYm1WeVNXUWlPaUl4TURVek1ETTRNRFV4T0NJc0ltVjRjQ0k2TVRjNE9EWTBNek0wTlN3aWFXRjBJam94TnpnNE5qTTVOelExTENKdVltWWlPakUzT0RnMk16azNORFY5LmwzTDFiTENtbTBGOGMxdWFQcjVBQzNFSWNacHZrZzlKOVh2OC1abmR2bXBFQVRzbW9EcDZtdDk1UndUb3hNbm42YlRCYVdYNjF3M2dqV3pKN1kzdllQVF9fNUZxS2hqUXgyM3FHcnhpaHItTC05WkRTZExscUctTm1QTWV2S3E4M3d5RmFkNmF6eWJBb1V2V2tzYTJLNHRYZzNjQm1jNWNYS3ptYnlHTlg3VWhwdVItOG03VUZQbG9DSV92ZTNEODFFcHh4Q3c3UHowOHBGNEthcXFsWHpaQ0hhTzBmWGp5OEN1VWxsMjliYVpIajAyN3kxNjZvSG1HcEdFaVdoRnlfWFRxNUJyamdNSVJqWmZtODJmSmsxLUNOS2VfVDBuSlFQX241YVpVTXllNExPRE1ndUpZLTRNa0JKdVBULVZQVlpfWG43b3hqRGJ4SC1OR2dBakNCUQ==";
const ROBLOX_UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID || "10216403339";

// Caches to avoid Roblox DataStore rate limits
const offlinePlayerCache = {};  // { [userId]: { data, timestamp } }
const offlineDailyCache = {};   // { [userId]: { data, timestamp } }

// ---- Player Data ----

async function getRobloxPlayerData(userId) {
    if (!userId) return { isOnline: false, cash: 0, stock: {}, inventory: {}, dailyReward: null, raw: null };

    // 1. Check live Roblox servers
    for (const server of Object.values(state.activeServers)) {
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

    // 2. Memory cache (15s TTL)
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

    // 3. Open Cloud DataStore
    try {
        const entryKey = `Player_${userId}`;
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=BuildUrBase_PlayerData_v9&entryKey=${encodeURIComponent(entryKey)}`;
        const res = await fetch(url, {
            headers: { 'x-api-key': ROBLOX_OPENCLOUD_API_KEY }
        });

        if (res.ok) {
            const rawData = await res.json();
            offlinePlayerCache[userId] = { data: rawData, timestamp: Date.now() };
            console.log(`[OpenCloud] Fetched DataStore for ${userId}: ${rawData.Coins} Coins, ${Object.keys(rawData.Inventory || {}).length} inv items`);
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

    // Fallback to older cache
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

    return { isOnline: false, cash: 0, stock: {}, inventory: {}, dailyReward: null, raw: null };
}

// ---- Save to DataStore ----

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
        offlinePlayerCache[userId] = { data: rawData, timestamp: Date.now() };
        console.log(`[OpenCloud] Saved DataStore for Player_${userId}`);
    }
    return ok;
}

// ---- Daily Rewards ----

async function getDailyRewardData(userId) {
    if (!userId) return null;

    // 1. Live server
    for (const server of Object.values(state.activeServers)) {
        if (server.players && server.players[userId] && server.players[userId].dailyReward) {
            return server.players[userId].dailyReward;
        }
    }

    // 2. Memory cache (10s TTL)
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
            canClaim, remainingSeconds: remaining,
            hasThreeSpeed: data.HasThreeSpeed === true
        };
    }

    // 3. Open Cloud fetch
    try {
        const entryKey = `Player_${userId}`;
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=DailyRewardsStore_v2&entryKey=${encodeURIComponent(entryKey)}`;
        const res = await fetch(url, { headers: { 'x-api-key': ROBLOX_OPENCLOUD_API_KEY } });
        if (res.ok) {
            const data = await res.json();
            offlineDailyCache[userId] = { data, timestamp: Date.now() };
            const now = Math.floor(Date.now() / 1000);
            const lastClaim = Number(data.LastClaimTime) || 0;
            const canClaim = (lastClaim === 0) || (now - lastClaim >= 86400);
            const remaining = canClaim ? 0 : Math.max(0, 86400 - (now - lastClaim));
            return {
                streak: Number(data.Streak) || 1,
                lastClaimTime: lastClaim,
                canClaim, remainingSeconds: remaining,
                hasThreeSpeed: data.HasThreeSpeed === true
            };
        }
    } catch (e) {
        console.error('[OpenCloud] Error fetching DailyRewardsStore_v2:', e);
    }

    return { streak: 1, lastClaimTime: 0, canClaim: true, remainingSeconds: 0, hasThreeSpeed: false };
}

function clearDailyCache(userId) {
    delete offlineDailyCache[userId];
}

// ---- Offline Player Purchases ----

async function getOfflinePlayerPurchases(userId) {
    const { getStockEpoch } = require('./stock');
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

module.exports = {
    getRobloxPlayerData,
    saveOpenCloudStore,
    saveRobloxPlayerData,
    getDailyRewardData,
    clearDailyCache,
    getOfflinePlayerPurchases,
    ROBLOX_OPENCLOUD_API_KEY,
    ROBLOX_UNIVERSE_ID
};
