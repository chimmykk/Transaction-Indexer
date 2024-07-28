const express = require('express');
const axios = require('axios');
const app = express();
const port = 2000;
async function fetchHoldersAndContracts() {
  try {
    const response = await axios.get('http://localhost:6000/getholderaddress');
    return response.data;
  } catch (error) {
    console.error('Error fetching holders and contracts:', error);
    throw error;
  }
}
async function fetchTransactionCount(holderAddress, contractAddress) {
  try {
    const response = await axios.get(`http://localhost:6000/getxn/${holderAddress}/${contractAddress}`);
    return response.data.count;  // Assuming the API response contains a field `count`
  } catch (error) {
    console.error(`Error fetching transaction count for holder ${holderAddress}:`, error);
    return 0;
  }
}
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
app.get('/gettopcollector', async (req, res) => {
  try {
    const topCollectors = await fetchTopCollector();
    res.json(topCollectors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top collectors' });
  }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
