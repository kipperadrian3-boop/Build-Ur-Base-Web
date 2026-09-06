const mongoose = require('mongoose');

const gameRewardSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, index: true },
    hourKey: { type: String, required: true },    // e.g. "2026_9_6_14"
    earned: { type: Number, default: 0 },
    maxPerHour: { type: Number, default: 1000 },
    updatedAt: { type: Date, default: Date.now }
});

// Compound unique index
gameRewardSchema.index({ robloxUserId: 1, hourKey: 1 }, { unique: true });

// TTL: auto-delete after 24 hours
gameRewardSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('GameReward', gameRewardSchema);
