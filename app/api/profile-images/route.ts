// [АДМИН САЙТ] app/api/profile-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "@/firebase/server";

export const runtime = "nodejs";

const PROFILE_IMAGES_COLLECTION = "profileImages";
const COUNTERS_COLLECTION = "counters";
const COUNTER_DOC = "profileImages";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const OUTPUT_SIZE = 512;

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function reserveImageId(): Promise<string> {
  const counterRef = firestore.collection(COUNTERS_COLLECTION).doc(COUNTER_DOC);

  const next = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const last = snapshot.exists ? Number(snapshot.data()?.last) || 0 : 0;
    const value = last + 1;
    transaction.set(counterRef, { last: value }, { merge: true });
    return value;
  });

  return String(next).padStart(3, "0");
}

export async function GET() {
  try {
    const snapshot = await firestore
      .collection(PROFILE_IMAGES_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    const images = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        url: data.url || "",
        path: data.path || "",
        name: data.name || "",
        active: data.active !== false,
        createdAt: data.createdAt?.toMillis?.() ?? 0,
      };
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Profile images list error:", error);
    return NextResponse.json({ error: "Failed to load images" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Image file required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be less than 5MB" }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

    let output: Buffer;
    let extension: string;
    let contentType: string;

    if (isGif) {
      if (input.subarray(0, 4).toString("ascii") !== "GIF8") {
        return NextResponse.json({ error: "Invalid GIF file" }, { status: 400 });
      }
      output = input;
      extension = "gif";
      contentType = "image/gif";
    } else {
      output = await sharp(input)
        .rotate()
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "attention" })
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
      extension = "webp";
      contentType = "image/webp";
    }

    const id = await reserveImageId();
    const path = `profile-images/${id}.${extension}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: path,
        Body: output,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const url = `${process.env.R2_PUBLIC_URL}/${path}`;
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "profile";

    await firestore.collection(PROFILE_IMAGES_COLLECTION).doc(id).set({
      url,
      path,
      name,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      image: { id, url, path, name, active: true, createdAt: Date.now() },
    });
  } catch (error) {
    console.error("Profile image upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}