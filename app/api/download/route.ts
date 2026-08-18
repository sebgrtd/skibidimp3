import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import NodeID3 from "node-id3";

const PYTHON_PATH = `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe`;
const NODE_PATH = `C:\\Program Files\\nodejs\\node.exe`;

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
      return NextResponse.json({ error: "URL requise." }, { status: 400 });
    }

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const rawPattern = `raw_${uniqueId}`;
    const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);
    const outputAudioPath = path.join(os.tmpdir(), `output_${uniqueId}.${format}`);
    
    tmpFiles.push(outputAudioPath);

    // Step 1: Download raw audio with yt-dlp
    let downloadedRawFile = "";
    await new Promise<void>((resolve, reject) => {
      const args = [
        "-m", "yt_dlp",
        "--js-runtimes", `node:${NODE_PATH}`,
        "--extractor-args", "youtube:player_client=android,web",
        "-f", "ba/b",
        "-x",
        "-o", rawTemplate,
        "--no-playlist",
        url
      ];

      let stderrLog = "";
      let stdoutLog = "";

      const ytProcess = spawn(PYTHON_PATH, args);

      ytProcess.stdout.on("data", (d) => stdoutLog += d.toString());
      ytProcess.stderr.on("data", (d) => stderrLog += d.toString());

      ytProcess.on("close", (code) => {
        // Search temp directory for created file matching rawPattern
        const dirFiles = fs.readdirSync(os.tmpdir());
        const match = dirFiles.find(f => f.startsWith(rawPattern));

        if (match) {
          downloadedRawFile = path.join(os.tmpdir(), match);
          tmpFiles.push(downloadedRawFile);
          resolve();
        } else {
          console.error("yt-dlp stderr:", stderrLog);
          console.error("yt-dlp stdout:", stdoutLog);
          reject(new Error(`yt-dlp a échoué (code ${code}): ${stderrLog || stdoutLog || "Fichier introuvable"}`));
        }
      });

      ytProcess.on("error", (err) => reject(err));
    });

    // Step 2: Process audio with ffmpeg
    const ffmpegArgs: string[] = ["-y"];

    if (startTime && Number(startTime) > 0) {
      ffmpegArgs.push("-ss", String(startTime));
    }

    if (endTime && Number(endTime) > 0) {
      ffmpegArgs.push("-to", String(endTime));
    }

    ffmpegArgs.push("-i", downloadedRawFile);

    const filters: string[] = [];
    const volNum = parseFloat(volumeBoost);
    if (!isNaN(volNum) && volNum !== 1.0) {
      filters.push(`volume=${volNum}`);
    }
    if (normalize) {
      filters.push("dynaudnorm=f=150:g=15");
    }

    if (filters.length > 0) {
      ffmpegArgs.push("-af", filters.join(","));
    }

    if (format === "mp3") {
      ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", bitrate);
    } else if (format === "flac") {
      ffmpegArgs.push("-c:a", "flac");
    } else if (format === "wav") {
      ffmpegArgs.push("-c:a", "pcm_s16le");
    } else if (format === "m4a" || format === "aac") {
      ffmpegArgs.push("-c:a", "aac", "-b:a", bitrate);
    } else if (format === "ogg") {
      ffmpegArgs.push("-c:a", "libvorbis", "-b:a", bitrate);
    } else {
      ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", "320k");
    }

    if (metadata.title) ffmpegArgs.push("-metadata", `title=${metadata.title}`);
    if (metadata.artist) ffmpegArgs.push("-metadata", `artist=${metadata.artist}`);
    if (metadata.album) ffmpegArgs.push("-metadata", `album=${metadata.album}`);
    if (metadata.year) ffmpegArgs.push("-metadata", `date=${metadata.year}`);
    if (metadata.genre) ffmpegArgs.push("-metadata", `genre=${metadata.genre}`);

    ffmpegArgs.push(outputAudioPath);

    await new Promise<void>((resolve, reject) => {
      let ffErr = "";
      const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);
      
      ffmpegProcess.stderr.on("data", (d) => ffErr += d.toString());

      ffmpegProcess.on("close", (code) => {
        if (code === 0 && fs.existsSync(outputAudioPath)) {
          resolve();
        } else {
          console.error("FFmpeg error log:", ffErr);
          reject(new Error(`ffmpeg a échoué (code ${code}): ${ffErr}`));
        }
      });
      ffmpegProcess.on("error", (err) => reject(err));
    });

    // Step 3: Inject ID3 Cover Art & Metadata if MP3
    if (format === "mp3" && (metadata.coverUrl || metadata.title)) {
      try {
        const tags: NodeID3.Tags = {
          title: metadata.title || undefined,
          artist: metadata.artist || undefined,
          album: metadata.album || undefined,
          year: metadata.year || undefined,
          genre: metadata.genre || undefined,
        };

        if (metadata.coverUrl) {
          const imageRes = await fetch(metadata.coverUrl);
          if (imageRes.ok) {
            const arrayBuffer = await imageRes.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            tags.image = {
              mime: "image/jpeg",
              type: { id: 3, name: "front cover" },
              description: "Cover Art",
              imageBuffer: imageBuffer,
            };
          }
        }

        NodeID3.write(tags, outputAudioPath);
      } catch (id3Err) {
        console.warn("Avertissement injection ID3 tags:", id3Err);
      }
    }

    // Step 4: Stream file response
    const fileStat = fs.statSync(outputAudioPath);
    const fileStream = fs.createReadStream(outputAudioPath);

    const cleanTitle = (metadata.title || "audio_download").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
    const cleanArtist = (metadata.artist || "").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
    const filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set("Content-Type", format === "mp3" ? "audio/mpeg" : `audio/${format}`);
    headers.set("Content-Length", String(fileStat.size));

    fileStream.on("end", () => {
      tmpFiles.forEach(f => {
        if (fs.existsSync(f)) {
          try { fs.unlinkSync(f); } catch {}
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
    console.error("Erreur Téléchargement API:", error);
    tmpFiles.forEach(f => {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    });
    return NextResponse.json(
      { error: error.message || "Erreur lors du traitement et téléchargement audio." },
      { status: 500 }
    );
  }
}
