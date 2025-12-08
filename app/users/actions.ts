// app/admin/users/actions.ts
"use server";

import { auth, firestore } from "@/firebase/server";
import { revalidatePath } from "next/cache";

export const updateUserSubscription = async (
  userId: string,
  subscriptionDays: number,
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return { error: true, message: "Unauthorized access" };
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get(); // 1 read

    if (!userDoc.exists) {
      return { error: true, message: "User not found" };
    }

    let updateData: any = {};

    if (subscriptionDays > 0) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + subscriptionDays);
      
      updateData = {
        subscriptionStatus: "subscribed",
        subscriptionEndDate: endDate.toISOString(),
        updatedAt: new Date(),
      };
    } else {
      updateData = {
        subscriptionStatus: "not_subscribed",
        subscriptionEndDate: null,
        updatedAt: new Date(),
      };
    }

    await userRef.update(updateData); // 1 write

    revalidatePath("/admin/users");

    return { error: false, message: "User subscription updated successfully" };
  } catch (error: any) {
    console.error("Error updating user subscription:", error);
    return { error: true, message: "Failed to update user subscription" };
  }
};

export const updateUserXP = async (
  userId: string,
  xpAmount: number,
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return { error: true, message: "Unauthorized access" };
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get(); // 1 read

    if (!userDoc.exists) {
      return { error: true, message: "User not found" };
    }

    await userRef.update({
      xp: Math.max(0, xpAmount),
      updatedAt: new Date(),
    }); // 1 write

    revalidatePath("/admin/users");

    return { error: false, message: "User XP updated successfully" };
  } catch (error: any) {
    console.error("Error updating user XP:", error);
    return { error: true, message: "Failed to update user XP" };
  }
};

// ========================================
// OPTIMIZED: count() query ашиглах (3 reads only!)
// ========================================
export const getUserStats = async (authToken: string) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return { error: true, message: "Unauthorized access" };
    }

    // Count queries - 1 read тус бүр
    const [totalSnapshot, subscribedSnapshot] = await Promise.all([
      firestore.collection("users").count().get(),
      firestore.collection("users")
        .where("subscriptionStatus", "==", "subscribed")
        .count()
        .get(),
    ]);

    const totalUsers = totalSnapshot.data().count;
    const subscribedUsers = subscribedSnapshot.data().count;

    const stats = {
      totalUsers,
      subscribedUsers,
      notSubscribedUsers: totalUsers - subscribedUsers,
    };

    return { error: false, data: stats };
  } catch (error: any) {
    console.error("Error fetching user stats:", error);
    return { error: true, message: "Failed to fetch user stats" };
  }
};