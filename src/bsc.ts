import axios from 'axios';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

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

        const response = await axios.get(`https://deep-index.moralis.io/api/v2.2/wallets/${address}/history?chain=bsc&order=DESC&limit=50&from_date=1735689600`, {
            headers: {
                accept: "application/json",
                'X-API-Key': process.env.MORALIS_KEY
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
            currentTokenSwap.erc20_transfers[0].direction === "send" ? swapDirection = "sell" : swapDirection = "buy";  //did user buy or sell? foolproof?
            let tokenName = currentTokenSwap.erc20_transfers[0].token_name;

            //to get the value of bnb that he sold for and add/subtract it to his object
            let nativeTransfer = currentTokenSwap.native_transfers
            console.log(nativeTransfer);            
              
            //console.log("nt: ", nativeTransfer[0].direction);
            console.log("direction: " + swapDirection);
            


            /* BUY CASE - usually, when user BUYS a token, the native_transfer usually has 2 child object, one for bnb sent (actual amount bought), the 
            the other for bnb received (appears to be some sort of fee refund). but we only care about the bnb sent object. But it seems like in
            some cases there is only bnb a single native_transfer child object which is bnb sent. so to be safe, we will chck for length of
            native_transfer to handle both cases.
            
            SELL CASE - usually when user SELLS a token, the native_transfer usually has only 1 child object, which is bnb received (actual amount sold for).
            ??case where there is 2 child objets?? need to research more on this.

            */
            if(nativeTransfer[0].token_symbol === "BNB") {
                const bnbPrice = await this.getPriceOfBNB(blockNumber); //gets the price of BNB at that time of swap using the block number.

                //to get the value of usd that the person swapped to or swapped for.
                // let valueSwapped = nativeTransfer[0].value_formatted; //in BNB
                // console.log("value swapped: ", valueSwapped);
                
                let valueInUSD; 

                //now we can add this value to the token object for pnl calculation.
                if(swapDirection === "buy"){

                    if(nativeTransfer.length > 1) { //if length > 1, there is fee refund therefore we use second object to get actual bnb sent.

                        let valueSwapped = nativeTransfer[1].value_formatted; //value in BNB
                        valueInUSD = valueSwapped * await bnbPrice;   // usd value of swap at time of swap.

                    } else {
                        
                        let valueSwapped = nativeTransfer[0].value_formatted;
                        valueInUSD = valueSwapped * await bnbPrice;   // usd value of swap at time of swap.

                    }

                    this.addTokenBuy(tokenName, valueInUSD);
                    //console.log("tokenInBuy", this.tokens);

                }else{

                    //usually only one native transfer object when selling.
                    let valueSwapped = nativeTransfer[0].value_formatted; //in BNB
                    valueInUSD = valueSwapped * await bnbPrice;   // usd value of swap at time of swap.

                    this.addTokenSell(tokenName, valueInUSD);
                    //console.log("tokenInSell", this.tokens);

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
                'X-API-Key': process.env.MORALIS_KEY
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

    analyzeUserDetails() {
        //highest pnl
        const bestTrade = this.tokens.reduce((max, token) => (token.details.PNL > max.details.PNL) ? token : max); 

        //lowest pnl
        const worstTrade = this.tokens.reduce((min, token) => (token.details.PNL < min.details.PNL) ? token : min);

        //total pnl
        let TOTAL_PNL = 0;
        for (const token of this.tokens) {
            TOTAL_PNL += token.details.PNL;
        }

        this.userDetails.push({
            BEST_TRADE: bestTrade,
            WORST_TRADE: worstTrade,
            WIN_RATE: 0,
            MOST_TRADED_TOKEN: "",
            TOTAL_GAS: 0,
            TOTAL_PNL,
        })
    }

// data = {
//         tokens:  [
//     {
//         tokenName: 'Spirit Realm AI',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 172.15812423805943,
//         buyValue: 95.15670233570378,
//         sellValue: 77.00142190235563,
//         PNL: -18.155280433348153
//         }
//     },
//     {
//         tokenName: 'JUDICA',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 65.1135066792722,
//         buyValue: 54.282827180533104,
//         sellValue: 10.8306794987391,
//         PNL: -43.452147681794
//         }
//     },
//     {
//         tokenName: 'Unibase402',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 111.98013606895839,
//         buyValue: 98.49474796129807,
//         sellValue: 13.48538810766032,
//         PNL: -85.00935985363776
//         }
//     },
//     {
//         tokenName: 'Bitcoin Vs Gold',
//         details: {
//         totalSwaps: 1,
//         totalVolume: 125.54411935197498,
//         buyValue: 0,
//         sellValue: 125.54411935197498,
//         PNL: 125.54411935197498
//         }
//     },
//     {
//         tokenName: 'PUNG',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 22.805584218390933,
//         buyValue: 17.36635419309795,
//         sellValue: 5.439230025292982,
//         PNL: -11.927124167804969
//         }
//     },
//     {
//         tokenName: 'X101',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 103.64263159674746,
//         buyValue: 94.7482978930321,
//         sellValue: 8.894333703715361,
//         PNL: -85.85396418931674
//         }
//     },
//     {
//         tokenName: 'Crypto 2.0',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 101.12402630987826,
//         buyValue: 96.57073437807112,
//         sellValue: 4.553291931807141,
//         PNL: -92.01744244626398
//         }
//     },
//     {
//         tokenName: 'Capital Of Crypto',
//         details: {
//         totalSwaps: 1,
//         totalVolume: 9.25758004035568,
//         buyValue: 0,
//         sellValue: 9.25758004035568,
//         PNL: 9.25758004035568
//         }
//     },
//     {
//         tokenName: 'BONERBOTS',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 230.19445082117699,
//         buyValue: 96.53827534229946,
//         sellValue: 133.65617547887754,
//         PNL: 37.117900136578086
//         }
//     },
//     {
//         tokenName: 'giga cz',
//         details: {
//         totalSwaps: 2,
//         totalVolume: 105.28432701862523,
//         buyValue: 94.96798590602191,
//         sellValue: 10.31634111260332,
//         PNL: -84.65164479341858
//         }
//     }
//     ]
//     user details:  [
//     {
//         BEST_TRADE: { tokenName: 'Bitcoin Vs Gold', details: [Object] },
//         WORST_TRADE: { tokenName: 'Crypto 2.0', details: [Object] },
//         WIN_RATE: 0,
//         MOST_TRADED_TOKEN: '',
//         TOTAL_GAS: 0,
//         TOTAL_PNL: -249.14736403667547
//     }
//     ]
// }

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
    const result2 = analyzer.analyzeUserDetails();

    let tokens = analyzer.getTokens();
    let userDetails = analyzer.getUserDetails()
    console.log("tokens: ",  tokens);
    console.log("user details: ", userDetails);
    
    
}

//initialfn();

app.get("/fetch", async (req, res) => {
    const analyzer = new WalletAnalyer();
    //const address = "0xf52cbff41f95886711f7343fc43928d2416eccc9";
    const address = req.query.address;

    const result = await analyzer.fetchBscData(address);
    //const userDetails = analyzer.analyzeUserDetails();
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