import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession, validateAndUseInviteCode } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { username, password, inviteCode } = await req.json();

    if (!username || !password || !inviteCode) {
      return NextResponse.json({ error: "Le nom d'utilisateur, le mot de passe et le code d'invitation sont requis." }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 4 caractères." }, { status: 400 });
    }

    // Validate invite code
    const validInvite = validateAndUseInviteCode(inviteCode, username.trim());
    if (!validInvite) {
      return NextResponse.json(
        { error: "Code d'invitation invalide ou déjà utilisé. Demandez un code valide à l'administrateur." },
        { status: 400 }
      );
    }

    const user = createUser(username, password);
    const token = createSession(user.id);

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, isAdmin: !!user.isAdmin },
      token,
    });

    response.cookies.set("skibidi_session", token, {
      httpOnly: true,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur lors de l'inscription." }, { status: 400 });
  }
}
