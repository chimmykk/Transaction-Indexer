const express = require('express');
const { getDbConnection } = require('./lib/db');
const fetch = require('node-fetch'); // Make sure to install this package: npm install node-fetch
const axios = require('axios'); // Import axios

const app = express();
const port = 1100; // You can use any port number you prefer

app.use(express.json()); // Middleware to parse JSON bodies

// Middleware to set CORS headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// GET /getcollection endpoint
app.get('/getcollection', async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;

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

// GET /mostmint endpoint
app.get('/mostmint', async (req, res) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;

    try {
        // Get the database connection pool
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
                .map((row, index) => ({
                    rank: index + 1,
                    wallet: row.address,
                    username: row.username,
                    rankScore: index + 1,
                    nfts: row.totalmint,
                }))
            : { message: 'No records found in the taikocampaign table.' };

        res.json(response);
    } catch (error) {
        console.error('Error fetching data from taikocampaign table:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/topcreator', async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the database connection pool
        const pool = await getDbConnection();

        // Query to get contract addresses
        const [rows] = await pool.query('SELECT * FROM top_creattor');
        const contractAddresses = rows.map(row => row.contractaddress);

        // Function to fetch contract deployer details
        const fetchContractDeployer = async (contractAddress) => {
            const apiUrl = 'https://blockscoutapi.hekla.taiko.xyz/api';

            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        module: 'contract',
                        action: 'getcontractcreation',
                        contractaddresses: contractAddress
                    }
                });

                const data = response.data.result[0];
                return {
                    contractAddress: data.contractAddress,
                    contractCreator: data.contractCreator
                };
            } catch (error) {
                console.error(`Error fetching details for contract ${contractAddress}:`, error);
                return {
                    contractAddress,
                    contractCreator: null
                };
            }
        };

        // Fetch contract deployer details for all addresses
        const contractDetails = await Promise.all(contractAddresses.map(fetchContractDeployer));

        // Update rows with contract creator details
        const updatedData = rows.map(row => {
            const details = contractDetails.find(detail => detail.contractAddress === row.contractaddress);
            return {
                ...row,
                contractCreator: details ? details.contractCreator : null
            };
        });

        res.status(200).json(updatedData);

    } catch (error) {
        console.error('Error fetching data from database:', error);
        res.status(500).json({ error: 'Error fetching data from database' });
    }
});

app.get('/topcollector', async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the database connection pool
        const pool = await getDbConnection();

        // Execute the query
        const [rows] = await pool.query('SELECT * FROM top_collectors');

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching data from database:', error);
        res.status(500).json({ error: 'Error fetching data from database' });
    }
});

// GET /mostholder endpoint
app.get('/mostholder', async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;

    try {
        // Get the database connection pool
        const pool = await getDbConnection();

        // Execute the query to fetch data from the local database
        const [results] = await pool.query(
            `SELECT address, name, type, symbol FROM collections ORDER BY name LIMIT ?`,
            [limit]
        );

        if (results.length === 0) {
            return res.json({ message: 'No records found in the collections table.' });
        }

        // Helper function to fetch additional token details
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

        // Fetch token details concurrently for all results
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

        // Sort by totalSupply in descending order
        enhancedResults.sort((a, b) => {
            const totalSupplyA = a.additionalInfo && a.additionalInfo.result && a.additionalInfo.result.totalSupply
                ? parseInt(a.additionalInfo.result.totalSupply, 10)
                : 0;
            const totalSupplyB = b.additionalInfo && b.additionalInfo.result && b.additionalInfo.result.totalSupply
                ? parseInt(b.additionalInfo.result.totalSupply, 10)
                : 0;
            return totalSupplyB - totalSupplyA;
        });

        res.json(enhancedResults);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Function to check database connection
async function checkConnection(pool) {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        console.error('Database connection check failed:', error);
        return false;
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
