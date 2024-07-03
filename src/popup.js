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

    requestAnimationFrame(updateClock);
  }
  updateClock();

  // Load tokens and autofill state from storage
  chrome.storage.local.get(["tokens", "autofillEnabled"], (result) => {
    let tokens = result.tokens || [];
    tokens.sort((a, b) => a.name.localeCompare(b.name)); // Sort tokens alphabetically by name
    tokens.forEach((tokenObj) => {
      addTokenToDOM(tokenObj.name, tokenObj.secret, tokenObj.url, tokenObj.otp);
    });

    // Set the state of the autofill checkbox
    autofillCheckbox.checked = result.autofillEnabled || false;

    // Set up initial update based on the current time
    setupInitialUpdate(tokens);
  });

  // Event Listeners

  minimizeButton.addEventListener("click", () => {
    console.log("clicked minimize");
    window.close();
  });

  autofillCheckbox.addEventListener("change", () => {
    chrome.storage.local.set({ autofillEnabled: autofillCheckbox.checked });
    console.log("Checkbox event listener", autofillCheckbox.checked);
  });

  generateButton.addEventListener("click", () => {
    const name = nameInput.value.trim();
    let nameLength = false;
    if (name.length < 16) {
      nameLength = true;
      console.log("name short enough");
    } else {
      console.log("name NOT short enough");
    }
    const secret = secretInput.value.trim();
    if (name && nameLength && secret) {
      if (isValidBase32(secret)) {
        chrome.storage.local.get(["tokens"], (result) => {
          let tokens = result.tokens || [];
          const nameExists = tokens.some((tokenObj) => tokenObj.name === name);
          const secretExists = tokens.some(
            (tokenObj) => tokenObj.secret === secret
          );

          if (nameExists) {
            alert(
              "A token with this name already exists. Please choose a different name."
            );
          } else if (secretExists) {
            alert("You've already added this secret.");
          } else {
            try {
              // Validate the secret
              const token = generateToken(secret);
              const isValid = checkToken(token, secret);

              if (isValid) {
                // Generate OTP
                const otp = authenticator.generate(secret);

                // Save the new token to storage if valid
                const newTokenObj = { name, secret, url: "", otp }; // Include OTP in the token object
                tokens.push(newTokenObj);
                tokens.sort((a, b) => a.name.localeCompare(b.name)); // Sort tokens alphabetically by name
                chrome.storage.local.set({ tokens }, () => {
                  tokensContainer.innerHTML = ""; // Clear existing tokens
                  tokens.forEach((tokenObj) => {
                    addTokenToDOM(
                      tokenObj.name,
                      tokenObj.secret,
                      tokenObj.url,
                      tokenObj.otp
                    );
                  });
                  console.log("Tokens after addition:", tokens);
                });
              } else {
                throw new Error("Invalid token generated.");
              }
            } catch (err) {
              console.error(err);
              alert("Invalid Input");
            }
          }
        });
      } else {
        alert("Invalid secret. Please enter a Base32 encoded string.");
      }
    } else {
      alert("Please enter both name and secret.");
    }
  });

  // Utility Functions
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
      // Fetch the latest token details from storage
      chrome.storage.local.get(["tokens"], (result) => {
        let tokens = result.tokens || [];
        const tokenObj = tokens.find((token) => token.name === name);
        if (tokenObj) {
          const { name, url } = tokenObj; // Get the latest name and url

          // Create the popup container
          const popupContainer = document.createElement("div");
          popupContainer.className = "popup-container";

          // Create the popup content
          const popupContent = document.createElement("div");
          popupContent.className = "popup-content";
          popupContent.innerHTML = `
          <h2 class="centered-headings">${name} Token Settings</h2>
          <label for="name" class="form-label">Autofill URL:</label>
          <input type="text" id="autofill-url-input" class="form-input" placeholder="Enter URL" value="${url}">
          <button id="save-url-button" class="add-token-button" >Save URL</button>
          <p>Current Autofill URL: <span id="current-url">${url}</span></p>
          <div class="buttons-container"> 
          <button class="delete-token" id="delete-token">Delete</button>
          <button class="close-popup">Close</button>
          </div>
          `;

          popupContainer.appendChild(popupContent);
          document.body.appendChild(popupContainer);

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
            chrome.storage.local.get(["tokens"], (result) => {
              let tokens = result.tokens || [];
              const tokenIndex = tokens.findIndex(
                (tokenObj) => tokenObj.name === name
              );
              if (tokenIndex !== -1) {
                tokens[tokenIndex].url = newUrl;
                chrome.storage.local.set({ tokens }, () => {
                  document.getElementById("current-url").textContent = newUrl;
                  console.log("Saved URL to chrome storage:", newUrl);
                  console.log("Tokens after URL change:", tokens);
                });
              }
            });
          });

          // Close the popup when clicking the close button
          popupContent
            .querySelector(".close-popup")
            .addEventListener("click", () => {
              document.body.removeChild(popupContainer);
            });

          // Close the popup when clicking outside of it
          popupContainer.addEventListener("click", (event) => {
            if (event.target === popupContainer) {
              document.body.removeChild(popupContainer);
            }
          });

          // Move the delete button event listener here
          popupContent
            .querySelector("#delete-token")
            .addEventListener("click", () => {
              confirmDelete(name, secret); // Call your confirmDelete function
              document.body.removeChild(popupContainer); // Close the popup after deletion
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
      if (!canClick) return;

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
        }, 2000); // Adjust the time as needed (2000ms = 2s)
      });
    });
  }

  function confirmDelete(name, secret) {
    if (confirm("Are you sure? This action is permanent.")) {
      deleteToken(name, secret);
    }
  }

  function deleteToken(name, secret) {
    chrome.storage.local.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      tokens = tokens.filter(
        (tokenObj) => tokenObj.name !== name && tokenObj.secret !== secret
      );
      tokens.sort((a, b) => a.name.localeCompare(b.name)); // Sort tokens alphabetically by name
      chrome.storage.local.set({ tokens }, () => {
        tokensContainer.innerHTML = ""; // Clear existing tokens
        tokens.forEach((tokenObj) => {
          addTokenToDOM(
            tokenObj.name,
            tokenObj.secret,
            tokenObj.url,
            tokenObj.otp
          );
        });
        console.log("Tokens after deletion:", tokens);
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

    // Update the OTP in chrome.storage
    chrome.storage.local.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      const tokenIndex = tokens.findIndex((tokenObj) => tokenObj.name === name);
      if (tokenIndex !== -1) {
        tokens[tokenIndex].otp = token; // Update the OTP
        chrome.storage.local.set({ tokens }, () => {
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
    chrome.storage.local.get(["tokens"], (result) => {
      let tokens = result.tokens || [];
      tokens.forEach((tokenObj) => {
        updateToken(tokenObj.name, tokenObj.secret);
      });

      // Set an interval to update tokens every 30 seconds
      setInterval(() => {
        tokens.forEach((tokenObj) => {
          updateToken(tokenObj.name, tokenObj.secret);
        });
      }, 30000); // Adjust the interval as needed
    });
  }

  // Call setupPeriodicTokenUpdate to keep OTP updated
  setupPeriodicTokenUpdate();
});
