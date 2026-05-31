import { Schema, model, models } from "mongoose"

const cardSchema = new Schema({
  scryfallId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  cmc: { type: Number, default: 0 },
  typeLine: { type: String, default: "" },
  colorIdentity: [{ type: String }],
  manaCost: { type: String, default: "" },
  prices: {
    usd: String,
    usdFoil: String,
  },
  imageUri: { type: String, default: "" },
  imageUriBack: { type: String },
  oracleText: { type: String, default: "" },
  isCommander: { type: Boolean, default: false },
  isCompanion: { type: Boolean, default: false },
  salt: { type: Number },
  isFoil: { type: Boolean, default: false },
  hasFoil: { type: Boolean, default: false },
  tcgplayerUrl: { type: String },
  cardKingdomUrl: { type: String },
  loyalty: { type: String },
})

const deckSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    cards: [cardSchema],
  },
  { timestamps: true }
)

export default models.Deck ?? model("Deck", deckSchema)
