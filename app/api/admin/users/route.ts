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

    // ========================================
    // OPTIMIZATION 1: Firestore Query-based Pagination
    // Зөвхөн хэрэгтэй хуудасны өгөгдлийг унших
    // ========================================
    
    let firestoreQuery = firestore.collection("users");
    
    // Apply status filter at query level
    if (status !== "all") {
      firestoreQuery = firestoreQuery.where("subscriptionStatus", "==", status) as any;
    }
    
    // Apply sorting
    const firestoreSortBy = sortBy === 'username' ? 'username' : 
                           sortBy === 'xp' ? 'xp' : 
                           sortBy === 'userId' ? 'userId' : 'createdAt';
    
    firestoreQuery = firestoreQuery.orderBy(firestoreSortBy, sortOrder as any) as any;
    
    // ========================================
    // OPTIMIZATION 2: Search Handling
    // Хайлт хийхдээ зөвхөн шаардлагатай документүүдийг унших
    // ========================================
    
    let searchResults: string[] | null = null;
    
    if (search.trim()) {
      const searchTerm = search.trim(); // Keep original case
      
      // Email search - use client-side filtering for case-insensitive
      if (searchType === 'email' || (!searchType && searchTerm.includes('@'))) {
        const allUsersQuery = await firestore
          .collection("users")
          .limit(1000)
          .get();
        
        const matchedUsers = allUsersQuery.docs.filter(doc => {
          const email = doc.data().email || '';
          return email.toLowerCase().includes(searchTerm.toLowerCase());
        });
        
        searchResults = matchedUsers.map(doc => doc.id);
        console.log(`Email search: "${searchTerm}" found ${searchResults.length} results`);
      }
      // UserId search - exact match works fine
      else if (searchType === 'userId' || (!searchType && /^\d+$/.test(searchTerm))) {
        const userIdNum = parseInt(searchTerm);
        const userIdQuery = await firestore
          .collection("users")
          .where("userId", "==", userIdNum)
          .limit(100)
          .get();
        
        searchResults = userIdQuery.docs.map(doc => doc.id);
        console.log(`UserId search: ${userIdNum} found ${searchResults.length} results`);
      }
      // Username search - use client-side filtering
      else if (searchType === 'username' || !searchType) {
        const allUsersQuery = await firestore
          .collection("users")
          .limit(1000)
          .get();
        
        const matchedUsers = allUsersQuery.docs.filter(doc => {
          const username = doc.data().username || '';
          return username.toLowerCase().includes(searchTerm.toLowerCase());
        });
        
        searchResults = matchedUsers.map(doc => doc.id);
        console.log(`Username search: "${searchTerm}" found ${searchResults.length} results`);
      }
      
      // If no results from search, return empty
      if (searchResults && searchResults.length === 0) {
        return NextResponse.json({
          data: [],
          totalPages: 0,
          currentPage: page,
          totalCount: 0,
        });
      }
    }
    
    // ========================================
    // OPTIMIZATION 3: Pagination with limit
    // Зөвхөн одоогийн хуудасны өгөгдөл + нийт тоо
    // ========================================
    
    // Get total count efficiently
    let totalCount = 0;
    if (searchResults) {
      totalCount = searchResults.length;
    } else {
      // Use count query (1 read only)
      const countQuery = status !== "all" 
        ? firestore.collection("users").where("subscriptionStatus", "==", status)
        : firestore.collection("users");
      
      const countSnapshot = await countQuery.count().get();
      totalCount = countSnapshot.data().count;
    }
    
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    
    // Get paginated documents
    let userDocs;
    
    if (searchResults) {
      // For search results, fetch specific documents by ID
      const paginatedIds = searchResults.slice(offset, offset + limit);
      const docPromises = paginatedIds.map(id => 
        firestore.collection("users").doc(id).get()
      );
      const docs = await Promise.all(docPromises);
      userDocs = docs.filter(doc => doc.exists);
    } else {
      // For non-search, use normal query
      let paginatedQuery = firestoreQuery.limit(limit);
      
      if (offset > 0) {
        paginatedQuery = paginatedQuery.offset(offset) as any;
      }
      
      const snapshot = await paginatedQuery.get();
      userDocs = snapshot.docs;
    }
    // ========================================
    // OPTIMIZATION 4: Batch Auth User Fetching
    // Auth.getUser()-г зөвхөн шаардлагатай үед дуудах
    // ========================================
    
    const userIds = userDocs.map(doc => doc.id);
    
    // Fetch auth users in batch (more efficient than individual calls)
    const authUsersPromises = userIds.map(async (uid) => {
      try {
        return await auth.getUser(uid);
      } catch (error) {
        console.error(`Failed to fetch auth user ${uid}:`, error);
        return null;
      }
    });
    
    const authUsers = await Promise.all(authUsersPromises);
    
    // ========================================
    // OPTIMIZATION 5: Process Users Without Extra Writes
    // userId үүсгэхийг хойшлуулах, зөвхөн уншихад анхаарах
    // ========================================
    
    const processedUsers: (UserData | null)[] = await Promise.all(
      userDocs.map(async (doc, index) => {
        const firestoreData = doc.data();
        const authUser = authUsers[index];
        
        if (!authUser) {
          return null;
        }
        
        // Use Firestore createdAt if available
        let createdAt: string;
        if (firestoreData?.createdAt) {
          if (firestoreData.createdAt.toDate) {
            createdAt = firestoreData.createdAt.toDate().toISOString();
          } else {
            createdAt = firestoreData.createdAt;
          }
        } else {
          createdAt = authUser.metadata.creationTime || new Date().toISOString();
        }
        
        // Calculate subscription days left
        let subscriptionDaysLeft: number | undefined;
        let subscriptionStatus = firestoreData?.subscriptionStatus || "not_subscribed";
        
        if (firestoreData?.subscriptionEndDate) {
          const endDate = new Date(firestoreData.subscriptionEndDate);
          const now = new Date();
          const diffTime = endDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffTime <= 0) {
            subscriptionStatus = "not_subscribed";
            subscriptionDaysLeft = 0;
            
            // Mark for update in background (don't await)
            if (firestoreData.subscriptionStatus === "subscribed") {
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
          id: authUser.uid,
          userId: firestoreData?.userId || undefined,
          username: firestoreData?.username || authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
          email: authUser.email || 'No email',
          xp: firestoreData?.xp || 0,
          subscriptionStatus,
          subscriptionEndDate: firestoreData?.subscriptionEndDate || null,
          subscriptionDaysLeft,
          createdAt,
          lastLogin: authUser.metadata.lastSignInTime || null,
        };
      })
    );
    
    // Filter out null values
    const validUsers = processedUsers.filter(user => user !== null) as UserData[];

    return NextResponse.json({
      data: validUsers,
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