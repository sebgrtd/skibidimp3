import { NextRequest, NextResponse } from "next/server";
import { getUserByToken, deleteSession } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("skibidi_session")?.value || req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = getUserByToken(token);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.isAdmin },
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("skibidi_session")?.value || req.headers.get("authorization")?.replace("Bearer ", "");
  if (token) {
    deleteSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("skibidi_session");
  return response;
}
