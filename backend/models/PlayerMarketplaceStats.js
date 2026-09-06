const mongoose = require('mongoose');

// Player Marketplace (Sell & Buy) Stats (Max 5 Info Fields)
const playerMarketplaceStatsSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    offersCreated: { type: Number, default: 0 },            // 1. Erstellte Angebote
    offersSold: { type: Number, default: 0 },               // 2. Erfolgreich verkauft
    offersBought: { type: Number, default: 0 },             // 3. Von anderen gekauft
    coinsEarned: { type: Number, default: 0 },              // 4. Verdiente Münzen durch Verkäufe
    coinsSpent: { type: Number, default: 0 }                // 5. Ausgegebene Münzen beim Kaufen
}, { timestamps: true });

module.exports = mongoose.model('PlayerMarketplaceStats', playerMarketplaceStatsSchema);
