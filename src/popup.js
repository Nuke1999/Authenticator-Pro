import { authenticator } from "otplib";
import { Buffer } from "buffer";
import QrScanner from "qr-scanner";
import QRCode from "qrcode";

window.Buffer = Buffer;

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

  advancedAddButton.className = "advanced-add-button";
  advancedAddButton.textContent = "Advanced Add";

  let isTimeCheckboxChecked;

  nameInput.focus();

  //themes related

  lightThemeButton.addEventListener("click", () => {
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
    chrome.storage.local.set({ theme: "theme-light" });
    if (syncCheckbox.checked) {
      // console.log("sync is on, saving light theme to sync");
      chrome.storage.sync.set({ theme: "theme-light" });
    }
  });

  darkThemeButton.addEventListener("click", () => {
    document.body.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
    chrome.storage.local.set({ theme: "theme-dark" });
    if (syncCheckbox.checked) {
      // console.log("sync is on, saving dark theme to sync");
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
      // console.log("time checkbox checked");
      getSecondsFromTimeApi().then((seconds) => startClock(seconds));
    } else {
      // console.log("time checkbox not checked");
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

    function updateTokensAtInterval() {
      chrome.storage.local.get(["tokens"], (result) => {
        let tokens = result.tokens || [];
        tokens.forEach((tokenObj) => {
          updateToken(tokenObj.name, tokenObj.secret);
        });
      });
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

  // button & label event listeners

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

  // chrome storage & sync realted

  //first time: aligns local & sync storages, sets storage to either sync storage or default values, ensures checkbox status reflects storage, tries to pull theme from sync;
  //else: aligns checkbox values with local storage, sets theme according to local storage
  try {
    chrome.storage.local.get((localResult) => {
      // console.log(localResult);

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

      chrome.storage.sync.get((syncResult) => {
        // console.log("sync result", syncResult);

        if (localResult.firstTime === undefined) {
          // console.log(
          //   "according to chrome local storage, this is the first time; local storage is empty"
          // );
          //this is setting up the actual checkboxes;

          autofillCheckbox.checked = false;
          syncCheckbox.checked = syncResult.syncEnabled || true;
          clipboardCopyingCheckbox.checked = false;
          onlineTimeCheckbox.checked = syncResult.onlineTimeEnabled || true;
          advancedAddCheckbox.advancedAddEnabled = false;
          isTimeCheckboxChecked = syncResult.onlineTimeEnabled || true;
          updateClock();
          // console.log("got syncResults ", syncResult);
          chrome.storage.local.set({
            tokens: syncResult.tokens || [],
            autofillEnabled: false,
            syncEnabled: syncResult.syncEnabled || true,
            clipboardCopyingEnabled: false,
            onlineTimeEnabled: syncResult.onlineTimeEnabled || true,
            advancedAddEnabled: syncResult.advancedAddEnabled || false,
            firstTime: false,
            theme: syncResult.theme || "theme-light",
          });
          chrome.storage.sync.set({
            tokens: syncResult.tokens || localResult.tokens || true,
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
          // console.log(
          //   "it was not the first time, according to chrome local storage; making checkbox positions match local storage. "
          // );
          isTimeCheckboxChecked = localResult.onlineTimeEnabled;
          updateClock();
          // console.log("local result: ", localResult);
          autofillCheckbox.checked = localResult.autofillEnabled;
          syncCheckbox.checked = localResult.syncEnabled;
          clipboardCopyingCheckbox.checked =
            localResult.clipboardCopyingEnabled;
          onlineTimeCheckbox.checked = localResult.onlineTimeEnabled;
          advancedAddCheckbox.checked = localResult.advancedAddEnabled;
          if (advancedAddCheckbox.checked) {
            advancedAddButton.className = "advanced-add-button";
            formContainer.appendChild(advancedAddButton);
            advancedAddButton.style.display = "block";
          } else {
            advancedAddButton.style.display = "none";
          }

          if (localResult.theme == "theme-light") {
            document.body.classList.remove("theme-dark");
            document.body.classList.add("theme-light");
            chrome.storage.local.set({ theme: "theme-light" });
          } else if (localResult.theme == "theme-dark") {
            document.body.classList.remove("theme-light");
            document.body.classList.add("theme-dark");
            chrome.storage.local.set({ theme: "theme-dark" });
          } else {
            // console.log("theme was somehow neither light nor dark");
          }
        }
      });
    });
  } catch (error) {
    console.error("Error accessing local storage:", error);
  }

  autofillCheckbox.addEventListener("change", async () => {
    if (autofillCheckbox.checked) {
      try {
        // Request optional permissions
        const granted = await requestAutofillPermission();
        if (granted) {
          // Permission granted, proceed with setting the checkbox state
          // console.log("Autofill permission granted.");
          chrome.storage.local.set({ autofillEnabled: true });
        } else {
          // Permission denied, revert the checkbox state
          // console.log("Autofill permission denied.");
          autofillCheckbox.checked = false;
        }
      } catch (error) {
        console.error("Error requesting autofill permission:", error);
        autofillCheckbox.checked = false;
      }
    } else {
      // If the checkbox is unchecked, update the storage accordingly
      chrome.storage.local.set({ autofillEnabled: false });
      // chrome.storage.sync.set({ autofillEnabled: false });
    }
  });

  // Function to request autofill permission
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

  syncCheckbox.addEventListener("change", () => {
    try {
      if (syncCheckbox.checked) {
        // console.log("sync checkbox checked");

        chrome.storage.local.get(["tokens"], (localResult) => {
          chrome.storage.sync.get(["tokens"], (syncResult) => {
            // console.log("localResult.tokens:", localResult.tokens);
            // console.log("syncResult.tokens:", syncResult.tokens);

            let localTokens = Array.isArray(localResult.tokens)
              ? localResult.tokens
              : [];
            let syncTokens = Array.isArray(syncResult.tokens)
              ? syncResult.tokens
              : [];

            // Consolidate tokens
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

            // Save consolidated tokens to sync storage
            chrome.storage.sync.set({ tokens: syncTokens }, () => {
              // console.log("adding potentially new tokens to dom");
              syncTokens.forEach((tokenObj) => {
                // Check if token is already in DOM
                if (!document.getElementById(`token-${tokenObj.name}`)) {
                  addTokenToDOM(
                    tokenObj.name,
                    tokenObj.secret,
                    tokenObj.url,
                    tokenObj.otp
                  );
                }
              });
              // console.log(
              //   "Consolidated tokens saved to sync storage:",
              //   syncTokens
              // );
            });
          });
        });
      } else {
        // console.log("sync is unchecked, not syncing storage and local.");
      }

      chrome.storage.local.set({ syncEnabled: syncCheckbox.checked });
      chrome.storage.sync.set({ syncEnabled: syncCheckbox.checked });
    } catch (error) {
      console.error("Error setting syncCheck:", error);
    }
  });

  clipboardCopyingCheckbox.addEventListener("change", async () => {
    if (clipboardCopyingCheckbox.checked) {
      try {
        // Request clipboard permissions
        const granted = await requestClipboardPermission();
        if (granted) {
          // Permission granted, proceed with setting the checkbox state
          // console.log("Clipboard permission granted.");
          chrome.storage.local.set({ clipboardCopyingEnabled: true });
          chrome.storage.sync.set({ clipboardCopyingEnabled: true });
        } else {
          // Permission denied, revert the checkbox state
          // console.log("Clipboard permission denied.");
          clipboardCopyingCheckbox.checked = false;
        }
      } catch (error) {
        console.error("Error requesting clipboard permission:", error);
        clipboardCopyingCheckbox.checked = false;
      }
    } else {
      // If the checkbox is unchecked, update the storage accordingly
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
    // console.log("time checkbox is: ", onlineTimeCheckbox.checked);
    try {
      chrome.storage.local.set({
        onlineTimeEnabled: onlineTimeCheckbox.checked,
      });
      chrome.storage.sync.set({
        onlineTimeEnabled: onlineTimeCheckbox.checked,
      });
    } catch (error) {
      console.error("Error setting syncCheck:", error);
    }
  });

  advancedAddCheckbox.addEventListener("change", () => {
    // console.log("advanced add checkbox toggled: ", advancedAddCheckbox.checked);
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
      console.error("Error setting syncCheck:", error);
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
        chrome.storage.local.get(["tokens"], (result) => {
          // console.log(result);
          let tokens = result.tokens || [];
          const nameExists = tokens.some((tokenObj) => tokenObj.name === name);
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
              const isValid = checkToken(token, secret);

              if (isValid) {
                nameInput.value = "";
                secretInput.value = "";
                const otp = authenticator.generate(secret);
                const newTokenObj = { name, secret, url: "", otp };
                tokens.push(newTokenObj);
                tokens.sort((a, b) => a.name.localeCompare(b.name));

                if (syncCheckbox.checked == true) {
                  chrome.storage.sync.set({ tokens }, () => {
                    tokensContainer.innerHTML = "";
                    tokens.forEach((tokenObj) => {
                      addTokenToDOM(
                        tokenObj.name,
                        tokenObj.secret,
                        tokenObj.url,
                        tokenObj.otp
                      );
                    });

                    // Retrieve and log the storage data after setting
                    chrome.storage.sync.get(null, (result) => {
                      // console.log("sync storage tokens:", result);
                    });
                  });
                }

                chrome.storage.local.set({ tokens }, () => {
                  tokensContainer.innerHTML = "";
                  tokens.forEach((tokenObj) => {
                    addTokenToDOM(
                      tokenObj.name,
                      tokenObj.secret,
                      tokenObj.url,
                      tokenObj.otp
                    );
                  });

                  // Retrieve and log the storage data after setting
                  chrome.storage.local.get(null, (result) => {
                    // console.log("local storage tokens:", result);
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

  let isCooldown = false;

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

    popupContent.innerHTML = `
    <div>
      <h2 class="centered-headings">Add QR Code Via:</h2>
      <h3 class="advanced-add-messages" id="advanced-add-messages" style="visibility: hidden;">QR Code not found. Try a different image.</h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon" id="x-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
    </div>
    <div class="video-container" style="display: none;">
      <video id="video" autoplay playsinline style="width: 100%;"></video>
    </div>
    <div class="buttons-container">
      <button class="webcam-add-button" id="webcam-add-button">Webcam</button>
      <button class="image-add-button" id="image-add-button">Image</button>
    </div>
    <div class="url-add-container">
      <label for="name" class="form-label">Image URL:</label>
      <input type="text" id="image-url-input" class="form-input enter-url-placeholder" placeholder="Enter URL" value="">

      <button id="add-url-button" class="add-url-button">Enter URL</button>
    </div>
  `;

    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);

    const webcamButton = document.getElementById("webcam-add-button");
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
    let imageUrlInput = document.getElementById("image-url-input");

    function saveImageUrl() {
      let addImageUrl = imageUrlInput.value;
      // console.log("Image URL saved:", addImageUrl);

      QrScanner.scanImage(addImageUrl)
        .then((result) => {
          // console.log("decoded qr code:", result);
          secretInput.value = result;
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
          // console.log(error || "No QR code found.");
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
        }, 1000); // Wait 1 second before stopping camera

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
          webcamButton.innerHTML = "Webcam";
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

          webcamButton.innerHTML = "Webcam";
          webcamButton.appendChild(webcamOffIcon);

          setAdvancedAddMessage("Scanning...", true);

          qrScanner = new QrScanner(
            videoElem,
            (result) => {
              if (result.data) {
                // console.log("decoded qr code:", result.data);
                qrCodeFound();

                secretInput.value = result.data;
                stream.getTracks().forEach((track) => track.stop());
                stream = null;
                videoElem.pause(); // Ensure the video element is paused
                document.querySelector(".video-container").style.display =
                  "none";
                document.body.removeChild(popupContainer);
                nameInput.focus();
                setAdvancedAddMessage(
                  "QR Code not found. Try a different image.",
                  false
                );
              } else {
                // console.log("No valid QR code found");
              }
            },
            { returnDetailedScanResult: true }
          );

          qrScanner.start();
        }
      } catch (err) {
        // console.log("Failed to access the camera:", err);
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
        }, 1500); // 1-second delay for stopCameraAndScanner
        document.getElementById("file-input").click();
      });

    document
      .getElementById("file-input")
      .addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const result = await QrScanner.scanImage(file);
            secretInput.value = result;
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
            // console.log(error || "No QR code found.");

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
      // console.log("Popup already exists");
      return;
    }

    const popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    const popupContent = document.createElement("div");
    popupContent.className = "popup-message";
    popupContent.innerHTML = `
      <div>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon" id="x-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      </div>
      <h3 class="centered-headings shorter-width-heading">${message}</h3>
      <div class="close-popup-container">
        <button class="close-popup">Close</button>
      </div>`;
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);

    popupContent.querySelector(".close-popup").addEventListener("click", () => {
      document.body.removeChild(popupContainer);
    });
    popupContent.querySelector(".x-icon").addEventListener("click", () => {
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
          // console.log("clicked token setting");
          e.stopPropagation();
          chrome.storage.local.get(["tokens"], (result) => {
            let tokens = result.tokens || [];
            const tokenObj = tokens.find((token) => token.name === name);
            if (tokenObj) {
              const { name, url } = tokenObj;

              let shortenedUrl = url;
              let urlLength = 50;
              if (url.length > urlLength) {
                shortenedUrl = url.substring(0, urlLength) + "...";
              }

              let popupContainer = document.createElement("div");
              popupContainer.className = "popup-container";
              let popupContent = document.createElement("div");
              popupContent.className = "popup-content";
              popupContent.innerHTML = `
                <div class="centered-header">
                  <h2 class="centered-headings shorter-width-heading">${name} Token Settings</h2>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon" id="x-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                </div>
                <label for="name" class="form-label">Autofill URL:</label>
                <input type="text" id="autofill-url-input" class="form-input enter-url-placeholder" placeholder="Enter URL" value="${url}">
                <button id="save-url-button" class="add-token-button" >Save URL</button>
                <div class="inline-url">
                <label class="form-label">Currently Saved: </label>
                <div id="current-url" class="form-label" >${shortenedUrl}</div>
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
                // console.log("clicked save url button");
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

                chrome.storage.local.get(["tokens"], (result) => {
                  let tokens = result.tokens || [];
                  const tokenIndex = tokens.findIndex(
                    (tokenObj) => tokenObj.name === name
                  );

                  if (tokenIndex !== -1) {
                    tokens[tokenIndex].url = newUrl;
                    chrome.storage.local.set({ tokens }, () => {
                      const displayUrl =
                        newUrl.length > urlLength
                          ? newUrl.substring(0, urlLength) + "..."
                          : newUrl;
                      document.getElementById("current-url").textContent =
                        displayUrl;
                      // console.log("Saved URL to chrome storage:", newUrl);
                      chrome.storage.local.get("tokens", (result) => {
                        // console.log(
                        //   "Retrieved tokens from storage:",
                        //   result.tokens
                        // );
                      });
                    });
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
      .catch((error) => console.error("Error fetching the SVG:", error));

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
      .catch((error) =>
        console.error("Error fetching the clipboard SVG:", error)
      );

    const tokenQRButton = document.createElement("img");
    tokenQRButton.src = "./icons/tiny-qr.svg";
    tokenQRButton.className = "token-qr-button";
    tokenQRButton.id = name + "-token-qr-button";
    tokenElement.appendChild(tokenQRButton);

    tokenQRButton.addEventListener("click", async (e) => {
      // console.log("clicked qr code button");
      e.stopPropagation();
      if (document.querySelector(".popup-container")) {
        return;
      }

      const name = tokenQRButton.id.split("-token-qr-button")[0];

      chrome.storage.local.get(["tokens"], async (result) => {
        // console.log(result);
        const tokens = result.tokens || [];
        const tokenObj = tokens.find((token) => token.name === name);

        if (tokenObj) {
          let popupContainer = document.createElement("div");
          popupContainer.className = "popup-container";
          let popupContent = document.createElement("div");
          popupContent.className = "popup-content-qr";

          // Generate QR code as PNG data URL
          let qrDataURL;
          try {
            qrDataURL = await QRCode.toDataURL(tokenObj.secret, { width: 140 });
          } catch (error) {
            console.error(error);
          }

          popupContent.innerHTML = `
            <div>
              <h2 class="centered-headings shorter-width-heading">${tokenObj.name} Secret:</h2>
              <h3 class="centered-secret shorter-width-heading">${tokenObj.secret}</h3>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon" id="x-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
           <img src="${qrDataURL}" alt="QR Code" />
            </div>

          `;

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
        } else {
          console.error("Token not found.");
        }
      });
    });

    tokenElement.appendChild(nameHeader);
    tokenElement.appendChild(tokenHeader);
    tokensContainer.appendChild(tokenElement);

    updateToken(name, secret);
    let canClick = true;

    tokenElement.addEventListener("click", () => {
      if (!canClick || clipboardCopyingCheckbox.checked == false) return;
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
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon" id="x-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      </div>
      <h3 class="centered-headings">Are you sure? This action is permanent.</h3>
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
    popupContent.querySelector(".x-icon").addEventListener("click", () => {
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
        chrome.storage.sync.set({ tokens }, (result) => {
          // console.log(
          //   "sync was checked on, so saved tokens to sync storage, result:",
          //   result
          // );
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
      }

      chrome.storage.local.set({ tokens }, () => {
        // console.log(
        //   "reagrdless of whether sync was checked on or not, saving tokens to local storage; tokenObj: ",
        //   tokens
        // );
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

  function updateToken(name, secret) {
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
        chrome.storage.local.set({ tokens }, () => {
          // console.log(`Updated OTP for ${name} in chrome.storage: ${token}`);
        });
      }
    });
  }
});
