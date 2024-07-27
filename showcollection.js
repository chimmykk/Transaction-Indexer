// index.js

const express = require('express');
const { getDbConnection } = require('./lib/db');

const app = express();
const port = 5000; // You can use any port number you prefer

app.use(express.json()); // Middleware to parse JSON bodies

// GET /getcollection endpoint
app.get('/getcollection', async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
        // Get the database connection pool
        const pool = await getDbConnection();

        // Execute the query
        const [results] = await pool.query(`
            SELECT symbol, permalink, address FROM collections
            LIMIT ?
        `, [limit]);

        if (results.length === 0) {
            return res.json({ message: 'No records found in the collections table.' });
        }

        res.json(results);
    } catch (error) {
        console.error('Error fetching data from collections table:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

