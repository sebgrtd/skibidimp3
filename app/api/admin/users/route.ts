import { NextRequest, NextResponse } from "next/server";
import { 
  getUserByToken, 
  createUser, 
  getAllUsers, 
  deleteUser, 
  setUserAdminRole, 
  resetUserPassword 
} from "@/lib/db";

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
    const { username, password, isAdmin = false } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Le nom d'utilisateur et le mot de passe sont requis." }, { status: 400 });
    }

    const newUser = createUser(username, password, isAdmin);
    return NextResponse.json({ success: true, user: { id: newUser.id, username: newUser.username, isAdmin: newUser.isAdmin } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur lors de la création de l'utilisateur." }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé. Administrateur requis." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, action, newPassword, isAdmin } = body;

    if (!userId) {
      return NextResponse.json({ error: "Identifiant utilisateur manquant." }, { status: 400 });
    }

    if (action === "toggle_admin") {
      setUserAdminRole(userId, Boolean(isAdmin));
      return NextResponse.json({ success: true, message: "Statut administrateur mis à jour." });
    }

    if (action === "reset_password") {
      if (!newPassword || newPassword.length < 4) {
        return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 4 caractères." }, { status: 400 });
      }
      resetUserPassword(userId, newPassword);
      return NextResponse.json({ success: true, message: "Mot de passe réinitialisé avec succès." });
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur lors de la modification de l'utilisateur." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé. Administrateur requis." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Identifiant utilisateur manquant." }, { status: 400 });
    }

    if (userId === admin.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte actuellement connecté." }, { status: 400 });
    }

    deleteUser(userId);
    return NextResponse.json({ success: true, message: "Utilisateur supprimé avec succès." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur lors de la suppression de l'utilisateur." }, { status: 400 });
  }
}
