import axios from 'axios';
import express from 'express';

const app = express();
app.use(express.json());

app.get("/fetch", (req, res) => {
    fetchBscData().then(data => {
        res.send(data);
    })
});

async function fetchBscData() {
    // const response = await axios.post("https://bsc-mainnet.infura.io/v3/1cff51e67b3d4d288394599b0dcf8727", {
    //     jsonrpc: "2.0",
    //     method: "eth_blockNumber",
    //     params: [],
    //     id: 1
    // })
    
    // console.log("Data: ", response.data);

    const response = await axios.get("https://deep-index.moralis.io/api/v2.2/wallets/0xf52cbff41f95886711f7343fc43928d2416eccc9/history?chain=bsc&order=DESC&limit=5", {
        headers: {
            accept: "application/json",
            'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijc2YTlkOTYyLWI2OWMtNGJlOC04NDA2LTRhZTVjYjFjOWEwZiIsIm9yZ0lkIjoiNDg1MTczIiwidXNlcklkIjoiNDk5MTUyIiwidHlwZUlkIjoiODJhNDRkNDUtNGVjMS00YWRmLWI1ZDYtZjA2MTg4NzgwMzI0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjUyMzAzMzgsImV4cCI6NDkyMDk5MDMzOH0.iSuwnIY4qiQuobZwWAZVJVjNwbyZNxpiVleIrdvhLng'
        },
    })

    let data = response.data;
    console.log("Data: ", data);

    return data;
    
}

fetchBscData();