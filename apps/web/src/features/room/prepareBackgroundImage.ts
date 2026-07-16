import { ROOM_BACKGROUND_IMAGE_MAX_LENGTH } from '@rollycast/shared';

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function prepareBackgroundImage(file: File, fillColor: string): Promise<string> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose an image smaller than 10 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read. Try a different file.');
  }

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is not available in this browser.');

    let maximumEdge = 1024;
    let quality = 0.82;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const scale = Math.min(1, maximumEdge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = fillColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const encoded = canvas.toDataURL('image/jpeg', quality);
      if (encoded.length <= ROOM_BACKGROUND_IMAGE_MAX_LENGTH) return encoded;

      if (quality > 0.38) {
        quality -= 0.11;
      } else {
        maximumEdge = Math.max(160, Math.floor(maximumEdge * 0.75));
        quality = 0.72;
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error('That image is too detailed to fit. Try a smaller image.');
}
