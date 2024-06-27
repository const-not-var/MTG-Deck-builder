const DeckModel = require("../models/Decks");

exports.getAllDecks = async () => {
  return await DeckModel.find();
};

exports.createDeck = async (deck) => {
  return await DeckModel.create(deck);
};
exports.getDeckById = async (id) => {
  return await DeckModel.findById(id);
};

exports.updateDeck = async (id, deck) => {
  return await DeckModel.findByIdAndUpdate(id, deck);
};

exports.deleteDeck = async (id) => {
  return await DeckModel.findByIdAndDelete(id);
};

