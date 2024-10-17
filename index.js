// function getDecks() {
//     const xhttp = new XMLHttpRequest();
//     xhttp.onload = function () {
//         const allDbData = JSON.parse(this.response);
//         const length = allDbData.data.length;
//         let arrOfDecks = allDbData.data;
//         // console.log(allDbData);
//         for(let i = 0; i < length; i++) {
//             fetch(
//                 "https://api.magicthegathering.io/v1/cards?" +
//                 new URLSearchParams({
//                     name: arrOfDecks[i].deck[0].name,
//                 }))
//                 .then((response) => {
//                     if (!response.ok) {
//                         throw new Error("Network response is not ok");
//                     }
//                     return response.json();
//                 })
//                 .then((data) => {
//                         deckBodyref = document.getElementById("pagePlacement");

//                             // console.log(arrOfDecks[0].deck[0]._id);

//                         let homeDeckIcon = '<div class="deck-icon deck-load" id="deckIcon">';
//                         homeDeckIcon += '<img src="' + data.cards[0].imageUrl + '" alt="YOUR COMMANDER" class="deck-placement" onclick=openDeckPage("' + arrOfDecks[i]._id + '")></img>';
//                         homeDeckIcon += '<h4 class="card-text deck-info deck-load" id="deckTester">'  + arrOfDecks[i].name + '</h4>';
//                         homeDeckIcon += '<h4 class="card-text deck-info deck-load">' + arrOfDecks[i].deck[0].dateAdded + '</h4>';
//                         homeDeckIcon += '<h4 class="card-text deck-info deck-load">' + arrOfDecks[i]._id + '</h4>';
//                         homeDeckIcon += "</div>";
                
//                         $(deckBodyref).append(homeDeckIcon);
//                 })
//                 .catch((error) => {
//                     console.log(error);
//                 }
//                 );
//         }
// };
//     xhttp.open("GET", "http://localhost:3001/api/decks");
//     xhttp.send();
// }



// //Clicking plus icon to redirect to table page
// // DEck id is optional
// function openDeckPage(deckId) {
//   console.log("I am clicked");
//   if (deckId) {
//     window.location.replace("/mydecks.html?deckId=" + deckId);
//   } else {
//     window.location.replace("/mydecks.html");
//   }

// }

// // getting a deck by it's id and loading the data and adding it to the deck table
// function getDeckById(deckId) {
//     console.log(deckId);
//     fetch("http://localhost:3001/api/decks/" + deckId)
//     .then((response) => {
//         if (!response.ok) {
//             throw new Error("Network response is not ok");
//         }
//         return response.json();
//     })
//     .then(data => {
//         console.log(data)
//         // for(let i = 0; i < arrlength; i++) {
//         // }
//     })
//     .catch(error => {
//         console.log(error)
//     })
// }

// $( document ).ready(function() {
//     getDecks();
//     // console.log( "ready!" );
// });