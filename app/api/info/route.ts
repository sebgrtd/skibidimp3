import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const PYTHON_PATH = process.env.PYTHON_PATH || (process.platform === "win32" ? `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe` : "python3");
const NODE_PATH = process.env.NODE_PATH || (process.platform === "win32" ? `C:\\Program Files\\nodejs\\node.exe` : "node");

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const isModule = PYTHON_PATH.includes("python");
    const fullArgs = isModule ? ["-m", "yt_dlp", ...args] : args;
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

async function fetchInfoWithFallback(trimmedUrl: string): Promise<string> {
  // Attempt 1: Standard with android,web,tv clients
  try {
    return await runYtDlp([
      "--extractor-args", "youtube:player_client=android,web,tv",
      "--flat-playlist",
      "--dump-json",
      "--no-warnings",
      trimmedUrl
    ]);
  } catch (err1: any) {
    console.warn("Info attempt 1 failed:", err1.message?.split("\n")[0]);

    // Attempt 2: tv_embedded client (bypasses some age restrictions)
    try {
      return await runYtDlp([
        "--extractor-args", "youtube:player_client=tv_embedded,android,web",
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        trimmedUrl
      ]);
    } catch (err2: any) {
      console.warn("Info attempt 2 failed:", err2.message?.split("\n")[0]);

      // Attempt 3: mweb fallback
      try {
        return await runYtDlp([
          "--extractor-args", "youtube:player_client=mweb,tv_embedded",
          "--flat-playlist",
          "--dump-json",
          "--no-warnings",
          trimmedUrl
        ]);
      } catch (err3: any) {
        console.warn("Info attempt 3 failed:", err3.message?.split("\n")[0]);
        throw err3;
      }
    }
  }
}

// Fallback for age-restricted or bot-blocked YouTube videos using public oEmbed API
async function fetchYouTubeViaOEmbed(trimmedUrl: string): Promise<{ title: string; artist: string; thumbnail: string | null; videoId: string | null }| null> {
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(trimmedUrl)}&format=json`;
    const res = await fetch(oEmbedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" }
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


export async function POST(req: NextRequest) {
  let trimmedUrl = "";
  let platform: "youtube" | "spotify" | "soundcloud" | "generic" = "generic";

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL invalide ou manquante." }, { status: 400 });
    }

    trimmedUrl = url.trim();

    if (trimmedUrl.includes("youtube.com") || trimmedUrl.includes("youtu.be")) {
      platform = "youtube";
    } else if (trimmedUrl.includes("spotify.com")) {
      platform = "spotify";
    } else if (trimmedUrl.includes("soundcloud.com")) {
      platform = "soundcloud";
    }

    // Handle Spotify links via embed html scraper & yt-dlp search fallback
    if (platform === "spotify") {
      try {
        const match = trimmedUrl.match(/spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/);
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
                  const defaultAlbumArtist = entity.subtitle || (entity.artists ? entity.artists.map((a: any) => a.name).join(", ") : "Spotify");
                  const entries = rawTracks.map((t: any, idx: number) => {
                    const trackId = t.id || (t.uri ? t.uri.split(":").pop() : null) || `track_${idx}`;
                    const trackArtist = t.artists ? t.artists.map((a: any) => a.name).join(", ") : (t.subtitle || defaultAlbumArtist);
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
                  });
                }

                // Single track
                const trackTitle = entity.title || entity.name;
                const artistName = entity.artists?.[0]?.name || entity.subtitle || "";
                const searchQuery = `${artistName} - ${trackTitle} audio`;

                let stdout = "";
                try {
                  stdout = await runYtDlp([
                    "--extractor-args", "youtube:player_client=android,web,tv",
                    "--flat-playlist",
                    "--dump-json",
                    `ytsearch1:${searchQuery}`
                  ]);
                } catch {
                  try {
                    stdout = await runYtDlp([
                      "--extractor-args", "youtube:player_client=tv_embedded,android,web",
                      "--flat-playlist",
                      "--dump-json",
                      `ytsearch1:${searchQuery}`
                    ]);
                  } catch {
                    stdout = await runYtDlp([
                      "--extractor-args", "youtube:player_client=mweb,tv_embedded",
                      "--flat-playlist",
                      "--dump-json",
                      `ytsearch1:${searchQuery}`
                    ]);
                  }
                }

                const ytInfo = JSON.parse(stdout.split("\n")[0]);

                return NextResponse.json({
                  platform: "spotify",
                  isPlaylist: false,
                  id: entity.id,
                  title: trackTitle,
                  artist: artistName,
                  duration: Math.floor((entity.duration || 200000) / 1000),
                  thumbnail: entity.coverArt?.sources?.[0]?.url || ytInfo.thumbnail || null,
                  url: ytInfo.url || (ytInfo.id ? `https://www.youtube.com/watch?v=${ytInfo.id}` : trimmedUrl),
                  originalUrl: trimmedUrl,
                  views: ytInfo.view_count || 0,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Erreur parsing Spotify embed:", err);
      }
    }

    // Handle YouTube / SoundCloud / Generic via yt-dlp with fallback
    const stdout = await fetchInfoWithFallback(trimmedUrl);

    const lines = stdout.trim().split("\n").filter(Boolean);

    if (lines.length > 1) {
      const entries = lines.map((line, idx) => {
        try {
          const item = JSON.parse(line);
          return {
            index: idx + 1,
            id: item.id || item.url,
            title: item.title || `Piste ${idx + 1}`,
            artist: item.uploader || item.artist || "Inconnu",
            duration: item.duration || 0,
            url: item.url ? (item.url.startsWith("http") ? item.url : `https://www.youtube.com/watch?v=${item.id}`) : trimmedUrl,
            thumbnail: item.thumbnails?.[0]?.url || item.thumbnail || null,
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      const firstItem = JSON.parse(lines[0]);

      return NextResponse.json({
        platform,
        isPlaylist: true,
        title: firstItem.playlist_title || firstItem.title || "Playlist",
        artist: firstItem.uploader || firstItem.channel || "Artistes Divers",
        thumbnail: entries[0]?.thumbnail || firstItem.thumbnail || null,
        totalTracks: entries.length,
        entries,
        url: trimmedUrl,
      });
    }

    const info = JSON.parse(lines[0]);

    return NextResponse.json({
      platform,
      isPlaylist: false,
      id: info.id,
      title: info.title || "Audio Sans Titre",
      artist: info.uploader || info.artist || info.channel || "Artiste",
      duration: info.duration || 0,
      thumbnail: info.thumbnail || info.thumbnails?.[info.thumbnails?.length - 1]?.url || null,
      url: info.webpage_url || trimmedUrl,
      views: info.view_count || 0,
      uploadDate: info.upload_date || null,
    });

  } catch (error: any) {
    console.error("Erreur /api/info:", error);

    // For YouTube URLs: try oEmbed as last resort (works for age-restricted videos)
    if (trimmedUrl && (platform === "youtube")) {
      console.log("Trying YouTube oEmbed fallback for:", trimmedUrl);
      const oEmbed = await fetchYouTubeViaOEmbed(trimmedUrl);
      if (oEmbed) {
        console.log("oEmbed fallback success:", oEmbed.title);
        return NextResponse.json({
          platform: "youtube",
          isPlaylist: false,
          id: oEmbed.videoId,
          title: oEmbed.title,
          artist: oEmbed.artist,
          duration: 0,
          thumbnail: oEmbed.thumbnail,
          url: trimmedUrl,
          originalUrl: trimmedUrl,
          views: 0,
          uploadDate: null,
          ageRestricted: true,
        });
      }
    }

    return NextResponse.json(
      { error: "Impossible de récupérer les informations pour ce lien. Assurez-vous que l'URL est publique et valide." },
      { status: 500 }
    );
  }
}
