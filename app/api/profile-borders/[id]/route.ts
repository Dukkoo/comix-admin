// [АДМИН САЙТ] app/api/profile-borders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { firestore } from "@/firebase/server";

export const runtime = "nodejs";

const BORDERS_COLLECTION = "profileBorders";
const MIN_SCALE = 1;
const MAX_SCALE = 2.5;
const MAX_MIN_AURA = 1_000_000;

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

    const updates: { active?: boolean; name?: string; scale?: number; minAura?: number } = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim().slice(0, 80);
    }
    if (body.scale !== undefined) {
      const scale = Number(body.scale);
      if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
        return NextResponse.json({ error: `scale must be between ${MIN_SCALE} and ${MAX_SCALE}` }, { status: 400 });
      }
      updates.scale = Math.round(scale * 100) / 100;
    }

    if (body.minAura !== undefined) {
      const minAura = Number(body.minAura);
      if (!Number.isFinite(minAura) || minAura < 0 || minAura > MAX_MIN_AURA) {
        return NextResponse.json({ error: `minAura must be between 0 and ${MAX_MIN_AURA}` }, { status: 400 });
      }
      updates.minAura = Math.floor(minAura);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const ref = firestore.collection(BORDERS_COLLECTION).doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await ref.update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile border update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ref = firestore.collection(BORDERS_COLLECTION).doc(id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const usedBy = await firestore.collection("users").where("borderId", "==", id).limit(1).get();
    if (!usedBy.empty) {
      return NextResponse.json(
        { error: "Энэ хүрээг ашиглаж байгаа хэрэглэгч байна. Устгахын оронд нууна уу" },
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
    console.error("Profile border delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}