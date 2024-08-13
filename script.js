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
  });
    $.ajax({
        url: "http://localhost:3001/api/decks",
        method: "post",
        contentType: "application/json",
        data: JSON.stringify(deckData),
        success: function () {
          alert( newDeckName + " Saved successfuly");
        },
    });
}

// mongoURI = "http://localhost:3001/api/decks/";

// sample code for clicking the deck on home page to mock populate decks for css changes
// let homeDecks = document.getElementById("plusIcon");
// if (homeDecks) {
//   let homeDeckIcon = '<div class="deck-icon">';
//       homeDeckIcon += '<img src="assets/photos/deck-template.jpeg" class="deck-placement" alt="Atraxa, Grand Unifier"></img>';
//       homeDeckIcon += '<h5 class="card-text deck-info" id="deckTester"></h5>';
//       homeDeckIcon += '<p class="card-text deck-info">03-17-2024</p>';
//       homeDeckIcon += "</div>";

//   deckBodyref = document.getElementById("pagePlacement");
//   $(deckBodyref).append(homeDeckIcon);
// }
