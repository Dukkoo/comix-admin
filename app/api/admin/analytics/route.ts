// app/api/admin/analytics/route.ts
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

    // Check if user is admin
    if (!verifiedToken.admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get all users from Firebase Authentication
    const authUsers = await auth.listUsers(1000);
    
    // Get all user documents from Firestore
    const userDocsSnapshot = await firestore.collection("users").get();
    const userDocs: { [key: string]: any } = {};
    userDocsSnapshot.docs.forEach(doc => {
      userDocs[doc.id] = doc.data();
    });

    // Get manga data from database
    const mangaSnapshot = await firestore.collection("mangas").get();
    const totalMangas = mangaSnapshot.size;
    
    // Calculate total chapters - check multiple possibilities
    let totalChapters = 0;
    
    // Method 1: Check if chapters are stored as subcollections under each manga
    for (const mangaDoc of mangaSnapshot.docs) {
      try {
        const chaptersSnapshot = await firestore
          .collection("mangas")
          .doc(mangaDoc.id)
          .collection("chapters")
          .get();
        totalChapters += chaptersSnapshot.size;
      } catch (error) {
        // Silent fail - try next method
      }
    }
    
    // Method 2: If no subcollections found, check if chapters count is stored as a field
    if (totalChapters === 0) {
      mangaSnapshot.docs.forEach(mangaDoc => {
        const mangaData = mangaDoc.data();
        const chaptersCount = mangaData.chapters || mangaData.chaptersCount || mangaData.totalChapters || 0;
        totalChapters += chaptersCount;
      });
    }
    
    // Method 3: Still try the standalone chapters collection (keep as fallback)
    if (totalChapters === 0) {
      const chaptersSnapshot = await firestore.collection("chapters").get();
      totalChapters = chaptersSnapshot.size;
    }

    // Process user data
    let subscribedCount = 0;
    let freeCount = 0;
    let totalXP = 0;
    const weeklyNewUsers: { [key: string]: number } = {};

    // Initialize last 8 weeks
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7));
      const weekKey = `Week ${8 - i}`;
      weeklyNewUsers[weekKey] = 0;
    }

    authUsers.users.forEach(authUser => {
      const firestoreData = userDocs[authUser.uid] || {};
      
      // Count subscription status
      if (firestoreData?.subscriptionStatus === "subscribed") {
        // Check if subscription is still valid
        if (firestoreData?.subscriptionEndDate) {
          const endDate = new Date(firestoreData.subscriptionEndDate);
          if (endDate > now) {
            subscribedCount++;
          } else {
            freeCount++;
          }
        } else {
          freeCount++;
        }
      } else {
        freeCount++;
      }

      // Calculate total XP
      totalXP += firestoreData?.xp || 0;

      // Count weekly new users
      const creationDate = new Date(authUser.metadata.creationTime);
      const weeksAgo = Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      
      if (weeksAgo < 8) {
        const weekKey = `Week ${8 - weeksAgo}`;
        if (weeklyNewUsers[weekKey] !== undefined) {
          weeklyNewUsers[weekKey]++;
        }
      }
    });

    // Calculate some additional stats
    const totalUsers = authUsers.users.length;
    const subscriptionRate = totalUsers > 0 ? (subscribedCount / totalUsers) * 100 : 0;
    const averageXP = totalUsers > 0 ? Math.round(totalXP / totalUsers) : 0;

    // Prepare response data
    const analyticsData = {
      stats: {
        totalUsers,
        subscribedUsers: subscribedCount,
        freeUsers: freeCount,
        totalMangas,
        totalChapters,
        averageXP,
        subscriptionRate: Math.round(subscriptionRate * 100) / 100
      },
      pieData: [
        { name: 'Subscribed', value: subscribedCount, color: '#0891b2' },
        { name: 'Free', value: freeCount, color: '#52525b' }
      ],
      weeklyData: Object.entries(weeklyNewUsers).map(([week, users]) => ({
        week,
        users
      }))
    };

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}