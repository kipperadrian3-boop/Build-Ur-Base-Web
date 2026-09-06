// Shared in-memory state used across all route modules

module.exports = {
    // Live Roblox game servers: { serverId: { lastSeen: Date.now(), players: { "userId": { cash, stock, inventory, dailyReward } } } }
    activeServers: {},

    // Registered login codes: { code: { username, userId } }
    codesDB: {},

    // Game item configurations loaded from configs.json
    gameConfigs: {},

    // 2-way action sync with Roblox servers
    actionQueues: {},    // { serverId: [ { actionId, action, userId, ... } ] }
    actionResults: {},   // { actionId: { success, message, ... } }

    // In-memory fallback for marketplace offers (when MongoDB is offline)
    inMemoryMarketplaceOffers: [],
};
