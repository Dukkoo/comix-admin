// app/api/admin/users/[userId]/unban/route.ts
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

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await userRef.update({
      banned: false,
      banExpiry: null,
      banReason: "",
      unbannedAt: new Date().toISOString(),
      unbannedBy: verifiedToken.uid,
    });

    return NextResponse.json({
      success: true,
      message: "User unbanned successfully",
    });
  } catch (error: any) {
    console.error("Unban error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}