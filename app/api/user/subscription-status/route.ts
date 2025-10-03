// app/api/user/subscription-status/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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
    const userId = verifiedToken.uid;

    // Get user document from Firestore
    const userDocRef = firestore.collection("users").doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      // Create a default user document if it doesn't exist
      await userDocRef.set({
        email: verifiedToken.email || '',
        subscriptionStatus: "not_subscribed",
        xp: 0,
        createdAt: new Date(),
      });

      return NextResponse.json({
        isSubscribed: false,
        subscriptionStatus: "not_subscribed",
        subscriptionDaysLeft: 0,
        subscriptionEndDate: null,
        xp: 0,
      });
    }

    const userData = userDoc.data();
    let isSubscribed = false;
    let subscriptionDaysLeft = 0;
    let subscriptionEndDate = userData?.subscriptionEndDate || null;
    const userXP = userData?.xp || 0; // Get XP from Firestore

    // Check if user has an active subscription
    if (userData?.subscriptionStatus === "subscribed" && userData?.subscriptionEndDate) {
      const endDate = new Date(userData.subscriptionEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffTime > 0) {
        // Subscription is still active
        isSubscribed = true;
        subscriptionDaysLeft = diffDays;
      } else {
        // Subscription has expired - update the status
        await userDocRef.update({
          subscriptionStatus: "not_subscribed",
          updatedAt: new Date(),
        });
        subscriptionEndDate = null;
      }
    }

    return NextResponse.json({
      isSubscribed,
      subscriptionStatus: isSubscribed ? "subscribed" : "not_subscribed",
      subscriptionDaysLeft,
      subscriptionEndDate,
      xp: userXP, // Include XP in the response
    });

  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}