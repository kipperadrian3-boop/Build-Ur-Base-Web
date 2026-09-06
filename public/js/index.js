/* ==========================================================================
   INDEX TAB: GAME CONFIGS & ITEM ENCYCLOPEDIA
   ========================================================================== */

(function () {
    const itemsGrid = document.getElementById('itemsGrid');

    async function loadGameConfigs() {
        try {
            if (itemsGrid) itemsGrid.innerHTML = '';
            const res = await fetch(`${window.APP.API_BASE}/api/configs`);
            const data = await res.json();

            if (Object.keys(data).length === 0) {
                if (itemsGrid) itemsGrid.innerHTML = '';
                return;
            }

            window.APP.gameConfigs = data;
            renderCategory(window.APP.currentCategory);
        } catch (err) {
            console.error('[Config] Failed to load configs:', err);
            if (itemsGrid) itemsGrid.innerHTML = '';
        }
    }

    function renderCategory(category) {
        window.APP.currentCategory = category;

        document.querySelectorAll('#indexView .tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`#indexView .tab-btn[data-tab="${category}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        if (!itemsGrid || !window.APP.gameConfigs) return;
        itemsGrid.innerHTML = '';

        const items = window.APP.gameConfigs[category];
        if (!items) return;

        const itemsWithKey = Object.entries(items).map(([k, v]) => ({ ...v, Key: k }));
        const sortedItems = itemsWithKey.sort((a, b) => (a.Order || 0) - (b.Order || 0));

        sortedItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';

            let statsHtml = '';
            if (item.Price) statsHtml += `<div class="item-stat">Price <span>${item.Price}</span></div>`;
            if (item.Durability) statsHtml += `<div class="item-stat">Health <span>${item.Durability}</span></div>`;
            if (item.Rarity) statsHtml += `<div class="item-stat">Rarity <span>${item.Rarity}</span></div>`;

            if (item.Damage) statsHtml += `<div class="item-stat">Damage <span>${item.Damage}</span></div>`;
            if (item.FireRate) statsHtml += `<div class="item-stat">Fire Rate <span>${item.FireRate}s</span></div>`;
            if (item.Range) statsHtml += `<div class="item-stat">Range <span>${item.Range}</span></div>`;

            if (item.Timer) statsHtml += `<div class="item-stat">Timer <span>${item.Timer}s</span></div>`;

            card.innerHTML = `
                ${item.imageUrl ? `<img src="${item.imageUrl}" class="item-img" alt="${item.DisplayName || item.Key}">` : ''}
                <h3>${item.DisplayName || item.Key || 'Unknown'}</h3>
                ${statsHtml}
            `;

            itemsGrid.appendChild(card);
        });
    }

    // Tab Listeners for Index View
    document.querySelectorAll('#indexView .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = e.target.getAttribute('data-tab');
            renderCategory(cat);
        });
    });

    window.APP.loadGameConfigs = loadGameConfigs;
    window.APP.renderCategory = renderCategory;
})();
