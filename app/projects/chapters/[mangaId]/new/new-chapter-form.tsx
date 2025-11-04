"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultiImageUploader, { ImageUpload } from "@/components/multi-image-uploader";
import { useAuth } from '@/app/providers';
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createChapter, saveChapterImages } from "./actions";
import { uploadToR2Server } from "@/app/actions/upload";

type Props = {
  mangaId: string;
  mangaTitle: string;
};

export default function NewChapterForm({ mangaId, mangaTitle }: Props) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [chapterNumber, setChapterNumber] = useState<string>(""); // Changed to string for better control
  const [chapterImages, setChapterImages] = useState<ImageUpload[]>([]);

  const handleChapterNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty string or valid numbers (including 0)
    if (value === "" || /^\d+$/.test(value)) {
      setChapterNumber(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await auth?.currentUser?.getIdToken();

      if (!token) {
        toast.error("Authentication required");
        setLoading(false);
        return;
      }

      const chapterNum = parseInt(chapterNumber);

      // Allow chapter 0 and above
      if (chapterNumber === "" || isNaN(chapterNum) || chapterNum < 0) {
        toast.error("Бүлгийн дугаар оруулна уу (0-с эхлэх боломжтой)");
        setLoading(false);
        return;
      }

      if (chapterImages.length === 0) {
        toast.error("Дор хаяж 1 зураг оруулна уу");
        setLoading(false);
        return;
      }

      const loadingToast = toast.loading("Бүлэг үүсгэж байна...");

      // First create the chapter
      const chapterData = {
        chapterNumber: chapterNum,
        mangaId,
      };

      const createResponse = await createChapter(chapterData, token);

      if (createResponse.error) {
        toast.dismiss(loadingToast);
        toast.error("Бүлэг үүсгэх амжилтгүй", {
          description: createResponse.message,
        });
        setLoading(false);
        return;
      }

      // Update toast for upload phase
      toast.dismiss(loadingToast);
      const uploadToast = toast.loading(`${chapterImages.length} зураг байршуулж байна...`);

      // Upload images to R2 with WebP conversion
      const uploadPromises: Promise<{ index: number; url?: string; error?: string }>[] = [];
      
      for (let i = 0; i < chapterImages.length; i++) {
        const image = chapterImages[i];
        if (image.file) {
          const timestamp = Date.now();
          const cleanFileName = image.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const imagePath = `mangas/${mangaId}/chapters/${chapterNum}/${timestamp}-page-${i + 1}-${cleanFileName}`;
          
          // Convert file to ArrayBuffer and upload (Sharp will convert to WebP)
          const uploadPromise = image.file.arrayBuffer()
            .then(arrayBuffer => uploadToR2Server(arrayBuffer, imagePath, image.file!.type))
            .then(result => ({
              index: i,
              ...result
            }))
            .catch(error => ({
              index: i,
              error: error instanceof Error ? error.message : "Upload failed"
            }));
          
          uploadPromises.push(uploadPromise);
        }
      }

      try {
        const results = await Promise.allSettled(uploadPromises);
        
        // Filter successful uploads
        const successful = results
          .filter(r => r.status === 'fulfilled' && r.value.url)
          .map(r => (r as PromiseFulfilledResult<{ index: number; url: string }>).value);
        
        // Get failed upload indices
        const failed = results
          .map((r, i) => ({ result: r, index: i }))
          .filter(({ result }) => 
            result.status === 'rejected' || 
            (result.status === 'fulfilled' && !result.value.url)
          )
          .map(({ index }) => index + 1);
        
        toast.dismiss(uploadToast);

        if (failed.length > 0 && successful.length === 0) {
          toast.error("Бүх зураг байршуулалт амжилтгүй", {
            description: "Дахин оролдоно уу эсвэл интернэт холболтоо шалгана уу"
          });
          setLoading(false);
          return;
        }

        if (failed.length > 0) {
          toast.warning(`Зарим зураг байршуулалт амжилтгүй`, {
            description: `Амжилтгүй хуудаснууд: ${failed.join(', ')}. ${successful.length}/${chapterImages.length} хуудас амжилттай байршлаа.`
          });
        }

        // Save successful image URLs to chapter
        const imageUrls = successful
          .sort((a, b) => a.index - b.index)
          .map(s => s.url);

        const saveImagesResponse = await saveChapterImages(
          {
            mangaId,
            chapterId: createResponse.chapterId!,
            images: imageUrls,
          },
          token
        );

        if (saveImagesResponse.error) {
          toast.error("Бүлэг үүслээ гэхдээ зургийг хадгалж чадсангүй", {
            description: saveImagesResponse.message,
          });
          setLoading(false);
          return;
        }

        toast.success("Бүлэг амжилттай нэмэгдлээ", {
          description: `Бүлэг ${chapterNum} - ${successful.length} хуудастай`,
        });

        router.push(`/projects/chapters/${mangaId}`);
      } catch (imageError) {
        toast.dismiss(uploadToast);
        console.error("Error uploading images:", imageError);
        toast.error("Бүлэг үүслээ гэхдээ зураг байршуулж чадсангүй", {
          description: "Дараа нь зураг нэмнэ үү"
        });
        router.push(`/projects/chapters/${mangaId}`);
      }

    } catch (error) {
      console.error("Error creating chapter:", error);
      toast.error("Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = chapterNumber !== "" && !isNaN(parseInt(chapterNumber)) && parseInt(chapterNumber) >= 0 && chapterImages.length > 0;

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-700/50">
            <h1 className="text-2xl font-bold text-white">Шинэ бүлэг</h1>
            <p className="text-zinc-400 text-sm mt-1">{mangaTitle}</p>
          </div>

          {/* Form */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Chapter Number */}
              <div className="space-y-2">
                <Label htmlFor="chapterNumber" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Бүлгийн дугаар
                </Label>
                <Input
                  id="chapterNumber"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={chapterNumber}
                  onChange={handleChapterNumberChange}
                  placeholder=""
                  required
                  disabled={loading}
                  className="bg-zinc-800/50 border-zinc-600/50 text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Chapter Images */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Бүлгийн зурагнууд
                </Label>
                <div className="bg-zinc-800/30 backdrop-blur-sm rounded-lg border border-zinc-600/50 p-4">
                  <MultiImageUploader
                    images={chapterImages}
                    onImagesChange={setChapterImages}
                    label="Хуудасны зураг нэмэх"
                  />
                </div>
                
                {/* Info message about WebP conversion */}
                {chapterImages.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-start gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                      <div className="text-cyan-400 text-xs flex-shrink-0 mt-0.5">ℹ️</div>
                      <div className="text-xs text-cyan-300">
                        Webp болгож хөрвүүлнэ. 
                      </div>
                    </div>
                    
                    <p className="text-sm text-zinc-400 font-semibold">
                      {chapterImages.length} хуудас нэмэгдлээ:
                    </p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {chapterImages.map((image, index) => (
                        <div 
                          key={index} 
                          className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-2 border border-zinc-700/30"
                        >
                          <span className="text-cyan-400 font-semibold min-w-[60px]">
                            Хуудас {index + 1}:
                          </span>
                          <span className="text-zinc-300 text-sm truncate">
                            {image.file?.name || 'Unknown'}
                          </span>
                          <span className="text-zinc-500 text-xs ml-auto">
                            {image.file ? `${(image.file.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-full bg-zinc-800 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Нэмж байна...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <PlusCircleIcon className="w-5 h-5 mr-2" />
                      Бүлэг нэмэх
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}