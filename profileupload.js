const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 5050;

app.use(bodyParser.json());
const API_KEY = 'APUVAUXICC2927IVW8RDN4W6Q6FWTFNHV8'; 
const BLOCKSCOUT_API_URL = 'https://blockscoutapi.hekla.taiko.xyz/api';
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

        res.status(200).json(results); // Return all distinct houses
    });
});
const collectionDetailsUrl="http://127.0.0.1:5050/getcollectionaddress";
const tokenHoldersBaseUrl = 'https://blockscoutapi.hekla.taiko.xyz/api';
/* Verify mints on smart contract(get mints from contracts) */
async function fetchCollectionDetails() {
    try {
      const response = await axios.get(collectionDetailsUrl);
      const collections = response.data;
  
      const contracts = [];
  
      let counter = 1;
  
      for (const collection of collections) {
        const contractAddress = collection.address;
  
        const tokenHoldersUrl = `${tokenHoldersBaseUrl}?module=token&action=getTokenHolders&contractaddress=${contractAddress}&page=1&offset=1000`;
        const tokenHoldersResponse = await axios.get(tokenHoldersUrl);
  
        const tokenHolders = tokenHoldersResponse.data.result;
        contracts.push({
          number: counter,
          address: contractAddress,
          holders: tokenHolders.map(holder => holder.address)
        });
  
        counter++;
      }
      return {
        contracts: contracts
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      return { error: 'Failed to fetch data' };
    }
  }
  app.get('/api/getholderaddress', async (req, res) => {
    const data = await fetchCollectionDetails();
    res.json(data);
  });
  
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
