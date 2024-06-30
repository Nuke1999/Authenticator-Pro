function sendTabUrlToContentScript(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "GET_TAB_URL" }, (response) => {
    console.log("Response from content script:", response);
  });
}

// Function to update OTPs
function updateOTPs() {
  chrome.storage.local.get(["tokens"], (result) => {
    const tokens = result.tokens || [];
    tokens.forEach((tokenObj, index) => {
      const otp = authenticator.generate(tokenObj.secret);
      tokens[index].otp = otp;
    });
    chrome.storage.local.set({ tokens });
  });
}

// Start updating OTPs every 30 seconds at :01 or :31
function startUpdatingOTPs() {
  const now = new Date();
  const seconds = now.getSeconds();
  const initialDelay =
    seconds < 1 || seconds >= 31 ? 60 - seconds : 30 - seconds;

  setTimeout(() => {
    updateOTPs();
    setInterval(updateOTPs, 30000); // 30 seconds interval
  }, initialDelay * 1000); // Align to next 1st or 31st second
}

// Call the start function to begin OTP updates
startUpdatingOTPs();

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    sendTabUrlToContentScript(tabId);
  }
});

// Listen for tab activations
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    sendTabUrlToContentScript(activeInfo.tabId);
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ url: tabs[0].url });
      } else {
        sendResponse({ url: null });
      }
    });
    return true; // Keep the messaging channel open for sendResponse
  }
});
