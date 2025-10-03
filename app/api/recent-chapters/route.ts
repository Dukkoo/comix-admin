// app/api/recent-chapters/route.ts
import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/firebase/server";

interface ChapterData {
  id: string;
  chapterNumber: number;
  mangaId: string;
  mangaTitle: string;
  avatarImage: string;
  coverImage: string;
  createdAt?: string;
  mangaType: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '12');
  
  try {
    const mangasSnapshot = await firestore
      .collection("mangas")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    
    const allChapters: ChapterData[] = []; // TYPE НЭМСЭН
    
    for (const mangaDoc of mangasSnapshot.docs) {
      const mangaData = mangaDoc.data();
      
      const chaptersSnapshot = await firestore
        .collection("mangas")
        .doc(mangaDoc.id)
        .collection("chapters")
        .orderBy("chapterNumber", "desc")
        .limit(15)
        .get();
      
      chaptersSnapshot.docs.forEach(chapterDoc => {
        const chapterData = chapterDoc.data();
        allChapters.push({
          id: chapterDoc.id,
          chapterNumber: chapterData.chapterNumber,
          mangaId: mangaDoc.id,
          mangaTitle: mangaData.title,
          avatarImage: mangaData.avatarImage || '',
          coverImage: mangaData.coverImage || '',
          createdAt: chapterData.createdAt,
          mangaType: mangaData.type || 'manga'
        });
      });
    }
    
    allChapters.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
    
    const startIndex = (page - 1) * limit;
    const paginatedChapters = allChapters.slice(startIndex, startIndex + limit);
    
    return NextResponse.json({
      data: paginatedChapters,
      totalCount: allChapters.length,
      totalPages: Math.ceil(allChapters.length / limit),
      currentPage: page
    });
    
  } catch (error) {
    console.error('Error fetching recent chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}