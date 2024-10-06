const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 5050;

app.use(bodyParser.json());
const API_KEY = 'APUVAUXICC2927IVW8RDN4W6Q6FWTFNHV8'; 
// const BLOCKSCOUT_API_URL = 'https://blockscoutapi.hekla.taiko.xyz/api';
app.use(cors({
    origin: 'http://127.0.0.1:8000',
    methods: ['POST','GET'],
    allowedHeaders: ['Content-Type'],
}));

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Koireng@1',
    database: 'mydatabase'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL as id ' + connection.threadId);
});


/* Get's post request from front-end and create campaign details on database(Not needed as can query from existing db using chainid with respect to timeline) */
// app.post('/createcampaign', (req, res) => {
//     const { symbol, name, feeRecipient } = req.body;

//     if (!symbol || !name || !feeRecipient) {
//         return res.status(400).json({ error: 'symbol, name, and feeRecipient are required' });
//     }

//     // Check if the campaign already exists
//     const checkQuery = 'SELECT * FROM taikocampaigncollection WHERE symbol = ?';

//     connection.query(checkQuery, [symbol], (err, results) => {
//         if (err) {
//             console.error('Error checking campaign existence: ' + err.stack);
//             return res.status(500).json({ error: 'Internal server error' });
//         }

//         if (results.length > 0) {
//             // Campaign already exists
//             return res.status(409).json({ error: 'Campaign already exists' });
//         } else {
//             // Insert new campaign into taikocampaigncollection
//             const insertQuery = 'INSERT INTO taikocampaigncollection (symbol, name, feeRecipient) VALUES (?, ?, ?)';
//             connection.query(insertQuery, [symbol, name, feeRecipient], (err) => {
//                 if (err) {
//                     console.error('Error creating campaign collection: ' + err.stack);
//                     return res.status(500).json({ error: 'Internal server error' });
//                 }
//                 console.log(`Campaign collection created: Symbol: ${symbol}, Name: ${name}, Fee Recipient: ${feeRecipient}`);
//                 res.status(200).json({ message: 'Campaign collection created successfully' });
//             });
//         }
//     });
// });

/* Get's post request from front-end and store the data on the database */
app.post('/api/playerdetails', (req, res) => {
    const { address, house, housetype, housename, latestactivity } = req.body;

    // Validate input
    if (!address || !house || !housetype || !housename || !latestactivity) {
        return res.status(400).json({ error: 'address, house, housetype, housename, and latestactivity are required' });
    }

    // Query to check if the combination of address and house exists
    const checkQuery = 'SELECT * FROM taikocampaign WHERE address = ? AND house = ?';
    
    connection.query(checkQuery, [address, house], (err, results) => {
        if (err) {
            console.error('Error checking player details:', err.stack);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            // No existing row with this address and house, insert a new row
            const insertQuery = 'INSERT INTO taikocampaign (address, house, housetype, housename, totalmint, latestactivity) VALUES (?, ?, ?, ?, 1, ?)';
            connection.query(insertQuery, [address, house, housetype, housename, latestactivity], (err) => {
                if (err) {
                    console.error('Error saving player details:', err.stack);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                console.log(`Player details saved: ${address}, ${house}, ${housetype}, ${housename}, totalmint: 1`);
                res.status(200).json({ message: 'Player details saved successfully' });
            });
        } else {
            // Row with this combination exists, increment the totalMint
            const updateQuery = 'UPDATE taikocampaign SET totalmint = totalmint + 1, latestactivity = ? WHERE address = ? AND house = ?';
            connection.query(updateQuery, [latestactivity, address, house], (err) => {
                if (err) {
                    console.error('Error updating player details:', err.stack);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                console.log(`TotalMint incremented for: ${address}, ${house}`);
                res.status(200).json({ message: 'TotalMint incremented successfully' });
            });
        }
    });
});

    
  /* testcase hekla */
  app.get('/checktxnhekla/:txnhash', async (req, res) => {
    const txnHash = req.params.txnhash;
    const apiUrl = `https://blockscoutapi.hekla.taiko.xyz/api?module=transaction&action=gettxreceiptstatus&txhash=${txnHash}`;

    try {
        const response = await axios.get(apiUrl);
        const status = response.data.result.status; // Assuming the API returns a JSON with result.status field

        if (status === "1") {
            res.json({ message: "success" });
        } else {
            res.json({ message: "failed" });
        }
    } catch (error) {
        console.error('Error fetching transaction status:', error);
        res.status(500).json({ error: 'Failed to fetch transaction status' });
    }
});

/* testcase mainnet */
app.get('/checktxn/:txnhash', async (req, res) => {
    const { txnhash } = req.params;
  
    try {
      const response = await axios.get('https://api.taikoscan.io/api', {
        params: {
          module: 'transaction',
          action: 'gettxreceiptstatus',
          txhash: txnhash,
          apikey: API_KEY,
        },
      });
  
      const resultStatus = response.data.result.status;
  
      if (resultStatus === '0') {
        res.status(200).json({ status: 'failed' });
      } else if (resultStatus === '1') {
        res.status(200).json({ status: 'success' });
      } else {
        res.status(200).json({ status: 'unknown' }); // Handle other statuses as needed
      }
    } catch (error) {
      console.error('Error fetching transaction status:', error);
      res.status(500).json({ error: 'Failed to fetch transaction status' });
    }
  });
  /* Get all the tokens mints from distinct wallet address wrt to house(diff contrac address) */
  app.get('/api/gettotalmint', (req, res) => {
    const query = `
        SELECT address, SUM(totalmint) AS totalMint 
        FROM taikocampaign 
        GROUP BY address
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching mint count:', err.stack);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }

        res.status(200).json(results); // Return all results
    });
});
/* Get all the collecion deployed */
app.get('/api/getcollectionaddress', (req, res) => {
    const query = `
        SELECT DISTINCT house 
        FROM taikocampaign
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching houses:', err.stack);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }

        res.status(200).json(results); 
    });
});
/*  Get the top mints
    Which means the address that minted every collecion available.
 */

app.get('/api/getranksmostmint', async (req, res) => {
    try {
        // Fetch data from the gettotalmint API
        const response = await axios.get('http://localhost:5050/api/gettotalmint');
        
        const results = response.data;

        if (!results || results.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }

        // Add ranks based on totalMint
        const rankedResults = results.map((item, index) => ({
            rank: index + 1,
        holder: item.address,
            points: item.totalMint
        }));

        res.status(200).json(rankedResults);
    } catch (err) {
        console.error('Error fetching ranks:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/*  Get the top creator
    Which means the address that created the most successfull collection.
    Reverse the address of the contract creator of the top mints
 */
    app.get('/api/gettopcreator', async (req, res) => {
        try {
            // Fetch data from the gettotalmint API
            const response = await axios.get('http://localhost:5050/api/gettotalmint');
            
            const results = response.data;
    
            if (!results || results.length === 0) {
                return res.status(404).json({ message: 'No data found' });
            }
    
            // Add ranks based on totalMint
            const rankedResults = results.map((item, index) => ({
                rank: index + 1,
            holder: item.address,
                points: item.totalMint
            }));
    
            res.status(200).json(rankedResults);
        } catch (err) {
            console.error('Error fetching ranks:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });

    /*  Get the top collector
        Which means an address that collects every unique NFTs
        available (Not on basis of most collection but collecting all unique 1:1 collection)
 */

        app.get('/api/gettopcollector', async (req, res) => {
            try {
                // Step 1: Get the top collector
                const collectorQuery = `
                    SELECT 
                        address, 
                        COUNT(DISTINCT house) AS houseCount, 
                        SUM(totalMint) AS totalMint
                    FROM 
                        taikocampaign
                    GROUP BY 
                        address
                    HAVING 
                        houseCount = (SELECT COUNT(DISTINCT house) FROM taikocampaign)
                    ORDER BY 
                        totalMint DESC
                    LIMIT 1;
                `;
        
                const collectorResults = await new Promise((resolve, reject) => {
                    connection.query(collectorQuery, (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    });
                });
        
                if (collectorResults.length === 0) {
                    return res.status(404).json({ message: 'No top collector found' });
                }
        
                const topCollector = collectorResults[0];
        
                // Step 2: Fetch the houses and house names for the top collector
                const housesQuery = `
                    SELECT DISTINCT house, houseName 
                    FROM taikocampaign 
                    WHERE address = ?;
                `;
        
                const housesResults = await new Promise((resolve, reject) => {
                    connection.query(housesQuery, [topCollector.address], (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    });
                });
        
                // Combine the results
                const response = {
                    address: topCollector.address,
                    houseCount: topCollector.houseCount,
                    totalMint: topCollector.totalMint,
                    houses: housesResults.map(h => `${h.house}, ${h.houseName}`) // Format as "address, houseName"
                };
        
                res.status(200).json(response);
            } catch (err) {
                console.error('Error fetching top collector:', err.message);
                return res.status(500).json({ error: 'Internal server error' });
            }
        });        
  
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
