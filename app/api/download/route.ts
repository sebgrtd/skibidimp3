import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import NodeID3 from "node-id3";

const PYTHON_PATH = process.env.PYTHON_PATH || (process.platform === "win32" ? `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe` : "python3");
const NODE_PATH = process.env.NODE_PATH || (process.platform === "win32" ? `C:\\Program Files\\nodejs\\node.exe` : "node");

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

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const rawPattern = `raw_${uniqueId}`;
    const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);
    const outPath = path.join(os.tmpdir(), `out_${uniqueId}.${format}`);
    tmpFiles.push(outPath);

    // 1. Run yt-dlp to extract raw audio stream
    const isModule = PYTHON_PATH.includes("python");
    const ytDlpCommand = isModule ? PYTHON_PATH : "yt-dlp";
    const ytDlpBaseArgs = isModule ? ["-m", "yt_dlp"] : [];

    const ytDlpArgs = [
      ...ytDlpBaseArgs,
      "--js-runtimes", `node:${NODE_PATH}`,
      "--extractor-args", "youtube:player_client=android,web",
      "-f", "ba/b",
      "-x",
      "-o", rawTemplate,
      "--no-playlist",
      url.trim(),
    ];

    let downloadedRaw = "";
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ytDlpCommand, ytDlpArgs);
      let stderr = "";

      proc.stderr.on("data", (chunk) => stderr += chunk.toString());

      proc.on("close", (code) => {
        const dirFiles = fs.readdirSync(os.tmpdir());
        const match = dirFiles.find(f => f.startsWith(rawPattern));

        if (match) {
          downloadedRaw = path.join(os.tmpdir(), match);
          tmpFiles.push(downloadedRaw);
          resolve();
        } else {
          reject(new Error(`Erreur d'extraction d'origine: ${stderr || `code ${code}`}`));
        }
      });

      proc.on("error", (err) => reject(err));
    });

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

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
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
