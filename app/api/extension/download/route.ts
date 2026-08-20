import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";

export async function GET(req: NextRequest) {
  const extensionDir = path.join(process.cwd(), "chrome-extension");

  if (!fs.existsSync(extensionDir)) {
    return NextResponse.json({ error: "Dossier extension introuvable." }, { status: 404 });
  }

  // Detect current server origin (e.g. https://alexandre-pruvost.fr or http://localhost:3030)
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3030";
  const currentOrigin = `${proto}://${host}`;

  const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const zipPath = path.join(os.tmpdir(), `skibidimp3_extension_${uniqueId}.zip`);

  try {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const outputZipStream = fs.createWriteStream(zipPath);
    archive.pipe(outputZipStream);

    // Recursively add files with dynamic server URL substitution for background.js & popup.js
    function addDirectory(dir: string, baseInZip: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const zipEntryPath = baseInZip ? `${baseInZip}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          addDirectory(fullPath, zipEntryPath);
        } else {
          // If JS script containing DEFAULT_SERVER_URL, dynamically inject current host
          if (entry.name === "background.js" || entry.name === "popup.js") {
            let content = fs.readFileSync(fullPath, "utf-8");
            content = content.replace(
              /const DEFAULT_SERVER_URL = ".*?";/,
              `const DEFAULT_SERVER_URL = "${currentOrigin}";`
            );
            archive.append(content, { name: zipEntryPath });
          } else {
            archive.file(fullPath, { name: zipEntryPath });
          }
        }
      }
    }

    addDirectory(extensionDir, "");

    await archive.finalize();

    await new Promise<void>((resolve, reject) => {
      outputZipStream.on("close", () => resolve());
      outputZipStream.on("error", (err) => reject(err));
    });

    const fileStat = fs.statSync(zipPath);
    const fileStream = fs.createReadStream(zipPath);

    const headers = new Headers();
    headers.set("Content-Disposition", 'attachment; filename="skibidimp3-extension.zip"');
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Length", String(fileStat.size));

    fileStream.on("end", () => {
      if (fs.existsSync(zipPath)) {
        try { fs.unlinkSync(zipPath); } catch {}
      }
    });

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readableStream, { headers });
  } catch (err: any) {
    if (fs.existsSync(zipPath)) {
      try { fs.unlinkSync(zipPath); } catch {}
    }
    return NextResponse.json({ error: err.message || "Erreur lors de la création du ZIP." }, { status: 500 });
  }
}
