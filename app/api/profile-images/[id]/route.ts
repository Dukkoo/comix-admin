// [АДМИН САЙТ] app/api/profile-images/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { firestore } from "@/firebase/server";

export const runtime = "nodejs";

const PROFILE_IMAGES_COLLECTION = "profileImages";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const updates: { active?: boolean; name?: string } = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim().slice(0, 80);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const ref = firestore.collection(PROFILE_IMAGES_COLLECTION).doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await ref.update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile image update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ref = firestore.collection(PROFILE_IMAGES_COLLECTION).doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const usedBy = await firestore.collection("users").where("avatarId", "==", id).limit(1).get();
    if (!usedBy.empty) {
      return NextResponse.json(
        { error: "Энэ зургийг ашиглаж байгаа хэрэглэгч байна. Устгахын оронд нууна уу" },
        { status: 409 }
      );
    }

    const path = snapshot.data()?.path;
    if (path) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: path,
          })
        );
      } catch (error) {
        console.error("R2 delete failed:", error);
      }
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile image delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}