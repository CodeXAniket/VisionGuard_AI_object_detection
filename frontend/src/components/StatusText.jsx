// Event status shown as coloured text, like the status column of a tracker.
export const STATUS_COLORS = {
  new: 'text-accent-blue',
  reviewed: 'text-accent-green',
  dismissed: 'text-accent-olive',
};

const LABELS = { new: 'New', reviewed: 'Reviewed', dismissed: 'Dismissed' };

export default function StatusText({ status }) {
  return <span className={`font-medium ${STATUS_COLORS[status] ?? 'text-muted'}`}>{LABELS[status] ?? status}</span>;
}
