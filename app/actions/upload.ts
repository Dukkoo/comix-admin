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
    
    // Шалгах: зураг эсэх
    const isImage = contentType.startsWith('image/');
    
    if (!isImage) {
      // Зураг биш бол (PDF гэх мэт) шууд upload
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: path,
        Body: buffer,
        ContentType: contentType,
      }));
      
      return { url: `${process.env.R2_PUBLIC_URL}/${path}` };
    }
    
    // Зураг бол WebP болгох
    const isWebP = contentType === "image/webp" || path.toLowerCase().endsWith('.webp');
    
    if (isWebP) {
      // WebP бол optimize л хийх
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
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: finalPath,
      Body: finalBuffer,
      ContentType: "image/webp",
    }));
    
    return { url: `${process.env.R2_PUBLIC_URL}/${finalPath}` };
    
  } catch (error) {
    console.error("Error uploading to R2:", error);
    return { 
      error: error instanceof Error ? error.message : "Upload failed" 
    };
  }
}

// Presigned URL upload (for manga images) - ХЭВЭЭР ҮЛДЭЭХ
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

// Delete from R2 - ХЭВЭЭР ҮЛДЭЭХ
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