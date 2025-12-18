// lib/upload-direct.ts
export async function uploadImageDirectToR2(
  file: File,
  path: string,
  token: string
): Promise<string> {
  try {
    // Convert to WebP
    const webpBlob = await convertToWebP(file);

    // Get presigned URL
    const response = await fetch("/api/upload/presigned-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        path,
        contentType: "image/webp",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get presigned URL");
    }

    const { uploadUrl, publicUrl } = await response.json();

    // Upload directly to R2 using PUT
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/webp",
      },
      body: webpBlob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    return publicUrl;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

async function convertToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert image"));
          }
        },
        "image/webp",
        1.0
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}