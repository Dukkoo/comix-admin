// app/api/admin/suspicious-users/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    // 3+ device-тэй, subscribed хэрэглэгчдийг авах (banned шүүлтгүй)
    const usersSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "subscribed")
      .where("deviceCount", ">=", 3)
      .orderBy("deviceCount", "desc")
      .limit(50)
      .get();

    const suspiciousUsers = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.displayName || data.username || "Unknown",
        email: data.email || "",
        deviceCount: data.deviceCount || 0,
        devices: data.devices || [],
        subscriptionStatus: data.subscriptionStatus,
        lastLogin: data.lastLogin || null,
        banned: data.banned || false, // banned төлөв нэмэв
        banExpiry: data.banExpiry || null,
      };
    });

    return NextResponse.json({
      success: true,
      users: suspiciousUsers,
      count: suspiciousUsers.length,
    });
  } catch (error: any) {
    console.error("Suspicious users fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}