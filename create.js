function signup() {
    const email = document.getElementById("inputEmail3").value;
    const password = document.getElementById("inputPassword3").value;
  
    if (email && password) {
      window.location.replace("/index.html");
    } else {
      alert("NO!");
    }
  }