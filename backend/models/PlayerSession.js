const mongoose = require('mongoose');

// Player Session & Presence Info (Max 5 Info Fields)
const playerSessionSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, unique: true, index: true },
    totalLogins: { type: Number, default: 1 },          // 1. Wie oft eingeloggt
    lastSeenAt: { type: Date, default: Date.now },      // 2. Letzte Aktivität / Heartbeat
    lastIP: { type: String, default: '' },              // 3. Letzte IP-Adresse
    deviceType: { type: String, default: 'Desktop' },   // 4. Gerätetyp (Desktop/Mobile)
    isOnline: { type: Boolean, default: true }          // 5. Online-Status
}, { timestamps: true });

module.exports = mongoose.model('PlayerSession', playerSessionSchema);
