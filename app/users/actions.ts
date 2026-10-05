// app/admin/users/actions.ts
"use server";

import { auth, firestore } from "@/firebase/server";

// "use server" файлаас зөвхөн async функц export хийж болно.
// Доорх тогтмол, туслах функцүүд нь export хийгдээгүй тул асуудалгүй.
const MAX_SUBSCRIPTION_DAYS = 3650; // 10 жил
const MAX_XP = 1_000_000_000;

/** Token хүчинтэй бөгөөд `admin` claim-тэй эсэхийг шалгана. Буруу token бол false. */
const isAdmin = async (authToken: string): Promise<boolean> => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);
    return Boolean(verifiedToken.admin);
  } catch {
    return false;
  }
};

/** Firestore update() нь document байхгүй үед NOT_FOUND (code 5) алдаа шиддэг. */
const isNotFound = (error: any) => error?.code === 5 || error?.code === "not-found";

export const updateUserSubscription = async (
  userId: string,
  subscriptionDays: number,
  authToken: string
) => {
  try {
    if (!(await isAdmin(authToken))) {
      return { error: true, message: "Unauthorized access" };
    }

    if (!userId || typeof userId !== "string") {
      return { error: true, message: "Invalid user" };
    }

    // NaN, сөрөг, бутархай, хэт том утгыг хаана.
    // (Өмнө нь NaN орвол эрх чимээгүй цуцлагддаг байсан.)
    if (
      !Number.isInteger(subscriptionDays) ||
      subscriptionDays < 0 ||
      subscriptionDays > MAX_SUBSCRIPTION_DAYS
    ) {
      return { error: true, message: "Invalid subscription days" };
    }

    let updateData: Record<string, unknown>;

    if (subscriptionDays > 0) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + subscriptionDays);

      updateData = {
        subscriptionStatus: "subscribed",
        subscriptionEndDate: endDate.toISOString(),
        updatedAt: new Date(),
      };
    } else {
      // 0 = эрхийг цуцлах
      updateData = {
        subscriptionStatus: "not_subscribed",
        subscriptionEndDate: null,
        updatedAt: new Date(),
      };
    }

    // Өмнөх get() хэрэггүй: document байхгүй бол update() өөрөө NOT_FOUND шиднэ (1 read хэмнэнэ)
    await firestore.collection("users").doc(userId).update(updateData);

    return { error: false, message: "User subscription updated successfully" };
  } catch (error: any) {
    if (isNotFound(error)) {
      return { error: true, message: "User not found" };
    }
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
    if (!(await isAdmin(authToken))) {
      return { error: true, message: "Unauthorized access" };
    }

    if (!userId || typeof userId !== "string") {
      return { error: true, message: "Invalid user" };
    }

    // Math.max(0, NaN) нь NaN буцаадаг тул заавал эхлээд шалгана
    if (!Number.isFinite(xpAmount) || xpAmount > MAX_XP) {
      return { error: true, message: "Invalid XP amount" };
    }

    await firestore
      .collection("users")
      .doc(userId)
      .update({
        xp: Math.max(0, Math.round(xpAmount)),
        updatedAt: new Date(),
      });

    return { error: false, message: "User XP updated successfully" };
  } catch (error: any) {
    if (isNotFound(error)) {
      return { error: true, message: "User not found" };
    }
    console.error("Error updating user XP:", error);
    return { error: true, message: "Failed to update user XP" };
  }
};

// ========================================
// count() aggregation: бүх document татахаас хамаагүй хямд.
// Зардал: таарсан индексийн 1000 бичлэг тутамд 1 read (хамгийн багадаа 1).
// ========================================
export const getUserStats = async (authToken: string) => {
  try {
    if (!(await isAdmin(authToken))) {
      return { error: true, message: "Unauthorized access" };
    }

    const [totalSnapshot, subscribedSnapshot] = await Promise.all([
      firestore.collection("users").count().get(),
      firestore
        .collection("users")
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