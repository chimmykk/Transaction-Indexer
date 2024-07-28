const axios = require('axios');

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

    console.log('Ranked holders based on interactions:', holderArray);
  } catch (error) {
    console.error('Error processing contract holders:', error);
  }
}

fetchTopCollector();
