// [АДМИН САЙТ] app/user-profile/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileImage {
  id: string;
  url: string;
  path: string;
  name: string;
  active: boolean;
  createdAt: number;
}

interface QueuedFile {
  id: string;
  file: File;
  preview: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_QUEUE = 20;

const SECTIONS = [
  { key: "avatars", label: "Профайл зураг", icon: UserCircle, ready: true },
  { key: "borders", label: "Профайл хүрээ", icon: Frame, ready: false },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function AvatarSection() {
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

  queueRef.current = queue;

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/profile-images");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load");
      setImages(result.images || []);
    } catch (error) {
      console.error("Error loading profile images:", error);
      toast.error("Зургуудыг ачаалахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (!file.type.startsWith("image/") || file.size > MAX_FILE_SIZE) {
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
      toast.error(`${skipped} файл алгасагдлаа (зөвхөн 5MB-аас бага зураг)`);
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

          const response = await fetch("/api/profile-images", {
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
      const response = await fetch(`/api/profile-images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!response.ok) throw new Error("Update failed");
      toast.success(next ? "Зураг идэвхжлээ" : "Зураг нуугдлаа");
    } catch (error) {
      console.error("Toggle failed:", error);
      setImages((prev) => prev.map((item) => (item.id === image.id ? { ...item, active: image.active } : item)));
      toast.error("Өөрчлөхөд алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  const deleteImage = async (image: ProfileImage) => {
    setBusyId(image.id);

    try {
      const response = await fetch(`/api/profile-images/${image.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Delete failed");
      }

      setImages((prev) => prev.filter((item) => item.id !== image.id));
      setConfirmId(null);
      toast.success("Зураг устгагдлаа");
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Нийт зураг", value: images.length },
          { label: "Идэвхтэй", value: activeCount },
          { label: "Нуусан", value: images.length - activeCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Шинэ зураг хуулах</h2>
            <p className="text-xs text-zinc-400">
              Зураг автоматаар 512x512 дөрвөлжин болж WebP хэлбэрээр хадгалагдана. Хамгийн ихдээ 5MB.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
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
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragOver
              ? "border-cyan-400 bg-cyan-500/10"
              : "border-zinc-700 bg-zinc-800/40 hover:border-cyan-500/60 hover:bg-zinc-800/70"
          )}
        >
          <Upload className="h-8 w-8 text-zinc-400" />
          <p className="text-sm text-white">Зургаа энд чирж оруулах эсвэл дарж сонгох</p>
          <p className="text-xs text-zinc-500">Олон зургийг нэг дор сонгож болно</p>
        </div>

        {queue.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-300">Хуулахад бэлэн: {queue.length} зураг</p>
              {!uploading && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="cursor-pointer text-xs text-zinc-400 transition-colors hover:text-white"
                >
                  Бүгдийг цэвэрлэх
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {queue.map((item) => (
                <div key={item.id} className="relative aspect-square overflow-hidden rounded-full border border-zinc-700">
                  <img src={item.preview} alt={item.file.name} className="h-full w-full object-cover" />
                  {!uploading && (
                    <button
                      type="button"
                      aria-label="Хасах"
                      onClick={() => removeFromQueue(item.id)}
                      className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={uploadAll}
                disabled={uploading}
                className="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Хуулж байна {progress.done}/{progress.total}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Хуулах ({queue.length})
                  </>
                )}
              </Button>
              {uploading && (
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Хуулсан зургууд</h2>
          <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            {images.length}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-zinc-800" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-zinc-500">
            <ImageOff className="h-10 w-10 opacity-60" />
            <p className="text-sm text-zinc-300">Одоогоор профайл зураг хуулаагүй байна</p>
            <p className="text-xs">Дээрх хэсгээс зураг хуулна уу</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {images.map((image) => {
              const isBusy = busyId === image.id;
              const isConfirming = confirmId === image.id;

              return (
                <div
                  key={image.id}
                  className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                >
                  <div className="relative">
                    <img
                      src={image.url}
                      alt={image.name}
                      loading="lazy"
                      className={cn(
                        "h-20 w-20 rounded-full object-cover ring-2 transition-opacity sm:h-24 sm:w-24",
                        image.active ? "ring-cyan-500/60" : "opacity-40 ring-zinc-700"
                      )}
                    />
                    {!image.active && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <EyeOff className="h-5 w-5 text-zinc-300" />
                      </span>
                    )}
                  </div>

                  <div className="w-full text-center">
                    <p className="font-mono text-xs font-bold text-cyan-400">#{image.id}</p>
                    <p className="truncate text-xs font-medium text-white" title={image.name}>
                      {image.name || "Нэргүй"}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      {image.createdAt > 0 ? new Date(image.createdAt).toISOString().slice(0, 10) : "-"}
                    </p>
                  </div>

                  {isConfirming ? (
                    <div className="flex w-full items-center gap-1.5">
                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() => deleteImage(image)}
                        className="h-8 flex-1 cursor-pointer bg-red-600 text-xs text-white hover:bg-red-700"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                        Тийм
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => setConfirmId(null)}
                        className="h-8 flex-1 cursor-pointer border-zinc-700 bg-transparent text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        Үгүй
                      </Button>
                    </div>
                  ) : (
                    <div className="flex w-full items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => toggleActive(image)}
                        className="h-8 flex-1 cursor-pointer border-zinc-700 bg-transparent text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        {image.active ? (
                          <>
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            Идэвхтэй
                          </>
                        ) : (
                          <>
                            <EyeOff className="mr-1 h-3.5 w-3.5" />
                            Нуусан
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        aria-label="Устгах"
                        onClick={() => setConfirmId(image.id)}
                        className="h-8 w-8 cursor-pointer border-zinc-700 bg-transparent p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-4 py-20 text-center">
      <Frame className="h-10 w-10 text-zinc-600" />
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="max-w-sm text-sm text-zinc-400">
        Энэ хэсэг удахгүй нэмэгдэнэ. Профайл зургийн хүрээг (border) эндээс хуулдаг болно.
      </p>
    </div>
  );
}

export default function UserProfilePage() {
  const [section, setSection] = useState<SectionKey>("avatars");
  const current = SECTIONS.find((item) => item.key === section)!;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Хэрэглэгчийн профайл</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Хэрэглэгчид профайлдаа сонгож ашиглах зүйлсийг эндээс удирдана.
        </p>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const isActive = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-cyan-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {!item.ready && (
                <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">Удахгүй</span>
              )}
            </button>
          );
        })}
      </div>

      {current.ready ? <AvatarSection /> : <ComingSoon title={current.label} />}
    </div>
  );
}