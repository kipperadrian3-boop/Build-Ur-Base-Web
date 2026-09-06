const mongoose = require('mongoose');

const pendingAuctionSchema = new mongoose.Schema({
    userId: String,
    itemKey: String,
    quantity: Number,
    cost: Number,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PendingAuction', pendingAuctionSchema);
