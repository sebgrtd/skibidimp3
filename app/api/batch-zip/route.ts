import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";

const PYTHON_PATH = process.env.PYTHON_PATH || (process.platform === "win32" ? `C:\\Users\\Sébastien\\AppData\\Local\\Programs\\Python\\Python313\\python.exe` : "python3");
const NODE_PATH = process.env.NODE_PATH || (process.platform === "win32" ? `C:\\Program Files\\nodejs\\node.exe` : "node");

export async function POST(req: NextRequest) {
  const tmpFiles: string[] = [];

  try {
    const body = await req.json();
    const { tracks, format = "mp3", bitrate = "320k", playlistName = "SuperSkibidi_Playlist" } = body;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: "Aucune piste fournie." }, { status: 400 });
    }

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const zipPath = path.join(os.tmpdir(), `playlist_${uniqueId}.zip`);
    tmpFiles.push(zipPath);

    const archive = archiver("zip", { zlib: { level: 6 } });
    const outputZipStream = fs.createWriteStream(zipPath);
    archive.pipe(outputZipStream);

    const isModule = PYTHON_PATH.includes("python");
    const ytDlpCommand = isModule ? PYTHON_PATH : "yt-dlp";
    const ytDlpBaseArgs = isModule ? ["-m", "yt_dlp"] : [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const trackId = `${uniqueId}_${i}`;
      const rawPattern = `raw_${trackId}`;
      const rawTemplate = path.join(os.tmpdir(), `${rawPattern}.%(ext)s`);
      const outPath = path.join(os.tmpdir(), `out_${trackId}.${format}`);
      tmpFiles.push(outPath);

      try {
        let downloadedRaw = "";
        await new Promise<void>((resolve, reject) => {
          const args = [
            ...ytDlpBaseArgs,
            "--js-runtimes", `node:${NODE_PATH}`,
            "--extractor-args", "youtube:player_client=android,web",
            "-f", "ba/b",
            "-x",
            "-o", rawTemplate,
            "--no-playlist",
            track.url,
          ];
          const proc = spawn(ytDlpCommand, args);

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
        if (format === "mp3") ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", bitrate);
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
          const cleanTitle = (track.title || `Piste_${i + 1}`).replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
          const cleanArtist = (track.artist || "").replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim();
          const filename = cleanArtist ? `${cleanArtist} - ${cleanTitle}.${format}` : `${cleanTitle}.${format}`;
          archive.file(outPath, { name: filename });
        }
      } catch (trackErr) {
        console.error(`Erreur piste ${i + 1}:`, trackErr);
      }
    }

    await archive.finalize();

    await new Promise<void>((resolve) => {
      outputZipStream.on("close", () => resolve());
    });

    const fileStat = fs.statSync(zipPath);
    const fileStream = fs.createReadStream(zipPath);

    const headers = new Headers();
    const cleanZipName = playlistName.replace(/[^a-zA-Z0-9_\-\. ]/g, "").trim() || "Playlist";
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(cleanZipName)}.zip"`);
    headers.set("Content-Type", "application/zip");
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
    console.error("Erreur API Batch ZIP:", error);
    tmpFiles.forEach((file) => {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch {}
      }
    });

    return NextResponse.json(
      { error: error.message || "Erreur lors de la génération de la playlist ZIP." },
      { status: 500 }
    );
  }
}
