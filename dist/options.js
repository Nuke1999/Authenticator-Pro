/******/ (() => { // webpackBootstrap
/*!************************!*\
  !*** ./src/options.js ***!
  \************************/
document.addEventListener("DOMContentLoaded", () => {
  function applySavedTheme() {
    chrome.storage.local.get("theme", (result) => {
      if (result.theme) {
        document.body.classList.add(result.theme);
      }
    });
  }

  applySavedTheme();
  let webcamOnIcon = document.createElement("img");
  webcamOnIcon.src = "./icons/video.svg";
  webcamOnIcon.className = "webcam-on-icon";
  webcamOnIcon.id = "webcam-on-icon";

  const cameraPermissionButton = document.getElementById(
    "camera-permission-button"
  );

  cameraPermissionButton.addEventListener("click", () => {
    // console.log("Requesting camera permission");
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        // console.log("Camera permission granted");
        stream.getTracks().forEach((track) => track.stop());
        chrome.runtime.sendMessage({ action: "cameraPermissionGranted" });
        window.close();
      })
      .catch((err) => {
        // console.log("The following error occurred: ", err.name);
        chrome.runtime.sendMessage({ action: "cameraPermissionDenied" });
        window.close();
      });
  });

  cameraPermissionButton.click();
});

/******/ })()
;
//# sourceMappingURL=options.js.map