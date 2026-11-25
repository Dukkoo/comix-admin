// app/projects/chapters/[mangaId]/chapter-table.tsx
"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Edit2, Plus, Trash2, Search, X, Gift, Layers } from "lucide-react";
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
import {
  fetchNovelChapters,
  deleteNovelChapter,
  updateNovelChapter,
  type NovelChapterSummary,
} from "@/utils/novel-chapter-api";

type Mode = "manhwa" | "novel";

// ?type=novel гэж URL-д байвал novel горимоор нээнэ (шинэ/засах хуудаснаас буцахад хэрэгтэй).
// Ачаалж дуустал зөвхөн spinner харуулдаг тул server/client-ийн эхний render ижил байна.
const getInitialMode = (): Mode => {
  if (typeof window === "undefined") return "manhwa";
  return new URLSearchParams(window.location.search).get("type") === "novel" ? "novel" : "manhwa";
};

type ChapterCardProps = {
  chapterNumber: number;
  isFree: boolean;
  toggling: boolean;
  editHref: string;
  hoverBorderClass: string;
  onToggleFree: () => void;
  onDelete: () => void;
  children?: ReactNode;
};

function ChapterCard({
  chapterNumber,
  isFree,
  toggling,
  editHref,
  hoverBorderClass,
  onToggleFree,
  onDelete,
  children,
}: ChapterCardProps) {
  return (
    <article
      className={`cyber-panel flex flex-col gap-2.5 p-3 transition-colors ${hoverBorderClass}`}
      style={isFree ? { borderColor: "rgba(61,220,151,0.35)" } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-extrabold leading-none tabular-nums text-[#00f0ff] [text-shadow:0_0_14px_rgba(0,240,255,0.5)]">
            {chapterNumber}
          </span>
          <span className="text-xs font-medium text-zinc-200">бүлэг</span>
        </div>
        {isFree && (
          <span className="flex items-center gap-1 border border-[#3ddc97]/40 bg-[#3ddc97]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#3ddc97]">
            <Gift className="h-3 w-3" />
            Үнэгүй
          </span>
        )}
      </div>

      {children}

      <div className="flex items-center gap-1.5">
        {/* Үнэгүй эсэх */}
        <button
          type="button"
          role="switch"
          aria-checked={isFree}
          aria-label="Үнэгүй"
          title="Үнэгүй эсэхийг солих"
          onClick={onToggleFree}
          disabled={toggling}
          className={`relative h-5 w-9 shrink-0 border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isFree
              ? "border-[#3ddc97]/70 bg-[#3ddc97]/25 shadow-[0_0_10px_rgba(61,220,151,0.35)]"
              : "border-white/20 bg-white/5"
          }`}
        >
          <span
            className={`absolute top-0.5 h-3.5 w-3.5 transition-all ${
              isFree ? "left-[18px] bg-[#3ddc97]" : "left-0.5 bg-zinc-500"
            }`}
          />
        </button>

        <Link
          href={editHref}
          className="flex h-7 flex-1 items-center justify-center gap-1 border border-[#8b6cff]/50 bg-[#8b6cff]/10 text-[11px] font-medium text-[#c4b5ff] transition-colors hover:bg-[#8b6cff]/25 hover:text-white"
        >
          <Edit2 className="h-3 w-3" />
          Засах
        </Link>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Устгах"
          title="Устгах"
          className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </article>
  );
}

export default function ChapterTable({
  mangaId,
  mangaTitle,
}: {
  mangaId: string;
  mangaTitle: string;
  page?: number;
}) {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(getInitialMode);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [novelChapters, setNovelChapters] = useState<NovelChapterSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [novelLoadError, setNovelLoadError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    chapterId: string;
    chapterNumber: number;
    kind: Mode;
  }>({
    isOpen: false,
    chapterId: "",
    chapterNumber: 0,
    kind: "manhwa",
  });

  // Манхва болон novel хоёрыг зэрэг ачаална: toggle шууд солигдож, тоо хоёуланд нь харагдана.
  // Нэг нь алдаатай байсан ч нөгөө нь ажиллана.
  const loadChapters = async () => {
    setLoading(true);
    setLoadError(null);
    setNovelLoadError(null);

    const [manhwaResult, novelResult] = await Promise.allSettled([
      // Бүх бүлгийг нэг дор авна (хуудаслалтгүй)
      fetchChapters(mangaId, 1, 9999),
      fetchNovelChapters(mangaId),
    ]);

    if (manhwaResult.status === "fulfilled") {
      // Хамгийн сүүлийнх нь эхэнд
      const sorted = [...(manhwaResult.value.data || [])].sort((a, b) => b.chapterNumber - a.chapterNumber);
      setChapters(sorted);
    } else {
      console.error("Error loading chapters:", manhwaResult.reason);
      setLoadError(manhwaResult.reason instanceof Error ? manhwaResult.reason.message : "Unknown error");
    }

    if (novelResult.status === "fulfilled") {
      setNovelChapters([...novelResult.value].sort((a, b) => b.chapterNumber - a.chapterNumber));
    } else {
      console.error("Error loading novel chapters:", novelResult.reason);
      setNovelLoadError(novelResult.reason instanceof Error ? novelResult.reason.message : "Unknown error");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadChapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mangaId]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;

    setMode(next);
    setSearchQuery("");

    // Сэргээх/refresh хийхэд ижил горимд үлдэхийн тулд URL-д тусгана
    const url = new URL(window.location.href);
    if (next === "novel") url.searchParams.set("type", "novel");
    else url.searchParams.delete("type");
    window.history.replaceState(null, "", url.toString());
  };

  const visibleChapters = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return chapters;
    return chapters.filter((chapter) => chapter.chapterNumber.toString().includes(q));
  }, [chapters, searchQuery]);

  const visibleNovelChapters = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return novelChapters;
    return novelChapters.filter((chapter) => chapter.chapterNumber.toString().includes(q));
  }, [novelChapters, searchQuery]);

  const showDeleteDialog = (chapterId: string, chapterNumber: number, kind: Mode) => {
    setDeleteDialog({ isOpen: true, chapterId, chapterNumber, kind });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog((prev) => ({ ...prev, isOpen: false, chapterId: "", chapterNumber: 0 }));
  };

  const handleDelete = async () => {
    const { chapterId, chapterNumber, kind } = deleteDialog;

    setDeleting(true);
    // "Хүлээлт" toast хаагдахгүй үлддэг байсан тул нэг toast-ыг шинэчилнэ
    const toastId = toast.loading("Устгаж байна...");

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Нэвтрээгүй байна", { id: toastId });
        return;
      }

      const response =
        kind === "novel"
          ? await deleteNovelChapter(mangaId, chapterId, token)
          : await deleteChapter(mangaId, chapterId, token);

      if (response.error) {
        toast.error("Устгаж чадсангүй", { id: toastId, description: response.message });
        return;
      }

      toast.success("Устгагдлаа", {
        id: toastId,
        description: `${kind === "novel" ? "Novel бүлэг" : "Бүлэг"} ${chapterNumber}`,
      });

      if (kind === "novel") {
        setNovelChapters((prev) => prev.filter((chapter) => chapter.id !== chapterId));
      } else {
        setChapters((prev) => prev.filter((chapter) => chapter.id !== chapterId));
      }
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

  const handleToggleNovelFree = async (chapter: NovelChapterSummary) => {
    try {
      setTogglingId(`novel-${chapter.id}`);
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Нэвтрээгүй байна");
        return;
      }

      const newIsFree = !chapter.isFree;
      const response = await updateNovelChapter(mangaId, chapter.id, { isFree: newIsFree }, token);

      if (response.error) {
        toast.error("Өөрчилж чадсангүй", { description: response.message });
        return;
      }

      setNovelChapters((prev) =>
        prev.map((ch) => (ch.id === chapter.id ? { ...ch, isFree: newIsFree } : ch))
      );

      toast.success(
        newIsFree
          ? `Novel бүлэг ${chapter.chapterNumber} үнэгүй боллоо`
          : `Novel бүлэг ${chapter.chapterNumber} эрхтэй боллоо`
      );
    } catch (error) {
      console.error("Error toggling novel isFree:", error);
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

  const isNovel = mode === "novel";
  const activeError = isNovel ? novelLoadError : loadError;
  const totalCount = isNovel ? novelChapters.length : chapters.length;
  const visibleCount = isNovel ? visibleNovelChapters.length : visibleChapters.length;

  const tabs: {
    id: Mode;
    label: string;
    Icon: typeof Layers;
    count: number;
    activeClass: string;
  }[] = [
    {
      id: "manhwa",
      label: "Манхва",
      Icon: Layers,
      count: chapters.length,
      activeClass: "border-[#00f0ff]/60 bg-[#00f0ff]/15 text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]",
    },
    {
      id: "novel",
      label: "Novel",
      Icon: BookOpen,
      count: novelChapters.length,
      activeClass: "border-[#8b6cff]/70 bg-[#8b6cff]/20 text-white shadow-[0_0_12px_rgba(139,108,255,0.3)]",
    },
  ];

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
            <span
              className={`flex shrink-0 items-baseline gap-1.5 border px-3 py-1 ${
                isNovel
                  ? "border-[#8b6cff]/50 bg-[#8b6cff]/10 shadow-[0_0_14px_rgba(139,108,255,0.25)]"
                  : "border-[#00f0ff]/50 bg-[#00f0ff]/10 shadow-[0_0_14px_rgba(0,240,255,0.25)]"
              }`}
            >
              <span
                className={`font-display text-xl font-extrabold leading-none tabular-nums ${
                  isNovel ? "text-[#b8a4ff]" : "text-[#00f0ff]"
                }`}
              >
                {searchQuery.trim() ? `${visibleCount}/${totalCount}` : totalCount}
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

          {/* Манхва / Novel солих */}
          <div
            role="tablist"
            aria-label="Бүлгийн төрөл"
            className="flex shrink-0 gap-0.5 border border-white/15 bg-black/30 p-0.5"
          >
            {tabs.map(({ id, label, Icon, count, activeClass }) => {
              const active = id === mode;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchMode(id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors lg:flex-none ${
                    active ? activeClass : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  <span className="text-xs tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
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
            href={isNovel ? `/projects/chapters/${mangaId}/new?type=novel` : `/projects/chapters/${mangaId}/new`}
            className="cyber-btn flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium"
            style={
              isNovel
                ? { borderColor: "rgba(139,108,255,0.7)", backgroundColor: "rgba(139,108,255,0.2)" }
                : { borderColor: "rgba(0,240,255,0.6)", backgroundColor: "rgba(0,240,255,0.15)" }
            }
          >
            <Plus className="h-4 w-4" />
            {isNovel ? "Шинэ novel бүлэг" : "Шинэ бүлэг"}
          </Link>
        </div>

        {activeError ? (
          <div className="cyber-panel cyber-panel-warn flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-display font-semibold text-[#ff2e88]">
              {isNovel ? "Novel бүлгүүд ачаалж чадсангүй" : "Бүлгүүд ачаалж чадсангүй"}
            </p>
            <p className="max-w-md text-sm text-zinc-400">{activeError}</p>
            <button type="button" onClick={loadChapters} className="cyber-btn px-5 py-2 text-sm">
              Дахин оролдох
            </button>
          </div>
        ) : totalCount === 0 ? (
          <div className="cyber-panel flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
            {isNovel ? <BookOpen className="h-10 w-10 text-zinc-600" /> : <Layers className="h-10 w-10 text-zinc-600" />}
            <p className="text-zinc-300">
              {isNovel ? "Одоогоор novel бүлэг нэмэгдээгүй байна" : "Одоогоор бүлэг нэмэгдээгүй байна"}
            </p>
          </div>
        ) : visibleCount === 0 ? (
          <div className="cyber-panel flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <Search className="h-10 w-10 text-zinc-600" />
            <p className="text-zinc-300">Бүлэг олдсонгүй</p>
            <button type="button" onClick={() => setSearchQuery("")} className="cyber-btn px-5 py-2 text-sm">
              Хайлт цэвэрлэх
            </button>
          </div>
        ) : isNovel ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleNovelChapters.map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapterNumber={chapter.chapterNumber}
                isFree={chapter.isFree}
                toggling={togglingId === `novel-${chapter.id}`}
                editHref={`/projects/chapters/${mangaId}/edit/${chapter.id}?type=novel`}
                hoverBorderClass="hover:border-[#8b6cff]/60"
                onToggleFree={() => handleToggleNovelFree(chapter)}
                onDelete={() => showDeleteDialog(chapter.id, chapter.chapterNumber, "novel")}
              >
                <p className="text-[11px] tabular-nums text-zinc-500">
                  {chapter.charCount.toLocaleString("en-US")} тэмдэгт
                </p>
              </ChapterCard>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleChapters.map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapterNumber={chapter.chapterNumber}
                isFree={chapter.isFree === true}
                toggling={togglingId === chapter.id}
                editHref={`/projects/chapters/${mangaId}/edit/${chapter.id}`}
                hoverBorderClass="hover:border-[#00f0ff]/50"
                onToggleFree={() => handleToggleFree(chapter)}
                onDelete={() => showDeleteDialog(chapter.id, chapter.chapterNumber, "manhwa")}
              />
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
            <DialogTitle className="font-display">
              {deleteDialog.kind === "novel" ? "Novel бүлэг устгах" : "Бүлэг устгах"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {deleteDialog.kind === "novel" ? "Novel бүлэг" : "Бүлэг"} {deleteDialog.chapterNumber}-ийг устгана.
              Сэргээх боломжгүй.
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