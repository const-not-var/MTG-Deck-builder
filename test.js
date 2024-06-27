// const People = require("insert-data.js");
// import People from "insert-data.js"
// console.log(People);
// use('mtg-deck-builder');


$(document).ready(function(){
    if (window.jQuery) {
        // jQuery is available.
    
        // Print the jQuery version, e.g. "1.0.0":
        console.log(window.jQuery.fn.jquery);
    }
});

// searchInput.addEventListener('keyup', function(event) {
//     if (KeyboardEvent.code === 13) {
//       searchInput.click();
//       console.log("Hello");
//     }
//   });
// }

function delCard() {
    const node = document.getElementById("xCard");
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
}

function addCard(card) {    
    const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let currentDate = `${month}-${day}-${year}`;

    const cardName = $(card).val();
    const id = (typeof ($("#datalistOptions [value= '"+cardName+"']")[0]) === "undefined") ? "" : $("#datalistOptions [value= '"+cardName+"']")[0].id;
    
    if (id === "apiCard") {
    //     let cardObject = {
    //         "name": cardName,
    //         "date": currentDate
    //     }
    //     db.getCollection('users').insertOne(
    //     { cardObject }
    // );

        let cardRow = '<tr id="xCard" class="card-name">'
            cardRow += '<td>1</td>'
            cardRow += '<td>' + cardName + '</td>'
            cardRow += '<td>' + currentDate + '</td>'
            cardRow += '<td><button type="submit" class="x-btn"><img src="assets/photos/delete.png"' + 'onClick="delCard()"' + ' alt="A red X" class="x-icon"></button></td>'
            cardRow += '</tr>';

        tbodyRef = document.getElementById("myTable");
        $(tbodyRef).append(cardRow);
        
        document.getElementById('datalistOptions').innerHTML = "";
    }
} 

function fetchReq(event, searchBox) {
    const userInput = searchBox.value;

    if (event.key === "Enter") {
        fetch('https://api.magicthegathering.io/v1/cards?' + new URLSearchParams({
            name: userInput
        }))
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response is not ok');
            } 
            return response.json();
        })
        .then(data => {
            const currentOptions = document.getElementById('datalistOptions');
            currentOptions.innerHTML = "";
            const cardArr = [];
            data.cards.forEach(card => {
                if ( !(cardArr.indexOf(card.name) > -1) ) {
                    cardArr.push(card.name);
                    const option = document.createElement('option');
                    option.value = card.name;
                    option.setAttribute("id", "apiCard");
                    currentOptions.appendChild(option);
                }
            });
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
    }
}



// Code below is to learn from!


    // function fetchReq(event, searchBox) {
    //     // console.log(searchBox.value)
    //     const userInput = searchBox.value
    //     document.getElementById('datalistOptions').innerHTML = ""
    //     if (event.key === "Enter") {
    //         fetch('https://api.magicthegathering.io/v1/cards?' + new URLSearchParams({
    //             name: userInput,
    //             pageSize: 10
    //         }))
    //         .then(response => {
    //             if (!response.ok) {
    //                 throw new Error('Network response is not ok');
    //             }
    //             return response.json();
    //         })
    //         .then(data => {
    //             document.getElementById('datalistOptions').innerHTML = ""
    //             data.cards.forEach(card => {
    //                 const option = document.createElement('option')
    //                 option.value = card.name
    //                 document.getElementById('datalistOptions').appendChild(option)

    //             });
    //             // const options = Array.from(document.getElementById("datalistOptions").children);
    //             const options = document.getElementById('datalistOptions').children
    //             console.log(typeof options)
    //             console.log(options)
    //             console.log(Object.values(options))
    //             Object.values(options).forEach(value => {
    //                 console.log(value.value)
    //                 console.log(document.getElementById('datalistOptions'))
    //             })
    //         })
    //         .catch(error => {
    //             console.error('There was a problem with the fetch operation:', error);
    //         });
    //     }
    // }


    // function searchBar() {
//     fetch('https://api.magicthegathering.io/v1/cards')
//     .then(response => {
//         if (!response.ok) {
//             throw new Error('Network response is not ok');
//         }
//         return response.json();
//     })
//     .then(data => {
//         console.log('Data received:', data);
//     })
//     .catch(error => {
//         console.error('Could not fetch data:', error);
//     });
// const searchInput = document.getElementById('exampleDataList');

