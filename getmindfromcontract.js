 /* Get mint from contract
 Set-up a cron job that automatically trigger every 2 hours to checks and compare 
 Taikocampagin collections totatmints delta vs the data feed from this.

 Constraints of 2-3ms for every fetch and store to database, to control
 Rate limits
 */

 const express = require('express');
 const axios = require('axios');
 const cors = require('cors');
 const mysql = require('mysql2');
 
 const app = express();
 const PORT = 6000;
 const BLOCKSCOUT_API_URL = 'https://blockscoutapi.hekla.taiko.xyz/api';
 
 app.use(cors());
 
 const connection = mysql.createConnection({
     host: 'localhost',
     user: 'root',
     password: 'Koireng@1',
     database: 'mydatabase'
 });
 
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
 
 async function fetchCollectionDetails(contractAddress) {
     const tokenHoldersBaseUrl = 'https://blockscoutapi.hekla.taiko.xyz/api'; // Base URL for token holders
 
     try {
         const tokenHoldersUrl = `${tokenHoldersBaseUrl}?module=token&action=getTokenHolders&contractaddress=${contractAddress}&page=1&offset=1000`;
         const tokenHoldersResponse = await axios.get(tokenHoldersUrl);
 
         const tokenHolders = tokenHoldersResponse.data.result;
         return {
             address: contractAddress,
             holders: tokenHolders.map(holder => holder.address)
         };
     } catch (error) {
         console.error(`Error fetching data for ${contractAddress}:`, error);
         return { error: 'Failed to fetch data' };
     }
 }
 
 // Endpoint to fetch collection details using addresses from the database
 app.get('/api/fetchcollectiondetails', async (req, res) => {
     try {
         // Fetch collection addresses first
         const collectionResponse = await axios.get('http://localhost:6000/api/getcollectionaddress');
         const collections = collectionResponse.data;
 
         const contracts = [];
 
         for (const collection of collections) {
             const contractAddress = collection.house; // Access the address from the fetched data
             const collectionDetails = await fetchCollectionDetails(contractAddress);
             contracts.push(collectionDetails);
         }
 
         res.status(200).json({ contracts });
     } catch (error) {
         console.error('Error fetching collection details:', error);
         res.status(500).json({ error: 'Failed to fetch collection details' });
     }
 });
 
 // Start the server
 app.listen(PORT, () => {
     console.log(`Server is running on http://localhost:${PORT}`);
 });
 