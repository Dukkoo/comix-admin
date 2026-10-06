"use client";

import { useCallback, useRef, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import Image from "next/image";
import { GripVertical, XIcon, Upload, Plus } from "lucide-react";
import { toast } from "sonner";

export type ImageUpload = {
  id: string;
  url: string;
  file?: File;
  preview?: string;
};

type Props = {
  images?: ImageUpload[];
  onImagesChange: (images: ImageUpload[]) => void;
  urlFormatter?: (image: ImageUpload) => string;
  label?: string;
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export default function MultiImageUploader({
  images = [],
  onImagesChange,
  urlFormatter,
  label = "Зураг нэмэх",
}: Props) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Хэт том эсвэл зураг биш файлыг алгасаад, бусдыг нь нэмнэ
    // (өмнө нь нэг файл том бол бүгд чимээгүй хаягддаг байсан)
    const accepted = files.filter((file) => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_SIZE);
    const skipped = files.length - accepted.length;

    if (skipped > 0) {
      toast.error(`${skipped} файл алгасагдлаа (PNG, JPG, GIF, WebP, 50MB хүртэл)`);
    }

    if (accepted.length === 0) return;

    const newImages: ImageUpload[] = accepted.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}-${file.name}`,
        url: previewUrl,
        preview: previewUrl,
        file,
      };
    });

    onImagesChange([...images, ...newImages]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = ""; // ижил файлуудыг дахин сонгох боломжтой байлгана
  };

  const openPicker = () => uploadInputRef.current?.click();

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const items = Array.from(images);
      const [reorderedImage] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedImage);
      onImagesChange(items);
    },
    [onImagesChange, images]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const removed = images.find((image) => image.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      onImagesChange(images.filter((image) => image.id !== id));
    },
    [onImagesChange, images]
  );

  return (
    <div className="w-full">
      <input
        className="hidden"
        ref={uploadInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleInputChange}
      />

      {/* Зураг оруулах талбар (файлаа энд чирж оруулж болно) */}
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-8 text-center transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00f0ff] ${
          dragOver
            ? "border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_28px_rgba(0,240,255,0.25)]"
            : "border-[#00f0ff]/30 bg-black/20 hover:border-[#00f0ff]/70 hover:bg-[#00f0ff]/5"
        } ${images.length > 0 ? "mb-4" : ""}`}
      >
        <Upload
          className="h-9 w-9 text-[#00f0ff]"
          style={{ filter: "drop-shadow(0 0 8px rgba(0,240,255,0.6))" }}
        />
        <p className="font-medium text-white">{label}</p>
      </div>

      {/* Зургуудын жагсаалт: чирж эрэмбэлнэ */}
      {images.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="chapter-images" direction="vertical">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="cyber-scroll max-h-[70vh] space-y-1.5 overflow-y-auto pr-1"
              >
                {images.map((image, index) => (
                  <Draggable key={image.id} draggableId={image.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        ref={provided.innerRef}
                        className={`flex cursor-grab items-center gap-3 border bg-[#0b0e1c] p-2 transition-colors active:cursor-grabbing ${
                          snapshot.isDragging
                            ? "z-50 border-[#00f0ff]/70 shadow-[0_0_24px_rgba(0,240,255,0.25)]"
                            : "border-white/10 hover:border-white/25"
                        }`}
                      >
                        <GripVertical className="h-4 w-4 shrink-0 text-zinc-500" />

                        <span className="font-display w-7 shrink-0 text-center text-base font-bold tabular-nums text-[#00f0ff]">
                          {index + 1}
                        </span>

                        <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-white/10 bg-black/40">
                          <Image
                            src={urlFormatter ? urlFormatter(image) : image.url}
                            alt={`Хуудас ${index + 1}`}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">Хуудас {index + 1}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            {index === 0 && (
                              <span className="border border-[#00f0ff]/40 bg-[#00f0ff]/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#00f0ff]">
                                Эхний хуудас
                              </span>
                            )}
                            <span className="text-xs tabular-nums text-zinc-400">
                              {image.file ? `${(image.file.size / (1024 * 1024)).toFixed(2)} MB` : "Хуулсан"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label={`Хуудас ${index + 1} хасах`}
                          title="Хасах"
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(image.id);
                          }}
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Нэмэх товч */}
      {images.length > 0 && (
        <button
          type="button"
          className="cyber-btn mt-4 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
          onClick={openPicker}
        >
          <Plus className="h-4 w-4" />
          Нэмэх
        </button>
      )}
    </div>
  );
}