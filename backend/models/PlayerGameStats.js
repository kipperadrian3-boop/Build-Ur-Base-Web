const mongoose = require('mongoose');

// Player Mini-Games (Minesweeper) Stats (Max 5 Info Fields)
const playerGameStatsSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    minesweeperPlayed: { type: Number, default: 0 },        // 1. Spiele absolviert
    minesweeperWon: { type: Number, default: 0 },           // 2. Spiele gewonnen
    coinsEarned: { type: Number, default: 0 },              // 3. Durch Spiele verdiente Münzen
    winRatePercent: { type: Number, default: 0 },           // 4. Siegquote in %
    lastPlayedAt: { type: Date }                            // 5. Zuletzt gespielt am
}, { timestamps: true });

module.exports = mongoose.model('PlayerGameStats', playerGameStatsSchema);
