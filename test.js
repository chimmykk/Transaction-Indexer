const express = require('express');
const Queue = require('bee-queue');
const cors = require('cors');

const app = express();
const PORT = 3030;

// CORS setup
app.use(cors({
    origin: 'http://127.0.0.1:8000',
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// Create a queue for polling transactions
const pollingQueue = new Queue('pollingQueue');

// Job Processor
pollingQueue.process(async (job) => {
    const { txHash, wallet, collection } = job.data;
    await pollTransactionStatus(txHash, wallet, collection);
});

// Function to check the transaction status
const checkTransactionStatus = async (txHash) => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`http://localhost:5050/checktxnhekla/${encodeURIComponent(txHash)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch transaction status');
    }

    return response.json();
};

// Function to poll transaction status
const pollTransactionStatus = async (txHash, wallet, collection, interval = 5000, maxAttempts = 20) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const result = await checkTransactionStatus(txHash);
        console.log('Transaction status:', result.message);

        if (result.message === 'success') {
            try {
                const fetch = (await import('node-fetch')).default;
                const playerDetailsResponse = await fetch('http://localhost:5050/api/playerdetails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        address: wallet.account,
                        house: collection.address,
                        housetype: collection.type,
                        housename: collection.name,
                        latestactivity: txHash,
                    }),
                });

                if (!playerDetailsResponse.ok) {
                    throw new Error('Failed to save player details');
                }

                const playerDetailsData = await playerDetailsResponse.json();
                console.log('Player details processed successfully:', playerDetailsData.message);
            } catch (error) {
                console.error('Error:', error);
            }
            return;
        }

        await new Promise(resolve => setTimeout(resolve, interval));
    }

    console.log('Transaction confirmation timed out or failed');
};

// Endpoint to start polling
app.post('/startPolling', async (req, res) => {
    const { txHash, wallet, collection } = req.body;
    if (!txHash || !wallet || !collection) {
        return res.status(400).json({ error: 'Transaction hash, wallet, and collection data are required' });
    }

    // Add job to the queue
    pollingQueue.createJob({ txHash, wallet, collection }).save();

    res.status(200).json({ message: 'Polling started' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
