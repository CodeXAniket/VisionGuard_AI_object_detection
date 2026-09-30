import { useEffect, useState } from 'react';
import { sendFrame } from '../services/monitoringService';
import { getErrorMessage } from '../services/apiClient';
import { captureFrame } from '../utils/frameCapture';
import { ERROR_RETRY_MS, FRAME_INTERVAL_MS, MAX_FRAME_WIDTH } from '../constants';

const MAX_SESSION_EVENTS = 20;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * While `isRunning` is true: grab a frame from `video`, send it to the
 * backend, store the result, wait, repeat.
 *
 * Only one frame is ever in flight. If inference takes 400 ms we simply send
 * ~2.5 frames/second instead of queueing up a backlog of stale frames.
 */
export function useDetectionLoop(video, isRunning) {
  const [latestResult, setLatestResult] = useState(null);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [detectionError, setDetectionError] = useState(null);

  useEffect(() => {
    if (!isRunning || !video) return undefined;

    const controller = new AbortController();
    let active = true;

    async function processOneFrame() {
      const frame = await captureFrame(video, MAX_FRAME_WIDTH);
      if (!frame) return; // video not ready yet

      const result = await sendFrame(frame.blob, controller.signal);
      if (!active) return;

      setLatestResult(result);
      setDetectionError(null);
      if (result.events.length > 0) {
        setSessionEvents((previous) => [...result.events, ...previous].slice(0, MAX_SESSION_EVENTS));
      }
    }

    async function run() {
      while (active) {
        const startedAt = Date.now();
        let delay;
        try {
          await processOneFrame();
          delay = Math.max(0, FRAME_INTERVAL_MS - (Date.now() - startedAt));
        } catch (error) {
          if (!active || error.code === 'ERR_CANCELED') return;
          // Keep retrying: the backend or vision service may come back.
          // Clear the old boxes so the overlay never shows stale detections.
          setLatestResult(null);
          setDetectionError(getErrorMessage(error));
          delay = ERROR_RETRY_MS;
        }
        await sleep(delay);
      }
    }

    run();

    return () => {
      active = false;
      controller.abort();
      setLatestResult(null);
      setDetectionError(null);
    };
  }, [video, isRunning]);

  return { latestResult, sessionEvents, detectionError };
}
