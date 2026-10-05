// lib/admin-auth.ts
import { auth } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export interface AdminToken {
  uid: string;
  email?: string;
  [key: string]: any;
}

type AdminCheck =
  | { ok: true; token: AdminToken }
  | { ok: false; response: NextResponse };

const deny = (error: string, status: number): AdminCheck => ({
  ok: false,
  response: NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } }),
});

/**
 * Admin API бүрийн эхэнд ашиглана:
 *
 *   const admin = await requireAdmin(request);
 *   if (!admin.ok) return admin.response;
 *
 * - Header байхгүй / буруу / хугацаа дууссан token -> 401
 * - Token хүчинтэй боловч `admin` claim байхгүй     -> 403
 * - `checkRevoked: true` нь token цуцлагдсан эсэхийг шалгана (нэмэлт сүлжээний дуудлага).
 *   Өгөгдөл өөрчилдөг (PATCH/POST/DELETE) route дээр ашиглахыг зөвлөе.
 */
export async function requireAdmin(
  request: NextRequest,
  options: { checkRevoked?: boolean } = {}
): Promise<AdminCheck> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return deny("Unauthorized", 401);
  }

  const idToken = header.slice(7).trim();
  if (!idToken) {
    return deny("Unauthorized", 401);
  }

  try {
    const decoded = await auth.verifyIdToken(idToken, options.checkRevoked ?? false);

    if (!decoded.admin) {
      return deny("Admin access required", 403);
    }

    return { ok: true, token: decoded as AdminToken };
  } catch {
    // verifyIdToken буруу / хугацаа дууссан / цуцлагдсан token дээр алдаа шиддэг
    return deny("Invalid or expired token", 401);
  }
}