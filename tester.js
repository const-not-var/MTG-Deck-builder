
// Select the node that will be observed for mutations
const targetNode = document.getElementById("deckTableId");

// Options for the observer (which mutations to observe)
const config = { attributes: true, childList: true, subtree: true };

const getElement = (element) => document.querySelector(element);


const $span = getElement('#deckTableId');
const options = { subtree: true, childList: true };
const observer = new MutationObserver((mutationsList, observer) => {
  	for (let mutation of mutationsList){
    	if (mutation.type === 'childList') {
            cardCounter();
        }
    }
});
  
  observer.observe($span, options);

//Card counter logic
function cardCounter() {
    observer.disconnect();
    let counter = 0;
    $("#deckTableId tr").each(function () {
        // console.log($(this))
        $(this)
            .find("#tableNumber")
            .each(function () {
                counter++
                $(this).text(counter);
            });
    });
    observer.observe($span, options);
}

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
        let minute = date.getMinutes();
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
                // console.log(currentOptions)
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


