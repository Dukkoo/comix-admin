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
    // Await params and searchParams
    const { mangaId } = await params;
    const { page } = await searchParams;
    
    // Parse page number
    const currentPage = page ? parseInt(page, 10) : 1;
    
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
                href="/admin/projects" 
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Projects
              </a>
              <span>/</span>
              <a 
                href={`/admin/projects/edit/${mangaId}`}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                {manga.title}
              </a>
              <span>/</span>
              <span className="text-white">Chapters</span>
            </div>
          </nav>

          {/* Chapter Table */}
          <ChapterTable 
            mangaId={mangaId}
            mangaTitle={manga.title}
            page={currentPage}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading chapters page:", error);
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
      title: `${manga.title} - Chapters | Admin Panel`,
      description: `Manage chapters for ${manga.title}`,
    };
  } catch (error) {
    return {
      title: "Chapters | Admin Panel",
    };
  }
}