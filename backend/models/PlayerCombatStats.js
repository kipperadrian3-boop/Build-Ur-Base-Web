const mongoose = require('mongoose');

// Player Combat & Wave Stats (Max 5 Info Fields)
const playerCombatStatsSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    highestWaveCleared: { type: Number, default: 1 },       // 1. Höchste geschlagene Welle
    selectedWaveCheckpoint: { type: Number, default: 1 },   // 2. Aktuell gewählter Checkpoint
    autoWaveEnabled: { type: Boolean, default: false },     // 3. Auto-Wave aktiv
    activePotionsCount: { type: Number, default: 0 },       // 4. Anzahl aktiver Tränke/Buffs
    defensePowerEstimate: { type: Number, default: 0 }      // 5. Geschätzte Verteidigungskraft
}, { timestamps: true });

module.exports = mongoose.model('PlayerCombatStats', playerCombatStatsSchema);
