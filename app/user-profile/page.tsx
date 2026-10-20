// [АДМИН САЙТ] app/user-profile/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  X,
  UserCircle,
  Frame,
  ImageOff,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Kind = "avatars" | "borders";

interface ProfileImage {
  id: string;
  url: string;
  path: string;
  name: string;
  active: boolean;
  scale?: number;
  minAura?: number;
  createdAt: number;
}

interface QueuedFile {
  id: string;
  file: File;
  preview: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_QUEUE = 20;
const DEFAULT_SCALE = 1.3;
const DEFAULT_AURA_TIER = 200;

const SECTIONS = [
  { key: "avatars", label: "Профайл зураг", icon: UserCircle, accent: "#00f0ff" },
  { key: "borders", label: "Профайл хүрээ", icon: Frame, accent: "#ff2e88" },
] as const;

const KIND_CONFIG = {
  avatars: {
    endpoint: "/api/profile-images",
    accept: "image/*",
    allowed: (file: File) => file.type.startsWith("image/"),
    hint: "Зураг чирж оруулах эсвэл дарж сонгох",
    subHint: "",
    skippedText: "зөвхөн 5MB-аас бага зураг",
    emptyText: "Зураг хуулаагүй байна",
    tone: "#00f0ff",
  },
  borders: {
    endpoint: "/api/profile-borders",
    accept: "image/png,image/webp,image/gif",
    allowed: (file: File) => ["image/png", "image/webp", "image/gif"].includes(file.type),
    hint: "Хүрээний зураг чирж оруулах эсвэл дарж сонгох",
    subHint: "PNG / WebP / GIF · тунгалаг дэвсгэртэй, голыг нь хоосон · дөрвөлжин",
    skippedText: "зөвхөн 5MB-аас бага PNG, WebP, GIF",
    emptyText: "Хүрээ хуулаагүй байна",
    tone: "#ff2e88",
  },
} as const;

// Хүрээг жишиг аватар дээр харуулна (хэрэглэгчийн сайтад харагдах хэмжээтэй ижил харьцаа)
function FramePreview({ url, scale, active }: { url: string; scale: number; active: boolean }) {
  return (
    <div className="relative flex h-28 w-full items-center justify-center overflow-hidden">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
        <UserCircle className="h-9 w-9" />
      </div>
      <img
        src={url}
        alt=""
        loading="lazy"
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity",
          !active && "opacity-40"
        )}
        style={{ width: `${64 * scale}px`, height: `${64 * scale}px` }}
      />
      {!active && (
        <span className="absolute inset-0 flex items-center justify-center">
          <EyeOff className="h-4 w-4 text-zinc-300" />
        </span>
      )}
    </div>
  );
}

function ScaleControl({
  value,
  disabled,
  onPreview,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <input
        type="range"
        min={1}
        max={2}
        step={0.05}
        value={value}
        disabled={disabled}
        aria-label="Хүрээний хэмжээ"
        onChange={(e) => onPreview(Number(e.target.value))}
        onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        className="h-1 w-full cursor-pointer accent-[#ff2e88] disabled:cursor-not-allowed"
      />
      <span className="w-10 shrink-0 text-right font-mono text-[10px] text-zinc-400">{Math.round(value * 100)}%</span>
    </div>
  );
}

function ImageSection({ kind }: { kind: Kind }) {
  const config = KIND_CONFIG[kind];
  const isBorders = kind === "borders";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<QueuedFile[]>([]);

  const [images, setImages] = useState<ProfileImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "hidden">("all");
  const [tierFilter, setTierFilter] = useState<"all" | "basic" | "aura">("all");
  const [uploadTier, setUploadTier] = useState<"basic" | "aura">("basic");
  const [uploadMinAura, setUploadMinAura] = useState(DEFAULT_AURA_TIER);

  queueRef.current = queue;

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(config.endpoint);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load");
      setImages(result.images || []);
    } catch (error) {
      console.error("Error loading images:", error);
      toast.error("Зургуудыг ачаалахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  const addFiles = (fileList: FileList | File[] | null) => {
    if (!fileList) return;

    const accepted: QueuedFile[] = [];
    let skipped = 0;

    Array.from(fileList).forEach((file) => {
      if (!config.allowed(file) || file.size > MAX_FILE_SIZE) {
        skipped += 1;
        return;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
      });
    });

    if (skipped > 0) {
      toast.error(`${skipped} файл алгасагдлаа (${config.skippedText})`);
    }

    setQueue((prev) => {
      const room = Math.max(0, MAX_QUEUE - prev.length);
      accepted.slice(room).forEach((item) => URL.revokeObjectURL(item.preview));
      if (accepted.length > room) {
        toast.error(`Нэг дор хамгийн ихдээ ${MAX_QUEUE} зураг хуулна`);
      }
      return [...prev, ...accepted.slice(0, room)];
    });
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearQueue = () => {
    queue.forEach((item) => URL.revokeObjectURL(item.preview));
    setQueue([]);
  };

  const uploadAll = async () => {
    if (queue.length === 0 || uploading) return;

    setUploading(true);
    setProgress({ done: 0, total: queue.length });
    let failed = 0;
    let succeeded = 0;

    try {
      for (const item of queue) {
        try {
          const formData = new FormData();
          formData.append("file", item.file);
          if (isBorders) {
            formData.append("minAura", String(uploadTier === "aura" ? uploadMinAura : 0));
          }

          const response = await fetch(config.endpoint, {
            method: "POST",
            body: formData,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Upload failed");

          setImages((prev) => [result.image, ...prev]);
          URL.revokeObjectURL(item.preview);
          setQueue((prev) => prev.filter((queued) => queued.id !== item.id));
          succeeded += 1;
        } catch (error) {
          console.error("Upload failed:", error);
          failed += 1;
        }
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      }

      if (succeeded > 0) toast.success(`${succeeded} зураг амжилттай хуулагдлаа`);
      if (failed > 0) toast.error(`${failed} зураг хуулахад алдаа гарлаа`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Хуулахад алдаа гарлаа");
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (image: ProfileImage) => {
    const next = !image.active;
    setBusyId(image.id);
    setImages((prev) => prev.map((item) => (item.id === image.id ? { ...item, active: next } : item)));

    try {
      const response = await fetch(`${config.endpoint}/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!response.ok) throw new Error("Update failed");
      toast.success(next ? "Идэвхжлээ" : "Нуугдлаа");
    } catch (error) {
      console.error("Toggle failed:", error);
      setImages((prev) => prev.map((item) => (item.id === image.id ? { ...item, active: image.active } : item)));
      toast.error("Өөрчлөхөд алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  const previewScale = (id: string, scale: number) => {
    setImages((prev) => prev.map((item) => (item.id === id ? { ...item, scale } : item)));
  };

  const commitScale = async (image: ProfileImage, scale: number) => {
    try {
      const response = await fetch(`${config.endpoint}/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale }),
      });
      if (!response.ok) throw new Error("Update failed");
      toast.success("Хэмжээ хадгалагдлаа");
    } catch (error) {
      console.error("Scale update failed:", error);
      toast.error("Хэмжээг хадгалахад алдаа гарлаа");
    }
  };

  const commitMinAura = async (image: ProfileImage, value: number) => {
    const minAura = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    if (minAura === (image.minAura ?? 0)) return;

    const previous = image.minAura ?? 0;
    setImages((prev) => prev.map((item) => (item.id === image.id ? { ...item, minAura } : item)));

    try {
      const response = await fetch(`${config.endpoint}/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minAura }),
      });
      if (!response.ok) throw new Error("Update failed");
      toast.success(minAura > 0 ? `Аура ${minAura}+ хэрэгтэй боллоо` : "Бүх эрхтэй хэрэглэгч сонгох боломжтой боллоо");
    } catch (error) {
      console.error("minAura update failed:", error);
      setImages((prev) => prev.map((item) => (item.id === image.id ? { ...item, minAura: previous } : item)));
      toast.error("Аурагийн нөхцөл хадгалахад алдаа гарлаа");
    }
  };

  const deleteImage = async (image: ProfileImage) => {
    setBusyId(image.id);

    try {
      const response = await fetch(`${config.endpoint}/${image.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Delete failed");
      }

      setImages((prev) => prev.filter((item) => item.id !== image.id));
      setConfirmId(null);
      toast.success("Устгагдлаа");
    } catch (error) {
      console.error("Delete failed:", error);
      setConfirmId(null);
      toast.error(
        error instanceof Error && error.message !== "Delete failed"
          ? error.message
          : "Устгахад алдаа гарлаа"
      );
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = images.filter((image) => image.active).length;
  const visibleImages = images
    .filter((image) => (filter === "all" ? true : filter === "active" ? image.active : !image.active))
    .filter((image) =>
      !isBorders || tierFilter === "all" ? true : tierFilter === "aura" ? (image.minAura ?? 0) > 0 : (image.minAura ?? 0) === 0
    );

  const stats = [
    { label: isBorders ? "Нийт хүрээ" : "Нийт зураг", value: images.length, color: "#8b6cff" },
    { label: "Идэвхтэй", value: activeCount, color: "#00f0ff" },
    { label: "Нуусан", value: images.length - activeCount, color: "#ff2e88" },
  ];

  const gridClass = isBorders
    ? "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2"
    : "grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-2";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:grid-rows-1">
      {/* Зүүн: хуулах хэсэг */}
      <section className="cyber-panel flex min-h-[360px] flex-col gap-4 p-4 lg:min-h-0">
        <input
          ref={fileInputRef}
          type="file"
          accept={config.accept}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {isBorders && (
          <div className="shrink-0 space-y-2">
            <p className="text-xs text-zinc-400">Хуулах хүрээний төрөл</p>
            <div role="group" aria-label="Хүрээний төрөл" className="grid grid-cols-2 gap-1 border border-white/10 bg-black/30 p-1">
              {(
                [
                  { key: "basic", label: "Энгийн", hint: "Бүх эрхтэй хэрэглэгч" },
                  { key: "aura", label: "Аура хүрээ", hint: "Аура шаардана" },
                ] as const
              ).map((option) => {
                const isOn = uploadTier === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => setUploadTier(option.key)}
                    className={cn(
                      "flex flex-col items-center px-3 py-2 text-sm font-medium transition-colors",
                      isOn
                        ? "bg-[#ff2e88]/20 text-[#ff2e88] shadow-[0_0_12px_rgba(255,46,136,0.25)]"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {option.label}
                    <span className="text-[10px] font-normal opacity-70">{option.hint}</span>
                  </button>
                );
              })}
            </div>
            {uploadTier === "aura" && (
              <label className="flex items-center justify-between gap-3 border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                Хамгийн багадаа Аура
                <input
                  type="number"
                  min={1}
                  step={10}
                  value={uploadMinAura}
                  onChange={(e) => setUploadMinAura(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
                  className="w-24 border border-white/15 bg-black/40 px-2 py-1 text-right font-mono text-white focus:border-[#ff2e88] focus:outline-none"
                />
              </label>
            )}
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label="Зураг сонгох"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex min-h-[180px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-4 py-8 text-center transition-all focus-visible:outline-none focus-visible:ring-1",
            isBorders ? "focus-visible:ring-[#ff2e88]" : "focus-visible:ring-[#00f0ff]",
            dragOver
              ? isBorders
                ? "border-[#ff2e88] bg-[#ff2e88]/10 shadow-[0_0_28px_rgba(255,46,136,0.25)]"
                : "border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_28px_rgba(0,240,255,0.25)]"
              : isBorders
                ? "border-[#ff2e88]/30 bg-black/20 hover:border-[#ff2e88]/70 hover:bg-[#ff2e88]/5"
                : "border-[#00f0ff]/30 bg-black/20 hover:border-[#00f0ff]/70 hover:bg-[#00f0ff]/5"
          )}
        >
          <Upload
            className="h-10 w-10"
            style={{ color: config.tone, filter: `drop-shadow(0 0 8px ${config.tone}99)` }}
          />
          <p className="text-sm text-white">{config.hint}</p>
          {config.subHint && <p className="max-w-[260px] text-xs text-zinc-400">{config.subHint}</p>}
        </div>

        {queue.length > 0 && (
          <div className="shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-white">{queue.length} зураг</p>
              {!uploading && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="text-xs text-zinc-400 transition-colors hover:text-[#ff2e88]"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>

            <div className="cyber-scroll grid max-h-44 grid-cols-5 gap-2 overflow-y-auto pr-1">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "relative aspect-square overflow-hidden border",
                    isBorders
                      ? "rounded-md border-[#ff2e88]/30 bg-zinc-800/80"
                      : "rounded-full border-[#00f0ff]/30"
                  )}
                >
                  <img
                    src={item.preview}
                    alt=""
                    className={cn("h-full w-full", isBorders ? "object-contain" : "object-cover")}
                  />
                  {!uploading && (
                    <button
                      type="button"
                      aria-label="Хасах"
                      onClick={() => removeFromQueue(item.id)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white transition-colors hover:bg-[#ff2e88]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={uploadAll}
              disabled={uploading}
              className="cyber-btn flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
              style={{
                borderColor: `${config.tone}99`,
                backgroundColor: `${config.tone}26`,
              }}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Хуулж байна {progress.done}/{progress.total}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Хуулах ({queue.length})
                </>
              )}
            </button>

            {uploading && (
              <div className="h-1 w-full overflow-hidden bg-white/10">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    backgroundColor: config.tone,
                    boxShadow: `0 0 10px ${config.tone}`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Баруун: статистик + хуулсан зургууд */}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="cyber-panel cyber-stat px-4 py-3"
              style={{ "--accent": stat.color } as CSSProperties}
            >
              <p className="text-xs text-zinc-400">{stat.label}</p>
              <p className="cyber-glow font-display mt-1 text-3xl font-bold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        <section className="cyber-panel flex min-h-[420px] max-h-[75vh] flex-1 flex-col lg:max-h-none lg:min-h-0">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/5 p-3">
            <div role="group" aria-label="Шүүлтүүр" className="flex gap-1 border border-white/10 bg-black/30 p-1">
              {(
                [
                  { key: "all", label: "Бүгд", count: images.length },
                  { key: "active", label: "Идэвхтэй", count: activeCount },
                  { key: "hidden", label: "Нуусан", count: images.length - activeCount },
                ] as const
              ).map((option) => {
                const isOn = filter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => setFilter(option.key)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors",
                      isOn
                        ? "bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {option.label}
                    <span className="font-display text-xs tabular-nums opacity-70">{option.count}</span>
                  </button>
                );
              })}
            </div>

            {isBorders && (
              <div role="group" aria-label="Төрөл" className="flex gap-1 border border-white/10 bg-black/30 p-1">
                {(
                  [
                    { key: "all", label: "Бүх төрөл" },
                    { key: "basic", label: "Энгийн" },
                    { key: "aura", label: "Аура" },
                  ] as const
                ).map((option) => {
                  const isOn = tierFilter === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => setTierFilter(option.key)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium transition-colors",
                        isOn
                          ? "bg-[#ff2e88]/20 text-[#ff2e88] shadow-[0_0_12px_rgba(255,46,136,0.25)]"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="cyber-scroll min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className={gridClass}>
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="h-36 animate-pulse bg-white/5" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-zinc-500">
                <ImageOff className="h-10 w-10 opacity-60" />
                <p className="text-sm text-zinc-300">{config.emptyText}</p>
              </div>
            ) : visibleImages.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-zinc-500">
                <ImageOff className="h-10 w-10 opacity-60" />
                <p className="text-sm text-zinc-300">Илэрц олдсонгүй</p>
              </div>
            ) : (
              <div className={gridClass}>
                {visibleImages.map((image) => {
                  const isBusy = busyId === image.id;
                  const isConfirming = confirmId === image.id;
                  const scale = image.scale ?? DEFAULT_SCALE;

                  return (
                    <div
                      key={image.id}
                      className="flex flex-col items-center gap-1.5 border border-white/10 bg-white/[0.02] p-2 transition-colors hover:border-[#00f0ff]/40"
                    >
                      {isBorders ? (
                        <FramePreview url={image.url} scale={scale} active={image.active} />
                      ) : (
                        <div className="relative">
                          <img
                            src={image.url}
                            alt={`#${image.id}`}
                            loading="lazy"
                            className={cn(
                              "h-16 w-16 rounded-full object-cover ring-2 transition-all sm:h-20 sm:w-20",
                              image.active
                                ? "ring-[#00f0ff]/70 shadow-[0_0_14px_rgba(0,240,255,0.3)]"
                                : "opacity-40 ring-white/20"
                            )}
                          />
                          {!image.active && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <EyeOff className="h-4 w-4 text-zinc-300" />
                            </span>
                          )}
                        </div>
                      )}

                      <div className="w-full text-center leading-tight">
                        <p className="font-display text-xs font-bold text-[#00f0ff]">#{image.id}</p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {image.createdAt > 0 ? new Date(image.createdAt).toISOString().slice(0, 10) : "-"}
                        </p>
                      </div>

                      {isBorders && (
                        <label className="flex w-full items-center justify-between gap-2 text-[10px] text-zinc-400">
                          <span className={cn((image.minAura ?? 0) > 0 && "text-[#ffd23f]")}>✦ Аура ≥</span>
                          <input
                            key={`${image.id}-${image.minAura ?? 0}`}
                            type="number"
                            min={0}
                            step={10}
                            defaultValue={image.minAura ?? 0}
                            disabled={isBusy}
                            aria-label="Шаардлагатай Аура"
                            onBlur={(e) => commitMinAura(image, Number(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            className="w-16 border border-white/15 bg-black/40 px-1.5 py-0.5 text-right font-mono text-white focus:border-[#ff2e88] focus:outline-none"
                          />
                        </label>
                      )}

                      {isBorders && (
                        <ScaleControl
                          value={scale}
                          disabled={isBusy}
                          onPreview={(value) => previewScale(image.id, value)}
                          onCommit={(value) => commitScale(image, value)}
                        />
                      )}

                      {isConfirming ? (
                        <div className="flex w-full items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => deleteImage(image)}
                            className="flex h-7 flex-1 items-center justify-center gap-0.5 border border-[#ff2e88]/70 bg-[#ff2e88]/25 text-[11px] text-white transition-colors hover:bg-[#ff2e88]/45 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Тийм
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmId(null)}
                            className="h-7 flex-1 border border-white/15 bg-transparent text-[11px] text-zinc-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Үгүй
                          </button>
                        </div>
                      ) : (
                        <div className="flex w-full items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => toggleActive(image)}
                            aria-label={image.active ? "Нуух" : "Идэвхжүүлэх"}
                            title={image.active ? "Идэвхтэй (нуухын тулд дарна)" : "Нуусан (идэвхжүүлэхийн тулд дарна)"}
                            className={cn(
                              "flex h-7 flex-1 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                              image.active
                                ? "cyber-btn"
                                : "border border-white/15 bg-white/[0.03] text-zinc-400 hover:text-white"
                            )}
                          >
                            {image.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            aria-label="Устгах"
                            title="Устгах"
                            onClick={() => setConfirmId(image.id)}
                            className="flex h-7 flex-1 items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const [section, setSection] = useState<Kind>("avatars");

  return (
    // Desktop дээр хуудас дэлгэцэнд багтаж, card дотроо scroll хийнэ
    <div className="cyber-bg flex min-h-screen w-full flex-col p-4 sm:p-6 lg:h-screen">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-6">
        {/* Табууд (Client удирдлагатай ижил) */}
        <div
          role="tablist"
          aria-label="Хэрэглэгчийн профайл"
          className="flex shrink-0 gap-2 overflow-x-auto pb-1"
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.key;

            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSection(item.key)}
                className={`relative flex shrink-0 items-center gap-3 border px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00f0ff] ${
                  isActive ? "text-white" : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: `${item.accent}99`,
                        backgroundColor: `${item.accent}14`,
                        boxShadow: `0 0 20px ${item.accent}26`,
                      }
                    : undefined
                }
              >
                <Icon className="h-4 w-4" style={{ color: isActive ? item.accent : undefined }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <ImageSection key={section} kind={section} />
      </div>
    </div>
  );
}