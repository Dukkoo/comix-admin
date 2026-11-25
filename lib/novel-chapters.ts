// lib/novel-chapters.ts
// Novel (текст) бүлгийн серверийн туслах функцууд.
// Хадгалах газар: mangas/{mangaId}/novelChapters/{chapterNumber}
// (манхва бүлгийн `chapters` collection-ээс тусдаа тул одоо байгаа жагсаалт, тоолуур, сүүлийн бүлэг хөндөгдөхгүй)
import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";

export class NovelApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type NovelChapterSummary = {
  id: string;
  chapterNumber: number;
  isFree: boolean;
  charCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NovelChapter = NovelChapterSummary & {
  content: string;
};

// Firestore документийн ID-д зөвшөөрөгдөхгүй утгуудыг эрт шүүнэ
export const isValidDocId = (id: unknown): id is string =>
  typeof id === "string" &&
  id.length > 0 &&
  id.length <= 200 &&
  !/[\/\\]/.test(id) &&
  id !== "." &&
  id !== ".." &&
  !/^__.*__$/.test(id);

export const novelChaptersCollection = (mangaId: string) =>
  firestore.collection("mangas").doc(mangaId).collection("novelChapters");

const toIsoString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === "function") return maybeTimestamp.toDate().toISOString();
  return null;
};

export const toNovelChapterSummary = (id: string, data: Record<string, any>): NovelChapterSummary => ({
  id,
  chapterNumber: typeof data.chapterNumber === "number" ? data.chapterNumber : parseInt(id, 10) || 0,
  isFree: data.isFree === true,
  charCount: typeof data.charCount === "number" ? data.charCount : 0,
  createdAt: toIsoString(data.createdAt),
  updatedAt: toIsoString(data.updatedAt),
});

export const toNovelChapter = (id: string, data: Record<string, any>): NovelChapter => ({
  ...toNovelChapterSummary(id, data),
  content: typeof data.content === "string" ? data.content : "",
  charCount: typeof data.charCount === "number" ? data.charCount : typeof data.content === "string" ? data.content.length : 0,
});

/** Нэг бүлгийг бүрэн (текстийн хамт) уншина. Серверийн page-үүд шууд дуудна. */
export async function getNovelChapter(mangaId: string, chapterId: string): Promise<NovelChapter | null> {
  if (!isValidDocId(mangaId) || !isValidDocId(chapterId)) return null;

  const snapshot = await novelChaptersCollection(mangaId).doc(chapterId).get();
  if (!snapshot.exists) return null;

  return toNovelChapter(snapshot.id, snapshot.data() ?? {});
}

/** manga документ дээрх `novelChapters` тоог бодит тоотойгоор нь шинэчилнэ (зөвхөн ID-г татаж тоолно). */
export async function syncNovelChapterCount(mangaId: string): Promise<number> {
  const snapshot = await novelChaptersCollection(mangaId).select().get();
  await firestore.collection("mangas").doc(mangaId).update({ novelChapters: snapshot.size });
  return snapshot.size;
}

// ---------------------------------------------------------------- API туслахууд

export const jsonError = (status: number, message: string) =>
  NextResponse.json({ error: true, message }, { status });

/** Админ биш бол алдааны хариуг буцаана, админ бол null */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return jsonError(401, "Нэвтрээгүй байна");
  }

  try {
    const decoded = await auth.verifyIdToken(header.slice(7).trim());
    if (!decoded.admin) {
      return jsonError(403, "Админ эрх шаардлагатай");
    }
    return null;
  } catch {
    return jsonError(401, "Токен буруу эсвэл хугацаа дууссан байна");
  }
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new NovelApiError(400, "Хүсэлтийн бие буруу байна");
  }
}

export function handleRouteError(error: unknown, context: string): NextResponse {
  if (error instanceof NovelApiError) {
    return jsonError(error.status, error.message);
  }

  const code = (error as { code?: unknown } | null)?.code;
  if (code === 5 || code === "not-found") return jsonError(404, "Бүлэг олдсонгүй");
  if (code === 6 || code === "already-exists") return jsonError(409, "Энэ дугаартай бүлэг аль хэдийн байна");

  console.error(`${context}:`, error);
  return jsonError(500, "Серверийн алдаа гарлаа");
}