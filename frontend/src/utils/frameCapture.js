// One reusable canvas for all frame grabs.
let canvas = null;

/**
 * Draws the current video frame onto a canvas (downscaled to maxWidth)
 * and encodes it as JPEG. Resizing here keeps uploads small and matches
 * the input size YOLO works best with (640px).
 * Resolves to { blob, width, height } or null if the video isn't ready.
 */
export function captureFrame(video, maxWidth = 640, quality = 0.7) {
  if (!video || !video.videoWidth || !video.videoHeight) return Promise.resolve(null);

  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);

  canvas ??= document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(video, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? { blob, width, height } : null), 'image/jpeg', quality);
  });
}
