export function setAttributes(element, attributes) {
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, value);
    }
  });
}

export function createSwitchElement({
  id,
  label,
  tooltip,
  extraMessage,
  extraMessageId,
  isLast,
}) {
  const switchBox = document.createElement("div");
  switchBox.className = isLast ? "switch-box-last" : "switch-box";

  const switchLabel = document.createElement("label");
  switchLabel.className = "switch";
  if (id === "password-protected-checkbox" || id === "sync-checkbox") {
    switchLabel.id =
      id === "password-protected-checkbox"
        ? "password-protected-label"
        : "sync-check-label";
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = id;

  const slider = document.createElement("span");
  slider.className = "slider round";

  switchLabel.append(checkbox, slider);

  const switchText = document.createElement("div");
  switchText.className = "switch-text";
  switchText.textContent = chrome.i18n.getMessage(label);

  const tooltipContainer = document.createElement("div");
  tooltipContainer.className = "tooltip";

  const tooltipIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  setAttributes(tooltipIcon, {
    xmlns: "http://www.w3.org/2000/svg",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    class: "feather feather-info",
  });

  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  setAttributes(circle, { cx: "12", cy: "12", r: "10" });

  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  setAttributes(line1, { x1: "12", y1: "16", x2: "12", y2: "12" });

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  setAttributes(line2, { x1: "12", y1: "8", x2: "12.01", y2: "8" });

  tooltipIcon.append(circle, line1, line2);

  const tooltipText = document.createElement("span");
  tooltipText.className = "tooltiptext";
  tooltipText.textContent = chrome.i18n.getMessage(tooltip);

  tooltipContainer.append(tooltipIcon, tooltipText);

  if (extraMessage) {
    const extraMessageDiv = document.createElement("span");
    extraMessageDiv.className = extraMessageId;
    extraMessageDiv.id = extraMessageId;
    extraMessageDiv.textContent = chrome.i18n.getMessage(extraMessage);
    tooltipContainer.appendChild(extraMessageDiv);
  }

  switchBox.append(switchLabel, switchText, tooltipContainer);
  return switchBox;
}

export function setAdvancedAddMessage(text, visible) {
  const videoMessages = document.getElementById("advanced-add-messages");
  if (videoMessages) {
    videoMessages.textContent = text;
    videoMessages.style.visibility = visible ? "visible" : "hidden";
  }
}

export function confirmDelete(name, secret, onDelete) {
  const popupContainer = document.createElement("div");
  popupContainer.className = "popup-container";

  const popupContent = document.createElement("div");
  popupContent.className = "popup-message";

  const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  setAttributes(svgIcon, {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "red",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    class: "feather x-icon",
    id: "x-icon",
  });

  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  setAttributes(circle, { cx: "12", cy: "12", r: "10" });
  svgIcon.appendChild(circle);

  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  setAttributes(line1, { x1: "15", y1: "9", x2: "9", y2: "15" });
  svgIcon.appendChild(line1);

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  setAttributes(line2, { x1: "9", y1: "9", x2: "15", y2: "15" });
  svgIcon.appendChild(line2);

  popupContent.appendChild(svgIcon);

  const messageHeader = document.createElement("h3");
  messageHeader.className = "centered-headings";
  messageHeader.textContent = chrome.i18n.getMessage("are_you_sure_message");
  popupContent.appendChild(messageHeader);

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "buttons-container";

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-token-confirmation";
  deleteButton.id = "delete-token";
  deleteButton.textContent = chrome.i18n.getMessage("delete");
  buttonsContainer.appendChild(deleteButton);

  const closeButton = document.createElement("button");
  closeButton.className = "close-popup";
  closeButton.textContent = chrome.i18n.getMessage("close");
  buttonsContainer.appendChild(closeButton);

  popupContent.appendChild(buttonsContainer);
  popupContainer.appendChild(popupContent);
  document.body.appendChild(popupContainer);

  const removePopup = () => document.body.removeChild(popupContainer);
  closeButton.addEventListener("click", removePopup);
  svgIcon.addEventListener("click", removePopup);
  deleteButton.addEventListener("click", () => {
    onDelete();
    removePopup();
  });
}

export function el(tag, { className, id, text, attrs } = {}, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (id) node.id = id;
  if (text !== undefined && text !== null) node.textContent = text;
  if (attrs) setAttributes(node, attrs);
  if (children && children.length) node.append(...children);
  return node;
}

export function createXIcon({ stroke = "red", className, id } = {}) {
  const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  setAttributes(svgIcon, {
    xmlns: "http://www.w3.org/2000/svg",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: stroke,
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    class: className,
    id: id,
  });

  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  setAttributes(circle, { cx: "12", cy: "12", r: "10" });

  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  setAttributes(line1, { x1: "15", y1: "9", x2: "9", y2: "15" });

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  setAttributes(line2, { x1: "9", y1: "9", x2: "15", y2: "15" });

  svgIcon.append(circle, line1, line2);
  return svgIcon;
}

export function buildCloseAction(labelKey = "close") {
  // const container = el("div", { className: "buttons-container" });
  const button = el("button", {
    className: "close-popup",
    text: chrome.i18n.getMessage(labelKey),
  });
  buttonsContainer.appendChild(button);
  return { button };
}

export function buildHeader({
  title,
  level = "h2",
  headerClass = "centered-header",
  headingClass = "centered-headings shorter-width-heading",
  showClose = true,
  xId = "x-icon",
  stroke = "red",
} = {}) {
  const header = el("div", { className: headerClass });
  if (title) {
    const heading = document.createElement(level);
    heading.className = headingClass;
    heading.textContent = title;
    header.appendChild(heading);
  }
  let xIcon;
  if (showClose) {
    xIcon = createXIcon({ className: "feather x-icon", id: xId, stroke });
    header.appendChild(xIcon);
  }
  return { header, xIcon };
}

export function createPopup(message) {
  if (document.querySelector(".popup-container")) {
    return;
  }
  const popupContainer = document.createElement("div");
  popupContainer.className = "popup-container";
  const popupContent = document.createElement("div");
  popupContent.className = "popup-message";

  const { header: headerDiv, xIcon: svgIcon } = buildHeader({
    showClose: true,
  });

  const messageHeading = document.createElement("h3");
  messageHeading.className = "centered-headings shorter-width-heading";
  messageHeading.textContent = message;

  const { container: closeButtonContainer, button: closeButton } =
    buildCloseAction("close");

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

export function openModal({
  contentClass = "popup-content",
  onClose,
  overlayClose = true,
} = {}) {
  const container = el("div", { className: "popup-container" });
  const content = el("div", { className: contentClass });
  container.appendChild(content);
  document.body.appendChild(container);

  const close = () => {
    try {
      document.body.removeChild(container);
    } catch (_) {}
    if (onClose) onClose();
  };
  if (overlayClose) {
    container.addEventListener("click", (e) => {
      if (e.target === container) close();
    });
  }
  return { container, content, close };
}
