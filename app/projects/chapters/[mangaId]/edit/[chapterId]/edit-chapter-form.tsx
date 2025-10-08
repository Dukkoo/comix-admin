"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultiImageUploader, { ImageUpload } from "@/components/multi-image-uploader";
import { useAuth } from '@/app/providers';
import { SaveIcon, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { updateChapter, saveChapterImages } from "./actions";
import { uploadToR2Server, deleteFromR2Server } from "@/app/actions/upload";

type Props = {
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  currentChapterNumber: number;
  currentImages: string[];
};

export default function EditChapterForm({ 
  mangaId, 
  mangaTitle, 
  chapterId, 
  currentChapterNumber,
  currentImages = []
}: Props) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [chapterNumber, setChapterNumber] = useState<number>(currentChapterNumber);
  const [chapterImages, setChapterImages] = useState<ImageUpload[]>([]);

  useEffect(() => {
    const existingImages: ImageUpload[] = currentImages.map((url, index) => ({
      id: `existing-${index}`,
      url: url,
      preview: url,
    }));
    setChapterImages(existingImages);
  }, [currentImages]);

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

      const loadingToast = toast.loading("Updating chapter...");

      // Update chapter number if changed
      if (chapterNumber !== currentChapterNumber) {
        const updateResponse = await updateChapter(mangaId, chapterId, {
          chapterNumber
        }, token);

        if (updateResponse.error) {
          toast.dismiss(loadingToast);
          toast.error("Failed to update chapter", {
            description: updateResponse.message,
          });
          setLoading(false);
          return;
        }
      }

      // Handle image changes
      const existingImageUrls = currentImages;
      const imagesToDelete: string[] = [];

      // Find images to delete (removed from list)
      existingImageUrls.forEach(url => {
        const stillExists = chapterImages.some(img => img.url === url);
        if (!stillExists) {
          imagesToDelete.push(url);
        }
      });

      // Delete removed images from R2
      if (imagesToDelete.length > 0) {
        toast.dismiss(loadingToast);
        const deleteToast = toast.loading(`Deleting ${imagesToDelete.length} removed images...`);
        
        for (const imageUrl of imagesToDelete) {
          try {
            const url = new URL(imageUrl);
            const path = url.pathname.substring(1);
            await deleteFromR2Server(path);
          } catch (error) {
            console.warn("Failed to delete image:", imageUrl, error);
          }
        }
        
        toast.dismiss(deleteToast);
      }

      // Count new images to upload
      const newImages = chapterImages.filter(img => img.file);
      
      if (newImages.length > 0) {
        toast.dismiss(loadingToast);
        const uploadToast = toast.loading(`Uploading ${newImages.length} new images...`);

        // Upload new images with error handling
        const uploadPromises: Promise<{ index: number; url?: string; error?: string }>[] = [];
        
        for (let i = 0; i < chapterImages.length; i++) {
          const image = chapterImages[i];
          
          if (image.file) {
            // New image - upload to R2 (Sharp will convert to WebP)
            const timestamp = Date.now();
            const cleanFileName = image.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const imagePath = `mangas/${mangaId}/chapters/${chapterNumber}/${timestamp}-page-${i + 1}-${cleanFileName}`;
            
            const uploadPromise = image.file.arrayBuffer()
              .then(arrayBuffer => uploadToR2Server(arrayBuffer, imagePath, image.file!.type))
              .then(result => ({
                index: i,
                originalUrl: image.url,
                ...result
              }))
              .catch(error => ({
                index: i,
                originalUrl: image.url,
                error: error instanceof Error ? error.message : "Upload failed"
              }));
            
            uploadPromises.push(uploadPromise);
          }
        }

        const results = await Promise.allSettled(uploadPromises);
        
        toast.dismiss(uploadToast);

        // Process results
        const successful = results
          .filter(r => r.status === 'fulfilled' && r.value.url)
          .map(r => (r as PromiseFulfilledResult<any>).value);
        
        const failed = results
          .filter(r => r.status === 'rejected' || !(r as any).value?.url)
          .map((r, i) => i + 1);

        if (failed.length > 0 && successful.length === 0) {
          toast.error("All new uploads failed", {
            description: "Please check your internet connection and try again"
          });
          setLoading(false);
          return;
        }

        if (failed.length > 0) {
          toast.warning(`Some uploads failed`, {
            description: `Failed to upload ${failed.length} images. ${successful.length} succeeded.`
          });
        }

        // Build final image URLs list (mix of existing and new)
        const finalImageUrls: string[] = [];
        
        for (let i = 0; i < chapterImages.length; i++) {
          const image = chapterImages[i];
          
          if (image.file) {
            // Find uploaded URL for this image
            const uploaded = successful.find(s => s.index === i);
            if (uploaded && uploaded.url) {
              finalImageUrls.push(uploaded.url);
            }
          } else {
            // Existing image - keep URL
            finalImageUrls.push(image.url);
          }
        }

        // Save updated image URLs
        const saveImagesResponse = await saveChapterImages(
          {
            mangaId,
            chapterId,
            images: finalImageUrls,
          },
          token
        );

        if (saveImagesResponse.error) {
          toast.error("Failed to save updated images", {
            description: saveImagesResponse.message,
          });
          setLoading(false);
          return;
        }

        toast.success("Chapter updated successfully", {
          description: `Chapter ${chapterNumber} with ${finalImageUrls.length} pages has been updated`,
        });

      } else {
        // No new images, just reorder/delete
        const finalImageUrls = chapterImages.map(img => img.url);

        const saveImagesResponse = await saveChapterImages(
          {
            mangaId,
            chapterId,
            images: finalImageUrls,
          },
          token
        );

        if (saveImagesResponse.error) {
          toast.dismiss(loadingToast);
          toast.error("Failed to save changes", {
            description: saveImagesResponse.message,
          });
          setLoading(false);
          return;
        }

        toast.dismiss(loadingToast);
        toast.success("Chapter updated successfully", {
          description: `Chapter ${chapterNumber} with ${finalImageUrls.length} pages`,
        });
      }

      router.push(`/projects/chapters/${mangaId}`);

    } catch (error) {
      console.error("Error updating chapter:", error);
      toast.error("An unexpected error occurred", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
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
            <div className="flex items-center gap-4">
              <Button
                type="button"
                onClick={() => router.push(`/projects/chapters/${mangaId}`)}
                className="bg-zinc-700 hover:bg-zinc-600 text-white p-2 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Бүлэг засварлах</h1>
                <p className="text-zinc-400 text-sm mt-1">{mangaTitle}</p>
              </div>
            </div>
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
                {chapterNumber !== currentChapterNumber && (
                  <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="text-yellow-400 text-xs flex-shrink-0 mt-0.5">⚠️</div>
                    <p className="text-yellow-300 text-sm">
                      Бүлэг {currentChapterNumber} -ээс {chapterNumber} болж өөрчлөгдөж байна
                    </p>
                  </div>
                )}
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
                
                {/* Info messages */}
                {chapterImages.length > 0 && (
                  <div className="space-y-2">
                    {/* WebP conversion notice */}
                    {chapterImages.some(img => img.file) && (
                      <div className="flex items-start gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                        <div className="text-cyan-400 text-xs flex-shrink-0 mt-0.5">ℹ️</div>
                        <div className="text-xs text-cyan-300">
                          New images will be automatically converted to WebP format for optimal performance.
                        </div>
                      </div>
                    )}
                    
                    {/* Image count */}
                    <p className="text-sm text-zinc-400">
                      {chapterImages.length} зураг байна
                      {chapterImages.some(img => img.file) && (
                        <span className="text-cyan-400 ml-2">
                          ({chapterImages.filter(img => img.file).length} шинэ)
                        </span>
                      )}
                    </p>
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
                      Хадгалж байна...
                    </div>
                  ) : (
                    <>
                      <SaveIcon className="w-5 h-5 mr-2" />
                      Хадгалах
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