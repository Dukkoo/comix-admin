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
import { uploadToR2Server, deleteFromR2Server } from "@/app/actions/upload"; // ӨӨРЧЛӨГДСӨН

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
        return;
      }

      if (!chapterNumber || chapterNumber < 1) {
        toast.error("Please enter a valid chapter number");
        return;
      }

      if (chapterImages.length === 0) {
        toast.error("Please upload at least one chapter image");
        return;
      }

      toast.loading("Updating chapter...");

      // Update chapter number if changed
      if (chapterNumber !== currentChapterNumber) {
        const updateResponse = await updateChapter(mangaId, chapterId, {
          chapterNumber
        }, token);

        if (updateResponse.error) {
          toast.error("Failed to update chapter", {
            description: updateResponse.message,
          });
          return;
        }
      }

      // Handle image changes
      const existingImageUrls = currentImages;
      const imagesToDelete: string[] = [];

      // Find images to delete
      existingImageUrls.forEach(url => {
        const stillExists = chapterImages.some(img => img.url === url);
        if (!stillExists) {
          imagesToDelete.push(url);
        }
      });

      // Delete removed images from R2
      for (const imageUrl of imagesToDelete) {
        try {
          const url = new URL(imageUrl);
          const path = url.pathname.substring(1);
          await deleteFromR2Server(path);
        } catch (error) {
          console.warn("Failed to delete image:", imageUrl, error);
        }
      }

      // Upload new images
      const finalImageUrls: string[] = [];
      
      for (let i = 0; i < chapterImages.length; i++) {
        const image = chapterImages[i];
        
        if (image.file) {
          // New image - upload to R2
          const timestamp = Date.now();
          const cleanFileName = image.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const imagePath = `mangas/${mangaId}/chapters/${chapterNumber}/${timestamp}-page-${i + 1}-${cleanFileName}`;
          
          const arrayBuffer = await image.file.arrayBuffer();
          const result = await uploadToR2Server(arrayBuffer, imagePath, image.file.type);
          
          if (result.error || !result.url) {
            throw new Error("Upload failed");
          }
          
          finalImageUrls.push(result.url);
        } else {
          // Existing image
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
        toast.error("Chapter updated but failed to save images", {
          description: saveImagesResponse.message,
        });
        return;
      }

      toast.success("Chapter updated successfully", {
        description: `Chapter ${chapterNumber} with ${finalImageUrls.length} pages has been updated`,
      });

      router.push(`/admin/projects/chapters/${mangaId}`);

    } catch (error) {
      console.error("Error updating chapter:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-700/50">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                onClick={() => router.push(`/admin/projects/chapters/${mangaId}`)}
                className="bg-zinc-700 hover:bg-zinc-600 text-white p-2 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Бүлэг засварлах</h1>
              </div>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="chapterNumber" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Бүлэг
                </Label>
                <Input
                  id="chapterNumber"
                  type="number"
                  min="1"
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(parseInt(e.target.value) || 1)}
                  placeholder="Enter chapter number"
                  required
                  className="bg-zinc-800/50 border-zinc-600/50 text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12"
                />
                {chapterNumber !== currentChapterNumber && (
                  <p className="text-yellow-400 text-sm">
                    Бүлэг {currentChapterNumber} -ээс {chapterNumber} болж өөрчлөгдөж байна
                  </p>
                )}
              </div>

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
                {chapterImages.length > 0 && (
                  <p className="text-sm text-zinc-400">
                    {chapterImages.length} зураг байна.
                  </p>
                )}
              </div>

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