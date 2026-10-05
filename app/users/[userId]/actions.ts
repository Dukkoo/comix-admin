// app/users/[userId]/actions.ts
"use server";

import { auth, firestore } from "@/firebase/server";

// "use server" файлаас зөвхөн async функц export хийж болно.
// Доорх тогтмол, туслах функцүүд нь export хийгдээгүй тул асуудалгүй.
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BAN_DAYS = 365;
const MAX_REASON_LENGTH = 200;

// Бүх action нэг ижил хэлбэртэй хариу буцаана. Ингэснээр хуудас талд
// result.data / result.error / result.message-д TypeScript алдаагүй хандана.
interface ActionResult<T = never> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

interface UserDetail {
  id: string;
  userId?: number;
  username: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionEndDate: string | null;
  subscriptionStartDate: string | null;
  subscriptionDaysLeft?: number;
  createdAt: string;
  lastLogin: string | null;
  devices: any[];
  deviceCount: number;
  banned: boolean;
  banExpiry: string | null;
  banReason: string;
}

interface AdminToken {
  uid: string;
  email?: string;
  [key: string]: any;
}

/** Token хүчинтэй бөгөөд `admin` claim-тэй бол token-г, үгүй бол null буцаана. */
const verifyAdmin = async (authToken: string, checkRevoked = false): Promise<AdminToken | null> => {
  try {
    const decoded = await auth.verifyIdToken(authToken, checkRevoked);
    return decoded.admin ? (decoded as AdminToken) : null;
  } catch {
    return null;
  }
};

const isValidId = (id: unknown): id is string =>
  typeof id === "string" && id.trim() !== "" && !id.includes("/");

const isNotFound = (error: any) => error?.code === 5 || error?.code === "not-found";

const newAuditRef = () => firestore.collection("adminAuditLogs").doc();

const UNAUTHORIZED: ActionResult = { success: false, error: "Admin access required" };

// ========================================
// Хэрэглэгчийн мэдээлэл унших
// ========================================
export async function getUser(userId: string, authToken: string): Promise<ActionResult<UserDetail>> {
  try {
    if (!(await verifyAdmin(authToken))) return UNAUTHORIZED;
    if (!isValidId(userId)) return { success: false, error: "Invalid user" };

    let authUser;
    try {
      authUser = await auth.getUser(userId);
    } catch (error: any) {
      if (error?.code === "auth/user-not-found") {
        return { success: false, error: "User not found in authentication" };
      }
      throw error;
    }

    const userDocRef = firestore.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    const firestoreData = userDoc.exists ? userDoc.data() : {};

    // ========================================
    // Төхөөрөмжүүд: user document доторх devices массив ЭСВЭЛ devices дэд collection
    // ========================================
    let devices: any[] = [];

    if (firestoreData?.devices && Array.isArray(firestoreData.devices)) {
      devices = firestoreData.devices;
    } else {
      const devicesSnapshot = await userDocRef.collection("devices").limit(50).get();
      devices = devicesSnapshot.docs.map((doc) => ({
        deviceId: doc.id,
        ...doc.data(),
      }));
    }

    // ========================================
    // Бан: хугацаа нь дууссан бол автоматаар цуцална
    // (client сайт ачаалах бүрдээ banExpiry-г ч шалгадаг байх ёстой)
    // ========================================
    let banned = firestoreData?.banned || false;
    let banExpiry = firestoreData?.banExpiry || null;
    let banReason = firestoreData?.banReason || "";

    if (banned && banExpiry) {
      const expiryMs = Date.parse(banExpiry);
      if (!isNaN(expiryMs) && expiryMs <= Date.now()) {
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

    // ========================================
    // Идэвхтэй эрх: subscriptionStatus == "subscribed" БӨГӨӨД subscriptionEndDate > одоо
    // (dashboard, жагсаалтын API-тай ижил дүрэм)
    // ========================================
    const nowMs = Date.now();
    const endMs = firestoreData?.subscriptionEndDate
      ? Date.parse(firestoreData.subscriptionEndDate)
      : NaN;
    const subscribed =
      firestoreData?.subscriptionStatus === "subscribed" && !isNaN(endMs) && endMs > nowMs;

    return {
      success: true,
      data: {
        id: authUser.uid,
        username:
          firestoreData?.username || authUser.displayName || authUser.email?.split("@")[0] || "Unknown",
        email: authUser.email || "No email",
        xp: firestoreData?.xp || 0,
        subscriptionStatus: subscribed ? "subscribed" : "not_subscribed",
        subscriptionEndDate: firestoreData?.subscriptionEndDate || null,
        subscriptionStartDate: firestoreData?.subscriptionStartDate || null,
        subscriptionDaysLeft: subscribed ? Math.ceil((endMs - nowMs) / DAY_MS) : undefined,
        createdAt: authUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: authUser.metadata.lastSignInTime || null,
        devices,
        deviceCount: devices.length,
        banned,
        banExpiry,
        banReason,
        userId: firestoreData?.userId,
      },
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return { success: false, error: "Internal server error" };
  }
}

// ========================================
// Төхөөрөмж устгах
// ========================================
// Массив хэлбэрийн devices-ийг "уншаад, шүүгээд, бичих" үед client сайт зэрэг төхөөрөмж
// нэмбэл алдагдахаас сэргийлж transaction ашиглана.
export async function removeDevice(
  userId: string,
  deviceId: string,
  authToken: string
): Promise<ActionResult> {
  try {
    const admin = await verifyAdmin(authToken, true);
    if (!admin) return UNAUTHORIZED;
    if (!isValidId(userId) || !isValidId(deviceId)) {
      return { success: false, error: "Invalid request" };
    }

    const userRef = firestore.collection("users").doc(userId);

    const outcome = await firestore.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return "not_found" as const;

      const devices = userSnap.data()?.devices;
      if (Array.isArray(devices)) {
        const updated = devices.filter((d: any) => d.deviceId !== deviceId);
        tx.update(userRef, { devices: updated, deviceCount: updated.length });
      } else {
        tx.delete(userRef.collection("devices").doc(deviceId));
      }

      tx.set(newAuditRef(), {
        at: new Date(),
        action: "remove_device",
        adminUid: admin.uid,
        adminEmail: admin.email ?? null,
        targetUserId: userId,
        details: { deviceId },
      });

      return "ok" as const;
    });

    if (outcome === "not_found") {
      return { success: false, error: "User not found" };
    }

    return { success: true, message: "Device removed successfully" };
  } catch (error) {
    console.error("Error removing device:", error);
    return { success: false, error: "Failed to remove device" };
  }
}

// ========================================
// Бан өгөх
// ========================================
export async function banUser(
  userId: string,
  days: number,
  reason: string,
  authToken: string
): Promise<ActionResult> {
  try {
    const admin = await verifyAdmin(authToken, true);
    if (!admin) return UNAUTHORIZED;
    if (!isValidId(userId)) return { success: false, error: "Invalid user" };

    // NaN, сөрөг, бутархай, хэт том хугацааг хаана
    // (өмнө нь сөрөг хоног нь "бан"-г шууд дууссан болгодог байсан)
    if (!Number.isInteger(days) || days < 1 || days > MAX_BAN_DAYS) {
      return { success: false, error: "Invalid ban duration" };
    }

    const cleanReason = typeof reason === "string" ? reason.trim().slice(0, MAX_REASON_LENGTH) : "";

    // Өөрийгөө болон бусад админыг бан хийхийг хориглоно
    if (userId === admin.uid) {
      return { success: false, error: "Cannot ban yourself" };
    }

    let target;
    try {
      target = await auth.getUser(userId);
    } catch (error: any) {
      if (error?.code === "auth/user-not-found") {
        return { success: false, error: "User not found" };
      }
      throw error;
    }
    if (target.customClaims?.admin) {
      return { success: false, error: "Cannot ban an admin" };
    }

    const now = new Date();
    const banExpiry = new Date(now.getTime() + days * DAY_MS);

    const batch = firestore.batch();
    batch.update(firestore.collection("users").doc(userId), {
      banned: true,
      banExpiry: banExpiry.toISOString(),
      banReason: cleanReason,
      bannedAt: now.toISOString(),
      bannedBy: admin.uid,
    });
    batch.set(newAuditRef(), {
      at: now,
      action: "ban",
      adminUid: admin.uid,
      adminEmail: admin.email ?? null,
      targetUserId: userId,
      details: { days, reason: cleanReason, expiresAt: banExpiry.toISOString() },
    });
    await batch.commit();

    // Бан нь Firestore-д тэмдэглэгдэхээс гадна одоо нэвтэрсэн сессүүдийг мөн таслана.
    // (Client сайт хүсэлт бүрт banned/banExpiry-г шалгадаг байх ёстой.)
    try {
      await auth.revokeRefreshTokens(userId);
    } catch (error) {
      console.error("Failed to revoke refresh tokens:", error);
    }

    return { success: true, message: `User banned for ${days} days` };
  } catch (error) {
    if (isNotFound(error)) {
      return { success: false, error: "User not found" };
    }
    console.error("Error banning user:", error);
    return { success: false, error: "Failed to ban user" };
  }
}

// ========================================
// Бан цуцлах
// ========================================
export async function unbanUser(userId: string, authToken: string): Promise<ActionResult> {
  try {
    const admin = await verifyAdmin(authToken, true);
    if (!admin) return UNAUTHORIZED;
    if (!isValidId(userId)) return { success: false, error: "Invalid user" };

    const now = new Date();

    const batch = firestore.batch();
    batch.update(firestore.collection("users").doc(userId), {
      banned: false,
      banExpiry: null,
      banReason: "",
      unbannedAt: now.toISOString(),
      unbannedBy: admin.uid,
    });
    batch.set(newAuditRef(), {
      at: now,
      action: "unban",
      adminUid: admin.uid,
      adminEmail: admin.email ?? null,
      targetUserId: userId,
      details: {},
    });
    await batch.commit();

    return { success: true, message: "User unbanned successfully" };
  } catch (error) {
    if (isNotFound(error)) {
      return { success: false, error: "User not found" };
    }
    console.error("Error unbanning user:", error);
    return { success: false, error: "Failed to unban user" };
  }
}

// Хуучин нэрээр дуудаж байгаа газар байвал ажиллахын тулд үлдээв
export async function unsuspendUser(userId: string, authToken: string): Promise<ActionResult> {
  return unbanUser(userId, authToken);
}