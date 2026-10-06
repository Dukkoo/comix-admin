"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ImageUploaderProps {
  currentImageUrl?: string;
  onImageChange: (url: string) => void;
  onFileChange: (file: File | null) => void;
  mangaId: string;
  imageType: "mangaImage" | "coverImage" | "avatarImage";
  label: string;
  authToken: string;
}

export default function MangaImageUploader({
  currentImageUrl,
  onImageChange,
  onFileChange,
  mangaId,
  imageType,
  label,
  authToken,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || "");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Зөвхөн зураг сонгоно уу");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Зураг 50MB-аас бага байх ёстой");
      return;
    }

    // Preview үүсгэнэ
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    // Файлыг parent-д дамжуулна (form илгээх үед байршуулна)
    onFileChange(file);
    onImageChange(preview); // түр preview URL
  };

  const handleRemove = () => {
    setPreviewUrl("");
    onImageChange("");
    onFileChange(null);
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
      />

      {!previewUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={label}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 border border-dashed border-[#00f0ff]/30 bg-black/20 text-zinc-400 transition-colors hover:border-[#00f0ff]/70 hover:bg-[#00f0ff]/5 hover:text-white"
        >
          <Upload
            className="h-7 w-7 text-[#00f0ff]"
            style={{ filter: "drop-shadow(0 0 6px rgba(0,240,255,0.5))" }}
          />
          <span className="px-2 text-center text-sm">{label}</span>
        </button>
      ) : (
        <div className="relative h-32 w-full overflow-hidden border border-[#00f0ff]/30">
          <Image src={previewUrl} alt={label} fill sizes="200px" className="object-cover" />

          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border border-white/20 bg-black/75 px-2 py-1 text-xs text-white transition-colors hover:bg-black"
            >
              Солих
            </button>
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Зураг хасах"
              className="flex h-7 w-7 items-center justify-center border border-[#ff2e88]/60 bg-[#ff2e88]/30 text-white transition-colors hover:bg-[#ff2e88]/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}