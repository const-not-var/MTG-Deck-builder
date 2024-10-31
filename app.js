import express, { json } from "express";
import deckRouter from "./routes/DeckRoutes.js";
import cors from "cors";
const app = express();

//middleware
app.use(express.json());
app.use(cors());
app.options("*", cors());
app.use("/api/decks/", deckRouter);
app.listen(3001, () => {
  console.log("Server is running on port 3001");
});

//configure mongoose
import mongoose from "mongoose";

const mongoURI =
  "mongodb://jamesnbunny98:LRxDfsHf7O4mMIu5@ac-n4pmsts-shard-00-00.7vop46y.mongodb.net:27017,ac-n4pmsts-shard-00-01.7vop46y.mongodb.net:27017,ac-n4pmsts-shard-00-02.7vop46y.mongodb.net:27017/?replicaSet=atlas-ktjsym-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";
mongoose
  .connect(mongoURI, {
    dbName: "mtg-deck-builder"
})
  .then(() => console.log("MongoDB connected successfully via Mongoose"))
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });

export default app;
