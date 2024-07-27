const express = require('express');
const fetch = require('node-fetch');
const { getDbConnection } = require('./lib/db');

const app = express();
const port = 5000;

app.use(express.json());

app.get('/getcollection', async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
        const pool = await getDbConnection();
        const [results] = await pool.query(`
            SELECT address, name, type, symbol FROM collections
            ORDER BY name
            LIMIT ?
        `, [limit]);

        if (results.length === 0) {
            return res.json({ message: 'No records found in the collections table.' });
        }

        const fetchTokenDetails = async (address) => {
            const apiUrl = `https://blockscoutapi.hekla.taiko.xyz/api?module=token&action=getToken&contractaddress=${address}`;

            try {
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (data.status === "1" && data.result && data.result.totalSupply) {
                    const holdersApiUrl = `https://blockscoutapi.hekla.taiko.xyz/api?module=token&action=getTokenHolders&contractaddress=${address}&page=1&offset=10000`;
                    const holdersResponse = await fetch(holdersApiUrl);
                    const holdersData = await holdersResponse.json();

                    if (holdersData.status === "1" && holdersData.result && holdersData.result.length > 0) {
                        const maxHolder = holdersData.result.reduce((max, holder) => {
                            return (parseInt(holder.value, 10) > parseInt(max.value, 10)) ? holder : max;
                        });

                        return {
                            additionalInfo: data,
                            tokenHolder: maxHolder
                        };
                    }
                }
                return { additionalInfo: data, tokenHolder: null };
            } catch (error) {
                console.error(`Error fetching token details for address ${address}:`, error);
                return { additionalInfo: {}, tokenHolder: null };
            }
        };
        const enhancedResults = await Promise.all(
            results.map(async (item) => {
                const tokenDetails = await fetchTokenDetails(item.address);

                return {
                    address: item.address,
                    name: item.name,
                    type: item.type,
                    symbol: item.symbol,
                    additionalInfo: tokenDetails.additionalInfo,
                    tokenHolder: tokenDetails.tokenHolder
                };
            })
        );

        enhancedResults.sort((a, b) => {
            const totalSupplyA = parseInt(a.additionalInfo.result.totalSupply, 10);
            const totalSupplyB = parseInt(b.additionalInfo.result.totalSupply, 10);
            return totalSupplyB - totalSupplyA;
        });

        res.json(enhancedResults);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to get most holders data
app.get('/mostholder', async (req, res) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;

    try {
        const pool = await getDbConnection();

        // Check if the connection is established
        const isConnected = await checkConnection(pool);
        if (!isConnected) {
            return res.status(500).json({ error: 'Database connection failed' });
        }

        const [results] = await pool.query(`
            SELECT * FROM taikocampaign
            ORDER BY totalmint DESC
            LIMIT ?
        `, [limit]);

        const response = results.length > 0
            ? results
                .sort((a, b) => b.totalmint - a.totalmint)
                .map((row, index) => ({
                    rank: index + 1,
                    wallet: row.address,
                    username: row.username,
                    rankScore: index + 1,
                    nfts: row.totalmint,
                    labels: row.categories,
                    activity: `https://mintpad-trailblazers.vercel.app/activity-example.svg`,
                    avatar: `https://res.cloudinary.com/twdin/image/upload/v1719839745/avatar-example_mc0r1g.png`,
                    opensea: row.opensea,
                    twitter: row.twitter,
                    blockscan: row.Blockscan,
                    profile: row.profilepic,
                }))
            : { message: 'No records found in the taikocampaign table.' };

        res.json(response);
    } catch (error) {
        console.error('Error fetching data from taikocampaign table:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to get most minted data
app.get('/mostmint', async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;

    try {
        const pool = await getDbConnection();

        // Check if the connection is established
        const isConnected = await checkConnection(pool);
        if (!isConnected) {
            return res.status(500).json({ error: 'Database connection failed' });
        }

        const [results] = await pool.query(`
            SELECT * FROM taikocampaign
            ORDER BY totalmint DESC
            LIMIT ?
        `, [limit]);

        const response = results.length > 0
            ? results
                .sort((a, b) => b.totalmint - a.totalmint)
                .map((row, index) => ({
                    rank: index + 1,
                    wallet: row.address,
                    username: row.username,
                    rankScore: index + 1,
                    nfts: row.totalmint,
                    labels: row.categories,
                    activity: `https://mintpad-trailblazers.vercel.app/activity-example.svg`,
                    avatar: `https://res.cloudinary.com/twdin/image/upload/v1719839745/avatar-example_mc0r1g.png`,
                    opensea: row.opensea,
                    twitter: row.twitter,
                    blockscan: row.Blockscan,
                    profile: row.profilepic,
                }))
            : { message: 'No records found in the taikocampaign table.' };

        res.json(response);
    } catch (error) {
        console.error('Error fetching data from taikocampaign table:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
