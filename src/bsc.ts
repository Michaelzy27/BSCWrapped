import axios from 'axios';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;



// BEST TRADE, WORST TRADE, WIN RATE, MOST TRADED TOKEN, TOTAL GAS, TOTAL PNL.

//BEST TRADE - need to know most profitable trade, by getting bought time, then sold time and knowing pnl. the highest pnl by % is the best trade.
//WORST TRADE - need to know least profitable trade, by getting bought time, then sold time and knowing pnl. the lowest pnl by % is the worst trade.
//WIN RATE - number of profitable trades / total trades
//MOST TRADED TOKEN - token with the highest number of trades
//TOTAL GAS - sum of gas fees for all trades
//TOTAL PNL - sum of profit and loss for all trades

interface Token {
    tokenName: string;
    details: {
        totalSwaps: number;
        totalVolume: number;
        buyValue: number;
        sellValue: number;
        PNL: number; // sellValue - buyValue
    }
}

interface UserDetail {
    BEST_TRADE: any;
    WORST_TRADE: any;
    WIN_RATE: number;
    MOST_TRADED_TOKEN: string;
    TOTAL_GAS: number;
    TOTAL_PNL: number;
}

class WalletAnalyer {
    private tokens: Token[] = [];
    private userDetails: UserDetail[] = [];

    constructor() {}

    async fetchBscData(address: any) {

        const response = await axios.get(`https://deep-index.moralis.io/api/v2.2/wallets/${address}/history?chain=bsc&order=DESC&limit=25&from_date=1735689600`, {
            headers: {
                accept: "application/json",
                'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijc2YTlkOTYyLWI2OWMtNGJlOC04NDA2LTRhZTVjYjFjOWEwZiIsIm9yZ0lkIjoiNDg1MTczIiwidXNlcklkIjoiNDk5MTUyIiwidHlwZUlkIjoiODJhNDRkNDUtNGVjMS00YWRmLWI1ZDYtZjA2MTg4NzgwMzI0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjUyMzAzMzgsImV4cCI6NDkyMDk5MDMzOH0.iSuwnIY4qiQuobZwWAZVJVjNwbyZNxpiVleIrdvhLng'
            },
        })

        const data = response.data;
        // console.log("Data: ", JSON.stringify(data, null, 2));
        // console.log("ERC Transfers: ", data.result[2].erc20_transfers);

        //filters the array for only token swaps made by the wallet and stores result in array.
        const allTokenSwaps =  data.result.filter((tx: any) => tx.category === "token swap");
        //console.log("All token swaps: ", allTokenSwaps);

        const TOTAL_SWAP_COUNT = allTokenSwaps.length;   //the total swaps made by the wallet.        
        
        await this.analyzeTokenSwaps(allTokenSwaps);
        
    }



    async analyzeTokenSwaps(allTokenSwaps: any[]) {

        //console.log(JSON.stringify(allTokenSwaps, null, 2));
        

        for (let i = 0; i < allTokenSwaps.length; i++) {            

            let currentTokenSwap = allTokenSwaps[i]; //a single token swap object child from the array.

            let swapDirection;   // - to denote buy or sell. -buy

            const blockNumber = allTokenSwaps[i].block_number; //the block number of the swap transaction. (past)
            
            //erc20_transfer seems to always be a single child array. so `erc20_transfers[0]` checks for the direction.
            currentTokenSwap.erc20_transfers[0].direction === "send" ? swapDirection = "sell" : swapDirection = "buy";  //did user buy or sell?
            let tokenName = currentTokenSwap.erc20_transfers[0].token_name;

            //to get the value of bnb that he sold for and add/subtract it to his object
            let nativeTransfer = currentTokenSwap.native_transfers
            //console.log(nativeTransfer);            
              
            console.log("nt: ", nativeTransfer[0].direction);
            console.log("direction: " + swapDirection);
            
            
            if(nativeTransfer[0].token_symbol === "BNB" && nativeTransfer[0].direction === "receive") {
                const bnbPrice = await this.getPriceOfBNB(blockNumber); //gets the price of BNB at that time of swap using the block number.

                //to get the value of usd that the person swapped to or swapped for.
                let valueSwapped = nativeTransfer[0].value; //in BNB
                let valueInUSD = valueSwapped * bnbPrice;   // usd value of swap at time of swap.                

                //now we can add this value to the token object for pnl calculation.
                if(swapDirection === "buy"){
                    this.addTokenBuy(tokenName, valueInUSD);
                    console.log("tokenInBuy", this.tokens);
                }else{
                    this.addTokenSell(tokenName, valueInUSD);
                    console.log("tokenInSell", this.tokens);
                }
            } else {
                console.log("There is no swap? or something else");
                
            }

        };        
    }



    async getPriceOfBNB(blockNumber: any) {
        const bnbContractAddress = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; //WBNB contract address on BSC
        const response = await axios.get(`https://deep-index.moralis.io/api/v2.2/erc20/${bnbContractAddress}/price?chain=bsc&to_block=${blockNumber}`, {
            headers: {
                accept: "application/json",
                'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijc2YTlkOTYyLWI2OWMtNGJlOC04NDA2LTRhZTVjYjFjOWEwZiIsIm9yZ0lkIjoiNDg1MTczIiwidXNlcklkIjoiNDk5MTUyIiwidHlwZUlkIjoiODJhNDRkNDUtNGVjMS00YWRmLWI1ZDYtZjA2MTg4NzgwMzI0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjUyMzAzMzgsImV4cCI6NDkyMDk5MDMzOH0.iSuwnIY4qiQuobZwWAZVJVjNwbyZNxpiVleIrdvhLng'
            },
        })

        //console.log("Price of BNB was: ", response.data);
        let bnbPrice = response.data.usdPrice;
        
        return bnbPrice;

    }

    async addTokenBuy(tokenName: any, value: any) {
        
        //check if token exists in tokens array
        //if exists, add to buy value
        //if not, create new token object and add to tokens array

        let token = this.tokens.find(t => t.tokenName === tokenName)       
        if(token) {
            token.details.totalSwaps += 1;
            token.details.totalVolume += value;
            token.details.buyValue += value;
            token.details.PNL -= value;
            //console.log("l1: ", token);
            
        } else {
            this.tokens.push({
                tokenName,
                details: {
                    totalSwaps: 1,
                    totalVolume: value,
                    buyValue: value,
                    sellValue: 0,
                    PNL: 0 - value,
                }
            })
        }
    }

    async addTokenSell(tokenName: any, value: any) {
        //check if token exists in tokens array
        //if exists, add to sell value
        //if not, create new token object and add to tokens array

        let token = this.tokens.find(t => t.tokenName === tokenName)
        if(token) {
            token.details.totalSwaps += 1;
            token.details.totalVolume += value;
            token.details.sellValue += value;
            token.details.PNL += value;
        } else {
            this.tokens.push({
                tokenName,
                details: {
                    totalSwaps: 1,
                    totalVolume: value,
                    buyValue: 0,
                    sellValue: value,
                    PNL: value,
                }
            })
        }
    }

    getTokens() {
        return this.tokens;
    }

    getUserDetails() {
        return this.userDetails;
    }


}

// async function fetchBscData() {

//     const address = "0xf52cbff41f95886711f7343fc43928d2416eccc9"

//     const response = await axios.get(`https://deep-index.moralis.io/api/v2.2/wallets/${address}/history?chain=bsc&order=DESC&limit=25&from_date=1735689600`, {
//         headers: {
//             accept: "application/json",
//             'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijc2YTlkOTYyLWI2OWMtNGJlOC04NDA2LTRhZTVjYjFjOWEwZiIsIm9yZ0lkIjoiNDg1MTczIiwidXNlcklkIjoiNDk5MTUyIiwidHlwZUlkIjoiODJhNDRkNDUtNGVjMS00YWRmLWI1ZDYtZjA2MTg4NzgwMzI0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjUyMzAzMzgsImV4cCI6NDkyMDk5MDMzOH0.iSuwnIY4qiQuobZwWAZVJVjNwbyZNxpiVleIrdvhLng'
//         },
//     })

//     const data = response.data;
//     console.log("Data: ", JSON.stringify(data, null, 2));
//     console.log("ERC Transfers: ", data.result[2].erc20_transfers);

//     //filters the array for only token swaps made by the wallet and stores result in array.
//     const allTokenSwaps =  data.result.filter((tx: any) => tx.category === "token swap");
//     console.log("All token swaps: ", allTokenSwaps);

//     const TOTAL_SWAP_COUNT = allTokenSwaps.length;   //the total swaps made by the wallet.
    
//     analyzeTokenSwaps(allTokenSwaps);

//     return data;
    
// }

// const TokenAnalysis = {
    //tokenName: "PUNG",
    //value
// }

// async function analyzeTokenSwaps(allTokenSwaps: any) {

//     for (let i = 0; i < allTokenSwaps.length; i++) {

//         let currentTokenSwap = allTokenSwaps[0]; //a single token swap object child from the array.

//         let swapDirection;   // - to denote buy or sell.

//         const blockNumber = allTokenSwaps[0].block_number; //the block number of the swap transaction. (past)

//         currentTokenSwap.erc20_transfers.direction === "send" ? swapDirection = "sell" : swapDirection = "buy";  //did user buy or sell?
//         let tokenName = currentTokenSwap.erc20_transfers.token_name;

//         //to get the value of bnb that he sold for and add/subtract it to his object
//         let nativeTransfer = currentTokenSwap.native_transfers  
//         if(nativeTransfer[0].token_symbol === "BNB" && nativeTransfer.direction === "receive") {
//             const bnbPrice = getPriceOfBNB(blockNumber); //gets the price of BNB at that time of swap using the block number.

//             //to get the value of usd that the person swapped to or swapped for.
//             let valueSwapped = nativeTransfer[0].value; //in BNB
//             let valueInUSD = valueSwapped * await bnbPrice;   // usd value of swap at time of swap.

//             //now we can add this value to the token object for pnl calculation.
//             if(swapDirection === "buy"){
//                 addTokenBuy(tokenName, valueInUSD);
//             }else{
//                 addTokenSell(tokenName, valueInUSD);
//             }
//         }

//     };
    

    

    
// }

// async function getPriceOfBNB(blockNumber: any) {
//     const bnbContractAddress = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; //WBNB contract address on BSC
//     const response = await axios.get(`https://deep-index.moralis.io/api/v2.2/erc20/${bnbContractAddress}/price?chain=bsc&to_block=${blockNumber}`, {
//         headers: {
//             accept: "application/json",
//             'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijc2YTlkOTYyLWI2OWMtNGJlOC04NDA2LTRhZTVjYjFjOWEwZiIsIm9yZ0lkIjoiNDg1MTczIiwidXNlcklkIjoiNDk5MTUyIiwidHlwZUlkIjoiODJhNDRkNDUtNGVjMS00YWRmLWI1ZDYtZjA2MTg4NzgwMzI0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjUyMzAzMzgsImV4cCI6NDkyMDk5MDMzOH0.iSuwnIY4qiQuobZwWAZVJVjNwbyZNxpiVleIrdvhLng'
//         },
//     })

//     console.log("Price of BNB was: ", response.data);
//     let bnbPrice = response.data.usdPrice;
    
//     return bnbPrice;

// }

// async function addTokenBuy(tokenName: any, value: any) {
//     //check if token exists in tokens array
//     //if exists, add to buy value
//     //if not, create new token object and add to tokens array

//     let token = tokens.find(t => t.tokenName === tokenName)
//     if(token) {
//         token.details.totalSwaps += 1;
//         token.details.totalVolume += value;
//         token.details.buyValue += value;
//         token.details.PNL -= value;
//     } else {
//         tokens.push({
//             tokenName,
//             details: {
//                 totalSwaps: 1,
//                 totalVolume: value,
//                 buyValue: value,
//                 sellValue: 0,
//                 PNL: 0 - value,
//             }
//         })
//     }
// }

// async function addTokenSell(tokenName: any, value: any) {
//     //check if token exists in tokens array
//     //if exists, add to sell value
//     //if not, create new token object and add to tokens array

//     let token = tokens.find(t => t.tokenName === tokenName)
//     if(token) {
//         token.details.totalSwaps += 1;
//         token.details.totalVolume += value;
//         token.details.sellValue += value;
//         token.details.PNL += value;
//     } else {
//         tokens.push({
//             tokenName,
//             details: {
//                 totalSwaps: 1,
//                 totalVolume: value,
//                 buyValue: 0,
//                 sellValue: value,
//                 PNL: value,
//             }
//         })
//     }
// }

//app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// fetchBscData();
//getPriceOfBNB(71050188);

async function initialfn() {
    const analyzer = new WalletAnalyer();
    const address = "0xf52cbff41f95886711f7343fc43928d2416eccc9";
    

    const result = await analyzer.fetchBscData(address);

    let tokens = analyzer.getTokens();
    let userDetails = analyzer.getUserDetails()
    console.log("tokens: ",  tokens);
    
}

//initialfn();

app.get("/fetch", async (req, res) => {
    const analyzer = new WalletAnalyer();
    //const address = "0xf52cbff41f95886711f7343fc43928d2416eccc9";
    const address = req.query.address;

    const result = await analyzer.fetchBscData(address);
    // res.send({
    //     tokens: analyzer.getTokens(),
    //     userDetails: analyzer.getUserDetails()
    // });
    res.json({
        tokens: analyzer.getTokens(),
        userDetails: analyzer.getUserDetails()
    });
    

    // fetchBscData().then(data => {
    //     res.send(data);
    // })
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));