// app/admin/users/[userId]/actions.ts
"use server";

import { auth, firestore } from "@/firebase/server";
import { revalidatePath } from "next/cache";

interface UpdateUserParams {
  userId: string;
  subscriptionDays?: number;
  xp?: number;
  mode?: "add" | "set";
  authToken: string;
}

export async function updateUser({
  userId,
  subscriptionDays,
  xp,
  mode = "add",
  authToken,
}: UpdateUserParams) {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        success: false,
        error: "Admin access required",
      };
    }

    // Check if user exists in Firebase Auth
    try {
      await auth.getUser(userId);
    } catch (error) {
      return {
        success: false,
        error: "User not found in authentication",
      };
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();

    const updateData: any = {};
    const messages: string[] = [];

    // Update subscription if provided
    if (subscriptionDays !== undefined) {
      if (subscriptionDays === 0) {
        // Remove subscription
        updateData.subscriptionStatus = "not_subscribed";
        updateData.subscriptionEndDate = null;
        updateData.subscriptionStartDate = null;
        messages.push("Subscription removed");
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
          messages.push(`Subscription set to ${subscriptionDays} days`);
        } else {
          // Add mode
          if (currentUserData?.subscriptionStatus === "subscribed" && currentUserData?.subscriptionEndDate) {
            // User has active subscription - add to existing end date
            const currentEndDate = new Date(currentUserData.subscriptionEndDate);
            const now = new Date();
            
            // If subscription hasn't expired, add to end date; otherwise start from now
            if (currentEndDate > now) {
              newEndDate = new Date(currentEndDate);
              newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
              messages.push(`Added ${subscriptionDays} days to existing subscription`);
            } else {
              newEndDate = new Date();
              newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
              messages.push(`Started new ${subscriptionDays}-day subscription`);
            }
          } else {
            // No active subscription - start from now
            newEndDate = new Date();
            newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
            messages.push(`Started new ${subscriptionDays}-day subscription`);
          }
          
          updateData.subscriptionStatus = "subscribed";
          updateData.subscriptionEndDate = newEndDate.toISOString();
          
          // Set start date only if it's a new subscription
          if (!currentUserData?.subscriptionStartDate || currentUserData?.subscriptionStatus !== "subscribed") {
            updateData.subscriptionStartDate = new Date().toISOString();
          }
        }
      }
    }

    // Update XP if provided
    if (xp !== undefined) {
      updateData.xp = Math.max(0, xp);
      messages.push(`XP updated to ${xp.toLocaleString()}`);
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

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");

    return {
      success: true,
      message: messages.join(" and ") || "User updated successfully",
    };

  } catch (error) {
    console.error("Error updating user:", error);
    return {
      success: false,
      error: "Internal server error",
    };
  }
}

export async function getUser(userId: string, authToken: string) {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        success: false,
        error: "Admin access required",
      };
    }

    // Get user from Firebase Authentication
    let authUser;
    try {
      authUser = await auth.getUser(userId);
    } catch (error) {
      return {
        success: false,
        error: "User not found in authentication",
      };
    }

    // Get user document from Firestore
    const userDocRef = firestore.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    const firestoreData = userDoc.exists ? userDoc.data() : {};

    // Combine auth and firestore data
    const userData = {
      id: authUser.uid,
      username: firestoreData?.username || authUser.displayName || authUser.email?.split('@')[0] || 'Unknown',
      email: authUser.email || 'No email',
      xp: firestoreData?.xp || 0,
      subscriptionStatus: firestoreData?.subscriptionStatus || "not_subscribed",
      subscriptionEndDate: firestoreData?.subscriptionEndDate || null,
      subscriptionStartDate: firestoreData?.subscriptionStartDate || null,
      createdAt: authUser.metadata.creationTime || new Date().toISOString(),
      lastLogin: authUser.metadata.lastSignInTime || null,
    };

    // Calculate subscription days left
    let subscriptionDaysLeft: number | undefined;
    if (userData.subscriptionEndDate) {
      const endDate = new Date(userData.subscriptionEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffTime <= 0) {
        userData.subscriptionStatus = "not_subscribed";
        subscriptionDaysLeft = 0;
      } else {
        userData.subscriptionStatus = "subscribed";
        subscriptionDaysLeft = diffDays;
      }
    }

    return {
      success: true,
      data: {
        ...userData,
        subscriptionDaysLeft,
      },
    };

  } catch (error) {
    console.error("Error fetching user:", error);
    return {
      success: false,
      error: "Internal server error",
    };
  }
}