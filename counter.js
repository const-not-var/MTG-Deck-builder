// Select the node that will be observed for mutations
const targetNode = document.getElementById("deckTableId");

// Options for the observer (which mutations to observe)
const config = { attributes: true, childList: true, subtree: true };

const getElement = (element) => document.querySelector(element);

const $span = getElement("#deckTableId");
const options = { subtree: true, childList: true };
const observer = new MutationObserver((mutationsList, observer) => {
  for (let mutation of mutationsList) {
    if (mutation.type === "childList") {
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
        counter++;
        $(this).text(counter);
      });
  });
  observer.observe($span, options);
}