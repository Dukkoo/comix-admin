// app/api/admin/users/[userId]/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Get auth token from headers
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    // Check if user is admin
    if (!verifiedToken.admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { userId } = await params;

    // Get user from Firebase Authentication
    let authUser;
    try {
      authUser = await auth.getUser(userId);
    } catch (error) {
      return NextResponse.json(
        { error: "User not found in authentication" },
        { status: 404 }
      );
    }

    // Get user document from Firestore
    const userDocRef = firestore.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    const firestoreData = userDoc.exists ? userDoc.data() : {};

    // Combine auth and firestore data
    const userData = {
      id: authUser.uid,
      userId: firestoreData?.userId, // 5 оронтой ID
      username: firestoreData?.username || authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
      email: authUser.email || 'No email',
      xp: firestoreData?.xp || 0,
      subscriptionStatus: firestoreData?.subscriptionStatus || "not_subscribed",
      subscriptionEndDate: firestoreData?.subscriptionEndDate || null,
      subscriptionStartDate: firestoreData?.subscriptionStartDate || null,
      createdAt: authUser.metadata.creationTime || new Date().toISOString(),
      lastLogin: authUser.metadata.lastSignInTime || null,
    };

    // Calculate subscription days left
    let subscriptionDaysLeft: number | undefined;
    if (userData.subscriptionEndDate) {
      const endDate = new Date(userData.subscriptionEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffTime <= 0) {
        userData.subscriptionStatus = "not_subscribed";
        subscriptionDaysLeft = 0;
      } else {
        userData.subscriptionStatus = "subscribed";
        subscriptionDaysLeft = diffDays;
      }
    }

    return NextResponse.json({
      data: {
        ...userData,
        subscriptionDaysLeft,
      },
    });

  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}