const mongoose = require('mongoose');

const marketplaceOfferSchema = new mongoose.Schema({
    offerId: { type: String, required: true, unique: true },
    sellerId: { type: String, required: true },
    sellerName: { type: String, required: true },
    sellerAvatar: { type: String, default: '' },
    items: [{
        itemKey: String,
        category: String,
        displayName: String,
        imageUrl: String,
        quantity: Number
    }],
    sellerPayout: { type: Number, required: true },
    price: { type: Number, required: true },
    fee: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, default: 'ACTIVE' }
});

module.exports = mongoose.model('MarketplaceOffer', marketplaceOfferSchema);
