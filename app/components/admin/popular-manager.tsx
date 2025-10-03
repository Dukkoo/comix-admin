'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import { Plus, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Manga {
  id: string;
  title: string;
  coverImage?: string;
  avatarImage?: string;
  mangaImage?: string;
  type: string;
  description?: string;
}

export default function AdminPopularManager() {
  const { currentUser } = useAuth();
  const [selectedMangas, setSelectedMangas] = useState<Manga[]>([]);
  const [allMangas, setAllMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMangaSelector, setShowMangaSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load current popular mangas
      const popularResponse = await fetch('/api/admin/popular-mangas');
      if (popularResponse.ok) {
        const popularResult = await popularResponse.json();
        setSelectedMangas(popularResult.data || []);
      }

      // Load all available mangas
      const mangasResponse = await fetch('/api/mangas?pageSize=100');
      if (mangasResponse.ok) {
        const mangasResult = await mangasResponse.json();
        setAllMangas(mangasResult.data || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Мэдээлэл ачаалж чадсангүй');
    } finally {
      setLoading(false);
    }
  };

  const saveSelection = async () => {
    if (!currentUser) return;

    try {
      setSaving(true);
      const token = await currentUser.getIdToken();

      const response = await fetch('/api/admin/popular-mangas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mangas: selectedMangas.map((manga, index) => ({
            mangaId: manga.id,
            order: index + 1
          }))
        }),
      });

      if (response.ok) {
        toast.success('Алдартай манга амжилттай хадгалагдлаа');
      } else {
        throw new Error('Failed to save popular mangas');
      }
    } catch (error) {
      console.error('Failed to save popular mangas:', error);
      toast.error('Хадгалж чадсангүй');
    } finally {
      setSaving(false);
    }
  };

  const addManga = (manga: Manga) => {
    if (selectedMangas.length >= 3) {
      toast.error('Хамгийн ихдээ 3 манга сонгох боломжтой');
      return;
    }

    if (selectedMangas.find(m => m.id === manga.id)) {
      toast.error('Энэ манга аль хэдийн сонгогдсон байна');
      return;
    }

    setSelectedMangas([...selectedMangas, manga]);
    setShowMangaSelector(false);
    setSearchQuery('');
  };

  const removeManga = (mangaId: string) => {
    setSelectedMangas(selectedMangas.filter(manga => manga.id !== mangaId));
  };

  const filteredMangas = allMangas.filter(manga =>
    manga.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedMangas.find(m => m.id === manga.id)
  );

  if (loading) {
  return (
    <div className="bg-zinc-800/30 backdrop-blur-sm border border-zinc-700/50 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white mb-6">Алдартай манга удирдлага</h2>
      <div className="flex flex-col items-center justify-center py-12">
        <span className="loader"></span>
      </div>
    </div>
  );
}

  return (
    <div className="bg-zinc-800/30 backdrop-blur-sm border border-zinc-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Алдартай манга удирдлага</h2>
        <div className="text-sm text-zinc-400">
          {selectedMangas.length}/3 сонгогдсон
        </div>
      </div>

      {/* Selected Mangas */}
      <div className="space-y-3 mb-6">
        {selectedMangas.map((manga, index) => (
          <div key={manga.id} className="bg-zinc-900/50 border border-zinc-600/50 rounded-lg p-4 flex items-center gap-4 group hover:border-zinc-500/50 transition-colors">
            <div className="bg-yellow-500/20 text-yellow-400 font-bold text-lg w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
              #{index + 1}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{manga.title}</h3>
              <p className="text-sm text-zinc-400 capitalize">{manga.type}</p>
            </div>
            
            <button
              onClick={() => removeManga(manga.id)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        
        {/* Add manga slots */}
        {Array.from({ length: 3 - selectedMangas.length }).map((_, index) => (
          <button
            key={`empty-${index}`}
            onClick={() => setShowMangaSelector(true)}
            className="w-full bg-zinc-900/30 border-2 border-dashed border-zinc-600 rounded-lg p-4 flex items-center justify-center hover:border-cyan-500 hover:bg-zinc-800/50 transition-colors group"
          >
            <Plus className="h-5 w-5 text-zinc-500 group-hover:text-cyan-400 mr-2" />
            <span className="text-zinc-500 group-hover:text-cyan-400">Манга нэмэх</span>
          </button>
        ))}
      </div>

      {/* Manga Selector */}
      {showMangaSelector && (
        <div className="border-t border-zinc-700/50 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Манга сонгох</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMangaSelector(false)}
              className="bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
            >
              Хаах
            </Button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Манга хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900/50 border-zinc-600/50 text-white"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredMangas.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-zinc-400">Манга олдсонгүй</p>
              </div>
            ) : (
              filteredMangas.map((manga) => (
                <button
                  key={manga.id}
                  onClick={() => addManga(manga)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-600/50 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{manga.title}</h4>
                    <p className="text-sm text-zinc-400 capitalize">{manga.type}</p>
                  </div>
                  <Plus className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      {selectedMangas.length > 0 && (
        <div className="flex justify-between items-center pt-6 border-t border-zinc-700/50">
          <p className="text-zinc-400 text-sm">
            {selectedMangas.length} манга сонгогдсон
          </p>
          <Button
            onClick={saveSelection}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </div>
      )}
    </div>
  );
}