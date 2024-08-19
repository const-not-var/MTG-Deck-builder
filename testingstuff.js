// async function getImgUrl(cardName) {
//     try {
//         const response = await fetch(
//             "https://api.magicthegathering.io/v1/cards?" +
//             new URLSearchParams({
//                 name: cardName,
//             }));
//         if (!response.ok) {
//             throw new Error("Network response is not ok");
//         }
//         const data = await response.json();
//         // console.log(data.cards[0].imageUrl);
//         return data.cards[0].imageUrl;
//     } catch (error) {
//         console.log(error);
//     }
// }

// function getDecks() {

//   const xhttp = new XMLHttpRequest();
//   xhttp.onload = function () {
//     const allDbData = JSON.parse(this.response);
//     // console.log(allDbData)

//     const length = allDbData.data.length;
//     let arrOfDecks = allDbData.data;
    
//     for(let i = 0; i < length; i++) {

//         let getImg = getImgUrl(arrOfDecks[i].deck[0].name).then(response => JSON.stringify(response));
//         // console.log(i)
//             // console.log(`${allDbData.data[0].deck[0].name}`)
//         deckBodyref = document.getElementById("pagePlacement");

//         // console.log("test")
//         // console.log(arrOfDecks[i].deck[0].name)

//         let homeDeckIcon = '<div class="deck-icon deck-load" id="deckIcon">';
//         homeDeckIcon += '<img src="' + getImg + '" alt="YOUR COMMANDER" class="deck-placement"></img>';
//         homeDeckIcon += '<h4 class="card-text deck-info deck-load" id="deckTester"> '  + arrOfDecks[i].name + '</h4>';
//         homeDeckIcon += '<h4 class="card-text deck-info deck-load">' + arrOfDecks[i].deck[0].dateAdded + '</h4>';
//         homeDeckIcon += "</div>";

//         $(deckBodyref).append(homeDeckIcon);

//     }
// };
// xhttp.open("GET", "http://localhost:3001/api/decks");
// xhttp.send();
// };