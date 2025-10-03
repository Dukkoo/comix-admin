"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadToR2Server } from "@/app/actions/upload";

interface ImageUploaderProps {
  currentImageUrl?: string;
  onImageChange: (url: string) => void;
  mangaId: string;
  imageType: "mangaImage" | "coverImage" | "avatarImage";
  label: string;
}

export default function MangaImageUploader({
  currentImageUrl,
  onImageChange,
  mangaId,
  imageType,
  label,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || "");

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Image must be less than 50MB");
      return;
    }

    setUploading(true);

    try {
      // Generate path
      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folderMap = {
        "coverImage": "cover",
        "mangaImage": "manga",
        "avatarImage": "avatar"
      };
      const folder = folderMap[imageType];
      const path = `mangas/${mangaId}/${folder}/${timestamp}-${cleanFileName}`;
      
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Upload via server action
      const result = await uploadToR2Server(arrayBuffer, path, file.type);
      
      if (result.error || !result.url) {
        toast.error("Failed to upload image");
        return;
      }
      
      setPreviewUrl(result.url);
      onImageChange(result.url);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl("");
    onImageChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {!previewUrl ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 border-2 border-dashed border-zinc-600 hover:border-cyan-400 bg-zinc-800/50 hover:bg-zinc-700/50 text-white"
        >
          <div className="flex flex-col items-center space-y-2">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            ) : (
              <Upload className="w-8 h-8 text-zinc-400" />
            )}
            <span className="text-sm">{uploading ? "Uploading..." : label}</span>
          </div>
        </Button>
      ) : (
        <div className="relative">
          <div className="w-full h-32 relative rounded-lg overflow-hidden border border-zinc-600">
            <Image
              src={previewUrl}
              alt={label}
              fill
              className="object-cover"
            />
          </div>
          <div className="absolute top-2 right-2 flex space-x-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-white border-zinc-600"
            >
              Change
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={uploading}
              className="bg-red-500/80 hover:bg-red-600 text-white border-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}