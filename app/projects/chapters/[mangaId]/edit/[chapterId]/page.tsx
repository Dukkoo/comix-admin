// app/projects/chapters/[mangaId]/edit/[chapterId]/page.tsx
import { getChapterById, getMangaById } from "./actions";
import EditChapterForm from "./edit-chapter-form";
import NovelChapterForm from "@/components/novel-chapter-form";
import { getNovelChapter } from "@/lib/novel-chapters";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    mangaId: string;
    chapterId: string;
  }>;
  // ?type=novel бол текстэн (novel) бүлэг, үгүй бол зурагтай манхва бүлэг
  searchParams: Promise<{
    type?: string | string[];
  }>;
};

const isNovelType = (type: string | string[] | undefined) =>
  (Array.isArray(type) ? type[0] : type) === "novel";

export default async function EditChapterPage({ params, searchParams }: Props) {
  const { mangaId, chapterId } = await params;
  const { type } = await searchParams;

  // Fetch manga details using server action (not client API)
  const mangaResult = await getMangaById(mangaId);
  if (mangaResult.error || !mangaResult.data) {
    notFound();
  }

  const manga = mangaResult.data;

  // Novel бүлэг: тусдаа collection-оос уншина (манхва бүлгийн документийг огт хөндөхгүй)
  if (isNovelType(type)) {
    const novelChapter = await getNovelChapter(mangaId, chapterId);
    if (!novelChapter) {
      notFound();
    }

    return (
      <NovelChapterForm
        mode="edit"
        mangaId={mangaId}
        mangaTitle={manga.title}
        chapterId={chapterId}
        initial={{
          chapterNumber: novelChapter.chapterNumber,
          content: novelChapter.content,
        }}
      />
    );
  }

  // Fetch chapter details
  const chapterResult = await getChapterById(mangaId, chapterId);
  if (chapterResult.error || !chapterResult.data) {
    notFound();
  }

  const chapter = chapterResult.data;

  return (
    <EditChapterForm
      mangaId={mangaId}
      mangaTitle={manga.title}
      chapterId={chapterId}
      currentChapterNumber={chapter.chapterNumber}
      currentImages={chapter.images || []}
    />
  );
}

// Generate metadata for the page
export async function generateMetadata({ params, searchParams }: Props) {
  const { mangaId, chapterId } = await params;
  const { type } = await searchParams;

  // Use server action instead of client API function
  const mangaResult = await getMangaById(mangaId);

  if (isNovelType(type)) {
    const novelChapter = await getNovelChapter(mangaId, chapterId);

    if (mangaResult.error || !novelChapter) {
      return {
        title: "Edit Novel Chapter - Not Found",
      };
    }

    return {
      title: `Edit Novel Chapter ${novelChapter.chapterNumber} - ${mangaResult.data?.title}`,
      description: `Edit novel chapter ${novelChapter.chapterNumber} of ${mangaResult.data?.title}`,
    };
  }

  const chapterResult = await getChapterById(mangaId, chapterId);

  if (mangaResult.error || chapterResult.error) {
    return {
      title: "Edit Chapter - Not Found",
    };
  }

  return {
    title: `Edit Chapter ${chapterResult.data?.chapterNumber} - ${mangaResult.data?.title}`,
    description: `Edit chapter ${chapterResult.data?.chapterNumber} of ${mangaResult.data?.title}`,
  };
}