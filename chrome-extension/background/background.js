// SkibidiMP3 - Background Service Worker (Precise Filename & Direct Download)

const DEFAULT_SERVER_URL = "https://skibidi-mp3.sebastien-gratade.fr";

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
      title: (isError ? "Erreur : " : "SkibidiMP3 : ") + title,
      message: message || "",
      priority: 2,
    });
  } catch (err) {
    console.warn("Notification error:", err);
  }
}

function buildSafeFilename(title, artist, format) {
  let cleanArtist = (artist || "").replace(/ - Topic$/, "").replace(/VEVO$/, "").trim();
  let cleanTitle = (title || "Musique").trim();

  // If title already starts with "Artist - Title", avoid duplicate "Artist - Artist - Title"
  if (cleanArtist && cleanTitle.toLowerCase().startsWith(cleanArtist.toLowerCase() + " - ")) {
    cleanTitle = cleanTitle.substring(cleanArtist.length + 3).trim();
  }

  let filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
  return filename.replace(/[\\/:*?"<>|]/g, "_").trim();
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Direct Client Download (Zero-VPS)
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
  const safeFilename = buildSafeFilename(title, artist, format);

  notify("Téléchargement lancé", `${safeFilename}`);

  try {
    // Fetch stream as blob to force custom filename (preventing videoplayback default from google servers)
    const res = await fetch(streamUrl);
    if (res.ok) {
      const blob = await res.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await chrome.downloads.download({
        url: dataUrl,
        filename: safeFilename,
        saveAs: false,
      });
    } else {
      await chrome.downloads.download({
        url: streamUrl,
        filename: safeFilename,
        saveAs: false,
      });
    }
  } catch {
    await chrome.downloads.download({
      url: streamUrl,
      filename: safeFilename,
      saveAs: false,
    });
  }

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
          title,
          artist,
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

  return { title, artist, filename: safeFilename };
}

function cleanYouTubeMediaUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const videoId = u.searchParams.get("v") || (u.hostname.includes("youtu.be") ? u.pathname.replace(/^\//, "").split("/")[0] : null);
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
  } catch {}
  return rawUrl;
}

// Extract YouTube cookies formatted for yt-dlp Netscape format
async function getYoutubeCookies() {
  try {
    const cookieQueries = [
      { url: "https://www.youtube.com" },
      { url: "https://youtube.com" },
      { domain: "youtube.com" },
      { domain: ".youtube.com" },
      { domain: ".google.com" },
    ];

    const cookieMap = new Map();
    for (const q of cookieQueries) {
      try {
        const list = await chrome.cookies.getAll(q);
        if (list && Array.isArray(list)) {
          for (const c of list) {
            const key = `${c.domain}#${c.name}#${c.path}`;
            if (!cookieMap.has(key)) {
              cookieMap.set(key, c);
            }
          }
        }
      } catch {}
    }

    if (cookieMap.size === 0) return "";

    let netscape = "# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# This file was generated by SkibidiMP3 Extension\n\n";
    for (const c of cookieMap.values()) {
      let domain = c.domain || ".youtube.com";
      const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
      const path = c.path || "/";
      const secure = c.secure ? "TRUE" : "FALSE";
      const expiration = c.expirationDate ? Math.floor(c.expirationDate) : Math.floor(Date.now() / 1000) + 86400 * 365;
      netscape += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${c.name}\t${c.value}\n`;
    }
    return netscape;
  } catch (err) {
    console.warn("Could not extract YouTube cookies:", err);
    return "";
  }
}

// Server-Side Transcode Download Handler
async function handleQuickDownload(url, customOptions = {}) {
  const settings = await getSettings();
  const serverUrl = formatServerUrl(settings.serverUrl);
  const token = settings.authToken;
  const targetUrl = cleanYouTubeMediaUrl(url);

  notify("Conversion en cours...", "Récupération des informations et encodage audio...");

  // 1. Fetch info
  const infoRes = await fetch(`${serverUrl}/api/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: targetUrl }),
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
  const youtubeCookies = await getYoutubeCookies();

  // 2. Trigger Download API
  const downloadPayload = {
    url: info.originalUrl || info.url || targetUrl,
    format,
    bitrate,
    boost,
    editTitle: title,
    editArtist: artist,
    thumbnail: info.thumbnail,
    youtubeCookies,
    metadata: {
      title,
      artist,
      coverUrl: info.thumbnail,
    },
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

  const safeFilename = buildSafeFilename(title, artist, format);

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

  notify("Téléchargement terminé", `« ${safeFilename} »`);
  return { title, artist, filename: safeFilename };
}
