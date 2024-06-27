const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const deckSchema = new Schema({
  title: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Decks", deckSchema);


