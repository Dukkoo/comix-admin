import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/firebase/server";
import sharp from "sharp";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const path = formData.get("path") as string;

    if (!file || !path) {
      return NextResponse.json({ error: "Missing file or path" }, { status: 400 });
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let finalBuffer: Buffer;
    let finalPath: string;

    // Шалгах: WebP эсэх
    const isWebP = file.type === "image/webp" || file.name.toLowerCase().endsWith('.webp');

    if (isWebP) {
      // WebP бол optimize л хийх (давхар conversion хийхгүй)
      finalBuffer = await sharp(buffer)
        .webp({ 
          quality: 85,
          effort: 6
        })
        .toBuffer();
      
      finalPath = path.replace(/\.(jpg|jpeg|png|webp)$/i, '.webp');
    } else {
      // PNG/JPG бол WebP болгох
      finalBuffer = await sharp(buffer)
        .webp({ 
          quality: 85,
          effort: 6
        })
        .toBuffer();
      
      finalPath = path.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }

    // R2 руу upload
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: finalPath,
      Body: finalBuffer,
      ContentType: "image/webp",
    });

    await r2Client.send(command);

    // Public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${finalPath}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Vercel timeout багасгах
export const maxDuration = 60; // 60 seconds (Pro plan)
export const config = {
  api: {
    bodyParser: false,
  },
};