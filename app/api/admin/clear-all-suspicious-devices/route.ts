// app/api/admin/clear-all-suspicious-devices/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verifiedToken = await auth.verifyIdToken(authHeader.split(" ")[1]);
    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    // Suspicious users API-тай яг ижил query (orderBy-тай)
    const usersSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "subscribed")
      .where("deviceCount", ">=", 3)
      .orderBy("deviceCount", "desc")
      .get();

    const docs = usersSnapshot.docs;

    // Batch лимит 500 тул 450-аар хуваана
    for (let i = 0; i < docs.length; i += 450) {
      const batch = firestore.batch();
      docs.slice(i, i + 450).forEach((d) => {
        batch.update(d.ref, { devices: [], deviceCount: 0 });
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true, clearedCount: docs.length });
  } catch (error: any) {
    console.error("Error clearing all devices:", error);
    return NextResponse.json(
      {
        error: "Failed to clear devices",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}