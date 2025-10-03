"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MangaImageUploader from "@/components/single-image-uploader";
import { useAuth } from '@/app/providers';
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createManga } from "@/utils/manga-api";

export default function NewMangaForm() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    status: "ongoing",
    description: "",
  });
  
  // Store image URLs instead of file objects since MangaImageUploader handles uploads
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [mangaImageUrl, setMangaImageUrl] = useState<string>("");
  const [avatarImageUrl, setAvatarImageUrl] = useState<string>("");

  // Generate manga ID for image uploads
  const [mangaId] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

      toast.loading("Creating manga...");

      const mangaData = {
        id: mangaId,
        title: formData.title,
        type: formData.type as "manga" | "manhwa" | "manhua" | "webtoon" | "comic",
        status: formData.status as "ongoing" | "finished",
        description: formData.description,
        coverImage: coverImageUrl,
        mangaImage: mangaImageUrl,
        avatarImage: avatarImageUrl,
        chapters: 0,
      };

      const response = await createManga(mangaData, token);

      if (response.error) {
        toast.error("Failed to create manga", {
          description: response.message,
        });
        return;
      }

      toast.success("Зурагт ном үүсгэгдлээ", {
        description: `"${formData.title}" has been added to your collection`,
      });

      router.push("/admin/projects");
    } catch (error) {
      console.error("Error creating manga:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-700/50">
          <h1 className="text-2xl font-bold text-white">Зурагт ном үүсгэх</h1>
        </div>

        {/* Form */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Нэр
              </Label>
              <Input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Зурагт номын нэр"
                required
                className="bg-zinc-800/50 border-zinc-600/50 text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12"
              />
            </div>

            {/* Type and Status Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type Selector */}
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Төрөл
                </Label>
                <Select value={formData.type} onValueChange={(value) => handleSelectChange("type", value)}>
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-600/50 text-white focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12 cursor-pointer">
                    <SelectValue placeholder="Зурагт номын төрлөө сонгоно уу" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-600 text-white">
                    <SelectItem value="manga" className="focus:bg-zinc-700 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span>Манга</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="manhwa" className="focus:bg-zinc-700 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span>Манхва</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="manhua" className="focus:bg-zinc-700 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span>Манхуа</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="webtoon" className="focus:bg-zinc-700 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Вебтүүн</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="comic" className="focus:bg-zinc-700 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span>Комик</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Selector */}
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Төлөв
                </Label>
                <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-600/50 text-white focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12 cursor-pointer">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-600 text-white">
                    <SelectItem value="ongoing" className="focus:bg-zinc-700 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <span>Гарч байгаа</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="finished" className="focus:bg-zinc-700 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                        <span>Дууссан</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Image Uploaders Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Manga Image Uploader */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Зурагт номын зураг
                </Label>
                <MangaImageUploader
                  currentImageUrl={mangaImageUrl}
                  onImageChange={setMangaImageUrl}
                  mangaId={mangaId}
                  imageType="mangaImage"
                  label="Зураг оруулах"
                />
              </div>

              {/* Cover Image Uploader */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Арын зураг
                </Label>
                <MangaImageUploader
                  currentImageUrl={coverImageUrl}
                  onImageChange={setCoverImageUrl}
                  mangaId={mangaId}
                  imageType="coverImage"
                  label="Зураг оруулах"
                />
              </div>

              {/* Avatar Image Uploader */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Аватар зураг
                </Label>
                <MangaImageUploader
                  currentImageUrl={avatarImageUrl}
                  onImageChange={setAvatarImageUrl}
                  mangaId={mangaId}
                  imageType="avatarImage"
                  label="Зураг оруулах"
                />
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Товч тайлбар
              </Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Энд товч тайлбараа бичнэ үү"
                rows={4}
                className="bg-zinc-800/50 border-zinc-600/50 text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-lg min-h-[120px] resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={loading || !formData.title || !formData.type}
                className="w-full bg-zinc-800 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Үүсгэж байна...
                  </div>
                ) : (
                  <>
                    <PlusCircleIcon className="w-5 h-5 mr-2" />
                    Зурагт ном үүсгэх
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}