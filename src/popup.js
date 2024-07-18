const { authenticator } = require("otplib");
const { Buffer } = require("buffer");
import QrScanner from "qr-scanner";
const QRCode = require("qrcode");

window.Buffer = Buffer;

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("name");
  const secretInput = document.getElementById("secret");
  const tokensContainer = document.getElementById("tokens");
  const mainContent = document.getElementById("main-content");
  const headerText = document.getElementById("centered-title");

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

  nameInput.focus();

  lightThemeButton.addEventListener("click", () => {
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
    chrome.storage.local.set({ theme: "theme-light" });
  });

  darkThemeButton.addEventListener("click", () => {
    document.body.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
    chrome.storage.local.set({ theme: "theme-dark" });
  });

  //clock land

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
    let offset;

    function getSecondsFromTimeApi() {
      return fetch(timeApiUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          // console.log(data);
          initialTime = new Date(data.datetime);
          offset = initialTime.getTime() - Date.now();
          return (
            initialTime.getSeconds() + initialTime.getMilliseconds() / 1000
          );
        });
    }

    function getSecondsFromLocalTime() {
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

    function startClock() {
      function tick() {
        const seconds = getSecondsFromLocalTime();
        updateClockWithSeconds(seconds);
        requestAnimationFrame(tick);
      }
      tick();
    }

    getSecondsFromTimeApi()
      .then(() => {
        startClock();
      })
      .catch((error) => {
        console.log("Error fetching online time:", error);
        offset = 0;
        startClock();
      });
  }

  updateClock();

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

  // chrome storage & sync

  try {
    chrome.storage.local.get(
      [
        "firstTime",
        "tokens",
        "autofillEnabled",
        "syncEnabled",
        "clipboardCopyingEnabled",
        "onlineTimeEnabled",
        "advancedAddEnabled",
        "theme",
      ],
      (result) => {
        console.log("first chrome local get", result);
        if (result.theme) {
          document.body.classList.add(result.theme);
        } else {
          document.body.classList.add("theme-light"); // Default to light theme
        }
        const isFirstTime = result.firstTime === undefined;
        // console.log(result);
        if (isFirstTime) {
          console.log("first time");
          chrome.storage.local.set(
            {
              firstTime: false,
              syncEnabled: true,
              autofillEnabled: true,
              clipboardCopyingEnabled: true,
              onlineTimeEnabled: true,
              advancedAddEnabled: false,
            },
            () => {
              syncCheckbox.checked = true;
              autofillCheckbox.checked = true;
              clipboardCopyingCheckbox.checked = true;
              onlineTimeCheckbox.checked = true;
              advancedAddCheckbox.checked = false;
            }
          );
          //
          chrome.storage.sync.set(
            {
              firstTime: false,
              syncEnabled: true,
              autofillEnabled: true,
              clipboardCopyingEnabled: true,
              onlineTimeEnabled: true,
              advancedAddEnabled: false,
            },
            () => {
              chrome.storage.sync.get((result) => {
                console.log(
                  "set up both local and sync storage; theoretically both should be: ",
                  result
                );
              });
            }
          );
          //
          chrome.storage.local.get((result) => {
            console.log(
              "chrome storage local after setting up first time: ",
              result
            );
          });
        } else {
          console.log(
            "is sync enbled? ",
            result.syncEnabled,
            "if so, getting sync storage info; if not, getting local storage info"
          );
          const storage = result.syncEnabled
            ? chrome.storage.sync
            : chrome.storage.local;

          storage.get(
            [
              "tokens",
              "autofillEnabled",
              "clipboardCopyingEnabled",
              "onlineTimeEnabled",
              "advancedAddEnabled",
              "fileUploadEnabled",
            ],
            (storageResult) => {
              // console.log(storageResult);
              if (storageResult.advancedAddEnabled) {
                // console.log("advanced add checked");
                formContainer.appendChild(advancedAddButton);
              } else {
                formContainer.style.display = "hidden";
              }

              if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError);
              }
              let tokens = storageResult.tokens || [];
              tokens.sort((a, b) => a.name.localeCompare(b.name));
              tokens.forEach((tokenObj) => {
                addTokenToDOM(
                  tokenObj.name,
                  tokenObj.secret,
                  tokenObj.url,
                  tokenObj.otp
                );
              });

              autofillCheckbox.checked =
                storageResult.autofillEnabled !== undefined
                  ? storageResult.autofillEnabled
                  : true;
              clipboardCopyingCheckbox.checked =
                storageResult.clipboardCopyingEnabled !== undefined
                  ? storageResult.clipboardCopyingEnabled
                  : true;
              onlineTimeCheckbox.checked =
                storageResult.onlineTimeEnabled !== undefined
                  ? storageResult.onlineTimeEnabled
                  : true;
              advancedAddCheckbox.checked =
                storageResult.advancedAddEnabled !== undefined
                  ? storageResult.advancedAddEnabled
                  : false;
              setupInitialUpdate(tokens);
            }
          );

          syncCheckbox.checked =
            result.syncEnabled !== undefined ? result.syncEnabled : true;
        }
        if (result.advancedAddEnabled) {
          // console.log("advanced add enabled");
          formContainer.appendChild(advancedAddButton);
        } else {
          // console.log("advancedAdd Not enabled");
        }
      }
    );
  } catch (error) {
    console.error("Error accessing local storage:", error);
  }

  try {
    chrome.storage.sync.get(null, (result) => {
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError);
      }
      console.log("Sync storage result:", result);
    });
  } catch (error) {
    console.error("Error accessing sync storage:", error);
  }

  autofillCheckbox.addEventListener("change", () => {
    // console.log("autofillcheckbox position: ", autofillCheckbox.checked);
    chrome.storage.local.get(["syncEnabled"], (syncResult) => {
      const storage = syncResult.syncEnabled
        ? chrome.storage.sync
        : chrome.storage.local;
      try {
        storage.set({ autofillEnabled: autofillCheckbox.checked });
      } catch (error) {
        console.error("Error setting autofillEnabled:", error);
      }
    });
  });

  syncCheckbox.addEventListener("change", () => {
    const useSync = syncCheckbox.checked;

    chrome.storage.local.set({ syncEnabled: useSync }, () => {
      if (useSync) {
        console.log("Sync checked");
        chrome.storage.local.get(
          [
            "tokens",
            "autofillEnabled",
            "clipboardCopyingEnabled",
            "onlineTimeEnabled",
            "advancedAddEnabled",
            "fileUploadEnabled",
          ],
          (result) => {
            console.log(result);
            if (chrome.runtime.lastError) {
              console.error(
                "Error accessing local storage:",
                chrome.runtime.lastError
              );
              return;
            }
            const tokens = result.tokens || [];
            const autofillEnabled = result.autofillEnabled || false;
            const clipboardCopyingEnabled =
              result.clipboardCopyingEnabled || false;
            const onlineTimeEnabled = result.onlineTimeEnabled || false;
            const advancedAddEnabled = result.advancedAddEnabled || false;
            const fileUploadEnabled = result.fileUploadEnabled || false;
            chrome.storage.sync.set(
              {
                tokens,
                autofillEnabled,
                clipboardCopyingEnabled,
                onlineTimeEnabled,
                advancedAddEnabled,
                fileUploadEnabled,
              },
              () => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error setting sync storage:",
                    chrome.runtime.lastError
                  );
                  return;
                }
                chrome.storage.local.remove(
                  [
                    "tokens",
                    "autofillEnabled",
                    "clipboardCopyingEnabled",
                    "onlineTimeEnabled",
                    "advancedAddEnabled",
                    "fileUploadEnabled",
                  ],
                  () => {
                    if (chrome.runtime.lastError) {
                      console.error(
                        "Error removing from local storage:",
                        chrome.runtime.lastError
                      );
                      return;
                    }
                    // console.log("Migrated tokens and settings to sync storage");
                    updateOTPs();
                  }
                );
              }
            );
          }
        );
      } else {
        // console.log("Sync unchecked");
        chrome.storage.sync.get(
          [
            "tokens",
            "autofillEnabled",
            "clipboardCopyingEnabled",
            "onlineTimeEnabled",
            "advancedAddEnabled",
            "fileUploadEnabled",
          ],
          (result) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error accessing sync storage:",
                chrome.runtime.lastError
              );
              return;
            }
            const tokens = result.tokens || [];
            const autofillEnabled = result.autofillEnabled || false;
            const clipboardCopyingEnabled =
              result.clipboardCopyingEnabled || false;
            const onlineTimeEnabled = result.onlineTimeEnabled || false;
            const advancedAddEnabled = result.advancedAddEnabled || false;
            const fileUploadEnabled = result.fileUploadEnabled || false;
            chrome.storage.local.set(
              {
                tokens,
                autofillEnabled,
                clipboardCopyingEnabled,
                onlineTimeEnabled,
                advancedAddEnabled,
                fileUploadEnabled,
              },
              () => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error setting local storage:",
                    chrome.runtime.lastError
                  );
                  return;
                }
                chrome.storage.sync.remove(
                  [
                    "tokens",
                    "autofillEnabled",
                    "clipboardCopyingEnabled",
                    "onlineTimeEnabled",
                    "advancedAddEnabled",
                    "fileUploadEnabled",
                  ],
                  () => {
                    if (chrome.runtime.lastError) {
                      console.error(
                        "Error removing from sync storage:",
                        chrome.runtime.lastError
                      );
                      return;
                    }
                    console.log(
                      "Migrated tokens and settings to local storage"
                    );
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

  clipboardCopyingCheckbox.addEventListener("change", () => {
    // console.log("clipboard copying: ", clipboardCopying.checked);
    chrome.storage.local.get(["syncEnabled"], (syncResult) => {
      const storage = syncResult.syncEnabled
        ? chrome.storage.sync
        : chrome.storage.local;
      try {
        storage.set({
          clipboardCopyingEnabled: clipboardCopyingCheckbox.checked,
        });
      } catch (error) {
        console.error("Error setting clipboardCopyingEnabled:", error);
      }
    });
  });

  onlineTimeCheckbox.addEventListener("change", () => {
    // console.log("online time sync: ", onlineTime.checked);
    chrome.storage.local.get(["syncEnabled"], (syncResult) => {
      const storage = syncResult.syncEnabled
        ? chrome.storage.sync
        : chrome.storage.local;
      try {
        storage.set({ onlineTimeEnabled: onlineTimeCheckbox.checked });
      } catch (error) {
        console.error("Error setting onlineTimeEnabled:", error);
      }
    });
  });

  advancedAddCheckbox.addEventListener("change", () => {
    if (advancedAddCheckbox.checked) {
      advancedAddButton.className = "advanced-add-button";
      formContainer.appendChild(advancedAddButton);
      advancedAddButton.style.display = "block";
    } else {
      advancedAddButton.style.display = "none";
    }
    chrome.storage.local.get(["syncEnabled"], (syncResult) => {
      const storage = syncResult.syncEnabled
        ? chrome.storage.sync
        : chrome.storage.local;
      try {
        storage.set({ advancedAddEnabled: advancedAddCheckbox.checked });
      } catch (error) {
        console.error("Error enabling advanced add:", error);
      }
      // console.log("advanced add button: ", advancedAddCheckbox.checked);
    });
  });

  function updateOTPs() {
    chrome.storage.local.get(["syncEnabled"], (syncResult) => {
      const storage = syncResult.syncEnabled
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
        const storage = syncCheckbox.checked
          ? chrome.storage.sync
          : chrome.storage.local;
        storage.get(["tokens"], (result) => {
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

  let isCooldown = false;

  function setVideoMessage(text, visible) {
    const videoMessages = document.getElementById("video-messages");
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
      <h3 class="video-messages" id="video-messages" style="visibility: hidden;">QR Code not found. Try a different image.</h3>
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
      <input type="text" id="image-url-input" class="form-input" placeholder="Enter URL" value="">
      <button id="add-url-button" class="add-url-button">Enter URL</button>
    </div>
  `;

    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);

    const webcamButton = document.getElementById("webcam-add-button");
    webcamButton.appendChild(webcamOnIcon);

    const fileAddButton = document.getElementById("image-add-button");
    fileAddButton.appendChild(imageIcon);

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
      webcamButton.innerHTML = "Webcam";
      webcamButton.appendChild(webcamOffIcon);
      setVideoMessage("QR Code not found. Try a different image.", false);
    };

    let saveUrlButton = document.getElementById("add-url-button");
    let imageUrlInput = document.getElementById("image-url-input");

    function saveImageUrl() {
      let addImageUrl = imageUrlInput.value;
      console.log("Image URL saved:", addImageUrl);

      QrScanner.scanImage(addImageUrl)
        .then((result) => {
          console.log("decoded qr code:", result);
          secretInput.value = result;
          document.body.removeChild(popupContainer);
        })
        .catch((error) => {
          setVideoMessage(
            "Incorrect URL, or URL did not contain QR code.",
            true
          );
          setTimeout(() => {
            setVideoMessage("QR Code not found. Try a different image.", false);
          }, 3000);
          console.log(error || "No QR code found.");
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
      }, 3000);
    });

    popupContainer.addEventListener("click", (e) => {
      if (e.target === popupContainer) {
        setTimeout(() => {
          stopCameraAndScanner();
        }, 1000); // Wait 1 second before executing stopCameraAndScanner()

        document.body.removeChild(popupContainer);
        isCooldown = true;
        setTimeout(() => {
          isCooldown = false;
        }, 3000);
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
          videoElem.pause(); // Ensure the video element is paused
          document.querySelector(".video-container").style.display = "none";
          webcamButton.innerHTML = "Webcam";
          webcamButton.appendChild(webcamOffIcon);
          setVideoMessage("QR Code not found. Try a different image.", false);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });

          videoElem.srcObject = stream;
          document.querySelector(".video-container").style.display = "block";

          webcamButton.innerHTML = "Webcam";
          webcamButton.appendChild(webcamOffIcon);

          setVideoMessage("Scanning...", true);

          qrScanner = new QrScanner(
            videoElem,
            (result) => {
              if (result.data) {
                console.log("decoded qr code:", result.data);
                secretInput.value = result.data;
                stream.getTracks().forEach((track) => track.stop());
                stream = null;
                videoElem.pause(); // Ensure the video element is paused
                document.querySelector(".video-container").style.display =
                  "none";
                document.body.removeChild(popupContainer);
                nameInput.focus();
                setVideoMessage(
                  "QR Code not found. Try a different image.",
                  false
                );
              } else {
                console.log("No valid QR code found");
              }
            },
            { returnDetailedScanResult: true }
          );

          qrScanner.start();
        }
      } catch (err) {
        console.log("Failed to access the camera:", err);
        const optionsUrl = chrome.runtime.getURL("options.html");
        if (document.querySelector(".popup-video-content")) {
          window.open(optionsUrl);
        }
      }

      isCooldown = true;
      setTimeout(() => {
        isCooldown = false;
      }, 3000);
    });

    document
      .getElementById("image-add-button")
      .addEventListener("click", () => {
        stopCameraAndScanner();
        document.querySelector(".video-container").style.display = "none";
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
            isCooldown = true;
            setTimeout(() => {
              isCooldown = false;
            }, 2000);
            nameInput.focus();
          } catch (error) {
            setVideoMessage("QR Code not found. Try a different image.", true);
            console.log(error || "No QR code found.");

            setTimeout(() => {
              setVideoMessage(
                "QR Code not found. Try a different image.",
                false
              );
            }, 5000);
          }

          e.target.value = "";
        }
      });
  });

  function createPopup(message) {
    if (document.querySelector(".popup-container")) {
      console.log("Popup already exists");
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

    const tokenQRButton = document.createElement("img");
    tokenQRButton.src = "./icons/tiny-qr.svg";
    tokenQRButton.className = "token-qr-button";
    tokenQRButton.id = name + "-token-qr-button";
    tokenElement.appendChild(tokenQRButton);

    tokenQRButton.addEventListener("click", async (e) => {
      console.log("clicked qr code button");
      e.stopPropagation();
      if (document.querySelector(".popup-container")) {
        return;
      }

      const name = tokenQRButton.id.split("-token-qr-button")[0]; // Get the token name

      const storage = syncCheckbox.checked
        ? chrome.storage.sync
        : chrome.storage.local;

      storage.get(["tokens"], async (result) => {
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
              <h2 class="centered-headings">${tokenObj.name} Secret:</h2> 
              <h3 class="centered-headings centered-secret">${tokenObj.secret}</h3>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather x-icon" id="x-icon"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
           <img src="${qrDataURL}" alt="QR Code" />


            </div>
 
          `;

          popupContainer.appendChild(popupContent);
          document.body.appendChild(popupContainer);

          let redXButton = document.getElementById("x-icon");
          redXButton.addEventListener("click", () => {
            document.body.removeChild(popupContainer);
          });
        } else {
          console.error("Token not found.");
        }
      });
    });

    tokenSettings.addEventListener("click", (e) => {
      e.stopPropagation();
      const storage = syncCheckbox.checked
        ? chrome.storage.sync
        : chrome.storage.local;
      storage.get(["tokens"], (result) => {
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
            <input type="text" id="autofill-url-input" class="form-input" placeholder="Enter URL" value="${url}">
            <button id="save-url-button" class="add-token-button" >Save URL</button>
            <div class="inline-url">
            <label class="form-label">Currently Saved: </label>
            <div id="current-url">${shortenedUrl}</div>
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
          autofillUrlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              saveUrlButton.click();
            }
          });

          saveUrlButton.addEventListener("click", () => {
            const newUrl = document
              .getElementById("autofill-url-input")
              .value.trim();
            const storage = syncCheckbox.checked
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
                    newUrl.length > urlLength
                      ? newUrl.substring(0, urlLength) + "..."
                      : newUrl;
                  document.getElementById("current-url").textContent =
                    displayUrl;
                  console.log("Saved URL to chrome storage:", newUrl);

                  // Retrieve and log the stored value to verify
                  storage.get("tokens", (result) => {
                    console.log(
                      "Retrieved tokens from storage:",
                      result.tokens
                    );
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
    const storage = syncCheckbox.checked
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

    const storage = syncCheckbox.checked
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

  // if (advancedAddCheckbox.checked) {
  //   console.log("advanced add enabled");
  //   formContainer.appendChild(advancedAddButton);
  // } else {
  //   console.log("advancedAdd Not enabled");
  // }

  function setupPeriodicTokenUpdate() {
    const storage = syncCheckbox.checked
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
