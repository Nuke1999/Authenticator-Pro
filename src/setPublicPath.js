/* global __webpack_public_path__ */

(() => {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      __webpack_public_path__ = chrome.runtime.getURL("dist/");
      return;
    }
  } catch (e) {
    // Fallback below.
  }
  __webpack_public_path__ = "dist/";
})();
