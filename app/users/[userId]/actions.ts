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

    if (subscriptionDays !== undefined) {
      if (subscriptionDays === 0) {
        updateData.subscriptionStatus = "not_subscribed";
        updateData.subscriptionEndDate = null;
        updateData.subscriptionStartDate = null;
        messages.push("Subscription removed");
      } else {
        const currentUserData = userDoc.exists ? userDoc.data() : {};
        let newEndDate: Date;

        if (mode === "set") {
          newEndDate = new Date();
          newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
          
          updateData.subscriptionStatus = "subscribed";
          updateData.subscriptionEndDate = newEndDate.toISOString();
          updateData.subscriptionStartDate = new Date().toISOString();
          messages.push(`Subscription set to ${subscriptionDays} days`);
        } else {
          if (currentUserData?.subscriptionStatus === "subscribed" && currentUserData?.subscriptionEndDate) {
            const currentEndDate = new Date(currentUserData.subscriptionEndDate);
            const now = new Date();
            
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
            newEndDate = new Date();
            newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
            messages.push(`Started new ${subscriptionDays}-day subscription`);
          }
          
          updateData.subscriptionStatus = "subscribed";
          updateData.subscriptionEndDate = newEndDate.toISOString();
          
          if (!currentUserData?.subscriptionStartDate || currentUserData?.subscriptionStatus !== "subscribed") {
            updateData.subscriptionStartDate = new Date().toISOString();
          }
        }
      }
    }

    if (xp !== undefined) {
      updateData.xp = Math.max(0, xp);
      messages.push(`XP updated to ${xp.toLocaleString()}`);
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      
      if (userDoc.exists) {
        await userRef.update(updateData);
      } else {
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

    let authUser;
    try {
      authUser = await auth.getUser(userId);
    } catch (error) {
      return {
        success: false,
        error: "User not found in authentication",
      };
    }

    const userDocRef = firestore.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    const firestoreData = userDoc.exists ? userDoc.data() : {};

    // ========================================
    // Get devices from Firestore user document
    // Supports both: devices array (REST API) OR devices subcollection
    // ========================================
    let devices: any[] = [];
    let deviceCount = 0;
    
    // Option 1: From user document devices array (REST API structure)
    if (firestoreData?.devices && Array.isArray(firestoreData.devices)) {
      devices = firestoreData.devices;
      deviceCount = devices.length;
    }
    // Option 2: From devices subcollection (current structure)
    else {
      const devicesSnapshot = await firestore
        .collection("users")
        .doc(userId)
        .collection("devices")
        .get();
      
      devices = devicesSnapshot.docs.map((doc) => ({
        deviceId: doc.id,
        ...doc.data(),
      }));
      deviceCount = devices.length;
    }

    // ========================================
    // Get ban info (banned field in user doc)
    // ========================================
    let banned = firestoreData?.banned || false;
    let banExpiry = firestoreData?.banExpiry || null;
    let banReason = firestoreData?.banReason || "";

    // Check if ban expired
    if (banned && banExpiry) {
      const expiryDate = new Date(banExpiry);
      if (expiryDate <= new Date()) {
        // Auto unban
        await userDocRef.update({
          banned: false,
          banExpiry: null,
          banReason: "",
        });
        banned = false;
        banExpiry = null;
        banReason = "";
      }
    }

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
      devices,
      deviceCount,
      banned,
      banExpiry,
      banReason,
      userId: firestoreData?.userId,
    };

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

export async function removeDevice(userId: string, deviceId: string, authToken: string) {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        success: false,
        error: "Admin access required",
      };
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const userData = userDoc.data();
    
    // Check if devices is an array (REST API structure)
    if (userData?.devices && Array.isArray(userData.devices)) {
      // Remove from array
      const updatedDevices = userData.devices.filter(
        (d: any) => d.deviceId !== deviceId
      );
      
      await userRef.update({
        devices: updatedDevices,
        deviceCount: updatedDevices.length,
      });
    } else {
      // Remove from subcollection
      await firestore
        .collection("users")
        .doc(userId)
        .collection("devices")
        .doc(deviceId)
        .delete();
    }

    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: "Device removed successfully",
    };

  } catch (error) {
    console.error("Error removing device:", error);
    return {
      success: false,
      error: "Failed to remove device",
    };
  }
}

// ========================================
// NEW: Ban user action
// ========================================
export async function banUser(userId: string, days: number, reason: string, authToken: string) {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        success: false,
        error: "Admin access required",
      };
    }

    const banExpiry = new Date();
    banExpiry.setDate(banExpiry.getDate() + days);

    await firestore.collection("users").doc(userId).update({
      banned: true,
      banExpiry: banExpiry.toISOString(),
      banReason: reason,
      bannedAt: new Date().toISOString(),
      bannedBy: verifiedToken.uid,
    });

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");

    return {
      success: true,
      message: `User banned for ${days} days`,
    };

  } catch (error) {
    console.error("Error banning user:", error);
    return {
      success: false,
      error: "Failed to ban user",
    };
  }
}

// ========================================
// NEW: Unban user action
// ========================================
export async function unbanUser(userId: string, authToken: string) {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        success: false,
        error: "Admin access required",
      };
    }

    await firestore.collection("users").doc(userId).update({
      banned: false,
      banExpiry: null,
      banReason: "",
      unbannedAt: new Date().toISOString(),
      unbannedBy: verifiedToken.uid,
    });

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");

    return {
      success: true,
      message: "User unbanned successfully",
    };

  } catch (error) {
    console.error("Error unbanning user:", error);
    return {
      success: false,
      error: "Failed to unban user",
    };
  }
}

// Keep the old unsuspendUser for backwards compatibility
export async function unsuspendUser(userId: string, authToken: string) {
  return unbanUser(userId, authToken);
}