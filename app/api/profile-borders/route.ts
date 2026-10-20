// [АДМИН САЙТ] app/api/profile-borders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "@/firebase/server";

export const runtime = "nodejs";

const BORDERS_COLLECTION = "profileBorders";
const COUNTERS_COLLECTION = "counters";
const COUNTER_DOC = "profileBorders";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const OUTPUT_SIZE = 512;
const DEFAULT_SCALE = 1.3;
const ALLOWED_TYPES = ["image/png", "image/webp", "image/gif"];
const MAX_MIN_AURA = 1_000_000;

const parseMinAura = (value: FormDataEntryValue | null): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 && number <= MAX_MIN_AURA ? Math.floor(number) : 0;
};

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function reserveBorderId(): Promise<string> {
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
    const snapshot = await firestore.collection(BORDERS_COLLECTION).orderBy("createdAt", "desc").get();

    const borders = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        url: data.url || "",
        path: data.path || "",
        name: data.name || "",
        active: data.active !== false,
        scale: typeof data.scale === "number" ? data.scale : DEFAULT_SCALE,
        minAura: typeof data.minAura === "number" ? data.minAura : 0,
        createdAt: data.createdAt?.toMillis?.() ?? 0,
      };
    });

    return NextResponse.json({ images: borders });
  } catch (error) {
    console.error("Profile borders list error:", error);
    return NextResponse.json({ error: "Failed to load borders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    // Хүрээ нь тунгалаг байх ёстой тул зөвхөн PNG / WebP / GIF
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, WebP or GIF images are allowed" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be less than 5MB" }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const isGif = file.type === "image/gif";
    const minAura = parseMinAura(formData.get("minAura"));

    let output: Buffer;
    let extension: string;
    let contentType: string;

    if (isGif) {
      if (input.subarray(0, 4).toString("ascii") !== "GIF8") {
        return NextResponse.json({ error: "Invalid GIF file" }, { status: 400 });
      }
      // GIF-ийг хөдөлгөөнтэй нь хэвээр хадгална. Дөрвөлжин биш бол хүрээ аватартай таарахгүй тул татгалзана
      try {
        const meta = await sharp(input).metadata();
        const frameHeight = meta.pageHeight ?? meta.height;
        if (meta.width && frameHeight && Math.abs(meta.width - frameHeight) / Math.max(meta.width, frameHeight) > 0.05) {
          return NextResponse.json(
            { error: `GIF дөрвөлжин байх ёстой (одоо ${meta.width}×${frameHeight})` },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("GIF metadata read failed:", error);
      }

      output = input;
      extension = "gif";
      contentType = "image/gif";
    } else {
      // Дөрвөлжин болгож, тунгалаг байдлыг хадгална (хайчлахгүй, захыг нь тунгалагаар дүүргэнэ)
      output = await sharp(input)
        .rotate()
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90, alphaQuality: 100, effort: 4 })
        .toBuffer();
      extension = "webp";
      contentType = "image/webp";
    }

    const id = await reserveBorderId();
    const path = `profile-borders/${id}.${extension}`;

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
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "border";

    await firestore.collection(BORDERS_COLLECTION).doc(id).set({
      url,
      path,
      name,
      active: true,
      scale: DEFAULT_SCALE,
      minAura,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      image: { id, url, path, name, active: true, scale: DEFAULT_SCALE, minAura, createdAt: Date.now() },
    });
  } catch (error) {
    console.error("Profile border upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}