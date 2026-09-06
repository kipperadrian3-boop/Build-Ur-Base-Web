const mongoose = require('mongoose');

// Player Web Usage & Navigation Activity (Max 5 Info Fields)
const playerWebActivitySchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    totalPageViews: { type: Number, default: 0 },           // 1. Gesamte Seitenaufrufe / Polls
    lastActiveTab: { type: String, default: 'dashboard' },  // 2. Zuletzt genutzter Bereich (shop/auction/etc)
    lastActiveAt: { type: Date, default: Date.now },        // 3. Letzte Server-Interaktion
    totalActionsPerformed: { type: Number, default: 0 },    // 4. Gesamte ausgeführte Aktionen auf der Website
    preferredLanguage: { type: String, default: 'de' }      // 5. Browser Sprache
}, { timestamps: true });

module.exports = mongoose.model('PlayerWebActivity', playerWebActivitySchema);
