/* ==========================================================================
   MARKETPLACE: P2P SELL & BUY SYSTEM, BUNDLES & OFFERS
   ========================================================================== */

(function () {
    const marketplaceView = document.getElementById('marketplaceView');
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

    function getItemDetails(itemKey) {
        const configs = window.APP.gameConfigs;
        if (configs) {
            for (const cat in configs) {
                if (configs[cat] && configs[cat][itemKey]) {
                    const cfg = configs[cat][itemKey];
                    return {
                        category: cat,
                        displayName: cfg.DisplayName || itemKey,
                        imageUrl: cfg.imageUrl || '',
                        price: cfg.Price || 0
                    };
                }
            }
        }
        return {
            category: 'Items',
            displayName: itemKey,
            imageUrl: '',
            price: 0
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
            const res = await fetch(`${window.APP.API_BASE}/api/marketplace/offers`);
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

        const currentUser = window.APP.currentUser;

        offers.forEach(offer => {
            const card = document.createElement('div');
            card.className = 'mkt-card';

            const isOwnOffer = currentUser && String(currentUser.userId) === String(offer.sellerId);
            const canAfford = window.APP.playerCash >= offer.price;

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
        const currentUser = window.APP.currentUser;
        if (!currentUser) return;

        if (window.APP.playerCash < price) {
            window.APP.showMessage("You don't have enough coins for this offer!", false);
            return;
        }

        const confirmBuy = confirm(`Do you want to buy this offer for ${price.toLocaleString('de-DE')} coins?`);
        if (!confirmBuy) return;

        try {
            window.APP.showMessage("Purchasing offer...", true);
            const res = await fetch(`${window.APP.API_BASE}/api/marketplace/buyOffer`, {
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
                window.APP.showMessage("Offer purchased successfully! Items are being delivered.", true);
                fetchMarketplaceOffers();
                if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
            } else {
                window.APP.showMessage(data.error || "Failed to purchase offer.", false);
            }
        } catch (err) {
            console.error('[Marketplace] Buy error:', err);
            window.APP.showMessage("Failed to contact server.", false);
        }
    }

    async function cancelMarketplaceOffer(offerId) {
        const currentUser = window.APP.currentUser;
        if (!currentUser) return;

        const confirmCancel = confirm("Do you want to cancel this offer and return the items to your inventory?");
        if (!confirmCancel) return;

        try {
            window.APP.showMessage("Cancelling offer...", true);
            const res = await fetch(`${window.APP.API_BASE}/api/marketplace/cancelOffer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.userId,
                    offerId: offerId
                })
            });
            const data = await res.json();
            if (data.success) {
                window.APP.showMessage("Offer cancelled. Items returned to your inventory!", true);
                fetchMarketplaceOffers();
                if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
            } else {
                window.APP.showMessage(data.error || "Failed to cancel offer.", false);
            }
        } catch (err) {
            console.error('[Marketplace] Cancel error:', err);
            window.APP.showMessage("Failed to contact server.", false);
        }
    }

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

    function renderMarketplaceInventory() {
        if (!mktMyInventoryList) return;
        mktMyInventoryList.innerHTML = '';

        const playerInv = window.APP.playerInventory || {};
        const bundle = window.APP.currentOfferBundle || {};

        const invKeys = Object.keys(playerInv).filter(k => {
            if (!playerInv[k] || playerInv[k] <= 0) return false;
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
            const totalCount = playerInv[itemKey] || 0;
            const inBundle = bundle[itemKey] ? bundle[itemKey].quantity : 0;
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
            window.APP.showMessage("Chests cannot be traded!", false);
            return;
        }

        const playerInv = window.APP.playerInventory || {};
        const totalOwned = playerInv[itemKey] || 0;
        const bundle = window.APP.currentOfferBundle;

        if (!bundle[itemKey]) {
            bundle[itemKey] = {
                itemKey: itemKey,
                category: details.category,
                displayName: details.displayName,
                imageUrl: details.imageUrl,
                price: details.price || 0,
                quantity: 1
            };
        } else {
            if (bundle[itemKey].quantity < totalOwned) {
                bundle[itemKey].quantity++;
            }
        }

        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function removeItemFromBundle(itemKey) {
        const bundle = window.APP.currentOfferBundle;
        if (bundle[itemKey]) {
            bundle[itemKey].quantity--;
            if (bundle[itemKey].quantity <= 0) {
                delete bundle[itemKey];
            }
        }
        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function deleteItemFromBundle(itemKey) {
        const bundle = window.APP.currentOfferBundle;
        if (bundle[itemKey]) {
            delete bundle[itemKey];
        }
        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function clearBundle() {
        window.APP.currentOfferBundle = {};
        renderMarketplaceBundle();
        renderMarketplaceInventory();
        updateMarketplaceCreateButton();
    }

    function renderMarketplaceBundle() {
        if (!mktBundleList) return;
        mktBundleList.innerHTML = '';

        const bundle = window.APP.currentOfferBundle;
        const bundleKeys = Object.keys(bundle);

        if (bundleKeys.length === 0) {
            mktBundleList.innerHTML = '<p class="mkt-empty-text">No items added yet. Click items on the left!</p>';
            if (mktClearBundleBtn) mktClearBundleBtn.style.display = 'none';
            return;
        }

        if (mktClearBundleBtn) mktClearBundleBtn.style.display = 'inline-block';

        const playerInv = window.APP.playerInventory || {};

        bundleKeys.forEach(key => {
            const item = bundle[key];
            const totalOwned = playerInv[key] || 0;

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

    function calculateBundleShopValue() {
        let total = 0;
        const bundle = window.APP.currentOfferBundle;
        for (const key in bundle) {
            const item = bundle[key];
            const details = getItemDetails(key);
            const unitPrice = (details && typeof details.price === 'number') ? details.price : (item.price || 0);
            total += unitPrice * (item.quantity || 1);
        }
        return total;
    }

    function updateMarketplacePricePlaceholder() {
        if (!mktPayoutInput) return;
        const total = calculateBundleShopValue();
        if (total > 0) {
            mktPayoutInput.placeholder = `Recommended: ${total}`;
        } else {
            mktPayoutInput.placeholder = 'Recommended: 0';
        }
    }

    function updateMarketplaceCreateButton() {
        if (!mktPayoutInput || !mktCreateBtn) return;

        updateMarketplacePricePlaceholder();

        const payout = Math.max(0, parseInt(mktPayoutInput.value, 10) || 0);
        const hasItems = Object.keys(window.APP.currentOfferBundle).length > 0;
        const fee = Math.ceil(payout * 0.05);

        if (payout > 0) {
            mktCreateBtn.textContent = `Create (${fee.toLocaleString('de-DE')} 🪙 Fee)`;
        } else {
            mktCreateBtn.textContent = 'Create (0 🪙 Fee)';
        }

        if (hasItems && payout > 0) {
            if (window.APP.playerCash < fee) {
                mktCreateBtn.disabled = true;
                mktCreateBtn.textContent = `Create (Need ${fee.toLocaleString('de-DE')} 🪙 Fee)`;
            } else {
                mktCreateBtn.disabled = false;
            }
        } else {
            mktCreateBtn.disabled = true;
        }
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
            window.APP.showMessage("Refreshed listings.", true);
        });
    }

    if (mktCreateBtn) {
        mktCreateBtn.addEventListener('click', async () => {
            const currentUser = window.APP.currentUser;
            if (!currentUser) return;

            const payout = Math.max(0, parseInt(mktPayoutInput.value, 10) || 0);
            const bundleItems = Object.values(window.APP.currentOfferBundle);
            const fee = Math.ceil(payout * 0.05);

            if (bundleItems.length === 0) {
                window.APP.showMessage("Please select at least one item for your offer!", false);
                return;
            }

            if (payout <= 0) {
                window.APP.showMessage("Please enter a valid price greater than 0!", false);
                return;
            }

            if (window.APP.playerCash < fee) {
                window.APP.showMessage(`You do not have enough coins to pay the 5% creation fee (${fee} coins)!`, false);
                return;
            }

            mktCreateBtn.disabled = true;
            mktCreateBtn.textContent = "Creating...";

            try {
                const res = await fetch(`${window.APP.API_BASE}/api/marketplace/createOffer`, {
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
                    window.APP.showMessage(`Offer created and listed for ${data.offer.price.toLocaleString('de-DE')} coins! 5% creation fee (${data.offer.fee} coins) was deducted from your balance.`, true);
                    window.APP.currentOfferBundle = {};
                    mktPayoutInput.value = '';
                    closeCreateOfferModal();
                    fetchMarketplaceOffers();
                    if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
                } else {
                    window.APP.showMessage(data.error || "Failed to create offer.", false);
                    updateMarketplaceCreateButton();
                }
            } catch (err) {
                console.error('[Marketplace] Create error:', err);
                window.APP.showMessage("Failed to contact server.", false);
                updateMarketplaceCreateButton();
            }
        });
    }

    window.APP.getItemDetails = getItemDetails;
    window.APP.fetchMarketplaceOffers = fetchMarketplaceOffers;
    window.APP.renderMarketplaceOffers = renderMarketplaceOffers;
    window.APP.openCreateOfferModal = openCreateOfferModal;
    window.APP.closeCreateOfferModal = closeCreateOfferModal;
    window.APP.renderMarketplaceInventory = renderMarketplaceInventory;
    window.APP.renderMarketplaceBundle = renderMarketplaceBundle;
})();
