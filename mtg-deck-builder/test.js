
const dataCardTemplate = document.querySelector("[data-card-template]")

function fetchReq(event, searchBox) {
    const userInput = searchBox.value;
    document.getElementById('datalistOptions').innerHTML = "";
    if (event.key === "Enter") {
        fetch('https://api.magicthegathering.io/v1/cards?' + new URLSearchParams({
            name: userInput,
            // pageSize: 10
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
                    currentOptions.appendChild(option);
                }
            });
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
    }
}

function addCards(event, searchInput) {
    const addCard = searchbox.value
    const cardToAdd = document.getElementById("datalistOptions");
    cardToAdd.innerHTML = "";
    const options = document.createElement(options);
    options.value =  

    console.log("I am clicked");
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
// searchInput.addEventListener('keyup', function(event) {
//     if (KeyboardEvent.code === 13) {
//       searchInput.click();
//     }
//   });
// }