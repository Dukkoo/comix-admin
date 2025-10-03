import { Suspense } from "react";
import MangaTable from "./manga-table";

interface AdminProjectsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminProjectsPage({ searchParams }: AdminProjectsPageProps) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;

  return (
    <div className="pl-12">
      <Suspense fallback={<MangaTableSkeleton />}>
        <MangaTable page={page} />
      </Suspense>
    </div>
  );
}

// Simple loading skeleton
function MangaTableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex justify-end mb-4">
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>
      <div className="space-y-4">
        <div className="h-12 bg-gray-200 rounded"></div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded"></div>
        ))}
      </div>
    </div>
  );
}