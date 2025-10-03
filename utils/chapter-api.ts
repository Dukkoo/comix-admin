// utils/chapter-api.ts
export interface Chapter {
  id: string;
  chapterNumber: number;
  mangaId: string;
  createdAt?: string;
}

export interface ChapterResponse {
  data: Chapter[] | null;
  totalPages: number;
  totalCount: number;
  currentPage: number;
}

export async function fetchChapters(mangaId: string, page: number = 1, pageSize: number = 10): Promise<ChapterResponse> {
  try {
    const url = `/api/mangas/${mangaId}/chapters?page=${page}&pageSize=${pageSize}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        data: [],
        totalPages: 0,
        totalCount: 0,
        currentPage: page,
      };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return {
      data: [],
      totalPages: 0,
      totalCount: 0,
      currentPage: page,
    };
  }
}

export async function fetchChapterById(mangaId: string, chapterId: string): Promise<Chapter | null> {
  try {
    const response = await fetch(`/api/mangas/${mangaId}/chapters/${chapterId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch chapter');
    }
    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('Error fetching chapter by ID:', error);
    return null;
  }
}

export async function createChapter(chapterData: Omit<Chapter, 'id'>, token: string) {
  try {
    const response = await fetch(`/api/mangas/${chapterData.mangaId}/chapters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(chapterData),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        error: true,
        message: result.error || 'Failed to create chapter',
      };
    }

    return {
      error: false,
      message: result.message,
      id: result.id,
    };
  } catch (error) {
    console.error('Error creating chapter:', error);
    return {
      error: true,
      message: 'Failed to create chapter',
    };
  }
}

export async function updateChapter(mangaId: string, chapterId: string, updateData: Partial<Chapter>, token: string) {
  try {
    const response = await fetch(`/api/mangas/${mangaId}/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updateData),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        error: true,
        message: result.error || 'Failed to update chapter',
      };
    }

    return {
      error: false,
      message: result.message,
    };
  } catch (error) {
    console.error('Error updating chapter:', error);
    return {
      error: true,
      message: 'Failed to update chapter',
    };
  }
}

export async function deleteChapter(mangaId: string, chapterId: string, token: string) {
  try {
    const response = await fetch(`/api/mangas/${mangaId}/chapters/${chapterId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        error: true,
        message: result.error || 'Failed to delete chapter',
      };
    }

    return {
      error: false,
      message: result.message,
    };
  } catch (error) {
    console.error('Error deleting chapter:', error);
    return {
      error: true,
      message: 'Failed to delete chapter',
    };
  }
}