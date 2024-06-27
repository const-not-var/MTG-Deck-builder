const dataCardTemplate = document.querySelector("[data-card-template]");


function clickTest() {
    console.log("I am clicked");
    document.getElementById("deckTester").innerText = "I am changed";
    window.location.replace("/mydecks.html")
}

function signup() {
    const email = document.getElementById("inputEmail3").value;
    const password = document.getElementById("inputPassword3").value;

    if (email && password) {
        window.location.replace("/index.html")
    } else {
        alert("NO!")
    }
}

function login() {
    const email = document.getElementById("inputEmail3").value;
    const password = document.getElementById("inputPassword3").value;
    
    if (email === "mtg@dev.com" && password === "password") {
        window.location.replace("/index.html")
    } else {
        alert("EMAIL OR PASSWORD INCORRECT!");
    }
}

