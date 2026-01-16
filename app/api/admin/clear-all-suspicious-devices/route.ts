// app/api/admin/clear-all-suspicious-devices/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";

export async function POST(request: NextRequest) {
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

    // Бүх subscribed хэрэглэгчдийг авах
    const usersSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "active")
      .get();

    let clearedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const devicesRef = userDoc.ref.collection("devices");
      const devicesSnapshot = await devicesRef.get();

      // 3+ device байвал устгах
      if (devicesSnapshot.size >= 3) {
        const batch = firestore.batch();
        devicesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        clearedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      clearedCount 
    });
  } catch (error) {
    console.error("Error clearing all devices:", error);
    return NextResponse.json({ error: "Failed to clear devices" }, { status: 500 });
  }
}