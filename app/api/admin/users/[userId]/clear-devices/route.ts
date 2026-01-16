// app/api/admin/users/[userId]/clear-devices/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    const { userId } = params;

    // User-н devices subcollection устгах
    const devicesRef = firestore.collection("users").doc(userId).collection("devices");
    const devicesSnapshot = await devicesRef.get();

    const batch = firestore.batch();
    devicesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      clearedCount: devicesSnapshot.size 
    });
  } catch (error) {
    console.error("Error clearing devices:", error);
    return NextResponse.json({ error: "Failed to clear devices" }, { status: 500 });
  }
}