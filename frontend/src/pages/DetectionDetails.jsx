import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import SheetBar from '../components/SheetBar';
import SnapshotImage from '../components/SnapshotImage';
import StatusText from '../components/StatusText';
import SummaryNote from '../components/SummaryNote';
import Seal from '../components/Seal';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { deleteDetection, getDetection, updateDetectionStatus } from '../services/detectionService';
import { getErrorMessage } from '../services/apiClient';
import { DETECTION_STATUSES } from '../constants';
import { formatClassName, formatConfidence, formatDateTime } from '../utils/format';

const SEAL_COLORS = { new: '#9dbfe6', reviewed: '#a9d8b4', dismissed: '#ddd38f' };

// A short "ticket number" derived from the MongoDB id, e.g. No. 01189
function ticketNumber(id) {
  return String(parseInt(id.slice(-5), 16) % 100000).padStart(5, '0');
}

function NoteRow({ date, children }) {
  const value = new Date(date);
  return (
    <li className="flex items-center gap-3 border-b border-ink/10 px-3 py-2.5 last:border-b-0">
      <div className="w-9 shrink-0 text-center leading-none">
        <p className="text-[8px] font-semibold tracking-widest text-ink-soft uppercase">
          {value.toLocaleString(undefined, { month: 'short' })}
        </p>
        <p className="mt-0.5 font-mono text-[17px] font-medium">{String(value.getDate()).padStart(2, '0')}</p>
      </div>
      <p className="text-[12px] leading-snug">{children}</p>
    </li>
  );
}

// The event rendered like a bank cheque: script name, ticket number, amount band.
function DetectionTicket({ detection }) {
  const box = detection.boundingBox;
  return (
    <div className="paper-card relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="font-script text-[20px] text-ink-soft">
          No. <span className="font-mono text-[13px] text-accent-red">{ticketNumber(detection.id)}</span>
        </p>
        <p className="font-mono text-[10px] tracking-wider text-muted">C** {detection.id.slice(-10).toUpperCase()}</p>
      </div>

      <p className="mt-1 border-b border-ink/25 pb-1 font-script text-[44px] leading-tight text-ink">
        {formatClassName(detection.objectClass)} detected
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
        <SnapshotImage detection={detection} showBox className="aspect-video rounded-[2px]" />
        <div
          className="flex items-center rounded-[2px] bg-band px-4 py-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 5px, rgba(63,127,198,0.18) 5px 6px)',
          }}
        >
          <p className="font-mono text-[36px] leading-none font-medium tracking-tight text-ink">
            {(detection.confidence * 100).toFixed(1)}
            <span className="text-[20px]"> %</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 font-mono text-[9.5px] tracking-wider text-muted uppercase">
        <span className="rounded-[1px] border border-ink/40 px-1 text-[11px] text-ink">|V|</span>
        <span className="text-right">
          Source {detection.source} · frame {detection.frameWidth}×{detection.frameHeight} · box ({box.x1}, {box.y1}) → ({box.x2},{' '}
          {box.y2})
        </span>
      </div>
    </div>
  );
}

export function EventPlaceholder() {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center gap-3 text-center">
      <div className="sticky-note -rotate-2 px-6 py-5">
        <p className="text-[13px] font-medium">No event selected</p>
        <p className="mt-1 text-[12px] text-ink-soft">Open an event from the Detection Log to see its details.</p>
      </div>
      <Link to="/log" className="pill">
        Go to Detection Log →
      </Link>
    </div>
  );
}

export default function DetectionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { forgetEvent } = useOutletContext();
  const { data: detection, error, isLoading, setData } = useApi(() => getDetection(id), [id]);
  const [actionError, setActionError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  async function runAction(action) {
    setIsBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  const handleStatusChange = (status) => runAction(async () => setData(await updateDetectionStatus(id, status)));

  const handleDelete = () => {
    if (!window.confirm('Delete this detection event and its snapshot? This cannot be undone.')) return;
    runAction(async () => {
      await deleteDetection(id);
      forgetEvent();
      navigate('/log', { replace: true });
    });
  };

  if (isLoading && !detection) return <LoadingSpinner label="Loading event…" />;
  if (error && !detection) {
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} />
        <Link to="/log" className="pill">
          ← Back to Detection Log
        </Link>
      </div>
    );
  }

  const uploaded = detection.imageStatus === 'uploaded';

  return (
    <>
      <SheetBar
        left={
          <>
            <Link to="/log" className="pill">
              ← Log
            </Link>
            <span className="pill font-mono">{formatDateTime(detection.timestamp)}</span>
          </>
        }
        right={
          <button type="button" className="pill text-accent-red!" onClick={handleDelete} disabled={isBusy}>
            Delete event
          </button>
        }
      />

      <ErrorAlert message={actionError} />

      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <span className="strip">Detection Ticket</span>
          <DetectionTicket detection={detection} />
        </section>

        <aside className="space-y-6">
          <div className="relative">
            <span className="strip">Event Log</span>
            <Seal color={SEAL_COLORS[detection.status]} className="absolute -top-3 right-1 z-10">
              {detection.status}
            </Seal>
            <ul className="sticky-note">
              <NoteRow date={detection.timestamp}>
                Detected {detection.objectClass} at {formatConfidence(detection.confidence)}
              </NoteRow>
              <NoteRow date={detection.timestamp}>
                {uploaded ? 'Snapshot stored in S3' : 'Snapshot upload failed'}
              </NoteRow>
              <NoteRow date={detection.updatedAt}>
                Marked <StatusText status={detection.status} />
              </NoteRow>
            </ul>
          </div>

          <div>
            <span className="strip">Status</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Update status">
              {DETECTION_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={detection.status === status}
                  disabled={isBusy}
                  onClick={() => handleStatusChange(status)}
                  className={`pill capitalize ${detection.status === status ? 'bg-ink! text-paper!' : ''}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <SummaryNote
        className="mt-6"
        sentences={[
          <>
            A <b>{detection.objectClass}</b> was detected with <b>{formatConfidence(detection.confidence)} confidence</b> by the{' '}
            {detection.source === 'browser' ? 'browser camera' : 'local camera monitor'}.
          </>,
          uploaded ? (
            <>
              The snapshot is <b>stored privately in S3</b> and shown through a short-lived link.
            </>
          ) : (
            <>
              The snapshot <b>could not be uploaded</b>, but the event metadata was saved.
            </>
          ),
          detection.status === 'new' && (
            <>
              Mark it <b>reviewed</b> once you've checked it.
            </>
          ),
        ]}
      />
    </>
  );
}
