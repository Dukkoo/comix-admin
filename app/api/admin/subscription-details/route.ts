// app/api/admin/subscription-details/route.ts
import { firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

// ========================================
// IN-MEMORY CACHE (instance бүрт тусдаа, зөвхөн өгөгдлийн сангийн ачааллыг багасгана)
// ========================================
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // Улаанбаатар UTC+8 (зуны цаг байхгүй)

// Серверийн цагийн бүс (ихэвчлэн UTC) биш, Монголын цагаар өдөр/сарыг тооцно
const localDateKey = (date: Date) =>
  new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);

const startOfLocalMonth = (date: Date, monthOffset = 0) => {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthOffset, 1) - TZ_OFFSET_MS
  );
};

const respond = (data: unknown, cache: "HIT" | "MISS" | "BYPASS") =>
  NextResponse.json(data, {
    headers: {
      // Орлогын мэдээлэл тул shared cache (CDN) хэзээ ч хадгалах ёсгүй
      "Cache-Control": "private, no-store",
      "X-Cache": cache,
    },
  });

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    // ?refresh=1 -> cache-ийг тойрч шинээр тооцоолно (модалын "Шинэчлэх" товч)
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    const nowMs = Date.now();

    if (!forceRefresh && cachedData && nowMs - cacheTimestamp < CACHE_DURATION) {
      return respond(cachedData, "HIT");
    }

    const now = new Date(nowMs);
    const nowIso = now.toISOString();
    const monthStart = startOfLocalMonth(now);
    const nextMonthStart = startOfLocalMonth(now, 1);
    const sevenDaysLaterIso = new Date(nowMs + 7 * DAY_MS).toISOString();

    const periods = [
      { days: 90, label: "90 хоног", count: 0 },
      { days: 30, label: "30 хоног", count: 0 },
      { days: 7, label: "7 хоног", count: 0 },
    ];

    // Сүүлийн 90 өдрийн (Монголын цагаар) түлхүүрүүд
    const dailyActivations: Record<string, number> = {};
    for (let i = 89; i >= 0; i--) {
      dailyActivations[localDateKey(new Date(nowMs - i * DAY_MS))] = 0;
    }

    const failed: string[] = [];
    let expiringSoonCount = 0;
    let newSubscribersCount = 0;
    let monthlyRevenue = 0;
    let monthlyActivations = 0;

    const [expiringResult, paymentsResult, newSubscribersResult] = await Promise.allSettled([
      // 1) 7 хоногт дуусах: count() aggregation (нэг талбарын range тул composite index шаардахгүй)
      firestore
        .collection("users")
        .where("subscriptionEndDate", ">", nowIso)
        .where("subscriptionEndDate", "<=", sevenDaysLaterIso)
        .count()
        .get(),

      // 2) Сүүлийн 90 өдрийн БҮХ төлбөр (payment_logs). Идэвхжүүлэлт, trend, орлого бүгд
      //    нэг эх сурвалжаас тооцогдоно. Үүнд ЭРХ СУНГАСАН (renewal) төлбөр ч орно.
      //    Өмнө нь users.subscriptionStartDate-ээс тооцдог байсан бөгөөд тэр нь зөвхөн
      //    АНХ идэвхжүүлсэн огноог хадгалдаг тул сунгалтууд харагддаггүй байв.
      firestore
        .collection("payment_logs")
        .where("processedAt", ">=", new Date(nowMs - 91 * DAY_MS).toISOString())
        .select("amount", "userId", "invoiceId", "processedAt")
        .get(),

      // 3) Энэ сард эрх нь эхэлсэн хэрэглэгчид (шинэ идэвхжүүлэгч)
      firestore
        .collection("users")
        .where("subscriptionStartDate", ">=", monthStart.toISOString())
        .select("subscriptionStatus", "subscriptionEndDate")
        .get(),
    ]);

    if (expiringResult.status === "fulfilled") {
      expiringSoonCount = expiringResult.value.data().count;
    } else {
      failed.push("expiringSoon");
      console.error("[Subscription Details] expiringSoon:", expiringResult.reason);
    }

    if (paymentsResult.status === "fulfilled") {
      // Нэг invoice олон удаа бүртгэгдсэн (хуучин давхар сунгалтын алдаа) бол нэг л удаа тооцно.
      // Хамгийн эрт бүртгэлийг үлдээнэ.
      const unique = new Map<string, { time: number; amount: number }>();

      paymentsResult.value.docs.forEach((doc) => {
        const data = doc.data();
        const time = Date.parse(data.processedAt);
        const amount = Number(data.amount);
        if (isNaN(time) || time > nowMs || !Number.isFinite(amount) || amount <= 0) return;

        const key = data.invoiceId ? String(data.invoiceId) : doc.id;
        const existing = unique.get(key);
        if (!existing || time < existing.time) unique.set(key, { time, amount });
      });

      unique.forEach(({ time, amount }) => {
        const key = localDateKey(new Date(time));
        if (dailyActivations[key] !== undefined) dailyActivations[key]++;

        periods.forEach((p) => {
          if (time >= nowMs - p.days * DAY_MS) p.count++;
        });

        if (time >= monthStart.getTime() && time < nextMonthStart.getTime()) {
          monthlyRevenue += amount;
          monthlyActivations++;
        }
      });
    } else {
      failed.push("activations", "revenue");
      console.error("[Subscription Details] payments:", paymentsResult.reason);
    }

    if (newSubscribersResult.status === "fulfilled") {
      newSubscribersResult.value.docs.forEach((doc) => {
        const data = doc.data();
        const endMs = data.subscriptionEndDate ? Date.parse(data.subscriptionEndDate) : NaN;
        const isActive =
          data.subscriptionStatus === "subscribed" && (isNaN(endMs) || endMs > nowMs);
        if (isActive) newSubscribersCount++;
      });
    } else {
      failed.push("newSubscribers");
      console.error("[Subscription Details] newSubscribers:", newSubscribersResult.reason);
    }

    const detailsData = {
      expiringSoon: {
        count: expiringSoonCount,
        label: "7 хоногт дуусах",
      },
      newSubscribers: {
        count: newSubscribersCount,
        label: "Энэ сард шинээр",
      },
      trends: periods.map((p) => ({ period: p.label, count: p.count, days: p.days })),
      mrr: {
        amount: monthlyRevenue,
        activeCount: monthlyActivations,
        currency: "₮",
      },
      timeline: Object.entries(dailyActivations).map(([date, count]) => ({ date, count })),
      // Зарим query бүтэлгүйтсэн бол тэр хэсгийн 0-г "үнэн" гэж андуурахгүйн тулд жагсаана
      ...(failed.length > 0 ? { partial: failed } : {}),
    };

    // Бүрэн бус өгөгдлийг cache-д хадгалахгүй
    if (failed.length === 0) {
      cachedData = detailsData;
      cacheTimestamp = Date.now();
    }

    return respond(detailsData, forceRefresh ? "BYPASS" : "MISS");
  } catch (error) {
    console.error("[Subscription Details] Fatal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}