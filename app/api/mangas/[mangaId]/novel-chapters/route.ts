// app/api/mangas/[mangaId]/novel-chapters/route.ts
import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/firebase/server";
import { novelChapterCreateSchema } from "@/validation/novelChapterSchema";
import {
  handleRouteError,
  isValidDocId,
  jsonError,
  novelChaptersCollection,
  readJsonBody,
  requireAdmin,
  syncNovelChapterCount,
  toNovelChapterSummary,
} from "@/lib/novel-chapters";

// GET - Novel бүлгүүдийн жагсаалт (зөвхөн мета мэдээлэл: дугаар, үнэгүй эсэх, тэмдэгтийн тоо).
// Текст (content) жагсаалтад орохгүй. Манхва бүлгийн жагсаалттай адил нэвтрэлт шаардахгүй.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  try {
    const { mangaId } = await params;
    if (!isValidDocId(mangaId)) {
      return jsonError(400, "Буруу ID байна");
    }

    const snapshot = await novelChaptersCollection(mangaId)
      .select("chapterNumber", "isFree", "charCount", "createdAt", "updatedAt")
      .orderBy("chapterNumber", "desc")
      .get();

    const data = snapshot.docs.map((doc) => toNovelChapterSummary(doc.id, doc.data()));

    return NextResponse.json(
      { data, totalCount: data.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleRouteError(error, "Error listing novel chapters");
  }
}

// POST - Шинэ novel бүлэг үүсгэх (зөвхөн админ)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { mangaId } = await params;
    if (!isValidDocId(mangaId)) {
      return jsonError(400, "Буруу ID байна");
    }

    const body = await readJsonBody(request);
    const validation = novelChapterCreateSchema.safeParse(body);

    if (!validation.success) {
      return jsonError(400, validation.error.issues[0]?.message ?? "Өгөгдөл буруу байна");
    }

    const { chapterNumber, content, isFree } = validation.data;

    const mangaSnapshot = await firestore.collection("mangas").doc(mangaId).get();
    if (!mangaSnapshot.exists) {
      return jsonError(404, "Манхва олдсонгүй");
    }

    const now = new Date().toISOString();

    // create(): ижил дугаартай бүлэг байвал өрсөлдөөнгүйгээр ALREADY_EXISTS алдаа өгнө (409)
    await novelChaptersCollection(mangaId)
      .doc(String(chapterNumber))
      .create({
        chapterNumber,
        content,
        charCount: content.length,
        isFree: isFree === true,
        createdAt: now,
        updatedAt: now,
      });

    // Тоолуур шинэчлэгдэхгүй бол бүлэг үүссэн хэвээр, зөвхөн log үлдээнэ
    try {
      await syncNovelChapterCount(mangaId);
    } catch (countError) {
      console.error("Failed to sync novel chapter count:", countError);
    }

    return NextResponse.json(
      {
        error: false,
        message: "Novel бүлэг амжилттай үүслээ",
        id: String(chapterNumber),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, "Error creating novel chapter");
  }
}