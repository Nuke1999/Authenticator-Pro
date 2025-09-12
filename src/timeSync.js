import { decryptSecret } from "./auth.js";

export async function getTimeSyncData() {
  const TIME_SYNC_KEY = "timeSyncData";
  const data = await new Promise((resolve) => {
    chrome.storage.local.get(TIME_SYNC_KEY, (result) =>
      resolve(result[TIME_SYNC_KEY] || null)
    );
  });
  return data || { lastSync: 0, offset: 0 };
}

export async function setTimeSyncData(offset) {
  const TIME_SYNC_KEY = "timeSyncData";
  const data = {
    lastSync: Date.now(),
    offset: offset,
  };
  await new Promise((resolve) => {
    chrome.storage.local.set({ [TIME_SYNC_KEY]: data }, resolve);
  });
  return data;
}

// Lightweight clock + token updater used by popup.js
// Keeps previous behavior: animate ring, show 5..1 countdown, and refresh tokens at 0/30s.
export function initTimeSync({ updateToken }) {
  const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  const TIME_API = "https://worldtimeapi.org/api/timezone/Etc/UTC";

  let offset = 0;
  let rafId = null;
  let nextSyncTimer = null;
  let lastBoundary = -1;

  function clearTimers() {
    if (rafId) cancelAnimationFrame(rafId);
    if (nextSyncTimer) clearTimeout(nextSyncTimer);
    rafId = null;
    nextSyncTimer = null;
  }

  function lastSeconds(seconds) {
    const s = Math.floor(seconds);
    if (s === 25 || s === 55) return 5;
    if (s === 26 || s === 56) return 4;
    if (s === 27 || s === 57) return 3;
    if (s === 28 || s === 58) return 2;
    if (s === 29 || s === 59) return 1;
    return "";
  }

  function nowSeconds(off = 0) {
    const d = new Date(Date.now() + off);
    return d.getSeconds() + d.getMilliseconds() / 1000;
  }

  function renderClock(seconds) {
    try {
      let strokeOffset;
      if (seconds <= 30) strokeOffset = -251.2 * (seconds / 30);
      else strokeOffset = -251.2 * ((seconds - 30) / 30);
      const circle = document.querySelector(".progress-circle");
      if (circle) circle.style.strokeDashoffset = strokeOffset;
      const txt = document.querySelector(".clock-text");
      if (txt) {
        const disp = lastSeconds(seconds);
        txt.textContent = disp;
        txt.style.opacity = 1 - (seconds % 1);
      }
    } catch (_) {}
  }

  async function updateTokensAtBoundary() {
    try {
      chrome.storage.local.get(
        ["tokens", "passwordCheckbox", "encryptionKeyInMemory", "iv"],
        async (result) => {
          try {
            const tokens = Array.isArray(result.tokens) ? result.tokens : [];
            if (result.passwordCheckbox) {
              const jwk = result.encryptionKeyInMemory;
              if (!jwk) return;
              const importedKey = await crypto.subtle.importKey(
                "jwk",
                jwk,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
              );
              const ivBase64 = result.iv;
              for (const t of tokens) {
                try {
                  const decrypted = await decryptSecret(t.secret, importedKey, ivBase64);
                  updateToken(t.name, decrypted);
                } catch (_) {}
              }
            } else {
              for (const t of tokens) updateToken(t.name, t.secret);
            }
          } catch (_) {}
        }
      );
    } catch (_) {}
  }

  function loop() {
    try {
      const s = nowSeconds(offset);
      renderClock(s);
      const whole = Math.floor(s);
      if ((whole === 0 || whole === 30) && whole !== lastBoundary) {
        lastBoundary = whole;
        updateTokensAtBoundary();
      }
    } catch (_) {}
    rafId = requestAnimationFrame(loop);
  }

  async function syncOffsetIfNeeded(enabled) {
    clearTimers();
    try {
      const data = await getTimeSyncData();
      const age = Date.now() - (data.lastSync || 0);
      if (!enabled) {
        offset = data.offset || 0;
        loop();
        return;
      }
      if (age < SYNC_INTERVAL_MS) {
        offset = data.offset || 0;
        loop();
        nextSyncTimer = setTimeout(() => syncOffsetIfNeeded(true), SYNC_INTERVAL_MS - age);
        return;
      }
      const seconds = await Promise.race([
        fetch(TIME_API)
          .then((r) => { if (!r.ok) throw new Error("bad"); return r.json(); })
          .then((j) => {
            const dt = new Date(j.datetime);
            offset = dt.getTime() - Date.now();
            return dt.getSeconds() + dt.getMilliseconds() / 1000;
          }),
        new Promise((res) => setTimeout(() => res(nowSeconds(0)), 500)),
      ]);
      await setTimeSyncData(offset);
      renderClock(seconds);
      loop();
      nextSyncTimer = setTimeout(() => syncOffsetIfNeeded(true), SYNC_INTERVAL_MS);
    } catch (_) {
      // On error, use stored offset and retry sooner
      const d = await getTimeSyncData();
      offset = d.offset || 0;
      loop();
      nextSyncTimer = setTimeout(() => syncOffsetIfNeeded(enabled), 5 * 60 * 1000);
    }
  }

  // bootstrap: start with current setting and watch changes
  try {
    chrome.storage.local.get(["onlineTimeEnabled"], (res) => {
      const enabled = !!res.onlineTimeEnabled;
      (async () => { await syncOffsetIfNeeded(enabled); })();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.onlineTimeEnabled) {
        const en = !!changes.onlineTimeEnabled.newValue;
        (async () => { await syncOffsetIfNeeded(en); })();
      }
    });
  } catch (_) {}
}
