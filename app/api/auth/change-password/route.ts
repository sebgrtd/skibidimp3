import { NextRequest, NextResponse } from "next/server";
import { getUserByToken, updateUserPassword, verifyPassword, User } from "@/lib/db";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("skibidi_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Non autorisé. Veuillez vous connecter." }, { status: 401 });
    }

    const user = getUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Session expirée ou invalide." }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit comporter au moins 6 caractères." }, { status: 400 });
    }

    // Verify current password
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) as User[];
    const dbUser = users.find((u) => u.id === user.id);
    if (!dbUser) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    if (currentPassword && !verifyPassword(currentPassword, dbUser.passwordHash, dbUser.salt)) {
      return NextResponse.json({ error: "Le mot de passe actuel est incorrect." }, { status: 400 });
    }

    updateUserPassword(user.id, newPassword);

    return NextResponse.json({ success: true, message: "Mot de passe modifié avec succès !" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur interne." }, { status: 500 });
  }
}
