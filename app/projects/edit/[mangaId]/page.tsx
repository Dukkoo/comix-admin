// app/admin/projects/edit/[mangaId]/page.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import EditMangaForm from "./edit-manga-form";

interface EditMangaPageProps {
  params: Promise<{ mangaId: string }>;
}

export default async function EditMangaPage(props: EditMangaPageProps) {
  const params = await props.params;
  const mangaId = params.mangaId;
  
  console.log("Page: Raw params:", params);
  console.log("Page: Manga ID from params:", mangaId);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-zinc-400 mb-4 px-6 pt-6">
        <Link href="/admin/projects" className="hover:text-white">
          Projects
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-white">Edit Manga {mangaId ? `(${mangaId})` : ""}</span>
      </nav>
      
      <EditMangaForm mangaId={mangaId} />
    </div>
  );
}