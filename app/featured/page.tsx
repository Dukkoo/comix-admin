"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, GripVertical, Plus, Save } from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

interface FeaturedManga {
  mangaId: string;
  mangaTitle: string;
  mangaImage: string;
  order: number;
}

interface Manga {
  id: string;
  title: string;
  mangaImage: string;
}

export default function FeaturedMangasPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [featuredMangas, setFeaturedMangas] = useState<FeaturedManga[]>([]);
  const [allMangas, setAllMangas] = useState<Manga[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Manga[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await currentUser?.getIdToken();
      if (!token) return;

      // Fetch current featured mangas
      const featuredRes = await fetch("/api/admin/featured-mangas", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (featuredRes.ok) {
        const data = await featuredRes.json();
        setFeaturedMangas(data.data || []);
      }

      // Fetch all mangas for search
      const mangasRes = await fetch("/api/mangas?limit=1000");
      if (mangasRes.ok) {
        const data = await mangasRes.json();
        setAllMangas(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      const results = allMangas
        .filter((m) =>
          m.title.toLowerCase().includes(term.toLowerCase())
        )
        .filter((m) => !featuredMangas.some((f) => f.mangaId === m.id))
        .slice(0, 10);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const addManga = (manga: Manga) => {
    const newFeatured: FeaturedManga = {
      mangaId: manga.id,
      mangaTitle: manga.title,
      mangaImage: manga.mangaImage,
      order: featuredMangas.length,
    };
    setFeaturedMangas([...featuredMangas, newFeatured]);
    setSearchTerm("");
    setSearchResults([]);
  };

  const removeManga = (mangaId: string) => {
    const updated = featuredMangas
      .filter((m) => m.mangaId !== mangaId)
      .map((m, index) => ({ ...m, order: index }));
    setFeaturedMangas(updated);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(featuredMangas);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    const reorderedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    setFeaturedMangas(reorderedItems);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/admin/featured-mangas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mangas: featuredMangas.map((m) => ({
            mangaId: m.mangaId,
            order: m.order,
          })),
        }),
      });

      if (response.ok) {
        toast.success("Featured mangas updated successfully");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save featured mangas");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">
            Онцлох зурагт ном удирдах
          </h1>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save</>}
          </Button>
        </div>

        {/* Search and Add */}
        <div className="mb-6 bg-zinc-800 p-4 rounded-lg">
          <label className="text-sm text-zinc-300 mb-2 block">
            Манга хайх ба нэмэх
          </label>
          <Input
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Manga нэрээр хайх..."
            className="bg-zinc-700 border-zinc-600 text-white"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 bg-zinc-700 rounded-lg max-h-60 overflow-y-auto">
              {searchResults.map((manga) => (
                <button
                  key={manga.id}
                  onClick={() => addManga(manga)}
                  className="w-full p-3 text-left hover:bg-zinc-600 flex items-center gap-3 border-b border-zinc-600 last:border-0"
                >
                  {manga.mangaImage && (
                    <img
                      src={manga.mangaImage}
                      alt={manga.title}
                      className="w-10 h-14 object-cover rounded"
                    />
                  )}
                  <span className="text-white">{manga.title}</span>
                  <Plus className="w-4 h-4 ml-auto text-cyan-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Featured List */}
        <div className="bg-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">
            Онцлох жагсаалт ({featuredMangas.length})
          </h2>

          {featuredMangas.length === 0 ? (
            <p className="text-zinc-400 text-center py-8">
              Одоогоор онцлох манга байхгүй
            </p>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="featured-mangas">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {featuredMangas.map((manga, index) => (
                      <Draggable
                        key={manga.mangaId}
                        draggableId={manga.mangaId}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="bg-zinc-700 rounded-lg p-3 flex items-center gap-3"
                          >
                            <div {...provided.dragHandleProps}>
                              <GripVertical className="w-5 h-5 text-zinc-400" />
                            </div>
                            {manga.mangaImage && (
                              <img
                                src={manga.mangaImage}
                                alt={manga.mangaTitle}
                                className="w-12 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <p className="text-white font-medium">
                                {manga.mangaTitle}
                              </p>
                              <p className="text-zinc-400 text-sm">
                                Order: {manga.order}
                              </p>
                            </div>
                            <Button
                              onClick={() => removeManga(manga.mangaId)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
        </div>
      </div>
    </div>
  );
}