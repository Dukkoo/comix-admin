"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MangaImageUploader from "@/components/single-image-uploader";
import { useAuth } from '@/app/providers';
import { SaveIcon, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { deleteFromR2Server } from "@/app/actions/upload";

interface EditMangaFormProps {
  mangaId: string;
}

export default function EditMangaForm({ mangaId }: EditMangaFormProps) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string>("");
  
  // ШИНЭ: Original images хадгалах (delete-д хэрэгтэй)
  const [originalImages, setOriginalImages] = useState({
    mangaImage: "",
    coverImage: "",
    avatarImage: "",
  });
  
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    status: "ongoing" as "ongoing" | "finished",
    description: "",
    mangaImage: "",
    coverImage: "",
    avatarImage: "",
  });

  useEffect(() => {
    loadManga();
  }, [mangaId]);

  const loadManga = async () => {
    if (!mangaId) {
      toast.error("No manga ID provided");
      router.push("/projects");
      return;
    }

    try {
      // Get auth token
      const token = await auth?.currentUser?.getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const response = await fetch(`/api/mangas/${mangaId}`);
      
      if (!response.ok) {
        toast.error("Failed to load manga");
        router.push("/projects");
        return;
      }

      const result = await response.json();
      
      if (result.data) {
        const mangaData = {
          title: result.data.title || "",
          type: result.data.type || "",
          status: result.data.status || "ongoing",
          description: result.data.description || "",
          mangaImage: result.data.mangaImage || "",
          coverImage: result.data.coverImage || "",
          avatarImage: result.data.avatarImage || "",
        };
        
        setFormData(mangaData);
        
        // ШИНЭ: Original images хадгалах
        setOriginalImages({
          mangaImage: result.data.mangaImage || "",
          coverImage: result.data.coverImage || "",
          avatarImage: result.data.avatarImage || "",
        });
        
        toast.success("Manga loaded successfully");
      } else {
        toast.error("No manga data found");
      }
    } catch (error) {
      console.error("Error loading manga:", error);
      toast.error("Failed to load manga");
      router.push("/projects");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (type: "mangaImage" | "coverImage" | "avatarImage", url: string) => {
    setFormData(prev => ({ ...prev, [type]: url }));
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

      const loadingToast = toast.loading("Updating manga...");

      // Update manga in Firestore
      const response = await fetch(`/api/mangas/${mangaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.error) {
        toast.dismiss(loadingToast);
        toast.error("Failed to update manga", {
          description: result.message,
        });
        setLoading(false);
        return;
      }

      // ШИНЭ: Delete old images from R2 if they changed
      const imagesToDelete: { type: string; url: string; path: string }[] = [];
      
      // Check each image type
      const imageTypes: Array<"mangaImage" | "coverImage" | "avatarImage"> = [
        "mangaImage", 
        "coverImage", 
        "avatarImage"
      ];
      
      for (const imageType of imageTypes) {
        const originalUrl = originalImages[imageType];
        const newUrl = formData[imageType];
        
        // If image changed and original exists
        if (originalUrl && newUrl && originalUrl !== newUrl) {
          try {
            let path: string;
            
            // Handle both absolute and relative URLs
            if (originalUrl.startsWith('http')) {
              const urlObj = new URL(originalUrl);
              path = urlObj.pathname.substring(1); // Remove leading "/"
            } else {
              path = originalUrl.startsWith('/') ? originalUrl.substring(1) : originalUrl;
            }
            
            imagesToDelete.push({ type: imageType, url: originalUrl, path });
          } catch (error) {
            console.error(`Failed to parse URL for ${imageType}:`, originalUrl, error);
          }
        }
      }

      // Delete old images
      if (imagesToDelete.length > 0) {
        toast.dismiss(loadingToast);
        const deleteToast = toast.loading(`Deleting ${imagesToDelete.length} old images...`);
        
        const deleteResults = await Promise.allSettled(
          imagesToDelete.map(({ path }) => deleteFromR2Server(path))
        );
        
        const failedDeletes = deleteResults.filter(r => r.status === 'rejected').length;
        
        toast.dismiss(deleteToast);
        
        if (failedDeletes > 0) {
          toast.warning(`${failedDeletes} old images couldn't be deleted`, {
            description: "They won't affect your manga but may use storage space"
          });
        }
      } else {
        toast.dismiss(loadingToast);
      }

      toast.success("Manga updated successfully", {
        description: imagesToDelete.length > 0 
          ? `Updated and removed ${imagesToDelete.length} old images`
          : "All changes saved"
      });
      
      router.push("/projects");
      
    } catch (error) {
      console.error("Error updating manga:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white mt-6">Зурагт номын мэдээллийг уншиж байна</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Зурагт ном засварлах</h1>
              <p className="text-zinc-400 text-sm mt-1">{formData.title}</p>
            </div>
            <Link 
              href="/projects"
              className="flex items-center space-x-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Буцах</span>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-zinc-300">Нэр</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="bg-zinc-800/50 border-zinc-600/50 text-white"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Төрөл</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => handleSelectChange("type", value)}
                disabled={loading}
              >
                <SelectTrigger className="bg-zinc-800/50 border-zinc-600/50 text-white cursor-pointer">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-600 text-white">
                  <SelectItem className="cursor-pointer" value="manga">Манга</SelectItem>
                  <SelectItem className="cursor-pointer" value="manhwa">Манхва</SelectItem>
                  <SelectItem className="cursor-pointer" value="manhua">Манхуа</SelectItem>
                  <SelectItem className="cursor-pointer" value="webtoon">Вебтүүн</SelectItem>
                  <SelectItem className="cursor-pointer" value="comic">Комик</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Төлөв</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => handleSelectChange("status", value as "ongoing" | "finished")}
                disabled={loading}
              >
                <SelectTrigger className="bg-zinc-800/50 border-zinc-600/50 text-white cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-600 text-white">
                  <SelectItem className="cursor-pointer" value="ongoing">Гарч байгаа</SelectItem>
                  <SelectItem className="cursor-pointer" value="finished">Дууссан</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-zinc-300">Товч тайлбар</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                disabled={loading}
                className="bg-zinc-800/50 border-zinc-600/50 text-white"
              />
            </div>

            {/* Images */}
            <div className="space-y-4">
              <Label className="text-zinc-300">Зургууд</Label>
              
              {/* Info message */}
              {(formData.mangaImage !== originalImages.mangaImage || 
                formData.coverImage !== originalImages.coverImage || 
                formData.avatarImage !== originalImages.avatarImage) && (
                <div className="flex items-start gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                  <div className="text-cyan-400 text-xs flex-shrink-0 mt-0.5">ℹ️</div>
                  <div className="text-xs text-cyan-300">
                    Old images will be automatically deleted from storage when you save.
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">Нүүр зураг</Label>
                  <MangaImageUploader
                    currentImageUrl={formData.mangaImage}
                    onImageChange={(url) => handleImageChange("mangaImage", url)}
                    mangaId={mangaId}
                    imageType="mangaImage"
                    label="Зураг оруулах"
                    authToken={authToken}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">Арын зураг</Label>
                  <MangaImageUploader
                    currentImageUrl={formData.coverImage}
                    onImageChange={(url) => handleImageChange("coverImage", url)}
                    mangaId={mangaId}
                    imageType="coverImage"
                    label="Зураг оруулах"
                    authToken={authToken}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">Аватар зураг</Label>
                  <MangaImageUploader
                    currentImageUrl={formData.avatarImage}
                    onImageChange={(url) => handleImageChange("avatarImage", url)}
                    mangaId={mangaId}
                    imageType="avatarImage"
                    label="Зураг оруулах"
                    authToken={authToken}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !formData.title || !formData.type}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  <span>Хадгалж байна...</span>
                </div>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Хадгалах
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}