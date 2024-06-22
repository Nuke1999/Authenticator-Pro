// import { Buffer } from "buffer";

// window.Buffer = Buffer;

// function autoFillAuthInputs(token) {
//   const inputs = document.querySelectorAll('input[type="text"]');
//   console.log("Found inputs:", inputs);
//   inputs.forEach((input) => {
//     if (input.id.includes("auth")) {
//       console.log("Pasting token into input with id:", input.id);
//       input.value = token;

//       // Simulate user interaction
//       input.focus();
//       const inputEvent = new Event("input", { bubbles: true });
//       input.dispatchEvent(inputEvent);

//       const changeEvent = new Event("change", { bubbles: true });
//       input.dispatchEvent(changeEvent);

//       input.blur();
//     }
//   });
// }

// // Auto-fill the inputs when the DOM is fully loaded
// document.addEventListener("DOMContentLoaded", () => {
//   chrome.storage.local.get(["lastToken"], (result) => {
//     if (result.lastToken) {
//       // console.log("Last token found:", result.lastToken);
//       autoFillAuthInputs(result.lastToken);
//     } else {
//       // console.log("No last token found.");
//     }
//   });
// });
