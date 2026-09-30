import { Link } from 'react-router-dom';
import SnapshotImage from './SnapshotImage';
import StatusText from './StatusText';
import { formatClassName, formatConfidence, formatDateTime } from '../utils/format';

const COLUMNS = ['Source', 'Object', 'Confidence', 'Timestamp', 'Snapshot', 'Status'];
const GRID = 'grid-cols-[64px_1.2fr_0.9fr_1.7fr_96px_0.9fr]';

// Paper-strip table: every cell is its own little piece of paper on the grid.
export default function DetectionTable({ detections }) {
  return (
    <div className="overflow-x-auto">
      <div className={`grid min-w-[700px] ${GRID} gap-1.5`}>
        {COLUMNS.map((column) => (
          <span key={column} className="cell py-1 text-[11px] font-semibold">
            {column}
          </span>
        ))}

        {detections.map((detection, index) => {
          const delay = { animationDelay: `${index * 35}ms` };
          return (
            <div key={detection.id} className="contents">
              <span className="rise-in flex items-center" style={delay}>
                <Link to={`/event/${detection.id}`} className="pill w-full justify-center">
                  View
                </Link>
              </span>
              <span className="cell rise-in font-medium" style={delay}>{formatClassName(detection.objectClass)}</span>
              <span className="cell rise-in font-mono" style={delay}>{formatConfidence(detection.confidence)}</span>
              <span className="cell rise-in text-ink-soft" style={delay}>{formatDateTime(detection.timestamp)}</span>
              <span className="cell rise-in p-1" style={delay}>
                <SnapshotImage detection={detection} className="h-7 w-full rounded-[2px]" />
              </span>
              <span className="cell rise-in" style={delay}>
                <StatusText status={detection.status} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
