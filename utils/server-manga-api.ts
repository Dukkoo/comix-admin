// utils/server-manga-api.ts
import { firestore } from "@/firebase/server";
import { Manga } from "./manga-api";

// Server-side function to fetch manga by ID directly from Firestore
export async function fetchMangaByIdServer(mangaId: string): Promise<Manga | null> {
  try {
    const doc = await firestore.collection("mangas").doc(mangaId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    return {
      id: doc.id,
      title: data?.title || "",
      type: data?.type || "manga",
      description: data?.description || "",
      coverImage: data?.coverImage || "",
      mangaImage: data?.mangaImage || "",
      chapters: data?.chapters || 0,
    } as Manga;
  } catch (error) {
    console.error("Error fetching manga by ID from server:", error);
    return null;
  }
}