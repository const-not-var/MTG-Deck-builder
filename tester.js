let deckId = "";

//Deleting a specific card
function delCard(card) {
  const deleteCard = card.closest("tr");
  deleteCard.remove();
}

// A card being added to the deck
function addCard(card) {
  fetch(
    "https://api.magicthegathering.io/v1/cards?" +
      new URLSearchParams({
        name: $(card).val(),
      })
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response is not ok");
      }
      return response.json();
    })
    .then((data) => {
      const date = new Date();
      let day = date.getDate();
      let month = date.getMonth() + 1;
      let year = date.getFullYear();
      let hour = date.getHours();
      if(hour === 0) {
        hour = 12;
      }
      let minute = date.getUTCMinutes();
      let seconds = date.getSeconds();
      let currentDate = `${month}-${day}-${year} @ ${hour}:${minute}:${seconds}`;
      
      const cardName = $(card).val();
      const id =
        typeof $('#datalistOptions [value="' + cardName + '"]')[0] ===
        "undefined"
          ? ""
          : $('#datalistOptions [value="' + cardName + '"]')[0].id;

      if (id === "apiCard") {
        let cardRow = '<tr id="xCard" class="card-name card-values">';
        cardRow += '<td class="card-values" id="tableNumber"></td>';
        cardRow +=
          `<td class="card-values" id="tableCardName" data-bs-container="body" data-bs-toggle="popover" data-bs-placement="left" data-bs-trigger="hover" data-bs-delay=\'{"show":500,"hide":150}\' data-bs-html="true" data-bs-content=\'<img id="cardImg" src="${data.cards[0].imageUrl}">\'>` +
          cardName +
          "</td>";
        cardRow +=
          '<td class="card-values" id="cardDateAdded">' + currentDate + "</td>";
        cardRow +=
          '<td><button type="submit" class="x-btn card-values"><img src="assets/photos/delete.png"' +
          'onClick="delCard(this)"' +
          ' alt="A red X" class="x-icon"></button></td>';
        cardRow += "</tr>";
        tbodyRef = document.getElementById("myTable");
        $(tbodyRef).append(cardRow);
        document.getElementById("datalistOptions").innerHTML = "";
      }

      const popoverTriggerList = document.querySelectorAll(
        '[data-bs-toggle="popover"]'
      );
      const popoverList = [...popoverTriggerList].map(
        (popoverTriggerEl) => new bootstrap.Popover(popoverTriggerEl)
      );
    })
    .catch((error) => {
      console.log(error);
    });
}

//Searching for a card
function fetchReq(event, searchBox) {
  const userInput = searchBox.value;

  if (event.key === "Enter" || event.key === " ") {
    fetch(
      "https://api.magicthegathering.io/v1/cards?" +
        new URLSearchParams({
          name: userInput,
        })
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response is not ok");
        }
        return response.json();
      })
      .then((data) => {
        const currentOptions = document.getElementById("datalistOptions");
        currentOptions.innerHTML = "";
        const cardArr = [];
        data.cards.forEach((card) => {
          if (!(cardArr.indexOf(card.name) > -1)) {
            cardArr.push(card.name);
            const option = document.createElement("option");
            option.value = card.name;
            option.setAttribute("id", "apiCard");
            currentOptions.appendChild(option);
          }
        });
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });
  }
}

function createVariables() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  deckId = urlParams.get("deckId");
}

function popDeckTable() {
  const xhttp = new XMLHttpRequest();
  xhttp.onload = function () {
    const allDbData = JSON.parse(this.response);
    let arrOfDecks = allDbData.data;
    let currentDeck = arrOfDecks.find((obj) => {
      return obj._id === deckId;
    });
    const length = currentDeck.deck.length;
    let myCardNames = [];
    let myCardDates = [];

    document.getElementById("deckName").innerText = currentDeck.name;
    
    for (let i = 0; i < length; i++) {
      myCardNames.push(currentDeck.deck[i].name);
      myCardDates.push(currentDeck.deck[i].dateAdded);
    }

    myCardNames.forEach((name_val, index) => {
      let cardRow = '<tr id="xCard" class="card-name card-values">';
      cardRow += '<td class="card-values" id="tableNumber"></td>';
      cardRow +=
        '<td class="card-values" id="tableCardName" data-bs-container="body" data-bs-toggle="popover" data-bs-placement="left" data-bs-trigger="hover" data-bs-delay=\'{"show":500,"hide":150}\' data-bs-html="true">' +
        name_val +
        "</td>";
      cardRow +=
        '<td class="card-values" id="cardDateAdded">' +
        myCardDates[index] +
        "</td>";
      cardRow +=
        '<td><button type="submit" class="x-btn card-values"><img src="assets/photos/delete.png"' +
        'onClick="delCard(this)"' +
        'alt="A red X" class="x-icon"></button></td>';
      cardRow += "</tr>";

      tbodyRef = document.getElementById("myTable");
      $(tbodyRef).append(cardRow);
    });
    myCardNames.forEach((name_val) => {
      fetch(
        "https://api.magicthegathering.io/v1/cards?" +
          new URLSearchParams({
            name: name_val,
          })
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response is not ok");
          }
          return response.json();
        })
        .then((data) => {
          const tds = document.querySelectorAll("td");
          tds.forEach((td) => {
            if (name_val === td.innerText) {
              td.setAttribute(
                "data-bs-content",
                `<img id="cardImg" src="${data.cards[0].imageUrl}">`
              );
            }
            const popoverTriggerList = document.querySelectorAll(
              '[data-bs-toggle="popover"]'
            );
            const popoverList = [...popoverTriggerList].map(
              (popoverTriggerEl) => new bootstrap.Popover(popoverTriggerEl)
            );
          });
        })
        .catch((error) => {
          console.log(error);
        });
    });
  };
  xhttp.open("GET", "http://localhost:3001/api/decks");
  xhttp.send();
}

$(document).ready(function () {
  createVariables();
  popDeckTable();
});
