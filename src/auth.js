export async function encryptSecret(secret, encryptionKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["salt", "iv"], async (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      let { salt, iv } = result;
      if (!salt || !iv) {
        reject("Missing necessary values from storage.");
        return;
      }
      salt = new Uint8Array(salt.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
      iv = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
      try {
        const encoder = new TextEncoder();
        const encodedSecret = encoder.encode(secret);
        const encryptedSecret = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          encryptionKey,
          encodedSecret
        );
        const encryptedBase64 = btoa(
          String.fromCharCode.apply(null, new Uint8Array(encryptedSecret))
        );
        resolve({ encryptedData: encryptedBase64 });
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  });
}

export async function decryptSecret(encryptedData, encryptionKey, iv) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["salt"], async (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      const { salt } = result;
      if (!salt) {
        reject("Missing necessary values from storage.");
        return;
      }
      try {
        const ivArray = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
        const encryptedDataArray = Uint8Array.from(
          atob(encryptedData),
          (c) => c.charCodeAt(0)
        );
        const decryptedSecret = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: ivArray },
          encryptionKey,
          encryptedDataArray
        );
        const decoder = new TextDecoder();
        resolve(decoder.decode(decryptedSecret));
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  });
}

export function hexToText(hexString) {
  let result = "";
  for (let i = 0; i < hexString.length; i += 2) {
    result += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
  }
  return result;
}

export async function verifyPassword(passInput) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["salt", "iv", "encryptedHashedPassword"],
      async (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        const {
          salt: storedSalt,
          iv: storedIV,
          encryptedHashedPassword: storedEncryptedHash,
        } = result;
        if (!storedSalt || !storedIV || !storedEncryptedHash) {
          reject("Salt, IV, or encrypted hashed password not found.");
          return;
        }
        try {
          const ivArray = Uint8Array.from(atob(storedIV), (c) => c.charCodeAt(0));
          const encryptedHashArray = Uint8Array.from(
            atob(storedEncryptedHash),
            (c) => c.charCodeAt(0)
          );
          const encoder = new TextEncoder();
          const saltedPassword = encoder.encode(passInput + storedSalt);
          const hashedInputBuffer = await crypto.subtle.digest(
            "SHA-256",
            saltedPassword
          );
          const hashedInputHex = Array.from(new Uint8Array(hashedInputBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(passInput),
            "PBKDF2",
            false,
            ["deriveKey"]
          );
          const derivedKey = await crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt: new Uint8Array(
                storedSalt.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
              ),
              iterations: 100000,
              hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
          );
          const decryptedHashedPasswordBuffer = await crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: ivArray,
            },
            derivedKey,
            encryptedHashArray
          );
          const decryptedHashedPasswordHex = Array.from(
            new Uint8Array(decryptedHashedPasswordBuffer)
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const hexToTextVal = hexToText(decryptedHashedPasswordHex);
          resolve(hashedInputHex === hexToTextVal);
        } catch (error) {
          console.log(error);
          reject(error);
        }
      }
    );
  });
}

export async function decryptTokens(encryptionKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["tokens", "iv"], async (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      try {
        const tokens = result.tokens || [];
        const decryptedTokens = [];
        for (const token of tokens) {
          const decryptedSecret = await decryptSecret(
            token.secret,
            encryptionKey,
            result.iv
          );
          decryptedTokens.push({ ...token, secret: decryptedSecret });
        }
        resolve(decryptedTokens);
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  });
}

export async function hashWithSalt(password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const saltString = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const encoder = new TextEncoder();
  const passwordWithSalt = encoder.encode(password + saltString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", passwordWithSalt);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const derivedEncryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const jwkEncryptionKey = await crypto.subtle.exportKey("jwk", derivedEncryptionKey);

  const encryptedHashedPassword = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    derivedEncryptionKey,
    encoder.encode(hashHex)
  );
  const encryptedBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(encryptedHashedPassword)));
  const ivBase64 = btoa(String.fromCharCode.apply(null, iv));

  chrome.storage.local.set({
    salt: saltString,
    iv: ivBase64,
    encryptedHashedPassword: encryptedBase64,
    encryptionKeyInMemory: jwkEncryptionKey,
    isPasswordVerified: true,
  });

  return {
    salt: saltString,
    derivedEncryptionKey: derivedEncryptionKey,
  };
}

export async function convertKeyToCryptoKey(jwkKey) {
  const importedKey = await crypto.subtle.importKey(
    "jwk",
    jwkKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  return importedKey;
}
