"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/app/providers';
import { PlusCircleIcon, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { createManga } from "@/utils/manga-api";
import { uploadToR2Server } from "@/app/actions/upload";
import Image from "next/image";

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
  
  // Store files locally until submit
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [mangaImageFile, setMangaImageFile] = useState<File | null>(null);
  const [avatarImageFile, setAvatarImageFile] = useState<File | null>(null);
  
  // Preview URLs
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [mangaPreview, setMangaPreview] = useState<string>("");
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  // File input refs
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mangaInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Generate manga ID for image uploads
  const [mangaId] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());

  const handleFileSelect = (
    file: File | null, 
    setFile: (file: File | null) => void,
    setPreview: (url: string) => void
  ) => {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Image must be less than 50MB");
      return;
    }

    setFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
  };

  const handleRemoveImage = (
    setFile: (file: File | null) => void,
    setPreview: (url: string) => void,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    setFile(null);
    setPreview("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

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
        setLoading(false);
        return;
      }

      toast.loading("Uploading images...");

      // Upload images only when submitting
      let coverImageUrl = "";
      let mangaImageUrl = "";
      let avatarImageUrl = "";

      // Upload cover image
      if (coverImageFile) {
        const timestamp = Date.now();
        const cleanFileName = coverImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `mangas/${mangaId}/cover/${timestamp}-${cleanFileName}`;
        const arrayBuffer = await coverImageFile.arrayBuffer();
        const result = await uploadToR2Server(arrayBuffer, path, coverImageFile.type);
        if (result.url) coverImageUrl = result.url;
      }

      // Upload manga image
      if (mangaImageFile) {
        const timestamp = Date.now();
        const cleanFileName = mangaImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `mangas/${mangaId}/manga/${timestamp}-${cleanFileName}`;
        const arrayBuffer = await mangaImageFile.arrayBuffer();
        const result = await uploadToR2Server(arrayBuffer, path, mangaImageFile.type);
        if (result.url) mangaImageUrl = result.url;
      }

      // Upload avatar image
      if (avatarImageFile) {
        const timestamp = Date.now();
        const cleanFileName = avatarImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `mangas/${mangaId}/avatar/${timestamp}-${cleanFileName}`;
        const arrayBuffer = await avatarImageFile.arrayBuffer();
        const result = await uploadToR2Server(arrayBuffer, path, avatarImageFile.type);
        if (result.url) avatarImageUrl = result.url;
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

      router.push("/projects");
    } catch (error) {
      console.error("Error creating manga:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const ImageUploadBox = ({ 
    label, 
    preview, 
    inputRef, 
    file,
    setFile,
    setPreview 
  }: { 
    label: string;
    preview: string;
    inputRef: React.RefObject<HTMLInputElement>;
    file: File | null;
    setFile: (file: File | null) => void;
    setPreview: (url: string) => void;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
        {label}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileSelect(e.target.files?.[0] || null, setFile, setPreview)}
        className="hidden"
      />
      
      {!preview ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-zinc-600 hover:border-cyan-400 bg-zinc-800/50 hover:bg-zinc-700/50 text-white"
        >
          <div className="flex flex-col items-center space-y-2">
            <Upload className="w-8 h-8 text-zinc-400" />
            <span className="text-sm">Зураг оруулах</span>
          </div>
        </Button>
      ) : (
        <div className="relative">
          <div className="w-full h-32 relative rounded-lg overflow-hidden border border-zinc-600">
            <Image
              src={preview}
              alt={label}
              fill
              sizes="200px"
              className="object-cover"
            />
          </div>
          <div className="absolute top-2 right-2 flex space-x-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-white border-zinc-600"
            >
              Change
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleRemoveImage(setFile, setPreview, inputRef)}
              className="bg-red-500/80 hover:bg-red-600 text-white border-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-700/50">
          <h1 className="text-2xl font-bold text-white">Зурагт ном үүсгэх</h1>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Төрөл
                </Label>
                <Select value={formData.type} onValueChange={(value) => handleSelectChange("type", value)}>
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-600/50 text-white focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12 cursor-pointer">
                    <SelectValue placeholder="Зурагт номын төрлөө сонгоно уу" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-600 text-white">
                    <SelectItem value="manga">Манга</SelectItem>
                    <SelectItem value="manhwa">Манхва</SelectItem>
                    <SelectItem value="manhua">Манхуа</SelectItem>
                    <SelectItem value="webtoon">Вебтүүн</SelectItem>
                    <SelectItem value="comic">Комик</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Төлөв
                </Label>
                <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-600/50 text-white focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12 cursor-pointer">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-600 text-white">
                    <SelectItem value="ongoing">Гарч байгаа</SelectItem>
                    <SelectItem value="finished">Дууссан</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ImageUploadBox 
                label="Зурагт номын зураг"
                preview={mangaPreview}
                inputRef={mangaInputRef}
                file={mangaImageFile}
                setFile={setMangaImageFile}
                setPreview={setMangaPreview}
              />
              <ImageUploadBox 
                label="Арын зураг"
                preview={coverPreview}
                inputRef={coverInputRef}
                file={coverImageFile}
                setFile={setCoverImageFile}
                setPreview={setCoverPreview}
              />
              <ImageUploadBox 
                label="Аватар зураг"
                preview={avatarPreview}
                inputRef={avatarInputRef}
                file={avatarImageFile}
                setFile={setAvatarImageFile}
                setPreview={setAvatarPreview}
              />
            </div>

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