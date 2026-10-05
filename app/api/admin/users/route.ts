// app/api/admin/users/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

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

type Doc = FirebaseFirestore.QueryDocumentSnapshot;
type Query = FirebaseFirestore.Query;

const SEARCH_LIMIT = 100; // хайлтаар хамгийн ихдээ хэдэн үр дүн авах
const MAX_SEARCH_LENGTH = 100;
const MAX_SUBSCRIPTION_DAYS = 3650; // 10 жил
const MAX_XP = 1_000_000_000;
const MIN_USER_ID = 10000;
const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_STATUSES = ["all", "subscribed", "not_subscribed"];

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// ========================================
// ИДЭВХТЭЙ ЭРХИЙН ЯГ ТОДОРХОЙЛОЛТ
// ========================================
// Хэрэглэгч "идэвхтэй" гэдэг нь: subscriptionStatus == "subscribed" БӨГӨӨД
// subscriptionEndDate > одоо. Dashboard-ын (analytics) тоотой яг ижил.
// Жагсаалтын шүүлтүүр, нийт тоо, мөр бүрийн төлөв гурвуулаа энэ дүрмээр тооцогдоно.
const isEffectivelySubscribed = (data: FirebaseFirestore.DocumentData, nowMs: number) => {
  if (data.subscriptionStatus !== "subscribed" || !data.subscriptionEndDate) return false;
  const endMs = Date.parse(data.subscriptionEndDate);
  return !isNaN(endMs) && endMs > nowMs;
};

// ========================================
// Хуудаслалтын туслахууд
// ========================================
const countOf = async (query: Query) => (await query.count().get()).data().count;

const applyPage = (query: Query, limit: number, offset: number) => {
  let q = query.limit(limit);
  if (offset > 0) q = q.offset(offset);
  return q;
};

// orderBy("createdAt") нь createdAt талбаргүй хэрэглэгчийг жагсаалтаас ГАРГАДАГ.
// Тиймээс эрэмбэлсэн тоо нийт тоотой тэнцүү үед л эрэмбэлнэ.
// Composite index байхгүй бол эрэмбэгүй (document ID-аар) буцаана.
async function fetchPage(base: Query, total: number, limit: number, offset: number): Promise<Doc[]> {
  let useOrder = false;
  try {
    const orderedCount = await countOf(base.orderBy("createdAt", "desc"));
    useOrder = orderedCount === total;
    if (!useOrder) {
      console.warn(
        `[admin/users] ${total - orderedCount} хэрэглэгчид createdAt талбар байхгүй тул эрэмбэгүй жагсаалт ашиглаж байна`
      );
    }
  } catch (error: any) {
    console.warn("[admin/users] createdAt эрэмбэ ашиглах боломжгүй (index байхгүй байж магадгүй):", error?.message);
  }

  const query = useOrder ? base.orderBy("createdAt", "desc") : base;
  const snapshot = await applyPage(query, limit, offset).get();
  return snapshot.docs;
}

// ========================================
// userId (5+ оронтой) хуваарилалт
// ========================================
// Өмнөх санамсаргүй сонголт нь 90,000 хэрэглэгчээс хойш бүтэлгүйтэх, мөн хоёр хүсэлт
// зэрэг ирвэл ижил ID өгөх эрсдэлтэй байв. Одоо `counters/users` дахь тоолуурыг
// transaction дотор нэмэгдүүлнэ. Анх удаа ажиллахад одоо байгаа хамгийн их userId-аас
// үргэлжилнэ. Мөн client талын сайт санамсаргүй ID өгдөг тул давхцахгүйг шалгана.
async function allocateUserId(
  tx: FirebaseFirestore.Transaction,
  counterRef: FirebaseFirestore.DocumentReference
): Promise<number> {
  const usersRef = firestore.collection("users");

  const counterSnap = await tx.get(counterRef);
  const saved = counterSnap.exists ? Number(counterSnap.data()?.lastUserId) : NaN;

  let last: number;
  if (Number.isFinite(saved)) {
    last = saved;
  } else {
    const top = await tx.get(usersRef.orderBy("userId", "desc").limit(1));
    const topId = top.empty ? NaN : Number(top.docs[0].data().userId);
    last = Number.isFinite(topId) ? Math.max(topId, MIN_USER_ID - 1) : MIN_USER_ID - 1;
  }

  let candidate = last + 1;
  for (let attempt = 0; attempt < 20; attempt++) {
    const clash = await tx.get(usersRef.where("userId", "==", candidate).limit(1));
    if (clash.empty) break;
    candidate += 1;
  }

  tx.set(counterRef, { lastUserId: candidate });
  return candidate;
}

// ========================================
// Эрх сунгах / багасгах тооцоо (өмнөх логик хэвээр)
// ========================================
const cancelSubscription = () => ({
  subscriptionStatus: "not_subscribed",
  subscriptionEndDate: null,
  subscriptionStartDate: null,
});

const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

function computeSubscriptionUpdate(
  days: number,
  mode: "set" | "add",
  current: FirebaseFirestore.DocumentData,
  now: Date
): Record<string, unknown> {
  // 0 = цуцлах
  if (days === 0) return cancelSubscription();

  // set: одооноос эхлээд яг N хоног
  if (mode === "set") {
    return {
      subscriptionStatus: "subscribed",
      subscriptionEndDate: addDays(now, days).toISOString(),
      subscriptionStartDate: now.toISOString(),
    };
  }

  // add + эерэг: одоо байгаа эрх дуусаагүй бол түүн дээр нь нэмнэ
  if (days > 0) {
    let base = now;
    if (current.subscriptionStatus === "subscribed" && current.subscriptionEndDate) {
      const currentEnd = new Date(current.subscriptionEndDate);
      if (!isNaN(currentEnd.getTime()) && currentEnd > now) base = currentEnd;
    }

    const update: Record<string, unknown> = {
      subscriptionStatus: "subscribed",
      subscriptionEndDate: addDays(base, days).toISOString(),
    };
    if (!current.subscriptionStartDate || current.subscriptionStatus !== "subscribed") {
      update.subscriptionStartDate = now.toISOString();
    }
    return update;
  }

  // add + сөрөг: одоо байгаа эрхээс хасна
  if (current.subscriptionEndDate) {
    const end = addDays(new Date(current.subscriptionEndDate), days);
    if (isNaN(end.getTime()) || end <= now) return cancelSubscription();
    return {
      subscriptionStatus: "subscribed",
      subscriptionEndDate: end.toISOString(),
    };
  }
  return cancelSubscription();
}

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
};

// ========================================
// Хайлт
// ========================================
// Firestore-д "contains" хайлт байхгүй тул prefix (эхлэлээр) хайна
const prefixQuery = (field: string, value: string) =>
  firestore
    .collection("users")
    .where(field, ">=", value)
    .where(field, "<=", value + "\uf8ff")
    .limit(SEARCH_LIMIT);

async function searchUsers(term: string, searchType: string): Promise<Doc[]> {
  const users = firestore.collection("users");

  // 1) ID-аар (яг таарах)
  if (searchType === "userId" || /^\d+$/.test(term)) {
    const snap = await users
      .where("userId", "==", parseInt(term, 10))
      .limit(SEARCH_LIMIT)
      .get();
    return snap.docs;
  }

  // 2) Цахим шуудангаар (эхлэлээр, жижиг үсгээр)
  if (searchType === "email" || term.includes("@")) {
    const snap = await prefixQuery("email", term.toLowerCase()).get();
    return snap.docs;
  }

  // 3) Нэрээр: username эхлэлээр + цахим шууданг эхлэлээр нь зэрэг хайж нэгтгэнэ
  const [byUsername, byEmail] = await Promise.all([
    prefixQuery("username", term).get(),
    prefixQuery("email", term.toLowerCase()).get(),
  ]);

  const merged = new Map<string, Doc>();
  [...byUsername.docs, ...byEmail.docs].forEach((doc) => merged.set(doc.id, doc));
  return Array.from(merged.values());
}

// ========================================
// GET
// ========================================
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25") || 25));
    const search = (searchParams.get("search")?.trim() || "").slice(0, MAX_SEARCH_LENGTH);
    const searchType = searchParams.get("searchType") || "";
    const status = searchParams.get("status") || "all";
    const offset = (page - 1) * limit;

    if (!VALID_STATUSES.includes(status)) {
      return json({ error: "Invalid status" }, 400);
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const usersCol = firestore.collection("users");

    let docs: Doc[];
    let totalCount: number;

    if (search) {
      // ========================================
      // SEARCH: үр дүн цөөн тул төлөвийн шүүлтүүр, хуудаслалтыг санах ойд хийнэ
      // (composite index шаардахгүй). Төлөвийг дээрх "идэвхтэй" дүрмээр шалгана.
      // ========================================
      let found = await searchUsers(search, searchType);

      if (status !== "all") {
        const wantSubscribed = status === "subscribed";
        found = found.filter((doc) => isEffectivelySubscribed(doc.data(), nowMs) === wantSubscribed);
      }

      totalCount = found.length;
      docs = found.slice(offset, offset + limit);
    } else if (status === "all") {
      // ========================================
      // БҮГД
      // ========================================
      totalCount = await countOf(usersCol);
      docs = await fetchPage(usersCol, totalCount, limit, offset);
    } else if (status === "subscribed") {
      // ========================================
      // ИДЭВХТЭЙ: subscriptionStatus == "subscribed" БА subscriptionEndDate > одоо
      // (analytics-ийн тоотой яг ижил). Дуусах огноогоор (удахгүй дуусах нь эхэндээ) эрэмбэлнэ.
      // Index: users -> subscriptionStatus + subscriptionEndDate (analytics-д ашиглагдаж байгаа)
      // ========================================
      const subscribedQuery = () =>
        usersCol
          .where("subscriptionStatus", "==", "subscribed")
          .where("subscriptionEndDate", ">", nowIso);

      totalCount = await countOf(subscribedQuery());
      const snapshot = await applyPage(
        subscribedQuery().orderBy("subscriptionEndDate", "asc"),
        limit,
        offset
      ).get();
      docs = snapshot.docs;
    } else {
      // ========================================
      // ИДЭВХГҮЙ = "бүгд" - "идэвхтэй". Firestore-д "үгүйсгэл" query байхгүй тул хоёр салангид
      // олонлогийг залгаж хуудаслана:
      //   B: төлөв "subscribed" боловч хугацаа нь дууссан (cron хараахан шинэчлээгүй)
      //   A: төлөв "not_subscribed"
      // B эхэнд (саяхан дууссан нь хамгийн сонирхолтой), дараа нь A (шинэ нь эхэндээ).
      // ========================================
      const expiredQuery = () =>
        usersCol
          .where("subscriptionStatus", "==", "subscribed")
          .where("subscriptionEndDate", "<=", nowIso);
      const notSubscribedQuery = () => usersCol.where("subscriptionStatus", "==", "not_subscribed");

      const [expiredCount, notSubscribedCount] = await Promise.all([
        countOf(expiredQuery()),
        countOf(notSubscribedQuery()),
      ]);
      totalCount = expiredCount + notSubscribedCount;

      docs = [];

      if (offset < expiredCount) {
        const snapshot = await applyPage(
          expiredQuery().orderBy("subscriptionEndDate", "desc"),
          Math.min(limit, expiredCount - offset),
          offset
        ).get();
        docs.push(...snapshot.docs);
      }

      const remaining = limit - docs.length;
      if (remaining > 0 && notSubscribedCount > 0) {
        const notSubscribedOffset = Math.max(0, offset - expiredCount);
        docs.push(
          ...(await fetchPage(notSubscribedQuery(), notSubscribedCount, remaining, notSubscribedOffset))
        );
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    // ========================================
    // PROCESS USERS
    // GET дотор Firestore руу бичихгүй. Төлвийг уншихдаа дээрх дүрмээр тооцоолно,
    // харин өгөгдлийн санд шинэчлэх ажлыг /api/cron/expire-subscriptions хийнэ.
    // ========================================
    const users: UserData[] = docs.map((doc) => {
      const data = doc.data();

      let createdAt: string;
      if (data.createdAt) {
        createdAt = data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt;
      } else {
        createdAt = new Date().toISOString();
      }

      const subscribed = isEffectivelySubscribed(data, nowMs);
      const subscriptionDaysLeft = subscribed
        ? Math.ceil((Date.parse(data.subscriptionEndDate) - nowMs) / DAY_MS)
        : undefined;

      return {
        id: doc.id,
        userId: data.userId,
        username:
          data.username || data.displayName || data.name || data.email?.split("@")[0] || "Unknown",
        email: data.email || "",
        xp: data.xp || 0,
        subscriptionStatus: subscribed ? "subscribed" : "not_subscribed",
        subscriptionEndDate: data.subscriptionEndDate || null,
        subscriptionDaysLeft,
        createdAt,
        lastLogin: data.lastLogin || null,
      };
    });

    return json({
      data: users,
      totalPages,
      currentPage: page,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return json({ error: "Internal server error" }, 500);
  }
}

// ========================================
// PATCH
// ========================================
export async function PATCH(request: NextRequest) {
  try {
    // Өгөгдөл өөрчилдөг тул token цуцлагдсан эсэхийг мөн шалгана
    const admin = await requireAdmin(request, { checkRevoked: true });
    if (!admin.ok) return admin.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request body" }, 400);
    }

    const { userId, subscriptionDays, xp, mode: rawMode } = body as Record<string, unknown>;

    // ---------- Утга шалгах ----------
    if (typeof userId !== "string" || !userId.trim() || userId.includes("/")) {
      return json({ error: "User ID is required" }, 400);
    }

    const days = toNumber(subscriptionDays);
    const xpValue = toNumber(xp);

    if (days === undefined && xpValue === undefined) {
      return json({ error: "Nothing to update" }, 400);
    }

    if (
      days !== undefined &&
      (!Number.isInteger(days) || Math.abs(days) > MAX_SUBSCRIPTION_DAYS)
    ) {
      return json({ error: "Invalid subscriptionDays" }, 400);
    }

    if (rawMode !== undefined && rawMode !== "set" && rawMode !== "add") {
      return json({ error: "Invalid mode" }, 400);
    }
    const mode: "set" | "add" = rawMode === "set" ? "set" : "add";

    if (mode === "set" && days !== undefined && days < 0) {
      return json({ error: "subscriptionDays must not be negative in set mode" }, 400);
    }

    if (xpValue !== undefined && (!Number.isFinite(xpValue) || xpValue > MAX_XP)) {
      return json({ error: "Invalid xp" }, 400);
    }

    // ---------- Firebase Auth дээр хэрэглэгч байгаа эсэх ----------
    let authUser;
    try {
      authUser = await auth.getUser(userId);
    } catch (error: any) {
      if (error?.code === "auth/user-not-found") {
        return json({ error: "User not found" }, 404);
      }
      throw error;
    }

    const userRef = firestore.collection("users").doc(userId);
    const counterRef = firestore.collection("counters").doc("users");
    const auditRef = firestore.collection("adminAuditLogs").doc();

    // ---------- Унших, тооцоолох, бичих нь нэг transaction ----------
    // (хоёр хүсэлт зэрэг ирэхэд хоногууд алдагдахгүй, userId давхцахгүй)
    await firestore.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const current = (userSnap.exists ? userSnap.data() : undefined) ?? {};
      const now = new Date();

      const updateData: Record<string, unknown> = {};

      if (days !== undefined) {
        Object.assign(updateData, computeSubscriptionUpdate(days, mode, current, now));
      }
      if (xpValue !== undefined) {
        updateData.xp = Math.max(0, Math.round(xpValue));
      }
      updateData.updatedAt = now.toISOString();

      if (userSnap.exists) {
        tx.update(userRef, updateData);
      } else {
        // Firebase Auth-д байгаа боловч Firestore document үүсээгүй хэрэглэгч
        const newUserId = await allocateUserId(tx, counterRef);

        tx.set(userRef, {
          userId: newUserId,
          username: authUser.displayName || authUser.email?.split("@")[0] || "Unknown",
          email: authUser.email?.toLowerCase() || "",
          xp: 0,
          subscriptionStatus: "not_subscribed",
          createdAt: authUser.metadata.creationTime
            ? new Date(authUser.metadata.creationTime)
            : now,
          ...updateData,
        });
      }

      // Аудитын бүртгэл: хэн, хэнд, юуг өөрчилсөн
      tx.set(auditRef, {
        at: now,
        adminUid: admin.token.uid,
        adminEmail: admin.token.email ?? null,
        targetUserId: userId,
        input: {
          subscriptionDays: days ?? null,
          mode: days !== undefined ? mode : null,
          xp: xpValue ?? null,
        },
        applied: {
          subscriptionStatus: updateData.subscriptionStatus ?? null,
          subscriptionEndDate: updateData.subscriptionEndDate ?? null,
          xp: updateData.xp ?? null,
        },
      });
    });

    return json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return json({ error: "Internal server error" }, 500);
  }
}