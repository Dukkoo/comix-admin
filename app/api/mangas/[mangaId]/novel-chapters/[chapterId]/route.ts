// app/api/mangas/[mangaId]/novel-chapters/[chapterId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/firebase/server";
import { novelChapterUpdateSchema } from "@/validation/novelChapterSchema";
import {
  NovelApiError,
  getNovelChapter,
  handleRouteError,
  isValidDocId,
  jsonError,
  novelChaptersCollection,
  readJsonBody,
  requireAdmin,
  syncNovelChapterCount,
} from "@/lib/novel-chapters";

type RouteContext = { params: Promise<{ mangaId: string; chapterId: string }> };

// GET - Нэг бүлгийг текстийн хамт авах (зөвхөн админ)
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { mangaId, chapterId } = await params;
    if (!isValidDocId(mangaId) || !isValidDocId(chapterId)) {
      return jsonError(400, "Буруу ID байна");
    }

    const chapter = await getNovelChapter(mangaId, chapterId);
    if (!chapter) {
      return jsonError(404, "Бүлэг олдсонгүй");
    }

    return NextResponse.json(
      { error: false, data: chapter },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleRouteError(error, "Error fetching novel chapter");
  }
}

// PUT - Бүлэг засах (зөвхөн админ). Зөвхөн илгээсэн талбарууд өөрчлөгдөнө.
// chapterNumber өөрчлөгдвөл документийн ID-г транзакциор шилжүүлнэ (ID = бүлгийн дугаар хэвээр байх ёстой).
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { mangaId, chapterId } = await params;
    if (!isValidDocId(mangaId) || !isValidDocId(chapterId)) {
      return jsonError(400, "Буруу ID байна");
    }

    const body = await readJsonBody(request);
    const validation = novelChapterUpdateSchema.safeParse(body);

    if (!validation.success) {
      return jsonError(400, validation.error.issues[0]?.message ?? "Өгөгдөл буруу байна");
    }

    const { chapterNumber, content, isFree } = validation.data;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (content !== undefined) {
      updates.content = content;
      updates.charCount = content.length;
    }
    if (isFree !== undefined) updates.isFree = isFree;

    const collection = novelChaptersCollection(mangaId);
    const newId = chapterNumber !== undefined ? String(chapterNumber) : chapterId;

    if (newId !== chapterId) {
      await firestore.runTransaction(async (transaction) => {
        const oldRef = collection.doc(chapterId);
        const newRef = collection.doc(newId);

        const [oldSnapshot, newSnapshot] = await Promise.all([
          transaction.get(oldRef),
          transaction.get(newRef),
        ]);

        if (!oldSnapshot.exists) {
          throw new NovelApiError(404, "Бүлэг олдсонгүй");
        }
        if (newSnapshot.exists) {
          throw new NovelApiError(409, `${chapterNumber}-р бүлэг аль хэдийн байна`);
        }

        transaction.set(newRef, { ...(oldSnapshot.data() ?? {}), ...updates, chapterNumber });
        transaction.delete(oldRef);
      });
    } else {
      // Документ байхгүй бол update() NOT_FOUND алдаа өгч, 404 болно
      await collection.doc(chapterId).update({
        ...updates,
        ...(chapterNumber !== undefined ? { chapterNumber } : {}),
      });
    }

    return NextResponse.json({
      error: false,
      message: "Novel бүлэг шинэчлэгдлээ",
      id: newId,
    });
  } catch (error) {
    return handleRouteError(error, "Error updating novel chapter");
  }
}

// DELETE - Бүлэг устгах (зөвхөн админ)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { mangaId, chapterId } = await params;
    if (!isValidDocId(mangaId) || !isValidDocId(chapterId)) {
      return jsonError(400, "Буруу ID байна");
    }

    const ref = novelChaptersCollection(mangaId).doc(chapterId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return jsonError(404, "Бүлэг олдсонгүй");
    }

    await ref.delete();

    try {
      await syncNovelChapterCount(mangaId);
    } catch (countError) {
      console.error("Failed to sync novel chapter count:", countError);
    }

    return NextResponse.json({
      error: false,
      message: "Novel бүлэг устгагдлаа",
    });
  } catch (error) {
    return handleRouteError(error, "Error deleting novel chapter");
  }
}