import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useDetectionLoop } from '../hooks/useDetectionLoop';

const MonitoringContext = createContext(null);

/**
 * Holds the camera + detection loop above the page level, so monitoring
 * keeps running while the user switches between Dashboard / History / Live.
 * It is mounted inside the authenticated layout, so logging out stops the camera.
 */
export function MonitoringProvider({ children }) {
  const { stream, cameraStatus, cameraError, startCamera, stopCamera } = useCamera();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [startError, setStartError] = useState(null);

  // Hidden <video> used only to grab frames (the Live page shows its own copy).
  const captureVideoRef = useRef(null);

  const { latestResult, sessionEvents, detectionError } = useDetectionLoop(
    captureVideoRef.current,
    isMonitoring
  );

  const startMonitoring = useCallback(async () => {
    setStartError(null);
    const media = await startCamera();
    if (!media) return false;

    const video = captureVideoRef.current;
    video.srcObject = media;
    try {
      await video.play();
    } catch (error) {
      setStartError(`Could not play the camera stream: ${error.message}`);
      stopCamera();
      return false;
    }
    setIsMonitoring(true);
    return true;
  }, [startCamera, stopCamera]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (captureVideoRef.current) captureVideoRef.current.srcObject = null;
    stopCamera();
  }, [stopCamera]);

  const value = useMemo(
    () => ({
      stream,
      isMonitoring,
      cameraStatus,
      cameraError: cameraError || startError,
      detectionError,
      latestResult,
      sessionEvents,
      startMonitoring,
      stopMonitoring,
    }),
    [stream, isMonitoring, cameraStatus, cameraError, startError, detectionError, latestResult, sessionEvents, startMonitoring, stopMonitoring]
  );

  return (
    <MonitoringContext.Provider value={value}>
      {children}
      <video
        ref={captureVideoRef}
        muted
        playsInline
        aria-hidden="true"
        className="pointer-events-none fixed right-0 bottom-0 h-px w-px opacity-0"
      />
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) throw new Error('useMonitoring must be used inside <MonitoringProvider>');
  return context;
}
