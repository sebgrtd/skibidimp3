import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";

const PYTHON_PATH = `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe`;
const NODE_PATH = `C:\\Program Files\\nodejs\\node.exe`;

export async function POST(req: NextRequest) {
  const tmpFiles: string[] = [];

  try {
    const body = await req.json();
    const {
      tracks = [],
      format = "mp3",
      bitrate = "320k",
      volumeBoost = "1.0",
      normalize = false,
      zipName = "playlist_boosted.zip",
    } = body;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: "Aucune piste sélectionnée pour le ZIP." }, { status: 400 });
    }

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const zipPath = path.join(os.tmpdir(), `bundle_${uniqueId}.zip`);
    tmpFiles.push(zipPath);

    const archive = archiver("zip", { zlib: { level: 6 } });
    const outputZipStream = fs.createWriteStream(zipPath);
    archive.pipe(outputZipStream);

    const tracksToProcess = tracks.slice(0, 20);

    for (let i = 0; i < tracksToProcess.length; i++) {
      const track = tracksToProcess[i];
      const trackId = `${uniqueId}_${i}`;
      const rawPattern = `raw_${trackId}`;
      const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);
      const outPath = path.join(os.tmpdir(), `out_${trackId}.${format}`);
      tmpFiles.push(outPath);

      try {
        let downloadedRaw = "";
        await new Promise<void>((resolve, reject) => {
          const args = [
            "-m", "yt_dlp",
            "--js-runtimes", `node:${NODE_PATH}`,
            "--extractor-args", "youtube:player_client=android,web",
            "-f", "ba/b",
            "-x",
            "-o", rawTemplate,
            "--no-playlist",
            track.url
          ];
          const proc = spawn(PYTHON_PATH, args);

          proc.on("close", (code) => {
            const dirFiles = fs.readdirSync(os.tmpdir());
            const match = dirFiles.find(f => f.startsWith(rawPattern));

            if (match) {
              downloadedRaw = path.join(os.tmpdir(), match);
              tmpFiles.push(downloadedRaw);
              resolve();
            } else {
              reject(new Error(`yt-dlp error track ${i}`));
            }
          });
          proc.on("error", (err) => reject(err));
        });

        const ffmpegArgs: string[] = ["-y", "-i", downloadedRaw];
        const filters: string[] = [];
        const volNum = parseFloat(volumeBoost);
        if (!isNaN(volNum) && volNum !== 1.0) filters.push(`volume=${volNum}`);
        if (normalize) filters.push("dynaudnorm=f=150:g=15");
        if (filters.length > 0) ffmpegArgs.push("-af", filters.join(","));

        if (format === "mp3") ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", bitrate);
        else if (format === "flac") ffmpegArgs.push("-c:a", "flac");
        else if (format === "wav") ffmpegArgs.push("-c:a", "pcm_s16le");
        else ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", "320k");

        if (track.title) ffmpegArgs.push("-metadata", `title=${track.title}`);
        if (track.artist) ffmpegArgs.push("-metadata", `artist=${track.artist}`);

        ffmpegArgs.push(outPath);

        await new Promise<void>((resolve, reject) => {
          const ffProc = spawn("ffmpeg", ffmpegArgs);
          ffProc.on("close", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg error")));
          ffProc.on("error", (err) => reject(err));
        });

        if (fs.existsSync(outPath)) {
          const cleanTitle = (track.title || `Piste_${i + 1}`).replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
          const cleanArtist = (track.artist || "").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
          const filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
          archive.file(outPath, { name: filename });
        }
      } catch (trackErr) {
        console.error(`Erreur piste ${track.title}:`, trackErr);
      }
    }

    await archive.finalize();

    await new Promise<void>((resolve) => {
      outputZipStream.on("close", () => resolve());
    });

    const fileStat = fs.statSync(zipPath);
    const fileStream = fs.createReadStream(zipPath);

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(zipName)}"`);
    headers.set("Content-Type", "application/zip");
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
    console.error("Erreur API Batch ZIP:", error);
    tmpFiles.forEach(f => {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    });
    return NextResponse.json(
      { error: error.message || "Erreur lors de la création de l'archive ZIP." },
      { status: 500 }
    );
  }
}
