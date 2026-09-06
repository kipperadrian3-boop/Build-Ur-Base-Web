const mongoose = require('mongoose');

// Player Economy & Financial Tracking (Max 5 Info Fields)
const playerEconomySchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    netWorthEstimate: { type: Number, default: 0 },         // 1. Geschätztes Gesamtvermögen (Coins + Items)
    peakCoinsRecorded: { type: Number, default: 0 },        // 2. Höchster je gemessener Münzstand
    totalWebExpenditure: { type: Number, default: 0 },      // 3. Gesamtausgaben über die Website
    totalWebEarnings: { type: Number, default: 0 },         // 4. Gesamteinnahmen über die Website
    lastFinancialSyncAt: { type: Date, default: Date.now }  // 5. Letzter Wirtschafts-Abgleich
}, { timestamps: true });

module.exports = mongoose.model('PlayerEconomy', playerEconomySchema);
