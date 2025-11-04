"use server";

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Direct upload WITH SHARP WEBP CONVERSION
export async function uploadToR2Server(
  fileBuffer: ArrayBuffer,
  path: string,
  contentType: string
): Promise<{ url?: string; error?: string }> {
  try {
    const buffer = Buffer.from(fileBuffer);
    
    let finalBuffer: Buffer;
    let finalPath: string;
    let finalContentType: string;
    
    // Check if it's an image
    const isImage = contentType.startsWith('image/');
    
    if (!isImage) {
      // Not an image (like PDF) - upload directly
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: path,
        Body: buffer,
        ContentType: contentType,
      }));
      
      return { url: `${process.env.R2_PUBLIC_URL}/${path}` };
    }
    
    // Check if it's already WebP or GIF
    const isWebP = contentType === "image/webp" || path.toLowerCase().endsWith('.webp');
    const isGif = contentType === "image/gif" || path.toLowerCase().endsWith('.gif');
    
    if (isWebP || isGif) {
      // Don't convert WebP or GIF - upload as is
      finalBuffer = buffer;
      finalPath = path;
      finalContentType = contentType;
    } else {
      // PNG/JPG - convert to WebP
      finalBuffer = await sharp(buffer)
        .webp({ 
          quality: 85,
          effort: 6
        })
        .toBuffer();
      
      finalPath = path.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      finalContentType = "image/webp";
    }
    
    // Upload to R2
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: finalPath,
      Body: finalBuffer,
      ContentType: finalContentType,
    }));
    
    return { url: `${process.env.R2_PUBLIC_URL}/${finalPath}` };
    
  } catch (error) {
    console.error("Error uploading to R2:", error);
    return { 
      error: error instanceof Error ? error.message : "Upload failed" 
    };
  }
}

// Presigned URL upload (for manga images) - KEEP AS IS
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

// Delete from R2 - KEEP AS IS
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