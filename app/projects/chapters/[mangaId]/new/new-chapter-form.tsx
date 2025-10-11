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
import { getPresignedUploadUrl } from "@/app/actions/upload";

type Props = {
  mangaId: string;
  mangaTitle: string;
};

// Browser дээр WebP болгох (WebP биш зураг бол)
async function convertToWebPIfNeeded(file: File): Promise<Blob> {
  // WebP файл бол шууд буцаах
  if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
    return file;
  }
  
  // PNG/JPG бол WebP болгох
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('WebP conversion failed'));
        },
        'image/webp',
        1.0 // 100% quality - lossless
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function NewChapterForm({ mangaId, mangaTitle }: Props) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [chapterNumber, setChapterNumber] = useState<number>(1);
  const [chapterImages, setChapterImages] = useState<ImageUpload[]>([]);

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

      if (!chapterNumber || chapterNumber < 1) {
        toast.error("Please enter a valid chapter number");
        setLoading(false);
        return;
      }

      if (chapterImages.length === 0) {
        toast.error("Please upload at least one chapter image");
        setLoading(false);
        return;
      }

      const loadingToast = toast.loading("Creating chapter...");

      // First create the chapter
      const chapterData = {
        chapterNumber,
        mangaId,
      };

      const createResponse = await createChapter(chapterData, token);

      if (createResponse.error) {
        toast.dismiss(loadingToast);
        toast.error("Failed to create chapter", {
          description: createResponse.message,
        });
        setLoading(false);
        return;
      }

      // Update toast for upload phase
      toast.dismiss(loadingToast);
      const uploadToast = toast.loading(`Uploading ${chapterImages.length} images...`);

      // Upload images directly to R2 with browser-side WebP conversion
      const uploadPromises = chapterImages.map(async (image, i) => {
        if (!image.file) return { index: i, error: "No file" };
        
        try {
          const timestamp = Date.now();
          const cleanFileName = image.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          // WebP extension-тэй файлын нэр
          const imagePath = `mangas/${mangaId}/chapters/${chapterNumber}/${timestamp}-page-${i + 1}-${cleanFileName.replace(/\.(jpg|jpeg|png|webp)$/i, '.webp')}`;
          
          // 1. Get presigned URL from server
          const { presignedUrl, publicUrl, error } = await getPresignedUploadUrl(
            imagePath,
            'image/webp',
            token!
          );
          
          if (error || !presignedUrl || !publicUrl) {
            return { index: i, error: error || "Failed to get upload URL" };
          }
          
          // 2. Convert to WebP if needed (browser-side)
          const webpBlob = await convertToWebPIfNeeded(image.file);
          
          // 3. Upload directly to R2 (bypass Vercel)
          const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            body: webpBlob,
            headers: {
              'Content-Type': 'image/webp',
            },
          });
          
          if (!uploadResponse.ok) {
            return { index: i, error: `Upload failed: ${uploadResponse.status}` };
          }
          
          return { index: i, url: publicUrl };
          
        } catch (error) {
          console.error(`Error uploading image ${i}:`, error);
          return { 
            index: i, 
            error: error instanceof Error ? error.message : "Unknown error" 
          };
        }
      });

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
          toast.error("All uploads failed", {
            description: "Please try again or check your internet connection"
          });
          setLoading(false);
          return;
        }

        if (failed.length > 0) {
          toast.warning(`Some uploads failed`, {
            description: `Failed pages: ${failed.join(', ')}. Successfully uploaded ${successful.length}/${chapterImages.length} pages.`
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
          toast.error("Chapter created but failed to save images", {
            description: saveImagesResponse.message,
          });
          setLoading(false);
          return;
        }

        toast.success("Chapter created successfully", {
          description: `Chapter ${chapterNumber} with ${successful.length} pages has been added`,
        });

        router.push(`/projects/chapters/${mangaId}`);
      } catch (imageError) {
        toast.dismiss(uploadToast);
        console.error("Error uploading images:", imageError);
        toast.error("Chapter created but failed to upload images", {
          description: "Please try adding images later"
        });
        router.push(`/projects/chapters/${mangaId}`);
      }

    } catch (error) {
      console.error("Error creating chapter:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

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
                  type="number"
                  min="1"
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(parseInt(e.target.value) || 1)}
                  placeholder="Enter chapter number"
                  required
                  disabled={loading}
                  className="bg-zinc-800/50 border-zinc-600/50 text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12"
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
                        WebP биш зургууд автоматаар WebP болгогдоно. WebP файлууд хэвээрээ үлдэнэ.
                      </div>
                    </div>
                    
                    <p className="text-sm text-zinc-400 font-semibold">
                      {chapterImages.length} хуудас нэмэгдлээ:
                    </p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {chapterImages.map((image, index) => {
                        const isWebP = image.file?.type === 'image/webp' || 
                                      image.file?.name.toLowerCase().endsWith('.webp');
                        return (
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
                            {isWebP && (
                              <span className="text-green-400 text-xs">✓ WebP</span>
                            )}
                            <span className="text-zinc-500 text-xs ml-auto">
                              {image.file ? `${(image.file.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading || !chapterNumber || chapterImages.length === 0}
                  className="w-full bg-zinc-800 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Нэмж байна...
                    </div>
                  ) : (
                    <>
                      <PlusCircleIcon className="w-5 h-5 mr-2" />
                      Бүлэг нэмэх
                    </>
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