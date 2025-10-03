import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

// GET - Fetch all mangas with search and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || searchParams.get('pageSize') || '10');
    const searchTerm = searchParams.get('search')?.trim().toLowerCase();

    const query = firestore.collection("mangas").orderBy("createdAt", "desc");
    const snapshot = await query.get();
    
    let allMangas = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      
      try {
        const chaptersQuery = firestore
          .collection("mangas")
          .doc(doc.id)
          .collection("chapters")
          .orderBy("chapterNumber", "desc")
          .limit(1);
        
        const chaptersSnapshot = await chaptersQuery.get();
        const latestChapter = chaptersSnapshot.docs[0]?.data()?.chapterNumber || 0;
        
        return {
          id: doc.id,
          title: data.title || "",
          type: data.type || "manga",
          status: data.status || "ongoing",
          description: data.description || "",
          coverImage: data.coverImage || "",
          mangaImage: data.mangaImage || "",
          avatarImage: data.avatarImage || "",
          chapters: data.chapters || 0,
          latestChapter: latestChapter,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy,
        };
      } catch (chapterError) {
        console.error(`Error fetching chapters for manga ${doc.id}:`, chapterError);
        return {
          id: doc.id,
          title: data.title || "",
          type: data.type || "manga",
          status: data.status || "ongoing",
          description: data.description || "",
          coverImage: data.coverImage || "",
          mangaImage: data.mangaImage || "",
          avatarImage: data.avatarImage || "",
          chapters: data.chapters || 0,
          latestChapter: 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy,
        };
      }
    }));

    if (searchTerm) {
      allMangas = allMangas.filter(manga => 
        manga.title.toLowerCase().includes(searchTerm)
      );
    }

    const totalCount = allMangas.length;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    const paginatedMangas = allMangas.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedMangas,
      totalPages,
      totalCount,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching mangas:", error);
    return NextResponse.json(
      { error: "Failed to fetch mangas" },
      { status: 500 }
    );
  }
}

// POST - Create new manga
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: true, message: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json(
        { error: true, message: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = mangaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: true, 
          message: validation.error.issues[0]?.message || "Validation failed" 
        },
        { status: 400 }
      );
    }

    const { id, title, type, status, description, coverImage, mangaImage, avatarImage, chapters } = validation.data;

    const existingManga = await firestore.collection("mangas").doc(id).get();
    if (existingManga.exists) {
      return NextResponse.json(
        { error: true, message: "Manga with this ID already exists" },
        { status: 400 }
      );
    }

    await firestore.collection("mangas").doc(id).set({
      title,
      type,
      status,
      description: description || "",
      coverImage: coverImage || "",
      mangaImage: mangaImage || "",
      avatarImage: avatarImage || "",
      chapters: chapters || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: verifiedToken.uid,
    });

    return NextResponse.json({
      error: false,
      message: "Manga created successfully",
      id: id,
    });
  } catch (error) {
    console.error("Error creating manga:", error);
    return NextResponse.json(
      { error: true, message: "Failed to create manga" },
      { status: 500 }
    );
  }
}