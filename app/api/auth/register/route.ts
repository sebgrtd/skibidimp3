import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 4 caractères." }, { status: 400 });
    }

    const user = createUser(username, email, password);
    const token = createSession(user.id);

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, email: user.email },
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
