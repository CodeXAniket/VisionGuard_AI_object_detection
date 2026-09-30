import { Link } from 'react-router-dom';
import { formatClassName, formatConfidence } from '../utils/format';

function DateBlock({ value }) {
  const date = new Date(value);
  return (
    <div className="w-9 shrink-0 text-center leading-none">
      <p className="text-[8px] font-semibold tracking-widest text-ink-soft uppercase">
        {date.toLocaleString(undefined, { month: 'short' })}
      </p>
      <p className="mt-0.5 font-mono text-[17px] font-medium text-ink">{String(date.getDate()).padStart(2, '0')}</p>
    </div>
  );
}

// Detection events written on a yellow sticky note, one line per event.
export default function EventList({ events = [], emptyMessage = 'No detection events yet.' }) {
  return (
    <div className="sticky-note">
      {events.length === 0 && <p className="px-3 py-5 text-[12px] text-ink-soft">{emptyMessage}</p>}
      <ul>
        {events.map((event) => (
          <li key={event.id} className="rise-in border-b border-ink/10 last:border-b-0">
            <Link to="/log" className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink/5">
              <DateBlock value={event.timestamp} />
              <div className="min-w-0 flex-1 text-[12px] leading-snug">
                <p className="truncate text-ink">
                  {formatClassName(event.objectClass)} detected · {formatConfidence(event.confidence)}
                </p>
                <p className="font-mono text-[10px] text-ink-soft">
                  {new Date(event.timestamp).toLocaleTimeString()}
                  {event.imageStatus === 'failed' && ' · no image'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
