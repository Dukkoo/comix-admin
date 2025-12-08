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

    // ========================================
    // OPTIMIZATION 1: Use COUNT queries (1 read each)
    // ========================================
    
    // Total users count
    const totalUsersCount = await firestore
      .collection("users")
      .count()
      .get();
    const totalUsers = totalUsersCount.data().count;

    // Subscribed users count
    const subscribedCountSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "subscribed")
      .count()
      .get();
    const subscribedCount = subscribedCountSnapshot.data().count;

    // Free users
    const freeCount = totalUsers - subscribedCount;

    // Total mangas count
    const totalMangasCount = await firestore
      .collection("mangas")
      .count()
      .get();
    const totalMangas = totalMangasCount.data().count;

    // ========================================
    // OPTIMIZATION 2: Aggregate chapters from manga documents
    // Instead of querying each manga's subcollection, use stored counts
    // ========================================
    
    let totalChapters = 0;
    
    // Get only the chapters field from each manga (minimal reads)
    const mangaSnapshot = await firestore
      .collection("mangas")
      .select("chapters") // Only get chapters field, not full documents
      .get();
    
    mangaSnapshot.docs.forEach(mangaDoc => {
      const data = mangaDoc.data();
      totalChapters += data.chapters || 0;
    });

    // ========================================
    // OPTIMIZATION 3: Sample-based XP calculation
    // Instead of getting all users, sample 100 for average XP
    // ========================================
    
    let averageXP = 0;
    
    if (totalUsers > 0) {
      // Sample up to 100 users for XP calculation
      const sampleSize = Math.min(100, totalUsers);
      const xpSampleSnapshot = await firestore
        .collection("users")
        .select("xp")
        .limit(sampleSize)
        .get();
      
      let totalSampleXP = 0;
      xpSampleSnapshot.docs.forEach(doc => {
        totalSampleXP += doc.data().xp || 0;
      });
      
      averageXP = Math.round(totalSampleXP / sampleSize);
    }

    // ========================================
    // OPTIMIZATION 4: Weekly data from cached/aggregated source
    // For production, consider caching this or using Cloud Functions
    // ========================================
    
    const weeklyNewUsers: { [key: string]: number } = {};
    const now = new Date();
    
    // Initialize last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekKey = `Week ${8 - i}`;
      weeklyNewUsers[weekKey] = 0;
    }

    // Get users created in last 8 weeks only (not all users)
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(now.getDate() - (8 * 7));
    
    const recentUsersSnapshot = await firestore
      .collection("users")
      .where("createdAt", ">=", eightWeeksAgo.toISOString())
      .select("createdAt")
      .get();
    
    recentUsersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        const creationDate = new Date(data.createdAt);
        const weeksAgo = Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        
        if (weeksAgo < 8) {
          const weekKey = `Week ${8 - weeksAgo}`;
          if (weeklyNewUsers[weekKey] !== undefined) {
            weeklyNewUsers[weekKey]++;
          }
        }
      }
    });

    // Calculate subscription rate
    const subscriptionRate = totalUsers > 0 ? (subscribedCount / totalUsers) * 100 : 0;

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

// ========================================
// ADDITIONAL OPTIMIZATION: Cache the results
// Consider adding Next.js revalidation
// ========================================

export const revalidate = 300; // Cache for 5 minutes