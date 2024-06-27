// const { MongoClient } = require("mongodb");

// // Replace the following with your Atlas connection string
// const uri =
//   "mongodb+srv://jamesnbunny98:LRxDfsHf7O4mMIu5@cluster0.7vop46y.mongodb.net/";
// const client = new MongoClient(uri);

// async function run() {
//   try {
//     // Connect to the Atlas cluster
//     await client.connect();
//     // Get the database and collection on which to run the operation
//     const db = client.db("mtg-deck-builder");
//     const col = db.collection("users");
//     // Create new documents
//     const userDocuments = [
//       {
//         name: { first: "Alan", last: "Turing" },
//         birth: new Date(1912, 5, 23), // May 23, 1912
//         death: new Date(1954, 5, 7), // May 7, 1954
//         contribs: ["Turing machine", "Turing test", "Turingery"],
//         views: 1250000,
//       },
//       {
//         name: { first: "Grace", last: "Hopper" },
//         birth: new Date(1906, 12, 9), // Dec 9, 1906
//         death: new Date(1992, 1, 1), // Jan 1, 1992
//         contribs: ["Mark I", "UNIVAC", "COBOL"],
//         views: 3860000,
//       },
//     ];
//     // Insert the documents into the specified collection
//     const p = await col.insertMany(userDocuments);
//     // Find the document
//     const filter = { "name.last": "Turing" };
//     const document = await col.findOne(filter);
//     // Print results
//     console.log("Document found:\n" + JSON.stringify(document));
//   } catch (err) {
//     console.log(err.stack);
//   } finally {
//     await client.close();
//   }
// }
// run().catch(console.dir);
