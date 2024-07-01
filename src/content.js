const { authenticator } = require("otplib");
const { Buffer } = require("buffer");

window.Buffer = Buffer;

(function () {
  let extensionContextInvalidated = false;

  function autoFillAuthInputs(token) {
    const inputs = document.querySelectorAll('input[type="text"]');
    const activeElement = document.activeElement; // Store the currently focused element
    console.log("Found inputs:", inputs);

    inputs.forEach((input) => {
      const inputId = input.id.toLowerCase();
      if (inputId.includes("auth") || inputId.includes("totp")) {
        console.log("Pasting token: ", token);
        input.value = token;

        // Simulate user interaction
        const inputEvent = new Event("input", { bubbles: true });
        input.dispatchEvent(inputEvent);

        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);
      }
    });

    if (activeElement && activeElement.focus) {
      activeElement.focus(); // Restore the focus to the originally focused element
    }
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
            if (savedUrl && currentTabUrl.includes(savedUrl)) {
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

  function updateOTPs() {
    chrome.storage.local.get(["tokens"], (result) => {
      const tokens = result.tokens || [];
      tokens.forEach((tokenObj, index) => {
        const otp = authenticator.generate(tokenObj.secret);
        tokens[index].otp = otp;
      });
      chrome.storage.local.set({ tokens });
    });
  }

  function alignToInterval() {
    const now = new Date();
    const seconds = now.getSeconds();
    const delay = seconds < 1 || seconds >= 31 ? 60 - seconds : 30 - seconds;

    setTimeout(() => {
      checkAndFillAuthInputs();
      updateOTPs();
      const intervalId = setInterval(() => {
        if (extensionContextInvalidated) {
          clearInterval(intervalId);
          return;
        }
        try {
          checkAndFillAuthInputs();
          updateOTPs();
        } catch (error) {
          console.log("Error accessing chrome.storage.local:", error);
          extensionContextInvalidated = true;
          clearInterval(intervalId);
        }
      }, 30000); // 30 seconds interval
    }, delay * 1000); // Align to next 1st or 31st second
  }

  function onDOMContentLoaded() {
    try {
      checkAndFillAuthInputs(); // Run immediately when the page loads
      alignToInterval();

      // Adding storage change listener here
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes.tokens) {
          checkAndFillAuthInputs(); // Refresh the autofill logic if tokens are updated
          console.log(
            "Tokens updated in content script:",
            changes.tokens.newValue
          );
        }
      });
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
