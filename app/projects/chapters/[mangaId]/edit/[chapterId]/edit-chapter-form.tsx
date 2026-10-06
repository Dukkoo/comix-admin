// app/projects/chapters/[mangaId]/edit/[chapterId]/edit-chapter-form.tsx
"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import MultiImageUploader, { ImageUpload } from "@/components/multi-image-uploader";
import { useAuth } from "@/app/providers";
import { updateChapter, saveChapterImages } from "./actions";
import { uploadImageDirectToR2 } from "@/lib/upload-direct";
import { deleteFromR2Server } from "@/app/actions/upload";

type Props = {
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  currentChapterNumber: number;
  currentImages: string[];
};

// R2-ээс устгахын тулд зургийн URL-ийг storage path болгоно
const toStoragePath = (imageUrl: string) => {
  try {
    return new URL(imageUrl).pathname.substring(1);
  } catch {
    return "";
  }
};

export default function EditChapterForm({
  mangaId,
  mangaTitle,
  chapterId,
  currentChapterNumber,
  currentImages = [],
}: Props) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Тоог текстээр хадгална: талбарыг цэвэрлэж дахин бичих, 0 дугаартай бүлгийг засах боломжтой
  const [chapterNumber, setChapterNumber] = useState<string>(String(currentChapterNumber));
  const [chapterImages, setChapterImages] = useState<ImageUpload[]>(() =>
    currentImages.map((url, index) => ({
      id: `existing-${index}`,
      url,
      preview: url,
    }))
  );

  const handleChapterNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value === "" || /^\d+$/.test(value)) {
      setChapterNumber(value);
    }
  };

  const parsedNumber = parseInt(chapterNumber, 10);
  const numberValid = chapterNumber !== "" && !isNaN(parsedNumber) && parsedNumber >= 0;
  const numberChanged = numberValid && parsedNumber !== currentChapterNumber;
  const newImageCount = chapterImages.filter((img) => img.file).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numberValid) {
      toast.error("Бүлгийн дугаар оруулна уу");
      return;
    }

    if (chapterImages.length === 0) {
      toast.error("Дор хаяж 1 зураг оруулна уу");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Хадгалж байна...");

    try {
      const token = await auth?.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна", { id: toastId });
        return;
      }

      // 1) Бүлгийн дугаар өөрчлөгдсөн бол шинэчилнэ
      if (numberChanged) {
        const updateResponse = await updateChapter(mangaId, chapterId, { chapterNumber: parsedNumber }, token);

        if (updateResponse.error) {
          toast.error("Хадгалж чадсангүй", { id: toastId, description: updateResponse.message });
          return;
        }
      }

      // Жагсаалтаас хасагдсан хуучин зургууд (storage-оос хадгалалт амжилттай болсны дараа устгана)
      const imagesToDelete = currentImages.filter(
        (url) => !chapterImages.some((img) => img.url === url)
      );

      // 2) Шинэ зургуудыг шууд R2 руу байршуулна (Vercel-ээр дамжихгүй)
      const uploads: { pageIndex: number; promise: Promise<{ url?: string }> }[] = [];

      if (newImageCount > 0) {
        toast.loading(`${newImageCount} шинэ зураг байршуулж байна...`, { id: toastId });

        chapterImages.forEach((image, i) => {
          if (!image.file) return;

          const timestamp = Date.now();
          const cleanFileName = image.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const imagePath = `mangas/${mangaId}/chapters/${parsedNumber}/${timestamp}-page-${i + 1}-${cleanFileName}`;

          uploads.push({
            pageIndex: i,
            promise: uploadImageDirectToR2(image.file, imagePath, token)
              .then((publicUrl) => ({ url: publicUrl }))
              .catch(() => ({ url: undefined })),
          });
        });
      }

      const uploadResults = await Promise.all(uploads.map((u) => u.promise));

      const uploadedByPage = new Map<number, string>();
      const failedPages: number[] = [];
      uploadResults.forEach((result, i) => {
        const { pageIndex } = uploads[i];
        if (result.url) uploadedByPage.set(pageIndex, result.url);
        else failedPages.push(pageIndex + 1);
      });

      // Шинэ зураг бүгд бүтэлгүйтвэл юу ч хадгалахгүй, хуучин зургуудыг устгахгүй
      if (uploads.length > 0 && uploadedByPage.size === 0) {
        toast.error("Шинэ зургууд байршсангүй", {
          id: toastId,
          description: "Дахин оролдоно уу эсвэл интернэт холболтоо шалгана уу",
        });
        return;
      }

      if (failedPages.length > 0) {
        toast.warning("Зарим зураг байршуулж чадсангүй", {
          description: `Амжилтгүй хуудас: ${failedPages.join(", ")}. ${uploadedByPage.size}/${uploads.length} шинэ зураг байршлаа.`,
        });
      }

      // 3) Эцсийн дарааллаар зургийн URL-уудыг бүрдүүлнэ (хуучин + шинэ)
      const finalImageUrls: string[] = [];
      chapterImages.forEach((image, i) => {
        if (image.file) {
          const uploaded = uploadedByPage.get(i);
          if (uploaded) finalImageUrls.push(uploaded);
        } else {
          finalImageUrls.push(image.url);
        }
      });

      toast.loading("Хадгалж байна...", { id: toastId });

      const saveImagesResponse = await saveChapterImages(
        { mangaId, chapterId, images: finalImageUrls },
        token
      );

      if (saveImagesResponse.error) {
        toast.error("Зургийг хадгалж чадсангүй", {
          id: toastId,
          description: saveImagesResponse.message,
        });
        return;
      }

      // 4) Хадгалалт амжилттай болсны дараа хасагдсан зургуудыг storage-оос устгана
      //    (өмнө нь устгаад дараа нь хадгалах үед алдаа гарвал бүлэг эвдэрдэг байсан)
      if (imagesToDelete.length > 0) {
        const deleteResults = await Promise.allSettled(
          imagesToDelete.map((url) => deleteFromR2Server(toStoragePath(url)))
        );
        const failedDeletes = deleteResults.filter((r) => r.status === "rejected").length;
        if (failedDeletes > 0) {
          toast.warning(`${failedDeletes} хуучин зургийг устгаж чадсангүй`);
        }
      }

      toast.success("Хадгалагдлаа", {
        id: toastId,
        description: `Бүлэг ${parsedNumber}, ${finalImageUrls.length} хуудас`,
      });

      router.push(`/projects/chapters/${mangaId}`);
    } catch (error) {
      console.error("Error updating chapter:", error);
      toast.error("Алдаа гарлаа", {
        id: toastId,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="font-display text-2xl font-bold text-white">Бүлэг засварлах</h1>
            <p className="truncate text-sm text-zinc-400" title={mangaTitle}>
              {mangaTitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* fieldset disabled: хадгалж байх үед бүх талбар, товчийг хаана */}
          <fieldset
            disabled={loading}
            className="m-0 grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-[280px_minmax(0,1fr)]"
          >
            {/* Зүүн: дугаар, тоо, хадгалах. Урт жагсаалттай үед ч товч харагдсан хэвээр */}
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
                {numberChanged && (
                  <p className="font-display text-sm tabular-nums text-[#ffd23f]">
                    {currentChapterNumber} → {parsedNumber}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="cyber-panel cyber-stat px-3 py-2">
                  <p className="text-xs text-zinc-400">Хуудас</p>
                  <p className="cyber-glow font-display text-2xl font-bold tabular-nums">
                    {chapterImages.length}
                  </p>
                </div>
                <div
                  className="cyber-panel cyber-stat px-3 py-2"
                  style={{ "--accent": "#3ddc97" } as CSSProperties}
                >
                  <p className="text-xs text-zinc-400">Шинэ</p>
                  <p className="cyber-glow font-display text-2xl font-bold tabular-nums">{newImageCount}</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !numberValid || chapterImages.length === 0}
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

            {/* Баруун: зургууд */}
            <div className="cyber-panel p-4">
              <MultiImageUploader
                images={chapterImages}
                onImagesChange={setChapterImages}
                label="Хуудасны зураг нэмэх"
              />
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}