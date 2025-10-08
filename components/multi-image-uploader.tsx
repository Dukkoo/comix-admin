"use client";

import { useCallback, useRef } from "react";
import { Button } from "./ui/button";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import Image from "next/image";
import { Badge } from "./ui/badge";
import { MoveIcon, XIcon, Upload, Plus } from "lucide-react";

export type ImageUpload = {
  id: string;
  url: string;
  file?: File;
  preview?: string; // Add preview property for better type safety
};

type Props = {
  images?: ImageUpload[];
  onImagesChange: (images: ImageUpload[]) => void;
  urlFormatter?: (image: ImageUpload) => string;
  label?: string;
};

export default function MultiImageUploader({
  images = [],
  onImagesChange,
  urlFormatter,
  label = "Upload Chapter Images",
}: Props) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        url: previewUrl,
        preview: previewUrl,
        file,
      };
    });

    onImagesChange([...images, ...newImages]);
  };

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
      const updatedImages = images.filter((image) => image.id !== id);
      onImagesChange(updatedImages);
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
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleInputChange}
      />
      
      {/* Upload Button */}
      <div 
        className="relative border-2 border-dashed border-zinc-600/50 rounded-xl p-8 text-center hover:border-cyan-400/50 transition-all duration-300 cursor-pointer bg-zinc-800/50 backdrop-blur-sm mb-4"
        onClick={() => uploadInputRef?.current?.click()}
      >
        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-zinc-400" />
          </div>
          <div>
            <p className="text-white font-medium">{label}</p>
            <p className="text-zinc-400 text-sm mt-1">Click to upload or drag and drop</p>
            <p className="text-zinc-500 text-xs mt-1">PNG, JPG, GIF up to 10MB each</p>
          </div>
        </div>
      </div>

      {/* Images List */}
      {images.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="chapter-images" direction="vertical">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {images.map((image, index) => (
                  <Draggable key={image.id} draggableId={image.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        ref={provided.innerRef}
                        className={`relative ${snapshot.isDragging ? 'z-50' : ''}`}
                      >
                        <div className="bg-zinc-800/50 rounded-lg flex gap-4 items-center overflow-hidden border border-zinc-600/50 p-3 hover:bg-zinc-700/50 transition-all duration-200">
                          {/* Image Preview - FIXED: Added sizes prop */}
                          <div className="w-16 h-16 relative rounded-lg overflow-hidden border border-zinc-600/50">
                            <Image
                              src={urlFormatter ? urlFormatter(image) : image.url}
                              alt={`Page ${index + 1}`}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                          
                          {/* Image Info */}
                          <div className="flex-grow">
                            <p className="text-sm font-medium text-white">
                              Page {index + 1}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {index === 0 && (
                                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                                  First Page
                                </Badge>
                              )}
                              <span className="text-xs text-zinc-400">
                                {image.file ? `${(image.file.size / (1024 * 1024)).toFixed(2)} MB` : 'Uploaded'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(image.id);
                              }}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                            <div className="text-zinc-400 p-2 cursor-grab active:cursor-grabbing">
                              <MoveIcon className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
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

      {/* Add More Button */}
      {images.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full mt-4 bg-zinc-800/50 border-zinc-600/50 text-white hover:bg-zinc-700/50 hover:border-cyan-400/50 transition-all duration-300"
          onClick={() => uploadInputRef?.current?.click()}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add More Images
        </Button>
      )}
    </div>
  );
}