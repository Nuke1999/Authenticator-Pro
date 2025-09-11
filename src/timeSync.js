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

export const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function getSecondsFromLocalTime(offset = 0) {
  const now = new Date(Date.now() + offset);
  return now.getSeconds() + now.getMilliseconds() / 1000;
}

async function getSecondsFromTimeApi(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network response was not ok");
  const data = await res.json();
  const initialTime = new Date(data.datetime);
  const offset = initialTime.getTime() - Date.now();
  const seconds = initialTime.getSeconds() + initialTime.getMilliseconds() / 1000;
  return { seconds, offset };
}

export function startClock({
  useOnline,
  onSecondsUpdate,
  onBoundary,
  timeApiUrl = "https://worldtimeapi.org/api/timezone/Etc/UTC",
} = {}) {
  let rafId = null;
  let syncTimeoutId = null;
  let offset = 0;
  let lastBoundary = -1;
  let stopped = false;

  const scheduleSync = async () => {
    try {
      if (useOnline) {
        const syncData = await getTimeSyncData();
        const timeSinceLastSync = Date.now() - syncData.lastSync;
        if (timeSinceLastSync < SYNC_INTERVAL_MS) {
          offset = syncData.offset;
          syncTimeoutId = setTimeout(scheduleSync, SYNC_INTERVAL_MS - timeSinceLastSync);
          return;
        }
        const { seconds, offset: newOffset } = await getSecondsFromTimeApi(timeApiUrl);
        offset = newOffset;
        await setTimeSyncData(offset);
        // restart boundary timer soon, but ticking handles seconds rendering
        syncTimeoutId = setTimeout(scheduleSync, SYNC_INTERVAL_MS);
      }
    } catch (e) {
      const syncData = await getTimeSyncData();
      offset = syncData.offset || 0;
      syncTimeoutId = setTimeout(scheduleSync, 5 * 60 * 1000);
    }
  };

  const tick = () => {
    if (stopped) return;
    try {
      const seconds = getSecondsFromLocalTime(offset);
      onSecondsUpdate && onSecondsUpdate(seconds);
      const currentSecond = Math.floor(seconds);
      if ((currentSecond === 0 || currentSecond === 30) && currentSecond !== lastBoundary) {
        onBoundary && onBoundary();
        lastBoundary = currentSecond;
      }
    } catch (e) {}
    rafId = requestAnimationFrame(tick);
  };

  // kickoff
  scheduleSync();
  tick();

  return {
    stop() {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (syncTimeoutId) clearTimeout(syncTimeoutId);
    },
  };
}
