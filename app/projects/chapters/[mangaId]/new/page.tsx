// app/projects/chapters/[mangaId]/new/page.tsx
import { notFound } from "next/navigation";
import NewChapterForm from "./new-chapter-form";
import { fetchMangaByIdServer } from "@/utils/server-manga-api";

type Props = {
  params: Promise<{
    mangaId: string;
  }>;
};

export default async function NewChapterPage({ params }: Props) {
  try {
    const { mangaId } = await params;

    // Номын нэрийг авахын тулд мэдээллийг татна
    const manga = await fetchMangaByIdServer(mangaId);

    if (!manga) {
      notFound();
    }

    // Дэвсгэр, буцах товч, гарчгийг NewChapterForm өөрөө агуулдаг
    return <NewChapterForm mangaId={mangaId} mangaTitle={manga.title} />;
  } catch (error) {
    console.error("Error loading new chapter page:", error);
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
      title: `New Chapter - ${manga.title} | Admin Panel`,
      description: `Create a new chapter for ${manga.title}`,
    };
  } catch (error) {
    return {
      title: "New Chapter | Admin Panel",
    };
  }
}