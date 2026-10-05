// app/projects/chapters/[mangaId]/chapter-table.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, Plus, Trash2, Search, X, Gift, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/app/providers";
import { fetchChapters, deleteChapter, updateChapter, Chapter } from "@/utils/chapter-api";

export default function ChapterTable({
  mangaId,
  mangaTitle,
}: {
  mangaId: string;
  mangaTitle: string;
  page?: number;
}) {
  const auth = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    chapterId: "",
    chapterNumber: 0,
  });

  const loadChapters = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Бүх бүлгийг нэг дор авна (хуудаслалтгүй)
      const result = await fetchChapters(mangaId, 1, 9999);
      // Хамгийн сүүлийнх нь эхэнд
      const sorted = [...(result.data || [])].sort((a, b) => b.chapterNumber - a.chapterNumber);
      setChapters(sorted);
    } catch (error) {
      console.error("Error loading chapters:", error);
      setLoadError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mangaId]);

  const visible = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return chapters;
    return chapters.filter((chapter) => chapter.chapterNumber.toString().includes(q));
  }, [chapters, searchQuery]);

  const showDeleteDialog = (chapterId: string, chapterNumber: number) => {
    setDeleteDialog({ isOpen: true, chapterId, chapterNumber });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ isOpen: false, chapterId: "", chapterNumber: 0 });
  };

  const handleDelete = async () => {
    const { chapterId, chapterNumber } = deleteDialog;

    setDeleting(true);
    // "Хүлээлт" toast хаагдахгүй үлддэг байсан тул нэг toast-ыг шинэчилнэ
    const toastId = toast.loading("Устгаж байна...");

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Нэвтрээгүй байна", { id: toastId });
        return;
      }

      const response = await deleteChapter(mangaId, chapterId, token);

      if (response.error) {
        toast.error("Устгаж чадсангүй", { id: toastId, description: response.message });
        return;
      }

      toast.success("Устгагдлаа", { id: toastId, description: `Бүлэг ${chapterNumber}` });
      setChapters((prev) => prev.filter((chapter) => chapter.id !== chapterId));
    } catch (error) {
      console.error("Error deleting chapter:", error);
      toast.error("Устгаж чадсангүй", { id: toastId });
    } finally {
      setDeleting(false);
      closeDeleteDialog();
    }
  };

  const handleToggleFree = async (chapter: Chapter) => {
    try {
      setTogglingId(chapter.id);
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Нэвтрээгүй байна");
        return;
      }

      const newIsFree = !chapter.isFree;

      const response = await updateChapter(
        mangaId,
        chapter.id,
        {
          chapterNumber: chapter.chapterNumber,
          mangaId,
          isFree: newIsFree,
        },
        token
      );

      if (response.error) {
        toast.error("Өөрчилж чадсангүй", { description: response.message });
        return;
      }

      setChapters((prev) =>
        prev.map((ch) => (ch.id === chapter.id ? { ...ch, isFree: newIsFree } : ch))
      );

      toast.success(
        newIsFree
          ? `Бүлэг ${chapter.chapterNumber} үнэгүй боллоо`
          : `Бүлэг ${chapter.chapterNumber} эрхтэй боллоо`
      );
    } catch (error) {
      console.error("Error toggling isFree:", error);
      toast.error("Өөрчилж чадсангүй");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="cyber-bg flex min-h-screen w-full items-center justify-center">
        <span className="loader relative z-10"></span>
      </div>
    );
  }

  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6 [&_a]:rounded-[3px] [&_button]:rounded-[3px] [&_.cyber-panel::after]:hidden [&_.cyber-panel::before]:hidden">
      <div className="relative z-10">
        {/* Toolbar: доош scroll хийхэд дээр нь тогтоно */}
        <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex flex-col gap-3 bg-[#04050a]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3 lg:flex-1">
            <Link href="/projects" aria-label="Буцах" className="cyber-btn shrink-0 p-2.5">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-display min-w-0 truncate text-xl font-bold text-white sm:text-2xl" title={mangaTitle}>
              {mangaTitle}
            </h1>
            <span className="flex shrink-0 items-baseline gap-1.5 border border-[#00f0ff]/50 bg-[#00f0ff]/10 px-3 py-1 shadow-[0_0_14px_rgba(0,240,255,0.25)]">
              <span className="font-display text-xl font-extrabold leading-none tabular-nums text-[#00f0ff]">
                {searchQuery.trim() ? `${visible.length}/${chapters.length}` : chapters.length}
              </span>
              <span className="text-xs font-medium text-white">бүлэг</span>
            </span>
            <Link
              href={`/projects/edit/${mangaId}`}
              aria-label="Зурагт ном засах"
              title="Зурагт ном засах"
              className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-white/[0.03] text-zinc-300 transition-colors hover:border-[#8b6cff]/60 hover:bg-[#8b6cff]/15 hover:text-white"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Бүлгийн тоогоор хайх"
              aria-label="Бүлгийн тоогоор хайх"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-white/10 bg-black/30 py-2 pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Хайлт цэвэрлэх"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Link
            href={`/projects/chapters/${mangaId}/new`}
            className="cyber-btn flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium"
            style={{ borderColor: "rgba(0,240,255,0.6)", backgroundColor: "rgba(0,240,255,0.15)" }}
          >
            <Plus className="h-4 w-4" />
            Шинэ бүлэг
          </Link>
        </div>

        {loadError ? (
          <div className="cyber-panel cyber-panel-warn flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-display font-semibold text-[#ff2e88]">Бүлгүүд ачаалж чадсангүй</p>
            <p className="max-w-md text-sm text-zinc-400">{loadError}</p>
            <button type="button" onClick={loadChapters} className="cyber-btn px-5 py-2 text-sm">
              Дахин оролдох
            </button>
          </div>
        ) : chapters.length === 0 ? (
          <div className="cyber-panel flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
            <Layers className="h-10 w-10 text-zinc-600" />
            <p className="text-zinc-300">Одоогоор бүлэг нэмэгдээгүй байна</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="cyber-panel flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <Search className="h-10 w-10 text-zinc-600" />
            <p className="text-zinc-300">Бүлэг олдсонгүй</p>
            <button type="button" onClick={() => setSearchQuery("")} className="cyber-btn px-5 py-2 text-sm">
              Хайлт цэвэрлэх
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visible.map((chapter) => (
              <article
                key={chapter.id}
                className="cyber-panel flex flex-col gap-2.5 p-3 transition-colors hover:border-[#00f0ff]/50"
                style={chapter.isFree ? { borderColor: "rgba(61,220,151,0.35)" } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-extrabold leading-none tabular-nums text-[#00f0ff] [text-shadow:0_0_14px_rgba(0,240,255,0.5)]">
                      {chapter.chapterNumber}
                    </span>
                    <span className="text-xs font-medium text-zinc-200">бүлэг</span>
                  </div>
                  {chapter.isFree && (
                    <span className="flex items-center gap-1 border border-[#3ddc97]/40 bg-[#3ddc97]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#3ddc97]">
                      <Gift className="h-3 w-3" />
                      Үнэгүй
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Үнэгүй эсэх */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={chapter.isFree}
                    aria-label="Үнэгүй"
                    title="Үнэгүй эсэхийг солих"
                    onClick={() => handleToggleFree(chapter)}
                    disabled={togglingId === chapter.id}
                    className={`relative h-5 w-9 shrink-0 border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      chapter.isFree
                        ? "border-[#3ddc97]/70 bg-[#3ddc97]/25 shadow-[0_0_10px_rgba(61,220,151,0.35)]"
                        : "border-white/20 bg-white/5"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-3.5 w-3.5 transition-all ${
                        chapter.isFree ? "left-[18px] bg-[#3ddc97]" : "left-0.5 bg-zinc-500"
                      }`}
                    />
                  </button>

                  <Link
                    href={`/projects/chapters/${mangaId}/edit/${chapter.id}`}
                    className="flex h-7 flex-1 items-center justify-center gap-1 border border-[#8b6cff]/50 bg-[#8b6cff]/10 text-[11px] font-medium text-[#c4b5ff] transition-colors hover:bg-[#8b6cff]/25 hover:text-white"
                  >
                    <Edit2 className="h-3 w-3" />
                    Засах
                  </Link>

                  <button
                    type="button"
                    onClick={() => showDeleteDialog(chapter.id, chapter.chapterNumber)}
                    aria-label="Устгах"
                    title="Устгах"
                    className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) closeDeleteDialog();
        }}
      >
        <DialogContent className="border border-[#ff2e88]/40 bg-[#0b0e1c] text-white">
          <DialogHeader>
            <DialogTitle className="font-display">Бүлэг устгах</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Бүлэг {deleteDialog.chapterNumber}-ийг устгана. Сэргээх боломжгүй.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closeDeleteDialog}
              disabled={deleting}
              className="cyber-btn rounded-[3px] px-5 py-2 text-sm"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-[3px] border border-[#ff2e88]/70 bg-[#ff2e88]/25 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#ff2e88]/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Устгаж байна..." : "Устгах"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}