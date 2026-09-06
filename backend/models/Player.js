const mongoose = require('mongoose');

// Player Core Identity (Max 5 Info Fields)
const playerSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },            // 1. Roblox Benutzername
    avatarUrl: { type: String, default: '' },           // 2. Avatar Bild URL
    firstSeen: { type: Date, default: Date.now },       // 3. Erstkontakt mit dem System
    lastSeen: { type: Date, default: Date.now }         // 4. Letzte Aktivität
    // (5. robloxUserId dient als Identifier)
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);
