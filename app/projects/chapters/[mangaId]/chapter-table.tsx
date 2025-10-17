"use client";

import { Edit2, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from '@/app/providers';
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { fetchChapters, deleteChapter, Chapter } from "@/utils/chapter-api";

export default function ChapterTable({ 
  mangaId, 
  mangaTitle, 
  page = 1 
}: { 
  mangaId: string;
  mangaTitle: string;
  page?: number;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [filteredChapters, setFilteredChapters] = useState<Chapter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    chapterId: string;
    chapterNumber: number;
  }>({
    isOpen: false,
    chapterId: "",
    chapterNumber: 0,
  });

  useEffect(() => {
    const loadChapters = async () => {
      try {
        // Fetch all chapters without pagination (set pageSize to 9999)
        const result = await fetchChapters(mangaId, 1, 9999);
        // Sort chapters by chapter number descending (latest first)
        const sortedChapters = (result.data || []).sort((a, b) => b.chapterNumber - a.chapterNumber);
        setChapters(sortedChapters);
        setFilteredChapters(sortedChapters);
        setTotalPages(result.totalPages);
      } catch (error) {
        console.error("Error loading chapters:", error);
      } finally {
        setLoading(false);
      }
    };

    loadChapters();
  }, [mangaId]);

  // Filter chapters based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredChapters(chapters);
    } else {
      const filtered = chapters.filter(chapter =>
        chapter.chapterNumber.toString().includes(searchQuery.trim())
      );
      setFilteredChapters(filtered);
    }
  }, [searchQuery, chapters]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const showDeleteDialog = (chapterId: string, chapterNumber: number) => {
    setDeleteDialog({
      isOpen: true,
      chapterId,
      chapterNumber,
    });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      isOpen: false,
      chapterId: "",
      chapterNumber: 0,
    });
  };

  const handleDelete = async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      toast.loading("Deleting chapter...");

      const response = await deleteChapter(mangaId, deleteDialog.chapterId, token);
      
      if (response.error) {
        toast.error("Failed to delete chapter", {
          description: response.message,
        });
        return;
      }

      toast.success("Chapter deleted successfully", {
        description: `Chapter ${deleteDialog.chapterNumber} has been removed`,
      });

      // Remove the deleted chapter from the local state
      const updatedChapters = chapters.filter(chapter => chapter.id !== deleteDialog.chapterId);
      setChapters(updatedChapters);
      setFilteredChapters(updatedChapters);
      
    } catch (error) {
      console.error("Error deleting chapter:", error);
      toast.error("Failed to delete chapter");
    } finally {
      closeDeleteDialog();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <span className="loader"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-1">
      <div className="w-full mx-auto px-2">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">{mangaTitle}</h1>
            </div>
            
            {/* Search Bar - Centered */}
            <div className="relative max-w-lg w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Бүлгийн тоогоор хайх"
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10 bg-zinc-800/50 border-zinc-600/50 text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-10 w-full"
              />
            </div>
            
            <Button 
              asChild 
              className="px-8 py-4 text-lg font-semibold bg-zinc-800 hover:bg-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border-0"
            >
              <Link href={`/projects/chapters/${mangaId}/new`}>
                <Plus className="w-5 h-5 mr-3" />
                Шинэ бүлэг нэмэх
              </Link>
            </Button>
          </div>
        </div>

        {chapters.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl p-12">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-full flex items-center justify-center">
                <Plus className="w-12 h-12 text-zinc-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Одоогоор бүлэг нэмэгдээгүй байна</h3>
            </div>
          </div>
        )}

        {filteredChapters.length === 0 && chapters.length > 0 && (
          <div className="text-center py-12">
            <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl p-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-full flex items-center justify-center">
                <Search className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Бүлэг олдсонгүй</h3>
              <Button 
                onClick={() => setSearchQuery("")}
                className="bg-zinc-800 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg"
              >
                Хайлтыг арилгах
              </Button>
            </div>
          </div>
        )}

        {filteredChapters.length > 0 && (
          <div className="space-y-2">
            {filteredChapters.map((chapter, index) => (
              <Card key={chapter.id} className="bg-zinc-800/30 backdrop-blur-xl border-zinc-700/50 hover:bg-zinc-700/20 transition-all duration-200 shadow-lg h-12">
                <CardContent className="p-0 h-full">
                  <div className="flex items-center justify-between w-full h-full px-4">
                    {/* Chapter Info */}
                    <div className="flex items-center">
                      <h3 className="font-bold text-white text-lg leading-none">
                        Бүлэг : {chapter.chapterNumber}
                      </h3>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <Button 
                        asChild 
                        size="sm" 
                        className="bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/50 hover:border-green-500 transition-all duration-200 rounded-lg cursor-pointer h-8 w-8 p-0 flex items-center justify-center"
                      >
                        <Link href={`/projects/chapters/${mangaId}/edit/${chapter.id}`}>
                          <Edit2 className="w-3 h-3" />
                        </Link>
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/50 hover:border-red-500 transition-all duration-200 rounded-lg cursor-pointer h-8 w-8 p-0 flex items-center justify-center"
                        onClick={() => showDeleteDialog(chapter.id, chapter.chapterNumber)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={deleteDialog.isOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Бүлэг устгах</DialogTitle>
            <DialogDescription>
              Та Бүлэг : {deleteDialog.chapterNumber}-ийг устгахдаа итгэлтэй байна уу? Сэргээгдэх боломжгүй
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="cursor-pointer" variant="outline" onClick={closeDeleteDialog}>
              Цуцлах
            </Button>
            <Button className="cursor-pointer" variant="destructive" onClick={handleDelete}>
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}