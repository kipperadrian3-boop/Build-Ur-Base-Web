const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const state = require('../state');
const { getRobloxPlayerData, saveRobloxPlayerData } = require('../opencloud');
const Player = require('../models/Player');
const ActivityLog = require('../models/ActivityLog');
const GameReward = require('../models/GameReward');

const MAX_HOURLY = 1000;

function getHourKey() {
    const now = new Date();
    return `${now.getFullYear()}_${now.getMonth()}_${now.getDate()}_${now.getHours()}`;
}

state.inMemoryGameRewards = state.inMemoryGameRewards || {};

function getInMemoryEarned(userId, hourKey) {
    const key = `${userId}_${hourKey}`;
    return state.inMemoryGameRewards[key] || 0;
}

function addInMemoryEarned(userId, hourKey, amount) {
    const key = `${userId}_${hourKey}`;
    state.inMemoryGameRewards[key] = (state.inMemoryGameRewards[key] || 0) + amount;
    return state.inMemoryGameRewards[key];
}

router.post('/reward', async (req, res) => {
    const { userId, game, reward } = req.body;
    if (!userId || !game || !reward) return res.status(400).json({ error: 'Missing params' });
    if (reward <= 0 || reward > 100) return res.status(400).json({ error: 'Invalid reward amount' });

    const hourKey = getHourKey();

    try {
        let currentEarned = 0;
        let rewardDoc = null;

        if (mongoose.connection.readyState === 1) {
            try {
                rewardDoc = await GameReward.findOne({ robloxUserId: String(userId), hourKey });
                if (!rewardDoc) {
                    rewardDoc = new GameReward({ robloxUserId: String(userId), hourKey, earned: 0 });
                }
                currentEarned = rewardDoc.earned;
            } catch (dbErr) {
                console.error('[Games] GameReward find error:', dbErr);
                currentEarned = getInMemoryEarned(userId, hourKey);
            }
        } else {
            currentEarned = getInMemoryEarned(userId, hourKey);
        }

        if (currentEarned >= MAX_HOURLY) {
            return res.status(400).json({
                error: `Hourly limit reached (${MAX_HOURLY} 🪙). Try next hour!`,
                earned: currentEarned,
                maxPerHour: MAX_HOURLY
            });
        }

        const actualReward = Math.min(reward, MAX_HOURLY - currentEarned);
        const newEarned = currentEarned + actualReward;

        if (mongoose.connection.readyState === 1 && rewardDoc) {
            try {
                rewardDoc.earned = newEarned;
                rewardDoc.updatedAt = new Date();
                await rewardDoc.save();

                await Player.updateOne({ robloxUserId: String(userId) }, {
                    $inc: { totalGamesPlayed: 1, totalGamesWon: 1, totalGameCoinsEarned: actualReward }
                }).catch(e => console.error('[Games] Player update error:', e));

                await ActivityLog.create({
                    robloxUserId: String(userId), action: 'GAME_WIN',
                    details: { game, reward: actualReward, hourlyEarned: newEarned }
                }).catch(e => console.error('[Games] ActivityLog error:', e));
            } catch (dbSaveErr) {
                console.error('[Games] DB save error:', dbSaveErr);
                addInMemoryEarned(userId, hourKey, actualReward);
            }
        } else {
            addInMemoryEarned(userId, hourKey, actualReward);
        }

        // Award coins via Open Cloud
        try {
            const playerData = await getRobloxPlayerData(userId);
            if (playerData && playerData.raw) {
                playerData.raw.Coins = (playerData.raw.Coins || 0) + actualReward;
                await saveRobloxPlayerData(userId, playerData.raw);
            }
        } catch (ocErr) {
            console.error('[Games] OpenCloud award error:', ocErr);
        }

        console.log(`[Games] ${userId} earned ${actualReward} 🪙 from ${game}. Hourly: ${newEarned}/${MAX_HOURLY}`);
        return res.status(200).json({
            success: true,
            reward: actualReward,
            earned: newEarned,
            maxPerHour: MAX_HOURLY
        });
    } catch (err) {
        console.error('[Games] Reward error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

router.get('/hourly/:userId', async (req, res) => {
    const userId = req.params.userId;
    const hourKey = getHourKey();

    try {
        if (mongoose.connection.readyState === 1) {
            const rewardDoc = await GameReward.findOne({ robloxUserId: String(userId), hourKey });
            return res.json({
                earned: rewardDoc ? rewardDoc.earned : 0,
                maxPerHour: MAX_HOURLY
            });
        }
    } catch (err) {
        console.error('[Games] Fetch hourly error:', err);
    }

    const earned = getInMemoryEarned(userId, hourKey);
    return res.json({ earned, maxPerHour: MAX_HOURLY });
});

module.exports = router;

