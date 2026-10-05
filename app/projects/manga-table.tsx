// app/projects/manga-table.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Edit2, Plus, Trash2, Search, X, BookOpen } from "lucide-react";
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
import { fetchMangas, deleteManga, Manga } from "@/utils/manga-api";

const BASE_PATH = "/projects";
const FETCH_SIZE = 100; // нэг дуудлагад авах тоо (API-ийн хязгаараас хамаарч totalPages өөрөө тохирно)
const MAX_PAGES = 30; // хамгаалалт: хамгийн ихдээ 3000 ном

type TabKey = "adventure" | "romance";

const TABS: { key: TabKey; label: string; accent: string }[] = [
  { key: "adventure", label: "Адал явдалт", accent: "#ffd23f" },
  { key: "romance", label: "Романс", accent: "#ff2e88" },
];

// ===== АНГИЛАЛ =====
// Дүрэм: номын genre (төрөл) дотор "Romance" / "Романс" байвал Романс, эс бөгөөс Адал явдалт.
// Нэрэнд genre, categor, tag, type гэсэн үг агуулсан бүх талбарыг шалгана.
// Утга нь текст, массив, эсвэл дотроо объекттой байсан ч хайна.
const CATEGORY_KEY_PATTERN = /genre|categor|tag|type/i;
const ROMANCE_KEYWORDS = ["romance", "романс"];

const TYPE_STYLE: Record<string, { label: string; color: string }> = {
  manga: { label: "Манга", color: "#00f0ff" },
  manhwa: { label: "Манхва", color: "#8b6cff" },
  manhua: { label: "Манхуа", color: "#ff2e88" },
  webtoon: { label: "Вебтүүн", color: "#3ddc97" },
  comic: { label: "Комик", color: "#ffd23f" },
};

const categoryText = (manga: Manga) => {
  const record = manga as unknown as Record<string, unknown>;
  return Object.keys(record)
    .filter((key) => CATEGORY_KEY_PATTERN.test(key))
    .map((key) => {
      const value = record[key];
      if (value === null || value === undefined) return "";
      return typeof value === "string" ? value : JSON.stringify(value);
    })
    .join(" ")
    .toLowerCase();
};

const matchesSearch = (manga: Manga, q: string) =>
  !q || (manga.title || "").toLowerCase().includes(q);

// Бүх номыг хуудас хуудсаар нь татаж нэгтгэнэ (хуудаслалтгүй харуулахын тулд)
const loadAllMangas = async (): Promise<Manga[]> => {
  const first = await fetchMangas(1, FETCH_SIZE, "");
  const totalPages = Math.min(first.totalPages || 1, MAX_PAGES);

  const rest =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => fetchMangas(i + 2, FETCH_SIZE, ""))
        )
      : [];

  const unique = new Map<string, Manga>();
  [first, ...rest].forEach((result) => {
    (result.data || []).forEach((manga: Manga) => unique.set(manga.id, manga));
  });
  return Array.from(unique.values());
};

export default function MangaTable() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "adventure";

  const [allMangas, setAllMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    mangaId: "",
    title: "",
  });

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAllMangas(await loadAllMangas());
    } catch (error) {
      console.error("Error loading mangas:", error);
      setLoadError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Романс гэсэн төрөлтэй ном = Романс, бусад бүгд = Адал явдалт
  const romanceIds = useMemo(() => {
    const ids = new Set<string>();
    allMangas.forEach((manga) => {
      const text = categoryText(manga);
      if (ROMANCE_KEYWORDS.some((k) => text.includes(k))) ids.add(manga.id);
    });
    return ids;
  }, [allMangas]);

  // Романс нэг ч танигдаагүй бол бүх ном Адал явдалт-д орно. Шалтгааныг console дээр тайлбарлана.
  useEffect(() => {
    if (allMangas.length === 0 || romanceIds.size > 0) return;

    const keys = Object.keys(allMangas[0] as object);
    const hasGenreKey = keys.some((key) => /genre|categor|tag/i.test(key)); // `type` нь формат (manga/manhwa), жанр биш

    console.warn(
      hasGenreKey
        ? "[projects] Романс төрөлтэй ном олдсонгүй (genre талбар байгаа боловч Romance агуулсан ном алга)."
        : "[projects] Номын жагсаалтад genre талбар ирээгүй байна. /api/mangas болон fetchMangas нь genre-г буцаадаг эсэхийг шалгана уу.",
      "Талбарууд:",
      keys,
      "Эхний ном:",
      allMangas[0]
    );
  }, [allMangas, romanceIds]);

  const counts = useMemo(
    () => ({ romance: romanceIds.size, adventure: allMangas.length - romanceIds.size }),
    [romanceIds, allMangas.length]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMangas.filter(
      (manga) => (tab === "romance") === romanceIds.has(manga.id) && matchesSearch(manga, q)
    );
  }, [allMangas, romanceIds, tab, search]);

  // Хайлт нөгөө ангилалд илэрц өгөх эсэх (одоогийн ангилалд олдохгүй үед санал болгоно)
  const otherTab: TabKey = tab === "romance" ? "adventure" : "romance";
  const otherMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return 0;
    return allMangas.filter(
      (manga) => (otherTab === "romance") === romanceIds.has(manga.id) && matchesSearch(manga, q)
    ).length;
  }, [allMangas, romanceIds, otherTab, search]);

  const changeTab = (next: TabKey) => {
    router.replace(next === "adventure" ? BASE_PATH : `${BASE_PATH}?tab=${next}`);
  };

  const showDeleteDialog = (mangaId: string, title: string) => {
    setDeleteDialog({ isOpen: true, mangaId, title });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ isOpen: false, mangaId: "", title: "" });
  };

  const handleDelete = async () => {
    const { mangaId } = deleteDialog;

    setDeleting(true);
    // Нэг toast-ыг "хүлээлт" -> "амжилттай/алдаа" болгож шинэчилнэ (хаагдахгүй үлдэхгүй)
    const toastId = toast.loading("Устгаж байна...");

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Нэвтрээгүй байна", { id: toastId });
        return;
      }

      const response = (await deleteManga(mangaId, token)) as any;

      if (response?.error) {
        toast.error("Устгаж чадсангүй", { id: toastId, description: response.message });
        return;
      }

      const summary = response?.summary;
      const parts: string[] = [];
      if (summary?.storageFilesDeleted > 0) parts.push(`${summary.storageFilesDeleted} файл`);
      if (summary?.chaptersDeleted > 0) parts.push(`${summary.chaptersDeleted} бүлэг`);

      toast.success("Устгагдлаа", {
        id: toastId,
        description: parts.length > 0 ? `${parts.join(", ")} устгагдлаа` : undefined,
      });

      setAllMangas((prev) => prev.filter((m) => m.id !== mangaId));
    } catch (error) {
      console.error("Error deleting manga:", error);
      toast.error("Устгаж чадсангүй", { id: toastId });
    } finally {
      setDeleting(false);
      closeDeleteDialog();
    }
  };

  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
      <div className="relative z-10">
        {/* Toolbar: доош scroll хийхэд дээр нь тогтоно */}
        <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex flex-col gap-3 bg-[#04050a]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6 lg:flex-row lg:items-center">
          <div role="tablist" aria-label="Ангилал" className="flex shrink-0 gap-2 overflow-x-auto">
            {TABS.map((t) => {
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => changeTab(t.key)}
                  className={`flex shrink-0 items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00f0ff] ${
                    isActive ? "text-white" : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: `${t.accent}99`,
                          backgroundColor: `${t.accent}14`,
                          boxShadow: `0 0 20px ${t.accent}26`,
                        }
                      : undefined
                  }
                >
                  {t.label}
                  <span
                    className="font-display tabular-nums"
                    style={{ color: isActive ? t.accent : "#71717a" }}
                  >
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Зурагт ном хайх..."
              aria-label="Зурагт ном хайх"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-white/10 bg-black/30 py-2 pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Хайлт цэвэрлэх"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Link
            href="/projects/new"
            className="cyber-btn flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium"
            style={{ borderColor: "rgba(0,240,255,0.6)", backgroundColor: "rgba(0,240,255,0.15)" }}
          >
            <Plus className="h-4 w-4" />
            Шинэ зурагт ном
          </Link>
        </div>

        {loading ? (
          <MangaGridSkeleton />
        ) : loadError ? (
          <div className="cyber-panel cyber-panel-warn flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-display font-semibold text-[#ff2e88]">Жагсаалт ачаалж чадсангүй</p>
            <p className="max-w-md text-sm text-zinc-400">{loadError}</p>
            <button type="button" onClick={load} className="cyber-btn px-5 py-2 text-sm">
              Дахин оролдох
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="cyber-panel flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
            {search ? (
              <>
                <Search className="h-10 w-10 text-zinc-600" />
                <p className="text-zinc-300">&quot;{search}&quot; хайлтаар илэрц олдсонгүй</p>
                {otherMatches > 0 && (
                  <button
                    type="button"
                    onClick={() => changeTab(otherTab)}
                    className="cyber-btn px-5 py-2 text-sm"
                    style={{ borderColor: "rgba(0,240,255,0.6)", backgroundColor: "rgba(0,240,255,0.15)" }}
                  >
                    {TABS.find((t) => t.key === otherTab)?.label} ангилалд {otherMatches} илэрц байна
                  </button>
                )}
                <button type="button" onClick={() => setSearch("")} className="cyber-btn px-5 py-2 text-sm">
                  Хайлт цэвэрлэх
                </button>
              </>
            ) : (
              <>
                <BookOpen className="h-10 w-10 text-zinc-600" />
                <p className="text-zinc-300">
                  {allMangas.length === 0 ? "Зурагт ном байхгүй байна" : "Энэ ангилалд ном алга"}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {visible.map((manga) => {
              const typeInfo = TYPE_STYLE[manga.type] ?? TYPE_STYLE.manga;
              const ongoing = manga.status === "ongoing";

              return (
                <article
                  key={manga.id}
                  className="cyber-panel group flex flex-col p-1.5 transition-colors hover:border-[#00f0ff]/50"
                >
                  {/* Карт дээр дарахад бүлгүүд рүү орно */}
                  <Link
                    href={`/projects/chapters/${manga.id}`}
                    aria-label={`${manga.title}: бүлгүүд`}
                    className="block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00f0ff]"
                  >
                    {/* Хавтас */}
                    <div className="relative aspect-[3/4] w-full overflow-hidden border border-white/10 bg-black/40">
                      {manga.mangaImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={manga.mangaImage}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-600">
                          <BookOpen className="h-6 w-6" />
                          <span className="text-[10px]">Зураггүй</span>
                        </div>
                      )}

                      <span
                        className="absolute left-1 top-1 border px-1 py-0.5 text-[10px] font-medium leading-none backdrop-blur-sm"
                        style={{
                          color: typeInfo.color,
                          borderColor: `${typeInfo.color}66`,
                          backgroundColor: "rgba(4,5,10,0.75)",
                        }}
                      >
                        {typeInfo.label}
                      </span>

                      {/* Төлөв: ногоон = гарч байгаа, саарал = дууссан */}
                      <span
                        role="img"
                        aria-label={ongoing ? "Гарч байгаа" : "Дууссан"}
                        title={ongoing ? "Гарч байгаа" : "Дууссан"}
                        className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: ongoing ? "#3ddc97" : "#71717a",
                          boxShadow: ongoing ? "0 0 8px #3ddc97" : "none",
                        }}
                      />

                      {/* Бүлгийн тоо: зургаас үл хамааран тод харагдахын тулд өөрийн дэвсгэртэй */}
                      <div className="absolute bottom-1 left-1 flex items-baseline gap-1 border border-[#00f0ff]/60 bg-black/85 px-1.5 py-1 shadow-[0_0_10px_rgba(0,240,255,0.3)] backdrop-blur-sm">
                        <span className="font-display text-sm font-extrabold leading-none tabular-nums text-[#00f0ff]">
                          {(manga.chapters || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-medium leading-none text-white">бүлэг</span>
                      </div>
                    </div>

                    <h3
                      className="mt-1.5 line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight text-white transition-colors group-hover:text-[#00f0ff]"
                      title={manga.title}
                    >
                      {manga.title}
                    </h3>
                  </Link>

                  {/* Үйлдлүүд: Засах (текстээр) + Устгах (icon) */}
                  <div className="mt-1.5 flex items-center gap-1">
                    <Link
                      href={`/projects/edit/${manga.id}`}
                      className="flex h-7 flex-1 items-center justify-center gap-1 border border-[#8b6cff]/50 bg-[#8b6cff]/10 text-[11px] font-medium text-[#c4b5ff] transition-colors hover:bg-[#8b6cff]/25 hover:text-white"
                    >
                      <Edit2 className="h-3 w-3" />
                      Засах
                    </Link>
                    <button
                      type="button"
                      onClick={() => showDeleteDialog(manga.id, manga.title)}
                      aria-label="Устгах"
                      title="Устгах"
                      className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </article>
              );
            })}
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
            <DialogTitle className="font-display">Зурагт ном устгах</DialogTitle>
            <DialogDescription className="text-zinc-400">
              &quot;{deleteDialog.title}&quot; болон бүх бүлэг, зургийг устгана. Сэргээх боломжгүй.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closeDeleteDialog}
              disabled={deleting}
              className="cyber-btn px-5 py-2 text-sm"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="border border-[#ff2e88]/70 bg-[#ff2e88]/25 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#ff2e88]/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Устгаж байна..." : "Устгах"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MangaGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className="cyber-panel p-1.5">
          <div className="aspect-[3/4] w-full animate-pulse bg-white/5" />
          <div className="mt-1.5 h-8 animate-pulse bg-white/5" />
          <div className="mt-1.5 h-7 animate-pulse bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function MangaTableSkeleton() {
  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="h-10 w-72 animate-pulse bg-white/5" />
          <div className="h-10 flex-1 animate-pulse bg-white/5" />
          <div className="h-10 w-44 animate-pulse bg-white/5" />
        </div>
        <MangaGridSkeleton />
      </div>
    </div>
  );
}