import { NextRequest, NextResponse } from "next/server";
import { getUserByToken, createUser, getAllUsers } from "@/lib/db";

function getAdminUser(req: NextRequest) {
  const token = req.cookies.get("skibidi_session")?.value || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const user = getUserByToken(token);
  if (!user || !user.isAdmin) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé. Administrateur requis." }, { status: 403 });
  }

  const users = getAllUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const admin = getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé. Administrateur requis." }, { status: 403 });
  }

  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Tous les champs (Nom d'utilisateur, email, mot de passe) sont requis." }, { status: 400 });
    }

    const newUser = createUser(username, email, password);
    return NextResponse.json({ success: true, user: { id: newUser.id, username: newUser.username, email: newUser.email } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur lors de la création de l'utilisateur." }, { status: 400 });
  }
}
