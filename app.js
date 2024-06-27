const express = require("express");
const app = express();
const mongoose = require("mongoose");

//middleware
app.use(express.json());

app.listen(5000, () => {
  console.log("Server is running on port 3001");
});


//configure mongoose
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost/CRUD",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Connected to MongoDB");
    }
  }
);



module.exports = app;
