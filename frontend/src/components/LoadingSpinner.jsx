export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2.5 py-6 text-[12px] text-muted" role="status">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rule border-t-ink" />
      {label}
    </div>
  );
}
