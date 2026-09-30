export default function Pagination({ page, pages, onPageChange }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button type="button" className="pill" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ← Prev
      </button>
      <span className="font-mono text-[11px] text-muted">
        {page} / {pages}
      </span>
      <button type="button" className="pill" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        Next →
      </button>
    </div>
  );
}
