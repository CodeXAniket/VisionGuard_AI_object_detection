import { useState } from 'react';
import DetectionOverlay from './DetectionOverlay';

/**
 * Shows an event snapshot from S3 (via a presigned URL).
 * With `showBox`, the stored bounding box is drawn on top.
 */
export default function SnapshotImage({ detection, showBox = false, className = '' }) {
  const [failedToLoad, setFailedToLoad] = useState(false);

  if (!detection.imageUrl || failedToLoad) {
    const reason = detection.imageStatus === 'failed' ? 'No image' : 'Unavailable';
    return (
      <div className={`flex items-center justify-center bg-pill font-mono text-[10px] text-muted ${className}`}>
        {reason}
      </div>
    );
  }

  const { x1, y1, x2, y2 } = detection.boundingBox;

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      <img
        src={detection.imageUrl}
        alt={`Snapshot of ${detection.objectClass}`}
        className="h-full w-full object-contain"
        onError={() => setFailedToLoad(true)}
      />
      {showBox && (
        <DetectionOverlay
          detections={[{ class: detection.objectClass, confidence: detection.confidence, bbox: [x1, y1, x2, y2], target: true }]}
          frameWidth={detection.frameWidth}
          frameHeight={detection.frameHeight}
        />
      )}
    </div>
  );
}
