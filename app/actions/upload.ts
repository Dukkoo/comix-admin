"use server";

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToR2Server(
  fileBuffer: ArrayBuffer,
  path: string,
  contentType: string
): Promise<{ url?: string; error?: string }> {
  try {
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: path,
      Body: Buffer.from(fileBuffer),
      ContentType: contentType,
    }));
    
    return { url: `${process.env.R2_PUBLIC_URL}/${path}` };
  } catch (error) {
    console.error("Error uploading to R2:", error);
    return { error: "Upload failed" };
  }
}

export async function deleteFromR2Server(path: string): Promise<{ error?: string }> {
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: path,
    }));
    return {};
  } catch (error) {
    console.error("Error deleting from R2:", error);
    return { error: "Delete failed" };
  }
}