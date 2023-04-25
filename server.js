// TO DOs
// 1. Schedule cron event to save each users current portVal for more detialed stats: DONE
// 2. Make randotron sell stocks: DONE
// 3. Instead of returning portVal from get/user/uname, return portfolio with the current price included in the value to speed up home screen: DONE
// 4. On stock page, include average price of all bought shares: DONE
// 5. Start with 10,000 instead of 1,000: DONE
// 6. Logout button: DONE
// 7. Change key value for stats graph to make the times scale correctly

require("dotenv").config();
require("./userDetails");

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const readline = require('readline');
const mongoose = require("mongoose");
const User = mongoose.model("UserInfo");
const port = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

mongoose.set('strictQuery', false);

const connectDB = async () => {
    try {
      const conn = await mongoose.connect("mongodb+srv://heberman:PeanutButter45@prophet.qqyvn4v.mongodb.net/?retryWrites=true&w=majority");
      console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
}

async function parseTickers() {
    return new Promise((resolve, reject) => {
        var ticker_arr = [];

        const readInterface = readline.createInterface({
            input: fs.createReadStream('tickers.txt'),
            console: false
        });
        
        readInterface.on('line', function(line) {
            ticker_arr.push(line);
        });
        
        readInterface.on('close', function() {
            console.log("Finished parsing tickers.");
            resolve(ticker_arr);
        });
    });
}

function getDaysAgo(days) {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60 * 1000; // Convert timezone offset to milliseconds
    const easternTimezoneOffset = -5 * 60 * 60 * 1000; // Eastern Timezone is UTC-4
    
    const daysAgo = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000) + timezoneOffset + easternTimezoneOffset);
    
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

    try {
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
    } catch (err) {
        error = err.message;
        console.log(err);
    }
    return { currPrice, currDay, tradable, error };    
}

async function getTickerData(ticker, func, interval, outputsize, data_key) {
    const API_KEY = 'MG0ID5XPDBCTO9FF';
    const api_call = 'https://www.alphavantage.co/query?' 
                    + 'function=' + func
                    + '&symbol=' + ticker
                    + (interval ? '&interval=' + interval : '')
                    + '&outputsize=' + outputsize
                    + '&apikey=' + API_KEY;
    var newData = null;
    var error = null;

    try {
        const res = await fetch(api_call);
        if (!res.ok) {
            throw Error('could not fetch the data for that resource');
        }
        const data = await res.json();
        if (data['Error Message'])
            throw Error(ticker + ": " + data['Error Message']);
        newData = data[data_key];
    } catch(err) {
        error = err.message;
        console.log(err);
    };

    return { newData, error }
}

async function getUser(username) {
    const foundUser = await User.findOne({ user: username }).exec();
    if (!foundUser)
        return null;
    return foundUser;
}

async function getPortfolioValue(portfolio) {
    let priceMap = {};
    let portVal = 0;
    for (const ticker of portfolio.keys()) {
        const shares = portfolio.get(ticker);
        const { currPrice } = await getTickerPrice(ticker);
        priceMap[ticker] = currPrice;
        portVal += shares * currPrice;
    }
    return { priceMap, portVal };
}

async function updateUserValueData(user) {
    try {
        const { portVal } = await getPortfolioValue(user.portfolio);
        const totalValue = portVal + user.cash;
        const entry = { date: Date(), totalValue }
        let newUser = user;
        newUser.valueData = [entry, ...newUser.valueData];
        const foundUser = await User.findOneAndUpdate({ user: user.user }, newUser).exec();
        if (!foundUser) return res.sendStatus(401);
        return { status: "success" };
    } catch (err) {
        console.log(err);
        return err;
    }
}

function makeTrade(user, ticker, numShares, price) {
    let newUser = user;
    const trade = { ticker, numShares, date: Date(), price }
    console.log(trade);
    newUser.trades = [trade, ...newUser.trades];
    if (newUser.portfolio.has(ticker)) {
        newUser.portfolio.set(ticker, newUser.portfolio.get(ticker) + numShares);
        if (newUser.portfolio.get(ticker) <= 0) {
            newUser.portfolio.delete(ticker);
        }
    } else {
        newUser.portfolio.set(ticker, numShares);
    }
    newUser.cash -= numShares * price;
    return newUser;
}

app.get('/test', async (req, res) => {
    const yesterday = new Date(getDaysAgo(1));
    yesterday.setHours(12, 30, 0);
    console.log(yesterday.toLocaleString());
    return res.send({status: "success"});
});

app.post('/trade', async (req, res) => {
    const ticker_arr = await parseTickers();

    console.log("Making random trade...");
    try {
        const tradeTicker = ticker_arr[Math.floor(Math.random() * ticker_arr.length)];
        //const trade_ticker = "F";
        console.log(tradeTicker);
        const { currPrice, tradable, error } = await getTickerPrice(tradeTicker);

        if (error)
            throw Error(error);

        if (tradable) {
            const randoUser = await User.findOne({ user: "randotron" }).exec();
            let newUser = randoUser;

            if (newUser.portfolio.size >= 10) {
                const sellTicker = Array.from(newUser.portfolio.keys())[Math.floor(Math.random() * newUser.portfolio.size)];
                const { currPrice: sellPrice, error: sellError } = await getTickerPrice(sellTicker);
                if (sellError)
                    throw Error(sellError);
                const sellShares = newUser.portfolio.get(sellTicker) * -1;
                newUser = makeTrade(newUser, sellTicker, sellShares, sellPrice);
            }

            newUser = makeTrade(newUser, tradeTicker, 1, currPrice);

            const oldUser = await User.findOneAndUpdate({ user: "randotron" }, newUser).exec();
            return res.send({ oldUser, newUser });
        }
        console.log("Ticker currently untradable.");
        return res.send({ status: "Ticker currently untradable."});
    } catch (error) {
        console.error(error);
        return res.send({ status: error.message });
    }

});

app.get('/price/:ticker', async (req, res) => {
    const ticker = req.params['ticker'];
    try {
        const { currPrice, currDay, tradable, error } = await getTickerPrice(ticker);
        return res.send({ currPrice, currDay, tradable, error });
    } catch (error) {
        console.error(error);
        return res.send({ status: error.message });
    }
});

app.post('/data/:ticker', async (req, res) => {
    const ticker = req.params['ticker'];
    const { func, interval, outputsize, data_key } = req.body;
    try {
        const { newData, error } = await getTickerData(ticker, func, interval, outputsize, data_key);
        return res.send({ newData, error });
    } catch (err) {
        console.error(err);
        return res.send({ status: err.message });
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
            cash: 10000.00,
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

app.post('/logvals', async (req, res) => {
    console.log("Logging portfolio values...");
    try {
        console.log("Getting users...");
        const users = await User.find({}).exec();
        if (!users) return res.sendStatus(401);

        console.log("Updating users' value data...");
        const userResults = await Promise.all(
            users.map(async (user) => {
                const result = await updateUserValueData(user);
                return result;
            })
        );

        console.log("Success.");
        return res.send(userResults);
    } catch (err) {
        console.log(err);
        return res.sendStatus(401);
    }
})

app.get('/user/:uname', async (req, res) => {
    const uname = req.params['uname'];
    try {
        const foundUser = await getUser(uname);
        if (!foundUser)
            return res.sendStatus(404);
        const { priceMap, portVal } = await getPortfolioValue(foundUser.portfolio);
        return res.send({ foundUser, priceMap, portVal });
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.put('/user/:uname', async (req, res) => {
    const uname = req.params['uname'];
    try {
        const newUser = req.body;
        console.log(newUser);
        const foundUser = await User.findOneAndUpdate({ user: uname }, newUser).exec();
        if (!foundUser) return res.sendStatus(401); //Unauthorized
        return res.send({ status: "success" })
    } catch (err) {
        return res.send({ status: err.message });
    }
});

connectDB().then(() => {
    app.listen(port, () => {
        console.log("listening for requests");
    })
});
