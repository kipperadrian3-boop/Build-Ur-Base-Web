const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database for codes
// In production, this should be a real database (MongoDB, PostgreSQL, etc.)
const codesDB = {}; 
// Structure: { "1111-2222-3333-4444": { username: "Player1", userId: "123456" } }

// 1. Endpoint for Roblox Server to register a code
app.post('/api/registerCode', (req, res) => {
    const { code, username, userId } = req.body;

    if (!code || !username || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // Save the code to our "database"
    codesDB[code] = { username, userId };
    console.log(`[Backend] Code registered for ${username}: ${code}`);

    res.status(200).json({ message: 'Code successfully registered' });
});

// 2. Endpoint for the Website to login via code
app.post('/api/login', (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    const userData = codesDB[code];

    if (userData) {
        console.log(`[Backend] User ${userData.username} logged in via code.`);
        res.status(200).json({ success: true, user: userData });
    } else {
        res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`[Backend] Web server is running on http://localhost:${PORT}`);
});
