const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;
// Below this, a re-encode is more likely to cost quality than it saves in
// bytes — skip already-reasonably-sized photos rather than degrading them
// for no real benefit.
const COMPRESS_ABOVE_BYTES = 1 * 1024 * 1024; // 1MB

/**
 * Downscales + re-encodes an oversized JPEG on the client before it's ever
 * uploaded — same canvas-based approach PhotoCaptureControl already uses
 * for live camera captures, applied here to picked files too. Only touches
 * JPEGs: PNG/GIF are left alone, since re-encoding as JPEG would flatten
 * PNG transparency to a solid background and destroy GIF animation.
 */
export async function compressImageFileIfNeeded(file: File): Promise<File> {
  if (file.type !== 'image/jpeg' || file.size <= COMPRESS_ABOVE_BYTES) {
    return file;
  }

  let objectUrl: string | null = null;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image for compression'));
      img.src = objectUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name, { type: 'image/jpeg' });
  } catch {
    // Compression is a best-effort optimization — any failure just falls
    // back to uploading the original file, still subject to the normal
    // size validation.
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
