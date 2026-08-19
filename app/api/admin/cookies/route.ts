import { NextRequest, NextResponse } from "next/server";
import { getUserByToken } from "@/lib/db";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const COOKIES_FILE = path.join(DATA_DIR, "cookies.txt");

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("skibidi_session")?.value;
    if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const user = getUserByToken(token);
    if (!user || !user.isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    if (fs.existsSync(COOKIES_FILE)) {
      const stats = fs.statSync(COOKIES_FILE);
      return NextResponse.json({
        hasCookies: true,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      });
    }

    return NextResponse.json({
      hasCookies: false,
      size: 0,
      lastModified: null,
    });
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

    const { cookiesContent } = await req.json();
    if (!cookiesContent || typeof cookiesContent !== "string" || cookiesContent.trim().length === 0) {
      return NextResponse.json({ error: "Le contenu des cookies est vide ou invalide." }, { status: 400 });
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(COOKIES_FILE, cookiesContent.trim(), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Fichier de cookies YouTube mis à jour avec succès !",
      size: fs.statSync(COOKIES_FILE).size,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("skibidi_session")?.value;
    if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const user = getUserByToken(token);
    if (!user || !user.isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
    }

    return NextResponse.json({ success: true, message: "Cookies supprimés avec succès." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur interne" }, { status: 500 });
  }
}
