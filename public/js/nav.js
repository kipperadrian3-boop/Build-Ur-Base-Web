/* ==========================================================================
   NAVIGATION: TAB SWITCHING & ROUTING
   ========================================================================== */

(function () {
    const indexView = document.getElementById('indexView');
    const shopView = document.getElementById('shopView');
    const auctionView = document.getElementById('auctionView');
    const dailyView = document.getElementById('dailyView');
    const marketplaceView = document.getElementById('marketplaceView');

    const navIndexBtn = document.getElementById('navIndexBtn');
    const navShopBtn = document.getElementById('navShopBtn');
    const navAuctionBtn = document.getElementById('navAuctionBtn');
    const navDailyBtn = document.getElementById('navDailyBtn');
    const navMarketplaceBtn = document.getElementById('navMarketplaceBtn');

    function hideAllViews() {
        if (indexView) indexView.classList.add('hidden');
        if (shopView) shopView.classList.add('hidden');
        if (auctionView) auctionView.classList.add('hidden');
        if (dailyView) dailyView.classList.add('hidden');
        if (marketplaceView) marketplaceView.classList.add('hidden');

        if (navIndexBtn) navIndexBtn.classList.remove('active');
        if (navShopBtn) navShopBtn.classList.remove('active');
        if (navAuctionBtn) navAuctionBtn.classList.remove('active');
        if (navDailyBtn) navDailyBtn.classList.remove('active');
        if (navMarketplaceBtn) navMarketplaceBtn.classList.remove('active');
    }

    if (navIndexBtn) {
        navIndexBtn.addEventListener('click', () => {
            hideAllViews();
            navIndexBtn.classList.add('active');
            if (indexView) indexView.classList.remove('hidden');
        });
    }

    if (navShopBtn) {
        navShopBtn.addEventListener('click', () => {
            hideAllViews();
            navShopBtn.classList.add('active');
            if (shopView) shopView.classList.remove('hidden');
            if (window.APP.renderShopCategory) {
                window.APP.renderShopCategory(window.APP.currentShopCategory);
            }
        });
    }

    if (navAuctionBtn) {
        navAuctionBtn.addEventListener('click', () => {
            hideAllViews();
            navAuctionBtn.classList.add('active');
            if (auctionView) auctionView.classList.remove('hidden');
        });
    }

    if (navDailyBtn) {
        navDailyBtn.addEventListener('click', () => {
            hideAllViews();
            navDailyBtn.classList.add('active');
            if (dailyView) dailyView.classList.remove('hidden');
            if (window.APP.renderDailyRewards) {
                window.APP.renderDailyRewards();
            }
        });
    }

    if (navMarketplaceBtn) {
        navMarketplaceBtn.addEventListener('click', () => {
            hideAllViews();
            navMarketplaceBtn.classList.add('active');
            if (marketplaceView) marketplaceView.classList.remove('hidden');
            if (window.APP.fetchMarketplaceOffers) {
                window.APP.fetchMarketplaceOffers();
            }
        });
    }
})();
