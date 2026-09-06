const express = require('express');
const router = express.Router();
const { getRobloxPlayerData, saveRobloxPlayerData } = require('../opencloud');
const Player = require('../models/Player');
const ActivityLog = require('../models/ActivityLog');
const GameReward = require('../models/GameReward');

const MAX_HOURLY = 1000;

function getHourKey() {
    const now = new Date();
    return `${now.getFullYear()}_${now.getMonth()}_${now.getDate()}_${now.getHours()}`;
}

router.post('/reward', async (req, res) => {
    const { userId, game, reward } = req.body;
    if (!userId || !game || !reward) return res.status(400).json({ error: 'Missing params' });
    if (reward <= 0 || reward > 100) return res.status(400).json({ error: 'Invalid reward amount' });

    const hourKey = getHourKey();

    // Server-side hourly limit check via MongoDB
    try {
        let rewardDoc = await GameReward.findOne({ robloxUserId: String(userId), hourKey });

        if (!rewardDoc) {
            rewardDoc = new GameReward({ robloxUserId: String(userId), hourKey, earned: 0 });
        }

        if (rewardDoc.earned >= MAX_HOURLY) {
            return res.status(400).json({
                error: `Hourly limit reached (${MAX_HOURLY} 🪙). Try next hour!`,
                earned: rewardDoc.earned,
                maxPerHour: MAX_HOURLY
            });
        }

        const actualReward = Math.min(reward, MAX_HOURLY - rewardDoc.earned);
        rewardDoc.earned += actualReward;
        rewardDoc.updatedAt = new Date();
        await rewardDoc.save();

        // Award coins via Open Cloud
        const playerData = await getRobloxPlayerData(userId);
        if (playerData.raw) {
            playerData.raw.Coins = (playerData.raw.Coins || 0) + actualReward;
            await saveRobloxPlayerData(userId, playerData.raw);
        }

        // Track
        await Player.updateOne({ robloxUserId: String(userId) }, {
            $inc: { totalGamesPlayed: 1, totalGamesWon: 1, totalGameCoinsEarned: actualReward }
        });
        await ActivityLog.create({
            robloxUserId: String(userId), action: 'GAME_WIN',
            details: { game, reward: actualReward, hourlyEarned: rewardDoc.earned }
        });

        console.log(`[Games] ${userId} earned ${actualReward} 🪙 from ${game}. Hourly: ${rewardDoc.earned}/${MAX_HOURLY}`);
        return res.status(200).json({
            success: true,
            reward: actualReward,
            earned: rewardDoc.earned,
            maxPerHour: MAX_HOURLY
        });
    } catch (err) {
        console.error('[Games] Reward error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

router.get('/hourly/:userId', async (req, res) => {
    try {
        const hourKey = getHourKey();
        const rewardDoc = await GameReward.findOne({ robloxUserId: String(req.params.userId), hourKey });
        return res.json({
            earned: rewardDoc ? rewardDoc.earned : 0,
            maxPerHour: MAX_HOURLY
        });
    } catch (err) {
        console.error('[Games] Fetch hourly error:', err);
        return res.json({ earned: 0, maxPerHour: MAX_HOURLY });
    }
});

module.exports = router;

