"use server";

import { auth, firestore } from "@/firebase/server";
import { chapterSchema } from "@/validation/chapterSchema";
import { revalidatePath } from "next/cache";

export const createChapter = async (
  data: { chapterNumber: number; mangaId: string },
  authToken: string
) => {
  const verifiedToken = await auth.verifyIdToken(authToken);

  if (!verifiedToken.admin) {
    return {
      error: true,
      message: "Unauthorized",
    };
  }

  const validation = chapterSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: true,
      message: validation.error.issues[0]?.message ?? "An error occurred",
    };
  }

  try {
    const { chapterNumber, mangaId } = validation.data;

    const existingChapter = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterNumber.toString())
      .get();

    if (existingChapter.exists) {
      return {
        error: true,
        message: "Chapter already exists for this manga",
      };
    }

    await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterNumber.toString())
      .set({
        chapterNumber,
        createdAt: new Date().toISOString(),
      });

    const chaptersSnapshot = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .get();
    
    const chapterCount = chaptersSnapshot.size;

    await firestore.collection("mangas").doc(mangaId).update({
      chapters: chapterCount,
    });

    revalidatePath(`/projects/chapters/${mangaId}`);
    revalidatePath(`/projects/chapters/${mangaId}/new`);

    return {
      error: false,
      message: "Chapter created successfully",
      chapterId: chapterNumber.toString(),
    };
  } catch (error) {
    console.error("Error creating chapter:", error);
    return {
      error: true,
      message: "Failed to create chapter",
    };
  }
};

export const saveChapterImages = async (
  data: { 
    mangaId: string; 
    chapterId: string; 
    images: string[] 
  },
  authToken: string
) => {
  const verifiedToken = await auth.verifyIdToken(authToken);

  if (!verifiedToken.admin) {
    return {
      error: true,
      message: "Unauthorized",
    };
  }

  try {
    await firestore
      .collection("mangas")
      .doc(data.mangaId)
      .collection("chapters")
      .doc(data.chapterId)
      .update({
        images: data.images,
        pageCount: data.images.length,
      });

    revalidatePath(`/projects/chapters/${data.mangaId}`);

    return {
      error: false,
      message: "Chapter images saved successfully",
    };
  } catch (error) {
    console.error("Error saving chapter images:", error);
    return {
      error: true,
      message: "Failed to save chapter images",
    };
  }
};