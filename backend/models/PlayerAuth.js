const mongoose = require('mongoose');

// Player Auth & Login Info (Max 5 Info Fields)
const playerAuthSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    lastLoginCode: { type: String, default: '' },       // 1. Web-Code vom Roblox Spiel
    firstLoginAt: { type: Date, default: Date.now },    // 2. Erster Website-Login
    lastLoginAt: { type: Date, default: Date.now },     // 3. Letzter Website-Login
    avatarUrl: { type: String, default: '' }            // 4. Roblox Avatar Headshot URL
    // (5. robloxUserId dient als Account-ID)
}, { timestamps: true });

module.exports = mongoose.model('PlayerAuth', playerAuthSchema);
