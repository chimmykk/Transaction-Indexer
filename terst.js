const express = require('express');
const app = express();
const port = 3000;

const data = [
  {
    "rank": 1,
    "wallet": "0x54AFc632a75cc2A0939875F788c9757ee67c7f61",
    "username": null,
    "rankScore": 1,
    "nfts": "2"
  },
  {
    "rank": 2,
    "wallet": "0x4e79442b5667c8dfC097c698da93e905A3A0d83E",
    "username": null,
    "rankScore": 2,
    "nfts": "2"
  },
  {
    "rank": 3,
    "wallet": "0x5e79542b5767c8dfC097c898da93d805B3A0d92C",
    "username": null,
    "rankScore": 3,
    "nfts": "2"
  }
];

app.get('/sample', (req, res) => {
  res.json(data);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
