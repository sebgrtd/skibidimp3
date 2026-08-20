// SkibidiMP3 - YouTube Content Script (Precise Title Extraction & Proactive Detection)

(() => {
  let isConverting = false;
  let lastNotifiedUrl = "";

  function extractDirectStreams() {
    return new Promise((resolve) => {
      // 1. Try scanning script tags on the page
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

      // 2. Inject script to read window.ytInitialPlayerResponse
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

  function processStreamingData(data) {
    if (!data) return null;

    // Extract cleanest title and artist from DOM / player
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

    // Find best direct progressive MP4
    let directMp4 = formats.find(f => f.itag === 22 && f.url); // 720p
    if (!directMp4) directMp4 = formats.find(f => f.itag === 18 && f.url); // 360p
    if (!directMp4) directMp4 = formats.find(f => f.url && f.mimeType && f.mimeType.includes("video/mp4"));

    // Find direct audio stream
    let directAudio = adaptiveFormats.find(f => f.itag === 140 && f.url); // 128k M4A
    if (!directAudio) directAudio = adaptiveFormats.find(f => f.itag === 251 && f.url); // 160k WebM Opus
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

  function createActionContainer() {
    const container = document.createElement("div");
    container.id = "skibidi-action-container";
    container.className = "skibidi-btn-group";

    // Main Quick MP3 button
    const mainBtn = document.createElement("button");
    mainBtn.id = "skibidi-quick-download-btn";
    mainBtn.className = "skibidi-yt-btn";
    mainBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      <span>MP3 Boosté</span>
    `;

    // Dropdown toggle
    const dropdownBtn = document.createElement("button");
    dropdownBtn.className = "skibidi-yt-btn skibidi-dropdown-toggle";
    dropdownBtn.title = "Options de téléchargement";
    dropdownBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
    `;

    // Dropdown menu
    const menu = document.createElement("div");
    menu.className = "skibidi-dropdown-menu hidden";
    menu.innerHTML = `
      <div class="skibidi-menu-header">Options SkibidiMP3</div>
      <button class="skibidi-menu-item" data-action="vps-mp3">
        <div class="menu-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        </div>
        <div class="menu-text">
          <strong>MP3 320k Boosté</strong>
          <small>Conversion serveur + Tags ID3</small>
        </div>
      </button>
      <button class="skibidi-menu-item" data-action="client-mp4">
        <div class="menu-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2"></rect></svg>
        </div>
        <div class="menu-text">
          <strong>MP4 Direct (Client)</strong>
          <small>Téléchargement direct sans VPS</small>
        </div>
      </button>
      <button class="skibidi-menu-item" data-action="client-audio">
        <div class="menu-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
        <div class="menu-text">
          <strong>Audio Direct M4A</strong>
          <small>Flux audio natif haute vitesse</small>
        </div>
      </button>
    `;

    dropdownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
      if (!menu.classList.contains("hidden")) {
        menu.classList.add("hidden");
      }
    });

    mainBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await triggerDownload("vps-mp3", mainBtn);
    });

    menu.querySelectorAll(".skibidi-menu-item").forEach((item) => {
      item.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.add("hidden");
        const action = item.getAttribute("data-action");
        await triggerDownload(action, mainBtn);
      });
    });

    container.appendChild(mainBtn);
    container.appendChild(dropdownBtn);
    container.appendChild(menu);

    return container;
  }

  function showDetectionToast() {
    const currentUrl = window.location.href;
    if (lastNotifiedUrl === currentUrl) return;
    lastNotifiedUrl = currentUrl;

    const existing = document.getElementById("skibidi-floating-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "skibidi-floating-toast";
    toast.className = "skibidi-floating-toast";
    toast.innerHTML = `
      <div class="skibidi-toast-badge">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      </div>
      <div class="skibidi-toast-content">
        <span class="skibidi-toast-title">Média détecté</span>
        <span class="skibidi-toast-desc">Disponible en MP3 ou MP4 direct</span>
      </div>
      <div class="skibidi-toast-actions">
        <button id="skibidi-toast-dl-btn" class="skibidi-toast-btn">Télécharger</button>
        <button id="skibidi-toast-close-btn" class="skibidi-toast-close" title="Fermer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    toast.querySelector("#skibidi-toast-dl-btn").addEventListener("click", () => {
      toast.remove();
      const mainBtn = document.getElementById("skibidi-quick-download-btn");
      if (mainBtn) triggerDownload("vps-mp3", mainBtn);
    });

    toast.querySelector("#skibidi-toast-close-btn").addEventListener("click", () => {
      toast.remove();
    });

    document.body.appendChild(toast);

    setTimeout(() => {
      if (document.getElementById("skibidi-floating-toast") === toast) {
        toast.remove();
      }
    }, 6000);
  }

  async function triggerDownload(mode, btnEl) {
    if (isConverting) return;

    const currentUrl = window.location.href;
    if (!currentUrl.includes("watch?v=") && !currentUrl.includes("/shorts/")) {
      alert("Veuillez vous positionner sur une vidéo YouTube.");
      return;
    }

    isConverting = true;
    btnEl.className = "skibidi-yt-btn skibidi-loading";
    btnEl.innerHTML = `<div class="skibidi-yt-spinner"></div><span>Préparation...</span>`;

    try {
      if (mode === "client-mp4" || mode === "client-audio") {
        btnEl.innerHTML = `<div class="skibidi-yt-spinner"></div><span>Flux direct...</span>`;
        const streams = await extractDirectStreams();

        if (mode === "client-mp4" && streams && streams.directMp4Url) {
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

          if (!res?.success) throw new Error(res?.error || "Échec du téléchargement direct");
          showSuccess(btnEl);
          return;
        }

        if (mode === "client-audio" && streams && streams.directAudioUrl) {
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

          if (!res?.success) throw new Error(res?.error || "Échec du téléchargement audio");
          showSuccess(btnEl);
          return;
        }
      }

      btnEl.innerHTML = `<div class="skibidi-yt-spinner"></div><span>Conversion...</span>`;
      const response = await chrome.runtime.sendMessage({
        action: "QUICK_DOWNLOAD_FROM_PAGE",
        url: currentUrl,
        options: { format: mode === "client-mp4" ? "mp4" : "mp3" },
      });

      if (response && response.success) {
        showSuccess(btnEl);
      } else {
        throw new Error(response?.error || "Erreur inconnue");
      }
    } catch (err) {
      showError(btnEl, err.message);
    } finally {
      setTimeout(() => {
        isConverting = false;
        btnEl.className = "skibidi-yt-btn";
        btnEl.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>MP3 Boosté</span>
        `;
      }, 3500);
    }
  }

  function showSuccess(btnEl) {
    btnEl.className = "skibidi-yt-btn skibidi-success";
    btnEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Téléchargé !</span>
    `;
  }

  function showError(btnEl, message) {
    btnEl.className = "skibidi-yt-btn skibidi-error";
    btnEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
      <span>Échec</span>
    `;
    console.error("SkibidiMP3 error:", message);
  }

  function injectButton() {
    if (!window.location.href.includes("watch?v=") && !window.location.href.includes("/shorts/")) {
      return;
    }

    if (document.getElementById("skibidi-action-container")) {
      return;
    }

    const targets = [
      "#top-row #actions #top-level-buttons-computed",
      "#top-row #actions #actions-inner",
      "#menu #top-level-buttons-computed",
      "#actions #top-level-buttons-computed",
      "#owner",
    ];

    let targetEl = null;
    for (const selector of targets) {
      const el = document.querySelector(selector);
      if (el) {
        targetEl = el;
        break;
      }
    }

    if (targetEl) {
      const container = createActionContainer();
      targetEl.appendChild(container);
      showDetectionToast();
    }
  }

  window.addEventListener("yt-navigate-finish", () => {
    setTimeout(injectButton, 600);
    setTimeout(injectButton, 1800);
  });

  window.addEventListener("load", () => {
    setTimeout(injectButton, 800);
  });

  setInterval(() => {
    if (window.location.href.includes("watch?v=") || window.location.href.includes("/shorts/")) {
      if (!document.getElementById("skibidi-action-container")) {
        injectButton();
      }
    }
  }, 2000);
})();
