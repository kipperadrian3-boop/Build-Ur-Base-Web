/* ==========================================================================
   APP CORE: AUTHENTICATION, LOGIN & GENERAL HELPERS
   ========================================================================== */

(function () {
    const loginView = document.getElementById('loginView');
    const mainAppView = document.getElementById('mainAppView');
    const codeInput = document.getElementById('codeInput');
    const loginBtn = document.getElementById('loginBtn');
    const statusMessage = document.getElementById('statusMessage');
    const playerNameSpan = document.getElementById('playerName');
    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
    const logoutBtn = document.getElementById('logoutBtn');

    function showMessage(msg, isSuccess) {
        if (!statusMessage) return;
        statusMessage.textContent = msg;
        statusMessage.className = isSuccess ? 'status-message success' : 'status-message';
    }

    // Expose showMessage globally
    window.APP.showMessage = showMessage;

    // Formatting Code Input (XXXX-XXXX-XXXX-XXXX)
    if (codeInput) {
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
    }

    async function performLogin(code) {
        if (!loginBtn) return;
        loginBtn.disabled = true;
        loginBtn.textContent = "Connecting...";
        showMessage("", false);

        try {
            const response = await fetch(`${window.APP.API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });

            const data = await response.json();

            if (data.success) {
                window.APP.currentUser = {
                    username: data.user.username,
                    avatarUrl: data.user.avatarUrl,
                    userId: data.user.userId
                };
                localStorage.setItem('roblox_web_code', code);
                localStorage.setItem('roblox_web_user', JSON.stringify(window.APP.currentUser));

                // Show Main App View
                loginView.classList.add('hidden');
                mainAppView.classList.remove('hidden');

                if (playerNameSpan) playerNameSpan.textContent = window.APP.currentUser.username;
                if (avatarPlaceholder && window.APP.currentUser.avatarUrl) {
                    avatarPlaceholder.style.backgroundImage = `url('${window.APP.currentUser.avatarUrl}')`;
                }

                // Initialize subsystems
                if (window.APP.loadGameConfigs) window.APP.loadGameConfigs();
                if (window.APP.startLiveSync) window.APP.startLiveSync();
                if (window.APP.startAuctionSync) window.APP.startAuctionSync();
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

    window.APP.performLogin = performLogin;

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const code = codeInput.value;
            if (code.length !== 19) {
                showMessage("Please enter a valid 16-digit code.", false);
                return;
            }
            performLogin(code);
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('roblox_web_code');
            localStorage.removeItem('roblox_web_user');
            window.APP.currentUser = null;
            window.APP.currentOfferBundle = {};

            if (window.APP.closeCreateOfferModal) window.APP.closeCreateOfferModal();
            if (window.APP.stopLiveSync) window.APP.stopLiveSync();
            if (window.APP.stopAuctionSync) window.APP.stopAuctionSync();

            mainAppView.classList.add('hidden');
            loginView.classList.remove('hidden');
            if (codeInput) codeInput.value = "";
            showMessage("Logged out successfully.", true);
        });
    }

    // Auto-login initialization
    function initApp() {
        const savedCode = localStorage.getItem('roblox_web_code');
        const savedUser = localStorage.getItem('roblox_web_user');

        if (savedCode && savedUser) {
            window.APP.currentUser = JSON.parse(savedUser);
            if (codeInput) codeInput.value = savedCode;

            loginView.classList.add('hidden');
            mainAppView.classList.remove('hidden');

            if (playerNameSpan) playerNameSpan.textContent = window.APP.currentUser.username;
            if (avatarPlaceholder && window.APP.currentUser.avatarUrl) {
                avatarPlaceholder.style.backgroundImage = `url('${window.APP.currentUser.avatarUrl}')`;
            }

            if (window.APP.loadGameConfigs) window.APP.loadGameConfigs();
            if (window.APP.startLiveSync) window.APP.startLiveSync();
            if (window.APP.startAuctionSync) window.APP.startAuctionSync();
        } else if (savedCode) {
            if (codeInput) codeInput.value = savedCode;
            performLogin(savedCode);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
