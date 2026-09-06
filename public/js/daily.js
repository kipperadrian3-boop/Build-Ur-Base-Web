/* ==========================================================================
   DAILY REWARDS: STREAK PROGRESSION & CLAIMING
   ========================================================================== */

(function () {
    const dailyStreakBadge = document.getElementById('dailyStreakBadge');
    const dailyTimerBadge = document.getElementById('dailyTimerBadge');
    const dailySubtitle = document.getElementById('dailySubtitle');
    const dailyRewardsList = document.getElementById('dailyRewardsList');

    const DAILY_REWARDS_CONFIG = [
        { day: 1, text: "1,000 Coins" },
        { day: 2, text: "Medium Coins Potion" },
        { day: 3, text: "Medium Shards Potion" },
        { day: 4, text: "Unlock x3 GameSpeed" },
        { day: 5, text: "Medium Damage Potion" },
        { day: 6, text: "25,000 Coins" },
        { day: 7, text: "Medium Coins, Shards & Damage Potions" }
    ];

    function formatRemainingTime(seconds) {
        if (seconds <= 0) return "Ready!";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function startDailyCountdown(remainingSeconds) {
        if (window.APP.dailyTimerInterval) clearInterval(window.APP.dailyTimerInterval);
        let remaining = remainingSeconds;

        const updateTimer = () => {
            if (remaining <= 0) {
                if (dailyTimerBadge) {
                    dailyTimerBadge.textContent = "Ready to claim";
                    dailyTimerBadge.className = "daily-timer-badge ready";
                }
                clearInterval(window.APP.dailyTimerInterval);
                window.APP.dailyTimerInterval = null;
                if (window.APP.playerDailyReward) window.APP.playerDailyReward.canClaim = true;
                renderDailyRewards();
            } else {
                const formatted = formatRemainingTime(remaining);
                if (dailyTimerBadge) {
                    dailyTimerBadge.textContent = formatted;
                    dailyTimerBadge.className = "daily-timer-badge";
                }
                document.querySelectorAll('.daily-cooldown-timer').forEach(el => {
                    el.textContent = formatted;
                });
                remaining--;
            }
        };

        updateTimer();
        if (remaining > 0) {
            window.APP.dailyTimerInterval = setInterval(updateTimer, 1000);
        }
    }

    function renderDailyRewards() {
        if (!dailyRewardsList) return;

        const playerDailyReward = window.APP.playerDailyReward;

        if (!playerDailyReward) {
            if (dailyStreakBadge) dailyStreakBadge.textContent = "Streak: Syncing...";
            if (dailyTimerBadge) dailyTimerBadge.textContent = "Syncing...";
            dailyRewardsList.innerHTML = `<div style="text-align:center; padding: 2.5rem 1rem; color: #8c7361; font-weight: 500;">
                Syncing daily streak with Roblox Cloud...
            </div>`;
            return;
        }

        const streak = playerDailyReward.streak || 1;
        const canClaim = playerDailyReward.canClaim;
        const remaining = playerDailyReward.remainingSeconds || 0;

        // Update Header Badges
        if (dailyStreakBadge) {
            if (streak <= 7) {
                dailyStreakBadge.textContent = `Streak: Day ${streak} / 7`;
                if (dailySubtitle) dailySubtitle.textContent = "Claim your reward every 24 hours to progress your streak!";
            } else {
                dailyStreakBadge.textContent = `Streak: 7+ (Daily Bonus)`;
                if (dailySubtitle) dailySubtitle.textContent = "You completed all 7 days! Enjoy a daily random coin bonus!";
            }
        }

        if (canClaim) {
            if (dailyTimerBadge) {
                dailyTimerBadge.textContent = "Ready to claim";
                dailyTimerBadge.className = "daily-timer-badge ready";
            }
            if (window.APP.dailyTimerInterval) {
                clearInterval(window.APP.dailyTimerInterval);
                window.APP.dailyTimerInterval = null;
            }
        } else {
            startDailyCountdown(remaining);
        }

        dailyRewardsList.innerHTML = '';

        if (streak <= 7) {
            DAILY_REWARDS_CONFIG.forEach(item => {
                const card = document.createElement('div');
                card.className = 'daily-reward-card';

                let statusHtml = '';
                if (item.day < streak) {
                    card.classList.add('claimed');
                    statusHtml = '<span class="daily-badge claimed">✓ Claimed</span>';
                } else if (item.day === streak) {
                    card.classList.add('current');
                    if (canClaim && window.APP.isServerOnline) {
                        statusHtml = '<button class="daily-claim-btn" id="claimDailyBtn">Claim</button>';
                    } else if (!window.APP.isServerOnline) {
                        statusHtml = '<button class="daily-claim-btn" disabled title="Sync offline">Sync Offline</button>';
                    } else {
                        statusHtml = `<span class="daily-badge cooldown daily-cooldown-timer">${formatRemainingTime(remaining)}</span>`;
                    }
                } else {
                    card.classList.add('locked');
                    statusHtml = '<span class="daily-badge locked">Locked</span>';
                }

                card.innerHTML = `
                    <div class="daily-reward-info">
                        <div class="daily-day-label">Day ${item.day}</div>
                        <div class="daily-reward-text">${item.text}</div>
                    </div>
                    <div>${statusHtml}</div>
                `;
                dailyRewardsList.appendChild(card);
            });
        } else {
            // Post-Day 7: Single bonus card
            const card = document.createElement('div');
            card.className = 'daily-bonus-card';

            let btnHtml = '';
            if (canClaim && window.APP.isServerOnline) {
                btnHtml = '<button class="daily-claim-btn" id="claimDailyBtn">Claim Daily Bonus</button>';
            } else if (!window.APP.isServerOnline) {
                btnHtml = '<button class="daily-claim-btn" disabled>Sync Offline</button>';
            } else {
                btnHtml = `<button class="daily-claim-btn daily-cooldown-timer" disabled>${formatRemainingTime(remaining)}</button>`;
            }

            card.innerHTML = `
                <div class="daily-bonus-title">Daily Bonus</div>
                <div class="daily-bonus-amount">1,000 – 5,000 🪙</div>
                <div class="daily-bonus-desc">Random coin bonus refreshes every 24 hours!</div>
                ${btnHtml}
            `;
            dailyRewardsList.appendChild(card);
        }

        const claimBtn = document.getElementById('claimDailyBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', claimDailyReward);
        }
    }

    async function claimDailyReward() {
        const claimBtn = document.getElementById('claimDailyBtn');
        const currentUser = window.APP.currentUser;
        if (!claimBtn || !window.APP.isServerOnline || !currentUser) return;

        claimBtn.disabled = true;
        claimBtn.classList.add('loading');
        claimBtn.textContent = "Claiming...";

        try {
            const res = await fetch(`${window.APP.API_BASE}/api/claimDailyReward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: window.APP.currentServerId || 'cloud',
                    userId: currentUser.userId
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                window.APP.showMessage(data.message || 'Reward claimed!', true);
                if (window.APP.fetchLiveStatus) await window.APP.fetchLiveStatus();
                renderDailyRewards();
            } else {
                window.APP.showMessage(data.message || "Failed to claim reward.", false);
                claimBtn.disabled = false;
                claimBtn.classList.remove('loading');
                claimBtn.textContent = "Claim";
            }
        } catch (err) {
            window.APP.showMessage("Connection error while claiming.", false);
            claimBtn.disabled = false;
            claimBtn.classList.remove('loading');
            claimBtn.textContent = "Claim";
        }
    }

    window.APP.formatRemainingTime = formatRemainingTime;
    window.APP.startDailyCountdown = startDailyCountdown;
    window.APP.renderDailyRewards = renderDailyRewards;
    window.APP.claimDailyReward = claimDailyReward;
})();
