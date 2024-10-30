import { Buffer } from "buffer";
import { authenticator } from "otplib";

window.Buffer = Buffer;

(function () {
  let popupStatus = false;
  chrome.runtime.onMessage.addListener((request) => {
    if (request.popupOpen !== undefined) {
      popupStatus = request.popupOpen;
      checkAndFillAuthInputs();
    } else {
    }
  });
  function generateToken(secret) {
    return authenticator.generate(secret);
  }
  function autoFillAuthInputs(token) {
    const inputs = document.querySelectorAll("input");
    const activeElement = document.activeElement;
    inputs.forEach((input) => {
      const inputId = input.id.toLowerCase();
      if (
        inputId.includes("auth") ||
        inputId.includes("totp") ||
        inputId.includes("otp") ||
        inputId.includes("2fa") ||
        inputId.includes("mfa") ||
        inputId.includes("code") ||
        inputId.includes("token") ||
        inputId.includes("verify") ||
        inputId.includes("passcode")
      ) {
        input.value = token;
        const inputEvent = new Event("input", { bubbles: true });
        input.dispatchEvent(inputEvent);
        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);
      }
    });
    if (activeElement && activeElement.focus) {
      activeElement.focus();
    }
  }

  function checkAndFillAuthInputs() {
    if (
      typeof chrome.runtime === "undefined" ||
      chrome.runtime.id === undefined
    ) {
      return;
    }

    try {
      chrome.runtime.sendMessage({ type: "GET_TAB_URL" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError);
          return;
        }

        try {
          const currentTabUrl = response.url || "";
          chrome.storage.local.get(
            [
              "tokens",
              "autofillEnabled",
              "isPasswordVerified",
              "passwordCheckbox",
              "encryptionKeyInMemory",
              "iv",
            ],
            async (result) => {
              if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError);
                return;
              }
              try {
                if (
                  result.autofillEnabled &&
                  result.passwordCheckbox === false
                ) {
                  const tokens = result.tokens || [];
                  tokens.forEach((tokenObj) => {
                    const savedUrl = tokenObj.url;
                    const secret = tokenObj.secret;
                    if (savedUrl && currentTabUrl.includes(savedUrl)) {
                      let generatedToken = generateToken(secret);
                      autoFillAuthInputs(generatedToken);
                    }
                  });
                } else if (
                  result.autofillEnabled &&
                  result.passwordCheckbox === true
                ) {
                  if (
                    popupStatus === true &&
                    result.isPasswordVerified === true
                  ) {
                    const tokens = result.tokens || [];
                    tokens.forEach((tokenObj) => {
                      const savedUrl = tokenObj.url;
                      const tokenOtp = tokenObj.otp;
                      if (savedUrl && currentTabUrl.includes(savedUrl)) {
                        autoFillAuthInputs(tokenOtp);
                      }
                    });
                  }
                }
              } catch (error) {
                console.log(error);
              }
            }
          );
        } catch (error) {
          console.log(error);
        }
      });
    } catch (error) {
      console.log(error);
    }
  }

  function alignToInterval() {
    const now = new Date();
    const seconds = now.getSeconds();
    const delay = seconds < 30 ? 30 - seconds : 60 - seconds;
    setTimeout(() => {
      checkAndFillAuthInputs();
      setInterval(() => {
        checkAndFillAuthInputs();
      }, 30000);
    }, delay * 1000);
  }

  function onVisibilityChange() {
    if (!document.hidden) {
      checkAndFillAuthInputs();
    }
  }
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.tokens || changes.autofillEnabled) {
      checkAndFillAuthInputs();
    }
  });
  function onDOMContentLoaded() {
    try {
      checkAndFillAuthInputs();
      alignToInterval();
      document.addEventListener("visibilitychange", onVisibilityChange);
    } catch (error) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  } else {
    onDOMContentLoaded();
  }
})();
