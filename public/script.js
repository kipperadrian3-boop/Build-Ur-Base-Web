document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginView = document.getElementById('loginView');
    const mainAppView = document.getElementById('mainAppView');
    
    const codeInput = document.getElementById('codeInput');
    const loginBtn = document.getElementById('loginBtn');
    const statusMessage = document.getElementById('statusMessage');
    const playerNameSpan = document.getElementById('playerName');
    const playerCashSpan = document.getElementById('playerCash');
    const serverStatusDiv = document.getElementById('serverStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
    
    // Views and Nav
    const indexView = document.getElementById('indexView');
    const shopView = document.getElementById('shopView');
    const dailyView = document.getElementById('dailyView');
    const navIndexBtn = document.getElementById('navIndexBtn');
    const navShopBtn = document.getElementById('navShopBtn');
    const navAuctionBtn = document.getElementById('navAuctionBtn');
    const navDailyBtn = document.getElementById('navDailyBtn');
    const itemsGrid = document.getElementById('itemsGrid');
    const shopList = document.getElementById('shopList');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const dailyStreakBadge = document.getElementById('dailyStreakBadge');
    const dailyTimerBadge = document.getElementById('dailyTimerBadge');
    const dailySubtitle = document.getElementById('dailySubtitle');
    const dailyRewardsList = document.getElementById('dailyRewardsList');
    
    // Auction Elements
    const auctionView = document.getElementById('auctionView');
    const auctionTimer = document.getElementById('auctionTimer');
    const auctionImg = document.getElementById('auctionImg');
    const auctionItemName = document.getElementById('auctionItemName');
    const auctionQty = document.getElementById('auctionQty');
    const auctionCurrentBid = document.getElementById('auctionCurrentBid');
    const auctionHighestBidder = document.getElementById('auctionHighestBidder');
    const auctionBidBtn = document.getElementById('auctionBidBtn');

    // Marketplace Elements
    const marketplaceView = document.getElementById('marketplaceView');
    const navMarketplaceBtn = document.getElementById('navMarketplaceBtn');
    const mktRefreshBtn = document.getElementById('mktRefreshBtn');
    const mktListingsCount = document.getElementById('mktListingsCount');
    const mktOffersGrid = document.getElementById('mktOffersGrid');
    const mktOpenCreateModalBtn = document.getElementById('mktOpenCreateModalBtn');
    const mktCreateModal = document.getElementById('mktCreateModal');
    const mktCloseModalBtn = document.getElementById('mktCloseModalBtn');
    const mktMyInventoryList = document.getElementById('mktMyInventoryList');
    const mktBundleList = document.getElementById('mktBundleList');
    const mktClearBundleBtn = document.getElementById('mktClearBundleBtn');
    const mktPayoutInput = document.getElementById('mktPayoutInput');
    const mktCreateBtn = document.getElementById('mktCreateBtn');
    
    // State
    let currentUser = null;
    let gameConfigs = null;
    let currentCategory = 'Blocks';
    let currentShopCategory = 'Blocks';
    
    let isServerOnline = false;
    let currentServerId = null;
    let playerStock = {};
    let playerCash = 0;
    let playerDailyReward = null;
    let playerInventory = {};
    let currentOfferBundle = {};
    let dailyTimerInterval = null;
    let syncInterval = null;
    let auctionInterval = null;
    
    let lastAuctionState = null;

    // Precision Text Fitting (Calculates exact font size so text never overflows and never zooms)
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    function calculateFittedFontSize(text, maxWidth = 80, defaultSize = 12.5, minSize = 8.5) {
        if (!text) return defaultSize;
        measureCtx.font = `600 ${defaultSize}px Inter, sans-serif`;
        const textWidth = measureCtx.measureText(text).width;
        if (textWidth <= maxWidth) {
            return defaultSize;
        }
        const targetSize = (maxWidth / textWidth) * defaultSize;
        return Math.max(minSize, Math.floor(targetSize * 10) / 10);
    }

    function setButtonTextFitted(btn, text) {
        if (!btn) return;
        const isMobile = window.innerWidth <= 440;
        const maxWidth = isMobile ? 70 : 81;
        const fittedSize = calculateFittedFontSize(text, maxWidth, 12.5, 8.5);
        if (btn.textContent !== text) {
            btn.textContent = text;
        }
        btn.style.fontSize = `${fittedSize}px`;
    }

    // Formatting Code Input
    codeInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/-/g, '').replace(/[^0-9]/g, '');
        if (value.length > 16) value = value.slice(0, 16);
        const match = value.match(/.{1,4}/g);
        if (match) {
            e.target.value = match.join('-');
        } else {
            e.target.value = value;
        }
    });

    // Auto-login if code and user data is saved
    const savedCode = localStorage.getItem('roblox_web_code');
    const savedUser = localStorage.getItem('roblox_web_user');
    
    if (savedCode && savedUser) {
        // Bypass the server check entirely because the user was already validated before
        currentUser = JSON.parse(savedUser);
        codeInput.value = savedCode;
        
        loginView.classList.add('hidden');
        mainAppView.classList.remove('hidden');
        
        playerNameSpan.textContent = currentUser.username;
        if (currentUser.avatarUrl) {
            avatarPlaceholder.style.backgroundImage = `url('${currentUser.avatarUrl}')`;
        }
        
        loadGameConfigs();
        startLiveSync();
        startAuctionSync();
    } else if (savedCode) {
        // Fallback for older sessions
        codeInput.value = savedCode;
        performLogin(savedCode);
    }

    loginBtn.addEventListener('click', () => {
        const code = codeInput.value;
        if (code.length !== 19) {
            showMessage("Please enter a valid 16-digit code.", false);
            return;
        }
        performLogin(code);
    });

    async function performLogin(code) {
        loginBtn.disabled = true;
        loginBtn.textContent = "Connecting...";
        showMessage("", false);

        try {
            const response = await fetch('https://build-ur-base-web.onrender.com/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });

            const data = await response.json();

            if (data.success) {
                // Save EVERYTHING to local storage so user stays logged in offline
                currentUser = {
                    username: data.user.username,
                    avatarUrl: data.user.avatarUrl,
                    userId: data.user.userId
                };
                localStorage.setItem('roblox_web_code', code);
                localStorage.setItem('roblox_web_user', JSON.stringify(currentUser));
                
                // Show Main App
                loginView.classList.add('hidden');
                mainAppView.classList.remove('hidden');
                
                playerNameSpan.textContent = currentUser.username;
                if (currentUser.avatarUrl) {
                    avatarPlaceholder.style.backgroundImage = `url('${currentUser.avatarUrl}')`;
                }

                // Fetch Game Configs and start sync
                loadGameConfigs();
                startLiveSync();
                startAuctionSync();
                
            } else {
                localStorage.removeItem('roblox_web_code');
                localStorage.removeItem('roblox_web_user');
                showMessage(data.error || "Login failed.", false);
                loginView.classList.remove('hidden');
                mainAppView.classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            showMessage("Server is offline or unreachable.", false);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = "Connect";
        }
    }

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('roblox_web_code');
        localStorage.removeItem('roblox_web_user');
        currentUser = null;
        currentOfferBundle = {};
        closeCreateOfferModal();
        stopLiveSync();
        stopAuctionSync();
        mainAppView.classList.add('hidden');
        loginView.classList.remove('hidden');
        codeInput.value = "";
        showMessage("Logged out successfully.", true);
    });

    function showMessage(msg, isSuccess) {
        statusMessage.textContent = msg;
        statusMessage.className = isSuccess ? 'status-message success' : 'status-message';
    }

    // --- Live Sync Logic ---

    function startLiveSync() {
        if (syncInterval) stopLiveSync();
        fetchLiveStatus(); // immediate fetch
        syncInterval = setInterval(fetchLiveStatus, 5000); // Every 5 seconds
    }

    function stopLiveSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    async function fetchLiveStatus() {
        if (!currentUser || !currentUser.userId) return;
        try {
            const res = await fetch('https://build-ur-base-web.onrender.com/api/status/' + currentUser.userId);
            const data = await res.json();
            
            isServerOnline = data.isServerOnline;
            currentServerId = data.currentServerId;
            playerStock = data.playerStock || {};
            playerCash = data.playerCash || 0;
            playerDailyReward = data.dailyReward || null;
            playerInventory = data.playerInventory || {};
            
            if (data.isGameServerRunning) {
                serverStatusDiv.textContent = 'Server: Online';
                serverStatusDiv.className = 'status-indicator online';
            } else if (data.isOpenCloudActive) {
                serverStatusDiv.textContent = 'Cloud Sync: Active';
                serverStatusDiv.className = 'status-indicator online';
            } else if (isServerOnline) {
                serverStatusDiv.textContent = 'Server: Online';
                serverStatusDiv.className = 'status-indicator online';
            } else {
                serverStatusDiv.textContent = 'Server: Offline';
                serverStatusDiv.className = 'status-indicator offline';
            }
            
            playerCashSpan.textContent = `🪙 ${playerCash.toLocaleString('de-DE')}`;

            // Update daily rewards if visible
            if (!dailyView.classList.contains('hidden')) {
                renderDailyRewards();
            }

            // Update marketplace inventory if modal is open
            if (mktCreateModal && !mktCreateModal.classList.contains('hidden')) {
                renderMarketplaceInventory();
            }
            
            // Update shop stock in place if visible
            if (!shopView.classList.contains('hidden')) {
                document.querySelectorAll('.shop-item').forEach(card => {
                    const stockDiv = card.querySelector('.shop-item-stock');
                    const key = card.getAttribute('data-item-key');
                    const stock = playerStock[key] !== undefined ? playerStock[key] : '?';
                    if (stockDiv) stockDiv.textContent = `Stock: ${stock}`;
                    
                    const buyBtn = card.querySelector('.execute-buy-btn');
                    const price = parseInt(buyBtn ? buyBtn.getAttribute('data-price') : 0, 10) || 0;
                    
                    const maxQtyBtn = card.querySelector('.max-qty-btn');
                    if (maxQtyBtn) {
                        const stockNum = stock === '?' ? 99 : stock;
                        maxQtyBtn.setAttribute('data-qty', stockNum);
                        setButtonTextFitted(maxQtyBtn, `x${stockNum} - ${price * stockNum} 🪙`);
                        
                        if (maxQtyBtn.classList.contains('selected')) {
                            const actionsDiv = card.querySelector('.buy-actions');
                            if (actionsDiv) actionsDiv.setAttribute('data-selected-qty', stockNum);
                        }
                    }
                    
                    if (buyBtn && !buyBtn.classList.contains('loading')) {
                        buyBtn.classList.remove('no-money');
                        const actionsDiv = card.querySelector('.buy-actions');
                        const qty = parseInt(actionsDiv ? actionsDiv.getAttribute('data-selected-qty') : 1, 10) || 1;
                        const totalCost = price * qty;
                        
                        if (!isServerOnline) {
                            buyBtn.disabled = true;
                        } else if (stock === 0) {
                            buyBtn.disabled = true;
                        } else if (qty > 1 && qty === stock) {
                            // This is the Max button (matches stock). Disable only if they can't even afford 1.
                            if (playerCash < price) {
                                buyBtn.disabled = true;
                                buyBtn.classList.add('no-money');
                            } else {
                                buyBtn.disabled = false;
                            }
                        } else if (stock !== '?' && stock < qty) {
                            buyBtn.disabled = true;
                        } else if (playerCash < totalCost) {
                            buyBtn.disabled = true;
                            buyBtn.classList.add('no-money');
                        } else {
                            buyBtn.disabled = false;
                        }
                    }
                });
            }
            
        } catch (err) {
            serverStatusDiv.textContent = 'Server: Disconnected';
            serverStatusDiv.className = 'status-indicator offline';
            isServerOnline = false;
        }
    }

    // --- Index & Config Logic ---

    async function loadGameConfigs() {
        try {
            itemsGrid.innerHTML = '';
            const res = await fetch('https://build-ur-base-web.onrender.com/api/configs');
            const data = await res.json();
            
            if (Object.keys(data).length === 0) {
                itemsGrid.innerHTML = '';
                return;
            }
            
            gameConfigs = data;
            renderCategory(currentCategory);
        } catch (err) {
            itemsGrid.innerHTML = '';
        }
    }

    function renderCategory(category) {
        document.querySelectorAll('#indexView .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`#indexView .tab-btn[data-tab="${category}"]`).classList.add('active');
        
        itemsGrid.innerHTML = '';
        
        const items = gameConfigs[category];
        if (!items) return;
        
        // Convert to array and sort by Order
        const itemsWithKey = Object.entries(items).map(([k, v]) => ({ ...v, Key: k }));
        const sortedItems = itemsWithKey.sort((a, b) => (a.Order || 0) - (b.Order || 0));

        sortedItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            
            let statsHtml = '';
            // Generic stats
            if (item.Price) statsHtml += `<div class="item-stat">Price <span>${item.Price}</span></div>`;
            if (item.Durability) statsHtml += `<div class="item-stat">Health <span>${item.Durability}</span></div>`;
            if (item.Rarity) statsHtml += `<div class="item-stat">Rarity <span>${item.Rarity}</span></div>`;
            
            // Defense specific
            if (item.Damage) statsHtml += `<div class="item-stat">Damage <span>${item.Damage}</span></div>`;
            if (item.FireRate) statsHtml += `<div class="item-stat">Fire Rate <span>${item.FireRate}s</span></div>`;
            if (item.Range) statsHtml += `<div class="item-stat">Range <span>${item.Range}</span></div>`;
            
            // Chest specific
            if (item.Timer) statsHtml += `<div class="item-stat">Timer <span>${item.Timer}s</span></div>`;
            
            card.innerHTML = `
                ${item.imageUrl ? `<img src="${item.imageUrl}" class="item-img" alt="${item.DisplayName || item.Key}">` : ''}
                <h3>${item.DisplayName || item.Key || 'Unknown'}</h3>
                ${statsHtml}
            `;
            
            itemsGrid.appendChild(card);
        });
    }

    // --- Shop Logic ---
    
    function renderShopCategory(category) {
        if (!gameConfigs) return;
        
        document.querySelectorAll('#shopView .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`#shopView .tab-btn[data-shoptab="${category}"]`).classList.add('active');
        
        shopList.innerHTML = '';
        
        const items = gameConfigs[category];
        if (!items) return;

        const itemsWithKey = Object.entries(items).map(([k, v]) => ({ ...v, Key: k }));
        const sortedItems = itemsWithKey.sort((a, b) => (a.Order || 0) - (b.Order || 0));

        sortedItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item';
            card.setAttribute('data-item-key', item.Key);
            
            const stock = playerStock[item.Key] !== undefined ? playerStock[item.Key] : '?';
            const multiQty = category === 'Chests' ? 3 : 5;
            const price = item.Price || 0;
            
            const stockNum = stock === '?' ? 99 : stock;
            
            card.innerHTML = `
                ${item.imageUrl ? `<img src="${item.imageUrl}" class="shop-item-img" alt="${item.DisplayName || item.Key}">` : '<div class="shop-item-img"></div>'}
                <div class="shop-item-info">
                    <div class="shop-item-title">${item.DisplayName || item.Key || 'Unknown'}</div>
                    <div class="shop-item-stock">Stock: ${stock}</div>
                </div>
                <div class="buy-actions" data-selected-qty="1">
                    <button class="qty-btn selected" data-qty="1">x1 - ${price} 🪙</button>
                    <button class="qty-btn max-qty-btn" data-qty="${stockNum}">x${stockNum} - ${price * stockNum} 🪙</button>
                    <button class="buy-btn execute-buy-btn" data-key="${item.Key}" data-price="${price}">Buy</button>
                </div>
            `;
            
            const actionsDiv = card.querySelector('.buy-actions');
            const qtyBtns = card.querySelectorAll('.qty-btn');
            const executeBtn = card.querySelector('.execute-buy-btn');
            const q1Btn = card.querySelector('.qty-btn:not(.max-qty-btn)');
            const maxQtyBtn = card.querySelector('.max-qty-btn');
            
            if (q1Btn) setButtonTextFitted(q1Btn, `x1 - ${price} 🪙`);
            if (maxQtyBtn) setButtonTextFitted(maxQtyBtn, `x${stockNum} - ${price * stockNum} 🪙`);
            
            qtyBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    qtyBtns.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    const qty = parseInt(btn.getAttribute('data-qty'), 10) || 1;
                    actionsDiv.setAttribute('data-selected-qty', qty);
                    fetchLiveStatus(); // Force state check to update Buy button color/disabled state
                });
            });
            
            executeBtn.addEventListener('click', () => {
                const qty = parseInt(actionsDiv.getAttribute('data-selected-qty'), 10) || 1;
                buyItem(item.Key, executeBtn, qty);
            });
            
            // Initial state check
            if (!isServerOnline || stock === 0) {
                executeBtn.disabled = true;
            } else if (playerCash < price) {
                executeBtn.disabled = true;
                executeBtn.classList.add('no-money');
            }
            
            shopList.appendChild(card);
        });
    }

    async function buyItem(itemKey, btnElement, quantity = 1) {
        if (!isServerOnline) {
            showMessage("Sync is offline. Cannot purchase.", false);
            return;
        }

        btnElement.disabled = true;
        const originalText = btnElement.textContent;
        btnElement.textContent = "Buying...";
        btnElement.classList.add('loading');
        
        showMessage("", false);

        try {
            const res = await fetch('https://build-ur-base-web.onrender.com/api/buyItem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: currentServerId || 'cloud',
                    userId: currentUser.userId,
                    itemKey: itemKey,
                    quantity: quantity
                })
            });

            const data = await res.json();

            if (data.success) {
                showMessage(`Successfully bought ${itemKey}!`, true);
                // Immediately force a live status fetch to update cash/stock
                fetchLiveStatus();
            } else {
                showMessage(data.message || data.error || "Failed to purchase.", false);
            }
            
            btnElement.disabled = false;
            btnElement.textContent = originalText;
            btnElement.classList.remove('loading');
        } catch (err) {
            showMessage("Network error during purchase.", false);
            btnElement.disabled = false;
            btnElement.textContent = originalText;
            btnElement.classList.remove('loading');
        }
    }

    // --- Listeners ---

    document.querySelectorAll('#indexView .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentCategory = e.target.getAttribute('data-tab');
            renderCategory(currentCategory);
        });
    });

    document.querySelectorAll('#shopView .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentShopCategory = e.target.getAttribute('data-shoptab');
            renderShopCategory(currentShopCategory);
        });
    });

    // --- Daily Rewards Logic ---
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
        if (dailyTimerInterval) clearInterval(dailyTimerInterval);
        let remaining = remainingSeconds;
        
        const updateTimer = () => {
            if (remaining <= 0) {
                if (dailyTimerBadge) {
                    dailyTimerBadge.textContent = "Ready to claim";
                    dailyTimerBadge.className = "daily-timer-badge ready";
                }
                clearInterval(dailyTimerInterval);
                dailyTimerInterval = null;
                if (playerDailyReward) playerDailyReward.canClaim = true;
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
            dailyTimerInterval = setInterval(updateTimer, 1000);
        }
    }

    function renderDailyRewards() {
        if (!dailyRewardsList) return;

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
            if (dailyTimerInterval) {
                clearInterval(dailyTimerInterval);
                dailyTimerInterval = null;
            }
        } else {
            startDailyCountdown(remaining);
        }
        
        dailyRewardsList.innerHTML = '';
        
        if (streak <= 7) {
            // Render 7-day progression cards (Text only)
            DAILY_REWARDS_CONFIG.forEach(item => {
                const card = document.createElement('div');
                card.className = 'daily-reward-card';
                
                let statusHtml = '';
                if (item.day < streak) {
                    card.classList.add('claimed');
                    statusHtml = '<span class="daily-badge claimed">✓ Claimed</span>';
                } else if (item.day === streak) {
                    card.classList.add('current');
                    if (canClaim && isServerOnline) {
                        statusHtml = '<button class="daily-claim-btn" id="claimDailyBtn">Claim</button>';
                    } else if (!isServerOnline) {
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
            if (canClaim && isServerOnline) {
                btnHtml = '<button class="daily-claim-btn" id="claimDailyBtn">Claim Daily Bonus</button>';
            } else if (!isServerOnline) {
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
        if (!claimBtn || !isServerOnline || !currentUser) return;
        
        claimBtn.disabled = true;
        claimBtn.classList.add('loading');
        claimBtn.textContent = "Claiming...";
        
        try {
            const res = await fetch('https://build-ur-base-web.onrender.com/api/claimDailyReward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: currentServerId || 'cloud',
                    userId: currentUser.userId
                })
            });
            
            const data = await res.json();
            if (res.ok && data.success) {
                showMessage(data.message || 'Reward claimed!', true);
                await fetchLiveStatus();
                renderDailyRewards();
            } else {
                showMessage(data.message || "Failed to claim reward.", false);
                claimBtn.disabled = false;
                claimBtn.classList.remove('loading');
                claimBtn.textContent = "Claim";
            }
        } catch (err) {
            showMessage("Connection error while claiming.", false);
            claimBtn.disabled = false;
            claimBtn.classList.remove('loading');
            claimBtn.textContent = "Claim";
        }
    }

    // --- Auction Logic ---
    
    function startAuctionSync() {
        if (auctionInterval) stopAuctionSync();
        fetchAuctionStatus();
        auctionInterval = setInterval(fetchAuctionStatus, 1000);
    }
    
    function stopAuctionSync() {
        if (auctionInterval) {
            clearInterval(auctionInterval);
            auctionInterval = null;
        }
    }
    
    async function fetchAuctionStatus() {
        try {
            const res = await fetch('https://build-ur-base-web.onrender.com/api/auction/status');
            const data = await res.json();
            
            if (data.item) {
                lastAuctionState = data;
                updateAuctionUI(data);
            }
        } catch(err) {
            auctionTimer.textContent = "Offline";
        }
    }
    
    function updateAuctionUI(data) {
        // Timer formatting
        const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        auctionTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        
        // Find item display name and image
        let displayName = data.displayName || data.item;
        let imgUrl = data.imageUrl || "";

        if (gameConfigs && gameConfigs[data.category] && gameConfigs[data.category][data.item]) {
            const itemData = gameConfigs[data.category][data.item];
            if (itemData.DisplayName) displayName = itemData.DisplayName;
            if (itemData.imageUrl) imgUrl = itemData.imageUrl;
        }
        
        auctionItemName.textContent = displayName;
        if (imgUrl) {
            auctionImg.src = imgUrl;
            auctionImg.style.display = "block";
        }
        
        auctionQty.textContent = `Amount: ${data.qty}`;
        auctionCurrentBid.textContent = `${data.currentBid || data.startPrice} 🪙`;
        
        if (data.highestBidderId) {
            auctionHighestBidder.textContent = data.highestBidderName;
            if (currentUser && data.highestBidderId === currentUser.userId) {
                auctionHighestBidder.style.color = "#4caf50"; // Highlight green if winning
            } else {
                auctionHighestBidder.style.color = "#4a3b32";
            }
        } else {
            auctionHighestBidder.textContent = "None";
            auctionHighestBidder.style.color = "#4a3b32";
        }
        
        // Bid Button Logic
        const nextRequiredBid = (data.currentBid || data.startPrice) + data.step;
        
        if (remaining <= 0) {
            auctionBidBtn.textContent = "Auction Ended";
            auctionBidBtn.disabled = true;
        } else if (currentUser && data.highestBidderId === currentUser.userId) {
            auctionBidBtn.textContent = "You are highest!";
            auctionBidBtn.disabled = true;
        } else if (playerCash < nextRequiredBid) {
            auctionBidBtn.textContent = `Bid ${nextRequiredBid} 🪙 (Not enough)`;
            auctionBidBtn.disabled = true;
        } else {
            auctionBidBtn.textContent = `Bid ${nextRequiredBid} 🪙`;
            auctionBidBtn.disabled = false;
        }
    }
    
    auctionBidBtn.addEventListener('click', async () => {
        if (!lastAuctionState || !currentUser) return;
        
        const bidAmount = (lastAuctionState.currentBid || lastAuctionState.startPrice) + lastAuctionState.step;
        
        auctionBidBtn.disabled = true;
        auctionBidBtn.textContent = "Bidding...";
        
        try {
            const res = await fetch('https://build-ur-base-web.onrender.com/api/auction/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.userId,
                    username: currentUser.username,
                    bidAmount: bidAmount
                })
            });
            const data = await res.json();
            
            if (data.success) {
                showMessage("Bid placed successfully!", true);
                fetchAuctionStatus(); // immediately refresh
            } else {
                showMessage(data.error || "Failed to place bid.", false);
                auctionBidBtn.disabled = false;
            }
        } catch(err) {
            showMessage("Network error.", false);
            auctionBidBtn.disabled = false;
        }
    });

    // --- Navigation Listeners ---
    navIndexBtn.addEventListener('click', () => {
        navIndexBtn.classList.add('active');
        navShopBtn.classList.remove('active');
        navAuctionBtn.classList.remove('active');
        navDailyBtn.classList.remove('active');
        if (navMarketplaceBtn) navMarketplaceBtn.classList.remove('active');
        indexView.classList.remove('hidden');
        shopView.classList.add('hidden');
        auctionView.classList.add('hidden');
        dailyView.classList.add('hidden');
        if (marketplaceView) marketplaceView.classList.add('hidden');
    });

    navShopBtn.addEventListener('click', () => {
        navShopBtn.classList.add('active');
        navIndexBtn.classList.remove('active');
        navAuctionBtn.classList.remove('active');
        navDailyBtn.classList.remove('active');
        if (navMarketplaceBtn) navMarketplaceBtn.classList.remove('active');
        shopView.classList.remove('hidden');
        indexView.classList.add('hidden');
        auctionView.classList.add('hidden');
        dailyView.classList.add('hidden');
        if (marketplaceView) marketplaceView.classList.add('hidden');
        renderShopCategory(currentShopCategory);
    });

    navAuctionBtn.addEventListener('click', () => {
        navAuctionBtn.classList.add('active');
        navIndexBtn.classList.remove('active');
        navShopBtn.classList.remove('active');
        navDailyBtn.classList.remove('active');
        if (navMarketplaceBtn) navMarketplaceBtn.classList.remove('active');
        auctionView.classList.remove('hidden');
        indexView.classList.add('hidden');
        shopView.classList.add('hidden');
        dailyView.classList.add('hidden');
        if (marketplaceView) marketplaceView.classList.add('hidden');
    });

    navDailyBtn.addEventListener('click', () => {
        navDailyBtn.classList.add('active');
        navIndexBtn.classList.remove('active');
        navShopBtn.classList.remove('active');
        navAuctionBtn.classList.remove('active');
        if (navMarketplaceBtn) navMarketplaceBtn.classList.remove('active');
        dailyView.classList.remove('hidden');
        indexView.classList.add('hidden');
        shopView.classList.add('hidden');
        auctionView.classList.add('hidden');
        if (marketplaceView) marketplaceView.classList.add('hidden');
        renderDailyRewards();
    });

    if (navMarketplaceBtn) {
        navMarketplaceBtn.addEventListener('click', () => {
            navMarketplaceBtn.classList.add('active');
            navIndexBtn.classList.remove('active');
            navShopBtn.classList.remove('active');
            navAuctionBtn.classList.remove('active');
            navDailyBtn.classList.remove('active');
            marketplaceView.classList.remove('hidden');
            indexView.classList.add('hidden');
            shopView.classList.add('hidden');
            auctionView.classList.add('hidden');
            dailyView.classList.add('hidden');

            fetchMarketplaceOffers();
        });
    }

    // Modal Control Functions
    function openCreateOfferModal() {
        if (!mktCreateModal) return;
        mktCreateModal.classList.remove('hidden');
        renderMarketplaceInventory();
        renderMarketplaceBundle();
        updateMarketplaceCreateButton();
    }

    function closeCreateOfferModal() {
        if (!mktCreateModal) return;
        mktCreateModal.classList.add('hidden');
    }

    if (mktOpenCreateModalBtn) {
        mktOpenCreateModalBtn.addEventListener('click', openCreateOfferModal);
    }

    if (mktCloseModalBtn) {
        mktCloseModalBtn.addEventListener('click', closeCreateOfferModal);
    }

    if (mktCreateModal) {
        mktCreateModal.addEventListener('click', (e) => {
            if (e.target === mktCreateModal) {
                closeCreateOfferModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mktCreateModal && !mktCreateModal.classList.contains('hidden')) {
            closeCreateOfferModal();
        }
    });

    // --- P2P Marketplace ("Sell & Buy") Logic ---

    function getItemDetails(itemKey) {
        if (gameConfigs) {
            for (const cat in gameConfigs) {
                if (gameConfigs[cat] && gameConfigs[cat][itemKey]) {
                    const cfg = gameConfigs[cat][itemKey];
                    return {
                        category: cat,
                        displayName: cfg.DisplayName || itemKey,
                        imageUrl: cfg.imageUrl || ''
                    };
                }
            }
        }
        return {
            category: 'Items',
            displayName: itemKey,
            imageUrl: ''
        };
    }

    function formatTimeAgo(dateInput) {
        if (!dateInput) return '';
        const now = Date.now();
        const then = new Date(dateInput).getTime();
        const diffSec = Math.max(0, Math.floor((now - then) / 1000));
        if (diffSec < 60) return 'Just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour}h ago`;
        const diffDay = Math.floor(diffHour / 24);
        return `${diffDay}d ago`;
    }

    async function fetchMarketplaceOffers() {
        try {
            const res = await fetch('https://build-ur-base-web.onrender.com/api/marketplace/offers');
            const data = await res.json();
            if (data.success && Array.isArray(data.offers)) {
                renderMarketplaceOffers(data.offers);
            }
        } catch (err) {
            console.error('[Marketplace] Error fetching offers:', err);
        }
    }

    function renderMarketplaceOffers(offers) {
        if (!mktOffersGrid || !mktListingsCount) return;
        mktListingsCount.textContent = `${offers.length} ${offers.length === 1 ? 'Listing' : 'Listings'}`;
        mktOffersGrid.innerHTML = '';

        if (offers.length === 0) {
            mktOffersGrid.innerHTML = '<div class="mkt-empty-grid">No active marketplace offers right now. Be the first to create one below!</div>';
            return;
        }

        offers.forEach(offer => {
            const card = document.createElement('div');
            card.className = 'mkt-card';

            const isOwnOffer = currentUser && String(currentUser.userId) === String(offer.sellerId);
            const canAfford = playerCash >= offer.price;

            let itemsHtml = '';
            (offer.items || []).forEach(it => {
                const details = getItemDetails(it.itemKey);
                const img = it.imageUrl || details.imageUrl || '';
                const name = it.displayName || details.displayName || it.itemKey;
                itemsHtml += `
                    <div class="mkt-card-item-chip" title="${name}">
                        ${img ? `<img src="${img}" alt="${name}">` : `<div style="width:32px;height:32px;background:#f5f0eb;border-radius:4px;"></div>`}
                        <span class="mkt-chip-qty">x${it.quantity}</span>
                        <div class="mkt-chip-name-hover">${name}</div>
                    </div>
                `;
            });

            const avatarStyle = offer.sellerAvatar ? `style="background-image: url('${offer.sellerAvatar}')"` : '';
            const timeAgo = formatTimeAgo(offer.createdAt);

            card.innerHTML = `
                <div class="mkt-card-seller">
                    <div class="mkt-seller-avatar" ${avatarStyle}></div>
                    <div class="mkt-seller-info">
                        <span class="mkt-seller-name">${offer.sellerName}${isOwnOffer ? ' (You)' : ''}</span>
                        <span class="mkt-offer-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="mkt-card-items">
                    ${itemsHtml}
                </div>
                <div class="mkt-card-footer">
                    <div class="mkt-card-price">
                        <span class="mkt-price-label">Price</span>
                        <span class="mkt-price-val">${offer.price.toLocaleString('de-DE')} 🪙</span>
                    </div>
                    ${isOwnOffer 
                        ? `<button class="mkt-cancel-btn" data-offer-id="${offer.offerId}">Cancel</button>`
                        : `<button class="mkt-buy-btn" data-offer-id="${offer.offerId}" ${!canAfford ? 'disabled' : ''}>${canAfford ? `Buy` : `Need Coins`}</button>`
                    }
                </div>
            `;

            if (isOwnOffer) {
                const cancelBtn = card.querySelector('.mkt-cancel-btn');
                cancelBtn.addEventListener('click', () => cancelMarketplaceOffer(offer.offerId));
            } else {
                const buyBtn = card.querySelector('.mkt-buy-btn');
                if (buyBtn && canAfford) {
                    buyBtn.addEventListener('click', () => buyMarketplaceOffer(offer.offerId, offer.price));
                }
            }

            mktOffersGrid.appendChild(card);
        });
    }

    async function buyMarketplaceOffer(offerId, price) {
        if (!currentUser) return;
        if (playerCash < price) {
            showMessage("You don't have enough coins for this offer!", false);
            return;
        }

        const confirmBuy = confirm(`Do you want to buy this offer for ${price.toLocaleString('de-DE')} coins?`);
        if (!confirmBuy) return;

        try {
            showMessage("Purchasing offer...", true);
            const res = await fetch('https://build-ur-base-web.onrender.com/api/marketplace/buyOffer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyerId: currentUser.userId,
                    buyerName: currentUser.username,
                    offerId: offerId
                })
            });
            const data = await res.json();
            if (data.success) {
                showMessage("Offer purchased successfully! Items are being delivered.", true);
                fetchMarketplaceOffers();
                fetchLiveStatus();
            } else {
                showMessage(data.error || "Failed to purchase offer.", false);
            }
        } catch (err) {
            console.error('[Marketplace] Buy error:', err);
            showMessage("Failed to contact server.", false);
        }
    }

    async function cancelMarketplaceOffer(offerId) {
        if (!currentUser) return;
        const confirmCancel = confirm("Do you want to cancel this offer and return the items to your inventory?");
        if (!confirmCancel) return;

        try {
            showMessage("Cancelling offer...", true);
            const res = await fetch('https://build-ur-base-web.onrender.com/api/marketplace/cancelOffer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.userId,
                    offerId: offerId
                })
            });
            const data = await res.json();
            if (data.success) {
                showMessage("Offer cancelled. Items returned to your inventory!", true);
                fetchMarketplaceOffers();
                fetchLiveStatus();
            } else {
                showMessage(data.error || "Failed to cancel offer.", false);
            }
        } catch (err) {
            console.error('[Marketplace] Cancel error:', err);
            showMessage("Failed to contact server.", false);
        }
    }

    function renderMarketplaceInventory() {
        if (!mktMyInventoryList) return;
        mktMyInventoryList.innerHTML = '';

        const invKeys = Object.keys(playerInventory).filter(k => {
            if (!playerInventory[k] || playerInventory[k] <= 0) return false;
            const details = getItemDetails(k);
            const isChest = (details.category && details.category.toLowerCase() === 'chests')
                || k.toLowerCase().includes('chest')
                || (details.displayName && details.displayName.toLowerCase().includes('chest'));
            return !isChest;
        });

        if (invKeys.length === 0) {
            mktMyInventoryList.innerHTML = '<p class="mkt-empty-text">No eligible unplaced items found in your Roblox inventory. (Chests and blocks built on your base cannot be traded).</p>';
            return;
        }

        invKeys.forEach(itemKey => {
            const totalCount = playerInventory[itemKey] || 0;
            const inBundle = currentOfferBundle[itemKey] ? currentOfferBundle[itemKey].quantity : 0;
            const remaining = totalCount - inBundle;

            const details = getItemDetails(itemKey);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'mkt-inv-item';
            if (remaining <= 0) {
                itemDiv.style.opacity = '0.4';
                itemDiv.style.cursor = 'not-allowed';
            }

            itemDiv.innerHTML = `
                ${details.imageUrl ? `<img src="${details.imageUrl}" alt="${details.displayName}">` : `<div style="width:34px;height:34px;background:#f7f2eb;border-radius:6px;"></div>`}
                <div class="mkt-inv-item-info">
                    <span class="mkt-inv-item-name">${details.displayName}</span>
                    <span class="mkt-inv-item-cat">${details.category}</span>
                </div>
                <span class="mkt-inv-item-count">x${remaining}</span>
            `;

            if (remaining > 0) {
                itemDiv.addEventListener('click', () => {
                    addItemToBundle(itemKey, details);
                });
            }

            mktMyInventoryList.appendChild(itemDiv);
        });
    }

    function addItemToBundle(itemKey, details) {
        const isChest = (details.category && details.category.toLowerCase() === 'chests')
            || itemKey.toLowerCase().includes('chest')
            || (details.displayName && details.displayName.toLowerCase().includes('chest'));
        if (isChest) {
            showMessage("Chests cannot be traded!", false);
            return;
        }

        const totalOwned = playerInventory[itemKey] || 0;
        if (!currentOfferBundle[itemKey]) {
            currentOfferBundle[itemKey] = {
                itemKey: itemKey,
                category: details.category,
                displayName: details.displayName,
                imageUrl: details.imageUrl,
                quantity: 1
            };
        } else {
            if (currentOfferBundle[itemKey].quantity < totalOwned) {
                currentOfferBundle[itemKey].quantity++;
            }
        }

        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function removeItemFromBundle(itemKey) {
        if (currentOfferBundle[itemKey]) {
            currentOfferBundle[itemKey].quantity--;
            if (currentOfferBundle[itemKey].quantity <= 0) {
                delete currentOfferBundle[itemKey];
            }
        }
        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function deleteItemFromBundle(itemKey) {
        if (currentOfferBundle[itemKey]) {
            delete currentOfferBundle[itemKey];
        }
        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function clearBundle() {
        currentOfferBundle = {};
        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function renderMarketplaceBundle() {
        if (!mktBundleList) return;
        mktBundleList.innerHTML = '';

        const bundleKeys = Object.keys(currentOfferBundle);

        if (bundleKeys.length === 0) {
            mktBundleList.innerHTML = '<p class="mkt-empty-text">No items added yet. Click items on the left!</p>';
            if (mktClearBundleBtn) mktClearBundleBtn.style.display = 'none';
            return;
        }

        if (mktClearBundleBtn) mktClearBundleBtn.style.display = 'inline-block';

        bundleKeys.forEach(key => {
            const item = currentOfferBundle[key];
            const totalOwned = playerInventory[key] || 0;

            const row = document.createElement('div');
            row.className = 'mkt-bundle-item';

            row.innerHTML = `
                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.displayName}">` : `<div style="width:30px;height:30px;background:#f7f2eb;border-radius:4px;"></div>`}
                <span class="mkt-bundle-item-name">${item.displayName}</span>
                <div class="mkt-qty-controls">
                    <button class="mkt-qty-btn minus" title="Decrease">-</button>
                    <span class="mkt-bundle-qty">${item.quantity}</span>
                    <button class="mkt-qty-btn plus" title="Increase" ${item.quantity >= totalOwned ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>+</button>
                </div>
                <button class="mkt-remove-item-btn" title="Remove">✕</button>
            `;

            row.querySelector('.mkt-qty-btn.minus').addEventListener('click', () => removeItemFromBundle(key));
            const plusBtn = row.querySelector('.mkt-qty-btn.plus');
            if (item.quantity < totalOwned) {
                plusBtn.addEventListener('click', () => {
                    addItemToBundle(key, item);
                });
            }
            row.querySelector('.mkt-remove-item-btn').addEventListener('click', () => deleteItemFromBundle(key));

            mktBundleList.appendChild(row);
        });
    }

    function updateMarketplaceCreateButton() {
        if (!mktPayoutInput || !mktCreateBtn) return;

        const payout = Math.max(0, parseInt(mktPayoutInput.value, 10) || 0);
        const hasItems = Object.keys(currentOfferBundle).length > 0;
        const fee = Math.ceil(payout * 0.05);

        if (payout > 0) {
            mktCreateBtn.textContent = `Create (${fee.toLocaleString('de-DE')} 🪙 Fee)`;
        } else {
            mktCreateBtn.textContent = 'Create (0 🪙 Fee)';
        }

        if (hasItems && payout > 0) {
            if (playerCash < fee) {
                mktCreateBtn.disabled = true;
                mktCreateBtn.textContent = `Create (Need ${fee.toLocaleString('de-DE')} 🪙 Fee)`;
            } else {
                mktCreateBtn.disabled = false;
            }
        } else {
            mktCreateBtn.disabled = true;
        }
    }

    if (mktPayoutInput) {
        mktPayoutInput.addEventListener('input', () => {
            updateMarketplaceCreateButton();
        });
    }

    if (mktClearBundleBtn) {
        mktClearBundleBtn.addEventListener('click', clearBundle);
    }

    if (mktRefreshBtn) {
        mktRefreshBtn.addEventListener('click', () => {
            fetchMarketplaceOffers();
            showMessage("Refreshed listings.", true);
        });
    }

    if (mktCreateBtn) {
        mktCreateBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            const payout = Math.max(0, parseInt(mktPayoutInput.value, 10) || 0);
            const bundleItems = Object.values(currentOfferBundle);
            const fee = Math.ceil(payout * 0.05);

            if (bundleItems.length === 0) {
                showMessage("Please select at least one item for your offer!", false);
                return;
            }

            if (payout <= 0) {
                showMessage("Please enter a valid price greater than 0!", false);
                return;
            }

            if (playerCash < fee) {
                showMessage(`You do not have enough coins to pay the 5% creation fee (${fee} coins)!`, false);
                return;
            }

            mktCreateBtn.disabled = true;
            mktCreateBtn.textContent = "Creating...";

            try {
                const res = await fetch('https://build-ur-base-web.onrender.com/api/marketplace/createOffer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sellerId: currentUser.userId,
                        sellerName: currentUser.username,
                        sellerAvatar: currentUser.avatarUrl,
                        items: bundleItems,
                        sellerPayout: payout
                    })
                });

                const data = await res.json();

                if (data.success) {
                    showMessage(`Offer created and listed for ${data.offer.price.toLocaleString('de-DE')} coins! 5% creation fee (${data.offer.fee} coins) was deducted from your balance.`, true);
                    currentOfferBundle = {};
                    mktPayoutInput.value = '';
                    closeCreateOfferModal();
                    fetchMarketplaceOffers();
                    fetchLiveStatus();
                } else {
                    showMessage(data.error || "Failed to create offer.", false);
                    updateMarketplaceCreateButton();
                }
            } catch (err) {
                console.error('[Marketplace] Create error:', err);
                showMessage("Failed to contact server.", false);
                updateMarketplaceCreateButton();
            }
        });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!shopView.classList.contains('hidden')) {
                document.querySelectorAll('.shop-item').forEach(card => {
                    const q1 = card.querySelector('.qty-btn:not(.max-qty-btn)');
                    const qMax = card.querySelector('.max-qty-btn');
                    if (q1) setButtonTextFitted(q1, q1.textContent);
                    if (qMax) setButtonTextFitted(qMax, qMax.textContent);
                });
            }
        }, 100);
    });

});


