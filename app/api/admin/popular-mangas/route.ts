// app/api/admin/popular-mangas/route.ts
import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const popularSchema = z.object({
  mangas: z.array(z.object({
    mangaId: z.string(),
    order: z.number().min(1).max(3)
  })).max(3, "Maximum 3 mangas allowed in popular section"),
});

// GET - Fetch selected popular mangas
export async function GET(request: NextRequest) {
  try {
    // Get popular settings from Firestore
    const popularDoc = await firestore.collection("settings").doc("popular").get();
    
    if (!popularDoc.exists) {
      return NextResponse.json({ data: [] });
    }
    
    const popularData = popularDoc.data();
    const mangaEntries = popularData?.mangas || [];
    
    if (mangaEntries.length === 0) {
      return NextResponse.json({ data: [] });
    }
    
    // Sort by order and fetch the actual manga data
    const sortedEntries = mangaEntries.sort((a: any, b: any) => a.order - b.order);
    
    const mangaPromises = sortedEntries.map(async (entry: any) => {
      try {
        const mangaDoc = await firestore.collection("mangas").doc(entry.mangaId).get();
        if (mangaDoc.exists) {
          const data = mangaDoc.data();
          return {
            id: mangaDoc.id,
            title: data?.title || "",
            type: data?.type || "manga",
            mangaImage: data?.mangaImage || "", // Primary image for popular section
            coverImage: data?.coverImage || "",
            avatarImage: data?.avatarImage || "",
            description: data?.description || "",
            order: entry.order,
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching manga ${entry.mangaId}:`, error);
        return null;
      }
    });
    
    const mangas = await Promise.all(mangaPromises);
    // Filter out any null results and maintain order
    const validMangas = mangas.filter(manga => manga !== null);
    
    return NextResponse.json({ data: validMangas });
  } catch (error) {
    console.error("Error fetching popular mangas:", error);
    return NextResponse.json(
      { error: "Failed to fetch popular mangas" },
      { status: 500 }
    );
  }
}

// POST - Save selected popular mangas (Admin only)
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
    const validation = popularSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: true, 
          message: validation.error.issues[0]?.message || "Validation failed" 
        },
        { status: 400 }
      );
    }

    const { mangas } = validation.data;

    // Verify all manga IDs exist
    const mangaChecks = await Promise.all(
      mangas.map(async (entry) => {
        const mangaDoc = await firestore.collection("mangas").doc(entry.mangaId).get();
        return { id: entry.mangaId, exists: mangaDoc.exists };
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

    // Validate order numbers are unique and sequential
    const orders = mangas.map(m => m.order).sort((a, b) => a - b);
    const expectedOrders = Array.from({ length: mangas.length }, (_, i) => i + 1);
    
    if (JSON.stringify(orders) !== JSON.stringify(expectedOrders)) {
      return NextResponse.json(
        { 
          error: true, 
          message: "Order numbers must be sequential starting from 1" 
        },
        { status: 400 }
      );
    }

    // Save popular settings
    await firestore.collection("settings").doc("popular").set({
      mangas: mangas,
      updatedAt: new Date(),
      updatedBy: verifiedToken.uid,
    });

    return NextResponse.json({
      error: false,
      message: "Popular mangas updated successfully",
    });
  } catch (error) {
    console.error("Error updating popular mangas:", error);
    return NextResponse.json(
      { error: true, message: "Failed to update popular mangas" },
      { status: 500 }
    );
  }
}