// SkibidiMP3 - Background Service Worker (Direct Client + VPS Support)

const DEFAULT_SERVER_URL = "http://localhost:3030";

async function getSettings() {
  const result = await chrome.storage.local.get({
    serverUrl: DEFAULT_SERVER_URL,
    authToken: null,
    authUser: null,
    defaultFormat: "mp3",
    defaultBitrate: "320k",
    defaultBoost: "0",
  });
  return result;
}

function formatServerUrl(url) {
  if (!url) return DEFAULT_SERVER_URL;
  return url.trim().replace(/\/+$/, "");
}

function notify(title, message, isError = false) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: (isError ? "❌ " : "⚡ ") + title,
      message: message || "",
      priority: 2,
    });
  } catch (err) {
    console.warn("Notification error:", err);
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Direct Client Download (Zero-VPS, streams directly from YouTube CDN)
  if (request.action === "DIRECT_CLIENT_DOWNLOAD") {
    handleDirectClientDownload(request)
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => {
        notify("Erreur de téléchargement", err.message, true);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  // 2. VPS Quick Download (yt-dlp + ffmpeg transcoding)
  if (request.action === "QUICK_DOWNLOAD_FROM_PAGE") {
    handleQuickDownload(request.url, request.options)
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => {
        notify("Erreur de conversion", err.message, true);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  // 3. Simple Download Trigger
  if (request.action === "TRIGGER_CHROME_DOWNLOAD") {
    chrome.downloads.download(
      {
        url: request.fileUrl,
        filename: request.filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      }
    );
    return true;
  }
});

// Direct Client-Side Download Handler
async function handleDirectClientDownload(data) {
  const { streamUrl, title, artist, format = "mp4", bitrate = "720p", thumbnail, originalUrl } = data;
  const cleanArtist = (artist || "").trim();
  const cleanTitle = (title || "Video").trim();
  const filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
  const safeFilename = filename.replace(/[\\/:*?"<>|]/g, "_");

  notify("Téléchargement Direct Lancé", `« ${cleanTitle} » (${format.toUpperCase()} ${bitrate})`);

  await chrome.downloads.download({
    url: streamUrl,
    filename: safeFilename,
    saveAs: false,
  });

  // Sync to history if authenticated
  const settings = await getSettings();
  if (settings.authToken) {
    const serverUrl = formatServerUrl(settings.serverUrl);
    try {
      await fetch(`${serverUrl}/api/user/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.authToken}`,
        },
        body: JSON.stringify({
          title: cleanTitle,
          artist: cleanArtist,
          thumbnail,
          format,
          bitrate,
          url: originalUrl,
        }),
      });
    } catch (histErr) {
      console.warn("Failed to sync history for direct download:", histErr);
    }
  }

  return { title: cleanTitle, artist: cleanArtist, filename: safeFilename };
}

// Server-Side Transcode Download Handler
async function handleQuickDownload(url, customOptions = {}) {
  const settings = await getSettings();
  const serverUrl = formatServerUrl(settings.serverUrl);
  const token = settings.authToken;

  notify("Conversion en cours...", "Récupération des informations et encodage audio...");

  // 1. Fetch info
  const infoRes = await fetch(`${serverUrl}/api/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!infoRes.ok) {
    const err = await infoRes.json().catch(() => ({}));
    throw new Error(err.error || `Erreur serveur (${infoRes.status})`);
  }

  const info = await infoRes.json();
  const title = info.title || "Musique";
  const artist = info.artist || "Artiste Inconnu";
  const format = customOptions.format || settings.defaultFormat || "mp3";
  const bitrate = customOptions.bitrate || settings.defaultBitrate || "320k";
  const boost = customOptions.boost || settings.defaultBoost || "0";

  // 2. Trigger Download API
  const downloadPayload = {
    url: info.originalUrl || info.url || url,
    format,
    bitrate,
    boost,
    editTitle: title,
    editArtist: artist,
    thumbnail: info.thumbnail,
  };

  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const dlRes = await fetch(`${serverUrl}/api/download`, {
    method: "POST",
    headers,
    body: JSON.stringify(downloadPayload),
  });

  if (!dlRes.ok) {
    const err = await dlRes.json().catch(() => ({}));
    throw new Error(err.error || `Erreur lors du téléchargement (${dlRes.status})`);
  }

  const blob = await dlRes.blob();
  const reader = new FileReader();

  const dataUrl = await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const cleanArtist = artist.trim();
  const cleanTitle = title.trim();
  const filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
  const safeFilename = filename.replace(/[\\/:*?"<>|]/g, "_");

  await chrome.downloads.download({
    url: dataUrl,
    filename: safeFilename,
    saveAs: false,
  });

  // 3. Save to history if logged in
  if (token) {
    try {
      await fetch(`${serverUrl}/api/user/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          artist,
          thumbnail: info.thumbnail,
          format,
          bitrate,
          url: info.originalUrl || info.url || url,
        }),
      });
    } catch (histErr) {
      console.warn("Failed to sync history:", histErr);
    }
  }

  notify("Téléchargement prêt !", `« ${cleanTitle} » a été téléchargé avec succès.`);
  return { title, artist, filename: safeFilename };
}
