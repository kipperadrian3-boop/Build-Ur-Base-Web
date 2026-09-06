/* ==========================================================================
   LIVE SYNC: STATUS POLLING & REAL-TIME STATE SYNC
   ========================================================================== */

(function () {
    const serverStatusDiv = document.getElementById('serverStatus');
    const playerCashSpan = document.getElementById('playerCash');
    const dailyView = document.getElementById('dailyView');
    const shopView = document.getElementById('shopView');
    const mktCreateModal = document.getElementById('mktCreateModal');

    function startLiveSync() {
        if (window.APP.syncInterval) stopLiveSync();
        fetchLiveStatus();
        window.APP.syncInterval = setInterval(fetchLiveStatus, 5000);
    }

    function stopLiveSync() {
        if (window.APP.syncInterval) {
            clearInterval(window.APP.syncInterval);
            window.APP.syncInterval = null;
        }
    }

    async function fetchLiveStatus() {
        const currentUser = window.APP.currentUser;
        if (!currentUser || !currentUser.userId) return;

        try {
            const res = await fetch(`${window.APP.API_BASE}/api/status/${currentUser.userId}`);
            const data = await res.json();

            window.APP.isServerOnline = data.isServerOnline;
            window.APP.currentServerId = data.currentServerId;
            window.APP.playerStock = data.playerStock || {};
            window.APP.playerCash = data.playerCash || 0;
            window.APP.playerDailyReward = data.dailyReward || null;
            window.APP.playerInventory = data.playerInventory || {};

            if (serverStatusDiv) {
                if (data.isGameServerRunning) {
                    serverStatusDiv.textContent = 'Server: Online';
                    serverStatusDiv.className = 'status-indicator online';
                } else if (data.isOpenCloudActive) {
                    serverStatusDiv.textContent = 'Cloud Sync: Active';
                    serverStatusDiv.className = 'status-indicator online';
                } else if (data.isServerOnline) {
                    serverStatusDiv.textContent = 'Server: Online';
                    serverStatusDiv.className = 'status-indicator online';
                } else {
                    serverStatusDiv.textContent = 'Server: Offline';
                    serverStatusDiv.className = 'status-indicator offline';
                }
            }

            if (playerCashSpan) {
                playerCashSpan.textContent = `🪙 ${window.APP.playerCash.toLocaleString('de-DE')}`;
            }

            // Update daily rewards if visible
            if (dailyView && !dailyView.classList.contains('hidden') && window.APP.renderDailyRewards) {
                window.APP.renderDailyRewards();
            }

            // Update marketplace inventory if modal is open
            if (mktCreateModal && !mktCreateModal.classList.contains('hidden') && window.APP.renderMarketplaceInventory) {
                window.APP.renderMarketplaceInventory();
            }

            // Update shop item stock in place if visible
            if (shopView && !shopView.classList.contains('hidden')) {
                updateShopItemsStockInPlace();
            }

        } catch (err) {
            if (serverStatusDiv) {
                serverStatusDiv.textContent = 'Server: Disconnected';
                serverStatusDiv.className = 'status-indicator offline';
            }
            window.APP.isServerOnline = false;
        }
    }

    function updateShopItemsStockInPlace() {
        document.querySelectorAll('.shop-item').forEach(card => {
            const stockDiv = card.querySelector('.shop-item-stock');
            const key = card.getAttribute('data-item-key');
            const stock = window.APP.playerStock[key] !== undefined ? window.APP.playerStock[key] : '?';
            if (stockDiv) stockDiv.textContent = `Stock: ${stock}`;

            const buyBtn = card.querySelector('.execute-buy-btn');
            const price = parseInt(buyBtn ? buyBtn.getAttribute('data-price') : 0, 10) || 0;

            const maxQtyBtn = card.querySelector('.max-qty-btn');
            if (maxQtyBtn) {
                const stockNum = stock === '?' ? 99 : stock;
                maxQtyBtn.setAttribute('data-qty', stockNum);
                window.APP.setButtonTextFitted(maxQtyBtn, `x${stockNum} - ${price * stockNum} 🪙`);

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

                if (!window.APP.isServerOnline) {
                    buyBtn.disabled = true;
                } else if (stock === 0) {
                    buyBtn.disabled = true;
                } else if (qty > 1 && qty === stock) {
                    if (window.APP.playerCash < price) {
                        buyBtn.disabled = true;
                        buyBtn.classList.add('no-money');
                    } else {
                        buyBtn.disabled = false;
                    }
                } else if (stock !== '?' && stock < qty) {
                    buyBtn.disabled = true;
                } else if (window.APP.playerCash < totalCost) {
                    buyBtn.disabled = true;
                    buyBtn.classList.add('no-money');
                } else {
                    buyBtn.disabled = false;
                }
            }
        });
    }

    window.APP.startLiveSync = startLiveSync;
    window.APP.stopLiveSync = stopLiveSync;
    window.APP.fetchLiveStatus = fetchLiveStatus;
    window.APP.updateShopItemsStockInPlace = updateShopItemsStockInPlace;
})();
