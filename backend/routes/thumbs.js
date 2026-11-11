// Image proxy for Roblox thumbnails.
// Roblox CDN links (tr.rbxcdn.com) expire and new uploads start as "Pending",
// so the website never stores them. Instead it links to these endpoints, which
// redirect to a fresh CDN URL:
//   GET /api/thumb/:assetId   -> item / asset image
//   GET /api/avatar/:userId   -> player headshot
//
// All lookups are BATCHED (one Roblox request for up to 100 ids) and cached.
// One request per image gets rate limited by Roblox on shared hosts like Render.
const express = require('express');
const router = express.Router();

const OK_TTL = 6 * 60 * 60 * 1000;   // completed thumbnails: 6 h (CDN links live much longer)
const RETRY_TTL = 15 * 1000;         // pending / failed: retry after 15 s
const BATCH_DELAY = 150;             // collect ids for this long before one Roblox request
const WAIT_MAX = 6000;               // a request waits at most this long for its batch

// Transparent 1x1 PNG for images that are not ready (keeps <img> from showing a broken icon)
const EMPTY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function makeResolver(name, buildUrl) {
    const cache = new Map();   // id -> { url, expires }
    let queue = new Set();
    let timer = null;
    let inflight = null;       // promise of the running batch

    async function fetchChunk(ids, attempt = 0) {
        try {
            const res = await fetch(buildUrl(ids));
            if (res.status === 429 && attempt < 3) {
                await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
                return fetchChunk(ids, attempt + 1);
            }
            if (!res.ok) {
                console.warn(`[Thumbs] ${name} batch -> HTTP ${res.status}`);
                return;
            }
            const json = await res.json();
            const now = Date.now();
            const seen = new Set();
            for (const entry of (json && json.data) || []) {
                const id = String(entry.targetId);
                seen.add(id);
                const prev = cache.get(id);
                if (entry.state === 'Completed' && entry.imageUrl) {
                    cache.set(id, { url: entry.imageUrl, expires: now + OK_TTL, at: now });
                } else {
                    // Pending: keep an older good URL if we have one, retry soon
                    cache.set(id, { url: prev ? prev.url : null, expires: now + RETRY_TTL, at: now });
                }
            }
            for (const id of ids) {
                if (!seen.has(id)) { const prev = cache.get(id); cache.set(id, { url: prev ? prev.url : null, expires: now + RETRY_TTL, at: now }); }
            }
        } catch (err) {
            console.error(`[Thumbs] ${name} batch failed:`, err.message);
        }
    }

    async function flush() {
        timer = null;
        const ids = [...queue];
        queue = new Set();
        for (let i = 0; i < ids.length; i += 100) {
            await fetchChunk(ids.slice(i, i + 100));
        }
    }

    function schedule() {
        if (timer || inflight) return;
        timer = setTimeout(() => {
            inflight = flush().finally(() => {
                inflight = null;
                if (queue.size > 0) schedule();
            });
        }, BATCH_DELAY);
    }

    function enqueue(ids) {
        for (const id of ids) queue.add(String(id));
        schedule();
    }

    async function get(id) {
        const hit = cache.get(id);
        if (hit && hit.expires > Date.now()) return hit.url;
        const start = Date.now();
        enqueue([id]);
        // wait until a batch has written a fresh entry for this id
        while (Date.now() - start < WAIT_MAX) {
            await new Promise(r => setTimeout(r, 100));
            const cur = cache.get(id);
            if (cur && cur.at >= start) return cur.url;
        }
        const cur = cache.get(id);
        return cur ? cur.url : null;
    }

    return { get, enqueue, cache };
}

const assets = makeResolver('assets', ids =>
    `https://thumbnails.roblox.com/v1/assets?assetIds=${ids.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
const avatars = makeResolver('avatars', ids =>
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.join(',')}&size=150x150&format=Png&isCircular=false`);

function sendImage(res, url) {
    if (url) {
        res.set('Cache-Control', 'public, max-age=600');
        return res.redirect(302, url);
    }
    // Not ready yet: transparent pixel, never cached, so the next load retries
    res.set('Cache-Control', 'no-store');
    res.type('png').send(EMPTY_PNG);
}

router.get('/thumb/:assetId', async (req, res) => {
    const id = String(req.params.assetId).replace(/\D/g, '');
    sendImage(res, id ? await assets.get(id) : null);
});

router.get('/avatar/:userId', async (req, res) => {
    const id = String(req.params.userId).replace(/\D/g, '');
    sendImage(res, id ? await avatars.get(id) : null);
});

// Warm the cache with every item image at startup and keep it fresh
function prewarmAssets(ids) {
    const list = [...new Set(ids.map(String).filter(Boolean))];
    if (list.length === 0) return;
    assets.enqueue(list);
    setInterval(() => assets.enqueue(list), 30 * 60 * 1000);
    // retry pending ones until all are ready (new uploads take a few minutes)
    const retry = setInterval(() => {
        const missing = list.filter(id => { const c = assets.cache.get(id); return !c || !c.url; });
        if (missing.length === 0) return clearInterval(retry);
        assets.enqueue(missing);
    }, 20 * 1000);
}

router.prewarmAssets = prewarmAssets;
module.exports = router;
