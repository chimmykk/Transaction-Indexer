  /* Get mint from contract
  -> Fetch the collection's address from the databases, reverse the contract address
  -> To fetch the holders based on the collection's address(contract address)
 */
  const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mysql = require('mysql2');
const Queue = require('bull');

const requestQueue = new Queue('requestQueue');

const app = express();
const PORT = 6000;
// const BLOCKSCOUT_API_URL = 'https://blockscoutapi.hekla.taiko.xyz/api';

app.use(cors());

// Process jobs in the queue
requestQueue.process(async (job) => {
    const { contractAddress, holderAddress } = job.data;
    return sendRequest(contractAddress, holderAddress);
});



  // MySQL connection setup
  const connection = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Koireng@1',
      database: 'mydatabase'
  });
  
  // API endpoint to get collection addresses
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
  
  // Function to fetch collection details
  async function fetchCollectionDetails(contractAddress) {
      const tokenHoldersBaseUrl = 'https://blockscoutapi.hekla.taiko.xyz/api'; // Base URL for token holders
  
      try {
          const tokenHoldersUrl = `${tokenHoldersBaseUrl}?module=token&action=getTokenHolders&contractaddress=${contractAddress}&page=1&offset=1000`;
          const tokenHoldersResponse = await axios.get(tokenHoldersUrl);
          const tokenHolders = tokenHoldersResponse.data.result || []; // Handle undefined result
  
          return {
              address: contractAddress,
              holders: tokenHolders.map(holder => holder.address)
          };
      } catch (error) {
          console.error(`Error fetching data for ${contractAddress}:`, error);
          return { error: 'Failed to fetch data' };
      }
  }
  
  // API endpoint to fetch collection details using addresses from the database
  app.get('/api/fetchcollectiondetails', async (req, res) => {
    const query = `
        SELECT address, house, totalmint AS storedTokenBalance
        FROM taikocampaign
    `;

    connection.query(query, async (err, results) => {
        if (err) {
            console.error('Error fetching data from database:', err.stack);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }

        const holderMap = {};

        for (const result of results) {
            const { address, house: contractAddress, storedTokenBalance } = result;
            const tokenBalanceUrl = `https://blockscoutapi.hekla.taiko.xyz/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}`;

            try {
                const tokenBalanceResponse = await axios.get(tokenBalanceUrl);
                const fetchedTokenBalance = parseInt(tokenBalanceResponse.data.result || '0', 10); 
                if (holderMap[address]) {
                    holderMap[address].aggregatepoints += fetchedTokenBalance;
                    holderMap[address].houses.push({
                        house: contractAddress,
                        tokenBalance: fetchedTokenBalance
                    });
                } else {
                    holderMap[address] = {
                        address,
                        aggregatepoints: fetchedTokenBalance,
                        houses: [{
                            house: contractAddress,
                            tokenBalance: fetchedTokenBalance
                        }]
                    };
                }

                // Compare fetched token balance with stored totalmint value in the DB
                if (fetchedTokenBalance > parseInt(storedTokenBalance || '0', 10)) {
                    // Update the 'totalmint' field with the new, greater token balance
                    const updateQuery = `
                        UPDATE taikocampaign
                        SET totalmint = ?
                        WHERE address = ? AND house = ?
                    `;
                    connection.query(updateQuery, [fetchedTokenBalance, address, contractAddress], (updateErr) => {
                        if (updateErr) {
                            console.error(`Error updating token balance for ${address} and ${contractAddress}:`, updateErr.stack);
                        } else {
                            console.log(`Updated totalmint for ${address} at ${contractAddress} to ${fetchedTokenBalance}`);
                        }
                    });
                }
            } catch (error) {
                console.error(`Error fetching balance for ${address} and ${contractAddress}:`, error);
            }
        }

        const aggregatedData = Object.values(holderMap);

        res.status(200).json({
            aggregatedData
        });
    });
});



  app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
  });
  