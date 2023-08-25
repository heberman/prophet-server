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

    var macdArr = [];
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
        for (let x = i + 4; x > i - 1; x--) {
            macdArr.push(newData[times[x]]['MACD']);
        }
    } catch (err) {
        error = err.message;
        macdArr = null;
        console.log(err);
    }
    return { macdArr, error }; 
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
    for (const ticker of Object.keys(portfolio)) {
        const shares = portfolio[ticker];
        const { currPrice, error } = await getTickerPrice(ticker);
        if (error != null)
            throw Error(error);
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
            user.valueData = [entry, ...user.valueData];
            const foundUser = await updateUser(user.user, user);
            if (!foundUser) return { status: "User not found" };
        }
        return { status: "success" };
    } catch (err) {
        console.log(err);
        return { status: err.message };
    }
}

async function getTickers() {
    const data = await fs.readFile('./tickers.txt', 'utf8');
    return data.trim().split('\n');
}

function makeTrade(user, trade) {
    user.trades = [trade, ...user.trades];
    
    if (user.portfolio[trade.ticker]) {
        user.portfolio[trade.ticker] += trade.numShares;
        if (user.portfolio[trade.ticker] <= 0) {
            delete user.portfolio[trade.ticker];
        }
    } else {
        user.portfolio[trade.ticker] = trade.numShares;
    }

    user.cash -= trade.numShares * trade.price;
}

async function findRandomStock(tickers, portfolio) {
    let i = 0;
    let randomTicker;
    let randomTickerPrice;
    let tickerTradable = false;

    while (!tickerTradable && i < 10) {
        randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
        if (!portfolio[randomTicker]) {
            console.log("Trying " + randomTicker + "...");
            const { currPrice, tradable } = await getTickerPrice(randomTicker);
            if (currPrice != null) {
                randomTickerPrice = currPrice;
                tickerTradable = tradable;
            }
        }
    }

    if (i >= 10)
        throw Error("Unable to find random stock");

    return { randomTicker, randomTickerPrice };
}

async function buyRandomStock(user) {
    const tickers = await getTickers();

    const { randomTicker, randomTickerPrice } = await findRandomStock(tickers, user.portfolio);

    console.log("Making trade with " + randomTicker);
    const buyShares = Math.floor((user.cash / 5) / randomTickerPrice);
    const trade = { ticker: randomTicker, numShares: buyShares, date: Date(), price: randomTickerPrice };
    console.log(trade);
    makeTrade(user, trade);
}

async function sellRandomStockCheck(user, sellAll) {
    let rand = 0.0;
    for (const ticker of Object.keys(user.portfolio)) {
        if (!sellAll)
            rand = Math.random();
        console.log("Random number: " + rand);
        if (rand < 0.15) {
            const { currPrice } = await getTickerPrice(ticker);
            const sharesToSell = user.portfolio[ticker] * -1;
            const trade = { ticker, numShares: sharesToSell, date: Date(), price: currPrice };
            console.log("Selling shares of " + ticker);
            console.log(trade);
            makeTrade(user, trade);
        }
    }
}

async function tickerPriceExceededLimit(ticker, trades) {
    // get price when stock was bought
    let buyPrice = null;
    for (const trade in trades) {
        if (trade.ticker === ticker) {
            buyPrice = trade.price;
            break;
        }
    }
    if (!buyPrice)
        throw Error("Ticker not found in trade history: " + ticker);

    // sell stock if limit surpassed
    const upperLimitPrice = buyPrice * 1.03;
    const lowerLimitPrice = buyPrice * 0.97;

    const { currPrice } = await getTickerPrice(ticker);
    if (!currPrice)
        throw Error("Error fetching price for: " + ticker);

    const limitOrderSell = currPrice > upperLimitPrice || currPrice < lowerLimitPrice

    return { limitOrderSell, buyPrice, currPrice };
}

function macdZeroLineRemainedCrossed(macdArr, fromBelow) {
    for (const macd in macdArr) {
        if (macd * fromBelow > 0)
            return false;
    }
    return true;
}

async function macdZeroLineCrossed(ticker, fromBelow) {
    const { macdArr } = await getTickerMacd(ticker);
    if (!macdArr)
        throw Error("Error fetching MACD for: " + ticker);

    console.log(macdArr);

    let i = 0;
    while (i < macdArr.length - 1) {
        if (macdArr[i] * fromBelow < 0 && macdArr[i + 1] * fromBelow > 0) {
            if (i >= macdArr.length - 2 || macdZeroLineRemainedCrossed(macdArr.slice(i + 2), fromBelow)) {
                return true;
            }
        }
        i++;
    }

    return false;
}

async function algoTrade(user) {
    // check current holdings for sell opportunities: limits then macd
    for (const ownedTicker of Object.keys(user.portfolio)) {
        // first check ticker price when bought and current to determine if a upper or lower limit was exceeded
        const { limitOrderSell, buyPrice, currPrice } = await tickerPriceExceededLimit(ownedTicker, user.trades);

        let macdSell = false;
        if (!limitOrderSell) {
            // price did not surpass either limit, checking if macd crossed zero line from above
            macdSell = await macdZeroLineCrossed(ownedTicker, -1);
        }

        if (limitOrderSell || macdSell) {
            // sell stock
            if (limitOrderSell)
                console.log("Selling shares on limit order: " + ownedTicker);
            if (macdSell)
                console.log("Selling shares due to MACD zero line cross from above: " + ownedTicker);
            console.log("Buy price: " + buyPrice);
            console.log("Sell price: " + currPrice);
            
            const trade = { ticker: ownedTicker, numShares: user.portfolio[ownedTicker] * -1, date: Date(), price: currPrice };
            console.log(trade);
            makeTrade(user, trade);
        }
    }
    // check max 10 random stocks and buy if macd crossed zero line from above in last 5 min
    // cant buy stock already owned
    const tickers = await getTickers();

    let i = 0;
    while (i < 10) {
        const { randomTicker, randomTickerPrice } = await findRandomStock(tickers, user.portfolio);

        // check if MACD zero line of randomTicker was crossed from below
        console.log("Checking MACD of " + randomTicker);
        const macdBuy = await macdZeroLineCrossed(randomTicker, 1);
        if (macdBuy) {
            console.log("Making trade with " + randomTicker);
            const buyShares = Math.floor((user.cash / 5) / randomTickerPrice);
            const trade = { ticker: randomTicker, numShares: buyShares, date: Date(), price: randomTickerPrice };
            console.log(trade);
            makeTrade(user, trade);
            return;
        }
        i++;
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
            portfolio: {},
            trades: [],
            valueData: []
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
        const updatedUser = await updateUser(uname, userData);
        if (!updatedUser)
            return res.sendStatus(404);
        return res.send({ status: "success", newUser: updatedUser });
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/algotrade', async (req, res) => {
    console.log("prophetron: running algorithm...");
    try {
        const foundUser = await getUser("prophetron");
        if (!foundUser)
            return res.sendStatus(404);
        await algoTrade(foundUser);
        const updatedUser = await updateUser("prophetron", foundUser);
        if (!updatedUser) 
            return res.sendStatus(404);
        console.log("prophetron: success.");
        return res.send({ status: "success", newUser: updatedUser })
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/randombuy', async (req, res) => {
    console.log("randotron: buying random stock...");
    try {
        const foundUser = await getUser("randotron");
        if (!foundUser)
            return res.sendStatus(404);
        await buyRandomStock(foundUser);
        const updatedUser = await updateUser("randotron", foundUser);
        if (!updatedUser) 
            return res.sendStatus(404);
        console.log("randotron: success.");
        return res.send({ status: "success", newUser: updatedUser })
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/randomsell', async (req, res) => {
    console.log("randotron: possibly selling random stock...");
    try {
        const foundUser = await getUser("randotron");
        if (!foundUser)
            return res.sendStatus(404);
        await sellRandomStockCheck(foundUser, false);
        const updatedUser = await updateUser("randotron", foundUser);
        if (!updatedUser) return res.sendStatus(401); //Unauthorized
        console.log("randotron: success.");
        return res.send({ status: "success" })
    } catch (err) {
        return res.send({ status: err.message });
    }
});

app.post('/sellall', async (req, res) => {
    const { username } = req.body;
    console.log(username + ": selling rest of stocks...");
    try {
        const foundUser = await getUser(username);
        if (!foundUser)
            return res.sendStatus(404);
        await sellRandomStockCheck(foundUser, true);
        const updatedUser = await updateUser(username, foundUser);
        if (!updatedUser) return res.sendStatus(401); //Unauthorized
        console.log(username + ": success.");
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
