// Deterministic item shop stock calculation
const state = require('./state');
const { getOfflinePlayerPurchases } = require('./opencloud');

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

async function getPlayerStockData(userId) {
    // 1. Live server check
    for (const server of Object.values(state.activeServers)) {
        if (server.players && server.players[userId] && server.players[userId].stock) {
            return server.players[userId].stock;
        }
    }

    // 2. Offline deterministic stock calculation
    const epoch = getStockEpoch();
    const purchases = await getOfflinePlayerPurchases(userId);
    const stockMap = {};
    const gameConfigs = state.gameConfigs;

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

module.exports = {
    getStockEpoch,
    hashString,
    calculateItemStock,
    getPlayerStockData
};
