import { authenticator } from "otplib";
import QRCode from "qrcode";
import { openModal } from "./ui.js";

const BASE32_REGEX = /^[A-Z2-7]+=*$/;

export function normalizeSecret(secret = "") {
  return String(secret).replace(/\s+/g, "").toUpperCase();
}

export function isValidBase32(secret) {
  const normalized = normalizeSecret(secret);
  return normalized.length > 0 && BASE32_REGEX.test(normalized);
}

export function generateToken(secret) {
  const normalized = normalizeSecret(secret);
  if (BASE32_REGEX.test(normalized)) {
    return authenticator.generate(normalized);
  }
  return false;
}

// Scroll locking for modals is handled centrally in popup.js

export function createTokenUI({
  tokensContainer,
  syncCheckbox: syncChk,
  clipboardCopyingCheckbox: clipboardChk,
  autofillCheckbox: autofillChk,
  confirmDelete,
  deleteToken,
  createXIcon,
  i18nGetMessage: t,
  popupUpdate,
}) {
  // Drag & drop state
  let dndBound = false;
  let dragPlaceholder = null;

  function applyNameSizing(element, name) {
    const baseSize = 18;
    const minSize = 12;
    const overflow = Math.max(0, (name || "").length - 11);
    const reductionSteps = Math.ceil(overflow / 2);
    const fontSize = Math.max(minSize, baseSize - reductionSteps * 1.5);
    element.style.fontSize = `${fontSize}px`;
    element.textContent = name;
  }
  function ensureDragPlaceholder() {
    if (dragPlaceholder && dragPlaceholder.isConnected) {
      return dragPlaceholder;
    }
    dragPlaceholder = document.createElement("div");
    dragPlaceholder.setAttribute("data-role", "drag-placeholder");
    const style = dragPlaceholder.style;
    style.position = "fixed";
    style.top = "0";
    style.left = "0";
    style.width = "1px";
    style.height = "1px";
    style.opacity = "0";
    style.pointerEvents = "none";
    style.zIndex = "-1";
    document.body.appendChild(dragPlaceholder);
    return dragPlaceholder;
  }

  function cleanupDragPlaceholder() {
    if (dragPlaceholder && dragPlaceholder.isConnected) {
      dragPlaceholder.remove();
    }
    dragPlaceholder = null;
  }

  function saveOrderFromDOM() {
    const order = Array.from(
      tokensContainer.querySelectorAll(".token-box")
    ).map((el) => el.getAttribute("data-token-name"));
    try {
      chrome.storage.local.set({ tokenOrder: order });
      if (syncChk && syncChk.checked) {
        chrome.storage.sync.set({ tokenOrder: order });
      }
    } catch (e) {}
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".token-box:not(.dragging)")];
    return els.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - (box.top + box.height / 2);
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function bindDndContainerOnce() {
    if (dndBound) return;
    dndBound = true;
    tokensContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = tokensContainer.querySelector(".token-box.dragging");
      if (!dragging) return;
      // Do not auto-scroll if a modal overlay is open
      if (
        document.body.classList.contains("modal-active") ||
        document.querySelector(".popup-container")
      ) {
        return;
      }
      const after = getDragAfterElement(tokensContainer, e.clientY);
      if (after == null) tokensContainer.appendChild(dragging);
      else tokensContainer.insertBefore(dragging, after);
      // Auto-scroll window near viewport edges while dragging (smooth gradient)
      const viewportH = document.documentElement.clientHeight;
      const topThreshold = 100; // px from top
      const bottomStart = viewportH - 100; // start of bottom gradient
      const maxStep = 20; // px per event at deepest point
      if (e.clientY < topThreshold && window.pageYOffset > 0) {
        const intensity = Math.min(
          4,
          (topThreshold - e.clientY) / topThreshold
        ); // 0..1
        const dy = Math.max(1, Math.round(maxStep * intensity));
        window.scrollBy(0, -dy - 1);
        console.error("scrolling up", dy);
      } else if (e.clientY > bottomStart) {
        const intensity = Math.min(4, (e.clientY - bottomStart) / 50);
        const dy = Math.max(1, Math.round(maxStep * intensity));
        window.scrollBy(0, dy + 1);
        console.error("scrolling down", dy);
      }
    });
    tokensContainer.addEventListener("drop", (e) => {
      e.preventDefault();
      const dragging = tokensContainer.querySelector(".token-box.dragging");
      if (dragging) dragging.classList.remove("dragging");
      try {
        document.body.classList.remove("dragging-tokens");
      } catch (_) {}
      cleanupDragPlaceholder();
      saveOrderFromDOM();
    });
    tokensContainer.addEventListener("dragend", () => {
      const dragging = tokensContainer.querySelector(".token-box.dragging");
      if (dragging) dragging.classList.remove("dragging");
      try {
        document.body.classList.remove("dragging-tokens");
      } catch (_) {}
      cleanupDragPlaceholder();
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
    applyNameSizing(nameHeader, name);

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
          const {
            container: popupContainer,
            content: popupContent,
            close,
          } = openModal({ contentClass: "popup-content" });
          popupContent.textContent = "";

          const headerDiv = document.createElement("div");
          headerDiv.className = "centered-header";
          const headerText = document.createElement("h2");
          headerText.className = "centered-headings shorter-width-heading";
          headerText.textContent = `${name} ${t("token_settings")}`;
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
            autofillChk && autofillChk.checked
              ? t("autofill_url")
              : t("autofill_url_not_enabled");
          popupContent.appendChild(label);

          const urlInputWrapper = document.createElement("div");
          urlInputWrapper.className = "autofill-url-input-wrapper";

          const urlInput = document.createElement("input");
          urlInput.type = "text";
          urlInput.id = "autofill-url-input";
          urlInput.className = "form-input enter-url-placeholder";
          urlInput.placeholder = t("enter_url");
          urlInput.disabled = !(autofillChk && autofillChk.checked);
          urlInputWrapper.appendChild(urlInput);

          const clearUrlButton = document.createElement("button");
          clearUrlButton.type = "button";
          clearUrlButton.id = "clear-url-button";
          clearUrlButton.className = "clear-url-button";
          clearUrlButton.textContent = "\u00D7";
          const clearLabel = t("clear_saved_url");
          if (clearLabel) {
            clearUrlButton.title = clearLabel;
            clearUrlButton.setAttribute("aria-label", clearLabel);
          }
          clearUrlButton.disabled = !url;
          urlInputWrapper.appendChild(clearUrlButton);

          popupContent.appendChild(urlInputWrapper);

          const saveUrlButton = document.createElement("button");
          saveUrlButton.id = "save-url-button";
          saveUrlButton.className = "wide-button";
          saveUrlButton.textContent = t("save_url");
          popupContent.appendChild(saveUrlButton);

          const updateAutofillControls = () => {
            const enabled = !!(autofillChk && autofillChk.checked);
            urlInput.disabled = !enabled;
            saveUrlButton.disabled = !enabled;
            clearUrlButton.disabled = !url;
            label.textContent = enabled
              ? t("autofill_url")
              : t("autofill_url_not_enabled");
          };

          updateAutofillControls();

          if (autofillChk) {
            autofillChk.addEventListener("change", updateAutofillControls);
          }
          const buttonsContainer = document.createElement("div");
          buttonsContainer.className = "buttons-container";
          popupContent.appendChild(buttonsContainer);
          const inlineUrlDiv = document.createElement("div");
          inlineUrlDiv.className = "inline-url";
          const inlineLabel = document.createElement("label");
          inlineLabel.className = "form-label";
          inlineLabel.textContent = t("currently_saved");
          inlineUrlDiv.appendChild(inlineLabel);
          const currentUrlDiv = document.createElement("div");
          currentUrlDiv.id = "current-url";
          currentUrlDiv.className = "form-label";
          currentUrlDiv.textContent = shortenedUrl;
          inlineUrlDiv.appendChild(currentUrlDiv);
          popupContent.appendChild(inlineUrlDiv);
          const deleteButton = document.createElement("button");
          deleteButton.className = "delete-token";
          deleteButton.id = `delete-token-${name}`;
          const closeButton = document.createElement("button");
          closeButton.className = "close-popup";
          closeButton.textContent = chrome.i18n.getMessage("close");
          deleteButton.textContent = t("delete");
          buttonsContainer.appendChild(deleteButton);
          buttonsContainer.appendChild(closeButton);
          popupContent.appendChild(buttonsContainer);
          popupContainer.appendChild(popupContent);
          const xButton = document
            .getElementById("x-icon")
            .addEventListener("click", () => {
              document.body.classList.remove("modal-active");
              document.body.removeChild(popupContainer);
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
                if (syncChk && syncChk.checked) saveToSync();
                const displayUrl =
                  newUrl.length > 50 ? newUrl.substring(0, 50) + "..." : newUrl;
                currentUrlDiv.textContent = displayUrl;
                url = newUrl;
                shortenedUrl = displayUrl;
                urlInput.value = "";
                clearUrlButton.disabled = !url;
                updateAutofillControls();
              }
            });
          });

          clearUrlButton.addEventListener("click", () => {
            chrome.storage.local.get(["tokens"], (result) => {
              let tokens = result.tokens || [];
              const tokenIndex = tokens.findIndex((t) => t.name === name);
              if (tokenIndex !== -1) {
                if (tokens[tokenIndex].hasOwnProperty("url")) {
                  delete tokens[tokenIndex].url;
                }
                const saveToLocal = () =>
                  chrome.storage.local.set({ tokens }, () => {});
                const saveToSync = () =>
                  chrome.storage.sync.set({ tokens }, () => {});
                saveToLocal();
                if (syncChk && syncChk.checked) saveToSync();
                url = "";
                shortenedUrl = "";
                urlInput.value = "";
                currentUrlDiv.textContent = "";
                clearUrlButton.disabled = true;
                updateAutofillControls();
              }
            });
          });

          closeButton.addEventListener("click", close);
          popupContainer.addEventListener("click", (e) => {
            if (e.target === popupContainer) close();
          });

          deleteButton.addEventListener("click", () => {
            confirmDelete(name, secret, () =>
              deleteToken(
                name,
                secret,
                !!(syncChk && syncChk.checked),
                tokensContainer,
                addTokenToDOM
              )
            );
            close();
          });
        });
      })
      .catch((error) => console.error(error));

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
      .catch((error) => console.error(error));

    const tokenQRButton = document.createElement("img");
    tokenQRButton.src = "./icons/tiny-qr.svg";
    tokenQRButton.className = "token-qr-button";
    tokenQRButton.id = name + "-token-qr-button";
    tokenElement.appendChild(tokenQRButton);
    tokenQRButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const {
          container: popupContainer,
          content: popupContent,
          close,
        } = openModal({ contentClass: "popup-content-qr" });
        let qrDataURL = await QRCode.toDataURL(secret, { width: 140 });
        popupContent.textContent = "";
        const qrContainer = document.createElement("div");
        const secretHeader = document.createElement("h2");
        secretHeader.className = "centered-headings shorter-width-heading";
        secretHeader.textContent = `${name} ${t("secret")}`;
        qrContainer.appendChild(secretHeader);
        const secretValue = document.createElement("h3");
        secretValue.className = "centered-secret shorter-width-heading";
        secretValue.textContent = secret;
        qrContainer.appendChild(secretValue);
        const qrImage = document.createElement("img");
        qrImage.className = "qr-image";
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
        popupContainer.addEventListener("click", (e) => {
          if (e.target === popupContainer) close();
        });
        const redXButton = document.getElementById("x-icon");
        redXButton.addEventListener("click", close);
      } catch (error) {
        console.error(error);
      }
    });

    tokenElement.addEventListener("dragstart", (e) => {
      tokenElement.classList.add("dragging");
      try {
        document.body.classList.add("dragging-tokens");
      } catch (_) {}
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", name);
        try {
          e.dataTransfer.setDragImage(ensureDragPlaceholder(), 0, 0);
        } catch (_) {}
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
      if (!clipboardChk || !clipboardChk.checked) {
        const copiedMessage = document.createElement("div");
        copiedMessage.className = "not-copied-message";
        copiedMessage.textContent = t("enable_clipboard_copy_message");
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
          copiedMessage.textContent = t("copied");
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




