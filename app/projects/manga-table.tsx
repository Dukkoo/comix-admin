"use client";

import { Eye, Edit2, Plus, Trash2, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAuth } from '@/app/providers';
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { fetchMangas, deleteManga, Manga } from "@/utils/manga-api";

export default function MangaTable({ page = 1 }: { page?: number }) {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    mangaId: string;
    title: string;
  }>({
    isOpen: false,
    mangaId: "",
    title: "",
  });

  const getTypeCyrillic = (type: string) => {
    const types: { [key: string]: string } = {
      manga: 'Манга',
      manhwa: 'Манхва',
      manhua: 'Манхуа',
      webtoon: 'Вебтүүн',
      comic: 'Комик'
    };
    return types[type] || 'Манга';
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearchTerm) {
      params.set('search', debouncedSearchTerm);
    } else {
      params.delete('search');
    }
    params.delete('page');
    
    const newUrl = params.toString() ? `/admin/projects?${params.toString()}` : '/admin/projects';
    router.replace(newUrl);
  }, [debouncedSearchTerm, router, searchParams]);

  useEffect(() => {
    const loadMangas = async () => {
      setLoading(true);
      try {
        const result = await fetchMangas(page, 10, debouncedSearchTerm);
        setMangas(result.data || []);
        setTotalPages(result.totalPages);
      } catch (error) {
        console.error("Error loading mangas:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMangas();
  }, [page, debouncedSearchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const showDeleteDialog = (mangaId: string, title: string) => {
    setDeleteDialog({
      isOpen: true,
      mangaId,
      title,
    });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      isOpen: false,
      mangaId: "",
      title: "",
    });
  };

  const handleDelete = async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      toast.loading("Deleting manga...");

      const response = await deleteManga(deleteDialog.mangaId, token) as any;
      
      if (response.error) {
        toast.error("Failed to delete manga", {
          description: response.message,
        });
        return;
      }

      const summary = response.summary;
      const hasFiles = summary?.storageFilesDeleted && summary.storageFilesDeleted > 0;
      const hasChapters = summary?.chaptersDeleted && summary.chaptersDeleted > 0;
      
      let description = `"${deleteDialog.title}" has been removed`;
      if (hasFiles || hasChapters) {
        const parts = [];
        if (hasFiles) parts.push(`${summary.storageFilesDeleted} files`);
        if (hasChapters) parts.push(`${summary.chaptersDeleted} chapters`);
        description = `Deleted ${parts.join(' and ')}`;
      }

      toast.success("Manga deleted successfully", { description });

      setMangas(mangas.filter(manga => manga.id !== deleteDialog.mangaId));
      
    } catch (error) {
      console.error("Error deleting manga:", error);
      toast.error("Failed to delete manga");
    } finally {
      closeDeleteDialog();
    }
  };

  if (loading) {
    return <MangaTableSkeleton />;
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-4 pl-20 md:pl-24 lg:pl-6">
      <div className="w-full mx-auto px-2">
        {/* Header with Search and Button - Side by side */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8 mt-6">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="w-full md:flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Зурагт ном хайх..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-zinc-800/50 border-zinc-600/50 text-white placeholder-zinc-400 focus:border-cyan-400 focus:ring-cyan-400 rounded-lg h-12"
              />
            </div>
          </form>

          {/* New Manga Button */}
          <Button asChild className="w-full md:w-auto px-8 py-4 text-base font-semibold bg-zinc-800 hover:bg-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border-0 whitespace-nowrap">
            <Link href="/admin/projects/new">
              <Plus className="w-5 h-5 mr-2" />
              Шинэ зурагт ном нэмэх
            </Link>
          </Button>
        </div>

        {mangas.length === 0 && !loading && (
          <div className="text-center py-20">
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl p-12">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-full flex items-center justify-center">
                  {debouncedSearchTerm ? (
                    <Search className="w-12 h-12 text-zinc-400" />
                  ) : (
                    <Plus className="w-12 h-12 text-zinc-400" />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {debouncedSearchTerm ? 'Илэрц олдсонгүй' : 'Харахаахан нэмээгүй байна'}
                </h3>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                  "{debouncedSearchTerm}" Хайлтад тохирох зурагт ном олдсонгүй
                </p>
                {debouncedSearchTerm && (
                  <Button 
                    onClick={() => {
                      setSearchTerm('');
                      setDebouncedSearchTerm('');
                    }}
                    className="bg-zinc-700 hover:bg-cyan-600 text-white px-8 py-3 rounded-xl cursor-pointer"
                  >
                    Хайлтыг арилгах
                  </Button>
                )}
              </div>
          </div>
        )}

        {mangas.length > 0 && (
          <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-700/50">
              <div className="grid grid-cols-12 gap-6 items-center">
                <div className="col-span-1 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Зураг
                </div>
                <div className="col-span-4 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Нэр
                </div>
                <div className="col-span-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Төрөл
                </div>
                <div className="col-span-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Төлөв
                </div>
                <div className="col-span-1 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Бүлгийн тоо
                </div>
              </div>
            </div>

            <div className="divide-y divide-zinc-700/30">
              {mangas.map((manga) => (
                <div key={manga.id} className="px-4 py-3 hover:bg-zinc-700/20 transition-all duration-200 group">
                  <div className="grid grid-cols-12 gap-6 items-center">
                    <div className="col-span-1">
                      {manga.mangaImage ? (
                        <img
                          src={manga.mangaImage}
                          alt="Manga Page"
                          className="w-12 h-12 object-cover rounded-lg border-2 border-zinc-600/50 shadow-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-zinc-700 to-zinc-800 border-2 border-zinc-600/50 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-zinc-400">Үгүй</span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-4">
                      <div className="space-y-1">
                        <h3 className="font-bold text-white text-lg leading-tight">{manga.title}</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-zinc-400 bg-zinc-700/50 px-2 py-1 rounded-md">
                            ID: {manga.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="inline-block">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          manga.type === 'manga' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          manga.type === 'manhwa' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          manga.type === 'manhua' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          manga.type === 'webtoon' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          manga.type === 'comic' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                        }`}>
                          {getTypeCyrillic(manga.type)}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="inline-block">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          manga.status === 'ongoing' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          {manga.status === 'ongoing' ? 'Гарч байгаа' : 'Дууссан'}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-1">
                      <div className="flex items-center space-x-3">
                        <div className="bg-cyan-500/20 px-3 py-1 rounded-lg border border-cyan-500/30">
                          <span className="font-bold text-cyan-400 text-lg">
                            {(manga.chapters || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <div className="flex justify-end items-center space-x-2">
                        <Button 
                          asChild 
                          size="sm" 
                          className="bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/50 hover:border-blue-500 transition-all duration-200 rounded-lg"
                        >
                          <Link href={`/admin/projects/chapters/${manga.id}`}>
                            <Plus className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button 
                          asChild 
                          size="sm" 
                          className="bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/50 hover:border-green-500 transition-all duration-200 rounded-lg"
                        >
                          <Link href={`/admin/projects/edit/${manga.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/50 hover:border-red-500 transition-all duration-200 rounded-lg"
                          onClick={() => showDeleteDialog(manga.id, manga.title)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="bg-zinc-800/50 px-4 py-4 border-t border-zinc-700/50">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href={page > 1 ? `/admin/projects?page=${page - 1}${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ''}` : undefined}
                        className={page === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= page - 1 && pageNum <= page + 1)
                      ) {
                        return (
                          <PaginationItem key={i}>
                            <PaginationLink
                              href={`/admin/projects?page=${pageNum}${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ''}`}
                              isActive={page === pageNum}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      
                      if (pageNum === page - 2 || pageNum === page + 2) {
                        return (
                          <PaginationItem key={i}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      
                      return null;
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href={page < totalPages ? `/admin/projects?page=${page + 1}${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ''}` : undefined}
                        className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={deleteDialog.isOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Зурагт ном устгах</DialogTitle>
            <DialogDescription>
              Та "{deleteDialog.title}" зурагт номыг устгахдаа итгэлтэй байна уу? Сэргээх боломжгүй
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} className="cursor-pointer">
              Цуцлах
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="cursor-pointer">
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MangaTableSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-900 p-4 pl-20 md:pl-24 lg:pl-6">
      <div className="w-full mx-auto px-2">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8 mt-6">
          <Skeleton className="w-full md:flex-1 max-w-xl h-12 bg-zinc-800" />
          <Skeleton className="w-full md:w-auto h-12 bg-zinc-800" />
        </div>

        <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-700/50">
            <div className="grid grid-cols-12 gap-6 items-center">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="col-span-2 h-4 bg-zinc-700" />
              ))}
            </div>
          </div>

          <div className="divide-y divide-zinc-700/30">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="grid grid-cols-12 gap-6 items-center">
                  <Skeleton className="col-span-1 w-12 h-12 rounded-lg bg-zinc-700" />
                  <div className="col-span-4 space-y-2">
                    <Skeleton className="h-5 w-3/4 bg-zinc-700" />
                    <Skeleton className="h-4 w-1/2 bg-zinc-700" />
                  </div>
                  <Skeleton className="col-span-2 h-6 w-20 rounded-full bg-zinc-700" />
                  <Skeleton className="col-span-2 h-6 w-20 rounded-full bg-zinc-700" />
                  <Skeleton className="col-span-1 h-8 w-12 rounded-lg bg-zinc-700" />
                  <div className="col-span-2 flex justify-end space-x-2">
                    <Skeleton className="h-8 w-8 rounded-lg bg-zinc-700" />
                    <Skeleton className="h-8 w-8 rounded-lg bg-zinc-700" />
                    <Skeleton className="h-8 w-8 rounded-lg bg-zinc-700" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { MangaTableSkeleton };