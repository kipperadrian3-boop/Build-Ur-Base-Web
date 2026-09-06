/* ==========================================================================
   MINI GAMES: GAMES HUB & MINESWEEPER (SERVER-VALIDATED REWARDS)
   ========================================================================== */

(function () {
    const gamesBtn = document.getElementById('gamesBtn');
    const gamesModal = document.getElementById('gamesModal');
    const gamesCloseBtn = document.getElementById('gamesCloseBtn');
    const gameTileMinesweeper = document.getElementById('gameTileMinesweeper');

    const minesweeperModal = document.getElementById('minesweeperModal');
    const msBackBtn = document.getElementById('msBackBtn');
    const msCloseBtn = document.getElementById('msCloseBtn');
    const msNewGameBtn = document.getElementById('msNewGameBtn');
    const msBoard = document.getElementById('msBoard');
    const msMineCount = document.getElementById('msMineCount');
    const msEarnedCoins = document.getElementById('msEarnedCoins');
    const msGameOverlay = document.getElementById('msGameOverlay');
    const msOverlayIcon = document.getElementById('msOverlayIcon');
    const msOverlayText = document.getElementById('msOverlayText');
    const msOverlaySub = document.getElementById('msOverlaySub');
    const msPlayAgainBtn = document.getElementById('msPlayAgainBtn');

    // Games Modal Open/Close
    if (gamesBtn) {
        gamesBtn.addEventListener('click', () => {
            if (gamesModal) gamesModal.classList.remove('hidden');
        });
    }

    if (gamesCloseBtn) {
        gamesCloseBtn.addEventListener('click', () => {
            if (gamesModal) gamesModal.classList.add('hidden');
        });
    }

    if (gamesModal) {
        gamesModal.addEventListener('click', (e) => {
            if (e.target === gamesModal) gamesModal.classList.add('hidden');
        });
    }

    // Minesweeper Modal Open/Close
    if (gameTileMinesweeper) {
        gameTileMinesweeper.addEventListener('click', () => {
            if (gamesModal) gamesModal.classList.add('hidden');
            if (minesweeperModal) minesweeperModal.classList.remove('hidden');
            msInitGame();
        });
    }

    if (msBackBtn) {
        msBackBtn.addEventListener('click', () => {
            if (minesweeperModal) minesweeperModal.classList.add('hidden');
            if (gamesModal) gamesModal.classList.remove('hidden');
        });
    }

    if (msCloseBtn) {
        msCloseBtn.addEventListener('click', () => {
            if (minesweeperModal) minesweeperModal.classList.add('hidden');
        });
    }

    if (minesweeperModal) {
        minesweeperModal.addEventListener('click', (e) => {
            if (e.target === minesweeperModal) minesweeperModal.classList.add('hidden');
        });
    }

    if (msNewGameBtn) {
        msNewGameBtn.addEventListener('click', () => msInitGame());
    }

    if (msPlayAgainBtn) {
        msPlayAgainBtn.addEventListener('click', () => msInitGame());
    }

    // Escape key handling
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (minesweeperModal && !minesweeperModal.classList.contains('hidden')) {
                minesweeperModal.classList.add('hidden');
            } else if (gamesModal && !gamesModal.classList.contains('hidden')) {
                gamesModal.classList.add('hidden');
            }
        }
    });

    // ==========================================================================
    // MINESWEEPER LOGIC
    // ==========================================================================

    const MS_ROWS = 9;
    const MS_COLS = 9;
    const MS_MINES = 10;
    const MS_REWARD = 100;
    const MS_MAX_HOURLY = 1000;

    let msGrid = [];
    let msGameOver = false;
    let msGameWon = false;
    let msFirstClick = true;
    let cachedHourlyEarned = 0;

    function getHourlyStorageKey() {
        const now = new Date();
        const uid = (window.APP.currentUser && window.APP.currentUser.userId) ? window.APP.currentUser.userId : 'local';
        return `ms_hourly_${uid}_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}_${now.getHours()}`;
    }

    function getLocalHourlyEarned() {
        return parseInt(localStorage.getItem(getHourlyStorageKey()) || '0', 10);
    }

    function setLocalHourlyEarned(val) {
        localStorage.setItem(getHourlyStorageKey(), String(val));
    }

    async function fetchServerHourlyEarned() {
        const currentUser = window.APP.currentUser;
        if (!currentUser || !currentUser.userId) return;

        try {
            const res = await fetch(`${window.APP.API_BASE}/api/games/hourly/${currentUser.userId}`);
            const data = await res.json();
            if (typeof data.earned === 'number') {
                cachedHourlyEarned = Math.max(cachedHourlyEarned, data.earned);
                setLocalHourlyEarned(cachedHourlyEarned);
                updateEarnedDisplay();
            }
        } catch (err) {
            console.error('[Games] Error fetching hourly limit:', err);
        }
    }

    function updateEarnedDisplay() {
        if (msEarnedCoins) {
            msEarnedCoins.textContent = `${cachedHourlyEarned} / ${MS_MAX_HOURLY} 🪙`;
        }
    }

    function msInitGame() {
        msGameOver = false;
        msGameWon = false;
        msFirstClick = true;
        msGrid = [];

        for (let r = 0; r < MS_ROWS; r++) {
            msGrid[r] = [];
            for (let c = 0; c < MS_COLS; c++) {
                msGrid[r][c] = {
                    mine: false,
                    revealed: false,
                    flagged: false,
                    adjacentMines: 0
                };
            }
        }

        // Mines count is fixed (does not count down when placing flags)
        if (msMineCount) msMineCount.textContent = MS_MINES;

        // Immediately show cached hourly earned and sync with server
        cachedHourlyEarned = getLocalHourlyEarned();
        updateEarnedDisplay();
        fetchServerHourlyEarned();

        if (msGameOverlay) msGameOverlay.classList.add('hidden');

        msRenderBoard();
    }

    function msPlaceMines(safeRow, safeCol) {
        let placed = 0;
        while (placed < MS_MINES) {
            const r = Math.floor(Math.random() * MS_ROWS);
            const c = Math.floor(Math.random() * MS_COLS);
            if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue;
            if (msGrid[r][c].mine) continue;
            msGrid[r][c].mine = true;
            placed++;
        }

        for (let r = 0; r < MS_ROWS; r++) {
            for (let c = 0; c < MS_COLS; c++) {
                if (msGrid[r][c].mine) continue;
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < MS_ROWS && nc >= 0 && nc < MS_COLS && msGrid[nr][nc].mine) {
                            count++;
                        }
                    }
                }
                msGrid[r][c].adjacentMines = count;
            }
        }
    }

    function msRenderBoard() {
        if (!msBoard) return;
        msBoard.innerHTML = '';

        for (let r = 0; r < MS_ROWS; r++) {
            for (let c = 0; c < MS_COLS; c++) {
                const cell = document.createElement('div');
                cell.className = 'ms-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                const cellData = msGrid[r][c];

                if (cellData.revealed) {
                    cell.classList.add('revealed');
                    if (cellData.mine) {
                        cell.textContent = '💣';
                        if (cellData.hit) {
                            cell.classList.add('mine-hit');
                        } else {
                            cell.classList.add('mine-show');
                        }
                    } else if (cellData.adjacentMines > 0) {
                        cell.textContent = cellData.adjacentMines;
                        cell.dataset.num = cellData.adjacentMines;
                    }
                } else if (cellData.flagged) {
                    cell.classList.add('flagged');
                    cell.textContent = '🚩';
                }

                if (msGameOver) {
                    cell.classList.add('game-over');
                }

                cell.addEventListener('click', () => {
                    if (msGameOver || cellData.revealed || cellData.flagged) return;

                    if (msFirstClick) {
                        msFirstClick = false;
                        msPlaceMines(r, c);
                    }

                    if (cellData.mine) {
                        cellData.revealed = true;
                        cellData.hit = true;
                        msGameOver = true;
                        msRevealAllMines();
                        msRenderBoard();
                        msShowOverlay(false);
                    } else {
                        msRevealCell(r, c);
                        msRenderBoard();
                        msCheckWin();
                    }
                });

                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (msGameOver || cellData.revealed) return;
                    cellData.flagged = !cellData.flagged;
                    msRenderBoard();
                    msUpdateMineCount();
                });

                msBoard.appendChild(cell);
            }
        }
    }

    function msRevealCell(r, c) {
        if (r < 0 || r >= MS_ROWS || c < 0 || c >= MS_COLS) return;
        const cell = msGrid[r][c];
        if (cell.revealed || cell.flagged || cell.mine) return;

        cell.revealed = true;

        if (cell.adjacentMines === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr !== 0 || dc !== 0) {
                        msRevealCell(r + dr, c + dc);
                    }
                }
            }
        }
    }

    function msRevealAllMines() {
        for (let r = 0; r < MS_ROWS; r++) {
            for (let c = 0; c < MS_COLS; c++) {
                if (msGrid[r][c].mine) {
                    msGrid[r][c].revealed = true;
                }
            }
        }
    }

    function msUpdateMineCount() {
        // Mine count is fixed at 10 and does not decrease when flags are placed
        if (msMineCount) msMineCount.textContent = MS_MINES;
    }

    function msCheckWin() {
        let unrevealedSafe = 0;
        for (let r = 0; r < MS_ROWS; r++) {
            for (let c = 0; c < MS_COLS; c++) {
                if (!msGrid[r][c].mine && !msGrid[r][c].revealed) {
                    unrevealedSafe++;
                }
            }
        }

        if (unrevealedSafe === 0) {
            msGameOver = true;
            msGameWon = true;
            const rewardGiven = msAwardCoins();
            msShowOverlay(true, rewardGiven);
        }
    }

    function msAwardCoins() {
        const available = Math.max(0, MS_MAX_HOURLY - cachedHourlyEarned);
        if (available <= 0) {
            updateEarnedDisplay();
            return 0;
        }

        const actualReward = Math.min(MS_REWARD, available);
        cachedHourlyEarned += actualReward;
        setLocalHourlyEarned(cachedHourlyEarned);
        updateEarnedDisplay();

        const currentUser = window.APP.currentUser;
        if (!currentUser || !currentUser.userId) {
            window.APP.showMessage(`+${actualReward} 🪙 from Minesweeper!`, true);
            return actualReward;
        }

        // Notify server
        fetch(`${window.APP.API_BASE}/api/games/reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.userId,
                game: 'minesweeper',
                reward: actualReward
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && typeof data.earned === 'number') {
                cachedHourlyEarned = data.earned;
                setLocalHourlyEarned(cachedHourlyEarned);
                updateEarnedDisplay();
                window.APP.showMessage(`+${data.reward} 🪙 from Minesweeper!`, true);
                if (window.APP.fetchLiveStatus) window.APP.fetchLiveStatus();
            } else if (data.earned !== undefined) {
                cachedHourlyEarned = data.earned;
                setLocalHourlyEarned(cachedHourlyEarned);
                updateEarnedDisplay();
            }
        })
        .catch(err => console.error('[Games] Reward fetch error:', err));

        return actualReward;
    }

    function msShowOverlay(isWin, rewardAmount) {
        if (!msGameOverlay) return;
        msGameOverlay.classList.remove('hidden');

        if (isWin) {
            msOverlayIcon.textContent = '🏆';
            msOverlayText.textContent = 'You Win!';
            if (rewardAmount === 0 || cachedHourlyEarned >= MS_MAX_HOURLY) {
                msOverlaySub.textContent = `Hourly limit reached (${MS_MAX_HOURLY} 🪙). Try next hour!`;
            } else {
                msOverlaySub.textContent = `+${rewardAmount || MS_REWARD} 🪙 earned!`;
            }
        } else {
            msOverlayIcon.textContent = '💀';
            msOverlayText.textContent = 'Game Over!';
            msOverlaySub.textContent = 'You hit a mine. Try again!';
        }
    }

    window.APP.msInitGame = msInitGame;
})();
