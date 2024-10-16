import { authenticator } from "otplib";
import { Buffer } from "buffer";
import QrScanner from "qr-scanner";
import QRCode from "qrcode";

window.Buffer = Buffer;

chrome.storage.local.set({
  isPasswordVerified: false,
});
document.addEventListener("DOMContentLoaded", () => {
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
  const autofillCheckbox = document.getElementById("autofill-checkbox");
  const syncCheckbox = document.getElementById("sync-checkbox");
  const clipboardCopyingCheckbox = document.getElementById(
    "clipboard-copying-checkbox"
  );
  const onlineTimeCheckbox = document.getElementById("online-time-checkbox");
  const advancedAddCheckbox = document.getElementById("advanced-add-checkbox");
  const passwordProtectedCheckbox = document.getElementById(
    "password-protected-checkbox"
  );
  advancedAddButton.className = "advanced-add-button";
  advancedAddButton.textContent = "Advanced Add";
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
  const passwordProtectedLabel = document.getElementById(
    "password-protected-label"
  );
  const checkboxMessagePassword = document.getElementById(
    "checkbox-message-password"
  );
  const syncCheckLabel = document.getElementById("sync-check-label");
  const checkboxMessageSync = document.getElementById("checkbox-message-sync");

  let isTimeCheckboxChecked;
  let isPasswordCheckboxChecked;
  nameInput.focus();

  //encryption & decryption related
  async function encryptSecret(secret, encryptionKey) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["salt", "iv"], async (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        let salt = result.salt;
        let iv = result.iv;
        if (!salt || !iv) {
          reject("Missing necessary values from storage.");
          return;
        }
        salt = new Uint8Array(
          salt.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
        );
        iv = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
        try {
          const encoder = new TextEncoder();
          const encodedSecret = encoder.encode(secret);
          const encryptedSecret = await crypto.subtle.encrypt(
            {
              name: "AES-GCM",
              iv: iv,
            },
            encryptionKey,
            encodedSecret
          );
          const encryptedBase64 = btoa(
            String.fromCharCode.apply(null, new Uint8Array(encryptedSecret))
          );
          resolve({
            encryptedData: encryptedBase64,
          });
        } catch (error) {
          console.log(error);
          reject(error);
        }
      });
    });
  }

  async function decryptSecret(encryptedData, encryptionKey, iv) {
    try {
      if (typeof iv === "string") {
        iv = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
      }
      if (typeof encryptedData === "string") {
        encryptedData = Uint8Array.from(atob(encryptedData), (c) =>
          c.charCodeAt(0)
        );
      }
      const decryptedSecretBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        encryptionKey,
        encryptedData
      );
      const decryptedSecret = new TextDecoder().decode(decryptedSecretBuffer);
      return decryptedSecret;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async function hashWithSalt(password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltString = Array.from(salt)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const encoder = new TextEncoder();
    const passwordWithSalt = encoder.encode(password + saltString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordWithSalt);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM IV
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const derivedEncryptionKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const jwkEncryptionKey = await crypto.subtle.exportKey(
      "jwk",
      derivedEncryptionKey
    );
    const encryptedHashedPassword = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      derivedEncryptionKey,
      encoder.encode(hashHex)
    );
    const encryptedBase64 = btoa(
      String.fromCharCode.apply(null, new Uint8Array(encryptedHashedPassword))
    );
    const ivBase64 = btoa(String.fromCharCode.apply(null, iv));
    chrome.storage.local.set({
      salt: saltString,
      iv: ivBase64,
      encryptedHashedPassword: encryptedBase64,
      encryptionKeyInMemory: jwkEncryptionKey,
      isPasswordVerified: true,
    });
    return {
      salt: saltString,
      derivedEncryptionKey: derivedEncryptionKey,
    };
  }
  async function convertKeyToCryptoKey(jwkKey) {
    try {
      const importedKey = await crypto.subtle.importKey(
        "jwk",
        jwkKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      return importedKey;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

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

  //themes related
  lightThemeButton.addEventListener("click", () => {
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
    chrome.storage.local.set({ theme: "theme-light" });
    if (syncCheckbox.checked) {
      chrome.storage.sync.set({ theme: "theme-light" });
    }
  });
  darkThemeButton.addEventListener("click", () => {
    document.body.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
    chrome.storage.local.set({ theme: "theme-dark" });
    if (syncCheckbox.checked) {
      chrome.storage.sync.set({ theme: "theme-dark" });
    }
  });

  //clock related
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

  function updateClock() {
    const timeApiUrl = "https://worldtimeapi.org/api/timezone/Etc/UTC";
    let initialTime;
    let offset = 0;

    if (isTimeCheckboxChecked) {
      getSecondsFromTimeApi().then((seconds) => startClock(seconds));
    } else {
      offset = 0;
      const seconds = getSecondsFromLocalTime();
      startClock(seconds);
    }

    function getSecondsFromTimeApi() {
      return fetch(timeApiUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          initialTime = new Date(data.datetime);
          offset = initialTime.getTime() - Date.now();
          return (
            initialTime.getSeconds() + initialTime.getMilliseconds() / 1000
          );
        });
    }

    function getSecondsFromLocalTime() {
      const now = new Date(Date.now() + offset);
      const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
      return seconds;
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

    function debounce(func, delay) {
      let debounceTimer;
      return function () {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
      };
    }
    const debouncedUpdateTokensAtInterval = debounce(
      updateTokensAtInterval,
      100
    );

    function startClock(initialSeconds) {
      function tick(seconds) {
        if (seconds === undefined) {
          seconds = getSecondsFromLocalTime();
        }
        updateClockWithSeconds(seconds);

        if (Math.floor(seconds) === 0 || Math.floor(seconds) === 30) {
          debouncedUpdateTokensAtInterval();
        }

        requestAnimationFrame(() => tick());
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
          } else {
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
    headerText.textContent = "Settings";
  });

  backButton.addEventListener("click", () => {
    settingsPage.style.display = "none";
    mainContent.style.display = "block";
    mainSettings.style.visibility = "visible";
    backButton.style.visibility = "hidden";
    headerText.textContent = "Authenticator Pro";
  });

  minimizeButton.addEventListener("click", () => {
    window.close();
  });

  function hexToText(hexString) {
    let result = "";
    for (let i = 0; i < hexString.length; i += 2) {
      result += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
    }
    return result;
  }

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
            errorMessageElement.textContent = "Incorrect Password";
            setTimeout(() => {
              errorMessageElement.textContent = "";
            }, 3000);
          }
        }
      }
    );
  });

  async function decryptTokens(encryptionKey) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["tokens", "iv"], async (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        }
        let tokens = result.tokens || [];
        const decryptedTokens = [];
        for (let token of tokens) {
          try {
            const decryptedSecret = await decryptSecret(
              token.secret,
              encryptionKey,
              result.iv
            );
            decryptedTokens.push({ ...token, secret: decryptedSecret });
          } catch (error) {
            console.log(error);
            reject(error);
          }
        }
        resolve(decryptedTokens);
      });
    });
  }

  try {
    chrome.storage.local.get((localResult) => {
      if (
        localResult.passwordCheckbox == false ||
        localResult.passwordCheckbox == undefined
      ) {
        authenticatorMainContent.style.display = "block";
        passwordPromptContainer.style.display = "none";
        let tokens = localResult.tokens || [];
        tokens.sort((a, b) => a.name.localeCompare(b.name));
        tokens.forEach((tokenObj) => {
          addTokenToDOM(
            tokenObj.name,
            tokenObj.secret,
            tokenObj.url,
            tokenObj.otp
          );
        });
      } else {
        authenticatorMainContent.style.display = "none";
        passwordPromptContainer.style.display = "block";
      }

      chrome.storage.sync.get((syncResult) => {
        if (localResult.firstTime === undefined) {
          // First time setup, initialize checkboxes and storage
          autofillCheckbox.checked = false;
          syncCheckbox.checked = syncResult.syncEnabled || false;
          clipboardCopyingCheckbox.checked = false;
          onlineTimeCheckbox.checked = syncResult.onlineTimeEnabled || false;
          advancedAddCheckbox.checked = false;
          passwordProtectedCheckbox.checked = false;
          // Setting `isTimeCheckboxChecked` and updating clock
          isTimeCheckboxChecked = syncResult.onlineTimeEnabled || false;
          updateClock();
          // Setting values in local and sync storage
          chrome.storage.local.set({
            tokens: syncResult.tokens || [],
            autofillEnabled: false,
            syncEnabled: syncResult.syncEnabled || false,
            clipboardCopyingEnabled: false,
            onlineTimeEnabled: syncResult.onlineTimeEnabled || false,
            advancedAddEnabled: syncResult.advancedAddEnabled || false,
            passwordCheckbox: false,
            firstTime: false,
            theme: syncResult.theme || "theme-light",
            // isPasswordVerified: false,
          });

          chrome.storage.sync.set({
            tokens: syncResult.tokens || localResult.tokens || [],
            syncEnabled:
              syncResult.syncEnabled || localResult.syncEnabled || true,
            onlineTimeEnabled:
              syncResult.onlineTimeEnabled ||
              localResult.onlineTimeEnabled ||
              true,
            advancedAddEnabled:
              syncResult.advancedAddEnabled ||
              localResult.advancedAddEnabled ||
              false,
            theme: syncResult.theme || "theme-light",
          });
        } else {
          chrome.storage.local.set({ isPasswordVerified: false });
          // Not the first time, synchronize state of passwordProtectedCheckbox
          autofillCheckbox.checked = localResult.autofillEnabled;
          syncCheckbox.checked = localResult.syncEnabled;
          // Dispatch change event to update UI elements accordingly
          const event = new Event("change");
          syncCheckbox.dispatchEvent(event);
          clipboardCopyingCheckbox.checked =
            localResult.clipboardCopyingEnabled;
          onlineTimeCheckbox.checked = localResult.onlineTimeEnabled;
          advancedAddCheckbox.checked = localResult.advancedAddEnabled;
          passwordProtectedCheckbox.checked = localResult.passwordCheckbox;
          // Update `isTimeCheckboxChecked` and update clock if necessary
          isTimeCheckboxChecked = localResult.onlineTimeEnabled;
          isPasswordCheckboxChecked = localResult.passwordCheckbox;
          updateClock();

          if (advancedAddCheckbox.checked) {
            advancedAddButton.className = "advanced-add-button";
            formContainer.appendChild(advancedAddButton);
            advancedAddButton.style.display = "block";
          } else {
            advancedAddButton.style.display = "none";
          }

          // Sync theme
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
    });
  } catch (error) {
    console.log(error);
  }

  autofillCheckbox.addEventListener("change", async () => {
    if (autofillCheckbox.checked) {
      document.getElementById("autofill-url-label");
      try {
        const granted = await requestAutofillPermission();
        if (granted) {
          chrome.storage.local.set({ autofillEnabled: true });
          popupUpdate();
        } else {
          autofillCheckbox.checked = false;
        }
      } catch (error) {
        console.log(error);
        autofillCheckbox.checked = false;
      }
    } else {
      chrome.storage.local.set({ autofillEnabled: false });
    }
  });

  async function requestAutofillPermission() {
    return new Promise((resolve) => {
      chrome.permissions.request(
        {
          origins: ["http://*/*", "https://*/*"],
        },
        (granted) => {
          resolve(granted);
        }
      );
    });
  }

  syncCheckbox.addEventListener("change", (e) => {
    if (passwordProtectedCheckbox.checked) {
      e.preventDefault();
      syncCheckbox.checked = false;
      return;
    }
    try {
      if (syncCheckbox.checked) {
        chrome.storage.local.get(["tokens"], (localResult) => {
          chrome.storage.sync.get(["tokens"], (syncResult) => {
            let localTokens = Array.isArray(localResult.tokens)
              ? localResult.tokens
              : [];
            let syncTokens = Array.isArray(syncResult.tokens)
              ? syncResult.tokens
              : [];
            localTokens.forEach((localToken) => {
              const match = syncTokens.find(
                (syncToken) =>
                  syncToken.name === localToken.name &&
                  syncToken.secret === localToken.secret
              );
              if (!match) {
                syncTokens.push(localToken);
              }
            });

            // Save consolidated tokens to sync storage and local storage
            chrome.storage.sync.set({ tokens: syncTokens }, () => {
              chrome.storage.local.set({ tokens: syncTokens }, () => {
                syncTokens.forEach((tokenObj) => {
                  if (!document.getElementById(`token-${tokenObj.name}`)) {
                    addTokenToDOM(
                      tokenObj.name,
                      tokenObj.secret,
                      tokenObj.url,
                      tokenObj.otp
                    );
                  }
                });
              });
            });
          });
        });
      } else {
      }
      chrome.storage.local.set({ syncEnabled: syncCheckbox.checked });
      chrome.storage.sync.set({ syncEnabled: syncCheckbox.checked });
    } catch (error) {
      console.log(error);
    }
  });

  clipboardCopyingCheckbox.addEventListener("change", async () => {
    if (clipboardCopyingCheckbox.checked) {
      try {
        const granted = await requestClipboardPermission();
        if (granted) {
          chrome.storage.local.set({ clipboardCopyingEnabled: true });
          chrome.storage.sync.set({ clipboardCopyingEnabled: true });
        } else {
          clipboardCopyingCheckbox.checked = false;
        }
      } catch (error) {
        console.log(error);
        clipboardCopyingCheckbox.checked = false;
      }
    } else {
      chrome.storage.local.set({ clipboardCopyingEnabled: false });
      chrome.storage.sync.set({ clipboardCopyingEnabled: false });
    }
  });

  async function requestClipboardPermission() {
    return new Promise((resolve) => {
      chrome.permissions.request(
        {
          permissions: ["clipboardWrite"],
        },
        (granted) => {
          resolve(granted);
        }
      );
    });
  }

  onlineTimeCheckbox.addEventListener("change", () => {
    try {
      chrome.storage.local.set({
        onlineTimeEnabled: onlineTimeCheckbox.checked,
      });
      chrome.storage.sync.set({
        onlineTimeEnabled: onlineTimeCheckbox.checked,
      });
    } catch (error) {
      console.log(error);
    }
  });

  advancedAddCheckbox.addEventListener("change", () => {
    if (advancedAddCheckbox.checked) {
      advancedAddButton.className = "advanced-add-button";
      formContainer.appendChild(advancedAddButton);
      advancedAddButton.style.display = "block";
    } else {
      advancedAddButton.style.display = "none";
    }
    try {
      chrome.storage.local.set({
        advancedAddEnabled: advancedAddCheckbox.checked,
      });
      chrome.storage.sync.set({
        advancedAddEnabled: advancedAddCheckbox.checked,
      });
    } catch (error) {
      console.log(error);
    }
  });

  addTokenButton.addEventListener("click", () => {
    const name = nameInput.value.trim();
    let nameLength = false;
    if (name.length < 12) {
      nameLength = true;
    } else {
      createPopup("Name too long, please input a shorter name");
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
              createPopup("A token with this name already exists.");
            } else if (secretExists) {
              createPopup("You've already added this secret.");
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
                  tokens.sort((a, b) => a.name.localeCompare(b.name));
                  if (syncCheckbox.checked === true) {
                    chrome.storage.sync.set({ tokens }, () => {
                      while (tokensContainer.firstChild) {
                        tokensContainer.removeChild(tokensContainer.firstChild);
                      }
                      tokens.forEach((tokenObj) => {
                        addTokenToDOM(
                          tokenObj.name,
                          tokenObj.secret,
                          tokenObj.url,
                          tokenObj.otp
                        );
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
                      tokens.forEach((tokenObj) => {
                        addTokenToDOM(
                          tokenObj.name,
                          secret,
                          tokenObj.url,
                          tokenObj.otp
                        );
                      });
                    });
                  } else {
                    chrome.storage.local.set({ tokens }, () => {
                      while (tokensContainer.firstChild) {
                        tokensContainer.removeChild(tokensContainer.firstChild);
                      }
                      tokens.forEach((tokenObj) => {
                        addTokenToDOM(
                          tokenObj.name,
                          tokenObj.secret,
                          tokenObj.url,
                          tokenObj.otp
                        );
                      });
                    });
                  }
                } else {
                  throw new Error("Invalid token generated.");
                }
              } catch (error) {
                createPopup("Invalid Input");
              }
            }
          }
        );
      } else {
        createPopup("Invalid secret. Please enter a Base32 encoded string.");
      }
    } else {
      createPopup("Please enter both name and secret.");
    }
  });

  let isCooldown = false;

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
      heading.textContent = "Password Protection Setup";
      containerDiv.appendChild(heading);

      const svgIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      svgIcon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgIcon.setAttribute("width", "24");
      svgIcon.setAttribute("height", "24");
      svgIcon.setAttribute("viewBox", "0 0 24 24");
      svgIcon.setAttribute("fill", "none");
      svgIcon.setAttribute("stroke", "red");
      svgIcon.setAttribute("stroke-width", "2");
      svgIcon.setAttribute("stroke-linecap", "round");
      svgIcon.setAttribute("stroke-linejoin", "round");
      svgIcon.classList.add("feather", "x-icon");
      svgIcon.id = "x-icon";

      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "10");
      svgIcon.appendChild(circle);

      const line1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line1.setAttribute("x1", "15");
      line1.setAttribute("y1", "9");
      line1.setAttribute("x2", "9");
      line1.setAttribute("y2", "15");
      svgIcon.appendChild(line1);

      const line2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line2.setAttribute("x1", "9");
      line2.setAttribute("y1", "9");
      line2.setAttribute("x2", "15");
      line2.setAttribute("y2", "15");
      svgIcon.appendChild(line2);
      containerDiv.appendChild(svgIcon);
      const passDontMatchMessage = document.createElement("div");
      passDontMatchMessage.className = "wrong-or-nonmatch-passwords";
      passDontMatchMessage.id = "wrong-password-message";
      passDontMatchMessage.textContent = "Passwords Don't Match";
      const formLabelContainer = document.createElement("div");
      formLabelContainer.className = "form-label-container";
      const passwordLabel = document.createElement("label");
      passwordLabel.className = "form-label";
      passwordLabel.setAttribute("for", "password");
      passwordLabel.textContent = "Enter Password:";
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
      passwordConfirmationLabel.textContent = "Confirm Password:";
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
      warningMessage.textContent =
        "WARNING: If the password is forgotten, it cannot be recovered.";
      formLabelContainer.appendChild(warningMessage);
      containerDiv.appendChild(formLabelContainer);
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "form-label-container";
      const protectionButton = document.createElement("button");
      protectionButton.id = "password-protection-button";
      protectionButton.className = "wide-button";
      protectionButton.textContent = "Enable Password Protection";
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
      h2.textContent = "Password Protection Verification";
      popupContent.appendChild(h2);
      const svgIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      svgIcon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgIcon.setAttribute("width", "24");
      svgIcon.setAttribute("height", "24");
      svgIcon.setAttribute("viewBox", "0 0 24 24");
      svgIcon.setAttribute("fill", "none");
      svgIcon.setAttribute("stroke", "red");
      svgIcon.setAttribute("stroke-width", "2");
      svgIcon.setAttribute("stroke-linecap", "round");
      svgIcon.setAttribute("stroke-linejoin", "round");
      svgIcon.classList.add("feather", "x-icon");
      svgIcon.id = "x-icon";
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "10");

      const line1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line1.setAttribute("x1", "15");
      line1.setAttribute("y1", "9");
      line1.setAttribute("x2", "9");
      line1.setAttribute("y2", "15");

      const line2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line2.setAttribute("x1", "9");
      line2.setAttribute("y1", "9");
      line2.setAttribute("x2", "15");
      line2.setAttribute("y2", "15");
      svgIcon.appendChild(circle);
      svgIcon.appendChild(line1);
      svgIcon.appendChild(line2);
      const wrongPasswordMessage = document.createElement("div");
      wrongPasswordMessage.className = "wrong-or-nonmatch-passwords";
      wrongPasswordMessage.id = "wrong-remove-password-message";
      wrongPasswordMessage.textContent = "Wrong Password";
      popupContent.appendChild(svgIcon);
      const formLabelContainer = document.createElement("div");
      formLabelContainer.className = "form-label-container";
      const label = document.createElement("label");
      label.setAttribute("for", "password");
      label.className = "form-label";
      label.textContent = "Enter Password:";
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
      removePasswordButton.textContent = "Remove Password";
      buttonContainer.appendChild(removePasswordButton);
      popupContent.appendChild(buttonContainer);
      popupContainer.appendChild(popupContent);
      document.body.appendChild(popupContainer);
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

  async function verifyPassword(passInput) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        ["salt", "iv", "encryptedHashedPassword"],
        async (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          const storedSalt = result.salt;
          const storedIV = result.iv;
          const storedEncryptedHash = result.encryptedHashedPassword;

          if (!storedSalt || !storedIV || !storedEncryptedHash) {
            reject("Salt, IV, or encrypted hashed password not found.");
            return;
          }

          try {
            const ivArray = Uint8Array.from(atob(storedIV), (c) =>
              c.charCodeAt(0)
            );
            const encryptedHashArray = Uint8Array.from(
              atob(storedEncryptedHash),
              (c) => c.charCodeAt(0)
            );

            const encoder = new TextEncoder();
            const saltedPassword = encoder.encode(passInput + storedSalt);
            const hashedInputBuffer = await crypto.subtle.digest(
              "SHA-256",
              saltedPassword
            );
            const hashedInputHex = Array.from(new Uint8Array(hashedInputBuffer))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            const keyMaterial = await crypto.subtle.importKey(
              "raw",
              encoder.encode(passInput),
              "PBKDF2",
              false,
              ["deriveKey"]
            );

            const derivedKey = await crypto.subtle.deriveKey(
              {
                name: "PBKDF2",
                salt: new Uint8Array(
                  storedSalt.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
                ),
                iterations: 100000,
                hash: "SHA-256",
              },
              keyMaterial,
              { name: "AES-GCM", length: 256 },
              false,
              ["decrypt"]
            );
            const decryptedHashedPasswordBuffer = await crypto.subtle.decrypt(
              {
                name: "AES-GCM",
                iv: ivArray,
              },
              derivedKey,
              encryptedHashArray
            );
            const decryptedHashedPasswordHex = Array.from(
              new Uint8Array(decryptedHashedPasswordBuffer)
            )
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            let hexToTextVal = hexToText(decryptedHashedPasswordHex);
            if (hashedInputHex === hexToTextVal) {
              resolve(true);
            } else {
              resolve(false);
            }
          } catch (error) {
            console.log(error);
            reject(error);
          }
        }
      );
    });
  }

  function setAdvancedAddMessage(text, visible) {
    const videoMessages = document.getElementById("advanced-add-messages");
    if (videoMessages) {
      videoMessages.textContent = text;
      videoMessages.style.visibility = visible ? "visible" : "hidden";
    }
  }

  advancedAddButton.addEventListener("click", () => {
    if (document.querySelector(".popup-container") || isCooldown) {
      return;
    }
    let popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    let popupContent = document.createElement("div");
    popupContent.className = "popup-video-content";
    let webcamOffIcon = document.createElement("img");
    webcamOffIcon.src = "./icons/video-off.svg";
    webcamOffIcon.className = "webcam-off-icon";
    webcamOffIcon.id = "webcam-off-icon";
    let webcamOnIcon = document.createElement("img");
    webcamOnIcon.src = "./icons/video.svg";
    webcamOnIcon.className = "webcam-on-icon";
    webcamOnIcon.id = "webcam-on-icon";
    let imageIcon = document.createElement("img");
    imageIcon.src = "./icons/image.svg";
    imageIcon.className = "image-icon";
    imageIcon.id = "image-icon";
    let headerDiv = document.createElement("div");
    let heading = document.createElement("h2");
    heading.className = "centered-headings";
    heading.textContent = "Add QR Code Via:";
    headerDiv.appendChild(heading);
    let errorMessage = document.createElement("h3");
    errorMessage.className = "advanced-add-messages";
    errorMessage.id = "advanced-add-messages";
    errorMessage.style.visibility = "hidden";
    errorMessage.textContent = "QR Code not found. Try a different image.";
    headerDiv.appendChild(errorMessage);
    let svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgIcon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgIcon.setAttribute("width", "24");
    svgIcon.setAttribute("height", "24");
    svgIcon.setAttribute("viewBox", "0 0 24 24");
    svgIcon.setAttribute("fill", "none");
    svgIcon.setAttribute("stroke", "red");
    svgIcon.setAttribute("stroke-width", "2");
    svgIcon.setAttribute("stroke-linecap", "round");
    svgIcon.setAttribute("stroke-linejoin", "round");
    svgIcon.classList.add("feather", "x-icon");
    svgIcon.id = "x-icon";

    let circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "10");
    svgIcon.appendChild(circle);
    let line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line1.setAttribute("x1", "15");
    line1.setAttribute("y1", "9");
    line1.setAttribute("x2", "9");
    line1.setAttribute("y2", "15");
    svgIcon.appendChild(line1);
    let line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line2.setAttribute("x1", "9");
    line2.setAttribute("y1", "9");
    line2.setAttribute("x2", "15");
    line2.setAttribute("y2", "15");
    svgIcon.appendChild(line2);
    headerDiv.appendChild(svgIcon);
    popupContent.appendChild(headerDiv);
    let videoContainer = document.createElement("div");
    videoContainer.className = "video-container";
    videoContainer.style.display = "none";
    let videoElement = document.createElement("video");
    videoElement.id = "video";
    videoElement.setAttribute("autoplay", "");
    videoElement.setAttribute("playsinline", "");
    videoElement.style.width = "100%";
    videoContainer.appendChild(videoElement);
    popupContent.appendChild(videoContainer);
    let buttonsContainer = document.createElement("div");
    buttonsContainer.className = "buttons-container";
    const webcamButton = document.createElement("button");
    webcamButton.className = "webcam-add-button";
    webcamButton.id = "webcam-add-button";
    webcamButton.textContent = "Webcam";
    const imageButton = document.createElement("button");
    imageButton.className = "image-add-button";
    imageButton.id = "image-add-button";
    imageButton.textContent = "Image";
    buttonsContainer.appendChild(webcamButton);
    buttonsContainer.appendChild(imageButton);
    popupContent.appendChild(buttonsContainer);
    let formLabelContainer = document.createElement("div");
    formLabelContainer.className = "form-label-container";
    let label = document.createElement("label");
    label.setAttribute("for", "name");
    label.className = "form-label";
    label.textContent = "Image URL:";
    let imageUrlInput = document.createElement("input");
    imageUrlInput.type = "text";
    imageUrlInput.id = "image-url-input";
    imageUrlInput.className = "form-input enter-url-placeholder";
    imageUrlInput.setAttribute("placeholder", "https://...");
    imageUrlInput.value = "";
    let urlButton = document.createElement("button");
    urlButton.id = "add-url-button";
    urlButton.className = "wide-button";
    urlButton.textContent = "Enter URL";
    formLabelContainer.appendChild(label);
    formLabelContainer.appendChild(imageUrlInput);
    formLabelContainer.appendChild(urlButton);
    popupContent.appendChild(formLabelContainer);
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);
    webcamButton.appendChild(webcamOnIcon);
    const fileAddButton = document.getElementById("image-add-button");
    fileAddButton.appendChild(imageIcon);
    let qrCodeFoundMessage = document.createElement("div");
    qrCodeFoundMessage.className = "secret-found-message";
    qrCodeFoundMessage.textContent = "QR code found!";

    function qrCodeFound() {
      secretFormLabel.insertAdjacentElement("afterend", qrCodeFoundMessage);
      setTimeout(() => {
        qrCodeFoundMessage.remove();
      }, 3000);
    }

    let stream;
    let qrScanner;

    const stopCameraAndScanner = () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      setAdvancedAddMessage("QR Code not found. Try a different image.", false);
    };

    let saveUrlButton = document.getElementById("add-url-button");

    function saveImageUrl() {
      let addImageUrl = imageUrlInput.value;

      QrScanner.scanImage(addImageUrl, { returnDetailedScanResult: true })
        .then((result) => {
          const decodedData = result.data;

          secretInput.value = decodedData;
          qrCodeFound();
          document.body.removeChild(popupContainer);
        })
        .catch((error) => {
          setAdvancedAddMessage(
            "Incorrect URL, or URL did not contain QR code.",
            true
          );
          setTimeout(() => {
            setAdvancedAddMessage(
              "QR Code not found. Try a different image.",
              false
            );
          }, 3000);
        });
    }

    saveUrlButton.addEventListener("click", saveImageUrl);

    imageUrlInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        saveImageUrl();
      }
    });

    let redXButton = document.getElementById("x-icon");
    redXButton.addEventListener("click", () => {
      stopCameraAndScanner();
      document.body.removeChild(popupContainer);
      isCooldown = true;
      setTimeout(() => {
        isCooldown = false;
      }, 2000);
    });

    popupContainer.addEventListener("click", (e) => {
      if (e.target === popupContainer) {
        setTimeout(() => {
          stopCameraAndScanner();
        }, 1000);

        document.body.removeChild(popupContainer);
        isCooldown = true;
        setTimeout(() => {
          isCooldown = false;
        }, 2000);
      }
    });

    document.addEventListener("click", () => {
      if (!document.querySelector(".popup-container")) {
        stopCameraAndScanner();
      }
    });

    webcamButton.addEventListener("click", async () => {
      if (isCooldown) {
        return;
      }

      try {
        const videoElem = document.getElementById("video");

        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          stream = null;
          videoElem.pause();
          document.querySelector(".video-container").style.display = "none";
          webcamButton.textContent = "Webcam";
          webcamButton.appendChild(webcamOnIcon);
          setAdvancedAddMessage(
            "QR Code not found. Try a different image.",
            false
          );
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });

          videoElem.srcObject = stream;
          document.querySelector(".video-container").style.display = "block";

          webcamButton.textContent = "Webcam";

          webcamButton.appendChild(webcamOffIcon);

          setAdvancedAddMessage("Scanning...", true);

          qrScanner = new QrScanner(
            videoElem,
            (result) => {
              if (result.data) {
                qrCodeFound();

                secretInput.value = result.data;
                stream.getTracks().forEach((track) => track.stop());
                stream = null;
                videoElem.pause();
                document.querySelector(".video-container").style.display =
                  "none";
                document.body.removeChild(popupContainer);
                nameInput.focus();
                setAdvancedAddMessage(
                  "QR Code not found. Try a different image.",
                  false
                );
              } else {
              }
            },
            { returnDetailedScanResult: true }
          );

          qrScanner.start();
        }
      } catch (error) {
        console.log(error);
        const optionsUrl = chrome.runtime.getURL("options.html");
        if (document.querySelector(".popup-video-content")) {
          window.open(optionsUrl);
        }
      }

      isCooldown = true;
      setTimeout(() => {
        isCooldown = false;
      }, 2000);
    });

    document
      .getElementById("image-add-button")
      .addEventListener("click", () => {
        setTimeout(() => {
          stopCameraAndScanner();
          document.querySelector(".video-container").style.display = "none";
        }, 1500);
        document.getElementById("file-input").click();
      });

    document
      .getElementById("file-input")
      .addEventListener("change", async (e) => {
        const file = e.target.files[0];

        if (file) {
          try {
            const result = await QrScanner.scanImage(file, {
              returnDetailedScanResult: true,
            });
            const data = decodeURIComponent(result.data);
            const secretMatch = data.match(/secret=([^&]+)/);
            const issuerMatch = data.match(/issuer=([^&]+)/);
            const labelMatch = data.match(/totp\/([^:?]+)/);

            if (secretMatch) {
              secretInput.value = secretMatch[1];
            } else {
              secretInput.value = data;
            }

            if (issuerMatch) {
              nameInput.value = issuerMatch[1];
            } else if (labelMatch) {
              nameInput.value = labelMatch[1];
            } else {
              nameInput.value = "";
            }
            document.body.removeChild(popupContainer);
            qrCodeFound();
            isCooldown = true;
            setTimeout(() => {
              isCooldown = false;
            }, 2000);
            nameInput.focus();
          } catch (error) {
            setAdvancedAddMessage(
              "QR Code not found. Try a different image.",
              true
            );

            setTimeout(() => {
              setAdvancedAddMessage(
                "QR Code not found. Try a different image.",
                false
              );
            }, 3000);
          }

          e.target.value = "";
        }
      });
  });

  function createPopup(message) {
    if (document.querySelector(".popup-container")) {
      return;
    }
    const popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    const popupContent = document.createElement("div");
    popupContent.className = "popup-message";
    const svgIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    svgIcon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgIcon.setAttribute("width", "24");
    svgIcon.setAttribute("height", "24");
    svgIcon.setAttribute("viewBox", "0 0 24 24");
    svgIcon.setAttribute("fill", "none");
    svgIcon.setAttribute("stroke", "red");
    svgIcon.setAttribute("stroke-width", "2");
    svgIcon.setAttribute("stroke-linecap", "round");
    svgIcon.setAttribute("stroke-linejoin", "round");
    svgIcon.classList.add("feather", "x-icon");
    svgIcon.id = "x-icon";

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "10");
    svgIcon.appendChild(circle);

    const line1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    line1.setAttribute("x1", "15");
    line1.setAttribute("y1", "9");
    line1.setAttribute("x2", "9");
    line1.setAttribute("y2", "15");
    svgIcon.appendChild(line1);

    const line2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    line2.setAttribute("x1", "9");
    line2.setAttribute("y1", "9");
    line2.setAttribute("x2", "15");
    line2.setAttribute("y2", "15");
    svgIcon.appendChild(line2);
    const headerDiv = document.createElement("div");
    headerDiv.appendChild(svgIcon);
    const messageHeading = document.createElement("h3");
    messageHeading.className = "centered-headings shorter-width-heading";
    messageHeading.textContent = message;
    const closeButtonContainer = document.createElement("div");
    closeButtonContainer.className = "close-popup-container";
    const closeButton = document.createElement("button");
    closeButton.className = "close-popup";
    closeButton.textContent = "Close";
    closeButtonContainer.appendChild(closeButton);
    popupContent.appendChild(headerDiv);
    popupContent.appendChild(messageHeading);
    popupContent.appendChild(closeButtonContainer);
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);
    closeButton.addEventListener("click", () => {
      document.body.removeChild(popupContainer);
    });
    svgIcon.addEventListener("click", () => {
      document.body.removeChild(popupContainer);
    });
  }
  function isValidBase32(secret) {
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(secret);
  }
  function generateToken(secret) {
    if (isValidBase32(secret)) {
      return authenticator.generate(secret);
    } else {
      return false;
    }
  }
  function addTokenToDOM(name, secret, url, otp) {
    const tokenElement = document.createElement("div");
    tokenElement.id = `token-${name}`;
    tokenElement.classList.add("token-box");
    const nameHeader = document.createElement("h2");
    nameHeader.className = "token-name";
    nameHeader.textContent = `${name}`;
    const tokenHeader = document.createElement("h1");
    tokenHeader.className = "token-value";

    fetch("./icons/gearIcon.svg")
      .then((response) => response.text())
      .then((svgText) => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
        let tokenSettings = svgDoc.documentElement;

        tokenSettings.setAttribute(
          "class",
          "feather feather-settings token-settings"
        );
        tokenSettings.setAttribute("id", name + "-token-settings");

        tokenElement.appendChild(tokenSettings);

        tokenSettings.addEventListener("click", (e) => {
          e.stopPropagation();
          chrome.storage.local.get(["tokens"], (result) => {
            let tokens = result.tokens || [];
            const tokenObj = tokens.find((token) => token.name === name);
            if (tokenObj) {
              const { url } = tokenObj;
              let shortenedUrl = url || "";
              let urlLength = 50;
              if (url.length > urlLength) {
                shortenedUrl = url.substring(0, urlLength) + "...";
              }
              let popupContainer = document.createElement("div");
              popupContainer.className = "popup-container";
              let popupContent = document.createElement("div");
              popupContent.className = "popup-content";
              popupContent.textContent = "";
              const headerDiv = document.createElement("div");
              headerDiv.className = "centered-header";
              const headerText = document.createElement("h2");
              headerText.className = "centered-headings shorter-width-heading";
              headerText.textContent = `${name} Token Settings`;
              headerDiv.appendChild(headerText);
              const svgIcon = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
              );
              svgIcon.setAttribute("width", "24");
              svgIcon.setAttribute("height", "24");
              svgIcon.setAttribute("viewBox", "0 0 24 24");
              svgIcon.setAttribute("fill", "none");
              svgIcon.setAttribute("stroke", "red");
              svgIcon.setAttribute("stroke-width", "2");
              svgIcon.setAttribute("stroke-linecap", "round");
              svgIcon.setAttribute("stroke-linejoin", "round");
              svgIcon.classList.add("feather", "x-icon");
              svgIcon.id = "x-icon";

              const circle = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "circle"
              );
              circle.setAttribute("cx", "12");
              circle.setAttribute("cy", "12");
              circle.setAttribute("r", "10");
              svgIcon.appendChild(circle);

              const line1 = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
              );
              line1.setAttribute("x1", "15");
              line1.setAttribute("y1", "9");
              line1.setAttribute("x2", "9");
              line1.setAttribute("y2", "15");
              svgIcon.appendChild(line1);

              const line2 = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
              );
              line2.setAttribute("x1", "9");
              line2.setAttribute("y1", "9");
              line2.setAttribute("x2", "15");
              line2.setAttribute("y2", "15");
              svgIcon.appendChild(line2);
              headerDiv.appendChild(svgIcon);
              popupContent.appendChild(headerDiv);
              const label = document.createElement("label");
              label.setAttribute("for", "name");
              label.className = "form-label";
              label.id = "autofill-url-label";
              if (autofillCheckbox.checked) {
                label.textContent = "Autofill URL:";
              } else {
                label.textContent = "Autofill URL: (Not Enabled)";
              }
              popupContent.appendChild(label);
              const urlInput = document.createElement("input");
              urlInput.type = "text";
              urlInput.id = "autofill-url-input";
              urlInput.className = "form-input enter-url-placeholder";
              urlInput.placeholder = "Enter URL";
              urlInput.disabled = !autofillCheckbox.checked;
              autofillCheckbox.addEventListener("change", function () {
                if (autofillCheckbox.checked) {
                  urlInput.disabled = false;
                } else {
                  urlInput.disabled = true;
                }
              });

              popupContent.appendChild(urlInput);
              let saveUrlButton = document.createElement("button");
              saveUrlButton.id = "save-url-button";
              saveUrlButton.className = "wide-button";
              saveUrlButton.textContent = "Save URL";
              popupContent.appendChild(saveUrlButton);
              const inlineUrlDiv = document.createElement("div");
              inlineUrlDiv.className = "inline-url";
              const inlineLabel = document.createElement("label");
              inlineLabel.className = "form-label";
              inlineLabel.textContent = "Currently Saved:";
              inlineUrlDiv.appendChild(inlineLabel);
              const currentUrlDiv = document.createElement("div");
              currentUrlDiv.id = "current-url";
              currentUrlDiv.className = "form-label";
              if (!autofillCheckbox.checked) {
                currentUrlDiv.textContent = "";
              } else {
                currentUrlDiv.textContent = shortenedUrl;
              }
              inlineUrlDiv.appendChild(currentUrlDiv);
              popupContent.appendChild(inlineUrlDiv);
              const buttonsContainer = document.createElement("div");
              buttonsContainer.className = "buttons-container";
              const deleteButton = document.createElement("button");
              deleteButton.className = "delete-token";
              deleteButton.id = "delete-token";
              deleteButton.textContent = "Delete";
              buttonsContainer.appendChild(deleteButton);
              const closeButton = document.createElement("button");
              closeButton.className = "close-popup";
              closeButton.textContent = "Close";
              buttonsContainer.appendChild(closeButton);
              popupContent.appendChild(buttonsContainer);
              popupContainer.appendChild(popupContent);
              document.body.appendChild(popupContainer);
              let redXButton = document.getElementById("x-icon");
              redXButton.addEventListener("click", () => {
                document.body.removeChild(popupContainer);
              });
              let autofillUrlInput =
                document.getElementById("autofill-url-input");
              autofillUrlInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                  saveUrlButton.click();
                }
              });
              saveUrlButton.addEventListener("click", () => {
                const newUrl = document
                  .getElementById("autofill-url-input")
                  .value.trim();
                if (!newUrl) {
                  return;
                }
                chrome.storage.local.get(["tokens"], (result) => {
                  let tokens = result.tokens || [];
                  const tokenIndex = tokens.findIndex(
                    (tokenObj) => tokenObj.name === name
                  );
                  if (tokenIndex !== -1) {
                    tokens[tokenIndex].url = newUrl;
                    const saveToLocal = () => {
                      chrome.storage.local.set({ tokens }, () => {});
                    };
                    const saveToSync = () => {
                      chrome.storage.sync.set({ tokens }, () => {});
                    };
                    saveToLocal();
                    if (syncCheckbox.checked) {
                      saveToSync();
                    }
                    const displayUrl =
                      newUrl.length > urlLength
                        ? newUrl.substring(0, urlLength) + "..."
                        : newUrl;
                    document.getElementById("current-url").textContent =
                      displayUrl;
                  }
                });
              });
              popupContent
                .querySelector(".close-popup")
                .addEventListener("click", () => {
                  document.body.removeChild(popupContainer);
                });
              popupContainer.addEventListener("click", (e) => {
                if (e.target === popupContainer) {
                  document.body.removeChild(popupContainer);
                }
              });
              popupContent
                .querySelector("#delete-token")
                .addEventListener("click", () => {
                  confirmDelete(name, secret);
                  document.body.removeChild(popupContainer);
                });
            }
          });
        });
      })
      .catch((error) => {});

    fetch("./icons/clipboard.svg")
      .then((response) => response.text())
      .then((svgText) => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
        let tokenCopy = svgDoc.documentElement;
        tokenCopy.setAttribute("class", "feather feather-clipboard token-copy");
        tokenCopy.setAttribute("id", name + "-token-copy");
        tokenElement.appendChild(tokenCopy);
      })
      .catch((error) => {});

    const tokenQRButton = document.createElement("img");
    tokenQRButton.src = "./icons/tiny-qr.svg";
    tokenQRButton.className = "token-qr-button";
    tokenQRButton.id = name + "-token-qr-button";
    tokenElement.appendChild(tokenQRButton);
    tokenQRButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        let popupContainer = document.createElement("div");
        popupContainer.className = "popup-container";
        let popupContent = document.createElement("div");
        popupContent.className = "popup-content-qr";
        let qrDataURL;
        try {
          qrDataURL = await QRCode.toDataURL(secret, { width: 140 });
        } catch (error) {
          console.log(error);
          return;
        }
        popupContent.textContent = "";
        const qrContainer = document.createElement("div");
        const secretHeader = document.createElement("h2");
        secretHeader.className = "centered-headings shorter-width-heading";
        secretHeader.textContent = `${name} Secret:`;
        qrContainer.appendChild(secretHeader);
        const secretValue = document.createElement("h3");
        secretValue.className = "centered-secret shorter-width-heading";
        secretValue.textContent = secret;
        qrContainer.appendChild(secretValue);
        const qrImage = document.createElement("img");
        qrImage.src = qrDataURL;
        qrImage.alt = `${name} QR Code`;
        qrImage.style.width = "140px";
        qrContainer.appendChild(qrImage);

        const svgIcon = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        );
        svgIcon.setAttribute("width", "24");
        svgIcon.setAttribute("height", "24");
        svgIcon.setAttribute("viewBox", "0 0 24 24");
        svgIcon.setAttribute("fill", "none");
        svgIcon.setAttribute("stroke", "red");
        svgIcon.setAttribute("stroke-width", "2");
        svgIcon.setAttribute("stroke-linecap", "round");
        svgIcon.setAttribute("stroke-linejoin", "round");
        svgIcon.classList.add("feather", "x-icon");
        svgIcon.id = "x-icon";

        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "10");
        svgIcon.appendChild(circle);

        const line1 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line1.setAttribute("x1", "15");
        line1.setAttribute("y1", "9");
        line1.setAttribute("x2", "9");
        line1.setAttribute("y2", "15");
        svgIcon.appendChild(line1);

        const line2 = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line2.setAttribute("x1", "9");
        line2.setAttribute("y1", "9");
        line2.setAttribute("x2", "15");
        line2.setAttribute("y2", "15");
        svgIcon.appendChild(line2);
        qrContainer.appendChild(svgIcon);
        popupContent.appendChild(qrContainer);
        popupContainer.appendChild(popupContent);
        document.body.appendChild(popupContainer);
        popupContainer.addEventListener("click", (e) => {
          if (e.target === popupContainer) {
            document.body.removeChild(popupContainer);
          }
        });
        let redXButton = document.getElementById("x-icon");
        redXButton.addEventListener("click", () => {
          document.body.removeChild(popupContainer);
        });
      } catch (error) {
        console.log(error);
      }
    });
    tokenElement.appendChild(nameHeader);
    tokenElement.appendChild(tokenHeader);
    tokensContainer.appendChild(tokenElement);
    updateToken(name, secret);
    let canClick = true;
    tokenElement.addEventListener("click", async () => {
      if (!canClick) return;
      if (!clipboardCopyingCheckbox.checked) {
        const copiedMessage = document.createElement("div");
        copiedMessage.className = "not-copied-message";
        copiedMessage.textContent = "Enable Clipboard Copy in settings";
        tokenElement.appendChild(copiedMessage);
        canClick = false;
        setTimeout(() => {
          tokenElement.removeChild(copiedMessage);
          canClick = true;
        }, 3000);
      } else if (clipboardCopyingCheckbox.checked) {
        document.getElementById("");
        navigator.clipboard.writeText(otp).then(() => {
          const copiedMessage = document.createElement("div");
          copiedMessage.className = "copied-message";
          copiedMessage.textContent = "Copied!";
          tokenElement.appendChild(copiedMessage);
          canClick = false;
          setTimeout(() => {
            tokenElement.removeChild(copiedMessage);
            canClick = true;
          }, 2000);
        });
      }
    });
  }

  function confirmDelete(name, secret) {
    const popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    const popupContent = document.createElement("div");
    popupContent.className = "popup-message";
    const svgIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    svgIcon.setAttribute("width", "24");
    svgIcon.setAttribute("height", "24");
    svgIcon.setAttribute("viewBox", "0 0 24 24");
    svgIcon.setAttribute("fill", "none");
    svgIcon.setAttribute("stroke", "red");
    svgIcon.setAttribute("stroke-width", "2");
    svgIcon.setAttribute("stroke-linecap", "round");
    svgIcon.setAttribute("stroke-linejoin", "round");
    svgIcon.classList.add("feather", "x-icon");
    svgIcon.id = "x-icon";
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "10");
    svgIcon.appendChild(circle);

    const line1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    line1.setAttribute("x1", "15");
    line1.setAttribute("y1", "9");
    line1.setAttribute("x2", "9");
    line1.setAttribute("y2", "15");
    svgIcon.appendChild(line1);

    const line2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    line2.setAttribute("x1", "9");
    line2.setAttribute("y1", "9");
    line2.setAttribute("x2", "15");
    line2.setAttribute("y2", "15");
    svgIcon.appendChild(line2);
    popupContent.appendChild(svgIcon);
    const messageHeader = document.createElement("h3");
    messageHeader.className = "centered-headings";
    messageHeader.textContent = "Are you sure? This action is permanent.";
    popupContent.appendChild(messageHeader);
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "buttons-container";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-token-confirmation";
    deleteButton.id = "delete-token";
    deleteButton.textContent = "Delete";
    buttonsContainer.appendChild(deleteButton);
    const closeButton = document.createElement("button");
    closeButton.className = "close-popup";
    closeButton.textContent = "Close";
    buttonsContainer.appendChild(closeButton);
    popupContent.appendChild(buttonsContainer);
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);
    closeButton.addEventListener("click", () => {
      document.body.removeChild(popupContainer);
    });
    deleteButton.addEventListener("click", () => {
      deleteToken(name, secret);
      document.body.removeChild(popupContainer);
    });
    svgIcon.addEventListener("click", () => {
      document.body.removeChild(popupContainer);
    });
  }

  function deleteToken(name, secret) {
    chrome.storage.local.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      tokens = tokens.filter(
        (tokenObj) => tokenObj.name !== name && tokenObj.secret !== secret
      );
      tokens.sort((a, b) => a.name.localeCompare(b.name));
      if (syncCheckbox.checked == true) {
        chrome.storage.sync.set({ tokens }, (result) => {});
      }
      chrome.storage.local.set({ tokens }, () => {
        while (tokensContainer.firstChild) {
          tokensContainer.removeChild(tokensContainer.firstChild);
        }
        tokens.forEach((tokenObj) => {
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

  async function updateToken(name, secret) {
    popupUpdate();
    const token = generateToken(secret);
    const tokenElement = document.getElementById(`token-${name}`);
    if (tokenElement) {
      tokenElement.querySelector(".token-value").textContent = `${token}`;
    }
    chrome.storage.local.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      const tokenIndex = tokens.findIndex((tokenObj) => tokenObj.name === name);
      if (tokenIndex !== -1) {
        tokens[tokenIndex].otp = token;
        chrome.storage.local.set({ tokens }, () => {});
      }
    });
  }
});
