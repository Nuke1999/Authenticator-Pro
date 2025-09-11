export function deleteToken(name, secret, syncEnabled, tokensContainer, addTokenToDOM) {
  chrome.storage.local.get(["tokens"], (result) => {
    let tokens = result.tokens || [];
    tokens = tokens.filter(
      (tokenObj) => tokenObj.name !== name && tokenObj.secret !== secret
    );
    tokens.sort((a, b) => a.name.localeCompare(b.name));

    if (syncEnabled) {
      chrome.storage.sync.set({ tokens }, () => {});
    }

    chrome.storage.local.set({ tokens }, () => {
      while (tokensContainer.firstChild) {
        tokensContainer.removeChild(tokensContainer.firstChild);
      }
      tokens.forEach((tokenObj) => {
        addTokenToDOM(
          tokenObj.name,
          tokenObj.secret,
          tokenObj.url,
          tokenObj.otp
        );
      });
    });
  });
}
