// app/api/admin/users/[userId]/ban/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const { userId } = await params;
    const { days, reason } = await request.json();

    if (!days || days < 1) {
      return NextResponse.json({ error: "Invalid ban duration" }, { status: 400 });
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const banExpiry = new Date();
    banExpiry.setDate(banExpiry.getDate() + days);

    await userRef.update({
      banned: true,
      banExpiry: banExpiry.toISOString(),
      banReason: reason || "Account sharing detected",
      bannedAt: new Date().toISOString(),
      bannedBy: verifiedToken.uid,
    });

    return NextResponse.json({
      success: true,
      message: `User banned for ${days} days`,
      banExpiry: banExpiry.toISOString(),
    });
  } catch (error: any) {
    console.error("Ban error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}