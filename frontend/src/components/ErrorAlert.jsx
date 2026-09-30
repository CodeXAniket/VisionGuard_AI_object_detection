export default function ErrorAlert({ message, onRetry, tone = 'error' }) {
  if (!message) return null;
  const bar = tone === 'warning' ? 'border-accent-olive' : 'border-accent-red';
  const text = tone === 'warning' ? 'text-ink-soft' : 'text-accent-red';

  return (
    <div
      className={`rise-in flex items-start justify-between gap-4 rounded-[2px] border-l-4 bg-paper px-3 py-2 text-[12.5px] ${bar} ${text}`}
      role="alert"
    >
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="pill shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}
