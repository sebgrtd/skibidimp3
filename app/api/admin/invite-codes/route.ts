import { NextRequest, NextResponse } from "next/server";
import { getUserByToken, generateInviteCode, getInviteCodes, deleteInviteCode } from "@/lib/db";

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

  const invites = getInviteCodes();
  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  const admin = getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé. Administrateur requis." }, { status: 403 });
  }

  try {
    const invite = generateInviteCode(admin.id);
    return NextResponse.json({ success: true, invite });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ error: "Accès refusé. Administrateur requis." }, { status: 403 });
  }

  try {
    const { inviteId } = await req.json();
    if (!inviteId) {
      return NextResponse.json({ error: "ID de code requis." }, { status: 400 });
    }

    deleteInviteCode(inviteId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
