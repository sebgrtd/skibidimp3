import { NextRequest, NextResponse } from "next/server";
import { getUserByToken, getUserDownloadHistory } from "@/lib/db";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";

const PYTHON_PATH = `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe`;
const NODE_PATH = `C:\\Program Files\\nodejs\\node.exe`;

export async function POST(req: NextRequest) {
  const token = req.cookies.get("skibidi_session")?.value || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const user = getUserByToken(token);
  if (!user) {
    return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  }

  const tmpFiles: string[] = [];

  try {
    const body = await req.json();
    const { trackIds = [], downloadAll = false } = body;

    const userHistory = getUserDownloadHistory(user.id);
    let tracksToProcess = userHistory;

    if (!downloadAll && Array.isArray(trackIds) && trackIds.length > 0) {
      tracksToProcess = userHistory.filter((t) => trackIds.includes(t.id));
    }

    if (tracksToProcess.length === 0) {
      return NextResponse.json({ error: "Aucune musique sélectionnée pour le re-téléchargement." }, { status: 400 });
    }

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const zipPath = path.join(os.tmpdir(), `history_${uniqueId}.zip`);
    tmpFiles.push(zipPath);

    const archive = archiver("zip", { zlib: { level: 6 } });
    const outputZipStream = fs.createWriteStream(zipPath);
    archive.pipe(outputZipStream);

    // Limit to 20 tracks max per batch ZIP download
    const batch = tracksToProcess.slice(0, 20);

    for (let i = 0; i < batch.length; i++) {
      const track = batch[i];
      const trackId = `${uniqueId}_${i}`;
      const rawPattern = `raw_${trackId}`;
      const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);
      const format = track.format || "mp3";
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
        if (format === "mp3") ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", track.bitrate || "320k");
        else if (format === "flac") ffmpegArgs.push("-c:a", "flac");
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
          const cleanTitle = (track.title || `Musique_${i + 1}`).replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
          const cleanArtist = (track.artist || "").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
          const filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
          archive.file(outPath, { name: filename });
        }
      } catch (trackErr) {
        console.error(`Erreur re-téléchargement piste ${track.title}:`, trackErr);
      }
    }

    await archive.finalize();

    await new Promise<void>((resolve) => {
      outputZipStream.on("close", () => resolve());
    });

    const fileStat = fs.statSync(zipPath);
    const fileStream = fs.createReadStream(zipPath);

    const headers = new Headers();
    const zipFilename = `SuperSkibidi_Historique_${user.username}_320kbps.zip`;
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(zipFilename)}"`);
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
    console.error("Erreur API Batch Re-download:", error);
    tmpFiles.forEach(f => {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    });
    return NextResponse.json(
      { error: error.message || "Erreur lors de la préparation de votre archive d'historique." },
      { status: 500 }
    );
  }
}
