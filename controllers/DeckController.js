import * as DeckService from "../services/DeckService.js";

export const getAllDecks = async (req, res) => {
  try {
    const decks = await DeckService.default.getAllDecks();
    res.json({ data: decks, status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createDeck = async (req, res) => {
  try {
    const deck = await DeckService.default.createDeck(req.body);
    res.json({ data: deck, status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDeckById = async (req, res) => {
  const { id } = req.params;
  try {
    const deck = await DeckService.default.getDeckById(id);
    res.json({ data: deck, status: "success" });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const updateDeck = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  try {
    const updatedDeck = await DeckService.default.updateDeck(id, body);
    res.json({ data: updatedDeck, status: "success" });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const deleteDeck = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedDeck = await DeckService.default.deleteDeck(id);
    res.json({ data: deletedDeck, status: "success" });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};
