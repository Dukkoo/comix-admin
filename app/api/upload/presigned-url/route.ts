// app/api/upload/presigned-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { auth } from "@/firebase/server";

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
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const verifiedToken = await auth.verifyIdToken(token);

    if (!verifiedToken.admin) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const { path } = await request.json();

    if (!path) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    const { url, fields } = await createPresignedPost(r2Client, {
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: path,
      Conditions: [
        ["content-length-range", 0, 52428800], // 50MB max
      ],
      Expires: 3600, // 1 hour
    });

    return NextResponse.json({
      uploadUrl: url,
      fields,
      publicUrl: `${process.env.R2_PUBLIC_URL}/${path}`,
    });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: "Failed to create presigned URL" },
      { status: 500 }
    );
  }
}