const mongoose = require('mongoose');

// Player Roblox Web-Code Tracking (Max 5 Info Fields)
const playerCodeSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    code: { type: String, required: true, index: true },    // 1. Der 16-stellige Roblox Web-Code
    username: { type: String, default: '' },                // 2. Roblox Username
    totalLoginsWithCode: { type: Number, default: 0 },      // 3. Wie oft dieser Code zum Login genutzt wurde
    registeredAt: { type: Date, default: Date.now },        // 4. Wann der Code von Roblox registriert wurde
    lastUsedAt: { type: Date, default: Date.now }           // 5. Zuletzt verwendet am
}, { timestamps: true });

module.exports = mongoose.model('PlayerCode', playerCodeSchema);
