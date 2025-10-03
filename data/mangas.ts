import { firestore } from "@/firebase/server";

export interface Manga {
  id: string;
  title: string;
  type: "manga" | "manhwa" | "manhua" | "webtoon" | "comic";
  description?: string;
  coverImage?: string;
  mangaImage?: string;
  chapters?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

interface GetMangasParams {
  pagination?: {
    page: number;
    pageSize: number;
  };
  filter?: {
    title?: string;
  };
  search?: string;
}

export async function getMangas({
  pagination = { page: 1, pageSize: 10 },
  filter,
  search,
}: GetMangasParams = {}) {
  try {
    let query = firestore.collection("mangas").orderBy("title", "asc");

    // Apply filters
    if (filter?.title) {
      query = query.where("title", "==", filter.title);
    }

    // Get total count for pagination
    const totalSnapshot = await query.get();
    const totalCount = totalSnapshot.size;
    const totalPages = Math.ceil(totalCount / pagination.pageSize);

    // Apply pagination
    const offset = (pagination.page - 1) * pagination.pageSize;
    const paginatedQuery = query.limit(pagination.pageSize).offset(offset);

    const snapshot = await paginatedQuery.get();

    if (snapshot.empty) {
      return {
        data: null,
        totalPages: 0,
        totalCount: 0,
        currentPage: pagination.page,
      };
    }

    let mangas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Manga[];

    // Apply search filter (client-side for simplicity)
    if (search) {
      const searchLower = search.toLowerCase();
      mangas = mangas.filter(
        (manga) =>
          manga.title.toLowerCase().includes(searchLower) ||
          manga.description?.toLowerCase().includes(searchLower)
      );
    }

    return {
      data: mangas,
      totalPages,
      totalCount: mangas.length,
      currentPage: pagination.page,
    };
  } catch (error) {
    console.error("Error fetching mangas:", error);
    return {
      data: null,
      totalPages: 0,
      totalCount: 0,
      currentPage: pagination.page,
    };
  }
}

export async function getMangaById(id: string): Promise<Manga | null> {
  try {
    const doc = await firestore.collection("mangas").doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Manga;
  } catch (error) {
    console.error("Error fetching manga by ID:", error);
    return null;
  }
}

export async function getMangasByTitle(title: string): Promise<Manga[]> {
  try {
    const snapshot = await firestore
      .collection("mangas")
      .where("title", "==", title)
      .orderBy("title", "asc")
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Manga[];
  } catch (error) {
    console.error("Error fetching mangas by title:", error);
    return [];
  }
}

export async function searchMangas(searchTerm: string): Promise<Manga[]> {
  try {
    // Note: Firestore doesn't support full-text search natively
    // For production, consider using Algolia or Elasticsearch
    const snapshot = await firestore
      .collection("mangas")
      .orderBy("title", "asc")
      .get();

    if (snapshot.empty) {
      return [];
    }

    const allMangas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Manga[];

    const searchLower = searchTerm.toLowerCase();
    return allMangas.filter(
      (manga) =>
        manga.title.toLowerCase().includes(searchLower) ||
        manga.description?.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error("Error searching mangas:", error);
    return [];
  }
}