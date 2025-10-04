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

interface EditMangaFormProps {
  mangaId: string;
}

export default function EditMangaForm({ mangaId }: EditMangaFormProps) {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string>(""); // ШИНЭ
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
      // ШИНЭ: Get auth token
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
        setFormData({
          title: result.data.title || "",
          type: result.data.type || "",
          status: result.data.status || "ongoing",
          description: result.data.description || "",
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
        return;
      }

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
        toast.error("Failed to update manga", {
          description: result.message,
        });
        return;
      }

      toast.success("Manga updated successfully");
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
          <span className="loader"></span>
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
            <div className="space-y-2">
              <Label htmlFor="title" className="text-zinc-300">Нэр</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="bg-zinc-800/50 border-zinc-600/50 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Төрөл</Label>
              <Select value={formData.type} onValueChange={(value) => handleSelectChange("type", value)}>
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

            <div className="space-y-2">
              <Label className="text-zinc-300">Төлөв</Label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value as "ongoing" | "finished")}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-600/50 text-white cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-600 text-white">
                  <SelectItem className="cursor-pointer" value="ongoing">Гарч байгаа</SelectItem>
                  <SelectItem className="cursor-pointer" value="finished">Дууссан</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-zinc-300">Товч тайлбар</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="bg-zinc-800/50 border-zinc-600/50 text-white"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-zinc-300">Нүүр зураг</Label>
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
                <Label className="text-zinc-300">Арын зураг</Label>
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
                <Label className="text-zinc-300">Аватар зураг</Label>
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

            <Button
              type="submit"
              disabled={loading || !formData.title || !formData.type}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <span className="loader" style={{ width: '24px', height: '24px', marginRight: '8px' }}></span>
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