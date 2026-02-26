// app/api/admin/analytics/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

// ========================================
// IN-MEMORY CACHE
// Stores analytics data to avoid excessive Firebase reads
// ========================================
let cachedData: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
    // CHECK CACHE FIRST
    // ========================================
    const now = Date.now();
    const cacheAge = now - cacheTimestamp;
    
    // If cache exists and is less than 5 minutes old, return cached data
    if (cachedData && cacheAge < CACHE_DURATION) {
      console.log(`Returning cached analytics data (age: ${Math.round(cacheAge / 1000)}s)`);
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          'X-Cache': 'HIT',
          'X-Cache-Age': Math.round(cacheAge / 1000).toString()
        }
      });
    }

    console.log('Cache miss or expired, fetching fresh data from Firebase');

    // ========================================
    // FETCH FRESH DATA
    // ========================================
    const currentDate = new Date();
    
    // Total users count
    const totalUsersCount = await firestore
      .collection("users")
      .count()
      .get();
    const totalUsers = totalUsersCount.data().count;

    // Active subscribed users count (not expired)
    const subscribedCountSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "subscribed")
      .where("subscriptionEndDate", ">", currentDate.toISOString())
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
    // Aggregate chapters from manga documents
    // ========================================
    let totalChapters = 0;
    
    const mangaSnapshot = await firestore
      .collection("mangas")
      .select("chapters")
      .get();
    
    mangaSnapshot.docs.forEach(mangaDoc => {
      const data = mangaDoc.data();
      totalChapters += data.chapters || 0;
    });

    // ========================================
    // Sample-based XP calculation
    // ========================================
    let averageXP = 0;
    
    if (totalUsers > 0) {
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
    // Weekly data
    // ========================================
    const weeklyNewUsers: { [key: string]: number } = {};
    
    for (let i = 7; i >= 0; i--) {
      const weekKey = `Week ${8 - i}`;
      weeklyNewUsers[weekKey] = 0;
    }

    const eightWeeksAgo = new Date(currentDate);
    eightWeeksAgo.setDate(currentDate.getDate() - (8 * 7));
    
    const recentUsersSnapshot = await firestore
      .collection("users")
      .where("createdAt", ">=", eightWeeksAgo.toISOString())
      .select("createdAt")
      .get();
    
    recentUsersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        const creationDate = new Date(data.createdAt);
        const weeksAgo = Math.floor((currentDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        
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

    // ========================================
    // UPDATE CACHE
    // ========================================
    cachedData = analyticsData;
    cacheTimestamp = Date.now();

    console.log('Fresh data fetched and cached');

    return NextResponse.json(analyticsData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}