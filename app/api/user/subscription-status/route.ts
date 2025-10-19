import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";

    const usersRef = firestore.collection("users");
    let snapshot;

    // Build query based on search and status
    if (search && search.trim() && /^\d{5}$/.test(search.trim())) {
      // Search by 5-digit userId
      const userIdNumber = parseInt(search.trim());
      
      if (status !== "all") {
        // Both filters
        snapshot = await usersRef
          .where("userId", "==", userIdNumber)
          .where("subscriptionStatus", "==", status)
          .get();
      } else {
        // Only userId filter
        snapshot = await usersRef
          .where("userId", "==", userIdNumber)
          .get();
      }
    } else {
      // No userId search
      if (status !== "all") {
        // Only status filter
        snapshot = await usersRef
          .where("subscriptionStatus", "==", status)
          .get();
      } else {
        // No filters
        snapshot = await usersRef.get();
      }
    }

    // Calculate pagination
    const totalCount = snapshot.size;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;

    // Apply pagination and map data
    const users = snapshot.docs
      .slice(offset, offset + limit)
      .map(doc => {
        const data = doc.data();
        let subscriptionDaysLeft;
        
        if (data.subscriptionStatus === "subscribed" && data.subscriptionEndDate) {
          const endDate = new Date(data.subscriptionEndDate);
          const now = new Date();
          const diffTime = endDate.getTime() - now.getTime();
          subscriptionDaysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        return {
          id: doc.id,
          userId: data.userId,
          username: data.displayName || data.name || data.email?.split('@')[0] || 'Unknown',
          email: data.email || '',
          xp: data.xp || 0,
          subscriptionStatus: data.subscriptionStatus || "not_subscribed",
          subscriptionDaysLeft,
          subscriptionEndDate: data.subscriptionEndDate,
          createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
          lastLogin: data.lastLogin?.toDate?.().toISOString(),
        };
      });

    return NextResponse.json({
      data: users,
      totalPages,
      currentPage: page,
      totalCount,
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}