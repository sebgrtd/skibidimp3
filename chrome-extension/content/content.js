// SkibidiMP3 - Universal Content Script (Draggable Floating Overlay + Seamless In-Page UI Integration)

(() => {
  let isConverting = false;
  let userPrefs = { showOverlay: true, showInPage: true };

  // Load preferences from storage
  function loadPrefs() {
    chrome.storage.local.get({ showOverlay: true, showInPage: true }, (data) => {
      userPrefs = {
        showOverlay: data.showOverlay !== false,
        showInPage: data.showInPage !== false,
      };
      checkAndInject();
    });
  }

  // Listen for preference changes from popup
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.showOverlay) userPrefs.showOverlay = changes.showOverlay.newValue !== false;
    if (changes.showInPage) userPrefs.showInPage = changes.showInPage.newValue !== false;
    checkAndInject();
  });

  loadPrefs();

  // -------------------------------------------------------------
  // 1. Platform & Media Detection (Broad & Resilient)
  // -------------------------------------------------------------
  function detectMediaPage() {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("spotify.com")) return "spotify";
    if (hostname.includes("soundcloud.com")) return "soundcloud";
    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return "twitter";
    if (hostname.includes("pinterest.") || hostname.includes("pin.it")) return "pinterest";
    if (hostname.includes("vimeo.com")) return "vimeo";

    return null;
  }

  // -------------------------------------------------------------
  // 2. Direct Stream & Info Extractors
  // -------------------------------------------------------------
  function extractDirectStreams() {
    return new Promise((resolve) => {
      for (const script of document.scripts) {
        if (script.textContent && script.textContent.includes("ytInitialPlayerResponse")) {
          const match = script.textContent.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              if (data && data.streamingData) {
                return resolve(processStreamingData(data));
              }
            } catch {}
          }
        }
      }

      const script = document.createElement("script");
      const eventId = "skibidi_player_data_" + Math.random().toString(36).substring(2, 8);
      
      script.textContent = `
        (() => {
          try {
            const playerResponse = window.ytInitialPlayerResponse || (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && JSON.parse(window.ytplayer.config.args.player_response));
            window.dispatchEvent(new CustomEvent("${eventId}", { detail: playerResponse ? JSON.stringify(playerResponse) : null }));
          } catch {
            window.dispatchEvent(new CustomEvent("${eventId}", { detail: null }));
          }
        })();
      `;

      const handler = (e) => {
        window.removeEventListener(eventId, handler);
        script.remove();
        if (e.detail) {
          try {
            const data = JSON.parse(e.detail);
            resolve(processStreamingData(data));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      window.addEventListener(eventId, handler);
      (document.head || document.documentElement).appendChild(script);

      setTimeout(() => {
        window.removeEventListener(eventId, handler);
        resolve(null);
      }, 1200);
    });
  }

  function extractVimeoStream(targetQuality = "1080p") {
    return new Promise((resolve) => {
      try {
        if (window.playerConfig && window.playerConfig.request && window.playerConfig.request.files) {
          const files = window.playerConfig.request.files;
          const progressive = files.progressive || [];
          if (progressive.length > 0) {
            const qNum = parseInt(targetQuality) || 1080;
            progressive.sort((a, b) => (parseInt(b.quality) || b.height || 0) - (parseInt(a.quality) || a.height || 0));
            const matched = progressive.find(p => (parseInt(p.quality) || p.height || 0) <= qNum) || progressive[0];
            if (matched?.url) return resolve({ streamUrl: matched.url });
          }
          const hls = files.hls || {};
          const defaultCdn = hls.default_cdn;
          if (defaultCdn && hls.cdns && hls.cdns[defaultCdn]?.url) {
            return resolve({ streamUrl: hls.cdns[defaultCdn].url });
          }
        }
      } catch {}

      try {
        const entries = performance.getEntriesByType("resource");
        for (let i = entries.length - 1; i >= 0; i--) {
          const u = entries[i].name;
          if (u && (u.includes("vimeocdn.com") || u.includes("akamaized.net"))) {
            if (u.includes("playlist.m3u8") || u.includes("master.json") || u.includes("master.m3u8")) {
              return resolve({ streamUrl: u });
            }
            if (u.includes(".mp4") && !u.includes("&range=") && !u.includes("/range/")) {
              return resolve({ streamUrl: u });
            }
          }
        }
      } catch {}

      for (const script of document.scripts) {
        if (script.textContent && (script.textContent.includes("playerConfig") || script.textContent.includes("window.vimeo"))) {
          const match = script.textContent.match(/window\.playerConfig\s*=\s*({.+?});/) ||
                        script.textContent.match(/config\s*=\s*({.+?});/);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              const files = data?.request?.files || {};
              const progressive = files.progressive || [];
              if (progressive.length > 0) {
                progressive.sort((a, b) => (parseInt(b.quality) || b.height || 0) - (parseInt(a.quality) || a.height || 0));
                const qNum = parseInt(targetQuality) || 1080;
                const matched = progressive.find(p => (parseInt(p.quality) || p.height || 0) <= qNum) || progressive[0];
                if (matched?.url) return resolve({ streamUrl: matched.url });
              }
              const hls = files.hls || {};
              const defaultCdn = hls.default_cdn;
              if (defaultCdn && hls.cdns && hls.cdns[defaultCdn]?.url) {
                return resolve({ streamUrl: hls.cdns[defaultCdn].url });
              }
            } catch {}
          }
        }
      }

      const videoEl = document.querySelector("video");
      if (videoEl && videoEl.src && videoEl.src.startsWith("http") && !videoEl.src.includes("&range=") && !videoEl.src.includes("/range/")) {
        return resolve({ streamUrl: videoEl.src });
      }

      resolve(null);
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_DIRECT_STREAMS") {
      extractDirectStreams().then((res) => sendResponse(res));
      return true;
    }
    if (request.action === "GET_VIMEO_STREAM") {
      extractVimeoStream(request.targetQuality).then((res) => sendResponse(res));
      return true;
    }
  });

  function processStreamingData(data) {
    if (!data) return null;

    let title = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent
      || document.querySelector("h1.title")?.textContent
      || data.videoDetails?.title
      || document.title.replace(/ - YouTube$/, "").trim();

    let artist = document.querySelector("#channel-name #text")?.textContent
      || document.querySelector("#owner-name #text")?.textContent
      || data.videoDetails?.author
      || "YouTube";

    artist = artist.replace(/ - Topic$/, "").replace(/VEVO$/, "").trim();
    title = title.trim();

    const thumbnail = data.videoDetails?.thumbnail?.thumbnails?.pop()?.url || null;
    const formats = data.streamingData?.formats || [];
    const adaptiveFormats = data.streamingData?.adaptiveFormats || [];

    let directMp4 = formats.find(f => f.itag === 22 && f.url);
    if (!directMp4) directMp4 = formats.find(f => f.itag === 18 && f.url);
    if (!directMp4) directMp4 = formats.find(f => f.url && f.mimeType && f.mimeType.includes("video/mp4"));

    let directAudio = adaptiveFormats.find(f => f.itag === 140 && f.url);
    if (!directAudio) directAudio = adaptiveFormats.find(f => f.itag === 251 && f.url);
    if (!directAudio) directAudio = adaptiveFormats.find(f => f.url && f.mimeType && f.mimeType.includes("audio/"));

    return {
      title,
      artist,
      thumbnail,
      directMp4Url: directMp4?.url || null,
      directMp4Quality: directMp4?.qualityLabel || "720p",
      directAudioUrl: directAudio?.url || null,
      directAudioExt: (directAudio?.mimeType && directAudio.mimeType.includes("mp4")) ? "m4a" : "webm",
    };
  }

  // -------------------------------------------------------------
  // 3. Universal Draggable Floating Overlay
  // -------------------------------------------------------------
  function injectDraggableFloatingOverlay() {
    const existing = document.getElementById("skibidi-draggable-overlay");
    if (!userPrefs.showOverlay) {
      if (existing) existing.remove();
      return;
    }

    if (existing) return;

    const platform = detectMediaPage();
    if (!platform) return;

    const overlay = document.createElement("div");
    overlay.id = "skibidi-draggable-overlay";
    overlay.className = "skibidi-draggable-overlay";

    // Restore saved position
    const savedPos = localStorage.getItem("skibidi_overlay_pos");
    if (savedPos) {
      try {
        const { left, top } = JSON.parse(savedPos);
        const maxLeft = Math.max(10, window.innerWidth - 200);
        const maxTop = Math.max(10, window.innerHeight - 60);
        overlay.style.left = `${Math.min(Math.max(10, left), maxLeft)}px`;
        overlay.style.top = `${Math.min(Math.max(10, top), maxTop)}px`;
        overlay.style.right = "auto";
        overlay.style.bottom = "auto";
      } catch {}
    } else {
      overlay.style.right = "24px";
      overlay.style.bottom = "24px";
    }

    overlay.innerHTML = `
      <div class="skibidi-overlay-handle" title="Glisser pour déplacer le bouton">
        <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5"></circle>
          <circle cx="7" cy="3" r="1.5"></circle>
          <circle cx="3" cy="8" r="1.5"></circle>
          <circle cx="7" cy="8" r="1.5"></circle>
          <circle cx="3" cy="13" r="1.5"></circle>
          <circle cx="7" cy="13" r="1.5"></circle>
        </svg>
      </div>

      <button id="skibidi-overlay-btn" class="skibidi-overlay-main-btn" title="Téléchargement MP3 320k instantané">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span>MP3 Boosté</span>
      </button>

      <button id="skibidi-overlay-toggle" class="skibidi-overlay-dropdown-toggle" title="Options">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      <button id="skibidi-overlay-close" class="skibidi-overlay-close-btn" title="Masquer">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <div id="skibidi-overlay-menu" class="skibidi-overlay-menu hidden">
        <div class="skibidi-menu-header">Options SkibidiMP3</div>
        <button class="skibidi-menu-item" data-action="vps-mp3">
          <div class="menu-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </div>
          <div class="menu-text">
            <strong>MP3 320k Boosté</strong>
            <small>Conversion haute qualité + Tags ID3</small>
          </div>
        </button>
        <button class="skibidi-menu-item" data-action="client-mp4">
          <div class="menu-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2"></rect></svg>
          </div>
          <div class="menu-text">
            <strong>MP4 Vidéo HD</strong>
            <small>Flux vidéo natif direct</small>
          </div>
        </button>
        <button class="skibidi-menu-item" data-action="client-audio">
          <div class="menu-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <div class="menu-text">
            <strong>Audio Direct (M4A/WAV)</strong>
            <small>Extraction audio directe sans attente</small>
          </div>
        </button>
      </div>
    `;

    (document.body || document.documentElement).appendChild(overlay);

    const mainBtn = overlay.querySelector("#skibidi-overlay-btn");
    const dropdownToggle = overlay.querySelector("#skibidi-overlay-toggle");
    const closeBtn = overlay.querySelector("#skibidi-overlay-close");
    const menu = overlay.querySelector("#skibidi-overlay-menu");

    let isDragging = false;
    let hasMoved = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onPointerDown = (e) => {
      if (e.target.closest("#skibidi-overlay-menu") || e.target.closest("#skibidi-overlay-close")) return;

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = overlay.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
      overlay.style.left = `${initialLeft}px`;
      overlay.style.top = `${initialTop}px`;

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasMoved = true;
        overlay.classList.add("skibidi-dragging");
        menu.classList.add("hidden");
      }

      if (hasMoved) {
        const newLeft = Math.min(Math.max(8, initialLeft + dx), window.innerWidth - overlay.offsetWidth - 8);
        const newTop = Math.min(Math.max(8, initialTop + dy), window.innerHeight - overlay.offsetHeight - 8);
        overlay.style.left = `${newLeft}px`;
        overlay.style.top = `${newTop}px`;
      }
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      overlay.classList.remove("skibidi-dragging");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      if (hasMoved) {
        const rect = overlay.getBoundingClientRect();
        localStorage.setItem("skibidi_overlay_pos", JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
      }
    };

    overlay.addEventListener("pointerdown", onPointerDown);

    dropdownToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (hasMoved) return;
      menu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
      if (!menu.classList.contains("hidden")) {
        menu.classList.add("hidden");
      }
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.remove();
    });

    mainBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (hasMoved) return;
      await triggerUniversalDownload("vps-mp3", mainBtn);
    });

    menu.querySelectorAll(".skibidi-menu-item").forEach((item) => {
      item.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.add("hidden");
        const action = item.getAttribute("data-action");
        await triggerUniversalDownload(action, mainBtn);
      });
    });
  }

  // -------------------------------------------------------------
  // 4. Seamless In-Page UI Injection Across All Platforms
  // -------------------------------------------------------------
  function injectSeamlessInPageButton() {
    const existing = document.getElementById("skibidi-action-container");
    if (!userPrefs.showInPage) {
      if (existing) existing.remove();
      return;
    }

    const platform = detectMediaPage();
    if (!platform) {
      if (existing) existing.remove();
      return;
    }

    if (existing && existing.classList.contains(`skibidi-inpage-${platform}`)) {
      return;
    }

    // Comprehensive platform selectors
    const platformTargets = {
      youtube: [
        "#top-row #actions #top-level-buttons-computed",
        "#top-row #actions #actions-inner",
        "#menu #top-level-buttons-computed",
        "#actions #top-level-buttons-computed",
        "#owner",
      ],
      spotify: [
        '[data-testid="action-bar-row"]',
        '[data-testid="track-detail"] [data-testid="action-bar-row"]',
        '.main-actionBar-ActionBarRow',
        '[data-testid="now-playing-widget"]',
        '.Root__now-playing-bar',
      ],
      soundcloud: [
        '.soundActions .sc-button-group',
        '.listenEngagements .sc-button-group',
        '.soundTitle__actions',
        '.sc-button-group',
      ],
      tiktok: [
        '[data-e2e="browse-action-bar"]',
        '[data-e2e="feed-video-action-bar"]',
        '[data-e2e="video-author-container"]',
        'div[class*="ActionBarWrapper"]',
        'div[class*="VideoActionBar"]',
        'div[class*="DivActionItemContainer"]',
        'section:has(video)',
      ],
      instagram: [
        'article section:has(svg)',
        'article section',
        'div[role="presentation"] section',
        'section:has(svg[aria-label])',
        'div[class*="x78zum5"]:has(svg)',
      ],
      twitter: [
        'article [role="group"]',
        'div[data-testid="tweet"] [role="group"]',
        'div[role="group"][id*="id__"]',
        'div[data-testid="cellInnerDiv"] article [role="group"]',
      ],
      pinterest: [
        '[data-test-id="pin-action-buttons"]',
        '[data-test-id="PinActionButtons"]',
        '[data-test-id="closeup-action-bar"]',
        '[data-test-id="save-button"]',
        'div[data-test-id*="action"]',
        'div[data-test-id*="pin"] div:has(button)',
      ],
      vimeo: [
        'aside[aria-label="Actions"]',
        '[data-testid="video-actions"]',
        'div[class*="video_actions"]',
        'div[class*="Header_actions"]',
        'div[class*="Layout_sidebar"]',
        'div[class*="clip_info"]',
        '.clip_info-subline',
        '#watch-header',
        '.player_container',
        'div:has(> video)',
      ],
    };

    const selectors = platformTargets[platform] || [];
    let targetEl = null;
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          targetEl = el;
          break;
        }
      } catch {}
    }

    if (!targetEl) return;

    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "skibidi-action-container";
    container.className = `skibidi-btn-group skibidi-inpage-${platform}`;

    const mainBtn = document.createElement("button");
    mainBtn.id = "skibidi-quick-download-btn";
    mainBtn.className = "skibidi-yt-btn";
    mainBtn.title = "Télécharger en MP3 320k Boosté";
    mainBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      <span>MP3 Boosté</span>
    `;

    const dropdownBtn = document.createElement("button");
    dropdownBtn.className = "skibidi-yt-btn skibidi-dropdown-toggle";
    dropdownBtn.title = "Options";
    dropdownBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
    `;

    const menu = document.createElement("div");
    menu.className = "skibidi-dropdown-menu hidden";
    menu.innerHTML = `
      <div class="skibidi-menu-header">Options SkibidiMP3</div>
      <button class="skibidi-menu-item" data-action="vps-mp3">
        <div class="menu-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></div>
        <div class="menu-text"><strong>MP3 320k Boosté</strong><small>Transcodage serveur + Tags ID3</small></div>
      </button>
      <button class="skibidi-menu-item" data-action="client-mp4">
        <div class="menu-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2"></rect></svg></div>
        <div class="menu-text"><strong>MP4 Vidéo HD</strong><small>Téléchargement vidéo direct</small></div>
      </button>
    `;

    dropdownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => menu.classList.add("hidden"));

    mainBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerUniversalDownload("vps-mp3", mainBtn);
    });

    menu.querySelectorAll(".skibidi-menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.add("hidden");
        triggerUniversalDownload(item.getAttribute("data-action"), mainBtn);
      });
    });

    container.appendChild(mainBtn);
    container.appendChild(dropdownBtn);
    container.appendChild(menu);

    targetEl.appendChild(container);
  }

  // -------------------------------------------------------------
  // 5. Universal Download Trigger
  // -------------------------------------------------------------
  async function triggerUniversalDownload(mode, btnEl) {
    if (isConverting) return;
    const currentUrl = window.location.href;
    const platform = detectMediaPage();

    if (!platform) {
      alert("Aucun média détecté sur cette page.");
      return;
    }

    isConverting = true;
    const originalContent = btnEl.innerHTML;
    const isOverlay = btnEl.classList.contains("skibidi-overlay-main-btn");
    btnEl.className = `${isOverlay ? "skibidi-overlay-main-btn" : "skibidi-yt-btn"} skibidi-loading`;
    btnEl.innerHTML = `<div class="skibidi-yt-spinner"></div><span>Préparation...</span>`;

    try {
      if (platform === "youtube" && (mode === "client-mp4" || mode === "client-audio")) {
        btnEl.innerHTML = `<div class="skibidi-yt-spinner"></div><span>Flux direct...</span>`;
        const streams = await extractDirectStreams();

        if (mode === "client-mp4" && streams?.directMp4Url) {
          const res = await chrome.runtime.sendMessage({
            action: "DIRECT_CLIENT_DOWNLOAD",
            streamUrl: streams.directMp4Url,
            title: streams.title,
            artist: streams.artist,
            format: "mp4",
            bitrate: streams.directMp4Quality || "720p",
            thumbnail: streams.thumbnail,
            originalUrl: currentUrl,
          });
          if (!res?.success) throw new Error(res?.error || "Échec direct MP4");
          showSuccess(btnEl, isOverlay);
          return;
        }

        if (mode === "client-audio" && streams?.directAudioUrl) {
          const res = await chrome.runtime.sendMessage({
            action: "DIRECT_CLIENT_DOWNLOAD",
            streamUrl: streams.directAudioUrl,
            title: streams.title,
            artist: streams.artist,
            format: streams.directAudioExt || "m4a",
            bitrate: "Direct",
            thumbnail: streams.thumbnail,
            originalUrl: currentUrl,
          });
          if (!res?.success) throw new Error(res?.error || "Échec direct audio");
          showSuccess(btnEl, isOverlay);
          return;
        }
      }

      let vimeoDirectStream = null;
      if (platform === "vimeo") {
        btnEl.innerHTML = `<div class="skibidi-yt-spinner"></div><span>Flux Vimeo...</span>`;
        const vRes = await extractVimeoStream(mode === "client-mp4" ? "1080p" : "320k");
        if (vRes?.streamUrl) {
          vimeoDirectStream = vRes.streamUrl;
        }
      }

      btnEl.innerHTML = `<div class="skibidi-yt-spinner"></div><span>Conversion...</span>`;
      const response = await chrome.runtime.sendMessage({
        action: "QUICK_DOWNLOAD_FROM_PAGE",
        url: currentUrl,
        options: {
          format: mode === "client-mp4" ? "mp4" : "mp3",
          bitrate: mode === "client-mp4" ? "1080p" : "320k",
          streamUrl: vimeoDirectStream || undefined,
        },
      });

      if (response && response.success) {
        showSuccess(btnEl, isOverlay);
      } else {
        throw new Error(response?.error || "Erreur inconnue");
      }
    } catch (err) {
      showError(btnEl, isOverlay, err.message);
    } finally {
      setTimeout(() => {
        isConverting = false;
        btnEl.className = isOverlay ? "skibidi-overlay-main-btn" : "skibidi-yt-btn";
        btnEl.innerHTML = originalContent;
      }, 3500);
    }
  }

  function showSuccess(btnEl, isOverlay) {
    btnEl.className = `${isOverlay ? "skibidi-overlay-main-btn" : "skibidi-yt-btn"} skibidi-success`;
    btnEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Téléchargé !</span>
    `;
  }

  function showError(btnEl, isOverlay, message) {
    btnEl.className = `${isOverlay ? "skibidi-overlay-main-btn" : "skibidi-yt-btn"} skibidi-error`;
    btnEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      <span>Échec</span>
    `;
    console.error("SkibidiMP3 error:", message);
  }

  // -------------------------------------------------------------
  // 6. Navigation & Observer Watchers
  // -------------------------------------------------------------
  function checkAndInject() {
    const platform = detectMediaPage();
    if (platform) {
      if (userPrefs.showOverlay) {
        injectDraggableFloatingOverlay();
      } else {
        const existingOverlay = document.getElementById("skibidi-draggable-overlay");
        if (existingOverlay) existingOverlay.remove();
      }

      if (userPrefs.showInPage) {
        injectSeamlessInPageButton();
      } else {
        const existingInPage = document.getElementById("skibidi-action-container");
        if (existingInPage) existingInPage.remove();
      }
    } else {
      const existingOverlay = document.getElementById("skibidi-draggable-overlay");
      if (existingOverlay) existingOverlay.remove();
      const existingInPage = document.getElementById("skibidi-action-container");
      if (existingInPage) existingInPage.remove();
    }
  }

  // Watch URL and DOM changes in Single Page Apps (TikTok, Twitter, Vimeo, Pinterest, Spotify, YouTube)
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(checkAndInject, 300);
      setTimeout(checkAndInject, 1200);
    } else {
      checkAndInject();
    }
  });

  if (document.body) {
    urlObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      urlObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  window.addEventListener("yt-navigate-finish", () => setTimeout(checkAndInject, 500));
  window.addEventListener("popstate", () => setTimeout(checkAndInject, 300));
  window.addEventListener("load", () => setTimeout(checkAndInject, 500));
  document.addEventListener("DOMContentLoaded", () => setTimeout(checkAndInject, 300));

  setInterval(checkAndInject, 1500);
})();
