export function deleteToken(name, secret, syncEnabled, tokensContainer, addTokenToDOM) {
  chrome.storage.local.get(["tokens"], (result) => {
    let tokens = result.tokens || [];
    tokens = tokens.filter(
      (tokenObj) => tokenObj.name !== name && tokenObj.secret !== secret
    );
    chrome.storage.local.get(["tokenOrder"], (orderRes) => {
      let order = Array.isArray(orderRes.tokenOrder) ? orderRes.tokenOrder.slice() : [];
      order = order.filter((n) => n !== name);
      const reorder = (list) => {
        if (!Array.isArray(order) || order.length === 0) return list.slice().sort((a,b)=>a.name.localeCompare(b.name));
        const map = new Map(order.map((n,i)=>[n,i]));
        const inOrder = [], rest = [];
        for (const t of list) (map.has(t.name) ? inOrder : rest).push(t);
        inOrder.sort((a,b)=>map.get(a.name)-map.get(b.name));
        rest.sort((a,b)=>a.name.localeCompare(b.name));
        return inOrder.concat(rest);
      };
      tokens = reorder(tokens);

      if (syncEnabled) {
        chrome.storage.sync.set({ tokens, tokenOrder: order }, () => {});
      }

      chrome.storage.local.set({ tokens, tokenOrder: order }, () => {
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
  });
}
