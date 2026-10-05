// app/projects/chapters/[mangaId]/new/new-chapter-form.tsx
"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircleIcon } from "lucide-react";
import { toast } from "sonner";
import MultiImageUploader, { ImageUpload } from "@/components/multi-image-uploader";
import { useAuth } from "@/app/providers";
import { createChapter, saveChapterImages } from "./actions";
import { uploadImageDirectToR2 } from "@/lib/upload-direct";

type Props = {
  mangaId: string;
  mangaTitle: string;
};

export default function NewChapterForm({ mangaId, mangaTitle }: Props) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [chapterNumber, setChapterNumber] = useState<string>("");
  const [chapterImages, setChapterImages] = useState<ImageUpload[]>([]);

  const handleChapterNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value === "" || /^\d+$/.test(value)) {
      setChapterNumber(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const chapterNum = parseInt(chapterNumber, 10);

    if (chapterNumber === "" || isNaN(chapterNum) || chapterNum < 0) {
      toast.error("Бүлгийн дугаар оруулна уу (0-с эхлэх боломжтой)");
      return;
    }

    if (chapterImages.length === 0) {
      toast.error("Дор хаяж 1 зураг оруулна уу");
      return;
    }

    setLoading(true);
    // Нэг toast-ыг үе шат бүрт шинэчилнэ
    const toastId = toast.loading("Бүлэг үүсгэж байна...");

    try {
      const token = await auth?.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна", { id: toastId });
        return;
      }

      // 1) Бүлгийг эхлээд үүсгэнэ
      const createResponse = await createChapter({ chapterNumber: chapterNum, mangaId }, token);

      if (createResponse.error) {
        toast.error("Бүлэг үүсгэж чадсангүй", {
          id: toastId,
          description: createResponse.message,
        });
        return;
      }

      toast.loading(`${chapterImages.length} зураг байршуулж байна...`, { id: toastId });

      // 2) Зургуудыг шууд R2 руу байршуулна (Vercel-ээр дамжихгүй)
      const uploadPromises: Promise<{ index: number; url?: string; error?: string }>[] = [];

      for (let i = 0; i < chapterImages.length; i++) {
        const image = chapterImages[i];
        if (image.file) {
          const timestamp = Date.now();
          const cleanFileName = image.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const imagePath = `mangas/${mangaId}/chapters/${chapterNum}/${timestamp}-page-${i + 1}-${cleanFileName}`;

          const uploadPromise = uploadImageDirectToR2(image.file, imagePath, token)
            .then((publicUrl) => ({ index: i, url: publicUrl }))
            .catch((error) => ({
              index: i,
              error: error instanceof Error ? error.message : "Upload failed",
            }));

          uploadPromises.push(uploadPromise);
        }
      }

      try {
        const results = await Promise.allSettled(uploadPromises);

        const successful = results
          .filter((r) => r.status === "fulfilled" && r.value.url)
          .map((r) => (r as PromiseFulfilledResult<{ index: number; url: string }>).value);

        const failed = results
          .map((r, i) => ({ result: r, index: i }))
          .filter(
            ({ result }) =>
              result.status === "rejected" || (result.status === "fulfilled" && !result.value.url)
          )
          .map(({ index }) => index + 1);

        if (failed.length > 0 && successful.length === 0) {
          toast.error("Бүх зураг байршуулж чадсангүй", {
            id: toastId,
            description: "Дахин оролдоно уу эсвэл интернэт холболтоо шалгана уу",
          });
          return;
        }

        if (failed.length > 0) {
          toast.warning("Зарим зураг байршуулж чадсангүй", {
            description: `Амжилтгүй хуудас: ${failed.join(", ")}. ${successful.length}/${chapterImages.length} хуудас байршлаа.`,
          });
        }

        // 3) Амжилттай байршсан зургуудын URL-ийг бүлэгт хадгална
        const imageUrls = successful.sort((a, b) => a.index - b.index).map((s) => s.url);

        const saveImagesResponse = await saveChapterImages(
          {
            mangaId,
            chapterId: createResponse.chapterId!,
            images: imageUrls,
          },
          token
        );

        if (saveImagesResponse.error) {
          toast.error("Бүлэг үүслээ, гэхдээ зургийг хадгалж чадсангүй", {
            id: toastId,
            description: saveImagesResponse.message,
          });
          return;
        }

        toast.success("Бүлэг нэмэгдлээ", {
          id: toastId,
          description: `Бүлэг ${chapterNum}, ${successful.length} хуудас`,
        });

        router.push(`/projects/chapters/${mangaId}`);
      } catch (imageError) {
        console.error("Error uploading images:", imageError);
        toast.error("Бүлэг үүслээ, гэхдээ зураг байршуулж чадсангүй", {
          id: toastId,
          description: "Дараа нь зураг нэмнэ үү",
        });
        router.push(`/projects/chapters/${mangaId}`);
      }
    } catch (error) {
      console.error("Error creating chapter:", error);
      toast.error("Алдаа гарлаа", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const totalSizeMb = chapterImages.reduce((sum, image) => sum + (image.file?.size ?? 0), 0) / (1024 * 1024);
  const isFormValid =
    chapterNumber !== "" &&
    !isNaN(parseInt(chapterNumber, 10)) &&
    parseInt(chapterNumber, 10) >= 0 &&
    chapterImages.length > 0;

  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/chapters/${mangaId}`}
            aria-label="Буцах"
            className="cyber-btn p-2.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-white">Шинэ бүлэг</h1>
            <p className="truncate text-sm text-zinc-400" title={mangaTitle}>
              {mangaTitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* fieldset disabled: илгээж байх үед бүх талбар, товчийг хаана */}
          <fieldset
            disabled={loading}
            className="m-0 grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-[280px_minmax(0,1fr)]"
          >
            {/* Зүүн: дугаар, нийлбэр, илгээх. Урт жагсаалттай үед ч товч харагдсан хэвээр */}
            <div className="cyber-panel space-y-5 p-5 lg:sticky lg:top-6 lg:self-start">
              <div className="space-y-2">
                <label htmlFor="chapterNumber" className="text-sm font-medium text-zinc-300">
                  Бүлгийн дугаар
                </label>
                <input
                  id="chapterNumber"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={chapterNumber}
                  onChange={handleChapterNumberChange}
                  required
                  className="font-display w-full border border-white/10 bg-black/30 px-3 py-3 text-2xl font-bold tabular-nums text-[#00f0ff] focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="cyber-panel cyber-stat px-3 py-2">
                  <p className="text-xs text-zinc-400">Хуудас</p>
                  <p className="cyber-glow font-display text-2xl font-bold tabular-nums">
                    {chapterImages.length}
                  </p>
                </div>
                <div className="cyber-panel cyber-stat px-3 py-2" style={{ '--accent': '#8b6cff' } as CSSProperties}>
                  <p className="text-xs text-zinc-400">Хэмжээ</p>
                  <p className="cyber-glow font-display text-2xl font-bold tabular-nums">
                    {totalSizeMb.toFixed(1)}
                    <span className="ml-1 text-xs font-medium text-zinc-400">MB</span>
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="cyber-btn flex w-full items-center justify-center gap-2 px-6 py-3 text-base font-semibold"
                style={{ borderColor: "rgba(0,240,255,0.6)", backgroundColor: "rgba(0,240,255,0.15)" }}
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#00f0ff] border-b-transparent" />
                    Нэмж байна...
                  </>
                ) : (
                  <>
                    <PlusCircleIcon className="h-5 w-5" />
                    Бүлэг нэмэх
                  </>
                )}
              </button>
            </div>

            {/* Баруун: зургууд */}
            <div className="space-y-4">
              <div className="cyber-panel p-4">
                <MultiImageUploader
                  images={chapterImages}
                  onImagesChange={setChapterImages}
                  label="Хуудасны зураг нэмэх"
                />
              </div>

              {chapterImages.length > 0 && (
                <div className="cyber-panel p-4">
                  <div className="cyber-scroll max-h-72 space-y-1 overflow-y-auto pr-1">
                    {chapterImages.map((image, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 border border-white/5 bg-white/[0.02] px-3 py-1.5"
                      >
                        <span className="font-display w-8 shrink-0 text-sm font-bold tabular-nums text-[#00f0ff]">
                          {index + 1}
                        </span>
                        <span className="truncate text-sm text-zinc-300">
                          {image.file?.name || "Unknown"}
                        </span>
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-zinc-500">
                          {image.file ? `${(image.file.size / (1024 * 1024)).toFixed(2)} MB` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}