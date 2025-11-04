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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const searchType = searchParams.get("searchType") || "";
    const status = searchParams.get("status") || "all";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const offset = (page - 1) * limit;

    // Get all users from Firebase Authentication
    const authUsers = await auth.listUsers(1000);
    
    // Get all user documents from Firestore
    const userDocsSnapshot = await firestore.collection("users").get();
    const userDocs: { [key: string]: any } = {};
    userDocsSnapshot.docs.forEach(doc => {
      userDocs[doc.id] = doc.data();
    });

    // Combine auth users with Firestore data
    const allUsers: UserData[] = await Promise.all(
      authUsers.users.map(async (authUser) => {
        const firestoreData = userDocs[authUser.uid] || {};
        
        // Auto-generate userId if missing
        let userId = firestoreData?.userId;
        if (!userId) {
          try {
            userId = await generateUniqueUserId();
            const userRef = firestore.collection("users").doc(authUser.uid);
            
            if (await userRef.get().then(doc => doc.exists)) {
              await userRef.update({ 
                userId, 
                updatedAt: new Date().toISOString() 
              });
            } else {
              await userRef.set({
                userId,
                username: authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
                email: authUser.email || '',
                xp: 0,
                subscriptionStatus: "not_subscribed",
                createdAt: authUser.metadata.creationTime || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
            console.log(`✅ Generated userId ${userId} for ${authUser.email}`);
          } catch (error) {
            console.error(`❌ Failed to generate userId for ${authUser.email}:`, error);
          }
        }
        
        // CRITICAL: Use Firestore createdAt if available, fallback to Auth metadata
        // This ensures proper sorting by actual registration date
        let createdAt: string;
        if (firestoreData?.createdAt) {
          // Firestore has createdAt - use it (most accurate)
          if (firestoreData.createdAt.toDate) {
            // Firestore Timestamp
            createdAt = firestoreData.createdAt.toDate().toISOString();
          } else {
            // String format
            createdAt = firestoreData.createdAt;
          }
        } else {
          // No Firestore createdAt - use Firebase Auth as fallback
          createdAt = authUser.metadata.creationTime || new Date().toISOString();
          
          // Save this to Firestore for future consistency
          try {
            const userRef = firestore.collection("users").doc(authUser.uid);
            if (await userRef.get().then(doc => doc.exists)) {
              await userRef.update({ 
                createdAt,
                updatedAt: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error(`❌ Failed to save createdAt for ${authUser.email}`);
          }
        }
        
        return {
          id: authUser.uid,
          userId,
          username: firestoreData?.username || authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
          email: authUser.email || 'No email',
          xp: firestoreData?.xp || 0,
          subscriptionStatus: firestoreData?.subscriptionStatus || "not_subscribed",
          subscriptionEndDate: firestoreData?.subscriptionEndDate || null,
          createdAt,
          lastLogin: authUser.metadata.lastSignInTime || null,
        };
      })
    );

    // Apply search filter
    let filteredUsers = allUsers;
    if (search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      
      if (searchType === 'email') {
        filteredUsers = allUsers.filter(user => 
          user.email?.toLowerCase().includes(searchTerm)
        );
      } else if (searchType === 'userId' && /^\d+$/.test(searchTerm)) {
        filteredUsers = allUsers.filter(user => 
          user.userId && user.userId.toString().includes(searchTerm)
        );
      } else if (searchType === 'username') {
        filteredUsers = allUsers.filter(user =>
          user.username?.toLowerCase().includes(searchTerm)
        );
      } else {
        // Auto-detect
        if (searchTerm.includes('@')) {
          filteredUsers = allUsers.filter(user => 
            user.email?.toLowerCase().includes(searchTerm)
          );
        } else if (/^\d+$/.test(searchTerm)) {
          filteredUsers = allUsers.filter(user => 
            user.userId && user.userId.toString().includes(searchTerm)
          );
        } else {
          filteredUsers = allUsers.filter(user =>
            user.id.toLowerCase().includes(searchTerm) ||
            user.username?.toLowerCase().includes(searchTerm)
          );
        }
      }
    }

    // Calculate subscription days left
    const processedUsers = await Promise.all(filteredUsers.map(async (user) => {
      let subscriptionDaysLeft: number | undefined;
      let subscriptionStatus = user.subscriptionStatus || "not_subscribed";
      
      if (user.subscriptionEndDate) {
        const endDate = new Date(user.subscriptionEndDate);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffTime <= 0) {
          if (user.subscriptionStatus === "subscribed") {
            subscriptionStatus = "not_subscribed";
            subscriptionDaysLeft = 0;
            
            try {
              const userRef = firestore.collection("users").doc(user.id);
              await userRef.update({
                subscriptionStatus: "not_subscribed",
                updatedAt: new Date().toISOString(),
              });
            } catch (error) {
              console.warn(`Failed to update expired subscription for user ${user.id}`);
            }
          } else {
            subscriptionStatus = "not_subscribed";
            subscriptionDaysLeft = 0;
          }
        } else {
          subscriptionStatus = "subscribed";
          subscriptionDaysLeft = diffDays;
        }
      }

      return {
        ...user,
        subscriptionStatus,
        subscriptionDaysLeft,
        xp: user.xp || 0
      };
    }));

    // Apply status filter
    if (status !== "all") {
      filteredUsers = processedUsers.filter(user => user.subscriptionStatus === status);
    } else {
      filteredUsers = processedUsers;
    }

    // SORTING - Fixed to properly sort by creation date
    filteredUsers.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortBy === 'createdAt') {
        // Parse dates properly
        const aDate = new Date(a.createdAt);
        const bDate = new Date(b.createdAt);
        
        // Validate dates
        aValue = isNaN(aDate.getTime()) ? 0 : aDate.getTime();
        bValue = isNaN(bDate.getTime()) ? 0 : bDate.getTime();
        
        // Debug log for troubleshooting
        if (sortOrder === 'desc') {
          console.log(`Sorting: ${a.email} (${new Date(aValue).toLocaleDateString()}) vs ${b.email} (${new Date(bValue).toLocaleDateString()})`);
        }
      } else if (sortBy === 'lastLogin') {
        aValue = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        bValue = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
      } else if (sortBy === 'xp') {
        aValue = a.xp || 0;
        bValue = b.xp || 0;
      } else if (sortBy === 'userId') {
        aValue = a.userId || 0;
        bValue = b.userId || 0;
      } else {
        aValue = a.username?.toLowerCase() || '';
        bValue = b.username?.toLowerCase() || '';
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    const totalCount = filteredUsers.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedUsers,
      totalPages,
      currentPage: page,
      totalCount,
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH endpoint stays the same...
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
        const newUserId = await generateUniqueUserId();
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