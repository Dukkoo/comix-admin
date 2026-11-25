// utils/novel-chapter-api.ts
// Админ сайтын браузер талаас novel бүлгийн API-г дуудах туслахууд.

export type NovelChapterSummary = {
  id: string;
  chapterNumber: number;
  isFree: boolean;
  charCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NovelApiResult = {
  error: boolean;
  message: string;
  id?: string;
};

export type NovelChapterInput = {
  chapterNumber: number;
  content: string;
  isFree?: boolean;
};

export type NovelChapterChanges = Partial<NovelChapterInput>;

const baseUrl = (mangaId: string) => `/api/mangas/${encodeURIComponent(mangaId)}/novel-chapters`;

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

async function send(url: string, init: RequestInit): Promise<NovelApiResult> {
  try {
    const response = await fetch(url, init);
    const json = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok || json.error) {
      return {
        error: true,
        message: typeof json.message === "string" && json.message ? json.message : `Алдаа гарлаа (${response.status})`,
      };
    }

    return {
      error: false,
      message: typeof json.message === "string" ? json.message : "OK",
      id: typeof json.id === "string" ? json.id : undefined,
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Сүлжээний алдаа гарлаа",
    };
  }
}

/** Бүх novel бүлгийн жагсаалт (текстгүй). Алдаа гарвал throw хийнэ. */
export async function fetchNovelChapters(mangaId: string): Promise<NovelChapterSummary[]> {
  const response = await fetch(baseUrl(mangaId), { cache: "no-store" });
  const json = await response.json().catch(() => ({} as Record<string, unknown>));

  if (!response.ok) {
    throw new Error(
      typeof json.message === "string" && json.message ? json.message : `Novel бүлгүүдийг ачаалж чадсангүй (${response.status})`
    );
  }

  return Array.isArray(json.data) ? (json.data as NovelChapterSummary[]) : [];
}

export const createNovelChapter = (mangaId: string, data: NovelChapterInput, token: string) =>
  send(baseUrl(mangaId), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

export const updateNovelChapter = (
  mangaId: string,
  chapterId: string,
  changes: NovelChapterChanges,
  token: string
) =>
  send(`${baseUrl(mangaId)}/${encodeURIComponent(chapterId)}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(changes),
  });

export const deleteNovelChapter = (mangaId: string, chapterId: string, token: string) =>
  send(`${baseUrl(mangaId)}/${encodeURIComponent(chapterId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });