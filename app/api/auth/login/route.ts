import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { username, usernameOrEmail, password } = await req.json();
    const loginUser = username || usernameOrEmail;

    if (!loginUser || !password) {
      return NextResponse.json({ error: "Nom d'utilisateur et mot de passe requis." }, { status: 400 });
    }

    const user = authenticateUser(loginUser, password);
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
    return NextResponse.json({ error: error.message || "Erreur de connexion." }, { status: 401 });
  }
}
