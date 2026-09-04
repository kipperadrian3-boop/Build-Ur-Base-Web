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
    const navIndexBtn = document.getElementById('navIndexBtn');
    const navShopBtn = document.getElementById('navShopBtn');
    const itemsGrid = document.getElementById('itemsGrid');
    const shopList = document.getElementById('shopList');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // State
    let currentUser = null;
    let gameConfigs = null;
    let currentCategory = 'Blocks';
    let currentShopCategory = 'Blocks';
    
    let isServerOnline = false;
    let currentServerId = null;
    let playerStock = {};
    let playerCash = 0;
    let syncInterval = null;

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
        stopLiveSync();
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
            
            if (isServerOnline) {
                serverStatusDiv.textContent = 'Server: Online';
                serverStatusDiv.className = 'status-indicator online';
            } else {
                serverStatusDiv.textContent = 'Server: Offline';
                serverStatusDiv.className = 'status-indicator offline';
            }
            
            playerCashSpan.textContent = `🪙 ${playerCash.toLocaleString('de-DE')}`;
            
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
                        maxQtyBtn.textContent = `x${stockNum} - ${price * stockNum} 🪙`;
                        
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
        if (!isServerOnline || !currentServerId) {
            showMessage("Server is offline. Cannot purchase.", false);
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
                    serverId: currentServerId,
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

    navIndexBtn.addEventListener('click', () => {
        navIndexBtn.classList.add('active');
        navShopBtn.classList.remove('active');
        indexView.classList.remove('hidden');
        shopView.classList.add('hidden');
    });

    navShopBtn.addEventListener('click', () => {
        navShopBtn.classList.add('active');
        navIndexBtn.classList.remove('active');
        shopView.classList.remove('hidden');
        indexView.classList.add('hidden');
        renderShopCategory(currentShopCategory);
    });

});


