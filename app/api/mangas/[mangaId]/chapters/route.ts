import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";
import { chapterSchema } from "@/validation/chapterSchema";

// GET - Fetch chapters for a manga
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  try {
    const { mangaId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const chaptersRef = firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters");
    
    const totalSnapshot = await chaptersRef.get();
    const totalCount = totalSnapshot.size;
    const totalPages = Math.ceil(totalCount / pageSize);

    // If pageSize is very large (like 9999), just get all chapters without pagination
    let snapshot;
    if (pageSize >= 1000) {
      snapshot = await chaptersRef
        .orderBy("chapterNumber", "desc")
        .get();
    } else {
      const offset = (page - 1) * pageSize;
      snapshot = await chaptersRef
        .orderBy("chapterNumber", "desc")
        .limit(pageSize)
        .offset(offset)
        .get();
    }
    
    const chapters: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      chapters.push({
        id: doc.id,
        chapterNumber: data.chapterNumber !== undefined ? data.chapterNumber : parseInt(doc.id),
        mangaId: mangaId,
        createdAt: data.createdAt || null,
      });
    });

    return NextResponse.json({
      data: chapters,
      totalPages,
      totalCount,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch chapters", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// POST - Create new chapter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  try {
    const { mangaId } = await params;
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = chapterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const { chapterNumber } = validation.data;

    // Check if chapter already exists
    const existingChapter = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterNumber.toString())
      .get();

    if (existingChapter.exists) {
      return NextResponse.json(
        { error: "Chapter already exists for this manga" },
        { status: 409 }
      );
    }

    const chapterData = {
      chapterNumber,
      createdAt: new Date().toISOString(),
    };

    // Create chapter document (works for 0 and positive numbers)
    await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterNumber.toString())
      .set(chapterData);

    // Update manga chapter count
    const chaptersSnapshot = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .get();
    
    const chapterCount = chaptersSnapshot.size;

    await firestore.collection("mangas").doc(mangaId).update({
      chapters: chapterCount,
    });

    return NextResponse.json({
      message: "Chapter created successfully",
      id: chapterNumber.toString(),
    });
  } catch (error) {
    console.error("Error creating chapter:", error);
    return NextResponse.json(
      { 
        error: "Failed to create chapter", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}