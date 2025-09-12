import QrScanner from "qr-scanner";
import { createXIcon } from "./ui.js";

export function initAdvancedAdd({
  advancedAddButton,
  secretFormLabel,
  nameInput,
  secretInput,
  i18nGetMessage,
  setAdvancedAddMessage,
}) {
  let isCooldown = false;
  let webcamButton = document.createElement("button");

  advancedAddButton.addEventListener("click", async () => {
    if (document.querySelector(".popup-container") || isCooldown) return;

    const popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    const popupContent = document.createElement("div");
    popupContent.className = "popup-content";

    const headerDiv = document.createElement("div");
    headerDiv.className = "centered-header";
    const heading = document.createElement("h2");
    heading.className = "centered-headings shorter-width-heading";
    heading.textContent = i18nGetMessage("add_qr_code_via");
    headerDiv.appendChild(heading);
    const svgIcon = createXIcon({
      className: "feather x-icon",
      id: "x-icon",
      stroke: "red",
    });
    headerDiv.appendChild(svgIcon);
    popupContent.appendChild(headerDiv);

    const errorMessage = document.createElement("div");
    errorMessage.className = "advanced-add-messages";
    errorMessage.id = "advanced-add-messages";
    errorMessage.textContent = i18nGetMessage("qr_not_found_message");
    popupContent.appendChild(errorMessage);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "buttons-container";

    webcamButton.className = "webcam-add-button";
    webcamButton.id = "webcam-add-button";
    webcamButton.textContent = i18nGetMessage("webcam");
    buttonsContainer.appendChild(webcamButton);

    const addImageButton = document.createElement("button");
    addImageButton.className = "image-add-button";
    addImageButton.id = "image-add-button";
    addImageButton.textContent = i18nGetMessage("image");
    buttonsContainer.appendChild(addImageButton);
    popupContent.appendChild(buttonsContainer);

    const webcamOffIcon = document.createElement("img");
    webcamOffIcon.src = "./icons/video-off.svg";
    webcamOffIcon.className = "webcam-off-icon";
    webcamOffIcon.id = "webcam-off-icon";
    const webcamOnIcon = document.createElement("img");
    webcamOnIcon.src = "./icons/video.svg";
    webcamOnIcon.className = "webcam-on-icon";
    webcamOnIcon.id = "webcam-on-icon";

    const inputDiv = document.createElement("div");
    inputDiv.className = "form-label-container";
    const label = document.createElement("label");
    label.className = "form-label";
    label.textContent = i18nGetMessage("image_url");
    inputDiv.appendChild(label);
    const input = document.createElement("input");
    input.type = "text";
    input.id = "image-url-input";
    input.className = "form-input enter-url-placeholder";
    input.placeholder = i18nGetMessage("image_url_placeholder");
    inputDiv.appendChild(input);
    popupContent.appendChild(inputDiv);

    const addButton = document.createElement("button");
    addButton.className = "wide-button";
    addButton.textContent = i18nGetMessage("enter_url");
    popupContent.appendChild(addButton);

    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);

    const qrCodeFoundMessage = document.createElement("div");
    qrCodeFoundMessage.className = "secret-found-message";
    qrCodeFoundMessage.textContent = i18nGetMessage("qr_found_message");
    function qrCodeFound() {
      secretFormLabel.insertAdjacentElement("afterend", qrCodeFoundMessage);
      setTimeout(() => {
        try {
          qrCodeFoundMessage.remove();
        } catch (_) {}
      }, 2000);
    }

    let qrScanner = null;
    const stopCameraAndScanner = () => {
      try {
        if (qrScanner) {
          qrScanner.stop();
          qrScanner = null;
        }
      } catch (_) {}
      try {
        const video = document.getElementById("qr-video");
        if (video && video.srcObject) {
          video.srcObject.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
        }
        if (video && video.parentElement) video.parentElement.removeChild(video);
        // revert modal class back to default when stopping webcam
        try { popupContent.className = "popup-content"; } catch (_) {}
      } catch (_) {}
    };

    svgIcon.addEventListener("click", () => {
      stopCameraAndScanner();
      document.body.removeChild(popupContainer);
    });
    popupContainer.addEventListener("click", (e) => {
      if (e.target === popupContainer) {
        stopCameraAndScanner();
        document.body.removeChild(popupContainer);
      }
    });

    // Top Image button opens OS file picker (matches previous behavior)
    addImageButton.addEventListener("click", () => {
      const fileInput = document.getElementById("file-input");
      if (fileInput) fileInput.click();
    });

    // initial icons on buttons
    webcamButton.appendChild(webcamOnIcon.cloneNode(true));
    const imageIcon = document.createElement("img");
    imageIcon.src = "./icons/image.svg";
    imageIcon.className = "image-icon";
    addImageButton.appendChild(imageIcon);

    webcamButton.addEventListener("click", async () => {
      const currentText = webcamButton.textContent;
      const isOn =
        currentText === "Webcam" ||
        (currentText === i18nGetMessage("webcam") &&
          webcamButton.querySelector("#webcam-off-icon"));
      if (webcamButton.querySelector("#webcam-off-icon")) {
        webcamButton.textContent = i18nGetMessage("webcam");
        webcamButton.appendChild(webcamOnIcon.cloneNode(true));
        stopCameraAndScanner();
        return;
      }
      webcamButton.textContent = "Webcam";
      webcamButton.appendChild(webcamOffIcon);
      // switch modal layout to video mode so it grows to fit
      popupContent.className = "popup-video-content";
      const video = document.createElement("video");
      video.id = "qr-video";
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.style.width = "100%";
      video.style.height = "auto";
      popupContent.appendChild(video);
      try {
        qrScanner = new QrScanner(
          video,
          (result) => {
            try {
              const data = result.data;
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
              qrCodeFound();
              stopCameraAndScanner();
              document.body.removeChild(popupContainer);
              isCooldown = true;
              setTimeout(() => {
                isCooldown = false;
              }, 2000);
              nameInput.focus();
            } catch (_) {}
          },
          { returnDetailedScanResult: true }
        );
        await qrScanner.start();
      } catch (err) {
        // Preserve previous behavior: open popup window to enable camera context
        try {
          const params = new URLSearchParams(window.location.search);
          const isPopup = params.get("isPopup") === "true";
          if (!isPopup) {
            chrome.storage.local.get(["uiScale"], (res) => {
              const scale =
                typeof res.uiScale === "number" && res.uiScale > 0
                  ? res.uiScale
                  : 1;
              const BASE_W = 300,
                BASE_H = 450,
                CHROME_W = 14,
                CHROME_H = 30;
              chrome.windows.create({
                url:
                  chrome.runtime.getURL("authenticator.html") +
                  "?isPopup=true&isVideoPermission=true",
                type: "popup",
                width: Math.round(BASE_W * scale + CHROME_W),
                height: Math.round(BASE_H * scale + CHROME_H),
              });
              window.close();
            });
          }
        } catch (_) {}
      }
    });

    document.getElementById("file-input").addEventListener(
      "change",
      async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const result = await QrScanner.scanImage(file, {
            returnDetailedScanResult: true,
          });
          const data = result.data;
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
          setAdvancedAddMessage(i18nGetMessage("qr_not_found_message"), true);
        }
        e.target.value = "";
      },
      { once: true }
    );

    // Bottom "Enter Url" triggers URL scan
    addButton.addEventListener("click", async () => {
      try {
        const addImageUrl = document.getElementById("image-url-input").value;
        const result = await QrScanner.scanImage(addImageUrl, {
          returnDetailedScanResult: true,
        });
        const data = result.data;
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
        setAdvancedAddMessage(i18nGetMessage("incorrect_url_message"), true);
        setTimeout(
          () =>
            setAdvancedAddMessage(
              i18nGetMessage("qr_not_found_message"),
              false
            ),
          3000
        );
      }
    });
  });

  return {
    getWebcamButton: () => webcamButton,
  };
}
