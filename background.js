// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "GET_TAB_URL") {
//     chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
//       sendResponse({ url: tabs[0].url });
//     });
//     return true; // Keep the messaging channel open for sendResponse
//   }
// });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length > 0) {
        sendResponse({ url: tabs[0].url });
      } else {
        sendResponse({ url: null });
      }
    });
    return true; // Keep the messaging channel open for sendResponse
  }
});
