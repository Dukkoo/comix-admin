'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

interface Manga {
  id: string;
  title: string;
  coverImage?: string;
  avatarImage?: string;
  type: string;
  description?: string;
}

export default function AdminCarouselManager() {
  const { currentUser } = useAuth();
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [filteredMangas, setFilteredMangas] = useState<Manga[]>([]);
  const [carouselMangas, setCarouselMangas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMangas();
    fetchCarouselMangas();
  }, []);

  useEffect(() => {
    // Filter mangas based on search query
    if (searchQuery.trim() === '') {
      setFilteredMangas(mangas);
    } else {
      const filtered = mangas.filter(manga =>
        manga.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMangas(filtered);
    }
  }, [mangas, searchQuery]);

  const fetchMangas = async () => {
    try {
      const response = await fetch('/api/mangas?pageSize=100');
      if (response.ok) {
        const result = await response.json();
        // Only get mangas that have cover images
        const mangasWithImages = (result.data || []).filter((manga: Manga) => manga.coverImage || manga.avatarImage);
        setMangas(mangasWithImages);
      }
    } catch (error) {
      console.error('Failed to fetch mangas:', error);
    }
  };

  const fetchCarouselMangas = async () => {
    try {
      const response = await fetch('/api/admin/carousel-mangas');
      if (response.ok) {
        const result = await response.json();
        const carouselIds = result.data?.map((manga: Manga) => manga.id) || [];
        setCarouselMangas(carouselIds);
      }
    } catch (error) {
      console.error('Failed to fetch carousel mangas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMangaToggle = (mangaId: string, checked: boolean) => {
    if (checked) {
      // Add to carousel if under limit AND not already in the array
      if (carouselMangas.length < 6 && !carouselMangas.includes(mangaId)) {
        setCarouselMangas(prev => [...prev, mangaId]);
      }
    } else {
      // Remove from carousel
      setCarouselMangas(prev => prev.filter(id => id !== mangaId));
    }
  };

  const saveCarouselMangas = async () => {
    setSaving(true);
    try {
      if (!currentUser) {
        alert('Please log in to save changes.');
        return;
      }

      const token = await currentUser.getIdToken();
      
      const response = await fetch('/api/admin/carousel-mangas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ mangaIds: carouselMangas }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Carousel манга амжилттай хадгалагдлаа!');
      } else {
        throw new Error(result.message || 'Failed to save');
      }
    } catch (error) {
      alert('Алдаа гарлаа. Дахин оролдоно уу.');
      console.error('Failed to save carousel mangas:', error);
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'manga': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'manhwa': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'manhua': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'webtoon': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'comic': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    }
  };

  const getTypeCyrillic = (type: string) => {
    switch (type) {
      case 'manga': return 'МАНГА';
      case 'manhwa': return 'МАНХВА';
      case 'manhua': return 'МАНХУА';
      case 'webtoon': return 'ВЕБТҮҮН';
      case 'comic': return 'КОМИК';
      default: return 'МАНГА';
    }
  };

  if (loading) {
    return (
      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader>
          <CardTitle className="text-white">Carousel удирдлага</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-zinc-400">Ачаалж байна...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-800/50 border-zinc-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Carousel удирдлага</CardTitle>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            {carouselMangas.length}/6 сонгосон
          </span>
          <Button 
            onClick={saveCarouselMangas}
            disabled={saving}
            className="bg-cyan-600 hover:bg-cyan-700 cursor-pointer"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
            <Input
              placeholder="Манга хайх..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-700 border-zinc-600 text-white placeholder:text-zinc-400 focus:border-cyan-500"
            />
          </div>
          
          <ScrollArea className="h-64 w-full border border-zinc-700 rounded-lg p-4">
            <div className="space-y-3">
              {filteredMangas.map((manga) => {
                const isSelected = carouselMangas.includes(manga.id);
                const isDisabled = !isSelected && carouselMangas.length >= 6;
                
                return (
                  <div
                    key={manga.id}
                    className={`flex items-center space-x-3 py-1 px-2 rounded-lg border transition-colors ${
                      isSelected 
                        ? 'border-cyan-500 bg-cyan-500/10' 
                        : isDisabled
                        ? 'border-zinc-700 bg-zinc-800/50 opacity-50 cursor-not-allowed'
                        : 'border-zinc-600 bg-zinc-700/30 hover:border-zinc-500'
                    }`}
                  >
                    <Checkbox
                      id={manga.id}
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={(checked) => handleMangaToggle(manga.id, checked as boolean)}
                      className="border-zinc-400 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600 h-4 w-4"
                    />
                    
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Badge className={`${getTypeColor(manga.type)} border text-xs h-4 px-1.5 py-0 flex-shrink-0`}>
                        {getTypeCyrillic(manga.type)}
                      </Badge>
                      <label 
                        htmlFor={manga.id}
                        className={`text-sm font-medium cursor-pointer truncate ${
                          isDisabled ? 'text-zinc-500 cursor-not-allowed' : 'text-white hover:text-cyan-400'
                        }`}
                      >
                        {manga.title}
                      </label>
                    </div>
                  </div>
                );
              })}
              
              {filteredMangas.length === 0 && searchQuery.trim() !== '' && (
                <div className="text-center py-8 text-zinc-400">
                  "{searchQuery}" хайлтаар илэрц олдсонгүй
                </div>
              )}
              
              {mangas.length === 0 && (
                <div className="text-center py-8 text-zinc-400">
                  Зурагтай манга олдсонгүй
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}