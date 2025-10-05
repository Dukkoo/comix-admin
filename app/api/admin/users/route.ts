// app/api/admin/users/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

interface UserData {
  id: string;
  userId?: number; // 5 оронтой ID
  username: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string;
  createdAt: any;
  lastLogin?: any;
}

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get all users from Firebase Authentication
    const authUsers = await auth.listUsers(1000); // Get up to 1000 users
    
    // Get all user documents from Firestore
    const userDocsSnapshot = await firestore.collection("users").get();
    const userDocs: { [key: string]: any } = {};
    userDocsSnapshot.docs.forEach(doc => {
      userDocs[doc.id] = doc.data();
    });

    // Combine auth users with Firestore data
    let allUsers: UserData[] = authUsers.users.map(authUser => {
      const firestoreData = userDocs[authUser.uid] || {};
      
      return {
        id: authUser.uid,
        userId: firestoreData?.userId, // 5 оронтой ID
        username: firestoreData?.username || authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
        email: authUser.email || 'No email',
        xp: firestoreData?.xp || 0,
        subscriptionStatus: firestoreData?.subscriptionStatus || "not_subscribed",
        subscriptionEndDate: firestoreData?.subscriptionEndDate || null,
        createdAt: authUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: authUser.metadata.lastSignInTime || null,
      };
    });

    // Apply search filter
    if (search.trim()) {
      const searchTerm = search.toLowerCase();
      const searchNumber = parseInt(search);
      
      allUsers = allUsers.filter(user => {
        // Хэрэв тоо бол userId-аар хайна
        if (!isNaN(searchNumber) && user.userId) {
          return user.userId === searchNumber;
        }
        
        // Биш бол Firebase UID, нэр, имэйлээр хайна
        return user.id.toLowerCase().includes(searchTerm) ||
               user.username?.toLowerCase().includes(searchTerm) ||
               user.email?.toLowerCase().includes(searchTerm);
      });
    }

    // Calculate subscription days left for each user and auto-update expired ones
    const processedUsers = await Promise.all(allUsers.map(async (user) => {
      let subscriptionDaysLeft: number | undefined;
      let subscriptionStatus = user.subscriptionStatus || "not_subscribed";
      let needsUpdate = false;
      
      if (user.subscriptionEndDate) {
        const endDate = new Date(user.subscriptionEndDate);
        const now = new Date();
        
        // Calculate the exact time difference
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffTime <= 0) {
          // Subscription has expired (exact time passed)
          if (user.subscriptionStatus === "subscribed") {
            // User was subscribed but now expired - update in database
            needsUpdate = true;
            subscriptionStatus = "not_subscribed";
            subscriptionDaysLeft = 0;
            
            // Update in Firestore
            try {
              const userRef = firestore.collection("users").doc(user.id);
              await userRef.update({
                subscriptionStatus: "not_subscribed",
                updatedAt: new Date(),
              });
            } catch (error) {
              console.warn(`Failed to update expired subscription for user ${user.id}:`, error);
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
      const filteredUsers = processedUsers.filter(user => user.subscriptionStatus === status);
      const totalCount = filteredUsers.length;
      const totalPages = Math.ceil(totalCount / limit);
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      return NextResponse.json({
        data: paginatedUsers,
        totalPages,
        currentPage: page,
        totalCount,
      });
    }

    const totalCount = processedUsers.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Apply pagination
    const paginatedUsers = processedUsers.slice(offset, offset + limit);

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

// Update user subscription
export async function PATCH(request: NextRequest) {
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

    const { userId, subscriptionDays, xp, mode } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user exists in Firebase Auth
    try {
      await auth.getUser(userId);
    } catch (error) {
      return NextResponse.json(
        { error: "User not found in authentication" },
        { status: 404 }
      );
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();

    const updateData: any = {};

    // Update subscription if provided
    if (subscriptionDays !== undefined) {
      if (subscriptionDays === 0) {
        // Remove subscription
        updateData.subscriptionStatus = "not_subscribed";
        updateData.subscriptionEndDate = null;
        updateData.subscriptionStartDate = null;
      } else {
        // Get current user data to check existing subscription
        const currentUserData = userDoc.exists ? userDoc.data() : {};
        let newEndDate: Date;

        if (mode === "set") {
          // Set total mode - always start from now regardless of existing subscription
          newEndDate = new Date();
          newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
          
          updateData.subscriptionStatus = "subscribed";
          updateData.subscriptionEndDate = newEndDate.toISOString();
          updateData.subscriptionStartDate = new Date().toISOString();
        } else {
          // Add/Remove mode
          if (subscriptionDays > 0) {
            // Adding days - check if user has existing subscription
            if (currentUserData?.subscriptionStatus === "subscribed" && currentUserData?.subscriptionEndDate) {
              // User has active subscription - add to existing end date
              const currentEndDate = new Date(currentUserData.subscriptionEndDate);
              const now = new Date();
              
              // If subscription hasn't expired, add to end date; otherwise start from now
              if (currentEndDate > now) {
                newEndDate = new Date(currentEndDate);
                newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
              } else {
                newEndDate = new Date();
                newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
              }
            } else {
              // No active subscription - start from now
              newEndDate = new Date();
              newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
            }
            
            updateData.subscriptionStatus = "subscribed";
            updateData.subscriptionEndDate = newEndDate.toISOString();
            
            // Set start date only if it's a new subscription
            if (!currentUserData?.subscriptionStartDate || currentUserData?.subscriptionStatus !== "subscribed") {
              updateData.subscriptionStartDate = new Date().toISOString();
            }
          } else {
            // Negative days - subtract from existing subscription
            if (currentUserData?.subscriptionEndDate) {
              newEndDate = new Date(currentUserData.subscriptionEndDate);
              newEndDate.setDate(newEndDate.getDate() + subscriptionDays); // subscriptionDays is negative
              
              // If the new end date is in the past, set to not subscribed
              if (newEndDate <= new Date()) {
                updateData.subscriptionStatus = "not_subscribed";
                updateData.subscriptionEndDate = null;
                updateData.subscriptionStartDate = null;
              } else {
                updateData.subscriptionStatus = "subscribed";
                updateData.subscriptionEndDate = newEndDate.toISOString();
              }
            } else {
              // No existing subscription to subtract from
              updateData.subscriptionStatus = "not_subscribed";
              updateData.subscriptionEndDate = null;
              updateData.subscriptionStartDate = null;
            }
          }
        }
      }
    }

    // Update XP if provided
    if (xp !== undefined) {
      updateData.xp = Math.max(0, xp); // Ensure XP is not negative
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      
      if (userDoc.exists) {
        // Update existing document
        await userRef.update(updateData);
      } else {
        // Create new document if it doesn't exist
        const authUser = await auth.getUser(userId);
        await userRef.set({
          username: authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
          email: authUser.email || '',
          xp: 0,
          subscriptionStatus: "not_subscribed",
          createdAt: new Date(),
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}