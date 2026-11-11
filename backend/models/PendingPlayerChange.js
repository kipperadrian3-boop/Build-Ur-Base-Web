const mongoose = require('mongoose');

// Change for an offline player that could not be delivered yet (no game server running).
// Delivered to the next game server that polls for actions (action "APPLY_DELTA").
const pendingPlayerChangeSchema = new mongoose.Schema({
    actionId: String,
    userId: String,
    coins: Number,                                  // coin delta
    inventory: { type: Object, default: {} },       // { itemKey: delta }
    purchases: { type: Object, default: {} },       // { itemKey: qty } shop purchases this stock epoch
    purchaseEpoch: Number,
    createdAt: { type: Date, default: Date.now }
}, { minimize: false });

module.exports = mongoose.model('PendingPlayerChange', pendingPlayerChangeSchema);
