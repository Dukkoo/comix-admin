"use server";

import { auth, firestore } from "@/firebase/server";
import { chapterDataSchema } from "@/validation/chapterSchema";
import { revalidatePath } from "next/cache";

export const updateChapter = async (
  mangaId: string,
  chapterId: string,
  updateData: { chapterNumber?: number },
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized access",
      };
    }

    // Update chapter in Firestore
    await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .update({
        ...updateData,
        updatedAt: new Date(),
      });

    revalidatePath(`/projects/chapters/${mangaId}`);
    revalidatePath(`/projects/chapters/${mangaId}/edit/${chapterId}`);

    return {
      error: false,
      message: "Chapter updated successfully",
    };
  } catch (error: any) {
    console.error("Error updating chapter:", error);
    return {
      error: true,
      message: "Failed to update chapter",
    };
  }
};

export const saveChapterImages = async (
  data: {
    mangaId: string;
    chapterId: string;
    images: string[];
  },
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized access",
      };
    }

    const { mangaId, chapterId, images } = data;

    // Update chapter with new image URLs
    await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .update({
        images: images,
        pageCount: images.length,
        updatedAt: new Date(),
      });

    revalidatePath(`/projects/chapters/${mangaId}`);
    revalidatePath(`/projects/chapters/${mangaId}/edit/${chapterId}`);

    return {
      error: false,
      message: "Images updated successfully",
    };
  } catch (error: any) {
    console.error("Error saving chapter images:", error);
    return {
      error: true,
      message: "Failed to save images",
    };
  }
};

export const deleteChapterImage = async (
  data: {
    mangaId: string;
    chapterId: string;
    imageUrl: string;
  },
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized access",
      };
    }

    const { mangaId, chapterId, imageUrl } = data;

    const chapterDoc = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .get();

    if (!chapterDoc.exists) {
      return {
        error: true,
        message: "Chapter not found",
      };
    }

    const chapterData = chapterDoc.data();
    const currentImages = chapterData?.images || [];

    // Remove the image
    const updatedImages = currentImages.filter((img: string) => img !== imageUrl);

    // Update chapter with new images array
    await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .update({
        images: updatedImages,
        pageCount: updatedImages.length,
        updatedAt: new Date(),
      });

    revalidatePath(`/projects/chapters/${mangaId}/edit/${chapterId}`);

    return {
      error: false,
      message: "Image deleted successfully",
    };
  } catch (error: any) {
    console.error("Error deleting image:", error);
    return {
      error: true,
      message: "Failed to delete image",
    };
  }
};

export const getChapterById = async (
  mangaId: string, 
  chapterId: string
) => {
  try {
    const chapterDoc = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .get();

    if (!chapterDoc.exists) {
      return {
        error: true,
        message: "Chapter not found",
        data: null,
      };
    }

    const chapterData = chapterDoc.data();
    
    return {
      error: false,
      data: {
        id: chapterDoc.id,
        chapterNumber: chapterData?.chapterNumber || 1,
        mangaId: mangaId,
        images: chapterData?.images || [],
        pageCount: chapterData?.pageCount || 0,
        createdAt: chapterData?.createdAt,
        updatedAt: chapterData?.updatedAt,
      },
    };
  } catch (error: any) {
    console.error("Error fetching chapter:", error);
    return {
      error: true,
      message: "Failed to fetch chapter",
      data: null,
    };
  }
};

export const getMangaById = async (mangaId: string) => {
  try {
    const mangaDoc = await firestore
      .collection("mangas")
      .doc(mangaId)
      .get();

    if (!mangaDoc.exists) {
      return {
        error: true,
        message: "Manga not found",
        data: null,
      };
    }

    const mangaData = mangaDoc.data();
    
    return {
      error: false,
      data: {
        id: mangaDoc.id,
        title: mangaData?.title || "Unknown Manga",
        type: mangaData?.type || "manga",
        status: mangaData?.status || "ongoing",
        description: mangaData?.description || "",
        coverImage: mangaData?.coverImage || "",
        mangaImage: mangaData?.mangaImage || "",
        chapters: mangaData?.chapters || 0,
        createdAt: mangaData?.createdAt,
        updatedAt: mangaData?.updatedAt,
      },
    };
  } catch (error: any) {
    console.error("Error fetching manga:", error);
    return {
      error: true,
      message: "Failed to fetch manga",
      data: null,
    };
  }
};