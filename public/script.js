document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginView = document.getElementById('loginView');
    const mainAppView = document.getElementById('mainAppView');
    
    const codeInput = document.getElementById('codeInput');
    const loginBtn = document.getElementById('loginBtn');
    const statusMessage = document.getElementById('statusMessage');
    const playerNameSpan = document.getElementById('playerName');
    const logoutBtn = document.getElementById('logoutBtn');
    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
    
    const itemsGrid = document.getElementById('itemsGrid');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // State
    let gameConfigs = null;
    let currentCategory = 'Blocks';

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
        const userData = JSON.parse(savedUser);
        codeInput.value = savedCode;
        
        loginView.classList.add('hidden');
        mainAppView.classList.remove('hidden');
        
        playerNameSpan.textContent = userData.username;
        if (userData.avatarUrl) {
            avatarPlaceholder.style.backgroundImage = `url('${userData.avatarUrl}')`;
        }
        
        loadGameConfigs();
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
                localStorage.setItem('roblox_web_code', code);
                localStorage.setItem('roblox_web_user', JSON.stringify({
                    username: data.user.username,
                    avatarUrl: data.user.avatarUrl
                }));
                
                // Show Main App
                loginView.classList.add('hidden');
                mainAppView.classList.remove('hidden');
                
                playerNameSpan.textContent = data.user.username;
                if (data.user.avatarUrl) {
                    avatarPlaceholder.style.backgroundImage = `url('${data.user.avatarUrl}')`;
                }

                // Fetch Game Configs
                loadGameConfigs();
                
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
        mainAppView.classList.add('hidden');
        loginView.classList.remove('hidden');
        codeInput.value = "";
        showMessage("Logged out successfully.", true);
    });

    function showMessage(msg, isSuccess) {
        statusMessage.textContent = msg;
        statusMessage.className = isSuccess ? 'status-message success' : 'status-message';
    }

    // --- Index & Config Logic ---

    async function loadGameConfigs() {
        try {
            itemsGrid.innerHTML = '<p style="text-align:center; width:100%;">Loading data from Roblox...</p>';
            const res = await fetch('https://build-ur-base-web.onrender.com/api/configs');
            const data = await res.json();
            
            if (Object.keys(data).length === 0) {
                itemsGrid.innerHTML = '<p style="text-align:center; width:100%;">No data yet. Join the game on Roblox to sync!</p>';
                return;
            }
            
            gameConfigs = data;
            renderCategory(currentCategory);
        } catch (err) {
            itemsGrid.innerHTML = '<p style="text-align:center; color:red; width:100%;">Error loading configs.</p>';
        }
    }

    function renderCategory(category) {
        if (!gameConfigs || !gameConfigs[category]) return;
        
        itemsGrid.innerHTML = '';
        const items = gameConfigs[category];
        
        // Convert to array and sort by Order
        const sortedItems = Object.values(items).sort((a, b) => (a.Order || 0) - (b.Order || 0));

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
                <h3>${item.DisplayName || item.Name || 'Unknown'}</h3>
                ${statsHtml}
            `;
            
            itemsGrid.appendChild(card);
        });
    }

    // Tab Clicks
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentCategory = e.target.getAttribute('data-target');
            renderCategory(currentCategory);
        });
    });
});
