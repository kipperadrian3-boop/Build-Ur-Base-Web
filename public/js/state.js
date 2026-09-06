/* ==========================================================================
   GLOBAL APP STATE & UTILITIES
   ========================================================================== */

(function () {
    const API_BASE = (window.location.port === '3000')
        ? ''
        : 'https://build-ur-base-web.onrender.com';

    // Canvas for precise button label fitting (no text truncation or layout break)
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

    window.APP = {
        API_BASE,
        currentUser: null,
        gameConfigs: null,
        currentCategory: 'Blocks',
        currentShopCategory: 'Blocks',
        isServerOnline: false,
        currentServerId: null,
        playerStock: {},
        playerCash: 0,
        playerDailyReward: null,
        playerInventory: {},
        currentOfferBundle: {},
        dailyTimerInterval: null,
        syncInterval: null,
        auctionInterval: null,
        lastAuctionState: null,
        calculateFittedFontSize,
        setButtonTextFitted
    };
})();
