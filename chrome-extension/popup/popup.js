// SkibidiMP3 - Popup Script (Dynamic Platform Formats & Modes)

const DEFAULT_SERVER_URL = "https://skibidi-mp3.sebastien-gratade.fr";

let state = {
  serverUrl: DEFAULT_SERVER_URL,
  authToken: null,
  authUser: null,
  currentMedia: null,
  history: [],
  selectedMode: "audio", // "audio" | "video" | "gif" | "image"
  defaultFormat: "mp3",
  defaultBitrate: "320k",
  defaultBoost: "0",
};

// DOM Elements
const elements = {
  navTabs: document.querySelectorAll(".nav-tab"),
  tabPanes: document.querySelectorAll(".tab-pane"),
  
  authBadge: document.getElementById("auth-status-badge"),
  authStatusDot: document.querySelector("#auth-status-badge .status-dot"),
  authStatusText: document.getElementById("auth-status-text"),

  // Converter Tab
  urlInput: document.getElementById("url-input"),
  fetchInfoBtn: document.getElementById("fetch-info-btn"),
  mediaCard: document.getElementById("media-card"),
  mediaThumb: document.getElementById("media-thumb"),
  mediaThumbFallback: document.getElementById("media-thumb-fallback"),
  mediaTitleDisplay: document.getElementById("media-title-display"),
  mediaArtistDisplay: document.getElementById("media-artist-display"),
  mediaPlatformBadge: document.getElementById("media-platform-badge"),
  mediaDurationBadge: document.getElementById("media-duration-badge"),

  // Mode Switcher Tabs
  mediaModeSelector: document.getElementById("media-mode-selector"),
  modeTabAudio: document.getElementById("mode-tab-audio"),
  modeTabVideo: document.getElementById("mode-tab-video"),
  modeTabGif: document.getElementById("mode-tab-gif"),
  modeTabImage: document.getElementById("mode-tab-image"),
  modeTabs: document.querySelectorAll(".mode-tab"),

  // Metadata & Options
  editTitle: document.getElementById("edit-title"),
  editArtist: document.getElementById("edit-artist"),
  optionsGrid: document.querySelector(".options-grid"),
  formatContainer: document.getElementById("format-container"),
  formatSelect: document.getElementById("format-select"),
  bitrateContainer: document.getElementById("bitrate-container"),
  bitrateSelect: document.getElementById("bitrate-select"),
  boostContainer: document.getElementById("boost-container"),
  boostSelect: document.getElementById("boost-select"),
  downloadBtn: document.getElementById("download-btn"),
  progressContainer: document.getElementById("progress-container"),
  progressFill: document.getElementById("progress-fill"),
  progressLabel: document.getElementById("progress-label"),
  statusMessage: document.getElementById("status-message"),

  // History Tab
  historyList: document.getElementById("history-list"),
  historySearch: document.getElementById("history-search"),
  historyRefreshBtn: document.getElementById("history-refresh-btn"),
  historyClearBtn: document.getElementById("history-clear-btn"),

  // Settings Tab
  serverUrlInput: document.getElementById("server-url-input"),
  saveServerBtn: document.getElementById("save-server-btn"),
  quickServerBtns: document.querySelectorAll(".quick-servers .badge-btn"),
  authLoginBox: document.getElementById("auth-login-box"),
  authUSerBox: document.getElementById("auth-user-box"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginBtn: document.getElementById("login-btn"),
  userDisplayName: document.getElementById("user-display-name"),
  logoutBtn: document.getElementById("logout-btn"),
  prefDefaultFormat: document.getElementById("pref-default-format"),
  prefDefaultBitrate: document.getElementById("pref-default-bitrate"),
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupEventListeners();
  setupModeTabs();
  await loadStoredSettings();
  await checkAuthStatus();
  await detectActiveTabUrl();
});

// Load settings from chrome.storage
async function loadStoredSettings() {
  const data = await chrome.storage.local.get({
    serverUrl: DEFAULT_SERVER_URL,
    authToken: null,
    authUser: null,
    defaultFormat: "mp3",
    defaultBitrate: "320k",
    defaultBoost: "0",
  });

  // Automatically migrate from localhost to production URL if needed
  if (!data.serverUrl || data.serverUrl === "http://localhost:3030") {
    data.serverUrl = DEFAULT_SERVER_URL;
    await chrome.storage.local.set({ serverUrl: DEFAULT_SERVER_URL });
  }

  state = { ...state, ...data };

  elements.serverUrlInput.value = state.serverUrl;
  elements.prefDefaultFormat.value = state.defaultFormat;
  elements.prefDefaultBitrate.value = state.defaultBitrate;
  elements.bitrateSelect.value = state.defaultBitrate;
  elements.boostSelect.value = state.defaultBoost;

  selectMode("audio");
}

function cleanServerUrl(url) {
  if (!url) return DEFAULT_SERVER_URL;
  return url.trim().replace(/\/+$/, "");
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

// Setup Tab Navigation
function setupTabs() {
  elements.navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      elements.navTabs.forEach((t) => t.classList.remove("active"));
      elements.tabPanes.forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");

      if (targetId === "history-tab") {
        loadHistory();
      }
    });
  });
}

// Setup Mode Switcher (Audio / Video / GIF / Image)
function setupModeTabs() {
  elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.getAttribute("data-mode");
      selectMode(mode);
    });
  });
}

function selectMode(mode) {
  state.selectedMode = mode;

  elements.modeTabs.forEach((t) => {
    if (t.getAttribute("data-mode") === mode) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  // Populate format dropdown dynamically
  elements.formatSelect.innerHTML = "";

  if (mode === "audio") {
    const audioFormats = [
      { val: "mp3", label: "MP3 (Audio Haute Qualité 320k)" },
      { val: "flac", label: "FLAC (Lossless Studio)" },
      { val: "wav", label: "WAV (Studio non compressé)" },
      { val: "m4a", label: "M4A (AAC Apple)" },
    ];
    audioFormats.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.val;
      opt.textContent = f.label;
      elements.formatSelect.appendChild(opt);
    });

    // Populate audio bitrates
    elements.bitrateContainer.querySelector("label").textContent = "Qualité / Bitrate";
    elements.bitrateSelect.innerHTML = `
      <option value="320k" selected>320 kbps (Max)</option>
      <option value="256k">256 kbps</option>
      <option value="192k">192 kbps</option>
      <option value="128k">128 kbps</option>
    `;

    const isPrefAudio = ["mp3", "flac", "wav", "m4a"].includes(state.defaultFormat);
    elements.formatSelect.value = isPrefAudio ? state.defaultFormat : "mp3";
    elements.boostContainer.style.display = "flex";
  } else if (mode === "video") {
    const opt = document.createElement("option");
    opt.value = "mp4";
    opt.textContent = "MP4 (Vidéo Universelle)";
    elements.formatSelect.appendChild(opt);
    elements.boostContainer.style.display = "none";

    // Populate video resolutions
    elements.bitrateContainer.querySelector("label").textContent = "Résolution Vidéo";
    elements.bitrateSelect.innerHTML = `
      <option value="1080p" selected>1080p (Full HD)</option>
      <option value="720p">720p (HD)</option>
      <option value="480p">480p (SD)</option>
      <option value="360p">360p (Léger)</option>
      <option value="best">Max (4K / 2K)</option>
    `;
  } else if (mode === "gif") {
    const opt = document.createElement("option");
    opt.value = "gif";
    opt.textContent = "GIF (Animation en boucle HD)";
    elements.formatSelect.appendChild(opt);
    elements.boostContainer.style.display = "none";
  } else if (mode === "image") {
    const imgFormats = [
      { val: "png", label: "PNG (Haute Définition)" },
      { val: "jpg", label: "JPG (Qualité Standard)" },
    ];
    imgFormats.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.val;
      opt.textContent = f.label;
      elements.formatSelect.appendChild(opt);
    });
    elements.formatSelect.value = "png";
    elements.boostContainer.style.display = "none";
  }

  updateFormatUI();
}

function updateFormatUI() {
  const format = elements.formatSelect.value;
  const mode = state.selectedMode;

  if (mode === "audio") {
    const showBitrate = format === "mp3" || format === "m4a";
    elements.bitrateContainer.style.display = showBitrate ? "flex" : "none";
    elements.optionsGrid.className = showBitrate ? "options-grid" : "options-grid single-col";
    elements.boostContainer.style.display = "flex";

    const bit = elements.bitrateSelect.value;
    elements.downloadBtn.querySelector(".btn-text").textContent = `Télécharger en ${format.toUpperCase()} (${bit})`;
  } else if (mode === "video") {
    elements.bitrateContainer.style.display = "flex";
    elements.optionsGrid.className = "options-grid";
    elements.boostContainer.style.display = "none";
    const res = elements.bitrateSelect.value;
    elements.downloadBtn.querySelector(".btn-text").textContent = `Télécharger la Vidéo (${res})`;
  } else if (mode === "gif") {
    elements.bitrateContainer.style.display = "none";
    elements.optionsGrid.className = "options-grid single-col";
    elements.boostContainer.style.display = "none";
    elements.downloadBtn.querySelector(".btn-text").textContent = "Télécharger le GIF Animé";
  } else if (mode === "image") {
    elements.bitrateContainer.style.display = "none";
    elements.optionsGrid.className = "options-grid single-col";
    elements.boostContainer.style.display = "none";
    elements.downloadBtn.querySelector(".btn-text").textContent = `Télécharger l'Image (${format.toUpperCase()})`;
  }
}

// Adapt modes and formats dynamically based on fetched platform data
function updatePlatformModes(data) {
  if (!data) return;

  const platform = data.platform || "generic";
  const urlVal = (elements.urlInput.value || "").toLowerCase();
  const isYouTube = platform === "youtube" || urlVal.includes("youtu");
  const isSpotifyOrSoundcloud = platform === "spotify" || platform === "soundcloud";
  const isPinterest = platform === "pinterest";
  const isTwitter = platform === "twitter";
  const isInstagram = platform === "instagram";
  const isTikTok = platform === "tiktok";

  const hasVideo = Boolean(data.hasVideo || isYouTube || isTikTok || isInstagram || platform === "vimeo" || isTwitter);
  const hasAudio = Boolean(data.hasAudio || isYouTube || isSpotifyOrSoundcloud || isTikTok || isInstagram || isTwitter);
  const hasImage = Boolean(data.hasImage || isPinterest || isTwitter || isInstagram || isYouTube);
  const isGifAvailable = Boolean(isTwitter || hasVideo || isYouTube);

  // Show/Hide mode buttons
  elements.modeTabAudio.style.display = hasAudio ? "flex" : "none";
  elements.modeTabVideo.style.display = hasVideo ? "flex" : "none";
  elements.modeTabGif.style.display = isGifAvailable ? "flex" : "none";
  elements.modeTabImage.style.display = hasImage ? "flex" : "none";

  // Preserve currently selected mode if valid, otherwise choose best default
  if (state.selectedMode === "video" && hasVideo) {
    selectMode("video");
  } else if (state.selectedMode === "gif" && isGifAvailable) {
    selectMode("gif");
  } else if (state.selectedMode === "image" && hasImage) {
    selectMode("image");
  } else if (data.mediaType === "image" || (hasImage && !hasVideo)) {
    selectMode("image");
  } else if (hasVideo && (isTikTok || isInstagram || platform === "vimeo")) {
    selectMode("video");
  } else if (hasAudio) {
    selectMode("audio");
  } else if (hasVideo) {
    selectMode("video");
  } else {
    selectMode("audio");
  }
}

// Check Authentication Status
async function checkAuthStatus() {
  const serverUrl = cleanServerUrl(state.serverUrl);
  if (!state.authToken) {
    updateAuthUI(false, null);
    return;
  }

  try {
    const res = await fetch(`${serverUrl}/api/auth/me`, {
      headers: { "Authorization": `Bearer ${state.authToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        state.authUser = data.user;
        await chrome.storage.local.set({ authUser: data.user });
        updateAuthUI(true, data.user.username);
        return;
      }
    }
  } catch (err) {
    console.warn("Auth check failed:", err);
  }

  updateAuthUI(false, null);
}

function updateAuthUI(isAuthenticated, username) {
  if (isAuthenticated && username) {
    elements.authStatusDot.className = "status-dot connected";
    elements.authStatusText.textContent = username;
    elements.authLoginBox.classList.add("hidden");
    elements.authUSerBox.classList.remove("hidden");
    elements.userDisplayName.textContent = username;
  } else {
    elements.authStatusDot.className = "status-dot disconnected";
    elements.authStatusText.textContent = "Hors ligne";
    elements.authLoginBox.classList.remove("hidden");
    elements.authUSerBox.classList.add("hidden");
  }
}

// Auto-detect YouTube or media URL in active tab
async function detectActiveTabUrl() {
  try {
    let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs || !tabs.length) {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    }
    if (!tabs || !tabs.length) {
      tabs = await chrome.tabs.query({ active: true });
    }

    const tab = tabs && tabs[0];
    if (tab && tab.url) {
      let u = tab.url;
      const isMediaUrl = 
        u.includes("youtube.com/watch") || 
        u.includes("youtu.be/") || 
        u.includes("youtube.com/shorts/") ||
        u.includes("spotify.com/") ||
        u.includes("soundcloud.com/") ||
        u.includes("tiktok.com/") ||
        u.includes("instagram.com/") ||
        u.includes("twitter.com/") ||
        u.includes("x.com/") ||
        u.includes("vimeo.com/") ||
        u.includes("pinterest.com/");

      if (isMediaUrl) {
        if (u.includes("youtube.com") || u.includes("youtu.be")) {
          u = cleanYouTubeMediaUrl(u);
        }
        elements.urlInput.value = u;

        // Immediately pre-fill basic info from browser tab if available
        if (tab.title && !elements.editTitle.value) {
          const rawTitle = tab.title.replace(/ - YouTube$/, "").trim();
          elements.mediaTitleDisplay.textContent = rawTitle;
          elements.editTitle.value = rawTitle;
          elements.mediaCard.classList.remove("hidden");
        }

        fetchMediaInfo(u);
      }
    }
  } catch (err) {
    console.warn("Could not query active tab:", err);
  }
}

// Fetch Media Information
async function fetchMediaInfo(url) {
  let targetUrl = (url || elements.urlInput.value || "").trim();
  if (!targetUrl) return;

  if (targetUrl.includes("youtube.com") || targetUrl.includes("youtu.be")) {
    targetUrl = cleanYouTubeMediaUrl(targetUrl);
    elements.urlInput.value = targetUrl;
  }

  hideStatus();
  elements.fetchInfoBtn.disabled = true;
  elements.fetchInfoBtn.innerHTML = `<span class="skibidi-yt-spinner" style="border-width:2px; width:12px; height:12px;"></span>`;

  const serverUrl = cleanServerUrl(state.serverUrl);

  try {
    const res = await fetch(`${serverUrl}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erreur serveur (${res.status})`);
    }

    const data = await res.json();
    state.currentMedia = data;

    // Handle thumbnail display with onload/onerror
    if (data.thumbnail) {
      elements.mediaThumb.onload = () => {
        elements.mediaThumb.classList.remove("hidden");
        elements.mediaThumbFallback.classList.add("hidden");
      };
      elements.mediaThumb.onerror = () => {
        elements.mediaThumb.classList.add("hidden");
        elements.mediaThumbFallback.classList.remove("hidden");
      };
      elements.mediaThumb.src = data.thumbnail;
    } else {
      elements.mediaThumb.classList.add("hidden");
      elements.mediaThumbFallback.classList.remove("hidden");
    }

    elements.mediaTitleDisplay.textContent = data.title || "Titre inconnu";
    elements.mediaArtistDisplay.textContent = data.artist || "Artiste inconnu";
    elements.mediaPlatformBadge.textContent = (data.platform || "Média").toUpperCase();

    const mins = Math.floor((data.duration || 0) / 60);
    const secs = (data.duration || 0) % 60;
    elements.mediaDurationBadge.textContent = data.duration ? `${mins}:${secs < 10 ? '0' : ''}${secs}` : "--:--";

    elements.editTitle.value = data.title || "";
    elements.editArtist.value = data.artist || "";

    // Adapt available modes & formats dynamically to platform
    updatePlatformModes(data);

    elements.mediaCard.classList.remove("hidden");
  } catch (err) {
    showStatus(err.message || "Impossible de récupérer les infos de la vidéo.", "error");
    elements.mediaCard.classList.add("hidden");
  } finally {
    elements.fetchInfoBtn.disabled = false;
    elements.fetchInfoBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    `;
  }
}

// Extract cookies formatted for yt-dlp Netscape format (YouTube, Vimeo, etc.)
async function getBrowserCookies(targetUrl = "") {
  try {
    const isVimeo = targetUrl.includes("vimeo.com");
    const cookieQueries = isVimeo
      ? [
          { url: "https://vimeo.com" },
          { url: "https://player.vimeo.com" },
          { domain: "vimeo.com" },
          { domain: ".vimeo.com" },
        ]
      : [
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
      let domain = c.domain || (isVimeo ? ".vimeo.com" : ".youtube.com");
      const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
      const path = c.path || "/";
      const secure = c.secure ? "TRUE" : "FALSE";
      const expiration = c.expirationDate ? Math.floor(c.expirationDate) : Math.floor(Date.now() / 1000) + 86400 * 365;
      netscape += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${c.name}\t${c.value}\n`;
    }
    return netscape;
  } catch (err) {
    console.warn("Could not extract platform cookies:", err);
    return "";
  }
}

// Fetch Vimeo direct stream URL directly from browser client session
async function resolveVimeoDirectStream(targetUrl, targetQuality = "1080p") {
  try {
    const idMatch = targetUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+)/);
    if (!idMatch) return null;
    const vimeoId = idMatch[1];

    // 1. First Priority: Extract directly from the active tab execution context (100% reliable)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && (tab.url?.includes("vimeo.com") || tab.url?.includes("player.vimeo.com"))) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: (qStr) => {
            // A. Check performance resources for CDN streams
            try {
              const entries = performance.getEntriesByType("resource");
              for (let i = entries.length - 1; i >= 0; i--) {
                const u = entries[i].name;
                if (u && (u.includes("vimeocdn.com") || u.includes("akamaized.net")) && (u.includes(".m3u8") || u.includes("master.json") || u.includes(".mp4"))) {
                  return u;
                }
              }
            } catch {}

            // B. Check video element src
            const v = document.querySelector("video");
            if (v && v.src && v.src.startsWith("http")) return v.src;

            // C. Check window.playerConfig
            if (window.playerConfig && window.playerConfig.request && window.playerConfig.request.files) {
              const files = window.playerConfig.request.files;
              const progressive = files.progressive || [];
              if (progressive.length > 0) {
                const qNum = parseInt(qStr) || 1080;
                progressive.sort((a, b) => (parseInt(b.quality) || b.height || 0) - (parseInt(a.quality) || a.height || 0));
                const matched = progressive.find(p => (parseInt(p.quality) || p.height || 0) <= qNum) || progressive[0];
                if (matched?.url) return matched.url;
              }
              const hls = files.hls || {};
              const defaultCdn = hls.default_cdn;
              if (defaultCdn && hls.cdns && hls.cdns[defaultCdn]?.url) {
                return hls.cdns[defaultCdn].url;
              }
            }

            // D. Check scripts for master.json or m3u8 URLs
            for (const s of document.scripts) {
              if (s.textContent && (s.textContent.includes(".m3u8") || s.textContent.includes("vimeocdn.com"))) {
                const m = s.textContent.match(/https:\/\/[^"'\s]+\.vimeocdn\.com[^"'\s]+(?:master\.json|\.m3u8|\.mp4)[^"'\s]*/);
                if (m) return m[0];
              }
            }

            return null;
          },
          args: [targetQuality],
        });

        if (results && results[0] && results[0].result) {
          console.log("Flux Vimeo direct extrait depuis l'onglet actif:", results[0].result);
          return results[0].result;
        }
      }
    } catch (e) {
      console.warn("Direct tab script execution failed:", e);
    }

    // 2. Query content script as fallback
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "GET_VIMEO_STREAM", targetQuality });
        if (response?.streamUrl) return response.streamUrl;
      }
    } catch {}

  } catch (err) {
    console.warn("Could not extract Vimeo direct stream in browser:", err);
  }
  return null;
}

// Clean filename builder helper
function buildSafeFilename(title, artist, format) {
  let cleanArtist = (artist || "").replace(/ - Topic$/, "").replace(/VEVO$/, "").trim();
  let cleanTitle = (title || "Musique").trim();

  // If title already has "Artist - Title", avoid duplicate "Artist - Artist - Title"
  if (cleanArtist && cleanTitle.toLowerCase().startsWith(cleanArtist.toLowerCase() + " - ")) {
    cleanTitle = cleanTitle.substring(cleanArtist.length + 3).trim();
  }

  let filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
  return filename.replace(/[\\/:*?"<>|]/g, "_").trim();
}

// Download Handler
async function handleDownload() {
  let url = elements.urlInput.value.trim();
  if (!url) {
    showStatus("Veuillez saisir une URL valide.", "error");
    return;
  }

  // 1. INSTANT UI FEEDBACK (First microsecond) - Disable button & show progress bar immediately
  elements.downloadBtn.disabled = true;
  elements.progressContainer.classList.remove("hidden");
  elements.progressFill.style.width = "12%";
  hideStatus();

  const format = elements.formatSelect.value;
  const isVideo = format === "mp4";
  const isImage = format === "png" || format === "jpg";
  const isGif = format === "gif";

  elements.progressLabel.textContent = isImage 
    ? "Récupération de l'image HD..." 
    : isVideo 
      ? "Extraction du flux vidéo HD..." 
      : isGif 
        ? "Génération du GIF..." 
        : "Connexion et extraction audio...";

  let progress = 12;
  const interval = setInterval(() => {
    if (progress < 85) {
      progress += Math.floor(Math.random() * 6) + 2;
      elements.progressFill.style.width = `${progress}%`;
      if (progress > 35) elements.progressLabel.textContent = isImage ? "Traitement de l'image..." : isVideo ? "Encodage vidéo HD..." : isGif ? "Conversion GIF..." : "Conversion audio...";
      if (progress > 70) elements.progressLabel.textContent = "Finalisation du fichier...";
    }
  }, 350);

  try {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      url = cleanYouTubeMediaUrl(url);
      elements.urlInput.value = url;
    }

    // If info not fetched yet, fetch it
    if (!state.currentMedia || !state.currentMedia.title) {
      await fetchMediaInfo(url);
    }

    const serverUrl = cleanServerUrl(state.serverUrl);
    const bitrate = elements.bitrateSelect.value;
    const boost = elements.boostSelect.value;
    const editTitle = elements.editTitle.value.trim() || (state.currentMedia?.title) || "Musique";
    const editArtist = elements.editArtist.value.trim() || (state.currentMedia?.artist) || "";
    const thumbnail = state.currentMedia?.thumbnail || "";

    const headers = { "Content-Type": "application/json" };
    if (state.authToken) {
      headers["Authorization"] = `Bearer ${state.authToken}`;
    }

    const youtubeCookies = await getBrowserCookies(url);

    let downloadUrl = state.currentMedia?.originalUrl || state.currentMedia?.url || url;
    if (url.includes("vimeo.com")) {
      const directStream = await resolveVimeoDirectStream(url, bitrate);
      if (directStream) {
        console.log("Flux direct Vimeo résolu avec succès:", directStream);
        downloadUrl = directStream;
      }
    }

    const payload = {
      url: downloadUrl,
      format,
      bitrate: isVideo ? bitrate : isImage ? "HD" : bitrate,
      quality: isVideo ? bitrate : undefined,
      boost,
      editTitle,
      editArtist,
      thumbnail,
      youtubeCookies,
      metadata: {
        title: editTitle,
        artist: editArtist,
        coverUrl: thumbnail,
      },
    };

    const res = await fetch(`${serverUrl}/api/download`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur serveur (${res.status})`);
    }

    clearInterval(interval);
    elements.progressFill.style.width = "100%";
    elements.progressLabel.textContent = "Fichier prêt ! Téléchargement en cours...";

    const blob = await res.blob();
    const reader = new FileReader();
    
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const safeFilename = buildSafeFilename(editTitle, editArtist, format);

    await chrome.downloads.download({
      url: dataUrl,
      filename: safeFilename,
      saveAs: false,
    });

    // Save to local history in chrome.storage.local
    const localRecord = {
      id: Date.now().toString(),
      title: editTitle,
      artist: editArtist,
      thumbnail: state.currentMedia?.thumbnail || thumbnail,
      format,
      bitrate: isVideo ? (bitrate === "best" ? "Max" : bitrate) : isImage ? "HD" : bitrate,
      url: state.currentMedia?.originalUrl || state.currentMedia?.url || url,
      date: new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      synced: Boolean(state.authToken),
    };

    try {
      const storageData = await chrome.storage.local.get({ localHistory: [] });
      const currentLocalHistory = storageData.localHistory || [];
      const updatedLocalHistory = [localRecord, ...currentLocalHistory.filter(h => h.id !== localRecord.id)].slice(0, 100);
      await chrome.storage.local.set({ localHistory: updatedLocalHistory });
      state.history = updatedLocalHistory;
    } catch {}

    // If logged in, also sync directly with server
    if (state.authToken) {
      try {
        await fetch(`${serverUrl}/api/user/history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.authToken}`,
          },
          body: JSON.stringify(localRecord),
        });
      } catch (histErr) {
        console.warn("History save error:", histErr);
      }
    }

    showStatus(`« ${editTitle} » téléchargé avec succès !`, "success");
  } catch (err) {
    clearInterval(interval);
    showStatus(err.message || "Erreur lors du téléchargement.", "error");
  } finally {
    clearInterval(interval);
    elements.downloadBtn.disabled = false;
    setTimeout(() => {
      elements.progressContainer.classList.add("hidden");
      elements.progressFill.style.width = "0%";
    }, 2500);
  }
}

// --- History Management (Offline Local + Online Auto-Sync) ---
async function loadHistory() {
  const serverUrl = cleanServerUrl(state.serverUrl);
  const storageData = await chrome.storage.local.get({ localHistory: [] });
  const localHistory = storageData.localHistory || [];

  // If not logged in, display local history directly
  if (!state.authToken) {
    state.history = localHistory;
    renderHistoryList(localHistory, false);
    return;
  }

  // If logged in: sync unsynced local items to server first, then fetch account history
  elements.historyList.innerHTML = `<div class="empty-state">Synchronisation de l'historique...</div>`;

  try {
    const unsynced = localHistory.filter((item) => !item.synced);
    if (unsynced.length > 0) {
      try {
        await fetch(`${serverUrl}/api/user/history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.authToken}`,
          },
          body: JSON.stringify({ items: unsynced }),
        });
      } catch (e) {
        console.warn("Batch history sync error:", e);
      }
    }

    const res = await fetch(`${serverUrl}/api/user/history`, {
      headers: { "Authorization": `Bearer ${state.authToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        updateAuthUI(false, null);
        state.history = localHistory;
        renderHistoryList(localHistory, false);
        return;
      }
      throw new Error(`Erreur serveur (${res.status})`);
    }

    const data = await res.json();
    const serverHistory = (data.history || []).map((h) => ({ ...h, synced: true }));
    state.history = serverHistory;
    await chrome.storage.local.set({ localHistory: serverHistory });
    renderHistoryList(serverHistory, true);
  } catch (err) {
    state.history = localHistory;
    renderHistoryList(localHistory, false);
  }
}

function renderHistoryList(items, isOnline = false) {
  const search = (elements.historySearch.value || "").toLowerCase().trim();
  const filtered = items.filter(
    (item) =>
      (item.title && item.title.toLowerCase().includes(search)) ||
      (item.artist && item.artist.toLowerCase().includes(search))
  );

  if (filtered.length === 0) {
    renderHistoryPlaceholder(
      search 
        ? "Aucun résultat trouvé." 
        : isOnline 
          ? "Votre historique synchronisé est vide." 
          : "Votre historique local est vide."
    );
    return;
  }

  elements.historyList.innerHTML = "";

  if (!isOnline && filtered.length > 0) {
    const notice = document.createElement("div");
    notice.style.cssText = "font-size:10px; color:var(--text-muted); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; margin-bottom:8px; display:flex; align-items:center; gap:6px;";
    notice.innerHTML = `<span>💾</span> <span>Historique local (Connectez-vous pour le synchroniser).</span>`;
    elements.historyList.appendChild(notice);
  }

  filtered.forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `
      <div class="history-thumb-box">
        <img src="${item.thumbnail || ''}" class="history-thumb" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">
      </div>
      <div class="history-info">
        <div class="history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="history-meta">
          <span>${escapeHtml(item.artist || 'Inconnu')}</span>
          <span>•</span>
          <span class="badge" style="padding:1px 4px; font-size:9px;">${(item.format || 'MP3').toUpperCase()}</span>
          <span>•</span>
          <span>${item.date || ''}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="btn-item-action download-again-btn" title="Re-télécharger">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
        <button class="btn-item-action danger delete-record-btn" title="Supprimer de l'historique">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    el.querySelector(".download-again-btn").addEventListener("click", () => {
      elements.urlInput.value = item.url;
      elements.navTabs[0].click();
      fetchMediaInfo(item.url);
    });

    el.querySelector(".delete-record-btn").addEventListener("click", async () => {
      await deleteHistoryItem(item.id);
    });

    elements.historyList.appendChild(el);
  });
}

function renderHistoryPlaceholder(text) {
  elements.historyList.innerHTML = `
    <div class="empty-state">
      <div style="color: var(--text-muted);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path></svg>
      </div>
      <div>${text}</div>
    </div>
  `;
}

async function deleteHistoryItem(id) {
  // Always delete from local storage
  const storageData = await chrome.storage.local.get({ localHistory: [] });
  const updatedLocal = (storageData.localHistory || []).filter((h) => h.id !== id);
  await chrome.storage.local.set({ localHistory: updatedLocal });
  state.history = state.history.filter((h) => h.id !== id);
  renderHistoryList(state.history, Boolean(state.authToken));

  // If logged in, also delete on server
  if (state.authToken) {
    const serverUrl = cleanServerUrl(state.serverUrl);
    try {
      await fetch(`${serverUrl}/api/user/history`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${state.authToken}`,
        },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("Delete history error:", err);
    }
  }
}

async function clearAllHistory() {
  if (!confirm("Voulez-vous vraiment effacer tout votre historique ?")) return;

  // Always clear local storage
  await chrome.storage.local.set({ localHistory: [] });
  state.history = [];
  renderHistoryList([], Boolean(state.authToken));

  // If logged in, clear on server
  if (state.authToken) {
    const serverUrl = cleanServerUrl(state.serverUrl);
    try {
      await fetch(`${serverUrl}/api/user/history`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${state.authToken}`,
        },
        body: JSON.stringify({ clearAll: true }),
      });
    } catch (err) {
      console.error("Clear history error:", err);
    }
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  elements.fetchInfoBtn.addEventListener("click", () => fetchMediaInfo());
  elements.urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fetchMediaInfo();
  });

  elements.formatSelect.addEventListener("change", updateFormatUI);
  elements.bitrateSelect.addEventListener("change", updateFormatUI);
  elements.downloadBtn.addEventListener("click", handleDownload);

  // History
  elements.historyRefreshBtn.addEventListener("click", loadHistory);
  elements.historyClearBtn.addEventListener("click", clearAllHistory);
  elements.historySearch.addEventListener("input", () => renderHistoryList(state.history, Boolean(state.authToken)));

  // Server config
  elements.saveServerBtn.addEventListener("click", async () => {
    const raw = elements.serverUrlInput.value.trim();
    state.serverUrl = cleanServerUrl(raw);
    await chrome.storage.local.set({ serverUrl: state.serverUrl });
    showStatus("URL du serveur enregistrée !", "success");
    await checkAuthStatus();
  });

  elements.quickServerBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.getAttribute("data-url");
      elements.serverUrlInput.value = url;
      state.serverUrl = url;
      await chrome.storage.local.set({ serverUrl: url });
      showStatus(`Serveur basculé sur ${url}`, "success");
      await checkAuthStatus();
    });
  });

  // Login
  elements.loginBtn.addEventListener("click", async () => {
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value;

    if (!username || !password) {
      alert("Veuillez saisir votre nom d'utilisateur et votre mot de passe.");
      return;
    }

    const serverUrl = cleanServerUrl(state.serverUrl);
    elements.loginBtn.disabled = true;
    elements.loginBtn.textContent = "Connexion...";

    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail: username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Identifiants invalides");
      }

      state.authToken = data.token;
      state.authUser = data.user;
      await chrome.storage.local.set({ authToken: data.token, authUser: data.user });

      updateAuthUI(true, data.user.username);
      elements.loginPassword.value = "";
      showStatus("Connexion réussie ! Historique synchronisé.", "success");

      // Auto sync local history to account
      await loadHistory();
    } catch (err) {
      alert(err.message);
    } finally {
      elements.loginBtn.disabled = false;
      elements.loginBtn.textContent = "Se connecter";
    }
  });

  // Logout
  elements.logoutBtn.addEventListener("click", async () => {
    state.authToken = null;
    state.authUser = null;
    await chrome.storage.local.remove(["authToken", "authUser"]);
    updateAuthUI(false, null);
    showStatus("Déconnecté.", "success");
    await loadHistory();
  });

  // Preferences
  elements.prefDefaultFormat.addEventListener("change", async () => {
    state.defaultFormat = elements.prefDefaultFormat.value;
    await chrome.storage.local.set({ defaultFormat: state.defaultFormat });
  });

  elements.prefDefaultBitrate.addEventListener("change", async () => {
    state.defaultBitrate = elements.prefDefaultBitrate.value;
    await chrome.storage.local.set({ defaultBitrate: state.defaultBitrate });
  });
}

// Helpers
function showStatus(text, type = "success") {
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.textContent = text;
  elements.statusMessage.classList.remove("hidden");
  setTimeout(hideStatus, 4500);
}

function hideStatus() {
  elements.statusMessage.classList.add("hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
