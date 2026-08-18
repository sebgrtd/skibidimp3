import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import NodeID3 from "node-id3";

const PYTHON_PATH = process.env.PYTHON_PATH || (process.platform === "win32" ? `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe` : "python3");

// Helper to detect YouTube bot-block / age-restriction errors (fail fast, don't retry)
function isYouTubeBlockedError(msg: string): boolean {
  return msg.includes("Sign in to confirm") ||
    msg.includes("not a bot") ||
    msg.includes("confirm your age") ||
    msg.includes("Skipping unsupported client");
}

async function singleAttemptDownload(
  ytDlpCommand: string,
  ytDlpBaseArgs: string[],
  target: string,
  rawTemplate: string,
  extraFlags: string[],
  userAgent: string
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const args = [
      ...ytDlpBaseArgs,
      "--user-agent", userAgent,
      "-f", "ba/b",
      "-x",
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
      // Only accept completed files (not .part files)
      const match = dirFiles.find(f => f.startsWith(rawPattern) && !f.endsWith(".part"));

      if (match) {
        resolve(path.join(os.tmpdir(), match));
      } else {
        // Clean up any .part files left behind
        dirFiles.filter(f => f.startsWith(rawPattern)).forEach(f => {
          try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch {}
        });
        reject(new Error(stderr.trim() || "yt-dlp failed"));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

async function extractAudioStream(downloadUrl: string, rawTemplateBase: string): Promise<string> {
  const isModule = PYTHON_PATH.includes("python");
  const ytDlpCommand = isModule ? PYTHON_PATH : "yt-dlp";
  const ytDlpBaseArgs = isModule ? ["-m", "yt_dlp"] : [];
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

  // Generate unique template per attempt to avoid partial file contamination
  const baseDir = path.dirname(rawTemplateBase);
  const baseName = path.basename(rawTemplateBase).replace(".%(ext)s", "");

  const attempt = async (suffix: string, flags: string[]) => {
    const tpl = path.join(baseDir, `${baseName}_${suffix}.%(ext)s`);
    return singleAttemptDownload(ytDlpCommand, ytDlpBaseArgs, downloadUrl, tpl, flags, USER_AGENT);
  };

  // Attempt 1: android,web,tv
  try {
    return await attempt("a1", ["--extractor-args", "youtube:player_client=android,web,tv"]);
  } catch (err1: any) {
    const msg1 = err1.message || "";
    console.warn("Download attempt 1 failed:", msg1.split("\n")[0]);

    // Fail fast: don't retry if YouTube is blocking us — let caller use SoundCloud
    if (isYouTubeBlockedError(msg1)) throw err1;

    // Attempt 2: tv_embedded
    try {
      return await attempt("a2", ["--extractor-args", "youtube:player_client=tv_embedded,android,web"]);
    } catch (err2: any) {
      const msg2 = err2.message || "";
      console.warn("Download attempt 2 failed:", msg2.split("\n")[0]);

      if (isYouTubeBlockedError(msg2)) throw err2;

      // Attempt 3: mweb
      try {
        return await attempt("a3", ["--extractor-args", "youtube:player_client=mweb,tv_embedded"]);
      } catch (err3: any) {
        console.warn("Download attempt 3 failed:", err3.message?.split("\n")[0]);
        throw err3;
      }
    }
  }
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
      metadata = {},
    } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL invalide ou manquante." }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    let downloadTargetUrl = trimmedUrl;

    // Handle Spotify links or YouTube search results: Use SoundCloud search to bypass DRM and YouTube bot-blocks
    if (trimmedUrl.includes("spotify.com") || trimmedUrl.includes("open.spotify.com") || trimmedUrl.includes("results?search_query=")) {
      const searchTerms = [metadata.artist, metadata.title].filter(Boolean).join(" ");
      if (searchTerms.trim()) {
        downloadTargetUrl = `scsearch5:${searchTerms}`;
      } else {
        const queryMatch = trimmedUrl.match(/search_query=([^&]+)/);
        if (queryMatch) {
          downloadTargetUrl = `scsearch5:${decodeURIComponent(queryMatch[1].replace(/\+/g, " "))}`;
        } else {
          const trackMatch = trimmedUrl.match(/(?:track|album|playlist)\/([a-zA-Z0-9]+)/);
          if (trackMatch) {
            downloadTargetUrl = `scsearch5:spotify ${trackMatch[1]}`;
          }
        }
      }
    }

    // If the URL is a YouTube URL coming from Spotify info page, also try SoundCloud first
    if (downloadTargetUrl.includes("youtube.com") && metadata.artist && metadata.title) {
      // Keep YouTube URL but will fallback to SoundCloud if it fails
    }

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const rawPattern = `raw_${uniqueId}`;
    const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);
    const outPath = path.join(os.tmpdir(), `out_${uniqueId}.${format}`);
    tmpFiles.push(outPath);

    // 1. Run yt-dlp to extract raw audio stream
    let downloadedRaw = "";
    try {
      downloadedRaw = await extractAudioStream(downloadTargetUrl, rawTemplate);
      tmpFiles.push(downloadedRaw);
    } catch (extractErr: any) {
      const searchTitle = metadata.title || "music";
      const searchArtist = metadata.artist || "";
      const searchTerms = `${searchArtist} ${searchTitle}`.trim();

      // Ultimate fallback: Use SoundCloud scsearch5 which automatically skips DRM previews
      console.log("Tentative de secours ultime via SoundCloud scsearch5:", searchTerms);
      try {
        downloadedRaw = await extractAudioStream(`scsearch5:${searchTerms}`, rawTemplate);
        tmpFiles.push(downloadedRaw);
      } catch (scErr: any) {
        console.error("SoundCloud fallback failed:", scErr.message);
        throw extractErr;
      }
    }

    // 2. FFmpeg processing
    const ffmpegArgs: string[] = ["-y"];

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

    switch (format.toLowerCase()) {
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
        else reject(new Error(`Erreur conversion FFmpeg: ${stderr || `code ${code}`}`));
      });
      proc.on("error", (err) => reject(err));
    });

    // 3. ID3 Cover Image Embedding for MP3
    if (format.toLowerCase() === "mp3" && metadata.coverUrl) {
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
        console.error("Erreur d'insertion de pochette ID3:", imgErr);
      }
    }

    const fileStat = fs.statSync(outPath);
    const fileStream = fs.createReadStream(outPath);

    const headers = new Headers();
    const cleanTitle = (metadata.title || "audio").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
    const cleanArtist = (metadata.artist || "").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
    const fileName = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;

    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set("Content-Type", `audio/${format === "mp3" ? "mpeg" : format}`);
    headers.set("Content-Length", String(fileStat.size));

    fileStream.on("end", () => {
      tmpFiles.forEach((file) => {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch {}
        }
      });
    });

    let isClosed = false;
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => {
          if (!isClosed) {
            try {
              controller.enqueue(chunk);
            } catch {
              isClosed = true;
            }
          }
        });

        fileStream.on("end", () => {
          if (!isClosed) {
            isClosed = true;
            try {
              controller.close();
            } catch {}
          }
        });

        fileStream.on("error", (err) => {
          if (!isClosed) {
            isClosed = true;
            try {
              controller.error(err);
            } catch {}
          }
        });
      },
      cancel() {
        isClosed = true;
        fileStream.destroy();
      },
    });

    return new NextResponse(readableStream, { headers });

  } catch (error: any) {
    console.error("Erreur API /download:", error);
    tmpFiles.forEach((file) => {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch {}
      }
    });

    return NextResponse.json(
      { error: error.message || "Une erreur est survenue lors de la génération de votre fichier audio." },
      { status: 500 }
    );
  }
}
