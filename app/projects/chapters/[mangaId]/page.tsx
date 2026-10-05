// app/projects/chapters/[mangaId]/page.tsx
import { notFound } from "next/navigation";
import ChapterTable from "./chapter-table";
import { fetchMangaByIdServer } from "@/utils/server-manga-api";

type Props = {
  params: Promise<{
    mangaId: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function ChaptersPage({ params, searchParams }: Props) {
  try {
    const { mangaId } = await params;
    const { page } = await searchParams;

    const currentPage = page ? parseInt(page, 10) : 1;

    // Номын нэрийг авахын тулд мэдээллийг татна
    const manga = await fetchMangaByIdServer(mangaId);

    if (!manga) {
      notFound();
    }

    // Дэвсгэр, буцах товч, гарчгийг ChapterTable өөрөө агуулдаг
    return <ChapterTable mangaId={mangaId} mangaTitle={manga.title} page={currentPage} />;
  } catch (error) {
    console.error("Error loading chapters page:", error);
    notFound();
  }
}

export async function generateMetadata({ params }: Props) {
  try {
    const { mangaId } = await params;
    const manga = await fetchMangaByIdServer(mangaId);

    if (!manga) {
      return {
        title: "Manga Not Found",
      };
    }

    return {
      title: `${manga.title} - Chapters | Admin Panel`,
      description: `Manage chapters for ${manga.title}`,
    };
  } catch (error) {
    return {
      title: "Chapters | Admin Panel",
    };
  }
}