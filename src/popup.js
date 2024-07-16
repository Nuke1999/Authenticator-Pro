const { authenticator } = require("otplib");
const { Buffer } = require("buffer");

window.Buffer = Buffer;

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("name");
  const secretInput = document.getElementById("secret");
  const generateButton = document.getElementById("generate");
  const autofillCheckbox = document.getElementById("autofill");
  const tokensContainer = document.getElementById("tokens");
  const minimizeButton = document.getElementById("minimize");
  const mainSettings = document.getElementById("main-settings");
  const mainContent = document.getElementById("main-content");
  const settingsPage = document.getElementById("settings-content");
  const backButton = document.getElementById("back-button");
  const headerText = document.getElementById("centered-title");
  const syncTokens = document.getElementById("sync-tokens");
  const clipboardCopying = document.getElementById("clipboard-copying");

  function lastSeconds(seconds) {
    const wholeSeconds = Math.floor(seconds);

    if (wholeSeconds === 25 || wholeSeconds === 55) {
      return 5;
    } else if (wholeSeconds === 26 || wholeSeconds === 56) {
      return 4;
    } else if (wholeSeconds === 27 || wholeSeconds === 57) {
      return 3;
    } else if (wholeSeconds === 28 || wholeSeconds === 58) {
      return 2;
    } else if (wholeSeconds === 29 || wholeSeconds === 59) {
      return 1;
    } else {
      return "";
    }
  }

  function updateClock() {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;

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

    requestAnimationFrame(updateClock);
  }

  updateClock();

  chrome.storage.local.get(
    ["tokens", "autofillEnabled", "syncTokens"],
    (result) => {
      const storage = result.syncTokens
        ? chrome.storage.sync
        : chrome.storage.local;

      storage.get(
        ["tokens", "autofillEnabled", "clipboardCopyingEnabled"],
        (result) => {
          let tokens = result.tokens || [];
          tokens.sort((a, b) => a.name.localeCompare(b.name));
          tokens.forEach((tokenObj) => {
            addTokenToDOM(
              tokenObj.name,
              tokenObj.secret,
              tokenObj.url,
              tokenObj.otp
            );
          });

          autofillCheckbox.checked = result.autofillEnabled || false;
          clipboardCopying.checked = result.clipboardCopyingEnabled || false;
          setupInitialUpdate(tokens);
        }
      );

      syncTokens.checked = result.syncTokens || false;
    }
  );

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
  ///
  clipboardCopying.addEventListener("change", () => {
    console.log("clipboard copying: ", clipboardCopying.checked);
    chrome.storage.local.get(["syncTokens"], (syncResult) => {
      const storage = syncResult.syncTokens
        ? chrome.storage.sync
        : chrome.storage.local;
      console.log(
        "Using storage:",
        storage === chrome.storage.sync ? "sync" : "local"
      );
      console.log(storage);

      storage.set({ clipboardCopyingEnabled: clipboardCopying.checked });
    });
  });
  ///

  autofillCheckbox.addEventListener("change", () => {
    console.log("autofillcheckbox position: ", autofillCheckbox.checked);
    chrome.storage.local.get(["syncTokens"], (syncResult) => {
      const storage = syncResult.syncTokens
        ? chrome.storage.sync
        : chrome.storage.local;
      storage.set({ autofillEnabled: autofillCheckbox.checked });
    });
  });

  // Add event listener for syncTokens checkbox change
  syncTokens.addEventListener("change", () => {
    const useSync = syncTokens.checked;

    chrome.storage.local.set({ syncTokens: useSync }, () => {
      if (useSync) {
        // Migrate data from local to sync storage
        console.log("Sync checked");
        chrome.storage.local.get(
          ["tokens", "autofillEnabled", "clipboardCopyingEnabled"],
          (result) => {
            const tokens = result.tokens || [];
            const autofillEnabled = result.autofillEnabled || false;
            const clipboardCopyingEnabled =
              result.clipboardCopyingEnabled || false;
            chrome.storage.sync.set(
              { tokens, autofillEnabled, clipboardCopyingEnabled },
              () => {
                chrome.storage.local.remove(
                  ["tokens", "autofillEnabled", "clipboardCopyingEnabled"],
                  () => {
                    console.log(
                      "Migrated tokens and autofill state to sync storage"
                    );
                    // Update OTPs immediately after migration
                    updateOTPs();
                  }
                );
              }
            );
          }
        );
      } else {
        console.log("Sync unchecked");
        // Migrate data from sync to local storage
        chrome.storage.sync.get(
          ["tokens", "autofillEnabled", "clipboardCopyingEnabled"],
          (result) => {
            const tokens = result.tokens || [];
            const autofillEnabled = result.autofillEnabled || false;
            const clipboardCopyingEnabled =
              result.clipboardCopyingEnabled || false;
            chrome.storage.local.set(
              { tokens, autofillEnabled, clipboardCopyingEnabled },
              () => {
                chrome.storage.sync.remove(
                  ["tokens", "autofillEnabled", "clipboardCopyingEnabled"],
                  () => {
                    console.log(
                      "Migrated tokens, autofill state, and copying state to local storage"
                    );
                    // Update OTPs immediately after migration
                    updateOTPs();
                  }
                );
              }
            );
          }
        );
      }
    });
  });

  // Function to update OTPs
  function updateOTPs() {
    chrome.storage.local.get(["syncTokens"], (syncResult) => {
      const storage = syncResult.syncTokens
        ? chrome.storage.sync
        : chrome.storage.local;
      storage.get(["tokens"], (result) => {
        const tokens = result.tokens || [];
        tokens.forEach((tokenObj, index) => {
          const otp = authenticator.generate(tokenObj.secret);
          tokens[index].otp = otp;
        });
        storage.set({ tokens });
      });
    });
  }

  generateButton.addEventListener("click", () => {
    const name = nameInput.value.trim();
    let nameLength = false;
    if (name.length < 16) {
      nameLength = true;
    }
    const secret = secretInput.value.trim();
    if (name && nameLength && secret) {
      if (isValidBase32(secret)) {
        const storage = syncTokens.checked
          ? chrome.storage.sync
          : chrome.storage.local;
        storage.get(["tokens"], (result) => {
          let tokens = result.tokens || [];
          const nameExists = tokens.some((tokenObj) => tokenObj.name === name);
          const secretExists = tokens.some(
            (tokenObj) => tokenObj.secret === secret
          );

          if (nameExists) {
            createPopup(
              "A token with this name already exists. Please choose a different name."
            );
          } else if (secretExists) {
            createPopup("You've already added this secret.");
          } else {
            try {
              const token = generateToken(secret);
              const isValid = checkToken(token, secret);

              if (isValid) {
                const otp = authenticator.generate(secret);
                const newTokenObj = { name, secret, url: "", otp };
                tokens.push(newTokenObj);
                tokens.sort((a, b) => a.name.localeCompare(b.name));
                storage.set({ tokens }, () => {
                  tokensContainer.innerHTML = "";
                  tokens.forEach((tokenObj) => {
                    addTokenToDOM(
                      tokenObj.name,
                      tokenObj.secret,
                      tokenObj.url,
                      tokenObj.otp
                    );
                  });
                });
              } else {
                throw new Error("Invalid token generated.");
              }
            } catch (err) {
              createPopup("Invalid Input");
            }
          }
        });
      } else {
        createPopup("Invalid secret. Please enter a Base32 encoded string.");
      }
    } else {
      createPopup("Please enter both name and secret.");
    }
  });

  function createPopup(message) {
    const popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    const popupContent = document.createElement("div");
    popupContent.className = "popup-message";
    popupContent.innerHTML = `
      <div class="close-popup-container-red-x">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon-popup" id="x-icon-popup"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      </div>
      <h3>${message}</h3>
      <div class="close-popup-container">
        <button class="close-popup">Close</button>
      </div>`;
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);
    popupContent.querySelector(".close-popup").addEventListener("click", () => {
      document.body.removeChild(popupContainer);
    });
    popupContent
      .querySelector(".x-icon-popup")
      .addEventListener("click", () => {
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
    }
    throw new Error("Invalid secret format.");
  }

  function checkToken(token, secret) {
    if (isValidBase32(secret)) {
      return authenticator.check(token, secret);
    }
    return false;
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

    const tokenSettings = document.createElement("img");
    tokenSettings.src = "./icons/gearIcon.svg";
    tokenSettings.className = "token-settings";
    tokenSettings.id = name + "-token-settings";
    tokenElement.appendChild(tokenSettings);

    const tokenCopy = document.createElement("img");
    tokenCopy.src = "./icons/clipboard.svg";
    tokenCopy.className = "token-copy";
    tokenCopy.id = name + "-token-copy";
    tokenElement.appendChild(tokenCopy);

    tokenSettings.addEventListener("click", (event) => {
      event.stopPropagation();
      const storage = syncTokens.checked
        ? chrome.storage.sync
        : chrome.storage.local;
      storage.get(["tokens"], (result) => {
        let tokens = result.tokens || [];
        const tokenObj = tokens.find((token) => token.name === name);
        if (tokenObj) {
          const { name, url } = tokenObj;

          let popupContainer = document.createElement("div");
          popupContainer.className = "popup-container";
          let popupContent = document.createElement("div");
          popupContent.className = "popup-content";
          popupContent.innerHTML = `
          <div>
          <h2 class="centered-headings">${name} Token Settings</h2>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon" id="x-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          </div>
          <label for="name" class="form-label">Autofill URL:</label>
          <input type="text" id="autofill-url-input" class="form-input" placeholder="Enter URL" value="${url}">
          <button id="save-url-button" class="add-token-button" >Save URL</button>
          <div class="inline-url">
          <label class="form-label">Current Autofill URL:   </label><div id="current-url">${url}</div>
          </div>
          <div class="buttons-container"> 
          <button class="delete-token" id="delete-token">Delete</button>
          <button class="close-popup">Close</button>
          </div>
          `;

          popupContainer.appendChild(popupContent);
          document.body.appendChild(popupContainer);

          let redXButton = document.getElementById("x-icon");
          redXButton.addEventListener("click", () => {
            document.body.removeChild(popupContainer);
          });

          let saveUrlButton = document.getElementById("save-url-button");
          saveUrlButton.addEventListener("click", () => {
            console.log("clicked save url button");
          });

          let autofillUrlInput = document.getElementById("autofill-url-input");
          autofillUrlInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              saveUrlButton.click();
            }
          });

          saveUrlButton.addEventListener("click", () => {
            const newUrl = document
              .getElementById("autofill-url-input")
              .value.trim();
            const storage = syncTokens.checked
              ? chrome.storage.sync
              : chrome.storage.local;
            storage.get(["tokens"], (result) => {
              let tokens = result.tokens || [];
              const tokenIndex = tokens.findIndex(
                (tokenObj) => tokenObj.name === name
              );

              if (tokenIndex !== -1) {
                tokens[tokenIndex].url = newUrl;
                storage.set({ tokens }, () => {
                  const displayUrl =
                    newUrl.length > 34
                      ? newUrl.substring(0, 34) + "..."
                      : newUrl;
                  document.getElementById("current-url").textContent =
                    displayUrl;
                  console.log("Saved URL to chrome storage:", newUrl);
                });
              }
            });
          });

          popupContent
            .querySelector(".close-popup")
            .addEventListener("click", () => {
              document.body.removeChild(popupContainer);
            });

          popupContainer.addEventListener("click", (event) => {
            if (event.target === popupContainer) {
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

    tokenElement.appendChild(nameHeader);
    tokenElement.appendChild(tokenHeader);
    tokensContainer.appendChild(tokenElement);

    updateToken(name, secret);
    let canClick = true;

    tokenElement.addEventListener("click", () => {
      if (!canClick || clipboardCopying.checked == false) return;
      const token = generateToken(secret);
      navigator.clipboard.writeText(token).then(() => {
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
    });
  }

  function confirmDelete(name, secret) {
    const popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    const popupContent = document.createElement("div");
    popupContent.className = "popup-message";
    popupContent.innerHTML = `
      <div class="close-popup-container-red-x">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon-popup" id="x-icon-popup"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      </div>
      <h3>Are you sure? This action is permanent.</h3>
          <div class="buttons-container"> 
          <button class="delete-token-confirmation" id="delete-token">Delete</button>
          <button class="close-popup">Close</button>
          </div>
      `;
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);
    popupContent.querySelector(".close-popup").addEventListener("click", () => {
      document.body.removeChild(popupContainer);
    });
    popupContent
      .querySelector(".delete-token-confirmation")
      .addEventListener("click", () => {
        deleteToken(name, secret);
        document.body.removeChild(popupContainer);
      });
    popupContent
      .querySelector(".x-icon-popup")
      .addEventListener("click", () => {
        document.body.removeChild(popupContainer);
      });
  }

  function deleteToken(name, secret) {
    const storage = syncTokens.checked
      ? chrome.storage.sync
      : chrome.storage.local;
    storage.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      tokens = tokens.filter(
        (tokenObj) => tokenObj.name !== name && tokenObj.secret !== secret
      );
      tokens.sort((a, b) => a.name.localeCompare(b.name));
      storage.set({ tokens }, () => {
        tokensContainer.innerHTML = "";
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

  function updateTokens(tokens) {
    tokens.forEach((tokenObj) => {
      updateToken(tokenObj.name, tokenObj.secret);
    });
  }

  function updateToken(name, secret) {
    const token = generateToken(secret);
    const tokenElement = document.getElementById(`token-${name}`);
    if (tokenElement) {
      tokenElement.querySelector(".token-value").textContent = `${token}`;
    }

    const storage = syncTokens.checked
      ? chrome.storage.sync
      : chrome.storage.local;
    storage.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      const tokenIndex = tokens.findIndex((tokenObj) => tokenObj.name === name);
      if (tokenIndex !== -1) {
        tokens[tokenIndex].otp = token;
        storage.set({ tokens }, () => {
          console.log(`Updated OTP for ${name} in chrome.storage: ${token}`);
        });
      }
    });
  }

  function setupInitialUpdate(tokens) {
    const now = new Date();
    const seconds = now.getSeconds();
    const initialDelay = seconds < 30 ? 30 - seconds : 60 - seconds;

    setTimeout(() => {
      updateTokens(tokens);
      setInterval(() => {
        updateTokens(tokens);
      }, 30000);
    }, initialDelay * 1000);
  }

  function setupPeriodicTokenUpdate() {
    const storage = syncTokens.checked
      ? chrome.storage.sync
      : chrome.storage.local;
    storage.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      tokens.forEach((tokenObj) => {
        updateToken(tokenObj.name, tokenObj.secret);
      });

      setInterval(() => {
        tokens.forEach((tokenObj) => {
          updateToken(tokenObj.name, tokenObj.secret);
        });
      }, 30000);
    });
  }

  setupPeriodicTokenUpdate();
});
