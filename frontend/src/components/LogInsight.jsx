import SummaryNote from './SummaryNote';
import { formatClassName, formatRelativeTime } from '../utils/format';

const DOT_COUNT = 120;

// ---------- Status breakdown: four paper cut-out shapes ----------
const SHAPES = [
  { key: 'new', label: 'New', className: 'bg-shape-blue [clip-path:polygon(22%_0,100%_0,78%_100%,0_100%)]', ink: '#1f5f9e' },
  { key: 'today', label: 'Today', className: 'rounded-full bg-shape-yellow', ink: '#8f8433' },
  { key: 'reviewed', label: 'Reviewed', className: 'rounded-[50%] bg-shape-green', ink: '#3f8a5a' },
  { key: 'dismissed', label: 'Dismissed', className: 'bg-shape-salmon', ink: '#9e3b22' },
];

function StatusShapes({ stats }) {
  const values = { ...stats.statusCounts, today: stats.detectionsToday };
  return (
    <div className="grid grid-cols-2 gap-3">
      {SHAPES.map((shape, index) => (
        <div
          key={shape.key}
          className={`pop-in flex aspect-[5/4] flex-col items-center justify-center ${shape.className}`}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <span className="font-mono text-[28px] leading-none font-medium" style={{ color: shape.ink }}>
            {values[shape.key]}
          </span>
          <span className="mt-1 text-[11px] font-medium" style={{ color: shape.ink }}>
            {shape.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- Dot matrix: share of all events that happened today ----------
function DotMatrix({ today, total }) {
  const filled = total === 0 ? 0 : Math.max(today > 0 ? 1 : 0, Math.round((today / total) * DOT_COUNT));
  return (
    <div className="cell flex gap-4 p-4">
      <div className="grid flex-1 grid-cols-12 gap-1.5">
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <span
            key={index}
            className={`pop-in aspect-square rounded-full ${index < filled ? 'bg-dot' : 'bg-rule/60'}`}
            style={{ animationDelay: `${index * 4}ms` }}
          />
        ))}
      </div>
      <div className="shrink-0">
        <p className="font-mono text-[30px] leading-none font-medium text-dot">
          {today}
          <span className="text-[14px] text-muted"> / {total}</span>
        </p>
        <p className="mt-1 text-[11px] font-medium text-dot">
          Events
          <br />
          today
        </p>
      </div>
    </div>
  );
}

// ---------- Object stamps: rubber stamps for each detected class ----------
const STAMP_SHAPES = [
  <circle key="c" cx="40" cy="40" r="33" />,
  <polygon key="h" points="5,40 19,15 61,15 75,40 61,65 19,65" />,
  <polygon key="o" points="24,6 56,6 74,24 74,56 56,74 24,74 6,56 6,24" />,
  <rect key="r" x="5" y="20" width="70" height="40" rx="2" />,
  <polygon key="p" points="17,18 77,18 63,62 3,62" />,
  <path key="a" d="M10 74 V36 A30 30 0 0 1 70 36 V74 Z" />,
];
const STAMP_COLORS = ['#5b79a8', '#3a352e', '#c0673c', '#b5655a', '#4f9b5a', '#6d6fc4'];
const STAMP_TILT = [-8, 5, -3, 9, -6, 3];

function ObjectStamps({ objects }) {
  if (objects.length === 0) return <p className="text-[12px] text-muted">No objects detected yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-3">
      {objects.map(({ objectClass, count }, index) => {
        const color = STAMP_COLORS[index % STAMP_COLORS.length];
        return (
          <svg
            key={objectClass}
            viewBox="0 0 80 80"
            className="pop-in w-full"
            // `rotate` (not `transform`) so the pop-in animation doesn't cancel the tilt
            style={{ rotate: `${STAMP_TILT[index % STAMP_TILT.length]}deg`, animationDelay: `${index * 60}ms` }}
            role="img"
            aria-label={`${objectClass}: ${count} events`}
          >
            <g fill="none" stroke={color} strokeWidth="2.5" opacity="0.9">
              {STAMP_SHAPES[index % STAMP_SHAPES.length]}
            </g>
            <text x="40" y="40" textAnchor="middle" fill={color} fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="700">
              {objectClass.toUpperCase().slice(0, 11)}
            </text>
            <text x="40" y="52" textAnchor="middle" fill={color} fontFamily="JetBrains Mono, monospace" fontSize="8">
              × {count}
            </text>
          </svg>
        );
      })}
    </div>
  );
}

export default function LogInsight({ stats }) {
  const top = stats.topObjects[0];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <section>
          <span className="strip">Status Breakdown</span>
          <StatusShapes stats={stats} />
        </section>
        <section>
          <span className="strip">Detections Today</span>
          <DotMatrix today={stats.detectionsToday} total={stats.totalDetections} />
        </section>
        <section>
          <span className="strip">Objects Detected</span>
          <ObjectStamps objects={stats.topObjects} />
        </section>
      </div>

      <SummaryNote
        className="mt-6"
        sentences={
          stats.totalDetections === 0
            ? [<>The log is empty. Start monitoring on the <b>Live Camera</b> tab to record events.</>]
            : [
                <>
                  The detection log holds <b>{stats.totalDetections} events</b>, with <b>{stats.detectionsToday} today</b>.
                </>,
                top && (
                  <>
                    <b>{formatClassName(top.objectClass)}</b> is the most frequent object ({top.count} events).
                  </>
                ),
                stats.statusCounts.new > 0 && (
                  <>
                    <b>{stats.statusCounts.new} events</b> are still marked new and waiting for review.
                  </>
                ),
                stats.failedUploads > 0 ? (
                  <>
                    <b>{stats.failedUploads} snapshots</b> could not be uploaded to S3; check the AWS settings.
                  </>
                ) : (
                  <>
                    All snapshots are <b>stored in S3</b>.
                  </>
                ),
                stats.lastDetectionAt && (
                  <>
                    Last event <b>{formatRelativeTime(stats.lastDetectionAt)}</b>.
                  </>
                ),
              ]
        }
      />
    </>
  );
}
