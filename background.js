chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "cameraPermissionGranted") {
    chrome.storage.local.set({ cameraPermissionGranted: true }, () => {
      console.log("Camera permission granted");
    });
  }

  if (message.action === "cameraPermissionDenied") {
    chrome.storage.local.set({ cameraPermissionGranted: false }, () => {
      console.log("Camera permission denied");
    });
  }

  if (message.type === "GET_TAB_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ url: tabs[0].url });
      } else {
        sendResponse({ url: null });
      }
    });
    return true;
  }
});
