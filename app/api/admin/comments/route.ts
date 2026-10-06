// app/api/admin/comments/route.ts
//
// Client сайтын Firestore бүтэц:
//   comments/{id}                      -> сэтгэгдэл (userName, mangaTitle, chapterNumber, text, gifUrl, likeCount, replyCount, createdAt ...)
//   comments/{id}/replies/{replyId}    -> хариулт
//   comments/{id}/likes/{uid}          -> like (хариултад ч адил likes дэд collection)
//
// GET    /api/admin/comments?limit=30&cursor=<ms>   -> сүүлийн сэтгэгдлүүд (шинэ нь эхэндээ)
// GET    /api/admin/comments?parentId=<id>          -> тухайн сэтгэгдлийн хариултууд
// DELETE /api/admin/comments  { commentId }                -> сэтгэгдэл + хариулт + like бүгдийг устгана
// DELETE /api/admin/comments  { commentId, replyId }       -> нэг хариулт (+like) устгаж, replyCount-ыг багасгана
//
// Index хэрэггүй (createdAt нэг талбараар эрэмбэлнэ). firebase-admin >= 10 (recursiveDelete) шаардлагатай.
import { firestore } from "@/firebase/server";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const isValidId = (id: unknown): id is string =>
  typeof id === "string" && id.trim() !== "" && !id.includes("/");

const toIso = (value: any): string | null => {
  const ms = value?.toMillis?.();
  return typeof ms === "number" ? new Date(ms).toISOString() : null;
};

const mapComment = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId || "",
    userName: data.userName || "Хэрэглэгч",
    userAvatarUrl: data.userAvatarUrl || "",
    mangaId: data.mangaId || "",
    mangaTitle: data.mangaTitle || "",
    chapterNumber: typeof data.chapterNumber === "number" ? data.chapterNumber : null,
    text: data.text || "",
    gifUrl: data.gifUrl || null,
    likeCount: data.likeCount || 0,
    replyCount: data.replyCount || 0,
    createdAt: toIso(data.createdAt),
  };
};

const mapReply = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId || "",
    userName: data.userName || "Хэрэглэгч",
    userAvatarUrl: data.userAvatarUrl || "",
    text: data.text || "",
    gifUrl: data.gifUrl || null,
    likeCount: data.likeCount || 0,
    createdAt: toIso(data.createdAt),
  };
};

// ========================================
// GET
// ========================================
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { searchParams } = request.nextUrl;
    const parentId = searchParams.get("parentId");

    // Хариултууд
    if (parentId) {
      if (!isValidId(parentId)) return json({ error: "Invalid parentId" }, 400);

      const snapshot = await firestore
        .collection("comments")
        .doc(parentId)
        .collection("replies")
        .orderBy("createdAt", "asc")
        .limit(200)
        .get();

      return json({ replies: snapshot.docs.map(mapReply) });
    }

    // Сэтгэгдлүүд (cursor = сүүлийн сэтгэгдлийн createdAt, миллисекундээр)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30") || 30));
    const cursor = Number(searchParams.get("cursor"));

    let query: FirebaseFirestore.Query = firestore.collection("comments").orderBy("createdAt", "desc");
    if (Number.isFinite(cursor) && cursor > 0) {
      query = query.startAfter(Timestamp.fromMillis(cursor));
    }

    const snapshot = await query.limit(limit).get();
    const last = snapshot.docs[snapshot.docs.length - 1];
    const lastMs = last?.data().createdAt?.toMillis?.();

    return json({
      comments: snapshot.docs.map(mapComment),
      nextCursor: snapshot.docs.length === limit && typeof lastMs === "number" ? lastMs : null,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return json({ error: "Internal server error" }, 500);
  }
}

// ========================================
// DELETE
// ========================================
export async function DELETE(request: NextRequest) {
  try {
    // Өгөгдөл устгадаг тул token цуцлагдсан эсэхийг мөн шалгана
    const admin = await requireAdmin(request, { checkRevoked: true });
    if (!admin.ok) return admin.response;

    const body = await request.json().catch(() => null);
    const commentId = body?.commentId;
    const replyId = body?.replyId;

    if (!isValidId(commentId) || (replyId !== undefined && !isValidId(replyId))) {
      return json({ error: "Invalid request" }, 400);
    }

    const commentRef = firestore.collection("comments").doc(commentId);

    if (replyId) {
      // ---------- Хариулт устгах ----------
      const replyRef = commentRef.collection("replies").doc(replyId);
      const replySnap = await replyRef.get();
      if (!replySnap.exists) return json({ error: "Reply not found" }, 404);

      const replyData = replySnap.data() || {};

      // Хариулт болон түүний like-уудыг устгана
      await firestore.recursiveDelete(replyRef);

      // Эцэг сэтгэгдлийн replyCount-ыг 0-ээс доош оруулахгүйгээр багасгана
      await firestore.runTransaction(async (tx) => {
        const parent = await tx.get(commentRef);
        if (!parent.exists) return;
        const count = Number(parent.data()?.replyCount) || 0;
        tx.update(commentRef, { replyCount: Math.max(0, count - 1) });
      });

      await writeAudit("delete_reply", admin.token, {
        commentId,
        replyId,
        authorId: replyData.userId ?? null,
        textPreview: String(replyData.text || "").slice(0, 100),
      });
    } else {
      // ---------- Сэтгэгдэл устгах ----------
      const commentSnap = await commentRef.get();
      if (!commentSnap.exists) return json({ error: "Comment not found" }, 404);

      const data = commentSnap.data() || {};

      // Сэтгэгдэл + бүх хариулт + бүх like (client сайт зөвхөн үндсэн document-ыг устгадаг тул
      // дэд collection-ууд хаягдаж үлддэг байсан)
      await firestore.recursiveDelete(commentRef);

      await writeAudit("delete_comment", admin.token, {
        commentId,
        authorId: data.userId ?? null,
        mangaId: data.mangaId ?? null,
        textPreview: String(data.text || "").slice(0, 100),
      });
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return json({ error: "Internal server error" }, 500);
  }
}

// Аудитын бүртгэл (амжилтгүй болсон ч устгалтыг эвдэхгүй)
async function writeAudit(
  action: string,
  admin: { uid: string; email?: string },
  details: Record<string, unknown>
) {
  try {
    await firestore.collection("adminAuditLogs").add({
      at: new Date(),
      action,
      adminUid: admin.uid,
      adminEmail: admin.email ?? null,
      details,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}