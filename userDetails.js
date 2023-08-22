const mongoose = require("mongoose");

const UserDetailsSchema = new mongoose.Schema(
    {
        user: String,
        pwd: String,
        cash: Number,
        portfolio: {},
        trades: [{ ticker: String, numShares: Number, date: Date, price: Number }],
        valueData: [{date: Date, totalValue: Number }]
    },
    {
        collection: "UserInfo",
    }
);

mongoose.model("UserInfo", UserDetailsSchema);