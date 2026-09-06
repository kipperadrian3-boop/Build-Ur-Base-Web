const mongoose = require('mongoose');

// Player Inventory & Base Block Summary (Max 5 Info Fields)
const playerInventorySummarySchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    totalBlocks: { type: Number, default: 0 },              // 1. Anzahl Baublöcke im Inventar
    totalChests: { type: Number, default: 0 },              // 2. Anzahl Kisten im Inventar
    totalDoorsAndDecor: { type: Number, default: 0 },       // 3. Anzahl Türen & Deko
    totalDefenses: { type: Number, default: 0 },            // 4. Anzahl Geschütze / Turrets
    totalPotions: { type: Number, default: 0 }              // 5. Anzahl Tränke
}, { timestamps: true });

module.exports = mongoose.model('PlayerInventorySummary', playerInventorySummarySchema);
