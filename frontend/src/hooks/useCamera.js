import { useCallback, useEffect, useRef, useState } from 'react';

// Maps browser getUserMedia errors to messages a user can act on.
export function describeCameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
      return 'The camera is already in use by another application.';
    default:
      return `Could not start the camera: ${error?.message || 'unknown error'}`;
  }
}

/**
 * Owns the webcam MediaStream.
 * cameraStatus: 'off' | 'starting' | 'on' | 'error'
 */
export function useCamera() {
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('off');
  const [cameraError, setCameraError] = useState(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const stopCamera = useCallback(() => {
    releaseStream();
    setCameraStatus('off');
  }, [releaseStream]);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return streamRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError('This browser does not support camera access (it requires HTTPS or localhost).');
      return null;
    }

    setCameraStatus('starting');
    setCameraError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      // Camera unplugged or permission revoked while running.
      media.getVideoTracks()[0]?.addEventListener('ended', () => {
        releaseStream();
        setCameraStatus('error');
        setCameraError('The camera stream ended unexpectedly.');
      });
      streamRef.current = media;
      setStream(media);
      setCameraStatus('on');
      return media;
    } catch (error) {
      setCameraStatus('error');
      setCameraError(describeCameraError(error));
      return null;
    }
  }, [releaseStream]);

  // Always release the camera when the owner unmounts.
  useEffect(() => releaseStream, [releaseStream]);

  return { stream, cameraStatus, cameraError, startCamera, stopCamera };
}
