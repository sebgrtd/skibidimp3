import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PYTHON_PATH = process.env.PYTHON_PATH || (process.platform === "win32" ? `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe` : "python3");

const DATA_DIR = path.join(process.cwd(), ".data");
const COOKIES_FILE = path.join(DATA_DIR, "cookies.txt");
const ALT_COOKIES = path.join(process.cwd(), "cookies.txt");

export type PlatformType = 
  | "youtube" 
  | "spotify" 
  | "soundcloud" 
  | "vimeo" 
  | "instagram" 
  | "tiktok" 
  | "pinterest" 
  | "twitter" 
  | "generic";

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const isModule = PYTHON_PATH.includes("python");
    const cookieArgs: string[] = [];
    if (fs.existsSync(COOKIES_FILE)) {
      cookieArgs.push("--cookies", COOKIES_FILE);
    } else if (fs.existsSync(ALT_COOKIES)) {
      cookieArgs.push("--cookies", ALT_COOKIES);
    }

    const fullArgs = isModule ? ["-m", "yt_dlp", ...cookieArgs, ...args] : [...cookieArgs, ...args];
    const command = isModule ? PYTHON_PATH : "yt-dlp";

    const proc = spawn(command, fullArgs);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => stdout += chunk.toString());
    proc.stderr.on("data", (chunk) => stderr += chunk.toString());

    proc.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

// Fallback for YouTube oEmbed
async function fetchYouTubeViaOEmbed(trimmedUrl: string): Promise<{ title: string; artist: string; thumbnail: string | null; videoId: string | null } | null> {
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(trimmedUrl)}&format=json`;
    const res = await fetch(oEmbedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const videoIdMatch = trimmedUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return {
      title: data.title || "Vidéo YouTube",
      artist: data.author_name || "YouTube",
      thumbnail: data.thumbnail_url || null,
      videoId: videoIdMatch?.[1] || null,
    };
  } catch {
    return null;
  }
}

// Fallback for Vimeo direct player config & HLS stream
async function fetchVimeoMedia(trimmedUrl: string): Promise<{ title: string; artist: string; thumbnail: string | null; duration: number; videoUrl?: string } | null> {
  try {
    const idMatch = trimmedUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+)/);
    const vimeoId = idMatch ? idMatch[1] : null;
    if (!vimeoId) return null;

    const iframeUrl = `https://player.vimeo.com/video/${vimeoId}`;
    const res = await fetch(iframeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Referer": "https://vimeo.com/"
      }
    });

    if (!res.ok) return null;
    const html = await res.text();
    const prefix = "window.playerConfig = ";
    const startIdx = html.indexOf(prefix);
    if (startIdx === -1) return null;

    const jsonStart = startIdx + prefix.length;
    let depth = 0;
    let jsonEnd = jsonStart;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    const data = JSON.parse(html.substring(jsonStart, jsonEnd));
    const title = data.video?.title || "Vidéo Vimeo";
    const artist = data.video?.owner?.name || data.video?.author_name || "Vimeo";
    const duration = data.video?.duration || 0;
    const thumbnail = data.video?.thumbs?.["640"] || data.video?.thumbs?.base || null;

    const hls = data.request?.files?.hls;
    const cdns = hls?.cdns || {};
    const videoUrl = cdns.fastly_skyfire?.url || cdns.akfire_interconnect_quic?.url || hls?.default_cdn;

    return {
      title,
      artist,
      thumbnail,
      duration,
      videoUrl,
    };
  } catch {
    return null;
  }
}

// Fallback for SoundCloud oEmbed
async function fetchSoundCloudViaOEmbed(trimmedUrl: string): Promise<{ title: string; artist: string; thumbnail: string | null; duration: number } | null> {
  try {
    const oEmbedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trimmedUrl)}`;
    const res = await fetch(oEmbedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || "Titre SoundCloud",
      artist: data.author_name || "SoundCloud",
      thumbnail: data.thumbnail_url || null,
      duration: 0,
    };
  } catch {
    return null;
  }
}

// Fallback for Pinterest HTML Scraper (High-Res Images & Videos)
async function fetchPinterestMedia(trimmedUrl: string): Promise<{ title: string; artist: string; thumbnail: string | null; imageUrl?: string; videoUrl?: string; isVideo: boolean } | null> {
  try {
    const res = await fetch(trimmedUrl, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
      html.match(/<title>(.*?)<\/title>/i);
    const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i) ||
      html.match(/href=["'](https:\/\/i\.pinimg\.com\/[^\s"']+)["']/i);
    const videoMatch = html.match(/<meta\s+property=["']og:video(?::secure_url)?["']\s+content=["'](.*?)["']/i);
    const vPinMatch = html.match(/https:\/\/v\.pinimg\.com\/videos\/[^\s"'\\]+/);
    const mp4Match = html.match(/https:\/\/[^\s"'\\]*pinimg\.com[^\s"'\\]*\.mp4/);

    let rawImg = imageMatch ? imageMatch[1] : null;
    if (rawImg) {
      // Upgrade Pinterest image resolution to full original quality
      rawImg = rawImg.replace(/\/(?:236x|474x|736x|564x)\//, "/originals/");
    }

    const videoUrl = videoMatch ? videoMatch[1] : (vPinMatch ? vPinMatch[0] : (mp4Match ? mp4Match[0] : undefined));

    return {
      title: titleMatch ? titleMatch[1].replace(/ - Pinterest$/, "").replace(/&amp;/g, "&") : "Pinterest Pin",
      artist: "Pinterest",
      thumbnail: rawImg,
      imageUrl: rawImg || undefined,
      videoUrl,
      isVideo: !!videoUrl,
    };
  } catch {
    return null;
  }
}

// Fallback for Twitter / X Media via FXTwitter API with Carousel Multi-Item Support
export interface TwitterMediaItem {
  index: number;
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string | null;
  mediaType: "video" | "image" | "gif";
}

async function fetchTwitterMedia(trimmedUrl: string): Promise<{
  title: string;
  artist: string;
  thumbnail: string | null;
  mediaType: "video" | "image" | "gif" | "text";
  mediaUrl?: string;
  duration?: number;
  entries?: TwitterMediaItem[];
} | null> {
  try {
    // 1. Try FXTwitter API
    try {
      const fxUrl = trimmedUrl.replace(/twitter\.com|x\.com/, "api.fxtwitter.com");
      const res = await fetch(fxUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" }
      });

      if (res.ok) {
        const json = await res.json();
        const tweet = json.tweet;

        if (tweet) {
          let mediaType: "video" | "image" | "gif" | "text" = "text";
          let mediaUrl: string | undefined = undefined;
          let thumb: string | null = null;
          let duration = 0;
          const entries: TwitterMediaItem[] = [];

          const authorName = tweet.author ? `@${tweet.author.screen_name} (${tweet.author.name})` : "X (Twitter)";

          if (tweet.media?.all && Array.isArray(tweet.media.all) && tweet.media.all.length > 1) {
            tweet.media.all.forEach((item: any, idx: number) => {
              entries.push({
                index: idx + 1,
                id: `tw_${idx + 1}`,
                title: `Élément ${idx + 1} (${item.type === "video" ? "Vidéo" : (item.type === "gif" ? "GIF" : "Image")})`,
                artist: authorName,
                url: item.url,
                thumbnail: item.thumbnail_url || item.url,
                mediaType: item.type === "video" ? "video" : (item.type === "gif" ? "gif" : "image")
              });
            });
          } else if (tweet.media?.photos && tweet.media.photos.length > 1) {
            tweet.media.photos.forEach((photo: any, idx: number) => {
              entries.push({
                index: idx + 1,
                id: `tw_photo_${idx + 1}`,
                title: `Image ${idx + 1}`,
                artist: authorName,
                url: photo.url,
                thumbnail: photo.url,
                mediaType: "image"
              });
            });
          }

          if (tweet.media?.videos?.length > 0) {
            const vid = tweet.media.videos[0];
            mediaType = vid.type === "gif" ? "gif" : "video";
            mediaUrl = vid.url;
            thumb = vid.thumbnail_url || null;
            duration = vid.duration ? Math.round(vid.duration / 1000) : 0;
          } else if (tweet.media?.photos?.length > 0) {
            mediaType = "image";
            mediaUrl = tweet.media.photos[0].url;
            thumb = tweet.media.photos[0].url;
          }

          return {
            title: tweet.text ? (tweet.text.length > 80 ? tweet.text.substring(0, 80) + "..." : tweet.text) : "Post X / Twitter",
            artist: authorName,
            thumbnail: thumb || (tweet.author ? tweet.author.avatar_url : null),
            mediaType,
            mediaUrl,
            duration,
            entries: entries.length > 1 ? entries : undefined,
          };
        }
      }
    } catch {}

    // 2. Fallback to VXTwitter API
    try {
      const vxUrl = trimmedUrl.replace(/twitter\.com|x\.com/, "api.vxtwitter.com");
      const vxRes = await fetch(vxUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (vxRes.ok) {
        const vxJson = await vxRes.json();
        if (vxJson && (vxJson.hasMedia || (vxJson.mediaURLs && vxJson.mediaURLs.length > 0))) {
          const authorName = vxJson.user_screen_name ? `@${vxJson.user_screen_name} (${vxJson.user_name || ""})` : "X (Twitter)";
          const mediaUrls: string[] = vxJson.mediaURLs || [];

          if (mediaUrls.length > 1) {
            const entries: TwitterMediaItem[] = mediaUrls.map((url: string, idx: number) => {
              const isV = url.includes(".mp4") || url.includes("video.twimg.com");
              return {
                index: idx + 1,
                id: `tw_vx_${idx + 1}`,
                title: `Élément ${idx + 1} (${isV ? "Vidéo" : "Image"})`,
                artist: authorName,
                url,
                thumbnail: isV ? (vxJson.thumbnail || url) : url,
                mediaType: isV ? "video" : "image",
              };
            });

            return {
              title: vxJson.text ? (vxJson.text.length > 80 ? vxJson.text.substring(0, 80) + "..." : vxJson.text) : "Post X / Twitter",
              artist: authorName,
              thumbnail: entries[0].thumbnail,
              mediaType: "image",
              duration: 0,
              entries,
            };
          }

          if (mediaUrls.length === 1) {
            const first = mediaUrls[0];
            const isV = first.includes(".mp4") || first.includes("video.twimg.com");
            return {
              title: vxJson.text ? (vxJson.text.length > 80 ? vxJson.text.substring(0, 80) + "..." : vxJson.text) : "Post X / Twitter",
              artist: authorName,
              thumbnail: first,
              mediaType: isV ? "video" : "image",
              mediaUrl: first,
              duration: 0,
            };
          }
        }
      }
    } catch {}

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let trimmedUrl = "";
  let platform: PlatformType = "generic";

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL invalide ou manquante." }, { status: 400 });
    }

    trimmedUrl = url.trim();

    // 1. Identify Platform
    if (trimmedUrl.includes("youtube.com") || trimmedUrl.includes("youtu.be")) {
      platform = "youtube";
    } else if (trimmedUrl.includes("spotify.com") || trimmedUrl.includes("open.spotify.com")) {
      platform = "spotify";
    } else if (trimmedUrl.includes("soundcloud.com")) {
      platform = "soundcloud";
    } else if (trimmedUrl.includes("vimeo.com")) {
      platform = "vimeo";
    } else if (trimmedUrl.includes("tiktok.com")) {
      platform = "tiktok";
    } else if (trimmedUrl.includes("instagram.com")) {
      platform = "instagram";
    } else if (trimmedUrl.includes("twitter.com") || trimmedUrl.includes("x.com")) {
      platform = "twitter";
    } else if (trimmedUrl.includes("pinterest.com") || trimmedUrl.includes("pin.it")) {
      platform = "pinterest";
    }

    // 2. Specialized Platform Handlers

    // --- PINTEREST ---
    if (platform === "pinterest") {
      const pinData = await fetchPinterestMedia(trimmedUrl);
      if (pinData) {
        return NextResponse.json({
          platform: "pinterest",
          isPlaylist: false,
          title: pinData.title,
          artist: pinData.artist,
          thumbnail: pinData.thumbnail,
          duration: 0,
          url: pinData.videoUrl || pinData.imageUrl || trimmedUrl,
          originalUrl: trimmedUrl,
          mediaType: pinData.isVideo ? "video" : "image",
          hasVideo: pinData.isVideo,
          hasAudio: pinData.isVideo,
          hasImage: !pinData.isVideo,
          availableFormats: pinData.isVideo ? ["mp4", "mp3", "png"] : ["png", "jpg"],
        });
      }
    }

    // --- TWITTER / X ---
    if (platform === "twitter") {
      const twData = await fetchTwitterMedia(trimmedUrl);
      if (twData && twData.mediaType !== "text") {
        if (twData.entries && twData.entries.length > 1) {
          return NextResponse.json({
            platform: "twitter",
            isPlaylist: true,
            title: twData.title,
            artist: twData.artist,
            thumbnail: twData.thumbnail,
            totalTracks: twData.entries.length,
            entries: twData.entries,
            url: trimmedUrl,
            originalUrl: trimmedUrl,
            availableFormats: ["png", "jpg", "mp4", "mp3", "gif"],
          });
        }

        const isVid = twData.mediaType === "video";
        const isGif = twData.mediaType === "gif";
        const isImg = twData.mediaType === "image";

        return NextResponse.json({
          platform: "twitter",
          isPlaylist: false,
          title: twData.title,
          artist: twData.artist,
          thumbnail: twData.thumbnail,
          duration: twData.duration || 0,
          url: twData.mediaUrl || trimmedUrl,
          originalUrl: trimmedUrl,
          mediaType: twData.mediaType,
          hasVideo: isVid || isGif,
          hasAudio: isVid,
          hasImage: isImg || isGif,
          availableFormats: isVid 
            ? ["mp4", "mp3", "gif", "png"] 
            : isGif 
              ? ["gif", "mp4", "png"] 
              : ["png", "jpg"],
        });
      }
    }

    // --- SPOTIFY ---
    if (platform === "spotify") {
      try {
        const match = trimmedUrl.match(/spotify\.com\/(?:[a-zA-Z0-9_-]+\/)*(track|playlist|album|artist)\/([a-zA-Z0-9]+)/i);
        if (match) {
          const [, type, id] = match;
          const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
          const htmlRes = await fetch(embedUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });

          if (htmlRes.ok) {
            const htmlText = await htmlRes.text();
            const jsonMatch = htmlText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/);

            if (jsonMatch) {
              const nextData = JSON.parse(jsonMatch[1]);
              const entity = nextData.props?.pageProps?.state?.data?.entity;

              if (entity) {
                if (type === "playlist" || type === "album") {
                  const rawTracks = entity.trackList || entity.tracks || [];
                  const defaultAlbumArtist = entity.subtitle || (entity.artists ? (Array.isArray(entity.artists) ? entity.artists.map((a: any) => typeof a === "string" ? a : (a.name || "")).join(", ") : entity.artists) : "Spotify");
                  const entries = rawTracks.map((t: any, idx: number) => {
                    const trackId = t.id || (t.uri ? t.uri.split(":").pop() : null) || `track_${idx}`;
                    const trackArtist = t.artists ? (Array.isArray(t.artists) ? t.artists.map((a: any) => typeof a === "string" ? a : (a.name || "")).join(", ") : t.artists) : (t.subtitle || defaultAlbumArtist);
                    const trackTitle = t.title || t.name || `Piste ${idx + 1}`;
                    const trackUrl = trackId && !trackId.startsWith("track_") 
                      ? `https://open.spotify.com/track/${trackId}` 
                      : `scsearch5:${trackArtist} ${trackTitle}`;

                    return {
                      index: idx + 1,
                      id: trackId,
                      title: trackTitle,
                      artist: trackArtist,
                      duration: Math.floor((t.duration || 180000) / 1000),
                      url: trackUrl,
                      originalUrl: trackUrl,
                      thumbnail: t.coverUrl || entity.coverArt?.sources?.[0]?.url || null,
                    };
                  });

                  return NextResponse.json({
                    platform: "spotify",
                    isPlaylist: true,
                    title: entity.title || entity.name || "Album Spotify",
                    artist: defaultAlbumArtist,
                    thumbnail: entity.coverArt?.sources?.[0]?.url || null,
                    totalTracks: entries.length,
                    entries,
                    url: trimmedUrl,
                    originalUrl: trimmedUrl,
                    mediaType: "audio",
                    hasVideo: false,
                    hasAudio: true,
                    hasImage: false,
                    availableFormats: ["mp3", "flac", "wav", "m4a"],
                  });
                }

                // Single track
                const trackTitle = entity.title || entity.name;
                const artistName = entity.artists ? (Array.isArray(entity.artists) ? entity.artists.map((a: any) => typeof a === "string" ? a : (a.name || "")).join(", ") : entity.artists) : (entity.subtitle || "");

                return NextResponse.json({
                  platform: "spotify",
                  isPlaylist: false,
                  title: trackTitle,
                  artist: artistName || "Artiste Inconnu",
                  duration: Math.floor((entity.duration || 180000) / 1000),
                  thumbnail: entity.coverArt?.sources?.[0]?.url || null,
                  url: trimmedUrl,
                  originalUrl: trimmedUrl,
                  mediaType: "audio",
                  hasVideo: false,
                  hasAudio: true,
                  hasImage: false,
                  availableFormats: ["mp3", "flac", "wav", "m4a", "ogg"],
                });
              }
            }
          }
        }

        // Spotify oEmbed Fallback
        const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trimmedUrl)}`;
        const oEmbedRes = await fetch(oEmbedUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
        if (oEmbedRes.ok) {
          const oEmbedData = await oEmbedRes.json();
          if (oEmbedData.title) {
            return NextResponse.json({
              platform: "spotify",
              isPlaylist: false,
              title: oEmbedData.title,
              artist: oEmbedData.author_name || "Spotify",
              duration: 180,
              thumbnail: oEmbedData.thumbnail_url || null,
              url: trimmedUrl,
              originalUrl: trimmedUrl,
              mediaType: "audio",
              hasVideo: false,
              hasAudio: true,
              hasImage: false,
              availableFormats: ["mp3", "flac", "wav", "m4a", "ogg"],
            });
          }
        }
      } catch (spotErr) {
        console.warn("Spotify embed parsing error:", spotErr);
      }

      return NextResponse.json({
        error: "Impossible de récupérer les informations de ce lien Spotify. Vérifiez que le lien est public."
      }, { status: 400 });
    }

    // --- VIMEO ---
    if (platform === "vimeo") {
      const vimeoData = await fetchVimeoMedia(trimmedUrl);
      if (vimeoData) {
        return NextResponse.json({
          platform: "vimeo",
          isPlaylist: false,
          title: vimeoData.title,
          artist: vimeoData.artist,
          duration: vimeoData.duration,
          thumbnail: vimeoData.thumbnail,
          url: vimeoData.videoUrl || trimmedUrl,
          originalUrl: trimmedUrl,
          mediaType: "video",
          hasVideo: true,
          hasAudio: true,
          hasImage: false,
          availableFormats: ["mp4", "mp3", "wav", "m4a"],
        });
      }
    }

    // --- YOUTUBE, TIKTOK, INSTAGRAM & GENERAL (via yt-dlp) ---
    let stdout = "";
    try {
      stdout = await runYtDlp([
        "--dump-json",
        "--no-warnings",
        "--flat-playlist",
        trimmedUrl
      ]);
    } catch (ytdlpErr: any) {
      // Fallback for YouTube via oEmbed if yt-dlp is blocked
      if (platform === "youtube") {
        const oEmbedData = await fetchYouTubeViaOEmbed(trimmedUrl);
        if (oEmbedData) {
          return NextResponse.json({
            platform: "youtube",
            isPlaylist: false,
            title: oEmbedData.title,
            artist: oEmbedData.artist,
            thumbnail: oEmbedData.thumbnail,
            duration: 0,
            url: trimmedUrl,
            originalUrl: trimmedUrl,
            mediaType: "video",
            hasVideo: true,
            hasAudio: true,
            hasImage: false,
            availableFormats: ["mp4", "mp3", "flac", "wav", "m4a", "ogg"],
          });
        }
      }

      // Fallback for SoundCloud via oEmbed
      if (platform === "soundcloud") {
        const scData = await fetchSoundCloudViaOEmbed(trimmedUrl);
        if (scData) {
          return NextResponse.json({
            platform: "soundcloud",
            isPlaylist: false,
            title: scData.title,
            artist: scData.artist,
            thumbnail: scData.thumbnail,
            duration: 0,
            url: trimmedUrl,
            originalUrl: trimmedUrl,
            mediaType: "audio",
            hasVideo: false,
            hasAudio: true,
            hasImage: false,
            availableFormats: ["mp3", "flac", "wav", "m4a", "ogg"],
          });
        }
      }

      // Error handling for Instagram & TikTok bot-walls
      if (platform === "instagram") {
        return NextResponse.json({
          error: "Instagram bloque l'accès public non authentifié sur ce serveur d'hébergement. Veuillez configurer vos cookies dans le panneau d'Administration (/admin > Cookies Anti-Bot) pour débloquer Instagram (Reels, Posts et Carrousels)."
        }, { status: 403 });
      }

      if (platform === "tiktok") {
        return NextResponse.json({
          error: "TikTok a bloqué la requête sur ce lien. Veuillez vérifier l'URL ou configurer vos cookies dans le panneau d'Administration (/admin > Cookies Anti-Bot)."
        }, { status: 403 });
      }

      throw ytdlpErr;
    }

    let info: any;
    try {
      info = JSON.parse(stdout);
    } catch {
      const lines = stdout.split("\n").map(l => l.trim()).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          info = JSON.parse(lines[i]);
          break;
        } catch {}
      }
      if (!info) {
        throw new Error("Impossible d'extraire les métadonnées vidéo.");
      }
    }

    // Playlist detection
    if (info._type === "playlist" || (info.entries && Array.isArray(info.entries))) {
      const entries = (info.entries || []).map((entry: any, index: number) => ({
        index: index + 1,
        id: entry.id || `entry_${index + 1}`,
        title: entry.title || (platform === "instagram" ? `Élément ${index + 1}` : `Piste ${index + 1}`),
        artist: entry.uploader || entry.artist || info.title || "Instagram",
        duration: entry.duration || 0,
        url: entry.url || entry.webpage_url || trimmedUrl,
        thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || null,
        mediaType: (entry.ext === "mp4" || entry.vcodec) ? "video" : "image"
      }));

      return NextResponse.json({
        platform,
        isPlaylist: true,
        title: info.title || (platform === "instagram" ? "Carrousel Instagram" : "Playlist"),
        artist: info.uploader || "Auteur",
        thumbnail: info.thumbnails?.[0]?.url || entries[0]?.thumbnail || null,
        totalTracks: entries.length,
        entries,
        url: trimmedUrl,
        originalUrl: trimmedUrl,
        mediaType: "mixed",
        hasVideo: true,
        hasAudio: true,
        hasImage: true,
        availableFormats: (platform === "instagram" || platform === "twitter")
          ? ["mp4", "png", "jpg", "mp3"]
          : ["mp4", "mp3", "flac", "wav", "m4a"],
      });
    }

    // Single item
    const hasVideo = info.vcodec && info.vcodec !== "none";
    const hasAudio = (info.acodec && info.acodec !== "none") || (info.formats && info.formats.some((f: any) => f.acodec !== "none"));
    const availableFormats: string[] = [];

    if (hasVideo) availableFormats.push("mp4");
    if (hasAudio) availableFormats.push("mp3", "flac", "wav", "m4a");
    if (hasVideo && (platform === "twitter" || platform === "tiktok" || (info.duration && info.duration <= 60))) {
      availableFormats.push("gif");
    }

    return NextResponse.json({
      platform,
      isPlaylist: false,
      title: info.title || "Titre Inconnu",
      artist: info.uploader || info.artist || info.channel || "Auteur Inconnu",
      duration: info.duration || 0,
      thumbnail: info.thumbnail || null,
      url: info.webpage_url || trimmedUrl,
      originalUrl: trimmedUrl,
      mediaType: hasVideo ? "video" : "audio",
      hasVideo,
      hasAudio,
      hasImage: false,
      availableFormats: availableFormats.length > 0 ? availableFormats : ["mp4", "mp3"],
    });

  } catch (err: any) {
    console.error("Info error:", err);
    return NextResponse.json(
      { error: err.message || "Impossible de récupérer les informations de ce lien." },
      { status: 500 }
    );
  }
}
