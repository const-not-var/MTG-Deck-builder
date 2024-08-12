import { Schema as _Schema, model } from "mongoose";
const Schema = _Schema;

// const deckSchema = new Schema({
//   name: {
//     type: String,
//     require: true,
//   },
//   body: {
//     type: String,
//     require: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// export default Schema;


const deckSchema = new Schema({
  name: {
      type: String,
      require: true
  },
  deck: [
    new Schema({
      cardPlace: Number,
      name: String,
      dateAdded: String
    })
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});
export default model("Deck", deckSchema);