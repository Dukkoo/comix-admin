import Link from "next/link";
import { ChevronRight } from "lucide-react";
import NewMangaForm from "./new-manga-form";

export default function NewManga() {
  return (
    <div>
      {/* Simple breadcrumb alternative */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
        <Link href="/admin/projects" className="hover:text-gray-900">
          Projects
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900">New Manga</span>
      </nav>
      
      <NewMangaForm />
    </div>
  );
}