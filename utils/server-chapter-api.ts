// utils/server-chapter-api.ts
import { firestore } from "@/firebase/server";
import { Chapter } from "./chapter-api";

export async function fetchChaptersByMangaIdServer(mangaId: string, page: number = 1, pageSize: number = 10) {
  try {
    // Use the correct subcollection path
    const chaptersRef = firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters");
    
    const totalSnapshot = await chaptersRef.get();
    const totalCount = totalSnapshot.size;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    const offset = (page - 1) * pageSize;
    const snapshot = await chaptersRef
      .orderBy("chapterNumber", "desc")
      .limit(pageSize)
      .offset(offset)
      .get();
    
    const chapters: Chapter[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      chapters.push({
        id: doc.id,
        chapterNumber: data.chapterNumber !== undefined ? data.chapterNumber : parseInt(doc.id),
        mangaId: mangaId,
        createdAt: data.createdAt || null,
      });
    });
    
    return {
      data: chapters,
      totalPages,
      totalCount,
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching chapters from server:", error);
    return {
      data: [],
      totalPages: 0,
      totalCount: 0,
      currentPage: page,
    };
  }
}

export async function fetchChapterByIdServer(mangaId: string, chapterId: string): Promise<Chapter | null> {
  try {
    // Use the correct subcollection path
    const doc = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    
    return {
      id: doc.id,
      chapterNumber: data?.chapterNumber !== undefined ? data.chapterNumber : parseInt(doc.id),
      mangaId: mangaId,
      createdAt: data?.createdAt || null,
    } as Chapter;
  } catch (error) {
    console.error("Error fetching chapter by ID from server:", error);
    return null;
  }
}