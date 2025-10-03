// app/admin/projects/chapters/[mangaId]/edit/[chapterId]/page.tsx
import { getChapterById, getMangaById } from "./actions";
import EditChapterForm from "./edit-chapter-form";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    mangaId: string;
    chapterId: string;
  }>;
};

export default async function EditChapterPage({ params }: Props) {
  const { mangaId, chapterId } = await params;

  // Fetch manga details using server action (not client API)
  const mangaResult = await getMangaById(mangaId);
  if (mangaResult.error || !mangaResult.data) {
    notFound();
  }

  // Fetch chapter details
  const chapterResult = await getChapterById(mangaId, chapterId);
  if (chapterResult.error || !chapterResult.data) {
    notFound();
  }

  const manga = mangaResult.data;
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
export async function generateMetadata({ params }: Props) {
  const { mangaId, chapterId } = await params;
  
  // Use server action instead of client API function
  const mangaResult = await getMangaById(mangaId);
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