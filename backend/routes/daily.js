const express = require('express');
const router = express.Router();
const state = require('../state');
const { getRobloxPlayerData, saveRobloxPlayerData, saveOpenCloudStore, clearDailyCache, ROBLOX_OPENCLOUD_API_KEY, ROBLOX_UNIVERSE_ID } = require('../opencloud');
const ActivityLog = require('../models/ActivityLog');

router.post('/claimDailyReward', async (req, res) => {
    const { serverId, userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing params' });

    // 1. Live server route
    if (serverId && state.activeServers[serverId]) {
        const actionId = 'claim_' + Math.random().toString(36).substr(2, 9);
        if (!state.actionQueues[serverId]) state.actionQueues[serverId] = [];
        state.actionQueues[serverId].push({ actionId, action: 'CLAIM_DAILY', userId });

        let attempts = 0;
        while (attempts < 30) {
            if (state.actionResults[actionId]) {
                const result = state.actionResults[actionId];
                delete state.actionResults[actionId];

                // Track
                try {
                    const tracking = require('../tracking');
                    tracking.trackDailyClaim(userId, result.streak || 1, result.coinsAwarded || 0);
                } catch (e) {}

                if (result.success) return res.status(200).json(result);
                else return res.status(400).json(result);
            }
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }
        state.actionQueues[serverId] = state.actionQueues[serverId].filter(a => a.actionId !== actionId);
        return res.status(504).json({ success: false, message: 'Roblox server timed out' });
    }

    // 2. Offline: Open Cloud
    const entryKey = `Player_${userId}`;
    let data = { Streak: 1, LastClaimTime: 0, HasThreeSpeed: false };
    try {
        const url = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=DailyRewardsStore_v2&entryKey=${encodeURIComponent(entryKey)}`;
        const resDs = await fetch(url, { headers: { 'x-api-key': ROBLOX_OPENCLOUD_API_KEY } });
        if (resDs.ok) data = await resDs.json();
    } catch (e) {
        console.error('[Daily] Error fetching DailyRewardsStore_v2:', e);
    }

    const now = Math.floor(Date.now() / 1000);
    const lastClaim = Number(data.LastClaimTime) || 0;
    const canClaim = (lastClaim === 0) || (now - lastClaim >= 86400);

    if (!canClaim) {
        const remaining = 86400 - (now - lastClaim);
        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        return res.status(400).json({ success: false, message: `Wait ${hours}h ${mins}m before claiming.` });
    }

    const currentStreak = Number(data.Streak) || 1;
    let rewardDesc = "", coinsAwarded = 0;

    if (currentStreak === 1) { coinsAwarded = 1000; rewardDesc = "1,000 Coins"; }
    else if (currentStreak === 2) { rewardDesc = "Medium Coins Potion"; }
    else if (currentStreak === 3) { rewardDesc = "Medium Shards Potion"; }
    else if (currentStreak === 4) { data.HasThreeSpeed = true; rewardDesc = "Unlock x3 GameSpeed"; }
    else if (currentStreak === 5) { rewardDesc = "Medium Damage Potion"; }
    else if (currentStreak === 6) { coinsAwarded = 25000; rewardDesc = "25,000 Coins"; }
    else if (currentStreak === 7) { rewardDesc = "Medium Coins, Shards & Damage Potions"; }
    else { coinsAwarded = Math.floor(Math.random() * 4001) + 1000; rewardDesc = `${coinsAwarded.toLocaleString('de-DE')} Coins`; }

    data.LastClaimTime = now;
    data.Streak = currentStreak < 7 ? currentStreak + 1 : 8;

    await saveOpenCloudStore("DailyRewardsStore_v2", entryKey, data);
    clearDailyCache(userId);

    if (coinsAwarded > 0) {
        const pData = await getRobloxPlayerData(userId);
        if (pData.raw) {
            pData.raw.Coins = (pData.raw.Coins || 0) + coinsAwarded;
            await saveRobloxPlayerData(userId, pData.raw);
        }
    }

    // Track
    try {
        const tracking = require('../tracking');
        tracking.trackDailyClaim(userId, data.Streak, coinsAwarded);
    } catch (e) { console.error('[Daily] Track error:', e); }

    console.log(`[Daily] Offline claim for ${userId}: Streak ${currentStreak} -> ${data.Streak}, Reward: ${rewardDesc}`);
    return res.status(200).json({
        success: true, message: "Claimed " + rewardDesc,
        reward: rewardDesc, newStreak: data.Streak,
        lastClaimTime: now, coinsAwarded
    });
});

module.exports = router;
