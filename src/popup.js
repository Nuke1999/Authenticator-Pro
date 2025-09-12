import { Buffer } from "buffer";
// QrScanner moved to scanner.js
import {
  createSwitchElement,
  setAdvancedAddMessage,
  confirmDelete,
  createXIcon,
  createPopup,
} from "./ui.js";
import { initScaleControl, applyStoredScale } from "./settings.js";
import {
  encryptSecret,
  decryptSecret,
  verifyPassword,
  hexToText,
  hashWithSalt,
  convertKeyToCryptoKey,
  decryptTokens,
} from "./auth.js";
import { getTimeSyncData, setTimeSyncData, initTimeSync } from "./timeSync.js";
import {
  requestAutofillPermission,
  requestClipboardPermission,
} from "./permissions.js";
import { deleteToken } from "./storage.js";
import { createTokenUI, generateToken, isValidBase32 } from "./tokens.js";
import {
  initThemeControls,
  initPopupModeResizer,
  initBasicToggles,
} from "./settings.js";
import { initAdvancedAdd } from "./scanner.js";

window.Buffer = Buffer;

chrome.storage.local.set({
  isPasswordVerified: false,
});
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isPopup = urlParams.get("isPopup") === "true";
  const isVideoPermission = urlParams.get("isVideoPermission") === "true";
  const nameInput = document.getElementById("name");
  const secretInput = document.getElementById("secret");
  const tokensContainer = document.getElementById("tokens");
  const mainContent = document.getElementById("main-content");
  const headerText = document.getElementById("centered-title");
  const secretFormLabel = document.getElementById("secret-form-label");
  const formContainer = document.getElementById("form-container");
  const addTokenButton = document.getElementById("generate");
  const advancedAddButton = document.createElement("button");
  const minimizeButton = document.getElementById("minimize");
  const mainSettings = document.getElementById("main-settings");
  const settingsPage = document.getElementById("settings-content");
  const backButton = document.getElementById("back-button");
  const lightThemeButton = document.getElementById("light-theme-button");
  const darkThemeButton = document.getElementById("dark-theme-button");
  advancedAddButton.className = "advanced-add-button";
  advancedAddButton.textContent = chrome.i18n.getMessage("advanced_add");
  const authenticatorMainContent = document.getElementById(
    "authenticator-main-content"
  );
  const passwordPromptContainer = document.getElementById(
    "password-prompt-container"
  );
  const passwordSubmitButton = document.getElementById(
    "password-submit-button"
  );
  const passwordInputField = document.getElementById("password-input");
  let isTimeCheckboxChecked;
  let isPasswordCheckboxChecked;
  nameInput.focus();

  const switches = [
    {
      id: "advanced-add-checkbox",
      label: "advanced_add_checkbox_label",
      tooltip: "advanced_add_checkbox_tooltip",
    },
    {
      id: "autofill-checkbox",
      label: "autofill_checkbox_label",
      tooltip: "autofill_checkbox_tooltip",
    },
    {
      id: "clipboard-copying-checkbox",
      label: "clipboard_copying_checkbox_label",
      tooltip: "clipboard_copying_checkbox_tooltip",
    },
    {
      id: "hide-token-adder-checkbox",
      label: "hide_token_adder_checkbox_label",
      tooltip: "hide_token_adder_checkbox_tooltip",
    },
    {
      id: "online-time-checkbox",
      label: "online_time_checkbox_label",
      tooltip: "online_time_checkbox_tooltip",
    },
    {
      id: "password-protected-checkbox",
      label: "password_protected_checkbox_label",
      tooltip: "password_protected_checkbox_tooltip",
      extraMessage: "password_protected_checkbox_message",
      extraMessageId: "checkbox-message-password",
    },
    {
      id: "popup-mode-checkbox",
      label: "popup_mode_label",
      tooltip: "popup_mode_tooltip",
    },
    {
      id: "sync-checkbox",
      label: "sync_checkbox_label",
      tooltip: "sync_checkbox_tooltip",
      extraMessage: "sync_checkbox_message",
      extraMessageId: "checkbox-message-sync",
    },
  ];

  switches
    .slice()
    .reverse()
    .forEach((switchConfig) => {
      const switchElement = createSwitchElement(switchConfig);
      const permissionsHeader = document.querySelector("h2.permissions-header");

      permissionsHeader.insertAdjacentElement("afterend", switchElement);
    });

  // Grab toggle elements after they are inserted above
  const autofillCheckbox = document.getElementById("autofill-checkbox");
  const syncCheckbox = document.getElementById("sync-checkbox");
  const clipboardCopyingCheckbox = document.getElementById(
    "clipboard-copying-checkbox"
  );
  const onlineTimeCheckbox = document.getElementById("online-time-checkbox");
  const advancedAddCheckbox = document.getElementById("advanced-add-checkbox");
  const popupModeCheckbox = document.getElementById("popup-mode-checkbox");
  const hideTokenAdderCheckbox = document.getElementById(
    "hide-token-adder-checkbox"
  );
  const passwordProtectedCheckbox = document.getElementById(
    "password-protected-checkbox"
  );

  // Apply stored UI scale early and ensure settings UI uses the existing settings-content container
  try {
    applyStoredScale();
  } catch (e) {
    console.log(e);
  }
  if (settingsPage) {
    try {
      initScaleControl(settingsPage);
    } catch (e) {
      console.log(e);
    }
  }
  // Advanced add / QR scanner will be initialized below (after theme controls)
  function localizePopup() {
    document.querySelectorAll("*:not(script):not(style)").forEach((element) => {
      if (
        element.childNodes.length === 1 &&
        element.childNodes[0].nodeType === Node.TEXT_NODE
      ) {
        const originalText = element.textContent;
        const localizedText = originalText.replace(
          /__MSG_(\w+)__/g,
          (match, key) => {
            return chrome.i18n.getMessage(key) || match;
          }
        );
        if (localizedText !== originalText) {
          element.textContent = localizedText;
        }
      }
    });
  }

  localizePopup();

  function popupUpdate() {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs
          .sendMessage(tabs[0].id, { popupOpen: true })
          .catch((error) => {});
      });
    } catch (error) {
      console.log(error);
    }
  }

  // Theme and popup mode moved into settings module
  initThemeControls({ lightThemeButton, darkThemeButton, syncCheckbox });
  initPopupModeResizer({ popupModeCheckbox, syncCheckbox });

  // Initialize advanced add / QR scanner
  const scanner = initAdvancedAdd({
    advancedAddButton,
    secretFormLabel,
    nameInput,
    secretInput,
    setAdvancedAddMessage,
    i18nGetMessage: (key) => chrome.i18n.getMessage(key),
  });

  // Create token UI early so addTokenToDOM is available for initial rendering
  const { addTokenToDOM: addTokenToDOMImpl, updateToken: updateTokenImpl } =
    createTokenUI({
      tokensContainer,
      syncCheckbox,
      clipboardCopyingCheckbox,
      autofillCheckbox,
      confirmDelete,
      deleteToken,
      createXIcon,
      i18nGetMessage: (key) => chrome.i18n.getMessage(key),
      popupUpdate,
    });
  function reorderTokensByOrderArray(tokens, order) {
    if (!Array.isArray(tokens)) return [];
    if (!Array.isArray(order) || order.length === 0) return tokens.slice();
    const indexMap = new Map(order.map((n, i) => [n, i]));
    const inOrder = [];
    const rest = [];
    for (const t of tokens) {
      if (indexMap.has(t.name)) inOrder.push(t);
      else rest.push(t);
    }
    inOrder.sort((a, b) => indexMap.get(a.name) - indexMap.get(b.name));
    rest.sort((a, b) => a.name.localeCompare(b.name));
    return inOrder.concat(rest);
  }
  function addTokenToDOM(name, secret, url, otp) {
    return addTokenToDOMImpl(name, secret, url, otp);
  }
  function updateToken(name, secret) {
    return updateTokenImpl(name, secret);
  }
  // Initialize core toggle behaviors
  initBasicToggles({
    autofillCheckbox,
    syncCheckbox,
    clipboardCopyingCheckbox,
    onlineTimeCheckbox,
    advancedAddCheckbox,
    hideTokenAdderCheckbox,
    formContainer,
    advancedAddButton,
    popupUpdate,
    addTokenToDOM,
    tokensContainer,
    passwordProtectedCheckbox,
  });

  function lastSeconds(seconds) {
    const wholeSeconds = Math.floor(seconds);

    if (wholeSeconds === 25 || wholeSeconds === 55) {
      return 5;
    } else if (wholeSeconds === 26 || wholeSeconds === 56) {
      return 4;
    } else if (wholeSeconds === 27 || wholeSeconds === 57) {
      return 3;
    } else if (wholeSeconds === 28 || wholeSeconds == 58) {
      return 2;
    } else if (wholeSeconds === 29 || wholeSeconds == 59) {
      return 1;
    } else {
      return "";
    }
  }

  const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  async function updateClock() {
    console.log("updating clock");
    const timeApiUrl = "https://worldtimeapi.org/api/timezone/Etc/UTC";
    let initialTime;
    let offset = 0;

    if (isTimeCheckboxChecked) {
      try {
        const syncData = await getTimeSyncData();
        const timeSinceLastSync = Date.now() - syncData.lastSync;

        // If we have a recent sync, use the stored offset
        if (timeSinceLastSync < SYNC_INTERVAL_MS) {
          console.log("less than 1 hour, not calling api");
          offset = syncData.offset;
          startClock(getSecondsFromLocalTime(offset));
          // Schedule the next sync
          setTimeout(updateClock, SYNC_INTERVAL_MS - timeSinceLastSync);
          return;
        }

        // Otherwise, try to sync with the time API
        console.log("calling api");
        const seconds = await getSecondsFromTimeApi();
        await setTimeSyncData(offset);
        startClock(seconds);
        // Schedule the next sync
        setTimeout(updateClock, SYNC_INTERVAL_MS);
      } catch (error) {
        console.log("Time sync error, using local time:", error);
        const syncData = await getTimeSyncData();
        startClock(getSecondsFromLocalTime(syncData.offset));
        // Retry sooner on error (after 5 minutes)
        setTimeout(updateClock, 5 * 60 * 1000);
      }
    } else {
      const syncData = await getTimeSyncData();
      offset = syncData.offset;
      const seconds = getSecondsFromLocalTime(offset);
      startClock(seconds);
    }

    function getSecondsFromTimeApi() {
      return Promise.race([
        fetch(timeApiUrl)
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
          })
          .then((data) => {
            initialTime = new Date(data.datetime);
            offset = initialTime.getTime() - Date.now();
            return (
              initialTime.getSeconds() + initialTime.getMilliseconds() / 1000
            );
          }),
        new Promise((resolve) =>
          setTimeout(() => resolve(getSecondsFromLocalTime()), 500)
        ),
      ]);
    }

    function getSecondsFromLocalTime(offset = 0) {
      const now = new Date(Date.now() + offset);
      return now.getSeconds() + now.getMilliseconds() / 1000;
    }

    function updateClockWithSeconds(seconds) {
      let progressOffset;
      if (seconds <= 30) {
        progressOffset = -251.2 * (seconds / 30);
      } else {
        progressOffset = -251.2 * ((seconds - 30) / 30);
      }
      document.querySelector(".progress-circle").style.strokeDashoffset =
        progressOffset;
      const displayText = lastSeconds(seconds);
      const clockTextElement = document.querySelector(".clock-text");
      clockTextElement.textContent = displayText;
      const fractionalSecond = seconds % 1;
      clockTextElement.style.opacity = 1 - fractionalSecond;
    }

    function startClock(initialSeconds) {
      let lastUpdateTime = -1;
      function tick(seconds) {
        try {
          if (seconds === undefined) seconds = getSecondsFromLocalTime();
          updateClockWithSeconds(seconds);
          const currentSecond = Math.floor(seconds);
          if (
            (currentSecond === 0 || currentSecond === 30) &&
            currentSecond !== lastUpdateTime
          ) {
            updateTokensAtInterval();
            lastUpdateTime = currentSecond;
          }
          requestAnimationFrame(() => tick(getSecondsFromLocalTime()));
        } catch (error) {
          console.log("Error in tick function:", error);
        }
      }
      tick(initialSeconds);
    }
  }

  function updateTokensAtInterval() {
    chrome.storage.local.get(
      ["tokens", "passwordCheckbox", "encryptionKeyInMemory", "iv", "salt"],
      async (result) => {
        if (result.passwordCheckbox === true) {
          const jwk = result.encryptionKeyInMemory;
          if (jwk) {
            try {
              const importedKey = await crypto.subtle.importKey(
                "jwk",
                jwk,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
              );
              let tokens = result.tokens || [];
              for (let token of tokens) {
                try {
                  const decryptedSecret = await decryptSecret(
                    token.secret,
                    importedKey,
                    result.iv
                  );
                  updateToken(token.name, decryptedSecret);
                } catch (error) {
                  console.log(error);
                }
              }
            } catch (error) {
              console.log(error);
            }
          }
        } else {
          let tokens = result.tokens || [];
          for (let tokenObj of tokens) {
            updateToken(tokenObj.name, tokenObj.secret);
          }
        }
      }
    );
  }

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addTokenButton.click();
      nameInput.blur();
    }
  });

  secretInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addTokenButton.click();
      secretInput.blur();
    }
  });
  mainSettings.addEventListener("click", () => {
    mainContent.style.display = "none";
    settingsPage.style.display = "block";
    mainSettings.style.visibility = "hidden";
    backButton.style.visibility = "visible";
    headerText.textContent = chrome.i18n.getMessage("settings");
  });

  backButton.addEventListener("click", () => {
    settingsPage.style.display = "none";
    mainContent.style.display = "block";
    mainSettings.style.visibility = "visible";
    backButton.style.visibility = "hidden";
    headerText.textContent = chrome.i18n.getMessage("extension_name");
  });

  minimizeButton.addEventListener("click", () => {
    window.close();
  });

  passwordInputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordSubmitButton.click();
    }
  });

  passwordSubmitButton.addEventListener("click", async () => {
    const userPasswordInput = passwordInputField.value;
    chrome.storage.local.get(
      ["salt", "iv", "encryptedHashedPassword", "encryptionKeyInMemory"],
      async (result) => {
        if (chrome.runtime.lastError) {
          return;
        }
        const storedSalt = result.salt;
        const storedIV = result.iv;
        const storedEncryptedHash = result.encryptedHashedPassword;
        const storedEncryptionKeyJwk = result.encryptionKeyInMemory;
        if (
          !storedSalt ||
          !storedIV ||
          !storedEncryptedHash ||
          !storedEncryptionKeyJwk
        ) {
          return;
        }
        try {
          const encoder = new TextEncoder();
          const saltArray = new Uint8Array(
            storedSalt.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
          );
          const saltedPassword = encoder.encode(userPasswordInput + storedSalt);
          const hashedInputBuffer = await crypto.subtle.digest(
            "SHA-256",
            saltedPassword
          );
          const hashedInputHex = Array.from(new Uint8Array(hashedInputBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(userPasswordInput),
            "PBKDF2",
            false,
            ["deriveKey"]
          );
          const derivedKey = await crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt: saltArray,
              iterations: 100000,
              hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["decrypt", "encrypt"]
          );
          const storedIVDecoded = Uint8Array.from(atob(storedIV), (c) =>
            c.charCodeAt(0)
          );
          const storedEncryptedHashDecoded = Uint8Array.from(
            atob(storedEncryptedHash),
            (c) => c.charCodeAt(0)
          );
          const decryptedHashedPasswordBuffer = await crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: storedIVDecoded,
            },
            derivedKey,
            storedEncryptedHashDecoded
          );
          const decryptedHashedPasswordHex = Array.from(
            new Uint8Array(decryptedHashedPasswordBuffer)
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          let hashedPasswordText = hexToText(decryptedHashedPasswordHex);
          if (hashedPasswordText === hashedInputHex) {
            let importedKey = await convertKeyToCryptoKey(
              storedEncryptionKeyJwk
            );

            chrome.storage.local.set({
              isPasswordVerified: true,
            });
            popupUpdate();
            document.getElementById(
              "authenticator-main-content"
            ).style.display = "block";
            document.getElementById("password-prompt-container").style.display =
              "none";
            const tokens = await decryptTokens(importedKey);
            tokens.forEach((tokenObj) => {
              addTokenToDOM(
                tokenObj.name,
                tokenObj.secret,
                tokenObj.url,
                tokenObj.otp
              );
            });
          } else {
          }
        } catch (error) {
          const errorMessageElement = document.getElementById(
            "incorrect-password-message"
          );
          if (errorMessageElement) {
            errorMessageElement.textContent = chrome.i18n.getMessage(
              "incorrect_password_message"
            );
            setTimeout(() => {
              errorMessageElement.textContent = "";
            }, 3000);
          }
        }
      }
    );
  });

  // decryptTokens moved to auth.js

  try {
    chrome.storage.local.get((localResult) => {
      if (
        localResult.passwordCheckbox == false ||
        localResult.passwordCheckbox == undefined
      ) {
        authenticatorMainContent.style.display = "block";
        passwordPromptContainer.style.display = "none";
        let tokens = localResult.tokens || [];
        chrome.storage.local.get(["tokenOrder"], (orderRes) => {
          const order = orderRes.tokenOrder || [];
          const ordered = reorderTokensByOrderArray(tokens, order);
          ordered.forEach((tokenObj) => {
            addTokenToDOM(
              tokenObj.name,
              tokenObj.secret,
              tokenObj.url,
              tokenObj.otp
            );
          });
        });
      } else {
        authenticatorMainContent.style.display = "none";
        passwordPromptContainer.style.display = "block";
      }

      if (localResult.firstTime === undefined) {
        autofillCheckbox.checked = false;
        syncCheckbox.checked = false;
        clipboardCopyingCheckbox.checked = false;
        onlineTimeCheckbox.checked = false;
        advancedAddCheckbox.checked = false;
        passwordProtectedCheckbox.checked = false;
        popupModeCheckbox.checked = false;
        isTimeCheckboxChecked = false;
        hideTokenAdderCheckbox.checked = false;
        chrome.storage.local.set({
          tokens: [],
          autofillEnabled: false,
          syncEnabled: false,
          clipboardCopyingEnabled: false,
          onlineTimeEnabled: false,
          advancedAddEnabled: false,
          passwordCheckbox: false,
          popupModeCheckbox: false,
          firstTime: false,
          theme: "theme-light",
          uiScale: 1,
          hideTokenAdder: false,
        });
      } else {
        chrome.storage.local.set({ isPasswordVerified: false });
        autofillCheckbox.checked = localResult.autofillEnabled;
        syncCheckbox.checked = localResult.syncEnabled;
        const changeEvent = new Event("change");
        syncCheckbox.dispatchEvent(changeEvent);
        clipboardCopyingCheckbox.checked = localResult.clipboardCopyingEnabled;
        onlineTimeCheckbox.checked = localResult.onlineTimeEnabled;
        advancedAddCheckbox.checked = localResult.advancedAddEnabled;
        passwordProtectedCheckbox.checked = localResult.passwordCheckbox;
        popupModeCheckbox.checked = localResult.popupModeCheckbox;
        isTimeCheckboxChecked = localResult.onlineTimeEnabled;
        isPasswordCheckboxChecked = localResult.passwordCheckbox;
        hideTokenAdderCheckbox.checked = localResult.hideTokenAdder;

        if (hideTokenAdderCheckbox.checked) {
          formContainer.style.display = "none";
        }

        if (advancedAddCheckbox.checked) {
          advancedAddButton.className = "advanced-add-button";
          formContainer.appendChild(advancedAddButton);
          advancedAddButton.style.display = "block";
        } else {
          advancedAddButton.style.display = "none";
        }

        if (popupModeCheckbox.checked && !isPopup) {
          chrome.storage.local.get(["uiScale"], (res) => {
            const scale =
              typeof res.uiScale === "number" && res.uiScale > 0
                ? res.uiScale
                : 1;
            const BASE_W = 300,
              BASE_H = 450,
              CHROME_W = 14,
              CHROME_H = 30;
            chrome.windows.create(
              {
                url:
                  chrome.runtime.getURL("authenticator.html") +
                  "?isPopup=true",
                type: "popup",
                focused: true,
                width: Math.round(BASE_W * scale + CHROME_W),
                height: Math.round(BASE_H * scale + CHROME_H),
              },
              () => {
                // Close original action popup after new window is created
                try {
                  window.close();
                } catch (_) {}
              }
            );
          });
        }

        if (localResult.theme == "theme-light") {
          document.body.classList.remove("theme-dark");
          document.body.classList.add("theme-light");
          chrome.storage.local.set({ theme: "theme-light" });
        } else if (localResult.theme == "theme-dark") {
          document.body.classList.remove("theme-light");
          document.body.classList.add("theme-dark");
          chrome.storage.local.set({ theme: "theme-dark" });
        }
      }
    });
  } catch (error) {
    console.log(error);
  }

  // (moved) â€” toggles initialized below after token UI is created
  addTokenButton.addEventListener("click", () => {
    const name = nameInput.value.trim();
    let nameLength = false;
    if (name.length < 12) {
      nameLength = true;
    } else {
      createPopup(chrome.i18n.getMessage("name_too_long_message"));
      return;
    }

    const secret = secretInput.value.trim();
    if (name && nameLength && secret) {
      if (isValidBase32(secret)) {
        chrome.storage.local.get(
          ["tokens", "encryptionKeyInMemory"],
          async (result) => {
            let tokens = result.tokens || [];
            const nameExists = tokens.some(
              (tokenObj) => tokenObj.name === name
            );
            const secretExists = tokens.some(
              (tokenObj) => tokenObj.secret === secret
            );
            if (nameExists) {
              createPopup(
                chrome.i18n.getMessage("name_already_exists_message")
              );
            } else if (secretExists) {
              createPopup(
                chrome.i18n.getMessage("secret_already_added_message")
              );
            } else {
              try {
                const token = generateToken(secret);
                if (token) {
                  nameInput.value = "";
                  secretInput.value = "";
                  const otp = token;
                  const newTokenObj = {
                    name,
                    secret: secret,
                    url: "",
                    otp,
                  };
                  tokens.push(newTokenObj);
                   // update order to append new token if not present
                   chrome.storage.local.get(["tokenOrder"], (o) => {
                     const order = Array.isArray(o.tokenOrder) ? o.tokenOrder.slice() : [];
                     if (!order.includes(name)) order.push(name);
                     chrome.storage.local.set({ tokenOrder: order });
                     if (syncCheckbox.checked === true) {
                       chrome.storage.sync.set({ tokenOrder: order });
                     }
                   });
                   if (syncCheckbox.checked === true) {
                     chrome.storage.sync.set({ tokens }, () => {
                       while (tokensContainer.firstChild) {
                         tokensContainer.removeChild(tokensContainer.firstChild);
                       }
                       chrome.storage.local.get(["tokenOrder"], (orderRes) => {
                         const ordered = reorderTokensByOrderArray(tokens, orderRes.tokenOrder || []);
                         ordered.forEach((tokenObj) => {
                           addTokenToDOM(
                             tokenObj.name,
                             tokenObj.secret,
                             tokenObj.url,
                             tokenObj.otp
                           );
                         });
                       });
                     });
                   }
                  if (isPasswordCheckboxChecked === true) {
                    let cryptoKey = await convertKeyToCryptoKey(
                      result.encryptionKeyInMemory
                    );
                    const encryptedSecretObject = await encryptSecret(
                      secret,
                      cryptoKey
                    );
                    tokens = tokens.map((tokenObj) => {
                      if (tokenObj.name === name) {
                        return {
                          ...tokenObj,
                          secret: encryptedSecretObject.encryptedData,
                        };
                      }
                      return tokenObj;
                    });
                     chrome.storage.local.set({ tokens }, () => {
                       while (tokensContainer.firstChild) {
                         tokensContainer.removeChild(tokensContainer.firstChild);
                       }
                       chrome.storage.local.get(["tokenOrder"], (orderRes) => {
                         const ordered = reorderTokensByOrderArray(tokens, orderRes.tokenOrder || []);
                         ordered.forEach((tokenObj) => {
                           addTokenToDOM(
                             tokenObj.name,
                             secret,
                             tokenObj.url,
                             tokenObj.otp
                           );
                         });
                       });
                     });
                   } else {
                     chrome.storage.local.set({ tokens }, () => {
                       while (tokensContainer.firstChild) {
                         tokensContainer.removeChild(tokensContainer.firstChild);
                       }
                       chrome.storage.local.get(["tokenOrder"], (orderRes) => {
                         const ordered = reorderTokensByOrderArray(tokens, orderRes.tokenOrder || []);
                         ordered.forEach((tokenObj) => {
                           addTokenToDOM(
                             tokenObj.name,
                             tokenObj.secret,
                             tokenObj.url,
                             tokenObj.otp
                           );
                         });
                       });
                     });
                   }
                } else {
                  throw new Error("Invalid token generated.");
                }
              } catch (error) {
                console.log(error);
              }
            }
          }
        );
      } else {
        createPopup(chrome.i18n.getMessage("invalid_secret_message"));
      }
    } else {
      createPopup(chrome.i18n.getMessage("enter_name_and_secret_message"));
    }
  });

  let isCooldown = false;

  const passwordProtectedLabel = document.getElementById(
    "password-protected-label"
  );

  const checkboxMessagePassword = document.getElementById(
    "checkbox-message-password"
  );

  passwordProtectedLabel.addEventListener("mouseover", (event) => {
    event.stopPropagation();
    if (!passwordProtectedCheckbox.checked && syncCheckbox.checked) {
      checkboxMessagePassword.style.visibility = "visible";
    } else {
    }
  });

  passwordProtectedLabel.addEventListener("mouseout", (e) => {
    e.stopPropagation();
    checkboxMessagePassword.style.visibility = "hidden";
  });

  const syncCheckLabel = document.getElementById("sync-check-label");

  const checkboxMessageSync = document.getElementById("checkbox-message-sync");

  syncCheckLabel.addEventListener("mouseover", (event) => {
    event.stopPropagation();
    if (!syncCheckbox.checked && passwordProtectedCheckbox.checked) {
      checkboxMessageSync.style.visibility = "visible";
    } else {
    }
  });

  syncCheckLabel.addEventListener("mouseout", (e) => {
    e.stopPropagation();
    checkboxMessageSync.style.visibility = "hidden";
  });

  // passwordProtectedCheckbox already declared above

  passwordProtectedCheckbox.addEventListener("click", (e) => {
    e.preventDefault();
    function showAndHideWrongPasswordMessage() {
      const messageElements = document.getElementsByClassName(
        "wrong-or-nonmatch-passwords"
      );
      if (messageElements.length > 0) {
        const messageElement = messageElements[0];
        messageElement.style.visibility = "visible";
        setTimeout(() => {
          messageElement.style.visibility = "hidden";
        }, 3000);
      } else {
      }
    }
    if (syncCheckbox.checked) {
      passwordProtectedCheckbox.checked = false;
      return;
    }
    if (passwordProtectedCheckbox.checked) {
      if (document.querySelector(".popup-container")) {
        return;
      }
      let popupContainer = document.createElement("div");
      popupContainer.className = "popup-container";
      let popupContent = document.createElement("div");
      popupContent.className = "popup-content";
      while (popupContent.firstChild) {
        popupContent.removeChild(popupContent.firstChild);
      }
      const containerDiv = document.createElement("div");
      const heading = document.createElement("h2");
      heading.className = "centered-headings";
      heading.textContent = chrome.i18n.getMessage("password_protection_setup");
      containerDiv.appendChild(heading);

      const svgIcon = createXIcon({
        className: "feather x-icon",
        id: "x-icon",
        stroke: "red",
      });
      containerDiv.appendChild(svgIcon);
      const passDontMatchMessage = document.createElement("div");
      passDontMatchMessage.className = "wrong-or-nonmatch-passwords";
      passDontMatchMessage.id = "wrong-password-message";
      passDontMatchMessage.textContent = chrome.i18n.getMessage(
        "passwords_dont_match"
      );
      const formLabelContainer = document.createElement("div");
      formLabelContainer.className = "form-label-container";
      const passwordLabel = document.createElement("label");
      passwordLabel.className = "form-label";
      passwordLabel.setAttribute("for", "password");
      passwordLabel.textContent = chrome.i18n.getMessage("enter_password");
      formLabelContainer.appendChild(passwordLabel);
      passwordLabel.appendChild(passDontMatchMessage);
      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.id = "password";
      passwordInput.className = "form-input enter-url-placeholder";
      passwordInput.placeholder = "";
      formLabelContainer.appendChild(passwordInput);
      formLabelContainer.appendChild(document.createElement("br"));
      const passwordConfirmationLabel = document.createElement("label");
      passwordConfirmationLabel.className = "form-label";
      passwordConfirmationLabel.setAttribute("for", "password-confirmation");
      passwordConfirmationLabel.textContent =
        chrome.i18n.getMessage("confirm_password");

      formLabelContainer.appendChild(passwordConfirmationLabel);
      const passwordConfirmationInput = document.createElement("input");
      passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          protectionButton.click();
        }
      });
      passwordConfirmationInput.type = "password";
      passwordConfirmationInput.id = "password-confirmation";
      passwordConfirmationInput.className = "form-input enter-url-placeholder";
      passwordConfirmationInput.placeholder = "";
      formLabelContainer.appendChild(passwordConfirmationInput);
      const warningMessage = document.createElement("div");
      warningMessage.className = "password-warning-message";
      warningMessage.textContent = chrome.i18n.getMessage(
        "password_warning_message"
      );
      formLabelContainer.appendChild(warningMessage);
      containerDiv.appendChild(formLabelContainer);
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "form-label-container";
      const protectionButton = document.createElement("button");
      protectionButton.id = "password-protection-button";
      protectionButton.className = "wide-button";
      protectionButton.textContent = chrome.i18n.getMessage(
        "enable_password_protection"
      );

      buttonContainer.appendChild(protectionButton);
      containerDiv.appendChild(buttonContainer);
      popupContent.appendChild(containerDiv);
      popupContainer.appendChild(popupContent);
      document.body.appendChild(popupContainer);
      document.getElementById("x-icon").addEventListener("click", () => {
        document.body.removeChild(popupContainer);
      });
      popupContainer.addEventListener("click", (e) => {
        if (e.target === popupContainer) {
          document.body.removeChild(popupContainer);
        }
      });
      passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          protectionButton.click();
        }
        passwordConfirmationInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            protectionButton.click();
          }
        });
      });
      document;
      protectionButton.addEventListener("click", async () => {
        let passwordInput = document.getElementById("password").value;
        let passwordInputConfirmation = document.getElementById(
          "password-confirmation"
        ).value;
        if (passwordInput === passwordInputConfirmation) {
          let encryptionKeyAndSalt = await hashWithSalt(passwordInput);
          let derivedEncryptionKey = encryptionKeyAndSalt.derivedEncryptionKey;
          popupUpdate();
          chrome.storage.local.get(["tokens"], async (result) => {
            if (syncCheckbox.checked == true) {
            }
            let tokens = result.tokens || [];
            const encryptedTokens = [];
            for (let token of tokens) {
              const encryptedSecretObject = await encryptSecret(
                token.secret,
                derivedEncryptionKey
              );
              encryptedTokens.push({
                ...token,
                secret: encryptedSecretObject.encryptedData,
              });
            }
            passwordProtectedCheckbox.checked = true;
            isPasswordCheckboxChecked = true;
            syncCheckbox.checked = false;
            chrome.storage.local.set({
              tokens: encryptedTokens,
              passwordCheckbox: true,
            });
            try {
              document.body.removeChild(popupContainer);
            } catch (error) {
              console.log(error);
            }
          });
        } else {
          showAndHideWrongPasswordMessage();
        }
      });
    } else {
      if (document.querySelector(".popup-container")) {
        return;
      }
      let popupContainer = document.createElement("div");
      popupContainer.className = "popup-container";
      let popupContent = document.createElement("div");
      popupContent.className = "popup-content";
      const h2 = document.createElement("h2");
      h2.className = "centered-headings";
      h2.textContent = chrome.i18n.getMessage("disable_password_protection");

      popupContent.appendChild(h2);
      const svgIcon = createXIcon({
        className: "feather x-icon",
        id: "x-icon",
        stroke: "red",
      });
      const wrongPasswordMessage = document.createElement("div");
      wrongPasswordMessage.className = "wrong-or-nonmatch-passwords";
      wrongPasswordMessage.id = "wrong-remove-password-message";
      wrongPasswordMessage.textContent = chrome.i18n.getMessage(
        "incorrect_password_message"
      );

      popupContent.appendChild(svgIcon);
      const formLabelContainer = document.createElement("div");
      formLabelContainer.className = "form-label-container";
      const label = document.createElement("label");
      label.setAttribute("for", "password");
      label.className = "form-label";
      label.textContent = chrome.i18n.getMessage("enter_password");

      formLabelContainer.appendChild(label);
      label.appendChild(wrongPasswordMessage);
      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.id = "password";
      passwordInput.className = "form-input enter-url-placeholder";
      passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          removePasswordButton.click();
        }
      });
      formLabelContainer.appendChild(passwordInput);
      popupContent.appendChild(formLabelContainer);
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "form-label-container";
      const removePasswordButton = document.createElement("button");
      removePasswordButton.id = "remove-password-button";
      removePasswordButton.className = "wide-button";
      removePasswordButton.textContent =
        chrome.i18n.getMessage("remove_password");
      buttonContainer.appendChild(removePasswordButton);
      popupContent.appendChild(buttonContainer);
      popupContainer.appendChild(popupContent);
      document.body.appendChild(popupContainer);
      document.getElementById("x-icon").addEventListener("click", () => {
        document.body.removeChild(popupContainer);
      });

      popupContainer.addEventListener("click", (e) => {
        if (e.target === popupContainer) {
          document.body.removeChild(popupContainer);
        }
      });

      document
        .getElementById("remove-password-button")
        .addEventListener("click", async () => {
          try {
            let passwordInput = document.getElementById("password").value;
            const isValid = await verifyPassword(passwordInput);
            if (isValid) {
              document.body.removeChild(popupContainer);
              passwordProtectedCheckbox.checked = false;
              isPasswordCheckboxChecked = false;
              chrome.storage.local.set({ passwordCheckbox: false });

              chrome.storage.local.get(
                "encryptionKeyInMemory",
                async (result) => {
                  try {
                    let importedKey = await convertKeyToCryptoKey(
                      result.encryptionKeyInMemory
                    );
                    await decryptAllTokens(importedKey);
                  } catch (error) {
                    console.log(error);
                  }
                }
              );
            } else {
            }
          } catch (error) {
            showAndHideWrongPasswordMessage();
          }
        });
    }
  });

  // popup mode checkbox already declared above; resizer initialized earlier

  // popup mode click handled in settings module

  // hide token adder handled in settings module

  async function decryptAllTokens(importedKey) {
    chrome.storage.local.get(["tokens", "iv", "salt"], async (result) => {
      let tokens = result.tokens || [];
      const decryptedTokens = [];
      for (let token of tokens) {
        try {
          const decryptedSecret = await decryptSecret(
            token.secret,
            importedKey,
            result.iv
          );
          decryptedTokens.push({ ...token, secret: decryptedSecret });
        } catch (error) {
          console.log(error);
        }
      }
      chrome.storage.local.set({
        tokens: decryptedTokens,
        salt: "",
        iv: "",
        encryptedHashedPassword: "",
      });
      while (tokensContainer.firstChild) {
        tokensContainer.removeChild(tokensContainer.firstChild);
      }
      decryptedTokens.forEach((tokenObj) => {
        addTokenToDOM(
          tokenObj.name,
          tokenObj.secret,
          tokenObj.url,
          tokenObj.otp
        );
      });
      if (syncCheckbox.checked) {
        chrome.storage.sync.get(["tokens"], async (syncResult) => {
          let syncTokens = syncResult.tokens || [];
          for (let i = 0; i < syncTokens.length; i++) {
            const matchingToken = decryptedTokens.find(
              (token) => token.name === syncTokens[i].name
            );
            if (matchingToken) {
              syncTokens[i] = matchingToken;
            }
          }
          chrome.storage.sync.set({ tokens: syncTokens }, () => {});
        });
      }
    });
  }

  // Start time sync/clock updates
  try {
    initTimeSync({ updateToken });
  } catch (e) {
    console.log(e);
  }
  // updateToken moved into tokens.js (via createTokenUI)
});
