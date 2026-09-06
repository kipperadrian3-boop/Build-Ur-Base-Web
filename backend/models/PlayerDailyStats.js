const mongoose = require('mongoose');

// Player Daily Rewards & Streak Info (Max 5 Info Fields)
const playerDailyStatsSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    currentStreak: { type: Number, default: 1 },            // 1. Aktueller Daily Streak
    highestStreak: { type: Number, default: 1 },            // 2. Höchster erreichter Streak
    totalClaims: { type: Number, default: 0 },              // 3. Wie oft Belohnung abgeholt
    lastClaimAt: { type: Date },                            // 4. Zeitpunkt der letzten Abholung
    bonusCoinsClaimed: { type: Number, default: 0 }         // 5. Erhaltene Bonus-Münzen (ab Tag 7+)
}, { timestamps: true });

module.exports = mongoose.model('PlayerDailyStats', playerDailyStatsSchema);
