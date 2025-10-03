import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";
import { z } from "zod";
import { deleteFromR2Server } from "@/app/actions/upload";

const updateMangaSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  type: z.enum(["manga", "manhwa", "manhua", "webtoon", "comic"]).optional(),
  status: z.enum(["ongoing", "finished"]).optional(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  mangaImage: z.string().optional(),
  avatarImage: z.string().optional(),
});

// GET - Fetch single manga
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  try {
    const { mangaId } = await params;
    const doc = await firestore.collection("mangas").doc(mangaId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Manga not found" },
        { status: 404 }
      );
    }

    const data = doc.data();
    
    const manga = {
      id: doc.id,
      title: data?.title || "",
      type: data?.type || "manga",
      status: data?.status || "ongoing",
      description: data?.description || "",
      coverImage: data?.coverImage || "",
      mangaImage: data?.mangaImage || "",
      avatarImage: data?.avatarImage || "",
      chapters: data?.chapters || 0,
      createdAt: data?.createdAt,
      updatedAt: data?.updatedAt,
      createdBy: data?.createdBy,
    };

    return NextResponse.json({ data: manga });
  } catch (error) {
    console.error("Error fetching manga:", error);
    return NextResponse.json(
      { error: "Failed to fetch manga" },
      { status: 500 }
    );
  }
}

// PUT - Update manga
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  try {
    const { mangaId } = await params;
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: true, message: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json(
        { error: true, message: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateMangaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: true, 
          message: validation.error.issues[0]?.message || "Invalid data" 
        },
        { status: 400 }
      );
    }

    const existingDoc = await firestore.collection("mangas").doc(mangaId).get();

    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: true, message: "Manga not found" },
        { status: 404 }
      );
    }

    const updateData = {
      ...validation.data,
      updatedAt: new Date(),
    };

    await firestore.collection("mangas").doc(mangaId).update(updateData);

    return NextResponse.json({
      error: false,
      message: "Manga updated successfully",
    });
  } catch (error) {
    console.error("Error updating manga:", error);
    return NextResponse.json(
      { error: true, message: "Failed to update manga" },
      { status: 500 }
    );
  }
}

// DELETE - Delete manga and all R2 images
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  try {
    const { mangaId } = await params;
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: true, message: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json(
        { error: true, message: "Admin access required" },
        { status: 403 }
      );
    }

    const existingDoc = await firestore.collection("mangas").doc(mangaId).get();
    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: true, message: "Manga not found" },
        { status: 404 }
      );
    }

    const mangaData = existingDoc.data();
    let deletedFiles = 0;

    // Delete all chapter images from R2
    const chaptersSnapshot = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .get();

    for (const chapterDoc of chaptersSnapshot.docs) {
      const chapterData = chapterDoc.data();
      
      if (chapterData?.images && Array.isArray(chapterData.images)) {
        for (const imageUrl of chapterData.images) {
          try {
            const url = new URL(imageUrl);
            const path = url.pathname.substring(1);
            await deleteFromR2Server(path);
            deletedFiles++;
          } catch (error) {
            console.warn("Failed to delete chapter image:", imageUrl);
          }
        }
      }
      
      await chapterDoc.ref.delete();
    }

    // Delete manga images from R2
    const imageFields = ['coverImage', 'mangaImage', 'avatarImage'];
    for (const field of imageFields) {
      if (mangaData?.[field]) {
        try {
          const url = new URL(mangaData[field]);
          const path = url.pathname.substring(1);
          await deleteFromR2Server(path);
          deletedFiles++;
        } catch (error) {
          console.warn(`Failed to delete ${field}:`, mangaData[field]);
        }
      }
    }

    // Delete manga document
    await firestore.collection("mangas").doc(mangaId).delete();

    return NextResponse.json({
      error: false,
      message: "Manga deleted successfully",
      filesDeleted: deletedFiles,
      chaptersDeleted: chaptersSnapshot.size,
    });
  } catch (error) {
    console.error("Error deleting manga:", error);
    return NextResponse.json(
      { error: true, message: "Failed to delete manga" },
      { status: 500 }
    );
  }
}