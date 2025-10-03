"use server";

import { auth, firestore } from "@/firebase/server";
import { Manga } from "@/utils/manga-api";
import { revalidatePath } from "next/cache";

export const updateManga = async (data: Manga, authToken: string) => {
  const { id, ...mangaData } = data;
  const verifiedToken = await auth.verifyIdToken(authToken);

  if (!verifiedToken.admin) {
    return {
      error: true,
      message: "Unauthorized",
    };
  }

  // Basic validation
  if (!mangaData.title || !mangaData.type) {
    return {
      error: true,
      message: "Title and type are required",
    };
  }

  try {
    await firestore
      .collection("mangas")
      .doc(id)
      .update({
        ...mangaData,
        updated: new Date(),
      });

    revalidatePath(`/projects`);
    revalidatePath(`/projects/edit/${id}`);
    
    return {
      error: false,
      message: "Manga updated successfully",
    };
  } catch (error) {
    console.error("Error updating manga:", error);
    return {
      error: true,
      message: "Failed to update manga",
    };
  }
};

export const saveMangaImages = async (
  data: { 
    mangaId: string; 
    coverImage?: string; 
    mangaImage?: string;
    avatarImage?: string;
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
    const updateData: any = {};
    
    if (data.coverImage !== undefined) {
      updateData.coverImage = data.coverImage;
    }
    if (data.mangaImage !== undefined) {
      updateData.mangaImage = data.mangaImage;
    }
    if (data.avatarImage !== undefined) {
      updateData.avatarImage = data.avatarImage;
    }

    if (Object.keys(updateData).length > 0) {
      await firestore
        .collection("mangas")
        .doc(data.mangaId)
        .update({
          ...updateData,
          updated: new Date(),
        });
    }

    revalidatePath(`/projects`);
    revalidatePath(`/projects/edit/${data.mangaId}`);
    
    return {
      error: false,
      message: "Manga images updated successfully",
    };
  } catch (error) {
    console.error("Error updating manga images:", error);
    return {
      error: true,
      message: "Failed to update manga images",
    };
  }
};