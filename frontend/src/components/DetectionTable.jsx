import SnapshotImage from './SnapshotImage';
import { DETECTION_STATUSES, STATUS_COLORS } from '../constants';
import { formatClassName, formatConfidence, formatDateTime } from '../utils/format';

const COLUMNS = ['Source', 'Object', 'Confidence', 'Timestamp', 'Snapshot', 'Status', ''];
const GRID = 'grid-cols-[64px_1.1fr_0.9fr_1.6fr_96px_1fr_40px]';

/**
 * Paper-strip table: every cell is its own little piece of paper on the grid.
 * "View" opens the full snapshot; the status can be changed and the event
 * deleted right here.
 */
export default function DetectionTable({ detections, onStatusChange, onDelete, busyId = null }) {
  return (
    <div className="overflow-x-auto">
      <div className={`grid min-w-[760px] ${GRID} gap-1.5`}>
        {COLUMNS.map((column, index) => (
          <span key={index} className="cell py-1 text-[11px] font-semibold">
            {column}
          </span>
        ))}

        {detections.map((detection, index) => {
          const delay = { animationDelay: `${index * 35}ms` };
          const label = `${detection.objectClass} at ${formatDateTime(detection.timestamp)}`;
          const isBusy = busyId === detection.id;
          return (
            <div key={detection.id} className="contents">
              <span className="rise-in flex items-center" style={delay}>
                {detection.imageUrl ? (
                  <a href={detection.imageUrl} target="_blank" rel="noreferrer" className="pill w-full justify-center">
                    View
                  </a>
                ) : (
                  <span className="pill w-full justify-center opacity-50" title="No snapshot was uploaded">
                    View
                  </span>
                )}
              </span>
              <span className="cell rise-in font-medium" style={delay}>{formatClassName(detection.objectClass)}</span>
              <span className="cell rise-in font-mono" style={delay}>{formatConfidence(detection.confidence)}</span>
              <span className="cell rise-in text-ink-soft" style={delay}>{formatDateTime(detection.timestamp)}</span>
              <span className="cell rise-in p-1" style={delay}>
                <SnapshotImage detection={detection} className="h-7 w-full rounded-[2px]" />
              </span>
              <span className="cell rise-in py-1" style={delay}>
                <select
                  aria-label={`Status of ${label}`}
                  value={detection.status}
                  disabled={isBusy}
                  onChange={(event) => onStatusChange(detection.id, event.target.value)}
                  className={`w-full cursor-pointer bg-transparent py-1 font-medium capitalize focus:outline-none ${STATUS_COLORS[detection.status]}`}
                >
                  {DETECTION_STATUSES.map((status) => (
                    <option key={status} value={status} className="text-ink">
                      {status}
                    </option>
                  ))}
                </select>
              </span>
              <span className="rise-in flex items-center" style={delay}>
                <button
                  type="button"
                  aria-label={`Delete ${label}`}
                  title="Delete event"
                  disabled={isBusy}
                  onClick={() => onDelete(detection.id)}
                  className="pill w-full justify-center hover:text-accent-red!"
                >
                  ×
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
