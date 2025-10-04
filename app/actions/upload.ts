"use server";

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// NEW: Client-side upload using presigned URL
export async function getPresignedUploadUrl(
  path: string,
  contentType: string,
  authToken: string
): Promise<{ presignedUrl?: string; publicUrl?: string; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/upload/presigned-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ path, contentType }),
      }
    );

    if (!response.ok) {
      return { error: "Failed to get presigned URL" };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error getting presigned URL:", error);
    return { error: "Failed to get presigned URL" };
  }
}

export async function deleteFromR2Server(path: string): Promise<{ error?: string }> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: path,
      })
    );
    return {};
  } catch (error) {
    console.error("Error deleting from R2:", error);
    return { error: "Delete failed" };
  }
}