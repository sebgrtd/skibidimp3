import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import NodeID3 from "node-id3";

const PYTHON_PATH = process.env.PYTHON_PATH || (process.platform === "win32" ? `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe` : "python3");

// Helper to detect YouTube bot-block
function isYouTubeBlockedError(msg: string): boolean {
  return msg.includes("Sign in to confirm") ||
    msg.includes("not a bot") ||
    msg.includes("confirm your age") ||
    msg.includes("Skipping unsupported client");
}

const COOKIES_FILE = path.join(process.cwd(), ".data", "cookies.txt");
const ALT_COOKIES = path.join(process.cwd(), "cookies.txt");

// Single attempt audio/video download with yt-dlp
async function singleAttemptDownload(
  ytDlpCommand: string,
  ytDlpBaseArgs: string[],
  target: string,
  rawTemplate: string,
  extraFlags: string[],
  userAgent: string,
  isVideo: boolean = false
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const formatArg = isVideo ? ["-f", "bv*+ba/b", "--merge-output-format", "mp4"] : ["-f", "ba/b", "-x"];
    const cookieArgs: string[] = [];
    if (fs.existsSync(COOKIES_FILE)) {
      cookieArgs.push("--cookies", COOKIES_FILE);
    } else if (fs.existsSync(ALT_COOKIES)) {
      cookieArgs.push("--cookies", ALT_COOKIES);
    }

    const args = [
      ...ytDlpBaseArgs,
      ...cookieArgs,
      "--user-agent", userAgent,
      ...formatArg,
      "-o", rawTemplate,
      "--no-playlist",
      ...extraFlags,
      target,
    ];

    const proc = spawn(ytDlpCommand, args);
    let stderr = "";

    proc.stderr.on("data", (chunk) => stderr += chunk.toString());

    proc.on("close", () => {
      const dirFiles = fs.readdirSync(os.tmpdir());
      const rawPattern = path.basename(rawTemplate).split(".")[0];
      const match = dirFiles.find(f => f.startsWith(rawPattern) && !f.endsWith(".part") && !f.endsWith(".ytdl"));

      if (match) {
        resolve(path.join(os.tmpdir(), match));
      } else {
        dirFiles.filter(f => f.startsWith(rawPattern)).forEach(f => {
          try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {}
        });
        reject(new Error(stderr.trim() || "yt-dlp download failed"));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

async function extractMediaStream(downloadUrl: string, rawTemplateBase: string, isVideo: boolean = false): Promise<string> {
  const isModule = PYTHON_PATH.includes("python");
  const ytDlpCommand = isModule ? PYTHON_PATH : "yt-dlp";
  const ytDlpBaseArgs = isModule ? ["-m", "yt_dlp"] : [];
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

  const baseDir = path.dirname(rawTemplateBase);
  const baseName = path.basename(rawTemplateBase).replace(".%(ext)s", "");

  const attempt = async (suffix: string, flags: string[]) => {
    const tpl = path.join(baseDir, `${baseName}_${suffix}.%(ext)s`);
    return singleAttemptDownload(ytDlpCommand, ytDlpBaseArgs, downloadUrl, tpl, flags, USER_AGENT, isVideo);
  };

  // Attempt 1: android,web,tv
  try {
    return await attempt("a1", ["--extractor-args", "youtube:player_client=android,web,tv"]);
  } catch (err1: any) {
    const msg1 = err1.message || "";

    if (isYouTubeBlockedError(msg1)) throw err1;

    // Attempt 2: tv_embedded
    try {
      return await attempt("a2", ["--extractor-args", "youtube:player_client=tv_embedded,android,web"]);
    } catch (err2: any) {
      const msg2 = err2.message || "";
      if (isYouTubeBlockedError(msg2)) throw err2;

      // Attempt 3: mweb
      try {
        return await attempt("a3", ["--extractor-args", "youtube:player_client=mweb,tv_embedded"]);
      } catch (err3: any) {
        throw err3;
      }
    }
  }
}

function cleanYouTubeMediaUrl(rawUrl: string): string {
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

async function fetchYouTubeMetadataFallback(url: string) {
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oEmbedUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || null,
        artist: data.author_name || null,
        coverUrl: data.thumbnail_url || null,
      };
    }
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  const tmpFiles: string[] = [];

  try {
    const body = await req.json();
    const {
      url,
      format = "mp3",
      bitrate = "320k",
      startTime,
      endTime,
      volumeBoost = "1.0",
      normalize = false,
      editTitle,
      editArtist,
      thumbnail,
      boost,
    } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL invalide ou manquante." }, { status: 400 });
    }

    const trimmedUrl = cleanYouTubeMediaUrl(url.trim());
    const lowerFormat = format.toLowerCase();
    const isVideoDownload = lowerFormat === "mp4";
    const isGifDownload = lowerFormat === "gif";
    const isImageDownload = lowerFormat === "png" || lowerFormat === "jpg" || lowerFormat === "jpeg";

    const rawMeta = body.metadata || {};

    // Consolidate metadata from nested or top-level properties
    let finalTitle = (rawMeta.title || editTitle || "").trim();
    let finalArtist = (rawMeta.artist || editArtist || "").trim();
    let finalCoverUrl = (rawMeta.coverUrl || thumbnail || "").trim();

    // If metadata is incomplete for YouTube, fetch fallback from oEmbed
    if ((!finalTitle || finalTitle.toLowerCase() === "audio" || !finalCoverUrl) && (trimmedUrl.includes("youtube.com") || trimmedUrl.includes("youtu.be"))) {
      const fb = await fetchYouTubeMetadataFallback(trimmedUrl);
      if (fb) {
        if (!finalTitle || finalTitle.toLowerCase() === "audio") finalTitle = fb.title || finalTitle;
        if (!finalArtist) finalArtist = fb.artist || finalArtist;
        if (!finalCoverUrl) finalCoverUrl = fb.coverUrl || finalCoverUrl;
      }
    }

    // Clean artist suffix if any
    if (finalArtist) {
      finalArtist = finalArtist.replace(/ - Topic$/, "").replace(/VEVO$/, "").trim();
    }
    if (finalArtist && finalTitle.toLowerCase().startsWith(finalArtist.toLowerCase() + " - ")) {
      finalTitle = finalTitle.substring(finalArtist.length + 3).trim();
    }

    metadata = {
      ...metadata,
      title: finalTitle || "Audio",
      artist: finalArtist || "",
      coverUrl: finalCoverUrl,
    };

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const outPath = path.join(os.tmpdir(), `out_${uniqueId}.${lowerFormat}`);
    tmpFiles.push(outPath);

    // ==========================================
    // 1. IMAGE DOWNLOAD (PNG / JPG)
    // ==========================================
    if (isImageDownload) {
      const imageUrl = metadata.coverUrl || trimmedUrl;
      const imgRes = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });

      if (!imgRes.ok) {
        throw new Error("Impossible de récupérer l'image source.");
      }

      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(outPath, imgBuffer);

      const fileStat = fs.statSync(outPath);
      const fileStream = fs.createReadStream(outPath);

      const cleanTitle = (metadata.title || "image").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
      const fileName = `${cleanTitle}.${lowerFormat === "jpeg" ? "jpg" : lowerFormat}`;

      const headers = new Headers();
      headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      headers.set("Content-Type", lowerFormat === "png" ? "image/png" : "image/jpeg");
      headers.set("Content-Length", String(fileStat.size));

      fileStream.on("end", () => {
        tmpFiles.forEach((file) => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch {}
          }
        });
      });

      return new NextResponse(fileStream as any, { headers });
    }

    // ==========================================
    // 2. VIDEO DOWNLOAD (MP4) OR GIF ANIMATION
    // ==========================================
    if (isVideoDownload || isGifDownload) {
      const rawPattern = `raw_vid_${uniqueId}`;
      const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);

      let downloadedRaw = "";
      // If direct video url or HLS stream passed (e.g. from Vimeo / Twitter / Pinterest)
      if (trimmedUrl.startsWith("http") && (trimmedUrl.includes("vimeocdn.com") || trimmedUrl.includes(".m3u8"))) {
        downloadedRaw = trimmedUrl;
      } else if (trimmedUrl.startsWith("http") && (trimmedUrl.includes(".mp4") || trimmedUrl.includes("video.twimg.com") || trimmedUrl.includes("v.pinimg.com"))) {
        const vidRes = await fetch(trimmedUrl);
        if (!vidRes.ok) throw new Error("Impossible de télécharger le flux vidéo direct.");
        const directPath = path.join(os.tmpdir(), `${rawPattern}.mp4`);
        fs.writeFileSync(directPath, Buffer.from(await vidRes.arrayBuffer()));
        downloadedRaw = directPath;
        tmpFiles.push(downloadedRaw);
      } else {
        downloadedRaw = await extractMediaStream(trimmedUrl, rawTemplate, true);
        tmpFiles.push(downloadedRaw);
      }

      // FFmpeg processing for Video / GIF
      const ffmpegArgs: string[] = ["-y"];
      if (downloadedRaw.startsWith("http")) {
        ffmpegArgs.push("-headers", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nReferer: https://vimeo.com/\r\n");
      }

      if (startTime && !isNaN(Number(startTime)) && Number(startTime) > 0) {
        ffmpegArgs.push("-ss", String(startTime));
      }

      ffmpegArgs.push("-i", downloadedRaw);

      if (endTime && !isNaN(Number(endTime)) && Number(endTime) > 0) {
        ffmpegArgs.push("-to", String(endTime));
      }

      if (isGifDownload) {
        // High quality palette-based GIF conversion
        ffmpegArgs.push(
          "-vf", "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
          "-loop", "0",
          outPath
        );
      } else {
        // Universal MP4 H.264 / AAC conversion with faststart for instant streaming
        ffmpegArgs.push(
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "23",
          "-c:a", "aac",
          "-b:a", "192k",
          "-movflags", "+faststart",
          outPath
        );
      }

      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", ffmpegArgs);
        let stderr = "";
        proc.stderr.on("data", (chunk) => stderr += chunk.toString());
        proc.on("close", (code) => {
          if (code === 0 && fs.existsSync(outPath)) resolve();
          else reject(new Error(`Erreur conversion vidéo FFmpeg: ${stderr || `code ${code}`}`));
        });
        proc.on("error", (err) => reject(err));
      });

      const fileStat = fs.statSync(outPath);
      const fileStream = fs.createReadStream(outPath);

      const cleanTitle = (metadata.title || "video").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
      const cleanArtist = (metadata.artist || "").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
      const fileName = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${lowerFormat}` : `${cleanTitle}.${lowerFormat}`;

      const headers = new Headers();
      headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      headers.set("Content-Type", isGifDownload ? "image/gif" : "video/mp4");
      headers.set("Content-Length", String(fileStat.size));

      fileStream.on("end", () => {
        tmpFiles.forEach((file) => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch {}
          }
        });
      });

      return new NextResponse(fileStream as any, { headers });
    }

    // ==========================================
    // 3. AUDIO DOWNLOAD (MP3, FLAC, WAV, M4A, OGG)
    // ==========================================
    let downloadTargetUrl = trimmedUrl;

    if (trimmedUrl.includes("spotify.com") || trimmedUrl.includes("open.spotify.com") || trimmedUrl.includes("results?search_query=")) {
      let searchTerms = [metadata.artist, metadata.title].filter(Boolean).join(" ");
      
      // If metadata is not populated, fetch title and artist via Spotify oEmbed
      if (!searchTerms.trim() && trimmedUrl.includes("spotify.com")) {
        try {
          const spRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trimmedUrl)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
          });
          if (spRes.ok) {
            const spData = await spRes.json();
            if (spData.title) {
              searchTerms = spData.author_name ? `${spData.author_name} ${spData.title}` : spData.title;
            }
          }
        } catch {}
      }

      if (searchTerms.trim()) {
        downloadTargetUrl = `scsearch5:${searchTerms}`;
      } else {
        const queryMatch = trimmedUrl.match(/search_query=([^&]+)/);
        if (queryMatch) {
          downloadTargetUrl = `scsearch5:${decodeURIComponent(queryMatch[1].replace(/\+/g, " "))}`;
        } else {
          throw new Error("Impossible de trouver les informations audio de ce titre Spotify.");
        }
      }
    }

    const rawPattern = `raw_aud_${uniqueId}`;
    const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);

    let downloadedRaw = "";
    if (trimmedUrl.startsWith("http") && (trimmedUrl.includes("vimeocdn.com") || trimmedUrl.includes(".m3u8"))) {
      downloadedRaw = trimmedUrl;
    } else {
      try {
        downloadedRaw = await extractMediaStream(downloadTargetUrl, rawTemplate, false);
        tmpFiles.push(downloadedRaw);
      } catch (extractErr: any) {
        const searchTitle = metadata.title || "music";
        const searchArtist = metadata.artist || "";
        const searchTerms = `${searchArtist} ${searchTitle}`.trim();

        console.log("Tentative de secours audio via SoundCloud scsearch5:", searchTerms);
        try {
          downloadedRaw = await extractMediaStream(`scsearch5:${searchTerms}`, rawTemplate, false);
          tmpFiles.push(downloadedRaw);
        } catch (scErr: any) {
          throw extractErr;
        }
      }
    }

    // FFmpeg Audio Processing
    const ffmpegArgs: string[] = ["-y"];
    if (downloadedRaw.startsWith("http")) {
      ffmpegArgs.push("-headers", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nReferer: https://vimeo.com/\r\n");
    }

    if (startTime && !isNaN(Number(startTime)) && Number(startTime) > 0) {
      ffmpegArgs.push("-ss", String(startTime));
    }

    ffmpegArgs.push("-i", downloadedRaw);

    if (endTime && !isNaN(Number(endTime)) && Number(endTime) > 0) {
      ffmpegArgs.push("-to", String(endTime));
    }

    const afFilters: string[] = [];

    if (volumeBoost && volumeBoost !== "1.0" && !isNaN(Number(volumeBoost))) {
      afFilters.push(`volume=${volumeBoost}`);
    }
    if (normalize) {
      afFilters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    if (afFilters.length > 0) {
      ffmpegArgs.push("-af", afFilters.join(","));
    }

    switch (lowerFormat) {
      case "flac":
        ffmpegArgs.push("-c:a", "flac");
        break;
      case "wav":
        ffmpegArgs.push("-c:a", "pcm_s16le");
        break;
      case "m4a":
        ffmpegArgs.push("-c:a", "aac", "-b:a", bitrate);
        break;
      case "ogg":
        ffmpegArgs.push("-c:a", "libvorbis", "-b:a", bitrate);
        break;
      case "mp3":
      default:
        ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", bitrate);
        break;
    }

    if (metadata.title) ffmpegArgs.push("-metadata", `title=${metadata.title}`);
    if (metadata.artist) ffmpegArgs.push("-metadata", `artist=${metadata.artist}`);
    if (metadata.album) ffmpegArgs.push("-metadata", `album=${metadata.album}`);
    if (metadata.year) ffmpegArgs.push("-metadata", `date=${metadata.year}`);
    if (metadata.genre) ffmpegArgs.push("-metadata", `genre=${metadata.genre}`);

    ffmpegArgs.push(outPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", ffmpegArgs);
      let stderr = "";
      proc.stderr.on("data", (chunk) => stderr += chunk.toString());
      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(outPath)) resolve();
        else reject(new Error(`Erreur conversion audio FFmpeg: ${stderr || `code ${code}`}`));
      });
      proc.on("error", (err) => reject(err));
    });

    // ID3 Cover Image for MP3
    if (lowerFormat === "mp3" && metadata.coverUrl) {
      try {
        const imgRes = await fetch(metadata.coverUrl);
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const tags: NodeID3.Tags = {
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            year: metadata.year,
            genre: metadata.genre,
            image: {
              mime: "image/jpeg",
              type: { id: 3, name: "front cover" },
              description: "Cover",
              imageBuffer: imgBuffer,
            },
          };
          NodeID3.write(tags, outPath);
        }
      } catch (imgErr) {
        console.error("Erreur insertion pochette ID3:", imgErr);
      }
    }

    const fileStat = fs.statSync(outPath);
    const fileStream = fs.createReadStream(outPath);

    const cleanTitle = (metadata.title || "audio").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
    const cleanArtist = (metadata.artist || "").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
    const fileName = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${lowerFormat}` : `${cleanTitle}.${lowerFormat}`;

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set("Content-Type", `audio/${lowerFormat === "mp3" ? "mpeg" : lowerFormat}`);
    headers.set("Content-Length", String(fileStat.size));

    fileStream.on("end", () => {
      tmpFiles.forEach((file) => {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch {}
        }
      });
    });

    return new NextResponse(fileStream as any, { headers });

  } catch (error: any) {
    console.error("Erreur API /download:", error);
    tmpFiles.forEach((file) => {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch {}
      }
    });

    let errMsg = error.message || "Une erreur est survenue lors de la génération du fichier.";
    if (isYouTubeBlockedError(errMsg)) {
      errMsg = "YouTube bloque les téléchargements automatisés sur ce serveur d'hébergement. Veuillez configurer vos cookies YouTube dans le panneau d'Administration (/admin > Cookies YouTube) pour débloquer le service.";
    }

    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
