export async function getStoredScale() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["uiScale"], (result) => {
      const v = result.uiScale;
      resolve(typeof v === "number" && v > 0 ? v : 1);
    });
  });
}

export function applyScale(scale) {
  const s = typeof scale === "number" && scale > 0 ? scale : 1;
  document.documentElement.style.setProperty("--ui-scale", String(s));
  // If we are in popup window mode, update the outer window size to match scale
  try {
    chrome.windows.getCurrent((win) => {
      if (!win || win.type !== "popup") return;
      const BASE_W = 300, BASE_H = 450, CHROME_W = 14, CHROME_H = 30;
      const width = Math.round(BASE_W * s + CHROME_W);
      const height = Math.round(BASE_H * s + CHROME_H);
      chrome.windows.update(win.id, { width, height });
    });
  } catch (_) {}
}

export async function applyStoredScale() {
  try {
    const scale = await getStoredScale();
    applyScale(scale);
  } catch (e) {
    // no-op
  }
}

export function initScaleControl(settingsContainer) {
  // Avoid duplicate control
  if (settingsContainer.querySelector("#ui-scale-control")) return;

  const section = document.createElement("div");
  section.className = "scale-section";

  const header = document.createElement("h2");
  header.className = "scale-header";
  header.textContent = "Scale";
  section.appendChild(header);

  const select = document.createElement("select");
  select.id = "ui-scale-control";
  select.className = "form-input";
  const options = [
    { label: "75%", value: 0.75 },
    { label: "90%", value: 0.9 },
    { label: "100%", value: 1 },
    { label: "110%", value: 1.1 },
    { label: "120%", value: 1.2 },
    { label: "130%", value: 1.3 },
    { label: "150%", value: 1.5 },
  ];
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = String(opt.value);
    o.textContent = opt.label;
    select.appendChild(o);
  });

  // Load current value
  getStoredScale().then((scale) => {
    const closest = options
      .map((o) => o.value)
      .reduce(
        (prev, curr) =>
          Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev,
        1
      );
    select.value = String(closest);
  });

  select.addEventListener("change", () => {
    const val = parseFloat(select.value);
    chrome.storage.local.set({ uiScale: val }, () => {});
    try {
      const syncCheckbox = document.getElementById("sync-checkbox");
      if (syncCheckbox && syncCheckbox.checked) {
        chrome.storage.sync.set({ uiScale: val }, () => {});
      }
    } catch (_) {}
    applyScale(val);
    // If in popup window mode, resize the window to match new scale
    try {
      chrome.storage.local.get(["popupModeCheckbox"], (res) => {
        if (res && res.popupModeCheckbox) {
          const BASE_W = 300;
          const BASE_H = 450;
          // Account for window chrome used previously (314x480 in code)
          const CHROME_W = 14; // 314 - 300
          const CHROME_H = 30; // 480 - 450
          const width = Math.round(BASE_W * val + CHROME_W);
          const height = Math.round(BASE_H * val + CHROME_H);
          chrome.windows.getCurrent((win) => {
            if (win && win.type === "popup") {
              chrome.windows.update(win.id, { width, height });
            }
          });
        }
      });
    } catch (e) {
      // ignore
    }
  });

  section.appendChild(select);
  // Insert after the theme buttons section to avoid overlapping headers
  const buttons = settingsContainer.querySelector(".theme-buttons-container");
  if (buttons) {
    buttons.insertAdjacentElement("afterend", section);
  } else {
    settingsContainer.appendChild(section);
  }
}

export function initExportControls(settingsContainer) {
  if (settingsContainer.querySelector("#export-section")) return;

  const section = document.createElement("div");
  section.id = "export-section";

  const header = document.createElement("h2");
  header.className = "themes-header";
  header.textContent = "Export";

  const row = document.createElement("div");
  row.className = "theme-buttons-container";

  const exportBtn = document.createElement("button");
  exportBtn.className = "light-theme-button";
  exportBtn.textContent = "Export Data";
  row.appendChild(exportBtn);
  section.appendChild(row);

  const insertAfter = settingsContainer.querySelector(".scale-section");
  if (insertAfter) insertAfter.insertAdjacentElement("afterend", section);
  else settingsContainer.appendChild(section);

  exportBtn.addEventListener("click", () => {
    const popupContainer = document.createElement("div");
    popupContainer.className = "popup-container";
    try {
      const sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      if (sbw) popupContainer.style.paddingRight = sbw + "px";
    } catch (_) {}
    const popupContent = document.createElement("div");
    popupContent.className = "popup-content";

    const heading = document.createElement("h2");
    heading.className = "centered-headings";
    heading.textContent = "Export Options";
    popupContent.appendChild(heading);

    const btns = document.createElement("div");
    btns.className = "export-buttons";

    const csvBtn = document.createElement("button");
    csvBtn.className = "wide-button";
    csvBtn.textContent = "Export CSV";
    btns.appendChild(csvBtn);

    const pdfBtn = document.createElement("button");
    pdfBtn.className = "wide-button";
    pdfBtn.textContent = "Export PDF";
    btns.appendChild(pdfBtn);

    const docBtn = document.createElement("button");
    docBtn.className = "wide-button";
    docBtn.textContent = "Export Word (.doc)";
    btns.appendChild(docBtn);

    popupContent.appendChild(btns);
    popupContainer.appendChild(popupContent);
    document.documentElement.appendChild(popupContainer);
    try { document.body.classList.add("modal-active"); } catch (_) {}

    const close = () => {
      try { popupContainer.remove(); } catch (_) {}
      try { document.body.classList.remove("modal-active"); } catch (_) {}
    };
    popupContainer.addEventListener("click", (e) => { if (e.target === popupContainer) close(); });

    function downloadBlob(filename, mime, content) {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportCSV(tokens) {
      const header = ['name','secret','url','otp'];
      const lines = [header.join(',')];
      tokens.forEach(t => {
        const vals = [t.name||'', t.secret||'', t.url||'', t.otp||'']
          .map(v => '"' + String(v).replace(/"/g,'""') + '"');
        lines.push(vals.join(','));
      });
      downloadBlob('authenticator-export.csv', 'text/csv;charset=utf-8', lines.join('\r\n'));
    }

    function exportDOC(tokens) {
      const rows = tokens.map(t => `<tr><td>${t.name||''}</td><td>${t.secret||''}</td><td>${t.url||''}</td><td>${t.otp||''}</td></tr>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title></head><body><table border="1" cellspacing="0" cellpadding="4"><thead><tr><th>Name</th><th>Secret</th><th>URL</th><th>OTP</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
      downloadBlob('authenticator-export.doc', 'application/msword', html);
    }

    function exportPDF(tokens) {
      const rows = tokens.map(t => `<tr><td>${t.name||''}</td><td>${t.secret||''}</td><td>${t.url||''}</td><td>${t.otp||''}</td></tr>`).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Export PDF</title><style>body{font-family:Arial, sans-serif;padding:16px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:6px;font-size:12px;}</style></head><body><h2>Authenticator Export</h2><table><thead><tr><th>Name</th><th>Secret</th><th>URL</th><th>OTP</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=function(){window.print();}</script></body></html>`;
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      }
    }

    csvBtn.addEventListener('click', () => {
      chrome.storage.local.get(['tokens'], (res) => {
        exportCSV(Array.isArray(res.tokens) ? res.tokens : []);
        close();
      });
    });
    docBtn.addEventListener('click', () => {
      chrome.storage.local.get(['tokens'], (res) => {
        exportDOC(Array.isArray(res.tokens) ? res.tokens : []);
        close();
      });
    });
    pdfBtn.addEventListener('click', () => {
      chrome.storage.local.get(['tokens'], (res) => {
        exportPDF(Array.isArray(res.tokens) ? res.tokens : []);
        close();
      });
    });
  });
}

export function initThemeControls({
  lightThemeButton,
  darkThemeButton,
  syncCheckbox,
  oceanThemeButton,
  forestThemeButton,
}) {
  // Fallback: query buttons if not provided
  if (!lightThemeButton) lightThemeButton = document.getElementById("light-theme-button");
  if (!darkThemeButton) darkThemeButton = document.getElementById("dark-theme-button");
  if (!oceanThemeButton) oceanThemeButton = document.getElementById("ocean-theme-button");
  if (!forestThemeButton) forestThemeButton = document.getElementById("forest-theme-button");

  const applyTheme = (theme) => {
    const classes = ["theme-light", "theme-dark", "theme-ocean", "theme-forest"];
    document.body.classList.remove(...classes);
    document.body.classList.add(theme);
    chrome.storage.local.set({ theme });
    if (syncCheckbox && syncCheckbox.checked) {
      chrome.storage.sync.set({ theme });
    }
  };
  if (lightThemeButton) {
    lightThemeButton.addEventListener("click", () => applyTheme("theme-light"));
  }
  if (darkThemeButton) {
    darkThemeButton.addEventListener("click", () => applyTheme("theme-dark"));
  }
  if (oceanThemeButton) {
    oceanThemeButton.addEventListener("click", () => applyTheme("theme-ocean"));
  }
  if (forestThemeButton) {
    forestThemeButton.addEventListener("click", () => applyTheme("theme-forest"));
  }
}

export function initPopupModeResizer({ popupModeCheckbox, syncCheckbox }) {
  if (!popupModeCheckbox) return;
  popupModeCheckbox.addEventListener("click", () => {
    const checked = popupModeCheckbox.checked;
    chrome.storage.local.set({ popupModeCheckbox: checked });
    if (syncCheckbox && syncCheckbox.checked) {
      chrome.storage.sync.set({ popupModeCheckbox: checked });
    }
    // Toggle behavior: if enabling, open popup window and close current;
    // if disabling from popup window, try to open action popup then close.
    try {
      chrome.windows.getCurrent((win) => {
        const isPopupWin = !!win && win.type === "popup";
        if (checked && !isPopupWin) {
          // enable: open popup window
          chrome.storage.local.get(["uiScale"], (res) => {
            const scale = typeof res.uiScale === "number" && res.uiScale > 0 ? res.uiScale : 1;
            const BASE_W = 300, BASE_H = 450, CHROME_W = 14, CHROME_H = 30;
            chrome.windows.create(
              {
                url: chrome.runtime.getURL("authenticator.html") + "?isPopup=true",
                type: "popup",
                focused: true,
                width: Math.round(BASE_W * scale + CHROME_W),
                height: Math.round(BASE_H * scale + CHROME_H),
              },
              () => {
                try { window.close(); } catch (_) {}
              }
            );
          });
        } else if (!checked && isPopupWin) {
          // disable: attempt to open action popup, then close current
          try {
            if (chrome.action && chrome.action.openPopup) {
              chrome.action.openPopup(() => {
                // close popup window regardless of result
                try { chrome.windows.remove(win.id); } catch (_) { try { window.close(); } catch (_) {} }
              });
            } else {
              // best effort: just close the popup window
              try { chrome.windows.remove(win.id); } catch (_) { try { window.close(); } catch (_) {} }
            }
          } catch (e) {
            try { chrome.windows.remove(win.id); } catch (_) { try { window.close(); } catch (_) {} }
          }
        }
      });
    } catch (_) {}
  });
}

import {
  requestAutofillPermission,
  requestClipboardPermission,
} from "./permissions.js";

export function initBasicToggles({
  autofillCheckbox,
  syncCheckbox,
  clipboardCopyingCheckbox,
  onlineTimeCheckbox,
  advancedAddCheckbox,
  hideTokenAdderCheckbox,
  formContainer,
  advancedAddButton,
  popupUpdate,
  addTokenToDOM,
  tokensContainer,
  passwordProtectedCheckbox,
}) {
  if (autofillCheckbox) {
    autofillCheckbox.addEventListener("change", async () => {
      if (autofillCheckbox.checked) {
        try {
          const granted = await requestAutofillPermission();
          if (granted) {
            chrome.storage.local.set({ autofillEnabled: true });
            if (popupUpdate) popupUpdate();
          } else {
            autofillCheckbox.checked = false;
          }
        } catch (e) {
          autofillCheckbox.checked = false;
        }
      } else {
        chrome.storage.local.set({ autofillEnabled: false });
      }
    });
  }

  if (syncCheckbox) {
    syncCheckbox.addEventListener("change", (e) => {
      if (passwordProtectedCheckbox && passwordProtectedCheckbox.checked) {
        e.preventDefault();
        syncCheckbox.checked = false;
        return;
      }
      try {
        if (syncCheckbox.checked) {
          chrome.storage.local.get(["tokens"], (localResult) => {
            chrome.storage.sync.get(["tokens"], (syncResult) => {
              let localTokens = Array.isArray(localResult.tokens)
                ? localResult.tokens
                : [];
              let syncTokens = Array.isArray(syncResult.tokens)
                ? syncResult.tokens
                : [];
              localTokens.forEach((localToken) => {
                if (!syncTokens.find((t) => t.name === localToken.name)) {
                  syncTokens.push(localToken);
                }
              });
              chrome.storage.sync.set({ tokens: syncTokens }, () => {
                chrome.storage.local.set({ tokens: syncTokens }, () => {
                  if (tokensContainer && addTokenToDOM) {
                    while (tokensContainer.firstChild)
                      tokensContainer.removeChild(tokensContainer.firstChild);
                    syncTokens.forEach((t) =>
                      addTokenToDOM(t.name, t.secret, t.url, t.otp)
                    );
                  }
                });
              });
            });
          });
        }
        chrome.storage.local.set({ syncEnabled: syncCheckbox.checked });
        chrome.storage.sync.set({ syncEnabled: syncCheckbox.checked });
      } catch (err) {}
    });
  }

  if (clipboardCopyingCheckbox) {
    clipboardCopyingCheckbox.addEventListener("change", async () => {
      if (clipboardCopyingCheckbox.checked) {
        try {
          const granted = await requestClipboardPermission();
          if (granted) {
            chrome.storage.local.set({ clipboardCopyingEnabled: true });
            chrome.storage.sync.set({ clipboardCopyingEnabled: true });
          } else {
            clipboardCopyingCheckbox.checked = false;
          }
        } catch (e) {
          clipboardCopyingCheckbox.checked = false;
        }
      } else {
        chrome.storage.local.set({ clipboardCopyingEnabled: false });
        chrome.storage.sync.set({ clipboardCopyingEnabled: false });
      }
    });
  }

  if (onlineTimeCheckbox) {
    onlineTimeCheckbox.addEventListener("change", () => {
      try {
        const enabled = !!onlineTimeCheckbox.checked;
        chrome.storage.local.set({ onlineTimeEnabled: enabled });
        chrome.storage.sync.set({ onlineTimeEnabled: enabled });
      } catch (e) {}
    });
  }

  if (advancedAddCheckbox && advancedAddButton && formContainer) {
    advancedAddCheckbox.addEventListener("change", () => {
      if (advancedAddCheckbox.checked) {
        advancedAddButton.className = "advanced-add-button";
        formContainer.appendChild(advancedAddButton);
        advancedAddButton.style.display = "block";
      } else {
        advancedAddButton.style.display = "none";
      }
      try {
        const v = !!advancedAddCheckbox.checked;
        chrome.storage.local.set({ advancedAddEnabled: v });
        chrome.storage.sync.set({ advancedAddEnabled: v });
      } catch (e) {}
    });
  }

  if (hideTokenAdderCheckbox && formContainer) {
    hideTokenAdderCheckbox.addEventListener("change", (e) => {
      const checked = !!e.target.checked;
      formContainer.style.display = checked ? "none" : "";
      chrome.storage.local.set({ hideTokenAdder: checked });
      if (syncCheckbox && syncCheckbox.checked) {
        chrome.storage.sync.set({ hideTokenAdder: checked });
      }
    });
  }
}

