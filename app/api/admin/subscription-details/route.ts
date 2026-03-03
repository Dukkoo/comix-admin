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
  console.log('[Subscription Details] API called');
  
  try {
    // Get auth token from headers
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error('[Subscription Details] No authorization header');
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    // Check if user is admin
    if (!verifiedToken.admin) {
      console.error('[Subscription Details] User is not admin');
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
      console.log(`[Subscription Details] Returning cached data (age: ${Math.round(cacheAge / 1000)}s)`);
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          'X-Cache': 'HIT'
        }
      });
    }

    console.log('[Subscription Details] Cache miss, fetching fresh data...');

    // ========================================
    // FETCH FRESH DATA
    // ========================================
    const currentDate = new Date();

    // 1. Expiring soon (7 days)
    console.log('[Subscription Details] Fetching expiring subscriptions...');
    const sevenDaysLater = new Date(currentDate);
    sevenDaysLater.setDate(currentDate.getDate() + 7);

    let expiringSoonCount = 0;
    try {
      const expiringSoonSnapshot = await firestore
        .collection("users")
        .where("subscriptionStatus", "==", "subscribed")
        .where("subscriptionEndDate", ">", currentDate.toISOString())
        .where("subscriptionEndDate", "<=", sevenDaysLater.toISOString())
        .select("subscriptionEndDate")
        .get();
      expiringSoonCount = expiringSoonSnapshot.size;
      console.log('[Subscription Details] Expiring soon count:', expiringSoonCount);
    } catch (error) {
      console.error('[Subscription Details] Error fetching expiring subscriptions:', error);
    }

    // 2. New subscribers this month
    console.log('[Subscription Details] Fetching new subscribers...');
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    let newSubscribersCount = 0;
    try {
      const newSubscribersSnapshot = await firestore
        .collection("users")
        .where("subscriptionStatus", "==", "subscribed")
        .where("subscriptionStartDate", ">=", startOfMonth.toISOString())
        .select("subscriptionStartDate")
        .get();
      newSubscribersCount = newSubscribersSnapshot.size;
      console.log('[Subscription Details] New subscribers count:', newSubscribersCount);
    } catch (error) {
      console.error('[Subscription Details] Error fetching new subscribers:', error);
    }

    // 3. Trends (90, 30, 7 days)
    console.log('[Subscription Details] Fetching trends...');
    const periods = [
      { days: 90, label: "90 хоног" },
      { days: 30, label: "30 хоног" },
      { days: 7, label: "7 хоног" },
    ];

    const trendData = await Promise.all(
      periods.map(async (period) => {
        try {
          const periodStart = new Date(currentDate);
          periodStart.setDate(currentDate.getDate() - period.days);

          const snapshot = await firestore
            .collection("users")
            .where("subscriptionStatus", "==", "subscribed")
            .where("subscriptionStartDate", ">=", periodStart.toISOString())
            .where("subscriptionStartDate", "<=", currentDate.toISOString())
            .select("subscriptionStartDate")
            .get();

          console.log(`[Subscription Details] Trend ${period.label}:`, snapshot.size);
          return {
            period: period.label,
            count: snapshot.size,
            days: period.days,
          };
        } catch (error) {
          console.error(`[Subscription Details] Error fetching trend ${period.label}:`, error);
          return {
            period: period.label,
            count: 0,
            days: period.days,
          };
        }
      })
    );

    // 4. Сарын дундаж орлого (MRR) - Current month revenue only
    console.log('[Subscription Details] Calculating current month revenue...');
    let monthlyRevenue = 0;
    let activeSubscribersCount = 0;

    try {
      // Get subscriptions that started THIS MONTH
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const monthSubscriptionsSnapshot = await firestore
        .collection("users")
        .where("subscriptionStatus", "==", "subscribed")
        .where("subscriptionStartDate", ">=", startOfMonth.toISOString())
        .where("subscriptionStartDate", "<=", endOfMonth.toISOString())
        .select("subscriptionType", "subscriptionEndDate")
        .get();

      console.log('[Subscription Details] This month subscriptions:', monthSubscriptionsSnapshot.size);

      // Subscription prices
      const subscriptionPrices: { [key: string]: number } = {
        monthly: 5900,    // 1 сар
        quarterly: 15000, // 3 сар
        biannual: 30000,  // 6 сар
      };

      monthSubscriptionsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        
        // Check if subscription is still active
        if (data.subscriptionEndDate) {
          const endDate = new Date(data.subscriptionEndDate);
          if (endDate > currentDate) {
            activeSubscribersCount++;
            
            const subType = data.subscriptionType || "monthly";
            const price = subscriptionPrices[subType] || subscriptionPrices.monthly;
            
            monthlyRevenue += price;
          }
        }
      });

      console.log('[Subscription Details] Monthly revenue:', monthlyRevenue, 'Count:', activeSubscribersCount);
    } catch (error) {
      console.error('[Subscription Details] Error calculating revenue:', error);
    }

    // 5. Timeline data (last 90 days)
    console.log('[Subscription Details] Fetching timeline...');
    const dailyActivations: { [key: string]: number } = {};
    
    for (let i = 89; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyActivations[dateKey] = 0;
    }

    try {
      const ninetyDaysAgo = new Date(currentDate);
      ninetyDaysAgo.setDate(currentDate.getDate() - 90);

      const timelineSnapshot = await firestore
        .collection("users")
        .where("subscriptionStartDate", ">=", ninetyDaysAgo.toISOString())
        .select("subscriptionStartDate")
        .get();

      console.log('[Subscription Details] Timeline entries:', timelineSnapshot.size);

      timelineSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.subscriptionStartDate) {
          const dateKey = data.subscriptionStartDate.split('T')[0];
          if (dailyActivations[dateKey] !== undefined) {
            dailyActivations[dateKey]++;
          }
        }
      });
    } catch (error) {
      console.error('[Subscription Details] Error fetching timeline:', error);
    }

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

    console.log('[Subscription Details] Data fetched successfully');

    return NextResponse.json(detailsData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error("[Subscription Details] Fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}