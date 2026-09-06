/* ==========================================================================
   AUCTION: LIVE TIMERS, STATUS SYNC & BIDDING
   ========================================================================== */

(function () {
    const auctionTimer = document.getElementById('auctionTimer');
    const auctionImg = document.getElementById('auctionImg');
    const auctionItemName = document.getElementById('auctionItemName');
    const auctionQty = document.getElementById('auctionQty');
    const auctionCurrentBid = document.getElementById('auctionCurrentBid');
    const auctionHighestBidder = document.getElementById('auctionHighestBidder');
    const auctionBidBtn = document.getElementById('auctionBidBtn');

    function startAuctionSync() {
        if (window.APP.auctionInterval) stopAuctionSync();
        fetchAuctionStatus();
        window.APP.auctionInterval = setInterval(fetchAuctionStatus, 1000);
    }

    function stopAuctionSync() {
        if (window.APP.auctionInterval) {
            clearInterval(window.APP.auctionInterval);
            window.APP.auctionInterval = null;
        }
    }

    async function fetchAuctionStatus() {
        try {
            const res = await fetch(`${window.APP.API_BASE}/api/auction/status`);
            const data = await res.json();

            if (data.item) {
                window.APP.lastAuctionState = data;
                updateAuctionUI(data);
            }
        } catch (err) {
            if (auctionTimer) auctionTimer.textContent = "Offline";
        }
    }

    function updateAuctionUI(data) {
        if (!auctionTimer) return;

        // Timer formatting
        const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        auctionTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        // Find item display name and image
        let displayName = data.displayName || data.item;
        let imgUrl = data.imageUrl || "";

        const configs = window.APP.gameConfigs;
        if (configs && configs[data.category] && configs[data.category][data.item]) {
            const itemData = configs[data.category][data.item];
            if (itemData.DisplayName) displayName = itemData.DisplayName;
            if (itemData.imageUrl) imgUrl = itemData.imageUrl;
        }

        if (auctionItemName) auctionItemName.textContent = displayName;
        if (auctionImg && imgUrl) {
            auctionImg.src = imgUrl;
            auctionImg.style.display = "block";
        }

        if (auctionQty) auctionQty.textContent = `Amount: ${data.qty}`;
        if (auctionCurrentBid) auctionCurrentBid.textContent = `${data.currentBid || data.startPrice} 🪙`;

        const currentUser = window.APP.currentUser;

        if (auctionHighestBidder) {
            if (data.highestBidderId) {
                auctionHighestBidder.textContent = data.highestBidderName;
                if (currentUser && data.highestBidderId === currentUser.userId) {
                    auctionHighestBidder.style.color = "#4caf50";
                } else {
                    auctionHighestBidder.style.color = "#4a3b32";
                }
            } else {
                auctionHighestBidder.textContent = "None";
                auctionHighestBidder.style.color = "#4a3b32";
            }
        }

        // Bid Button Logic
        if (!auctionBidBtn) return;
        const nextRequiredBid = (data.currentBid || data.startPrice) + data.step;

        if (remaining <= 0) {
            auctionBidBtn.textContent = "Auction Ended";
            auctionBidBtn.disabled = true;
        } else if (currentUser && data.highestBidderId === currentUser.userId) {
            auctionBidBtn.textContent = "You are highest!";
            auctionBidBtn.disabled = true;
        } else if (window.APP.playerCash < nextRequiredBid) {
            auctionBidBtn.textContent = `Bid ${nextRequiredBid} 🪙 (Not enough)`;
            auctionBidBtn.disabled = true;
        } else {
            auctionBidBtn.textContent = `Bid ${nextRequiredBid} 🪙`;
            auctionBidBtn.disabled = false;
        }
    }

    if (auctionBidBtn) {
        auctionBidBtn.addEventListener('click', async () => {
            const lastState = window.APP.lastAuctionState;
            const currentUser = window.APP.currentUser;
            if (!lastState || !currentUser) return;

            const bidAmount = (lastState.currentBid || lastState.startPrice) + lastState.step;

            auctionBidBtn.disabled = true;
            auctionBidBtn.textContent = "Bidding...";

            try {
                const res = await fetch(`${window.APP.API_BASE}/api/auction/bid`, {
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
                    window.APP.showMessage(data.message || "Bid placed successfully!", true);
                    fetchAuctionStatus();
                    if (window.APP.fetchStatus) {
                        window.APP.fetchStatus(true);
                    }
                } else {
                    window.APP.showMessage(data.error || "Failed to place bid.", false);
                    auctionBidBtn.disabled = false;
                }
            } catch (err) {
                window.APP.showMessage("Network error.", false);
                auctionBidBtn.disabled = false;
            }
        });
    }

    window.APP.startAuctionSync = startAuctionSync;
    window.APP.stopAuctionSync = stopAuctionSync;
    window.APP.fetchAuctionStatus = fetchAuctionStatus;
    window.APP.updateAuctionUI = updateAuctionUI;
})();
