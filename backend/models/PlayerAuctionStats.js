const mongoose = require('mongoose');

// Player Live-Auction Stats (Max 5 Info Fields)
const playerAuctionStatsSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    totalBidsPlaced: { type: Number, default: 0 },          // 1. Platzierte Gebote
    totalAuctionsWon: { type: Number, default: 0 },         // 2. Gewonnene Auktionen
    totalCoinsSpent: { type: Number, default: 0 },          // 3. Gesamtausgaben in Auktionen
    highestSingleBid: { type: Number, default: 0 },         // 4. Höchstes einzelnes Gebot
    lastBidAt: { type: Date }                               // 5. Zeitpunkt des letzten Gebots
}, { timestamps: true });

module.exports = mongoose.model('PlayerAuctionStats', playerAuctionStatsSchema);
