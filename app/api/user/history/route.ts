import { NextRequest, NextResponse } from "next/server";
import { 
  getUserByToken, 
  getUserDownloadHistory, 
  addDownloadHistory,
  deleteDownloadHistoryRecord,
  deleteBatchDownloadHistory,
  clearUserDownloadHistory
} from "@/lib/db";

function getAuthUser(req: NextRequest) {
  const token = req.cookies.get("skibidi_session")?.value || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return getUserByToken(token);
}

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const history = getUserDownloadHistory(user.id);
  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Batch sync support for local history synchronization
    if (Array.isArray(body.items) && body.items.length > 0) {
      const existing = getUserDownloadHistory(user.id);
      const added: any[] = [];
      for (const item of body.items) {
        if (!item.title || !item.url) continue;
        const isDuplicate = existing.some(
          (e) => e.url === item.url && e.format === item.format && (e.title === item.title || e.date === item.date)
        );
        if (!isDuplicate) {
          const rec = addDownloadHistory(user.id, {
            title: item.title,
            artist: item.artist || "Artiste Inconnu",
            thumbnail: item.thumbnail,
            format: item.format || "mp3",
            bitrate: item.bitrate || "320k",
            url: item.url,
            date: item.date || new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }),
          });
          added.push(rec);
        }
      }
      const updated = getUserDownloadHistory(user.id);
      return NextResponse.json({ success: true, history: updated, syncedCount: added.length });
    }

    const { title, artist, thumbnail, format, bitrate, url } = body;

    if (!title || !url) {
      return NextResponse.json({ error: "Données de téléchargement invalides." }, { status: 400 });
    }

    const record = addDownloadHistory(user.id, {
      title,
      artist: artist || "Artiste Inconnu",
      thumbnail,
      format: format || "mp3",
      bitrate: bitrate || "320k",
      url,
      date: new Date().toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }),
    });

    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { id, ids, clearAll } = body;

    if (clearAll) {
      clearUserDownloadHistory(user.id);
      return NextResponse.json({ success: true, message: "Historique vidé avec succès." });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      deleteBatchDownloadHistory(user.id, ids);
      return NextResponse.json({ success: true, message: `${ids.length} élément(s) supprimé(s).` });
    }

    if (id && typeof id === "string") {
      const deleted = deleteDownloadHistoryRecord(user.id, id);
      return NextResponse.json({ success: deleted, message: deleted ? "Élément supprimé." : "Élément introuvable." });
    }

    return NextResponse.json({ error: "Paramètres de suppression invalides." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

