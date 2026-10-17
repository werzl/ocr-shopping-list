const MAX_IMAGE_EDGE = 2560;
const MIN_IMAGE_EDGE = 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const JPEG_QUALITIES = [0.85, 0.75, 0.65];

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob && blob.type === 'image/jpeg') {
        resolve(blob);
      } else {
        reject(new Error('Could not compress this image. Try a different photo.'));
      }
    }, 'image/jpeg', quality);
  });
}

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  try {
    if (!bitmap.width || !bitmap.height)
      throw new Error('This image has no readable dimensions.');

    const originalEdge = Math.max(bitmap.width, bitmap.height);
    if (originalEdge <= MAX_IMAGE_EDGE && file.size <= MAX_IMAGE_BYTES)
      return file;

    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Image compression is unavailable in this browser.');

    let edge = Math.min(originalEdge, MAX_IMAGE_EDGE);
    const minimumEdge = Math.min(originalEdge, MIN_IMAGE_EDGE);
    while (true) {
      const scale = edge / originalEdge;
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      // JPEG has no transparency; use white to preserve dark handwriting.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of JPEG_QUALITIES) {
        const blob = await encodeJpeg(canvas, quality);
        if (blob.size <= MAX_IMAGE_BYTES)
          return blob;
      }

      if (edge <= minimumEdge)
        throw new Error('This photo is still too large after compression. Crop the list or choose a smaller image.');

      edge = Math.max(minimumEdge, Math.floor(edge * 0.8));
    }
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
