const mongoose = require('mongoose');

// Modular Models (Each strictly max 5 info fields)
const Player = require('./models/Player');
const PlayerAuth = require('./models/PlayerAuth');
const PlayerCode = require('./models/PlayerCode');
const PlayerSession = require('./models/PlayerSession');
const PlayerProgression = require('./models/PlayerProgression');
const PlayerInventorySummary = require('./models/PlayerInventorySummary');
const PlayerBaseStats = require('./models/PlayerBaseStats');
const PlayerCombatStats = require('./models/PlayerCombatStats');
const PlayerShopStats = require('./models/PlayerShopStats');
const PlayerAuctionStats = require('./models/PlayerAuctionStats');
const PlayerMarketplaceStats = require('./models/PlayerMarketplaceStats');
const PlayerGameStats = require('./models/PlayerGameStats');
const PlayerDailyStats = require('./models/PlayerDailyStats');
const PlayerWebActivity = require('./models/PlayerWebActivity');
const PlayerEconomy = require('./models/PlayerEconomy');
const ActivityLog = require('./models/ActivityLog');

function isConnected() {
    return mongoose.connection.readyState === 1;
}

// 1. Code Registrierung (vom Roblox Spielserver gesendet)
async function trackRegisteredCode(userId, username, code) {
    if (!isConnected() || !userId || !code) return;
    try {
        const uid = String(userId);
        await PlayerCode.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    code: code,
                    username: username || '',
                    registeredAt: new Date(),
                    lastUsedAt: new Date()
                }
            },
            { upsert: true }
        );

        await PlayerAuth.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    username: username || '',
                    lastLoginCode: code
                },
                $setOnInsert: { firstLoginAt: new Date(), avatarUrl: '' }
            },
            { upsert: true }
        );
    } catch (e) {
        console.error('[Tracking] trackRegisteredCode error:', e.message);
    }
}

// 2. Auth & Login Tracking (Speichert pro User den Code und Session-Details)
async function trackLogin(userId, username, code, avatarUrl = '', ip = '', device = 'Desktop') {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        const now = new Date();

        // Player Core Identity
        await Player.updateOne(
            { robloxUserId: uid },
            {
                $set: { username: username || '', avatarUrl: avatarUrl || '', lastSeen: now },
                $setOnInsert: { firstSeen: now }
            },
            { upsert: true }
        );

        // Player Auth
        await PlayerAuth.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    username: username || '',
                    lastLoginCode: code || '',
                    lastLoginAt: now,
                    avatarUrl: avatarUrl || ''
                },
                $setOnInsert: { firstLoginAt: now }
            },
            { upsert: true }
        );

        // Player Code Tracking (Dediziert)
        if (code) {
            await PlayerCode.updateOne(
                { robloxUserId: uid },
                {
                    $set: { code: code, username: username || '', lastUsedAt: now },
                    $inc: { totalLoginsWithCode: 1 }
                },
                { upsert: true }
            );
        }

        // Player Session
        await PlayerSession.updateOne(
            { robloxUserId: uid },
            {
                $inc: { totalLogins: 1 },
                $set: { lastSeenAt: now, lastIP: ip || '', deviceType: device, isOnline: true }
            },
            { upsert: true }
        );

        // Web Activity
        await PlayerWebActivity.updateOne(
            { robloxUserId: uid },
            {
                $inc: { totalPageViews: 1, totalActionsPerformed: 1 },
                $set: { lastActiveTab: 'login', lastActiveAt: now }
            },
            { upsert: true }
        );

        // Activity Log
        await ActivityLog.create({
            robloxUserId: uid,
            action: 'LOGIN',
            details: { username, code: code ? `${code.slice(0, 4)}-****` : '', ip, device }
        });
    } catch (e) {
        console.error('[Tracking] trackLogin error:', e.message);
    }
}

// 3. Roblox DataStore Game Progression & Base Tracking
async function trackProgression(userId, rawData) {
    if (!isConnected() || !userId || !rawData) return;
    try {
        const uid = String(userId);
        const coins = Number(rawData.Coins) || 0;
        const highestWave = Number(rawData.HighestWave) || 1;
        const shards = Number(rawData.Shards) || 0;

        // Player Progression
        await PlayerProgression.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    coins: coins,
                    highestWave: highestWave,
                    shards: shards,
                    tutorialCompleted: !!rawData.TutorialCompleted,
                    gameSpeed: Number(rawData.GameSpeed) || 1
                }
            },
            { upsert: true }
        );

        // Inventory Categorization (Max 5 fields)
        const inv = rawData.Inventory || {};
        let blocks = 0, chests = 0, doors = 0, defenses = 0, potions = 0;
        let estimatedInvValue = 0;

        for (const [key, count] of Object.entries(inv)) {
            const num = Number(count) || 0;
            const k = key.toLowerCase();
            if (k.includes('chest')) { chests += num; estimatedInvValue += num * 100; }
            else if (k.includes('potion')) { potions += num; estimatedInvValue += num * 50; }
            else if (k.includes('turret') || k.includes('flamethrower') || k.includes('canon')) { defenses += num; estimatedInvValue += num * 200; }
            else if (k.includes('laserdoor') || k.includes('window') || k.includes('stair') || k.includes('wedge') || k.includes('door')) { doors += num; estimatedInvValue += num * 40; }
            else { blocks += num; estimatedInvValue += num * 20; }
        }

        await PlayerInventorySummary.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    totalBlocks: blocks,
                    totalChests: chests,
                    totalDoorsAndDecor: doors,
                    totalDefenses: defenses,
                    totalPotions: potions
                }
            },
            { upsert: true }
        );

        // Base & Placements Analysis (Max 5 fields)
        const placements = Array.isArray(rawData.Placements) ? rawData.Placements : [];
        const totalPlaced = placements.length;
        let maxHeight = 0;
        const uniqueItems = new Set();
        for (const p of placements) {
            if (p.Y && p.Y > maxHeight) maxHeight = p.Y;
            if (p.Id) uniqueItems.add(p.Id);
        }
        const complexity = Math.round((totalPlaced * 1.5) + (uniqueItems.size * 5));

        await PlayerBaseStats.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    totalPlacedBlocks: totalPlaced,
                    maxBaseHeight: maxHeight,
                    uniqueItemTypesUsed: uniqueItems.size,
                    baseComplexityScore: complexity,
                    lastBaseSavedAt: new Date()
                }
            },
            { upsert: true }
        );

        // Combat & Wave Stats (Max 5 fields)
        const activePotions = Array.isArray(rawData.ActivePotions) ? rawData.ActivePotions.length : 0;
        const defenseEstimate = (defenses * 25) + Math.round(highestWave * 10);

        await PlayerCombatStats.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    highestWaveCleared: highestWave,
                    selectedWaveCheckpoint: Number(rawData.SelectedWave) || 1,
                    autoWaveEnabled: !!rawData.AutoWave,
                    activePotionsCount: activePotions,
                    defensePowerEstimate: defenseEstimate
                }
            },
            { upsert: true }
        );

        // Economy & Net Worth Tracking (Max 5 fields)
        const totalNetWorth = coins + (shards * 10) + estimatedInvValue;
        await PlayerEconomy.updateOne(
            { robloxUserId: uid },
            {
                $set: {
                    netWorthEstimate: totalNetWorth,
                    lastFinancialSyncAt: new Date()
                },
                $max: { peakCoinsRecorded: coins }
            },
            { upsert: true }
        );
    } catch (e) {
        console.error('[Tracking] trackProgression error:', e.message);
    }
}

// 4. Shop Purchase Tracking
async function trackShopPurchase(userId, itemKey, category, qty, totalCost) {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        const costNum = Number(totalCost) || 0;
        const qtyNum = Number(qty) || 1;

        await PlayerShopStats.updateOne(
            { robloxUserId: uid },
            {
                $inc: { totalItemsBought: qtyNum, totalCoinsSpent: costNum },
                $set: { lastPurchasedItem: itemKey, lastPurchaseAt: new Date(), favoriteCategory: category || 'Blocks' }
            },
            { upsert: true }
        );

        await PlayerEconomy.updateOne(
            { robloxUserId: uid },
            { $inc: { totalWebExpenditure: costNum } },
            { upsert: true }
        );

        await PlayerWebActivity.updateOne(
            { robloxUserId: uid },
            { $inc: { totalActionsPerformed: 1 }, $set: { lastActiveTab: 'shop', lastActiveAt: new Date() } },
            { upsert: true }
        );

        await ActivityLog.create({
            robloxUserId: uid,
            action: 'SHOP_PURCHASE',
            details: { itemKey, quantity: qtyNum, totalCost: costNum, category }
        });
    } catch (e) {
        console.error('[Tracking] trackShopPurchase error:', e.message);
    }
}

// 5. Live Auction Tracking
async function trackAuctionBid(userId, bidAmount, itemKey) {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        const amount = Number(bidAmount) || 0;

        await PlayerAuctionStats.updateOne(
            { robloxUserId: uid },
            {
                $inc: { totalBidsPlaced: 1 },
                $max: { highestSingleBid: amount },
                $set: { lastBidAt: new Date() }
            },
            { upsert: true }
        );

        await PlayerWebActivity.updateOne(
            { robloxUserId: uid },
            { $inc: { totalActionsPerformed: 1 }, $set: { lastActiveTab: 'auction', lastActiveAt: new Date() } },
            { upsert: true }
        );

        await ActivityLog.create({
            robloxUserId: uid,
            action: 'AUCTION_BID',
            details: { itemKey, bidAmount: amount }
        });
    } catch (e) {
        console.error('[Tracking] trackAuctionBid error:', e.message);
    }
}

async function trackAuctionWin(userId, cost, itemKey, qty) {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        const costNum = Number(cost) || 0;

        await PlayerAuctionStats.updateOne(
            { robloxUserId: uid },
            {
                $inc: { totalAuctionsWon: 1, totalCoinsSpent: costNum }
            },
            { upsert: true }
        );

        await PlayerEconomy.updateOne(
            { robloxUserId: uid },
            { $inc: { totalWebExpenditure: costNum } },
            { upsert: true }
        );

        await ActivityLog.create({
            robloxUserId: uid,
            action: 'AUCTION_WIN',
            details: { itemKey, quantity: qty, cost: costNum }
        });
    } catch (e) {
        console.error('[Tracking] trackAuctionWin error:', e.message);
    }
}

// 6. Marketplace (Sell, Buy & Cancel) Tracking
async function trackMarketplaceCreate(userId, offerId, fee) {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        const feeNum = Number(fee) || 0;

        await PlayerMarketplaceStats.updateOne(
            { robloxUserId: uid },
            { $inc: { offersCreated: 1, coinsSpent: feeNum } },
            { upsert: true }
        );

        await PlayerEconomy.updateOne(
            { robloxUserId: uid },
            { $inc: { totalWebExpenditure: feeNum } },
            { upsert: true }
        );

        await PlayerWebActivity.updateOne(
            { robloxUserId: uid },
            { $inc: { totalActionsPerformed: 1 }, $set: { lastActiveTab: 'marketplace', lastActiveAt: new Date() } },
            { upsert: true }
        );

        await ActivityLog.create({
            robloxUserId: uid,
            action: 'MARKETPLACE_CREATE',
            details: { offerId, fee: feeNum }
        });
    } catch (e) {
        console.error('[Tracking] trackMarketplaceCreate error:', e.message);
    }
}

async function trackMarketplaceBuy(buyerId, sellerId, price, offerId) {
    if (!isConnected()) return;
    try {
        const priceNum = Number(price) || 0;
        if (buyerId) {
            const bUid = String(buyerId);
            await PlayerMarketplaceStats.updateOne(
                { robloxUserId: bUid },
                { $inc: { offersBought: 1, coinsSpent: priceNum } },
                { upsert: true }
            );
            await PlayerEconomy.updateOne(
                { robloxUserId: bUid },
                { $inc: { totalWebExpenditure: priceNum } },
                { upsert: true }
            );
            await PlayerWebActivity.updateOne(
                { robloxUserId: bUid },
                { $inc: { totalActionsPerformed: 1 }, $set: { lastActiveTab: 'marketplace', lastActiveAt: new Date() } },
                { upsert: true }
            );
            await ActivityLog.create({
                robloxUserId: bUid,
                action: 'MARKETPLACE_BUY',
                details: { offerId, price: priceNum, sellerId: String(sellerId) }
            });
        }
        if (sellerId) {
            const sUid = String(sellerId);
            await PlayerMarketplaceStats.updateOne(
                { robloxUserId: sUid },
                { $inc: { offersSold: 1, coinsEarned: priceNum } },
                { upsert: true }
            );
            await PlayerEconomy.updateOne(
                { robloxUserId: sUid },
                { $inc: { totalWebEarnings: priceNum } },
                { upsert: true }
            );
            await ActivityLog.create({
                robloxUserId: sUid,
                action: 'MARKETPLACE_SOLD',
                details: { offerId, payout: priceNum, buyerId: String(buyerId) }
            });
        }
    } catch (e) {
        console.error('[Tracking] trackMarketplaceBuy error:', e.message);
    }
}

async function trackMarketplaceCancel(userId, offerId) {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        await ActivityLog.create({
            robloxUserId: uid,
            action: 'MARKETPLACE_CANCEL',
            details: { offerId }
        });
    } catch (e) {
        console.error('[Tracking] trackMarketplaceCancel error:', e.message);
    }
}

// 7. Mini-Games (Minesweeper) Tracking
async function trackGameResult(userId, isWin, reward = 0) {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        const rewardNum = Number(reward) || 0;
        const incData = { minesweeperPlayed: 1 };
        if (isWin) {
            incData.minesweeperWon = 1;
            incData.coinsEarned = rewardNum;
        }

        const doc = await PlayerGameStats.findOneAndUpdate(
            { robloxUserId: uid },
            {
                $inc: incData,
                $set: { lastPlayedAt: new Date() }
            },
            { upsert: true, returnDocument: 'after' }
        );

        if (doc && doc.minesweeperPlayed > 0) {
            const winRate = Math.round((doc.minesweeperWon / doc.minesweeperPlayed) * 100);
            await PlayerGameStats.updateOne({ robloxUserId: uid }, { $set: { winRatePercent: winRate } });
        }

        if (isWin && rewardNum > 0) {
            await PlayerEconomy.updateOne(
                { robloxUserId: uid },
                { $inc: { totalWebEarnings: rewardNum } },
                { upsert: true }
            );
        }

        await PlayerWebActivity.updateOne(
            { robloxUserId: uid },
            { $inc: { totalActionsPerformed: 1 }, $set: { lastActiveTab: 'games', lastActiveAt: new Date() } },
            { upsert: true }
        );

        await ActivityLog.create({
            robloxUserId: uid,
            action: isWin ? 'GAME_WIN' : 'GAME_LOSS',
            details: { game: 'minesweeper', reward: rewardNum }
        });
    } catch (e) {
        console.error('[Tracking] trackGameResult error:', e.message);
    }
}

// 8. Daily Rewards Tracking
async function trackDailyClaim(userId, streak, bonusCoins = 0) {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        const streakNum = Number(streak) || 1;
        const coinsNum = Number(bonusCoins) || 0;

        await PlayerDailyStats.updateOne(
            { robloxUserId: uid },
            {
                $set: { currentStreak: streakNum, lastClaimAt: new Date() },
                $max: { highestStreak: streakNum },
                $inc: { totalClaims: 1, bonusCoinsClaimed: coinsNum }
            },
            { upsert: true }
        );

        if (coinsNum > 0) {
            await PlayerEconomy.updateOne(
                { robloxUserId: uid },
                { $inc: { totalWebEarnings: coinsNum } },
                { upsert: true }
            );
        }

        await PlayerWebActivity.updateOne(
            { robloxUserId: uid },
            { $inc: { totalActionsPerformed: 1 }, $set: { lastActiveTab: 'daily', lastActiveAt: new Date() } },
            { upsert: true }
        );

        await ActivityLog.create({
            robloxUserId: uid,
            action: 'DAILY_CLAIM',
            details: { streak: streakNum, bonusCoins: coinsNum }
        });
    } catch (e) {
        console.error('[Tracking] trackDailyClaim error:', e.message);
    }
}

// 9. Web Activity Polling & Tab Tracking
async function trackWebPoll(userId, tab = 'dashboard', lang = 'de') {
    if (!isConnected() || !userId) return;
    try {
        const uid = String(userId);
        await PlayerWebActivity.updateOne(
            { robloxUserId: uid },
            {
                $inc: { totalPageViews: 1 },
                $set: { lastActiveTab: tab, lastActiveAt: new Date(), preferredLanguage: lang.slice(0, 5) }
            },
            { upsert: true }
        );
    } catch (e) {
        // Silent fail for polling
    }
}

module.exports = {
    trackRegisteredCode,
    trackLogin,
    trackProgression,
    trackShopPurchase,
    trackAuctionBid,
    trackAuctionWin,
    trackMarketplaceCreate,
    trackMarketplaceBuy,
    trackMarketplaceCancel,
    trackGameResult,
    trackDailyClaim,
    trackWebPoll
};
