import { jsPDF } from "jspdf";
import { openModal, buildHeader } from "./ui.js";
import { decryptTokens, getCachedEncryptionKey, encryptSecret } from "./auth.js";
import { generateToken, isValidBase32, normalizeSecret } from "./tokens.js";

const t = (key, substitutions) => {
  try {
    const message = chrome.i18n.getMessage(key, substitutions);
    if (message && message.length > 0) {
      return message;
    }
  } catch (_) {}
  if (Array.isArray(substitutions) && substitutions.length > 0) {
    return substitutions.join(" ");
  }
  return key;
};
export async function getStoredScale() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["uiScale"], (result) => {
      const v = result.uiScale;
      resolve(typeof v === "number" && v > 0 ? v : 1);
    });
  });
}

function storageLocalGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result = {}) => resolve(result));
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
  exportHeader.textContent = t("export");
  const exportRow = document.createElement("div");
  exportRow.className = "export-buttons";
  const bulkAddBtn = document.createElement("button");
  bulkAddBtn.className = "export-data-button bulk-add-button";
  bulkAddBtn.id = "bulk-add-button";
  bulkAddBtn.textContent = t("bulk_add_label");
  exportRow.appendChild(bulkAddBtn);
  const exportBtn = document.createElement("button");
  exportBtn.className = "export-data-button";
  exportBtn.id = "export-data-button";
  exportBtn.textContent = t("export_data");
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
  permHeader.textContent = t("permissions");
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
  themesHeader.textContent = t("themes");
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
  lightBtn.textContent = t("light_theme");
  const darkBtn = document.createElement("button");
  darkBtn.className = "dark-theme-button";
  darkBtn.id = "dark-theme-button";
  darkBtn.textContent = t("dark_theme");
  const oceanBtn = document.createElement("button");
  oceanBtn.className = "ocean-theme-button";
  oceanBtn.id = "ocean-theme-button";
  oceanBtn.textContent = t("ocean_theme");
  const forestBtn = document.createElement("button");
  forestBtn.className = "forest-theme-button";
  forestBtn.id = "forest-theme-button";
  forestBtn.textContent = t("forest_theme");
  themeButtonsContainer.appendChild(lightBtn);
  themeButtonsContainer.appendChild(darkBtn);
  themeButtonsContainer.appendChild(oceanBtn);
  themeButtonsContainer.appendChild(forestBtn);

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
  header.textContent = t("scale_heading");
  section.appendChild(header);

  const select = document.createElement("select");
  select.id = "ui-scale-control";
  select.className = "form-input";
  const scaleValues = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3];
  scaleValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = t("scale_percentage", String(Math.round(value * 100)));
    select.appendChild(option);
  });

  getStoredScale().then((scale) => {
    const closest = scaleValues.reduce((prev, curr) =>
      Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev
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
  const exportBtn = settingsContainer.querySelector("#export-data-button");
  if (!exportBtn) return;

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
    try {
      document.body.classList.add("modal-active");
    } catch (_) {}

    const { header, xIcon } = buildHeader({
      title: t("export_options_title"),
    });
    popupContent.appendChild(header);

    const btns = document.createElement("div");
    btns.className = "export-buttons";

    const csvBtn = document.createElement("button");
    csvBtn.className = "wide-button";
    csvBtn.textContent = t("export_csv_label");
    btns.appendChild(csvBtn);

    const pdfBtn = document.createElement("button");
    pdfBtn.className = "wide-button";
    pdfBtn.textContent = t("export_pdf_label");
    btns.appendChild(pdfBtn);

    const docBtn = document.createElement("button");
    docBtn.className = "wide-button";
    docBtn.textContent = t("export_doc_label");
    btns.appendChild(docBtn);

    popupContent.appendChild(btns);

    const exportError = document.createElement("div");
    exportError.className = "export-error";
    exportError.style.display = "none";
    popupContent.appendChild(exportError);

    if (xIcon) xIcon.addEventListener("click", close);

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const columnLabels = {
      name: t("export_column_name"),
      secret: t("export_column_secret"),
      url: t("export_column_url"),
    };

    const filenamePrefix = t("export_filename_prefix");
    const csvFilename = `${filenamePrefix}.csv`;
    const docFilename = `${filenamePrefix}.doc`;
    const pdfBaseFilename = `${filenamePrefix}.pdf`;
    const pdfPrompt = t("export_pdf_prompt");
    const documentTitle = t("export_document_title");

    const downloadBlob = (filename, mime, content) => {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const exportCSV = (tokens) => {
      const header = [
        columnLabels.name,
        columnLabels.secret,
        columnLabels.url,
      ];
      const lines = [header.join(",")];
      tokens.forEach((token) => {
        const values = [
          token.name || "",
          token.secret || "",
          token.url || "",
        ].map((value) => '"' + String(value).replace(/"/g, '""') + '"');
        lines.push(values.join(","));
      });
      downloadBlob(csvFilename, "text/csv;charset=utf-8", lines.join("\r\n"));
    };

    const exportDOC = (tokens) => {
      const headerRow = `<tr>${[
        columnLabels.name,
        columnLabels.secret,
        columnLabels.url,
      ]
        .map((label) => `<th>${escapeHtml(label)}</th>`)
        .join("")}</tr>`;
      const rows = tokens
        .map((token) => {
          const cells = [
            escapeHtml(token.name),
            escapeHtml(token.secret),
            escapeHtml(token.url),
          ]
            .map((cell) => `<td>${cell}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
        documentTitle
      )}</title></head><body><table border="1" cellspacing="0" cellpadding="4"><thead>${headerRow}</thead><tbody>${rows}</tbody></table></body></html>`;
      downloadBlob(docFilename, "application/msword", html);
    };

    const exportPDF = (tokens) => {
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const margin = 36;
      const lineHeight = 18;
      const colX = [margin, margin + 200, margin + 400];
      let y = margin + 12;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(documentTitle, margin, y);
      y += 24;
      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.text(columnLabels.name, colX[0], y);
      doc.text(columnLabels.secret, colX[1], y);
      doc.text(columnLabels.url, colX[2], y);
      y += 12;
      doc.setFont("Helvetica", "normal");
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxY = pageHeight - margin;
      const wrap = (str, max) =>
        String(str || "").length > max
          ? String(str).slice(0, max - 3) + "..."
          : String(str || "");
      tokens.forEach((token) => {
        if (y > maxY) {
          doc.addPage();
          y = margin;
        }
        doc.text(wrap(token.name, 24), colX[0], y);
        doc.text(wrap(token.secret, 32), colX[1], y);
        doc.text(wrap(token.url, 48), colX[2], y);
        y += lineHeight;
      });
      let suggested = pdfBaseFilename;
      try {
        const stamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-");
        suggested = `${filenamePrefix}-${stamp}.pdf`;
      } catch (_) {}
      const name =
        typeof window !== "undefined" && typeof window.prompt === "function"
          ? window.prompt(pdfPrompt, suggested)
          : suggested;
      doc.save(name || suggested);
    };

    async function getTokensForExport() {
      const { passwordCheckbox } = await storageLocalGet(["passwordCheckbox"]);
      if (passwordCheckbox) {
        const key = getCachedEncryptionKey();
        if (!key) {
          const error = new Error("locked");
          error.code = "PASSWORD_LOCKED";
          throw error;
        }
        return decryptTokens(key);
      }
      const { tokens } = await storageLocalGet(["tokens"]);
      return Array.isArray(tokens) ? tokens : [];
    }

    function showExportError(messageKey) {
      exportError.textContent = chrome.i18n.getMessage(messageKey);
      exportError.style.display = "block";
    }

    const handleExport = async (exporter) => {
      try {
        exportError.style.display = "none";
        const tokens = await getTokensForExport();
        exporter(tokens);
        close();
      } catch (error) {
        if (error && error.code === "PASSWORD_LOCKED") {
          showExportError("main_enter_password_message");
        } else {
          console.error(error);
        }
      }
    };

    csvBtn.addEventListener("click", () => handleExport(exportCSV));
    pdfBtn.addEventListener("click", () => handleExport(exportPDF));
    docBtn.addEventListener("click", () => handleExport(exportDOC));
  };

  exportBtn.addEventListener("click", onClick);
}

export function initBulkAddControls(
  settingsContainer,
  { tokensContainer, addTokenToDOM, syncCheckbox } = {}
) {
  const bulkBtn = settingsContainer.querySelector(".bulk-add-button");
  if (!bulkBtn) return;

  const normalizeHeader = (value) =>
    String(value || "")
      .replace(/\uFEFF/g, "")
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && (ch === "," || ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") {
          i += 1;
        }
        row.push(cell);
        cell = "";
        if (ch !== ",") {
          if (row.length > 1 || row.some((v) => String(v).trim().length > 0)) {
            rows.push(row);
          }
          row = [];
        }
        continue;
      }
      cell += ch;
    }
    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  };

  const buildHeaderMap = (headerRow, columnLabels) => {
    const headerLookup = new Map([
      [normalizeHeader(columnLabels.name), "name"],
      [normalizeHeader(columnLabels.secret), "secret"],
      [normalizeHeader(columnLabels.url), "url"],
      ["name", "name"],
      ["account", "name"],
      ["label", "name"],
      ["issuer", "name"],
      ["secret", "secret"],
      ["key", "secret"],
      ["totp secret", "secret"],
      ["url", "url"],
      ["site", "url"],
      ["website", "url"],
      ["autofill", "url"],
      ["autofill url", "url"],
      ["otp", "otp"],
      ["code", "otp"],
    ]);
    const map = headerRow.map((cell) => headerLookup.get(normalizeHeader(cell)));
    const hasAny = map.some(Boolean);
    const hasSecret = map.includes("secret");
    return { map, hasHeader: hasAny && hasSecret };
  };

  const parseCsvTokens = (text, columnLabels) => {
    const cleaned = String(text || "").replace(/^\uFEFF/, "");
    const rows = parseCsv(cleaned);
    if (rows.length === 0) return [];
    const { map: headerMap, hasHeader } = buildHeaderMap(
      rows[0],
      columnLabels
    );
    const startIndex = hasHeader ? 1 : 0;
    const tokens = [];
    for (let i = startIndex; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const token = { name: "", secret: "", url: "" };
      if (hasHeader) {
        row.forEach((value, idx) => {
          const key = headerMap[idx];
          if (!key || key === "otp") return;
          token[key] = value;
        });
      } else {
        token.name = row[0] || "";
        token.secret = row[1] || "";
        token.url = row[2] || "";
      }
      const hasAnyValue =
        String(token.name || "").trim().length > 0 ||
        String(token.secret || "").trim().length > 0 ||
        String(token.url || "").trim().length > 0;
      if (hasAnyValue) tokens.push(token);
    }
    return tokens;
  };

  const parseJsonTokens = (text) => {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.tokens)) return data.tokens;
    return [];
  };

  const refreshTokensUI = async () => {
    if (!tokensContainer || !addTokenToDOM) return;
    const { passwordCheckbox, tokenOrder } = await storageLocalGet([
      "passwordCheckbox",
      "tokenOrder",
    ]);
    let tokensToRender = [];
    if (passwordCheckbox) {
      const key = getCachedEncryptionKey();
      if (!key) return;
      tokensToRender = await decryptTokens(key);
    } else {
      const { tokens } = await storageLocalGet(["tokens"]);
      tokensToRender = Array.isArray(tokens) ? tokens : [];
    }
    const ordered = reorderTokensByOrderArray(
      tokensToRender,
      tokenOrder || []
    );
    while (tokensContainer.firstChild) {
      tokensContainer.removeChild(tokensContainer.firstChild);
    }
    ordered.forEach((tokenObj) => {
      addTokenToDOM(tokenObj.name, tokenObj.secret, tokenObj.url, tokenObj.otp);
    });
  };

  const reorderTokensByOrderArray = (tokens, order) => {
    if (!Array.isArray(tokens)) return [];
    const list = tokens.slice();
    if (!Array.isArray(order) || order.length === 0) {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    const indexMap = new Map(order.map((n, i) => [n, i]));
    const inOrder = [];
    const rest = [];
    for (const tkn of list) {
      if (indexMap.has(tkn.name)) inOrder.push(tkn);
      else rest.push(tkn);
    }
    inOrder.sort((a, b) => indexMap.get(a.name) - indexMap.get(b.name));
    rest.sort((a, b) => a.name.localeCompare(b.name));
    return inOrder.concat(rest);
  };

    const applyBulkAdd = async (incomingTokens, statusEl, renderStatus) => {
    const { tokens = [], passwordCheckbox, syncEnabled } = await storageLocalGet(
      ["tokens", "passwordCheckbox", "syncEnabled"]
    );
    const syncOn = syncCheckbox ? syncCheckbox.checked : !!syncEnabled;

    let decryptedTokens = Array.isArray(tokens) ? tokens : [];
    let key = null;
    if (passwordCheckbox) {
      key = getCachedEncryptionKey();
      if (!key) {
        const error = new Error("locked");
        error.code = "PASSWORD_LOCKED";
        throw error;
      }
      decryptedTokens = await decryptTokens(key);
    }

    const existingNames = new Set(
      decryptedTokens.map((tkn) => String(tkn.name || "").trim())
    );
    const existingSecrets = new Set(
      decryptedTokens.map((tkn) => normalizeSecret(tkn.secret || ""))
    );

    let added = 0;
    let skipped = 0;
    let invalid = 0;
    const newStoredTokens = [];

      for (const rawToken of incomingTokens) {
        const name = String(rawToken?.name || "").trim();
        const rawSecret = String(rawToken?.secret || "").trim();
        const normalized = normalizeSecret(rawSecret);
        const url = String(rawToken?.url || "").trim();
        if (!name || !normalized || !isValidBase32(normalized)) {
          invalid += 1;
          continue;
        }
      if (existingNames.has(name) || existingSecrets.has(normalized)) {
        skipped += 1;
        continue;
      }
      const otp = generateToken(normalized);
      if (!otp) {
        invalid += 1;
        continue;
      }

      let secretForStore = normalized;
      if (passwordCheckbox && key) {
        const { payload } = await encryptSecret(normalized, key);
        secretForStore = payload;
      }

      newStoredTokens.push({
        name,
        secret: secretForStore,
        url,
        otp,
      });
      existingNames.add(name);
      existingSecrets.add(normalized);
      added += 1;
    }

    const details = t("bulk_add_details", [
      String(added),
      String(skipped),
      String(invalid),
    ]);
    if (added === 0) {
      renderStatus({
      title: t("bulk_add_no_valid"),
        details,
        color: "#d93025",
      });
      return;
    }

    const updatedTokens = [...tokens, ...newStoredTokens];
    await new Promise((resolve) =>
      chrome.storage.local.set({ tokens: updatedTokens }, () => resolve())
    );
    if (syncOn) {
      try {
        chrome.storage.sync.set({ tokens: updatedTokens }, () => {});
      } catch (_) {}
    }
    await refreshTokensUI();

    const isPartial = skipped > 0 || invalid > 0;
    renderStatus({
      title: isPartial ? t("bulk_add_partial") : t("bulk_add_success"),
      details,
      color: isPartial ? "#b35a00" : "#1b7f3a",
    });
  };

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
    try {
      document.body.classList.add("modal-active");
    } catch (_) {}

    const { header, xIcon } = buildHeader({
      title: t("bulk_add_title"),
    });
    popupContent.appendChild(header);

    const btns = document.createElement("div");
    btns.className = "export-buttons";

    const csvBtn = document.createElement("button");
    csvBtn.className = "wide-button";
    csvBtn.textContent = t("bulk_add_csv_label");
    btns.appendChild(csvBtn);

    const jsonBtn = document.createElement("button");
    jsonBtn.className = "wide-button";
    jsonBtn.textContent = t("bulk_add_json_label");
    btns.appendChild(jsonBtn);

    popupContent.appendChild(btns);

    const status = document.createElement("div");
    status.className = "export-error";
    status.style.display = "none";
    popupContent.appendChild(status);

    const csvInput = document.createElement("input");
    csvInput.type = "file";
    csvInput.accept = ".csv,text/csv";
    csvInput.style.display = "none";
    popupContent.appendChild(csvInput);

    const jsonInput = document.createElement("input");
    jsonInput.type = "file";
    jsonInput.accept = ".json,application/json";
    jsonInput.style.display = "none";
    popupContent.appendChild(jsonInput);

    const columnLabels = {
      name: t("export_column_name"),
      secret: t("export_column_secret"),
      url: t("export_column_url"),
    };

    const renderStatus = ({ title, details, color }) => {
      status.textContent = "";
      const titleEl = document.createElement("div");
      titleEl.textContent = title;
      titleEl.style.fontSize = "14px";
      titleEl.style.fontWeight = "600";
      const detailsEl = document.createElement("div");
      detailsEl.textContent = details;
      detailsEl.style.fontSize = "12px";
      detailsEl.style.marginTop = "4px";
      status.appendChild(titleEl);
      status.appendChild(detailsEl);
      status.style.display = "block";
      status.style.color = color;
    };

    const handleFileError = (message) => {
      renderStatus({
        title: t("bulk_add_failed"),
        details: message,
        color: "#d93025",
      });
    };

    csvBtn.addEventListener("click", () => csvInput.click());
    jsonBtn.addEventListener("click", () => jsonInput.click());

    csvInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        status.style.display = "none";
        const text = await file.text();
        const tokens = parseCsvTokens(text, columnLabels);
        await applyBulkAdd(tokens, status, renderStatus);
      } catch (error) {
        if (error && error.code === "PASSWORD_LOCKED") {
          handleFileError(chrome.i18n.getMessage("main_enter_password_message"));
        } else {
          handleFileError(t("bulk_add_invalid_file"));
        }
      } finally {
        e.target.value = "";
      }
    });

    jsonInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        status.style.display = "none";
        const text = await file.text();
        const tokens = parseJsonTokens(text);
        await applyBulkAdd(tokens, status, renderStatus);
      } catch (error) {
        if (error && error.code === "PASSWORD_LOCKED") {
          handleFileError(chrome.i18n.getMessage("main_enter_password_message"));
        } else {
          handleFileError(t("bulk_add_invalid_file"));
        }
      } finally {
        e.target.value = "";
      }
    });

    if (xIcon) xIcon.addEventListener("click", close);
  };

  bulkBtn.addEventListener("click", onClick);
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

