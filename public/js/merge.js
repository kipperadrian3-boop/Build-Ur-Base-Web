/* ==========================================================================
   MERGE FORGE: 2x same defense from the inventory -> 1x next level
   Generic: the level chain comes from configs (Defense items with NextId).
   ========================================================================== */

(function () {
    const MERGE_COST = 2;

    const openBtn = document.getElementById('mergeBtn');
    const badge = document.getElementById('mergeBadge');
    const modal = document.getElementById('mergeModal');
    const closeBtn = document.getElementById('mergeCloseBtn');
    const listView = document.getElementById('mergeListView');
    const detailView = document.getElementById('mergeDetailView');
    const grid = document.getElementById('mergeGrid');
    const backBtn = document.getElementById('mergeBackBtn');
    const imgA = document.getElementById('mergeImgA');
    const imgB = document.getElementById('mergeImgB');
    const imgOut = document.getElementById('mergeImgOut');
    const lvlA = document.getElementById('mergeLvlA');
    const lvlB = document.getElementById('mergeLvlB');
    const lvlOut = document.getElementById('mergeLvlOut');
    const ownedEl = document.getElementById('mergeOwned');
    const statsEl = document.getElementById('mergeStats');
    const oneBtn = document.getElementById('mergeOneBtn');
    const allBtn = document.getElementById('mergeAllBtn');
    const statusEl = document.getElementById('mergeStatus');
    if (!modal || !grid) return;

    // Stat rows shown in the detail view (only if the defense has the value)
    const STATS = [
        { key: 'Damage', label: 'Damage', suffix: '' },
        { key: 'FireRate', label: 'Fire Rate', suffix: 's' },
        { key: 'Durability', label: 'Health', suffix: '' },
        { key: 'Range', label: 'Range', suffix: '' },
        { key: 'SplashRadius', label: 'Splash', suffix: '' },
        { key: 'BurnDamagePerSecond', label: 'Fire Damage', suffix: '/s' },
        { key: 'BurnDuration', label: 'Fire Time', suffix: 's' },
    ];

    let selectedKey = null;
    let merging = false;

    const defenses = () => (window.APP.gameConfigs && window.APP.gameConfigs.Defense) || {};
    const inventory = () => window.APP.playerInventory || {};
    const owned = (key) => Number(inventory()[key]) || 0;

    function fmt(v) {
        if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
        return String(Math.round(v * 100) / 100);
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function baseName(cfg) {
        const base = cfg.BaseId && defenses()[cfg.BaseId];
        return (base && base.DisplayName) || cfg.DisplayName || '';
    }

    // Owned defenses that have a next level, mergeable ones first
    function getEntries() {
        const defs = defenses();
        return Object.entries(defs)
            .filter(([key, cfg]) => cfg.NextId && defs[cfg.NextId] && owned(key) > 0)
            .map(([key, cfg]) => ({ key, cfg, count: owned(key) }))
            .sort((a, b) => {
                const ra = a.count >= MERGE_COST ? 0 : 1, rb = b.count >= MERGE_COST ? 0 : 1;
                if (ra !== rb) return ra - rb;
                return (a.cfg.Order || 99) - (b.cfg.Order || 99);
            });
    }

    function updateBadge() {
        if (!badge) return;
        const n = getEntries().filter(e => e.count >= MERGE_COST).length;
        badge.textContent = n;
        badge.classList.toggle('hidden', n === 0);
    }

    function renderMergeList() {
        updateBadge();
        if (modal.classList.contains('hidden') || !listView || listView.classList.contains('hidden')) return;

        const entries = getEntries();
        grid.innerHTML = '';
        if (entries.length === 0) {
            grid.innerHTML = '<p class="merge-empty">No defenses in your inventory yet.<br>Buy some in the Shop and come back!</p>';
            return;
        }
        entries.forEach(({ key, cfg, count }) => {
            const next = defenses()[cfg.NextId];
            const ready = count >= MERGE_COST;
            const tile = document.createElement('div');
            tile.className = `merge-tile ${ready ? 'ready' : 'locked'}`;
            tile.innerHTML = `
                <span class="merge-tile-count">x${count}</span>
                <img src="${esc(cfg.imageUrl || '')}" alt="">
                <div class="merge-tile-name">${esc(baseName(cfg))}</div>
                <div class="merge-tile-lvl">${ready ? `Lv.${cfg.Level || 1} → Lv.${next.Level || (cfg.Level || 1) + 1}` : `Lv.${cfg.Level || 1} · need ${MERGE_COST}`}</div>`;
            if (ready) tile.addEventListener('click', () => openDetail(key));
            grid.appendChild(tile);
        });
    }

    function renderDetail() {
        const cfg = defenses()[selectedKey];
        const next = cfg && defenses()[cfg.NextId];
        if (!cfg || !next) return showList();

        const count = owned(selectedKey);
        const times = Math.floor(count / MERGE_COST);
        const lvl = cfg.Level || 1;
        const nextLvl = next.Level || lvl + 1;

        imgA.src = cfg.imageUrl || '';
        imgB.src = cfg.imageUrl || '';
        imgOut.src = next.imageUrl || '';
        lvlA.textContent = lvlB.textContent = `Lv.${lvl}`;
        lvlOut.textContent = `Lv.${nextLvl}`;
        imgOut.parentElement.className = `merge-slot merge-result lvl-${nextLvl}`;
        ownedEl.textContent = `You own ${count}x ${cfg.DisplayName || selectedKey}`;

        statsEl.innerHTML = STATS
            .filter(s => typeof cfg[s.key] === 'number' && typeof next[s.key] === 'number')
            .map(s => `
                <div class="merge-stat-row">
                    <span class="merge-stat-label">${s.label}</span>
                    <span class="merge-stat-old">${fmt(cfg[s.key])}${s.suffix}</span>
                    <span class="merge-stat-sep">➜</span>
                    <span class="merge-stat-new">${fmt(next[s.key])}${s.suffix}</span>
                </div>`).join('');

        oneBtn.disabled = merging || times < 1;
        allBtn.disabled = merging || times < 1;
        allBtn.textContent = times > 1 ? `Merge All (${times}x)` : 'Merge All';
    }

    function showList() {
        selectedKey = null;
        detailView.classList.add('hidden');
        listView.classList.remove('hidden');
        renderMergeList();
    }

    function openDetail(key) {
        selectedKey = key;
        statusEl.textContent = '';
        statusEl.className = 'merge-status';
        listView.classList.add('hidden');
        detailView.classList.remove('hidden');
        renderDetail();
    }

    function openModal() {
        modal.classList.remove('hidden');
        showList();
        if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
    }

    function closeModal() {
        modal.classList.add('hidden');
        selectedKey = null;
    }

    async function doMerge(all) {
        const user = window.APP.currentUser;
        if (merging || !selectedKey || !user || !user.userId) return;
        merging = true;
        renderDetail();
        statusEl.className = 'merge-status';
        statusEl.textContent = 'Merging...';

        try {
            const res = await fetch(`${window.APP.API_BASE}/api/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.userId, itemKey: selectedKey, all })
            });
            const data = await res.json();
            if (data.success) {
                // Update the local inventory right away (live status refresh follows)
                const inv = window.APP.playerInventory || (window.APP.playerInventory = {});
                const count = data.count || 1;
                inv[selectedKey] = Math.max(0, (Number(inv[selectedKey]) || 0) - MERGE_COST * count);
                inv[data.newItemId] = (Number(inv[data.newItemId]) || 0) + count;

                statusEl.className = 'merge-status ok';
                statusEl.textContent = data.message || 'Merged!';
                imgOut.parentElement.classList.remove('merge-flash');
                void imgOut.parentElement.offsetWidth;
                imgOut.parentElement.classList.add('merge-flash');
                if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
            } else {
                statusEl.textContent = data.message || data.error || 'Merge failed.';
            }
        } catch (err) {
            statusEl.textContent = 'Network error. Try again.';
        } finally {
            merging = false;
            if (selectedKey && owned(selectedKey) < MERGE_COST) {
                // nothing left to merge here -> keep the success message, show the result for a moment
                renderDetail();
                setTimeout(() => { if (!modal.classList.contains('hidden') && selectedKey && owned(selectedKey) < MERGE_COST) showList(); }, 1400);
            } else {
                renderDetail();
            }
            updateBadge();
        }
    }

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backBtn) backBtn.addEventListener('click', showList);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    oneBtn.addEventListener('click', () => doMerge(false));
    allBtn.addEventListener('click', () => doMerge(true));

    // Called after every live status poll (see sync.js) and after configs load
    window.APP.renderMergeList = function () {
        if (selectedKey && !merging && !detailView.classList.contains('hidden')) renderDetail();
        renderMergeList();
    };
})();
