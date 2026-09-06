const mongoose = require('mongoose');

// Player Item-Shop Stats (Max 5 Info Fields)
const playerShopStatsSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    totalItemsBought: { type: Number, default: 0 },         // 1. Gesamtzahl gekaufter Items
    totalCoinsSpent: { type: Number, default: 0 },          // 2. Gesamtausgaben im Shop
    lastPurchasedItem: { type: String, default: '' },       // 3. Zuletzt gekauftes Item
    lastPurchaseAt: { type: Date },                         // 4. Zeitpunkt des letzten Kaufs
    favoriteCategory: { type: String, default: 'Blocks' }   // 5. Bevorzugte Item-Kategorie
}, { timestamps: true });

module.exports = mongoose.model('PlayerShopStats', playerShopStatsSchema);
