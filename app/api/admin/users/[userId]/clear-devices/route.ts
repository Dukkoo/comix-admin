import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verifiedToken = await auth.verifyIdToken(authHeader.split(" ")[1]);
    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const userRef = firestore.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const clearedCount = (userSnap.data()?.devices ?? []).length;

    await userRef.update({ devices: [], deviceCount: 0 });

    return NextResponse.json({ success: true, clearedCount });
  } catch (error) {
    console.error("Error clearing devices:", error);
    return NextResponse.json({ error: "Failed to clear devices" }, { status: 500 });
  }
}