import { Router } from "express";
import {
  getAllDecks,
  createDeck,
  getDeckById,
  updateDeck,
  deleteDeck,
} from "../controllers/DeckController.js";

const router = Router();
router.post("/decks", (req, res) => {
  const data = req.body;
  console.log(data);
  res.json({msg: "Deck created successfully"});
});

router.route("/").get(getAllDecks).post(createDeck);
router.route("/:id").get(getDeckById).put(updateDeck).delete(deleteDeck);

export default router;
