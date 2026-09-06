const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    robloxUserId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
});

// TTL index: auto-delete logs older than 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
