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

