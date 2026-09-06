const mongoose = require('mongoose');

// Player Game Progression in Roblox (Max 5 Info Fields)
const playerProgressionSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    coins: { type: Number, default: 0 },                    // 1. Aktueller Münzstand
    highestWave: { type: Number, default: 1 },              // 2. Höchste erreichte Welle
    shards: { type: Number, default: 0 },                   // 3. Aktuelle Scherben
    tutorialCompleted: { type: Boolean, default: false },   // 4. Tutorial abgeschlossen
    gameSpeed: { type: Number, default: 1 }                 // 5. Spielgeschwindigkeit (z.B. x3)
}, { timestamps: true });

module.exports = mongoose.model('PlayerProgression', playerProgressionSchema);
