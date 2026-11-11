// Player data WITHOUT Open Cloud:
// - Read: the game sends every player's coins / inventory / daily / stock in each heartbeat.
//   We keep the last snapshot (memory + MongoDB) and serve it while the player is offline.
// - Write: changes for offline players are sent to a running game server as a DELTA
//   (action "APPLY_DELTA"); the game applies it to its DataStore with UpdateAsync.
//   With no game server running, the delta waits (MongoDB / memory) and is delivered
//   to the next server that polls for actions.
const mongoose = require('mongoose');
const state = require('./state');
const PlayerSnapshot = require('./models/PlayerSnapshot');
const PendingPlayerChange = require('./models/PendingPlayerChange');

const snapshots = {};          // userId -> { cash, inventory, dailyReward, stock, stockEpoch, updatedAt }
const lastPersist = {};        // userId -> ms
const pendingMemory = [];      // deltas waiting for a game server (when MongoDB is offline)
const PERSIST_EVERY_MS = 20000;

const mongoReady = () => mongoose.connection.readyState === 1;
const stockEpoch = () => Math.floor(Date.now() / 1000 / 300);

function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

// ---- heartbeat -> snapshot ----
function updateFromHeartbeat(players) {
    const now = Date.now();
    for (const [userId, p] of Object.entries(players || {})) {
        if (!p) continue;
        const snap = {
            cash: Number(p.cash) || 0,
            inventory: p.inventory || {},
            dailyReward: p.dailyReward || null,
            stock: p.stock || {},
            stockEpoch: stockEpoch(),
            updatedAt: now,
        };
        snapshots[userId] = snap;
        if (mongoReady() && (!lastPersist[userId] || now - lastPersist[userId] > PERSIST_EVERY_MS)) {
            lastPersist[userId] = now;
            PlayerSnapshot.updateOne({ userId }, { $set: { userId, ...snap, updatedAt: new Date(now) } }, { upsert: true })
                .catch(err => console.error('[Snapshot] save failed:', err.message));
        }
    }
}

async function getSnapshot(userId) {
    if (snapshots[userId]) return snapshots[userId];
    if (!mongoReady()) return null;
    try {
        const doc = await PlayerSnapshot.findOne({ userId }).lean();
        if (doc) {
            snapshots[userId] = {
                cash: doc.cash || 0, inventory: doc.inventory || {}, dailyReward: doc.dailyReward || null,
                stock: doc.stock || {}, stockEpoch: doc.stockEpoch || 0,
                updatedAt: new Date(doc.updatedAt).getTime(),
            };
            return snapshots[userId];
        }
    } catch (err) {
        console.error('[Snapshot] load failed:', err.message);
    }
    return null;
}

// Snapshot as a DataStore-like "raw" object (Coins / Inventory) that route code can edit
async function getRaw(userId) {
    const snap = await getSnapshot(userId);
    if (!snap) return null;
    return { Coins: snap.cash, Inventory: clone(snap.inventory) };
}

// ---- writes -> delta for the game ----
function findActiveServer(userId) {
    const now = Date.now();
    let any = null;
    for (const [serverId, server] of Object.entries(state.activeServers)) {
        if (now - server.lastSeen >= 10000) continue;
        if (server.players && server.players[userId]) return serverId;   // prefer the player's own server
        if (!any) any = serverId;
    }
    return any;
}

async function queueDelta(userId, delta) {
    const action = {
        actionId: 'delta_' + Math.random().toString(36).slice(2, 11),
        action: 'APPLY_DELTA',
        userId: String(userId),
        coins: delta.coins || 0,
        inventory: delta.inventory || {},
        purchases: delta.purchases || {},
        purchaseEpoch: stockEpoch(),
    };
    const serverId = findActiveServer(String(userId));
    if (serverId) {
        if (!state.actionQueues[serverId]) state.actionQueues[serverId] = [];
        state.actionQueues[serverId].push(action);
        return true;
    }
    if (mongoReady()) {
        try { await PendingPlayerChange.create(action); return true; }
        catch (err) { console.error('[Snapshot] pending save failed:', err.message); }
    }
    pendingMemory.push(action);
    return true;
}

// Compare the edited raw object with the snapshot and send only the difference
async function saveRaw(userId, raw, extra = {}) {
    userId = String(userId);
    const snap = (await getSnapshot(userId)) || { cash: 0, inventory: {}, stock: {}, stockEpoch: stockEpoch() };
    const coins = (Number(raw.Coins) || 0) - (Number(snap.cash) || 0);
    const inventory = {};
    const keys = new Set([...Object.keys(raw.Inventory || {}), ...Object.keys(snap.inventory || {})]);
    for (const k of keys) {
        const d = (Number((raw.Inventory || {})[k]) || 0) - (Number((snap.inventory || {})[k]) || 0);
        if (d !== 0) inventory[k] = d;
    }
    const purchases = extra.purchases || {};
    if (coins === 0 && Object.keys(inventory).length === 0 && Object.keys(purchases).length === 0) return true;

    // optimistic local update so the website shows the result right away
    snap.cash = Math.max(0, Number(raw.Coins) || 0);
    snap.inventory = clone(raw.Inventory);
    for (const [k, q] of Object.entries(purchases)) {
        if (snap.stock && snap.stock[k] !== undefined) snap.stock[k] = Math.max(0, snap.stock[k] - q);
    }
    snap.updatedAt = Date.now();
    snapshots[userId] = snap;
    if (mongoReady()) {
        PlayerSnapshot.updateOne({ userId }, { $set: { userId, ...snap, updatedAt: new Date() } }, { upsert: true }).catch(() => {});
    }
    return queueDelta(userId, { coins, inventory, purchases });
}

// Pending deltas for a game server that polls (called from pollActions)
async function takePendingActions() {
    const out = pendingMemory.splice(0, pendingMemory.length);
    if (mongoReady()) {
        try {
            const docs = await PendingPlayerChange.find({}).lean();
            for (const d of docs) {
                out.push({
                    actionId: d.actionId, action: 'APPLY_DELTA', userId: d.userId, coins: d.coins || 0,
                    inventory: d.inventory || {}, purchases: d.purchases || {}, purchaseEpoch: d.purchaseEpoch,
                });
                await PendingPlayerChange.deleteOne({ _id: d._id });
            }
        } catch (err) {
            console.error('[Snapshot] pending load failed:', err.message);
        }
    }
    return out;
}

// Open Cloud data (if a key ever works again) becomes the base for later deltas
function seedFromRaw(userId, raw) {
    if (!raw || snapshots[userId]) return;
    snapshots[userId] = { cash: Number(raw.Coins) || 0, inventory: clone(raw.Inventory), dailyReward: null,
        stock: {}, stockEpoch: 0, updatedAt: Date.now() };
}

module.exports = { seedFromRaw, updateFromHeartbeat, getSnapshot, getRaw, saveRaw, queueDelta, takePendingActions, stockEpoch };
