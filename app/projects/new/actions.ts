"use server";

import { auth, firestore } from "@/firebase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// Updated schema to include avatar image
const mangaSchema = z.object({
  id: z.string().min(1, "ID is required"),
  title: z.string().min(1, "Title is required"),
  type: z.enum(["manga", "manhwa", "manhua", "webtoon", "comic"], {
    required_error: "Type is required",
  }),
  status: z.enum(["ongoing", "finished"], {
    required_error: "Status is required",
  }).default("ongoing"),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  mangaImage: z.string().optional(),
  avatarImage: z.string().optional(),
  chapters: z.number().min(0).optional(),
});

// Create a new manga
export const createManga = async (
  mangaData: z.infer<typeof mangaSchema>,
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized",
      };
    }

    const validation = mangaSchema.safeParse(mangaData);
    if (!validation.success) {
      return {
        error: true,
        message: validation.error.issues[0]?.message ?? "Validation failed",
      };
    }

    // Check if manga with this ID already exists
    const existingManga = await firestore.collection("mangas").doc(validation.data.id).get();
    if (existingManga.exists) {
      return {
        error: true,
        message: "Manga with this ID already exists",
      };
    }

    // Use the provided ID from the form (4-digit random ID)
    await firestore.collection("mangas").doc(validation.data.id).set({
      title: validation.data.title,
      type: validation.data.type,
      status: validation.data.status,
      description: validation.data.description || "",
      coverImage: validation.data.coverImage || "",
      mangaImage: validation.data.mangaImage || "",
      avatarImage: validation.data.avatarImage || "",
      chapters: validation.data.chapters || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: verifiedToken.uid,
    });

    revalidatePath("/projects");

    return {
      error: false,
      message: "Manga created successfully",
      id: validation.data.id,
    };
  } catch (error) {
    console.error("Error creating manga:", error);
    return {
      error: true,
      message: "Failed to create manga",
    };
  }
};

// Update an existing manga
export const updateManga = async (
  {
    mangaId,
    mangaData,
  }: {
    mangaId: string;
    mangaData: Partial<z.infer<typeof mangaSchema>>;
  },
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized",
      };
    }

    const validation = mangaSchema.partial().safeParse(mangaData);
    if (!validation.success) {
      return {
        error: true,
        message: validation.error.issues[0]?.message ?? "Validation failed",
      };
    }

    await firestore.collection("mangas").doc(mangaId).update({
      ...validation.data,
      updatedAt: new Date(),
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/edit/${mangaId}`);

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

// Delete a manga
export const deleteManga = async (mangaId: string, authToken: string) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized",
      };
    }

    const schema = z.string().min(1);
    const validation = schema.safeParse(mangaId);
    if (!validation.success) {
      return {
        error: true,
        message: "Invalid manga ID",
      };
    }

    // Also delete all chapters associated with this manga
    const chaptersSnapshot = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .get();

    const batch = firestore.batch();
    
    // Delete manga
    batch.delete(firestore.collection("mangas").doc(mangaId));
    
    // Delete all chapters from subcollection
    chaptersSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    revalidatePath("/projects");

    return {
      error: false,
      message: "Manga and all associated chapters deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting manga:", error);
    return {
      error: true,
      message: "Failed to delete manga",
    };
  }
};

// Update manga images (now includes avatar image)
export const updateMangaImages = async (
  {
    mangaId,
    coverImage,
    mangaImage,
    avatarImage,
  }: {
    mangaId: string;
    coverImage?: string;
    mangaImage?: string;
    avatarImage?: string;
  },
  authToken: string
) => {
  try {
    const verifiedToken = await auth.verifyIdToken(authToken);

    if (!verifiedToken.admin) {
      return {
        error: true,
        message: "Unauthorized",
      };
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (coverImage !== undefined) {
      updateData.coverImage = coverImage;
    }

    if (mangaImage !== undefined) {
      updateData.mangaImage = mangaImage;
    }

    if (avatarImage !== undefined) {
      updateData.avatarImage = avatarImage;
    }

    await firestore.collection("mangas").doc(mangaId).update(updateData);

    revalidatePath("/projects");
    revalidatePath(`/projects/edit/${mangaId}`);

    return {
      error: false,
      message: "Images updated successfully",
    };
  } catch (error) {
    console.error("Error updating images:", error);
    return {
      error: true,
      message: "Failed to update images",
    };
  }
};