// app/api/admin/read-counts/route.ts  (АДМИН сайт)
//
// Манга бүрийн "уншсан тоо"-г client сайтын `xp_state/{uid}/chapters/{mangaId}_{бүлэг}` тэмдэглэгээнээс тоолно.
// Тэр тэмдэглэгээг client-ийн awardChapterXp "нэг хэрэглэгч нэг бүлэгт нэг л удаа" (precondition exists:false,
// Аураг нэмэхтэй нэг commit дотор) үүсгэдэг тул:
//   - давхар тоологдохгүй (refresh, өөр төхөөрөмж, дахин оролдлого нөлөөлөхгүй)
//   - хөөрөгдөх боломжгүй (client Firestore-д шууд бичиж чадахгүй)
//   - өмнөх бүх уншилт аль хэдийн тоологдсон байна
//   - тусдаа тоолуур, шинэ бичилт, hot document байхгүй
//
// GET /api/admin/read-counts?ids=1234,5678[&refresh=1]  ->  { counts: { "1234": 87, ... }, failed?: [...] }
// GET /api/admin/read-counts?mangaId=1234               ->  { reads, readers, capped }
//     reads   = нийт уншилт (хэрэглэгч x бүлэг)
//     readers = хэдэн өвөрмөц хэрэглэгч уншсан (xp_state/{uid}-ээс ялгана)
//
// Шаардлагатай Firestore index (нэг удаа): Collection group index
//   Collection ID: chapters | Query scope: Collection group | Fields: mangaId (Ascending), at (Ascending)
// Анх дуудахад index байхгүй бол серверийн логт үүсгэх холбоос гарна.
import { firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const CACHE_MS = 5 * 60 * 1000;
const MAX_IDS = 500;
const BATCH_SIZE = 25; // зэрэг ажиллах aggregation query-ийн тоо

const DETAIL_CACHE_MS = 10 * 60 * 1000;
const MAX_DETAIL_DOCS = 50000; // нэг мангын тэмдэглэгээг хамгийн ихдээ хэд уншихыг хязгаарлана (зардлын хамгаалалт)

// instance бүрт тусдаа санах ой (өгөгдлийн сангийн ачааллыг багасгана)
const cache = new Map<string, { at: number; count: number }>();
const detailCache = new Map<string, { at: number; reads: number; readers: number; capped: boolean }>();

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const isValidId = (id: string) => id.length > 0 && id.length <= 120 && !id.includes("/");

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { searchParams } = request.nextUrl;
    const refresh = searchParams.get("refresh") === "1";

    // ---------- Нэг мангын дэлгэрэнгүй: хэдэн хүн уншсан ----------
    const detailId = searchParams.get("mangaId");
    if (detailId) {
      if (!isValidId(detailId)) return json({ error: "Invalid mangaId" }, 400);

      const cached = detailCache.get(detailId);
      if (!refresh && cached && Date.now() - cached.at < DETAIL_CACHE_MS) {
        return json({ reads: cached.reads, readers: cached.readers, capped: cached.capped });
      }

      // .select() -> талбар татахгүй, зөвхөн document-ын зам (uid) хэрэгтэй
      const snapshot = await firestore
        .collectionGroup("chapters")
        .where("mangaId", "==", detailId)
        .where("at", "!=", null)
        .select()
        .limit(MAX_DETAIL_DOCS)
        .get();

      // xp_state/{uid}/chapters/{...} -> uid. Өөр газрын "chapters"-ыг (mangas/{id}/chapters) оруулахгүй
      const readers = new Set<string>();
      let reads = 0;
      snapshot.docs.forEach((doc) => {
        const userDoc = doc.ref.parent.parent;
        if (userDoc && userDoc.parent.id === "xp_state") {
          readers.add(userDoc.id);
          reads += 1;
        }
      });

      const result = { reads, readers: readers.size, capped: snapshot.size >= MAX_DETAIL_DOCS };
      detailCache.set(detailId, { at: Date.now(), ...result });
      return json(result);
    }

    const ids = Array.from(
      new Set(
        (searchParams.get("ids") || "")
          .split(",")
          .map((id) => id.trim())
          .filter(isValidId)
      )
    ).slice(0, MAX_IDS);

    if (ids.length === 0) return json({ counts: {} });

    const now = Date.now();
    const counts: Record<string, number> = {};
    const failed: string[] = [];

    const countFor = async (id: string) => {
      const cached = cache.get(id);
      if (!refresh && cached && now - cached.at < CACHE_MS) {
        counts[id] = cached.count;
        return;
      }

      try {
        // `at` талбар нь зөвхөн xp_state тэмдэглэгээнд байдаг тул ижил нэртэй
        // mangas/{id}/chapters (бүлгийн document) тоологдохгүй
        const snapshot = await firestore
          .collectionGroup("chapters")
          .where("mangaId", "==", id)
          .where("at", "!=", null)
          .count()
          .get();

        const count = snapshot.data().count;
        cache.set(id, { at: now, count });
        counts[id] = count;
      } catch (error) {
        console.error(`[read-counts] ${id}:`, error);
        failed.push(id);
      }
    };

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await Promise.all(ids.slice(i, i + BATCH_SIZE).map(countFor));
    }

    return json({ counts, ...(failed.length > 0 ? { failed } : {}) });
  } catch (error) {
    console.error("[read-counts] fatal:", error);
    return json({ error: "Internal server error" }, 500);
  }
}