import { auth, firestore } from "@/firebase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const featuredDoc = await firestore.collection("settings").doc("featured").get();
    
    if (!featuredDoc.exists) {
      return NextResponse.json({ data: [] });
    }

    const data = featuredDoc.data();
    const mangaIds = data?.mangas || [];

    // Fetch manga details
    const mangaPromises = mangaIds.map(async (item: any) => {
      try {
        const mangaDoc = await firestore.collection("mangas").doc(item.mangaId).get();
        if (!mangaDoc.exists) return null;

        const mangaData = mangaDoc.data();
        return {
          mangaId: item.mangaId,
          mangaTitle: mangaData?.title || "",
          mangaImage: mangaData?.mangaImage || "",
          order: item.order,
        };
      } catch (error) {
        console.error(`Error fetching manga ${item.mangaId}:`, error);
        return null;
      }
    });

    const mangas = await Promise.all(mangaPromises);
    const validMangas = mangas.filter((m) => m !== null);

    return NextResponse.json({ data: validMangas });
  } catch (error) {
    console.error("Error fetching featured mangas:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { mangas } = await request.json();

    await firestore.collection("settings").doc("featured").set({
      mangas: mangas,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving featured mangas:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}