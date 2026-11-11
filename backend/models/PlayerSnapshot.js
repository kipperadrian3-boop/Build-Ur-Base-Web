const mongoose = require('mongoose');

// Last known player data, sent by the game in every heartbeat.
// Lets the website show coins / inventory / daily while the player is offline
// (no Open Cloud API key needed).
const playerSnapshotSchema = new mongoose.Schema({
    userId: { type: String, index: true, unique: true },
    cash: Number,
    inventory: { type: Object, default: {} },
    dailyReward: { type: Object, default: null },
    stock: { type: Object, default: {} },
    stockEpoch: Number,
    updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

module.exports = mongoose.model('PlayerSnapshot', playerSnapshotSchema);
