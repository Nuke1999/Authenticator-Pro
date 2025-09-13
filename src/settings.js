import { jsPDF } from "jspdf";
import { openModal, buildHeader } from "./ui.js";
export async function getStoredScale() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["uiScale"], (result) => {
      const v = result.uiScale;
      resolve(typeof v === "number" && v > 0 ? v : 1);
    });
  });
}

export function buildSettingsUI(settingsContainer) {
  if (!settingsContainer) return;
  // Clear existing content
  while (settingsContainer.firstChild)
    settingsContainer.removeChild(settingsContainer.firstChild);

  // 1) Export (header + button) in export-container
  const exportContainer = document.createElement("div");
  exportContainer.className = "export-container";
  const exportHeader = document.createElement("h2");
  exportHeader.className = "export-header";
  try {
    exportHeader.textContent = chrome.i18n.getMessage("export") || "Export";
  } catch (_) {
    exportHeader.textContent = "Export";
  }
  const exportRow = document.createElement("div");
  exportRow.className = "theme-buttons-container";
  const exportBtn = document.createElement("button");
  exportBtn.className = "export-data-button";
  // exportBtn.className = "light-theme-button"; // reuse button style
  exportBtn.textContent = "Export Data";
  exportRow.appendChild(exportBtn);
  exportContainer.appendChild(exportHeader);
  exportContainer.appendChild(exportRow);
  settingsContainer.appendChild(exportContainer);

  // 2) Permissions header + container
  const permContainer = document.createElement("div");
  permContainer.className = "switch-boxes-container";
  permContainer.id = "switch-boxes-container";
  const permHeader = document.createElement("h2");
  permHeader.className = "permissions-header";
  try {
    permHeader.textContent =
      chrome.i18n.getMessage("permissions") || "Permissions";
  } catch (_) {
    permHeader.textContent = "Permissions";
  }
  permContainer.appendChild(permHeader);
  settingsContainer.appendChild(permContainer);

  // 3) Scale header + dropdown
  initScaleControl(settingsContainer);

  // 4) Themes header + buttons

  const themesContainer = document.createElement("div");
  themesContainer.className = "themes-container";

  settingsContainer.appendChild(themesContainer);
  const themesHeader = document.createElement("h2");
  themesHeader.className = "themes-header";
  try {
    themesHeader.textContent = chrome.i18n.getMessage("themes") || "Themes";
  } catch (_) {
    themesHeader.textContent = "Themes";
  }
  settingsContainer.appendChild(themesContainer);

  themesContainer.appendChild(themesHeader);

  //here it is

  const themeButtonsContainer = document.createElement("div");
  themeButtonsContainer.className = "theme-buttons-container";

  // themesContainer.appendChild(themeButtonsContainer);
  themesContainer.appendChild(themeButtonsContainer);

  const lightBtn = document.createElement("button");
  lightBtn.className = "light-theme-button";
  lightBtn.id = "light-theme-button";
  try {
    lightBtn.textContent =
      chrome.i18n.getMessage("light_theme") || "Light Theme";
  } catch (_) {
    lightBtn.textContent = "Light Theme";
  }
  const darkBtn = document.createElement("button");
  darkBtn.className = "dark-theme-button";
  darkBtn.id = "dark-theme-button";
  try {
    darkBtn.textContent = chrome.i18n.getMessage("dark_theme") || "Dark Theme";
  } catch (_) {
    darkBtn.textContent = "Dark Theme";
  }
  const oceanBtn = document.createElement("button");
  oceanBtn.className = "ocean-theme-button";
  oceanBtn.id = "ocean-theme-button";
  oceanBtn.textContent = "Ocean Theme";
  const forestBtn = document.createElement("button");
  forestBtn.className = "forest-theme-button";
  forestBtn.id = "forest-theme-button";
  forestBtn.textContent = "Forest Theme";
  themeButtonsContainer.appendChild(lightBtn);
  themeButtonsContainer.appendChild(darkBtn);
  themeButtonsContainer.appendChild(oceanBtn);
  themeButtonsContainer.appendChild(forestBtn);
  // settingsContainer.appendChild(themeButtonsContainer);

  // Theme/export wiring is initialized by popup after switches are available
}

export function applyScale(scale) {
  const s = typeof scale === "number" && scale > 0 ? scale : 1;
  document.documentElement.style.setProperty("--ui-scale", String(s));

  try {
    chrome.windows.getCurrent((win) => {
      if (!win || win.type !== "popup") return;
      const BASE_W = 300,
        BASE_H = 450,
        CHROME_W = 14,
        CHROME_H = 30;
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
  } catch (e) {}
}

export function initScaleControl(settingsContainer) {
  if (settingsContainer.querySelector("#ui-scale-control")) return;
  const section = document.createElement("div");
  section.className = "scale-container";
  const header = document.createElement("h2");
  header.className = "scale-header";
  header.textContent = "Scale";
  section.appendChild(header);

  const select = document.createElement("select");
  select.id = "ui-scale-control";
  select.className = "form-input";
  const options = [
    { label: "70%", value: 0.7 },
    { label: "80%", value: 0.8 },
    { label: "90%", value: 0.9 },
    { label: "100%", value: 1 },
    { label: "110%", value: 1.1 },
    { label: "120%", value: 1.2 },
    { label: "130%", value: 1.3 },
  ];
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = String(opt.value);
    o.textContent = opt.label;
    select.appendChild(o);
  });

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
  // Default: append at end; caller controls order by when it runs
  settingsContainer.appendChild(section);
}

export function initExportControls(settingsContainer) {
  let exportBtn = settingsContainer.querySelector(".export-data-button");

  const onClick = () => {
    const {
      container: popupContainer,
      content: popupContent,
      close,
    } = openModal({
      contentClass: "popup-content",
      onClose: () => {
        try {
          document.body.classList.remove("modal-active");
        } catch (_) {}
      },
    });
    // Optional: maintain legacy body class side-effect if styles rely on it
    try {
      document.body.classList.add("modal-active");
    } catch (_) {}

    const { header, xIcon } = buildHeader({ title: "Export Options" });
    popupContent.appendChild(header);

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

    // Red X closes
    if (xIcon) xIcon.addEventListener("click", close);

    function downloadBlob(filename, mime, content) {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportCSV(tokens) {
      const header = ["name", "secret", "url", "otp"];
      const lines = [header.join(",")];
      tokens.forEach((t) => {
        const vals = [
          t.name || "",
          t.secret || "",
          t.url || "",
          t.otp || "",
        ].map((v) => '"' + String(v).replace(/"/g, '""') + '"');
        lines.push(vals.join(","));
      });
      downloadBlob(
        "authenticator-export.csv",
        "text/csv;charset=utf-8",
        lines.join("\r\n")
      );
    }

    function exportDOC(tokens) {
      const rows = tokens
        .map(
          (t) =>
            `<tr><td>${t.name || ""}</td><td>${t.secret || ""}</td><td>${
              t.url || ""
            }</td><td>${t.otp || ""}</td></tr>`
        )
        .join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title></head><body><table border="1" cellspacing="0" cellpadding="4"><thead><tr><th>Name</th><th>Secret</th><th>URL</th><th>OTP</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
      downloadBlob("authenticator-export.doc", "application/msword", html);
    }

    function exportPDF(tokens) {
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const margin = 36;
      const lineHeight = 18;
      const colX = [margin, margin + 160, margin + 360, margin + 480];
      let y = margin + 12;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Authenticator Export", margin, y);
      y += 24;
      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.text("Name", colX[0], y);
      doc.text("Secret", colX[1], y);
      doc.text("URL", colX[2], y);
      doc.text("OTP", colX[3], y);
      y += 12;
      doc.setFont("Helvetica", "normal");
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxY = pageHeight - margin;
      const wrap = (str, max) =>
        String(str || "").length > max
          ? String(str).slice(0, max - 3) + "..."
          : String(str || "");
      tokens.forEach((t) => {
        if (y > maxY) {
          doc.addPage();
          y = margin;
        }
        doc.text(wrap(t.name, 24), colX[0], y);
        doc.text(wrap(t.secret, 28), colX[1], y);
        doc.text(wrap(t.url, 36), colX[2], y);
        doc.text(wrap(t.otp, 8), colX[3], y);
        y += lineHeight;
      });
      let suggested = "authenticator-export.pdf";
      try {
        const stamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-");
        suggested = `authenticator-export-${stamp}.pdf`;
      } catch (_) {}
      const name =
        typeof window !== "undefined" && window.prompt
          ? window.prompt("Save PDF as:", suggested)
          : suggested;
      doc.save(name || suggested);
    }

    csvBtn.addEventListener("click", () => {
      chrome.storage.local.get(["tokens"], (res) => {
        exportCSV(Array.isArray(res.tokens) ? res.tokens : []);
        close();
      });
    });
    docBtn.addEventListener("click", () => {
      chrome.storage.local.get(["tokens"], (res) => {
        exportDOC(Array.isArray(res.tokens) ? res.tokens : []);
        close();
      });
    });
    pdfBtn.addEventListener("click", () => {
      chrome.storage.local.get(["tokens"], (res) => {
        exportPDF(Array.isArray(res.tokens) ? res.tokens : []);
        close();
      });
    });
  };
  exportBtn.addEventListener("click", onClick);
}

export function initThemeControls({
  lightThemeButton,
  darkThemeButton,
  syncCheckbox,
  oceanThemeButton,
  forestThemeButton,
}) {
  // Fallback: query buttons if not provided
  if (!lightThemeButton)
    lightThemeButton = document.getElementById("light-theme-button");
  if (!darkThemeButton)
    darkThemeButton = document.getElementById("dark-theme-button");
  if (!oceanThemeButton)
    oceanThemeButton = document.getElementById("ocean-theme-button");
  if (!forestThemeButton)
    forestThemeButton = document.getElementById("forest-theme-button");

  const applyTheme = (theme) => {
    const classes = [
      "theme-light",
      "theme-dark",
      "theme-ocean",
      "theme-forest",
    ];
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
    forestThemeButton.addEventListener("click", () =>
      applyTheme("theme-forest")
    );
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
            const scale =
              typeof res.uiScale === "number" && res.uiScale > 0
                ? res.uiScale
                : 1;
            const BASE_W = 300,
              BASE_H = 450,
              CHROME_W = 14,
              CHROME_H = 30;
            chrome.windows.create(
              {
                url:
                  chrome.runtime.getURL("authenticator.html") + "?isPopup=true",
                type: "popup",
                focused: true,
                width: Math.round(BASE_W * scale + CHROME_W),
                height: Math.round(BASE_H * scale + CHROME_H),
              },
              () => {
                try {
                  window.close();
                } catch (_) {}
              }
            );
          });
        } else if (!checked && isPopupWin) {
          // disable: attempt to open action popup, then close current
          try {
            if (chrome.action && chrome.action.openPopup) {
              chrome.action.openPopup(() => {
                // close popup window regardless of result
                try {
                  chrome.windows.remove(win.id);
                } catch (_) {
                  try {
                    window.close();
                  } catch (_) {}
                }
              });
            } else {
              // best effort: just close the popup window
              try {
                chrome.windows.remove(win.id);
              } catch (_) {
                try {
                  window.close();
                } catch (_) {}
              }
            }
          } catch (e) {
            try {
              chrome.windows.remove(win.id);
            } catch (_) {
              try {
                window.close();
              } catch (_) {}
            }
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

  // Build the settings page structure and sections in order.

  if (syncCheckbox) {
    syncCheckbox.addEventListener("change", (e) => {
      if (passwordProtectedCheckbox && passwordProtectedCheckbox.checked) {
        e.preventDefault();
        syncCheckbox.checked = false;
        return;
      }
      try {
        if (syncCheckbox.checked) {
          chrome.storage.local.get(["tokens", "theme"], (localResult) => {
            chrome.storage.sync.get(["tokens"], (syncResult) => {
              const localTokens = Array.isArray(localResult.tokens)
                ? localResult.tokens
                : [];
              const syncTokensRaw = Array.isArray(syncResult.tokens)
                ? syncResult.tokens
                : [];
              const localSecrets = new Set(localTokens.map((t) => t.secret));
              const localNames = new Set(localTokens.map((t) => t.name));
              const finalTokens = [...localTokens];
              for (const t of syncTokensRaw) {
                if (localSecrets.has(t.secret)) continue; // discard incoming duplicate by secret
                if (localNames.has(t.name)) continue; // prefer local by name
                finalTokens.push(t);
              }
              chrome.storage.sync.set({ tokens: finalTokens }, () => {
                chrome.storage.local.set({ tokens: finalTokens }, () => {
                  if (tokensContainer && addTokenToDOM) {
                    while (tokensContainer.firstChild)
                      tokensContainer.removeChild(tokensContainer.firstChild);
                    finalTokens.forEach((t) =>
                      addTokenToDOM(t.name, t.secret, t.url, t.otp)
                    );
                  }
                });
              });
              // Push current device theme to sync when enabling sync
              try {
                const classes = [
                  "theme-light",
                  "theme-dark",
                  "theme-ocean",
                  "theme-forest",
                ];
                const active = classes.find((c) =>
                  document.body.classList.contains(c)
                );
                const th = active || localResult.theme || "theme-light";
                chrome.storage.sync.set({ theme: th });
              } catch (_) {}
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
