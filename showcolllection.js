const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { getDbConnection } = require('./lib/db');
const { ethers } = require('ethers');

const app = express();
const port = 5000;

// Middleware to parse JSON bodies
app.use(express.json());

const collectionDetailsUrl = 'http://127.0.0.1:6000/collectiondetails';
const tokenHoldersBaseUrl = 'https://blockscoutapi.mainnet.taiko.xyz/api';
// Use CORS middleware
app.use(cors({
    origin: 'http://localhost:3000', // Replace with your actual domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));

// Helper function to convert IPFS URI
function ipfsToIpfsIo(ipfsUri) {
    return ipfsUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
}

// GET /getcollection endpoint
app.get('/getcollection', async (req, res) => {
    try {
        // Get the database connection pool
        const pool = await getDbConnection();

        // Execute the query with an additional condition for chain_id
        const [results] = await pool.query(`
            SELECT symbol, permalink, address FROM collections
            WHERE chain_id = 167000
        `);

        if (results.length === 0) {
            return res.json({ message: 'No records found in the collections table.' });
        }

        res.json(results);
    } catch (error) {
        console.error('Error fetching data from collections table:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// GET /fetchContractData endpoint
app.get('/fetchContractData', async (req, res) => {
    try {
        // Fetch collection data from /getcollection endpoint
        const collectionResponse = await axios.get('http://localhost:5000/getcollection');
        const collections = collectionResponse.data;

        if (!Array.isArray(collections) || collections.length === 0) {
            return res.status(404).json({ message: 'No collections found' });
        }

        // Define the ABI for the contract
        const abi = [
            'function name() view returns (string)',
            'function tokenURI(uint256 tokenId) view returns (string)'
        ];
        const provider = new ethers.JsonRpcProvider('https://rpc.hekla.taiko.xyz');

        // Function to fetch and process data from the contract
        const fetchDataForAddress = async (address) => {
            try {
                const contract = new ethers.Contract(address, abi, provider);

                const name = await contract.name();

                // Fetch tokenURI
                const tokenURI = await contract.tokenURI(0); // Default tokenId is 0

                // Fetch metadata
                const metadataUrl = ipfsToIpfsIo(tokenURI);
                const metadataResponse = await axios.get(metadataUrl);
                const metadata = metadataResponse.data;

                let imageUri = metadata.image;
                if (imageUri && imageUri.startsWith('ipfs://')) {
                    imageUri = ipfsToIpfsIo(imageUri);
                }

                return {
                    contractAddress: address,
                    name,
                    tokenURI,
                    imageUri
                };
            } catch (error) {
                console.error(`Error fetching data for contract address ${address}:`, error);
                return {
                    contractAddress: address,
                    name: null,
                    tokenURI: null,
                    imageUri: null
                };
            }
        };

        // Fetch data for all contract addresses
        const results = await Promise.all(
            collections.map(collection => fetchDataForAddress(collection.address))
        );

        // Filter out unsuccessful fetches
        const successfulResults = results.filter(result => result.name && result.tokenURI);

        res.json(successfulResults);
    } catch (error) {
        console.error('Error fetching contract data:', error);
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

        // Execute the query
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

// GET /topcreator endpoint
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
            const apiUrl = 'https://blockscoutapi.mainnet.taiko.xyz/api';

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

// GET /topcollector endpoint
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

        // Return the fetched results
        res.json(results);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
async function fetchCollectionDetails() {
    try {
        const response = await axios.get(collectionDetailsUrl);
        const collections = response.data;
  
        const contracts = [];
  
        let counter = 1;
  
        for (const collection of collections) {
            const contractAddress = collection.address;
  
            const tokenHoldersUrl = `${tokenHoldersBaseUrl}?module=token&action=getTokenHolders&contractaddress=${contractAddress}&page=1&offset=100`;
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
app.get('/getholderaddress', async (req, res) => {
    const data = await fetchCollectionDetails();
    res.json(data);
  });

// Function to fetch holder addresses and contract addresses from the API
async function fetchHoldersAndContracts() {
  try {
    const response = await axios.get('http://localhost:6000/getholderaddress');
    return response.data;
  } catch (error) {
    console.error('Error fetching holders and contracts:', error);
    throw error;
  }
}

// Function to fetch the transaction count for a given holder and contract address
async function fetchTransactionCount(holderAddress, contractAddress) {
  try {
    const response = await axios.get(`http://localhost:6000/getxn/${holderAddress}/${contractAddress}`);
    return response.data.count;  // Assuming the API response contains a field `count`
  } catch (error) {
    console.error(`Error fetching transaction count for holder ${holderAddress}:`, error);
    return 0;
  }
}

// Function to fetch and rank the top collectors
async function fetchTopCollector() {
  try {
    const data = await fetchHoldersAndContracts();

    if (!data || !Array.isArray(data.contracts)) {
      throw new Error('Invalid data format received from API');
    }

    const holderStats = {};

    for (const contract of data.contracts) {
      const contractAddress = contract.address;
      const holders = contract.holders;

      if (!contractAddress || !Array.isArray(holders)) {
        console.error(`Invalid contract data for contract address: ${contractAddress}`);
        continue;
      }

      for (const holder of holders) {
        const count = await fetchTransactionCount(holder, contractAddress);
        if (!holderStats[holder]) {
          holderStats[holder] = {
            totalTransactions: 0,
            contracts: new Set()
          };
        }
        holderStats[holder].totalTransactions += count;
        holderStats[holder].contracts.add(contractAddress);
      }
    }

    const holderArray = Object.keys(holderStats).map(holder => ({
      holder,
      totalTransactions: holderStats[holder].totalTransactions,
      contractCount: holderStats[holder].contracts.size
    }));

    holderArray.sort((a, b) => {
      if (b.contractCount === a.contractCount) {
        return b.totalTransactions - a.totalTransactions;
      }
      return b.contractCount - a.contractCount;
    });

    return holderArray;
  } catch (error) {
    console.error('Error processing contract holders:', error);
    throw error;
  }
}

// Define the endpoint to get the top collectors
app.get('/gettopcollector', async (req, res) => {
  try {
    const topCollectors = await fetchTopCollector();
    res.json(topCollectors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top collectors' });
  }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

