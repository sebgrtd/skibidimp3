// SkibidiMP3 - Popup Script

const DEFAULT_SERVER_URL = "http://localhost:3030";

let state = {
  serverUrl: DEFAULT_SERVER_URL,
  authToken: null,
  authUser: null,
  currentMedia: null,
  history: [],
  defaultFormat: "mp3",
  defaultBitrate: "320k",
  defaultBoost: "0",
};

// DOM Elements
const elements = {
  // Tabs
  navTabs: document.querySelectorAll(".nav-tab"),
  tabPanes: document.querySelectorAll(".tab-pane"),
  
  // Auth Header Badge
  authBadge: document.getElementById("auth-status-badge"),
  authStatusDot: document.querySelector("#auth-status-badge .status-dot"),
  authStatusText: document.getElementById("auth-status-text"),

  // Converter Tab
  urlInput: document.getElementById("url-input"),
  fetchInfoBtn: document.getElementById("fetch-info-btn"),
  mediaCard: document.getElementById("media-card"),
  mediaThumb: document.getElementById("media-thumb"),
  mediaTitleDisplay: document.getElementById("media-title-display"),
  mediaArtistDisplay: document.getElementById("media-artist-display"),
  mediaPlatformBadge: document.getElementById("media-platform-badge"),
  mediaDurationBadge: document.getElementById("media-duration-badge"),
  editTitle: document.getElementById("edit-title"),
  editArtist: document.getElementById("edit-artist"),
  formatSelect: document.getElementById("format-select"),
  bitrateSelect: document.getElementById("bitrate-select"),
  bitrateContainer: document.getElementById("bitrate-container"),
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
  elements.formatSelect.value = state.defaultFormat;
  elements.bitrateSelect.value = state.defaultBitrate;
  elements.boostSelect.value = state.defaultBoost;

  updateFormatUI();
}

function cleanServerUrl(url) {
  if (!url) return DEFAULT_SERVER_URL;
  return url.trim().replace(/\/+$/, "");
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

  // If token is invalid
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
      const u = tab.url;
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
  const targetUrl = (url || elements.urlInput.value || "").trim();
  if (!targetUrl) return;

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

    // Populate UI
    elements.mediaThumb.src = data.thumbnail || "icons/icon128.png";
    elements.mediaTitleDisplay.textContent = data.title || "Titre inconnu";
    elements.mediaArtistDisplay.textContent = data.artist || "Artiste inconnu";
    elements.mediaPlatformBadge.textContent = (data.platform || "Média").toUpperCase();

    const mins = Math.floor((data.duration || 0) / 60);
    const secs = (data.duration || 0) % 60;
    elements.mediaDurationBadge.textContent = data.duration ? `${mins}:${secs < 10 ? '0' : ''}${secs}` : "--:--";

    elements.editTitle.value = data.title || "";
    elements.editArtist.value = data.artist || "";

    elements.mediaCard.classList.remove("hidden");
  } catch (err) {
    showStatus(err.message || "Impossible de récupérer les infos de la vidéo.", "error");
    elements.mediaCard.classList.add("hidden");
  } finally {
    elements.fetchInfoBtn.disabled = false;
    elements.fetchInfoBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    `;
  }
}

// Format changes (hide bitrate for video/lossless)
function updateFormatUI() {
  const format = elements.formatSelect.value;
  if (format === "mp4" || format === "wav" || format === "flac") {
    elements.bitrateContainer.style.opacity = "0.4";
    elements.bitrateContainer.style.pointerEvents = "none";
  } else {
    elements.bitrateContainer.style.opacity = "1";
    elements.bitrateContainer.style.pointerEvents = "auto";
  }
  
  const isVideo = format === "mp4";
  elements.downloadBtn.querySelector(".btn-text").textContent = isVideo 
    ? "⚡ Télécharger la Vidéo (MP4)" 
    : `⚡ Télécharger en ${format.toUpperCase()}`;
}

// Download Handler
async function handleDownload() {
  const url = elements.urlInput.value.trim();
  if (!url) {
    showStatus("Veuillez saisir une URL valide.", "error");
    return;
  }

  const serverUrl = cleanServerUrl(state.serverUrl);
  const format = elements.formatSelect.value;
  const bitrate = elements.bitrateSelect.value;
  const boost = elements.boostSelect.value;
  const editTitle = elements.editTitle.value.trim() || (state.currentMedia?.title) || "Audio";
  const editArtist = elements.editArtist.value.trim() || (state.currentMedia?.artist) || "";

  elements.downloadBtn.disabled = true;
  elements.progressContainer.classList.remove("hidden");
  elements.progressFill.style.width = "15%";
  elements.progressLabel.textContent = "Connexion et extraction du média...";
  hideStatus();

  // Progress simulation
  let progress = 15;
  const interval = setInterval(() => {
    if (progress < 85) {
      progress += Math.floor(Math.random() * 8) + 2;
      elements.progressFill.style.width = `${progress}%`;
      if (progress > 50) elements.progressLabel.textContent = "Conversion & encodage de haute qualité...";
      if (progress > 75) elements.progressLabel.textContent = "Finalisation du fichier...";
    }
  }, 400);

  try {
    const headers = { "Content-Type": "application/json" };
    if (state.authToken) {
      headers["Authorization"] = `Bearer ${state.authToken}`;
    }

    const payload = {
      url: state.currentMedia?.originalUrl || state.currentMedia?.url || url,
      format,
      bitrate,
      boost,
      editTitle,
      editArtist,
      thumbnail: state.currentMedia?.thumbnail,
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
    elements.progressLabel.textContent = "Fichier prêt ! Démarrage du téléchargement...";

    const blob = await res.blob();
    const reader = new FileReader();
    
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const cleanArtist = editArtist.trim();
    const cleanTitle = editTitle.trim();
    const filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
    const safeFilename = filename.replace(/[\\/:*?"<>|]/g, "_");

    // Trigger Chrome native download
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
            title: cleanTitle,
            artist: cleanArtist,
            thumbnail: state.currentMedia?.thumbnail,
            format,
            bitrate: format === "mp4" ? "1080p" : bitrate,
            url: state.currentMedia?.originalUrl || state.currentMedia?.url || url,
          }),
        });
      } catch (histErr) {
        console.warn("History save error:", histErr);
      }
    }

    showStatus(`« ${cleanTitle} » téléchargé avec succès !`, "success");
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
      <img src="${item.thumbnail || 'icons/icon48.png'}" class="history-thumb" alt="">
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
        <button class="btn-item-action danger delete-record-btn" title="Supprimer de l'historique">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    // Download again
    el.querySelector(".download-again-btn").addEventListener("click", () => {
      elements.urlInput.value = item.url;
      // Switch to converter tab
      elements.navTabs[0].click();
      fetchMediaInfo(item.url);
    });

    // Delete record
    el.querySelector(".delete-record-btn").addEventListener("click", async () => {
      await deleteHistoryItem(item.id);
    });

    elements.historyList.appendChild(el);
  });
}

function renderHistoryPlaceholder(text) {
  elements.historyList.innerHTML = `
    <div class="empty-state">
      <div style="font-size: 24px;">📂</div>
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
    elements.formatSelect.value = state.defaultFormat;
    updateFormatUI();
    await chrome.storage.local.set({ defaultFormat: state.defaultFormat });
  });

  elements.prefDefaultBitrate.addEventListener("change", async () => {
    state.defaultBitrate = elements.prefDefaultBitrate.value;
    elements.bitrateSelect.value = state.defaultBitrate;
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
