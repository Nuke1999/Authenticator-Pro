const STORAGE_VERSION_KEY = "storageVersion";
const CURRENT_STORAGE_VERSION = 2;

const BOOLEAN_KEYS = [
  "autofillEnabled",
  "syncEnabled",
  "clipboardCopyingEnabled",
  "passwordCheckbox",
  "popupModeCheckbox",
  "hideTokenAdder",
  "passwordProtected",
];

function toBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}

function sanitizeToken(token) {
  if (!token || typeof token !== "object") {
    return { name: "", secret: "", url: "", otp: "" };
  }
  return {
    name: typeof token.name === "string" ? token.name : "",
    secret: typeof token.secret === "string" ? token.secret : "",
    url: typeof token.url === "string" ? token.url : "",
    otp: typeof token.otp === "string" ? token.otp : "",
  };
}

function tokensChanged(original, sanitized) {
  if (!Array.isArray(original) || original.length !== sanitized.length) {
    return true;
  }
  for (let i = 0; i < original.length; i += 1) {
    const a = original[i] || {};
    const b = sanitized[i] || {};
    if (
      (a.name || "") !== b.name ||
      (a.secret || "") !== b.secret ||
      (a.url || "") !== b.url ||
      (a.otp || "") !== b.otp
    ) {
      return true;
    }
  }
  return false;
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function migrateArea(area) {
  return new Promise((resolve) => {
    let storage;
    try {
      storage = chrome.storage[area];
    } catch (_) {
      resolve();
      return;
    }
    if (!storage || typeof storage.get !== "function") {
      resolve();
      return;
    }

    try {
      if (typeof storage.remove === "function") {
        storage.remove("encryptionKeyInMemory");
      }
    } catch (_) {}

    storage.get(null, (data = {}) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve();
        return;
      }
      const updates = {};
      let version = Number.isFinite(data[STORAGE_VERSION_KEY])
        ? data[STORAGE_VERSION_KEY]
        : 0;

      if (version < 1) {
        const tokensArray = Array.isArray(data.tokens) ? data.tokens : [];
        const sanitizedTokens = tokensArray.map(sanitizeToken);
        if (tokensChanged(tokensArray, sanitizedTokens)) {
          updates.tokens = sanitizedTokens;
        }
        const desiredOrder = sanitizedTokens
          .map((token) => token.name)
          .filter((name) => typeof name === "string" && name.length > 0);
        const currentOrder = Array.isArray(data.tokenOrder)
          ? data.tokenOrder
          : [];
        if (!arraysEqual(currentOrder, desiredOrder)) {
          updates.tokenOrder = desiredOrder;
        }
        data.tokens = sanitizedTokens;
        data.tokenOrder = desiredOrder;
        version = 1;
      }

      if (version < CURRENT_STORAGE_VERSION) {
        BOOLEAN_KEYS.forEach((key) => {
          const normalized = toBoolean(data[key]);
          if (data[key] !== normalized) {
            updates[key] = normalized;
            data[key] = normalized;
          } else if (typeof data[key] === "undefined") {
            updates[key] = false;
            data[key] = false;
          }
        });

        if (typeof data.uiScale !== "number" || !(data.uiScale > 0)) {
          updates.uiScale = 1;
          data.uiScale = 1;
        }

        if (typeof data.theme !== "string" || data.theme.length === 0) {
          updates.theme = "theme-light";
          data.theme = "theme-light";
        }

        version = CURRENT_STORAGE_VERSION;
      }

      if (version !== data[STORAGE_VERSION_KEY]) {
        updates[STORAGE_VERSION_KEY] = CURRENT_STORAGE_VERSION;
      }

      if (Object.keys(updates).length === 0) {
        resolve();
        return;
      }

      storage.set(updates, () => {
        resolve();
      });
    });
  });
}

export function runStorageMigrations() {
  return Promise.all([migrateArea("local"), migrateArea("sync")]).then(() => {});
}

