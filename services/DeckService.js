import DeckModel from "../models/Deck.js";

const getAllDecks = async () => {
  return await DeckModel.find();
};

const createDeck = async (deck) => {
  return await DeckModel.create(deck);
};

const getDeckById = async (id) => {
  return await DeckModel.findById(id);
};

const updateDeck = async (id, deck) => {
  return await DeckModel.findByIdAndUpdate(id, deck);
};

const deleteDeck = async (id) => {
  return await DeckModel.findByIdAndDelete(id);
};

export default {
  getAllDecks,
  createDeck,
  getDeckById,
  updateDeck,
  deleteDeck
};
