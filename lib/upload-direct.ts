// lib/upload-direct.ts

export async function uploadImageDirectToR2(
  file: File,
  path: string,
  token: string
): Promise<string> {
  try {
    // GIF, WebP хөрвүүлэхгүй
    const skipConversion = file.type === "image/gif" || file.type === "image/webp";
    
    let uploadFile: Blob = file;
    let uploadPath = path;
    let contentType = file.type;

    if (!skipConversion) {
      uploadFile = await convertToWebP(file);
      uploadPath = path.replace(/\.(jpg|jpeg|png)$/i, ".webp");
      contentType = "image/webp";
    }

    const response = await fetch("/api/upload/presigned-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: uploadPath,
        contentType,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get presigned URL");
    }

    const { uploadUrl, publicUrl } = await response.json();

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: uploadFile,
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
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
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

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}