import QrScanner from "qr-scanner";

export async function scanImageFile(file) {
  const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
  return result?.data || null;
}

export async function scanImageUrl(url) {
  const result = await QrScanner.scanImage(url, { returnDetailedScanResult: true });
  return result?.data || null;
}

export async function startWebcam(videoEl, onDecode) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoEl.srcObject = stream;
  const scanner = new QrScanner(
    videoEl,
    (res) => {
      try {
        const data = res?.data || res;
        if (data) onDecode(data);
      } catch (_) {}
    },
    { returnDetailedScanResult: true }
  );
  await scanner.start();
  return { scanner, stream };
}

export function stopWebcam({ scanner, stream, videoEl }) {
  try {
    scanner?.stop();
  } catch (_) {}
  try {
    stream?.getTracks()?.forEach((t) => t.stop());
  } catch (_) {}
  try {
    if (videoEl) {
      videoEl.pause();
      videoEl.srcObject = null;
    }
  } catch (_) {}
}

