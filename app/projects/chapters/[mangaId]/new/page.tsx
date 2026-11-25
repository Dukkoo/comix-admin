// app/projects/chapters/[mangaId]/new/page.tsx
import { notFound } from "next/navigation";
import NewChapterForm from "./new-chapter-form";
import NovelChapterForm from "@/components/novel-chapter-form";
import { fetchMangaByIdServer } from "@/utils/server-manga-api";

type Props = {
  params: Promise<{
    mangaId: string;
  }>;
  // ?type=novel бол текстэн (novel) бүлгийн форм, үгүй бол зурагтай манхва бүлгийн форм
  searchParams: Promise<{
    type?: string | string[];
  }>;
};

const isNovelType = (type: string | string[] | undefined) =>
  (Array.isArray(type) ? type[0] : type) === "novel";

export default async function NewChapterPage({ params, searchParams }: Props) {
  try {
    const { mangaId } = await params;
    const { type } = await searchParams;

    // Номын нэрийг авахын тулд мэдээллийг татна
    const manga = await fetchMangaByIdServer(mangaId);

    if (!manga) {
      notFound();
    }

    // Дэвсгэр, буцах товч, гарчгийг форм өөрөө агуулдаг
    if (isNovelType(type)) {
      return <NovelChapterForm mode="create" mangaId={mangaId} mangaTitle={manga.title} />;
    }

    return <NewChapterForm mangaId={mangaId} mangaTitle={manga.title} />;
  } catch (error) {
    console.error("Error loading new chapter page:", error);
    notFound();
  }
}

export async function generateMetadata({ params, searchParams }: Props) {
  try {
    const { mangaId } = await params;
    const { type } = await searchParams;
    const manga = await fetchMangaByIdServer(mangaId);

    if (!manga) {
      return {
        title: "Manga Not Found",
      };
    }

    const label = isNovelType(type) ? "New Novel Chapter" : "New Chapter";

    return {
      title: `${label} - ${manga.title} | Admin Panel`,
      description: `Create a new ${isNovelType(type) ? "novel " : ""}chapter for ${manga.title}`,
    };
  } catch (error) {
    return {
      title: "New Chapter | Admin Panel",
    };
  }
}