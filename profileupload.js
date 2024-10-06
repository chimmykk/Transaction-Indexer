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
    origin: ['http://127.0.0.1:5050', 'http://localhost:3000'], // Allow both localhost and 127.0.0.1
    methods: ['POST', 'GET'],
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
    
            // Create a map to hold each address's total mints and houses
            const rankedResultsMap = {};
    
            // Iterate through each result and populate the map
            for (const item of results) {
                const { address, totalMint } = item;
    
                if (!rankedResultsMap[address]) {
                    rankedResultsMap[address] = {
                        address,
                        totalMint: 0,
                        houses: []
                    };
                }
    
                // Aggregate totalMint
                rankedResultsMap[address].totalMint += totalMint;
    
                const housesQuery = `
                    SELECT house, houseName, totalMint 
                    FROM taikocampaign 
                    WHERE address = ?;
                `;
                const housesResults = await new Promise((resolve, reject) => {
                    connection.query(housesQuery, [address], (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    });
                });
    
                // Add houses to the map as formatted strings
                for (const house of housesResults) {
                    rankedResultsMap[address].houses.push(
                        `${house.house}, ${house.houseName}, ${house.totalMint}` // Format as "address, name, points"
                    );
                }
            }
    
            // Convert the map to an array and sort by totalMint
            const rankedResults = Object.values(rankedResultsMap)
                .sort((a, b) => b.totalMint - a.totalMint) // Sort by totalMint in descending order
                .map((item, index) => ({
                    rank: index + 1,
                    holder: item.address,
                    totalMint: item.totalMint,
                    houses: item.houses // Houses are now formatted strings
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
            const responseFromApi = await axios.get('http://localhost:5050/api/gettotalmint');
            const results = responseFromApi.data;
    
            if (!results || results.length === 0) {
                return res.status(404).json({ message: 'No data found' });
            }
    
            // Create a map to hold each address's total mints and houses
            const creatorMap = {};
    
            // Iterate through each result and populate the map
            for (const item of results) {
                const { address, totalMint } = item;
    
                if (!creatorMap[address]) {
                    creatorMap[address] = {
                        address,
                        totalMint: Number(totalMint), // Ensure totalMint is a number
                        houses: []
                    };
                } else {
                    // Only set totalMint if it's not already there (to avoid duplication)
                    creatorMap[address].totalMint += Number(totalMint);
                }
    
                // Fetch houses interacted for the current address
                const housesQuery = `
                    SELECT house, houseName, totalMint 
                    FROM taikocampaign 
                    WHERE address = ?;
                `;
                const housesResults = await new Promise((resolve, reject) => {
                    connection.query(housesQuery, [address], (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    });
                });
    
                // Add houses to the map
                for (const house of housesResults) {
                    const { house: houseAddress, houseName, totalMint: houseMint } = house;
    
                    // Push house details into the creator map
                    creatorMap[address].houses.push({
                        address: houseAddress,
                        name: houseName,
                        points: houseMint 
                    });
                }
            }
    
            // Convert the map to an array
            const creatorResults = Object.values(creatorMap);
    
            // Sort creators based on totalMint in descending order
            const sortedCreators = creatorResults.sort((a, b) => b.totalMint - a.totalMint);
    
            // Prepare the response, formatting the houses and adding ranks
            const formattedCreators = sortedCreators.map((creator, index) => ({
                rank: index + 1, // Assign rank based on index
                address: creator.address,
                totalMint: creator.totalMint,
                houses: creator.houses.map(house => 
                    `${house.address}, ${house.name}, ${house.points}`
                ) // House addresses and names formatted as required
            }));
    
            res.status(200).json(formattedCreators);
        } catch (err) {
            console.error('Error fetching top creator:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    /*  Get the top collector
        Which means an address that collects every unique NFTs
        available (Not on basis of most collection but collecting all unique 1:1 collection)
 */
        app.get('/api/gettopcollector', async (req, res) => {
            try {
                // Step 1: Get all collectors
                const collectorQuery = `
                    SELECT 
                        address, 
                        COUNT(DISTINCT house) AS houseCount, 
                        SUM(totalMint) AS totalMint
                    FROM 
                        taikocampaign
                    GROUP BY 
                        address;
                `;
                
                const collectorResults = await new Promise((resolve, reject) => {
                    connection.query(collectorQuery, (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    });
                });
        
                if (collectorResults.length === 0) {
                    return res.status(404).json({ message: 'No collectors found' });
                }
        
                // Create a map to hold each address's total mints and houses
                const collectorMap = {};
        
                // Iterate through each collector result and populate the map
                for (const collector of collectorResults) {
                    const { address, totalMint } = collector;
        
                    if (!collectorMap[address]) {
                        collectorMap[address] = {
                            address,
                            totalMint: Number(totalMint), // Ensure totalMint is a number
                            houses: []
                        };
                    } else {
                        // Accumulate totalMint if address already exists
                        collectorMap[address].totalMint += Number(totalMint);
                    }
        
                    // Fetch houses and their points for the current address
                    const housesQuery = `
                        SELECT house, houseName, totalMint AS points 
                        FROM taikocampaign 
                        WHERE address = ?;
                    `;
                    const housesResults = await new Promise((resolve, reject) => {
                        connection.query(housesQuery, [address], (err, results) => {
                            if (err) return reject(err);
                            resolve(results);
                        });
                    });
        
                    // Add houses to the map
                    for (const house of housesResults) {
                        const { house: houseAddress, houseName, points } = house;
        
                        // Push house details into the collector map
                        collectorMap[address].houses.push({
                            address: houseAddress,
                            name: houseName,
                            points // Include points for the house
                        });
                    }
                }
        
                // Convert the map to an array
                const collectorResultsArray = Object.values(collectorMap);
        
                // Sort collectors based on totalMint in descending order
                collectorResultsArray.sort((a, b) => b.totalMint - a.totalMint);
        
                // Prepare the response, formatting the houses and adding ranks
const formattedCollectors = collectorResultsArray.map((collector, index) => ({
    rank: index + 1, // Assign rank based on index
    address: collector.address,
    totalMint: collector.totalMint,
    houses: collector.houses.map(house => 
        `${house.address}, ${house.name}, ${house.points}` // Format houses as required
    ) // Now each house will be a string
}));

        
                res.status(200).json(formattedCollectors);
            } catch (err) {
                console.error('Error fetching collectors:', err.message);
                return res.status(500).json({ error: 'Internal server error' });
            }
        });
        
  
        app.get('/gettaikocollection', (req, res) => {
            const query = `
                SELECT * 
                FROM collections
                WHERE chain_id = 167009
                ORDER BY created_at DESC
                LIMIT 15
            `;
        
            connection.query(query, (err, results) => {
                if (err) {
                    console.error('Error fetching collections:', err.stack);
                    return res.status(500).json({ error: 'Internal server error' });
                }
        
                if (results.length === 0) {
                    return res.status(404).json({ message: 'No data found' });
                }
        
                res.status(200).json(results); 
            });
        });

      /* Get all collections ranked by total mints */
app.get('/topcollection', (req, res) => {
    const query = `
        SELECT house, COUNT(house) AS house_count, SUM(CAST(totalmint AS UNSIGNED)) AS total_mint
        FROM taikocampaign
        GROUP BY house
        ORDER BY total_mint DESC;  -- Order by total_mint for ranking
    `;
    
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching top collections: ' + error);
            return res.status(500).json({ error: 'Database query error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ message: 'No houses found' });
        }

        // Add rank to each collection based on total_mint
        const rankedResults = results.map((item, index) => ({
            ...item,
            rank: index + 1 // Rank starts at 1
        }));

        res.json(rankedResults); // Return all houses with their count, total mint, and rank
    });
});

/* Get the permalink of the contract address
    Pass the contract address and get the permalink for the 
    mint section on the site
*/
       
app.get('/api/getpermalink/address/:address', (req, res) => {
    const address = req.params.address; // Get the address from the route parameter
    const chainId = 167009; // Set the chain ID

    // Check if the address is provided
    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }

    const query = `
        SELECT permalink 
        FROM collections 
        WHERE address = ? AND chain_id = ?
    `;

    connection.query(query, [address, chainId], (err, results) => {
        if (err) {
            console.error('Error fetching permalink:', err.stack);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No permalink found for the given address' });
        }

        res.status(200).json(results[0]); // Return the first result (the permalink)
    });
});


  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
