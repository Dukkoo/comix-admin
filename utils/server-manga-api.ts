import { firestore } from "@/firebase/server";
import { Manga, MangaGenre } from "./manga-api";

export async function fetchMangaByIdServer(
  mangaId: string
): Promise<Manga | null> {
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
      status: data?.status || "ongoing",
      genres: (data?.genres as MangaGenre[]) || [],
      description: data?.description || "",
      coverImage: data?.coverImage || "",
      mangaImage: data?.mangaImage || "",
      avatarImage: data?.avatarImage || "",
      chapters: data?.chapters || 0,
      createdAt: data?.createdAt || null,
      updatedAt: data?.updatedAt || null,
      createdBy: data?.createdBy || "",
    } as Manga;
  } catch (error) {
    console.error("Error fetching manga by ID from server:", error);
    return null;
  }
}

export async function fetchMangasByGenreServer(
  genre: MangaGenre,
  limit: number = 10
): Promise<Manga[]> {
  try {
    const snapshot = await firestore
      .collection("mangas")
      .where("genres", "array-contains", genre)
      .orderBy("title", "asc")
      .limit(limit)
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data?.title || "",
        type: data?.type || "manga",
        status: data?.status || "ongoing",
        genres: (data?.genres as MangaGenre[]) || [],
        description: data?.description || "",
        coverImage: data?.coverImage || "",
        mangaImage: data?.mangaImage || "",
        avatarImage: data?.avatarImage || "",
        chapters: data?.chapters || 0,
        createdAt: data?.createdAt || null,
        updatedAt: data?.updatedAt || null,
        createdBy: data?.createdBy || "",
      } as Manga;
    });
  } catch (error) {
    console.error("Error fetching mangas by genre from server:", error);
    return [];
  }
}