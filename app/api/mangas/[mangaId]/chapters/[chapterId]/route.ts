import { NextRequest, NextResponse } from "next/server";
import { auth, firestore } from "@/firebase/server";
import { chapterSchema } from "@/validation/chapterSchema";
import { deleteFromR2Server } from "@/app/actions/upload";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string; chapterId: string }> }
) {
  try {
    const { mangaId, chapterId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await firestore.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    let isSubscribed = false;
    if (decodedToken.admin) {
      isSubscribed = true;
    } else if (userData?.subscriptionStatus === 'subscribed' && userData?.subscriptionEndDate) {
      const endDate = new Date(userData.subscriptionEndDate);
      const now = new Date();
      isSubscribed = endDate > now;
    }

    if (!isSubscribed) {
      return NextResponse.json(
        { error: 'Subscription required', message: 'This content requires an active subscription' },
        { status: 403 }
      );
    }

    const doc = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Chapter not found" },
        { status: 404 }
      );
    }

    const data = doc.data();
    
    const chapter = {
      id: doc.id,
      chapterNumber: data?.chapterNumber || parseInt(doc.id),
      mangaId: mangaId,
      images: data?.images || [],
      title: data?.title || `Chapter ${data?.chapterNumber || doc.id}`,
      publishedAt: data?.publishedAt || null,
      createdAt: data?.createdAt || null,
    };

    try {
      await firestore.collection('userActivity').add({
        userId,
        action: 'read_chapter',
        mangaId,
        chapterId: chapterId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('Failed to record reading activity:', error);
    }

    return NextResponse.json({ data: chapter });
  } catch (error) {
    console.error("Error fetching chapter:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapter" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string; chapterId: string }> }
) {
  try {
    const { mangaId, chapterId } = await params;
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

    const existingDoc = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .get();

    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: "Chapter not found" },
        { status: 404 }
      );
    }

    const { chapterNumber } = validation.data;

    await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .update({
        chapterNumber,
      });

    return NextResponse.json({
      message: "Chapter updated successfully",
    });
  } catch (error) {
    console.error("Error updating chapter:", error);
    return NextResponse.json(
      { error: "Failed to update chapter" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mangaId: string; chapterId: string }> }
) {
  try {
    const { mangaId, chapterId } = await params;
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

    const existingDoc = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .doc(chapterId)
      .get();

    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: "Chapter not found" },
        { status: 404 }
      );
    }

    const chapterData = existingDoc.data();
    let deletedImages = 0;

    // Delete images from R2
    if (chapterData?.images && Array.isArray(chapterData.images)) {
      for (const imageUrl of chapterData.images) {
        try {
          const url = new URL(imageUrl);
          const path = url.pathname.substring(1);
          await deleteFromR2Server(path);
          deletedImages++;
        } catch (error) {
          console.warn("Failed to delete image:", imageUrl);
        }
      }
    }

    // Delete chapter document
    await existingDoc.ref.delete();

    // Update manga chapter count
    const chaptersSnapshot = await firestore
      .collection("mangas")
      .doc(mangaId)
      .collection("chapters")
      .get();

    await firestore.collection("mangas").doc(mangaId).update({
      chapters: chaptersSnapshot.size,
    });

    return NextResponse.json({
      message: "Chapter deleted successfully",
      imagesDeleted: deletedImages,
    });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    return NextResponse.json(
      { error: "Failed to delete chapter" },
      { status: 500 }
    );
  }
}