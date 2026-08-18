import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const PYTHON_PATH = `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe`;
const NODE_PATH = `C:\\Program Files\\nodejs\\node.exe`;

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, args);
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

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL invalide ou manquante." }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    let platform: "youtube" | "spotify" | "soundcloud" | "generic" = "generic";

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
                  const entries = rawTracks.map((t: any, idx: number) => ({
                    index: idx + 1,
                    id: t.id || `track_${idx}`,
                    title: t.title || t.name,
                    artist: t.artists ? t.artists.map((a: any) => a.name).join(", ") : (entity.subtitle || "Spotify"),
                    duration: Math.floor((t.duration || 180000) / 1000),
                    url: `https://www.youtube.com/results?search_query=${encodeURIComponent((t.artists?.[0]?.name || "") + " " + (t.title || t.name) + " audio")}`,
                    thumbnail: t.coverUrl || entity.coverArt?.sources?.[0]?.url || null,
                  }));

                  return NextResponse.json({
                    platform: "spotify",
                    isPlaylist: true,
                    title: entity.title || entity.name || "Playlist Spotify",
                    artist: entity.subtitle || "Spotify",
                    thumbnail: entity.coverArt?.sources?.[0]?.url || null,
                    totalTracks: entries.length,
                    entries,
                    url: trimmedUrl,
                  });
                }

                // Single track
                const trackTitle = entity.title || entity.name;
                const artistName = entity.artists?.[0]?.name || entity.subtitle || "";
                const searchQuery = `${artistName} - ${trackTitle} audio`;

                const stdout = await runYtDlp([
                  "-m", "yt_dlp",
                  "--js-runtimes", `node:${NODE_PATH}`,
                  "--extractor-args", "youtube:player_client=android,web",
                  "--flat-playlist",
                  "--dump-json",
                  `ytsearch1:${searchQuery}`
                ]);

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

    // Handle YouTube / SoundCloud / Generic via yt-dlp
    const stdout = await runYtDlp([
      "-m", "yt_dlp",
      "--js-runtimes", `node:${NODE_PATH}`,
      "--extractor-args", "youtube:player_client=android,web",
      "--flat-playlist",
      "--dump-json",
      "--no-warnings",
      trimmedUrl
    ]);

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
    return NextResponse.json(
      { error: "Impossible de récupérer les informations pour ce lien. Assurez-vous que l'URL est publique et valide." },
      { status: 500 }
    );
  }
}
