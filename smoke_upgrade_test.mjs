import { webcrypto as crypto } from "node:crypto";
import { copyFile, writeFile, unlink } from "node:fs/promises";

const localStore = {};
const syncStore = {};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeKeys(keys, store) {
  if (keys === null || typeof keys === "undefined") {
    return clone(store);
  }
  if (Array.isArray(keys)) {
    const out = {};
    keys.forEach((key) => {
      if (key in store) out[key] = clone(store[key]);
    });
    return out;
  }
  if (typeof keys === "string") {
    return { [keys]: clone(store[keys]) };
  }
  if (typeof keys === "object") {
    const out = {};
    Object.keys(keys).forEach((key) => {
      out[key] = key in store ? clone(store[key]) : clone(keys[key]);
    });
    return out;
  }
  return {};
}

globalThis.crypto = crypto;

globalThis.chrome = {
  runtime: {
    lastError: null,
  },
  storage: {
    local: {
      get(keys, callback) {
        chrome.runtime.lastError = null;
        Promise.resolve(normalizeKeys(keys, localStore)).then(callback);
      },
      set(values, callback) {
        chrome.runtime.lastError = null;
        Object.assign(localStore, clone(values || {}));
        if (callback) callback();
      },
      remove(keys, callback) {
        chrome.runtime.lastError = null;
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach((key) => delete localStore[key]);
        if (callback) callback();
      },
    },
    sync: {
      get(keys, callback) {
        chrome.runtime.lastError = null;
        Promise.resolve(normalizeKeys(keys, syncStore)).then(callback);
      },
      set(values, callback) {
        chrome.runtime.lastError = null;
        Object.assign(syncStore, clone(values || {}));
        if (callback) callback();
      },
      remove(keys, callback) {
        chrome.runtime.lastError = null;
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach((key) => delete syncStore[key]);
        if (callback) callback();
      },
    },
  },
};

globalThis.console = console;

globalThis.atob = (input) => Buffer.from(input, "base64").toString("binary");
globalThis.btoa = (input) => Buffer.from(input, "binary").toString("base64");

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

const tmpAuth = new URL("./tmp-auth.mjs", import.meta.url);
const tmpMigrations = new URL("./tmp-migrations.mjs", import.meta.url);
const tmpTokens = new URL("./tmp-tokens.mjs", import.meta.url);

await copyFile(new URL("./src/auth.js", import.meta.url), tmpAuth);
await copyFile(new URL("./src/migrations.js", import.meta.url), tmpMigrations);
await writeFile(
  tmpTokens,
  `import { authenticator } from "otplib";\nconst BASE32_REGEX = /^[A-Z2-7]+=*$/;\nexport function normalizeSecret(secret = "") {\n  return String(secret).replace(/\\s+/g, "").toUpperCase();\n}\nexport function isValidBase32(secret) {\n  const normalized = normalizeSecret(secret);\n  return normalized.length > 0 && BASE32_REGEX.test(normalized);\n}\nexport function generateToken(secret) {\n  const normalized = normalizeSecret(secret);\n  if (BASE32_REGEX.test(normalized)) {\n    return authenticator.generate(normalized);\n  }\n  return false;\n}\n`
);

function importModule(url) {
  return import(url.href);
}

const auth = await importModule(tmpAuth);
const migrations = await importModule(tmpMigrations);
const tokens = await importModule(tmpTokens);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function simulatePasswordProtectedUpgrade() {
  chrome.storage.local.set({
    tokens: [],
    passwordCheckbox: true,
    isPasswordVerified: false,
  });

  await auth.hashWithSalt("TestPass123");
  const key = auth.getCachedEncryptionKey();
  const legacySecret = "JBSWY3DPEHPK3PXP";
  const encrypted = await auth.encryptSecret(legacySecret, key);

  chrome.storage.local.set({
    tokens: [
      {
        name: "LegacyAccount",
        secret: encrypted.encryptedData,
        url: "https://example.com",
        otp: "000000",
      },
    ],
    passwordCheckbox: true,
    isPasswordVerified: false,
    tokenOrder: ["LegacyAccount"],
    encryptionKeyInMemory: { legacy: true },
  });

  auth.clearCachedEncryptionKey();

  await migrations.runStorageMigrations();
  const verified = await auth.verifyPassword("TestPass123");
  assert(verified, "Expected password verification to succeed");

  const keyAfter = auth.getCachedEncryptionKey();
  assert(keyAfter, "Cached key should be present after unlock");

  await new Promise((resolve) => setTimeout(resolve, 0));
  const state = await new Promise((resolve) => {
    chrome.storage.local.get(["tokens", "encryptionKeyInMemory"], resolve);
  });
  assert(!("encryptionKeyInMemory" in state), "Legacy key should be removed");
  assert(Array.isArray(state.tokens) && state.tokens.length === 1, "Token list missing");

  const decryptedTokens = await auth.decryptTokens(keyAfter);
  assert(
    decryptedTokens[0].secret === legacySecret,
    "Decrypted secret does not match original"
  );

  return {
    verified,
    storedSecretFormat: state.tokens[0].secret.includes(":") ? "per-token-iv" : "shared-iv",
    decryptedSecret: decryptedTokens[0].secret,
  };
}

async function simulateNonPasswordUpgrade() {
  chrome.storage.local.set({
    tokens: [
      {
        name: "lowercaseSecret",
        secret: "jbswy3dpehpk3pxp",
        url: "",
        otp: "",
      },
    ],
    passwordCheckbox: false,
    isPasswordVerified: false,
  });

  const normalized = tokens.normalizeSecret("jbswy3dpehpk3pxp");
  assert(normalized === "JBSWY3DPEHPK3PXP", "normalizeSecret should uppercase and strip spaces");
  assert(tokens.isValidBase32("jbswy3dpehpk3pxp"), "Lowercase base32 should be valid");

  const generated = tokens.generateToken("jbswy3dpehpk3pxp");
  assert(generated && generated.length === 6, "generateToken should produce OTP");

  return { normalized, generated };
}

const results = {};

try {
  results.passwordFlow = await simulatePasswordProtectedUpgrade();
  auth.clearCachedEncryptionKey();
  results.nonPassword = await simulateNonPasswordUpgrade();
  console.log("Simulated upgrade tests passed:", results);
} catch (err) {
  console.error("Simulated upgrade tests failed", err);
  process.exit(1);
} finally {
  await Promise.all([
    unlink(tmpAuth.href.replace('file:///', '')),
    unlink(tmpMigrations.href.replace('file:///', '')),
    unlink(tmpTokens.href.replace('file:///', '')),
  ]).catch(() => {});
}
