const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
require("./userDetails")
const axios = require('axios');
const schedule = require('node-schedule');

const mongoose = require("mongoose");
const User = mongoose.model("UserInfo");

mongoose.connect("mongodb+srv://heberman:PeanutButter45@prophet.qqyvn4v.mongodb.net/?retryWrites=true&w=majority",{
    useNewURLParser:true
}).then(() => {console.log("Connected to database");})
.catch(err => console.log(err));
 
app.listen(port, () => {
    console.log("REST API is listening.");
});

const task = async () => {
  try {
    var newUser = null;
    try {
      const user = "randotron"
      const pwd = "Berman#45"
      const response = await axios.post("https://thankful-elk-windbreaker.cyclic.app/auth",
          JSON.stringify({ user, pwd }),
          {
              headers: { 'Content-Type': 'application/json' }
          }
      );
      newUser = response.data['foundUser'];
    } catch (err) {
        console.log(err.message);
    }
    newUser.cash -= 10.0;
    const response = await axios.put('https://thankful-elk-windbreaker.cyclic.app/user/randotron', newUser);
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
};

schedule.scheduleJob('* * * * *', task);

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
