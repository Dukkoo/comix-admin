// app/api/admin/subscription-details/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

// ========================================
// IN-MEMORY CACHE
// ========================================
let cachedData: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
    // CHECK CACHE
    // ========================================
    const now = Date.now();
    const cacheAge = now - cacheTimestamp;
    
    if (cachedData && cacheAge < CACHE_DURATION) {
      console.log(`Returning cached subscription details (age: ${Math.round(cacheAge / 1000)}s)`);
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          'X-Cache': 'HIT'
        }
      });
    }

    console.log('Cache miss, fetching fresh subscription details');

    // ========================================
    // FETCH FRESH DATA
    // ========================================
    const currentDate = new Date();

    // 1. Expiring soon (7 days)
    const sevenDaysLater = new Date(currentDate);
    sevenDaysLater.setDate(currentDate.getDate() + 7);

    const expiringSoonSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "subscribed")
      .where("subscriptionEndDate", ">", currentDate.toISOString())
      .where("subscriptionEndDate", "<=", sevenDaysLater.toISOString())
      .select("subscriptionEndDate")
      .get();

    const expiringSoonCount = expiringSoonSnapshot.size;

    // 2. New subscribers this month
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const newSubscribersSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "subscribed")
      .where("subscriptionStartDate", ">=", startOfMonth.toISOString())
      .select("subscriptionStartDate")
      .get();

    const newSubscribersCount = newSubscribersSnapshot.size;

    // 3. Trends (90, 30, 7 days)
    const periods = [
      { days: 90, label: "90 хоног" },
      { days: 30, label: "30 хоног" },
      { days: 7, label: "7 хоног" },
    ];

    const trendData = await Promise.all(
      periods.map(async (period) => {
        const periodStart = new Date(currentDate);
        periodStart.setDate(currentDate.getDate() - period.days);

        const snapshot = await firestore
          .collection("users")
          .where("subscriptionStatus", "==", "subscribed")
          .where("subscriptionStartDate", ">=", periodStart.toISOString())
          .where("subscriptionStartDate", "<=", currentDate.toISOString())
          .select("subscriptionStartDate")
          .get();

        return {
          period: period.label,
          count: snapshot.size,
          days: period.days,
        };
      })
    );

    // 4. MRR Calculation
    const activeSubscribersSnapshot = await firestore
      .collection("users")
      .where("subscriptionStatus", "==", "subscribed")
      .select("subscriptionType", "subscriptionEndDate")
      .get();

    let monthlyRevenue = 0;
    let activeSubscribersCount = 0;

    // Subscription prices (adjust to your actual prices)
    const subscriptionPrices: { [key: string]: number } = {
      monthly: 9900,
      yearly: 99000,
      premium: 19900,
    };

    activeSubscribersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      
      if (data.subscriptionEndDate) {
        const endDate = new Date(data.subscriptionEndDate);
        if (endDate > currentDate) {
          activeSubscribersCount++;
          
          const subType = data.subscriptionType || "monthly";
          const price = subscriptionPrices[subType] || subscriptionPrices.monthly;

          if (subType === "yearly") {
            monthlyRevenue += price / 12;
          } else {
            monthlyRevenue += price;
          }
        }
      }
    });

    monthlyRevenue = Math.round(monthlyRevenue);

    // 5. Timeline data (last 90 days)
    const dailyActivations: { [key: string]: number } = {};
    
    for (let i = 89; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyActivations[dateKey] = 0;
    }

    const ninetyDaysAgo = new Date(currentDate);
    ninetyDaysAgo.setDate(currentDate.getDate() - 90);

    const timelineSnapshot = await firestore
      .collection("users")
      .where("subscriptionStartDate", ">=", ninetyDaysAgo.toISOString())
      .select("subscriptionStartDate")
      .get();

    timelineSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.subscriptionStartDate) {
        const dateKey = data.subscriptionStartDate.split('T')[0];
        if (dailyActivations[dateKey] !== undefined) {
          dailyActivations[dateKey]++;
        }
      }
    });

    const timelineData = Object.entries(dailyActivations).map(([date, count]) => ({
      date,
      count,
    }));

    // ========================================
    // PREPARE RESPONSE
    // ========================================
    const detailsData = {
      expiringSoon: {
        count: expiringSoonCount,
        label: "7 хоногт дуусах",
      },
      newSubscribers: {
        count: newSubscribersCount,
        label: "Энэ сард шинээр",
      },
      trends: trendData,
      mrr: {
        amount: monthlyRevenue,
        activeCount: activeSubscribersCount,
        currency: "₮",
      },
      timeline: timelineData,
    };

    // ========================================
    // UPDATE CACHE
    // ========================================
    cachedData = detailsData;
    cacheTimestamp = Date.now();

    console.log('Fresh subscription details fetched and cached');

    return NextResponse.json(detailsData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error("Error fetching subscription details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}