/* ==========================================================================
   SHOP: ITEM PURCHASES & STOCK MANAGEMENT
   ========================================================================== */

(function () {
    const shopList = document.getElementById('shopList');

    function renderShopCategory(category) {
        window.APP.currentShopCategory = category;
        if (!window.APP.gameConfigs || !shopList) return;

        document.querySelectorAll('#shopView .tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`#shopView .tab-btn[data-shoptab="${category}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        shopList.innerHTML = '';

        const items = window.APP.gameConfigs[category];
        if (!items) return;

        const itemsWithKey = Object.entries(items).map(([k, v]) => ({ ...v, Key: k }));
        const sortedItems = itemsWithKey.sort((a, b) => (a.Order || 0) - (b.Order || 0));

        sortedItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item';
            card.setAttribute('data-item-key', item.Key);

            const stock = window.APP.playerStock[item.Key] !== undefined ? window.APP.playerStock[item.Key] : '?';
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

            if (q1Btn) window.APP.setButtonTextFitted(q1Btn, `x1 - ${price} 🪙`);
            if (maxQtyBtn) window.APP.setButtonTextFitted(maxQtyBtn, `x${stockNum} - ${price * stockNum} 🪙`);

            qtyBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    qtyBtns.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    const qty = parseInt(btn.getAttribute('data-qty'), 10) || 1;
                    actionsDiv.setAttribute('data-selected-qty', qty);
                    if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
                });
            });

            executeBtn.addEventListener('click', () => {
                const qty = parseInt(actionsDiv.getAttribute('data-selected-qty'), 10) || 1;
                buyItem(item.Key, executeBtn, qty);
            });

            // Initial state check
            if (!window.APP.isServerOnline || stock === 0) {
                executeBtn.disabled = true;
            } else if (window.APP.playerCash < price) {
                executeBtn.disabled = true;
                executeBtn.classList.add('no-money');
            }

            shopList.appendChild(card);
        });
    }

    async function buyItem(itemKey, btnElement, quantity = 1) {
        if (!window.APP.isServerOnline) {
            window.APP.showMessage("Sync is offline. Cannot purchase.", false);
            return;
        }

        const currentUser = window.APP.currentUser;
        if (!currentUser || !currentUser.userId) return;

        btnElement.disabled = true;
        const originalText = btnElement.textContent;
        btnElement.textContent = "Buying...";
        btnElement.classList.add('loading');
        window.APP.showMessage("", false);

        try {
            const res = await fetch(`${window.APP.API_BASE}/api/buyItem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: window.APP.currentServerId || 'cloud',
                    userId: currentUser.userId,
                    itemKey: itemKey,
                    quantity: quantity
                })
            });

            const data = await res.json();

            if (data.success) {
                window.APP.showMessage(`Successfully bought ${itemKey}!`, true);
                if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
            } else {
                window.APP.showMessage(data.message || data.error || "Failed to purchase.", false);
            }

            btnElement.disabled = false;
            btnElement.textContent = originalText;
            btnElement.classList.remove('loading');
        } catch (err) {
            window.APP.showMessage("Network error during purchase.", false);
            btnElement.disabled = false;
            btnElement.textContent = originalText;
            btnElement.classList.remove('loading');
        }
    }

    // Shop tab button listeners
    document.querySelectorAll('#shopView .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = e.target.getAttribute('data-shoptab');
            renderShopCategory(cat);
        });
    });

    // Window resize debounce for responsive button text fitting
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const shopView = document.getElementById('shopView');
            if (shopView && !shopView.classList.contains('hidden')) {
                document.querySelectorAll('.shop-item').forEach(card => {
                    const q1 = card.querySelector('.qty-btn:not(.max-qty-btn)');
                    const qMax = card.querySelector('.max-qty-btn');
                    if (q1) window.APP.setButtonTextFitted(q1, q1.textContent);
                    if (qMax) window.APP.setButtonTextFitted(qMax, qMax.textContent);
                });
            }
        }, 100);
    });

    window.APP.renderShopCategory = renderShopCategory;
    window.APP.buyItem = buyItem;
})();
