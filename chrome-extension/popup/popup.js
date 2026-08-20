// SkibidiMP3 - Popup Script (Dynamic Platform Formats & Modes)

const DEFAULT_SERVER_URL = "http://localhost:3030";

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

    const isPrefAudio = ["mp3", "flac", "wav", "m4a"].includes(state.defaultFormat);
    elements.formatSelect.value = isPrefAudio ? state.defaultFormat : "mp3";
    elements.boostContainer.style.display = "flex";
  } else if (mode === "video") {
    const opt = document.createElement("option");
    opt.value = "mp4";
    opt.textContent = "MP4 (Vidéo HD 1080p / 720p)";
    elements.formatSelect.appendChild(opt);
    elements.boostContainer.style.display = "none";
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
    elements.bitrateContainer.style.display = "none";
    elements.optionsGrid.className = "options-grid single-col";
    elements.boostContainer.style.display = "none";
    elements.downloadBtn.querySelector(".btn-text").textContent = "Télécharger la Vidéo (MP4 HD)";
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    url = cleanYouTubeMediaUrl(url);
    elements.urlInput.value = url;
  }

  // If info not fetched yet, fetch it first
  if (!state.currentMedia || !state.currentMedia.title) {
    await fetchMediaInfo(url);
  }

  const serverUrl = cleanServerUrl(state.serverUrl);
  const format = elements.formatSelect.value;
  const bitrate = elements.bitrateSelect.value;
  const boost = elements.boostSelect.value;
  const editTitle = elements.editTitle.value.trim() || (state.currentMedia?.title) || "Musique";
  const editArtist = elements.editArtist.value.trim() || (state.currentMedia?.artist) || "";
  const thumbnail = state.currentMedia?.thumbnail || "";

  elements.downloadBtn.disabled = true;
  elements.progressContainer.classList.remove("hidden");
  elements.progressFill.style.width = "15%";
  
  const isVideo = format === "mp4";
  const isImage = format === "png" || format === "jpg";
  const isGif = format === "gif";

  elements.progressLabel.textContent = isImage 
    ? "Récupération de l'image HD..." 
    : isVideo 
      ? "Extraction du flux vidéo..." 
      : isGif 
        ? "Génération du GIF..." 
        : "Connexion et extraction audio...";
        
  hideStatus();

  let progress = 15;
  const interval = setInterval(() => {
    if (progress < 85) {
      progress += Math.floor(Math.random() * 8) + 2;
      elements.progressFill.style.width = `${progress}%`;
      if (progress > 50) elements.progressLabel.textContent = isImage ? "Traitement de l'image..." : isVideo ? "Encodage vidéo HD..." : isGif ? "Conversion GIF..." : "Conversion 320kbps...";
  // --- DIRECT CLIENT-SIDE MP4 DOWNLOAD (Zero VPS - 100% Bypass Bot Walls) ---
  if (isVideo && (url.includes("youtube.com") || url.includes("youtu.be"))) {
    let directStream = null;

    // 1. Try from active YouTube tab
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id && (activeTab.url?.includes("youtube.com") || activeTab.url?.includes("youtu.be"))) {
        directStream = await chrome.tabs.sendMessage(activeTab.id, { action: "GET_DIRECT_STREAMS" });
      }
    } catch {}

    // 2. Try direct client-side fetch from extension
    if (!directStream || !directStream.directMp4Url) {
      try {
        const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
          if (pageRes.ok) {
            const html = await pageRes.text();
            const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (jsonMatch) {
              const playerData = JSON.parse(jsonMatch[1]);
              const formats = playerData.streamingData?.formats || [];
              const directMp4 = formats.find((f) => f.itag === 22 && f.url) || formats.find((f) => f.itag === 18 && f.url) || formats.find((f) => f.url && f.mimeType?.includes("video/mp4"));
              if (directMp4 && directMp4.url) {
                directStream = {
                  title: playerData.videoDetails?.title || editTitle,
                  artist: playerData.videoDetails?.author || editArtist,
                  thumbnail: playerData.videoDetails?.thumbnail?.thumbnails?.pop()?.url || thumbnail,
                  directMp4Url: directMp4.url,
                  directMp4Quality: directMp4.qualityLabel || "720p",
                };
              }
            }
          }
        }
      } catch (err) {
        console.warn("Client-side YouTube direct fetch error:", err);
      }
    }

    // 3. If direct stream resolved client-side, download instantly!
    if (directStream && directStream.directMp4Url) {
      clearInterval(interval);
      elements.progressFill.style.width = "100%";
      elements.progressLabel.textContent = "Téléchargement direct MP4 HD lancé !";

      const res = await chrome.runtime.sendMessage({
        action: "DIRECT_CLIENT_DOWNLOAD",
        streamUrl: directStream.directMp4Url,
        title: editTitle || directStream.title,
        artist: editArtist || directStream.artist,
        format: "mp4",
        bitrate: directStream.directMp4Quality || "720p",
        thumbnail: thumbnail || directStream.thumbnail,
        originalUrl: url,
      });

      if (res && res.success) {
        showStatus(`« ${editTitle} » (MP4 HD) téléchargé avec succès !`, "success");
        elements.downloadBtn.disabled = false;
        setTimeout(() => {
          elements.progressContainer.classList.add("hidden");
          elements.progressFill.style.width = "0%";
        }, 2000);
        return;
      }
    }
  }

  // --- STANDARD VPS TRANSCODING FALLBACK ---
  try {
    const headers = { "Content-Type": "application/json" };
    if (state.authToken) {
      headers["Authorization"] = `Bearer ${state.authToken}`;
    }

    const payload = {
      url: state.currentMedia?.originalUrl || state.currentMedia?.url || url,
      format,
      bitrate: isVideo ? "1080p" : isImage ? "HD" : bitrate,
      boost,
      editTitle,
      editArtist,
      thumbnail,
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

    // Save to user history if logged in
    if (state.authToken) {
      try {
        await fetch(`${serverUrl}/api/user/history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.authToken}`,
          },
          body: JSON.stringify({
            title: editTitle,
            artist: editArtist,
            thumbnail: state.currentMedia?.thumbnail,
            format,
            bitrate: isVideo ? "1080p" : isImage ? "HD" : bitrate,
            url: state.currentMedia?.originalUrl || state.currentMedia?.url || url,
          }),
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
    elements.downloadBtn.disabled = false;
    setTimeout(() => {
      elements.progressContainer.classList.add("hidden");
      elements.progressFill.style.width = "0%";
    }, 2000);
  }
}

// --- History Management ---
async function loadHistory() {
  const serverUrl = cleanServerUrl(state.serverUrl);
  if (!state.authToken) {
    renderHistoryPlaceholder("Connectez-vous dans l'onglet Compte pour synchroniser votre historique avec le site.");
    return;
  }

  elements.historyList.innerHTML = `<div class="empty-state">Chargement de l'historique...</div>`;

  try {
    const res = await fetch(`${serverUrl}/api/user/history`, {
      headers: { "Authorization": `Bearer ${state.authToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        updateAuthUI(false, null);
        renderHistoryPlaceholder("Session expirée. Veuillez vous reconnecter.");
        return;
      }
      throw new Error(`Erreur serveur (${res.status})`);
    }

    const data = await res.json();
    state.history = data.history || [];
    renderHistoryList(state.history);
  } catch (err) {
    renderHistoryPlaceholder(`Impossible de charger l'historique (${err.message})`);
  }
}

function renderHistoryList(items) {
  const search = (elements.historySearch.value || "").toLowerCase().trim();
  const filtered = items.filter(
    (item) =>
      (item.title && item.title.toLowerCase().includes(search)) ||
      (item.artist && item.artist.toLowerCase().includes(search))
  );

  if (filtered.length === 0) {
    renderHistoryPlaceholder(search ? "Aucun résultat trouvé." : "Votre historique est vide.");
    return;
  }

  elements.historyList.innerHTML = "";
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
  const serverUrl = cleanServerUrl(state.serverUrl);
  try {
    const res = await fetch(`${serverUrl}/api/user/history`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      state.history = state.history.filter((h) => h.id !== id);
      renderHistoryList(state.history);
    }
  } catch (err) {
    console.error("Delete history error:", err);
  }
}

async function clearAllHistory() {
  if (!confirm("Voulez-vous vraiment effacer tout votre historique ?")) return;

  const serverUrl = cleanServerUrl(state.serverUrl);
  try {
    const res = await fetch(`${serverUrl}/api/user/history`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({ clearAll: true }),
    });

    if (res.ok) {
      state.history = [];
      renderHistoryList(state.history);
    }
  } catch (err) {
    console.error("Clear history error:", err);
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
  elements.historySearch.addEventListener("input", () => renderHistoryList(state.history));

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
      showStatus("Connexion réussie !", "success");
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
    elements.historyList.innerHTML = "";
    showStatus("Déconnecté.", "success");
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
