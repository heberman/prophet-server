const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
require("./userDetails");
const fs = require("fs");
const { parse } = require("csv-parse");

const mongoose = require("mongoose");
const User = mongoose.model("UserInfo");
var ticker_arr = [];

mongoose.connect("mongodb+srv://heberman:PeanutButter45@prophet.qqyvn4v.mongodb.net/?retryWrites=true&w=majority",{
    useNewURLParser:true
}).then(() => {console.log("Connected to database");})
.catch(err => console.log(err));
 
app.listen(port, () => {
    console.log("REST API is listening.");
});

fs.createReadStream("./listing_status.csv")
  .pipe(parse({ delimiter: ",", from_line: 2 }))
  .on("data", function (row) {
    ticker_arr = [...ticker_arr, row[0]]
  })
  .on("end", function () {
    console.log("Finished parsing tickers.");
  })
  .on("error", function (error) {
    console.log(error.message);
  });

function getDaysAgo(days) {
    const daysAgo = new Date(Math.round((new Date().getTime() - (days * 24 * 60 * 60 * 1000) - 30000) / 60000) * 60000);
    return daysAgo;
}

async function getTickerPrice(ticker) {
    const API_KEY = 'MG0ID5XPDBCTO9FF';
    const api_call = 'https://www.alphavantage.co/query?' 
                    + 'function=TIME_SERIES_INTRADAY'
                    + '&symbol=' + ticker
                    + '&interval=1min'
                    + '&outputsize=full'
                    + '&apikey=' + API_KEY;

    var currDay = null;
    var currPrice = null;
    var tradable = null;
    var error = null;

    const res = await fetch(api_call);
    if (!res.ok) {
        throw Error('could not fetch the data for that resource');
    }
    const data = await res.json();
    if (data['Error Message'])
        throw Error("Ticker '" + ticker + "' does not exist.");
    const newData = data['Time Series (1min)'];
    const yesterdayMS = getDaysAgo(1);
    const times = Object.keys(newData);
    
    let i = 0;
    while (yesterdayMS - new Date(times[i]).getTime() < 0) {
        i++;
        if (i >= times.length) {
            throw Error("Loop went wrong.");
        }
    }
    currDay = times[i];
    currPrice = newData[times[i]]['4. close'];
    tradable = (yesterdayMS - (10 * 60 * 1000)) - new Date(times[i]).getTime() <= 0;
    return { currPrice, currDay, tradable, error };    
}

// function getTickerData(ticker, func, interval, outputsize, data_key) {
//     const API_KEY = 'MG0ID5XPDBCTO9FF';
//     const api_call = 'https://www.alphavantage.co/query?' 
//                     + 'function=' + func
//                     + '&symbol=' + ticker
//                     + (interval ? '&interval=' + interval : '')
//                     + '&outputsize=' + outputsize
//                     + '&apikey=' + API_KEY;
//     var newData = null;
//     var error = null;

//     fetch(api_call)
//         .then(res => {
//             if (!res.ok) {
//                 throw Error('could not fetch the data for that resource');
//             }
//             return res.json();
//         })
//         .then(data => {
//             if (data['Error Message'])
//                 throw Error("Ticker '" + ticker + "' does not exist.");
//             newData = data[data_key];
//         })
//         .catch(err => {
//             error = err.message;
//             console.log(err);
//         });

//     return { newData, error }
// }

app.post('/trade', async (req, res) => {
    console.log("Making random trade...");
    const numShares = 1;
    try {
        //const trade_ticker = ticker_arr[Math.floor(Math.random() * ticker_arr.length)];
        const trade_ticker = "F";
        console.log(trade_ticker);
        const { currPrice, tradable, error } = await getTickerPrice(trade_ticker);

        if (error)
            throw Error(error);

        console.log(currPrice, tradable, error);
        if (tradable) {
            let randoUser = await User.findOne({ user: "randotron" }).exec();
            const trade = { trade: trade_ticker, numShares, date: Date(), price: currPrice }
            console.log(trade);
            randoUser.trades = [trade, ...randoUser.trades];
            if (randoUser.portfolio[trade_ticker]) {
                randoUser.portfolio[trade_ticker] += 1;
                if (randoUser.portfolio[trade_ticker] <= 0) {
                    delete randoUser.portfolio[trade_ticker];
                }
            } else {
                randoUser.portfolio[ticker] = numShares;
            }
            randoUser.cash -= num_shares * currPrice;

            const newUser = await User.findOneAndUpdate({ user: "randotron" }, randoUser).exec();
            return res.send({ response, newUser });
        }
        console.log("Ticker currently untradable.");
        return res.send({ status: "Ticker currently untradable."});
    } catch (error) {
        console.error(error);
        return res.send({ status: error.message });
    }
});

app.post('/register', async (req, res) => {
    const { user, pwd } = req.body;

    try {
        const oldUsername = await User.findOne({ user });

        if (oldUsername) {
            return res.send({ error: "User exists with that username" });
        }

        const newUser = await User.create({
            user,
            pwd,
            cash: 1000.00,
            portfolio: new Map(),
            trades: []
        });
        return res.json({ newUser });
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/auth', async (req, res) => {
    const { user, pwd } = req.body;
    if (!user || !pwd) return res.status(400).json({ 'message': 'Username and password are required.' });

    const foundUser = await User.findOne({ user }).exec();
    if (!foundUser) return res.sendStatus(401); //Unauthorized 

    if (pwd != foundUser.pwd) return res.sendStatus(401);

    return res.json({ foundUser });
});

app.get('/user/:uname', async (req, res) => {
    const uname = req.params['uname'];
    try {
        const foundUser = await User.findOne({ user: uname }).exec();
        if (!foundUser) return res.sendStatus(401); //Unauthorized
        return res.json(foundUser);
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.put('/user/:uname', async (req, res) => {
    const uname = req.params['uname'];
    try {
        const newUser = req.body;
        const foundUser = await User.findOneAndUpdate({ user: uname }, newUser).exec();
        if (!foundUser) return res.sendStatus(401); //Unauthorized
        return res.send({ status: "success" })
    } catch (err) {
        return res.send({ status: err.message });
    }
});
