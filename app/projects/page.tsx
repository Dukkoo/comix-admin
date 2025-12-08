// app/projects/page.tsx
import { Suspense } from "react";
import MangaTable, { MangaTableSkeleton } from "./manga-table";

export default function AdminProjectsPage() {
  return (
    <div className="w-full p-6 bg-zinc-900">
      <Suspense fallback={<MangaTableSkeleton />}>
        <MangaTable />
      </Suspense>
    </div>
  );
}