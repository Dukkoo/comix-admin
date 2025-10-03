// app/api/carousel-mangas/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const carouselSchema = z.object({
  mangaIds: z.array(z.string()).max(6, "Maximum 6 mangas allowed in carousel"),
});

// GET - Fetch selected carousel mangas
export async function GET(request: NextRequest) {
  try {
    // Get carousel settings from Firestore
    const carouselDoc = await firestore.collection("settings").doc("carousel").get();
    
    if (!carouselDoc.exists) {
      return NextResponse.json({ data: [] });
    }
    
    const carouselData = carouselDoc.data();
    const mangaIds = carouselData?.mangaIds || [];
    
    if (mangaIds.length === 0) {
      return NextResponse.json({ data: [] });
    }
    
    // Fetch the actual manga data for selected IDs
    const mangaPromises = mangaIds.map(async (mangaId: string) => {
      try {
        const mangaDoc = await firestore.collection("mangas").doc(mangaId).get();
        if (mangaDoc.exists) {
          const data = mangaDoc.data();
          return {
            id: mangaDoc.id,
            title: data?.title || "",
            type: data?.type || "manga",
            coverImage: data?.coverImage || "",
            avatarImage: data?.avatarImage || "", // Keep as fallback
            description: data?.description || "",
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching manga ${mangaId}:`, error);
        return null;
      }
    });
    
    const mangas = await Promise.all(mangaPromises);
    // Filter out any null results (failed fetches or non-existent mangas)
    const validMangas = mangas.filter(manga => manga !== null);
    
    return NextResponse.json({ data: validMangas });
  } catch (error) {
    console.error("Error fetching carousel mangas:", error);
    return NextResponse.json(
      { error: "Failed to fetch carousel mangas" },
      { status: 500 }
    );
  }
}

// POST - Save selected carousel mangas (Admin only)
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
    const validation = carouselSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: true, 
          message: validation.error.issues[0]?.message || "Validation failed" 
        },
        { status: 400 }
      );
    }

    const { mangaIds } = validation.data;

    // Verify all manga IDs exist
    const mangaChecks = await Promise.all(
      mangaIds.map(async (mangaId) => {
        const mangaDoc = await firestore.collection("mangas").doc(mangaId).get();
        return { id: mangaId, exists: mangaDoc.exists };
      })
    );

    const invalidIds = mangaChecks.filter(check => !check.exists).map(check => check.id);
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { 
          error: true, 
          message: `Invalid manga IDs: ${invalidIds.join(", ")}` 
        },
        { status: 400 }
      );
    }

    // Save carousel settings
    await firestore.collection("settings").doc("carousel").set({
      mangaIds: mangaIds,
      updatedAt: new Date(),
      updatedBy: verifiedToken.uid,
    });

    return NextResponse.json({
      error: false,
      message: "Carousel mangas updated successfully",
    });
  } catch (error) {
    console.error("Error updating carousel mangas:", error);
    return NextResponse.json(
      { error: true, message: "Failed to update carousel mangas" },
      { status: 500 }
    );
  }
}