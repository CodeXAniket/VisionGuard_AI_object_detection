import { useCallback, useEffect, useRef, useState } from 'react';
import DetectionOverlay from '../components/DetectionOverlay';
import ObjectSelector from '../components/ObjectSelector';
import EventList from '../components/EventList';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import SheetBar from '../components/SheetBar';
import SummaryNote from '../components/SummaryNote';
import Seal from '../components/Seal';
import { useApi } from '../hooks/useApi';
import { useMonitoring } from '../context/MonitoringContext';
import { getClasses, getConfig, getHealth, updateConfig } from '../services/monitoringService';
import { getErrorMessage } from '../services/apiClient';
import { formatClassName, formatConfidence } from '../utils/format';

const CAMERA_LABELS = { off: 'Camera off', starting: 'Starting camera…', on: 'Camera on', error: 'Camera error' };

function pickEditable(config) {
  return {
    targetClasses: config.targetClasses,
    confidenceThreshold: config.confidenceThreshold,
    cooldownSeconds: config.cooldownSeconds,
  };
}

const AUTOSAVE_DELAY_MS = 600;

// Returns an error message, or null when the draft can be saved.
function validateDraft(draft) {
  const { cooldownSeconds } = draft;
  if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 5 || cooldownSeconds > 3600) {
    return 'Cooldown must be a whole number between 5 and 3600 seconds.';
  }
  return null;
}

function visionPill(health) {
  if (!health) return { text: 'Vision · checking', dot: 'bg-rule' };
  const vision = health.visionService;
  if (!vision.available) return { text: 'Vision · offline', dot: 'bg-accent-red' };
  if (!vision.modelLoaded) return { text: 'Vision · no model', dot: 'bg-accent-olive' };
  return { text: `Vision · ${vision.model}`, dot: 'bg-accent-green' };
}

export default function LiveMonitoring() {
  const monitoring = useMonitoring();
  const classesRequest = useApi(getClasses, []);
  const configRequest = useApi(getConfig, []);
  const health = useApi(getHealth, []);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [showAllObjects, setShowAllObjects] = useState(true);

  // Start editing from the saved config once it arrives. Only the first time:
  // later saves must not overwrite anything typed while a save was in flight.
  useEffect(() => {
    if (configRequest.data) setDraft((current) => current ?? pickEditable(configRequest.data));
  }, [configRequest.data]);

  // Show the shared camera stream in this page's <video>. A callback ref runs
  // whenever the element mounts (it's rendered only after settings load) and
  // whenever the stream changes - a useEffect would miss the late mount.
  const { stream } = monitoring;
  const attachStream = useCallback(
    (video) => {
      if (video && video.srcObject !== stream) video.srcObject = stream;
    },
    [stream]
  );

  const savedConfig = configRequest.data;
  const isDirty = Boolean(draft && savedConfig) && JSON.stringify(draft) !== JSON.stringify(pickEditable(savedConfig));

  const saveSettings = useCallback(
    async (config) => {
      setIsSaving(true);
      setSettingsError(null);
      try {
        configRequest.setData(await updateConfig(config));
        return true;
      } catch (error) {
        setSettingsError(getErrorMessage(error));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [configRequest.setData]
  );

  // Auto-save: settings apply to the running monitor as soon as they are
  // saved (the backend reads them for every frame), so save shortly after
  // each change instead of waiting for a "Save" click that is easy to miss.
  useEffect(() => {
    if (!isDirty) return undefined;
    const problem = validateDraft(draft);
    if (problem) {
      setSettingsError(problem);
      return undefined;
    }
    setSettingsError(null);
    const timer = setTimeout(() => saveSettings(draft), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, isDirty, saveSettings]);

  // If the user leaves the page before the auto-save fires, save right away.
  const pendingDraft = useRef(null);
  pendingDraft.current = isDirty && !validateDraft(draft) ? draft : null;
  useEffect(
    () => () => {
      if (pendingDraft.current) updateConfig(pendingDraft.current).catch(() => {});
    },
    []
  );

  async function handleStart() {
    if (draft.targetClasses.length === 0) {
      setSettingsError('Select at least one object to monitor.');
      return;
    }
    if (isDirty && !(await saveSettings(draft))) return;
    await monitoring.startMonitoring();
    health.reload();
  }

  if (configRequest.error && !savedConfig) {
    return <ErrorAlert message={configRequest.error} onRetry={configRequest.reload} />;
  }
  if (!draft || !classesRequest.data) return <LoadingSpinner label="Loading monitoring settings…" />;

  const result = monitoring.latestResult;
  const detections = result?.detections ?? [];
  const vision = visionPill(health.data);
  const monitoredList = draft.targetClasses.map(formatClassName).join(', ') || 'nothing yet';

  return (
    <>
      <SheetBar
        left={
          <>
            <span className="pill">
              <span className={`h-1.5 w-1.5 rounded-full ${monitoring.isMonitoring ? 'animate-pulse bg-accent-green' : 'bg-rule'}`} />
              {monitoring.isMonitoring ? `Monitoring${result ? ` · ${result.inferenceMs} ms` : ''}` : CAMERA_LABELS[monitoring.cameraStatus]}
            </span>
            <span className="pill">
              <span className={`h-1.5 w-1.5 rounded-full ${vision.dot}`} />
              {vision.text}
            </span>
          </>
        }
        right={
          monitoring.isMonitoring ? (
            <button type="button" className="btn-stop" onClick={monitoring.stopMonitoring}>
              ■ Stop Monitoring
            </button>
          ) : (
            <button
              type="button"
              className="btn-ink"
              onClick={handleStart}
              disabled={isSaving || monitoring.cameraStatus === 'starting'}
            >
              ● Start Monitoring
            </button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* LEFT: live feed + what is in frame */}
        <section className="min-w-0">
          <span className="strip">Live Feed</span>
          <div className="paper-card p-2">
            <div className="relative aspect-video overflow-hidden rounded-[2px] bg-ink">
              <video ref={attachStream} autoPlay muted playsInline className="h-full w-full object-contain" />
              {result && (
                <DetectionOverlay
                  detections={detections}
                  frameWidth={result.frameWidth}
                  frameHeight={result.frameHeight}
                  showNonTargets={showAllObjects}
                />
              )}
              {!monitoring.stream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-paper/70">
                  <p className="text-[13px] font-medium">Camera is off</p>
                  <p className="text-[11px] text-paper/50">Pick objects on the right, then press Start Monitoring.</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 px-1 pt-2 text-[10.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[1px] bg-accent-red" /> Monitored
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[1px] bg-accent-blue" /> Other
              </span>
              <label className="ml-auto flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showAllObjects}
                  onChange={(e) => setShowAllObjects(e.target.checked)}
                  className="accent-ink"
                />
                Show all detected objects
              </label>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <ErrorAlert message={monitoring.cameraError} />
            <ErrorAlert message={monitoring.detectionError} tone="warning" />
          </div>

          <span className="strip mt-6">Objects in Frame</span>
          <div className="grid grid-cols-[1.4fr_1fr_1.6fr_1fr] gap-1.5 text-[12.5px]">
            {['Object', 'Confidence', 'Box', 'Monitored'].map((heading) => (
              <span key={heading} className="cell py-1 text-[11px] font-semibold">
                {heading}
              </span>
            ))}
            {detections.length === 0 && (
              <span className="cell col-span-4 text-muted">{monitoring.isMonitoring ? 'Nothing in view.' : 'Start monitoring to see live detections.'}</span>
            )}
            {detections.map((d, index) => (
              <div key={`${d.class}-${index}`} className="contents">
                <span className="cell font-medium">{formatClassName(d.class)}</span>
                <span className="cell font-mono">{formatConfidence(d.confidence)}</span>
                <span className="cell font-mono text-[11px] text-ink-soft">{d.bbox.join(', ')}</span>
                <span className={`cell font-medium ${d.target ? 'text-accent-red' : 'text-muted'}`}>{d.target ? 'Yes' : 'No'}</span>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: settings + events */}
        <aside className="space-y-6">
          <div>
            <span className="strip">Objects to Monitor</span>
            <ObjectSelector
              classes={classesRequest.data}
              selected={draft.targetClasses}
              onChange={(targetClasses) => setDraft({ ...draft, targetClasses })}
            />
          </div>

          <div>
            <span className="strip">Settings</span>
            <div className="space-y-3">
              <div>
                <label htmlFor="threshold" className="field-label">
                  Confidence threshold · <span className="font-mono text-ink">{formatConfidence(draft.confidenceThreshold)}</span>
                </label>
                <input
                  id="threshold"
                  type="range"
                  min="0.1"
                  max="0.95"
                  step="0.05"
                  value={draft.confidenceThreshold}
                  onChange={(e) => setDraft({ ...draft, confidenceThreshold: Number(e.target.value) })}
                  className="w-full accent-ink"
                />
              </div>
              <div>
                <label htmlFor="cooldown" className="field-label">Event cooldown (seconds)</label>
                <input
                  id="cooldown"
                  type="number"
                  min="5"
                  max="3600"
                  value={draft.cooldownSeconds}
                  onChange={(e) => setDraft({ ...draft, cooldownSeconds: Number(e.target.value) })}
                  className="field font-mono"
                />
              </div>
              <ErrorAlert message={settingsError} />
              <p className="font-mono text-[10.5px] text-muted" aria-live="polite">
                {isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : '✓ Settings saved'}
              </p>
            </div>
          </div>

          <div className="relative">
            <span className="strip">Recent Events</span>
            {monitoring.sessionEvents.length > 0 && (
              <Seal className="absolute -top-3 right-2 z-10">
                {monitoring.sessionEvents.length}
                <br />
                new
              </Seal>
            )}
            <EventList events={monitoring.sessionEvents} emptyMessage="No events yet in this session." />
          </div>
        </aside>
      </div>

      <SummaryNote
        className="mt-6"
        sentences={[
          <>
            Watching for <b>{monitoredList}</b> at <b>{formatConfidence(draft.confidenceThreshold)} confidence</b>, with a{' '}
            <b>{draft.cooldownSeconds}s cooldown</b> so the same object doesn't repeat.
          </>,
          <>
            Only frames that trigger an event are <b>uploaded to S3</b>; every other frame is discarded.
          </>,
          monitoring.isMonitoring && result && (
            <>
              YOLO is answering in <b>{result.inferenceMs} ms</b> per frame.
            </>
          ),
          monitoring.sessionEvents.length > 0 && (
            <>
              <b>{monitoring.sessionEvents.length} events</b> created in this session.
            </>
          ),
        ]}
      />
    </>
  );
}
