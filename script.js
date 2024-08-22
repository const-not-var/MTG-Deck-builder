

//Clicking plus icon to redirect to table page
function makeDeck() {
  console.log("I am clicked");
  // document.getElementById("deckTester").innerText = "I am changed";
  window.location.replace("/mydecks.html");
}

// Signup basic input. No validation planned
function signup() {
  const email = document.getElementById("inputEmail3").value;
  const password = document.getElementById("inputPassword3").value;

  if (email && password) {
    window.location.replace("/index.html");
  } else {
    alert("NO!");
  }
}

// Login has predetermined credentials
function login() {
  const email = document.getElementById("inputEmail3").value;
  const password = document.getElementById("inputPassword3").value;

  if (email === "mtg@dev.com" && password === "password") {
    window.location.replace("/index.html");
  } else {
    alert("EMAIL OR PASSWORD INCORRECT!");
  }
}

// Renaming a specific deck. Clicking the paper and pencil creates modal
function renameDecks() {
  let userInput = document.getElementById("userInput").value;

  if (userInput.length < 1) {
    return alert("Deck name can't be blank!");
  }
  // console.log(userInput);
  $("#deckTableId").find("#deckName").text(userInput);
  // console.log(deckNames);
  const myModal = document.getElementById("exampleModal");
  const myInput = document.getElementById("myInput");

  myModal.addEventListener("shown.bs.modal", () => {
    myInput.focus();
  });
}

// Deleting a specific deck
function deleteDeck() {
  // console.log("Delete deck");
  window.confirm("Are you sure you want to delete your deck?");
}

//Saving a specific deck
function saveDeck() {
  let newDeckName = document.getElementById("deckName").innerText;
  let deckData = {
    name: newDeckName,
    deck: [],
  };

  // console.log(newDeckName);
  let tableData = [];
  $("#deckTableId tr").each(function () {
    let rowData = [];
    $(this)
      .find("td")
      .each(function () {
        rowData.push($(this).text());
      });
    if (rowData.length > 0) {
      tableData.push(rowData);
    }
  });
  tableData.forEach((card) => {
    deckData.deck.push({
      cardPlace: card[0],
      name: card[1],
      dateAdded: card[2],
    });
    console.log();
  });
  $.ajax({
    url: "http://localhost:3001/api/decks",
    method: "post",
    contentType: "application/json",
    data: JSON.stringify(deckData),
    success: function () {
      alert(newDeckName + " Saved successfuly");
    },
  });
}

function getDecks() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        const allDbData = JSON.parse(this.response);
        const length = allDbData.data.length;
        let arrOfDecks = allDbData.data;

        for(let i = 0; i < length; i++) {
            fetch(
                "https://api.magicthegathering.io/v1/cards?" +
                new URLSearchParams({
                    name: arrOfDecks[i].deck[0].name,
                }))
                .then((response) => {
                    if (!response.ok) {
                        throw new Error("Network response is not ok");
                    }
                    return response.json();
                })
                .then((data) => {
                        deckBodyref = document.getElementById("pagePlacement");

                        let homeDeckIcon = '<div class="deck-icon deck-load" id="deckIcon">';
                        homeDeckIcon += '<img src="' + data.cards[0].imageUrl + '" alt="YOUR COMMANDER" class="deck-placement" onclick="getDeckById()"></img>';
                        homeDeckIcon += '<h4 class="card-text deck-info deck-load" id="deckTester"> '  + arrOfDecks[i].name + '</h4>';
                        homeDeckIcon += '<h4 class="card-text deck-info deck-load">' + arrOfDecks[i].deck[0].dateAdded + '</h4>';
                        homeDeckIcon += "</div>";
                
                        $(deckBodyref).append(homeDeckIcon);
                })
                .catch((error) => {
                    console.log(error);
                }
                );
        }
};
    xhttp.open("GET", "http://localhost:3001/api/decks");
    xhttp.send();
}



function getDeckById() {
    // window.location.replace("/mydecks.html")

    fetch("http://localhost:3001/api/decks")
    .then((response) => {
        if (!response.ok) {
            throw new Error("Network response is not ok");
        }
        return response.json();
    })
    .then(data => {
        const arrlength = data.data.length;

        
        // nested loop?
        // loop through a deck 
        // loop each component in between each deck?

        // Does it have to load?


        for(let i = 0; i < arrlength; i++) {
        // console.log(arrlength)
        console.log(data.data[i].deck[0].name);
        console.log(data.data[i].deck[0].cardPlace);
        console.log(data.data[i].deck[0].dateAdded);
        }

    })
    .catch(error => {
        console.log(error)
    })


}

$( document ).ready(function() {
    getDecks()
    // console.log( "ready!" );
});


