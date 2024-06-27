const deckService = require("../services/DeckService");
 
exports.getAllDecks = async (req, res) => {
  try {
    const decks = await deckService.getAllDecks();
    res.json({ data: decks, status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.createDeck = async (req, res) => {
  try {
    const decks = await deckService.createDeck(req.body);
    res.json({ data: decks, status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.getDeckById = async (req, res) => {
  try {
    const decks = await deckService.getDeckById(req.params.id);
    res.json({ data: decks, status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.updateDeck = async (req, res) => {
  try {
    const decks = await deckService.updateDeck(req.params.id, req.body);
    res.json({ data: decks, status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.deleteDeck = async (req, res) => {
  try {
    const decks = await deckService.deleteDeck(req.params.id);
    res.json({ data: decks, status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
