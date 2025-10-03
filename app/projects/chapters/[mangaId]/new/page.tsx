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
    // Await params before accessing properties
    const { mangaId } = await params;
    
    // Fetch the manga data to get the title
    const manga = await fetchMangaByIdServer(mangaId);

    if (!manga) {
      notFound();
    }

    return (
      <div className="min-h-screen bg-zinc-900">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb Navigation */}
          <nav className="mb-6">
            <div className="flex items-center space-x-2 text-sm text-zinc-400">
              <a 
                href="/projects" 
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Projects
              </a>
              <span>/</span>
              <a 
                href={`/projects/edit/${mangaId}`}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                {manga.title}
              </a>
              <span>/</span>
              <a 
                href={`/projects/chapters/${mangaId}`}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Chapters
              </a>
              <span>/</span>
              <span className="text-white">New Chapter</span>
            </div>
          </nav>

          {/* New Chapter Form */}
          <NewChapterForm 
            mangaId={mangaId}
            mangaTitle={manga.title}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading new chapter page:", error);
    notFound();
  }
}

// Generate metadata for the page
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