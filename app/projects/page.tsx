// app/projects/page.tsx
import { Suspense } from "react";
import MangaTable, { MangaTableSkeleton } from "./manga-table";

export default function AdminProjectsPage() {
  // Дэвсгэр, padding-ийг MangaTable өөрөө (cyber-bg) зохицуулдаг тул wrapper div хэрэггүй
  return (
    <Suspense fallback={<MangaTableSkeleton />}>
      <MangaTable />
    </Suspense>
  );
}