const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function uint8ToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToUint8(str) {
  if (!str) return new Uint8Array(0);
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToUint8(hexString) {
  if (!hexString) return new Uint8Array(0);
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

let cachedEncryptionKey = null;

export function setCachedEncryptionKey(key) {
  cachedEncryptionKey = key;
}

export function getCachedEncryptionKey() {
  return cachedEncryptionKey;
}

export function clearCachedEncryptionKey() {
  cachedEncryptionKey = null;
}

async function storageLocalGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result || {});
    });
  });
}

async function storageLocalSet(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

async function storageSyncGet(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function storageSyncSet(values) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set(values, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function encryptSecret(secret, encryptionKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedSecret = textEncoder.encode(secret);
  const encryptedSecret = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    encodedSecret
  );
  const cipherText = new Uint8Array(encryptedSecret);
  const encryptedBase64 = uint8ToBase64(cipherText);
  const ivBase64 = uint8ToBase64(iv);
  return {
    encryptedData: encryptedBase64,
    iv: ivBase64,
    payload: `${ivBase64}:${encryptedBase64}`,
  };
}

export async function decryptSecret(encryptedData, encryptionKey, fallbackIv) {
  if (!encryptedData) return "";
  if (!encryptionKey) throw new Error("Missing encryption key");

  let cipherBase64;
  let ivBase64 = fallbackIv || "";

  if (typeof encryptedData === "object") {
    cipherBase64 = encryptedData.encryptedData || "";
    ivBase64 = encryptedData.iv || ivBase64;
    if (!cipherBase64 && typeof encryptedData.payload === "string") {
      encryptedData = encryptedData.payload;
    }
  }

  if (typeof encryptedData === "string") {
    if (encryptedData.includes(":")) {
      const [ivPart, ...rest] = encryptedData.split(":");
      ivBase64 = ivPart;
      cipherBase64 = rest.join(":");
    } else if (!fallbackIv) {
      return encryptedData;
    } else {
      cipherBase64 = encryptedData;
    }
  }

  if (!cipherBase64 || !ivBase64) {
    throw new Error("Invalid encrypted payload");
  }

  const ivBytes = base64ToUint8(ivBase64);
  const cipherBytes = base64ToUint8(cipherBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    encryptionKey,
    cipherBytes
  );
  return textDecoder.decode(decrypted);
}

export function hexToText(hexString) {
  if (!hexString) return "";
  let result = "";
  for (let i = 0; i < hexString.length; i += 2) {
    result += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
  }
  return result;
}

async function deriveEncryptionKey(password, saltBytes, usages = ["encrypt", "decrypt"], extractable = true) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    extractable,
    usages
  );
}

async function migrateTokensToUniqueIv(encryptionKey) {
  const { tokens = [], passwordCheckbox, iv, syncEnabled } = await storageLocalGet([
    "tokens",
    "passwordCheckbox",
    "iv",
    "syncEnabled",
  ]);

  if (!passwordCheckbox || !Array.isArray(tokens) || tokens.length === 0) {
    return;
  }

  let requiresMigration = false;
  tokens.forEach((token) => {
    if (token && typeof token.secret === "string" && !token.secret.includes(":")) {
      requiresMigration = true;
    }
  });

  if (!requiresMigration) return;

  const updatedTokens = [];
  for (const token of tokens) {
    if (!token || typeof token !== "object") continue;
    if (typeof token.secret === "string" && token.secret.includes(":")) {
      updatedTokens.push(token);
      continue;
    }
    try {
      const decryptedSecret = await decryptSecret(token.secret, encryptionKey, iv);
      const { payload } = await encryptSecret(decryptedSecret, encryptionKey);
      updatedTokens.push({ ...token, secret: payload });
    } catch (error) {
      updatedTokens.push(token);
    }
  }

  await storageLocalSet({ tokens: updatedTokens });

  if (!syncEnabled) return;

  try {
    const syncData = await storageSyncGet(["tokens"]);
    const syncTokens = Array.isArray(syncData.tokens) ? syncData.tokens : [];
    if (syncTokens.length === 0) return;
    const migratedSync = [];
    for (const token of syncTokens) {
      if (!token || typeof token !== "object") {
        migratedSync.push(token);
        continue;
      }
      if (typeof token.secret === "string" && token.secret.includes(":")) {
        migratedSync.push(token);
        continue;
      }
      try {
        const decrypted = await decryptSecret(token.secret, encryptionKey, iv);
        const { payload } = await encryptSecret(decrypted, encryptionKey);
        migratedSync.push({ ...token, secret: payload });
      } catch (_) {
        migratedSync.push(token);
      }
    }
    await storageSyncSet({ tokens: migratedSync });
  } catch (_) {}
}

export async function verifyPassword(passInput) {
  try {
    const { salt: storedSalt, iv: storedIv, encryptedHashedPassword } = await storageLocalGet([
      "salt",
      "iv",
      "encryptedHashedPassword",
    ]);
    if (!storedSalt || !storedIv || !encryptedHashedPassword) {
      return false;
    }

    const saltBytes = hexToUint8(storedSalt);
    const saltedPassword = textEncoder.encode(passInput + storedSalt);
    const hashedInputBuffer = await crypto.subtle.digest("SHA-256", saltedPassword);
    const hashedInputHex = Array.from(new Uint8Array(hashedInputBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const derivedKey = await deriveEncryptionKey(passInput, saltBytes, ["decrypt", "encrypt"], true);
    const decryptedHashedPasswordBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToUint8(storedIv) },
      derivedKey,
      base64ToUint8(encryptedHashedPassword)
    );
    const decryptedHashedPasswordHex = Array.from(
      new Uint8Array(decryptedHashedPasswordBuffer)
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hashedInputHex !== hexToText(decryptedHashedPasswordHex)) {
      clearCachedEncryptionKey();
      return false;
    }

    setCachedEncryptionKey(derivedKey);
    try {
      chrome.storage.local.remove("encryptionKeyInMemory");
      chrome.storage.sync.remove("encryptionKeyInMemory");
    } catch (_) {}
    await migrateTokensToUniqueIv(derivedKey);
    await storageLocalSet({ isPasswordVerified: true });
    return true;
  } catch (error) {
    console.error(error);
    clearCachedEncryptionKey();
    return false;
  }
}

export async function decryptTokens(encryptionKey) {
  if (!encryptionKey) throw new Error("Missing encryption key");
  const { tokens = [], iv } = await storageLocalGet(["tokens", "iv"]);
  const decryptedTokens = [];
  for (const token of tokens) {
    try {
      const decryptedSecret = await decryptSecret(token.secret, encryptionKey, iv);
      decryptedTokens.push({ ...token, secret: decryptedSecret });
    } catch (error) {
      console.error(error);
    }
  }
  return decryptedTokens;
}

export async function hashWithSalt(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltString = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const passwordWithSalt = textEncoder.encode(password + saltString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", passwordWithSalt);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const verificationIv = crypto.getRandomValues(new Uint8Array(12));
  const derivedEncryptionKey = await deriveEncryptionKey(password, saltBytes, ["encrypt", "decrypt"], true);

  const encryptedHashedPassword = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: verificationIv },
    derivedEncryptionKey,
    textEncoder.encode(hashHex)
  );

  await storageLocalSet({
    salt: saltString,
    iv: uint8ToBase64(verificationIv),
    encryptedHashedPassword: uint8ToBase64(new Uint8Array(encryptedHashedPassword)),
    isPasswordVerified: true,
  });

  setCachedEncryptionKey(derivedEncryptionKey);
  try {
    chrome.storage.local.remove("encryptionKeyInMemory");
    chrome.storage.sync.remove("encryptionKeyInMemory");
  } catch (_) {}
  return {
    salt: saltString,
    derivedEncryptionKey,
  };
}

