import { Schema, model, models } from "mongoose"

const gameCardSchema = new Schema({
  instanceId:   { type: String, required: true },
  scryfallId:   String,
  name:         String,
  imageUri:     String,
  imageUriBack: String,
  typeLine:     String,
  oracleText:   String,
  manaCost:     String,
  cmc:          Number,
  colorIdentity:[String],
  tapped:       { type: Boolean, default: false },
  counters:     { type: Map, of: Number, default: {} },
  isCopy:       Boolean,
  loyalty:      String,
}, { _id: false })

const playerSchema = new Schema({
  userId:           { type: String, required: true },
  userName:         String,
  seatIndex:        Number,
  deckId:           String,
  life:             { type: Number, default: 40 },
  commanderDamage:  { type: Map, of: Number, default: {} },
  hand:             { type: [gameCardSchema], default: [] },
  library:          { type: [gameCardSchema], default: [] },
  libraryCount:     { type: Number, default: 0 },
  battlefield:      { type: [gameCardSchema], default: [] },
  graveyard:        { type: [gameCardSchema], default: [] },
  exile:            { type: [gameCardSchema], default: [] },
  commandZone:      { type: [gameCardSchema], default: [] },
  cmdCastCount:     { type: Map, of: Number, default: {} },
  joined:           { type: Boolean, default: false },
}, { _id: false })

const chatSchema = new Schema({
  seatIndex: Number,
  userName:  String,
  text:      String,
  ts:        Number,
}, { _id: false })

const gameSchema = new Schema({
  code:       { type: String, required: true, unique: true, index: true },
  status:     { type: String, enum: ["lobby", "active", "ended"], default: "lobby" },
  hostUserId: { type: String, required: true },
  maxPlayers: { type: Number, default: 4 },
  players:    { type: [playerSchema], default: [] },
  chat:       { type: [chatSchema], default: [] },
  turn: {
    currentSeat: { type: Number, default: 0 },
    phase:       { type: String, default: "main1" },
    number:      { type: Number, default: 1 },
  },
}, { timestamps: true })

// Games expire after 24 hours of inactivity
gameSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 })

export default models.Game ?? model("Game", gameSchema)
