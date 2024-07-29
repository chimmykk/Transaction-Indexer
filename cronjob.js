const express = require('express');
const axios = require('axios');
const mysql = require('mysql2');
const cron = require('node-cron');
const app = express();
const PORT = 1100;

const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Koireng@1',
    database: 'mydatabase'
});

// maybe config, or .env ( will just leave it) 

connection.getConnection((err, conn) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
    conn.release();
});

async function fetchContractDeployer(contractAddress) {
    const apiUrl = 'https://blockscoutapi.mainnet.taiko.xyz/api';

    try {
        const response = await axios.get(apiUrl, {
            params: {
                module: 'contract',
                action: 'getcontractcreation',
                contractaddresses: contractAddress
            }
        });

        if (response.data && response.data.result && response.data.result.length > 0) {
            return response.data.result[0].creator;
        } else {
            console.log(`Deployer Address for ${contractAddress}: Not found`);
            return 'Not found';
        }
    } catch (error) {
        console.error(`Error fetching details for contract ${contractAddress}:`, error);
        return 'Error';
    }
}

async function updateTopCollectors() {
    try {
        // Fetch data from first source
        const response1 = await axios.get('http://localhost:6000/fetchminttxn');
        const data1 = response1.data;

        const collectionPoints = {};

        data1.forEach(contract => {
            contract.transactions.forEach(txn => {
                const holder = txn.from.toLowerCase();
                const collection = contract.contractAddress.toLowerCase();

                if (!collectionPoints[collection]) {
                    collectionPoints[collection] = {};
                }

                if (!collectionPoints[collection][holder]) {
                    collectionPoints[collection][holder] = 0;
                }

                collectionPoints[collection][holder] += 1;
            });
        });

        const collectionTotals = {};
        Object.keys(collectionPoints).forEach(collection => {
            const holders = collectionPoints[collection];
            const totalPoints = Object.values(holders).reduce((sum, points) => sum + points, 0);
            collectionTotals[collection] = totalPoints;
        });

        const sortedCollections = Object.entries(collectionTotals)
            .sort(([, aPoints], [, bPoints]) => bPoints - aPoints);

        for (const [collection, totalPoints] of sortedCollections) {
            const deployerAddress = await fetchContractDeployer(collection);
            const rank = sortedCollections.findIndex(([addr,]) => addr === collection) + 1;

            const query = `
                INSERT INTO top_creattor (\`rank\`, contractaddress, points) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE points = VALUES(points), \`rank\` = VALUES(\`rank\`)
            `;
            const values = [rank, collection, totalPoints];

            connection.query(query, values, (err) => {
                if (err) {
                    console.error('Error inserting/updating data:', err);
                }
            });

            // Log the collection details
            console.log(`Collection Rank ${rank}: ${collection}`);
            console.log(`Total Points: ${totalPoints}`);
            console.log('---');
        }

        // Fetch data from second source
        const response2 = await axios.get('https://semjjonline.xyz/gettopcollector'); // this one should points towards your endpoint
        const data2 = response2.data;

        const sortedCollectors = data2.sort((a, b) => b.totalTransactions - a.totalTransactions);

        for (let rank = 0; rank < sortedCollectors.length; rank++) {
            const collector = sortedCollectors[rank];
            const { holder, totalTransactions } = collector;
            const points = totalTransactions;

            const query = `
                INSERT INTO top_collectors (\`rank\`, holder, points) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE points = VALUES(points), \`rank\` = VALUES(\`rank\`)
            `;
            const values = [rank + 1, holder, points];

            connection.query(query, values, (err) => {
                if (err) {
                    console.error('Error inserting/updating data:', err);
                }
            });

            // Log the collector details
            console.log(`Collector Rank ${rank + 1}: ${holder}`);
            console.log(`Total Transactions (Points): ${points}`);
            console.log('---');
        }

        console.log('Top collector data updated successfully');

    } catch (error) {
        console.error('Error fetching top collectors:', error);
    }
}

async function updateTaikoCampaign() {
    try {
        const response = await axios.get('http://localhost:6000/fetchviacontract');
        const data = response.data;

        for (const item of data) {
            const { holder, totalCount } = item;

            const query = 'SELECT totalmint FROM taikocampaign WHERE address = ?';
            const [rows] = await connection.promise().query(query, [holder]);

            if (rows.length > 0) {
                const totalMint = parseInt(rows[0].totalmint, 10) || 0;

                if (totalCount > totalMint) {
                    const updateQuery = 'UPDATE taikocampaign SET totalmint = ? WHERE address = ?';
                    await connection.promise().query(updateQuery, [totalCount, holder]);
                    console.log(`Updated totalmint for holder ${holder} to ${totalCount}`);
                }
            }
        }
    } catch (error) {
        console.error('Error updating Taiko campaign:', error);
    }
}

updateTopCollectors().then(() => {
    cron.schedule('*/2 * * * *', () => {
        console.log('Running cron job to update top collectors');
        updateTopCollectors();
    });
}).catch(err => {
    console.error('Initial update failed:', err);
});

cron.schedule('*/2 * * * *', () => {
    console.log('Running cron job to update Taiko campaign');
    updateTaikoCampaign();
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
