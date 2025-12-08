// lib/upload-direct.ts
export async function uploadImageDirectToR2(
  file: File,
  path: string,
  authToken: string
): Promise<{ url?: string; error?: string }> {
  try {
    const webpBlob = await convertToWebP(file);
    const webpPath = path.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
    
    // Get presigned URL from your API
    const response = await fetch("/api/upload/presigned-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ path: webpPath }),
    });

    if (!response.ok) {
      throw new Error("Failed to get presigned URL");
    }

    const { uploadUrl, fields, publicUrl } = await response.json();

    // Upload directly to R2 (bypasses Vercel completely!)
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    formData.append("file", webpBlob);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error("Upload to R2 failed");
    }

    return { url: publicUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { error: error instanceof Error ? error.message : "Upload failed" };
  }
}

// Convert image to WebP using browser Canvas API
async function convertToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('WebP conversion failed'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}