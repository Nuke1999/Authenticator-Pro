import { authenticator } from "otplib";
import QRCode from "qrcode";

export function isValidBase32(secret) {
  const base32Regex = /^[A-Z2-7]+=*$/i; // accept lowercase too
  return base32Regex.test(secret);
}

export function generateToken(secret) {
  if (isValidBase32(secret)) {
    return authenticator.generate(secret);
  }
  return false;
}

export function createTokenUI({
  tokensContainer,
  syncCheckbox,
  clipboardCopyingCheckbox,
  autofillCheckbox,
  confirmDelete,
  deleteToken,
  createXIcon,
  i18nGetMessage,
  popupUpdate,
}) {
  // Drag & drop state
  let dndBound = false;

  function saveOrderFromDOM() {
    const order = Array.from(
      tokensContainer.querySelectorAll(".token-box")
    ).map((el) => el.getAttribute("data-token-name"));
    try {
      chrome.storage.local.set({ tokenOrder: order });
      if (syncCheckbox && syncCheckbox.checked) {
        chrome.storage.sync.set({ tokenOrder: order });
      }
    } catch (e) {}
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.token-box:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function bindDndContainerOnce() {
    if (dndBound) return;
    dndBound = true;
    tokensContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = tokensContainer.querySelector(".token-box.dragging");
      if (!dragging) return;
      const after = getDragAfterElement(tokensContainer, e.clientY);
      if (after == null) tokensContainer.appendChild(dragging);
      else tokensContainer.insertBefore(dragging, after);
      const rect = tokensContainer.getBoundingClientRect();
      const edge = 36; // px threshold near edges
      const maxSpeed = 24; // px per dragover event
      if (e.clientY > rect.bottom - edge) {
        const proximity = Math.min(edge, e.clientY - (rect.bottom - edge));
        const speed = Math.max(2, Math.round((proximity / edge) * maxSpeed));
        tokensContainer.scrollTop += speed;
      } else if (e.clientY < rect.top + edge) {
        const proximity = Math.min(edge, rect.top + edge - e.clientY);
        const speed = Math.max(2, Math.round((proximity / edge) * maxSpeed));
        tokensContainer.scrollTop -= speed;
      }
    });
    tokensContainer.addEventListener("drop", (e) => {
      e.preventDefault();
      const dragging = tokensContainer.querySelector(".token-box.dragging");
      if (dragging) dragging.classList.remove("dragging");
      saveOrderFromDOM();
    });
    tokensContainer.addEventListener("dragend", () => {
      const dragging = tokensContainer.querySelector(".token-box.dragging");
      if (dragging) dragging.classList.remove("dragging");
      saveOrderFromDOM();
    });
  }
  function addTokenToDOM(name, secret, url, otp) {
    const tokenElement = document.createElement("div");
    tokenElement.id = `token-${name}`;
    tokenElement.classList.add("token-box");
    tokenElement.setAttribute("data-token-name", name);
    tokenElement.setAttribute("draggable", "true");

    const nameHeader = document.createElement("h2");
    nameHeader.className = "token-name";
    nameHeader.textContent = `${name}`;

    const tokenHeader = document.createElement("h1");
    tokenHeader.className = "token-value";
    tokenHeader.textContent = otp;

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
          let shortenedUrl = url || "";
          const urlLength = 50;
          if (url && url.length > urlLength) {
            shortenedUrl = url.substring(0, urlLength) + "...";
          }
          const popupContainer = document.createElement("div");
          popupContainer.className = "popup-container";
          try {
            const hasVScroll =
              document.body.scrollHeight > document.body.clientHeight;
            if (hasVScroll) {
              const sbw = Math.max(
                0,
                window.innerWidth - document.documentElement.clientWidth
              );
              popupContainer.style.paddingRight = sbw + "px";
            }
          } catch (_) {}
          const popupContent = document.createElement("div");
          popupContent.className = "popup-content";
          popupContent.textContent = "";

          const headerDiv = document.createElement("div");
          headerDiv.className = "centered-header";
          const headerText = document.createElement("h2");
          headerText.className = "centered-headings shorter-width-heading";
          headerText.textContent = `${name} ${i18nGetMessage(
            "token_settings"
          )}`;
          headerDiv.appendChild(headerText);

          const svgIcon = createXIcon({
            className: "feather x-icon",
            id: "x-icon",
            stroke: "red",
          });
          headerDiv.appendChild(svgIcon);
          popupContent.appendChild(headerDiv);

          const label = document.createElement("label");
          label.setAttribute("for", "name");
          label.className = "form-label";
          label.id = "autofill-url-label";
          label.textContent =
            autofillCheckbox && autofillCheckbox.checked
              ? i18nGetMessage("autofill_url")
              : i18nGetMessage("autofill_url_not_enabled");
          popupContent.appendChild(label);

          const urlInput = document.createElement("input");
          urlInput.type = "text";
          urlInput.id = "autofill-url-input";
          urlInput.className = "form-input enter-url-placeholder";
          urlInput.disabled = !(autofillCheckbox && autofillCheckbox.checked);
          popupContent.appendChild(urlInput);
          if (autofillCheckbox) {
            autofillCheckbox.addEventListener("change", function () {
              if (autofillCheckbox.checked) {
                urlInput.disabled = false;
                label.textContent = i18nGetMessage("autofill_url");
              } else {
                urlInput.disabled = true;
                label.textContent = i18nGetMessage("autofill_url_not_enabled");
              }
            });
          }

          const saveUrlButton = document.createElement("button");
          saveUrlButton.id = "save-url-button";
          saveUrlButton.className = "wide-button";
          saveUrlButton.textContent = i18nGetMessage("save_url");
          popupContent.appendChild(saveUrlButton);

          const inlineUrlDiv = document.createElement("div");
          inlineUrlDiv.className = "inline-url";
          const inlineLabel = document.createElement("label");
          inlineLabel.className = "form-label";
          inlineLabel.textContent = i18nGetMessage("currently_saved");
          inlineUrlDiv.appendChild(inlineLabel);
          const currentUrlDiv = document.createElement("div");
          currentUrlDiv.id = "current-url";
          currentUrlDiv.className = "form-label";
          currentUrlDiv.textContent = shortenedUrl;
          inlineUrlDiv.appendChild(currentUrlDiv);
          popupContent.appendChild(inlineUrlDiv);

          const buttonsContainer = document.createElement("div");
          buttonsContainer.className = "buttons-container";
          const deleteButton = document.createElement("button");
          deleteButton.className = "delete-token";
          deleteButton.id = "delete-token";
          deleteButton.textContent = i18nGetMessage("delete");
          buttonsContainer.appendChild(deleteButton);
          const closeButton = document.createElement("button");
          closeButton.className = "close-popup";
          closeButton.textContent = i18nGetMessage("close");
          buttonsContainer.appendChild(closeButton);
          popupContent.appendChild(buttonsContainer);
          popupContainer.appendChild(popupContent);
          document.documentElement.appendChild(popupContainer);
          try {
            document.body.classList.add("modal-active");
          } catch (_) {}

          document.getElementById("x-icon").addEventListener("click", () => {
            try {
              popupContainer.remove();
            } catch (_) {}
            try {
              document.body.classList.remove("modal-active");
            } catch (_) {}
          });
          urlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveUrlButton.click();
          });

          saveUrlButton.addEventListener("click", () => {
            const newUrl = urlInput.value;
            if (!newUrl) return;
            chrome.storage.local.get(["tokens"], (result) => {
              let tokens = result.tokens || [];
              const tokenIndex = tokens.findIndex((t) => t.name === name);
              if (tokenIndex !== -1) {
                tokens[tokenIndex].url = newUrl;
                const saveToLocal = () =>
                  chrome.storage.local.set({ tokens }, () => {});
                const saveToSync = () =>
                  chrome.storage.sync.set({ tokens }, () => {});
                saveToLocal();
                if (syncCheckbox && syncCheckbox.checked) saveToSync();
                const displayUrl =
                  newUrl.length > 50 ? newUrl.substring(0, 50) + "..." : newUrl;
                currentUrlDiv.textContent = displayUrl;
              }
            });
          });

          closeButton.addEventListener("click", () => {
            try {
              popupContainer.remove();
            } catch (_) {}
            try {
              document.body.classList.remove("modal-active");
            } catch (_) {}
          });
          popupContainer.addEventListener("click", (e) => {
            if (e.target === popupContainer) {
              try {
                popupContainer.remove();
              } catch (_) {}
              try {
                document.body.classList.remove("modal-active");
              } catch (_) {}
            }
          });

          deleteButton.addEventListener("click", () => {
            confirmDelete(name, secret, () =>
              deleteToken(
                name,
                secret,
                !!(syncCheckbox && syncCheckbox.checked),
                tokensContainer,
                addTokenToDOM
              )
            );
            try {
              popupContainer.remove();
            } catch (_) {}
            try {
              document.body.classList.remove("modal-active");
            } catch (_) {}
          });
        });
      })
      .catch((error) => console.log(error));

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
      .catch((error) => console.log(error));

    const tokenQRButton = document.createElement("img");
    tokenQRButton.src = "./icons/tiny-qr.svg";
    tokenQRButton.className = "token-qr-button";
    tokenQRButton.id = name + "-token-qr-button";
    tokenElement.appendChild(tokenQRButton);
    tokenQRButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const popupContainer = document.createElement("div");
        popupContainer.className = "popup-container";
        try {
          const hasVScroll =
            document.body.scrollHeight > document.body.clientHeight;
          if (hasVScroll) {
            const sbw = Math.max(
              0,
              window.innerWidth - document.documentElement.clientWidth
            );
            popupContainer.style.paddingRight = sbw + "px";
          }
        } catch (_) {}
        const popupContent = document.createElement("div");
        popupContent.className = "popup-content-qr";
        let qrDataURL = await QRCode.toDataURL(secret, { width: 140 });
        popupContent.textContent = "";
        const qrContainer = document.createElement("div");
        const secretHeader = document.createElement("h2");
        secretHeader.className = "centered-headings shorter-width-heading";
        secretHeader.textContent = `${name} ${i18nGetMessage("secret")}`;
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
        const svgIcon = createXIcon({
          className: "feather x-icon",
          id: "x-icon",
          stroke: "red",
        });
        qrContainer.appendChild(svgIcon);
        popupContent.appendChild(qrContainer);
        popupContainer.appendChild(popupContent);
        document.documentElement.appendChild(popupContainer);
        try {
          document.body.classList.add("modal-active");
        } catch (_) {}
        popupContainer.addEventListener("click", (e) => {
          if (e.target === popupContainer)
            try {
              popupContainer.remove();
            } catch (_) {}
        });
        const redXButton = document.getElementById("x-icon");
        redXButton.addEventListener("click", () => {
          try {
            popupContainer.remove();
          } catch (_) {}
          try {
            document.body.classList.remove("modal-active");
          } catch (_) {}
        });
      } catch (error) {
        console.log(error);
      }
    });

    tokenElement.addEventListener("dragstart", (e) => {
      tokenElement.classList.add("dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", name);
      } catch (_) {}
    });

    tokenElement.appendChild(nameHeader);
    tokenElement.appendChild(tokenHeader);
    tokensContainer.appendChild(tokenElement);
    bindDndContainerOnce();
    updateToken(name, secret);

    let canClick = true;
    tokenElement.addEventListener("click", async () => {
      if (tokenElement.classList.contains("dragging")) return;
      if (!canClick) return;
      if (!clipboardCopyingCheckbox || !clipboardCopyingCheckbox.checked) {
        const copiedMessage = document.createElement("div");
        copiedMessage.className = "not-copied-message";
        copiedMessage.textContent = i18nGetMessage(
          "enable_clipboard_copy_message"
        );
        tokenElement.appendChild(copiedMessage);
        canClick = false;
        setTimeout(() => {
          tokenElement.removeChild(copiedMessage);
          canClick = true;
        }, 3000);
      } else {
        const tokenValue =
          tokenElement.closest(".token-box")?.querySelector(".token-value")
            ?.textContent || "";
        navigator.clipboard.writeText(tokenValue).then(() => {
          const copiedMessage = document.createElement("div");
          copiedMessage.className = "copied-message";
          copiedMessage.textContent = i18nGetMessage("copied");
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

  async function updateToken(name, secret) {
    if (popupUpdate) popupUpdate();
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

  return { addTokenToDOM, updateToken };
}
