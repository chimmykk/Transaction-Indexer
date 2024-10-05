 /* Get mint from contract
 Set-up a cron job that automatically trigger every 2 hours to checks and compare 
 Taikocampagin collections totatmints delta vs the data feed from this.

 Constraints of 2-3ms for every fetch and store to database, to control
 Rate limits
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 6000;
const BLOCKSCOUT_API_URL = 'https://blockscoutapi.hekla.taiko.xyz/api';

app.use(cors());

// Fetch transactions based on contract address
async function fetchTransactions(contractAddress) {
  try {
    const response = await axios.get(`${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${contractAddress}`);
    // console.log('API Response:', response.data);
// Too much of log

    if (!response.data || !response.data.result || !Array.isArray(response.data.result)) {
      throw new Error('Invalid API response structure');
    }

    const transactions = response.data.result
      .filter(tx => tx.input.startsWith('0x84bb1e42')) // Filter transactions that have input/method of '0x84bb1e42'
      .map(tx => ({
        to: tx.to,
        from: tx.from,
        hash: tx.hash, // Add hash just if needed to verify
        input: tx.input.substring(0, 10) // Display first 10 characters
      }));

    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    throw error;
  }
}

const collectionDetailsUrl = 'http://127.0.0.1:5050/api/getcollectionaddress';
const tokenHoldersBaseUrl = 'https://blockscoutapi.hekla.taiko.xyz/api';

// Fetch collection details and token holders
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

app.get('/getholderaddress', async (req, res) => {
  const data = await fetchCollectionDetails();
  res.json(data);
});

app.get('/getdetails', async (req, res) => {
  const { contractAddress, walletAddress } = req.query;

  if (!contractAddress || !walletAddress) {
    return res.status(400).json({ error: 'Missing contractAddress or walletAddress parameter' });
  }

  try {
    const transactions = await fetchTransactions(contractAddress);

    if (transactions.length === 0) {
      return res.status(404).json({ message: 'No transactions found for the given contract and wallet address' });
    }
    const filteredTransactions = transactions.filter(tx =>
      tx.to.toLowerCase() === walletAddress.toLowerCase() ||
      tx.from.toLowerCase() === walletAddress.toLowerCase()
    );

    res.json({
      totalCount: filteredTransactions.length,
      transactions: filteredTransactions
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching transactions' });
  }
});

// Enndpoint to fetch mint txn per address for * collection
app.get('/fetchminttxn', async (req, res) => {
  try {
    const contracts = await fetchCollectionDetails();

    const result = [];

    for (const contract of contracts.contracts) {
      const { address: contractAddress, holders } = contract;

      for (const holder of holders) {
        const details = await fetchTransactions(contractAddress);

        // Filter transactions for the current holder
        const holderTransactions = details.filter(tx =>
          tx.to.toLowerCase() === holder.toLowerCase() ||
          tx.from.toLowerCase() === holder.toLowerCase()
        );

        if (holderTransactions.length > 0) {
          result.push({
            contractAddress,
            holder,
            totalCount: holderTransactions.length,
            transactions: holderTransactions
          });
        }
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching mint transactions' });
  }
});

// get collector 

async function fetchMintCreatorTransactions() {
  try {
    const response = await axios.get('http://localhost:6000/fetchminttxn');
    const data = response.data;
    const collectorPoints = {};

    data.forEach(contract => {
      contract.transactions.forEach(txn => {
        const holder = txn.from.toLowerCase();
        if (!collectorPoints[holder]) {
          collectorPoints[holder] = { points: 0, collections: {} };
        }
        if (!collectorPoints[holder].collections[contract.contractAddress]) {
          collectorPoints[holder].collections[contract.contractAddress] = 0;
        }
        collectorPoints[holder].points += 1;
        collectorPoints[holder].collections[contract.contractAddress] += 1;
      });
    });

    const sortedCollectors = Object.entries(collectorPoints).sort((a, b) => b[1].points - a[1].points);

    return sortedCollectors.map(([holder, info], index) => ({
      rank: index + 1,
      wallet: holder,
      points: info.points,
      contractInteracted: Object.keys(info.collections).length, // Count distinct contract addresses
      collections: Object.entries(info.collections).map(([contractAddress, count]) => ({
        contractAddress,
        mints: count
      }))
    }));
  } catch (error) {
    console.error('Error fetching mint transactions:', error);
    throw error;
  }
}


// Route to get creator ranking
app.get('/getcreatorranking', async (req, res) => {
try {
  const rankings = await fetchMintCreatorTransactions();
  res.json(rankings);
} catch (error) {
  res.status(500).json({ error: 'Failed to fetch creator rankings' });
}
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
