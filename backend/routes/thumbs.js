// Image proxy for Roblox thumbnails.
// Roblox CDN links (tr.rbxcdn.com) expire and new uploads start as "Pending",
// so the website never stores them. Instead it links to these endpoints, which
// resolve a fresh CDN URL on demand (cached) and redirect to it.
//   GET /api/thumb/:assetId   -> item / asset image
//   GET /api/avatar/:userId   -> player headshot
const express = require('express');
const router = express.Router();

const OK_TTL = 30 * 60 * 1000;      // completed thumbnails: 30 min
const RETRY_TTL = 20 * 1000;        // pending / failed: retry after 20 s
const cache = new Map();            // key -> { url, expires }

// Transparent 1x1 PNG for missing images (keeps <img> tags from showing a broken icon)
const EMPTY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function resolve(key, apiUrl) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit;

    let url = null;
    let done = false;
    let ttl = RETRY_TTL;
    try {
        const res = await fetch(apiUrl);
        const json = await res.json();
        const entry = json && json.data && json.data[0];
        // Only "Completed" thumbnails are real images ("Pending" returns an "Unavailable" placeholder)
        if (entry && entry.imageUrl && entry.state === 'Completed') {
            url = entry.imageUrl;
            done = true;
            ttl = OK_TTL;
        }
    } catch (err) {
        console.error(`[Thumbs] ${key} failed:`, err.message);
    }
    // Keep serving the last good URL while a refresh fails
    if (!url && hit && hit.url) { url = hit.url; done = hit.done; }
    const result = { url, done, expires: Date.now() + ttl };
    cache.set(key, result);
    return result;
}

function sendImage(res, result) {
    if (result && result.url) {
        res.set('Cache-Control', 'public, max-age=300');
        return res.redirect(302, result.url);
    }
    // Not ready yet: transparent pixel, never cached, so the next load retries
    res.set('Cache-Control', 'no-store');
    res.type('png').send(EMPTY_PNG);
}

router.get('/thumb/:assetId', async (req, res) => {
    const id = String(req.params.assetId).replace(/\D/g, '');
    if (!id) return sendImage(res, null);
    const result = await resolve(`a:${id}`,
        `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
    sendImage(res, result);
});

router.get('/avatar/:userId', async (req, res) => {
    const id = String(req.params.userId).replace(/\D/g, '');
    if (!id) return sendImage(res, null);
    const result = await resolve(`u:${id}`,
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`);
    sendImage(res, result);
});

module.exports = router;
