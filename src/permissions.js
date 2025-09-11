export async function requestAutofillPermission() {
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

export async function requestClipboardPermission() {
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

