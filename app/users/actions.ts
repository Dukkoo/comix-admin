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
      return {
        error: true,
        message: "Unauthorized access",
      };
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return {
        error: true,
        message: "User not found",
      };
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

    await userRef.update(updateData);

    revalidatePath("/admin/users");

    return {
      error: false,
      message: "User subscription updated successfully",
    };
  } catch (error: any) {
    console.error("Error updating user subscription:", error);
    return {
      error: true,
      message: "Failed to update user subscription",
    };
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
      return {
        error: true,
        message: "Unauthorized access",
      };
    }

    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return {
        error: true,
        message: "User not found",
      };
    }

    await userRef.update({
      xp: Math.max(0, xpAmount),
      updatedAt: new Date(),
    });

    revalidatePath("/admin/users");

    return {
      error: false,
      message: "User XP updated successfully",
    };
  } catch (error: any) {
    console.error("Error updating user XP:", error);
    return {
      error: true,
      message: "Failed to update user XP",
    };
  }
};

export const getUserStats = async (authToken: string) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized access",
      };
    }

    const usersSnapshot = await firestore.collection("users").get();
    const users = usersSnapshot.docs.map(doc => doc.data());

    const stats = {
      totalUsers: users.length,
      subscribedUsers: users.filter(u => u.subscriptionStatus === "subscribed").length,
      notSubscribedUsers: users.filter(u => u.subscriptionStatus === "not_subscribed" || !u.subscriptionStatus).length,
    };

    return {
      error: false,
      data: stats,
    };
  } catch (error: any) {
    console.error("Error fetching user stats:", error);
    return {
      error: true,
      message: "Failed to fetch user stats",
    };
  }
};