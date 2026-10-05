// app/projects/edit/[mangaId]/edit-manga-form.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, SaveIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { deleteFromR2Server, uploadToR2Server } from "@/app/actions/upload";
import { MangaGenre, GENRE_LABELS } from "@/validation/mangaSchema";

interface EditMangaFormProps {
  mangaId: string;
}

const ALL_GENRES: MangaGenre[] = [
  "action", "adventure", "comedy", "romance", "horror",
  "fantasy", "sci-fi", "mystery", "thriller", "drama",
  "sports", "regression", "system", "villain", "murim",
  "reincarnation", "magic", "revenge", "genius-mc",
];

const MAX_GENRES = 5;
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

const TYPE_OPTIONS = [
  { value: "manga", label: "Манга" },
  { value: "manhwa", label: "Манхва" },
  { value: "manhua", label: "Манхуа" },
  { value: "webtoon", label: "Вебтүүн" },
  { value: "comic", label: "Комик" },
] as const;

const STATUS_OPTIONS = [
  { value: "ongoing", label: "Гарч байгаа" },
  { value: "finished", label: "Дууссан" },
] as const;

type ImageKey = "mangaImage" | "coverImage" | "avatarImage";

interface ImageState {
  url: string; // хадгалагдсан зураг
  file: File | null; // шинээр сонгосон зураг
  preview: string; // шинэ зургийн preview
}

const IMAGE_KEYS: ImageKey[] = ["mangaImage", "coverImage", "avatarImage"];
const FOLDER: Record<ImageKey, string> = { mangaImage: "manga", coverImage: "cover", avatarImage: "avatar" };

const EMPTY_IMAGES: Record<ImageKey, ImageState> = {
  mangaImage: { url: "", file: null, preview: "" },
  coverImage: { url: "", file: null, preview: "" },
  avatarImage: { url: "", file: null, preview: "" },
};

const INPUT =
  "w-full border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40 disabled:opacity-50";

const chipClass = (active: boolean) =>
  `border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    active
      ? "border-[#00f0ff]/70 bg-[#00f0ff]/15 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]"
      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-white"
  }`;

// R2-ээс устгахын тулд зургийн URL-ийг storage path болгоно
const toStoragePath = (url: string) => {
  try {
    if (url.startsWith("http")) return new URL(url).pathname.substring(1);
    return url.startsWith("/") ? url.substring(1) : url;
  } catch {
    return "";
  }
};

function ImageSlot({
  label,
  src,
  aspect,
  className = "",
  onSelect,
  onClear,
}: {
  label: string;
  src: string;
  aspect: string;
  className?: string;
  onSelect: (file: File | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onSelect(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {!src ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={`${label}: зураг оруулах`}
          className={`flex w-full flex-col items-center justify-center gap-2 border border-dashed border-[#00f0ff]/30 bg-black/20 text-zinc-400 transition-colors hover:border-[#00f0ff]/70 hover:bg-[#00f0ff]/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${aspect}`}
        >
          <Upload
            className="h-7 w-7 text-[#00f0ff]"
            style={{ filter: "drop-shadow(0 0 6px rgba(0,240,255,0.5))" }}
          />
          <span className="px-2 text-center text-sm">{label}</span>
        </button>
      ) : (
        <div className={`relative w-full overflow-hidden border border-[#00f0ff]/30 ${aspect}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={label} className="h-full w-full object-cover" />

          <span className="absolute bottom-1.5 left-1.5 bg-black/80 px-1.5 py-0.5 text-[11px] text-zinc-200">
            {label}
          </span>

          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="border border-white/20 bg-black/75 px-2 py-1 text-xs text-white transition-colors hover:bg-black"
            >
              Солих
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Зураг хасах"
              className="flex h-7 w-7 items-center justify-center border border-[#ff2e88]/60 bg-[#ff2e88]/30 text-white transition-colors hover:bg-[#ff2e88]/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditMangaForm({ mangaId }: EditMangaFormProps) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [originalImages, setOriginalImages] = useState({
    mangaImage: "",
    coverImage: "",
    avatarImage: "",
  });
  const [images, setImages] = useState<Record<ImageKey, ImageState>>(EMPTY_IMAGES);

  const [formData, setFormData] = useState({
    title: "",
    type: "",
    status: "ongoing" as "ongoing" | "finished",
    description: "",
  });
  const [selectedGenres, setSelectedGenres] = useState<MangaGenre[]>([]);

  // Preview URL-уудыг хуудаснаас гарахад чөлөөлнө
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => {
    return () => {
      Object.values(imagesRef.current).forEach((img) => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, []);

  useEffect(() => {
    loadManga();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mangaId]);

  const loadManga = async () => {
    if (!mangaId) {
      toast.error("Зурагт номын ID олдсонгүй");
      router.push("/projects");
      return;
    }

    try {
      const response = await fetch(`/api/mangas/${mangaId}`);

      if (!response.ok) {
        toast.error("Зурагт ном татаж чадсангүй");
        router.push("/projects");
        return;
      }

      const result = await response.json();

      if (result.data) {
        setFormData({
          title: result.data.title || "",
          type: result.data.type || "",
          status: result.data.status || "ongoing",
          description: result.data.description || "",
        });

        const loaded = {
          mangaImage: result.data.mangaImage || "",
          coverImage: result.data.coverImage || "",
          avatarImage: result.data.avatarImage || "",
        };
        setOriginalImages(loaded);
        setImages({
          mangaImage: { url: loaded.mangaImage, file: null, preview: "" },
          coverImage: { url: loaded.coverImage, file: null, preview: "" },
          avatarImage: { url: loaded.avatarImage, file: null, preview: "" },
        });

        setSelectedGenres(result.data.genres || []);
      } else {
        toast.error("Зурагт номын мэдээлэл олдсонгүй");
      }
    } catch (error) {
      console.error("Error loading manga:", error);
      toast.error("Зурагт ном татаж чадсангүй");
      router.push("/projects");
    } finally {
      setInitialLoading(false);
    }
  };

  const selectImage = (key: ImageKey, file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Зөвхөн зураг сонгоно уу");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Зураг 50MB-аас бага байх ёстой");
      return;
    }

    setImages((prev) => {
      if (prev[key].preview) URL.revokeObjectURL(prev[key].preview);
      return { ...prev, [key]: { ...prev[key], file, preview: URL.createObjectURL(file) } };
    });
  };

  const clearImage = (key: ImageKey) => {
    setImages((prev) => {
      if (prev[key].preview) URL.revokeObjectURL(prev[key].preview);
      return { ...prev, [key]: { url: "", file: null, preview: "" } };
    });
  };

  const toggleGenre = (genre: MangaGenre) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genre)) {
        return prev.filter((g) => g !== genre);
      }
      if (prev.length >= MAX_GENRES) {
        toast.warning(`Хамгийн ихдээ ${MAX_GENRES} жанр сонгоно`);
        return prev;
      }
      return [...prev, genre];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const toastId = toast.loading("Зураг боловсруулж байна...");

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Нэвтрээгүй байна", { id: toastId });
        return;
      }

      const finalUrls: Record<ImageKey, string> = { mangaImage: "", coverImage: "", avatarImage: "" };
      const imagesToDelete: string[] = [];

      for (const key of IMAGE_KEYS) {
        const { file, url } = images[key];
        const originalUrl = originalImages[key];

        if (file) {
          toast.loading("Зураг хуулж байна...", { id: toastId });

          const timestamp = Date.now();
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const path = `mangas/${mangaId}/${FOLDER[key]}/${timestamp}-${cleanFileName}`;

          const arrayBuffer = await file.arrayBuffer();
          const result = await uploadToR2Server(arrayBuffer, path, file.type);

          if (result.error || !result.url) throw new Error(`Failed to upload ${key}`);

          finalUrls[key] = result.url;
          if (originalUrl) imagesToDelete.push(originalUrl); // солигдсон хуучин зураг
        } else {
          finalUrls[key] = url;
          if (!url && originalUrl) imagesToDelete.push(originalUrl); // хасагдсан зураг
        }
      }

      toast.loading("Хадгалж байна...", { id: toastId });

      const response = await fetch(`/api/mangas/${mangaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          genres: selectedGenres,
          mangaImage: finalUrls.mangaImage,
          coverImage: finalUrls.coverImage,
          avatarImage: finalUrls.avatarImage,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error) {
        toast.error("Хадгалж чадсангүй", { id: toastId, description: result.message });
        return;
      }

      // Хадгалалт амжилттай болсны дараа хуучин зургуудыг storage-оос устгана
      if (imagesToDelete.length > 0) {
        const deleteResults = await Promise.allSettled(
          imagesToDelete.map((url) => deleteFromR2Server(toStoragePath(url)))
        );
        const failedDeletes = deleteResults.filter((r) => r.status === "rejected").length;
        if (failedDeletes > 0) {
          toast.warning(`${failedDeletes} хуучин зургийг устгаж чадсангүй`);
        }
      }

      toast.success("Хадгалагдлаа", { id: toastId });
      router.push("/projects");
    } catch (error) {
      console.error("Error updating manga:", error);
      toast.error("Алдаа гарлаа. Дахин оролдоно уу", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="cyber-bg flex min-h-screen w-full items-center justify-center">
        <span className="loader relative z-10"></span>
      </div>
    );
  }

  const canSubmit = !loading && formData.title.trim() !== "" && formData.type !== "" && selectedGenres.length > 0;

  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/projects" aria-label="Буцах" className="cyber-btn p-2.5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-2xl font-bold text-white">Засварлах</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={loading}
            className="m-0 grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-[280px_minmax(0,1fr)]"
          >
            {/* Зүүн: зургууд */}
            <div className="cyber-panel space-y-4 p-4">
              <ImageSlot
                label="Нүүр зураг"
                src={images.mangaImage.preview || images.mangaImage.url}
                aspect="aspect-[3/4]"
                onSelect={(file) => selectImage("mangaImage", file)}
                onClear={() => clearImage("mangaImage")}
              />
              <ImageSlot
                label="Арын зураг"
                src={images.coverImage.preview || images.coverImage.url}
                aspect="aspect-video"
                onSelect={(file) => selectImage("coverImage", file)}
                onClear={() => clearImage("coverImage")}
              />
              <ImageSlot
                label="Аватар зураг"
                src={images.avatarImage.preview || images.avatarImage.url}
                aspect="aspect-square"
                className="w-1/2"
                onSelect={(file) => selectImage("avatarImage", file)}
                onClear={() => clearImage("avatarImage")}
              />
            </div>

            {/* Баруун: мэдээлэл */}
            <div className="cyber-panel space-y-6 p-5">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-zinc-300">
                  Нэр
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  maxLength={100}
                  required
                  className={INPUT}
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-zinc-300">Төрөл</span>
                <div role="radiogroup" aria-label="Төрөл" className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={formData.type === option.value}
                      onClick={() => setFormData((prev) => ({ ...prev, type: option.value }))}
                      className={chipClass(formData.type === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-zinc-300">Төлөв</span>
                <div role="radiogroup" aria-label="Төлөв" className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={formData.status === option.value}
                      onClick={() => setFormData((prev) => ({ ...prev, status: option.value }))}
                      className={chipClass(formData.status === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-300">Жанр</span>
                  <span
                    className={`font-display text-sm tabular-nums ${
                      selectedGenres.length === 0 ? "text-[#ff2e88]" : "text-[#00f0ff]"
                    }`}
                  >
                    {selectedGenres.length}/{MAX_GENRES}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_GENRES.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      aria-pressed={selectedGenres.includes(genre)}
                      onClick={() => toggleGenre(genre)}
                      className={chipClass(selectedGenres.includes(genre))}
                    >
                      {GENRE_LABELS[genre]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-zinc-300">
                  Товч тайлбар
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  maxLength={1000}
                  className={`${INPUT} min-h-[120px] resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="cyber-btn flex w-full items-center justify-center gap-2 px-6 py-3 text-base font-semibold"
                style={{ borderColor: "rgba(0,240,255,0.6)", backgroundColor: "rgba(0,240,255,0.15)" }}
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#00f0ff] border-b-transparent" />
                    Хадгалж байна...
                  </>
                ) : (
                  <>
                    <SaveIcon className="h-5 w-5" />
                    Хадгалах
                  </>
                )}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}