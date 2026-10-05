// app/api/admin/analytics/route.ts
import { firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

// ========================================
// IN-MEMORY CACHE (instance бүрт тусдаа, зөвхөн өгөгдлийн сангийн ачааллыг багасгана)
// ========================================
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const respond = (data: unknown, cache: "HIT" | "MISS" | "BYPASS", extra: Record<string, string> = {}) =>
  NextResponse.json(data, {
    headers: {
      // Бизнесийн статистик тул shared cache (CDN) хэзээ ч хадгалах ёсгүй
      "Cache-Control": "private, no-store",
      "X-Cache": cache,
      ...extra,
    },
  });

// users.createdAt нь зарим document дээр Firestore Timestamp, зарим дээр ISO string байдаг
// (client сайт Timestamp, админаас үүсгэсэн хуучин document-ууд string).
// Firestore төрлөөр нь тусад нь харьцуулдаг тул хоёр төрлөөр тус тусад нь тоолно.
const countCreatedBetween = async (start: Date, end: Date) => {
  const users = firestore.collection("users");

  const [asTimestamp, asString] = await Promise.all([
    users.where("createdAt", ">=", start).where("createdAt", "<", end).count().get(),
    users
      .where("createdAt", ">=", start.toISOString())
      .where("createdAt", "<", end.toISOString())
      .count()
      .get(),
  ]);

  return asTimestamp.data().count + asString.data().count;
};

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    // ?refresh=1 -> cache-ийг тойрч шинээр тооцоолно (dashboard-ын "Шинэчлэх" товч)
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    const nowMs = Date.now();
    const cacheAge = nowMs - cacheTimestamp;

    if (!forceRefresh && cachedData && cacheAge < CACHE_DURATION) {
      return respond(cachedData, "HIT", { "X-Cache-Age": Math.round(cacheAge / 1000).toString() });
    }

    const currentDate = new Date(nowMs);

    // ========================================
    // Үндсэн статистик (зэрэг ажиллуулна)
    // ========================================
    const [totalUsersSnap, subscribedSnap, totalMangasSnap, mangaChaptersSnap, xpSampleSnap] =
      await Promise.all([
        firestore.collection("users").count().get(),

        // Идэвхтэй эрхтэй: төлөв "subscribed" БӨГӨӨД дуусах огноо ирээдүйд байх.
        // Хугацаа нь дууссан хэрэглэгч cron-оос үл хамааран тоологдохгүй.
        firestore
          .collection("users")
          .where("subscriptionStatus", "==", "subscribed")
          .where("subscriptionEndDate", ">", currentDate.toISOString())
          .count()
          .get(),

        firestore.collection("mangas").count().get(),

        firestore.collection("mangas").select("chapters").get(),

        // Анхаар: энэ нь жинхэнэ дундаж биш, дурын 100 хэрэглэгчийн дундаж (UI-д харагддаггүй)
        firestore.collection("users").select("xp").limit(100).get(),
      ]);

    const totalUsers = totalUsersSnap.data().count;
    const subscribedCount = subscribedSnap.data().count;
    const freeCount = Math.max(0, totalUsers - subscribedCount);
    const totalMangas = totalMangasSnap.data().count;

    let totalChapters = 0;
    mangaChaptersSnap.docs.forEach((mangaDoc) => {
      totalChapters += Number(mangaDoc.data().chapters) || 0;
    });

    let averageXP = 0;
    if (xpSampleSnap.size > 0) {
      let totalSampleXP = 0;
      xpSampleSnap.docs.forEach((doc) => {
        totalSampleXP += Number(doc.data().xp) || 0;
      });
      averageXP = Math.round(totalSampleXP / xpSampleSnap.size);
    }

    // ========================================
    // 7 хоногийн интервалаар сүүлийн 8 долоо хоногийн шинэ хэрэглэгч
    // (Week 8 = сүүлийн 7 хоног). Өмнө нь createdAt-ийг зөвхөн string гэж үздэг байсан тул
    // Timestamp төрлийн хэрэглэгчид тоологддоггүй байв.
    // ========================================
    const failed: string[] = [];
    let weeklyData: Array<{ week: string; users: number }> = [];

    try {
      weeklyData = await Promise.all(
        Array.from({ length: 8 }, async (_, index) => {
          const k = index + 1; // 1..8
          const end = new Date(nowMs - (8 - k) * WEEK_MS);
          const start = new Date(end.getTime() - WEEK_MS);
          return { week: `Week ${k}`, users: await countCreatedBetween(start, end) };
        })
      );
    } catch (error) {
      failed.push("weeklyData");
      console.error("[Analytics] weeklyData:", error);
      weeklyData = Array.from({ length: 8 }, (_, i) => ({ week: `Week ${i + 1}`, users: 0 }));
    }

    const subscriptionRate = totalUsers > 0 ? (subscribedCount / totalUsers) * 100 : 0;

    const analyticsData = {
      stats: {
        totalUsers,
        subscribedUsers: subscribedCount,
        freeUsers: freeCount,
        totalMangas,
        totalChapters,
        averageXP,
        subscriptionRate: Math.round(subscriptionRate * 100) / 100,
      },
      pieData: [
        { name: "Subscribed", value: subscribedCount, color: "#0891b2" },
        { name: "Free", value: freeCount, color: "#52525b" },
      ],
      weeklyData,
      // Бүтэлгүйтсэн хэсгийн 0-г "үнэн" гэж андуурахгүйн тулд жагсаана
      ...(failed.length > 0 ? { partial: failed } : {}),
    };

    // Бүрэн бус өгөгдлийг cache-д хадгалахгүй
    if (failed.length === 0) {
      cachedData = analyticsData;
      cacheTimestamp = Date.now();
    }

    return respond(analyticsData, forceRefresh ? "BYPASS" : "MISS");
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}