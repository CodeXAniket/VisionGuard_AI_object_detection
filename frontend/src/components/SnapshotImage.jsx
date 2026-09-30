import { useState } from 'react';

// Shows an event snapshot from S3 (via a presigned URL), or a small
// placeholder when there is no image.
export default function SnapshotImage({ detection, className = '' }) {
  const [failedToLoad, setFailedToLoad] = useState(false);

  if (!detection.imageUrl || failedToLoad) {
    const reason = detection.imageStatus === 'failed' ? 'No image' : 'Unavailable';
    return (
      <div className={`flex items-center justify-center bg-pill font-mono text-[10px] text-muted ${className}`}>
        {reason}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-ink ${className}`}>
      <img
        src={detection.imageUrl}
        alt={`Snapshot of ${detection.objectClass}`}
        className="h-full w-full object-contain"
        onError={() => setFailedToLoad(true)}
      />
    </div>
  );
}
