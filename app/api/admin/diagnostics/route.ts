import { NextRequest, NextResponse } from "next/server";
import { getUserByToken } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface DiagnosticTestItem {
  platform: string;
  name: string;
  url: string;
  format: "mp4" | "mp3" | "png" | "gif";
  status?: "pending" | "running" | "success" | "error";
  durationMs?: number;
  fileSizeBytes?: number;
  message?: string;
  error?: string;
}

const TEST_LINKS: DiagnosticTestItem[] = [
  {
    platform: "YouTube",
    name: "YouTube - Audio MP3 (320k)",
    url: "https://www.youtube.com/watch?v=M2Wfy9Wj8-M",
    format: "mp3",
  },
  {
    platform: "YouTube",
    name: "YouTube - Vidéo MP4 HD",
    url: "https://www.youtube.com/watch?v=M2Wfy9Wj8-M",
    format: "mp4",
  },
  {
    platform: "Spotify",
    name: "Spotify - Single Track MP3 (intl-fr)",
    url: "https://open.spotify.com/intl-fr/track/6CfromGdojo0R0vlgA7iU8",
    format: "mp3",
  },
  {
    platform: "Spotify",
    name: "Spotify - Album Multi-Tracks ZIP",
    url: "https://open.spotify.com/album/3mkVo55KYmJAxy21rPssZ4",
    format: "mp3",
  },
  {
    platform: "SoundCloud",
    name: "SoundCloud - Audio MP3 Direct",
    url: "https://soundcloud.com/postmalone/circles",
    format: "mp3",
  },
  {
    platform: "Vimeo",
    name: "Vimeo - Vidéo MP4 HD",
    url: "https://vimeo.com/22439234",
    format: "mp4",
  },
  {
    platform: "Vimeo",
    name: "Vimeo - Audio MP3 Direct",
    url: "https://vimeo.com/22439234",
    format: "mp3",
  },
  {
    platform: "Pinterest",
    name: "Pinterest - Image PNG HD",
    url: "https://www.pinterest.com/pin/123456789/",
    format: "png",
  },
  {
    platform: "Twitter / X",
    name: "Twitter/X - Image PNG HD",
    url: "https://twitter.com/TheEllenShow/status/440322224407314432",
    format: "png",
  },
  {
    platform: "Twitter / X",
    name: "Twitter/X - Carrousel Multi-Médias",
    url: "https://twitter.com/TheEllenShow/status/440322224407314432",
    format: "png",
  },
  {
    platform: "Instagram",
    name: "Instagram - Reel Vidéo MP4",
    url: "https://www.instagram.com/reel/C8qL_50uP9V/",
    format: "mp4",
  },
  {
    platform: "Instagram",
    name: "Instagram - Carrousel Photos/Vidéos",
    url: "https://www.instagram.com/p/C9v8-Y-tS-r/",
    format: "png",
  },
  {
    platform: "TikTok",
    name: "TikTok - Vidéo MP4 (Sans filigrane)",
    url: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
    format: "mp4",
  },
];

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("skibidi_session")?.value;
    if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const user = getUserByToken(token);
    if (!user || !user.isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    return NextResponse.json({ tests: TEST_LINKS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur interne" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("skibidi_session")?.value;
    if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const user = getUserByToken(token);
    if (!user || !user.isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { url, format } = await req.json();
    if (!url || !format) {
      return NextResponse.json({ error: "Paramètres url et format requis" }, { status: 400 });
    }

    const startTime = Date.now();
    const origin = req.nextUrl.origin;

    // 1. Check metadata via /api/info
    const infoRes = await fetch(`${origin}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const infoData = await infoRes.json();
    if (!infoRes.ok) {
      const durationMs = Date.now() - startTime;
      return NextResponse.json({
        success: false,
        durationMs,
        error: infoData.error || "Échec analyse média (/api/info)",
      });
    }

    // 2. Test download via /api/download
    const downloadRes = await fetch(`${origin}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: infoData.url || url,
        format,
        metadata: {
          title: infoData.title || "Diagnostic Test",
          artist: infoData.artist || "Diagnostic",
          coverUrl: infoData.thumbnail || infoData.imageUrl || undefined,
        },
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!downloadRes.ok) {
      const errBody = await downloadRes.json().catch(() => ({ error: `HTTP ${downloadRes.status}` }));
      return NextResponse.json({
        success: false,
        durationMs,
        error: errBody.error || `Erreur serveur HTTP ${downloadRes.status}`,
      });
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const fileSizeBytes = arrayBuffer.byteLength;

    return NextResponse.json({
      success: true,
      durationMs,
      fileSizeBytes,
      title: infoData.title,
      contentType: downloadRes.headers.get("Content-Type"),
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur interne" }, { status: 500 });
  }
}
