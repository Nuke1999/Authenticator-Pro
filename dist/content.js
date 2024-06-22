/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!************************!*\
  !*** ./src/content.js ***!
  \************************/
// const { authenticator } = require("otplib");
// const { Buffer } = require("buffer");

// window.Buffer = Buffer;

// console.log("content.js loaded");

// (function () {
//   let extensionContextInvalidated = false;

//   function autoFillAuthInputs(token) {
//     const inputs = document.querySelectorAll('input[type="text"]');
//     console.log("Found inputs:", inputs);

//     inputs.forEach((input) => {
//       if (input.id.includes("auth")) {
//         console.log("Pasting token into input with id:", input.id);
//         input.value = token;

//         // Simulate user interaction
//         input.focus();
//         const inputEvent = new Event("input", { bubbles: true });
//         input.dispatchEvent(inputEvent);

//         const changeEvent = new Event("change", { bubbles: true });
//         input.dispatchEvent(changeEvent);

//         input.blur();
//       }
//     });
//   }

//   function checkAndFillAuthInputs() {
//     chrome.runtime.sendMessage({ type: "GET_TAB_URL" }, (response) => {
//       const currentTabUrl = response.url;
//       console.log("Current tab URL:", currentTabUrl);

//       chrome.storage.local.get(["tokens", "autofillEnabled"], (result) => {
//         console.log("chrome.storage.local content:", result);
//         if (result.autofillEnabled) {
//           const tokens = result.tokens || [];
//           tokens.forEach((tokenObj) => {
//             const savedUrl = tokenObj.url; // Directly access the URL from the token object
//             if (savedUrl == currentTabUrl) {
//               console.log("condition to fill token met");
//               const otp = authenticator.generate(tokenObj.secret); // Generate OTP
//               autoFillAuthInputs(otp);
//             }
//           });
//         } else {
//           console.log("Autofill is disabled.");
//         }
//       });
//     });
//   }

//   function onDOMContentLoaded() {
//     try {
//       checkAndFillAuthInputs();

//       const intervalId = setInterval(() => {
//         if (extensionContextInvalidated) {
//           clearInterval(intervalId);
//           return;
//         }
//         try {
//           checkAndFillAuthInputs();
//         } catch (error) {
//           console.log("Error accessing chrome.storage.local:", error);
//           extensionContextInvalidated = true;
//           clearInterval(intervalId);
//         }
//       }, 3000);

//       window.addEventListener("unload", () => clearInterval(intervalId));
//     } catch (error) {
//       console.log("Error initializing content script:", error);
//     }
//   }

//   if (document.readyState === "loading") {
//     document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
//   } else {
//     onDOMContentLoaded();
//   }
// })();

// const { Buffer } = require("buffer");

// window.Buffer = Buffer;

// console.log("content.js loaded");

// (function () {
//   let extensionContextInvalidated = false;

//   function autoFillAuthInputs(token) {
//     const inputs = document.querySelectorAll('input[type="text"]');
//     console.log("Found inputs:", inputs);

//     inputs.forEach((input) => {
//       if (input.id.includes("auth")) {
//         console.log("Pasting token into input with id:", input.id);
//         input.value = token;

//         // Simulate user interaction
//         input.focus();
//         const inputEvent = new Event("input", { bubbles: true });
//         input.dispatchEvent(inputEvent);

//         const changeEvent = new Event("change", { bubbles: true });
//         input.dispatchEvent(changeEvent);

//         input.blur();
//       }
//     });
//   }

//   function checkAndFillAuthInputs() {
//     chrome.runtime.sendMessage({ type: "GET_TAB_URL" }, (response) => {
//       const currentTabUrl = response.url;
//       if (!currentTabUrl) {
//         console.log("Current tab URL not found.");
//         return;
//       }
//       console.log("Current tab URL:", currentTabUrl);

//       chrome.storage.local.get(
//         ["tokens", "autofillEnabled", "lastToken"],
//         (result) => {
//           console.log("chrome.storage.local content:", result);
//           if (result.autofillEnabled) {
//             const tokens = result.tokens || [];
//             const lastToken = result.lastToken || "";
//             tokens.forEach((tokenObj) => {
//               const savedUrl = tokenObj.url; // Directly access the URL from the token object
//               if (savedUrl && currentTabUrl.includes(savedUrl)) {
//                 console.log("condition to fill token met");
//                 autoFillAuthInputs(lastToken); // Use the stored OTP
//               }
//             });
//           } else {
//             console.log("Autofill is disabled.");
//           }
//         }
//       );
//     });
//   }

//   function onDOMContentLoaded() {
//     try {
//       checkAndFillAuthInputs();

//       const intervalId = setInterval(() => {
//         if (extensionContextInvalidated) {
//           clearInterval(intervalId);
//           return;
//         }
//         try {
//           checkAndFillAuthInputs();
//         } catch (error) {
//           console.log("Error accessing chrome.storage.local:", error);
//           extensionContextInvalidated = true;
//           clearInterval(intervalId);
//         }
//       }, 3000);

//       window.addEventListener("unload", () => clearInterval(intervalId));
//     } catch (error) {
//       console.log("Error initializing content script:", error);
//     }
//   }

//   if (document.readyState === "loading") {
//     document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
//   } else {
//     onDOMContentLoaded();
//   }
// })();

(function () {
  let extensionContextInvalidated = false;

  function autoFillAuthInputs(token) {
    const inputs = document.querySelectorAll('input[type="text"]');
    console.log("Found inputs:", inputs);

    inputs.forEach((input) => {
      if (input.id.includes("auth")) {
        console.log("Pasting token into input with id:", input.id);
        input.value = token;

        // Simulate user interaction
        input.focus();
        const inputEvent = new Event("input", { bubbles: true });
        input.dispatchEvent(inputEvent);

        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);

        input.blur();
      }
    });
  }

  function checkAndFillAuthInputs() {
    chrome.runtime.sendMessage({ type: "GET_TAB_URL" }, (response) => {
      const currentTabUrl = response.url;
      if (!currentTabUrl) {
        console.log("Current tab URL not found.");
        return;
      }
      console.log("Current tab URL:", currentTabUrl);

      chrome.storage.local.get(["tokens", "autofillEnabled"], (result) => {
        console.log("chrome.storage.local content:", result);
        if (result.autofillEnabled) {
          const tokens = result.tokens || [];
          tokens.forEach((tokenObj) => {
            const savedUrl = tokenObj.url;
            console.log("savedUrl: ", savedUrl);
            if (savedUrl == currentTabUrl) {
              console.log("condition to fill token met");
              const otp = tokenObj.otp; // Use the stored OTP
              autoFillAuthInputs(otp);
            }
          });
        } else {
          console.log("Autofill is disabled.");
        }
      });
    });
  }

  function onDOMContentLoaded() {
    try {
      checkAndFillAuthInputs();

      const intervalId = setInterval(() => {
        if (extensionContextInvalidated) {
          clearInterval(intervalId);
          return;
        }
        try {
          checkAndFillAuthInputs();
        } catch (error) {
          console.log("Error accessing chrome.storage.local:", error);
          extensionContextInvalidated = true;
          clearInterval(intervalId);
        }
      }, 3000);

      // Adding storage change listener here
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes.tokens) {
          // Refresh the autofill logic if tokens are updated
          checkAndFillAuthInputs();
          console.log(
            "Tokens updated in content script:",
            changes.tokens.newValue
          );
        }
      });

      window.addEventListener("unload", () => clearInterval(intervalId));
    } catch (error) {
      console.log("Error initializing content script:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  } else {
    onDOMContentLoaded();
  }
})();

/******/ })()
;
//# sourceMappingURL=content.js.map