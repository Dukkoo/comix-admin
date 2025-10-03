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
import { uploadToR2Server } from "@/app/actions/upload"; // ӨӨРЧЛӨГДСӨН

type Props = {
  mangaId: string;
  mangaTitle: string;
};

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

      toast.loading("Creating chapter...");

      // First create the chapter
      const chapterData = {
        chapterNumber,
        mangaId,
      };

      const createResponse = await createChapter(chapterData, token);

      if (createResponse.error) {
        toast.error("Failed to create chapter", {
          description: createResponse.message,
        });
        return;
      }

      // Upload images to R2 - ӨӨРЧЛӨГДСӨН
      const uploadPromises: Promise<string>[] = [];
      
      for (let i = 0; i < chapterImages.length; i++) {
        const image = chapterImages[i];
        if (image.file) {
          const timestamp = Date.now();
          const cleanFileName = image.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const imagePath = `mangas/${mangaId}/chapters/${chapterNumber}/${timestamp}-page-${i + 1}-${cleanFileName}`;
          
          const arrayBuffer = await image.file.arrayBuffer();
          const uploadPromise = uploadToR2Server(arrayBuffer, imagePath, image.file.type)
            .then(result => {
              if (result.error || !result.url) throw new Error("Upload failed");
              return result.url;
            });
          
          uploadPromises.push(uploadPromise);
        }
      }

      try {
        const imageUrls = await Promise.all(uploadPromises);

        // Save image URLs to chapter
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
          return;
        }

        toast.success("Chapter created successfully", {
          description: `Chapter ${chapterNumber} with ${chapterImages.length} pages has been added`,
        });

        router.push(`/admin/projects/chapters/${mangaId}`);
      } catch (imageError) {
        console.error("Error uploading images:", imageError);
        toast.error("Chapter created but failed to upload images");
        router.push(`/admin/projects/chapters/${mangaId}`);
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
                
                {/* Display uploaded files with names */}
                {chapterImages.length > 0 && (
                  <div className="mt-4 space-y-2">
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