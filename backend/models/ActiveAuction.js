const mongoose = require('mongoose');

// Active Live Auction Persistence (Max 5 Info Fields)
const activeAuctionSchema = new mongoose.Schema({
    auctionId: { type: String, required: true, unique: true, index: true },
    itemKey: { type: String, required: true },          // 1. Name/Key des Items
    qty: { type: Number, default: 1 },                  // 2. Auktions-Menge
    currentBid: { type: Number, default: 0 },           // 3. Aktuelles Höchstgebot
    highestBidderId: { type: String, default: null },   // 4. UserID des Höchstbietenden
    endTime: { type: Number, required: true }           // 5. Endzeitpunkt (Timestamp ms)
}, { timestamps: true });

module.exports = mongoose.model('ActiveAuction', activeAuctionSchema);
