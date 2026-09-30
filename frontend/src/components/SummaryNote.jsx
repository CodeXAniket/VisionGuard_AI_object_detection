import { Fragment } from 'react';

// A short paragraph at the bottom of a sheet; sentences are separated by
// orange bullets and key phrases are wrapped in <b> by the caller.
export default function SummaryNote({ sentences, className = '' }) {
  const visible = sentences.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <p className={`summary-note ${className}`}>
      {visible.map((sentence, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="bullet" aria-hidden="true" />}
          {sentence}{' '}
        </Fragment>
      ))}
    </p>
  );
}
