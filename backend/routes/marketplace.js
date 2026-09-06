const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const state = require('../state');
const { getRobloxPlayerData, saveRobloxPlayerData } = require('../opencloud');
const MarketplaceOffer = require('../models/MarketplaceOffer');
const Player = require('../models/Player');
const ActivityLog = require('../models/ActivityLog');

// Get all active offers
router.get('/offers', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const offers = await MarketplaceOffer.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).limit(60);
            return res.status(200).json({ success: true, offers });
        }
        res.status(200).json({ success: true, offers: state.inMemoryMarketplaceOffers.filter(o => o.status === 'ACTIVE') });
    } catch (err) {
        console.error('[Marketplace] Error fetching offers:', err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Create an offer
router.post('/createOffer', async (req, res) => {
    const { sellerId, sellerName, sellerAvatar, items, sellerPayout } = req.body;
    if (!sellerId || !sellerName || !items || !Array.isArray(items) || items.length === 0 || !sellerPayout) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const payoutNum = parseInt(sellerPayout, 10);
    if (isNaN(payoutNum) || payoutNum <= 0) return res.status(400).json({ error: 'Price must be greater than 0.' });

    const fee = Math.ceil(payoutNum * 0.05);
    const finalPrice = payoutNum;

    const sellerData = await getRobloxPlayerData(sellerId);
    if (sellerData.cash < fee) return res.status(400).json({ error: `You need at least ${fee} 🪙 for the 5% fee!` });

    // Forbid Chests
    for (const it of items) {
        const isChest = (it.category && it.category.toLowerCase() === 'chests')
            || (it.itemKey && it.itemKey.toLowerCase().includes('chest'))
            || (it.displayName && it.displayName.toLowerCase().includes('chest'));
        if (isChest) return res.status(400).json({ error: 'Chests cannot be traded!' });
    }

    // Validate inventory
    const sellerInv = sellerData.inventory || {};
    for (const it of items) {
        if ((sellerInv[it.itemKey] || 0) < it.quantity) {
            return res.status(400).json({ error: `Not enough ${it.displayName || it.itemKey} in inventory!` });
        }
    }

    // Enrich items
    const gameConfigs = state.gameConfigs;
    const enrichedItems = items.map(it => {
        let cat = it.category || 'Blocks', disp = it.displayName || it.itemKey, img = it.imageUrl || '';
        if (gameConfigs) {
            for (const c in gameConfigs) {
                if (gameConfigs[c][it.itemKey]) {
                    cat = c; disp = gameConfigs[c][it.itemKey].DisplayName || disp;
                    img = gameConfigs[c][it.itemKey].imageUrl || img; break;
                }
            }
        }
        return { itemKey: it.itemKey, category: cat, displayName: disp, imageUrl: img, quantity: it.quantity };
    });

    const offerId = 'off_' + Math.random().toString(36).substr(2, 9);
    const offerDoc = {
        offerId, sellerId, sellerName, sellerAvatar: sellerAvatar || '',
        items: enrichedItems, sellerPayout: payoutNum, price: finalPrice, fee,
        createdAt: new Date(), status: 'ACTIVE'
    };

    // Deduct items/fee
    if (sellerData.isOnline) {
        const sids = Object.keys(state.activeServers);
        if (sids.length > 0) {
            if (!state.actionQueues[sids[0]]) state.actionQueues[sids[0]] = [];
            state.actionQueues[sids[0]].push({
                actionId: 'mkt_deduct_' + Math.random().toString(36).substr(2, 9),
                action: 'MARKETPLACE_DEDUCT_ITEMS', userId: sellerId, items: enrichedItems, fee
            });
        }
    } else if (sellerData.raw) {
        const raw = sellerData.raw;
        raw.Coins = Math.max(0, (raw.Coins || 0) - fee);
        raw.Inventory = raw.Inventory || {};
        for (const it of enrichedItems) {
            raw.Inventory[it.itemKey] = Math.max(0, (raw.Inventory[it.itemKey] || 0) - it.quantity);
        }
        await saveRobloxPlayerData(sellerId, raw);
    }

    if (mongoose.connection.readyState === 1) {
        try { await new MarketplaceOffer(offerDoc).save(); } catch (err) { console.error('[Marketplace] Save error:', err); }
    }
    state.inMemoryMarketplaceOffers.unshift(offerDoc);

    // Track
    try {
        const tracking = require('../tracking');
        tracking.trackMarketplaceCreate(sellerId, offerId, fee);
    } catch (e) { console.error('[Marketplace] Track error:', e); }

    console.log(`[Marketplace] ${sellerName} created ${offerId} at ${finalPrice} 🪙 (Fee: ${fee}).`);
    res.status(200).json({ success: true, offer: offerDoc });
});

// Buy an offer
router.post('/buyOffer', async (req, res) => {
    const { buyerId, buyerName, offerId } = req.body;
    if (!buyerId || !buyerName || !offerId) return res.status(400).json({ error: 'Missing parameters' });

    let offer = null;
    if (mongoose.connection.readyState === 1) {
        offer = await MarketplaceOffer.findOne({ offerId, status: 'ACTIVE' });
    }
    if (!offer) offer = state.inMemoryMarketplaceOffers.find(o => o.offerId === offerId && o.status === 'ACTIVE');
    if (!offer) return res.status(404).json({ error: 'Offer not found or already sold!' });
    if (offer.sellerId === buyerId) return res.status(400).json({ error: 'You cannot buy your own offer!' });

    const buyerData = await getRobloxPlayerData(buyerId);
    if (buyerData.cash < offer.price) return res.status(400).json({ error: `Not enough coins! Need ${offer.price} 🪙.` });

    offer.status = 'SOLD';
    if (mongoose.connection.readyState === 1) await MarketplaceOffer.updateOne({ offerId }, { status: 'SOLD' });

    const sids = Object.keys(state.activeServers);
    if (sids.length > 0) {
        if (!state.actionQueues[sids[0]]) state.actionQueues[sids[0]] = [];
        state.actionQueues[sids[0]].push({
            actionId: 'mkt_deliver_' + Math.random().toString(36).substr(2, 9),
            action: 'MARKETPLACE_DELIVER_SALE', buyerId, sellerId: offer.sellerId,
            items: offer.items, price: offer.price, sellerPayout: offer.sellerPayout
        });
    } else {
        if (buyerData.raw) {
            const bRaw = buyerData.raw;
            bRaw.Coins = Math.max(0, (bRaw.Coins || 0) - offer.price);
            bRaw.Inventory = bRaw.Inventory || {};
            for (const it of offer.items) bRaw.Inventory[it.itemKey] = (bRaw.Inventory[it.itemKey] || 0) + (it.quantity || 1);
            await saveRobloxPlayerData(buyerId, bRaw);
        }
        const sellerData = await getRobloxPlayerData(offer.sellerId);
        if (sellerData.raw) {
            sellerData.raw.Coins = (sellerData.raw.Coins || 0) + offer.sellerPayout;
            await saveRobloxPlayerData(offer.sellerId, sellerData.raw);
        }
    }

    // Track
    try {
        const tracking = require('../tracking');
        tracking.trackMarketplaceBuy(buyerId, offer.sellerId, offer.price, offerId);
    } catch (e) { console.error('[Marketplace] Track error:', e); }

    console.log(`[Marketplace] ${buyerName} bought ${offerId} for ${offer.price} 🪙!`);
    res.status(200).json({ success: true, message: 'Offer purchased successfully!' });
});

// Cancel an offer
router.post('/cancelOffer', async (req, res) => {
    const { userId, offerId } = req.body;
    if (!userId || !offerId) return res.status(400).json({ error: 'Missing parameters' });

    let offer = null;
    if (mongoose.connection.readyState === 1) {
        offer = await MarketplaceOffer.findOne({ offerId, sellerId: userId, status: 'ACTIVE' });
    }
    if (!offer) offer = state.inMemoryMarketplaceOffers.find(o => o.offerId === offerId && o.sellerId === userId && o.status === 'ACTIVE');
    if (!offer) return res.status(404).json({ error: 'Active offer not found.' });

    offer.status = 'CANCELLED';
    if (mongoose.connection.readyState === 1) await MarketplaceOffer.updateOne({ offerId }, { status: 'CANCELLED' });

    const sids = Object.keys(state.activeServers);
    if (sids.length > 0) {
        if (!state.actionQueues[sids[0]]) state.actionQueues[sids[0]] = [];
        state.actionQueues[sids[0]].push({
            actionId: 'mkt_cancel_' + Math.random().toString(36).substr(2, 9),
            action: 'MARKETPLACE_CANCEL_RETURN', sellerId: userId, items: offer.items
        });
    } else {
        const sellerData = await getRobloxPlayerData(userId);
        if (sellerData.raw) {
            sellerData.raw.Inventory = sellerData.raw.Inventory || {};
            for (const it of offer.items) sellerData.raw.Inventory[it.itemKey] = (sellerData.raw.Inventory[it.itemKey] || 0) + (it.quantity || 1);
            await saveRobloxPlayerData(userId, sellerData.raw);
        }
    }

    // Track
    try {
        const tracking = require('../tracking');
        tracking.trackMarketplaceCancel(userId, offerId);
    } catch (e) { console.error('[Marketplace] Track error:', e); }

    console.log(`[Marketplace] ${offer.sellerName} cancelled ${offerId}.`);
    res.status(200).json({ success: true, message: 'Offer cancelled and items returned.' });
});

module.exports = router;
