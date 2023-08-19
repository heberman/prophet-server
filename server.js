require("dotenv").config();
require("./userDetails");

const express = require("express");
const cors = require("cors");
const fs = require('fs').promises;
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

function getDaysAgo(days) {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60 * 1000; // Convert timezone offset to milliseconds
    const easternTimezoneOffset = -4 * 60 * 60 * 1000; // Eastern Timezone is UTC-4
    
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

async function getTickerMacd(ticker) {
    const API_KEY = 'MG0ID5XPDBCTO9FF';
    const api_call = 'https://www.alphavantage.co/query?' 
                    + 'function=MACD'
                    + '&symbol=' + ticker
                    + '&interval=1min'
                    + '&series_type=open'
                    + '&apikey=' + API_KEY;

    var prevMacd = null;
    var currMacd = null;
    var error = null;

    try {
        const res = await fetch(api_call);
        if (!res.ok) {
            throw Error('could not fetch the data for that resource');
        }
        const data = await res.json();
        if (data['Error Message'])
            throw Error("Ticker '" + ticker + "' does not exist.");
        const newData = data["Technical Analysis: MACD"];
        const yesterdayMS = getDaysAgo(1);
        const times = Object.keys(newData);
        
        let i = 0;
        while (yesterdayMS - new Date(times[i]).getTime() < 0) {
            i++;
            if (i >= times.length) {
                throw Error("Loop went wrong.");
            }
        }
        prevMacd = newData[times[i+1]]['MACD'];
        currMacd = newData[times[i]]['MACD'];
    } catch (err) {
        error = err.message;
        console.log(err);
    }
    return { prevMacd, currMacd, error }; 
}

async function getTickerSma(ticker) {
    const API_KEY = 'MG0ID5XPDBCTO9FF';
    const five_api_call = 'https://www.alphavantage.co/query?' 
                    + 'function=SMA'
                    + '&symbol=' + ticker
                    + '&interval=1min'
                    + '&time_period=5'
                    + '&series_type=open'
                    + '&apikey=' + API_KEY;
    const thirteen_api_call = 'https://www.alphavantage.co/query?' 
                    + 'function=SMA'
                    + '&symbol=' + ticker
                    + '&interval=1min'
                    + '&time_period=13'
                    + '&series_type=open'
                    + '&apikey=' + API_KEY;

    var fiveBarSma = null;
    var thirteenBarSma = null;
    var error = null;

    try {
        const five_res = await fetch(five_api_call);
        if (!five_res.ok) {
            throw Error('could not fetch the data for that resource');
        }
        const five_data = await five_res.json();
        if (five_data['Error Message'])
            throw Error("Ticker '" + ticker + "' does not exist.");
        const thirteen_res = await fetch(thirteen_api_call);
        if (!thirteen_res.ok) {
            throw Error('could not fetch the data for that resource');
        }
        const thirteen_data = await thirteen_res.json();
        if (thirteen_data['Error Message'])
            throw Error("Ticker '" + ticker + "' does not exist.");
        const five_sma_data = five_data["Technical Analysis: SMA"];
        const thirteen_sma_data = thirteen_data["Technical Analysis: SMA"];
        const yesterdayMS = getDaysAgo(1);
        const times = Object.keys(five_sma_data);
        
        let i = 0;
        while (yesterdayMS - new Date(times[i]).getTime() < 0) {
            i++;
            if (i >= times.length) {
                throw Error("Loop went wrong.");
            }
        }
        fiveBarSma = five_sma_data[times[i]]['SMA'];
        thirteenBarSma = thirteen_sma_data[times[i]]['SMA'];
    } catch (err) {
        error = err.message;
        console.log(err);
    }
    return { fiveBarSma, thirteenBarSma, error }; 
}

async function getUser(username) {
    const foundUser = await User.findOne({ user: username }).exec();
    if (!foundUser)
        return null;
    return foundUser;
}

async function updateUser(username, newUser) {
    try {
        const foundUser = await User.findOneAndUpdate({ user: username }, newUser, { new: true }).exec();
        if (!foundUser)
            return null;
        return foundUser;
    } catch (error) {
        console.error('Error updating user:', error);
        return null;
    }
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
        if (user.trades.length > 0) {
            const { portVal } = await getPortfolioValue(user.portfolio);
            const totalValue = portVal + user.cash;
            const entry = { date: Date(), totalValue }
            let newUser = user;
            newUser.valueData = [entry, ...newUser.valueData];
            const foundUser = await updateUser(user.user, newUser);
            if (!foundUser) return { status: "User not found" };
        }
        return { status: "success" };
    } catch (err) {
        console.log(err);
        return err;
    }
}

function makeTrade(user, trade) {
    const { ticker, numShares, price } = trade;
    user.trades = [trade, ...user.trades];
    
    if (user.portfolio[ticker]) {
        user.portfolio[ticker] += numShares;
        if (user.portfolio[ticker] <= 0) {
            delete user.portfolio[ticker];
        }
    } else {
        user.portfolio[ticker] = numShares;
    }
    
    user.cash -= numShares * price;
}

async function buyRandomStock(user) {
    const data = await fs.readFile('./tickers.txt', 'utf8');
    const tickers = data.trim().split('\n');

    let randomTicker;
    let randomTickerPrice;
    var tickerTradable = false;
    while (!tickerTradable) {
        randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
        const { currPrice, tradable, error } = await getTickerPrice(randomTicker);
        if (currPrice == null)
            continue;
        randomTickerPrice = currPrice;
        tickerTradable = error != null || !tradable;
    }
    const buyShares = Math.floor((user.cash / 8) / randomTickerPrice);
    const trade = { ticker: randomTicker, numShares: buyShares, date: Date(), price: randomTickerPrice };
    makeTrade(user, trade);
}

async function sellRandomStockCheck(user, sellAll) {
    let rand = 0.0;
    for (const ticker of user.portfolio.keys()) {
        if (!sellAll)
            rand = Math.random();
        if (rand < 0.2) {
            const { currPrice } = await getTickerPrice(ticker);
            const shares = user.portfolio.get(ticker);
            const trade = { ticker, numShares: shares, date: Date(), price: currPrice };
            makeTrade(user, trade);
        }
    }
}

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

app.get('/macd/:ticker', async (req, res) => {
    const ticker = req.params['ticker'];
    try {
        const { prevMacd, currMacd, error } = await getTickerMacd(ticker);
        return res.send({ prevMacd, currMacd, error });
    } catch (error) {
        console.error(error);
        return res.send({ status: error.message });
    }
});

app.get('/sma/:ticker', async (req, res) => {
    const ticker = req.params['ticker'];
    try {
        const { fiveBarSma, thirtennBarSma, error } = await getTickerSma(ticker);
        return res.send({ fiveBarSma, thirtennBarSma, error });
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
        const { userData, trade } = req.body;
        makeTrade(userData, trade);
        const foundUser = await updateUser(uname, userData);
        if (!foundUser) return res.sendStatus(401); //Unauthorized
        return res.send({ status: "success", newUser: foundUser });
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/randombuy', async (req, res) => {
    console.log("Randotron: buying random stock...");
    try {
        const foundUser = await getUser("randotron");
        if (!foundUser)
            return res.sendStatus(404);
        await buyRandomStock(foundUser);
        const updatedUser = await updateUser("randotron", foundUser);
        if (!updatedUser) return res.sendStatus(401); //Unauthorized
        console.log("Randotron: success.");
        return res.send({ status: "success", newUser: updatedUser })
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/randomsell', async (req, res) => {
    console.log("Randotron: possibly selling random stock...");
    try {
        const foundUser = await getUser("randotron");
        if (!foundUser)
            return res.sendStatus(404);
        await sellRandomStockCheck(foundUser, false);
        const updatedUser = await updateUser("randotron", foundUser);
        if (!updatedUser) return res.sendStatus(401); //Unauthorized
        console.log("Randotron: success.");
        return res.send({ status: "success" })
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/sellall', async (req, res) => {
    console.log("Randotron: selling rest of stocks...");
    try {
        const foundUser = await getUser("randotron");
        if (!foundUser)
            return res.sendStatus(404);
        await sellRandomStockCheck(foundUser, true);
        const updatedUser = await updateUser("randotron", foundUser);
        if (!updatedUser) return res.sendStatus(401); //Unauthorized
        console.log("Randotron: success.");
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
