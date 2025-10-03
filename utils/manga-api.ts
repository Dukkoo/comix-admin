// utils/manga-api.ts
export interface Manga {
  id: string;
  title: string;
  type: "manga" | "manhwa" | "manhua" | "webtoon" | "comic";
  status: "ongoing" | "finished";
  description?: string;
  coverImage?: string;
  mangaImage?: string;
  avatarImage?: string;
  chapters: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface MangaResponse {
  data: Manga[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

export const fetchMangas = async (
  page: number = 1,
  limit: number = 10,
  searchTerm?: string
): Promise<MangaResponse> => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (searchTerm && searchTerm.trim()) {
      params.append('search', searchTerm.trim());
    }

    const response = await fetch(`/api/mangas?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch mangas');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching mangas:', error);
    return {
      data: [],
      totalPages: 0,
      currentPage: page,
      totalCount: 0,
    };
  }
};

export const fetchMangaById = async (id: string): Promise<{ data?: Manga; error?: string }> => {
  try {
    const response = await fetch(`/api/mangas/${id}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || 'Failed to fetch manga' };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching manga:', error);
    return { error: 'Failed to fetch manga' };
  }
};

export const createManga = async (
  data: {
    id: string;
    title: string;
    type: "manga" | "manhwa" | "manhua" | "webtoon" | "comic";
    status: "ongoing" | "finished";
    coverImage?: string;
    mangaImage?: string;
    avatarImage?: string; // Added this field
    description?: string;
    chapters?: number;
  },
  authToken: string
): Promise<{ error: boolean; message: string; id?: string }> => {
  try {
    const response = await fetch('/api/mangas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });

    return await response.json();
  } catch (error) {
    console.error('Error creating manga:', error);
    return { error: true, message: 'Failed to create manga' };
  }
};

export const updateManga = async (
  mangaId: string,
  data: Partial<Manga>,
  authToken: string
): Promise<{ error: boolean; message: string }> => {
  try {
    const response = await fetch(`/api/mangas/${mangaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });

    return await response.json();
  } catch (error) {
    console.error('Error updating manga:', error);
    return { error: true, message: 'Failed to update manga' };
  }
};

export const deleteManga = async (
  mangaId: string,
  authToken: string
): Promise<{ error: boolean; message: string }> => {
  try {
    const response = await fetch(`/api/mangas/${mangaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Error deleting manga:', error);
    return { error: true, message: 'Failed to delete manga' };
  }
};