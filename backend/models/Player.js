const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },

    // Login Tracking
    firstLoginAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: Date.now },
    totalLogins: { type: Number, default: 0 },

    // Session Tracking
    lastSeenAt: { type: Date, default: Date.now },

    // Shop Stats
    totalShopPurchases: { type: Number, default: 0 },
    totalShopSpent: { type: Number, default: 0 },

    // Auction Stats
    totalAuctionBids: { type: Number, default: 0 },
    totalAuctionWins: { type: Number, default: 0 },
    totalAuctionSpent: { type: Number, default: 0 },

    // Marketplace Stats
    totalOffersCreated: { type: Number, default: 0 },
    totalOffersSold: { type: Number, default: 0 },
    totalOffersCancelled: { type: Number, default: 0 },
    totalMarketplaceBought: { type: Number, default: 0 },
    totalMarketplaceEarned: { type: Number, default: 0 },
    totalMarketplaceSpent: { type: Number, default: 0 },

    // Game Stats
    totalGamesPlayed: { type: Number, default: 0 },
    totalGamesWon: { type: Number, default: 0 },
    totalGameCoinsEarned: { type: Number, default: 0 },
}, {
    timestamps: true // adds createdAt, updatedAt
});

module.exports = mongoose.model('Player', playerSchema);
