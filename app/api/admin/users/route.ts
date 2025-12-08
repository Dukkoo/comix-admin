// app/api/admin/users/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

interface UserData {
  id: string;
  userId?: number;
  username: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string;
  createdAt: any;
  lastLogin?: any;
}

// Helper function to generate unique 5-digit userId
async function generateUniqueUserId(): Promise<number> {
  const min = 10000;
  const max = 99999;
  
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    const userId = Math.floor(Math.random() * (max - min + 1)) + min;
    
    const existingUser = await firestore
      .collection("users")
      .where("userId", "==", userId)
      .limit(1)
      .get();
    
    if (existingUser.empty) {
      return userId;
    }
    
    attempts++;
  }
  
  throw new Error("Could not generate unique userId");
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search")?.trim() || "";
    const searchType = searchParams.get("searchType") || "";
    const status = searchParams.get("status") || "all";

    // ========================================
    // BUILD QUERY
    // ========================================
    
    let query: FirebaseFirestore.Query = firestore.collection("users");
    let isSearchQuery = false;

    // Status filter
    if (status !== "all") {
      query = query.where("subscriptionStatus", "==", status);
    }

    // ========================================
    // SEARCH - Exact match (1-2 reads only!)
    // ========================================
    
    if (search) {
      isSearchQuery = true;
      
      // UserId exact match
      if (searchType === "userId" || /^\d+$/.test(search)) {
        const userIdNum = parseInt(search);
        query = query.where("userId", "==", userIdNum);
      }
      // Email exact match
      else if (searchType === "email" || search.includes("@")) {
        query = query.where("email", "==", search.toLowerCase());
      }
      // Default: treat as email if contains text
      else {
        query = query.where("email", "==", search.toLowerCase());
      }
    }

    // Default sort (only when not searching)
    if (!isSearchQuery) {
      query = query.orderBy("createdAt", "desc");
    }

    // ========================================
    // COUNT (1 read)
    // ========================================
    
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;
    const totalPages = Math.ceil(totalCount / limit);

    // ========================================
    // PAGINATION (25 reads max)
    // ========================================
    
    const offset = (page - 1) * limit;
    let paginatedQuery = query.limit(limit);
    
    if (offset > 0 && !isSearchQuery) {
      paginatedQuery = paginatedQuery.offset(offset);
    }

    const snapshot = await paginatedQuery.get();
    const userDocs = snapshot.docs;

    // ========================================
    // PROCESS USERS
    // ========================================
    
    const users: UserData[] = userDocs.map((doc) => {
      const data = doc.data();
      
      // Parse createdAt
      let createdAt: string;
      if (data.createdAt) {
        if (data.createdAt.toDate) {
          createdAt = data.createdAt.toDate().toISOString();
        } else {
          createdAt = data.createdAt;
        }
      } else {
        createdAt = new Date().toISOString();
      }
      
      // Calculate subscription days left
      let subscriptionDaysLeft: number | undefined;
      let subscriptionStatus = data.subscriptionStatus || "not_subscribed";
      
      if (data.subscriptionEndDate) {
        const endDate = new Date(data.subscriptionEndDate);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffTime <= 0) {
          subscriptionStatus = "not_subscribed";
          subscriptionDaysLeft = 0;
          
          // Update expired subscription in background
          if (data.subscriptionStatus === "subscribed") {
            firestore.collection("users").doc(doc.id).update({
              subscriptionStatus: "not_subscribed",
              updatedAt: new Date().toISOString(),
            }).catch(err => console.error(`Failed to update expired subscription for ${doc.id}`));
          }
        } else {
          subscriptionStatus = "subscribed";
          subscriptionDaysLeft = diffDays;
        }
      }

      return {
        id: doc.id,
        userId: data.userId,
        username: data.username || data.displayName || "Unknown",
        email: data.email || "",
        xp: data.xp || 0,
        subscriptionStatus,
        subscriptionEndDate: data.subscriptionEndDate || null,
        subscriptionDaysLeft,
        createdAt,
        lastLogin: data.lastLogin || null,
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { userId, subscriptionDays, xp, mode } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Verify user exists
    try {
      await auth.getUser(userId);
    } catch (error) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const updateData: any = {};

    if (subscriptionDays !== undefined) {
      if (subscriptionDays === 0) {
        updateData.subscriptionStatus = "not_subscribed";
        updateData.subscriptionEndDate = null;
        updateData.subscriptionStartDate = null;
      } else {
        const currentUserData = userDoc.exists ? userDoc.data() : {};
        let newEndDate: Date;

        if (mode === "set") {
          newEndDate = new Date();
          newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
          updateData.subscriptionStatus = "subscribed";
          updateData.subscriptionEndDate = newEndDate.toISOString();
          updateData.subscriptionStartDate = new Date().toISOString();
        } else {
          if (subscriptionDays > 0) {
            if (currentUserData?.subscriptionStatus === "subscribed" && currentUserData?.subscriptionEndDate) {
              const currentEndDate = new Date(currentUserData.subscriptionEndDate);
              const now = new Date();
              newEndDate = currentEndDate > now ? new Date(currentEndDate) : new Date();
              newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
            } else {
              newEndDate = new Date();
              newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
            }
            updateData.subscriptionStatus = "subscribed";
            updateData.subscriptionEndDate = newEndDate.toISOString();
            if (!currentUserData?.subscriptionStartDate || currentUserData?.subscriptionStatus !== "subscribed") {
              updateData.subscriptionStartDate = new Date().toISOString();
            }
          } else {
            if (currentUserData?.subscriptionEndDate) {
              newEndDate = new Date(currentUserData.subscriptionEndDate);
              newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
              if (newEndDate <= new Date()) {
                updateData.subscriptionStatus = "not_subscribed";
                updateData.subscriptionEndDate = null;
                updateData.subscriptionStartDate = null;
              } else {
                updateData.subscriptionStatus = "subscribed";
                updateData.subscriptionEndDate = newEndDate.toISOString();
              }
            } else {
              updateData.subscriptionStatus = "not_subscribed";
              updateData.subscriptionEndDate = null;
              updateData.subscriptionStartDate = null;
            }
          }
        }
      }
    }

    if (xp !== undefined) {
      updateData.xp = Math.max(0, xp);
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date().toISOString();
      
      if (userDoc.exists) {
        await userRef.update(updateData);
      } else {
        const authUser = await auth.getUser(userId);
        
        // Generate userId only when creating new document
        let newUserId: number | undefined;
        try {
          newUserId = await generateUniqueUserId();
        } catch (error) {
          console.error("Failed to generate userId:", error);
        }
        
        await userRef.set({
          userId: newUserId,
          username: authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
          email: authUser.email || '',
          xp: 0,
          subscriptionStatus: "not_subscribed",
          createdAt: authUser.metadata.creationTime || new Date().toISOString(),
          ...updateData,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully"
    });

  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}