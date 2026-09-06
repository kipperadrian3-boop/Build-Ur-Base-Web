const mongoose = require('mongoose');

// Player Base & Building Stats (Max 5 Info Fields)
const playerBaseStatsSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    totalPlacedBlocks: { type: Number, default: 0 },    // 1. Anzahl aktuell platzierter Bausteine
    maxBaseHeight: { type: Number, default: 0 },        // 2. Höchste erreichte Y-Koordinate
    uniqueItemTypesUsed: { type: Number, default: 0 },  // 3. Verschiedene verbaute Item-Typen
    baseComplexityScore: { type: Number, default: 0 },  // 4. Komplexitäts-Wert der Base
    lastBaseSavedAt: { type: Date, default: Date.now }  // 5. Letzter Speicherzeitpunkt der Base
}, { timestamps: true });

module.exports = mongoose.model('PlayerBaseStats', playerBaseStatsSchema);
