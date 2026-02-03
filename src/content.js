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
  function setInputValue(input, value) {
    const stringValue = String(value ?? "");
    try {
      input.focus();
    } catch (_) {}
    try {
      const prototype = Object.getPrototypeOf(input);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(input, stringValue);
      } else {
        input.value = stringValue;
      }
      input.setAttribute("value", stringValue);
    } catch (_) {
      input.value = stringValue;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("keyup", { bubbles: true }));
    try {
      input.blur();
    } catch (_) {}
  }
  function autoFillAuthInputs(token) {
    const inputs = document.querySelectorAll("input");
    const activeElement = document.activeElement;
    inputs.forEach((input) => {
      const inputId = input.id ? input.id.toLowerCase() : "";
      const inputName = input.name ? input.name.toLowerCase() : "";
      const inputType = input.type ? input.type.toLowerCase() : "";
      const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();
      const placeholder = (input.getAttribute("placeholder") || "").toLowerCase();
      const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();

      const keywords = [
        "auth",
        "totp",
        "otp",
        "2fa",
        "mfa",
        "code",
        "token",
        "verify",
        "passcode",
        "twostep",
        "two-step",
        "two_step",
        "twofactor",
        "two-factor",
        "two_factor",
        "onetime",
        "one-time",
        "verification",
        "securitycode",
        "security",
        "pin",
      ];

      const haystack = `${inputId} ${inputName} ${ariaLabel} ${placeholder}`;
      const keywordMatch = keywords.some((word) => haystack.includes(word));
      const autocompleteMatch =
        autocomplete.includes("one-time-code") ||
        autocomplete.includes("otp") ||
        autocomplete.includes("totp") ||
        autocomplete.includes("2fa") ||
        autocomplete.includes("mfa");

      if (keywordMatch || autocompleteMatch) {
        setInputValue(input, token);
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
          console.error(chrome.runtime.lastError);
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
              "iv",
            ],
            async (result) => {
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
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
                      let generatedToken;
                      try {
                        generatedToken = generateToken(secret);
                      } catch (e) {
                        console.error(e);
                      }
                      if (generatedToken) autoFillAuthInputs(generatedToken);
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
                console.error(error);
              }
            }
          );
        } catch (error) {
          console.error(error);
        }
      });
    } catch (error) {
      console.error(error);
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

