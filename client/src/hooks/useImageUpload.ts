/**
 * Cloudinary image upload hook for admin panel.
 */

const CLOUD_NAME = "nbbkd7e8";
const UPLOAD_PRESET = "Investabite";
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Image upload failed");
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}
