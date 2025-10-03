import { Suspense } from "react";
import MangaTable from "./manga-table";

interface AdminProjectsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminProjectsPage({ searchParams }: AdminProjectsPageProps) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;

  return (
    <div className="w-full p-6 bg-zinc-900">
      <Suspense fallback={<MangaTableSkeleton />}>
        <MangaTable page={page} />
      </Suspense>
    </div>
  );
}

function MangaTableSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <span className="loader"></span>
      <p className="mt-4 text-zinc-400">Уншиж байна...</p>
    </div>
  );
}